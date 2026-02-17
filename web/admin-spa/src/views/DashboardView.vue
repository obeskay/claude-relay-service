<template>
  <div>
    <!-- Estadísticas principales -->
    <div
      class="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 md:mb-8 md:gap-6 lg:grid-cols-4"
    >
      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              {{ t('stats.total_api_keys') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
              {{ dashboardData.totalApiKeys }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('stats.active') }}: {{ dashboardData.activeApiKeys || 0 }}
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600">
            <i class="fas fa-key" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              {{ t('stats.service_accounts') }}
            </p>
            <div class="flex flex-wrap items-baseline gap-x-2">
              <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
                {{ dashboardData.totalAccounts }}
              </p>
              <!-- Visualización de cuentas por plataforma -->
              <div v-if="dashboardData.accountsByPlatform" class="flex items-center gap-2">
                <!-- Cuentas Claude -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform.claude &&
                    dashboardData.accountsByPlatform.claude.total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`Claude: ${dashboardData.accountsByPlatform.claude.total} ${t('stats.items')} (${t('stats.normal_label')}: ${dashboardData.accountsByPlatform.claude.normal})`"
                >
                  <i class="fas fa-brain text-xs text-indigo-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform.claude.total
                  }}</span>
                </div>
                <!-- Cuentas Claude Console -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform['claude-console'] &&
                    dashboardData.accountsByPlatform['claude-console'].total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`Console: ${dashboardData.accountsByPlatform['claude-console'].total} cuentas (normal: ${dashboardData.accountsByPlatform['claude-console'].normal})`"
                >
                  <i class="fas fa-terminal text-xs text-purple-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform['claude-console'].total
                  }}</span>
                </div>
                <!-- Cuentas Gemini -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform.gemini &&
                    dashboardData.accountsByPlatform.gemini.total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`Gemini: ${dashboardData.accountsByPlatform.gemini.total} cuentas (normal: ${dashboardData.accountsByPlatform.gemini.normal})`"
                >
                  <i class="fas fa-robot text-xs text-yellow-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform.gemini.total
                  }}</span>
                </div>
                <!-- Cuentas Bedrock -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform.bedrock &&
                    dashboardData.accountsByPlatform.bedrock.total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`Bedrock: ${dashboardData.accountsByPlatform.bedrock.total} cuentas (normal: ${dashboardData.accountsByPlatform.bedrock.normal})`"
                >
                  <i class="fab fa-aws text-xs text-orange-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform.bedrock.total
                  }}</span>
                </div>
                <!-- Cuentas OpenAI -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform.openai &&
                    dashboardData.accountsByPlatform.openai.total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`OpenAI: ${dashboardData.accountsByPlatform.openai.total} cuentas (normal: ${dashboardData.accountsByPlatform.openai.normal})`"
                >
                  <i class="fas fa-openai text-xs text-gray-100" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform.openai.total
                  }}</span>
                </div>
                <!-- Cuentas Azure OpenAI -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform.azure_openai &&
                    dashboardData.accountsByPlatform.azure_openai.total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`Azure OpenAI: ${dashboardData.accountsByPlatform.azure_openai.total} cuentas (normal: ${dashboardData.accountsByPlatform.azure_openai.normal})`"
                >
                  <i class="fab fa-microsoft text-xs text-blue-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform.azure_openai.total
                  }}</span>
                </div>
                <!-- Cuentas OpenAI-Responses -->
                <div
                  v-if="
                    dashboardData.accountsByPlatform['openai-responses'] &&
                    dashboardData.accountsByPlatform['openai-responses'].total > 0
                  "
                  class="inline-flex items-center gap-0.5"
                  :title="`OpenAI Responses: ${dashboardData.accountsByPlatform['openai-responses'].total} cuentas (normal: ${dashboardData.accountsByPlatform['openai-responses'].normal})`"
                >
                  <i class="fas fa-server text-xs text-cyan-600" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    dashboardData.accountsByPlatform['openai-responses'].total
                  }}</span>
                </div>
              </div>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Normal: {{ dashboardData.normalAccounts || 0 }}
              <span v-if="dashboardData.abnormalAccounts > 0" class="text-red-600">
                | Anormal: {{ dashboardData.abnormalAccounts }}
              </span>
              <span
                v-if="dashboardData.pausedAccounts > 0"
                class="text-gray-600 dark:text-gray-400"
              >
                | Pausado: {{ dashboardData.pausedAccounts }}
              </span>
              <span v-if="dashboardData.rateLimitedAccounts > 0" class="text-yellow-600">
                | Limitado: {{ dashboardData.rateLimitedAccounts }}
              </span>
            </p>
          </div>
          <div class="stat-icon ml-2 flex-shrink-0 bg-gradient-to-br from-green-500 to-green-600">
            <i class="fas fa-user-circle" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              {{ t('stats.total_requests') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
              {{ dashboardData.todayRequests }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('stats.total_requests_count') }}:
              {{ formatNumber(dashboardData.totalRequests || 0) }}
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-purple-500 to-purple-600">
            <i class="fas fa-chart-line" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              {{ t('stats.system_status') }}
            </p>
            <p class="text-2xl font-bold text-green-600 sm:text-3xl">
              {{ dashboardData.systemStatus }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('stats.uptime') }}: {{ formattedUptime }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('stats.success_rate') }}: {{ successRate }}%
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-yellow-500 to-orange-500">
            <i class="fas fa-heartbeat" />
          </div>
        </div>
      </div>
    </div>

    <!-- Resumen de saldo/cuota de cuentas -->
    <div class="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 md:mb-8 md:gap-6">
      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              Saldo/Cuota de Cuenta
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
              {{ formatCurrencyUsd(balanceSummary.totalBalance || 0) }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Saldo bajo: {{ balanceSummary.lowBalanceCount || 0 }} | totalCost:
              {{ formatCurrencyUsd(balanceSummary.totalCost || 0) }}
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-emerald-500 to-green-600">
            <i class="fas fa-wallet" />
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between gap-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Actualizado: {{ formatLastUpdate(balanceSummaryUpdatedAt) }}
          </p>
          <button
            class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500"
            :disabled="loadingBalanceSummary"
            @click="loadBalanceSummary"
          >
            <i :class="['fas', loadingBalanceSummary ? 'fa-spinner fa-spin' : 'fa-sync-alt']" />
            Actualizar
          </button>
        </div>
      </div>

      <div class="card p-4 sm:p-6">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Cuentas con Saldo Bajo</h3>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ lowBalanceAccounts.length }} cuentas
          </span>
        </div>

        <div
          v-if="loadingBalanceSummary"
          class="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          Cargando...
        </div>
        <div
          v-else-if="lowBalanceAccounts.length === 0"
          class="py-6 text-center text-sm text-green-600 dark:text-green-400"
        >
          Todo normal
        </div>
        <div v-else class="max-h-64 space-y-2 overflow-y-auto">
          <div
            v-for="account in lowBalanceAccounts"
            :key="account.accountId"
            class="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-900/20"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ account.name || account.accountId }}
              </div>
              <span
                class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {{ getBalancePlatformLabel(account.platform) }}
              </span>
            </div>
            <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
              <span v-if="account.balance">Saldo: {{ account.balance.formattedAmount }}</span>
              <span v-else
                >Costo hoy: {{ formatCurrencyUsd(account.statistics?.dailyCost || 0) }}</span
              >
            </div>
            <div v-if="account.quota && typeof account.quota.percentage === 'number'" class="mt-2">
              <div
                class="mb-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400"
              >
                <span>Uso de cuota</span>
                <span class="text-red-600 dark:text-red-400">
                  {{ account.quota.percentage.toFixed(1) }}%
                </span>
              </div>
              <div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  class="h-2 rounded-full bg-red-500"
                  :style="{ width: `${Math.min(100, account.quota.percentage)}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Estadísticas de tokens e indicadores de rendimiento -->
    <div
      class="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 md:mb-8 md:gap-6 lg:grid-cols-4"
    >
      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div class="mr-8 flex-1">
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              {{ t('stats.today_tokens') }}
            </p>
            <div class="mb-2 flex flex-wrap items-baseline gap-2">
              <p class="text-xl font-bold text-blue-600 sm:text-2xl md:text-3xl">
                {{
                  formatNumber(
                    (dashboardData.todayInputTokens || 0) +
                      (dashboardData.todayOutputTokens || 0) +
                      (dashboardData.todayCacheCreateTokens || 0) +
                      (dashboardData.todayCacheReadTokens || 0)
                  )
                }}
              </p>
              <span class="text-sm font-medium text-green-600"
                >/ {{ costsData.todayCosts.formatted.totalCost }}</span
              >
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              <div class="flex flex-wrap items-center justify-between gap-x-4">
                <span
                  >{{ t('stats.input') }}:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.todayInputTokens || 0)
                  }}</span></span
                >
                <span
                  >{{ t('stats.output') }}:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.todayOutputTokens || 0)
                  }}</span></span
                >
                <span v-if="(dashboardData.todayCacheCreateTokens || 0) > 0" class="text-purple-600"
                  >{{ t('stats.cache_create') }}:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.todayCacheCreateTokens || 0)
                  }}</span></span
                >
                <span v-if="(dashboardData.todayCacheReadTokens || 0) > 0" class="text-purple-600"
                  >{{ t('stats.cache_read') }}:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.todayCacheReadTokens || 0)
                  }}</span></span
                >
              </div>
            </div>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-indigo-500 to-indigo-600">
            <i class="fas fa-coins" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div class="mr-8 flex-1">
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              {{ t('stats.total_token_consumption') }}
            </p>
            <div class="mb-2 flex flex-wrap items-baseline gap-2">
              <p class="text-xl font-bold text-emerald-600 sm:text-2xl md:text-3xl">
                {{
                  formatNumber(
                    (dashboardData.totalInputTokens || 0) +
                      (dashboardData.totalOutputTokens || 0) +
                      (dashboardData.totalCacheCreateTokens || 0) +
                      (dashboardData.totalCacheReadTokens || 0)
                  )
                }}
              </p>
              <span class="text-sm font-medium text-green-600"
                >/ {{ costsData.totalCosts.formatted.totalCost }}</span
              >
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              <div class="flex flex-wrap items-center justify-between gap-x-4">
                <span
                  >{{ t('stats.input') }}:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.totalInputTokens || 0)
                  }}</span></span
                >
                <span
                  >{{ t('stats.output') }}:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.totalOutputTokens || 0)
                  }}</span></span
                >
                <span v-if="(dashboardData.totalCacheCreateTokens || 0) > 0" class="text-purple-600"
                  >{{ t('stats.cache_create') }}:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.totalCacheCreateTokens || 0)
                  }}</span></span
                >
                <span v-if="(dashboardData.totalCacheReadTokens || 0) > 0" class="text-purple-600"
                  >{{ t('stats.cache_read') }}:
                  <span class="font-medium">{{
                    formatNumber(dashboardData.totalCacheReadTokens || 0)
                  }}</span></span
                >
              </div>
            </div>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-600">
            <i class="fas fa-database" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              {{ t('stats.realtime_rpm') }}
              <span class="text-xs text-gray-400">({{ dashboardData.metricsWindow }}minutos)</span>
            </p>
            <p class="text-2xl font-bold text-orange-600 sm:text-3xl">
              {{ dashboardData.realtimeRPM || 0 }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('stats.requests_per_minute') }}
              <span v-if="dashboardData.isHistoricalMetrics" class="text-yellow-600">
                <i class="fas fa-exclamation-circle" /> {{ t('stats.historical_data') }}
              </span>
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-orange-500 to-orange-600">
            <i class="fas fa-tachometer-alt" />
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400 sm:text-sm">
              {{ t('stats.realtime_tpm') }}
              <span class="text-xs text-gray-400">({{ dashboardData.metricsWindow }}minutos)</span>
            </p>
            <p class="text-2xl font-bold text-rose-600 sm:text-3xl">
              {{ formatNumber(dashboardData.realtimeTPM || 0) }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('stats.tokens_per_minute') }}
              <span v-if="dashboardData.isHistoricalMetrics" class="text-yellow-600">
                <i class="fas fa-exclamation-circle" /> {{ t('stats.historical_data') }}
              </span>
            </p>
          </div>
          <div class="stat-icon flex-shrink-0 bg-gradient-to-br from-rose-500 to-rose-600">
            <i class="fas fa-rocket" />
          </div>
        </div>
      </div>
    </div>

    <!-- Estadísticas de consumo por modelo -->
    <div class="mb-8">
      <div class="mb-4 flex flex-col gap-4 sm:mb-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
          {{ t('stats.model_usage_and_token_trend') }}
        </h3>
        <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
          <!-- Selección rápida de fecha -->
          <div
            class="flex flex-shrink-0 gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-700"
          >
            <button
              v-for="option in dateFilter.presetOptions"
              :key="option.value"
              :class="[
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                dateFilter.preset === option.value && dateFilter.type === 'preset'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="setDateFilterPreset(option.value)"
            >
              {{ option.label }}
            </button>
          </div>

          <!-- Botones de cambio de granularidad -->
          <div class="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            <button
              :class="[
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                trendGranularity === 'day'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="setTrendGranularity('day')"
            >
              <i class="fas fa-calendar-day mr-1" />{{ t('trend.by_day') }}
            </button>
            <button
              :class="[
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                trendGranularity === 'hour'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="setTrendGranularity('hour')"
            >
              <i class="fas fa-clock mr-1" />{{ t('trend.by_hour') }}
            </button>
          </div>

          <!-- Selector de rango de fechas Element Plus -->
          <div class="flex items-center gap-2">
            <el-date-picker
              v-model="dateFilter.customRange"
              class="custom-date-picker w-full lg:w-auto"
              :default-time="defaultTime"
              :disabled-date="disabledDate"
              :end-placeholder="t('date.end_placeholder')"
              format="YYYY-MM-DD HH:mm:ss"
              :range-separator="t('date.separator')"
              size="default"
              :start-placeholder="t('date.start_placeholder')"
              style="max-width: 400px"
              type="datetimerange"
              value-format="YYYY-MM-DD HH:mm:ss"
              @change="onCustomDateRangeChange"
            />
            <span v-if="trendGranularity === 'hour'" class="text-xs text-orange-600">
              <i class="fas fa-info-circle" /> {{ t('trend.max_24h') }}
            </span>
          </div>

          <!-- Control de actualización -->
          <div class="flex items-center gap-2">
            <!-- Control de actualización automática -->
            <div class="flex items-center rounded-lg bg-gray-100 px-3 py-1 dark:bg-gray-700">
              <label class="relative inline-flex cursor-pointer items-center">
                <input v-model="autoRefreshEnabled" class="peer sr-only" type="checkbox" />
                <!-- Switch más pequeño -->
                <div
                  class="peer relative h-5 w-9 rounded-full bg-gray-300 transition-all duration-200 after:absolute after:left-[2px] after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 after:content-[''] peer-checked:bg-blue-500 peer-checked:after:translate-x-4 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:bg-gray-600 dark:after:bg-gray-300 dark:peer-focus:ring-blue-600"
                />
                <span
                  class="ml-2.5 flex select-none items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300"
                >
                  <i class="fas fa-redo-alt text-xs text-gray-500 dark:text-gray-400" />
                  <span>{{ t('refresh.auto_refresh') }}</span>
                  <span
                    v-if="autoRefreshEnabled"
                    class="ml-1 font-mono text-xs text-blue-600 transition-opacity"
                    :class="refreshCountdown > 0 ? 'opacity-100' : 'opacity-0'"
                  >
                    {{ refreshCountdown }}s
                  </span>
                </span>
              </label>
            </div>

            <!-- Botón de actualización -->
            <button
              class="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-blue-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 sm:gap-2"
              :disabled="isRefreshing"
              :title="t('refresh.refresh_now')"
              @click="refreshAllData()"
            >
              <i :class="['fas fa-sync-alt text-xs', { 'animate-spin': isRefreshing }]" />
              <span class="hidden sm:inline">{{
                isRefreshing ? t('refresh.refreshing') : t('refresh.refresh')
              }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Gráfico de pastel -->
        <div class="card p-4 sm:p-6">
          <h4 class="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200 sm:text-lg">
            {{ t('stats.token_usage_distribution') }}
          </h4>
          <div class="relative" style="height: 250px">
            <canvas ref="modelUsageChart" />
          </div>
        </div>

        <!-- Tabla de datos detallados -->
        <div class="card p-4 sm:p-6">
          <h4 class="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200 sm:text-lg">
            {{ t('stats.detailed_statistics') }}
          </h4>
          <div v-if="dashboardModelStats.length === 0" class="py-8 text-center">
            <p class="text-sm text-gray-500 sm:text-base">{{ t('stats.no_model_usage_data') }}</p>
          </div>
          <div v-else class="max-h-[250px] overflow-auto sm:max-h-[300px]">
            <table class="min-w-full">
              <thead class="sticky top-0 bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    class="px-2 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 sm:px-4"
                  >
                    {{ t('stats.model') }}
                  </th>
                  <th
                    class="hidden px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 sm:table-cell sm:px-4"
                  >
                    {{ t('stats.requests') }}
                  </th>
                  <th
                    class="px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 sm:px-4"
                  >
                    {{ t('stats.total_tokens') }}
                  </th>
                  <th
                    class="px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 sm:px-4"
                  >
                    {{ t('stats.cost') }}
                  </th>
                  <th
                    class="hidden px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 sm:table-cell sm:px-4"
                  >
                    {{ t('stats.proportion') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-600">
                <tr
                  v-for="stat in dashboardModelStats"
                  :key="stat.model"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td class="px-2 py-2 text-xs text-gray-900 dark:text-gray-100 sm:px-4 sm:text-sm">
                    <span class="block max-w-[100px] truncate sm:max-w-none" :title="stat.model">
                      {{ stat.model }}
                    </span>
                  </td>
                  <td
                    class="hidden px-2 py-2 text-right text-xs text-gray-600 dark:text-gray-400 sm:table-cell sm:px-4 sm:text-sm"
                  >
                    {{ formatNumber(stat.requests) }}
                  </td>
                  <td
                    class="px-2 py-2 text-right text-xs text-gray-600 dark:text-gray-400 sm:px-4 sm:text-sm"
                  >
                    {{ formatNumber(stat.allTokens) }}
                  </td>
                  <td
                    class="px-2 py-2 text-right text-xs font-medium text-green-600 sm:px-4 sm:text-sm"
                  >
                    {{ stat.formatted ? stat.formatted.total : '$0.000000' }}
                  </td>
                  <td
                    class="hidden px-2 py-2 text-right text-xs font-medium sm:table-cell sm:px-4 sm:text-sm"
                  >
                    <span
                      class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {{ calculatePercentage(stat.allTokens, dashboardModelStats) }}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Gráfico de tendencia de uso de tokens -->
    <div class="mb-4 sm:mb-6 md:mb-8">
      <div class="card p-4 sm:p-6">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-xs font-semibold text-gray-700 dark:text-gray-300 sm:text-sm">
            {{ t('stats.token_usage_trend') }}
          </h2>
          <!-- Botón de actualización -->
          <button
            class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 sm:px-3 sm:py-1.5 sm:text-sm"
            :class="{ 'opacity-70': isRefreshing }"
            :disabled="isRefreshing"
            @click="refreshAllData"
          >
            <i class="fas fa-sync-alt" :class="{ 'animate-spin': isRefreshing }" />
            {{ isRefreshing ? t('refresh.refreshing') : t('refresh.refresh') }}
          </button>
        </div>
        <div class="sm:h-[300px]" style="height: 250px">
          <canvas ref="usageTrendChart" />
        </div>
      </div>
    </div>

    <!-- Gráfico de tendencia de uso de API Keys -->
    <div class="mb-4 sm:mb-6 md:mb-8">
      <div class="card p-4 sm:p-6">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">
            {{ t('stats.api_keys_usage_trend') }}
          </h3>
          <!-- Botones de cambio de dimensión -->
          <div class="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            <button
              :class="[
                'rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
                apiKeysTrendMetric === 'requests'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="((apiKeysTrendMetric = 'requests'), updateApiKeysUsageTrendChart())"
            >
              <i class="fas fa-exchange-alt mr-1" /><span class="hidden sm:inline">{{
                t('stats.requests_count')
              }}</span
              ><span class="sm:hidden">{{ t('stats.requests') }}</span>
            </button>
            <button
              :class="[
                'rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
                apiKeysTrendMetric === 'tokens'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              ]"
              @click="((apiKeysTrendMetric = 'tokens'), updateApiKeysUsageTrendChart())"
            >
              <i class="fas fa-coins mr-1" /><span class="hidden sm:inline">{{
                t('stats.token_quantity')
              }}</span
              ><span class="sm:hidden">{{ t('stats.tokens') }}</span>
            </button>
          </div>
        </div>
        <div class="mb-4 text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
          <span v-if="apiKeysTrendData.totalApiKeys > 10">
            {{ t('stats.total') }} {{ apiKeysTrendData.totalApiKeys }}
            {{ t('stats.api_key_items') }}，{{ t('stats.display_top_10') }}
          </span>
          <span v-else>
            {{ t('stats.total') }} {{ apiKeysTrendData.totalApiKeys }}
            {{ t('stats.api_key_items') }}
          </span>
        </div>
        <div class="sm:h-[350px]" style="height: 300px">
          <canvas ref="apiKeysUsageTrendChart" />
        </div>
      </div>
    </div>

    <!-- Gráfico de tendencia de uso de cuentas -->
    <div class="mb-4 sm:mb-6 md:mb-8">
      <div class="card p-4 sm:p-6">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">
              {{ t('stats.account_usage_trend') }}
            </h3>
            <span class="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
              {{ t('stats.current_group') }}：{{
                accountUsageTrendData.groupLabel || t('stats.not_selected')
              }}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
              <button
                v-for="option in accountGroupOptions"
                :key="option.value"
                :class="[
                  'rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
                  accountUsageGroup === option.value
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
                ]"
                @click="handleAccountUsageGroupChange(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
        <div
          class="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400 sm:text-sm"
        >
          <span
            >{{ t('stats.total') }} {{ accountUsageTrendData.totalAccounts || 0 }}
            {{ t('stats.account_items') }}</span
          >
          <span
            v-if="accountUsageTrendData.topAccounts && accountUsageTrendData.topAccounts.length"
          >
            {{ t('stats.display_top_n_accounts', { n: accountUsageTrendData.topAccounts.length }) }}
          </span>
        </div>
        <div
          v-if="!accountUsageTrendData.data || accountUsageTrendData.data.length === 0"
          class="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {{ t('stats.no_account_usage_data') }}
        </div>
        <div v-else class="sm:h-[350px]" style="height: 300px">
          <canvas ref="accountUsageTrendChart" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import Chart from 'chart.js/auto'

import { useDashboardStore } from '@/stores/dashboard'
import { useThemeStore } from '@/stores/theme'
import { formatNumber, showToast } from '@/utils/tools'

import { getBalanceSummaryApi } from '@/utils/http_apis'

const dashboardStore = useDashboardStore()
const themeStore = useThemeStore()
const { t } = useI18n()
const { isDarkMode } = storeToRefs(themeStore)

const {
  dashboardData,
  costsData,
  dashboardModelStats,
  trendData,
  apiKeysTrendData,
  accountUsageTrendData,
  accountUsageGroup,
  formattedUptime,
  dateFilter,
  trendGranularity,
  apiKeysTrendMetric
} = storeToRefs(dashboardStore)

const {
  loadDashboardData,
  loadApiKeysTrend,
  setDateFilterPreset,
  onCustomDateRangeChange,
  setTrendGranularity,
  refreshChartsData,
  setAccountUsageGroup,
  disabledDate
} = dashboardStore

// Hora predeterminada del selector de fecha
const defaultTime = [new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 2, 1, 23, 59, 59)]

