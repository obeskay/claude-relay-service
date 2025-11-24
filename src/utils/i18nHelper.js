const { i18next } = require('../services/i18nService')

/**
 * Get translation function for current request
 * @param {Object} req - Express request object
 * @returns {Function} Translation function
 */
function getTranslator(req) {
  return (key, options) => {
    const lng = req.language || req.i18n?.language || 'en'
    return i18next.t(key, { lng, ...options })
  }
}

/**
 * Translate key directly with specified language
 * @param {string} key - Translation key
 * @param {string} lng - Language code
 * @param {Object} options - Translation options
 * @returns {string} Translated text
 */
function translate(key, lng = 'en', options = {}) {
  return i18next.t(key, { lng, ...options })
}

/**
 * Translate error message
 * @param {Object} req - Express request object
 * @param {string} key - Error key
 * @param {Object} options - Translation options
 * @returns {string} Translated error message
 */
function translateError(req, key, options = {}) {
  const t = getTranslator(req)
  return t(`errors:${key}`, options)
}

/**
 * Translate API message
 * @param {Object} req - Express request object
 * @param {string} key - API message key
 * @param {Object} options - Translation options
 * @returns {string} Translated API message
 */
function translateApi(req, key, options = {}) {
  const t = getTranslator(req)
  return t(`api:${key}`, options)
}

module.exports = {
  getTranslator,
  translate,
  translateError,
  translateApi
}
