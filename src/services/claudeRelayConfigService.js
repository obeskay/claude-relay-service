/**
 * Claude 转发ConfiguraciónServicio
 * 管理全局 Claude Code Límite和Sesión绑定Configuración
 */

const redis = require('../models/redis')
const logger = require('../utils/logger')

const CONFIG_KEY = 'claude_relay_config'
const SESSION_BINDING_PREFIX = 'original_session_binding:'

// PredeterminadoConfiguración
const DEFAULT_CONFIG = {
  claudeCodeOnlyEnabled: false,
  globalSessionBindingEnabled: false,
  sessionBindingErrorMessage: 'Su sesión local está contaminada, límpiela antes de usarla.',
  sessionBindingTtlDays: 30, // Sesión绑定 TTL（天），Predeterminado30天
  // Usuario消息ColaConfiguración
  userMessageQueueEnabled: false, // 是否HabilitarUsuario消息Cola（Predeterminado关闭）
  userMessageQueueDelayMs: 200, // Solicitud间隔（毫秒）
  userMessageQueueTimeoutMs: 60000, // Cola等待Tiempo de espera agotado（毫秒）
  userMessageQueueLockTtlMs: 120000, // 锁TTL（毫秒）
  // ConcurrenciaSolicitud排队Configuración
  concurrentRequestQueueEnabled: false, // 是否HabilitarConcurrenciaSolicitud排队（Predeterminado关闭）
  concurrentRequestQueueMaxSize: 3, // 固定最小排队数（Predeterminado3）
  concurrentRequestQueueMaxSizeMultiplier: 0, // Nivel de concurrencia的倍数（Predeterminado0，仅使用固定Valor）
  concurrentRequestQueueTimeoutMs: 10000, // 排队Tiempo de espera agotado（毫秒，Predeterminado10秒）
  concurrentRequestQueueMaxRedisFailCount: 5, // 连续 Redis Falló阈Valor（Predeterminado5次）
  // 排队Verificación de saludConfiguración
  concurrentRequestQueueHealthCheckEnabled: true, // 是否Habilitar排队Verificación de salud（Predeterminado开启）
  concurrentRequestQueueHealthThreshold: 0.8,
  globalForcedModel: '',
  globalModelMapping: {},
  updatedAt: null,
  updatedBy: null
}

// 内存Caché（避免频繁 Redis Consulta）
let configCache = null
let configCacheTime = 0
const CONFIG_CACHE_TTL = 60000 // 1分钟Caché

class ClaudeRelayConfigService {
  /**
   * 从 metadata.user_id 中提取原始 sessionId
   * Formato: user_{64位十六进制}_account__session_{uuid}
   * @param {Object} requestBody - Solicitud体
   * @returns {string|null} 原始 sessionId 或 null
   */
  extractOriginalSessionId(requestBody) {
    if (!requestBody?.metadata?.user_id) {
      return null
    }

    const userId = requestBody.metadata.user_id
    const match = userId.match(/session_([a-f0-9-]{36})$/i)
    return match ? match[1] : null
  }

  /**
   * ObtenerConfiguración（带Caché）
   * @returns {Promise<Object>} ConfiguraciónObjeto
   */
  async getConfig() {
    try {
      // VerificarCaché
      if (configCache && Date.now() - configCacheTime < CONFIG_CACHE_TTL) {
        return configCache
      }

      const client = redis.getClient()
      if (!client) {
        logger.warn('⚠️ Redis not connected, using default config')
        return { ...DEFAULT_CONFIG }
      }

      const data = await client.get(CONFIG_KEY)

      if (data) {
        configCache = { ...DEFAULT_CONFIG, ...JSON.parse(data) }
      } else {
        configCache = { ...DEFAULT_CONFIG }
      }

      configCacheTime = Date.now()
      return configCache
    } catch (error) {
      logger.error('❌ Failed to get Claude relay config:', error)
      return { ...DEFAULT_CONFIG }
    }
  }

  /**
   * ActualizarConfiguración
   * @param {Object} newConfig - 新Configuración
   * @param {string} updatedBy - Actualizar者
   * @returns {Promise<Object>} Actualizar后的Configuración
   */
  async updateConfig(newConfig, updatedBy) {
    try {
      const client = redis.getClientSafe()
      const currentConfig = await this.getConfig()

      const updatedConfig = {
        ...currentConfig,
        ...newConfig,
        updatedAt: new Date().toISOString(),
        updatedBy
      }

      await client.set(CONFIG_KEY, JSON.stringify(updatedConfig))

      // ActualizarCaché
      configCache = updatedConfig
      configCacheTime = Date.now()

      logger.info(`✅ Claude relay config updated by ${updatedBy}:`, {
        claudeCodeOnlyEnabled: updatedConfig.claudeCodeOnlyEnabled,
        globalSessionBindingEnabled: updatedConfig.globalSessionBindingEnabled,
        concurrentRequestQueueEnabled: updatedConfig.concurrentRequestQueueEnabled
      })

      return updatedConfig
    } catch (error) {
      logger.error('❌ Failed to update Claude relay config:', error)
      throw error
    }
  }

