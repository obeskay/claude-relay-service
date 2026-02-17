const axios = require('axios')
const logger = require('../../utils/logger')
const ProxyHelper = require('../../utils/proxyHelper')

/**
 * Provider Abstracción基Clase
 * 各平台 Provider 需Herencia并实现 queryBalance(account)
 */
class BaseBalanceProvider {
  constructor(platform) {
    this.platform = platform
    this.logger = logger
  }

  /**
   * Consulta余额（AbstracciónMétodo）
   * @param {object} account - CuentaObjeto
   * @returns {Promise<object>}
   * 形如：
   * {
   *   balance: number|null,
   *   currency?: string,
   *   quota?: { daily, used, remaining, resetAt, percentage, unlimited? },
   *   queryMethod?: 'api'|'field'|'local',
   *   rawData?: any
   * }
   */
  async queryBalance(_account) {
    throw new Error('queryBalance Método必须由子Clase实现')
  }

  /**
   * 通用 HTTP SolicitudMétodo（SoportarProxy）
   * @param {string} url
   * @param {object} options
   * @param {object} account
   */
  async makeRequest(url, options = {}, account = {}) {
    const config = {
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 15000,
      data: options.data,
      params: options.params,
      responseType: options.responseType
    }

    const proxyConfig = account.proxyConfig || account.proxy
    if (proxyConfig) {
      const agent = ProxyHelper.createProxyAgent(proxyConfig)
      if (agent) {
        config.httpAgent = agent
        config.httpsAgent = agent
        config.proxy = false
      }
    }

    try {
      const response = await axios(config)
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers
      }
    } catch (error) {
      const status = error.response?.status
      const message = error.response?.data?.message || error.message || 'SolicitudFalló'
      this.logger.debug(`余额 Provider HTTP SolicitudFalló: ${url} (${this.platform})`, {
        status,
        message
      })
      return { success: false, status, error: message }
    }
  }

  /**
   * 从CuentaCampoLeer dailyQuota / dailyUsage（通用Degradación方案）
   * 注意：部分平台 dailyUsage Campo可能不是实时Valor，最终以 AccountBalanceService 的本地Estadística为准
   */
  readQuotaFromFields(account) {
    const dailyQuota = Number(account?.dailyQuota || 0)
    const dailyUsage = Number(account?.dailyUsage || 0)

    // 无Límite
    if (!Number.isFinite(dailyQuota) || dailyQuota <= 0) {
      return {
        balance: null,
        currency: 'USD',
        quota: {
          daily: Infinity,
          used: Number.isFinite(dailyUsage) ? dailyUsage : 0,
          remaining: Infinity,
          percentage: 0,
          unlimited: true
        },
        queryMethod: 'field'
      }
    }

    const used = Number.isFinite(dailyUsage) ? dailyUsage : 0
    const remaining = Math.max(0, dailyQuota - used)
    const percentage = dailyQuota > 0 ? (used / dailyQuota) * 100 : 0

    return {
      balance: remaining,
      currency: 'USD',
      quota: {
        daily: dailyQuota,
        used,
        remaining,
        percentage: Math.round(percentage * 100) / 100
      },
      queryMethod: 'field'
    }
  }

  parseCurrency(data) {
    return data?.currency || data?.Currency || 'USD'
  }

  async safeExecute(fn, fallbackValue = null) {
    try {
      return await fn()
    } catch (error) {
      this.logger.error(`余额 Provider EjecutarFalló: ${this.platform}`, error)
      return fallbackValue
    }
  }
}

module.exports = BaseBalanceProvider
