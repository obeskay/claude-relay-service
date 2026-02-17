const redis = require('../models/redis')
const logger = require('../utils/logger')
const { v4: uuidv4 } = require('uuid')

class WebhookConfigService {
  constructor() {
    this.KEY_PREFIX = 'webhook_config'
    this.DEFAULT_CONFIG_KEY = `${this.KEY_PREFIX}:default`
  }

  /**
   * Get webhook configuration
   */
  async getConfig() {
    try {
      const configStr = await redis.client.get(this.DEFAULT_CONFIG_KEY)
      if (!configStr) {
        // Retorna configuración predeterminada
        return this.getDefaultConfig()
      }

      const storedConfig = JSON.parse(configStr)
      const defaultConfig = this.getDefaultConfig()

      // Combina tipos de notificación predeterminados, asegura valores predeterminados para nuevos tipos
      storedConfig.notificationTypes = {
        ...defaultConfig.notificationTypes,
        ...(storedConfig.notificationTypes || {})
      }

      return storedConfig
    } catch (error) {
      logger.error('Failed to get webhook configuration:', error)
      return this.getDefaultConfig()
    }
  }

  /**
   * Save webhook configuration
   */
  async saveConfig(config) {
    try {
      const defaultConfig = this.getDefaultConfig()

      config.notificationTypes = {
        ...defaultConfig.notificationTypes,
        ...(config.notificationTypes || {})
      }

      // Validate configuration
      this.validateConfig(config)

      // Agrega tiempo de actualización
      config.updatedAt = new Date().toISOString()

      await redis.client.set(this.DEFAULT_CONFIG_KEY, JSON.stringify(config))
      logger.info('✅ Webhook configuration saved')

      return config
    } catch (error) {
      logger.error('Failed to save webhook configuration:', error)
      throw error
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration format')
    }

    // Valida configuración de plataforma
    if (config.platforms) {
      const validPlatforms = [
        'wechat_work',
        'dingtalk',
        'feishu',
        'slack',
        'discord',
        'telegram',
        'custom',
        'bark',
        'smtp'
      ]

      for (const platform of config.platforms) {
        if (!validPlatforms.includes(platform.type)) {
          throw new Error(`Unsupported platform type: ${platform.type}`)
        }

        // Plataformas Bark y SMTP no usan URL estándar
        if (!['bark', 'smtp', 'telegram'].includes(platform.type)) {
          if (!platform.url || !this.isValidUrl(platform.url)) {
            throw new Error(`Invalid webhook URL: ${platform.url}`)
          }
        }

        // Valida configuración específica de plataforma
        this.validatePlatformConfig(platform)
      }
    }
  }

