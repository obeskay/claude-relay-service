<template>
  <div class="api-input-wide-card mb-8 rounded-3xl p-6 shadow-xl">
    <!-- Área del título -->
    <div class="wide-card-title mb-6">
      <h2 class="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-200">
        <i class="fas fa-chart-line mr-3" />
        Consulta de Estadísticas de Uso
      </h2>
      <p class="text-base text-gray-600 dark:text-gray-400">Consulte el uso y las estadísticas de su API Key</p>
    </div>

    <!-- Área de entrada -->
    <div class="mx-auto max-w-4xl">
      <!-- Barra de control -->
      <div class="control-bar mb-4 flex flex-wrap items-center justify-between gap-3">
        <!-- Etiqueta de API Key -->
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          <i class="fas fa-key mr-2" />
          {{ multiKeyMode ? 'Ingrese sus API Keys (una por línea o separadas por comas)' : 'Ingrese su API Key' }}
        </label>

        <!-- Grupo de botones de cambio de modo y consulta -->
        <div class="button-group flex items-center gap-2">
          <!-- Cambio de modo -->
          <div
            class="mode-switch-group flex items-center rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
          >
            <button
              class="mode-switch-btn"
              :class="{ active: !multiKeyMode }"
              title="Modo Individual"
              @click="multiKeyMode = false"
            >
              <i class="fas fa-key" />
              <span class="ml-2 hidden sm:inline">Individual</span>
            </button>
            <button
              class="mode-switch-btn"
              :class="{ active: multiKeyMode }"
              title="Modo Agregado"
              @click="multiKeyMode = true"
            >
              <i class="fas fa-layer-group" />
              <span class="ml-2 hidden sm:inline">Agregado</span>
              <span
                v-if="multiKeyMode && parsedApiKeys.length > 0"
                class="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-semibold"
              >
                {{ parsedApiKeys.length }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="api-input-grid grid grid-cols-1 gap-4 lg:grid-cols-4">
        <!-- Entrada de API Key -->
        <div class="lg:col-span-3">
          <!-- Campo de entrada en modo de clave única -->
          <div v-if="!multiKeyMode" class="relative">
            <input
              v-model="apiKey"
              class="wide-card-input w-full pr-10"
              :disabled="loading"
              placeholder="Ingrese su API Key (cr_...)"
              :type="showPassword ? 'text' : 'password'"
              @keyup.enter="queryStats"
            />
            <button
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              type="button"
              @click="showPassword = !showPassword"
            >
              <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'" />
            </button>
          </div>

          <!-- Campo de entrada en modo de múltiples claves -->
          <div v-else class="relative">
            <textarea
              v-model="apiKey"
              class="wide-card-input w-full resize-y"
              :disabled="loading"
              placeholder="Ingrese sus API Keys, formatos compatibles:&#10;cr_xxx&#10;cr_yyy&#10;o&#10;cr_xxx, cr_yyy"
              rows="4"
              @keyup.ctrl.enter="queryStats"
            />
            <button
              v-if="apiKey && !loading"
              class="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              title="Limpiar entrada"
              @click="clearInput"
            >
              <i class="fas fa-times-circle" />
            </button>
          </div>
        </div>

        <!-- Botón de consulta -->
        <div class="lg:col-span-1">
          <button
            class="btn btn-primary btn-query flex h-full w-full items-center justify-center gap-2"
            :disabled="loading || !hasValidInput"
            @click="queryStats"
          >
            <i v-if="loading" class="fas fa-spinner loading-spinner" />
            <i v-else class="fas fa-search" />
            {{ loading ? 'Consultando...' : 'Consultar Estadísticas' }}
          </button>
        </div>
      </div>

      <!-- Nota de seguridad -->
      <div class="security-notice mt-4">
        <i class="fas fa-shield-alt mr-2" />
        {{
          multiKeyMode
            ? 'Sus API Keys solo se usan para consultar datos estadísticos, no se almacenan. En modo agregado, cierta información individual no se mostrará.'
            : 'Su API Key solo se usa para consultar sus propias estadísticas, no se almacena ni se usa para otros fines'
        }}
      </div>

      <!-- Sugerencia adicional para modo de múltiples claves -->
      <div
        v-if="multiKeyMode"
        class="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
      >
        <i class="fas fa-lightbulb mr-2" />
        <span>Sugerencia: Se admite consultar hasta 30 API Keys simultáneamente. Use Ctrl+Enter para consultar rápidamente.</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useApiStatsStore } from '@/stores/apistats'

