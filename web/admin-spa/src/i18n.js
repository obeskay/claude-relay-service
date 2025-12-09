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
import enAdmin from './locales/en/admin.json'
import enUser from './locales/en/user.json'
import enApistats from './locales/en/apistats.json'
import enTutorial from './locales/en/tutorial.json'

import esMXCommon from './locales/es-MX/common.json'
import esMXNav from './locales/es-MX/nav.json'
import esMXForms from './locales/es-MX/forms.json'
import esMXMessages from './locales/es-MX/messages.json'
import esMXAccounts from './locales/es-MX/accounts.json'
import esMXDashboard from './locales/es-MX/dashboard.json'
import esMXApiKeys from './locales/es-MX/api-keys.json'
import esMXAccountsView from './locales/es-MX/accounts-view.json'
import esMXSettings from './locales/es-MX/settings.json'
import esMXAdmin from './locales/es-MX/admin.json'
import esMXUser from './locales/es-MX/user.json'
import esMXApistats from './locales/es-MX/apistats.json'
import esMXTutorial from './locales/es-MX/tutorial.json'

// Standard vue-i18n structure
const messages = {
  en: {
    common: enCommon,
    nav: enNav,
    forms: enForms,
    messages: enMessages,
    accounts: enAccounts,
    dashboard: enDashboard,
    'api-keys': enApiKeys,
    apiKeys: enApiKeys,
    accountsView: enAccountsView,
    settings: enSettings,
    admin: enAdmin,
    user: enUser,
    apistats: enApistats,
    tutorial: enTutorial,
    // Add specific keys that might be expected at root if any (e.g. from nav tabs)
    // Legacy support for flat keys if absolutely needed, but better to fix usage.
    ...enNav // Spread nav to root if tabs expect 'tab.dashboard' directly
  },
  'es-MX': {
    common: esMXCommon,
    nav: esMXNav,
    forms: esMXForms,
    messages: esMXMessages,
    accounts: esMXAccounts,
    dashboard: esMXDashboard,
    'api-keys': esMXApiKeys,
    apiKeys: esMXApiKeys,
    accountsView: esMXAccountsView,
    settings: esMXSettings,
    admin: esMXAdmin,
    user: esMXUser,
    apistats: esMXApistats,
    tutorial: esMXTutorial,
    ...esMXNav
  }
}

// Get locale from localStorage or default to 'es-MX'
const getLocale = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('app-locale')
    if (stored && ['en', 'es-MX'].includes(stored)) {
      return stored
    }
  }
  return 'es-MX'
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
