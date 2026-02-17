/**
 * Admin Routes - 共享工具Función
 * 供各个子RutaMódulo导入使用
 */

const logger = require('../../utils/logger')

/**
 * Procesar可为空的TiempoCampo
 * @param {*} value - 输入Valor
 * @returns {string|null} 规范化后的Valor
 */
function normalizeNullableDate(value) {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  return value
}

/**
 * 映射前端的 expiresAt Campo到后端的 subscriptionExpiresAt Campo
 * @param {Object} updates - ActualizarObjeto
 * @param {string} accountType - CuentaTipo (如 'Claude', 'OpenAI' 等)
 * @param {string} accountId - Cuenta ID
 * @returns {Object} 映射后的ActualizarObjeto
 */
function mapExpiryField(updates, accountType, accountId) {
  const mappedUpdates = { ...updates }
  if ('expiresAt' in mappedUpdates) {
    mappedUpdates.subscriptionExpiresAt = mappedUpdates.expiresAt
    delete mappedUpdates.expiresAt
    logger.info(
      `Mapping expiresAt to subscriptionExpiresAt for ${accountType} account ${accountId}`
    )
  }
  return mappedUpdates
}

/**
 * Formato化CuentaDatos，确保前端Obtener正确的过期TiempoCampo
 * 将 subscriptionExpiresAt（订阅过期Tiempo）映射到 expiresAt 供前端使用
 * 保留原始的 tokenExpiresAt（OAuth token过期Tiempo）供内部使用
 * @param {Object} account - CuentaObjeto
 * @returns {Object} Formato化后的CuentaObjeto
 */
function formatAccountExpiry(account) {
  if (!account || typeof account !== 'object') {
    return account
  }

  const rawSubscription = Object.prototype.hasOwnProperty.call(account, 'subscriptionExpiresAt')
    ? account.subscriptionExpiresAt
    : null

  const rawToken = Object.prototype.hasOwnProperty.call(account, 'tokenExpiresAt')
    ? account.tokenExpiresAt
    : account.expiresAt

  const subscriptionExpiresAt = normalizeNullableDate(rawSubscription)
  const tokenExpiresAt = normalizeNullableDate(rawToken)

  return {
    ...account,
    subscriptionExpiresAt,
    tokenExpiresAt,
    expiresAt: subscriptionExpiresAt
  }
}

module.exports = {
  normalizeNullableDate,
  mapExpiryField,
  formatAccountExpiry
}
