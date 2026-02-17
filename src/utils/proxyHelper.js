const { SocksProxyAgent } = require('socks-proxy-agent')
const { HttpsProxyAgent } = require('https-proxy-agent')
const logger = require('./logger')
const config = require('../../config/config')

/**
 * 统一的ProxyCrear工具
 * Soportar SOCKS5 和 HTTP/HTTPS Proxy，可Configuración IPv4/IPv6
 */
class ProxyHelper {
  // CachéProxy Agent，避免重复Crear浪费Conexión
  static _agentCache = new Map()

  /**
   * CrearProxy Agent
   * @param {object|string|null} proxyConfig - ProxyConfiguraciónObjeto或 JSON Cadena
   * @param {object} options - 额外选项
   * @param {boolean|number} options.useIPv4 - 是否使用 IPv4 (true=IPv4, false=IPv6, undefined=auto)
   * @returns {Agent|null} Proxy Agent Instancia或 null
   */
  static createProxyAgent(proxyConfig, options = {}) {
    if (!proxyConfig) {
      return null
    }

    try {
      // AnalizarProxyConfiguración
      const proxy = typeof proxyConfig === 'string' ? JSON.parse(proxyConfig) : proxyConfig

      // Validar必要Campo
      if (!proxy.type || !proxy.host || !proxy.port) {
        logger.warn('⚠️ Invalid proxy configuration: missing required fields (type, host, port)')
        return null
      }

      // Obtener IPv4/IPv6 Configuración
      const useIPv4 = ProxyHelper._getIPFamilyPreference(options.useIPv4)

      // ConfiguraciónConexión池与 Keep-Alive
      const proxySettings = config.proxy || {}
      const agentCommonOptions = {}

      if (typeof proxySettings.keepAlive === 'boolean') {
        agentCommonOptions.keepAlive = proxySettings.keepAlive
      }

      if (
        typeof proxySettings.maxSockets === 'number' &&
        Number.isFinite(proxySettings.maxSockets) &&
        proxySettings.maxSockets > 0
      ) {
        agentCommonOptions.maxSockets = proxySettings.maxSockets
      }

      if (
        typeof proxySettings.maxFreeSockets === 'number' &&
        Number.isFinite(proxySettings.maxFreeSockets) &&
        proxySettings.maxFreeSockets >= 0
      ) {
        agentCommonOptions.maxFreeSockets = proxySettings.maxFreeSockets
      }

      if (
        typeof proxySettings.timeout === 'number' &&
        Number.isFinite(proxySettings.timeout) &&
        proxySettings.timeout > 0
      ) {
        agentCommonOptions.timeout = proxySettings.timeout
      }

      // Caché键：保证相同Configuración的Proxy可复用
      const cacheKey = JSON.stringify({
        type: proxy.type,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
        family: useIPv4,
        keepAlive: agentCommonOptions.keepAlive,
        maxSockets: agentCommonOptions.maxSockets,
        maxFreeSockets: agentCommonOptions.maxFreeSockets,
        timeout: agentCommonOptions.timeout
      })

      if (ProxyHelper._agentCache.has(cacheKey)) {
        return ProxyHelper._agentCache.get(cacheKey)
      }

      // Construir认证Información
      const auth = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ''
      let agent = null

      // 根据ProxyTipoCrear Agent
      if (proxy.type === 'socks5') {
        const socksUrl = `socks5h://${auth}${proxy.host}:${proxy.port}`
        const socksOptions = { ...agentCommonOptions }

        // Establecer IP Protocolo族（如果指定）
        if (useIPv4 !== null) {
          socksOptions.family = useIPv4 ? 4 : 6
        }

        agent = new SocksProxyAgent(socksUrl, socksOptions)
      } else if (proxy.type === 'http' || proxy.type === 'https') {
        const proxyUrl = `${proxy.type}://${auth}${proxy.host}:${proxy.port}`
        const httpOptions = { ...agentCommonOptions }

        // HttpsProxyAgent Soportar family Parámetro（通过底层的 agent-base）
        if (useIPv4 !== null) {
          httpOptions.family = useIPv4 ? 4 : 6
        }

        agent = new HttpsProxyAgent(proxyUrl, httpOptions)
      } else {
        logger.warn(`⚠️ Unsupported proxy type: ${proxy.type}`)
        return null
      }

      if (agent) {
        ProxyHelper._agentCache.set(cacheKey, agent)
      }

      return agent
    } catch (error) {
      logger.warn('⚠️ Failed to create proxy agent:', error.message)
      return null
    }
  }

