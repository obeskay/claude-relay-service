const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const config = require('../../config/config')
const redis = require('../models/redis')
const logger = require('../utils/logger')
const serviceRatesService = require('./serviceRatesService')
const { isOpusModel } = require('../utils/modelHelper')

const ACCOUNT_TYPE_CONFIG = {
  claude: { prefix: 'claude:account:' },
  'claude-console': { prefix: 'claude_console_account:' },
  openai: { prefix: 'openai:account:' },
  'openai-responses': { prefix: 'openai_responses_account:' },
  'azure-openai': { prefix: 'azure_openai:account:' },
  gemini: { prefix: 'gemini_account:' },
  'gemini-api': { prefix: 'gemini_api_account:' },
  droid: { prefix: 'droid:account:' }
}

const ACCOUNT_TYPE_PRIORITY = [
  'openai',
  'openai-responses',
  'azure-openai',
  'claude',
  'claude-console',
  'gemini',
  'gemini-api',
  'droid'
]

const ACCOUNT_CATEGORY_MAP = {
  claude: 'claude',
  'claude-console': 'claude',
  openai: 'openai',
  'openai-responses': 'openai',
  'azure-openai': 'openai',
  gemini: 'gemini',
  'gemini-api': 'gemini',
  droid: 'droid'
}

/**
 * 规范化PermisoDatos，兼容旧Formato（Cadena）和新Formato（Arreglo）
 * @param {string|array} permissions - PermisoDatos
 * @returns {array} - PermisoArreglo，空ArregloTabla示全部Servicio
 */
function normalizePermissions(permissions) {
  if (!permissions) {
    return [] // 空 = 全部Servicio
  }
  if (Array.isArray(permissions)) {
    return permissions
  }
  // 尝试Analizar JSON Cadena（新Formato存储）
  if (typeof permissions === 'string') {
    if (permissions.startsWith('[')) {
      try {
        const parsed = JSON.parse(permissions)
        if (Array.isArray(parsed)) {
          return parsed
        }
      } catch (e) {
        // AnalizarFalló，继续Procesar为普通Cadena
      }
    }
    // 旧Formato 'all' 转为空Arreglo
    if (permissions === 'all') {
      return []
    }
    // 兼容逗号分隔Formato（Corrección历史ErrorDatos，如 "claude,openai"）
    if (permissions.includes(',')) {
      return permissions
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    }
    // 旧单个Cadena转为Arreglo
    return [permissions]
  }
  return []
}

/**
 * Verificar是否有访问特定Servicio的Permiso
 * @param {string|array} permissions - PermisoDatos
 * @param {string} service - ServicioNombre（claude/gemini/openai/droid）
 * @returns {boolean} - 是否有Permiso
 */
function hasPermission(permissions, service) {
  const perms = normalizePermissions(permissions)
  return perms.length === 0 || perms.includes(service) // 空Arreglo = 全部Servicio
}

function normalizeAccountTypeKey(type) {
  if (!type) {
    return null
  }
  const lower = String(type).toLowerCase()
  if (lower === 'claude_console') {
    return 'claude-console'
  }
  if (lower === 'openai_responses' || lower === 'openai-response' || lower === 'openai-responses') {
    return 'openai-responses'
  }
  if (lower === 'azure_openai' || lower === 'azureopenai' || lower === 'azure-openai') {
    return 'azure-openai'
  }
  if (lower === 'gemini_api' || lower === 'gemini-api') {
    return 'gemini-api'
  }
  return lower
}

function sanitizeAccountIdForType(accountId, accountType) {
  if (!accountId || typeof accountId !== 'string') {
    return accountId
  }
  if (accountType === 'openai-responses') {
    return accountId.replace(/^responses:/, '')
  }
  if (accountType === 'gemini-api') {
    return accountId.replace(/^api:/, '')
  }
  return accountId
}

class ApiKeyService {
  constructor() {
    this.prefix = config.security.apiKeyPrefix
  }

  // 🔑 Generar新的API Key
  async generateApiKey(options = {}) {
    const {
      name = 'Unnamed Key',
      description = '',
      tokenLimit = 0, // Predeterminado为0，不再使用tokenLímite
      expiresAt = null,
      claudeAccountId = null,
      claudeConsoleAccountId = null,
      geminiAccountId = null,
      openaiAccountId = null,
      azureOpenaiAccountId = null,
      bedrockAccountId = null, // 添加 Bedrock cuentaIDSoportar
      droidAccountId = null,
      permissions = [], // ArregloFormato，空ArregloTabla示全部Servicio，如 ['claude', 'gemini']
      isActive = true,
      concurrencyLimit = 0,
      rateLimitWindow = null,
      rateLimitRequests = null,
      rateLimitCost = null, // Nueva característica：速率Límite费用Campo
      enableModelRestriction = false,
      restrictedModels = [],
      enableClientRestriction = false,
      allowedClients = [],
      dailyCostLimit = 0,
      totalCostLimit = 0,
      weeklyOpusCostLimit = 0,
      forcedModel = '',
      modelMapping = {},
      tags = [],
      activationDays = 0,
      activationUnit = 'days', // Nueva característica：激活Tiempo单位 'hours' 或 'days'
      expirationMode = 'fixed', // Nueva característica：过期模式 'fixed'(固定Tiempo) 或 'activation'(首次使用后激活)
      icon = '', // Nueva característica：图标（base64Codificación）
      serviceRates = {} // API Key 级别Servicio倍率覆盖
    } = options

    // Generar简单的API Key (64字符十六进制)
    const apiKey = `${this.prefix}${this._generateSecretKey()}`
    const keyId = uuidv4()
    const hashedKey = this._hashApiKey(apiKey)

    // Procesar permissions
    const _permissionsValue = permissions

    const keyData = {
      id: keyId,
      name,
      description,
      apiKey: hashedKey,
      tokenLimit: String(tokenLimit ?? 0),
      concurrencyLimit: String(concurrencyLimit ?? 0),
      rateLimitWindow: String(rateLimitWindow ?? 0),
      rateLimitRequests: String(rateLimitRequests ?? 0),
      rateLimitCost: String(rateLimitCost ?? 0), // Nueva característica：速率Límite费用Campo
      isActive: String(isActive),
      claudeAccountId: claudeAccountId || '',
      claudeConsoleAccountId: claudeConsoleAccountId || '',
      geminiAccountId: geminiAccountId || '',
      openaiAccountId: openaiAccountId || '',
      azureOpenaiAccountId: azureOpenaiAccountId || '',
      bedrockAccountId: bedrockAccountId || '', // 添加 Bedrock cuentaID
      droidAccountId: droidAccountId || '',
      permissions: JSON.stringify(normalizePermissions(permissions)),
      enableModelRestriction: String(enableModelRestriction),
      restrictedModels: JSON.stringify(restrictedModels || []),
      enableClientRestriction: String(enableClientRestriction || false),
      allowedClients: JSON.stringify(allowedClients || []),
      dailyCostLimit: String(dailyCostLimit || 0),
      totalCostLimit: String(totalCostLimit || 0),
      weeklyOpusCostLimit: String(weeklyOpusCostLimit || 0),
      forcedModel: forcedModel || '',
      modelMapping: JSON.stringify(modelMapping || {}),
      tags: JSON.stringify(tags || []),
      activationDays: String(activationDays || 0), // Nueva característica：激活后有效天数
      activationUnit: activationUnit || 'days', // Nueva característica：激活Tiempo单位
      expirationMode: expirationMode || 'fixed', // Nueva característica：过期模式
      isActivated: expirationMode === 'fixed' ? 'true' : 'false', // 根据模式决定激活状态
      activatedAt: expirationMode === 'fixed' ? new Date().toISOString() : '', // 激活Tiempo
      createdAt: new Date().toISOString(),
      lastUsedAt: '',
      expiresAt: expirationMode === 'fixed' ? expiresAt || '' : '', // 固定模式才Establecer过期Tiempo
      createdBy: options.createdBy || 'admin',
      userId: options.userId || '',
      userUsername: options.userUsername || '',
      icon: icon || '', // Nueva característica：图标（base64Codificación）
      serviceRates: JSON.stringify(serviceRates || {}) // API Key 级别Servicio倍率
    }

    // 保存API KeyDatos并建立哈希映射
    await redis.setApiKey(keyId, keyData, hashedKey)

    // Sincronización添加到费用OrdenarÍndice
    try {
      const costRankService = require('./costRankService')
      await costRankService.addKeyToIndexes(keyId)
    } catch (err) {
      logger.warn(`Failed to add key ${keyId} to cost rank indexes:`, err.message)
    }

    // Sincronización添加到 API Key Índice（用于分页ConsultaOptimización）
    try {
      const apiKeyIndexService = require('./apiKeyIndexService')
      await apiKeyIndexService.addToIndex({
        id: keyId,
        name: keyData.name,
        createdAt: keyData.createdAt,
        lastUsedAt: keyData.lastUsedAt,
        isActive: keyData.isActive === 'true',
        isDeleted: false,
        tags: JSON.parse(keyData.tags || '[]')
      })
    } catch (err) {
      logger.warn(`Failed to add key ${keyId} to API Key index:`, err.message)
    }

    logger.success(`🔑 Generated new API key: ${name} (${keyId})`)

    return {
      id: keyId,
      apiKey, // 只在Crear时Retornar完整的key
      name: keyData.name,
      description: keyData.description,
      tokenLimit: parseInt(keyData.tokenLimit),
      concurrencyLimit: parseInt(keyData.concurrencyLimit),
      rateLimitWindow: parseInt(keyData.rateLimitWindow || 0),
      rateLimitRequests: parseInt(keyData.rateLimitRequests || 0),
      rateLimitCost: parseFloat(keyData.rateLimitCost || 0), // Nueva característica：速率Límite费用Campo
      isActive: keyData.isActive === 'true',
      claudeAccountId: keyData.claudeAccountId,
      claudeConsoleAccountId: keyData.claudeConsoleAccountId,
      geminiAccountId: keyData.geminiAccountId,
      openaiAccountId: keyData.openaiAccountId,
      azureOpenaiAccountId: keyData.azureOpenaiAccountId,
      bedrockAccountId: keyData.bedrockAccountId, // 添加 Bedrock cuentaID
      droidAccountId: keyData.droidAccountId,
      permissions: normalizePermissions(keyData.permissions),
      enableModelRestriction: keyData.enableModelRestriction === 'true',
      restrictedModels: JSON.parse(keyData.restrictedModels),
      enableClientRestriction: keyData.enableClientRestriction === 'true',
      allowedClients: JSON.parse(keyData.allowedClients || '[]'),
      dailyCostLimit: parseFloat(keyData.dailyCostLimit || 0),
      totalCostLimit: parseFloat(keyData.totalCostLimit || 0),
      weeklyOpusCostLimit: parseFloat(keyData.weeklyOpusCostLimit || 0),
      forcedModel: keyData.forcedModel || '',
      modelMapping: keyData.modelMapping
        ? typeof keyData.modelMapping === 'string'
          ? JSON.parse(keyData.modelMapping)
          : keyData.modelMapping
        : {},
      tags: JSON.parse(keyData.tags || '[]'),
      activationDays: parseInt(keyData.activationDays || 0),
      activationUnit: keyData.activationUnit || 'days',
      expirationMode: keyData.expirationMode || 'fixed',
      isActivated: keyData.isActivated === 'true',
      activatedAt: keyData.activatedAt,
      createdAt: keyData.createdAt,
      expiresAt: keyData.expiresAt,
      createdBy: keyData.createdBy,
      serviceRates: JSON.parse(keyData.serviceRates || '{}') // API Key 级别Servicio倍率
    }
  }

