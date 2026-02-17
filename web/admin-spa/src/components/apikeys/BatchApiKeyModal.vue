<template>
  <Teleport to="body">
    <div class="modal fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        class="modal-content custom-scrollbar mx-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto p-8"
      >
        <div class="mb-6 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600"
            >
              <i class="fas fa-layer-group text-lg text-white" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900">Creación masiva exitosa</h3>
              <p class="text-sm text-gray-600">Se crearon {{ apiKeys.length }} API Key(s) exitosamente</p>
            </div>
          </div>
          <button
            class="text-gray-400 transition-colors hover:text-gray-600"
            title="Cerrar directamente (no recomendado)"
            @click="handleDirectClose"
          >
            <i class="fas fa-times text-xl" />
          </button>
        </div>

        <!-- Advertencia -->
        <div class="mb-6 border-l-4 border-amber-400 bg-amber-50 p-4">
          <div class="flex items-start">
            <div
              class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-amber-400"
            >
              <i class="fas fa-exclamation-triangle text-sm text-white" />
            </div>
            <div class="ml-3">
              <h5 class="mb-1 font-semibold text-amber-900">Importante</h5>
              <p class="text-sm text-amber-800">
                Esta es tu única oportunidad de ver todas las API Keys. Después de cerrar esta ventana,
                el sistema ya no mostrará las API Keys completas. Por favor, descarga y guarda
                de manera inmediata y segura.
              </p>
            </div>
          </div>
        </div>

        <!-- EstadísticasInformación -->
        <div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div
            class="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-blue-600">Cantidad creada</p>
                <p class="mt-1 text-2xl font-bold text-blue-900">
                  {{ apiKeys.length }}
                </p>
              </div>
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 bg-opacity-20"
              >
                <i class="fas fa-key text-blue-600" />
              </div>
            </div>
          </div>

          <div
            class="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-green-600">Nombre base</p>
                <p class="mt-1 truncate text-lg font-bold text-green-900">
                  {{ baseName }}
                </p>
              </div>
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500 bg-opacity-20"
              >
                <i class="fas fa-tag text-green-600" />
              </div>
            </div>
          </div>

          <div
            class="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 p-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-purple-600">Permisos</p>
                <p class="mt-1 text-lg font-bold text-purple-900">
                  {{ getPermissionText() }}
                </p>
              </div>
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500 bg-opacity-20"
              >
                <i class="fas fa-shield-alt text-purple-600" />
              </div>
            </div>
          </div>

          <div
            class="rounded-lg border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 p-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-orange-600">过期时间</p>
                <p class="mt-1 text-lg font-bold text-orange-900">
                  {{ getExpiryText() }}
                </p>
              </div>
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 bg-opacity-20"
              >
                <i class="fas fa-clock text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <!-- API Keys Vista previa -->
        <div class="mb-6">
          <div class="mb-3 flex items-center justify-between">
            <label class="text-sm font-semibold text-gray-700">API Keys Vista previa</label>
            <div class="flex items-center gap-2">
              <button
                class="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                type="button"
                @click="togglePreview"
              >
                <i :class="['fas', showPreview ? 'fa-eye-slash' : 'fa-eye']" />
                {{ showPreview ? '隐藏' : '显示' }}Vista previa
              </button>
              <span class="text-xs text-gray-500">（最多显示anterior10 ）</span>
            </div>
          </div>

          <div
            v-if="showPreview"
            class="custom-scrollbar max-h-48 overflow-y-auto rounded-lg bg-gray-900 p-4"
          >
            <pre class="font-mono text-xs text-gray-300">{{ getPreviewText() }}</pre>
          </div>
        </div>

        <!-- Operación按钮 -->
        <div class="flex gap-3">
          <button
            class="btn btn-primary flex flex-1 items-center justify-center gap-2 px-6 py-3 font-semibold"
            @click="downloadApiKeys"
          >
            <i class="fas fa-download" />
            Descargar所有 API Keys
          </button>
          <button
            class="rounded-xl border border-gray-300 bg-gray-200 px-6 py-3 font-semibold text-gray-800 transition-colors hover:bg-gray-300"
            @click="handleClose"
          >
            我已Guardar
          </button>
        </div>

        <!-- 额外Sugerencia -->
        <div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p class="flex items-start text-xs text-blue-700">
            <i class="fas fa-info-circle mr-2 mt-0.5 flex-shrink-0" />
            <span>
              Descargar文件格式para文本文件（.txt），每行包含一  API Key。
              请将文件Guardaren安全位置，避免泄露。
            </span>
          </p>
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
  apiKeys: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close'])

const showPreview = ref(false)

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

// 获取基础Nombre
const baseName = computed(() => {
  if (props.apiKeys.length > 0) {
    const firstKey = props.apiKeys[0]
    // 提取基础Nombre（去掉 _1, _2 等siguiente缀）
    const match = firstKey.name.match(/^(.+)_\d+$/)
    return match ? match[1] : firstKey.name
  }
  return ''
})

// 获取权限文本
const getPermissionText = () => {
  if (props.apiKeys.length === 0) return 'Desconocido'
  const permissions = props.apiKeys[0].permissions
  const permissionMap = {
    all: 'Todos los servicios',
    claude: '仅 Claude',
    gemini: '仅 Gemini'
  }
  return permissionMap[permissions] || permissions
}

// 获取过期时间文本
const getExpiryText = () => {
  if (props.apiKeys.length === 0) return 'Desconocido'
  const expiresAt = props.apiKeys[0].expiresAt
  if (!expiresAt) return '永不过期'

  const expiryDate = new Date(expiresAt)
  const now = new Date()
  const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))

  if (diffDays <= 7) return `${diffDays}天`
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)}周`
  if (diffDays <= 365) return `${Math.ceil(diffDays / 30)} 月`
  return `${Math.ceil(diffDays / 365)}年`
}

// 切换Vista previa显示
const togglePreview = () => {
  showPreview.value = !showPreview.value
}

// 获取Vista previa文本
const getPreviewText = () => {
  const previewKeys = props.apiKeys.slice(0, 10)
  const lines = previewKeys.map((key) => {
    return `${key.name}: ${key.apiKey || key.key || ''}`
  })

  if (props.apiKeys.length > 10) {
    lines.push(`... 还有 ${props.apiKeys.length - 10}   API Key`)
  }

  return lines.join('\n')
}

// Descargar API Keys
const downloadApiKeys = () => {
  // 生成文件内容
  const content = props.apiKeys
    .map((key) => {
      return `${key.name}: ${key.apiKey || key.key || ''}`
    })
    .join('\n')

  // Crear Blob 对象
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })

  // CrearDescargar链接
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url

  // 生成文件名（包含时间戳）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  link.download = `api-keys-${baseName.value}-${timestamp}.txt`

  // 触发Descargar
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // 释放 URL 对象
  URL.revokeObjectURL(url)

  showToast('API Keys 文件已Descargar', 'success')
}

// Cerrar弹窗（带Confirmar）
const handleClose = async () => {
  const confirmed = await showConfirm(
    'Cerrar提醒',
    'Cerrarsiguiente将无法再vecesVer这些 API Key，请确保已经Descargar并妥善Guardar。\n\nConfirmar要Cerrar吗？',
    'ConfirmarCerrar',
    '返回Descargar',
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
    '您还没有Descargar API Keys，Cerrarsiguiente将无法再vecesVer。\n\n强烈建议您先DescargarGuardar。',
    '仍然Cerrar',
    '返回Descargar',
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
