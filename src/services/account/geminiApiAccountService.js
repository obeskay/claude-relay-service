const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const redis = require('../../models/redis')
const logger = require('../../utils/logger')
const config = require('../../../config/config')
const LRUCache = require('../../utils/lruCache')
const upstreamErrorHelper = require('../../utils/upstreamErrorHelper')

class GeminiApiAccountService {
  constructor() {
    // Cifrado相关常量
    this.ENCRYPTION_ALGORITHM = 'aes-256-cbc'
    this.ENCRYPTION_SALT = 'gemini-api-salt'

    // Redis 键前缀
    this.ACCOUNT_KEY_PREFIX = 'gemini_api_account:'
    this.SHARED_ACCOUNTS_KEY = 'shared_gemini_api_accounts'

    // 🚀 RendimientoOptimización：Caché派生的CifradoClave，避免每次重复Calcular
    this._encryptionKeyCache = null

    // 🔄 Descifrado结果Caché，提高DescifradoRendimiento
    this._decryptCache = new LRUCache(500)

    // 🧹 定期LimpiarCaché（每10分钟）
    setInterval(
      () => {
        this._decryptCache.cleanup()
        logger.info('🧹 Gemini-API decrypt cache cleanup completed', this._decryptCache.getStats())
      },
      10 * 60 * 1000
    )
  }

  // CrearCuenta
  async createAccount(options = {}) {
    const {
      name = 'Gemini API Account',
      description = '',
      apiKey = '', // 必填：Google AI Studio API Key
      baseUrl = 'https://generativelanguage.googleapis.com', // Predeterminado Gemini API 基础 URL
      proxy = null,
      priority = 50, // 调度优先级 (1-100)
      isActive = true,
      accountType = 'shared', // 'dedicated' or 'shared'
      schedulable = true, // 是否可被调度
      supportedModels = [], // Soportar的模型ColumnaTabla
      rateLimitDuration = 60, // 限流Tiempo（分钟）
      disableAutoProtection = false
    } = options

    // Validar必填Campo
    if (!apiKey) {
      throw new Error('API Key is required for Gemini-API account')
    }

    // 规范化 baseUrl（确保不以 / 结尾）
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

    const accountId = uuidv4()

    const accountData = {
      id: accountId,
      platform: 'gemini-api',
      name,
      description,
      baseUrl: normalizedBaseUrl,
      apiKey: this._encryptSensitiveData(apiKey),
      priority: priority.toString(),
      proxy: proxy ? JSON.stringify(proxy) : '',
      isActive: isActive.toString(),
      accountType,
      schedulable: schedulable.toString(),
      supportedModels: JSON.stringify(supportedModels),

      createdAt: new Date().toISOString(),
      lastUsedAt: '',
      status: 'active',
      errorMessage: '',

      // 限流相关
      rateLimitedAt: '',
      rateLimitStatus: '',
      rateLimitDuration: rateLimitDuration.toString(),

      // 自动防护开关
      disableAutoProtection:
        disableAutoProtection === true || disableAutoProtection === 'true' ? 'true' : 'false'
    }

    // 保存到 Redis
    await this._saveAccount(accountId, accountData)

    logger.success(`Created Gemini-API account: ${name} (${accountId})`)

    return {
      ...accountData,
      apiKey: '***' // Retornar时隐藏敏感Información
    }
  }

  // ObtenerCuenta
  async getAccount(accountId) {
    const client = redis.getClientSafe()
    const key = `${this.ACCOUNT_KEY_PREFIX}${accountId}`
    const accountData = await client.hgetall(key)

    if (!accountData || !accountData.id) {
      return null
    }

    // Descifrado敏感Datos
    accountData.apiKey = this._decryptSensitiveData(accountData.apiKey)

    // Analizar JSON Campo
    if (accountData.proxy) {
      try {
        accountData.proxy = JSON.parse(accountData.proxy)
      } catch (e) {
        accountData.proxy = null
      }
    }

    if (accountData.supportedModels) {
      try {
        accountData.supportedModels = JSON.parse(accountData.supportedModels)
      } catch (e) {
        accountData.supportedModels = []
      }
    }

    return accountData
  }

