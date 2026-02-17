<template>
  <div class="accounts-container">
    <div class="card p-4 sm:p-6">
      <div class="mb-4 flex flex-col gap-4 sm:mb-6">
        <div>
          <h3 class="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100 sm:mb-2 sm:text-xl">
            Gestión de Cuentas
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 sm:text-base">
            Administra cuentas y configuraciones de proxy para Claude, Gemini, OpenAI, etc.
          </p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <!-- Grupo de filtros -->
          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <!-- Selector de ordenamiento -->
            <div class="group relative min-w-[160px]">
              <div
                class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
              ></div>
              <CustomDropdown
                v-model="accountsSortBy"
                :icon="accountsSortOrder === 'asc' ? 'fa-sort-amount-up' : 'fa-sort-amount-down'"
                icon-color="text-indigo-500"
                :options="sortOptions"
                placeholder="Seleccionar ordenamiento"
                @change="handleDropdownSort"
              />
            </div>

            <!-- Filtro de plataforma -->
            <div class="group relative min-w-[140px]">
              <div
                class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
              ></div>
              <CustomDropdown
                v-model="platformFilter"
                icon="fa-server"
                icon-color="text-blue-500"
                :options="platformOptions"
                placeholder="Seleccionar plataforma"
                @change="filterByPlatform"
              />
            </div>

            <!-- Filtro de grupos -->
            <div class="group relative min-w-[160px]">
              <div
                class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
              ></div>
              <CustomDropdown
                v-model="groupFilter"
                icon="fa-layer-group"
                icon-color="text-purple-500"
                :options="groupOptions"
                placeholder="Seleccionar grupo"
                @change="filterByGroup"
              />
            </div>

            <!-- Filtro de estado -->
            <div class="group relative min-w-[120px]">
              <div
                class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
              ></div>
              <CustomDropdown
                v-model="statusFilter"
                icon="fa-check-circle"
                icon-color="text-green-500"
                :options="statusOptions"
                placeholder="Seleccionar estado"
              />
            </div>

            <!-- Cuadro de búsqueda -->
            <div class="group relative min-w-[200px]">
              <div
                class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
              ></div>
              <div class="relative flex items-center">
                <input
                  v-model="searchKeyword"
                  class="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pl-9 text-sm text-gray-700 placeholder-gray-400 shadow-sm transition-all duration-200 hover:border-gray-300 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 dark:hover:border-gray-500"
                  placeholder="Buscar nombre de cuenta..."
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

          <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <!-- Botón de estadísticas de cuentas -->
            <div class="relative">
              <el-tooltip content="Ver resumen de estadísticas de cuentas" effect="dark" placement="bottom">
                <button
                  class="group relative flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 sm:w-auto"
                  @click="showAccountStatsModal = true"
                >
                  <div
                    class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                  ></div>
                  <i class="fas fa-chart-bar relative text-violet-500" />
                  <span class="relative">Estadísticas</span>
                </button>
              </el-tooltip>
            </div>

            <!-- Botón de actualización -->
            <div class="relative">
              <el-tooltip
                content="Actualizar datos (Ctrl/⌘+clic para forzar la actualización de todos los cachés)"
                effect="dark"
                placement="bottom"
              >
                <button
                  class="group relative flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 sm:w-auto"
                  :disabled="accountsLoading"
                  @click.ctrl.exact="loadAccounts(true)"
                  @click.exact="loadAccounts(false)"
                  @click.meta.exact="loadAccounts(true)"
                >
                  <div
                    class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                  ></div>
                  <i
                    :class="[
                      'fas relative text-green-500',
                      accountsLoading ? 'fa-spinner fa-spin' : 'fa-sync-alt'
                    ]"
                  />
                  <span class="relative">Actualizar</span>
                </button>
              </el-tooltip>
            </div>

            <!-- Actualizar saldobotón -->
            <div class="relative">
              <el-tooltip :content="refreshBalanceTooltip" effect="dark" placement="bottom">
                <button
                  class="group relative flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 sm:w-auto"
                  :disabled="accountsLoading || refreshingBalances || !canRefreshVisibleBalances"
                  @click="refreshVisibleBalances"
                >
                  <div
                    class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                  ></div>
                  <i
                    :class="[
                      'fas relative text-blue-500',
                      refreshingBalances ? 'fa-spinner fa-spin' : 'fa-wallet'
                    ]"
                  />
                  <span class="relative">Actualizar saldo</span>
                </button>
              </el-tooltip>
            </div>

            <!-- Botón de seleccionar/cancelar selección -->
            <button
              class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="toggleSelectionMode"
            >
              <i :class="showCheckboxes ? 'fas fa-times' : 'fas fa-check-square'"></i>
              <span>{{ showCheckboxes ? 'Cancelar selección' : 'Seleccionar' }}</span>
            </button>

            <!-- Botón de gestión de grupos -->
            <div class="relative">
              <el-tooltip content="Administrar grupos de cuentas" effect="dark" placement="bottom">
                <button
                  class="group relative flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 sm:w-auto"
                  @click="showGroupManagementModal = true"
                >
                  <div
                    class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
                  ></div>
                  <i class="fas fa-layer-group relative text-purple-500" />
                  <span class="relative">Grupos</span>
                </button>
              </el-tooltip>
            </div>

            <!-- Botón de eliminación por lotes -->
            <button
              v-if="selectedAccounts.length > 0"
              class="group relative flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-all duration-200 hover:border-red-300 hover:bg-red-100 hover:shadow-md dark:border-red-700 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 sm:w-auto"
              @click="batchDeleteAccounts"
            >
              <div
                class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 opacity-0 blur transition duration-300 group-hover:opacity-20"
              ></div>
              <i class="fas fa-trash relative text-red-600 dark:text-red-400" />
              <span class="relative">Eliminar seleccionados ({{ selectedAccounts.length }})</span>
            </button>

            <!-- Botón de agregar cuenta -->
            <button
              class="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-200 hover:from-green-600 hover:to-green-700 hover:shadow-lg sm:w-auto"
              @click.stop="openCreateAccountModal"
            >
              <i class="fas fa-plus"></i>
              <span>Agregar cuenta</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="accountsLoading" class="py-12 text-center">
        <div class="loading-spinner mx-auto mb-4" />
        <p class="text-gray-500 dark:text-gray-400">Cargando cuentas...</p>
      </div>

      <div v-else-if="sortedAccounts.length === 0" class="py-12 text-center">
        <div
          class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
        >
          <i class="fas fa-user-circle text-xl text-gray-400" />
        </div>
        <p class="text-lg text-gray-500 dark:text-gray-400">No hay cuentas</p>
        <p class="mt-2 text-sm text-gray-400 dark:text-gray-500">Haz clic en el botón de arriba para agregar tu primera cuenta</p>
      </div>

      <!-- Vista de tabla de escritorio -->
      <div v-else class="table-wrapper hidden md:block">
        <div ref="tableContainerRef" class="table-container">
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
                  class="name-column sticky z-20 min-w-[180px] cursor-pointer px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                  :class="shouldShowCheckboxes ? 'left-[50px]' : 'left-0'"
                  @click="sortAccounts('name')"
                >
                  Nombre
                  <i
                    v-if="accountsSortBy === 'name'"
                    :class="[
                      'fas',
                      accountsSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                      'ml-1'
                    ]"
                  />
                  <i v-else class="fas fa-sort ml-1 text-gray-400" />
                </th>
                <th
                  class="min-w-[220px] cursor-pointer px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                  @click="sortAccounts('platform')"
                >
                  Plataforma/Tipo
                  <i
                    v-if="accountsSortBy === 'platform'"
                    :class="[
                      'fas',
                      accountsSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                      'ml-1'
                    ]"
                  />
                  <i v-else class="fas fa-sort ml-1 text-gray-400" />
                </th>
                <th
                  class="w-[120px] min-w-[180px] max-w-[200px] cursor-pointer px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                  @click="sortAccounts('status')"
                >
                  Estado
                  <i
                    v-if="accountsSortBy === 'status'"
                    :class="[
                      'fas',
                      accountsSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                      'ml-1'
                    ]"
                  />
                  <i v-else class="fas fa-sort ml-1 text-gray-400" />
                </th>
                <th
                  class="min-w-[150px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                >
                  Uso de hoy
                </th>
                <th
                  class="min-w-[220px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                >
                  Saldo/Cuota
                </th>
                <th
                  class="min-w-[210px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                >
                  <div class="flex items-center gap-2">
                    <span>Ventana de sesión</span>
                    <el-tooltip placement="top">
                      <template #content>
                        <div
                          class="w-[260px] space-y-3 text-xs leading-relaxed text-white dark:text-gray-800"
                        >
                          <div class="space-y-2">
                            <div class="text-sm font-semibold text-white dark:text-gray-900">
                              Serie Claude
                            </div>
                            <div class="text-gray-200 dark:text-gray-600">
                              Ventana de sesiónprogreso表示 5 小cuandoventana推移，colorsugerencia当antes deProgramarEstado。
                            </div>
                            <div class="space-y-1 pt-1 text-gray-200 dark:text-gray-600">
                              <div class="flex items-center gap-2">
                                <div
                                  class="h-2 w-16 rounded bg-gradient-to-r from-blue-500 to-indigo-600"
                                ></div>
                                <span class="font-medium text-white dark:text-gray-900"
                                  >Normal: Solicitudes procesadas normalmente</span
                                >
                              </div>
                              <div class="flex items-center gap-2">
                                <div
                                  class="h-2 w-16 rounded bg-gradient-to-r from-yellow-500 to-orange-500"
                                ></div>
                                <span class="font-medium text-white dark:text-gray-900"
                                  >Advertencia: Cerca del límite</span
                                >
                              </div>
                              <div class="flex items-center gap-2">
                                <div
                                  class="h-2 w-16 rounded bg-gradient-to-r from-red-500 to-red-600"
                                ></div>
                                <span class="font-medium text-white dark:text-gray-900"
                                  >Rechazado: Límite de tasa alcanzado</span
                                >
                              </div>
                            </div>
                          </div>
                          <div class="h-px bg-gray-200 dark:bg-gray-600/50"></div>
                          <div class="space-y-2">
                            <div class="text-sm font-semibold text-white dark:text-gray-900">
                              OpenAI
                            </div>
                            <div class="text-gray-200 dark:text-gray-600">
                              Las barras de progreso muestran la proporción de uso de cuota de las ventanas de 5h y semanal, los colores tienen el mismo significado que arriba.
                            </div>
                            <div class="space-y-1 text-gray-200 dark:text-gray-600">
                              <div class="flex items-start gap-2">
                                <i class="fas fa-clock mt-[2px] text-[10px] text-blue-500"></i>
                                <span class="font-medium text-white dark:text-gray-900"
                                  >Ventana 5h: Progreso de uso de 5 horas, se restablece automáticamente al llegar al tiempo de reinicio.</span
                                >
                              </div>
                              <div class="flex items-start gap-2">
                                <i class="fas fa-history mt-[2px] text-[10px] text-emerald-500"></i>
                                <span class="font-medium text-white dark:text-gray-900"
                                  >Ventana semanal: Progreso de uso de 7 días, también vuelve a 0% al reiniciarse.</span
                                >
                              </div>
                              <div class="flex items-start gap-2">
                                <i
                                  class="fas fa-info-circle mt-[2px] text-[10px] text-indigo-500"
                                ></i>
                                <span class="font-medium text-white dark:text-gray-900"
                                  >Cuando "Restante para reinicio" es 0, la barra de progreso y el porcentaje se restablecen simultáneamente.</span
                                >
                              </div>
                            </div>
                          </div>
                          <div class="h-px bg-gray-200 dark:bg-gray-600/50"></div>
                          <div class="space-y-2">
                            <div class="text-sm font-semibold text-white dark:text-gray-900">
                              Cuenta Claude OAuth
                            </div>
                            <div class="text-gray-200 dark:text-gray-600">
                              Muestra la tasa de uso de tres ventanas (porcentaje de utilización), los colores tienen el mismo significado.
                            </div>
                            <div class="space-y-1 text-gray-200 dark:text-gray-600">
                              <div class="flex items-start gap-2">
                                <i class="fas fa-clock mt-[2px] text-[10px] text-indigo-500"></i>
                                <span class="font-medium text-white dark:text-gray-900"
                                  >Ventana 5h: Tasa de uso de la ventana deslizante de 5 horas.</span
                                >
                              </div>
                              <div class="flex items-start gap-2">
                                <i
                                  class="fas fa-calendar-alt mt-[2px] text-[10px] text-emerald-500"
                                ></i>
                                <span class="font-medium text-white dark:text-gray-900"
                                  >Ventana 7d: Tasa de uso del límite total de 7 días.</span
                                >
                              </div>
                              <div class="flex items-start gap-2">
                                <i class="fas fa-gem mt-[2px] text-[10px] text-purple-500"></i>
                                <span class="font-medium text-white dark:text-gray-900"
                                  >Ventana Sonnet: Límite dedicado para el modelo Sonnet de 7 días.</span
                                >
                              </div>
                              <div class="flex items-start gap-2">
                                <i class="fas fa-sync-alt mt-[2px] text-[10px] text-blue-500"></i>
                                <span class="font-medium text-white dark:text-gray-900"
                                  >Se restablece automáticamente al llegar al tiempo de reinicio.</span
                                >
                              </div>
                            </div>
                          </div>
                        </div>
                      </template>
                      <i
                        class="fas fa-question-circle cursor-help text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
                      />
                    </el-tooltip>
                  </div>
                </th>
                <th
                  class="min-w-[80px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                >
                  Último uso
                </th>
                <th
                  class="min-w-[80px] cursor-pointer px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                  @click="sortAccounts('priority')"
                >
                  Prioridad
                  <i
                    v-if="accountsSortBy === 'priority'"
                    :class="[
                      'fas',
                      accountsSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                      'ml-1'
                    ]"
                  />
                  <i v-else class="fas fa-sort ml-1 text-gray-400" />
                </th>
                <th
                  class="min-w-[150px] px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                >
                  Proxy
                </th>
                <th
                  class="min-w-[110px] cursor-pointer px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                  @click="sortAccounts('expiresAt')"
                >
                  Tiempo de expiración
                  <i
                    v-if="accountsSortBy === 'expiresAt'"
                    :class="[
                      'fas',
                      accountsSortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down',
                      'ml-1'
                    ]"
                  />
                  <i v-else class="fas fa-sort ml-1 text-gray-400" />
                </th>
                <th
                  class="operations-column sticky right-0 z-20 px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"
                  :class="needsHorizontalScroll ? 'min-w-[170px]' : 'min-w-[200px]'"
                >
                  Operaciones
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200/50 dark:divide-gray-600/50">
              <tr v-for="account in paginatedAccounts" :key="account.id" class="table-row">
                <td
                  v-if="shouldShowCheckboxes"
                  class="checkbox-column sticky left-0 z-10 px-3 py-3"
                >
                  <div class="flex items-center">
                    <input
                      v-model="selectedAccounts"
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      type="checkbox"
                      :value="account.id"
                      @change="updateSelectAllState"
                    />
                  </div>
                </td>
                <td
                  class="name-column sticky z-10 px-3 py-4"
                  :class="shouldShowCheckboxes ? 'left-[50px]' : 'left-0'"
                >
                  <div class="flex items-center">
                    <div
                      class="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600"
                    >
                      <i class="fas fa-user-circle text-xs text-white" />
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <div
                          class="cursor-pointer truncate text-sm font-semibold text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                          title="Clic para copiar"
                          @click.stop="copyText(account.name)"
                        >
                          {{ account.name }}
                        </div>
                        <span
                          v-if="account.accountType === 'dedicated'"
                          class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
                        >
                          <i class="fas fa-lock mr-1" />Exclusiva
                        </span>
                        <span
                          v-else-if="account.accountType === 'group'"
                          class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                        >
                          <i class="fas fa-layer-group mr-1" />GruposProgramar
                        </span>
                        <span
                          v-else
                          class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                        >
                          <i class="fas fa-share-alt mr-1" />Compartida
                        </span>
                      </div>
                      <!-- Mostrar todos los grupos - Mostrar en líneas separadas -->
                      <div
                        v-if="account.groupInfos && account.groupInfos.length > 0"
                        class="my-2 flex flex-wrap items-center gap-2"
                      >
                        <span
                          v-for="group in account.groupInfos"
                          :key="group.id"
                          class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                          :title="`所属Grupos: ${group.name}`"
                        >
                          <i class="fas fa-folder mr-1" />{{ group.name }}
                        </span>
                      </div>
                      <div
                        class="truncate text-xs text-gray-500 dark:text-gray-400"
                        :title="account.id"
                      >
                        {{ account.id }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-4">
                  <div class="flex items-center gap-1">
                    <!-- Icono y nombre de plataforma -->
                    <div
                      v-if="account.platform === 'gemini'"
                      class="flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-gradient-to-r from-yellow-100 to-amber-100 px-2.5 py-1"
                    >
                      <i class="fas fa-robot text-xs text-yellow-700" />
                      <span class="text-xs font-semibold text-yellow-800">Gemini</span>
                      <span class="mx-1 h-4 w-px bg-yellow-300" />
                      <span class="text-xs font-medium text-yellow-700">
                        {{ getGeminiAuthType() }}
                      </span>
                    </div>
                    <div
                      v-else-if="account.platform === 'claude-console'"
                      class="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-100 to-pink-100 px-2.5 py-1"
                    >
                      <i class="fas fa-terminal text-xs text-purple-700" />
                      <span class="text-xs font-semibold text-purple-800">Console</span>
                      <span class="mx-1 h-4 w-px bg-purple-300" />
                      <span class="text-xs font-medium text-purple-700">API Key</span>
                    </div>
                    <div
                      v-else-if="account.platform === 'bedrock'"
                      class="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-gradient-to-r from-orange-100 to-red-100 px-2.5 py-1"
                    >
                      <i class="fab fa-aws text-xs text-orange-700" />
                      <span class="text-xs font-semibold text-orange-800">Bedrock</span>
                      <span class="mx-1 h-4 w-px bg-orange-300" />
                      <span class="text-xs font-medium text-orange-700">AWS</span>
                    </div>
                    <div
                      v-else-if="account.platform === 'openai'"
                      class="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-100 bg-gradient-to-r from-gray-100 to-gray-100 px-2.5 py-1"
                    >
                      <div class="fa-openai" />
                      <span class="text-xs font-semibold text-gray-950">OpenAi</span>
                      <span class="mx-1 h-4 w-px bg-gray-400" />
                      <span class="text-xs font-medium text-gray-950">{{
                        getOpenAIAuthType()
                      }}</span>
                    </div>
                    <div
                      v-else-if="account.platform === 'azure_openai'"
                      class="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-100 to-cyan-100 px-2.5 py-1 dark:border-blue-700 dark:from-blue-900/20 dark:to-cyan-900/20"
                    >
                      <i class="fab fa-microsoft text-xs text-blue-700 dark:text-blue-400" />
                      <span class="text-xs font-semibold text-blue-800 dark:text-blue-300"
                        >Azure OpenAI</span
                      >
                      <span class="mx-1 h-4 w-px bg-blue-300 dark:bg-blue-600" />
                      <span class="text-xs font-medium text-blue-700 dark:text-blue-400"
                        >API Key</span
                      >
                    </div>
                    <div
                      v-else-if="account.platform === 'openai-responses'"
                      class="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-gradient-to-r from-teal-100 to-green-100 px-2.5 py-1 dark:border-teal-700 dark:from-teal-900/20 dark:to-green-900/20"
                    >
                      <i class="fas fa-server text-xs text-teal-700 dark:text-teal-400" />
                      <span class="text-xs font-semibold text-teal-800 dark:text-teal-300"
                        >OpenAI-Api</span
                      >
                      <span class="mx-1 h-4 w-px bg-teal-300 dark:bg-teal-600" />
                      <span class="text-xs font-medium text-teal-700 dark:text-teal-400"
                        >API Key</span
                      >
                    </div>
                    <div
                      v-else-if="
                        account.platform === 'claude' || account.platform === 'claude-oauth'
                      "
                      class="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-100 to-blue-100 px-2.5 py-1"
                    >
                      <i class="fas fa-brain text-xs text-indigo-700" />
                      <span class="text-xs font-semibold text-indigo-800">{{
                        getClaudeAccountType(account)
                      }}</span>
                      <span class="mx-1 h-4 w-px bg-indigo-300" />
                      <span class="text-xs font-medium text-indigo-700">
                        {{ getClaudeAuthType(account) }}
                      </span>
                    </div>
                    <div
                      v-else-if="account.platform === 'ccr'"
                      class="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-gradient-to-r from-teal-100 to-emerald-100 px-2.5 py-1 dark:border-teal-700 dark:from-teal-900/20 dark:to-emerald-900/20"
                    >
                      <i class="fas fa-code-branch text-xs text-teal-700 dark:text-teal-400" />
                      <span class="text-xs font-semibold text-teal-800 dark:text-teal-300"
                        >CCR</span
                      >
                      <span class="mx-1 h-4 w-px bg-teal-300 dark:bg-teal-600" />
                      <span class="text-xs font-medium text-teal-700 dark:text-teal-300"
                        >Relay</span
                      >
                    </div>
                    <div
                      v-else-if="account.platform === 'droid'"
                      class="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-gradient-to-r from-cyan-100 to-sky-100 px-2.5 py-1 dark:border-cyan-700 dark:from-cyan-900/20 dark:to-sky-900/20"
                    >
                      <i class="fas fa-robot text-xs text-cyan-700 dark:text-cyan-400" />
                      <span class="text-xs font-semibold text-cyan-800 dark:text-cyan-300"
                        >Droid</span
                      >
                      <span class="mx-1 h-4 w-px bg-cyan-300 dark:bg-cyan-600" />
                      <span class="text-xs font-medium text-cyan-700 dark:text-cyan-300">
                        {{ getDroidAuthType(account) }}
                      </span>
                      <span
                        v-if="isDroidApiKeyMode(account)"
                        :class="getDroidApiKeyBadgeClasses(account)"
                      >
                        <i class="fas fa-key text-[9px]" />
                        <span>x{{ getDroidApiKeyCount(account) }}</span>
                      </span>
                    </div>
                    <div
                      v-else-if="account.platform === 'gemini-api'"
                      class="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-100 to-yellow-100 px-2.5 py-1 dark:border-amber-700 dark:from-amber-900/20 dark:to-yellow-900/20"
                    >
                      <i class="fas fa-robot text-xs text-amber-700 dark:text-amber-400" />
                      <span class="text-xs font-semibold text-amber-800 dark:text-amber-300"
                        >Gemini-API</span
                      >
                      <span class="mx-1 h-4 w-px bg-amber-300 dark:bg-amber-600" />
                      <span class="text-xs font-medium text-amber-700 dark:text-amber-400"
                        >API Key</span
                      >
                    </div>
                    <div
                      v-else
                      class="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gradient-to-r from-gray-100 to-gray-200 px-2.5 py-1"
                    >
                      <i class="fas fa-question text-xs text-gray-700" />
                      <span class="text-xs font-semibold text-gray-800">Desconocido</span>
                    </div>
                  </div>
                </td>
                <td class="w-[100px] min-w-[100px] max-w-[100px] whitespace-nowrap px-3 py-4">
                  <div class="flex flex-col gap-1">
                    <span
                      :class="[
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                        account.status === 'blocked'
                          ? 'bg-orange-100 text-orange-800'
                          : account.status === 'unauthorized'
                            ? 'bg-red-100 text-red-800'
                            : account.status === 'temp_error'
                              ? 'bg-orange-100 text-orange-800'
                              : account.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                      ]"
                    >
                      <div
                        :class="[
                          'mr-2 h-2 w-2 rounded-full',
                          account.status === 'blocked'
                            ? 'bg-orange-500'
                            : account.status === 'unauthorized'
                              ? 'bg-red-500'
                              : account.status === 'temp_error'
                                ? 'bg-orange-500'
                                : account.isActive
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                        ]"
                      />
                      {{
                        account.status === 'blocked'
                          ? 'Bloqueada'
                          : account.status === 'unauthorized'
                            ? 'Anormal'
                            : account.status === 'temp_error'
                              ? 'Anormalidad temporal'
                              : account.isActive
                                ? 'Normal'
                                : 'Anormal'
                      }}
                    </span>
                    <span
                      v-if="
                        (account.rateLimitStatus && account.rateLimitStatus.isRateLimited) ||
                        account.rateLimitStatus === 'limited'
                      "
                      class="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800"
                    >
                      <i class="fas fa-exclamation-triangle mr-1" />
                      Limitando
                      <span
                        v-if="
                          account.rateLimitStatus &&
                          typeof account.rateLimitStatus === 'object' &&
                          account.rateLimitStatus.minutesRemaining > 0
                        "
                        >({{ formatRateLimitTime(account.rateLimitStatus.minutesRemaining) }})</span
                      >
                    </span>
                    <span
                      v-if="account.schedulable === false"
                      class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
                    >
                      <i class="fas fa-pause-circle mr-1" />
                      No programable
                      <el-tooltip
                        v-if="getSchedulableReason(account)"
                        :content="getSchedulableReason(account)"
                        effect="dark"
                        placement="top"
                      >
                        <i class="fas fa-question-circle ml-1 cursor-help text-gray-500" />
                      </el-tooltip>
                    </span>
                    <span
                      v-if="account.status === 'blocked' && account.errorMessage"
                      class="mt-1 max-w-xs truncate text-xs text-gray-500 dark:text-gray-400"
                      :title="account.errorMessage"
                    >
                      {{ account.errorMessage }}
                    </span>
                    <span
                      v-if="account.accountType === 'dedicated'"
                      class="text-xs text-gray-500 dark:text-gray-400"
                    >
                      Vinculada: {{ account.boundApiKeysCount || 0 }} claves API
                    </span>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <div v-if="account.usage && account.usage.daily" class="space-y-1">
                    <div class="flex items-center gap-2">
                      <div class="h-2 w-2 rounded-full bg-blue-500" />
                      <span class="text-sm font-medium text-gray-900 dark:text-gray-100"
                        >{{ account.usage.daily.requests || 0 }} veces</span
                      >
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="h-2 w-2 rounded-full bg-purple-500" />
                      <span class="text-xs text-gray-600 dark:text-gray-300">{{
                        formatNumber(account.usage.daily.allTokens || 0)
                      }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="h-2 w-2 rounded-full bg-green-500" />
                      <span class="text-xs text-gray-600 dark:text-gray-300"
                        >${{ calculateDailyCost(account) }}</span
                      >
                    </div>
                    <div
                      v-if="account.usage.averages && account.usage.averages.rpm > 0"
                      class="text-xs text-gray-500 dark:text-gray-400"
                    >
                      Promedio {{ account.usage.averages.rpm.toFixed(2) }} RPM
                    </div>
                  </div>
                  <div v-else class="text-xs text-gray-400">Sin datos</div>
                </td>
                <td class="whitespace-nowrap px-3 py-4">
                  <BalanceDisplay
                    :account-id="account.id"
                    :initial-balance="account.balanceInfo"
                    :platform="account.platform"
                    :query-mode="
                      account.platform === 'gemini' && account.oauthProvider === 'antigravity'
                        ? 'auto'
                        : 'local'
                    "
                    @error="(error) => handleBalanceError(account.id, error)"
                    @refreshed="(data) => handleBalanceRefreshed(account.id, data)"
                  />
                  <div class="mt-1 text-xs">
                    <button
                      v-if="
                        !(account.platform === 'gemini' && account.oauthProvider === 'antigravity')
                      "
                      class="text-blue-500 hover:underline dark:text-blue-300"
                      @click="openBalanceScriptModal(account)"
                    >
                      Configurar script de saldo
                    </button>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4">
                  <div v-if="account.platform === 'claude'" class="space-y-2">
                    <!-- Cuenta OAuth: Mostrar uso de OAuth en tres ventanas -->
                    <div v-if="isClaudeOAuth(account) && account.claudeUsage" class="space-y-2">
                      <!-- Ventana de 5 horas -->
                      <div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-700/70">
                        <div class="flex items-center gap-2">
                          <span
                            class="inline-flex min-w-[32px] justify-center rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                          >
                            5h
                          </span>
                          <div class="flex-1">
                            <div class="flex items-center gap-2">
                              <div class="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-600">
                                <div
                                  :class="[
                                    'h-2 rounded-full transition-all duration-300',
                                    getClaudeUsageBarClass(account.claudeUsage.fiveHour)
                                  ]"
                                  :style="{
                                    width: getClaudeUsageWidth(account.claudeUsage.fiveHour)
                                  }"
                                />
                              </div>
                              <span
                                class="w-12 text-right text-xs font-semibold text-gray-800 dark:text-gray-100"
                              >
                                {{ formatClaudeUsagePercent(account.claudeUsage.fiveHour) }}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          Restante para reinicio {{ formatClaudeRemaining(account.claudeUsage.fiveHour) }}
                        </div>
                      </div>
                      <!-- Ventana de 7 días -->
                      <div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-700/70">
                        <div class="flex items-center gap-2">
                          <span
                            class="inline-flex min-w-[32px] justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
                          >
                            7d
                          </span>
                          <div class="flex-1">
                            <div class="flex items-center gap-2">
                              <div class="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-600">
                                <div
                                  :class="[
                                    'h-2 rounded-full transition-all duration-300',
                                    getClaudeUsageBarClass(account.claudeUsage.sevenDay)
                                  ]"
                                  :style="{
                                    width: getClaudeUsageWidth(account.claudeUsage.sevenDay)
                                  }"
                                />
                              </div>
                              <span
                                class="w-12 text-right text-xs font-semibold text-gray-800 dark:text-gray-100"
                              >
                                {{ formatClaudeUsagePercent(account.claudeUsage.sevenDay) }}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          Restante para reinicio {{ formatClaudeRemaining(account.claudeUsage.sevenDay) }}
                        </div>
                      </div>
                      <!-- Ventana Opus de 7 días -->
                      <div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-700/70">
                        <div class="flex items-center gap-2">
                          <span
                            class="inline-flex min-w-[32px] justify-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:bg-purple-500/20 dark:text-purple-300"
                          >
                            sonnet
                          </span>
                          <div class="flex-1">
                            <div class="flex items-center gap-2">
                              <div class="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-600">
                                <div
                                  :class="[
                                    'h-2 rounded-full transition-all duration-300',
                                    getClaudeUsageBarClass(account.claudeUsage.sevenDayOpus)
                                  ]"
                                  :style="{
                                    width: getClaudeUsageWidth(account.claudeUsage.sevenDayOpus)
                                  }"
                                />
                              </div>
                              <span
                                class="w-12 text-right text-xs font-semibold text-gray-800 dark:text-gray-100"
                              >
                                {{ formatClaudeUsagePercent(account.claudeUsage.sevenDayOpus) }}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          Restante para reinicio {{ formatClaudeRemaining(account.claudeUsage.sevenDayOpus) }}
                        </div>
                      </div>
                    </div>
                    <!-- Setup Token cuenta：pantalla原conVentana de sesiónprogreso -->
                    <div
                      v-else-if="
                        !isClaudeOAuth(account) &&
                        account.sessionWindow &&
                        account.sessionWindow.hasActiveWindow
                      "
                      class="space-y-2"
                    >
                      <!-- Estadísticas de uso en la parte superior -->
                      <div
                        v-if="account.usage && account.usage.sessionWindow"
                        class="flex items-center gap-3 text-xs"
                      >
                        <div class="flex items-center gap-1">
                          <div class="h-1.5 w-1.5 rounded-full bg-purple-500" />
                          <span class="font-medium text-gray-900 dark:text-gray-100">
                            {{ formatNumber(account.usage.sessionWindow.totalTokens) }}
                          </span>
                        </div>
                        <div class="flex items-center gap-1">
                          <div class="h-1.5 w-1.5 rounded-full bg-green-500" />
                          <span class="font-medium text-gray-900 dark:text-gray-100">
                            ${{ formatCost(account.usage.sessionWindow.totalCost) }}
                          </span>
                        </div>
                      </div>

                      <!-- Barra de progreso -->
                      <div class="flex items-center gap-2">
                        <div class="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            :class="[
                              'h-2 rounded-full transition-all duration-300',
                              getSessionProgressBarClass(
                                account.sessionWindow.sessionWindowStatus,
                                account
                              )
                            ]"
                            :style="{ width: account.sessionWindow.progress + '%' }"
                          />
                        </div>
                        <span
                          class="min-w-[32px] text-xs font-medium text-gray-700 dark:text-gray-200"
                        >
                          {{ account.sessionWindow.progress }}%
                        </span>
                      </div>

                      <!-- Información de tiempo -->
                      <div class="text-xs text-gray-600 dark:text-gray-400">
                        <div>
                          {{
                            formatSessionWindow(
                              account.sessionWindow.windowStart,
                              account.sessionWindow.windowEnd
                            )
                          }}
                        </div>
                        <div
                          v-if="account.sessionWindow.remainingTime > 0"
                          class="font-medium text-indigo-600 dark:text-indigo-400"
                        >
                          Restante {{ formatRemainingTime(account.sessionWindow.remainingTime) }}
                        </div>
                      </div>
                    </div>
                    <div v-else class="text-xs text-gray-400">Sin estadísticas</div>
                  </div>
                  <!-- Claude Console: Mostrar cuota diaria y estado de concurrencia -->
                  <div v-else-if="account.platform === 'claude-console'" class="space-y-3">
                    <div>
                      <template v-if="Number(account.dailyQuota) > 0">
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-gray-600 dark:text-gray-300">Progreso de cuota</span>
                          <span class="font-medium text-gray-700 dark:text-gray-200">
                            {{ getQuotaUsagePercent(account).toFixed(1) }}%
                          </span>
                        </div>
                        <div class="flex items-center gap-2">
                          <div class="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              :class="[
                                'h-2 rounded-full transition-all duration-300',
                                getQuotaBarClass(getQuotaUsagePercent(account))
                              ]"
                              :style="{ width: Math.min(100, getQuotaUsagePercent(account)) + '%' }"
                            />
                          </div>
                          <span
                            class="min-w-[32px] text-xs font-medium text-gray-700 dark:text-gray-200"
                          >
                            ${{ formatCost(account.usage?.daily?.cost || 0) }} / ${{
                              Number(account.dailyQuota).toFixed(2)
                            }}
                          </span>
                        </div>
                        <div class="text-xs text-gray-600 dark:text-gray-400">
                          Restante ${{ formatRemainingQuota(account) }}
                          <span class="ml-2 text-gray-400"
                            >Reinicio {{ account.quotaResetTime || '00:00' }}</span
                          >
                        </div>
                      </template>
                      <template v-else>
                        <div class="text-sm text-gray-400">
                          <i class="fas fa-minus" />
                        </div>
                      </template>
                    </div>

                    <div class="space-y-1">
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-gray-600 dark:text-gray-300">Estado de concurrencia</span>
                        <span
                          v-if="Number(account.maxConcurrentTasks || 0) > 0"
                          class="font-medium text-gray-700 dark:text-gray-200"
                        >
                          {{ getConsoleConcurrencyPercent(account).toFixed(0) }}%
                        </span>
                      </div>
                      <div
                        v-if="Number(account.maxConcurrentTasks || 0) > 0"
                        class="flex items-center gap-2"
                      >
                        <div class="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            :class="[
                              'h-2 rounded-full transition-all duration-300',
                              getConcurrencyBarClass(getConsoleConcurrencyPercent(account))
                            ]"
                            :style="{
                              width: Math.min(100, getConsoleConcurrencyPercent(account)) + '%'
                            }"
                          />
                        </div>
                        <span
                          :class="[
                            'min-w-[48px] text-xs font-medium',
                            getConcurrencyLabelClass(account)
                          ]"
                        >
                          {{ Number(account.activeTaskCount || 0) }} /
                          {{ Number(account.maxConcurrentTasks || 0) }}
                        </span>
                      </div>
                      <div
                        v-else
                        class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300"
                      >
                        <i class="fas fa-infinity mr-1" />Sin límite de concurrencia
                      </div>
                    </div>
                  </div>
                  <div v-else-if="account.platform === 'openai'" class="space-y-2">
                    <div v-if="account.codexUsage" class="space-y-2">
                      <div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-700/70">
                        <div class="flex items-center gap-2">
                          <span
                            class="inline-flex min-w-[32px] justify-center rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                          >
                            {{ getCodexWindowLabel('primary') }}
                          </span>
                          <div class="flex-1">
                            <div class="flex items-center gap-2">
                              <div class="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-600">
                                <div
                                  :class="[
                                    'h-2 rounded-full transition-all duration-300',
                                    getCodexUsageBarClass(account.codexUsage.primary)
                                  ]"
                                  :style="{
                                    width: getCodexUsageWidth(account.codexUsage.primary)
                                  }"
                                />
                              </div>
                              <span
                                class="w-12 text-right text-xs font-semibold text-gray-800 dark:text-gray-100"
                              >
                                {{ formatCodexUsagePercent(account.codexUsage.primary) }}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          Restante para reinicio {{ formatCodexRemaining(account.codexUsage.primary) }}
                        </div>
                      </div>
                      <div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-700/70">
                        <div class="flex items-center gap-2">
                          <span
                            class="inline-flex min-w-[32px] justify-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
                          >
                            {{ getCodexWindowLabel('secondary') }}
                          </span>
                          <div class="flex-1">
                            <div class="flex items-center gap-2">
                              <div class="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-600">
                                <div
                                  :class="[
                                    'h-2 rounded-full transition-all duration-300',
                                    getCodexUsageBarClass(account.codexUsage.secondary)
                                  ]"
                                  :style="{
                                    width: getCodexUsageWidth(account.codexUsage.secondary)
                                  }"
                                />
                              </div>
                              <span
                                class="w-12 text-right text-xs font-semibold text-gray-800 dark:text-gray-100"
                              >
                                {{ formatCodexUsagePercent(account.codexUsage.secondary) }}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          Restante para reinicio {{ formatCodexRemaining(account.codexUsage.secondary) }}
                        </div>
                      </div>
                    </div>
                    <div v-else class="text-sm text-gray-400">
                      <span class="text-xs">N/A</span>
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-400">
                    <span class="text-xs">N/A</span>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-600 dark:text-gray-300">
                  {{ formatLastUsed(account.lastUsedAt) }}
                </td>
                <td class="whitespace-nowrap px-3 py-4">
                  <div
                    v-if="
                      account.platform === 'claude' ||
                      account.platform === 'claude-console' ||
                      account.platform === 'bedrock' ||
                      account.platform === 'gemini' ||
                      account.platform === 'openai' ||
                      account.platform === 'openai-responses' ||
                      account.platform === 'azure_openai' ||
                      account.platform === 'ccr' ||
                      account.platform === 'droid' ||
                      account.platform === 'gemini-api'
                    "
                    class="flex items-center gap-2"
                  >
                    <div class="h-2 w-16 rounded-full bg-gray-200">
                      <div
                        class="h-2 rounded-full bg-gradient-to-r from-green-500 to-blue-600 transition-all duration-300"
                        :style="{ width: 101 - (account.priority || 50) + '%' }"
                      />
                    </div>
                    <span class="min-w-[20px] text-xs font-medium text-gray-700 dark:text-gray-200">
                      {{ account.priority || 50 }}
                    </span>
                  </div>
                  <div v-else class="text-sm text-gray-400">
                    <span class="text-xs">N/A</span>
                  </div>
                </td>
                <td class="px-3 py-4 text-sm text-gray-600">
                  <div
                    v-if="formatProxyDisplay(account.proxy)"
                    class="break-all rounded bg-blue-50 px-2 py-1 font-mono text-xs"
                    :title="formatProxyDisplay(account.proxy)"
                  >
                    {{ formatProxyDisplay(account.proxy) }}
                  </div>
                  <div v-else class="text-gray-400">Sin proxy</div>
                </td>
                <td class="whitespace-nowrap px-3 py-4">
                  <div class="flex flex-col gap-1">
                    <!-- Tiempo de expiración establecido -->
                    <span v-if="account.expiresAt">
                      <span
                        v-if="isExpired(account.expiresAt)"
                        class="inline-flex cursor-pointer items-center text-red-600 hover:underline"
                        style="font-size: 13px"
                        @click.stop="startEditAccountExpiry(account)"
                      >
                        <i class="fas fa-exclamation-circle mr-1 text-xs" />
                        Expirado
                      </span>
                      <span
                        v-else-if="isExpiringSoon(account.expiresAt)"
                        class="inline-flex cursor-pointer items-center text-orange-600 hover:underline"
                        style="font-size: 13px"
                        @click.stop="startEditAccountExpiry(account)"
                      >
                        <i class="fas fa-clock mr-1 text-xs" />
                        {{ formatExpireDate(account.expiresAt) }}
                      </span>
                      <span
                        v-else
                        class="cursor-pointer text-gray-600 hover:underline dark:text-gray-400"
                        style="font-size: 13px"
                        @click.stop="startEditAccountExpiry(account)"
                      >
                        {{ formatExpireDate(account.expiresAt) }}
                      </span>
                    </span>
                    <!-- Nunca expira -->
                    <span
                      v-else
                      class="inline-flex cursor-pointer items-center text-gray-400 hover:underline dark:text-gray-500"
                      style="font-size: 13px"
                      @click.stop="startEditAccountExpiry(account)"
                    >
                      <i class="fas fa-infinity mr-1 text-xs" />
                      Nunca expira
                    </span>
                  </div>
                </td>
                <td
                  class="operations-column sticky right-0 z-10 whitespace-nowrap px-3 py-4 text-sm font-medium"
                >
                  <!-- Mostrar todos los botones cuando el ancho sea suficiente -->
                  <div v-if="!needsHorizontalScroll" class="flex items-center gap-1">
                    <button
                      v-if="showResetButton(account)"
                      :class="[
                        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        account.isResetting
                          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      ]"
                      :disabled="account.isResetting"
                      :title="account.isResetting ? 'Reiniciando...' : 'Reiniciotodos los estados anormales'"
                      @click="resetAccountStatus(account)"
                    >
                      <i :class="['fas fa-redo', account.isResetting ? 'animate-spin' : '']" />
                      <span class="ml-1">ReinicioEstado</span>
                    </button>
                    <button
                      :class="[
                        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        account.isTogglingSchedulable
                          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                          : account.schedulable
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      ]"
                      :disabled="account.isTogglingSchedulable"
                      :title="account.schedulable ? 'Clic para deshabilitar programación' : 'Clic para habilitar programación'"
                      @click="toggleSchedulable(account)"
                    >
                      <i :class="['fas', account.schedulable ? 'fa-toggle-on' : 'fa-toggle-off']" />
                      <span class="ml-1">{{ account.schedulable ? 'Programar' : 'Deshabilitar' }}</span>
                    </button>
                    <button
                      v-if="canViewUsage(account)"
                      class="rounded bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-200"
                      title="Ver detalles de uso"
                      @click="openAccountUsageModal(account)"
                    >
                      <i class="fas fa-chart-line" />
                      <span class="ml-1">Detalles</span>
                    </button>
                    <button
                      v-if="canTestAccount(account)"
                      class="rounded bg-cyan-100 px-2.5 py-1 text-xs font-medium text-cyan-700 transition-colors hover:bg-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:hover:bg-cyan-800/50"
                      title="Probar conectividad de cuenta"
                      @click="openAccountTestModal(account)"
                    >
                      <i class="fas fa-vial" />
                      <span class="ml-1">Probar</span>
                    </button>
                    <button
                      v-if="canTestAccount(account)"
                      class="rounded bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-800/50"
                      title="ProgramadoConfiguración de prueba"
                      @click="openScheduledTestModal(account)"
                    >
                      <i class="fas fa-clock" />
                      <span class="ml-1">Programado</span>
                    </button>
                    <button
                      class="rounded bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200"
                      title="Editar cuenta"
                      @click="editAccount(account)"
                    >
                      <i class="fas fa-edit" />
                      <span class="ml-1">Editar</span>
                    </button>
                    <button
                      class="rounded bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200"
                      title="Eliminar cuenta"
                      @click="deleteAccount(account)"
                    >
                      <i class="fas fa-trash" />
                      <span class="ml-1">Eliminar</span>
                    </button>
                  </div>
                  <!-- Usar forma reducida al necesitar desplazamiento horizontal: 2 botones de acceso directo + menú desplegable -->
                  <div v-else class="flex items-center gap-1">
                    <button
                      :class="[
                        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        account.isTogglingSchedulable
                          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                          : account.schedulable
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      ]"
                      :disabled="account.isTogglingSchedulable"
                      :title="account.schedulable ? 'Clic para deshabilitar programación' : 'Clic para habilitar programación'"
                      @click="toggleSchedulable(account)"
                    >
                      <i :class="['fas', account.schedulable ? 'fa-toggle-on' : 'fa-toggle-off']" />
                      <span class="ml-1">{{ account.schedulable ? 'Programar' : 'Deshabilitar' }}</span>
                    </button>
                    <button
                      class="rounded bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200"
                      title="Editar cuenta"
                      @click="editAccount(account)"
                    >
                      <i class="fas fa-edit" />
                      <span class="ml-1">Editar</span>
                    </button>
                    <ActionDropdown :actions="getAccountActions(account)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Vista de tarjetas móviles -->
      <div v-if="!accountsLoading && sortedAccounts.length > 0" class="space-y-3 md:hidden">
        <div
          v-for="account in paginatedAccounts"
          :key="account.id"
          class="card p-4 transition-shadow hover:shadow-lg"
        >
          <!-- Cabecera de tarjeta -->
          <div class="mb-3 flex items-start justify-between">
            <div class="flex items-center gap-3">
              <input
                v-if="shouldShowCheckboxes"
                v-model="selectedAccounts"
                class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                type="checkbox"
                :value="account.id"
                @change="updateSelectAllState"
              />
              <div
                :class="[
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                  account.platform === 'claude'
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                    : account.platform === 'bedrock'
                      ? 'bg-gradient-to-br from-orange-500 to-red-600'
                      : account.platform === 'azure_openai'
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
                        : account.platform === 'openai'
                          ? 'bg-gradient-to-br from-gray-600 to-gray-700'
                          : account.platform === 'ccr'
                            ? 'bg-gradient-to-br from-teal-500 to-emerald-600'
                            : account.platform === 'droid'
                              ? 'bg-gradient-to-br from-cyan-500 to-sky-600'
                              : 'bg-gradient-to-br from-blue-500 to-blue-600'
                ]"
              >
                <i
                  :class="[
                    'text-sm text-white',
                    account.platform === 'claude'
                      ? 'fas fa-brain'
                      : account.platform === 'bedrock'
                        ? 'fab fa-aws'
                        : account.platform === 'azure_openai'
                          ? 'fab fa-microsoft'
                          : account.platform === 'openai'
                            ? 'fas fa-openai'
                            : account.platform === 'ccr'
                              ? 'fas fa-code-branch'
                              : account.platform === 'droid'
                                ? 'fas fa-robot'
                                : 'fas fa-robot'
                  ]"
                />
              </div>
              <div>
                <h4
                  class="cursor-pointer text-sm font-semibold text-gray-900 hover:text-blue-600 dark:hover:text-blue-400"
                  title="Clic para copiar"
                  @click.stop="copyText(account.name || account.email)"
                >
                  {{ account.name || account.email }}
                </h4>
                <div class="mt-0.5 flex items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{
                    account.platform
                  }}</span>
                  <span class="text-xs text-gray-400">|</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{ account.type }}</span>
                </div>
              </div>
            </div>
            <span
              :class="[
                'inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold',
                getAccountStatusClass(account)
              ]"
            >
              <div
                :class="['mr-1.5 h-1.5 w-1.5 rounded-full', getAccountStatusDotClass(account)]"
              />
              {{ getAccountStatusText(account) }}
            </span>
          </div>

          <!-- Estadísticas de uso -->
          <div class="mb-3 grid grid-cols-2 gap-3">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Uso de hoy</p>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <div class="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {{ account.usage?.daily?.requests || 0 }} veces
                  </p>
                </div>
                <div class="flex items-center gap-1.5">
                  <div class="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    {{ formatNumber(account.usage?.daily?.allTokens || 0) }}
                  </p>
                </div>
                <div class="flex items-center gap-1.5">
                  <div class="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    ${{ calculateDailyCost(account) }}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Ventana de sesión</p>
              <div v-if="account.usage && account.usage.sessionWindow" class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <div class="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {{ formatNumber(account.usage.sessionWindow.totalTokens) }}
                  </p>
                </div>
                <div class="flex items-center gap-1.5">
                  <div class="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    ${{ formatCost(account.usage.sessionWindow.totalCost) }}
                  </p>
                </div>
              </div>
              <div v-else class="text-sm font-semibold text-gray-400">-</div>
            </div>
          </div>

          <!-- Saldo/Cuota -->
          <div class="mb-3">
            <p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Saldo/Cuota</p>
            <BalanceDisplay
              :account-id="account.id"
              :initial-balance="account.balanceInfo"
              :platform="account.platform"
              :query-mode="
                account.platform === 'gemini' && account.oauthProvider === 'antigravity'
                  ? 'auto'
                  : 'local'
              "
              @error="(error) => handleBalanceError(account.id, error)"
              @refreshed="(data) => handleBalanceRefreshed(account.id, data)"
            />
            <div class="mt-1 text-xs">
              <button
                v-if="!(account.platform === 'gemini' && account.oauthProvider === 'antigravity')"
                class="text-blue-500 hover:underline dark:text-blue-300"
                @click="openBalanceScriptModal(account)"
              >
                Configurar script de saldo
              </button>
            </div>
          </div>

          <!-- Información de estado -->
          <div class="mb-3 space-y-2">
            <!-- Ventana de sesión -->
            <div v-if="account.platform === 'claude'" class="space-y-2">
              <!-- Cuenta OAuth: Mostrar uso de OAuth en tres ventanas -->
              <div v-if="isClaudeOAuth(account) && account.claudeUsage" class="space-y-2">
                <!-- Ventana de 5 horas -->
                <div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-700/70">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex min-w-[32px] justify-center rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                    >
                      5h
                    </span>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <div class="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-600">
                          <div
                            :class="[
                              'h-2 rounded-full transition-all duration-300',
                              getClaudeUsageBarClass(account.claudeUsage.fiveHour)
                            ]"
                            :style="{
                              width: getClaudeUsageWidth(account.claudeUsage.fiveHour)
                            }"
                          />
                        </div>
                        <span
                          class="w-12 text-right text-xs font-semibold text-gray-800 dark:text-gray-100"
                        >
                          {{ formatClaudeUsagePercent(account.claudeUsage.fiveHour) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Restante para reinicio {{ formatClaudeRemaining(account.claudeUsage.fiveHour) }}
                  </div>
                </div>
                <!-- Ventana de 7 días -->
                <div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-700/70">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex min-w-[32px] justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
                    >
                      7d
                    </span>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <div class="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-600">
                          <div
                            :class="[
                              'h-2 rounded-full transition-all duration-300',
                              getClaudeUsageBarClass(account.claudeUsage.sevenDay)
                            ]"
                            :style="{
                              width: getClaudeUsageWidth(account.claudeUsage.sevenDay)
                            }"
                          />
                        </div>
                        <span
                          class="w-12 text-right text-xs font-semibold text-gray-800 dark:text-gray-100"
                        >
                          {{ formatClaudeUsagePercent(account.claudeUsage.sevenDay) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Restante para reinicio {{ formatClaudeRemaining(account.claudeUsage.sevenDay) }}
                  </div>
                </div>
                <!-- Ventana Opus de 7 días -->
                <div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-700/70">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex min-w-[32px] justify-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:bg-purple-500/20 dark:text-purple-300"
                    >
                      Opus
                    </span>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <div class="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-600">
                          <div
                            :class="[
                              'h-2 rounded-full transition-all duration-300',
                              getClaudeUsageBarClass(account.claudeUsage.sevenDayOpus)
                            ]"
                            :style="{
                              width: getClaudeUsageWidth(account.claudeUsage.sevenDayOpus)
                            }"
                          />
                        </div>
                        <span
                          class="w-12 text-right text-xs font-semibold text-gray-800 dark:text-gray-100"
                        >
                          {{ formatClaudeUsagePercent(account.claudeUsage.sevenDayOpus) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Restante para reinicio {{ formatClaudeRemaining(account.claudeUsage.sevenDayOpus) }}
                  </div>
                </div>
              </div>
              <!-- Setup Token cuenta：pantalla原conVentana de sesiónprogreso -->
              <div
                v-else-if="
                  !isClaudeOAuth(account) &&
                  account.sessionWindow &&
                  account.sessionWindow.hasActiveWindow
                "
                class="space-y-1.5 rounded-lg bg-gray-50 p-2 dark:bg-gray-700"
              >
                <div class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-1">
                    <span class="font-medium text-gray-600 dark:text-gray-300">Ventana de sesión</span>
                    <el-tooltip
                      content="Ventana de sesiónprogresono代表usar量，仅表示距离abajo一 Ventana de 5 horasRestante"
                      placement="top"
                    >
                      <i
                        class="fas fa-question-circle cursor-help text-xs text-gray-400 hover:text-gray-600"
                      />
                    </el-tooltip>
                  </div>
                  <span class="font-medium text-gray-700 dark:text-gray-200">
                    {{ account.sessionWindow.progress }}%
                  </span>
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                  <div
                    :class="[
                      'h-full transition-all duration-300',
                      getSessionProgressBarClass(account.sessionWindow.sessionWindowStatus, account)
                    ]"
                    :style="{ width: account.sessionWindow.progress + '%' }"
                  />
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-500 dark:text-gray-400">
                    {{
                      formatSessionWindow(
                        account.sessionWindow.windowStart,
                        account.sessionWindow.windowEnd
                      )
                    }}
                  </span>
                  <span
                    v-if="account.sessionWindow.remainingTime > 0"
                    class="font-medium text-indigo-600"
                  >
                    Restante {{ formatRemainingTime(account.sessionWindow.remainingTime) }}
                  </span>
                  <span v-else class="text-gray-500"> Finalizado </span>
                </div>
              </div>
              <div v-else class="text-xs text-gray-400">Sin estadísticas</div>
            </div>
            <div v-else-if="account.platform === 'openai'" class="space-y-2">
              <div v-if="account.codexUsage" class="space-y-2">
                <div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-700">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex min-w-[32px] justify-center rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                    >
                      {{ getCodexWindowLabel('primary') }}
                    </span>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <div class="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-600">
                          <div
                            :class="[
                              'h-2 rounded-full transition-all duration-300',
                              getCodexUsageBarClass(account.codexUsage.primary)
                            ]"
                            :style="{
                              width: getCodexUsageWidth(account.codexUsage.primary)
                            }"
                          />
                        </div>
                        <span
                          class="w-12 text-right text-xs font-semibold text-gray-800 dark:text-gray-100"
                        >
                          {{ formatCodexUsagePercent(account.codexUsage.primary) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Restante para reinicio {{ formatCodexRemaining(account.codexUsage.primary) }}
                  </div>
                </div>
                <div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-700">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex min-w-[32px] justify-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
                    >
                      {{ getCodexWindowLabel('secondary') }}
                    </span>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <div class="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-600">
                          <div
                            :class="[
                              'h-2 rounded-full transition-all duration-300',
                              getCodexUsageBarClass(account.codexUsage.secondary)
                            ]"
                            :style="{
                              width: getCodexUsageWidth(account.codexUsage.secondary)
                            }"
                          />
                        </div>
                        <span
                          class="w-12 text-right text-xs font-semibold text-gray-800 dark:text-gray-100"
                        >
                          {{ formatCodexUsagePercent(account.codexUsage.secondary) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Restante para reinicio {{ formatCodexRemaining(account.codexUsage.secondary) }}
                  </div>
                </div>
              </div>
              <div v-if="!account.codexUsage" class="text-xs text-gray-400">Sin estadísticas</div>
            </div>

            <!-- Último uso -->
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500 dark:text-gray-400">Último uso</span>
              <span class="text-gray-700 dark:text-gray-200">
                {{ account.lastUsedAt ? formatRelativeTime(account.lastUsedAt) : 'Nunca usado' }}
              </span>
            </div>

            <!-- Configuración de proxy -->
            <div
              v-if="account.proxyConfig && account.proxyConfig.type !== 'none'"
              class="flex items-center justify-between text-xs"
            >
              <span class="text-gray-500 dark:text-gray-400">Proxy</span>
              <span class="text-gray-700 dark:text-gray-200">
                {{ account.proxyConfig.type.toUpperCase() }}
              </span>
            </div>

            <!-- ProgramarPrioridad -->
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500 dark:text-gray-400">Prioridad</span>
              <span class="font-medium text-gray-700 dark:text-gray-200">
                {{ account.priority || 50 }}
              </span>
            </div>
          </div>

          <!-- Botones de operaciones -->
          <div class="mt-3 flex gap-2 border-t border-gray-100 pt-3">
            <button
              class="flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors"
              :class="
                account.schedulable
                  ? 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              "
              :disabled="account.isTogglingSchedulable"
              @click="toggleSchedulable(account)"
            >
              <i :class="['fas', account.schedulable ? 'fa-pause' : 'fa-play']" />
              {{ account.schedulable ? 'Pausar' : 'Habilitar' }}
            </button>

            <button
              v-if="canViewUsage(account)"
              class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-600 transition-colors hover:bg-indigo-100"
              @click="openAccountUsageModal(account)"
            >
              <i class="fas fa-chart-line" />
              Detalles
            </button>
            <button
              v-if="canTestAccount(account)"
              class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-600 transition-colors hover:bg-cyan-100 dark:bg-cyan-900/40 dark:text-cyan-300 dark:hover:bg-cyan-800/50"
              @click="openAccountTestModal(account)"
            >
              <i class="fas fa-vial" />
              Probar
            </button>

            <button
              v-if="canTestAccount(account)"
              class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600 transition-colors hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-800/50"
              @click="openScheduledTestModal(account)"
            >
              <i class="fas fa-clock" />
              Programado
            </button>

            <button
              class="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-100"
              @click="editAccount(account)"
            >
              <i class="fas fa-edit mr-1" />
              Editar
            </button>

            <button
              class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 transition-colors hover:bg-red-100"
              @click="deleteAccount(account)"
            >
              <i class="fas fa-trash" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!accountsLoading && sortedAccounts.length > 0"
      class="mt-4 flex flex-col items-center justify-between gap-4 sm:mt-6 sm:flex-row"
    >
      <div class="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
        <span class="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
          Total de {{ sortedAccounts.length }} registros
        </span>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">Mostrar por página</span>
          <select
            v-model="pageSize"
            class="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 transition-colors hover:border-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 sm:text-sm"
            @change="currentPage = 1"
          >
            <option v-for="size in pageSizeOptions" :key="size" :value="size">
              {{ size }}
            </option>
          </select>
          <span class="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">registros</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:py-1 sm:text-sm"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          <i class="fas fa-chevron-left" />
        </button>

        <div class="flex items-center gap-1">
          <button
            v-if="shouldShowFirstPage"
            class="hidden rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:block"
            @click="currentPage = 1"
          >
            1
          </button>

          <span
            v-if="showLeadingEllipsis"
            class="hidden px-2 text-sm text-gray-500 dark:text-gray-400 sm:block"
          >
            ...
          </span>

          <button
            v-for="page in pageNumbers"
            :key="page"
            :class="[
              'rounded-md border px-3 py-1 text-xs font-medium transition-colors sm:text-sm',
              page === currentPage
                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            ]"
            @click="currentPage = page"
          >
            {{ page }}
          </button>

          <span
            v-if="showTrailingEllipsis"
            class="hidden px-2 text-sm text-gray-500 dark:text-gray-400 sm:block"
          >
            ...
          </span>

          <button
            v-if="shouldShowLastPage"
            class="hidden rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:block"
            @click="currentPage = totalPages"
          >
            {{ totalPages }}
          </button>
        </div>

        <button
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:py-1 sm:text-sm"
          :disabled="currentPage === totalPages || totalPages === 0"
          @click="currentPage++"
        >
          <i class="fas fa-chevron-right" />
        </button>
      </div>
    </div>

    <!-- Modal de agregar cuenta -->
    <AccountForm
      v-if="showCreateAccountModal && (!newAccountPlatform || newAccountPlatform !== 'ccr')"
      @close="closeCreateAccountModal"
      @platform-changed="newAccountPlatform = $event"
      @success="handleCreateSuccess"
    />
    <CcrAccountForm
      v-else-if="showCreateAccountModal && newAccountPlatform === 'ccr'"
      @close="closeCreateAccountModal"
      @success="handleCreateSuccess"
    />

    <!-- Modal de editar cuenta -->
    <CcrAccountForm
      v-if="showEditAccountModal && editingAccount && editingAccount.platform === 'ccr'"
      :account="editingAccount"
      @close="showEditAccountModal = false"
      @success="handleEditSuccess"
    />
    <AccountForm
      v-else-if="showEditAccountModal"
      :account="editingAccount"
      @close="showEditAccountModal = false"
      @success="handleEditSuccess"
    />

    <!-- Ventana emergente de confirmación -->
    <ConfirmModal
      :cancel-text="confirmOptions.cancelText"
      :confirm-text="confirmOptions.confirmText"
      :message="confirmOptions.message"
      :show="showConfirmModal"
      :title="confirmOptions.title"
      @cancel="handleCancel"
      @confirm="handleConfirm"
    />

    <AccountUsageDetailModal
      v-if="showAccountUsageModal"
      :account="selectedAccountForUsage || {}"
      :generated-at="accountUsageGeneratedAt"
      :history="accountUsageHistory"
      :loading="accountUsageLoading"
      :overview="accountUsageOverview"
      :show="showAccountUsageModal"
      :summary="accountUsageSummary"
      @close="closeAccountUsageModal"
    />

    <!-- cuentaexpirarEditarventana emergente -->
    <AccountExpiryEditModal
      ref="expiryEditModalRef"
      :account="editingExpiryAccount || { id: null, expiresAt: null, name: '' }"
      :show="!!editingExpiryAccount"
      @close="closeAccountExpiryEdit"
      @save="handleSaveAccountExpiry"
    />

    <!-- Ventana emergente de prueba de cuenta -->
    <AccountTestModal
      :account="testingAccount"
      :show="showAccountTestModal"
      @close="closeAccountTestModal"
    />

    <!-- Ventana emergente de configuración de prueba programada -->
    <AccountScheduledTestModal
      :account="scheduledTestAccount"
      :show="showScheduledTestModal"
      @close="closeScheduledTestModal"
      @saved="handleScheduledTestSaved"
    />

    <AccountBalanceScriptModal
      :account="selectedAccountForScript"
      :show="showBalanceScriptModal"
      @close="closeBalanceScriptModal"
      @saved="handleBalanceScriptSaved"
    />

    <!-- Ventana emergente de estadísticas de cuenta -->
    <el-dialog
      v-model="showAccountStatsModal"
      :style="{ maxWidth: '1200px' }"
      title="Resumen de estadísticas de cuentas"
      width="90%"
    >
      <div class="space-y-4">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-sm" style="min-width: 1000px">
            <thead class="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th class="border border-gray-300 px-4 py-2 text-left dark:border-gray-600">
                  Tipo de plataforma
                </th>
                <th class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  Normal
                </th>
                <th class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  No programable
                </th>
                <th class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  limitación0-1h
                </th>
                <th class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  limitación1-5h
                </th>
                <th class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  limitación5-12h
                </th>
                <th class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  limitación12-24h
                </th>
                <th class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  limitación>24h
                </th>
                <th class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  Otro
                </th>
                <th
                  class="border border-gray-300 bg-blue-50 px-4 py-2 text-center font-bold dark:border-gray-600 dark:bg-blue-900/30"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stat in accountStats" :key="stat.platform">
                <td class="border border-gray-300 px-4 py-2 font-medium dark:border-gray-600">
                  {{ stat.platformLabel }}
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-green-600 dark:text-green-400">{{ stat.normal }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-yellow-600 dark:text-yellow-400">{{ stat.unschedulable }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-orange-600 dark:text-orange-400">{{ stat.rateLimit0_1h }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-orange-600 dark:text-orange-400">{{ stat.rateLimit1_5h }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-orange-600 dark:text-orange-400">{{
                    stat.rateLimit5_12h
                  }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-orange-600 dark:text-orange-400">{{
                    stat.rateLimit12_24h
                  }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-orange-600 dark:text-orange-400">{{
                    stat.rateLimitOver24h
                  }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-red-600 dark:text-red-400">{{ stat.other }}</span>
                </td>
                <td
                  class="border border-gray-300 bg-blue-50 px-4 py-2 text-center font-bold dark:border-gray-600 dark:bg-blue-900/30"
                >
                  {{ stat.total }}
                </td>
              </tr>
              <tr class="bg-blue-50 font-bold dark:bg-blue-900/30">
                <td class="border border-gray-300 px-4 py-2 dark:border-gray-600">Total</td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-green-600 dark:text-green-400">{{
                    accountStatsTotal.normal
                  }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-yellow-600 dark:text-yellow-400">{{
                    accountStatsTotal.unschedulable
                  }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-orange-600 dark:text-orange-400">{{
                    accountStatsTotal.rateLimit0_1h
                  }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-orange-600 dark:text-orange-400">{{
                    accountStatsTotal.rateLimit1_5h
                  }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-orange-600 dark:text-orange-400">{{
                    accountStatsTotal.rateLimit5_12h
                  }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-orange-600 dark:text-orange-400">{{
                    accountStatsTotal.rateLimit12_24h
                  }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-orange-600 dark:text-orange-400">{{
                    accountStatsTotal.rateLimitOver24h
                  }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  <span class="text-red-600 dark:text-red-400">{{ accountStatsTotal.other }}</span>
                </td>
                <td class="border border-gray-300 px-4 py-2 text-center dark:border-gray-600">
                  {{ accountStatsTotal.total }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          注：limitaciónlista示Restantelimitaciónen指定rangodentrocuentacantidad
        </p>
      </div>
    </el-dialog>

    <!-- Gruposadministrarventana emergente -->
    <GroupManagementModal
      v-if="showGroupManagementModal"
      @close="showGroupManagementModal = false"
      @refresh="loadAccountGroups"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { showToast, copyText, formatNumber, formatRelativeTime } from '@/utils/tools'

import * as httpApis from '@/utils/http_apis'
import AccountForm from '@/components/accounts/AccountForm.vue'
import CcrAccountForm from '@/components/accounts/CcrAccountForm.vue'
import AccountUsageDetailModal from '@/components/accounts/AccountUsageDetailModal.vue'
import AccountExpiryEditModal from '@/components/accounts/AccountExpiryEditModal.vue'
import AccountTestModal from '@/components/accounts/AccountTestModal.vue'
import AccountScheduledTestModal from '@/components/accounts/AccountScheduledTestModal.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import CustomDropdown from '@/components/common/CustomDropdown.vue'
import ActionDropdown from '@/components/common/ActionDropdown.vue'
import GroupManagementModal from '@/components/accounts/GroupManagementModal.vue'
import BalanceDisplay from '@/components/accounts/BalanceDisplay.vue'
import AccountBalanceScriptModal from '@/components/accounts/AccountBalanceScriptModal.vue'

// Ventana emergente de confirmaciónEstado
const showConfirmModal = ref(false)
const confirmOptions = ref({ title: '', message: '', confirmText: 'Continuar', cancelText: 'Cancelar' })
let confirmResolve = null
const showConfirm = (title, message, confirmText = 'Continuar', cancelText = 'Cancelar') => {
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

// datosEstado
const accounts = ref([])
const accountsLoading = ref(false)
const refreshingBalances = ref(false)
const accountsSortBy = ref('name')
const accountsSortOrder = ref('asc')
const apiKeys = ref([]) // 保留usar于Otrofunción（comoEliminar cuentacuandopantallavincularinformación）
const bindingCounts = ref({}) // 轻量级vincular计数，usar于pantalla"vincular: X  API Key"
const accountGroups = ref([])
const groupFilter = ref('all')
const platformFilter = ref('all')
const statusFilter = ref('all') // Estado过滤 (normal/rateLimited/other/all)
const searchKeyword = ref('')
const PAGE_SIZE_STORAGE_KEY = 'accountsPageSize'
const getInitialPageSize = () => {
  const saved = localStorage.getItem(PAGE_SIZE_STORAGE_KEY)
  if (saved) {
    const parsedSize = parseInt(saved, 10)
    if ([10, 20, 50, 100].includes(parsedSize)) {
      return parsedSize
    }
  }
  return 10
}
const pageSizeOptions = [10, 20, 50, 100]
const pageSize = ref(getInitialPageSize())
const currentPage = ref(1)

// 多选Estado
const selectedAccounts = ref([])
const selectAllChecked = ref(false)
const isIndeterminate = ref(false)
const showCheckboxes = ref(false)

// 账号usarDetallesventana emergenteEstado
const showAccountUsageModal = ref(false)
const accountUsageLoading = ref(false)
const selectedAccountForUsage = ref(null)
const accountUsageHistory = ref([])
const accountUsageSummary = ref({})
const accountUsageOverview = ref({})
const accountUsageGeneratedAt = ref('')

const supportedUsagePlatforms = [
  'claude',
  'claude-console',
  'openai',
  'openai-responses',
  'gemini',
  'droid',
  'gemini-api',
  'bedrock'
]

// expirarEditarventana emergenteEstado
const editingExpiryAccount = ref(null)
const expiryEditModalRef = ref(null)

// Probarventana emergenteEstado
const showAccountTestModal = ref(false)
const testingAccount = ref(null)

// Ventana emergente de configuración de prueba programadaEstado
const showScheduledTestModal = ref(false)
const scheduledTestAccount = ref(null)

// Ventana emergente de estadísticas de cuentaEstado
const showAccountStatsModal = ref(false)

// Gruposadministrarventana emergenteEstado
const showGroupManagementModal = ref(false)

// tabla横向desplazamientodetectar
const tableContainerRef = ref(null)
const needsHorizontalScroll = ref(false)

// cachéEstado标志
const apiKeysLoaded = ref(false) // usar于Otrofunción
const bindingCountsLoaded = ref(false) // 轻量级vincular计数caché
const groupsLoaded = ref(false)
const groupMembersLoaded = ref(false)
const accountGroupMap = ref(new Map()) // Map<accountId, Array<groupInfo>>

// abajo拉opcióndatos
const sortOptions = ref([
  { value: 'name', label: '按Nombreordenar', icon: 'fa-font' },
  { value: 'dailyTokens', label: '按HoyTokenordenar', icon: 'fa-coins' },
  { value: 'dailyRequests', label: '按Hoysolicitud数ordenar', icon: 'fa-chart-line' },
  { value: 'totalTokens', label: '按总Tokenordenar', icon: 'fa-database' },
  { value: 'lastUsed', label: '按Último usoordenar', icon: 'fa-clock' },
  { value: 'rateLimitTime', label: '按limitaciónordenar', icon: 'fa-hourglass' }
])

// plataformajerarquía结构definición
const platformHierarchy = [
  {
    value: 'group-claude',
    label: 'Claude（todo）',
    icon: 'fa-brain',
    children: [
      { value: 'claude', label: 'Claude 官方/OAuth', icon: 'fa-brain' },
      { value: 'claude-console', label: 'Claude Console', icon: 'fa-terminal' },
      { value: 'bedrock', label: 'Bedrock', icon: 'fab fa-aws' },
      { value: 'ccr', label: 'CCR Relay', icon: 'fa-code-branch' }
    ]
  },
  {
    value: 'group-openai',
    label: 'Codex / OpenAI（todo）',
    icon: 'fa-openai',
    children: [
      { value: 'openai', label: 'OpenAI 官方', icon: 'fa-openai' },
      { value: 'openai-responses', label: 'OpenAI-Responses (Codex)', icon: 'fa-server' },
      { value: 'azure_openai', label: 'Azure OpenAI', icon: 'fab fa-microsoft' }
    ]
  },
  {
    value: 'group-gemini',
    label: 'Gemini（todo）',
    icon: 'fab fa-google',
    children: [
      { value: 'gemini', label: 'Gemini OAuth', icon: 'fab fa-google' },
      { value: 'gemini-api', label: 'Gemini API', icon: 'fa-key' }
    ]
  },
  {
    value: 'group-droid',
    label: 'Droid（todo）',
    icon: 'fa-robot',
    children: [{ value: 'droid', label: 'Droid', icon: 'fa-robot' }]
  }
]

// plataformaGruposmapear
const platformGroupMap = {
  'group-claude': ['claude', 'claude-console', 'bedrock', 'ccr'],
  'group-openai': ['openai', 'openai-responses', 'azure_openai'],
  'group-gemini': ['gemini', 'gemini-api'],
  'group-droid': ['droid']
}

// plataformasolicitudmanejo器
const platformRequestHandlers = {
  claude: () => httpApis.getClaudeAccountsApi(),
  'claude-console': () => httpApis.getClaudeConsoleAccountsApi(),
  bedrock: () => httpApis.getBedrockAccountsApi(),
  gemini: () => httpApis.getGeminiAccountsApi(),
  openai: () => httpApis.getOpenAIAccountsApi(),
  azure_openai: () => httpApis.getAzureOpenAIAccountsApi(),
  'openai-responses': () => httpApis.getOpenAIResponsesAccountsApi(),
  ccr: () => httpApis.getCcrAccountsApi(),
  droid: () => httpApis.getDroidAccountsApi(),
  'gemini-api': () => httpApis.getGeminiApiAccountsApi()
}

const allPlatformKeys = Object.keys(platformRequestHandlers)

// 根据filtroobtenernecesita要cargarplataformalista
const getPlatformsForFilter = (filter) => {
  if (filter === 'all') return allPlatformKeys
  if (platformGroupMap[filter]) return platformGroupMap[filter]
  if (allPlatformKeys.includes(filter)) return [filter]
  return allPlatformKeys
}

// plataformaopción（两级结构）
const platformOptions = computed(() => {
  const options = [{ value: 'all', label: 'todosplataforma', icon: 'fa-globe', indent: 0 }]

  platformHierarchy.forEach((group) => {
    options.push({ ...group, indent: 0, isGroup: true })
    group.children?.forEach((child) => {
      options.push({ ...child, indent: 1, parent: group.value })
    })
  })

  return options
})

const statusOptions = ref([
  { value: 'normal', label: 'Normal', icon: 'fa-check-circle' },
  { value: 'unschedulable', label: 'No programable', icon: 'fa-ban' },
  { value: 'rateLimited', label: 'limitación', icon: 'fa-hourglass-half' },
  { value: 'other', label: 'Otro', icon: 'fa-exclamation-triangle' },
  { value: 'all', label: 'todoEstado', icon: 'fa-list' }
])

const groupOptions = computed(() => {
  const options = [
    { value: 'all', label: 'todoscuenta', icon: 'fa-globe' },
    { value: 'ungrouped', label: 'sinGruposcuenta', icon: 'fa-user' }
  ]
  accountGroups.value.forEach((group) => {
    options.push({
      value: group.id,
      label: `${group.name} (${group.platform === 'claude' ? 'Claude' : group.platform === 'gemini' ? 'Gemini' : group.platform === 'openai' ? 'OpenAI' : 'Droid'})`,
      icon:
        group.platform === 'claude'
          ? 'fa-brain'
          : group.platform === 'gemini'
            ? 'fa-robot'
            : group.platform === 'openai'
              ? 'fa-openai'
              : 'fa-robot'
    })
  })
  return options
})

const shouldShowCheckboxes = computed(() => showCheckboxes.value)

// modalEstado
const showCreateAccountModal = ref(false)
const newAccountPlatform = ref(null) // 跟踪新建cuentaSeleccionarplataforma
const showEditAccountModal = ref(false)
const editingAccount = ref(null)

const collectAccountSearchableStrings = (account) => {
  const values = new Set()

  const baseFields = [
    account?.name,
    account?.email,
    account?.accountName,
    account?.owner,
    account?.ownerName,
    account?.ownerDisplayName,
    account?.displayName,
    account?.username,
    account?.identifier,
    account?.alias,
    account?.title,
    account?.label
  ]

  baseFields.forEach((field) => {
    if (typeof field === 'string') {
      const trimmed = field.trim()
      if (trimmed) {
        values.add(trimmed)
      }
    }
  })

  if (Array.isArray(account?.groupInfos)) {
    account.groupInfos.forEach((group) => {
      if (group && typeof group.name === 'string') {
        const trimmed = group.name.trim()
        if (trimmed) {
          values.add(trimmed)
        }
      }
    })
  }

  Object.entries(account || {}).forEach(([key, value]) => {
    if (typeof value === 'string') {
      const lowerKey = key.toLowerCase()
      if (lowerKey.includes('name') || lowerKey.includes('email')) {
        const trimmed = value.trim()
        if (trimmed) {
          values.add(trimmed)
        }
      }
    }
  })

  return Array.from(values)
}

const accountMatchesKeyword = (account, normalizedKeyword) => {
  if (!normalizedKeyword) return true
  return collectAccountSearchableStrings(account).some((value) =>
    value.toLowerCase().includes(normalizedKeyword)
  )
}

const canViewUsage = (account) => !!account && supportedUsagePlatforms.includes(account.platform)

// 判断es否pantallaReinicioEstadobotón
const showResetButton = (account) => {
  const supportedPlatforms = [
    'claude',
    'claude-console',
    'openai',
    'openai-responses',
    'gemini',
    'gemini-api',
    'ccr'
  ]
  return (
    supportedPlatforms.includes(account.platform) &&
    (account.status === 'unauthorized' ||
      account.status !== 'active' ||
      account.rateLimitStatus?.isRateLimited ||
      account.rateLimitStatus === 'limited' ||
      !account.isActive)
  )
}

// obtenercuentaOperacionesmenú项（usar于小屏abajo拉menú）
const getAccountActions = (account) => {
  const actions = []

  // ReinicioEstado（仅ennecesita要cuandopantalla）
  if (showResetButton(account)) {
    actions.push({
      key: 'reset',
      label: 'ReinicioEstado',
      icon: 'fa-redo',
      color: 'orange',
      handler: () => resetAccountStatus(account)
    })
  }

  // verDetalles
  if (canViewUsage(account)) {
    actions.push({
      key: 'usage',
      label: 'Detalles',
      icon: 'fa-chart-line',
      color: 'indigo',
      handler: () => openAccountUsageModal(account)
    })
  }

  // Probarcuenta
  if (canTestAccount(account)) {
    actions.push({
      key: 'test',
      label: 'Probar',
      icon: 'fa-vial',
      color: 'blue',
      handler: () => openAccountTestModal(account)
    })
    actions.push({
      key: 'scheduled-test',
      label: 'ProgramadoProbar',
      icon: 'fa-clock',
      color: 'amber',
      handler: () => openScheduledTestModal(account)
    })
  }

  // Eliminar
  actions.push({
    key: 'delete',
    label: 'Eliminar',
    icon: 'fa-trash',
    color: 'red',
    handler: () => deleteAccount(account)
  })

  return actions
}

const openAccountUsageModal = async (account) => {
  if (!canViewUsage(account)) {
    showToast('该cuentatipo暂nosoportarverDetalles', 'warning')
    return
  }

  selectedAccountForUsage.value = account
  showAccountUsageModal.value = true
  accountUsageLoading.value = true
  accountUsageHistory.value = []
  accountUsageSummary.value = {}
  accountUsageOverview.value = {}
  accountUsageGeneratedAt.value = ''

  const response = await httpApis.getAccountUsageHistoryApi(account.id, account.platform, 30)
  if (response.success) {
    const data = response.data || {}
    accountUsageHistory.value = data.history || []
    accountUsageSummary.value = data.summary || {}
    accountUsageOverview.value = data.overview || {}
    accountUsageGeneratedAt.value = data.generatedAt || ''
  } else {
    showToast(response.error || 'cargar账号usarDetallesfallido', 'error')
  }
  accountUsageLoading.value = false
}

const closeAccountUsageModal = () => {
  showAccountUsageModal.value = false
  accountUsageLoading.value = false
  selectedAccountForUsage.value = null
}

// Probar conectividad de cuenta相关función
const supportedTestPlatforms = [
  'claude',
  'claude-console',
  'bedrock',
  'gemini',
  'openai-responses',
  'azure-openai',
  'droid',
  'ccr'
]

const canTestAccount = (account) => {
  return !!account && supportedTestPlatforms.includes(account.platform)
}

const openAccountTestModal = (account) => {
  if (!canTestAccount(account)) {
    showToast('该cuentatipo暂nosoportarProbar', 'warning')
    return
  }
  testingAccount.value = account
  showAccountTestModal.value = true
}

const closeAccountTestModal = () => {
  showAccountTestModal.value = false
  testingAccount.value = null
}

// ProgramadoConfiguración de prueba相关función
const openScheduledTestModal = (account) => {
  if (!canTestAccount(account)) {
    showToast('该cuentatipo暂nosoportarProgramadoProbar', 'warning')
    return
  }
  scheduledTestAccount.value = account
  showScheduledTestModal.value = true
}

const closeScheduledTestModal = () => {
  showScheduledTestModal.value = false
  scheduledTestAccount.value = null
}

const handleScheduledTestSaved = () => {
  showToast('ProgramadoConfiguración de pruebayaguardar', 'success')
}

// saldoscriptconfigurar
const showBalanceScriptModal = ref(false)
const selectedAccountForScript = ref(null)

const openBalanceScriptModal = (account) => {
  selectedAccountForScript.value = account
  showBalanceScriptModal.value = true
}

const closeBalanceScriptModal = () => {
  showBalanceScriptModal.value = false
  selectedAccountForScript.value = null
}

const handleBalanceScriptSaved = async () => {
  showToast('saldoscriptyaguardar', 'success')
  const account = selectedAccountForScript.value
  closeBalanceScriptModal()

  if (!account?.id || !account?.platform) {
    return
  }

  // volver atirar一vecessaldoinformación，usar于Actualizar scriptConfigured Estado（Habilitar"Actualizar saldo"botón）
  try {
    const res = await httpApis.getAccountBalanceApi(account.id, {
      platform: account.platform,
      queryApi: false
    })
    if (res?.success && res.data) {
      handleBalanceRefreshed(account.id, res.data)
    }
  } catch (error) {
    console.debug('Failed to reload balance after saving script:', error)
  }
}

// calcularordenardespués decuentalista
const sortedAccounts = computed(() => {
  let sourceAccounts = accounts.value

  const keyword = searchKeyword.value.trim()
  if (keyword) {
    const normalizedKeyword = keyword.toLowerCase()
    sourceAccounts = sourceAccounts.filter((account) =>
      accountMatchesKeyword(account, normalizedKeyword)
    )
  }

  // Estado过滤 (normal/unschedulable/rateLimited/other/all)
  // limitación: isActive && rate-limited (最高Prioridad)
  // Normal: isActive && !rate-limited && !blocked && schedulable
  // No programable: isActive && !rate-limited && !blocked && schedulable === false
  // Otro: nolimitación（sinactivar || 被prevenir）
  if (statusFilter.value !== 'all') {
    sourceAccounts = sourceAccounts.filter((account) => {
      const isRateLimited = isAccountRateLimited(account)
      const isBlocked = account.status === 'blocked' || account.status === 'unauthorized'

      if (statusFilter.value === 'rateLimited') {
        // limitación: activaryLimitando（优先判断）
        return account.isActive && isRateLimited
      } else if (statusFilter.value === 'normal') {
        // Normal: activarynolimitaciónynopreveniry可Programar
        return account.isActive && !isRateLimited && !isBlocked && account.schedulable !== false
      } else if (statusFilter.value === 'unschedulable') {
        // No programable: activarynolimitaciónynoprevenirperoNo programable
        return account.isActive && !isRateLimited && !isBlocked && account.schedulable === false
      } else if (statusFilter.value === 'other') {
        // Otro: nolimitaciónAnormalcuenta（sinactivaro被prevenir）
        return !isRateLimited && (!account.isActive || isBlocked)
      }
      return true
    })
  }

  if (!accountsSortBy.value) return sourceAccounts

  const sorted = [...sourceAccounts].sort((a, b) => {
    let aVal = a[accountsSortBy.value]
    let bVal = b[accountsSortBy.value]

    // manejoEstadísticasdatos
    if (accountsSortBy.value === 'dailyTokens') {
      aVal = a.usage?.daily?.allTokens || 0
      bVal = b.usage?.daily?.allTokens || 0
    } else if (accountsSortBy.value === 'dailyRequests') {
      aVal = a.usage?.daily?.requests || 0
      bVal = b.usage?.daily?.requests || 0
    } else if (accountsSortBy.value === 'totalTokens') {
      aVal = a.usage?.total?.allTokens || 0
      bVal = b.usage?.total?.allTokens || 0
    }

    // manejoÚltimo uso
    if (accountsSortBy.value === 'lastUsed') {
      aVal = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0
      bVal = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0
    }

    // manejoEstado
    if (accountsSortBy.value === 'status') {
      aVal = a.isActive ? 1 : 0
      bVal = b.isActive ? 1 : 0
    }

    // manejolimitaciónordenar: sinlimitación优先，然después de按Restantedesde小a大
    if (accountsSortBy.value === 'rateLimitTime') {
      const aIsRateLimited = isAccountRateLimited(a)
      const bIsRateLimited = isAccountRateLimited(b)
      const aMinutes = aIsRateLimited ? getRateLimitRemainingMinutes(a) : 0
      const bMinutes = bIsRateLimited ? getRateLimitRemainingMinutes(b) : 0

      // sinlimitación排enantes de面
      if (!aIsRateLimited && bIsRateLimited) return -1
      if (aIsRateLimited && !bIsRateLimited) return 1

      // 都sinlimitacióno都limitacióncuando，按Restante升序
      if (aMinutes < bMinutes) return -1
      if (aMinutes > bMinutes) return 1
      return 0
    }

    if (aVal < bVal) return accountsSortOrder.value === 'asc' ? -1 : 1
    if (aVal > bVal) return accountsSortOrder.value === 'asc' ? 1 : -1
    return 0
  })

  return sorted
})

const totalPages = computed(() => {
  const total = sortedAccounts.value.length
  return Math.ceil(total / pageSize.value) || 0
})

// cuentaEstadísticasdatos（按plataformayEstado分clase）
const accountStats = computed(() => {
  const platforms = [
    { value: 'claude', label: 'Claude' },
    { value: 'claude-console', label: 'Claude Console' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'gemini-api', label: 'Gemini API' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'azure_openai', label: 'Azure OpenAI' },
    { value: 'bedrock', label: 'Bedrock' },
    { value: 'openai-responses', label: 'OpenAI-Responses' },
    { value: 'ccr', label: 'CCR' },
    { value: 'droid', label: 'Droid' }
  ]

  return platforms
    .map((p) => {
      const platformAccounts = accounts.value.filter((acc) => acc.platform === p.value)

      // 先filtrarlimitacióncuenta（Prioridad最高）
      const rateLimitedAccounts = platformAccounts.filter((acc) => isAccountRateLimited(acc))

      // Normal: nolimitación && activar && noprevenir && 可Programar
      const normal = platformAccounts.filter((acc) => {
        const isRateLimited = isAccountRateLimited(acc)
        const isBlocked = acc.status === 'blocked' || acc.status === 'unauthorized'
        return !isRateLimited && acc.isActive && !isBlocked && acc.schedulable !== false
      }).length

      // No programable: nolimitación && activar && noprevenir && No programable
      const unschedulable = platformAccounts.filter((acc) => {
        const isRateLimited = isAccountRateLimited(acc)
        const isBlocked = acc.status === 'blocked' || acc.status === 'unauthorized'
        return !isRateLimited && acc.isActive && !isBlocked && acc.schedulable === false
      }).length

      // Otro: nolimitaciónAnormalcuenta（sinactivaro被prevenir）
      const other = platformAccounts.filter((acc) => {
        const isRateLimited = isAccountRateLimited(acc)
        const isBlocked = acc.status === 'blocked' || acc.status === 'unauthorized'
        return !isRateLimited && (!acc.isActive || isBlocked)
      }).length

      const rateLimit0_1h = rateLimitedAccounts.filter((acc) => {
        const minutes = getRateLimitRemainingMinutes(acc)
        return minutes > 0 && minutes <= 60
      }).length

      const rateLimit1_5h = rateLimitedAccounts.filter((acc) => {
        const minutes = getRateLimitRemainingMinutes(acc)
        return minutes > 60 && minutes <= 300
      }).length

      const rateLimit5_12h = rateLimitedAccounts.filter((acc) => {
        const minutes = getRateLimitRemainingMinutes(acc)
        return minutes > 300 && minutes <= 720
      }).length

      const rateLimit12_24h = rateLimitedAccounts.filter((acc) => {
        const minutes = getRateLimitRemainingMinutes(acc)
        return minutes > 720 && minutes <= 1440
      }).length

      const rateLimitOver24h = rateLimitedAccounts.filter((acc) => {
        const minutes = getRateLimitRemainingMinutes(acc)
        return minutes > 1440
      }).length

      return {
        platform: p.value,
        platformLabel: p.label,
        normal,
        unschedulable,
        rateLimit0_1h,
        rateLimit1_5h,
        rateLimit5_12h,
        rateLimit12_24h,
        rateLimitOver24h,
        other,
        total: platformAccounts.length
      }
    })
    .filter((stat) => stat.total > 0) // 只pantallaconcuentaplataforma
})

// cuentaEstadísticasTotal
const accountStatsTotal = computed(() => {
  return accountStats.value.reduce(
    (total, stat) => {
      total.normal += stat.normal
      total.unschedulable += stat.unschedulable
      total.rateLimit0_1h += stat.rateLimit0_1h
      total.rateLimit1_5h += stat.rateLimit1_5h
      total.rateLimit5_12h += stat.rateLimit5_12h
      total.rateLimit12_24h += stat.rateLimit12_24h
      total.rateLimitOver24h += stat.rateLimitOver24h
      total.other += stat.other
      total.total += stat.total
      return total
    },
    {
      normal: 0,
      unschedulable: 0,
      rateLimit0_1h: 0,
      rateLimit1_5h: 0,
      rateLimit5_12h: 0,
      rateLimit12_24h: 0,
      rateLimitOver24h: 0,
      other: 0,
      total: 0
    }
  )
})

const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const pages = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    let start = Math.max(1, current - 2)
    let end = Math.min(total, current + 2)

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

const paginatedAccounts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return sortedAccounts.value.slice(start, end)
})

