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
              class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg"
            >
              <i class="fas fa-clock" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Pruebas programadas</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ account?.name || 'Cuenta desconocida' }}
              </p>
            </div>
          </div>
          <button
            class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            :disabled="saving"
            @click="handleClose"
          >
            <i class="fas fa-times text-sm" />
          </button>
        </div>

        <!-- Área de contenido -->
        <div class="px-5 py-4">
          <!-- Estado de carga -->
          <div v-if="loading" class="flex items-center justify-center py-8">
            <i class="fas fa-spinner fa-spin mr-2 text-blue-500" />
            <span class="text-gray-500 dark:text-gray-400">Cargando configuración...</span>
          </div>

          <template v-else>
            <!-- Interruptor de activación -->
            <div class="mb-5 flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-700 dark:text-gray-300">Habilitar定时测试</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Probar conectividad de cuenta automáticamente según programación</p>
              </div>
              <button
                :class="[
                  'relative h-6 w-11 rounded-full transition-colors duration-200',
                  config.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                ]"
                @click="config.enabled = !config.enabled"
              >
                <span
                  :class="[
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200',
                    config.enabled ? 'left-5' : 'left-0.5'
                  ]"
                />
              </button>
            </div>

            <!-- Configuración de expresión Cron -->
            <div class="mb-5">
              <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Expresión Cron
              </label>
              <input
                v-model="config.cronExpression"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500"
                :disabled="!config.enabled"
                placeholder="0 8 * * *"
                type="text"
              />
              <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Formato: min hora día mes sem (ej: "0 8 * * *" = todos los días 8:00)
              </p>
            </div>

            <!-- Opciones rápidas -->
            <div class="mb-5">
              <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Configuración rápida
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in cronPresets"
                  :key="preset.value"
                  :class="[
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                    config.cronExpression === preset.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
                    !config.enabled && 'cursor-not-allowed opacity-50'
                  ]"
                  :disabled="!config.enabled"
                  @click="config.cronExpression = preset.value"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>

            <!-- Selección de modelo de prueba -->
            <div class="mb-5">
              <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Modelo de prueba
              </label>
              <input
                v-model="config.model"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500"
                :disabled="!config.enabled"
                placeholder="claude-sonnet-4-5-20250929"
                type="text"
              />
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="modelOption in modelOptions"
                  :key="modelOption.value"
                  :class="[
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                    config.model === modelOption.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
                    !config.enabled && 'cursor-not-allowed opacity-50'
                  ]"
                  :disabled="!config.enabled"
                  @click="config.model = modelOption.value"
                >
                  {{ modelOption.label }}
                </button>
              </div>
            </div>

            <!-- Historial de pruebas -->
            <div v-if="testHistory.length > 0" class="mb-4">
              <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Registros de prueba recientes
              </label>
              <div
                class="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
              >
                <div
                  v-for="(record, index) in testHistory"
                  :key="index"
                  class="flex items-center justify-between text-xs"
                >
                  <div class="flex items-center gap-2">
                    <i
                      :class="[
                        'fas',
                        record.success
                          ? 'fa-check-circle text-green-500'
                          : 'fa-times-circle text-red-500'
                      ]"
                    />
                    <span class="text-gray-600 dark:text-gray-400">
                      {{ formatTimestamp(record.timestamp) }}
                    </span>
                  </div>
                  <span v-if="record.latencyMs" class="text-gray-500 dark:text-gray-500">
                    {{ record.latencyMs }}ms
                  </span>
                  <span
                    v-else-if="record.error"
                    class="max-w-[150px] truncate text-red-500"
                    :title="record.error"
                  >
                    {{ record.error }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 无历史记录 -->
            <div
              v-else
              class="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
            >
              <i class="fas fa-history mb-2 text-2xl text-gray-300 dark:text-gray-600" />
              <p>Sin测试记录</p>
            </div>
          </template>
        </div>

        <!-- 底部Operación栏 -->
        <div
          class="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/80 px-5 py-3 dark:border-gray-800 dark:bg-gray-900/50"
        >
          <button
            class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            :disabled="saving"
            @click="handleClose"
          >
            Cancelar
          </button>
          <button
            :class="[
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition',
              saving
                ? 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 hover:shadow-md'
            ]"
            :disabled="saving || loading"
            @click="saveConfig"
          >
            <i :class="['fas', saving ? 'fa-spinner fa-spin' : 'fa-save']" />
            {{ saving ? 'Guardaren...' : 'Guardar配置' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { APP_CONFIG } from '@/utils/tools'
import { showToast } from '@/utils/tools'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  account: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'saved'])

