const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')
const webhookService = require('../services/webhookService')
const webhookConfigService = require('../services/webhookConfigService')
const { authenticateAdmin } = require('../middleware/auth')
const { getISOStringWithTimezone } = require('../utils/dateHelper')

// ObtenerwebhookConfiguración
router.get('/config', authenticateAdmin, async (req, res) => {
  try {
    const config = await webhookConfigService.getConfig()
    res.json({
      success: true,
      config
    })
  } catch (error) {
    logger.error('ObtenerwebhookConfiguraciónFalló:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'ObtenerwebhookConfiguraciónFalló'
    })
  }
})

// 保存webhookConfiguración
router.post('/config', authenticateAdmin, async (req, res) => {
  try {
    const config = await webhookConfigService.saveConfig(req.body)
    res.json({
      success: true,
      message: 'WebhookConfiguración已保存',
      config
    })
  } catch (error) {
    logger.error('保存webhookConfiguraciónFalló:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || '保存webhookConfiguraciónFalló'
    })
  }
})

// 添加webhook平台
router.post('/platforms', authenticateAdmin, async (req, res) => {
  try {
    const platform = await webhookConfigService.addPlatform(req.body)
    res.json({
      success: true,
      message: 'Webhook平台已添加',
      platform
    })
  } catch (error) {
    logger.error('添加webhook平台Falló:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || '添加webhook平台Falló'
    })
  }
})

// Actualizarwebhook平台
router.put('/platforms/:id', authenticateAdmin, async (req, res) => {
  try {
    const platform = await webhookConfigService.updatePlatform(req.params.id, req.body)
    res.json({
      success: true,
      message: 'Webhook平台已Actualizar',
      platform
    })
  } catch (error) {
    logger.error('Actualizarwebhook平台Falló:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Actualizarwebhook平台Falló'
    })
  }
})

// Eliminarwebhook平台
router.delete('/platforms/:id', authenticateAdmin, async (req, res) => {
  try {
    await webhookConfigService.deletePlatform(req.params.id)
    res.json({
      success: true,
      message: 'Webhook平台已Eliminar'
    })
  } catch (error) {
    logger.error('Eliminarwebhook平台Falló:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Eliminarwebhook平台Falló'
    })
  }
})

// 切换webhook平台Habilitar状态
router.post('/platforms/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    const platform = await webhookConfigService.togglePlatform(req.params.id)
    res.json({
      success: true,
      message: `Webhook平台已${platform.enabled ? 'Habilitar' : 'Deshabilitar'}`,
      platform
    })
  } catch (error) {
    logger.error('切换webhook平台状态Falló:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || '切换webhook平台状态Falló'
    })
  }
})

// ProbarWebhook连通性
router.post('/test', authenticateAdmin, async (req, res) => {
  try {
    const {
      url,
      type = 'custom',
      secret,
      enableSign,
      deviceKey,
      serverUrl,
      level,
      sound,
      group,
      // SMTP 相关Campo
      host,
      port,
      secure,
      user,
      pass,
      from,
      to,
      ignoreTLS,
      botToken,
      chatId,
      apiBaseUrl,
      proxyUrl
    } = req.body

    // Bark平台特殊Procesar
    if (type === 'bark') {
      if (!deviceKey) {
        return res.status(400).json({
          error: 'Missing device key',
          message: '请提供Bark设备Clave'
        })
      }

      // Valida URL del servidor (si se proporciona)
      if (serverUrl) {
        try {
          new URL(serverUrl)
        } catch (urlError) {
          return res.status(400).json({
            error: 'Invalid server URL format',
            message: '请提供有效的BarkServicio器URL'
          })
        }
      }

      logger.info(`🧪 Probarwebhook: ${type} - Device Key: ${deviceKey.substring(0, 8)}...`)
    } else if (type === 'smtp') {
      // SMTP平台Validar
      if (!host) {
        return res.status(400).json({
          error: 'Missing SMTP host',
          message: '请提供SMTPServicio器地址'
        })
      }
      if (!user) {
        return res.status(400).json({
          error: 'Missing SMTP user',
          message: '请提供SMTPUsuario名'
        })
      }
      if (!pass) {
        return res.status(400).json({
          error: 'Missing SMTP password',
          message: '请提供SMTP密码'
        })
      }
      if (!to) {
        return res.status(400).json({
          error: 'Missing recipient email',
          message: '请提供收件人邮箱'
        })
      }

      logger.info(`🧪 Probarwebhook: ${type} - ${host}:${port || 587} -> ${to}`)
    } else if (type === 'telegram') {
      if (!botToken) {
        return res.status(400).json({
          error: 'Missing Telegram bot token',
          message: '请提供 Telegram 机器人 Token'
        })
      }
      if (!chatId) {
        return res.status(400).json({
          error: 'Missing Telegram chat id',
          message: '请提供 Telegram Chat ID'
        })
      }

      if (apiBaseUrl) {
        try {
          const parsed = new URL(apiBaseUrl)
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return res.status(400).json({
              error: 'Invalid Telegram API base url protocol',
              message: 'Telegram API 基础地址仅Soportar http 或 https'
            })
          }
        } catch (urlError) {
          return res.status(400).json({
            error: 'Invalid Telegram API base url',
            message: '请提供有效的 Telegram API 基础地址'
          })
        }
      }

      if (proxyUrl) {
        try {
          const parsed = new URL(proxyUrl)
          const supportedProtocols = ['http:', 'https:', 'socks4:', 'socks4a:', 'socks5:']
          if (!supportedProtocols.includes(parsed.protocol)) {
            return res.status(400).json({
              error: 'Unsupported proxy protocol',
              message: 'Telegram Proxy仅Soportar http/https/socks Protocolo'
            })
          }
        } catch (urlError) {
          return res.status(400).json({
            error: 'Invalid proxy url',
            message: '请提供有效的Proxy地址'
          })
        }
      }

      logger.info(`🧪 Probarwebhook: ${type} - Chat ID: ${chatId}`)
    } else {
      // 其他平台ValidarURL
      if (!url) {
        return res.status(400).json({
          error: 'Missing webhook URL',
          message: '请提供webhook URL'
        })
      }

      // ValidarURLFormato
      try {
        new URL(url)
      } catch (urlError) {
        return res.status(400).json({
          error: 'Invalid URL format',
          message: '请提供有效的webhook URL'
        })
      }

      logger.info(`🧪 Probarwebhook: ${type} - ${url}`)
    }

    // Crear临时平台Configuración
    const platform = {
      type,
      url,
      secret,
      enableSign,
      enabled: true,
      timeout: 10000
    }

    // 添加Bark特有Campo
    if (type === 'bark') {
      platform.deviceKey = deviceKey
      platform.serverUrl = serverUrl
      platform.level = level
      platform.sound = sound
      platform.group = group
    } else if (type === 'smtp') {
      // 添加SMTP特有Campo
      platform.host = host
      platform.port = port || 587
      platform.secure = secure || false
      platform.user = user
      platform.pass = pass
      platform.from = from
      platform.to = to
      platform.ignoreTLS = ignoreTLS || false
    } else if (type === 'telegram') {
      platform.botToken = botToken
      platform.chatId = chatId
      platform.apiBaseUrl = apiBaseUrl
      platform.proxyUrl = proxyUrl
    }

    const result = await webhookService.testWebhook(platform)

    const identifier = (() => {
      if (type === 'bark') {
        return `Device: ${deviceKey.substring(0, 8)}...`
      }
      if (type === 'smtp') {
        const recipients = Array.isArray(to) ? to.join(', ') : to
        return `${host}:${port || 587} -> ${recipients}`
      }
      if (type === 'telegram') {
        return `Chat ID: ${chatId}`
      }
      return url
    })()

    if (result.success) {
      logger.info(`✅ WebhookProbarÉxito: ${identifier}`)
      res.json({
        success: true,
        message: 'WebhookProbarÉxito',
        url: type === 'bark' ? undefined : url,
        deviceKey: type === 'bark' ? `${deviceKey.substring(0, 8)}...` : undefined
      })
    } else {
      logger.warn(`❌ WebhookProbarFalló: ${identifier} - ${result.error}`)
      res.status(400).json({
        success: false,
        message: 'WebhookProbarFalló',
        url: type === 'bark' ? undefined : url,
        deviceKey: type === 'bark' ? `${deviceKey.substring(0, 8)}...` : undefined,
        error: result.error
      })
    }
  } catch (error) {
    logger.error('❌ WebhookProbarError:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'ProbarwebhookFalló'
    })
  }
})

