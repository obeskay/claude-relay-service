const pricingService = require('../services/pricingService')

// Claude模型价格Configuración (USD per 1M tokens) - 备用定价
const MODEL_PRICING = {
  // Claude 3.5 Sonnet
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3
  },
  'claude-sonnet-4-20250514': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3
  },
  'claude-sonnet-4-5-20250929': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3
  },

  // Claude 3.5 Haiku
  'claude-3-5-haiku-20241022': {
    input: 0.25,
    output: 1.25,
    cacheWrite: 0.3,
    cacheRead: 0.03
  },

  // Claude 3 Opus
  'claude-3-opus-20240229': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.5
  },

  // Claude Opus 4.1 (新模型)
  'claude-opus-4-1-20250805': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.5
  },

  // Claude 3 Sonnet
  'claude-3-sonnet-20240229': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3
  },

  // Claude 3 Haiku
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
    cacheWrite: 0.3,
    cacheRead: 0.03
  },

  // Predeterminado定价（用于未知模型）
  unknown: {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3
  }
}

class CostCalculator {
  /**
   * Calcular单次Solicitud的费用
   * @param {Object} usage - 使用量Datos
   * @param {number} usage.input_tokens - 输入token数量
   * @param {number} usage.output_tokens - 输出token数量
   * @param {number} usage.cache_creation_input_tokens - CachéCreartoken数量
   * @param {number} usage.cache_read_input_tokens - CachéLeertoken数量
   * @param {string} model - 模型Nombre
   * @returns {Object} 费用详情
   */
  static calculateCost(usage, model = 'unknown') {
    // 如果 usage Incluir详细的 cache_creation Objeto或是 1M 模型，使用 pricingService 来Procesar
    if (
      (usage.cache_creation && typeof usage.cache_creation === 'object') ||
      (model && model.includes('[1m]'))
    ) {
      const result = pricingService.calculateCost(usage, model)
      // Convertir pricingService Retornar的Formato到 costCalculator 的Formato
      return {
        model,
        pricing: {
          input: result.pricing.input * 1000000, // Convertir为 per 1M tokens
          output: result.pricing.output * 1000000,
          cacheWrite: result.pricing.cacheCreate * 1000000,
          cacheRead: result.pricing.cacheRead * 1000000
        },
        usingDynamicPricing: true,
        isLongContextRequest: result.isLongContextRequest || false,
        usage: {
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cacheCreateTokens: usage.cache_creation_input_tokens || 0,
          cacheReadTokens: usage.cache_read_input_tokens || 0,
          totalTokens:
            (usage.input_tokens || 0) +
            (usage.output_tokens || 0) +
            (usage.cache_creation_input_tokens || 0) +
            (usage.cache_read_input_tokens || 0)
        },
        costs: {
          input: result.inputCost,
          output: result.outputCost,
          cacheWrite: result.cacheCreateCost,
          cacheRead: result.cacheReadCost,
          total: result.totalCost
        },
        formatted: {
          input: this.formatCost(result.inputCost),
          output: this.formatCost(result.outputCost),
          cacheWrite: this.formatCost(result.cacheCreateCost),
          cacheRead: this.formatCost(result.cacheReadCost),
          total: this.formatCost(result.totalCost)
        },
        debug: {
          isOpenAIModel: model.includes('gpt') || model.includes('o1'),
          hasCacheCreatePrice: !!result.pricing.cacheCreate,
          cacheCreateTokens: usage.cache_creation_input_tokens || 0,
          cacheWritePriceUsed: result.pricing.cacheCreate * 1000000,
          isLongContextModel: model && model.includes('[1m]'),
          isLongContextRequest: result.isLongContextRequest || false
        }
      }
    }

    // 否则使用旧的逻辑（向后兼容）
    const inputTokens = usage.input_tokens || 0
    const outputTokens = usage.output_tokens || 0
    const cacheCreateTokens = usage.cache_creation_input_tokens || 0
    const cacheReadTokens = usage.cache_read_input_tokens || 0

    // 优先使用动态价格Servicio
    const pricingData = pricingService.getModelPricing(model)
    let pricing
    let usingDynamicPricing = false

    if (pricingData) {
      // Convertir动态价格Formato为内部Formato
      const inputPrice = (pricingData.input_cost_per_token || 0) * 1000000 // Convertir为per 1M tokens
      const outputPrice = (pricingData.output_cost_per_token || 0) * 1000000
      const cacheReadPrice = (pricingData.cache_read_input_token_cost || 0) * 1000000

      // OpenAI 模型的特殊Procesar：
      // - 如果没有 cache_creation_input_token_cost，CachéCrear按普通 input 价格计费
      // - Claude 模型有专门的 cache_creation_input_token_cost
      let cacheWritePrice = (pricingData.cache_creation_input_token_cost || 0) * 1000000

      // 检测是否为 OpenAI 模型（通过模型名或 litellm_provider）
      const isOpenAIModel =
        model.includes('gpt') || model.includes('o1') || pricingData.litellm_provider === 'openai'

      if (isOpenAIModel && !pricingData.cache_creation_input_token_cost && cacheCreateTokens > 0) {
        // OpenAI 模型：CachéCrear按普通 input 价格计费
        cacheWritePrice = inputPrice
      }

      pricing = {
        input: inputPrice,
        output: outputPrice,
        cacheWrite: cacheWritePrice,
        cacheRead: cacheReadPrice
      }
      usingDynamicPricing = true
    } else {
      // Retirada到静态价格
      pricing = MODEL_PRICING[model] || MODEL_PRICING['unknown']
    }

    // Calcular各Tipotoken的费用 (USD)
    const inputCost = (inputTokens / 1000000) * pricing.input
    const outputCost = (outputTokens / 1000000) * pricing.output
    const cacheWriteCost = (cacheCreateTokens / 1000000) * pricing.cacheWrite
    const cacheReadCost = (cacheReadTokens / 1000000) * pricing.cacheRead

    const totalCost = inputCost + outputCost + cacheWriteCost + cacheReadCost

    return {
      model,
      pricing,
      usingDynamicPricing,
      usage: {
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        totalTokens: inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens
      },
      costs: {
        input: inputCost,
        output: outputCost,
        cacheWrite: cacheWriteCost,
        cacheRead: cacheReadCost,
        total: totalCost
      },
      // Formato化的费用Cadena
      formatted: {
        input: this.formatCost(inputCost),
        output: this.formatCost(outputCost),
        cacheWrite: this.formatCost(cacheWriteCost),
        cacheRead: this.formatCost(cacheReadCost),
        total: this.formatCost(totalCost)
      },
      // 添加DepurarInformación
      debug: {
        isOpenAIModel: model.includes('gpt') || model.includes('o1'),
        hasCacheCreatePrice: !!pricingData?.cache_creation_input_token_cost,
        cacheCreateTokens,
        cacheWritePriceUsed: pricing.cacheWrite
      }
    }
  }

