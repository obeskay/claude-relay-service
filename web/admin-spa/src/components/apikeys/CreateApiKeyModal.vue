<template>
  <Teleport to="body">
    <div class="modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div class="modal-content mx-auto flex max-h-[90vh] w-full max-w-4xl flex-col p-4 sm:p-6">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2 sm:gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 sm:h-10 sm:w-10 sm:rounded-xl"
            >
              <i class="fas fa-key text-sm text-white sm:text-base" />
            </div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
              {{ $t('apiKeys.create_new') }}
            </h3>
          </div>
          <button
            class="p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            @click="$emit('close')"
          >
            <i class="fas fa-times text-lg sm:text-xl" />
          </button>
        </div>

        <form
          class="modal-scroll-content custom-scrollbar flex-1 space-y-4"
          @submit.prevent="createApiKey"
        >
          <!-- 创建类型选择 -->
          <div
            class="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 dark:border-blue-700 dark:from-blue-900/20 dark:to-indigo-900/20 sm:p-4"
          >
            <div
              :class="[
                'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
                form.createType === 'batch' ? 'mb-3' : ''
              ]"
            >
              <label
                class="flex h-full items-center text-xs font-semibold text-gray-700 dark:text-gray-300 sm:text-sm"
                >{{ $t('apiKeys.create_type') }}</label
              >
              <div class="flex items-center gap-3 sm:gap-4">
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.createType"
                    class="mr-1.5 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 sm:mr-2"
                    type="radio"
                    value="single"
                  />
                  <span
                    class="flex items-center text-xs text-gray-700 dark:text-gray-300 sm:text-sm"
                  >
                    <i class="fas fa-key mr-1 text-xs" />
                    {{ $t('apiKeys.single_create') }}
                  </span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.createType"
                    class="mr-1.5 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 sm:mr-2"
                    type="radio"
                    value="batch"
                  />
                  <span
                    class="flex items-center text-xs text-gray-700 dark:text-gray-300 sm:text-sm"
                  >
                    <i class="fas fa-layer-group mr-1 text-xs" />
                    {{ $t('apiKeys.batch_create') }}
                  </span>
                </label>
              </div>
            </div>

            <!-- 批量创建数量输入 -->
            <div v-if="form.createType === 'batch'" class="mt-3">
              <div class="flex items-center gap-4">
                <div class="flex-1">
                  <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{
                    $t('apiKeys.create_count')
                  }}</label>
                  <div class="flex items-center gap-2">
                    <input
                      v-model.number="form.batchCount"
                      class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                      max="500"
                      min="2"
                      :placeholder="$t('apiKeys.enter_count')"
                      required
                      type="number"
                    />
                    <div class="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {{ $t('apiKeys.max_support') }}
                    </div>
                  </div>
                </div>
              </div>
              <p class="mt-2 flex items-start text-xs text-amber-600 dark:text-amber-400">
                <i class="fas fa-info-circle mr-1 mt-0.5 flex-shrink-0" />
                <span>{{ $t('apiKeys.batch_suffix_hint', { name: form.name || 'MyKey' }) }}</span>
              </p>
            </div>
          </div>

          <div>
            <label
              class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300 sm:mb-2 sm:text-sm"
              >{{ $t('label.name') }} <span class="text-red-500">*</span></label
            >
            <div>
              <input
                v-model="form.name"
                class="form-input flex-1 border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                :class="{ 'border-red-500': errors.name }"
                :placeholder="
                  form.createType === 'batch'
                    ? $t('apiKeys.enter_base_name')
                    : $t('apiKeys.enter_key_name')
                "
                required
                type="text"
                @input="errors.name = ''"
              />
            </div>
            <p v-if="errors.name" class="mt-1 text-xs text-red-500 dark:text-red-400">
              {{ errors.name }}
            </p>
          </div>

          <!-- 标签 -->
          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">{{
              $t('label.tags')
            }}</label>
            <div class="space-y-4">
              <!-- 已选择的标签 -->
              <div v-if="form.tags.length > 0">
                <div class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {{ $t('apiKeys.selected_tags') }}:
                </div>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(tag, index) in form.tags"
                    :key="'selected-' + index"
                    class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  >
                    {{ tag }}
                    <button
                      class="ml-1 hover:text-blue-900 dark:hover:text-blue-300"
                      type="button"
                      @click="removeTag(index)"
                    >
                      <i class="fas fa-times text-xs" />
                    </button>
                  </span>
                </div>
              </div>

              <!-- 可选择的已有标签 -->
              <div v-if="unselectedTags.length > 0">
                <div class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {{ $t('apiKeys.click_select_tags') }}:
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="tag in unselectedTags"
                    :key="'available-' + tag"
                    class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-blue-100 hover:text-blue-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                    type="button"
                    @click="selectTag(tag)"
                  >
                    <i class="fas fa-tag text-xs text-gray-500 dark:text-gray-400" />
                    {{ tag }}
                  </button>
                </div>
              </div>

              <!-- 创建新标签 -->
              <div>
                <div class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {{ $t('apiKeys.create_new_tag') }}:
                </div>
                <div class="flex gap-2">
                  <input
                    v-model="newTag"
                    class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    :placeholder="$t('apiKeys.enter_tag_name')"
                    type="text"
                    @keypress.enter.prevent="addTag"
                  />
                  <button
                    class="rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600"
                    type="button"
                    @click="addTag"
                  >
                    <i class="fas fa-plus" />
                  </button>
                </div>
              </div>

              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('apiKeys.tag_hint') }}
              </p>
            </div>
          </div>

          <!-- 速率限制设置 -->
          <div
            class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20"
          >
            <div class="mb-2 flex items-center gap-2">
              <div
                class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-blue-500"
              >
                <i class="fas fa-tachometer-alt text-xs text-white" />
              </div>
              <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {{ $t('apiKeys.rate_limit_settings') }} ({{ $t('common.optional') }})
              </h4>
            </div>

            <div class="space-y-2">
              <div class="grid grid-cols-1 gap-2 lg:grid-cols-3">
                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                    >{{ $t('apiKeys.time_window') }} ({{ $t('time.minutes') }})</label
                  >
                  <input
                    v-model="form.rateLimitWindow"
                    class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    min="1"
                    :placeholder="$t('common.unlimited')"
                    type="number"
                  />
                  <p class="ml-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ $t('apiKeys.time_unit') }}
                  </p>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">{{
                    $t('apiKeys.request_limit')
                  }}</label>
                  <input
                    v-model="form.rateLimitRequests"
                    class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    min="1"
                    :placeholder="$t('common.unlimited')"
                    type="number"
                  />
                  <p class="ml-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ $t('apiKeys.max_requests_in_window') }}
                  </p>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                    >{{ $t('apiKeys.cost_limit') }} ({{ $t('unit.usd') }})</label
                  >
                  <input
                    v-model="form.rateLimitCost"
                    class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    min="0"
                    :placeholder="$t('common.unlimited')"
                    step="0.01"
                    type="number"
                  />
                  <p class="ml-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ $t('apiKeys.max_cost_in_window') }}
                  </p>
                </div>
              </div>

              <!-- 示例说明 -->
              <div class="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <h5 class="mb-1 text-xs font-semibold text-blue-800 dark:text-blue-400">
                  💡 {{ $t('apiKeys.usage_example') }}
                </h5>
                <div class="space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                  <div>
                    <strong>{{ $t('apiKeys.example_1') }}:</strong>
                    {{ $t('apiKeys.example_1_desc') }}
                  </div>
                  <div>
                    <strong>{{ $t('apiKeys.example_2') }}:</strong>
                    {{ $t('apiKeys.example_2_desc') }}
                  </div>
                  <div>
                    <strong>{{ $t('apiKeys.example_3') }}:</strong>
                    {{ $t('apiKeys.example_3_desc') }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >{{ $t('apiKeys.daily_cost_limit') }} ({{ $t('unit.usd') }})</label
            >
            <div class="space-y-2">
              <div class="flex gap-2">
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.dailyCostLimit = '50'"
                >
                  $50
                </button>
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.dailyCostLimit = '100'"
                >
                  $100
                </button>
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.dailyCostLimit = '200'"
                >
                  $200
                </button>
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.dailyCostLimit = ''"
                >
                  {{ $t('apiKeys.custom') }}
                </button>
              </div>
              <input
                v-model="form.dailyCostLimit"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                min="0"
                :placeholder="$t('apiKeys.zero_unlimited')"
                step="0.01"
                type="number"
              />
              <p class="dark:text灰-400 text-xs text-gray-500">
                {{ $t('apiKeys.daily_cost_limit_hint') }}
              </p>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >{{ $t('apiKeys.total_cost_limit') }} ({{ $t('unit.usd') }})</label
            >
            <div class="space-y-2">
              <div class="flex gap-2">
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.totalCostLimit = '100'"
                >
                  $100
                </button>
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.totalCostLimit = '500'"
                >
                  $500
                </button>
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.totalCostLimit = '1000'"
                >
                  $1000
                </button>
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.totalCostLimit = ''"
                >
                  {{ $t('apiKeys.custom') }}
                </button>
              </div>
              <input
                v-model="form.totalCostLimit"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                min="0"
                :placeholder="$t('apiKeys.zero_unlimited')"
                step="0.01"
                type="number"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('apiKeys.total_cost_limit_hint') }}
              </p>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >{{ $t('apiKeys.opus_weekly_limit') }} ({{ $t('unit.usd') }})</label
            >
            <div class="space-y-2">
              <div class="flex gap-2">
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.weeklyOpusCostLimit = '100'"
                >
                  $100
                </button>
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.weeklyOpusCostLimit = '500'"
                >
                  $500
                </button>
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.weeklyOpusCostLimit = '1000'"
                >
                  $1000
                </button>
                <button
                  class="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.weeklyOpusCostLimit = ''"
                >
                  {{ $t('apiKeys.custom') }}
                </button>
              </div>
              <input
                v-model="form.weeklyOpusCostLimit"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                min="0"
                :placeholder="$t('apiKeys.zero_unlimited')"
                step="0.01"
                type="number"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('apiKeys.opus_weekly_limit_hint') }}
              </p>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >{{ $t('apiKeys.concurrency_limit') }} ({{ $t('common.optional') }})</label
            >
            <input
              v-model="form.concurrencyLimit"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              min="0"
              :placeholder="$t('apiKeys.zero_unlimited')"
              type="number"
            />
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {{ $t('apiKeys.concurrency_limit_hint') }}
            </p>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >{{ $t('apiKeys.forced_model') }} ({{ $t('common.optional') }})</label
            >
            <input
              v-model="form.forcedModel"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              placeholder="e.g.: ccr/glm-4.7"
              type="text"
            />
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {{ $t('apiKeys.forced_model_hint') }}
            </p>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >{{ $t('label.description') }} ({{ $t('common.optional') }})</label
            >
            <textarea
              v-model="form.description"
              class="form-input w-full resize-none border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              :placeholder="$t('apiKeys.description_placeholder')"
              rows="2"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">{{
              $t('apiKeys.expiration_settings')
            }}</label>
            <!-- 过期模式选择 -->
            <div
              class="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <div class="flex items-center gap-4">
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.expirationMode"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="fixed"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">{{
                    $t('apiKeys.fixed_expiry')
                  }}</span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.expirationMode"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="activation"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">{{
                    $t('apiKeys.activation_expiry')
                  }}</span>
                </label>
              </div>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span v-if="form.expirationMode === 'fixed'">
                  <i class="fas fa-info-circle mr-1" />
                  {{ $t('apiKeys.fixed_expiry_hint') }}
                </span>
                <span v-else>
                  <i class="fas fa-info-circle mr-1" />
                  {{ $t('apiKeys.activation_expiry_hint') }}
                </span>
              </p>
            </div>

            <!-- 固定时间模式 -->
            <div v-if="form.expirationMode === 'fixed'">
              <select
                v-model="form.expireDuration"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                @change="updateExpireAt"
              >
                <option value="">{{ $t('time.never') }}</option>
                <option value="1h">1 {{ $t('time.hour') }}</option>
                <option value="3h">3 {{ $t('time.hours') }}</option>
                <option value="6h">6 {{ $t('time.hours') }}</option>
                <option value="12h">12 {{ $t('time.hours') }}</option>
                <option value="1d">1 {{ $t('time.day') }}</option>
                <option value="7d">7 {{ $t('time.days') }}</option>
                <option value="30d">30 {{ $t('time.days') }}</option>
                <option value="90d">90 {{ $t('time.days') }}</option>
                <option value="180d">180 {{ $t('time.days') }}</option>
                <option value="365d">365 {{ $t('time.days') }}</option>
                <option value="custom">{{ $t('apiKeys.custom_date') }}</option>
              </select>
              <div v-if="form.expireDuration === 'custom'" class="mt-3">
                <input
                  v-model="form.customExpireDate"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  :min="minDateTime"
                  type="datetime-local"
                  @change="updateCustomExpireAt"
                />
              </div>
              <p v-if="form.expiresAt" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {{ $t('apiKeys.will_expire_at', { date: formatExpireDate(form.expiresAt) }) }}
              </p>
            </div>

            <!-- 激活模式 -->
            <div v-else>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="form.activationDays"
                  class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  :max="form.activationUnit === 'hours' ? 8760 : 3650"
                  min="1"
                  :placeholder="
                    form.activationUnit === 'hours'
                      ? $t('apiKeys.enter_hours')
                      : $t('apiKeys.enter_days')
                  "
                  type="number"
                />
                <select
                  v-model="form.activationUnit"
                  class="form-input w-20 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  @change="updateActivationValue"
                >
                  <option value="hours">{{ $t('time.hours') }}</option>
                  <option value="days">{{ $t('time.days') }}</option>
                </select>
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="value in getQuickTimeOptions()"
                  :key="value.value"
                  class="rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                  type="button"
                  @click="form.activationDays = value.value"
                >
                  {{ value.label }}
                </button>
              </div>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <i class="fas fa-clock mr-1" />
                {{
                  $t('apiKeys.activation_hint', {
                    time: form.activationDays || (form.activationUnit === 'hours' ? 24 : 30),
                    unit: form.activationUnit === 'hours' ? $t('time.hours') : $t('time.days')
                  })
                }}
              </p>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">{{
              $t('label.permissions')
            }}</label>
            <div class="flex flex-wrap gap-4">
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.permissions"
                  class="mr-2 rounded text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                  value="claude"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Claude</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.permissions"
                  class="mr-2 rounded text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                  value="gemini"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Gemini</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.permissions"
                  class="mr-2 rounded text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                  value="openai"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">OpenAI</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.permissions"
                  class="mr-2 rounded text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                  value="droid"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Droid</span>
              </label>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {{ $t('apiKeys.permissions_hint') }}
            </p>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between">
              <label class="text-sm font-semibold text-gray-700 dark:text-gray-300"
                >{{ $t('apiKeys.dedicated_account') }} ({{ $t('common.optional') }})</label
              >
              <button
                class="flex items-center gap-1 text-sm text-blue-600 transition-colors hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                :disabled="accountsLoading"
                :title="$t('action.refresh')"
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
                <span>{{ accountsLoading ? $t('status.loading') : $t('action.refresh') }}</span>
              </button>
            </div>
            <div class="grid grid-cols-1 gap-3">
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">{{
                  $t('apiKeys.claude_dedicated')
                }}</label>
                <AccountSelector
                  v-model="form.claudeAccountId"
                  :accounts="localAccounts.claude"
                  :default-option-text="$t('apiKeys.use_shared_pool')"
                  :disabled="form.permissions.length > 0 && !form.permissions.includes('claude')"
                  :groups="localAccounts.claudeGroups"
                  :placeholder="$t('apiKeys.select_claude')"
                  platform="claude"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">{{
                  $t('apiKeys.gemini_dedicated')
                }}</label>
                <AccountSelector
                  v-model="form.geminiAccountId"
                  :accounts="localAccounts.gemini"
                  :default-option-text="$t('apiKeys.use_shared_pool')"
                  :disabled="form.permissions.length > 0 && !form.permissions.includes('gemini')"
                  :groups="localAccounts.geminiGroups"
                  :placeholder="$t('apiKeys.select_gemini')"
                  platform="gemini"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">{{
                  $t('apiKeys.openai_dedicated')
                }}</label>
                <AccountSelector
                  v-model="form.openaiAccountId"
                  :accounts="localAccounts.openai"
                  :default-option-text="$t('apiKeys.use_shared_pool')"
                  :disabled="form.permissions.length > 0 && !form.permissions.includes('openai')"
                  :groups="localAccounts.openaiGroups"
                  :placeholder="$t('apiKeys.select_openai')"
                  platform="openai"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">{{
                  $t('apiKeys.bedrock_dedicated')
                }}</label>
                <AccountSelector
                  v-model="form.bedrockAccountId"
                  :accounts="localAccounts.bedrock"
                  :default-option-text="$t('apiKeys.use_shared_pool')"
                  :disabled="form.permissions.length > 0 && !form.permissions.includes('claude')"
                  :groups="[]"
                  :placeholder="$t('apiKeys.select_bedrock')"
                  platform="bedrock"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">{{
                  $t('apiKeys.droid_dedicated')
                }}</label>
                <AccountSelector
                  v-model="form.droidAccountId"
                  :accounts="localAccounts.droid"
                  :default-option-text="$t('apiKeys.use_shared_pool')"
                  :disabled="form.permissions.length > 0 && !form.permissions.includes('droid')"
                  :groups="localAccounts.droidGroups"
                  :placeholder="$t('apiKeys.select_droid')"
                  platform="droid"
                />
              </div>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {{ $t('apiKeys.dedicated_hint') }}
            </p>
          </div>

          <div>
            <div class="mb-2 flex items-center">
              <input
                id="enableModelRestriction"
                v-model="form.enableModelRestriction"
                class="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500"
                type="checkbox"
              />
              <label
                class="ml-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300"
                for="enableModelRestriction"
              >
                {{ $t('apiKeys.enable_model_restriction') }}
              </label>
            </div>

            <div v-if="form.enableModelRestriction" class="space-y-3">
              <div>
                <label class="mb-2 block text-sm font-medium text-gray-600">{{
                  $t('apiKeys.restricted_models')
                }}</label>
                <div
                  class="mb-3 flex min-h-[32px] flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2"
                >
                  <span
                    v-for="(model, index) in form.restrictedModels"
                    :key="index"
                    class="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm text-red-800"
                  >
                    {{ model }}
                    <button
                      class="ml-2 text-red-600 hover:text-red-800"
                      type="button"
                      @click="removeRestrictedModel(index)"
                    >
                      <i class="fas fa-times text-xs" />
                    </button>
                  </span>
                  <span v-if="form.restrictedModels.length === 0" class="text-sm text-gray-400">
                    {{ $t('apiKeys.no_restricted_models') }}
                  </span>
                </div>
                <div class="space-y-3">
                  <!-- 快速添加按钮 -->
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="model in availableQuickModels"
                      :key="model"
                      class="flex-shrink-0 rounded-lg bg-gray-100 px-3 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200 sm:text-sm"
                      type="button"
                      @click="quickAddRestrictedModel(model)"
                    >
                      {{ model }}
                    </button>
                    <span
                      v-if="availableQuickModels.length === 0"
                      class="text-sm italic text-gray-400"
                    >
                      {{ $t('apiKeys.all_models_added') }}
                    </span>
                  </div>

                  <!-- 手动输入 -->
                  <div class="flex gap-2">
                    <input
                      v-model="form.modelInput"
                      class="form-input flex-1"
                      :placeholder="$t('apiKeys.enter_model_name')"
                      type="text"
                      @keydown.enter.prevent="addRestrictedModel"
                    />
                    <button
                      class="rounded-lg bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600"
                      type="button"
                      @click="addRestrictedModel"
                    >
                      <i class="fas fa-plus" />
                    </button>
                  </div>
                </div>
                <p class="mt-2 text-xs text-gray-500">
                  {{ $t('apiKeys.restricted_hint') }}
                </p>
              </div>
            </div>
          </div>

          <!-- 客户端限制 -->
          <div>
            <div class="mb-2 flex items-center">
              <input
                id="enableClientRestriction"
                v-model="form.enableClientRestriction"
                class="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500"
                type="checkbox"
              />
              <label
                class="ml-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300"
                for="enableClientRestriction"
              >
                {{ $t('apiKeys.enable_client_restriction') }}
              </label>
            </div>

            <div
              v-if="form.enableClientRestriction"
              class="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-700 dark:bg-green-900/20"
            >
              <div>
                <label class="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">{{
                  $t('apiKeys.allowed_clients')
                }}</label>
                <div class="space-y-1">
                  <div v-for="client in supportedClients" :key="client.id" class="flex items-start">
                    <input
                      :id="`client_${client.id}`"
                      v-model="form.allowedClients"
                      class="mt-0.5 h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500"
                      type="checkbox"
                      :value="client.id"
                    />
                    <label class="ml-2 flex-1 cursor-pointer" :for="`client_${client.id}`">
                      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
                        client.name
                      }}</span>
                      <span class="block text-xs text-gray-500 dark:text-gray-400">{{
                        client.description
                      }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              class="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              type="button"
              @click="$emit('close')"
            >
              {{ $t('action.cancel') }}
            </button>
            <button
              class="btn btn-primary flex-1 px-4 py-2.5 text-sm font-semibold"
              :disabled="loading"
              type="submit"
            >
              <div v-if="loading" class="loading-spinner mr-2" />
              <i v-else class="fas fa-plus mr-2" />
              {{ loading ? $t('status.loading') : $t('action.create') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/utils/toast'
import { useClientsStore } from '@/stores/clients'
import { useApiKeysStore } from '@/stores/apiKeys'
import { apiClient } from '@/config/api'
import AccountSelector from '@/components/common/AccountSelector.vue'

const { t } = useI18n()
// ... existing script setup ...
const props = defineProps({
  accounts: {
    type: Object,
    default: () => ({
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
  }
})

const emit = defineEmits(['close', 'success', 'batch-success'])

const clientsStore = useClientsStore()
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

// 表单验证状态
const errors = ref({
  name: ''
})

// 标签相关
const newTag = ref('')
const availableTags = ref([])

// 计算未选择的标签
const unselectedTags = computed(() => {
  return availableTags.value.filter((tag) => !form.tags.includes(tag))
})

// 支持的客户端列表
const supportedClients = ref([])

// 表单数据
const form = reactive({
  createType: 'single',
  batchCount: 10,
  name: '',
  description: '',
  rateLimitWindow: '',
  rateLimitRequests: '',
  rateLimitCost: '', // 新增：费用限制
  concurrencyLimit: '',
  dailyCostLimit: '',
  totalCostLimit: '',
  weeklyOpusCostLimit: '',
  forcedModel: '', // 新增：强制路由模型
  expireDuration: '',
  customExpireDate: '',
  expiresAt: null,
  expirationMode: 'fixed', // 过期模式：fixed(固定) 或 activation(激活)
  activationDays: 30, // 激活后有效天数
  activationUnit: 'days', // 激活时间单位：hours 或 days
  permissions: [], // 数组格式，空数组表示全部服务
  claudeAccountId: '',
  geminiAccountId: '',
  openaiAccountId: '',
  bedrockAccountId: '',
  droidAccountId: '',
  enableModelRestriction: false,
  restrictedModels: [],
  modelInput: '',
  enableClientRestriction: false,
  allowedClients: [],
  tags: []
})

// 加载支持的客户端和已存在的标签
onMounted(async () => {
  supportedClients.value = await clientsStore.loadSupportedClients()
  availableTags.value = await apiKeysStore.fetchTags()
  // 初始化账号数据
  if (props.accounts) {
    // props.accounts.gemini 已经包含了 OAuth 和 API 两种类型的账号（父组件已合并）
    // 保留原有的 platform 属性，不要覆盖
    const geminiAccounts = (props.accounts.gemini || []).map((account) => ({
      ...account,
      platform: account.platform || 'gemini' // 保留原有 platform，只在没有时设默认值
    }))

    // props.accounts.openai 只包含 openai 类型，openaiResponses 需要单独处理
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

  // 使用缓存的账号数据，不自动刷新（用户可点击"刷新账号"按钮手动刷新）
})

// 刷新账号列表
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
      apiClient.get('/admin/claude-accounts'),
      apiClient.get('/admin/claude-console-accounts'),
      apiClient.get('/admin/gemini-accounts'),
      apiClient.get('/admin/gemini-api-accounts'), // 获取 Gemini-API 账号
      apiClient.get('/admin/openai-accounts'),
      apiClient.get('/admin/openai-responses-accounts'), // 获取 OpenAI-Responses 账号
      apiClient.get('/admin/bedrock-accounts'),
      apiClient.get('/admin/droid-accounts'),
      apiClient.get('/admin/account-groups')
    ])

    // 合并Claude OAuth账户和Claude Console账户
    const claudeAccounts = []

    if (claudeData.success) {
      claudeData.data?.forEach((account) => {
        claudeAccounts.push({
          ...account,
          platform: 'claude-oauth',
          isDedicated: account.accountType === 'dedicated' // 保留以便向后兼容
        })
      })
    }

    if (claudeConsoleData.success) {
      claudeConsoleData.data?.forEach((account) => {
        claudeAccounts.push({
          ...account,
          platform: 'claude-console',
          isDedicated: account.accountType === 'dedicated' // 保留以便向后兼容
        })
      })
    }

    localAccounts.value.claude = claudeAccounts

    // 合并 Gemini OAuth 和 Gemini API 账号
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

    // 合并 OpenAI 和 OpenAI-Responses 账号
    const openaiAccounts = []

    if (openaiData.success) {
      ;(openaiData.data || []).forEach((account) => {
        openaiAccounts.push({
          ...account,
          platform: 'openai',
          isDedicated: account.accountType === 'dedicated' // 保留以便向后兼容
        })
      })
    }

    if (openaiResponsesData.success) {
      ;(openaiResponsesData.data || []).forEach((account) => {
        openaiAccounts.push({
          ...account,
          platform: 'openai-responses',
          isDedicated: account.accountType === 'dedicated' // 保留以便向后兼容
        })
      })
    }

    localAccounts.value.openai = openaiAccounts

    if (bedrockData.success) {
      localAccounts.value.bedrock = (bedrockData.data || []).map((account) => ({
        ...account,
        isDedicated: account.accountType === 'dedicated' // 保留以便向后兼容
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

    showToast(t('status.success'), 'success')
  } catch (error) {
    showToast(t('status.failed'), 'error')
  } finally {
    accountsLoading.value = false
  }
}

// 计算最小日期时间
const minDateTime = computed(() => {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 1)
  return now.toISOString().slice(0, 16)
})

// 更新过期时间
const updateExpireAt = () => {
  if (!form.expireDuration) {
    form.expiresAt = null
    return
  }

  if (form.expireDuration === 'custom') {
    return
  }

  const now = new Date()
  const duration = form.expireDuration
  const match = duration.match(/(\d+)([dhmy])/)

  if (match) {
    const [, value, unit] = match
    const num = parseInt(value)

    switch (unit) {
      case 'd':
        now.setDate(now.getDate() + num)
        break
      case 'h':
        now.setHours(now.getHours() + num)
        break
      case 'm':
        now.setMonth(now.getMonth() + num)
        break
      case 'y':
        now.setFullYear(now.getFullYear() + num)
        break
    }

    form.expiresAt = now.toISOString()
  }
}

// 更新自定义过期时间
const updateCustomExpireAt = () => {
  if (form.customExpireDate) {
    form.expiresAt = new Date(form.customExpireDate).toISOString()
  }
}

// 格式化过期日期
const formatExpireDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

// 添加限制的模型
const addRestrictedModel = () => {
  if (form.modelInput && !form.restrictedModels.includes(form.modelInput)) {
    form.restrictedModels.push(form.modelInput)
    form.modelInput = ''
  }
}

// 移除限制的模型
const removeRestrictedModel = (index) => {
  form.restrictedModels.splice(index, 1)
}

// 常用模型列表
const commonModels = ref(['claude-opus-4-20250514', 'claude-opus-4-1-20250805'])

// 可用的快捷模型（过滤掉已在限制列表中的）
const availableQuickModels = computed(() => {
  return commonModels.value.filter((model) => !form.restrictedModels.includes(model))
})

// 快速添加限制的模型
const quickAddRestrictedModel = (model) => {
  if (!form.restrictedModels.includes(model)) {
    form.restrictedModels.push(model)
  }
}

// 标签管理方法
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

// 获取快捷时间选项
const getQuickTimeOptions = () => {
  if (form.activationUnit === 'hours') {
    return [
      { value: 1, label: `1 ${t('time.hour')}` },
      { value: 3, label: `3 ${t('time.hours')}` },
      { value: 6, label: `6 ${t('time.hours')}` },
      { value: 12, label: `12 ${t('time.hours')}` }
    ]
  } else {
    return [
      { value: 30, label: `30 ${t('time.days')}` },
      { value: 90, label: `90 ${t('time.days')}` },
      { value: 180, label: `180 ${t('time.days')}` },
      { value: 365, label: `365 ${t('time.days')}` }
    ]
  }
}

// 单位变化时更新数值
const updateActivationValue = () => {
  if (form.activationUnit === 'hours') {
    // 从天切换到小时，设置一个合理的默认值
    if (form.activationDays > 24) {
      form.activationDays = 24
    }
  } else {
    // 从小时切换到天，设置一个合理的默认值
    if (form.activationDays < 1) {
      form.activationDays = 1
    }
  }
}

// 创建 API Key
const createApiKey = async () => {
  // 验证表单
  errors.value.name = ''

  if (!form.name || !form.name.trim()) {
    errors.value.name = '请输入API Key名称'
    return
  }

  // 批量创建时验证数量
  if (form.createType === 'batch') {
    if (!form.batchCount || form.batchCount < 2 || form.batchCount > 500) {
      showToast('批量创建数量必须在 2-500 之间', 'error')
      return
    }
  }

  // 检查是否设置了时间窗口但费用限制为0
  if (form.rateLimitWindow && (!form.rateLimitCost || parseFloat(form.rateLimitCost) === 0)) {
    let confirmed = false
    if (window.showConfirm) {
      confirmed = await window.showConfirm(
        '费用限制提醒',
        '您设置了时间窗口但费用限制为0，这意味着不会有费用限制。\n\n是否继续？',
        '继续创建',
        '返回修改'
      )
    } else {
      // 降级方案
      confirmed = confirm('您设置了时间窗口但费用限制为0，这意味着不会有费用限制。\n是否继续？')
    }
    if (!confirmed) {
      return
    }
  }

  loading.value = true

  try {
    // 准备提交的数据
    const baseData = {
      description: form.description || undefined,
      tokenLimit: 0, // 设置为0，清除历史token限制
      rateLimitWindow:
        form.rateLimitWindow !== '' && form.rateLimitWindow !== null
          ? parseInt(form.rateLimitWindow)
          : null,
      rateLimitRequests:
        form.rateLimitRequests !== '' && form.rateLimitRequests !== null
          ? parseInt(form.rateLimitRequests)
          : null,
      rateLimitCost:
        form.rateLimitCost !== '' && form.rateLimitCost !== null
          ? parseFloat(form.rateLimitCost)
          : null,
      concurrencyLimit:
        form.concurrencyLimit !== '' && form.concurrencyLimit !== null
          ? parseInt(form.concurrencyLimit)
          : 0,
      dailyCostLimit:
        form.dailyCostLimit !== '' && form.dailyCostLimit !== null
          ? parseFloat(form.dailyCostLimit)
          : 0,
      totalCostLimit:
        form.totalCostLimit !== '' && form.totalCostLimit !== null
          ? parseFloat(form.totalCostLimit)
          : 0,
      weeklyOpusCostLimit:
        form.weeklyOpusCostLimit !== '' && form.weeklyOpusCostLimit !== null
          ? parseFloat(form.weeklyOpusCostLimit)
          : 0,
      forcedModel: form.forcedModel || '',
      expiresAt: form.expirationMode === 'fixed' ? form.expiresAt || undefined : undefined,
      expirationMode: form.expirationMode,
      activationDays: form.expirationMode === 'activation' ? form.activationDays : undefined,
      activationUnit: form.expirationMode === 'activation' ? form.activationUnit : undefined,
      permissions: form.permissions,
      tags: form.tags.length > 0 ? form.tags : undefined,
      enableModelRestriction: form.enableModelRestriction,
      restrictedModels: form.restrictedModels,
      enableClientRestriction: form.enableClientRestriction,
      allowedClients: form.allowedClients
    }

    // 处理Claude账户绑定（区分OAuth和Console）
    if (form.claudeAccountId) {
      if (form.claudeAccountId.startsWith('console:')) {
        // Claude Console账户
        baseData.claudeConsoleAccountId = form.claudeAccountId.substring(8)
        // 确保不会同时设置OAuth账号
        delete baseData.claudeAccountId
      } else {
        // Claude OAuth账户或分组
        baseData.claudeAccountId = form.claudeAccountId
        // 确保不会同时设置Console账号
        delete baseData.claudeConsoleAccountId
      }
    }

    // Gemini账户绑定
    if (form.geminiAccountId) {
      baseData.geminiAccountId = form.geminiAccountId
    }

    // OpenAI账户绑定
    if (form.openaiAccountId) {
      baseData.openaiAccountId = form.openaiAccountId
    }

    // Bedrock账户绑定
    if (form.bedrockAccountId) {
      baseData.bedrockAccountId = form.bedrockAccountId
    }
    if (form.droidAccountId) {
      baseData.droidAccountId = form.droidAccountId
    }

    if (form.createType === 'single') {
      // 单个创建
      const data = {
        ...baseData,
        name: form.name
      }

      const result = await apiClient.post('/admin/api-keys', data)

      if (result.success) {
        showToast('API Key 创建成功', 'success')
        emit('success', result.data)
        emit('close')
      } else {
        showToast(result.message || '创建失败', 'error')
      }
    } else {
      // 批量创建
      const data = {
        ...baseData,
        createType: 'batch',
        baseName: form.name,
        count: form.batchCount
      }

      const result = await apiClient.post('/admin/api-keys/batch', data)

      if (result.success) {
        showToast(`成功创建 ${result.data.length} 个 API Key`, 'success')
        emit('batch-success', result.data)
        emit('close')
      } else {
        showToast(result.message || '批量创建失败', 'error')
      }
    }
  } catch (error) {
    showToast('创建失败', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* 表单样式由全局样式提供 */
</style>