// Instancia de gráfico
const modelUsageChart = ref(null)
const usageTrendChart = ref(null)
const apiKeysUsageTrendChart = ref(null)
const accountUsageTrendChart = ref(null)
let modelUsageChartInstance = null
let usageTrendChartInstance = null
let apiKeysUsageTrendChartInstance = null
let accountUsageTrendChartInstance = null

const accountGroupOptions = [
  { value: 'claude', label: 'Claude' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'droid', label: 'Droid' }
]

const accountTrendUpdating = ref(false)

// Resumen de saldo/cuota
const balanceSummary = ref({
  totalBalance: 0,
  totalCost: 0,
  lowBalanceCount: 0,
  platforms: {}
})
const loadingBalanceSummary = ref(false)
const balanceSummaryUpdatedAt = ref(null)

const getBalancePlatformLabel = (platform) => {
  const map = {
    claude: 'Claude',
    'claude-console': 'Claude Console',
    gemini: 'Gemini',
    'gemini-api': 'Gemini API',
    openai: 'OpenAI',
    'openai-responses': 'OpenAI Responses',
    azure_openai: 'Azure OpenAI',
    bedrock: 'Bedrock',
    droid: 'Droid',
    ccr: 'CCR'
  }
  return map[platform] || platform
}

const lowBalanceAccounts = computed(() => {
  const result = []
  const platforms = balanceSummary.value?.platforms || {}

  Object.entries(platforms).forEach(([platform, data]) => {
    const list = Array.isArray(data?.accounts) ? data.accounts : []
    list.forEach((entry) => {
      const accountData = entry?.data
      if (!accountData) return

      const amount = accountData.balance?.amount
      const percentage = accountData.quota?.percentage

      const isLowBalance = typeof amount === 'number' && amount < 10
      const isHighUsage = typeof percentage === 'number' && percentage > 90

      if (isLowBalance || isHighUsage) {
        result.push({
          ...accountData,
          name: entry?.name || accountData.accountId,
          platform: accountData.platform || platform
        })
      }
    })
  })

  return result
})

