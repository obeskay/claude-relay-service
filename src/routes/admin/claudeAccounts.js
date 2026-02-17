/**
 * Admin Routes - Claude 官方Cuenta管理
 * OAuth 方式授权的 Claude Cuenta
 */

const express = require('express')
const router = express.Router()

const claudeAccountService = require('../../services/account/claudeAccountService')
const claudeRelayService = require('../../services/relay/claudeRelayService')
const accountGroupService = require('../../services/accountGroupService')
const accountTestSchedulerService = require('../../services/accountTestSchedulerService')
const apiKeyService = require('../../services/apiKeyService')
const redis = require('../../models/redis')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const oauthHelper = require('../../utils/oauthHelper')
const CostCalculator = require('../../utils/costCalculator')
const webhookNotifier = require('../../utils/webhookNotifier')
const { formatAccountExpiry, mapExpiryField } = require('./utils')

// GenerarOAuth授权URL
router.post('/claude-accounts/generate-auth-url', authenticateAdmin, async (req, res) => {
  try {
    const { proxy } = req.body // 接收ProxyConfiguración
    const oauthParams = await oauthHelper.generateOAuthParams()

    // 将codeVerifier和state临时存储到Redis，用于后续Validar
    const sessionId = require('crypto').randomUUID()
    await redis.setOAuthSession(sessionId, {
      codeVerifier: oauthParams.codeVerifier,
      state: oauthParams.state,
      codeChallenge: oauthParams.codeChallenge,
      proxy: proxy || null, // 存储ProxyConfiguración
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10分钟过期
    })

    logger.success('Generated OAuth authorization URL with proxy support')
    return res.json({
      success: true,
      data: {
        authUrl: oauthParams.authUrl,
        sessionId,
        instructions: [
          '1. 复制上面的链接到Navegador中打开',
          '2. 登录您的 Anthropic Cuenta',
          '3. 同意应用Permiso',
          '4. 复制Navegador地址栏中的完整 URL',
          '5. 在添加CuentaTabla单中粘贴完整的回调 URL 和授权码'
        ]
      }
    })
  } catch (error) {
    logger.error('❌ Failed to generate OAuth URL:', error)
    return res.status(500).json({ error: 'Failed to generate OAuth URL', message: error.message })
  }
})

// Validar授权码并Obtenertoken
router.post('/claude-accounts/exchange-code', authenticateAdmin, async (req, res) => {
  try {
    const { sessionId, authorizationCode, callbackUrl } = req.body

    if (!sessionId || (!authorizationCode && !callbackUrl)) {
      return res
        .status(400)
        .json({ error: 'Session ID and authorization code (or callback URL) are required' })
    }

    // 从RedisObtenerOAuthSesiónInformación
    const oauthSession = await redis.getOAuthSession(sessionId)
    if (!oauthSession) {
      return res.status(400).json({ error: 'Invalid or expired OAuth session' })
    }

    // VerificarSesión是否过期
    if (new Date() > new Date(oauthSession.expiresAt)) {
      await redis.deleteOAuthSession(sessionId)
      return res
        .status(400)
        .json({ error: 'OAuth session has expired, please generate a new authorization URL' })
    }

    // 统一Procesar授权码输入（可能是直接的code或完整的回调URL）
    let finalAuthCode
    const inputValue = callbackUrl || authorizationCode

    try {
      finalAuthCode = oauthHelper.parseCallbackUrl(inputValue)
    } catch (parseError) {
      return res
        .status(400)
        .json({ error: 'Failed to parse authorization input', message: parseError.message })
    }

    // 交换访问Token
    const tokenData = await oauthHelper.exchangeCodeForTokens(
      finalAuthCode,
      oauthSession.codeVerifier,
      oauthSession.state,
      oauthSession.proxy // 传递ProxyConfiguración
    )

    // LimpiarOAuthSesión
    await redis.deleteOAuthSession(sessionId)

    logger.success('🎉 Successfully exchanged authorization code for tokens')
    return res.json({
      success: true,
      data: {
        claudeAiOauth: tokenData
      }
    })
  } catch (error) {
    logger.error('❌ Failed to exchange authorization code:', {
      error: error.message,
      sessionId: req.body.sessionId,
      // 不Registro完整的授权码，只Registro长度和前几个字符
      codeLength: req.body.callbackUrl
        ? req.body.callbackUrl.length
        : req.body.authorizationCode
          ? req.body.authorizationCode.length
          : 0,
      codePrefix: req.body.callbackUrl
        ? `${req.body.callbackUrl.substring(0, 10)}...`
        : req.body.authorizationCode
          ? `${req.body.authorizationCode.substring(0, 10)}...`
          : 'N/A'
    })
    return res
      .status(500)
      .json({ error: 'Failed to exchange authorization code', message: error.message })
  }
})