const canRefreshVisibleBalances = computed(() => {
  const targets = paginatedAccounts.value
  if (!Array.isArray(targets) || targets.length === 0) {
    return false
  }

  return targets.some((account) => {
    const info = account?.balanceInfo
    return info?.scriptEnabled !== false && !!info?.scriptConfigured
  })
})

const refreshBalanceTooltip = computed(() => {
  if (accountsLoading.value) return 'Cargando cuentas...'
  if (refreshingBalances.value) return 'Actualizaren...'
  if (!canRefreshVisibleBalances.value) return '当antes de页sinConfigurar script de saldo，sin法Actualizar'
  return 'Actualizar当antes de页saldo（仅paryaConfigurar script de saldocuenta生效）'
})

// saldoActualizarexitosodevolución de llamada
const handleBalanceRefreshed = (accountId, balanceInfo) => {
  accounts.value = accounts.value.map((account) => {
    if (account.id !== accountId) return account
    return { ...account, balanceInfo }
  })
}

// saldosolicitudincorrectodevolución de llamada（仅sugerencia，nointerrumpirpágina）
const handleBalanceError = (_accountId, error) => {
  const message = error?.message || 'saldoconsultafallido'
  showToast(message, 'error')
}

// loteActualizar当antes de页saldo（activarconsulta）
const refreshVisibleBalances = async () => {
  if (refreshingBalances.value) return

  const targets = paginatedAccounts.value
  if (!targets || targets.length === 0) {
    return
  }

  const eligibleTargets = targets.filter((account) => {
    const info = account?.balanceInfo
    return info?.scriptEnabled !== false && !!info?.scriptConfigured
  })

  if (eligibleTargets.length === 0) {
    showToast('当antes de页没conConfigurar script de saldocuenta', 'warning')
    return
  }

  const skippedCount = targets.length - eligibleTargets.length

  refreshingBalances.value = true
  try {
    const results = await Promise.all(
      eligibleTargets.map(async (account) => {
        try {
          const response = await httpApis.refreshAccountBalanceApi(account.id, {
            platform: account.platform
          })
          return { id: account.id, success: !!response?.success, data: response?.data || null }
        } catch (error) {
          return { id: account.id, success: false, error: error?.message || 'Actualizarfallido' }
        }
      })
    )

    const updatedMap = results.reduce((map, item) => {
      if (item.success && item.data) {
        map[item.id] = item.data
      }
      return map
    }, {})

    const successCount = results.filter((r) => r.success).length
    const failCount = results.length - successCount

    const skippedText = skippedCount > 0 ? `，跳过 ${skippedCount}  No configuradoscript` : ''
    if (Object.keys(updatedMap).length > 0) {
      accounts.value = accounts.value.map((account) => {
        const balanceInfo = updatedMap[account.id]
        if (!balanceInfo) return account
        return { ...account, balanceInfo }
      })
    }

    if (failCount === 0) {
      showToast(`exitosoActualizar ${successCount}  cuentasaldo${skippedText}`, 'success')
    } else {
      showToast(`Actualizarcompletado：${successCount} exitoso，${failCount} fallido${skippedText}`, 'warning')
    }
  } finally {
    refreshingBalances.value = false
  }
}

