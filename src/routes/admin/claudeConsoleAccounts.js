/**
 * Admin Routes - Claude Console Cuenta管理
 * API Key 方式的 Claude Console Cuenta
 */

const express = require('express')
const router = express.Router()

const claudeConsoleAccountService = require('../../services/account/claudeConsoleAccountService')
const claudeConsoleRelayService = require('../../services/relay/claudeConsoleRelayService')
const accountGroupService = require('../../services/accountGroupService')
const apiKeyService = require('../../services/apiKeyService')
const redis = require('../../models/redis')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const webhookNotifier = require('../../utils/webhookNotifier')
const { formatAccountExpiry, mapExpiryField } = require('./utils')

// Obtener所有Claude ConsoleCuenta
router.get('/claude-console-accounts', authenticateAdmin, async (req, res) => {
  try {
    const { platform, groupId } = req.query
    let accounts = await claudeConsoleAccountService.getAllAccounts()

    // 根据ConsultaParámetro进Fila筛选
    if (platform && platform !== 'all' && platform !== 'claude-console') {
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
            // Convertirschedulable为布尔Valor
            schedulable: account.schedulable === 'true' || account.schedulable === true,
            groupInfos,
            usage: {
              daily: usageStats.daily,
              total: usageStats.total,
              averages: usageStats.averages
            }
          }
        } catch (statsError) {
          logger.warn(
            `⚠️ Failed to get usage stats for Claude Console account ${account.id}:`,
            statsError.message
          )
          try {
            const groupInfos = await accountGroupService.getAccountGroups(account.id)
            const formattedAccount = formatAccountExpiry(account)
            return {
              ...formattedAccount,
              // Convertirschedulable为布尔Valor
              schedulable: account.schedulable === 'true' || account.schedulable === true,
              groupInfos,
              usage: {
                daily: { tokens: 0, requests: 0, allTokens: 0 },
                total: { tokens: 0, requests: 0, allTokens: 0 },
                averages: { rpm: 0, tpm: 0 }
              }
            }
          } catch (groupError) {
            logger.warn(
              `⚠️ Failed to get group info for Claude Console account ${account.id}:`,
              groupError.message
            )
            const formattedAccount = formatAccountExpiry(account)
            return {
              ...formattedAccount,
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
    logger.error('❌ Failed to get Claude Console accounts:', error)
    return res
      .status(500)
      .json({ error: 'Failed to get Claude Console accounts', message: error.message })
  }
})

// Crear新的Claude ConsoleCuenta
router.post('/claude-console-accounts', authenticateAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      apiUrl,
      apiKey,
      priority,
      supportedModels,
      userAgent,
      rateLimitDuration,
      proxy,
      accountType,
      groupId,
      dailyQuota,
      quotaResetTime,
      maxConcurrentTasks,
      disableAutoProtection,
      interceptWarmup
    } = req.body

    if (!name || !apiUrl || !apiKey) {
      return res.status(400).json({ error: 'Name, API URL and API Key are required' })
    }

    // Validarpriority的有效性（1-100）
    if (priority !== undefined && (priority < 1 || priority > 100)) {
      return res.status(400).json({ error: 'Priority must be between 1 and 100' })
    }

    // ValidarmaxConcurrentTasks的有效性（非负整数）
    if (maxConcurrentTasks !== undefined && maxConcurrentTasks !== null) {
      const concurrent = Number(maxConcurrentTasks)
      if (!Number.isInteger(concurrent) || concurrent < 0) {
        return res.status(400).json({ error: 'maxConcurrentTasks must be a non-negative integer' })
      }
    }

    // 校验上游Error自动防护开关
    const normalizedDisableAutoProtection =
      disableAutoProtection === true || disableAutoProtection === 'true'

    // ValidaraccountType的有效性
    if (accountType && !['shared', 'dedicated', 'group'].includes(accountType)) {
      return res
        .status(400)
        .json({ error: 'Invalid account type. Must be "shared", "dedicated" or "group"' })
    }

    // 如果是AgruparTipo，ValidargroupId
    if (accountType === 'group' && !groupId) {
      return res.status(400).json({ error: 'Group ID is required for group type accounts' })
    }

    const newAccount = await claudeConsoleAccountService.createAccount({
      name,
      description,
      apiUrl,
      apiKey,
      priority: priority || 50,
      supportedModels: supportedModels || [],
      userAgent,
      rateLimitDuration:
        rateLimitDuration !== undefined && rateLimitDuration !== null ? rateLimitDuration : 60,
      proxy,
      accountType: accountType || 'shared',
      dailyQuota: dailyQuota || 0,
      quotaResetTime: quotaResetTime || '00:00',
      maxConcurrentTasks:
        maxConcurrentTasks !== undefined && maxConcurrentTasks !== null
          ? Number(maxConcurrentTasks)
          : 0,
      disableAutoProtection: normalizedDisableAutoProtection,
      interceptWarmup: interceptWarmup === true || interceptWarmup === 'true'
    })

    // 如果是AgruparTipo，将Cuenta添加到Agrupar（CCR 归属 Claude 平台Agrupar）
    if (accountType === 'group' && groupId) {
      await accountGroupService.addAccountToGroup(newAccount.id, groupId, 'claude')
    }

    logger.success(`🎮 Admin created Claude Console account: ${name}`)
    const formattedAccount = formatAccountExpiry(newAccount)
    return res.json({ success: true, data: formattedAccount })
  } catch (error) {
    logger.error('❌ Failed to create Claude Console account:', error)
    return res
      .status(500)
      .json({ error: 'Failed to create Claude Console account', message: error.message })
  }
})

