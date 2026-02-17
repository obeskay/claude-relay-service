const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const ProxyHelper = require('../../utils/proxyHelper')
const redis = require('../../models/redis')
const logger = require('../../utils/logger')
const config = require('../../../config/config')
const LRUCache = require('../../utils/lruCache')
const upstreamErrorHelper = require('../../utils/upstreamErrorHelper')

class ClaudeConsoleAccountService {
  constructor() {
    // Cifrado相关常量
    this.ENCRYPTION_ALGORITHM = 'aes-256-cbc'
    this.ENCRYPTION_SALT = 'claude-console-salt'

    // Redis键前缀
    this.ACCOUNT_KEY_PREFIX = 'claude_console_account:'
    this.SHARED_ACCOUNTS_KEY = 'shared_claude_console_accounts'

    // 🚀 RendimientoOptimización：Caché派生的CifradoClave，避免每次重复Calcular
    // scryptSync 是 CPU 密集型Operación，Caché可以减少 95%+ 的 CPU 密集型Operación
    this._encryptionKeyCache = null

    // 🔄 Descifrado结果Caché，提高DescifradoRendimiento
    this._decryptCache = new LRUCache(500)

    // 🧹 定期LimpiarCaché（每10分钟）
    setInterval(
      () => {
        this._decryptCache.cleanup()
        logger.info(
          '🧹 Claude Console decrypt cache cleanup completed',
          this._decryptCache.getStats()
        )
      },
      10 * 60 * 1000
    )
  }

  _getBlockedHandlingMinutes() {
    const raw = process.env.CLAUDE_CONSOLE_BLOCKED_HANDLING_MINUTES
    if (raw === undefined || raw === null || raw === '') {
      return 0
    }

    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0
    }

