const Redis = require('ioredis')
const config = require('../../config/config')
const logger = require('../utils/logger')

// Zona horaria辅助Función
// 注意：这个Función的目的是Obtener某个Tiempo点在目标Zona horaria的"本地"Tabla示
// 例如：UTCTiempo 2025-07-30 01:00:00 在 UTC+8 Zona horariaTabla示为 2025-07-30 09:00:00
function getDateInTimezone(date = new Date()) {
  const offset = config.system.timezoneOffset || 8 // PredeterminadoUTC+8

  // Método：Crear一个偏移后的DateObjeto，使其getUTCXXXMétodoRetornar目标Zona horaria的Valor
  // 这样我们可以用getUTCFullYear()等MétodoObtener目标Zona horaria的年月日时分秒
  const offsetMs = offset * 3600000 // Zona horaria偏移的毫秒数
  const adjustedTime = new Date(date.getTime() + offsetMs)

  return adjustedTime
}

// ObtenerConfiguraciónZona horaria的FechaCadena (YYYY-MM-DD)
function getDateStringInTimezone(date = new Date()) {
  const tzDate = getDateInTimezone(date)
  // 使用UTCMétodoObtener偏移后的Fecha部分
  return `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(2, '0')}-${String(
    tzDate.getUTCDate()
  ).padStart(2, '0')}`
}

// ObtenerConfiguraciónZona horaria的小时 (0-23)
function getHourInTimezone(date = new Date()) {
  const tzDate = getDateInTimezone(date)
  return tzDate.getUTCHours()
}

// ObtenerConfiguraciónZona horaria的 ISO 周（YYYY-Wxx Formato，周一到周日）
function getWeekStringInTimezone(date = new Date()) {
  const tzDate = getDateInTimezone(date)

  // Obtener年份
  const year = tzDate.getUTCFullYear()

  // Calcular ISO 周数（周一为第一天）
  const dateObj = new Date(tzDate)
  const dayOfWeek = dateObj.getUTCDay() || 7 // 将周日(0)Convertir为7
  const firstThursday = new Date(dateObj)
  firstThursday.setUTCDate(dateObj.getUTCDate() + 4 - dayOfWeek) // 找到这周的周四

  const yearStart = new Date(firstThursday.getUTCFullYear(), 0, 1)
  const weekNumber = Math.ceil(((firstThursday - yearStart) / 86400000 + 1) / 7)

  return `${year}-W${String(weekNumber).padStart(2, '0')}`
}

// ConcurrenciaCola相关常量
const QUEUE_STATS_TTL_SECONDS = 86400 * 7 // Estadística计数保留 7 天
const WAIT_TIME_TTL_SECONDS = 86400 // 等待Tiempo样本保留 1 天（滚动窗口，无需长期保留）
// 等待Tiempo样本数Configuración（提高Estadística置信度）
// - 每 API Key 从 100 提高到 500：提供更稳定的 P99 估计
// - 全局从 500 提高到 2000：Soportar更高精度的 P99.9 Analizar
// - 内存开销约 12-20KB（Redis quicklist 每元素 1-10 字节），可接受
// 详见 design.md Decision 5: 等待TiempoEstadística样本数
const WAIT_TIME_SAMPLES_PER_KEY = 500 // 每个 API Key 保留的等待Tiempo样本数
const WAIT_TIME_SAMPLES_GLOBAL = 2000 // 全局保留的等待Tiempo样本数
const QUEUE_TTL_BUFFER_SECONDS = 30 // 排队计数器TTL缓冲Tiempo

class RedisClient {
  constructor() {
    this.client = null
    this.isConnected = false
  }

