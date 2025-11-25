<template>
  <div class="space-y-6 md:space-y-8">
    <div
      class="grid grid-cols-1 items-stretch gap-4 md:gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
    >
      <!-- 基础信息 / 批量概要 -->
      <div class="card-section">
        <header class="section-header">
          <i
            class="header-icon"
            :class="
              multiKeyMode
                ? 'fas fa-layer-group text-purple-500'
                : 'fas fa-info-circle text-primary'
            "
          />
          <h3 class="header-title">
            {{
              multiKeyMode
                ? t('apistats.overview.batch_summary')
                : t('apistats.overview.api_key_info')
            }}
          </h3>
        </header>

        <div v-if="multiKeyMode && aggregatedStats" class="info-grid">
          <div class="info-item">
            <p class="info-label">{{ t('apistats.overview.total_keys') }}</p>
            <p class="info-value">
              {{ t('apistats.format.count', { count: aggregatedStats.totalKeys }) }}
            </p>
          </div>
          <div class="info-item">
            <p class="info-label">{{ t('apistats.overview.active_keys') }}</p>
            <p class="info-value text-success dark:text-emerald-400">
              <i class="fas fa-check-circle mr-1" />{{
                t('apistats.format.count', { count: aggregatedStats.activeKeys })
              }}
            </p>
          </div>
          <div v-if="invalidKeys.length > 0" class="info-item">
            <p class="info-label">{{ t('apistats.overview.invalid_keys') }}</p>
            <p class="info-value text-destructive dark:text-red-400">
              <i class="fas fa-times-circle mr-1" />{{
                t('apistats.format.count', { count: invalidKeys.length })
              }}
            </p>
          </div>
          <div class="info-item">
            <p class="info-label">{{ t('apistats.overview.total_requests') }}</p>
            <p class="info-value">{{ formatNumber(aggregatedStats.usage.requests) }}</p>
          </div>
          <div class="info-item">
            <p class="info-label">{{ t('apistats.overview.total_tokens') }}</p>
            <p class="info-value">{{ formatNumber(aggregatedStats.usage.allTokens) }}</p>
          </div>
          <div class="info-item">
            <p class="info-label">{{ t('apistats.overview.total_cost') }}</p>
            <p class="info-value text-indigo-600 dark:text-indigo-300">
              {{ aggregatedStats.usage.formattedCost }}
            </p>
          </div>
          <div v-if="individualStats.length > 1" class="info-item xl:col-span-2">
            <p class="info-label">{{ t('apistats.overview.top_contributors') }}</p>
            <div class="space-y-2">
              <div v-for="stat in topContributors" :key="stat.apiId" class="contributor-item">
                <span class="truncate">{{ stat.name }}</span>
                <span class="font-semibold">{{ calculateContribution(stat) }}%</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="info-grid">
          <div class="info-item">
            <p class="info-label">{{ t('apistats.field.name') }}</p>
            <p class="info-value break-all">{{ statsData.name }}</p>
          </div>
          <div class="info-item">
            <p class="info-label">{{ t('apistats.field.status') }}</p>
            <p
              class="info-value font-semibold"
              :class="
                statsData.isActive
                  ? 'text-success dark:text-emerald-400'
                  : 'text-destructive dark:text-red-400'
              "
            >
              <i
                class="mr-1"
                :class="statsData.isActive ? 'fas fa-check-circle' : 'fas fa-times-circle'"
              />
              {{ statsData.isActive ? t('apistats.status.active') : t('apistats.status.disabled') }}
            </p>
          </div>
          <div class="info-item">
            <p class="info-label">{{ t('apistats.field.permissions') }}</p>
            <p class="info-value">{{ formatPermissions(statsData.permissions) }}</p>
          </div>
          <div class="info-item">
            <p class="info-label">{{ t('apistats.field.created_at') }}</p>
            <p class="info-value break-all">{{ formatDate(statsData.createdAt) }}</p>
          </div>
          <div class="info-item xl:col-span-2">
            <p class="info-label">{{ t('apistats.field.expiry_time') }}</p>
            <div class="info-value">
              <template v-if="statsData.expirationMode === 'activation' && !statsData.isActivated">
                <span class="text-warning dark:text-amber-400">
                  <i class="fas fa-pause-circle mr-1" />{{ t('apistats.status.not_activated') }}
                </span>
                <span class="ml-2 text-xs text-muted-foreground">
                  {{
                    t('apistats.expiry.not_activated_suffix', {
                      time:
                        statsData.activationDays ||
                        (statsData.activationUnit === 'hours' ? 24 : 30),
                      unit:
                        statsData.activationUnit === 'hours'
                          ? t('apistats.expiry.unit.hours')
                          : t('apistats.expiry.unit.days')
                    })
                  }}
                </span>
              </template>
              <template v-else-if="statsData.expiresAt">
                <span
                  v-if="isApiKeyExpired(statsData.expiresAt)"
                  class="text-destructive dark:text-red-400"
                >
                  <i class="fas fa-exclamation-circle mr-1" />{{ t('apistats.status.expired') }}
                </span>
                <span
                  v-else-if="isApiKeyExpiringSoon(statsData.expiresAt)"
                  class="text-orange-500 dark:text-orange-400"
                >
                  <i class="fas fa-clock mr-1" />{{ formatExpireDate(statsData.expiresAt) }}
                </span>
                <span v-else>{{ formatExpireDate(statsData.expiresAt) }}</span>
              </template>
              <template v-else>
                <span class="text-gray-400 dark:text-gray-500">
                  <i class="fas fa-infinity mr-1" />{{ t('apistats.status.never_expires') }}
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Usage Statistics Overview -->
      <div class="card-section">
        <header class="section-header">
          <i class="header-icon fas fa-chart-bar text-success" />
          <h3 class="header-title">{{ t('apistats.overview.usage_stats') }}</h3>
          <span class="header-tag">{{
            statsPeriod === 'daily'
              ? t('apistats.overview.today')
              : t('apistats.overview.this_month')
          }}</span>
        </header>
        <div class="metric-grid">
          <div class="metric-card">
            <p class="metric-value text-success dark:text-emerald-300">
              {{ formatNumber(currentPeriodData.requests) }}
            </p>
            <p class="metric-label">
              {{
                statsPeriod === 'daily'
                  ? t('apistats.overview.today_requests')
                  : t('apistats.overview.this_month_requests')
              }}
            </p>
          </div>
          <div class="metric-card">
            <p class="metric-value text-primary dark:text-sky-300">
              {{ formatNumber(currentPeriodData.allTokens) }}
            </p>
            <p class="metric-label">
              {{
                statsPeriod === 'daily'
                  ? t('apistats.overview.today_tokens')
                  : t('apistats.overview.this_month_tokens')
              }}
            </p>
          </div>
          <div class="metric-card">
            <p class="metric-value text-purple-600 dark:text-violet-300">
              {{ currentPeriodData.formattedCost || '$0.000000' }}
            </p>
            <p class="metric-label">
              {{
                statsPeriod === 'daily'
                  ? t('apistats.overview.today_cost')
                  : t('apistats.overview.this_month_cost')
              }}
            </p>
          </div>
          <div class="metric-card">
            <p class="metric-value text-amber-500 dark:text-amber-300">
              {{ formatNumber(currentPeriodData.inputTokens) }}
            </p>
            <p class="metric-label">
              {{
                statsPeriod === 'daily'
                  ? t('apistats.overview.today_input_tokens')
                  : t('apistats.overview.this_month_input_tokens')
              }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Dedicated Account Running Status -->
    <div v-if="!multiKeyMode && boundAccountList.length > 0" class="card-section">
      <header class="section-header">
        <i class="header-icon fas fa-plug text-indigo-500" />
        <h3 class="header-title">{{ t('apistats.account.running_status') }}</h3>
        <span class="header-tag">{{ t('apistats.account.realtime_update') }}</span>
      </header>

      <div class="grid grid-cols-1 gap-4" :class="accountGridClass">
        <div
          v-for="account in boundAccountList"
          :key="account.id || account.key"
          class="account-card"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span
                class="account-icon"
                :class="account.platform === 'claude' ? 'icon-claude' : 'icon-openai'"
              >
                <i :class="account.platform === 'claude' ? 'fas fa-meteor' : 'fas fa-robot'" />
              </span>
              <div>
                <p class="account-name">{{ getAccountLabel(account) }}</p>
                <p class="account-sub">
                  {{
                    account.platform === 'claude'
                      ? t('apistats.field.session_window')
                      : t('apistats.field.quota_window')
                  }}
                </p>
              </div>
            </div>
            <div
              v-if="getRateLimitDisplay(account.rateLimitStatus)"
              :class="['rate-badge', getRateLimitDisplay(account.rateLimitStatus).class]"
            >
              <i class="fas fa-tachometer-alt mr-1" />
              {{ getRateLimitDisplay(account.rateLimitStatus).text }}
            </div>
          </div>

          <div v-if="account.platform === 'claude'" class="mt-3 space-y-2">
            <div class="progress-row">
              <div class="progress-track">
                <div
                  class="progress-bar"
                  :class="
                    getSessionProgressBarClass(account.sessionWindow?.sessionWindowStatus, account)
                  "
                  :style="{
                    width: `${Math.min(100, Math.max(0, account.sessionWindow?.progress || 0))}%`
                  }"
                />
              </div>
              <span class="progress-value">
                {{ Math.min(100, Math.max(0, Math.round(account.sessionWindow?.progress || 0))) }}%
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span>
                {{
                  formatSessionWindowRange(
                    account.sessionWindow?.windowStart,
                    account.sessionWindow?.windowEnd
                  )
                }}
              </span>
              <span
                v-if="account.sessionWindow?.remainingTime > 0"
                class="font-medium text-indigo-600 dark:text-indigo-400"
              >
                {{
                  t('apistats.status.remaining', {
                    time: formatSessionRemaining(account.sessionWindow.remainingTime)
                  })
                }}
              </span>
            </div>
          </div>

          <div v-else-if="account.platform === 'openai'" class="mt-3">
            <div v-if="account.codexUsage" class="space-y-2">
              <div
                v-for="type in ['primary', 'secondary']"
                :key="`${account.key}-${type}`"
                class="quota-row"
              >
                <div class="quota-header">
                  <span class="quota-tag" :class="type === 'primary' ? 'tag-indigo' : 'tag-blue'">
                    {{ getCodexWindowLabel(type) }}
                  </span>
                  <span class="quota-percent">
                    {{ formatCodexUsagePercent(account.codexUsage?.[type]) }}
                  </span>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-bar"
                    :class="getCodexUsageBarClass(account.codexUsage?.[type])"
                    :style="{ width: getCodexUsageWidth(account.codexUsage?.[type]) }"
                  />
                </div>
                <div class="quota-foot">
                  {{
                    t('apistats.time.reset_remaining', {
                      time: formatCodexRemaining(account.codexUsage?.[type])
                    })
                  }}
                </div>
              </div>
            </div>
            <p
              v-else
              class="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300"
            >
              {{ t('apistats.account.no_quota_data') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/* eslint-disable no-unused-vars */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { useApiStatsStore } from '@/stores/apistats'

const { t } = useI18n()

const apiStatsStore = useApiStatsStore()
const {
  statsData,
  statsPeriod,
  currentPeriodData,
  multiKeyMode,
  aggregatedStats,
  individualStats,
  invalidKeys
} = storeToRefs(apiStatsStore)

const topContributors = computed(() => {
  if (!individualStats.value || individualStats.value.length === 0) return []
  return [...individualStats.value]
    .sort((a, b) => (b.usage?.allTokens || 0) - (a.usage?.allTokens || 0))
    .slice(0, 3)
})

const calculateContribution = (stat) => {
  if (!aggregatedStats.value || !aggregatedStats.value.usage.allTokens) return 0
  const percentage = ((stat.usage?.allTokens || 0) / aggregatedStats.value.usage.allTokens) * 100
  return percentage.toFixed(1)
}

const formatDate = (dateString) => {
  if (!dateString) return t('apistats.time.none')
  try {
    return dayjs(dateString).format(t('apistats.format.date'))
  } catch (error) {
    return t('apistats.time.format_error')
  }
}

const formatExpireDate = (dateString) => {
  if (!dateString) return ''
  return dayjs(dateString).format(t('apistats.format.date'))
}

const isApiKeyExpired = (expiresAt) => {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

const isApiKeyExpiringSoon = (expiresAt) => {
  if (!expiresAt) return false
  const expireDate = new Date(expiresAt)
  const now = new Date()
  const daysUntilExpire = (expireDate - now) / (1000 * 60 * 60 * 24)
  return daysUntilExpire > 0 && daysUntilExpire <= 7
}

const formatNumber = (num) => {
  if (typeof num !== 'number') num = parseInt(num) || 0
  if (num === 0) return '0'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toLocaleString()
}

const formatPermissions = (permissions) => {
  const map = {
    claude: t('apistats.permissions.claude'),
    gemini: t('apistats.permissions.gemini'),
    all: t('apistats.permissions.all')
  }
  return map[permissions] || permissions || t('apistats.permissions.unknown')
}

const boundAccountList = computed(() => {
  const accounts = statsData.value?.accounts?.details
  if (!accounts) return []
  const result = []
  if (accounts.claude && accounts.claude.accountType === 'dedicated') {
    result.push({ key: 'claude', ...accounts.claude })
  }
  if (accounts.openai && accounts.openai.accountType === 'dedicated') {
    result.push({ key: 'openai', ...accounts.openai })
  }
  return result
})

const accountGridClass = computed(() => {
  const count = boundAccountList.value.length
  if (count <= 1) {
    return 'md:grid-cols-1 lg:grid-cols-1'
  }
  if (count === 2) {
    return 'md:grid-cols-2'
  }
  return 'md:grid-cols-2 xl:grid-cols-3'
})

const getAccountLabel = (account) => {
  if (!account) return t('apistats.account.dedicated')
  return account.platform === 'openai'
    ? t('apistats.account.openai_dedicated')
    : t('apistats.account.claude_dedicated')
}

const formatRateLimitTime = (minutes) => {
  if (!minutes || minutes <= 0) return ''
  const total = Math.floor(minutes)
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60
  if (days > 0) return hours > 0 ? t('apistats.time.day_hour', { days, hours }) : `${days}d`
  if (hours > 0)
    return mins > 0 ? t('apistats.time.hour_minute', { hours, minutes: mins }) : `${hours}h`
  return `${mins}m`
}

const getRateLimitDisplay = (status) => {
  if (!status) {
    return {
      text: t('apistats.status.unknown'),
      class: 'text-gray-400'
    }
  }
  if (status.isRateLimited) {
    const remaining = formatRateLimitTime(status.minutesRemaining)
    return {
      text: remaining
        ? t('apistats.status.rate_limited_with_time', { time: remaining })
        : t('apistats.status.rate_limited'),
      class: 'text-destructive dark:text-red-400'
    }
  }
  return {
    text: t('apistats.status.not_rate_limited'),
    class: 'text-success dark:text-emerald-400'
  }
}

const formatSessionWindowRange = (start, end) => {
  if (!start || !end) return t('apistats.expiry.no_time_window')
  const s = new Date(start)
  const e = new Date(end)
  const fmt = (d) => `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`
  return `${fmt(s)} - ${fmt(e)}`
}

const formatSessionRemaining = (minutes) => {
  if (!minutes || minutes <= 0) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? t('apistats.time.hour_minute', { hours, minutes: mins }) : `${mins}m`
}

const getSessionProgressBarClass = (status, account) => {
  if (!status) return 'bg-gradient-to-r from-blue-500 to-indigo-500'
  if (account?.rateLimitStatus?.isRateLimited) return 'bg-gradient-to-r from-red-500 to-red-600'
  const normalized = String(status).toLowerCase()
  if (normalized === 'rejected') return 'bg-gradient-to-r from-red-500 to-red-600'
  if (normalized === 'allowed_warning') return 'bg-gradient-to-r from-yellow-500 to-orange-500'
  return 'bg-gradient-to-r from-blue-500 to-indigo-500'
}

const normalizeCodexUsagePercent = (usageItem) => {
  if (!usageItem) return null
  const percent =
    typeof usageItem.usedPercent === 'number' && !Number.isNaN(usageItem.usedPercent)
      ? usageItem.usedPercent
      : null
  const resetAfterSeconds =
    typeof usageItem.resetAfterSeconds === 'number' && !Number.isNaN(usageItem.resetAfterSeconds)
      ? usageItem.resetAfterSeconds
      : null
  const remainingSeconds =
    typeof usageItem.remainingSeconds === 'number' ? usageItem.remainingSeconds : null
  const resetAtMs = usageItem.resetAt ? Date.parse(usageItem.resetAt) : null
  const resetElapsed =
    resetAfterSeconds !== null &&
    ((remainingSeconds !== null && remainingSeconds <= 0) ||
      (resetAtMs !== null && !Number.isNaN(resetAtMs) && Date.now() >= resetAtMs))
  if (resetElapsed) return 0
  if (percent === null) return null
  return Math.max(0, Math.min(100, percent))
}

const getCodexUsageBarClass = (usageItem) => {
  const percent = normalizeCodexUsagePercent(usageItem)
  if (percent === null) return 'bg-gradient-to-r from-gray-300 to-gray-400'
  if (percent >= 90) return 'bg-gradient-to-r from-red-500 to-red-600'
  if (percent >= 75) return 'bg-gradient-to-r from-yellow-500 to-orange-500'
  return 'bg-gradient-to-r from-emerald-500 to-teal-500'
}

const getCodexUsageWidth = (usageItem) => {
  const percent = normalizeCodexUsagePercent(usageItem)
  if (percent === null) return '0%'
  return `${percent}%`
}

const formatCodexUsagePercent = (usageItem) => {
  const percent = normalizeCodexUsagePercent(usageItem)
  if (percent === null) return '--'
  return `${percent.toFixed(1)}%`
}

const formatCodexRemaining = (usageItem) => {
  if (!usageItem) return '--'
  let seconds = usageItem.remainingSeconds
  if (seconds === null || seconds === undefined) {
    seconds = usageItem.resetAfterSeconds
  }
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) {
    return '--'
  }
  seconds = Math.max(0, Math.floor(Number(seconds)))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (days > 0) return hours > 0 ? t('apistats.time.day_hour', { days, hours }) : `${days}d`
  if (hours > 0)
    return minutes > 0 ? t('apistats.time.hour_minute', { hours, minutes }) : `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${secs}s`
}

const getCodexWindowLabel = (type) =>
  type === 'secondary' ? t('apistats.window.weekly') : t('apistats.window.5h')
</script>

<style scoped>
.card-section {
  @apply flex h-full flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-md dark:border-slate-700/60 dark:bg-slate-900/70 md:p-6;
}

:global(.dark) .card-section {
  backdrop-filter: blur(10px);
}

.section-header {
  @apply mb-4 flex items-center gap-3;
}

.header-icon {
  @apply text-base md:text-lg;
}

.header-title {
  @apply text-lg font-semibold text-slate-900 dark:text-slate-100 md:text-xl;
}

.header-tag {
  @apply ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300;
}

.info-grid {
  @apply grid gap-3 md:gap-4;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

@media (min-width: 768px) {
  .info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .info-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.info-item {
  @apply rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60;
  min-height: 86px;
}

.info-label {
  @apply text-xs uppercase tracking-wide text-slate-400;
}

.info-value {
  @apply mt-2 text-sm text-slate-800 dark:text-slate-100;
}

.contributor-item {
  @apply flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300;
}

.metric-grid {
  @apply grid grid-cols-2 gap-3 md:gap-4;
}

.metric-card {
  @apply rounded-xl border border-slate-200 bg-white/70 p-4 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/60;
}

.metric-value {
  @apply text-xl font-semibold md:text-2xl;
}

.metric-label {
  @apply mt-1 text-xs text-slate-500 dark:text-slate-300;
}

.account-card {
  @apply rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/60;
}

.account-icon {
  @apply inline-flex h-10 w-10 items-center justify-center rounded-full text-white;
}

.icon-claude {
  @apply bg-gradient-to-br from-purple-500 to-purple-600;
}

.icon-openai {
  @apply bg-gradient-to-br from-sky-500 to-indigo-500;
}

.account-name {
  @apply text-sm font-semibold text-slate-900 dark:text-slate-100;
}

.account-sub {
  @apply text-xs text-slate-500 dark:text-slate-400;
}

.rate-badge {
  @apply rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800;
}

.progress-row {
  @apply flex items-center gap-2;
}

.progress-track {
  @apply h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700;
}

.progress-bar {
  @apply h-1.5 rounded-full transition-all duration-300;
}

.progress-value {
  @apply text-xs font-semibold text-slate-600 dark:text-slate-200;
}

.quota-row {
  @apply rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-900/50;
}

.quota-header {
  @apply mb-2 flex items-center justify-between;
}

.quota-tag {
  @apply inline-flex min-w-[34px] justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold;
}

.tag-indigo {
  @apply bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200;
}

.tag-blue {
  @apply bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200;
}

.quota-percent {
  @apply text-xs font-semibold text-slate-600 dark:text-slate-200;
}

.quota-foot {
  @apply mt-1 text-[11px] text-slate-400 dark:text-slate-300;
}
</style>
