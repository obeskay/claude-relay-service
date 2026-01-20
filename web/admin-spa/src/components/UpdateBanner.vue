<template>
  <div
    v-if="loading"
    class="h-10 w-full animate-pulse rounded-md bg-gray-200 dark:bg-gray-700"
  ></div>

  <div
    v-else-if="status?.hasUpdate"
    class="mb-6 flex items-center justify-between rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white shadow-md"
  >
    <div class="flex items-center">
      <div class="mr-3 rounded-full bg-white/20 p-2">
        <i class="fas fa-rocket text-yellow-300"></i>
      </div>
      <div>
        <div class="text-sm font-bold">New Update Available! (v{{ status.latestVersion }})</div>
        <div class="text-xs opacity-90">Your version: v{{ status.currentVersion }}</div>
      </div>
    </div>

    <a
      :href="status.releaseUrl"
      target="_blank"
      class="flex items-center rounded-md bg-white px-4 py-2 text-sm font-bold text-blue-600 shadow-sm transition-colors hover:bg-blue-50"
    >
      <span>View Release</span>
      <i class="fas fa-external-link-alt ml-2"></i>
    </a>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiClient } from '@/services/api'

const loading = ref(true)
const status = ref(null)

onMounted(async () => {
  try {
    const res = await apiClient.get('/admin/system/update-status')
    if (res.success) {
      status.value = res.data
    }
  } catch (e) {
    console.error('Failed to check update status', e)
  } finally {
    loading.value = false
  }
})
</script>
