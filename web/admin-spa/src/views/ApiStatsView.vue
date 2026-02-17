<template>
  <div
    class="min-h-screen p-2 sm:p-4 md:p-6"
    :class="isDarkMode ? 'gradient-bg-dark' : 'gradient-bg'"
  >
    <!-- Navegación superior -->
    <div
      class="glass-strong mb-4 rounded-2xl p-3 shadow-xl sm:mb-6 sm:rounded-3xl sm:p-4 md:mb-8 md:p-6"
    >
      <div class="flex flex-col items-center justify-between gap-3 sm:gap-4 md:flex-row">
        <LogoTitle
          :loading="oemLoading"
          :logo-src="oemSettings.siteIconData || oemSettings.siteIcon"
          :subtitle="
            currentTab === 'stats'
              ? 'Estadísticas de API Key'
              : currentTab === 'quota'
                ? 'Tarjetas de Cuota'
                : 'Tutoriales de Uso'
          "
          :title="oemSettings.siteName"
        />
        <div class="flex items-center gap-2 md:gap-4">
          <!-- Botón de cambio de tema -->
          <div class="flex items-center">
            <ThemeToggle mode="dropdown" />
          </div>

          <!-- Línea divisoria -->
          <div
            v-if="oemSettings.ldapEnabled || oemSettings.showAdminButton !== false"
            class="h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent opacity-50 dark:via-gray-600"
          />

          <!-- Botón de inicio de sesión de usuario (se muestra solo cuando LDAP está habilitado) -->
          <router-link
            v-if="oemSettings.ldapEnabled"
            class="user-login-button flex items-center gap-2 rounded-2xl px-4 py-2 text-white transition-all duration-300 md:px-5 md:py-2.5"
            to="/user-login"
          >
            <i class="fas fa-user text-sm md:text-base" />
            <span class="text-xs font-semibold tracking-wide md:text-sm">Iniciar Sesión</span>
          </router-link>
          <!-- Botón del panel de administración -->
          <router-link
            v-if="oemSettings.showAdminButton !== false"
            class="admin-button-refined flex items-center gap-2 rounded-2xl px-4 py-2 transition-all duration-300 md:px-5 md:py-2.5"
            to="/dashboard"
          >
            <i class="fas fa-shield-alt text-sm md:text-base" />
            <span class="text-xs font-semibold tracking-wide md:text-sm">Panel de Administración</span>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Cambio de pestañas -->
    <div class="mb-4 sm:mb-6 md:mb-8">
      <div class="flex justify-center">
        <div
          class="inline-flex w-full max-w-2xl flex-wrap justify-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 shadow-lg backdrop-blur-xl sm:w-auto sm:flex-nowrap"
        >
          <button
            :class="['tab-pill-button', currentTab === 'stats' ? 'active' : '']"
            @click="currentTab = 'stats'"
          >
            <i class="fas fa-chart-line mr-1 md:mr-2" />
            <span class="text-sm md:text-base">Consulta de Estadísticas</span>
          </button>
          <button
            :class="['tab-pill-button', currentTab === 'quota' ? 'active' : '']"
            @click="switchToQuota"
          >
            <i class="fas fa-ticket-alt mr-1 md:mr-2" />
            <span class="text-sm md:text-base">Tarjetas de Cuota</span>
          </button>
          <button
            :class="['tab-pill-button', currentTab === 'tutorial' ? 'active' : '']"
            @click="currentTab = 'tutorial'"
          >
            <i class="fas fa-graduation-cap mr-1 md:mr-2" />
            <span class="text-sm md:text-base">Tutoriales de Uso</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Contenido de estadísticas -->
    <div v-if="currentTab === 'stats'" class="tab-content">
      <!-- Área de entrada de API Key -->
      <ApiKeyInput />

      <!-- Mensaje de error -->
      <div v-if="error" class="mb-4 sm:mb-6 md:mb-8">
        <div
          class="rounded-xl border border-red-500/30 bg-red-500/20 p-3 text-sm text-red-800 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200 md:p-4 md:text-base"
        >
          <i class="fas fa-exclamation-triangle mr-2" />
          {{ error }}
        </div>
      </div>

      <!-- Área de visualización de datos estadísticos -->
      <div v-if="statsData" class="fade-in">
        <div class="glass-strong rounded-2xl p-3 shadow-xl sm:rounded-3xl sm:p-4 md:p-6">
          <!-- Selector de rango de tiempo -->
          <div
            class="mb-3 border-b border-gray-200 pb-3 dark:border-gray-700 sm:mb-4 sm:pb-4 md:mb-6 md:pb-6"
          >
            <div
              class="flex flex-col items-start justify-between gap-2 sm:gap-3 md:flex-row md:items-center md:gap-4"
            >
              <div class="flex items-center gap-2 md:gap-3">
                <i class="fas fa-clock text-base text-blue-500 md:text-lg" />
                <span class="text-base font-medium text-gray-700 dark:text-gray-200 md:text-lg"
                  >Rango de tiempo estadístico</span
                >
              </div>
              <div class="flex w-full items-center gap-2 md:w-auto">
                <button
                  class="flex flex-1 items-center justify-center gap-1 px-4 py-2 text-xs font-medium md:flex-none md:gap-2 md:px-6 md:text-sm"
                  :class="['period-btn', { active: statsPeriod === 'daily' }]"
                  :disabled="loading"
                  @click="switchPeriod('daily')"
                >
                  <i class="fas fa-calendar-day text-xs md:text-sm" />
                  Hoy
                </button>
                <button
                  class="flex flex-1 items-center justify-center gap-1 px-4 py-2 text-xs font-medium md:flex-none md:gap-2 md:px-6 md:text-sm"
                  :class="['period-btn', { active: statsPeriod === 'monthly' }]"
                  :disabled="loading"
                  @click="switchPeriod('monthly')"
                >
                  <i class="fas fa-calendar-alt text-xs md:text-sm" />
                  Este Mes
                </button>
                <button
                  class="flex flex-1 items-center justify-center gap-1 px-4 py-2 text-xs font-medium md:flex-none md:gap-2 md:px-6 md:text-sm"
                  :class="['period-btn', { active: statsPeriod === 'alltime' }]"
                  :disabled="loading"
                  @click="switchPeriod('alltime')"
                >
                  <i class="fas fa-infinity text-xs md:text-sm" />
                  Todo
                </button>
                <!-- Menú desplegable del botón de prueba - se muestra solo en modo de clave única -->
                <div v-if="!multiKeyMode" class="relative">
                  <button
                    :class="[
                      'test-btn flex items-center justify-center gap-1 px-4 py-2 text-xs font-medium md:gap-2 md:px-6 md:text-sm',
                      !hasAnyTestPermission ? 'cursor-not-allowed opacity-50' : ''
                    ]"
                    :disabled="loading || !hasAnyTestPermission"
                    :title="
                      hasAnyTestPermission
                        ? 'Probar API'
                        : `Servicios disponibles de esta Key: ${availableServicesText}`
                    "
                    @click="toggleTestMenu"
                  >
                    <i class="fas fa-vial text-xs md:text-sm" />
                    Probar
                    <i class="fas fa-chevron-down ml-1 text-xs" />
                  </button>
                  <!-- Menú desplegable -->
                  <div
                    v-if="showTestMenu"
                    class="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                  >
                    <button
                      v-if="canTestClaude"
                      class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      @click="openTestModal('claude')"
                    >
                      <i class="fas fa-robot text-orange-500" />
                      Claude
                    </button>
                    <button
                      v-if="canTestGemini"
                      class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      @click="openTestModal('gemini')"
                    >
                      <i class="fas fa-gem text-blue-500" />
                      Gemini
                    </button>
                    <button
                      v-if="canTestOpenAI"
                      class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      @click="openTestModal('openai')"
                    >
                      <i class="fas fa-code text-green-500" />
                      Codex
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Resumen de información básica y estadísticas -->
          <StatsOverview />

          <!-- Distribución de Token y configuración de límites -->
          <div
            class="mb-4 mt-4 grid grid-cols-1 gap-3 sm:mb-6 sm:mt-6 sm:gap-4 md:mb-8 md:mt-8 md:gap-6 xl:grid-cols-2 xl:items-stretch"
          >
            <TokenDistribution class="h-full" />
            <template v-if="multiKeyMode">
              <AggregatedStatsCard class="h-full" />
            </template>
            <template v-else>
              <LimitConfig class="h-full" />
            </template>
          </div>

          <!-- Tarjetas de estadísticas de costos de servicios -->
          <ServiceCostCards class="mb-4 sm:mb-6" />

          <!-- Estadísticas de uso de modelos - tres períodos de tiempo -->
          <div class="space-y-4 sm:space-y-6">
            <ModelUsageStats period="daily" />
            <ModelUsageStats period="monthly" />
            <ModelUsageStats period="alltime" />
          </div>
        </div>
      </div>
    </div>

    <!-- Contenido del tutorial -->
    <div v-if="currentTab === 'tutorial'" class="tab-content">
      <div class="glass-strong rounded-3xl shadow-xl">
        <TutorialView />
      </div>
    </div>

    <!-- Contenido de tarjetas de cuota (con pestañas secundarias) -->
    <div v-if="currentTab === 'quota'" class="tab-content">
      <div class="glass-strong rounded-2xl p-4 shadow-xl sm:rounded-3xl sm:p-6 md:p-8">
        <!-- Pestañas secundarias -->
        <div
          class="mb-4 flex gap-2 border-b border-gray-200 pb-4 dark:border-gray-700 md:mb-6 md:pb-6"
        >
          <button
            :class="[
              'rounded-lg px-4 py-2 text-sm font-medium transition-all',
              quotaSubTab === 'redeem'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            ]"
            @click="quotaSubTab = 'redeem'"
          >
            <i class="fas fa-ticket-alt mr-2" />
            Canjear Tarjeta de Cuota
          </button>
          <button
            :class="[
              'rounded-lg px-4 py-2 text-sm font-medium transition-all',
              quotaSubTab === 'history'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            ]"
            @click="switchToHistorySubTab"
          >
            <i class="fas fa-history mr-2" />
            Historial de Canjes
          </button>
        </div>

        <!-- Subcontenido de canje de tarjeta de cuota -->
        <div v-if="quotaSubTab === 'redeem'">
          <!-- Necesita ingresar API Key primero -->
          <div v-if="!apiId" class="py-8 text-center">
            <div class="mb-4 text-gray-500 dark:text-gray-400">
              <i class="fas fa-key mb-4 block text-4xl opacity-50" />
              <p>Primero ingrese su API Key en la página de "Consulta de Estadísticas"</p>
            </div>
            <button
              class="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-2.5 font-medium text-white transition-all hover:from-blue-600 hover:to-cyan-600"
              @click="currentTab = 'stats'"
            >
              Ir a Ingresar API Key
            </button>
          </div>

          <!-- Formulario de canje -->
          <div v-else>
            <div class="mb-6 rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20">
              <p class="text-sm text-blue-700 dark:text-blue-300">
                <i class="fas fa-info-circle mr-2" />
                API Key actual: <span class="font-medium">{{ statsData?.name || apiId }}</span>
              </p>
            </div>

            <div class="space-y-4">
              <div>
                <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Número de Tarjeta de Cuota
                </label>
                <input
                  v-model="redeemCode"
                  class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
                  placeholder="Ingrese el número de tarjeta de cuota"
                  type="text"
                  @keyup.enter="handleRedeem"
                />
              </div>

              <button
                class="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-3 font-medium text-white transition-all hover:from-green-600 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!redeemCode.trim() || redeemLoading"
                @click="handleRedeem"
              >
                <i v-if="redeemLoading" class="fas fa-spinner fa-spin mr-2" />
                <i v-else class="fas fa-check-circle mr-2" />
                {{ redeemLoading ? 'Canjeando...' : 'Canjear Ahora' }}
              </button>
            </div>

            <!-- Resultado del canje -->
            <div v-if="redeemResult" class="mt-6">
              <div
                :class="[
                  'rounded-xl p-4',
                  redeemResult.success
                    ? redeemResult.hasWarnings
                      ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                      : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                ]"
              >
                <div class="flex items-start gap-3">
                  <i
                    :class="[
                      'mt-0.5 text-lg',
                      redeemResult.success
                        ? redeemResult.hasWarnings
                          ? 'fas fa-exclamation-triangle'
                          : 'fas fa-check-circle'
                        : 'fas fa-times-circle'
                    ]"
                  />
                  <div>
                    <p class="font-medium">
                      {{
                        redeemResult.success
                          ? redeemResult.hasWarnings
                            ? 'Canje exitoso (parcialmente truncado)'
                            : 'Canje exitoso'
                          : 'Canje fallido'
                      }}
                    </p>
                    <p class="mt-1 text-sm opacity-90">{{ redeemResult.message }}</p>
                    <div v-if="redeemResult.success && redeemResult.data" class="mt-2 text-sm">
                      <p v-if="redeemResult.data.quotaAdded">
                        Cuota aumentada:
                        <span class="font-medium">${{ redeemResult.data.quotaAdded }}</span>
                      </p>
                      <p v-if="redeemResult.data.timeAdded">
                        Validez extendida:
                        <span class="font-medium"
                          >{{ redeemResult.data.timeAdded
                          }}{{
                            redeemResult.data.timeUnit === 'days'
                              ? ' días'
                              : redeemResult.data.timeUnit === 'hours'
                                ? ' horas'
                                : ' meses'
                          }}</span
                        >
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Subcontenido de historial de canjes -->
        <div v-if="quotaSubTab === 'history'">
          <!-- Necesita ingresar API Key primero -->
          <div v-if="!apiId" class="py-8 text-center">
            <div class="mb-4 text-gray-500 dark:text-gray-400">
              <i class="fas fa-key mb-4 block text-4xl opacity-50" />
              <p>Primero ingrese su API Key en la página de "Consulta de Estadísticas"</p>
            </div>
            <button
              class="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-2.5 font-medium text-white transition-all hover:from-blue-600 hover:to-cyan-600"
              @click="currentTab = 'stats'"
            >
              Ir a Ingresar API Key
            </button>
          </div>

          <!-- Lista de registros -->
          <div v-else>
            <div v-if="historyLoading" class="py-8 text-center">
              <i class="fas fa-spinner fa-spin text-2xl text-gray-400" />
              <p class="mt-2 text-gray-500 dark:text-gray-400">Cargando...</p>
            </div>

            <div v-else-if="redemptionHistory.length === 0" class="py-8 text-center">
              <i class="fas fa-inbox text-4xl text-gray-300 dark:text-gray-600" />
              <p class="mt-2 text-gray-500 dark:text-gray-400">No hay registros de canjes</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="record in redemptionHistory"
                :key="record.id"
                class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <div class="mb-1 flex items-center gap-2">
                      <span
                        :class="[
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          record.cardType === 'quota'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : record.cardType === 'time'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        ]"
                      >
                        {{
                          record.cardType === 'quota'
                            ? 'Tarjeta de Cuota'
                            : record.cardType === 'time'
                              ? 'Tarjeta de Tiempo'
                              : 'Tarjeta Combinada'
                        }}
                      </span>
                      <span
                        v-if="record.status === 'revoked'"
                        class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      >
                        Revocado
                      </span>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-300">
                      <span v-if="record.quotaAdded">Cuota +${{ record.quotaAdded }}</span>
                      <span v-if="record.quotaAdded && record.timeAdded"> · </span>
                      <span v-if="record.timeAdded"
                        >Validez +{{ record.timeAmount
                        }}{{
                          record.timeUnit === 'days'
                            ? ' días'
                            : record.timeUnit === 'hours'
                              ? ' horas'
                              : ' meses'
                        }}</span
                      >
                    </p>
                  </div>
                  <div
                    class="whitespace-nowrap text-right text-xs text-gray-500 dark:text-gray-400"
                  >
                    {{ formatDateTime(record.redeemedAt) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ventana de prueba de API Key -->
    <ApiKeyTestModal
      :api-key-name="statsData?.name || ''"
      :api-key-value="apiKey"
      :service-type="testServiceType"
      :show="showTestModal"
      @close="closeTestModal"
    />

    <!-- Ventana de notificación de API Stats -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showNotice"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          @click.self="dismissNotice"
        >
          <div
            class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            @click.stop
          >
            <div class="mb-4 flex items-center gap-3">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white"
              >
                <i class="fas fa-bell" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {{ oemSettings.apiStatsNotice?.title || 'Notificación' }}
              </h3>
            </div>
            <p
              class="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-300"
            >
              {{ oemSettings.apiStatsNotice?.content }}
            </p>
            <label class="mb-4 flex cursor-pointer items-center gap-2">
              <input
                v-model="dontShowAgain"
                class="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                type="checkbox"
              />
              <span class="text-sm text-gray-600 dark:text-gray-400">No mostrar de nuevo en esta sesión</span>
            </label>
            <button
              class="w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2.5 font-medium text-white transition-all hover:from-blue-600 hover:to-cyan-600"
              @click="dismissNotice"
            >
              Entendido
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useApiStatsStore } from '@/stores/apistats'
import { useThemeStore } from '@/stores/theme'
import { redeemCardByApiIdApi, getRedemptionHistoryByApiIdApi } from '@/utils/http_apis'
import { formatDateTime, showToast } from '@/utils/tools'
import LogoTitle from '@/components/common/LogoTitle.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import ApiKeyInput from '@/components/apistats/ApiKeyInput.vue'
import StatsOverview from '@/components/apistats/StatsOverview.vue'
import TokenDistribution from '@/components/apistats/TokenDistribution.vue'
import LimitConfig from '@/components/apistats/LimitConfig.vue'
import AggregatedStatsCard from '@/components/apistats/AggregatedStatsCard.vue'
import ModelUsageStats from '@/components/apistats/ModelUsageStats.vue'
import ServiceCostCards from '@/components/apistats/ServiceCostCards.vue'
import TutorialView from './TutorialView.vue'
import ApiKeyTestModal from '@/components/apikeys/ApiKeyTestModal.vue'

const route = useRoute()
const apiStatsStore = useApiStatsStore()
const themeStore = useThemeStore()

// Pestaña actual
const currentTab = ref('stats')

// Relacionado con el tema
const isDarkMode = computed(() => themeStore.isDarkMode)

const {
  apiKey,
  apiId,
  loading,
  oemLoading,
  error,
  statsPeriod,
  statsData,
  oemSettings,
  multiKeyMode
} = storeToRefs(apiStatsStore)

const {
  queryStats,
  switchPeriod,
  loadStatsWithApiId,
  loadOemSettings,
  loadServiceRates,
  loadApiKeyFromStorage,
  reset
} = apiStatsStore

// Estado del modal de prueba
const showTestModal = ref(false)
const showTestMenu = ref(false)
const testServiceType = ref('claude')

// Estado del modal de notificación
const showNotice = ref(false)
const dontShowAgain = ref(false)
const NOTICE_STORAGE_KEY = 'apiStatsNoticeRead'

// Estado relacionado con el canje de tarjetas de cuota
const quotaSubTab = ref('redeem')
const redeemCode = ref('')
const redeemLoading = ref(false)
const redeemResult = ref(null)
const redemptionHistory = ref([])
const historyLoading = ref(false)

// Canjear tarjeta de cuota
const handleRedeem = async () => {
  if (!redeemCode.value.trim() || !apiId.value) return

  redeemLoading.value = true
  redeemResult.value = null

  const res = await redeemCardByApiIdApi({
    apiId: apiId.value,
    code: redeemCode.value.trim()
  })

  redeemLoading.value = false

  if (res.success) {
    const warnings = res.data?.warnings || []
    const hasWarnings = warnings.length > 0
    redeemResult.value = {
      success: true,
      message: hasWarnings ? warnings.join('; ') : '¡Tarjeta de cuota canjeada exitosamente!',
      data: res.data,
      hasWarnings
    }
    redeemCode.value = ''
    showToast(
      hasWarnings ? 'Canje exitoso (parcialmente truncado)' : 'Canje exitoso',
      hasWarnings ? 'warning' : 'success'
    )
    // Refrescar datos estadísticos
    loadStatsWithApiId()
  } else {
    redeemResult.value = {
      success: false,
      message: res.error || res.message || 'Canje fallido'
    }
    showToast(res.error || res.message || 'Canje fallido', 'error')
  }
}

// Cargar historial de canjes
const loadRedemptionHistory = async () => {
  if (!apiId.value) return

  historyLoading.value = true
  const res = await getRedemptionHistoryByApiIdApi(apiId.value)
  historyLoading.value = false

  if (res.success) {
    redemptionHistory.value = res.data?.records || res.data || []
  }
}

// Cambiar a pestaña de tarjetas de cuota
const switchToQuota = () => {
  currentTab.value = 'quota'
  // Si la subpestaña es historial, refrescar datos
  if (quotaSubTab.value === 'history') {
    loadRedemptionHistory()
  }
}

// Cambiar a subpestaña de historial de canjes
const switchToHistorySubTab = () => {
  quotaSubTab.value = 'history'
  loadRedemptionHistory()
}

// Analizar permisos (puede ser una cadena JSON o un arreglo)
const parsePermissions = (permissions) => {
  if (!permissions) return []
  if (Array.isArray(permissions)) return permissions
  if (typeof permissions === 'string') {
    if (permissions === 'all') return []
    try {
      const parsed = JSON.parse(permissions)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

// Verificar si se puede probar Claude (permisos incluyen claude o todos)
const canTestClaude = computed(() => {
  const permissions = parsePermissions(statsData.value?.permissions)
  if (permissions.length === 0) return true
  return permissions.includes('claude')
})

// Verificar si se puede probar Gemini
const canTestGemini = computed(() => {
  const permissions = parsePermissions(statsData.value?.permissions)
  if (permissions.length === 0) return true
  return permissions.includes('gemini')
})

// Verificar si se puede probar OpenAI
const canTestOpenAI = computed(() => {
  const permissions = parsePermissions(statsData.value?.permissions)
  if (permissions.length === 0) return true
  return permissions.includes('openai')
})

// Verificar si tiene algún permiso de prueba
const hasAnyTestPermission = computed(() => {
  return canTestClaude.value || canTestGemini.value || canTestOpenAI.value
})

// Texto de servicios disponibles
const availableServicesText = computed(() => {
  const permissions = parsePermissions(statsData.value?.permissions)
  if (permissions.length === 0) return 'Todos los servicios'
  const serviceNames = {
    claude: 'Claude',
    gemini: 'Gemini',
    openai: 'OpenAI',
    droid: 'Droid'
  }
  return permissions.map((s) => serviceNames[s] || s).join(', ')
})

// Alternar menú de prueba
const toggleTestMenu = () => {
  showTestMenu.value = !showTestMenu.value
}

// Abrir modal de prueba
const openTestModal = (serviceType = 'claude') => {
  testServiceType.value = serviceType
  showTestMenu.value = false
  showTestModal.value = true
}

// Cerrar modal de prueba
const closeTestModal = () => {
  showTestModal.value = false
}

// Cerrar modal de notificación
const dismissNotice = () => {
  showNotice.value = false
  if (dontShowAgain.value) {
    sessionStorage.setItem(NOTICE_STORAGE_KEY, '1')
  }
}

// Verificar si mostrar notificación
const checkNotice = () => {
  const notice = oemSettings.value?.apiStatsNotice
  if (notice?.enabled && notice?.content && !sessionStorage.getItem(NOTICE_STORAGE_KEY)) {
    showNotice.value = true
  }
}

// Hacer clic fuera para cerrar menú
const handleClickOutside = (event) => {
  if (showTestMenu.value && !event.target.closest('.relative')) {
    showTestMenu.value = false
  }
}

// Manejar atajos de teclado
const handleKeyDown = (event) => {
  // Ctrl/Cmd + Enter para consultar
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    if (!loading.value && apiKey.value.trim()) {
      queryStats()
    }
    event.preventDefault()
  }

  // ESC para limpiar datos
  if (event.key === 'Escape') {
    reset()
  }
}

// Inicialización
onMounted(async () => {
  // API Stats Page loaded

  // Inicializar tema (porque esta página no está dentro de MainLayout)
  themeStore.initTheme()

  // Cargar configuración OEM y tarifas de servicio
  await Promise.all([loadOemSettings(), loadServiceRates()])
  checkNotice()

  // Verificar parámetros URL
  const urlApiId = route.query.apiId
  const urlApiKey = route.query.apiKey

  if (
    urlApiId &&
    urlApiId.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)
  ) {
    // Si la URL tiene apiId, usar directamente apiId para cargar datos
    apiId.value = urlApiId
    // También llenar API Key desde localStorage en el campo de entrada
    const savedApiKey = loadApiKeyFromStorage()
    if (savedApiKey) {
      apiKey.value = savedApiKey
    }
    loadStatsWithApiId()
  } else if (urlApiKey && urlApiKey.length > 10) {
    // Compatibilidad con versiones anteriores, soportar parámetro apiKey
    apiKey.value = urlApiKey
  } else {
    // Sin parámetros URL, verificar localStorage
    const savedApiKey = loadApiKeyFromStorage()
    if (savedApiKey && savedApiKey.length > 10) {
      apiKey.value = savedApiKey
      queryStats()
    }
  }

  // Agregar escucha de eventos de teclado
  document.addEventListener('keydown', handleKeyDown)
  // Agregar escucha de clic externo para cerrar menú
  document.addEventListener('click', handleClickOutside)
})

// Limpieza
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('click', handleClickOutside)
})