const updateSelectAllState = () => {
  const currentIds = paginatedAccounts.value.map((account) => account.id)
  const selectedInCurrentPage = currentIds.filter((id) =>
    selectedAccounts.value.includes(id)
  ).length
  const totalInCurrentPage = currentIds.length

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

const handleSelectAll = () => {
  if (selectAllChecked.value) {
    paginatedAccounts.value.forEach((account) => {
      if (!selectedAccounts.value.includes(account.id)) {
        selectedAccounts.value.push(account.id)
      }
    })
  } else {
    const currentIds = new Set(paginatedAccounts.value.map((account) => account.id))
    selectedAccounts.value = selectedAccounts.value.filter((id) => !currentIds.has(id))
  }
  updateSelectAllState()
}

const toggleSelectionMode = () => {
  showCheckboxes.value = !showCheckboxes.value
  if (!showCheckboxes.value) {
    selectedAccounts.value = []
    selectAllChecked.value = false
    isIndeterminate.value = false
  } else {
    updateSelectAllState()
  }
}

const cleanupSelectedAccounts = () => {
  const validIds = new Set(accounts.value.map((account) => account.id))
  selectedAccounts.value = selectedAccounts.value.filter((id) => validIds.has(id))
  updateSelectAllState()
}

// asincrónicocargarsaldocaché（按plataformalotetirar，避免逐行solicitud）
const loadBalanceCacheForAccounts = async () => {
  const current = accounts.value
  if (!Array.isArray(current) || current.length === 0) {
    return
  }

  const platforms = Array.from(new Set(current.map((acc) => acc.platform).filter(Boolean)))
  if (platforms.length === 0) {
    return
  }

  const responses = await Promise.all(
    platforms.map(async (platform) => {
      try {
        const res = await httpApis.getBalanceByPlatformApi(platform, { queryApi: false })
        return { platform, success: !!res?.success, data: res?.data || [] }
      } catch (error) {
        console.debug(`Failed to load balance cache for ${platform}:`, error)
        return { platform, success: false, data: [] }
      }
    })
  )

  const balanceMap = responses.reduce((map, item) => {
    if (!item.success) return map
    const list = Array.isArray(item.data) ? item.data : []
    list.forEach((entry) => {
      const accountId = entry?.data?.accountId
      if (accountId) {
        map[accountId] = entry.data
      }
    })
    return map
  }, {})

  if (Object.keys(balanceMap).length === 0) {
    return
  }

  accounts.value = accounts.value.map((account) => ({
    ...account,
    balanceInfo: balanceMap[account.id] || account.balanceInfo || null
  }))
}

// cargarcuentalista
const loadAccounts = async (forceReload = false) => {
  accountsLoading.value = true
  try {
    // 构建consultaparámetro（usar于Otrofiltrarsituación）
    const params = {}
    if (platformFilter.value !== 'all' && !platformGroupMap[platformFilter.value]) {
      params.platform = platformFilter.value
    }
    if (groupFilter.value !== 'all') {
      params.groupId = groupFilter.value
    }

    const platformsToFetch = getPlatformsForFilter(platformFilter.value)

    // usarcaché机制cargarvincular计数yGruposdatos（no再cargar完整 API Keys datos）
    await Promise.all([loadBindingCounts(forceReload), loadAccountGroups(forceReload)])

    // backendcuentaAPIya经incluirGruposinformación，nonecesita要单独cargarGruposmiembro关系
    // await loadGroupMembers(forceReload)

    const platformResults = await Promise.all(
      platformsToFetch.map(async (platform) => {
        const handler = platformRequestHandlers[platform]
        if (!handler) {
          return { platform, success: true, data: [] }
        }

        try {
          const res = await handler(params)
          return { platform, success: res?.success, data: res?.data }
        } catch (error) {
          console.debug(`Failed to load ${platform} accounts:`, error)
          return { platform, success: false, data: [] }
        }
      })
    )

    const allAccounts = []
    const counts = bindingCounts.value || {}
    let openaiResponsesRaw = []

    const appendAccounts = (platform, data) => {
      const list = Array.isArray(data) ? data : []
      if (list.length === 0) return

      switch (platform) {
        case 'claude': {
          const items = list.map((acc) => {
            const boundApiKeysCount = counts.claudeAccountId?.[acc.id] || 0
            return { ...acc, platform: 'claude', boundApiKeysCount }
          })
          allAccounts.push(...items)
          break
        }
        case 'claude-console': {
          const items = list.map((acc) => {
            const boundApiKeysCount = counts.claudeConsoleAccountId?.[acc.id] || 0
            return { ...acc, platform: 'claude-console', boundApiKeysCount }
          })
          allAccounts.push(...items)
          break
        }
        case 'bedrock': {
          const items = list.map((acc) => ({ ...acc, platform: 'bedrock', boundApiKeysCount: 0 }))
          allAccounts.push(...items)
          break
        }
        case 'gemini': {
          const items = list.map((acc) => {
            const boundApiKeysCount = counts.geminiAccountId?.[acc.id] || 0
            return { ...acc, platform: 'gemini', boundApiKeysCount }
          })
          allAccounts.push(...items)
          break
        }
        case 'openai': {
          const items = list.map((acc) => {
            const boundApiKeysCount = counts.openaiAccountId?.[acc.id] || 0
            return { ...acc, platform: 'openai', boundApiKeysCount }
          })
          allAccounts.push(...items)
          break
        }
        case 'azure_openai': {
          const items = list.map((acc) => {
            const boundApiKeysCount = counts.azureOpenaiAccountId?.[acc.id] || 0
            return { ...acc, platform: 'azure_openai', boundApiKeysCount }
          })
          allAccounts.push(...items)
          break
        }
        case 'openai-responses': {
          openaiResponsesRaw = list
          break
        }
        case 'ccr': {
          const items = list.map((acc) => ({ ...acc, platform: 'ccr', boundApiKeysCount: 0 }))
          allAccounts.push(...items)
          break
        }
        case 'droid': {
          const items = list.map((acc) => {
            const boundApiKeysCount = counts.droidAccountId?.[acc.id] || acc.boundApiKeysCount || 0
            return { ...acc, platform: 'droid', boundApiKeysCount }
          })
          allAccounts.push(...items)
          break
        }
        case 'gemini-api': {
          const items = list.map((acc) => {
            const boundApiKeysCount = counts.geminiAccountId?.[`api:${acc.id}`] || 0
            return { ...acc, platform: 'gemini-api', boundApiKeysCount }
          })
          allAccounts.push(...items)
          break
        }
        default:
          break
      }
    }

    platformResults.forEach(({ platform, success, data }) => {
      if (success) {
        appendAccounts(platform, data || [])
      }
    })

    if (openaiResponsesRaw.length > 0) {
      const responsesAccounts = openaiResponsesRaw.map((acc) => {
        const boundApiKeysCount = counts.openaiAccountId?.[`responses:${acc.id}`] || 0
        return { ...acc, platform: 'openai-responses', boundApiKeysCount }
      })

      allAccounts.push(...responsesAccounts)
    }

    // 根据Filtro de grupos过滤cuenta
    let filteredAccounts = allAccounts
    if (groupFilter.value !== 'all') {
      if (groupFilter.value === 'ungrouped') {
        // filtrarsinGruposcuenta（没con groupInfos o groupInfos para空arreglo）
        filteredAccounts = allAccounts.filter((account) => {
          return !account.groupInfos || account.groupInfos.length === 0
        })
      } else {
        // filtrar属于特定Gruposcuenta
        filteredAccounts = allAccounts.filter((account) => {
          if (!account.groupInfos || account.groupInfos.length === 0) {
            return false
          }
          // verificarcuentaes否属于seleccionadoGrupos
          return account.groupInfos.some((group) => group.id === groupFilter.value)
        })
      }
    }

    filteredAccounts = filteredAccounts.map((account) => {
      const proxyConfig = normalizeProxyData(account.proxyConfig || account.proxy)
      return {
        ...account,
        proxyConfig: proxyConfig || null
      }
    })

    accounts.value = filteredAccounts
    cleanupSelectedAccounts()

    // asincrónicocargar Cuenta Claude OAuth usage datos
    if (filteredAccounts.some((acc) => acc.platform === 'claude')) {
      loadClaudeUsage().catch((err) => {
        console.debug('Claude usage loading failed:', err)
      })
    }

    // asincrónicocargarsaldocaché（按plataformalote）
    loadBalanceCacheForAccounts().catch((err) => {
      console.debug('Balance cache loading failed:', err)
    })
  } catch (error) {
    showToast('cargarcuentafallido', 'error')
  } finally {
    accountsLoading.value = false
  }
}

// asincrónicocargar Claude cuenta Usage datos
const loadClaudeUsage = async () => {
  const response = await httpApis.getClaudeAccountsUsageApi()
  if (response.success && response.data) {
    const usageMap = response.data
    accounts.value = accounts.value.map((account) => {
      if (account.platform === 'claude' && usageMap[account.id]) {
        return { ...account, claudeUsage: usageMap[account.id] }
      }
      return account
    })
  }
}

// registrararriba一vecesordenarcampo，usar于判断abajo拉Seleccionares否es同一campo被再vecesSeleccionar
let lastDropdownSortField = 'name'

// ordenarcuenta（表头clicusar）
const sortAccounts = (field) => {
  if (field) {
    if (accountsSortBy.value === field) {
      accountsSortOrder.value = accountsSortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      accountsSortBy.value = field
      accountsSortOrder.value = 'asc'
    }
    // sincronizarabajo拉Seleccionar器Estadoregistrar
    lastDropdownSortField = field
  }
}

// abajo拉Seleccionar器ordenarmanejo（soportar再vecesSeleccionar同一opcióncuando切换ordenar方向）
const handleDropdownSort = (field) => {
  if (field === lastDropdownSortField) {
    // Seleccionar同一campo，切换ordenar方向
    accountsSortOrder.value = accountsSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Seleccionarno同campo，Reiniciopara升序
    accountsSortOrder.value = 'asc'
  }
  lastDropdownSortField = field
}

// formato化数字（de原版保持一致）

// formato化Último uso
const formatLastUsed = (dateString) => {
  if (!dateString) return 'Nunca usado'

  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟antes de`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小cuandoantes de`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天antes de`

  return date.toLocaleDateString('zh-CN')
}

const clearSearch = () => {
  searchKeyword.value = ''
  currentPage.value = 1
}

// cargarvincular计数（轻量级interfaz，usar于pantalla"vincular: X  API Key"）
const loadBindingCounts = async (forceReload = false) => {
  if (!forceReload && bindingCountsLoaded.value) return
  const response = await httpApis.getAccountsBindingCountsApi()
  if (response.success) {
    bindingCounts.value = response.data || {}
    bindingCountsLoaded.value = true
  }
}

// cargarAPI Keyslista（保留usar于Otrofunción，comoEliminar cuentacuandopantallavincularinformación）
const loadApiKeys = async (forceReload = false) => {
  if (!forceReload && apiKeysLoaded.value) return
  const response = await httpApis.getApiKeysApi()
  if (response.success) {
    apiKeys.value = response.data?.items || response.data || []
    apiKeysLoaded.value = true
  }
}

// cargarcuentaGruposlista（cachéversión）
const loadAccountGroups = async (forceReload = false) => {
  if (!forceReload && groupsLoaded.value) return
  const response = await httpApis.getAccountGroupsApi()
  if (response.success) {
    accountGroups.value = response.data || []
    groupsLoaded.value = true
  }
}

// 清空cachéfunción
const clearCache = () => {
  apiKeysLoaded.value = false
  bindingCountsLoaded.value = false
  groupsLoaded.value = false
  groupMembersLoaded.value = false
  accountGroupMap.value.clear()
}

// 按plataformafiltrarcuenta
const filterByPlatform = () => {
  currentPage.value = 1
  loadAccounts()
}

// 按Gruposfiltrarcuenta
const filterByGroup = () => {
  currentPage.value = 1
  loadAccounts()
}

// norma化Configuración de proxy，soportar字符串deobjeto
function normalizeProxyData(proxy) {
  if (!proxy) {
    return null
  }

  let proxyObject = proxy
  if (typeof proxy === 'string') {
    try {
      proxyObject = JSON.parse(proxy)
    } catch (error) {
      return null
    }
  }

  if (!proxyObject || typeof proxyObject !== 'object') {
    return null
  }

  const candidate =
    proxyObject.proxy && typeof proxyObject.proxy === 'object' ? proxyObject.proxy : proxyObject

  const host =
    typeof candidate.host === 'string'
      ? candidate.host.trim()
      : candidate.host !== undefined && candidate.host !== null
        ? String(candidate.host).trim()
        : ''

  const port =
    candidate.port !== undefined && candidate.port !== null ? String(candidate.port).trim() : ''

  if (!host || !port) {
    return null
  }

  const type =
    typeof candidate.type === 'string' && candidate.type.trim() ? candidate.type.trim() : 'socks5'

  const username =
    typeof candidate.username === 'string'
      ? candidate.username
      : candidate.username !== undefined && candidate.username !== null
        ? String(candidate.username)
        : ''

  const password =
    typeof candidate.password === 'string'
      ? candidate.password
      : candidate.password !== undefined && candidate.password !== null
        ? String(candidate.password)
        : ''

  return {
    type,
    host,
    port,
    username,
    password
  }
}

// formato化Proxyinformaciónpantalla
const formatProxyDisplay = (proxy) => {
  const parsed = normalizeProxyData(proxy)
  if (!parsed) {
    return null
  }

  const typeShort = parsed.type.toLowerCase() === 'socks5' ? 'S5' : parsed.type.toUpperCase()

  let host = parsed.host
  if (host.length > 15) {
    host = host.substring(0, 12) + '...'
  }

  let display = `${typeShort}://${host}:${parsed.port}`

  if (parsed.username) {
    display = `${typeShort}://***@${host}:${parsed.port}`
  }

  return display
}

// formato化Ventana de sesión
const formatSessionWindow = (windowStart, windowEnd) => {
  if (!windowStart || !windowEnd) return '--'

  const start = new Date(windowStart)
  const end = new Date(windowEnd)

  const startHour = start.getHours().toString().padStart(2, '0')
  const startMin = start.getMinutes().toString().padStart(2, '0')
  const endHour = end.getHours().toString().padStart(2, '0')
  const endMin = end.getMinutes().toString().padStart(2, '0')

  return `${startHour}:${startMin} - ${endHour}:${endMin}`
}

// formato化Restante
const formatRemainingTime = (minutes) => {
  if (!minutes || minutes <= 0) return 'Finalizado'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0) {
    return `${hours}小cuando${mins}分钟`
  }
  return `${mins}分钟`
}

