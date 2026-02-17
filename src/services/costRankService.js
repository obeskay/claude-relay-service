/**
 * 费用OrdenarÍndiceServicio
 *
 * 为 API Keys 提供按费用Ordenar的功能，使用 Redis Sorted Set 预CalcularOrdenarÍndice
 * Soportar today/7days/30days/all 四种固定Tiempo范围的预CalcularÍndice
 * Soportar custom Tiempo范围的实时Calcular
 *
 * 设计原则：
 * - 只Calcular未Eliminar的 API Key
 * - 使用原子Operación避免竞态Condición
 * - 提供增量ActualizarInterfaz供 API Key Crear/Eliminar时调用
 */

const redis = require('../models/redis')
const logger = require('../utils/logger')

// ============================================================================
// 常量Configuración
// ============================================================================

/** Tiempo范围Actualizar间隔Configuración（省资源模式） */
const UPDATE_INTERVALS = {
  today: 10 * 60 * 1000, // 10分钟
  '7days': 30 * 60 * 1000, // 30分钟
  '30days': 60 * 60 * 1000, // 1小时
  all: 2 * 60 * 60 * 1000 // 2小时
}

/** Soportar的Tiempo范围ColumnaTabla */
const VALID_TIME_RANGES = ['today', '7days', '30days', 'all']

/** 分布式锁Tiempo de espera agotadoTiempo（秒） */
const LOCK_TTL = 300

/** 批Procesar大小 */
const BATCH_SIZE = 100

// ============================================================================
// Redis Key Generar器（集中管理 key Formato）
// ============================================================================

const RedisKeys = {
  /** 费用OrdenarÍndice Sorted Set */
  rankKey: (timeRange) => `cost_rank:${timeRange}`,

  /** 临时Índice key（用于原子Reemplazo） */
  tempRankKey: (timeRange) => `cost_rank:${timeRange}:temp:${Date.now()}`,

  /** Índice元Datos Hash */
  metaKey: (timeRange) => `cost_rank_meta:${timeRange}`,

  /** Actualizar锁 */
  lockKey: (timeRange) => `cost_rank_lock:${timeRange}`,

  /** 每日费用 */
  dailyCost: (keyId, date) => `usage:cost:daily:${keyId}:${date}`,

  /** 总费用 */
  totalCost: (keyId) => `usage:cost:total:${keyId}`
}

// ============================================================================
// CostRankService Clase
// ============================================================================

class CostRankService {
  constructor() {
    this.timers = {}
    this.isInitialized = false
  }

  // --------------------------------------------------------------------------
  // 生命周期管理
  // --------------------------------------------------------------------------

  /**
   * InicializarServicio：启动Tarea programada
   * 幂等设计：多次调用只会Inicializar一次
   */
  async initialize() {
    // 先Limpiar可能存在的旧定时器（Soportar热重载）
    this._clearAllTimers()

    if (this.isInitialized) {
      logger.warn('CostRankService already initialized, re-initializing...')
    }

    logger.info('🔄 Initializing CostRankService...')

    try {
      // 启动时立即Actualizar所有Índice（Asíncrono，不Bloqueante启动）
      this.updateAllRanks().catch((err) => {
        logger.error('Failed to initialize cost ranks:', err)
      })

      // Establecer定时Actualizar
      for (const [timeRange, interval] of Object.entries(UPDATE_INTERVALS)) {
        this.timers[timeRange] = setInterval(() => {
          this.updateRank(timeRange).catch((err) => {
            logger.error(`Failed to update cost rank for ${timeRange}:`, err)
          })
        }, interval)
      }

      this.isInitialized = true
      logger.success('CostRankService initialized')
    } catch (error) {
      logger.error('❌ Failed to initialize CostRankService:', error)
      throw error
    }
  }

  /**
   * 关闭Servicio：Limpiar定时器
   */
  shutdown() {
    this._clearAllTimers()
    this.isInitialized = false
    logger.info('CostRankService shutdown')
  }

  /**
   * Limpiar所有定时器
   * @private
   */
  _clearAllTimers() {
    for (const timer of Object.values(this.timers)) {
      clearInterval(timer)
    }
    this.timers = {}
  }

  // --------------------------------------------------------------------------
  // ÍndiceActualizar（全量）
  // --------------------------------------------------------------------------

  /**
   * Actualizar所有Tiempo范围的Índice
   */
  async updateAllRanks() {
    for (const timeRange of VALID_TIME_RANGES) {
      try {
        await this.updateRank(timeRange)
      } catch (error) {
        logger.error(`Failed to update rank for ${timeRange}:`, error)
      }
    }
  }