// GenerarClaude setup-token授权URL
router.post('/claude-accounts/generate-setup-token-url', authenticateAdmin, async (req, res) => {
  try {
    const { proxy } = req.body // 接收ProxyConfiguración
    const setupTokenParams = await oauthHelper.generateSetupTokenParams()

    // 将codeVerifier和state临时存储到Redis，用于后续Validar
    const sessionId = require('crypto').randomUUID()
    await redis.setOAuthSession(sessionId, {
      type: 'setup-token', // 标记为setup-tokenTipo
      codeVerifier: setupTokenParams.codeVerifier,
      state: setupTokenParams.state,
      codeChallenge: setupTokenParams.codeChallenge,
      proxy: proxy || null, // 存储ProxyConfiguración
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10分钟过期
    })

    logger.success('Generated Setup Token authorization URL with proxy support')
    return res.json({
      success: true,
      data: {
        authUrl: setupTokenParams.authUrl,
        sessionId,
        instructions: [
          '1. 复制上面的链接到Navegador中打开',
          '2. 登录您的 Claude Cuenta并授权 Claude Code',
          '3. Completado授权后，从RetornarPágina复制 Authorization Code',
          '4. 在添加CuentaTabla单中粘贴 Authorization Code'
        ]
      }
    })
  } catch (error) {
    logger.error('❌ Failed to generate Setup Token URL:', error)
    return res
      .status(500)
      .json({ error: 'Failed to generate Setup Token URL', message: error.message })
  }
})

// Validarsetup-token授权码并Obtenertoken
router.post('/claude-accounts/exchange-setup-token-code', authenticateAdmin, async (req, res) => {
  try {
    const { sessionId, authorizationCode, callbackUrl } = req.body

    if (!sessionId || (!authorizationCode && !callbackUrl)) {
      return res
        .status(400)
        .json({ error: 'Session ID and authorization code (or callback URL) are required' })
    }

    // 从RedisObtenerOAuthSesiónInformación
    const oauthSession = await redis.getOAuthSession(sessionId)
    if (!oauthSession) {
      return res.status(400).json({ error: 'Invalid or expired OAuth session' })
    }

    // Verificar是否是setup-tokenTipo
    if (oauthSession.type !== 'setup-token') {
      return res.status(400).json({ error: 'Invalid session type for setup token exchange' })
    }

    // VerificarSesión是否过期
    if (new Date() > new Date(oauthSession.expiresAt)) {
      await redis.deleteOAuthSession(sessionId)
      return res
        .status(400)
        .json({ error: 'OAuth session has expired, please generate a new authorization URL' })
    }

    // 统一Procesar授权码输入（可能是直接的code或完整的回调URL）
    let finalAuthCode
    const inputValue = callbackUrl || authorizationCode

    try {
      finalAuthCode = oauthHelper.parseCallbackUrl(inputValue)
    } catch (parseError) {
      return res
        .status(400)
        .json({ error: 'Failed to parse authorization input', message: parseError.message })
    }

    // 交换Setup Token
    const tokenData = await oauthHelper.exchangeSetupTokenCode(
      finalAuthCode,
      oauthSession.codeVerifier,
      oauthSession.state,
      oauthSession.proxy // 传递ProxyConfiguración
    )

    // LimpiarOAuthSesión
    await redis.deleteOAuthSession(sessionId)

    logger.success('🎉 Successfully exchanged setup token authorization code for tokens')
    return res.json({
      success: true,
      data: {
        claudeAiOauth: tokenData
      }
    })
  } catch (error) {
    logger.error('❌ Failed to exchange setup token authorization code:', {
      error: error.message,
      sessionId: req.body.sessionId,
      // 不Registro完整的授权码，只Registro长度和前几个字符
      codeLength: req.body.callbackUrl
        ? req.body.callbackUrl.length
        : req.body.authorizationCode
          ? req.body.authorizationCode.length
          : 0,
      codePrefix: req.body.callbackUrl
        ? `${req.body.callbackUrl.substring(0, 10)}...`
        : req.body.authorizationCode
          ? `${req.body.authorizationCode.substring(0, 10)}...`
          : 'N/A'
    })
    return res
      .status(500)
      .json({ error: 'Failed to exchange setup token authorization code', message: error.message })
  }
})