// formato化limitación（soportarpantalla天数）
const formatRateLimitTime = (minutes) => {
  if (!minutes || minutes <= 0) return ''

  // 转换para整数，避免小数
  minutes = Math.floor(minutes)

  // calcular天数、小cuandoy分钟
  const days = Math.floor(minutes / 1440) // 1天 = 1440分钟
  const remainingAfterDays = minutes % 1440
  const hours = Math.floor(remainingAfterDays / 60)
  const mins = remainingAfterDays % 60

  // 根据longituddevolverno同formato
  if (days > 0) {
    // 超过1天，pantalla天数y小cuando
    if (hours > 0) {
      return `${days}天${hours}小cuando`
    }
    return `${days}天`
  } else if (hours > 0) {
    // 超过1小cuandoperonoa1天，pantalla小cuandoy分钟
    if (mins > 0) {
      return `${hours}小cuando${mins}分钟`
    }
    return `${hours}小cuando`
  } else {
    // noa1小cuando，只pantalla分钟
    return `${mins}分钟`
  }
}

// verificarcuentaes否被limitación
const isAccountRateLimited = (account) => {
  if (!account) return false

  // verificar rateLimitStatus
  if (account.rateLimitStatus) {
    if (typeof account.rateLimitStatus === 'string' && account.rateLimitStatus === 'limited') {
      return true
    }
    if (
      typeof account.rateLimitStatus === 'object' &&
      account.rateLimitStatus.isRateLimited === true
    ) {
      return true
    }
  }

  return false
}

