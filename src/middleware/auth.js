const { v4: uuidv4 } = require('uuid')
const config = require('../../config/config')
const apiKeyService = require('../services/apiKeyService')
const userService = require('../services/userService')
const logger = require('../utils/logger')
const redis = require('../models/redis')
// const { RateLimiterRedis } = require('rate-limiter-flexible') // 暂时未使用
const ClientValidator = require('../validators/clientValidator')
const ClaudeCodeValidator = require('../validators/clients/claudeCodeValidator')
const claudeRelayConfigService = require('../services/claudeRelayConfigService')
const { calculateWaitTimeStats } = require('../utils/statsHelper')
const { isOpusModel } = require('../utils/modelHelper')

// 工具Función
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Verificar排队是否过载，决定是否应该快速Falló
 * 详见 design.md Decision 7: 排队Verificación de salud与快速Falló
 *
 * @param {string} apiKeyId - API Key ID
 * @param {number} timeoutMs - 排队Tiempo de espera agotadoTiempo（毫秒）
 * @param {Object} queueConfig - ColaConfiguración
 * @param {number} maxQueueSize - 最大排队数
 * @returns {Promise<Object>} { reject: boolean, reason?: string, estimatedWaitMs?: number, timeoutMs?: number }
 */
async function shouldRejectDueToOverload(apiKeyId, timeoutMs, queueConfig, maxQueueSize) {
  try {
    // 如果Verificación de salud被Deshabilitar，直接Retornar不拒绝
    if (!queueConfig.concurrentRequestQueueHealthCheckEnabled) {
      return { reject: false, reason: 'health_check_disabled' }
    }

    // 🔑 先Verificar当前Cola长度
    const currentQueueCount = await redis.getConcurrencyQueueCount(apiKeyId).catch(() => 0)

    // Cola为空，说明系统已Restauración，跳过Verificación de salud
    if (currentQueueCount === 0) {
      return { reject: false, reason: 'queue_empty', currentQueueCount: 0 }
    }

    // 🔑 关键Mejora：只有当Cola接近满载时才进FilaVerificación de salud
    // Cola长度 <= maxQueueSize * 0.5 时，认为系统有足够余量，跳过Verificación de salud
    // 这避免了在Cola较短时过于保守地拒绝Solicitud
    // 使用 ceil 确保小Cola（如 maxQueueSize=3）时阈Valor为 2，即Cola <=1 时跳过
    const queueLoadThreshold = Math.ceil(maxQueueSize * 0.5)
    if (currentQueueCount <= queueLoadThreshold) {
      return {
        reject: false,
        reason: 'queue_not_loaded',
        currentQueueCount,
        queueLoadThreshold,
        maxQueueSize
      }
    }

    // Obtener该 API Key 的等待Tiempo样本
    const waitTimes = await redis.getQueueWaitTimes(apiKeyId)
    const stats = calculateWaitTimeStats(waitTimes)

    // 样本不足（< 10），跳过Verificación de salud，避免冷启动误判
    if (!stats || stats.sampleCount < 10) {
      return { reject: false, reason: 'insufficient_samples', sampleCount: stats?.sampleCount || 0 }
    }

    // P90 不可靠时也跳过（虽然 sampleCount >= 10 时 p90Unreliable 应该是 false）
    if (stats.p90Unreliable) {
      return { reject: false, reason: 'p90_unreliable', sampleCount: stats.sampleCount }
    }

    // Calcular健康阈Valor：P90 >= Tiempo de espera agotadoTiempo × 阈Valor 时拒绝
    const threshold = queueConfig.concurrentRequestQueueHealthThreshold || 0.8
    const maxAllowedP90 = timeoutMs * threshold

    if (stats.p90 >= maxAllowedP90) {
      return {
        reject: true,
        reason: 'queue_overloaded',
        estimatedWaitMs: stats.p90,
        timeoutMs,
        threshold,
        sampleCount: stats.sampleCount,
        currentQueueCount,
        maxQueueSize
      }
    }

    return { reject: false, p90: stats.p90, sampleCount: stats.sampleCount, currentQueueCount }
  } catch (error) {
    // Verificación de salud出错时不BloqueanteSolicitud，RegistroAdvertencia并继续
    logger.warn(`Health check failed for ${apiKeyId}:`, error.message)
    return { reject: false, reason: 'health_check_error', error: error.message }
  }
}

// 排队轮询Configuración常量（可通过ConfiguraciónArchivo覆盖）
// Rendimiento权衡：初始间隔越短Respuesta越快，但 Redis QPS 越高
// 当前Configuración：100 个等待者时约 250-300 QPS（指数退避后）
const QUEUE_POLLING_CONFIG = {
  pollIntervalMs: 200, // 初始轮询间隔（毫秒）- 平衡Respuesta速度和 Redis 压力
  maxPollIntervalMs: 2000, // 最大轮询间隔（毫秒）- 长Tiempo等待时降低 Redis 压力
  backoffFactor: 1.5, // 指数退避系数
  jitterRatio: 0.2, // 抖动比例（±20%）- 防止惊群效应
  maxRedisFailCount: 5 // 连续 Redis Falló阈Valor（从 3 提高到 5，提高网络抖动容忍度）
}

const FALLBACK_CONCURRENCY_CONFIG = {
  leaseSeconds: 300,
  renewIntervalSeconds: 30,
  cleanupGraceSeconds: 30
}

const resolveConcurrencyConfig = () => {
  if (typeof redis._getConcurrencyConfig === 'function') {
    return redis._getConcurrencyConfig()
  }

  const raw = {
    ...FALLBACK_CONCURRENCY_CONFIG,
    ...(config.concurrency || {})
  }

  const toNumber = (value, fallback) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      return fallback
    }
    return parsed
  }

  const leaseSeconds = Math.max(
    toNumber(raw.leaseSeconds, FALLBACK_CONCURRENCY_CONFIG.leaseSeconds),
    30
  )

  let renewIntervalSeconds
  if (raw.renewIntervalSeconds === 0 || raw.renewIntervalSeconds === '0') {
    renewIntervalSeconds = 0
  } else {
    renewIntervalSeconds = Math.max(
      toNumber(raw.renewIntervalSeconds, FALLBACK_CONCURRENCY_CONFIG.renewIntervalSeconds),
      0
    )
  }

  const cleanupGraceSeconds = Math.max(
    toNumber(raw.cleanupGraceSeconds, FALLBACK_CONCURRENCY_CONFIG.cleanupGraceSeconds),
    0
  )

  return {
    leaseSeconds,
    renewIntervalSeconds,
    cleanupGraceSeconds
  }
}

const TOKEN_COUNT_PATHS = new Set([
  '/v1/messages/count_tokens',
  '/api/v1/messages/count_tokens',
  '/claude/v1/messages/count_tokens'
])

function extractApiKey(req) {
  const candidates = [
    req.headers['x-api-key'],
    req.headers['x-goog-api-key'],
    req.headers['authorization'],
    req.headers['api-key'],
    req.query?.key
  ]

  for (const candidate of candidates) {
    let value = candidate

    if (Array.isArray(value)) {
      value = value.find((item) => typeof item === 'string' && item.trim())
    }

    if (typeof value !== 'string') {
      continue
    }

    let trimmed = value.trim()
    if (!trimmed) {
      continue
    }

    if (/^Bearer\s+/i.test(trimmed)) {
      trimmed = trimmed.replace(/^Bearer\s+/i, '').trim()
      if (!trimmed) {
        continue
      }
    }

    return trimmed
  }

  return ''
}

function normalizeRequestPath(value) {
  if (!value) {
    return '/'
  }
  let lower = value.split('?')[0].toLowerCase()
  // 🆕 Procesar重复的 /v1/v1 Ruta（可能是Cliente BaseURL ConfiguraciónError导致）
  if (lower.includes('/v1/v1/')) {
    lower = lower.replace('/v1/v1/', '/v1/')
    logger.api(`🔧 Path normalized (v1 duplication): ${value.split('?')[0]} -> ${lower}`)
  }
  // 🆕 Procesar重复的 /api/api Ruta
  if (lower.includes('/api/api/')) {
    lower = lower.replace('/api/api/', '/api/')
    logger.api(`🔧 Path normalized (api duplication): ${value.split('?')[0]} -> ${lower}`)
  }
  const collapsed = lower.replace(/\/{2,}/g, '/')
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1)
  }
  return collapsed || '/'
}

function isTokenCountRequest(req) {
  const combined = normalizeRequestPath(`${req.baseUrl || ''}${req.path || ''}`)
  if (TOKEN_COUNT_PATHS.has(combined)) {
    return true
  }
  const original = normalizeRequestPath(req.originalUrl || '')
  if (TOKEN_COUNT_PATHS.has(original)) {
    return true
  }
  return false
}

/**
 * 等待Concurrencia槽位（排队机制核心）
 *
 * 采用「先占后Verificar」模式避免竞态Condición：
 * - 每次轮询时尝试 incrConcurrency 占位
 * - 如果超限则 decrConcurrency 释放并继续等待
 * - ÉxitoObtener槽位后Retornar，调用方无需再次 incrConcurrency
 *
 * ⚠️ 重要Limpiar责任说明：
 * - 排队计数：此Función的 finally 块负责调用 decrConcurrencyQueue Limpiar
 * - Concurrencia槽位：当Retornar acquired=true 时，槽位已被占用（通过 incrConcurrency）
 *   调用方必须在Solicitud结束时调用 decrConcurrency 释放槽位
 *   （已在 authenticateApiKey 的 finally 块中Procesar）
 *
 * @param {Object} req - Express SolicitudObjeto
 * @param {Object} res - Express RespuestaObjeto
 * @param {string} apiKeyId - API Key ID
 * @param {Object} queueOptions - ConfiguraciónParámetro
 * @returns {Promise<Object>} { acquired: boolean, reason?: string, waitTimeMs: number }
 */
