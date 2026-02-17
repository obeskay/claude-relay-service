<template>
  <div class="tutorial-content">
    <!-- 第一步：安装 Node.js -->
    <NodeInstallTutorial :platform="platform" :step-number="1" tool-name="Claude Code" />

    <!-- 第二步：安装 Claude Code -->
    <div class="mb-4 sm:mb-10 sm:mb-6">
      <h4
        class="mb-3 flex items-center text-lg font-semibold text-gray-800 dark:text-gray-300 sm:mb-4 sm:text-xl"
      >
        <span
          class="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white sm:mr-3 sm:h-8 sm:w-8 sm:text-sm"
          >2</span
        >
        安装 Claude Code
      </h4>

      <div
        class="mb-4 rounded-xl border border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 p-4 dark:border-green-500/40 dark:from-green-950/30 dark:to-emerald-950/30 sm:mb-6 sm:p-6"
      >
        <h5
          class="mb-2 flex items-center text-base font-semibold text-gray-800 dark:text-gray-200 sm:mb-3 sm:text-lg"
        >
          <i class="fas fa-download mr-2 text-green-600" />
          安装 Claude Code
        </h5>
        <p class="mb-3 text-sm text-gray-700 dark:text-gray-300 sm:mb-4 sm:text-base">
          {{ platform === 'windows' ? '打开 PowerShell o CMD' : '打开终端' }}，运行以abajo命令：
        </p>
        <div
          class="mb-4 overflow-x-auto rounded-lg bg-gray-900 p-3 font-mono text-xs text-green-400 sm:p-4 sm:text-sm"
        >
          <div class="mb-2"># Global安装 Claude Code</div>
          <div class="whitespace-nowrap text-gray-300">
            {{
              platform === 'windows'
                ? 'npm install -g @anthropic-ai/claude-code'
                : 'sudo npm install -g @anthropic-ai/claude-code'
            }}
          </div>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          这 命令会de npm 官方仓库Descargar并安装最新版本 Claude Code。
        </p>

        <div
          class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/40 dark:bg-blue-950/30 sm:p-4"
        >
          <h6 class="mb-2 text-sm font-medium text-blue-800 dark:text-blue-300 sm:text-base">
            Sugerencia
          </h6>
          <ul class="space-y-1 text-xs text-blue-700 dark:text-blue-300 sm:text-sm">
            <template v-if="platform === 'windows'">
              <li>• 建议使用 PowerShell 而不是 CMD，功能更强大</li>
              <li>• 如果遇到权限问题，以Administrador身份运行 PowerShell</li>
            </template>
            <template v-else-if="platform === 'macos'">
              <li>• 如果遇到权限问题，可以使用 sudo</li>
              <li>• o者使用 nvm 安装 Node.js 避免权限问题</li>
            </template>
            <template v-else>
              <li>• 使用 nvm 安装 Node.js 可以避免 sudo</li>
              <li>• WSL2 Usuario确保en Linux 子系统en运行</li>
            </template>
          </ul>
        </div>
      </div>

      <!-- 验证安装 -->
      <div
        class="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-500/40 dark:bg-green-950/30 sm:p-4"
      >
        <h6 class="mb-2 font-medium text-green-800 dark:text-green-300">验证 Claude Code 安装</h6>
        <p class="mb-3 text-sm text-green-700 dark:text-green-300">
          安装完成siguiente，Entrada以abajo命令检查是否安装Exitoso：
        </p>
        <div
          class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
        >
          <div class="whitespace-nowrap text-gray-300">claude --version</div>
        </div>
        <p class="mt-2 text-sm text-green-700 dark:text-green-300">
          如果显示版本号，恭喜你！Claude Code 已经Exitoso安装。
        </p>
      </div>
    </div>

    <!-- 第三步：Configuración环境变量 -->
    <div class="mb-6 sm:mb-10">
      <h4
        class="mb-3 flex items-center text-lg font-semibold text-gray-800 dark:text-gray-300 sm:mb-4 sm:text-xl"
      >
        <span
          class="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-white sm:mr-3 sm:h-8 sm:w-8 sm:text-sm"
          >3</span
        >
        Configuración环境变量
      </h4>

      <div
        class="mb-4 rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 to-pink-50 p-4 dark:border-purple-500/40 dark:from-purple-950/30 dark:to-pink-950/30 sm:mb-6 sm:p-6"
      >
        <h5
          class="mb-2 flex items-center text-base font-semibold text-gray-800 dark:text-gray-200 sm:mb-3 sm:text-lg"
        >
          <i class="fas fa-cog mr-2 text-purple-600" />
          配置 Claude Code 环境变量
        </h5>
        <p class="mb-3 text-sm text-gray-700 dark:text-gray-300 sm:mb-4 sm:text-base">
          para让 Claude Code 连接到你en转服务，需要Configuración两 环境变量：
        </p>

        <div class="space-y-4">
          <!-- Windows 环境变量Configuración -->
          <template v-if="platform === 'windows'">
            <div
              class="rounded-lg border border-purple-200 bg-white p-3 dark:border-purple-700 dark:bg-gray-800 sm:p-4"
            >
              <h6 class="mb-2 text-sm font-medium text-gray-800 dark:text-gray-300 sm:text-base">
                方法一：PowerShell 临时Configuración（当anterior会话）
              </h6>
              <p class="mb-3 text-sm text-gray-600 dark:text-gray-400">
                en PowerShell en运行以abajo命令：
              </p>
              <div
                class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
              >
                <div class="whitespace-nowrap text-gray-300">
                  $env:ANTHROPIC_BASE_URL = "{{ currentBaseUrl }}"
                </div>
                <div class="whitespace-nowrap text-gray-300">
                  $env:ANTHROPIC_AUTH_TOKEN = "你APIClave"
                </div>
              </div>
              <p class="mt-2 text-xs text-yellow-700 dark:text-yellow-400">
                💡 记得将 "你APIClave" 替换paraenarriba方 "API Keys" Etiqueta页enCrear实际Clave。
              </p>
            </div>

            <div
              class="rounded-lg border border-purple-200 bg-white p-3 dark:border-purple-700 dark:bg-gray-800 sm:p-4"
            >
              <h6 class="mb-2 text-sm font-medium text-gray-800 dark:text-gray-300 sm:text-base">
                方法二：PowerShell 永久Configuración（Usuario级）
              </h6>
              <p class="mb-3 text-sm text-gray-600 dark:text-gray-400">
                en PowerShell en运行以abajo命令ConfiguraciónUsuario级环境变量：
              </p>
              <div
                class="mb-3 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
              >
                <div class="mb-2"># ConfiguraciónUsuario级环境变量（永久生效）</div>
                <div class="whitespace-nowrap text-gray-300">
                  [System.Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "{{
                    currentBaseUrl
                  }}", [System.EnvironmentVariableTarget]::User)
                </div>
                <div class="whitespace-nowrap text-gray-300">
                  [System.Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN",
                  "你APIClave", [System.EnvironmentVariableTarget]::User)
                </div>
              </div>
              <p class="mt-2 text-xs text-blue-700 dark:text-blue-300">
                💡 Configuraciónsiguiente需要重新打开 PowerShell 窗口才能生效。
              </p>
            </div>
          </template>

          <!-- macOS / Linux 环境变量Configuración -->
          <template v-else>
            <div
              class="rounded-lg border border-purple-200 bg-white p-3 dark:border-purple-700 dark:bg-gray-800 sm:p-4"
            >
              <h6 class="mb-2 text-sm font-medium text-gray-800 dark:text-gray-300 sm:text-base">
                方法一：临时Configuración（当anterior会话）
              </h6>
              <p class="mb-3 text-sm text-gray-600 dark:text-gray-400">en终端en运行以abajo命令：</p>
              <div
                class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
              >
                <div class="whitespace-nowrap text-gray-300">
                  export ANTHROPIC_BASE_URL="{{ currentBaseUrl }}"
                </div>
                <div class="whitespace-nowrap text-gray-300">
                  export ANTHROPIC_AUTH_TOKEN="你APIClave"
                </div>
              </div>
              <p class="mt-2 text-xs text-yellow-700 dark:text-yellow-400">
                💡 记得将 "你APIClave" 替换paraenarriba方 "API Keys" Etiqueta页enCrear实际Clave。
              </p>
            </div>

            <div
              class="rounded-lg border border-purple-200 bg-white p-3 dark:border-purple-700 dark:bg-gray-800 sm:p-4"
            >
              <h6 class="mb-2 text-sm font-medium text-gray-800 dark:text-gray-300 sm:text-base">
                方法二：永久Configuración（Shell 配置文件）
              </h6>
              <p class="mb-3 text-sm text-gray-600 dark:text-gray-400">
                将以abajo内容添加到你 shell 配置文件en（{{
                  platform === 'macos' ? '~/.zshrc' : '~/.bashrc'
                }}）：
              </p>
              <div
                class="mb-3 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
              >
                <div class="whitespace-nowrap text-gray-300">
                  export ANTHROPIC_BASE_URL="{{ currentBaseUrl }}"
                </div>
                <div class="whitespace-nowrap text-gray-300">
                  export ANTHROPIC_AUTH_TOKEN="你APIClave"
                </div>
              </div>
              <p class="mb-3 text-sm text-gray-600 dark:text-gray-400">然siguiente执行：</p>
              <div
                class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
              >
                <div class="whitespace-nowrap text-gray-300">
                  source {{ platform === 'macos' ? '~/.zshrc' : '~/.bashrc' }}
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- VSCode 插件配置 -->
      <div
        class="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-500/40 dark:bg-indigo-950/30 sm:p-4"
      >
        <h6 class="mb-2 font-medium text-indigo-800 dark:text-indigo-300">
          VSCode Claude 插件配置
        </h6>
        <p class="mb-3 text-sm text-indigo-700 dark:text-indigo-300">
          如果使用 VSCode  Claude 插件，需要en配置文件en进行Configuración：
        </p>
        <div class="mb-3 space-y-2">
          <p class="text-sm text-indigo-700 dark:text-indigo-300">
            <strong>配置文件位置：</strong>
            <code class="rounded bg-indigo-100 px-1 dark:bg-indigo-900">{{
              platform === 'windows'
                ? 'C:\\Users\\你Nombre de usuario\\.claude\\config.json'
                : '~/.claude/config.json'
            }}</code>
          </p>
          <p class="text-xs text-indigo-600 dark:text-indigo-400">
            💡 如果该文件不存en，请手动Crear。
          </p>
        </div>
        <div
          class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
        >
          <div class="whitespace-nowrap text-gray-300">{</div>
          <div class="whitespace-nowrap text-gray-300">"primaryApiKey": "crs"</div>
          <div class="whitespace-nowrap text-gray-300">}</div>
        </div>
      </div>

      <!-- 验证环境变量Configuración -->
      <div
        class="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/40 dark:bg-blue-950/30 sm:p-4"
      >
        <h6 class="mb-2 font-medium text-blue-800 dark:text-blue-300">验证环境变量Configuración</h6>
        <p class="mb-3 text-sm text-blue-700 dark:text-blue-300">
          Configuración完环境变量siguiente，可以通过以abajo命令验证是否ConfiguraciónExitoso：
        </p>

        <div class="space-y-4">
          <div>
            <h6 class="mb-2 text-sm font-medium text-gray-800 dark:text-gray-300 sm:text-base">
              {{ platform === 'windows' ? 'en PowerShell en验证：' : 'en终端en验证：' }}
            </h6>
            <div
              class="space-y-1 overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
            >
              <template v-if="platform === 'windows'">
                <div class="whitespace-nowrap text-gray-300">echo $env:ANTHROPIC_BASE_URL</div>
                <div class="whitespace-nowrap text-gray-300">echo $env:ANTHROPIC_AUTH_TOKEN</div>
              </template>
              <template v-else>
                <div class="whitespace-nowrap text-gray-300">echo $ANTHROPIC_BASE_URL</div>
                <div class="whitespace-nowrap text-gray-300">echo $ANTHROPIC_AUTH_TOKEN</div>
              </template>
            </div>
          </div>
        </div>

        <div class="mt-3 space-y-2">
          <p class="text-sm text-blue-700 dark:text-blue-300">
            <strong>预期Salida示例：</strong>
          </p>
          <div class="rounded bg-gray-100 p-2 font-mono text-sm dark:bg-gray-700">
            <div>{{ currentBaseUrl }}</div>
            <div>cr_xxxxxxxxxxxxxxxxxx</div>
          </div>
          <p class="text-xs text-blue-700 dark:text-blue-300">
            💡 如果Salidapara空o显示变量名本身，Instrucciones环境变量ConfiguraciónFallido，请重新Configuración。
          </p>
        </div>
      </div>
    </div>

    <!-- 第四步：开始使用 -->
    <div class="mb-6 sm:mb-8">
      <h4
        class="mb-3 flex items-center text-lg font-semibold text-gray-800 dark:text-gray-300 sm:mb-4 sm:text-xl"
      >
        <span
          class="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white sm:mr-3 sm:h-8 sm:w-8 sm:text-sm"
          >4</span
        >
        开始使用 Claude Code
      </h4>
      <div
        class="rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50 to-yellow-50 p-4 dark:border-orange-500/40 dark:from-orange-950/30 dark:to-yellow-950/30 sm:p-6"
      >
        <p class="mb-3 text-sm text-gray-700 dark:text-gray-300 sm:mb-4 sm:text-base">
          现en你可以开始使用 Claude Code ！
        </p>

        <div class="space-y-4">
          <div>
            <h6 class="mb-2 text-sm font-medium text-gray-800 dark:text-gray-300 sm:text-base">
              启动 Claude Code
            </h6>
            <div
              class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
            >
              <div class="whitespace-nowrap text-gray-300">claude</div>
            </div>
          </div>

          <div>
            <h6 class="mb-2 text-sm font-medium text-gray-800 dark:text-gray-300 sm:text-base">
              en特定项目en使用
            </h6>
            <div
              class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
            >
              <div class="mb-2"># 进入你项目目录</div>
              <div class="whitespace-nowrap text-gray-300">
                cd
                {{
                  platform === 'windows' ? 'C:\\path\\to\\your\\project' : '/path/to/your/project'
                }}
              </div>
              <div class="mb-2 mt-2"># 启动 Claude Code</div>
              <div class="whitespace-nowrap text-gray-300">claude</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 故障排除 -->
    <div class="mb-8">
      <h4
        class="mb-3 flex items-center text-lg font-semibold text-gray-800 dark:text-gray-300 sm:mb-4 sm:text-xl"
      >
        <i class="fas fa-wrench mr-2 text-red-600 sm:mr-3" />
        {{ platformName }} 常见问题解决
      </h4>
      <div class="space-y-4">
        <details
          class="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        >
          <summary
            class="cursor-pointer p-3 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 sm:p-4 sm:text-base"
          >
            安装时Sugerencia "permission denied" Error
          </summary>
          <div class="px-3 pb-3 text-gray-600 dark:text-gray-400 sm:px-4 sm:pb-4">
            <p class="mb-2">这通常是权限问题，尝试以abajo解决方法：</p>
            <ul class="list-inside list-disc space-y-1 text-sm">
              <template v-if="platform === 'windows'">
                <li>以Administrador身份运行 PowerShell</li>
                <li>
                  o者配置 npm 使用Usuario目录：<code
                    class="rounded bg-gray-200 px-1 text-xs dark:bg-gray-700 sm:text-sm"
                    >npm config set prefix %APPDATA%\npm</code
                  >
                </li>
              </template>
              <template v-else>
                <li>使用 sudo 运行安装命令</li>
                <li>o者使用 nvm 安装 Node.js 避免权限问题</li>
              </template>
            </ul>
          </div>
        </details>

        <details
          v-if="platform === 'windows'"
          class="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        >
          <summary
            class="cursor-pointer p-3 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 sm:p-4 sm:text-base"
          >
            PowerShell 执行策略Error
          </summary>
          <div class="px-3 pb-3 text-gray-600 dark:text-gray-400 sm:px-4 sm:pb-4">
            <p class="mb-2">如果遇到执行策略Límite，运行：</p>
            <div
              class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
            >
              <div class="whitespace-nowrap text-gray-300">
                Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
              </div>
            </div>
          </div>
        </details>

        <details
          class="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        >
          <summary
            class="cursor-pointer p-3 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 sm:p-4 sm:text-base"
          >
            环境变量Configuraciónsiguiente不生效
          </summary>
          <div class="px-3 pb-3 text-gray-600 dark:text-gray-400 sm:px-4 sm:pb-4">
            <p class="mb-2">Configuración永久环境变量siguiente需要：</p>
            <ul class="list-inside list-disc space-y-1 text-sm">
              <template v-if="platform === 'windows'">
                <li>重新启动 PowerShell o CMD</li>
                <li>o者注销并重新Iniciar sesión Windows</li>
                <li>
                  验证Configuración：<code
                    class="rounded bg-gray-200 px-1 text-xs dark:bg-gray-700 sm:text-sm"
                    >echo $env:ANTHROPIC_BASE_URL</code
                  >
                </li>
              </template>
              <template v-else>
                <li>重新打开终端窗口</li>
                <li>
                  o者执行
                  <code class="rounded bg-gray-200 px-1 text-xs dark:bg-gray-700 sm:text-sm"
                    >source {{ platform === 'macos' ? '~/.zshrc' : '~/.bashrc' }}</code
                  >
                </li>
                <li>
                  验证Configuración：<code
                    class="rounded bg-gray-200 px-1 text-xs dark:bg-gray-700 sm:text-sm"
                    >echo $ANTHROPIC_BASE_URL</code
                  >
                </li>
              </template>
            </ul>
          </div>
        </details>

        <details
          v-if="platform === 'linux'"
          class="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        >
          <summary
            class="cursor-pointer p-3 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 sm:p-4 sm:text-base"
          >
            WSL2 en无法访问 Windows 文件
          </summary>
          <div class="px-3 pb-3 text-gray-600 dark:text-gray-400 sm:px-4 sm:pb-4">
            <p class="mb-2">WSL2 可以通过 /mnt/ 路径访问 Windows 文件：</p>
            <div
              class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
            >
              <div class="whitespace-nowrap text-gray-300">cd /mnt/c/Users/你Nombre de usuario/项目目录</div>
            </div>
          </div>
        </details>
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

const { currentBaseUrl } = useTutorialUrls()

const platformName = computed(() => {
  const names = { windows: 'Windows', macos: 'macOS', linux: 'Linux / WSL2' }
  return names[props.platform]
})
</script>
