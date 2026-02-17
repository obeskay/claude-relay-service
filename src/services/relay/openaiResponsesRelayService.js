const axios = require('axios')
const ProxyHelper = require('../../utils/proxyHelper')
const logger = require('../../utils/logger')
const { filterForOpenAI } = require('../../utils/headerFilter')
const openaiResponsesAccountService = require('../account/openaiResponsesAccountService')
const apiKeyService = require('../apiKeyService')
const unifiedOpenAIScheduler = require('../scheduler/unifiedOpenAIScheduler')
const config = require('../../../config/config')
const crypto = require('crypto')
const LRUCache = require('../../utils/lruCache')
const upstreamErrorHelper = require('../../utils/upstreamErrorHelper')

// lastUsedAt Actualizar节流（每Cuenta 60 秒内最多Actualizar一次，使用 LRU 防止内存泄漏）
const lastUsedAtThrottle = new LRUCache(1000) // 最多Caché 1000 个Cuenta
const LAST_USED_AT_THROTTLE_MS = 60000

// 抽取CachéEscribir token，兼容多种Campo命名
function extractCacheCreationTokens(usageData) {
  if (!usageData || typeof usageData !== 'object') {
    return 0
  }

  const details = usageData.input_tokens_details || usageData.prompt_tokens_details || {}
  const candidates = [
    details.cache_creation_input_tokens,
    details.cache_creation_tokens,
    usageData.cache_creation_input_tokens,
    usageData.cache_creation_tokens
  ]

  for (const value of candidates) {
    if (value !== undefined && value !== null && value !== '') {
      const parsed = Number(value)
      if (!Number.isNaN(parsed)) {
        return parsed
      }
    }
  }

  return 0
}

class OpenAIResponsesRelayService {
  constructor() {
    this.defaultTimeout = config.requestTimeout || 600000
  }

  // 节流Actualizar lastUsedAt
  async _throttledUpdateLastUsedAt(accountId) {
    const now = Date.now()
    const lastUpdate = lastUsedAtThrottle.get(accountId)

    if (lastUpdate && now - lastUpdate < LAST_USED_AT_THROTTLE_MS) {
      return // 跳过Actualizar
    }

    lastUsedAtThrottle.set(accountId, now, LAST_USED_AT_THROTTLE_MS)
    await openaiResponsesAccountService.updateAccount(accountId, {
      lastUsedAt: new Date().toISOString()
    })
  }