async function waitForConcurrencySlot(req, res, apiKeyId, queueOptions) {
  const {
    concurrencyLimit,
    requestId,
    leaseSeconds,
    timeoutMs,
    pollIntervalMs,
    maxPollIntervalMs,
    backoffFactor,
    jitterRatio,
    maxRedisFailCount: configMaxRedisFailCount
  } = queueOptions

  let clientDisconnected = false
  // Rastreo轮询过程中是否临时占用了槽位（用于异常时Limpiar）
  // 工作流程：
  // 1. incrConcurrency Éxito且 count <= limit 时，Establecer internalSlotAcquired = true
  // 2. EstadísticaRegistroCompletado后，Establecer internalSlotAcquired = false 并Retornar（所有权转移给调用方）
  // 3. 如果在步骤 1-2 之间发生异常，finally 块会检测到 internalSlotAcquired = true 并释放槽位
  let internalSlotAcquired = false

  // 监听Cliente断开Evento
  // ⚠️ 重要：必须监听 socket 的Evento，而不是 req 的Evento！
  // 原因：对于 POST Solicitud，当 body-parser Leer完Solicitud体后，req（IncomingMessage 可读流）
  // 的 'close' Evento会立即触发，但这不代TablaCliente断开Conexión！Cliente仍在等待Respuesta。
  // socket 的 'close' Evento才是真正的Conexión关闭信号。
  const { socket } = req
  const onSocketClose = () => {
    clientDisconnected = true
    logger.debug(
      `🔌 [Queue] Socket closed during queue wait for API key ${apiKeyId}, requestId: ${requestId}`
    )
  }

  if (socket) {
    socket.once('close', onSocketClose)
  }

  // Verificar socket 是否在Escucha注册前已被销毁（边界情况）
  if (socket?.destroyed) {
    clientDisconnected = true
  }

  const startTime = Date.now()
  let pollInterval = pollIntervalMs
  let redisFailCount = 0
  // 优先使用Configuración中的Valor，否则使用PredeterminadoValor
  const maxRedisFailCount = configMaxRedisFailCount || QUEUE_POLLING_CONFIG.maxRedisFailCount

  try {
    while (Date.now() - startTime < timeoutMs) {
      // 检测Cliente是否断开（双重Verificar：Evento标记 + socket 状态）
      // socket.destroyed 是SincronizaciónVerificar，确保即使EventoProcesar有延迟也能及时检测
      if (clientDisconnected || socket?.destroyed) {
        redis
          .incrConcurrencyQueueStats(apiKeyId, 'cancelled')
          .catch((e) => logger.warn('Failed to record cancelled stat:', e))
        return {
          acquired: false,
          reason: 'client_disconnected',
          waitTimeMs: Date.now() - startTime
        }
      }

      // 尝试Obtener槽位（先占后Verificar）
      try {
        const count = await redis.incrConcurrency(apiKeyId, requestId, leaseSeconds)
        redisFailCount = 0 // 重置Falló计数

        if (count <= concurrencyLimit) {
          // ÉxitoObtener槽位！
          const waitTimeMs = Date.now() - startTime

          // 槽位所有权转移说明：
          // 1. 此时槽位已通过 incrConcurrency Obtener
          // 2. 先标记 internalSlotAcquired = true，确保异常时 finally 块能Limpiar
          // 3. EstadísticaOperaciónCompletado后，清除标记并Retornar，所有权转移给调用方
          // 4. 调用方（authenticateApiKey）负责在Solicitud结束时释放槽位

          // 标记槽位已Obtener（用于异常时 finally 块Limpiar）
          internalSlotAcquired = true

          // RegistroEstadística（非Bloqueante，fire-and-forget 模式）
          // ⚠️ 设计说明：
          // - 故意不 await 这些 Promise，因为EstadísticaRegistro不应BloqueanteSolicitudProcesar
          // - 每个 Promise 都有独立的 .catch()，确保单个Falló不影响其他
          // - 外层 .catch() 是防御性措施，Procesar Promise.all 本身的异常
          // - 即使EstadísticaRegistro在FunciónRetornar后才Completado/Falló，也是Seguridad的（仅RegistroRegistro）
          // - EstadísticaDatos丢失可接受，不影响核心业务逻辑
          Promise.all([
            redis
              .recordQueueWaitTime(apiKeyId, waitTimeMs)
              .catch((e) => logger.warn('Failed to record queue wait time:', e)),
            redis
              .recordGlobalQueueWaitTime(waitTimeMs)
              .catch((e) => logger.warn('Failed to record global wait time:', e)),
            redis
              .incrConcurrencyQueueStats(apiKeyId, 'success')
              .catch((e) => logger.warn('Failed to increment success stats:', e))
          ]).catch((e) => logger.warn('Failed to record queue stats batch:', e))

          // ÉxitoRetornar前清除标记（所有权转移给调用方，由其负责释放）
          internalSlotAcquired = false
          return { acquired: true, waitTimeMs }
        }

        // 超限，释放槽位继续等待
        try {
          await redis.decrConcurrency(apiKeyId, requestId)
        } catch (decrError) {
          // 释放Falló时RegistroAdvertencia但继续轮询
          // 下次 incrConcurrency 会自然覆盖同一 requestId 的条目
          logger.warn(
            `Failed to release slot during polling for ${apiKeyId}, will retry:`,
            decrError
          )
        }
      } catch (redisError) {
        redisFailCount++
        logger.error(
          `Redis error in queue polling (${redisFailCount}/${maxRedisFailCount}):`,
          redisError
        )

        if (redisFailCount >= maxRedisFailCount) {
          // 连续 Redis Falló，放弃排队
          return {
            acquired: false,
            reason: 'redis_error',
            waitTimeMs: Date.now() - startTime
          }
        }
      }

      // 指数退避等待
      await sleep(pollInterval)

      // Calcular下一次轮询间隔（指数退避 + 抖动）
      // 1. 先应用指数退避
      let nextInterval = pollInterval * backoffFactor
      // 2. 添加抖动防止惊群效应（±jitterRatio 范围内的随机偏移）
      //    抖动范围：[-jitterRatio, +jitterRatio]，例如 jitterRatio=0.2 时为 ±20%
      //    这是预期Fila为：负抖动可使间隔略微缩短，正抖动可使间隔略微延长
      //    目的是分散多个等待者的轮询Tiempo点，避免同时Solicitud Redis
      const jitter = nextInterval * jitterRatio * (Math.random() * 2 - 1)
      nextInterval = nextInterval + jitter
      // 3. 确保在合理范围内：最小 1ms，最大 maxPollIntervalMs
      //    Math.max(1, ...) 保证即使负抖动也不会产生 ≤0 的间隔
      pollInterval = Math.max(1, Math.min(nextInterval, maxPollIntervalMs))
    }

    // Tiempo de espera agotado
    redis
      .incrConcurrencyQueueStats(apiKeyId, 'timeout')
      .catch((e) => logger.warn('Failed to record timeout stat:', e))
    return { acquired: false, reason: 'timeout', waitTimeMs: Date.now() - startTime }
  } finally {
    // 确保Limpiar：
    // 1. 减少排队计数（排队计数在调用方已增加，这里负责减少）
    try {
      await redis.decrConcurrencyQueue(apiKeyId)
    } catch (cleanupError) {
      // LimpiarFallóRegistroError（可能导致计数泄漏，但有 TTL 保护）
      logger.error(
        `Failed to decrement queue count in finally block for ${apiKeyId}:`,
        cleanupError
      )
    }

    // 2. 如果内部Obtener了槽位但未正常Retornar（异常Ruta），释放槽位
    if (internalSlotAcquired) {
      try {
        await redis.decrConcurrency(apiKeyId, requestId)
        logger.warn(
          `⚠️ Released orphaned concurrency slot in finally block for ${apiKeyId}, requestId: ${requestId}`
        )
      } catch (slotCleanupError) {
        logger.error(
          `Failed to release orphaned concurrency slot for ${apiKeyId}:`,
          slotCleanupError
        )
      }
    }

    // Limpiar socket EventoEscucha
    if (socket) {
      socket.removeListener('close', onSocketClose)
    }
  }
}

