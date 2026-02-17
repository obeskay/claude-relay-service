<template>
  <div class="tab-content">
    <div class="card p-4 sm:p-6">
      <div class="mb-4 flex flex-col gap-4 sm:mb-6">
        <div>
          <h3 class="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100 sm:mb-2 sm:text-xl">
            Gestión de API Keys
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 sm:text-base">
            管理y监控您 API Clave
          </p>
        </div>

        <!-- Tab Navigation -->
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav aria-label="Tabs" class="-mb-px flex space-x-8">
            <button
              :class="[
                'whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium',
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300'
              ]"
              @click="activeTab = 'active'"
            >
              活跃 API Keys
              <span
                v-if="apiKeys.length > 0"
                class="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-900 dark:bg-gray-700 dark:text-gray-100"
              >
                {{ apiKeys.length }}
              </span>
            </button>
            <button
              :class="[
                'whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium',
                activeTab === 'deleted'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300'
              ]"
              @click="loadDeletedApiKeys"
            >
              已Eliminar API Keys
              <span
                v-if="deletedApiKeys.length > 0"
                class="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-900 dark:bg-gray-700 dark:text-gray-100"
              >
                {{ deletedApiKeys.length }}
              </span>
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <!-- 活跃 API Keys Tab Panel -->
        <div v-if="activeTab === 'active'" class="tab-panel">
          <!-- 工具栏区域 - 添加 mb-4 增加与表格间距 -->
          <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <!-- izquierda侧：查询Filtrar器组 -->
            <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <!-- Rango de tiempoFiltrar -->
              <div class="group relative min-w-[140px]">
                <div
                  class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                ></div>
                <CustomDropdown
                  v-model="globalDateFilter.preset"
                  icon="fa-calendar-alt"
                  icon-color="text-blue-500"
                  :options="timeRangeDropdownOptions"
                  placeholder="Seleccionar rango de tiempo"
                  @change="handleTimeRangeChange"
                />
              </div>

              <!-- 自定义Rango de fechas选择器 - en选择自定义时显示 -->
              <div v-if="globalDateFilter.type === 'custom'" class="flex items-center">
                <el-date-picker
                  class="api-key-date-picker custom-date-range-picker"
                  :clearable="true"
                  :default-time="defaultTime"
                  :disabled-date="disabledDate"
                  end-placeholder="Fecha final"
                  format="YYYY-MM-DD HH:mm:ss"
                  :model-value="globalDateFilter.customRange"
                  range-separator="a"
                  size="small"
                  start-placeholder="Fecha inicial"
                  style="width: 320px; height: 38px"
                  type="datetimerange"
                  :unlink-panels="false"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  @update:model-value="onGlobalCustomDateRangeChange"
                />
              </div>

              <!-- EtiquetaFiltrar器 -->
              <div class="group relative min-w-[140px]">
                <div
                  class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                ></div>
                <div class="relative">
                  <CustomDropdown
                    v-model="selectedTagFilter"
                    icon="fa-tags"
                    icon-color="text-purple-500"
                    :options="tagOptions"
                    placeholder="所有Etiqueta"
                  />
                  <span
                    v-if="selectedTagFilter"
                    class="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-xs text-white shadow-sm"
                  >
                    {{ selectedTagCount }}
                  </span>
                </div>
              </div>

              <!-- ModeloFiltrar器 -->
              <div class="group relative min-w-[140px]">
                <div
                  class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                ></div>
                <div class="relative">
                  <CustomDropdown
                    v-model="selectedModels"
                    icon="fa-cube"
                    icon-color="text-orange-500"
                    :multiple="true"
                    :options="modelOptions"
                    placeholder="Todos los modelos"
                  />
                  <span
                    v-if="selectedModels.length > 0"
                    class="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs text-white shadow-sm"
                  >
                    {{ selectedModels.length }}
                  </span>
                </div>
              </div>

              <!-- Buscar模式与Buscar框 -->
              <div class="flex min-w-[240px] flex-col gap-2 sm:flex-row sm:items-center">
                <div class="sm:w-44">
                  <CustomDropdown
                    v-model="searchMode"
                    icon="fa-filter"
                    icon-color="text-cyan-500"
                    :options="searchModeOptions"
                    placeholder="选择BuscarTipo"
                  />
                </div>
                <div class="group relative flex-1">
                  <div
                    class="pointer-events-none absolute -inset-0.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                  ></div>
                  <div class="relative flex items-center">
                    <input
                      v-model="searchKeyword"
                      class="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pl-9 text-sm text-gray-700 placeholder-gray-400 shadow-sm transition-all duration-200 hover:border-gray-300 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 dark:hover:border-gray-500"
                      :placeholder="
                        searchMode === 'bindingAccount'
                          ? 'Buscar所属账号...'
                          : isLdapEnabled
                            ? 'BuscarNombreo所有者...'
                            : 'BuscarNombre...'
                      "
                      type="text"
                    />
                    <i class="fas fa-search absolute left-3 text-sm text-cyan-500" />
                    <button
                      v-if="searchKeyword"
                      class="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      @click="clearSearch"
                    >
                      <i class="fas fa-times text-xs" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- derecha侧：Operación按钮组 -->
            <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <!-- Actualizar按钮 -->
              <button
                class="group relative flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500 sm:w-auto"
                :disabled="apiKeysLoading"
                @click="loadApiKeys()"
              >
                <div
                  class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                ></div>
                <i
                  :class="[
                    'fas relative text-green-500',
                    apiKeysLoading ? 'fa-spinner fa-spin' : 'fa-sync-alt'
                  ]"
                />
                <span class="relative">Actualizar</span>
              </button>

              <!-- 选择/Cancelar选择按钮 -->
              <button
                class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                @click="toggleSelectionMode"
              >
                <i :class="showCheckboxes ? 'fas fa-times' : 'fas fa-check-square'"></i>
                <span>{{ showCheckboxes ? 'Cancelar选择' : '选择' }}</span>
              </button>

              <!-- Exportar数据按钮 -->
              <button
                class="group relative flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500 sm:w-auto"
                @click="exportToExcel"
              >
                <div
                  class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                ></div>
                <i class="fas fa-file-excel relative text-emerald-500" />
                <span class="relative">Exportar数据</span>
              </button>

              <!-- Gestionar etiquetas按钮 -->
              <button
                class="group relative flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500 sm:w-auto"
                @click="showTagManagementModal = true"
              >
                <div
                  class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                ></div>
                <i class="fas fa-tags relative text-purple-500" />
                <span class="relative">Gestionar etiquetas</span>
              </button>

              <!-- Edición por lotes按钮 - 移到Actualizar按钮旁边 -->
              <button
                v-if="selectedApiKeys.length > 0"
                class="group relative flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition-all duration-200 hover:border-blue-300 hover:bg-blue-100 hover:shadow-md dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 sm:w-auto"
                @click="openBatchEditModal()"
              >
                <div
                  class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                ></div>
                <i class="fas fa-edit relative text-blue-600 dark:text-blue-400" />
                <span class="relative">Editar选en ({{ selectedApiKeys.length }})</span>
              </button>

              <!-- Eliminación por lotes按钮 - 移到Actualizar按钮旁边 -->
              <button
                v-if="selectedApiKeys.length > 0"
                class="group relative flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-all duration-200 hover:border-red-300 hover:bg-red-100 hover:shadow-md dark:border-red-700 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 sm:w-auto"
                @click="batchDeleteApiKeys()"
              >
                <div
                  class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                ></div>
                <i class="fas fa-trash relative text-red-600 dark:text-red-400" />
                <span class="relative">Eliminar选en ({{ selectedApiKeys.length }})</span>
              </button>

              <!-- Crear按钮 -->
              <button
                class="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2 text-sm font-medium text-white shadow-md transition-all duration-200 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg sm:w-auto"
                @click.stop="openCreateApiKeyModal"
              >
                <i class="fas fa-plus"></i>
                <span>Crear新 Key</span>
              </button>
            </div>
          </div>

          <div v-if="apiKeysLoading" class="py-12 text-center">
            <div class="loading-spinner mx-auto mb-4" />
            <p class="text-gray-500 dark:text-gray-400">正en加载 API Keys...</p>
          </div>

          <div v-else-if="apiKeys.length === 0" class="py-12 text-center">
            <div
              class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
            >
              <i class="fas fa-key text-xl text-gray-400" />
            </div>
            <p class="text-lg text-gray-500 dark:text-gray-400">Sin API Keys</p>
            <p class="mt-2 text-sm text-gray-400">点击arriba方按钮Crear您primero API Key</p>
          </div>

          <!-- 桌面端表格视图 -->
          <div v-else class="table-wrapper hidden md:block">
            <div class="table-container">
              <table class="w-full">
                <thead
                  class="sticky top-0 z-10 bg-gradient-to-b from-gray-50 to-gray-100/90 backdrop-blur-sm dark:from-gray-700 dark:to-gray-800/90"
                >
                  <tr>
                    <th
                      v-if="shouldShowCheckboxes"
                      class="checkbox-column sticky left-0 z-20 min-w-[50px] px-3 py-4 text-left"
                    >
                      <div class="flex items-center">
                        <input
                          v-model="selectAllChecked"
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          :indeterminate="isIndeterminate"
                          type="checkbox"
                          @change="handleSelectAll"
                        />
                      </div>
                    </th>
                    <th
                      class="name-column sticky z-20 min-w-[140px] cursor-pointer px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                      :class="shouldShowCheckboxes ? 'left-[50px]' : 'left-0'"
                      @click="sortApiKeys('name')"
                    >
                      Nombre
                      <i
                        v-if="apiKeysSortBy === 'name'"
                        :class="[
                          'fas',
                          apiKeysSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                          'ml-1'
                        ]"
                      />
                      <i v-else class="fas fa-sort ml-1 text-gray-400" />
                    </th>
                    <th
                      class="min-w-[140px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    >
                      所属账号
                    </th>
                    <th
                      class="min-w-[100px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    >
                      Etiqueta
                    </th>
                    <th
                      class="min-w-[80px] cursor-pointer px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                      @click="sortApiKeys('status')"
                    >
                      Estado
                      <i
                        v-if="apiKeysSortBy === 'status'"
                        :class="[
                          'fas',
                          apiKeysSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                          'ml-1'
                        ]"
                      />
                      <i v-else class="fas fa-sort ml-1 text-gray-400" />
                    </th>
                    <th
                      class="min-w-[70px] px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      :class="{
                        'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600': canSortByCost,
                        'cursor-not-allowed opacity-60': !canSortByCost
                      }"
                      :title="costSortTooltip"
                      @click="sortApiKeys('cost')"
                    >
                      Costo
                      <i
                        v-if="apiKeysSortBy === 'cost'"
                        :class="[
                          'fas',
                          apiKeysSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                          'ml-1'
                        ]"
                      />
                      <i v-else-if="canSortByCost" class="fas fa-sort ml-1 text-gray-400" />
                      <i v-else class="fas fa-clock ml-1 text-gray-400" title="索引Actualizaren" />
                    </th>
                    <th
                      class="min-w-[180px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    >
                      Límite
                    </th>
                    <th
                      class="min-w-[80px] px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    >
                      Token
                    </th>
                    <th
                      class="min-w-[80px] px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    >
                      Solicitud数
                    </th>
                    <th
                      class="min-w-[100px] cursor-pointer px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                      @click="sortApiKeys('lastUsedAt')"
                    >
                      最siguiente使用
                      <i
                        v-if="apiKeysSortBy === 'lastUsedAt'"
                        :class="[
                          'fas',
                          apiKeysSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                          'ml-1'
                        ]"
                      />
                      <i v-else class="fas fa-sort ml-1 text-gray-400" />
                    </th>
                    <th
                      class="min-w-[100px] cursor-pointer px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                      @click="sortApiKeys('createdAt')"
                    >
                      Crear时间
                      <i
                        v-if="apiKeysSortBy === 'createdAt'"
                        :class="[
                          'fas',
                          apiKeysSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                          'ml-1'
                        ]"
                      />
                      <i v-else class="fas fa-sort ml-1 text-gray-400" />
                    </th>
                    <th
                      class="min-w-[100px] cursor-pointer px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                      @click="sortApiKeys('expiresAt')"
                    >
                      过期时间
                      <i
                        v-if="apiKeysSortBy === 'expiresAt'"
                        :class="[
                          'fas',
                          apiKeysSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                          'ml-1'
                        ]"
                      />
                      <i v-else class="fas fa-sort ml-1 text-gray-400" />
                    </th>
                    <th
                      class="operations-column sticky right-0 min-w-[120px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    >
                      Operación
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="key in paginatedApiKeys" :key="key.id">
                    <!-- API Key 主行 - 添加斑马registros纹y增强分隔 -->
                    <tr
                      :class="[
                        'table-row',
                        'border-b-2 border-gray-200/80 dark:border-gray-700/50',
                        'hover:shadow-sm'
                      ]"
                    >
                      <td
                        v-if="shouldShowCheckboxes"
                        class="checkbox-column sticky left-0 z-10 px-3 py-3"
                      >
                        <div class="flex items-center">
                          <input
                            v-model="selectedApiKeys"
                            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            type="checkbox"
                            :value="key.id"
                            @change="updateSelectAllState"
                          />
                        </div>
                      </td>
                      <td
                        class="name-column sticky z-10 px-3 py-3"
                        :class="shouldShowCheckboxes ? 'left-[50px]' : 'left-0'"
                      >
                        <div class="min-w-0">
                          <!-- Nombre -->
                          <div
                            class="cursor-pointer truncate text-sm font-semibold text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                            title="点击Copiar"
                            @click.stop="copyText(key.name)"
                          >
                            {{ key.name }}
                          </div>
                          <!-- 显示所有者Información -->
                          <div
                            v-if="isLdapEnabled && key.ownerDisplayName"
                            class="mt-1 text-xs text-red-600"
                          >
                            <i class="fas fa-user mr-1" />
                            {{ key.ownerDisplayName }}
                          </div>
                        </div>
                      </td>
                      <!-- 所属账号列 -->
                      <td class="px-3 py-3">
                        <div class="space-y-1">
                          <!-- 账号数据Cargando -->
                          <div
                            v-if="accountsLoading && hasAnyBinding(key)"
                            class="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500"
                          >
                            <i class="fas fa-spinner fa-spin mr-1"></i>
                            Cargando...
                          </div>
                          <!-- 账号数据已加载o无绑定 -->
                          <template v-else>
                            <!-- Claude 绑定 -->
                            <div
                              v-if="key.claudeAccountId || key.claudeConsoleAccountId"
                              class="flex items-center gap-1 text-xs"
                            >
                              <span
                                class="inline-flex items-center rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                              >
                                <i class="fas fa-brain mr-1 text-[10px]" />
                                Claude
                              </span>
                              <span class="truncate text-gray-600 dark:text-gray-400">
                                {{ getClaudeBindingInfo(key) }}
                              </span>
                            </div>
                            <!-- Gemini 绑定 -->
                            <div v-if="key.geminiAccountId" class="flex items-center gap-1 text-xs">
                              <span
                                class="inline-flex items-center rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                              >
                                <i class="fas fa-robot mr-1 text-[10px]" />
                                Gemini
                              </span>
                              <span class="truncate text-gray-600 dark:text-gray-400">
                                {{ getGeminiBindingInfo(key) }}
                              </span>
                            </div>
                            <!-- OpenAI 绑定 -->
                            <div v-if="key.openaiAccountId" class="flex items-center gap-1 text-xs">
                              <span
                                class="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                              >
                                <i class="fa-openai mr-1 text-[10px]" />
                                OpenAI
                              </span>
                              <span class="truncate text-gray-600 dark:text-gray-400">
                                {{ getOpenAIBindingInfo(key) }}
                              </span>
                            </div>
                            <!-- Bedrock 绑定 -->
                            <div
                              v-if="key.bedrockAccountId"
                              class="flex items-center gap-1 text-xs"
                            >
                              <span
                                class="inline-flex items-center rounded bg-orange-100 px-1.5 py-0.5 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                              >
                                <i class="fas fa-cloud mr-1 text-[10px]" />
                                Bedrock
                              </span>
                              <span class="truncate text-gray-600 dark:text-gray-400">
                                {{ getBedrockBindingInfo(key) }}
                              </span>
                            </div>
                            <!-- Droid 绑定 -->
                            <div v-if="key.droidAccountId" class="flex items-center gap-1 text-xs">
                              <span
                                class="inline-flex items-center rounded bg-cyan-100 px-1.5 py-0.5 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
                              >
                                <i class="fas fa-robot mr-1 text-[10px]" />
                                Droid
                              </span>
                              <span class="truncate text-gray-600 dark:text-gray-400">
                                {{ getDroidBindingInfo(key) }}
                              </span>
                            </div>
                            <!-- 共享池 -->
                            <div
                              v-if="
                                !key.claudeAccountId &&
                                !key.claudeConsoleAccountId &&
                                !key.geminiAccountId &&
                                !key.openaiAccountId &&
                                !key.bedrockAccountId &&
                                !key.droidAccountId
                              "
                              class="text-xs text-gray-500 dark:text-gray-400"
                            >
                              <i class="fas fa-share-alt mr-1" />
                              共享池
                            </div>
                          </template>
                        </div>
                      </td>
                      <!-- Etiqueta列 -->
                      <td class="px-3 py-3">
                        <div class="flex flex-wrap gap-1">
                          <span
                            v-for="tag in key.tags || []"
                            :key="tag"
                            class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            {{ tag }}
                          </span>
                          <span
                            v-if="!key.tags || key.tags.length === 0"
                            class="text-xs text-gray-400"
                            >无Etiqueta</span
                          >
                        </div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-3">
                        <span
                          :class="[
                            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                            key.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          ]"
                        >
                          <div
                            :class="[
                              'mr-2 h-2 w-2 rounded-full',
                              key.isActive ? 'bg-green-500' : 'bg-red-500'
                            ]"
                          />
                          {{ key.isActive ? '活跃' : 'Deshabilitar' }}
                        </span>
                      </td>
                      <!-- Costo -->
                      <td class="whitespace-nowrap px-3 py-3 text-right" style="font-size: 13px">
                        <!-- CargandoEstado - 骨架屏 -->
                        <template v-if="isStatsLoading(key.id)">
                          <div class="flex items-center justify-end">
                            <div
                              class="h-5 w-14 animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                            />
                          </div>
                        </template>
                        <!-- 已加载Estado -->
                        <template v-else-if="getCachedStats(key.id)">
                          <span
                            class="font-semibold text-blue-600 dark:text-blue-400"
                            style="font-size: 14px"
                          >
                            {{ getCachedStats(key.id).formattedCost || '$0.00' }}
                          </span>
                        </template>
                        <!-- 未加载Estado -->
                        <template v-else>
                          <span class="text-gray-400">-</span>
                        </template>
                      </td>
                      <!-- Limitar -->
                      <td class="px-2 py-2" style="font-size: 12px">
                        <div class="flex flex-col gap-2">
                          <!-- CargandoEstado - 骨架屏（仅en有CostoConfiguración de límites时显示） -->
                          <template
                            v-if="
                              isStatsLoading(key.id) &&
                              (key.dailyCostLimit > 0 ||
                                key.totalCostLimit > 0 ||
                                (key.rateLimitWindow > 0 && key.rateLimitCost > 0))
                            "
                          >
                            <div class="space-y-2">
                              <div
                                class="h-4 w-full animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                              />
                              <div
                                class="h-3 w-2/3 animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                              />
                            </div>
                          </template>
                          <!-- 已加载Estado -->
                          <template v-else>
                            <!-- Límite de costo diario进度registros -->
                            <LimitProgressBar
                              v-if="key.dailyCostLimit > 0"
                              :current="getCachedStats(key.id)?.dailyCost || 0"
                              label="每日Límite"
                              :limit="key.dailyCostLimit"
                              type="daily"
                              variant="compact"
                            />

                            <!-- Límite de costo total进度registros（无每日Límite时展示） -->
                            <LimitProgressBar
                              v-else-if="key.totalCostLimit > 0"
                              :current="getCachedStats(key.id)?.allTimeCost || 0"
                              label="Límite de costo total"
                              :limit="key.totalCostLimit"
                              type="total"
                              variant="compact"
                            />

                            <!-- 时间窗口CostoLímite（无每日yLímite de costo total时展示） -->
                            <div
                              v-else-if="
                                key.rateLimitWindow > 0 &&
                                key.rateLimitCost > 0 &&
                                (!key.dailyCostLimit || key.dailyCostLimit === 0) &&
                                (!key.totalCostLimit || key.totalCostLimit === 0)
                              "
                              class="space-y-1.5"
                            >
                              <!-- Costo进度registros -->
                              <LimitProgressBar
                                :current="getCachedStats(key.id)?.currentWindowCost || 0"
                                label="窗口Costo"
                                :limit="key.rateLimitCost"
                                type="window"
                                variant="compact"
                              />
                              <!-- Restablecer倒计时 -->
                              <div class="flex items-center justify-between text-[10px]">
                                <div class="flex items-center gap-1 text-sky-600 dark:text-sky-300">
                                  <i class="fas fa-clock text-[10px]" />
                                  <span class="font-medium">{{ key.rateLimitWindow }}分钟窗口</span>
                                </div>
                                <span
                                  class="font-bold"
                                  :class="
                                    (getCachedStats(key.id)?.windowRemainingSeconds || 0) > 0
                                      ? 'text-sky-700 dark:text-sky-300'
                                      : 'text-gray-400 dark:text-gray-500'
                                  "
                                >
                                  {{
                                    (getCachedStats(key.id)?.windowRemainingSeconds || 0) > 0
                                      ? formatWindowTime(
                                          getCachedStats(key.id)?.windowRemainingSeconds || 0
                                        )
                                      : '未激活'
                                  }}
                                </span>
                              </div>
                            </div>

                            <!-- 如果没有任何Limitar -->
                            <div
                              v-else
                              class="flex items-center justify-center gap-1.5 py-2 text-gray-500 dark:text-gray-400"
                            >
                              <i class="fas fa-infinity text-base" />
                              <span class="text-xs font-medium">无Límite</span>
                            </div>
                          </template>
                        </div>
                      </td>
                      <!-- Token数量 -->
                      <td class="whitespace-nowrap px-3 py-3 text-right" style="font-size: 13px">
                        <!-- CargandoEstado - 骨架屏 -->
                        <template v-if="isStatsLoading(key.id)">
                          <div class="flex items-center justify-end">
                            <div
                              class="h-5 w-16 animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                            />
                          </div>
                        </template>
                        <!-- 已加载Estado -->
                        <template v-else-if="getCachedStats(key.id)">
                          <div class="flex items-center justify-end gap-1">
                            <span
                              class="font-medium text-purple-600 dark:text-purple-400"
                              style="font-size: 13px"
                            >
                              {{ formatTokenCount(getCachedStats(key.id).tokens || 0) }}
                            </span>
                          </div>
                        </template>
                        <!-- 未加载Estado -->
                        <template v-else>
                          <span class="text-gray-400">-</span>
                        </template>
                      </td>
                      <!-- Solicitud数 -->
                      <td class="whitespace-nowrap px-3 py-3 text-right" style="font-size: 13px">
                        <!-- CargandoEstado - 骨架屏 -->
                        <template v-if="isStatsLoading(key.id)">
                          <div class="flex items-center justify-end">
                            <div
                              class="h-5 w-12 animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                            />
                          </div>
                        </template>
                        <!-- 已加载Estado -->
                        <template v-else-if="getCachedStats(key.id)">
                          <div class="flex items-center justify-end gap-1">
                            <span
                              class="font-medium text-gray-900 dark:text-gray-100"
                              style="font-size: 13px"
                            >
                              {{ formatNumber(getCachedStats(key.id).requests || 0) }}
                            </span>
                            <span class="text-xs text-gray-500">veces</span>
                          </div>
                        </template>
                        <!-- 未加载Estado -->
                        <template v-else>
                          <span class="text-gray-400">-</span>
                        </template>
                      </td>
                      <!-- 最siguiente使用 -->
                      <td
                        class="whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-300"
                        style="font-size: 13px"
                      >
                        <div class="flex flex-col leading-tight">
                          <span
                            v-if="key.lastUsedAt"
                            class="cursor-help"
                            style="font-size: 13px"
                            :title="new Date(key.lastUsedAt).toLocaleString('zh-CN')"
                          >
                            {{ formatLastUsed(key.lastUsedAt) }}
                          </span>
                          <span v-else class="text-gray-400" style="font-size: 13px">de未使用</span>
                          <!-- 最siguiente使用账号 loading Estado -->
                          <span
                            v-if="key.lastUsedAt && isLastUsageLoading(key.id)"
                            class="mt-1 text-xs text-gray-400 dark:text-gray-500"
                          >
                            <i class="fas fa-spinner fa-spin mr-1"></i>
                            Cargando...
                          </span>
                          <span
                            v-else-if="hasLastUsageAccount(key)"
                            class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                            :title="getLastUsageFullName(key)"
                          >
                            {{ getLastUsageDisplayName(key) }}
                            <span
                              v-if="!isLastUsageDeleted(key)"
                              class="ml-1 text-gray-400 dark:text-gray-500"
                            >
                              ({{ getLastUsageTypeLabel(key) }})
                            </span>
                          </span>
                          <span v-else class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Sin使用账号
                          </span>
                        </div>
                      </td>
                      <!-- Crear时间 -->
                      <td
                        class="whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-300"
                        style="font-size: 13px"
                      >
                        {{ new Date(key.createdAt).toLocaleDateString() }}
                      </td>
                      <td
                        class="whitespace-nowrap px-3 py-3 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <div class="inline-flex items-center gap-1.5">
                          <!-- 未激活Estado -->
                          <span
                            v-if="key.expirationMode === 'activation' && !key.isActivated"
                            class="inline-flex items-center text-blue-600 dark:text-blue-400"
                            style="font-size: 13px"
                          >
                            <i class="fas fa-pause-circle mr-1 text-xs" />
                            未激活 (
                            {{ key.activationDays || (key.activationUnit === 'hours' ? 24 : 30)
                            }}{{ key.activationUnit === 'hours' ? '小时' : '天' }})
                          </span>
                          <!-- 已Configuración过期时间 -->
                          <span v-else-if="key.expiresAt">
                            <span
                              v-if="isApiKeyExpired(key.expiresAt)"
                              class="inline-flex cursor-pointer items-center text-red-600 hover:underline"
                              style="font-size: 13px"
                              @click.stop="startEditExpiry(key)"
                            >
                              <i class="fas fa-exclamation-circle mr-1 text-xs" />
                              已过期
                            </span>
                            <span
                              v-else-if="isApiKeyExpiringSoon(key.expiresAt)"
                              class="inline-flex cursor-pointer items-center text-orange-600 hover:underline"
                              style="font-size: 13px"
                              @click.stop="startEditExpiry(key)"
                            >
                              <i class="fas fa-clock mr-1 text-xs" />
                              {{ formatExpireDate(key.expiresAt) }}
                            </span>
                            <span
                              v-else
                              class="cursor-pointer text-gray-600 hover:underline dark:text-gray-400"
                              style="font-size: 13px"
                              @click.stop="startEditExpiry(key)"
                            >
                              {{ formatExpireDate(key.expiresAt) }}
                            </span>
                          </span>
                          <!-- 永不过期 -->
                          <span
                            v-else
                            class="inline-flex cursor-pointer items-center text-gray-400 hover:underline dark:text-gray-500"
                            style="font-size: 13px"
                            @click.stop="startEditExpiry(key)"
                          >
                            <i class="fas fa-infinity mr-1 text-xs" />
                            永不过期
                          </span>
                        </div>
                      </td>
                      <td
                        class="operations-column operations-cell whitespace-nowrap px-3 py-3"
                        style="font-size: 13px"
                      >
                        <!-- 大屏幕：展开所有按钮 -->
                        <div class="hidden gap-1 2xl:flex">
                          <button
                            class="rounded px-2 py-1 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50 hover:text-purple-900 dark:hover:bg-purple-900/20"
                            title="Ver详细Estadísticas"
                            @click="showUsageDetails(key)"
                          >
                            <i class="fas fa-chart-line" />
                            <span class="ml-1">Detalles</span>
                          </button>
                          <button
                            v-if="key && key.id"
                            class="rounded px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-900/20"
                            title="Uso del modelo分布"
                            @click="toggleApiKeyModelStats(key.id)"
                          >
                            <i
                              :class="[
                                'fas',
                                expandedApiKeys[key.id] ? 'fa-chevron-up' : 'fa-chevron-down'
                              ]"
                            />
                            <span class="ml-1">Modelo</span>
                          </button>
                          <button
                            class="rounded px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-900 dark:hover:bg-blue-900/20"
                            title="Editar"
                            @click="openEditApiKeyModal(key)"
                          >
                            <i class="fas fa-edit" />
                            <span class="ml-1">Editar</span>
                          </button>
                          <button
                            v-if="
                              key.expiresAt &&
                              (isApiKeyExpired(key.expiresAt) ||
                                isApiKeyExpiringSoon(key.expiresAt))
                            "
                            class="rounded px-2 py-1 text-xs font-medium text-green-600 transition-colors hover:bg-green-50 hover:text-green-900 dark:hover:bg-green-900/20"
                            title="续期"
                            @click="openRenewApiKeyModal(key)"
                          >
                            <i class="fas fa-clock" />
                            <span class="ml-1">续期</span>
                          </button>
                          <button
                            :class="[
                              key.isActive
                                ? 'text-orange-600 hover:bg-orange-50 hover:text-orange-900 dark:hover:bg-orange-900/20'
                                : 'text-green-600 hover:bg-green-50 hover:text-green-900 dark:hover:bg-green-900/20',
                              'rounded px-2 py-1 text-xs font-medium transition-colors'
                            ]"
                            :title="key.isActive ? 'Deshabilitar' : '激活'"
                            @click="toggleApiKeyStatus(key)"
                          >
                            <i :class="['fas', key.isActive ? 'fa-ban' : 'fa-check-circle']" />
                            <span class="ml-1">{{ key.isActive ? 'Deshabilitar' : '激活' }}</span>
                          </button>
                          <button
                            class="rounded px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-900 dark:hover:bg-red-900/20"
                            title="Eliminar"
                            @click="deleteApiKey(key.id)"
                          >
                            <i class="fas fa-trash" />
                            <span class="ml-1">Eliminar</span>
                          </button>
                        </div>
                        <!-- 小屏幕：常用按钮 + abajo拉菜单 -->
                        <div class="flex items-center gap-1 2xl:hidden">
                          <!-- 始终显示快捷按钮 -->
                          <button
                            class="rounded px-2 py-1 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50 hover:text-purple-900 dark:hover:bg-purple-900/20"
                            title="Ver详细Estadísticas"
                            @click="showUsageDetails(key)"
                          >
                            <i class="fas fa-chart-line" />
                          </button>
                          <button
                            v-if="key && key.id"
                            class="rounded px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-900/20"
                            title="Uso del modelo分布"
                            @click="toggleApiKeyModelStats(key.id)"
                          >
                            <i
                              :class="[
                                'fas',
                                expandedApiKeys[key.id] ? 'fa-chevron-up' : 'fa-chevron-down'
                              ]"
                            />
                          </button>
                          <!-- 更多Operaciónabajo拉菜单 -->
                          <ActionDropdown :actions="getApiKeyActions(key)" />
                        </div>
                      </td>
                    </tr>

                    <!-- ModeloEstadísticas展开区域 -->
                    <tr v-if="key && key.id && expandedApiKeys[key.id]">
                      <td class="bg-gray-50 px-3 py-3 dark:bg-gray-700" colspan="13">
                        <div v-if="!apiKeyModelStats[key.id]" class="py-4 text-center">
                          <div class="loading-spinner mx-auto" />
                          <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            加载ModeloEstadísticas...
                          </p>
                        </div>
                        <div class="space-y-4">
                          <!-- 通用标题y时间Filtrar器，无论是否有数据都显示 -->
                          <div class="mb-4 flex items-center justify-between">
                            <h5
                              class="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300"
                            >
                              <i class="fas fa-chart-pie mr-2 text-indigo-500" />
                              Uso del modelo分布
                            </h5>
                            <div class="flex items-center gap-2">
                              <span
                                v-if="
                                  apiKeyModelStats[key.id] && apiKeyModelStats[key.id].length > 0
                                "
                                class="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                              >
                                {{ apiKeyModelStats[key.id].length }}  Modelo
                              </span>

                              <!-- API Keys日期Filtrar器 -->
                              <div class="flex items-center gap-1">
                                <!-- 快捷日期选择 -->
                                <div class="flex gap-1 rounded bg-gray-100 p-1 dark:bg-gray-700">
                                  <button
                                    v-for="option in getApiKeyDateFilter(key.id).presetOptions"
                                    :key="option.value"
                                    :class="[
                                      'rounded px-2 py-1 text-xs font-medium transition-colors',
                                      getApiKeyDateFilter(key.id).preset === option.value &&
                                      getApiKeyDateFilter(key.id).type === 'preset'
                                        ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800'
                                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                    ]"
                                    @click="setApiKeyDateFilterPreset(option.value, key.id)"
                                  >
                                    {{ option.label }}
                                  </button>
                                </div>

                                <!-- Element Plus Rango de fechas选择器 -->
                                <el-date-picker
                                  class="api-key-date-picker"
                                  :clearable="true"
                                  :default-time="defaultTime"
                                  :disabled-date="disabledDate"
                                  end-placeholder="Fecha final"
                                  format="YYYY-MM-DD HH:mm:ss"
                                  :model-value="getApiKeyDateFilter(key.id).customRange"
                                  range-separator="a"
                                  size="small"
                                  start-placeholder="Fecha inicial"
                                  style="width: 280px"
                                  type="datetimerange"
                                  :unlink-panels="false"
                                  value-format="YYYY-MM-DD HH:mm:ss"
                                  @update:model-value="
                                    (value) => onApiKeyCustomDateRangeChange(key.id, value)
                                  "
                                />
                              </div>
                            </div>
                          </div>

                          <!-- 数据展示区域 -->
                          <div
                            v-if="apiKeyModelStats[key.id] && apiKeyModelStats[key.id].length === 0"
                            class="py-8 text-center"
                          >
                            <div class="mb-3 flex items-center justify-center gap-2">
                              <i class="fas fa-chart-line text-lg text-gray-400" />
                              <p class="text-sm text-gray-500 dark:text-gray-400">
                                SinUso del modelo数据
                              </p>
                              <button
                                class="ml-2 flex items-center gap-1 text-sm text-blue-500 transition-colors hover:text-blue-700"
                                title="RestablecerFiltrarregistros件并Actualizar"
                                @click="resetApiKeyDateFilter(key.id)"
                              >
                                <i class="fas fa-sync-alt text-xs" />
                                <span class="text-xs">Actualizar</span>
                              </button>
                            </div>
                            <p class="text-xs text-gray-400">
                              尝试调整Rango de tiempoo点击Actualizar重新加载数据
                            </p>
                          </div>
                          <div
                            v-else-if="
                              apiKeyModelStats[key.id] && apiKeyModelStats[key.id].length > 0
                            "
                            class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                          >
                            <div
                              v-for="stat in apiKeyModelStats[key.id]"
                              :key="stat.model"
                              class="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 transition-all duration-200 hover:border-indigo-300 hover:shadow-lg dark:border-gray-600 dark:from-gray-800 dark:to-gray-700 dark:hover:border-indigo-500"
                            >
                              <div class="mb-3 flex items-start justify-between">
                                <div class="flex-1">
                                  <span
                                    class="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-200"
                                    >{{ stat.model }}</span
                                  >
                                  <span
                                    class="rounded-full bg-blue-50 px-2 py-1 text-xs text-gray-500 dark:bg-blue-900/30 dark:text-gray-400"
                                    >{{ stat.requests }} vecesSolicitud</span
                                  >
                                </div>
                              </div>

                              <div class="mb-3 space-y-2">
                                <div class="flex items-center justify-between text-sm">
                                  <span class="flex items-center text-gray-600 dark:text-gray-400">
                                    <i class="fas fa-coins mr-1 text-xs text-yellow-500" />
                                    总Token:
                                  </span>
                                  <span class="font-semibold text-gray-900 dark:text-gray-100">{{
                                    formatTokenCount(stat.allTokens)
                                  }}</span>
                                </div>
                                <div class="flex items-center justify-between text-sm">
                                  <span class="flex items-center text-gray-600 dark:text-gray-400">
                                    <i class="fas fa-dollar-sign mr-1 text-xs text-green-500" />
                                    Costo:
                                  </span>
                                  <span class="font-semibold text-green-600">{{
                                    calculateModelCost(stat)
                                  }}</span>
                                </div>
                                <div
                                  class="mt-2 border-t border-gray-100 pt-2 dark:border-gray-600"
                                >
                                  <div
                                    class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
                                  >
                                    <span class="flex items-center">
                                      <i class="fas fa-arrow-down mr-1 text-green-500" />
                                      Entrada:
                                    </span>
                                    <span class="font-medium">{{
                                      formatTokenCount(stat.inputTokens)
                                    }}</span>
                                  </div>
                                  <div
                                    class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
                                  >
                                    <span class="flex items-center">
                                      <i class="fas fa-arrow-up mr-1 text-blue-500" />
                                      Salida:
                                    </span>
                                    <span class="font-medium">{{
                                      formatTokenCount(stat.outputTokens)
                                    }}</span>
                                  </div>
                                  <div
                                    v-if="stat.cacheCreateTokens > 0"
                                    class="flex items-center justify-between text-xs text-purple-600"
                                  >
                                    <span class="flex items-center">
                                      <i class="fas fa-save mr-1" />
                                      Caché creac:
                                    </span>
                                    <span class="font-medium">{{
                                      formatTokenCount(stat.cacheCreateTokens)
                                    }}</span>
                                  </div>
                                  <div
                                    v-if="stat.cacheReadTokens > 0"
                                    class="flex items-center justify-between text-xs text-purple-600"
                                  >
                                    <span class="flex items-center">
                                      <i class="fas fa-download mr-1" />
                                      Caché lect:
                                    </span>
                                    <span class="font-medium">{{
                                      formatTokenCount(stat.cacheReadTokens)
                                    }}</span>
                                  </div>
                                </div>
                              </div>

                              <!-- 进度registros -->
                              <div
                                class="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700"
                              >
                                <div
                                  class="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                                  :style="{
                                    width:
                                      calculateApiKeyModelPercentage(
                                        stat.allTokens,
                                        apiKeyModelStats[key.id]
                                      ) + '%'
                                  }"
                                />
                              </div>
                              <div class="mt-1 text-right">
                                <span class="text-xs font-medium text-indigo-600">
                                  {{
                                    calculateApiKeyModelPercentage(
                                      stat.allTokens,
                                      apiKeyModelStats[key.id]
                                    )
                                  }}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <!-- TotalEstadísticas，仅en有数据时显示 -->
                          <div
                            v-if="apiKeyModelStats[key.id] && apiKeyModelStats[key.id].length > 0"
                            class="mt-4 rounded-lg border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-3 dark:border-indigo-700 dark:from-indigo-900/20 dark:to-purple-900/20"
                          >
                            <div class="flex items-center justify-between text-sm">
                              <span
                                class="flex items-center font-semibold text-gray-700 dark:text-gray-300"
                              >
                                <i class="fas fa-calculator mr-2 text-indigo-500" />
                                TotalEstadísticas
                              </span>
                              <div class="flex gap-4 text-xs">
                                <span class="text-gray-600 dark:text-gray-400">
                                  总Solicitud:
                                  <span class="font-semibold text-gray-800 dark:text-gray-200">{{
                                    apiKeyModelStats[key.id].reduce(
                                      (sum, stat) => sum + stat.requests,
                                      0
                                    )
                                  }}</span>
                                </span>
                                <span class="text-gray-600 dark:text-gray-400">
                                  总Token:
                                  <span class="font-semibold text-gray-800 dark:text-gray-200">{{
                                    formatTokenCount(
                                      apiKeyModelStats[key.id].reduce(
                                        (sum, stat) => sum + stat.allTokens,
                                        0
                                      )
                                    )
                                  }}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 移动端卡片视图 -->
          <div v-if="!apiKeysLoading && sortedApiKeys.length > 0" class="space-y-3 md:hidden">
            <div
              v-for="key in paginatedApiKeys"
              :key="key.id"
              class="card p-4 transition-shadow hover:shadow-lg"
            >
              <!-- 卡片头部 -->
              <div class="mb-3 flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <input
                    v-if="shouldShowCheckboxes"
                    v-model="selectedApiKeys"
                    class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    type="checkbox"
                    :value="key.id"
                    @change="updateSelectAllState"
                  />
                  <div>
                    <h4
                      class="cursor-pointer text-sm font-semibold text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                      title="点击Copiar"
                      @click.stop="copyText(key.name)"
                    >
                      {{ key.name }}
                    </h4>
                    <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ key.id }}
                    </p>
                  </div>
                </div>
                <span
                  :class="[
                    'inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold',
                    key.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  ]"
                >
                  <div
                    :class="[
                      'mr-1.5 h-1.5 w-1.5 rounded-full',
                      key.isActive ? 'bg-green-500' : 'bg-red-500'
                    ]"
                  />
                  {{ key.isActive ? '活跃' : '已停用' }}
                </span>
              </div>

              <!-- Cuenta绑定Información -->
              <div class="mb-3 space-y-1.5">
                <!-- Claude 绑定 -->
                <div
                  v-if="key.claudeAccountId || key.claudeConsoleAccountId"
                  class="flex flex-wrap items-center gap-1 text-xs"
                >
                  <span
                    class="inline-flex items-center rounded bg-indigo-100 px-2 py-0.5 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                  >
                    <i class="fas fa-brain mr-1" />
                    Claude
                  </span>
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ getClaudeBindingInfo(key) }}
                  </span>
                </div>
                <!-- Gemini 绑定 -->
                <div v-if="key.geminiAccountId" class="flex flex-wrap items-center gap-1 text-xs">
                  <span
                    class="inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                  >
                    <i class="fas fa-robot mr-1" />
                    Gemini
                  </span>
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ getGeminiBindingInfo(key) }}
                  </span>
                </div>
                <!-- OpenAI 绑定 -->
                <div v-if="key.openaiAccountId" class="flex flex-wrap items-center gap-1 text-xs">
                  <span
                    class="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  >
                    <i class="fa-openai mr-1" />
                    OpenAI
                  </span>
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ getOpenAIBindingInfo(key) }}
                  </span>
                </div>
                <!-- Bedrock 绑定 -->
                <div v-if="key.bedrockAccountId" class="flex flex-wrap items-center gap-1 text-xs">
                  <span
                    class="inline-flex items-center rounded bg-orange-100 px-2 py-0.5 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                  >
                    <i class="fas fa-cloud mr-1" />
                    Bedrock
                  </span>
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ getBedrockBindingInfo(key) }}
                  </span>
                </div>
                <!-- Droid 绑定 -->
                <div v-if="key.droidAccountId" class="flex flex-wrap items-center gap-1 text-xs">
                  <span
                    class="inline-flex items-center rounded bg-cyan-100 px-2 py-0.5 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
                  >
                    <i class="fas fa-robot mr-1" />
                    Droid
                  </span>
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ getDroidBindingInfo(key) }}
                  </span>
                </div>
                <!-- 无绑定时显示共享池 -->
                <div
                  v-if="
                    !key.claudeAccountId &&
                    !key.claudeConsoleAccountId &&
                    !key.geminiAccountId &&
                    !key.openaiAccountId &&
                    !key.bedrockAccountId &&
                    !key.droidAccountId
                  "
                  class="text-xs text-gray-500 dark:text-gray-400"
                >
                  <i class="fas fa-share-alt mr-1" />
                  使用共享池
                </div>
                <!-- 显示所有者Información -->
                <div v-if="isLdapEnabled && key.ownerDisplayName" class="text-xs text-red-600">
                  <i class="fas fa-user mr-1" />
                  {{ key.ownerDisplayName }}
                </div>
              </div>

              <!-- EstadísticasInformación -->
              <div class="mb-3 space-y-2">
                <!-- Hoy使用 -->
                <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                  <div class="mb-2 flex items-center justify-between">
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{
                      globalDateFilter.type === 'custom' ? '累计Estadísticas' : 'Hoy使用'
                    }}</span>
                    <button
                      class="text-xs text-blue-600 hover:text-blue-800"
                      @click="showUsageDetails(key)"
                    >
                      <i class="fas fa-chart-line mr-1" />Detalles
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <!-- Solicitud数 - 使用CachéEstadísticas -->
                      <template v-if="isStatsLoading(key.id)">
                        <div
                          class="h-5 w-12 animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                        />
                      </template>
                      <template v-else-if="getCachedStats(key.id)">
                        <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {{ formatNumber(getCachedStats(key.id).requests || 0) }} veces
                        </p>
                      </template>
                      <template v-else>
                        <p class="text-sm font-semibold text-gray-400">-</p>
                      </template>
                      <p class="text-xs text-gray-500 dark:text-gray-400">Solicitud</p>
                    </div>
                    <div>
                      <!-- Costo - 使用CachéEstadísticas -->
                      <template v-if="isStatsLoading(key.id)">
                        <div
                          class="h-5 w-14 animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                        />
                      </template>
                      <template v-else-if="getCachedStats(key.id)">
                        <p class="text-sm font-semibold text-green-600">
                          {{ getCachedStats(key.id).formattedCost || '$0.00' }}
                        </p>
                      </template>
                      <template v-else>
                        <p class="text-sm font-semibold text-gray-400">-</p>
                      </template>
                      <p class="text-xs text-gray-500 dark:text-gray-400">Costo</p>
                    </div>
                  </div>
                  <div class="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <div class="flex items-center justify-between">
                      <span>最siguiente使用</span>
                      <span class="font-medium text-gray-700 dark:text-gray-300">
                        {{ key.lastUsedAt ? formatLastUsed(key.lastUsedAt) : 'de未使用' }}
                      </span>
                    </div>
                    <div class="mt-1 flex items-center justify-between">
                      <span>账号</span>
                      <!-- 最siguiente使用账号 loading Estado -->
                      <span
                        v-if="key.lastUsedAt && isLastUsageLoading(key.id)"
                        class="text-gray-400 dark:text-gray-500"
                      >
                        <i class="fas fa-spinner fa-spin mr-1"></i>
                        Cargando...
                      </span>
                      <span
                        v-else-if="hasLastUsageAccount(key)"
                        class="truncate text-gray-500 dark:text-gray-400"
                        style="max-width: 180px"
                        :title="getLastUsageFullName(key)"
                      >
                        {{ getLastUsageDisplayName(key) }}
                        <span
                          v-if="!isLastUsageDeleted(key)"
                          class="ml-1 text-gray-400 dark:text-gray-500"
                        >
                          ({{ getLastUsageTypeLabel(key) }})
                        </span>
                      </span>
                      <span v-else class="text-gray-400 dark:text-gray-500">Sin使用账号</span>
                    </div>
                  </div>
                </div>

                <!-- Límite进度registros -->
                <div class="space-y-2">
                  <!-- CargandoEstado - 骨架屏（仅en有CostoConfiguración de límites时显示） -->
                  <template
                    v-if="
                      isStatsLoading(key.id) &&
                      (key.dailyCostLimit > 0 ||
                        key.totalCostLimit > 0 ||
                        (key.rateLimitWindow > 0 && key.rateLimitCost > 0))
                    "
                  >
                    <div class="space-y-2">
                      <div
                        class="h-4 w-full animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                      />
                      <div
                        class="h-3 w-2/3 animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                      />
                    </div>
                  </template>
                  <!-- 已加载Estado -->
                  <template v-else>
                    <!-- Límite de costo diario -->
                    <LimitProgressBar
                      v-if="key.dailyCostLimit > 0"
                      :current="getCachedStats(key.id)?.dailyCost || 0"
                      label="每日Límite"
                      :limit="key.dailyCostLimit"
                      type="daily"
                      variant="compact"
                    />

                    <!-- Límite de costo total（无每日Límite时展示） -->
                    <LimitProgressBar
                      v-else-if="key.totalCostLimit > 0"
                      :current="getCachedStats(key.id)?.allTimeCost || 0"
                      label="Límite de costo total"
                      :limit="key.totalCostLimit"
                      type="total"
                      variant="compact"
                    />

                    <!-- 时间窗口CostoLímite（无每日yLímite de costo total时展示） -->
                    <div
                      v-else-if="
                        key.rateLimitWindow > 0 &&
                        key.rateLimitCost > 0 &&
                        (!key.dailyCostLimit || key.dailyCostLimit === 0) &&
                        (!key.totalCostLimit || key.totalCostLimit === 0)
                      "
                      class="space-y-2"
                    >
                      <!-- Costo进度registros -->
                      <LimitProgressBar
                        :current="getCachedStats(key.id)?.currentWindowCost || 0"
                        label="窗口Costo"
                        :limit="key.rateLimitCost"
                        type="window"
                        variant="compact"
                      />
                      <!-- Restablecer倒计时 -->
                      <div class="flex items-center justify-between text-xs">
                        <div class="flex items-center gap-1.5 text-sky-600 dark:text-sky-300">
                          <i class="fas fa-clock text-xs" />
                          <span class="font-medium">{{ key.rateLimitWindow }}分钟窗口</span>
                        </div>
                        <span
                          class="font-bold"
                          :class="
                            (getCachedStats(key.id)?.windowRemainingSeconds || 0) > 0
                              ? 'text-sky-700 dark:text-sky-300'
                              : 'text-gray-400 dark:text-gray-500'
                          "
                        >
                          {{
                            (getCachedStats(key.id)?.windowRemainingSeconds || 0) > 0
                              ? formatWindowTime(
                                  getCachedStats(key.id)?.windowRemainingSeconds || 0
                                )
                              : '未激活'
                          }}
                        </span>
                      </div>
                    </div>

                    <!-- 无Límite显示 -->
                    <div
                      v-else
                      class="flex items-center justify-center gap-1.5 py-2 text-gray-500 dark:text-gray-400"
                    >
                      <i class="fas fa-infinity text-base" />
                      <span class="text-xs font-medium">无Límite</span>
                    </div>
                  </template>
                </div>
              </div>

              <!-- 时间Información -->
              <div class="mb-3 text-xs text-gray-500 dark:text-gray-400">
                <div class="mb-1 flex justify-between">
                  <span>Crear时间</span>
                  <span>{{ formatDate(key.createdAt) }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>过期时间</span>
                  <div class="flex items-center gap-1">
                    <span
                      :class="
                        isApiKeyExpiringSoon(key.expiresAt) ? 'font-semibold text-orange-600' : ''
                      "
                    >
                      {{ key.expiresAt ? formatDate(key.expiresAt) : '永不过期' }}
                    </span>
                    <button
                      class="inline-flex h-5 w-5 items-center justify-center rounded text-gray-300 transition-all duration-200 hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/20"
                      title="Editar过期时间"
                      @click.stop="startEditExpiry(key)"
                    >
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Etiqueta -->
              <div v-if="key.tags && key.tags.length > 0" class="mb-3 flex flex-wrap gap-1">
                <span
                  v-for="tag in key.tags"
                  :key="tag"
                  class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {{ tag }}
                </span>
              </div>

              <!-- Operación按钮 -->
              <div class="mt-3 flex gap-2 border-t border-gray-100 pt-3 dark:border-gray-600">
                <button
                  class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                  @click="showUsageDetails(key)"
                >
                  <i class="fas fa-chart-line" />
                  VerDetalles
                </button>
                <button
                  class="flex-1 rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  @click="openEditApiKeyModal(key)"
                >
                  <i class="fas fa-edit mr-1" />
                  Editar
                </button>
                <button
                  v-if="
                    key.expiresAt &&
                    (isApiKeyExpired(key.expiresAt) || isApiKeyExpiringSoon(key.expiresAt))
                  "
                  class="flex-1 rounded-lg bg-orange-50 px-3 py-1.5 text-xs text-orange-600 transition-colors hover:bg-orange-100 dark:bg-orange-900/30 dark:hover:bg-orange-900/50"
                  @click="openRenewApiKeyModal(key)"
                >
                  <i class="fas fa-clock mr-1" />
                  续期
                </button>
                <button
                  :class="[
                    key.isActive
                      ? 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/30 dark:hover:bg-orange-900/50'
                      : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50',
                    'rounded-lg px-3 py-1.5 text-xs transition-colors'
                  ]"
                  @click="toggleApiKeyStatus(key)"
                >
                  <i :class="['fas', key.isActive ? 'fa-ban' : 'fa-check-circle', 'mr-1']" />
                  {{ key.isActive ? 'Deshabilitar' : '激活' }}
                </button>
                <button
                  class="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50"
                  @click="deleteApiKey(key.id)"
                >
                  <i class="fas fa-trash" />
                </button>
              </div>
            </div>
          </div>

          <!-- 分页组件 -->
          <div
            v-if="sortedApiKeys.length > 0"
            class="mt-4 flex flex-col items-center justify-between gap-4 sm:mt-6 sm:flex-row"
          >
            <div class="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <span class="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
                共 {{ sortedApiKeys.length }} registros
              </span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">每页显示</span>
                <select
                  v-model="pageSize"
                  class="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 transition-colors hover:border-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 sm:text-sm"
                >
                  <option v-for="size in pageSizeOptions" :key="size" :value="size">
                    {{ size }}
                  </option>
                </select>
                <span class="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">registros</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- arriba一页 -->
              <button
                class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:py-1 sm:text-sm"
                :disabled="currentPage === 1"
                @click="currentPage--"
              >
                <i class="fas fa-chevron-left" />
              </button>

              <!-- 页码 -->
              <div class="flex items-center gap-1">
                <!-- 第一页 -->
                <button
                  v-if="shouldShowFirstPage"
                  class="hidden rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:block"
                  @click="currentPage = 1"
                >
                  1
                </button>
                <span
                  v-if="showLeadingEllipsis"
                  class="hidden px-2 text-gray-500 dark:text-gray-400 sm:inline"
                  >...</span
                >

                <!-- en间页码 -->
                <button
                  v-for="page in pageNumbers"
                  :key="page"
                  :class="[
                    'rounded-md px-2 py-1 text-xs font-medium sm:px-3 sm:text-sm',
                    page === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  ]"
                  @click="currentPage = page"
                >
                  {{ page }}
                </button>

                <!-- 最siguiente一页 -->
                <span
                  v-if="showTrailingEllipsis"
                  class="hidden px-2 text-gray-500 dark:text-gray-400 sm:inline"
                  >...</span
                >
                <button
                  v-if="shouldShowLastPage"
                  class="hidden rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:block"
                  @click="currentPage = totalPages"
                >
                  {{ totalPages }}
                </button>
              </div>

              <!-- abajo一页 -->
              <button
                class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:py-1 sm:text-sm"
                :disabled="currentPage === totalPages || totalPages === 0"
                @click="currentPage++"
              >
                <i class="fas fa-chevron-right" />
              </button>
            </div>
          </div>
        </div>

        <!-- 已Eliminar API Keys Tab Panel -->
        <div v-else-if="activeTab === 'deleted'" class="tab-panel">
          <div v-if="deletedApiKeysLoading" class="py-12 text-center">
            <div class="loading-spinner mx-auto mb-4" />
            <p class="text-gray-500 dark:text-gray-400">正en加载已Eliminar API Keys...</p>
          </div>

          <div v-else-if="deletedApiKeys.length === 0" class="py-12 text-center">
            <div
              class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
            >
              <i class="fas fa-trash text-xl text-gray-400" />
            </div>
            <p class="text-lg text-gray-500 dark:text-gray-400">Sin已Eliminar API Keys</p>
            <p class="mt-2 text-sm text-gray-400">已Eliminar API Keys 会出现en这里</p>
          </div>

          <!-- 已Eliminar API Keys 表格 -->
          <div v-else>
            <!-- 工具栏 -->
            <div class="mb-4 flex justify-end">
              <button
                v-if="deletedApiKeys.length > 0"
                class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                @click="clearAllDeletedApiKeys"
              >
                <i class="fas fa-trash-alt mr-2" />
                清空所有已Eliminar ({{ deletedApiKeys.length }})
              </button>
            </div>

            <div class="table-wrapper">
              <div class="table-container">
                <table class="w-full">
                  <thead
                    class="sticky top-0 z-10 bg-gradient-to-b from-gray-50 to-gray-100/90 backdrop-blur-sm dark:from-gray-700 dark:to-gray-800/90"
                  >
                    <tr>
                      <th
                        class="name-column sticky left-0 z-20 min-w-[140px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        Nombre
                      </th>
                      <th
                        class="min-w-[140px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        所属账号
                      </th>
                      <th
                        v-if="isLdapEnabled"
                        class="min-w-[120px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        Crear者
                      </th>
                      <th
                        class="min-w-[120px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        Crear时间
                      </th>
                      <th
                        class="min-w-[100px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        Eliminar者
                      </th>
                      <th
                        class="min-w-[100px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        Eliminar时间
                      </th>
                      <th
                        class="min-w-[70px] px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        Costo
                      </th>
                      <th
                        class="min-w-[80px] px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        Token
                      </th>
                      <th
                        class="min-w-[80px] px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        Solicitud数
                      </th>
                      <th
                        class="min-w-[100px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        最siguiente使用
                      </th>
                      <th
                        class="operations-column sticky right-0 min-w-[140px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                      >
                        Operación
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200/50 dark:divide-gray-600/50">
                    <tr v-for="key in deletedApiKeys" :key="key.id" class="table-row">
                      <td class="name-column sticky left-0 z-10 px-3 py-3">
                        <div class="flex items-center">
                          <div
                            class="mr-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600"
                          >
                            <i class="fas fa-trash text-[10px] text-white" />
                          </div>
                          <div class="min-w-0">
                            <div
                              class="cursor-pointer truncate text-sm font-semibold text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                              title="点击Copiar"
                              @click.stop="copyText(key.name)"
                            >
                              {{ key.name }}
                            </div>
                          </div>
                        </div>
                      </td>
                      <!-- 所属账号 -->
                      <td class="px-3 py-3">
                        <div class="space-y-1">
                          <!-- Claude OAuth 绑定 -->
                          <div v-if="key.claudeAccountId" class="flex items-center gap-1 text-xs">
                            <span
                              class="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                              <i class="fas fa-robot mr-1 text-[10px]" />
                              Claude OAuth
                            </span>
                          </div>
                          <!-- Claude Console 绑定 -->
                          <div
                            v-else-if="key.claudeConsoleAccountId"
                            class="flex items-center gap-1 text-xs"
                          >
                            <span
                              class="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            >
                              <i class="fas fa-terminal mr-1 text-[10px]" />
                              Claude Console
                            </span>
                          </div>
                          <!-- Gemini 绑定 -->
                          <div
                            v-else-if="key.geminiAccountId"
                            class="flex items-center gap-1 text-xs"
                          >
                            <span
                              class="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                            >
                              <i class="fa-google mr-1 text-[10px]" />
                              Gemini
                            </span>
                          </div>
                          <!-- 共享池 -->
                          <div v-else class="text-xs text-gray-500 dark:text-gray-400">
                            <i class="fas fa-share-alt mr-1" />
                            共享池
                          </div>
                        </div>
                      </td>
                      <!-- Crear者 -->
                      <td v-if="isLdapEnabled" class="px-3 py-3">
                        <div class="text-xs">
                          <span v-if="key.createdBy === 'admin'" class="text-blue-600">
                            <i class="fas fa-user-shield mr-1 text-xs" />
                            Administrador
                          </span>
                          <span v-else-if="key.userUsername" class="text-green-600">
                            <i class="fas fa-user mr-1 text-xs" />
                            {{ key.userUsername }}
                          </span>
                          <span v-else class="text-gray-500 dark:text-gray-400">
                            <i class="fas fa-question-circle mr-1 text-xs" />
                            Desconocido
                          </span>
                        </div>
                      </td>
                      <!-- Crear时间 -->
                      <td
                        class="whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-300"
                        style="font-size: 13px"
                      >
                        {{ formatDate(key.createdAt) }}
                      </td>
                      <!-- Eliminar者 -->
                      <td class="px-3 py-3">
                        <div class="text-xs">
                          <span v-if="key.deletedByType === 'admin'" class="text-blue-600">
                            <i class="fas fa-user-shield mr-1 text-xs" />
                            {{ key.deletedBy }}
                          </span>
                          <span v-else-if="key.deletedByType === 'user'" class="text-green-600">
                            <i class="fas fa-user mr-1 text-xs" />
                            {{ key.deletedBy }}
                          </span>
                          <span v-else class="text-gray-500 dark:text-gray-400">
                            <i class="fas fa-cog mr-1 text-xs" />
                            {{ key.deletedBy }}
                          </span>
                        </div>
                      </td>
                      <!-- Eliminar时间 -->
                      <td
                        class="whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-300"
                        style="font-size: 13px"
                      >
                        {{ formatDate(key.deletedAt) }}
                      </td>
                      <!-- Costo -->
                      <td class="whitespace-nowrap px-3 py-3 text-right" style="font-size: 13px">
                        <span
                          class="font-medium text-blue-600 dark:text-blue-400"
                          style="font-size: 13px"
                        >
                          ${{ (key.usage?.total?.cost || 0).toFixed(2) }}
                        </span>
                      </td>
                      <!-- Token -->
                      <td class="whitespace-nowrap px-3 py-3 text-right" style="font-size: 13px">
                        <span
                          class="font-medium text-purple-600 dark:text-purple-400"
                          style="font-size: 13px"
                        >
                          {{ formatTokenCount(key.usage?.total?.tokens || 0) }}
                        </span>
                      </td>
                      <!-- Solicitud数 -->
                      <td class="whitespace-nowrap px-3 py-3 text-right" style="font-size: 13px">
                        <div class="flex items-center justify-end gap-1">
                          <span
                            class="font-medium text-gray-900 dark:text-gray-100"
                            style="font-size: 13px"
                          >
                            {{ formatNumber(key.usage?.total?.requests || 0) }}
                          </span>
                          <span class="text-xs text-gray-500">veces</span>
                        </div>
                      </td>
                      <!-- 最siguiente使用 -->
                      <td
                        class="whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-300"
                        style="font-size: 13px"
                      >
                        <div class="flex flex-col leading-tight">
                          <span
                            v-if="key.lastUsedAt"
                            class="cursor-help"
                            style="font-size: 13px"
                            :title="new Date(key.lastUsedAt).toLocaleString('zh-CN')"
                          >
                            {{ formatLastUsed(key.lastUsedAt) }}
                          </span>
                          <span v-else class="text-gray-400" style="font-size: 13px">de未使用</span>
                          <!-- 最siguiente使用账号 loading Estado -->
                          <span
                            v-if="key.lastUsedAt && isLastUsageLoading(key.id)"
                            class="mt-1 text-xs text-gray-400 dark:text-gray-500"
                          >
                            <i class="fas fa-spinner fa-spin mr-1"></i>
                            Cargando...
                          </span>
                          <span
                            v-else-if="hasLastUsageAccount(key)"
                            class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                            :title="getLastUsageFullName(key)"
                          >
                            {{ getLastUsageDisplayName(key) }}
                            <span
                              v-if="!isLastUsageDeleted(key)"
                              class="ml-1 text-gray-400 dark:text-gray-500"
                            >
                              ({{ getLastUsageTypeLabel(key) }})
                            </span>
                          </span>
                          <span v-else class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Sin使用账号
                          </span>
                        </div>
                      </td>
                      <td class="operations-column operations-cell px-3 py-3">
                        <div class="flex items-center gap-2">
                          <button
                            v-if="key.canRestore"
                            class="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                            title="恢复 API Key"
                            @click="restoreApiKey(key.id)"
                          >
                            <i class="fas fa-undo mr-1" />
                            恢复
                          </button>
                          <button
                            class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                            title="彻底Eliminar API Key"
                            @click="permanentDeleteApiKey(key.id)"
                          >
                            <i class="fas fa-times mr-1" />
                            彻底Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 模态框组件 -->
    <CreateApiKeyModal
      v-if="showCreateApiKeyModal"
      :accounts="accounts"
      @batch-success="handleBatchCreateSuccess"
      @close="showCreateApiKeyModal = false"
      @success="handleCreateSuccess"
    />

    <EditApiKeyModal
      v-if="showEditApiKeyModal"
      :accounts="accounts"
      :api-key="editingApiKey"
      @close="showEditApiKeyModal = false"
      @success="handleEditSuccess"
    />

    <RenewApiKeyModal
      v-if="showRenewApiKeyModal"
      :api-key="renewingApiKey"
      @close="showRenewApiKeyModal = false"
      @success="handleRenewSuccess"
    />

    <NewApiKeyModal
      v-if="showNewApiKeyModal"
      :api-key="newApiKeyData"
      @close="showNewApiKeyModal = false"
    />

    <BatchApiKeyModal
      v-if="showBatchApiKeyModal"
      :api-keys="batchApiKeyData"
      @close="showBatchApiKeyModal = false"
    />

    <BatchEditApiKeyModal
      v-if="showBatchEditModal"
      :accounts="accounts"
      :selected-keys="selectedApiKeys"
      @close="showBatchEditModal = false"
      @success="handleBatchEditSuccess"
    />

    <!-- 过期时间Editar弹窗 -->
    <ExpiryEditModal
      ref="expiryEditModalRef"
      :api-key="editingExpiryKey || { id: null, expiresAt: null, name: '' }"
      :show="!!editingExpiryKey"
      @close="closeExpiryEdit"
      @save="handleSaveExpiry"
    />

    <UsageDetailModal
      :api-key="selectedApiKeyForDetail || {}"
      :show="showUsageDetailModal"
      @close="showUsageDetailModal = false"
      @open-timeline="openTimeline"
    />

    <TagManagementModal
      :show="showTagManagementModal"
      @close="showTagManagementModal = false"
      @updated="loadApiKeys"
    />

    <ConfirmModal
      :cancel-text="confirmModalConfig.cancelText"
      :confirm-text="confirmModalConfig.confirmText"
      :message="confirmModalConfig.message"
      :show="showConfirmModal"
      :title="confirmModalConfig.title"
      :type="confirmModalConfig.type"
      @cancel="handleCancel"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, copyText, formatNumber, formatDate } from '@/utils/tools'

