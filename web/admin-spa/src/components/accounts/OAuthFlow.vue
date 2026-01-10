<template>
  <div class="space-y-6">
    <!-- Claude OAuth流程 -->
    <div v-if="platform === 'claude'">
      <div
        class="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-700 dark:bg-blue-900/30"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500"
          >
            <i class="fas fa-link text-white" />
          </div>
          <div class="flex-1">
            <h4 class="mb-3 font-semibold text-blue-900 dark:text-blue-200">
              {{ $t('accounts.auth.title') }}
            </h4>

            <!-- 授权方式选择 -->
            <div class="mb-4">
              <label class="mb-2 block text-sm font-medium text-blue-800 dark:text-blue-300">
                {{ $t('accounts.auth.method') }}
              </label>
              <div class="flex gap-4">
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    v-model="authMethod"
                    class="text-blue-600 focus:ring-blue-500"
                    name="claude-auth-method"
                    type="radio"
                    value="manual"
                    @change="onAuthMethodChange"
                  />
                  <span class="text-sm text-blue-900 dark:text-blue-200">{{
                    $t('accounts.auth.manual')
                  }}</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    v-model="authMethod"
                    class="text-blue-600 focus:ring-blue-500"
                    name="claude-auth-method"
                    type="radio"
                    value="cookie"
                    @change="onAuthMethodChange"
                  />
                  <span class="text-sm text-blue-900 dark:text-blue-200">{{
                    $t('accounts.auth.cookie')
                  }}</span>
                </label>
              </div>
            </div>

            <!-- Cookie自动授权表单 -->
            <div v-if="authMethod === 'cookie'" class="space-y-4">
              <div
                class="rounded-lg border border-blue-300 bg-white/80 p-4 dark:border-blue-600 dark:bg-gray-800/80"
              >
                <p class="mb-3 text-sm text-blue-700 dark:text-blue-300">
                  {{ $t('accounts.auth.cookieAuthNote') }}
                </p>

                <!-- sessionKey输入 -->
                <div class="mb-4">
                  <label
                    class="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    <i class="fas fa-cookie text-blue-500" />
                    {{ $t('accounts.auth.sessionKey') }}
                    <span
                      v-if="parsedSessionKeyCount > 1"
                      class="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white"
                    >
                      {{ parsedSessionKeyCount }} {{ $t('common.unit.requests') }}
                    </span>
                    <button
                      class="text-blue-500 hover:text-blue-600"
                      type="button"
                      @click="showSessionKeyHelp = !showSessionKeyHelp"
                    >
                      <i class="fas fa-question-circle" />
                    </button>
                  </label>
                  <textarea
                    v-model="sessionKey"
                    class="form-input w-full resize-y font-mono text-sm"
                    :placeholder="$t('accounts.auth.sessionKeyPlaceholder')"
                    rows="3"
                  />
                  <p
                    v-if="parsedSessionKeyCount > 1"
                    class="mt-1 text-xs text-blue-600 dark:text-blue-400"
                  >
                    <i class="fas fa-info-circle mr-1" />
                    {{ $t('accounts.auth.batchCreationNote', { count: parsedSessionKeyCount }) }}
                  </p>
                </div>

                <!-- 帮助说明 -->
                <div
                  v-if="showSessionKeyHelp"
                  class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/30"
                >
                  <h5 class="mb-2 font-semibold text-amber-800 dark:text-amber-200">
                    <i class="fas fa-lightbulb mr-1" />{{ $t('accounts.auth.howToGet') }}
                  </h5>
                  <ol
                    class="list-inside list-decimal space-y-1 text-xs text-amber-700 dark:text-amber-300"
                  >
                    <li>{{ $t('accounts.auth.sessionKeySteps.step1') }}</li>
                    <li>
                      {{ $t('accounts.auth.sessionKeySteps.step2') }}
                      <kbd class="rounded bg-gray-200 px-1 dark:bg-gray-700">F12</kbd>
                      {{ $t('accounts.auth.sessionKeySteps.step2b') }}
                    </li>
                    <li>{{ $t('accounts.auth.sessionKeySteps.step3') }}</li>
                    <li>
                      {{ $t('accounts.auth.sessionKeySteps.step4') }}
                    </li>
                    <li>{{ $t('accounts.auth.sessionKeySteps.step5') }}</li>
                    <li>{{ $t('accounts.auth.sessionKeySteps.step6') }}</li>
                  </ol>
                  <p class="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    <i class="fas fa-info-circle mr-1" />
                    {{ $t('accounts.auth.sessionKeyPrefixNote') }}
                    <code class="rounded bg-gray-200 px-1 dark:bg-gray-700">sk-ant-sid01-</code>
                    {{ $t('accounts.auth.sessionKeyPrefixNoteSuffix') }}
                  </p>
                </div>

                <!-- 错误信息 -->
                <div
                  v-if="cookieAuthError"
                  class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900/30"
                >
                  <p class="text-sm text-red-600 dark:text-red-400">
                    <i class="fas fa-exclamation-circle mr-1" />
                    {{ cookieAuthError }}
                  </p>
                </div>

                <!-- 授权按钮 -->
                <button
                  class="btn btn-primary w-full px-4 py-3 text-base font-semibold"
                  :disabled="cookieAuthLoading || !sessionKey.trim()"
                  type="button"
                  @click="handleCookieAuth"
                >
                  <div v-if="cookieAuthLoading" class="loading-spinner mr-2" />
                  <i v-else class="fas fa-magic mr-2" />
                  <template v-if="cookieAuthLoading && batchProgress.total > 1">
                    {{ $t('common.status.loading') }} {{ batchProgress.current }}/{{
                      batchProgress.total
                    }}...
                  </template>
                  <template v-else-if="cookieAuthLoading">
                    {{ $t('common.status.loading') }}
                  </template>
                  <template v-else> {{ $t('accounts.auth.steps.generateLink') }} </template>
                </button>
              </div>
            </div>

            <!-- 手动授权流程 -->
            <div v-else>
              <p class="mb-4 text-sm text-blue-800 dark:text-blue-300">
                {{ $t('accounts.auth.instructions') }}
              </p>

              <div class="space-y-4">
                <!-- 步骤1: 生成授权链接 -->
                <div
                  class="rounded-lg border border-blue-300 bg-white/80 p-4 dark:border-blue-600 dark:bg-gray-800/80"
                >
                  <div class="flex items-start gap-3">
                    <div
                      class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                    >
                      1
                    </div>
                    <div class="flex-1">
                      <p class="mb-2 font-medium text-blue-900 dark:text-blue-200">
                        {{ $t('accounts.auth.steps.generateLink') }}
                      </p>
                      <button
                        v-if="!authUrl"
                        class="btn btn-primary px-4 py-2 text-sm"
                        :disabled="loading"
                        @click="generateAuthUrl"
                      >
                        <i v-if="!loading" class="fas fa-link mr-2" />
                        <div v-else class="loading-spinner mr-2" />
                        {{
                          loading
                            ? $t('common.status.loading')
                            : $t('accounts.auth.steps.generateLink')
                        }}
                      </button>
                      <div v-else class="space-y-3">
                        <div class="flex items-center gap-2">
                          <input
                            class="form-input flex-1 bg-gray-50 font-mono text-xs dark:bg-gray-700"
                            readonly
                            type="text"
                            :value="authUrl"
                          />
                          <button
                            class="rounded-lg bg-gray-100 px-3 py-2 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                            :title="$t('common.action.copy')"
                            @click="copyAuthUrl"
                          >
                            <i :class="copied ? 'fas fa-check text-green-500' : 'fas fa-copy'" />
                          </button>
                        </div>
                        <button
                          class="text-xs text-blue-600 hover:text-blue-700"
                          @click="regenerateAuthUrl"
                        >
                          <i class="fas fa-sync-alt mr-1" />{{ $t('accounts.form.regenerate') }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 步骤2: 访问链接并授权 -->
                <div
                  class="rounded-lg border border-blue-300 bg-white/80 p-4 dark:border-blue-600 dark:bg-gray-800/80"
                >
                  <div class="flex items-start gap-3">
                    <div
                      class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                    >
                      2
                    </div>
                    <div class="flex-1">
                      <p class="mb-2 font-medium text-blue-900 dark:text-blue-200">
                        {{ $t('accounts.auth.steps.openBrowser') }}
                      </p>
                      <p class="mb-2 text-sm text-blue-700 dark:text-blue-300">
                        {{ $t('accounts.auth.instructions') }}
                      </p>
                      <div
                        class="rounded border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-900/30"
                      >
                        <p class="text-xs text-yellow-800 dark:text-yellow-300">
                          <i class="fas fa-exclamation-triangle mr-1" />
                          <strong>注意：</strong
                          >如果您设置了代理，请确保浏览器也使用相同的代理访问授权页面。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 步骤3: 输入授权码 -->
                <div
                  class="rounded-lg border border-blue-300 bg-white/80 p-4 dark:border-blue-600 dark:bg-gray-800/80"
                >
                  <div class="flex items-start gap-3">
                    <div
                      class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                    >
                      3
                    </div>
                    <div class="flex-1">
                      <p class="mb-2 font-medium text-blue-900 dark:text-blue-200">
                        {{ $t('accounts.auth.steps.enterCode') }}
                      </p>
                      <div class="space-y-3">
                        <div>
                          <label
                            class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                          >
                            <i class="fas fa-key mr-2 text-blue-500" />{{
                              $t('accounts.auth.auth_code') || 'Code'
                            }}
                          </label>
                          <textarea
                            v-model="authCode"
                            class="form-input w-full resize-none font-mono text-sm"
                            :placeholder="$t('accounts.auth.steps.enterCode')"
                            rows="3"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Gemini OAuth流程 -->
    <div v-else-if="platform === 'gemini'">
      <div
        class="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-700 dark:bg-green-900/30"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-500"
          >
            <i class="fas fa-robot text-white" />
          </div>
          <div class="flex-1">
            <h4 class="mb-3 font-semibold text-green-900 dark:text-blue-200">
              {{ $t('accounts.auth.geminiTitle') }}
            </h4>
            <p class="mb-4 text-sm text-green-800 dark:text-blue-300">
              {{ $t('accounts.auth.instructions') }}
            </p>

            <div class="space-y-4">
              <!-- 步骤1: 生成授权链接 -->
              <div
                class="rounded-lg border border-green-300 bg-white/80 p-4 dark:border-green-600 dark:bg-gray-800/80"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                  >
                    1
                  </div>
                  <div class="flex-1">
                    <p class="mb-2 font-medium text-blue-900 dark:text-blue-200">
                      {{ $t('accounts.auth.steps.generateLink') }}
                    </p>
                    <button
                      v-if="!authUrl"
                      class="btn btn-primary px-4 py-2 text-sm"
                      :disabled="loading"
                      @click="generateAuthUrl"
                    >
                      <i v-if="!loading" class="fas fa-link mr-2" />
                      <div v-else class="loading-spinner mr-2" />
                      {{
                        loading
                          ? $t('common.status.loading')
                          : $t('accounts.auth.steps.generateLink')
                      }}
                    </button>
                    <div v-else class="space-y-3">
                      <div class="flex items-center gap-2">
                        <input
                          class="form-input flex-1 bg-gray-50 font-mono text-xs dark:bg-gray-700"
                          readonly
                          type="text"
                          :value="authUrl"
                        />
                        <button
                          class="rounded-lg bg-gray-100 px-3 py-2 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                          :title="$t('common.action.copy')"
                          @click="copyAuthUrl"
                        >
                          <i :class="copied ? 'fas fa-check text-green-500' : 'fas fa-copy'" />
                        </button>
                      </div>
                      <button
                        class="text-xs text-green-600 hover:text-green-700"
                        @click="regenerateAuthUrl"
                      >
                        <i class="fas fa-sync-alt mr-1" />{{ $t('accounts.form.regenerate') }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 步骤2: 操作说明 -->
              <div
                class="rounded-lg border border-green-300 bg-white/80 p-4 dark:border-green-600 dark:bg-gray-800/80"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                  >
                    2
                  </div>
                  <div class="flex-1">
                    <p class="mb-2 font-medium text-blue-900 dark:text-blue-200">
                      {{ $t('accounts.auth.steps.openBrowser') }}
                    </p>
                    <p class="mb-2 text-sm text-green-700 dark:text-green-300">
                      {{ $t('accounts.auth.geminiInstructions') }}
                    </p>
                    <div
                      class="rounded border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-900/30"
                    >
                      <p class="text-xs text-yellow-800 dark:text-yellow-300">
                        <i class="fas fa-exclamation-triangle mr-1" />
                        <strong>注意：</strong
                        >如果您设置了代理，请确保浏览器也使用相同的代理访问授权页面。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 步骤3: 输入授权码 -->
              <div
                class="rounded-lg border border-green-300 bg-white/80 p-4 dark:border-green-600 dark:bg-gray-800/80"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                  >
                    3
                  </div>
                  <div class="flex-1">
                    <p class="mb-2 font-medium text-blue-900 dark:text-blue-200">
                      {{ $t('accounts.auth.steps.enterCode') }}
                    </p>
                    <p class="mb-3 text-sm text-blue-700 dark:text-blue-300">
                      {{ $t('accounts.auth.geminiCodeHelp') }}
                    </p>
                    <div class="space-y-3">
                      <div>
                        <label
                          class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                        >
                          <i class="fas fa-key mr-2 text-blue-500" />{{
                            $t('accounts.auth.auth_code')
                          }}
                        </label>
                        <textarea
                          v-model="authCode"
                          class="form-input w-full resize-none font-mono text-sm"
                          :placeholder="$t('accounts.auth.steps.enterCode')"
                          rows="3"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- OpenAI OAuth流程 -->
    <div v-else-if="platform === 'openai'">
      <div
        class="rounded-lg border border-orange-200 bg-orange-50 p-6 dark:border-orange-700 dark:bg-orange-900/30"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500"
          >
            <i class="fas fa-brain text-white" />
          </div>
          <div class="flex-1">
            <h4 class="mb-3 font-semibold text-orange-900 dark:text-blue-200">
              {{ $t('accounts.auth.openaiTitle') }}
            </h4>
            <p class="mb-4 text-sm text-orange-800 dark:text-blue-300">
              {{ $t('accounts.auth.instructions') }}
            </p>

            <div class="space-y-4">
              <!-- 步骤1: 生成授权链接 -->
              <div
                class="rounded-lg border border-orange-300 bg-white/80 p-4 dark:border-blue-600 dark:bg-gray-800/80"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white"
                  >
                    1
                  </div>
                  <div class="flex-1">
                    <p class="mb-2 font-medium text-orange-900 dark:text-blue-200">
                      {{ $t('accounts.auth.steps.generateLink') }}
                    </p>
                    <button
                      v-if="!authUrl"
                      class="btn btn-primary px-4 py-2 text-sm"
                      :disabled="loading"
                      @click="generateAuthUrl"
                    >
                      <i v-if="!loading" class="fas fa-link mr-2" />
                      <div v-else class="loading-spinner mr-2" />
                      {{
                        loading
                          ? $t('common.status.loading')
                          : $t('accounts.auth.steps.generateLink')
                      }}
                    </button>
                    <div v-else class="space-y-3">
                      <div class="flex items-center gap-2">
                        <input
                          class="form-input flex-1 bg-gray-50 font-mono text-xs dark:bg-gray-700"
                          readonly
                          type="text"
                          :value="authUrl"
                        />
                        <button
                          class="rounded-lg bg-gray-100 px-3 py-2 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                          :title="$t('common.action.copy')"
                          @click="copyAuthUrl"
                        >
                          <i :class="copied ? 'fas fa-check text-green-500' : 'fas fa-copy'" />
                        </button>
                      </div>
                      <button
                        class="text-xs text-orange-600 hover:text-orange-700"
                        @click="regenerateAuthUrl"
                      >
                        <i class="fas fa-sync-alt mr-1" />{{ $t('accounts.form.regenerate') }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 步骤2: 访问链接并授权 -->
              <div
                class="rounded-lg border border-orange-300 bg-white/80 p-4 dark:border-blue-600 dark:bg-gray-800/80"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                  >
                    2
                  </div>
                  <div class="flex-1">
                    <p class="mb-2 font-medium text-blue-900 dark:text-blue-200">
                      {{ $t('accounts.auth.steps.openBrowser') }}
                    </p>
                    <p class="mb-2 text-sm text-blue-700 dark:text-blue-300">
                      {{ $t('accounts.auth.openaiInstructions') }}
                    </p>
                    <div
                      class="mb-3 rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/30"
                    >
                      <p class="text-xs text-amber-800 dark:text-amber-300">
                        <i class="fas fa-clock mr-1" />
                        <strong>重要提示：</strong>授权后页面可能会加载较长时间，请耐心等待。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 步骤3: 输入授权码 -->
              <div
                class="rounded-lg border border-orange-300 bg-white/80 p-4 dark:border-blue-600 dark:bg-gray-800/80"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                  >
                    3
                  </div>
                  <div class="flex-1">
                    <p class="mb-2 font-medium text-orange-900 dark:text-blue-200">
                      {{ $t('accounts.auth.steps.enterCode') }}
                    </p>
                    <div class="space-y-3">
                      <div>
                        <label
                          class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                        >
                          <i class="fas fa-link mr-2 text-orange-500" />{{
                            $t('accounts.auth.auth_url_or_code')
                          }}
                        </label>
                        <textarea
                          v-model="authCode"
                          class="form-input w-full resize-none font-mono text-sm"
                          :placeholder="$t('accounts.auth.openaiCodeHelp')"
                          rows="3"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Droid OAuth流程 -->
    <div v-else-if="platform === 'droid'">
      <div
        class="rounded-lg border border-cyan-200 bg-cyan-50 p-6 dark:border-cyan-700 dark:bg-cyan-900/30"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500"
          >
            <i class="fas fa-robot text-white" />
          </div>
          <div class="flex-1">
            <h4 class="mb-3 font-semibold text-cyan-900 dark:text-blue-200">
              {{ $t('accounts.auth.droidTitle') }}
            </h4>
            <p class="mb-4 text-sm text-cyan-800 dark:text-blue-300">
              {{ $t('accounts.auth.instructions') }}
            </p>

            <div class="space-y-4">
              <!-- 步骤1: 生成授权链接 -->
              <div
                class="rounded-lg border border-cyan-300 bg-white/80 p-4 dark:border-blue-600 dark:bg-gray-800/80"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white"
                  >
                    1
                  </div>
                  <div class="flex-1">
                    <p class="mb-2 font-medium text-cyan-900 dark:text-blue-200">
                      {{ $t('accounts.auth.steps.generateLink') }}
                    </p>
                    <button
                      v-if="!authUrl"
                      class="btn btn-primary px-4 py-2 text-sm"
                      :disabled="loading"
                      @click="generateAuthUrl"
                    >
                      <i v-if="!loading" class="fas fa-link mr-2" />
                      <div v-else class="loading-spinner mr-2" />
                      {{
                        loading
                          ? $t('common.status.loading')
                          : $t('accounts.auth.steps.generateLink')
                      }}
                    </button>
                    <div v-else class="space-y-4">
                      <div class="space-y-2">
                        <label class="text-xs font-semibold text-gray-600 dark:text-gray-300">{{
                          $t('accounts.auth.authUrl')
                        }}</label>
                        <div
                          class="flex flex-col gap-2 rounded-md border border-cyan-200 bg-white p-3 dark:border-cyan-700 dark:bg-gray-800"
                        >
                          <div class="flex items-center gap-2">
                            <input
                              class="form-input flex-1 bg-gray-50 font-mono text-xs dark:bg-gray-700"
                              readonly
                              type="text"
                              :value="authUrl"
                            />
                            <button
                              class="rounded-lg bg-gray-100 px-3 py-2 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                              :title="$t('common.action.copy')"
                              @click="copyAuthUrl"
                            >
                              <i :class="copied ? 'fas fa-check text-green-500' : 'fas fa-copy'" />
                            </button>
                          </div>
                          <div class="flex flex-wrap items-center gap-2">
                            <button
                              class="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-white px-3 py-1.5 text-xs font-medium text-cyan-600 shadow-sm transition-colors hover:border-cyan-300 hover:bg-cyan-50 dark:border-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200 dark:hover:border-cyan-500 dark:hover:bg-cyan-900/60"
                              @click="openVerificationPage"
                            >
                              <i class="fas fa-external-link-alt text-xs" />
                              {{ $t('common.action.openInNewTab') }}
                            </button>
                            <button
                              class="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-cyan-600 transition-colors hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                              @click="regenerateAuthUrl"
                            >
                              <i class="fas fa-sync-alt text-xs" />{{
                                $t('accounts.form.regenerate')
                              }}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div class="space-y-2">
                        <label class="text-xs font-semibold text-gray-600 dark:text-gray-300">{{
                          $t('accounts.auth.userCode')
                        }}</label>
                        <div
                          class="flex items-center justify-between rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 dark:border-cyan-700 dark:bg-cyan-900/30"
                        >
                          <span
                            class="font-mono text-xl font-semibold text-cyan-700 dark:text-cyan-200"
                          >
                            {{ userCode || '------' }}
                          </span>
                          <button
                            class="rounded-lg bg-white px-3 py-1 text-sm text-cyan-600 transition-colors hover:bg-cyan-100 dark:bg-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-700"
                            @click="copyUserCode"
                          >
                            <i class="fas fa-copy mr-1" />{{ $t('common.action.copy') }}
                          </button>
                        </div>
                      </div>
                      <div
                        class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
                      >
                        <span>
                          <i class="fas fa-hourglass-half mr-1 text-cyan-500" />
                          {{ $t('common.time.remaining') }}: {{ formattedCountdown }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 步骤2: 访问链接并授权 -->
              <div
                class="rounded-lg border border-cyan-300 bg-white/80 p-4 dark:border-blue-600 dark:bg-gray-800/80"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                  >
                    2
                  </div>
                  <div class="flex-1">
                    <p class="mb-2 font-medium text-blue-900 dark:text-blue-200">
                      {{ $t('accounts.auth.steps.openBrowser') }}
                    </p>
                    <div class="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                      <p>
                        {{ $t('accounts.auth.droidInstructions') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 步骤3: 输入授权结果 -->
              <div
                class="rounded-lg border border-cyan-300 bg-white/80 p-4 dark:border-blue-600 dark:bg-gray-800/80"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                  >
                    3
                  </div>
                  <div class="flex-1">
                    <p class="mb-2 font-medium text-blue-900 dark:text-blue-200">
                      {{ $t('accounts.auth.steps.droidCompleting') }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ $t('accounts.auth.steps.droidCompletingHelp') }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-3 pt-4">
      <button
        class="flex-1 rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        type="button"
        @click="$emit('back')"
      >
        {{ $t('common.action.back') }}
      </button>
      <!-- Cookie自动授权模式不显示此按钮（Claude平台） -->
      <button
        v-if="!(platform === 'claude' && authMethod === 'cookie')"
        class="btn btn-primary flex-1 px-6 py-3 font-semibold"
        :disabled="!canExchange || exchanging"
        type="button"
        @click="exchangeCode"
      >
        <div v-if="exchanging" class="loading-spinner mr-2" />
        {{ exchanging ? $t('accounts.auth.steps.completing') : $t('accounts.auth.steps.success') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { showToast } from '@/utils/toast'
import { useAccountsStore } from '@/stores/accounts'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  platform: {
    type: String,
    required: true
  },
  proxy: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['success', 'back'])

const accountsStore = useAccountsStore()

// 状态
const loading = ref(false)
const exchanging = ref(false)
const authUrl = ref('')
const authCode = ref('')
const copied = ref(false)
const sessionId = ref('') // 保存sessionId用于后续交换
const userCode = ref('')
const verificationUri = ref('')
const verificationUriComplete = ref('')
const remainingSeconds = ref(0)
let countdownTimer = null

// Cookie自动授权相关状态
const authMethod = ref('manual') // 'manual' | 'cookie'
const sessionKey = ref('')
const cookieAuthLoading = ref(false)
const cookieAuthError = ref('')
const showSessionKeyHelp = ref(false)
const batchProgress = ref({ current: 0, total: 0 }) // 批量进度

// 解析后的 sessionKey 数量
const parsedSessionKeyCount = computed(() => {
  return sessionKey.value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length
})

// 计算是否可以交换code
const canExchange = computed(() => {
  if (props.platform === 'droid') {
    return !!sessionId.value
  }
  return authUrl.value && authCode.value.trim()
})

const formattedCountdown = computed(() => {
  if (!remainingSeconds.value || remainingSeconds.value <= 0) {
    return '00:00'
  }
  const minutes = Math.floor(remainingSeconds.value / 60)
  const seconds = remainingSeconds.value % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

const startCountdown = (seconds) => {
  stopCountdown()
  if (!seconds || seconds <= 0) {
    remainingSeconds.value = 0
    return
  }

  remainingSeconds.value = Math.floor(seconds)
  countdownTimer = setInterval(() => {
    if (remainingSeconds.value <= 1) {
      remainingSeconds.value = 0
      stopCountdown()
    } else {
      remainingSeconds.value -= 1
    }
  }, 1000)
}

const stopCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

// 监听授权码输入，自动提取URL中的code参数
watch(authCode, (newValue) => {
  if (props.platform === 'droid') return
  if (!newValue || typeof newValue !== 'string') return

  const trimmedValue = newValue.trim()

  // 如果内容为空，不处理
  if (!trimmedValue) return

  // 检查是否是 URL 格式（包含 http:// 或 https://）
  const isUrl = trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')

  // 如果是 URL 格式
  if (isUrl) {
    // 检查是否是正确的 localhost 回调 URL
    if (
      trimmedValue.startsWith('http://localhost:45462') ||
      trimmedValue.startsWith('http://localhost:1455')
    ) {
      try {
        const url = new URL(trimmedValue)
        const code = url.searchParams.get('code')

        if (code) {
          // 成功提取授权码
          authCode.value = code
          showToast(t('accounts.auth.extractedSuccess'), 'success')
        } else {
          // URL 中没有 code 参数
          showToast(t('accounts.auth.extractedError'), 'error')
        }
      } catch (error) {
        // URL 解析失败
        showToast(t('accounts.auth.invalidUrl'), 'error')
      }
    } else if (props.platform === 'gemini' || props.platform === 'openai') {
      try {
        const url = new URL(trimmedValue)
        const code = url.searchParams.get('code')

        if (code) {
          authCode.value = code
          showToast(t('accounts.auth.extractedSuccess'), 'success')
        }
      } catch (error) {
        // 不是有效的URL，保持原值
      }
    } else {
      showToast(t('accounts.auth.urlPrefixError'), 'error')
    }
  }
})

// 生成授权URL
const generateAuthUrl = async () => {
  stopCountdown()
  authUrl.value = ''
  authCode.value = ''
  userCode.value = ''
  verificationUri.value = ''
  verificationUriComplete.value = ''
  remainingSeconds.value = 0
  sessionId.value = ''
  copied.value = false
  loading.value = true
  try {
    const proxyConfig = props.proxy?.enabled
      ? {
          proxy: {
            type: props.proxy.type,
            host: props.proxy.host,
            port: parseInt(props.proxy.port),
            username: props.proxy.username || null,
            password: props.proxy.password || null
          }
        }
      : {}

    if (props.platform === 'claude') {
      const result = await accountsStore.generateClaudeAuthUrl(proxyConfig)
      authUrl.value = result.authUrl
      sessionId.value = result.sessionId
    } else if (props.platform === 'gemini') {
      const result = await accountsStore.generateGeminiAuthUrl(proxyConfig)
      authUrl.value = result.authUrl
      sessionId.value = result.sessionId
    } else if (props.platform === 'openai') {
      const result = await accountsStore.generateOpenAIAuthUrl(proxyConfig)
      authUrl.value = result.authUrl
      sessionId.value = result.sessionId
    } else if (props.platform === 'droid') {
      const result = await accountsStore.generateDroidAuthUrl(proxyConfig)
      authUrl.value = result.verificationUriComplete || result.verificationUri
      verificationUri.value = result.verificationUri
      verificationUriComplete.value = result.verificationUriComplete || result.verificationUri
      userCode.value = result.userCode
      startCountdown(result.expiresIn || 300)
      sessionId.value = result.sessionId
    }
  } catch (error) {
    showToast(error.message || t('accounts.auth.generateError'), 'error')
  } finally {
    loading.value = false
  }
}

// 重新生成授权URL
const regenerateAuthUrl = () => {
  stopCountdown()
  authUrl.value = ''
  authCode.value = ''
  userCode.value = ''
  verificationUri.value = ''
  verificationUriComplete.value = ''
  remainingSeconds.value = 0
  sessionId.value = ''
  generateAuthUrl()
}

// 复制授权URL
const copyAuthUrl = async () => {
  if (!authUrl.value) {
    showToast(t('accounts.auth.noAuthUrl'), 'warning')
    return
  }
  try {
    await navigator.clipboard.writeText(authUrl.value)
    copied.value = true
    showToast(t('common.message.copied'), 'success')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    // 降级方案
    const input = document.createElement('input')
    input.value = authUrl.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copied.value = true
    showToast(t('common.message.copied'), 'success')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

const copyUserCode = async () => {
  if (!userCode.value) {
    showToast(t('accounts.auth.noUserCode'), 'warning')
    return
  }
  try {
    await navigator.clipboard.writeText(userCode.value)
    showToast(t('common.message.copied'), 'success')
  } catch (error) {
    const input = document.createElement('input')
    input.value = userCode.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    showToast(t('common.message.copied'), 'success')
  }
}

const openVerificationPage = () => {
  if (verificationUriComplete.value) {
    window.open(verificationUriComplete.value, '_blank', 'noopener')
  } else if (verificationUri.value) {
    window.open(verificationUri.value, '_blank', 'noopener')
  }
}

// 交换授权码
const exchangeCode = async () => {
  if (!canExchange.value) return

  exchanging.value = true
  try {
    let data = {}

    if (props.platform === 'claude') {
      data = {
        sessionId: sessionId.value,
        callbackUrl: authCode.value.trim()
      }
    } else if (props.platform === 'gemini') {
      data = {
        code: authCode.value.trim(),
        sessionId: sessionId.value
      }
    } else if (props.platform === 'openai') {
      data = {
        code: authCode.value.trim(),
        sessionId: sessionId.value
      }
    } else if (props.platform === 'droid') {
      data = {
        sessionId: sessionId.value
      }
    }

    if (props.proxy?.enabled) {
      data.proxy = {
        type: props.proxy.type,
        host: props.proxy.host,
        port: parseInt(props.proxy.port),
        username: props.proxy.username || null,
        password: props.proxy.password || null
      }
    }

    let tokenInfo
    if (props.platform === 'claude') {
      tokenInfo = await accountsStore.exchangeClaudeCode(data)
    } else if (props.platform === 'gemini') {
      tokenInfo = await accountsStore.exchangeGeminiCode(data)
    } else if (props.platform === 'openai') {
      tokenInfo = await accountsStore.exchangeOpenAICode(data)
    } else if (props.platform === 'droid') {
      const response = await accountsStore.exchangeDroidCode(data)
      if (!response.success) {
        if (response.pending) {
          showToast(response.message || t('accounts.auth.steps.pending'), 'info')
          if (typeof response.expiresIn === 'number' && response.expiresIn >= 0) {
            startCountdown(response.expiresIn)
          }
          return
        }
        throw new Error(response.message || t('accounts.auth.steps.error'))
      }
      tokenInfo = response.data
      stopCountdown()
    }

    emit('success', tokenInfo)
  } catch (error) {
    showToast(error.message || t('accounts.auth.steps.error'), 'error')
  } finally {
    exchanging.value = false
  }
}

onBeforeUnmount(() => {
  stopCountdown()
})

// Cookie自动授权处理（支持批量）
const handleCookieAuth = async () => {
  const sessionKeys = sessionKey.value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (sessionKeys.length === 0) {
    cookieAuthError.value = t('accounts.auth.noSessionKey')
    return
  }

  cookieAuthLoading.value = true
  cookieAuthError.value = ''
  batchProgress.value = { current: 0, total: sessionKeys.length }

  const proxyConfig = props.proxy?.enabled
    ? {
        type: props.proxy.type,
        host: props.proxy.host,
        port: parseInt(props.proxy.port),
        username: props.proxy.username || null,
        password: props.proxy.password || null
      }
    : null

  const results = []
  const errors = []

  for (let i = 0; i < sessionKeys.length; i++) {
    batchProgress.value.current = i + 1
    try {
      const result = await accountsStore.oauthWithCookie({
        sessionKey: sessionKeys[i],
        proxy: proxyConfig
      })
      results.push(result)
    } catch (error) {
      errors.push({
        index: i + 1,
        key: sessionKeys[i].substring(0, 20) + '...',
        error: error.message
      })
    }
  }

  batchProgress.value = { current: 0, total: 0 }

  if (results.length > 0) {
    emit('success', results)
  } else {
    cookieAuthLoading.value = false
  }

  if (errors.length > 0 && results.length === 0) {
    cookieAuthError.value = t('accounts.auth.allFailed')
  } else if (errors.length > 0) {
    cookieAuthError.value = t('accounts.auth.someFailed', { count: errors.length })
  }
}

// 重置Cookie授权状态
const resetCookieAuth = () => {
  sessionKey.value = ''
  cookieAuthError.value = ''
  cookieAuthLoading.value = false
  batchProgress.value = { current: 0, total: 0 }
}

// 切换授权方式时重置状态
const onAuthMethodChange = () => {
  resetCookieAuth()
  authUrl.value = ''
  authCode.value = ''
  sessionId.value = ''
}

// 暴露方法供父组件调用
defineExpose({
  resetCookieAuth
})
</script>