  async connect() {
    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        retryDelayOnFailover: config.redis.retryDelayOnFailover,
        maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
        lazyConnect: config.redis.lazyConnect,
        tls: config.redis.enableTLS ? {} : false
      })

      this.client.on('connect', () => {
        this.isConnected = true
        logger.info('🔗 Redis connected successfully')
      })

      this.client.on('error', (err) => {
        this.isConnected = false
        logger.error('❌ Redis connection error:', err)
      })

      this.client.on('close', () => {
        this.isConnected = false
        logger.warn('⚠️  Redis connection closed')
      })

      // 只有在 lazyConnect 模式下才需要手动调用 connect()
      // 如果 Redis 已经Conexión或En progresoConexión中，则跳过
      if (
        this.client.status !== 'connecting' &&
        this.client.status !== 'connect' &&
        this.client.status !== 'ready'
      ) {
        await this.client.connect()
      } else {
        // 等待 ready 状态
        await new Promise((resolve, reject) => {
          if (this.client.status === 'ready') {
            resolve()
          } else {
            this.client.once('ready', resolve)
            this.client.once('error', reject)
          }
        })
      }
      return this.client
    } catch (error) {
      logger.error('💥 Failed to connect to Redis:', error)
      throw error
    }
  }

  // 🔄 自动Migración usage Índice（启动时调用）
  async migrateUsageIndex() {
    const migrationKey = 'system:migration:usage_index_v2' // v2: 添加 keymodel Migración
    const migrated = await this.client.get(migrationKey)
    if (migrated) {
      logger.debug('📊 Usage index migration already completed')
      return
    }

    logger.info('📊 Starting usage index migration...')
    const stats = { daily: 0, hourly: 0, modelDaily: 0, modelHourly: 0 }

    try {
      // Migración usage:daily
      let cursor = '0'
      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          'usage:daily:*',
          'COUNT',
          500
        )
        cursor = newCursor
        const pipeline = this.client.pipeline()
        for (const key of keys) {
          const match = key.match(/^usage:daily:([^:]+):(\d{4}-\d{2}-\d{2})$/)
          if (match) {
            pipeline.sadd(`usage:daily:index:${match[2]}`, match[1])
            pipeline.expire(`usage:daily:index:${match[2]}`, 86400 * 32)
            stats.daily++
          }
        }
        if (keys.length > 0) {
          await pipeline.exec()
        }
      } while (cursor !== '0')

      // Migración usage:hourly
      cursor = '0'
      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          'usage:hourly:*',
          'COUNT',
          500
        )
        cursor = newCursor
        const pipeline = this.client.pipeline()
        for (const key of keys) {
          const match = key.match(/^usage:hourly:([^:]+):(\d{4}-\d{2}-\d{2}:\d{2})$/)
          if (match) {
            pipeline.sadd(`usage:hourly:index:${match[2]}`, match[1])
            pipeline.expire(`usage:hourly:index:${match[2]}`, 86400 * 7)
            stats.hourly++
          }
        }
        if (keys.length > 0) {
          await pipeline.exec()
        }
      } while (cursor !== '0')

      // Migración usage:model:daily
      cursor = '0'
      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          'usage:model:daily:*',
          'COUNT',
          500
        )
        cursor = newCursor
        const pipeline = this.client.pipeline()
        for (const key of keys) {
          const match = key.match(/^usage:model:daily:([^:]+):(\d{4}-\d{2}-\d{2})$/)
          if (match) {
            pipeline.sadd(`usage:model:daily:index:${match[2]}`, match[1])
            pipeline.expire(`usage:model:daily:index:${match[2]}`, 86400 * 32)
            stats.modelDaily++
          }
        }
        if (keys.length > 0) {
          await pipeline.exec()
        }
      } while (cursor !== '0')

      // Migración usage:model:hourly
      cursor = '0'
      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          'usage:model:hourly:*',
          'COUNT',
          500
        )
        cursor = newCursor
        const pipeline = this.client.pipeline()
        for (const key of keys) {
          const match = key.match(/^usage:model:hourly:([^:]+):(\d{4}-\d{2}-\d{2}:\d{2})$/)
          if (match) {
            pipeline.sadd(`usage:model:hourly:index:${match[2]}`, match[1])
            pipeline.expire(`usage:model:hourly:index:${match[2]}`, 86400 * 7)
            stats.modelHourly++
          }
        }
        if (keys.length > 0) {
          await pipeline.exec()
        }
      } while (cursor !== '0')

      // Migración usage:keymodel:daily (usage:{keyId}:model:daily:{model}:{date})
      cursor = '0'
      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          'usage:*:model:daily:*',
          'COUNT',
          500
        )
        cursor = newCursor
        const pipeline = this.client.pipeline()
        for (const key of keys) {
          // usage:{keyId}:model:daily:{model}:{date}
          const match = key.match(/^usage:([^:]+):model:daily:(.+):(\d{4}-\d{2}-\d{2})$/)
          if (match) {
            const [, keyId, model, date] = match
            pipeline.sadd(`usage:keymodel:daily:index:${date}`, `${keyId}:${model}`)
            pipeline.expire(`usage:keymodel:daily:index:${date}`, 86400 * 32)
            stats.keymodelDaily = (stats.keymodelDaily || 0) + 1
          }
        }
        if (keys.length > 0) {
          await pipeline.exec()
        }
      } while (cursor !== '0')

      // Migración usage:keymodel:hourly (usage:{keyId}:model:hourly:{model}:{hour})
      cursor = '0'
      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          'usage:*:model:hourly:*',
          'COUNT',
          500
        )
        cursor = newCursor
        const pipeline = this.client.pipeline()
        for (const key of keys) {
          // usage:{keyId}:model:hourly:{model}:{hour}
          const match = key.match(/^usage:([^:]+):model:hourly:(.+):(\d{4}-\d{2}-\d{2}:\d{2})$/)
          if (match) {
            const [, keyId, model, hour] = match
            pipeline.sadd(`usage:keymodel:hourly:index:${hour}`, `${keyId}:${model}`)
            pipeline.expire(`usage:keymodel:hourly:index:${hour}`, 86400 * 7)
            stats.keymodelHourly = (stats.keymodelHourly || 0) + 1
          }
        }
        if (keys.length > 0) {
          await pipeline.exec()
        }
      } while (cursor !== '0')

      // 标记MigraciónCompletado
      await this.client.set(migrationKey, Date.now().toString())
      logger.info(
        `📊 Usage index migration completed: daily=${stats.daily}, hourly=${stats.hourly}, modelDaily=${stats.modelDaily}, modelHourly=${stats.modelHourly}, keymodelDaily=${stats.keymodelDaily || 0}, keymodelHourly=${stats.keymodelHourly || 0}`
      )
    } catch (error) {
      logger.error('📊 Usage index migration failed:', error)
    }
  }

  // 🔄 自动Migración alltime 模型Estadística（启动时调用）
  async migrateAlltimeModelStats() {
    const migrationKey = 'system:migration:alltime_model_stats_v1'
    const migrated = await this.client.get(migrationKey)
    if (migrated) {
      logger.debug('📊 Alltime model stats migration already completed')
      return
    }

    logger.info('📊 Starting alltime model stats migration...')
    const stats = { keys: 0, models: 0 }

    try {
      // 扫描所有月度模型EstadísticaDatos并聚合到 alltime
      // Formato: usage:{keyId}:model:monthly:{model}:{month}
      let cursor = '0'
      const aggregatedData = new Map() // keyId:model -> {inputTokens, outputTokens, ...}

      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          'usage:*:model:monthly:*:*',
          'COUNT',
          500
        )
        cursor = newCursor

        for (const key of keys) {
          // usage:{keyId}:model:monthly:{model}:{month}
          const match = key.match(/^usage:([^:]+):model:monthly:(.+):(\d{4}-\d{2})$/)
          if (match) {
            const [, keyId, model] = match
            const aggregateKey = `${keyId}:${model}`

            // Obtener该月的Datos
            const data = await this.client.hgetall(key)
            if (data && Object.keys(data).length > 0) {
              if (!aggregatedData.has(aggregateKey)) {
                aggregatedData.set(aggregateKey, {
                  keyId,
                  model,
                  inputTokens: 0,
                  outputTokens: 0,
                  cacheCreateTokens: 0,
                  cacheReadTokens: 0,
                  requests: 0
                })
              }

              const agg = aggregatedData.get(aggregateKey)
              agg.inputTokens += parseInt(data.inputTokens) || 0
              agg.outputTokens += parseInt(data.outputTokens) || 0
              agg.cacheCreateTokens += parseInt(data.cacheCreateTokens) || 0
              agg.cacheReadTokens += parseInt(data.cacheReadTokens) || 0
              agg.requests += parseInt(data.requests) || 0
              stats.keys++
            }
          }
        }
      } while (cursor !== '0')

      // Escribir聚合后的 alltime Datos
      const pipeline = this.client.pipeline()
      for (const [, agg] of aggregatedData) {
        const alltimeKey = `usage:${agg.keyId}:model:alltime:${agg.model}`
        pipeline.hset(alltimeKey, {
          inputTokens: agg.inputTokens.toString(),
          outputTokens: agg.outputTokens.toString(),
          cacheCreateTokens: agg.cacheCreateTokens.toString(),
          cacheReadTokens: agg.cacheReadTokens.toString(),
          requests: agg.requests.toString()
        })
        stats.models++
      }

      if (stats.models > 0) {
        await pipeline.exec()
      }

      // 标记MigraciónCompletado
      await this.client.set(migrationKey, Date.now().toString())
      logger.info(
        `📊 Alltime model stats migration completed: scanned ${stats.keys} monthly keys, created ${stats.models} alltime keys`
      )
    } catch (error) {
      logger.error('📊 Alltime model stats migration failed:', error)
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit()
      this.isConnected = false
      logger.info('👋 Redis disconnected')
    }
  }

  getClient() {
    if (!this.client || !this.isConnected) {
      logger.warn('⚠️ Redis client is not connected')
      return null
    }
    return this.client
  }

  // SeguridadObtenerCliente（用于关键Operación）
  getClientSafe() {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected')
    }
    return this.client
  }

  // 🔑 API Key 相关Operación
  async setApiKey(keyId, keyData, hashedKey = null) {
    const key = `apikey:${keyId}`
    const client = this.getClientSafe()

    // 维护哈希映射Tabla（用于快速查找）
    // hashedKeyParámetro是实际的哈希Valor，用于建立映射
    if (hashedKey) {
      await client.hset('apikey:hash_map', hashedKey, keyId)
    }

    await client.hset(key, keyData)
    await client.expire(key, 86400 * 365) // 1年过期
  }

  async getApiKey(keyId) {
    const key = `apikey:${keyId}`
    return await this.client.hgetall(key)
  }

  async deleteApiKey(keyId) {
    const key = `apikey:${keyId}`

    // Obtener要Eliminar的API Key哈希Valor，以便从映射Tabla中Eliminación
    const keyData = await this.client.hgetall(key)
    if (keyData && keyData.apiKey) {
      // keyData.apiKey现在存储的是哈希Valor，直接从映射TablaEliminar
      await this.client.hdel('apikey:hash_map', keyData.apiKey)
    }

    return await this.client.del(key)
  }

  async getAllApiKeys() {
    const keys = await this.scanKeys('apikey:*')
    const apiKeys = []
    const dataList = await this.batchHgetallChunked(keys)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // Filtrar掉hash_map，它不是真正的API Key
      if (key === 'apikey:hash_map') {
        continue
      }

      const keyData = dataList[i]
      if (keyData && Object.keys(keyData).length > 0) {
        apiKeys.push({ id: key.replace('apikey:', ''), ...keyData })
      }
    }
    return apiKeys
  }

  /**
   * 使用 SCAN Obtener所有 API Key ID（避免 KEYS 命令Bloqueante）
   * @returns {Promise<string[]>} API Key ID ColumnaTabla（已去重）
   */
  async scanApiKeyIds() {
    const keyIds = new Set()
    let cursor = '0'
    // ExcluirÍndice key 的前缀
    const excludePrefixes = [
      'apikey:hash_map',
      'apikey:idx:',
      'apikey:set:',
      'apikey:tags:',
      'apikey:index:'
    ]

    do {
      const [newCursor, keys] = await this.client.scan(cursor, 'MATCH', 'apikey:*', 'COUNT', 100)
      cursor = newCursor

      for (const key of keys) {
        // 只接受 apikey:<uuid> 形态，ExcluirÍndice key
        if (excludePrefixes.some((prefix) => key.startsWith(prefix))) {
          continue
        }
        // 确保是 apikey:<id> Formato（只有一个冒号）
        if (key.split(':').length !== 2) {
          continue
        }
        keyIds.add(key.replace('apikey:', ''))
      }
    } while (cursor !== '0')

    return [...keyIds]
  }

  // 添加标签到全局标签集合
  async addTag(tagName) {
    await this.client.sadd('apikey:tags:all', tagName)
  }

  // 从全局标签集合Eliminar标签
  async removeTag(tagName) {
    await this.client.srem('apikey:tags:all', tagName)
  }

  // Obtener全局标签集合
  async getGlobalTags() {
    return await this.client.smembers('apikey:tags:all')
  }

  /**
   * 使用ÍndiceObtener所有 API Key 的标签（OptimizaciónVersión）
   * 优先级：Índice就绪时用 apikey:tags:all > apikey:idx:all + pipeline > SCAN
   * @returns {Promise<string[]>} 去重Ordenar后的标签ColumnaTabla
   */
  async scanAllApiKeyTags() {
    // VerificarÍndice是否就绪（非重建中且Versión号正确）
    const isIndexReady = await this._checkIndexReady()

    if (isIndexReady) {
      // 方案1：直接LeerÍndiceServicio维护的标签集合
      const cachedTags = await this.client.smembers('apikey:tags:all')
      if (cachedTags && cachedTags.length > 0) {
        // 保持 trim 一致性
        return cachedTags
          .map((t) => (t ? t.trim() : ''))
          .filter((t) => t)
          .sort()
      }

      // 方案2：使用Índice的 key ID ColumnaTabla + pipeline
      const indexedKeyIds = await this.client.smembers('apikey:idx:all')
      if (indexedKeyIds && indexedKeyIds.length > 0) {
        return this._extractTagsFromKeyIds(indexedKeyIds)
      }
    }

    // 方案3：Retirada到 SCAN（Índice未就绪或重建中）
    return this._scanTagsFallback()
  }

  /**
   * VerificarÍndice是否就绪
   */
  async _checkIndexReady() {
    try {
      const version = await this.client.get('apikey:index:version')
      // Versión号 >= 2 Tabla示Índice就绪
      return parseInt(version) >= 2
    } catch {
      return false
    }
  }

  async _extractTagsFromKeyIds(keyIds) {
    const tagSet = new Set()
    const pipeline = this.client.pipeline()
    for (const keyId of keyIds) {
      pipeline.hmget(`apikey:${keyId}`, 'tags', 'isDeleted')
    }

    const results = await pipeline.exec()
    if (!results) {
      return []
    }

    for (const result of results) {
      if (!result) {
        continue
      }
      const [err, values] = result
      if (err || !values) {
        continue
      }
      const [tags, isDeleted] = values
      if (isDeleted === 'true' || !tags) {
        continue
      }

      try {
        const parsed = JSON.parse(tags)
        if (Array.isArray(parsed)) {
          for (const tag of parsed) {
            if (tag && typeof tag === 'string' && tag.trim()) {
              tagSet.add(tag.trim())
            }
          }
        }
      } catch {
        // 忽略AnalizarError
      }
    }
    return Array.from(tagSet).sort()
  }

  async _scanTagsFallback() {
    const tagSet = new Set()
    let cursor = '0'

    do {
      const [newCursor, keys] = await this.client.scan(cursor, 'MATCH', 'apikey:*', 'COUNT', 100)
      cursor = newCursor

      const validKeys = keys.filter((k) => k !== 'apikey:hash_map' && k.split(':').length === 2)
      if (validKeys.length === 0) {
        continue
      }

      const pipeline = this.client.pipeline()
      for (const key of validKeys) {
        pipeline.hmget(key, 'tags', 'isDeleted')
      }

      const results = await pipeline.exec()
      if (!results) {
        continue
      }

      for (const result of results) {
        if (!result) {
          continue
        }
        const [err, values] = result
        if (err || !values) {
          continue
        }
        const [tags, isDeleted] = values
        if (isDeleted === 'true' || !tags) {
          continue
        }

        try {
          const parsed = JSON.parse(tags)
          if (Array.isArray(parsed)) {
            for (const tag of parsed) {
              if (tag && typeof tag === 'string' && tag.trim()) {
                tagSet.add(tag.trim())
              }
            }
          }
        } catch {
          // 忽略AnalizarError
        }
      }
    } while (cursor !== '0')

    return Array.from(tagSet).sort()
  }

  /**
   * 批量Obtener API Key Datos（使用 Pipeline Optimización）
   * @param {string[]} keyIds - API Key ID ColumnaTabla
   * @returns {Promise<Object[]>} API Key DatosColumnaTabla
   */
  async batchGetApiKeys(keyIds) {
    if (!keyIds || keyIds.length === 0) {
      return []
    }

    const pipeline = this.client.pipeline()
    for (const keyId of keyIds) {
      pipeline.hgetall(`apikey:${keyId}`)
    }

    const results = await pipeline.exec()
    const apiKeys = []

    for (let i = 0; i < results.length; i++) {
      const [err, data] = results[i]
      if (!err && data && Object.keys(data).length > 0) {
        apiKeys.push({ id: keyIds[i], ...this._parseApiKeyData(data) })
      }
    }

    return apiKeys
  }

  /**
   * Analizar API Key Datos，将CadenaConvertir为正确的Tipo
   * @param {Object} data - 原始Datos
   * @returns {Object} Analizar后的Datos
   */
  _parseApiKeyData(data) {
    if (!data) {
      return data
    }

    const parsed = { ...data }

    if (parsed.modelMapping && typeof parsed.modelMapping === 'string') {
      try {
        parsed.modelMapping = JSON.parse(parsed.modelMapping)
      } catch (e) {
        parsed.modelMapping = {}
      }
    }

    // 布尔Campo
    const boolFields = ['isActive', 'enableModelRestriction', 'isDeleted']
    for (const field of boolFields) {
      if (parsed[field] !== undefined) {
        parsed[field] = parsed[field] === 'true'
      }
    }

    // NúmeroCampo
    const numFields = [
      'tokenLimit',
      'dailyCostLimit',
      'totalCostLimit',
      'rateLimitRequests',
      'rateLimitTokens',
      'rateLimitWindow',
      'rateLimitCost',
      'maxConcurrency',
      'activationDuration'
    ]
    for (const field of numFields) {
      if (parsed[field] !== undefined && parsed[field] !== '') {
        parsed[field] = parseFloat(parsed[field]) || 0
      }
    }

    // ArregloCampo（JSON Analizar）
    const arrayFields = ['tags', 'restrictedModels', 'allowedClients']
    for (const field of arrayFields) {
      if (parsed[field]) {
        try {
          parsed[field] = JSON.parse(parsed[field])
        } catch (e) {
          parsed[field] = []
        }
      }
    }

    // ObjetoCampo（JSON Analizar）
    const objectFields = ['serviceRates']
    for (const field of objectFields) {
      if (parsed[field]) {
        try {
          parsed[field] = JSON.parse(parsed[field])
        } catch (e) {
          parsed[field] = {}
        }
      }
    }

    return parsed
  }

  /**
   * Obtener API Keys 分页Datos（不含费用，用于OptimizaciónColumnaTabla加载）
   * @param {Object} options - 分页和筛选选项
   * @returns {Promise<{items: Object[], pagination: Object, availableTags: string[]}>}
   */
  async getApiKeysPaginated(options = {}) {
    const {
      page = 1,
      pageSize = 20,
      searchMode = 'apiKey',
      search = '',
      tag = '',
      isActive = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      excludeDeleted = true, // PredeterminadoExcluir已Eliminar的 API Keys
      modelFilter = []
    } = options

    // 尝试使用ÍndiceConsulta（RendimientoOptimización）
    const apiKeyIndexService = require('../services/apiKeyIndexService')
    const indexReady = await apiKeyIndexService.isIndexReady()

    // ÍndiceRutaSoportar的Condición：
    // - 无模型筛选（需要Consulta使用Registro）
    // - 非 bindingAccount 搜索模式（Índice不Soportar）
    // - 非 status/expiresAt Ordenar（Índice不Soportar）
    // - 无搜索关键词（Índice只搜 name，旧逻辑搜 name+owner，不一致）
    const canUseIndex =
      indexReady &&
      modelFilter.length === 0 &&
      searchMode !== 'bindingAccount' &&
      !['status', 'expiresAt'].includes(sortBy) &&
      !search

    if (canUseIndex) {
      // 使用ÍndiceConsulta
      try {
        return await apiKeyIndexService.queryWithIndex({
          page,
          pageSize,
          sortBy,
          sortOrder,
          isActive: isActive === '' ? undefined : isActive === 'true' || isActive === true,
          tag,
          excludeDeleted
        })
      } catch (error) {
        logger.warn('⚠️ ÍndiceConsultaFalló，Degradación到全量扫描:', error.message)
      }
    }

    // Degradación：使用 SCAN Obtener所有 apikey:* 的 ID ColumnaTabla（避免Bloqueante）
    const keyIds = await this.scanApiKeyIds()

    // 2. 使用 Pipeline 批量Obtener基础Datos
    const apiKeys = await this.batchGetApiKeys(keyIds)

    // 3. 应用筛选Condición
    let filteredKeys = apiKeys

    // Excluir已Eliminar的 API Keys（PredeterminadoFila为）
    if (excludeDeleted) {
      filteredKeys = filteredKeys.filter((k) => !k.isDeleted)
    }

    // 状态筛选
    if (isActive !== '' && isActive !== undefined && isActive !== null) {
      const activeValue = isActive === 'true' || isActive === true
      filteredKeys = filteredKeys.filter((k) => k.isActive === activeValue)
    }

    // 标签筛选
    if (tag) {
      filteredKeys = filteredKeys.filter((k) => {
        const tags = Array.isArray(k.tags) ? k.tags : []
        return tags.includes(tag)
      })
    }

    // 搜索
    if (search) {
      const lowerSearch = search.toLowerCase().trim()
      if (searchMode === 'apiKey') {
        // apiKey 模式：搜索Nombre和拥有者
        filteredKeys = filteredKeys.filter(
          (k) =>
            (k.name && k.name.toLowerCase().includes(lowerSearch)) ||
            (k.ownerDisplayName && k.ownerDisplayName.toLowerCase().includes(lowerSearch))
        )
      } else if (searchMode === 'bindingAccount') {
        // bindingAccount 模式：直接在Redis层Procesar，避免Ruta层加载10000条
        const accountNameCacheService = require('../services/accountNameCacheService')
        filteredKeys = accountNameCacheService.searchByBindingAccount(filteredKeys, lowerSearch)
      }
    }

    // 模型筛选
    if (modelFilter.length > 0) {
      const keyIdsWithModels = await this.getKeyIdsWithModels(
        filteredKeys.map((k) => k.id),
        modelFilter
      )
      filteredKeys = filteredKeys.filter((k) => keyIdsWithModels.has(k.id))
    }

    // 4. Ordenar
    filteredKeys.sort((a, b) => {
      // status Ordenar实际上使用 isActive Campo（API Key 没有 status Campo）
      const effectiveSortBy = sortBy === 'status' ? 'isActive' : sortBy
      let aVal = a[effectiveSortBy]
      let bVal = b[effectiveSortBy]

      // FechaCampo转Tiempo戳
      if (['createdAt', 'expiresAt', 'lastUsedAt'].includes(effectiveSortBy)) {
        aVal = aVal ? new Date(aVal).getTime() : 0
        bVal = bVal ? new Date(bVal).getTime() : 0
      }

      // 布尔Campo转Número
      if (effectiveSortBy === 'isActive') {
        aVal = aVal ? 1 : 0
        bVal = bVal ? 1 : 0
      }

      // CadenaCampo
      if (sortBy === 'name') {
        aVal = (aVal || '').toLowerCase()
        bVal = (bVal || '').toLowerCase()
      }

      if (aVal < bVal) {
        return sortOrder === 'asc' ? -1 : 1
      }
      if (aVal > bVal) {
        return sortOrder === 'asc' ? 1 : -1
      }
      return 0
    })

    // 5. 收集所有可用标签（在分页之前）
    const allTags = new Set()
    for (const key of apiKeys) {
      const tags = Array.isArray(key.tags) ? key.tags : []
      tags.forEach((t) => allTags.add(t))
    }
    const availableTags = [...allTags].sort()

    // 6. 分页
    const total = filteredKeys.length
    const totalPages = Math.ceil(total / pageSize) || 1
    const validPage = Math.min(Math.max(1, page), totalPages)
    const start = (validPage - 1) * pageSize
    const items = filteredKeys.slice(start, start + pageSize)

    return {
      items,
      pagination: {
        page: validPage,
        pageSize,
        total,
        totalPages
      },
      availableTags
    }
  }

  // 🔍 通过哈希Valor查找API Key（RendimientoOptimización）
  async findApiKeyByHash(hashedKey) {
    // 使用反向映射Tabla：hash -> keyId
    let keyId = await this.client.hget('apikey:hash_map', hashedKey)

    // Retirada：查旧结构 apikey_hash:*（启动回填未Completado时兼容）
    if (!keyId) {
      const oldData = await this.client.hgetall(`apikey_hash:${hashedKey}`)
      if (oldData && oldData.id) {
        keyId = oldData.id
        // 回填到 hash_map
        await this.client.hset('apikey:hash_map', hashedKey, keyId)
      }
    }

    if (!keyId) {
      return null
    }

    const keyData = await this.client.hgetall(`apikey:${keyId}`)
    if (keyData && Object.keys(keyData).length > 0) {
      return { id: keyId, ...keyData }
    }

    // 如果Datos不存在，Limpiar映射Tabla
    await this.client.hdel('apikey:hash_map', hashedKey)
    return null
  }

  // 📊 使用Estadística相关Operación（SoportarCachétokenEstadística和模型Información）
  // 标准化模型Nombre，用于Estadística聚合
  _normalizeModelName(model) {
    if (!model || model === 'unknown') {
      return model
    }

    // 对于Bedrock模型，去掉区域前缀进Fila统一
    if (model.includes('.anthropic.') || model.includes('.claude')) {
      // 匹配所有AWS区域Formato：region.anthropic.model-name-v1:0 -> claude-model-name
      // Soportar所有AWS区域Formato，如：us-east-1, eu-west-1, ap-southeast-1, ca-central-1等
      let normalized = model.replace(/^[a-z0-9-]+\./, '') // 去掉任何区域前缀（更通用）
      normalized = normalized.replace('anthropic.', '') // 去掉anthropic前缀
      normalized = normalized.replace(/-v\d+:\d+$/, '') // 去掉Versión后缀（如-v1:0, -v2:1等）
      return normalized
    }

    // 对于其他模型，去掉常见的Versión后缀
    return model.replace(/-v\d+:\d+$|:latest$/, '')
  }

  async incrementTokenUsage(
    keyId,
    tokens,
    inputTokens = 0,
    outputTokens = 0,
    cacheCreateTokens = 0,
    cacheReadTokens = 0,
    model = 'unknown',
    ephemeral5mTokens = 0, // Nueva característica：5分钟Caché tokens
    ephemeral1hTokens = 0, // Nueva característica：1小时Caché tokens
    isLongContextRequest = false, // Nueva característica：是否为 1M 上下文Solicitud（超过200k）
    realCost = 0, // 真实费用（官方API费用）
    ratedCost = 0 // 计费费用（应用倍率后）
  ) {
    const key = `usage:${keyId}`
    const now = new Date()
    const today = getDateStringInTimezone(now)
    const tzDate = getDateInTimezone(now)
    const currentMonth = `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}`
    const currentHour = `${today}:${String(getHourInTimezone(now)).padStart(2, '0')}` // Nueva característica小时级别

    const daily = `usage:daily:${keyId}:${today}`
    const monthly = `usage:monthly:${keyId}:${currentMonth}`
    const hourly = `usage:hourly:${keyId}:${currentHour}` // Nueva característica小时级别key

    // 标准化模型名用于Estadística聚合
    const normalizedModel = this._normalizeModelName(model)

    // 按模型Estadística的键
    const modelDaily = `usage:model:daily:${normalizedModel}:${today}`
    const modelMonthly = `usage:model:monthly:${normalizedModel}:${currentMonth}`
    const modelHourly = `usage:model:hourly:${normalizedModel}:${currentHour}` // Nueva característica模型小时级别

    // API Key级别的模型Estadística
    const keyModelDaily = `usage:${keyId}:model:daily:${normalizedModel}:${today}`
    const keyModelMonthly = `usage:${keyId}:model:monthly:${normalizedModel}:${currentMonth}`
    const keyModelHourly = `usage:${keyId}:model:hourly:${normalizedModel}:${currentHour}` // Nueva característicaAPI Key模型小时级别

    // Nueva característica：系统级分钟Estadística
    const minuteTimestamp = Math.floor(now.getTime() / 60000)
    const systemMinuteKey = `system:metrics:minute:${minuteTimestamp}`

    // 智能Procesar输入输出token分配
    const finalInputTokens = inputTokens || 0
    const finalOutputTokens = outputTokens || (finalInputTokens > 0 ? 0 : tokens)
    const finalCacheCreateTokens = cacheCreateTokens || 0
    const finalCacheReadTokens = cacheReadTokens || 0

    // 重新Calcular真实的总token数（包括Cachétoken）
    const totalTokens =
      finalInputTokens + finalOutputTokens + finalCacheCreateTokens + finalCacheReadTokens
    // 核心token（不包括Caché）- 用于与历史Datos兼容
    const coreTokens = finalInputTokens + finalOutputTokens

    // 使用PipelineOptimizaciónRendimiento
    const pipeline = this.client.pipeline()

    // 现有的Estadística保持不变
    // 核心tokenEstadística（保持向后兼容）
    pipeline.hincrby(key, 'totalTokens', coreTokens)
    pipeline.hincrby(key, 'totalInputTokens', finalInputTokens)
    pipeline.hincrby(key, 'totalOutputTokens', finalOutputTokens)
    // CachétokenEstadística（Nueva característica）
    pipeline.hincrby(key, 'totalCacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(key, 'totalCacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(key, 'totalAllTokens', totalTokens) // Incluir所有Tipo的总token
    // 详细CachéTipoEstadística（Nueva característica）
    pipeline.hincrby(key, 'totalEphemeral5mTokens', ephemeral5mTokens)
    pipeline.hincrby(key, 'totalEphemeral1hTokens', ephemeral1hTokens)
    // 1M 上下文SolicitudEstadística（Nueva característica）
    if (isLongContextRequest) {
      pipeline.hincrby(key, 'totalLongContextInputTokens', finalInputTokens)
      pipeline.hincrby(key, 'totalLongContextOutputTokens', finalOutputTokens)
      pipeline.hincrby(key, 'totalLongContextRequests', 1)
    }
    // Solicitud计数
    pipeline.hincrby(key, 'totalRequests', 1)

    // 每日Estadística
    pipeline.hincrby(daily, 'tokens', coreTokens)
    pipeline.hincrby(daily, 'inputTokens', finalInputTokens)
    pipeline.hincrby(daily, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(daily, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(daily, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(daily, 'allTokens', totalTokens)
    pipeline.hincrby(daily, 'requests', 1)
    // 详细CachéTipoEstadística
    pipeline.hincrby(daily, 'ephemeral5mTokens', ephemeral5mTokens)
    pipeline.hincrby(daily, 'ephemeral1hTokens', ephemeral1hTokens)
    // 1M 上下文SolicitudEstadística
    if (isLongContextRequest) {
      pipeline.hincrby(daily, 'longContextInputTokens', finalInputTokens)
      pipeline.hincrby(daily, 'longContextOutputTokens', finalOutputTokens)
      pipeline.hincrby(daily, 'longContextRequests', 1)
    }

    // 每月Estadística
    pipeline.hincrby(monthly, 'tokens', coreTokens)
    pipeline.hincrby(monthly, 'inputTokens', finalInputTokens)
    pipeline.hincrby(monthly, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(monthly, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(monthly, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(monthly, 'allTokens', totalTokens)
    pipeline.hincrby(monthly, 'requests', 1)
    // 详细CachéTipoEstadística
    pipeline.hincrby(monthly, 'ephemeral5mTokens', ephemeral5mTokens)
    pipeline.hincrby(monthly, 'ephemeral1hTokens', ephemeral1hTokens)

    // 按模型Estadística - 每日
    pipeline.hincrby(modelDaily, 'inputTokens', finalInputTokens)
    pipeline.hincrby(modelDaily, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(modelDaily, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(modelDaily, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(modelDaily, 'allTokens', totalTokens)
    pipeline.hincrby(modelDaily, 'requests', 1)

    // 按模型Estadística - 每月
    pipeline.hincrby(modelMonthly, 'inputTokens', finalInputTokens)
    pipeline.hincrby(modelMonthly, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(modelMonthly, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(modelMonthly, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(modelMonthly, 'allTokens', totalTokens)
    pipeline.hincrby(modelMonthly, 'requests', 1)

    // API Key级别的模型Estadística - 每日
    pipeline.hincrby(keyModelDaily, 'inputTokens', finalInputTokens)
    pipeline.hincrby(keyModelDaily, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(keyModelDaily, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(keyModelDaily, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(keyModelDaily, 'allTokens', totalTokens)
    pipeline.hincrby(keyModelDaily, 'requests', 1)
    // 详细CachéTipoEstadística
    pipeline.hincrby(keyModelDaily, 'ephemeral5mTokens', ephemeral5mTokens)
    pipeline.hincrby(keyModelDaily, 'ephemeral1hTokens', ephemeral1hTokens)
    // 费用Estadística（使用整数存储，单位：微美元，1美元=1000000微美元）
    if (realCost > 0) {
      pipeline.hincrby(keyModelDaily, 'realCostMicro', Math.round(realCost * 1000000))
    }
    if (ratedCost > 0) {
      pipeline.hincrby(keyModelDaily, 'ratedCostMicro', Math.round(ratedCost * 1000000))
    }

    // API Key级别的模型Estadística - 每月
    pipeline.hincrby(keyModelMonthly, 'inputTokens', finalInputTokens)
    pipeline.hincrby(keyModelMonthly, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(keyModelMonthly, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(keyModelMonthly, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(keyModelMonthly, 'allTokens', totalTokens)
    pipeline.hincrby(keyModelMonthly, 'requests', 1)
    // 详细CachéTipoEstadística
    pipeline.hincrby(keyModelMonthly, 'ephemeral5mTokens', ephemeral5mTokens)
    pipeline.hincrby(keyModelMonthly, 'ephemeral1hTokens', ephemeral1hTokens)
    // 费用Estadística
    if (realCost > 0) {
      pipeline.hincrby(keyModelMonthly, 'realCostMicro', Math.round(realCost * 1000000))
    }
    if (ratedCost > 0) {
      pipeline.hincrby(keyModelMonthly, 'ratedCostMicro', Math.round(ratedCost * 1000000))
    }

    // API Key级别的模型Estadística - 所有Tiempo（无 TTL）
    const keyModelAlltime = `usage:${keyId}:model:alltime:${normalizedModel}`
    pipeline.hincrby(keyModelAlltime, 'inputTokens', finalInputTokens)
    pipeline.hincrby(keyModelAlltime, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(keyModelAlltime, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(keyModelAlltime, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(keyModelAlltime, 'requests', 1)
    // 费用Estadística
    if (realCost > 0) {
      pipeline.hincrby(keyModelAlltime, 'realCostMicro', Math.round(realCost * 1000000))
    }
    if (ratedCost > 0) {
      pipeline.hincrby(keyModelAlltime, 'ratedCostMicro', Math.round(ratedCost * 1000000))
    }

    // 小时级别Estadística
    pipeline.hincrby(hourly, 'tokens', coreTokens)
    pipeline.hincrby(hourly, 'inputTokens', finalInputTokens)
    pipeline.hincrby(hourly, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(hourly, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(hourly, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(hourly, 'allTokens', totalTokens)
    pipeline.hincrby(hourly, 'requests', 1)

    // 按模型Estadística - 每小时
    pipeline.hincrby(modelHourly, 'inputTokens', finalInputTokens)
    pipeline.hincrby(modelHourly, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(modelHourly, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(modelHourly, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(modelHourly, 'allTokens', totalTokens)
    pipeline.hincrby(modelHourly, 'requests', 1)

    // API Key级别的模型Estadística - 每小时
    pipeline.hincrby(keyModelHourly, 'inputTokens', finalInputTokens)
    pipeline.hincrby(keyModelHourly, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(keyModelHourly, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(keyModelHourly, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(keyModelHourly, 'allTokens', totalTokens)
    pipeline.hincrby(keyModelHourly, 'requests', 1)
    // 费用Estadística
    if (realCost > 0) {
      pipeline.hincrby(keyModelHourly, 'realCostMicro', Math.round(realCost * 1000000))
    }
    if (ratedCost > 0) {
      pipeline.hincrby(keyModelHourly, 'ratedCostMicro', Math.round(ratedCost * 1000000))
    }

    // Nueva característica：系统级分钟Estadística
    pipeline.hincrby(systemMinuteKey, 'requests', 1)
    pipeline.hincrby(systemMinuteKey, 'totalTokens', totalTokens)
    pipeline.hincrby(systemMinuteKey, 'inputTokens', finalInputTokens)
    pipeline.hincrby(systemMinuteKey, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(systemMinuteKey, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(systemMinuteKey, 'cacheReadTokens', finalCacheReadTokens)

    // Establecer过期Tiempo
    pipeline.expire(daily, 86400 * 32) // 32天过期
    pipeline.expire(monthly, 86400 * 365) // 1年过期
    pipeline.expire(hourly, 86400 * 7) // 小时Estadística7天过期
    pipeline.expire(modelDaily, 86400 * 32) // 模型每日Estadística32天过期
    pipeline.expire(modelMonthly, 86400 * 365) // 模型每月Estadística1年过期
    pipeline.expire(modelHourly, 86400 * 7) // 模型小时Estadística7天过期
    pipeline.expire(keyModelDaily, 86400 * 32) // API Key模型每日Estadística32天过期
    pipeline.expire(keyModelMonthly, 86400 * 365) // API Key模型每月Estadística1年过期
    pipeline.expire(keyModelHourly, 86400 * 7) // API Key模型小时Estadística7天过期

    // 系统级分钟Estadística的过期Tiempo（窗口Tiempo的2倍，Predeterminado5分钟）
    const configLocal = require('../../config/config')
    const metricsWindow = configLocal.system?.metricsWindow || 5
    pipeline.expire(systemMinuteKey, metricsWindow * 60 * 2)

    // 添加Índice（用于快速Consulta，避免 SCAN）
    pipeline.sadd(`usage:daily:index:${today}`, keyId)
    pipeline.sadd(`usage:hourly:index:${currentHour}`, keyId)
    pipeline.sadd(`usage:model:daily:index:${today}`, normalizedModel)
    pipeline.sadd(`usage:model:hourly:index:${currentHour}`, normalizedModel)
    pipeline.sadd(`usage:model:monthly:index:${currentMonth}`, normalizedModel)
    pipeline.sadd('usage:model:monthly:months', currentMonth) // 全局月份Índice
    pipeline.sadd(`usage:keymodel:daily:index:${today}`, `${keyId}:${normalizedModel}`)
    pipeline.sadd(`usage:keymodel:hourly:index:${currentHour}`, `${keyId}:${normalizedModel}`)
    // Limpiar空标记（有新Datos时）
    pipeline.del(`usage:daily:index:${today}:empty`)
    pipeline.del(`usage:hourly:index:${currentHour}:empty`)
    pipeline.del(`usage:model:daily:index:${today}:empty`)
    pipeline.del(`usage:model:hourly:index:${currentHour}:empty`)
    pipeline.del(`usage:model:monthly:index:${currentMonth}:empty`)
    pipeline.del(`usage:keymodel:daily:index:${today}:empty`)
    pipeline.del(`usage:keymodel:hourly:index:${currentHour}:empty`)
    // Índice过期Tiempo
    pipeline.expire(`usage:daily:index:${today}`, 86400 * 32)
    pipeline.expire(`usage:hourly:index:${currentHour}`, 86400 * 7)
    pipeline.expire(`usage:model:daily:index:${today}`, 86400 * 32)
    pipeline.expire(`usage:model:hourly:index:${currentHour}`, 86400 * 7)
    pipeline.expire(`usage:model:monthly:index:${currentMonth}`, 86400 * 365)
    pipeline.expire(`usage:keymodel:daily:index:${today}`, 86400 * 32)
    pipeline.expire(`usage:keymodel:hourly:index:${currentHour}`, 86400 * 7)

    // 全局预聚合Estadística
    const globalDaily = `usage:global:daily:${today}`
    const globalMonthly = `usage:global:monthly:${currentMonth}`
    pipeline.hincrby('usage:global:total', 'requests', 1)
    pipeline.hincrby('usage:global:total', 'inputTokens', finalInputTokens)
    pipeline.hincrby('usage:global:total', 'outputTokens', finalOutputTokens)
    pipeline.hincrby('usage:global:total', 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby('usage:global:total', 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby('usage:global:total', 'allTokens', totalTokens)
    pipeline.hincrby(globalDaily, 'requests', 1)
    pipeline.hincrby(globalDaily, 'inputTokens', finalInputTokens)
    pipeline.hincrby(globalDaily, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(globalDaily, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(globalDaily, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(globalDaily, 'allTokens', totalTokens)
    pipeline.hincrby(globalMonthly, 'requests', 1)
    pipeline.hincrby(globalMonthly, 'inputTokens', finalInputTokens)
    pipeline.hincrby(globalMonthly, 'outputTokens', finalOutputTokens)
    pipeline.hincrby(globalMonthly, 'cacheCreateTokens', finalCacheCreateTokens)
    pipeline.hincrby(globalMonthly, 'cacheReadTokens', finalCacheReadTokens)
    pipeline.hincrby(globalMonthly, 'allTokens', totalTokens)
    pipeline.expire(globalDaily, 86400 * 32)
    pipeline.expire(globalMonthly, 86400 * 365)

    // EjecutarPipeline
    await pipeline.exec()
  }

  // 📊 RegistroCuenta级别的使用Estadística
  async incrementAccountUsage(
    accountId,
    totalTokens,
    inputTokens = 0,
    outputTokens = 0,
    cacheCreateTokens = 0,
    cacheReadTokens = 0,
    model = 'unknown',
    isLongContextRequest = false
  ) {
    const now = new Date()
    const today = getDateStringInTimezone(now)
    const tzDate = getDateInTimezone(now)
    const currentMonth = `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}`
    const currentHour = `${today}:${String(getHourInTimezone(now)).padStart(2, '0')}`

    // Cuenta级别Estadística的键
    const accountKey = `account_usage:${accountId}`
    const accountDaily = `account_usage:daily:${accountId}:${today}`
    const accountMonthly = `account_usage:monthly:${accountId}:${currentMonth}`
    const accountHourly = `account_usage:hourly:${accountId}:${currentHour}`

    // 标准化模型名用于Estadística聚合
    const normalizedModel = this._normalizeModelName(model)

    // Cuenta按模型Estadística的键
    const accountModelDaily = `account_usage:model:daily:${accountId}:${normalizedModel}:${today}`
    const accountModelMonthly = `account_usage:model:monthly:${accountId}:${normalizedModel}:${currentMonth}`
    const accountModelHourly = `account_usage:model:hourly:${accountId}:${normalizedModel}:${currentHour}`

    // Procesartoken分配
    const finalInputTokens = inputTokens || 0
    const finalOutputTokens = outputTokens || 0
    const finalCacheCreateTokens = cacheCreateTokens || 0
    const finalCacheReadTokens = cacheReadTokens || 0
    const actualTotalTokens =
      finalInputTokens + finalOutputTokens + finalCacheCreateTokens + finalCacheReadTokens
    const coreTokens = finalInputTokens + finalOutputTokens

    // ConstruirEstadísticaOperaciónArreglo
    const operations = [
      // Cuenta总体Estadística
      this.client.hincrby(accountKey, 'totalTokens', coreTokens),
      this.client.hincrby(accountKey, 'totalInputTokens', finalInputTokens),
      this.client.hincrby(accountKey, 'totalOutputTokens', finalOutputTokens),
      this.client.hincrby(accountKey, 'totalCacheCreateTokens', finalCacheCreateTokens),
      this.client.hincrby(accountKey, 'totalCacheReadTokens', finalCacheReadTokens),
      this.client.hincrby(accountKey, 'totalAllTokens', actualTotalTokens),
      this.client.hincrby(accountKey, 'totalRequests', 1),

      // Cuenta每日Estadística
      this.client.hincrby(accountDaily, 'tokens', coreTokens),
      this.client.hincrby(accountDaily, 'inputTokens', finalInputTokens),
      this.client.hincrby(accountDaily, 'outputTokens', finalOutputTokens),
      this.client.hincrby(accountDaily, 'cacheCreateTokens', finalCacheCreateTokens),
      this.client.hincrby(accountDaily, 'cacheReadTokens', finalCacheReadTokens),
      this.client.hincrby(accountDaily, 'allTokens', actualTotalTokens),
      this.client.hincrby(accountDaily, 'requests', 1),

      // Cuenta每月Estadística
      this.client.hincrby(accountMonthly, 'tokens', coreTokens),
      this.client.hincrby(accountMonthly, 'inputTokens', finalInputTokens),
      this.client.hincrby(accountMonthly, 'outputTokens', finalOutputTokens),
      this.client.hincrby(accountMonthly, 'cacheCreateTokens', finalCacheCreateTokens),
      this.client.hincrby(accountMonthly, 'cacheReadTokens', finalCacheReadTokens),
      this.client.hincrby(accountMonthly, 'allTokens', actualTotalTokens),
      this.client.hincrby(accountMonthly, 'requests', 1),

      // Cuenta每小时Estadística
      this.client.hincrby(accountHourly, 'tokens', coreTokens),
      this.client.hincrby(accountHourly, 'inputTokens', finalInputTokens),
      this.client.hincrby(accountHourly, 'outputTokens', finalOutputTokens),
      this.client.hincrby(accountHourly, 'cacheCreateTokens', finalCacheCreateTokens),
      this.client.hincrby(accountHourly, 'cacheReadTokens', finalCacheReadTokens),
      this.client.hincrby(accountHourly, 'allTokens', actualTotalTokens),
      this.client.hincrby(accountHourly, 'requests', 1),

      // 添加模型级别的Datos到hourly键中，以SoportarSesión窗口的Estadística
      this.client.hincrby(accountHourly, `model:${normalizedModel}:inputTokens`, finalInputTokens),
      this.client.hincrby(
        accountHourly,
        `model:${normalizedModel}:outputTokens`,
        finalOutputTokens
      ),
      this.client.hincrby(
        accountHourly,
        `model:${normalizedModel}:cacheCreateTokens`,
        finalCacheCreateTokens
      ),
      this.client.hincrby(
        accountHourly,
        `model:${normalizedModel}:cacheReadTokens`,
        finalCacheReadTokens
      ),
      this.client.hincrby(accountHourly, `model:${normalizedModel}:allTokens`, actualTotalTokens),
      this.client.hincrby(accountHourly, `model:${normalizedModel}:requests`, 1),

      // Cuenta按模型Estadística - 每日
      this.client.hincrby(accountModelDaily, 'inputTokens', finalInputTokens),
      this.client.hincrby(accountModelDaily, 'outputTokens', finalOutputTokens),
      this.client.hincrby(accountModelDaily, 'cacheCreateTokens', finalCacheCreateTokens),
      this.client.hincrby(accountModelDaily, 'cacheReadTokens', finalCacheReadTokens),
      this.client.hincrby(accountModelDaily, 'allTokens', actualTotalTokens),
      this.client.hincrby(accountModelDaily, 'requests', 1),

      // Cuenta按模型Estadística - 每月
      this.client.hincrby(accountModelMonthly, 'inputTokens', finalInputTokens),
      this.client.hincrby(accountModelMonthly, 'outputTokens', finalOutputTokens),
      this.client.hincrby(accountModelMonthly, 'cacheCreateTokens', finalCacheCreateTokens),
      this.client.hincrby(accountModelMonthly, 'cacheReadTokens', finalCacheReadTokens),
      this.client.hincrby(accountModelMonthly, 'allTokens', actualTotalTokens),
      this.client.hincrby(accountModelMonthly, 'requests', 1),

      // Cuenta按模型Estadística - 每小时
      this.client.hincrby(accountModelHourly, 'inputTokens', finalInputTokens),
      this.client.hincrby(accountModelHourly, 'outputTokens', finalOutputTokens),
      this.client.hincrby(accountModelHourly, 'cacheCreateTokens', finalCacheCreateTokens),
      this.client.hincrby(accountModelHourly, 'cacheReadTokens', finalCacheReadTokens),
      this.client.hincrby(accountModelHourly, 'allTokens', actualTotalTokens),
      this.client.hincrby(accountModelHourly, 'requests', 1),

      // Establecer过期Tiempo
      this.client.expire(accountDaily, 86400 * 32), // 32天过期
      this.client.expire(accountMonthly, 86400 * 365), // 1年过期
      this.client.expire(accountHourly, 86400 * 7), // 7天过期
      this.client.expire(accountModelDaily, 86400 * 32), // 32天过期
      this.client.expire(accountModelMonthly, 86400 * 365), // 1年过期
      this.client.expire(accountModelHourly, 86400 * 7), // 7天过期

      // 添加Índice
      this.client.sadd(`account_usage:hourly:index:${currentHour}`, accountId),
      this.client.sadd(
        `account_usage:model:hourly:index:${currentHour}`,
        `${accountId}:${normalizedModel}`
      ),
      this.client.expire(`account_usage:hourly:index:${currentHour}`, 86400 * 7),
      this.client.expire(`account_usage:model:hourly:index:${currentHour}`, 86400 * 7),
      // daily Índice
      this.client.sadd(`account_usage:daily:index:${today}`, accountId),
      this.client.sadd(
        `account_usage:model:daily:index:${today}`,
        `${accountId}:${normalizedModel}`
      ),
      this.client.expire(`account_usage:daily:index:${today}`, 86400 * 32),
      this.client.expire(`account_usage:model:daily:index:${today}`, 86400 * 32),
      // Limpiar空标记
      this.client.del(`account_usage:hourly:index:${currentHour}:empty`),
      this.client.del(`account_usage:model:hourly:index:${currentHour}:empty`),
      this.client.del(`account_usage:daily:index:${today}:empty`),
      this.client.del(`account_usage:model:daily:index:${today}:empty`)
    ]

    // 如果是 1M 上下文Solicitud，添加额外的Estadística
    if (isLongContextRequest) {
      operations.push(
        this.client.hincrby(accountKey, 'totalLongContextInputTokens', finalInputTokens),
        this.client.hincrby(accountKey, 'totalLongContextOutputTokens', finalOutputTokens),
        this.client.hincrby(accountKey, 'totalLongContextRequests', 1),
        this.client.hincrby(accountDaily, 'longContextInputTokens', finalInputTokens),
        this.client.hincrby(accountDaily, 'longContextOutputTokens', finalOutputTokens),
        this.client.hincrby(accountDaily, 'longContextRequests', 1)
      )
    }

    await Promise.all(operations)
  }

  /**
   * Obtener使用了指定模型的 Key IDs（OR 逻辑）
   * 使用 EXISTS + pipeline 批量Verificar alltime 键，避免 KEYS 全量扫描
   * Soportar分批Procesar和 fallback 到 SCAN 模式
   */
  async getKeyIdsWithModels(keyIds, models) {
    if (!keyIds.length || !models.length) {
      return new Set()
    }

    const client = this.getClientSafe()
    const result = new Set()
    const BATCH_SIZE = 1000

    // Construir所有需要Verificar的 key
    const checkKeys = []
    const keyIdMap = new Map()

    for (const keyId of keyIds) {
      for (const model of models) {
        const key = `usage:${keyId}:model:alltime:${model}`
        checkKeys.push(key)
        keyIdMap.set(key, keyId)
      }
    }

    // 分批 EXISTS Verificar（避免单个 pipeline 过大）
    for (let i = 0; i < checkKeys.length; i += BATCH_SIZE) {
      const batch = checkKeys.slice(i, i + BATCH_SIZE)
      const pipeline = client.pipeline()
      for (const key of batch) {
        pipeline.exists(key)
      }
      const results = await pipeline.exec()

      for (let j = 0; j < batch.length; j++) {
        const [err, exists] = results[j]
        if (!err && exists) {
          result.add(keyIdMap.get(batch[j]))
        }
      }
    }

    // Fallback: 如果 alltime 键全部不存在，Retirada到 SCAN 模式
    if (result.size === 0 && keyIds.length > 0) {
      // 多抽样Verificar：抽取最多 3 个 keyId Verificar是否有 alltime Datos
      const sampleIndices = new Set()
      sampleIndices.add(0) // 始终Incluir第一个
      if (keyIds.length > 1) {
        sampleIndices.add(keyIds.length - 1)
      } // Incluir最后一个
      if (keyIds.length > 2) {
        sampleIndices.add(Math.floor(keyIds.length / 2))
      } // Incluir中间一个

      let hasAnyAlltimeData = false
      for (const idx of sampleIndices) {
        const samplePattern = `usage:${keyIds[idx]}:model:alltime:*`
        const sampleKeys = await this.scanKeys(samplePattern)
        if (sampleKeys.length > 0) {
          hasAnyAlltimeData = true
          break
        }
      }

      if (!hasAnyAlltimeData) {
        // alltime Datos不存在，Retirada到旧扫描逻辑
        logger.warn('⚠️ alltime 模型Datos不存在，Retirada到 SCAN 模式（建议运FilaMigración脚本）')
        for (const keyId of keyIds) {
          for (const model of models) {
            const pattern = `usage:${keyId}:model:*:${model}:*`
            const keys = await this.scanKeys(pattern)
            if (keys.length > 0) {
              result.add(keyId)
              break
            }
          }
        }
      }
    }

    return result
  }

  /**
   * Obtener所有被使用过的模型ColumnaTabla
   */
  async getAllUsedModels() {
    const client = this.getClientSafe()
    const models = new Set()

    // 扫描所有模型使用Registro
    const pattern = 'usage:*:model:daily:*'
    let cursor = '0'
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 1000)
      cursor = nextCursor
      for (const key of keys) {
        // 从 key 中提取模型名: usage:{keyId}:model:daily:{model}:{date}
        const match = key.match(/usage:[^:]+:model:daily:([^:]+):/)
        if (match) {
          models.add(match[1])
        }
      }
    } while (cursor !== '0')

    return [...models].sort()
  }

  async getUsageStats(keyId) {
    const totalKey = `usage:${keyId}`
    const today = getDateStringInTimezone()
    const dailyKey = `usage:daily:${keyId}:${today}`
    const tzDate = getDateInTimezone()
    const currentMonth = `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}`
    const monthlyKey = `usage:monthly:${keyId}:${currentMonth}`

    const [total, daily, monthly] = await Promise.all([
      this.client.hgetall(totalKey),
      this.client.hgetall(dailyKey),
      this.client.hgetall(monthlyKey)
    ])

    // ObtenerAPI Key的CrearTiempo来Calcular平均Valor
    const keyData = await this.client.hgetall(`apikey:${keyId}`)
    const createdAt = keyData.createdAt ? new Date(keyData.createdAt) : new Date()
    const now = new Date()
    const daysSinceCreated = Math.max(1, Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24)))

    const totalTokens = parseInt(total.totalTokens) || 0
    const totalRequests = parseInt(total.totalRequests) || 0

    // Calcular平均RPM (requests per minute) 和 TPM (tokens per minute)
    const totalMinutes = Math.max(1, daysSinceCreated * 24 * 60)
    const avgRPM = totalRequests / totalMinutes
    const avgTPM = totalTokens / totalMinutes

    // Procesar旧Datos兼容性（SoportarCachétoken）
    const handleLegacyData = (data) => {
      // 优先使用total*Campo（存储时使用的Campo）
      const tokens = parseInt(data.totalTokens) || parseInt(data.tokens) || 0
      const inputTokens = parseInt(data.totalInputTokens) || parseInt(data.inputTokens) || 0
      const outputTokens = parseInt(data.totalOutputTokens) || parseInt(data.outputTokens) || 0
      const requests = parseInt(data.totalRequests) || parseInt(data.requests) || 0

      // Nueva característicaCachétokenCampo
      const cacheCreateTokens =
        parseInt(data.totalCacheCreateTokens) || parseInt(data.cacheCreateTokens) || 0
      const cacheReadTokens =
        parseInt(data.totalCacheReadTokens) || parseInt(data.cacheReadTokens) || 0
      const allTokens = parseInt(data.totalAllTokens) || parseInt(data.allTokens) || 0

      const totalFromSeparate = inputTokens + outputTokens
      // Calcular实际的总tokens（Incluir所有Tipo）
      const actualAllTokens =
        allTokens || inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens

      if (totalFromSeparate === 0 && tokens > 0) {
        // 旧Datos：没有输入输出分离
        return {
          tokens, // 保持兼容性，但统一使用allTokens
          inputTokens: Math.round(tokens * 0.3), // 假设30%为输入
          outputTokens: Math.round(tokens * 0.7), // 假设70%为输出
          cacheCreateTokens: 0, // 旧Datos没有Cachétoken
          cacheReadTokens: 0,
          allTokens: tokens, // 对于旧Datos，allTokens等于tokens
          requests
        }
      } else {
        // 新Datos或无Datos - 统一使用allTokens作为tokens的Valor
        return {
          tokens: actualAllTokens, // 统一使用allTokens作为总数
          inputTokens,
          outputTokens,
          cacheCreateTokens,
          cacheReadTokens,
          allTokens: actualAllTokens,
          requests
        }
      }
    }

    const totalData = handleLegacyData(total)
    const dailyData = handleLegacyData(daily)
    const monthlyData = handleLegacyData(monthly)

    return {
      total: totalData,
      daily: dailyData,
      monthly: monthlyData,
      averages: {
        rpm: Math.round(avgRPM * 100) / 100, // 保留2位小数
        tpm: Math.round(avgTPM * 100) / 100,
        dailyRequests: Math.round((totalRequests / daysSinceCreated) * 100) / 100,
        dailyTokens: Math.round((totalTokens / daysSinceCreated) * 100) / 100
      }
    }
  }

  async addUsageRecord(keyId, record, maxRecords = 200) {
    const listKey = `usage:records:${keyId}`
    const client = this.getClientSafe()

    try {
      await client
        .multi()
        .lpush(listKey, JSON.stringify(record))
        .ltrim(listKey, 0, Math.max(0, maxRecords - 1))
        .expire(listKey, 86400 * 90) // Predeterminado保留90天
        .exec()
    } catch (error) {
      logger.error(`❌ Failed to append usage record for key ${keyId}:`, error)
    }
  }

  async getUsageRecords(keyId, limit = 50) {
    const listKey = `usage:records:${keyId}`
    const client = this.getClient()

    if (!client) {
      return []
    }

    try {
      const rawRecords = await client.lrange(listKey, 0, Math.max(0, limit - 1))
      return rawRecords
        .map((entry) => {
          try {
            return JSON.parse(entry)
          } catch (error) {
            logger.warn('⚠️ Failed to parse usage record entry:', error)
            return null
          }
        })
        .filter(Boolean)
    } catch (error) {
      logger.error(`❌ Failed to load usage records for key ${keyId}:`, error)
      return []
    }
  }

  // 💰 Obtener当日费用
  async getDailyCost(keyId) {
    const today = getDateStringInTimezone()
    const costKey = `usage:cost:daily:${keyId}:${today}`
    const cost = await this.client.get(costKey)
    const result = parseFloat(cost || 0)
    logger.debug(
      `💰 Getting daily cost for ${keyId}, date: ${today}, key: ${costKey}, value: ${cost}, result: ${result}`
    )
    return result
  }

  // 💰 增加当日费用（Soportar倍率成本和真实成本分开Registro）
  // amount: 倍率后的成本（用于限额校验）
  // realAmount: 真实成本（用于对账），如果不传则等于 amount
  async incrementDailyCost(keyId, amount, realAmount = null) {
    const today = getDateStringInTimezone()
    const tzDate = getDateInTimezone()
    const currentMonth = `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}`
    const currentHour = `${today}:${String(getHourInTimezone(new Date())).padStart(2, '0')}`

    const dailyKey = `usage:cost:daily:${keyId}:${today}`
    const monthlyKey = `usage:cost:monthly:${keyId}:${currentMonth}`
    const hourlyKey = `usage:cost:hourly:${keyId}:${currentHour}`
    const totalKey = `usage:cost:total:${keyId}` // 总费用键 - 永不过期，持续累加

    // 真实成本键（用于对账）
    const realTotalKey = `usage:cost:real:total:${keyId}`
    const realDailyKey = `usage:cost:real:daily:${keyId}:${today}`
    const actualRealAmount = realAmount !== null ? realAmount : amount

    logger.debug(
      `💰 Incrementing cost for ${keyId}, rated: $${amount}, real: $${actualRealAmount}, date: ${today}`
    )

    const results = await Promise.all([
      this.client.incrbyfloat(dailyKey, amount),
      this.client.incrbyfloat(monthlyKey, amount),
      this.client.incrbyfloat(hourlyKey, amount),
      this.client.incrbyfloat(totalKey, amount), // 倍率后总费用（用于限额）
      this.client.incrbyfloat(realTotalKey, actualRealAmount), // 真实总费用（用于对账）
      this.client.incrbyfloat(realDailyKey, actualRealAmount), // 真实每日费用
      // Establecer过期Tiempo（注意：totalKey 和 realTotalKey 不Establecer过期Tiempo，保持永久累计）
      this.client.expire(dailyKey, 86400 * 30), // 30天
      this.client.expire(monthlyKey, 86400 * 90), // 90天
      this.client.expire(hourlyKey, 86400 * 7), // 7天
      this.client.expire(realDailyKey, 86400 * 30) // 30天
    ])

    logger.debug(`💰 Cost incremented successfully, new daily total: $${results[0]}`)
  }

  // 💰 Obtener费用Estadística（Incluir倍率成本和真实成本）
  async getCostStats(keyId) {
    const today = getDateStringInTimezone()
    const tzDate = getDateInTimezone()
    const currentMonth = `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}`
    const currentHour = `${today}:${String(getHourInTimezone(new Date())).padStart(2, '0')}`

    const [daily, monthly, hourly, total, realTotal, realDaily] = await Promise.all([
      this.client.get(`usage:cost:daily:${keyId}:${today}`),
      this.client.get(`usage:cost:monthly:${keyId}:${currentMonth}`),
      this.client.get(`usage:cost:hourly:${keyId}:${currentHour}`),
      this.client.get(`usage:cost:total:${keyId}`),
      this.client.get(`usage:cost:real:total:${keyId}`),
      this.client.get(`usage:cost:real:daily:${keyId}:${today}`)
    ])

    return {
      daily: parseFloat(daily || 0),
      monthly: parseFloat(monthly || 0),
      hourly: parseFloat(hourly || 0),
      total: parseFloat(total || 0),
      realTotal: parseFloat(realTotal || 0),
      realDaily: parseFloat(realDaily || 0)
    }
  }

  // 💰 Obtener本周 Opus 费用
  async getWeeklyOpusCost(keyId) {
    const currentWeek = getWeekStringInTimezone()
    const costKey = `usage:opus:weekly:${keyId}:${currentWeek}`
    const cost = await this.client.get(costKey)
    const result = parseFloat(cost || 0)
    logger.debug(
      `💰 Getting weekly Opus cost for ${keyId}, week: ${currentWeek}, key: ${costKey}, value: ${cost}, result: ${result}`
    )
    return result
  }

  // 💰 增加本周 Opus 费用（Soportar倍率成本和真实成本）
  // amount: 倍率后的成本（用于限额校验）
  // realAmount: 真实成本（用于对账），如果不传则等于 amount
  async incrementWeeklyOpusCost(keyId, amount, realAmount = null) {
    const currentWeek = getWeekStringInTimezone()
    const weeklyKey = `usage:opus:weekly:${keyId}:${currentWeek}`
    const totalKey = `usage:opus:total:${keyId}`
    const realWeeklyKey = `usage:opus:real:weekly:${keyId}:${currentWeek}`
    const realTotalKey = `usage:opus:real:total:${keyId}`
    const actualRealAmount = realAmount !== null ? realAmount : amount

    logger.debug(
      `💰 Incrementing weekly Opus cost for ${keyId}, week: ${currentWeek}, rated: $${amount}, real: $${actualRealAmount}`
    )

    // 使用 pipeline 批量Ejecutar，提高Rendimiento
    const pipeline = this.client.pipeline()
    pipeline.incrbyfloat(weeklyKey, amount)
    pipeline.incrbyfloat(totalKey, amount)
    pipeline.incrbyfloat(realWeeklyKey, actualRealAmount)
    pipeline.incrbyfloat(realTotalKey, actualRealAmount)
    // Establecer周费用键的过期Tiempo为 2 周
    pipeline.expire(weeklyKey, 14 * 24 * 3600)
    pipeline.expire(realWeeklyKey, 14 * 24 * 3600)

    const results = await pipeline.exec()
    logger.debug(`💰 Opus cost incremented successfully, new weekly total: $${results[0][1]}`)
  }

  // 💰 覆盖Establecer本周 Opus 费用（用于启动回填/Migración）
  async setWeeklyOpusCost(keyId, amount, weekString = null) {
    const currentWeek = weekString || getWeekStringInTimezone()
    const weeklyKey = `usage:opus:weekly:${keyId}:${currentWeek}`

    await this.client.set(weeklyKey, String(amount || 0))
    // 保留 2 周，足够覆盖"当前周 + 上周"查看/回填
    await this.client.expire(weeklyKey, 14 * 24 * 3600)
  }

  // 💰 CalcularCuenta的每日费用（基于模型使用，使用Índice集合替代 KEYS）
  async getAccountDailyCost(accountId) {
    const CostCalculator = require('../utils/costCalculator')
    const today = getDateStringInTimezone()

    // 使用Índice集合替代 KEYS 命令
    const indexKey = `account_usage:model:daily:index:${today}`
    const allEntries = await this.client.smembers(indexKey)

    // Filtrar出当前Cuenta的条目（Formato：accountId:model）
    const accountPrefix = `${accountId}:`
    const accountModels = allEntries
      .filter((entry) => entry.startsWith(accountPrefix))
      .map((entry) => entry.substring(accountPrefix.length))

    if (accountModels.length === 0) {
      return 0
    }

    // Pipeline 批量Obtener所有模型Datos
    const pipeline = this.client.pipeline()
    for (const model of accountModels) {
      pipeline.hgetall(`account_usage:model:daily:${accountId}:${model}:${today}`)
    }
    const results = await pipeline.exec()

    let totalCost = 0
    for (let i = 0; i < accountModels.length; i++) {
      const model = accountModels[i]
      const [err, modelUsage] = results[i]

      if (!err && modelUsage && (modelUsage.inputTokens || modelUsage.outputTokens)) {
        const usage = {
          input_tokens: parseInt(modelUsage.inputTokens || 0),
          output_tokens: parseInt(modelUsage.outputTokens || 0),
          cache_creation_input_tokens: parseInt(modelUsage.cacheCreateTokens || 0),
          cache_read_input_tokens: parseInt(modelUsage.cacheReadTokens || 0)
        }

        const costResult = CostCalculator.calculateCost(usage, model)
        totalCost += costResult.costs.total

        logger.debug(
          `💰 Account ${accountId} daily cost for model ${model}: $${costResult.costs.total}`
        )
      }
    }

    logger.debug(`💰 Account ${accountId} total daily cost: $${totalCost}`)
    return totalCost
  }

  // 💰 批量Calcular多个Cuenta的每日费用
  async batchGetAccountDailyCost(accountIds) {
    if (!accountIds || accountIds.length === 0) {
      return new Map()
    }

    const CostCalculator = require('../utils/costCalculator')
    const today = getDateStringInTimezone()

    // 一次ObtenerÍndice
    const indexKey = `account_usage:model:daily:index:${today}`
    const allEntries = await this.client.smembers(indexKey)

    // 按 accountId Agrupar
    const accountIdSet = new Set(accountIds)
    const entriesByAccount = new Map()
    for (const entry of allEntries) {
      const colonIndex = entry.indexOf(':')
      if (colonIndex === -1) {
        continue
      }
      const accountId = entry.substring(0, colonIndex)
      const model = entry.substring(colonIndex + 1)
      if (accountIdSet.has(accountId)) {
        if (!entriesByAccount.has(accountId)) {
          entriesByAccount.set(accountId, [])
        }
        entriesByAccount.get(accountId).push(model)
      }
    }

    const costMap = new Map(accountIds.map((id) => [id, 0]))

    // 如果Índice为空，Retirada到 KEYS 命令（兼容旧Datos）
    if (allEntries.length === 0) {
      logger.debug('💰 Daily cost index empty, falling back to KEYS for batch cost calculation')
      for (const accountId of accountIds) {
        try {
          const cost = await this.getAccountDailyCostFallback(accountId, today, CostCalculator)
          costMap.set(accountId, cost)
        } catch {
          // 忽略单个Cuenta的Error
        }
      }
      return costMap
    }

    // Pipeline 批量Obtener所有模型Datos
    const pipeline = this.client.pipeline()
    const queryOrder = []
    for (const [accountId, models] of entriesByAccount) {
      for (const model of models) {
        pipeline.hgetall(`account_usage:model:daily:${accountId}:${model}:${today}`)
        queryOrder.push({ accountId, model })
      }
    }

    if (queryOrder.length === 0) {
      return costMap
    }

    const results = await pipeline.exec()

    for (let i = 0; i < queryOrder.length; i++) {
      const { accountId, model } = queryOrder[i]
      const [err, modelUsage] = results[i]

      if (!err && modelUsage && (modelUsage.inputTokens || modelUsage.outputTokens)) {
        const usage = {
          input_tokens: parseInt(modelUsage.inputTokens || 0),
          output_tokens: parseInt(modelUsage.outputTokens || 0),
          cache_creation_input_tokens: parseInt(modelUsage.cacheCreateTokens || 0),
          cache_read_input_tokens: parseInt(modelUsage.cacheReadTokens || 0)
        }

        const costResult = CostCalculator.calculateCost(usage, model)
        costMap.set(accountId, costMap.get(accountId) + costResult.costs.total)
      }
    }

    return costMap
  }

  // 💰 RetiradaMétodo：Calcular单个Cuenta的每日费用（使用 scanKeys 替代 keys）
  async getAccountDailyCostFallback(accountId, today, CostCalculator) {
    const pattern = `account_usage:model:daily:${accountId}:*:${today}`
    const modelKeys = await this.scanKeys(pattern)

    if (!modelKeys || modelKeys.length === 0) {
      return 0
    }

    let totalCost = 0
    const pipeline = this.client.pipeline()
    for (const key of modelKeys) {
      pipeline.hgetall(key)
    }
    const results = await pipeline.exec()

    for (let i = 0; i < modelKeys.length; i++) {
      const key = modelKeys[i]
      const [err, modelUsage] = results[i]
      if (err || !modelUsage) {
        continue
      }

      const parts = key.split(':')
      const model = parts[4]

      if (modelUsage.inputTokens || modelUsage.outputTokens) {
        const usage = {
          input_tokens: parseInt(modelUsage.inputTokens || 0),
          output_tokens: parseInt(modelUsage.outputTokens || 0),
          cache_creation_input_tokens: parseInt(modelUsage.cacheCreateTokens || 0),
          cache_read_input_tokens: parseInt(modelUsage.cacheReadTokens || 0)
        }
        const costResult = CostCalculator.calculateCost(usage, model)
        totalCost += costResult.costs.total
      }
    }

    return totalCost
  }

  // 📊 ObtenerCuenta使用Estadística
  async getAccountUsageStats(accountId, accountType = null) {
    const accountKey = `account_usage:${accountId}`
    const today = getDateStringInTimezone()
    const accountDailyKey = `account_usage:daily:${accountId}:${today}`
    const tzDate = getDateInTimezone()
    const currentMonth = `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}`
    const accountMonthlyKey = `account_usage:monthly:${accountId}:${currentMonth}`

    const [total, daily, monthly] = await Promise.all([
      this.client.hgetall(accountKey),
      this.client.hgetall(accountDailyKey),
      this.client.hgetall(accountMonthlyKey)
    ])

    // ObtenerCuentaCrearTiempo来Calcular平均Valor - Soportar不同Tipo的账号
    let accountData = {}
    if (accountType === 'droid') {
      accountData = await this.client.hgetall(`droid:account:${accountId}`)
    } else if (accountType === 'openai') {
      accountData = await this.client.hgetall(`openai:account:${accountId}`)
    } else if (accountType === 'openai-responses') {
      accountData = await this.client.hgetall(`openai_responses_account:${accountId}`)
    } else {
      // 尝试多个前缀（优先 claude:account:）
      accountData = await this.client.hgetall(`claude:account:${accountId}`)
      if (!accountData.createdAt) {
        accountData = await this.client.hgetall(`claude_account:${accountId}`)
      }
      if (!accountData.createdAt) {
        accountData = await this.client.hgetall(`openai:account:${accountId}`)
      }
      if (!accountData.createdAt) {
        accountData = await this.client.hgetall(`openai_responses_account:${accountId}`)
      }
      if (!accountData.createdAt) {
        accountData = await this.client.hgetall(`openai_account:${accountId}`)
      }
      if (!accountData.createdAt) {
        accountData = await this.client.hgetall(`droid:account:${accountId}`)
      }
    }
    const createdAt = accountData.createdAt ? new Date(accountData.createdAt) : new Date()
    const now = new Date()
    const daysSinceCreated = Math.max(1, Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24)))

    const totalTokens = parseInt(total.totalTokens) || 0
    const totalRequests = parseInt(total.totalRequests) || 0

    // Calcular平均RPM和TPM
    const totalMinutes = Math.max(1, daysSinceCreated * 24 * 60)
    const avgRPM = totalRequests / totalMinutes
    const avgTPM = totalTokens / totalMinutes

    // ProcesarCuentaEstadísticaDatos
    const handleAccountData = (data) => {
      const tokens = parseInt(data.totalTokens) || parseInt(data.tokens) || 0
      const inputTokens = parseInt(data.totalInputTokens) || parseInt(data.inputTokens) || 0
      const outputTokens = parseInt(data.totalOutputTokens) || parseInt(data.outputTokens) || 0
      const requests = parseInt(data.totalRequests) || parseInt(data.requests) || 0
      const cacheCreateTokens =
        parseInt(data.totalCacheCreateTokens) || parseInt(data.cacheCreateTokens) || 0
      const cacheReadTokens =
        parseInt(data.totalCacheReadTokens) || parseInt(data.cacheReadTokens) || 0
      const allTokens = parseInt(data.totalAllTokens) || parseInt(data.allTokens) || 0

      const actualAllTokens =
        allTokens || inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens

      return {
        tokens,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        allTokens: actualAllTokens,
        requests
      }
    }

    const totalData = handleAccountData(total)
    const dailyData = handleAccountData(daily)
    const monthlyData = handleAccountData(monthly)

    // Obtener每日费用（基于模型使用）
    const dailyCost = await this.getAccountDailyCost(accountId)

    return {
      accountId,
      total: totalData,
      daily: {
        ...dailyData,
        cost: dailyCost
      },
      monthly: monthlyData,
      averages: {
        rpm: Math.round(avgRPM * 100) / 100,
        tpm: Math.round(avgTPM * 100) / 100,
        dailyRequests: Math.round((totalRequests / daysSinceCreated) * 100) / 100,
        dailyTokens: Math.round((totalTokens / daysSinceCreated) * 100) / 100
      }
    }
  }

  // 📈 Obtener所有Cuenta的使用Estadística
  async getAllAccountsUsageStats() {
    try {
      // 使用 getAllIdsByIndex ObtenerCuenta ID（自动ProcesarÍndice/SCAN Retirada）
      const accountIds = await this.getAllIdsByIndex(
        'claude:account:index',
        'claude:account:*',
        /^claude:account:(.+)$/
      )

      if (accountIds.length === 0) {
        return []
      }

      const accountStats = []

      for (const accountId of accountIds) {
        const accountKey = `claude:account:${accountId}`
        const accountData = await this.client.hgetall(accountKey)

        if (accountData && accountData.name) {
          const stats = await this.getAccountUsageStats(accountId)
          accountStats.push({
            id: accountId,
            name: accountData.name,
            email: accountData.email || '',
            status: accountData.status || 'unknown',
            isActive: accountData.isActive === 'true',
            ...stats
          })
        }
      }

      // 按当日token使用量Ordenar
      accountStats.sort((a, b) => (b.daily.allTokens || 0) - (a.daily.allTokens || 0))

      return accountStats
    } catch (error) {
      logger.error('❌ Failed to get all accounts usage stats:', error)
      return []
    }
  }

  // 🧹 清空所有API Key的使用EstadísticaDatos（使用 scanKeys + batchDelChunked Optimización）
  async resetAllUsageStats() {
    const client = this.getClientSafe()
    const stats = {
      deletedKeys: 0,
      deletedDailyKeys: 0,
      deletedMonthlyKeys: 0,
      resetApiKeys: 0
    }

    try {
      // 1. Obtener所有 API Key ID（使用 scanKeys）
      const apiKeyKeys = await this.scanKeys('apikey:*')
      const apiKeyIds = apiKeyKeys
        .filter((k) => k !== 'apikey:hash_map' && k.split(':').length === 2)
        .map((k) => k.replace('apikey:', ''))

      // 2. 批量Eliminar总体使用Estadística
      const usageKeys = apiKeyIds.map((id) => `usage:${id}`)
      stats.deletedKeys = await this.batchDelChunked(usageKeys)

      // 3. 使用 scanKeys Obtener并批量Eliminar daily Estadística
      const dailyKeys = await this.scanKeys('usage:daily:*')
      stats.deletedDailyKeys = await this.batchDelChunked(dailyKeys)

      // 4. 使用 scanKeys Obtener并批量Eliminar monthly Estadística
      const monthlyKeys = await this.scanKeys('usage:monthly:*')
      stats.deletedMonthlyKeys = await this.batchDelChunked(monthlyKeys)

      // 5. 批量重置 lastUsedAt（仅对存在的 key Operación，避免重建空 hash）
      const BATCH_SIZE = 500
      for (let i = 0; i < apiKeyIds.length; i += BATCH_SIZE) {
        const batch = apiKeyIds.slice(i, i + BATCH_SIZE)
        const existsPipeline = client.pipeline()
        for (const keyId of batch) {
          existsPipeline.exists(`apikey:${keyId}`)
        }
        const existsResults = await existsPipeline.exec()

        const updatePipeline = client.pipeline()
        let updateCount = 0
        for (let j = 0; j < batch.length; j++) {
          const [err, exists] = existsResults[j]
          if (!err && exists) {
            updatePipeline.hset(`apikey:${batch[j]}`, 'lastUsedAt', '')
            updateCount++
          }
        }
        if (updateCount > 0) {
          await updatePipeline.exec()
          stats.resetApiKeys += updateCount
        }
      }

      // 6. Limpiar所有 usage 相关键（使用 scanKeys + batchDelChunked）
      const allUsageKeys = await this.scanKeys('usage:*')
      const additionalDeleted = await this.batchDelChunked(allUsageKeys)
      stats.deletedKeys += additionalDeleted

      return stats
    } catch (error) {
      throw new Error(`Failed to reset usage stats: ${error.message}`)
    }
  }

  // 🏢 Claude Cuenta管理
  async setClaudeAccount(accountId, accountData) {
    const key = `claude:account:${accountId}`
    await this.client.hset(key, accountData)
    await this.client.sadd('claude:account:index', accountId)
    await this.client.del('claude:account:index:empty')
  }

  async getClaudeAccount(accountId) {
    const key = `claude:account:${accountId}`
    return await this.client.hgetall(key)
  }

  async getAllClaudeAccounts() {
    const accountIds = await this.getAllIdsByIndex(
      'claude:account:index',
      'claude:account:*',
      /^claude:account:(.+)$/
    )
    if (accountIds.length === 0) {
      return []
    }

    const keys = accountIds.map((id) => `claude:account:${id}`)
    const pipeline = this.client.pipeline()
    keys.forEach((key) => pipeline.hgetall(key))
    const results = await pipeline.exec()

    const accounts = []
    results.forEach(([err, accountData], index) => {
      if (!err && accountData && Object.keys(accountData).length > 0) {
        accounts.push({ id: accountIds[index], ...accountData })
      }
    })
    return accounts
  }

  async deleteClaudeAccount(accountId) {
    const key = `claude:account:${accountId}`
    await this.client.srem('claude:account:index', accountId)
    return await this.client.del(key)
  }

  // 🤖 Droid Cuenta相关Operación
  async setDroidAccount(accountId, accountData) {
    const key = `droid:account:${accountId}`
    await this.client.hset(key, accountData)
    await this.client.sadd('droid:account:index', accountId)
    await this.client.del('droid:account:index:empty')
  }

  async getDroidAccount(accountId) {
    const key = `droid:account:${accountId}`
    return await this.client.hgetall(key)
  }

  async getAllDroidAccounts() {
    const accountIds = await this.getAllIdsByIndex(
      'droid:account:index',
      'droid:account:*',
      /^droid:account:(.+)$/
    )
    if (accountIds.length === 0) {
      return []
    }

    const keys = accountIds.map((id) => `droid:account:${id}`)
    const pipeline = this.client.pipeline()
    keys.forEach((key) => pipeline.hgetall(key))
    const results = await pipeline.exec()

    const accounts = []
    results.forEach(([err, accountData], index) => {
      if (!err && accountData && Object.keys(accountData).length > 0) {
        accounts.push({ id: accountIds[index], ...accountData })
      }
    })
    return accounts
  }

  async deleteDroidAccount(accountId) {
    const key = `droid:account:${accountId}`
    // 从Índice中Eliminación
    await this.client.srem('droid:account:index', accountId)
    return await this.client.del(key)
  }

  async setOpenAiAccount(accountId, accountData) {
    const key = `openai:account:${accountId}`
    await this.client.hset(key, accountData)
    await this.client.sadd('openai:account:index', accountId)
    await this.client.del('openai:account:index:empty')
  }
  async getOpenAiAccount(accountId) {
    const key = `openai:account:${accountId}`
    return await this.client.hgetall(key)
  }
  async deleteOpenAiAccount(accountId) {
    const key = `openai:account:${accountId}`
    await this.client.srem('openai:account:index', accountId)
    return await this.client.del(key)
  }

  async getAllOpenAIAccounts() {
    const accountIds = await this.getAllIdsByIndex(
      'openai:account:index',
      'openai:account:*',
      /^openai:account:(.+)$/
    )
    if (accountIds.length === 0) {
      return []
    }

    const keys = accountIds.map((id) => `openai:account:${id}`)
    const pipeline = this.client.pipeline()
    keys.forEach((key) => pipeline.hgetall(key))
    const results = await pipeline.exec()

    const accounts = []
    results.forEach(([err, accountData], index) => {
      if (!err && accountData && Object.keys(accountData).length > 0) {
        accounts.push({ id: accountIds[index], ...accountData })
      }
    })
    return accounts
  }

  // 🔐 Sesión管理（用于管理员登录等）
  async setSession(sessionId, sessionData, ttl = 86400) {
    const key = `session:${sessionId}`
    await this.client.hset(key, sessionData)
    await this.client.expire(key, ttl)
  }

  async getSession(sessionId) {
    const key = `session:${sessionId}`
    return await this.client.hgetall(key)
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`
    return await this.client.del(key)
  }

  // 🗝️ API Key哈希Índice管理（兼容旧结构 apikey_hash:* 和新结构 apikey:hash_map）
  async setApiKeyHash(hashedKey, keyData, ttl = 0) {
    // Escribir旧结构（兼容）
    const key = `apikey_hash:${hashedKey}`
    await this.client.hset(key, keyData)
    if (ttl > 0) {
      await this.client.expire(key, ttl)
    }
    // 同时Escribir新结构 hash_map（认证使用此结构）
    if (keyData.id) {
      await this.client.hset('apikey:hash_map', hashedKey, keyData.id)
    }
  }

  async getApiKeyHash(hashedKey) {
    const key = `apikey_hash:${hashedKey}`
    return await this.client.hgetall(key)
  }

  async deleteApiKeyHash(hashedKey) {
    // 同时Limpiar旧结构和新结构，确保 Key 轮换/Eliminar后旧 Key 失效
    const oldKey = `apikey_hash:${hashedKey}`
    await this.client.del(oldKey)
    // 从新的 hash_map 中Eliminación（认证使用此结构）
    await this.client.hdel('apikey:hash_map', hashedKey)
  }

  // 🔗 OAuthSesión管理
  async setOAuthSession(sessionId, sessionData, ttl = 600) {
    // 10分钟过期
    const key = `oauth:${sessionId}`

    // Serialización复杂Objeto，特别是 proxy Configuración
    const serializedData = {}
    for (const [dataKey, value] of Object.entries(sessionData)) {
      if (typeof value === 'object' && value !== null) {
        serializedData[dataKey] = JSON.stringify(value)
      } else {
        serializedData[dataKey] = value
      }
    }

    await this.client.hset(key, serializedData)
    await this.client.expire(key, ttl)
  }

  async getOAuthSession(sessionId) {
    const key = `oauth:${sessionId}`
    const data = await this.client.hgetall(key)

    // 反Serialización proxy Campo
    if (data.proxy) {
      try {
        data.proxy = JSON.parse(data.proxy)
      } catch (error) {
        // 如果AnalizarFalló，Establecer为 null
        data.proxy = null
      }
    }

    return data
  }

  async deleteOAuthSession(sessionId) {
    const key = `oauth:${sessionId}`
    return await this.client.del(key)
  }

  // 💰 Cuenta余额Caché（API Consulta结果）
  async setAccountBalance(platform, accountId, balanceData, ttl = 3600) {
    const key = `account_balance:${platform}:${accountId}`

    const payload = {
      balance:
        balanceData && balanceData.balance !== null && balanceData.balance !== undefined
          ? String(balanceData.balance)
          : '',
      currency: balanceData?.currency || 'USD',
      lastRefreshAt: balanceData?.lastRefreshAt || new Date().toISOString(),
      queryMethod: balanceData?.queryMethod || 'api',
      status: balanceData?.status || 'success',
      errorMessage: balanceData?.errorMessage || balanceData?.error || '',
      rawData: balanceData?.rawData ? JSON.stringify(balanceData.rawData) : '',
      quota: balanceData?.quota ? JSON.stringify(balanceData.quota) : ''
    }

    await this.client.hset(key, payload)
    await this.client.expire(key, ttl)
  }

  async getAccountBalance(platform, accountId) {
    const key = `account_balance:${platform}:${accountId}`
    const [data, ttlSeconds] = await Promise.all([this.client.hgetall(key), this.client.ttl(key)])

    if (!data || Object.keys(data).length === 0) {
      return null
    }

    let rawData = null
    if (data.rawData) {
      try {
        rawData = JSON.parse(data.rawData)
      } catch (error) {
        rawData = null
      }
    }

    let quota = null
    if (data.quota) {
      try {
        quota = JSON.parse(data.quota)
      } catch (error) {
        quota = null
      }
    }

    return {
      balance: data.balance ? parseFloat(data.balance) : null,
      currency: data.currency || 'USD',
      lastRefreshAt: data.lastRefreshAt || null,
      queryMethod: data.queryMethod || null,
      status: data.status || null,
      errorMessage: data.errorMessage || '',
      rawData,
      quota,
      ttlSeconds: Number.isFinite(ttlSeconds) ? ttlSeconds : null
    }
  }

  // 📊 Cuenta余额Caché（本地Estadística）
  async setLocalBalance(platform, accountId, statisticsData, ttl = 300) {
    const key = `account_balance_local:${platform}:${accountId}`

    await this.client.hset(key, {
      estimatedBalance: JSON.stringify(statisticsData || {}),
      lastCalculated: new Date().toISOString()
    })
    await this.client.expire(key, ttl)
  }

  async getLocalBalance(platform, accountId) {
    const key = `account_balance_local:${platform}:${accountId}`
    const data = await this.client.hgetall(key)

    if (!data || !data.estimatedBalance) {
      return null
    }

    try {
      return JSON.parse(data.estimatedBalance)
    } catch (error) {
      return null
    }
  }

  async deleteAccountBalance(platform, accountId) {
    const key = `account_balance:${platform}:${accountId}`
    const localKey = `account_balance_local:${platform}:${accountId}`
    await this.client.del(key, localKey)
  }

  // 🧩 Cuenta余额脚本Configuración
  async setBalanceScriptConfig(platform, accountId, scriptConfig) {
    const key = `account_balance_script:${platform}:${accountId}`
    await this.client.set(key, JSON.stringify(scriptConfig || {}))
  }

  async getBalanceScriptConfig(platform, accountId) {
    const key = `account_balance_script:${platform}:${accountId}`
    const raw = await this.client.get(key)
    if (!raw) {
      return null
    }
    try {
      return JSON.parse(raw)
    } catch (error) {
      return null
    }
  }

  async deleteBalanceScriptConfig(platform, accountId) {
    const key = `account_balance_script:${platform}:${accountId}`
    return await this.client.del(key)
  }

  // 📈 系统Estadística（使用 scanKeys 替代 keys）
  async getSystemStats() {
    const keys = await Promise.all([
      this.scanKeys('apikey:*'),
      this.scanKeys('claude:account:*'),
      this.scanKeys('usage:*')
    ])

    // Filtrar apikey Índice键，只Estadística实际的 apikey
    const apiKeyCount = keys[0].filter(
      (k) => k !== 'apikey:hash_map' && k.split(':').length === 2
    ).length

    return {
      totalApiKeys: apiKeyCount,
      totalClaudeAccounts: keys[1].length,
      totalUsageRecords: keys[2].length
    }
  }

  // 🔍 通过ÍndiceObtener key ColumnaTabla（替代 SCAN）
  async getKeysByIndex(indexKey, keyPattern) {
    const members = await this.client.smembers(indexKey)
    if (!members || members.length === 0) {
      return []
    }
    return members.map((id) => keyPattern.replace('{id}', id))
  }

  // 🔍 批量通过ÍndiceObtenerDatos
  async getDataByIndex(indexKey, keyPattern) {
    const keys = await this.getKeysByIndex(indexKey, keyPattern)
    if (keys.length === 0) {
      return []
    }
    return await this.batchHgetallChunked(keys)
  }

  // 📊 Obtener今日系统Estadística
  async getTodayStats() {
    try {
      const today = getDateStringInTimezone()
      // 优先使用ÍndiceConsulta，Retirada到 SCAN
      let dailyKeys = []
      const indexKey = `usage:daily:index:${today}`
      const indexMembers = await this.client.smembers(indexKey)
      if (indexMembers && indexMembers.length > 0) {
        dailyKeys = indexMembers.map((keyId) => `usage:daily:${keyId}:${today}`)
      } else {
        // Retirada到 SCAN（兼容历史Datos）
        dailyKeys = await this.scanKeys(`usage:daily:*:${today}`)
      }

      let totalRequestsToday = 0
      let totalTokensToday = 0
      let totalInputTokensToday = 0
      let totalOutputTokensToday = 0
      let totalCacheCreateTokensToday = 0
      let totalCacheReadTokensToday = 0

      // 批量Obtener所有今日Datos，提高Rendimiento
      if (dailyKeys.length > 0) {
        const results = await this.batchHgetallChunked(dailyKeys)

        for (const dailyData of results) {
          if (!dailyData) {
            continue
          }

          totalRequestsToday += parseInt(dailyData.requests) || 0
          const currentDayTokens = parseInt(dailyData.tokens) || 0
          totalTokensToday += currentDayTokens

          // Procesar旧Datos兼容性：如果有总token但没有输入输出分离，则使用总token作为输出token
          const inputTokens = parseInt(dailyData.inputTokens) || 0
          const outputTokens = parseInt(dailyData.outputTokens) || 0
          const cacheCreateTokens = parseInt(dailyData.cacheCreateTokens) || 0
          const cacheReadTokens = parseInt(dailyData.cacheReadTokens) || 0
          const totalTokensFromSeparate = inputTokens + outputTokens

          if (totalTokensFromSeparate === 0 && currentDayTokens > 0) {
            // 旧Datos：没有输入输出分离，假设70%为输出，30%为输入（基于一般对话比例）
            totalOutputTokensToday += Math.round(currentDayTokens * 0.7)
            totalInputTokensToday += Math.round(currentDayTokens * 0.3)
          } else {
            // 新Datos：使用实际的输入输出分离
            totalInputTokensToday += inputTokens
            totalOutputTokensToday += outputTokens
          }

          // 添加cache tokenEstadística
          totalCacheCreateTokensToday += cacheCreateTokens
          totalCacheReadTokensToday += cacheReadTokens
        }
      }

      // Obtener今日Crear的API Key数量（批量Optimización）
      const allApiKeys = await this.scanKeys('apikey:*')
      let apiKeysCreatedToday = 0

      if (allApiKeys.length > 0) {
        const pipeline = this.client.pipeline()
        allApiKeys.forEach((key) => pipeline.hget(key, 'createdAt'))
        const results = await pipeline.exec()

        for (const [error, createdAt] of results) {
          if (!error && createdAt && createdAt.startsWith(today)) {
            apiKeysCreatedToday++
          }
        }
      }

      return {
        requestsToday: totalRequestsToday,
        tokensToday: totalTokensToday,
        inputTokensToday: totalInputTokensToday,
        outputTokensToday: totalOutputTokensToday,
        cacheCreateTokensToday: totalCacheCreateTokensToday,
        cacheReadTokensToday: totalCacheReadTokensToday,
        apiKeysCreatedToday
      }
    } catch (error) {
      console.error('Error getting today stats:', error)
      return {
        requestsToday: 0,
        tokensToday: 0,
        inputTokensToday: 0,
        outputTokensToday: 0,
        cacheCreateTokensToday: 0,
        cacheReadTokensToday: 0,
        apiKeysCreatedToday: 0
      }
    }
  }

  // 📈 Obtener系统总的平均RPM和TPM
  async getSystemAverages() {
    try {
      const allApiKeys = await this.scanKeys('apikey:*')
      let totalRequests = 0
      let totalTokens = 0
      let totalInputTokens = 0
      let totalOutputTokens = 0
      let oldestCreatedAt = new Date()

      // 批量Obtener所有usageDatos和keyDatos，提高Rendimiento
      const usageKeys = allApiKeys.map((key) => `usage:${key.replace('apikey:', '')}`)
      const pipeline = this.client.pipeline()

      // 添加所有usageConsulta
      usageKeys.forEach((key) => pipeline.hgetall(key))
      // 添加所有keyDatosConsulta
      allApiKeys.forEach((key) => pipeline.hgetall(key))

      const results = await pipeline.exec()
      const usageResults = results.slice(0, usageKeys.length)
      const keyResults = results.slice(usageKeys.length)

      for (let i = 0; i < allApiKeys.length; i++) {
        const totalData = usageResults[i][1] || {}
        const keyData = keyResults[i][1] || {}

        totalRequests += parseInt(totalData.totalRequests) || 0
        totalTokens += parseInt(totalData.totalTokens) || 0
        totalInputTokens += parseInt(totalData.totalInputTokens) || 0
        totalOutputTokens += parseInt(totalData.totalOutputTokens) || 0

        const createdAt = keyData.createdAt ? new Date(keyData.createdAt) : new Date()
        if (createdAt < oldestCreatedAt) {
          oldestCreatedAt = createdAt
        }
      }

      const now = new Date()
      // 保持与个人API KeyCalcular一致的算法：按天Calcular然后Convertir为分钟
      const daysSinceOldest = Math.max(
        1,
        Math.ceil((now - oldestCreatedAt) / (1000 * 60 * 60 * 24))
      )
      const totalMinutes = daysSinceOldest * 24 * 60

      return {
        systemRPM: Math.round((totalRequests / totalMinutes) * 100) / 100,
        systemTPM: Math.round((totalTokens / totalMinutes) * 100) / 100,
        totalInputTokens,
        totalOutputTokens,
        totalTokens
      }
    } catch (error) {
      console.error('Error getting system averages:', error)
      return {
        systemRPM: 0,
        systemTPM: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0
      }
    }
  }

  // 📊 Obtener实时系统Métrica（基于滑动窗口）
  async getRealtimeSystemMetrics() {
    try {
      const configLocal = require('../../config/config')
      const windowMinutes = configLocal.system.metricsWindow || 5

      const now = new Date()
      const currentMinute = Math.floor(now.getTime() / 60000)

      // Depurar：打印当前Tiempo和分钟Tiempo戳
      logger.debug(
        `🔍 Realtime metrics - Current time: ${now.toISOString()}, Minute timestamp: ${currentMinute}`
      )

      // 使用Pipeline批量Obtener窗口内的所有分钟Datos
      const pipeline = this.client.pipeline()
      const minuteKeys = []
      for (let i = 0; i < windowMinutes; i++) {
        const minuteKey = `system:metrics:minute:${currentMinute - i}`
        minuteKeys.push(minuteKey)
        pipeline.hgetall(minuteKey)
      }

      logger.debug(`🔍 Realtime metrics - Checking keys: ${minuteKeys.join(', ')}`)

      const results = await pipeline.exec()

      // 聚合Calcular
      let totalRequests = 0
      let totalTokens = 0
      let totalInputTokens = 0
      let totalOutputTokens = 0
      let totalCacheCreateTokens = 0
      let totalCacheReadTokens = 0
      let validDataCount = 0

      results.forEach(([err, data], index) => {
        if (!err && data && Object.keys(data).length > 0) {
          validDataCount++
          totalRequests += parseInt(data.requests || 0)
          totalTokens += parseInt(data.totalTokens || 0)
          totalInputTokens += parseInt(data.inputTokens || 0)
          totalOutputTokens += parseInt(data.outputTokens || 0)
          totalCacheCreateTokens += parseInt(data.cacheCreateTokens || 0)
          totalCacheReadTokens += parseInt(data.cacheReadTokens || 0)

          logger.debug(`🔍 Realtime metrics - Key ${minuteKeys[index]} data:`, {
            requests: data.requests,
            totalTokens: data.totalTokens
          })
        }
      })

      logger.debug(
        `🔍 Realtime metrics - Valid data count: ${validDataCount}/${windowMinutes}, Total requests: ${totalRequests}, Total tokens: ${totalTokens}`
      )

      // Calcular平均Valor（每分钟）
      const realtimeRPM =
        windowMinutes > 0 ? Math.round((totalRequests / windowMinutes) * 100) / 100 : 0
      const realtimeTPM =
        windowMinutes > 0 ? Math.round((totalTokens / windowMinutes) * 100) / 100 : 0

      const result = {
        realtimeRPM,
        realtimeTPM,
        windowMinutes,
        totalRequests,
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        totalCacheCreateTokens,
        totalCacheReadTokens
      }

      logger.debug('🔍 Realtime metrics - Final result:', result)

      return result
    } catch (error) {
      console.error('Error getting realtime system metrics:', error)
      // 如果出错，Retornar历史平均Valor作为Degradación方案
      const historicalMetrics = await this.getSystemAverages()
      return {
        realtimeRPM: historicalMetrics.systemRPM,
        realtimeTPM: historicalMetrics.systemTPM,
        windowMinutes: 0, // 标识使用了历史Datos
        totalRequests: 0,
        totalTokens: historicalMetrics.totalTokens,
        totalInputTokens: historicalMetrics.totalInputTokens,
        totalOutputTokens: historicalMetrics.totalOutputTokens,
        totalCacheCreateTokens: 0,
        totalCacheReadTokens: 0
      }
    }
  }

  // 🔗 Sesiónsticky映射管理
  async setSessionAccountMapping(sessionHash, accountId, ttl = null) {
    const appConfig = require('../../config/config')
    // 从ConfiguraciónLeerTTL（小时），Convertir为秒，Predeterminado1小时
    const defaultTTL = ttl !== null ? ttl : (appConfig.session?.stickyTtlHours || 1) * 60 * 60
    const key = `sticky_session:${sessionHash}`
    await this.client.set(key, accountId, 'EX', defaultTTL)
  }

  async getSessionAccountMapping(sessionHash) {
    const key = `sticky_session:${sessionHash}`
    return await this.client.get(key)
  }

  // 🚀 智能SesiónTTL续期：剩余Tiempo少于阈Valor时自动续期
  async extendSessionAccountMappingTTL(sessionHash) {
    const appConfig = require('../../config/config')
    const key = `sticky_session:${sessionHash}`

    // 📊 从ConfiguraciónObtenerParámetro
    const ttlHours = appConfig.session?.stickyTtlHours || 1 // 小时，Predeterminado1小时
    const thresholdMinutes = appConfig.session?.renewalThresholdMinutes || 0 // 分钟，Predeterminado0（不续期）

    // 如果阈Valor为0，不Ejecutar续期
    if (thresholdMinutes === 0) {
      return true
    }

    const fullTTL = ttlHours * 60 * 60 // Convertir为秒
    const renewalThreshold = thresholdMinutes * 60 // Convertir为秒

    try {
      // Obtener当前剩余TTL（秒）
      const remainingTTL = await this.client.ttl(key)

      // 键不存在或已过期
      if (remainingTTL === -2) {
        return false
      }

      // 键存在但没有TTL（永不过期，不需要Procesar）
      if (remainingTTL === -1) {
        return true
      }

      // 🎯 智能续期Política：仅在剩余Tiempo少于阈Valor时才续期
      if (remainingTTL < renewalThreshold) {
        await this.client.expire(key, fullTTL)
        logger.debug(
          `🔄 Renewed sticky session TTL: ${sessionHash} (was ${Math.round(
            remainingTTL / 60
          )}min, renewed to ${ttlHours}h)`
        )
        return true
      }

      // 剩余Tiempo充足，无需续期
      logger.debug(
        `✅ Sticky session TTL sufficient: ${sessionHash} (remaining ${Math.round(
          remainingTTL / 60
        )}min)`
      )
      return true
    } catch (error) {
      logger.error('❌ Failed to extend session TTL:', error)
      return false
    }
  }

  async deleteSessionAccountMapping(sessionHash) {
    const key = `sticky_session:${sessionHash}`
    return await this.client.del(key)
  }

  // 🧹 Limpiar过期Datos（使用 scanKeys 替代 keys）
  async cleanup() {
    try {
      const patterns = ['usage:daily:*', 'ratelimit:*', 'session:*', 'sticky_session:*', 'oauth:*']

      for (const pattern of patterns) {
        const keys = await this.scanKeys(pattern)
        const pipeline = this.client.pipeline()

        for (const key of keys) {
          const ttl = await this.client.ttl(key)
          if (ttl === -1) {
            // 没有Establecer过期Tiempo的键
            if (key.startsWith('oauth:')) {
              pipeline.expire(key, 600) // OAuthSesiónEstablecer10分钟过期
            } else {
              pipeline.expire(key, 86400) // 其他Establecer1天过期
            }
          }
        }

        await pipeline.exec()
      }

      logger.info('🧹 Redis cleanup completed')
    } catch (error) {
      logger.error('❌ Redis cleanup failed:', error)
    }
  }

  // ObtenerConcurrenciaConfiguración
  _getConcurrencyConfig() {
    const defaults = {
      leaseSeconds: 300,
      renewIntervalSeconds: 30,
      cleanupGraceSeconds: 30
    }

    const configValues = {
      ...defaults,
      ...(config.concurrency || {})
    }

    const normalizeNumber = (value, fallback, options = {}) => {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        return fallback
      }

      if (options.allowZero && parsed === 0) {
        return 0
      }

      if (options.min !== undefined && parsed < options.min) {
        return options.min
      }

      return parsed
    }

    return {
      leaseSeconds: normalizeNumber(configValues.leaseSeconds, defaults.leaseSeconds, {
        min: 30
      }),
      renewIntervalSeconds: normalizeNumber(
        configValues.renewIntervalSeconds,
        defaults.renewIntervalSeconds,
        {
          allowZero: true,
          min: 0
        }
      ),
      cleanupGraceSeconds: normalizeNumber(
        configValues.cleanupGraceSeconds,
        defaults.cleanupGraceSeconds,
        {
          min: 0
        }
      )
    }
  }

  // 增加Concurrencia计数（基于租约的有序集合）
  async incrConcurrency(apiKeyId, requestId, leaseSeconds = null) {
    if (!requestId) {
      throw new Error('Request ID is required for concurrency tracking')
    }

    try {
      const { leaseSeconds: defaultLeaseSeconds, cleanupGraceSeconds } =
        this._getConcurrencyConfig()
      const lease = leaseSeconds || defaultLeaseSeconds
      const key = `concurrency:${apiKeyId}`
      const now = Date.now()
      const expireAt = now + lease * 1000
      const ttl = Math.max((lease + cleanupGraceSeconds) * 1000, 60000)

      const luaScript = `
        local key = KEYS[1]
        local member = ARGV[1]
        local expireAt = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local ttl = tonumber(ARGV[4])

        redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
        redis.call('ZADD', key, expireAt, member)

        if ttl > 0 then
          redis.call('PEXPIRE', key, ttl)
        end

        local count = redis.call('ZCARD', key)
        return count
      `

      const count = await this.client.eval(luaScript, 1, key, requestId, expireAt, now, ttl)
      logger.database(
        `🔢 Incremented concurrency for key ${apiKeyId}: ${count} (request ${requestId})`
      )
      return count
    } catch (error) {
      logger.error('❌ Failed to increment concurrency:', error)
      throw error
    }
  }

  // 刷新Concurrencia租约，防止长Conexión提前过期
  async refreshConcurrencyLease(apiKeyId, requestId, leaseSeconds = null) {
    if (!requestId) {
      return 0
    }

    try {
      const { leaseSeconds: defaultLeaseSeconds, cleanupGraceSeconds } =
        this._getConcurrencyConfig()
      const lease = leaseSeconds || defaultLeaseSeconds
      const key = `concurrency:${apiKeyId}`
      const now = Date.now()
      const expireAt = now + lease * 1000
      const ttl = Math.max((lease + cleanupGraceSeconds) * 1000, 60000)

      const luaScript = `
        local key = KEYS[1]
        local member = ARGV[1]
        local expireAt = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local ttl = tonumber(ARGV[4])

        redis.call('ZREMRANGEBYSCORE', key, '-inf', now)

        local exists = redis.call('ZSCORE', key, member)

        if exists then
          redis.call('ZADD', key, expireAt, member)
          if ttl > 0 then
            redis.call('PEXPIRE', key, ttl)
          end
          return 1
        end

        return 0
      `

      const refreshed = await this.client.eval(luaScript, 1, key, requestId, expireAt, now, ttl)
      if (refreshed === 1) {
        logger.debug(`🔄 Refreshed concurrency lease for key ${apiKeyId} (request ${requestId})`)
      }
      return refreshed
    } catch (error) {
      logger.error('❌ Failed to refresh concurrency lease:', error)
      return 0
    }
  }

  // 减少Concurrencia计数
  async decrConcurrency(apiKeyId, requestId) {
    try {
      const key = `concurrency:${apiKeyId}`
      const now = Date.now()

      const luaScript = `
        local key = KEYS[1]
        local member = ARGV[1]
        local now = tonumber(ARGV[2])

        if member then
          redis.call('ZREM', key, member)
        end

        redis.call('ZREMRANGEBYSCORE', key, '-inf', now)

        local count = redis.call('ZCARD', key)
        if count <= 0 then
          redis.call('DEL', key)
          return 0
        end

        return count
      `

      const count = await this.client.eval(luaScript, 1, key, requestId || '', now)
      logger.database(
        `🔢 Decremented concurrency for key ${apiKeyId}: ${count} (request ${requestId || 'n/a'})`
      )
      return count
    } catch (error) {
      logger.error('❌ Failed to decrement concurrency:', error)
      throw error
    }
  }

  // Obtener当前Nivel de concurrencia
  async getConcurrency(apiKeyId) {
    try {
      const key = `concurrency:${apiKeyId}`
      const now = Date.now()

      const luaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])

        redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
        return redis.call('ZCARD', key)
      `

      const count = await this.client.eval(luaScript, 1, key, now)
      return parseInt(count || 0)
    } catch (error) {
      logger.error('❌ Failed to get concurrency:', error)
      return 0
    }
  }

  // 🏢 Claude Console CuentaConcurrencia控制（复用现有Concurrencia机制）
  // 增加 Console CuentaConcurrencia计数
  async incrConsoleAccountConcurrency(accountId, requestId, leaseSeconds = null) {
    if (!requestId) {
      throw new Error('Request ID is required for console account concurrency tracking')
    }
    // 使用特殊的 key 前缀区分 Console CuentaConcurrencia
    const compositeKey = `console_account:${accountId}`
    return await this.incrConcurrency(compositeKey, requestId, leaseSeconds)
  }

  // 刷新 Console CuentaConcurrencia租约
  async refreshConsoleAccountConcurrencyLease(accountId, requestId, leaseSeconds = null) {
    if (!requestId) {
      return 0
    }
    const compositeKey = `console_account:${accountId}`
    return await this.refreshConcurrencyLease(compositeKey, requestId, leaseSeconds)
  }

  // 减少 Console CuentaConcurrencia计数
  async decrConsoleAccountConcurrency(accountId, requestId) {
    const compositeKey = `console_account:${accountId}`
    return await this.decrConcurrency(compositeKey, requestId)
  }

  // Obtener Console Cuenta当前Nivel de concurrencia
  async getConsoleAccountConcurrency(accountId) {
    const compositeKey = `console_account:${accountId}`
    return await this.getConcurrency(compositeKey)
  }

  // 🔧 Concurrencia管理Método（用于管理员手动Limpiar）

  /**
   * Obtener所有Concurrencia状态（使用 scanKeys 替代 keys）
   * @returns {Promise<Array>} Concurrencia状态ColumnaTabla
   */
  async getAllConcurrencyStatus() {
    try {
      const client = this.getClientSafe()
      const keys = await this.scanKeys('concurrency:*')
      const now = Date.now()
      const results = []

      for (const key of keys) {
        // 跳过已知非 Sorted Set Tipo的键
        // - concurrency:queue:stats:* 是 Hash Tipo
        // - concurrency:queue:wait_times:* 是 List Tipo
        // - concurrency:queue:* (不含stats/wait_times) 是 String Tipo
        if (
          key.startsWith('concurrency:queue:stats:') ||
          key.startsWith('concurrency:queue:wait_times:') ||
          (key.startsWith('concurrency:queue:') &&
            !key.includes(':stats:') &&
            !key.includes(':wait_times:'))
        ) {
          continue
        }

        // Verificar键Tipo，只Procesar Sorted Set
        const keyType = await client.type(key)
        if (keyType !== 'zset') {
          logger.debug(`🔢 getAllConcurrencyStatus skipped non-zset key: ${key} (type: ${keyType})`)
          continue
        }

        // 提取 apiKeyId（去掉 concurrency: 前缀）
        const apiKeyId = key.replace('concurrency:', '')

        // Obtener所有成员和分数（过期Tiempo）
        const members = await client.zrangebyscore(key, now, '+inf', 'WITHSCORES')

        // Analizar成员和过期Tiempo
        const activeRequests = []
        for (let i = 0; i < members.length; i += 2) {
          const requestId = members[i]
          const expireAt = parseInt(members[i + 1])
          const remainingSeconds = Math.max(0, Math.round((expireAt - now) / 1000))
          activeRequests.push({
            requestId,
            expireAt: new Date(expireAt).toISOString(),
            remainingSeconds
          })
        }

        // Obtener过期的成员数量
        const expiredCount = await client.zcount(key, '-inf', now)

        results.push({
          apiKeyId,
          key,
          activeCount: activeRequests.length,
          expiredCount,
          activeRequests
        })
      }

      return results
    } catch (error) {
      logger.error('❌ Failed to get all concurrency status:', error)
      throw error
    }
  }

  /**
   * Obtener特定 API Key 的Concurrencia状态详情
   * @param {string} apiKeyId - API Key ID
   * @returns {Promise<Object>} Concurrencia状态详情
   */
  async getConcurrencyStatus(apiKeyId) {
    try {
      const client = this.getClientSafe()
      const key = `concurrency:${apiKeyId}`
      const now = Date.now()

      // Verificar key 是否存在
      const exists = await client.exists(key)
      if (!exists) {
        return {
          apiKeyId,
          key,
          activeCount: 0,
          expiredCount: 0,
          activeRequests: [],
          exists: false
        }
      }

      // Verificar键Tipo，只Procesar Sorted Set
      const keyType = await client.type(key)
      if (keyType !== 'zset') {
        logger.warn(
          `⚠️ getConcurrencyStatus: key ${key} has unexpected type: ${keyType}, expected zset`
        )
        return {
          apiKeyId,
          key,
          activeCount: 0,
          expiredCount: 0,
          activeRequests: [],
          exists: true,
          invalidType: keyType
        }
      }

      // Obtener所有成员和分数
      const allMembers = await client.zrange(key, 0, -1, 'WITHSCORES')

      const activeRequests = []
      const expiredRequests = []

      for (let i = 0; i < allMembers.length; i += 2) {
        const requestId = allMembers[i]
        const expireAt = parseInt(allMembers[i + 1])
        const remainingSeconds = Math.round((expireAt - now) / 1000)

        const requestInfo = {
          requestId,
          expireAt: new Date(expireAt).toISOString(),
          remainingSeconds
        }

        if (expireAt > now) {
          activeRequests.push(requestInfo)
        } else {
          expiredRequests.push(requestInfo)
        }
      }

      return {
        apiKeyId,
        key,
        activeCount: activeRequests.length,
        expiredCount: expiredRequests.length,
        activeRequests,
        expiredRequests,
        exists: true
      }
    } catch (error) {
      logger.error(`❌ Failed to get concurrency status for ${apiKeyId}:`, error)
      throw error
    }
  }

  /**
   * 强制Limpiar特定 API Key 的Concurrencia计数（忽略租约）
   * @param {string} apiKeyId - API Key ID
   * @returns {Promise<Object>} Limpiar结果
   */
  async forceClearConcurrency(apiKeyId) {
    try {
      const client = this.getClientSafe()
      const key = `concurrency:${apiKeyId}`

      // Verificar键Tipo
      const keyType = await client.type(key)

      let beforeCount = 0
      let isLegacy = false

      if (keyType === 'zset') {
        // 正常的 zset 键，Obtener条目数
        beforeCount = await client.zcard(key)
      } else if (keyType !== 'none') {
        // 非 zset 且非空的遗留键
        isLegacy = true
        logger.warn(
          `⚠️ forceClearConcurrency: key ${key} has unexpected type: ${keyType}, will be deleted`
        )
      }

      // Eliminar键（无论什么Tipo）
      await client.del(key)

      logger.warn(
        `🧹 Force cleared concurrency for key ${apiKeyId}, removed ${beforeCount} entries${isLegacy ? ' (legacy key)' : ''}`
      )

      return {
        apiKeyId,
        key,
        clearedCount: beforeCount,
        type: keyType,
        legacy: isLegacy,
        success: true
      }
    } catch (error) {
      logger.error(`❌ Failed to force clear concurrency for ${apiKeyId}:`, error)
      throw error
    }
  }

  /**
   * 强制Limpiar所有Concurrencia计数（使用 scanKeys 替代 keys）
   * @returns {Promise<Object>} Limpiar结果
   */
  async forceClearAllConcurrency() {
    try {
      const client = this.getClientSafe()
      const keys = await this.scanKeys('concurrency:*')

      let totalCleared = 0
      let legacyCleared = 0
      const clearedKeys = []

      for (const key of keys) {
        // 跳过 queue 相关的键（它们有各自的Limpiar逻辑）
        if (key.startsWith('concurrency:queue:')) {
          continue
        }

        // Verificar键Tipo
        const keyType = await client.type(key)
        if (keyType === 'zset') {
          const count = await client.zcard(key)
          await client.del(key)
          totalCleared += count
          clearedKeys.push({
            key,
            clearedCount: count,
            type: 'zset'
          })
        } else {
          // 非 zset Tipo的遗留键，直接Eliminar
          await client.del(key)
          legacyCleared++
          clearedKeys.push({
            key,
            clearedCount: 0,
            type: keyType,
            legacy: true
          })
        }
      }

      logger.warn(
        `🧹 Force cleared all concurrency: ${clearedKeys.length} keys, ${totalCleared} entries, ${legacyCleared} legacy keys`
      )

      return {
        keysCleared: clearedKeys.length,
        totalEntriesCleared: totalCleared,
        legacyKeysCleared: legacyCleared,
        clearedKeys,
        success: true
      }
    } catch (error) {
      logger.error('❌ Failed to force clear all concurrency:', error)
      throw error
    }
  }

  /**
   * Limpiar过期的Concurrencia条目（不影响活跃Solicitud，使用 scanKeys 替代 keys）
   * @param {string} apiKeyId - API Key ID（Opcional，不传则Limpiar所有）
   * @returns {Promise<Object>} Limpiar结果
   */
  async cleanupExpiredConcurrency(apiKeyId = null) {
    try {
      const client = this.getClientSafe()
      const now = Date.now()
      let keys

      if (apiKeyId) {
        keys = [`concurrency:${apiKeyId}`]
      } else {
        keys = await this.scanKeys('concurrency:*')
      }

      let totalCleaned = 0
      let legacyCleaned = 0
      const cleanedKeys = []

      for (const key of keys) {
        // 跳过 queue 相关的键（它们有各自的Limpiar逻辑）
        if (key.startsWith('concurrency:queue:')) {
          continue
        }

        // Verificar键Tipo
        const keyType = await client.type(key)
        if (keyType !== 'zset') {
          // 非 zset Tipo的遗留键，直接Eliminar
          await client.del(key)
          legacyCleaned++
          cleanedKeys.push({
            key,
            cleanedCount: 0,
            type: keyType,
            legacy: true
          })
          continue
        }

        // 只Limpiar过期的条目
        const cleaned = await client.zremrangebyscore(key, '-inf', now)
        if (cleaned > 0) {
          totalCleaned += cleaned
          cleanedKeys.push({
            key,
            cleanedCount: cleaned
          })
        }

        // 如果 key 为空，Eliminar它
        const remaining = await client.zcard(key)
        if (remaining === 0) {
          await client.del(key)
        }
      }

      logger.info(
        `🧹 Cleaned up expired concurrency: ${totalCleaned} entries from ${cleanedKeys.length} keys, ${legacyCleaned} legacy keys removed`
      )

      return {
        keysProcessed: keys.length,
        keysCleaned: cleanedKeys.length,
        totalEntriesCleaned: totalCleaned,
        legacyKeysRemoved: legacyCleaned,
        cleanedKeys,
        success: true
      }
    } catch (error) {
      logger.error('❌ Failed to cleanup expired concurrency:', error)
      throw error
    }
  }

  // 🔧 Basic Redis operations wrapper methods for convenience
  async get(key) {
    const client = this.getClientSafe()
    return await client.get(key)
  }

  async set(key, value, ...args) {
    const client = this.getClientSafe()
    return await client.set(key, value, ...args)
  }

  async setex(key, ttl, value) {
    const client = this.getClientSafe()
    return await client.setex(key, ttl, value)
  }

  async del(...keys) {
    const client = this.getClientSafe()
    return await client.del(...keys)
  }

  async keys(pattern) {
    const client = this.getClientSafe()
    return await client.keys(pattern)
  }

  // 📊 ObtenerCuentaSesión窗口内的使用Estadística（Incluir模型细分）
  async getAccountSessionWindowUsage(accountId, windowStart, windowEnd) {
    try {
      if (!windowStart || !windowEnd) {
        return {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheCreateTokens: 0,
          totalCacheReadTokens: 0,
          totalAllTokens: 0,
          totalRequests: 0,
          modelUsage: {}
        }
      }

      const startDate = new Date(windowStart)
      const endDate = new Date(windowEnd)

      // 添加Registro以DepurarTiempo窗口
      logger.debug(`📊 Getting session window usage for account ${accountId}`)
      logger.debug(`   Window: ${windowStart} to ${windowEnd}`)
      logger.debug(`   Start UTC: ${startDate.toISOString()}, End UTC: ${endDate.toISOString()}`)

      // Obtener窗口内所有可能的小时键
      // 重要：需要使用Configuración的Zona horaria来Construir键名，因为Datos存储时使用的是ConfiguraciónZona horaria
      const hourlyKeys = []
      const currentHour = new Date(startDate)
      currentHour.setMinutes(0)
      currentHour.setSeconds(0)
      currentHour.setMilliseconds(0)

      while (currentHour <= endDate) {
        // 使用Zona horariaConvertirFunción来Obtener正确的Fecha和小时
        const tzDateStr = getDateStringInTimezone(currentHour)
        const tzHour = String(getHourInTimezone(currentHour)).padStart(2, '0')
        const key = `account_usage:hourly:${accountId}:${tzDateStr}:${tzHour}`

        logger.debug(`   Adding hourly key: ${key}`)
        hourlyKeys.push(key)
        currentHour.setHours(currentHour.getHours() + 1)
      }

      // 批量Obtener所有小时的Datos
      const pipeline = this.client.pipeline()
      for (const key of hourlyKeys) {
        pipeline.hgetall(key)
      }
      const results = await pipeline.exec()

      // 聚合所有Datos
      let totalInputTokens = 0
      let totalOutputTokens = 0
      let totalCacheCreateTokens = 0
      let totalCacheReadTokens = 0
      let totalAllTokens = 0
      let totalRequests = 0
      const modelUsage = {}

      logger.debug(`   Processing ${results.length} hourly results`)

      for (const [error, data] of results) {
        if (error || !data || Object.keys(data).length === 0) {
          continue
        }

        // Procesar总计Datos
        const hourInputTokens = parseInt(data.inputTokens || 0)
        const hourOutputTokens = parseInt(data.outputTokens || 0)
        const hourCacheCreateTokens = parseInt(data.cacheCreateTokens || 0)
        const hourCacheReadTokens = parseInt(data.cacheReadTokens || 0)
        const hourAllTokens = parseInt(data.allTokens || 0)
        const hourRequests = parseInt(data.requests || 0)

        totalInputTokens += hourInputTokens
        totalOutputTokens += hourOutputTokens
        totalCacheCreateTokens += hourCacheCreateTokens
        totalCacheReadTokens += hourCacheReadTokens
        totalAllTokens += hourAllTokens
        totalRequests += hourRequests

        if (hourAllTokens > 0) {
          logger.debug(`   Hour data: allTokens=${hourAllTokens}, requests=${hourRequests}`)
        }

        // Procesar每个模型的Datos
        for (const [key, value] of Object.entries(data)) {
          // 查找模型相关的键（Formato: model:{modelName}:{metric}）
          if (key.startsWith('model:')) {
            const parts = key.split(':')
            if (parts.length >= 3) {
              const modelName = parts[1]
              const metric = parts.slice(2).join(':')

              if (!modelUsage[modelName]) {
                modelUsage[modelName] = {
                  inputTokens: 0,
                  outputTokens: 0,
                  cacheCreateTokens: 0,
                  cacheReadTokens: 0,
                  allTokens: 0,
                  requests: 0
                }
              }

              if (metric === 'inputTokens') {
                modelUsage[modelName].inputTokens += parseInt(value || 0)
              } else if (metric === 'outputTokens') {
                modelUsage[modelName].outputTokens += parseInt(value || 0)
              } else if (metric === 'cacheCreateTokens') {
                modelUsage[modelName].cacheCreateTokens += parseInt(value || 0)
              } else if (metric === 'cacheReadTokens') {
                modelUsage[modelName].cacheReadTokens += parseInt(value || 0)
              } else if (metric === 'allTokens') {
                modelUsage[modelName].allTokens += parseInt(value || 0)
              } else if (metric === 'requests') {
                modelUsage[modelName].requests += parseInt(value || 0)
              }
            }
          }
        }
      }

      logger.debug(`📊 Session window usage summary:`)
      logger.debug(`   Total allTokens: ${totalAllTokens}`)
      logger.debug(`   Total requests: ${totalRequests}`)
      logger.debug(`   Input: ${totalInputTokens}, Output: ${totalOutputTokens}`)
      logger.debug(
        `   Cache Create: ${totalCacheCreateTokens}, Cache Read: ${totalCacheReadTokens}`
      )

      return {
        totalInputTokens,
        totalOutputTokens,
        totalCacheCreateTokens,
        totalCacheReadTokens,
        totalAllTokens,
        totalRequests,
        modelUsage
      }
    } catch (error) {
      logger.error(`❌ Failed to get session window usage for account ${accountId}:`, error)
      return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreateTokens: 0,
        totalCacheReadTokens: 0,
        totalAllTokens: 0,
        totalRequests: 0,
        modelUsage: {}
      }
    }
  }
}

const redisClient = new RedisClient()

// 分布式锁相关Método
redisClient.setAccountLock = async function (lockKey, lockValue, ttlMs) {
  try {
    // 使用SET NX PX实现原子性的锁Obtener
    // ioredis语法: set(key, value, 'PX', milliseconds, 'NX')
    const result = await this.client.set(lockKey, lockValue, 'PX', ttlMs, 'NX')
    return result === 'OK'
  } catch (error) {
    logger.error(`Failed to acquire lock ${lockKey}:`, error)
    return false
  }
}

redisClient.releaseAccountLock = async function (lockKey, lockValue) {
  try {
    // 使用Lua脚本确保只有持有锁的Proceso才能释放锁
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `
    // ioredis语法: eval(script, numberOfKeys, key1, key2, ..., arg1, arg2, ...)
    const result = await this.client.eval(script, 1, lockKey, lockValue)
    return result === 1
  } catch (error) {
    logger.error(`Failed to release lock ${lockKey}:`, error)
    return false
  }
}

// 导出Zona horaria辅助Función
redisClient.getDateInTimezone = getDateInTimezone
redisClient.getDateStringInTimezone = getDateStringInTimezone
redisClient.getHourInTimezone = getHourInTimezone
redisClient.getWeekStringInTimezone = getWeekStringInTimezone

// ============== Usuario消息Cola相关Método ==============

/**
 * 尝试ObtenerUsuario消息Cola锁
 * 使用 Lua 脚本保证原子性
 * @param {string} accountId - CuentaID
 * @param {string} requestId - SolicitudID
 * @param {number} lockTtlMs - 锁 TTL（毫秒）
 * @param {number} delayMs - Solicitud间隔（毫秒）
 * @returns {Promise<{acquired: boolean, waitMs: number}>}
 *   - acquired: 是否ÉxitoObtener锁
 *   - waitMs: 需要等待的毫秒数（-1Tabla示被占用需等待，>=0Tabla示需要延迟的毫秒数）
 */
redisClient.acquireUserMessageLock = async function (accountId, requestId, lockTtlMs, delayMs) {
  const lockKey = `user_msg_queue_lock:${accountId}`
  const lastTimeKey = `user_msg_queue_last:${accountId}`

  const script = `
    local lockKey = KEYS[1]
    local lastTimeKey = KEYS[2]
    local requestId = ARGV[1]
    local lockTtl = tonumber(ARGV[2])
    local delayMs = tonumber(ARGV[3])

    -- Verificar锁是否空闲
    local currentLock = redis.call('GET', lockKey)
    if currentLock == false then
      -- Verificar是否需要延迟
      local lastTime = redis.call('GET', lastTimeKey)
      local now = redis.call('TIME')
      local nowMs = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)

      if lastTime then
        local elapsed = nowMs - tonumber(lastTime)
        if elapsed < delayMs then
          -- 需要等待的毫秒数
          return {0, delayMs - elapsed}
        end
      end

      -- Obtener锁
      redis.call('SET', lockKey, requestId, 'PX', lockTtl)
      return {1, 0}
    end

    -- 锁被占用，Retornar等待
    return {0, -1}
  `

  try {
    const result = await this.client.eval(
      script,
      2,
      lockKey,
      lastTimeKey,
      requestId,
      lockTtlMs,
      delayMs
    )
    return {
      acquired: result[0] === 1,
      waitMs: result[1]
    }
  } catch (error) {
    logger.error(`Failed to acquire user message lock for account ${accountId}:`, error)
    // Retornar redisError 标记，让上层能区分 Redis 故障和正常锁占用
    return { acquired: false, waitMs: -1, redisError: true, errorMessage: error.message }
  }
}

/**
 * 释放Usuario消息Cola锁并RegistroCompletadoTiempo
 * @param {string} accountId - CuentaID
 * @param {string} requestId - SolicitudID
 * @returns {Promise<boolean>} 是否Éxito释放
 */
redisClient.releaseUserMessageLock = async function (accountId, requestId) {
  const lockKey = `user_msg_queue_lock:${accountId}`
  const lastTimeKey = `user_msg_queue_last:${accountId}`

  const script = `
    local lockKey = KEYS[1]
    local lastTimeKey = KEYS[2]
    local requestId = ARGV[1]

    -- Validar锁持有者
    local currentLock = redis.call('GET', lockKey)
    if currentLock == requestId then
      -- RegistroCompletadoTiempo
      local now = redis.call('TIME')
      local nowMs = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
      redis.call('SET', lastTimeKey, nowMs, 'EX', 60)  -- 60秒后过期

      -- Eliminar锁
      redis.call('DEL', lockKey)
      return 1
    end
    return 0
  `

  try {
    const result = await this.client.eval(script, 2, lockKey, lastTimeKey, requestId)
    return result === 1
  } catch (error) {
    logger.error(`Failed to release user message lock for account ${accountId}:`, error)
    return false
  }
}

/**
 * 强制释放Usuario消息Cola锁（用于Limpiar孤儿锁）
 * @param {string} accountId - CuentaID
 * @returns {Promise<boolean>} 是否Éxito释放
 */
redisClient.forceReleaseUserMessageLock = async function (accountId) {
  const lockKey = `user_msg_queue_lock:${accountId}`

  try {
    await this.client.del(lockKey)
    return true
  } catch (error) {
    logger.error(`Failed to force release user message lock for account ${accountId}:`, error)
    return false
  }
}

/**
 * ObtenerUsuario消息ColaEstadísticaInformación（用于Depurar）
 * @param {string} accountId - CuentaID
 * @returns {Promise<Object>} ColaEstadística
 */
redisClient.getUserMessageQueueStats = async function (accountId) {
  const lockKey = `user_msg_queue_lock:${accountId}`
  const lastTimeKey = `user_msg_queue_last:${accountId}`

  try {
    const [lockHolder, lastTime, lockTtl] = await Promise.all([
      this.client.get(lockKey),
      this.client.get(lastTimeKey),
      this.client.pttl(lockKey)
    ])

    return {
      accountId,
      isLocked: !!lockHolder,
      lockHolder,
      lockTtlMs: lockTtl > 0 ? lockTtl : 0,
      lockTtlRaw: lockTtl, // 原始 PTTL Valor：>0 有TTL，-1 无过期Tiempo，-2 键不存在
      lastCompletedAt: lastTime ? new Date(parseInt(lastTime)).toISOString() : null
    }
  } catch (error) {
    logger.error(`Failed to get user message queue stats for account ${accountId}:`, error)
    return {
      accountId,
      isLocked: false,
      lockHolder: null,
      lockTtlMs: 0,
      lockTtlRaw: -2,
      lastCompletedAt: null
    }
  }
}

/**
 * 扫描所有Usuario消息Cola锁（用于Limpiar任务）
 * @returns {Promise<string[]>} CuentaIDColumnaTabla
 */
redisClient.scanUserMessageQueueLocks = async function () {
  const accountIds = []
  let cursor = '0'
  let iterations = 0
  const MAX_ITERATIONS = 1000 // 防止无限Bucle

  try {
    do {
      const [newCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        'user_msg_queue_lock:*',
        'COUNT',
        100
      )
      cursor = newCursor
      iterations++

      for (const key of keys) {
        const accountId = key.replace('user_msg_queue_lock:', '')
        accountIds.push(accountId)
      }

      // 防止无限Bucle
      if (iterations >= MAX_ITERATIONS) {
        logger.warn(
          `📬 User message queue: SCAN reached max iterations (${MAX_ITERATIONS}), stopping early`,
          { foundLocks: accountIds.length }
        )
        break
      }
    } while (cursor !== '0')

    if (accountIds.length > 0) {
      logger.debug(
        `📬 User message queue: scanned ${accountIds.length} lock(s) in ${iterations} iteration(s)`
      )
    }

    return accountIds
  } catch (error) {
    logger.error('Failed to scan user message queue locks:', error)
    return []
  }
}

// ============================================
// 🚦 API Key ConcurrenciaSolicitud排队Método
// ============================================

/**
 * 增加排队计数（使用 Lua 脚本确保原子性）
 * @param {string} apiKeyId - API Key ID
 * @param {number} [timeoutMs=60000] - 排队Tiempo de espera agotadoTiempo（毫秒），用于Calcular TTL
 * @returns {Promise<number>} 增加后的排队数量
 */
redisClient.incrConcurrencyQueue = async function (apiKeyId, timeoutMs = 60000) {
  const key = `concurrency:queue:${apiKeyId}`
  try {
    // 使用 Lua 脚本确保 INCR 和 EXPIRE 原子Ejecutar，防止Proceso崩溃导致计数器泄漏
    // TTL = Tiempo de espera agotadoTiempo + 缓冲Tiempo（确保键不会在Solicitud还在等待时过期）
    const ttlSeconds = Math.ceil(timeoutMs / 1000) + QUEUE_TTL_BUFFER_SECONDS
    const script = `
      local count = redis.call('INCR', KEYS[1])
      redis.call('EXPIRE', KEYS[1], ARGV[1])
      return count
    `
    const count = await this.client.eval(script, 1, key, String(ttlSeconds))
    logger.database(
      `🚦 Incremented queue count for key ${apiKeyId}: ${count} (TTL: ${ttlSeconds}s)`
    )
    return parseInt(count)
  } catch (error) {
    logger.error(`Failed to increment concurrency queue for ${apiKeyId}:`, error)
    throw error
  }
}

/**
 * 减少排队计数（使用 Lua 脚本确保原子性）
 * @param {string} apiKeyId - API Key ID
 * @returns {Promise<number>} 减少后的排队数量
 */
redisClient.decrConcurrencyQueue = async function (apiKeyId) {
  const key = `concurrency:queue:${apiKeyId}`
  try {
    // 使用 Lua 脚本确保 DECR 和 DEL 原子Ejecutar，防止Proceso崩溃导致计数器残留
    const script = `
      local count = redis.call('DECR', KEYS[1])
      if count <= 0 then
        redis.call('DEL', KEYS[1])
        return 0
      end
      return count
    `
    const count = await this.client.eval(script, 1, key)
    const result = parseInt(count)
    if (result === 0) {
      logger.database(`🚦 Queue count for key ${apiKeyId} is 0, removed key`)
    } else {
      logger.database(`🚦 Decremented queue count for key ${apiKeyId}: ${result}`)
    }
    return result
  } catch (error) {
    logger.error(`Failed to decrement concurrency queue for ${apiKeyId}:`, error)
    throw error
  }
}

/**
 * Obtener排队计数
 * @param {string} apiKeyId - API Key ID
 * @returns {Promise<number>} 当前排队数量
 */
redisClient.getConcurrencyQueueCount = async function (apiKeyId) {
  const key = `concurrency:queue:${apiKeyId}`
  try {
    const count = await this.client.get(key)
    return parseInt(count || 0)
  } catch (error) {
    logger.error(`Failed to get concurrency queue count for ${apiKeyId}:`, error)
    return 0
  }
}

/**
 * 清空排队计数
 * @param {string} apiKeyId - API Key ID
 * @returns {Promise<boolean>} 是否Éxito清空
 */
redisClient.clearConcurrencyQueue = async function (apiKeyId) {
  const key = `concurrency:queue:${apiKeyId}`
  try {
    await this.client.del(key)
    logger.database(`🚦 Cleared queue count for key ${apiKeyId}`)
    return true
  } catch (error) {
    logger.error(`Failed to clear concurrency queue for ${apiKeyId}:`, error)
    return false
  }
}

/**
 * 扫描所有排队计数器
 * @returns {Promise<string[]>} API Key ID ColumnaTabla
 */
redisClient.scanConcurrencyQueueKeys = async function () {
  const apiKeyIds = []
  let cursor = '0'
  let iterations = 0
  const MAX_ITERATIONS = 1000

  try {
    do {
      const [newCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        'concurrency:queue:*',
        'COUNT',
        100
      )
      cursor = newCursor
      iterations++

      for (const key of keys) {
        // ExcluirEstadística和等待Tiempo相关的键
        if (
          key.startsWith('concurrency:queue:stats:') ||
          key.startsWith('concurrency:queue:wait_times:')
        ) {
          continue
        }
        const apiKeyId = key.replace('concurrency:queue:', '')
        apiKeyIds.push(apiKeyId)
      }

      if (iterations >= MAX_ITERATIONS) {
        logger.warn(
          `🚦 Concurrency queue: SCAN reached max iterations (${MAX_ITERATIONS}), stopping early`,
          { foundQueues: apiKeyIds.length }
        )
        break
      }
    } while (cursor !== '0')

    return apiKeyIds
  } catch (error) {
    logger.error('Failed to scan concurrency queue keys:', error)
    return []
  }
}

/**
 * Limpiar所有排队计数器（用于Servicio重启）
 * @returns {Promise<number>} Limpiar的计数器数量
 */
redisClient.clearAllConcurrencyQueues = async function () {
  let cleared = 0
  let cursor = '0'
  let iterations = 0
  const MAX_ITERATIONS = 1000

  try {
    do {
      const [newCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        'concurrency:queue:*',
        'COUNT',
        100
      )
      cursor = newCursor
      iterations++

      // 只Eliminar排队计数器，保留EstadísticaDatos
      const queueKeys = keys.filter(
        (key) =>
          !key.startsWith('concurrency:queue:stats:') &&
          !key.startsWith('concurrency:queue:wait_times:')
      )

      if (queueKeys.length > 0) {
        await this.client.del(...queueKeys)
        cleared += queueKeys.length
      }

      if (iterations >= MAX_ITERATIONS) {
        break
      }
    } while (cursor !== '0')

    if (cleared > 0) {
      logger.info(`🚦 Cleared ${cleared} concurrency queue counter(s) on startup`)
    }
    return cleared
  } catch (error) {
    logger.error('Failed to clear all concurrency queues:', error)
    return 0
  }
}

/**
 * 增加排队Estadística计数（使用 Lua 脚本确保原子性）
 * @param {string} apiKeyId - API Key ID
 * @param {string} field - EstadísticaCampo (entered/success/timeout/cancelled)
 * @returns {Promise<number>} 增加后的计数
 */
redisClient.incrConcurrencyQueueStats = async function (apiKeyId, field) {
  const key = `concurrency:queue:stats:${apiKeyId}`
  try {
    // 使用 Lua 脚本确保 HINCRBY 和 EXPIRE 原子Ejecutar
    // 防止在两者之间崩溃导致Estadística键没有 TTL（内存泄漏）
    const script = `
      local count = redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
      redis.call('EXPIRE', KEYS[1], ARGV[2])
      return count
    `
    const count = await this.client.eval(script, 1, key, field, String(QUEUE_STATS_TTL_SECONDS))
    return parseInt(count)
  } catch (error) {
    logger.error(`Failed to increment queue stats ${field} for ${apiKeyId}:`, error)
    return 0
  }
}

/**
 * Obtener排队Estadística
 * @param {string} apiKeyId - API Key ID
 * @returns {Promise<Object>} EstadísticaDatos
 */
redisClient.getConcurrencyQueueStats = async function (apiKeyId) {
  const key = `concurrency:queue:stats:${apiKeyId}`
  try {
    const stats = await this.client.hgetall(key)
    return {
      entered: parseInt(stats?.entered || 0),
      success: parseInt(stats?.success || 0),
      timeout: parseInt(stats?.timeout || 0),
      cancelled: parseInt(stats?.cancelled || 0),
      socket_changed: parseInt(stats?.socket_changed || 0),
      rejected_overload: parseInt(stats?.rejected_overload || 0)
    }
  } catch (error) {
    logger.error(`Failed to get queue stats for ${apiKeyId}:`, error)
    return {
      entered: 0,
      success: 0,
      timeout: 0,
      cancelled: 0,
      socket_changed: 0,
      rejected_overload: 0
    }
  }
}

/**
 * Registro排队等待Tiempo（按 API Key 分开存储）
 * @param {string} apiKeyId - API Key ID
 * @param {number} waitTimeMs - 等待Tiempo（毫秒）
 * @returns {Promise<void>}
 */
redisClient.recordQueueWaitTime = async function (apiKeyId, waitTimeMs) {
  const key = `concurrency:queue:wait_times:${apiKeyId}`
  try {
    // 使用 Lua 脚本确保原子性，同时Establecer TTL 防止内存泄漏
    const script = `
      redis.call('LPUSH', KEYS[1], ARGV[1])
      redis.call('LTRIM', KEYS[1], 0, ARGV[2])
      redis.call('EXPIRE', KEYS[1], ARGV[3])
      return 1
    `
    await this.client.eval(
      script,
      1,
      key,
      waitTimeMs,
      WAIT_TIME_SAMPLES_PER_KEY - 1,
      WAIT_TIME_TTL_SECONDS
    )
  } catch (error) {
    logger.error(`Failed to record queue wait time for ${apiKeyId}:`, error)
  }
}

/**
 * Registro全局排队等待Tiempo
 * @param {number} waitTimeMs - 等待Tiempo（毫秒）
 * @returns {Promise<void>}
 */
redisClient.recordGlobalQueueWaitTime = async function (waitTimeMs) {
  const key = 'concurrency:queue:wait_times:global'
  try {
    // 使用 Lua 脚本确保原子性，同时Establecer TTL 防止内存泄漏
    const script = `
      redis.call('LPUSH', KEYS[1], ARGV[1])
      redis.call('LTRIM', KEYS[1], 0, ARGV[2])
      redis.call('EXPIRE', KEYS[1], ARGV[3])
      return 1
    `
    await this.client.eval(
      script,
      1,
      key,
      waitTimeMs,
      WAIT_TIME_SAMPLES_GLOBAL - 1,
      WAIT_TIME_TTL_SECONDS
    )
  } catch (error) {
    logger.error('Failed to record global queue wait time:', error)
  }
}

/**
 * Obtener全局等待TiempoColumnaTabla
 * @returns {Promise<number[]>} 等待TiempoColumnaTabla
 */
redisClient.getGlobalQueueWaitTimes = async function () {
  const key = 'concurrency:queue:wait_times:global'
  try {
    const samples = await this.client.lrange(key, 0, -1)
    return samples.map(Number)
  } catch (error) {
    logger.error('Failed to get global queue wait times:', error)
    return []
  }
}

/**
 * Obtener指定 API Key 的等待TiempoColumnaTabla
 * @param {string} apiKeyId - API Key ID
 * @returns {Promise<number[]>} 等待TiempoColumnaTabla
 */
redisClient.getQueueWaitTimes = async function (apiKeyId) {
  const key = `concurrency:queue:wait_times:${apiKeyId}`
  try {
    const samples = await this.client.lrange(key, 0, -1)
    return samples.map(Number)
  } catch (error) {
    logger.error(`Failed to get queue wait times for ${apiKeyId}:`, error)
    return []
  }
}

/**
 * 扫描所有排队Estadística键
 * @returns {Promise<string[]>} API Key ID ColumnaTabla
 */
redisClient.scanConcurrencyQueueStatsKeys = async function () {
  const apiKeyIds = []
  let cursor = '0'
  let iterations = 0
  const MAX_ITERATIONS = 1000

  try {
    do {
      const [newCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        'concurrency:queue:stats:*',
        'COUNT',
        100
      )
      cursor = newCursor
      iterations++

      for (const key of keys) {
        const apiKeyId = key.replace('concurrency:queue:stats:', '')
        apiKeyIds.push(apiKeyId)
      }

      if (iterations >= MAX_ITERATIONS) {
        break
      }
    } while (cursor !== '0')

    return apiKeyIds
  } catch (error) {
    logger.error('Failed to scan concurrency queue stats keys:', error)
    return []
  }
}

// ============================================================================
// CuentaProbar历史相关Operación
// ============================================================================

const ACCOUNT_TEST_HISTORY_MAX = 5 // 保留最近5次ProbarRegistro
const ACCOUNT_TEST_HISTORY_TTL = 86400 * 30 // 30天过期
const ACCOUNT_TEST_CONFIG_TTL = 86400 * 365 // ProbarConfiguración保留1年（Usuario通常长期使用）

/**
 * 保存CuentaProbar结果
 * @param {string} accountId - CuentaID
 * @param {string} platform - 平台Tipo (claude/gemini/openai等)
 * @param {Object} testResult - Probar结果Objeto
 * @param {boolean} testResult.success - 是否Éxito
 * @param {string} testResult.message - Probar消息/Respuesta
 * @param {number} testResult.latencyMs - 延迟毫秒数
 * @param {string} testResult.error - ErrorInformación（如有）
 * @param {string} testResult.timestamp - ProbarTiempo戳
 */
redisClient.saveAccountTestResult = async function (accountId, platform, testResult) {
  const key = `account:test_history:${platform}:${accountId}`
  try {
    const record = JSON.stringify({
      ...testResult,
      timestamp: testResult.timestamp || new Date().toISOString()
    })

    // 使用 LPUSH + LTRIM 保持最近5条Registro
    const client = this.getClientSafe()
    await client.lpush(key, record)
    await client.ltrim(key, 0, ACCOUNT_TEST_HISTORY_MAX - 1)
    await client.expire(key, ACCOUNT_TEST_HISTORY_TTL)

    logger.debug(`📝 Saved test result for ${platform} account ${accountId}`)
  } catch (error) {
    logger.error(`Failed to save test result for ${accountId}:`, error)
  }
}

/**
 * ObtenerCuentaProbar历史
 * @param {string} accountId - CuentaID
 * @param {string} platform - 平台Tipo
 * @returns {Promise<Array>} Probar历史RegistroArreglo（最新在前）
 */
redisClient.getAccountTestHistory = async function (accountId, platform) {
  const key = `account:test_history:${platform}:${accountId}`
  try {
    const client = this.getClientSafe()
    const records = await client.lrange(key, 0, -1)
    return records.map((r) => JSON.parse(r))
  } catch (error) {
    logger.error(`Failed to get test history for ${accountId}:`, error)
    return []
  }
}

/**
 * ObtenerCuenta最新Probar结果
 * @param {string} accountId - CuentaID
 * @param {string} platform - 平台Tipo
 * @returns {Promise<Object|null>} 最新Probar结果
 */
redisClient.getAccountLatestTestResult = async function (accountId, platform) {
  const key = `account:test_history:${platform}:${accountId}`
  try {
    const client = this.getClientSafe()
    const record = await client.lindex(key, 0)
    return record ? JSON.parse(record) : null
  } catch (error) {
    logger.error(`Failed to get latest test result for ${accountId}:`, error)
    return null
  }
}

/**
 * 批量Obtener多个Cuenta的Probar历史
 * @param {Array<{accountId: string, platform: string}>} accounts - CuentaColumnaTabla
 * @returns {Promise<Object>} 以 accountId 为 key 的Probar历史映射
 */
redisClient.getAccountsTestHistory = async function (accounts) {
  const result = {}
  try {
    const client = this.getClientSafe()
    const pipeline = client.pipeline()

    for (const { accountId, platform } of accounts) {
      const key = `account:test_history:${platform}:${accountId}`
      pipeline.lrange(key, 0, -1)
    }

    const responses = await pipeline.exec()

    accounts.forEach(({ accountId }, index) => {
      const [err, records] = responses[index]
      if (!err && records) {
        result[accountId] = records.map((r) => JSON.parse(r))
      } else {
        result[accountId] = []
      }
    })
  } catch (error) {
    logger.error('Failed to get batch test history:', error)
  }
  return result
}

/**
 * 保存定时ProbarConfiguración
 * @param {string} accountId - CuentaID
 * @param {string} platform - 平台Tipo
 * @param {Object} config - ConfiguraciónObjeto
 * @param {boolean} config.enabled - 是否Habilitar定时Probar
 * @param {string} config.cronExpression - Cron Tabla达式 (如 "0 8 * * *" Tabla示每天8点)
 * @param {string} config.model - Probar使用的模型
 */
redisClient.saveAccountTestConfig = async function (accountId, platform, testConfig) {
  const key = `account:test_config:${platform}:${accountId}`
  try {
    const client = this.getClientSafe()
    await client.hset(key, {
      enabled: testConfig.enabled ? 'true' : 'false',
      cronExpression: testConfig.cronExpression || '0 8 * * *', // Predeterminado每天早上8点
      model: testConfig.model || 'claude-sonnet-4-5-20250929', // Predeterminado模型
      updatedAt: new Date().toISOString()
    })
    // Establecer过期Tiempo（1年）
    await client.expire(key, ACCOUNT_TEST_CONFIG_TTL)
  } catch (error) {
    logger.error(`Failed to save test config for ${accountId}:`, error)
  }
}

/**
 * Obtener定时ProbarConfiguración
 * @param {string} accountId - CuentaID
 * @param {string} platform - 平台Tipo
 * @returns {Promise<Object|null>} ConfiguraciónObjeto
 */
redisClient.getAccountTestConfig = async function (accountId, platform) {
  const key = `account:test_config:${platform}:${accountId}`
  try {
    const client = this.getClientSafe()
    const testConfig = await client.hgetall(key)
    if (!testConfig || Object.keys(testConfig).length === 0) {
      return null
    }
    // 向后兼容：如果存在旧的 testHour Campo，Convertir为 cron Tabla达式
    let { cronExpression } = testConfig
    if (!cronExpression && testConfig.testHour) {
      const hour = parseInt(testConfig.testHour, 10)
      cronExpression = `0 ${hour} * * *`
    }
    return {
      enabled: testConfig.enabled === 'true',
      cronExpression: cronExpression || '0 8 * * *',
      model: testConfig.model || 'claude-sonnet-4-5-20250929',
      updatedAt: testConfig.updatedAt
    }
  } catch (error) {
    logger.error(`Failed to get test config for ${accountId}:`, error)
    return null
  }
}

/**
 * Obtener所有Habilitar定时Probar的Cuenta
 * @param {string} platform - 平台Tipo
 * @returns {Promise<Array>} CuentaIDColumnaTabla及 cron Configuración
 */
redisClient.getEnabledTestAccounts = async function (platform) {
  const accountIds = []
  let cursor = '0'

  try {
    const client = this.getClientSafe()
    do {
      const [newCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        `account:test_config:${platform}:*`,
        'COUNT',
        100
      )
      cursor = newCursor

      for (const key of keys) {
        const testConfig = await client.hgetall(key)
        if (testConfig && testConfig.enabled === 'true') {
          const accountId = key.replace(`account:test_config:${platform}:`, '')
          // 向后兼容：如果存在旧的 testHour Campo，Convertir为 cron Tabla达式
          let { cronExpression } = testConfig
          if (!cronExpression && testConfig.testHour) {
            const hour = parseInt(testConfig.testHour, 10)
            cronExpression = `0 ${hour} * * *`
          }
          accountIds.push({
            accountId,
            cronExpression: cronExpression || '0 8 * * *',
            model: testConfig.model || 'claude-sonnet-4-5-20250929'
          })
        }
      }
    } while (cursor !== '0')

    return accountIds
  } catch (error) {
    logger.error(`Failed to get enabled test accounts for ${platform}:`, error)
    return []
  }
}

/**
 * 保存Cuenta上次ProbarTiempo（用于调度器判断是否需要Probar）
 * @param {string} accountId - CuentaID
 * @param {string} platform - 平台Tipo
 */
redisClient.setAccountLastTestTime = async function (accountId, platform) {
  const key = `account:last_test:${platform}:${accountId}`
  try {
    const client = this.getClientSafe()
    await client.set(key, Date.now().toString(), 'EX', 86400 * 7) // 7天过期
  } catch (error) {
    logger.error(`Failed to set last test time for ${accountId}:`, error)
  }
}

/**
 * ObtenerCuenta上次ProbarTiempo
 * @param {string} accountId - CuentaID
 * @param {string} platform - 平台Tipo
 * @returns {Promise<number|null>} 上次ProbarTiempo戳
 */
redisClient.getAccountLastTestTime = async function (accountId, platform) {
  const key = `account:last_test:${platform}:${accountId}`
  try {
    const client = this.getClientSafe()
    const timestamp = await client.get(key)
    return timestamp ? parseInt(timestamp, 10) : null
  } catch (error) {
    logger.error(`Failed to get last test time for ${accountId}:`, error)
    return null
  }
}

/**
 * 使用 SCAN Obtener匹配模式的所有 keys（避免 KEYS 命令Bloqueante Redis）
 * @param {string} pattern - 匹配模式，如 'usage:model:daily:*:2025-01-01'
 * @param {number} batchSize - 每次 SCAN 的数量，Predeterminado 200
 * @returns {Promise<string[]>} 匹配的 key ColumnaTabla
 */
redisClient.scanKeys = async function (pattern, batchSize = 200) {
  const keys = []
  let cursor = '0'
  const client = this.getClientSafe()

  do {
    const [newCursor, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize)
    cursor = newCursor
    keys.push(...batch)
  } while (cursor !== '0')

  // 去重（SCAN 可能Retornar重复 key）
  return [...new Set(keys)]
}

/**
 * 批量 HGETALL（使用 Pipeline 减少网络往返）
 * @param {string[]} keys - 要Obtener的 key ColumnaTabla
 * @returns {Promise<Object[]>} 每个 key 对应的Datos，Falló的Retornar null
 */
redisClient.batchHgetall = async function (keys) {
  if (!keys || keys.length === 0) {
    return []
  }

  const client = this.getClientSafe()
  const pipeline = client.pipeline()
  keys.forEach((k) => pipeline.hgetall(k))
  const results = await pipeline.exec()

  return results.map(([err, data]) => (err ? null : data))
}

/**
 * 使用 SCAN + Pipeline Obtener匹配模式的所有Datos
 * @param {string} pattern - 匹配模式
 * @param {number} batchSize - SCAN 批次大小
 * @returns {Promise<{key: string, data: Object}[]>} key 和Datos的Arreglo
 */
redisClient.scanAndGetAll = async function (pattern, batchSize = 200) {
  const keys = await this.scanKeys(pattern, batchSize)
  if (keys.length === 0) {
    return []
  }

  const dataList = await this.batchHgetall(keys)
  return keys.map((key, i) => ({ key, data: dataList[i] })).filter((item) => item.data !== null)
}

/**
 * 批量Obtener多个 API Key 的使用Estadística、费用、Concurrencia等Datos
 * @param {string[]} keyIds - API Key ID ColumnaTabla
 * @returns {Promise<Map<string, Object>>} keyId -> EstadísticaDatos的映射
 */
redisClient.batchGetApiKeyStats = async function (keyIds) {
  if (!keyIds || keyIds.length === 0) {
    return new Map()
  }

  const client = this.getClientSafe()
  const today = getDateStringInTimezone()
  const tzDate = getDateInTimezone()
  const currentMonth = `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(2, '0')}`
  const currentWeek = getWeekStringInTimezone()
  const currentHour = `${today}:${String(getHourInTimezone(new Date())).padStart(2, '0')}`

  const pipeline = client.pipeline()

  // 为每个 keyId 添加所有需要的Consulta
  for (const keyId of keyIds) {
    // usage stats (3 hgetall)
    pipeline.hgetall(`usage:${keyId}`)
    pipeline.hgetall(`usage:daily:${keyId}:${today}`)
    pipeline.hgetall(`usage:monthly:${keyId}:${currentMonth}`)
    // cost stats (4 get)
    pipeline.get(`usage:cost:daily:${keyId}:${today}`)
    pipeline.get(`usage:cost:monthly:${keyId}:${currentMonth}`)
    pipeline.get(`usage:cost:hourly:${keyId}:${currentHour}`)
    pipeline.get(`usage:cost:total:${keyId}`)
    // concurrency (1 zcard)
    pipeline.zcard(`concurrency:${keyId}`)
    // weekly opus cost (1 get)
    pipeline.get(`usage:opus:weekly:${keyId}:${currentWeek}`)
    // rate limit (4 get)
    pipeline.get(`rate_limit:requests:${keyId}`)
    pipeline.get(`rate_limit:tokens:${keyId}`)
    pipeline.get(`rate_limit:cost:${keyId}`)
    pipeline.get(`rate_limit:window_start:${keyId}`)
    // apikey data for createdAt (1 hgetall)
    pipeline.hgetall(`apikey:${keyId}`)
  }

  const results = await pipeline.exec()
  const statsMap = new Map()
  const FIELDS_PER_KEY = 14

  for (let i = 0; i < keyIds.length; i++) {
    const keyId = keyIds[i]
    const offset = i * FIELDS_PER_KEY

    const [
      [, usageTotal],
      [, usageDaily],
      [, usageMonthly],
      [, costDaily],
      [, costMonthly],
      [, costHourly],
      [, costTotal],
      [, concurrency],
      [, weeklyOpusCost],
      [, rateLimitRequests],
      [, rateLimitTokens],
      [, rateLimitCost],
      [, rateLimitWindowStart],
      [, keyData]
    ] = results.slice(offset, offset + FIELDS_PER_KEY)

    statsMap.set(keyId, {
      usageTotal: usageTotal || {},
      usageDaily: usageDaily || {},
      usageMonthly: usageMonthly || {},
      costStats: {
        daily: parseFloat(costDaily || 0),
        monthly: parseFloat(costMonthly || 0),
        hourly: parseFloat(costHourly || 0),
        total: parseFloat(costTotal || 0)
      },
      concurrency: concurrency || 0,
      dailyCost: parseFloat(costDaily || 0),
      weeklyOpusCost: parseFloat(weeklyOpusCost || 0),
      rateLimit: {
        requests: parseInt(rateLimitRequests || 0),
        tokens: parseInt(rateLimitTokens || 0),
        cost: parseFloat(rateLimitCost || 0),
        windowStart: rateLimitWindowStart ? parseInt(rateLimitWindowStart) : null
      },
      createdAt: keyData?.createdAt || null
    })
  }

  return statsMap
}

/**
 * 分批 HGETALL（避免单次 pipeline 体积过大导致内存峰Valor）
 * @param {string[]} keys - 要Obtener的 key ColumnaTabla
 * @param {number} chunkSize - 每批大小，Predeterminado 500
 * @returns {Promise<Object[]>} 每个 key 对应的Datos，Falló的Retornar null
 */
redisClient.batchHgetallChunked = async function (keys, chunkSize = 500) {
  if (!keys || keys.length === 0) {
    return []
  }
  if (keys.length <= chunkSize) {
    return this.batchHgetall(keys)
  }

  const results = []
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize)
    const chunkResults = await this.batchHgetall(chunk)
    results.push(...chunkResults)
  }
  return results
}

/**
 * 分批 GET（避免单次 pipeline 体积过大）
 * @param {string[]} keys - 要Obtener的 key ColumnaTabla
 * @param {number} chunkSize - 每批大小，Predeterminado 500
 * @returns {Promise<(string|null)[]>} 每个 key 对应的Valor
 */
redisClient.batchGetChunked = async function (keys, chunkSize = 500) {
  if (!keys || keys.length === 0) {
    return []
  }

  const client = this.getClientSafe()
  if (keys.length <= chunkSize) {
    const pipeline = client.pipeline()
    keys.forEach((k) => pipeline.get(k))
    const results = await pipeline.exec()
    return results.map(([err, val]) => (err ? null : val))
  }

  const results = []
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize)
    const pipeline = client.pipeline()
    chunk.forEach((k) => pipeline.get(k))
    const chunkResults = await pipeline.exec()
    results.push(...chunkResults.map(([err, val]) => (err ? null : val)))
  }
  return results
}

/**
 * SCAN + 分批Procesar（边扫描边Procesar，避免全量 keys 堆内存）
 * @param {string} pattern - 匹配模式
 * @param {Function} processor - ProcesarFunción (keys: string[], dataList: Object[]) => void
 * @param {Object} options - Configuración选项
 * @param {number} options.scanBatchSize - SCAN 每次Retornar数量，Predeterminado 200
 * @param {number} options.processBatchSize - Procesar批次大小，Predeterminado 500
 * @param {string} options.fetchType - ObtenerTipo：'hgetall' | 'get' | 'none'，Predeterminado 'hgetall'
 */
redisClient.scanAndProcess = async function (pattern, processor, options = {}) {
  const { scanBatchSize = 200, processBatchSize = 500, fetchType = 'hgetall' } = options
  const client = this.getClientSafe()

  let cursor = '0'
  let pendingKeys = []
  const processedKeys = new Set() // 全程去重

  const processBatch = async (keys) => {
    if (keys.length === 0) {
      return
    }

    // Filtrar已Procesar的 key
    const uniqueKeys = keys.filter((k) => !processedKeys.has(k))
    if (uniqueKeys.length === 0) {
      return
    }

    uniqueKeys.forEach((k) => processedKeys.add(k))

    let dataList = []
    if (fetchType === 'hgetall') {
      dataList = await this.batchHgetall(uniqueKeys)
    } else if (fetchType === 'get') {
      const pipeline = client.pipeline()
      uniqueKeys.forEach((k) => pipeline.get(k))
      const results = await pipeline.exec()
      dataList = results.map(([err, val]) => (err ? null : val))
    } else {
      dataList = uniqueKeys.map(() => null) // fetchType === 'none'
    }

    await processor(uniqueKeys, dataList)
  }

  do {
    const [newCursor, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', scanBatchSize)
    cursor = newCursor
    pendingKeys.push(...batch)

    // 达到Procesar批次大小时Procesar
    while (pendingKeys.length >= processBatchSize) {
      const toProcess = pendingKeys.slice(0, processBatchSize)
      pendingKeys = pendingKeys.slice(processBatchSize)
      await processBatch(toProcess)
    }
  } while (cursor !== '0')

  // Procesar剩余的 keys
  if (pendingKeys.length > 0) {
    await processBatch(pendingKeys)
  }
}

/**
 * SCAN + 分批Obtener所有Datos（Retornar结果，适合需要聚合的场景）
 * @param {string} pattern - 匹配模式
 * @param {Object} options - Configuración选项
 * @returns {Promise<{key: string, data: Object}[]>} key 和Datos的Arreglo
 */
redisClient.scanAndGetAllChunked = async function (pattern, options = {}) {
  const results = []
  await this.scanAndProcess(
    pattern,
    (keys, dataList) => {
      keys.forEach((key, i) => {
        if (dataList[i] !== null) {
          results.push({ key, data: dataList[i] })
        }
      })
    },
    { ...options, fetchType: 'hgetall' }
  )
  return results
}

/**
 * 分批Eliminar keys（避免大量 DEL Bloqueante）
 * @param {string[]} keys - 要Eliminar的 key ColumnaTabla
 * @param {number} chunkSize - 每批大小，Predeterminado 500
 * @returns {Promise<number>} Eliminar的 key 数量
 */
redisClient.batchDelChunked = async function (keys, chunkSize = 500) {
  if (!keys || keys.length === 0) {
    return 0
  }

  const client = this.getClientSafe()
  let deleted = 0

  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize)
    const pipeline = client.pipeline()
    chunk.forEach((k) => pipeline.del(k))
    const results = await pipeline.exec()
    deleted += results.filter(([err, val]) => !err && val > 0).length
  }

  return deleted
}

/**
 * 通用Índice辅助Función：Obtener所有 ID（优先Índice，Retirada SCAN）
 * @param {string} indexKey - Índice Set 的 key
 * @param {string} scanPattern - SCAN 的 pattern
 * @param {RegExp} extractRegex - 从 key 中提取 ID 的正则
 * @returns {Promise<string[]>} ID ColumnaTabla
 */
redisClient.getAllIdsByIndex = async function (indexKey, scanPattern, extractRegex) {
  const client = this.getClientSafe()
  // Verificar是否已标记为空（避免重复 SCAN）
  const emptyMarker = await client.get(`${indexKey}:empty`)
  if (emptyMarker === '1') {
    return []
  }
  let ids = await client.smembers(indexKey)
  if (ids && ids.length > 0) {
    return ids
  }
  // Retirada到 SCAN（仅首次）
  const keys = await this.scanKeys(scanPattern)
  if (keys.length === 0) {
    // 标记为空，避免重复 SCAN（1小时过期，允许新DatosEscribir后重新检测）
    await client.setex(`${indexKey}:empty`, 3600, '1')
    return []
  }
  ids = keys
    .map((k) => {
      const match = k.match(extractRegex)
      return match ? match[1] : null
    })
    .filter(Boolean)
  // 建立Índice
  if (ids.length > 0) {
    await client.sadd(indexKey, ...ids)
  }
  return ids
}

/**
 * 添加到Índice
 */
redisClient.addToIndex = async function (indexKey, id) {
  const client = this.getClientSafe()
  await client.sadd(indexKey, id)
  // 清除空标记（如果存在）
  await client.del(`${indexKey}:empty`)
}

/**
 * 从ÍndiceEliminación
 */
redisClient.removeFromIndex = async function (indexKey, id) {
  const client = this.getClientSafe()
  await client.srem(indexKey, id)
}

// ============================================
// DatosMigración相关
// ============================================

// Migración全局EstadísticaDatos（从 API Key Datos聚合）
redisClient.migrateGlobalStats = async function () {
  logger.info('🔄 IniciandoMigración全局EstadísticaDatos...')

  const keyIds = await this.scanApiKeyIds()
  if (!keyIds || keyIds.length === 0) {
    logger.info('📊 没有 API Key Datos需要Migración')
    return { success: true, migrated: 0 }
  }

  const total = {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreateTokens: 0,
    cacheReadTokens: 0,
    allTokens: 0
  }

  // 批量Obtener所有 usage Datos
  const pipeline = this.client.pipeline()
  keyIds.forEach((id) => pipeline.hgetall(`usage:${id}`))
  const results = await pipeline.exec()

  results.forEach(([err, usage]) => {
    if (err || !usage) {
      return
    }
    // 兼容新旧CampoFormato（带 total 前缀和不带的）
    total.requests += parseInt(usage.totalRequests || usage.requests) || 0
    total.inputTokens += parseInt(usage.totalInputTokens || usage.inputTokens) || 0
    total.outputTokens += parseInt(usage.totalOutputTokens || usage.outputTokens) || 0
    total.cacheCreateTokens +=
      parseInt(usage.totalCacheCreateTokens || usage.cacheCreateTokens) || 0
    total.cacheReadTokens += parseInt(usage.totalCacheReadTokens || usage.cacheReadTokens) || 0
    total.allTokens += parseInt(usage.totalAllTokens || usage.allTokens || usage.totalTokens) || 0
  })

  // Escribir全局Estadística
  await this.client.hset('usage:global:total', total)

  // Migración月份Índice（从现有的 usage:model:monthly:* key 中提取月份）
  const monthlyKeys = await this.client.keys('usage:model:monthly:*')
  const months = new Set()
  for (const key of monthlyKeys) {
    const match = key.match(/:(\d{4}-\d{2})$/)
    if (match) {
      months.add(match[1])
    }
  }
  if (months.size > 0) {
    await this.client.sadd('usage:model:monthly:months', ...months)
    logger.info(`📅 Migración月份Índice: ${months.size} 个月份 (${[...months].sort().join(', ')})`)
  }

  logger.success(
    `✅ MigraciónCompletado: ${keyIds.length} 个 API Key, ${total.requests} Solicitud, ${total.allTokens} tokens`
  )
  return { success: true, migrated: keyIds.length, total }
}

// 确保月份Índice完整（后台Verificar，补充缺失的月份）
redisClient.ensureMonthlyMonthsIndex = async function () {
  // 扫描所有月份 key
  const monthlyKeys = await this.client.keys('usage:model:monthly:*')
  const allMonths = new Set()
  for (const key of monthlyKeys) {
    const match = key.match(/:(\d{4}-\d{2})$/)
    if (match) {
      allMonths.add(match[1])
    }
  }

  if (allMonths.size === 0) {
    return // 没有月份Datos
  }

  // ObtenerÍndice中已有的月份
  const existingMonths = await this.client.smembers('usage:model:monthly:months')
  const existingSet = new Set(existingMonths)

  // 找出缺失的月份
  const missingMonths = [...allMonths].filter((m) => !existingSet.has(m))

  if (missingMonths.length > 0) {
    await this.client.sadd('usage:model:monthly:months', ...missingMonths)
    logger.info(
      `📅 补充月份Índice: ${missingMonths.length} 个月份 (${missingMonths.sort().join(', ')})`
    )
  }
}

// Verificar是否需要Migración
redisClient.needsGlobalStatsMigration = async function () {
  const exists = await this.client.exists('usage:global:total')
  return exists === 0
}

// Obtener已MigraciónVersión
redisClient.getMigratedVersion = async function () {
  return (await this.client.get('system:migrated:version')) || '0.0.0'
}

// Establecer已MigraciónVersión
redisClient.setMigratedVersion = async function (version) {
  await this.client.set('system:migrated:version', version)
}

// Obtener全局Estadística（用于 dashboard 快速Consulta）
redisClient.getGlobalStats = async function () {
  const stats = await this.client.hgetall('usage:global:total')
  if (!stats || !stats.requests) {
    return null
  }
  return {
    requests: parseInt(stats.requests) || 0,
    inputTokens: parseInt(stats.inputTokens) || 0,
    outputTokens: parseInt(stats.outputTokens) || 0,
    cacheCreateTokens: parseInt(stats.cacheCreateTokens) || 0,
    cacheReadTokens: parseInt(stats.cacheReadTokens) || 0,
    allTokens: parseInt(stats.allTokens) || 0
  }
}

// 快速Obtener API Key 计数（不拉全量Datos）
redisClient.getApiKeyCount = async function () {
  const keyIds = await this.scanApiKeyIds()
  if (!keyIds || keyIds.length === 0) {
    return { total: 0, active: 0 }
  }

  // 批量Obtener isActive Campo
  const pipeline = this.client.pipeline()
  keyIds.forEach((id) => pipeline.hget(`apikey:${id}`, 'isActive'))
  const results = await pipeline.exec()

  let active = 0
  results.forEach(([err, val]) => {
    if (!err && (val === 'true' || val === true)) {
      active++
    }
  })
  return { total: keyIds.length, active }
}

// Limpiar过期的系统分钟EstadísticaDatos（启动时调用）
redisClient.cleanupSystemMetrics = async function () {
  logger.info('🧹 Limpiar过期的系统分钟EstadísticaDatos...')

  const keys = await this.scanKeys('system:metrics:minute:*')
  if (!keys || keys.length === 0) {
    logger.info('📊 没有需要Limpiar的系统分钟EstadísticaDatos')
    return { cleaned: 0 }
  }

  // Calcular当前分钟Tiempo戳和保留窗口
  const metricsWindow = config.system?.metricsWindow || 5
  const currentMinute = Math.floor(Date.now() / 60000)
  const keepAfter = currentMinute - metricsWindow * 2 // 保留窗口的2倍

  // 筛选需要Eliminar的 key
  const toDelete = keys.filter((key) => {
    const match = key.match(/system:metrics:minute:(\d+)/)
    if (!match) {
      return false
    }
    const minute = parseInt(match[1])
    return minute < keepAfter
  })

  if (toDelete.length === 0) {
    logger.info('📊 没有过期的系统分钟EstadísticaDatos')
    return { cleaned: 0 }
  }

  // 分批Eliminar
  const batchSize = 1000
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize)
    await this.client.del(...batch)
  }

  logger.success(
    `✅ LimpiarCompletado: Eliminar ${toDelete.length} 个过期的系统分钟Estadística key`
  )
  return { cleaned: toDelete.length }
}

module.exports = redisClient
