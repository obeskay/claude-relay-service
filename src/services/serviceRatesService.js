/**
 * Servicio倍率ConfiguraciónServicio
 * 管理不同Servicio的消费倍率，以 Claude 为基准（倍率 1.0）
 * 用于聚合 Key 的虚拟额度Calcular
 */
const redis = require('../models/redis')
const logger = require('../utils/logger')

class ServiceRatesService {
  constructor() {
    this.CONFIG_KEY = 'system:service_rates'
    this.cachedRates = null
    this.cacheExpiry = 0
    this.CACHE_TTL = 60 * 1000 // 1分钟Caché
  }

  /**
   * ObtenerPredeterminado倍率Configuración
   */
  getDefaultRates() {
    return {
      baseService: 'claude',
      rates: {
        claude: 1.0, // 基准：1 USD = 1 CC额度
        codex: 1.0,
        gemini: 1.0,
        droid: 1.0,
        bedrock: 1.0,
        azure: 1.0,
        ccr: 1.0
      },
      updatedAt: null,
      updatedBy: null
    }
  }

  /**
   * Obtener倍率Configuración（带Caché）
   */
  async getRates() {
    try {
      // VerificarCaché
      if (this.cachedRates && Date.now() < this.cacheExpiry) {
        return this.cachedRates
      }

      const configStr = await redis.client.get(this.CONFIG_KEY)
      if (!configStr) {
        const defaultRates = this.getDefaultRates()
        this.cachedRates = defaultRates
        this.cacheExpiry = Date.now() + this.CACHE_TTL
        return defaultRates
      }

      const storedConfig = JSON.parse(configStr)
      // 合并PredeterminadoValor，确保Nueva característicaServicio有Predeterminado倍率
      const defaultRates = this.getDefaultRates()
      storedConfig.rates = {
        ...defaultRates.rates,
        ...storedConfig.rates
      }

      this.cachedRates = storedConfig
      this.cacheExpiry = Date.now() + this.CACHE_TTL
      return storedConfig
    } catch (error) {
      logger.error('ObtenerServicio倍率ConfiguraciónFalló:', error)
      return this.getDefaultRates()
    }
  }

  /**
   * 保存倍率Configuración
   */
  async saveRates(config, updatedBy = 'admin') {
    try {
      const defaultRates = this.getDefaultRates()

      // ValidarConfiguración
      this.validateRates(config)

      const newConfig = {
        baseService: config.baseService || defaultRates.baseService,
        rates: {
          ...defaultRates.rates,
          ...config.rates
        },
        updatedAt: new Date().toISOString(),
        updatedBy
      }

      await redis.client.set(this.CONFIG_KEY, JSON.stringify(newConfig))

      // 清除Caché
      this.cachedRates = null
      this.cacheExpiry = 0

      logger.info(`✅ Servicio倍率Configuración已Actualizar by ${updatedBy}`)
      return newConfig
    } catch (error) {
      logger.error('保存Servicio倍率ConfiguraciónFalló:', error)
      throw error
    }
  }

  /**
   * Validar倍率Configuración
   */
  validateRates(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('无效的ConfiguraciónFormato')
    }

    if (config.rates) {
      for (const [service, rate] of Object.entries(config.rates)) {
        if (typeof rate !== 'number' || rate <= 0) {
          throw new Error(`Servicio ${service} 的倍率必须是正数`)
        }
      }
    }
  }

  /**
   * Obtener单个Servicio的倍率
   */
  async getServiceRate(service) {
    const config = await this.getRates()
    return config.rates[service] || 1.0
  }

  /**
   * Calcular消费的 CC 额度
   * @param {number} costUSD - 真实成本（USD）
   * @param {string} service - ServicioTipo
   * @returns {number} CC 额度消耗
   */
  async calculateQuotaConsumption(costUSD, service) {
    const rate = await this.getServiceRate(service)
    return costUSD * rate
  }

  /**
   * 根据模型NombreObtenerServicioTipo
   */
  getServiceFromModel(model) {
    if (!model) {
      return 'claude'
    }

    const modelLower = model.toLowerCase()

    // Claude 系Columna
    if (
      modelLower.includes('claude') ||
      modelLower.includes('anthropic') ||
      modelLower.includes('opus') ||
      modelLower.includes('sonnet') ||
      modelLower.includes('haiku')
    ) {
      return 'claude'
    }

    // OpenAI / Codex 系Columna
    if (
      modelLower.includes('gpt') ||
      modelLower.includes('o1') ||
      modelLower.includes('o3') ||
      modelLower.includes('o4') ||
      modelLower.includes('codex') ||
      modelLower.includes('davinci') ||
      modelLower.includes('curie') ||
      modelLower.includes('babbage') ||
      modelLower.includes('ada')
    ) {
      return 'codex'
    }

    // Gemini 系Columna
    if (
      modelLower.includes('gemini') ||
      modelLower.includes('palm') ||
      modelLower.includes('bard')
    ) {
      return 'gemini'
    }

    // Droid 系Columna
    if (modelLower.includes('droid') || modelLower.includes('factory')) {
      return 'droid'
    }

    // Bedrock 系Columna（通常带有 aws 或特定前缀）
    if (
      modelLower.includes('bedrock') ||
      modelLower.includes('amazon') ||
      modelLower.includes('titan')
    ) {
      return 'bedrock'
    }

    // Azure 系Columna
    if (modelLower.includes('azure')) {
      return 'azure'
    }

    // PredeterminadoRetornar claude
    return 'claude'
  }

  /**
   * 根据CuentaTipoObtenerServicioTipo（优先级高于模型推断）
   */
  getServiceFromAccountType(accountType) {
    if (!accountType) {
      return null
    }

    const mapping = {
      claude: 'claude',
      'claude-official': 'claude',
      'claude-console': 'claude',
      ccr: 'ccr',
      bedrock: 'bedrock',
      gemini: 'gemini',
      'openai-responses': 'codex',
      openai: 'codex',
      azure: 'azure',
      'azure-openai': 'azure',
      droid: 'droid'
    }

    return mapping[accountType] || null
  }

  /**
   * ObtenerServicioTipo（优先 accountType，后备 model）
   */
  getService(accountType, model) {
    return this.getServiceFromAccountType(accountType) || this.getServiceFromModel(model)
  }

  /**
   * Obtener所有Soportar的ServicioColumnaTabla
   */
  async getAvailableServices() {
    const config = await this.getRates()
    return Object.keys(config.rates)
  }

  /**
   * 清除Caché（用于Probar或强制刷新）
   */
  clearCache() {
    this.cachedRates = null
    this.cacheExpiry = 0
  }
}

module.exports = new ServiceRatesService()
