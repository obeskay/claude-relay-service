/**
 * Error消息Limpiar工具 - 白名单Error码制
 * 所有Error映射到预定义的标准Error码，原始消息只记Registro不Retornar前端
 */

const logger = require('./logger')

// 标准Error码定义
const ERROR_CODES = {
  E001: { message: 'Service temporarily unavailable', status: 503 },
  E002: { message: 'Network connection failed', status: 502 },
  E003: { message: 'Authentication failed', status: 401 },
  E004: { message: 'Rate limit exceeded', status: 429 },
  E005: { message: 'Invalid request', status: 400 },
  E006: { message: 'Model not available', status: 503 },
  E007: { message: 'Upstream service error', status: 502 },
  E008: { message: 'Request timeout', status: 504 },
  E009: { message: 'Permission denied', status: 403 },
  E010: { message: 'Resource not found', status: 404 },
  E011: { message: 'Account temporarily unavailable', status: 503 },
  E012: { message: 'Server overloaded', status: 529 },
  E013: { message: 'Invalid API key', status: 401 },
  E014: { message: 'Quota exceeded', status: 429 },
  E015: { message: 'Internal server error', status: 500 }
}

// Error特征匹配Regla（按优先级Ordenar）
const ERROR_MATCHERS = [
  // 网络层Error
  { pattern: /ENOTFOUND|DNS|getaddrinfo/i, code: 'E002' },
  { pattern: /ECONNREFUSED|ECONNRESET|connection refused/i, code: 'E002' },
  { pattern: /ETIMEDOUT|timeout/i, code: 'E008' },
  { pattern: /ECONNABORTED|aborted/i, code: 'E002' },

  // 认证Error
  { pattern: /unauthorized|invalid.*token|token.*invalid|invalid.*key/i, code: 'E003' },
  { pattern: /invalid.*api.*key|api.*key.*invalid/i, code: 'E013' },
  { pattern: /authentication|auth.*fail/i, code: 'E003' },

  // PermisoError
  { pattern: /forbidden|permission.*denied|access.*denied/i, code: 'E009' },
  { pattern: /does not have.*permission/i, code: 'E009' },

  // 限流Error
  { pattern: /rate.*limit|too many requests|429/i, code: 'E004' },
  { pattern: /quota.*exceeded|usage.*limit/i, code: 'E014' },

  // 过载Error
  { pattern: /overloaded|529|capacity/i, code: 'E012' },

  // CuentaError
  { pattern: /account.*disabled|organization.*disabled/i, code: 'E011' },
  { pattern: /too many active sessions/i, code: 'E011' },

  // 模型Error
  { pattern: /model.*not.*found|model.*unavailable|unsupported.*model/i, code: 'E006' },

  // SolicitudError
  { pattern: /bad.*request|invalid.*request|malformed/i, code: 'E005' },
  { pattern: /not.*found|404/i, code: 'E010' },

  // 上游Error
  { pattern: /upstream|502|bad.*gateway/i, code: 'E007' },
  { pattern: /503|service.*unavailable/i, code: 'E001' }
]

/**
 * 根据原始Error匹配标准Error码
 * @param {Error|string|object} error - 原始Error
 * @param {object} options - 选项
 * @param {string} options.context - Error上下文（用于Registro）
 * @param {boolean} options.logOriginal - 是否Registro原始Error（Predeterminadotrue）
 * @returns {{ code: string, message: string, status: number }}
 */
