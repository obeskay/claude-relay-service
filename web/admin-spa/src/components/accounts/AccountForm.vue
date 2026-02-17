<template>
  <Teleport to="body">
    <div v-if="show" class="modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        class="modal-content custom-scrollbar mx-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto p-4 sm:p-6 md:p-8"
      >
        <div class="mb-4 flex items-center justify-between sm:mb-6">
          <div class="flex items-center gap-2 sm:gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 sm:h-10 sm:w-10 sm:rounded-xl"
            >
              <i class="fas fa-user-circle text-sm text-white sm:text-base" />
            </div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
              {{ isEdit ? 'EditarCuenta' : '添加Cuenta' }}
            </h3>
          </div>
          <button
            class="p-1 text-gray-400 transition-colors hover:text-gray-600"
            @click="$emit('close')"
          >
            <i class="fas fa-times text-lg sm:text-xl" />
          </button>
        </div>

        <!-- 步骤指示器 -->
        <div
          v-if="!isEdit && (form.addType === 'oauth' || form.addType === 'setup-token')"
          class="mb-4 flex items-center justify-center sm:mb-8"
        >
          <div class="flex items-center space-x-2 sm:space-x-4">
            <div class="flex items-center">
              <div
                :class="[
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 sm:text-sm',
                  oauthStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                ]"
              >
                1
              </div>
              <span
                class="ml-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 sm:ml-2 sm:text-sm"
                >基本Información</span
              >
            </div>
            <div class="h-0.5 w-4 bg-gray-300 sm:w-8" />
            <div class="flex items-center">
              <div
                :class="[
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 sm:text-sm',
                  oauthStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                ]"
              >
                2
              </div>
              <span
                class="ml-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 sm:ml-2 sm:text-sm"
                >授权认证</span
              >
            </div>
          </div>
        </div>

        <!-- 步骤1: 基本Informacióny代理Configuración -->
        <div v-if="oauthStep === 1 && !isEdit">
          <div class="space-y-6">
            <div v-if="!isEdit">
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >选择Plataforma</label
              >
              <!-- Plataforma分组选择器 -->
              <div class="space-y-3">
                <!-- 分组选择器 -->
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <!-- Claude 分组 -->
                  <div
                    class="group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-200"
                    :class="[
                      platformGroup === 'claude'
                        ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md dark:from-indigo-900/20 dark:to-purple-900/20'
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-600'
                    ]"
                    @click="selectPlatformGroup('claude')"
                  >
                    <div class="p-3">
                      <div class="flex items-center justify-between">
                        <div
                          class="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600"
                        >
                          <i class="fas fa-brain text-sm text-white"></i>
                        </div>
                        <div
                          v-if="platformGroup === 'claude'"
                          class="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </div>
                      <h4 class="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Claude
                      </h4>
                      <p class="text-xs text-gray-600 dark:text-gray-400">Anthropic</p>
                    </div>
                  </div>

                  <!-- OpenAI 分组 -->
                  <div
                    class="group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-200"
                    :class="[
                      platformGroup === 'openai'
                        ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-md dark:from-emerald-900/20 dark:to-teal-900/20'
                        : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-600'
                    ]"
                    @click="selectPlatformGroup('openai')"
                  >
                    <div class="p-3">
                      <div class="flex items-center justify-between">
                        <div
                          class="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600"
                        >
                          <svg
                            class="h-5 w-5 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4069-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
                            />
                          </svg>
                        </div>
                        <div
                          v-if="platformGroup === 'openai'"
                          class="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </div>
                      <h4 class="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        OpenAI
                      </h4>
                      <p class="text-xs text-gray-600 dark:text-gray-400">GPT 系列</p>
                    </div>
                  </div>

                  <!-- Gemini 分组 -->
                  <div
                    class="group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-200"
                    :class="[
                      platformGroup === 'gemini'
                        ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md dark:from-blue-900/20 dark:to-indigo-900/20'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600'
                    ]"
                    @click="selectPlatformGroup('gemini')"
                  >
                    <div class="p-3">
                      <div class="flex items-center justify-between">
                        <div
                          class="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600"
                        >
                          <i class="fab fa-google text-sm text-white"></i>
                        </div>
                        <div
                          v-if="platformGroup === 'gemini'"
                          class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </div>
                      <h4 class="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Gemini
                      </h4>
                      <p class="text-xs text-gray-600 dark:text-gray-400">Google AI</p>
                    </div>
                  </div>

                  <!-- Droid 分组 -->
                  <div
                    class="group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-200"
                    :class="[
                      platformGroup === 'droid'
                        ? 'border-rose-500 bg-gradient-to-br from-rose-50 to-orange-50 shadow-md dark:from-rose-900/20 dark:to-orange-900/20'
                        : 'border-gray-200 bg-white hover:border-rose-300 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:hover:border-rose-600'
                    ]"
                    @click="selectPlatformGroup('droid')"
                  >
                    <div class="p-3">
                      <div class="flex items-center justify-between">
                        <div
                          class="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-rose-500 to-orange-500"
                        >
                          <i class="fas fa-robot text-sm text-white"></i>
                        </div>
                        <div
                          v-if="platformGroup === 'droid'"
                          class="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </div>
                      <h4 class="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Droid
                      </h4>
                      <p class="text-xs text-gray-600 dark:text-gray-400">Claude Droid</p>
                    </div>
                  </div>
                </div>

                <!-- 子Plataforma选择器 -->
                <div
                  v-if="platformGroup"
                  class="animate-fadeIn rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <p class="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                    选择具体PlataformaTipo：
                  </p>
                  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <!-- Claude 子选项 -->
                    <template v-if="platformGroup === 'claude'">
                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'claude'
                            ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/30'
                            : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20'
                        ]"
                      >
                        <input
                          v-model="form.platform"
                          class="sr-only"
                          type="radio"
                          value="claude"
                        />
                        <div class="flex items-center gap-2">
                          <i class="fas fa-brain text-sm text-indigo-600 dark:text-indigo-400"></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >Claude Code</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400">官方</span>
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'claude'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>

                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'claude-console'
                            ? 'border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-900/30'
                            : 'border-gray-300 bg-white hover:border-purple-400 hover:bg-purple-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-purple-500 dark:hover:bg-purple-900/20'
                        ]"
                      >
                        <input
                          v-model="form.platform"
                          class="sr-only"
                          type="radio"
                          value="claude-console"
                        />
                        <div class="flex items-center gap-2">
                          <i
                            class="fas fa-terminal text-sm text-purple-600 dark:text-purple-400"
                          ></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >Claude Console</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400">标准API</span>
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'claude-console'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>

                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'bedrock'
                            ? 'border-orange-500 bg-orange-50 dark:border-orange-400 dark:bg-orange-900/30'
                            : 'border-gray-300 bg-white hover:border-orange-400 hover:bg-orange-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-orange-500 dark:hover:bg-orange-900/20'
                        ]"
                      >
                        <input
                          v-model="form.platform"
                          class="sr-only"
                          type="radio"
                          value="bedrock"
                        />
                        <div class="flex items-center gap-2">
                          <i class="fab fa-aws text-sm text-orange-600 dark:text-orange-400"></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >Bedrock</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400">AWS</span>
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'bedrock'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>

                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'ccr'
                            ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-900/30'
                            : 'border-gray-300 bg-white hover:border-cyan-400 hover:bg-cyan-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-cyan-500 dark:hover:bg-cyan-900/20'
                        ]"
                      >
                        <input v-model="form.platform" class="sr-only" type="radio" value="ccr" />
                        <div class="flex items-center gap-2">
                          <i
                            class="fas fa-code-branch text-sm text-cyan-600 dark:text-cyan-400"
                          ></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >CCR</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400"
                              >Claude Code Router</span
                            >
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'ccr'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>
                    </template>

                    <!-- OpenAI 子选项 -->
                    <template v-if="platformGroup === 'openai'">
                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'openai'
                            ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/30'
                            : 'border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20'
                        ]"
                      >
                        <input
                          v-model="form.platform"
                          class="sr-only"
                          type="radio"
                          value="openai"
                        />
                        <div class="flex items-center gap-2">
                          <i
                            class="fas fa-robot text-sm text-emerald-600 dark:text-emerald-400"
                          ></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >Codex Cli</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400">官方</span>
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'openai'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>

                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'openai-responses'
                            ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-900/30'
                            : 'border-gray-300 bg-white hover:border-teal-400 hover:bg-teal-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-teal-500 dark:hover:bg-teal-900/20'
                        ]"
                      >
                        <input
                          v-model="form.platform"
                          class="sr-only"
                          type="radio"
                          value="openai-responses"
                        />
                        <div class="flex items-center gap-2">
                          <i class="fas fa-server text-sm text-teal-600 dark:text-teal-400"></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >Responses</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400"
                              >Openai-Responses</span
                            >
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'openai-responses'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>

                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'azure_openai'
                            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20'
                        ]"
                      >
                        <input
                          v-model="form.platform"
                          class="sr-only"
                          type="radio"
                          value="azure_openai"
                        />
                        <div class="flex items-center gap-2">
                          <i class="fab fa-microsoft text-sm text-blue-600 dark:text-blue-400"></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >Azure</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400"
                              >Azure Openai</span
                            >
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'azure_openai'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>
                    </template>

                    <!-- Gemini 子选项 -->
                    <template v-if="platformGroup === 'gemini'">
                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'gemini'
                            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20'
                        ]"
                      >
                        <input
                          v-model="form.platform"
                          class="sr-only"
                          type="radio"
                          value="gemini"
                        />
                        <div class="flex items-center gap-2">
                          <i class="fab fa-google text-sm text-blue-600 dark:text-blue-400"></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >Gemini Cli</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400">官方</span>
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'gemini'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>
                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'gemini-antigravity'
                            ? 'border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-900/30'
                            : 'border-gray-300 bg-white hover:border-purple-400 hover:bg-purple-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-purple-500 dark:hover:bg-purple-900/20'
                        ]"
                      >
                        <input
                          v-model="form.platform"
                          class="sr-only"
                          type="radio"
                          value="gemini-antigravity"
                        />
                        <div class="flex items-center gap-2">
                          <i class="fas fa-rocket text-sm text-purple-600 dark:text-purple-400"></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >Antigravity</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400">OAuth</span>
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'gemini-antigravity'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>

                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'gemini-api'
                            ? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-900/30'
                            : 'border-gray-300 bg-white hover:border-amber-400 hover:bg-amber-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-amber-500 dark:hover:bg-amber-900/20'
                        ]"
                      >
                        <input
                          v-model="form.platform"
                          class="sr-only"
                          type="radio"
                          value="gemini-api"
                        />
                        <div class="flex items-center gap-2">
                          <i class="fas fa-key text-sm text-amber-600 dark:text-amber-400"></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >Gemini API</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400">API Key</span>
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'gemini-api'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>
                    </template>

                    <!-- Droid 子选项 -->
                    <template v-if="platformGroup === 'droid'">
                      <label
                        class="group relative flex cursor-pointer items-center rounded-md border p-2 transition-all"
                        :class="[
                          form.platform === 'droid'
                            ? 'border-rose-500 bg-rose-50 dark:border-rose-400 dark:bg-rose-900/30'
                            : 'border-gray-300 bg-white hover:border-rose-400 hover:bg-rose-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-rose-500 dark:hover:bg-rose-900/20'
                        ]"
                      >
                        <input v-model="form.platform" class="sr-only" type="radio" value="droid" />
                        <div class="flex items-center gap-2">
                          <i class="fas fa-robot text-sm text-rose-600 dark:text-rose-400"></i>
                          <div>
                            <span class="block text-xs font-medium text-gray-900 dark:text-gray-100"
                              >Droid 专属</span
                            >
                            <span class="text-xs text-gray-500 dark:text-gray-400">官方</span>
                          </div>
                        </div>
                        <div
                          v-if="form.platform === 'droid'"
                          class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500"
                        >
                          <i class="fas fa-check text-xs text-white"></i>
                        </div>
                      </label>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="
                !isEdit &&
                form.platform !== 'claude-console' &&
                form.platform !== 'ccr' &&
                form.platform !== 'bedrock' &&
                form.platform !== 'azure_openai' &&
                form.platform !== 'openai-responses' &&
                form.platform !== 'gemini-api'
              "
            >
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >添加方式</label
              >
              <div class="flex flex-wrap gap-4">
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.addType"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="oauth"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">
                    OAuth 授权<span v-if="form.platform === 'claude' || form.platform === 'openai'">
                      (用量可视化)</span
                    >
                  </span>
                </label>
                <label v-if="form.platform === 'claude'" class="flex cursor-pointer items-center">
                  <input
                    v-model="form.addType"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="setup-token"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Setup Token (效期长)</span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.addType"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="manual"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300"
                    >手动Entrada Access Token</span
                  >
                </label>
                <label v-if="form.platform === 'droid'" class="flex cursor-pointer items-center">
                  <input
                    v-model="form.addType"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="apikey"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300"
                    >使用 API Key (支持多 )</span
                  >
                </label>
              </div>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >CuentaNombre</label
              >
              <input
                v-model="form.name"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                :class="{ 'border-red-500': errors.name }"
                placeholder="paraCuentaConfiguración一 易识别Nombre"
                required
                type="text"
              />
              <p v-if="errors.name" class="mt-1 text-xs text-red-500">
                {{ errors.name }}
              </p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >Descripción (可选)</label
              >
              <textarea
                v-model="form.description"
                class="form-input w-full resize-none border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                placeholder="Cuenta用途Instrucciones..."
                rows="3"
              />
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >CuentaTipo</label
              >
              <div class="flex gap-4">
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.accountType"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="shared"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">共享Cuenta</span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.accountType"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="dedicated"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">专属Cuenta</span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.accountType"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="group"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">分组调度</span>
                </label>
              </div>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                共享Cuenta：供所有API Key使用；专属Cuenta：仅供特定API
                Key使用；分组调度：加入分组供分组内调度
              </p>
            </div>

            <!-- 到期时间 - 仅enCrearCuenta时显示，Editar时使用独立过期时间Editar弹窗，Gemini API 不需要 -->
            <div v-if="!isEdit && form.platform !== 'gemini-api'">
              <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >到期时间 (可选)</label
              >
              <div
                class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
              >
                <select
                  v-model="form.expireDuration"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  @change="updateAccountExpireAt"
                >
                  <option value="">永不过期</option>
                  <option value="30d">30 天</option>
                  <option value="90d">90 天</option>
                  <option value="180d">180 天</option>
                  <option value="365d">365 天</option>
                  <option value="custom">自定义日期</option>
                </select>
                <div v-if="form.expireDuration === 'custom'" class="mt-3">
                  <input
                    v-model="form.customExpireDate"
                    class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    :min="minDateTime"
                    type="datetime-local"
                    @change="updateAccountCustomExpireAt"
                  />
                </div>
                <p v-if="form.expiresAt" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <i class="fas fa-calendar-alt mr-1" />
                  将于 {{ formatExpireDate(form.expiresAt) }} 过期
                </p>
                <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <i class="fas fa-infinity mr-1" />
                  Cuenta永不过期
                </p>
              </div>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Configuración Claude Max/Pro 订阅到期时间，到期siguiente将停止调度此Cuenta
              </p>
            </div>

            <!-- 分组选择器 -->
            <div v-if="form.accountType === 'group'">
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >选择分组 *</label
              >
              <div class="flex gap-2">
                <div class="flex-1">
                  <!-- 多选分组界面 -->
                  <div
                    class="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <div
                      v-if="filteredGroups.length === 0"
                      class="text-sm text-gray-500 dark:text-gray-400"
                    >
                      Sin可用分组
                    </div>
                    <label
                      v-for="group in filteredGroups"
                      :key="group.id"
                      class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      <input
                        v-model="form.groupIds"
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                        type="checkbox"
                        :value="group.id"
                      />
                      <span class="text-sm text-gray-700 dark:text-gray-200">
                        {{ group.name }} ({{ group.memberCount || 0 }}  成员)
                      </span>
                    </label>
                    <!-- 新建分组选项 -->
                    <div class="border-t pt-2 dark:border-gray-600">
                      <button
                        class="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        type="button"
                        @click="handleNewGroup"
                      >
                        <i class="fas fa-plus" />
                        新建分组
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  type="button"
                  @click="refreshGroups"
                >
                  <i class="fas fa-sync-alt" :class="{ 'animate-spin': loadingGroups }" />
                </button>
              </div>
            </div>

            <!-- Gemini 项目 ID 字段 -->
            <div v-if="form.platform === 'gemini' || form.platform === 'gemini-antigravity'">
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >项目 ID (可选)</label
              >
              <input
                v-model="form.projectId"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                placeholder="例如：verdant-wares-464411-k9"
                type="text"
              />
              <div class="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <div class="flex items-start gap-2">
                  <i class="fas fa-info-circle mt-0.5 text-yellow-600" />
                  <div class="text-xs text-yellow-700">
                    <p class="mb-1 font-medium">Google Cloud/Workspace 账号需要提供项目 ID</p>
                    <p>
                      某些 Google 账号（特别是绑定 Google Cloud 账号）会被识别para Workspace
                      账号，需要提供额外项目 ID。
                    </p>
                    <div class="mt-2 rounded border border-yellow-300 bg-white p-2">
                      <p class="mb-1 font-medium">如何获取项目 ID：</p>
                      <ol class="ml-2 list-inside list-decimal space-y-1">
                        <li>
                          访问
                          <a
                            class="font-medium text-blue-600 hover:underline"
                            href="https://console.cloud.google.com/welcome"
                            target="_blank"
                            >Google Cloud Console</a
                          >
                        </li>
                        <li>
                          Copiar<span class="font-semibold text-red-600">项目 ID（Project ID）</span
                          >，通常是字符串格式
                        </li>
                        <li class="text-red-600">
                          ⚠️ Nota：要Copiar项目 ID（Project ID），不要Copiar项目编号（Project Number）！
                        </li>
                      </ol>
                    </div>
                    <p class="mt-2">
                      <strong>Sugerencia：</strong>如果您账号是普通 人账号（未绑定 Google
                      Cloud），请留空此字段。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bedrock 特定字段 -->
            <div v-if="form.platform === 'bedrock'" class="space-y-4">
              <!-- 凭证Tipo选择器 -->
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >凭证Tipo *</label
                >
                <div v-if="!isEdit" class="flex gap-4">
                  <label class="flex cursor-pointer items-center">
                    <input
                      v-model="form.credentialType"
                      class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      type="radio"
                      value="access_key"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300"
                      >AWS Access Key（Clave de acceso）</span
                    >
                  </label>
                  <label class="flex cursor-pointer items-center">
                    <input
                      v-model="form.credentialType"
                      class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      type="radio"
                      value="bearer_token"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300"
                      >Bearer Token（长期Token）</span
                    >
                  </label>
                </div>
                <div v-else class="flex gap-4">
                  <label class="flex items-center opacity-60">
                    <input
                      v-model="form.credentialType"
                      class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      disabled
                      type="radio"
                      value="access_key"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300"
                      >AWS Access Key（Clave de acceso）</span
                    >
                  </label>
                  <label class="flex items-center opacity-60">
                    <input
                      v-model="form.credentialType"
                      class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      disabled
                      type="radio"
                      value="bearer_token"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300"
                      >Bearer Token（长期Token）</span
                    >
                  </label>
                </div>
                <div
                  class="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/30"
                >
                  <div class="flex items-start gap-2">
                    <i class="fas fa-info-circle mt-0.5 text-blue-600 dark:text-blue-400" />
                    <div class="text-xs text-blue-700 dark:text-blue-300">
                      <p v-if="form.credentialType === 'access_key'" class="font-medium">
                        使用 AWS Access Key ID y Secret Access Key 进行身份验证（支持临时凭证）
                      </p>
                      <p v-else class="font-medium">
                        使用 AWS Bedrock API Keys 生成 Bearer Token
                        进行身份验证，更简单、权限范围更小
                      </p>
                      <p v-if="isEdit" class="mt-1 text-xs italic">
                        💡 Editar模式abajo凭证Tipo不可更改，如需切换Tipo请重新CrearCuenta
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- AWS Access Key 字段（仅en access_key 模式abajo显示）-->
              <div v-if="form.credentialType === 'access_key'">
                <div>
                  <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >AWS Clave de acceso ID {{ isEdit ? '' : '*' }}</label
                  >
                  <input
                    v-model="form.accessKeyId"
                    class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    :class="{ 'border-red-500': errors.accessKeyId }"
                    :placeholder="isEdit ? '留空则保持原有凭证不变' : 'Ingrese AWS Access Key ID'"
                    :required="!isEdit"
                    type="text"
                  />
                  <p v-if="errors.accessKeyId" class="mt-1 text-xs text-red-500">
                    {{ errors.accessKeyId }}
                  </p>
                  <p v-if="isEdit" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    💡 Editar模式abajo，留空则保持原有 Access Key ID 不变
                  </p>
                </div>

                <div>
                  <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >AWS 秘密Clave de acceso {{ isEdit ? '' : '*' }}</label
                  >
                  <input
                    v-model="form.secretAccessKey"
                    class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    :class="{ 'border-red-500': errors.secretAccessKey }"
                    :placeholder="
                      isEdit ? '留空则保持原有凭证不变' : 'Ingrese AWS Secret Access Key'
                    "
                    :required="!isEdit"
                    type="password"
                  />
                  <p v-if="errors.secretAccessKey" class="mt-1 text-xs text-red-500">
                    {{ errors.secretAccessKey }}
                  </p>
                  <p v-if="isEdit" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    💡 Editar模式abajo，留空则保持原有 Secret Access Key 不变
                  </p>
                </div>

                <div>
                  <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >会话Token (可选)</label
                  >
                  <input
                    v-model="form.sessionToken"
                    class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    :placeholder="
                      isEdit
                        ? '留空则保持原有 Session Token 不变'
                        : '如果使用临时凭证，Ingrese会话Token'
                    "
                    type="password"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    仅en使用临时 AWS 凭证时需要填写
                  </p>
                </div>
              </div>

              <!-- Bearer Token 字段（仅en bearer_token 模式abajo显示）-->
              <div v-if="form.credentialType === 'bearer_token'">
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >Bearer Token {{ isEdit ? '' : '*' }}</label
                >
                <input
                  v-model="form.bearerToken"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.bearerToken }"
                  :placeholder="
                    isEdit ? '留空则保持原有 Bearer Token 不变' : 'Ingrese AWS Bearer Token'
                  "
                  :required="!isEdit"
                  type="password"
                />
                <p v-if="errors.bearerToken" class="mt-1 text-xs text-red-500">
                  {{ errors.bearerToken }}
                </p>
                <p v-if="isEdit" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  💡 Editar模式abajo，留空则保持原有 Bearer Token 不变
                </p>
                <div
                  class="mt-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-700 dark:bg-green-900/30"
                >
                  <div class="flex items-start gap-2">
                    <i class="fas fa-key mt-0.5 text-green-600 dark:text-green-400" />
                    <div class="text-xs text-green-700 dark:text-green-300">
                      <p class="mb-1 font-medium">Bearer Token Instrucciones：</p>
                      <ul class="list-inside list-disc space-y-1 text-xs">
                        <li>Entrada AWS Bedrock API Keys 生成 Bearer Token</li>
                        <li>Bearer Token 仅限 Bedrock 服务访问，权限范围更小</li>
                        <li>相比 Access Key 更简单，无需 Secret Key</li>
                        <li>
                          参考：<a
                            class="text-green-600 underline dark:text-green-400"
                            href="https://aws.amazon.com/cn/blogs/machine-learning/accelerate-ai-development-with-amazon-bedrock-api-keys/"
                            target="_blank"
                            >AWS 官方Documentación</a
                          >
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <!-- AWS 区域（两种凭证Tipo都需要）-->
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >AWS 区域 *</label
                >
                <input
                  v-model="form.region"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.region }"
                  placeholder="例如：us-east-1"
                  required
                  type="text"
                />
                <p v-if="errors.region" class="mt-1 text-xs text-red-500">
                  {{ errors.region }}
                </p>
                <div
                  class="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/30"
                >
                  <div class="flex items-start gap-2">
                    <i class="fas fa-info-circle mt-0.5 text-blue-600 dark:text-blue-400" />
                    <div class="text-xs text-blue-700 dark:text-blue-300">
                      <p class="mb-1 font-medium">常用 AWS 区域参考：</p>
                      <div class="grid grid-cols-2 gap-1 text-xs">
                        <span>• us-east-1 (美国东部)</span>
                        <span>• us-west-2 (美国西部)</span>
                        <span>• eu-west-1 (欧洲爱尔兰)</span>
                        <span>• ap-southeast-1 (新加坡)</span>
                        <span>• ap-northeast-1 (东京)</span>
                        <span>• eu-central-1 (法兰克福)</span>
                      </div>
                      <p class="mt-2 text-blue-600 dark:text-blue-400">
                        💡 Ingrese完整区域代码，如 us-east-1
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >默认主Modelo (可选)</label
                >
                <input
                  v-model="form.defaultModel"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="例如：us.anthropic.claude-sonnet-4-20250514-v1:0"
                  type="text"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  留空将使用系统默认Modelo。支持 inference profile ID o ARN
                </p>
                <div class="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div class="flex items-start gap-2">
                    <i class="fas fa-info-circle mt-0.5 text-amber-600" />
                    <div class="text-xs text-amber-700">
                      <p class="mb-1 font-medium">Bedrock Modelo配置Instrucciones：</p>
                      <ul class="list-inside list-disc space-y-1 text-xs">
                        <li>支持 Inference Profile ID（推荐）</li>
                        <li>支持 Application Inference Profile ARN</li>
                        <li>常用Modelo：us.anthropic.claude-sonnet-4-20250514-v1:0</li>
                        <li>留空将使用系统配置默认Modelo</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >小快速Modelo (可选)</label
                >
                <input
                  v-model="form.smallFastModel"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="例如：us.anthropic.claude-3-5-haiku-20241022-v1:0"
                  type="text"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  para快速响应轻量级Modelo，留空将使用系统默认
                </p>
              </div>
            </div>

            <!-- Azure OpenAI 特定字段 -->
            <div v-if="form.platform === 'azure_openai' && !isEdit" class="space-y-4">
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >Azure Endpoint *</label
                >
                <input
                  v-model="form.azureEndpoint"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.azureEndpoint }"
                  placeholder="https://your-resource.openai.azure.com"
                  required
                  type="url"
                />
                <p v-if="errors.azureEndpoint" class="mt-1 text-xs text-red-500">
                  {{ errors.azureEndpoint }}
                </p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Azure OpenAI 资源终结点 URL，格式：https://your-resource.openai.azure.com
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >API 版本</label
                >
                <input
                  v-model="form.apiVersion"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="2024-02-01"
                  type="text"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Azure OpenAI API 版本，默认使用最新稳定版本 2024-02-01
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >部署Nombre *</label
                >
                <input
                  v-model="form.deploymentName"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.deploymentName }"
                  placeholder="gpt-4"
                  required
                  type="text"
                />
                <p v-if="errors.deploymentName" class="mt-1 text-xs text-red-500">
                  {{ errors.deploymentName }}
                </p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  en Azure OpenAI Studio enCrear部署Nombre
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >API Key *</label
                >
                <input
                  v-model="form.apiKey"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.apiKey }"
                  placeholder="Ingrese Azure OpenAI API Key"
                  required
                  type="password"
                />
                <p v-if="errors.apiKey" class="mt-1 text-xs text-red-500">
                  {{ errors.apiKey }}
                </p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  de Azure 门户获取 API Clave
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >支持Modelo</label
                >
                <div class="flex flex-wrap gap-2">
                  <label
                    v-for="model in [
                      'gpt-4',
                      'gpt-4-turbo',
                      'gpt-4o',
                      'gpt-4o-mini',
                      'gpt-5',
                      'gpt-5-mini',
                      'gpt-35-turbo',
                      'gpt-35-turbo-16k',
                      'codex-mini'
                    ]"
                    :key="model"
                    class="flex cursor-pointer items-center"
                  >
                    <input
                      v-model="form.supportedModels"
                      class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      type="checkbox"
                      :value="model"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ model }}</span>
                  </label>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  选择此部署支持ModeloTipo
                </p>
              </div>
            </div>

            <div v-if="form.platform === 'bedrock' && !isEdit">
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >限流机制</label
                >
                <div class="mb-3">
                  <label class="inline-flex cursor-pointer items-center">
                    <input
                      v-model="form.enableRateLimit"
                      class="mr-2 rounded border-gray-300 text-blue-600 focus:border-blue-500 focus:ring focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700"
                      type="checkbox"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">Habilitar限流机制</span>
                  </label>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Habilitarsiguiente，当账号返回429Error时将暂停调度一段时间
                  </p>
                </div>

                <div v-if="form.enableRateLimit">
                  <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >限流时间 (分钟)</label
                  >
                  <input
                    v-model.number="form.rateLimitDuration"
                    class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    min="1"
                    placeholder="默认60分钟"
                    type="number"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    账号被限流siguiente暂停调度时间（分钟）
                  </p>
                </div>
              </div>
            </div>

            <!-- Claude Console y CCR 特定字段 -->
            <div
              v-if="(form.platform === 'claude-console' || form.platform === 'ccr') && !isEdit"
              class="space-y-4"
            >
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >API URL *</label
                >
                <input
                  v-model="form.apiUrl"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.apiUrl }"
                  placeholder="例如：https://api.example.com"
                  required
                  type="text"
                />
                <p v-if="errors.apiUrl" class="mt-1 text-xs text-red-500">
                  {{ errors.apiUrl }}
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >API Key *</label
                >
                <input
                  v-model="form.apiKey"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.apiKey }"
                  placeholder="IngreseAPI Key"
                  required
                  type="password"
                />
                <p v-if="errors.apiKey" class="mt-1 text-xs text-red-500">
                  {{ errors.apiKey }}
                </p>
              </div>

              <!-- 额度管理字段 -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    每日额度Limitar ($)
                  </label>
                  <input
                    v-model.number="form.dailyQuota"
                    class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    min="0"
                    placeholder="0 表示不Límite"
                    step="0.01"
                    type="number"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Configuración每日使用额度，0 表示不Límite
                  </p>
                </div>

                <div>
                  <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    额度Restablecer时间
                  </label>
                  <input
                    v-model="form.quotaResetTime"
                    class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    placeholder="00:00"
                    type="time"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    每日自动Restablecer额度时间
                  </p>
                </div>
              </div>

              <!-- 并发控制字段 -->
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  最大并发任务数
                </label>
                <input
                  v-model.number="form.maxConcurrentTasks"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  min="0"
                  placeholder="0 表示不Límite"
                  type="number"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Límite该Cuenta并发Solicitud数量，0 表示不Límite
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >Límite de modelos (可选)</label
                >

                <!-- 模式切换 -->
                <div class="mb-4 flex gap-2">
                  <button
                    class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                    :class="
                      modelRestrictionMode === 'whitelist'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'border border-gray-300 text-gray-600 hover:border-blue-300 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-500'
                    "
                    type="button"
                    @click="modelRestrictionMode = 'whitelist'"
                  >
                    <i class="fas fa-check-circle mr-2" />
                    Modelo白名单
                  </button>
                  <button
                    class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                    :class="
                      modelRestrictionMode === 'mapping'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'border border-gray-300 text-gray-600 hover:border-purple-300 dark:border-gray-600 dark:text-gray-400 dark:hover:border-purple-500'
                    "
                    type="button"
                    @click="modelRestrictionMode = 'mapping'"
                  >
                    <i class="fas fa-random mr-2" />
                    Modelo映射
                  </button>
                </div>

                <!-- 白名单模式 -->
                <div v-if="modelRestrictionMode === 'whitelist'">
                  <div class="mb-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/30">
                    <p class="text-xs text-blue-700 dark:text-blue-400">
                      <i class="fas fa-info-circle mr-1" />
                      选择允许使用此CuentaModelo。留空表示支持Todos los modelos。
                    </p>
                  </div>

                  <!-- Modelo复选框列表 -->
                  <div class="mb-3 grid grid-cols-2 gap-2">
                    <label
                      v-for="model in commonModels"
                      :key="model.value"
                      class="flex cursor-pointer items-center rounded-lg border p-3 transition-all hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                      :class="
                        allowedModels.includes(model.value)
                          ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                          : 'border-gray-300'
                      "
                    >
                      <input
                        v-model="allowedModels"
                        class="mr-2 text-blue-600 focus:ring-blue-500"
                        type="checkbox"
                        :value="model.value"
                      />
                      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
                        model.label
                      }}</span>
                    </label>
                  </div>

                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    已选择 {{ allowedModels.length }}  Modelo
                    <span v-if="allowedModels.length === 0">（支持Todos los modelos）</span>
                  </p>
                </div>

                <!-- 映射模式 -->
                <div v-else>
                  <div class="mb-3 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/30">
                    <p class="text-xs text-purple-700 dark:text-purple-400">
                      <i class="fas fa-info-circle mr-1" />
                      配置Modelo映射关系。izquierda侧是客户端SolicitudModelo，derecha侧是实际发送给APIModelo。
                    </p>
                  </div>

                  <!-- Modelo映射表 -->
                  <div class="mb-3 space-y-2">
                    <div
                      v-for="(mapping, index) in modelMappings"
                      :key="index"
                      class="flex items-center gap-2"
                    >
                      <input
                        v-model="mapping.from"
                        class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                        placeholder="原始Nombre del modelo"
                        type="text"
                      />
                      <i class="fas fa-arrow-right text-gray-400 dark:text-gray-500" />
                      <input
                        v-model="mapping.to"
                        class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                        placeholder="映射siguienteNombre del modelo"
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

                  <!-- 添加映射按钮 -->
                  <button
                    class="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300"
                    type="button"
                    @click="addModelMapping"
                  >
                    <i class="fas fa-plus mr-2" />
                    添加Modelo映射
                  </button>

                  <!-- 快捷添加按钮 -->
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button
                      class="rounded-lg bg-blue-100 px-3 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                      type="button"
                      @click="
                        addPresetMapping('claude-sonnet-4-20250514', 'claude-sonnet-4-20250514')
                      "
                    >
                      + Sonnet 4
                    </button>
                    <button
                      class="rounded-lg bg-indigo-100 px-3 py-1 text-xs text-indigo-700 transition-colors hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                      type="button"
                      @click="
                        addPresetMapping('claude-sonnet-4-5-20250929', 'claude-sonnet-4-5-20250929')
                      "
                    >
                      + Sonnet 4.5
                    </button>
                    <button
                      class="rounded-lg bg-purple-100 px-3 py-1 text-xs text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50"
                      type="button"
                      @click="
                        addPresetMapping('claude-opus-4-1-20250805', 'claude-opus-4-1-20250805')
                      "
                    >
                      + Opus 4.1
                    </button>
                    <button
                      class="rounded-lg bg-green-100 px-3 py-1 text-xs text-green-700 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                      type="button"
                      @click="
                        addPresetMapping('claude-3-5-haiku-20241022', 'claude-3-5-haiku-20241022')
                      "
                    >
                      + Haiku 3.5
                    </button>
                    <button
                      class="rounded-lg bg-emerald-100 px-3 py-1 text-xs text-emerald-700 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                      type="button"
                      @click="
                        addPresetMapping('claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001')
                      "
                    >
                      + Haiku 4.5
                    </button>
                    <button
                      class="rounded-lg bg-cyan-100 px-3 py-1 text-xs text-cyan-700 transition-colors hover:bg-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:hover:bg-cyan-900/50"
                      type="button"
                      @click="addPresetMapping('deepseek-chat', 'deepseek-chat')"
                    >
                      + DeepSeek
                    </button>
                    <button
                      class="rounded-lg bg-orange-100 px-3 py-1 text-xs text-orange-700 transition-colors hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50"
                      type="button"
                      @click="addPresetMapping('Qwen', 'Qwen')"
                    >
                      + Qwen
                    </button>
                    <button
                      class="rounded-lg bg-pink-100 px-3 py-1 text-xs text-pink-700 transition-colors hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:hover:bg-pink-900/50"
                      type="button"
                      @click="addPresetMapping('Kimi', 'Kimi')"
                    >
                      + Kimi
                    </button>
                    <button
                      class="rounded-lg bg-teal-100 px-3 py-1 text-xs text-teal-700 transition-colors hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50"
                      type="button"
                      @click="addPresetMapping('GLM', 'GLM')"
                    >
                      + GLM
                    </button>
                    <button
                      class="rounded-lg bg-amber-100 px-3 py-1 text-xs text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                      type="button"
                      @click="
                        addPresetMapping('claude-opus-4-1-20250805', 'claude-sonnet-4-20250514')
                      "
                    >
                      + Opus → Sonnet
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >自定义 User-Agent (可选)</label
                >
                <input
                  v-model="form.userAgent"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="留空则透传客户端 User-Agent"
                  type="text"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  留空时将自动使用客户端 User-Agent，仅en需要固定特定 UA 时填写
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >限流机制</label
                >
                <div class="mb-3">
                  <label class="inline-flex cursor-pointer items-center">
                    <input
                      v-model="form.enableRateLimit"
                      class="mr-2 rounded border-gray-300 text-blue-600 focus:border-blue-500 focus:ring focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700"
                      type="checkbox"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">Habilitar限流机制</span>
                  </label>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Habilitarsiguiente，当账号返回429Error时将暂停调度一段时间
                  </p>
                </div>

                <div v-if="form.enableRateLimit">
                  <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >限流时间 (分钟)</label
                  >
                  <input
                    v-model.number="form.rateLimitDuration"
                    class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    min="1"
                    placeholder="默认60分钟"
                    type="number"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    账号被限流siguiente暂停调度时间（分钟）
                  </p>
                </div>
              </div>
            </div>

            <!-- OpenAI-Responses 特定字段 -->
            <div v-if="form.platform === 'openai-responses' && !isEdit" class="space-y-4">
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >API 基础地址 *</label
                >
                <input
                  v-model="form.baseApi"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="https://api.example.com/v1"
                  required
                  type="url"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  第三方 OpenAI 兼容 API 基础地址，不要包含具体路径
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >API Clave *</label
                >
                <div class="relative">
                  <input
                    v-model="form.apiKey"
                    class="form-input w-full border-gray-300 pr-10 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    placeholder="sk-xxxxxxxxxxxx"
                    required
                    :type="showApiKey ? 'text' : 'password'"
                  />
                  <button
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
                    type="button"
                    @click="showApiKey = !showApiKey"
                  >
                    <i :class="showApiKey ? 'fas fa-eye-slash' : 'fas fa-eye'" />
                  </button>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  第三方服务提供 API Clave
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >自定义 User-Agent (可选)</label
                >
                <input
                  v-model="form.userAgent"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="留空则透传原始Solicitud User-Agent"
                  type="text"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  可选项。如果Configuración，所有Solicitud将使用此 User-Agent；否则透传客户端 User-Agent
                </p>
              </div>

              <!-- 限流时长字段 - 隐藏不显示，使用默认值60 -->
              <input v-model.number="form.rateLimitDuration" type="hidden" value="60" />
            </div>

            <!-- Gemini API 配置 -->
            <div v-if="form.platform === 'gemini-api' && !isEdit" class="space-y-4">
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >API 基础地址 *</label
                >
                <input
                  v-model="form.baseUrl"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="https://generativelanguage.googleapis.com"
                  required
                  type="url"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  填写 API 基础地址（可包含路径anterior缀），系统会自动拼接
                  <code class="rounded bg-gray-100 px-1 dark:bg-gray-600"
                    >/v1beta/models/{model}:generateContent</code
                  >
                </p>
                <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                  官方:
                  <code class="rounded bg-gray-100 px-1 dark:bg-gray-600"
                    >https://generativelanguage.googleapis.com</code
                  >
                  | arriba游para CRS:
                  <code class="rounded bg-gray-100 px-1 dark:bg-gray-600"
                    >https://your-crs.com/gemini</code
                  >
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >API Clave *</label
                >
                <div class="relative">
                  <input
                    v-model="form.apiKey"
                    class="form-input w-full border-gray-300 pr-10 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    placeholder="AIzaSy..."
                    required
                    :type="showApiKey ? 'text' : 'password'"
                  />
                  <button
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
                    type="button"
                    @click="showApiKey = !showApiKey"
                  >
                    <i :class="showApiKey ? 'fas fa-eye-slash' : 'fas fa-eye'" />
                  </button>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  de Google AI Studio 获取 API Clave
                </p>
              </div>
            </div>

            <!-- Claude 订阅Tipo选择 -->
            <div v-if="form.platform === 'claude'">
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >订阅Tipo</label
              >
              <div class="flex gap-4">
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.subscriptionType"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="claude_max"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Claude Max</span>
                </label>
                <label class="flex cursor-pointer items-center">
                  <input
                    v-model="form.subscriptionType"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="radio"
                    value="claude_pro"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Claude Pro</span>
                </label>
              </div>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <i class="fas fa-info-circle mr-1" />
                Pro 账号不支持 Claude Opus 4 Modelo
              </p>
            </div>

            <!-- Claude 5小时Límite自动停止调度选项 -->
            <div v-if="form.platform === 'claude'" class="mt-4">
              <label class="flex items-start">
                <input
                  v-model="form.autoStopOnWarning"
                  class="mt-1 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                />
                <div class="ml-3">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    5小时使用量接近Límite时自动停止调度
                  </span>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    当系统检测到Cuenta接近5小时使用Límite时，自动暂停调度该Cuenta。进入新时间窗口siguiente会自动恢复调度。
                  </p>
                </div>
              </label>
            </div>

            <!-- Claude User-Agent 版本配置 -->
            <div v-if="form.platform === 'claude'" class="mt-4">
              <label class="flex items-start">
                <input
                  v-model="form.useUnifiedUserAgent"
                  class="mt-1 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                />
                <div class="ml-3">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    使用统一 Claude Code 版本
                  </span>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    开启siguiente将使用de真实 Claude Code 客户端捕获统一 User-Agent，提高兼容性
                  </p>
                  <div v-if="unifiedUserAgent" class="mt-1">
                    <div class="flex items-center justify-between">
                      <p class="text-xs text-green-600 dark:text-green-400">
                        💡 当anterior统一版本：{{ unifiedUserAgent }}
                      </p>
                      <button
                        class="ml-2 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        :disabled="clearingCache"
                        type="button"
                        @click="clearUnifiedCache"
                      >
                        <i v-if="!clearingCache" class="fas fa-trash-alt mr-1"></i>
                        <div v-else class="loading-spinner mr-1"></div>
                        {{ clearingCache ? '清除en...' : '清除Caché' }}
                      </button>
                    </div>
                  </div>
                  <div v-else class="mt-1">
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      ⏳ 等待de Claude Code 客户端捕获 User-Agent
                    </p>
                    <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      💡 Sugerencia：如果长时间未能捕获，请Confirmar有 Claude Code 客户端正en使用此Cuenta，
                      o联系开发者检查 User-Agent 格式是否发生变化
                    </p>
                  </div>
                </div>
              </label>
            </div>

            <!-- Claude 统一客户端标识配置 -->
            <div v-if="form.platform === 'claude'" class="mt-4">
              <label class="flex items-start">
                <input
                  v-model="form.useUnifiedClientId"
                  class="mt-1 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                  @change="handleUnifiedClientIdChange"
                />
                <div class="ml-3 flex-1">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    使用统一客户端标识
                  </span>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    开启siguiente将使用固定客户端标识，使所有Solicitud看起来来自同一 客户端，减少特征
                  </p>
                  <div v-if="form.useUnifiedClientId" class="mt-3">
                    <div
                      class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <div class="mb-2 flex items-center justify-between">
                        <span class="text-xs font-medium text-gray-600 dark:text-gray-400"
                          >客户端标识 ID</span
                        >
                        <button
                          class="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                          type="button"
                          @click="regenerateClientId"
                        >
                          <i class="fas fa-sync-alt mr-1" />
                          重新生成
                        </button>
                      </div>
                      <div class="flex items-center gap-2">
                        <code
                          class="block w-full select-all break-all rounded bg-gray-100 px-3 py-2 font-mono text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        >
                          <span class="text-blue-600 dark:text-blue-400">{{
                            form.unifiedClientId.substring(0, 8)
                          }}</span
                          ><span class="text-gray-500 dark:text-gray-500">{{
                            form.unifiedClientId.substring(8, 56)
                          }}</span
                          ><span class="text-blue-600 dark:text-blue-400">{{
                            form.unifiedClientId.substring(56)
                          }}</span>
                        </code>
                      </div>
                      <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <i class="fas fa-info-circle mr-1 text-blue-500" />
                        此ID将替换Solicitudenuser_id客户端部分，保留session部分para粘性会话
                      </p>
                    </div>
                  </div>
                </div>
              </label>
            </div>

            <!-- 所有Plataforma优先级Configuración -->
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >调度优先级 (1-100)</label
              >
              <input
                v-model.number="form.priority"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                max="100"
                min="1"
                placeholder="数字越小优先级越高，默认50"
                type="number"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                数字越小优先级越高，建议范围：1-100
              </p>
            </div>

            <!-- 手动Entrada Token 字段 -->
            <div
              v-if="
                form.addType === 'manual' &&
                form.platform !== 'claude-console' &&
                form.platform !== 'ccr' &&
                form.platform !== 'bedrock' &&
                form.platform !== 'azure_openai' &&
                form.platform !== 'openai-responses'
              "
              class="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4"
            >
              <div class="mb-4 flex items-start gap-3">
                <div
                  class="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500"
                >
                  <i class="fas fa-info text-sm text-white" />
                </div>
                <div>
                  <h5 class="mb-2 font-semibold text-blue-900 dark:text-blue-300">
                    手动Entrada Token
                  </h5>
                  <p
                    v-if="form.platform === 'claude'"
                    class="mb-2 text-sm text-blue-800 dark:text-blue-300"
                  >
                    IngreseVálido Claude Access Token。如果您有 Refresh
                    Token，建议也一并填写以支持自动Actualizar。
                  </p>
                  <p
                    v-else-if="form.platform === 'gemini' || form.platform === 'gemini-antigravity'"
                    class="mb-2 text-sm text-blue-800 dark:text-blue-300"
                  >
                    IngreseVálido Gemini Access Token。如果您有 Refresh
                    Token，建议也一并填写以支持自动Actualizar。
                  </p>
                  <p
                    v-else-if="form.platform === 'openai'"
                    class="mb-2 text-sm text-blue-800 dark:text-blue-300"
                  >
                    IngreseVálido OpenAI Access Token。如果您有 Refresh
                    Token，建议也一并填写以支持自动Actualizar。
                  </p>
                  <p
                    v-else-if="form.platform === 'droid'"
                    class="mb-2 text-sm text-blue-800 dark:text-blue-300"
                  >
                    IngreseVálido Droid Access Token，并同时提供 Refresh Token 以支持自动Actualizar。
                  </p>
                  <div
                    class="mb-2 mt-2 rounded-lg border border-blue-300 bg-white/80 p-3 dark:border-blue-600 dark:bg-gray-800/80"
                  >
                    <p class="mb-1 text-sm font-medium text-blue-900 dark:text-blue-300">
                      <i class="fas fa-folder-open mr-1" />
                      获取 Access Token 方法：
                    </p>
                    <p
                      v-if="form.platform === 'claude'"
                      class="text-xs text-blue-800 dark:text-blue-300"
                    >
                      请de已Iniciar sesión Claude Code 机器arriba获取
                      <code class="rounded bg-blue-100 px-1 py-0.5 font-mono dark:bg-blue-900/50"
                        >~/.claude/.credentials.json</code
                      >
                      文件en凭证， 请勿使用 Claude 官网 API Keys 页面Clave。
                    </p>
                    <p
                      v-else-if="
                        form.platform === 'gemini' || form.platform === 'gemini-antigravity'
                      "
                      class="text-xs text-blue-800 dark:text-blue-300"
                    >
                      请de已Iniciar sesión Gemini CLI 机器arriba获取
                      <code class="rounded bg-blue-100 px-1 py-0.5 font-mono dark:bg-blue-900/50"
                        >~/.config/gemini/credentials.json</code
                      >
                      文件en凭证。
                    </p>
                    <p
                      v-else-if="form.platform === 'openai'"
                      class="text-xs text-blue-800 dark:text-blue-300"
                    >
                      请de已Iniciar sesión OpenAI Cuenta机器arriba获取认证凭证， o通过 OAuth 授权流程获取 Access
                      Token。
                    </p>
                    <p
                      v-else-if="form.platform === 'droid'"
                      class="text-xs text-blue-800 dark:text-blue-300"
                    >
                      请de已完成授权 Droid CLI o Factory.ai Exportar凭证en获取 Access Token 与
                      Refresh Token。
                    </p>
                  </div>
                  <p
                    v-if="form.platform !== 'droid'"
                    class="text-xs text-blue-600 dark:text-blue-400"
                  >
                    💡 如果未填写 Refresh Token，Token 过期siguiente需要手动Actualizar。
                  </p>
                  <p v-else class="text-xs text-red-600 dark:text-red-400">
                    ⚠️ Droid Cuenta必须填写 Refresh Token，缺失将导致无法自动Actualizar Access Token。
                  </p>
                </div>
              </div>

              <div v-if="form.platform === 'openai'">
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >Access Token (可选)</label
                >
                <textarea
                  v-model="form.accessToken"
                  class="form-input w-full resize-none border-gray-300 font-mono text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="可选：如果不填写，系统会自动通过 Refresh Token 获取..."
                  rows="4"
                />
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <i class="fas fa-info-circle mr-1" />
                  Access Token 可选填。如果不提供，系统会通过 Refresh Token 自动获取。
                </p>
              </div>

              <div v-else>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >Access Token *</label
                >
                <textarea
                  v-model="form.accessToken"
                  class="form-input w-full resize-none border-gray-300 font-mono text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.accessToken }"
                  placeholder="Ingrese Access Token..."
                  required
                  rows="4"
                />
                <p v-if="errors.accessToken" class="mt-1 text-xs text-red-500">
                  {{ errors.accessToken }}
                </p>
              </div>

              <div v-if="form.platform === 'openai' || form.platform === 'droid'">
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >Refresh Token *</label
                >
                <textarea
                  v-model="form.refreshToken"
                  class="form-input w-full resize-none border-gray-300 font-mono text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.refreshToken }"
                  placeholder="Ingrese Refresh Token（必填）..."
                  required
                  rows="4"
                />
                <p v-if="errors.refreshToken" class="mt-1 text-xs text-red-500">
                  {{ errors.refreshToken }}
                </p>
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <i class="fas fa-info-circle mr-1" />
                  <template v-if="form.platform === 'openai'">
                    系统将使用 Refresh Token 自动获取 Access Token yUsuarioInformación
                  </template>
                  <template v-else>
                    系统将使用 Refresh Token 自动Actualizar Factory.ai 访问Token，确保Cuenta保持可用。
                  </template>
                </p>
              </div>

              <div v-else>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >Refresh Token (可选)</label
                >
                <textarea
                  v-model="form.refreshToken"
                  class="form-input w-full resize-none border-gray-300 font-mono text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="Ingrese Refresh Token..."
                  rows="4"
                />
              </div>
            </div>

            <!-- API Key 模式Entrada -->
            <div
              v-if="form.addType === 'apikey' && form.platform === 'droid'"
              class="space-y-4 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-700 dark:bg-purple-900/30"
            >
              <div class="mb-4 flex items-start gap-3">
                <div
                  class="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500"
                >
                  <i class="fas fa-key text-sm text-white" />
                </div>
                <div>
                  <h5 class="mb-2 font-semibold text-purple-900 dark:text-purple-200">
                    使用 API Key 调度 Droid
                  </h5>
                  <p class="text-sm text-purple-800 dark:text-purple-200">
                    请填写一 o多  Factory.ai API
                    Key，系统会自动enSolicitud时随机挑选并结合会话哈希维持粘性，确保对话arribaabajo文保持稳定。
                  </p>
                </div>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >API Key 列表 *</label
                >
                <textarea
                  v-model="form.apiKeysInput"
                  class="form-input w-full resize-none border-gray-300 font-mono text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.apiKeys }"
                  placeholder="每行一  API Key，可Pegar多行"
                  required
                  rows="6"
                />
                <p v-if="errors.apiKeys" class="mt-1 text-xs text-red-500">
                  {{ errors.apiKeys }}
                </p>
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <i class="fas fa-info-circle mr-1" />
                  建议para每registros Key 提供独立额度；系统会自动去重并忽略空白行。
                </p>
              </div>

              <div
                class="rounded-lg border border-purple-200 bg-white/70 p-3 text-xs text-purple-800 dark:border-purple-700 dark:bg-purple-800/20 dark:text-purple-100"
              >
                <p class="font-medium"><i class="fas fa-random mr-1" />分配策略Instrucciones</p>
                <ul class="mt-1 list-disc space-y-1 pl-4">
                  <li>新会话将随机命en一 claves，并en会话Válido期内保持粘性。</li>
                  <li>若某 Key 失效，会自动切换到剩余可用 Key，最大化Exitoso率。</li>
                  <li>
                    若arriba游返回 4xx Error码，该 Key 会被自动标记para异常；全部 Key
                    异常siguiente账号将暂停调度。
                  </li>
                </ul>
              </div>
            </div>

            <!-- 代理Configuración -->
            <ProxyConfig v-model="form.proxy" />

            <div class="flex gap-3 pt-4">
              <button
                class="flex-1 rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                type="button"
                @click="$emit('close')"
              >
                Cancelar
              </button>
              <button
                v-if="
                  (form.addType === 'oauth' || form.addType === 'setup-token') &&
                  form.platform !== 'claude-console' &&
                  form.platform !== 'ccr' &&
                  form.platform !== 'bedrock' &&
                  form.platform !== 'azure_openai' &&
                  form.platform !== 'openai-responses' &&
                  form.platform !== 'gemini-api'
                "
                class="btn btn-primary flex-1 px-6 py-3 font-semibold"
                :disabled="loading"
                type="button"
                @click="nextStep"
              >
                abajo一步
              </button>
              <button
                v-else
                class="btn btn-primary flex-1 px-6 py-3 font-semibold"
                :disabled="loading"
                type="button"
                @click="createAccount"
              >
                <div v-if="loading" class="loading-spinner mr-2" />
                {{ loading ? 'Crearen...' : 'Crear' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 步骤2: OAuth授权 -->
        <OAuthFlow
          v-if="oauthStep === 2 && form.addType === 'oauth'"
          :platform="form.platform"
          :proxy="form.proxy"
          @back="oauthStep = 1"
          @success="handleOAuthSuccess"
        />

        <!-- 步骤2: Setup Token授权 -->
        <div v-if="oauthStep === 2 && form.addType === 'setup-token'" class="space-y-6">
          <!-- Claude Setup Token流程 -->
          <div v-if="form.platform === 'claude'">
            <div
              class="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-700 dark:bg-blue-900/30"
            >
              <div class="flex items-start gap-4">
                <div
                  class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500"
                >
                  <i class="fas fa-key text-white" />
                </div>
                <div class="flex-1">
                  <h4 class="mb-3 font-semibold text-blue-900 dark:text-blue-200">
                    Claude Setup Token 授权
                  </h4>
                  <p class="mb-4 text-sm text-blue-800 dark:text-blue-300">
                    请按照以abajo步骤通过 Setup Token 完成 Claude Cuenta授权：
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
                            点击abajo方按钮生成授权链接
                          </p>
                          <button
                            v-if="!setupTokenAuthUrl"
                            class="btn btn-primary px-4 py-2 text-sm"
                            :disabled="setupTokenLoading"
                            @click="generateSetupTokenAuthUrl"
                          >
                            <i v-if="!setupTokenLoading" class="fas fa-link mr-2" />
                            <div v-else class="loading-spinner mr-2" />
                            {{ setupTokenLoading ? '生成en...' : '生成 Setup Token 授权链接' }}
                          </button>
                          <div v-else class="space-y-3">
                            <div class="flex items-center gap-2">
                              <input
                                class="form-input flex-1 bg-gray-50 font-mono text-xs dark:bg-gray-700"
                                readonly
                                type="text"
                                :value="setupTokenAuthUrl"
                              />
                              <button
                                class="rounded-lg bg-gray-100 px-3 py-2 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                                title="Copiar链接"
                                @click="copySetupTokenAuthUrl"
                              >
                                <i
                                  :class="
                                    setupTokenCopied ? 'fas fa-check text-green-500' : 'fas fa-copy'
                                  "
                                />
                              </button>
                            </div>
                            <button
                              class="text-xs text-blue-600 hover:text-blue-700"
                              @click="regenerateSetupTokenAuthUrl"
                            >
                              <i class="fas fa-sync-alt mr-1" />重新生成
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
                            en浏览器en打开链接并完成授权
                          </p>
                          <p class="mb-2 text-sm text-blue-700 dark:text-blue-300">
                            请en新Etiqueta页en打开授权链接，Iniciar sesión您 Claude Cuenta并授权 Claude Code。
                          </p>
                          <div
                            class="rounded border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-900/30"
                          >
                            <p class="text-xs text-yellow-800 dark:text-yellow-300">
                              <i class="fas fa-exclamation-triangle mr-1" />
                              <strong>Nota：</strong
                              >如果您Configuración代理，请确保浏览器也使用相同代理访问授权页面。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 步骤3: Entrada授权码 -->
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
                            Entrada Authorization Code
                          </p>
                          <p class="mb-3 text-sm text-blue-700 dark:text-blue-300">
                            授权完成siguiente，de返回页面Copiar Authorization Code，并Pegar到abajo方Entrada框：
                          </p>
                          <div class="space-y-3">
                            <div>
                              <label
                                class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                              >
                                <i class="fas fa-key mr-2 text-blue-500" />Authorization Code
                              </label>
                              <textarea
                                v-model="setupTokenAuthCode"
                                class="form-input w-full resize-none border-gray-300 font-mono text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                                placeholder="PegardeClaude Code授权页面获取Authorization Code..."
                                rows="3"
                              />
                            </div>
                            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <i class="fas fa-info-circle mr-1" />
                              请PegardeClaude Code授权页面CopiarAuthorization Code
                            </p>
                          </div>
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
              @click="oauthStep = 1"
            >
              arriba一步
            </button>
            <button
              class="btn btn-primary flex-1 px-6 py-3 font-semibold"
              :disabled="!canExchangeSetupToken || setupTokenExchanging"
              type="button"
              @click="exchangeSetupTokenCode"
            >
              <div v-if="setupTokenExchanging" class="loading-spinner mr-2" />
              {{ setupTokenExchanging ? '验证en...' : '完成授权' }}
            </button>
          </div>
        </div>

        <!-- Editar模式 -->
        <div v-if="isEdit" class="space-y-6">
          <!-- 基本Información -->
          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >CuentaNombre</label
            >
            <input
              v-model="form.name"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              placeholder="paraCuentaConfiguración一 易识别Nombre"
              required
              type="text"
            />
          </div>

          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >Descripción (可选)</label
            >
            <textarea
              v-model="form.description"
              class="form-input w-full resize-none border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              placeholder="Cuenta用途Instrucciones..."
              rows="3"
            />
          </div>

          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >CuentaTipo</label
            >
            <div class="flex gap-4">
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.accountType"
                  class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="radio"
                  value="shared"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">共享Cuenta</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.accountType"
                  class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="radio"
                  value="dedicated"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">专属Cuenta</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.accountType"
                  class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="radio"
                  value="group"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">分组调度</span>
              </label>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              共享Cuenta：供所有API Key使用；专属Cuenta：仅供特定API
              Key使用；分组调度：加入分组供分组内调度
            </p>
          </div>

          <!-- 到期时间 - 仅enCrearCuenta时显示，Editar时使用独立过期时间Editar弹窗 -->
          <div v-if="!isEdit">
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >到期时间 (可选)</label
            >
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <select
                v-model="form.expireDuration"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                @change="updateAccountExpireAt"
              >
                <option value="">永不过期</option>
                <option value="30d">30 天</option>
                <option value="90d">90 天</option>
                <option value="180d">180 天</option>
                <option value="365d">365 天</option>
                <option value="custom">自定义日期</option>
              </select>
              <div v-if="form.expireDuration === 'custom'" class="mt-3">
                <input
                  v-model="form.customExpireDate"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  :min="minDateTime"
                  type="datetime-local"
                  @change="updateAccountCustomExpireAt"
                />
              </div>
              <p v-if="form.expiresAt" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <i class="fas fa-calendar-alt mr-1" />
                将于 {{ formatExpireDate(form.expiresAt) }} 过期
              </p>
              <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <i class="fas fa-infinity mr-1" />
                Cuenta永不过期
              </p>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Configuración Claude Max/Pro 订阅到期时间，到期siguiente将停止调度此Cuenta
            </p>
          </div>

          <!-- 分组选择器 -->
          <div v-if="form.accountType === 'group'">
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >选择分组 *</label
            >
            <div class="flex gap-2">
              <div class="flex-1">
                <!-- 多选分组界面 -->
                <div
                  class="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3 dark:border-gray-600 dark:bg-gray-700"
                >
                  <div
                    v-if="filteredGroups.length === 0"
                    class="text-sm text-gray-500 dark:text-gray-400"
                  >
                    Sin可用分组
                  </div>
                  <label
                    v-for="group in filteredGroups"
                    :key="group.id"
                    class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <input
                      v-model="form.groupIds"
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      type="checkbox"
                      :value="group.id"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-200">
                      {{ group.name }} ({{ group.memberCount || 0 }}  成员)
                    </span>
                  </label>
                  <!-- 新建分组选项 -->
                  <div class="border-t pt-2 dark:border-gray-600">
                    <button
                      class="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      type="button"
                      @click="handleNewGroup"
                    >
                      <i class="fas fa-plus" />
                      新建分组
                    </button>
                  </div>
                </div>
              </div>
              <button
                class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                type="button"
                @click="refreshGroups"
              >
                <i class="fas fa-sync-alt" :class="{ 'animate-spin': loadingGroups }" />
              </button>
            </div>
          </div>

          <!-- Gemini 项目 ID 字段 -->
          <div v-if="form.platform === 'gemini' || form.platform === 'gemini-antigravity'">
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >项目 ID (可选)</label
            >
            <input
              v-model="form.projectId"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              placeholder="例如：verdant-wares-464411-k9"
              type="text"
            />
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Google Cloud/Workspace 账号可能需要提供项目 ID
            </p>
          </div>

          <!-- Claude 订阅Tipo选择（Editar模式） -->
          <div v-if="form.platform === 'claude'">
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >订阅Tipo</label
            >
            <div class="flex gap-4">
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.subscriptionType"
                  class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="radio"
                  value="claude_max"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Claude Max</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.subscriptionType"
                  class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="radio"
                  value="claude_pro"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Claude Pro</span>
              </label>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <i class="fas fa-info-circle mr-1" />
              Pro 账号不支持 Claude Opus 4 Modelo
            </p>
          </div>

          <!-- Claude 5小时Límite自动停止调度选项（Editar模式） -->
          <div v-if="form.platform === 'claude'" class="mt-4">
            <label class="flex items-start">
              <input
                v-model="form.autoStopOnWarning"
                class="mt-1 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                type="checkbox"
              />
              <div class="ml-3">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  5小时使用量接近Límite时自动停止调度
                </span>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  当系统检测到Cuenta接近5小时使用Límite时，自动暂停调度该Cuenta。进入新时间窗口siguiente会自动恢复调度。
                </p>
              </div>
            </label>
          </div>

          <!-- Claude User-Agent 版本配置（Editar模式） -->
          <div v-if="form.platform === 'claude'" class="mt-4">
            <label class="flex items-start">
              <input
                v-model="form.useUnifiedUserAgent"
                class="mt-1 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                type="checkbox"
              />
              <div class="ml-3">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  使用统一 Claude Code 版本
                </span>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  开启siguiente将使用de真实 Claude Code 客户端捕获统一 User-Agent，提高兼容性
                </p>
                <div v-if="unifiedUserAgent" class="mt-1">
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-green-600 dark:text-green-400">
                      💡 当anterior统一版本：{{ unifiedUserAgent }}
                    </p>
                    <button
                      class="ml-2 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      :disabled="clearingCache"
                      type="button"
                      @click="clearUnifiedCache"
                    >
                      <i v-if="!clearingCache" class="fas fa-trash-alt mr-1"></i>
                      <div v-else class="loading-spinner mr-1"></div>
                      {{ clearingCache ? '清除en...' : '清除Caché' }}
                    </button>
                  </div>
                </div>
                <div v-else class="mt-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    ⏳ 等待de Claude Code 客户端捕获 User-Agent
                  </p>
                  <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    💡 Sugerencia：如果长时间未能捕获，请Confirmar有 Claude Code 客户端正en使用此Cuenta，
                    o联系开发者检查 User-Agent 格式是否发生变化
                  </p>
                </div>
              </div>
            </label>
          </div>

          <!-- Claude 统一客户端标识配置（Editar模式） -->
          <div v-if="form.platform === 'claude'" class="mt-4">
            <label class="flex items-start">
              <input
                v-model="form.useUnifiedClientId"
                class="mt-1 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                type="checkbox"
                @change="handleUnifiedClientIdChange"
              />
              <div class="ml-3 flex-1">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  使用统一客户端标识
                </span>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  开启siguiente将使用固定客户端标识，使所有Solicitud看起来来自同一 客户端，减少特征
                </p>
                <div v-if="form.useUnifiedClientId" class="mt-3">
                  <div
                    class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                  >
                    <div class="mb-2 flex items-center justify-between">
                      <span class="text-xs font-medium text-gray-600 dark:text-gray-400"
                        >客户端标识 ID</span
                      >
                      <button
                        class="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                        type="button"
                        @click="regenerateClientId"
                      >
                        <i class="fas fa-sync-alt mr-1" />
                        重新生成
                      </button>
                    </div>
                    <div class="flex items-center gap-2">
                      <code
                        class="block w-full select-all break-all rounded bg-gray-100 px-3 py-2 font-mono text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300"
                      >
                        <span class="text-blue-600 dark:text-blue-400">{{
                          form.unifiedClientId.substring(0, 8)
                        }}</span
                        ><span class="text-gray-500 dark:text-gray-500">{{
                          form.unifiedClientId.substring(8, 56)
                        }}</span
                        ><span class="text-blue-600 dark:text-blue-400">{{
                          form.unifiedClientId.substring(56)
                        }}</span>
                      </code>
                    </div>
                    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <i class="fas fa-info-circle mr-1 text-blue-500" />
                      此ID将替换Solicitudenuser_id客户端部分，保留session部分para粘性会话
                    </p>
                  </div>
                </div>
              </div>
            </label>
          </div>

          <!-- 所有Plataforma优先级Configuración（Editar模式） -->
          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >调度优先级 (1-100)</label
            >
            <input
              v-model.number="form.priority"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              max="100"
              min="1"
              placeholder="数字越小优先级越高"
              type="number"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              数字越小优先级越高，建议范围：1-100
            </p>
          </div>

          <!-- Claude Console y CCR 特定字段（Editar模式）-->
          <div
            v-if="form.platform === 'claude-console' || form.platform === 'ccr'"
            class="space-y-4"
          >
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700">API URL</label>
              <input
                v-model="form.apiUrl"
                class="form-input w-full"
                placeholder="例如：https://api.example.com"
                required
                type="text"
              />
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700">API Key</label>
              <input
                v-model="form.apiKey"
                class="form-input w-full"
                placeholder="留空表示不Actualizar"
                type="password"
              />
              <p class="mt-1 text-xs text-gray-500">留空表示不Actualizar API Key</p>
            </div>

            <!-- 额度管理字段 -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  每日额度Limitar ($)
                </label>
                <input
                  v-model.number="form.dailyQuota"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  min="0"
                  placeholder="0 表示不Límite"
                  step="0.01"
                  type="number"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Configuración每日使用额度，0 表示不Límite
                </p>
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  额度Restablecer时间
                </label>
                <input
                  v-model="form.quotaResetTime"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  placeholder="00:00"
                  type="time"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">每日自动Restablecer额度时间</p>
              </div>
            </div>

            <!-- 当anterior使用情况（仅Editar模式显示） -->
            <div
              v-if="isEdit && form.dailyQuota > 0"
              class="rounded-lg bg-gray-50 p-4 dark:bg-gray-800"
            >
              <div class="mb-2 flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Hoy使用情况
                </span>
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  ${{ calculateCurrentUsage().toFixed(4) }} / ${{ form.dailyQuota.toFixed(2) }}
                </span>
              </div>
              <div class="relative h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  class="absolute left-0 top-0 h-full rounded-full transition-all"
                  :class="
                    usagePercentage >= 90
                      ? 'bg-red-500'
                      : usagePercentage >= 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  "
                  :style="{ width: `${Math.min(usagePercentage, 100)}%` }"
                />
              </div>
              <div class="mt-2 flex items-center justify-between text-xs">
                <span class="text-gray-500 dark:text-gray-400">
                  剩余: ${{ Math.max(0, form.dailyQuota - calculateCurrentUsage()).toFixed(2) }}
                </span>
                <span class="text-gray-500 dark:text-gray-400">
                  {{ usagePercentage.toFixed(1) }}% 已使用
                </span>
              </div>
            </div>

            <!-- 并发控制字段（Editar模式）-->
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                最大并发任务数
              </label>
              <input
                v-model.number="form.maxConcurrentTasks"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                min="0"
                placeholder="0 表示不Límite"
                type="number"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Límite该Cuenta并发Solicitud数量，0 表示不Límite
              </p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >Límite de modelos (可选)</label
              >

              <!-- 模式切换 -->
              <div class="mb-4 flex gap-2">
                <button
                  class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                  :class="
                    modelRestrictionMode === 'whitelist'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'border border-gray-300 text-gray-600 hover:border-blue-300 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-500'
                  "
                  type="button"
                  @click="modelRestrictionMode = 'whitelist'"
                >
                  <i class="fas fa-check-circle mr-2" />
                  Modelo白名单
                </button>
                <button
                  class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                  :class="
                    modelRestrictionMode === 'mapping'
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'border border-gray-300 text-gray-600 hover:border-purple-300 dark:border-gray-600 dark:text-gray-400 dark:hover:border-purple-500'
                  "
                  type="button"
                  @click="modelRestrictionMode = 'mapping'"
                >
                  <i class="fas fa-random mr-2" />
                  Modelo映射
                </button>
              </div>

              <!-- 白名单模式 -->
              <div v-if="modelRestrictionMode === 'whitelist'">
                <div class="mb-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/30">
                  <p class="text-xs text-blue-700 dark:text-blue-400">
                    <i class="fas fa-info-circle mr-1" />
                    选择允许使用此CuentaModelo。留空表示支持Todos los modelos。
                  </p>
                </div>

                <!-- Modelo复选框列表 -->
                <div class="mb-3 grid grid-cols-2 gap-2">
                  <label
                    v-for="model in commonModels"
                    :key="model.value"
                    class="flex cursor-pointer items-center rounded-lg border p-3 transition-all hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    :class="
                      allowedModels.includes(model.value)
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                        : 'border-gray-300'
                    "
                  >
                    <input
                      v-model="allowedModels"
                      class="mr-2 text-blue-600 focus:ring-blue-500"
                      type="checkbox"
                      :value="model.value"
                    />
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
                      model.label
                    }}</span>
                  </label>
                </div>

                <p class="text-xs text-gray-500 dark:text-gray-400">
                  已选择 {{ allowedModels.length }}  Modelo
                  <span v-if="allowedModels.length === 0">（支持Todos los modelos）</span>
                </p>
              </div>

              <!-- 映射模式 -->
              <div v-else>
                <div class="mb-3 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/30">
                  <p class="text-xs text-purple-700 dark:text-purple-400">
                    <i class="fas fa-info-circle mr-1" />
                    配置Modelo映射关系。izquierda侧是客户端SolicitudModelo，derecha侧是实际发送给APIModelo。
                  </p>
                </div>

                <!-- Modelo映射表 -->
                <div class="mb-3 space-y-2">
                  <div
                    v-for="(mapping, index) in modelMappings"
                    :key="index"
                    class="flex items-center gap-2"
                  >
                    <input
                      v-model="mapping.from"
                      class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                      placeholder="原始Nombre del modelo"
                      type="text"
                    />
                    <i class="fas fa-arrow-right text-gray-400 dark:text-gray-500" />
                    <input
                      v-model="mapping.to"
                      class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                      placeholder="映射siguienteNombre del modelo"
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

                <!-- 添加映射按钮 -->
                <button
                  class="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500"
                  type="button"
                  @click="addModelMapping"
                >
                  <i class="fas fa-plus mr-2" />
                  添加Modelo映射
                </button>

                <!-- 快捷添加按钮 -->
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    class="rounded-lg bg-blue-100 px-3 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                    type="button"
                    @click="
                      addPresetMapping('claude-sonnet-4-20250514', 'claude-sonnet-4-20250514')
                    "
                  >
                    + Sonnet 4
                  </button>
                  <button
                    class="rounded-lg bg-indigo-100 px-3 py-1 text-xs text-indigo-700 transition-colors hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                    type="button"
                    @click="
                      addPresetMapping('claude-sonnet-4-5-20250929', 'claude-sonnet-4-5-20250929')
                    "
                  >
                    + Sonnet 4.5
                  </button>
                  <button
                    class="rounded-lg bg-purple-100 px-3 py-1 text-xs text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50"
                    type="button"
                    @click="
                      addPresetMapping('claude-opus-4-1-20250805', 'claude-opus-4-1-20250805')
                    "
                  >
                    + Opus 4.1
                  </button>
                  <button
                    class="rounded-lg bg-green-100 px-3 py-1 text-xs text-green-700 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                    type="button"
                    @click="
                      addPresetMapping('claude-3-5-haiku-20241022', 'claude-3-5-haiku-20241022')
                    "
                  >
                    + Haiku 3.5
                  </button>
                  <button
                    class="rounded-lg bg-emerald-100 px-3 py-1 text-xs text-emerald-700 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                    type="button"
                    @click="
                      addPresetMapping('claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001')
                    "
                  >
                    + Haiku 4.5
                  </button>
                  <button
                    class="rounded-lg bg-cyan-100 px-3 py-1 text-xs text-cyan-700 transition-colors hover:bg-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:hover:bg-cyan-900/50"
                    type="button"
                    @click="addPresetMapping('deepseek-chat', 'deepseek-chat')"
                  >
                    + DeepSeek
                  </button>
                  <button
                    class="rounded-lg bg-orange-100 px-3 py-1 text-xs text-orange-700 transition-colors hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50"
                    type="button"
                    @click="addPresetMapping('Qwen', 'Qwen')"
                  >
                    + Qwen
                  </button>
                  <button
                    class="rounded-lg bg-pink-100 px-3 py-1 text-xs text-pink-700 transition-colors hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:hover:bg-pink-900/50"
                    type="button"
                    @click="addPresetMapping('Kimi', 'Kimi')"
                  >
                    + Kimi
                  </button>
                  <button
                    class="rounded-lg bg-teal-100 px-3 py-1 text-xs text-teal-700 transition-colors hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50"
                    type="button"
                    @click="addPresetMapping('GLM', 'GLM')"
                  >
                    + GLM
                  </button>
                  <button
                    class="rounded-lg bg-amber-100 px-3 py-1 text-xs text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                    type="button"
                    @click="
                      addPresetMapping('claude-opus-4-1-20250805', 'claude-sonnet-4-20250514')
                    "
                  >
                    + Opus → Sonnet
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700"
                >自定义 User-Agent (可选)</label
              >
              <input
                v-model="form.userAgent"
                class="form-input w-full"
                placeholder="留空则透传客户端 User-Agent"
                type="text"
              />
              <p class="mt-1 text-xs text-gray-500">
                留空时将自动使用客户端 User-Agent，仅en需要固定特定 UA 时填写
              </p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700">限流机制</label>
              <div class="mb-3">
                <label class="inline-flex cursor-pointer items-center">
                  <input
                    v-model="form.enableRateLimit"
                    class="mr-2 rounded border-gray-300 text-blue-600 focus:border-blue-500 focus:ring focus:ring-blue-200"
                    type="checkbox"
                  />
                  <span class="text-sm text-gray-700">Habilitar限流机制</span>
                </label>
                <p class="mt-1 text-xs text-gray-500">
                  Habilitarsiguiente，当账号返回429Error时将暂停调度一段时间
                </p>
              </div>

              <div v-if="form.enableRateLimit">
                <label class="mb-3 block text-sm font-semibold text-gray-700"
                  >限流时间 (分钟)</label
                >
                <input
                  v-model.number="form.rateLimitDuration"
                  class="form-input w-full"
                  min="1"
                  type="number"
                />
                <p class="mt-1 text-xs text-gray-500">账号被限流siguiente暂停调度时间（分钟）</p>
              </div>
            </div>
          </div>

          <!-- OpenAI-Responses 特定字段（Editar模式）-->
          <div v-if="form.platform === 'openai-responses'" class="space-y-4">
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700">API 基础地址</label>
              <input
                v-model="form.baseApi"
                class="form-input w-full"
                placeholder="https://api.example.com/v1"
                type="url"
              />
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700">API Clave</label>
              <div class="relative">
                <input
                  v-model="form.apiKey"
                  class="form-input w-full pr-10"
                  placeholder="留空表示不Actualizar"
                  :type="showApiKey ? 'text' : 'password'"
                />
                <button
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  type="button"
                  @click="showApiKey = !showApiKey"
                >
                  <i :class="showApiKey ? 'fas fa-eye-slash' : 'fas fa-eye'" />
                </button>
              </div>
              <p class="mt-1 text-xs text-gray-500">留空表示不Actualizar API Key</p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700"
                >自定义 User-Agent</label
              >
              <input
                v-model="form.userAgent"
                class="form-input w-full"
                placeholder="留空则透传客户端 User-Agent"
                type="text"
              />
              <p class="mt-1 text-xs text-gray-500">
                留空时将自动使用客户端 User-Agent，仅en需要固定特定 UA 时填写
              </p>
            </div>

            <!-- 限流时长字段 - 隐藏不显示，保持原值 -->
            <input v-model.number="form.rateLimitDuration" type="hidden" />

            <!-- 额度管理字段 -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  每日额度Limitar ($)
                </label>
                <input
                  v-model.number="form.dailyQuota"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  min="0"
                  placeholder="0 表示不Límite"
                  step="0.01"
                  type="number"
                />
              </div>
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  额度Restablecer时间
                </label>
                <input
                  v-model="form.quotaResetTime"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  type="time"
                />
              </div>
            </div>

            <!-- 并发控制字段 -->
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                最大并发任务数
              </label>
              <input
                v-model.number="form.maxConcurrentTasks"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                min="0"
                placeholder="0 表示不Límite"
                type="number"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Límite该Cuenta并发Solicitud数量，0 表示不Límite
              </p>
            </div>
          </div>

          <!-- Gemini API 特定字段（Editar模式）-->
          <div v-if="form.platform === 'gemini-api'" class="space-y-4">
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >API 基础地址</label
              >
              <input
                v-model="form.baseUrl"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                placeholder="https://generativelanguage.googleapis.com"
                type="url"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                填写 API 基础地址（可包含路径anterior缀），系统会自动拼接
                <code class="rounded bg-gray-100 px-1 dark:bg-gray-600"
                  >/v1beta/models/{model}:generateContent</code
                >
              </p>
              <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                官方:
                <code class="rounded bg-gray-100 px-1 dark:bg-gray-600"
                  >https://generativelanguage.googleapis.com</code
                >
                | arriba游para CRS:
                <code class="rounded bg-gray-100 px-1 dark:bg-gray-600"
                  >https://your-crs.com/gemini</code
                >
              </p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >API Clave</label
              >
              <div class="relative">
                <input
                  v-model="form.apiKey"
                  class="form-input w-full border-gray-300 pr-10 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  placeholder="留空表示不Actualizar"
                  :type="showApiKey ? 'text' : 'password'"
                />
                <button
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
                  type="button"
                  @click="showApiKey = !showApiKey"
                >
                  <i :class="showApiKey ? 'fas fa-eye-slash' : 'fas fa-eye'" />
                </button>
              </div>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">留空表示不Actualizar API Key</p>
            </div>
          </div>

          <!-- Bedrock 特定字段（Editar模式）-->
          <div v-if="form.platform === 'bedrock'" class="space-y-4">
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700">AWS Clave de acceso ID</label>
              <input
                v-model="form.accessKeyId"
                class="form-input w-full"
                placeholder="留空表示不Actualizar"
                type="text"
              />
              <p class="mt-1 text-xs text-gray-500">留空表示不Actualizar AWS Access Key ID</p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700">AWS 秘密Clave de acceso</label>
              <input
                v-model="form.secretAccessKey"
                class="form-input w-full"
                placeholder="留空表示不Actualizar"
                type="password"
              />
              <p class="mt-1 text-xs text-gray-500">留空表示不Actualizar AWS Secret Access Key</p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700">AWS 区域</label>
              <input
                v-model="form.region"
                class="form-input w-full"
                placeholder="例如：us-east-1"
                type="text"
              />
              <div class="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div class="flex items-start gap-2">
                  <i class="fas fa-info-circle mt-0.5 text-blue-600" />
                  <div class="text-xs text-blue-700">
                    <p class="mb-1 font-medium">常用 AWS 区域参考：</p>
                    <div class="grid grid-cols-2 gap-1 text-xs">
                      <span>• us-east-1 (美国东部)</span>
                      <span>• us-west-2 (美国西部)</span>
                      <span>• eu-west-1 (欧洲爱尔兰)</span>
                      <span>• ap-southeast-1 (新加坡)</span>
                      <span>• ap-northeast-1 (东京)</span>
                      <span>• eu-central-1 (法兰克福)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700">会话Token (可选)</label>
              <input
                v-model="form.sessionToken"
                class="form-input w-full"
                placeholder="留空表示不Actualizar"
                type="password"
              />
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700"
                >默认主Modelo (可选)</label
              >
              <input
                v-model="form.defaultModel"
                class="form-input w-full"
                placeholder="例如：us.anthropic.claude-sonnet-4-20250514-v1:0"
                type="text"
              />
              <p class="mt-1 text-xs text-gray-500">
                留空将使用系统默认Modelo。支持 inference profile ID o ARN
              </p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >小快速Modelo (可选)</label
              >
              <input
                v-model="form.smallFastModel"
                class="form-input w-full"
                placeholder="例如：us.anthropic.claude-3-5-haiku-20241022-v1:0"
                type="text"
              />
              <p class="mt-1 text-xs text-gray-500">para快速响应轻量级Modelo，留空将使用系统默认</p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700">限流机制</label>
              <div class="mb-3">
                <label class="inline-flex cursor-pointer items-center">
                  <input
                    v-model="form.enableRateLimit"
                    class="mr-2 rounded border-gray-300 text-blue-600 focus:border-blue-500 focus:ring focus:ring-blue-200"
                    type="checkbox"
                  />
                  <span class="text-sm text-gray-700">Habilitar限流机制</span>
                </label>
                <p class="mt-1 text-xs text-gray-500">
                  Habilitarsiguiente，当账号返回429Error时将暂停调度一段时间
                </p>
              </div>

              <div v-if="form.enableRateLimit">
                <label class="mb-3 block text-sm font-semibold text-gray-700"
                  >限流时间 (分钟)</label
                >
                <input
                  v-model.number="form.rateLimitDuration"
                  class="form-input w-full"
                  min="1"
                  type="number"
                />
                <p class="mt-1 text-xs text-gray-500">账号被限流siguiente暂停调度时间（分钟）</p>
              </div>
            </div>
          </div>

          <!-- Azure OpenAI 特定字段（Editar模式）-->
          <div v-if="form.platform === 'azure_openai'" class="space-y-4">
            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >Azure Endpoint</label
              >
              <input
                v-model="form.azureEndpoint"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                :class="{ 'border-red-500': errors.azureEndpoint }"
                placeholder="https://your-resource.openai.azure.com"
                type="url"
              />
              <p v-if="errors.azureEndpoint" class="mt-1 text-xs text-red-500">
                {{ errors.azureEndpoint }}
              </p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >API 版本</label
              >
              <input
                v-model="form.apiVersion"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                placeholder="2024-02-01"
                type="text"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Azure OpenAI API 版本，默认使用最新稳定版本 2024-02-01
              </p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >部署Nombre</label
              >
              <input
                v-model="form.deploymentName"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                :class="{ 'border-red-500': errors.deploymentName }"
                placeholder="gpt-4"
                type="text"
              />
              <p v-if="errors.deploymentName" class="mt-1 text-xs text-red-500">
                {{ errors.deploymentName }}
              </p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >API Key</label
              >
              <input
                v-model="form.apiKey"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                :class="{ 'border-red-500': errors.apiKey }"
                placeholder="留空表示不Actualizar"
                type="password"
              />
              <p v-if="errors.apiKey" class="mt-1 text-xs text-red-500">
                {{ errors.apiKey }}
              </p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">留空表示不Actualizar API Key</p>
            </div>

            <div>
              <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                >支持Modelo</label
              >
              <div class="flex flex-wrap gap-2">
                <label
                  v-for="model in [
                    'gpt-4',
                    'gpt-4-turbo',
                    'gpt-4o',
                    'gpt-4o-mini',
                    'gpt-5',
                    'gpt-5-mini',
                    'gpt-35-turbo',
                    'gpt-35-turbo-16k',
                    'codex-mini'
                  ]"
                  :key="model"
                  class="flex cursor-pointer items-center"
                >
                  <input
                    v-model="form.supportedModels"
                    class="mr-2 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    type="checkbox"
                    :value="model"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">{{ model }}</span>
                </label>
              </div>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">选择此部署支持ModeloTipo</p>
            </div>
          </div>

          <!-- Token Actualizar -->
          <div
            v-if="isEdit && isEditingDroidApiKey"
            class="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-700 dark:bg-purple-900/30"
          >
            <div class="mb-4 flex items-start gap-3">
              <div
                class="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500"
              >
                <i class="fas fa-retweet text-sm text-white" />
              </div>
              <div class="flex-1">
                <div class="mb-2 flex items-center justify-between">
                  <h5 class="font-semibold text-purple-900 dark:text-purple-200">Actualizar API Key</h5>
                  <button
                    class="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                    type="button"
                    @click="showApiKeyManagement = true"
                  >
                    <i class="fas fa-list-ul" />
                    <span>管理 API Key</span>
                  </button>
                </div>
                <p class="mb-1 text-sm text-purple-800 dark:text-purple-200">
                  当anterior已Guardar <strong>{{ existingApiKeyCount }}</strong> registros API Key。您可以追加新
                  Key，o通过abajo方模式快速覆盖、Eliminar指定 Key。
                </p>
                <p class="text-xs text-purple-700 dark:text-purple-300">
                  留空表示保留现有 Key 不变；根据所选模式决定是追加、覆盖还是EliminarEntrada Key。
                </p>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >新 API Key 列表</label
                >
                <textarea
                  v-model="form.apiKeysInput"
                  class="form-input w-full resize-none border-gray-300 font-mono text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  :class="{ 'border-red-500': errors.apiKeys }"
                  placeholder="根据模式填写；每行一  API Key"
                  rows="6"
                />
                <p v-if="errors.apiKeys" class="mt-1 text-xs text-red-500">
                  {{ errors.apiKeys }}
                </p>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-purple-800 dark:text-purple-100"
                    >API Key Actualizar模式</span
                  >
                  <span class="text-xs text-purple-600 dark:text-purple-300">
                    {{ currentApiKeyModeLabel }}
                  </span>
                </div>
                <div
                  class="relative grid h-11 grid-cols-3 overflow-hidden rounded-2xl border border-purple-200/80 bg-gradient-to-r from-purple-50/80 via-white to-purple-50/80 shadow-inner dark:border-purple-700/70 dark:from-purple-900/40 dark:via-purple-900/20 dark:to-purple-900/40"
                >
                  <span
                    class="pointer-events-none absolute inset-y-0 rounded-2xl bg-gradient-to-r from-purple-500/90 via-purple-600 to-indigo-500/90 shadow-lg ring-1 ring-purple-100/80 transition-all duration-300 ease-out dark:from-purple-500/70 dark:via-purple-600/70 dark:to-indigo-500/70 dark:ring-purple-400/30"
                    :style="apiKeyModeSliderStyle"
                  />
                  <button
                    v-for="option in apiKeyModeOptions"
                    :key="option.value"
                    class="relative z-10 flex items-center justify-center rounded-2xl px-2 text-xs font-semibold transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 dark:focus-visible:ring-purple-400/60"
                    :class="
                      form.apiKeyUpdateMode === option.value
                        ? 'text-white drop-shadow-sm'
                        : 'text-purple-500/80 hover:text-purple-700 dark:text-purple-200/70 dark:hover:text-purple-100'
                    "
                    type="button"
                    @click="form.apiKeyUpdateMode = option.value"
                  >
                    {{ option.label }}
                  </button>
                </div>
                <p class="text-xs text-purple-700 dark:text-purple-300">
                  {{ currentApiKeyModeDescription }}
                </p>
              </div>

              <div
                class="rounded-lg border border-purple-200 bg-white/70 p-3 text-xs text-purple-800 dark:border-purple-700 dark:bg-purple-800/20 dark:text-purple-100"
              >
                <p class="font-medium"><i class="fas fa-lightbulb mr-1" />小Sugerencia</p>
                <ul class="mt-1 list-disc space-y-1 pl-4">
                  <li>系统会para新 Key 自动建立粘性映射，保持同一会话命en同一 claves。</li>
                  <li>追加模式会保留现有 Key 并en末尾追加新 Key。</li>
                  <li>覆盖模式会先清空旧 Key 再写入arriba方新列表。</li>
                  <li>Eliminar模式会根据Entrada精准移除指定 Key，适合快速处理失效o被封禁 Key。</li>
                </ul>
              </div>
            </div>
          </div>

          <div
            v-if="
              !(isEdit && isEditingDroidApiKey) &&
              form.platform !== 'claude-console' &&
              form.platform !== 'ccr' &&
              form.platform !== 'bedrock' &&
              form.platform !== 'azure_openai' &&
              form.platform !== 'openai-responses'
            "
            class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/30"
          >
            <div class="mb-4 flex items-start gap-3">
              <div
                class="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500"
              >
                <i class="fas fa-key text-sm text-white" />
              </div>
              <div>
                <h5 class="mb-2 font-semibold text-amber-900 dark:text-amber-300">Actualizar Token</h5>
                <p class="mb-2 text-sm text-amber-800 dark:text-amber-300">
                  可以Actualizar Access Token y Refresh Token。para安全起见，不会显示当anterior Token 值。
                </p>
                <p class="text-xs text-amber-600 dark:text-amber-400">💡 留空表示不Actualizar该字段。</p>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >新 Access Token</label
                >
                <textarea
                  v-model="form.accessToken"
                  class="form-input w-full resize-none border-gray-300 font-mono text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="留空表示不Actualizar..."
                  rows="4"
                />
              </div>

              <div>
                <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >新 Refresh Token</label
                >
                <textarea
                  v-model="form.refreshToken"
                  class="form-input w-full resize-none border-gray-300 font-mono text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                  placeholder="留空表示不Actualizar..."
                  rows="4"
                />
              </div>
            </div>
          </div>

          <!-- 代理Configuración -->
          <ProxyConfig v-model="form.proxy" />

          <div class="flex gap-3 pt-4">
            <button
              class="flex-1 rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              type="button"
              @click="$emit('close')"
            >
              Cancelar
            </button>
            <button
              class="btn btn-primary flex-1 px-6 py-3 font-semibold"
              :disabled="loading"
              type="button"
              @click="updateAccount"
            >
              <div v-if="loading" class="loading-spinner mr-2" />
              {{ loading ? 'Actualizaren...' : 'Actualizar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmar弹窗 -->
    <ConfirmModal
      :cancel-text="confirmOptions.cancelText"
      :confirm-text="confirmOptions.confirmText"
      :message="confirmOptions.message"
      :show="showConfirmModal"
      :title="confirmOptions.title"
      @cancel="handleCancel"
      @confirm="handleConfirm"
    />

    <!-- 分组管理模态框 -->
    <GroupManagementModal
      v-if="showGroupManagement"
      @close="showGroupManagement = false"
      @refresh="handleGroupRefresh"
    />

    <!-- API Key 管理模态框 -->
    <ApiKeyManagementModal
      v-if="showApiKeyManagement"
      :account-id="props.account?.id"
      :account-name="props.account?.name"
      @close="showApiKeyManagement = false"
      @refresh="handleApiKeyRefresh"
    />
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { showToast } from '@/utils/tools'

import * as httpApis from '@/utils/http_apis'
import { useAccountsStore } from '@/stores/accounts'
import ProxyConfig from './ProxyConfig.vue'
import OAuthFlow from './OAuthFlow.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import GroupManagementModal from './GroupManagementModal.vue'
import ApiKeyManagementModal from './ApiKeyManagementModal.vue'

const props = defineProps({
  account: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'success', 'platform-changed'])

const accountsStore = useAccountsStore()

// Confirmar弹窗Estado
const showConfirmModal = ref(false)
const confirmOptions = ref({ title: '', message: '', confirmText: '继续', cancelText: 'Cancelar' })
let confirmResolve = null
const showConfirm = (title, message, confirmText = '继续', cancelText = 'Cancelar') => {
  return new Promise((resolve) => {
    confirmOptions.value = { title, message, confirmText, cancelText }
    confirmResolve = resolve
    showConfirmModal.value = true
  })
}
const handleConfirm = () => {
  showConfirmModal.value = false
  confirmResolve?.(true)
  confirmResolve = null
}
const handleCancel = () => {
  showConfirmModal.value = false
  confirmResolve?.(false)
  confirmResolve = null
}

// 是否paraEditar模式
const isEdit = computed(() => !!props.account)
const show = ref(true)

// OAuth步骤
const oauthStep = ref(1)
const loading = ref(false)
const showApiKey = ref(false)

// Setup Token 相关Estado
const setupTokenLoading = ref(false)
const setupTokenExchanging = ref(false)
const setupTokenAuthUrl = ref('')
const setupTokenAuthCode = ref('')
const setupTokenCopied = ref(false)
const setupTokenSessionId = ref('')

// Claude Code 统一 User-Agent Información
const unifiedUserAgent = ref('')
const clearingCache = ref(false)
// 客户端标识EditarEstado（已废弃，不再需要Editar功能）
// const editingClientId = ref(false)

// Plataforma分组Estado
const platformGroup = ref('')

// API Key 管理模态框
const showApiKeyManagement = ref(false)

// 根据现有PlataformaConfirmar分组
const determinePlatformGroup = (platform) => {
  if (['claude', 'claude-console', 'ccr', 'bedrock'].includes(platform)) {
    return 'claude'
  } else if (['openai', 'openai-responses', 'azure_openai'].includes(platform)) {
    return 'openai'
  } else if (['gemini', 'gemini-antigravity', 'gemini-api'].includes(platform)) {
    return 'gemini'
  } else if (platform === 'droid') {
    return 'droid'
  }
  return ''
}

const createDefaultProxyState = () => ({
  enabled: false,
  type: 'socks5',
  host: '',
  port: '',
  username: '',
  password: ''
})

const parseProxyResponse = (rawProxy) => {
  if (!rawProxy) {
    return null
  }

  let proxyObject = rawProxy
  if (typeof rawProxy === 'string') {
    try {
      proxyObject = JSON.parse(rawProxy)
    } catch (error) {
      return null
    }
  }

  if (
    proxyObject &&
    typeof proxyObject === 'object' &&
    proxyObject.proxy &&
    typeof proxyObject.proxy === 'object'
  ) {
    proxyObject = proxyObject.proxy
  }

  if (!proxyObject || typeof proxyObject !== 'object') {
    return null
  }

  const host =
    typeof proxyObject.host === 'string'
      ? proxyObject.host.trim()
      : proxyObject.host !== undefined && proxyObject.host !== null
        ? String(proxyObject.host).trim()
        : ''

  const port =
    proxyObject.port !== undefined && proxyObject.port !== null
      ? String(proxyObject.port).trim()
      : ''

  const type =
    typeof proxyObject.type === 'string' && proxyObject.type.trim()
      ? proxyObject.type.trim()
      : 'socks5'

  const username =
    typeof proxyObject.username === 'string'
      ? proxyObject.username
      : proxyObject.username !== undefined && proxyObject.username !== null
        ? String(proxyObject.username)
        : ''

  const password =
    typeof proxyObject.password === 'string'
      ? proxyObject.password
      : proxyObject.password !== undefined && proxyObject.password !== null
        ? String(proxyObject.password)
        : ''

  return {
    type,
    host,
    port,
    username,
    password
  }
}

const normalizeProxyFormState = (rawProxy) => {
  const parsed = parseProxyResponse(rawProxy)

  if (parsed && parsed.host && parsed.port) {
    return {
      enabled: true,
      type: parsed.type || 'socks5',
      host: parsed.host,
      port: parsed.port,
      username: parsed.username || '',
      password: parsed.password || ''
    }
  }

  return createDefaultProxyState()
}

const buildProxyPayload = (proxyState) => {
  if (!proxyState || !proxyState.enabled) {
    return null
  }

  const host = (proxyState.host || '').trim()
  const portNumber = Number.parseInt(proxyState.port, 10)

  if (!host || Number.isNaN(portNumber) || portNumber <= 0) {
    return null
  }

  const username = proxyState.username ? proxyState.username.trim() : ''
  const password = proxyState.password ? proxyState.password.trim() : ''

  return {
    type: proxyState.type || 'socks5',
    host,
    port: portNumber,
    username: username || null,
    password: password || null
  }
}

// 初始化代理配置
const initProxyConfig = () => {
  return normalizeProxyFormState(props.account?.proxy)
}

// 表单数据
const form = ref({
  platform: props.account?.platform || 'claude',
  addType: (() => {
    const platform = props.account?.platform || 'claude'
    if (platform === 'gemini' || platform === 'gemini-antigravity' || platform === 'openai')
      return 'oauth'
    if (platform === 'claude') return 'oauth'
    return 'manual'
  })(),
  name: props.account?.name || '',
  description: props.account?.description || '',
  accountType: props.account?.accountType || 'shared',
  authenticationMethod: props.account?.authenticationMethod || '',
  subscriptionType: 'claude_max', // 默认para Claude Max，兼容旧数据
  autoStopOnWarning: props.account?.autoStopOnWarning || false, // 5小时Límite自动停止调度
  useUnifiedUserAgent: props.account?.useUnifiedUserAgent || false, // 使用统一Claude Code版本
  useUnifiedClientId: props.account?.useUnifiedClientId || false, // 使用统一客户端标识
  unifiedClientId: props.account?.unifiedClientId || '', // 统一客户端标识
  groupId: '',
  groupIds: [],
  projectId: props.account?.projectId || '',
  accessToken: '',
  refreshToken: '',
  apiKeysInput: '',
  apiKeyUpdateMode: 'append',
  proxy: initProxyConfig(),
  // Claude Console 特定字段
  apiUrl: props.account?.apiUrl || '',
  apiKey: props.account?.apiKey || '',
  priority: props.account?.priority || 50,
  endpointType: props.account?.endpointType || 'anthropic',
  // OpenAI-Responses 特定字段
  baseApi: props.account?.baseApi || '',
  rateLimitDuration: props.account?.rateLimitDuration || 60,
  supportedModels: (() => {
    const models = props.account?.supportedModels
    if (!models) return []
    // 处理对象格式（Claude Console 新格式）
    if (typeof models === 'object' && !Array.isArray(models)) {
      return Object.keys(models)
    }
    // 处理数组格式（向siguiente兼容）
    if (Array.isArray(models)) {
      return models
    }
    return []
  })(),
  userAgent: props.account?.userAgent || '',
  enableRateLimit: props.account ? props.account.rateLimitDuration > 0 : true,
  // 额度管理字段
  dailyQuota: props.account?.dailyQuota || 0,
  dailyUsage: props.account?.dailyUsage || 0,
  quotaResetTime: props.account?.quotaResetTime || '00:00',
  // 并发控制字段
  maxConcurrentTasks: props.account?.maxConcurrentTasks || 0,
  // Bedrock 特定字段
  credentialType: props.account?.credentialType || 'access_key', // 'access_key' o 'bearer_token'
  accessKeyId: props.account?.accessKeyId || '',
  secretAccessKey: props.account?.secretAccessKey || '',
  region: props.account?.region || '',
  sessionToken: props.account?.sessionToken || '',
  bearerToken: props.account?.bearerToken || '', // Bearer Token 字段
  defaultModel: props.account?.defaultModel || '',
  smallFastModel: props.account?.smallFastModel || '',
  // Azure OpenAI 特定字段
  azureEndpoint: props.account?.azureEndpoint || '',
  apiVersion: props.account?.apiVersion || '',
  deploymentName: props.account?.deploymentName || '',
  // 到期时间字段
  expireDuration: (() => {
    // Editar时根据expiresAt初始化expireDuration
    if (props.account?.expiresAt) {
      return 'custom' // 如果有过期时间，默认显示para自定义
    }
    return ''
  })(),
  customExpireDate: (() => {
    // Editar时根据expiresAt初始化customExpireDate
    if (props.account?.expiresAt) {
      // 转换ISO时间paradatetime-local格式 (YYYY-MM-DDTHH:mm)
      return new Date(props.account.expiresAt).toISOString().slice(0, 16)
    }
    return ''
  })(),
  expiresAt: props.account?.expiresAt || null
})

// ModeloConfiguración de límites
const modelRestrictionMode = ref('whitelist') // 'whitelist' o 'mapping'
const allowedModels = ref([
  // 默认勾选所有 Sonnet y Haiku Modelo
  'claude-sonnet-4-20250514',
  'claude-sonnet-4-5-20250929',
  'claude-3-5-haiku-20241022'
]) // 白名单模式abajo选enModelo列表

// 常用Modelo列表（de API 获取）
const commonModels = ref([])

// 加载Modelo列表
const loadCommonModels = async () => {
  try {
    const result = await httpApis.getModelsApi()
    if (result.success && result.data?.all) {
      commonModels.value = result.data.all
    }
  } catch (error) {
    console.error('Failed to load models:', error)
  }
}

// Modelo映射表数据
const modelMappings = ref([])

// 初始化Modelo映射表
const initModelMappings = () => {
  if (props.account?.supportedModels) {
    // 如果是对象格式（新映射表）
    if (
      typeof props.account.supportedModels === 'object' &&
      !Array.isArray(props.account.supportedModels)
    ) {
      const entries = Object.entries(props.account.supportedModels)

      // 判断是白名单模式还是映射模式
      // 如果所有映射都是"映射到自己"，则视para白名单模式
      const isWhitelist = entries.every(([from, to]) => from === to)
      if (isWhitelist) {
        modelRestrictionMode.value = 'whitelist'
        // 白名单模式：Configuración allowedModels（显示勾选Modelo）
        allowedModels.value = entries.map(([from]) => from)
        // 同时保留 modelMappings（以便Usuario切换到映射模式时有初始数据）
        modelMappings.value = entries.map(([from, to]) => ({ from, to }))
      } else {
        modelRestrictionMode.value = 'mapping'
        // 映射模式：Configuración modelMappings（显示映射表）
        modelMappings.value = entries.map(([from, to]) => ({ from, to }))
        // 不填充 allowedModels，因para映射模式不使用白名单复选框
      }
    } else if (Array.isArray(props.account.supportedModels)) {
      // 如果是数组格式（旧格式），转换para白名单模式
      modelRestrictionMode.value = 'whitelist'
      allowedModels.value = props.account.supportedModels
      // 同时Configuración modelMappings para自映射
      modelMappings.value = props.account.supportedModels.map((model) => ({
        from: model,
        to: model
      }))
    }
  }
}

// 解析多行 API Key Entrada
const parseApiKeysInput = (input) => {
  if (!input || typeof input !== 'string') {
    return []
  }

  const segments = input
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  if (segments.length === 0) {
    return []
  }

  const uniqueKeys = Array.from(new Set(segments))
  return uniqueKeys
}

const apiKeyModeOptions = [
  {
    value: 'append',
    label: '追加模式',
    description: '保留现有 Key，并en末尾追加新 Key 列表。'
  },
  {
    value: 'replace',
    label: '覆盖模式',
    description: '先清空旧 Key，再写入arriba方新 Key 列表。'
  },
  {
    value: 'delete',
    label: 'Eliminar模式',
    description: 'Entrada要移除 Key，可精准Eliminar失效o被封禁 Key。'
  }
]

const apiKeyModeSliderStyle = computed(() => {
  const index = Math.max(
    apiKeyModeOptions.findIndex((option) => option.value === form.value.apiKeyUpdateMode),
    0
  )
  const widthPercent = 100 / apiKeyModeOptions.length

  return {
    width: `${widthPercent}%`,
    left: `${index * widthPercent}%`
  }
})

const currentApiKeyModeLabel = computed(() => {
  const option = apiKeyModeOptions.find((item) => item.value === form.value.apiKeyUpdateMode)
  return option ? option.label : apiKeyModeOptions[0].label
})

const currentApiKeyModeDescription = computed(() => {
  const option = apiKeyModeOptions.find((item) => item.value === form.value.apiKeyUpdateMode)
  return option ? option.description : apiKeyModeOptions[0].description
})

// 表单验证Error
const errors = ref({
  name: '',
  refreshToken: '',
  accessToken: '',
  apiKeys: '',
  apiUrl: '',
  apiKey: '',
  baseApi: '',
  accessKeyId: '',
  secretAccessKey: '',
  region: '',
  bearerToken: '',
  azureEndpoint: '',
  deploymentName: ''
})

// 计算是否可以进入abajo一步
const canProceed = computed(() => {
  return form.value.name?.trim() && form.value.platform
})

// 计算是否可以交换Setup Token code
const canExchangeSetupToken = computed(() => {
  return setupTokenAuthUrl.value && setupTokenAuthCode.value.trim()
})

// 获取当anterior使用量（实时）
const calculateCurrentUsage = () => {
  // 如果不是Editar模式o没有CuentaID，返回0
  if (!isEdit.value || !props.account?.id) {
    return 0
  }

  // 如果已经加载Hoy使用数据，直接使用
  if (typeof form.value.dailyUsage === 'number') {
    return form.value.dailyUsage
  }

  return 0
}

// 计算额度使用百分比
const usagePercentage = computed(() => {
  if (!form.value.dailyQuota || form.value.dailyQuota <= 0) {
    return 0
  }
  const currentUsage = calculateCurrentUsage()
  return (currentUsage / form.value.dailyQuota) * 100
})

// 当anteriorCuenta API Key 数量（仅para展示）
const existingApiKeyCount = computed(() => {
  if (!props.account || props.account.platform !== 'droid') {
    return 0
  }

  let fallbackList = 0

  if (Array.isArray(props.account.apiKeys)) {
    fallbackList = props.account.apiKeys.length
  } else if (typeof props.account.apiKeys === 'string') {
    try {
      const parsed = JSON.parse(props.account.apiKeys)
      if (Array.isArray(parsed)) {
        fallbackList = parsed.length
      }
    } catch (error) {
      fallbackList = 0
    }
  }

  const count =
    props.account.apiKeyCount ??
    props.account.apiKeysCount ??
    props.account.api_key_count ??
    fallbackList

  return Number(count) || 0
})

// Editar时判断是否para API Key 模式 Droid Cuenta
const isEditingDroidApiKey = computed(() => {
  if (!isEdit.value || form.value.platform !== 'droid') {
    return false
  }
  const method =
    form.value.authenticationMethod ||
    props.account?.authenticationMethod ||
    props.account?.authMethod ||
    props.account?.authentication_mode ||
    ''

  if (typeof method !== 'string') {
    return false
  }

  return method.trim().toLowerCase() === 'api_key'
})

// 加载CuentaHoy使用情况
const loadAccountUsage = async () => {
  if (!isEdit.value || !props.account?.id) return

  try {
    const response = await httpApis.getClaudeConsoleAccountUsageApi(props.account.id)
    if (response) {
      // Actualizar表单en使用量数据
      form.value.dailyUsage = response.dailyUsage || 0
    }
  } catch (error) {
    // 静默处理使用量加载Fallido
  }
}

// // 计算是否可以Crear
// const canCreate = computed(() => {
//   if (form.value.addType === 'manual') {
//     return form.value.name?.trim() && form.value.accessToken?.trim()
//   }
//   return form.value.name?.trim()
// })

// 选择Plataforma分组
const selectPlatformGroup = (group) => {
  platformGroup.value = group
  // 根据分组自动选择默认Plataforma
  if (group === 'claude') {
    form.value.platform = 'claude'
  } else if (group === 'openai') {
    form.value.platform = 'openai'
  } else if (group === 'gemini') {
    form.value.platform = 'gemini' // Default to Gemini CLI, user can select Antigravity
  } else if (group === 'droid') {
    form.value.platform = 'droid'
  }
}

// abajo一步
const nextStep = async () => {
  // 清除之anteriorError
  errors.value.name = ''

  if (!canProceed.value) {
    if (!form.value.name || form.value.name.trim() === '') {
      errors.value.name = '请填写CuentaNombre'
    }
    return
  }

  // 分组Tipo验证 - OAuth流程修复
  if (
    form.value.accountType === 'group' &&
    (!form.value.groupIds || form.value.groupIds.length === 0)
  ) {
    showToast('请选择一 分组', 'error')
    return
  }

  // 数据同步：确保 groupId y groupIds 保持一致 - OAuth流程
  if (form.value.accountType === 'group') {
    if (form.value.groupIds && form.value.groupIds.length > 0) {
      form.value.groupId = form.value.groupIds[0]
    } else {
      form.value.groupId = ''
    }
  }

  // 对于GeminiCuenta，检查项目 ID
  if (
    (form.value.platform === 'gemini' || form.value.platform === 'gemini-antigravity') &&
    oauthStep.value === 1 &&
    form.value.addType === 'oauth'
  ) {
    if (!form.value.projectId || form.value.projectId.trim() === '') {
      // 使用自定义Confirmar弹窗
      const confirmed = await showConfirm(
        '项目 ID 未填写',
        '您尚未填写项目 ID。\n\n如果您Google账号绑定Google Cloudo被识别paraWorkspace账号，需要提供项目 ID。\n如果您使用是普通 人账号，可以继续不填写。',
        '继续',
        '返回填写'
      )
      if (!confirmed) {
        return
      }
    }
  }

  oauthStep.value = 2
}

// Setup Token 相关方法
// 生成Setup Token授权URL
const generateSetupTokenAuthUrl = async () => {
  setupTokenLoading.value = true
  try {
    const proxyPayload = buildProxyPayload(form.value.proxy)
    const proxyConfig = proxyPayload ? { proxy: proxyPayload } : {}

    const result = await accountsStore.generateClaudeSetupTokenUrl(proxyConfig)
    setupTokenAuthUrl.value = result.authUrl
    setupTokenSessionId.value = result.sessionId
  } catch (error) {
    showToast(error.message || '生成Setup Token授权链接Fallido', 'error')
  } finally {
    setupTokenLoading.value = false
  }
}

// 重新生成Setup Token授权URL
const regenerateSetupTokenAuthUrl = () => {
  setupTokenAuthUrl.value = ''
  setupTokenAuthCode.value = ''
  generateSetupTokenAuthUrl()
}

// CopiarSetup Token授权URL
const copySetupTokenAuthUrl = async () => {
  try {
    await navigator.clipboard.writeText(setupTokenAuthUrl.value)
    setupTokenCopied.value = true
    showToast('链接已Copiar', 'success')
    setTimeout(() => {
      setupTokenCopied.value = false
    }, 2000)
  } catch (error) {
    // 降级方案 - 使用 textarea 替代 input，Deshabilitar ESLint Advertencia
    const textarea = document.createElement('textarea')
    textarea.value = setupTokenAuthUrl.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    try {
      // eslint-disable-next-line
      const successful = document.execCommand('copy')
      if (successful) {
        setupTokenCopied.value = true
        showToast('链接已Copiar', 'success')
      } else {
        showToast('CopiarFallido，请手动Copiar', 'error')
      }
    } catch (err) {
      showToast('CopiarFallido，请手动Copiar', 'error')
    }

    document.body.removeChild(textarea)
    setTimeout(() => {
      setupTokenCopied.value = false
    }, 2000)
  }
}

// 交换Setup Token授权码
const exchangeSetupTokenCode = async () => {
  if (!canExchangeSetupToken.value) return

  setupTokenExchanging.value = true
  try {
    const data = {
      sessionId: setupTokenSessionId.value,
      callbackUrl: setupTokenAuthCode.value.trim()
    }

    // 添加代理配置（如果Habilitar）
    const proxyPayload = buildProxyPayload(form.value.proxy)
    if (proxyPayload) {
      data.proxy = proxyPayload
    }

    const tokenInfo = await accountsStore.exchangeClaudeSetupTokenCode(data)

    // Setup Token模式也需要确保生成客户端ID
    if (form.value.useUnifiedClientId && !form.value.unifiedClientId) {
      form.value.unifiedClientId = generateClientId()
    }

    // 调用相同Exitoso处理函数
    await handleOAuthSuccess(tokenInfo)
  } catch (error) {
    showToast(error.message || 'Setup Token授权Fallido，请检查授权码是否正确', 'error')
  } finally {
    setupTokenExchanging.value = false
  }
}

// 处理OAuthExitoso
const handleOAuthSuccess = async (tokenInfo) => {
  loading.value = true
  try {
    // OAuth模式也需要确保生成客户端ID
    if (
      form.value.platform === 'claude' &&
      form.value.useUnifiedClientId &&
      !form.value.unifiedClientId
    ) {
      form.value.unifiedClientId = generateClientId()
    }

    const proxyPayload = buildProxyPayload(form.value.proxy)

    const data = {
      name: form.value.name,
      description: form.value.description,
      accountType: form.value.accountType,
      groupId: form.value.accountType === 'group' ? form.value.groupId : undefined,
      groupIds: form.value.accountType === 'group' ? form.value.groupIds : undefined,
      expiresAt: form.value.expiresAt || undefined,
      proxy: proxyPayload
    }

    const currentPlatform = form.value.platform

    if (currentPlatform === 'claude') {
      // Claude使用claudeAiOauth字段
      const claudeOauthPayload = tokenInfo.claudeAiOauth || tokenInfo
      data.claudeAiOauth = claudeOauthPayload
      if (claudeOauthPayload) {
        const extInfoPayload = {}
        const extSource = claudeOauthPayload.extInfo
        if (extSource && typeof extSource === 'object') {
          if (extSource.org_uuid) {
            extInfoPayload.org_uuid = extSource.org_uuid
          }
          if (extSource.account_uuid) {
            extInfoPayload.account_uuid = extSource.account_uuid
          }
        }

        if (!extSource) {
          const orgUuid = claudeOauthPayload.organization?.uuid
          const accountUuid = claudeOauthPayload.account?.uuid
          if (orgUuid) {
            extInfoPayload.org_uuid = orgUuid
          }
          if (accountUuid) {
            extInfoPayload.account_uuid = accountUuid
          }
        }

        if (Object.keys(extInfoPayload).length > 0) {
          data.extInfo = extInfoPayload
        }
      }
      data.priority = form.value.priority || 50
      data.autoStopOnWarning = form.value.autoStopOnWarning || false
      data.useUnifiedUserAgent = form.value.useUnifiedUserAgent || false
      data.useUnifiedClientId = form.value.useUnifiedClientId || false
      data.unifiedClientId = form.value.unifiedClientId || ''
      // 添加订阅TipoInformación
      data.subscriptionInfo = {
        accountType: form.value.subscriptionType || 'claude_max',
        hasClaudeMax: form.value.subscriptionType === 'claude_max',
        hasClaudePro: form.value.subscriptionType === 'claude_pro',
        manuallySet: true // 标记para手动Configuración
      }
    } else if (currentPlatform === 'gemini' || currentPlatform === 'gemini-antigravity') {
      // Gemini/Antigravity使用geminiOauth字段
      data.geminiOauth = tokenInfo.tokens || tokenInfo
      // 根据 platform Configuración oauthProvider
      data.oauthProvider =
        currentPlatform === 'gemini-antigravity'
          ? 'antigravity'
          : tokenInfo.oauthProvider || 'gemini-cli'
      if (form.value.projectId) {
        data.projectId = form.value.projectId
      }
      // 添加 Gemini 优先级
      data.priority = form.value.priority || 50
    } else if (currentPlatform === 'openai') {
      data.openaiOauth = tokenInfo.tokens || tokenInfo
      data.accountInfo = tokenInfo.accountInfo
      data.priority = form.value.priority || 50
    } else if (currentPlatform === 'droid') {
      const rawTokens = tokenInfo.tokens || tokenInfo || {}

      const normalizedTokens = {
        accessToken: rawTokens.accessToken || rawTokens.access_token || '',
        refreshToken: rawTokens.refreshToken || rawTokens.refresh_token || '',
        expiresAt: rawTokens.expiresAt || rawTokens.expires_at || '',
        expiresIn: rawTokens.expiresIn || rawTokens.expires_in || null,
        tokenType: rawTokens.tokenType || rawTokens.token_type || 'Bearer',
        organizationId: rawTokens.organizationId || rawTokens.organization_id || '',
        authenticationMethod:
          rawTokens.authenticationMethod || rawTokens.authentication_method || ''
      }

      if (!normalizedTokens.refreshToken) {
        loading.value = false
        showToast('授权Exitoso但未返回 Refresh Token，请Confirmar已授予离线访问权限siguiente重试。', 'error')
        return
      }

      data.refreshToken = normalizedTokens.refreshToken
      data.accessToken = normalizedTokens.accessToken
      data.expiresAt = normalizedTokens.expiresAt
      if (normalizedTokens.expiresIn !== null && normalizedTokens.expiresIn !== undefined) {
        data.expiresIn = normalizedTokens.expiresIn
      }
      data.priority = form.value.priority || 50
      data.endpointType = form.value.endpointType || 'anthropic'
      data.platform = 'droid'
      data.tokenType = normalizedTokens.tokenType
      data.authenticationMethod = normalizedTokens.authenticationMethod

      if (normalizedTokens.organizationId) {
        data.organizationId = normalizedTokens.organizationId
      }

      if (rawTokens.user) {
        const user = rawTokens.user
        const nameParts = []
        if (typeof user.first_name === 'string' && user.first_name.trim()) {
          nameParts.push(user.first_name.trim())
        }
        if (typeof user.last_name === 'string' && user.last_name.trim()) {
          nameParts.push(user.last_name.trim())
        }
        const derivedName =
          nameParts.join(' ').trim() ||
          (typeof user.name === 'string' ? user.name.trim() : '') ||
          (typeof user.display_name === 'string' ? user.display_name.trim() : '')

        if (typeof user.email === 'string' && user.email.trim()) {
          data.ownerEmail = user.email.trim()
        }
        if (derivedName) {
          data.ownerName = derivedName
          data.ownerDisplayName = derivedName
        } else if (data.ownerEmail) {
          data.ownerName = data.ownerName || data.ownerEmail
          data.ownerDisplayName = data.ownerDisplayName || data.ownerEmail
        }
        if (typeof user.id === 'string' && user.id.trim()) {
          data.userId = user.id.trim()
        }
      }
    }

    let result
    if (currentPlatform === 'claude') {
      result = await accountsStore.createClaudeAccount(data)
    } else if (currentPlatform === 'gemini') {
      result = await accountsStore.createGeminiAccount(data)
    } else if (currentPlatform === 'openai') {
      result = await accountsStore.createOpenAIAccount(data)
    } else if (currentPlatform === 'droid') {
      result = await accountsStore.createDroidAccount(data)
    } else {
      result = await accountsStore.createGeminiAccount(data)
    }

    emit('success', result)
  } catch (error) {
    // 显示详细ErrorInformación
    const errorMessage = error.response?.data?.error || error.message || 'CuentaError al crear'
    const suggestion = error.response?.data?.suggestion || ''
    const errorDetails = error.response?.data?.errorDetails || null

    // 构建完整ErrorSugerencia
    let fullMessage = errorMessage
    if (suggestion) {
      fullMessage += `\n${suggestion}`
    }

    // 如果有详细 OAuth ErrorInformación，也显示出来
    if (errorDetails && errorDetails.error_description) {
      fullMessage += `\n详细Información: ${errorDetails.error_description}`
    } else if (errorDetails && errorDetails.error && errorDetails.error.message) {
      // 处理 OpenAI 格式Error
      fullMessage += `\n详细Información: ${errorDetails.error.message}`
    }

    showToast(fullMessage, 'error', '', 8000)

    // Error已通过 toast 显示给Usuario
  } finally {
    loading.value = false
  }
}

// CrearCuenta（手动模式）
const createAccount = async () => {
  // 清除之anteriorError
  errors.value.name = ''
  errors.value.accessToken = ''
  errors.value.refreshToken = ''
  errors.value.apiUrl = ''
  errors.value.apiKey = ''
  errors.value.apiKeys = ''

  let hasError = false

  if (!form.value.name || form.value.name.trim() === '') {
    errors.value.name = '请填写CuentaNombre'
    hasError = true
  }

  // Claude Console 验证
  if (form.value.platform === 'claude-console') {
    if (!form.value.apiUrl || form.value.apiUrl.trim() === '') {
      errors.value.apiUrl = '请填写 API URL'
      hasError = true
    }
    if (!form.value.apiKey || form.value.apiKey.trim() === '') {
      errors.value.apiKey = '请填写 API Key'
      hasError = true
    }
  }

  // CCR (Claude Code Router) 验证 - 使用与 Claude Console 相同字段
  if (form.value.platform === 'ccr') {
    if (!form.value.apiUrl || form.value.apiUrl.trim() === '') {
      errors.value.apiUrl = '请填写 API URL'
      hasError = true
    }
    if (!form.value.apiKey || form.value.apiKey.trim() === '') {
      errors.value.apiKey = '请填写 API Key'
      hasError = true
    }
  }

  // OpenAI-Responses 验证
  if (form.value.platform === 'openai-responses') {
    if (!form.value.baseApi || form.value.baseApi.trim() === '') {
      errors.value.baseApi = '请填写 API 基础地址'
      hasError = true
    }
    if (!form.value.apiKey || form.value.apiKey.trim() === '') {
      errors.value.apiKey = '请填写 API Clave'
      hasError = true
    }
  } else if (form.value.platform === 'bedrock') {
    // Bedrock 验证 - 根据凭证Tipo进行不同验证
    if (form.value.credentialType === 'access_key') {
      // Access Key 模式：Crear时必填，Editar时可选（留空则保持原有凭证）
      if (!isEdit.value) {
        if (!form.value.accessKeyId || form.value.accessKeyId.trim() === '') {
          errors.value.accessKeyId = '请填写 AWS Clave de acceso ID'
          hasError = true
        }
        if (!form.value.secretAccessKey || form.value.secretAccessKey.trim() === '') {
          errors.value.secretAccessKey = '请填写 AWS 秘密Clave de acceso'
          hasError = true
        }
      }
    } else if (form.value.credentialType === 'bearer_token') {
      // Bearer Token 模式：Crear时必填，Editar时可选（留空则保持原有凭证）
      if (!isEdit.value) {
        if (!form.value.bearerToken || form.value.bearerToken.trim() === '') {
          errors.value.bearerToken = '请填写 Bearer Token'
          hasError = true
        }
      }
    }
    if (!form.value.region || form.value.region.trim() === '') {
      errors.value.region = '请选择 AWS 区域'
      hasError = true
    }
  } else if (form.value.platform === 'azure_openai') {
    // Azure OpenAI 验证
    if (!form.value.azureEndpoint || form.value.azureEndpoint.trim() === '') {
      errors.value.azureEndpoint = '请填写 Azure Endpoint'
      hasError = true
    }
    if (!form.value.deploymentName || form.value.deploymentName.trim() === '') {
      errors.value.deploymentName = '请填写部署Nombre'
      hasError = true
    }
    if (!form.value.apiKey || form.value.apiKey.trim() === '') {
      errors.value.apiKey = '请填写 API Key'
      hasError = true
    }
  } else if (form.value.addType === 'manual') {
    // 手动模式验证 - 只有部分Plataforma需要验证 Token
    if (form.value.platform === 'openai') {
      // OpenAI Plataforma必须有 Refresh Token
      if (!form.value.refreshToken || form.value.refreshToken.trim() === '') {
        errors.value.refreshToken = '请填写 Refresh Token'
        hasError = true
      }
      // Access Token 可选，如果没有会通过 Refresh Token 获取
    } else if (form.value.platform === 'gemini') {
      // Gemini Plataforma需要 Access Token
      if (!form.value.accessToken || form.value.accessToken.trim() === '') {
        errors.value.accessToken = '请填写 Access Token'
        hasError = true
      }
    } else if (form.value.platform === 'droid') {
      if (!form.value.accessToken || form.value.accessToken.trim() === '') {
        errors.value.accessToken = '请填写 Access Token'
        hasError = true
      }
      if (!form.value.refreshToken || form.value.refreshToken.trim() === '') {
        errors.value.refreshToken = '请填写 Refresh Token'
        hasError = true
      }
    } else if (form.value.platform === 'claude') {
      // Claude Plataforma需要 Access Token
      if (!form.value.accessToken || form.value.accessToken.trim() === '') {
        errors.value.accessToken = '请填写 Access Token'
        hasError = true
      }
    }
    // Claude Console、CCR、OpenAI-Responses 等OtroPlataforma不需要 Token 验证
  } else if (form.value.addType === 'apikey') {
    // Gemini API 使用单  apiKey 字段
    if (form.value.platform === 'gemini-api') {
      if (!form.value.apiKey || form.value.apiKey.trim() === '') {
        errors.value.apiKey = '请填写 API Key'
        hasError = true
      }
    } else {
      // OtroPlataforma（如 Droid）使用多 API Key Entrada
      const apiKeys = parseApiKeysInput(form.value.apiKeysInput)
      if (apiKeys.length === 0) {
        errors.value.apiKeys = '请a少填写一  API Key'
        hasError = true
      }
    }
  }

  // 分组Tipo验证 - CrearCuenta流程修复
  if (
    form.value.accountType === 'group' &&
    (!form.value.groupIds || form.value.groupIds.length === 0)
  ) {
    showToast('请选择一 分组', 'error')
    hasError = true
  }

  // 数据同步：确保 groupId y groupIds 保持一致 - Crear流程
  if (form.value.accountType === 'group') {
    if (form.value.groupIds && form.value.groupIds.length > 0) {
      form.value.groupId = form.value.groupIds[0]
    } else {
      form.value.groupId = ''
    }
  }

  if (hasError) {
    return
  }

  loading.value = true
  try {
    const proxyPayload = buildProxyPayload(form.value.proxy)

    const data = {
      name: form.value.name,
      description: form.value.description,
      accountType: form.value.accountType,
      groupId: form.value.accountType === 'group' ? form.value.groupId : undefined,
      groupIds: form.value.accountType === 'group' ? form.value.groupIds : undefined,
      expiresAt: form.value.expiresAt || undefined,
      proxy: proxyPayload
    }

    if (form.value.platform === 'claude') {
      // Claude手动模式需要构建claudeAiOauth对象
      const expiresInMs = form.value.refreshToken
        ? 10 * 60 * 1000 // 10分钟
        : 365 * 24 * 60 * 60 * 1000 // 1年

      // 手动模式也需要确保生成客户端ID
      if (form.value.useUnifiedClientId && !form.value.unifiedClientId) {
        form.value.unifiedClientId = generateClientId()
      }

      data.claudeAiOauth = {
        accessToken: form.value.accessToken,
        refreshToken: form.value.refreshToken || '',
        expiresAt: Date.now() + expiresInMs,
        scopes: [] // 手动添加没有 scopes
      }
      data.priority = form.value.priority || 50
      data.autoStopOnWarning = form.value.autoStopOnWarning || false
      data.useUnifiedUserAgent = form.value.useUnifiedUserAgent || false
      data.useUnifiedClientId = form.value.useUnifiedClientId || false
      data.unifiedClientId = form.value.unifiedClientId || ''
      // 添加订阅TipoInformación
      data.subscriptionInfo = {
        accountType: form.value.subscriptionType || 'claude_max',
        hasClaudeMax: form.value.subscriptionType === 'claude_max',
        hasClaudePro: form.value.subscriptionType === 'claude_pro',
        manuallySet: true // 标记para手动Configuración
      }
    } else if (form.value.platform === 'gemini') {
      // Gemini手动模式需要构建geminiOauth对象
      const expiresInMs = form.value.refreshToken
        ? 10 * 60 * 1000 // 10分钟
        : 365 * 24 * 60 * 60 * 1000 // 1年

      data.geminiOauth = {
        access_token: form.value.accessToken,
        refresh_token: form.value.refreshToken || '',
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        token_type: 'Bearer',
        expiry_date: Date.now() + expiresInMs
      }

      if (form.value.projectId) {
        data.projectId = form.value.projectId
      }

      // 添加 Gemini 优先级
      data.priority = form.value.priority || 50
    } else if (form.value.platform === 'openai') {
      // OpenAI手动模式需要构建openaiOauth对象
      const expiresInMs = form.value.refreshToken
        ? 10 * 60 * 1000 // 10分钟
        : 365 * 24 * 60 * 60 * 1000 // 1年

      data.openaiOauth = {
        idToken: '', // 不再需要UsuarioEntrada，系统会自动获取
        accessToken: form.value.accessToken || '', // Access Token 可选
        refreshToken: form.value.refreshToken, // Refresh Token 必填
        expires_in: Math.floor(expiresInMs / 1000) // 转换para秒
      }

      // CuentaInformación将en首vecesActualizar时自动获取
      data.accountInfo = {
        accountId: '',
        chatgptUserId: '',
        organizationId: '',
        organizationRole: '',
        organizationTitle: '',
        planType: '',
        email: '',
        emailVerified: false
      }

      // OpenAI 手动模式必须Actualizar以获取完整Información（包括 ID Token）
      data.needsImmediateRefresh = true
      data.requireRefreshSuccess = true // 必须ActualizarExitoso才能CrearCuenta
      data.priority = form.value.priority || 50
    } else if (form.value.platform === 'droid') {
      data.priority = form.value.priority || 50
      data.endpointType = form.value.endpointType || 'anthropic'
      data.platform = 'droid'

      if (form.value.addType === 'apikey') {
        const apiKeys = parseApiKeysInput(form.value.apiKeysInput)
        data.apiKeys = apiKeys
        data.authenticationMethod = 'api_key'
        data.isActive = true
        data.schedulable = true
      } else {
        const accessToken = form.value.accessToken?.trim() || ''
        const refreshToken = form.value.refreshToken?.trim() || ''
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

        data.accessToken = accessToken
        data.refreshToken = refreshToken
        data.expiresAt = expiresAt
        data.expiresIn = 8 * 60 * 60
        data.tokenType = 'Bearer'
        data.authenticationMethod = 'manual'
      }
    } else if (form.value.platform === 'claude-console' || form.value.platform === 'ccr') {
      // Claude Console y CCR Cuenta特定数据（CCR 使用 Claude Console siguiente端逻辑）
      data.apiUrl = form.value.apiUrl
      data.apiKey = form.value.apiKey
      data.priority = form.value.priority || 50
      data.supportedModels = convertMappingsToObject() || {}
      data.userAgent = form.value.userAgent || null
      // 如果不Habilitar限流，传递 0 表示不限流
      data.rateLimitDuration = form.value.enableRateLimit ? form.value.rateLimitDuration || 60 : 0
      // 额度管理字段
      data.dailyQuota = form.value.dailyQuota || 0
      data.quotaResetTime = form.value.quotaResetTime || '00:00'
      // 并发控制字段
      data.maxConcurrentTasks = form.value.maxConcurrentTasks || 0
    } else if (form.value.platform === 'openai-responses') {
      // OpenAI-Responses Cuenta特定数据
      data.baseApi = form.value.baseApi
      data.apiKey = form.value.apiKey
      data.userAgent = form.value.userAgent || ''
      data.priority = form.value.priority || 50
      data.rateLimitDuration = 60 // 默认值60，不deUsuarioEntrada获取
      data.dailyQuota = form.value.dailyQuota || 0
      data.quotaResetTime = form.value.quotaResetTime || '00:00'
    } else if (form.value.platform === 'gemini-antigravity') {
      // Antigravity OAuth - set oauthProvider, submission happens below
      data.oauthProvider = 'antigravity'
      data.priority = form.value.priority || 50
    } else if (form.value.platform === 'gemini-api') {
      // Gemini API Cuenta特定数据
      data.baseUrl = form.value.baseUrl || 'https://generativelanguage.googleapis.com'
      data.apiKey = form.value.apiKey
      data.priority = form.value.priority || 50
      data.supportedModels = Array.isArray(form.value.supportedModels)
        ? form.value.supportedModels
        : []
    } else if (form.value.platform === 'bedrock') {
      // Bedrock Cuenta特定数据
      data.credentialType = form.value.credentialType || 'access_key'

      // 根据凭证Tipo构造不同凭证对象
      if (form.value.credentialType === 'access_key') {
        data.awsCredentials = {
          accessKeyId: form.value.accessKeyId,
          secretAccessKey: form.value.secretAccessKey,
          sessionToken: form.value.sessionToken || null
        }
      } else if (form.value.credentialType === 'bearer_token') {
        // Bearer Token 模式：必须传递 Bearer Token
        data.bearerToken = form.value.bearerToken
      }

      data.region = form.value.region
      data.defaultModel = form.value.defaultModel || null
      data.smallFastModel = form.value.smallFastModel || null
      data.priority = form.value.priority || 50
      // 如果不Habilitar限流，传递 0 表示不限流
      data.rateLimitDuration = form.value.enableRateLimit ? form.value.rateLimitDuration || 60 : 0
    } else if (form.value.platform === 'azure_openai') {
      // Azure OpenAI Cuenta特定数据
      data.azureEndpoint = form.value.azureEndpoint
      data.apiKey = form.value.apiKey
      data.apiVersion = form.value.apiVersion || '2024-02-01'
      data.deploymentName = form.value.deploymentName
      data.supportedModels = Array.isArray(form.value.supportedModels)
        ? form.value.supportedModels
        : []
      data.priority = form.value.priority || 50
      data.isActive = form.value.isActive !== false
      data.schedulable = form.value.schedulable !== false
    }

    let result
    if (form.value.platform === 'claude') {
      result = await accountsStore.createClaudeAccount(data)
    } else if (form.value.platform === 'claude-console' || form.value.platform === 'ccr') {
      // CCR 使用 Claude Console siguiente端 API
      result = await accountsStore.createClaudeConsoleAccount(data)
    } else if (form.value.platform === 'droid') {
      result = await accountsStore.createDroidAccount(data)
    } else if (form.value.platform === 'openai-responses') {
      result = await accountsStore.createOpenAIResponsesAccount(data)
    } else if (form.value.platform === 'bedrock') {
      result = await accountsStore.createBedrockAccount(data)
    } else if (form.value.platform === 'openai') {
      result = await accountsStore.createOpenAIAccount(data)
    } else if (form.value.platform === 'azure_openai') {
      result = await accountsStore.createAzureOpenAIAccount(data)
    } else if (form.value.platform === 'gemini' || form.value.platform === 'gemini-antigravity') {
      result = await accountsStore.createGeminiAccount(data)
    } else if (form.value.platform === 'gemini-api') {
      result = await accountsStore.createGeminiApiAccount(data)
    } else {
      throw new Error(`不支持Plataforma: ${form.value.platform}`)
    }

    emit('success', result)
  } catch (error) {
    // 显示详细ErrorInformación
    const errorMessage = error.response?.data?.error || error.message || 'CuentaError al crear'
    const suggestion = error.response?.data?.suggestion || ''
    const errorDetails = error.response?.data?.errorDetails || null

    // 构建完整ErrorSugerencia
    let fullMessage = errorMessage
    if (suggestion) {
      fullMessage += `\n${suggestion}`
    }

    // 如果有详细 OAuth ErrorInformación，也显示出来
    if (errorDetails && errorDetails.error_description) {
      fullMessage += `\n详细Información: ${errorDetails.error_description}`
    } else if (errorDetails && errorDetails.error && errorDetails.error.message) {
      // 处理 OpenAI 格式Error
      fullMessage += `\n详细Información: ${errorDetails.error.message}`
    }

    showToast(fullMessage, 'error', '', 8000)

    // Error已通过 toast 显示给Usuario
  } finally {
    loading.value = false
  }
}

// ActualizarCuenta
const updateAccount = async () => {
  // 清除之anteriorError
  errors.value.name = ''
  errors.value.apiKeys = ''

  // 验证CuentaNombre
  if (!form.value.name || form.value.name.trim() === '') {
    errors.value.name = '请填写CuentaNombre'
    return
  }

  // 分组Tipo验证 - ActualizarCuenta流程修复
  if (
    form.value.accountType === 'group' &&
    (!form.value.groupIds || form.value.groupIds.length === 0)
  ) {
    showToast('请选择一 分组', 'error')
    return
  }

  // 数据同步：确保 groupId y groupIds 保持一致 - Actualizar流程
  if (form.value.accountType === 'group') {
    if (form.value.groupIds && form.value.groupIds.length > 0) {
      form.value.groupId = form.value.groupIds[0]
    } else {
      form.value.groupId = ''
    }
  }

  // 对于GeminiCuenta，检查项目 ID
  if (form.value.platform === 'gemini') {
    if (!form.value.projectId || form.value.projectId.trim() === '') {
      // 使用自定义Confirmar弹窗
      const confirmed = await showConfirm(
        '项目 ID 未填写',
        '您尚未填写项目 ID。\n\n如果您Google账号绑定Google Cloudo被识别paraWorkspace账号，需要提供项目 ID。\n如果您使用是普通 人账号，可以继续不填写。',
        '继续Guardar',
        '返回填写'
      )
      if (!confirmed) {
        return
      }
    }
  }

  loading.value = true
  try {
    const proxyPayload = buildProxyPayload(form.value.proxy)

    const data = {
      name: form.value.name,
      description: form.value.description,
      accountType: form.value.accountType,
      groupId: form.value.accountType === 'group' ? form.value.groupId : undefined,
      groupIds: form.value.accountType === 'group' ? form.value.groupIds : undefined,
      expiresAt: form.value.expiresAt || undefined,
      proxy: proxyPayload
    }

    // 只有非空时才Actualizartoken
    if (form.value.accessToken || form.value.refreshToken) {
      const trimmedAccessToken = form.value.accessToken?.trim() || ''
      const trimmedRefreshToken = form.value.refreshToken?.trim() || ''

      if (props.account.platform === 'claude') {
        // Claude需要构建claudeAiOauth对象
        const expiresInMs = form.value.refreshToken
          ? 10 * 60 * 1000 // 10分钟
          : 365 * 24 * 60 * 60 * 1000 // 1年

        data.claudeAiOauth = {
          accessToken: trimmedAccessToken || '',
          refreshToken: trimmedRefreshToken || '',
          expiresAt: Date.now() + expiresInMs,
          scopes: props.account.scopes || [] // 保持原有 scopes，如果没有则para空数组
        }
      } else if (props.account.platform === 'gemini') {
        // Gemini需要构建geminiOauth对象
        const expiresInMs = form.value.refreshToken
          ? 10 * 60 * 1000 // 10分钟
          : 365 * 24 * 60 * 60 * 1000 // 1年

        data.geminiOauth = {
          access_token: trimmedAccessToken || '',
          refresh_token: trimmedRefreshToken || '',
          scope: 'https://www.googleapis.com/auth/cloud-platform',
          token_type: 'Bearer',
          expiry_date: Date.now() + expiresInMs
        }
      } else if (props.account.platform === 'openai') {
        // OpenAI需要构建openaiOauth对象
        const expiresInMs = form.value.refreshToken
          ? 10 * 60 * 1000 // 10分钟
          : 365 * 24 * 60 * 60 * 1000 // 1年

        data.openaiOauth = {
          idToken: '', // 不需要UsuarioEntrada
          accessToken: trimmedAccessToken || '',
          refreshToken: trimmedRefreshToken || '',
          expires_in: Math.floor(expiresInMs / 1000) // 转换para秒
        }

        // Editar OpenAI Cuenta时，如果Actualizar Refresh Token，也需要验证
        if (trimmedRefreshToken && trimmedRefreshToken !== props.account.refreshToken) {
          data.needsImmediateRefresh = true
          data.requireRefreshSuccess = true
        }
      } else if (props.account.platform === 'droid') {
        if (trimmedAccessToken) {
          data.accessToken = trimmedAccessToken
        }
        if (trimmedRefreshToken) {
          data.refreshToken = trimmedRefreshToken
        }
      }
    }

    if (props.account.platform === 'droid') {
      const trimmedApiKeysInput = form.value.apiKeysInput?.trim() || ''
      const apiKeyUpdateMode = form.value.apiKeyUpdateMode || 'append'

      if (apiKeyUpdateMode === 'delete') {
        if (!trimmedApiKeysInput) {
          errors.value.apiKeys = '请填写需要Eliminar API Key'
          loading.value = false
          return
        }

        const removeApiKeys = parseApiKeysInput(trimmedApiKeysInput)
        if (removeApiKeys.length === 0) {
          errors.value.apiKeys = '请填写需要Eliminar API Key'
          loading.value = false
          return
        }

        data.removeApiKeys = removeApiKeys
        data.apiKeyUpdateMode = 'delete'
      } else {
        if (trimmedApiKeysInput) {
          const apiKeys = parseApiKeysInput(trimmedApiKeysInput)
          if (apiKeys.length === 0) {
            errors.value.apiKeys = '请a少填写一  API Key'
            loading.value = false
            return
          }
          data.apiKeys = apiKeys
        } else if (apiKeyUpdateMode === 'replace') {
          data.apiKeys = []
        }

        if (apiKeyUpdateMode !== 'append' || trimmedApiKeysInput) {
          data.apiKeyUpdateMode = apiKeyUpdateMode
        }
      }

      if (isEditingDroidApiKey.value) {
        data.authenticationMethod = 'api_key'
      }
    }

    if (props.account.platform === 'gemini') {
      data.projectId = form.value.projectId || ''
    }

    if (props.account.platform === 'droid') {
      data.priority = form.value.priority || 50
      data.endpointType = form.value.endpointType || 'anthropic'
    }

    // Claude 官方账号优先级y订阅TipoActualizar
    if (props.account.platform === 'claude') {
      // Actualizar模式也需要确保生成客户端ID
      if (form.value.useUnifiedClientId && !form.value.unifiedClientId) {
        form.value.unifiedClientId = generateClientId()
      }

      data.priority = form.value.priority || 50
      data.autoStopOnWarning = form.value.autoStopOnWarning || false
      data.useUnifiedUserAgent = form.value.useUnifiedUserAgent || false
      data.useUnifiedClientId = form.value.useUnifiedClientId || false
      data.unifiedClientId = form.value.unifiedClientId || ''
      // Actualizar订阅TipoInformación
      data.subscriptionInfo = {
        accountType: form.value.subscriptionType || 'claude_max',
        hasClaudeMax: form.value.subscriptionType === 'claude_max',
        hasClaudePro: form.value.subscriptionType === 'claude_pro',
        manuallySet: true // 标记para手动Configuración
      }
    }

    // OpenAI 账号优先级Actualizar
    if (props.account.platform === 'openai') {
      data.priority = form.value.priority || 50
    }

    // Gemini 账号优先级Actualizar
    if (props.account.platform === 'gemini') {
      data.priority = form.value.priority || 50
    }

    // Claude Console 特定Actualizar
    if (props.account.platform === 'claude-console') {
      data.apiUrl = form.value.apiUrl
      if (form.value.apiKey) {
        data.apiKey = form.value.apiKey
      }
      data.priority = form.value.priority || 50
      data.supportedModels = convertMappingsToObject() || {}
      data.userAgent = form.value.userAgent || null
      // 如果不Habilitar限流，传递 0 表示不限流
      data.rateLimitDuration = form.value.enableRateLimit ? form.value.rateLimitDuration || 60 : 0
      // 额度管理字段
      data.dailyQuota = form.value.dailyQuota || 0
      data.quotaResetTime = form.value.quotaResetTime || '00:00'
      // 并发控制字段
      data.maxConcurrentTasks = form.value.maxConcurrentTasks || 0
    }

    // OpenAI-Responses 特定Actualizar
    if (props.account.platform === 'openai-responses') {
      data.baseApi = form.value.baseApi
      if (form.value.apiKey) {
        data.apiKey = form.value.apiKey
      }
      data.userAgent = form.value.userAgent || ''
      data.priority = form.value.priority || 50
      // Editar时不Subir rateLimitDuration，保持原值
      data.dailyQuota = form.value.dailyQuota || 0
      data.quotaResetTime = form.value.quotaResetTime || '00:00'
    }

    // Bedrock 特定Actualizar
    if (props.account.platform === 'bedrock') {
      // Actualizar凭证Tipo
      if (form.value.credentialType) {
        data.credentialType = form.value.credentialType
      }

      // 根据凭证TipoActualizar凭证
      if (form.value.credentialType === 'access_key') {
        // 只有当有凭证变更时才构造 awsCredentials 对象
        if (form.value.accessKeyId || form.value.secretAccessKey || form.value.sessionToken) {
          data.awsCredentials = {}
          if (form.value.accessKeyId) {
            data.awsCredentials.accessKeyId = form.value.accessKeyId
          }
          if (form.value.secretAccessKey) {
            data.awsCredentials.secretAccessKey = form.value.secretAccessKey
          }
          if (form.value.sessionToken !== undefined) {
            data.awsCredentials.sessionToken = form.value.sessionToken || null
          }
        }
      } else if (form.value.credentialType === 'bearer_token') {
        // Bearer Token 模式：Actualizar Bearer Token（Editar时可选，留空则保留原有凭证）
        if (form.value.bearerToken && form.value.bearerToken.trim()) {
          data.bearerToken = form.value.bearerToken
        }
      }

      if (form.value.region) {
        data.region = form.value.region
      }
      // Modelo配置（支持Configuraciónpara空来使用系统默认）
      data.defaultModel = form.value.defaultModel || null
      data.smallFastModel = form.value.smallFastModel || null
      data.priority = form.value.priority || 50
      // 如果不Habilitar限流，传递 0 表示不限流
      data.rateLimitDuration = form.value.enableRateLimit ? form.value.rateLimitDuration || 60 : 0
    }

    // Azure OpenAI 特定Actualizar
    if (props.account.platform === 'azure_openai') {
      data.azureEndpoint = form.value.azureEndpoint
      data.apiVersion = form.value.apiVersion || '2024-02-01'
      data.deploymentName = form.value.deploymentName
      data.supportedModels = Array.isArray(form.value.supportedModels)
        ? form.value.supportedModels
        : []
      data.priority = form.value.priority || 50
      // 只有当有新 API Key 时才Actualizar
      if (form.value.apiKey && form.value.apiKey.trim()) {
        data.apiKey = form.value.apiKey
      }
    }

    // Gemini API 特定Actualizar
    if (props.account.platform === 'gemini-api') {
      data.baseUrl = form.value.baseUrl || 'https://generativelanguage.googleapis.com'
      // 只有当有新 API Key 时才Actualizar
      if (form.value.apiKey && form.value.apiKey.trim()) {
        data.apiKey = form.value.apiKey
      }
      data.priority = form.value.priority || 50
      data.supportedModels = Array.isArray(form.value.supportedModels)
        ? form.value.supportedModels
        : []
    }

    if (props.account.platform === 'claude') {
      await accountsStore.updateClaudeAccount(props.account.id, data)
    } else if (props.account.platform === 'claude-console') {
      await accountsStore.updateClaudeConsoleAccount(props.account.id, data)
    } else if (props.account.platform === 'openai-responses') {
      await accountsStore.updateOpenAIResponsesAccount(props.account.id, data)
    } else if (props.account.platform === 'bedrock') {
      await accountsStore.updateBedrockAccount(props.account.id, data)
    } else if (props.account.platform === 'openai') {
      await accountsStore.updateOpenAIAccount(props.account.id, data)
    } else if (props.account.platform === 'azure_openai') {
      await accountsStore.updateAzureOpenAIAccount(props.account.id, data)
    } else if (props.account.platform === 'gemini') {
      await accountsStore.updateGeminiAccount(props.account.id, data)
    } else if (props.account.platform === 'gemini-api') {
      await accountsStore.updateGeminiApiAccount(props.account.id, data)
    } else if (props.account.platform === 'droid') {
      await accountsStore.updateDroidAccount(props.account.id, data)
    } else {
      throw new Error(`不支持Plataforma: ${props.account.platform}`)
    }

    emit('success')
  } catch (error) {
    // 显示详细ErrorInformación
    const errorMessage = error.response?.data?.error || error.message || 'CuentaError al actualizar'
    const suggestion = error.response?.data?.suggestion || ''
    const errorDetails = error.response?.data?.errorDetails || null

    // 构建完整ErrorSugerencia
    let fullMessage = errorMessage
    if (suggestion) {
      fullMessage += `\n${suggestion}`
    }

    // 如果有详细 OAuth ErrorInformación，也显示出来
    if (errorDetails && errorDetails.error_description) {
      fullMessage += `\n详细Información: ${errorDetails.error_description}`
    } else if (errorDetails && errorDetails.error && errorDetails.error.message) {
      // 处理 OpenAI 格式Error
      fullMessage += `\n详细Información: ${errorDetails.error.message}`
    }

    showToast(fullMessage, 'error', '', 8000)

    // Error已通过 toast 显示给Usuario
  } finally {
    loading.value = false
  }
}

// 监听表单Nombre变化，清除Error
watch(
  () => form.value.name,
  () => {
    if (errors.value.name && form.value.name?.trim()) {
      errors.value.name = ''
    }
  }
)

// 监听Access Token变化，清除Error
watch(
  () => form.value.accessToken,
  () => {
    if (errors.value.accessToken && form.value.accessToken?.trim()) {
      errors.value.accessToken = ''
    }
  }
)

// 监听Refresh Token变化，清除Error
watch(
  () => form.value.refreshToken,
  () => {
    if (errors.value.refreshToken && form.value.refreshToken?.trim()) {
      errors.value.refreshToken = ''
    }
  }
)

// 监听API URL变化，清除Error
watch(
  () => form.value.apiUrl,
  () => {
    if (errors.value.apiUrl && form.value.apiUrl?.trim()) {
      errors.value.apiUrl = ''
    }
  }
)

// 监听API Key变化，清除Error
watch(
  () => form.value.apiKey,
  () => {
    if (errors.value.apiKey && form.value.apiKey?.trim()) {
      errors.value.apiKey = ''
    }
  }
)

// 监听Azure Endpoint变化，清除Error
watch(
  () => form.value.azureEndpoint,
  () => {
    if (errors.value.azureEndpoint && form.value.azureEndpoint?.trim()) {
      errors.value.azureEndpoint = ''
    }
  }
)

// 监听Deployment Name变化，清除Error
watch(
  () => form.value.deploymentName,
  () => {
    if (errors.value.deploymentName && form.value.deploymentName?.trim()) {
      errors.value.deploymentName = ''
    }
  }
)

// 分组相关数据
const groups = ref([])
const loadingGroups = ref(false)
const showGroupManagement = ref(false)

// 根据PlataformaFiltrar分组
const filteredGroups = computed(() => {
  let platformFilter = form.value.platform
  // Claude Console y CCR 使用 Claude 分组
  if (form.value.platform === 'claude-console' || form.value.platform === 'ccr') {
    platformFilter = 'claude'
  }
  // OpenAI-Responses 使用 OpenAI 分组
  else if (form.value.platform === 'openai-responses') {
    platformFilter = 'openai'
  }
  // Gemini-API 使用 Gemini 分组
  else if (form.value.platform === 'gemini-api') {
    platformFilter = 'gemini'
  }
  return groups.value.filter((g) => g.platform === platformFilter)
})

// 加载分组列表
const loadGroups = async () => {
  loadingGroups.value = true
  try {
    const response = await httpApis.getAccountGroupsApi()
    groups.value = response.data || []
  } catch (error) {
    showToast('加载分组列表Fallido', 'error')
    groups.value = []
  } finally {
    loadingGroups.value = false
  }
}

// Actualizar分组列表
const refreshGroups = async () => {
  await loadGroups()
  showToast('分组列表已Actualizar', 'success')
}

// 处理新建分组
const handleNewGroup = () => {
  showGroupManagement.value = true
}

// 处理分组管理模态框Actualizar
const handleGroupRefresh = async () => {
  await loadGroups()
}

// 处理 API Key 管理模态框Actualizar
const handleApiKeyRefresh = async () => {
  // ActualizarCuentaInformación以Actualizar API Key 数量
  if (!props.account?.id) {
    return
  }

  const refreshers = [
    typeof accountsStore.fetchDroidAccounts === 'function'
      ? accountsStore.fetchDroidAccounts
      : null,
    typeof accountsStore.fetchAllAccounts === 'function' ? accountsStore.fetchAllAccounts : null
  ].filter(Boolean)

  for (const refresher of refreshers) {
    try {
      await refresher()
      return
    } catch (error) {
      console.error('ActualizarCuenta列表Fallido:', error)
    }
  }
}

// 监听Plataforma变化，Restablecer表单
watch(
  () => form.value.platform,
  (newPlatform) => {
    // 处理添加方式自动切换
    if (
      newPlatform === 'claude-console' ||
      newPlatform === 'ccr' ||
      newPlatform === 'bedrock' ||
      newPlatform === 'openai-responses'
    ) {
      form.value.addType = 'manual' // Claude Console、CCR、Bedrock y OpenAI-Responses 只支持手动模式
    } else if (newPlatform === 'claude') {
      // 切换到 Claude 时，使用 oauth 作para默认方式
      form.value.addType = 'oauth'
    } else if (newPlatform === 'gemini') {
      // 切换到 Gemini 时，使用 OAuth 作para默认方式
      form.value.addType = 'oauth'
    } else if (newPlatform === 'openai') {
      // 切换到 OpenAI 时，使用 OAuth 作para默认方式
      form.value.addType = 'oauth'
    } else if (newPlatform === 'gemini-api' || newPlatform === 'azure_openai') {
      // 切换到 Gemini API o Azure OpenAI 时，使用 apikey 模式（直接Crear，不需要 OAuth 流程）
      form.value.addType = 'apikey'
    }

    // Plataforma变化时，清空分组选择
    if (form.value.accountType === 'group') {
      form.value.groupId = ''
      form.value.groupIds = []
    }
  }
)

// 监听分组选择变化，保持 groupId y groupIds 同步
watch(
  () => form.value.groupIds,
  (newGroupIds) => {
    if (form.value.accountType === 'group') {
      if (newGroupIds && newGroupIds.length > 0) {
        // 如果有选en分组，使用primero作para主分组
        form.value.groupId = newGroupIds[0]
      } else {
        // 如果没有选en分组，清空主分组
        form.value.groupId = ''
      }
    }
  },
  { deep: true }
)

// 监听添加方式切换，确保字段Estado同步
watch(
  () => form.value.addType,
  (newType, oldType) => {
    if (newType === oldType) {
      return
    }

    if (newType === 'apikey') {
      // 切换到 API Key 模式时清理 Token 字段
      form.value.accessToken = ''
      form.value.refreshToken = ''
      errors.value.accessToken = ''
      errors.value.refreshToken = ''
      form.value.authenticationMethod = 'api_key'
      form.value.apiKeyUpdateMode = 'append'
    } else if (oldType === 'apikey') {
      // 切换离开 API Key 模式时Restablecer API Key Entrada
      form.value.apiKeysInput = ''
      form.value.apiKeyUpdateMode = 'append'
      errors.value.apiKeys = ''
      if (!isEdit.value) {
        form.value.authenticationMethod = ''
      }
    }
  }
)

// 监听 API Key Actualizar模式切换，自动清理Sugerencia
watch(
  () => form.value.apiKeyUpdateMode,
  (newMode, oldMode) => {
    if (newMode === oldMode) {
      return
    }

    if (errors.value.apiKeys) {
      errors.value.apiKeys = ''
    }
  }
)

// 监听 API Key Entrada，自动清理ErrorSugerencia
watch(
  () => form.value.apiKeysInput,
  (newValue) => {
    if (!errors.value.apiKeys) {
      return
    }

    const parsed = parseApiKeysInput(newValue)
    const mode = form.value.apiKeyUpdateMode

    if (mode === 'append' && parsed.length > 0) {
      errors.value.apiKeys = ''
      return
    }

    if (mode === 'replace') {
      if (parsed.length > 0 || !newValue || newValue.trim() === '') {
        errors.value.apiKeys = ''
      }
      return
    }

    if (mode === 'delete' && parsed.length > 0) {
      errors.value.apiKeys = ''
    }
  }
)

// 监听Setup Token授权码Entrada，自动提取URLencode参数
watch(setupTokenAuthCode, (newValue) => {
  if (!newValue || typeof newValue !== 'string') return

  const trimmedValue = newValue.trim()

  // 如果内容para空，不处理
  if (!trimmedValue) return

  // 检查是否是 URL 格式（包含 http:// o https://）
  const isUrl = trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')

  // 如果是 URL 格式
  if (isUrl) {
    // 检查是否是正确 localhost:45462 开头 URL
    if (trimmedValue.startsWith('http://localhost:45462')) {
      try {
        const url = new URL(trimmedValue)
        const code = url.searchParams.get('code')

        if (code) {
          // Exitoso提取授权码
          setupTokenAuthCode.value = code
          showToast('Exitoso提取授权码！', 'success')
          // Successfully extracted authorization code from URL
        } else {
          // URL en没有 code 参数
          showToast('URL en未找到授权码参数，请检查链接是否正确', 'error')
        }
      } catch (error) {
        // URL 解析Fallido
        // Failed to parse URL
        showToast('链接格式Error，请检查是否para完整 URL', 'error')
      }
    } else {
      // Error URL（不是 localhost:45462 开头）
      showToast('请Pegar以 http://localhost:45462 开头链接', 'error')
    }
  }
  // 如果不是 URL，保持原值（兼容直接Entrada授权码）
})

// 监听Plataforma变化
watch(
  () => form.value.platform,
  (newPlatform) => {
    // 当选择 CCR Plataforma时，通知父组件
    if (!isEdit.value) {
      emit('platform-changed', newPlatform)
    }
  }
)

// 监听CuentaTipo变化
watch(
  () => form.value.accountType,
  (newType) => {
    if (newType === 'group') {
      // 如果选择分组Tipo，加载分组列表
      if (groups.value.length === 0) {
        loadGroups()
      }
    }
  }
)

// 监听分组选择
watch(
  () => form.value.groupId,
  (newGroupId) => {
    if (newGroupId === '__new__') {
      // 触发Crear新分组
      form.value.groupId = ''
      showGroupManagement.value = true
    }
  }
)

// 添加Modelo映射
const addModelMapping = () => {
  modelMappings.value.push({ from: '', to: '' })
}

// 移除Modelo映射
const removeModelMapping = (index) => {
  modelMappings.value.splice(index, 1)
}

// 添加预设映射
const addPresetMapping = (from, to) => {
  // 检查是否已存en相同映射
  const exists = modelMappings.value.some((mapping) => mapping.from === from)
  if (exists) {
    showToast(`Modelo ${from} 映射已存en`, 'info')
    return
  }

  modelMappings.value.push({ from, to })
  showToast(`已添加映射: ${from} → ${to}`, 'success')
}

// 将Modelo映射表转换para对象格式（根据当anterior模式）
const convertMappingsToObject = () => {
  const mapping = {}

  if (modelRestrictionMode.value === 'whitelist') {
    // 白名单模式：将选enModelo映射到自己
    allowedModels.value.forEach((model) => {
      mapping[model] = model
    })
  } else {
    // 映射模式：使用手动配置映射表
    modelMappings.value.forEach((item) => {
      if (item.from && item.to) {
        mapping[item.from] = item.to
      }
    })
  }

  return Object.keys(mapping).length > 0 ? mapping : null
}

// 监听Cuenta变化，Actualizar表单
watch(
  () => props.account,
  (newAccount) => {
    if (newAccount) {
      initModelMappings()
      // 重新初始化代理配置
      const proxyConfig = normalizeProxyFormState(newAccount.proxy)
      const normalizedAuthMethod =
        typeof newAccount.authenticationMethod === 'string'
          ? newAccount.authenticationMethod.trim().toLowerCase()
          : ''
      const derivedAddType =
        normalizedAuthMethod === 'api_key'
          ? 'apikey'
          : normalizedAuthMethod === 'manual'
            ? 'manual'
            : 'oauth'

      // 获取分组ID - 可能来自 groupId 字段o groupInfo 对象
      let groupId = ''
      if (newAccount.accountType === 'group') {
        groupId = newAccount.groupId || (newAccount.groupInfo && newAccount.groupInfo.id) || ''
      }

      // 初始化订阅Tipo（de subscriptionInfo en提取，兼容旧数据默认para claude_max）
      let subscriptionType = 'claude_max'
      if (newAccount.subscriptionInfo) {
        const info =
          typeof newAccount.subscriptionInfo === 'string'
            ? JSON.parse(newAccount.subscriptionInfo)
            : newAccount.subscriptionInfo

        if (info.accountType) {
          subscriptionType = info.accountType
        } else if (info.hasClaudeMax) {
          subscriptionType = 'claude_max'
        } else if (info.hasClaudePro) {
          subscriptionType = 'claude_pro'
        } else {
          subscriptionType = 'claude_free'
        }
      }

      form.value = {
        platform: newAccount.platform,
        addType: derivedAddType,
        name: newAccount.name,
        description: newAccount.description || '',
        accountType: newAccount.accountType || 'shared',
        subscriptionType: subscriptionType,
        autoStopOnWarning: newAccount.autoStopOnWarning || false,
        useUnifiedUserAgent: newAccount.useUnifiedUserAgent || false,
        useUnifiedClientId: newAccount.useUnifiedClientId || false,
        unifiedClientId: newAccount.unifiedClientId || '',
        groupId: groupId,
        groupIds: [],
        projectId: newAccount.projectId || '',
        accessToken: '',
        refreshToken: '',
        authenticationMethod: newAccount.authenticationMethod || '',
        apiKeysInput: '',
        apiKeyUpdateMode: 'append',
        proxy: proxyConfig,
        // Claude Console 特定字段
        apiUrl: newAccount.apiUrl || '',
        apiKey: '', // Editar模式不显示现有 API Key
        priority: newAccount.priority || 50,
        supportedModels: (() => {
          const models = newAccount.supportedModels
          if (!models) return []
          // 处理对象格式（Claude Console 新格式）
          if (typeof models === 'object' && !Array.isArray(models)) {
            return Object.keys(models)
          }
          // 处理数组格式（向siguiente兼容）
          if (Array.isArray(models)) {
            return models
          }
          return []
        })(),
        userAgent: newAccount.userAgent || '',
        enableRateLimit:
          newAccount.rateLimitDuration && newAccount.rateLimitDuration > 0 ? true : false,
        rateLimitDuration: newAccount.rateLimitDuration || 60,
        // Bedrock 特定字段
        accessKeyId: '', // Editar模式不显示现有Clave de acceso
        secretAccessKey: '', // Editar模式不显示现有秘密Clave
        region: newAccount.region || '',
        sessionToken: '', // Editar模式不显示现有会话Token
        defaultModel: newAccount.defaultModel || '',
        smallFastModel: newAccount.smallFastModel || '',
        // Azure OpenAI 特定字段
        azureEndpoint: newAccount.azureEndpoint || '',
        apiVersion: newAccount.apiVersion || '',
        deploymentName: newAccount.deploymentName || '',
        // OpenAI-Responses 特定字段
        baseApi: newAccount.baseApi || '',
        // 额度管理字段
        dailyQuota: newAccount.dailyQuota || 0,
        dailyUsage: newAccount.dailyUsage || 0,
        quotaResetTime: newAccount.quotaResetTime || '00:00',
        // 并发控制字段
        maxConcurrentTasks: newAccount.maxConcurrentTasks || 0
      }

      // 如果是Claude ConsoleCuenta，加载实时使用情况
      if (newAccount.platform === 'claude-console') {
        loadAccountUsage()
      }

      // 如果是分组Tipo，加载分组ID
      if (newAccount.accountType === 'group') {
        // 先加载分组列表
        loadGroups().then(async () => {
          const foundGroupIds = []

          // 如果Cuenta有 groupInfo，直接使用它 groupId
          if (newAccount.groupInfo && newAccount.groupInfo.id) {
            form.value.groupId = newAccount.groupInfo.id
            foundGroupIds.push(newAccount.groupInfo.id)
          } else if (newAccount.groupId) {
            // 如果Cuenta有 groupId 字段，直接使用（OpenAI-Responses 等Cuenta）
            form.value.groupId = newAccount.groupId
            foundGroupIds.push(newAccount.groupId)
          } else if (
            newAccount.groupIds &&
            Array.isArray(newAccount.groupIds) &&
            newAccount.groupIds.length > 0
          ) {
            // 如果Cuenta有 groupIds 数组，使用它
            form.value.groupId = newAccount.groupIds[0]
            foundGroupIds.push(...newAccount.groupIds)
          } else {
            // 否则查找Cuenta所属分组
            const checkPromises = groups.value.map(async (group) => {
              try {
                const response = await httpApis.getAccountGroupMembersApi(group.id)
                const members = response.data || []
                if (members.some((m) => m.id === newAccount.id)) {
                  foundGroupIds.push(group.id)
                  if (!form.value.groupId) {
                    form.value.groupId = group.id // Configuraciónprimero找到分组作para主分组
                  }
                }
              } catch (error) {
                // 忽略Error
              }
            })

            await Promise.all(checkPromises)
          }

          // Configuración多选分组
          form.value.groupIds = foundGroupIds
        })
      }
    }
  },
  { immediate: true }
)

// 获取统一 User-Agent Información
const fetchUnifiedUserAgent = async () => {
  try {
    const response = await httpApis.getClaudeCodeVersionApi()
    if (response.success && response.userAgent) {
      unifiedUserAgent.value = response.userAgent
    } else {
      unifiedUserAgent.value = ''
    }
  } catch (error) {
    // Failed to fetch unified User-Agent
    unifiedUserAgent.value = ''
  }
}

// 清除统一 User-Agent Caché
const clearUnifiedCache = async () => {
  clearingCache.value = true
  try {
    const response = await httpApis.clearClaudeCodeVersionApi()
    if (response.success) {
      unifiedUserAgent.value = ''
      showToast('统一User-AgentCaché已清除', 'success')
    } else {
      showToast('清除CachéFallido', 'error')
    }
  } catch (error) {
    // Failed to clear unified User-Agent cache
    showToast('清除CachéFallido：' + (error.message || 'Error desconocido'), 'error')
  } finally {
    clearingCache.value = false
  }
}

// 生成客户端标识
const generateClientId = () => {
  // 生成64位十六进制字符串（32字节）
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// 重新生成客户端标识
const regenerateClientId = () => {
  form.value.unifiedClientId = generateClientId()
  showToast('已生成新客户端标识', 'success')
}

// 处理统一客户端标识复选框变化
const handleUnifiedClientIdChange = () => {
  if (form.value.useUnifiedClientId) {
    // 如果Habilitar统一客户端标识，自动Habilitar统一User-Agent
    form.value.useUnifiedUserAgent = true
    // 如果没有客户端标识，自动生成一 
    if (!form.value.unifiedClientId) {
      form.value.unifiedClientId = generateClientId()
    }
  }
}

// 到期时间相关方法
// 计算最小日期时间
const minDateTime = computed(() => {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 1)
  return now.toISOString().slice(0, 16)
})

// ActualizarCuenta过期时间
const updateAccountExpireAt = () => {
  if (!form.value.expireDuration) {
    form.value.expiresAt = null
    return
  }

  if (form.value.expireDuration === 'custom') {
    return
  }

  const now = new Date()
  const duration = form.value.expireDuration
  const match = duration.match(/(\d+)([d])/)

  if (match) {
    const [, value, unit] = match
    const num = parseInt(value)

    if (unit === 'd') {
      now.setDate(now.getDate() + num)
    }

    form.value.expiresAt = now.toISOString()
  }
}

// Actualizar自定义过期时间
const updateAccountCustomExpireAt = () => {
  if (form.value.customExpireDate) {
    form.value.expiresAt = new Date(form.value.customExpireDate).toISOString()
  }
}

// 格式化过期日期
const formatExpireDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 组件挂载时获取统一 User-Agent Información
onMounted(() => {
  // 初始化Plataforma分组
  platformGroup.value = determinePlatformGroup(form.value.platform)

  // 初始化Modelo映射表（如果是Editar模式）
  if (isEdit.value) {
    initModelMappings()
  }

  // 加载Modelo列表
  loadCommonModels()

  // 获取Claude Code统一User-AgentInformación
  fetchUnifiedUserAgent()
  // 如果是Editar模式且是Claude ConsoleCuenta，加载使用情况
  if (isEdit.value && props.account?.platform === 'claude-console') {
    loadAccountUsage()
  }
})

// 监听Plataforma变化，当切换到ClaudePlataforma时获取统一User-AgentInformación
watch(
  () => form.value.platform,
  (newPlatform) => {
    if (newPlatform === 'claude') {
      fetchUnifiedUserAgent()
    }
  }
)
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}
</style>