import * as httpApis from '@/utils/http_apis'
import { useAuthStore } from '@/stores/auth'
import * as XLSX from 'xlsx-js-style'
import CreateApiKeyModal from '@/components/apikeys/CreateApiKeyModal.vue'
import EditApiKeyModal from '@/components/apikeys/EditApiKeyModal.vue'
import RenewApiKeyModal from '@/components/apikeys/RenewApiKeyModal.vue'
import NewApiKeyModal from '@/components/apikeys/NewApiKeyModal.vue'
import BatchApiKeyModal from '@/components/apikeys/BatchApiKeyModal.vue'
import BatchEditApiKeyModal from '@/components/apikeys/BatchEditApiKeyModal.vue'
import ExpiryEditModal from '@/components/apikeys/ExpiryEditModal.vue'
import UsageDetailModal from '@/components/apikeys/UsageDetailModal.vue'
import TagManagementModal from '@/components/apikeys/TagManagementModal.vue'
import LimitProgressBar from '@/components/apikeys/LimitProgressBar.vue'
import CustomDropdown from '@/components/common/CustomDropdown.vue'
import ActionDropdown from '@/components/common/ActionDropdown.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

// 响应式数据
const router = useRouter()
const authStore = useAuthStore()
const apiKeys = ref([])

// 获取 LDAP HabilitarEstado
const isLdapEnabled = computed(() => authStore.oemSettings?.ldapEnabled || false)

