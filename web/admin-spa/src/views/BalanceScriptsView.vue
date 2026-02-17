<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row">
      <div class="glass-strong flex-1 rounded-2xl p-4 shadow-lg">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">Configuración de Saldo de Script</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              Usa scripts personalizados + variables de plantilla para adaptar cualquier interfaz de saldo
            </div>
          </div>
          <div class="flex gap-2">
            <button
              class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              @click="loadConfig"
            >
              Recargar
            </button>
            <button
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              :disabled="saving"
              @click="saveConfig"
            >
              <span v-if="saving">Guardando...</span>
              <span v-else>Guardar configuración</span>
            </button>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">API Key</label>
            <input v-model="form.apiKey" class="input-text" placeholder="sk-xxxx" type="text" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">
              Dirección de solicitud (baseUrl)
            </label>
            <input
              v-model="form.baseUrl"
              class="input-text"
              placeholder="https://api.example.com"
              type="text"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-200"
              >Token (opcional)</label
            >
            <input v-model="form.token" class="input-text" placeholder="Bearer token" type="text" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-200"
                >Tiempo de espera (segundos)</label
              >
              <input
                v-model.number="form.timeoutSeconds"
                class="input-text"
                min="1"
                type="number"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-200">
                Intervalo de consulta automática (minutos)
              </label>
              <input
                v-model.number="form.autoIntervalMinutes"
                class="input-text"
                min="0"
                type="number"
              />
            </div>
          </div>
          <div class="md:col-span-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Variables de plantilla</label>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Variables disponibles: {{ '{' }}{{ '{' }}baseUrl{{ '}' }}{{ '}' }}、{{ '{' }}{{ '{' }}apiKey{{ '}'
              }}{{ '}' }}、{{ '{' }}{{ '{' }}token{{ '}' }}{{ '}' }}、{{ '{' }}{{ '{' }}accountId{{
                '}'
              }}{{ '}' }}、{{ '{' }}{{ '{' }}platform{{ '}' }}{{ '}' }}、{{ '{' }}{{ '{' }}extra{{
                '}'
              }}{{ '}' }}
            </p>
          </div>
        </div>
      </div>

      <div class="glass-strong w-full max-w-xl rounded-2xl p-4 shadow-lg">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">Probar Script</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              Ingresa el contexto de la cuenta (opcional), depura la salida del extractor
            </div>
          </div>
          <button
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            :disabled="testing"
            @click="testScript"
          >
            <span v-if="testing">Probando...</span>
            <span v-else>Probar script</span>
          </button>
        </div>
        <div class="grid gap-3">
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Plataforma</label>
            <input v-model="testForm.platform" class="input-text" placeholder="Por ejemplo: claude" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">ID de Cuenta</label>
            <input v-model="testForm.accountId" class="input-text" placeholder="Identificador de cuenta, opcional" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-200"
              >Parámetros adicionales (extra)</label
            >
            <input v-model="testForm.extra" class="input-text" placeholder="Opcional" />
          </div>
        </div>

        <div v-if="testResult" class="mt-4 space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
          <div class="flex items-center justify-between text-sm">
            <span class="font-semibold text-gray-800 dark:text-gray-100">Resultado de prueba</span>
            <span
              :class="[
                'rounded px-2 py-0.5 text-xs',
                testResult.mapped?.status === 'success'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
              ]"
            >
              {{ testResult.mapped?.status || 'unknown' }}
            </span>
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-300">
            <div>Saldo: {{ displayAmount(testResult.mapped?.balance) }}</div>
            <div>Unidad: {{ testResult.mapped?.currency || '—' }}</div>
            <div v-if="testResult.mapped?.planName">Plan: {{ testResult.mapped.planName }}</div>
            <div v-if="testResult.mapped?.errorMessage" class="text-red-500">
              Error: {{ testResult.mapped.errorMessage }}
            </div>
            <div v-if="testResult.mapped?.quota">
              Cuota: {{ JSON.stringify(testResult.mapped.quota) }}
            </div>
          </div>
          <details class="text-xs text-gray-500 dark:text-gray-400">
            <summary class="cursor-pointer">Ver salida del extractor</summary>
            <pre class="mt-2 overflow-auto rounded bg-black/70 p-2 text-[11px] text-gray-100"
              >{{ formatJson(testResult.extracted) }}
</pre
            >
          </details>
          <details class="text-xs text-gray-500 dark:text-gray-400">
            <summary class="cursor-pointer">Ver respuesta original</summary>
            <pre class="mt-2 overflow-auto rounded bg-black/70 p-2 text-[11px] text-gray-100"
              >{{ formatJson(testResult.response) }}
</pre
            >
          </details>
        </div>
      </div>
    </div>

    <div class="glass-strong rounded-2xl p-4 shadow-lg">
      <div class="mb-2 flex items-center justify-between">
        <div>
          <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">Código del Extractor</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            El objeto devuelto debe incluir request、extractor; soporta reemplazo de variables de plantilla
          </div>
        </div>
        <button
          class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          @click="applyPreset"
        >
          Usar plantilla de ejemplo
        </button>
      </div>
      <textarea
        v-model="form.scriptBody"
        class="min-h-[320px] w-full rounded-xl bg-gray-900 font-mono text-sm text-gray-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500"
        spellcheck="false"
      ></textarea>
      <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        extractor
        Campos devueltos (opcional): isValid、invalidMessage、remaining、unit、planName、total、used、extra
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'

import {
  getDefaultBalanceScriptApi,
  updateDefaultBalanceScriptApi,
  testDefaultBalanceScriptApi
} from '@/utils/http_apis'
import { showToast } from '@/utils/tools'

const form = reactive({
  baseUrl: '',
  apiKey: '',
  token: '',
  timeoutSeconds: 10,
  autoIntervalMinutes: 0,
  scriptBody: ''
})

const testForm = reactive({
  platform: '',
  accountId: '',
  extra: ''
})

const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)

const presetScript = `({
  request: {
    url: "{{baseUrl}}/user/balance",
    method: "GET",
    headers: {
      "Authorization": "Bearer {{apiKey}}",
      "User-Agent": "cc-switch/1.0"
    }
  },
  extractor: function(response) {
    return {
      isValid: response.is_active || true,
      remaining: response.balance,
      unit: "USD",
      planName: response.plan || "Plan predeterminado"
    };
  }
})`

const loadConfig = async () => {
  const res = await getDefaultBalanceScriptApi()
  if (res?.success && res.data) {
    Object.assign(form, res.data)
  }
}

const saveConfig = async () => {
  saving.value = true
  const res = await updateDefaultBalanceScriptApi({ ...form })
  if (res?.success) {
    showToast('Configuración guardada', 'success')
  } else {
    showToast(res?.message || 'Error al guardar', 'error')
  }
  saving.value = false
}

const testScript = async () => {
  testing.value = true
  testResult.value = null
  const payload = { ...form, ...testForm, scriptBody: form.scriptBody }
  const res = await testDefaultBalanceScriptApi(payload)
  if (res?.success) {
    testResult.value = res.data
    showToast('Prueba completada', 'success')
  } else {
    showToast(res?.error || 'Error en la prueba', 'error')
  }
  testing.value = false
}

const applyPreset = () => {
  form.scriptBody = presetScript
}

const displayAmount = (val) => {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '—'
  return Number(val).toFixed(2)
}

const formatJson = (data) => {
  try {
    return JSON.stringify(data, null, 2)
  } catch (error) {
    return String(data)
  }
}

onMounted(() => {
  applyPreset()
  loadConfig()
})
</script>

<style scoped>
.input-text {
  @apply w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-600;
}
</style>
