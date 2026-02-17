const axios = require('axios')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const { HttpsProxyAgent } = require('https-proxy-agent')
const { SocksProxyAgent } = require('socks-proxy-agent')
const logger = require('../utils/logger')
const webhookConfigService = require('./webhookConfigService')
const { getISOStringWithTimezone } = require('../utils/dateHelper')
const appConfig = require('../../config/config')

class WebhookService {
  constructor() {
    this.platformHandlers = {
      wechat_work: this.sendToWechatWork.bind(this),
      dingtalk: this.sendToDingTalk.bind(this),
      feishu: this.sendToFeishu.bind(this),
      slack: this.sendToSlack.bind(this),
      discord: this.sendToDiscord.bind(this),
      telegram: this.sendToTelegram.bind(this),
      custom: this.sendToCustom.bind(this),
      bark: this.sendToBark.bind(this),
      smtp: this.sendToSMTP.bind(this)
    }
    this.timezone = appConfig.system.timezone || 'Asia/Shanghai'
  }

  /**
   * 发送通知到所有Habilitar的平台
   */
  async sendNotification(type, data) {
    try {
      const config = await webhookConfigService.getConfig()

      // Verificar是否Habilitarwebhook
      if (!config.enabled) {
        logger.debug('Webhook通知已Deshabilitar')
        return
      }

      // Verificar通知Tipo是否Habilitar（testTipo始终允许发送）
      if (type !== 'test' && config.notificationTypes && !config.notificationTypes[type]) {
        logger.debug(`通知Tipo ${type} 已Deshabilitar`)
        return
      }

      // ObtenerHabilitar的平台
      const enabledPlatforms = await webhookConfigService.getEnabledPlatforms()
      if (enabledPlatforms.length === 0) {
        logger.debug('没有Habilitar的webhook平台')
        return
      }

      logger.info(`📢 发送 ${type} 通知到 ${enabledPlatforms.length} 个平台`)

      // Concurrencia发送到所有平台
      const promises = enabledPlatforms.map((platform) =>
        this.sendToPlatform(platform, type, data, config.retrySettings)
      )

      const results = await Promise.allSettled(promises)

      // Registro结果
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      if (failed > 0) {
        logger.warn(`⚠️ Webhook通知: ${succeeded}Éxito, ${failed}Falló`)
      } else {
        logger.info(`✅ 所有webhook通知发送Éxito`)
      }

      return { succeeded, failed }
    } catch (error) {
      logger.error('发送webhook通知Falló:', error)
      throw error
    }
  }

  /**
   * 发送到特定平台
   */
  async sendToPlatform(platform, type, data, retrySettings) {
    try {
      const handler = this.platformHandlers[platform.type]
      if (!handler) {
        throw new Error(`不Soportar的平台Tipo: ${platform.type}`)
      }

      // 使用平台特定的Procesar器
      await this.retryWithBackoff(
        () => handler(platform, type, data),
        retrySettings?.maxRetries || 3,
        retrySettings?.retryDelay || 1000
      )

      logger.info(`✅ Éxito发送到 ${platform.name || platform.type}`)
    } catch (error) {
      logger.error(`❌ 发送到 ${platform.name || platform.type} Falló:`, error.message)
      throw error
    }
  }

  /**
   * 企业微信webhook
   */
  async sendToWechatWork(platform, type, data) {
    const content = this.formatMessageForWechatWork(type, data)

    const payload = {
      msgtype: 'markdown',
      markdown: {
        content
      }
    }

    await this.sendHttpRequest(platform.url, payload, platform.timeout || 10000)
  }

