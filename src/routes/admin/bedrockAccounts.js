/**
 * Admin Routes - Bedrock Accounts Management
 * AWS Bedrock Cuenta管理Ruta
 */

const express = require('express')
const router = express.Router()
const bedrockAccountService = require('../../services/account/bedrockAccountService')
const apiKeyService = require('../../services/apiKeyService')
const accountGroupService = require('../../services/accountGroupService')
const redis = require('../../models/redis')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const webhookNotifier = require('../../utils/webhookNotifier')
const { formatAccountExpiry, mapExpiryField } = require('./utils')

// ☁️ Bedrock Cuenta管理

// Obtener所有BedrockCuenta
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { platform, groupId } = req.query
    const result = await bedrockAccountService.getAllAccounts()
    if (!result.success) {
      return res
        .status(500)
        .json({ error: 'Failed to get Bedrock accounts', message: result.error })
    }

    let accounts = result.data

    // 根据ConsultaParámetro进Fila筛选
    if (platform && platform !== 'all' && platform !== 'bedrock') {
      // 如果指定了其他平台，Retornar空Arreglo
      accounts = []
    }

    // 如果指定了Agrupar筛选
    if (groupId && groupId !== 'all') {
      if (groupId === 'ungrouped') {
        // 筛选未AgruparCuenta
        const filteredAccounts = []
        for (const account of accounts) {
          const groups = await accountGroupService.getAccountGroups(account.id)
          if (!groups || groups.length === 0) {
            filteredAccounts.push(account)
          }
        }
        accounts = filteredAccounts
      } else {
        // 筛选特定Agrupar的Cuenta
        const groupMembers = await accountGroupService.getGroupMembers(groupId)
        accounts = accounts.filter((account) => groupMembers.includes(account.id))
      }
    }

    // 为每个Cuenta添加使用EstadísticaInformación
    const accountsWithStats = await Promise.all(
      accounts.map(async (account) => {
        try {
          const usageStats = await redis.getAccountUsageStats(account.id, 'openai')
          const groupInfos = await accountGroupService.getAccountGroups(account.id)

          const formattedAccount = formatAccountExpiry(account)
          return {
            ...formattedAccount,
            groupInfos,
            usage: {
              daily: usageStats.daily,
              total: usageStats.total,
              averages: usageStats.averages
            }
          }
        } catch (statsError) {
          logger.warn(
            `⚠️ Failed to get usage stats for Bedrock account ${account.id}:`,
            statsError.message
          )
          try {
            const groupInfos = await accountGroupService.getAccountGroups(account.id)
            const formattedAccount = formatAccountExpiry(account)
            return {
              ...formattedAccount,
              groupInfos,
              usage: {
                daily: { tokens: 0, requests: 0, allTokens: 0 },
                total: { tokens: 0, requests: 0, allTokens: 0 },
                averages: { rpm: 0, tpm: 0 }
              }
            }
          } catch (groupError) {
            logger.warn(
              `⚠️ Failed to get group info for account ${account.id}:`,
              groupError.message
            )
            return {
              ...account,
              groupInfos: [],
              usage: {
                daily: { tokens: 0, requests: 0, allTokens: 0 },
                total: { tokens: 0, requests: 0, allTokens: 0 },
                averages: { rpm: 0, tpm: 0 }
              }
            }
          }
        }
      })
    )

    return res.json({ success: true, data: accountsWithStats })
  } catch (error) {
    logger.error('❌ Failed to get Bedrock accounts:', error)
    return res.status(500).json({ error: 'Failed to get Bedrock accounts', message: error.message })
  }
})

// Crear新的BedrockCuenta
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      region,
      awsCredentials,
      bearerToken,
      defaultModel,
      priority,
      accountType,
      credentialType
    } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    // Validarpriority的有效性（1-100）
    if (priority !== undefined && (priority < 1 || priority > 100)) {
      return res.status(400).json({ error: 'Priority must be between 1 and 100' })
    }

    // ValidaraccountType的有效性
    if (accountType && !['shared', 'dedicated'].includes(accountType)) {
      return res
        .status(400)
        .json({ error: 'Invalid account type. Must be "shared" or "dedicated"' })
    }

    // ValidarcredentialType的有效性
    if (credentialType && !['access_key', 'bearer_token'].includes(credentialType)) {
      return res.status(400).json({
        error: 'Invalid credential type. Must be "access_key" or "bearer_token"'
      })
    }

    const result = await bedrockAccountService.createAccount({
      name,
      description: description || '',
      region: region || 'us-east-1',
      awsCredentials,
      bearerToken,
      defaultModel,
      priority: priority || 50,
      accountType: accountType || 'shared',
      credentialType: credentialType || 'access_key'
    })

    if (!result.success) {
      return res
        .status(500)
        .json({ error: 'Failed to create Bedrock account', message: result.error })
    }

    logger.success(`☁️ Admin created Bedrock account: ${name}`)
    const formattedAccount = formatAccountExpiry(result.data)
    return res.json({ success: true, data: formattedAccount })
  } catch (error) {
    logger.error('❌ Failed to create Bedrock account:', error)
    return res
      .status(500)
      .json({ error: 'Failed to create Bedrock account', message: error.message })
  }
})