// ActualizarClaude ConsoleCuenta
router.put('/claude-console-accounts/:accountId', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const updates = req.body

    // ✅ 【Nueva característica】映射Campo名：前端的 expiresAt -> 后端的 subscriptionExpiresAt
    const mappedUpdates = mapExpiryField(updates, 'Claude Console', accountId)

    // Validarpriority的有效性（1-100）
    if (
      mappedUpdates.priority !== undefined &&
      (mappedUpdates.priority < 1 || mappedUpdates.priority > 100)
    ) {
      return res.status(400).json({ error: 'Priority must be between 1 and 100' })
    }

    // ValidarmaxConcurrentTasks的有效性（非负整数）
    if (
      mappedUpdates.maxConcurrentTasks !== undefined &&
      mappedUpdates.maxConcurrentTasks !== null
    ) {
      const concurrent = Number(mappedUpdates.maxConcurrentTasks)
      if (!Number.isInteger(concurrent) || concurrent < 0) {
        return res.status(400).json({ error: 'maxConcurrentTasks must be a non-negative integer' })
      }
      // Convertir为NúmeroTipo
      mappedUpdates.maxConcurrentTasks = concurrent
    }

    // ValidaraccountType的有效性
    if (
      mappedUpdates.accountType &&
      !['shared', 'dedicated', 'group'].includes(mappedUpdates.accountType)
    ) {
      return res
        .status(400)
        .json({ error: 'Invalid account type. Must be "shared", "dedicated" or "group"' })
    }

    // 如果Actualizar为AgruparTipo，ValidargroupId
    if (mappedUpdates.accountType === 'group' && !mappedUpdates.groupId) {
      return res.status(400).json({ error: 'Group ID is required for group type accounts' })
    }

    // ObtenerCuenta当前Información以ProcesarAgrupar变更
    const currentAccount = await claudeConsoleAccountService.getAccount(accountId)
    if (!currentAccount) {
      return res.status(404).json({ error: 'Account not found' })
    }

    // 规范化上游Error自动防护开关
    if (mappedUpdates.disableAutoProtection !== undefined) {
      mappedUpdates.disableAutoProtection =
        mappedUpdates.disableAutoProtection === true ||
        mappedUpdates.disableAutoProtection === 'true'
    }

    // ProcesarAgrupar的变更
    if (mappedUpdates.accountType !== undefined) {
      // 如果之前是AgruparTipo，需要从所有Agrupar中Eliminación
      if (currentAccount.accountType === 'group') {
        const oldGroups = await accountGroupService.getAccountGroups(accountId)
        for (const oldGroup of oldGroups) {
          await accountGroupService.removeAccountFromGroup(accountId, oldGroup.id)
        }
      }
      // 如果新Tipo是Agrupar，Procesar多AgruparSoportar
      if (mappedUpdates.accountType === 'group') {
        if (Object.prototype.hasOwnProperty.call(mappedUpdates, 'groupIds')) {
          // 如果明确提供了 groupIds Parámetro（包括空Arreglo）
          if (mappedUpdates.groupIds && mappedUpdates.groupIds.length > 0) {
            // Establecer新的多Agrupar
            await accountGroupService.setAccountGroups(accountId, mappedUpdates.groupIds, 'claude')
          } else {
            // groupIds 为空Arreglo，从所有Agrupar中Eliminación
            await accountGroupService.removeAccountFromAllGroups(accountId)
          }
        } else if (mappedUpdates.groupId) {
          // 向后兼容：仅当没有 groupIds 但有 groupId 时使用单Agrupar逻辑
          await accountGroupService.addAccountToGroup(accountId, mappedUpdates.groupId, 'claude')
        }
      }
    }

    await claudeConsoleAccountService.updateAccount(accountId, mappedUpdates)

    logger.success(`📝 Admin updated Claude Console account: ${accountId}`)
    return res.json({ success: true, message: 'Claude Console account updated successfully' })
  } catch (error) {
    logger.error('❌ Failed to update Claude Console account:', error)
    return res
      .status(500)
      .json({ error: 'Failed to update Claude Console account', message: error.message })
  }
})

