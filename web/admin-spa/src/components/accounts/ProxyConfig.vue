<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">代理Configuración (可选)</h4>
      <label class="flex cursor-pointer items-center">
        <input
          v-model="proxy.enabled"
          class="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500"
          type="checkbox"
        />
        <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Habilitar代理</span>
      </label>
    </div>

    <div
      v-if="proxy.enabled"
      class="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-800"
    >
      <div class="mb-3 flex items-start gap-3">
        <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-500">
          <i class="fas fa-server text-sm text-white" />
        </div>
        <div class="flex-1">
          <p class="text-sm text-gray-700 dark:text-gray-300">
            配置代理以访问受限网络资源。支持 SOCKS5 y HTTP 代理。
          </p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            请确保代理服务器稳定可用，否则会影响Cuenta正常使用。
          </p>
        </div>
      </div>

      <!-- 快速配置Entrada框 -->
      <div>
        <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          快速配置
          <span class="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
            (Pegar完整代理URL自动填充)
          </span>
        </label>
        <div class="relative">
          <input
            v-model="proxyUrl"
            class="form-input w-full border-gray-300 pr-10 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
            placeholder="例如: socks5://username:password@host:port o http://host:port"
            type="text"
            @input="handleInput"
            @keyup.enter="parseProxyUrl"
            @paste="handlePaste"
          />
          <button
            v-if="proxyUrl"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
            type="button"
            @click="clearProxyUrl"
          >
            <i class="fas fa-times" />
          </button>
        </div>
        <p v-if="parseError" class="mt-1 text-xs text-red-500">
          <i class="fas fa-exclamation-circle mr-1" />
          {{ parseError }}
        </p>
        <p v-else-if="parseSuccess" class="mt-1 text-xs text-green-500">
          <i class="fas fa-check-circle mr-1" />
          代理配置已自动填充
        </p>
      </div>

      <div class="my-3 border-t border-gray-200 dark:border-gray-600"></div>

      <div>
        <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >代理Tipo</label
        >
        <select
          v-model="proxy.type"
          class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="socks5">SOCKS5</option>
          <option value="http">HTTP</option>
          <option value="https">HTTPS</option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >主机地址</label
          >
          <input
            v-model="proxy.host"
            class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
            placeholder="例如: 192.168.1.100"
            type="text"
          />
        </div>
        <div>
          <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >端口</label
          >
          <input
            v-model="proxy.port"
            class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
            placeholder="例如: 1080"
            type="number"
          />
        </div>
      </div>

      <div class="space-y-4">
        <div class="flex items-center">
          <input
            id="proxyAuth"
            v-model="showAuth"
            class="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-blue-500"
            type="checkbox"
          />
          <label
            class="ml-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300"
            for="proxyAuth"
          >
            需要身份验证
          </label>
        </div>

        <div v-if="showAuth" class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >Nombre de usuario</label
            >
            <input
              v-model="proxy.username"
              class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              placeholder="代理Nombre de usuario"
              type="text"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >Contraseña</label
            >
            <div class="relative">
              <input
                v-model="proxy.password"
                class="form-input w-full border-gray-300 pr-10 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                placeholder="代理Contraseña"
                :type="showPassword ? 'text' : 'password'"
              />
              <button
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
                type="button"
                @click="showPassword = !showPassword"
              >
                <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/30"
      >
        <p class="text-xs text-blue-700 dark:text-blue-300">
          <i class="fas fa-info-circle mr-1" />
          <strong>Sugerencia：</strong
          >代理Configuración将para所有与此Cuenta相关APISolicitud。请确保代理服务器支持HTTPS流量转发。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      enabled: false,
      type: 'socks5',
      host: '',
      port: '',
      username: '',
      password: ''
    })
  }
})

const emit = defineEmits(['update:modelValue'])

// 内部代理数据
const proxy = ref({ ...props.modelValue })

// UIEstado
const showAuth = ref(!!(proxy.value.username || proxy.value.password))
const showPassword = ref(false)

// 快速配置相关
const proxyUrl = ref('')
const parseError = ref('')
const parseSuccess = ref(false)

// 监听modelValue变化，只en真正需要Actualizar时才Actualizar
watch(
  () => props.modelValue,
  (newVal) => {
    // 只有当值真正不同时才Actualizar，避免循环
    if (JSON.stringify(newVal) !== JSON.stringify(proxy.value)) {
      proxy.value = { ...newVal }
      showAuth.value = !!(newVal.username || newVal.password)
    }
  },
  { deep: true }
)

// 监听各 字段单独变化，而不是整 对象
watch(
  () => proxy.value.enabled,
  () => {
    emitUpdate()
  }
)

