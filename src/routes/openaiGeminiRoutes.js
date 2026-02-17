const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')
const { authenticateApiKey } = require('../middleware/auth')
const geminiAccountService = require('../services/account/geminiAccountService')
const unifiedGeminiScheduler = require('../services/scheduler/unifiedGeminiScheduler')
const { getAvailableModels } = require('../services/relay/geminiRelayService')
const crypto = require('crypto')
const apiKeyService = require('../services/apiKeyService')

// GenerarSesión哈希
function generateSessionHash(req) {
  const authSource =
    req.headers['authorization'] || req.headers['x-api-key'] || req.headers['x-goog-api-key']

  const sessionData = [req.headers['user-agent'], req.ip, authSource?.substring(0, 20)]
    .filter(Boolean)
    .join(':')

  return crypto.createHash('sha256').update(sessionData).digest('hex')
}

function ensureAntigravityProjectId(account) {
  if (account.projectId) {
    return account.projectId
  }
  if (account.tempProjectId) {
    return account.tempProjectId
  }
  return `ag-${crypto.randomBytes(8).toString('hex')}`
}

// Verificar API Key Permiso
function checkPermissions(apiKeyData, requiredPermission = 'gemini') {
  return apiKeyService.hasPermission(apiKeyData?.permissions, requiredPermission)
}

// Convertir OpenAI 消息Formato到 Gemini Formato
function convertMessagesToGemini(messages) {
  const contents = []
  let systemInstruction = ''

  // 辅助Función：提取文本内容
  function extractTextContent(content) {
    // Procesar null 或 undefined
    if (content === null || content === undefined) {
      return ''
    }

    // ProcesarCadena
    if (typeof content === 'string') {
      return content
    }

    // ProcesarArregloFormato的内容
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (item === null || item === undefined) {
            return ''
          }
          if (typeof item === 'string') {
            return item
          }
          if (typeof item === 'object') {
            // Procesar {type: 'text', text: '...'} Formato
            if (item.type === 'text' && item.text) {
              return item.text
            }
            // Procesar {text: '...'} Formato
            if (item.text) {
              return item.text
            }
            // Procesar嵌套的Objeto或Arreglo
            if (item.content) {
              return extractTextContent(item.content)
            }
          }
          return ''
        })
        .join('')
    }

    // ProcesarObjetoFormato的内容
    if (typeof content === 'object') {
      // Procesar {text: '...'} Formato
      if (content.text) {
        return content.text
      }
      // Procesar {content: '...'} Formato
      if (content.content) {
        return extractTextContent(content.content)
      }
      // Procesar {parts: [{text: '...'}]} Formato
      if (content.parts && Array.isArray(content.parts)) {
        return content.parts
          .map((part) => {
            if (part && part.text) {
              return part.text
            }
            return ''
          })
          .join('')
      }
    }

    // 最后的后备选项：只有在内容确实不为空且有意义时才Convertir为Cadena
    if (
      content !== undefined &&
      content !== null &&
      content !== '' &&
      typeof content !== 'object'
    ) {
      return String(content)
    }

    return ''
  }

  for (const message of messages) {
    const textContent = extractTextContent(message.content)

    if (message.role === 'system') {
      systemInstruction += (systemInstruction ? '\n\n' : '') + textContent
    } else if (message.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: textContent }]
      })
    } else if (message.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: textContent }]
      })
    }
  }

  return { contents, systemInstruction }
}

// Convertir Gemini Respuesta到 OpenAI Formato
function convertGeminiResponseToOpenAI(geminiResponse, model, stream = false) {
  if (stream) {
    // Procesar流式Respuesta - 原样Retornar SSE Datos
    return geminiResponse
  } else {
    // 非流式RespuestaConvertir
    // Procesar嵌套的 response 结构
    const actualResponse = geminiResponse.response || geminiResponse

    if (actualResponse.candidates && actualResponse.candidates.length > 0) {
      const candidate = actualResponse.candidates[0]
      const content = candidate.content?.parts?.[0]?.text || ''
      const finishReason = candidate.finishReason?.toLowerCase() || 'stop'

      // Calcular token 使用量
      const usage = actualResponse.usageMetadata || {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0
      }

      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content
            },
            finish_reason: finishReason
          }
        ],
        usage: {
          prompt_tokens: usage.promptTokenCount,
          completion_tokens: usage.candidatesTokenCount,
          total_tokens: usage.totalTokenCount
        }
      }
    } else {
      throw new Error('No response from Gemini')
    }
  }
}