    return parsed
  }

  // 🏢 CrearClaude ConsoleCuenta
  async createAccount(options = {}) {
    const {
      name = 'Claude Console Account',
      description = '',
      apiUrl = '',
      apiKey = '',
      priority = 50, // Predeterminado优先级50（1-100）
      supportedModels = [], // Soportar的模型ColumnaTabla或映射Tabla，空Arreglo/ObjetoTabla示Soportar所有
      userAgent = 'claude-cli/1.0.69 (external, cli)',
      rateLimitDuration = 60, // 限流Tiempo（分钟）
      proxy = null,
      isActive = true,
      accountType = 'shared', // 'dedicated' or 'shared'
      schedulable = true, // 是否可被调度
      dailyQuota = 0, // 每日额度Límite（美元），0Tabla示不Límite
      quotaResetTime = '00:00', // 额度重置Tiempo（HH:mmFormato）
      maxConcurrentTasks = 0, // 最大Concurrencia任务数，0Tabla示无Límite
      disableAutoProtection = false, // 是否关闭自动防护（429/401/400/529 不自动Deshabilitar）
      interceptWarmup = false // 拦截预热Solicitud（标题Generar、Warmup等）
    } = options

    // Validar必填Campo
    if (!apiUrl || !apiKey) {
      throw new Error('API URL and API Key are required for Claude Console account')
    }

    const accountId = uuidv4()

    // Procesar supportedModels，确保向后兼容
    const processedModels = this._processModelMapping(supportedModels)

    const accountData = {
      id: accountId,
      platform: 'claude-console',
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
      createdAt: new Date().toISOString(),
      lastUsedAt: '',
      status: 'active',
      errorMessage: '',

      // ✅ Nueva característica：Cuenta订阅到期Tiempo（业务Campo，手动管理）
      // 注意：Claude Console 没有 OAuth token，因此没有 expiresAt（token过期）
      subscriptionExpiresAt: options.subscriptionExpiresAt || null,

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
      maxConcurrentTasks: maxConcurrentTasks.toString(), // 最大Concurrencia任务数，0Tabla示无Límite
      disableAutoProtection: disableAutoProtection.toString(), // 关闭自动防护
      interceptWarmup: interceptWarmup.toString() // 拦截预热Solicitud
    }

    const client = redis.getClientSafe()
    logger.debug(
      `[DEBUG] Saving account data to Redis with key: ${this.ACCOUNT_KEY_PREFIX}${accountId}`
    )
    logger.debug(`[DEBUG] Account data to save: ${JSON.stringify(accountData, null, 2)}`)

    await client.hset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, accountData)
    await redis.addToIndex('claude_console_account:index', accountId)

    // 如果是共享Cuenta，添加到共享Cuenta集合
    if (accountType === 'shared') {
      await client.sadd(this.SHARED_ACCOUNTS_KEY, accountId)
    }

    logger.success(`🏢 Created Claude Console account: ${name} (${accountId})`)

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
      quotaStoppedAt: null,
      maxConcurrentTasks, // Nueva característica：RetornarConcurrenciaLímiteConfiguración
      disableAutoProtection, // Nueva característica：Retornar自动防护开关
      interceptWarmup, // Nueva característica：Retornar预热Solicitud拦截开关
      activeTaskCount: 0 // Nueva característica：新建Cuenta当前Nivel de concurrencia为0
    }
  }

  // 📋 Obtener所有Claude ConsoleCuenta
  async getAllAccounts() {
    try {
      const client = redis.getClientSafe()
      const accountIds = await redis.getAllIdsByIndex(
        'claude_console_account:index',
        `${this.ACCOUNT_KEY_PREFIX}*`,
        /^claude_console_account:(.+)$/
      )
      const keys = accountIds.map((id) => `${this.ACCOUNT_KEY_PREFIX}${id}`)
      const accounts = []
      const dataList = await redis.batchHgetallChunked(keys)

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const accountData = dataList[i]
        if (accountData && Object.keys(accountData).length > 0) {
          if (!accountData.id) {
            logger.warn(`⚠️ 检测到缺少ID的Claude ConsoleCuentaDatos，EjecutarLimpiar: ${key}`)
            await client.del(key)
            continue
          }

          // Obtener限流状态Información
          const rateLimitInfo = this._getRateLimitInfo(accountData)

          // Obtener实时Concurrencia计数
          const activeTaskCount = await redis.getConsoleAccountConcurrency(accountData.id)

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

            // Concurrencia控制相关
            maxConcurrentTasks: parseInt(accountData.maxConcurrentTasks) || 0,
            activeTaskCount,
            disableAutoProtection: accountData.disableAutoProtection === 'true',
            // 拦截预热Solicitud
            interceptWarmup: accountData.interceptWarmup === 'true'
          })
        }
      }

      return accounts
    } catch (error) {
      logger.error('❌ Failed to get Claude Console accounts:', error)
      throw error
    }
  }

  // 🔍 Obtener单个Cuenta（内部使用，Incluir敏感Información）
  async getAccount(accountId) {
    const client = redis.getClientSafe()
    logger.debug(`[DEBUG] Getting account data for ID: ${accountId}`)
    const accountData = await client.hgetall(`${this.ACCOUNT_KEY_PREFIX}${accountId}`)

    if (!accountData || Object.keys(accountData).length === 0) {
      logger.debug(`[DEBUG] No account data found for ID: ${accountId}`)
      return null
    }

    logger.debug(`[DEBUG] Raw account data keys: ${Object.keys(accountData).join(', ')}`)
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

    // AnalizarConcurrencia控制Campo
    accountData.maxConcurrentTasks = parseInt(accountData.maxConcurrentTasks) || 0
    // Obtener实时Concurrencia计数
    accountData.activeTaskCount = await redis.getConsoleAccountConcurrency(accountId)

    logger.debug(
      `[DEBUG] Final account data - name: ${accountData.name}, hasApiUrl: ${!!accountData.apiUrl}, hasApiKey: ${!!accountData.apiKey}, supportedModels: ${JSON.stringify(accountData.supportedModels)}`
    )

    return accountData
  }

  // 📝 ActualizarCuenta
  async updateAccount(accountId, updates) {
    try {
      const existingAccount = await this.getAccount(accountId)
      if (!existingAccount) {
        throw new Error('Account not found')
      }

      const client = redis.getClientSafe()
      const updatedData = {}

      // Procesar各个Campo的Actualizar
      logger.debug(
        `[DEBUG] Update request received with fields: ${Object.keys(updates).join(', ')}`
      )
      logger.debug(`[DEBUG] Updates content: ${JSON.stringify(updates, null, 2)}`)

      if (updates.name !== undefined) {
        updatedData.name = updates.name
      }
      if (updates.description !== undefined) {
        updatedData.description = updates.description
      }
      if (updates.apiUrl !== undefined) {
        logger.debug(`[DEBUG] Updating apiUrl from frontend: ${updates.apiUrl}`)
        updatedData.apiUrl = updates.apiUrl
      }
      if (updates.apiKey !== undefined) {
        logger.debug(`[DEBUG] Updating apiKey (length: ${updates.apiKey?.length})`)
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
        // 如果是手动修改调度状态，清除所有自动停止相关的Campo
        // 防止自动Restauración
        updatedData.rateLimitAutoStopped = ''
        updatedData.quotaAutoStopped = ''
        // 兼容旧的标记
        updatedData.autoStoppedAt = ''
        updatedData.stoppedReason = ''

        // RegistroRegistro
        if (updates.schedulable === true || updates.schedulable === 'true') {
          logger.info(`✅ Manually enabled scheduling for Claude Console account ${accountId}`)
        } else {
          logger.info(`⛔ Manually disabled scheduling for Claude Console account ${accountId}`)
        }
      }

      // 额度管理相关Campo
      if (updates.dailyQuota !== undefined) {
        updatedData.dailyQuota = updates.dailyQuota.toString()
      }
      if (updates.quotaResetTime !== undefined) {
        updatedData.quotaResetTime = updates.quotaResetTime
      }
      if (updates.dailyUsage !== undefined) {
        updatedData.dailyUsage = updates.dailyUsage.toString()
      }
      if (updates.lastResetDate !== undefined) {
        updatedData.lastResetDate = updates.lastResetDate
      }
      if (updates.quotaStoppedAt !== undefined) {
        updatedData.quotaStoppedAt = updates.quotaStoppedAt
      }

      // Concurrencia控制相关Campo
      if (updates.maxConcurrentTasks !== undefined) {
        updatedData.maxConcurrentTasks = updates.maxConcurrentTasks.toString()
      }
      if (updates.disableAutoProtection !== undefined) {
        updatedData.disableAutoProtection = updates.disableAutoProtection.toString()
      }
      if (updates.interceptWarmup !== undefined) {
        updatedData.interceptWarmup = updates.interceptWarmup.toString()
      }

      // ✅ 直接保存 subscriptionExpiresAt（如果提供）
      // Claude Console 没有 token 刷新逻辑，不会覆盖此Campo
      if (updates.subscriptionExpiresAt !== undefined) {
        updatedData.subscriptionExpiresAt = updates.subscriptionExpiresAt
      }

      // ProcesarCuentaTipo变更
      if (updates.accountType && updates.accountType !== existingAccount.accountType) {
        updatedData.accountType = updates.accountType

        if (updates.accountType === 'shared') {
          await client.sadd(this.SHARED_ACCOUNTS_KEY, accountId)
        } else {
          await client.srem(this.SHARED_ACCOUNTS_KEY, accountId)
        }
      }

      updatedData.updatedAt = new Date().toISOString()

      // Verificar是否手动Deshabilitar了账号，如果是则发送webhook通知
      if (updates.isActive === false && existingAccount.isActive === true) {
        try {
          const webhookNotifier = require('../../utils/webhookNotifier')
          await webhookNotifier.sendAccountAnomalyNotification({
            accountId,
            accountName: updatedData.name || existingAccount.name || 'Unknown Account',
            platform: 'claude-console',
            status: 'disabled',
            errorCode: 'CLAUDE_CONSOLE_MANUALLY_DISABLED',
            reason: 'Account manually disabled by administrator'
          })
        } catch (webhookError) {
          logger.error(
            'Failed to send webhook notification for manual account disable:',
            webhookError
          )
        }
      }

      logger.debug(`[DEBUG] Final updatedData to save: ${JSON.stringify(updatedData, null, 2)}`)
      logger.debug(`[DEBUG] Updating Redis key: ${this.ACCOUNT_KEY_PREFIX}${accountId}`)

      await client.hset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, updatedData)

      logger.success(`📝 Updated Claude Console account: ${accountId}`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to update Claude Console account:', error)
      throw error
    }
  }

  // 🗑️ EliminarCuenta
  async deleteAccount(accountId) {
    try {
      const client = redis.getClientSafe()
      const account = await this.getAccount(accountId)

      if (!account) {
        throw new Error('Account not found')
      }

      // 从RedisEliminar
      await client.del(`${this.ACCOUNT_KEY_PREFIX}${accountId}`)
      await redis.removeFromIndex('claude_console_account:index', accountId)

      // 从共享Cuenta集合中Eliminación
      if (account.accountType === 'shared') {
        await client.srem(this.SHARED_ACCOUNTS_KEY, accountId)
      }

      logger.success(`🗑️ Deleted Claude Console account: ${accountId}`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to delete Claude Console account:', error)
      throw error
    }
  }

  // 🚫 标记账号为限流状态
  async markAccountRateLimited(accountId) {
    try {
      const client = redis.getClientSafe()
      const account = await this.getAccount(accountId)

      if (!account) {
        throw new Error('Account not found')
      }

      // 如果限流TiempoEstablecer为 0，Tabla示不Habilitar限流机制，直接Retornar
      if (account.rateLimitDuration === 0) {
        logger.info(
          `ℹ️ Claude Console account ${account.name} (${accountId}) has rate limiting disabled, skipping rate limit`
        )
        return { success: true, skipped: true }
      }

      const updates = {
        rateLimitedAt: new Date().toISOString(),
        rateLimitStatus: 'limited',
        isActive: 'false', // DeshabilitarCuenta
        schedulable: 'false', // 停止调度，与其他平台保持一致
        errorMessage: `Rate limited at ${new Date().toISOString()}`,
        // 使用独立的限流自动停止标记
        rateLimitAutoStopped: 'true'
      }

      // 只有当前状态不是quota_exceeded时才Establecer为rate_limited
      // 避免覆盖更重要的Cuota超限状态
      const currentStatus = await client.hget(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, 'status')
      if (currentStatus !== 'quota_exceeded') {
        updates.status = 'rate_limited'
      }

      await client.hset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, updates)

      // 发送Webhook通知
      try {
        const webhookNotifier = require('../../utils/webhookNotifier')
        const { getISOStringWithTimezone } = require('../../utils/dateHelper')
        await webhookNotifier.sendAccountAnomalyNotification({
          accountId,
          accountName: account.name || 'Claude Console Account',
          platform: 'claude-console',
          status: 'error',
          errorCode: 'CLAUDE_CONSOLE_RATE_LIMITED',
          reason: `Account rate limited (429 error) and has been disabled. ${account.rateLimitDuration ? `Will be automatically re-enabled after ${account.rateLimitDuration} minutes` : 'Manual intervention required to re-enable'}`,
          timestamp: getISOStringWithTimezone(new Date())
        })
      } catch (webhookError) {
        logger.error('Failed to send rate limit webhook notification:', webhookError)
      }

      logger.warn(
        `🚫 Claude Console account marked as rate limited: ${account.name} (${accountId})`
      )
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to mark Claude Console account as rate limited: ${accountId}`, error)
      throw error
    }
  }

  // ✅ Eliminación账号的限流状态
  async removeAccountRateLimit(accountId) {
    try {
      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

      // ObtenerCuenta当前状态和额度Información
      const [currentStatus, quotaStoppedAt] = await client.hmget(
        accountKey,
        'status',
        'quotaStoppedAt'
      )

      // Eliminar限流相关Campo
      await client.hdel(accountKey, 'rateLimitedAt', 'rateLimitStatus')

      // 根据不同情况决定是否RestauraciónCuenta
      if (currentStatus === 'rate_limited') {
        if (quotaStoppedAt) {
          // 还有额度Límite，改为quota_exceeded状态
          await client.hset(accountKey, {
            status: 'quota_exceeded'
            // isActive保持false
          })
          logger.info(`⚠️ Rate limit removed but quota exceeded remains for account: ${accountId}`)
        } else {
          // 没有额度Límite，完全Restauración
          const accountData = await client.hgetall(accountKey)
          const updateData = {
            isActive: 'true',
            status: 'active',
            errorMessage: ''
          }

          const hadAutoStop = accountData.rateLimitAutoStopped === 'true'

          // 只Restauración因限流而自动停止的Cuenta
          if (hadAutoStop && accountData.schedulable === 'false') {
            updateData.schedulable = 'true' // Restauración调度
            logger.info(
              `✅ Auto-resuming scheduling for Claude Console account ${accountId} after rate limit cleared`
            )
          }

          if (hadAutoStop) {
            await client.hdel(accountKey, 'rateLimitAutoStopped')
          }

          await client.hset(accountKey, updateData)
          logger.success(`Rate limit removed and account re-enabled: ${accountId}`)
        }
      } else {
        if (await client.hdel(accountKey, 'rateLimitAutoStopped')) {
          logger.info(
            `ℹ️ Removed stale auto-stop flag for Claude Console account ${accountId} during rate limit recovery`
          )
        }
        logger.success(`Rate limit removed for Claude Console account: ${accountId}`)
      }

      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to remove rate limit for Claude Console account: ${accountId}`, error)
      throw error
    }
  }

  // 🔍 Verificar账号是否处于限流状态
  async isAccountRateLimited(accountId) {
    try {
      const account = await this.getAccount(accountId)
      if (!account) {
        return false
      }

      // 如果限流TiempoEstablecer为 0，Tabla示不Habilitar限流机制
      if (account.rateLimitDuration === 0) {
        return false
      }

      if (account.rateLimitStatus === 'limited' && account.rateLimitedAt) {
        const rateLimitedAt = new Date(account.rateLimitedAt)
        const now = new Date()
        const minutesSinceRateLimit = (now - rateLimitedAt) / (1000 * 60)

        // 使用CuentaConfiguración的限流Tiempo
        const rateLimitDuration =
          typeof account.rateLimitDuration === 'number' && !Number.isNaN(account.rateLimitDuration)
            ? account.rateLimitDuration
            : 60

        if (minutesSinceRateLimit >= rateLimitDuration) {
          await this.removeAccountRateLimit(accountId)
          return false
        }

        return true
      }

      return false
    } catch (error) {
      logger.error(
        `❌ Failed to check rate limit status for Claude Console account: ${accountId}`,
        error
      )
      return false
    }
  }

  // 🔍 Verificar账号是否因额度超限而被停用（懒惰Verificar）
  async isAccountQuotaExceeded(accountId) {
    try {
      const account = await this.getAccount(accountId)
      if (!account) {
        return false
      }

      // 如果没有Establecer额度Límite，不会超额
      const dailyQuota = parseFloat(account.dailyQuota || '0')
      if (isNaN(dailyQuota) || dailyQuota <= 0) {
        return false
      }

      // 如果Cuenta没有被额度停用，Verificar当前使用情况
      if (!account.quotaStoppedAt) {
        return false
      }

      // Verificar是否应该重置额度（到了新的重置Tiempo点）
      if (this._shouldResetQuota(account)) {
        await this.resetDailyUsage(accountId)
        return false
      }

      // 仍在额度超限状态
      return true
    } catch (error) {
      logger.error(
        `❌ Failed to check quota exceeded status for Claude Console account: ${accountId}`,
        error
      )
      return false
    }
  }

  // 🔍 判断是否应该重置Cuenta额度
  _shouldResetQuota(account) {
    // 与 Redis Estadística一致：按ConfiguraciónZona horaria判断“今天”与Tiempo点
    const tzNow = redis.getDateInTimezone(new Date())
    const today = redis.getDateStringInTimezone(tzNow)

    // 如果已经是今天重置过的，不需要重置
    if (account.lastResetDate === today) {
      return false
    }

    // Verificar是否到了重置Tiempo点（按ConfiguraciónZona horaria的小时/分钟）
    const resetTime = account.quotaResetTime || '00:00'
    const [resetHour, resetMinute] = resetTime.split(':').map((n) => parseInt(n))

    const currentHour = tzNow.getUTCHours()
    const currentMinute = tzNow.getUTCMinutes()

    // 如果当前Tiempo已过重置Tiempo且不是同一天重置的，应该重置
    return currentHour > resetHour || (currentHour === resetHour && currentMinute >= resetMinute)
  }

  // 🚫 标记账号为未授权状态（401Error）
  async markAccountUnauthorized(accountId) {
    try {
      const client = redis.getClientSafe()
      const account = await this.getAccount(accountId)

      if (!account) {
        throw new Error('Account not found')
      }

      const updates = {
        schedulable: 'false',
        status: 'unauthorized',
        errorMessage: 'La clave API no es válida o ha caducado (error 401)',
        unauthorizedAt: new Date().toISOString(),
        unauthorizedCount: String((parseInt(account.unauthorizedCount || '0') || 0) + 1)
      }

      await client.hset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, updates)

      // 发送Webhook通知
      try {
        const webhookNotifier = require('../../utils/webhookNotifier')
        await webhookNotifier.sendAccountAnomalyNotification({
          accountId,
          accountName: account.name || 'Claude Console Account',
          platform: 'claude-console',
          status: 'error',
          errorCode: 'CLAUDE_CONSOLE_UNAUTHORIZED',
          reason: 'La clave API no es válida o ha caducado (error 401)，Cuenta已停止调度',
          timestamp: new Date().toISOString()
        })
      } catch (webhookError) {
        logger.error('Failed to send unauthorized webhook notification:', webhookError)
      }

      logger.warn(
        `🚫 Claude Console account marked as unauthorized: ${account.name} (${accountId})`
      )
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to mark Claude Console account as unauthorized: ${accountId}`, error)
      throw error
    }
  }

  // 🚫 标记账号为临时封禁状态（400Error - Cuenta临时Deshabilitar）
  async markConsoleAccountBlocked(accountId, errorDetails = '') {
    try {
      const client = redis.getClientSafe()
      const account = await this.getAccount(accountId)

      if (!account) {
        throw new Error('Account not found')
      }

      const blockedMinutes = this._getBlockedHandlingMinutes()

      if (blockedMinutes <= 0) {
        logger.info(
          `ℹ️ CLAUDE_CONSOLE_BLOCKED_HANDLING_MINUTES 未Establecer或为0，跳过Cuenta封禁：${account.name} (${accountId})`
        )

        if (account.blockedStatus === 'blocked') {
          try {
            await this.removeAccountBlocked(accountId)
          } catch (cleanupError) {
            logger.warn(`⚠️ 尝试EliminaciónCuenta封禁状态Falló：${accountId}`, cleanupError)
          }
        }

        return { success: false, skipped: true }
      }

      const updates = {
        blockedAt: new Date().toISOString(),
        blockedStatus: 'blocked',
        isActive: 'false', // DeshabilitarCuenta（与429保持一致）
        schedulable: 'false', // 停止调度（与429保持一致）
        status: 'account_blocked', // Establecer状态（与429保持一致）
        errorMessage: 'La cuenta ha sido deshabilitada temporalmente (error 400)',
        // 使用独立的封禁自动停止标记
        blockedAutoStopped: 'true'
      }

      await client.hset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, updates)

      // 发送Webhook通知，Incluir完整Error详情
      try {
        const webhookNotifier = require('../../utils/webhookNotifier')
        await webhookNotifier.sendAccountAnomalyNotification({
          accountId,
          accountName: account.name || 'Claude Console Account',
          platform: 'claude-console',
          status: 'error',
          errorCode: 'CLAUDE_CONSOLE_BLOCKED',
          reason: `La cuenta ha sido deshabilitada temporalmente (error 400)。Cuenta将在 ${blockedMinutes} 分钟后自动Restauración。`,
          errorDetails: errorDetails || '无Error详情',
          timestamp: new Date().toISOString()
        })
      } catch (webhookError) {
        logger.error('Failed to send blocked webhook notification:', webhookError)
      }

      logger.warn(`🚫 Claude Console account temporarily blocked: ${account.name} (${accountId})`)
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to mark Claude Console account as blocked: ${accountId}`, error)
      throw error
    }
  }

  // ✅ Eliminación账号的临时封禁状态
  async removeAccountBlocked(accountId) {
    try {
      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

      // ObtenerCuenta当前状态和额度Información
      const [currentStatus, quotaStoppedAt] = await client.hmget(
        accountKey,
        'status',
        'quotaStoppedAt'
      )

      // Eliminar封禁相关Campo
      await client.hdel(accountKey, 'blockedAt', 'blockedStatus')

      // 根据不同情况决定是否RestauraciónCuenta
      if (currentStatus === 'account_blocked') {
        if (quotaStoppedAt) {
          // 还有额度Límite，改为quota_exceeded状态
          await client.hset(accountKey, {
            status: 'quota_exceeded'
            // isActive保持false
          })
          logger.info(
            `⚠️ Blocked status removed but quota exceeded remains for account: ${accountId}`
          )
        } else {
          // 没有额度Límite，完全Restauración
          const accountData = await client.hgetall(accountKey)
          const updateData = {
            isActive: 'true',
            status: 'active',
            errorMessage: ''
          }

          const hadAutoStop = accountData.blockedAutoStopped === 'true'

          // 只Restauración因封禁而自动停止的Cuenta
          if (hadAutoStop && accountData.schedulable === 'false') {
            updateData.schedulable = 'true' // Restauración调度
            logger.info(
              `✅ Auto-resuming scheduling for Claude Console account ${accountId} after blocked status cleared`
            )
          }

          if (hadAutoStop) {
            await client.hdel(accountKey, 'blockedAutoStopped')
          }

          await client.hset(accountKey, updateData)
          logger.success(`Blocked status removed and account re-enabled: ${accountId}`)
        }
      } else {
        if (await client.hdel(accountKey, 'blockedAutoStopped')) {
          logger.info(
            `ℹ️ Removed stale auto-stop flag for Claude Console account ${accountId} during blocked status recovery`
          )
        }
        logger.success(`Blocked status removed for Claude Console account: ${accountId}`)
      }

      return { success: true }
    } catch (error) {
      logger.error(
        `❌ Failed to remove blocked status for Claude Console account: ${accountId}`,
        error
      )
      throw error
    }
  }

  // 🔍 Verificar账号是否处于临时封禁状态
  async isAccountBlocked(accountId) {
    try {
      const account = await this.getAccount(accountId)
      if (!account) {
        return false
      }

      if (account.blockedStatus === 'blocked' && account.blockedAt) {
        const blockedDuration = this._getBlockedHandlingMinutes()

        if (blockedDuration <= 0) {
          await this.removeAccountBlocked(accountId)
          return false
        }

        const blockedAt = new Date(account.blockedAt)
        const now = new Date()
        const minutesSinceBlocked = (now - blockedAt) / (1000 * 60)

        // Deshabilitar时长过后自动Restauración
        if (minutesSinceBlocked >= blockedDuration) {
          await this.removeAccountBlocked(accountId)
          return false
        }

        return true
      }

      return false
    } catch (error) {
      logger.error(
        `❌ Failed to check blocked status for Claude Console account: ${accountId}`,
        error
      )
      return false
    }
  }

  // 🚫 标记账号为过载状态（529Error）
  async markAccountOverloaded(accountId) {
    try {
      const client = redis.getClientSafe()
      const account = await this.getAccount(accountId)

      if (!account) {
        throw new Error('Account not found')
      }

      const updates = {
        overloadedAt: new Date().toISOString(),
        overloadStatus: 'overloaded',
        errorMessage: 'Sobrecarga del servicio (error 529)'
      }

      await client.hset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, updates)

      // 发送Webhook通知
      try {
        const webhookNotifier = require('../../utils/webhookNotifier')
        await webhookNotifier.sendAccountAnomalyNotification({
          accountId,
          accountName: account.name || 'Claude Console Account',
          platform: 'claude-console',
          status: 'error',
          errorCode: 'CLAUDE_CONSOLE_OVERLOADED',
          reason: 'Sobrecarga del servicio (error 529)。Cuenta将暂时停止调度',
          timestamp: new Date().toISOString()
        })
      } catch (webhookError) {
        logger.error('Failed to send overload webhook notification:', webhookError)
      }

      logger.warn(`🚫 Claude Console account marked as overloaded: ${account.name} (${accountId})`)
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to mark Claude Console account as overloaded: ${accountId}`, error)
      throw error
    }
  }

  // ✅ Eliminación账号的过载状态
  async removeAccountOverload(accountId) {
    try {
      const client = redis.getClientSafe()

      await client.hdel(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, 'overloadedAt', 'overloadStatus')

      logger.success(`Overload status removed for Claude Console account: ${accountId}`)
      return { success: true }
    } catch (error) {
      logger.error(
        `❌ Failed to remove overload status for Claude Console account: ${accountId}`,
        error
      )
      throw error
    }
  }

  // 🔍 Verificar账号是否处于过载状态
  async isAccountOverloaded(accountId) {
    try {
      const account = await this.getAccount(accountId)
      if (!account) {
        return false
      }

      if (account.overloadStatus === 'overloaded' && account.overloadedAt) {
        const overloadedAt = new Date(account.overloadedAt)
        const now = new Date()
        const minutesSinceOverload = (now - overloadedAt) / (1000 * 60)

        // 过载状态持续10分钟后自动Restauración
        if (minutesSinceOverload >= 10) {
          await this.removeAccountOverload(accountId)
          return false
        }

        return true
      }

      return false
    } catch (error) {
      logger.error(
        `❌ Failed to check overload status for Claude Console account: ${accountId}`,
        error
      )
      return false
    }
  }

  // 🚫 标记账号为封锁状态（模型不Soportar等原因）
  async blockAccount(accountId, reason) {
    try {
      const client = redis.getClientSafe()

      // ObtenerCuentaInformación用于webhook通知
      const accountData = await client.hgetall(`${this.ACCOUNT_KEY_PREFIX}${accountId}`)

      const updates = {
        status: 'blocked',
        errorMessage: reason,
        blockedAt: new Date().toISOString()
      }

      await client.hset(`${this.ACCOUNT_KEY_PREFIX}${accountId}`, updates)

      logger.warn(`🚫 Claude Console account blocked: ${accountId} - ${reason}`)

      // 发送Webhook通知
      if (accountData && Object.keys(accountData).length > 0) {
        try {
          const webhookNotifier = require('../../utils/webhookNotifier')
          await webhookNotifier.sendAccountAnomalyNotification({
            accountId,
            accountName: accountData.name || 'Unknown Account',
            platform: 'claude-console',
            status: 'blocked',
            errorCode: 'CLAUDE_CONSOLE_BLOCKED',
            reason
          })
        } catch (webhookError) {
          logger.error('Failed to send webhook notification:', webhookError)
        }
      }

      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to block Claude Console account: ${accountId}`, error)
      throw error
    }
  }

  // 🌐 CrearProxyagent（使用统一的Proxy工具）
  _createProxyAgent(proxyConfig) {
    const proxyAgent = ProxyHelper.createProxyAgent(proxyConfig)
    if (proxyAgent) {
      logger.info(
        `🌐 Using proxy for Claude Console request: ${ProxyHelper.getProxyDescription(proxyConfig)}`
      )
    } else if (proxyConfig) {
      logger.debug('🌐 Failed to create proxy agent for Claude Console')
    } else {
      logger.debug('🌐 No proxy configured for Claude Console request')
    }
    return proxyAgent
  }

  // 🔐 Cifrado敏感Datos
  _encryptSensitiveData(data) {
    if (!data) {
      return ''
    }

    try {
      const key = this._generateEncryptionKey()
      const iv = crypto.randomBytes(16)

      const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv)
      let encrypted = cipher.update(data, 'utf8', 'hex')
      encrypted += cipher.final('hex')

      return `${iv.toString('hex')}:${encrypted}`
    } catch (error) {
      logger.error('❌ Encryption error:', error)
      return data
    }
  }

  // 🔓 Descifrado敏感Datos
  _decryptSensitiveData(encryptedData) {
    if (!encryptedData) {
      return ''
    }

    // 🎯 VerificarCaché
    const cacheKey = crypto.createHash('sha256').update(encryptedData).digest('hex')
    const cached = this._decryptCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    try {
      if (encryptedData.includes(':')) {
        const parts = encryptedData.split(':')
        if (parts.length === 2) {
          const key = this._generateEncryptionKey()
          const iv = Buffer.from(parts[0], 'hex')
          const encrypted = parts[1]

          const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv)
          let decrypted = decipher.update(encrypted, 'hex', 'utf8')
          decrypted += decipher.final('utf8')

          // 💾 存入Caché（5分钟过期）
          this._decryptCache.set(cacheKey, decrypted, 5 * 60 * 1000)

          // 📊 定期打印CachéEstadística
          if ((this._decryptCache.hits + this._decryptCache.misses) % 1000 === 0) {
            this._decryptCache.printStats()
          }

          return decrypted
        }
      }

      return encryptedData
    } catch (error) {
      logger.error('❌ Decryption error:', error)
      return encryptedData
    }
  }

  // 🔑 GenerarCifradoClave
  _generateEncryptionKey() {
    // RendimientoOptimización：CachéClave派生结果，避免重复的 CPU 密集Calcular
    // scryptSync 是故意设计为慢速的Clave派生Función（防暴力破解）
    // 但在高Concurrencia场景下，每次都重新Calcular会导致 CPU 100% 占用
    if (!this._encryptionKeyCache) {
      // 只在第一次调用时Calcular，后续使用Caché
      // 由于输入Parámetro固定，派生结果永远相同，不影响Datos兼容性
      this._encryptionKeyCache = crypto.scryptSync(
        config.security.encryptionKey,
        this.ENCRYPTION_SALT,
        32
      )
      logger.info('🔑 Console encryption key derived and cached for performance optimization')
    }
    return this._encryptionKeyCache
  }

  // 🎭 掩码API URL
  _maskApiUrl(apiUrl) {
    if (!apiUrl) {
      return ''
    }

    try {
      const url = new URL(apiUrl)
      return `${url.protocol}//${url.hostname}/***`
    } catch {
      return '***'
    }
  }

  // 📊 Obtener限流Información
  _getRateLimitInfo(accountData) {
    if (accountData.rateLimitStatus === 'limited' && accountData.rateLimitedAt) {
      const rateLimitedAt = new Date(accountData.rateLimitedAt)
      const now = new Date()
      const minutesSinceRateLimit = Math.floor((now - rateLimitedAt) / (1000 * 60))
      const __parsedDuration = parseInt(accountData.rateLimitDuration)
      const rateLimitDuration = Number.isNaN(__parsedDuration) ? 60 : __parsedDuration
      const minutesRemaining = Math.max(0, rateLimitDuration - minutesSinceRateLimit)

      return {
        isRateLimited: minutesRemaining > 0,
        rateLimitedAt: accountData.rateLimitedAt,
        minutesSinceRateLimit,
        minutesRemaining
      }
    }

    return {
      isRateLimited: false,
      rateLimitedAt: null,
      minutesSinceRateLimit: 0,
      minutesRemaining: 0
    }
  }

  // 🔄 Procesar模型映射，确保向后兼容
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
          mapping[model] = model // 映射到自身
        }
      })
      return mapping
    }

    // 其他情况Retornar空Objeto
    return {}
  }

  // 🔍 Verificar模型是否Soportar（用于调度）
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

    // 如果不存在则Retornar原模型
    return requestedModel
  }

  // 💰 VerificarCuenta使用额度（基于实时EstadísticaDatos）
  async checkQuotaUsage(accountId) {
    try {
      // Obtener实时的使用Estadística（Incluir费用）
      const usageStats = await redis.getAccountUsageStats(accountId)
      const currentDailyCost = usageStats.daily.cost || 0

      // ObtenerCuentaConfiguración
      const accountData = await this.getAccount(accountId)
      if (!accountData) {
        logger.warn(`Account not found: ${accountId}`)
        return
      }

      // Analizar额度Configuración，确保数Valor有效
      const dailyQuota = parseFloat(accountData.dailyQuota || '0')
      if (isNaN(dailyQuota) || dailyQuota <= 0) {
        // 没有Establecer有效额度，无需Verificar
        return
      }

      // Verificar是否已经因额度停用（避免重复Operación）
      if (accountData.quotaStoppedAt) {
        return
      }

      // Verificar是否超过额度Límite
      if (currentDailyCost >= dailyQuota) {
        // 使用原子Operación避免竞态Condición - 再次Verificar是否已EstablecerquotaStoppedAt
        const client = redis.getClientSafe()
        const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

        // double-check locking pattern - VerificarquotaStoppedAt而不是status
        const existingQuotaStop = await client.hget(accountKey, 'quotaStoppedAt')
        if (existingQuotaStop) {
          return // 已经被其他ProcesoProcesar
        }

        // 超过额度，停止调度但保持Cuenta状态正常
        // 不修改 isActive 和 status，只用独立Campo标记Cuota超限
        const updates = {
          quotaStoppedAt: new Date().toISOString(),
          errorMessage: `Daily quota exceeded: $${currentDailyCost.toFixed(2)} / $${dailyQuota.toFixed(2)}`,
          schedulable: false, // 停止调度
          // 使用独立的额度超限自动停止标记
          quotaAutoStopped: 'true'
        }

        await this.updateAccount(accountId, updates)

        logger.warn(
          `💰 Account ${accountId} exceeded daily quota: $${currentDailyCost.toFixed(2)} / $${dailyQuota.toFixed(2)}`
        )

        // 发送webhook通知
        try {
          const webhookNotifier = require('../../utils/webhookNotifier')
          await webhookNotifier.sendAccountAnomalyNotification({
            accountId,
            accountName: accountData.name || 'Unknown Account',
            platform: 'claude-console',
            status: 'quota_exceeded',
            errorCode: 'CLAUDE_CONSOLE_QUOTA_EXCEEDED',
            reason: `Daily quota exceeded: $${currentDailyCost.toFixed(2)} / $${dailyQuota.toFixed(2)}`
          })
        } catch (webhookError) {
          logger.error('Failed to send webhook notification for quota exceeded:', webhookError)
        }
      }

      logger.debug(
        `💰 Quota check for account ${accountId}: $${currentDailyCost.toFixed(4)} / $${dailyQuota.toFixed(2)}`
      )
    } catch (error) {
      logger.error('Failed to check quota usage:', error)
    }
  }

  // 🔄 重置Cuenta每日使用量（Restauración因额度停用的Cuenta）
  async resetDailyUsage(accountId) {
    try {
      const accountData = await this.getAccount(accountId)
      if (!accountData) {
        return
      }

      const today = redis.getDateStringInTimezone()
      const updates = {
        lastResetDate: today
      }

      // 如果Cuenta因Cuota超限被停用，RestauraciónCuenta
      // 新逻辑：不再依赖 isActive === false 和 status 判断
      // 只要有 quotaStoppedAt 就说明是因Cuota超限被停止的
      if (accountData.quotaStoppedAt) {
        updates.errorMessage = ''
        updates.quotaStoppedAt = ''

        // 只Restauración因额度超限而自动停止的Cuenta
        if (accountData.quotaAutoStopped === 'true') {
          updates.schedulable = true
          updates.quotaAutoStopped = ''
        }

        logger.info(`✅ Restored account ${accountId} after daily quota reset`)
      }

      await this.updateAccount(accountId, updates)

      logger.debug(`🔄 Reset daily usage for account ${accountId}`)
    } catch (error) {
      logger.error('Failed to reset daily usage:', error)
    }
  }

  // 🔄 重置所有Cuenta的每日使用量
  async resetAllDailyUsage() {
    try {
      const accounts = await this.getAllAccounts()
      // 与Estadística一致使用ConfiguraciónZona horariaFecha
      const today = redis.getDateStringInTimezone()
      let resetCount = 0

      for (const account of accounts) {
        // 只重置需要重置的Cuenta
        if (account.lastResetDate !== today) {
          await this.resetDailyUsage(account.id)
          resetCount += 1
        }
      }

      logger.success(`Reset daily usage for ${resetCount} Claude Console accounts`)
    } catch (error) {
      logger.error('Failed to reset all daily usage:', error)
    }
  }

  // 📊 ObtenerCuenta使用Estadística（基于实时Datos）
  async getAccountUsageStats(accountId) {
    try {
      // Obtener实时的使用Estadística（Incluir费用）
      const usageStats = await redis.getAccountUsageStats(accountId)
      const currentDailyCost = usageStats.daily.cost || 0

      // ObtenerCuentaConfiguración
      const accountData = await this.getAccount(accountId)
      if (!accountData) {
        return null
      }

      const dailyQuota = parseFloat(accountData.dailyQuota || '0')

      return {
        dailyQuota,
        dailyUsage: currentDailyCost, // 使用实时Calcular的费用
        remainingQuota: dailyQuota > 0 ? Math.max(0, dailyQuota - currentDailyCost) : null,
        usagePercentage: dailyQuota > 0 ? (currentDailyCost / dailyQuota) * 100 : 0,
        lastResetDate: accountData.lastResetDate,
        quotaStoppedAt: accountData.quotaStoppedAt,
        isQuotaExceeded: dailyQuota > 0 && currentDailyCost >= dailyQuota,
        // 额外Retornar完整的使用Estadística
        fullUsageStats: usageStats
      }
    } catch (error) {
      logger.error('Failed to get account usage stats:', error)
      return null
    }
  }

  // 🔄 重置Cuenta所有异常状态
  async resetAccountStatus(accountId) {
    try {
      const accountData = await this.getAccount(accountId)
      if (!accountData) {
        throw new Error('Account not found')
      }

      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

      // 准备要Actualizar的Campo
      const updates = {
        status: 'active',
        errorMessage: '',
        schedulable: 'true',
        isActive: 'true' // 重要：必须RestauraciónisActive状态
      }

      // Eliminar所有异常状态相关的Campo
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

      // EjecutarActualizar
      await client.hset(accountKey, updates)
      await client.hdel(accountKey, ...fieldsToDelete)

      logger.success(`Reset all error status for Claude Console account ${accountId}`)

      // 清除临时不可用状态
      await upstreamErrorHelper.clearTempUnavailable(accountId, 'claude-console').catch(() => {})

      // 发送 Webhook 通知
      try {
        const webhookNotifier = require('../../utils/webhookNotifier')
        await webhookNotifier.sendAccountAnomalyNotification({
          accountId,
          accountName: accountData.name || accountId,
          platform: 'claude-console',
          status: 'recovered',
          errorCode: 'STATUS_RESET',
          reason: 'Account status manually reset',
          timestamp: new Date().toISOString()
        })
      } catch (webhookError) {
        logger.warn('Failed to send webhook notification:', webhookError)
      }

      return { success: true, accountId }
    } catch (error) {
      logger.error(`❌ Failed to reset Claude Console account status: ${accountId}`, error)
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

  // 🚫 标记Cuenta的 count_tokens Endpoint不可用
  async markCountTokensUnavailable(accountId) {
    try {
      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

      // VerificarCuenta是否存在
      const exists = await client.exists(accountKey)
      if (!exists) {
        logger.warn(
          `⚠️ Cannot mark count_tokens unavailable for non-existent account: ${accountId}`
        )
        return { success: false, reason: 'Account not found' }
      }

      await client.hset(accountKey, {
        countTokensUnavailable: 'true',
        countTokensUnavailableAt: new Date().toISOString()
      })

      logger.info(
        `🚫 Marked count_tokens endpoint as unavailable for Claude Console account: ${accountId}`
      )
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to mark count_tokens unavailable for account ${accountId}:`, error)
      throw error
    }
  }

  // ✅ EliminaciónCuenta的 count_tokens 不可用标记
  async removeCountTokensUnavailable(accountId) {
    try {
      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

      await client.hdel(accountKey, 'countTokensUnavailable', 'countTokensUnavailableAt')

      logger.info(
        `✅ Removed count_tokens unavailable mark for Claude Console account: ${accountId}`
      )
      return { success: true }
    } catch (error) {
      logger.error(
        `❌ Failed to remove count_tokens unavailable mark for account ${accountId}:`,
        error
      )
      throw error
    }
  }

  // 🔍 VerificarCuenta的 count_tokens Endpoint是否不可用
  async isCountTokensUnavailable(accountId) {
    try {
      const client = redis.getClientSafe()
      const accountKey = `${this.ACCOUNT_KEY_PREFIX}${accountId}`

      const value = await client.hget(accountKey, 'countTokensUnavailable')
      return value === 'true'
    } catch (error) {
      logger.error(`❌ Failed to check count_tokens availability for account ${accountId}:`, error)
      return false // 出错时PredeterminadoRetornar可用，避免误阻断
    }
  }
}

module.exports = new ClaudeConsoleAccountService()
