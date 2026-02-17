<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[1050] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm"
    >
      <div class="absolute inset-0" @click="handleClose" />
      <div
        class="relative z-10 mx-3 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white/95 shadow-2xl ring-1 ring-black/5 transition-all dark:border-gray-700/60 dark:bg-gray-900/95 dark:ring-white/10 sm:mx-4"
      >
        <!-- Barra superior -->
        <div
          class="flex items-center justify-between border-b border-gray-100 bg-white/80 px-5 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80"
        >
          <div class="flex items-center gap-3">
            <div
              :class="[
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-lg',
                headerIconBgClass
              ]"
            >
              <i
                :class="[
                  'fas',
                  state.testStatus.value === 'idle'
                    ? 'fa-vial'
                    : state.testStatus.value === 'testing'
                      ? 'fa-spinner fa-spin'
                      : state.testStatus.value === 'success'
                        ? 'fa-check'
                        : 'fa-times'
                ]"
              />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {{ modalTitle }}
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ modalSubtitle }}
              </p>
            </div>
          </div>
          <button
            class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            :disabled="state.testStatus.value === 'testing'"
            @click="handleClose"
          >
            <i class="fas fa-times text-sm" />
          </button>
        </div>

        <!-- Área de contenido -->
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          <!-- [apikey] Mostrar API Key -->
          <div v-if="mode === 'apikey'" class="mb-4">
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              API Key
            </label>
            <div class="relative">
              <input
                class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-10 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                readonly
                type="text"
                :value="maskedApiKey"
              />
              <div class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <i class="fas fa-lock text-xs" />
              </div>
            </div>
          </div>

          <!-- Test information -->
          <div class="mb-4 space-y-2">
            <!-- [account] Platform type -->
            <div v-if="mode === 'account'" class="flex items-center justify-between text-sm">
              <span class="text-gray-500 dark:text-gray-400">Tipo de plataforma</span>
              <span
                :class="[
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  platformBadgeClass
                ]"
              >
                <i :class="platformIcon" />
                {{ platformLabel }}
              </span>
            </div>
            <!-- [account+bedrock] Credential type -->
            <div
              v-if="mode === 'account' && account?.platform === 'bedrock'"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-gray-500 dark:text-gray-400">Tipo de cuenta</span>
              <span
                :class="[
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  credentialTypeBadgeClass
                ]"
              >
                <i :class="credentialTypeIcon" />
                {{ credentialTypeLabel }}
              </span>
            </div>
            <!-- [apikey] Test endpoint -->
            <div v-if="mode === 'apikey'" class="flex items-center justify-between text-sm">
              <span class="text-gray-500 dark:text-gray-400">Endpoint de prueba</span>
              <span
                class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
              >
                <i class="fas fa-link" />
                {{ apikeyServiceConfig.displayEndpoint }}
              </span>
            </div>
            <!-- Test model (both modes) -->
            <div class="text-sm">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-gray-500 dark:text-gray-400">Modelo de prueba</span>
                <ModelSelector
                  v-model="selectedModel"
                  :disabled="state.testStatus.value === 'testing'"
                  :models="availableModels"
                />
              </div>
              <div class="text-right text-xs text-gray-400 dark:text-gray-500">
                {{ selectedModel }}
              </div>
            </div>
            <!-- [apikey] Max output tokens -->
            <div v-if="mode === 'apikey'" class="text-sm">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-gray-500 dark:text-gray-400">Tokens máximos de salida</span>
                <select
                  v-model="maxTokens"
                  class="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option v-for="opt in maxTokensOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>
            <!-- [apikey] Test service -->
            <div v-if="mode === 'apikey'" class="flex items-center justify-between text-sm">
              <span class="text-gray-500 dark:text-gray-400">Servicio de prueba</span>
              <span class="font-medium text-gray-700 dark:text-gray-300">
                {{ apikeyServiceConfig.name }}
              </span>
            </div>
          </div>

          <!-- [apikey] Prompt input -->
          <div v-if="mode === 'apikey'" class="mb-4">
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Prompt
            </label>
            <textarea
              v-model="testPrompt"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              placeholder="Ingrese el prompt de prueba..."
              rows="2"
            />
          </div>

          <!-- Status indicator -->
          <div
            :class="[
              'mb-4 rounded-xl border p-4 transition-all duration-300',
              state.statusCardClass.value
            ]"
          >
            <div class="flex items-center gap-3">
              <div
                :class="[
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  state.statusIconBgClass.value
                ]"
              >
                <i :class="['fas text-sm', state.statusIcon.value, state.statusIconClass.value]" />
              </div>
              <div>
                <p :class="['font-medium', state.statusTextClass.value]">
                  {{ state.statusTitle.value }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ statusDescription }}</p>
              </div>
            </div>
          </div>

          <!-- Área de contenido de respuesta -->
          <div
            v-if="state.testStatus.value !== 'idle'"
            class="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <div
              class="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
            >
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">Respuesta de IA</span>
              <span
                v-if="state.responseText.value"
                class="text-xs text-gray-500 dark:text-gray-500"
              >
                {{ state.responseText.value.length }} caracteres
              </span>
            </div>
            <div class="max-h-40 overflow-y-auto p-3">
              <p
                v-if="state.responseText.value"
                class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300"
              >
                {{ state.responseText.value }}
                <span
                  v-if="state.testStatus.value === 'testing'"
                  class="inline-block h-4 w-1 animate-pulse bg-blue-500"
                />
              </p>
              <p
                v-else-if="state.testStatus.value === 'testing'"
                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
              >
                <i class="fas fa-circle-notch fa-spin" />
                Esperando respuesta...
              </p>
              <p
                v-else-if="state.testStatus.value === 'error' && state.errorMessage.value"
                class="text-sm text-red-600 dark:text-red-400"
              >
                {{ state.errorMessage.value }}
              </p>
            </div>
          </div>

          <!-- Tiempo de prueba -->
          <div
            v-if="state.testDuration.value > 0"
            class="mb-4 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400"
          >
            <i class="fas fa-clock" />
            <span>Tiempo: {{ (state.testDuration.value / 1000).toFixed(2) }} segundos</span>
          </div>
        </div>

        <!-- Barra de acciones inferior -->
        <div
          class="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/80 px-5 py-3 dark:border-gray-800 dark:bg-gray-900/50"
        >
          <button
            class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            :disabled="state.testStatus.value === 'testing'"
            @click="handleClose"
          >
            Cerrar
          </button>
          <button
            :class="[
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition',
              state.testStatus.value === 'testing' || disableTest
                ? 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 hover:shadow-md'
            ]"
            :disabled="state.testStatus.value === 'testing' || disableTest"
            @click="startTest"
          >
            <i
              :class="[
                'fas',
                state.testStatus.value === 'testing' ? 'fa-spinner fa-spin' : 'fa-play'
              ]"
            />
            {{
              state.testStatus.value === 'testing'
                ? 'Probando...'
                : state.testStatus.value === 'idle'
                  ? 'Iniciar prueba'
                  : 'Volver a probar'
            }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { APP_CONFIG } from '@/utils/tools'
import { getModelsApi } from '@/utils/http_apis'
import { useTestState } from '@/utils/useTestState'
import ModelSelector from '@/components/common/ModelSelector.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  mode: { type: String, default: 'account' }, // 'account' | 'apikey'
  // Modo cuenta
  account: { type: Object, default: null },
  // modo apikey
  apiKeyValue: { type: String, default: '' },
  apiKeyName: { type: String, default: '' },
  serviceType: { type: String, default: 'claude' }
})

