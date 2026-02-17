let config = {}
try {
  // config/config.js 可能在某些环境不存在（例如仅拷贝了 config.example.js）
  // 为保证可运Fila，这里做容错Procesar
  // eslint-disable-next-line global-require
  config = require('../../config/config')
} catch (error) {
  config = {}
}

const parseBooleanEnv = (value) => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value !== 'string') {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
}

/**
 * 是否允许Ejecutar"余额脚本"（Seguridad开关）
 * ⚠️ SeguridadAdvertencia：vmMódulo非Seguridad沙箱，PredeterminadoDeshabilitar。如需Habilitar请显式Establecer BALANCE_SCRIPT_ENABLED=true
 * 仅在完全信任管理员且了解RCE风险时才Habilitar此功能
 */
const isBalanceScriptEnabled = () => {
  if (
    process.env.BALANCE_SCRIPT_ENABLED !== undefined &&
    process.env.BALANCE_SCRIPT_ENABLED !== ''
  ) {
    return parseBooleanEnv(process.env.BALANCE_SCRIPT_ENABLED)
  }

  const fromConfig =
    config?.accountBalance?.enableBalanceScript ??
    config?.features?.balanceScriptEnabled ??
    config?.security?.enableBalanceScript

  // PredeterminadoDeshabilitar，需显式Habilitar
  return typeof fromConfig === 'boolean' ? fromConfig : false
}

module.exports = {
  isBalanceScriptEnabled
}
