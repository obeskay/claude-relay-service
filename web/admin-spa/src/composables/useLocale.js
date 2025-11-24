import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

export function useLocale() {
  const i18n = useI18n()

  const currentLocale = computed({
    get: () => i18n.locale.value,
    set: (val) => {
      i18n.locale.value = val
      localStorage.setItem('app-locale', val)
    }
  })

  const availableLocales = ['en', 'es-MX']

  const getLocaleName = (locale) => {
    const names = {
      en: 'English',
      'es-MX': 'Español (México)'
    }
    return names[locale] || locale
  }

  return {
    currentLocale,
    availableLocales,
    getLocaleName
  }
}
