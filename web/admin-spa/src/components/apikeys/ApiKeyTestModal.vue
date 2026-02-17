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
        <!-- 顶部栏 -->
        <div
          class="flex items-center justify-between border-b border-gray-100 bg-white/80 px-5 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80"
        >
          <div class="flex items-center gap-3">
            <div
              :class="[
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-lg',
                testStatus === 'success'
                  ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                  : testStatus === 'error'
                    ? 'bg-gradient-to-br from-red-500 to-pink-500'
                    : 'bg-gradient-to-br from-blue-500 to-indigo-500'
              ]"
            >
              <i
                :class="[
                  'fas',
                  testStatus === 'idle'
                    ? 'fa-vial'
                    : testStatus === 'testing'
                      ? 'fa-spinner fa-spin'
                      : testStatus === 'success'
                        ? 'fa-check'
                        : 'fa-times'
                ]"
              />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Prueba de Endpoint de API Key
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ displayName }}
              </p>
            </div>
          </div>
          <button
            class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            :disabled="testStatus === 'testing'"
            @click="handleClose"
          >
            <i class="fas fa-times text-sm" />
          </button>
        </div>

        <!-- 内容区域 -->
        <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
          <!-- API Key 显示区域（只读） -->
          <div class="mb-4">
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
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              La prueba usará esta API Key para llamar al endpoint /api del servicio actual
            </p>
          </div>

          <!-- 测试Información -->
          <div class="mb-4 space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-500 dark:text-gray-400">测试端点</span>
              <span
                class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
              >
                <i class="fas fa-link" />
                {{ serviceConfig.displayEndpoint }}
              </span>
            </div>
            <div class="text-sm">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-gray-500 dark:text-gray-400">测试Modelo</span>
                <select
                  v-model="testModel"
                  class="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option v-for="model in availableModels" :key="model.value" :value="model.value">
                    {{ model.label }}
                  </option>
                </select>
              </div>
              <div class="text-right text-xs text-gray-400 dark:text-gray-500">
                {{ testModel }}
              </div>
            </div>
            <div class="text-sm">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-gray-500 dark:text-gray-400">最大Salida Token</span>
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
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-500 dark:text-gray-400">测试服务</span>
              <span class="font-medium text-gray-700 dark:text-gray-300">{{
                serviceConfig.name
              }}</span>
            </div>
          </div>

          <!-- Sugerencia词Entrada -->
          <div class="mb-4">
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Prompt
            </label>
            <textarea
              v-model="testPrompt"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              placeholder="Ingresa el prompt de prueba..."
              rows="2"
            />
          </div>

          <!-- Estado指示 -->
          <div :class="['mb-4 rounded-xl border p-4 transition-all duration-300', statusCardClass]">
            <div class="flex items-center gap-3">
              <div
                :class="['flex h-8 w-8 items-center justify-center rounded-lg', statusIconBgClass]"
              >
                <i :class="['fas text-sm', statusIcon, statusIconClass]" />
              </div>
              <div>
                <p :class="['font-medium', statusTextClass]">{{ statusTitle }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ statusDescription }}</p>
              </div>
            </div>
          </div>

          <!-- 响应内容区域 -->
          <div
            v-if="testStatus !== 'idle'"
            class="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <div
              class="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
            >
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">AI 响应</span>
              <span v-if="responseText" class="text-xs text-gray-500 dark:text-gray-500">
                {{ responseText.length }} 字符
              </span>
            </div>
            <div class="max-h-40 overflow-y-auto p-3">
              <p
                v-if="responseText"
                class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300"
              >
                {{ responseText }}
                <span
                  v-if="testStatus === 'testing'"
                  class="inline-block h-4 w-1 animate-pulse bg-blue-500"
                />
              </p>
              <p
                v-else-if="testStatus === 'testing'"
                class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
              >
                <i class="fas fa-circle-notch fa-spin" />
                等待响应en...
              </p>
              <p
                v-else-if="testStatus === 'error' && errorMessage"
                class="text-sm text-red-600 dark:text-red-400"
              >
                {{ errorMessage }}
              </p>
            </div>
          </div>

          <!-- 测试时间 -->
          <div
            v-if="testDuration > 0"
            class="mb-4 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400"
          >
            <i class="fas fa-clock" />
            <span>耗时 {{ (testDuration / 1000).toFixed(2) }} 秒</span>
          </div>
        </div>

        <!-- 底部Operación栏 -->
        <div
          class="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/80 px-5 py-3 dark:border-gray-800 dark:bg-gray-900/50"
        >
          <button
            class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            :disabled="testStatus === 'testing'"
            @click="handleClose"
          >
            Cerrar
          </button>
          <button
            :class="[
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition',
              testStatus === 'testing' || !apiKeyValue
                ? 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 hover:shadow-md'
            ]"
            :disabled="testStatus === 'testing' || !apiKeyValue"
            @click="startTest"
          >
            <i :class="['fas', testStatus === 'testing' ? 'fa-spinner fa-spin' : 'fa-play']" />
            {{
              testStatus === 'testing'
                ? '测试en...'
                : testStatus === 'idle'
                  ? '开始测试'
                  : '重新测试'
            }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { APP_CONFIG } from '@/utils/tools'
import { getModelsApi } from '@/utils/http_apis'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  // API Key completo (para prueba)
  apiKeyValue: {
    type: String,
    default: ''
  },
  // Nombre de la API Key (para mostrar)
  apiKeyName: {
    type: String,
    default: ''
  },
  // 服务Tipo: claude, gemini, openai
  serviceType: {
    type: String,
    default: 'claude',
    validator: (value) => ['claude', 'gemini', 'openai'].includes(value)
  }
})

