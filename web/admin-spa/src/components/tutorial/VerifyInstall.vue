<template>
  <div
    class="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-500/40 dark:bg-green-950/30 sm:p-4"
  >
    <h6 class="mb-2 text-sm font-medium text-green-800 dark:text-green-300 sm:text-base">
      验证安装是否Exitoso
    </h6>
    <p class="mb-2 text-xs text-green-700 dark:text-green-300 sm:mb-3 sm:text-sm">
      安装完成siguiente，打开 {{ terminal }}，Entrada以abajo命令：
    </p>
    <div
      class="overflow-x-auto rounded bg-gray-900 p-2 font-mono text-xs text-green-400 sm:p-3 sm:text-sm"
    >
      <div class="whitespace-nowrap text-gray-300">node --version</div>
      <div class="whitespace-nowrap text-gray-300">npm --version</div>
    </div>
    <p class="mt-2 text-xs text-green-700 dark:text-green-300 sm:text-sm">
      如果显示版本号，Instrucciones安装Exitoso！
    </p>
  </div>
</template>

<script setup>
defineProps({
  terminal: {
    type: String,
    default: '终端'
  }
})
</script>