// Escuchar cambios de API Key
watch(apiKey, (newValue) => {
  if (!newValue) {
    apiStatsStore.clearData()
  }
})
</script>

<style scoped>
/* Fondo degradado */
.gradient-bg {
  background: linear-gradient(
    135deg,
    var(--bg-gradient-start) 0%,
    var(--bg-gradient-mid) 50%,
    var(--bg-gradient-end) 100%
  );
  background-attachment: fixed;
  min-height: 100vh;
  position: relative;
}

/* Fondo degradado del modo oscuro */
.gradient-bg-dark {
  background: linear-gradient(
    135deg,
    var(--bg-gradient-start) 0%,
    var(--bg-gradient-mid) 50%,
    var(--bg-gradient-end) 100%
  );
  background-attachment: fixed;
  min-height: 100vh;
  position: relative;
}

.gradient-bg::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 80%, rgba(var(--accent-rgb), 0.2) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(var(--primary-rgb), 0.2) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(var(--secondary-rgb), 0.1) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/* Superposición de fondo del modo oscuro */
.gradient-bg-dark::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 80%, rgba(var(--accent-rgb), 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(var(--primary-rgb), 0.1) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(var(--secondary-rgb), 0.1) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/*/* Efecto de cristal - usando variables CSS */
.glass-strong {
  background: var(--glass-strong-color);
  backdrop-filter: blur(25px);
  border: 1px solid var(--border-color);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 1;
}

/* Efecto de vidrio del modo oscuro */
:global(.dark) .glass-strong {
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(55, 65, 81, 0.3),
    inset 0 1px 0 rgba(75, 85, 99, 0.2);
}

/* Degradado del título */
.header-title {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
  letter-spacing: -0.025em;
}

/* Botón de inicio de sesión de usuario */
.user-login-button {
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  text-decoration: none;
  box-shadow:
    0 4px 12px rgba(52, 211, 153, 0.25),
    inset 0 1px 1px rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
  font-weight: 600;
}

/* Botón de inicio de sesión de usuario en modo oscuro */
:global(.dark) .user-login-button {
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
  border: 1px solid rgba(52, 211, 153, 0.4);
  color: white;
  box-shadow:
    0 4px 12px rgba(52, 211, 153, 0.3),
    inset 0 1px 1px rgba(255, 255, 255, 0.1);
}

.user-login-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.user-login-button:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow:
    0 8px 20px rgba(52, 211, 153, 0.35),
    inset 0 1px 1px rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.4);
}