// =============================================================================
// Cookie自动授权Endpoint (基于sessionKey自动CompletadoOAuth流程)
// =============================================================================

// 普通OAuth的Cookie自动授权
router.post('/claude-accounts/oauth-with-cookie', authenticateAdmin, async (req, res) => {
  try {
    const { sessionKey, proxy } = req.body

    // ValidarsessionKeyParámetro
    if (!sessionKey || typeof sessionKey !== 'string' || sessionKey.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sessionKey不能为空',
        message: 'Proporcione un valor de sessionKey válido'
      })
    }

    const trimmedSessionKey = sessionKey.trim()

    logger.info('🍪 Starting Cookie-based OAuth authorization', {
      sessionKeyLength: trimmedSessionKey.length,
      sessionKeyPrefix: `${trimmedSessionKey.substring(0, 10)}...`,
      hasProxy: !!proxy
    })

    // EjecutarCookie自动授权流程
    const result = await oauthHelper.oauthWithCookie(trimmedSessionKey, proxy, false)

    logger.success('🎉 Cookie-based OAuth authorization completed successfully')

    return res.json({
      success: true,
      data: {
        claudeAiOauth: result.claudeAiOauth,
        organizationUuid: result.organizationUuid,
        capabilities: result.capabilities
      }
    })
  } catch (error) {
    logger.error('❌ Cookie-based OAuth authorization failed:', {
      error: error.message,
      sessionKeyLength: req.body.sessionKey ? req.body.sessionKey.length : 0
    })

    return res.status(500).json({
      success: false,
      error: 'Cookie授权Falló',
      message: error.message
    })
  }
})

// Setup Token的Cookie自动授权
router.post('/claude-accounts/setup-token-with-cookie', authenticateAdmin, async (req, res) => {
  try {
    const { sessionKey, proxy } = req.body

    // ValidarsessionKeyParámetro
    if (!sessionKey || typeof sessionKey !== 'string' || sessionKey.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sessionKey不能为空',
        message: 'Proporcione un valor de sessionKey válido'
      })
    }

    const trimmedSessionKey = sessionKey.trim()

    logger.info('🍪 Starting Cookie-based Setup Token authorization', {
      sessionKeyLength: trimmedSessionKey.length,
      sessionKeyPrefix: `${trimmedSessionKey.substring(0, 10)}...`,
      hasProxy: !!proxy
    })

    // EjecutarCookie自动授权流程（Setup Token模式）
    const result = await oauthHelper.oauthWithCookie(trimmedSessionKey, proxy, true)

    logger.success('🎉 Cookie-based Setup Token authorization completed successfully')

    return res.json({
      success: true,
      data: {
        claudeAiOauth: result.claudeAiOauth,
        organizationUuid: result.organizationUuid,
        capabilities: result.capabilities
      }
    })
  } catch (error) {
    logger.error('❌ Cookie-based Setup Token authorization failed:', {
      error: error.message,
      sessionKeyLength: req.body.sessionKey ? req.body.sessionKey.length : 0
    })

    return res.status(500).json({
      success: false,
      error: 'Cookie授权Falló',
      message: error.message
    })
  }
})

