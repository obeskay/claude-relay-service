const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const claudeConsoleAccountService = require('../account/claudeConsoleAccountService')
const redis = require('../../models/redis')
const logger = require('../../utils/logger')
const config = require('../../../config/config')
const {
  sanitizeUpstreamError,
  sanitizeErrorMessage,
  isAccountDisabledError
} = require('../../utils/errorSanitizer')
const upstreamErrorHelper = require('../../utils/upstreamErrorHelper')
const userMessageQueueService = require('../userMessageQueueService')
const { isStreamWritable } = require('../../utils/streamHelper')
const { filterForClaude } = require('../../utils/headerFilter')

class ClaudeConsoleRelayService {
  constructor() {
    this.defaultUserAgent = 'claude-cli/2.0.52 (external, cli)'
  }

  // 🚀 转发Solicitud到Claude Console API
  async relayRequest(
    requestBody,
    apiKeyData,
    clientRequest,
    clientResponse,
    clientHeaders,
    accountId,
    options = {}
  ) {
    let abortController = null
    let account = null
    const requestId = uuidv4() // 用于ConcurrenciaRastreo
    let concurrencyAcquired = false
    let queueLockAcquired = false
    let queueRequestId = null

    try {
      // 📬 Usuario消息ColaProcesar：如果是Usuario消息Solicitud，需要ObtenerCola锁
      if (userMessageQueueService.isUserMessageRequest(requestBody)) {
        // 校验 accountId 非空，避免空Valor污染Cola锁键
        if (!accountId || accountId === '') {
          logger.error('❌ accountId missing for queue lock in console relayRequest')
          throw new Error('accountId missing for queue lock')
        }
        const queueResult = await userMessageQueueService.acquireQueueLock(accountId)
        if (!queueResult.acquired && !queueResult.skipped) {
          // 区分 Redis 后端Error和ColaTiempo de espera agotado
          const isBackendError = queueResult.error === 'queue_backend_error'
          const errorCode = isBackendError ? 'QUEUE_BACKEND_ERROR' : 'QUEUE_TIMEOUT'
          const errorType = isBackendError ? 'queue_backend_error' : 'queue_timeout'
          const errorMessage = isBackendError
            ? 'Queue service temporarily unavailable, please retry later'
            : 'User message queue wait timeout, please retry later'
          const statusCode = isBackendError ? 500 : 503

          // 结构化RendimientoRegistro，用于后续Estadística
          logger.performance('user_message_queue_error', {
            errorType,
            errorCode,
            accountId,
            statusCode,
            apiKeyName: apiKeyData.name,
            backendError: isBackendError ? queueResult.errorMessage : undefined
          })

          logger.warn(
            `📬 User message queue ${errorType} for console account ${accountId}, key: ${apiKeyData.name}`,
            isBackendError ? { backendError: queueResult.errorMessage } : {}
          )
          return {
            statusCode,
            headers: {
              'Content-Type': 'application/json',
              'x-user-message-queue-error': errorType
            },
            body: JSON.stringify({
              type: 'error',
              error: {
                type: errorType,
                message: errorMessage
              }
            }),
            accountId
          }
        }
        if (queueResult.acquired && !queueResult.skipped) {
          queueLockAcquired = true
          queueRequestId = queueResult.requestId
          logger.debug(
            `📬 User message queue lock acquired for console account ${accountId}, requestId: ${queueRequestId}`
          )
        }
      }

      // ObtenerCuentaInformación
      account = await claudeConsoleAccountService.getAccount(accountId)
      if (!account) {
        throw new Error('Claude Console Claude account not found')
      }

      const autoProtectionDisabled = account.disableAutoProtection === true

      logger.info(
        `📤 Processing Claude Console API request for key: ${apiKeyData.name || apiKeyData.id}, account: ${account.name} (${accountId}), request: ${requestId}`
      )

      // 🔒 Concurrencia控制：原子性抢占槽位
      if (account.maxConcurrentTasks > 0) {
        // 先抢占，再Verificar - 避免竞态Condición
        const newConcurrency = Number(
          await redis.incrConsoleAccountConcurrency(accountId, requestId, 600)
        )
        concurrencyAcquired = true

        // Verificar是否超过Límite
        if (newConcurrency > account.maxConcurrentTasks) {
          // 超限，立即回滚
          await redis.decrConsoleAccountConcurrency(accountId, requestId)
          concurrencyAcquired = false

          logger.warn(
            `⚠️ Console account ${account.name} (${accountId}) concurrency limit exceeded: ${newConcurrency}/${account.maxConcurrentTasks} (request: ${requestId}, rolled back)`
          )

          const error = new Error('Console account concurrency limit reached')
          error.code = 'CONSOLE_ACCOUNT_CONCURRENCY_FULL'
          error.accountId = accountId
          throw error
        }

        logger.debug(
          `🔓 Acquired concurrency slot for account ${account.name} (${accountId}), current: ${newConcurrency}/${account.maxConcurrentTasks}, request: ${requestId}`
        )
      }
      logger.debug(`🌐 Account API URL: ${account.apiUrl}`)
      logger.debug(`🔍 Account supportedModels: ${JSON.stringify(account.supportedModels)}`)
      logger.debug(`🔑 Account has apiKey: ${!!account.apiKey}`)
      logger.debug(`📝 Request model: ${requestBody.model}`)

      // Procesar模型映射
      let mappedModel = requestBody.model
      if (
        account.supportedModels &&
        typeof account.supportedModels === 'object' &&
        !Array.isArray(account.supportedModels)
      ) {
        const newModel = claudeConsoleAccountService.getMappedModel(
          account.supportedModels,
          requestBody.model
        )
        if (newModel !== requestBody.model) {
          logger.info(`🔄 Mapping model from ${requestBody.model} to ${newModel}`)
          mappedModel = newModel
        }
      }

      // Crear修改后的Solicitud体
      const modifiedRequestBody = {
        ...requestBody,
        model: mappedModel
      }

      // 模型兼容性Verificar已经在调度器中Completado，这里不需要再Verificar

      // CrearProxyagent
      const proxyAgent = claudeConsoleAccountService._createProxyAgent(account.proxy)

      // CrearAbortController用于取消Solicitud
      abortController = new AbortController()

      // EstablecerCliente断开Escucha
      const handleClientDisconnect = () => {
        logger.info('🔌 Client disconnected, aborting Claude Console Claude request')
        if (abortController && !abortController.signal.aborted) {
          abortController.abort()
        }
      }

      // 监听Cliente断开Evento
      if (clientRequest) {
        clientRequest.once('close', handleClientDisconnect)
      }
      if (clientResponse) {
        clientResponse.once('close', handleClientDisconnect)
      }

      // Construir完整的API URL
      // Construir完整的API URL
      const cleanUrl = account.apiUrl.replace(/\/$/, '') // Eliminación末尾斜杠
      let apiEndpoint

      if (options.customPath) {
        // 如果指定了自定义Ruta（如 /v1/messages/count_tokens）
        // 尝试从 cleanUrl 中提取 base URL
        let baseUrl = cleanUrl

        // 1. 如果Configuración的是完整Ruta .../v1/messages，去掉 /v1/messages
        if (baseUrl.endsWith('/v1/messages')) {
          baseUrl = baseUrl.substring(0, baseUrl.length - '/v1/messages'.length)
        }
        // 2. 如果Configuración的是 .../v1，去掉 /v1
        else if (baseUrl.endsWith('/v1')) {
          baseUrl = baseUrl.substring(0, baseUrl.length - '/v1'.length)
        }

        // 确保 customPath 以 / 开头
        const path = options.customPath.startsWith('/')
          ? options.customPath
          : `/${options.customPath}`
        apiEndpoint = `${baseUrl}${path}`
      } else {
        // Predeterminado使用 messages Endpoint
        if (cleanUrl.endsWith('/v1/messages')) {
          apiEndpoint = cleanUrl
        } else if (cleanUrl.endsWith('/v1')) {
          apiEndpoint = `${cleanUrl}/messages`
        } else {
          apiEndpoint = `${cleanUrl}/v1/messages`
        }
      }

      logger.debug(`🎯 Final API endpoint: ${apiEndpoint}`)
      logger.debug(`[DEBUG] Options passed to relayRequest: ${JSON.stringify(options)}`)
      logger.debug(`[DEBUG] Client headers received: ${JSON.stringify(clientHeaders)}`)

      // FiltrarClienteSolicitud头
      const filteredHeaders = this._filterClientHeaders(clientHeaders)
      logger.debug(`[DEBUG] Filtered client headers: ${JSON.stringify(filteredHeaders)}`)

      // 决定使用的 User-Agent：优先使用Cuenta自定义的，否则透传Cliente的，最后才使用PredeterminadoValor
      const userAgent =
        account.userAgent ||
        clientHeaders?.['user-agent'] ||
        clientHeaders?.['User-Agent'] ||
        this.defaultUserAgent

      // 准备SolicitudConfiguración
      const requestConfig = {
        method: 'POST',
        url: apiEndpoint,
        data: modifiedRequestBody,
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'User-Agent': userAgent,
          ...filteredHeaders
        },
        timeout: config.requestTimeout || 600000,
        signal: abortController.signal,
        validateStatus: () => true // 接受所有状态码
      }

      if (proxyAgent) {
        requestConfig.httpAgent = proxyAgent
        requestConfig.httpsAgent = proxyAgent
        requestConfig.proxy = false
      }

      // 根据 API Key Formato选择认证方式
      if (account.apiKey && account.apiKey.startsWith('sk-ant-')) {
        // Anthropic 官方 API Key 使用 x-api-key
        requestConfig.headers['x-api-key'] = account.apiKey
        logger.debug('[DEBUG] Using x-api-key authentication for sk-ant-* API key')
      } else {
        // 其他 API Key 使用 Authorization Bearer
        requestConfig.headers['Authorization'] = `Bearer ${account.apiKey}`
        logger.debug('[DEBUG] Using Authorization Bearer authentication')
      }

      logger.debug(
        `[DEBUG] Initial headers before beta: ${JSON.stringify(requestConfig.headers, null, 2)}`
      )

      // 添加beta header如果需要
      if (options.betaHeader) {
        logger.debug(`[DEBUG] Adding beta header: ${options.betaHeader}`)
        requestConfig.headers['anthropic-beta'] = options.betaHeader
      } else {
        logger.debug('[DEBUG] No beta header to add')
      }

      // 发送Solicitud
      logger.debug(
        '📤 Sending request to Claude Console API with headers:',
        JSON.stringify(requestConfig.headers, null, 2)
      )
      const response = await axios(requestConfig)

      // 📬 Solicitud已发送Éxito，立即释放Cola锁（无需等待RespuestaProcesarCompletado）
      // 因为 Claude API 限流基于Solicitud发送时刻Calcular（RPM），不是SolicitudCompletado时刻
      if (queueLockAcquired && queueRequestId && accountId) {
        try {
          await userMessageQueueService.releaseQueueLock(accountId, queueRequestId)
          queueLockAcquired = false // 标记已释放，防止 finally 重复释放
          logger.debug(
            `📬 User message queue lock released early for console account ${accountId}, requestId: ${queueRequestId}`
          )
        } catch (releaseError) {
          logger.error(
            `❌ Failed to release user message queue lock early for console account ${accountId}:`,
            releaseError.message
          )
        }
      }

      // EliminaciónEscucha（SolicitudÉxitoCompletado）
      if (clientRequest) {
        clientRequest.removeListener('close', handleClientDisconnect)
      }
      if (clientResponse) {
        clientResponse.removeListener('close', handleClientDisconnect)
      }

      logger.debug(`🔗 Claude Console API response: ${response.status}`)
      logger.debug(`[DEBUG] Response headers: ${JSON.stringify(response.headers)}`)
      logger.debug(`[DEBUG] Response data type: ${typeof response.data}`)
      logger.debug(
        `[DEBUG] Response data length: ${response.data ? (typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length) : 0}`
      )

      // 对于ErrorRespuesta，Registro原始Error和Limpiar后的预览
      if (response.status < 200 || response.status >= 300) {
        // Registro原始ErrorRespuesta（Incluir供应商Información，用于Depurar）
        const rawData =
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        logger.error(
          `📝 Upstream error response from ${account?.name || accountId}: ${rawData.substring(0, 500)}`
        )

        // RegistroLimpiar后的Datos到error
        try {
          const responseData =
            typeof response.data === 'string' ? JSON.parse(response.data) : response.data
          const sanitizedData = sanitizeUpstreamError(responseData)
          logger.error(`🧹 [SANITIZED] Error response to client: ${JSON.stringify(sanitizedData)}`)
        } catch (e) {
          const rawText =
            typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
          const sanitizedText = sanitizeErrorMessage(rawText)
          logger.error(`🧹 [SANITIZED] Error response to client: ${sanitizedText}`)
        }
      } else {
        logger.debug(
          `[DEBUG] Response data preview: ${typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data).substring(0, 200)}`
        )
      }

      // Verificar是否为CuentaDeshabilitar/不可用的 400 Error
      const accountDisabledError = isAccountDisabledError(response.status, response.data)

      // VerificarError状态并相应Procesar
      if (response.status === 401) {
        logger.warn(
          `🚫 Unauthorized error detected for Claude Console account ${accountId}${autoProtectionDisabled ? ' (auto-protection disabled, skipping status change)' : ''}`
        )
        if (!autoProtectionDisabled) {
          await upstreamErrorHelper
            .markTempUnavailable(accountId, 'claude-console', 401)
            .catch(() => {})
        }
      } else if (accountDisabledError) {
        logger.error(
          `🚫 Account disabled error (400) detected for Claude Console account ${accountId}${autoProtectionDisabled ? ' (auto-protection disabled, skipping status change)' : ''}`
        )
        // 传入完整的Error详情到 webhook
        const errorDetails =
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        if (!autoProtectionDisabled) {
          await claudeConsoleAccountService.markConsoleAccountBlocked(accountId, errorDetails)
        }
      } else if (response.status === 429) {
        logger.warn(
          `🚫 Rate limit detected for Claude Console account ${accountId}${autoProtectionDisabled ? ' (auto-protection disabled, skipping status change)' : ''}`
        )
        // 收到429先Verificar是否因为超过了手动Configuración的每日额度
        await claudeConsoleAccountService.checkQuotaUsage(accountId).catch((err) => {
          logger.error('❌ Failed to check quota after 429 error:', err)
        })

        if (!autoProtectionDisabled) {
          await claudeConsoleAccountService.markAccountRateLimited(accountId)
          await upstreamErrorHelper
            .markTempUnavailable(
              accountId,
              'claude-console',
              429,
              upstreamErrorHelper.parseRetryAfter(response.headers)
            )
            .catch(() => {})
        }
      } else if (response.status === 529) {
        logger.warn(
          `🚫 Overload error detected for Claude Console account ${accountId}${autoProtectionDisabled ? ' (auto-protection disabled, skipping status change)' : ''}`
        )
        if (!autoProtectionDisabled) {
          await claudeConsoleAccountService.markAccountOverloaded(accountId)
          await upstreamErrorHelper
            .markTempUnavailable(accountId, 'claude-console', 529)
            .catch(() => {})
        }
      } else if (response.status >= 500) {
        logger.warn(
          `🔥 Server error (${response.status}) detected for Claude Console account ${accountId}${autoProtectionDisabled ? ' (auto-protection disabled, skipping status change)' : ''}`
        )
        if (!autoProtectionDisabled) {
          await upstreamErrorHelper
            .markTempUnavailable(accountId, 'claude-console', response.status)
            .catch(() => {})
        }
      } else if (response.status === 200 || response.status === 201) {
        // 如果SolicitudÉxito，Verificar并EliminaciónError状态
        const isRateLimited = await claudeConsoleAccountService.isAccountRateLimited(accountId)
        if (isRateLimited) {
          await claudeConsoleAccountService.removeAccountRateLimit(accountId)
        }
        const isOverloaded = await claudeConsoleAccountService.isAccountOverloaded(accountId)
        if (isOverloaded) {
          await claudeConsoleAccountService.removeAccountOverload(accountId)
        }
      }

      // Actualizar最后使用Tiempo
      await this._updateLastUsedTime(accountId)

      // 准备Respuesta体并LimpiarErrorInformación（如果是ErrorRespuesta）
      let responseBody
      if (response.status < 200 || response.status >= 300) {
        // ErrorRespuesta，Limpiar供应商Información
        try {
          const responseData =
            typeof response.data === 'string' ? JSON.parse(response.data) : response.data
          const sanitizedData = sanitizeUpstreamError(responseData)
          responseBody = JSON.stringify(sanitizedData)
          logger.debug(`🧹 Sanitized error response`)
        } catch (parseError) {
          // 如果无法Analizar为JSON，尝试Limpiar文本
          const rawText =
            typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
          responseBody = sanitizeErrorMessage(rawText)
          logger.debug(`🧹 Sanitized error text`)
        }
      } else {
        // ÉxitoRespuesta，不需要Limpiar
        responseBody =
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
      }

      logger.debug(`[DEBUG] Final response body to return: ${responseBody.substring(0, 200)}...`)

      return {
        statusCode: response.status,
        headers: response.headers,
        body: responseBody,
        accountId
      }
    } catch (error) {
      // Procesar特定Error
      if (
        error.name === 'AbortError' ||
        error.name === 'CanceledError' ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ERR_CANCELED'
      ) {
        logger.info('Request aborted due to client disconnect')
        throw new Error('Client disconnected')
      }

      logger.error(
        `❌ Claude Console relay request failed (Account: ${account?.name || accountId}):`,
        error.message
      )

      // 不再因为模型不Soportar而block账号

      throw error
    } finally {
      // 🔓 Concurrencia控制：释放Concurrencia槽位
      if (concurrencyAcquired) {
        try {
          await redis.decrConsoleAccountConcurrency(accountId, requestId)
          logger.debug(
            `🔓 Released concurrency slot for account ${account?.name || accountId}, request: ${requestId}`
          )
        } catch (releaseError) {
          logger.error(
            `❌ Failed to release concurrency slot for account ${accountId}, request: ${requestId}:`,
            releaseError.message
          )
        }
      }

      // 📬 释放Usuario消息Cola锁（兜底，正常情况下已在Solicitud发送后提前释放）
      if (queueLockAcquired && queueRequestId && accountId) {
        try {
          await userMessageQueueService.releaseQueueLock(accountId, queueRequestId)
          logger.debug(
            `📬 User message queue lock released in finally for console account ${accountId}, requestId: ${queueRequestId}`
          )
        } catch (releaseError) {
          logger.error(
            `❌ Failed to release user message queue lock for account ${accountId}:`,
            releaseError.message
          )
        }
      }
    }
  }

  // 🌊 Procesar流式Respuesta
  async relayStreamRequestWithUsageCapture(
    requestBody,
    apiKeyData,
    responseStream,
    clientHeaders,
    usageCallback,
    accountId,
    streamTransformer = null,
    options = {}
  ) {
    let account = null
    const requestId = uuidv4() // 用于ConcurrenciaRastreo
    let concurrencyAcquired = false
    let leaseRefreshInterval = null // 租约刷新定时器
    let queueLockAcquired = false
    let queueRequestId = null

    try {
      // 📬 Usuario消息ColaProcesar：如果是Usuario消息Solicitud，需要ObtenerCola锁
      if (userMessageQueueService.isUserMessageRequest(requestBody)) {
        // 校验 accountId 非空，避免空Valor污染Cola锁键
        if (!accountId || accountId === '') {
          logger.error(
            '❌ accountId missing for queue lock in console relayStreamRequestWithUsageCapture'
          )
          throw new Error('accountId missing for queue lock')
        }
        const queueResult = await userMessageQueueService.acquireQueueLock(accountId)
        if (!queueResult.acquired && !queueResult.skipped) {
          // 区分 Redis 后端Error和ColaTiempo de espera agotado
          const isBackendError = queueResult.error === 'queue_backend_error'
          const errorCode = isBackendError ? 'QUEUE_BACKEND_ERROR' : 'QUEUE_TIMEOUT'
          const errorType = isBackendError ? 'queue_backend_error' : 'queue_timeout'
          const errorMessage = isBackendError
            ? 'Queue service temporarily unavailable, please retry later'
            : 'User message queue wait timeout, please retry later'
          const statusCode = isBackendError ? 500 : 503

          // 结构化RendimientoRegistro，用于后续Estadística
          logger.performance('user_message_queue_error', {
            errorType,
            errorCode,
            accountId,
            statusCode,
            stream: true,
            apiKeyName: apiKeyData.name,
            backendError: isBackendError ? queueResult.errorMessage : undefined
          })

          logger.warn(
            `📬 User message queue ${errorType} for console account ${accountId} (stream), key: ${apiKeyData.name}`,
            isBackendError ? { backendError: queueResult.errorMessage } : {}
          )
          if (!responseStream.headersSent) {
            const existingConnection = responseStream.getHeader
              ? responseStream.getHeader('Connection')
              : null
            responseStream.writeHead(statusCode, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: existingConnection || 'keep-alive',
              'x-user-message-queue-error': errorType
            })
          }
          const errorEvent = `event: error\ndata: ${JSON.stringify({
            type: 'error',
            error: {
              type: errorType,
              message: errorMessage
            }
          })}\n\n`
          responseStream.write(errorEvent)
          responseStream.write('data: [DONE]\n\n')
          responseStream.end()
          return
        }
        if (queueResult.acquired && !queueResult.skipped) {
          queueLockAcquired = true
          queueRequestId = queueResult.requestId
          logger.debug(
            `📬 User message queue lock acquired for console account ${accountId} (stream), requestId: ${queueRequestId}`
          )
        }
      }

      // ObtenerCuentaInformación
      account = await claudeConsoleAccountService.getAccount(accountId)
      if (!account) {
        throw new Error('Claude Console Claude account not found')
      }

      logger.info(
        `📡 Processing streaming Claude Console API request for key: ${apiKeyData.name || apiKeyData.id}, account: ${account.name} (${accountId}), request: ${requestId}`
      )

      // 🔒 Concurrencia控制：原子性抢占槽位
      if (account.maxConcurrentTasks > 0) {
        // 先抢占，再Verificar - 避免竞态Condición
        const newConcurrency = Number(
          await redis.incrConsoleAccountConcurrency(accountId, requestId, 600)
        )
        concurrencyAcquired = true

        // Verificar是否超过Límite
        if (newConcurrency > account.maxConcurrentTasks) {
          // 超限，立即回滚
          await redis.decrConsoleAccountConcurrency(accountId, requestId)
          concurrencyAcquired = false

          logger.warn(
            `⚠️ Console account ${account.name} (${accountId}) concurrency limit exceeded: ${newConcurrency}/${account.maxConcurrentTasks} (stream request: ${requestId}, rolled back)`
          )

          const error = new Error('Console account concurrency limit reached')
          error.code = 'CONSOLE_ACCOUNT_CONCURRENCY_FULL'
          error.accountId = accountId
          throw error
        }

        logger.debug(
          `🔓 Acquired concurrency slot for stream account ${account.name} (${accountId}), current: ${newConcurrency}/${account.maxConcurrentTasks}, request: ${requestId}`
        )

        // 🔄 启动租约刷新定时器（每5分钟刷新一次，防止长Conexión租约过期）
        leaseRefreshInterval = setInterval(
          async () => {
            try {
              await redis.refreshConsoleAccountConcurrencyLease(accountId, requestId, 600)
              logger.debug(
                `🔄 Refreshed concurrency lease for stream account ${account.name} (${accountId}), request: ${requestId}`
              )
            } catch (refreshError) {
              logger.error(
                `❌ Failed to refresh concurrency lease for account ${accountId}, request: ${requestId}:`,
                refreshError.message
              )
            }
          },
          5 * 60 * 1000
        ) // 5分钟刷新一次
      }

      logger.debug(`🌐 Account API URL: ${account.apiUrl}`)

      // Procesar模型映射
      let mappedModel = requestBody.model
      if (
        account.supportedModels &&
        typeof account.supportedModels === 'object' &&
        !Array.isArray(account.supportedModels)
      ) {
        const newModel = claudeConsoleAccountService.getMappedModel(
          account.supportedModels,
          requestBody.model
        )
        if (newModel !== requestBody.model) {
          logger.info(`🔄 [Stream] Mapping model from ${requestBody.model} to ${newModel}`)
          mappedModel = newModel
        }
      }

      // Crear修改后的Solicitud体
      const modifiedRequestBody = {
        ...requestBody,
        model: mappedModel
      }

      // 模型兼容性Verificar已经在调度器中Completado，这里不需要再Verificar

      // CrearProxyagent
      const proxyAgent = claudeConsoleAccountService._createProxyAgent(account.proxy)

      // 发送流式Solicitud
      await this._makeClaudeConsoleStreamRequest(
        modifiedRequestBody,
        account,
        proxyAgent,
        clientHeaders,
        responseStream,
        accountId,
        usageCallback,
        streamTransformer,
        options,
        // 📬 回调：在收到Respuesta头时释放Cola锁
        async () => {
          if (queueLockAcquired && queueRequestId && accountId) {
            try {
              await userMessageQueueService.releaseQueueLock(accountId, queueRequestId)
              queueLockAcquired = false // 标记已释放，防止 finally 重复释放
              logger.debug(
                `📬 User message queue lock released early for console stream account ${accountId}, requestId: ${queueRequestId}`
              )
            } catch (releaseError) {
              logger.error(
                `❌ Failed to release user message queue lock early for console stream account ${accountId}:`,
                releaseError.message
              )
            }
          }
        }
      )

      // Actualizar最后使用Tiempo
      await this._updateLastUsedTime(accountId)
    } catch (error) {
      // Cliente主动断开Conexión是正常情况，使用 INFO 级别
      if (error.message === 'Client disconnected') {
        logger.info(
          `🔌 Claude Console stream relay ended: Client disconnected (Account: ${account?.name || accountId})`
        )
      } else {
        logger.error(
          `❌ Claude Console stream relay failed (Account: ${account?.name || accountId}):`,
          error
        )
      }
      throw error
    } finally {
      // 🛑 Limpiar租约刷新定时器
      if (leaseRefreshInterval) {
        clearInterval(leaseRefreshInterval)
        logger.debug(
          `🛑 Cleared lease refresh interval for stream account ${account?.name || accountId}, request: ${requestId}`
        )
      }

      // 🔓 Concurrencia控制:释放Concurrencia槽位
      if (concurrencyAcquired) {
        try {
          await redis.decrConsoleAccountConcurrency(accountId, requestId)
          logger.debug(
            `🔓 Released concurrency slot for stream account ${account?.name || accountId}, request: ${requestId}`
          )
        } catch (releaseError) {
          logger.error(
            `❌ Failed to release concurrency slot for stream account ${accountId}, request: ${requestId}:`,
            releaseError.message
          )
        }
      }

      // 📬 释放Usuario消息Cola锁（兜底，正常情况下已在收到Respuesta头后提前释放）
      if (queueLockAcquired && queueRequestId && accountId) {
        try {
          await userMessageQueueService.releaseQueueLock(accountId, queueRequestId)
          logger.debug(
            `📬 User message queue lock released in finally for console stream account ${accountId}, requestId: ${queueRequestId}`
          )
        } catch (releaseError) {
          logger.error(
            `❌ Failed to release user message queue lock for stream account ${accountId}:`,
            releaseError.message
          )
        }
      }
    }
  }

  // 🌊 发送流式Solicitud到Claude Console API
  async _makeClaudeConsoleStreamRequest(
    body,
    account,
    proxyAgent,
    clientHeaders,
    responseStream,
    accountId,
    usageCallback,
    streamTransformer = null,
    requestOptions = {},
    onResponseHeaderReceived = null
  ) {
    return new Promise((resolve, reject) => {
      let aborted = false

      // Construir完整的API URL
      const cleanUrl = account.apiUrl.replace(/\/$/, '') // Eliminación末尾斜杠
      const apiEndpoint = cleanUrl.endsWith('/v1/messages') ? cleanUrl : `${cleanUrl}/v1/messages`

      logger.debug(`🎯 Final API endpoint for stream: ${apiEndpoint}`)

      // FiltrarClienteSolicitud头
      const filteredHeaders = this._filterClientHeaders(clientHeaders)
      logger.debug(`[DEBUG] Filtered client headers: ${JSON.stringify(filteredHeaders)}`)

      // 决定使用的 User-Agent：优先使用Cuenta自定义的，否则透传Cliente的，最后才使用PredeterminadoValor
      const userAgent =
        account.userAgent ||
        clientHeaders?.['user-agent'] ||
        clientHeaders?.['User-Agent'] ||
        this.defaultUserAgent

      // 准备SolicitudConfiguración
      const requestConfig = {
        method: 'POST',
        url: apiEndpoint,
        data: body,
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'User-Agent': userAgent,
          ...filteredHeaders
        },
        timeout: config.requestTimeout || 600000,
        responseType: 'stream',
        validateStatus: () => true // 接受所有状态码
      }

      if (proxyAgent) {
        requestConfig.httpAgent = proxyAgent
        requestConfig.httpsAgent = proxyAgent
        requestConfig.proxy = false
      }

      // 根据 API Key Formato选择认证方式
      if (account.apiKey && account.apiKey.startsWith('sk-ant-')) {
        // Anthropic 官方 API Key 使用 x-api-key
        requestConfig.headers['x-api-key'] = account.apiKey
        logger.debug('[DEBUG] Using x-api-key authentication for sk-ant-* API key')
      } else {
        // 其他 API Key 使用 Authorization Bearer
        requestConfig.headers['Authorization'] = `Bearer ${account.apiKey}`
        logger.debug('[DEBUG] Using Authorization Bearer authentication')
      }

      // 添加beta header如果需要
      if (requestOptions.betaHeader) {
        requestConfig.headers['anthropic-beta'] = requestOptions.betaHeader
      }

      // 发送Solicitud
      const request = axios(requestConfig)

      // 注意：使用 .then(async ...) 模式ProcesarRespuesta
      // - 内部的 releaseQueueLock 有独立的 try-catch，不会导致未捕获异常
      // - queueLockAcquired = false 的赋Valor会在 finally Ejecutar前Completado（JS 单Hilo保证）
      request
        .then(async (response) => {
          logger.debug(`🌊 Claude Console Claude stream response status: ${response.status}`)

          // ErrorRespuestaProcesar
          if (response.status !== 200) {
            logger.error(
              `❌ Claude Console API returned error status: ${response.status} | Account: ${account?.name || accountId}`
            )

            // 收集ErrorDatos用于检测
            let errorDataForCheck = ''
            const errorChunks = []

            response.data.on('data', (chunk) => {
              errorChunks.push(chunk)
              errorDataForCheck += chunk.toString()
            })

            response.data.on('end', async () => {
              const autoProtectionDisabled = account.disableAutoProtection === true
              // Registro原始Error消息到Registro（方便Depurar，Incluir供应商Información）
              logger.error(
                `📝 [Stream] Upstream error response from ${account?.name || accountId}: ${errorDataForCheck.substring(0, 500)}`
              )

              // Verificar是否为CuentaDeshabilitarError
              const accountDisabledError = isAccountDisabledError(
                response.status,
                errorDataForCheck
              )

              if (response.status === 401) {
                logger.warn(
                  `🚫 [Stream] Unauthorized error detected for Claude Console account ${accountId}${autoProtectionDisabled ? ' (auto-protection disabled, skipping status change)' : ''}`
                )
                if (!autoProtectionDisabled) {
                  await upstreamErrorHelper
                    .markTempUnavailable(accountId, 'claude-console', 401)
                    .catch(() => {})
                }
              } else if (accountDisabledError) {
                logger.error(
                  `🚫 [Stream] Account disabled error (400) detected for Claude Console account ${accountId}${autoProtectionDisabled ? ' (auto-protection disabled, skipping status change)' : ''}`
                )
                // 传入完整的Error详情到 webhook
                if (!autoProtectionDisabled) {
                  await claudeConsoleAccountService.markConsoleAccountBlocked(
                    accountId,
                    errorDataForCheck
                  )
                }
              } else if (response.status === 429) {
                logger.warn(
                  `🚫 [Stream] Rate limit detected for Claude Console account ${accountId}${autoProtectionDisabled ? ' (auto-protection disabled, skipping status change)' : ''}`
                )
                // Verificar是否因为超过每日额度
                claudeConsoleAccountService.checkQuotaUsage(accountId).catch((err) => {
                  logger.error('❌ Failed to check quota after 429 error:', err)
                })
                if (!autoProtectionDisabled) {
                  await claudeConsoleAccountService.markAccountRateLimited(accountId)
                  await upstreamErrorHelper
                    .markTempUnavailable(
                      accountId,
                      'claude-console',
                      429,
                      upstreamErrorHelper.parseRetryAfter(response.headers)
                    )
                    .catch(() => {})
                }
              } else if (response.status === 529) {
                logger.warn(
                  `🚫 [Stream] Overload error detected for Claude Console account ${accountId}${autoProtectionDisabled ? ' (auto-protection disabled, skipping status change)' : ''}`
                )
                if (!autoProtectionDisabled) {
                  await claudeConsoleAccountService.markAccountOverloaded(accountId)
                  await upstreamErrorHelper
                    .markTempUnavailable(accountId, 'claude-console', 529)
                    .catch(() => {})
                }
              } else if (response.status >= 500) {
                logger.warn(
                  `🔥 [Stream] Server error (${response.status}) detected for Claude Console account ${accountId}${autoProtectionDisabled ? ' (auto-protection disabled, skipping status change)' : ''}`
                )
                if (!autoProtectionDisabled) {
                  await upstreamErrorHelper
                    .markTempUnavailable(accountId, 'claude-console', response.status)
                    .catch(() => {})
                }
              }

              // EstablecerRespuesta头
              if (!responseStream.headersSent) {
                responseStream.writeHead(response.status, {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache'
                })
              }

              // LimpiarConcurrencia送ErrorRespuesta
              try {
                const fullErrorData = Buffer.concat(errorChunks).toString()
                const errorJson = JSON.parse(fullErrorData)
                const sanitizedError = sanitizeUpstreamError(errorJson)

                // RegistroLimpiar后的Error消息（发送给Cliente的，完整Registro）
                logger.error(
                  `🧹 [Stream] [SANITIZED] Error response to client: ${JSON.stringify(sanitizedError)}`
                )

                if (isStreamWritable(responseStream)) {
                  responseStream.write(JSON.stringify(sanitizedError))
                  responseStream.end()
                }
              } catch (parseError) {
                const sanitizedText = sanitizeErrorMessage(errorDataForCheck)
                logger.error(`🧹 [Stream] [SANITIZED] Error response to client: ${sanitizedText}`)

                if (isStreamWritable(responseStream)) {
                  responseStream.write(sanitizedText)
                  responseStream.end()
                }
              }
              resolve() // 不抛出异常，正常Completado流Procesar
            })

            return
          }

          // 📬 收到ÉxitoRespuesta头（HTTP 200），调用回调释放Cola锁
          // 此时Solicitud已被 Claude API 接受并计入 RPM Cuota，无需等待RespuestaCompletado
          if (onResponseHeaderReceived && typeof onResponseHeaderReceived === 'function') {
            try {
              await onResponseHeaderReceived()
            } catch (callbackError) {
              logger.error(
                `❌ Failed to execute onResponseHeaderReceived callback for console stream account ${accountId}:`,
                callbackError.message
              )
            }
          }

          // ÉxitoRespuesta，Verificar并EliminaciónError状态
          claudeConsoleAccountService.isAccountRateLimited(accountId).then((isRateLimited) => {
            if (isRateLimited) {
              claudeConsoleAccountService.removeAccountRateLimit(accountId)
            }
          })
          claudeConsoleAccountService.isAccountOverloaded(accountId).then((isOverloaded) => {
            if (isOverloaded) {
              claudeConsoleAccountService.removeAccountOverload(accountId)
            }
          })

          // EstablecerRespuesta头
          // ⚠️ 关键Corrección：尊重 auth.js 提前Establecer的 Connection: close
          // 当ConcurrenciaCola功能Habilitar时，auth.js 会Establecer Connection: close 来Deshabilitar Keep-Alive
          if (!responseStream.headersSent) {
            const existingConnection = responseStream.getHeader
              ? responseStream.getHeader('Connection')
              : null
            const connectionHeader = existingConnection || 'keep-alive'
            if (existingConnection) {
              logger.debug(
                `🔌 [Console Stream] Preserving existing Connection header: ${existingConnection}`
              )
            }
            responseStream.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: connectionHeader,
              'X-Accel-Buffering': 'no'
            })
          }

          let buffer = ''
          let finalUsageReported = false
          const collectedUsageData = {
            model: body.model || account?.defaultModel || null
          }

          // Procesar流Datos
          response.data.on('data', (chunk) => {
            try {
              if (aborted) {
                return
              }

              const chunkStr = chunk.toString()
              buffer += chunkStr

              // Procesar完整的SSEFila
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              // 转发Datos并Analizarusage
              if (lines.length > 0) {
                // Verificar流是否可写（ClienteConexión是否有效）
                if (isStreamWritable(responseStream)) {
                  const linesToForward = lines.join('\n') + (lines.length > 0 ? '\n' : '')

                  // 应用流Convertir器如果有
                  let dataToWrite = linesToForward
                  if (streamTransformer) {
                    const transformed = streamTransformer(linesToForward)
                    if (transformed) {
                      dataToWrite = transformed
                    } else {
                      dataToWrite = null
                    }
                  }

                  if (dataToWrite) {
                    responseStream.write(dataToWrite)
                  }
                } else {
                  // ClienteConexión已断开，RegistroAdvertencia（但仍继续Analizarusage）
                  logger.warn(
                    `⚠️ [Console] Client disconnected during stream, skipping ${lines.length} lines for account: ${account?.name || accountId}`
                  )
                }

                // AnalizarSSEDatos寻找usageInformación（无论Conexión状态如何）
                for (const line of lines) {
                  if (line.startsWith('data:')) {
                    const jsonStr = line.slice(5).trimStart()
                    if (!jsonStr || jsonStr === '[DONE]') {
                      continue
                    }
                    try {
                      const data = JSON.parse(jsonStr)

                      // 收集usageDatos
                      if (data.type === 'message_start' && data.message && data.message.usage) {
                        collectedUsageData.input_tokens = data.message.usage.input_tokens || 0
                        collectedUsageData.cache_creation_input_tokens =
                          data.message.usage.cache_creation_input_tokens || 0
                        collectedUsageData.cache_read_input_tokens =
                          data.message.usage.cache_read_input_tokens || 0
                        collectedUsageData.model = data.message.model

                        // Verificar是否有详细的 cache_creation Objeto
                        if (
                          data.message.usage.cache_creation &&
                          typeof data.message.usage.cache_creation === 'object'
                        ) {
                          collectedUsageData.cache_creation = {
                            ephemeral_5m_input_tokens:
                              data.message.usage.cache_creation.ephemeral_5m_input_tokens || 0,
                            ephemeral_1h_input_tokens:
                              data.message.usage.cache_creation.ephemeral_1h_input_tokens || 0
                          }
                          logger.info(
                            '📊 Collected detailed cache creation data:',
                            JSON.stringify(collectedUsageData.cache_creation)
                          )
                        }
                      }

                      if (data.type === 'message_delta' && data.usage) {
                        // 提取所有usageCampo，message_delta可能Incluir完整的usageInformación
                        if (data.usage.output_tokens !== undefined) {
                          collectedUsageData.output_tokens = data.usage.output_tokens || 0
                        }

                        // 提取input_tokens（如果存在）
                        if (data.usage.input_tokens !== undefined) {
                          collectedUsageData.input_tokens = data.usage.input_tokens || 0
                        }

                        // 提取cache相关的tokens
                        if (data.usage.cache_creation_input_tokens !== undefined) {
                          collectedUsageData.cache_creation_input_tokens =
                            data.usage.cache_creation_input_tokens || 0
                        }
                        if (data.usage.cache_read_input_tokens !== undefined) {
                          collectedUsageData.cache_read_input_tokens =
                            data.usage.cache_read_input_tokens || 0
                        }

                        // Verificar是否有详细的 cache_creation Objeto
                        if (
                          data.usage.cache_creation &&
                          typeof data.usage.cache_creation === 'object'
                        ) {
                          collectedUsageData.cache_creation = {
                            ephemeral_5m_input_tokens:
                              data.usage.cache_creation.ephemeral_5m_input_tokens || 0,
                            ephemeral_1h_input_tokens:
                              data.usage.cache_creation.ephemeral_1h_input_tokens || 0
                          }
                        }

                        logger.info(
                          '📊 [Console] Collected usage data from message_delta:',
                          JSON.stringify(collectedUsageData)
                        )

                        // 如果已经收集到了完整Datos，触发回调
                        if (
                          collectedUsageData.input_tokens !== undefined &&
                          collectedUsageData.output_tokens !== undefined &&
                          !finalUsageReported
                        ) {
                          if (!collectedUsageData.model) {
                            collectedUsageData.model = body.model || account?.defaultModel || null
                          }
                          logger.info(
                            '🎯 [Console] Complete usage data collected:',
                            JSON.stringify(collectedUsageData)
                          )
                          if (usageCallback && typeof usageCallback === 'function') {
                            usageCallback({ ...collectedUsageData, accountId })
                          }
                          finalUsageReported = true
                        }
                      }

                      // 不再因为模型不Soportar而block账号
                    } catch (e) {
                      // 忽略AnalizarError
                    }
                  }
                }
              }
            } catch (error) {
              logger.error(
                `❌ Error processing Claude Console stream data (Account: ${account?.name || accountId}):`,
                error
              )
              if (isStreamWritable(responseStream)) {
                // 如果有 streamTransformer（如ProbarSolicitud），使用前端期望的Formato
                if (streamTransformer) {
                  responseStream.write(
                    `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`
                  )
                } else {
                  responseStream.write('event: error\n')
                  responseStream.write(
                    `data: ${JSON.stringify({
                      error: 'Stream processing error',
                      message: error.message,
                      timestamp: new Date().toISOString()
                    })}\n\n`
                  )
                }
              }
            }
          })

          response.data.on('end', () => {
            try {
              // Procesar缓冲区中剩余的Datos
              if (buffer.trim() && isStreamWritable(responseStream)) {
                if (streamTransformer) {
                  const transformed = streamTransformer(buffer)
                  if (transformed) {
                    responseStream.write(transformed)
                  }
                } else {
                  responseStream.write(buffer)
                }
              }

              // 🔧 兜底逻辑：确保所有未保存的usageDatos都不会丢失
              if (!finalUsageReported) {
                if (
                  collectedUsageData.input_tokens !== undefined ||
                  collectedUsageData.output_tokens !== undefined
                ) {
                  // 补全缺失的Campo
                  if (collectedUsageData.input_tokens === undefined) {
                    collectedUsageData.input_tokens = 0
                    logger.warn(
                      '⚠️ [Console] message_delta missing input_tokens, setting to 0. This may indicate incomplete usage data.'
                    )
                  }
                  if (collectedUsageData.output_tokens === undefined) {
                    collectedUsageData.output_tokens = 0
                    logger.warn(
                      '⚠️ [Console] message_delta missing output_tokens, setting to 0. This may indicate incomplete usage data.'
                    )
                  }
                  // 确保有 model Campo
                  if (!collectedUsageData.model) {
                    collectedUsageData.model = body.model || account?.defaultModel || null
                  }
                  logger.info(
                    `📊 [Console] Saving incomplete usage data via fallback: ${JSON.stringify(collectedUsageData)}`
                  )
                  if (usageCallback && typeof usageCallback === 'function') {
                    usageCallback({ ...collectedUsageData, accountId })
                  }
                  finalUsageReported = true
                } else {
                  logger.warn(
                    '⚠️ [Console] Stream completed but no usage data was captured! This indicates a problem with SSE parsing or API response format.'
                  )
                }
              }

              // 确保流正确结束
              if (isStreamWritable(responseStream)) {
                // 📊 诊断Registro：流结束前状态
                logger.info(
                  `📤 [STREAM] Ending response | destroyed: ${responseStream.destroyed}, ` +
                    `socketDestroyed: ${responseStream.socket?.destroyed}, ` +
                    `socketBytesWritten: ${responseStream.socket?.bytesWritten || 0}`
                )

                // Deshabilitar Nagle 算法确保Datos立即发送
                if (responseStream.socket && !responseStream.socket.destroyed) {
                  responseStream.socket.setNoDelay(true)
                }

                // 等待Datos完全 flush 到Cliente后再 resolve
                responseStream.end(() => {
                  logger.info(
                    `✅ [STREAM] Response ended and flushed | socketBytesWritten: ${responseStream.socket?.bytesWritten || 'unknown'}`
                  )
                  resolve()
                })
              } else {
                // Conexión已断开，RegistroAdvertencia
                logger.warn(
                  `⚠️ [Console] Client disconnected before stream end, data may not have been received | account: ${account?.name || accountId}`
                )
                resolve()
              }
            } catch (error) {
              logger.error('❌ Error processing stream end:', error)
              reject(error)
            }
          })

          response.data.on('error', (error) => {
            logger.error(
              `❌ Claude Console stream error (Account: ${account?.name || accountId}):`,
              error
            )
            if (isStreamWritable(responseStream)) {
              // 如果有 streamTransformer（如ProbarSolicitud），使用前端期望的Formato
              if (streamTransformer) {
                responseStream.write(
                  `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`
                )
              } else {
                responseStream.write('event: error\n')
                responseStream.write(
                  `data: ${JSON.stringify({
                    error: 'Stream error',
                    message: error.message,
                    timestamp: new Date().toISOString()
                  })}\n\n`
                )
              }
              responseStream.end()
            }
            reject(error)
          })
        })
        .catch((error) => {
          if (aborted) {
            return
          }

          logger.error(
            `❌ Claude Console stream request error (Account: ${account?.name || accountId}):`,
            error.message
          )

          // VerificarError状态
          if (error.response) {
            const catchAutoProtectionDisabled =
              account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
            if (error.response.status === 401) {
              if (!catchAutoProtectionDisabled) {
                upstreamErrorHelper
                  .markTempUnavailable(accountId, 'claude-console', 401)
                  .catch(() => {})
              }
            } else if (error.response.status === 429) {
              if (!catchAutoProtectionDisabled) {
                claudeConsoleAccountService.markAccountRateLimited(accountId)
                // Verificar是否因为超过每日额度
                claudeConsoleAccountService.checkQuotaUsage(accountId).catch((err) => {
                  logger.error('❌ Failed to check quota after 429 error:', err)
                })
                upstreamErrorHelper
                  .markTempUnavailable(
                    accountId,
                    'claude-console',
                    429,
                    upstreamErrorHelper.parseRetryAfter(error.response.headers)
                  )
                  .catch(() => {})
              }
            } else if (error.response.status === 529) {
              if (!catchAutoProtectionDisabled) {
                claudeConsoleAccountService.markAccountOverloaded(accountId)
                upstreamErrorHelper
                  .markTempUnavailable(accountId, 'claude-console', 529)
                  .catch(() => {})
              }
            }
          }

          // 发送ErrorRespuesta
          if (!responseStream.headersSent) {
            const existingConnection = responseStream.getHeader
              ? responseStream.getHeader('Connection')
              : null
            responseStream.writeHead(error.response?.status || 500, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: existingConnection || 'keep-alive'
            })
          }

          if (isStreamWritable(responseStream)) {
            // 如果有 streamTransformer（如ProbarSolicitud），使用前端期望的Formato
            if (streamTransformer) {
              responseStream.write(
                `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`
              )
            } else {
              responseStream.write('event: error\n')
              responseStream.write(
                `data: ${JSON.stringify({
                  error: error.message,
                  code: error.code,
                  timestamp: new Date().toISOString()
                })}\n\n`
              )
            }
            responseStream.end()
          }

          reject(error)
        })

      // ProcesarCliente断开Conexión
      responseStream.on('close', () => {
        logger.debug('🔌 Client disconnected, cleaning up Claude Console stream')
        aborted = true
      })
    })
  }

  // 🔧 FiltrarClienteSolicitud头
  _filterClientHeaders(clientHeaders) {
    // 使用统一的 headerFilter 工具Clase（白名单模式）
    // 与 claudeRelayService 保持一致，避免透传 CDN headers 触发上游 API SeguridadVerificar
    return filterForClaude(clientHeaders)
  }

  // 🕐 Actualizar最后使用Tiempo
  async _updateLastUsedTime(accountId) {
    try {
      const client = require('../../models/redis').getClientSafe()
      const accountKey = `claude_console_account:${accountId}`
      const exists = await client.exists(accountKey)

      if (!exists) {
        logger.debug(`🔎 跳过Actualizar已Eliminar的Claude Console账号最近使用Tiempo: ${accountId}`)
        return
      }

      await client.hset(accountKey, 'lastUsedAt', new Date().toISOString())
    } catch (error) {
      logger.warn(
        `⚠️ Failed to update last used time for Claude Console account ${accountId}:`,
        error.message
      )
    }
  }

  // 🧪 CrearProbar用的流Convertir器，将 Claude API SSE FormatoConvertir为前端期望的Formato
  _createTestStreamTransformer() {
    let testStartSent = false

    return (rawData) => {
      const lines = rawData.split('\n')
      const outputLines = []

      for (const line of lines) {
        if (!line.startsWith('data: ')) {
          // 保留空Fila用于 SSE 分隔
          if (line.trim() === '') {
            outputLines.push('')
          }
          continue
        }

        const jsonStr = line.substring(6).trim()
        if (!jsonStr || jsonStr === '[DONE]') {
          continue
        }

        try {
          const data = JSON.parse(jsonStr)

          // 发送 test_start Evento（只在第一次 message_start 时发送）
          if (data.type === 'message_start' && !testStartSent) {
            testStartSent = true
            outputLines.push(`data: ${JSON.stringify({ type: 'test_start' })}`)
            outputLines.push('')
          }

          // Convertir content_block_delta 为 content
          if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
            outputLines.push(`data: ${JSON.stringify({ type: 'content', text: data.delta.text })}`)
            outputLines.push('')
          }

          // Convertir message_stop 为 test_complete
          if (data.type === 'message_stop') {
            outputLines.push(`data: ${JSON.stringify({ type: 'test_complete', success: true })}`)
            outputLines.push('')
          }

          // ProcesarErrorEvento
          if (data.type === 'error') {
            const errorMsg = data.error?.message || data.message || '未知Error'
            outputLines.push(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}`)
            outputLines.push('')
          }
        } catch {
          // 忽略AnalizarError
        }
      }

      return outputLines.length > 0 ? outputLines.join('\n') : null
    }
  }

  // 🧪 Probar账号Conexión（供Admin API使用）
  async testAccountConnection(accountId, responseStream) {
    const { sendStreamTestRequest } = require('../../utils/testPayloadHelper')

    try {
      const account = await claudeConsoleAccountService.getAccount(accountId)
      if (!account) {
        throw new Error('Account not found')
      }

      logger.info(`🧪 Testing Claude Console account connection: ${account.name} (${accountId})`)

      const cleanUrl = account.apiUrl.replace(/\/$/, '')
      const apiUrl = cleanUrl.endsWith('/v1/messages')
        ? cleanUrl
        : `${cleanUrl}/v1/messages?beta=true`

      await sendStreamTestRequest({
        apiUrl,
        authorization: `Bearer ${account.apiKey}`,
        responseStream,
        proxyAgent: claudeConsoleAccountService._createProxyAgent(account.proxy),
        extraHeaders: account.userAgent ? { 'User-Agent': account.userAgent } : {}
      })
    } catch (error) {
      logger.error(`❌ Test account connection failed:`, error)
      if (!responseStream.headersSent) {
        responseStream.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        })
      }
      if (isStreamWritable(responseStream)) {
        responseStream.write(
          `data: ${JSON.stringify({ type: 'test_complete', success: false, error: error.message })}\n\n`
        )
        responseStream.end()
      }
    }
  }

  // 🎯 Verificación de salud
  async healthCheck() {
    try {
      const accounts = await claudeConsoleAccountService.getAllAccounts()
      const activeAccounts = accounts.filter((acc) => acc.isActive && acc.status === 'active')

      return {
        healthy: activeAccounts.length > 0,
        activeAccounts: activeAccounts.length,
        totalAccounts: accounts.length,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error('❌ Claude Console Claude health check failed:', error)
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }
}

module.exports = new ClaudeConsoleRelayService()