// EliminarClaude ConsoleCuenta
router.delete('/claude-console-accounts/:accountId', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    // 自动解绑所有绑定的 API Keys
    const unboundCount = await apiKeyService.unbindAccountFromAllKeys(accountId, 'claude-console')

    // ObtenerCuentaInformación以Verificar是否在Agrupar中
    const account = await claudeConsoleAccountService.getAccount(accountId)
    if (account && account.accountType === 'group') {
      const groups = await accountGroupService.getAccountGroups(accountId)
      for (const group of groups) {
        await accountGroupService.removeAccountFromGroup(accountId, group.id)
      }
    }

    await claudeConsoleAccountService.deleteAccount(accountId)

    let message = 'Claude Console账号已ÉxitoEliminar'
    if (unboundCount > 0) {
      message += `，${unboundCount} 个 API Key ha cambiado al modo de piscina compartida`
    }

    logger.success(
      `🗑️ Admin deleted Claude Console account: ${accountId}, unbound ${unboundCount} keys`
    )
    return res.json({
      success: true,
      message,
      unboundKeys: unboundCount
    })
  } catch (error) {
    logger.error('❌ Failed to delete Claude Console account:', error)
    return res
      .status(500)
      .json({ error: 'Failed to delete Claude Console account', message: error.message })
  }
})

// 切换Claude ConsoleCuenta状态
router.put('/claude-console-accounts/:accountId/toggle', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    const account = await claudeConsoleAccountService.getAccount(accountId)
    if (!account) {
      return res.status(404).json({ error: 'Account not found' })
    }

    const newStatus = !account.isActive
    await claudeConsoleAccountService.updateAccount(accountId, { isActive: newStatus })

    logger.success(
      `🔄 Admin toggled Claude Console account status: ${accountId} -> ${
        newStatus ? 'active' : 'inactive'
      }`
    )
    return res.json({ success: true, isActive: newStatus })
  } catch (error) {
    logger.error('❌ Failed to toggle Claude Console account status:', error)
    return res
      .status(500)
      .json({ error: 'Failed to toggle account status', message: error.message })
  }
})