// Obtener所有ClaudeCuenta
router.get('/claude-accounts', authenticateAdmin, async (req, res) => {
  try {
    const { platform, groupId } = req.query
    let accounts = await claudeAccountService.getAllAccounts()

    // 根据ConsultaParámetro进Fila筛选
    if (platform && platform !== 'all' && platform !== 'claude') {
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

          // ObtenerSesión窗口使用Estadística（仅对有活跃窗口的Cuenta）
          let sessionWindowUsage = null
          if (account.sessionWindow && account.sessionWindow.hasActiveWindow) {
            const windowUsage = await redis.getAccountSessionWindowUsage(
              account.id,
              account.sessionWindow.windowStart,
              account.sessionWindow.windowEnd
            )

            // CalcularSesión窗口的总费用
            let totalCost = 0
            const modelCosts = {}

            for (const [modelName, usage] of Object.entries(windowUsage.modelUsage)) {
              const usageData = {
                input_tokens: usage.inputTokens,
                output_tokens: usage.outputTokens,
                cache_creation_input_tokens: usage.cacheCreateTokens,
                cache_read_input_tokens: usage.cacheReadTokens
              }

              logger.debug(`💰 Calculating cost for model ${modelName}:`, JSON.stringify(usageData))
              const costResult = CostCalculator.calculateCost(usageData, modelName)
              logger.debug(`💰 Cost result for ${modelName}: total=${costResult.costs.total}`)

              modelCosts[modelName] = {
                ...usage,
                cost: costResult.costs.total
              }
              totalCost += costResult.costs.total
            }

            sessionWindowUsage = {
              totalTokens: windowUsage.totalAllTokens,
              totalRequests: windowUsage.totalRequests,
              totalCost,
              modelUsage: modelCosts
            }
          }

          const formattedAccount = formatAccountExpiry(account)
          return {
            ...formattedAccount,
            // Convertirschedulable为布尔Valor
            schedulable: account.schedulable === 'true' || account.schedulable === true,
            groupInfos,
            usage: {
              daily: usageStats.daily,
              total: usageStats.total,
              averages: usageStats.averages,
              sessionWindow: sessionWindowUsage
            }
          }
        } catch (statsError) {
          logger.warn(`⚠️ Failed to get usage stats for account ${account.id}:`, statsError.message)
          // 如果ObtenerEstadísticaFalló，Retornar空Estadística
          try {
            const groupInfos = await accountGroupService.getAccountGroups(account.id)
            const formattedAccount = formatAccountExpiry(account)
            return {
              ...formattedAccount,
              groupInfos,
              usage: {
                daily: { tokens: 0, requests: 0, allTokens: 0 },
                total: { tokens: 0, requests: 0, allTokens: 0 },
                averages: { rpm: 0, tpm: 0 },
                sessionWindow: null
              }
            }
          } catch (groupError) {
            logger.warn(
              `⚠️ Failed to get group info for account ${account.id}:`,
              groupError.message
            )
            const formattedAccount = formatAccountExpiry(account)
            return {
              ...formattedAccount,
              groupInfos: [],
              usage: {
                daily: { tokens: 0, requests: 0, allTokens: 0 },
                total: { tokens: 0, requests: 0, allTokens: 0 },
                averages: { rpm: 0, tpm: 0 },
                sessionWindow: null
              }
            }
          }
        }
      })
    )

    return res.json({ success: true, data: accountsWithStats })
  } catch (error) {
    logger.error('❌ Failed to get Claude accounts:', error)
    return res.status(500).json({ error: 'Failed to get Claude accounts', message: error.message })
  }
})

// 批量Obtener Claude Cuenta的 OAuth Usage Datos
router.get('/claude-accounts/usage', authenticateAdmin, async (req, res) => {
  try {
    const accounts = await redis.getAllClaudeAccounts()
    const now = Date.now()
    const usageCacheTtlMs = 300 * 1000

    // 批量ConcurrenciaObtener所有活跃 OAuth Cuenta的 Usage
    const usagePromises = accounts.map(async (account) => {
      // Verificar是否为 OAuth Cuenta：scopes Incluir OAuth 相关Permiso
      const scopes = account.scopes && account.scopes.trim() ? account.scopes.split(' ') : []
      const isOAuth = scopes.includes('user:profile') && scopes.includes('user:inference')

      // 仅为 OAuth 授权的活跃Cuenta调用 usage API
      if (
        isOAuth &&
        account.isActive === 'true' &&
        account.accessToken &&
        account.status === 'active'
      ) {
        // 若快照在 300 秒内Actualizar，直接使用Caché避免频繁Solicitud
        const cachedUsage = claudeAccountService.buildClaudeUsageSnapshot(account)
        const lastUpdatedAt = account.claudeUsageUpdatedAt
          ? new Date(account.claudeUsageUpdatedAt).getTime()
          : 0
        const isCacheFresh = cachedUsage && lastUpdatedAt && now - lastUpdatedAt < usageCacheTtlMs
        if (isCacheFresh) {
          return {
            accountId: account.id,
            claudeUsage: cachedUsage
          }
        }

        try {
          const usageData = await claudeAccountService.fetchOAuthUsage(account.id)
          if (usageData) {
            await claudeAccountService.updateClaudeUsageSnapshot(account.id, usageData)
          }
          // 重新LeerActualizar后的Datos
          const updatedAccount = await redis.getClaudeAccount(account.id)
          return {
            accountId: account.id,
            claudeUsage: claudeAccountService.buildClaudeUsageSnapshot(updatedAccount)
          }
        } catch (error) {
          logger.debug(`Failed to fetch OAuth usage for ${account.id}:`, error.message)
          return { accountId: account.id, claudeUsage: null }
        }
      }
      // Setup Token Cuenta不调用 usage API，直接Retornar null
      return { accountId: account.id, claudeUsage: null }
    })

    const results = await Promise.allSettled(usagePromises)

    // Convertir为 { accountId: usage } 映射
    const usageMap = {}
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        usageMap[result.value.accountId] = result.value.claudeUsage
      }
    })

    res.json({ success: true, data: usageMap })
  } catch (error) {
    logger.error('❌ Failed to fetch Claude accounts usage:', error)
    res.status(500).json({ error: 'Failed to fetch usage data', message: error.message })
  }
})

