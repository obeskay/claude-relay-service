<template>
  <div ref="triggerRef" class="relative">
    <!-- Cuerpo del selector -->
    <div
      class="form-input flex w-full cursor-pointer items-center justify-between border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
      :class="{ 'opacity-50': disabled }"
      @click="!disabled && toggleDropdown()"
    >
      <span
        :class="
          modelValue ? 'text-gray-900 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'
        "
        >{{ selectedLabel }}</span
      >
      <i
        class="fas fa-chevron-down text-gray-400 transition-transform duration-200 dark:text-gray-500"
        :class="{ 'rotate-180': showDropdown }"
      />
    </div>

    <!-- Menú desplegable -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <div
          v-if="showDropdown"
          ref="dropdownRef"
          class="absolute z-50 flex flex-col rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
          :style="dropdownStyle"
        >
          <!-- Caja de búsqueda -->
          <div class="flex-shrink-0 border-b border-gray-200 p-3 dark:border-gray-600">
            <div class="relative">
              <input
                ref="searchInput"
                v-model="searchQuery"
                class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                placeholder="Buscar nombre de cuenta..."
                style="padding-left: 40px; padding-right: 36px"
                type="text"
                @input="handleSearch"
              />
              <i
                class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500"
              />
              <button
                v-if="searchQuery"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
                type="button"
                @click="clearSearch"
              >
                <i class="fas fa-times text-sm" />
              </button>
            </div>
          </div>

          <!-- Lista de opciones -->
          <div class="custom-scrollbar flex-1 overflow-y-auto">
            <!-- Opciones especiales -->
            <div
              v-if="specialOptionsList.length > 0"
              class="border-b border-gray-200 dark:border-gray-600"
            >
              <div
                v-for="option in specialOptionsList"
                :key="`special-${option.value}`"
                class="cursor-pointer px-4 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                :class="{ 'bg-blue-50 dark:bg-blue-900/20': modelValue === option.value }"
                @click="selectAccount(option.value)"
              >
                <span class="text-gray-700 dark:text-gray-300">{{ option.label }}</span>
                <span
                  v-if="option.description"
                  class="ml-2 text-xs text-gray-400 dark:text-gray-500"
                >
                  {{ option.description }}
                </span>
              </div>
            </div>

            <!-- Opción predeterminada -->
            <div
              class="cursor-pointer px-4 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
              :class="{ 'bg-blue-50 dark:bg-blue-900/20': !modelValue }"
              @click="selectAccount(null)"
            >
              <span class="text-gray-700 dark:text-gray-300">{{ defaultOptionText }}</span>
            </div>

            <!-- Opciones de grupo -->
            <div v-if="filteredGroups.length > 0">
              <div
                class="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              >
                Grupos de programación
              </div>
              <div
                v-for="group in filteredGroups"
                :key="`group:${group.id}`"
                class="cursor-pointer px-4 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                :class="{ 'bg-blue-50 dark:bg-blue-900/20': modelValue === `group:${group.id}` }"
                @click="selectAccount(`group:${group.id}`)"
              >
                <div class="flex items-center justify-between">
                  <span class="text-gray-700 dark:text-gray-300">{{ group.name }}</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400"
                    >{{ group.memberCount || 0 }} miembros</span
                  >
                </div>
              </div>
            </div>

            <!-- Cuentas OAuth -->
            <div v-if="filteredOAuthAccounts.length > 0">
              <div
                class="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              >
                {{
                  platform === 'claude'
                    ? 'Cuenta exclusiva Claude OAuth'
                    : platform === 'openai'
                      ? 'Cuenta exclusiva OpenAI'
                      : platform === 'droid'
                        ? 'Cuenta exclusiva Droid'
                        : platform === 'gemini'
                          ? 'Cuenta exclusiva Gemini OAuth'
                          : 'Cuenta exclusiva OAuth'
                }}
              </div>
              <div
                v-for="account in filteredOAuthAccounts"
                :key="account.id"
                class="cursor-pointer px-4 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                :class="{ 'bg-blue-50 dark:bg-blue-900/20': modelValue === account.id }"
                @click="selectAccount(account.id)"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-gray-700 dark:text-gray-300">{{ account.name }}</span>
                    <span
                      class="ml-2 rounded-full px-2 py-0.5 text-xs"
                      :class="
                        account.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : account.status === 'unauthorized'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      "
                    >
                      {{ getAccountStatusText(account) }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-400 dark:text-gray-500">
                    {{ formatDate(account.createdAt) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Cuentas Console (solo Claude) -->
            <div v-if="platform === 'claude' && filteredConsoleAccounts.length > 0">
              <div
                class="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              >
                Cuenta exclusiva Claude Console
              </div>
              <div
                v-for="account in filteredConsoleAccounts"
                :key="account.id"
                class="cursor-pointer px-4 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                :class="{
                  'bg-blue-50 dark:bg-blue-900/20': modelValue === `console:${account.id}`
                }"
                @click="selectAccount(`console:${account.id}`)"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-gray-700 dark:text-gray-300">{{ account.name }}</span>
                    <span
                      class="ml-2 rounded-full px-2 py-0.5 text-xs"
                      :class="
                        account.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : account.status === 'unauthorized'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      "
                    >
                      {{ getAccountStatusText(account) }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-400 dark:text-gray-500">
                    {{ formatDate(account.createdAt) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Cuentas OpenAI-Responses (solo OpenAI) -->
            <div v-if="platform === 'openai' && filteredOpenAIResponsesAccounts.length > 0">
              <div
                class="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              >
                Cuenta exclusiva OpenAI-Responses
              </div>
              <div
                v-for="account in filteredOpenAIResponsesAccounts"
                :key="account.id"
                class="cursor-pointer px-4 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                :class="{
                  'bg-blue-50 dark:bg-blue-900/20': modelValue === `responses:${account.id}`
                }"
                @click="selectAccount(`responses:${account.id}`)"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-gray-700 dark:text-gray-300">{{ account.name }}</span>
                    <span
                      class="ml-2 rounded-full px-2 py-0.5 text-xs"
                      :class="
                        account.isActive === 'true' || account.isActive === true
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : account.status === 'rate_limited'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      "
                    >
                      {{ getAccountStatusText(account) }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-400 dark:text-gray-500">
                    {{ formatDate(account.createdAt) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Cuentas Gemini-API (solo Gemini) -->
            <div v-if="platform === 'gemini' && filteredGeminiApiAccounts.length > 0">
              <div
                class="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              >
                Cuenta exclusiva Gemini-API
              </div>
              <div
                v-for="account in filteredGeminiApiAccounts"
                :key="account.id"
                class="cursor-pointer px-4 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                :class="{
                  'bg-blue-50 dark:bg-blue-900/20': modelValue === `api:${account.id}`
                }"
                @click="selectAccount(`api:${account.id}`)"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-gray-700 dark:text-gray-300">{{ account.name }}</span>
                    <span
                      class="ml-2 rounded-full px-2 py-0.5 text-xs"
                      :class="
                        account.isActive === 'true' || account.isActive === true
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : account.status === 'rate_limited'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      "
                    >
                      {{ getAccountStatusText(account) }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-400 dark:text-gray-500">
                    {{ formatDate(account.createdAt) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Sin resultados de búsqueda -->
            <div
              v-if="searchQuery && !hasResults"
              class="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
            >
              <i class="fas fa-search mb-2 text-2xl" />
              <p class="text-sm">No se encontraron cuentas coincidentes</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { formatDate } from '@/utils/tools'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  platform: {
    type: String,
    required: true,
    validator: (value) => ['claude', 'gemini', 'openai', 'bedrock', 'droid'].includes(value)
  },
  accounts: {
    type: Array,
    default: () => []
  },
  groups: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: 'Seleccionar cuenta'
  },
  defaultOptionText: {
    type: String,
    default: 'Usar pool de cuentas compartidas'
  },
  specialOptions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

const showDropdown = ref(false)
const searchQuery = ref('')
const searchInput = ref(null)
const dropdownRef = ref(null)
const dropdownStyle = ref({})
const triggerRef = ref(null)
const lastDirection = ref('') // Recordar la dirección de visualización anterior
const specialOptionsList = computed(() => props.specialOptions || [])

// Obtener la etiqueta seleccionada
const selectedLabel = computed(() => {
  const matchedSpecial = specialOptionsList.value.find(
    (option) => option.value === props.modelValue
  )
  if (matchedSpecial) {
    return matchedSpecial.label
  }

  // Si no hay valor seleccionado, mostrar el texto de opción predeterminado
  if (!props.modelValue) return props.defaultOptionText

  // Group
  if (props.modelValue.startsWith('group:')) {
    const groupId = props.modelValue.substring(6)
    const group = props.groups.find((g) => g.id === groupId)
    return group ? `${group.name} (${group.memberCount || 0} miembros)` : ''
  }

  // Console account
  if (props.modelValue.startsWith('console:')) {
    const accountId = props.modelValue.substring(8)
    const account = props.accounts.find(
      (a) => a.id === accountId && a.platform === 'claude-console'
    )
    return account ? `${account.name} (${getAccountStatusText(account)})` : ''
  }

  // OpenAI-Responses account
  if (props.modelValue.startsWith('responses:')) {
    const accountId = props.modelValue.substring(10)
    const account = props.accounts.find(
      (a) => a.id === accountId && a.platform === 'openai-responses'
    )
    return account ? `${account.name} (${getAccountStatusText(account)})` : ''
  }

  // Gemini-API account
  if (props.modelValue.startsWith('api:')) {
    const accountId = props.modelValue.substring(4)
    const account = props.accounts.find((a) => a.id === accountId && a.platform === 'gemini-api')
    return account ? `${account.name} (${getAccountStatusText(account)})` : ''
  }

  // OAuth account
  const account = props.accounts.find((a) => a.id === props.modelValue)
  return account ? `${account.name} (${getAccountStatusText(account)})` : ''
})

// Get account status text
const getAccountStatusText = (account) => {
  if (!account) return 'Desconocido'

  // Handle OpenAI-Responses accounts (isActive might be a string)
  const isActive = account.isActive === 'true' || account.isActive === true

  // Prioritize isActive judgment
  if (!isActive) {
    // Provide more detailed status information based on status
    switch (account.status) {
      case 'unauthorized':
        return 'No autorizado'
      case 'error':
        return 'Error de token'
      case 'created':
        return 'Pendiente de verificación'
      case 'rate_limited':
        return 'Limitado'
      case 'quota_exceeded':
        return 'Cuota excedida'
      default:
        return 'Anómalo'
    }
  }

  // For activated accounts, also display if in rate limit status
  if (account.status === 'rate_limited') {
    return 'Limitado'
  }

  return 'Normal'
}

// Sort accounts by creation time in descending order
const sortedAccounts = computed(() => {
  return [...props.accounts].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0)
    const dateB = new Date(b.createdAt || 0)
    return dateB - dateA // Sort in descending order
  })
})

// Filtered groups (filtered by platform type)
const filteredGroups = computed(() => {
  // Mostrar solo grupos que coinciden con la plataforma actual
  let groups = props.groups.filter((group) => {
    // Si el grupo tiene propiedad platform, debe coincidir con la plataforma actual
    // Si no hay propiedad platform, se considera datos antiguos, juzgar por plataforma
    if (group.platform) {
      return group.platform === props.platform
    }
    // Compatibilidad con versiones anteriores: si no hay campo platform, juzgar por otros medios
    return true
  })

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    groups = groups.filter((group) => group.name.toLowerCase().includes(query))
  }

  return groups
})

// Filtered OAuth accounts
const filteredOAuthAccounts = computed(() => {
  let accounts = []

  if (props.platform === 'claude') {
    accounts = sortedAccounts.value.filter((a) => a.platform === 'claude-oauth')
  } else if (props.platform === 'openai') {
    // For OpenAI, only display openai type accounts
    accounts = sortedAccounts.value.filter((a) => a.platform === 'openai')
  } else if (props.platform === 'droid') {
    accounts = sortedAccounts.value.filter((a) => a.platform === 'droid')
  } else if (props.platform === 'gemini') {
    // For Gemini, only display OAuth type accounts (exclude gemini-api)
    accounts = sortedAccounts.value.filter((a) => a.platform === 'gemini')
  } else {
    // Other platforms display all non-special type accounts
    accounts = sortedAccounts.value.filter(
      (a) =>
        !['claude-oauth', 'claude-console', 'openai-responses', 'gemini-api'].includes(a.platform)
    )
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    accounts = accounts.filter((account) => account.name.toLowerCase().includes(query))
  }

  return accounts
})

// Filtered Console accounts
const filteredConsoleAccounts = computed(() => {
  if (props.platform !== 'claude') return []

  let accounts = sortedAccounts.value.filter((a) => a.platform === 'claude-console')

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    accounts = accounts.filter((account) => account.name.toLowerCase().includes(query))
  }

  return accounts
})

// Filtered OpenAI-Responses accounts
const filteredOpenAIResponsesAccounts = computed(() => {
  if (props.platform !== 'openai') return []

  let accounts = sortedAccounts.value.filter((a) => a.platform === 'openai-responses')

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    accounts = accounts.filter((account) => account.name.toLowerCase().includes(query))
  }

  return accounts
})

// Filtered Gemini-API accounts
const filteredGeminiApiAccounts = computed(() => {
  if (props.platform !== 'gemini') return []

  let accounts = sortedAccounts.value.filter((a) => a.platform === 'gemini-api')

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    accounts = accounts.filter((account) => account.name.toLowerCase().includes(query))
  }

  return accounts
})

// Whether there are search results
const hasResults = computed(() => {
  return (
    filteredGroups.value.length > 0 ||
    filteredOAuthAccounts.value.length > 0 ||
    filteredConsoleAccounts.value.length > 0 ||
    filteredOpenAIResponsesAccounts.value.length > 0 ||
    filteredGeminiApiAccounts.value.length > 0
  )
})

// Format date

// Update dropdown position
const updateDropdownPosition = () => {
  if (!showDropdown.value || !dropdownRef.value || !triggerRef.value) return

  const trigger = triggerRef.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const windowHeight = window.innerHeight
  const windowWidth = window.innerWidth
  const spaceBelow = windowHeight - rect.bottom
  const spaceAbove = rect.top
  const margin = 8 // Margin

  // Obtener altura del menú desplegable
  // const dropdownHeight = dropdownRef.value.offsetHeight

  // Calcular altura máxima disponible
  const maxHeightBelow = spaceBelow - margin
  const maxHeightAbove = spaceAbove - margin

  // Decide display direction and maximum height
  let showAbove = false
  let maxHeight = maxHeightBelow

  // Prioritize using the last direction, unless space is insufficient
  if (lastDirection.value === 'above' && maxHeightAbove >= 150) {
    showAbove = true
    maxHeight = maxHeightAbove
  } else if (lastDirection.value === 'below' && maxHeightBelow >= 150) {
    showAbove = false
    maxHeight = maxHeightBelow
  } else {
    // If no historical direction or insufficient space, choose the direction with more space
    if (maxHeightAbove > maxHeightBelow && maxHeightBelow < 200) {
      showAbove = true
      maxHeight = maxHeightAbove
    }
  }

  // Remember this direction
  lastDirection.value = showAbove ? 'above' : 'below'

  // Ensure dropdown does not exceed window left and right boundaries
  let left = rect.left
  const dropdownWidth = rect.width
  if (left + dropdownWidth > windowWidth - margin) {
    left = windowWidth - dropdownWidth - margin
  }
  if (left < margin) {
    left = margin
  }

  dropdownStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    width: `${rect.width}px`,
    maxHeight: `${Math.min(maxHeight, 400)}px`, // Limit maximum height to 400px
    ...(showAbove ? { bottom: `${windowHeight - rect.top}px` } : { top: `${rect.bottom}px` })
  }
}

// Toggle dropdown menu
const toggleDropdown = () => {
  if (!showDropdown.value && triggerRef.value) {
    // Establecer estilos iniciales antes de mostrar para evitar parpadeo
    const rect = triggerRef.value.getBoundingClientRect()
    const windowHeight = window.innerHeight
    const spaceBelow = windowHeight - rect.bottom
    const margin = 8

    // Preestablecer una posición inicial razonable
    dropdownStyle.value = {
      position: 'fixed',
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      maxHeight: `${Math.min(spaceBelow - margin, 400)}px`,
      top: `${rect.bottom}px`
    }
  }
  showDropdown.value = !showDropdown.value
  if (showDropdown.value) {
    nextTick(() => {
      updateDropdownPosition()
      searchInput.value?.focus()
    })
  }
}

// Select account
const selectAccount = (value) => {
  emit('update:modelValue', value || '')
  showDropdown.value = false
  searchQuery.value = ''
}

// Handle search
const handleSearch = () => {
  // Auto-trigger when searching
}

// Clear search
const clearSearch = () => {
  searchQuery.value = ''
  searchInput.value?.focus()
}

// Click outside to close
const handleClickOutside = (event) => {
  if (!triggerRef.value?.contains(event.target) && !dropdownRef.value?.contains(event.target)) {
    showDropdown.value = false
  }
}

// Listen for scroll to update position
const handleScroll = () => {
  if (showDropdown.value) {
    updateDropdownPosition()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', handleScroll, true)
  window.addEventListener('resize', updateDropdownPosition)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('resize', updateDropdownPosition)
})

// Listen for dropdown menu state changes
watch(showDropdown, (newVal) => {
  if (!newVal) {
    searchQuery.value = ''
    // Reset direction when closed, recalculate when opened next time
    lastDirection.value = ''
  }
})
</script>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e0 #f7fafc;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f7fafc;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e0;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #a0aec0;
}
</style>
