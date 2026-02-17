/**
 * Stream Helper Utilities
 * 流Procesar辅助工具Función
 */

/**
 * VerificarRespuesta流是否仍然可写（ClienteConexión是否有效）
 * @param {import('http').ServerResponse} stream - HTTPRespuesta流
 * @returns {boolean} 如果流可写Retornartrue，否则Retornarfalse
 */
function isStreamWritable(stream) {
  if (!stream) {
    return false
  }

  // Verificar流是否已销毁
  if (stream.destroyed) {
    return false
  }

  // Verificar底层socket是否已销毁
  if (stream.socket?.destroyed) {
    return false
  }

  // Verificar流是否已结束Escribir
  if (stream.writableEnded) {
    return false
  }

  return true
}

module.exports = {
  isStreamWritable
}
