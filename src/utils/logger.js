const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const config = require('../../config/config')
const { formatDateWithTimezone } = require('../utils/dateHelper')
const path = require('path')
const fs = require('fs')
const os = require('os')

// Función segura de serialización JSON, maneja referencias circulares y caracteres especiales
const safeStringify = (obj, maxDepth = Infinity) => {
  const seen = new WeakSet()

  const replacer = (key, value, depth = 0) => {
    if (depth > maxDepth) {
      return '[Max Depth Reached]'
    }

    // Procesa valores de cadena, limpia caracteres especiales que podrían causar errores de análisis JSON
    if (typeof value === 'string') {
      try {
        // Elimina o escapa caracteres que podrían causar errores de análisis JSON
        const cleanValue = value
          // eslint-disable-next-line no-control-regex
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Elimina caracteres de control
          .replace(/[\uD800-\uDFFF]/g, '') // Elimina caracteres de pares sustitutos aislados
          // eslint-disable-next-line no-control-regex
          .replace(/\u0000/g, '') // Elimina bytes NUL

        return cleanValue
      } catch (error) {
        return '[Invalid String Data]'
      }
    }

    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular Reference]'
      }
      seen.add(value)

      // Filtra objetos comunes con referencias circulares
      if (value.constructor) {
        const constructorName = value.constructor.name
        if (
          ['Socket', 'TLSSocket', 'HTTPParser', 'IncomingMessage', 'ServerResponse'].includes(
            constructorName
          )
        ) {
          return `[${constructorName} Object]`
        }
      }

      // Procesa propiedades de objeto recursivamente
      if (Array.isArray(value)) {
        return value.map((item, index) => replacer(index, item, depth + 1))
      } else {
        const result = {}
        for (const [k, v] of Object.entries(value)) {
          // Asegura que los nombres de clave también sean seguros
          // eslint-disable-next-line no-control-regex
          const safeKey = typeof k === 'string' ? k.replace(/[\u0000-\u001F\u007F]/g, '') : k
          result[safeKey] = replacer(safeKey, v, depth + 1)
        }
        return result
      }
    }

    return value
  }

  try {
    const processed = replacer('', obj)
    const result = JSON.stringify(processed)
    // Protección de tamaño: trunca campos grandes cuando excede 50KB, conserva estructura de nivel superior
    if (result.length > 50000 && processed && typeof processed === 'object') {
      const truncated = { ...processed, _truncated: true, _totalChars: result.length }
      // Primera ronda: trunca campos grandes individuales
      for (const [k, v] of Object.entries(truncated)) {
        if (k.startsWith('_')) {
          continue
        }
        const fieldStr = typeof v === 'string' ? v : JSON.stringify(v)
        if (fieldStr && fieldStr.length > 10000) {
          truncated[k] = `${fieldStr.substring(0, 10000)}...[truncated]`
        }
      }
      // Segunda ronda: si longitud total aún excede 50KB, reduce cada campo a 2KB
      let secondResult = JSON.stringify(truncated)
      if (secondResult.length > 50000) {
        for (const [k, v] of Object.entries(truncated)) {
          if (k.startsWith('_')) {
            continue
          }
          const fieldStr = typeof v === 'string' ? v : JSON.stringify(v)
          if (fieldStr && fieldStr.length > 2000) {
            truncated[k] = `${fieldStr.substring(0, 2000)}...[truncated]`
          }
        }
        secondResult = JSON.stringify(truncated)
      }
      return secondResult
    }
    return result
  } catch (error) {
    // Si JSON.stringify aún falla, usa método más conservador
    try {
      return JSON.stringify({
        error: 'Failed to serialize object',
        message: error.message,
        type: typeof obj,
        keys: obj && typeof obj === 'object' ? Object.keys(obj) : undefined
      })
    } catch (finalError) {
      return '{"error":"Critical serialization failure","message":"Unable to serialize any data"}'
    }
  }
}

// Campos de metadata no mostrados en consola (ya en message o de bajo valor)
const CONSOLE_SKIP_KEYS = new Set(['type', 'level', 'message', 'timestamp', 'stack'])