  // 🔍 ValidarAPI Key
  async validateApiKey(apiKey) {
    try {
      if (!apiKey || !apiKey.startsWith(this.prefix)) {
        return { valid: false, error: 'Invalid API key format' }
      }

      // CalcularAPI Key的哈希Valor
      const hashedKey = this._hashApiKey(apiKey)

      // 通过哈希Valor直接查找API Key（RendimientoOptimización）
      const keyData = await redis.findApiKeyByHash(hashedKey)

      if (!keyData) {
        // ⚠️ Advertencia：Hash map lookup failed, possibly a race condition or corrupted hash map
        logger.warn(
          `⚠️ API key not found in hash map: ${hashedKey.substring(0, 16)}... (possible race condition or corrupted hash map)`
        )
        return { valid: false, error: 'API key not found' }
      }

      // Verificar是否激活
      if (keyData.isActive !== 'true') {
        return { valid: false, error: 'API key is disabled' }
      }

      // Procesar激活逻辑（仅在 activation 模式下）
      if (keyData.expirationMode === 'activation' && keyData.isActivated !== 'true') {
        // 首次使用，需要激活
        const now = new Date()
        const activationPeriod = parseInt(keyData.activationDays || 30) // Predeterminado30
        const activationUnit = keyData.activationUnit || 'days' // Predeterminado天

        // 根据单位Calcular过期Tiempo
        let milliseconds
        if (activationUnit === 'hours') {
          milliseconds = activationPeriod * 60 * 60 * 1000 // 小时转毫秒
        } else {
          milliseconds = activationPeriod * 24 * 60 * 60 * 1000 // 天转毫秒
        }

        const expiresAt = new Date(now.getTime() + milliseconds)

        // Actualizar激活状态和过期Tiempo
        keyData.isActivated = 'true'
        keyData.activatedAt = now.toISOString()
        keyData.expiresAt = expiresAt.toISOString()
        keyData.lastUsedAt = now.toISOString()

        // 保存到Redis
        await redis.setApiKey(keyData.id, keyData)

        logger.success(
          `🔓 API key activated: ${keyData.id} (${
            keyData.name
          }), will expire in ${activationPeriod} ${activationUnit} at ${expiresAt.toISOString()}`
        )
      }

      // Verificar是否过期
      if (keyData.expiresAt && new Date() > new Date(keyData.expiresAt)) {
        return { valid: false, error: 'API key has expired' }
      }

      // 如果API Key属于某个Usuario，VerificarUsuario是否被Deshabilitar
      if (keyData.userId) {
        try {
          const userService = require('./userService')
          const user = await userService.getUserById(keyData.userId, false)
          if (!user || !user.isActive) {
            return { valid: false, error: 'User account is disabled' }
          }
        } catch (error) {
          logger.error('❌ Error checking user status during API key validation:', error)
          return { valid: false, error: 'Unable to validate user status' }
        }
      }

      // 按需Obtener费用Estadística（仅在有Límite时Consulta，减少 Redis 调用）
      const dailyCostLimit = parseFloat(keyData.dailyCostLimit || 0)
      const totalCostLimit = parseFloat(keyData.totalCostLimit || 0)
      const weeklyOpusCostLimit = parseFloat(keyData.weeklyOpusCostLimit || 0)

      const costQueries = []
      if (dailyCostLimit > 0) {
        costQueries.push(redis.getDailyCost(keyData.id).then((v) => ({ dailyCost: v || 0 })))
      }
      if (totalCostLimit > 0) {
        costQueries.push(redis.getCostStats(keyData.id).then((v) => ({ totalCost: v?.total || 0 })))
      }
      if (weeklyOpusCostLimit > 0) {
        costQueries.push(
          redis.getWeeklyOpusCost(keyData.id).then((v) => ({ weeklyOpusCost: v || 0 }))
        )
      }

      const costData =
        costQueries.length > 0 ? Object.assign({}, ...(await Promise.all(costQueries))) : {}

      // Actualizar最后使用Tiempo（Optimización：只在实际API调用时Actualizar，而不是Validar时）
      // 注意：lastUsedAt的Actualizar已移至recordUsageMétodo中

      logger.api(`🔓 API key validated successfully: ${keyData.id}`)

      // AnalizarLímite模型Datos
      let restrictedModels = []
      try {
        restrictedModels = keyData.restrictedModels ? JSON.parse(keyData.restrictedModels) : []
      } catch (e) {
        restrictedModels = []
      }

      // Analizar允许的Cliente
      let allowedClients = []
      try {
        allowedClients = keyData.allowedClients ? JSON.parse(keyData.allowedClients) : []
      } catch (e) {
        allowedClients = []
      }

      // Analizar标签
      let tags = []
      try {
        tags = keyData.tags ? JSON.parse(keyData.tags) : []
      } catch (e) {
        tags = []
      }

      // Analizar serviceRates
      let serviceRates = {}
      try {
        serviceRates = keyData.serviceRates ? JSON.parse(keyData.serviceRates) : {}
      } catch (e) {
        // AnalizarFalló使用PredeterminadoValor
      }

      return {
        valid: true,
        keyData: {
          id: keyData.id,
          name: keyData.name,
          description: keyData.description,
          createdAt: keyData.createdAt,
          expiresAt: keyData.expiresAt,
          claudeAccountId: keyData.claudeAccountId,
          claudeConsoleAccountId: keyData.claudeConsoleAccountId,
          geminiAccountId: keyData.geminiAccountId,
          openaiAccountId: keyData.openaiAccountId,
          azureOpenaiAccountId: keyData.azureOpenaiAccountId,
          bedrockAccountId: keyData.bedrockAccountId, // 添加 Bedrock cuentaID
          droidAccountId: keyData.droidAccountId,
          permissions: normalizePermissions(keyData.permissions),
          tokenLimit: parseInt(keyData.tokenLimit),
          concurrencyLimit: parseInt(keyData.concurrencyLimit || 0),
          rateLimitWindow: parseInt(keyData.rateLimitWindow || 0),
          rateLimitRequests: parseInt(keyData.rateLimitRequests || 0),
          rateLimitCost: parseFloat(keyData.rateLimitCost || 0), // Nueva característica：速率Límite费用Campo
          enableModelRestriction: keyData.enableModelRestriction === 'true',
          restrictedModels,
          enableClientRestriction: keyData.enableClientRestriction === 'true',
          allowedClients,
          dailyCostLimit,
          totalCostLimit,
          weeklyOpusCostLimit,
          forcedModel: keyData.forcedModel || '', // Nueva característica：强制Ruta模型
          dailyCost: costData.dailyCost || 0,
          totalCost: costData.totalCost || 0,
          weeklyOpusCost: costData.weeklyOpusCost || 0,
          tags,
          serviceRates
        }
      }
    } catch (error) {
      logger.error('❌ API key validation error:', error)
      return { valid: false, error: 'Internal validation error' }
    }
  }

  // 🔍 ValidarAPI Key（仅用于EstadísticaConsulta，不触发激活）
  async validateApiKeyForStats(apiKey) {
    try {
      if (!apiKey || !apiKey.startsWith(this.prefix)) {
        return { valid: false, error: 'Invalid API key format' }
      }

      // CalcularAPI Key的哈希Valor
      const hashedKey = this._hashApiKey(apiKey)

      // 通过哈希Valor直接查找API Key（RendimientoOptimización）
      const keyData = await redis.findApiKeyByHash(hashedKey)

      if (!keyData) {
        return { valid: false, error: 'API key not found' }
      }

      // Verificar是否激活
      if (keyData.isActive !== 'true') {
        const keyName = keyData.name || 'Unknown'
        return { valid: false, error: `API Key "${keyName}" ha sido deshabilitada`, keyName }
      }

      // 注意：这里不Procesar激活逻辑，保持 API Key 的未激活状态

      // Verificar是否过期（仅对已激活的 Key Verificar）
      if (
        keyData.isActivated === 'true' &&
        keyData.expiresAt &&
        new Date() > new Date(keyData.expiresAt)
      ) {
        const keyName = keyData.name || 'Unknown'
        return { valid: false, error: `API Key "${keyName}" ha caducado`, keyName }
      }

      // 如果API Key属于某个Usuario，VerificarUsuario是否被Deshabilitar
      if (keyData.userId) {
        try {
          const userService = require('./userService')
          const user = await userService.getUserById(keyData.userId, false)
          if (!user || !user.isActive) {
            return { valid: false, error: 'User account is disabled' }
          }
        } catch (userError) {
          // 如果UsuarioServicio出错，Registro但不影响API KeyValidar
          logger.warn(`Failed to check user status for API key ${keyData.id}:`, userError)
        }
      }

      // Obtener当日费用
      const [dailyCost, costStats] = await Promise.all([
        redis.getDailyCost(keyData.id),
        redis.getCostStats(keyData.id)
      ])

      // Obtener使用Estadística
      const usage = await redis.getUsageStats(keyData.id)

      // AnalizarLímite模型Datos
      let restrictedModels = []
      try {
        restrictedModels = keyData.restrictedModels ? JSON.parse(keyData.restrictedModels) : []
      } catch (e) {
        restrictedModels = []
      }

      // Analizar允许的Cliente
      let allowedClients = []
      try {
        allowedClients = keyData.allowedClients ? JSON.parse(keyData.allowedClients) : []
      } catch (e) {
        allowedClients = []
      }

      // Analizar标签
      let tags = []
      try {
        tags = keyData.tags ? JSON.parse(keyData.tags) : []
      } catch (e) {
        tags = []
      }

      return {
        valid: true,
        keyData: {
          id: keyData.id,
          name: keyData.name,
          description: keyData.description,
          createdAt: keyData.createdAt,
          expiresAt: keyData.expiresAt,
          // 添加激活相关Campo
          expirationMode: keyData.expirationMode || 'fixed',
          isActivated: keyData.isActivated === 'true',
          activationDays: parseInt(keyData.activationDays || 0),
          activationUnit: keyData.activationUnit || 'days',
          activatedAt: keyData.activatedAt || null,
          claudeAccountId: keyData.claudeAccountId,
          claudeConsoleAccountId: keyData.claudeConsoleAccountId,
          geminiAccountId: keyData.geminiAccountId,
          openaiAccountId: keyData.openaiAccountId,
          azureOpenaiAccountId: keyData.azureOpenaiAccountId,
          bedrockAccountId: keyData.bedrockAccountId,
          droidAccountId: keyData.droidAccountId,
          permissions: normalizePermissions(keyData.permissions),
          tokenLimit: parseInt(keyData.tokenLimit),
          concurrencyLimit: parseInt(keyData.concurrencyLimit || 0),
          rateLimitWindow: parseInt(keyData.rateLimitWindow || 0),
          rateLimitRequests: parseInt(keyData.rateLimitRequests || 0),
          rateLimitCost: parseFloat(keyData.rateLimitCost || 0),
          enableModelRestriction: keyData.enableModelRestriction === 'true',
          restrictedModels,
          enableClientRestriction: keyData.enableClientRestriction === 'true',
          allowedClients,
          dailyCostLimit: parseFloat(keyData.dailyCostLimit || 0),
          totalCostLimit: parseFloat(keyData.totalCostLimit || 0),
          weeklyOpusCostLimit: parseFloat(keyData.weeklyOpusCostLimit || 0),
          forcedModel: keyData.forcedModel || '', // Nueva característica：强制Ruta模型
          dailyCost: dailyCost || 0,
          totalCost: costStats?.total || 0,
          weeklyOpusCost: (await redis.getWeeklyOpusCost(keyData.id)) || 0,
          tags,
          usage
        }
      }
    } catch (error) {
      logger.error('❌ API key validation error (stats):', error)
      return { valid: false, error: 'Internal validation error' }
    }
  }

