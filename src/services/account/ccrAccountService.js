const { v4: uuidv4 } = require('uuid')
const ProxyHelper = require('../../utils/proxyHelper')
const redis = require('../../models/redis')
const logger = require('../../utils/logger')
const { createEncryptor } = require('../../utils/commonHelper')
const upstreamErrorHelper = require('../../utils/upstreamErrorHelper')

class CcrAccountService {
  constructor() {
    // Redis键前缀
    this.ACCOUNT_KEY_PREFIX = 'ccr_account:'
    this.SHARED_ACCOUNTS_KEY = 'shared_ccr_accounts'

    // 使用 commonHelper 的Cifrado器
    this._encryptor = createEncryptor('ccr-account-salt')

    // 🧹 定期LimpiarCaché（每10分钟）
    setInterval(
      () => {
        this._encryptor.clearCache()
        logger.info('🧹 CCR account decrypt cache cleanup completed', this._encryptor.getStats())
      },
      10 * 60 * 1000
    )
  }

  // 🏢 CrearCCRCuenta
  async createAccount(options = {}) {
    const {
      name = 'CCR Account',
      description = '',
      apiUrl = '',
      apiKey = '',
      priority = 50, // Predeterminado优先级50（1-100）
      supportedModels = [], // Soportar的模型ColumnaTabla或映射Tabla，空Arreglo/ObjetoTabla示Soportar所有
      userAgent = 'claude-relay-service/1.0.0',
      rateLimitDuration = 60, // 限流Tiempo（分钟）
      proxy = null,
      isActive = true,
      accountType = 'shared', // 'dedicated' or 'shared'
      schedulable = true, // 是否可被调度
      dailyQuota = 0, // 每日额度Límite（美元），0Tabla示不Límite
      quotaResetTime = '00:00', // 额度重置Tiempo（HH:mmFormato）
      disableAutoProtection = false // 是否关闭自动防护（429/401/400/529 不自动Deshabilitar）
    } = options

    // Validar必填Campo
    if (!apiUrl || !apiKey) {
      throw new Error('API URL and API Key are required for CCR account')
    }

    const accountId = uuidv4()

    // Procesar supportedModels，确保向后兼容
    const processedModels = this._processModelMapping(supportedModels)

    const accountData = {
      id: accountId,
      platform: 'ccr',
      name,
      description,
      apiUrl,
      apiKey: this._encryptSensitiveData(apiKey),
      priority: priority.toString(),
      supportedModels: JSON.stringify(processedModels),
      userAgent,
      rateLimitDuration: rateLimitDuration.toString(),
      proxy: proxy ? JSON.stringify(proxy) : '',
      isActive: isActive.toString(),
      accountType,

      // ✅ Nueva característica：Cuenta订阅到期Tiempo（业务Campo，手动管理）
      // 注意：CCR 使用 API Key 认证，没有 OAuth token，因此没有 expiresAt
      subscriptionExpiresAt: options.subscriptionExpiresAt || null,

      createdAt: new Date().toISOString(),
      lastUsedAt: '',
      status: 'active',
      errorMessage: '',
      // 限流相关
      rateLimitedAt: '',
      rateLimitStatus: '',
      // 调度控制
      schedulable: schedulable.toString(),
      // 额度管理相关
      dailyQuota: dailyQuota.toString(), // 每日额度Límite（美元）
      dailyUsage: '0', // 当日使用金额（美元）
      // 使用与Estadística一致的Zona horariaFecha，避免边界问题
      lastResetDate: redis.getDateStringInTimezone(), // 最后重置Fecha（按ConfiguraciónZona horaria）
      quotaResetTime, // 额度重置Tiempo
      quotaStoppedAt: '', // 因额度停用的Tiempo
      disableAutoProtection: disableAutoProtection.toString() // 关闭自动防护
    }

    const client = redis.getClientSafe()
    logger.debug(
      `[DEBUG] Saving CCR account data to Redis with key: ${this.ACCOUNT_KEY_PREFIX}${accountId}`
    )
    logger.debug(`[DEBUG] CCR Account data to save: ${JSON.stringify(accountData, null, 2)}`)

    await client.hset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, accountData)
    await redis.addToIndex('ccr_account:index', accountId)

    // 如果是共享Cuenta，添加到共享Cuenta集合
    if (accountType === 'shared') {
      await client.sadd(this.SHARED_ACCOUNTS_KEY, accountId)
    }