  // ActualizarCuenta
  async updateAccount(accountId, updates) {
    const account = await this.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    // Procesar敏感CampoCifrado
    if (updates.apiKey) {
      updates.apiKey = this._encryptSensitiveData(updates.apiKey)
    }

    // Procesar JSON Campo
    if (updates.proxy !== undefined) {
      updates.proxy = updates.proxy ? JSON.stringify(updates.proxy) : ''
    }

    if (updates.supportedModels !== undefined) {
      updates.supportedModels = JSON.stringify(updates.supportedModels)
    }

    // 规范化 baseUrl
    if (updates.baseUrl) {
      updates.baseUrl = updates.baseUrl.endsWith('/')
        ? updates.baseUrl.slice(0, -1)
        : updates.baseUrl
    }

    // Procesar disableAutoProtection 布尔Valor转Cadena
    if (updates.disableAutoProtection !== undefined) {
      updates.disableAutoProtection =
        updates.disableAutoProtection === true || updates.disableAutoProtection === 'true'
          ? 'true'
          : 'false'
    }

    // Actualizar Redis
    const client = redis.getClientSafe()
    const key = `${this.ACCOUNT_KEY_PREFIX}${accountId}`
    await client.hset(key, updates)

    logger.info(`📝 Updated Gemini-API account: ${account.name}`)

    return { success: true }
  }

  // EliminarCuenta
  async deleteAccount(accountId) {
    const client = redis.getClientSafe()
    const key = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

    // 从共享CuentaColumnaTabla中Eliminación
    await client.srem(this.SHARED_ACCOUNTS_KEY, accountId)

    // 从Índice中Eliminación
    await redis.removeFromIndex('gemini_api_account:index', accountId)

    // EliminarCuentaDatos
    await client.del(key)

    logger.info(`🗑️ Deleted Gemini-API account: ${accountId}`)

    return { success: true }
  }

  // Obtener所有Cuenta
  async getAllAccounts(includeInactive = false) {
    const client = redis.getClientSafe()
    const accountIds = await client.smembers(this.SHARED_ACCOUNTS_KEY)
    const accounts = []

    for (const accountId of accountIds) {
      const account = await this.getAccount(accountId)
      if (account) {
        // Filtrar非活跃Cuenta
        if (includeInactive || account.isActive === 'true') {
          // 隐藏敏感Información
          account.apiKey = '***'

          // Obtener限流状态Información
          const rateLimitInfo = this._getRateLimitInfo(account)

          // Formato化 rateLimitStatus 为Objeto
          account.rateLimitStatus = rateLimitInfo.isRateLimited
            ? {
                isRateLimited: true,
                rateLimitedAt: account.rateLimitedAt || null,
                minutesRemaining: rateLimitInfo.remainingMinutes || 0
              }
            : {
                isRateLimited: false,
                rateLimitedAt: null,
                minutesRemaining: 0
              }

          // Convertir schedulable Campo为布尔Valor
          account.schedulable = account.schedulable !== 'false'
          // Convertir isActive Campo为布尔Valor
          account.isActive = account.isActive === 'true'

          account.platform = account.platform || 'gemini-api'

          accounts.push(account)
        }
      }
    }

    // 直接从 Redis Obtener所有Cuenta（包括非共享Cuenta）
    const allAccountIds = await redis.getAllIdsByIndex(
      'gemini_api_account:index',
      `${this.ACCOUNT_KEY_PREFIX}*`,
      /^gemini_api_account:(.+)$/
    )
    const keys = allAccountIds.map((id) => `${this.ACCOUNT_KEY_PREFIX}${id}`)
    const dataList = await redis.batchHgetallChunked(keys)
    for (let i = 0; i < allAccountIds.length; i++) {
      const accountId = allAccountIds[i]
      if (!accountIds.includes(accountId)) {
        const accountData = dataList[i]
        if (accountData && accountData.id) {
          // Filtrar非活跃Cuenta
          if (includeInactive || accountData.isActive === 'true') {
            // 隐藏敏感Información
            accountData.apiKey = '***'

            // Analizar JSON Campo
            if (accountData.proxy) {
              try {
                accountData.proxy = JSON.parse(accountData.proxy)
              } catch (e) {
                accountData.proxy = null
              }
            }

            if (accountData.supportedModels) {
              try {
                accountData.supportedModels = JSON.parse(accountData.supportedModels)
              } catch (e) {
                accountData.supportedModels = []
              }
            }

            // Obtener限流状态Información
            const rateLimitInfo = this._getRateLimitInfo(accountData)

            // Formato化 rateLimitStatus 为Objeto
            accountData.rateLimitStatus = rateLimitInfo.isRateLimited
              ? {
                  isRateLimited: true,
                  rateLimitedAt: accountData.rateLimitedAt || null,
                  minutesRemaining: rateLimitInfo.remainingMinutes || 0
                }
              : {
                  isRateLimited: false,
                  rateLimitedAt: null,
                  minutesRemaining: 0
                }

            // Convertir schedulable Campo为布尔Valor
            accountData.schedulable = accountData.schedulable !== 'false'
            // Convertir isActive Campo为布尔Valor
            accountData.isActive = accountData.isActive === 'true'

            accountData.platform = accountData.platform || 'gemini-api'

            accounts.push(accountData)
          }
        }
      }
    }

    return accounts
  }

