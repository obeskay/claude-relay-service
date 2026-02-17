const crypto = require('crypto')
const { mapToErrorCode } = require('./errorSanitizer')

// 将原始ErrorInformación映射为Seguridad的标准Error码消息
const sanitizeErrorMsg = (msg) => {
  const mapped = mapToErrorCode({ message: msg }, { logOriginal: false })
  return `[${mapped.code}] ${mapped.message}`
}

/**
 * Generar随机十六进制Cadena
 * @param {number} bytes - 字节数
 * @returns {string} 十六进制Cadena
 */
function randomHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * Generar Claude Code 风格的SesiónCadena
 * @returns {string} SesiónCadena，Formato: user_{64位hex}_account__session_{uuid}
 */
function generateSessionString() {
  const hex64 = randomHex(32) // 32 bytes => 64 hex characters
  const uuid = crypto.randomUUID()
  return `user_${hex64}_account__session_${uuid}`
}

/**
 * Generar Claude ProbarSolicitud体
 * @param {string} model - 模型Nombre
 * @param {object} options - OpcionalConfiguración
 * @param {boolean} options.stream - 是否流式（Predeterminadofalse）
 * @param {string} options.prompt - 自定义提示词（Predeterminado 'hi'）
 * @param {number} options.maxTokens - 最大输出 token（Predeterminado 1000）
 * @returns {object} ProbarSolicitud体
 */
function createClaudeTestPayload(model = 'claude-sonnet-4-5-20250929', options = {}) {
  const { stream, prompt = 'hi', maxTokens = 1000 } = options
  const payload = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
            cache_control: {
              type: 'ephemeral'
            }
          }
        ]
      }
    ],
    system: [
      {
        type: 'text',
        text: "You are Claude Code, Anthropic's official CLI for Claude.",
        cache_control: {
          type: 'ephemeral'
        }
      }
    ],
    metadata: {
      user_id: generateSessionString()
    },
    max_tokens: maxTokens,
    temperature: 1
  }

  if (stream) {
    payload.stream = true
  }

  return payload
}

/**
 * 发送流式ProbarSolicitud并ProcesarSSERespuesta
 * @param {object} options - Configuración选项
 * @param {string} options.apiUrl - API URL
 * @param {string} options.authorization - Authorization headerValor
 * @param {object} options.responseStream - ExpressRespuesta流
 * @param {object} [options.payload] - Solicitud体（Predeterminado使用createClaudeTestPayload）
 * @param {object} [options.proxyAgent] - Proxyagent
 * @param {number} [options.timeout] - Tiempo de espera agotadoTiempo（Predeterminado30000）
 * @param {object} [options.extraHeaders] - 额外的Solicitud头
 * @returns {Promise<void>}
 */
async function sendStreamTestRequest(options) {
  const axios = require('axios')
  const logger = require('./logger')

  const {
    apiUrl,
    authorization,
    responseStream,
    payload = createClaudeTestPayload('claude-sonnet-4-5-20250929', { stream: true }),
    proxyAgent = null,
    timeout = 30000,
    extraHeaders = {},
    sanitize = false
  } = options

  const sendSSE = (type, data = {}) => {
    if (!responseStream.destroyed && !responseStream.writableEnded) {
      try {
        responseStream.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
      } catch {
        // ignore
      }
    }
  }

  const endTest = (success, error = null) => {
    if (!responseStream.destroyed && !responseStream.writableEnded) {
      try {
        responseStream.write(
          `data: ${JSON.stringify({ type: 'test_complete', success, error: error || undefined })}\n\n`
        )
        responseStream.end()
      } catch {
        // ignore
      }
    }
  }

  // EstablecerRespuesta头
  if (!responseStream.headersSent) {
    responseStream.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    })
  }

  sendSSE('test_start', { message: 'Test started' })

  const requestConfig = {
    method: 'POST',
    url: apiUrl,
    data: payload,
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'User-Agent': 'claude-cli/2.0.52 (external, cli)',
      authorization,
      ...extraHeaders
    },
    timeout,
    responseType: 'stream',
    validateStatus: () => true
  }

  if (proxyAgent) {
    requestConfig.httpAgent = proxyAgent
    requestConfig.httpsAgent = proxyAgent
    requestConfig.proxy = false
  }

  try {
    const response = await axios(requestConfig)
    logger.debug(`🌊 Test response status: ${response.status}`)

    // Procesar非200Respuesta
    if (response.status !== 200) {
      return new Promise((resolve) => {
        const chunks = []
        response.data.on('data', (chunk) => chunks.push(chunk))
        response.data.on('end', () => {
          const errorData = Buffer.concat(chunks).toString()
          let errorMsg = `API Error: ${response.status}`
          try {
            const json = JSON.parse(errorData)
            errorMsg = extractErrorMessage(json, errorMsg)
          } catch {
            if (errorData.length < 200) {
              errorMsg = errorData || errorMsg
            }
          }
          endTest(false, sanitize ? sanitizeErrorMsg(errorMsg) : errorMsg)
          resolve()
        })
        response.data.on('error', (err) => {
          endTest(false, sanitize ? sanitizeErrorMsg(err.message) : err.message)
          resolve()
        })
      })
    }

    // ProcesarÉxito的流式Respuesta
    return new Promise((resolve) => {
      let buffer = ''

      response.data.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data:')) {
            continue
          }
          const jsonStr = line.substring(5).trim()
          if (!jsonStr || jsonStr === '[DONE]') {
            continue
          }

          try {
            const data = JSON.parse(jsonStr)

            if (data.type === 'content_block_delta' && data.delta?.text) {
              sendSSE('content', { text: data.delta.text })
            }
            if (data.type === 'message_stop') {
              sendSSE('message_stop')
            }
            if (data.type === 'error' || data.error) {
              const errMsg = data.error?.message || data.message || data.error || 'Unknown error'
              sendSSE('error', { error: errMsg })
            }
          } catch {
            // ignore parse errors
          }
        }
      })

      response.data.on('end', () => {
        if (!responseStream.destroyed && !responseStream.writableEnded) {
          endTest(true)
        }
        resolve()
      })

      response.data.on('error', (err) => {
        endTest(false, err.message)
        resolve()
      })
    })
  } catch (error) {
    logger.error('❌ Stream test request failed:', error.message)
    endTest(false, error.message)
  }
}