  /**
   * Actualizar指定Tiempo范围的OrdenarÍndice
   * @param {string} timeRange - Tiempo范围
   */
  async updateRank(timeRange) {
    const client = redis.getClient()
    if (!client) {
      logger.warn('Redis client not available, skipping cost rank update')
      return
    }

    const lockKey = RedisKeys.lockKey(timeRange)
    const rankKey = RedisKeys.rankKey(timeRange)
    const metaKey = RedisKeys.metaKey(timeRange)

    // Obtener分布式锁
    const acquired = await client.set(lockKey, '1', 'NX', 'EX', LOCK_TTL)
    if (!acquired) {
      logger.debug(`Skipping ${timeRange} rank update - another update in progress`)
      return
    }

    const startTime = Date.now()

    try {
      // 标记为Actualizar中
      await client.hset(metaKey, 'status', 'updating')

      // 1. Obtener所有未Eliminar的 API Key IDs
      const keyIds = await this._getActiveApiKeyIds()

      if (keyIds.length === 0) {
        // 无Datos时清空Índice
        await client.del(rankKey)
        await this._updateMeta(client, metaKey, startTime, 0)
        return
      }

      // 2. CalcularFecha范围
      const dateRange = this._getDateRange(timeRange)

      // 3. 分批Calcular费用
      const costs = await this._calculateCostsInBatches(keyIds, dateRange)

      // 4. 原子ActualizarÍndice（使用临时 key + RENAME 避免竞态Condición）
      await this._atomicUpdateIndex(client, rankKey, costs)

      // 5. Actualizar元Datos
      await this._updateMeta(client, metaKey, startTime, keyIds.length)

      logger.info(
        `📊 Updated cost rank for ${timeRange}: ${keyIds.length} keys in ${Date.now() - startTime}ms`
      )
    } catch (error) {
      await client.hset(metaKey, 'status', 'failed')
      logger.error(`Failed to update cost rank for ${timeRange}:`, error)
      throw error
    } finally {
      await client.del(lockKey)
    }
  }

  /**
   * 原子ActualizarÍndice（避免竞态Condición）
   * @private
   */
  async _atomicUpdateIndex(client, rankKey, costs) {
    if (costs.size === 0) {
      await client.del(rankKey)
      return
    }

    // 使用临时 key Construir新Índice
    const tempKey = `${rankKey}:temp:${Date.now()}`

    try {
      // Construir ZADD Parámetro
      const members = []
      costs.forEach((cost, keyId) => {
        members.push(cost, keyId)
      })

      // Escribir临时 key
      await client.zadd(tempKey, ...members)

      // 原子Reemplazo（RENAME 是原子Operación）
      await client.rename(tempKey, rankKey)
    } catch (error) {
      // Limpiar临时 key
      await client.del(tempKey).catch(() => {})
      throw error
    }
  }

  /**
   * Actualizar元Datos
   * @private
   */
  async _updateMeta(client, metaKey, startTime, keyCount) {
    await client.hmset(metaKey, {
      lastUpdate: new Date().toISOString(),
      keyCount: keyCount.toString(),
      status: 'ready',
      updateDuration: (Date.now() - startTime).toString()
    })
  }

  // --------------------------------------------------------------------------
  // Índice增量Actualizar（供外部调用）
  // --------------------------------------------------------------------------

  /**
   * 添加 API Key 到所有Índice（Crear API Key 时调用）
   * @param {string} keyId - API Key ID
   */
  async addKeyToIndexes(keyId) {
    const client = redis.getClient()
    if (!client) {
      return
    }

    try {
      const pipeline = client.pipeline()

      // 将新 Key 添加到所有Índice，初始分数为 0
      for (const timeRange of VALID_TIME_RANGES) {
        pipeline.zadd(RedisKeys.rankKey(timeRange), 0, keyId)
      }

      await pipeline.exec()
      logger.debug(`Added key ${keyId} to cost rank indexes`)
    } catch (error) {
      logger.error(`Failed to add key ${keyId} to cost rank indexes:`, error)
    }
  }