  /**
   * 钉钉webhook
   */
  async sendToDingTalk(platform, type, data) {
    const content = this.formatMessageForDingTalk(type, data)

    let { url } = platform
    const payload = {
      msgtype: 'markdown',
      markdown: {
        title: this.getNotificationTitle(type),
        text: content
      }
    }

    // 如果HabilitarFirma
    if (platform.enableSign && platform.secret) {
      const timestamp = Date.now()
      const sign = this.generateDingTalkSign(platform.secret, timestamp)
      url = `${url}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
    }

    await this.sendHttpRequest(url, payload, platform.timeout || 10000)
  }

  /**
   * 飞书webhook
   */
  async sendToFeishu(platform, type, data) {
    const content = this.formatMessageForFeishu(type, data)

    const payload = {
      msg_type: 'interactive',
      card: {
        elements: [
          {
            tag: 'markdown',
            content
          }
        ],
        header: {
          title: {
            tag: 'plain_text',
            content: this.getNotificationTitle(type)
          },
          template: this.getFeishuCardColor(type)
        }
      }
    }

    // 如果HabilitarFirma
    if (platform.enableSign && platform.secret) {
      const timestamp = Math.floor(Date.now() / 1000)
      const sign = this.generateFeishuSign(platform.secret, timestamp)
      payload.timestamp = timestamp.toString()
      payload.sign = sign
    }

    await this.sendHttpRequest(platform.url, payload, platform.timeout || 10000)
  }

  /**
   * Slack webhook
   */
  async sendToSlack(platform, type, data) {
    const text = this.formatMessageForSlack(type, data)

    const payload = {
      text,
      username: 'Claude Relay Service',
      icon_emoji: this.getSlackEmoji(type)
    }

    await this.sendHttpRequest(platform.url, payload, platform.timeout || 10000)
  }

  /**
   * Discord webhook
   */
  async sendToDiscord(platform, type, data) {
    const embed = this.formatMessageForDiscord(type, data)

    const payload = {
      username: 'Claude Relay Service',
      embeds: [embed]
    }

    await this.sendHttpRequest(platform.url, payload, platform.timeout || 10000)
  }

  /**
   * 自定义webhook
   */
  async sendToCustom(platform, type, data) {
    // 使用通用Formato
    const payload = {
      type,
      service: 'claude-relay-service',
      timestamp: getISOStringWithTimezone(new Date()),
      data
    }

    await this.sendHttpRequest(platform.url, payload, platform.timeout || 10000)
  }

  /**
   * Telegram Bot 通知
   */
  async sendToTelegram(platform, type, data) {
    if (!platform.botToken) {
      throw new Error('缺少 Telegram 机器人 Token')
    }
    if (!platform.chatId) {
      throw new Error('缺少 Telegram Chat ID')
    }

    const baseUrl = this.normalizeTelegramApiBase(platform.apiBaseUrl)
    const apiUrl = `${baseUrl}/bot${platform.botToken}/sendMessage`
    const payload = {
      chat_id: platform.chatId,
      text: this.formatMessageForTelegram(type, data),
      disable_web_page_preview: true
    }

    const axiosOptions = this.buildTelegramAxiosOptions(platform)

    const response = await this.sendHttpRequest(
      apiUrl,
      payload,
      platform.timeout || 10000,
      axiosOptions
    )
    if (!response || response.ok !== true) {
      throw new Error(`Telegram API Error: ${response?.description || '未知Error'}`)
    }
  }

  /**
   * Bark webhook
   */
  async sendToBark(platform, type, data) {
    const payload = {
      device_key: platform.deviceKey,
      title: this.getNotificationTitle(type),
      body: this.formatMessageForBark(type, data),
      level: platform.level || this.getBarkLevel(type),
      sound: platform.sound || this.getBarkSound(type),
      group: platform.group || 'claude-relay',
      badge: 1
    }

    // 添加OpcionalParámetro
    if (platform.icon) {
      payload.icon = platform.icon
    }

    if (platform.clickUrl) {
      payload.url = platform.clickUrl
    }

    const url = platform.serverUrl || 'https://api.day.app/push'
    await this.sendHttpRequest(url, payload, platform.timeout || 10000)
  }

  /**
   * SMTP邮件通知
   */
  async sendToSMTP(platform, type, data) {
    try {
      // CrearSMTP传输器
      const transporter = nodemailer.createTransport({
        host: platform.host,
        port: platform.port || 587,
        secure: platform.secure || false, // true for 465, false for other ports
        auth: {
          user: platform.user,
          pass: platform.pass
        },
        // Opcional的TLSConfiguración
        tls: platform.ignoreTLS ? { rejectUnauthorized: false } : undefined,
        // ConexiónTiempo de espera agotado
        connectionTimeout: platform.timeout || 10000
      })

      // 构造邮件内容
      const subject = this.getNotificationTitle(type)
      const htmlContent = this.formatMessageForEmail(type, data)
      const textContent = this.formatMessageForEmailText(type, data)

      // 邮件选项
      const mailOptions = {
        from: platform.from || platform.user, // 发送者
        to: platform.to, // 接收者（必填）
        subject: `[Claude Relay Service] ${subject}`,
        text: textContent,
        html: htmlContent
      }

      // 发送邮件
      const info = await transporter.sendMail(mailOptions)
      logger.info(`✅ 邮件发送Éxito: ${info.messageId}`)

      return info
    } catch (error) {
      logger.error('SMTP邮件发送Falló:', error)
      throw error
    }
  }

  /**
   * 发送HTTPSolicitud
   */
  async sendHttpRequest(url, payload, timeout, axiosOptions = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'claude-relay-service/2.0',
      ...(axiosOptions.headers || {})
    }

    const response = await axios.post(url, payload, {
      timeout,
      ...axiosOptions,
      headers
    })

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.data
  }

  /**
   * Reintentar机制
   */
  async retryWithBackoff(fn, maxRetries, baseDelay) {
    let lastError

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error

        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i) // 指数退避
          logger.debug(`🔄 Reintentar ${i + 1}/${maxRetries}，等待 ${delay}ms`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError
  }

  /**
   * Generar钉钉Firma
   */
  generateDingTalkSign(secret, timestamp) {
    const stringToSign = `${timestamp}\n${secret}`
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(stringToSign)
    return hmac.digest('base64')
  }

  /**
   * Generar飞书Firma
   */
  generateFeishuSign(secret, timestamp) {
    const stringToSign = `${timestamp}\n${secret}`
    const hmac = crypto.createHmac('sha256', stringToSign)
    hmac.update('')
    return hmac.digest('base64')
  }

  /**
   * Formato化企业微信消息
   */
  formatMessageForWechatWork(type, data) {
    const title = this.getNotificationTitle(type)
    const details = this.formatNotificationDetails(data)
    return (
      `## ${title}\n\n` +
      `> **Servicio**: Claude Relay Service\n` +
      `> **Tiempo**: ${new Date().toLocaleString('zh-CN', { timeZone: this.timezone })}\n\n${details}`
    )
  }

