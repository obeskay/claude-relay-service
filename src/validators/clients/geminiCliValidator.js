const logger = require('../../utils/logger')
const { CLIENT_DEFINITIONS } = require('../clientDefinitions')

/**
 * Gemini CLI Validar器
 * ValidarSolicitud是否来自 Gemini CLI
 */
class GeminiCliValidator {
  /**
   * ObtenerClienteID
   */
  static getId() {
    return CLIENT_DEFINITIONS.GEMINI_CLI.id
  }

  /**
   * ObtenerClienteNombre
   */
  static getName() {
    return CLIENT_DEFINITIONS.GEMINI_CLI.name
  }

  /**
   * ObtenerCliente描述
   */
  static getDescription() {
    return CLIENT_DEFINITIONS.GEMINI_CLI.description
  }

  /**
   * ObtenerCliente图标
   */
  static getIcon() {
    return CLIENT_DEFINITIONS.GEMINI_CLI.icon || '💎'
  }

  /**
   * ValidarSolicitud是否来自 Gemini CLI
   * @param {Object} req - Express SolicitudObjeto
   * @returns {boolean} Validar结果
   */
  static validate(req) {
    try {
      const userAgent = req.headers['user-agent'] || ''
      const path = req.originalUrl || ''

      // 1. 必须是 /gemini 开头的Ruta
      if (!path.startsWith('/gemini')) {
        // 非 /gemini Ruta不属于 Gemini
        return false
      }

      // 2. 对于 /gemini Ruta，Verificar是否Incluir generateContent
      if (path.includes('generateContent')) {
        // Incluir generateContent 的Ruta需要Validar User-Agent
        const geminiCliPattern = /^GeminiCLI\/v?[\d.]+/i
        if (!geminiCliPattern.test(userAgent)) {
          logger.debug(
            `Gemini CLI validation failed - UA mismatch for generateContent: ${userAgent}`
          )
          return false
        }
      }

      // 所有必要Verificar通过
      logger.debug(`Gemini CLI validation passed for path: ${path}`)
      return true
    } catch (error) {
      logger.error('Error in GeminiCliValidator:', error)
      // Validar出错时Predeterminado拒绝
      return false
    }
  }

  /**
   * 比较Versión号
   * @returns {number} -1: v1 < v2, 0: v1 = v2, 1: v1 > v2
   */
  static compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0
      const part2 = parts2[i] || 0

      if (part1 < part2) {
        return -1
      }
      if (part1 > part2) {
        return 1
      }
    }

    return 0
  }

  /**
   * ObtenerValidar器Información
   */
  static getInfo() {
    return {
      id: this.getId(),
      name: this.getName(),
      description: this.getDescription(),
      icon: CLIENT_DEFINITIONS.GEMINI_CLI.icon
    }
  }
}

module.exports = GeminiCliValidator
