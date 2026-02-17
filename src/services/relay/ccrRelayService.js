const axios = require('axios')
const ccrAccountService = require('../account/ccrAccountService')
const logger = require('../../utils/logger')
const config = require('../../../config/config')
const { parseVendorPrefixedModel } = require('../../utils/modelHelper')
const userMessageQueueService = require('../userMessageQueueService')
const { isStreamWritable } = require('../../utils/streamHelper')
const upstreamErrorHelper = require('../../utils/upstreamErrorHelper')

class CcrRelayService {
  constructor() {
    this.defaultUserAgent = 'claude-relay-service/1.0.0'
  }

  // 🚀 转发Solicitud到CCR API
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
    let queueLockAcquired = false
    let queueRequestId = null

    try {
      // 📬 Usuario消息ColaProcesar
      if (userMessageQueueService.isUserMessageRequest(requestBody)) {
        // 校验 accountId 非空，避免空Valor污染Cola锁键
        if (!accountId || accountId === '') {
          logger.error('❌ accountId missing for queue lock in CCR relayRequest')
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
            backendError: isBackendError ? queueResult.errorMessage : undefined
          })

          logger.warn(
            `📬 User message queue ${errorType} for CCR account ${accountId}`,
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
            `📬 User message queue lock acquired for CCR account ${accountId}, requestId: ${queueRequestId}`
          )
        }
      }

      // ObtenerCuentaInformación
      account = await ccrAccountService.getAccount(accountId)
      if (!account) {
        throw new Error('CCR account not found')
      }

      logger.info(
        `📤 Processing CCR API request for key: ${apiKeyData.name || apiKeyData.id}, account: ${account.name} (${accountId})`
      )
      logger.debug(`🌐 Account API URL: ${account.apiUrl}`)
      logger.debug(`🔍 Account supportedModels: ${JSON.stringify(account.supportedModels)}`)
      logger.debug(`🔑 Account has apiKey: ${!!account.apiKey}`)
      logger.debug(`📝 Request model: ${requestBody.model}`)

      // Procesar模型前缀Analizar和映射
      const { baseModel } = parseVendorPrefixedModel(requestBody.model)
      logger.debug(`🔄 Parsed base model: ${baseModel} from original: ${requestBody.model}`)

      let mappedModel = baseModel
      if (
        account.supportedModels &&
        typeof account.supportedModels === 'object' &&
        !Array.isArray(account.supportedModels)
      ) {
        const newModel = ccrAccountService.getMappedModel(account.supportedModels, baseModel)
        if (newModel !== baseModel) {
          logger.info(`🔄 Mapping model from ${baseModel} to ${newModel}`)
          mappedModel = newModel
        }
      }

      // Crear修改后的Solicitud体，使用去前缀后的模型名
      const modifiedRequestBody = {
        ...requestBody,
        model: mappedModel
      }

      // CrearProxyagent
      const proxyAgent = ccrAccountService._createProxyAgent(account.proxy)

      // CrearAbortController用于取消Solicitud
      abortController = new AbortController()

      // EstablecerCliente断开Escucha
      const handleClientDisconnect = () => {
        logger.info('🔌 Client disconnected, aborting CCR request')
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
        // 其他 API Key (包括CCR API Key) 使用 Authorization Bearer
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
        '📤 Sending request to CCR API with headers:',
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
            `📬 User message queue lock released early for CCR account ${accountId}, requestId: ${queueRequestId}`
          )
        } catch (releaseError) {
          logger.error(
            `❌ Failed to release user message queue lock early for CCR account ${accountId}:`,
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

      logger.debug(`🔗 CCR API response: ${response.status}`)
      logger.debug(`[DEBUG] Response headers: ${JSON.stringify(response.headers)}`)
      logger.debug(`[DEBUG] Response data type: ${typeof response.data}`)
      logger.debug(
        `[DEBUG] Response data length: ${response.data ? (typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length) : 0}`
      )
      logger.debug(
        `[DEBUG] Response data preview: ${typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data).substring(0, 200)}`
      )

      // VerificarError状态并相应Procesar
      if (response.status === 401) {
        logger.warn(`🚫 Unauthorized error detected for CCR account ${accountId}`)
        const autoProtectionDisabled =
          account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
        if (!autoProtectionDisabled) {
          await upstreamErrorHelper.markTempUnavailable(accountId, 'ccr', 401).catch(() => {})
        }
      } else if (response.status === 429) {
        logger.warn(`🚫 Rate limit detected for CCR account ${accountId}`)
        // 收到429先Verificar是否因为超过了手动Configuración的每日额度
        await ccrAccountService.checkQuotaUsage(accountId).catch((err) => {
          logger.error('❌ Failed to check quota after 429 error:', err)
        })

        await ccrAccountService.markAccountRateLimited(accountId)
        const autoProtectionDisabled =
          account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
        if (!autoProtectionDisabled) {
          await upstreamErrorHelper
            .markTempUnavailable(
              accountId,
              'ccr',
              429,
              upstreamErrorHelper.parseRetryAfter(response.headers)
            )
            .catch(() => {})
        }
      } else if (response.status === 529) {
        logger.warn(`🚫 Overload error detected for CCR account ${accountId}`)
        await ccrAccountService.markAccountOverloaded(accountId)
        const autoProtectionDisabled =
          account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
        if (!autoProtectionDisabled) {
          await upstreamErrorHelper.markTempUnavailable(accountId, 'ccr', 529).catch(() => {})
        }
      } else if (response.status >= 500) {
        logger.warn(`🔥 Server error (${response.status}) detected for CCR account ${accountId}`)
        const autoProtectionDisabled =
          account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
        if (!autoProtectionDisabled) {
          await upstreamErrorHelper
            .markTempUnavailable(accountId, 'ccr', response.status)
            .catch(() => {})
        }
      } else if (response.status === 200 || response.status === 201) {
        // 如果SolicitudÉxito，Verificar并EliminaciónError状态
        const isRateLimited = await ccrAccountService.isAccountRateLimited(accountId)
        if (isRateLimited) {
          await ccrAccountService.removeAccountRateLimit(accountId)
        }
        const isOverloaded = await ccrAccountService.isAccountOverloaded(accountId)
        if (isOverloaded) {
          await ccrAccountService.removeAccountOverload(accountId)
        }
      }

      // Actualizar最后使用Tiempo
      await this._updateLastUsedTime(accountId)

      const responseBody =
        typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
      logger.debug(`[DEBUG] Final response body to return: ${responseBody}`)

      return {
        statusCode: response.status,
        headers: response.headers,
        body: responseBody,
        accountId
      }
    } catch (error) {
      // Procesar特定Error
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        logger.info('Request aborted due to client disconnect')
        throw new Error('Client disconnected')
      }

      logger.error(
        `❌ CCR relay request failed (Account: ${account?.name || accountId}):`,
        error.message
      )

      // 网络Error标记临时不可用
      if (accountId && !error.response) {
        const autoProtectionDisabled =
          account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
        if (!autoProtectionDisabled) {
          await upstreamErrorHelper.markTempUnavailable(accountId, 'ccr', 503).catch(() => {})
        }
      }

      throw error
    } finally {
      // 📬 释放Usuario消息Cola锁（兜底，正常情况下已在Solicitud发送后提前释放）
      if (queueLockAcquired && queueRequestId && accountId) {
        try {
          await userMessageQueueService.releaseQueueLock(accountId, queueRequestId)
          logger.debug(
            `📬 User message queue lock released in finally for CCR account ${accountId}, requestId: ${queueRequestId}`
          )
        } catch (releaseError) {
          logger.error(
            `❌ Failed to release user message queue lock for CCR account ${accountId}:`,
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
    let queueLockAcquired = false
    let queueRequestId = null

    try {
      // 📬 Usuario消息ColaProcesar
      if (userMessageQueueService.isUserMessageRequest(requestBody)) {
        // 校验 accountId 非空，避免空Valor污染Cola锁键
        if (!accountId || accountId === '') {
          logger.error(
            '❌ accountId missing for queue lock in CCR relayStreamRequestWithUsageCapture'
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

          // 结构化RendimientoRegistro，用于后续��计
          logger.performance('user_message_queue_error', {
            errorType,
            errorCode,
            accountId,
            statusCode,
            stream: true,
            backendError: isBackendError ? queueResult.errorMessage : undefined
          })

          logger.warn(
            `📬 User message queue ${errorType} for CCR account ${accountId} (stream)`,
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
            `📬 User message queue lock acquired for CCR account ${accountId} (stream), requestId: ${queueRequestId}`
          )
        }
      }

      // ObtenerCuentaInformación
      account = await ccrAccountService.getAccount(accountId)
      if (!account) {
        throw new Error('CCR account not found')
      }

      logger.info(
        `📡 Processing streaming CCR API request for key: ${apiKeyData.name || apiKeyData.id}, account: ${account.name} (${accountId})`
      )
      logger.debug(`🌐 Account API URL: ${account.apiUrl}`)

      // Procesar模型前缀Analizar和映射
      const { baseModel } = parseVendorPrefixedModel(requestBody.model)
      logger.debug(`🔄 Parsed base model: ${baseModel} from original: ${requestBody.model}`)

      let mappedModel = baseModel
      if (
        account.supportedModels &&
        typeof account.supportedModels === 'object' &&
        !Array.isArray(account.supportedModels)
      ) {
        const newModel = ccrAccountService.getMappedModel(account.supportedModels, baseModel)
        if (newModel !== baseModel) {
          logger.info(`🔄 [Stream] Mapping model from ${baseModel} to ${newModel}`)
          mappedModel = newModel
        }
      }

      // Crear修改后的Solicitud体，使用去前缀后的模型名
      const modifiedRequestBody = {
        ...requestBody,
        model: mappedModel
      }

      // CrearProxyagent
      const proxyAgent = ccrAccountService._createProxyAgent(account.proxy)

      // 发送流式Solicitud
      await this._makeCcrStreamRequest(
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
                `📬 User message queue lock released early for CCR stream account ${accountId}, requestId: ${queueRequestId}`
              )
            } catch (releaseError) {
              logger.error(
                `❌ Failed to release user message queue lock early for CCR stream account ${accountId}:`,
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
          `🔌 CCR stream relay ended: Client disconnected (Account: ${account?.name || accountId})`
        )
      } else {
        logger.error(`❌ CCR stream relay failed (Account: ${account?.name || accountId}):`, error)
        // 网络Error标记临时不可用
        if (accountId && !error.response) {
          const autoProtectionDisabled =
            account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
          if (!autoProtectionDisabled) {
            await upstreamErrorHelper.markTempUnavailable(accountId, 'ccr', 503).catch(() => {})
          }
        }
      }
      throw error
    } finally {
      // 📬 释放Usuario消息Cola锁（兜底，正常情况下已在收到Respuesta头后提前释放）
      if (queueLockAcquired && queueRequestId && accountId) {
        try {
          await userMessageQueueService.releaseQueueLock(accountId, queueRequestId)
          logger.debug(
            `📬 User message queue lock released in finally for CCR stream account ${accountId}, requestId: ${queueRequestId}`
          )
        } catch (releaseError) {
          logger.error(
            `❌ Failed to release user message queue lock for CCR stream account ${accountId}:`,
            releaseError.message
          )
        }
      }
    }
  }

  // 🌊 发送流式Solicitud到CCR API
  async _makeCcrStreamRequest(
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
        // 其他 API Key (包括CCR API Key) 使用 Authorization Bearer
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
          logger.debug(`🌊 CCR stream response status: ${response.status}`)

          // ErrorRespuestaProcesar
          if (response.status !== 200) {
            logger.error(
              `❌ CCR API returned error status: ${response.status} | Account: ${account?.name || accountId}`
            )

            const autoProtectionDisabled =
              account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'

            if (response.status === 401) {
              if (!autoProtectionDisabled) {
                upstreamErrorHelper.markTempUnavailable(accountId, 'ccr', 401).catch(() => {})
              }
            } else if (response.status === 429) {
              ccrAccountService.markAccountRateLimited(accountId)
              if (!autoProtectionDisabled) {
                upstreamErrorHelper
                  .markTempUnavailable(
                    accountId,
                    'ccr',
                    429,
                    upstreamErrorHelper.parseRetryAfter(response.headers)
                  )
                  .catch(() => {})
              }
              // Verificar是否因为超过每日额度
              ccrAccountService.checkQuotaUsage(accountId).catch((err) => {
                logger.error('❌ Failed to check quota after 429 error:', err)
              })
            } else if (response.status === 529) {
              ccrAccountService.markAccountOverloaded(accountId)
              if (!autoProtectionDisabled) {
                upstreamErrorHelper.markTempUnavailable(accountId, 'ccr', 529).catch(() => {})
              }
            } else if (response.status >= 500) {
              if (!autoProtectionDisabled) {
                upstreamErrorHelper
                  .markTempUnavailable(accountId, 'ccr', response.status)
                  .catch(() => {})
              }
            }

            // EstablecerErrorRespuesta的状态码和Respuesta头
            if (!responseStream.headersSent) {
              const existingConnection = responseStream.getHeader
                ? responseStream.getHeader('Connection')
                : null
              const errorHeaders = {
                'Content-Type': response.headers['content-type'] || 'application/json',
                'Cache-Control': 'no-cache',
                Connection: existingConnection || 'keep-alive'
              }
              // 避免 Transfer-Encoding 冲突，让 Express 自动Procesar
              delete errorHeaders['Transfer-Encoding']
              delete errorHeaders['Content-Length']
              responseStream.writeHead(response.status, errorHeaders)
            }

            // 直接透传ErrorDatos，不进Fila包装
            response.data.on('data', (chunk) => {
              if (isStreamWritable(responseStream)) {
                responseStream.write(chunk)
              }
            })

            response.data.on('end', () => {
              if (isStreamWritable(responseStream)) {
                responseStream.end()
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
                `❌ Failed to execute onResponseHeaderReceived callback for CCR stream account ${accountId}:`,
                callbackError.message
              )
            }
          }

          // ÉxitoRespuesta，Verificar并EliminaciónError状态
          ccrAccountService.isAccountRateLimited(accountId).then((isRateLimited) => {
            if (isRateLimited) {
              ccrAccountService.removeAccountRateLimit(accountId)
            }
          })
          ccrAccountService.isAccountOverloaded(accountId).then((isOverloaded) => {
            if (isOverloaded) {
              ccrAccountService.removeAccountOverload(accountId)
            }
          })

          // EstablecerRespuesta头
          // ⚠️ 关键Corrección：尊重 auth.js 提前Establecer的 Connection: close
          if (!responseStream.headersSent) {
            const existingConnection = responseStream.getHeader
              ? responseStream.getHeader('Connection')
              : null
            if (existingConnection) {
              logger.debug(
                `🔌 [CCR Stream] Preserving existing Connection header: ${existingConnection}`
              )
            }
            const headers = {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: existingConnection || 'keep-alive',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Cache-Control'
            }
            responseStream.writeHead(200, headers)
          }

          // Procesar流Datos和使用Estadística收集
          let rawBuffer = ''
          const collectedUsage = {}

          response.data.on('data', (chunk) => {
            if (aborted || responseStream.destroyed) {
              return
            }

            try {
              const chunkStr = chunk.toString('utf8')
              rawBuffer += chunkStr

              // 按Fila分割Procesar SSE Datos
              const lines = rawBuffer.split('\n')
              rawBuffer = lines.pop() // 保留最后一个可能不完整的Fila

              for (const line of lines) {
                if (line.trim()) {
                  // Analizar SSE Datos并收集使用Estadística
                  const usageData = this._parseSSELineForUsage(line)
                  if (usageData) {
                    Object.assign(collectedUsage, usageData)
                  }

                  // 应用流Convertir器（如果提供）
                  let outputLine = line
                  if (streamTransformer && typeof streamTransformer === 'function') {
                    outputLine = streamTransformer(line)
                  }

                  // Escribir到Respuesta流
                  if (outputLine && isStreamWritable(responseStream)) {
                    responseStream.write(`${outputLine}\n`)
                  } else if (outputLine) {
                    // ClienteConexión已断开，RegistroAdvertencia
                    logger.warn(
                      `⚠️ [CCR] Client disconnected during stream, skipping data for account: ${accountId}`
                    )
                  }
                } else {
                  // 空Fila也需要传递
                  if (isStreamWritable(responseStream)) {
                    responseStream.write('\n')
                  }
                }
              }
            } catch (err) {
              logger.error('❌ Error processing SSE chunk:', err)
            }
          })

          response.data.on('end', () => {
            // 如果收集到使用EstadísticaDatos，调用回调
            if (usageCallback && Object.keys(collectedUsage).length > 0) {
              try {
                logger.debug(`📊 Collected usage data: ${JSON.stringify(collectedUsage)}`)
                // 在 usage 回调中Incluir模型Información
                usageCallback({ ...collectedUsage, accountId, model: body.model })
              } catch (err) {
                logger.error('❌ Error in usage callback:', err)
              }
            }

            if (isStreamWritable(responseStream)) {
              // 等待Datos完全 flush 到Cliente后再 resolve
              responseStream.end(() => {
                logger.debug(
                  `🌊 CCR stream response completed and flushed | bytesWritten: ${responseStream.bytesWritten || 'unknown'}`
                )
                resolve()
              })
            } else {
              // Conexión已断开，RegistroAdvertencia
              logger.warn(
                `⚠️ [CCR] Client disconnected before stream end, data may not have been received | account: ${accountId}`
              )
              resolve()
            }
          })

          response.data.on('error', (err) => {
            logger.error('❌ Stream data error:', err)
            if (isStreamWritable(responseStream)) {
              responseStream.end()
            }
            reject(err)
          })

          // Cliente断开Procesar
          responseStream.on('close', () => {
            logger.info('🔌 Client disconnected from CCR stream')
            aborted = true
            if (response.data && typeof response.data.destroy === 'function') {
              response.data.destroy()
            }
          })

          responseStream.on('error', (err) => {
            logger.error('❌ Response stream error:', err)
            aborted = true
          })
        })
        .catch((error) => {
          if (!responseStream.headersSent) {
            responseStream.writeHead(500, { 'Content-Type': 'application/json' })
          }

          const errorResponse = {
            error: {
              type: 'internal_error',
              message: 'CCR API request failed'
            }
          }

          if (isStreamWritable(responseStream)) {
            responseStream.write(`data: ${JSON.stringify(errorResponse)}\n\n`)
            responseStream.end()
          }

          reject(error)
        })
    })
  }

  // 📊 AnalizarSSEFila以提取使用EstadísticaInformación
  _parseSSELineForUsage(line) {
    try {
      if (line.startsWith('data: ')) {
        const data = line.substring(6).trim()
        if (data === '[DONE]') {
          return null
        }

        const jsonData = JSON.parse(data)

        // Verificar是否Incluir使用EstadísticaInformación
        if (jsonData.usage) {
          return {
            input_tokens: jsonData.usage.input_tokens || 0,
            output_tokens: jsonData.usage.output_tokens || 0,
            cache_creation_input_tokens: jsonData.usage.cache_creation_input_tokens || 0,
            cache_read_input_tokens: jsonData.usage.cache_read_input_tokens || 0,
            // Soportar ephemeral cache Campo
            cache_creation_input_tokens_ephemeral_5m:
              jsonData.usage.cache_creation_input_tokens_ephemeral_5m || 0,
            cache_creation_input_tokens_ephemeral_1h:
              jsonData.usage.cache_creation_input_tokens_ephemeral_1h || 0
          }
        }

        // Verificar message_delta Evento中的使用Estadística
        if (jsonData.type === 'message_delta' && jsonData.delta && jsonData.delta.usage) {
          return {
            input_tokens: jsonData.delta.usage.input_tokens || 0,
            output_tokens: jsonData.delta.usage.output_tokens || 0,
            cache_creation_input_tokens: jsonData.delta.usage.cache_creation_input_tokens || 0,
            cache_read_input_tokens: jsonData.delta.usage.cache_read_input_tokens || 0,
            cache_creation_input_tokens_ephemeral_5m:
              jsonData.delta.usage.cache_creation_input_tokens_ephemeral_5m || 0,
            cache_creation_input_tokens_ephemeral_1h:
              jsonData.delta.usage.cache_creation_input_tokens_ephemeral_1h || 0
          }
        }
      }
    } catch (err) {
      // 忽略AnalizarError，不是所有Fila都Incluir JSON
    }

    return null
  }

  // 🔍 FiltrarClienteSolicitud头
  _filterClientHeaders(clientHeaders) {
    if (!clientHeaders) {
      return {}
    }

    const filteredHeaders = {}
    const allowedHeaders = [
      'accept-language',
      'anthropic-beta',
      'anthropic-dangerous-direct-browser-access'
    ]

    // 只保留允许的头部Información
    for (const [key, value] of Object.entries(clientHeaders)) {
      const lowerKey = key.toLowerCase()
      if (allowedHeaders.includes(lowerKey)) {
        filteredHeaders[key] = value
      }
    }

    return filteredHeaders
  }

  // ⏰ ActualizarCuenta最后使用Tiempo
  async _updateLastUsedTime(accountId) {
    try {
      const redis = require('../../models/redis')
      const client = redis.getClientSafe()
      await client.hset(`ccr_account:${accountId}`, 'lastUsedAt', new Date().toISOString())
    } catch (error) {
      logger.error(`❌ Failed to update last used time for CCR account ${accountId}:`, error)
    }
  }
}

module.exports = new CcrRelayService()
