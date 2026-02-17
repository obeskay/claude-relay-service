/**
 * Signature Cache - FirmaCachéMódulo
 *
 * 用于Caché Antigravity thinking block 的 thoughtSignature。
 * Claude Code Cliente可能剥离非标准Campo，导致多轮对话时Firma丢失。
 * 此Módulo按 sessionId + thinkingText 存储Firma，便于后续SolicitudRestauración。
 *
 * 参考实现：
 * - CLIProxyAPI: internal/cache/signature_cache.go
 * - antigravity-claude-proxy: src/format/signature-cache.js
 */

const crypto = require('crypto')
const logger = require('./logger')

// Configuración常量
const SIGNATURE_CACHE_TTL_MS = 60 * 60 * 1000 // 1 小时（同 CLIProxyAPI）
const MAX_ENTRIES_PER_SESSION = 100 // 每Sesión最大Caché条目
const MIN_SIGNATURE_LENGTH = 50 // 最小有效Firma长度
const TEXT_HASH_LENGTH = 16 // 文本哈希长度（SHA256 前 16 位）

// 主Caché：sessionId -> Map<textHash, { signature, timestamp }>
const signatureCache = new Map()

/**
 * Generar文本内容的稳定哈希Valor
 * @param {string} text - 待哈希的文本
 * @returns {string} 16 字符的十六进制哈希
 */
function hashText(text) {
  if (!text || typeof text !== 'string') {
    return ''
  }
  const hash = crypto.createHash('sha256').update(text).digest('hex')
  return hash.slice(0, TEXT_HASH_LENGTH)
}

/**
 * Obtener或CrearSesiónCaché
 * @param {string} sessionId - Sesión ID
 * @returns {Map} Sesión的FirmaCaché Map
 */
function getOrCreateSessionCache(sessionId) {
  if (!signatureCache.has(sessionId)) {
    signatureCache.set(sessionId, new Map())
  }
  return signatureCache.get(sessionId)
}

/**
 * VerificarFirma是否有效
 * @param {string} signature - 待Verificar的Firma
 * @returns {boolean} Firma是否有效
 */
function isValidSignature(signature) {
  return typeof signature === 'string' && signature.length >= MIN_SIGNATURE_LENGTH
}

/**
 * Caché thinking Firma
 * @param {string} sessionId - Sesión ID
 * @param {string} thinkingText - thinking 内容文本
 * @param {string} signature - thoughtSignature
 */
function cacheSignature(sessionId, thinkingText, signature) {
  if (!sessionId || !thinkingText || !signature) {
    return
  }

  if (!isValidSignature(signature)) {
    return
  }

  const sessionCache = getOrCreateSessionCache(sessionId)
  const textHash = hashText(thinkingText)

  if (!textHash) {
    return
  }

  // 淘汰Política：超过Límite时Eliminar最老的 1/4 条目
  if (sessionCache.size >= MAX_ENTRIES_PER_SESSION) {
    const entries = Array.from(sessionCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = Math.max(1, Math.floor(entries.length / 4))
    for (let i = 0; i < toRemove; i++) {
      sessionCache.delete(entries[i][0])
    }
    logger.debug(
      `[SignatureCache] Evicted ${toRemove} old entries for session ${sessionId.slice(0, 8)}...`
    )
  }

  sessionCache.set(textHash, {
    signature,
    timestamp: Date.now()
  })

  logger.debug(
    `[SignatureCache] Cached signature for session ${sessionId.slice(0, 8)}..., hash ${textHash}`
  )
}

/**
 * ObtenerCaché的Firma
 * @param {string} sessionId - Sesión ID
 * @param {string} thinkingText - thinking 内容文本
 * @returns {string|null} Caché的Firma，未找到或过期则Retornar null
 */
function getCachedSignature(sessionId, thinkingText) {
  if (!sessionId || !thinkingText) {
    return null
  }

  const sessionCache = signatureCache.get(sessionId)
  if (!sessionCache) {
    return null
  }

  const textHash = hashText(thinkingText)
  if (!textHash) {
    return null
  }

  const entry = sessionCache.get(textHash)
  if (!entry) {
    return null
  }

  // Verificar是否过期
  if (Date.now() - entry.timestamp > SIGNATURE_CACHE_TTL_MS) {
    sessionCache.delete(textHash)
    logger.debug(`[SignatureCache] Entry expired for hash ${textHash}`)
    return null
  }

  logger.debug(
    `[SignatureCache] Cache hit for session ${sessionId.slice(0, 8)}..., hash ${textHash}`
  )
  return entry.signature
}

/**
 * 清除SesiónCaché
 * @param {string} sessionId - 要清除的Sesión ID，为空则清除全部
 */
function clearSignatureCache(sessionId = null) {
  if (sessionId) {
    signatureCache.delete(sessionId)
    logger.debug(`[SignatureCache] Cleared cache for session ${sessionId.slice(0, 8)}...`)
  } else {
    signatureCache.clear()
    logger.debug('[SignatureCache] Cleared all caches')
  }
}

/**
 * ObtenerCachéEstadísticaInformación（Depurar用）
 * @returns {Object} { sessionCount, totalEntries }
 */
function getCacheStats() {
  let totalEntries = 0
  for (const sessionCache of signatureCache.values()) {
    totalEntries += sessionCache.size
  }
  return {
    sessionCount: signatureCache.size,
    totalEntries
  }
}

module.exports = {
  cacheSignature,
  getCachedSignature,
  clearSignatureCache,
  getCacheStats,
  isValidSignature,
  // 内部Función导出（用于Probar或Extensión）
  hashText,
  MIN_SIGNATURE_LENGTH,
  MAX_ENTRIES_PER_SESSION,
  SIGNATURE_CACHE_TTL_MS
}