// ActualizarBedrockCuenta
router.put('/:accountId', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const updates = req.body

    // ✅ 【Nueva característica】映射Campo名：前端的 expiresAt -> 后端的 subscriptionExpiresAt
    const mappedUpdates = mapExpiryField(updates, 'Bedrock', accountId)

    // Validarpriority的有效性（1-100）
    if (
      mappedUpdates.priority !== undefined &&
      (mappedUpdates.priority < 1 || mappedUpdates.priority > 100)
    ) {
      return res.status(400).json({ error: 'Priority must be between 1 and 100' })
    }

    // ValidaraccountType的有效性
    if (mappedUpdates.accountType && !['shared', 'dedicated'].includes(mappedUpdates.accountType)) {
      return res
        .status(400)
        .json({ error: 'Invalid account type. Must be "shared" or "dedicated"' })
    }

    // ValidarcredentialType的有效性
    if (
      mappedUpdates.credentialType &&
      !['access_key', 'bearer_token'].includes(mappedUpdates.credentialType)
    ) {
      return res.status(400).json({
        error: 'Invalid credential type. Must be "access_key" or "bearer_token"'
      })
    }

    const result = await bedrockAccountService.updateAccount(accountId, mappedUpdates)

    if (!result.success) {
      return res
        .status(500)
        .json({ error: 'Failed to update Bedrock account', message: result.error })
    }

    logger.success(`📝 Admin updated Bedrock account: ${accountId}`)
    return res.json({ success: true, message: 'Bedrock account updated successfully' })
  } catch (error) {
    logger.error('❌ Failed to update Bedrock account:', error)
    return res
      .status(500)
      .json({ error: 'Failed to update Bedrock account', message: error.message })
  }
})

// EliminarBedrockCuenta
router.delete('/:accountId', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    // 自动解绑所有绑定的 API Keys
    const unboundCount = await apiKeyService.unbindAccountFromAllKeys(accountId, 'bedrock')

    const result = await bedrockAccountService.deleteAccount(accountId)

    if (!result.success) {
      return res
        .status(500)
        .json({ error: 'Failed to delete Bedrock account', message: result.error })
    }

    let message = 'Bedrock账号已ÉxitoEliminar'
    if (unboundCount > 0) {
      message += `，${unboundCount} 个 API Key ha cambiado al modo de piscina compartida`
    }

    logger.success(`🗑️ Admin deleted Bedrock account: ${accountId}, unbound ${unboundCount} keys`)
    return res.json({
      success: true,
      message,
      unboundKeys: unboundCount
    })
  } catch (error) {
    logger.error('❌ Failed to delete Bedrock account:', error)
    return res
      .status(500)
      .json({ error: 'Failed to delete Bedrock account', message: error.message })
  }
})

// 切换BedrockCuenta状态
router.put('/:accountId/toggle', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    const accountResult = await bedrockAccountService.getAccount(accountId)
    if (!accountResult.success) {
      return res.status(404).json({ error: 'Account not found' })
    }

    const newStatus = !accountResult.data.isActive
    const updateResult = await bedrockAccountService.updateAccount(accountId, {
      isActive: newStatus
    })

    if (!updateResult.success) {
      return res
        .status(500)
        .json({ error: 'Failed to toggle account status', message: updateResult.error })
    }

    logger.success(
      `🔄 Admin toggled Bedrock account status: ${accountId} -> ${
        newStatus ? 'active' : 'inactive'
      }`
    )
    return res.json({ success: true, isActive: newStatus })
  } catch (error) {
    logger.error('❌ Failed to toggle Bedrock account status:', error)
    return res
      .status(500)
      .json({ error: 'Failed to toggle account status', message: error.message })
  }
})

// 切换BedrockCuenta调度状态
router.put('/:accountId/toggle-schedulable', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    const accountResult = await bedrockAccountService.getAccount(accountId)
    if (!accountResult.success) {
      return res.status(404).json({ error: 'Account not found' })
    }

    const newSchedulable = !accountResult.data.schedulable
    const updateResult = await bedrockAccountService.updateAccount(accountId, {
      schedulable: newSchedulable
    })

    if (!updateResult.success) {
      return res
        .status(500)
        .json({ error: 'Failed to toggle schedulable status', message: updateResult.error })
    }

    // 如果账号被Deshabilitar，发送webhook通知
    if (!newSchedulable) {
      await webhookNotifier.sendAccountAnomalyNotification({
        accountId: accountResult.data.id,
        accountName: accountResult.data.name || 'Bedrock Account',
        platform: 'bedrock',
        status: 'disabled',
        errorCode: 'BEDROCK_MANUALLY_DISABLED',
        reason: '账号已被管理员手动Deshabilitar调度',
        timestamp: new Date().toISOString()
      })
    }

    logger.success(
      `🔄 Admin toggled Bedrock account schedulable status: ${accountId} -> ${
        newSchedulable ? 'schedulable' : 'not schedulable'
      }`
    )
    return res.json({ success: true, schedulable: newSchedulable })
  } catch (error) {
    logger.error('❌ Failed to toggle Bedrock account schedulable status:', error)
    return res
      .status(500)
      .json({ error: 'Failed to toggle schedulable status', message: error.message })
  }
})

// ProbarBedrockCuentaConexión（SSE 流式）
router.post('/:accountId/test', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    await bedrockAccountService.testAccountConnection(accountId, res)
  } catch (error) {
    logger.error('❌ Failed to test Bedrock account:', error)
    // Error已在Servicio层Procesar，这里仅做RegistroRegistro
  }
})

// 重置 Bedrock Cuenta状态
router.post('/:accountId/reset-status', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const result = await bedrockAccountService.resetAccountStatus(accountId)
    logger.success(`Admin reset status for Bedrock account: ${accountId}`)
    return res.json({ success: true, data: result })
  } catch (error) {
    logger.error('❌ Failed to reset Bedrock account status:', error)
    return res.status(500).json({ error: 'Failed to reset status', message: error.message })
  }
})

module.exports = router