  // ProcesarSolicitud转发
  async handleRequest(req, res, account, apiKeyData) {
    let abortController = null
    // ObtenerSesión哈希（如果有的话）
    const sessionId = req.headers['session_id'] || req.body?.session_id
    const sessionHash = sessionId
      ? crypto.createHash('sha256').update(sessionId).digest('hex')
      : null

    try {
      // Obtener完整的CuentaInformación（IncluirDescifrado的 API Key）
      const fullAccount = await openaiResponsesAccountService.getAccount(account.id)
      if (!fullAccount) {
        throw new Error('Account not found')
      }

      // Crear AbortController 用于取消Solicitud
      abortController = new AbortController()

      // EstablecerCliente断开Escucha
      const handleClientDisconnect = () => {
        logger.info('🔌 Client disconnected, aborting OpenAI-Responses request')
        if (abortController && !abortController.signal.aborted) {
          abortController.abort()
        }
      }

      // 监听Cliente断开Evento
      req.once('close', handleClientDisconnect)
      res.once('close', handleClientDisconnect)

      // Construir目标 URL
      const targetUrl = `${fullAccount.baseApi}${req.path}`
      logger.info(`🎯 Forwarding to: ${targetUrl}`)

      // ConstruirSolicitud头 - 使用统一的 headerFilter Eliminación CDN headers
      const headers = {
        ...filterForOpenAI(req.headers),
        Authorization: `Bearer ${fullAccount.apiKey}`,
        'Content-Type': 'application/json'
      }

      // Procesar User-Agent
      if (fullAccount.userAgent) {
        // 使用自定义 User-Agent
        headers['User-Agent'] = fullAccount.userAgent
        logger.debug(`📱 Using custom User-Agent: ${fullAccount.userAgent}`)
      } else if (req.headers['user-agent']) {
        // 透传原始 User-Agent
        headers['User-Agent'] = req.headers['user-agent']
        logger.debug(`📱 Forwarding original User-Agent: ${req.headers['user-agent']}`)
      }

      // ConfiguraciónSolicitud选项
      const requestOptions = {
        method: req.method,
        url: targetUrl,
        headers,
        data: req.body,
        timeout: this.defaultTimeout,
        responseType: req.body?.stream ? 'stream' : 'json',
        validateStatus: () => true, // 允许Procesar所有状态码
        signal: abortController.signal
      }

      // ConfiguraciónProxy（如果有）
      if (fullAccount.proxy) {
        const proxyAgent = ProxyHelper.createProxyAgent(fullAccount.proxy)
        if (proxyAgent) {
          requestOptions.httpAgent = proxyAgent
          requestOptions.httpsAgent = proxyAgent
          requestOptions.proxy = false
          logger.info(
            `🌐 Using proxy for OpenAI-Responses: ${ProxyHelper.getProxyDescription(fullAccount.proxy)}`
          )
        }
      }

      // RegistroSolicitudInformación
      logger.info('📤 OpenAI-Responses relay request', {
        accountId: account.id,
        accountName: account.name,
        targetUrl,
        method: req.method,
        stream: req.body?.stream || false,
        model: req.body?.model || 'unknown',
        userAgent: headers['User-Agent'] || 'not set'
      })

      // 发送Solicitud
      const response = await axios(requestOptions)

      // Procesar 429 限流Error
      if (response.status === 429) {
        const { resetsInSeconds, errorData } = await this._handle429Error(
          account,
          response,
          req.body?.stream,
          sessionHash
        )

        const oaiAutoProtectionDisabled =
          account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
        if (!oaiAutoProtectionDisabled) {
          await upstreamErrorHelper
            .markTempUnavailable(
              account.id,
              'openai-responses',
              429,
              resetsInSeconds || upstreamErrorHelper.parseRetryAfter(response.headers)
            )
            .catch(() => {})
        }

        // RetornarErrorRespuesta（使用Procesar后的Datos，避免Bucle引用）
        const errorResponse = errorData || {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
            code: 'rate_limit_exceeded',
            resets_in_seconds: resetsInSeconds
          }
        }
        return res.status(429).json(errorResponse)
      }

      // Procesar其他Error状态码
      if (response.status >= 400) {
        // Procesar流式ErrorRespuesta
        let errorData = response.data
        if (response.data && typeof response.data.pipe === 'function') {
          // 流式Respuesta需要先Leer内容
          const chunks = []
          await new Promise((resolve) => {
            response.data.on('data', (chunk) => chunks.push(chunk))
            response.data.on('end', resolve)
            response.data.on('error', resolve)
            setTimeout(resolve, 5000) // Tiempo de espera agotado保护
          })
          const fullResponse = Buffer.concat(chunks).toString()

          // 尝试AnalizarErrorRespuesta
          try {
            if (fullResponse.includes('data: ')) {
              // SSEFormato
              const lines = fullResponse.split('\n')
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const jsonStr = line.slice(6).trim()
                  if (jsonStr && jsonStr !== '[DONE]') {
                    errorData = JSON.parse(jsonStr)
                    break
                  }
                }
              }
            } else {
              // 普通JSON
              errorData = JSON.parse(fullResponse)
            }
          } catch (e) {
            logger.error('Failed to parse error response:', e)
            errorData = { error: { message: fullResponse || 'Unknown error' } }
          }
        }

        logger.error('OpenAI-Responses API error', {
          status: response.status,
          statusText: response.statusText,
          errorData
        })

