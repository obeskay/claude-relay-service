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
              Editar API Key
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
          class="modal-scroll-content custom-scrollbar flex-1 space-y-4 sm:space-y-6"
          @submit.prevent="updateApiKey"
        >
          <div>
            <label
              class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300 sm:mb-3 sm:text-sm"
              >Nombre</label
            >
            <div>
              <input
                v-model="form.name"
                class="form-input flex-1 border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                maxlength="100"
                placeholder="IngreseAPI KeyNombre"
                required
                type="text"
              />
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 sm:mt-2">
              para识别此 API Key 用途
            </p>
          </div>

          <!-- 服务倍率Configuración -->
          <div
            class="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-3 dark:border-purple-700 dark:from-purple-900/20 dark:to-indigo-900/20 sm:p-4"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <input
                  id="editEnableServiceRates"
                  v-model="enableServiceRates"
                  class="h-4 w-4 rounded border-gray-300 bg-gray-100 text-purple-600 focus:ring-purple-500"
                  type="checkbox"
                />
                <label
                  class="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300"
                  for="editEnableServiceRates"
                >
                  自定义服务倍率
                </label>
              </div>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                与Global倍率相乘，para VIP 折扣等（如Global1.5 × Key倍率0.8 = 1.2）
              </span>
            </div>
            <div v-if="enableServiceRates" class="mt-3 space-y-2">
              <div
                v-for="service in availableServices"
                :key="service.key"
                class="flex items-center gap-2"
              >
                <span class="w-20 text-xs text-gray-600 dark:text-gray-400">{{
                  service.label
                }}</span>
                <input
                  v-model.number="form.serviceRates[service.key]"
                  class="form-input w-24 border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  min="0"
                  placeholder="1.0"
                  step="0.1"
                  type="number"
                />
                <span class="text-xs text-gray-400">默认 1.0</span>
              </div>
            </div>
          </div>

          <!-- 所有者选择 -->
          <div>
            <label
              class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300 sm:mb-3 sm:text-sm"
              >所有者</label
            >
            <select
              v-model="form.ownerId"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              <option v-for="user in availableUsers" :key="user.id" :value="user.id">
                {{ user.displayName }} ({{ user.username }})
                <span v-if="user.role === 'admin'" class="text-gray-500">- Administrador</span>
              </option>
            </select>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 sm:mt-2">
              分配此 API Key 给指定UsuariooAdministrador，Administrador分配时不受Usuario API Key 数量Límite
            </p>
          </div>

          <!-- Etiqueta -->
          <div>
            <label
              class="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300 sm:mb-3 sm:text-sm"
              >Etiqueta</label
            >
            <div class="space-y-4">
              <!-- 已选择Etiqueta -->
              <div v-if="form.tags.length > 0">
                <div class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                  已选择Etiqueta:
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

              <!-- 可选择已有Etiqueta -->
              <div v-if="unselectedTags.length > 0">
                <div class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                  点击选择已有Etiqueta:
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

              <!-- Crear新Etiqueta -->
              <div>
                <div class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                  Crear新Etiqueta:
                </div>
                <div class="flex gap-2">
                  <input
                    v-model="newTag"
                    class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    placeholder="Ingrese nombre de nueva etiqueta"
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
                para标记不同团队o用途，方便Filtrar管理
              </p>
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
              <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">
                速率LímiteConfiguración (可选)
              </h4>
            </div>

            <div class="space-y-2">
              <div class="grid grid-cols-1 gap-2 lg:grid-cols-3">
                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                    >时间窗口 (分钟)</label
                  >
                  <input
                    v-model="form.rateLimitWindow"
                    class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    min="1"
                    placeholder="无Límite"
                    type="number"
                  />
                  <p class="ml-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">时间段单位</p>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                    >Número de solicitudesLímite</label
                  >
                  <input
                    v-model="form.rateLimitRequests"
                    class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    min="1"
                    placeholder="无Límite"
                    type="number"
                  />
                  <p class="ml-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">窗口内最大Solicitud</p>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                    >CostoLimitar (美元)</label
                  >
                  <input
                    v-model="form.rateLimitCost"
                    class="form-input w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                    min="0"
                    placeholder="无Límite"
                    step="0.01"
                    type="number"
                  />
                  <p class="ml-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">窗口内最大Costo</p>
                </div>
              </div>

              <!-- 示例Instrucciones -->
              <div class="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <h5 class="mb-1 text-xs font-semibold text-blue-800 dark:text-blue-400">
                  💡 使用示例
                </h5>
                <div class="space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                  <div>
                    <strong>示例1:</strong> 时间窗口=60，Número de solicitudes=1000 → 每60分钟最多1000vecesSolicitud
                  </div>
                  <div><strong>示例2:</strong> 时间窗口=1，Costo=0.1 → 每分钟最多$0.1Costo</div>
                  <div>
                    <strong>示例3:</strong> 窗口=30，Solicitud=50，Costo=5 → 每30分钟50vecesSolicitud且不超$5Costo
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >Límite de costo diario (美元)</label
            >
            <div class="space-y-3">
              <div class="flex gap-2">
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.dailyCostLimit = '50'"
                >
                  $50
                </button>
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.dailyCostLimit = '100'"
                >
                  $100
                </button>
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.dailyCostLimit = '200'"
                >
                  $200
                </button>
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.dailyCostLimit = ''"
                >
                  自定义
                </button>
              </div>
              <input
                v-model="form.dailyCostLimit"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                min="0"
                placeholder="0 表示无Límite"
                step="0.01"
                type="number"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Configuración此 API Key 每日CostoLímite，超过Límite将拒绝Solicitud，0 o留空表示无Límite
              </p>
            </div>
          </div>

          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >Límite de costo total (美元)</label
            >
            <div class="space-y-3">
              <div class="flex gap-2">
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.totalCostLimit = '100'"
                >
                  $100
                </button>
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.totalCostLimit = '500'"
                >
                  $500
                </button>
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.totalCostLimit = '1000'"
                >
                  $1000
                </button>
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.totalCostLimit = ''"
                >
                  自定义
                </button>
              </div>
              <input
                v-model="form.totalCostLimit"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                min="0"
                placeholder="0 表示无Límite"
                step="0.01"
                type="number"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Configuración此 API Key 累计Límite de costo total，达到Límitesiguiente将拒绝所有siguiente续Solicitud，0 o留空表示无Límite
              </p>
            </div>
          </div>

          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >Límite de costo semanal de modelos Claude (美元)</label
            >
            <div class="space-y-3">
              <div class="flex gap-2">
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.weeklyOpusCostLimit = '100'"
                >
                  $100
                </button>
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.weeklyOpusCostLimit = '500'"
                >
                  $500
                </button>
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.weeklyOpusCostLimit = '1000'"
                >
                  $1000
                </button>
                <button
                  class="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  type="button"
                  @click="form.weeklyOpusCostLimit = ''"
                >
                  自定义
                </button>
              </div>
              <input
                v-model="form.weeklyOpusCostLimit"
                class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                min="0"
                placeholder="0 表示无Límite"
                step="0.01"
                type="number"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Configuración Claude Modelo周CostoLímite（周一到周日），仅对 Claude ModeloSolicitud生效，0
                o留空表示无Límite
              </p>
            </div>
          </div>

          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >Límite de concurrencia</label
            >
            <input
              v-model="form.concurrencyLimit"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              min="0"
              placeholder="0 表示无Límite"
              type="number"
            />
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Configuración此 API Key 可同时处理最大Solicitud数
            </p>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >强制Modelo路由 (可选)</label
            >
            <input
              v-model="form.forcedModel"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              placeholder="例如: ccr/glm-4.7"
              type="text"
            />
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Habilitarsiguiente，该 Key 所有Solicitud将强制路由到此Modelo，忽略客户端SolicitudModelo。
            </p>
          </div>

          <!-- 激活账号 -->
          <div>
            <div class="mb-3 flex items-center">
              <input
                id="editIsActive"
                v-model="form.isActive"
                class="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                type="checkbox"
              />
              <label
                class="ml-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300"
                for="editIsActive"
              >
                激活账号
              </label>
            </div>
            <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
              Cancelar勾选将Deshabilitar此 API Key，暂停所有Solicitud，客户端返回 401 Error
            </p>
          </div>

          <div>
            <label class="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-300"
              >服务权限</label
            >
            <div class="flex flex-wrap gap-4">
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.permissions"
                  class="mr-2 rounded text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                  value="claude"
                  @change="updatePermissions"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Claude</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.permissions"
                  class="mr-2 rounded text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                  value="gemini"
                  @change="updatePermissions"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Gemini</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.permissions"
                  class="mr-2 rounded text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                  value="openai"
                  @change="updatePermissions"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">OpenAI</span>
              </label>
              <label class="flex cursor-pointer items-center">
                <input
                  v-model="form.permissions"
                  class="mr-2 rounded text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  type="checkbox"
                  value="droid"
                  @change="updatePermissions"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Droid</span>
              </label>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              不选择任何服务表示允许访问Todos los servicios
            </p>
          </div>

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
                  v-model="form.claudeAccountId"
                  :accounts="localAccounts.claude"
                  default-option-text="使用共享账号池"
                  :disabled="form.permissions.length > 0 && !form.permissions.includes('claude')"
                  :groups="localAccounts.claudeGroups"
                  placeholder="请选择Claude账号"
                  platform="claude"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >Gemini 专属账号</label
                >
                <AccountSelector
                  v-model="form.geminiAccountId"
                  :accounts="localAccounts.gemini"
                  default-option-text="使用共享账号池"
                  :disabled="form.permissions.length > 0 && !form.permissions.includes('gemini')"
                  :groups="localAccounts.geminiGroups"
                  placeholder="请选择Gemini账号"
                  platform="gemini"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >OpenAI 专属账号</label
                >
                <AccountSelector
                  v-model="form.openaiAccountId"
                  :accounts="localAccounts.openai"
                  default-option-text="使用共享账号池"
                  :disabled="form.permissions.length > 0 && !form.permissions.includes('openai')"
                  :groups="localAccounts.openaiGroups"
                  placeholder="请选择OpenAI账号"
                  platform="openai"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >Bedrock 专属账号</label
                >
                <AccountSelector
                  v-model="form.bedrockAccountId"
                  :accounts="localAccounts.bedrock"
                  default-option-text="使用共享账号池"
                  :disabled="form.permissions.length > 0 && !form.permissions.includes('claude')"
                  :groups="[]"
                  placeholder="请选择Bedrock账号"
                  platform="bedrock"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >Droid 专属账号</label
                >
                <AccountSelector
                  v-model="form.droidAccountId"
                  :accounts="localAccounts.droid"
                  default-option-text="使用共享账号池"
                  :disabled="form.permissions.length > 0 && !form.permissions.includes('droid')"
                  :groups="localAccounts.droidGroups"
                  placeholder="请选择Droid账号"
                  platform="droid"
                />
              </div>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              修改绑定账号将影响此API KeySolicitud路由
            </p>
          </div>

          <div>
            <div class="mb-3 flex items-center">
              <input
                id="editEnableModelRestriction"
                v-model="form.enableModelRestriction"
                class="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                type="checkbox"
              />
              <label
                class="ml-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300"
                for="editEnableModelRestriction"
              >
                HabilitarLímite de modelos
              </label>
            </div>

            <div v-if="form.enableModelRestriction" class="space-y-3">
              <div>
                <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >LímiteModelo列表</label
                >
                <div
                  class="mb-3 flex min-h-[32px] flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
                >
                  <span
                    v-for="(model, index) in form.restrictedModels"
                    :key="index"
                    class="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  >
                    {{ model }}
                    <button
                      class="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      type="button"
                      @click="removeRestrictedModel(index)"
                    >
                      <i class="fas fa-times text-xs" />
                    </button>
                  </span>
                  <span
                    v-if="form.restrictedModels.length === 0"
                    class="text-sm text-gray-400 dark:text-gray-500"
                  >
                    SinLímiteModelo
                  </span>
                </div>
                <div class="space-y-3">
                  <!-- 快速添加按钮 -->
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="model in availableQuickModels"
                      :key="model"
                      class="flex-shrink-0 rounded-lg bg-gray-100 px-3 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 sm:text-sm"
                      type="button"
                      @click="quickAddRestrictedModel(model)"
                    >
                      {{ model }}
                    </button>
                    <span
                      v-if="availableQuickModels.length === 0"
                      class="text-sm italic text-gray-400 dark:text-gray-500"
                    >
                      所有常用Modelo已enLímite列表en
                    </span>
                  </div>

                  <!-- 手动Entrada -->
                  <div class="flex gap-2">
                    <input
                      v-model="form.modelInput"
                      class="form-input flex-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                      placeholder="EntradaNombre del modelo，按回车添加"
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
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Configuración此API Key无法访问Modelo，例如：claude-opus-4-20250514
                </p>
              </div>
            </div>
          </div>

          <!-- Límite de clientes -->
          <div>
            <div class="mb-3 flex items-center">
              <input
                id="editEnableClientRestriction"
                v-model="form.enableClientRestriction"
                class="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                type="checkbox"
              />
              <label
                class="ml-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300"
                for="editEnableClientRestriction"
              >
                HabilitarLímite de clientes
              </label>
            </div>

            <div v-if="form.enableClientRestriction" class="space-y-3">
              <div>
                <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-400"
                  >允许客户端</label
                >
                <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  勾选允许使用此API Key客户端
                </p>
                <div class="space-y-2">
                  <div v-for="client in supportedClients" :key="client.id" class="flex items-start">
                    <input
                      :id="`edit_client_${client.id}`"
                      v-model="form.allowedClients"
                      class="mt-0.5 h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500"
                      type="checkbox"
                      :value="client.id"
                    />
                    <label class="ml-2 flex-1 cursor-pointer" :for="`edit_client_${client.id}`">
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
              {{ loading ? 'Guardaren...' : 'Guardar修改' }}
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
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { showToast } from '@/utils/tools'
import { useClientsStore } from '@/stores/clients'
import { useApiKeysStore } from '@/stores/apiKeys'
import * as httpApis from '@/utils/http_apis'
import AccountSelector from '@/components/common/AccountSelector.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const props = defineProps({
  apiKey: {
    type: Object,
    required: true
  },
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
      droidGroups: [],
      openaiResponses: []
    })
  }
})