// Crear新的ClaudeCuenta
router.post('/claude-accounts', authenticateAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      email,
      password,
      refreshToken,
      claudeAiOauth,
      proxy,
      accountType,
      platform = 'claude',
      priority,
      groupId,
      groupIds,
      autoStopOnWarning,
      useUnifiedUserAgent,
      useUnifiedClientId,
      unifiedClientId,
      expiresAt,
      extInfo,
      maxConcurrency,
      interceptWarmup
    } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    // ValidaraccountType的有效性
    if (accountType && !['shared', 'dedicated', 'group'].includes(accountType)) {
      return res
        .status(400)
        .json({ error: 'Invalid account type. Must be "shared", "dedicated" or "group"' })
    }

    // 如果是AgruparTipo，ValidargroupId或groupIds
    if (accountType === 'group' && !groupId && (!groupIds || groupIds.length === 0)) {
      return res
        .status(400)
        .json({ error: 'Group ID or Group IDs are required for group type accounts' })
    }

    // Validarpriority的有效性
    if (
      priority !== undefined &&
      (typeof priority !== 'number' || priority < 1 || priority > 100)
    ) {
      return res.status(400).json({ error: 'Priority must be a number between 1 and 100' })
    }

    const newAccount = await claudeAccountService.createAccount({
      name,
      description,
      email,
      password,
      refreshToken,
      claudeAiOauth,
      proxy,
      accountType: accountType || 'shared', // Predeterminado为共享Tipo
      platform,
      priority: priority || 50, // Predeterminado优先级为50
      autoStopOnWarning: autoStopOnWarning === true, // Predeterminado为false
      useUnifiedUserAgent: useUnifiedUserAgent === true, // Predeterminado为false
      useUnifiedClientId: useUnifiedClientId === true, // Predeterminado为false
      unifiedClientId: unifiedClientId || '', // 统一的Cliente标识
      expiresAt: expiresAt || null, // Cuenta订阅到期Tiempo
      extInfo: extInfo || null,
      maxConcurrency: maxConcurrency || 0, // Cuenta级串FilaCola：0=使用全局Configuración，>0=强制Habilitar
      interceptWarmup: interceptWarmup === true // 拦截预热Solicitud：Predeterminado为false
    })

    // 如果是AgruparTipo，将Cuenta添加到Agrupar
    if (accountType === 'group') {
      if (groupIds && groupIds.length > 0) {
        // 使用多AgruparEstablecer
        await accountGroupService.setAccountGroups(newAccount.id, groupIds, newAccount.platform)
      } else if (groupId) {
        // 兼容单Agrupar模式
        await accountGroupService.addAccountToGroup(newAccount.id, groupId, newAccount.platform)
      }
    }

    logger.success(`🏢 Admin created new Claude account: ${name} (${accountType || 'shared'})`)
    const formattedAccount = formatAccountExpiry(newAccount)
    return res.json({ success: true, data: formattedAccount })
  } catch (error) {
    logger.error('❌ Failed to create Claude account:', error)
    return res
      .status(500)
      .json({ error: 'Failed to create Claude account', message: error.message })
  }
})