const apiStatsStore = useApiStatsStore()
const { apiKey, loading, multiKeyMode } = storeToRefs(apiStatsStore)
const { queryStats, clearInput } = apiStatsStore

const showPassword = ref(false)

// Analizar las API Keys ingresadas
const parsedApiKeys = computed(() => {
  if (!multiKeyMode.value || !apiKey.value) return []

  // Soportar separación por comas y saltos de línea
  const keys = apiKey.value
    .split(/[,\n]+/)
    .map((key) => key.trim())
    .filter((key) => key.length > 0)

  // Eliminar duplicados y limitar a un máximo de 30
  const uniqueKeys = [...new Set(keys)]
  return uniqueKeys.slice(0, 30)
})

// Determinar si hay entrada válida
const hasValidInput = computed(() => {
  if (multiKeyMode.value) {
    return parsedApiKeys.value.length > 0
  }
  return apiKey.value && apiKey.value.trim().length > 0
})
</script>

<style scoped>
/* Estilos de tarjeta ancha - usar variables CSS */
.api-input-wide-card {
  background: var(--surface-color);
  backdrop-filter: blur(25px);
  border: 1px solid var(--border-color);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Estilos de tarjeta ancha en modo oscuro */
:global(.dark) .api-input-wide-card {
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(75, 85, 99, 0.2),
    inset 0 1px 0 rgba(107, 114, 128, 0.15);
}

.api-input-wide-card:hover {
  box-shadow:
    0 32px 64px -12px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

:global(.dark) .api-input-wide-card:hover {
  box-shadow:
    0 32px 64px -12px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(75, 85, 99, 0.25),
    inset 0 1px 0 rgba(107, 114, 128, 0.3) !important;
}

/* Estilos de título */
.wide-card-title h2 {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  font-weight: 700;
}

:global(.dark) .wide-card-title h2 {
  color: #f9fafb;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.wide-card-title p {
  color: #6b7280;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
}

:global(.dark) .wide-card-title p {
  color: #9ca3af;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}

.wide-card-title .fas.fa-chart-line {
  color: #3b82f6;
  text-shadow: 0 1px 2px rgba(59, 130, 246, 0.2);
}

/* Diseño de cuadrícula */
.api-input-grid {
  align-items: end;
  gap: 1rem;
}

/* Estilos de campo de entrada - usar variables CSS */
.wide-card-input {
  background: var(--input-bg);
  border: 2px solid var(--input-border);
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 16px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  color: var(--text-primary);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

:global(.dark) .wide-card-input {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  color: #e5e7eb;
}

.wide-card-input::placeholder {
  color: #9ca3af;
}

:global(.dark) .wide-card-input::placeholder {
  color: #64748b;
}

.wide-card-input:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow:
    0 0 0 3px rgba(96, 165, 250, 0.2),
    0 10px 15px -3px rgba(0, 0, 0, 0.1);
  background: white;
  color: #1f2937;
}

:global(.dark) .wide-card-input:focus {
  border-color: var(--primary-color);
  box-shadow:
    0 0 0 3px rgba(var(--primary-rgb), 0.15),
    0 10px 15px -3px rgba(0, 0, 0, 0.4);
  background: var(--glass-strong-color);
  color: #f3f4f6;
}

/* Estilos de botón */
.btn {
  font-weight: 500;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  letter-spacing: 0.025em;
}

/* Estilos específicos del botón de consulta */
.btn-query {
  padding: 14px 24px;
  font-size: 16px;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: white;
  box-shadow:
    0 10px 15px -3px rgba(var(--primary-rgb), 0.3),
    0 4px 6px -2px rgba(var(--primary-rgb), 0.05);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    0 20px 25px -5px rgba(var(--primary-rgb), 0.3),
    0 10px 10px -5px rgba(var(--primary-rgb), 0.1);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Estilos de nota de seguridad */
.security-notice {
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 12px 16px;
  color: #374151;
  font-size: 0.875rem;
  transition: all 0.3s ease;
}

:global(.dark) .security-notice {
  background: var(--glass-strong-color) !important;
  border: 1px solid var(--border-color) !important;
  color: #d1d5db !important;
}

.security-notice:hover {
  background: rgba(255, 255, 255, 0.6);
  border-color: rgba(255, 255, 255, 0.5);
  color: #1f2937;
}

:global(.dark) .security-notice:hover {
  background: var(--glass-strong-color) !important;
  border-color: var(--border-color) !important;
  color: #e5e7eb !important;
}

.security-notice .fas.fa-shield-alt {
  color: #10b981;
  text-shadow: 0 1px 2px rgba(16, 185, 129, 0.2);
}

/* Barra de control */
.control-bar {
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(229, 231, 235, 0.3);
}

:global(.dark) .control-bar {
  border-bottom-color: rgba(75, 85, 99, 0.3);
}

/* Grupo de botones */
.button-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Grupo de cambio de modo */
.mode-switch-group {
  display: inline-flex;
  padding: 4px;
  background: #f3f4f6;
  border-radius: 0.5rem;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

:global(.dark) .mode-switch-group {
  background: var(--bg-gradient-start);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Botones de cambio de modo */
.mode-switch-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

:global(.dark) .mode-switch-btn {
  color: var(--text-secondary);
}

.mode-switch-btn:hover:not(.active) {
  color: #374151;
  background: rgba(0, 0, 0, 0.05);
}

:global(.dark) .mode-switch-btn:hover:not(.active) {
  color: #d1d5db;
  background: rgba(255, 255, 255, 0.05);
}

.mode-switch-btn.active {
  color: white;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  box-shadow: 0 2px 4px rgba(var(--primary-rgb), 0.2);
}

.mode-switch-btn.active:hover {
  box-shadow: 0 4px 6px rgba(var(--primary-rgb), 0.3);
}

.mode-switch-btn i {
  font-size: 0.875rem;
}

/* Animación de desvanecimiento */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* Animación de carga */
.loading-spinner {
  animation: spin 1s linear infinite;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.5));
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Optimizaciones responsivas */
@media (max-width: 768px) {
  .control-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .button-group {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .api-input-wide-card {
    padding: 1.25rem;
  }

  .wide-card-title {
    margin-bottom: 1.25rem;
  }

  .wide-card-title h2 {
    font-size: 1.5rem;
  }

  .wide-card-title p {
    font-size: 0.875rem;
  }

  .api-input-grid {
    gap: 1rem;
  }

  .wide-card-input {
    padding: 12px 14px;
    font-size: 15px;
  }

  .btn-query {
    padding: 12px 20px;
    font-size: 15px;
  }

  .security-notice {
    padding: 10px 14px;
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .mode-toggle-btn {
    padding: 5px 8px;
  }

  .toggle-icon {
    width: 18px;
    height: 18px;
  }

  .hint-text {
    font-size: 0.7rem;
    padding: 4px 8px;
  }
}

@media (max-width: 480px) {
  .api-input-wide-card {
    padding: 1rem;
  }

  .wide-card-title h2 {
    font-size: 1.25rem;
  }

  .wide-card-title p {
    font-size: 0.8rem;
  }

  .wide-card-input {
    padding: 10px 12px;
    font-size: 14px;
  }

  .btn-query {
    padding: 10px 16px;
    font-size: 14px;
  }
}
</style>
