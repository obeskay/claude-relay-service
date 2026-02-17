/**
 * CachéMonitorear和管理工具
 * 提供统一的CachéMonitorear、Estadística和SeguridadLimpiar功能
 */

const logger = require('./logger')
const crypto = require('crypto')

class CacheMonitor {
  constructor() {
    this.monitors = new Map() // 存储所有被Monitorear的CachéInstancia
    this.startTime = Date.now()
    this.totalHits = 0
    this.totalMisses = 0
    this.totalEvictions = 0

    // 🔒 SeguridadConfiguración
    this.securityConfig = {
      maxCacheAge: 15 * 60 * 1000, // 最大Caché年龄 15 分钟
      forceCleanupInterval: 30 * 60 * 1000, // 强制Limpiar间隔 30 分钟
      memoryThreshold: 100 * 1024 * 1024, // 内存阈Valor 100MB
      sensitiveDataPatterns: [/password/i, /token/i, /secret/i, /key/i, /credential/i]
    }

    // 🧹 定期EjecutarSeguridadLimpiar
    this.setupSecurityCleanup()

    // 📊 定期报告EstadísticaInformación
    this.setupPeriodicReporting()
  }

  /**
   * 注册CachéInstancia进FilaMonitorear
   * @param {string} name - CachéNombre
   * @param {LRUCache} cache - CachéInstancia
   */
  registerCache(name, cache) {
    if (this.monitors.has(name)) {
      logger.warn(`⚠️ Cache ${name} is already registered, updating reference`)
    }

    this.monitors.set(name, {
      cache,
      registeredAt: Date.now(),
      lastCleanup: Date.now(),
      totalCleanups: 0
    })

    logger.info(`📦 Registered cache for monitoring: ${name}`)
  }

  /**
   * Obtener所有Caché的综合Estadística
   */
  getGlobalStats() {
    const stats = {
      uptime: Math.floor((Date.now() - this.startTime) / 1000), // 秒
      cacheCount: this.monitors.size,
      totalSize: 0,
      totalHits: 0,
      totalMisses: 0,
      totalEvictions: 0,
      averageHitRate: 0,
      caches: {}
    }

    for (const [name, monitor] of this.monitors) {
      const cacheStats = monitor.cache.getStats()
      stats.totalSize += cacheStats.size
      stats.totalHits += cacheStats.hits
      stats.totalMisses += cacheStats.misses
      stats.totalEvictions += cacheStats.evictions

      stats.caches[name] = {
        ...cacheStats,
        lastCleanup: new Date(monitor.lastCleanup).toISOString(),
        totalCleanups: monitor.totalCleanups,
        age: Math.floor((Date.now() - monitor.registeredAt) / 1000) // 秒
      }
    }

    const totalRequests = stats.totalHits + stats.totalMisses
    stats.averageHitRate =
      totalRequests > 0 ? `${((stats.totalHits / totalRequests) * 100).toFixed(2)}%` : '0%'

    return stats
  }

  /**
   * 🔒 EjecutarSeguridadLimpiar
   * Limpiar过期Datos和潜在的敏感Información
   */
  performSecurityCleanup() {
    logger.info('🔒 Starting security cleanup for all caches')

    for (const [name, monitor] of this.monitors) {
      try {
        const { cache } = monitor
        const beforeSize = cache.cache.size

        // Ejecutar常规Limpiar
        cache.cleanup()

        // VerificarCaché年龄，如果太老则完全清空
        const cacheAge = Date.now() - monitor.registeredAt
        if (cacheAge > this.securityConfig.maxCacheAge * 2) {
          logger.warn(
            `⚠️ Cache ${name} is too old (${Math.floor(cacheAge / 60000)}min), performing full clear`
          )
          cache.clear()
        }

        monitor.lastCleanup = Date.now()
        monitor.totalCleanups++

        const afterSize = cache.cache.size
        if (beforeSize !== afterSize) {
          logger.info(`🧹 Cache ${name}: Cleaned ${beforeSize - afterSize} items`)
        }
      } catch (error) {
        logger.error(`❌ Error cleaning cache ${name}:`, error)
      }
    }
  }

