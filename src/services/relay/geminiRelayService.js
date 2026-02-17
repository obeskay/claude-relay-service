const axios = require('axios')
const ProxyHelper = require('../../utils/proxyHelper')
const logger = require('../../utils/logger')
const config = require('../../../config/config')
const apiKeyService = require('../apiKeyService')

// Gemini API Configuración
const GEMINI_API_BASE = 'https://cloudcode.googleapis.com/v1'
const DEFAULT_MODEL = 'models/gemini-2.0-flash-exp'

// CrearProxy agent（使用统一的Proxy工具）
function createProxyAgent(proxyConfig) {
  return ProxyHelper.createProxyAgent(proxyConfig)
}

// Convertir OpenAI 消息Formato到 Gemini Formato
function convertMessagesToGemini(messages) {
  const contents = []
  let systemInstruction = ''

  for (const message of messages) {
    if (message.role === 'system') {
      systemInstruction += (systemInstruction ? '\n\n' : '') + message.content
    } else if (message.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: message.content }]
      })
    } else if (message.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: message.content }]
      })
    }
  }

  return { contents, systemInstruction }
}

// Convertir Gemini Respuesta到 OpenAI Formato
function convertGeminiResponse(geminiResponse, model, stream = false) {
  if (stream) {
    // 流式Respuesta
    const candidate = geminiResponse.candidates?.[0]
    if (!candidate) {
      return null
    }

    const content = candidate.content?.parts?.[0]?.text || ''
    const finishReason = candidate.finishReason?.toLowerCase()

    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {
            content
          },
          finish_reason: finishReason === 'stop' ? 'stop' : null
        }
      ]
    }
  } else {
    // 非流式Respuesta
    const candidate = geminiResponse.candidates?.[0]
    if (!candidate) {
      throw new Error('No response from Gemini')
    }

    const content = candidate.content?.parts?.[0]?.text || ''
    const finishReason = candidate.finishReason?.toLowerCase() || 'stop'

    // Calcular token 使用量
    const usage = geminiResponse.usageMetadata || {
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
  }
}

// Procesar流式Respuesta
async function* handleStreamResponse(response, model, apiKeyId, accountId = null) {
  let buffer = ''
  let totalUsage = {
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    totalTokenCount: 0
  }

  try {
    for await (const chunk of response.data) {
      buffer += chunk.toString()

      // Procesar SSE Formato的Datos
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留最后一个不完整的Fila

      for (const line of lines) {
        if (!line.trim()) {
          continue
        }

        // Procesar SSE Formato: "data: {...}"
        let jsonData = line
        if (line.startsWith('data: ')) {
          jsonData = line.substring(6).trim()
        }

        if (!jsonData || jsonData === '[DONE]') {
          continue
        }

        try {
          const data = JSON.parse(jsonData)

          // Actualizar使用量Estadística
          if (data.usageMetadata) {
            totalUsage = data.usageMetadata
          }

          // ConvertirConcurrencia送Respuesta
          const openaiResponse = convertGeminiResponse(data, model, true)
          if (openaiResponse) {
            yield `data: ${JSON.stringify(openaiResponse)}\n\n`
          }

          // Verificar是否结束
          if (data.candidates?.[0]?.finishReason === 'STOP') {
            // Registro使用量
            if (apiKeyId && totalUsage.totalTokenCount > 0) {
              await apiKeyService
                .recordUsage(
                  apiKeyId,
                  totalUsage.promptTokenCount || 0, // inputTokens
                  totalUsage.candidatesTokenCount || 0, // outputTokens
                  0, // cacheCreateTokens (Gemini 没有这个概念)
                  0, // cacheReadTokens (Gemini 没有这个概念)
                  model,
                  accountId,
                  'gemini'
                )
                .catch((error) => {
                  logger.error('❌ Failed to record Gemini usage:', error)
                })
            }

            yield 'data: [DONE]\n\n'
            return
          }
        } catch (e) {
          logger.debug('Error parsing JSON line:', e.message, 'Line:', jsonData)
        }
      }
    }

    // Procesar剩余的 buffer
    if (buffer.trim()) {
      try {
        let jsonData = buffer.trim()
        if (jsonData.startsWith('data: ')) {
          jsonData = jsonData.substring(6).trim()
        }

        if (jsonData && jsonData !== '[DONE]') {
          const data = JSON.parse(jsonData)
          const openaiResponse = convertGeminiResponse(data, model, true)
          if (openaiResponse) {
            yield `data: ${JSON.stringify(openaiResponse)}\n\n`
          }
        }
      } catch (e) {
        logger.debug('Error parsing final buffer:', e.message)
      }
    }

    yield 'data: [DONE]\n\n'
  } catch (error) {
    // Verificar是否是Solicitud被中止
    if (error.name === 'CanceledError' || error.code === 'ECONNABORTED') {
      logger.info('Stream request was aborted by client')
    } else {
      logger.error('Stream processing error:', error)
      yield `data: ${JSON.stringify({
        error: {
          message: error.message,
          type: 'stream_error'
        }
      })}\n\n`
    }
  }
}