// Formato de consola: muestra metadata en árbol
const createConsoleFormat = () =>
  winston.format.combine(
    winston.format.timestamp({ format: () => formatDateWithTimezone(new Date(), false) }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level: _level, message, timestamp, stack, ...rest }) => {
      // Timestamp solo toma hora:minuto:segundo
      const shortTime = timestamp ? timestamp.split(' ').pop() : ''

      let logMessage = `${shortTime} ${message}`

      // Recopila metadata a mostrar
      const entries = Object.entries(rest).filter(([k]) => !CONSOLE_SKIP_KEYS.has(k))

      if (entries.length > 0) {
        const indent = ' '.repeat(shortTime.length + 1)
        entries.forEach(([key, value], i) => {
          const isLast = i === entries.length - 1
          const branch = isLast ? '└─' : '├─'
          const displayValue =
            value !== null && typeof value === 'object' ? safeStringify(value) : String(value)
          logMessage += `\n${indent}${branch} ${key}: ${displayValue}`
        })
      }

      if (stack) {
        logMessage += `\n${stack}`
      }
      return logMessage
    })
  )

// Formato de archivo: NDJSON (datos estructurados completos)
const createFileFormat = () =>
  winston.format.combine(
    winston.format.timestamp({ format: () => formatDateWithTimezone(new Date(), false) }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...rest }) => {
      const entry = { ts: timestamp, lvl: level, msg: message }
      // Combina toda la metadata
      for (const [k, v] of Object.entries(rest)) {
        if (k !== 'level' && k !== 'message' && k !== 'timestamp' && k !== 'stack') {
          entry[k] = v
        }
      }
      if (stack) {
        entry.stack = stack
      }
      return safeStringify(entry)
    })
  )

const fileFormat = createFileFormat()
const consoleFormat = createConsoleFormat()
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID

// 📁 Asegura que el directorio de logs exista y establece permisos
if (!fs.existsSync(config.logging.dirname)) {
  fs.mkdirSync(config.logging.dirname, { recursive: true, mode: 0o755 })
}

// 🔄 Configuración mejorada de rotación de logs
const createRotateTransport = (filename, level = null) => {
  const transport = new DailyRotateFile({
    filename: path.join(config.logging.dirname, filename),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles,
    auditFile: path.join(config.logging.dirname, `.${filename.replace('%DATE%', 'audit')}.json`),
    format: fileFormat
  })

  if (level) {
    transport.level = level
  }

  // Escucha eventos de rotación (deshabilitado en entorno de prueba para evitar salida después de salir de Jest)
  if (!isTestEnv) {
    transport.on('rotate', (oldFilename, newFilename) => {
      console.log(`📦 Log rotated: ${oldFilename} -> ${newFilename}`)
    })

    transport.on('new', (newFilename) => {
      console.log(`📄 New log file created: ${newFilename}`)
    })

    transport.on('archive', (zipFilename) => {
      console.log(`🗜️ Log archived: ${zipFilename}`)
    })
  }

  return transport
}

const dailyRotateFileTransport = createRotateTransport('claude-relay-%DATE%.log')
const errorFileTransport = createRotateTransport('claude-relay-error-%DATE%.log', 'error')

// 🔒 Crea logger de seguridad dedicado
const securityLogger = winston.createLogger({
  level: 'warn',
  format: fileFormat,
  transports: [createRotateTransport('claude-relay-security-%DATE%.log', 'warn')],
  silent: false
})