// Estado
const loading = ref(false)
const saving = ref(false)
const config = ref({
  enabled: false,
  cronExpression: '0 8 * * *',
  model: 'claude-sonnet-4-5-20250929'
})
const testHistory = ref([])

// Cron 预设选项
const cronPresets = [
  { label: '每天 8:00', value: '0 8 * * *' },
  { label: '每天 12:00', value: '0 12 * * *' },
  { label: '每天 18:00', value: '0 18 * * *' },
  { label: '每6小时', value: '0 */6 * * *' },
  { label: '每12小时', value: '0 */12 * * *' },
  { label: '工作日 9:00', value: '0 9 * * 1-5' }
]

// Modelo选项
const modelOptions = [
  { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20250929' },
  { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
  { label: 'Claude Opus 4.5', value: 'claude-opus-4-5-20251101' }
]

// 格式化时间戳
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Desconocido'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 加载配置
async function loadConfig() {
  if (!props.account) return

  loading.value = true
  try {
    const authToken = localStorage.getItem('authToken')
    const platform = props.account.platform

    // 根据Plataforma获取配置端点
    let endpoint = ''
    if (platform === 'claude') {
      endpoint = `${APP_CONFIG.apiPrefix}/admin/claude-accounts/${props.account.id}/test-config`
    } else {
      // OtroPlataforma暂不支持
      loading.value = false
      return
    }

    // 获取配置
    const configRes = await fetch(endpoint, {
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : ''
      }
    })

    if (configRes.ok) {
      const data = await configRes.json()
      if (data.success && data.data?.config) {
        config.value = {
          enabled: data.data.config.enabled || false,
          cronExpression: data.data.config.cronExpression || '0 8 * * *',
          model: data.data.config.model || 'claude-sonnet-4-5-20250929'
        }
      }
    }

    // 获取测试历史
    const historyEndpoint = endpoint.replace('/test-config', '/test-history')
    const historyRes = await fetch(historyEndpoint, {
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : ''
      }
    })

    if (historyRes.ok) {
      const historyData = await historyRes.json()
      if (historyData.success && historyData.data?.history) {
        testHistory.value = historyData.data.history
      }
    }
  } catch (err) {
    showToast('加载配置Fallido: ' + err.message, 'error')
  } finally {
    loading.value = false
  }
}

// Guardar配置
async function saveConfig() {
  if (!props.account) return

  saving.value = true
  try {
    const authToken = localStorage.getItem('authToken')
    const platform = props.account.platform

    let endpoint = ''
    if (platform === 'claude') {
      endpoint = `${APP_CONFIG.apiPrefix}/admin/claude-accounts/${props.account.id}/test-config`
    } else {
      saving.value = false
      return
    }

    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken ? `Bearer ${authToken}` : ''
      },
      body: JSON.stringify({
        enabled: config.value.enabled,
        cronExpression: config.value.cronExpression,
        model: config.value.model
      })
    })

    if (res.ok) {
      showToast('配置已Guardar', 'success')
      emit('saved')
      handleClose()
    } else {
      const errorData = await res.json().catch(() => ({}))
      showToast(errorData.message || 'Error al guardar', 'error')
    }
  } catch (err) {
    showToast('Error al guardar: ' + err.message, 'error')
  } finally {
    saving.value = false
  }
}

// Cerrar模态框
function handleClose() {
  if (saving.value) return
  emit('close')
}

// 监听 show 变化，加载配置
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      config.value = {
        enabled: false,
        cronExpression: '0 8 * * *',
        model: 'claude-sonnet-4-5-20250929'
      }
      testHistory.value = []
      loadConfig()
    }
  }
)
</script>