// 多选相关Estado
const selectedApiKeys = ref([])
const selectAllChecked = ref(false)
const isIndeterminate = ref(false)
const showCheckboxes = ref(false)
const apiKeysLoading = ref(false)
const apiKeyStatsTimeRange = ref('today')

// Global日期Filtrar器
const globalDateFilter = reactive({
  type: 'preset',
  preset: 'today',
  customStart: '',
  customEnd: '',
  customRange: null
})

// 是否应该显示多选框
const shouldShowCheckboxes = computed(() => {
  return showCheckboxes.value
})

// 切换选择模式
const toggleSelectionMode = () => {
  showCheckboxes.value = !showCheckboxes.value
  // Cerrar选择模式时清空已选项
  if (!showCheckboxes.value) {
    selectedApiKeys.value = []
    selectAllChecked.value = false
    isIndeterminate.value = false
  }
}

// Rango de tiempoabajo拉选项
const timeRangeDropdownOptions = computed(() => [
  { value: 'today', label: 'Hoy', icon: 'fa-calendar-day' },
  { value: '7days', label: '最近7天', icon: 'fa-calendar-week' },
  { value: '30days', label: '最近30天', icon: 'fa-calendar-alt' },
  { value: 'all', label: '全部时间', icon: 'fa-infinity' },
  { value: 'custom', label: '自定义范围', icon: 'fa-calendar-check' }
])