// obtenerlimitaciónRestante（分钟）
const getRateLimitRemainingMinutes = (account) => {
  if (!account || !account.rateLimitStatus) return 0

  if (typeof account.rateLimitStatus === 'object') {
    const status = account.rateLimitStatus
    if (Number.isFinite(status.minutesRemaining)) {
      return Math.max(0, Math.ceil(status.minutesRemaining))
    }
    if (Number.isFinite(status.remainingMinutes)) {
      return Math.max(0, Math.ceil(status.remainingMinutes))
    }
    if (Number.isFinite(status.remainingSeconds)) {
      return Math.max(0, Math.ceil(status.remainingSeconds / 60))
    }
    if (status.rateLimitResetAt) {
      const diffMs = new Date(status.rateLimitResetAt).getTime() - Date.now()
      return diffMs > 0 ? Math.ceil(diffMs / 60000) : 0
    }
  }

  // como果con rateLimitUntil campo，calcularRestante
  if (account.rateLimitUntil) {
    const now = new Date().getTime()
    const untilTime = new Date(account.rateLimitUntil).getTime()
    const diff = untilTime - now
    return diff > 0 ? Math.ceil(diff / 60000) : 0
  }

  return 0
}

// abrircrearcuentamodal
const openCreateAccountModal = () => {
  newAccountPlatform.value = null // ReinicioSeleccionarplataforma
  showCreateAccountModal.value = true
}