// 发送Solicitud到 Gemini
async function sendGeminiRequest({
  messages,
  model = DEFAULT_MODEL,
  temperature = 0.7,
  maxTokens = 4096,
  stream = false,
  accessToken,
  proxy,
  apiKeyId,
  signal,
  projectId,
  location = 'us-central1',
  accountId = null
}) {
  // 确保模型NombreFormato正确
  if (!model.startsWith('models/')) {
    model = `models/${model}`
  }

  // Convertir消息Formato
  const { contents, systemInstruction } = convertMessagesToGemini(messages)

  // ConstruirSolicitud体
  const requestBody = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      candidateCount: 1
    }
  }

  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  // ConfiguraciónSolicitud选项
  let apiUrl
  if (projectId) {
    // 使用项目特定的 URL Formato（Google Cloud/Workspace 账号）
    apiUrl = `${GEMINI_API_BASE}/projects/${projectId}/locations/${location}/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}?alt=sse`
    logger.debug(`Using project-specific URL with projectId: ${projectId}, location: ${location}`)
  } else {
    // 使用标准 URL Formato（个人 Google 账号）
    apiUrl = `${GEMINI_API_BASE}/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}?alt=sse`
    logger.debug('Using standard URL without projectId')
  }

  const axiosConfig = {
    method: 'POST',
    url: apiUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    data: requestBody,
    timeout: config.requestTimeout || 600000
  }

  // 添加ProxyConfiguración
  const proxyAgent = createProxyAgent(proxy)
  if (proxyAgent) {
    // 只Establecer httpsAgent，因为目标 URL 是 HTTPS (cloudcode.googleapis.com)
    axiosConfig.httpsAgent = proxyAgent
    axiosConfig.proxy = false
    logger.info(`🌐 Using proxy for Gemini API request: ${ProxyHelper.getProxyDescription(proxy)}`)
  } else {
    logger.debug('🌐 No proxy configured for Gemini API request')
  }

  // 添加 AbortController 信号Soportar
  if (signal) {
    axiosConfig.signal = signal
    logger.debug('AbortController signal attached to request')
  }

  if (stream) {
    axiosConfig.responseType = 'stream'
  }

  try {
    logger.debug('Sending request to Gemini API')
    const response = await axios(axiosConfig)

    if (stream) {
      return handleStreamResponse(response, model, apiKeyId, accountId)
    } else {
      // 非流式Respuesta
      const openaiResponse = convertGeminiResponse(response.data, model, false)

      // Registro使用量
      if (apiKeyId && openaiResponse.usage) {
        await apiKeyService
          .recordUsage(
            apiKeyId,
            openaiResponse.usage.prompt_tokens || 0,
            openaiResponse.usage.completion_tokens || 0,
            0, // cacheCreateTokens
            0, // cacheReadTokens
            model,
            accountId,
            'gemini'
          )
          .catch((error) => {
            logger.error('❌ Failed to record Gemini usage:', error)
          })
      }

      return openaiResponse
    }
  } catch (error) {
    // Verificar是否是Solicitud被中止
    if (error.name === 'CanceledError' || error.code === 'ECONNABORTED') {
      logger.info('Gemini request was aborted by client')
      const err = new Error('Request canceled by client')
      err.status = 499
      err.error = {
        message: 'Request canceled by client',
        type: 'canceled',
        code: 'request_canceled'
      }
      throw err
    }

    logger.error('Gemini API request failed:', error.response?.data || error.message)

    // ConvertirErrorFormato
    if (error.response) {
      const geminiError = error.response.data?.error
      const err = new Error(geminiError?.message || 'Gemini API request failed')
      err.status = error.response.status
      err.error = {
        message: geminiError?.message || 'Gemini API request failed',
        type: geminiError?.code || 'api_error',
        code: geminiError?.code
      }
      throw err
    }

    const err = new Error(error.message)
    err.status = 500
    err.error = {
      message: error.message,
      type: 'network_error'
    }
    throw err
  }
}

