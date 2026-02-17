const logger = require('../../utils/logger')
const { CLIENT_DEFINITIONS } = require('../clientDefinitions')

/**
 * Codex CLI Validar器
 * ValidarSolicitud是否来自 Codex CLI
 */
class CodexCliValidator {
  /**
   * ObtenerClienteID
   */
  static getId() {
    return CLIENT_DEFINITIONS.CODEX_CLI.id
  }

  /**
   * ObtenerClienteNombre
   */
  static getName() {
    return CLIENT_DEFINITIONS.CODEX_CLI.name
  }

  /**
   * ObtenerCliente描述
   */
  static getDescription() {
    return CLIENT_DEFINITIONS.CODEX_CLI.description
  }

  /**
   * ValidarSolicitud是否来自 Codex CLI
   * @param {Object} req - Express SolicitudObjeto
   * @returns {boolean} Validar结果
   */
  static validate(req) {
    try {
      const userAgent = req.headers['user-agent'] || ''
      const originator = req.headers['originator'] || ''
      const sessionId = req.headers['session_id']

      // 1. 基础 User-Agent Verificar
      // Codex CLI 的 UA Formato:
      // - codex_vscode/0.35.0 (Windows 10.0.26100; x86_64) unknown (Cursor; 0.4.10)
      // - codex_cli_rs/0.38.0 (Ubuntu 22.4.0; x86_64) WindowsTerminal
      // - codex_exec/0.89.0 (Mac OS 26.2.0; arm64) xterm-256color (非交互式/脚本模式)
      const codexCliPattern = /^(codex_vscode|codex_cli_rs|codex_exec)\/[\d.]+/i
      const uaMatch = userAgent.match(codexCliPattern)

      if (!uaMatch) {
        logger.debug(`Codex CLI validation failed - UA mismatch: ${userAgent}`)
        return false
      }

      // 2. 对于特定Ruta，进Fila额外的严格Validar
      // 对于 /openai 和 /azure Ruta需要完整Validar
      const strictValidationPaths = ['/openai', '/azure']
      const needsStrictValidation =
        req.path && strictValidationPaths.some((path) => req.path.startsWith(path))

      if (!needsStrictValidation) {
        // 其他Ruta，只要 User-Agent 匹配就认为是 Codex CLI
        logger.debug(`Codex CLI detected for path: ${req.path}, allowing access`)
        return true
      }

      // 3. Validar originator 头必须与 UA 中的ClienteTipo匹配
      const clientType = uaMatch[1].toLowerCase()
      if (originator.toLowerCase() !== clientType) {
        logger.debug(
          `Codex CLI validation failed - originator mismatch. UA: ${clientType}, originator: ${originator}`
        )
        return false
      }

      // 4. Verificar session_id - 必须存在且长度大于20
      if (!sessionId || sessionId.length <= 20) {
        logger.debug(`Codex CLI validation failed - session_id missing or too short: ${sessionId}`)
        return false
      }

      // 5. 对于 /openai/responses 和 /azure/response Ruta，额外Verificar body 中的 instructions Campo
      if (
        req.path &&
        (req.path.includes('/openai/responses') || req.path.includes('/azure/response'))
      ) {
        if (!req.body || !req.body.instructions) {
          logger.debug(`Codex CLI validation failed - missing instructions in body for ${req.path}`)
          return false
        }

        const expectedPrefix =
          'You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI'
        if (!req.body.instructions.startsWith(expectedPrefix)) {
          logger.debug(`Codex CLI validation failed - invalid instructions prefix for ${req.path}`)
          logger.debug(`Expected: "${expectedPrefix}..."`)
          logger.debug(`Received: "${req.body.instructions.substring(0, 100)}..."`)
          return false
        }

        // 额外Verificar model Campo应该是 gpt-5-codex
        if (req.body.model && req.body.model !== 'gpt-5-codex') {
          logger.debug(`Codex CLI validation warning - unexpected model: ${req.body.model}`)
          // 只RegistroAdvertencia，不拒绝Solicitud
        }
      }

      // 所有必要Verificar通过
      logger.debug(`Codex CLI validation passed for UA: ${userAgent}`)
      return true
    } catch (error) {
      logger.error('Error in CodexCliValidator:', error)
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
      icon: CLIENT_DEFINITIONS.CODEX_CLI.icon
    }
  }
}

module.exports = CodexCliValidator