// 🔑 API KeyValidarMiddleware（Optimización版）
const authenticateApiKey = async (req, res, next) => {
  const startTime = Date.now()
  let authErrored = false
  let concurrencyCleanup = null
  let hasConcurrencySlot = false

  try {
    // Seguridad提取API Key，Soportar多种Formato（包括Gemini CLISoportar）
    const apiKey = extractApiKey(req)

    if (apiKey) {
      req.headers['x-api-key'] = apiKey
    }

    if (!apiKey) {
      logger.security(`Missing API key attempt from ${req.ip || 'unknown'}`)
      return res.status(401).json({
        error: 'Missing API key',
        message:
          'Please provide an API key in the x-api-key, x-goog-api-key, or Authorization header'
      })
    }

    // 基本API KeyFormatoValidar
    if (typeof apiKey !== 'string' || apiKey.length < 10 || apiKey.length > 512) {
      logger.security(`Invalid API key format from ${req.ip || 'unknown'}`)
      return res.status(401).json({
        error: 'Invalid API key format',
        message: 'API key format is invalid'
      })
    }

    // ValidarAPI Key（带CachéOptimización）
    const validation = await apiKeyService.validateApiKey(apiKey)

    if (!validation.valid) {
      const clientIP = req.ip || req.connection?.remoteAddress || 'unknown'
      logger.security(`Invalid API key attempt: ${validation.error} from ${clientIP}`)
      return res.status(401).json({
        error: 'Invalid API key',
        message: validation.error
      })
    }

    const relayConfig = await claudeRelayConfigService.getConfig()
    const apiKeyData = validation.keyData
    const forcedModel = apiKeyData.forcedModel || relayConfig.globalForcedModel
    const modelMapping = {
      ...(relayConfig.globalModelMapping || {}),
      ...(apiKeyData.modelMapping || {})
    }

    if (req.method === 'POST' && req.body && typeof req.body === 'object' && req.body.model) {
      const originalModel = req.body.model
      let targetModel = null

      if (forcedModel) {
        targetModel = forcedModel
      } else if (modelMapping[originalModel]) {
        targetModel = modelMapping[originalModel]
      } else {
        for (const pattern in modelMapping) {
          if (pattern.includes('*')) {
            const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`)
            if (regex.test(originalModel)) {
              targetModel = modelMapping[pattern]
              break
            }
          }
        }
      }

      if (targetModel && targetModel !== originalModel) {
        req.body.model = targetModel
        logger.info(`🔄 Model Redirect: ${originalModel} -> ${targetModel} (Key: ${apiKeyData.id})`)
      }
    }

    if (req.method === 'POST' && req.body && typeof req.body === 'object' && req.body.model) {
      const originalModel = req.body.model
      let targetModel = null

      // 1. Single forced model override (highest priority)
      if (forcedModel) {
        targetModel = forcedModel
      }
      // 2. Dynamic mapping patterns (sub2api style)
      else if (modelMapping[originalModel]) {
        targetModel = modelMapping[originalModel]
      }
      // 3. Pattern matching (wildcards)
      else {
        for (const pattern in modelMapping) {
          if (pattern.includes('*')) {
            const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`)
            if (regex.test(originalModel)) {
              targetModel = modelMapping[pattern]
              break
            }
          }
        }
      }

      if (targetModel && targetModel !== originalModel) {
        req.body.model = targetModel
        logger.info(`🔄 Model Redirect: ${originalModel} -> ${targetModel} (Key: ${apiKeyData.id})`)
      }
    }

    const skipKeyRestrictions = isTokenCountRequest(req)

    // 🔒 VerificarClienteLímite（使用新的Validar器）
    if (
      !skipKeyRestrictions &&
      validation.keyData.enableClientRestriction &&
      validation.keyData.allowedClients?.length > 0
    ) {
      // 使用新的 ClientValidator 进FilaValidar
      const validationResult = ClientValidator.validateRequest(
        validation.keyData.allowedClients,
        req
      )

      if (!validationResult.allowed) {
        const clientIP = req.ip || req.connection?.remoteAddress || 'unknown'
        logger.security(
          `🚫 Client restriction failed for key: ${validation.keyData.id} (${validation.keyData.name}) from ${clientIP}`
        )
        return res.status(403).json({
          error: 'Client not allowed',
          message: 'Your client is not authorized to use this API key',
          allowedClients: validation.keyData.allowedClients,
          userAgent: validationResult.userAgent
        })
      }

      // Validar通过
      logger.api(
        `✅ Client validated: ${validationResult.clientName} (${validationResult.matchedClient}) for key: ${validation.keyData.id} (${validation.keyData.name})`
      )
    }

    // 🔒 Verificar全局 Claude Code Límite（与 API Key 级别是 OR 逻辑）
    // 仅对 Claude ServicioEndpoint生效 (/api/v1/messages 和 /claude/v1/messages)
    if (!skipKeyRestrictions) {
      const normalizedPath = (req.originalUrl || req.path || '').toLowerCase()
      const isClaudeMessagesEndpoint =
        normalizedPath.includes('/v1/messages') &&
        (normalizedPath.startsWith('/api') || normalizedPath.startsWith('/claude'))

      if (isClaudeMessagesEndpoint) {
        try {
          const globalClaudeCodeOnly = await claudeRelayConfigService.isClaudeCodeOnlyEnabled()

          // API Key 级别的 Claude Code Límite
          const keyClaudeCodeOnly =
            validation.keyData.enableClientRestriction &&
            Array.isArray(validation.keyData.allowedClients) &&
            validation.keyData.allowedClients.length === 1 &&
            validation.keyData.allowedClients.includes('claude_code')

          // OR 逻辑：全局开启 或 API Key 级别Límite为仅 claude_code
          if (globalClaudeCodeOnly || keyClaudeCodeOnly) {
            const isClaudeCode = ClaudeCodeValidator.validate(req)

            if (!isClaudeCode) {
              const clientIP = req.ip || req.connection?.remoteAddress || 'unknown'
              logger.api(
                `❌ Claude Code client validation failed (global: ${globalClaudeCodeOnly}, key: ${keyClaudeCodeOnly}) from ${clientIP}`
              )
              // [ULTRAWORK FIX] Bypass restriction for compatibility
              logger.warn(
                `⚠️ Bypassing Claude Code restriction for client at ${clientIP} - Allowing request to proceed despite validation failure`
              )
              // return res.status(403).json({
              //   error: {
              //     type: 'client_validation_error',
              //     message: 'This endpoint only accepts requests from Claude Code CLI'
              //   }
              // })
            }

            logger.api(
              `✅ Claude Code client validated (global: ${globalClaudeCodeOnly}, key: ${keyClaudeCodeOnly})`
            )
          }
        } catch (error) {
          logger.error('❌ Error checking Claude Code restriction:', error)
          // ConfiguraciónServicio出错时不阻断Solicitud
        }
      }
    }

    // VerificarConcurrenciaLímite
    const concurrencyLimit = validation.keyData.concurrencyLimit || 0
    if (!skipKeyRestrictions && concurrencyLimit > 0) {
      const { leaseSeconds: configLeaseSeconds, renewIntervalSeconds: configRenewIntervalSeconds } =
        resolveConcurrencyConfig()
      const leaseSeconds = Math.max(Number(configLeaseSeconds) || 300, 30)
      let renewIntervalSeconds = configRenewIntervalSeconds
      if (renewIntervalSeconds > 0) {
        const maxSafeRenew = Math.max(leaseSeconds - 5, 15)
        renewIntervalSeconds = Math.min(Math.max(renewIntervalSeconds, 15), maxSafeRenew)
      } else {
        renewIntervalSeconds = 0
      }
      const requestId = uuidv4()

      // ⚠️ Optimización后的 Connection: close EstablecerPolítica
      // 问题背景：HTTP Keep-Alive 使多个Solicitud共用同一个 TCP Conexión
      // 当第一个SolicitudEn progresoProcesar，第二个Solicitud进入排队时，它们共用同一个 socket
      // 如果ClienteTiempo de espera agotado关闭Conexión，两个Solicitud都会受影响
      // Optimización方案：只有在Solicitud实际进入排队时才Establecer Connection: close
      // 未排队的Solicitud保持 Keep-Alive，避免不必要的 TCP 握手开销
      // 详见 design.md Decision 2: Connection: close Establecer时机
      // 注意：Connection: close 将在下方代码实际进入排队时Establecer（第 637 Fila左右）

      // ============================================================
      // 🔒 Concurrencia槽位状态管理说明
      // ============================================================
      // 此Función中有两个关键状态变量：
      // - hasConcurrencySlot: 当前是否持有Concurrencia槽位
      // - concurrencyCleanup: Error时调用的LimpiarFunción
      //
      // 状态Convertir流程：
      // 1. incrConcurrency Éxito → hasConcurrencySlot=true, Establecer临时LimpiarFunción
      // 2. 若超限 → 释放槽位，hasConcurrencySlot=false, concurrencyCleanup=null
      // 3. 若排队Éxito → hasConcurrencySlot=true, 升级为完整LimpiarFunción（含 interval Limpiar）
      // 4. Solicitud结束（res.close/req.close）→ 调用 decrementConcurrency 释放
      // 5. 认证Error → finally 块调用 concurrencyCleanup 释放
      //
      // 为什么需要两种LimpiarFunción？
      // - 临时Limpiar：在排队/认证过程中出错时使用，只释放槽位
      // - 完整Limpiar：Solicitud正常Iniciando后使用，还需Limpiar leaseRenewInterval
      // ============================================================
      const setTemporaryConcurrencyCleanup = () => {
        concurrencyCleanup = async () => {
          if (!hasConcurrencySlot) {
            return
          }
          hasConcurrencySlot = false
          try {
            await redis.decrConcurrency(validation.keyData.id, requestId)
          } catch (cleanupError) {
            logger.error(
              `Failed to decrement concurrency after auth error for key ${validation.keyData.id}:`,
              cleanupError
            )
          }
        }
      }

      const currentConcurrency = await redis.incrConcurrency(
        validation.keyData.id,
        requestId,
        leaseSeconds
      )
      hasConcurrencySlot = true
      setTemporaryConcurrencyCleanup()
      logger.api(
        `📈 Incremented concurrency for key: ${validation.keyData.id} (${validation.keyData.name}), current: ${currentConcurrency}, limit: ${concurrencyLimit}`
      )

      if (currentConcurrency > concurrencyLimit) {
        // 1. 先释放刚占用的槽位
        try {
          await redis.decrConcurrency(validation.keyData.id, requestId)
        } catch (error) {
          logger.error(
            `Failed to decrement concurrency after limit exceeded for key ${validation.keyData.id}:`,
            error
          )
        }
        hasConcurrencySlot = false
        concurrencyCleanup = null

        // 2. Obtener排队Configuración
        const queueConfig = await claudeRelayConfigService.getConfig()

        // 3. 排队功能未Habilitar，直接Retornar 429（保持现有Fila为）
        if (!queueConfig.concurrentRequestQueueEnabled) {
          logger.security(
            `🚦 Concurrency limit exceeded for key: ${validation.keyData.id} (${
              validation.keyData.name
            }), current: ${currentConcurrency - 1}, limit: ${concurrencyLimit}`
          )
          // 建议Cliente在短暂延迟后Reintentar（Concurrencia场景下通常很快会有槽位释放）
          res.set('Retry-After', '1')
          return res.status(429).json({
            error: 'Concurrency limit exceeded',
            message: `Too many concurrent requests. Limit: ${concurrencyLimit} concurrent requests`,
            currentConcurrency: currentConcurrency - 1,
            concurrencyLimit
          })
        }

        // 4. Calcular最大排队数
        const maxQueueSize = Math.max(
          concurrencyLimit * queueConfig.concurrentRequestQueueMaxSizeMultiplier,
          queueConfig.concurrentRequestQueueMaxSize
        )

        // 4.5 排队Verificación de salud：过载时快速Falló
        // 详见 design.md Decision 7: 排队Verificación de salud与快速Falló
        const overloadCheck = await shouldRejectDueToOverload(
          validation.keyData.id,
          queueConfig.concurrentRequestQueueTimeoutMs,
          queueConfig,
          maxQueueSize
        )
        if (overloadCheck.reject) {
          // 使用Verificación de saludRetornar的当前排队数，避免重复调用 Redis
          const currentQueueCount = overloadCheck.currentQueueCount || 0
          logger.api(
            `🚨 Queue overloaded for key: ${validation.keyData.id} (${validation.keyData.name}), ` +
              `P90=${overloadCheck.estimatedWaitMs}ms, timeout=${overloadCheck.timeoutMs}ms, ` +
              `threshold=${overloadCheck.threshold}, samples=${overloadCheck.sampleCount}, ` +
              `concurrency=${concurrencyLimit}, queue=${currentQueueCount}/${maxQueueSize}`
          )
          // Registro被拒绝的过载Estadística
          redis
            .incrConcurrencyQueueStats(validation.keyData.id, 'rejected_overload')
            .catch((e) => logger.warn('Failed to record rejected_overload stat:', e))
          // Retornar 429 + Retry-After，让Cliente稍后Reintentar
          const retryAfterSeconds = 30
          res.set('Retry-After', String(retryAfterSeconds))
          return res.status(429).json({
            error: 'Queue overloaded',
            message: `Queue is overloaded. Estimated wait time (${overloadCheck.estimatedWaitMs}ms) exceeds threshold. Limit: ${concurrencyLimit} concurrent requests, queue: ${currentQueueCount}/${maxQueueSize}. Please retry later.`,
            currentConcurrency: concurrencyLimit,
            concurrencyLimit,
            queueCount: currentQueueCount,
            maxQueueSize,
            estimatedWaitMs: overloadCheck.estimatedWaitMs,
            timeoutMs: overloadCheck.timeoutMs,
            queueTimeoutMs: queueConfig.concurrentRequestQueueTimeoutMs,
            retryAfterSeconds
          })
        }

        // 5. 尝试进入排队（原子Operación：先增加再Verificar，避免竞态Condición）
        let queueIncremented = false
        try {
          const newQueueCount = await redis.incrConcurrencyQueue(
            validation.keyData.id,
            queueConfig.concurrentRequestQueueTimeoutMs
          )
          queueIncremented = true

          if (newQueueCount > maxQueueSize) {
            // 超过最大排队数，立即释放并Retornar 429
            await redis.decrConcurrencyQueue(validation.keyData.id)
            queueIncremented = false
            logger.api(
              `🚦 Concurrency queue full for key: ${validation.keyData.id} (${validation.keyData.name}), ` +
                `queue: ${newQueueCount - 1}, maxQueue: ${maxQueueSize}`
            )
            // Cola已满，建议Cliente在排队Tiempo de espera agotadoTiempo后Reintentar
            const retryAfterSeconds = Math.ceil(queueConfig.concurrentRequestQueueTimeoutMs / 1000)
            res.set('Retry-After', String(retryAfterSeconds))
            return res.status(429).json({
              error: 'Concurrency queue full',
              message: `Too many requests waiting in queue. Limit: ${concurrencyLimit} concurrent requests, queue: ${newQueueCount - 1}/${maxQueueSize}, timeout: ${retryAfterSeconds}s`,
              currentConcurrency: concurrencyLimit,
              concurrencyLimit,
              queueCount: newQueueCount - 1,
              maxQueueSize,
              queueTimeoutMs: queueConfig.concurrentRequestQueueTimeoutMs,
              retryAfterSeconds
            })
          }

          // 6. 已Éxito进入排队，RegistroEstadística并Iniciando等待槽位
          logger.api(
            `⏳ Request entering queue for key: ${validation.keyData.id} (${validation.keyData.name}), ` +
              `queue position: ${newQueueCount}`
          )
          redis
            .incrConcurrencyQueueStats(validation.keyData.id, 'entered')
            .catch((e) => logger.warn('Failed to record entered stat:', e))

          // ⚠️ 仅在Solicitud实际进入排队时Establecer Connection: close
          // 详见 design.md Decision 2: Connection: close Establecer时机
          // 未排队的Solicitud保持 Keep-Alive，避免不必要的 TCP 握手开销
          if (!res.headersSent) {
            res.setHeader('Connection', 'close')
            logger.api(
              `🔌 [Queue] Set Connection: close for queued request, key: ${validation.keyData.id}`
            )
          }

          // ⚠️ Registro排队Iniciando时的 socket 标识，用于排队Completado后Validar
          // 问题背景：HTTP Keep-Alive Conexión复用时，长Tiempo排队可能导致 socket 被其他Solicitud使用
          // ValidarMétodo：使用 UUID token + socket Objeto引用双重Validar
          // 详见 design.md Decision 1: Socket 身份Validar机制
          req._crService = req._crService || {}
          req._crService.queueToken = uuidv4()
          req._crService.originalSocket = req.socket
          req._crService.startTime = Date.now()
          const savedToken = req._crService.queueToken
          const savedSocket = req._crService.originalSocket

          // ⚠️ 重要：在调用前将 queueIncremented 设为 false
          // 因为 waitForConcurrencySlot 的 finally 块会负责Limpiar排队计数
          // 如果在调用后Establecer，当 waitForConcurrencySlot 抛出异常时
          // 外层 catch 块会重复减少计数（finally 已经减过一次）
          queueIncremented = false

          const slot = await waitForConcurrencySlot(req, res, validation.keyData.id, {
            concurrencyLimit,
            requestId,
            leaseSeconds,
            timeoutMs: queueConfig.concurrentRequestQueueTimeoutMs,
            pollIntervalMs: QUEUE_POLLING_CONFIG.pollIntervalMs,
            maxPollIntervalMs: QUEUE_POLLING_CONFIG.maxPollIntervalMs,
            backoffFactor: QUEUE_POLLING_CONFIG.backoffFactor,
            jitterRatio: QUEUE_POLLING_CONFIG.jitterRatio,
            maxRedisFailCount: queueConfig.concurrentRequestQueueMaxRedisFailCount
          })

          // 7. Procesar排队结果
          if (!slot.acquired) {
            if (slot.reason === 'client_disconnected') {
              // Cliente已断开，不RetornarRespuesta（Conexión已关闭）
              logger.api(
                `🔌 Client disconnected while queuing for key: ${validation.keyData.id} (${validation.keyData.name})`
              )
              return
            }

            if (slot.reason === 'redis_error') {
              // Redis 连续Falló，Retornar 503
              logger.error(
                `❌ Redis error during queue wait for key: ${validation.keyData.id} (${validation.keyData.name})`
              )
              return res.status(503).json({
                error: 'Service temporarily unavailable',
                message: 'Failed to acquire concurrency slot due to internal error'
              })
            }
            // 排队Tiempo de espera agotado（使用 api 级别，与其他排队Registro保持一致）
            logger.api(
              `⏰ Queue timeout for key: ${validation.keyData.id} (${validation.keyData.name}), waited: ${slot.waitTimeMs}ms`
            )
            // 已等待Tiempo de espera agotado，建议Cliente稍后Reintentar
            // ⚠️ Retry-After PolíticaOptimización：
            // - Solicitud已经等了完整的 timeout Tiempo，说明系统负载较高
            // - 过早Reintentar（如固定 5 秒）会加剧拥塞，导致更多Tiempo de espera agotado
            // - 合理Política：使用 timeout Tiempo的一半作为Reintentar间隔
            // - 最小Valor 5 秒，最大Valor 30 秒，避免极端情况
            const timeoutSeconds = Math.ceil(queueConfig.concurrentRequestQueueTimeoutMs / 1000)
            const retryAfterSeconds = Math.max(5, Math.min(30, Math.ceil(timeoutSeconds / 2)))
            res.set('Retry-After', String(retryAfterSeconds))
            return res.status(429).json({
              error: 'Queue timeout',
              message: `Request timed out waiting for concurrency slot. Limit: ${concurrencyLimit} concurrent requests, maxQueue: ${maxQueueSize}, Queue timeout: ${timeoutSeconds}s, waited: ${slot.waitTimeMs}ms`,
              currentConcurrency: concurrencyLimit,
              concurrencyLimit,
              maxQueueSize,
              queueTimeoutMs: queueConfig.concurrentRequestQueueTimeoutMs,
              waitTimeMs: slot.waitTimeMs,
              retryAfterSeconds
            })
          }

          // 8. 排队Éxito，slot.acquired Tabla示已在 waitForConcurrencySlot 中Obtener到槽位
          logger.api(
            `✅ Queue wait completed for key: ${validation.keyData.id} (${validation.keyData.name}), ` +
              `waited: ${slot.waitTimeMs}ms`
          )
          hasConcurrencySlot = true
          setTemporaryConcurrencyCleanup()

          // 9. ⚠️ 关键Verificar：排队等待结束后，ValidarCliente是否还在等待Respuesta
          // 长Tiempo排队后，Cliente可能在应用层已放弃（如 Claude Code 的Tiempo de espera agotado机制），
          // 但 TCP Conexión仍然存活。此时继续ProcesarSolicitud是浪费资源。
          // 注意：如果发送了Latido，headersSent 会是 true，但这是正常的
          const postQueueSocket = req.socket
          // 只VerificarConexión是否真正断开（destroyed/writableEnded/socketDestroyed）
          // headersSent 在Latido场景下是正常的，不应该作为放弃的依据
          if (res.destroyed || res.writableEnded || postQueueSocket?.destroyed) {
            logger.warn(
              `⚠️ Client no longer waiting after queue for key: ${validation.keyData.id} (${validation.keyData.name}), ` +
                `waited: ${slot.waitTimeMs}ms | destroyed: ${res.destroyed}, ` +
                `writableEnded: ${res.writableEnded}, socketDestroyed: ${postQueueSocket?.destroyed}`
            )
            // 释放刚Obtener的槽位
            hasConcurrencySlot = false
            await redis
              .decrConcurrency(validation.keyData.id, requestId)
              .catch((e) => logger.error('Failed to release slot after client abandoned:', e))
            // 不RetornarRespuesta（Cliente已不在等待）
            return
          }

          // 10. ⚠️ 关键Verificar：Validar socket 身份是否改变
          // HTTP Keep-Alive Conexión复用可能导致排队期间 socket 被其他Solicitud使用
          // ValidarMétodo：UUID token + socket Objeto引用双重Validar
          // 详见 design.md Decision 1: Socket 身份Validar机制
          const queueData = req._crService
          const socketIdentityChanged =
            !queueData ||
            queueData.queueToken !== savedToken ||
            queueData.originalSocket !== savedSocket

          if (socketIdentityChanged) {
            logger.error(
              `❌ [Queue] Socket identity changed during queue wait! ` +
                `key: ${validation.keyData.id} (${validation.keyData.name}), ` +
                `waited: ${slot.waitTimeMs}ms | ` +
                `tokenMatch: ${queueData?.queueToken === savedToken}, ` +
                `socketMatch: ${queueData?.originalSocket === savedSocket}`
            )
            // 释放刚Obtener的槽位
            hasConcurrencySlot = false
            await redis
              .decrConcurrency(validation.keyData.id, requestId)
              .catch((e) => logger.error('Failed to release slot after socket identity change:', e))
            // Registro socket_changed Estadística
            redis
              .incrConcurrencyQueueStats(validation.keyData.id, 'socket_changed')
              .catch((e) => logger.warn('Failed to record socket_changed stat:', e))
            // 不RetornarRespuesta（socket 已被其他Solicitud使用）
            return
          }
        } catch (queueError) {
          // 异常时Limpiar资源，防止泄漏
          // 1. Limpiar排队计数（如果还没被 waitForConcurrencySlot 的 finally Limpiar）
          if (queueIncremented) {
            await redis
              .decrConcurrencyQueue(validation.keyData.id)
              .catch((e) => logger.error('Failed to cleanup queue count after error:', e))
          }

          // 2. 防御性Limpiar：如果 waitForConcurrencySlot 内部Obtener了槽位但在Retornar前异常
          //    虽然这种情况极少发生（EstadísticaRegistro的异常会被内部捕获），但为了Seguridad起见
          //    尝试释放可能已Obtener的槽位。decrConcurrency 使用 ZREM，即使成员不存在也Seguridad
          if (hasConcurrencySlot) {
            hasConcurrencySlot = false
            await redis
              .decrConcurrency(validation.keyData.id, requestId)
              .catch((e) =>
                logger.error('Failed to cleanup concurrency slot after queue error:', e)
              )
          }

          throw queueError
        }
      }

      const renewIntervalMs =
        renewIntervalSeconds > 0 ? Math.max(renewIntervalSeconds * 1000, 15000) : 0

      // 使用标志位确保只减少一次
      let concurrencyDecremented = false
      let leaseRenewInterval = null

      if (renewIntervalMs > 0) {
        // 🔴 关键Corrección：添加最大刷新次数Límite，防止租约永不过期
        // Predeterminado最大生存Tiempo为 10 分钟，可通过Variable de entornoConfiguración
        const maxLifetimeMinutes = parseInt(process.env.CONCURRENCY_MAX_LIFETIME_MINUTES) || 10
        const maxRefreshCount = Math.ceil((maxLifetimeMinutes * 60 * 1000) / renewIntervalMs)
        let refreshCount = 0

        leaseRenewInterval = setInterval(() => {
          refreshCount++

          // 超过最大刷新次数，强制停止并Limpiar
          if (refreshCount > maxRefreshCount) {
            logger.warn(
              `⚠️ Lease refresh exceeded max count (${maxRefreshCount}) for key ${validation.keyData.id} (${validation.keyData.name}), forcing cleanup after ${maxLifetimeMinutes} minutes`
            )
            // Limpiar定时器
            if (leaseRenewInterval) {
              clearInterval(leaseRenewInterval)
              leaseRenewInterval = null
            }
            // 强制减少Concurrencia计数（如果还没减少）
            if (!concurrencyDecremented) {
              concurrencyDecremented = true
              redis.decrConcurrency(validation.keyData.id, requestId).catch((error) => {
                logger.error(
                  `Failed to decrement concurrency after max refresh for key ${validation.keyData.id}:`,
                  error
                )
              })
            }
            return
          }

          redis
            .refreshConcurrencyLease(validation.keyData.id, requestId, leaseSeconds)
            .catch((error) => {
              logger.error(
                `Failed to refresh concurrency lease for key ${validation.keyData.id}:`,
                error
              )
            })
        }, renewIntervalMs)

        if (typeof leaseRenewInterval.unref === 'function') {
          leaseRenewInterval.unref()
        }
      }

      const decrementConcurrency = async () => {
        if (!concurrencyDecremented) {
          concurrencyDecremented = true
          hasConcurrencySlot = false
          if (leaseRenewInterval) {
            clearInterval(leaseRenewInterval)
            leaseRenewInterval = null
          }
          try {
            const newCount = await redis.decrConcurrency(validation.keyData.id, requestId)
            logger.api(
              `📉 Decremented concurrency for key: ${validation.keyData.id} (${validation.keyData.name}), new count: ${newCount}`
            )
          } catch (error) {
            logger.error(`Failed to decrement concurrency for key ${validation.keyData.id}:`, error)
          }
        }
      }
      // 升级为完整LimpiarFunción（Incluir leaseRenewInterval Limpiar逻辑）
      // 此时Solicitud已通过认证，后续由 res.close/req.close Evento触发Limpiar
      if (hasConcurrencySlot) {
        concurrencyCleanup = decrementConcurrency
      }

      // 监听最可靠的Evento（避免重复监听）
      // res.on('close') 是最可靠的，会在Conexión关闭时触发
      res.once('close', () => {
        logger.api(
          `🔌 Response closed for key: ${validation.keyData.id} (${validation.keyData.name})`
        )
        decrementConcurrency()
      })

      // req.on('close') 作为备用，ProcesarSolicitud端断开
      req.once('close', () => {
        logger.api(
          `🔌 Request closed for key: ${validation.keyData.id} (${validation.keyData.name})`
        )
        decrementConcurrency()
      })

      req.once('aborted', () => {
        logger.warn(
          `⚠️ Request aborted for key: ${validation.keyData.id} (${validation.keyData.name})`
        )
        decrementConcurrency()
      })

      req.once('error', (error) => {
        logger.error(
          `❌ Request error for key ${validation.keyData.id} (${validation.keyData.name}):`,
          error
        )
        decrementConcurrency()
      })

      res.once('error', (error) => {
        logger.error(
          `❌ Response error for key ${validation.keyData.id} (${validation.keyData.name}):`,
          error
        )
        decrementConcurrency()
      })

      // res.on('finish') Procesar正常Completado的情况
      res.once('finish', () => {
        logger.api(
          `✅ Response finished for key: ${validation.keyData.id} (${validation.keyData.name})`
        )
        decrementConcurrency()
      })

      // 存储ConcurrenciaInformación到SolicitudObjeto，便于后续Procesar
      req.concurrencyInfo = {
        apiKeyId: validation.keyData.id,
        apiKeyName: validation.keyData.name,
        requestId,
        decrementConcurrency
      }
    }

    // VerificarTiempo窗口限流
    const rateLimitWindow = validation.keyData.rateLimitWindow || 0
    const rateLimitRequests = validation.keyData.rateLimitRequests || 0
    const rateLimitCost = validation.keyData.rateLimitCost || 0 // Nueva característica：费用Límite

    // 兼容性Verificar：如果tokenLimit仍有Valor，使用tokenLimit；否则使用rateLimitCost
    const hasRateLimits =
      rateLimitWindow > 0 &&
      (rateLimitRequests > 0 || validation.keyData.tokenLimit > 0 || rateLimitCost > 0)

    if (hasRateLimits) {
      const windowStartKey = `rate_limit:window_start:${validation.keyData.id}`
      const requestCountKey = `rate_limit:requests:${validation.keyData.id}`
      const tokenCountKey = `rate_limit:tokens:${validation.keyData.id}`
      const costCountKey = `rate_limit:cost:${validation.keyData.id}` // Nueva característica：费用计数器

      const now = Date.now()
      const windowDuration = rateLimitWindow * 60 * 1000 // Convertir为毫秒

      // Obtener窗口IniciandoTiempo
      let windowStart = await redis.getClient().get(windowStartKey)

      if (!windowStart) {
        // 第一次Solicitud，Establecer窗口IniciandoTiempo
        await redis.getClient().set(windowStartKey, now, 'PX', windowDuration)
        await redis.getClient().set(requestCountKey, 0, 'PX', windowDuration)
        await redis.getClient().set(tokenCountKey, 0, 'PX', windowDuration)
        await redis.getClient().set(costCountKey, 0, 'PX', windowDuration) // Nueva característica：重置费用
        windowStart = now
      } else {
        windowStart = parseInt(windowStart)

        // Verificar窗口是否已过期
        if (now - windowStart >= windowDuration) {
          // 窗口已过期，重置
          await redis.getClient().set(windowStartKey, now, 'PX', windowDuration)
          await redis.getClient().set(requestCountKey, 0, 'PX', windowDuration)
          await redis.getClient().set(tokenCountKey, 0, 'PX', windowDuration)
          await redis.getClient().set(costCountKey, 0, 'PX', windowDuration) // Nueva característica：重置费用
          windowStart = now
        }
      }

      // Obtener当前计数
      const currentRequests = parseInt((await redis.getClient().get(requestCountKey)) || '0')
      const currentTokens = parseInt((await redis.getClient().get(tokenCountKey)) || '0')
      const currentCost = parseFloat((await redis.getClient().get(costCountKey)) || '0') // Nueva característica：当前费用

      // VerificarSolicitud次数Límite
      if (rateLimitRequests > 0 && currentRequests >= rateLimitRequests) {
        const resetTime = new Date(windowStart + windowDuration)
        const remainingMinutes = Math.ceil((resetTime - now) / 60000)

        logger.security(
          `🚦 Rate limit exceeded (requests) for key: ${validation.keyData.id} (${validation.keyData.name}), requests: ${currentRequests}/${rateLimitRequests}`
        )

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Se ha alcanzado el límite de solicitudes (${rateLimitRequests}), se restablecerá en ${remainingMinutes} minutos`,
          currentRequests,
          requestLimit: rateLimitRequests,
          resetAt: resetTime.toISOString(),
          remainingMinutes
        })
      }

      // 兼容性Verificar：优先使用TokenLímite（历史Datos），否则使用费用Límite
      const tokenLimit = parseInt(validation.keyData.tokenLimit)
      if (tokenLimit > 0) {
        // 使用TokenLímite（向后兼容）
        if (currentTokens >= tokenLimit) {
          const resetTime = new Date(windowStart + windowDuration)
          const remainingMinutes = Math.ceil((resetTime - now) / 60000)

          logger.security(
            `🚦 Rate limit exceeded (tokens) for key: ${validation.keyData.id} (${validation.keyData.name}), tokens: ${currentTokens}/${tokenLimit}`
          )

          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Se ha alcanzado el límite de tokens (${tokenLimit} tokens), se restablecerá en ${remainingMinutes} minutos`,
            currentTokens,
            tokenLimit,
            resetAt: resetTime.toISOString(),
            remainingMinutes
          })
        }
      } else if (rateLimitCost > 0) {
        // 使用费用Límite（新功能）
        if (currentCost >= rateLimitCost) {
          const resetTime = new Date(windowStart + windowDuration)
          const remainingMinutes = Math.ceil((resetTime - now) / 60000)

          logger.security(
            `💰 Rate limit exceeded (cost) for key: ${validation.keyData.id} (${
              validation.keyData.name
            }), cost: $${currentCost.toFixed(2)}/$${rateLimitCost}`
          )

          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Se ha alcanzado el límite de costo ($${rateLimitCost}), se restablecerá en ${remainingMinutes} minutos`,
            currentCost,
            costLimit: rateLimitCost,
            resetAt: resetTime.toISOString(),
            remainingMinutes
          })
        }
      }

      // 增加Solicitud计数
      await redis.getClient().incr(requestCountKey)

      // 存储限流Información到SolicitudObjeto
      req.rateLimitInfo = {
        windowStart,
        windowDuration,
        requestCountKey,
        tokenCountKey,
        costCountKey, // Nueva característica：费用计数器
        currentRequests: currentRequests + 1,
        currentTokens,
        currentCost, // Nueva característica：当前费用
        rateLimitRequests,
        tokenLimit,
        rateLimitCost // Nueva característica：费用Límite
      }
    }

    // Verificar每日费用Límite
    const dailyCostLimit = validation.keyData.dailyCostLimit || 0
    if (dailyCostLimit > 0) {
      const dailyCost = validation.keyData.dailyCost || 0

      if (dailyCost >= dailyCostLimit) {
        logger.security(
          `💰 Daily cost limit exceeded for key: ${validation.keyData.id} (${
            validation.keyData.name
          }), cost: $${dailyCost.toFixed(2)}/$${dailyCostLimit}`
        )

        // Usar 402 Payment Required en lugar de 429 para evitar reintentos automáticos
        return res.status(402).json({
          error: {
            type: 'insufficient_quota',
            message: `Se ha alcanzado el límite de costo diario ($${dailyCostLimit})`,
            code: 'daily_cost_limit_exceeded'
          },
          currentCost: dailyCost,
          costLimit: dailyCostLimit,
          resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
        })
      }

      // Registro当前费用使用情况
      logger.api(
        `💰 Cost usage for key: ${validation.keyData.id} (${
          validation.keyData.name
        }), current: $${dailyCost.toFixed(2)}/$${dailyCostLimit}`
      )
    }

    // Verificar总费用Límite
    const totalCostLimit = validation.keyData.totalCostLimit || 0
    if (totalCostLimit > 0) {
      const totalCost = validation.keyData.totalCost || 0

      if (totalCost >= totalCostLimit) {
        logger.security(
          `💰 Total cost limit exceeded for key: ${validation.keyData.id} (${
            validation.keyData.name
          }), cost: $${totalCost.toFixed(2)}/$${totalCostLimit}`
        )

        // Usar 402 Payment Required en lugar de 429 para evitar reintentos automáticos
        return res.status(402).json({
          error: {
            type: 'insufficient_quota',
            message: `Se ha alcanzado el límite de costo total ($${totalCostLimit})`,
            code: 'total_cost_limit_exceeded'
          },
          currentCost: totalCost,
          costLimit: totalCostLimit
        })
      }

      logger.api(
        `💰 Total cost usage for key: ${validation.keyData.id} (${
          validation.keyData.name
        }), current: $${totalCost.toFixed(2)}/$${totalCostLimit}`
      )
    }

    // Verificar Claude 周费用Límite
    const weeklyOpusCostLimit = validation.keyData.weeklyOpusCostLimit || 0
    if (weeklyOpusCostLimit > 0) {
      // 从Solicitud中Obtener模型Información
      const requestBody = req.body || {}
      const model = requestBody.model || ''

      // 判断是否为 Claude 模型
      if (isOpusModel(model)) {
        const weeklyOpusCost = validation.keyData.weeklyOpusCost || 0

        if (weeklyOpusCost >= weeklyOpusCostLimit) {
          logger.security(
            `💰 Weekly Claude cost limit exceeded for key: ${validation.keyData.id} (${
              validation.keyData.name
            }), cost: $${weeklyOpusCost.toFixed(2)}/$${weeklyOpusCostLimit}`
          )

          // Calcular下周一的重置Tiempo
          const now = new Date()
          const dayOfWeek = now.getDay()
          const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7
          const resetDate = new Date(now)
          resetDate.setDate(now.getDate() + daysUntilMonday)
          resetDate.setHours(0, 0, 0, 0)

          // Usar 402 Payment Required en lugar de 429 para evitar reintentos automáticos
          return res.status(402).json({
            error: {
              type: 'insufficient_quota',
              message: `Se ha alcanzado el límite de costo semanal del modelo Opus ($${weeklyOpusCostLimit})`,
              code: 'weekly_opus_cost_limit_exceeded'
            },
            currentCost: weeklyOpusCost,
            costLimit: weeklyOpusCostLimit,
            resetAt: resetDate.toISOString()
          })
        }

        // Registro当前 Claude 费用使用情况
        logger.api(
          `💰 Claude weekly cost usage for key: ${validation.keyData.id} (${
            validation.keyData.name
          }), current: $${weeklyOpusCost.toFixed(2)}/$${weeklyOpusCostLimit}`
        )
      }
    }

    // 将ValidarInformación添加到SolicitudObjeto（只Incluir必要Información）
    req.apiKey = {
      id: validation.keyData.id,
      name: validation.keyData.name,
      tokenLimit: validation.keyData.tokenLimit,
      claudeAccountId: validation.keyData.claudeAccountId,
      claudeConsoleAccountId: validation.keyData.claudeConsoleAccountId, // 添加 Claude Console 账号ID
      geminiAccountId: validation.keyData.geminiAccountId,
      openaiAccountId: validation.keyData.openaiAccountId, // 添加 OpenAI 账号ID
      bedrockAccountId: validation.keyData.bedrockAccountId, // 添加 Bedrock 账号ID
      droidAccountId: validation.keyData.droidAccountId,
      permissions: validation.keyData.permissions,
      concurrencyLimit: validation.keyData.concurrencyLimit,
      rateLimitWindow: validation.keyData.rateLimitWindow,
      rateLimitRequests: validation.keyData.rateLimitRequests,
      rateLimitCost: validation.keyData.rateLimitCost, // Nueva característica：费用Límite
      enableModelRestriction: validation.keyData.enableModelRestriction,
      restrictedModels: validation.keyData.restrictedModels,
      enableClientRestriction: validation.keyData.enableClientRestriction,
      allowedClients: validation.keyData.allowedClients,
      dailyCostLimit: validation.keyData.dailyCostLimit,
      dailyCost: validation.keyData.dailyCost,
      totalCostLimit: validation.keyData.totalCostLimit,
      totalCost: validation.keyData.totalCost
    }

    const authDuration = Date.now() - startTime
    const userAgent = req.headers['user-agent'] || 'No User-Agent'
    logger.api(
      `🔓 Authenticated request from key: ${validation.keyData.name} (${validation.keyData.id}) in ${authDuration}ms`
    )
    logger.api(`   User-Agent: "${userAgent}"`)

    return next()
  } catch (error) {
    authErrored = true
    const authDuration = Date.now() - startTime
    logger.error(`❌ Authentication middleware error (${authDuration}ms):`, {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    })

    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    })
  } finally {
    if (authErrored && typeof concurrencyCleanup === 'function') {
      try {
        await concurrencyCleanup()
      } catch (cleanupError) {
        logger.error('Failed to cleanup concurrency after auth error:', cleanupError)
      }
    }
  }
}

// 🛡️ 管理员ValidarMiddleware（Optimización版）
const authenticateAdmin = async (req, res, next) => {
  const startTime = Date.now()

  try {
    // Seguridad提取token，Soportar多种方式
    const token =
      req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      req.cookies?.adminToken ||
      req.headers['x-admin-token']

    if (!token) {
      logger.security(`Missing admin token attempt from ${req.ip || 'unknown'}`)
      return res.status(401).json({
        error: 'Missing admin token',
        message: 'Please provide an admin token'
      })
    }

    // 基本tokenFormatoValidar
    if (typeof token !== 'string' || token.length < 32 || token.length > 512) {
      logger.security(`Invalid admin token format from ${req.ip || 'unknown'}`)
      return res.status(401).json({
        error: 'Invalid admin token format',
        message: 'Admin token format is invalid'
      })
    }

    // Obtener管理员Sesión（带Tiempo de espera agotadoProcesar）
    const adminSession = await Promise.race([
      redis.getSession(token),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session lookup timeout')), 5000)
      )
    ])

    if (!adminSession || Object.keys(adminSession).length === 0) {
      logger.security(`Invalid admin token attempt from ${req.ip || 'unknown'}`)
      return res.status(401).json({
        error: 'Invalid admin token',
        message: 'Invalid or expired admin session'
      })
    }

    // 🔒 SeguridadCorrección：ValidarSesión必须Campo（防止伪造Sesión绕过认证）
    if (!adminSession.username || !adminSession.loginTime) {
      logger.security(
        `🔒 Corrupted admin session from ${req.ip || 'unknown'} - missing required fields (username: ${!!adminSession.username}, loginTime: ${!!adminSession.loginTime})`
      )
      await redis.deleteSession(token) // Limpiar无效/伪造的Sesión
      return res.status(401).json({
        error: 'Invalid session',
        message: 'Session data corrupted or incomplete'
      })
    }

    // VerificarSesión活跃性（Opcional：Verificar最后活动Tiempo）
    const now = new Date()
    const lastActivity = new Date(adminSession.lastActivity || adminSession.loginTime)
    const inactiveDuration = now - lastActivity
    const maxInactivity = 24 * 60 * 60 * 1000 // 24小时

    if (inactiveDuration > maxInactivity) {
      logger.security(
        `🔒 Expired admin session for ${adminSession.username} from ${req.ip || 'unknown'}`
      )
      await redis.deleteSession(token) // Limpiar过期Sesión
      return res.status(401).json({
        error: 'Session expired',
        message: 'Admin session has expired due to inactivity'
      })
    }

    // Actualizar最后活动Tiempo（Asíncrono，不BloqueanteSolicitud）
    redis
      .setSession(
        token,
        {
          ...adminSession,
          lastActivity: now.toISOString()
        },
        86400
      )
      .catch((error) => {
        logger.error('Failed to update admin session activity:', error)
      })

    // Establecer管理员Información（只Incluir必要Información）
    req.admin = {
      username: adminSession.username,
      sessionId: token,
      loginTime: adminSession.loginTime
    }

    const authDuration = Date.now() - startTime
    req._authInfo = `${adminSession.username} ${authDuration}ms`
    logger.security(`Admin authenticated: ${adminSession.username} in ${authDuration}ms`)

    return next()
  } catch (error) {
    const authDuration = Date.now() - startTime
    logger.error(`❌ Admin authentication error (${authDuration}ms):`, {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    })

    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during admin authentication'
    })
  }
}

// 👤 UsuarioValidarMiddleware
const authenticateUser = async (req, res, next) => {
  const startTime = Date.now()

  try {
    // Seguridad提取Usuariosession token，Soportar多种方式
    const sessionToken =
      req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      req.cookies?.userToken ||
      req.headers['x-user-token']

    if (!sessionToken) {
      logger.security(`Missing user session token attempt from ${req.ip || 'unknown'}`)
      return res.status(401).json({
        error: 'Missing user session token',
        message: 'Please login to access this resource'
      })
    }

    // 基本tokenFormatoValidar
    if (typeof sessionToken !== 'string' || sessionToken.length < 32 || sessionToken.length > 128) {
      logger.security(`Invalid user session token format from ${req.ip || 'unknown'}`)
      return res.status(401).json({
        error: 'Invalid session token format',
        message: 'Session token format is invalid'
      })
    }

    // ValidarUsuarioSesión
    const sessionValidation = await userService.validateUserSession(sessionToken)

    if (!sessionValidation) {
      logger.security(`Invalid user session token attempt from ${req.ip || 'unknown'}`)
      return res.status(401).json({
        error: 'Invalid session token',
        message: 'Invalid or expired user session'
      })
    }

    const { session, user } = sessionValidation

    // VerificarUsuario是否被Deshabilitar
    if (!user.isActive) {
      logger.security(
        `🔒 Disabled user login attempt: ${user.username} from ${req.ip || 'unknown'}`
      )
      return res.status(403).json({
        error: 'Account disabled',
        message: 'Your account has been disabled. Please contact administrator.'
      })
    }

    // EstablecerUsuarioInformación（只Incluir必要Información）
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      sessionToken,
      sessionCreatedAt: session.createdAt
    }

    const authDuration = Date.now() - startTime
    logger.info(`👤 User authenticated: ${user.username} (${user.id}) in ${authDuration}ms`)

    return next()
  } catch (error) {
    const authDuration = Date.now() - startTime
    logger.error(`❌ User authentication error (${authDuration}ms):`, {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    })

    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during user authentication'
    })
  }
}

// 👤 Usuario或管理员ValidarMiddleware（Soportar两种身份）
const authenticateUserOrAdmin = async (req, res, next) => {
  const startTime = Date.now()

  try {
    // Verificar是否有管理员token
    const adminToken =
      req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      req.cookies?.adminToken ||
      req.headers['x-admin-token']

    // Verificar是否有Usuariosession token
    const userToken =
      req.headers['x-user-token'] ||
      req.cookies?.userToken ||
      (!adminToken ? req.headers['authorization']?.replace(/^Bearer\s+/i, '') : null)

    // 优先尝试管理员认证
    if (adminToken) {
      try {
        const adminSession = await redis.getSession(adminToken)
        if (adminSession && Object.keys(adminSession).length > 0) {
          // 🔒 SeguridadCorrección：ValidarSesión必须Campo（与 authenticateAdmin 保持一致）
          if (!adminSession.username || !adminSession.loginTime) {
            logger.security(
              `🔒 Corrupted admin session in authenticateUserOrAdmin from ${req.ip || 'unknown'} - missing required fields (username: ${!!adminSession.username}, loginTime: ${!!adminSession.loginTime})`
            )
            await redis.deleteSession(adminToken) // Limpiar无效/伪造的Sesión
            // 不Retornar 401，继续尝试Usuario认证
          } else {
            req.admin = {
              username: adminSession.username,
              sessionId: adminToken,
              loginTime: adminSession.loginTime
            }
            req.userType = 'admin'

            const authDuration = Date.now() - startTime
            req._authInfo = `${adminSession.username} ${authDuration}ms`
            logger.security(`Admin authenticated: ${adminSession.username} in ${authDuration}ms`)
            return next()
          }
        }
      } catch (error) {
        logger.debug('Admin authentication failed, trying user authentication:', error.message)
      }
    }

    // 尝试Usuario认证
    if (userToken) {
      try {
        const sessionValidation = await userService.validateUserSession(userToken)
        if (sessionValidation) {
          const { session, user } = sessionValidation

          if (user.isActive) {
            req.user = {
              id: user.id,
              username: user.username,
              email: user.email,
              displayName: user.displayName,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              sessionToken: userToken,
              sessionCreatedAt: session.createdAt
            }
            req.userType = 'user'

            const authDuration = Date.now() - startTime
            logger.info(`👤 User authenticated: ${user.username} (${user.id}) in ${authDuration}ms`)
            return next()
          }
        }
      } catch (error) {
        logger.debug('User authentication failed:', error.message)
      }
    }

    // 如果都Falló了，Retornar未授权
    logger.security(`Authentication failed from ${req.ip || 'unknown'}`)
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please login as user or admin to access this resource'
    })
  } catch (error) {
    const authDuration = Date.now() - startTime
    logger.error(`❌ User/Admin authentication error (${authDuration}ms):`, {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    })

    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    })
  }
}

// 🛡️ PermisoVerificarMiddleware
const requireRole = (allowedRoles) => (req, res, next) => {
  // 管理员始终有Permiso
  if (req.admin) {
    return next()
  }

  // VerificarUsuarioRol
  if (req.user) {
    const userRole = req.user.role
    const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

    if (allowed.includes(userRole)) {
      return next()
    } else {
      logger.security(
        `🚫 Access denied for user ${req.user.username} (role: ${userRole}) to ${req.originalUrl}`
      )
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This resource requires one of the following roles: ${allowed.join(', ')}`
      })
    }
  }

  return res.status(401).json({
    error: 'Authentication required',
    message: 'Please login to access this resource'
  })
}