// cerrarcrearcuentamodal
const closeCreateAccountModal = () => {
  showCreateAccountModal.value = false
  newAccountPlatform.value = null
}

// Editar cuenta
const editAccount = (account) => {
  editingAccount.value = account
  showEditAccountModal.value = true
}

const getBoundApiKeysForAccount = (account) => {
  if (!account || !account.id) return []
  return apiKeys.value.filter((key) => {
    const accountId = account.id
    return (
      key.claudeAccountId === accountId ||
      key.claudeConsoleAccountId === accountId ||
      key.geminiAccountId === accountId ||
      key.openaiAccountId === accountId ||
      key.azureOpenaiAccountId === accountId ||
      key.openaiAccountId === `responses:${accountId}` ||
      key.geminiAccountId === `api:${accountId}`
    )
  })
}

const resolveAccountDeleteEndpoint = (account) => {
  switch (account.platform) {
    case 'claude':
      return `/admin/claude-accounts/${account.id}`
    case 'claude-console':
      return `/admin/claude-console-accounts/${account.id}`
    case 'bedrock':
      return `/admin/bedrock-accounts/${account.id}`
    case 'openai':
      return `/admin/openai-accounts/${account.id}`
    case 'azure_openai':
      return `/admin/azure-openai-accounts/${account.id}`
    case 'openai-responses':
      return `/admin/openai-responses-accounts/${account.id}`
    case 'ccr':
      return `/admin/ccr-accounts/${account.id}`
    case 'gemini':
      return `/admin/gemini-accounts/${account.id}`
    case 'droid':
      return `/admin/droid-accounts/${account.id}`
    case 'gemini-api':
      return `/admin/gemini-api-accounts/${account.id}`
    default:
      return null
  }
}