// ActualizarClaudeCuenta
router.put('/claude-accounts/:accountId', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params
    const updates = req.body

    // ✅ 【修改】映射Campo名：前端的 expiresAt -> 后端的 subscriptionExpiresAt（提前到ParámetroValidar之前）
    const mappedUpdates = mapExpiryField(updates, 'Claude', accountId)

    // Validarpriority的有效性
    if (
      mappedUpdates.priority !== undefined &&
      (typeof mappedUpdates.priority !== 'number' ||
        mappedUpdates.priority < 1 ||
        mappedUpdates.priority > 100)
    ) {
      return res.status(400).json({ error: 'Priority must be a number between 1 and 100' })
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

    // 如果Actualizar为AgruparTipo，ValidargroupId或groupIds
    if (
      mappedUpdates.accountType === 'group' &&
      !mappedUpdates.groupId &&
      (!mappedUpdates.groupIds || mappedUpdates.groupIds.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: 'Group ID or Group IDs are required for group type accounts' })
    }

    // ObtenerCuenta当前Información以ProcesarAgrupar变更
    const currentAccount = await claudeAccountService.getAccount(accountId)
    if (!currentAccount) {
      return res.status(404).json({ error: 'Account not found' })
    }

    // ProcesarAgrupar的变更
    if (mappedUpdates.accountType !== undefined) {
      // 如果之前是AgruparTipo，需要从所有Agrupar中Eliminación
      if (currentAccount.accountType === 'group') {
        await accountGroupService.removeAccountFromAllGroups(accountId)
      }

      // 如果新Tipo是Agrupar，添加到新Agrupar
      if (mappedUpdates.accountType === 'group') {
        // Procesar多Agrupar/单Agrupar的兼容性
        if (Object.prototype.hasOwnProperty.call(mappedUpdates, 'groupIds')) {
          if (mappedUpdates.groupIds && mappedUpdates.groupIds.length > 0) {
            // 使用多AgruparEstablecer
            await accountGroupService.setAccountGroups(accountId, mappedUpdates.groupIds, 'claude')
          } else {
            // groupIds 为空Arreglo，从所有Agrupar中Eliminación
            await accountGroupService.removeAccountFromAllGroups(accountId)
          }
        } else if (mappedUpdates.groupId) {
          // 兼容单Agrupar模式
          await accountGroupService.addAccountToGroup(accountId, mappedUpdates.groupId, 'claude')
        }
      }
    }

    await claudeAccountService.updateAccount(accountId, mappedUpdates)

    logger.success(`📝 Admin updated Claude account: ${accountId}`)
    return res.json({ success: true, message: 'Claude account updated successfully' })
  } catch (error) {
    logger.error('❌ Failed to update Claude account:', error)
    return res
      .status(500)
      .json({ error: 'Failed to update Claude account', message: error.message })
  }
})

// EliminarClaudeCuenta
router.delete('/claude-accounts/:accountId', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    // 自动解绑所有绑定的 API Keys
    const unboundCount = await apiKeyService.unbindAccountFromAllKeys(accountId, 'claude')

    // ObtenerCuentaInformación以Verificar是否在Agrupar中
    const account = await claudeAccountService.getAccount(accountId)
    if (account && account.accountType === 'group') {
      const groups = await accountGroupService.getAccountGroups(accountId)
      for (const group of groups) {
        await accountGroupService.removeAccountFromGroup(accountId, group.id)
      }
    }

    await claudeAccountService.deleteAccount(accountId)

    let message = 'Claude账号已ÉxitoEliminar'
    if (unboundCount > 0) {
      message += `，${unboundCount} 个 API Key ha cambiado al modo de piscina compartida`
    }

    logger.success(`🗑️ Admin deleted Claude account: ${accountId}, unbound ${unboundCount} keys`)
    return res.json({
      success: true,
      message,
      unboundKeys: unboundCount
    })
  } catch (error) {
    logger.error('❌ Failed to delete Claude account:', error)
    return res
      .status(500)
      .json({ error: 'Failed to delete Claude account', message: error.message })
  }
})

// Actualizar单个ClaudeCuenta的ProfileInformación
router.post('/claude-accounts/:accountId/update-profile', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    const profileInfo = await claudeAccountService.fetchAndUpdateAccountProfile(accountId)

    logger.success(`Updated profile for Claude account: ${accountId}`)
    return res.json({
      success: true,
      message: 'Account profile updated successfully',
      data: profileInfo
    })
  } catch (error) {
    logger.error('❌ Failed to update account profile:', error)
    return res
      .status(500)
      .json({ error: 'Failed to update account profile', message: error.message })
  }
})

