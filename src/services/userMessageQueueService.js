/**
 * Usuario消息ColaServicio
 * 为 Claude Cuenta实现基于消息Tipo的串Fila排队机制
 *
 * 当Solicitud的最后一条消息是Usuario输入（role: user）时，
 * 同一Cuenta的此ClaseSolicitud需要串Fila等待，并在Solicitud之间添加延迟
 */

const { v4: uuidv4 } = require('uuid')
const redis = require('../models/redis')
const config = require('../../config/config')
const logger = require('../utils/logger')
const { getCachedConfig, setCachedConfig } = require('../utils/performanceOptimizer')

// Limpiar任务间隔
const CLEANUP_INTERVAL_MS = 60000 // 1分钟

// 轮询等待Configuración
const POLL_INTERVAL_BASE_MS = 50 // 基础轮询间隔
const POLL_INTERVAL_MAX_MS = 500 // 最大轮询间隔
const POLL_BACKOFF_FACTOR = 1.5 // 退避因子

// ConfiguraciónCaché key
const CONFIG_CACHE_KEY = 'user_message_queue_config'

class UserMessageQueueService {
  constructor() {
    this.cleanupTimer = null
  }

  /**
   * 检测Solicitud是否为真正的Usuario消息Solicitud
   * 区分真正的Usuario输入和 tool_result 消息
   *
   * Claude API 消息Formato：
   * - Usuario文本消息: { role: 'user', content: 'text' } 或 { role: 'user', content: [{ type: 'text', text: '...' }] }
   * - 工具结果消息: { role: 'user', content: [{ type: 'tool_result', tool_use_id: '...', content: '...' }] }
   *
   * @param {Object} requestBody - Solicitud体
   * @returns {boolean} - 是否为真正的Usuario消息（Excluir tool_result）
   */
  isUserMessageRequest(requestBody) {
    const messages = requestBody?.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return false
    }
    const lastMessage = messages[messages.length - 1]

    // Verificar role 是否为 user
    if (lastMessage?.role !== 'user') {
      return false
    }

    // Verificar content 是否Incluir tool_result Tipo
    const { content } = lastMessage
    if (Array.isArray(content)) {
      // 如果 content Arreglo中任何元素是 tool_result，则不是真正的Usuario消息
      const hasToolResult = content.some(
        (block) => block?.type === 'tool_result' || block?.type === 'tool_use_result'
      )
      if (hasToolResult) {
        return false
      }
    }

