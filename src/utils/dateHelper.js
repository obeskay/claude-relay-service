const config = require('../../config/config')

/**
 * Formato化FechaTiempo为指定Zona horaria的本地TiempoCadena
 * @param {Date|number} date - DateObjeto或Tiempo戳（秒或毫秒）
 * @param {boolean} includeTimezone - 是否在输出中IncluirZona horariaInformación
 * @returns {string} Formato化后的TiempoCadena
 */
function formatDateWithTimezone(date, includeTimezone = true) {
  // Procesar不同Tipo的输入
  let dateObj
  if (typeof date === 'number') {
    // 判断是秒还是毫秒Tiempo戳
    // UnixTiempo戳（秒）通常小于 10^10，毫秒Tiempo戳通常大于 10^12
    if (date < 10000000000) {
      dateObj = new Date(date * 1000) // 秒转毫秒
    } else {
      dateObj = new Date(date) // 已经是毫秒
    }
  } else if (date instanceof Date) {
    dateObj = date
  } else {
    dateObj = new Date(date)
  }

  // ObtenerConfiguración的Zona horaria偏移（小时）
  const timezoneOffset = config.system.timezoneOffset || 8 // Predeterminado UTC+8

  // Calcular本地Tiempo
  const offsetMs = timezoneOffset * 3600000 // Convertir为毫秒
  const localTime = new Date(dateObj.getTime() + offsetMs)

  // Formato化为 YYYY-MM-DD HH:mm:ss
  const year = localTime.getUTCFullYear()
  const month = String(localTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localTime.getUTCDate()).padStart(2, '0')
  const hours = String(localTime.getUTCHours()).padStart(2, '0')
  const minutes = String(localTime.getUTCMinutes()).padStart(2, '0')
  const seconds = String(localTime.getUTCSeconds()).padStart(2, '0')

  let formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

  // 添加Zona horariaInformación
  if (includeTimezone) {
    const sign = timezoneOffset >= 0 ? '+' : ''
    formattedDate += ` (UTC${sign}${timezoneOffset})`
  }

  return formattedDate
}

/**
 * Obtener指定Zona horaria的ISOFormatoTiempoCadena
 * @param {Date|number} date - DateObjeto或Tiempo戳
 * @returns {string} ISOFormato的TiempoCadena
 */
function getISOStringWithTimezone(date) {
  // 先Obtener本地Formato的Tiempo（不含Zona horaria后缀）
  const localTimeStr = formatDateWithTimezone(date, false)

  // ObtenerZona horaria偏移
  const timezoneOffset = config.system.timezoneOffset || 8

  // ConstruirISOFormato，添加Zona horaria偏移
  const sign = timezoneOffset >= 0 ? '+' : '-'
  const absOffset = Math.abs(timezoneOffset)
  const offsetHours = String(Math.floor(absOffset)).padStart(2, '0')
  const offsetMinutes = String(Math.round((absOffset % 1) * 60)).padStart(2, '0')

  // 将空格Reemplazo为T，并添加Zona horaria
  return `${localTimeStr.replace(' ', 'T')}${sign}${offsetHours}:${offsetMinutes}`
}

/**
 * CalcularTiempo差并Formato化为人Clase可读的Cadena
 * @param {number} seconds - 秒数
 * @returns {string} Formato化的Tiempo差Cadena
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}秒`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}分钟`
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
  } else {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    return hours > 0 ? `${days}天${hours}小时` : `${days}天`
  }
}

module.exports = {
  formatDateWithTimezone,
  getISOStringWithTimezone,
  formatDuration
}