  /**
   * Validate platform-specific configuration
   */
  validatePlatformConfig(platform) {
    switch (platform.type) {
      case 'wechat_work':
        // WeChat Enterprise no requiere configuración adicional
        break
      case 'dingtalk':
        // DingTalk puede necesitar secret para firma
        if (platform.enableSign && !platform.secret) {
          throw new Error('Secret must be provided when DingTalk signing is enabled')
        }
        break
      case 'feishu':
        // Feishu puede necesitar firma
        if (platform.enableSign && !platform.secret) {
          throw new Error('Secret must be provided when Feishu signing is enabled')
        }
        break
      case 'slack':
        // URL de webhook de Slack generalmente contiene token
        if (!platform.url.includes('hooks.slack.com')) {
          logger.warn('⚠️ Slack webhook URL format may be incorrect')
        }
        break
      case 'discord':
        // Discord webhook URL format check
        if (!platform.url.includes('discord.com/api/webhooks')) {
          logger.warn('⚠️ Formato de URL de webhook de Discord puede ser incorrecto')
        }
        break
      case 'telegram':
        if (!platform.botToken) {
          throw new Error('Telegram platform must provide bot Token')
        }
        if (!platform.chatId) {
          throw new Error('Telegram platform must provide Chat ID')
        }

        if (!platform.botToken.includes(':')) {
          logger.warn('⚠️ Telegram bot Token format may be incorrect')
        }

        if (!/^[-\d]+$/.test(String(platform.chatId))) {
          logger.warn(
            '⚠️ Telegram Chat ID should be a number, please confirm the correct ID for channels'
          )
        }

        if (platform.apiBaseUrl) {
          if (!this.isValidUrl(platform.apiBaseUrl)) {
            throw new Error('Invalid Telegram API base address format')
          }
          const { protocol } = new URL(platform.apiBaseUrl)
          if (!['http:', 'https:'].includes(protocol)) {
            throw new Error('Telegram API base address only supports http or https protocols')
          }
        }

        if (platform.proxyUrl) {
          if (!this.isValidUrl(platform.proxyUrl)) {
            throw new Error('Invalid Telegram proxy address format')
          }
          const proxyProtocol = new URL(platform.proxyUrl).protocol
          const supportedProtocols = ['http:', 'https:', 'socks4:', 'socks4a:', 'socks5:']
          if (!supportedProtocols.includes(proxyProtocol)) {
            throw new Error('Telegram proxy only supports http/https/socks protocols')
          }
        }
        break
      case 'custom':
        // Webhook personalizado, usuario es responsable del formato
        break
      case 'bark':
        // Valida clave de dispositivo
        if (!platform.deviceKey) {
          throw new Error('Bark platform must provide device key')
        }

        // Valida clave de dispositivoFormato（通常是22-24位字符）
        if (platform.deviceKey.length < 20 || platform.deviceKey.length > 30) {
          logger.warn('⚠️ Bark device key length may be incorrect, please check if fully copied')
        }

        // Valida URL del servidor (si se proporciona)
        if (platform.serverUrl) {
          if (!this.isValidUrl(platform.serverUrl)) {
            throw new Error('Invalid Bark server URL format')
          }
          if (!platform.serverUrl.includes('/push')) {
            logger.warn('⚠️ Bark server URL should end with /push')
          }
        }

        // Valida parámetro de sonido (si se proporciona)
        if (platform.sound) {
          const validSounds = [
            'default',
            'alarm',
            'anticipate',
            'bell',
            'birdsong',
            'bloom',
            'calypso',
            'chime',
            'choo',
            'descent',
            'electronic',
            'fanfare',
            'glass',
            'gotosleep',
            'healthnotification',
            'horn',
            'ladder',
            'mailsent',
            'minuet',
            'multiwayinvitation',
            'newmail',
            'newsflash',
            'noir',
            'paymentsuccess',
            'shake',
            'sherwoodforest',
            'silence',
            'spell',
            'suspense',
            'telegraph',
            'tiptoes',
            'typewriters',
            'update',
            'alert'
          ]
          if (!validSounds.includes(platform.sound)) {
            logger.warn(`⚠️ Unknown Bark sound: ${platform.sound}`)
          }
        }

        // Valida parámetro de nivel
        if (platform.level) {
          const validLevels = ['active', 'timeSensitive', 'passive', 'critical']
          if (!validLevels.includes(platform.level)) {
            throw new Error(`Invalid Bark notification level: ${platform.level}`)
          }
        }

        // Valida URL de ícono (si se proporciona)
        if (platform.icon && !this.isValidUrl(platform.icon)) {
          logger.warn('⚠️ Bark icon URL format may be incorrect')
        }

        // Valida URL de redirección al hacer clic (si se proporciona)
        if (platform.clickUrl && !this.isValidUrl(platform.clickUrl)) {
          logger.warn('⚠️ Bark redirect URL format may be incorrect')
        }
        break
      case 'smtp': {
        // Valida configuración requerida de SMTP
        if (!platform.host) {
          throw new Error('SMTP platform must provide host address')
        }
        if (!platform.user) {
          throw new Error('SMTP platform must provide username')
        }
        if (!platform.pass) {
          throw new Error('SMTP platform must provide password')
        }
        if (!platform.to) {
          throw new Error('SMTP platform must provide recipient email')
        }

        // Valida puerto
        if (platform.port && (platform.port < 1 || platform.port > 65535)) {
          throw new Error('SMTP port must be between 1-65535')
        }

        // Valida formato de correo electrónico
        // Soporta dos formatos: 1. Correo simple user@domain.com  2. Con nombre Name <user@domain.com>
        const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

        // Valida correo de recepción
        const toEmails = Array.isArray(platform.to) ? platform.to : [platform.to]
        for (const email of toEmails) {
          // Extrae dirección de correo real (si es formato Name <email>)
          const actualEmail = email.includes('<') ? email.match(/<([^>]+)>/)?.[1] : email
          if (!actualEmail || !simpleEmailRegex.test(actualEmail)) {
            throw new Error(`Invalid recipient email format: ${email}`)
          }
        }

        // Valida correo de envío (soporta formato Name <email>)
        if (platform.from) {
          const actualFromEmail = platform.from.includes('<')
            ? platform.from.match(/<([^>]+)>/)?.[1]
            : platform.from
          if (!actualFromEmail || !simpleEmailRegex.test(actualFromEmail)) {
            throw new Error(`Invalid sender email format: ${platform.from}`)
          }
        }
        break
      }
    }
  }

