/**
 * ============================================================================
 * Seguridad JSONL 追加工具（带Archivo大小Límite与自动轮转）
 * ============================================================================
 *
 * 用于所有Depurar Dump Módulo，避免RegistroArchivo无限增长导致 I/O 拥塞。
 *
 * Política：
 * - 每次Escribir前Verificar目标Archivo大小
 * - 超过阈Valor时，将现有Archivo重命名为 .bak（覆盖旧 .bak）
 * - 然后Escribir新Archivo
 */

const fs = require('fs/promises')
const logger = require('./logger')

// PredeterminadoArchivo大小上限：10MB
const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_FILE_SIZE_ENV = 'DUMP_MAX_FILE_SIZE_BYTES'

/**
 * ObtenerArchivo大小上限（可通过Variable de entorno覆盖）
 */
function getMaxFileSize() {
  const raw = process.env[MAX_FILE_SIZE_ENV]
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return DEFAULT_MAX_FILE_SIZE_BYTES
}

/**
 * ObtenerArchivo大小，Archivo不存在时Retornar 0
 */
async function getFileSize(filepath) {
  try {
    const stat = await fs.stat(filepath)
    return stat.size
  } catch (e) {
    // Archivo不存在或无法Leer
    return 0
  }
}

/**
 * Seguridad追加Escribir JSONL Archivo，Soportar自动轮转
 *
 * @param {string} filepath - 目标Archivo绝对Ruta
 * @param {string} line - 要Escribir的单Fila（应以 \n 结尾）
 * @param {Object} options - OpcionalConfiguración
 * @param {number} options.maxFileSize - Archivo大小上限（字节），Predeterminado从Variable de entorno或 10MB
 */
async function safeRotatingAppend(filepath, line, options = {}) {
  const maxFileSize = options.maxFileSize || getMaxFileSize()

  const currentSize = await getFileSize(filepath)

  // 如果当前Archivo已达到或超过阈Valor，轮转
  if (currentSize >= maxFileSize) {
    const backupPath = `${filepath}.bak`
    try {
      // 先Eliminar旧Respaldo（如果存在）
      await fs.unlink(backupPath).catch(() => {})
      // 重命名当前Archivo为Respaldo
      await fs.rename(filepath, backupPath)
    } catch (renameErr) {
      // 轮转Falló时RegistroAdvertenciaRegistro，继续Escribir原Archivo
      logger.warn('⚠️ Log rotation failed, continuing to write to original file', {
        filepath,
        backupPath,
        error: renameErr?.message || String(renameErr)
      })
    }
  }

  // 追加Escribir
  await fs.appendFile(filepath, line, { encoding: 'utf8' })
}

module.exports = {
  safeRotatingAppend,
  getMaxFileSize,
  MAX_FILE_SIZE_ENV,
  DEFAULT_MAX_FILE_SIZE_BYTES
}