const performAccountDeletion = async (account) => {
  const endpoint = resolveAccountDeleteEndpoint(account)
  if (!endpoint) return { success: false, message: 'nosoportarcuentatipo' }
  const data = await httpApis.deleteAccountByEndpointApi(endpoint)
  if (data.success) return { success: true, data }
  return { success: false, message: data.message || 'Eliminarfallido' }
}

// Eliminar cuenta
const deleteAccount = async (account) => {
  const boundKeys = getBoundApiKeysForAccount(account)
  const boundKeysCount = boundKeys.length

  let confirmMessage = `Confirmar要Eliminar cuenta "${account.name}" 吗？`
  if (boundKeysCount > 0) {
    confirmMessage += `\n\n⚠️ Nota：此账号con ${boundKeysCount}   API Key vincular。`
    confirmMessage += `\nEliminardespués de，这些 API Key 将automático切换paraCompartida池modo。`
  }
  confirmMessage += '\n\n此Operacionesno可recuperar。'

  const confirmed = await showConfirm('Eliminar cuenta', confirmMessage, 'Eliminar', 'Cancelar')

  if (!confirmed) return

  const result = await performAccountDeletion(account)

  if (result.success) {
    const data = result.data
    let toastMessage = 'cuentayaexitosoEliminar'
    if (data?.unboundKeys > 0) {
      toastMessage += `，${data.unboundKeys}   API Key ya切换paraCompartida池modo`
    }
    showToast(toastMessage, 'success')

    selectedAccounts.value = selectedAccounts.value.filter((id) => id !== account.id)
    updateSelectAllState()

    groupMembersLoaded.value = false
    apiKeysLoaded.value = false
    bindingCountsLoaded.value = false
    loadAccounts()
    loadApiKeys(true) // Actualizar完整 API Keys lista（usar于Otrofunción）
    loadBindingCounts(true) // Actualizarvincular计数
  } else {
    showToast(result.message || 'Eliminarfallido', 'error')
  }
}

// loteEliminar cuenta
const batchDeleteAccounts = async () => {
  if (selectedAccounts.value.length === 0) {
    showToast('请先Seleccionar要Eliminarcuenta', 'warning')
    return
  }

  const accountsMap = new Map(accounts.value.map((item) => [item.id, item]))
  const targets = selectedAccounts.value
    .map((id) => accountsMap.get(id))
    .filter((account) => !!account)

  if (targets.length === 0) {
    showToast('seleccionadocuentayano存en', 'warning')
    selectedAccounts.value = []
    updateSelectAllState()
    return
  }

  let confirmMessage = `Confirmar要Eliminar seleccionados ${targets.length}  cuenta吗？此Operacionesno可recuperar。`
  const boundInfo = targets
    .map((account) => ({ account, boundKeys: getBoundApiKeysForAccount(account) }))
    .filter((item) => item.boundKeys.length > 0)

  if (boundInfo.length > 0) {
    confirmMessage += '\n\n⚠️ 以abajocuenta存envincular API Key，将automático解绑：'
    boundInfo.forEach(({ account, boundKeys }) => {
      const displayName = account.name || account.email || account.accountName || account.id
      confirmMessage += `\n- ${displayName}: ${boundKeys.length}  `
    })
    confirmMessage += '\nEliminardespués de，这些 API Key 将切换paraCompartida池modo。'
  }

  confirmMessage += '\n\n请再vecesconfirmares否Continuar。'

  const confirmed = await showConfirm('loteEliminar cuenta', confirmMessage, 'Eliminar', 'Cancelar')
  if (!confirmed) return

  let successCount = 0
  let failedCount = 0
  let totalUnboundKeys = 0
  const failedDetails = []

  for (const account of targets) {
    const result = await performAccountDeletion(account)
    if (result.success) {
      successCount += 1
      totalUnboundKeys += result.data?.unboundKeys || 0
    } else {
      failedCount += 1
      failedDetails.push({
        name: account.name || account.email || account.accountName || account.id,
        message: result.message || 'Eliminarfallido'
      })
    }
  }

  if (successCount > 0) {
    let toastMessage = `exitosoEliminar ${successCount}  cuenta`
    if (totalUnboundKeys > 0) {
      toastMessage += `，${totalUnboundKeys}   API Key ya切换paraCompartida池modo`
    }
    showToast(toastMessage, failedCount > 0 ? 'warning' : 'success')

    selectedAccounts.value = []
    selectAllChecked.value = false
    isIndeterminate.value = false

    groupMembersLoaded.value = false
    apiKeysLoaded.value = false
    await loadAccounts(true)
  }

  if (failedCount > 0) {
    const detailMessage = failedDetails.map((item) => `${item.name}: ${item.message}`).join('\n')
    showToast(
      `con ${failedCount}  cuentaEliminarfallido:\n${detailMessage}`,
      successCount > 0 ? 'warning' : 'error'
    )
  }

  updateSelectAllState()
}

// ReiniciocuentaEstado
const resetAccountStatus = async (account) => {
  if (account.isResetting) return

  const confirmed = await showConfirm(
    'ReiniciocuentaEstado',
    'Confirmar要Reinicio此cuentatodos los estados anormales吗？这将清除limitaciónEstado、401incorrecto计数etctodosAnormalmarca。',
    'ConfirmarReinicio',
    'Cancelar',
    'warning'
  )

  if (!confirmed) return

  try {
    account.isResetting = true

    // 根据cuentaplataformaSeleccionarno同 API 端点
    let endpoint = ''
    if (account.platform === 'openai') {
      endpoint = `/admin/openai-accounts/${account.id}/reset-status`
    } else if (account.platform === 'openai-responses') {
      endpoint = `/admin/openai-responses-accounts/${account.id}/reset-status`
    } else if (account.platform === 'claude') {
      endpoint = `/admin/claude-accounts/${account.id}/reset-status`
    } else if (account.platform === 'claude-console') {
      endpoint = `/admin/claude-console-accounts/${account.id}/reset-status`
    } else if (account.platform === 'ccr') {
      endpoint = `/admin/ccr-accounts/${account.id}/reset-status`
    } else if (account.platform === 'droid') {
      endpoint = `/admin/droid-accounts/${account.id}/reset-status`
    } else if (account.platform === 'gemini-api') {
      endpoint = `/admin/gemini-api-accounts/${account.id}/reset-status`
    } else if (account.platform === 'gemini') {
      endpoint = `/admin/gemini-accounts/${account.id}/reset-status`
    } else {
      showToast('nosoportarcuentatipo', 'error')
      account.isResetting = false
      return
    }

    const data = await httpApis.testAccountByEndpointApi(endpoint)
    if (data.success) {
      showToast('cuentaEstadoyaReinicio', 'success')
      loadAccounts(true)
    } else {
      showToast(data.message || 'EstadoReiniciofallido', 'error')
    }
    account.isResetting = false
  } catch (error) {
    showToast(error.message || 'EstadoReiniciofallido', 'error')
    account.isResetting = false
  }
}

// 切换ProgramarEstado
const toggleSchedulable = async (account) => {
  if (account.isTogglingSchedulable) return
  account.isTogglingSchedulable = true

  let endpoint
  if (account.platform === 'claude') {
    endpoint = `/admin/claude-accounts/${account.id}/toggle-schedulable`
  } else if (account.platform === 'claude-console') {
    endpoint = `/admin/claude-console-accounts/${account.id}/toggle-schedulable`
  } else if (account.platform === 'bedrock') {
    endpoint = `/admin/bedrock-accounts/${account.id}/toggle-schedulable`
  } else if (account.platform === 'gemini') {
    endpoint = `/admin/gemini-accounts/${account.id}/toggle-schedulable`
  } else if (account.platform === 'openai') {
    endpoint = `/admin/openai-accounts/${account.id}/toggle-schedulable`
  } else if (account.platform === 'azure_openai') {
    endpoint = `/admin/azure-openai-accounts/${account.id}/toggle-schedulable`
  } else if (account.platform === 'openai-responses') {
    endpoint = `/admin/openai-responses-accounts/${account.id}/toggle-schedulable`
  } else if (account.platform === 'ccr') {
    endpoint = `/admin/ccr-accounts/${account.id}/toggle-schedulable`
  } else if (account.platform === 'droid') {
    endpoint = `/admin/droid-accounts/${account.id}/toggle-schedulable`
  } else if (account.platform === 'gemini-api') {
    endpoint = `/admin/gemini-api-accounts/${account.id}/toggle-schedulable`
  } else {
    showToast('该cuentatipo暂nosoportarProgramar控制', 'warning')
    account.isTogglingSchedulable = false
    return
  }

  const data = await httpApis.toggleAccountStatusApi(endpoint)
  if (data.success) {
    account.schedulable = data.schedulable
    showToast(data.schedulable ? 'yaHabilitarProgramar' : 'yadeshabilitadoProgramar', 'success')
  } else {
    showToast(data.message || 'Operacionesfallido', 'error')
  }
  account.isTogglingSchedulable = false
}

// manejocrearexitoso
const handleCreateSuccess = () => {
  showCreateAccountModal.value = false
  showToast('cuentacrearexitoso', 'success')
  // 清空caché，因para可能涉及Grupos关系变化
  clearCache()
  loadAccounts()
}

// manejoEditarexitoso
const handleEditSuccess = () => {
  showEditAccountModal.value = false
  showToast('cuentaactualizarexitoso', 'success')
  // 清空Gruposmiembrocaché，因paracuentatipoyGrupos可能发生变化
  groupMembersLoaded.value = false
  loadAccounts()
}

// obtener Claude 账号agregarmanera
const getClaudeAuthType = (account) => {
  // 基于 lastRefreshAt 判断：como果para空explicaciónes Setup Token（no能Actualizar），否entonceses OAuth
  if (!account.lastRefreshAt || account.lastRefreshAt === '') {
    return 'Setup' // 缩短pantalla文本
  }
  return 'OAuth'
}

// obtener Gemini 账号agregarmanera
const getGeminiAuthType = () => {
  // Gemini 统一pantalla OAuth
  return 'OAuth'
}

// obtener OpenAI 账号agregarmanera
const getOpenAIAuthType = () => {
  // OpenAI 统一pantalla OAuth
  return 'OAuth'
}

// obtener Droid 账号autenticaciónmanera
const getDroidAuthType = (account) => {
  if (!account || typeof account !== 'object') {
    return 'OAuth'
  }

  const apiKeyModeFlag =
    account.isApiKeyMode ?? account.is_api_key_mode ?? account.apiKeyMode ?? account.api_key_mode

  if (
    apiKeyModeFlag === true ||
    apiKeyModeFlag === 'true' ||
    apiKeyModeFlag === 1 ||
    apiKeyModeFlag === '1'
  ) {
    return 'API Key'
  }

  const methodCandidate =
    account.authenticationMethod ||
    account.authMethod ||
    account.authentication_mode ||
    account.authenticationMode ||
    account.authentication_method ||
    account.auth_type ||
    account.authType ||
    account.authentication_type ||
    account.authenticationType ||
    account.droidAuthType ||
    account.droidAuthenticationMethod ||
    account.method ||
    account.auth ||
    ''

  if (typeof methodCandidate === 'string') {
    const normalized = methodCandidate.trim().toLowerCase()
    const compacted = normalized.replace(/[\s_-]/g, '')

    if (compacted === 'apikey') {
      return 'API Key'
    }
  }

  return 'OAuth'
}

// 判断es否para API Key modo Droid 账号
const isDroidApiKeyMode = (account) => getDroidAuthType(account) === 'API Key'

// obtener Droid 账号 API Key cantidad
const getDroidApiKeyCount = (account) => {
  if (!account || typeof account !== 'object') {
    return 0
  }

  // 优先usar apiKeys arreglo来calcularNormalEstado API Keys
  if (Array.isArray(account.apiKeys)) {
    // 只calcularEstadonoes 'error'  API Keys
    return account.apiKeys.filter((apiKey) => apiKey.status !== 'error').length
  }

  // como果es字符串formato apiKeys，尝试análisis
  if (typeof account.apiKeys === 'string' && account.apiKeys.trim()) {
    try {
      const parsed = JSON.parse(account.apiKeys)
      if (Array.isArray(parsed)) {
        // 只calcularEstadonoes 'error'  API Keys
        return parsed.filter((apiKey) => apiKey.status !== 'error').length
      }
    } catch (error) {
      // 忽略análisisincorrecto，ContinuarusarOtrocampo
    }
  }

  const candidates = [
    account.apiKeyCount,
    account.api_key_count,
    account.apiKeysCount,
    account.api_keys_count
  ]

  for (const candidate of candidates) {
    const value = Number(candidate)
    if (Number.isFinite(value) && value >= 0) {
      return value
    }
  }

  return 0
}

// 根据cantidaddevolver徽标estilo
const getDroidApiKeyBadgeClasses = (account) => {
  const count = getDroidApiKeyCount(account)
  const baseClass =
    'ml-1 inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[10px] font-medium shadow-sm backdrop-blur-sm'

  if (count > 0) {
    return [
      baseClass,
      'border-cyan-200 bg-cyan-50/90 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-900/40 dark:text-cyan-200'
    ]
  }

  return [
    baseClass,
    'border-rose-200 bg-rose-50/90 text-rose-600 dark:border-rose-500/40 dark:bg-rose-900/40 dark:text-rose-200'
  ]
}

// obtener Claude 账号tipopantalla
const getClaudeAccountType = (account) => {
  // como果con订阅información
  if (account.subscriptionInfo) {
    try {
      // como果 subscriptionInfo es字符串，尝试análisis
      const info =
        typeof account.subscriptionInfo === 'string'
          ? JSON.parse(account.subscriptionInfo)
          : account.subscriptionInfo

      // 订阅informaciónyaanálisis

      // 根据 has_claude_max y has_claude_pro 判断
      if (info.hasClaudeMax === true) {
        return 'Claude Max'
      } else if (info.hasClaudePro === true) {
        return 'Claude Pro'
      } else {
        return 'Claude Free'
      }
    } catch (e) {
      // análisisfallido，devolverpredeterminadovalor
      return 'Claude'
    }
  }

  // 没con订阅información，保持原conpantalla
  return 'Claude'
}

// obtenerdetenerProgramar原因
const getSchedulableReason = (account) => {
  if (account.schedulable !== false) return null

  // Claude Console cuentaincorrectoEstado
  if (account.platform === 'claude-console') {
    if (account.status === 'unauthorized') {
      return 'API KeyinválidooExpirado（401incorrecto）'
    }
    // verificarcuota超限Estado
    if (account.status === 'quota_exceeded') {
      return 'saldono足'
    }
    if (account.overloadStatus === 'overloaded') {
      return 'servicio过载（529incorrecto）'
    }
    if (account.rateLimitStatus === 'limited') {
      return 'activarlimitación（429incorrecto）'
    }
    // verificarcuota超限Estado（quotaAutoStopped o quotaStoppedAt 任一存enes decir表示cuota超限）
    if (
      account.quotaAutoStopped === 'true' ||
      account.quotaAutoStopped === true ||
      account.quotaStoppedAt
    ) {
      return 'saldono足'
    }
    if (account.status === 'blocked' && account.errorMessage) {
      return account.errorMessage
    }
  }

  // Claude 官方cuentaincorrectoEstado
  if (account.platform === 'claude') {
    if (account.status === 'unauthorized') {
      return 'autenticaciónfallido（401incorrecto）'
    }
    if (account.status === 'temp_error' && account.errorMessage) {
      return account.errorMessage
    }
    if (account.status === 'error' && account.errorMessage) {
      return account.errorMessage
    }
    if (account.isRateLimited) {
      return 'activarlimitación（429incorrecto）'
    }
    // automáticodetenerProgramar原因
    if (account.stoppedReason) {
      return account.stoppedReason
    }
    // verificar5小cuandolimitaciónautomáticodetener标志（备usarsolución）
    if (account.fiveHourAutoStopped === 'true' || account.fiveHourAutoStopped === true) {
      return '5小cuandousar量接近limitación，yaautomáticodetenerProgramar'
    }
  }

  // OpenAI cuentaincorrectoEstado
  if (account.platform === 'openai') {
    if (account.status === 'unauthorized') {
      return 'autenticaciónfallido（401incorrecto）'
    }
    // verificarlimitaciónEstado - compatible嵌套 rateLimitStatus objeto
    if (
      (account.rateLimitStatus && account.rateLimitStatus.isRateLimited) ||
      account.isRateLimited
    ) {
      return 'activarlimitación（429incorrecto）'
    }
    if (account.status === 'error' && account.errorMessage) {
      return account.errorMessage
    }
  }

  // OpenAI-Responses cuentaincorrectoEstado
  if (account.platform === 'openai-responses') {
    if (account.status === 'unauthorized') {
      return 'autenticaciónfallido（401incorrecto）'
    }
    // verificarlimitaciónEstado - compatible嵌套 rateLimitStatus objeto
    if (
      (account.rateLimitStatus && account.rateLimitStatus.isRateLimited) ||
      account.isRateLimited
    ) {
      return 'activarlimitación（429incorrecto）'
    }
    if (account.status === 'error' && account.errorMessage) {
      return account.errorMessage
    }
    if (account.status === 'rateLimited') {
      return 'activarlimitación（429incorrecto）'
    }
  }

  // 通usar原因
  if (account.stoppedReason) {
    return account.stoppedReason
  }
  if (account.errorMessage) {
    return account.errorMessage
  }

  // predeterminadoparamanualdetener
  return 'manualdetenerProgramar'
}