// Tab management
const activeTab = ref('active')
const deletedApiKeys = ref([])
const deletedApiKeysLoading = ref(false)
const apiKeysSortBy = ref('createdAt') // 默认OrdenarparaCrear时间
const apiKeysSortOrder = ref('desc')
const expandedApiKeys = ref({})

// CostoOrdenar相关Estado
const costSortStatus = ref({}) // 各Rango de tiempo索引Estado

// siguiente端分页相关Estado
const serverPagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
})

// Datos estadísticosCaché: Map<keyId, { stats, timeRange, timestamp }>
const statsCache = ref(new Map())
// 正en加载Estadísticas keyIds
const statsLoading = ref(new Set())
// 最siguiente使用账号Caché: Map<keyId, lastUsageInfo>
const lastUsageCache = ref(new Map())
// 正en加载最siguiente使用账号 keyIds
const lastUsageLoading = ref(new Set())
const apiKeyModelStats = ref({})
const apiKeyDateFilters = ref({})
const defaultTime = ref([new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 2, 1, 23, 59, 59)])
const accounts = ref({
  claude: [],
  gemini: [],
  geminiApi: [], // 添加 Gemini-API 账号列表（para传递给子组件初始化）
  openai: [],
  openaiResponses: [], // 添加 OpenAI-Responses 账号列表
  bedrock: [],
  droid: [],
  claudeGroups: [],
  geminiGroups: [],
  openaiGroups: [],
  droidGroups: []
})
// 账号数据加载Estado
const accountsLoading = ref(false)
const accountsLoaded = ref(false)
const editingExpiryKey = ref(null)
const expiryEditModalRef = ref(null)
const showUsageDetailModal = ref(false)
const selectedApiKeyForDetail = ref(null)

// Etiqueta相关
const selectedTagFilter = ref('')
const availableTags = ref([])

// ModeloFiltrar相关
const selectedModels = ref([])
const availableModels = ref([])

// Buscar相关
const searchKeyword = ref('')
const searchMode = ref('apiKey')
const searchModeOptions = computed(() => [
  { value: 'apiKey', label: '按KeyNombre', icon: 'fa-key' },
  { value: 'bindingAccount', label: '按所属账号', icon: 'fa-id-badge' }
])

const tagOptions = computed(() => {
  const options = [{ value: '', label: '所有Etiqueta', icon: 'fa-asterisk' }]
  availableTags.value.forEach((tag) => {
    options.push({ value: tag, label: tag, icon: 'fa-tag' })
  })
  return options
})

const modelOptions = computed(() => {
  return availableModels.value.map((model) => ({
    value: model,
    label: model,
    icon: 'fa-cube'
  }))
})

const selectedTagCount = computed(() => {
  if (!selectedTagFilter.value) return 0
  return apiKeys.value.filter((key) => key.tags && key.tags.includes(selectedTagFilter.value))
    .length
})

// 分页相关
const currentPage = ref(1)
// de localStorage 读取Guardar每页显示registros数，默认para 10
const getInitialPageSize = () => {
  const saved = localStorage.getItem('apiKeysPageSize')
  if (saved) {
    const parsedSize = parseInt(saved, 10)
    // 验证Guardar值是否en允许选项en
    if ([10, 20, 50, 100].includes(parsedSize)) {
      return parsedSize
    }
  }
  return 10
}
const pageSize = ref(getInitialPageSize())
const pageSizeOptions = [10, 20, 50, 100]

// 模态框Estado
const showCreateApiKeyModal = ref(false)
const showEditApiKeyModal = ref(false)
const showRenewApiKeyModal = ref(false)
const showNewApiKeyModal = ref(false)
const showBatchApiKeyModal = ref(false)
const showBatchEditModal = ref(false)
const showTagManagementModal = ref(false)
const editingApiKey = ref(null)
const renewingApiKey = ref(null)
const newApiKeyData = ref(null)
const batchApiKeyData = ref([])

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
const handleConfirm = () => {
  showConfirmModal.value = false
  confirmResolve.value?.(true)
}
const handleCancel = () => {
  showConfirmModal.value = false
  confirmResolve.value?.(false)
}

// 计算OrdenarsiguienteAPI Keys（现en由siguiente端处理，这里直接返回）
const sortedApiKeys = computed(() => {
  // siguiente端已经处理Filtrar、BuscaryOrdenar，直接返回
  return apiKeys.value
})

// 计算总页数（使用siguiente端分页Información）
const totalPages = computed(() => {
  return serverPagination.value.totalPages || 0
})

// 计算显示页码数组
const pageNumbers = computed(() => {
  const pages = []
  const current = currentPage.value
  const total = totalPages.value

  if (total <= 7) {
    // 如果总页数小于等于7，显示所有页码
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    // 如果总页数大于7，显示部分页码
    let start = Math.max(1, current - 2)
    let end = Math.min(total, current + 2)

    // 调整起始y结束页码
    if (current <= 3) {
      end = 5
    } else if (current >= total - 2) {
      start = total - 4
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
  }

  return pages
})

const shouldShowFirstPage = computed(() => {
  const pages = pageNumbers.value
  if (pages.length === 0) return false
  return pages[0] > 1
})

const shouldShowLastPage = computed(() => {
  const pages = pageNumbers.value
  if (pages.length === 0) return false
  return pages[pages.length - 1] < totalPages.value
})

const showLeadingEllipsis = computed(() => {
  const pages = pageNumbers.value
  if (pages.length === 0) return false
  return shouldShowFirstPage.value && pages[0] > 2
})

const showTrailingEllipsis = computed(() => {
  const pages = pageNumbers.value
  if (pages.length === 0) return false
  return shouldShowLastPage.value && pages[pages.length - 1] < totalPages.value - 1
})

// 获取分页siguiente数据（现en由siguiente端处理，直接返回当anterior数据）
const paginatedApiKeys = computed(() => {
  // siguiente端已经分页，直接返回
  return apiKeys.value
})

// 加载Cuenta列表（支持Cachéy强制Actualizar）
const loadAccounts = async (forceRefresh = false) => {
  // 如果已加载且不强制Actualizar，则跳过
  if (accountsLoaded.value && !forceRefresh) {
    return
  }

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
          isDedicated: account.accountType === 'dedicated'
        })
      })
    }

    if (claudeConsoleData.success) {
      claudeConsoleData.data?.forEach((account) => {
        claudeAccounts.push({
          ...account,
          platform: 'claude-console',
          isDedicated: account.accountType === 'dedicated'
        })
      })
    }

    accounts.value.claude = claudeAccounts

    // 合并 Gemini OAuth y Gemini API Cuenta
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
      // Guardar原始 Gemini-API 账号列表供子组件初始化使用
      accounts.value.geminiApi = (geminiApiData.data || []).map((account) => ({
        ...account,
        platform: 'gemini-api',
        isDedicated: account.accountType === 'dedicated'
      }))
      // 同时添加到合并列表
      accounts.value.geminiApi.forEach((account) => {
        geminiAccounts.push(account)
      })
    }

    accounts.value.gemini = geminiAccounts

    if (openaiData.success) {
      accounts.value.openai = (openaiData.data || []).map((account) => ({
        ...account,
        isDedicated: account.accountType === 'dedicated'
      }))
    }

    if (openaiResponsesData.success) {
      accounts.value.openaiResponses = (openaiResponsesData.data || []).map((account) => ({
        ...account,
        isDedicated: account.accountType === 'dedicated'
      }))
    }

    if (bedrockData.success) {
      accounts.value.bedrock = (bedrockData.data || []).map((account) => ({
        ...account,
        isDedicated: account.accountType === 'dedicated'
      }))
    }

    if (droidData.success) {
      accounts.value.droid = (droidData.data || []).map((account) => ({
        ...account,
        platform: 'droid',
        isDedicated: account.accountType === 'dedicated'
      }))
    }

    if (groupsData.success) {
      // 处理分组数据
      const allGroups = groupsData.data || []
      accounts.value.claudeGroups = allGroups.filter((g) => g.platform === 'claude')
      accounts.value.geminiGroups = allGroups.filter((g) => g.platform === 'gemini')
      accounts.value.openaiGroups = allGroups.filter((g) => g.platform === 'openai')
      accounts.value.droidGroups = allGroups.filter((g) => g.platform === 'droid')
    }

    // 标记账号数据已加载
    accountsLoaded.value = true
  } catch {
    // 静默处理Error
  } finally {
    accountsLoading.value = false
  }
}

