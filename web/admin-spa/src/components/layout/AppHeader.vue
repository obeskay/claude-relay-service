<template>
  <!-- 顶部导航 -->
  <div
    class="glass-strong mb-4 rounded-xl p-3 shadow-xl sm:mb-6 sm:rounded-2xl sm:p-4 md:mb-8 md:rounded-3xl md:p-6"
    style="z-index: 10; position: relative"
  >
    <div class="flex flex-col items-center justify-between gap-3 sm:flex-row sm:gap-4">
      <div
        class="flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-start sm:gap-3 md:gap-4"
      >
        <LogoTitle
          :loading="oemLoading"
          :logo-src="oemSettings.siteIconData || oemSettings.siteIcon"
          subtitle="Panel de Administración"
          :title="oemSettings.siteName"
          title-class="text-white dark:text-gray-100"
        >
          <template #after-title>
            <!-- 版本Información -->
            <div class="flex items-center gap-1 sm:gap-2">
              <span class="font-mono text-xs text-gray-400 dark:text-gray-500 sm:text-sm"
                >v{{ versionInfo.current || '...' }}</span
              >
              <!-- ActualizarSugerencia -->
              <a
                v-if="versionInfo.hasUpdate"
                class="inline-flex animate-pulse items-center gap-1 rounded-full border border-green-600 bg-green-500 px-2 py-0.5 text-xs text-white transition-colors hover:bg-green-600"
                :href="versionInfo.releaseInfo?.htmlUrl || '#'"
                target="_blank"
                title="Actualización disponible"
              >
                <i class="fas fa-arrow-up text-[10px]" />
                <span>Actualización</span>
              </a>
            </div>
          </template>
        </LogoTitle>
      </div>
      <!-- Tema切换yUsuario菜单 -->
      <div class="flex items-center gap-2 sm:gap-4">
        <!-- Tema切换按钮 -->
        <div class="flex items-center">
          <ThemeToggle mode="dropdown" />
        </div>

        <!-- 分隔线 -->
        <div
          class="h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent opacity-50 dark:via-gray-600"
        />

        <!-- Usuario菜单 -->
        <div class="user-menu-container relative">
          <button
            class="user-menu-button flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 sm:px-4 sm:py-2.5"
            @click="userMenuOpen = !userMenuOpen"
          >
            <i class="fas fa-user-circle text-sm sm:text-base" />
            <span class="hidden sm:inline">{{ currentUser.username || 'Admin' }}</span>
            <i
              class="fas fa-chevron-down ml-1 text-xs transition-transform duration-200"
              :class="{ 'rotate-180': userMenuOpen }"
            />
          </button>

          <!-- 悬浮菜单 -->
          <div
            v-if="userMenuOpen"
            class="user-menu-dropdown absolute right-0 top-full mt-2 w-48 rounded-xl border border-gray-200 bg-white py-2 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:w-56"
            style="z-index: 999999"
            @click.stop
          >
            <!-- 版本Información -->
            <div class="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500 dark:text-gray-400">Versión actual</span>
                <span class="font-mono text-gray-700 dark:text-gray-300"
                  >v{{ versionInfo.current || '...' }}</span
                >
              </div>
              <div v-if="versionInfo.hasUpdate" class="mt-2">
                <div class="mb-2 flex items-center justify-between text-sm">
                  <span class="font-medium text-green-600 dark:text-green-400">
                    <i class="fas fa-arrow-up mr-1" />Actualización disponible
                  </span>
                  <span class="font-mono text-green-600 dark:text-green-400"
                    >v{{ versionInfo.latest }}</span
                  >
                </div>
                <a
                  class="block w-full rounded-lg bg-green-500 px-3 py-1.5 text-center text-sm text-white transition-colors hover:bg-green-600"
                  :href="versionInfo.releaseInfo?.htmlUrl || '#'"
                  target="_blank"
                >
                  <i class="fas fa-external-link-alt mr-1" />Ver actualización
                </a>
              </div>
              <div
                v-else-if="versionInfo.checkingUpdate"
                class="mt-2 text-center text-xs text-gray-500 dark:text-gray-400"
              >
                <i class="fas fa-spinner fa-spin mr-1" />Buscando actualizaciones...
              </div>
              <div v-else class="mt-2 text-center">
                <!-- 已是最新版提醒 -->
                <transition mode="out-in" name="fade">
                  <div
                    v-if="versionInfo.noUpdateMessage"
                    key="message"
                    class="inline-block rounded-lg border border-green-200 bg-green-100 px-3 py-1.5 dark:border-green-800 dark:bg-green-900/30"
                  >
                    <p class="text-xs font-medium text-green-700 dark:text-green-400">
                      <i class="fas fa-check-circle mr-1" />当anterior已是最新版本
                    </p>
                  </div>
                  <button
                    v-else
                    key="button"
                    class="text-xs text-blue-500 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    @click="checkForUpdates()"
                  >
                    <i class="fas fa-sync-alt mr-1" />检查Actualizar
                  </button>
                </transition>
              </div>
            </div>

            <button
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="openChangePasswordModal"
            >
              <i class="fas fa-key text-blue-500" />
              <span>修改CuentaInformación</span>
            </button>

            <hr class="my-2 border-gray-200 dark:border-gray-700" />

            <button
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="logout"
            >
              <i class="fas fa-sign-out-alt text-red-500" />
              <span>退出Iniciar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 修改CuentaInformación模态框 -->
  <div
    v-if="showChangePasswordModal"
    class="modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
  >
    <div class="modal-content mx-auto flex max-h-[90vh] w-full max-w-md flex-col p-4 sm:p-6 md:p-8">
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600"
          >
            <i class="fas fa-key text-white" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">修改CuentaInformación</h3>
        </div>
        <button
          class="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
          @click="closeChangePasswordModal"
        >
          <i class="fas fa-times text-xl" />
        </button>
      </div>

      <form
        class="modal-scroll-content custom-scrollbar flex-1 space-y-6"
        @submit.prevent="changePassword"
      >
        <div>
          <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
            >当anteriorNombre de usuario</label
          >
          <input
            class="form-input w-full cursor-not-allowed bg-gray-100 dark:bg-gray-700 dark:text-gray-300"
            disabled
            type="text"
            :value="currentUser.username || 'Admin'"
          />
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            当anteriorNombre de usuario，Entrada新Nombre de usuario以修改
          </p>
        </div>

        <div>
          <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
            >新Nombre de usuario</label
          >
          <input
            v-model="changePasswordForm.newUsername"
            class="form-input w-full"
            placeholder="Entrada新Nombre de usuario（留空保持不变）"
            type="text"
          />
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">留空表示不修改Nombre de usuario</p>
        </div>

        <div>
          <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
            >当anteriorContraseña</label
          >
          <div class="relative">
            <input
              v-model="changePasswordForm.currentPassword"
              class="form-input w-full pr-10"
              placeholder="Ingrese当anteriorContraseña"
              required
              :type="showCurrentPassword ? 'text' : 'password'"
            />
            <button
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              type="button"
              @click="showCurrentPassword = !showCurrentPassword"
            >
              <i :class="showCurrentPassword ? 'fas fa-eye-slash' : 'fas fa-eye'" />
            </button>
          </div>
        </div>

        <div>
          <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
            >新Contraseña</label
          >
          <input
            v-model="changePasswordForm.newPassword"
            class="form-input w-full"
            placeholder="Ingrese新Contraseña"
            required
            type="password"
          />
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Contraseña长度a少8位</p>
        </div>

        <div>
          <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
            >Confirmar新Contraseña</label
          >
          <input
            v-model="changePasswordForm.confirmPassword"
            class="form-input w-full"
            placeholder="请再vecesEntrada新Contraseña"
            required
            type="password"
          />
        </div>

        <div class="flex gap-3 pt-4">
          <button
            class="flex-1 rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            type="button"
            @click="closeChangePasswordModal"
          >
            Cancelar
          </button>
          <button
            class="btn btn-primary flex-1 px-6 py-3 font-semibold"
            :disabled="changePasswordLoading"
            type="submit"
          >
            <div v-if="changePasswordLoading" class="loading-spinner mr-2" />
            <i v-else class="fas fa-save mr-2" />
            {{ changePasswordLoading ? 'Guardaren...' : 'Guardar修改' }}
          </button>
        </div>
      </form>
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
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { showToast } from '@/utils/tools'

