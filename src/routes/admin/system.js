const express = require('express')
const claudeCodeHeadersService = require('../../services/claudeCodeHeadersService')
const claudeAccountService = require('../../services/account/claudeAccountService')
const redis = require('../../models/redis')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const config = require('../../../config/config')

const router = express.Router()

const updateService = require('../../services/updateService')

// ==================== System Update ====================

async function getUpdateStatusHandler(_req, res) {
  try {
    const status = await updateService.getUpdateStatus()
    return res.json({ success: true, data: status })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

function mapUpdateStatusToLegacyPayload(status) {
  return {
    current: status.currentVersion || status.current || '',
    latest: status.latestVersion || status.latest || '',
    hasUpdate: !!status.hasUpdate,
    releaseInfo: status.releaseUrl
      ? {
          htmlUrl: status.releaseUrl,
          body: status.releaseNotes || ''
        }
      : null
  }
}

// New update status endpoint
router.get('/update-status', authenticateAdmin, getUpdateStatusHandler)

// Compatibility alias used by some SPA builds
router.get('/system/update-status', authenticateAdmin, getUpdateStatusHandler)

// Back-compat endpoint used by older UI code
router.get('/check-updates', authenticateAdmin, async (_req, res) => {
  try {
    const status = await updateService.getUpdateStatus()

    return res.json({ success: true, data: mapUpdateStatusToLegacyPayload(status) })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== Claude Code Headers Management ====================

// 获取所有 Claude Code headers
router.get('/claude-code-headers', authenticateAdmin, async (req, res) => {
  try {
    const allHeaders = await claudeCodeHeadersService.getAllAccountHeaders()

    // 获取所有 Claude 账号信息
    const accounts = await claudeAccountService.getAllAccounts()
    const accountMap = {}
    accounts.forEach((account) => {
      accountMap[account.id] = account.name
    })

    // 格式化输出
    const formattedData = Object.entries(allHeaders).map(([accountId, data]) => ({
      accountId,
      accountName: accountMap[accountId] || 'Unknown',
      version: data.version,
      userAgent: data.headers['user-agent'],
      updatedAt: data.updatedAt,
      headers: data.headers
    }))

    return res.json({
      success: true,
      data: formattedData
    })
  } catch (error) {
    logger.error('❌ Failed to get Claude Code headers:', error)
    return res
      .status(500)
      .json({ error: 'Failed to get Claude Code headers', message: error.message })
  }
})

// 🗑️ 清除指定账号的 Claude Code headers
router.delete('/claude-code-headers/:accountId', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    await claudeCodeHeadersService.clearAccountHeaders(accountId)

    return res.json({
      success: true,
      message: `Claude Code headers cleared for account ${accountId}`
    })
  } catch (error) {
    logger.error('❌ Failed to clear Claude Code headers:', error)
    return res
      .status(500)
      .json({ error: 'Failed to clear Claude Code headers', message: error.message })
  }
})

// ... other routes ...

// ==================== OEM 设置管理 ====================

// 获取OEM设置（公开接口，用于显示）
// 注意：这个端点没有 authenticateAdmin 中间件，因为前端登录页也需要访问
router.get('/oem-settings', async (req, res) => {
  try {
    const client = redis.getClient()
    const oemSettings = await client.get('oem:settings')

    // 默认设置
    const defaultSettings = {
      siteName: 'Claude Relay Service',
      siteIcon: '',
      siteIconData: '', // Base64编码的图标数据
      showAdminButton: true, // 是否显示管理后台按钮
      apiStatsNotice: {
        enabled: false,
        title: '',
        content: ''
      },
      updatedAt: new Date().toISOString()
    }

    let settings = defaultSettings
    if (oemSettings) {
      try {
        settings = { ...defaultSettings, ...JSON.parse(oemSettings) }
      } catch (err) {
        logger.warn('⚠️ Failed to parse OEM settings, using defaults:', err.message)
      }
    }

    // 添加 LDAP 启用状态到响应中
    return res.json({
      success: true,
      data: {
        ...settings,
        ldapEnabled: config.ldap && config.ldap.enabled === true
      }
    })
  } catch (error) {
    logger.error('❌ Failed to get OEM settings:', error)
    return res.status(500).json({ error: 'Failed to get OEM settings', message: error.message })
  }
})

// 更新OEM设置
router.put('/oem-settings', authenticateAdmin, async (req, res) => {
  try {
    const { siteName, siteIcon, siteIconData, showAdminButton, apiStatsNotice } = req.body

    // 验证输入
    if (!siteName || typeof siteName !== 'string' || siteName.trim().length === 0) {
      return res.status(400).json({ error: 'Site name is required' })
    }

    if (siteName.length > 100) {
      return res.status(400).json({ error: 'Site name must be less than 100 characters' })
    }

    // 验证图标数据大小（如果是base64）
    if (siteIconData && siteIconData.length > 500000) {
      // 约375KB
      return res.status(400).json({ error: 'Icon file must be less than 350KB' })
    }

    // 验证图标URL（如果提供）
    if (siteIcon && !siteIconData) {
      // 简单验证URL格式
      try {
        new URL(siteIcon)
      } catch (err) {
        return res.status(400).json({ error: 'Invalid icon URL format' })
      }
    }

    const settings = {
      siteName: siteName.trim(),
      siteIcon: (siteIcon || '').trim(),
      siteIconData: (siteIconData || '').trim(), // Base64数据
      showAdminButton: showAdminButton !== false, // 默认为true
      apiStatsNotice: {
        enabled: apiStatsNotice?.enabled === true,
        title: (apiStatsNotice?.title || '').trim().slice(0, 100),
        content: (apiStatsNotice?.content || '').trim().slice(0, 2000)
      },
      updatedAt: new Date().toISOString()
    }

    const client = redis.getClient()
    await client.set('oem:settings', JSON.stringify(settings))

    logger.info(`✅ OEM settings updated: ${siteName}`)

    return res.json({
      success: true,
      message: 'OEM settings updated successfully',
      data: settings
    })
  } catch (error) {
    logger.error('❌ Failed to update OEM settings:', error)
    return res.status(500).json({ error: 'Failed to update OEM settings', message: error.message })
  }
})

// ==================== Claude Code 版本管理 ====================

router.get('/claude-code-version', authenticateAdmin, async (req, res) => {
  try {
    const CACHE_KEY = 'claude_code_user_agent:daily'

    // 获取缓存的统一User-Agent
    const unifiedUserAgent = await redis.client.get(CACHE_KEY)
    const ttl = unifiedUserAgent ? await redis.client.ttl(CACHE_KEY) : 0

    res.json({
      success: true,
      userAgent: unifiedUserAgent,
      isActive: !!unifiedUserAgent,
      ttlSeconds: ttl,
      lastUpdated: unifiedUserAgent ? new Date().toISOString() : null
    })
  } catch (error) {
    logger.error('❌ Get unified Claude Code User-Agent error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get User-Agent information',
      error: error.message
    })
  }
})

// 🗑️ 清除统一Claude Code User-Agent缓存
router.post('/claude-code-version/clear', authenticateAdmin, async (req, res) => {
  try {
    const CACHE_KEY = 'claude_code_user_agent:daily'

    // 删除缓存的统一User-Agent
    await redis.client.del(CACHE_KEY)

    logger.info(`🗑️ Admin manually cleared unified Claude Code User-Agent cache`)

    res.json({
      success: true,
      message: 'Unified User-Agent cache cleared successfully'
    })
  } catch (error) {
    logger.error('❌ Clear unified User-Agent cache error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    })
  }
})

// ==================== 模型价格管理 ====================

const pricingService = require('../../services/pricingService')

// 获取所有模型价格数据
router.get('/models/pricing', authenticateAdmin, async (req, res) => {
  try {
    if (!pricingService.pricingData || Object.keys(pricingService.pricingData).length === 0) {
      await pricingService.loadPricingData()
    }
    const data = pricingService.pricingData
    res.json({
      success: true,
      data: data || {}
    })
  } catch (error) {
    logger.error('Failed to get model pricing:', error)
    res.status(500).json({ error: 'Failed to get model pricing', message: error.message })
  }
})

// 获取价格服务状态
router.get('/models/pricing/status', authenticateAdmin, async (req, res) => {
  try {
    const status = pricingService.getStatus()
    res.json({ success: true, data: status })
  } catch (error) {
    logger.error('Failed to get pricing status:', error)
    res.status(500).json({ error: 'Failed to get pricing status', message: error.message })
  }
})

// 强制刷新价格数据
router.post('/models/pricing/refresh', authenticateAdmin, async (req, res) => {
  try {
    const result = await pricingService.forceUpdate()
    res.json({ success: result.success, message: result.message })
  } catch (error) {
    logger.error('Failed to refresh pricing:', error)
    res.status(500).json({ error: 'Failed to refresh pricing', message: error.message })
  }
})

module.exports = router