// 加载已使用Modelo列表
const loadUsedModels = async () => {
  try {
    const data = await httpApis.getApiKeyUsedModelsApi()
    if (data.success) {
      availableModels.value = data.data || []
    }
  } catch (error) {
    console.error('Failed to load used models:', error)
  }
}

// 加载API Keys（使用siguiente端分页）
const loadApiKeys = async (clearStatsCache = true) => {
  apiKeysLoading.value = true
  try {
    // 清除Caché（Actualizar时）
    if (clearStatsCache) {
      statsCache.value.clear()
      lastUsageCache.value.clear()
    }

    // 构建Solicitud参数
    const params = new URLSearchParams()

    // 分页参数
    params.set('page', currentPage.value.toString())
    params.set('pageSize', pageSize.value.toString())

    // Buscar参数
    params.set('searchMode', searchMode.value)
    if (searchKeyword.value) {
      params.set('search', searchKeyword.value)
    }

    // Filtrar参数
    if (selectedTagFilter.value) {
      params.set('tag', selectedTagFilter.value)
    }

    // ModeloFiltrar参数
    if (selectedModels.value.length > 0) {
      params.set('models', selectedModels.value.join(','))
    }

    // Ordenar参数（支持CostoOrdenar）
    const validSortFields = [
      'name',
      'createdAt',
      'expiresAt',
      'lastUsedAt',
      'isActive',
      'status',
      'cost'
    ]
    const effectiveSortBy = validSortFields.includes(apiKeysSortBy.value)
      ? apiKeysSortBy.value
      : 'createdAt'
    params.set('sortBy', effectiveSortBy)
    params.set('sortOrder', apiKeysSortOrder.value)

    // 如果是CostoOrdenar，添加Costo相关参数
    if (effectiveSortBy === 'cost') {
      if (
        globalDateFilter.type === 'custom' &&
        globalDateFilter.customStart &&
        globalDateFilter.customEnd
      ) {
        params.set('costTimeRange', 'custom')
        params.set('costStartDate', globalDateFilter.customStart)
        params.set('costEndDate', globalDateFilter.customEnd)
      } else {
        // 使用当anteriorRango de tiempo预设
        params.set('costTimeRange', globalDateFilter.preset || '7days')
      }
    }

    // Rango de tiempo（para标记，不paraCosto计算）
    if (
      globalDateFilter.type === 'custom' &&
      globalDateFilter.customStart &&
      globalDateFilter.customEnd
    ) {
      params.set('startDate', globalDateFilter.customStart)
      params.set('endDate', globalDateFilter.customEnd)
      params.set('timeRange', 'custom')
    } else if (globalDateFilter.preset === 'all') {
      params.set('timeRange', 'all')
    } else {
      params.set('timeRange', globalDateFilter.preset)
    }

    const data = await httpApis.getApiKeysWithParamsApi(params.toString())
    if (data.success) {
      // Actualizar数据
      apiKeys.value = data.data?.items || []

      // Actualizar分页Información
      if (data.data?.pagination) {
        serverPagination.value = data.data.pagination
        // 同步当anterior页码（处理页面超出范围情况）
        if (
          currentPage.value > serverPagination.value.totalPages &&
          serverPagination.value.totalPages > 0
        ) {
          currentPage.value = serverPagination.value.totalPages
        }
      }

      // Actualizar可用Etiqueta列表
      if (data.data?.availableTags) {
        availableTags.value = data.data.availableTags
      }

      // 异步加载当anterior页Datos estadísticos（不等待，让页面先显示基础数据）
      loadPageStats()
      // 异步加载当anterior页最siguiente使用账号数据
      loadPageLastUsage()
    }
  } catch {
    showToast('加载 API Keys Fallido', 'error')
  } finally {
    apiKeysLoading.value = false
  }
}

// 异步加载当anterior页Datos estadísticos
const loadPageStats = async () => {
  const currentPageKeys = apiKeys.value
  if (!currentPageKeys || currentPageKeys.length === 0) return

  // 获取当anteriorRango de tiempo
  let currentTimeRange = globalDateFilter.preset
  let startDate = null
  let endDate = null

  if (
    globalDateFilter.type === 'custom' &&
    globalDateFilter.customStart &&
    globalDateFilter.customEnd
  ) {
    currentTimeRange = 'custom'
    startDate = globalDateFilter.customStart
    endDate = globalDateFilter.customEnd
  }

  // Filtrar出需要加载 keys（未CachéoRango de tiempo变化）
  const keysNeedStats = currentPageKeys.filter((key) => {
    const cached = statsCache.value.get(key.id)
    if (!cached) return true
    if (cached.timeRange !== currentTimeRange) return true
    if (currentTimeRange === 'custom') {
      if (cached.startDate !== startDate || cached.endDate !== endDate) return true
    }
    return false
  })

  if (keysNeedStats.length === 0) return

  // 标记paraCargando
  const keyIds = keysNeedStats.map((k) => k.id)
  keyIds.forEach((id) => statsLoading.value.add(id))

  try {
    const requestBody = {
      keyIds,
      timeRange: currentTimeRange
    }
    if (currentTimeRange === 'custom') {
      requestBody.startDate = startDate
      requestBody.endDate = endDate
    }

    const response = await httpApis.getApiKeysBatchStatsApi(requestBody)

    if (response.success && response.data) {
      // ActualizarCaché
      for (const [keyId, stats] of Object.entries(response.data)) {
        statsCache.value.set(keyId, {
          stats,
          timeRange: currentTimeRange,
          startDate,
          endDate,
          timestamp: Date.now()
        })
      }
    }
  } catch (error) {
    console.error('加载Datos estadísticosFallido:', error)
    // 不显示 toast，避免打扰Usuario
  } finally {
    keyIds.forEach((id) => statsLoading.value.delete(id))
  }
}

// 获取CachéDatos estadísticos
const getCachedStats = (keyId) => {
  const cached = statsCache.value.get(keyId)
  return cached?.stats || null
}

// 检查是否正en加载Estadísticas
const isStatsLoading = (keyId) => {
  return statsLoading.value.has(keyId)
}

// 异步加载当anterior页最siguiente使用账号数据
const loadPageLastUsage = async () => {
  const currentPageKeys = apiKeys.value
  if (!currentPageKeys || currentPageKeys.length === 0) return

  // Filtrar出需要加载 keys（未Caché且有 lastUsedAt ）
  const keysNeedLastUsage = currentPageKeys.filter((key) => {
    // 没有使用过不需要加载
    if (!key.lastUsedAt) return false
    // 已经有Caché不需要加载
    if (lastUsageCache.value.has(key.id)) return false
    return true
  })

  if (keysNeedLastUsage.length === 0) return

  // 标记paraCargando
  const keyIds = keysNeedLastUsage.map((k) => k.id)
  keyIds.forEach((id) => lastUsageLoading.value.add(id))

  try {
    const response = await httpApis.getApiKeysBatchLastUsageApi({ keyIds })

    if (response.success && response.data) {
      // ActualizarCaché
      for (const [keyId, lastUsage] of Object.entries(response.data)) {
        lastUsageCache.value.set(keyId, lastUsage)
      }
    }
  } catch (error) {
    console.error('加载最siguiente使用账号数据Fallido:', error)
    // 不显示 toast，避免打扰Usuario
  } finally {
    keyIds.forEach((id) => lastUsageLoading.value.delete(id))
  }
}

// 获取Caché最siguiente使用账号数据
const getCachedLastUsage = (keyId) => {
  return lastUsageCache.value.get(keyId) || null
}

// 检查是否正en加载最siguiente使用账号
const isLastUsageLoading = (keyId) => {
  return lastUsageLoading.value.has(keyId)
}

// 加载已EliminarAPI Keys
const loadDeletedApiKeys = async () => {
  activeTab.value = 'deleted'
  deletedApiKeysLoading.value = true
  try {
    const data = await httpApis.getDeletedApiKeysApi()
    if (data.success) {
      deletedApiKeys.value = data.apiKeys || []
    }
  } catch (error) {
    showToast('加载已Eliminar API Keys Fallido', 'error')
  } finally {
    deletedApiKeysLoading.value = false
  }
}

// OrdenarAPI Keys
const sortApiKeys = (field) => {
  // CostoOrdenar特殊处理
  if (field === 'cost') {
    if (!canSortByCost.value) {
      showToast('CostoOrdenar索引正enActualizaren，请稍siguiente重试', 'warning')
      return
    }

    // 如果是 custom Rango de tiempo，Sugerencia可能需要等待
    if (globalDateFilter.type === 'custom') {
      showToast('正en计算CostoOrdenar，可能需要几秒钟...', 'info')
    }
  }

  if (apiKeysSortBy.value === field) {
    apiKeysSortOrder.value = apiKeysSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    apiKeysSortBy.value = field
    // CostoOrdenar默认降序（高Costoenanterior）
    apiKeysSortOrder.value = field === 'cost' ? 'desc' : 'asc'
  }
}

// 计算是否可以进行CostoOrdenar
const canSortByCost = computed(() => {
  // custom Rango de tiempo始终允许（实时计算）
  if (globalDateFilter.type === 'custom') {
    return true
  }

  // 检查对应Rango de tiempo索引Estado
  const timeRange = globalDateFilter.preset
  const status = costSortStatus.value[timeRange]
  return status?.status === 'ready'
})

// CostoOrdenarSugerencia文字
const costSortTooltip = computed(() => {
  if (globalDateFilter.type === 'custom') {
    return '点击按CostoOrdenar（实时计算，可能需要几秒钟）'
  }

  const timeRange = globalDateFilter.preset
  const status = costSortStatus.value[timeRange]

  if (!status) {
    return 'CostoOrdenar索引未初始化'
  }

  if (status.status === 'updating') {
    return 'CostoOrdenar索引正enActualizaren...'
  }

  if (status.status === 'ready') {
    const lastUpdate = status.lastUpdate ? new Date(status.lastUpdate).toLocaleString() : 'Desconocido'
    return `点击按CostoOrdenar（索引Actualizar于: ${lastUpdate}）`
  }

  return 'CostoOrdenar索引EstadoDesconocido'
})

// CostoOrdenar索引EstadoActualizar定时器
let costSortStatusTimer = null

// 获取CostoOrdenar索引Estado
const fetchCostSortStatus = async () => {
  try {
    const data = await httpApis.getApiKeysCostSortStatusApi()
    if (data.success) {
      costSortStatus.value = data.data || {}

      // 根据索引Estado动态调整Actualizar间隔
      scheduleNextCostSortStatusRefresh()
    }
  } catch (error) {
    console.error('Failed to fetch cost sort status:', error)
  }
}

// 智能调度abajovecesEstadoActualizar
const scheduleNextCostSortStatusRefresh = () => {
  // 清除旧定时器
  if (costSortStatusTimer) {
    clearTimeout(costSortStatusTimer)
  }

  // 检查是否有任何索引正enActualizaren
  const hasUpdating = Object.values(costSortStatus.value).some(
    (status) => status?.status === 'updating'
  )

  // 如果有索引正enActualizar，使用短间隔（10秒）；否则使用长间隔（60秒）
  const interval = hasUpdating ? 10000 : 60000

  costSortStatusTimer = setTimeout(fetchCostSortStatus, interval)
}

// 格式化数字

// 格式化Token数量
const formatTokenCount = (count) => {
  if (!count && count !== 0) return '0'
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M'
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K'
  }
  return count.toString()
}

// 获取绑定CuentaNombre
const getBoundAccountName = (accountId) => {
  if (!accountId) return 'Cuenta desconocida'

  // 检查是否是分组
  if (accountId.startsWith('group:')) {
    const groupId = accountId.substring(6) // 移除 'group:' anterior缀

    // deClaude分组en查找
    const claudeGroup = accounts.value.claudeGroups.find((g) => g.id === groupId)
    if (claudeGroup) {
      return `分组-${claudeGroup.name}`
    }

    // deGemini分组en查找
    const geminiGroup = accounts.value.geminiGroups.find((g) => g.id === groupId)
    if (geminiGroup) {
      return `分组-${geminiGroup.name}`
    }

    // deOpenAI分组en查找
    const openaiGroup = accounts.value.openaiGroups.find((g) => g.id === groupId)
    if (openaiGroup) {
      return `分组-${openaiGroup.name}`
    }

    const droidGroup = accounts.value.droidGroups.find((g) => g.id === groupId)
    if (droidGroup) {
      return `分组-${droidGroup.name}`
    }

    // 如果找不到分组，返回分组IDanterior8位
    return `分组-${groupId.substring(0, 8)}`
  }

  // deClaudeCuenta列表en查找
  const claudeAccount = accounts.value.claude.find((acc) => acc.id === accountId)
  if (claudeAccount) {
    return `${claudeAccount.name}`
  }

  // 处理 api: anterior缀 Gemini-API Cuenta
  if (accountId.startsWith('api:')) {
    const realAccountId = accountId.replace('api:', '')
    const geminiApiAccount = accounts.value.gemini.find(
      (acc) => acc.id === realAccountId && acc.platform === 'gemini-api'
    )
    if (geminiApiAccount) {
      return `${geminiApiAccount.name}`
    }
    // 如果找不到，返回IDanterior8位
    return `${realAccountId.substring(0, 8)}`
  }

  // deGeminiCuenta列表en查找
  const geminiAccount = accounts.value.gemini.find((acc) => acc.id === accountId)
  if (geminiAccount) {
    return `${geminiAccount.name}`
  }

  // 处理 responses: anterior缀 OpenAI-Responses Cuenta
  if (accountId.startsWith('responses:')) {
    const realAccountId = accountId.replace('responses:', '')
    const openaiResponsesAccount = accounts.value.openaiResponses.find(
      (acc) => acc.id === realAccountId
    )
    if (openaiResponsesAccount) {
      return `${openaiResponsesAccount.name}`
    }
    // 如果找不到，返回IDanterior8位
    return `${realAccountId.substring(0, 8)}`
  }

  // deOpenAICuenta列表en查找
  const openaiAccount = accounts.value.openai.find((acc) => acc.id === accountId)
  if (openaiAccount) {
    return `${openaiAccount.name}`
  }

  // de OpenAI-Responses Cuenta列表en查找（兼容没有anterior缀情况）
  const openaiResponsesAccount = accounts.value.openaiResponses.find((acc) => acc.id === accountId)
  if (openaiResponsesAccount) {
    return `${openaiResponsesAccount.name}`
  }

  // deBedrockCuenta列表en查找
  const bedrockAccount = accounts.value.bedrock.find((acc) => acc.id === accountId)
  if (bedrockAccount) {
    return `${bedrockAccount.name}`
  }

  const droidAccount = accounts.value.droid.find((acc) => acc.id === accountId)
  if (droidAccount) {
    return `${droidAccount.name}`
  }

  // 如果找不到，返回CuentaIDanterior8位
  return `${accountId.substring(0, 8)}`
}

// 检查 API Key 是否有任何账号绑定
const hasAnyBinding = (key) => {
  return !!(
    key.claudeAccountId ||
    key.claudeConsoleAccountId ||
    key.geminiAccountId ||
    key.openaiAccountId ||
    key.bedrockAccountId ||
    key.droidAccountId
  )
}

// 获取Claude绑定Información
const getClaudeBindingInfo = (key) => {
  if (key.claudeAccountId) {
    const info = getBoundAccountName(key.claudeAccountId)
    if (key.claudeAccountId.startsWith('group:')) {
      return info
    }
    // 检查Cuenta是否存en
    const account = accounts.value.claude.find((acc) => acc.id === key.claudeAccountId)
    if (!account) {
      return `⚠️ ${info} (Cuenta不存en)`
    }
    if (account.accountType === 'dedicated') {
      return `🔒 专属-${info}`
    }
    return info
  }
  if (key.claudeConsoleAccountId) {
    const account = accounts.value.claude.find(
      (acc) => acc.id === key.claudeConsoleAccountId && acc.platform === 'claude-console'
    )
    if (!account) {
      return `⚠️ ConsoleCuenta不存en`
    }
    return `Console-${account.name}`
  }
  return ''
}

// 获取Gemini绑定Información
const getGeminiBindingInfo = (key) => {
  if (key.geminiAccountId) {
    const info = getBoundAccountName(key.geminiAccountId)
    if (key.geminiAccountId.startsWith('group:')) {
      return info
    }

    // 处理 api: anterior缀 Gemini-API Cuenta
    if (key.geminiAccountId.startsWith('api:')) {
      const realAccountId = key.geminiAccountId.replace('api:', '')
      const account = accounts.value.gemini.find(
        (acc) => acc.id === realAccountId && acc.platform === 'gemini-api'
      )
      if (!account) {
        return `⚠️ ${info} (Cuenta不存en)`
      }
      if (account.accountType === 'dedicated') {
        return `🔒 API专属-${info}`
      }
      return `API-${info}`
    }

    // 检查 Gemini OAuth Cuenta是否存en
    const account = accounts.value.gemini.find((acc) => acc.id === key.geminiAccountId)
    if (!account) {
      return `⚠️ ${info} (Cuenta不存en)`
    }
    if (account.accountType === 'dedicated') {
      return `🔒 专属-${info}`
    }
    return info
  }
  return ''
}

// 获取OpenAI绑定Información
const getOpenAIBindingInfo = (key) => {
  if (key.openaiAccountId) {
    const info = getBoundAccountName(key.openaiAccountId)
    if (key.openaiAccountId.startsWith('group:')) {
      return info
    }

    // 处理 responses: anterior缀 OpenAI-Responses Cuenta
    let account = null
    if (key.openaiAccountId.startsWith('responses:')) {
      const realAccountId = key.openaiAccountId.replace('responses:', '')
      account = accounts.value.openaiResponses.find((acc) => acc.id === realAccountId)
    } else {
      // 查找普通 OpenAI Cuenta
      account = accounts.value.openai.find((acc) => acc.id === key.openaiAccountId)
    }

    if (!account) {
      return `⚠️ ${info} (Cuenta不存en)`
    }
    if (account.accountType === 'dedicated') {
      return `🔒 专属-${info}`
    }
    return info
  }
  return ''
}

// 获取Bedrock绑定Información
const getBedrockBindingInfo = (key) => {
  if (key.bedrockAccountId) {
    const info = getBoundAccountName(key.bedrockAccountId)
    if (key.bedrockAccountId.startsWith('group:')) {
      return info
    }
    // 检查Cuenta是否存en
    const account = accounts.value.bedrock.find((acc) => acc.id === key.bedrockAccountId)
    if (!account) {
      return `⚠️ ${info} (Cuenta不存en)`
    }
    if (account.accountType === 'dedicated') {
      return `🔒 专属-${info}`
    }
    return info
  }
  return ''
}