  // 标记Cuenta已使用
  async markAccountUsed(accountId) {
    await this.updateAccount(accountId, {
      lastUsedAt: new Date().toISOString()
    })
  }

  // 标记Cuenta限流
  async setAccountRateLimited(accountId, isLimited, duration = null) {
    const account = await this.getAccount(accountId)
    if (!account) {
      return
    }

    if (isLimited) {
      const rateLimitDuration = duration || parseInt(account.rateLimitDuration) || 60
      const now = new Date()
      const resetAt = new Date(now.getTime() + rateLimitDuration * 60000)

      await this.updateAccount(accountId, {
        rateLimitedAt: now.toISOString(),
        rateLimitStatus: 'limited',
        rateLimitResetAt: resetAt.toISOString(),
        rateLimitDuration: rateLimitDuration.toString(),
        status: 'rateLimited',
        schedulable: 'false', // 防止被调度
        errorMessage: `Rate limited until ${resetAt.toISOString()}`
      })

      logger.warn(
        `⏳ Gemini-API account ${account.name} marked as rate limited for ${rateLimitDuration} minutes (until ${resetAt.toISOString()})`
      )
    } else {
      // 清除限流状态
      await this.updateAccount(accountId, {
        rateLimitedAt: '',
        rateLimitStatus: '',
        rateLimitResetAt: '',
        status: 'active',
        schedulable: 'true',
        errorMessage: ''
      })

      logger.info(`✅ Rate limit cleared for Gemini-API account ${account.name}`)
    }
  }

  // 🚫 标记Cuenta为未授权状态（401Error）
  async markAccountUnauthorized(accountId, reason = 'Gemini API账号认证Falló（401Error）') {
    const account = await this.getAccount(accountId)
    if (!account) {
      return
    }

    const now = new Date().toISOString()
    const currentCount = parseInt(account.unauthorizedCount || '0', 10)
    const unauthorizedCount = Number.isFinite(currentCount) ? currentCount + 1 : 1

    await this.updateAccount(accountId, {
      status: 'unauthorized',
      schedulable: 'false',
      errorMessage: reason,
      unauthorizedAt: now,
      unauthorizedCount: unauthorizedCount.toString()
    })

    logger.warn(
      `🚫 Gemini-API account ${account.name || accountId} marked as unauthorized due to 401 error`
    )

    try {
      const webhookNotifier = require('../../utils/webhookNotifier')
      await webhookNotifier.sendAccountAnomalyNotification({
        accountId,
        accountName: account.name || accountId,
        platform: 'gemini-api',
        status: 'unauthorized',
        errorCode: 'GEMINI_API_UNAUTHORIZED',
        reason,
        timestamp: now
      })
      logger.info(
        `📢 Webhook notification sent for Gemini-API account ${account.name || accountId} unauthorized state`
      )
    } catch (webhookError) {
      logger.error('Failed to send unauthorized webhook notification:', webhookError)
    }
  }

  // Verificar并清除过期的限流状态
  async checkAndClearRateLimit(accountId) {
    const account = await this.getAccount(accountId)
    if (!account || account.rateLimitStatus !== 'limited') {
      return false
    }

    const now = new Date()
    let shouldClear = false

    // 优先使用 rateLimitResetAt Campo
    if (account.rateLimitResetAt) {
      const resetAt = new Date(account.rateLimitResetAt)
      shouldClear = now >= resetAt
    } else {
      // 如果没有 rateLimitResetAt，使用旧的逻辑
      const rateLimitedAt = new Date(account.rateLimitedAt)
      const rateLimitDuration = parseInt(account.rateLimitDuration) || 60
      shouldClear = now - rateLimitedAt > rateLimitDuration * 60000
    }

    if (shouldClear) {
      // 限流已过期，清除状态
      await this.setAccountRateLimited(accountId, false)
      return true
    }

    return false
  }

  // 切换调度状态
  async toggleSchedulable(accountId) {
    const account = await this.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    const newSchedulableStatus = account.schedulable === 'true' ? 'false' : 'true'
    await this.updateAccount(accountId, {
      schedulable: newSchedulableStatus
    })

    logger.info(
      `🔄 Toggled schedulable status for Gemini-API account ${account.name}: ${newSchedulableStatus}`
    )

    return {
      success: true,
      schedulable: newSchedulableStatus === 'true'
    }
  }