  /**
   * Formato化钉钉消息
   */
  formatMessageForDingTalk(type, data) {
    const details = this.formatNotificationDetails(data)

    return (
      `#### Servicio: Claude Relay Service\n` +
      `#### Tiempo: ${new Date().toLocaleString('zh-CN', { timeZone: this.timezone })}\n\n${details}`
    )
  }

  /**
   * Formato化飞书消息
   */
  formatMessageForFeishu(type, data) {
    return this.formatNotificationDetails(data)
  }

  /**
   * Formato化Slack消息
   */
  formatMessageForSlack(type, data) {
    const title = this.getNotificationTitle(type)
    const details = this.formatNotificationDetails(data)

    return `*${title}*\n${details}`
  }

  /**
   * 规范化Telegram基础地址
   */
  normalizeTelegramApiBase(baseUrl) {
    const defaultBase = 'https://api.telegram.org'
    if (!baseUrl) {
      return defaultBase
    }

    try {
      const parsed = new URL(baseUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Telegram API 基础地址必须使用 http 或 https Protocolo')
      }

      // Eliminación结尾的 /
      return parsed.href.replace(/\/$/, '')
    } catch (error) {
      logger.warn(`⚠️ Telegram API 基础地址无效，将使用PredeterminadoValor: ${error.message}`)
      return defaultBase
    }
  }

  /**
   * Construir Telegram Solicitud的 axios 选项（Proxy等）
   */
  buildTelegramAxiosOptions(platform) {
    const options = {}

    if (platform.proxyUrl) {
      try {
        const proxyUrl = new URL(platform.proxyUrl)
        const { protocol } = proxyUrl

        if (protocol.startsWith('socks')) {
          const agent = new SocksProxyAgent(proxyUrl.toString())
          options.httpAgent = agent
          options.httpsAgent = agent
          options.proxy = false
        } else if (protocol === 'http:' || protocol === 'https:') {
          const agent = new HttpsProxyAgent(proxyUrl.toString())
          options.httpAgent = agent
          options.httpsAgent = agent
          options.proxy = false
        } else {
          logger.warn(`⚠️ 不Soportar的TelegramProxyProtocolo: ${protocol}`)
        }
      } catch (error) {
        logger.warn(`⚠️ TelegramProxyConfiguración无效，将忽略: ${error.message}`)
      }
    }

    return options
  }