  /**
   * 从所有Índice中Eliminación API Key（Eliminar API Key 时调用）
   * @param {string} keyId - API Key ID
   */
  async removeKeyFromIndexes(keyId) {
    const client = redis.getClient()
    if (!client) {
      return
    }

    try {
      const pipeline = client.pipeline()

      // 从所有Índice中Eliminación
      for (const timeRange of VALID_TIME_RANGES) {
        pipeline.zrem(RedisKeys.rankKey(timeRange), keyId)
      }

      await pipeline.exec()
      logger.debug(`Removed key ${keyId} from cost rank indexes`)
    } catch (error) {
      logger.error(`Failed to remove key ${keyId} from cost rank indexes:`, error)
    }
  }

  // --------------------------------------------------------------------------
  // ConsultaInterfaz
  // --------------------------------------------------------------------------

  /**
   * ObtenerOrdenar后的 keyId ColumnaTabla
   * @param {string} timeRange - Tiempo范围
   * @param {string} sortOrder - Ordenar方向 'asc' | 'desc'
   * @param {number} offset - 偏移量
   * @param {number} limit - Límite数量，-1 Tabla示全部
   * @returns {Promise<string[]>} keyId ColumnaTabla
   */
  async getSortedKeyIds(timeRange, sortOrder = 'desc', offset = 0, limit = -1) {
    const client = redis.getClient()
    if (!client) {
      throw new Error('Redis client not available')
    }

    const rankKey = RedisKeys.rankKey(timeRange)
    const end = limit === -1 ? -1 : offset + limit - 1

    if (sortOrder === 'desc') {
      return await client.zrevrange(rankKey, offset, end)
    } else {
      return await client.zrange(rankKey, offset, end)
    }
  }

  /**
   * Obtener Key 的费用分数
   * @param {string} timeRange - Tiempo范围
   * @param {string} keyId - API Key ID
   * @returns {Promise<number>} 费用
   */
  async getKeyCost(timeRange, keyId) {
    const client = redis.getClient()
    if (!client) {
      return 0
    }

    const score = await client.zscore(RedisKeys.rankKey(timeRange), keyId)
    return score ? parseFloat(score) : 0
  }

  /**
   * 批量Obtener多个 Key 的费用分数
   * @param {string} timeRange - Tiempo范围
   * @param {string[]} keyIds - API Key ID ColumnaTabla
   * @returns {Promise<Map<string, number>>} keyId -> cost
   */
  async getBatchKeyCosts(timeRange, keyIds) {
    const client = redis.getClient()
    if (!client || keyIds.length === 0) {
      return new Map()
    }

    const rankKey = RedisKeys.rankKey(timeRange)
    const costs = new Map()

    const pipeline = client.pipeline()
    keyIds.forEach((keyId) => {
      pipeline.zscore(rankKey, keyId)
    })
    const results = await pipeline.exec()

    keyIds.forEach((keyId, index) => {
      const [err, score] = results[index]
      costs.set(keyId, err || !score ? 0 : parseFloat(score))
    })

    return costs
  }

  /**
   * Obtener所有OrdenarÍndice的状态
   * @returns {Promise<Object>} 各Tiempo范围的状态
   */
  async getRankStatus() {
    const client = redis.getClient()
    if (!client) {
      return {}
    }

    // 使用 Pipeline 批量Obtener
    const pipeline = client.pipeline()
    for (const timeRange of VALID_TIME_RANGES) {
      pipeline.hgetall(RedisKeys.metaKey(timeRange))
    }
    const results = await pipeline.exec()

    const status = {}
    VALID_TIME_RANGES.forEach((timeRange, i) => {
      const [err, meta] = results[i]
      if (err || !meta) {
        status[timeRange] = {
          lastUpdate: null,
          keyCount: 0,
          status: 'unknown',
          updateDuration: 0
        }
      } else {
        status[timeRange] = {
          lastUpdate: meta.lastUpdate || null,
          keyCount: parseInt(meta.keyCount || 0),
          status: meta.status || 'unknown',
          updateDuration: parseInt(meta.updateDuration || 0)
        }
      }
    })

    return status
  }

  /**
   * 强制刷新指定Tiempo范围的Índice
   * @param {string} timeRange - Tiempo范围，不传则刷新全部
   */
  async forceRefresh(timeRange = null) {
    if (timeRange) {
      await this.updateRank(timeRange)
    } else {
      await this.updateAllRanks()
    }
  }

  // --------------------------------------------------------------------------
  // Custom Tiempo范围实时Calcular
  // --------------------------------------------------------------------------