/**
 * Generar Gemini ProbarSolicitud体
 * @param {string} model - 模型Nombre
 * @param {object} options - OpcionalConfiguración
 * @param {string} options.prompt - 自定义提示词（Predeterminado 'hi'）
 * @param {number} options.maxTokens - 最大输出 token（Predeterminado 100）
 * @returns {object} ProbarSolicitud体
 */
function createGeminiTestPayload(_model = 'gemini-2.5-pro', options = {}) {
  const { prompt = 'hi', maxTokens = 100 } = options
  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 1
    }
  }
}

/**
 * Generar OpenAI Responses ProbarSolicitud体
 * @param {string} model - 模型Nombre
 * @param {object} options - OpcionalConfiguración
 * @param {string} options.prompt - 自定义提示词（Predeterminado 'hi'）
 * @param {number} options.maxTokens - 最大输出 token（Predeterminado 100）
 * @returns {object} ProbarSolicitud体
 */
function createOpenAITestPayload(model = 'gpt-5', options = {}) {
  const { prompt = 'hi', maxTokens = 100, stream = true } = options
  return {
    model,
    input: [
      {
        role: 'user',
        content: prompt
      }
    ],
    max_output_tokens: maxTokens,
    stream
  }
}

/**
 * Generar Chat Completions ProbarSolicitud体（用于 Azure OpenAI 等 Chat Completions Endpoint）
 * @param {string} model - 模型Nombre
 * @param {object} options - OpcionalConfiguración
 * @param {string} options.prompt - 自定义提示词（Predeterminado 'hi'）
 * @param {number} options.maxTokens - 最大输出 token（Predeterminado 100）
 * @returns {object} ProbarSolicitud体
 */
function createChatCompletionsTestPayload(model = 'gpt-4o-mini', options = {}) {
  const { prompt = 'hi', maxTokens = 100 } = options
  return {
    model,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: maxTokens
  }
}

/**
 * 从各种Formato的ErrorRespuesta中提取可读ErrorInformación
 * SoportarFormato: {message}, {error:{message}}, {msg:{error:{message}}}, {error:"string"} 等
 * @param {object} json - Analizar后的 JSON ErrorRespuesta
 * @param {string} fallback - 提取Falló时的RetiradaInformación
 * @returns {string} ErrorInformación
 */
function extractErrorMessage(json, fallback) {
  if (!json || typeof json !== 'object') {
    return fallback
  }
  // 直接 message
  if (json.message && typeof json.message === 'string') {
    return json.message
  }
  // {error: {message: "..."}}
  if (json.error?.message) {
    return json.error.message
  }
  // {msg: {error: {message: "..."}}} (relay 包装Formato)
  if (json.msg?.error?.message) {
    return json.msg.error.message
  }
  if (json.msg?.message) {
    return json.msg.message
  }
  // {error: "string"}
  if (typeof json.error === 'string') {
    return json.error
  }
  // {msg: "string"}
  if (typeof json.msg === 'string') {
    return json.msg
  }
  return fallback
}

module.exports = {
  randomHex,
  generateSessionString,
  createClaudeTestPayload,
  createGeminiTestPayload,
  createOpenAITestPayload,
  createChatCompletionsTestPayload,
  extractErrorMessage,
  sanitizeErrorMsg,
  sendStreamTestRequest
}
