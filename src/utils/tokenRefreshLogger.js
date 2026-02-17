const winston = require('winston')
const path = require('path')
const fs = require('fs')
const { maskToken } = require('./tokenMask')

// 确保RegistroDirectorio存在
const logDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

// Crear专用的 token 刷新RegistroRegistro器
const tokenRefreshLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.json(),
    winston.format.printf((info) => JSON.stringify(info, null, 2))
  ),
  transports: [
    // Archivo传输 - 每日轮转
    new winston.transports.File({
      filename: path.join(logDir, 'token-refresh.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 30, // 保留30天
      tailable: true
    }),
    // Error单独Registro
    new winston.transports.File({
      filename: path.join(logDir, 'token-refresh-error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30
    })
  ],
  // ErrorProcesar
  exitOnError: false
})

// 在开发环境添加Salida de consola
if (process.env.NODE_ENV !== 'production') {
  tokenRefreshLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    })
  )
}

/**
 * Registro token 刷新Iniciando
 */
function logRefreshStart(accountId, accountName, platform = 'claude', reason = '') {
  tokenRefreshLogger.info({
    event: 'token_refresh_start',
    accountId,
    accountName,
    platform,
    reason,
    timestamp: new Date().toISOString()
  })
}

/**
 * Registro token 刷新Éxito
 */
function logRefreshSuccess(accountId, accountName, platform = 'claude', tokenData = {}) {
  const maskedTokenData = {
    accessToken: tokenData.accessToken ? maskToken(tokenData.accessToken) : '[NOT_PROVIDED]',
    refreshToken: tokenData.refreshToken ? maskToken(tokenData.refreshToken) : '[NOT_PROVIDED]',
    expiresAt: tokenData.expiresAt || tokenData.expiry_date || '[NOT_PROVIDED]',
    scopes: tokenData.scopes || tokenData.scope || '[NOT_PROVIDED]'
  }

  tokenRefreshLogger.info({
    event: 'token_refresh_success',
    accountId,
    accountName,
    platform,
    tokenData: maskedTokenData,
    timestamp: new Date().toISOString()
  })
}

/**
 * Registro token 刷新Falló
 */
function logRefreshError(accountId, accountName, platform = 'claude', error, attemptNumber = 1) {
  const errorInfo = {
    message: error.message || error.toString(),
    code: error.code || 'UNKNOWN',
    statusCode: error.response?.status || 'N/A',
    responseData: error.response?.data || 'N/A'
  }

  tokenRefreshLogger.error({
    event: 'token_refresh_error',
    accountId,
    accountName,
    platform,
    error: errorInfo,
    attemptNumber,
    timestamp: new Date().toISOString()
  })
}

/**
 * Registro token 刷新跳过（由于Concurrencia锁）
 */
function logRefreshSkipped(accountId, accountName, platform = 'claude', reason = 'locked') {
  tokenRefreshLogger.info({
    event: 'token_refresh_skipped',
    accountId,
    accountName,
    platform,
    reason,
    timestamp: new Date().toISOString()
  })
}

/**
 * Registro token 使用情况
 */
function logTokenUsage(accountId, accountName, platform = 'claude', expiresAt, isExpired) {
  tokenRefreshLogger.debug({
    event: 'token_usage_check',
    accountId,
    accountName,
    platform,
    expiresAt,
    isExpired,
    remainingMinutes: expiresAt ? Math.floor((new Date(expiresAt) - Date.now()) / 60000) : 'N/A',
    timestamp: new Date().toISOString()
  })
}

/**
 * Registro批量刷新任务
 */
function logBatchRefreshStart(totalAccounts, platform = 'all') {
  tokenRefreshLogger.info({
    event: 'batch_refresh_start',
    totalAccounts,
    platform,
    timestamp: new Date().toISOString()
  })
}

/**
 * Registro批量刷新结果
 */
function logBatchRefreshComplete(results) {
  tokenRefreshLogger.info({
    event: 'batch_refresh_complete',
    results: {
      total: results.total || 0,
      success: results.success || 0,
      failed: results.failed || 0,
      skipped: results.skipped || 0
    },
    timestamp: new Date().toISOString()
  })
}

module.exports = {
  logger: tokenRefreshLogger,
  logRefreshStart,
  logRefreshSuccess,
  logRefreshError,
  logRefreshSkipped,
  logTokenUsage,
  logBatchRefreshStart,
  logBatchRefreshComplete
}
