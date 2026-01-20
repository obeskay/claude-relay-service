<template>
  <div
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0"
    >
      <div
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        aria-hidden="true"
      ></div>
      <span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true"
        >&#8203;</span
      >

      <div
        class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle"
      >
        <!-- Header -->
        <div class="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-6 sm:px-6">
          <h3 class="text-xl font-bold leading-6 text-white" id="modal-title">
            <i class="fas fa-magic mr-2"></i> Smart Routing Wizard
          </h3>
          <p class="mt-1 text-sm text-purple-100">
            Easily configure model overrides without editing JSON
          </p>
        </div>

        <div class="px-4 py-6 sm:px-6">
          <!-- Step 1: Select Scope -->
          <div class="mb-6">
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >1. Where to apply?</label
            >
            <div class="flex space-x-4">
              <button
                @click="scope = 'global'"
                :class="
                  scope === 'global'
                    ? 'border-purple-500 bg-purple-100 text-purple-700 dark:border-purple-500 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400'
                "
                class="flex-1 rounded-lg border-2 px-4 py-3 font-medium transition-colors"
              >
                Global (All Keys)
              </button>
              <button
                @click="scope = 'key'"
                :class="
                  scope === 'key'
                    ? 'border-purple-500 bg-purple-100 text-purple-700 dark:border-purple-500 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400'
                "
                class="flex-1 rounded-lg border-2 px-4 py-3 font-medium transition-colors"
              >
                Specific API Key
              </button>
            </div>
          </div>

          <!-- Step 2: Source Model -->
          <div class="mb-6">
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >2. When client asks for...</label
            >
            <select
              v-model="sourceModel"
              class="w-full rounded-md border-gray-300 py-2 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="*">All Models (Wildcard *)</option>
              <option value="claude-3-5-sonnet-*">Claude 3.5 Sonnet (Any Version)</option>
              <option value="claude-3-opus-*">Claude 3 Opus (Any Version)</option>
              <option value="gpt-4-*">GPT-4 (Any Version)</option>
            </select>
          </div>

          <!-- Step 3: Target Model -->
          <div class="mb-6">
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >3. Redirect to...</label
            >
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div
                v-for="target in targets"
                :key="target.id"
                @click="targetModel = target.id"
                :class="
                  targetModel === target.id
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-600'
                "
                class="relative cursor-pointer rounded-lg border p-3 transition-colors hover:border-green-300"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium text-gray-900 dark:text-white">{{ target.name }}</span>
                  <span
                    v-if="target.bestDeal"
                    class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800"
                    >BEST DEAL</span
                  >
                </div>
                <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ target.provider }}
                </div>
                <div v-if="targetModel === target.id" class="absolute right-2 top-2 text-green-600">
                  <i class="fas fa-check-circle"></i>
                </div>
              </div>
            </div>
          </div>

          <!-- JSON Preview -->
          <div
            class="mb-6 rounded-md bg-gray-50 p-4 font-mono text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400"
          >
            {{ JSON.stringify({ [sourceModel]: targetModel }, null, 2) }}
          </div>
        </div>

        <div class="bg-gray-50 px-4 py-3 dark:bg-gray-700 sm:flex sm:flex-row-reverse sm:px-6">
          <button
            @click="saveConfiguration"
            :disabled="!targetModel"
            class="inline-flex w-full justify-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Apply Configuration
          </button>
          <button
            @click="$emit('close')"
            class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:ml-3 sm:mt-0 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { apiClient } from '@/services/api' // Assuming this exists

const scope = ref('global')
const sourceModel = ref('*')
const targetModel = ref('')

const targets = [
  { id: 'ccr/glm-4.7', name: 'GLM 4.7', provider: 'Zhipu AI / OpenRouter', bestDeal: true },
  { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', provider: 'Google Vertex AI' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic Official' },
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek' }
]

const emit = defineEmits(['close', 'success'])

const saveConfiguration = async () => {
  try {
    const mapping = { [sourceModel.value]: targetModel.value }

    // Implementation would depend on the API endpoint structure
    // For now we just emit the config back to parent or call API
    // await apiClient.put('/admin/config/routing', { scope: scope.value, mapping })

    emit('success', { scope: scope.value, mapping })
    emit('close')
  } catch (e) {
    console.error(e)
  }
}
</script>