  /**
   * Validate URL format
   */
  isValidUrl(url) {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      enabled: false,
      platforms: [],
      notificationTypes: {
        accountAnomaly: true, // Anomalía de cuenta
        quotaWarning: true, // Advertencia de cuota
        systemError: true, // Error del sistema
        securityAlert: true, // Alerta de seguridad
        rateLimitRecovery: true, // Recuperación de límite de velocidad
        test: true // Notificación de prueba
      },
      retrySettings: {
        maxRetries: 3,
        retryDelay: 1000, // ms
        timeout: 10000 // ms
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * Add webhook platform
   */
  async addPlatform(platform) {
    try {
      const config = await this.getConfig()

      // Genera ID único
      platform.id = platform.id || uuidv4()
      platform.enabled = platform.enabled !== false
      platform.createdAt = new Date().toISOString()

      // Valida configuración de plataforma
      this.validatePlatformConfig(platform)

      // 添加到Configuración
      config.platforms = config.platforms || []
      config.platforms.push(platform)

      await this.saveConfig(config)

      return platform
    } catch (error) {
      logger.error('Failed to add webhook platform:', error)
      throw error
    }
  }

  /**
   * Update webhook platform
   */
  async updatePlatform(platformId, updates) {
    try {
      const config = await this.getConfig()

      const index = config.platforms.findIndex((p) => p.id === platformId)
      if (index === -1) {
        throw new Error('Specified webhook platform not found')
      }

      // Combina actualización
      config.platforms[index] = {
        ...config.platforms[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }

      // Valida configuración actualizada
      this.validatePlatformConfig(config.platforms[index])

      await this.saveConfig(config)

      return config.platforms[index]
    } catch (error) {
      logger.error('Failed to update webhook platform:', error)
      throw error
    }
  }

  /**
   * Delete webhook platform
   */
  async deletePlatform(platformId) {
    try {
      const config = await this.getConfig()

      config.platforms = config.platforms.filter((p) => p.id !== platformId)

      await this.saveConfig(config)

      logger.info(`✅ Deleted webhook platform: ${platformId}`)
      return true
    } catch (error) {
      logger.error('Failed to delete webhook platform:', error)
      throw error
    }
  }

  /**
   * Toggle webhook platform enabled status
   */
  async togglePlatform(platformId) {
    try {
      const config = await this.getConfig()

      const platform = config.platforms.find((p) => p.id === platformId)
      if (!platform) {
        throw new Error('Specified webhook platform not found')
      }

      platform.enabled = !platform.enabled
      platform.updatedAt = new Date().toISOString()

      await this.saveConfig(config)

      logger.info(
        `✅ Webhook platform ${platformId} is now ${platform.enabled ? 'enabled' : 'disabled'}`
      )
      return platform
    } catch (error) {
      logger.error('Failed to toggle webhook platform status:', error)
      throw error
    }
  }

  /**
   * Get list of enabled platforms
   */
  async getEnabledPlatforms() {
    try {
      const config = await this.getConfig()

      if (!config.enabled || !config.platforms) {
        return []
      }

      return config.platforms.filter((p) => p.enabled)
    } catch (error) {
      logger.error('Failed to get enabled webhook platforms:', error)
      return []
    }
  }
}

module.exports = new WebhookConfigService()
