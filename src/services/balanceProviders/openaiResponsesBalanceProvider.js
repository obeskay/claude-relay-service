const BaseBalanceProvider = require('./baseBalanceProvider')

class OpenAIResponsesBalanceProvider extends BaseBalanceProvider {
  constructor() {
    super('openai-responses')
  }

  /**
   * OpenAI-Responses：
   * - 优先使用 dailyQuota Campo（如果Configuración了额度）
   * - Opcional：尝试调用兼容 API（不同Servicio商实现不一，Falló自动Degradación）
   */
  async queryBalance(account) {
    this.logger.debug(`Consulta OpenAI Responses 余额: ${account?.id}`)

    // Configuración了额度时直接Retornar（Campo法）
    if (account?.dailyQuota && Number(account.dailyQuota) > 0) {
      return this.readQuotaFromFields(account)
    }

    // 尝试调用 usage Interfaz（兼容性不保证）
    if (account?.apiKey && account?.baseApi) {
      const baseApi = String(account.baseApi).replace(/\/$/, '')
      const response = await this.makeRequest(
        `${baseApi}/v1/usage`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${account.apiKey}`,
            'Content-Type': 'application/json'
          }
        },
        account
      )

      if (response.success) {
        return {
          balance: null,
          currency: this.parseCurrency(response.data),
          queryMethod: 'api',
          rawData: response.data
        }
      }
    }

    return {
      balance: null,
      currency: 'USD',
      queryMethod: 'local'
    }
  }
}

module.exports = OpenAIResponsesBalanceProvider