const emit = defineEmits(['close'])

// Estado
const testStatus = ref('idle') // idle, testing, success, error
const responseText = ref('')
const errorMessage = ref('')
const testDuration = ref(0)
const testStartTime = ref(null)
const abortController = ref(null)

// 测试Modelo
const testModel = ref('claude-sonnet-4-5-20250929')

// 测试Sugerencia词
const testPrompt = ref('hi')

// 最大Salida token
const maxTokens = ref(1000)
const maxTokensOptions = [
  { value: 100, label: '100' },
  { value: 500, label: '500' },
  { value: 1000, label: '1000' },
  { value: 2000, label: '2000' },
  { value: 4096, label: '4096' }
]

// de API 获取Modelo列表
const modelsFromApi = ref({
  claude: [],
  gemini: [],
  openai: []
})

// 加载Modelo列表
const loadModels = async () => {
  try {
    const result = await getModelsApi()
    if (result.success && result.data) {
      modelsFromApi.value = {
        claude: result.data.claude || [],
        gemini: result.data.gemini || [],
        openai: result.data.openai || []
      }
    }
  } catch (error) {
    console.error('Failed to load models:', error)
  }
}

// 服务配置
const serviceConfig = computed(() => {
  const configs = {
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
  return configs[props.serviceType] || configs.claude
})

// 可用Modelo列表（de API 获取）
const availableModels = computed(() => {
  return modelsFromApi.value[props.serviceType] || []
})

// 组件挂载时加载Modelo
onMounted(() => {
  loadModels()
})

// 计算属性
const displayName = computed(() => {
  return props.apiKeyName || '当anterior API Key'
})

const maskedApiKey = computed(() => {
  const key = props.apiKeyValue
  if (!key) return ''
  if (key.length <= 10) return '****'
  return key.substring(0, 6) + '****' + key.substring(key.length - 4)
})

// 计算属性
const statusTitle = computed(() => {
  switch (testStatus.value) {
    case 'idle':
      return '准备就绪'
    case 'testing':
      return '正en测试...'
    case 'success':
      return '测试Exitoso'
    case 'error':
      return '测试Fallido'
    default:
      return 'DesconocidoEstado'
  }
})

const statusDescription = computed(() => {
  switch (testStatus.value) {
    case 'idle':
      return '点击abajo方按钮开始测试 API Key 连通性'
    case 'testing':
      return '正en通过 /api 端点发送测试Solicitud'
    case 'success':
      return 'API Key 可以正常访问服务'
    case 'error':
      return errorMessage.value || '无法通过 API Key 访问服务'
    default:
      return ''
  }
})

const statusCardClass = computed(() => {
  switch (testStatus.value) {
    case 'idle':
      return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
    case 'testing':
      return 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-900/20'
    case 'success':
      return 'border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-900/20'
    case 'error':
      return 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-900/20'
    default:
      return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
  }
})

const statusIconBgClass = computed(() => {
  switch (testStatus.value) {
    case 'idle':
      return 'bg-gray-200 dark:bg-gray-700'
    case 'testing':
      return 'bg-blue-100 dark:bg-blue-500/30'
    case 'success':
      return 'bg-green-100 dark:bg-green-500/30'
    case 'error':
      return 'bg-red-100 dark:bg-red-500/30'
    default:
      return 'bg-gray-200 dark:bg-gray-700'
  }
})

const statusIcon = computed(() => {
  switch (testStatus.value) {
    case 'idle':
      return 'fa-hourglass-start'
    case 'testing':
      return 'fa-spinner fa-spin'
    case 'success':
      return 'fa-check-circle'
    case 'error':
      return 'fa-exclamation-circle'
    default:
      return 'fa-question-circle'
  }
})

const statusIconClass = computed(() => {
  switch (testStatus.value) {
    case 'idle':
      return 'text-gray-500 dark:text-gray-400'
    case 'testing':
      return 'text-blue-500 dark:text-blue-400'
    case 'success':
      return 'text-green-500 dark:text-green-400'
    case 'error':
      return 'text-red-500 dark:text-red-400'
    default:
      return 'text-gray-500 dark:text-gray-400'
  }
})

const statusTextClass = computed(() => {
  switch (testStatus.value) {
    case 'idle':
      return 'text-gray-700 dark:text-gray-300'
    case 'testing':
      return 'text-blue-700 dark:text-blue-300'
    case 'success':
      return 'text-green-700 dark:text-green-300'
    case 'error':
      return 'text-red-700 dark:text-red-300'
    default:
      return 'text-gray-700 dark:text-gray-300'
  }
})

// 方法
async function startTest() {
  if (!props.apiKeyValue) return

  // RestablecerEstado
  testStatus.value = 'testing'
  responseText.value = ''
  errorMessage.value = ''
  testDuration.value = 0
  testStartTime.value = Date.now()

  // Cancelar之anteriorSolicitud
  if (abortController.value) {
    abortController.value.abort()
  }
  abortController.value = new AbortController()

  // 使用公开测试端点，不需要Administrador认证
  // apiStats 路由挂载en /apiStats abajo
  const endpoint = `${APP_CONFIG.apiPrefix}/apiStats${serviceConfig.value.endpoint}`

  try {
    // 使用fetch发送POSTSolicitud并处理SSE
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey: props.apiKeyValue,
        model: testModel.value,
        prompt: testPrompt.value,
        maxTokens: maxTokens.value
      }),
      signal: abortController.value.signal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`)
    }

    // 处理SSE流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let streamDone = false

    while (!streamDone) {
      const { done, value } = await reader.read()
      if (done) {
        streamDone = true
        continue
      }

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            handleSSEEvent(data)
          } catch {
            // 忽略解析Error
          }
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      // Solicitud被Cancelar
      return
    }
    testStatus.value = 'error'
    errorMessage.value = err.message || '连接Fallido'
    testDuration.value = Date.now() - testStartTime.value
  }
}

function handleSSEEvent(data) {
  switch (data.type) {
    case 'test_start':
      // 测试开始
      break
    case 'content':
      responseText.value += data.text
      break
    case 'message_stop':
      // 消息结束
      break
    case 'test_complete':
      testDuration.value = Date.now() - testStartTime.value
      if (data.success) {
        testStatus.value = 'success'
      } else {
        testStatus.value = 'error'
        errorMessage.value = data.error || '测试Fallido'
      }
      break
    case 'error':
      testStatus.value = 'error'
      errorMessage.value = data.error || 'Error desconocido'
      testDuration.value = Date.now() - testStartTime.value
      break
  }
}

function handleClose() {
  if (testStatus.value === 'testing') return

  // CancelarSolicitud
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }

  // RestablecerEstado
  testStatus.value = 'idle'
  responseText.value = ''
  errorMessage.value = ''
  testDuration.value = 0

  emit('close')
}

// 监听show变化，RestablecerEstado
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      testStatus.value = 'idle'
      responseText.value = ''
      errorMessage.value = ''
      testDuration.value = 0
      // Restablecerpara当anterior服务默认Modelo
      testModel.value = serviceConfig.value.defaultModel
      // RestablecerSugerencia词y maxTokens
      testPrompt.value = 'hi'
      maxTokens.value = 1000
    }
  }
)

// 监听服务Tipo变化，RestablecerModelo
watch(
  () => props.serviceType,
  () => {
    testModel.value = serviceConfig.value.defaultModel
  }
)

// 组件卸载时清理
onUnmounted(() => {
  if (abortController.value) {
    abortController.value.abort()
  }
})
</script>