        if (response.status === 401) {
          logger.warn(`🚫 OpenAI Responses账号认证Falló（401Error）for account ${account?.id}`)

          try {
            // 仅临时暂停，不永久Deshabilitar
            const oaiAutoProtectionDisabled =
              account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
            if (!oaiAutoProtectionDisabled) {
              await upstreamErrorHelper
                .markTempUnavailable(account.id, 'openai-responses', 401)
                .catch(() => {})
            }
            if (sessionHash) {
              await unifiedOpenAIScheduler._deleteSessionMapping(sessionHash).catch(() => {})
            }
          } catch (markError) {
            logger.error(
              '❌ Failed to mark OpenAI-Responses account temporarily unavailable after 401:',
              markError
            )
          }

          let unauthorizedResponse = errorData
          if (
            !unauthorizedResponse ||
            typeof unauthorizedResponse !== 'object' ||
            unauthorizedResponse.pipe ||
            Buffer.isBuffer(unauthorizedResponse)
          ) {
            const fallbackMessage =
              typeof errorData === 'string' && errorData.trim() ? errorData.trim() : 'Unauthorized'
            unauthorizedResponse = {
              error: {
                message: fallbackMessage,
                type: 'unauthorized',
                code: 'unauthorized'
              }
            }
          }

          // LimpiarEscucha
          req.removeListener('close', handleClientDisconnect)
          res.removeListener('close', handleClientDisconnect)

          return res.status(401).json(unauthorizedResponse)
        }

        // Procesar 5xx 上游Error
        if (response.status >= 500 && account?.id) {
          try {
            const oaiAutoProtectionDisabled =
              account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
            if (!oaiAutoProtectionDisabled) {
              await upstreamErrorHelper.markTempUnavailable(
                account.id,
                'openai-responses',
                response.status
              )
            }
            if (sessionHash) {
              await unifiedOpenAIScheduler._deleteSessionMapping(sessionHash).catch(() => {})
            }
          } catch (markError) {
            logger.warn(
              'Failed to mark OpenAI-Responses account temporarily unavailable:',
              markError
            )
          }
        }

        // LimpiarEscucha
        req.removeListener('close', handleClientDisconnect)
        res.removeListener('close', handleClientDisconnect)

