/**
 * EstadísticaCalcular工具Función
 * 提供百分位数Calcular、等待TiempoEstadística等通用Estadística功能
 */

/**
 * Calcular百分位数（使用 nearest-rank Método）
 * @param {number[]} sortedArray - 已Ordenar的Arreglo（升序）
 * @param {number} percentile - 百分位数 (0-100)
 * @returns {number} 百分位Valor
 *
 * 边界情况说明：
 * - percentile=0: Retornar最小Valor (index=0)
 * - percentile=100: Retornar最大Valor (index=len-1)
 * - percentile=50 且 len=2: Retornar第一个元素（nearest-rank 向下取）
 *
 * 算法说明（nearest-rank Método）：
 * - index = ceil(percentile / 100 * len) - 1
 * - 示例：len=100, P50 → ceil(50) - 1 = 49（第50个元素，0-indexed）
 * - 示例：len=100, P99 → ceil(99) - 1 = 98（第99个元素）
 */
function getPercentile(sortedArray, percentile) {
  const len = sortedArray.length
  if (len === 0) {
    return 0
  }
  if (len === 1) {
    return sortedArray[0]
  }

  // 边界Procesar：percentile <= 0 Retornar最小Valor
  if (percentile <= 0) {
    return sortedArray[0]
  }
  // 边界Procesar：percentile >= 100 Retornar最大Valor
  if (percentile >= 100) {
    return sortedArray[len - 1]
  }

  const index = Math.ceil((percentile / 100) * len) - 1
  return sortedArray[index]
}

/**
 * Calcular等待Tiempo分布Estadística
 * @param {number[]} waitTimes - 等待TiempoArreglo（无需预先Ordenar）
 * @returns {Object|null} EstadísticaObjeto，空ArregloRetornar null
 *
 * RetornarObjetoIncluir：
 * - sampleCount: 样本数量（始终Incluir，便于调用方判断可靠性）
 * - count: 样本数量（向后兼容）
 * - min: 最小Valor
 * - max: 最大Valor
 * - avg: 平均Valor（四舍五入）
 * - p50: 50百分位数（中位数）
 * - p90: 90百分位数
 * - p99: 99百分位数
 * - sampleSizeWarning: 样本量不足时的AdvertenciaInformación（样本 < 10）
 * - p90Unreliable: P90 Estadística不可靠标记（样本 < 10）
 * - p99Unreliable: P99 Estadística不可靠标记（样本 < 100）
 *
 * 可靠性标记说明（详见 design.md Decision 6）：
 * - 样本 < 10: P90 和 P99 都不可靠
 * - 样本 < 100: P99 不可靠（P90 需要 10 个样本，P99 需要 100 个样本）
 * - 即使标记为不可靠，仍RetornarCalcularValor供参考
 */
function calculateWaitTimeStats(waitTimes) {
  if (!waitTimes || waitTimes.length === 0) {
    return null
  }

  const sorted = [...waitTimes].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const len = sorted.length

  const stats = {
    sampleCount: len, // Nueva característica：始终Incluir样本数
    count: len, // 向后兼容
    min: sorted[0],
    max: sorted[len - 1],
    avg: Math.round(sum / len),
    p50: getPercentile(sorted, 50),
    p90: getPercentile(sorted, 90),
    p99: getPercentile(sorted, 99)
  }

  // 渐进式可靠性标记（详见 design.md Decision 6）
  // 样本 < 10: P90 不可靠（P90 至少需要 ceil(100/10) = 10 个样本）
  if (len < 10) {
    stats.sampleSizeWarning = 'Results may be inaccurate due to small sample size'
    stats.p90Unreliable = true
  }

  // 样本 < 100: P99 不可靠（P99 至少需要 ceil(100/1) = 100 个样本）
  if (len < 100) {
    stats.p99Unreliable = true
  }

  return stats
}

module.exports = {
  getPercentile,
  calculateWaitTimeStats
}
