<template>
  <div class="min-h-screen p-3 sm:p-4 md:p-6">
    <!-- 顶部导航 -->
    <AppHeader />

    <!-- 主内容区域 -->
    <div
      class="glass-strong rounded-xl p-3 shadow-xl sm:rounded-2xl sm:p-4 md:rounded-3xl md:p-6"
      style="z-index: 1; min-height: calc(100vh - 120px)"
    >
      <!-- Etiqueta栏 -->
      <TabBar :active-tab="activeTab" @tab-change="handleTabChange" />

      <!-- 内容区域 -->
      <div class="tab-content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppHeader from './AppHeader.vue'
import TabBar from './TabBar.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 根据路由Configuración当anterior激活Etiqueta
const activeTab = ref('dashboard')

// 根据 LDAP 配置动态生成路由映射
const tabRouteMap = computed(() => {
  const baseMap = {
    dashboard: '/dashboard',
    apiKeys: '/api-keys',
    accounts: '/accounts',
    quotaCards: '/quota-cards',
    settings: '/settings'
  }

  // 只有en LDAP Habilitar时才包含Gestión de usuarios路由
  if (authStore.oemSettings?.ldapEnabled) {
    baseMap.userManagement = '/user-management'
  }

  return baseMap
})

// 初始化当anterior激活Etiqueta
const initActiveTab = () => {
  const currentPath = route.path
  const tabKey = Object.keys(tabRouteMap.value).find(
    (key) => tabRouteMap.value[key] === currentPath
  )

  if (tabKey) {
    activeTab.value = tabKey
  } else {
    // 如果路径不匹配任何Etiqueta，尝试de路由Nombre获取
    const routeName = route.name
    const nameToTabMap = {
      Dashboard: 'dashboard',
      ApiKeys: 'apiKeys',
      Accounts: 'accounts',
      QuotaCards: 'quotaCards',
      Settings: 'settings'
    }
    if (routeName && nameToTabMap[routeName]) {
      activeTab.value = nameToTabMap[routeName]
    } else {
      // 默认选enPanel
      activeTab.value = 'dashboard'
    }
  }
}

// 初始化
initActiveTab()

// 监听路由变化，Actualizar激活Etiqueta
watch(
  () => route.path,
  (newPath) => {
    const tabKey = Object.keys(tabRouteMap.value).find((key) => tabRouteMap.value[key] === newPath)
    if (tabKey) {
      activeTab.value = tabKey
    } else {
      // 如果路径不匹配任何Etiqueta，尝试de路由Nombre获取
      const routeName = route.name
      const nameToTabMap = {
        Dashboard: 'dashboard',
        ApiKeys: 'apiKeys',
        Accounts: 'accounts',
        QuotaCards: 'quotaCards',
        Tutorial: 'tutorial',
        Settings: 'settings'
      }
      if (routeName && nameToTabMap[routeName]) {
        activeTab.value = nameToTabMap[routeName]
      }
    }
  }
)

// 处理Etiqueta切换
const handleTabChange = async (tabKey) => {
  // 如果已经en目标路由，不需要做任何事
  if (tabRouteMap.value[tabKey] === route.path) {
    return
  }

  // 先ActualizaractiveTabEstado
  activeTab.value = tabKey

  // 使用 await 确保路由切换完成
  try {
    await router.push(tabRouteMap.value[tabKey])
    // 等待siguienteDOMActualizar周期，确保组件正确渲染
    await nextTick()
  } catch (err) {
    // 如果路由切换Fallido，恢复activeTabEstado
    if (err.name !== 'NavigationDuplicated') {
      console.error('路由切换Fallido:', err)
      // 恢复到当anterior路由对应tab
      initActiveTab()
    }
  }
}

// OEMConfiguración已enApp.vueen加载，无需重复加载
</script>
