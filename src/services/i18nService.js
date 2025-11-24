const i18next = require('i18next')
const Backend = require('i18next-fs-backend')
const middleware = require('i18next-http-middleware')
const path = require('path')
const logger = require('../utils/logger')

// Inicializar i18next
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json')
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es-MX'],
    preload: ['en', 'es-MX'],
    ns: ['common', 'errors', 'api'],
    defaultNS: 'common',
    detection: {
      order: ['header', 'querystring', 'cookie'],
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      caches: ['cookie']
    },
    interpolation: {
      escapeValue: false
    },
    missingKeyHandler: (lng, ns, key) => {
      logger.warn(`Missing translation key: ${key} in ${lng}/${ns}`)
    }
  })

logger.info('i18next initialized with locales: en, es-MX')

module.exports = {
  i18next,
  middleware
}