watch(
  () => proxy.value.type,
  () => {
    emitUpdate()
  }
)

watch(
  () => proxy.value.host,
  () => {
    emitUpdate()
  }
)

watch(
  () => proxy.value.port,
  () => {
    emitUpdate()
  }
)

watch(
  () => proxy.value.username,
  () => {
    emitUpdate()
  }
)

watch(
  () => proxy.value.password,
  () => {
    emitUpdate()
  }
)

// 监听认证开关
watch(showAuth, (newVal) => {
  if (!newVal) {
    proxy.value.username = ''
    proxy.value.password = ''
    emitUpdate()
  }
})

// 防抖Actualizar函数
let updateTimer = null
function emitUpdate() {
  // 清除之anterior定时器
  if (updateTimer) {
    clearTimeout(updateTimer)
  }

  // Configuración新定时器，延迟发送Actualizar
  updateTimer = setTimeout(() => {
    const data = { ...proxy.value }

    // 如果不需要认证，清空Nombre de usuarioContraseña
    if (!showAuth.value) {
      data.username = ''
      data.password = ''
    }

    emit('update:modelValue', data)
  }, 100) // 100ms 延迟
}

// 解析代理URL
function parseProxyUrl() {
  parseError.value = ''
  parseSuccess.value = false

  if (!proxyUrl.value) {
    return
  }

  try {
    // 移除 # siguiente面别名部分
    const urlWithoutAlias = proxyUrl.value.split('#')[0].trim()

    if (!urlWithoutAlias) {
      return
    }

    // 正则表达式匹配代理URL格式
    // 支持格式：protocol://[username:password@]host:port
    const proxyPattern = /^(socks5|https?):\/\/(?:([^:@]+):([^@]+)@)?([^:]+):(\d+)$/i
    const match = urlWithoutAlias.match(proxyPattern)

    if (!match) {
      // 尝试简单格式：host:port（默认parasocks5）
      const simplePattern = /^([^:]+):(\d+)$/
      const simpleMatch = urlWithoutAlias.match(simplePattern)

      if (simpleMatch) {
        proxy.value.type = 'socks5'
        proxy.value.host = simpleMatch[1]
        proxy.value.port = simpleMatch[2]
        proxy.value.username = ''
        proxy.value.password = ''
        showAuth.value = false
        parseSuccess.value = true
        emitUpdate()

        // 3秒siguiente清除ExitosoSugerencia
        setTimeout(() => {
          parseSuccess.value = false
        }, 3000)
        return
      }

      parseError.value = 'Inválido代理URL格式，请检查Entrada'
      return
    }

    // 解析匹配结果
    const [, protocol, username, password, host, port] = match

    // 填充表单
    proxy.value.type = protocol.toLowerCase()
    proxy.value.host = host
    proxy.value.port = port

    // 处理认证Información
    if (username && password) {
      proxy.value.username = decodeURIComponent(username)
      proxy.value.password = decodeURIComponent(password)
      showAuth.value = true
    } else {
      proxy.value.username = ''
      proxy.value.password = ''
      showAuth.value = false
    }

    parseSuccess.value = true
    emitUpdate()

    // 3秒siguiente清除ExitosoSugerencia
    setTimeout(() => {
      parseSuccess.value = false
    }, 3000)
  } catch (error) {
    // 解析代理URLFallido
    parseError.value = '解析Fallido，请检查URL格式'
  }
}

// 清空快速配置Entrada
function clearProxyUrl() {
  proxyUrl.value = ''
  parseError.value = ''
  parseSuccess.value = false
}

// 处理Pegar事件
function handlePaste() {
  // 延迟一abajo以确保v-model已经Actualizar
  setTimeout(() => {
    parseProxyUrl()
  }, 0)
}

// 处理Entrada事件
function handleInput() {
  // 检测是否Entrada代理URL格式
  const value = proxyUrl.value.trim()

  // 如果Entrada包含://，Instrucciones可能是完整代理URL
  if (value.includes('://')) {
    // 检查是否看起来像完整URL（有协议、主机y端口）
    if (
      /^(socks5|https?):\/\/[^:]+:\d+/i.test(value) ||
      /^(socks5|https?):\/\/[^:@]+:[^@]+@[^:]+:\d+/i.test(value)
    ) {
      parseProxyUrl()
    }
  }
  // 如果是简单 host:port 格式，并且端口号Entrada完整
  else if (/^[^:]+:\d{2,5}$/.test(value)) {
    parseProxyUrl()
  }
}

// 组件销毁时清理定时器
onUnmounted(() => {
  if (updateTimer) {
    clearTimeout(updateTimer)
  }
})
</script>