const emit = defineEmits(['close'])
const state = useTestState()

// ========== Relacionado con modelos ==========
const selectedModel = ref('')
const modelsFromApi = ref({ claude: [], gemini: [], openai: [], platforms: {} })

const loadModels = async () => {
  const result = await getModelsApi()
  if (result.success && result.data) {
    modelsFromApi.value = result.data
  }
}

onMounted(loadModels)

const availableModels = computed(() => {
  if (props.mode === 'account') {
    const platform = props.account?.platform
    if (!platform) return []
    // azure-openai usa deploymentName
    if (platform === 'azure-openai') {
      return [{ value: props.account.deploymentName, label: props.account.deploymentName }]
    }
    return modelsFromApi.value.platforms?.[platform] || []
  }
  // modo apikey
  return modelsFromApi.value[props.serviceType] || []
})

// Modelos de respaldo predeterminados para cada plataforma (se usan cuando la lista de modelos no está cargada)
const platformFallbackModels = {
  claude: 'claude-sonnet-4-5-20250929',
  'claude-console': 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.5-pro',
  'gemini-api': 'gemini-2.5-flash',
  'openai-responses': 'gpt-5',
  droid: 'claude-sonnet-4-5-20250929',
  ccr: 'claude-sonnet-4-5-20250929'
}