const emit = defineEmits(['close', 'success'])

// const authStore = useAuthStore()
const clientsStore = useClientsStore()
const apiKeysStore = useApiKeysStore()
const loading = ref(false)
const accountsLoading = ref(false)

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

// 支持客户端列表
const supportedClients = ref([])

// 可用Usuario列表
const availableUsers = ref([])

// Etiqueta相关
const newTag = ref('')
const availableTags = ref([])

// 计算未选择Etiqueta
const unselectedTags = computed(() => {
  return availableTags.value.filter((tag) => !form.tags.includes(tag))
})

// 服务倍率相关
const enableServiceRates = ref(false)
const availableServices = [
  { key: 'claude', label: 'Claude' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'codex', label: 'Codex' },
  { key: 'droid', label: 'Droid' },
  { key: 'bedrock', label: 'Bedrock' },
  { key: 'azure', label: 'Azure' },
  { key: 'ccr', label: 'CCR' }
]

// 表单数据
const form = reactive({
  name: '',
  serviceRates: {}, // API Key 级别服务倍率
  tokenLimit: '', // 保留para检测历史数据
  rateLimitWindow: '',
  rateLimitRequests: '',
  rateLimitCost: '', // Agregar：CostoLímite
  concurrencyLimit: '',
  dailyCostLimit: '',
  totalCostLimit: '',
  weeklyOpusCostLimit: '',
  forcedModel: '', // Agregar：强制路由Modelo
  permissions: [], // 数组格式，空数组表示Todos los servicios
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
  tags: [],
  isActive: true,
  ownerId: '' // Agregar：所有者ID
})

