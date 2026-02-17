/**
 * RendimientoOptimización工具Módulo
 * 提供 HTTP keep-alive Conexión池、定价DatosCaché等Optimización功能
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const LRUCache = require('./lruCache')

// Conexión池Configuración（从Variable de entornoLeer）
const STREAM_MAX_SOCKETS = parseInt(process.env.HTTPS_MAX_SOCKETS_STREAM) || 65535
const NON_STREAM_MAX_SOCKETS = parseInt(process.env.HTTPS_MAX_SOCKETS_NON_STREAM) || 16384
const MAX_FREE_SOCKETS = parseInt(process.env.HTTPS_MAX_FREE_SOCKETS) || 2048
const FREE_SOCKET_TIMEOUT = parseInt(process.env.HTTPS_FREE_SOCKET_TIMEOUT) || 30000

// 流式Solicitud agent：高 maxSockets，timeout=0（不Límite）
const httpsAgentStream = new https.Agent({
  keepAlive: true,
  maxSockets: STREAM_MAX_SOCKETS,
  maxFreeSockets: MAX_FREE_SOCKETS,
  timeout: 0,
  freeSocketTimeout: FREE_SOCKET_TIMEOUT
})

// 非流式Solicitud agent：较小 maxSockets
const httpsAgentNonStream = new https.Agent({
  keepAlive: true,
  maxSockets: NON_STREAM_MAX_SOCKETS,
  maxFreeSockets: MAX_FREE_SOCKETS,
  timeout: 0, // 不Límite，由Solicitud层 REQUEST_TIMEOUT 控制
  freeSocketTimeout: FREE_SOCKET_TIMEOUT
})

// HTTP agent（非流式）
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: NON_STREAM_MAX_SOCKETS,
  maxFreeSockets: MAX_FREE_SOCKETS,
  timeout: 0, // 不Límite，由Solicitud层 REQUEST_TIMEOUT 控制
  freeSocketTimeout: FREE_SOCKET_TIMEOUT
})

// 定价DatosCaché（按ArchivoRuta区分）
const pricingDataCache = new Map()
const PRICING_CACHE_TTL = 5 * 60 * 1000 // 5分钟

// Redis ConfiguraciónCaché（短 TTL）
const configCache = new LRUCache(100)
const CONFIG_CACHE_TTL = 30 * 1000 // 30秒

/**
 * Obtener流式Solicitud的 HTTPS agent
 */
function getHttpsAgentForStream() {
  return httpsAgentStream
}

/**
 * Obtener非流式Solicitud的 HTTPS agent
 */
function getHttpsAgentForNonStream() {
  return httpsAgentNonStream
}

/**
 * Obtener定价Datos（带Caché，按Ruta区分）
 * @param {string} pricingFilePath - 定价ArchivoRuta
 * @returns {Object|null} 定价Datos
 */
function getPricingData(pricingFilePath) {
  const now = Date.now()
  const cached = pricingDataCache.get(pricingFilePath)

  // VerificarCaché是否有效
  if (cached && now - cached.loadTime < PRICING_CACHE_TTL) {
    return cached.data
  }

  // 重新加载
  try {
    if (!fs.existsSync(pricingFilePath)) {
      return null
    }
    const data = JSON.parse(fs.readFileSync(pricingFilePath, 'utf8'))
    pricingDataCache.set(pricingFilePath, { data, loadTime: now })
    return data
  } catch (error) {
    return null
  }
}

/**
 * 清除定价DatosCaché（用于热Actualizar）
 * @param {string} pricingFilePath - Opcional，指定Ruta则只清除该RutaCaché
 */
function clearPricingCache(pricingFilePath = null) {
  if (pricingFilePath) {
    pricingDataCache.delete(pricingFilePath)
  } else {
    pricingDataCache.clear()
  }
}

/**
 * ObtenerCaché的Configuración
 * @param {string} key - Caché键
 * @returns {*} CachéValor
 */
function getCachedConfig(key) {
  return configCache.get(key)
}

/**
 * EstablecerConfiguraciónCaché
 * @param {string} key - Caché键
 * @param {*} value - Valor
 * @param {number} ttl - TTL（毫秒）
 */
function setCachedConfig(key, value, ttl = CONFIG_CACHE_TTL) {
  configCache.set(key, value, ttl)
}

/**
 * EliminarConfiguraciónCaché
 * @param {string} key - Caché键
 */
function deleteCachedConfig(key) {
  configCache.cache.delete(key)
}

/**
 * ObtenerConexión池EstadísticaInformación
 */
function getAgentStats() {
  return {
    httpsStream: {
      sockets: Object.keys(httpsAgentStream.sockets).length,
      freeSockets: Object.keys(httpsAgentStream.freeSockets).length,
      requests: Object.keys(httpsAgentStream.requests).length,
      maxSockets: STREAM_MAX_SOCKETS
    },
    httpsNonStream: {
      sockets: Object.keys(httpsAgentNonStream.sockets).length,
      freeSockets: Object.keys(httpsAgentNonStream.freeSockets).length,
      requests: Object.keys(httpsAgentNonStream.requests).length,
      maxSockets: NON_STREAM_MAX_SOCKETS
    },
    http: {
      sockets: Object.keys(httpAgent.sockets).length,
      freeSockets: Object.keys(httpAgent.freeSockets).length,
      requests: Object.keys(httpAgent.requests).length
    },
    configCache: configCache.getStats()
  }
}

module.exports = {
  getHttpsAgentForStream,
  getHttpsAgentForNonStream,
  getHttpAgent: () => httpAgent,
  getPricingData,
  clearPricingCache,
  getCachedConfig,
  setCachedConfig,
  deleteCachedConfig,
  getAgentStats
}
