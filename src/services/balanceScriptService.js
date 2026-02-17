const vm = require('vm')
const axios = require('axios')
const { isBalanceScriptEnabled } = require('../utils/featureFlags')

/**
 * SSRF防护：VerificarURL是否访问内网或敏感地址
 * @param {string} url - 要Verificar的URL
 * @returns {boolean} - trueTabla示URLSeguridad
 */
function isUrlSafe(url) {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // 禁止的Protocolo
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }

    // 禁止访问localhost和私有IP
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // AWS metadata
      /^0\./, // 0.0.0.0
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
      /\.local$/i,
      /\.internal$/i,
      /\.localhost$/i
    ]

    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}

/**
 * 可Configuración脚本余额ConsultaEjecutar器
 * - 脚本Formato：({ request: {...}, extractor: function(response){...} })
 * - Plantilla变量：{{baseUrl}}, {{apiKey}}, {{token}}, {{accountId}}, {{platform}}, {{extra}}
 */
class BalanceScriptService {
  /**
   * Ejecutar脚本：Retornar标准余额结构 + 原始Respuesta
   * @param {object} options
   *  - scriptBody: string
   *  - variables: Record<string,string>
   *  - timeoutSeconds: number
   */
  async execute(options = {}) {
    if (!isBalanceScriptEnabled()) {
      const error = new Error(
        '余额脚本功能已Deshabilitar（可通过 BALANCE_SCRIPT_ENABLED=true Habilitar）'
      )
      error.code = 'BALANCE_SCRIPT_DISABLED'
      throw error
    }

    const scriptBody = options.scriptBody?.trim()
    if (!scriptBody) {
      throw new Error('脚本内容为空')
    }

    const timeoutMs = Math.max(1, (options.timeoutSeconds || 10) * 1000)
    const sandbox = {
      console,
      Math,
      Date
    }

    let scriptResult
    try {
      const wrapped = scriptBody.startsWith('(') ? scriptBody : `(${scriptBody})`
      const script = new vm.Script(wrapped)
      scriptResult = script.runInNewContext(sandbox, { timeout: timeoutMs })
    } catch (error) {
      throw new Error(`脚本AnalizarFalló: ${error.message}`)
    }

    if (!scriptResult || typeof scriptResult !== 'object') {
      throw new Error('脚本RetornarFormato无效（需Retornar { request, extractor }）')
    }

    const variables = options.variables || {}
    const request = this.applyTemplates(scriptResult.request || {}, variables)
    const { extractor } = scriptResult

    if (!request?.url || typeof request.url !== 'string') {
      throw new Error('脚本 request.url 不能为空')
    }

    // SSRF防护：ValidarURLSeguridad性
    if (!isUrlSafe(request.url)) {
      throw new Error(
        '脚本 request.url 不Seguridad：禁止访问内网地址、localhost或使用非HTTP(S)Protocolo'
      )
    }

    if (typeof extractor !== 'function') {
      throw new Error('脚本 extractor 必须是Función')
    }

    const axiosConfig = {
      url: request.url,
      method: (request.method || 'GET').toUpperCase(),
      headers: request.headers || {},
      timeout: timeoutMs
    }

    if (request.params) {
      axiosConfig.params = request.params
    }
    if (request.body || request.data) {
      axiosConfig.data = request.body || request.data
    }

    let httpResponse
    try {
      httpResponse = await axios(axiosConfig)
    } catch (error) {
      const { response } = error || {}
      const { status, data } = response || {}
      throw new Error(
        `SolicitudFalló: ${status || ''} ${error.message}${data ? ` | ${JSON.stringify(data)}` : ''}`
      )
    }

    const responseData = httpResponse?.data

    let extracted = {}
    try {
      extracted = extractor(responseData) || {}
    } catch (error) {
      throw new Error(`extractor EjecutarFalló: ${error.message}`)
    }

    const mapped = this.mapExtractorResult(extracted, responseData)
    return {
      mapped,
      extracted,
      response: {
        status: httpResponse?.status,
        headers: httpResponse?.headers,
        data: responseData
      }
    }
  }

  applyTemplates(value, variables) {
    if (typeof value === 'string') {
      return value.replace(/{{(\w+)}}/g, (_, key) => {
        const trimmed = key.trim()
        return variables[trimmed] !== undefined ? String(variables[trimmed]) : ''
      })
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.applyTemplates(item, variables))
    }
    if (value && typeof value === 'object') {
      const result = {}
      Object.keys(value).forEach((k) => {
        result[k] = this.applyTemplates(value[k], variables)
      })
      return result
    }
    return value
  }

  mapExtractorResult(result = {}, responseData) {
    const isValid = result.isValid !== false
    const remaining = Number(result.remaining)
    const total = Number(result.total)
    const used = Number(result.used)
    const currency = result.unit || 'USD'

    const quota =
      Number.isFinite(total) || Number.isFinite(used)
        ? {
            total: Number.isFinite(total) ? total : null,
            used: Number.isFinite(used) ? used : null,
            remaining: Number.isFinite(remaining) ? remaining : null,
            percentage:
              Number.isFinite(total) && total > 0 && Number.isFinite(used)
                ? (used / total) * 100
                : null
          }
        : null

    return {
      status: isValid ? 'success' : 'error',
      errorMessage: isValid ? '' : result.invalidMessage || '套餐无效',
      balance: Number.isFinite(remaining) ? remaining : null,
      currency,
      quota,
      planName: result.planName || null,
      extra: result.extra || null,
      rawData: responseData || result.raw
    }
  }
}

module.exports = new BalanceScriptService()