.user-login-button:hover::before {
  opacity: 1;
}

/* Efecto hover en modo oscuro */
:global(.dark) .user-login-button:hover {
  box-shadow:
    0 8px 20px rgba(52, 211, 153, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.2);
  border-color: rgba(52, 211, 153, 0.5);
}

.user-login-button:active {
  transform: translateY(-1px) scale(1);
}

/* Asegurar que los íconos y el texto sean claramente visibles en todos los modos */
.user-login-button i,
.user-login-button span {
  position: relative;
  z-index: 1;
}

/*/* Botón de panel de administración - versión refinada */
.admin-button-refined {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  text-decoration: none;
  box-shadow:
    0 4px 12px rgba(var(--primary-rgb), 0.25),
    inset 0 1px 1px rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
  font-weight: 600;
}

/* Botón del panel de administración en modo oscuro */
:global(.dark) .admin-button-refined {
  background: rgba(55, 65, 81, 0.8);
  border: 1px solid rgba(107, 114, 128, 0.4);
  color: #f3f4f6;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    inset 0 1px 1px rgba(255, 255, 255, 0.05);
}

.admin-button-refined::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, var(--secondary-color) 0%, var(--primary-color) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.admin-button-refined:hover {
  transform: translateY(-2px) scale(1.02);
  background: linear-gradient(135deg, var(--secondary-color) 0%, var(--primary-color) 100%);
  box-shadow:
    0 8px 20px rgba(var(--secondary-rgb), 0.35),
    inset 0 1px 1px rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.4);
  color: white;
}