    // role 是 user 且不Incluir tool_result，是真正的Usuario消息
    return true
  }

  /**
   * Obtener当前Configuración（Soportar Web 界面Configuración优先，带短 TTL Caché）
   * @returns {Promise<Object>} ConfiguraciónObjeto
   */
  async getConfig() {
    // VerificarCaché
    const cached = getCachedConfig(CONFIG_CACHE_KEY)
    if (cached) {
      return cached
    }

    // PredeterminadoConfiguración（防止 config.userMessageQueue 未定义）
    const queueConfig = config.userMessageQueue || {}
    const defaults = {
      enabled: queueConfig.enabled ?? false,
      delayMs: queueConfig.delayMs ?? 200,
      timeoutMs: queueConfig.timeoutMs ?? 60000,
      lockTtlMs: queueConfig.lockTtlMs ?? 120000
    }

    // 尝试从 claudeRelayConfigService Obtener Web 界面Configuración
    try {
      const claudeRelayConfigService = require('./claudeRelayConfigService')
      const webConfig = await claudeRelayConfigService.getConfig()

      const result = {
        enabled:
          webConfig.userMessageQueueEnabled !== undefined
            ? webConfig.userMessageQueueEnabled
            : defaults.enabled,
        delayMs:
          webConfig.userMessageQueueDelayMs !== undefined
            ? webConfig.userMessageQueueDelayMs
            : defaults.delayMs,
        timeoutMs:
          webConfig.userMessageQueueTimeoutMs !== undefined
            ? webConfig.userMessageQueueTimeoutMs
            : defaults.timeoutMs,
        lockTtlMs:
          webConfig.userMessageQueueLockTtlMs !== undefined
            ? webConfig.userMessageQueueLockTtlMs
            : defaults.lockTtlMs
      }

      // CachéConfiguración 30 秒
      setCachedConfig(CONFIG_CACHE_KEY, result, 30000)
      return result
    } catch {
      // Retirada到Variable de entornoConfiguración，也Caché
      setCachedConfig(CONFIG_CACHE_KEY, defaults, 30000)
      return defaults
    }
  }

  /**
   * Verificar功能是否Habilitar
   * @returns {Promise<boolean>}
   */
  async isEnabled() {
    const cfg = await this.getConfig()
    return cfg.enabled === true
  }

  /**
   * ObtenerCuentaCola锁（Bloqueante等待）
   * @param {string} accountId - CuentaID
   * @param {string} requestId - SolicitudID（Opcional，会自动Generar）
   * @param {number} timeoutMs - Tiempo de espera agotadoTiempo（Opcional，使用ConfiguraciónPredeterminadoValor）
   * @param {Object} accountConfig - Cuenta级Configuración（Opcional），优先级高于全局Configuración
   * @param {number} accountConfig.maxConcurrency - Cuenta级串FilaCola开关：>0Habilitar，=0使用全局Configuración
   * @returns {Promise<{acquired: boolean, requestId: string, error?: string}>}
   */
  async acquireQueueLock(accountId, requestId = null, timeoutMs = null, accountConfig = null) {
    const cfg = await this.getConfig()

    // Cuenta级Configuración优先：maxConcurrency > 0 时强制Habilitar，忽略全局开关
    let queueEnabled = cfg.enabled
    if (accountConfig && accountConfig.maxConcurrency > 0) {
      queueEnabled = true
      logger.debug(
        `📬 User message queue: account-level queue enabled for account ${accountId} (maxConcurrency=${accountConfig.maxConcurrency})`
      )
    }

    if (!queueEnabled) {
      return { acquired: true, requestId: requestId || uuidv4(), skipped: true }
    }

    const reqId = requestId || uuidv4()
    const timeout = timeoutMs || cfg.timeoutMs
    const startTime = Date.now()
    let retryCount = 0

    logger.debug(`📬 User message queue: attempting to acquire lock for account ${accountId}`, {
      requestId: reqId,
      timeoutMs: timeout
    })

    while (Date.now() - startTime < timeout) {
      const result = await redis.acquireUserMessageLock(
        accountId,
        reqId,
        cfg.lockTtlMs,
        cfg.delayMs
      )

      // 检测 Redis Error，立即Retornar系统Error而非继续轮询
      if (result.redisError) {
        logger.error(`📬 User message queue: Redis error while acquiring lock`, {
          accountId,
          requestId: reqId,
          errorMessage: result.errorMessage
        })
        return {
          acquired: false,
          requestId: reqId,
          error: 'queue_backend_error',
          errorMessage: result.errorMessage
        }
      }

      if (result.acquired) {
        logger.debug(`📬 User message queue: lock acquired for account ${accountId}`, {
          requestId: reqId,
          waitedMs: Date.now() - startTime,
          retries: retryCount
        })
        return { acquired: true, requestId: reqId }
      }

      // 需要等待
      if (result.waitMs > 0) {
        // 需要延迟（上一个Solicitud刚Completado）
        await this._sleep(Math.min(result.waitMs, timeout - (Date.now() - startTime)))
      } else {
        // 锁被占用，使用指数退避轮询等待
        const basePollInterval = Math.min(
          POLL_INTERVAL_BASE_MS * Math.pow(POLL_BACKOFF_FACTOR, retryCount),
          POLL_INTERVAL_MAX_MS
        )
        // 添加 ±15% 随机抖动，避免高Concurrencia下的周期性碰撞
        const jitter = basePollInterval * (0.85 + Math.random() * 0.3)
        const pollInterval = Math.min(jitter, POLL_INTERVAL_MAX_MS)
        await this._sleep(pollInterval)
        retryCount++
      }
    }

    // Tiempo de espera agotado
    logger.warn(`📬 User message queue: timeout waiting for lock`, {
      accountId,
      requestId: reqId,
      timeoutMs: timeout
    })

    return {
      acquired: false,
      requestId: reqId,
      error: 'queue_timeout'
    }
  }

  /**
   * 释放CuentaCola锁
   * @param {string} accountId - CuentaID
   * @param {string} requestId - SolicitudID
   * @returns {Promise<boolean>}
   */
  async releaseQueueLock(accountId, requestId) {
    if (!accountId || !requestId) {
      return false
    }

    const released = await redis.releaseUserMessageLock(accountId, requestId)

    if (released) {
      logger.debug(`📬 User message queue: lock released for account ${accountId}`, {
        requestId
      })
    } else {
      logger.warn(`📬 User message queue: failed to release lock (not owner?)`, {
        accountId,
        requestId
      })
    }

    return released
  }

  /**
   * ObtenerColaEstadísticaInformación
   * @param {string} accountId - CuentaID
   * @returns {Promise<Object>}
   */
  async getQueueStats(accountId) {
    return await redis.getUserMessageQueueStats(accountId)
  }

  /**
   * Servicio启动时Limpiar所有残留的Cola锁
   * 防止Servicio重启后旧锁Bloqueante新Solicitud
   * @returns {Promise<number>} Limpiar的锁数量
   */
  async cleanupStaleLocks() {
    try {
      const accountIds = await redis.scanUserMessageQueueLocks()
      let cleanedCount = 0

      for (const accountId of accountIds) {
        try {
          await redis.forceReleaseUserMessageLock(accountId)
          cleanedCount++
          logger.debug(`📬 User message queue: cleaned stale lock for account ${accountId}`)
        } catch (error) {
          logger.error(
            `📬 User message queue: failed to clean lock for account ${accountId}:`,
            error
          )
        }
      }

      if (cleanedCount > 0) {
        logger.info(`📬 User message queue: cleaned ${cleanedCount} stale lock(s) on startup`)
      }

      return cleanedCount
    } catch (error) {
      logger.error('📬 User message queue: failed to cleanup stale locks on startup:', error)
      return 0
    }
  }

  /**
   * 启动定时Limpiar任务
   * 始终启动，每次Ejecutar时VerificarConfiguración以Soportar运Fila时动态Habilitar/Deshabilitar
   */
  startCleanupTask() {
    if (this.cleanupTimer) {
      return
    }

    this.cleanupTimer = setInterval(async () => {
      // 每次运Fila时VerificarConfiguración，以便在运Fila时动态Habilitar/Deshabilitar
      const currentConfig = await this.getConfig()
      if (!currentConfig.enabled) {
        logger.debug('📬 User message queue: cleanup skipped (feature disabled)')
        return
      }
      await this._cleanupOrphanLocks()
    }, CLEANUP_INTERVAL_MS)

    logger.info('📬 User message queue: cleanup task started')
  }

  /**
   * 停止定时Limpiar任务
   */
  stopCleanupTask() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
      logger.info('📬 User message queue: cleanup task stopped')
    }
  }

  /**
   * Limpiar孤儿锁
   * 检测异常情况：锁存在但没有Establecer过期Tiempo（lockTtlRaw === -1）
   * 正常情况下所有锁都应该有 TTL，Redis 会自动过期
   * @private
   */
  async _cleanupOrphanLocks() {
    try {
      const accountIds = await redis.scanUserMessageQueueLocks()

      for (const accountId of accountIds) {
        const stats = await redis.getUserMessageQueueStats(accountId)

        // 检测异常情况：锁存在（isLocked=true）但没有过期Tiempo（lockTtlRaw=-1）
        // 正常Crear的锁都带有 PX 过期Tiempo，如果没有说明是异常状态
        if (stats.isLocked && stats.lockTtlRaw === -1) {
          logger.warn(
            `📬 User message queue: cleaning up orphan lock without TTL for account ${accountId}`,
            { lockHolder: stats.lockHolder }
          )
          await redis.forceReleaseUserMessageLock(accountId)
        }
      }
    } catch (error) {
      logger.error('📬 User message queue: cleanup task error:', error)
    }
  }

  /**
   * 睡眠辅助Función
   * @param {number} ms - 毫秒
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

module.exports = new UserMessageQueueService()
