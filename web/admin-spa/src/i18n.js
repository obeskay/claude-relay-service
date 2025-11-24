import { createI18n } from 'vue-i18n'

// Import translations
import enCommon from './locales/en/common.json'
import enNav from './locales/en/nav.json'
import enForms from './locales/en/forms.json'
import enMessages from './locales/en/messages.json'
import enAccounts from './locales/en/accounts.json'
import enDashboard from './locales/en/dashboard.json'
import enApiKeys from './locales/en/api-keys.json'
import enAccountsView from './locales/en/accounts-view.json'
import enSettings from './locales/en/settings.json'

import esMXCommon from './locales/es-MX/common.json'
import esMXNav from './locales/es-MX/nav.json'
import esMXForms from './locales/es-MX/forms.json'
import esMXMessages from './locales/es-MX/messages.json'
import esMXAccounts from './locales/es-MX/accounts.json'
import esMXDashboard from './locales/es-MX/dashboard.json'
import esMXApiKeys from './locales/es-MX/api-keys.json'
import esMXAccountsView from './locales/es-MX/accounts-view.json'
import esMXSettings from './locales/es-MX/settings.json'

const messages = {
  en: {
    common: enCommon,
    nav: enNav,
    forms: enForms,
    messages: enMessages,
    accounts: enAccounts,
    dashboard: enDashboard,
    'api-keys': enApiKeys,
    'accounts-view': enAccountsView,
    settings: enSettings
  },
  'es-MX': {
    common: esMXCommon,
    nav: esMXNav,
    forms: esMXForms,
    messages: esMXMessages,
    accounts: esMXAccounts,
    dashboard: esMXDashboard,
    'api-keys': esMXApiKeys,
    'accounts-view': esMXAccountsView,
    settings: esMXSettings
  }
}

// Get locale from localStorage or default to 'en'
const getLocale = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('app-locale')
    if (stored && ['en', 'es-MX'].includes(stored)) {
      return stored
    }
  }
  return 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: getLocale(),
  fallbackLocale: 'en',
  messages,
  globalInjection: true,
  missingWarn: false,
  missingFallbackWarn: false
})

export default i18n
