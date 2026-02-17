/**
 * ClienteValidar器
 * 用于ValidarSolicitud是否来自特定的Cliente
 */

const logger = require('../utils/logger')
const {
  CLIENT_IDS,
  getAllClientDefinitions,
  getClientDefinitionById,
  isPathAllowedForClient
} = require('./clientDefinitions')
const ClaudeCodeValidator = require('./clients/claudeCodeValidator')
const GeminiCliValidator = require('./clients/geminiCliValidator')
const CodexCliValidator = require('./clients/codexCliValidator')
const DroidCliValidator = require('./clients/droidCliValidator')

// ClienteID到Validar器的映射Tabla
const VALIDATOR_MAP = {
  [CLIENT_IDS.CLAUDE_CODE]: ClaudeCodeValidator,
  [CLIENT_IDS.GEMINI_CLI]: GeminiCliValidator,
  [CLIENT_IDS.CODEX_CLI]: CodexCliValidator,
  [CLIENT_IDS.DROID_CLI]: DroidCliValidator
}

/**
 * ClienteValidar器Clase
 */
class ClientValidator {
  /**
   * ObtenerClienteValidar器
   * @param {string} clientId - ClienteID
   * @returns {Object|null} Validar器Instancia
   */
  static getValidator(clientId) {
    const validator = VALIDATOR_MAP[clientId]
    if (!validator) {
      logger.warn(`Unknown client ID: ${clientId}`)
      return null
    }
    return validator
  }

  /**
   * Obtener所有Soportar的ClienteIDColumnaTabla
   * @returns {Array<string>} ClienteIDColumnaTabla
   */
  static getSupportedClients() {
    return Object.keys(VALIDATOR_MAP)
  }

  /**
   * Validar单个Cliente
   * @param {string} clientId - ClienteID
   * @param {Object} req - ExpressSolicitudObjeto
   * @returns {boolean} Validar结果
   */
  static validateClient(clientId, req) {
    const validator = this.getValidator(clientId)

    if (!validator) {
      logger.warn(`No validator found for client: ${clientId}`)
      return false
    }

    try {
      return validator.validate(req)
    } catch (error) {
      logger.error(`Error validating client ${clientId}:`, error)
      return false
    }
  }

  /**
   * ValidarSolicitud是否来自允许的ClienteColumnaTabla中的任一Cliente
   * IncluirRuta白名单Verificar，防止通过其他兼容Endpoint绕过ClienteLímite
   * @param {Array<string>} allowedClients - 允许的ClienteIDColumnaTabla
   * @param {Object} req - ExpressSolicitudObjeto
   * @returns {Object} Validar结果Objeto
   */
  static validateRequest(allowedClients, req) {
    const userAgent = req.headers['user-agent'] || ''
    const clientIP = req.ip || req.connection?.remoteAddress || 'unknown'
    const requestPath = req.originalUrl || req.path || ''

    // RegistroValidarIniciando
    logger.api(`🔍 Starting client validation for User-Agent: "${userAgent}"`)
    logger.api(`   Allowed clients: ${allowedClients.join(', ')}`)
    logger.api(`   Request path: ${requestPath}`)
    logger.api(`   Request from IP: ${clientIP}`)

    // 遍历所有允许的Cliente进FilaValidar
    for (const clientId of allowedClients) {
      const validator = this.getValidator(clientId)

      if (!validator) {
        logger.warn(`Skipping unknown client ID: ${clientId}`)
        continue
      }

      // Ruta白名单Verificar：先VerificarRuta是否允许该Cliente访问
      if (!isPathAllowedForClient(clientId, requestPath)) {
        logger.debug(`Path "${requestPath}" not allowed for ${validator.getName()}, skipping`)
        continue
      }

      logger.debug(`Checking against ${validator.getName()}...`)

      try {
        if (validator.validate(req)) {
          // ValidarÉxito
          logger.api(`✅ Client validated: ${validator.getName()} (${clientId})`)
          logger.api(`   Matched User-Agent: "${userAgent}"`)
          logger.api(`   Allowed path: "${requestPath}"`)

          return {
            allowed: true,
            matchedClient: clientId,
            clientName: validator.getName(),
            clientInfo: getClientDefinitionById(clientId)
          }
        }
      } catch (error) {
        logger.error(`Error during validation for ${clientId}:`, error)
        continue
      }
    }

    // 没有匹配的Cliente
    logger.api(
      `❌ No matching client found for User-Agent: "${userAgent}" and path: "${requestPath}"`
    )
    return {
      allowed: false,
      matchedClient: null,
      reason: 'No matching client found or path not allowed',
      userAgent,
      requestPath
    }
  }

  /**
   * ObtenerClienteInformación
   * @param {string} clientId - ClienteID
   * @returns {Object} ClienteInformación
   */
  static getClientInfo(clientId) {
    const validator = this.getValidator(clientId)
    if (!validator) {
      return null
    }

    return validator.getInfo()
  }

  /**
   * Obtener所有可用的ClienteInformación
   * @returns {Array<Object>} ClienteInformaciónArreglo
   */
  static getAvailableClients() {
    // 直接从 CLIENT_DEFINITIONS Retornar所有ClienteInformación
    return getAllClientDefinitions()
  }
}

module.exports = ClientValidator