// OpenAI 兼容的聊天CompletadoEndpoint
router.post('/v1/chat/completions', authenticateApiKey, async (req, res) => {
  const startTime = Date.now()
  let abortController = null
  let account = null // Declare account outside try block for error handling
  let accountSelection = null // Declare accountSelection for error handling
  let sessionHash = null // Declare sessionHash for error handling

  try {
    const apiKeyData = req.apiKey

    // VerificarPermiso
    if (!checkPermissions(apiKeyData, 'gemini')) {
      return res.status(403).json({
        error: {
          message: 'This API key does not have permission to access Gemini',
          type: 'permission_denied',
          code: 'permission_denied'
        }
      })
    }
    // ProcesarSolicitud体结构 - Soportar多种Formato
    let requestBody = req.body

    // 如果Solicitud体被包装在 body Campo中，解包它
    if (req.body.body && typeof req.body.body === 'object') {
      requestBody = req.body.body
    }

    // 从 URL Ruta中提取模型Información（如果存在）
    let urlModel = null
    const urlPath = req.body?.config?.url || req.originalUrl || req.url
    const modelMatch = urlPath.match(/\/([^/]+):(?:stream)?[Gg]enerateContent/)
    if (modelMatch) {
      urlModel = modelMatch[1]
      logger.debug(`Extracted model from URL: ${urlModel}`)
    }

    // 提取SolicitudParámetro
    const {
      messages: requestMessages,
      contents: requestContents,
      model: bodyModel = 'gemini-2.0-flash-exp',
      temperature = 0.7,
      max_tokens = 4096,
      stream = false
    } = requestBody

    // VerificarURL中是否Incluirstream标识
    const isStreamFromUrl = urlPath && urlPath.includes('streamGenerateContent')
    const actualStream = stream || isStreamFromUrl

    // 优先使用 URL 中的模型，其次是Solicitud体中的模型
    const model = urlModel || bodyModel

    // Soportar两种Formato: OpenAI 的 messages 或 Gemini 的 contents
    let messages = requestMessages
    if (requestContents && Array.isArray(requestContents)) {
      messages = requestContents
    }

    // ValidarRequeridoParámetro
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Messages array is required',
          type: 'invalid_request_error',
          code: 'invalid_request'
        }
      })
    }

    // Verificar模型Límite
    if (apiKeyData.enableModelRestriction && apiKeyData.restrictedModels.length > 0) {
      if (!apiKeyData.restrictedModels.includes(model)) {
        return res.status(403).json({
          error: {
            message: `Model ${model} is not allowed for this API key`,
            type: 'invalid_request_error',
            code: 'model_not_allowed'
          }
        })
      }
    }

    // Convertir消息Formato
    const { contents: geminiContents, systemInstruction } = convertMessagesToGemini(messages)

    // Construir Gemini Solicitud体
    const geminiRequestBody = {
      contents: geminiContents,
      generationConfig: {
        temperature,
        maxOutputTokens: max_tokens,
        candidateCount: 1
      }
    }

    if (systemInstruction) {
      geminiRequestBody.systemInstruction = { parts: [{ text: systemInstruction }] }
    }

    // GenerarSesión哈希用于粘性Sesión
    sessionHash = generateSessionHash(req)

    // 选择可用的 Gemini Cuenta
    try {
      accountSelection = await unifiedGeminiScheduler.selectAccountForApiKey(
        apiKeyData,
        sessionHash,
        model
      )
      account = await geminiAccountService.getAccount(accountSelection.accountId)
    } catch (error) {
      logger.error('Failed to select Gemini account:', error)
      account = null
    }

    if (!account) {
      return res.status(503).json({
        error: {
          message: 'No available Gemini accounts',
          type: 'service_unavailable',
          code: 'service_unavailable'
        }
      })
    }

    logger.info(`Using Gemini account: ${account.id} for API key: ${apiKeyData.id}`)

    // 标记Cuenta被使用
    await geminiAccountService.markAccountUsed(account.id)

    // AnalizarCuenta的ProxyConfiguración
    let proxyConfig = null
    if (account.proxy) {
      try {
        proxyConfig = typeof account.proxy === 'string' ? JSON.parse(account.proxy) : account.proxy
      } catch (e) {
        logger.warn('Failed to parse proxy configuration:', e)
      }
    }

    // Crear中止控制器
    abortController = new AbortController()

    // ProcesarCliente断开Conexión
    req.on('close', () => {
      if (abortController && !abortController.signal.aborted) {
        logger.info('Client disconnected, aborting Gemini request')
        abortController.abort()
      }
    })

    // ObtenerOAuthCliente
    const client = await geminiAccountService.getOauthClient(
      account.accessToken,
      account.refreshToken,
      proxyConfig,
      account.oauthProvider
    )
    if (actualStream) {
      // 流式Respuesta
      const oauthProvider = account.oauthProvider || 'gemini-cli'
      let { projectId } = account

      if (oauthProvider === 'antigravity') {
        projectId = ensureAntigravityProjectId(account)
        if (!account.projectId && account.tempProjectId !== projectId) {
          await geminiAccountService.updateTempProjectId(account.id, projectId)
          account.tempProjectId = projectId
        }
      }

      logger.info('StreamGenerateContent request', {
        model,
        projectId,
        apiKeyId: apiKeyData.id
      })

      const streamResponse =
        oauthProvider === 'antigravity'
          ? await geminiAccountService.generateContentStreamAntigravity(
              client,
              { model, request: geminiRequestBody },
              null, // user_prompt_id
              projectId,
              apiKeyData.id, // 使用 API Key ID 作为 session ID
              abortController.signal, // 传递中止信号
              proxyConfig // 传递ProxyConfiguración
            )
          : await geminiAccountService.generateContentStream(
              client,
              { model, request: geminiRequestBody },
              null, // user_prompt_id
              projectId, // 使用有Permiso的项目ID
              apiKeyData.id, // 使用 API Key ID 作为 session ID
              abortController.signal, // 传递中止信号
              proxyConfig // 传递ProxyConfiguración
            )

      // Establecer流式Respuesta头
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')

      // Procesar流式Respuesta，Convertir为 OpenAI Formato
      let buffer = ''

      // 发送初始的空消息，符合 OpenAI 流式Formato
      const initialChunk = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant' },
            finish_reason: null
          }
        ]
      }
      res.write(`data: ${JSON.stringify(initialChunk)}\n\n`)

      // 用于收集usageDatos
      let totalUsage = {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0
      }
      let usageReported = false // Corrección：改为 let 以便后续修改

      streamResponse.on('data', (chunk) => {
        try {
          const chunkStr = chunk.toString()

          if (!chunkStr.trim()) {
            return
          }

          buffer += chunkStr
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留最后一个不完整的Fila

          for (const line of lines) {
            if (!line.trim()) {
              continue
            }

            // Procesar SSE Formato
            let jsonData = line
            if (line.startsWith('data: ')) {
              jsonData = line.substring(6).trim()
            }

            if (!jsonData || jsonData === '[DONE]') {
              continue
            }

            try {
              const data = JSON.parse(jsonData)

              // 捕获usageDatos
              if (data.response?.usageMetadata) {
                totalUsage = data.response.usageMetadata
                logger.debug('📊 Captured Gemini usage data:', totalUsage)
              }

              // Convertir为 OpenAI 流式Formato
              if (data.response?.candidates && data.response.candidates.length > 0) {
                const candidate = data.response.candidates[0]
                const content = candidate.content?.parts?.[0]?.text || ''
                const { finishReason } = candidate

                // 只有当有内容或者是结束标记时才发送Datos
                if (content || finishReason === 'STOP') {
                  const openaiChunk = {
                    id: `chatcmpl-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [
                      {
                        index: 0,
                        delta: content ? { content } : {},
                        finish_reason: finishReason === 'STOP' ? 'stop' : null
                      }
                    ]
                  }

                  res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`)

                  // 如果结束了，添加 usage InformaciónConcurrencia送最终的 [DONE]
                  if (finishReason === 'STOP') {
                    // 如果有 usage Datos，添加到最后一个 chunk
                    if (data.response.usageMetadata) {
                      const usageChunk = {
                        id: `chatcmpl-${Date.now()}`,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model,
                        choices: [
                          {
                            index: 0,
                            delta: {},
                            finish_reason: 'stop'
                          }
                        ],
                        usage: {
                          prompt_tokens: data.response.usageMetadata.promptTokenCount || 0,
                          completion_tokens: data.response.usageMetadata.candidatesTokenCount || 0,
                          total_tokens: data.response.usageMetadata.totalTokenCount || 0
                        }
                      }
                      res.write(`data: ${JSON.stringify(usageChunk)}\n\n`)
                    }
                    res.write('data: [DONE]\n\n')
                  }
                }
              }
            } catch (e) {
              logger.debug('Error parsing JSON line:', e.message)
            }
          }
        } catch (error) {
          logger.error('Stream processing error:', error)
          if (!res.headersSent) {
            res.status(500).json({
              error: {
                message: error.message || 'Stream error',
                type: 'api_error'
              }
            })
          }
        }
      })

      streamResponse.on('end', async () => {
        logger.info('Stream completed successfully')

        // Registro使用Estadística
        if (!usageReported && totalUsage.totalTokenCount > 0) {
          try {
            await apiKeyService.recordUsage(
              apiKeyData.id,
              totalUsage.promptTokenCount || 0,
              totalUsage.candidatesTokenCount || 0,
              0, // cacheCreateTokens
              0, // cacheReadTokens
              model,
              account.id,
              'gemini'
            )
            logger.info(
              `📊 Recorded Gemini stream usage - Input: ${totalUsage.promptTokenCount}, Output: ${totalUsage.candidatesTokenCount}, Total: ${totalUsage.totalTokenCount}`
            )

            // Corrección：标记 usage 已上报，避免重复上报
            usageReported = true
          } catch (error) {
            logger.error('Failed to record Gemini usage:', error)
          }
        }

        if (!res.headersSent) {
          res.write('data: [DONE]\n\n')
        }
        res.end()
      })

      streamResponse.on('error', (error) => {
        logger.error('Stream error:', error)
        if (!res.headersSent) {
          res.status(500).json({
            error: {
              message: error.message || 'Stream error',
              type: 'api_error'
            }
          })
        } else {
          // 如果已经Iniciando发送流Datos，发送ErrorEvento
          // Corrección：使用 JSON.stringify 避免Cadena插Valor导致的FormatoError
          if (!res.destroyed) {
            try {
              res.write(
                `data: ${JSON.stringify({
                  error: {
                    message: error.message || 'Stream error',
                    type: 'stream_error',
                    code: error.code
                  }
                })}\n\n`
              )
              res.write('data: [DONE]\n\n')
            } catch (writeError) {
              logger.error('Error sending error event:', writeError)
            }
          }
          res.end()
        }
      })
    } else {
      // 非流式Respuesta
      const oauthProvider = account.oauthProvider || 'gemini-cli'
      let { projectId } = account

      if (oauthProvider === 'antigravity') {
        projectId = ensureAntigravityProjectId(account)
        if (!account.projectId && account.tempProjectId !== projectId) {
          await geminiAccountService.updateTempProjectId(account.id, projectId)
          account.tempProjectId = projectId
        }
      }

      logger.info('GenerateContent request', {
        model,
        projectId,
        apiKeyId: apiKeyData.id
      })

      const response =
        oauthProvider === 'antigravity'
          ? await geminiAccountService.generateContentAntigravity(
              client,
              { model, request: geminiRequestBody },
              null, // user_prompt_id
              projectId,
              apiKeyData.id, // 使用 API Key ID 作为 session ID
              proxyConfig // 传递ProxyConfiguración
            )
          : await geminiAccountService.generateContent(
              client,
              { model, request: geminiRequestBody },
              null, // user_prompt_id
              projectId, // 使用有Permiso的项目ID
              apiKeyData.id, // 使用 API Key ID 作为 session ID
              proxyConfig // 传递ProxyConfiguración
            )

      // Convertir为 OpenAI Formato并Retornar
      const openaiResponse = convertGeminiResponseToOpenAI(response, model, false)

      // Registro使用Estadística
      if (openaiResponse.usage) {
        try {
          await apiKeyService.recordUsage(
            apiKeyData.id,
            openaiResponse.usage.prompt_tokens || 0,
            openaiResponse.usage.completion_tokens || 0,
            0, // cacheCreateTokens
            0, // cacheReadTokens
            model,
            account.id,
            'gemini'
          )
          logger.info(
            `📊 Recorded Gemini usage - Input: ${openaiResponse.usage.prompt_tokens}, Output: ${openaiResponse.usage.completion_tokens}, Total: ${openaiResponse.usage.total_tokens}`
          )
        } catch (error) {
          logger.error('Failed to record Gemini usage:', error)
        }
      }

      res.json(openaiResponse)
    }

    const duration = Date.now() - startTime
    logger.info(`OpenAI-Gemini request completed in ${duration}ms`)
  } catch (error) {
    const statusForLog = error?.status || error?.response?.status
    logger.error('OpenAI-Gemini request error', {
      message: error?.message,
      status: statusForLog,
      code: error?.code,
      requestUrl: error?.config?.url,
      requestMethod: error?.config?.method,
      upstreamTraceId: error?.response?.headers?.['x-cloudaicompanion-trace-id']
    })

    // Procesar速率Límite
    if (error.status === 429) {
      if (req.apiKey && account && accountSelection) {
        await unifiedGeminiScheduler.markAccountRateLimited(account.id, 'gemini', sessionHash)
      }
    }

    // VerificarRespuesta是否已发送（流式Respuesta场景），避免 ERR_HTTP_HEADERS_SENT
    if (!res.headersSent) {
      // Cliente断开使用 499 状态码 (Client Closed Request)
      if (error.message === 'Client disconnected') {
        res.status(499).end()
      } else {
        // Retornar OpenAI Formato的ErrorRespuesta
        const status = error.status || 500
        const errorResponse = {
          error: error.error || {
            message: error.message || 'Internal server error',
            type: 'server_error',
            code: 'internal_error'
          }
        }
        res.status(status).json(errorResponse)
      }
    }
  } finally {
    // Limpiar资源
    if (abortController) {
      abortController = null
    }
  }
  return undefined
})