        return res
          .status(response.status)
          .json(upstreamErrorHelper.sanitizeErrorForClient(errorData))
      }

      // Actualizar最后使用Tiempo（节流）
      await this._throttledUpdateLastUsedAt(account.id)

      // Procesar流式Respuesta
      if (req.body?.stream && response.data && typeof response.data.pipe === 'function') {
        return this._handleStreamResponse(
          response,
          res,
          account,
          apiKeyData,
          req.body?.model,
          handleClientDisconnect,
          req
        )
      }

      // Procesar非流式Respuesta
      return this._handleNormalResponse(response, res, account, apiKeyData, req.body?.model)
    } catch (error) {
      // Limpiar AbortController
      if (abortController && !abortController.signal.aborted) {
        abortController.abort()
      }

      // Seguridad地RegistroError，避免Bucle引用
      const errorInfo = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText
      }
      logger.error('OpenAI-Responses relay error:', errorInfo)

      // Verificar是否是网络Error
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        if (account?.id) {
          const oaiAutoProtectionDisabled =
            account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
          if (!oaiAutoProtectionDisabled) {
            await upstreamErrorHelper
              .markTempUnavailable(account.id, 'openai-responses', 503)
              .catch(() => {})
          }
        }
      }

      // 如果已经发送了Respuesta头，直接结束
      if (res.headersSent) {
        return res.end()
      }

      // Verificar是否是axiosError并IncluirRespuesta
      if (error.response) {
        // ProcesaraxiosErrorRespuesta
        const status = error.response.status || 500
        let errorData = {
          error: {
            message: error.response.statusText || 'Request failed',
            type: 'api_error',
            code: error.code || 'unknown'
          }
        }

        // 如果RespuestaIncluirDatos，尝试使用它
        if (error.response.data) {
          // Verificar是否是流
          if (typeof error.response.data === 'object' && !error.response.data.pipe) {
            errorData = error.response.data
          } else if (typeof error.response.data === 'string') {
            try {
              errorData = JSON.parse(error.response.data)
            } catch (e) {
              errorData.error.message = error.response.data
            }
          }
        }

        if (status === 401) {
          logger.warn(
            `🚫 OpenAI Responses账号认证Falló（401Error）for account ${account?.id} (catch handler)`
          )

          try {
            // 仅临时暂停，不永久Deshabilitar
            const oaiAutoProtectionDisabled =
              account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
            if (!oaiAutoProtectionDisabled) {
              await upstreamErrorHelper
                .markTempUnavailable(account.id, 'openai-responses', 401)
                .catch(() => {})
            }
            if (sessionHash) {
              await unifiedOpenAIScheduler._deleteSessionMapping(sessionHash).catch(() => {})
            }
          } catch (markError) {
            logger.error(
              '❌ Failed to mark OpenAI-Responses account temporarily unavailable in catch handler:',
              markError
            )
          }

          let unauthorizedResponse = errorData
          if (
            !unauthorizedResponse ||
            typeof unauthorizedResponse !== 'object' ||
            unauthorizedResponse.pipe ||
            Buffer.isBuffer(unauthorizedResponse)
          ) {
            const fallbackMessage =
              typeof errorData === 'string' && errorData.trim() ? errorData.trim() : 'Unauthorized'
            unauthorizedResponse = {
              error: {
                message: fallbackMessage,
                type: 'unauthorized',
                code: 'unauthorized'
              }
            }
          }

          return res.status(401).json(unauthorizedResponse)
        }

        return res.status(status).json(upstreamErrorHelper.sanitizeErrorForClient(errorData))
      }

      // 其他Error
      return res.status(500).json({
        error: {
          message: 'Internal server error',
          type: 'internal_error',
          details: error.message
        }
      })
    }
  }

  // Procesar流式Respuesta
  async _handleStreamResponse(
    response,
    res,
    account,
    apiKeyData,
    requestedModel,
    handleClientDisconnect,
    req
  ) {
    // Establecer SSE Respuesta头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    let usageData = null
    let actualModel = null
    let buffer = ''
    let rateLimitDetected = false
    let rateLimitResetsInSeconds = null
    let streamEnded = false

    // Analizar SSE Evento以捕获 usage Datos和 model
    const parseSSEForUsage = (data) => {
      const lines = data.split('\n')

      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const jsonStr = line.slice(5).trim()
            if (jsonStr === '[DONE]') {
              continue
            }

            const eventData = JSON.parse(jsonStr)

            // Verificar是否是 response.completed Evento（OpenAI-Responses Formato）
            if (eventData.type === 'response.completed' && eventData.response) {
              // 从Respuesta中Obtener真实的 model
              if (eventData.response.model) {
                actualModel = eventData.response.model
                logger.debug(`📊 Captured actual model from response.completed: ${actualModel}`)
              }

              // Obtener usage Datos - OpenAI-Responses Formato在 response.usage 下
              if (eventData.response.usage) {
                usageData = eventData.response.usage
                logger.info('📊 Successfully captured usage data from OpenAI-Responses:', {
                  input_tokens: usageData.input_tokens,
                  output_tokens: usageData.output_tokens,
                  total_tokens: usageData.total_tokens
                })
              }
            }

            // Verificar是否有限流Error
            if (eventData.error) {
              // Verificar多种可能的限流ErrorTipo
              if (
                eventData.error.type === 'rate_limit_error' ||
                eventData.error.type === 'usage_limit_reached' ||
                eventData.error.type === 'rate_limit_exceeded'
              ) {
                rateLimitDetected = true
                if (eventData.error.resets_in_seconds) {
                  rateLimitResetsInSeconds = eventData.error.resets_in_seconds
                  logger.warn(
                    `🚫 Rate limit detected in stream, resets in ${rateLimitResetsInSeconds} seconds (${Math.ceil(rateLimitResetsInSeconds / 60)} minutes)`
                  )
                }
              }
            }
          } catch (e) {
            // 忽略AnalizarError
          }
        }
      }
    }

    // 监听Datos流
    response.data.on('data', (chunk) => {
      try {
        const chunkStr = chunk.toString()

        // 转发Datos给Cliente
        if (!res.destroyed && !streamEnded) {
          res.write(chunk)
        }

        // 同时AnalizarDatos以捕获 usage Información
        buffer += chunkStr

        // Procesar完整的 SSE Evento
        if (buffer.includes('\n\n')) {
          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const event of events) {
            if (event.trim()) {
              parseSSEForUsage(event)
            }
          }
        }
      } catch (error) {
        logger.error('Error processing stream chunk:', error)
      }
    })

    response.data.on('end', async () => {
      streamEnded = true

      // Procesar剩余的 buffer
      if (buffer.trim()) {
        parseSSEForUsage(buffer)
      }

      // Registro使用Estadística
      if (usageData) {
        try {
          // OpenAI-Responses 使用 input_tokens/output_tokens，标准 OpenAI 使用 prompt_tokens/completion_tokens
          const totalInputTokens = usageData.input_tokens || usageData.prompt_tokens || 0
          const outputTokens = usageData.output_tokens || usageData.completion_tokens || 0

          // 提取Caché相关的 tokens（如果存在）
          const cacheReadTokens = usageData.input_tokens_details?.cached_tokens || 0
          const cacheCreateTokens = extractCacheCreationTokens(usageData)
          // Calcular实际输入token（总输入减去Caché部分）
          const actualInputTokens = Math.max(0, totalInputTokens - cacheReadTokens)

          const totalTokens =
            usageData.total_tokens || totalInputTokens + outputTokens + cacheCreateTokens
          const modelToRecord = actualModel || requestedModel || 'gpt-4'

          await apiKeyService.recordUsage(
            apiKeyData.id,
            actualInputTokens, // 传递实际输入（不含Caché）
            outputTokens,
            cacheCreateTokens,
            cacheReadTokens,
            modelToRecord,
            account.id,
            'openai-responses'
          )

          logger.info(
            `📊 Recorded usage - Input: ${totalInputTokens}(actual:${actualInputTokens}+cached:${cacheReadTokens}), CacheCreate: ${cacheCreateTokens}, Output: ${outputTokens}, Total: ${totalTokens}, Model: ${modelToRecord}`
          )

          // ActualizarCuenta的 token 使用Estadística
          await openaiResponsesAccountService.updateAccountUsage(account.id, totalTokens)

          // ActualizarCuenta使用额度（如果Establecer了额度Límite）
          if (parseFloat(account.dailyQuota) > 0) {
            // 使用CostCalculator正确Calcular费用（考虑Cachétoken的不同价格）
            const CostCalculator = require('../../utils/costCalculator')
            const costInfo = CostCalculator.calculateCost(
              {
                input_tokens: actualInputTokens, // 实际输入（不含Caché）
                output_tokens: outputTokens,
                cache_creation_input_tokens: cacheCreateTokens,
                cache_read_input_tokens: cacheReadTokens
              },
              modelToRecord
            )
            await openaiResponsesAccountService.updateUsageQuota(account.id, costInfo.costs.total)
          }
        } catch (error) {
          logger.error('Failed to record usage:', error)
        }
      }

      // 如果在流式Respuesta中检测到限流
      if (rateLimitDetected) {
        // 使用统一调度器Procesar限流（与非流式Respuesta保持一致）
        const sessionId = req.headers['session_id'] || req.body?.session_id
        const sessionHash = sessionId
          ? crypto.createHash('sha256').update(sessionId).digest('hex')
          : null

        await unifiedOpenAIScheduler.markAccountRateLimited(
          account.id,
          'openai-responses',
          sessionHash,
          rateLimitResetsInSeconds
        )

        logger.warn(
          `🚫 Processing rate limit for OpenAI-Responses account ${account.id} from stream`
        )
      }

      // LimpiarEscucha
      req.removeListener('close', handleClientDisconnect)
      res.removeListener('close', handleClientDisconnect)

      if (!res.destroyed) {
        res.end()
      }

      logger.info('Stream response completed', {
        accountId: account.id,
        hasUsage: !!usageData,
        actualModel: actualModel || 'unknown'
      })
    })

    response.data.on('error', (error) => {
      streamEnded = true
      logger.error('Stream error:', error)

      // LimpiarEscucha
      req.removeListener('close', handleClientDisconnect)
      res.removeListener('close', handleClientDisconnect)

      if (!res.headersSent) {
        res.status(502).json({ error: { message: 'Upstream stream error' } })
      } else if (!res.destroyed) {
        res.end()
      }
    })

    // ProcesarCliente断开Conexión
    const cleanup = () => {
      streamEnded = true
      try {
        response.data?.unpipe?.(res)
        response.data?.destroy?.()
      } catch (_) {
        // 忽略LimpiarError
      }
    }

    req.on('close', cleanup)
    req.on('aborted', cleanup)
  }

  // Procesar非流式Respuesta
  async _handleNormalResponse(response, res, account, apiKeyData, requestedModel) {
    const responseData = response.data

    // 提取 usage Datos和实际 model
    // Soportar两种Formato：直接的 usage 或嵌套在 response 中的 usage
    const usageData = responseData?.usage || responseData?.response?.usage
    const actualModel =
      responseData?.model || responseData?.response?.model || requestedModel || 'gpt-4'

    // Registro使用Estadística
    if (usageData) {
      try {
        // OpenAI-Responses 使用 input_tokens/output_tokens，标准 OpenAI 使用 prompt_tokens/completion_tokens
        const totalInputTokens = usageData.input_tokens || usageData.prompt_tokens || 0
        const outputTokens = usageData.output_tokens || usageData.completion_tokens || 0

        // 提取Caché相关的 tokens（如果存在）
        const cacheReadTokens = usageData.input_tokens_details?.cached_tokens || 0
        const cacheCreateTokens = extractCacheCreationTokens(usageData)
        // Calcular实际输入token（总输入减去Caché部分）
        const actualInputTokens = Math.max(0, totalInputTokens - cacheReadTokens)

        const totalTokens =
          usageData.total_tokens || totalInputTokens + outputTokens + cacheCreateTokens

        await apiKeyService.recordUsage(
          apiKeyData.id,
          actualInputTokens, // 传递实际输入（不含Caché）
          outputTokens,
          cacheCreateTokens,
          cacheReadTokens,
          actualModel,
          account.id,
          'openai-responses'
        )

        logger.info(
          `📊 Recorded non-stream usage - Input: ${totalInputTokens}(actual:${actualInputTokens}+cached:${cacheReadTokens}), CacheCreate: ${cacheCreateTokens}, Output: ${outputTokens}, Total: ${totalTokens}, Model: ${actualModel}`
        )

        // ActualizarCuenta的 token 使用Estadística
        await openaiResponsesAccountService.updateAccountUsage(account.id, totalTokens)

        // ActualizarCuenta使用额度（如果Establecer了额度Límite）
        if (parseFloat(account.dailyQuota) > 0) {
          // 使用CostCalculator正确Calcular费用（考虑Cachétoken的不同价格）
          const CostCalculator = require('../../utils/costCalculator')
          const costInfo = CostCalculator.calculateCost(
            {
              input_tokens: actualInputTokens, // 实际输入（不含Caché）
              output_tokens: outputTokens,
              cache_creation_input_tokens: cacheCreateTokens,
              cache_read_input_tokens: cacheReadTokens
            },
            actualModel
          )
          await openaiResponsesAccountService.updateUsageQuota(account.id, costInfo.costs.total)
        }
      } catch (error) {
        logger.error('Failed to record usage:', error)
      }
    }

    // RetornarRespuesta
    res.status(response.status).json(responseData)

    logger.info('Normal response completed', {
      accountId: account.id,
      status: response.status,
      hasUsage: !!usageData,
      model: actualModel
    })
  }

  // Procesar 429 限流Error
  async _handle429Error(account, response, isStream = false, sessionHash = null) {
    let resetsInSeconds = null
    let errorData = null

    try {
      // 对于429Error，Respuesta可能是JSON或SSEFormato
      if (isStream && response.data && typeof response.data.pipe === 'function') {
        // 流式Respuesta需要先收集Datos
        const chunks = []
        await new Promise((resolve, reject) => {
          response.data.on('data', (chunk) => chunks.push(chunk))
          response.data.on('end', resolve)
          response.data.on('error', reject)
          // EstablecerTiempo de espera agotado防止无限等待
          setTimeout(resolve, 5000)
        })

        const fullResponse = Buffer.concat(chunks).toString()

        // 尝试AnalizarSSEFormato的ErrorRespuesta
        if (fullResponse.includes('data: ')) {
          const lines = fullResponse.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim()
                if (jsonStr && jsonStr !== '[DONE]') {
                  errorData = JSON.parse(jsonStr)
                  break
                }
              } catch (e) {
                // 继续尝试下一Fila
              }
            }
          }
        }

        // 如果SSEAnalizarFalló，尝试直接Analizar为JSON
        if (!errorData) {
          try {
            errorData = JSON.parse(fullResponse)
          } catch (e) {
            logger.error('Failed to parse 429 error response:', e)
            logger.debug('Raw response:', fullResponse)
          }
        }
      } else if (response.data && typeof response.data !== 'object') {
        // 如果response.data是Cadena，尝试Analizar为JSON
        try {
          errorData = JSON.parse(response.data)
        } catch (e) {
          logger.error('Failed to parse 429 error response as JSON:', e)
          errorData = { error: { message: response.data } }
        }
      } else if (response.data && typeof response.data === 'object' && !response.data.pipe) {
        // 非流式Respuesta，且是Objeto，直接使用
        errorData = response.data
      }

      // 从Respuesta体中提取重置Tiempo（OpenAI 标准Formato）
      if (errorData && errorData.error) {
        if (errorData.error.resets_in_seconds) {
          resetsInSeconds = errorData.error.resets_in_seconds
          logger.info(
            `🕐 Rate limit will reset in ${resetsInSeconds} seconds (${Math.ceil(resetsInSeconds / 60)} minutes / ${Math.ceil(resetsInSeconds / 3600)} hours)`
          )
        } else if (errorData.error.resets_in) {
          // 某些 API 可能使用不同的Campo名
          resetsInSeconds = parseInt(errorData.error.resets_in)
          logger.info(
            `🕐 Rate limit will reset in ${resetsInSeconds} seconds (${Math.ceil(resetsInSeconds / 60)} minutes / ${Math.ceil(resetsInSeconds / 3600)} hours)`
          )
        }
      }

      if (!resetsInSeconds) {
        logger.warn('⚠️ Could not extract reset time from 429 response, using default 60 minutes')
      }
    } catch (e) {
      logger.error('⚠️ Failed to parse rate limit error:', e)
    }

    // 使用统一调度器标记Cuenta为限流状态（与普通OpenAI账号保持一致）
    await unifiedOpenAIScheduler.markAccountRateLimited(
      account.id,
      'openai-responses',
      sessionHash,
      resetsInSeconds
    )

    logger.warn('OpenAI-Responses account rate limited', {
      accountId: account.id,
      accountName: account.name,
      resetsInSeconds: resetsInSeconds || 'unknown',
      resetInMinutes: resetsInSeconds ? Math.ceil(resetsInSeconds / 60) : 60,
      resetInHours: resetsInSeconds ? Math.ceil(resetsInSeconds / 3600) : 1
    })

    // RetornarProcesar后的Datos，避免Bucle引用
    return { resetsInSeconds, errorData }
  }

  // FiltrarSolicitud头 - 已Migración到 headerFilter 工具Clase
  // 此Método保留用于向后兼容，实际使用 filterForOpenAI()
  _filterRequestHeaders(headers) {
    return filterForOpenAI(headers)
  }

  // 估算费用（简化Versión，实际应该根据不同的定价模型）
  _estimateCost(model, inputTokens, outputTokens) {
    // 这是一个简化的费用估算，实际应该根据不同的 API 提供商和模型定价
    const rates = {
      'gpt-4': { input: 0.03, output: 0.06 }, // per 1K tokens
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 }
    }

    // 查找匹配的模型定价
    let rate = rates['gpt-3.5-turbo'] // Predeterminado使用 GPT-3.5 的价格
    for (const [modelKey, modelRate] of Object.entries(rates)) {
      if (model.toLowerCase().includes(modelKey.toLowerCase())) {
        rate = modelRate
        break
      }
    }

    const inputCost = (inputTokens / 1000) * rate.input
    const outputCost = (outputTokens / 1000) * rate.output
    return inputCost + outputCost
  }
}

module.exports = new OpenAIResponsesRelayService()