import { checkUpdatesApi, changePasswordApi } from '@/utils/http_apis'
import LogoTitle from '@/components/common/LogoTitle.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const router = useRouter()
const authStore = useAuthStore()

// 当anteriorUsuarioInformación
const currentUser = computed(() => authStore.user || { username: 'Admin' })

// OEMConfiguración
const oemSettings = computed(() => authStore.oemSettings || {})
const oemLoading = computed(() => authStore.oemLoading)

// 版本Información
const versionInfo = ref({
  current: '...',
  latest: '',
  hasUpdate: false,
  checkingUpdate: false,
  lastChecked: null,
  releaseInfo: null,
  noUpdateMessage: false
})

// Usuario菜单Estado
const userMenuOpen = ref(false)

// 修改Contraseña模态框
const showChangePasswordModal = ref(false)
const changePasswordLoading = ref(false)
const showCurrentPassword = ref(false)
const changePasswordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  newUsername: ''
})

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

// 检查Actualizar（同时获取版本Información）
const checkForUpdates = async () => {
  if (versionInfo.value.checkingUpdate) {
    return
  }

  versionInfo.value.checkingUpdate = true

  try {
    const result = await checkUpdatesApi()

    if (result.success) {
      const data = result.data

      versionInfo.value.current = data.current
      versionInfo.value.latest = data.latest
      versionInfo.value.hasUpdate = data.hasUpdate
      versionInfo.value.releaseInfo = data.releaseInfo
      versionInfo.value.lastChecked = new Date()

      // Guardar到localStorage
      localStorage.setItem(
        'versionInfo',
        JSON.stringify({
          current: data.current,
          latest: data.latest,
          lastChecked: versionInfo.value.lastChecked,
          hasUpdate: data.hasUpdate,
          releaseInfo: data.releaseInfo
        })
      )

      // 如果没有Actualizar，显示提醒
      if (!data.hasUpdate) {
        versionInfo.value.noUpdateMessage = true
        // 3秒siguiente自动隐藏提醒
        setTimeout(() => {
          versionInfo.value.noUpdateMessage = false
        }, 3000)
      }
    }
  } catch (error) {
    console.error('Error checking for updates:', error)

    // 尝试delocalStorage读取Caché版本Información
    const cached = localStorage.getItem('versionInfo')
    if (cached) {
      const cachedInfo = JSON.parse(cached)
      versionInfo.value.current = cachedInfo.current || versionInfo.value.current
      versionInfo.value.latest = cachedInfo.latest
      versionInfo.value.hasUpdate = cachedInfo.hasUpdate
      versionInfo.value.releaseInfo = cachedInfo.releaseInfo
      versionInfo.value.lastChecked = new Date(cachedInfo.lastChecked)
    }
  } finally {
    versionInfo.value.checkingUpdate = false
  }
}