// 🔒 管理员PermisoVerificarMiddleware
const requireAdmin = (req, res, next) => {
  if (req.admin) {
    return next()
  }

  // Verificar是否是adminRol的Usuario
  if (req.user && req.user.role === 'admin') {
    return next()
  }

  logger.security(
    `🚫 Admin access denied for ${req.user?.username || 'unknown'} from ${req.ip || 'unknown'}`
  )
  return res.status(403).json({
    error: 'Admin access required',
    message: 'This resource requires administrator privileges'
  })
}

// 注意：使用Estadística现在直接在/api/v1/messagesRuta中Procesar，
// 以便从Claude APIRespuesta中提取真实的usageDatos

// 🚦 CORSMiddleware（Optimización版，SoportarChromeComplemento）
const corsMiddleware = (req, res, next) => {
  const { origin } = req.headers

  // 允许的源（可以从ConfiguraciónArchivoLeer）
  const allowedOrigins = [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000'
  ]

  // 🆕 Verificar是否为ChromeComplementoSolicitud
  const isChromeExtension = origin && origin.startsWith('chrome-extension://')

  // EstablecerCORS头
  if (allowedOrigins.includes(origin) || !origin || isChromeExtension) {
    res.header('Access-Control-Allow-Origin', origin || '*')
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header(
    'Access-Control-Allow-Headers',
    [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'x-api-key',
      'x-goog-api-key',
      'api-key',
      'x-admin-token',
      'anthropic-version',
      'anthropic-dangerous-direct-browser-access'
    ].join(', ')
  )

  res.header('Access-Control-Expose-Headers', ['X-Request-ID', 'Content-Type'].join(', '))

  res.header('Access-Control-Max-Age', '86400') // 24小时预检Caché
  res.header('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
  } else {
    next()
  }
}

// 📝 SolicitudRegistroMiddleware（Optimización版）
const requestLogger = (req, res, next) => {
  const start = Date.now()
  const requestId = Math.random().toString(36).substring(2, 15)

  // 添加SolicitudID到SolicitudObjeto
  req.requestId = requestId
  res.setHeader('X-Request-ID', requestId)

  // ObtenerClienteInformación
  const clientIP = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown'
  const userAgent = req.get('User-Agent') || 'unknown'
  const referer = req.get('Referer') || 'none'

  // SolicitudIniciando → debug 级别（减少正常Solicitud的Registro量）
  const isDebugRoute = req.originalUrl.includes('event_logging')
  if (req.originalUrl !== '/health') {
    logger.debug(`▶ [${requestId}] ${req.method} ${req.originalUrl}`, {
      ip: clientIP,
      body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined
    })
  }

  // 拦截 res.json() 捕获Respuesta体
  const originalJson = res.json.bind(res)
  res.json = (body) => {
    res._responseBody = body
    return originalJson(body)
  }

  res.on('finish', () => {
    if (req.originalUrl === '/health') {
      return
    }
    const duration = Date.now() - start
    const contentLength = res.get('Content-Length') || '0'
    const status = res.statusCode

    // 状态 emoji
    const emoji = status >= 500 ? '❌' : status >= 400 ? '⚠️ ' : '🟢'
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

    // 主消息Fila
    const msg = `${emoji} ${status} ${req.method} ${req.originalUrl}  ${duration}ms ${contentLength}B`

    // Construir树形 metadata
    const meta = { requestId }

    // Solicitud体（非 GET 且有内容时显示）
    if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
      meta.req = req.body
    }

    // ConsultaParámetro（GET Solicitud且有ConsultaParámetro时单独显示）
    const queryIdx = req.originalUrl.indexOf('?')
    if (queryIdx > -1) {
      meta.query = req.originalUrl.substring(queryIdx + 1)
    }

    // Respuesta体
    if (res._responseBody) {
      meta.res = res._responseBody
    }

    // API Key Información（合并到同一条Registro）
    if (req.apiKey) {
      meta.key = `${req.apiKey.name} (${req.apiKey.id})`
    }

    // 认证Información
    if (req._authInfo) {
      meta.auth = req._authInfo
    }

    // 完整InformaciónEscribirArchivo
    meta.ip = clientIP
    meta.ua = userAgent
    meta.referer = referer

    if (isDebugRoute) {
      logger.debug(msg, meta)
    } else {
      logger[level](msg, meta)
    }

    // 慢SolicitudAdvertencia
    if (duration > 5000) {
      logger.warn(`🐌 Slow request: ${duration}ms ${req.method} ${req.originalUrl}`)
    }
  })

  res.on('error', (error) => {
    const duration = Date.now() - start
    logger.error(`💥 [${requestId}] Response error after ${duration}ms:`, error)
  })

  next()
}

