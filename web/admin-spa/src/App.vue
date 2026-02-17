<template>
  <div id="app">
    <router-view />

    <!-- Global组件 -->
    <ToastNotification ref="toastRef" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import ToastNotification from '@/components/common/ToastNotification.vue'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const toastRef = ref()

onMounted(() => {
  // 初始化Tema
  themeStore.initTheme()

  // 监听系统Tema变化
  themeStore.watchSystemTheme()

  // 检查本地存储认证Estado
  authStore.checkAuth()

  // 加载OEMConfiguración（包括网站图标）
  authStore.loadOemSettings()
})
</script>

<style scoped>
#app {
  min-height: 100vh;
}
</style>