const defaultModel = computed(() => {
  if (props.mode === 'account') {
    const platform = props.account?.platform
    if (platform === 'azure-openai') return props.account?.deploymentName
    // bedrock prioriza lista, lista vacía por tipo de credencial
    if (platform === 'bedrock') {
      const models = availableModels.value
      if (models.length > 0) return models[0].value
      if (props.account?.credentialType === 'bearer_token')
        return 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
      return 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
    }
    const models = availableModels.value
    if (models.length > 0) return models[0].value
    return platformFallbackModels[platform] || platformFallbackModels.claude
  }
  // modo apikey: prioriza lista, fallback defaultModel de serviceConfig
  const models = availableModels.value
  if (models.length > 0) return models[0].value
  return apikeyServiceConfig.value.defaultModel
})

// ========== Específico para modo apikey ==========
const testPrompt = ref('hi')
const maxTokens = ref(1000)
const maxTokensOptions = [
  { value: 100, label: '100' },
  { value: 500, label: '500' },
  { value: 1000, label: '1000' },
  { value: 2000, label: '2000' },
  { value: 4096, label: '4096' }
]

const apikeyServiceConfigs = {
  claude: {
    name: 'Claude',
    endpoint: '/api-key/test',
    defaultModel: 'claude-sonnet-4-5-20250929',
    displayEndpoint: '/api/v1/messages'
  },
  gemini: {
    name: 'Gemini',
    endpoint: '/api-key/test-gemini',
    defaultModel: 'gemini-2.5-pro',
    displayEndpoint: '/gemini/v1/models/:model:streamGenerateContent'
  },
  openai: {
    name: 'OpenAI (Codex)',
    endpoint: '/api-key/test-openai',
    defaultModel: 'gpt-5',
    displayEndpoint: '/openai/responses'
  }
}

const apikeyServiceConfig = computed(
  () => apikeyServiceConfigs[props.serviceType] || apikeyServiceConfigs.claude
)

const maskedApiKey = computed(() => {
  const key = props.apiKeyValue
  if (!key) return ''
  if (key.length <= 10) return '****'
  return key.substring(0, 6) + '****' + key.substring(key.length - 4)
})

const disableTest = computed(() => props.mode === 'apikey' && !props.apiKeyValue)

// ========== modo account - información de plataforma ==========
const platformConfigs = {
  claude: {
    label: 'Claude OAuth',
    icon: 'fas fa-brain',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
  },
  'claude-console': {
    label: 'Claude Console',
    icon: 'fas fa-brain',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
  },
  bedrock: {
    label: 'AWS Bedrock',
    icon: 'fab fa-aws',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
  },
  gemini: {
    label: 'Gemini',
    icon: 'fas fa-gem',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
  },
  'gemini-api': {
    label: 'Gemini API',
    icon: 'fas fa-gem',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
  },
  'openai-responses': {
    label: 'OpenAI Responses',
    icon: 'fas fa-code',
    badge: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
  },
  'azure-openai': {
    label: 'Azure OpenAI',
    icon: 'fab fa-microsoft',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300'
  },
  droid: {
    label: 'Droid',
    icon: 'fas fa-robot',
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300'
  },
  ccr: {
    label: 'CCR',
    icon: 'fas fa-key',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
  }
}

