<template>
  <div class="flex h-full flex-col gap-4 md:gap-6">
    <!-- 限制配置 / 聚合模式提示 -->
    <div class="card flex h-full flex-col p-4 md:p-6">
      <h3 class="mb-3 flex items-center text-lg font-bold text-foreground md:mb-4 md:text-xl">
        <i class="fas fa-shield-alt mr-2 text-sm text-destructive md:mr-3 md:text-base" />
        {{
          multiKeyMode ? t('apistats.limit.config_aggregated') : t('apistats.limit.config_title')
        }}
      </h3>

      <!-- 多 Key 模式下的聚合统计信息 -->
      <div v-if="multiKeyMode && aggregatedStats" class="space-y-4">
        <!-- API Keys 概况 -->
        <div
          class="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:from-blue-900/20 dark:to-indigo-900/20"
        >
          <div class="mb-3 flex items-center justify-between">
            <span class="text-sm font-medium text-foreground">
              <i class="fas fa-layer-group mr-2 text-primary" />
              {{ t('apistats.limit.api_keys_overview') }}
            </span>
            <span
              class="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-primary dark:bg-blue-800 dark:text-blue-200"
            >
              {{ aggregatedStats.activeKeys }}/{{ aggregatedStats.totalKeys }}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="text-center">
              <div class="text-lg font-bold text-foreground">
                {{ aggregatedStats.totalKeys }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('apistats.limit.total_keys_count') }}
              </div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-success">
                {{ aggregatedStats.activeKeys }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('apistats.limit.active_keys_count') }}
              </div>
            </div>
          </div>
        </div>

        <!-- 聚合统计数据 -->
        <div
          class="rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 p-4 dark:from-purple-900/20 dark:to-pink-900/20"
        >
          <div class="mb-3 flex items-center">
            <i class="fas fa-chart-pie mr-2 text-purple-500" />
            <span class="text-sm font-medium text-foreground">{{
              t('apistats.limit.aggregated_summary')
            }}</span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">
                <i class="fas fa-database mr-1 text-gray-400" />
                {{ t('apistats.limit.total_requests') }}
              </span>
              <span class="text-sm font-medium text-foreground">
                {{ formatNumber(aggregatedStats.usage.requests) }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">
                <i class="fas fa-coins mr-1 text-warning" />
                {{ t('apistats.limit.total_tokens') }}
              </span>
              <span class="text-sm font-medium text-foreground">
                {{ formatNumber(aggregatedStats.usage.allTokens) }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">
                <i class="fas fa-dollar-sign mr-1 text-success" />
                {{ t('apistats.limit.total_cost') }}
              </span>
              <span class="text-sm font-medium text-foreground">
                {{ aggregatedStats.usage.formattedCost }}
              </span>
            </div>
          </div>
        </div>

        <!-- 无效 Keys 提示 -->
        <div
          v-if="invalidKeys && invalidKeys.length > 0"
          class="rounded-lg bg-red-50 p-3 text-sm dark:bg-red-900/20"
        >
          <i class="fas fa-exclamation-triangle mr-2 text-destructive dark:text-red-400" />
          <span class="text-red-700 dark:text-red-300">
            {{ t('apistats.limit.invalid_keys_count', { count: invalidKeys.length }) }}
          </span>
        </div>

        <!-- 提示信息 -->
        <div
          class="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        >
          <i class="fas fa-info-circle mr-1" />
          {{ t('apistats.limit.aggregated_mode_hint') }}
        </div>
      </div>

      <!-- 仅在单 Key 模式下显示限制配置 -->
      <div v-if="!multiKeyMode" class="space-y-4 md:space-y-5">
        <!-- 每日费用限制 -->
        <div>
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium text-muted-foreground md:text-base">{{
              t('apistats.limit.daily_cost_limit')
            }}</span>
            <span class="text-xs text-muted-foreground md:text-sm">
              <span v-if="statsData.limits.dailyCostLimit > 0">
                ${{ statsData.limits.currentDailyCost.toFixed(4) }} / ${{
                  statsData.limits.dailyCostLimit.toFixed(2)
                }}
              </span>
              <span v-else class="flex items-center gap-1">
                ${{ statsData.limits.currentDailyCost.toFixed(4) }} / <i class="fas fa-infinity" />
              </span>
            </span>
          </div>
          <div
            v-if="statsData.limits.dailyCostLimit > 0"
            class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700"
          >
            <div
              class="h-2 rounded-full transition-all duration-300"
              :class="getDailyCostProgressColor()"
              :style="{ width: getDailyCostProgress() + '%' }"
            />
          </div>
          <div v-else class="h-2 w-full rounded-full bg-gray-200">
            <div class="h-2 rounded-full bg-green-500" style="width: 0%" />
          </div>
        </div>

        <!-- 总费用限制 -->
        <div>
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium text-muted-foreground md:text-base">{{
              t('apistats.limit.total_cost_limit')
            }}</span>
            <span class="text-xs text-muted-foreground md:text-sm">
              <span v-if="statsData.limits.totalCostLimit > 0">
                ${{ statsData.limits.currentTotalCost.toFixed(4) }} / ${{
                  statsData.limits.totalCostLimit.toFixed(2)
                }}
              </span>
              <span v-else class="flex items-center gap-1">
                ${{ statsData.limits.currentTotalCost.toFixed(4) }} / <i class="fas fa-infinity" />
              </span>
            </span>
          </div>
          <div
            v-if="statsData.limits.totalCostLimit > 0"
            class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700"
          >
            <div
              class="h-2 rounded-full transition-all duration-300"
              :class="getTotalCostProgressColor()"
              :style="{ width: getTotalCostProgress() + '%' }"
            />
          </div>
          <div v-else class="h-2 w-full rounded-full bg-gray-200">
            <div class="h-2 rounded-full bg-blue-500" style="width: 0%" />
          </div>
        </div>

        <!-- Opus 模型周费用限制 -->
        <div v-if="statsData.limits.weeklyOpusCostLimit > 0">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium text-muted-foreground md:text-base">{{
              t('apistats.limit.opus_weekly_cost_limit')
            }}</span>
            <span class="text-xs text-muted-foreground md:text-sm">
              ${{ statsData.limits.weeklyOpusCost.toFixed(4) }} / ${{
                statsData.limits.weeklyOpusCostLimit.toFixed(2)
              }}
            </span>
          </div>
          <div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              class="h-2 rounded-full transition-all duration-300"
              :class="getOpusWeeklyCostProgressColor()"
              :style="{ width: getOpusWeeklyCostProgress() + '%' }"
            />
          </div>
        </div>

        <!-- 时间窗口限制 -->
        <div
          v-if="
            statsData.limits.rateLimitWindow > 0 &&
            (statsData.limits.rateLimitRequests > 0 ||
              statsData.limits.tokenLimit > 0 ||
              statsData.limits.rateLimitCost > 0)
          "
        >
          <WindowCountdown
            :cost-limit="statsData.limits.rateLimitCost"
            :current-cost="statsData.limits.currentWindowCost"
            :current-requests="statsData.limits.currentWindowRequests"
            :current-tokens="statsData.limits.currentWindowTokens"
            :label="t('apistats.limit.time_window_limit')"
            :rate-limit-window="statsData.limits.rateLimitWindow"
            :request-limit="statsData.limits.rateLimitRequests"
            :show-progress="true"
            :show-tooltip="true"
            :token-limit="statsData.limits.tokenLimit"
            :window-end-time="statsData.limits.windowEndTime"
            :window-remaining-seconds="statsData.limits.windowRemainingSeconds"
            :window-start-time="statsData.limits.windowStartTime"
          />

          <div class="mt-2 text-xs text-muted-foreground">
            <i class="fas fa-info-circle mr-1" />
            <span v-if="statsData.limits.rateLimitCost > 0">
              {{ t('apistats.limit.window_hint_cost') }}
            </span>
            <span v-else-if="statsData.limits.tokenLimit > 0">
              {{ t('apistats.limit.window_hint_token') }}
            </span>
            <span v-else>{{ t('apistats.limit.window_hint_request') }}</span>
          </div>
        </div>

        <!-- 其他限制信息 -->
        <div class="space-y-4 border-t border-gray-100 pt-3 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground md:text-base">{{
              t('apistats.limit.concurrency_limit')
            }}</span>
            <span class="text-sm font-medium text-gray-900 md:text-base">
              <span v-if="statsData.limits.concurrencyLimit > 0">
                {{ statsData.limits.concurrencyLimit }}
              </span>
              <span v-else class="flex items-center gap-1">
                <i class="fas fa-infinity text-gray-400" />
              </span>
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground md:text-base">{{
              t('apistats.limit.model_restrictions')
            }}</span>
            <span class="text-sm font-medium text-gray-900 md:text-base">
              <span v-if="hasModelRestrictions" class="text-orange-600">
                <i class="fas fa-exclamation-triangle mr-1 text-xs md:text-sm" />
                {{
                  t('apistats.limit.restricted_models_count', {
                    count: statsData.restrictions.restrictedModels.length
                  })
                }}
              </span>
              <span v-else class="text-success">
                <i class="fas fa-check-circle mr-1 text-xs md:text-sm" />
                {{ t('apistats.limit.all_models_allowed') }}
              </span>
            </span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground md:text-base">{{
                t('apistats.limit.client_restrictions')
              }}</span>
              <span class="text-sm font-medium text-gray-900 md:text-base">
                <span v-if="hasClientRestrictions" class="text-orange-600">
                  <i class="fas fa-exclamation-triangle mr-1 text-xs md:text-sm" />
                  {{
                    t('apistats.limit.restricted_clients_count', {
                      count: statsData.restrictions.allowedClients.length
                    })
                  }}
                </span>
                <span v-else class="text-success">
                  <i class="fas fa-check-circle mr-1 text-xs md:text-sm" />
                  {{ t('apistats.limit.all_clients_allowed') }}
                </span>
              </span>
            </div>
            <div
              v-if="hasClientRestrictions"
              class="flex flex-wrap gap-2 rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20 md:p-3"
            >
              <span
                v-for="client in statsData.restrictions.allowedClients"
                :key="client"
                class="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-primary shadow-sm dark:bg-slate-900 dark:text-blue-300 md:text-sm"
              >
                <i class="fas fa-id-badge" />
                {{ client }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 详细限制信息 -->
    <div v-if="hasModelRestrictions" class="card p-4 md:p-6">
      <h3 class="mb-3 flex items-center text-lg font-bold text-foreground md:mb-4 md:text-xl">
        <i class="fas fa-list-alt mr-2 text-sm text-amber-500 md:mr-3 md:text-base" />
        {{ t('apistats.limit.detailed_restrictions') }}
      </h3>

      <div
        class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20 md:p-4"
      >
        <h4
          class="mb-2 flex items-center text-sm font-bold text-amber-800 dark:text-amber-300 md:mb-3 md:text-base"
        >
          <i class="fas fa-robot mr-1 text-xs md:mr-2 md:text-sm" />
          {{ t('apistats.limit.restricted_models_list') }}
        </h4>
        <div class="space-y-1 md:space-y-2">
          <div
            v-for="model in statsData.restrictions.restrictedModels"
            :key="model"
            class="rounded border border-amber-200 bg-white px-2 py-1 text-xs dark:border-amber-700 dark:bg-gray-800 md:px-3 md:py-2 md:text-sm"
          >
            <i class="fas fa-ban mr-1 text-xs text-destructive md:mr-2" />
            <span class="break-all text-foreground">{{ model }}</span>
          </div>
        </div>
        <p class="mt-2 text-xs text-amber-700 dark:text-amber-400 md:mt-3">
          <i class="fas fa-info-circle mr-1" />
          {{ t('apistats.limit.restriction_hint') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useApiStatsStore } from '@/stores/apistats'
import WindowCountdown from '@/components/apikeys/WindowCountdown.vue'

const { t } = useI18n()

const apiStatsStore = useApiStatsStore()
const { statsData, multiKeyMode, aggregatedStats, invalidKeys } = storeToRefs(apiStatsStore)

const hasModelRestrictions = computed(() => {
  const restriction = statsData.value?.restrictions
  if (!restriction) return false
  return (
    restriction.enableModelRestriction === true &&
    Array.isArray(restriction.restrictedModels) &&
    restriction.restrictedModels.length > 0
  )
})

const hasClientRestrictions = computed(() => {
  const restriction = statsData.value?.restrictions
  if (!restriction) return false
  return (
    restriction.enableClientRestriction === true &&
    Array.isArray(restriction.allowedClients) &&
    restriction.allowedClients.length > 0
  )
})

// 获取每日费用进度
const getDailyCostProgress = () => {
  if (!statsData.value.limits.dailyCostLimit || statsData.value.limits.dailyCostLimit === 0)
    return 0
  const percentage =
    (statsData.value.limits.currentDailyCost / statsData.value.limits.dailyCostLimit) * 100
  return Math.min(percentage, 100)
}

// 获取每日费用进度条颜色
const getDailyCostProgressColor = () => {
  const progress = getDailyCostProgress()
  if (progress >= 100) return 'bg-red-500'
  if (progress >= 80) return 'bg-yellow-500'
  return 'bg-green-500'
}

// 获取总费用进度
const getTotalCostProgress = () => {
  if (!statsData.value.limits.totalCostLimit || statsData.value.limits.totalCostLimit === 0)
    return 0
  const percentage =
    (statsData.value.limits.currentTotalCost / statsData.value.limits.totalCostLimit) * 100
  return Math.min(percentage, 100)
}

// 获取总费用进度条颜色
const getTotalCostProgressColor = () => {
  const progress = getTotalCostProgress()
  if (progress >= 100) return 'bg-red-500'
  if (progress >= 80) return 'bg-yellow-500'
  return 'bg-blue-500'
}

// 获取Opus周费用进度
const getOpusWeeklyCostProgress = () => {
  if (
    !statsData.value.limits.weeklyOpusCostLimit ||
    statsData.value.limits.weeklyOpusCostLimit === 0
  )
    return 0
  const percentage =
    (statsData.value.limits.weeklyOpusCost / statsData.value.limits.weeklyOpusCostLimit) * 100
  return Math.min(percentage, 100)
}

// 获取Opus周费用进度条颜色
const getOpusWeeklyCostProgressColor = () => {
  const progress = getOpusWeeklyCostProgress()
  if (progress >= 100) return 'bg-red-500'
  if (progress >= 80) return 'bg-yellow-500'
  return 'bg-indigo-500' // 使用紫色表示Opus模型
}

// 格式化数字
const formatNumber = (num) => {
  if (typeof num !== 'number') {
    num = parseInt(num) || 0
  }

  if (num === 0) return '0'

  // 大数字使用简化格式
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  } else {
    return num.toLocaleString()
  }
}
</script>

<style scoped>
/* 卡片样式 - 使用CSS变量 */
.card {
  background: var(--surface-color);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.15),
    0 10px 10px -5px rgba(0, 0, 0, 0.08);
}

:global(.dark) .card:hover {
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.5),
    0 10px 10px -5px rgba(0, 0, 0, 0.35);
}
</style>
