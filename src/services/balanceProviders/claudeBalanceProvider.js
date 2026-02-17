const BaseBalanceProvider = require('./baseBalanceProvider')
const claudeAccountService = require('../claudeAccountService')

class ClaudeBalanceProvider extends BaseBalanceProvider {
  constructor() {
    super('claude')
  }

  /**
   * Claude（OAuth）：优先尝试Obtener OAuth usage（用于Cuota/使用Información），不强Fila提供余额金额
   */
  async queryBalance(account) {
    this.logger.debug(`Consulta Claude 余额（OAuth usage）: ${account?.id}`)

    // 仅 OAuth Cuenta可用；Falló时Degradación
    const usageData = await claudeAccountService.fetchOAuthUsage(account.id).catch(() => null)
    if (!usageData) {
      return { balance: null, currency: 'USD', queryMethod: 'local' }
    }

    return {
      balance: null,
      currency: 'USD',
      queryMethod: 'api',
      rawData: usageData
    }
  }
}

module.exports = ClaudeBalanceProvider
