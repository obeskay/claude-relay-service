<template>
  <div class="card p-3 sm:p-6">
    <div class="mb-4 sm:mb-8">
      <h3
        class="mb-3 flex items-center text-xl font-bold text-gray-900 dark:text-gray-100 sm:mb-4 sm:text-2xl"
      >
        <i class="fas fa-graduation-cap mr-2 text-blue-600 sm:mr-3" />
        Tutorial de {{ currentToolTitle }}
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 sm:text-lg">
        Con este tutorial, puedes instalar y usar fácilmente {{ currentToolTitle }} en tu computadora.
      </p>
    </div>

    <!-- Etiquetas de selección del sistema -->
    <div class="mb-4 sm:mb-6">
      <div class="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 sm:gap-2 sm:p-2">
        <button
          v-for="system in tutorialSystems"
          :key="system.key"
          :class="[
            'flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 sm:gap-2 sm:px-6 sm:py-3 sm:text-sm',
            activeTutorialSystem === system.key
              ? 'bg-white text-blue-600 shadow-sm dark:bg-blue-600 dark:text-white dark:shadow-blue-500/40'
              : 'text-gray-600 hover:bg-white/50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
          ]"
          @click="activeTutorialSystem = system.key"
        >
          <i :class="system.icon" />
          {{ system.name }}
        </button>
      </div>
    </div>

    <!-- Etiquetas de selección de herramientas CLI -->
    <div class="mb-4 sm:mb-8">
      <div class="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 sm:gap-2 sm:p-2">
        <button
          v-for="tool in cliTools"
          :key="tool.key"
          :class="[
            'flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm',
            activeCliTool === tool.key
              ? 'bg-white text-blue-600 shadow-sm dark:bg-blue-600 dark:text-white dark:shadow-blue-500/40'
              : 'text-gray-600 hover:bg-white/50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
          ]"
          @click="activeCliTool = tool.key"
        >
          <i :class="tool.icon" />
          {{ tool.name }}
        </button>
      </div>
    </div>

    <!-- Componente dinámico -->
    <component :is="currentTutorialComponent" :platform="activeTutorialSystem" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import ClaudeCodeTutorial from '@/components/tutorial/ClaudeCodeTutorial.vue'
import GeminiCliTutorial from '@/components/tutorial/GeminiCliTutorial.vue'
import CodexTutorial from '@/components/tutorial/CodexTutorial.vue'
import DroidCliTutorial from '@/components/tutorial/DroidCliTutorial.vue'

// Selección del sistema actual
const activeTutorialSystem = ref('windows')

// Selección de herramienta CLI actual
const activeCliTool = ref('claude-code')

// Lista de sistemas
const tutorialSystems = [
  { key: 'windows', name: 'Windows', icon: 'fab fa-windows' },
  { key: 'macos', name: 'macOS', icon: 'fab fa-apple' },
  { key: 'linux', name: 'Linux / WSL2', icon: 'fab fa-linux' }
]

// Lista de herramientas CLI
const cliTools = [
  { key: 'claude-code', name: 'Claude Code', icon: 'fas fa-robot', component: ClaudeCodeTutorial },
  { key: 'codex', name: 'Codex', icon: 'fas fa-code', component: CodexTutorial },
  { key: 'gemini-cli', name: 'Gemini CLI', icon: 'fab fa-google', component: GeminiCliTutorial },
  { key: 'droid-cli', name: 'Droid CLI', icon: 'fas fa-terminal', component: DroidCliTutorial }
]

// Título de la herramienta actual
const currentToolTitle = computed(() => {
  const tool = cliTools.find((t) => t.key === activeCliTool.value)
  return tool ? tool.name : 'Herramienta CLI'
})

// Componente del tutorial actual
const currentTutorialComponent = computed(() => {
  const tool = cliTools.find((t) => t.key === activeCliTool.value)
  return tool ? tool.component : null
})
</script>

<style scoped>
.tutorial-container {
  min-height: calc(100vh - 300px);
}
</style>