// 手动触发Notificación de prueba
router.post('/test-notification', authenticateAdmin, async (req, res) => {
  try {
    const {
      type = 'test',
      accountId = 'test-account-id',
      accountName = 'Probar账号',
      platform = 'claude-oauth',
      status = 'test',
      errorCode = 'TEST_NOTIFICATION',
      reason = '手动Notificación de prueba',
      message = '这是一条Notificación de prueba消息，用于Validar Webhook 通知功能是否正常工作'
    } = req.body

    logger.info(`🧪 发送Notificación de prueba: ${type}`)

    // 先VerificarwebhookConfiguración
    const config = await webhookConfigService.getConfig()
    logger.debug(
      `WebhookConfiguración: enabled=${config.enabled}, platforms=${config.platforms?.length || 0}`
    )
    if (!config.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Webhook通知未Habilitar，请先在Establecer中Habilitar通知功能'
      })
    }

    const enabledPlatforms = await webhookConfigService.getEnabledPlatforms()
    logger.info(`找到 ${enabledPlatforms.length} 个Habilitar的通知平台`)

    if (enabledPlatforms.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有Habilitar的通知平台，请先添加并Habilitar至少一个通知平台'
      })
    }

    const testData = {
      accountId,
      accountName,
      platform,
      status,
      errorCode,
      reason,
      message,
      timestamp: getISOStringWithTimezone(new Date())
    }

    const result = await webhookService.sendNotification(type, testData)

    // 如果没有Retornar结果，说明可能是Configuración问题
    if (!result) {
      return res.status(400).json({
        success: false,
        message: 'WebhookServicio未Retornar结果，请VerificarConfiguración和Registro',
        enabledPlatforms: enabledPlatforms.length
      })
    }

    // 如果没有Éxito和Falló的Registro
    if (result.succeeded === 0 && result.failed === 0) {
      return res.status(400).json({
        success: false,
        message: '没有发送任何通知，请Verificar通知TipoConfiguración',
        result,
        enabledPlatforms: enabledPlatforms.length
      })
    }

    if (result.failed > 0) {
      logger.warn(
        `⚠️ Notificación de prueba部分Falló: ${result.succeeded}Éxito, ${result.failed}Falló`
      )
      return res.json({
        success: true,
        message: `Notificación de prueba部分Éxito: ${result.succeeded}个平台Éxito, ${result.failed}个平台Falló`,
        data: testData,
        result
      })
    }

    logger.info(`✅ Notificación de prueba发送Éxito到 ${result.succeeded} 个平台`)

    res.json({
      success: true,
      message: `Notificación de prueba已Éxito发送到 ${result.succeeded} 个平台`,
      data: testData,
      result
    })
  } catch (error) {
    logger.error('❌ 发送Notificación de pruebaFalló:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: `发送Notificación de pruebaFalló: ${error.message}`
    })
  }
})

module.exports = router
