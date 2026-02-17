<template>
  <Teleport to="body">
    <div v-if="show" class="modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        class="modal-content custom-scrollbar mx-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white/90 p-4 shadow-xl backdrop-blur-xl dark:bg-gray-800/95 dark:shadow-2xl sm:p-6 md:p-8"
      >
        <div class="mb-4 flex items-center justify-between sm:mb-6">
          <div class="flex items-center gap-2 sm:gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 sm:h-10 sm:w-10 sm:rounded-xl"
            >
              <i class="fas fa-code-branch text-sm text-white sm:text-base" />
            </div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
              {{ isEdit ? $t('accounts.form.edit_ccr') : $t('accounts.form.add_ccr') }}
            </h3>
          </div>
          <button
            class="p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            @click="$emit('close')"
          >
            <i class="fas fa-times text-lg sm:text-xl" />
          </button>
        </div>

        <div class="space-y-6">
          <!-- 基本Información -->
          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >{{ $t('label.name') }} *</label
            >
            <input
              v-model="form.name"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              :class="{ 'border-red-500': errors.name }"
              :placeholder="$t('accounts.form.name_placeholder')"
              required
              type="text"
            />
            <p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
          </div>

          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >{{ $t('label.description') }} ({{ $t('common.optional') }})</label
            >
            <textarea
              v-model="form.description"
              class="form-input w-full resize-none border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              :placeholder="$t('accounts.form.description_placeholder')"
              rows="3"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >API URL *</label
              >
              <input
                v-model="form.apiUrl"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                :class="{ 'border-red-500': errors.apiUrl }"
                :placeholder="$t('accounts.form.api_url_placeholder')"
                required
                type="text"
              />
              <p v-if="errors.apiUrl" class="mt-1 text-xs text-red-500">{{ errors.apiUrl }}</p>
            </div>
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >API Key {{ isEdit ? $t('accounts.form.api_key_edit_hint') : '*' }}</label
              >
              <input
                v-model="form.apiKey"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                :class="{ 'border-red-500': errors.apiKey }"
                :placeholder="
                  isEdit
                    ? $t('accounts.form.api_key_placeholder_edit')
                    : $t('accounts.form.api_key_placeholder')
                "
                :required="!isEdit"
                type="password"
              />
              <p v-if="errors.apiKey" class="mt-1 text-xs text-red-500">{{ errors.apiKey }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">{{
                $t('label.priority')
              }}</label>
              <input
                v-model.number="form.priority"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                max="100"
                min="1"
                :placeholder="$t('accounts.form.priority_placeholder')"
                type="number"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ $t('accounts.form.priority_hint') }}
              </p>
            </div>
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >{{ $t('accounts.form.user_agent') }} ({{ $t('common.optional') }})</label
              >
              <input
                v-model="form.userAgent"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                :placeholder="$t('accounts.form.user_agent_placeholder')"
                type="text"
              />
            </div>
          </div>

          <!-- 限流Configuración -->
          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">{{
              $t('accounts.form.rate_limit_mechanism')
            }}</label>
            <div class="mb-3">
              <label class="inline-flex cursor-pointer items-center">
                <input
                  v-model="enableRateLimit"
                  class="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">{{
                  $t('accounts.form.enable_rate_limit')
                }}</span>
              </label>
            </div>
            <div v-if="enableRateLimit">
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >{{ $t('accounts.form.rate_limit_duration') }} ({{ $t('time.minutes') }})</label
              >
              <input
                v-model.number="form.rateLimitDuration"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                min="1"
                :placeholder="$t('accounts.form.rate_limit_duration_placeholder')"
                type="number"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ $t('accounts.form.rate_limit_duration_hint') }}
              </p>
            </div>
          </div>

          <!-- 额度管理 -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >{{ $t('accounts.form.daily_quota') }} ({{ $t('unit.usd') }})</label
              >
              <input
                v-model.number="form.dailyQuota"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                min="0"
                :placeholder="$t('accounts.form.zero_unlimited')"
                step="0.01"
                type="number"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ $t('accounts.form.daily_quota_hint') }}
              </p>
            </div>
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">{{
                $t('accounts.form.quota_reset_time')
              }}</label>
              <input
                v-model="form.quotaResetTime"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                placeholder="00:00"
                type="time"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ $t('accounts.form.quota_reset_time_hint') }}
              </p>
            </div>
          </div>

          <!-- Modelo映射表（可选） -->
          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >{{ $t('accounts.form.model_mapping') }} ({{ $t('common.optional') }})</label
            >
            <div class="mb-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/30">
              <p class="text-xs text-blue-700 dark:text-blue-400">
                <i class="fas fa-info-circle mr-1" />
                {{ $t('accounts.form.model_mapping_hint') }}
              </p>
            </div>
            <div class="mb-3 space-y-2">
              <div
                v-for="(mapping, index) in modelMappings"
                :key="index"
                class="flex items-center gap-2"
              >
                <input
                  v-model="mapping.from"
                  class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :placeholder="$t('accounts.form.model_mapping_from')"
                  type="text"
                />
                <i class="fas fa-arrow-right text-gray-400 dark:text-gray-500" />
                <input
                  v-model="mapping.to"
                  class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :placeholder="$t('accounts.form.model_mapping_to')"
                  type="text"
                />
                <button
                  class="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                  type="button"
                  @click="removeModelMapping(index)"
                >
                  <i class="fas fa-trash" />
                </button>
              </div>
            </div>
            <button
              class="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300"
              type="button"
              @click="addModelMapping"
            >
              <i class="fas fa-plus mr-2" /> {{ $t('accounts.form.add_model_mapping') }}
            </button>
          </div>

          <!-- 代理配置 -->
          <div>
            <ProxyConfig v-model="form.proxy" />
          </div>

          <!-- Operación区 -->
          <div class="mt-2 flex gap-3">
            <button
              class="flex-1 rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              type="button"
              @click="$emit('close')"
            >
              {{ $t('action.cancel') }}
            </button>
            <button
              class="btn btn-primary flex-1 px-6 py-3 font-semibold"
              :disabled="loading"
              type="button"
              @click="submit"
            >
              <div v-if="loading" class="loading-spinner mr-2" />
              {{
                loading
                  ? isEdit
                    ? $t('status.saving')
                    : $t('status.creating')
                  : isEdit
                    ? $t('action.save')
                    : $t('action.create')
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { updateCcrAccountApi, createCcrAccountApi } from '@/utils/http_apis'
import { showToast } from '@/utils/tools'
import ProxyConfig from '@/components/accounts/ProxyConfig.vue'

const props = defineProps({
  account: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'success'])

const show = ref(true)
const isEdit = computed(() => !!props.account)
const loading = ref(false)

const form = ref({
  name: '',
  description: '',
  apiUrl: '',
  apiKey: '',
  priority: 50,
  userAgent: '',
  rateLimitDuration: 60,
  dailyQuota: 0,
  quotaResetTime: '00:00',
  proxy: null,
  supportedModels: {}
})

const enableRateLimit = ref(true)
const errors = ref({})

const modelMappings = ref([]) // [{from,to}]

const buildSupportedModels = () => {
  const map = {}
  for (const m of modelMappings.value) {
    const from = (m.from || '').trim()
    const to = (m.to || '').trim()
    if (from && to) map[from] = to
  }
  return map
}

const addModelMapping = () => {
  modelMappings.value.push({ from: '', to: '' })
}

const removeModelMapping = (index) => {
  modelMappings.value.splice(index, 1)
}

const validate = () => {
  const e = {}
  if (!form.value.name || form.value.name.trim().length === 0) e.name = 'Name cannot be empty'
  if (!form.value.apiUrl || form.value.apiUrl.trim().length === 0)
    e.apiUrl = 'API URL cannot be empty'
  if (!isEdit.value && (!form.value.apiKey || form.value.apiKey.trim().length === 0))
    e.apiKey = 'API Key cannot be empty'
  errors.value = e
  return Object.keys(e).length === 0
}

const submit = async () => {
  if (!validate()) return
  loading.value = true
  try {
    if (isEdit.value) {
      // Actualizar
      const updates = {
        name: form.value.name,
        description: form.value.description,
        apiUrl: form.value.apiUrl,
        priority: form.value.priority,
        userAgent: form.value.userAgent,
        rateLimitDuration: enableRateLimit.value ? Number(form.value.rateLimitDuration || 60) : 0,
        dailyQuota: Number(form.value.dailyQuota || 0),
        quotaResetTime: form.value.quotaResetTime || '00:00',
        proxy: form.value.proxy || null,
        supportedModels: buildSupportedModels()
      }
      if (form.value.apiKey && form.value.apiKey.trim().length > 0) {
        updates.apiKey = form.value.apiKey
      }
      const res = await updateCcrAccountApi(props.account.id, updates)
      if (res.success) {
        // 不en这里显示 toast，由父组件统一处理
        emit('success')
      } else {
        showToast(res.message || 'Error al guardar', 'error')
      }
    } else {
      // Crear
      const payload = {
        name: form.value.name,
        description: form.value.description,
        apiUrl: form.value.apiUrl,
        apiKey: form.value.apiKey,
        priority: Number(form.value.priority || 50),
        supportedModels: buildSupportedModels(),
        userAgent: form.value.userAgent,
        rateLimitDuration: enableRateLimit.value ? Number(form.value.rateLimitDuration || 60) : 0,
        proxy: form.value.proxy,
        accountType: 'shared',
        dailyQuota: Number(form.value.dailyQuota || 0),
        quotaResetTime: form.value.quotaResetTime || '00:00'
      }
      const res = await createCcrAccountApi(payload)
      if (res.success) {
        // 不en这里显示 toast，由父组件统一处理
        emit('success')
      } else {
        showToast(res.message || 'Error al crear', 'error')
      }
    }
  } catch (err) {
    showToast(err.message || 'SolicitudFallido', 'error')
  } finally {
    loading.value = false
  }
}

const populateFromAccount = () => {
  if (!props.account) return
  const a = props.account
  form.value.name = a.name || ''
  form.value.description = a.description || ''
  form.value.apiUrl = a.apiUrl || ''
  form.value.priority = Number(a.priority || 50)
  form.value.userAgent = a.userAgent || ''
  form.value.rateLimitDuration = Number(a.rateLimitDuration || 60)
  form.value.dailyQuota = Number(a.dailyQuota || 0)
  form.value.quotaResetTime = a.quotaResetTime || '00:00'
  form.value.proxy = a.proxy || null
  enableRateLimit.value = form.value.rateLimitDuration > 0

  // supportedModels 对象转para数组
  modelMappings.value = []
  const mapping = a.supportedModels || {}
  if (mapping && typeof mapping === 'object') {
    for (const k of Object.keys(mapping)) {
      modelMappings.value.push({ from: k, to: mapping[k] })
    }
  }
}

onMounted(() => {
  if (isEdit.value) populateFromAccount()
})

watch(
  () => props.account,
  () => {
    if (isEdit.value) populateFromAccount()
  }
)
</script>

<style scoped>
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #14b8a6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