const getDroidBindingInfo = (key) => {
  if (key.droidAccountId) {
    const info = getBoundAccountName(key.droidAccountId)
    if (key.droidAccountId.startsWith('group:')) {
      return info
    }
    const account = accounts.value.droid.find((acc) => acc.id === key.droidAccountId)
    if (!account) {
      return `⚠️ ${info} (Cuenta不存en)`
    }
    if (account.accountType === 'dedicated') {
      return `🔒 专属-${info}`
    }
    return info
  }
  return ''
}

// 检查API Key是否过期
const isApiKeyExpired = (expiresAt) => {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

// 检查API Key是否即将过期
const isApiKeyExpiringSoon = (expiresAt) => {
  if (!expiresAt || isApiKeyExpired(expiresAt)) return false
  const daysUntilExpiry = (new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)
  return daysUntilExpiry <= 7
}

// 格式化过期日期
const formatExpireDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('zh-CN')
}

// 切换ModeloEstadísticas展开Estado
const toggleApiKeyModelStats = async (keyId) => {
  if (!expandedApiKeys.value[keyId]) {
    expandedApiKeys.value[keyId] = true
    // 初始化日期Filtrar器
    if (!apiKeyDateFilters.value[keyId]) {
      initApiKeyDateFilter(keyId)
    }
    // 加载ModeloDatos estadísticos
    await loadApiKeyModelStats(keyId, true)
  } else {
    expandedApiKeys.value[keyId] = false
  }
}

// 加载 API Key ModeloEstadísticas
const loadApiKeyModelStats = async (keyId, forceReload = false) => {
  if (!forceReload && apiKeyModelStats.value[keyId] && apiKeyModelStats.value[keyId].length > 0) {
    return
  }

  const filter = getApiKeyDateFilter(keyId)

  try {
    const params = {}

    if (filter.customStart && filter.customEnd) {
      params.startDate = filter.customStart
      params.endDate = filter.customEnd
      params.period = 'custom'
    } else {
      params.period =
        filter.preset === 'today' ? 'daily' : filter.preset === '7days' ? 'daily' : 'monthly'
    }

    const data = await httpApis.getApiKeyModelStatsApi(keyId, params)
    if (data.success) {
      apiKeyModelStats.value[keyId] = data.data || []
    }
  } catch (error) {
    showToast('加载ModeloEstadísticasFallido', 'error')
    apiKeyModelStats.value[keyId] = []
  }
}