  // 🏷️ Obtener所有标签（合并Índice和全局集合）
  async getAllTags() {
    const indexTags = await redis.scanAllApiKeyTags()
    const globalTags = await redis.getGlobalTags()
    // Filtrar空Valor和空格
    return [
      ...new Set([...indexTags, ...globalTags].map((t) => (t ? t.trim() : '')).filter((t) => t))
    ].sort()
  }

  // 🏷️ Crear新标签
  async createTag(tagName) {
    const existingTags = await this.getAllTags()
    if (existingTags.includes(tagName)) {
      return { success: false, error: '标签已存在' }
    }
    await redis.addTag(tagName)
    return { success: true }
  }

  // 🏷️ Obtener标签详情（含使用数量）
  async getTagsWithCount() {
    const apiKeys = await redis.getAllApiKeys()
    const tagCounts = new Map()

    // Estadística API Key 上的标签（trim 后Estadística）
    for (const key of apiKeys) {
      if (key.isDeleted === 'true') {
        continue
      }
      let tags = []
      try {
        const parsed = key.tags ? JSON.parse(key.tags) : []
        tags = Array.isArray(parsed) ? parsed : []
      } catch {
        tags = []
      }
      for (const tag of tags) {
        if (typeof tag === 'string') {
          const trimmed = tag.trim()
          if (trimmed) {
            tagCounts.set(trimmed, (tagCounts.get(trimmed) || 0) + 1)
          }
        }
      }
    }

    // 直接Obtener全局标签集合（避免重复扫描）
    const globalTags = await redis.getGlobalTags()
    for (const tag of globalTags) {
      const trimmed = tag ? tag.trim() : ''
      if (trimmed && !tagCounts.has(trimmed)) {
        tagCounts.set(trimmed, 0)
      }
    }

    return Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }

  // 🏷️ 从所有 API Key 中Eliminación指定标签
  async removeTagFromAllKeys(tagName) {
    const normalizedName = (tagName || '').trim()
    if (!normalizedName) {
      return { affectedCount: 0 }
    }

    const apiKeys = await redis.getAllApiKeys()
    let affectedCount = 0

    for (const key of apiKeys) {
      if (key.isDeleted === 'true') {
        continue
      }
      let tags = []
      try {
        const parsed = key.tags ? JSON.parse(key.tags) : []
        tags = Array.isArray(parsed) ? parsed : []
      } catch {
        tags = []
      }

      // 匹配时 trim 比较，Filtrar非Cadena
      const strTags = tags.filter((t) => typeof t === 'string')
      if (strTags.some((t) => t.trim() === normalizedName)) {
        const newTags = strTags.filter((t) => t.trim() !== normalizedName)
        await this.updateApiKey(key.id, { tags: newTags })
        affectedCount++
      }
    }

    // 同时从全局标签集合Eliminar
    await redis.removeTag(normalizedName)
    await redis.removeTag(tagName) // 也Eliminar原始Valor（可能带空格）

    return { affectedCount }
  }

  // 🏷️ 重命名标签
  async renameTag(oldName, newName) {
    if (!newName || !newName.trim()) {
      return { affectedCount: 0, error: '新标Firma不能为空' }
    }

    const normalizedOld = (oldName || '').trim()
    const normalizedNew = newName.trim()

    if (!normalizedOld) {
      return { affectedCount: 0, error: '旧标Firma不能为空' }
    }

    const apiKeys = await redis.getAllApiKeys()
    let affectedCount = 0
    let foundInKeys = false

    for (const key of apiKeys) {
      if (key.isDeleted === 'true') {
        continue
      }
      let tags = []
      try {
        const parsed = key.tags ? JSON.parse(key.tags) : []
        tags = Array.isArray(parsed) ? parsed : []
      } catch {
        tags = []
      }

      // 匹配时 trim 比较，Filtrar非Cadena
      const strTags = tags.filter((t) => typeof t === 'string')
      if (strTags.some((t) => t.trim() === normalizedOld)) {
        foundInKeys = true
        const newTags = [
          ...new Set(strTags.map((t) => (t.trim() === normalizedOld ? normalizedNew : t)))
        ]
        await this.updateApiKey(key.id, { tags: newTags })
        affectedCount++
      }
    }

    // Verificar全局集合是否有该标签
    const globalTags = await redis.getGlobalTags()
    const foundInGlobal = globalTags.some(
      (t) => typeof t === 'string' && t.trim() === normalizedOld
    )

    if (!foundInKeys && !foundInGlobal) {
      return { affectedCount: 0, error: '标签不存在' }
    }

    // 同时Actualizar全局标签集合（删旧加新）
    await redis.removeTag(normalizedOld)
    await redis.removeTag(oldName) // 也Eliminar原始Valor
    await redis.addTag(normalizedNew)

    return { affectedCount }
  }

  // 📋 Obtener所有API Keys
  async getAllApiKeys(includeDeleted = false) {
    try {
      let apiKeys = await redis.getAllApiKeys()
      const client = redis.getClientSafe()
      const accountInfoCache = new Map()

      // PredeterminadoFiltrar掉已Eliminar的API Keys
      if (!includeDeleted) {
        apiKeys = apiKeys.filter((key) => key.isDeleted !== 'true')
      }

      // 为每个key添加使用Estadística和当前Nivel de concurrencia
      for (const key of apiKeys) {
        key.usage = await redis.getUsageStats(key.id)
        const costStats = await redis.getCostStats(key.id)
        // 为前端兼容性：把费用InformaciónSincronización到 usage Objeto里
        if (key.usage && costStats) {
          key.usage.total = key.usage.total || {}
          key.usage.total.cost = costStats.total
          key.usage.totalCost = costStats.total
        }
        key.totalCost = costStats ? costStats.total : 0
        key.tokenLimit = parseInt(key.tokenLimit)
        key.concurrencyLimit = parseInt(key.concurrencyLimit || 0)
        key.rateLimitWindow = parseInt(key.rateLimitWindow || 0)
        key.rateLimitRequests = parseInt(key.rateLimitRequests || 0)
        key.rateLimitCost = parseFloat(key.rateLimitCost || 0) // Nueva característica：速率Límite费用Campo
        key.currentConcurrency = await redis.getConcurrency(key.id)
        key.isActive = key.isActive === 'true'
        key.enableModelRestriction = key.enableModelRestriction === 'true'
        key.enableClientRestriction = key.enableClientRestriction === 'true'
        key.permissions = normalizePermissions(key.permissions)
        key.dailyCostLimit = parseFloat(key.dailyCostLimit || 0)
        key.totalCostLimit = parseFloat(key.totalCostLimit || 0)
        key.weeklyOpusCostLimit = parseFloat(key.weeklyOpusCostLimit || 0)
        key.forcedModel = key.forcedModel || '' // Nueva característica：强制Ruta模型
        key.dailyCost = (await redis.getDailyCost(key.id)) || 0
        key.weeklyOpusCost = (await redis.getWeeklyOpusCost(key.id)) || 0
        key.activationDays = parseInt(key.activationDays || 0)
        key.activationUnit = key.activationUnit || 'days'
        key.expirationMode = key.expirationMode || 'fixed'
        key.isActivated = key.isActivated === 'true'
        key.activatedAt = key.activatedAt || null

        // Obtener当前Tiempo窗口的Solicitud次数、Token使用量和费用
        if (key.rateLimitWindow > 0) {
          const requestCountKey = `rate_limit:requests:${key.id}`
          const tokenCountKey = `rate_limit:tokens:${key.id}`
          const costCountKey = `rate_limit:cost:${key.id}` // Nueva característica：费用计数器
          const windowStartKey = `rate_limit:window_start:${key.id}`

          key.currentWindowRequests = parseInt((await client.get(requestCountKey)) || '0')
          key.currentWindowTokens = parseInt((await client.get(tokenCountKey)) || '0')
          key.currentWindowCost = parseFloat((await client.get(costCountKey)) || '0') // Nueva característica：当前窗口费用

          // Obtener窗口IniciandoTiempo和Calcular剩余Tiempo
          const windowStart = await client.get(windowStartKey)
          if (windowStart) {
            const now = Date.now()
            const windowStartTime = parseInt(windowStart)
            const windowDuration = key.rateLimitWindow * 60 * 1000 // Convertir为毫秒
            const windowEndTime = windowStartTime + windowDuration

            // 如果窗口还有效
            if (now < windowEndTime) {
              key.windowStartTime = windowStartTime
              key.windowEndTime = windowEndTime
              key.windowRemainingSeconds = Math.max(0, Math.floor((windowEndTime - now) / 1000))
            } else {
              // 窗口ha caducado，下次Solicitud会重置
              key.windowStartTime = null
              key.windowEndTime = null
              key.windowRemainingSeconds = 0
              // 重置计数为0，因为窗口ha caducado
              key.currentWindowRequests = 0
              key.currentWindowTokens = 0
              key.currentWindowCost = 0 // Nueva característica：重置费用
            }
          } else {
            // 窗口还未Iniciando（没有任何Solicitud）
            key.windowStartTime = null
            key.windowEndTime = null
            key.windowRemainingSeconds = null
          }
        } else {
          key.currentWindowRequests = 0
          key.currentWindowTokens = 0
          key.currentWindowCost = 0 // Nueva característica：重置费用
          key.windowStartTime = null
          key.windowEndTime = null
          key.windowRemainingSeconds = null
        }

        try {
          key.restrictedModels = key.restrictedModels ? JSON.parse(key.restrictedModels) : []
        } catch (e) {
          key.restrictedModels = []
        }
        try {
          key.allowedClients = key.allowedClients ? JSON.parse(key.allowedClients) : []
        } catch (e) {
          key.allowedClients = []
        }
        try {
          key.tags = key.tags ? JSON.parse(key.tags) : []
        } catch (e) {
          key.tags = []
        }
        // 不暴露已弃用Campo
        if (Object.prototype.hasOwnProperty.call(key, 'ccrAccountId')) {
          delete key.ccrAccountId
        }

        let lastUsageRecord = null
        try {
          const usageRecords = await redis.getUsageRecords(key.id, 1)
          if (Array.isArray(usageRecords) && usageRecords.length > 0) {
            lastUsageRecord = usageRecords[0]
          }
        } catch (error) {
          logger.debug(`加载 API Key ${key.id} 的使用RegistroFalló:`, error)
        }

        if (lastUsageRecord && (lastUsageRecord.accountId || lastUsageRecord.accountType)) {
          const resolvedAccount = await this._resolveLastUsageAccount(
            key,
            lastUsageRecord,
            accountInfoCache,
            client
          )

          if (resolvedAccount) {
            key.lastUsage = {
              accountId: resolvedAccount.accountId,
              rawAccountId: lastUsageRecord.accountId || resolvedAccount.accountId,
              accountType: resolvedAccount.accountType,
              accountCategory: resolvedAccount.accountCategory,
              accountName: resolvedAccount.accountName,
              recordedAt: lastUsageRecord.timestamp || key.lastUsedAt || null
            }
          } else {
            key.lastUsage = {
              accountId: null,
              rawAccountId: lastUsageRecord.accountId || null,
              accountType: 'deleted',
              accountCategory: 'deleted',
              accountName: '已Eliminar',
              recordedAt: lastUsageRecord.timestamp || key.lastUsedAt || null
            }
          }
        } else {
          key.lastUsage = null
        }

        delete key.apiKey // 不Retornar哈希后的key
      }

      return apiKeys
    } catch (error) {
      logger.error('❌ Failed to get API keys:', error)
      throw error
    }
  }

