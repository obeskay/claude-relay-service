<template>
  <div class="tutorial-section">
    <!-- Paso 1: Instalar Node.js -->
    <NodeInstallTutorial :platform="platform" :step-number="1" tool-name="Codex" />

    <!-- Paso 2: Configurar Codex -->
    <div class="mb-4 sm:mb-10 sm:mb-6">
      <h4
        class="mb-3 flex items-center text-lg font-semibold text-gray-800 dark:text-gray-300 sm:mb-4 sm:text-xl"
      >
        <span
          class="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white sm:mr-3 sm:h-8 sm:w-8 sm:text-sm"
          >2</span
        >
        Configurar Codex
      </h4>
      <p class="mb-3 text-sm text-gray-700 dark:text-gray-300 sm:mb-4 sm:text-base">
        Configure Codex para conectarse al servicio de retransmisión:
      </p>

      <div class="space-y-4">
        <!-- Configuración de config.toml -->
        <div
          class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-500/40 dark:bg-yellow-950/30 sm:p-4"
        >
          <h6 class="mb-2 font-medium text-yellow-800 dark:text-yellow-300">
            1. Archivo de configuración config.toml
          </h6>
          <p class="mb-3 text-sm text-yellow-700 dark:text-yellow-300">
            Agregue la siguiente configuración al principio del archivo
            <code class="rounded bg-yellow-100 px-1 dark:bg-yellow-900">{{ configPath }}</code>:
          </p>
          <div
            class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
          >
            <div
              v-for="line in configTomlLines"
              :key="line"
              class="whitespace-nowrap text-gray-300"
              :class="{ 'mt-2': line === '' }"
            >
              {{ line || '&nbsp;' }}
            </div>
          </div>
          <p class="mt-3 text-sm text-yellow-600 dark:text-yellow-400">Comando para escribir en un paso:</p>
          <div
            class="mt-2 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
          >
            <div class="whitespace-nowrap text-gray-300">{{ configTomlWriteCmd }}</div>
          </div>
        </div>

        <!-- Configuración de auth.json -->
        <div
          class="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-500/40 dark:bg-orange-950/30 sm:p-4"
        >
          <h6 class="mb-2 font-medium text-orange-800 dark:text-orange-300">
            2. Archivo de autenticación auth.json
          </h6>
          <p class="mb-3 text-sm text-orange-700 dark:text-orange-300">
            Configure en el archivo
            <code class="rounded bg-orange-100 px-1 dark:bg-orange-900">{{ authPath }}</code>:
          </p>
          <div
            class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
          >
            <div class="whitespace-nowrap text-gray-300">{</div>
            <div class="whitespace-nowrap text-gray-300">&nbsp;&nbsp;"OPENAI_API_KEY": null</div>
            <div class="whitespace-nowrap text-gray-300">}</div>
          </div>
          <div
            class="mt-3 rounded border border-red-200 bg-red-50 p-2 dark:border-red-500/40 dark:bg-red-950/30"
          >
            <p class="text-sm font-semibold text-red-700 dark:text-red-300">
              ⚠️ Debe establecer OPENAI_API_KEY en null, de lo contrario Codex lo usará primero e ignorará las variables de entorno.
            </p>
          </div>
          <p class="mt-3 text-sm text-orange-600 dark:text-orange-400">Comando para escribir en un paso:</p>
          <div
            class="mt-2 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
          >
            <div class="whitespace-nowrap text-gray-300">{{ authJsonWriteCmd }}</div>
          </div>
        </div>

        <!-- Configuración de variables de entorno -->
        <div
          class="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-500/40 dark:bg-purple-950/30 sm:p-4"
        >
          <h6 class="mb-2 font-medium text-purple-800 dark:text-purple-300">
            3. Establecer variable de entorno CRS_OAI_KEY
          </h6>
          <p class="mb-3 text-sm text-purple-700 dark:text-purple-300">
            Establezca la variable de entorno CRS_OAI_KEY con su clave API (formato: cr_xxxxxxxxxx):
          </p>

          <!-- Windows -->
          <template v-if="platform === 'windows'">
            <p class="mb-1 text-sm text-purple-600 dark:text-purple-400">
              系统级环境变量（推荐）：
            </p>
            <div
              class="mb-3 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
            >
              <div class="whitespace-nowrap text-gray-300">
                [System.Environment]::SetEnvironmentVariable("CRS_OAI_KEY", "cr_xxxxxxxxxx",
                [System.EnvironmentVariableTarget]::Machine)
              </div>
            </div>
            <p class="mb-1 text-sm text-purple-600 line-through opacity-60 dark:text-purple-400">
              Usuario级环境变量
              <span class="text-xs text-red-500">（不推荐）</span>
            </p>
            <div
              class="mb-3 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 opacity-60 sm:p-3 sm:text-sm"
            >
              <div class="whitespace-nowrap text-gray-300 line-through">
                [System.Environment]::SetEnvironmentVariable("CRS_OAI_KEY", "cr_xxxxxxxxxx",
                [System.EnvironmentVariableTarget]::User)
              </div>
            </div>
            <p class="text-sm text-purple-600 dark:text-purple-400">
              💡 Configuraciónsiguiente需要重新打开终端窗口才能生效
            </p>
          </template>

          <!-- macOS / Linux -->
          <template v-else>
            <p class="mb-1 text-sm text-purple-600 dark:text-purple-400">
              检查当anterior shell：<code class="rounded bg-purple-100 px-1 dark:bg-purple-900"
                >echo $SHELL</code
              >
            </p>

            <!-- 检查旧配置 -->
            <details
              class="my-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-950/30"
            >
              <summary
                class="cursor-pointer p-2 text-sm font-medium text-blue-800 dark:text-blue-300"
              >
                检查是否已有旧配置
              </summary>
              <div class="px-3 pb-3">
                <p class="mb-2 text-sm text-blue-700 dark:text-blue-300">
                  如果之anterior配置过，建议先检查并清理旧配置：
                </p>
                <div
                  class="mb-2 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
                >
                  <div class="text-gray-500"># zsh</div>
                  <div class="whitespace-nowrap text-gray-300">grep 'CRS_OAI_KEY' ~/.zshrc</div>
                  <div class="mt-1 text-gray-500"># bash</div>
                  <div class="whitespace-nowrap text-gray-300">grep 'CRS_OAI_KEY' ~/.bashrc</div>
                </div>
                <p class="text-sm text-blue-600 dark:text-blue-400">
                  如果有Salida，Instrucciones已配置过，可以手动Editar文件修改oEliminar旧配置
                </p>
              </div>
            </details>

            <p class="mb-1 mt-2 text-sm text-purple-600 dark:text-purple-400">
              {{ platform === 'macos' ? 'zsh (macOS 默认)' : 'bash (Linux 默认)' }}：
            </p>
            <div
              class="mb-3 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
            >
              <div class="whitespace-nowrap text-gray-300">
                echo 'export CRS_OAI_KEY="cr_xxxxxxxxxx"' >>
                {{
                  platform === 'macos'
                    ? '~/.zshrc && source ~/.zshrc'
                    : '~/.bashrc && source ~/.bashrc'
                }}
              </div>
            </div>

            <p class="mb-1 text-sm text-purple-600 dark:text-purple-400">
              {{ platform === 'macos' ? 'bash' : 'zsh' }}：
            </p>
            <div
              class="mb-3 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
            >
              <div class="whitespace-nowrap text-gray-300">
                echo 'export CRS_OAI_KEY="cr_xxxxxxxxxx"' >>
                {{
                  platform === 'macos'
                    ? '~/.bashrc && source ~/.bashrc'
                    : '~/.zshrc && source ~/.zshrc'
                }}
              </div>
            </div>

            <p class="text-sm text-purple-600 dark:text-purple-400">
              💡 Configuraciónsiguiente需要重新打开终端窗口o执行 source 命令才能生效
            </p>
          </template>
        </div>

        <!-- 验证环境变量 -->
        <div
          class="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-500/40 dark:bg-green-950/30 sm:p-4"
        >
          <h6 class="mb-2 font-medium text-green-800 dark:text-green-300">4. 验证环境变量</h6>
          <p class="mb-2 text-sm text-green-700 dark:text-green-300">
            重新打开终端siguiente，验证环境变量是否ConfiguraciónExitoso：
          </p>
          <div
            class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
          >
            <div v-if="platform === 'windows'" class="whitespace-nowrap text-gray-300">
              Get-ChildItem Env:CRS_OAI_KEY
            </div>
            <div v-else class="whitespace-nowrap text-gray-300">
              echo "CRS_OAI_KEY: $CRS_OAI_KEY"
            </div>
          </div>
        </div>

        <!-- Eliminar环境变量 -->
        <details
          class="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        >
          <summary class="cursor-pointer p-3 text-sm font-medium text-gray-800 dark:text-gray-300">
            如何Eliminar环境变量
          </summary>
          <div class="px-3 pb-3">
            <template v-if="platform === 'windows'">
              <p class="mb-1 text-sm text-gray-600 dark:text-gray-400">EliminarUsuario级环境变量：</p>
              <div
                class="mb-2 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
              >
                <div class="whitespace-nowrap text-gray-300">
                  [System.Environment]::SetEnvironmentVariable("CRS_OAI_KEY", $null,
                  [System.EnvironmentVariableTarget]::User)
                </div>
              </div>
              <p class="mb-1 text-sm text-gray-600 dark:text-gray-400">Eliminar系统级环境变量：</p>
              <div
                class="mb-2 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
              >
                <div class="whitespace-nowrap text-gray-300">
                  [System.Environment]::SetEnvironmentVariable("CRS_OAI_KEY", $null,
                  [System.EnvironmentVariableTarget]::Machine)
                </div>
              </div>
            </template>
            <template v-else>
              <p class="mb-1 text-sm text-gray-600 dark:text-gray-400">de zsh 配置enEliminar：</p>
              <div
                class="mb-2 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
              >
                <div class="text-gray-500"># Eliminar包含 CRS_OAI_KEY 行</div>
                <div class="whitespace-nowrap text-gray-300">
                  sed -i '' '/CRS_OAI_KEY/d' ~/.zshrc && source ~/.zshrc
                </div>
              </div>
              <p class="mb-1 text-sm text-gray-600 dark:text-gray-400">de bash 配置enEliminar：</p>
              <div
                class="mb-2 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
              >
                <div class="text-gray-500"># Eliminar包含 CRS_OAI_KEY 行</div>
                <div class="whitespace-nowrap text-gray-300">
                  sed -i '' '/CRS_OAI_KEY/d' ~/.bashrc && source ~/.bashrc
                </div>
              </div>
            </template>
            <p class="mb-1 text-sm text-gray-600 dark:text-gray-400">验证是否Eliminado exitosamente：</p>
            <div
              class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
            >
              <div v-if="platform === 'windows'" class="whitespace-nowrap text-gray-300">
                Get-ChildItem Env:CRS_OAI_KEY
              </div>
              <div v-else class="whitespace-nowrap text-gray-300">
                echo "CRS_OAI_KEY: $CRS_OAI_KEY"
              </div>
            </div>
          </div>
        </details>

        <!-- Sugerencia -->
        <div
          class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-500/40 dark:bg-yellow-950/30 sm:p-4"
        >
          <p class="text-sm text-yellow-700 dark:text-yellow-300">
            💡 请将示例en
            <code class="rounded bg-yellow-100 px-1 dark:bg-yellow-900">cr_xxxxxxxxxx</code>
            替换para您实际 API Clave
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTutorialUrls } from '@/utils/useTutorialUrls'
import NodeInstallTutorial from './NodeInstallTutorial.vue'

