<template>
  <div class="language-selector relative">
    <button
      class="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      @click="isOpen = !isOpen"
    >
      <i class="fas fa-language text-base" />
      <span class="hidden sm:inline">{{ getCurrentLanguageLabel() }}</span>
      <i
        class="fas fa-chevron-down ml-1 text-xs transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="language-menu absolute right-0 top-full mt-2 w-48 rounded-xl border border-gray-200 bg-white py-2 shadow-xl dark:border-gray-700 dark:bg-gray-800"
      style="z-index: 999999"
      @click.stop
    >
      <button
        v-for="locale in availableLocales"
        :key="locale"
        class="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
        :class="{
          'bg-blue-50 dark:bg-blue-900/20': currentLocale === locale
        }"
        @click="changeLocale(locale)"
      >
        <span
          class="flex items-center gap-3"
          :class="{
            'font-semibold text-blue-600 dark:text-blue-400': currentLocale === locale,
            'text-gray-700 dark:text-gray-300': currentLocale !== locale
          }"
        >
          <i class="fas" :class="getLocaleIcon(locale)" />
          {{ getLocaleName(locale) }}
        </span>
        <i v-if="currentLocale === locale" class="fas fa-check text-blue-600 dark:text-blue-400" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useLocale } from '@/composables/useLocale'
import { showToast } from '@/utils/toast'

const { currentLocale, availableLocales, getLocaleName } = useLocale()
const isOpen = ref(false)

const getLocaleIcon = (locale) => {
  const icons = {
    en: 'fa-flag-usa',
    'es-MX': 'fa-flag',
    zh: 'fa-flag'
  }
  return icons[locale] || 'fa-globe'
}

const getCurrentLanguageLabel = () => {
  const labels = {
    en: 'EN',
    'es-MX': 'ES',
    zh: 'ZH'
  }
  return labels[currentLocale.value] || 'EN'
}

const changeLocale = (locale) => {
  currentLocale.value = locale
  isOpen.value = false
  showToast(`Idioma cambiado a ${getLocaleName(locale)}`, 'success')

  // Reload page to apply locale changes to Element Plus
  setTimeout(() => {
    window.location.reload()
  }, 300)
}

// Click outside to close
const handleClickOutside = (event) => {
  const languageSelector = event.target.closest('.language-selector')
  if (!languageSelector && isOpen.value) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.language-menu {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