  /**
   * Calcular聚合使用量的费用
   * @param {Object} aggregatedUsage - 聚合使用量Datos
   * @param {string} model - 模型Nombre
   * @returns {Object} 费用详情
   */
  static calculateAggregatedCost(aggregatedUsage, model = 'unknown') {
    const usage = {
      input_tokens: aggregatedUsage.inputTokens || aggregatedUsage.totalInputTokens || 0,
      output_tokens: aggregatedUsage.outputTokens || aggregatedUsage.totalOutputTokens || 0,
      cache_creation_input_tokens:
        aggregatedUsage.cacheCreateTokens || aggregatedUsage.totalCacheCreateTokens || 0,
      cache_read_input_tokens:
        aggregatedUsage.cacheReadTokens || aggregatedUsage.totalCacheReadTokens || 0
    }

    return this.calculateCost(usage, model)
  }

  /**
   * Obtener模型定价Información
   * @param {string} model - 模型Nombre
   * @returns {Object} 定价Información
   */
  static getModelPricing(model = 'unknown') {
    // 特殊Procesar：gpt-5-codex Retirada到 gpt-5（如果没有专门定价）
    if (model === 'gpt-5-codex' && !MODEL_PRICING['gpt-5-codex']) {
      const gpt5Pricing = MODEL_PRICING['gpt-5']
      if (gpt5Pricing) {
        console.log(`Using gpt-5 pricing as fallback for ${model}`)
        return gpt5Pricing
      }
    }
    return MODEL_PRICING[model] || MODEL_PRICING['unknown']
  }

  /**
   * Obtener所有Soportar的模型和定价
   * @returns {Object} 所有模型定价
   */
  static getAllModelPricing() {
    return { ...MODEL_PRICING }
  }

  /**
   * Validar模型是否Soportar
   * @param {string} model - 模型Nombre
   * @returns {boolean} 是否Soportar
   */
  static isModelSupported(model) {
    return !!MODEL_PRICING[model]
  }

  /**
   * Formato化费用显示
   * @param {number} cost - 费用金额
   * @param {number} decimals - 小数位数
   * @returns {string} Formato化的费用Cadena
   */
  static formatCost(cost, decimals = 6) {
    if (cost >= 1) {
      return `$${cost.toFixed(2)}`
    } else if (cost >= 0.001) {
      return `$${cost.toFixed(4)}`
    } else {
      return `$${cost.toFixed(decimals)}`
    }
  }

  /**
   * Calcular费用节省（使用Caché的节省）
   * @param {Object} usage - 使用量Datos
   * @param {string} model - 模型Nombre
   * @returns {Object} 节省Información
   */
  static calculateCacheSavings(usage, model = 'unknown') {
    const pricing = this.getModelPricing(model) // 已Incluir gpt-5-codex Retirada逻辑
    const cacheReadTokens = usage.cache_read_input_tokens || 0

    // 如果这些token不使用Caché，需要按正常input价格计费
    const normalCost = (cacheReadTokens / 1000000) * pricing.input
    const cacheCost = (cacheReadTokens / 1000000) * pricing.cacheRead
    const savings = normalCost - cacheCost
    const savingsPercentage = normalCost > 0 ? (savings / normalCost) * 100 : 0

    return {
      normalCost,
      cacheCost,
      savings,
      savingsPercentage,
      formatted: {
        normalCost: this.formatCost(normalCost),
        cacheCost: this.formatCost(cacheCost),
        savings: this.formatCost(savings),
        savingsPercentage: `${savingsPercentage.toFixed(1)}%`
      }
    }
  }
}

module.exports = CostCalculator