// 计算API KeyUso del modelo百分比
const calculateApiKeyModelPercentage = (value, stats) => {
  const total = stats.reduce((sum, stat) => sum + (stat.allTokens || 0), 0)
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

// 计算单 ModeloCosto
const calculateModelCost = (stat) => {
  // 优先使用siguiente端返回Costo数据
  if (stat.formatted && stat.formatted.total) {
    return stat.formatted.total
  }

  // 如果没有 formatted 数据，尝试使用 cost 字段
  if (stat.cost !== undefined) {
    return `$${stat.cost.toFixed(6)}`
  }

  // 默认返回
  return '$0.000000'
}

// 获取Rango de fechas内Solicitud数
const getPeriodRequests = (key) => {
  // 根据Global日期Filtrar器返回对应Solicitud数
  if (globalDateFilter.type === 'custom') {
    // 自定义Rango de fechas
    if (key.usage) {
      if (key.usage['custom'] && key.usage['custom'].requests !== undefined) {
        return key.usage['custom'].requests
      }
      if (key.usage.total && key.usage.total.requests !== undefined) {
        return key.usage.total.requests
      }
    }
    return 0
  } else if (globalDateFilter.preset === 'today') {
    return key.usage?.daily?.requests || 0
  } else if (globalDateFilter.preset === '7days') {
    // 使用 usage['7days'].requests
    if (key.usage && key.usage['7days'] && key.usage['7days'].requests !== undefined) {
      return key.usage['7days'].requests
    }
    return 0
  } else if (globalDateFilter.preset === '30days') {
    // 使用 usage['30days'].requests
    if (key.usage) {
      if (key.usage['30days'] && key.usage['30days'].requests !== undefined) {
        return key.usage['30days'].requests
      }
      if (key.usage.monthly && key.usage.monthly.requests !== undefined) {
        return key.usage.monthly.requests
      }
    }
    return 0
  } else if (globalDateFilter.preset === 'all') {
    // 全部时间
    if (key.usage && key.usage['all'] && key.usage['all'].requests !== undefined) {
      return key.usage['all'].requests
    }
    return key.usage?.total?.requests || 0
  } else {
    // 默认返回
    return key.usage?.total?.requests || 0
  }
}

// 获取Rango de fechas内Costo
const getPeriodCost = (key) => {
  // 根据Global日期Filtrar器返回对应Costo
  if (globalDateFilter.type === 'custom') {
    // 自定义Rango de fechas，使用服务器返回 usage['custom'].cost
    if (key.usage) {
      if (key.usage['custom'] && key.usage['custom'].cost !== undefined) {
        return key.usage['custom'].cost
      }
      if (key.usage.total && key.usage.total.cost !== undefined) {
        return key.usage.total.cost
      }
    }
    return 0
  } else if (globalDateFilter.preset === 'today') {
    return key.dailyCost || 0
  } else if (globalDateFilter.preset === '7days') {
    // 使用 usage['7days'].cost
    if (key.usage && key.usage['7days'] && key.usage['7days'].cost !== undefined) {
      return key.usage['7days'].cost
    }
    return key.weeklyCost || key.periodCost || 0
  } else if (globalDateFilter.preset === '30days') {
    // 使用 usage['30days'].cost o usage.monthly.cost
    if (key.usage) {
      if (key.usage['30days'] && key.usage['30days'].cost !== undefined) {
        return key.usage['30days'].cost
      }
      if (key.usage.monthly && key.usage.monthly.cost !== undefined) {
        return key.usage.monthly.cost
      }
      if (key.usage.total && key.usage.total.cost !== undefined) {
        return key.usage.total.cost
      }
    }
    return key.monthlyCost || key.periodCost || 0
  } else if (globalDateFilter.preset === 'all') {
    // 全部时间，返回 usage['all'].cost o totalCost
    if (key.usage && key.usage['all'] && key.usage['all'].cost !== undefined) {
      return key.usage['all'].cost
    }
    return key.totalCost || 0
  } else {
    // 默认返回 usage.total.cost
    return key.periodCost || key.totalCost || 0
  }
}

// 获取Rango de fechas内token数量
const getPeriodTokens = (key) => {
  // 根据Global日期Filtrar器返回对应token数量
  if (globalDateFilter.type === 'custom') {
    // 自定义Rango de fechas
    if (key.usage) {
      if (key.usage['custom'] && key.usage['custom'].tokens !== undefined) {
        return key.usage['custom'].tokens
      }
      if (key.usage.total && key.usage.total.tokens !== undefined) {
        return key.usage.total.tokens
      }
    }
    return 0
  } else if (globalDateFilter.preset === 'today') {
    return key.usage?.daily?.tokens || 0
  } else if (globalDateFilter.preset === '7days') {
    // 使用 usage['7days'].tokens
    if (key.usage && key.usage['7days'] && key.usage['7days'].tokens !== undefined) {
      return key.usage['7days'].tokens
    }
    return 0
  } else if (globalDateFilter.preset === '30days') {
    // 使用 usage['30days'].tokens o usage.monthly.tokens
    if (key.usage) {
      if (key.usage['30days'] && key.usage['30days'].tokens !== undefined) {
        return key.usage['30days'].tokens
      }
      if (key.usage.monthly && key.usage.monthly.tokens !== undefined) {
        return key.usage.monthly.tokens
      }
      if (key.usage.total && key.usage.total.tokens !== undefined) {
        return key.usage.total.tokens
      }
    }
    return 0
  } else if (globalDateFilter.preset === 'all') {
    // 全部时间
    if (key.usage && key.usage['all'] && key.usage['all'].tokens !== undefined) {
      return key.usage['all'].tokens
    }
    return key.usage?.total?.tokens || 0
  } else {
    // 默认返回
    return key.usage?.total?.tokens || 0
  }
}

// 获取Rango de fechas内Entradatoken数量
const getPeriodInputTokens = (key) => {
  // 根据Global日期Filtrar器返回对应Entradatoken数量
  if (globalDateFilter.type === 'custom') {
    // 自定义Rango de fechas
    if (key.usage) {
      if (key.usage['custom'] && key.usage['custom'].inputTokens !== undefined) {
        return key.usage['custom'].inputTokens
      }
      if (key.usage.total && key.usage.total.inputTokens !== undefined) {
        return key.usage.total.inputTokens
      }
    }
    return 0
  } else if (globalDateFilter.preset === 'today') {
    return key.usage?.daily?.inputTokens || 0
  } else if (globalDateFilter.preset === '7days') {
    // 使用 usage['7days'].inputTokens
    if (key.usage && key.usage['7days'] && key.usage['7days'].inputTokens !== undefined) {
      return key.usage['7days'].inputTokens
    }
    return 0
  } else if (globalDateFilter.preset === '30days') {
    // 使用 usage['30days'].inputTokens o usage.monthly.inputTokens
    if (key.usage) {
      if (key.usage['30days'] && key.usage['30days'].inputTokens !== undefined) {
        return key.usage['30days'].inputTokens
      }
      if (key.usage.monthly && key.usage.monthly.inputTokens !== undefined) {
        return key.usage.monthly.inputTokens
      }
      if (key.usage.total && key.usage.total.inputTokens !== undefined) {
        return key.usage.total.inputTokens
      }
    }
    return 0
  } else if (globalDateFilter.preset === 'all') {
    // 全部时间
    if (key.usage && key.usage['all'] && key.usage['all'].inputTokens !== undefined) {
      return key.usage['all'].inputTokens
    }
    return key.usage?.total?.inputTokens || 0
  } else {
    // 默认返回
    return key.usage?.total?.inputTokens || 0
  }
}

// 获取Rango de fechas内Salidatoken数量
const getPeriodOutputTokens = (key) => {
  // 根据Global日期Filtrar器返回对应Salidatoken数量
  if (globalDateFilter.type === 'custom') {
    // 自定义Rango de fechas
    if (key.usage) {
      if (key.usage['custom'] && key.usage['custom'].outputTokens !== undefined) {
        return key.usage['custom'].outputTokens
      }
      if (key.usage.total && key.usage.total.outputTokens !== undefined) {
        return key.usage.total.outputTokens
      }
    }
    return 0
  } else if (globalDateFilter.preset === 'today') {
    return key.usage?.daily?.outputTokens || 0
  } else if (globalDateFilter.preset === '7days') {
    // 使用 usage['7days'].outputTokens
    if (key.usage && key.usage['7days'] && key.usage['7days'].outputTokens !== undefined) {
      return key.usage['7days'].outputTokens
    }
    return 0
  } else if (globalDateFilter.preset === '30days') {
    // 使用 usage['30days'].outputTokens o usage.monthly.outputTokens
    if (key.usage) {
      if (key.usage['30days'] && key.usage['30days'].outputTokens !== undefined) {
        return key.usage['30days'].outputTokens
      }
      if (key.usage.monthly && key.usage.monthly.outputTokens !== undefined) {
        return key.usage.monthly.outputTokens
      }
      if (key.usage.total && key.usage.total.outputTokens !== undefined) {
        return key.usage.total.outputTokens
      }
    }
    return 0
  } else if (globalDateFilter.preset === 'all') {
    // 全部时间
    if (key.usage && key.usage['all'] && key.usage['all'].outputTokens !== undefined) {
      return key.usage['all'].outputTokens
    }
    return key.usage?.total?.outputTokens || 0
  } else {
    // 默认返回
    return key.usage?.total?.outputTokens || 0
  }
}

// 计算Rango de fechas内totalCost（para展开详细Estadísticas）
const calculatePeriodCost = (key) => {
  // 如果没有展开，使用CachéCosto数据
  if (!apiKeyModelStats.value[key.id]) {
    return getPeriodCost(key)
  }

  // 计算Todos los modelosCosto总y
  const stats = apiKeyModelStats.value[key.id] || []
  let totalCost = 0

  stats.forEach((stat) => {
    if (stat.cost !== undefined) {
      totalCost += stat.cost
    } else if (stat.formatted && stat.formatted.total) {
      // 尝试de格式化字符串en提取数字
      const costStr = stat.formatted.total.replace('$', '').replace(',', '')
      const cost = parseFloat(costStr)
      if (!isNaN(cost)) {
        totalCost += cost
      }
    }
  })

  return totalCost
}

// 处理Rango de tiempoabajo拉框变化
const handleTimeRangeChange = (value) => {
  setGlobalDateFilterPreset(value)

  // 如果当anterior是CostoOrdenar，检查新Rango de tiempo索引是否就绪
  if (apiKeysSortBy.value === 'cost') {
    // custom Rango de tiempo始终允许（实时计算）
    if (value === 'custom') {
      return
    }

    // 检查新Rango de tiempo索引Estado
    const status = costSortStatus.value[value]
    if (!status || status.status !== 'ready') {
      // 索引未就绪，回退到默认Ordenar
      apiKeysSortBy.value = 'createdAt'
      apiKeysSortOrder.value = 'desc'
      showToast('当anteriorRango de tiempoCostoOrdenar索引未就绪，已切换到默认Ordenar', 'info')
    }
  }
}

// ConfiguraciónGlobal日期预设
const setGlobalDateFilterPreset = (preset) => {
  globalDateFilter.preset = preset

  if (preset === 'custom') {
    // 自定义选项，不自动Configuración日期，等待Usuario选择
    globalDateFilter.type = 'custom'
    // 如果没有自定义范围，Configuración默认para最近7天
    if (!globalDateFilter.customRange) {
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 6)

      const formatDate = (date) => {
        return (
          date.getFullYear() +
          '-' +
          String(date.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(date.getDate()).padStart(2, '0') +
          ' 00:00:00'
        )
      }

      globalDateFilter.customRange = [formatDate(startDate), formatDate(today)]
      globalDateFilter.customStart = startDate.toISOString().split('T')[0]
      globalDateFilter.customEnd = today.toISOString().split('T')[0]
    }
  } else if (preset === 'all') {
    // 全部时间选项
    globalDateFilter.type = 'preset'
    globalDateFilter.customStart = null
    globalDateFilter.customEnd = null
  } else {
    // 预设选项（Hoy、7天o30天）
    globalDateFilter.type = 'preset'
    const today = new Date()
    const startDate = new Date(today)

    if (preset === 'today') {
      // Hoy：de今天开始到今天结束
      startDate.setHours(0, 0, 0, 0)
    } else if (preset === '7days') {
      startDate.setDate(today.getDate() - 6)
    } else if (preset === '30days') {
      startDate.setDate(today.getDate() - 29)
    }

    globalDateFilter.customStart = startDate.toISOString().split('T')[0]
    globalDateFilter.customEnd = today.toISOString().split('T')[0]
  }

  loadApiKeys()
}

// Global自定义Rango de fechas变化
const onGlobalCustomDateRangeChange = (value) => {
  if (value && value.length === 2) {
    globalDateFilter.type = 'custom'
    globalDateFilter.preset = 'custom'
    globalDateFilter.customRange = value
    globalDateFilter.customStart = value[0].split(' ')[0]
    globalDateFilter.customEnd = value[1].split(' ')[0]
    loadApiKeys()
  } else if (value === null) {
    // 清空时恢复默认Hoy
    setGlobalDateFilterPreset('today')
  }
}

// 初始化API Key日期Filtrar器
const initApiKeyDateFilter = (keyId) => {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setHours(0, 0, 0, 0) // Hoyde0点开始

  apiKeyDateFilters.value[keyId] = {
    type: 'preset',
    preset: 'today',
    customStart: today.toISOString().split('T')[0],
    customEnd: today.toISOString().split('T')[0],
    customRange: null,
    presetOptions: [
      { value: 'today', label: 'Hoy', days: 1 },
      { value: '7days', label: '7天', days: 7 },
      { value: '30days', label: '30天', days: 30 },
      { value: 'custom', label: '自定义', days: -1 }
    ]
  }
}

// 获取API Key日期Filtrar器Estado
const getApiKeyDateFilter = (keyId) => {
  if (!apiKeyDateFilters.value[keyId]) {
    initApiKeyDateFilter(keyId)
  }
  return apiKeyDateFilters.value[keyId]
}

// Configuración API Key 日期预设
const setApiKeyDateFilterPreset = (preset, keyId) => {
  const filter = getApiKeyDateFilter(keyId)
  filter.type = 'preset'
  filter.preset = preset

  const option = filter.presetOptions.find((opt) => opt.value === preset)
  if (option) {
    if (preset === 'custom') {
      // 自定义选项，不自动Configuración日期，等待Usuario选择
      filter.type = 'custom'
      // 如果没有自定义范围，Configuración默认para最近7天
      if (!filter.customRange) {
        const today = new Date()
        const startDate = new Date(today)
        startDate.setDate(today.getDate() - 6)

        const formatDate = (date) => {
          return (
            date.getFullYear() +
            '-' +
            String(date.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(date.getDate()).padStart(2, '0') +
            ' 00:00:00'
          )
        }

        filter.customRange = [formatDate(startDate), formatDate(today)]
        filter.customStart = startDate.toISOString().split('T')[0]
        filter.customEnd = today.toISOString().split('T')[0]
      }
    } else {
      // 预设选项
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - (option.days - 1))

      filter.customStart = startDate.toISOString().split('T')[0]
      filter.customEnd = today.toISOString().split('T')[0]

      const formatDate = (date) => {
        return (
          date.getFullYear() +
          '-' +
          String(date.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(date.getDate()).padStart(2, '0') +
          ' 00:00:00'
        )
      }

      filter.customRange = [formatDate(startDate), formatDate(today)]
    }
  }

  loadApiKeyModelStats(keyId, true)
}

// API Key 自定义Rango de fechas变化
const onApiKeyCustomDateRangeChange = (keyId, value) => {
  const filter = getApiKeyDateFilter(keyId)

  if (value && value.length === 2) {
    filter.type = 'custom'
    filter.preset = 'custom'
    filter.customRange = value
    filter.customStart = value[0].split(' ')[0]
    filter.customEnd = value[1].split(' ')[0]

    loadApiKeyModelStats(keyId, true)
  } else if (value === null) {
    // 清空时恢复默认7天
    setApiKeyDateFilterPreset('7days', keyId)
  }
}

// Deshabilitar未来日期
const disabledDate = (date) => {
  return date > new Date()
}

// RestablecerAPI Key日期Filtrar器
const resetApiKeyDateFilter = (keyId) => {
  const filter = getApiKeyDateFilter(keyId)

  // Restablecerpara默认Hoy
  filter.type = 'preset'
  filter.preset = 'today'

  const today = new Date()
  const startDate = new Date(today)
  startDate.setHours(0, 0, 0, 0) // Hoyde0点开始

  filter.customStart = today.toISOString().split('T')[0]
  filter.customEnd = today.toISOString().split('T')[0]
  filter.customRange = null

  // 重新加载数据
  loadApiKeyModelStats(keyId, true)
  showToast('已RestablecerFiltrarregistros件并Actualizar数据', 'info')
}

// 打开Crear模态框
const openCreateApiKeyModal = () => {
  // 使用Caché账号数据（如果需要最新数据，Usuario可以点击"Actualizar账号"按钮）
  showCreateApiKeyModal.value = true
  // 如果账号数据未加载，异步加载
  if (!accountsLoaded.value) {
    loadAccounts()
  }
}

// 打开Editar模态框
const openEditApiKeyModal = (apiKey) => {
  // 使用Caché账号数据（如果需要最新数据，Usuario可以点击"Actualizar账号"按钮）
  editingApiKey.value = apiKey
  showEditApiKeyModal.value = true
  // 如果账号数据未加载，异步加载
  if (!accountsLoaded.value) {
    loadAccounts()
  }
}

// 打开续期模态框
const openRenewApiKeyModal = (apiKey) => {
  renewingApiKey.value = apiKey
  showRenewApiKeyModal.value = true
}

// 处理Creado exitosamente
const handleCreateSuccess = (data) => {
  showCreateApiKeyModal.value = false
  newApiKeyData.value = data
  showNewApiKeyModal.value = true
  loadApiKeys()
}

// 处理批量Creado exitosamente
const handleBatchCreateSuccess = (data) => {
  showCreateApiKeyModal.value = false
  batchApiKeyData.value = data
  showBatchApiKeyModal.value = true
  loadApiKeys()
}

// 打开Edición por lotes模态框
const openBatchEditModal = () => {
  if (selectedApiKeys.value.length === 0) {
    showToast('请先选择要Editar API Keys', 'warning')
    return
  }

  // 使用Caché账号数据（如果需要最新数据，Usuario可以点击"Actualizar账号"按钮）
  showBatchEditModal.value = true
  // 如果账号数据未加载，异步加载
  if (!accountsLoaded.value) {
    loadAccounts()
  }
}

// 处理Edición por lotesExitoso
const handleBatchEditSuccess = () => {
  showBatchEditModal.value = false
  // 清空选enEstado
  selectedApiKeys.value = []
  updateSelectAllState()
  loadApiKeys()
}

// 处理EditarExitoso
const handleEditSuccess = () => {
  showEditApiKeyModal.value = false
  showToast('API Key Actualizado exitosamente', 'success')
  loadApiKeys()
}

// 处理续期Exitoso
const handleRenewSuccess = () => {
  showRenewApiKeyModal.value = false
  showToast('API Key 续期Exitoso', 'success')
  loadApiKeys()
}

// 获取API KeyOperación菜单项（paraActionDropdown）
const getApiKeyActions = (key) => {
  const actions = [
    {
      key: 'edit',
      label: 'Editar',
      icon: 'fa-edit',
      color: 'blue',
      handler: () => openEditApiKeyModal(key)
    }
  ]

  // 如果需要续期
  if (key.expiresAt && (isApiKeyExpired(key.expiresAt) || isApiKeyExpiringSoon(key.expiresAt))) {
    actions.push({
      key: 'renew',
      label: '续期',
      icon: 'fa-clock',
      color: 'green',
      handler: () => openRenewApiKeyModal(key)
    })
  }

  // 激活/Deshabilitar
  actions.push({
    key: 'toggle',
    label: key.isActive ? 'Deshabilitar' : '激活',
    icon: key.isActive ? 'fa-ban' : 'fa-check-circle',
    color: key.isActive ? 'orange' : 'green',
    handler: () => toggleApiKeyStatus(key)
  })

  // Eliminar
  actions.push({
    key: 'delete',
    label: 'Eliminar',
    icon: 'fa-trash',
    color: 'red',
    handler: () => deleteApiKey(key.id)
  })

  return actions
}

// 切换API KeyEstado（激活/Deshabilitar）
const toggleApiKeyStatus = async (key) => {
  let confirmed = true

  // Deshabilitar时需要二vecesConfirmar
  if (key.isActive) {
    confirmed = await showConfirm(
      'Deshabilitar API Key',
      `Confirmar要Deshabilitar API Key "${key.name}" 吗？Deshabilitarsiguiente所有使用此 Key Solicitud将返回 401 Error。`,
      'ConfirmarDeshabilitar',
      'Cancelar',
      'warning'
    )
  }

  if (!confirmed) return

  try {
    const data = await httpApis.updateApiKeyApi(key.id, { isActive: !key.isActive })

    if (data.success) {
      showToast(`API Key 已${key.isActive ? 'Deshabilitar' : '激活'}`, 'success')
      // Actualizar本地数据
      const localKey = apiKeys.value.find((k) => k.id === key.id)
      if (localKey) {
        localKey.isActive = !key.isActive
      }
    } else {
      showToast(data.message || 'Operación fallida', 'error')
    }
  } catch (error) {
    showToast('Operación fallida', 'error')
  }
}

// ActualizarAPI Key图标
// EliminarAPI Key
const deleteApiKey = async (keyId) => {
  const confirmed = await showConfirm(
    'Eliminar API Key',
    'Confirmar要Eliminar这  API Key 吗？此Operación不可恢复。',
    'ConfirmarEliminar',
    'Cancelar',
    'danger'
  )

  if (!confirmed) return

  try {
    const data = await httpApis.deleteApiKeyApi(keyId)
    if (data.success) {
      showToast('API Key 已Eliminar', 'success')
      // de选en列表en移除
      const index = selectedApiKeys.value.indexOf(keyId)
      if (index > -1) {
        selectedApiKeys.value.splice(index, 1)
      }
      updateSelectAllState()
      loadApiKeys()
    } else {
      showToast(data.message || 'Error al eliminar', 'error')
    }
  } catch (error) {
    showToast('Error al eliminar', 'error')
  }
}

// 恢复API Key
const restoreApiKey = async (keyId) => {
  const confirmed = await showConfirm(
    '恢复 API Key',
    'Confirmar要恢复这  API Key 吗？恢复siguiente可以重新使用。',
    'Confirmar恢复',
    'Cancelar',
    'primary'
  )

  if (!confirmed) return

  try {
    const data = await httpApis.restoreApiKeyApi(keyId)
    if (data.success) {
      showToast('API Key 已Exitoso恢复', 'success')
      // Actualizar已Eliminar列表
      await loadDeletedApiKeys()
      // 同时Actualizar活跃列表
      await loadApiKeys()
    } else {
      showToast(data.error || '恢复Fallido', 'error')
    }
  } catch (error) {
    showToast(error.response?.data?.error || '恢复Fallido', 'error')
  }
}

// 彻底EliminarAPI Key
const permanentDeleteApiKey = async (keyId) => {
  const confirmed = await showConfirm(
    '彻底Eliminar API Key',
    'Confirmar要彻底Eliminar这  API Key 吗？此Operación不可恢复，所有相关数据将被永久Eliminar。',
    'Confirmar彻底Eliminar',
    'Cancelar',
    'danger'
  )

  if (!confirmed) return

  try {
    const data = await httpApis.permanentDeleteApiKeyApi(keyId)
    if (data.success) {
      showToast('API Key 已彻底Eliminar', 'success')
      // Actualizar已Eliminar列表
      loadDeletedApiKeys()
    } else {
      showToast(data.error || '彻底Error al eliminar', 'error')
    }
  } catch (error) {
    showToast(error.response?.data?.error || '彻底Error al eliminar', 'error')
  }
}

// 清空所有已EliminarAPI Keys
const clearAllDeletedApiKeys = async () => {
  const count = deletedApiKeys.value.length
  if (count === 0) {
    showToast('没有需要清空 API Keys', 'info')
    return
  }

  const confirmed = await showConfirm(
    '清空所有已Eliminar API Keys',
    `Confirmar要彻底Eliminar全部 ${count}  已Eliminar API Keys 吗？此Operación不可恢复，所有相关数据将被永久Eliminar。`,
    'Confirmar清空全部',
    'Cancelar',
    'danger'
  )

  if (!confirmed) return

  try {
    const data = await httpApis.clearAllDeletedApiKeysApi()
    if (data.success) {
      showToast(data.message || '已清空所有已Eliminar API Keys', 'success')

      // 如果有Fallido，显示详细Información
      if (data.details && data.details.failedCount > 0) {
        // const errors = data.details.errors
        // console.error('部分API Keys清空Fallido:', errors)
        showToast(`${data.details.failedCount}  清空Fallido`, 'warning')
      }

      // Actualizar已Eliminar列表
      loadDeletedApiKeys()
    } else {
      showToast(data.error || '清空Fallido', 'error')
    }
  } catch (error) {
    showToast(error.response?.data?.error || '清空Fallido', 'error')
  }
}

// Eliminación por lotesAPI Keys
const batchDeleteApiKeys = async () => {
  const selectedCount = selectedApiKeys.value.length
  if (selectedCount === 0) {
    showToast('请先选择要Eliminar API Keys', 'warning')
    return
  }

  const confirmed = await showConfirm(
    'Eliminación por lotes API Keys',
    `Confirmar要Eliminar选en ${selectedCount}   API Key 吗？此Operación不可恢复。`,
    'ConfirmarEliminar',
    'Cancelar',
    'danger'
  )

  if (!confirmed) return

  const keyIds = [...selectedApiKeys.value]

  try {
    const data = await httpApis.batchDeleteApiKeysApi({ keyIds })

    if (data.success) {
      const { successCount, failedCount, errors } = data.data

      if (successCount > 0) {
        showToast(`ExitosoEliminar ${successCount}   API Keys`, 'success')

        // 如果有Fallido，显示详细Información
        if (failedCount > 0) {
          const errorMessages = errors.map((e) => `${e.keyId}: ${e.error}`).join('\n')
          showToast(`${failedCount}  Error al eliminar:\n${errorMessages}`, 'warning')
        }
      } else {
        showToast('所有 API Keys Error al eliminar', 'error')
      }

      // 清空选enEstado
      selectedApiKeys.value = []
      updateSelectAllState()
      loadApiKeys()
    } else {
      showToast(data.message || '批量Error al eliminar', 'error')
    }
  } catch (error) {
    showToast('批量Error al eliminar', 'error')
    // console.error('Eliminación por lotes API Keys Fallido:', error)
  }
}

// 处理全选/Cancelar全选
const handleSelectAll = () => {
  if (selectAllChecked.value) {
    // 全选当anterior页所有API Keys
    paginatedApiKeys.value.forEach((key) => {
      if (!selectedApiKeys.value.includes(key.id)) {
        selectedApiKeys.value.push(key.id)
      }
    })
  } else {
    // Cancelar全选：只移除当anterior页选en项，保留Otro页面选en项
    const currentPageIds = new Set(paginatedApiKeys.value.map((key) => key.id))
    selectedApiKeys.value = selectedApiKeys.value.filter((id) => !currentPageIds.has(id))
  }
  updateSelectAllState()
}

// Actualizar全选Estado
const updateSelectAllState = () => {
  const totalInCurrentPage = paginatedApiKeys.value.length
  const selectedInCurrentPage = paginatedApiKeys.value.filter((key) =>
    selectedApiKeys.value.includes(key.id)
  ).length

  if (selectedInCurrentPage === 0) {
    selectAllChecked.value = false
    isIndeterminate.value = false
  } else if (selectedInCurrentPage === totalInCurrentPage) {
    selectAllChecked.value = true
    isIndeterminate.value = false
  } else {
    selectAllChecked.value = false
    isIndeterminate.value = true
  }
}

// 开始Editar过期时间
const startEditExpiry = (apiKey) => {
  editingExpiryKey.value = apiKey
}

// Cerrar过期时间Editar
const closeExpiryEdit = () => {
  editingExpiryKey.value = null
}

// Guardar过期时间
const handleSaveExpiry = async ({ keyId, expiresAt, activateNow }) => {
  try {
    // 使用新PATCH端点来修改过期时间
    const data = await httpApis.updateApiKeyExpirationApi(keyId, {
      expiresAt: expiresAt || null,
      activateNow: activateNow || false
    })

    if (data.success) {
      showToast(activateNow ? 'API Key已激活' : '过期时间已Actualizar', 'success')
      // Actualizar本地数据
      const key = apiKeys.value.find((k) => k.id === keyId)
      if (key) {
        if (activateNow && data.updates) {
          key.isActivated = true
          key.activatedAt = data.updates.activatedAt
          key.expiresAt = data.updates.expiresAt
        } else {
          key.expiresAt = expiresAt || null
          if (expiresAt && !key.isActivated) {
            key.isActivated = true
          }
        }
      }
      closeExpiryEdit()
    } else {
      showToast(data.message || 'Error al actualizar', 'error')
      // RestablecerGuardarEstado
      if (expiryEditModalRef.value) {
        expiryEditModalRef.value.resetSaving()
      }
    }
  } catch (error) {
    showToast('Error al actualizar', 'error')
    // RestablecerGuardarEstado
    if (expiryEditModalRef.value) {
      expiryEditModalRef.value.resetSaving()
    }
  }
}

// 格式化时间窗口倒计时
const formatWindowTime = (seconds) => {
  if (seconds === null || seconds === undefined) return '--:--'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m${secs}s`
  } else {
    return `${secs}s`
  }
}

// 获取每日Costo进度 - 已移到 LimitProgressBar 组件en
// const getDailyCostProgress = (key) => {
//   if (!key.dailyCostLimit || key.dailyCostLimit === 0) return 0
//   const percentage = ((key.dailyCost || 0) / key.dailyCostLimit) * 100
//   return Math.min(percentage, 100)
// }

// 获取每日Costo进度registros颜色 - 已移到 LimitProgressBar 组件en
// const getDailyCostProgressColor = (key) => {
//   const progress = getDailyCostProgress(key)
//   if (progress >= 100) return 'bg-red-500'
//   if (progress >= 80) return 'bg-yellow-500'
//   return 'bg-green-500'
// }

// 获取 Opus 周Costo进度 - 已移到 LimitBadge 组件en
// const getWeeklyOpusCostProgress = (key) => {
//   if (!key.weeklyOpusCostLimit || key.weeklyOpusCostLimit === 0) return 0
//   const percentage = ((key.weeklyOpusCost || 0) / key.weeklyOpusCostLimit) * 100
//   return Math.min(percentage, 100)
// }

// 获取 Opus 周Costo进度registros颜色 - 已移到 LimitBadge 组件en
// const getWeeklyOpusCostProgressColor = (key) => {
//   const progress = getWeeklyOpusCostProgress(key)
//   if (progress >= 100) return 'bg-red-500'
//   if (progress >= 80) return 'bg-yellow-500'
//   return 'bg-green-500'
// }

// 获取totalCost进度 - 暂时不用
// const getTotalCostProgress = (key) => {
//   if (!key.totalCostLimit || key.totalCostLimit === 0) return 0
//   const percentage = ((key.totalCost || 0) / key.totalCostLimit) * 100
//   return Math.min(percentage, 100)
// }

// 显示使用Detalles
const showUsageDetails = (apiKey) => {
  const cachedStats = getCachedStats(apiKey.id)

  const enrichedApiKey = {
    ...apiKey,
    dailyCost: cachedStats?.dailyCost ?? apiKey.dailyCost ?? 0,
    weeklyOpusCost: cachedStats?.weeklyOpusCost ?? apiKey.weeklyOpusCost ?? 0,
    currentWindowCost: cachedStats?.currentWindowCost ?? apiKey.currentWindowCost ?? 0,
    currentWindowRequests: cachedStats?.currentWindowRequests ?? apiKey.currentWindowRequests ?? 0,
    currentWindowTokens: cachedStats?.currentWindowTokens ?? apiKey.currentWindowTokens ?? 0,
    windowRemainingSeconds: cachedStats?.windowRemainingSeconds ?? apiKey.windowRemainingSeconds,
    windowStartTime: cachedStats?.windowStartTime ?? apiKey.windowStartTime ?? null,
    windowEndTime: cachedStats?.windowEndTime ?? apiKey.windowEndTime ?? null,
    usage: {
      ...apiKey.usage,
      total: {
        ...apiKey.usage?.total,
        requests: cachedStats?.requests ?? apiKey.usage?.total?.requests ?? 0,
        tokens: cachedStats?.tokens ?? apiKey.usage?.total?.tokens ?? 0,
        cost: cachedStats?.allTimeCost ?? apiKey.usage?.total?.cost ?? 0,
        inputTokens: cachedStats?.inputTokens ?? apiKey.usage?.total?.inputTokens ?? 0,
        outputTokens: cachedStats?.outputTokens ?? apiKey.usage?.total?.outputTokens ?? 0,
        cacheCreateTokens:
          cachedStats?.cacheCreateTokens ?? apiKey.usage?.total?.cacheCreateTokens ?? 0,
        cacheReadTokens: cachedStats?.cacheReadTokens ?? apiKey.usage?.total?.cacheReadTokens ?? 0
      }
    }
  }

  selectedApiKeyForDetail.value = enrichedApiKey
  showUsageDetailModal.value = true
}

const openTimeline = (keyId) => {
  const id = keyId || selectedApiKeyForDetail.value?.id
  if (!id) return
  showUsageDetailModal.value = false
  router.push(`/api-keys/${id}/usage-records`)
}

// 格式化时间（秒转换para可读格式） - 已移到 WindowLimitBar 组件en
// const formatTime = (seconds) => {
//   if (seconds === null || seconds === undefined) return '--:--'
//
//   const hours = Math.floor(seconds / 3600)
//   const minutes = Math.floor((seconds % 3600) / 60)
//   const secs = seconds % 60
//
//   if (hours > 0) {
//     return `${hours}h ${minutes}m`
//   } else if (minutes > 0) {
//     return `${minutes}m ${secs}s`
//   } else {
//     return `${secs}s`
//   }
// }

// 格式化最siguiente使用时间
const formatLastUsed = (dateString) => {
  if (!dateString) return 'de未使用'
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟anterior`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时anterior`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天anterior`
  return date.toLocaleDateString('zh-CN')
}

const ACCOUNT_TYPE_LABELS = {
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  droid: 'Droid',
  deleted: '已Eliminar',
  other: 'Otro'
}

const MAX_LAST_USAGE_NAME_LENGTH = 16

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const normalizeFrontendAccountCategory = (type) => {
  if (!type) return 'other'
  const lower = String(type).toLowerCase()
  if (lower === 'claude-console' || lower === 'claude_console' || lower === 'claude') {
    return 'claude'
  }
  if (
    lower === 'openai' ||
    lower === 'openai-responses' ||
    lower === 'openai_responses' ||
    lower === 'azure-openai' ||
    lower === 'azure_openai'
  ) {
    return 'openai'
  }
  if (lower === 'gemini' || lower === 'gemini-api' || lower === 'gemini_api') {
    return 'gemini'
  }
  if (lower === 'droid') {
    return 'droid'
  }
  return 'other'
}

// 获取最siguiente使用账号Información（优先deCaché获取）
const getLastUsageInfo = (apiKey) => {
  if (!apiKey) return null
  // 优先deCaché获取
  const cached = getCachedLastUsage(apiKey.id)
  if (cached !== null) return cached
  // 兼容旧数据（如果siguiente端直接返回 lastUsage）
  return apiKey.lastUsage || null
}

const hasLastUsageAccount = (apiKey) => {
  // 如果正en加载，返回 false（让 loading Estado显示）
  if (isLastUsageLoading(apiKey?.id)) return false
  const info = getLastUsageInfo(apiKey)
  return !!(info && (info.accountName || info.accountId || info.rawAccountId))
}

const isLikelyDeletedUsage = (info) => {
  if (!info) return false
  if (info.accountCategory === 'deleted') return true

  const rawId = typeof info.rawAccountId === 'string' ? info.rawAccountId.trim() : ''
  const accountName = typeof info.accountName === 'string' ? info.accountName.trim() : ''
  const accountType =
    typeof info.accountType === 'string' ? info.accountType.trim().toLowerCase() : ''

  if (!rawId) return false

  const looksLikeUuid = UUID_PATTERN.test(rawId)
  const nameMissingOrSame = !accountName || accountName === rawId
  const normalizedType = normalizeFrontendAccountCategory(accountType)
  const typeUnknown = !accountType || accountType === 'unknown' || normalizedType === 'other'

  return looksLikeUuid && nameMissingOrSame && typeUnknown
}

const getLastUsageBaseName = (info) => {
  if (!info) return 'Desconocido账号'
  if (isLikelyDeletedUsage(info)) {
    return '已Eliminar'
  }
  return info.accountName || info.accountId || info.rawAccountId || 'Desconocido账号'
}

const getLastUsageFullName = (apiKey) => getLastUsageBaseName(getLastUsageInfo(apiKey))

const getLastUsageDisplayName = (apiKey) => {
  const full = getLastUsageFullName(apiKey)
  return full.length > MAX_LAST_USAGE_NAME_LENGTH
    ? `${full.slice(0, MAX_LAST_USAGE_NAME_LENGTH)}...`
    : full
}

const getLastUsageTypeLabel = (apiKey) => {
  const info = getLastUsageInfo(apiKey)
  if (isLikelyDeletedUsage(info)) {
    return ACCOUNT_TYPE_LABELS.deleted
  }
  const category = info?.accountCategory || normalizeFrontendAccountCategory(info?.accountType)
  return ACCOUNT_TYPE_LABELS[category] || ACCOUNT_TYPE_LABELS.other
}

const isLastUsageDeleted = (apiKey) => {
  const info = getLastUsageInfo(apiKey)
  return isLikelyDeletedUsage(info)
}

// 清除Buscar
const clearSearch = () => {
  searchKeyword.value = ''
  currentPage.value = 1
}

// Exportar数据到Excel
const exportToExcel = () => {
  try {
    // 准备Exportar数据 - 简化版本
    const exportData = sortedApiKeys.value.map((key) => {
      // 获取当anterior时间段数据
      const periodRequests = getPeriodRequests(key)
      const periodCost = calculatePeriodCost(key)
      const periodTokens = getPeriodTokens(key)
      const periodInputTokens = getPeriodInputTokens(key)
      const periodOutputTokens = getPeriodOutputTokens(key)

      // 基础数据
      const baseData = {
        ID: key.id || '',
        Nombre: key.name || '',
        Descripción: key.description || '',
        Estado: key.isActive ? 'Habilitar' : 'Deshabilitar',
        APIClave: key.apiKey || '',

        // 过期配置
        过期模式:
          key.expirationMode === 'activation'
            ? '首veces使用siguiente激活'
            : key.expirationMode === 'fixed'
              ? '固定时间'
              : '无',
        激活期限: key.activationDays || '',
        激活单位:
          key.activationUnit === 'hours' ? '小时' : key.activationUnit === 'days' ? '天' : '',
        已激活: key.isActivated ? '是' : '否',
        激活时间: key.activatedAt ? formatDate(key.activatedAt) : '',
        expiresAt: key.expiresAt ? formatDate(key.expiresAt) : '',

        // 权限配置
        services: (() => {
          const p = key.permissions
          if (!p || p === 'all') return 'Todos los servicios'
          if (Array.isArray(p)) return p.length === 0 ? 'Todos los servicios' : p.join(', ')
          return p
        })(),

        // Configuración de límites
        tokenLimit: key.tokenLimit === '0' || key.tokenLimit === 0 ? 'Sin límite' : key.tokenLimit || '',
        concurrencyLimit:
          key.concurrencyLimit === '0' || key.concurrencyLimit === 0
            ? 'Sin límite'
            : key.concurrencyLimit || '',
        rateLimitWindow:
          key.rateLimitWindow === '0' || key.rateLimitWindow === 0
            ? 'Sin límite'
            : key.rateLimitWindow || '',
        rateLimitRequests:
          key.rateLimitRequests === '0' || key.rateLimitRequests === 0
            ? 'Sin límite'
            : key.rateLimitRequests || '',
        dailyCostLimit:
          key.dailyCostLimit === '0' || key.dailyCostLimit === 0
            ? 'Sin límite'
            : `$${key.dailyCostLimit}` || '',
        totalCostLimit:
          key.totalCostLimit === '0' || key.totalCostLimit === 0
            ? 'Sin límite'
            : `$${key.totalCostLimit}` || '',

        // Cuenta绑定
        claudeAccountId: key.claudeAccountId || '',
        claudeConsoleAccountId: key.claudeConsoleAccountId || '',
        geminiAccountId: key.geminiAccountId || '',
        openaiAccountId: key.openaiAccountId || '',
        azureOpenaiAccountId: key.azureOpenaiAccountId || '',
        bedrockAccountId: key.bedrockAccountId || '',
        droidAccountId: key.droidAccountId || '',

        // ModeloyLímite de clientes
        enableModelRestriction: key.enableModelRestriction ? 'Sí' : 'No',
        restrictedModels:
          key.restrictedModels && key.restrictedModels.length > 0
            ? key.restrictedModels.join('; ')
            : '',
        enableClientRestriction: key.enableClientRestriction ? 'Sí' : 'No',
        allowedClients:
          key.allowedClients && key.allowedClients.length > 0 ? key.allowedClients.join('; ') : '',

        // CrearInformación
        createdAt: key.createdAt ? formatDate(key.createdAt) : '',
        createdBy: key.createdBy || '',
        userId: key.userId || '',
        userUsername: key.userUsername || '',

        // 使用Estadísticas
        tags: key.tags && key.tags.length > 0 ? key.tags.join(', ') : 'Ninguno',
        requests: periodRequests,
        cost: periodCost.toFixed(2),
        tokens: formatTokenCount(periodTokens),
        inputTokens: formatTokenCount(periodInputTokens),
        outputTokens: formatTokenCount(periodOutputTokens),
        lastUsedAt: key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Nunca usado',
        lastUsedAccount: getLastUsageFullName(key),
        lastUsedType: getLastUsageTypeLabel(key)
      }

      // 添加分ModeloEstadísticas
      const modelStats = {}

      // 根据当anterior时间Filtrarregistros件获取对应ModeloEstadísticas
      let modelsData = null

      if (globalDateFilter.preset === 'today') {
        modelsData = key.usage?.daily?.models
      } else if (globalDateFilter.preset === '7days') {
        modelsData = key.usage?.weekly?.models
      } else if (globalDateFilter.preset === '30days') {
        modelsData = key.usage?.monthly?.models
      } else if (globalDateFilter.preset === 'all') {
        modelsData = key.usage?.total?.models
      }

      // 处理ModeloEstadísticas
      if (modelsData) {
        Object.entries(modelsData).forEach(([model, stats]) => {
          // 简化Nombre del modelo，去掉anterior缀
          let modelName = model
          if (model.includes(':')) {
            modelName = model.split(':').pop() // 取最siguiente一部分
          }
          modelName = modelName.replace(/[:/]/g, '_')

          modelStats[`${modelName}_Solicitud数`] = stats.requests || 0
          modelStats[`${modelName}_Costo($)`] = (stats.cost || 0).toFixed(2)
          modelStats[`${modelName}_Token`] = formatTokenCount(stats.totalTokens || 0)
          modelStats[`${modelName}_EntradaToken`] = formatTokenCount(stats.inputTokens || 0)
          modelStats[`${modelName}_SalidaToken`] = formatTokenCount(stats.outputTokens || 0)
        })
      }

      return { ...baseData, ...modelStats }
    })

    // Crear工作簿
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)

    // 获取工作表范围
    const range = XLSX.utils.decode_range(ws['!ref'])

    // Configuración列宽
    const headers = Object.keys(exportData[0] || {})
    const columnWidths = headers.map((header) => {
      // 基本Información字段
      if (header === 'ID') return { wch: 40 }
      if (header === 'Nombre') return { wch: 25 }
      if (header === 'Descripción') return { wch: 30 }
      if (header === 'APIClave') return { wch: 45 }
      if (header === 'Etiqueta') return { wch: 20 }

      // 时间字段
      if (header.includes('时间')) return { wch: 20 }

      // Límite字段
      if (header.includes('Límite')) return { wch: 15 }
      if (header.includes('Costo')) return { wch: 15 }
      if (header.includes('Token')) return { wch: 15 }
      if (header.includes('Solicitud')) return { wch: 12 }

      // Cuenta绑定字段
      if (header.includes('Cuenta')) return { wch: 30 }

      // 权限配置字段
      if (header.includes('权限') || header.includes('Modelo') || header.includes('客户端'))
        return { wch: 20 }

      // 激活配置字段
      if (header.includes('激活') || header.includes('过期')) return { wch: 18 }

      // 默认宽度
      return { wch: 15 }
    })
    ws['!cols'] = columnWidths

    // 应用样式到标题行
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C })
      if (!ws[cellAddress]) continue

      const header = headers[C]
      const isModelColumn = header && header.includes('_')

      ws[cellAddress].s = {
        fill: {
          fgColor: { rgb: isModelColumn ? '70AD47' : '4472C4' }
        },
        font: {
          color: { rgb: 'FFFFFF' },
          bold: true,
          sz: 12
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center'
        },
        border: {
          top: { style: 'thin', color: { rgb: '2F5597' } },
          bottom: { style: 'thin', color: { rgb: '2F5597' } },
          left: { style: 'thin', color: { rgb: '2F5597' } },
          right: { style: 'thin', color: { rgb: '2F5597' } }
        }
      }
    }

    // 应用样式到数据行
    for (let R = 1; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
        if (!ws[cellAddress]) continue

        const header = headers[C]
        const value = ws[cellAddress].v

        // 基础样式
        const cellStyle = {
          font: { sz: 11 },
          border: {
            top: { style: 'thin', color: { rgb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
            left: { style: 'thin', color: { rgb: 'D3D3D3' } },
            right: { style: 'thin', color: { rgb: 'D3D3D3' } }
          }
        }

        // 偶数行背景色
        if (R % 2 === 0) {
          cellStyle.fill = { fgColor: { rgb: 'F2F2F2' } }
        }

        // 根据列TipoConfiguración对齐y特殊样式
        if (header === 'Nombre') {
          cellStyle.alignment = { horizontal: 'left', vertical: 'center' }
        } else if (header === 'Etiqueta') {
          cellStyle.alignment = { horizontal: 'left', vertical: 'center' }
          if (value === '无') {
            cellStyle.font = { ...cellStyle.font, color: { rgb: '999999' }, italic: true }
          }
        } else if (header === '最siguiente使用时间') {
          cellStyle.alignment = { horizontal: 'right', vertical: 'center' }
          if (value === 'de未使用') {
            cellStyle.font = { ...cellStyle.font, color: { rgb: '999999' }, italic: true }
          }
        } else if (header && header.includes('Costo')) {
          cellStyle.alignment = { horizontal: 'right', vertical: 'center' }
          cellStyle.font = { ...cellStyle.font, color: { rgb: '0066CC' }, bold: true }
        } else if (header && (header.includes('Token') || header.includes('Solicitud'))) {
          cellStyle.alignment = { horizontal: 'right', vertical: 'center' }
        }

        ws[cellAddress].s = cellStyle
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, '用量Estadísticas')

    // 生成文件名（包含时间戳yFiltrarregistros件）
    const now = new Date()
    const timestamp =
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      '_' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0')

    let timeRangeLabel = ''
    if (globalDateFilter.type === 'preset') {
      const presetLabels = {
        today: 'Hoy',
        '7days': '最近7天',
        '30days': '最近30天',
        all: '全部时间'
      }
      timeRangeLabel = presetLabels[globalDateFilter.preset] || globalDateFilter.preset
    } else {
      timeRangeLabel = '自定义时间'
    }

    const filename = `API_Keys_用量Estadísticas_${timeRangeLabel}_${timestamp}.xlsx`

    // Exportar文件
    XLSX.writeFile(wb, filename)

    showToast(`ExitosoExportar ${exportData.length} registrosAPI Key用量数据`, 'success')
  } catch (error) {
    // console.error('ExportarFallido:', error)
    showToast('ExportarFallido，请重试', 'error')
  }
}