.admin-button-refined:hover::before {
  opacity: 1;
}

/* Efecto hover en modo oscuro */
:global(.dark) .admin-button-refined:hover {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  border-color: rgba(var(--secondary-rgb), 0.4);
  box-shadow:
    0 8px 20px rgba(var(--primary-rgb), 0.3),
    inset 0 1px 1px rgba(255, 255, 255, 0.1);
  color: white;
}

.admin-button-refined:active {
  transform: translateY(-1px) scale(1);
}

/* Asegurar que los íconos y el texto sean claramente visibles en todos los modos */
.admin-button-refined i,
.admin-button-refined span {
  position: relative;
  z-index: 1;
}

/* Botón de rango de tiempo */
.period-btn {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  font-weight: 500;
  letter-spacing: 0.025em;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
}

.period-btn.active {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: white;
  box-shadow:
    0 10px 15px -3px rgba(var(--primary-rgb), 0.3),
    0 4px 6px -2px rgba(var(--primary-rgb), 0.05);
  transform: translateY(-1px);
}

.period-btn:not(.active) {
  color: #374151;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(229, 231, 235, 0.5);
}

:global(html.dark) .period-btn:not(.active) {
  color: #e5e7eb;
  background: rgba(55, 65, 81, 0.4);
  border: 1px solid rgba(75, 85, 99, 0.5);
}