// Obtener可用模型ColumnaTabla
async function getAvailableModels(accessToken, proxy, projectId, location = 'us-central1') {
  let apiUrl
  if (projectId) {
    // 使用项目特定的 URL Formato
    apiUrl = `${GEMINI_API_BASE}/projects/${projectId}/locations/${location}/models`
    logger.debug(`Fetching models with projectId: ${projectId}, location: ${location}`)
  } else {
    // 使用标准 URL Formato
    apiUrl = `${GEMINI_API_BASE}/models`
    logger.debug('Fetching models without projectId')
  }

  const axiosConfig = {
    method: 'GET',
    url: apiUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    timeout: config.requestTimeout || 600000
  }

  const proxyAgent = createProxyAgent(proxy)
  if (proxyAgent) {
    // 只Establecer httpsAgent，因为目标 URL 是 HTTPS (cloudcode.googleapis.com)
    axiosConfig.httpsAgent = proxyAgent
    axiosConfig.proxy = false
    logger.info(
      `🌐 Using proxy for Gemini models request: ${ProxyHelper.getProxyDescription(proxy)}`
    )
  } else {
    logger.debug('🌐 No proxy configured for Gemini models request')
  }

  try {
    const response = await axios(axiosConfig)
    const models = response.data.models || []

    // Convertir为 OpenAI Formato
    return models
      .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model) => ({
        id: model.name.replace('models/', ''),
        object: 'model',
        created: Date.now() / 1000,
        owned_by: 'google'
      }))
  } catch (error) {
    logger.error('Failed to get Gemini models:', error)
    // RetornarPredeterminado模型ColumnaTabla
    return [
      {
        id: 'gemini-2.0-flash-exp',
        object: 'model',
        created: Date.now() / 1000,
        owned_by: 'google'
      }
    ]
  }
}

// Count Tokens API - 用于Gemini CLI兼容性
async function countTokens({
  model,
  content,
  accessToken,
  proxy,
  projectId,
  location = 'us-central1'
}) {
  // 确保模型NombreFormato正确
  if (!model.startsWith('models/')) {
    model = `models/${model}`
  }

  // Convertir内容Formato - Soportar多种输入Formato
  let requestBody
  if (Array.isArray(content)) {
    // 如果content是Arreglo，直接使用
    requestBody = { contents: content }
  } else if (typeof content === 'string') {
    // 如果是Cadena，Convertir为GeminiFormato
    requestBody = {
      contents: [
        {
          parts: [{ text: content }]
        }
      ]
    }
  } else if (content.parts || content.role) {
    // 如果已经是GeminiFormato的单个content
    requestBody = { contents: [content] }
  } else {
    // 其他情况，尝试直接使用
    requestBody = { contents: content }
  }

  // ConstruirAPI URL - countTokens需要使用generativelanguage API
  const GENERATIVE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
  let apiUrl
  if (projectId) {
    // 使用项目特定的 URL Formato（Google Cloud/Workspace 账号）
    apiUrl = `${GENERATIVE_API_BASE}/projects/${projectId}/locations/${location}/${model}:countTokens`
    logger.debug(
      `Using project-specific countTokens URL with projectId: ${projectId}, location: ${location}`
    )
  } else {
    // 使用标准 URL Formato（个人 Google 账号）
    apiUrl = `${GENERATIVE_API_BASE}/${model}:countTokens`
    logger.debug('Using standard countTokens URL without projectId')
  }

  const axiosConfig = {
    method: 'POST',
    url: apiUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': projectId || undefined
    },
    data: requestBody,
    timeout: config.requestTimeout || 600000
  }

  // 添加ProxyConfiguración
  const proxyAgent = createProxyAgent(proxy)
  if (proxyAgent) {
    // 只Establecer httpsAgent，因为目标 URL 是 HTTPS (cloudcode.googleapis.com)
    axiosConfig.httpsAgent = proxyAgent
    axiosConfig.proxy = false
    logger.info(
      `🌐 Using proxy for Gemini countTokens request: ${ProxyHelper.getProxyDescription(proxy)}`
    )
  } else {
    logger.debug('🌐 No proxy configured for Gemini countTokens request')
  }

  try {
    logger.debug(`Sending countTokens request to: ${apiUrl}`)
    logger.debug(`Request body: ${JSON.stringify(requestBody, null, 2)}`)
    const response = await axios(axiosConfig)

    // Retornar符合Gemini APIFormato的Respuesta
    return {
      totalTokens: response.data.totalTokens || 0,
      totalBillableCharacters: response.data.totalBillableCharacters || 0,
      ...response.data
    }
  } catch (error) {
    logger.error(`Gemini countTokens API request failed for URL: ${apiUrl}`)
    logger.error(
      'Request config:',
      JSON.stringify(
        {
          url: apiUrl,
          headers: axiosConfig.headers,
          data: requestBody
        },
        null,
        2
      )
    )
    logger.error('Error details:', error.response?.data || error.message)

    // ConvertirErrorFormato
    if (error.response) {
      const geminiError = error.response.data?.error
      const errorObj = new Error(
        geminiError?.message ||
          `Gemini countTokens API request failed (Status: ${error.response.status})`
      )
      errorObj.status = error.response.status
      errorObj.error = {
        message:
          geminiError?.message ||
          `Gemini countTokens API request failed (Status: ${error.response.status})`,
        type: geminiError?.code || 'api_error',
        code: geminiError?.code
      }
      throw errorObj
    }

    const errorObj = new Error(error.message)
    errorObj.status = 500
    errorObj.error = {
      message: error.message,
      type: 'network_error'
    }
    throw errorObj
  }
}

module.exports = {
  sendGeminiRequest,
  getAvailableModels,
  convertMessagesToGemini,
  convertGeminiResponse,
  countTokens
}