  /**
   * Formato化 Telegram 消息
   */
  formatMessageForTelegram(type, data) {
    const title = this.getNotificationTitle(type)
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: this.timezone })
    const details = this.buildNotificationDetails(data)

    const lines = [`${title}`, 'Servicio: Claude Relay Service']

    if (details.length > 0) {
      lines.push('')
      for (const detail of details) {
        lines.push(`${detail.label}: ${detail.value}`)
      }
    }

    lines.push('', `Tiempo: ${timestamp}`)

    return lines.join('\n')
  }

  /**
   * Formato化Discord消息
   */
  formatMessageForDiscord(type, data) {
    const title = this.getNotificationTitle(type)
    const color = this.getDiscordColor(type)
    const fields = this.formatNotificationFields(data)

    return {
      title,
      color,
      fields,
      timestamp: getISOStringWithTimezone(new Date()),
      footer: {
        text: 'Claude Relay Service'
      }
    }
  }

  /**
   * Obtener通知标题
   */
  getNotificationTitle(type) {
    const titles = {
      accountAnomaly: '⚠️ Notificación de anomalía de cuenta',
      quotaWarning: '📊 Advertencia de cuota',
      systemError: '❌ Error del sistema',
      securityAlert: '🔒 Alerta de seguridad',
      rateLimitRecovery: '🎉 Notificación de recuperación de límite de velocidad',
      test: '🧪 Notificación de prueba'
    }

    return titles[type] || '📢 Notificación del sistema'
  }

  /**
   * ObtenerBark通知级别
   */
  getBarkLevel(type) {
    const levels = {
      accountAnomaly: 'timeSensitive',
      quotaWarning: 'active',
      systemError: 'critical',
      securityAlert: 'critical',
      rateLimitRecovery: 'active',
      test: 'passive'
    }

    return levels[type] || 'active'
  }

  /**
   * ObtenerBark声音
   */
  getBarkSound(type) {
    const sounds = {
      accountAnomaly: 'alarm',
      quotaWarning: 'bell',
      systemError: 'alert',
      securityAlert: 'alarm',
      rateLimitRecovery: 'success',
      test: 'default'
    }

    return sounds[type] || 'default'
  }

  /**
   * Formato化Bark消息
   */
  formatMessageForBark(type, data) {
    const lines = []

    if (data.accountName) {
      lines.push(`Cuenta: ${data.accountName}`)
    }

    if (data.platform) {
      lines.push(`Plataforma: ${data.platform}`)
    }

    if (data.status) {
      lines.push(`Estado: ${data.status}`)
    }

    if (data.errorCode) {
      lines.push(`Error: ${data.errorCode}`)
    }

    if (data.reason) {
      lines.push(`Razón: ${data.reason}`)
    }

    if (data.message) {
      lines.push(`Mensaje: ${data.message}`)
    }

    if (data.quota) {
      lines.push(`Cuota restante: ${data.quota.remaining}/${data.quota.total}`)
    }

    if (data.usage) {
      lines.push(`使用率: ${data.usage}%`)
    }

    // 添加Servicio标识和Tiempo戳
    lines.push(`\nServicio: Claude Relay Service`)
    lines.push(`Tiempo: ${new Date().toLocaleString('zh-CN', { timeZone: this.timezone })}`)

    return lines.join('\n')
  }

  /**
   * Construir通知详情Datos
   */
  buildNotificationDetails(data) {
    const details = []

    if (data.accountName) {
      details.push({ label: 'Cuenta', value: data.accountName })
    }
    if (data.platform) {
      details.push({ label: 'Plataforma', value: data.platform })
    }
    if (data.status) {
      details.push({ label: 'Estado', value: data.status, color: this.getStatusColor(data.status) })
    }
    if (data.errorCode) {
      details.push({ label: 'Código de error', value: data.errorCode, isCode: true })
    }
    if (data.reason) {
      details.push({ label: 'Razón', value: data.reason })
    }
    if (data.message) {
      details.push({ label: 'Mensaje', value: data.message })
    }
    if (data.quota) {
      details.push({ label: 'Cuota', value: `${data.quota.remaining}/${data.quota.total}` })
    }
    if (data.usage) {
      details.push({ label: 'Tasa de uso', value: `${data.usage}%` })
    }

    return details
  }

  /**
   * Formato化邮件HTML内容
   */
  formatMessageForEmail(type, data) {
    const title = this.getNotificationTitle(type)
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: this.timezone })
    const details = this.buildNotificationDetails(data)

    let content = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${title}</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Claude Relay Service</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background: white; padding: 16px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    `

    // 使用统一的详情Datos渲染
    details.forEach((detail) => {
      if (detail.isCode) {
        content += `<p><strong>${detail.label}:</strong> <code style="background: #f1f3f4; padding: 2px 6px; border-radius: 4px;">${detail.value}</code></p>`
      } else if (detail.color) {
        content += `<p><strong>${detail.label}:</strong> <span style="color: ${detail.color};">${detail.value}</span></p>`
      } else {
        content += `<p><strong>${detail.label}:</strong> ${detail.value}</p>`
      }
    })

    content += `
          </div>
          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; text-align: center;">
            <p>Tiempo de envío: ${timestamp}</p>
            <p style="margin: 0;">Este correo fue enviado automáticamente por Claude Relay Service</p>
          </div>
        </div>
      </div>
    `

    return content
  }

  /**
   * Formato化邮件纯文本内容
   */
  formatMessageForEmailText(type, data) {
    const title = this.getNotificationTitle(type)
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: this.timezone })
    const details = this.buildNotificationDetails(data)

    let content = `${title}\n`
    content += `=====================================\n\n`

    // 使用统一的详情Datos渲染
    details.forEach((detail) => {
      content += `${detail.label}: ${detail.value}\n`
    })

    content += `\nTiempo de envío: ${timestamp}\n`
    content += `Servicio: Claude Relay Service\n`
    content += `=====================================\n`
    content += `Este correo fue enviado automáticamente por el sistema, por favor no responda.`

    return content
  }

  /**
   * Obtener状态颜色
   */
  getStatusColor(status) {
    const colors = {
      error: '#dc3545',
      unauthorized: '#fd7e14',
      blocked: '#6f42c1',
      disabled: '#6c757d',
      active: '#28a745',
      warning: '#ffc107'
    }
    return colors[status] || '#007bff'
  }

  /**
   * Formato化通知详情
   */
  formatNotificationDetails(data) {
    const lines = []

    if (data.accountName) {
      lines.push(`**Cuenta**: ${data.accountName}`)
    }

    if (data.platform) {
      lines.push(`**Plataforma**: ${data.platform}`)
    }

    if (data.platforms) {
      lines.push(`**Plataformas involucradas**: ${data.platforms.join(', ')}`)
    }

    if (data.totalAccounts) {
      lines.push(`**Número de cuentas recuperadas**: ${data.totalAccounts}`)
    }

    if (data.status) {
      lines.push(`**Estado**: ${data.status}`)
    }

    if (data.errorCode) {
      lines.push(`**Código de error**: ${data.errorCode}`)
    }

    if (data.reason) {
      lines.push(`**Razón**: ${data.reason}`)
    }

    if (data.message) {
      lines.push(`**Mensaje**: ${data.message}`)
    }

    if (data.quota) {
      lines.push(`**Cuota restante**: ${data.quota.remaining}/${data.quota.total}`)
    }

    if (data.usage) {
      lines.push(`**Tasa de uso**: ${data.usage}%`)
    }

    return lines.join('\n')
  }

  /**
   * Formato化DiscordCampo
   */
  formatNotificationFields(data) {
    const fields = []

    if (data.accountName) {
      fields.push({ name: 'Cuenta', value: data.accountName, inline: true })
    }

    if (data.platform) {
      fields.push({ name: 'Plataforma', value: data.platform, inline: true })
    }

    if (data.status) {
      fields.push({ name: 'Estado', value: data.status, inline: true })
    }

    if (data.errorCode) {
      fields.push({ name: 'Código de error', value: data.errorCode, inline: false })
    }

    if (data.reason) {
      fields.push({ name: 'Razón', value: data.reason, inline: false })
    }

    if (data.message) {
      fields.push({ name: 'Mensaje', value: data.message, inline: false })
    }

    return fields
  }

  /**
   * Obtener飞书卡片颜色
   */
  getFeishuCardColor(type) {
    const colors = {
      accountAnomaly: 'orange',
      quotaWarning: 'yellow',
      systemError: 'red',
      securityAlert: 'red',
      rateLimitRecovery: 'green',
      test: 'blue'
    }

    return colors[type] || 'blue'
  }

  /**
   * ObtenerSlack emoji
   */
  getSlackEmoji(type) {
    const emojis = {
      accountAnomaly: ':warning:',
      quotaWarning: ':chart_with_downwards_trend:',
      systemError: ':x:',
      securityAlert: ':lock:',
      rateLimitRecovery: ':tada:',
      test: ':test_tube:'
    }

    return emojis[type] || ':bell:'
  }

  /**
   * ObtenerDiscord颜色
   */
  getDiscordColor(type) {
    const colors = {
      accountAnomaly: 0xff9800, // 橙色
      quotaWarning: 0xffeb3b, // 黄色
      systemError: 0xf44336, // 红色
      securityAlert: 0xf44336, // 红色
      rateLimitRecovery: 0x4caf50, // 绿色
      test: 0x2196f3 // 蓝色
    }

    return colors[type] || 0x9e9e9e // 灰色
  }

  /**
   * ProbarwebhookConexión
   */
  async testWebhook(platform) {
    try {
      const testData = {
        message: 'Prueba de webhook de Claude Relay Service',
        timestamp: getISOStringWithTimezone(new Date())
      }

      await this.sendToPlatform(platform, 'test', testData, { maxRetries: 1, retryDelay: 1000 })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = new WebhookService()