  /**
   * 🚀 快速Obtener所有 API Keys（使用 Pipeline 批量Operación，RendimientoOptimización版）
   * 适用于 dashboard、usage-costs 等需要大量 API Key Datos的场景
   * @param {boolean} includeDeleted - 是否Incluir已Eliminar的 API Keys
   * @returns {Promise<Array>} API Keys ColumnaTabla
   */
  async getAllApiKeysFast(includeDeleted = false) {
    try {
      // 1. 使用 SCAN Obtener所有 API Key IDs
      const keyIds = await redis.scanApiKeyIds()
      if (keyIds.length === 0) {
        return []
      }

      // 2. 批量Obtener基础Datos
      let apiKeys = await redis.batchGetApiKeys(keyIds)

      // 3. Filtrar已Eliminar的
      if (!includeDeleted) {
        apiKeys = apiKeys.filter((key) => !key.isDeleted)
      }

      // 4. 批量ObtenerEstadísticaDatos（单次 Pipeline）
      const activeKeyIds = apiKeys.map((k) => k.id)
      const statsMap = await redis.batchGetApiKeyStats(activeKeyIds)

      // 5. 合并Datos
      for (const key of apiKeys) {
        const stats = statsMap.get(key.id) || {}

        // Procesar usage Datos
        const usageTotal = stats.usageTotal || {}
        const usageDaily = stats.usageDaily || {}
        const usageMonthly = stats.usageMonthly || {}

        // Calcular平均 RPM/TPM
        const createdAt = stats.createdAt ? new Date(stats.createdAt) : new Date()
        const daysSinceCreated = Math.max(
          1,
          Math.ceil((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
        )
        const totalMinutes = daysSinceCreated * 24 * 60
        // 兼容旧DatosFormato：优先读 totalXxx，fallback 到 xxx
        const totalRequests = parseInt(usageTotal.totalRequests || usageTotal.requests) || 0
        const totalTokens = parseInt(usageTotal.totalTokens || usageTotal.tokens) || 0
        let inputTokens = parseInt(usageTotal.totalInputTokens || usageTotal.inputTokens) || 0
        let outputTokens = parseInt(usageTotal.totalOutputTokens || usageTotal.outputTokens) || 0
        let cacheCreateTokens =
          parseInt(usageTotal.totalCacheCreateTokens || usageTotal.cacheCreateTokens) || 0
        let cacheReadTokens =
          parseInt(usageTotal.totalCacheReadTokens || usageTotal.cacheReadTokens) || 0

        // 旧Datos兼容：没有 input/output 分离时做 30/70 拆分
        const totalFromSeparate = inputTokens + outputTokens
        if (totalFromSeparate === 0 && totalTokens > 0) {
          inputTokens = Math.round(totalTokens * 0.3)
          outputTokens = Math.round(totalTokens * 0.7)
          cacheCreateTokens = 0
          cacheReadTokens = 0
        }

        // allTokens：优先读存储Valor，否则Calcular，最后 fallback 到 totalTokens
        const allTokens =
          parseInt(usageTotal.totalAllTokens || usageTotal.allTokens) ||
          inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens ||
          totalTokens

        key.usage = {
          total: {
            requests: totalRequests,
            tokens: allTokens, // 与 getUsageStats 语义一致：Incluir cache 的总 tokens
            inputTokens,
            outputTokens,
            cacheCreateTokens,
            cacheReadTokens,
            allTokens,
            cost: stats.costStats?.total || 0
          },
          daily: {
            requests: parseInt(usageDaily.totalRequests || usageDaily.requests) || 0,
            tokens: parseInt(usageDaily.totalTokens || usageDaily.tokens) || 0
          },
          monthly: {
            requests: parseInt(usageMonthly.totalRequests || usageMonthly.requests) || 0,
            tokens: parseInt(usageMonthly.totalTokens || usageMonthly.tokens) || 0
          },
          averages: {
            rpm: Math.round((totalRequests / totalMinutes) * 100) / 100,
            tpm: Math.round((totalTokens / totalMinutes) * 100) / 100
          },
          totalCost: stats.costStats?.total || 0
        }

        // 费用Estadística
        key.totalCost = stats.costStats?.total || 0
        key.dailyCost = stats.dailyCost || 0
        key.weeklyOpusCost = stats.weeklyOpusCost || 0

        // Concurrencia
        key.currentConcurrency = stats.concurrency || 0

        // TipoConvertir
        key.tokenLimit = parseInt(key.tokenLimit) || 0
        key.concurrencyLimit = parseInt(key.concurrencyLimit) || 0
        key.rateLimitWindow = parseInt(key.rateLimitWindow) || 0
        key.rateLimitRequests = parseInt(key.rateLimitRequests) || 0
        key.rateLimitCost = parseFloat(key.rateLimitCost) || 0
        key.dailyCostLimit = parseFloat(key.dailyCostLimit) || 0
        key.totalCostLimit = parseFloat(key.totalCostLimit) || 0
        key.weeklyOpusCostLimit = parseFloat(key.weeklyOpusCostLimit) || 0
        key.activationDays = parseInt(key.activationDays) || 0
        key.isActive = key.isActive === 'true' || key.isActive === true
        key.enableModelRestriction =
          key.enableModelRestriction === 'true' || key.enableModelRestriction === true
        key.enableClientRestriction =
          key.enableClientRestriction === 'true' || key.enableClientRestriction === true
        key.isActivated = key.isActivated === 'true' || key.isActivated === true
        key.permissions = key.permissions || 'all'
        key.activationUnit = key.activationUnit || 'days'
        key.expirationMode = key.expirationMode || 'fixed'
        key.activatedAt = key.activatedAt || null

        // Rate limit 窗口Datos
        if (key.rateLimitWindow > 0) {
          const rl = stats.rateLimit || {}
          key.currentWindowRequests = rl.requests || 0
          key.currentWindowTokens = rl.tokens || 0
          key.currentWindowCost = rl.cost || 0

          if (rl.windowStart) {
            const now = Date.now()
            const windowDuration = key.rateLimitWindow * 60 * 1000
            const windowEndTime = rl.windowStart + windowDuration

            if (now < windowEndTime) {
              key.windowStartTime = rl.windowStart
              key.windowEndTime = windowEndTime
              key.windowRemainingSeconds = Math.max(0, Math.floor((windowEndTime - now) / 1000))
            } else {
              key.windowStartTime = null
              key.windowEndTime = null
              key.windowRemainingSeconds = 0
              key.currentWindowRequests = 0
              key.currentWindowTokens = 0
              key.currentWindowCost = 0
            }
          } else {
            key.windowStartTime = null
            key.windowEndTime = null
            key.windowRemainingSeconds = null
          }
        } else {
          key.currentWindowRequests = 0
          key.currentWindowTokens = 0
          key.currentWindowCost = 0
          key.windowStartTime = null
          key.windowEndTime = null
          key.windowRemainingSeconds = null
        }

        // JSON CampoAnalizar（兼容已Analizar的Arreglo和未Analizar的Cadena）
        if (Array.isArray(key.restrictedModels)) {
          // 已Analizar，保持不变
        } else if (key.restrictedModels) {
          try {
            key.restrictedModels = JSON.parse(key.restrictedModels)
          } catch {
            key.restrictedModels = []
          }
        } else {
          key.restrictedModels = []
        }
        if (Array.isArray(key.allowedClients)) {
          // 已Analizar，保持不变
        } else if (key.allowedClients) {
          try {
            key.allowedClients = JSON.parse(key.allowedClients)
          } catch {
            key.allowedClients = []
          }
        } else {
          key.allowedClients = []
        }
        if (Array.isArray(key.tags)) {
          // 已Analizar，保持不变
        } else if (key.tags) {
          try {
            key.tags = JSON.parse(key.tags)
          } catch {
            key.tags = []
          }
        } else {
          key.tags = []
        }

        // Generar掩码key后再Limpiar敏感Campo
        if (key.apiKey) {
          key.maskedKey = `${this.prefix}****${key.apiKey.slice(-4)}`
        }
        delete key.apiKey
        delete key.ccrAccountId

        // 不Obtener lastUsage（太慢），设为 null
        key.lastUsage = null
      }

      return apiKeys
    } catch (error) {
      logger.error('❌ Failed to get API keys (fast):', error)
      throw error
    }
  }

  /**
   * Obtener所有 API Keys 的轻量Versión（仅绑定Campo，用于Calcular绑定数）
   * @returns {Promise<Array>} Incluir绑定Campo的 API Keys ColumnaTabla
   */
  async getAllApiKeysLite() {
    try {
      const client = redis.getClientSafe()
      const keyIds = await redis.scanApiKeyIds()

      if (keyIds.length === 0) {
        return []
      }

      // Pipeline 只Obtener绑定相关Campo
      const pipeline = client.pipeline()
      for (const keyId of keyIds) {
        pipeline.hmget(
          `apikey:${keyId}`,
          'claudeAccountId',
          'geminiAccountId',
          'openaiAccountId',
          'droidAccountId',
          'isDeleted'
        )
      }
      const results = await pipeline.exec()

      return keyIds
        .map((id, i) => {
          const [err, fields] = results[i]
          if (err) {
            return null
          }
          return {
            id,
            claudeAccountId: fields[0] || null,
            geminiAccountId: fields[1] || null,
            openaiAccountId: fields[2] || null,
            droidAccountId: fields[3] || null,
            isDeleted: fields[4] === 'true'
          }
        })
        .filter((k) => k && !k.isDeleted)
    } catch (error) {
      logger.error('❌ Failed to get API keys (lite):', error)
      return []
    }
  }

  // 📝 ActualizarAPI Key
  async updateApiKey(keyId, updates) {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      // 允许Actualizar的Campo
      const allowedUpdates = [
        'name',
        'description',
        'tokenLimit',
        'concurrencyLimit',
        'rateLimitWindow',
        'rateLimitRequests',
        'rateLimitCost', // Nueva característica：速率Límite费用Campo
        'isActive',
        'claudeAccountId',
        'claudeConsoleAccountId',
        'geminiAccountId',
        'openaiAccountId',
        'azureOpenaiAccountId',
        'bedrockAccountId', // 添加 Bedrock cuentaID
        'droidAccountId',
        'permissions',
        'expiresAt',
        'activationDays', // Nueva característica：激活后有效天数
        'activationUnit', // Nueva característica：激活Tiempo单位
        'expirationMode', // Nueva característica：过期模式
        'isActivated', // Nueva característica：是否已激活
        'activatedAt', // Nueva característica：激活Tiempo
        'enableModelRestriction',
        'restrictedModels',
        'enableClientRestriction',
        'allowedClients',
        'dailyCostLimit',
        'totalCostLimit',
        'weeklyOpusCostLimit',
        'forcedModel', // Nueva característica：强制Ruta模型
        'tags',
        'userId', // Nueva característica：UsuarioID（所有者变更）
        'userUsername', // Nueva característica：Usuario名（所有者变更）
        'createdBy', // Nueva característica：Crear者（所有者变更）
        'serviceRates' // API Key 级别Servicio倍率
      ]
      const updatedData = { ...keyData }

      for (const [field, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(field)) {
          if (
            field === 'restrictedModels' ||
            field === 'allowedClients' ||
            field === 'tags' ||
            field === 'serviceRates'
          ) {
            // 特殊ProcesarArreglo/ObjetoCampo
            updatedData[field] = JSON.stringify(value || (field === 'serviceRates' ? {} : []))
          } else if (field === 'permissions') {
            // PermisoCampo：规范化后JSONSerialización，与createApiKey保持一致
            updatedData[field] = JSON.stringify(normalizePermissions(value))
          } else if (
            field === 'enableModelRestriction' ||
            field === 'enableClientRestriction' ||
            field === 'isActivated'
          ) {
            // 布尔Valor转Cadena
            updatedData[field] = String(value)
          } else if (field === 'expiresAt' || field === 'activatedAt') {
            // FechaCampo保持原样，不要toString()
            updatedData[field] = value || ''
          } else {
            updatedData[field] = (value !== null && value !== undefined ? value : '').toString()
          }
        }
      }

      updatedData.updatedAt = new Date().toISOString()

      // 传递hashedKey以确保映射Tabla一致性
      // keyData.apiKey 存储的就是 hashedKey（见generateApiKey第123Fila）
      await redis.setApiKey(keyId, updatedData, keyData.apiKey)

      // SincronizaciónActualizar API Key Índice
      try {
        const apiKeyIndexService = require('./apiKeyIndexService')
        await apiKeyIndexService.updateIndex(keyId, updates, {
          name: keyData.name,
          isActive: keyData.isActive === 'true',
          isDeleted: keyData.isDeleted === 'true',
          tags: JSON.parse(keyData.tags || '[]')
        })
      } catch (err) {
        logger.warn(`Failed to update API Key index for ${keyId}:`, err.message)
      }

      logger.success(`📝 Updated API key: ${keyId}, hashMap updated`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to update API key:', error)
      throw error
    }
  }

  // 🗑️ 软EliminarAPI Key (保留使用Estadística)
  async deleteApiKey(keyId, deletedBy = 'system', deletedByType = 'system') {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      // 标记为已Eliminar，保留所有Datos和EstadísticaInformación
      const updatedData = {
        ...keyData,
        isDeleted: 'true',
        deletedAt: new Date().toISOString(),
        deletedBy,
        deletedByType, // 'user', 'admin', 'system'
        isActive: 'false' // 同时Deshabilitar
      }

      await redis.setApiKey(keyId, updatedData)

      // de哈希映射中Eliminación（这样就不能再使用这个key进FilaAPI调用）
      if (keyData.apiKey) {
        await redis.deleteApiKeyHash(keyData.apiKey)
      }

      // de费用OrdenarÍndice中Eliminación
      try {
        const costRankService = require('./costRankService')
        await costRankService.removeKeyFromIndexes(keyId)
      } catch (err) {
        logger.warn(`Failed to remove key ${keyId} from cost rank indexes:`, err.message)
      }

      // Actualizar API Key Índice（标记为已Eliminar）
      try {
        const apiKeyIndexService = require('./apiKeyIndexService')
        await apiKeyIndexService.updateIndex(
          keyId,
          { isDeleted: true, isActive: false },
          {
            name: keyData.name,
            isActive: keyData.isActive === 'true',
            isDeleted: false,
            tags: JSON.parse(keyData.tags || '[]')
          }
        )
      } catch (err) {
        logger.warn(`Failed to update API Key index for deleted key ${keyId}:`, err.message)
      }

      logger.success(`🗑️ Soft deleted API key: ${keyId} by ${deletedBy} (${deletedByType})`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to delete API key:', error)
      throw error
    }
  }

  // 🔄 Restauración已Eliminar的API Key
  async restoreApiKey(keyId, restoredBy = 'system', restoredByType = 'system') {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      // Verificar是否确实是已Eliminar的key
      if (keyData.isDeleted !== 'true') {
        throw new Error('API key is not deleted')
      }

      // 准备Actualizar的Datos
      const updatedData = { ...keyData }
      updatedData.isActive = 'true'
      updatedData.restoredAt = new Date().toISOString()
      updatedData.restoredBy = restoredBy
      updatedData.restoredByType = restoredByType

      // deActualizar的Datos中EliminaciónEliminar相关的Campo
      delete updatedData.isDeleted
      delete updatedData.deletedAt
      delete updatedData.deletedBy
      delete updatedData.deletedByType

      // 保存Actualizar后的Datos
      await redis.setApiKey(keyId, updatedData)

      // 使用Redis的hdel命令Eliminar不Campos requeridos
      const keyName = `apikey:${keyId}`
      await redis.client.hdel(keyName, 'isDeleted', 'deletedAt', 'deletedBy', 'deletedByType')

      // 重新建立哈希映射（RestauraciónAPI Key的使用能力）
      if (keyData.apiKey) {
        await redis.setApiKeyHash(keyData.apiKey, {
          id: keyId,
          name: keyData.name,
          isActive: 'true'
        })
      }

      // 重新添加到费用OrdenarÍndice
      try {
        const costRankService = require('./costRankService')
        await costRankService.addKeyToIndexes(keyId)
      } catch (err) {
        logger.warn(`Failed to add restored key ${keyId} to cost rank indexes:`, err.message)
      }

      // Actualizar API Key Índice（Restauración为活跃状态）
      try {
        const apiKeyIndexService = require('./apiKeyIndexService')
        await apiKeyIndexService.updateIndex(
          keyId,
          { isDeleted: false, isActive: true },
          {
            name: keyData.name,
            isActive: false,
            isDeleted: true,
            tags: JSON.parse(keyData.tags || '[]')
          }
        )
      } catch (err) {
        logger.warn(`Failed to update API Key index for restored key ${keyId}:`, err.message)
      }

      logger.success(`Restored API key: ${keyId} by ${restoredBy} (${restoredByType})`)

      return { success: true, apiKey: updatedData }
    } catch (error) {
      logger.error('❌ Failed to restore API key:', error)
      throw error
    }
  }

  // 🗑️ 彻底EliminarAPI Key（物理Eliminar）
  async permanentDeleteApiKey(keyId) {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      // 确保只能彻底Eliminar已经软Eliminar的key
      if (keyData.isDeleted !== 'true') {
        throw new Error('只能彻底Eliminar已经Eliminar的API Key')
      }

      // Eliminar所有相关的使用EstadísticaDatos
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

      // Eliminar每日Estadística
      await redis.client.del(`usage:daily:${today}:${keyId}`)
      await redis.client.del(`usage:daily:${yesterday}:${keyId}`)

      // Eliminar月度Estadística
      const currentMonth = today.substring(0, 7)
      await redis.client.del(`usage:monthly:${currentMonth}:${keyId}`)

      // Eliminar所有相关的Estadística键（通过模式匹配）
      const usageKeys = await redis.scanKeys(`usage:*:${keyId}*`)
      if (usageKeys.length > 0) {
        await redis.batchDelChunked(usageKeys)
      }

      // 从 API Key Índice中Eliminación
      try {
        const apiKeyIndexService = require('./apiKeyIndexService')
        await apiKeyIndexService.removeFromIndex(keyId, {
          name: keyData.name,
          tags: JSON.parse(keyData.tags || '[]')
        })
      } catch (err) {
        logger.warn(`Failed to remove key ${keyId} from API Key index:`, err.message)
      }

      // EliminarAPI Key本身
      await redis.deleteApiKey(keyId)

      logger.success(`🗑️ Permanently deleted API key: ${keyId}`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to permanently delete API key:', error)
      throw error
    }
  }

  // 🧹 清空所有已Eliminar的API Keys
  async clearAllDeletedApiKeys() {
    try {
      const allKeys = await this.getAllApiKeysFast(true)
      const deletedKeys = allKeys.filter((key) => key.isDeleted === true)

      let successCount = 0
      let failedCount = 0
      const errors = []

      for (const key of deletedKeys) {
        try {
          await this.permanentDeleteApiKey(key.id)
          successCount++
        } catch (error) {
          failedCount++
          errors.push({
            keyId: key.id,
            keyName: key.name,
            error: error.message
          })
        }
      }

      logger.success(`🧹 Cleared deleted API keys: ${successCount} success, ${failedCount} failed`)

      return {
        success: true,
        total: deletedKeys.length,
        successCount,
        failedCount,
        errors
      }
    } catch (error) {
      logger.error('❌ Failed to clear all deleted API keys:', error)
      throw error
    }
  }

  // 📊 Registro使用情况（SoportarCachétoken和Cuenta级别Estadística，应用Servicio倍率）
  async recordUsage(
    keyId,
    inputTokens = 0,
    outputTokens = 0,
    cacheCreateTokens = 0,
    cacheReadTokens = 0,
    model = 'unknown',
    accountId = null,
    accountType = null
  ) {
    try {
      const totalTokens = inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens

      // Calcular费用
      const CostCalculator = require('../utils/costCalculator')
      const costInfo = CostCalculator.calculateCost(
        {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_creation_input_tokens: cacheCreateTokens,
          cache_read_input_tokens: cacheReadTokens
        },
        model
      )

      // Verificar是否为 1M 上下文Solicitud
      let isLongContextRequest = false
      if (model && model.includes('[1m]')) {
        const totalInputTokens = inputTokens + cacheCreateTokens + cacheReadTokens
        isLongContextRequest = totalInputTokens > 200000
      }

      // Calcular费用（应用Servicio倍率）
      const realCost = costInfo.costs.total
      let ratedCost = realCost
      if (realCost > 0) {
        const service = serviceRatesService.getService(accountType, model)
        ratedCost = await this.calculateRatedCost(keyId, service, realCost)
      }

      // RegistroAPI Key级别的使用Estadística（Incluir费用）
      await redis.incrementTokenUsage(
        keyId,
        totalTokens,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        model,
        0, // ephemeral5mTokens - 暂时为0，后续Procesar
        0, // ephemeral1hTokens - 暂时为0，后续Procesar
        isLongContextRequest,
        realCost,
        ratedCost
      )

      // Registro费用Estadística到每日/每月汇总
      if (realCost > 0) {
        await redis.incrementDailyCost(keyId, ratedCost, realCost)
        logger.database(
          `💰 Recorded cost for ${keyId}: rated=$${ratedCost.toFixed(6)}, real=$${realCost.toFixed(6)}, model: ${model}`
        )

        // Registro Opus 周费用（如果适用）
        await this.recordOpusCost(keyId, ratedCost, realCost, model, accountType)
      } else {
        logger.debug(`💰 No cost recorded for ${keyId} - zero cost for model: ${model}`)
      }

      // ObtenerAPI KeyDatos以确定关联的Cuenta
      const keyData = await redis.getApiKey(keyId)
      if (keyData && Object.keys(keyData).length > 0) {
        // Actualizar最后使用Tiempo
        const lastUsedAt = new Date().toISOString()
        keyData.lastUsedAt = lastUsedAt
        await redis.setApiKey(keyId, keyData)

        // SincronizaciónActualizar lastUsedAt Índice
        try {
          const apiKeyIndexService = require('./apiKeyIndexService')
          await apiKeyIndexService.updateLastUsedAt(keyId, lastUsedAt)
        } catch (err) {
          // ÍndiceActualizarFalló不影响主流程
        }

        // RegistroCuenta级别的使用Estadística（只Estadística实际ProcesarSolicitud的Cuenta）
        if (accountId) {
          await redis.incrementAccountUsage(
            accountId,
            totalTokens,
            inputTokens,
            outputTokens,
            cacheCreateTokens,
            cacheReadTokens,
            model,
            isLongContextRequest
          )
          logger.database(
            `📊 Recorded account usage: ${accountId} - ${totalTokens} tokens (API Key: ${keyId})`
          )
        } else {
          logger.debug(
            '⚠️ No accountId provided for usage recording, skipping account-level statistics'
          )
        }
      }

      // Registro单次Solicitud的使用详情（同时保存真实成本和倍率成本）
      await redis.addUsageRecord(keyId, {
        timestamp: new Date().toISOString(),
        model,
        accountId: accountId || null,
        accountType: accountType || null,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        totalTokens,
        cost: Number(ratedCost.toFixed(6)),
        realCost: Number(realCost.toFixed(6)),
        realCostBreakdown: costInfo && costInfo.costs ? costInfo.costs : undefined
      })

      const logParts = [`Model: ${model}`, `Input: ${inputTokens}`, `Output: ${outputTokens}`]
      if (cacheCreateTokens > 0) {
        logParts.push(`Cache Create: ${cacheCreateTokens}`)
      }
      if (cacheReadTokens > 0) {
        logParts.push(`Cache Read: ${cacheReadTokens}`)
      }
      logParts.push(`Total: ${totalTokens} tokens`)

      logger.database(`📊 Recorded usage: ${keyId} - ${logParts.join(', ')}`)
    } catch (error) {
      logger.error('❌ Failed to record usage:', error)
    }
  }

  // 📊 Registro Opus 模型费用（仅限 claude 和 claude-console Cuenta）
  // ratedCost: 倍率后的成本（用于限额校验）
  // realCost: 真实成本（用于对账），如果不传则等于 ratedCost
  async recordOpusCost(keyId, ratedCost, realCost, model, accountType) {
    try {
      // 判断是否为 Claude 系Columna模型（Incluir Bedrock Formato等）
      if (!isOpusModel(model)) {
        return
      }

      // 判断是否为 claude-official、claude-console 或 ccr Cuenta
      const opusAccountTypes = ['claude-official', 'claude-console', 'ccr']
      if (!accountType || !opusAccountTypes.includes(accountType)) {
        logger.debug(`⚠️ Skipping Opus cost recording for non-Claude account type: ${accountType}`)
        return // 不是 claude Cuenta，直接Retornar
      }

      // Registro Opus 周费用（倍率成本和真实成本）
      await redis.incrementWeeklyOpusCost(keyId, ratedCost, realCost)
      logger.database(
        `💰 Recorded Opus weekly cost for ${keyId}: rated=$${ratedCost.toFixed(6)}, real=$${realCost.toFixed(6)}, model: ${model}`
      )
    } catch (error) {
      logger.error('❌ Failed to record Opus weekly cost:', error)
    }
  }

  // 📊 Registro使用情况（新Versión，Soportar详细的CachéTipo）
  async recordUsageWithDetails(
    keyId,
    usageObject,
    model = 'unknown',
    accountId = null,
    accountType = null
  ) {
    try {
      // 提取 token 数量
      const inputTokens = usageObject.input_tokens || 0
      const outputTokens = usageObject.output_tokens || 0
      const cacheCreateTokens = usageObject.cache_creation_input_tokens || 0
      const cacheReadTokens = usageObject.cache_read_input_tokens || 0

      const totalTokens = inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens

      // Calcular费用（Soportar详细的CachéTipo）- 添加ErrorProcesar
      let costInfo = { totalCost: 0, ephemeral5mCost: 0, ephemeral1hCost: 0 }
      try {
        const pricingService = require('./pricingService')
        // 确保 pricingService 已Inicializar
        if (!pricingService.pricingData) {
          logger.warn('⚠️ PricingService not initialized, initializing now...')
          await pricingService.initialize()
        }
        costInfo = pricingService.calculateCost(usageObject, model)

        // ValidarCalcular结果
        if (!costInfo || typeof costInfo.totalCost !== 'number') {
          logger.error(`❌ Invalid cost calculation result for model ${model}:`, costInfo)
          // 使用 CostCalculator 作为后备
          const CostCalculator = require('../utils/costCalculator')
          const fallbackCost = CostCalculator.calculateCost(usageObject, model)
          if (fallbackCost && fallbackCost.costs && fallbackCost.costs.total > 0) {
            logger.warn(
              `⚠️ Using fallback cost calculation for ${model}: $${fallbackCost.costs.total}`
            )
            costInfo = {
              totalCost: fallbackCost.costs.total,
              ephemeral5mCost: 0,
              ephemeral1hCost: 0
            }
          } else {
            costInfo = { totalCost: 0, ephemeral5mCost: 0, ephemeral1hCost: 0 }
          }
        }
      } catch (pricingError) {
        logger.error(`❌ Failed to calculate cost for model ${model}:`, pricingError)
        logger.error(`   Usage object:`, JSON.stringify(usageObject))
        // 使用 CostCalculator 作为后备
        try {
          const CostCalculator = require('../utils/costCalculator')
          const fallbackCost = CostCalculator.calculateCost(usageObject, model)
          if (fallbackCost && fallbackCost.costs && fallbackCost.costs.total > 0) {
            logger.warn(
              `⚠️ Using fallback cost calculation for ${model}: $${fallbackCost.costs.total}`
            )
            costInfo = {
              totalCost: fallbackCost.costs.total,
              ephemeral5mCost: 0,
              ephemeral1hCost: 0
            }
          }
        } catch (fallbackError) {
          logger.error(`❌ Fallback cost calculation also failed:`, fallbackError)
        }
      }

      // 提取详细的CachéCrearDatos
      let ephemeral5mTokens = 0
      let ephemeral1hTokens = 0

      if (usageObject.cache_creation && typeof usageObject.cache_creation === 'object') {
        ephemeral5mTokens = usageObject.cache_creation.ephemeral_5m_input_tokens || 0
        ephemeral1hTokens = usageObject.cache_creation.ephemeral_1h_input_tokens || 0
      }

      // Calcular费用（应用Servicio倍率）- 需要在 incrementTokenUsage 之前Calcular
      const realCostWithDetails = costInfo.totalCost || 0
      let ratedCostWithDetails = realCostWithDetails
      if (realCostWithDetails > 0) {
        const service = serviceRatesService.getService(accountType, model)
        ratedCostWithDetails = await this.calculateRatedCost(keyId, service, realCostWithDetails)
      }

      // RegistroAPI Key级别的使用Estadística（Incluir费用）
      await redis.incrementTokenUsage(
        keyId,
        totalTokens,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        model,
        ephemeral5mTokens,
        ephemeral1hTokens,
        costInfo.isLongContextRequest || false,
        realCostWithDetails,
        ratedCostWithDetails
      )

      // Registro费用到每日/每月汇总
      if (realCostWithDetails > 0) {
        // Registro倍率成本和真实成本
        await redis.incrementDailyCost(keyId, ratedCostWithDetails, realCostWithDetails)
        logger.database(
          `💰 Recorded cost for ${keyId}: rated=$${ratedCostWithDetails.toFixed(6)}, real=$${realCostWithDetails.toFixed(6)}, model: ${model}`
        )

        // Registro Opus 周费用（如果适用，也应用倍率）
        await this.recordOpusCost(
          keyId,
          ratedCostWithDetails,
          realCostWithDetails,
          model,
          accountType
        )

        // Registro详细的Caché费用（如果有）
        if (costInfo.ephemeral5mCost > 0 || costInfo.ephemeral1hCost > 0) {
          logger.database(
            `💰 Cache costs - 5m: $${costInfo.ephemeral5mCost.toFixed(
              6
            )}, 1h: $${costInfo.ephemeral1hCost.toFixed(6)}`
          )
        }
      } else {
        // 如果有 token 使用但费用为 0，RegistroAdvertencia
        if (totalTokens > 0) {
          logger.warn(
            `⚠️ No cost recorded for ${keyId} - zero cost for model: ${model} (tokens: ${totalTokens})`
          )
          logger.warn(`   This may indicate a pricing issue or model not found in pricing data`)
        } else {
          logger.debug(`💰 No cost recorded for ${keyId} - zero tokens for model: ${model}`)
        }
      }

      // ObtenerAPI KeyDatos以确定关联的Cuenta
      const keyData = await redis.getApiKey(keyId)
      if (keyData && Object.keys(keyData).length > 0) {
        // Actualizar最后使用Tiempo
        const lastUsedAt = new Date().toISOString()
        keyData.lastUsedAt = lastUsedAt
        await redis.setApiKey(keyId, keyData)

        // SincronizaciónActualizar lastUsedAt Índice
        try {
          const apiKeyIndexService = require('./apiKeyIndexService')
          await apiKeyIndexService.updateLastUsedAt(keyId, lastUsedAt)
        } catch (err) {
          // ÍndiceActualizarFalló不影响主流程
        }

        // RegistroCuenta级别的使用Estadística（只Estadística实际ProcesarSolicitud的Cuenta）
        if (accountId) {
          await redis.incrementAccountUsage(
            accountId,
            totalTokens,
            inputTokens,
            outputTokens,
            cacheCreateTokens,
            cacheReadTokens,
            model,
            costInfo.isLongContextRequest || false
          )
          logger.database(
            `📊 Recorded account usage: ${accountId} - ${totalTokens} tokens (API Key: ${keyId})`
          )
        } else {
          logger.debug(
            '⚠️ No accountId provided for usage recording, skipping account-level statistics'
          )
        }
      }

      const usageRecord = {
        timestamp: new Date().toISOString(),
        model,
        accountId: accountId || null,
        accountType: accountType || null,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        ephemeral5mTokens,
        ephemeral1hTokens,
        totalTokens,
        cost: Number(ratedCostWithDetails.toFixed(6)),
        realCost: Number(realCostWithDetails.toFixed(6)),
        realCostBreakdown: {
          input: costInfo.inputCost || 0,
          output: costInfo.outputCost || 0,
          cacheCreate: costInfo.cacheCreateCost || 0,
          cacheRead: costInfo.cacheReadCost || 0,
          ephemeral5m: costInfo.ephemeral5mCost || 0,
          ephemeral1h: costInfo.ephemeral1hCost || 0
        },
        isLongContext: costInfo.isLongContextRequest || false
      }

      await redis.addUsageRecord(keyId, usageRecord)

      const logParts = [`Model: ${model}`, `Input: ${inputTokens}`, `Output: ${outputTokens}`]
      if (cacheCreateTokens > 0) {
        logParts.push(`Cache Create: ${cacheCreateTokens}`)

        // 如果有详细的CachéCrearDatos，也Registro它们
        if (usageObject.cache_creation) {
          const { ephemeral_5m_input_tokens, ephemeral_1h_input_tokens } =
            usageObject.cache_creation
          if (ephemeral_5m_input_tokens > 0) {
            logParts.push(`5m: ${ephemeral_5m_input_tokens}`)
          }
          if (ephemeral_1h_input_tokens > 0) {
            logParts.push(`1h: ${ephemeral_1h_input_tokens}`)
          }
        }
      }
      if (cacheReadTokens > 0) {
        logParts.push(`Cache Read: ${cacheReadTokens}`)
      }
      logParts.push(`Total: ${totalTokens} tokens`)

      logger.database(`📊 Recorded usage: ${keyId} - ${logParts.join(', ')}`)

      // 🔔 发布计费Evento到消息Cola（Asíncrono非Bloqueante）
      this._publishBillingEvent({
        keyId,
        keyName: keyData?.name,
        userId: keyData?.userId,
        model,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        ephemeral5mTokens,
        ephemeral1hTokens,
        totalTokens,
        cost: costInfo.totalCost || 0,
        costBreakdown: {
          input: costInfo.inputCost || 0,
          output: costInfo.outputCost || 0,
          cacheCreate: costInfo.cacheCreateCost || 0,
          cacheRead: costInfo.cacheReadCost || 0,
          ephemeral5m: costInfo.ephemeral5mCost || 0,
          ephemeral1h: costInfo.ephemeral1hCost || 0
        },
        accountId,
        accountType,
        isLongContext: costInfo.isLongContextRequest || false,
        requestTimestamp: usageRecord.timestamp
      }).catch((err) => {
        // 发布Falló不影响主流程，只RegistroError
        logger.warn('⚠️ Failed to publish billing event:', err.message)
      })
    } catch (error) {
      logger.error('❌ Failed to record usage:', error)
    }
  }

  async _fetchAccountInfo(accountId, accountType, cache, client) {
    if (!client || !accountId || !accountType) {
      return null
    }

    const cacheKey = `${accountType}:${accountId}`
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)
    }