// Actualizar权限（数组格式，空数组=Todos los servicios）
const updatePermissions = () => {
  // form.permissions 已经是数组，由 v-model 自动管理
}

// 添加LímiteModelo
const addRestrictedModel = () => {
  if (form.modelInput && !form.restrictedModels.includes(form.modelInput)) {
    form.restrictedModels.push(form.modelInput)
    form.modelInput = ''
  }
}

// 移除LímiteModelo
const removeRestrictedModel = (index) => {
  form.restrictedModels.splice(index, 1)
}

// 常用Modelo列表
const commonModels = ref(['claude-opus-4-20250514', 'claude-opus-4-1-20250805'])

// 可用快捷Modelo（过滤掉已enLímite列表en）
const availableQuickModels = computed(() => {
  return commonModels.value.filter((model) => !form.restrictedModels.includes(model))
})

// 快速添加LímiteModelo
const quickAddRestrictedModel = (model) => {
  if (!form.restrictedModels.includes(model)) {
    form.restrictedModels.push(model)
  }
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

// Actualizar API Key
const updateApiKey = async () => {
  // 检查是否Configuración时间窗口但CostoLímitepara0
  if (form.rateLimitWindow && (!form.rateLimitCost || parseFloat(form.rateLimitCost) === 0)) {
    const confirmed = await showConfirm(
      'CostoLímite提醒',
      '您Configuración时间窗口但CostoLímitepara0，这意味着不会有CostoLímite。\n\n是否继续？',
      '继续Guardar',
      '返回修改',
      'warning'
    )
    if (!confirmed) {
      return
    }
  }

  loading.value = true

  try {
    // 准备Enviar数据
    // 过滤掉空值服务倍率
    const filteredServiceRates = {}
    if (enableServiceRates.value) {
      for (const [key, value] of Object.entries(form.serviceRates)) {
        if (value !== null && value !== undefined && value !== '') {
          filteredServiceRates[key] = value
        }
      }
    }

    const data = {
      name: form.name, // 添加Nombre字段
      serviceRates: filteredServiceRates,
      tokenLimit: 0, // 清除历史tokenLímite
      rateLimitWindow:
        form.rateLimitWindow !== '' && form.rateLimitWindow !== null
          ? parseInt(form.rateLimitWindow)
          : 0,
      rateLimitRequests:
        form.rateLimitRequests !== '' && form.rateLimitRequests !== null
          ? parseInt(form.rateLimitRequests)
          : 0,
      rateLimitCost:
        form.rateLimitCost !== '' && form.rateLimitCost !== null
          ? parseFloat(form.rateLimitCost)
          : 0,
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
      permissions: form.permissions,
      tags: form.tags
    }

    // 处理ClaudeCuenta绑定（区分OAuthyConsole）
    if (form.claudeAccountId) {
      if (form.claudeAccountId.startsWith('console:')) {
        // Claude ConsoleCuenta
        data.claudeConsoleAccountId = form.claudeAccountId.substring(8)
        data.claudeAccountId = null // 清空OAuth账号
      } else if (!form.claudeAccountId.startsWith('group:')) {
        // Claude OAuthCuenta（非分组）
        data.claudeAccountId = form.claudeAccountId
        data.claudeConsoleAccountId = null // 清空Console账号
      } else {
        // 分组
        data.claudeAccountId = form.claudeAccountId
        data.claudeConsoleAccountId = null // 清空Console账号
      }
    } else {
      // 使用共享池，清空所有绑定
      data.claudeAccountId = null
      data.claudeConsoleAccountId = null
    }

    // GeminiCuenta绑定
    if (form.geminiAccountId) {
      data.geminiAccountId = form.geminiAccountId
    } else {
      data.geminiAccountId = null
    }

    // OpenAICuenta绑定
    if (form.openaiAccountId) {
      data.openaiAccountId = form.openaiAccountId
    } else {
      data.openaiAccountId = null
    }

    // BedrockCuenta绑定
    if (form.bedrockAccountId) {
      data.bedrockAccountId = form.bedrockAccountId
    } else {
      data.bedrockAccountId = null
    }

    if (form.droidAccountId) {
      data.droidAccountId = form.droidAccountId
    } else {
      data.droidAccountId = null
    }

    // Límite de modelos - 始终Enviar这些字段
    data.enableModelRestriction = form.enableModelRestriction
    data.restrictedModels = form.restrictedModels

    // Límite de clientes - 始终Enviar这些字段
    data.enableClientRestriction = form.enableClientRestriction
    data.allowedClients = form.allowedClients

    // 活跃Estado
    data.isActive = form.isActive

    // 所有者
    if (form.ownerId !== undefined) {
      data.ownerId = form.ownerId
    }

    const result = await httpApis.updateApiKeyApi(props.apiKey.id, data)

    if (result.success) {
      emit('success')
      emit('close')
    } else {
      showToast(result.message || 'Error al actualizar', 'error')
    }
  } catch (error) {
    showToast('Error al actualizar', 'error')
  } finally {
    loading.value = false
  }
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
      httpApis.getGeminiApiAccountsApi(),
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
          isDedicated: account.accountType === 'dedicated' // 保留以便向siguiente兼容
        })
      })
    }

    if (claudeConsoleData.success) {
      claudeConsoleData.data?.forEach((account) => {
        claudeAccounts.push({
          ...account,
          platform: 'claude-console',
          isDedicated: account.accountType === 'dedicated' // 保留以便向siguiente兼容
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

    // 合并 OpenAI y OpenAI-Responses 账号
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

// 加载Usuario列表
const loadUsers = async () => {
  try {
    const response = await httpApis.getUsersApi()
    if (response.success) {
      availableUsers.value = response.data || []
    }
  } catch (error) {
    // console.error('Failed to load users:', error)
    availableUsers.value = [
      {
        id: 'admin',
        username: 'admin',
        displayName: 'Admin',
        email: '',
        role: 'admin'
      }
    ]
  }
}

// 初始化表单数据
onMounted(async () => {
  try {
    // 并行加载所有需要数据
    const [clients, tags] = await Promise.all([
      clientsStore.loadSupportedClients(),
      apiKeysStore.fetchTags(),
      loadUsers()
    ])

    supportedClients.value = clients || []
    availableTags.value = tags || []
  } catch (error) {
    // console.error('Error loading initial data:', error)
    // Fallback to empty arrays if loading fails
    supportedClients.value = []
    availableTags.value = []
  }

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

  // 使用Caché账号数据，不自动Actualizar（Usuario可点击"Actualizar账号"按钮手动Actualizar）

  form.name = props.apiKey.name
  form.serviceRates = props.apiKey.serviceRates || {}
  enableServiceRates.value = Object.keys(form.serviceRates).length > 0

  // 处理速率Límite迁移：如果有tokenLimit且没有rateLimitCost，SugerenciaUsuario
  form.tokenLimit = props.apiKey.tokenLimit || ''
  form.rateLimitCost = props.apiKey.rateLimitCost || ''

  // 如果有历史tokenLimit但没有rateLimitCost，SugerenciaUsuario需要重新Configuración
  if (props.apiKey.tokenLimit > 0 && !props.apiKey.rateLimitCost) {
    // 可以根据需要添加Sugerencia，o者自动迁移（这里选择让Usuario手动Configuración）
    // console.log('检测到历史TokenLimit，请考虑ConfiguraciónCostoLímite')
  }

  form.rateLimitWindow = props.apiKey.rateLimitWindow || ''
  form.rateLimitRequests = props.apiKey.rateLimitRequests || ''
  form.concurrencyLimit = props.apiKey.concurrencyLimit || ''
  form.dailyCostLimit = props.apiKey.dailyCostLimit || ''
  form.totalCostLimit = props.apiKey.totalCostLimit || ''
  form.weeklyOpusCostLimit = props.apiKey.weeklyOpusCostLimit || ''
  form.forcedModel = props.apiKey.forcedModel || ''
  // 处理权限数据，兼容旧格式（字符串）y新格式（数组）
  // Válido权限值
  const VALID_PERMS = ['claude', 'gemini', 'openai', 'droid']
  let perms = props.apiKey.permissions
  // 如果是字符串，尝试 JSON.parse（Redis 可能返回 "[]" o "[\"gemini\"]"）
  if (typeof perms === 'string') {
    if (perms === 'all' || perms === '') {
      perms = []
    } else if (perms.startsWith('[')) {
      try {
        perms = JSON.parse(perms)
      } catch {
        perms = VALID_PERMS.includes(perms) ? [perms] : []
      }
    } else if (perms.includes(',')) {
      // 兼容逗号分隔格式（如 "claude,openai"）
      perms = perms
        .split(',')
        .map((p) => p.trim())
        .filter((p) => VALID_PERMS.includes(p))
    } else if (VALID_PERMS.includes(perms)) {
      perms = [perms]
    } else {
      perms = []
    }
  }
  if (Array.isArray(perms)) {
    // 过滤掉Inválido值（如 "[]"）
    form.permissions = perms.filter((p) => VALID_PERMS.includes(p))
  } else {
    form.permissions = []
  }
  // 处理 Claude 账号（区分 OAuth y Console）
  if (props.apiKey.claudeConsoleAccountId) {
    form.claudeAccountId = `console:${props.apiKey.claudeConsoleAccountId}`
  } else {
    form.claudeAccountId = props.apiKey.claudeAccountId || ''
  }
  form.geminiAccountId = props.apiKey.geminiAccountId || ''

  // 处理 OpenAI 账号 - 直接使用siguiente端传来值（已包含 responses: anterior缀）
  form.openaiAccountId = props.apiKey.openaiAccountId || ''

  form.bedrockAccountId = props.apiKey.bedrockAccountId || ''
  form.droidAccountId = props.apiKey.droidAccountId || ''
  form.restrictedModels = props.apiKey.restrictedModels || []
  form.allowedClients = props.apiKey.allowedClients || []
  form.tags = props.apiKey.tags || []
  // desiguiente端数据en获取实际HabilitarEstado，强制转换para布尔值（Redis返回是字符串）
  form.enableModelRestriction =
    props.apiKey.enableModelRestriction === true || props.apiKey.enableModelRestriction === 'true'
  form.enableClientRestriction =
    props.apiKey.enableClientRestriction === true || props.apiKey.enableClientRestriction === 'true'
  // 初始化活跃Estado，默认para true（强制转换para布尔值，因paraRedis返回字符串）
  form.isActive =
    props.apiKey.isActive === undefined ||
    props.apiKey.isActive === true ||
    props.apiKey.isActive === 'true'

  // 初始化所有者
  form.ownerId = props.apiKey.userId || 'admin'
})
</script>
