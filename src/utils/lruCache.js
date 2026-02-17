/**
 * LRU (Least Recently Used) Caché实现
 * 用于CachéDescifrado结果，提高Rendimiento同时控制内存使用
 */
class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize
    this.cache = new Map()
    this.hits = 0
    this.misses = 0
    this.evictions = 0
    this.lastCleanup = Date.now()
    this.cleanupInterval = 5 * 60 * 1000 // 5分钟Limpiar一次过期项
  }

  /**
   * ObtenerCachéValor
   * @param {string} key - Caché键
   * @returns {*} Caché的Valor，如果不存在则Retornar undefined
   */
  get(key) {
    // 定期Limpiar
    if (Date.now() - this.lastCleanup > this.cleanupInterval) {
      this.cleanup()
    }

    const item = this.cache.get(key)
    if (!item) {
      this.misses++
      return undefined
    }

    // Verificar是否过期
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key)
      this.misses++
      return undefined
    }

    // Actualizar访问Tiempo，将元素移到最后（最近使用）
    this.cache.delete(key)
    this.cache.set(key, {
      ...item,
      lastAccessed: Date.now()
    })

    this.hits++
    return item.value
  }

  /**
   * EstablecerCachéValor
   * @param {string} key - Caché键
   * @param {*} value - 要Caché的Valor
   * @param {number} ttl - 生存Tiempo（毫秒），Predeterminado5分钟
   */
  set(key, value, ttl = 5 * 60 * 1000) {
    // 如果Caché已满，Eliminar最少使用的项
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
      this.evictions++
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiry: ttl ? Date.now() + ttl : null
    })
  }

  /**
   * Limpiar过期项
   */
  cleanup() {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, item] of this.cache.entries()) {
      if (item.expiry && now > item.expiry) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    this.lastCleanup = now
    if (cleanedCount > 0) {
      console.log(`🧹 LRU Cache: Cleaned ${cleanedCount} expired items`)
    }
  }

  /**
   * 清空Caché
   */
  clear() {
    const { size } = this.cache
    this.cache.clear()
    this.hits = 0
    this.misses = 0
    this.evictions = 0
    console.log(`🗑️ LRU Cache: Cleared ${size} items`)
  }

  /**
   * ObtenerCachéEstadísticaInformación
   */
  getStats() {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(2) : 0

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: `${hitRate}%`,
      total
    }
  }

  /**
   * 打印CachéEstadísticaInformación
   */
  printStats() {
    const stats = this.getStats()
    console.log(
      `📊 LRU Cache Stats: Size: ${stats.size}/${stats.maxSize}, Hit Rate: ${stats.hitRate}, Hits: ${stats.hits}, Misses: ${stats.misses}, Evictions: ${stats.evictions}`
    )
  }
}

module.exports = LRUCache