// Obtener可用模型ColumnaTabla的共享Procesar器
async function handleGetModels(req, res) {
  try {
    const apiKeyData = req.apiKey

    // VerificarPermiso
    if (!checkPermissions(apiKeyData, 'gemini')) {
      return res.status(403).json({
        error: {
          message: 'This API key does not have permission to access Gemini',
          type: 'permission_denied',
          code: 'permission_denied'
        }
      })
    }

    // 选择CuentaObtener模型ColumnaTabla
    let account = null
    try {
      const accountSelection = await unifiedGeminiScheduler.selectAccountForApiKey(
        apiKeyData,
        null,
        null
      )
      account = await geminiAccountService.getAccount(accountSelection.accountId)
    } catch (error) {
      logger.warn('Failed to select Gemini account for models endpoint:', error)
    }

    let models = []

    if (account) {
      // Obtener实际的模型ColumnaTabla（Falló时Retirada到PredeterminadoColumnaTabla，避免影响 /v1/models 可用性）
      try {
        const oauthProvider = account.oauthProvider || 'gemini-cli'
        models =
          oauthProvider === 'antigravity'
            ? await geminiAccountService.fetchAvailableModelsAntigravity(
                account.accessToken,
                account.proxy,
                account.refreshToken
              )
            : await getAvailableModels(account.accessToken, account.proxy)
      } catch (error) {
        logger.warn('Failed to get Gemini models list from upstream, fallback to default:', error)
        models = []
      }
    } else {
      // RetornarPredeterminado模型ColumnaTabla
      models = [
        {
          id: 'gemini-2.0-flash-exp',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'google'
        }
      ]
    }

    if (!models || models.length === 0) {
      models = [
        {
          id: 'gemini-2.0-flash-exp',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'google'
        }
      ]
    }

    // 如果Habilitar了模型Límite，Filtrar模型ColumnaTabla
    if (apiKeyData.enableModelRestriction && apiKeyData.restrictedModels.length > 0) {
      models = models.filter((model) => apiKeyData.restrictedModels.includes(model.id))
    }

    res.json({
      object: 'list',
      data: models
    })
  } catch (error) {
    logger.error('Failed to get OpenAI-Gemini models:', error)
    res.status(500).json({
      error: {
        message: 'Failed to retrieve models',
        type: 'server_error',
        code: 'internal_error'
      }
    })
  }
}