  /**
   * Calcular custom Tiempo范围的费用（实时Calcular，Excluir已Eliminar的 Key）
   * @param {string} startDate - IniciandoFecha YYYY-MM-DD
   * @param {string} endDate - 结束Fecha YYYY-MM-DD
   * @returns {Promise<Map<string, number>>} keyId -> cost
   */
  async calculateCustomRangeCosts(startDate, endDate) {
    const client = redis.getClient()
    if (!client) {
      throw new Error('Redis client not available')
    }

    logger.info(`📊 Calculating custom range costs: ${startDate} to ${endDate}`)
    const startTime = Date.now()

    // 1. Obtener所有未Eliminar的 API Key IDs
    const keyIds = await this._getActiveApiKeyIds()

    if (keyIds.length === 0) {
      return new Map()
    }

    // 2. 分批Calcular费用
    const costs = await this._calculateCostsInBatches(keyIds, { startDate, endDate })

    const duration = Date.now() - startTime
    logger.info(`📊 Custom range costs calculated: ${keyIds.length} keys in ${duration}ms`)

    return costs
  }

  // --------------------------------------------------------------------------
  // 私有辅助Método
  // --------------------------------------------------------------------------

  /**
   * Obtener所有未Eliminar的 API Key IDs
   * @private
   * @returns {Promise<string[]>}
   */
  async _getActiveApiKeyIds() {
    // 使用现有的 scanApiKeyIds Obtener所有 ID
    const allKeyIds = await redis.scanApiKeyIds()

    if (allKeyIds.length === 0) {
      return []
    }

    // 批量Obtener API Key Datos，Filtrar已Eliminar的
    const allKeys = await redis.batchGetApiKeys(allKeyIds)

    return allKeys.filter((k) => !k.isDeleted).map((k) => k.id)
  }

  /**
   * 分批Calcular费用
   * @private
   */
  async _calculateCostsInBatches(keyIds, dateRange) {
    const costs = new Map()

    for (let i = 0; i < keyIds.length; i += BATCH_SIZE) {
      const batch = keyIds.slice(i, i + BATCH_SIZE)
      const batchCosts = await this._calculateBatchCosts(batch, dateRange)
      batchCosts.forEach((cost, keyId) => costs.set(keyId, cost))
    }

    return costs
  }

  /**
   * 批量Calcular费用
   * @private
   */
  async _calculateBatchCosts(keyIds, dateRange) {
    const client = redis.getClient()
    const costs = new Map()

    if (dateRange.useTotal) {
      // 'all' Tiempo范围：直接Leer total cost
      const pipeline = client.pipeline()
      keyIds.forEach((keyId) => {
        pipeline.get(RedisKeys.totalCost(keyId))
      })
      const results = await pipeline.exec()

      keyIds.forEach((keyId, index) => {
        const [err, value] = results[index]
        costs.set(keyId, err ? 0 : parseFloat(value || 0))
      })
    } else {
      // 特定Fecha范围：汇总每日费用
      const dates = this._getDatesBetween(dateRange.startDate, dateRange.endDate)

      const pipeline = client.pipeline()
      keyIds.forEach((keyId) => {
        dates.forEach((date) => {
          pipeline.get(RedisKeys.dailyCost(keyId, date))
        })
      })
      const results = await pipeline.exec()

      let resultIndex = 0
      keyIds.forEach((keyId) => {
        let totalCost = 0
        dates.forEach(() => {
          const [err, value] = results[resultIndex++]
          if (!err && value) {
            totalCost += parseFloat(value)
          }
        })
        costs.set(keyId, totalCost)
      })
    }

    return costs
  }

  /**
   * ObtenerFecha范围Configuración
   * @private
   */
  _getDateRange(timeRange) {
    const now = new Date()
    const today = redis.getDateStringInTimezone(now)

    switch (timeRange) {
      case 'today':
        return { startDate: today, endDate: today }
      case '7days': {
        const d7 = new Date(now)
        d7.setDate(d7.getDate() - 6)
        return { startDate: redis.getDateStringInTimezone(d7), endDate: today }
      }
      case '30days': {
        const d30 = new Date(now)
        d30.setDate(d30.getDate() - 29)
        return { startDate: redis.getDateStringInTimezone(d30), endDate: today }
      }
      case 'all':
        return { useTotal: true }
      default:
        throw new Error(`Invalid time range: ${timeRange}`)
    }
  }

  /**
   * Obtener两个Fecha之间的所有Fecha
   * @private
   */
  _getDatesBetween(startDate, endDate) {
    const dates = []
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      dates.push(
        `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
      )
      current.setDate(current.getDate() + 1)
    }

    return dates
  }
}

module.exports = new CostRankService()
