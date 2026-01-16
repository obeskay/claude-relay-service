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
        // 返回默认配置
        return this.getDefaultConfig()
      }

      const storedConfig = JSON.parse(configStr)
      const defaultConfig = this.getDefaultConfig()

      // 合并默认通知类型，确保新增类型有默认值
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

      // 添加更新时间
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

    // 验证平台配置
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

        // Bark和SMTP平台不使用标准URL
        if (!['bark', 'smtp', 'telegram'].includes(platform.type)) {
          if (!platform.url || !this.isValidUrl(platform.url)) {
            throw new Error(`Invalid webhook URL: ${platform.url}`)
          }
        }

        // 验证平台特定的配置
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
        // 企业微信不需要额外配置
        break
      case 'dingtalk':
        // 钉钉可能需要secret用于签名
        if (platform.enableSign && !platform.secret) {
          throw new Error('Secret must be provided when DingTalk signing is enabled')
        }
        break
      case 'feishu':
        // 飞书可能需要签名
        if (platform.enableSign && !platform.secret) {
          throw new Error('Secret must be provided when Feishu signing is enabled')
        }
        break
      case 'slack':
        // Slack webhook URL通常包含token
        if (!platform.url.includes('hooks.slack.com')) {
          logger.warn('⚠️ Slack webhook URL format may be incorrect')
        }
        break
      case 'discord':
        // Discord webhook URL format check
        if (!platform.url.includes('discord.com/api/webhooks')) {
          logger.warn('⚠️ Discord webhook URL格式可能不正确')
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
        // 自定义webhook，用户自行负责格式
        break
      case 'bark':
        // 验证设备密钥
        if (!platform.deviceKey) {
          throw new Error('Bark platform must provide device key')
        }

        // 验证设备密钥格式（通常是22-24位字符）
        if (platform.deviceKey.length < 20 || platform.deviceKey.length > 30) {
          logger.warn('⚠️ Bark device key length may be incorrect, please check if fully copied')
        }

        // 验证服务器URL（如果提供）
        if (platform.serverUrl) {
          if (!this.isValidUrl(platform.serverUrl)) {
            throw new Error('Invalid Bark server URL format')
          }
          if (!platform.serverUrl.includes('/push')) {
            logger.warn('⚠️ Bark server URL should end with /push')
          }
        }

        // 验证声音参数（如果提供）
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

        // 验证级别参数
        if (platform.level) {
          const validLevels = ['active', 'timeSensitive', 'passive', 'critical']
          if (!validLevels.includes(platform.level)) {
            throw new Error(`Invalid Bark notification level: ${platform.level}`)
          }
        }

        // 验证图标URL（如果提供）
        if (platform.icon && !this.isValidUrl(platform.icon)) {
          logger.warn('⚠️ Bark icon URL format may be incorrect')
        }

        // 验证点击跳转URL（如果提供）
        if (platform.clickUrl && !this.isValidUrl(platform.clickUrl)) {
          logger.warn('⚠️ Bark redirect URL format may be incorrect')
        }
        break
      case 'smtp': {
        // 验证SMTP必需配置
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

        // 验证端口
        if (platform.port && (platform.port < 1 || platform.port > 65535)) {
          throw new Error('SMTP port must be between 1-65535')
        }

        // 验证邮箱格式
        // 支持两种格式：1. 纯邮箱 user@domain.com  2. 带名称 Name <user@domain.com>
        const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

        // 验证接收邮箱
        const toEmails = Array.isArray(platform.to) ? platform.to : [platform.to]
        for (const email of toEmails) {
          // 提取实际邮箱地址（如果是 Name <email> 格式）
          const actualEmail = email.includes('<') ? email.match(/<([^>]+)>/)?.[1] : email
          if (!actualEmail || !simpleEmailRegex.test(actualEmail)) {
            throw new Error(`Invalid recipient email format: ${email}`)
          }
        }

        // 验证发送邮箱（支持 Name <email> 格式）
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

      // 生成唯一ID
      platform.id = platform.id || uuidv4()
      platform.enabled = platform.enabled !== false
      platform.createdAt = new Date().toISOString()

      // 验证平台配置
      this.validatePlatformConfig(platform)

      // 添加到配置
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

      // 合并更新
      config.platforms[index] = {
        ...config.platforms[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }

      // 验证更新后的配置
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