    logger.success(`🏢 Created CCR account: ${name} (${accountId})`)

    return {
      id: accountId,
      name,
      description,
      apiUrl,
      priority,
      supportedModels,
      userAgent,
      rateLimitDuration,
      isActive,
      proxy,
      accountType,
      status: 'active',
      createdAt: accountData.createdAt,
      dailyQuota,
      dailyUsage: 0,
      lastResetDate: accountData.lastResetDate,
      quotaResetTime,
      quotaStoppedAt: null
    }
  }

  // 📋 Obtener所有CCRCuenta
  async getAllAccounts() {
    try {
      const accountIds = await redis.getAllIdsByIndex(
        'ccr_account:index',
        `${this.ACCOUNT_KEY_PREFIX}*`,
        /^ccr_account:(.+)$/
      )
      const keys = accountIds.map((id) => `${this.ACCOUNT_KEY_PREFIX}${id}`)
      const accounts = []
      const dataList = await redis.batchHgetallChunked(keys)

      for (let i = 0; i < keys.length; i++) {
        const accountData = dataList[i]
        if (accountData && Object.keys(accountData).length > 0) {
          // Obtener限流状态Información
          const rateLimitInfo = this._getRateLimitInfo(accountData)

          accounts.push({
            id: accountData.id,
            platform: accountData.platform,
            name: accountData.name,
            description: accountData.description,
            apiUrl: accountData.apiUrl,
            priority: parseInt(accountData.priority) || 50,
            supportedModels: JSON.parse(accountData.supportedModels || '[]'),
            userAgent: accountData.userAgent,
            rateLimitDuration: Number.isNaN(parseInt(accountData.rateLimitDuration))
              ? 60
              : parseInt(accountData.rateLimitDuration),
            isActive: accountData.isActive === 'true',
            proxy: accountData.proxy ? JSON.parse(accountData.proxy) : null,
            accountType: accountData.accountType || 'shared',
            createdAt: accountData.createdAt,
            lastUsedAt: accountData.lastUsedAt,
            status: accountData.status || 'active',
            errorMessage: accountData.errorMessage,
            rateLimitInfo,
            schedulable: accountData.schedulable !== 'false', // Predeterminado为true，只有明确Establecer为false才不可调度

            // ✅ 前端显示订阅过期Tiempo（业务Campo）
            expiresAt: accountData.subscriptionExpiresAt || null,

            // 额度管理相关
            dailyQuota: parseFloat(accountData.dailyQuota || '0'),
            dailyUsage: parseFloat(accountData.dailyUsage || '0'),
            lastResetDate: accountData.lastResetDate || '',
            quotaResetTime: accountData.quotaResetTime || '00:00',
            quotaStoppedAt: accountData.quotaStoppedAt || null,
            disableAutoProtection: accountData.disableAutoProtection === 'true'
          })
        }
      }

      return accounts
    } catch (error) {
      logger.error('❌ Failed to get CCR accounts:', error)
      throw error
    }
  }

  // 🔍 Obtener单个Cuenta（内部使用，Incluir敏感Información）
  async getAccount(accountId) {
    const client = redis.getClientSafe()
    logger.debug(`[DEBUG] Getting CCR account data for ID: ${accountId}`)
    const accountData = await client.hgetall(`${this.ACCOUNT_KEY_PREFIX}${accountId}`)

    if (!accountData || Object.keys(accountData).length === 0) {
      logger.debug(`[DEBUG] No CCR account data found for ID: ${accountId}`)
      return null
    }

    logger.debug(`[DEBUG] Raw CCR account data keys: ${Object.keys(accountData).join(', ')}`)
    logger.debug(`[DEBUG] Raw supportedModels value: ${accountData.supportedModels}`)

    // Descifrado敏感Campo（只DescifradoapiKey，apiUrl不Cifrado）
    const decryptedKey = this._decryptSensitiveData(accountData.apiKey)
    logger.debug(
      `[DEBUG] URL exists: ${!!accountData.apiUrl}, Decrypted key exists: ${!!decryptedKey}`
    )

    accountData.apiKey = decryptedKey

    // AnalizarJSONCampo
    const parsedModels = JSON.parse(accountData.supportedModels || '[]')
    logger.debug(`[DEBUG] Parsed supportedModels: ${JSON.stringify(parsedModels)}`)

    accountData.supportedModels = parsedModels
    accountData.priority = parseInt(accountData.priority) || 50
    {
      const _parsedDuration = parseInt(accountData.rateLimitDuration)
      accountData.rateLimitDuration = Number.isNaN(_parsedDuration) ? 60 : _parsedDuration
    }
    accountData.isActive = accountData.isActive === 'true'
    accountData.schedulable = accountData.schedulable !== 'false' // Predeterminado为true
    accountData.disableAutoProtection = accountData.disableAutoProtection === 'true'

    if (accountData.proxy) {
      accountData.proxy = JSON.parse(accountData.proxy)
    }

    logger.debug(
      `[DEBUG] Final CCR account data - name: ${accountData.name}, hasApiUrl: ${!!accountData.apiUrl}, hasApiKey: ${!!accountData.apiKey}, supportedModels: ${JSON.stringify(accountData.supportedModels)}`
    )

    return accountData
  }

  // 📝 ActualizarCuenta
  async updateAccount(accountId, updates) {
    try {
      const existingAccount = await this.getAccount(accountId)
      if (!existingAccount) {
        throw new Error('CCR Account not found')
      }

      const client = redis.getClientSafe()
      const updatedData = {}

      // Procesar各个Campo的Actualizar
      logger.debug(
        `[DEBUG] CCR update request received with fields: ${Object.keys(updates).join(', ')}`
      )
      logger.debug(`[DEBUG] CCR Updates content: ${JSON.stringify(updates, null, 2)}`)

      if (updates.name !== undefined) {
        updatedData.name = updates.name
      }
      if (updates.description !== undefined) {
        updatedData.description = updates.description
      }
      if (updates.apiUrl !== undefined) {
        updatedData.apiUrl = updates.apiUrl
      }
      if (updates.apiKey !== undefined) {
        updatedData.apiKey = this._encryptSensitiveData(updates.apiKey)
      }
      if (updates.priority !== undefined) {
        updatedData.priority = updates.priority.toString()
      }
      if (updates.supportedModels !== undefined) {
        logger.debug(`[DEBUG] Updating supportedModels: ${JSON.stringify(updates.supportedModels)}`)
        // Procesar supportedModels，确保向后兼容
        const processedModels = this._processModelMapping(updates.supportedModels)
        updatedData.supportedModels = JSON.stringify(processedModels)
      }
      if (updates.userAgent !== undefined) {
        updatedData.userAgent = updates.userAgent
      }
      if (updates.rateLimitDuration !== undefined) {
        updatedData.rateLimitDuration = updates.rateLimitDuration.toString()
      }
      if (updates.proxy !== undefined) {
        updatedData.proxy = updates.proxy ? JSON.stringify(updates.proxy) : ''
      }
      if (updates.isActive !== undefined) {
        updatedData.isActive = updates.isActive.toString()
      }
      if (updates.schedulable !== undefined) {
        updatedData.schedulable = updates.schedulable.toString()
      }
      if (updates.dailyQuota !== undefined) {
        updatedData.dailyQuota = updates.dailyQuota.toString()
      }
      if (updates.quotaResetTime !== undefined) {
        updatedData.quotaResetTime = updates.quotaResetTime
      }

      // ✅ 直接保存 subscriptionExpiresAt（如果提供）
      // CCR 使用 API Key，没有 token 刷新逻辑，不会覆盖此Campo
      if (updates.subscriptionExpiresAt !== undefined) {
        updatedData.subscriptionExpiresAt = updates.subscriptionExpiresAt
      }

      // 自动防护开关
      if (updates.disableAutoProtection !== undefined) {
        updatedData.disableAutoProtection = updates.disableAutoProtection.toString()
      }

      await client.hset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, updatedData)

      // Procesar共享Cuenta集合变更
      if (updates.accountType !== undefined) {
        updatedData.accountType = updates.accountType
        if (updates.accountType === 'shared') {
          await client.sadd(this.SHARED_ACCOUNTS_KEY, accountId)
        } else {
          await client.srem(this.SHARED_ACCOUNTS_KEY, accountId)
        }
      }

      logger.success(`📝 Updated CCR account: ${accountId}`)
      return await this.getAccount(accountId)
    } catch (error) {
      logger.error(`❌ Failed to update CCR account ${accountId}:`, error)
      throw error
    }
  }

  // 🗑️ EliminarCuenta
  async deleteAccount(accountId) {
    try {
      const client = redis.getClientSafe()

      // 从共享Cuenta集合中Eliminación
      await client.srem(this.SHARED_ACCOUNTS_KEY, accountId)

      // 从Índice中Eliminación
      await redis.removeFromIndex('ccr_account:index', accountId)

      // EliminarCuentaDatos
      const result = await client.del(`${this.ACCOUNT_KEY_PREFIX}${accountId}`)

      if (result === 0) {
        throw new Error('CCR Account not found or already deleted')
      }

      logger.success(`🗑️ Deleted CCR account: ${accountId}`)
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to delete CCR account ${accountId}:`, error)
      throw error
    }
  }

  // 🚫 标记Cuenta为限流状态
  async markAccountRateLimited(accountId) {
    try {
      const client = redis.getClientSafe()
      const account = await this.getAccount(accountId)
      if (!account) {
        throw new Error('CCR Account not found')
      }

      // 如果限流TiempoEstablecer为 0，Tabla示不Habilitar限流机制，直接Retornar
      if (account.rateLimitDuration === 0) {
        logger.info(
          `ℹ️ CCR account ${account.name} (${accountId}) has rate limiting disabled, skipping rate limit`
        )
        return { success: true, skipped: true }
      }

      const now = new Date().toISOString()
      await client.hmset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, {
        status: 'rate_limited',
        rateLimitedAt: now,
        rateLimitStatus: 'active',
        errorMessage: 'Rate limited by upstream service'
      })

      logger.warn(`⏱️ Marked CCR account as rate limited: ${account.name} (${accountId})`)
      return { success: true, rateLimitedAt: now }
    } catch (error) {
      logger.error(`❌ Failed to mark CCR account as rate limited: ${accountId}`, error)
      throw error
    }
  }

  // ✅ EliminaciónCuenta限流状态
  async removeAccountRateLimit(accountId) {
    try {
      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

      // ObtenerCuenta当前状态和额度Información
      const [, quotaStoppedAt] = await client.hmget(accountKey, 'status', 'quotaStoppedAt')

      // Eliminar限流相关Campo
      await client.hdel(accountKey, 'rateLimitedAt', 'rateLimitStatus')

      // 根据不同情况决定是否RestauraciónCuenta
      let newStatus = 'active'
      let errorMessage = ''

      // 如果因额度问题停用，不要自动激活
      if (quotaStoppedAt) {
        newStatus = 'quota_exceeded'
        errorMessage = 'Account stopped due to quota exceeded'
        logger.info(
          `ℹ️ CCR account ${accountId} rate limit removed but remains stopped due to quota exceeded`
        )
      } else {
        logger.success(`Removed rate limit for CCR account: ${accountId}`)
      }

      await client.hmset(accountKey, {
        status: newStatus,
        errorMessage
      })

      return { success: true, newStatus }
    } catch (error) {
      logger.error(`❌ Failed to remove rate limit for CCR account: ${accountId}`, error)
      throw error
    }
  }

  // 🔍 VerificarCuenta是否被限流
  async isAccountRateLimited(accountId) {
    try {
      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`
      const [rateLimitedAt, rateLimitDuration] = await client.hmget(
        accountKey,
        'rateLimitedAt',
        'rateLimitDuration'
      )

      if (rateLimitedAt) {
        const limitTime = new Date(rateLimitedAt)
        const duration = parseInt(rateLimitDuration) || 60
        const now = new Date()
        const expireTime = new Date(limitTime.getTime() + duration * 60 * 1000)

        if (now < expireTime) {
          return true
        } else {
          // 限流Tiempo已过，自动Eliminación限流状态
          await this.removeAccountRateLimit(accountId)
          return false
        }
      }
      return false
    } catch (error) {
      logger.error(`❌ Failed to check rate limit status for CCR account: ${accountId}`, error)
      return false
    }
  }

  // 🔥 标记Cuenta为过载状态
  async markAccountOverloaded(accountId) {
    try {
      const client = redis.getClientSafe()
      const account = await this.getAccount(accountId)
      if (!account) {
        throw new Error('CCR Account not found')
      }

      const now = new Date().toISOString()
      await client.hmset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, {
        status: 'overloaded',
        overloadedAt: now,
        errorMessage: 'Account overloaded'
      })

      logger.warn(`🔥 Marked CCR account as overloaded: ${account.name} (${accountId})`)
      return { success: true, overloadedAt: now }
    } catch (error) {
      logger.error(`❌ Failed to mark CCR account as overloaded: ${accountId}`, error)
      throw error
    }
  }

  // ✅ EliminaciónCuenta过载状态
  async removeAccountOverload(accountId) {
    try {
      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

      // Eliminar过载相关Campo
      await client.hdel(accountKey, 'overloadedAt')

      await client.hmset(accountKey, {
        status: 'active',
        errorMessage: ''
      })

      logger.success(`Removed overload status for CCR account: ${accountId}`)
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to remove overload status for CCR account: ${accountId}`, error)
      throw error
    }
  }

  // 🔍 VerificarCuenta是否过载
  async isAccountOverloaded(accountId) {
    try {
      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`
      const status = await client.hget(accountKey, 'status')
      return status === 'overloaded'
    } catch (error) {
      logger.error(`❌ Failed to check overload status for CCR account: ${accountId}`, error)
      return false
    }
  }

  // 🚫 标记Cuenta为未授权状态
  async markAccountUnauthorized(accountId) {
    try {
      const client = redis.getClientSafe()
      const account = await this.getAccount(accountId)
      if (!account) {
        throw new Error('CCR Account not found')
      }

      await client.hmset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, {
        status: 'unauthorized',
        errorMessage: 'API key invalid or unauthorized'
      })

      logger.warn(`🚫 Marked CCR account as unauthorized: ${account.name} (${accountId})`)
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to mark CCR account as unauthorized: ${accountId}`, error)
      throw error
    }
  }

  // 🔄 Procesar模型映射
  _processModelMapping(supportedModels) {
    // 如果是空Valor，Retornar空Objeto（Soportar所有模型）
    if (!supportedModels || (Array.isArray(supportedModels) && supportedModels.length === 0)) {
      return {}
    }

    // 如果已经是ObjetoFormato（新的映射TablaFormato），直接Retornar
    if (typeof supportedModels === 'object' && !Array.isArray(supportedModels)) {
      return supportedModels
    }

    // 如果是ArregloFormato（旧Formato），Convertir为映射Tabla
    if (Array.isArray(supportedModels)) {
      const mapping = {}
      supportedModels.forEach((model) => {
        if (model && typeof model === 'string') {
          mapping[model] = model // Predeterminado映射：原模型名 -> 原模型名
        }
      })
      return mapping
    }

    return {}
  }

  // 🔍 Verificar模型是否被Soportar
  isModelSupported(modelMapping, requestedModel) {
    // 如果映射Tabla为空，Soportar所有模型
    if (!modelMapping || Object.keys(modelMapping).length === 0) {
      return true
    }

    // VerificarSolicitud的模型是否在映射Tabla的键中（精确匹配）
    if (Object.prototype.hasOwnProperty.call(modelMapping, requestedModel)) {
      return true
    }

    // 尝试大小写不敏感匹配
    const requestedModelLower = requestedModel.toLowerCase()
    for (const key of Object.keys(modelMapping)) {
      if (key.toLowerCase() === requestedModelLower) {
        return true
      }
    }

    return false
  }

  // 🔄 Obtener映射后的模型Nombre
  getMappedModel(modelMapping, requestedModel) {
    // 如果映射Tabla为空，Retornar原模型
    if (!modelMapping || Object.keys(modelMapping).length === 0) {
      return requestedModel
    }

    // 精确匹配
    if (modelMapping[requestedModel]) {
      return modelMapping[requestedModel]
    }

    // 大小写不敏感匹配
    const requestedModelLower = requestedModel.toLowerCase()
    for (const [key, value] of Object.entries(modelMapping)) {
      if (key.toLowerCase() === requestedModelLower) {
        return value
      }
    }

    // 如果不存在映射则Retornar原模型名
    return requestedModel
  }

  // 🔐 Cifrado敏感Datos
  _encryptSensitiveData(data) {
    return this._encryptor.encrypt(data)
  }

  // 🔓 Descifrado敏感Datos
  _decryptSensitiveData(encryptedData) {
    return this._encryptor.decrypt(encryptedData)
  }

  // 🔍 Obtener限流状态Información
  _getRateLimitInfo(accountData) {
    const { rateLimitedAt } = accountData
    const rateLimitDuration = parseInt(accountData.rateLimitDuration) || 60

    if (rateLimitedAt) {
      const limitTime = new Date(rateLimitedAt)
      const now = new Date()
      const expireTime = new Date(limitTime.getTime() + rateLimitDuration * 60 * 1000)
      const remainingMs = expireTime.getTime() - now.getTime()

      return {
        isRateLimited: remainingMs > 0,
        rateLimitedAt,
        rateLimitExpireAt: expireTime.toISOString(),
        remainingTimeMs: Math.max(0, remainingMs),
        remainingTimeMinutes: Math.max(0, Math.ceil(remainingMs / (60 * 1000)))
      }
    }

    return {
      isRateLimited: false,
      rateLimitedAt: null,
      rateLimitExpireAt: null,
      remainingTimeMs: 0,
      remainingTimeMinutes: 0
    }
  }

  // 🔧 CrearProxyCliente
  _createProxyAgent(proxy) {
    return ProxyHelper.createProxyAgent(proxy)
  }

  // 💰 VerificarCuota使用情况（Opcional实现）
  async checkQuotaUsage(accountId) {
    try {
      const account = await this.getAccount(accountId)
      if (!account) {
        return false
      }

      const dailyQuota = parseFloat(account.dailyQuota || '0')
      // 如果未Establecer额度Límite，则不Límite
      if (dailyQuota <= 0) {
        return false
      }

      // Verificar是否需要重置每日使用量
      const today = redis.getDateStringInTimezone()
      if (account.lastResetDate !== today) {
        await this.resetDailyUsage(accountId)
        return false // 刚重置，不会超额
      }

      // Obtener当日使用Estadística
      const usageStats = await this.getAccountUsageStats(accountId)
      if (!usageStats) {
        return false
      }

      const dailyUsage = usageStats.dailyUsage || 0
      const isExceeded = dailyUsage >= dailyQuota

      if (isExceeded) {
        // 标记Cuenta因额度停用
        const client = redis.getClientSafe()
        await client.hmset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, {
          status: 'quota_exceeded',
          errorMessage: `Daily quota exceeded: $${dailyUsage.toFixed(2)} / $${dailyQuota.toFixed(2)}`,
          quotaStoppedAt: new Date().toISOString()
        })
        logger.warn(
          `💰 CCR account ${account.name} (${accountId}) quota exceeded: $${dailyUsage.toFixed(2)} / $${dailyQuota.toFixed(2)}`
        )

        // 发送 Webhook 通知
        try {
          const webhookNotifier = require('../../utils/webhookNotifier')
          await webhookNotifier.sendAccountAnomalyNotification({
            accountId,
            accountName: account.name || accountId,
            platform: 'ccr',
            status: 'quota_exceeded',
            errorCode: 'QUOTA_EXCEEDED',
            reason: `Daily quota exceeded: $${dailyUsage.toFixed(2)} / $${dailyQuota.toFixed(2)}`,
            timestamp: new Date().toISOString()
          })
        } catch (webhookError) {
          logger.warn('Failed to send webhook notification for CCR quota exceeded:', webhookError)
        }
      }

      return isExceeded
    } catch (error) {
      logger.error(`❌ Failed to check quota usage for CCR account ${accountId}:`, error)
      return false
    }
  }

  // 🔄 重置每日使用量（Opcional实现）
  async resetDailyUsage(accountId) {
    try {
      const client = redis.getClientSafe()
      await client.hmset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, {
        dailyUsage: '0',
        lastResetDate: redis.getDateStringInTimezone(),
        quotaStoppedAt: ''
      })
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to reset daily usage for CCR account: ${accountId}`, error)
      throw error
    }
  }

  // 🚫 VerificarCuenta是否超额
  async isAccountQuotaExceeded(accountId) {
    try {
      const account = await this.getAccount(accountId)
      if (!account) {
        return false
      }

      const dailyQuota = parseFloat(account.dailyQuota || '0')
      // 如果未Establecer额度Límite，则不Límite
      if (dailyQuota <= 0) {
        return false
      }

      // Obtener当日使用Estadística
      const usageStats = await this.getAccountUsageStats(accountId)
      if (!usageStats) {
        return false
      }

      const dailyUsage = usageStats.dailyUsage || 0
      const isExceeded = dailyUsage >= dailyQuota

      if (isExceeded && !account.quotaStoppedAt) {
        // 标记Cuenta因额度停用
        const client = redis.getClientSafe()
        await client.hmset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, {
          status: 'quota_exceeded',
          errorMessage: `Daily quota exceeded: $${dailyUsage.toFixed(2)} / $${dailyQuota.toFixed(2)}`,
          quotaStoppedAt: new Date().toISOString()
        })
        logger.warn(`💰 CCR account ${account.name} (${accountId}) quota exceeded`)
      }

      return isExceeded
    } catch (error) {
      logger.error(`❌ Failed to check quota for CCR account ${accountId}:`, error)
      return false
    }
  }

  // 🔄 重置所有CCRCuenta的每日使用量
  async resetAllDailyUsage() {
    try {
      const accounts = await this.getAllAccounts()
      const today = redis.getDateStringInTimezone()
      let resetCount = 0

      for (const account of accounts) {
        if (account.lastResetDate !== today) {
          await this.resetDailyUsage(account.id)
          resetCount += 1
        }
      }

      logger.success(`Reset daily usage for ${resetCount} CCR accounts`)
      return { success: true, resetCount }
    } catch (error) {
      logger.error('❌ Failed to reset all CCR daily usage:', error)
      throw error
    }
  }

  // 📊 ObtenerCCRCuenta使用Estadística（含每日费用）
  async getAccountUsageStats(accountId) {
    try {
      // 使用统一的 Redis Estadística
      const usageStats = await redis.getAccountUsageStats(accountId)

      // 叠加Cuenta自身的额度Configuración
      const accountData = await this.getAccount(accountId)
      if (!accountData) {
        return null
      }

      const dailyQuota = parseFloat(accountData.dailyQuota || '0')
      const currentDailyCost = usageStats?.daily?.cost || 0

      return {
        dailyQuota,
        dailyUsage: currentDailyCost,
        remainingQuota: dailyQuota > 0 ? Math.max(0, dailyQuota - currentDailyCost) : null,
        usagePercentage: dailyQuota > 0 ? (currentDailyCost / dailyQuota) * 100 : 0,
        lastResetDate: accountData.lastResetDate,
        quotaResetTime: accountData.quotaResetTime,
        quotaStoppedAt: accountData.quotaStoppedAt,
        isQuotaExceeded: dailyQuota > 0 && currentDailyCost >= dailyQuota,
        fullUsageStats: usageStats
      }
    } catch (error) {
      logger.error('❌ Failed to get CCR account usage stats:', error)
      return null
    }
  }

  // 🔄 重置CCRCuenta所有异常状态
  async resetAccountStatus(accountId) {
    try {
      const accountData = await this.getAccount(accountId)
      if (!accountData) {
        throw new Error('Account not found')
      }

      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

      const updates = {
        status: 'active',
        errorMessage: '',
        schedulable: 'true',
        isActive: 'true'
      }

      const fieldsToDelete = [
        'rateLimitedAt',
        'rateLimitStatus',
        'unauthorizedAt',
        'unauthorizedCount',
        'overloadedAt',
        'overloadStatus',
        'blockedAt',
        'quotaStoppedAt'
      ]

      await client.hset(accountKey, updates)
      await client.hdel(accountKey, ...fieldsToDelete)

      logger.success(`Reset all error status for CCR account ${accountId}`)

      // 清除临时不可用状态
      await upstreamErrorHelper.clearTempUnavailable(accountId, 'ccr').catch(() => {})

      // Asíncrono发送 Webhook 通知（忽略Error）
      try {
        const webhookNotifier = require('../../utils/webhookNotifier')
        await webhookNotifier.sendAccountAnomalyNotification({
          accountId,
          accountName: accountData.name || accountId,
          platform: 'ccr',
          status: 'recovered',
          errorCode: 'STATUS_RESET',
          reason: 'Account status manually reset',
          timestamp: new Date().toISOString()
        })
      } catch (webhookError) {
        logger.warn('Failed to send webhook notification for CCR status reset:', webhookError)
      }

      return { success: true, accountId }
    } catch (error) {
      logger.error(`❌ Failed to reset CCR account status: ${accountId}`, error)
      throw error
    }
  }

  /**
   * ⏰ VerificarCuenta订阅是否过期
   * @param {Object} account - CuentaObjeto
   * @returns {boolean} - true: 已过期, false: 未过期
   */
  isSubscriptionExpired(account) {
    if (!account.subscriptionExpiresAt) {
      return false // 未Establecer视为永不过期
    }
    const expiryDate = new Date(account.subscriptionExpiresAt)
    return expiryDate <= new Date()
  }
}

module.exports = new CcrAccountService()