  /**
   * Obtener IP Protocolo族偏好Establecer
   * @param {boolean|number|string} preference - Usuario偏好Establecer
   * @returns {boolean|null} true=IPv4, false=IPv6, null=auto
   * @private
   */
  static _getIPFamilyPreference(preference) {
    // 如果没有指定偏好，使用ConfiguraciónArchivo或PredeterminadoValor
    if (preference === undefined) {
      // 从ConfiguraciónArchivoLeerPredeterminadoEstablecer，Predeterminado使用 IPv4
      const defaultUseIPv4 = config.proxy?.useIPv4
      if (defaultUseIPv4 !== undefined) {
        return defaultUseIPv4
      }
      // PredeterminadoValor：IPv4（兼容性更好）
      return true
    }

    // Procesar各种输入Formato
    if (typeof preference === 'boolean') {
      return preference
    }
    if (typeof preference === 'number') {
      return preference === 4 ? true : preference === 6 ? false : null
    }
    if (typeof preference === 'string') {
      const lower = preference.toLowerCase()
      if (lower === 'ipv4' || lower === '4') {
        return true
      }
      if (lower === 'ipv6' || lower === '6') {
        return false
      }
      if (lower === 'auto' || lower === 'both') {
        return null
      }
    }

    // 无法识别的Valor，RetornarPredeterminado（IPv4）
    return true
  }

  /**
   * ValidarProxyConfiguración
   * @param {object|string} proxyConfig - ProxyConfiguración
   * @returns {boolean} 是否有效
   */
  static validateProxyConfig(proxyConfig) {
    if (!proxyConfig) {
      return false
    }

    try {
      const proxy = typeof proxyConfig === 'string' ? JSON.parse(proxyConfig) : proxyConfig

      // Verificar必要Campo
      if (!proxy.type || !proxy.host || !proxy.port) {
        return false
      }

      // VerificarSoportar的Tipo
      if (!['socks5', 'http', 'https'].includes(proxy.type)) {
        return false
      }

      // Verificar端口范围
      const port = parseInt(proxy.port)
      if (isNaN(port) || port < 1 || port > 65535) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * ObtenerProxyConfiguración的描述Información
   * @param {object|string} proxyConfig - ProxyConfiguración
   * @returns {string} Proxy描述
   */
  static getProxyDescription(proxyConfig) {
    if (!proxyConfig) {
      return 'No proxy'
    }

    try {
      const proxy = typeof proxyConfig === 'string' ? JSON.parse(proxyConfig) : proxyConfig
      const hasAuth = proxy.username && proxy.password
      return `${proxy.type}://${proxy.host}:${proxy.port}${hasAuth ? ' (with auth)' : ''}`
    } catch (error) {
      return 'Invalid proxy config'
    }
  }

  /**
   * 脱敏ProxyConfiguraciónInformación用于RegistroRegistro
   * @param {object|string} proxyConfig - ProxyConfiguración
   * @returns {string} 脱敏后的ProxyInformación
   */
  static maskProxyInfo(proxyConfig) {
    if (!proxyConfig) {
      return 'No proxy'
    }

    try {
      const proxy = typeof proxyConfig === 'string' ? JSON.parse(proxyConfig) : proxyConfig

      let proxyDesc = `${proxy.type}://${proxy.host}:${proxy.port}`

      // 如果有认证Información，进Fila脱敏Procesar
      if (proxy.username && proxy.password) {
        const maskedUsername =
          proxy.username.length <= 2
            ? proxy.username
            : proxy.username[0] +
              '*'.repeat(Math.max(1, proxy.username.length - 2)) +
              proxy.username.slice(-1)
        const maskedPassword = '*'.repeat(Math.min(8, proxy.password.length))
        proxyDesc += ` (auth: ${maskedUsername}:${maskedPassword})`
      }

      return proxyDesc
    } catch (error) {
      return 'Invalid proxy config'
    }
  }

  /**
   * CrearProxy Agent（兼容旧的FunciónInterfaz）
   * @param {object|string|null} proxyConfig - ProxyConfiguración
   * @param {boolean} useIPv4 - 是否使用 IPv4
   * @returns {Agent|null} Proxy Agent Instancia或 null
   * @deprecated 使用 createProxyAgent 替代
   */
  static createProxy(proxyConfig, useIPv4 = true) {
    logger.warn('⚠️ ProxyHelper.createProxy is deprecated, use createProxyAgent instead')
    return ProxyHelper.createProxyAgent(proxyConfig, { useIPv4 })
  }
}

module.exports = ProxyHelper