  /**
   * Verificar是否Habilitar全局 Claude Code Límite
   * @returns {Promise<boolean>}
   */
  async isClaudeCodeOnlyEnabled() {
    const cfg = await this.getConfig()
    return cfg.claudeCodeOnlyEnabled === true
  }

  /**
   * Verificar是否Habilitar全局Sesión绑定
   * @returns {Promise<boolean>}
   */
  async isGlobalSessionBindingEnabled() {
    const cfg = await this.getConfig()
    return cfg.globalSessionBindingEnabled === true
  }

  /**
   * ObtenerSesión绑定ErrorInformación
   * @returns {Promise<string>}
   */
  async getSessionBindingErrorMessage() {
    const cfg = await this.getConfig()
    return cfg.sessionBindingErrorMessage || DEFAULT_CONFIG.sessionBindingErrorMessage
  }

  /**
   * Obtener原始Sesión绑定
   * @param {string} originalSessionId - 原始SesiónID
   * @returns {Promise<Object|null>} 绑定Información或 null
   */
  async getOriginalSessionBinding(originalSessionId) {
    if (!originalSessionId) {
      return null
    }

    try {
      const client = redis.getClient()
      if (!client) {
        return null
      }

      const key = `${SESSION_BINDING_PREFIX}${originalSessionId}`
      const data = await client.get(key)

      if (data) {
        return JSON.parse(data)
      }
      return null
    } catch (error) {
      logger.error(`❌ Failed to get session binding for ${originalSessionId}:`, error)
      return null
    }
  }

  /**
   * Establecer原始Sesión绑定
   * @param {string} originalSessionId - 原始SesiónID
   * @param {string} accountId - CuentaID
   * @param {string} accountType - CuentaTipo
   * @returns {Promise<Object>} 绑定Información
   */
  async setOriginalSessionBinding(originalSessionId, accountId, accountType) {
    if (!originalSessionId || !accountId || !accountType) {
      throw new Error('Invalid parameters for session binding')
    }

    try {
      const client = redis.getClientSafe()
      const key = `${SESSION_BINDING_PREFIX}${originalSessionId}`

      const binding = {
        accountId,
        accountType,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      }

      // 使用Configuración的 TTL（Predeterminado30天）
      const cfg = await this.getConfig()
      const ttlDays = cfg.sessionBindingTtlDays || DEFAULT_CONFIG.sessionBindingTtlDays
      const ttlSeconds = Math.floor(ttlDays * 24 * 3600)

      await client.set(key, JSON.stringify(binding), 'EX', ttlSeconds)

      logger.info(
        `🔗 Session binding created: ${originalSessionId} -> ${accountId} (${accountType})`
      )

      return binding
    } catch (error) {
      logger.error(`❌ Failed to set session binding for ${originalSessionId}:`, error)
      throw error
    }
  }

  /**
   * ActualizarSesión绑定的最后使用Tiempo（续期）
   * @param {string} originalSessionId - 原始SesiónID
   */
  async touchOriginalSessionBinding(originalSessionId) {
    if (!originalSessionId) {
      return
    }

    try {
      const binding = await this.getOriginalSessionBinding(originalSessionId)
      if (!binding) {
        return
      }

      binding.lastUsedAt = new Date().toISOString()

      const client = redis.getClientSafe()
      const key = `${SESSION_BINDING_PREFIX}${originalSessionId}`

      // 使用Configuración的 TTL（Predeterminado30天）
      const cfg = await this.getConfig()
      const ttlDays = cfg.sessionBindingTtlDays || DEFAULT_CONFIG.sessionBindingTtlDays
      const ttlSeconds = Math.floor(ttlDays * 24 * 3600)

      await client.set(key, JSON.stringify(binding), 'EX', ttlSeconds)
    } catch (error) {
      logger.warn(`⚠️ Failed to touch session binding for ${originalSessionId}:`, error)
    }
  }

  /**
   * Verificar原始Sesión是否已绑定
   * @param {string} originalSessionId - 原始SesiónID
   * @returns {Promise<boolean>}
   */
  async isOriginalSessionBound(originalSessionId) {
    const binding = await this.getOriginalSessionBinding(originalSessionId)
    return binding !== null
  }

