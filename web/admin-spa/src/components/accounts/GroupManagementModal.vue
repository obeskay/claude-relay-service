<template>
  <Teleport to="body">
    <div v-if="show" class="modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        class="modal-content custom-scrollbar mx-auto max-h-[90vh] w-full max-w-4xl overflow-y-auto p-4 sm:p-6 md:p-8"
      >
        <div class="mb-4 flex items-center justify-between sm:mb-6">
          <div class="flex items-center gap-2 sm:gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 sm:h-10 sm:w-10 sm:rounded-xl"
            >
              <i class="fas fa-layer-group text-sm text-white sm:text-base" />
            </div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
  Administración de Grupos de Cuentas
            </h3>
          </div>
          <button
            class="p-1 text-gray-400 transition-colors hover:text-gray-600"
            @click="$emit('close')"
          >
            <i class="fas fa-times text-lg sm:text-xl" />
          </button>
        </div>

        <!-- Barra de cambio de pestaña -->
        <div class="mb-4 flex flex-wrap gap-2">
          <button
            v-for="tab in platformTabs"
            :key="tab.key"
            :class="[
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
              activeTab === tab.key
                ? tab.key === 'claude'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : tab.key === 'gemini'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : tab.key === 'droid'
                      ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            ]"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span class="ml-1 text-xs opacity-70">({{ platformCounts[tab.key] }})</span>
          </button>
        </div>

        <!-- 添加分组按钮 -->
        <div class="mb-6">
          <button class="btn btn-primary px-4 py-2" @click="openCreateForm">
            <i class="fas fa-plus mr-2" />
            Crear新分组
          </button>
        </div>

        <!-- 分组列表 -->
        <div class="space-y-4">
          <div v-if="loading" class="py-8 text-center">
            <div class="loading-spinner-lg mx-auto mb-4" />
            <p class="text-gray-500">Cargando...</p>
          </div>

          <div
            v-else-if="filteredGroups.length === 0"
            class="rounded-lg bg-gray-50 py-8 text-center dark:bg-gray-800"
          >
            <i class="fas fa-layer-group mb-4 text-4xl text-gray-300 dark:text-gray-600" />
            <p class="text-gray-500 dark:text-gray-400">No hay grupos</p>
          </div>

          <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              v-for="group in filteredGroups"
              :key="group.id"
              class="rounded-lg border bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div class="mb-3 flex items-start justify-between">
                <div class="flex-1">
                  <h4 class="font-semibold text-gray-900">
                    {{ group.name }}
                  </h4>
                  <p class="mt-1 text-sm text-gray-500">
                    {{ group.description || 'SinDescripción' }}
                  </p>
                </div>
                <div class="ml-4 flex items-center gap-2">
                  <span
                    :class="[
                      'rounded-full px-2 py-1 text-xs font-medium',
                      group.platform === 'claude'
                        ? 'bg-purple-100 text-purple-700'
                        : group.platform === 'gemini'
                          ? 'bg-blue-100 text-blue-700'
                          : group.platform === 'openai'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-cyan-100 text-cyan-700'
                    ]"
                  >
                    {{
                      group.platform === 'claude'
                        ? 'Claude'
                        : group.platform === 'gemini'
                          ? 'Gemini'
                          : group.platform === 'openai'
                            ? 'OpenAI'
                            : 'Droid'
                    }}
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-between text-sm text-gray-600">
                <div class="flex items-center gap-4">
                  <span>
                    <i class="fas fa-users mr-1" />
                    {{ group.memberCount || 0 }}  成员
                  </span>
                  <span>
                    <i class="fas fa-clock mr-1" />
                    {{ formatDate(group.createdAt) }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    class="text-blue-600 transition-colors hover:text-blue-800"
                    title="Editar"
                    @click="editGroup(group)"
                  >
                    <i class="fas fa-edit" />
                  </button>
                  <button
                    class="text-red-600 transition-colors hover:text-red-800"
                    :disabled="group.memberCount > 0"
                    title="Eliminar"
                    @click="deleteGroup(group)"
                  >
                    <i class="fas fa-trash" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Editar分组模态框 -->
    <div
      v-if="showEditForm"
      class="modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
    >
      <div class="modal-content w-full max-w-lg p-4 sm:p-6">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Editar分组</h3>
          <button class="text-gray-400 transition-colors hover:text-gray-600" @click="cancelEdit">
            <i class="fas fa-times" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">分组Nombre *</label>
            <input
              v-model="editForm.name"
              class="form-input w-full"
              placeholder="Entrada分组Nombre"
              type="text"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">PlataformaTipo</label>
            <div class="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
              {{
                editForm.platform === 'claude'
                  ? 'Claude'
                  : editForm.platform === 'gemini'
                    ? 'Gemini'
                    : 'OpenAI'
              }}
              <span class="ml-2 text-xs text-gray-500">(不可修改)</span>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Descripción (可选)</label>
            <textarea
              v-model="editForm.description"
              class="form-input w-full resize-none"
              placeholder="分组Descripción..."
              rows="2"
            />
          </div>

          <div class="flex gap-3 pt-4">
            <button
              class="btn btn-primary flex-1 px-4 py-2"
              :disabled="!editForm.name || updating"
              @click="updateGroup"
            >
              <div v-if="updating" class="loading-spinner mr-2" />
              {{ updating ? 'Actualizaren...' : 'Actualizar' }}
            </button>
            <button class="btn btn-secondary flex-1 px-4 py-2" @click="cancelEdit">Cancelar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Crear分组模态框 -->
    <div
      v-if="showCreateForm"
      class="modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
    >
      <div class="modal-content w-full max-w-lg p-4 sm:p-6">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Crear新分组</h3>
          <button
            class="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            @click="cancelCreate"
          >
            <i class="fas fa-times" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >分组Nombre *</label
            >
            <input
              v-model="createForm.name"
              class="form-input w-full"
              placeholder="Entrada分组Nombre"
              type="text"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >PlataformaTipo *</label
            >
            <div class="flex flex-wrap gap-4">
              <label class="flex cursor-pointer items-center">
                <input v-model="createForm.platform" class="mr-2" type="radio" value="claude" />
                <span class="text-sm text-gray-700 dark:text-gray-300">Claude</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input v-model="createForm.platform" class="mr-2" type="radio" value="gemini" />
                <span class="text-sm text-gray-700 dark:text-gray-300">Gemini</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input v-model="createForm.platform" class="mr-2" type="radio" value="openai" />
                <span class="text-sm text-gray-700 dark:text-gray-300">OpenAI</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input v-model="createForm.platform" class="mr-2" type="radio" value="droid" />
                <span class="text-sm text-gray-700 dark:text-gray-300">Droid</span>
              </label>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >Descripción (可选)</label
            >
            <textarea
              v-model="createForm.description"
              class="form-input w-full resize-none"
              placeholder="分组Descripción..."
              rows="2"
            />
          </div>

          <div class="flex gap-3 pt-4">
            <button
              class="btn btn-primary flex-1 px-4 py-2"
              :disabled="!createForm.name || !createForm.platform || creating"
              @click="createGroup"
            >
              <div v-if="creating" class="loading-spinner mr-2" />
              {{ creating ? 'Crearen...' : 'Crear' }}
            </button>
            <button class="btn btn-secondary flex-1 px-4 py-2" @click="cancelCreate">Cancelar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- EliminarConfirmar对话框 -->
    <ConfirmModal
      cancel-text="Cancelar"
      confirm-text="Confirmar eliminación"
      :message="`Confirmar要Eliminar分组 &quot;${deletingGroup?.name}&quot; 吗？此Operación不可撤销。`"
      :show="showDeleteConfirm"
      title="Confirmar eliminación"
      type="danger"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { showToast, formatDate } from '@/utils/tools'

import * as httpApis from '@/utils/http_apis'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const emit = defineEmits(['close', 'refresh'])

const show = ref(true)
const loading = ref(false)
const groups = ref([])

// Tab 切换
const activeTab = ref('all')
const platformTabs = [
  { key: 'all', label: '全部', color: 'gray' },
  { key: 'claude', label: 'Claude', color: 'purple' },
  { key: 'gemini', label: 'Gemini', color: 'blue' },
  { key: 'openai', label: 'OpenAI', color: 'gray' },
  { key: 'droid', label: 'Droid', color: 'cyan' }
]

// 各Plataforma分组数量
const platformCounts = computed(() => {
  const counts = { all: groups.value.length }
  platformTabs.slice(1).forEach((tab) => {
    counts[tab.key] = groups.value.filter((g) => g.platform === tab.key).length
  })
  return counts
})

// 过滤siguiente分组列表
const filteredGroups = computed(() => {
  if (activeTab.value === 'all') return groups.value
  return groups.value.filter((g) => g.platform === activeTab.value)
})

// EliminarConfirmar
const showDeleteConfirm = ref(false)
const deletingGroup = ref(null)

// Crear表单
const showCreateForm = ref(false)
const creating = ref(false)
const createForm = ref({
  name: '',
  platform: 'claude',
  description: ''
})

// Editar表单
const showEditForm = ref(false)
const updating = ref(false)
const editingGroup = ref(null)
const editForm = ref({
  name: '',
  platform: '',
  description: ''
})

// 格式化日期

// 加载分组列表
const loadGroups = async () => {
  loading.value = true
  try {
    const response = await httpApis.getAccountGroupsApi()
    groups.value = response.data || []
  } catch (error) {
    showToast('加载分组列表Fallido', 'error')
  } finally {
    loading.value = false
  }
}

// Crear分组
const createGroup = async () => {
  if (!createForm.value.name || !createForm.value.platform) {
    showToast('请填写必填项', 'error')
    return
  }

  creating.value = true
  try {
    await httpApis.createAccountGroupApi({
      name: createForm.value.name,
      platform: createForm.value.platform,
      description: createForm.value.description
    })

    showToast('分组Creado exitosamente', 'success')
    cancelCreate()
    await loadGroups()
    emit('refresh')
  } catch (error) {
    showToast(error.response?.data?.error || 'Crear分组Fallido', 'error')
  } finally {
    creating.value = false
  }
}

// 打开Crear表单（根据当anterior Tab 预选Plataforma）
const openCreateForm = () => {
  createForm.value.platform = activeTab.value !== 'all' ? activeTab.value : 'claude'
  showCreateForm.value = true
}

// CancelarCrear
const cancelCreate = () => {
  showCreateForm.value = false
  createForm.value = {
    name: '',
    platform: 'claude',
    description: ''
  }
}

// Editar分组
const editGroup = (group) => {
  editingGroup.value = group
  editForm.value = {
    name: group.name,
    platform: group.platform,
    description: group.description || ''
  }
  showEditForm.value = true
}

// Actualizar分组
const updateGroup = async () => {
  if (!editForm.value.name) {
    showToast('请填写分组Nombre', 'error')
    return
  }

  updating.value = true
  try {
    await httpApis.updateAccountGroupApi(editingGroup.value.id, {
      name: editForm.value.name,
      description: editForm.value.description
    })

    showToast('分组Actualizado exitosamente', 'success')
    cancelEdit()
    await loadGroups()
    emit('refresh')
  } catch (error) {
    showToast(error.response?.data?.error || 'Actualizar分组Fallido', 'error')
  } finally {
    updating.value = false
  }
}

// CancelarEditar
const cancelEdit = () => {
  showEditForm.value = false
  editingGroup.value = null
  editForm.value = {
    name: '',
    platform: '',
    description: ''
  }
}

// Eliminar分组 - 打开Confirmar对话框
const deleteGroup = (group) => {
  if (group.memberCount > 0) {
    showToast('分组内还有成员，无法Eliminar', 'error')
    return
  }
  deletingGroup.value = group
  showDeleteConfirm.value = true
}

// Confirmar eliminación
const confirmDelete = async () => {
  if (!deletingGroup.value) return
  try {
    await httpApis.deleteAccountGroupApi(deletingGroup.value.id)
    showToast('分组Eliminado exitosamente', 'success')
    cancelDelete()
    await loadGroups()
    emit('refresh')
  } catch (error) {
    showToast(error.response?.data?.error || 'Eliminar分组Fallido', 'error')
  }
}

// CancelarEliminar
const cancelDelete = () => {
  showDeleteConfirm.value = false
  deletingGroup.value = null
}

// 组件挂载时加载数据
onMounted(() => {
  loadGroups()
})
</script>
