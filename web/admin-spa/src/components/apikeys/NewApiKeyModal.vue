<template>
  <Teleport to="body">
    <div class="modal fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        class="modal-content custom-scrollbar mx-auto max-h-[90vh] w-full max-w-lg overflow-y-auto p-8"
      >
        <div class="mb-6 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600"
            >
              <i class="fas fa-check text-lg text-white" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">API Key Creado exitosamente</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">请妥善Guardar您 API Key</p>
            </div>
          </div>
          <button
            class="text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            title="直接Cerrar（不推荐）"
            @click="handleDirectClose"
          >
            <i class="fas fa-times text-xl" />
          </button>
        </div>

        <!-- AdvertenciaSugerencia -->
        <div
          class="mb-6 border-l-4 border-amber-400 bg-amber-50 p-4 dark:border-amber-500 dark:bg-amber-900/20"
        >
          <div class="flex items-start">
            <div
              class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-amber-400 dark:bg-amber-500"
            >
              <i class="fas fa-exclamation-triangle text-sm text-white" />
            </div>
            <div class="ml-3">
              <h5 class="mb-1 font-semibold text-amber-900 dark:text-amber-400">重要提醒</h5>
              <p class="text-sm text-amber-800 dark:text-amber-300">
                这是您唯一能看到完整 API Key 机会。Cerrar此窗口siguiente，系统将不再显示完整 API
                Key。请立即Copiar并妥善Guardar。
              </p>
            </div>
          </div>
        </div>

        <!-- API Key Información -->
        <div class="mb-6 space-y-4">
          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >API Key Nombre</label
            >
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800"
            >
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ apiKey.name }}</span>
            </div>
          </div>

          <div v-if="apiKey.description">
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >Nota</label
            >
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800"
            >
              <span class="text-gray-700 dark:text-gray-300">{{
                apiKey.description || '无Descripción'
              }}</span>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >API Key</label
            >
            <div class="relative">
              <div
                class="flex min-h-[60px] items-center break-all rounded-lg border border-gray-700 bg-gray-900 p-4 pr-14 font-mono text-sm text-white dark:border-gray-600 dark:bg-gray-900"
              >
                {{ getDisplayedApiKey() }}
              </div>
              <div class="absolute right-3 top-3">
                <button
                  class="btn-icon-sm bg-gray-700 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
                  :title="showFullKey ? '隐藏API Key' : '显示完整API Key'"
                  type="button"
                  @click="toggleKeyVisibility"
                >
                  <i :class="['fas', showFullKey ? 'fa-eye-slash' : 'fa-eye', 'text-gray-300']" />
                </button>
              </div>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              点击眼睛图标切换显示模式，使用abajo方按钮Copiar环境变量配置
            </p>
          </div>
        </div>

        <!-- Operación按钮 -->
        <div class="flex flex-col gap-3 sm:gap-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button
              class="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20 sm:flex-1 sm:text-base"
              @click="copyKeyOnly"
            >
              <i class="fas fa-key" />
              仅CopiarClave
            </button>
            <button
              class="btn btn-primary flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:flex-1 sm:text-base"
              @click="copyFullConfig"
            >
              <i class="fas fa-copy" />
              CopiarClaude配置
            </button>
          </div>
          <button
            class="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-gray-200 px-5 py-3 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 sm:text-base"
            @click="handleClose"
          >
            <i class="fas fa-check-circle" />
            我已Guardar
          </button>
        </div>
      </div>
    </div>

    <!-- ConfirmModal -->
    <ConfirmModal
      :cancel-text="confirmModalConfig.cancelText"
      :confirm-text="confirmModalConfig.confirmText"
      :message="confirmModalConfig.message"
      :show="showConfirmModal"
      :title="confirmModalConfig.title"
      :type="confirmModalConfig.type"
      @cancel="handleCancelModal"
      @confirm="handleConfirmModal"
    />
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { showToast } from '@/utils/tools'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const props = defineProps({
  apiKey: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const showFullKey = ref(false)

// ConfirmModal Estado
const showConfirmModal = ref(false)
const confirmModalConfig = ref({
  title: '',
  message: '',
  type: 'primary',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar'
})
const confirmResolve = ref(null)

const showConfirm = (
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'primary'
) => {
  return new Promise((resolve) => {
    confirmModalConfig.value = { title, message, confirmText, cancelText, type }
    confirmResolve.value = resolve
    showConfirmModal.value = true
  })
}
const handleConfirmModal = () => {
  showConfirmModal.value = false
  confirmResolve.value?.(true)
}
const handleCancelModal = () => {
  showConfirmModal.value = false
  confirmResolve.value?.(false)
}

// 获取 API Base URL anterior缀
const getBaseUrlPrefix = () => {
  // 优先使用环境变量配置自定义anterior缀
  const customPrefix = import.meta.env.VITE_API_BASE_PREFIX
  if (customPrefix) {
    // 去除末尾斜杠
    return customPrefix.replace(/\/$/, '')
  }

  // 否则使用当anterior浏览器访问地址
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol // http: o https:
    const host = window.location.host // 域名y端口
    // 提取协议y主机部分，去除路径
    let origin = protocol + '//' + host

    // 如果当anteriorURL包含路径，只取协议+主机部分
    const currentUrl = window.location.href
    const pathStart = currentUrl.indexOf('/', 8) // 跳过 http:// o https://
    if (pathStart !== -1) {
      origin = currentUrl.substring(0, pathStart)
    }

    return origin
  }

  // 服务端渲染oOtro情况回退
  return ''
}

// 计算完整 API Base URL
const currentBaseUrl = computed(() => {
  return getBaseUrlPrefix() + '/api'
})

// 切换Clave可见性
const toggleKeyVisibility = () => {
  showFullKey.value = !showFullKey.value
}

// 获取显示API Key
const getDisplayedApiKey = () => {
  const key = props.apiKey.apiKey || props.apiKey.key || ''
  if (!key) return ''

  if (showFullKey.value) {
    return key
  } else {
    // 显示anterior8 字符ysiguiente4 字符，en间用●代替
    if (key.length <= 12) return key
    return (
      key.substring(0, 8) + '●'.repeat(Math.max(0, key.length - 12)) + key.substring(key.length - 4)
    )
  }
}

// 通用Copiar工具，包含降级处理
const copyTextWithFallback = async (text, successMessage) => {
  try {
    await navigator.clipboard.writeText(text)
    showToast(successMessage, 'success')
  } catch (error) {
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      showToast(successMessage, 'success')
    } catch (fallbackError) {
      showToast('CopiarFallido，请手动Copiar', 'error')
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

// Copiar完整配置（包含SugerenciaInformación）
const copyFullConfig = async () => {
  const key = props.apiKey.apiKey || props.apiKey.key || ''
  if (!key) {
    showToast('API Key 不存en', 'error')
    return
  }

  // 构建环境变量配置格式
  const configText = `export ANTHROPIC_BASE_URL="${currentBaseUrl.value}"
export ANTHROPIC_AUTH_TOKEN="${key}"`

  await copyTextWithFallback(configText, '配置Información已Copiar到剪贴板')
}

// 仅CopiarClave
const copyKeyOnly = async () => {
  const key = props.apiKey.apiKey || props.apiKey.key || ''
  if (!key) {
    showToast('API Key 不存en', 'error')
    return
  }

  await copyTextWithFallback(key, 'API Key 已Copiar')
}

// Cerrar弹窗（带Confirmar）
const handleClose = async () => {
  const confirmed = await showConfirm(
    'Cerrar提醒',
    'Cerrarsiguiente将无法再vecesVer完整API Key，请确保已经妥善Guardar。\n\nConfirmar要Cerrar吗？',
    'ConfirmarCerrar',
    'Cancelar',
    'warning'
  )
  if (confirmed) {
    emit('close')
  }
}

// 直接Cerrar（不带Confirmar）
const handleDirectClose = async () => {
  const confirmed = await showConfirm(
    'Confirmar要Cerrar吗？',
    '您还没有GuardarAPI Key，Cerrarsiguiente将无法再vecesVer。\n\n建议您先CopiarAPI Key再Cerrar。',
    '仍然Cerrar',
    '返回Copiar',
    'warning'
  )
  if (confirmed) {
    emit('close')
  }
}
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
