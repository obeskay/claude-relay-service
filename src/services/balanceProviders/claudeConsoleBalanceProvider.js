const BaseBalanceProvider = require('./baseBalanceProvider')

class ClaudeConsoleBalanceProvider extends BaseBalanceProvider {
  constructor() {
    super('claude-console')
  }

  async queryBalance(account) {
    this.logger.debug(`Consulta Claude Console 余额（Campo）: ${account?.id}`)
    return this.readQuotaFromFields(account)
  }
}

module.exports = ClaudeConsoleBalanceProvider