const platformConfig = computed(
  () =>
    platformConfigs[props.account?.platform] || {
      label: 'Desconocido',
      icon: 'fas fa-question',
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
)
const platformLabel = computed(() => platformConfig.value.label)
const platformIcon = computed(() => platformConfig.value.icon)
const platformBadgeClass = computed(() => platformConfig.value.badge)

const credentialTypeLabel = computed(() => {
  const ct = props.account?.credentialType
  if (ct === 'access_key') return 'Access Key'
  if (ct === 'bearer_token') return 'Bearer Token'
  return 'Unknown'
})
const credentialTypeIcon = computed(() => {
  const ct = props.account?.credentialType
  if (ct === 'access_key') return 'fas fa-key'
  if (ct === 'bearer_token') return 'fas fa-ticket'
  return 'fas fa-question'
})
const credentialTypeBadgeClass = computed(() => {
  const ct = props.account?.credentialType
  if (ct === 'access_key') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
  if (ct === 'bearer_token')
    return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
})

// ========== Propiedades computadas generales ==========
const modalTitle = computed(() =>
  props.mode === 'account' ? 'Prueba de conectividad de cuenta' : 'Prueba de endpoint de API Key'
)
const modalSubtitle = computed(() => {
  if (props.mode === 'account') return props.account?.name || 'Cuenta desconocida'
  return props.apiKeyName || 'API Key actual'
})

const headerIconBgClass = computed(() => {
  const s = state.testStatus.value
  if (s === 'success') return 'bg-gradient-to-br from-green-500 to-emerald-500'
  if (s === 'error') return 'bg-gradient-to-br from-red-500 to-pink-500'
  return 'bg-gradient-to-br from-blue-500 to-indigo-500'
})

const statusDescription = computed(() => {
  const s = state.testStatus.value
  const apiName = props.mode === 'account' ? platformLabel.value : apikeyServiceConfig.value.name
  if (s === 'idle')
    return props.mode === 'account'
      ? 'Haga clic en el botón de abajo para comenzar a probar la conectividad de la cuenta'
      : 'Haga clic en el botón de abajo para comenzar a probar la conectividad de la API Key'
  if (s === 'testing') return 'Enviando solicitud de prueba y esperando respuesta'
  if (s === 'success')
    return props.mode === 'account' ? `La cuenta puede acceder normalmente a ${apiName}` : 'La API Key puede acceder al servicio normalmente'
  if (s === 'error') return state.errorMessage.value || `No se puede conectar a ${apiName}`
  return ''
})

// ========== Lógica de prueba ==========
const getAccountEndpoint = () => {
  if (!props.account) return ''
  const platform = props.account.platform
  const endpoints = {
    claude: `${APP_CONFIG.apiPrefix}/admin/claude-accounts/${props.account.id}/test`,
    'claude-console': `${APP_CONFIG.apiPrefix}/admin/claude-console-accounts/${props.account.id}/test`,
    bedrock: `${APP_CONFIG.apiPrefix}/admin/bedrock-accounts/${props.account.id}/test`,
    gemini: `${APP_CONFIG.apiPrefix}/admin/gemini-accounts/${props.account.id}/test`,
    'gemini-api': `${APP_CONFIG.apiPrefix}/admin/gemini-api-accounts/${props.account.id}/test`,
    'openai-responses': `${APP_CONFIG.apiPrefix}/admin/openai-responses-accounts/${props.account.id}/test`,
    'azure-openai': `${APP_CONFIG.apiPrefix}/admin/azure-openai-accounts/${props.account.id}/test`,
    droid: `${APP_CONFIG.apiPrefix}/admin/droid-accounts/${props.account.id}/test`,
    ccr: `${APP_CONFIG.apiPrefix}/admin/ccr-accounts/${props.account.id}/test`
  }
  return endpoints[platform] || ''
}

const startTest = () => {
  if (props.mode === 'account') {
    const endpoint = getAccountEndpoint()
    if (!endpoint) return
    const authToken = localStorage.getItem('authToken')
    const useSSE = ['claude', 'claude-console', 'bedrock', 'gemini-api'].includes(
      props.account.platform
    )
    state.sendTestRequest(
      endpoint,
      { model: selectedModel.value },
      {
        useSSE,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      }
    )
  } else {
    const endpoint = `${APP_CONFIG.apiPrefix}/apiStats${apikeyServiceConfig.value.endpoint}`
    state.sendTestRequest(
      endpoint,
      {
        apiKey: props.apiKeyValue,
        model: selectedModel.value,
        prompt: testPrompt.value,
        maxTokens: maxTokens.value
      },
      { useSSE: true }
    )
  }
}

const handleClose = () => {
  if (state.testStatus.value === 'testing') return
  state.cleanup()
  state.resetState()
  emit('close')
}

// ========== Escucha ==========
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      state.resetState()
      selectedModel.value = defaultModel.value
      if (props.mode === 'apikey') {
        testPrompt.value = 'hi'
        maxTokens.value = 1000
      }
    }
  }
)

watch(
  () => [props.account, props.serviceType],
  () => {
    selectedModel.value = defaultModel.value
  },
  { deep: true }
)
</script>