.period-btn:not(.active):hover {
  background: rgba(255, 255, 255, 0.8);
  color: #1f2937;
  border-color: rgba(209, 213, 219, 0.8);
}

:global(html.dark) .period-btn:not(.active):hover {
  background: rgba(75, 85, 99, 0.6);
  color: #ffffff;
  border-color: rgba(107, 114, 128, 0.8);
}

/* Estilos del botón de prueba */
.test-btn {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  font-weight: 500;
  letter-spacing: 0.025em;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
  box-shadow:
    0 4px 10px -2px rgba(6, 182, 212, 0.3),
    0 2px 4px -1px rgba(6, 182, 212, 0.1);
}

.test-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    0 8px 15px -3px rgba(6, 182, 212, 0.4),
    0 4px 6px -2px rgba(6, 182, 212, 0.15);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/*/* Estilos de botones de pestañas tipo píldora */
.tab-pill-button {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-weight: 500;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  flex: 1;
  justify-content: center;
}

/* Estilo base del botón de pestaña en modo oscuro */
:global(html.dark) .tab-pill-button {
  color: rgba(209, 213, 219, 0.8);
}

@media (min-width: 768px) {
  .tab-pill-button {
    padding: 0.625rem 1.25rem;
    flex: none;
  }
}

.tab-pill-button:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

:global(html.dark) .tab-pill-button:hover {
  color: #f3f4f6;
  background: rgba(100, 116, 139, 0.2);
}

.tab-pill-button.active {
  background: white;
  color: var(--secondary-color);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

:global(html.dark) .tab-pill-button.active {
  background: rgba(71, 85, 105, 0.9);
  color: #f3f4f6;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

.tab-pill-button i {
  font-size: 0.875rem;
}

/*/* Animación de transición de contenido de pestaña */
.tab-content {
  animation: tabFadeIn 0.4s ease-out;
}

@keyframes tabFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Efectos de animación */
.fade-in {
  animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Animación de ventana emergente de notificación */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
