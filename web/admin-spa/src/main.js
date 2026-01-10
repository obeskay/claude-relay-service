import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import es from 'element-plus/dist/locale/es.mjs'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { useUserStore } from './stores/user'
import './assets/styles/main.css'
import './assets/styles/global.css'

// Create Vue app
const app = createApp(App)

// Use Pinia state management
const pinia = createPinia()
app.use(pinia)

// Use i18n for translations
app.use(i18n)

// Use router
app.use(router)

// Use Element Plus with Spanish locale
app.use(ElementPlus, {
  locale: es
})

// Setup axios interceptors
const userStore = useUserStore()
userStore.setupAxiosInterceptors()

// Mount app
app.mount('#app')