// 🛡️ Middleware de seguridad（增强版）
const securityMiddleware = (req, res, next) => {
  // Establecer基础Seguridad头
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // 添加更多Seguridad头
  res.setHeader('X-DNS-Prefetch-Control', 'off')
  res.setHeader('X-Download-Options', 'noopen')
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')

  // Cross-Origin-Opener-Policy (仅对可信来源Establecer)
  const host = req.get('host') || ''
  const isLocalhost =
    host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0')
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https'

  if (isLocalhost || isHttps) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    res.setHeader('Origin-Agent-Cluster', '?1')
  }

  // Content Security Policy (适用于web界面)
  if (req.path.startsWith('/web') || req.path === '/') {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.bootcdn.net",
        "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.bootcdn.net",
        "font-src 'self' https://cdnjs.cloudflare.com https://cdn.bootcdn.net",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ')
    )
  }

  // Strict Transport Security (HTTPS)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }

  // Eliminación泄露Servicio器Información的头
  res.removeHeader('X-Powered-By')
  res.removeHeader('Server')

  // 防止Información泄露
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  next()
}

// 🚨 ErrorProcesarMiddleware（增强版）
const errorHandler = (error, req, res, _next) => {
  const requestId = req.requestId || 'unknown'
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Registro详细ErrorInformación
  logger.error(`💥 [${requestId}] Unhandled error:`, {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    apiKey: req.apiKey ? req.apiKey.id : 'none',
    admin: req.admin ? req.admin.username : 'none'
  })

  // 确定HTTP状态码
  let statusCode = 500
  let errorMessage = 'Internal Server Error'
  let userMessage = 'Something went wrong'

  if (error.status && error.status >= 400 && error.status < 600) {
    statusCode = error.status
  }

  // 根据ErrorTipo提供友好的Error消息
  switch (error.name) {
    case 'ValidationError':
      statusCode = 400
      errorMessage = 'Validation Error'
      userMessage = 'Invalid input data'
      break
    case 'CastError':
      statusCode = 400
      errorMessage = 'Cast Error'
      userMessage = 'Invalid data format'
      break
    case 'MongoError':
    case 'RedisError':
      statusCode = 503
      errorMessage = 'Database Error'
      userMessage = 'Database temporarily unavailable'
      break
    case 'TimeoutError':
      statusCode = 408
      errorMessage = 'Request Timeout'
      userMessage = 'Request took too long to process'
      break
    default:
      if (error.message && !isDevelopment) {
        // 在生产环境中，只显示Seguridad的Error消息
        if (error.message.includes('ECONNREFUSED')) {
          userMessage = 'Service temporarily unavailable'
        } else if (error.message.includes('timeout')) {
          userMessage = 'Request timeout'
        }
      }
  }

  // EstablecerRespuesta头
  res.setHeader('X-Request-ID', requestId)

  // ConstruirErrorRespuesta
  const errorResponse = {
    error: errorMessage,
    message: isDevelopment ? error.message : userMessage,
    requestId,
    timestamp: new Date().toISOString()
  }

  // 在开发环境中Incluir更多DepurarInformación
  if (isDevelopment) {
    errorResponse.stack = error.stack
    errorResponse.url = req.originalUrl
    errorResponse.method = req.method
  }

  res.status(statusCode).json(errorResponse)
}