  // 重置Cuenta状态（清除所有异常状态）
  async resetAccountStatus(accountId) {
    const account = await this.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    const updates = {
      // 根据是否有有效的 apiKey 来Establecer status
      status: account.apiKey ? 'active' : 'created',
      // Restauración可调度状态
      schedulable: 'true',
      // 清除Error相关Campo
      errorMessage: '',
      rateLimitedAt: '',
      rateLimitStatus: '',
      rateLimitResetAt: '',
      rateLimitDuration: ''
    }

    await this.updateAccount(accountId, updates)
    logger.info(`✅ Reset all error status for Gemini-API account ${accountId}`)

    // 清除临时不可用状态
    await upstreamErrorHelper.clearTempUnavailable(accountId, 'gemini-api').catch(() => {})

    // 发送 Webhook 通知
    try {
      const webhookNotifier = require('../../utils/webhookNotifier')
      await webhookNotifier.sendAccountAnomalyNotification({
        accountId,
        accountName: account.name || accountId,
        platform: 'gemini-api',
        status: 'recovered',
        errorCode: 'STATUS_RESET',
        reason: 'Account status manually reset',
        timestamp: new Date().toISOString()
      })
      logger.info(
        `📢 Webhook notification sent for Gemini-API account ${account.name} status reset`
      )
    } catch (webhookError) {
      logger.error('Failed to send status reset webhook notification:', webhookError)
    }

    return { success: true, message: 'Account status reset successfully' }
  }

  // API Key 不会过期
  isTokenExpired(_account) {
    return false
  }

  // Obtener限流Información
  _getRateLimitInfo(accountData) {
    if (accountData.rateLimitStatus !== 'limited') {
      return { isRateLimited: false }
    }

    const now = new Date()
    let willBeAvailableAt
    let remainingMinutes

    // 优先使用 rateLimitResetAt Campo
    if (accountData.rateLimitResetAt) {
      willBeAvailableAt = new Date(accountData.rateLimitResetAt)
      remainingMinutes = Math.max(0, Math.ceil((willBeAvailableAt - now) / 60000))
    } else {
      // 如果没有 rateLimitResetAt，使用旧的逻辑
      const rateLimitedAt = new Date(accountData.rateLimitedAt)
      const rateLimitDuration = parseInt(accountData.rateLimitDuration) || 60
      const elapsedMinutes = Math.floor((now - rateLimitedAt) / 60000)
      remainingMinutes = Math.max(0, rateLimitDuration - elapsedMinutes)
      willBeAvailableAt = new Date(rateLimitedAt.getTime() + rateLimitDuration * 60000)
    }

    return {
      isRateLimited: remainingMinutes > 0,
      remainingMinutes,
      willBeAvailableAt
    }
  }

  // Cifrado敏感Datos
  _encryptSensitiveData(text) {
    if (!text) {
      return ''
    }

    const key = this._getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv)

    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`
  }

  // Descifrado敏感Datos
  _decryptSensitiveData(text) {
    if (!text || text === '') {
      return ''
    }

    // VerificarCaché
    const cacheKey = crypto.createHash('sha256').update(text).digest('hex')
    const cached = this._decryptCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    try {
      const key = this._getEncryptionKey()
      const [ivHex, encryptedHex] = text.split(':')

      const iv = Buffer.from(ivHex, 'hex')
      const encryptedText = Buffer.from(encryptedHex, 'hex')

      const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv)
      let decrypted = decipher.update(encryptedText)
      decrypted = Buffer.concat([decrypted, decipher.final()])

      const result = decrypted.toString()

      // 存入Caché（5分钟过期）
      this._decryptCache.set(cacheKey, result, 5 * 60 * 1000)

      return result
    } catch (error) {
      logger.error('Decryption error:', error)
      return ''
    }
  }

  // ObtenerCifradoClave
  _getEncryptionKey() {
    if (!this._encryptionKeyCache) {
      this._encryptionKeyCache = crypto.scryptSync(
        config.security.encryptionKey,
        this.ENCRYPTION_SALT,
        32
      )
    }
    return this._encryptionKeyCache
  }

  // 保存Cuenta到 Redis
  async _saveAccount(accountId, accountData) {
    const client = redis.getClientSafe()
    const key = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

    // 保存CuentaDatos
    await client.hset(key, accountData)

    // 添加到Índice
    await redis.addToIndex('gemini_api_account:index', accountId)

    // 添加到共享CuentaColumnaTabla
    if (accountData.accountType === 'shared') {
      await client.sadd(this.SHARED_ACCOUNTS_KEY, accountId)
    }
  }
}

module.exports = new GeminiApiAccountService()