// verificares否escuota超限Estado（usar于Estadopantalla判断）
const isQuotaExceeded = (account) => {
  return (
    account.quotaAutoStopped === 'true' ||
    account.quotaAutoStopped === true ||
    !!account.quotaStoppedAt
  )
}

// obtenercuentaEstado文本
const getAccountStatusText = (account) => {
  // verificares否被bloquear
  if (account.status === 'blocked') return 'Bloqueada'
  // verificares否sinautorización（401incorrecto）
  if (account.status === 'unauthorized') return 'Anormal'
  // verificares否limitación
  if (
    account.isRateLimited ||
    account.status === 'rate_limited' ||
    (account.rateLimitStatus && account.rateLimitStatus.isRateLimited) ||
    account.rateLimitStatus === 'limited'
  )
    return 'Limitando'
  // verificares否temporalincorrecto
  if (account.status === 'temp_error') return 'Anormalidad temporal'
  // verificares否incorrecto
  if (account.status === 'error' || !account.isActive) return 'incorrecto'
  // cuota超限cuandopantalla"Normal"（nopantalla"yaPausar"）
  if (account.schedulable === false && !isQuotaExceeded(account)) return 'yaPausar'
  // 否entoncesNormal（包括cuota超限Estado）
  return 'Normal'
}

// obtenercuentaEstadoestiloclase
const getAccountStatusClass = (account) => {
  if (account.status === 'blocked') {
    return 'bg-red-100 text-red-800'
  }
  if (account.status === 'unauthorized') {
    return 'bg-red-100 text-red-800'
  }
  if (
    account.isRateLimited ||
    account.status === 'rate_limited' ||
    (account.rateLimitStatus && account.rateLimitStatus.isRateLimited) ||
    account.rateLimitStatus === 'limited'
  ) {
    return 'bg-orange-100 text-orange-800'
  }
  if (account.status === 'temp_error') {
    return 'bg-orange-100 text-orange-800'
  }
  if (account.status === 'error' || !account.isActive) {
    return 'bg-red-100 text-red-800'
  }
  // cuota超限cuandopantalla绿色（Normal）
  if (account.schedulable === false && !isQuotaExceeded(account)) {
    return 'bg-gray-100 text-gray-800'
  }
  return 'bg-green-100 text-green-800'
}

// obtenercuentaEstado点estiloclase
const getAccountStatusDotClass = (account) => {
  if (account.status === 'blocked') {
    return 'bg-red-500'
  }
  if (account.status === 'unauthorized') {
    return 'bg-red-500'
  }
  if (
    account.isRateLimited ||
    account.status === 'rate_limited' ||
    (account.rateLimitStatus && account.rateLimitStatus.isRateLimited) ||
    account.rateLimitStatus === 'limited'
  ) {
    return 'bg-orange-500'
  }
  if (account.status === 'temp_error') {
    return 'bg-orange-500'
  }
  if (account.status === 'error' || !account.isActive) {
    return 'bg-red-500'
  }
  // cuota超限cuandopantalla绿色（Normal）
  if (account.schedulable === false && !isQuotaExceeded(account)) {
    return 'bg-gray-500'
  }
  return 'bg-green-500'
}

// obtenerVentana de sesiónporcentaje
// const getSessionWindowPercentage = (account) => {
//   if (!account.sessionWindow) return 100
//   const { remaining, total } = account.sessionWindow
//   if (!total || total === 0) return 100
//   return Math.round((remaining / total) * 100)
// }

// formato化相par

// obtenerVentana de sesiónBarra de progresoestiloclase
const getSessionProgressBarClass = (status, account = null) => {
  // 根据Estadodevolverno同colorclase，incluir防御性verificar
  if (!status) {
    // sinInformación de estadocuandopredeterminadopara蓝色
    return 'bg-gradient-to-r from-blue-500 to-indigo-600'
  }

  // verificar账号es否处于limitaciónEstado
  const isRateLimited =
    account &&
    (account.isRateLimited ||
      account.status === 'rate_limited' ||
      (account.rateLimitStatus && account.rateLimitStatus.isRateLimited) ||
      account.rateLimitStatus === 'limited')

  // como果账号处于limitaciónEstado，pantalla红色
  if (isRateLimited) {
    return 'bg-gradient-to-r from-red-500 to-red-600'
  }

  // 转换para小写进行比较，避免tamaño写problema
  const normalizedStatus = String(status).toLowerCase()

  if (normalizedStatus === 'rejected') {
    // 被拒绝 - 红色
    return 'bg-gradient-to-r from-red-500 to-red-600'
  } else if (normalizedStatus === 'allowed_warning') {
    // advertenciaEstado - 橙色/黄色
    return 'bg-gradient-to-r from-yellow-500 to-orange-500'
  } else {
    // NormalEstado（allowed oOtro） - 蓝色
    return 'bg-gradient-to-r from-blue-500 to-indigo-600'
  }
}

// ====== Claude OAuth Usage 相关función ======

// 判断 Claude cuentaes否para OAuth autorización
const isClaudeOAuth = (account) => {
  return account.authType === 'oauth'
}

// formato化 Claude usar率porcentaje
const formatClaudeUsagePercent = (window) => {
  if (!window || window.utilization === null || window.utilization === undefined) {
    return '-'
  }
  return `${window.utilization}%`
}

// obtener Claude usar率ancho
const getClaudeUsageWidth = (window) => {
  if (!window || window.utilization === null || window.utilization === undefined) {
    return '0%'
  }
  return `${window.utilization}%`
}

// obtener Claude usar率Barra de progresocolor
const getClaudeUsageBarClass = (window) => {
  const util = window?.utilization || 0
  if (util < 60) {
    return 'bg-gradient-to-r from-blue-500 to-indigo-600'
  }
  if (util < 90) {
    return 'bg-gradient-to-r from-yellow-500 to-orange-500'
  }
  return 'bg-gradient-to-r from-red-500 to-red-600'
}

// formato化 Claude Restante
const formatClaudeRemaining = (window) => {
  if (!window || !window.remainingSeconds) {
    return '-'
  }

  const seconds = window.remainingSeconds
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    if (hours > 0) {
      return `${days}天${hours}小cuando`
    }
    return `${days}天`
  }
  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}小cuando${minutes}分钟`
    }
    return `${hours}小cuando`
  }
  if (minutes > 0) {
    return `${minutes}分钟`
  }
  return `${Math.floor(seconds % 60)}秒`
}

// 归一化 OpenAI Ventana de sesiónusar率
const normalizeCodexUsagePercent = (usageItem) => {
  if (!usageItem) {
    return null
  }

  const basePercent =
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

  if (resetElapsed) {
    return 0
  }

  if (basePercent === null) {
    return null
  }

  return Math.max(0, Math.min(100, basePercent))
}

// OpenAI cuota límiteBarra de progresocolor
const getCodexUsageBarClass = (usageItem) => {
  const percent = normalizeCodexUsagePercent(usageItem)
  if (percent === null) {
    return 'bg-gradient-to-r from-gray-300 to-gray-400'
  }
  if (percent >= 90) {
    return 'bg-gradient-to-r from-red-500 to-red-600'
  }
  if (percent >= 75) {
    return 'bg-gradient-to-r from-yellow-500 to-orange-500'
  }
  return 'bg-gradient-to-r from-emerald-500 to-teal-500'
}

// porcentajepantalla
const formatCodexUsagePercent = (usageItem) => {
  const percent = normalizeCodexUsagePercent(usageItem)
  if (percent === null) {
    return '--'
  }
  return `${percent.toFixed(1)}%`
}

// Barra de progresoancho
const getCodexUsageWidth = (usageItem) => {
  const percent = normalizeCodexUsagePercent(usageItem)
  if (percent === null) {
    return '0%'
  }
  return `${percent}%`
}

// ventanaetiqueta
const getCodexWindowLabel = (type) => {
  if (type === 'secondary') {
    return '周限'
  }
  return '5h'
}

// formato化Restante
const formatCodexRemaining = (usageItem) => {
  if (!usageItem) {
    return '--'
  }

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

  if (days > 0) {
    if (hours > 0) {
      return `${days}天${hours}小cuando`
    }
    return `${days}天`
  }
  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}小cuando${minutes}分钟`
    }
    return `${hours}小cuando`
  }
  if (minutes > 0) {
    return `${minutes}分钟`
  }
  return `${secs}秒`
}

// formato化费usarpantalla
const formatCost = (cost) => {
  if (!cost || cost === 0) return '0.0000'
  if (cost < 0.0001) return cost.toExponential(2)
  if (cost < 0.01) return cost.toFixed(6)
  if (cost < 1) return cost.toFixed(4)
  return cost.toFixed(2)
}

// límiteusarporcentaje（Claude Console）
const getQuotaUsagePercent = (account) => {
  const used = Number(account?.usage?.daily?.cost || 0)
  const quota = Number(account?.dailyQuota || 0)
  if (!quota || quota <= 0) return 0
  return (used / quota) * 100
}

// límiteBarra de progresocolor（Claude Console）
const getQuotaBarClass = (percent) => {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 70) return 'bg-yellow-500'
  return 'bg-green-500'
}

// concurrenciausarporcentaje（Claude Console）
const getConsoleConcurrencyPercent = (account) => {
  const max = Number(account?.maxConcurrentTasks || 0)
  if (!max || max <= 0) return 0
  const active = Number(account?.activeTaskCount || 0)
  return Math.min(100, (active / max) * 100)
}

// concurrenciaBarra de progresocolor（Claude Console）
const getConcurrencyBarClass = (percent) => {
  if (percent >= 100) return 'bg-red-500'
  if (percent >= 80) return 'bg-yellow-500'
  return 'bg-green-500'
}

// concurrenciaetiquetacolor（Claude Console）
const getConcurrencyLabelClass = (account) => {
  const max = Number(account?.maxConcurrentTasks || 0)
  if (!max || max <= 0) return 'text-gray-500 dark:text-gray-400'
  const active = Number(account?.activeTaskCount || 0)
  if (active >= max) {
    return 'text-red-600 dark:text-red-400'
  }
  if (active >= max * 0.8) {
    return 'text-yellow-600 dark:text-yellow-400'
  }
  return 'text-gray-700 dark:text-gray-200'
}

// Restantelímite（Claude Console）
const formatRemainingQuota = (account) => {
  const used = Number(account?.usage?.daily?.cost || 0)
  const quota = Number(account?.dailyQuota || 0)
  if (!quota || quota <= 0) return '0.00'
  return Math.max(0, quota - used).toFixed(2)
}

// calcular每日费usar（usarbackenddevolver精确费usardatos）
const calculateDailyCost = (account) => {
  if (!account.usage || !account.usage.daily) return '0.0000'

  // como果backendya经devolvercalcular好费usar，直接usar
  if (account.usage.daily.cost !== undefined) {
    return formatCost(account.usage.daily.cost)
  }

  // como果backend没condevolver费usar（旧versión），devolver0
  return '0.0000'
}

// 切换ProgramarEstado
// const toggleDispatch = async (account) => {
//   await toggleSchedulable(account)
// }

watch(searchKeyword, () => {
  currentPage.value = 1
  updateSelectAllState()
})

watch(pageSize, (newSize) => {
  localStorage.setItem(PAGE_SIZE_STORAGE_KEY, newSize.toString())
  updateSelectAllState()
})

watch(
  () => sortedAccounts.value.length,
  () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value || 1
    }
    updateSelectAllState()
  }
)

// escucharordenarSeleccionar变化 - ya重构para handleDropdownSort，此处notas保留原lógica参考
// watch(accountSortBy, (newVal) => {
//   const fieldMap = {
//     name: 'name',
//     dailyTokens: 'dailyTokens',
//     dailyRequests: 'dailyRequests',
//     totalTokens: 'totalTokens',
//     lastUsed: 'lastUsed'
//   }
//
//   if (fieldMap[newVal]) {
//     sortAccounts(fieldMap[newVal])
//   }
// })

watch(currentPage, () => {
  updateSelectAllState()
})

watch(paginatedAccounts, () => {
  updateSelectAllState()
  // datos变化después devolver adetectares否necesita要横向desplazamiento
  nextTick(() => {
    checkHorizontalScroll()
  })
})

watch(accounts, () => {
  cleanupSelectedAccounts()
})
// Tiempo de expiración相关método
const formatExpireDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const isExpired = (expiresAt) => {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

const isExpiringSoon = (expiresAt) => {
  if (!expiresAt) return false
  const now = new Date()
  const expireDate = new Date(expiresAt)
  const daysUntilExpire = (expireDate - now) / (1000 * 60 * 60 * 24)
  return daysUntilExpire > 0 && daysUntilExpire <= 7
}

// iniciarEditar cuentaexpirar
const startEditAccountExpiry = (account) => {
  editingExpiryAccount.value = account
}

// cerrarcuentaexpirarEditar
const closeAccountExpiryEdit = () => {
  editingExpiryAccount.value = null
}

// guardarcuentaexpirar
const handleSaveAccountExpiry = async ({ accountId, expiresAt }) => {
  try {
    // 根据账号plataformaSeleccionarcorrecto API 端点
    const account = accounts.value.find((acc) => acc.id === accountId)

    if (!account) {
      showToast('sin找acuenta', 'error')
      return
    }

    // definicióncadaplataforma端点yparámetro名
    // Nota：parteplataformausar :accountId，parteusar :id
    let endpoint = ''
    switch (account.platform) {
      case 'claude':
      case 'claude-oauth':
        endpoint = `/admin/claude-accounts/${accountId}`
        break
      case 'gemini':
        endpoint = `/admin/gemini-accounts/${accountId}`
        break
      case 'claude-console':
        endpoint = `/admin/claude-console-accounts/${accountId}`
        break
      case 'bedrock':
        endpoint = `/admin/bedrock-accounts/${accountId}`
        break
      case 'ccr':
        endpoint = `/admin/ccr-accounts/${accountId}`
        break
      case 'openai':
        endpoint = `/admin/openai-accounts/${accountId}` // usar :id
        break
      case 'droid':
        endpoint = `/admin/droid-accounts/${accountId}` // usar :id
        break
      case 'azure_openai':
        endpoint = `/admin/azure-openai-accounts/${accountId}` // usar :id
        break
      case 'openai-responses':
        endpoint = `/admin/openai-responses-accounts/${accountId}` // usar :id
        break
      default:
        showToast(`nosoportarTipo de plataforma: ${account.platform}`, 'error')
        return
    }

    const data = await httpApis.updateAccountByEndpointApi(endpoint, {
      expiresAt: expiresAt || null
    })
    if (data.success) {
      showToast('cuentaTiempo de expiraciónyaactualizar', 'success')
      account.expiresAt = expiresAt || null
      closeAccountExpiryEdit()
    } else {
      showToast(data.message || 'actualizarfallido', 'error')
      if (expiryEditModalRef.value) expiryEditModalRef.value.resetSaving()
    }
  } catch (error) {
    showToast(error.message || 'actualizarfallido', 'error')
    if (expiryEditModalRef.value) expiryEditModalRef.value.resetSaving()
  }
}

// detectartablaes否necesita要横向desplazamiento
const checkHorizontalScroll = () => {
  if (tableContainerRef.value) {
    needsHorizontalScroll.value =
      tableContainerRef.value.scrollWidth > tableContainerRef.value.clientWidth
  }
}

// ventanatamaño变化cuandovolver adetectar
let resizeObserver = null

onMounted(() => {
  // 首vecescargarcuando强制Actualizartodosdatos
  loadAccounts(true)

  // configurarResizeObserverescuchartablacontenedortamaño变化
  nextTick(() => {
    if (tableContainerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        checkHorizontalScroll()
      })
      resizeObserver.observe(tableContainerRef.value)
      checkHorizontalScroll()
    }
  })

  // escucharventanatamaño变化
  window.addEventListener('resize', checkHorizontalScroll)
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  window.removeEventListener('resize', checkHorizontalScroll)
})
</script>

<style scoped>
.accounts-container {
  min-height: calc(100vh - 300px);
}

/* cargar动画 */
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

/* tablafueracapaenvoltorio - redondeadoyborde */
.table-wrapper {
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.dark .table-wrapper {
  border-color: rgba(255, 255, 255, 0.1);
}

/* tabladentrocapacontenedor - 横向desplazamiento */
.table-container {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 0;
  padding: 0;
  max-width: 100%;
  position: relative;
  -webkit-overflow-scrolling: touch;
}

/* 防止tablacontenido溢出，保证横向desplazamiento */
.table-container table {
  min-width: 1400px;
  border-collapse: collapse;
  table-layout: auto;
}

/* desplazamientoregistrosestilo */
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

/* 统一 hover fondo - todos td usartema色 */
.table-container tbody tr:hover > td {
  background-color: rgba(var(--primary-rgb), 0.06) !important;
}

.dark .table-container tbody tr:hover > td {
  background-color: rgba(var(--primary-rgb), 0.16) !important;
}

/* todos td 斑马纹fondo */
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

/* 表头izquierda侧fijo列fondo - usar纯色避免desplazamientocuando重叠 */
.table-container thead .checkbox-column,
.table-container thead .name-column {
  z-index: 30;
  background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
}

.dark .table-container thead .checkbox-column,
.dark .table-container thead .name-column {
  background: linear-gradient(to bottom, var(--bg-gradient-mid), var(--bg-gradient-start));
}

/* 表头derecha侧Operaciones列fondo - usar纯色避免desplazamientocuando重叠 */
.table-container thead .operations-column {
  z-index: 30;
  background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
}

.dark .table-container thead .operations-column {
  background: linear-gradient(to bottom, var(--bg-gradient-mid), var(--bg-gradient-start));
}

/* Nombre列derecha侧sombra（分隔效果） */
.table-container tbody .name-column {
  box-shadow: 8px 0 12px -8px rgba(15, 23, 42, 0.16);
}

.dark .table-container tbody .name-column {
  box-shadow: 8px 0 12px -8px rgba(30, 41, 59, 0.45);
}

/* Operaciones列izquierda侧sombra */
.table-container tbody .operations-column {
  box-shadow: -8px 0 12px -8px rgba(15, 23, 42, 0.16);
}

.dark .table-container tbody .operations-column {
  box-shadow: -8px 0 12px -8px rgba(30, 41, 59, 0.45);
}
</style>