  /**
   * Validar绑定的Cuenta是否可用
   * @param {Object} binding - 绑定Información
   * @returns {Promise<boolean>}
   */
  async validateBoundAccount(binding) {
    if (!binding || !binding.accountId || !binding.accountType) {
      return false
    }

    try {
      const { accountType } = binding
      const { accountId } = binding

      let accountService
      switch (accountType) {
        case 'claude-official':
          accountService = require('./account/claudeAccountService')
          break
        case 'claude-console':
          accountService = require('./account/claudeConsoleAccountService')
          break
        case 'bedrock':
          accountService = require('./account/bedrockAccountService')
          break
        case 'ccr':
          accountService = require('./account/ccrAccountService')
          break
        default:
          logger.warn(`Unknown account type for validation: ${accountType}`)
          return false
      }

      const account = await accountService.getAccount(accountId)

      // getAccount() 直接RetornarCuentaDatosObjeto或 null，不是 { success, data } Formato
      if (!account) {
        logger.warn(`Session binding account not found: ${accountId} (${accountType})`)
        return false
      }

      const accountData = account

      // VerificarCuenta是否激活
      if (accountData.isActive === false || accountData.isActive === 'false') {
        logger.warn(
          `Session binding account not active: ${accountId} (${accountType}), isActive: ${accountData.isActive}`
        )
        return false
      }

      // VerificarCuenta状态（如果存在）
      if (accountData.status && accountData.status === 'error') {
        logger.warn(
          `Session binding account has error status: ${accountId} (${accountType}), status: ${accountData.status}`
        )
        return false
      }

      return true
    } catch (error) {
      logger.error(`❌ Failed to validate bound account ${binding.accountId}:`, error)
      return false
    }
  }

  /**
   * Validar新SesiónSolicitud
   * @param {Object} _requestBody - Solicitud体（预留Parámetro，当前未使用）
   * @param {string} originalSessionId - 原始SesiónID
   * @returns {Promise<Object>} { valid: boolean, error?: string, binding?: object, isNewSession?: boolean }
   */
  async validateNewSession(_requestBody, originalSessionId) {
    const cfg = await this.getConfig()

    if (!cfg.globalSessionBindingEnabled) {
      return { valid: true }
    }

    // 如果没有 sessionId，跳过Validar（可能是非 Claude Code Cliente）
    if (!originalSessionId) {
      return { valid: true }
    }

    const existingBinding = await this.getOriginalSessionBinding(originalSessionId)

    // 如果Sesión已存在绑定
    if (existingBinding) {
      // ⚠️ 只有 claude-official TipoCuenta受全局Sesión绑定Límite
      // 其他Tipo（bedrock, ccr, claude-console等）忽略绑定，走正常调度
      if (existingBinding.accountType !== 'claude-official') {
        logger.info(
          `🔗 Session binding ignored for non-official account type: ${existingBinding.accountType}`
        )
        return { valid: true }
      }

      const accountValid = await this.validateBoundAccount(existingBinding)

      if (!accountValid) {
        return {
          valid: false,
          error: cfg.sessionBindingErrorMessage,
          code: 'SESSION_BINDING_INVALID'
        }
      }

      // 续期
      await this.touchOriginalSessionBinding(originalSessionId)

      // 已有绑定，允许继续（这是正常的Sesión延续）
      return { valid: true, binding: existingBinding }
    }

    // 没有绑定，是新Sesión
    // 注意：messages.length Verificar在此处无法Ejecutar，因为我们不知道最终会调度到哪种CuentaTipo
    // 绑定会在调度后Crear，仅针对 claude-official Cuenta
    return { valid: true, isNewSession: true }
  }

  /**
   * Eliminar原始Sesión绑定
   * @param {string} originalSessionId - 原始SesiónID
   */
  async deleteOriginalSessionBinding(originalSessionId) {
    if (!originalSessionId) {
      return
    }

    try {
      const client = redis.getClient()
      if (!client) {
        return
      }

      const key = `${SESSION_BINDING_PREFIX}${originalSessionId}`
      await client.del(key)
      logger.info(`🗑️ Session binding deleted: ${originalSessionId}`)
    } catch (error) {
      logger.error(`❌ Failed to delete session binding for ${originalSessionId}:`, error)
    }
  }

  /**
   * ObtenerSesión绑定Estadística
   * @returns {Promise<Object>}
   */
  async getSessionBindingStats() {
    try {
      const client = redis.getClient()
      if (!client) {
        return { totalBindings: 0 }
      }

      let cursor = '0'
      let count = 0

      do {
        const [newCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          `${SESSION_BINDING_PREFIX}*`,
          'COUNT',
          100
        )
        cursor = newCursor
        count += keys.length
      } while (cursor !== '0')

      return {
        totalBindings: count
      }
    } catch (error) {
      logger.error('❌ Failed to get session binding stats:', error)
      return { totalBindings: 0 }
    }
  }

  /**
   * 清除ConfiguraciónCaché（用于Probar或强制刷新）
   */
  clearCache() {
    configCache = null
    configCacheTime = 0
  }
}

module.exports = new ClaudeRelayConfigService()