// OpenAI 兼容的模型ColumnaTablaEndpoint (带 v1 版)
router.get('/v1/models', authenticateApiKey, handleGetModels)

// OpenAI 兼容的模型ColumnaTablaEndpoint (根Ruta版，方便第三方加载)
router.get('/models', authenticateApiKey, handleGetModels)

// OpenAI 兼容的模型详情Endpoint
router.get('/v1/models/:model', authenticateApiKey, async (req, res) => {
  try {
    const apiKeyData = req.apiKey
    const modelId = req.params.model

    // VerificarPermiso
    if (!checkPermissions(apiKeyData, 'gemini')) {
      return res.status(403).json({
        error: {
          message: 'This API key does not have permission to access Gemini',
          type: 'permission_denied',
          code: 'permission_denied'
        }
      })
    }

    // Verificar模型Límite
    if (apiKeyData.enableModelRestriction && apiKeyData.restrictedModels.length > 0) {
      if (!apiKeyData.restrictedModels.includes(modelId)) {
        return res.status(404).json({
          error: {
            message: `Model '${modelId}' not found`,
            type: 'invalid_request_error',
            code: 'model_not_found'
          }
        })
      }
    }

    // Retornar模型Información
    res.json({
      id: modelId,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'google',
      permission: [],
      root: modelId,
      parent: null
    })
  } catch (error) {
    logger.error('Failed to get model details:', error)
    res.status(500).json({
      error: {
        message: 'Failed to retrieve model details',
        type: 'server_error',
        code: 'internal_error'
      }
    })
  }
  return undefined
})

module.exports = router