// 打开修改Contraseña弹窗
const openChangePasswordModal = () => {
  changePasswordForm.currentPassword = ''
  changePasswordForm.newPassword = ''
  changePasswordForm.confirmPassword = ''
  changePasswordForm.newUsername = ''
  showChangePasswordModal.value = true
  userMenuOpen.value = false
}

// Cerrar修改Contraseña弹窗
const closeChangePasswordModal = () => {
  showChangePasswordModal.value = false
}

// 修改Contraseña
const changePassword = async () => {
  if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
    showToast('两vecesEntradaContraseña不一致', 'error')
    return
  }

  if (changePasswordForm.newPassword.length < 8) {
    showToast('新Contraseña长度a少8位', 'error')
    return
  }

  changePasswordLoading.value = true

  try {
    const data = await changePasswordApi({
      currentPassword: changePasswordForm.currentPassword,
      newPassword: changePasswordForm.newPassword,
      newUsername: changePasswordForm.newUsername || undefined
    })

    if (data.success) {
      const message = changePasswordForm.newUsername
        ? 'CuentaInformación修改Exitoso，请重新Iniciar sesión'
        : 'Contraseña修改Exitoso，请重新Iniciar sesión'
      showToast(message, 'success')
      closeChangePasswordModal()

      // 延迟siguiente退出Iniciar sesión
      setTimeout(() => {
        authStore.logout()
        router.push('/login')
      }, 1500)
    } else {
      showToast(data.message || '修改Fallido', 'error')
    }
  } catch (error) {
    showToast('修改ContraseñaFallido', 'error')
  } finally {
    changePasswordLoading.value = false
  }
}

// 退出Iniciar sesión
const logout = async () => {
  const confirmed = await showConfirm(
    '退出Iniciar sesión',
    'Confirmar要退出Iniciar sesión吗？',
    'Confirmar退出',
    'Cancelar',
    'warning'
  )
  if (confirmed) {
    authStore.logout()
    router.push('/login')
    showToast('已安全退出', 'success')
  }
  userMenuOpen.value = false
}

// 点击外部Cerrar菜单
const handleClickOutside = (event) => {
  const userMenuContainer = event.target.closest('.user-menu-container')
  if (!userMenuContainer && userMenuOpen.value) {
    userMenuOpen.value = false
  }
}

onMounted(() => {
  checkForUpdates()

  // Configuración自动检查Actualizar（每小时检查一veces）
  setInterval(() => {
    checkForUpdates()
  }, 3600000) // 1小时

  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Usuario菜单按钮样式 */
.user-menu-button {
  position: relative;
  overflow: hidden;
  min-height: 38px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
}

.user-menu-button:hover {
  box-shadow: 0 6px 16px rgba(var(--primary-rgb), 0.4);
}

/* 添加光泽效果 */
.user-menu-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.user-menu-button:hover::before {
  left: 100%;
}

/* Usuario菜单样式优化 */
.user-menu-dropdown {
  margin-top: 8px;
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

/* fade过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
