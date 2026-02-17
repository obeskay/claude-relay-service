/**
 * 输入Validar工具Clase
 * 提供各种输入Validar和Limpiar功能，防止注入攻击
 */
class InputValidator {
  /**
   * ValidarUsuario名
   * @param {string} username - Usuario名
   * @returns {string} Validar后的Usuario名
   * @throws {Error} 如果Usuario名无效
   */
  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      throw new Error('Usuario名必须是非空Cadena')
    }

    const trimmed = username.trim()

    // 长度Verificar
    if (trimmed.length < 3 || trimmed.length > 64) {
      throw new Error('Usuario名长度必须在3-64个字符之间')
    }

    // FormatoVerificar：只允许字母、Número、下划线、连字符
    const usernameRegex = /^[a-zA-Z0-9_-]+$/
    if (!usernameRegex.test(trimmed)) {
      throw new Error('Usuario名只能Incluir字母、Número、下划线和连字符')
    }

    // 不能以连字符开头或结尾
    if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
      throw new Error('Usuario名不能以连字符开头或结尾')
    }

    return trimmed
  }

  /**
   * Validar电子邮件
   * @param {string} email - 电子邮件地址
   * @returns {string} Validar后的电子邮件
   * @throws {Error} 如果电子邮件无效
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('电子邮件必须是非空Cadena')
    }

    const trimmed = email.trim().toLowerCase()

    // 基本FormatoValidar
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(trimmed)) {
      throw new Error('电子邮件Formato无效')
    }

    // 长度Límite
    if (trimmed.length > 254) {
      throw new Error('电子邮件地址过长')
    }

    return trimmed
  }

  /**
   * Validar密码强度
   * @param {string} password - 密码
   * @returns {boolean} Validar结果
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('密码必须是非空Cadena')
    }

    // 最小长度
    if (password.length < 8) {
      throw new Error('密码至少需要8个字符')
    }

    // 最大长度（防止DoS攻击）
    if (password.length > 128) {
      throw new Error('密码不能超过128个字符')
    }

    return true
  }

  /**
   * ValidarRol
   * @param {string} role - UsuarioRol
   * @returns {string} Validar后的Rol
   * @throws {Error} 如果Rol无效
   */
  validateRole(role) {
    const validRoles = ['admin', 'user', 'viewer']

    if (!role || typeof role !== 'string') {
      throw new Error('Rol必须是非空Cadena')
    }

    const trimmed = role.trim().toLowerCase()

    if (!validRoles.includes(trimmed)) {
      throw new Error(`Rol必须是以下之一: ${validRoles.join(', ')}`)
    }

    return trimmed
  }

  /**
   * ValidarWebhook URL
   * @param {string} url - Webhook URL
   * @returns {string} Validar后的URL
   * @throws {Error} 如果URL无效
   */
  validateWebhookUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('Webhook URL必须是非空Cadena')
    }

    const trimmed = url.trim()

    // URLFormatoValidar
    try {
      const urlObj = new URL(trimmed)

      // 只允许HTTP和HTTPSProtocolo
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Webhook URL必须使用HTTP或HTTPSProtocolo')
      }

      // 防止SSRF攻击：禁止访问内网地址
      const hostname = urlObj.hostname.toLowerCase()
      const dangerousHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '169.254.169.254', // AWS元DatosServicio
        'metadata.google.internal' // GCP元DatosServicio
      ]

      if (dangerousHosts.includes(hostname)) {
        throw new Error('Webhook URL不能指向内部Servicio')
      }

      // Verificar是否是内网IP
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
      if (ipRegex.test(hostname)) {
        const parts = hostname.split('.').map(Number)

        // Verificar私有IP范围
        if (
          parts[0] === 10 || // 10.0.0.0/8
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
          (parts[0] === 192 && parts[1] === 168) // 192.168.0.0/16
        ) {
          throw new Error('Webhook URL不能指向私有IP地址')
        }
      }

      return trimmed
    } catch (error) {
      if (error.message.includes('Webhook URL')) {
        throw error
      }
      throw new Error('Webhook URLFormato无效')
    }
  }

  /**
   * Validar显示Nombre
   * @param {string} displayName - 显示Nombre
   * @returns {string} Validar后的显示Nombre
   * @throws {Error} 如果显示Nombre无效
   */
  validateDisplayName(displayName) {
    if (!displayName || typeof displayName !== 'string') {
      throw new Error('显示Nombre必须是非空Cadena')
    }

    const trimmed = displayName.trim()

    // 长度Verificar
    if (trimmed.length < 1 || trimmed.length > 100) {
      throw new Error('显示Nombre长度必须在1-100个字符之间')
    }

    // 禁止特殊控制字符（Excluir常见的换Fila和制Tabla符）
    // eslint-disable-next-line no-control-regex
    const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/
    if (controlCharRegex.test(trimmed)) {
      throw new Error('显示Nombre不能Incluir控制字符')
    }

    return trimmed
  }

  /**
   * LimpiarHTML标签（防止XSS）
   * @param {string} input - 输入Cadena
   * @returns {string} Limpiar后的Cadena
   */
  sanitizeHtml(input) {
    if (!input || typeof input !== 'string') {
      return ''
    }

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  /**
   * ValidarAPI KeyNombre
   * @param {string} name - API KeyNombre
   * @returns {string} Validar后的Nombre
   * @throws {Error} 如果Nombre无效
   */
  validateApiKeyName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('API KeyNombre必须是非空Cadena')
    }

    const trimmed = name.trim()

    // 长度Verificar
    if (trimmed.length < 1 || trimmed.length > 100) {
      throw new Error('API KeyNombre长度必须在1-100个字符之间')
    }

    // 禁止特殊控制字符（Excluir常见的换Fila和制Tabla符）
    // eslint-disable-next-line no-control-regex
    const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/
    if (controlCharRegex.test(trimmed)) {
      throw new Error('API KeyNombre不能Incluir控制字符')
    }

    return trimmed
  }

  /**
   * Validar分页Parámetro
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   * @returns {{page: number, limit: number}} Validar后的分页Parámetro
   */
  validatePagination(page, limit) {
    const pageNum = parseInt(page, 10) || 1
    const limitNum = parseInt(limit, 10) || 20

    if (pageNum < 1) {
      throw new Error('页码必须大于0')
    }

    if (limitNum < 1 || limitNum > 100) {
      throw new Error('每页数量必须在1-100之间')
    }

    return {
      page: pageNum,
      limit: limitNum
    }
  }

  /**
   * ValidarUUIDFormato
   * @param {string} uuid - UUIDCadena
   * @returns {string} Validar后的UUID
   * @throws {Error} 如果UUID无效
   */
  validateUuid(uuid) {
    if (!uuid || typeof uuid !== 'string') {
      throw new Error('UUID必须是非空Cadena')
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(uuid)) {
      throw new Error('UUIDFormato无效')
    }

    return uuid.toLowerCase()
  }
}

module.exports = new InputValidator()
