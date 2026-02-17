<template>
  <Teleport to="body">
    <div class="modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        class="modal-content mx-auto flex max-h-[90vh] w-full max-w-4xl flex-col p-4 sm:p-6 md:p-8"
      >
        <div class="mb-4 flex items-center justify-between sm:mb-6">
          <div class="flex items-center gap-2 sm:gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 sm:h-10 sm:w-10 sm:rounded-xl"
            >
              <i class="fas fa-edit text-sm text-white sm:text-base" />
            </div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
              Edición por lotes API Keys ({{ selectedCount }}  )
            </h3>
          </div>
          <button
            class="p-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            @click="$emit('close')"
          >
            <i class="fas fa-times text-lg sm:text-xl" />
          </button>
        </div>

        <form
          class="modal-scroll-content custom-scrollbar flex-1 space-y-4 sm:space-y-6"
          @submit.prevent="batchUpdateApiKeys"
        >
          <!-- Instrucciones文本 -->
          <div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <div class="flex items-start gap-3">
              <i class="fas fa-info-circle mt-1 text-blue-500" />
              <div>
                <p class="text-sm font-medium text-blue-800 dark:text-blue-300">Edición por lotesInstrucciones</p>
                <p class="mt-1 text-sm text-blue-700 dark:text-blue-400">
                  以abajoConfiguración将应用到所选 {{ selectedCount }}   API
                  Key。只有填写o修改字段才会被Actualizar，空白字段将保持原值不变。
                </p>
              </div>
            </div>
          </div>

          <!-- EtiquetaEditar -->
          <div>
            <label
              class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300 sm:mb-3 sm:text-sm"
            >
              Etiqueta (Operación por lotes)
            </label>
            <div class="space-y-4">
              <!-- EtiquetaOperación模式选择 -->
              <div class="flex flex-wrap gap-4">
                <label class="flex cursor-pointer items-center">
                  <input v-model="tagOperation" class="mr-2" type="radio" value="replace" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">替换Etiqueta</span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input v-model="tagOperation" class="mr-2" type="radio" value="add" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">添加Etiqueta</span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input v-model="tagOperation" class="mr-2" type="radio" value="remove" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">移除Etiqueta</span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input v-model="tagOperation" class="mr-2" type="radio" value="none" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">不修改Etiqueta</span>
                </label>
              </div>

              <!-- EtiquetaEditar区域 -->
              <div v-if="tagOperation !== 'none'" class="space-y-3">
                <!-- 已选择Etiqueta -->
                <div v-if="form.tags.length > 0">
                  <div class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                    {{
                      tagOperation === 'replace'
                        ? '新Etiqueta列表:'
                        : tagOperation === 'add'
                          ? '要添加Etiqueta:'
                          : '要移除Etiqueta:'
                    }}
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="(tag, index) in form.tags"
                      :key="'selected-' + index"
                      class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {{ tag }}
                      <button
                        class="ml-1 hover:text-blue-900"
                        type="button"
                        @click="removeTag(index)"
                      >
                        <i class="fas fa-times text-xs" />
                      </button>
                    </span>
                  </div>
                </div>

                <!-- 可选择已有Etiqueta -->
                <div v-if="unselectedTags.length > 0">
                  <div class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                    点击选择已有Etiqueta:
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="tag in unselectedTags"
                      :key="'available-' + tag"
                      class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-blue-100 hover:text-blue-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
                      type="button"
                      @click="selectTag(tag)"
                    >
                      <i class="fas fa-tag text-xs text-gray-500 dark:text-gray-400" />
                      {{ tag }}
                    </button>
                  </div>
                </div>

                <!-- Crear新Etiqueta -->
                <div>
                  <div class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                    Crear新Etiqueta:
                  </div>
                  <div class="flex gap-2">
                    <input
                      v-model="newTag"
                      class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                      placeholder="Ingrese nombre de nueva etiqueta"
                      type="text"
                      @keypress.enter.prevent="addTag"
                    />
                    <button
                      class="rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
                      type="button"
                      @click="addTag"
                    >
                      <i class="fas fa-plus" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 速率LímiteConfiguración -->
          <div
            class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20"
          >
            <div class="mb-2 flex items-center gap-2">
              <div
                class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-blue-500"
              >
                <i class="fas fa-tachometer-alt text-xs text-white" />
              </div>
              <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">速率LímiteConfiguración</h4>
            </div>

            <div class="space-y-2">
              <div class="grid grid-cols-1 gap-2 lg:grid-cols-3">
                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    时间窗口 (分钟)
                  </label>
                  <input
                    v-model="form.rateLimitWindow"
                    class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    min="1"
                    placeholder="不修改"
                    type="number"
                  />
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                    >Número de solicitudesLímite</label
                  >
                  <input
                    v-model="form.rateLimitRequests"
                    class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    min="1"
                    placeholder="不修改"
                    type="number"
                  />
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                    >CostoLimitar (美元)</label
                  >
                  <input
                    v-model="form.rateLimitCost"
                    class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    min="0"
                    placeholder="不修改"
                    step="0.01"
                    type="number"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Límite de costo diario -->
          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Límite de costo diario (美元)
            </label>
            <input
              v-model="form.dailyCostLimit"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              min="0"
              placeholder="不修改 (0 表示无Límite)"
              step="0.01"
              type="number"
            />
          </div>

          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Límite de costo total (美元)
            </label>
            <input
              v-model="form.totalCostLimit"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              min="0"
              placeholder="不修改 (0 表示无Límite)"
              step="0.01"
              type="number"
            />
          </div>

          <!-- Límite de costo semanal de modelos Claude -->
          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Límite de costo semanal de modelos Claude (美元)
            </label>
            <input
              v-model="form.weeklyOpusCostLimit"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              min="0"
              placeholder="不修改 (0 表示无Límite)"
              step="0.01"
              type="number"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Configuración Claude Modelo周CostoLímite（周一到周日），仅对 Claude ModeloSolicitud生效
            </p>
          </div>

          <!-- Límite de concurrencia -->
          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >Límite de concurrencia</label
            >
            <input
              v-model="form.concurrencyLimit"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              min="0"
              placeholder="不修改 (0 表示无Límite)"
              type="number"
            />
          </div>

          <!-- 激活Estado -->
          <div>
            <div class="mb-3 flex items-center gap-4">
              <label class="text-sm font-semibold text-gray-700 dark:text-gray-300">激活Estado</label>
              <div class="flex gap-4">
                <label class="flex cursor-pointer items-center">
                  <input v-model="form.isActive" class="mr-2" type="radio" :value="true" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">激活</span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input v-model="form.isActive" class="mr-2" type="radio" :value="false" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Deshabilitar</span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input v-model="form.isActive" class="mr-2" type="radio" :value="null" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">不修改</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 服务权限 -->
          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >服务权限</label
            >
            <div class="flex flex-wrap gap-4">
              <label class="flex cursor-pointer items-center">
                <input v-model="form.permissions" class="mr-2" type="radio" value="" />
                <span class="text-sm text-gray-700">不修改</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input v-model="form.permissions" class="mr-2" type="radio" value="all" />
                <span class="text-sm text-gray-700">Todos los servicios</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input v-model="form.permissions" class="mr-2" type="radio" value="claude" />
                <span class="text-sm text-gray-700">仅 Claude</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input v-model="form.permissions" class="mr-2" type="radio" value="gemini" />
                <span class="text-sm text-gray-700">仅 Gemini</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input v-model="form.permissions" class="mr-2" type="radio" value="openai" />
                <span class="text-sm text-gray-700">仅 OpenAI</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input v-model="form.permissions" class="mr-2" type="radio" value="droid" />
                <span class="text-sm text-gray-700">仅 Droid</span>
              </label>
            </div>
          </div>

          <!-- 专属账号绑定 -->
          <div>
            <div class="mb-3 flex items-center justify-between">
              <label class="text-sm font-semibold text-gray-700 dark:text-gray-300"
                >专属账号绑定</label
              >
              <button
                class="flex items-center gap-1 text-sm text-blue-600 transition-colors hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                :disabled="accountsLoading"
                title="Actualizar账号列表"
                type="button"
                @click="refreshAccounts"
              >
                <i
                  :class="[
                    'fas',
                    accountsLoading ? 'fa-spinner fa-spin' : 'fa-sync-alt',
                    'text-xs'
                  ]"
                />
                <span>{{ accountsLoading ? 'Actualizaren...' : 'Actualizar账号' }}</span>
              </button>
            </div>
            <div class="grid grid-cols-1 gap-3">
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >Claude 专属账号</label
                >
                <AccountSelector
                  v-model="claudeAccountSelectorValue"
                  :accounts="localAccounts.claude"
                  default-option-text="请选择Claude账号"
                  :disabled="!isServiceSelectable('claude')"
                  :groups="localAccounts.claudeGroups"
                  placeholder="请选择Claude账号"
                  platform="claude"
                  :special-options="accountSpecialOptions"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >Gemini 专属账号</label
                >
                <AccountSelector
                  v-model="geminiAccountSelectorValue"
                  :accounts="localAccounts.gemini"
                  default-option-text="请选择Gemini账号"
                  :disabled="!isServiceSelectable('gemini')"
                  :groups="localAccounts.geminiGroups"
                  placeholder="请选择Gemini账号"
                  platform="gemini"
                  :special-options="accountSpecialOptions"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >OpenAI 专属账号</label
                >
                <AccountSelector
                  v-model="openaiAccountSelectorValue"
                  :accounts="localAccounts.openai"
                  default-option-text="请选择OpenAI账号"
                  :disabled="!isServiceSelectable('openai')"
                  :groups="localAccounts.openaiGroups"
                  placeholder="请选择OpenAI账号"
                  platform="openai"
                  :special-options="accountSpecialOptions"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >Bedrock 专属账号</label
                >
                <AccountSelector
                  v-model="bedrockAccountSelectorValue"
                  :accounts="localAccounts.bedrock"
                  default-option-text="请选择Bedrock账号"
                  :disabled="!isServiceSelectable('openai')"
                  :groups="[]"
                  placeholder="请选择Bedrock账号"
                  platform="bedrock"
                  :special-options="accountSpecialOptions"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >Droid 专属账号</label
                >
                <AccountSelector
                  v-model="droidAccountSelectorValue"
                  :accounts="localAccounts.droid"
                  default-option-text="请选择Droid账号"
                  :disabled="!isServiceSelectable('droid')"
                  :groups="localAccounts.droidGroups"
                  placeholder="请选择Droid账号"
                  platform="droid"
                  :special-options="accountSpecialOptions"
                />
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button
              class="flex-1 rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              type="button"
              @click="$emit('close')"
            >
              Cancelar
            </button>
            <button
              class="btn btn-primary flex-1 px-6 py-3 font-semibold"
              :disabled="loading"
              type="submit"
            >
              <div v-if="loading" class="loading-spinner mr-2" />
              <i v-else class="fas fa-save mr-2" />
              {{ loading ? 'Guardaren...' : '批量Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { showToast } from '@/utils/tools'
import { useApiKeysStore } from '@/stores/apiKeys'
import * as httpApis from '@/utils/http_apis'
import AccountSelector from '@/components/common/AccountSelector.vue'

const props = defineProps({
  selectedKeys: {
    type: Array,
    required: true
  },
  accounts: {
    type: Object,
    default: () => ({
      claude: [],
      gemini: [],
      openai: [],
      openaiResponses: [],
      bedrock: [],
      droid: [],
      claudeGroups: [],
      geminiGroups: [],
      openaiGroups: [],
      droidGroups: []
    })
  }
})

const emit = defineEmits(['close', 'success'])

const apiKeysStore = useApiKeysStore()
const loading = ref(false)
const accountsLoading = ref(false)
const localAccounts = ref({
  claude: [],
  gemini: [],
  openai: [],
  bedrock: [],
  droid: [],
  claudeGroups: [],
  geminiGroups: [],
  openaiGroups: [],
  droidGroups: []
})

// Etiqueta相关
const newTag = ref('')
const availableTags = ref([])
const tagOperation = ref('none') // 'replace', 'add', 'remove', 'none'

const selectedCount = computed(() => props.selectedKeys.length)

// 计算未选择Etiqueta
const unselectedTags = computed(() => {
  return availableTags.value.filter((tag) => !form.tags.includes(tag))
})

// 表单数据
const form = reactive({
  rateLimitCost: '', // CostoLímite替代tokenLímite
  rateLimitWindow: '',
  rateLimitRequests: '',
  concurrencyLimit: '',
  dailyCostLimit: '',
  totalCostLimit: '',
  weeklyOpusCostLimit: '', // AgregarClaude周CostoLímite
  permissions: '', // 空字符串表示不修改
  claudeAccountId: '',
  geminiAccountId: '',
  openaiAccountId: '',
  bedrockAccountId: '',
  droidAccountId: '',
  tags: [],
  isActive: null // null表示不修改
})

const UNCHANGED_OPTION_VALUE = '__KEEP_ORIGINAL__'

const accountSpecialOptions = [
  { value: UNCHANGED_OPTION_VALUE, label: '不修改' },
  { value: 'SHARED_POOL', label: '使用共享账号池' }
]

const createAccountSelectorModel = (field) =>
  computed({
    get: () => (form[field] === '' ? UNCHANGED_OPTION_VALUE : form[field]),
    set: (value) => {
      if (!value || value === UNCHANGED_OPTION_VALUE) {
        form[field] = ''
      } else {
        form[field] = value
      }
    }
  })

const claudeAccountSelectorValue = createAccountSelectorModel('claudeAccountId')
const geminiAccountSelectorValue = createAccountSelectorModel('geminiAccountId')
const openaiAccountSelectorValue = createAccountSelectorModel('openaiAccountId')
const bedrockAccountSelectorValue = createAccountSelectorModel('bedrockAccountId')
const droidAccountSelectorValue = createAccountSelectorModel('droidAccountId')

const isServiceSelectable = (service) => {
  if (!form.permissions) return true
  if (form.permissions === 'all') return true
  if (Array.isArray(form.permissions) && form.permissions.length === 0) return true
  if (Array.isArray(form.permissions)) return form.permissions.includes(service)
  return form.permissions === service
}

// Gestión de etiquetas方法
const addTag = () => {
  if (newTag.value && newTag.value.trim()) {
    const tag = newTag.value.trim()
    if (!form.tags.includes(tag)) {
      form.tags.push(tag)
    }
    newTag.value = ''
  }
}

const selectTag = (tag) => {
  if (!form.tags.includes(tag)) {
    form.tags.push(tag)
  }
}

const removeTag = (index) => {
  form.tags.splice(index, 1)
}

// Actualizar账号列表
const refreshAccounts = async () => {
  accountsLoading.value = true
  try {
    const [
      claudeData,
      claudeConsoleData,
      geminiData,
      geminiApiData,
      openaiData,
      openaiResponsesData,
      bedrockData,
      droidData,
      groupsData
    ] = await Promise.all([
      httpApis.getClaudeAccountsApi(),
      httpApis.getClaudeConsoleAccountsApi(),
      httpApis.getGeminiAccountsApi(),
      httpApis.getGeminiApiAccountsApi(), // 获取 Gemini-API 账号
      httpApis.getOpenAIAccountsApi(),
      httpApis.getOpenAIResponsesAccountsApi(),
      httpApis.getBedrockAccountsApi(),
      httpApis.getDroidAccountsApi(),
      httpApis.getAccountGroupsApi()
    ])

    // 合并Claude OAuthCuentayClaude ConsoleCuenta
    const claudeAccounts = []

    if (claudeData.success) {
      claudeData.data?.forEach((account) => {
        claudeAccounts.push({
          ...account,
          platform: 'claude-oauth',
          isDedicated: account.accountType === 'dedicated'
        })
      })
    }

    if (claudeConsoleData.success) {
      claudeConsoleData.data?.forEach((account) => {
        claudeAccounts.push({
          ...account,
          platform: 'claude-console',
          isDedicated: account.accountType === 'dedicated'
        })
      })
    }

    localAccounts.value.claude = claudeAccounts

    // 合并 Gemini OAuth y Gemini API 账号
    const geminiAccounts = []

    if (geminiData.success) {
      ;(geminiData.data || []).forEach((account) => {
        geminiAccounts.push({
          ...account,
          platform: 'gemini',
          isDedicated: account.accountType === 'dedicated'
        })
      })
    }

    if (geminiApiData.success) {
      ;(geminiApiData.data || []).forEach((account) => {
        geminiAccounts.push({
          ...account,
          platform: 'gemini-api',
          isDedicated: account.accountType === 'dedicated'
        })
      })
    }

    localAccounts.value.gemini = geminiAccounts

    const openaiAccounts = []

    if (openaiData.success) {
      ;(openaiData.data || []).forEach((account) => {
        openaiAccounts.push({
          ...account,
          platform: 'openai',
          isDedicated: account.accountType === 'dedicated'
        })
      })
    }

    if (openaiResponsesData.success) {
      ;(openaiResponsesData.data || []).forEach((account) => {
        openaiAccounts.push({
          ...account,
          platform: 'openai-responses',
          isDedicated: account.accountType === 'dedicated'
        })
      })
    }

    localAccounts.value.openai = openaiAccounts

    if (bedrockData.success) {
      localAccounts.value.bedrock = (bedrockData.data || []).map((account) => ({
        ...account,
        isDedicated: account.accountType === 'dedicated'
      }))
    }

    if (droidData.success) {
      localAccounts.value.droid = (droidData.data || []).map((account) => ({
        ...account,
        platform: 'droid',
        isDedicated: account.accountType === 'dedicated'
      }))
    }

    // 处理分组数据
    if (groupsData.success) {
      const allGroups = groupsData.data || []
      localAccounts.value.claudeGroups = allGroups.filter((g) => g.platform === 'claude')
      localAccounts.value.geminiGroups = allGroups.filter((g) => g.platform === 'gemini')
      localAccounts.value.openaiGroups = allGroups.filter((g) => g.platform === 'openai')
      localAccounts.value.droidGroups = allGroups.filter((g) => g.platform === 'droid')
    }

    showToast('账号列表已Actualizar', 'success')
  } catch (error) {
    showToast('Actualizar账号列表Fallido', 'error')
  } finally {
    accountsLoading.value = false
  }
}

// 批量ActualizarAPI Keys
const batchUpdateApiKeys = async () => {
  loading.value = true

  try {
    // 准备Enviar数据
    const updates = {}

    // 只有非空值才添加到Actualizar对象en
    if (form.rateLimitCost !== '' && form.rateLimitCost !== null) {
      updates.rateLimitCost = parseFloat(form.rateLimitCost)
    }
    if (form.rateLimitWindow !== '' && form.rateLimitWindow !== null) {
      updates.rateLimitWindow = parseInt(form.rateLimitWindow)
    }
    if (form.rateLimitRequests !== '' && form.rateLimitRequests !== null) {
      updates.rateLimitRequests = parseInt(form.rateLimitRequests)
    }
    if (form.concurrencyLimit !== '' && form.concurrencyLimit !== null) {
      updates.concurrencyLimit = parseInt(form.concurrencyLimit)
    }
    if (form.dailyCostLimit !== '' && form.dailyCostLimit !== null) {
      updates.dailyCostLimit = parseFloat(form.dailyCostLimit)
    }
    if (form.totalCostLimit !== '' && form.totalCostLimit !== null) {
      updates.totalCostLimit = parseFloat(form.totalCostLimit)
    }
    if (form.weeklyOpusCostLimit !== '' && form.weeklyOpusCostLimit !== null) {
      updates.weeklyOpusCostLimit = parseFloat(form.weeklyOpusCostLimit)
    }

    // 权限Configuración
    if (form.permissions !== '') {
      updates.permissions = form.permissions
    }

    // Cuenta绑定
    if (form.claudeAccountId !== '') {
      if (form.claudeAccountId === 'SHARED_POOL') {
        updates.claudeAccountId = null
        updates.claudeConsoleAccountId = null
      } else if (form.claudeAccountId.startsWith('console:')) {
        updates.claudeConsoleAccountId = form.claudeAccountId.substring(8)
        updates.claudeAccountId = null
      } else if (!form.claudeAccountId.startsWith('group:')) {
        updates.claudeAccountId = form.claudeAccountId
        updates.claudeConsoleAccountId = null
      } else {
        updates.claudeAccountId = form.claudeAccountId
        updates.claudeConsoleAccountId = null
      }
    }

    if (form.geminiAccountId !== '') {
      if (form.geminiAccountId === 'SHARED_POOL') {
        updates.geminiAccountId = null
      } else {
        updates.geminiAccountId = form.geminiAccountId
      }
    }

    if (form.openaiAccountId !== '') {
      if (form.openaiAccountId === 'SHARED_POOL') {
        updates.openaiAccountId = null
      } else {
        updates.openaiAccountId = form.openaiAccountId
      }
    }

    if (form.bedrockAccountId !== '') {
      if (form.bedrockAccountId === 'SHARED_POOL') {
        updates.bedrockAccountId = null
      } else {
        updates.bedrockAccountId = form.bedrockAccountId
      }
    }

    if (form.droidAccountId !== '') {
      if (form.droidAccountId === 'SHARED_POOL') {
        updates.droidAccountId = null
      } else {
        updates.droidAccountId = form.droidAccountId
      }
    }

    // 激活Estado
    if (form.isActive !== null) {
      updates.isActive = form.isActive
    }

    // Etiqueta处理
    if (tagOperation.value !== 'none') {
      updates.tags = form.tags
      updates.tagOperation = tagOperation.value
    }

    const result = await httpApis.batchUpdateApiKeysApi({
      keyIds: props.selectedKeys,
      updates
    })

    if (result.success) {
      const { successCount, failedCount, errors } = result.data

      if (successCount > 0) {
        showToast(`ExitosoEdición por lotes ${successCount}   API Keys`, 'success')

        if (failedCount > 0) {
          const errorMessages = errors.map((e) => `${e.keyId}: ${e.error}`).join('\n')
          showToast(`${failedCount}  EditarFallido:\n${errorMessages}`, 'warning')
        }
      } else {
        showToast('所有 API Keys EditarFallido', 'error')
      }

      emit('success')
      emit('close')
    } else {
      showToast(result.message || 'Edición por lotesFallido', 'error')
    }
  } catch (error) {
    showToast('Edición por lotesFallido', 'error')
    console.error('Edición por lotes API Keys Fallido:', error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // 加载已存enEtiqueta
  availableTags.value = await apiKeysStore.fetchTags()

  // 初始化账号数据
  if (props.accounts) {
    // props.accounts.gemini 已经包含 OAuth y API 两种Tipo账号（父组件已合并）
    // 保留原有 platform 属性，不要覆盖
    const geminiAccounts = (props.accounts.gemini || []).map((account) => ({
      ...account,
      platform: account.platform || 'gemini' // 保留原有 platform，只en没有时设默认值
    }))

    // props.accounts.openai 只包含 openai Tipo，openaiResponses 需要单独处理
    const openaiAccounts = []
    if (props.accounts.openai) {
      props.accounts.openai.forEach((account) => {
        openaiAccounts.push({
          ...account,
          platform: account.platform || 'openai'
        })
      })
    }
    if (props.accounts.openaiResponses) {
      props.accounts.openaiResponses.forEach((account) => {
        openaiAccounts.push({
          ...account,
          platform: account.platform || 'openai-responses'
        })
      })
    }

    localAccounts.value = {
      claude: props.accounts.claude || [],
      gemini: geminiAccounts,
      openai: openaiAccounts,
      bedrock: props.accounts.bedrock || [],
      droid: (props.accounts.droid || []).map((account) => ({
        ...account,
        platform: account.platform || 'droid'
      })),
      claudeGroups: props.accounts.claudeGroups || [],
      geminiGroups: props.accounts.geminiGroups || [],
      openaiGroups: props.accounts.openaiGroups || [],
      droidGroups: props.accounts.droidGroups || []
    }
  }
})
</script>