// 🔐 Crea logger detallado de autenticación dedicado (registra respuestas de autenticación completas)
const authDetailLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: () => formatDateWithTimezone(new Date(), false) }),
    winston.format.printf(({ level, message, timestamp, data }) => {
      // Usa mayor profundidad y salida JSON formateada
      const jsonData = data ? JSON.stringify(data, null, 2) : '{}'
      return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${jsonData}\n${'='.repeat(80)}`
    })
  ),
  transports: [createRotateTransport('claude-relay-auth-detail-%DATE%.log', 'info')],
  silent: false
})

// 🌟 Logger Winston mejorado
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || config.logging.level,
  format: fileFormat,
  transports: [
    // 📄 Salida de archivo
    dailyRotateFileTransport,
    errorFileTransport,

    // 🖥️ Salida de consola
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: false,
      handleRejections: false
    })
  ],

  // 🚨 Manejo de excepciones
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(config.logging.dirname, 'exceptions.log'),
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: consoleFormat
    })
  ],

  // 🔄 未捕获Manejo de excepciones
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(config.logging.dirname, 'rejections.log'),
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: consoleFormat
    })
  ],

  // Previene salida de proceso
  exitOnError: false
})

// 🎯 Métodos personalizados mejorados
logger.success = (message, metadata = {}) => {
  logger.info(`✅ ${message}`, { type: 'success', ...metadata })
}

logger.start = (message, metadata = {}) => {
  logger.info(`🚀 ${message}`, { type: 'startup', ...metadata })
}

logger.request = (method, url, status, duration, metadata = {}) => {
  const emoji = status >= 400 ? '🔴' : status >= 300 ? '🟡' : '🟢'
  const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info'

  logger[level](`${emoji} ${method} ${url} - ${status} (${duration}ms)`, {
    type: 'request',
    method,
    url,
    status,
    duration,
    ...metadata
  })
}

logger.api = (message, metadata = {}) => {
  logger.info(`🔗 ${message}`, { type: 'api', ...metadata })
}

logger.security = (message, metadata = {}) => {
  const securityData = {
    type: 'security',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    hostname: os.hostname(),
    ...metadata
  }

  // Registro到主Registro
  logger.warn(`🔒 ${message}`, securityData)

  // Registro到专门的SeguridadRegistroArchivo
  try {
    securityLogger.warn(`🔒 ${message}`, securityData)
  } catch (error) {
    // 如果SeguridadRegistroArchivo不可用，只Registro到主Registro
    console.warn('Security logger not available:', error.message)
  }
}

logger.database = (message, metadata = {}) => {
  logger.debug(`💾 ${message}`, { type: 'database', ...metadata })
}

logger.performance = (message, metadata = {}) => {
  logger.info(`⚡ ${message}`, { type: 'performance', ...metadata })
}

logger.audit = (message, metadata = {}) => {
  logger.info(`📋 ${message}`, {
    type: 'audit',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    ...metadata
  })
}

// 🔧 Métodos de monitoreo de rendimiento
logger.timer = (label) => {
  const start = Date.now()
  return {
    end: (message = '', metadata = {}) => {
      const duration = Date.now() - start
      logger.performance(`${label} ${message}`, { duration, ...metadata })
      return duration
    }
  }
}

// 📊 Estadísticas de logs
logger.stats = {
  requests: 0,
  errors: 0,
  warnings: 0
}

// Sobrescribe métodos originales para estadísticas
const originalError = logger.error
const originalWarn = logger.warn
const originalInfo = logger.info

logger.error = function (message, ...args) {
  logger.stats.errors++
  return originalError.call(this, message, ...args)
}

logger.warn = function (message, ...args) {
  logger.stats.warnings++
  return originalWarn.call(this, message, ...args)
}

logger.info = function (message, ...args) {
  // Verifica si es un log de tipo solicitud
  if (args.length > 0 && typeof args[0] === 'object' && args[0].type === 'request') {
    logger.stats.requests++
  }
  return originalInfo.call(this, message, ...args)
}

// 📈 ObtenerEstadísticas de logs
logger.getStats = () => ({ ...logger.stats })

// 🧹 Limpia estadísticas
logger.resetStats = () => {
  logger.stats.requests = 0
  logger.stats.errors = 0
  logger.stats.warnings = 0
}

// 📡 Verificación de salud
logger.healthCheck = () => {
  try {
    const testMessage = 'Logger health check'
    logger.debug(testMessage)
    return { healthy: true, timestamp: new Date().toISOString() }
  } catch (error) {
    return { healthy: false, error: error.message, timestamp: new Date().toISOString() }
  }
}

// 🔐 Método para registrar detalles de autenticación
logger.authDetail = (message, data = {}) => {
  try {
    // Registra en log principal (versión simplificada)
    logger.info(`🔐 ${message}`, {
      type: 'auth-detail',
      summary: {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        scopes: data.scope || data.scopes,
        organization: data.organization?.name,
        account: data.account?.email_address
      }
    })

    // Registra en archivo de log detallado de autenticación dedicado (datos completos)
    authDetailLogger.info(message, { data })
  } catch (error) {
    logger.error('Failed to log auth detail:', error)
  }
}

// 🎬 Inicia sistema de registro de logs
logger.start('Logger initialized', {
  level: process.env.LOG_LEVEL || config.logging.level,
  directory: config.logging.dirname,
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  envOverride: process.env.LOG_LEVEL ? true : false
})

module.exports = logger