function mapToErrorCode(error, options = {}) {
  const { context = 'unknown', logOriginal = true } = options

  // 提取原始ErrorInformación
  const originalMessage = extractOriginalMessage(error)
  const errorCode = error?.code || error?.response?.status
  const statusCode = error?.response?.status || error?.status || error?.statusCode

  // Registro原始Error到Registro（供Depurar）
  if (logOriginal && originalMessage) {
    logger.debug(`[ErrorSanitizer] Original error (${context}):`, {
      message: originalMessage,
      code: errorCode,
      status: statusCode
    })
  }

  // 匹配Error码
  let matchedCode = 'E015' // Predeterminado：内部Servicio器Error

  // 先按 HTTP 状态码快速匹配
  if (statusCode) {
    if (statusCode === 401) {
      matchedCode = 'E003'
    } else if (statusCode === 403) {
      matchedCode = 'E009'
    } else if (statusCode === 404) {
      matchedCode = 'E010'
    } else if (statusCode === 429) {
      matchedCode = 'E004'
    } else if (statusCode === 502) {
      matchedCode = 'E007'
    } else if (statusCode === 503) {
      matchedCode = 'E001'
    } else if (statusCode === 504) {
      matchedCode = 'E008'
    } else if (statusCode === 529) {
      matchedCode = 'E012'
    }
  }

  // 再按消息内容精确匹配（可能覆盖状态码匹配）
  if (originalMessage) {
    for (const matcher of ERROR_MATCHERS) {
      if (matcher.pattern.test(originalMessage)) {
        matchedCode = matcher.code
        break
      }
    }
  }

  // 按Error code 匹配（网络Error）
  if (errorCode) {
    const codeStr = String(errorCode).toUpperCase()
    if (codeStr === 'ENOTFOUND' || codeStr === 'EAI_AGAIN') {
      matchedCode = 'E002'
    } else if (codeStr === 'ECONNREFUSED' || codeStr === 'ECONNRESET') {
      matchedCode = 'E002'
    } else if (codeStr === 'ETIMEDOUT' || codeStr === 'ESOCKETTIMEDOUT') {
      matchedCode = 'E008'
    } else if (codeStr === 'ECONNABORTED') {
      matchedCode = 'E002'
    }
  }

  const result = ERROR_CODES[matchedCode]
  return {
    code: matchedCode,
    message: result.message,
    status: result.status
  }
}

/**
 * 提取原始Error消息
 */
function extractOriginalMessage(error) {
  if (!error) {
    return ''
  }
  if (typeof error === 'string') {
    return error
  }
  if (error.message) {
    return error.message
  }
  if (error.response?.data?.error?.message) {
    return error.response.data.error.message
  }
  if (error.response?.data?.error) {
    return String(error.response.data.error)
  }
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  return ''
}

/**
 * CrearSeguridad的ErrorRespuestaObjeto
 * @param {Error|string|object} error - 原始Error
 * @param {object} options - 选项
 * @returns {{ error: { code: string, message: string }, status: number }}
 */
function createSafeErrorResponse(error, options = {}) {
  const mapped = mapToErrorCode(error, options)
  return {
    error: {
      code: mapped.code,
      message: mapped.message
    },
    status: mapped.status
  }
}

/**
 * CrearSeguridad的 SSE ErrorEvento
 * @param {Error|string|object} error - 原始Error
 * @param {object} options - 选项
 * @returns {string} - SSE Formato的ErrorEvento
 */
function createSafeSSEError(error, options = {}) {
  const mapped = mapToErrorCode(error, options)
  return `event: error\ndata: ${JSON.stringify({
    error: mapped.message,
    code: mapped.code,
    timestamp: new Date().toISOString()
  })}\n\n`
}

/**
 * ObtenerSeguridad的Error消息（用于Reemplazo error.message）
 * @param {Error|string|object} error - 原始Error
 * @param {object} options - 选项
 * @returns {string}
 */
function getSafeMessage(error, options = {}) {
  return mapToErrorCode(error, options).message
}

// 兼容旧Interfaz
function sanitizeErrorMessage(message) {
  if (!message) {
    return 'Service temporarily unavailable'
  }
  return mapToErrorCode({ message }, { logOriginal: false }).message
}

function sanitizeUpstreamError(errorData) {
  return createSafeErrorResponse(errorData, { logOriginal: false })
}

function extractErrorMessage(body) {
  return extractOriginalMessage(body)
}

function isAccountDisabledError(statusCode, body) {
  if (statusCode !== 400) {
    return false
  }
  const message = extractOriginalMessage(body)
  if (!message) {
    return false
  }
  const lower = message.toLowerCase()
  return (
    lower.includes('organization has been disabled') ||
    lower.includes('account has been disabled') ||
    lower.includes('account is disabled') ||
    lower.includes('no account supporting') ||
    lower.includes('account not found') ||
    lower.includes('invalid account') ||
    lower.includes('too many active sessions')
  )
}

module.exports = {
  ERROR_CODES,
  mapToErrorCode,
  createSafeErrorResponse,
  createSafeSSEError,
  getSafeMessage,
  // 兼容旧Interfaz
  sanitizeErrorMessage,
  sanitizeUpstreamError,
  extractErrorMessage,
  isAccountDisabledError
}