    const accountConfig = ACCOUNT_TYPE_CONFIG[accountType]
    if (!accountConfig) {
      cache.set(cacheKey, null)
      return null
    }

    const redisKey = `${accountConfig.prefix}${accountId}`
    let accountData = null
    try {
      accountData = await client.hgetall(redisKey)
    } catch (error) {
      logger.debug(`Failed to load account information ${redisKey}:`, error)
    }

    if (accountData && Object.keys(accountData).length > 0) {
      const displayName =
        accountData.name ||
        accountData.displayName ||
        accountData.email ||
        accountData.username ||
        accountData.description ||
        accountId

      const info = { id: accountId, name: displayName }
      cache.set(cacheKey, info)
      return info
    }

    cache.set(cacheKey, null)
    return null
  }

  async _resolveAccountByUsageRecord(usageRecord, cache, client) {
    if (!usageRecord || !client) {
      return null
    }

    const rawAccountId = usageRecord.accountId || null
    const rawAccountType = normalizeAccountTypeKey(usageRecord.accountType)
    const modelName = usageRecord.model || usageRecord.actualModel || usageRecord.service || null

    if (!rawAccountId && !rawAccountType) {
      return null
    }

    const candidateIds = new Set()
    if (rawAccountId) {
      candidateIds.add(rawAccountId)
      if (typeof rawAccountId === 'string' && rawAccountId.startsWith('responses:')) {
        candidateIds.add(rawAccountId.replace(/^responses:/, ''))
      }
      if (typeof rawAccountId === 'string' && rawAccountId.startsWith('api:')) {
        candidateIds.add(rawAccountId.replace(/^api:/, ''))
      }
    }

    if (candidateIds.size === 0) {
      return null
    }

    const typeCandidates = []
    const pushType = (type) => {
      const normalized = normalizeAccountTypeKey(type)
      if (normalized && ACCOUNT_TYPE_CONFIG[normalized] && !typeCandidates.includes(normalized)) {
        typeCandidates.push(normalized)
      }
    }

    pushType(rawAccountType)

    if (modelName) {
      const lowerModel = modelName.toLowerCase()
      if (lowerModel.includes('gpt') || lowerModel.includes('openai')) {
        pushType('openai')
        pushType('openai-responses')
        pushType('azure-openai')
      } else if (lowerModel.includes('gemini')) {
        pushType('gemini')
        pushType('gemini-api')
      } else if (lowerModel.includes('claude') || lowerModel.includes('anthropic')) {
        pushType('claude')
        pushType('claude-console')
      } else if (lowerModel.includes('droid')) {
        pushType('droid')
      }
    }

    ACCOUNT_TYPE_PRIORITY.forEach(pushType)

    for (const type of typeCandidates) {
      const accountConfig = ACCOUNT_TYPE_CONFIG[type]
      if (!accountConfig) {
        continue
      }

      for (const candidateId of candidateIds) {
        const normalizedId = sanitizeAccountIdForType(candidateId, type)
        const accountInfo = await this._fetchAccountInfo(normalizedId, type, cache, client)
        if (accountInfo) {
          return {
            accountId: normalizedId,
            accountName: accountInfo.name,
            accountType: type,
            accountCategory: ACCOUNT_CATEGORY_MAP[type] || 'other',
            rawAccountId: rawAccountId || normalizedId
          }
        }
      }
    }

    return null
  }

  async _resolveLastUsageAccount(apiKey, usageRecord, cache, client) {
    return await this._resolveAccountByUsageRecord(usageRecord, cache, client)
  }

  // 🔔 发布计费Evento（内部Método）
  async _publishBillingEvent(eventData) {
    try {
      const billingEventPublisher = require('./billingEventPublisher')
      await billingEventPublisher.publishBillingEvent(eventData)
    } catch (error) {
      // 静默Falló，不影响主流程
      logger.debug('Failed to publish billing event:', error.message)
    }
  }

  // 🔐 GenerarClave
  _generateSecretKey() {
    return crypto.randomBytes(32).toString('hex')
  }

  // 🔒 哈希API Key
  _hashApiKey(apiKey) {
    return crypto
      .createHash('sha256')
      .update(apiKey + config.security.encryptionKey)
      .digest('hex')
  }

  // 📈 Obtener使用Estadística
  async getUsageStats(keyId, options = {}) {
    const usageStats = await redis.getUsageStats(keyId)

    // options 可能是Cadena（兼容旧Interfaz），仅当为Objeto时才Analizar
    const optionObject =
      options && typeof options === 'object' && !Array.isArray(options) ? options : {}

    if (optionObject.includeRecords === false) {
      return usageStats
    }

    const recordLimit = optionObject.recordLimit || 20
    const recentRecords = await redis.getUsageRecords(keyId, recordLimit)

    // API 兼容：同时输出 costBreakdown 和 realCostBreakdown
    const compatibleRecords = recentRecords.map((record) => {
      const breakdown = record.realCostBreakdown || record.costBreakdown
      return {
        ...record,
        costBreakdown: breakdown,
        realCostBreakdown: breakdown
      }
    })

    return {
      ...usageStats,
      recentRecords: compatibleRecords
    }
  }

  // 📊 ObtenerCuenta使用Estadística
  async getAccountUsageStats(accountId) {
    return await redis.getAccountUsageStats(accountId)
  }

  // 📈 Obtener所有Cuenta使用Estadística
  async getAllAccountsUsageStats() {
    return await redis.getAllAccountsUsageStats()
  }

  // === Usuario相关Método ===

  // 🔑 CrearAPI Key（SoportarUsuario）
  async createApiKey(options = {}) {
    return await this.generateApiKey(options)
  }

  // 👤 ObtenerUsuario的API Keys
  async getUserApiKeys(userId, includeDeleted = false) {
    try {
      const allKeys = await this.getAllApiKeysFast(includeDeleted)
      let userKeys = allKeys.filter((key) => key.userId === userId)

      // PredeterminadoFiltrar掉已Eliminar的API Keys（FastVersiónRetornar布尔Valor）
      if (!includeDeleted) {
        userKeys = userKeys.filter((key) => !key.isDeleted)
      }

      // Populate usage stats for each user's API key (same as getAllApiKeys does)
      const userKeysWithUsage = []
      for (const key of userKeys) {
        const usage = await redis.getUsageStats(key.id)
        const dailyCost = (await redis.getDailyCost(key.id)) || 0
        const costStats = await redis.getCostStats(key.id)

        userKeysWithUsage.push({
          id: key.id,
          name: key.name,
          description: key.description,
          key: key.maskedKey || null, // FastVersión已提供maskedKey
          tokenLimit: parseInt(key.tokenLimit || 0),
          isActive: key.isActive === true, // FastVersiónRetornar布尔Valor
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
          expiresAt: key.expiresAt,
          usage,
          dailyCost,
          totalCost: costStats.total,
          dailyCostLimit: parseFloat(key.dailyCostLimit || 0),
          totalCostLimit: parseFloat(key.totalCostLimit || 0),
          userId: key.userId,
          userUsername: key.userUsername,
          createdBy: key.createdBy,
          droidAccountId: key.droidAccountId,
          // Include deletion fields for deleted keys
          isDeleted: key.isDeleted,
          deletedAt: key.deletedAt,
          deletedBy: key.deletedBy,
          deletedByType: key.deletedByType
        })
      }

      return userKeysWithUsage
    } catch (error) {
      logger.error('❌ Failed to get user API keys:', error)
      return []
    }
  }

  // 🔍 通过IDObtenerAPI Key（VerificarPermiso）
  async getApiKeyById(keyId, userId = null) {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData) {
        return null
      }

      // 如果指定了UsuarioID，VerificarPermiso
      if (userId && keyData.userId !== userId) {
        return null
      }

      return {
        id: keyData.id,
        name: keyData.name,
        description: keyData.description,
        key: keyData.apiKey,
        tokenLimit: parseInt(keyData.tokenLimit || 0),
        isActive: keyData.isActive === 'true',
        createdAt: keyData.createdAt,
        lastUsedAt: keyData.lastUsedAt,
        expiresAt: keyData.expiresAt,
        userId: keyData.userId,
        userUsername: keyData.userUsername,
        createdBy: keyData.createdBy,
        permissions: normalizePermissions(keyData.permissions),
        dailyCostLimit: parseFloat(keyData.dailyCostLimit || 0),
        totalCostLimit: parseFloat(keyData.totalCostLimit || 0),
        // 所有平台Cuenta绑定Campo
        claudeAccountId: keyData.claudeAccountId,
        claudeConsoleAccountId: keyData.claudeConsoleAccountId,
        geminiAccountId: keyData.geminiAccountId,
        openaiAccountId: keyData.openaiAccountId,
        bedrockAccountId: keyData.bedrockAccountId,
        droidAccountId: keyData.droidAccountId,
        azureOpenaiAccountId: keyData.azureOpenaiAccountId,
        ccrAccountId: keyData.ccrAccountId
      }
    } catch (error) {
      logger.error('❌ Failed to get API key by ID:', error)
      return null
    }
  }

  // 🔄 重新GenerarAPI Key
  async regenerateApiKey(keyId) {
    try {
      const existingKey = await redis.getApiKey(keyId)
      if (!existingKey) {
        throw new Error('API key not found')
      }

      // Generar新的key
      const newApiKey = `${this.prefix}${this._generateSecretKey()}`
      const newHashedKey = this._hashApiKey(newApiKey)

      // Eliminar旧的哈希映射
      const oldHashedKey = existingKey.apiKey
      await redis.deleteApiKeyHash(oldHashedKey)

      // ActualizarkeyDatos
      const updatedKeyData = {
        ...existingKey,
        apiKey: newHashedKey,
        updatedAt: new Date().toISOString()
      }

      // 保存新Datos并建立新的哈希映射
      await redis.setApiKey(keyId, updatedKeyData, newHashedKey)

      logger.info(`🔄 Regenerated API key: ${existingKey.name} (${keyId})`)

      return {
        id: keyId,
        name: existingKey.name,
        key: newApiKey, // Retornar完整的新key
        updatedAt: updatedKeyData.updatedAt
      }
    } catch (error) {
      logger.error('❌ Failed to regenerate API key:', error)
      throw error
    }
  }

  // 🗑️ 硬EliminarAPI Key (完全Eliminación)
  async hardDeleteApiKey(keyId) {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData) {
        throw new Error('API key not found')
      }

      // EliminarkeyDatos和哈希映射
      await redis.deleteApiKey(keyId)
      await redis.deleteApiKeyHash(keyData.apiKey)

      logger.info(`🗑️ Deleted API key: ${keyData.name} (${keyId})`)
      return true
    } catch (error) {
      logger.error('❌ Failed to delete API key:', error)
      throw error
    }
  }

  // 🚫 DeshabilitarUsuario的所有API Keys
  async disableUserApiKeys(userId) {
    try {
      const userKeys = await this.getUserApiKeys(userId)
      let disabledCount = 0

      for (const key of userKeys) {
        if (key.isActive) {
          await this.updateApiKey(key.id, { isActive: false })
          disabledCount++
        }
      }

      logger.info(`🚫 Disabled ${disabledCount} API keys for user: ${userId}`)
      return { count: disabledCount }
    } catch (error) {
      logger.error('❌ Failed to disable user API keys:', error)
      throw error
    }
  }

  // 📊 Obtener聚合使用Estadística（Soportar多个API Key）
  async getAggregatedUsageStats(keyIds, options = {}) {
    try {
      if (!Array.isArray(keyIds)) {
        keyIds = [keyIds]
      }

      const { period: _period = 'week', model: _model } = options
      const stats = {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        dailyStats: [],
        modelStats: []
      }

      // 汇总所有API Key的EstadísticaDatos
      for (const keyId of keyIds) {
        const keyStats = await redis.getUsageStats(keyId)
        const costStats = await redis.getCostStats(keyId)
        if (keyStats && keyStats.total) {
          stats.totalRequests += keyStats.total.requests || 0
          stats.totalInputTokens += keyStats.total.inputTokens || 0
          stats.totalOutputTokens += keyStats.total.outputTokens || 0
          stats.totalCost += costStats?.total || 0
        }
      }

      // TODO: 实现Fecha范围和模型Estadística
      // 这里可以根据需要添加更详细的Estadística逻辑

      return stats
    } catch (error) {
      logger.error('❌ Failed to get usage stats:', error)
      return {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        dailyStats: [],
        modelStats: []
      }
    }
  }

  // 🔓 解绑cuentade所有API Keys
  async unbindAccountFromAllKeys(accountId, accountType) {
    try {
      // cuentaTipo与Campo的映射关系
      const fieldMap = {
        claude: 'claudeAccountId',
        'claude-console': 'claudeConsoleAccountId',
        gemini: 'geminiAccountId',
        'gemini-api': 'geminiAccountId', // 特殊Procesar，带 api: 前缀
        openai: 'openaiAccountId',
        'openai-responses': 'openaiAccountId', // 特殊Procesar，带 responses: 前缀
        azure_openai: 'azureOpenaiAccountId',
        bedrock: 'bedrockAccountId',
        droid: 'droidAccountId',
        ccr: null // CCR cuenta没有对应的 API Key Campo
      }

      const field = fieldMap[accountType]
      if (!field) {
        logger.info(`Account type ${accountType} does not require API key unbinding`)
        return 0
      }

      // Obtener所有API Keys
      const allKeys = await this.getAllApiKeysFast()

      // 筛选绑定到此cuenta的 API Keys
      let boundKeys = []
      if (accountType === 'openai-responses') {
        // OpenAI-Responses 特殊Procesar：查找 openaiAccountId Campo中带 responses: 前缀的
        boundKeys = allKeys.filter((key) => key.openaiAccountId === `responses:${accountId}`)
      } else if (accountType === 'gemini-api') {
        // Gemini-API 特殊Procesar：查找 geminiAccountId Campo中带 api: 前缀的
        boundKeys = allKeys.filter((key) => key.geminiAccountId === `api:${accountId}`)
      } else {
        // 其他cuentaTipo正常匹配
        boundKeys = allKeys.filter((key) => key[field] === accountId)
      }

      // 批量解绑
      for (const key of boundKeys) {
        const updates = {}
        if (accountType === 'openai-responses') {
          updates.openaiAccountId = null
        } else if (accountType === 'gemini-api') {
          updates.geminiAccountId = null
        } else if (accountType === 'claude-console') {
          updates.claudeConsoleAccountId = null
        } else {
          updates[field] = null
        }

        await this.updateApiKey(key.id, updates)
        logger.info(
          `✅ Desvinculación automática de la clave API ${key.id} (${key.name}) de ${accountType} cuenta ${accountId}`
        )
      }

      if (boundKeys.length > 0) {
        logger.success(
          `🔓 Desvinculación exitosa de ${boundKeys.length} claves API de ${accountType} cuenta ${accountId}`
        )
      }

      return boundKeys.length
    } catch (error) {
      logger.error(`❌ Failed to unbind API keys (${accountType} cuenta ${accountId}):`, error)
      return 0
    }
  }

  // 🧹 Limpiar过期的API Keys
  async cleanupExpiredKeys() {
    try {
      const apiKeys = await this.getAllApiKeysFast()
      const now = new Date()
      let cleanedCount = 0

      for (const key of apiKeys) {
        // Verificar是否已过期且仍处于激活状态（FastVersiónRetornar布尔Valor）
        if (key.expiresAt && new Date(key.expiresAt) < now && key.isActive === true) {
          // 将过期的 API Key 标记为Deshabilitar状态，而不是直接Eliminar
          await this.updateApiKey(key.id, { isActive: false })
          logger.info(`🔒 API Key ${key.id} (${key.name}) has expired and been disabled`)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        logger.success(`🧹 Disabled ${cleanedCount} expired API keys`)
      }

      return cleanedCount
    } catch (error) {
      logger.error('❌ Failed to cleanup expired keys:', error)
      return 0
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Servicio倍率和费用Límite相关Método
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcular应用倍率后的费用
   * 公式：消费计费 = 真实消费 × 全局倍率 × Key 倍率
   * @param {string} keyId - API Key ID
   * @param {string} service - ServicioTipo
   * @param {number} realCost - 真实成本（USD）
   * @returns {Promise<number>} 应用倍率后的费用
   */
  async calculateRatedCost(keyId, service, realCost) {
    try {
      // Obtener全局倍率
      const globalRate = await serviceRatesService.getServiceRate(service)

      // Obtener Key 倍率
      const keyData = await redis.getApiKey(keyId)
      let keyRates = {}
      try {
        keyRates = JSON.parse(keyData?.serviceRates || '{}')
      } catch (e) {
        keyRates = {}
      }
      const keyRate = keyRates[service] ?? 1.0

      // 相乘Calcular
      return realCost * globalRate * keyRate
    } catch (error) {
      logger.error('❌ Failed to calculate rated cost:', error)
      // 出错时Retornar原始费用
      return realCost
    }
  }

  /**
   * 增加 API Key 费用Límite（用于核销额度卡）
   * @param {string} keyId - API Key ID
   * @param {number} amount - 要增加的金额（USD）
   * @returns {Promise<Object>} { success: boolean, newTotalCostLimit: number }
   */
  async addTotalCostLimit(keyId, amount) {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      const currentLimit = parseFloat(keyData.totalCostLimit || 0)
      const newLimit = currentLimit + amount

      await redis.client.hset(`apikey:${keyId}`, 'totalCostLimit', String(newLimit))

      logger.success(`💰 Added $${amount} to key ${keyId}, new limit: $${newLimit}`)

      return { success: true, previousLimit: currentLimit, newTotalCostLimit: newLimit }
    } catch (error) {
      logger.error('❌ Failed to add total cost limit:', error)
      throw error
    }
  }

  /**
   * 减少 API Key 费用Límite（用于撤销核销）
   * @param {string} keyId - API Key ID
   * @param {number} amount - 要减少的金额（USD）
   * @returns {Promise<Object>} { success: boolean, newTotalCostLimit: number, actualDeducted: number }
   */
  async deductTotalCostLimit(keyId, amount) {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      const currentLimit = parseFloat(keyData.totalCostLimit || 0)
      const costStats = await redis.getCostStats(keyId)
      const currentUsed = costStats?.total || 0

      // 不能扣到比已使用的还少
      const minLimit = currentUsed
      const actualDeducted = Math.min(amount, currentLimit - minLimit)
      const newLimit = Math.max(currentLimit - amount, minLimit)

      await redis.client.hset(`apikey:${keyId}`, 'totalCostLimit', String(newLimit))

      logger.success(`💸 Deducted $${actualDeducted} from key ${keyId}, new limit: $${newLimit}`)

      return {
        success: true,
        previousLimit: currentLimit,
        newTotalCostLimit: newLimit,
        actualDeducted
      }
    } catch (error) {
      logger.error('❌ Failed to deduct total cost limit:', error)
      throw error
    }
  }

  /**
   * 延长 API Key 有效期（用于核销Tiempo卡）
   * @param {string} keyId - API Key ID
   * @param {number} amount - Tiempo数量
   * @param {string} unit - Tiempo单位 'hours' | 'days' | 'months'
   * @returns {Promise<Object>} { success: boolean, newExpiresAt: string }
   */
  async extendExpiry(keyId, amount, unit = 'days') {
    try {
      const keyData = await redis.getApiKey(keyId)
      if (!keyData || Object.keys(keyData).length === 0) {
        throw new Error('API key not found')
      }

      // Calcular新的过期Tiempo
      let baseDate = keyData.expiresAt ? new Date(keyData.expiresAt) : new Date()
      // 如果已过期，从当前TiempoIniciandoCalcular
      if (baseDate < new Date()) {
        baseDate = new Date()
      }

      let milliseconds
      switch (unit) {
        case 'hours':
          milliseconds = amount * 60 * 60 * 1000
          break
        case 'months':
          // 简化Procesar：1个月 = 30天
          milliseconds = amount * 30 * 24 * 60 * 60 * 1000
          break
        case 'days':
        default:
          milliseconds = amount * 24 * 60 * 60 * 1000
      }

      const newExpiresAt = new Date(baseDate.getTime() + milliseconds).toISOString()

      await this.updateApiKey(keyId, { expiresAt: newExpiresAt })

      logger.success(
        `⏰ Extended key ${keyId} expiry by ${amount} ${unit}, new expiry: ${newExpiresAt}`
      )

      return { success: true, previousExpiresAt: keyData.expiresAt, newExpiresAt }
    } catch (error) {
      logger.error('❌ Failed to extend expiry:', error)
      throw error
    }
  }
}

// 导出Instancia和单独的Método
const apiKeyService = new ApiKeyService()

// 为了方便其他Servicio调用，导出 recordUsage Método
apiKeyService.recordUsageMetrics = apiKeyService.recordUsage.bind(apiKeyService)

// 导出Permiso辅助Función供Ruta使用
apiKeyService.hasPermission = hasPermission
apiKeyService.normalizePermissions = normalizePermissions

module.exports = apiKeyService