const props = defineProps({
  platform: {
    type: String,
    required: true,
    validator: (value) => ['windows', 'macos', 'linux'].includes(value)
  }
})

const { openaiBaseUrl } = useTutorialUrls()

const configPath = computed(() =>
  props.platform === 'windows' ? '%USERPROFILE%\\.codex\\config.toml' : '~/.codex/config.toml'
)

const authPath = computed(() =>
  props.platform === 'windows' ? '%USERPROFILE%\\.codex\\auth.json' : '~/.codex/auth.json'
)

const configTomlLines = computed(() => [
  'model_provider = "crs"',
  'model = "gpt-5-codex"',
  'model_reasoning_effort = "high"',
  'disable_response_storage = true',
  'preferred_auth_method = "apikey"',
  '',
  '[model_providers.crs]',
  'name = "crs"',
  `base_url = "${openaiBaseUrl.value}"`,
  'wire_api = "responses"',
  'requires_openai_auth = true',
  'env_key = "CRS_OAI_KEY"'
])

const configTomlContent = computed(() => configTomlLines.value.join('\n'))

const configTomlWriteCmd = computed(() => {
  if (props.platform === 'windows') {
    const escaped = configTomlContent.value.replace(/"/g, '`"').replace(/\n/g, '`n')
    return `New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex" | Out-Null; "${escaped}" | Set-Content -Path "$env:USERPROFILE\\.codex\\config.toml" -Force`
  }
  const escaped = configTomlContent.value.replace(/\n/g, '\\n')
  return `mkdir -p ~/.codex && printf '${escaped}\\n' > ~/.codex/config.toml`
})

const authJsonWriteCmd = computed(() => {
  if (props.platform === 'windows') {
    return `New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex" | Out-Null; '{"OPENAI_API_KEY": null}' | Set-Content -Path "$env:USERPROFILE\\.codex\\auth.json" -Force`
  }
  return `mkdir -p ~/.codex && echo '{"OPENAI_API_KEY": null}' > ~/.codex/auth.json`
})
</script>