// 🌐 全局速率LímiteMiddleware（延迟Inicializar）
// const rateLimiter = null // 暂时未使用

// 暂时注释掉未使用的Función
// const getRateLimiter = () => {
//   if (!rateLimiter) {
//     try {
//       const client = redis.getClient()
//       if (!client) {
//         logger.warn('⚠️ Redis client not available for rate limiter')
//         return null
//       }
//
//       rateLimiter = new RateLimiterRedis({
//         storeClient: client,
//         keyPrefix: 'global_rate_limit',
//         points: 1000, // Solicitud数量
//         duration: 900, // 15分钟 (900秒)
//         blockDuration: 900 // BloqueanteTiempo15分钟
//       })
//
//       logger.info('✅ Rate limiter initialized successfully')
//     } catch (error) {
//       logger.warn('⚠️ Rate limiter initialization failed, using fallback', { error: error.message })
//       return null
//     }
//   }
//   return rateLimiter
// }

const globalRateLimit = async (req, res, next) =>
  // 已Deshabilitar全局IP限流 - 直接跳过所有Solicitud
  next()

// 以下代码已被Deshabilitar
/*
  // 跳过Verificación de salud和内部Solicitud
  if (req.path === '/health' || req.path === '/api/health') {
    return next()
  }

  const limiter = getRateLimiter()
  if (!limiter) {
    // 如果Redis不可用，直接跳过速率Límite
    return next()
  }

  const clientIP = req.ip || req.connection?.remoteAddress || 'unknown'

  try {
    await limiter.consume(clientIP)
    return next()
  } catch (rejRes) {
    const remainingPoints = rejRes.remainingPoints || 0
    const msBeforeNext = rejRes.msBeforeNext || 900000

    logger.security(`🚦 Global rate limit exceeded for IP: ${clientIP}`)

    res.set({
      'Retry-After': Math.round(msBeforeNext / 1000) || 900,
      'X-RateLimit-Limit': 1000,
      'X-RateLimit-Remaining': remainingPoints,
      'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString()
    })

    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(msBeforeNext / 1000)
    })
  }
  */

// 📊 Límite de tamaño de solicitudMiddleware
const requestSizeLimit = (req, res, next) => {
  const MAX_SIZE_MB = parseInt(process.env.REQUEST_MAX_SIZE_MB || '100', 10)
  const maxSize = MAX_SIZE_MB * 1024 * 1024
  const contentLength = parseInt(req.headers['content-length'] || '0')

  if (contentLength > maxSize) {
    logger.security(`🚨 Request too large: ${contentLength} bytes from ${req.ip}`)
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body size exceeds limit',
      limit: `${MAX_SIZE_MB}MB`
    })
  }

  return next()
}

module.exports = {
  authenticateApiKey,
  authenticateAdmin,
  authenticateUser,
  authenticateUserOrAdmin,
  requireRole,
  requireAdmin,
  corsMiddleware,
  requestLogger,
  securityMiddleware,
  errorHandler,
  globalRateLimit,
  requestSizeLimit
}
