/**
 * Server-Sent Events (SSE) Analizar工具
 *
 * 用于Analizar标准 SSE Formato的Datos流
 * 当前主要用于 Gemini API 的流式RespuestaProcesar
 *
 * @module sseParser
 */

/**
 * Analizar单Fila SSE Datos
 *
 * @param {string} line - SSE Formato的Fila（如："data: {json}\n"）
 * @returns {Object} Analizar结果
 * @returns {'data'|'control'|'other'|'invalid'} .type - FilaTipo
 * @returns {Object|null} .data - Analizar后的 JSON Datos（仅 type='data' 时）
 * @returns {string} .line - 原始Fila内容
 * @returns {string} [.jsonStr] - JSON Cadena
 * @returns {Error} [.error] - AnalizarError（仅 type='invalid' 时）
 *
 * @example
 * // DatosFila
 * parseSSELine('data: {"key":"value"}')
 * // => { type: 'data', data: {key: 'value'}, line: '...', jsonStr: '...' }
 *
 * @example
 * // 控制Fila
 * parseSSELine('data: [DONE]')
 * // => { type: 'control', data: null, line: '...', jsonStr: '[DONE]' }
 */
function parseSSELine(line) {
  if (!line.startsWith('data: ')) {
    return { type: 'other', line, data: null }
  }

  const jsonStr = line.substring(6).trim()

  if (!jsonStr || jsonStr === '[DONE]') {
    return { type: 'control', line, data: null, jsonStr }
  }

  try {
    const data = JSON.parse(jsonStr)
    return { type: 'data', line, data, jsonStr }
  } catch (e) {
    return { type: 'invalid', line, data: null, jsonStr, error: e }
  }
}

/**
 * 增量 SSE Analizar器Clase
 * 用于Procesar流式Datos，避免每次都 split 整个 buffer
 */
class IncrementalSSEParser {
  constructor() {
    this.buffer = ''
  }

  /**
   * 添加Datos块并Retornar完整的Evento
   * @param {string} chunk - Datos块
   * @returns {Array<Object>} Analizar出的完整EventoArreglo
   */
  feed(chunk) {
    this.buffer += chunk
    const events = []

    // 查找完整的Evento（以 \n\n 分隔）
    let idx
    while ((idx = this.buffer.indexOf('\n\n')) !== -1) {
      const event = this.buffer.slice(0, idx)
      this.buffer = this.buffer.slice(idx + 2)

      if (event.trim()) {
        // AnalizarEvento中的每一Fila
        const lines = event.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6)
            if (jsonStr && jsonStr !== '[DONE]') {
              try {
                events.push({ type: 'data', data: JSON.parse(jsonStr) })
              } catch (e) {
                events.push({ type: 'invalid', raw: jsonStr, error: e })
              }
            } else if (jsonStr === '[DONE]') {
              events.push({ type: 'done' })
            }
          } else if (line.startsWith('event: ')) {
            events.push({ type: 'event', name: line.slice(7).trim() })
          }
        }
      }
    }

    return events
  }

  /**
   * Obtener剩余的 buffer 内容
   * @returns {string}
   */
  getRemaining() {
    return this.buffer
  }

  /**
   * 重置Analizar器
   */
  reset() {
    this.buffer = ''
  }
}

module.exports = {
  parseSSELine,
  IncrementalSSEParser
}