// 批量Actualizar所有ClaudeCuenta的ProfileInformación
router.post('/claude-accounts/update-all-profiles', authenticateAdmin, async (req, res) => {
  try {
    const result = await claudeAccountService.updateAllAccountProfiles()

    logger.success('Batch profile update completed')
    return res.json({
      success: true,
      message: 'Batch profile update completed',
      data: result
    })
  } catch (error) {
    logger.error('❌ Failed to update all account profiles:', error)
    return res
      .status(500)
      .json({ error: 'Failed to update all account profiles', message: error.message })
  }
})

// 刷新ClaudeCuentatoken
router.post('/claude-accounts/:accountId/refresh', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    const result = await claudeAccountService.refreshAccountToken(accountId)

    logger.success(`🔄 Admin refreshed token for Claude account: ${accountId}`)
    return res.json({ success: true, data: result })
  } catch (error) {
    logger.error('❌ Failed to refresh Claude account token:', error)
    return res.status(500).json({ error: 'Failed to refresh token', message: error.message })
  }
})

// 重置ClaudeCuenta状态（清除所有异常状态）
router.post('/claude-accounts/:accountId/reset-status', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    const result = await claudeAccountService.resetAccountStatus(accountId)

    logger.success(`Admin reset status for Claude account: ${accountId}`)
    return res.json({ success: true, data: result })
  } catch (error) {
    logger.error('❌ Failed to reset Claude account status:', error)
    return res.status(500).json({ error: 'Failed to reset status', message: error.message })
  }
})

// 切换ClaudeCuenta调度状态
router.put(
  '/claude-accounts/:accountId/toggle-schedulable',
  authenticateAdmin,
  async (req, res) => {
    try {
      const { accountId } = req.params

      const accounts = await claudeAccountService.getAllAccounts()
      const account = accounts.find((acc) => acc.id === accountId)

      if (!account) {
        return res.status(404).json({ error: 'Account not found' })
      }

      const newSchedulable = !account.schedulable
      await claudeAccountService.updateAccount(accountId, { schedulable: newSchedulable })

      // 如果账号被Deshabilitar，发送webhook通知
      if (!newSchedulable) {
        await webhookNotifier.sendAccountAnomalyNotification({
          accountId: account.id,
          accountName: account.name || account.claudeAiOauth?.email || 'Claude Account',
          platform: 'claude-oauth',
          status: 'disabled',
          errorCode: 'CLAUDE_OAUTH_MANUALLY_DISABLED',
          reason: '账号已被管理员手动Deshabilitar调度',
          timestamp: new Date().toISOString()
        })
      }

      logger.success(
        `🔄 Admin toggled Claude account schedulable status: ${accountId} -> ${
          newSchedulable ? 'schedulable' : 'not schedulable'
        }`
      )
      return res.json({ success: true, schedulable: newSchedulable })
    } catch (error) {
      logger.error('❌ Failed to toggle Claude account schedulable status:', error)
      return res
        .status(500)
        .json({ error: 'Failed to toggle schedulable status', message: error.message })
    }
  }
)

// ProbarClaude OAuthCuenta连通性（流式Respuesta）- 复用 claudeRelayService
router.post('/claude-accounts/:accountId/test', authenticateAdmin, async (req, res) => {
  const { accountId } = req.params

  try {
    // 直接调用Servicio层的ProbarMétodo
    await claudeRelayService.testAccountConnection(accountId, res)
  } catch (error) {
    logger.error(`❌ Failed to test Claude OAuth account:`, error)
    // Error已在Servicio层Procesar，这里仅做RegistroRegistro
  }
})

// ============================================================================
// Cuenta定时Probar相关Endpoint
// ============================================================================

// ObtenerCuentaProbar历史
router.get('/claude-accounts/:accountId/test-history', authenticateAdmin, async (req, res) => {
  const { accountId } = req.params

  try {
    const history = await redis.getAccountTestHistory(accountId, 'claude')
    return res.json({
      success: true,
      data: {
        accountId,
        platform: 'claude',
        history
      }
    })
  } catch (error) {
    logger.error(`❌ Failed to get test history for account ${accountId}:`, error)
    return res.status(500).json({
      error: 'Failed to get test history',
      message: error.message
    })
  }
})

// ObtenerCuenta定时ProbarConfiguración
router.get('/claude-accounts/:accountId/test-config', authenticateAdmin, async (req, res) => {
  const { accountId } = req.params

  try {
    const testConfig = await redis.getAccountTestConfig(accountId, 'claude')
    return res.json({
      success: true,
      data: {
        accountId,
        platform: 'claude',
        config: testConfig || {
          enabled: false,
          cronExpression: '0 8 * * *',
          model: 'claude-sonnet-4-5-20250929'
        }
      }
    })
  } catch (error) {
    logger.error(`❌ Failed to get test config for account ${accountId}:`, error)
    return res.status(500).json({
      error: 'Failed to get test config',
      message: error.message
    })
  }
})