// 监听Filtrarregistros件变化，Restablecer页码y选enEstado
// 监听Filtrarregistros件变化（不包括Buscar），清空选enEstado
watch([selectedTagFilter, apiKeyStatsTimeRange], () => {
  currentPage.value = 1
  // 清空选enEstado
  selectedApiKeys.value = []
  updateSelectAllState()
})

// Buscar防抖定时器
let searchDebounceTimer = null

// 监听Buscar关键词变化，使用防抖重新加载数据
watch(searchKeyword, () => {
  // 清除之anterior定时器
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  // Configuración防抖（300ms）
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadApiKeys(false) // 不清除EstadísticasCaché
  }, 300)
})

// 监听Buscar模式变化，重新加载数据
watch(searchMode, () => {
  currentPage.value = 1
  loadApiKeys(false)
})

// 监听EtiquetaFiltrar变化，重新加载数据
watch(selectedTagFilter, () => {
  currentPage.value = 1
  loadApiKeys(false)
})

// 监听ModeloFiltrar变化
watch(selectedModels, () => {
  currentPage.value = 1
  loadApiKeys(false)
})

// 监听Ordenar变化，重新加载数据
watch([apiKeysSortBy, apiKeysSortOrder], () => {
  loadApiKeys(false)
})

// 监听分页变化，重新加载数据
watch([currentPage, pageSize], ([newPage, newPageSize], [oldPage, oldPageSize]) => {
  // 只有页码o每页数量真正变化时才重新加载
  if (newPage !== oldPage || newPageSize !== oldPageSize) {
    loadApiKeys(false)
  }
  updateSelectAllState()
})

// 监听每页显示registros数变化，Guardar到 localStorage
watch(pageSize, (newSize) => {
  localStorage.setItem('apiKeysPageSize', newSize.toString())
})

// 监听API Keys数据变化，清理Inválido选enEstado
watch(apiKeys, () => {
  const validIds = new Set(apiKeys.value.map((key) => key.id))

  // 过滤出仍然Válido选en项
  selectedApiKeys.value = selectedApiKeys.value.filter((id) => validIds.has(id))

  updateSelectAllState()
})

onMounted(async () => {
  // 获取CostoOrdenar索引Estado（不阻塞，会自动调度siguiente续Actualizar）
  fetchCostSortStatus()

  // 先加载 API Keys（优先显示列表）
  // supported-clients 由 Create/Edit 模态框按需加载，无需预加载
  await Promise.all([loadApiKeys(), loadUsedModels()])

  // 初始化全选Estado
  updateSelectAllState()

  // 异步加载账号数据（不阻塞页面显示）
  loadAccounts()
})

// 组件卸载时清理定时器
onUnmounted(() => {
  if (costSortStatusTimer) {
    clearTimeout(costSortStatusTimer)
    costSortStatusTimer = null
  }
})
</script>

<style scoped>
.tab-content {
  min-height: calc(100vh - 300px);
}

.table-wrapper {
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  width: 100%;
  position: relative;
}

.dark .table-wrapper {
  border-color: rgba(255, 255, 255, 0.1);
}

.table-container {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 0;
  padding: 0;
  max-width: 100%;
  position: relative;
  -webkit-overflow-scrolling: touch;
}

/* 防止表格内容溢出，保证横向滚动 */
.table-container table {
  min-width: 1400px;
  border-collapse: collapse;
  table-layout: auto;
}

.table-container::-webkit-scrollbar {
  height: 8px;
}

.table-container::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.table-container::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.table-container::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.dark .table-container::-webkit-scrollbar-track {
  background: var(--bg-gradient-mid);
}

.dark .table-container::-webkit-scrollbar-thumb {
  background: var(--bg-gradient-end);
}

.dark .table-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* 统一 hover 背景 - 所有 td 使用Tema色 */
.table-container tbody tr:hover > td {
  background-color: rgba(var(--primary-rgb), 0.06) !important;
}

.dark .table-container tbody tr:hover > td {
  background-color: rgba(var(--primary-rgb), 0.16) !important;
}

/* 所有 td 斑马纹背景 */
.table-container tbody tr:nth-child(odd) > td {
  background-color: #ffffff;
}

.table-container tbody tr:nth-child(even) > td {
  background-color: #f9fafb;
}

.dark .table-container tbody tr:nth-child(odd) > td {
  background-color: var(--bg-gradient-start);
}

.dark .table-container tbody tr:nth-child(even) > td {
  background-color: var(--bg-gradient-mid);
}

/* 固定Operación列enderecha侧，兼容浅色y深色模式 */
.operations-column {
  position: sticky;
  right: 0;
  z-index: 12;
}

/* 确保Operación列en浅色模式abajo有正确背景 - 使用纯色避免滚动时重叠 */
.table-container thead .operations-column {
  z-index: 30;
  background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
}

.dark .table-container thead .operations-column {
  background: linear-gradient(to bottom, var(--bg-gradient-mid), var(--bg-gradient-start));
}

.table-container tbody .operations-column {
  box-shadow: -8px 0 12px -8px rgba(15, 23, 42, 0.16);
}

.dark .table-container tbody .operations-column {
  box-shadow: -8px 0 12px -8px rgba(30, 41, 59, 0.45);
}

/* 固定izquierda侧列（复选框yNombre列）*/
.checkbox-column,
.name-column {
  position: sticky;
  z-index: 12;
}

/* 表头izquierda侧固定列背景 - 使用纯色避免滚动时重叠 */
.table-container thead .checkbox-column,
.table-container thead .name-column {
  z-index: 30;
  background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
}

.dark .table-container thead .checkbox-column,
.dark .table-container thead .name-column {
  background: linear-gradient(to bottom, var(--bg-gradient-mid), var(--bg-gradient-start));
}

/* Nombre列derecha侧阴影（分隔效果） */
.table-container tbody .name-column {
  box-shadow: 8px 0 12px -8px rgba(15, 23, 42, 0.16);
}

.dark .table-container tbody .name-column {
  box-shadow: 8px 0 12px -8px rgba(30, 41, 59, 0.45);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.api-key-date-picker :deep(.el-input__inner) {
  @apply border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500;
}

.api-key-date-picker :deep(.el-range-separator) {
  @apply text-gray-500;
}

/* 自定义Rango de fechas选择器高度对齐 */
.custom-date-range-picker :deep(.el-input__wrapper) {
  @apply h-[38px] rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-600 dark:bg-gray-800;
}
.custom-date-range-picker :deep(.el-input__inner) {
  @apply h-full py-2 text-sm font-medium text-gray-700 dark:text-gray-200;
}
.custom-date-range-picker :deep(.el-input__prefix),
.custom-date-range-picker :deep(.el-input__suffix) {
  @apply flex items-center;
}
.custom-date-range-picker :deep(.el-range-separator) {
  @apply mx-2 text-gray-500;
}
</style>