// 切换Claude ConsoleCuenta调度状态
router.put(
  '/claude-console-accounts/:accountId/toggle-schedulable',
  authenticateAdmin,
  async (req, res) => {
    try {
      const { accountId } = req.params

      const account = await claudeConsoleAccountService.getAccount(accountId)
      if (!account) {
        return res.status(404).json({ error: 'Account not found' })
      }

      const newSchedulable = !account.schedulable
      await claudeConsoleAccountService.updateAccount(accountId, { schedulable: newSchedulable })

      // 如果账号被Deshabilitar，发送webhook通知
      if (!newSchedulable) {
        await webhookNotifier.sendAccountAnomalyNotification({
          accountId: account.id,
          accountName: account.name || 'Claude Console Account',
          platform: 'claude-console',
          status: 'disabled',
          errorCode: 'CLAUDE_CONSOLE_MANUALLY_DISABLED',
          reason: '账号已被管理员手动Deshabilitar调度',
          timestamp: new Date().toISOString()
        })
      }

      logger.success(
        `🔄 Admin toggled Claude Console account schedulable status: ${accountId} -> ${
          newSchedulable ? 'schedulable' : 'not schedulable'
        }`
      )
      return res.json({ success: true, schedulable: newSchedulable })
    } catch (error) {
      logger.error('❌ Failed to toggle Claude Console account schedulable status:', error)
      return res
        .status(500)
        .json({ error: 'Failed to toggle schedulable status', message: error.message })
    }
  }
)

// ObtenerClaude ConsoleCuenta的使用Estadística
router.get('/claude-console-accounts/:accountId/usage', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const usageStats = await claudeConsoleAccountService.getAccountUsageStats(accountId)

    if (!usageStats) {
      return res.status(404).json({ error: 'Account not found' })
    }

    return res.json(usageStats)
  } catch (error) {
    logger.error('❌ Failed to get Claude Console account usage stats:', error)
    return res.status(500).json({ error: 'Failed to get usage stats', message: error.message })
  }
})

// 手动重置Claude ConsoleCuenta的每日使用量
router.post(
  '/claude-console-accounts/:accountId/reset-usage',
  authenticateAdmin,
  async (req, res) => {
    try {
      const { accountId } = req.params
      await claudeConsoleAccountService.resetDailyUsage(accountId)

      logger.success(`Admin manually reset daily usage for Claude Console account: ${accountId}`)
      return res.json({ success: true, message: 'Daily usage reset successfully' })
    } catch (error) {
      logger.error('❌ Failed to reset Claude Console account daily usage:', error)
      return res.status(500).json({ error: 'Failed to reset daily usage', message: error.message })
    }
  }
)

// 重置Claude ConsoleCuenta状态（清除所有异常状态）
router.post(
  '/claude-console-accounts/:accountId/reset-status',
  authenticateAdmin,
  async (req, res) => {
    try {
      const { accountId } = req.params
      const result = await claudeConsoleAccountService.resetAccountStatus(accountId)
      logger.success(`Admin reset status for Claude Console account: ${accountId}`)
      return res.json({ success: true, data: result })
    } catch (error) {
      logger.error('❌ Failed to reset Claude Console account status:', error)
      return res.status(500).json({ error: 'Failed to reset status', message: error.message })
    }
  }
)

// 手动重置所有Claude ConsoleCuenta的每日使用量
router.post('/claude-console-accounts/reset-all-usage', authenticateAdmin, async (req, res) => {
  try {
    await claudeConsoleAccountService.resetAllDailyUsage()

    logger.success('Admin manually reset daily usage for all Claude Console accounts')
    return res.json({ success: true, message: 'All daily usage reset successfully' })
  } catch (error) {
    logger.error('❌ Failed to reset all Claude Console accounts daily usage:', error)
    return res
      .status(500)
      .json({ error: 'Failed to reset all daily usage', message: error.message })
  }
})

// ProbarClaude ConsoleCuenta连通性（流式Respuesta）- 复用 claudeConsoleRelayService
router.post('/claude-console-accounts/:accountId/test', authenticateAdmin, async (req, res) => {
  const { accountId } = req.params

  try {
    // 直接调用Servicio层的ProbarMétodo
    await claudeConsoleRelayService.testAccountConnection(accountId, res)
  } catch (error) {
    logger.error(`❌ Failed to test Claude Console account:`, error)
    // Error已在Servicio层Procesar，这里仅做RegistroRegistro
  }
})

module.exports = router