// EstablecerCuenta定时ProbarConfiguración
router.put('/claude-accounts/:accountId/test-config', authenticateAdmin, async (req, res) => {
  const { accountId } = req.params
  const { enabled, cronExpression, model } = req.body

  try {
    // Validar enabled Parámetro
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: 'enabled must be a boolean'
      })
    }

    // Validar cronExpression Parámetro
    if (!cronExpression || typeof cronExpression !== 'string') {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: 'cronExpression is required and must be a string'
      })
    }

    // Límite cronExpression 长度防止 DoS
    const MAX_CRON_LENGTH = 100
    if (cronExpression.length > MAX_CRON_LENGTH) {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: `cronExpression too long (max ${MAX_CRON_LENGTH} characters)`
      })
    }

    // 使用 service 的MétodoValidar cron Tabla达式
    if (!accountTestSchedulerService.validateCronExpression(cronExpression)) {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: `Invalid cron expression: ${cronExpression}. Format: "minute hour day month weekday" (e.g., "0 8 * * *" for daily at 8:00)`
      })
    }

    // Validar模型Parámetro
    const testModel = model || 'claude-sonnet-4-5-20250929'
    if (typeof testModel !== 'string' || testModel.length > 256) {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: 'model must be a valid string (max 256 characters)'
      })
    }

    // VerificarCuenta是否存在
    const account = await claudeAccountService.getAccount(accountId)
    if (!account) {
      return res.status(404).json({
        error: 'Account not found',
        message: `Claude account ${accountId} not found`
      })
    }

    // 保存Configuración
    await redis.saveAccountTestConfig(accountId, 'claude', {
      enabled,
      cronExpression,
      model: testModel
    })

    logger.success(
      `📝 Updated test config for Claude account ${accountId}: enabled=${enabled}, cronExpression=${cronExpression}, model=${testModel}`
    )

    return res.json({
      success: true,
      message: 'Test config updated successfully',
      data: {
        accountId,
        platform: 'claude',
        config: { enabled, cronExpression, model: testModel }
      }
    })
  } catch (error) {
    logger.error(`❌ Failed to update test config for account ${accountId}:`, error)
    return res.status(500).json({
      error: 'Failed to update test config',
      message: error.message
    })
  }
})

// 手动触发CuentaProbar（非流式，RetornarJSON结果）
router.post('/claude-accounts/:accountId/test-sync', authenticateAdmin, async (req, res) => {
  const { accountId } = req.params

  try {
    // VerificarCuenta是否存在
    const account = await claudeAccountService.getAccount(accountId)
    if (!account) {
      return res.status(404).json({
        error: 'Account not found',
        message: `Claude account ${accountId} not found`
      })
    }

    logger.info(`🧪 Manual sync test triggered for Claude account: ${accountId}`)

    // EjecutarProbar
    const testResult = await claudeRelayService.testAccountConnectionSync(accountId)

    // 保存Probar结果到历史
    await redis.saveAccountTestResult(accountId, 'claude', testResult)
    await redis.setAccountLastTestTime(accountId, 'claude')

    return res.json({
      success: true,
      data: {
        accountId,
        platform: 'claude',
        result: testResult
      }
    })
  } catch (error) {
    logger.error(`❌ Failed to run sync test for account ${accountId}:`, error)
    return res.status(500).json({
      error: 'Failed to run test',
      message: error.message
    })
  }
})

// 批量Obtener多个Cuenta的Probar历史
router.post('/claude-accounts/batch-test-history', authenticateAdmin, async (req, res) => {
  const { accountIds } = req.body

  try {
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: 'accountIds must be a non-empty array'
      })
    }

    // Límite批量Consulta数量
    const limitedIds = accountIds.slice(0, 100)

    const accounts = limitedIds.map((accountId) => ({
      accountId,
      platform: 'claude'
    }))

    const historyMap = await redis.getAccountsTestHistory(accounts)

    return res.json({
      success: true,
      data: historyMap
    })
  } catch (error) {
    logger.error('❌ Failed to get batch test history:', error)
    return res.status(500).json({
      error: 'Failed to get batch test history',
      message: error.message
    })
  }
})

module.exports = router
