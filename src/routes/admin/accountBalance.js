const express = require('express')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const accountBalanceService = require('../../services/account/accountBalanceService')
const balanceScriptService = require('../../services/balanceScriptService')
const { isBalanceScriptEnabled } = require('../../utils/featureFlags')

const router = express.Router()

const ensureValidPlatform = (rawPlatform) => {
  const normalized = accountBalanceService.normalizePlatform(rawPlatform)
  if (!normalized) {
    return { ok: false, status: 400, error: '缺少 platform Parámetro' }
  }

  const supported = accountBalanceService.getSupportedPlatforms()
  if (!supported.includes(normalized)) {
    return { ok: false, status: 400, error: `不Soportar的平台: ${normalized}` }
  }

  return { ok: true, platform: normalized }
}

// 1) ObtenerCuenta余额（Predeterminado本地Estadística优先，Opcional触发 Provider）
// GET /admin/accounts/:accountId/balance?platform=xxx&queryApi=false
router.get('/accounts/:accountId/balance', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const { platform, queryApi } = req.query

    const valid = ensureValidPlatform(platform)
    if (!valid.ok) {
      return res.status(valid.status).json({ success: false, error: valid.error })
    }

    const balance = await accountBalanceService.getAccountBalance(accountId, valid.platform, {
      queryApi
    })

    if (!balance) {
      return res.status(404).json({ success: false, error: 'Account not found' })
    }

    return res.json(balance)
  } catch (error) {
    logger.error('ObtenerCuenta余额Falló', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

// 2) 强制刷新Cuenta余额（强制触发Consulta：优先脚本；Provider 仅为Degradación）
// POST /admin/accounts/:accountId/balance/refresh
// Body: { platform: 'xxx' }
router.post('/accounts/:accountId/balance/refresh', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const { platform } = req.body || {}

    const valid = ensureValidPlatform(platform)
    if (!valid.ok) {
      return res.status(valid.status).json({ success: false, error: valid.error })
    }

    logger.info(`手动刷新余额: ${valid.platform}:${accountId}`)

    const balance = await accountBalanceService.refreshAccountBalance(accountId, valid.platform)
    if (!balance) {
      return res.status(404).json({ success: false, error: 'Account not found' })
    }

    return res.json(balance)
  } catch (error) {
    logger.error('刷新Cuenta余额Falló', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

// 3) 批量Obtener平台所有Cuenta余额
// GET /admin/accounts/balance/platform/:platform?queryApi=false
router.get('/accounts/balance/platform/:platform', authenticateAdmin, async (req, res) => {
  try {
    const { platform } = req.params
    const { queryApi } = req.query

    const valid = ensureValidPlatform(platform)
    if (!valid.ok) {
      return res.status(valid.status).json({ success: false, error: valid.error })
    }

    const balances = await accountBalanceService.getAllAccountsBalance(valid.platform, { queryApi })

    return res.json({ success: true, data: balances })
  } catch (error) {
    logger.error('批量Obtener余额Falló', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

// 4) Obtener余额汇总（Dashboard 用）
// GET /admin/accounts/balance/summary
router.get('/accounts/balance/summary', authenticateAdmin, async (req, res) => {
  try {
    const summary = await accountBalanceService.getBalanceSummary()
    return res.json({ success: true, data: summary })
  } catch (error) {
    logger.error('Obtener余额汇总Falló', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

// 5) 清除Caché
// DELETE /admin/accounts/:accountId/balance/cache?platform=xxx
router.delete('/accounts/:accountId/balance/cache', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const { platform } = req.query

    const valid = ensureValidPlatform(platform)
    if (!valid.ok) {
      return res.status(valid.status).json({ success: false, error: valid.error })
    }

    await accountBalanceService.clearCache(accountId, valid.platform)

    return res.json({ success: true, message: 'Caché已清除' })
  } catch (error) {
    logger.error('清除CachéFalló', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

// 6) Obtener/保存/Probar余额脚本Configuración（单Cuenta）
router.get('/accounts/:accountId/balance/script', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const { platform } = req.query

    const valid = ensureValidPlatform(platform)
    if (!valid.ok) {
      return res.status(valid.status).json({ success: false, error: valid.error })
    }

    const config = await accountBalanceService.redis.getBalanceScriptConfig(
      valid.platform,
      accountId
    )
    return res.json({ success: true, data: config || null })
  } catch (error) {
    logger.error('Obtener余额脚本ConfiguraciónFalló', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/accounts/:accountId/balance/script', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const { platform } = req.query
    const valid = ensureValidPlatform(platform)
    if (!valid.ok) {
      return res.status(valid.status).json({ success: false, error: valid.error })
    }

    const payload = req.body || {}
    await accountBalanceService.redis.setBalanceScriptConfig(valid.platform, accountId, payload)
    return res.json({ success: true, data: payload })
  } catch (error) {
    logger.error('保存余额脚本ConfiguraciónFalló', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/accounts/:accountId/balance/script/test', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const { platform } = req.query
    const valid = ensureValidPlatform(platform)
    if (!valid.ok) {
      return res.status(valid.status).json({ success: false, error: valid.error })
    }

    if (!isBalanceScriptEnabled()) {
      return res.status(403).json({
        success: false,
        error: '余额脚本功能已Deshabilitar（可通过 BALANCE_SCRIPT_ENABLED=true Habilitar）'
      })
    }

    const payload = req.body || {}
    const { scriptBody } = payload
    if (!scriptBody) {
      return res.status(400).json({ success: false, error: '脚本内容不能为空' })
    }

    const result = await balanceScriptService.execute({
      scriptBody,
      timeoutSeconds: payload.timeoutSeconds || 10,
      variables: {
        baseUrl: payload.baseUrl || '',
        apiKey: payload.apiKey || '',
        token: payload.token || '',
        accountId,
        platform: valid.platform,
        extra: payload.extra || ''
      }
    })

    return res.json({ success: true, data: result })
  } catch (error) {
    logger.error('Probar余额脚本Falló', error)
    return res.status(400).json({ success: false, error: error.message })
  }
})

module.exports = router
