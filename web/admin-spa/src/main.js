import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import enLocale from 'element-plus/dist/locale/en.mjs'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { useUserStore } from './stores/user'
import './assets/styles/main.css'
import './assets/styles/global.css'

// 创建Vue应用
const app = createApp(App)

// 使用Pinia状态管理
const pinia = createPinia()
app.use(pinia)

// 使用路由
app.use(router)

// 使用i18n
app.use(i18n)

// 获取当前语言环境
const getElementLocale = () => {
  const currentLocale = i18n.global.locale.value
  const localeMap = {
    en: enLocale,
    'es-MX': enLocale, // 使用英文作为备份（Element Plus没有es-MX）
    zh: zhCn
  }
  return localeMap[currentLocale] || zhCn
}

// 使用Element Plus
app.use(ElementPlus, {
  locale: getElementLocale()
})

// 设置axios拦截器
const userStore = useUserStore()
userStore.setupAxiosInterceptors()

// 挂载应用
app.mount('#app')