const formatCurrencyUsd = (amount) => {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '$0.00'
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.01) return `$${value.toFixed(3)}`
  return `$${value.toFixed(6)}`
}

const formatLastUpdate = (isoString) => {
  if (!isoString) return 'Desconocido'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Desconocido'
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

const loadBalanceSummary = async () => {
  loadingBalanceSummary.value = true
  const response = await getBalanceSummaryApi()
  if (response?.success) {
    balanceSummary.value = response.data || {
      totalBalance: 0,
      totalCost: 0,
      lowBalanceCount: 0,
      platforms: {}
    }
    balanceSummaryUpdatedAt.value = new Date().toISOString()
  } else if (response?.message) {
    console.debug('Error al cargar resumen de saldo:', response.message)
    showToast('Error al cargar resumen de saldo', 'error')
  }
  loadingBalanceSummary.value = false
}

// Relacionado con actualización automática
const autoRefreshEnabled = ref(false)
const autoRefreshInterval = ref(30) // segundos
const autoRefreshTimer = ref(null)
const refreshCountdown = ref(0)
const countdownTimer = ref(null)
const isRefreshing = ref(false)

// Calcular visualización de cuenta regresiva
// const refreshCountdownDisplay = computed(() => {
//   if (!autoRefreshEnabled.value || refreshCountdown.value <= 0) return ''
//   return `Refrescar en ${refreshCountdown.value} segundos`
// })

// Configuración de colores del gráfico (ajustada dinámicamente según el tema)
const chartColors = computed(() => ({
  text: isDarkMode.value ? '#e5e7eb' : '#374151',
  grid: isDarkMode.value ? 'rgba(75, 85, 99, 0.3)' : 'rgba(0, 0, 0, 0.1)',
  legend: isDarkMode.value ? '#e5e7eb' : '#374151'
}))

function formatCostValue(cost) {
  if (!Number.isFinite(cost)) {
    return '$0.000000'
  }
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`
  }
  if (cost >= 0.01) {
    return `$${cost.toFixed(3)}`
  }
  return `$${cost.toFixed(6)}`
}

// Calcular porcentaje
function calculatePercentage(value, stats) {
  if (!stats || stats.length === 0) return 0
  const total = stats.reduce((sum, stat) => sum + stat.allTokens, 0)
  if (total === 0) return 0
  return ((value / total) * 100).toFixed(1)
}

// Crear gráfico de pastel de uso de modelos
function createModelUsageChart() {
  if (!modelUsageChart.value) return

  const data = dashboardModelStats.value || []
  const chartData = {
    labels: data.map((d) => d.model),
    datasets: [
      {
        data: data.map((d) => d.allTokens),
        backgroundColor: [
          '#3B82F6',
          '#10B981',
          '#F59E0B',
          '#EF4444',
          '#8B5CF6',
          '#EC4899',
          '#14B8A6',
          '#F97316',
          '#6366F1',
          '#84CC16'
        ],
        borderWidth: 0
      }
    ]
  }

  // Update existing chart instead of recreating
  if (modelUsageChartInstance) {
    modelUsageChartInstance.data = chartData
    // Update theme-dependent options
    modelUsageChartInstance.options.plugins.legend.labels.color = chartColors.value.legend
    modelUsageChartInstance.update('none') // 'none' mode skips animations for faster updates
    return
  }

  modelUsageChartInstance = new Chart(modelUsageChart.value, {
    type: 'doughnut',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true,
            font: {
              size: 12
            },
            color: chartColors.value.legend
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || ''
              const value = formatNumber(context.parsed)
              const percentage = calculatePercentage(context.parsed, data)
              return `${label}: ${value} (${percentage}%)`
            }
          }
        }
      }
    }
  })
}

// Crear gráfico de tendencia de uso
function createUsageTrendChart() {
  if (!usageTrendChart.value) return

  const data = trendData.value || []

  // Preparar datos multidimensionales
  const inputData = data.map((d) => d.inputTokens || 0)
  const outputData = data.map((d) => d.outputTokens || 0)
  const cacheCreateData = data.map((d) => d.cacheCreateTokens || 0)
  const cacheReadData = data.map((d) => d.cacheReadTokens || 0)
  const requestsData = data.map((d) => d.requests || 0)
  const costData = data.map((d) => d.cost || 0)

  // Determinar campo de etiqueta y formato según el tipo de datos
  const labelField = data[0]?.date ? 'date' : 'hour'
  const labels = data.map((d) => {
    // Priorizar el campo de etiqueta proporcionado por el backend
    if (d.label) {
      return d.label
    }

    if (labelField === 'hour') {
      // Formatear visualización de hora
      const date = new Date(d.hour)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      return `${month}/${day} ${hour}:00`
    }
    // Al mostrar por día, solo mostrar mes/día, no año
    const dateStr = d.date
    if (dateStr && dateStr.includes('-')) {
      const parts = dateStr.split('-')
      if (parts.length >= 3) {
        return `${parts[1]}/${parts[2]}`
      }
    }
    return d.date
  })

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Token de Entrada',
        data: inputData,
        borderColor: themeStore.currentColorScheme.primary,
        backgroundColor: `${themeStore.currentColorScheme.primary}1a`,
        tension: 0.3
      },
      {
        label: 'Token de Salida',
        data: outputData,
        borderColor: themeStore.currentColorScheme.accent,
        backgroundColor: `${themeStore.currentColorScheme.accent}1a`,
        tension: 0.3
      },
      {
        label: 'Token de Creación de Caché',
        data: cacheCreateData,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3
      },
      {
        label: 'Token de Lectura de Caché',
        data: cacheReadData,
        borderColor: themeStore.currentColorScheme.secondary,
        backgroundColor: `${themeStore.currentColorScheme.secondary}1a`,
        tension: 0.3
      },
      {
        label: 'Costo (USD)',
        data: costData,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.3,
        yAxisID: 'y2'
      },
      {
        label: 'Número de Solicitudes',
        data: requestsData,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        yAxisID: 'y1'
      }
    ]
  }

  // Update existing chart instead of recreating
  if (usageTrendChartInstance) {
    usageTrendChartInstance.data = chartData
    // Update theme-dependent options
    const opts = usageTrendChartInstance.options
    opts.plugins.title.color = chartColors.value.text
    opts.plugins.legend.labels.color = chartColors.value.legend
    opts.scales.x.title.color = chartColors.value.text
    opts.scales.x.ticks.color = chartColors.value.text
    opts.scales.x.grid.color = chartColors.value.grid
    opts.scales.y.title.color = chartColors.value.text
    opts.scales.y.ticks.color = chartColors.value.text
    opts.scales.y.grid.color = chartColors.value.grid
    opts.scales.y1.title.color = chartColors.value.text
    opts.scales.y1.ticks.color = chartColors.value.text
    usageTrendChartInstance.update('none')
    return
  }

  usageTrendChartInstance = new Chart(usageTrendChart.value, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: 'Tendencia de uso de tokens',
          font: {
            size: 16,
            weight: 'bold'
          },
          color: chartColors.value.text
        },
        legend: {
          position: 'top',
          labels: {
            color: chartColors.value.legend
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          itemSort: function (a, b) {
            // Ordenar por valor descendente, manejo especial de costo y solicitudes
            const aLabel = a.dataset.label || ''
            const bLabel = b.dataset.label || ''

            // Costo y solicitudes usan ejes diferentes, manejo por separado
            if (aLabel === 'Costo (USD)' || bLabel === 'Costo (USD)') {
              return aLabel === 'Costo (USD)' ? -1 : 1
            }
            if (aLabel === 'Número de Solicitudes' || bLabel === 'Número de Solicitudes') {
              return aLabel === 'Número de Solicitudes' ? 1 : -1
            }

            // Otros ordenar por valor de token descendente
            return b.parsed.y - a.parsed.y
          },
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || ''
              let value = context.parsed.y

              if (label === 'Costo (USD)') {
                // Formatear visualización de costo
                if (value < 0.01) {
                  return label + ': $' + value.toFixed(6)
                } else {
                  return label + ': $' + value.toFixed(4)
                }
              } else if (label === 'Número de Solicitudes') {
                return label + ': ' + value.toLocaleString() + ' veces'
              } else {
                // Formatear visualización de cantidad de tokens
                if (value >= 1000000) {
                  return label + ': ' + (value / 1000000).toFixed(2) + 'M tokens'
                } else if (value >= 1000) {
                  return label + ': ' + (value / 1000).toFixed(2) + 'K tokens'
                } else {
                  return label + ': ' + value.toLocaleString() + ' tokens'
                }
              }
            }
          }
        }
      },
      scales: {
        x: {
          type: 'category',
          display: true,
          title: {
            display: true,
            text: trendGranularity === 'hour' ? 'Hora' : 'Fecha',
            color: chartColors.value.text
          },
          ticks: {
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          min: 0,
          title: {
            display: true,
            text: 'Cantidad de tokens',
            color: chartColors.value.text
          },
          ticks: {
            callback: function (value) {
              return formatNumber(value)
            },
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          title: {
            display: true,
            text: 'Solicitudes',
            color: chartColors.value.text
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: function (value) {
              return value.toLocaleString()
            },
            color: chartColors.value.text
          }
        },
        y2: {
          type: 'linear',
          display: false, // Ocultar eje de costo, mostrar en tooltip
          position: 'right',
          min: 0
        }
      }
    }
  })
}

// Crear gráfico de tendencia de uso de API Keys
function createApiKeysUsageTrendChart() {
  if (!apiKeysUsageTrendChart.value) return

  const data = apiKeysTrendData.value.data || []
  const metric = apiKeysTrendMetric.value

  // Array de colores
  const colors = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#F97316',
    '#6366F1',
    '#84CC16'
  ]

  // Preparar datasets
  const datasets =
    apiKeysTrendData.value.topApiKeys?.map((apiKeyId, index) => {
      const data = apiKeysTrendData.value.data.map((item) => {
        if (!item.apiKeys || !item.apiKeys[apiKeyId]) return 0
        return metric === 'tokens'
          ? item.apiKeys[apiKeyId].tokens
          : item.apiKeys[apiKeyId].requests || 0
      })

      // Obtener nombre de API Key
      const apiKeyName =
        apiKeysTrendData.value.data.find((item) => item.apiKeys && item.apiKeys[apiKeyId])?.apiKeys[
          apiKeyId
        ]?.name || `API Key ${apiKeyId}`

      return {
        label: apiKeyName,
        data: data,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '20',
        tension: 0.4,
        fill: false
      }
    }) || []

  // Determinar campo de etiqueta según el tipo de datos
  const labelField = data[0]?.date ? 'date' : 'hour'

  const chartData = {
    labels: data.map((d) => {
      // Priorizar el campo de etiqueta proporcionado por el backend
      if (d.label) {
        return d.label
      }

      if (labelField === 'hour') {
        // Formatear visualización de hora
        const date = new Date(d.hour)
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hour = String(date.getHours()).padStart(2, '0')
        return `${month}/${day} ${hour}:00`
      }
      // Al mostrar por día, solo mostrar mes/día, no año
      const dateStr = d.date
      if (dateStr && dateStr.includes('-')) {
        const parts = dateStr.split('-')
        if (parts.length >= 3) {
          return `${parts[1]}/${parts[2]}`
        }
      }
      return d.date
    }),
    datasets: datasets
  }

  // Update existing chart instead of recreating
  if (apiKeysUsageTrendChartInstance) {
    apiKeysUsageTrendChartInstance.data = chartData
    // Update theme-dependent options
    const opts = apiKeysUsageTrendChartInstance.options
    opts.plugins.legend.labels.color = chartColors.value.legend
    opts.scales.x.title.color = chartColors.value.text
    opts.scales.x.ticks.color = chartColors.value.text
    opts.scales.x.grid.color = chartColors.value.grid
    opts.scales.y.title.color = chartColors.value.text
    opts.scales.y.title.text = metric === 'tokens' ? 'Cantidad de tokens' : 'Número de solicitudes'
    opts.scales.y.ticks.color = chartColors.value.text
    opts.scales.y.grid.color = chartColors.value.grid
    apiKeysUsageTrendChartInstance.update('none')
    return
  }

  apiKeysUsageTrendChartInstance = new Chart(apiKeysUsageTrendChart.value, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            font: {
              size: 12
            },
            color: chartColors.value.legend
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          itemSort: function (a, b) {
            // Ordenar por valor descendente
            return b.parsed.y - a.parsed.y
          },
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || ''
              const value = context.parsed.y
              const dataIndex = context.dataIndex
              const dataPoint = apiKeysTrendData.value.data[dataIndex]

              // Obtener valores de todos los conjuntos de datos en este punto de tiempo para clasificación
              const allValues = context.chart.data.datasets
                .map((dataset, idx) => ({
                  value: dataset.data[dataIndex] || 0,
                  index: idx
                }))
                .sort((a, b) => b.value - a.value)

              // Encontrar la clasificación del conjunto de datos actual
              const rank = allValues.findIndex((item) => item.index === context.datasetIndex) + 1

              // Preparar identificador de clasificación
              let rankIcon = ''
              if (rank === 1) rankIcon = '🥇 '
              else if (rank === 2) rankIcon = '🥈 '
              else if (rank === 3) rankIcon = '🥉 '

              if (apiKeysTrendMetric.value === 'tokens') {
                // Formatear visualización de tokens
                let formattedValue = ''
                if (value >= 1000000) {
                  formattedValue = (value / 1000000).toFixed(2) + 'M'
                } else if (value >= 1000) {
                  formattedValue = (value / 1000).toFixed(2) + 'K'
                } else {
                  formattedValue = value.toLocaleString()
                }

                // Obtener información de costo de API Key correspondiente
                const apiKeyId = apiKeysTrendData.value.topApiKeys[context.datasetIndex]
                const apiKeyData = dataPoint?.apiKeys?.[apiKeyId]
                const cost = apiKeyData?.formattedCost || '$0.00'

                return `${rankIcon}${label}: ${formattedValue} tokens (${cost})`
              } else {
                return `${rankIcon}${label}: ${value.toLocaleString()} veces`
              }
            }
          }
        }
      },
      scales: {
        x: {
          type: 'category',
          display: true,
          title: {
            display: true,
            text: trendGranularity === 'hour' ? 'Hora' : 'Fecha',
            color: chartColors.value.text
          },
          ticks: {
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        },
        y: {
          beginAtZero: true,
          min: 0,
          title: {
            display: true,
            text: apiKeysTrendMetric.value === 'tokens' ? 'Cantidad de tokens' : 'Número de solicitudes',
            color: chartColors.value.text
          },
          ticks: {
            callback: function (value) {
              return formatNumber(value)
            },
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        }
      }
    }
  })
}

// Actualizar gráfico de tendencia de uso de API Keys
async function updateApiKeysUsageTrendChart() {
  await loadApiKeysTrend(apiKeysTrendMetric.value)
  await nextTick()
  createApiKeysUsageTrendChart()
}

function createAccountUsageTrendChart() {
  if (!accountUsageTrendChart.value) return

  const trend = accountUsageTrendData.value?.data || []
  const topAccounts = accountUsageTrendData.value?.topAccounts || []

  const colors = [
    '#2563EB',
    '#059669',
    '#D97706',
    '#DC2626',
    '#7C3AED',
    '#F472B6',
    '#0EA5E9',
    '#F97316',
    '#6366F1',
    '#22C55E'
  ]

  const datasets = topAccounts.map((accountId, index) => {
    const dataPoints = trend.map((item) => {
      if (!item.accounts || !item.accounts[accountId]) return 0
      return item.accounts[accountId].cost || 0
    })

    const accountName =
      trend.find((item) => item.accounts && item.accounts[accountId])?.accounts[accountId]?.name ||
      `Cuenta ${String(accountId).slice(0, 6)}`

    return {
      label: accountName,
      data: dataPoints,
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '20',
      tension: 0.4,
      fill: false
    }
  })

  const labelField = trend[0]?.date ? 'date' : 'hour'

  const chartData = {
    labels: trend.map((item) => {
      if (item.label) {
        return item.label
      }

      if (labelField === 'hour') {
        const date = new Date(item.hour)
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hour = String(date.getHours()).padStart(2, '0')
        return `${month}/${day} ${hour}:00`
      }

      if (item.date && item.date.includes('-')) {
        const parts = item.date.split('-')
        if (parts.length >= 3) {
          return `${parts[1]}/${parts[2]}`
        }
      }

      return item.date
    }),
    datasets
  }

  const topAccountIds = topAccounts

  // Update existing chart instead of recreating
  if (accountUsageTrendChartInstance) {
    accountUsageTrendChartInstance.data = chartData
    // Update theme-dependent options
    const opts = accountUsageTrendChartInstance.options
    opts.plugins.legend.labels.color = chartColors.value.legend
    opts.scales.x.title.color = chartColors.value.text
    opts.scales.x.title.text = trendGranularity.value === 'hour' ? 'Hora' : 'Fecha'
    opts.scales.x.ticks.color = chartColors.value.text
    opts.scales.x.grid.color = chartColors.value.grid
    opts.scales.y.title.color = chartColors.value.text
    opts.scales.y.ticks.color = chartColors.value.text
    opts.scales.y.grid.color = chartColors.value.grid
    accountUsageTrendChartInstance.update('none')
    return
  }

  accountUsageTrendChartInstance = new Chart(accountUsageTrendChart.value, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            font: {
              size: 12
            },
            color: chartColors.value.legend
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          itemSort: (a, b) => b.parsed.y - a.parsed.y,
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || ''
              const value = context.parsed.y || 0
              const dataIndex = context.dataIndex
              const datasetIndex = context.datasetIndex
              const accountId = topAccountIds[datasetIndex]
              const dataPoint = accountUsageTrendData.value.data[dataIndex]
              const accountDetail = dataPoint?.accounts?.[accountId]

              const allValues = context.chart.data.datasets
                .map((dataset, idx) => ({
                  value: dataset.data[dataIndex] || 0,
                  index: idx
                }))
                .sort((a, b) => b.value - a.value)

              const rank = allValues.findIndex((item) => item.index === datasetIndex) + 1
              let rankIcon = ''
              if (rank === 1) rankIcon = '🥇 '
              else if (rank === 2) rankIcon = '🥈 '
              else if (rank === 3) rankIcon = '🥉 '

              const formattedCost = accountDetail?.formattedCost || formatCostValue(value)
              const requests = accountDetail?.requests || 0

              return `${rankIcon}${label}: ${formattedCost} / ${requests.toLocaleString()} veces`
            }
          }
        }
      },
      scales: {
        x: {
          type: 'category',
          display: true,
          title: {
            display: true,
            text: trendGranularity.value === 'hour' ? 'Hora' : 'Fecha',
            color: chartColors.value.text
          },
          ticks: {
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        },
        y: {
          beginAtZero: true,
          min: 0,
          title: {
            display: true,
            text: 'Monto consumido (USD)',
            color: chartColors.value.text
          },
          ticks: {
            callback: (value) => formatCostValue(Number(value)),
            color: chartColors.value.text
          },
          grid: {
            color: chartColors.value.grid
          }
        }
      }
    }
  })
}

async function handleAccountUsageGroupChange(group) {
  if (accountUsageGroup.value === group || accountTrendUpdating.value) {
    return
  }
  accountTrendUpdating.value = true
  try {
    await setAccountUsageGroup(group)
    await nextTick()
    createAccountUsageTrendChart()
  } finally {
    accountTrendUpdating.value = false
  }
}

// Escuchar cambios de datos para actualizar gráficos
watch(dashboardModelStats, () => {
  nextTick(() => createModelUsageChart())
})

watch(trendData, () => {
  nextTick(() => createUsageTrendChart())
})

watch(apiKeysTrendData, () => {
  nextTick(() => createApiKeysUsageTrendChart())
})

watch(accountUsageTrendData, () => {
  nextTick(() => createAccountUsageTrendChart())
})

// Refrescar todos los datos
async function refreshAllData() {
  if (isRefreshing.value) return

  isRefreshing.value = true
  try {
    await Promise.all([loadDashboardData(), refreshChartsData(), loadBalanceSummary()])
  } finally {
    isRefreshing.value = false
  }
}

// Iniciar actualización automática
function startAutoRefresh() {
  if (!autoRefreshEnabled.value) return

  // Restablecer cuenta regresiva
  refreshCountdown.value = autoRefreshInterval.value

  // Limpiar temporizador existente
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
  }
  if (autoRefreshTimer.value) {
    clearTimeout(autoRefreshTimer.value)
  }

  // Iniciar cuenta regresiva
  countdownTimer.value = setInterval(() => {
    refreshCountdown.value--
    if (refreshCountdown.value <= 0) {
      clearInterval(countdownTimer.value)
    }
  }, 1000)

  // Configurar temporizador de actualización
  autoRefreshTimer.value = setTimeout(async () => {
    await refreshAllData()
    // Llamada recursiva para continuar la actualización automática
    if (autoRefreshEnabled.value) {
      startAutoRefresh()
    }
  }, autoRefreshInterval.value * 1000)
}

// Detener actualización automática
function stopAutoRefresh() {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
  if (autoRefreshTimer.value) {
    clearTimeout(autoRefreshTimer.value)
    autoRefreshTimer.value = null
  }
  refreshCountdown.value = 0
}

// Alternar actualización automática
// function toggleAutoRefresh() {
//   autoRefreshEnabled.value = !autoRefreshEnabled.value
//   if (autoRefreshEnabled.value) {
//     startAutoRefresh()
//   } else {
//     stopAutoRefresh()
//   }
// }

// Escuchar cambios de estado de actualización automática
watch(autoRefreshEnabled, (newVal) => {
  if (newVal) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

// Escuchar cambios de tema y recrear gráficos
watch(isDarkMode, () => {
  nextTick(() => {
    createModelUsageChart()
    createUsageTrendChart()
    createApiKeysUsageTrendChart()
    createAccountUsageTrendChart()
  })
})

// Escuchar cambios de esquema de color y recrear gráficos
watch(
  () => themeStore.colorScheme,
  () => {
    nextTick(() => {
      createModelUsageChart()
      createUsageTrendChart()
      createApiKeysUsageTrendChart()
      createAccountUsageTrendChart()
    })
  }
)

// Inicialización
onMounted(async () => {
  // Cargar todos los datos
  await refreshAllData()

  // Crear gráficos
  await nextTick()
  createModelUsageChart()
  createUsageTrendChart()
  createApiKeysUsageTrendChart()
  createAccountUsageTrendChart()
})

// Limpieza
onUnmounted(() => {
  stopAutoRefresh()
  // Destruir instancias de gráficos
  if (modelUsageChartInstance) {
    modelUsageChartInstance.destroy()
  }
  if (usageTrendChartInstance) {
    usageTrendChartInstance.destroy()
  }
  if (apiKeysUsageTrendChartInstance) {
    apiKeysUsageTrendChartInstance.destroy()
  }
  if (accountUsageTrendChartInstance) {
    accountUsageTrendChartInstance.destroy()
  }
})
</script>

<style scoped>
/* Ajustes básicos de estilo del selector de fecha - permitir que el modo oscuro oficial de Element Plus surta efecto */
.custom-date-picker {
  font-size: 13px;
}

/* Animación de rotación */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
