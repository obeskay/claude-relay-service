<template>
  <Teleport to="body">
    <div class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`, toast.isVisible ? 'toast-show' : 'toast-hide']"
        @click="removeToast(toast.id)"
      >
        <div class="toast-content">
          <div class="toast-icon">
            <i :class="getIconClass(toast.type)" />
          </div>
          <div class="toast-body">
            <div v-if="toast.title" class="toast-title">
              {{ toast.title }}
            </div>
            <div class="toast-message">
              {{ toast.message }}
            </div>
          </div>
          <button class="toast-close" @click.stop="removeToast(toast.id)">
            <i class="fas fa-times" />
          </button>
        </div>
        <div
          v-if="toast.duration > 0"
          class="toast-progress"
          :style="{ animationDuration: `${toast.duration}ms` }"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// Estado
const toasts = ref([])
let toastIdCounter = 0

// Obtener clase de icono
const getIconClass = (type) => {
  const iconMap = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  }
  return iconMap[type] || iconMap.info
}

// Agregar Toast
const addToast = (message, type = 'info', title = null, duration = 5000) => {
  const id = ++toastIdCounter
  const toast = {
    id,
    message,
    type,
    title,
    duration,
    isVisible: false
  }

  toasts.value.push(toast)

  // Mostrar animación en el siguiente frame
  setTimeout(() => {
    toast.isVisible = true
  }, 10)

  // Eliminar automáticamente
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  return id
}

// Eliminar Toast
const removeToast = (id) => {
  const index = toasts.value.findIndex((toast) => toast.id === id)
  if (index > -1) {
    const toast = toasts.value[index]
    toast.isVisible = false

    // Esperar a que la animación se complete antes de eliminar
    setTimeout(() => {
      const currentIndex = toasts.value.findIndex((t) => t.id === id)
      if (currentIndex > -1) {
        toasts.value.splice(currentIndex, 1)
      }
    }, 300)
  }
}

// Limpiar todos los Toasts
const clearAllToasts = () => {
  toasts.value.forEach((toast) => {
    toast.isVisible = false
  })

  setTimeout(() => {
    toasts.value.length = 0
  }, 300)
}

// Exponer métodos para uso global
const showToast = (message, type = 'info', title = null, duration = 5000) => {
  return addToast(message, type, title, duration)
}

// Registro de métodos globales
onMounted(() => {
  // Montar métodos en el objeto global
  window.showToast = showToast
})

onUnmounted(() => {
  // Limpiar métodos globales
  if (window.showToast === showToast) {
    delete window.showToast
  }
})

// Exponer métodos para uso de componentes
defineExpose({
  showToast,
  removeToast,
  clearAllToasts
})
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.toast {
  min-width: 320px;
  max-width: 500px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5e7eb;
  overflow: hidden;
  position: relative;
  pointer-events: auto;
  cursor: pointer;
  transform: translateX(100%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:global(.dark) .toast {
  background: var(--bg-gradient-start);
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.toast-show {
  transform: translateX(0);
  opacity: 1;
}

.toast-hide {
  transform: translateX(100%);
  opacity: 0;
}

.toast-content {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  gap: 12px;
}

.toast-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
}

.toast-body {
  flex: 1;
}

.toast-title {
  font-weight: 600;
  font-size: 14px;
  line-height: 1.4;
  margin-bottom: 4px;
}

.toast-message {
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}

.toast-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #9ca3af;
  transition: all 0.2s ease;
}

.toast-close:hover {
  background: #f3f4f6;
  color: #6b7280;
}

:global(.dark) .toast-close:hover {
  background: var(--bg-gradient-mid);
  color: var(--text-secondary);
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: currentColor;
  opacity: 0.3;
  animation: toast-progress linear forwards;
}

@keyframes toast-progress {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

/* Success Toast */
.toast-success {
  border-left: 4px solid #10b981;
}

.toast-success .toast-icon {
  color: #10b981;
  background: #d1fae5;
}

:global(.dark) .toast-success .toast-icon {
  background: #064e3b;
}

.toast-success .toast-title {
  color: #065f46;
}

:global(.dark) .toast-success .toast-title {
  color: #10b981;
}

.toast-success .toast-message {
  color: #047857;
}

:global(.dark) .toast-success .toast-message {
  color: #34d399;
}

.toast-success .toast-progress {
  background: #10b981;
}

/* Error Toast */
.toast-error {
  border-left: 4px solid #ef4444;
}

.toast-error .toast-icon {
  color: #ef4444;
  background: #fee2e2;
}

:global(.dark) .toast-error .toast-icon {
  background: #7f1d1d;
}

.toast-error .toast-title {
  color: #991b1b;
}

:global(.dark) .toast-error .toast-title {
  color: #ef4444;
}

.toast-error .toast-message {
  color: #dc2626;
}

:global(.dark) .toast-error .toast-message {
  color: #f87171;
}

.toast-error .toast-progress {
  background: #ef4444;
}

/* Warning Toast */
.toast-warning {
  border-left: 4px solid #f59e0b;
}

.toast-warning .toast-icon {
  color: #f59e0b;
  background: #fef3c7;
}

:global(.dark) .toast-warning .toast-icon {
  background: #78350f;
}

.toast-warning .toast-title {
  color: #92400e;
}

:global(.dark) .toast-warning .toast-title {
  color: #f59e0b;
}

.toast-warning .toast-message {
  color: #d97706;
}

:global(.dark) .toast-warning .toast-message {
  color: #fbbf24;
}

.toast-warning .toast-progress {
  background: #f59e0b;
}

/* Info Toast */
.toast-info {
  border-left: 4px solid #3b82f6;
}

.toast-info .toast-icon {
  color: #3b82f6;
  background: #dbeafe;
}

:global(.dark) .toast-info .toast-icon {
  background: #1e3a8a;
}

.toast-info .toast-title {
  color: #1e40af;
}

:global(.dark) .toast-info .toast-title {
  color: #3b82f6;
}

.toast-info .toast-message {
  color: #2563eb;
}

:global(.dark) .toast-info .toast-message {
  color: #60a5fa;
}

.toast-info .toast-progress {
  background: #3b82f6;
}

/* Responsive */
@media (max-width: 640px) {
  .toast-container {
    top: 10px;
    right: 10px;
    left: 10px;
  }

  .toast {
    min-width: auto;
    max-width: none;
  }
}

/* Toast List Transitions */
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.3s ease;
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-list-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-list-move {
  transition: transform 0.3s ease;
}
</style>