  /**
   * 📊 Generar详细报告
   */
  generateReport() {
    const stats = this.getGlobalStats()

    logger.info('═══════════════════════════════════════════')
    logger.info('📊 Cache System Performance Report')
    logger.info('═══════════════════════════════════════════')
    logger.info(`⏱️  Uptime: ${this.formatUptime(stats.uptime)}`)
    logger.info(`📦 Active Caches: ${stats.cacheCount}`)
    logger.info(`📈 Total Cache Size: ${stats.totalSize} items`)
    logger.info(`🎯 Global Hit Rate: ${stats.averageHitRate}`)
    logger.info(`✅ Total Hits: ${stats.totalHits.toLocaleString()}`)
    logger.info(`❌ Total Misses: ${stats.totalMisses.toLocaleString()}`)
    logger.info(`🗑️  Total Evictions: ${stats.totalEvictions.toLocaleString()}`)
    logger.info('───────────────────────────────────────────')

    // 详细的每个CachéEstadística
    for (const [name, cacheStats] of Object.entries(stats.caches)) {
      logger.info(`\n📦 ${name}:`)
      logger.info(
        `   Size: ${cacheStats.size}/${cacheStats.maxSize} | Hit Rate: ${cacheStats.hitRate}`
      )
      logger.info(
        `   Hits: ${cacheStats.hits} | Misses: ${cacheStats.misses} | Evictions: ${cacheStats.evictions}`
      )
      logger.info(
        `   Age: ${this.formatUptime(cacheStats.age)} | Cleanups: ${cacheStats.totalCleanups}`
      )
    }
    logger.info('═══════════════════════════════════════════')
  }

  /**
   * 🧹 Establecer定期SeguridadLimpiar
   */
  setupSecurityCleanup() {
    // 每 10 分钟Ejecutar一次SeguridadLimpiar
    setInterval(
      () => {
        this.performSecurityCleanup()
      },
      10 * 60 * 1000
    )

    // 每 30 分钟强制完整Limpiar
    setInterval(() => {
      logger.warn('⚠️ Performing forced complete cleanup for security')
      for (const [name, monitor] of this.monitors) {
        monitor.cache.clear()
        logger.info(`🗑️ Force cleared cache: ${name}`)
      }
    }, this.securityConfig.forceCleanupInterval)
  }

  /**
   * 📊 Establecer定期报告
   */
  setupPeriodicReporting() {
    // 每 5 分钟Generar一次简单Estadística
    setInterval(
      () => {
        const stats = this.getGlobalStats()
        logger.info(
          `📊 Quick Stats - Caches: ${stats.cacheCount}, Size: ${stats.totalSize}, Hit Rate: ${stats.averageHitRate}`
        )
      },
      5 * 60 * 1000
    )

    // 每 30 分钟Generar一次详细报告
    setInterval(
      () => {
        this.generateReport()
      },
      30 * 60 * 1000
    )
  }

  /**
   * Formato化运FilaTiempo
   */
  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  /**
   * 🔐 GenerarSeguridad的Caché键
   * 使用 SHA-256 哈希避免暴露原始Datos
   */
  static generateSecureCacheKey(data) {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * 🛡️ ValidarCachéDatosSeguridad性
   * Verificar是否Incluir敏感Información
   */
  validateCacheSecurity(data) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data)

    for (const pattern of this.securityConfig.sensitiveDataPatterns) {
      if (pattern.test(dataStr)) {
        logger.warn('⚠️ Potential sensitive data detected in cache')
        return false
      }
    }

    return true
  }

  /**
   * 💾 Obtener内存使用估算
   */
  estimateMemoryUsage() {
    let totalBytes = 0

    for (const [, monitor] of this.monitors) {
      const { cache } = monitor.cache
      for (const [key, item] of cache) {
        // 粗略估算：key 长度 + value Serialización长度
        totalBytes += key.length * 2 // UTF-16
        totalBytes += JSON.stringify(item).length * 2
      }
    }

    return {
      bytes: totalBytes,
      mb: (totalBytes / (1024 * 1024)).toFixed(2),
      warning: totalBytes > this.securityConfig.memoryThreshold
    }
  }

  /**
   * 🚨 紧急Limpiar
   * 在内存压力大时使用
   */
  emergencyCleanup() {
    logger.error('🚨 EMERGENCY CLEANUP INITIATED')

    for (const [name, monitor] of this.monitors) {
      const { cache } = monitor
      const beforeSize = cache.cache.size

      // Limpiar一半的Caché项（LRU 会保留最近使用的）
      const targetSize = Math.floor(cache.maxSize / 2)
      while (cache.cache.size > targetSize) {
        const firstKey = cache.cache.keys().next().value
        cache.cache.delete(firstKey)
      }

      logger.warn(`🚨 Emergency cleaned ${name}: ${beforeSize} -> ${cache.cache.size} items`)
    }
  }
}

// 导出单例
module.exports = new CacheMonitor()
