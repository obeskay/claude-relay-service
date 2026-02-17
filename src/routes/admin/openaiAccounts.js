/**
 * Admin Routes - OpenAI Cuenta管理
 * Procesar OpenAI Cuenta的 CRUD Operación和 OAuth 授权流程
 */

const express = require('express')
const crypto = require('crypto')
const axios = require('axios')
const openaiAccountService = require('../../services/account/openaiAccountService')
const accountGroupService = require('../../services/accountGroupService')
const apiKeyService = require('../../services/apiKeyService')
const redis = require('../../models/redis')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const ProxyHelper = require('../../utils/proxyHelper')
const webhookNotifier = require('../../utils/webhookNotifier')
const { formatAccountExpiry, mapExpiryField } = require('./utils')

const router = express.Router()

// OpenAI OAuth Configuración
const OPENAI_CONFIG = {
  BASE_URL: 'https://auth.openai.com',
  CLIENT_ID: 'app_EMoamEEZ73f0CkXaXp7hrann',
  REDIRECT_URI: 'http://localhost:1455/auth/callback',
  SCOPE: 'openid profile email offline_access'
}

/**
 * Generar PKCE Parámetro
 * @returns {Object} Incluir codeVerifier 和 codeChallenge 的Objeto
 */
function generateOpenAIPKCE() {
  const codeVerifier = crypto.randomBytes(64).toString('hex')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

  return {
    codeVerifier,
    codeChallenge
  }
}

// Generar OpenAI OAuth 授权 URL
router.post('/generate-auth-url', authenticateAdmin, async (req, res) => {
  try {
    const { proxy } = req.body

    // Generar PKCE Parámetro
    const pkce = generateOpenAIPKCE()

    // Generar随机 state
    const state = crypto.randomBytes(32).toString('hex')

    // CrearSesión ID
    const sessionId = crypto.randomUUID()

    // 将 PKCE Parámetro和ProxyConfiguración存储到 Redis
    await redis.setOAuthSession(sessionId, {
      codeVerifier: pkce.codeVerifier,
      codeChallenge: pkce.codeChallenge,
      state,
      proxy: proxy || null,
      platform: 'openai',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    })

    // Construir授权 URL Parámetro
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: OPENAI_CONFIG.CLIENT_ID,
      redirect_uri: OPENAI_CONFIG.REDIRECT_URI,
      scope: OPENAI_CONFIG.SCOPE,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
      state,
      id_token_add_organizations: 'true',
      codex_cli_simplified_flow: 'true'
    })

    const authUrl = `${OPENAI_CONFIG.BASE_URL}/oauth/authorize?${params.toString()}`

    logger.success('Generated OpenAI OAuth authorization URL')

    return res.json({
      success: true,
      data: {
        authUrl,
        sessionId,
        instructions: [
          '1. 复制上面的链接到Navegador中打开',
          '2. 登录您的 OpenAI Cuenta',
          '3. 同意应用Permiso',
          '4. 复制Navegador地址栏中的完整 URL（Incluir code Parámetro）',
          '5. 在添加CuentaTabla单中粘贴完整的回调 URL'
        ]
      }
    })
  } catch (error) {
    logger.error('Generar OpenAI OAuth URL Falló:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al generar el enlace de autorización',
      error: error.message
    })
  }
})

// 交换 OpenAI 授权码
router.post('/exchange-code', authenticateAdmin, async (req, res) => {
  try {
    const { code, sessionId } = req.body

    if (!code || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Faltan parámetros necesarios'
      })
    }

    // 从 Redis ObtenerSesiónDatos
    const sessionData = await redis.getOAuthSession(sessionId)
    if (!sessionData) {
      return res.status(400).json({
        success: false,
        message: 'Session expired or invalid'
      })
    }

    // 准备 token 交换Solicitud
    const tokenData = {
      grant_type: 'authorization_code',
      code: code.trim(),
      redirect_uri: OPENAI_CONFIG.REDIRECT_URI,
      client_id: OPENAI_CONFIG.CLIENT_ID,
      code_verifier: sessionData.codeVerifier
    }

    logger.info('Exchanging OpenAI authorization code:', {
      sessionId,
      codeLength: code.length,
      hasCodeVerifier: !!sessionData.codeVerifier
    })

    // ConfiguraciónProxy（如果有）
    const axiosConfig = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }

    // ConfiguraciónProxy（如果有）
    const proxyAgent = ProxyHelper.createProxyAgent(sessionData.proxy)
    if (proxyAgent) {
      axiosConfig.httpAgent = proxyAgent
      axiosConfig.httpsAgent = proxyAgent
      axiosConfig.proxy = false
    }

    // 交换 authorization code Obtener tokens
    const tokenResponse = await axios.post(
      `${OPENAI_CONFIG.BASE_URL}/oauth/token`,
      new URLSearchParams(tokenData).toString(),
      axiosConfig
    )

    const { id_token, access_token, refresh_token, expires_in } = tokenResponse.data

    // Analizar ID token ObtenerUsuarioInformación
    const idTokenParts = id_token.split('.')
    if (idTokenParts.length !== 3) {
      throw new Error('Invalid ID token format')
    }

    // Decodificación JWT payload
    const payload = JSON.parse(Buffer.from(idTokenParts[1], 'base64url').toString())

    // Obtener OpenAI 特定的声明
    const authClaims = payload['https://api.openai.com/auth'] || {}
    const accountId = authClaims.chatgpt_account_id || ''
    const chatgptUserId = authClaims.chatgpt_user_id || authClaims.user_id || ''
    const planType = authClaims.chatgpt_plan_type || ''

    // Obtener组织Información
    const organizations = authClaims.organizations || []
    const defaultOrg = organizations.find((org) => org.is_default) || organizations[0] || {}
    const organizationId = defaultOrg.id || ''
    const organizationRole = defaultOrg.role || ''
    const organizationTitle = defaultOrg.title || ''

    // Limpiar Redis Sesión
    await redis.deleteOAuthSession(sessionId)

    logger.success('OpenAI OAuth token exchange successful')

    return res.json({
      success: true,
      data: {
        tokens: {
          idToken: id_token,
          accessToken: access_token,
          refreshToken: refresh_token,
          expires_in
        },
        accountInfo: {
          accountId,
          chatgptUserId,
          organizationId,
          organizationRole,
          organizationTitle,
          planType,
          email: payload.email || '',
          name: payload.name || '',
          emailVerified: payload.email_verified || false,
          organizations
        }
      }
    })
  } catch (error) {
    logger.error('OpenAI OAuth token exchange failed:', error)
    return res.status(500).json({
      success: false,
      message: '交换授权码Falló',
      error: error.message
    })
  }
})

// Obtener所有 OpenAI Cuenta
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { platform, groupId } = req.query
    let accounts = await openaiAccountService.getAllAccounts()

    // CachéCuenta所属Agrupar，避免重复Consulta
    const accountGroupCache = new Map()
    const fetchAccountGroups = async (accountId) => {
      if (!accountGroupCache.has(accountId)) {
        const groups = await accountGroupService.getAccountGroups(accountId)
        accountGroupCache.set(accountId, groups || [])
      }
      return accountGroupCache.get(accountId)
    }

    // 根据ConsultaParámetro进Fila筛选
    if (platform && platform !== 'all' && platform !== 'openai') {
      // 如果指定了其他平台，Retornar空Arreglo
      accounts = []
    }

    // 如果指定了Agrupar筛选
    if (groupId && groupId !== 'all') {
      if (groupId === 'ungrouped') {
        // 筛选未AgruparCuenta
        const filteredAccounts = []
        for (const account of accounts) {
          const groups = await fetchAccountGroups(account.id)
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
          const groupInfos = await fetchAccountGroups(account.id)
          const formattedAccount = formatAccountExpiry(account)
          return {
            ...formattedAccount,
            groupInfos,
            usage: {
              daily: usageStats.daily,
              total: usageStats.total,
              monthly: usageStats.monthly
            }
          }
        } catch (error) {
          logger.debug(`Failed to get usage stats for OpenAI account ${account.id}:`, error)
          const groupInfos = await fetchAccountGroups(account.id)
          const formattedAccount = formatAccountExpiry(account)
          return {
            ...formattedAccount,
            groupInfos,
            usage: {
              daily: { requests: 0, tokens: 0, allTokens: 0 },
              total: { requests: 0, tokens: 0, allTokens: 0 },
              monthly: { requests: 0, tokens: 0, allTokens: 0 }
            }
          }
        }
      })
    )

    logger.info(`Obtener OpenAI CuentaColumnaTabla: ${accountsWithStats.length} 个Cuenta`)

    return res.json({
      success: true,
      data: accountsWithStats
    })
  } catch (error) {
    logger.error('Obtener OpenAI CuentaColumnaTablaFalló:', error)
    return res.status(500).json({
      success: false,
      message: 'ObtenerCuentaColumnaTablaFalló',
      error: error.message
    })
  }
})

// Crear OpenAI Cuenta
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      openaiOauth,
      accountInfo,
      proxy,
      accountType,
      groupId,
      groupIds, // Soportar多Agrupar
      rateLimitDuration,
      priority,
      needsImmediateRefresh, // 是否需要立即刷新
      requireRefreshSuccess // 是否必须刷新Éxito才能Crear
    } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la cuenta no puede estar vacío'
      })
    }

    // 准备CuentaDatos
    const accountData = {
      name,
      description: description || '',
      accountType: accountType || 'shared',
      priority: priority || 50,
      rateLimitDuration:
        rateLimitDuration !== undefined && rateLimitDuration !== null ? rateLimitDuration : 60,
      openaiOauth: openaiOauth || {},
      accountInfo: accountInfo || {},
      proxy: proxy || null,
      isActive: true,
      schedulable: true
    }

    // 如果需要立即刷新且必须Éxito（OpenAI 手动模式）
    if (needsImmediateRefresh && requireRefreshSuccess) {
      // 先Crear临时Cuenta以Probar刷新
      const tempAccount = await openaiAccountService.createAccount(accountData)

      try {
        logger.info(`🔄 Probar刷新 OpenAI Cuenta以Obtener完整 token Información`)

        // 尝试刷新 token（会自动使用CuentaConfiguración的Proxy）
        await openaiAccountService.refreshAccountToken(tempAccount.id)

        // 刷新Éxito，ObtenerActualizar后的CuentaInformación
        const refreshedAccount = await openaiAccountService.getAccount(tempAccount.id)

        // Verificar是否Obtener到了 ID Token
        if (!refreshedAccount.idToken || refreshedAccount.idToken === '') {
          // 没有Obtener到 ID Token，EliminarCuenta
          await openaiAccountService.deleteAccount(tempAccount.id)
          throw new Error('无法Obtener ID Token，请Verificar Refresh Token 是否有效')
        }

        // 如果是AgruparTipo，添加到Agrupar（Soportar多Agrupar）
        if (accountType === 'group') {
          if (groupIds && groupIds.length > 0) {
            await accountGroupService.setAccountGroups(tempAccount.id, groupIds, 'openai')
          } else if (groupId) {
            await accountGroupService.addAccountToGroup(tempAccount.id, groupId, 'openai')
          }
        }

        // 清除敏感Información后Retornar
        delete refreshedAccount.idToken
        delete refreshedAccount.accessToken
        delete refreshedAccount.refreshToken

        logger.success(`Crear并Validar OpenAI CuentaÉxito: ${name} (ID: ${tempAccount.id})`)

        return res.json({
          success: true,
          data: refreshedAccount,
          message: 'Cuenta creada con éxito y se ha obtenido la información completa del token'
        })
      } catch (refreshError) {
        // 刷新Falló，Eliminar临时Crear的Cuenta
        logger.warn(`❌ 刷新Falló，Eliminar临时Cuenta: ${refreshError.message}`)
        await openaiAccountService.deleteAccount(tempAccount.id)

        // Construir详细的ErrorInformación
        const errorResponse = {
          success: false,
          message: 'Error al crear la cuenta',
          error: refreshError.message
        }

        // 添加更详细的ErrorInformación
        if (refreshError.status) {
          errorResponse.errorCode = refreshError.status
        }
        if (refreshError.details) {
          errorResponse.errorDetails = refreshError.details
        }
        if (refreshError.code) {
          errorResponse.networkError = refreshError.code
        }

        // 提供更友好的Error提示
        if (refreshError.message.includes('Refresh Token 无效')) {
          errorResponse.suggestion = '请Verificar Refresh Token 是否正确，或重新通过 OAuth 授权Obtener'
        } else if (refreshError.message.includes('Proxy')) {
          errorResponse.suggestion = '请VerificarProxyConfiguración是否正确，包括地址、端口和认证Información'
        } else if (refreshError.message.includes('过于频繁')) {
          errorResponse.suggestion = '请稍后再试，或更换Proxy IP'
        } else if (refreshError.message.includes('Conexión')) {
          errorResponse.suggestion = '请Verificar网络Conexión和ProxyEstablecer'
        }

        return res.status(400).json(errorResponse)
      }
    }

    // 不需要强制刷新的情况（OAuth 模式或其他平台）
    const createdAccount = await openaiAccountService.createAccount(accountData)

    // 如果是AgruparTipo，添加到Agrupar（Soportar多Agrupar）
    if (accountType === 'group') {
      if (groupIds && groupIds.length > 0) {
        await accountGroupService.setAccountGroups(createdAccount.id, groupIds, 'openai')
      } else if (groupId) {
        await accountGroupService.addAccountToGroup(createdAccount.id, groupId, 'openai')
      }
    }

    // 如果需要刷新但不强制Éxito（OAuth 模式可能已有完整Información）
    if (needsImmediateRefresh && !requireRefreshSuccess) {
      try {
        logger.info(`🔄 尝试刷新 OpenAI Cuenta ${createdAccount.id}`)
        await openaiAccountService.refreshAccountToken(createdAccount.id)
        logger.info(`✅ 刷新Éxito`)
      } catch (refreshError) {
        logger.warn(`⚠️ 刷新Falló，但Cuenta已Crear: ${refreshError.message}`)
      }
    }

    logger.success(`Crear OpenAI CuentaÉxito: ${name} (ID: ${createdAccount.id})`)

    return res.json({
      success: true,
      data: createdAccount
    })
  } catch (error) {
    logger.error('Crear OpenAI CuentaFalló:', error)
    return res.status(500).json({
      success: false,
      message: 'CrearCuentaFalló',
      error: error.message
    })
  }
})

// Actualizar OpenAI Cuenta
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // ✅ 【Nueva característica】映射Campo名：前端的 expiresAt -> 后端的 subscriptionExpiresAt
    const mappedUpdates = mapExpiryField(updates, 'OpenAI', id)

    const { needsImmediateRefresh, requireRefreshSuccess } = mappedUpdates

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
    const currentAccount = await openaiAccountService.getAccount(id)
    if (!currentAccount) {
      return res.status(404).json({ error: 'Account not found' })
    }

    // 如果Actualizar了 Refresh Token，需要Validar其有效性
    if (mappedUpdates.openaiOauth?.refreshToken && needsImmediateRefresh && requireRefreshSuccess) {
      // 先Actualizar token Información
      const tempUpdateData = {}
      if (mappedUpdates.openaiOauth.refreshToken) {
        tempUpdateData.refreshToken = mappedUpdates.openaiOauth.refreshToken
      }
      if (mappedUpdates.openaiOauth.accessToken) {
        tempUpdateData.accessToken = mappedUpdates.openaiOauth.accessToken
      }
      // ActualizarProxyConfiguración（如果有）
      if (mappedUpdates.proxy !== undefined) {
        tempUpdateData.proxy = mappedUpdates.proxy
      }

      // 临时ActualizarCuenta以Probar新的 token
      await openaiAccountService.updateAccount(id, tempUpdateData)

      try {
        logger.info(`🔄 ValidarActualizar的 OpenAI token (Cuenta: ${id})`)

        // 尝试刷新 token（会使用CuentaConfiguración的Proxy）
        await openaiAccountService.refreshAccountToken(id)

        // Obtener刷新后的CuentaInformación
        const refreshedAccount = await openaiAccountService.getAccount(id)

        // Verificar是否Obtener到了 ID Token
        if (!refreshedAccount.idToken || refreshedAccount.idToken === '') {
          // Restauración原始 token
          await openaiAccountService.updateAccount(id, {
            refreshToken: currentAccount.refreshToken,
            accessToken: currentAccount.accessToken,
            idToken: currentAccount.idToken
          })

          return res.status(400).json({
            success: false,
            message: '无法Obtener ID Token，请Verificar Refresh Token 是否有效',
            error: 'Invalid refresh token'
          })
        }

        logger.success(`Token ValidarÉxito，继续ActualizarCuentaInformación`)
      } catch (refreshError) {
        // 刷新Falló，Restauración原始 token
        logger.warn(`❌ Token ValidarFalló，Restauración原始Configuración: ${refreshError.message}`)
        await openaiAccountService.updateAccount(id, {
          refreshToken: currentAccount.refreshToken,
          accessToken: currentAccount.accessToken,
          idToken: currentAccount.idToken,
          proxy: currentAccount.proxy
        })

        // Construir详细的ErrorInformación
        const errorResponse = {
          success: false,
          message: 'ActualizarFalló',
          error: refreshError.message
        }

        // 添加更详细的ErrorInformación
        if (refreshError.status) {
          errorResponse.errorCode = refreshError.status
        }
        if (refreshError.details) {
          errorResponse.errorDetails = refreshError.details
        }
        if (refreshError.code) {
          errorResponse.networkError = refreshError.code
        }

        // 提供更友好的Error提示
        if (refreshError.message.includes('Refresh Token 无效')) {
          errorResponse.suggestion = '请Verificar Refresh Token 是否正确，或重新通过 OAuth 授权Obtener'
        } else if (refreshError.message.includes('Proxy')) {
          errorResponse.suggestion = '请VerificarProxyConfiguración是否正确，包括地址、端口和认证Información'
        } else if (refreshError.message.includes('过于频繁')) {
          errorResponse.suggestion = '请稍后再试，或更换Proxy IP'
        } else if (refreshError.message.includes('Conexión')) {
          errorResponse.suggestion = '请Verificar网络Conexión和ProxyEstablecer'
        }

        return res.status(400).json(errorResponse)
      }
    }

    // ProcesarAgrupar的变更
    if (mappedUpdates.accountType !== undefined) {
      // 如果之前是AgruparTipo，Eliminación所有原Agrupar关联
      if (currentAccount.accountType === 'group') {
        await accountGroupService.removeAccountFromAllGroups(id)
      }
      // 如果新Tipo是Agrupar，Procesar多AgruparSoportar
      if (mappedUpdates.accountType === 'group') {
        if (Object.prototype.hasOwnProperty.call(mappedUpdates, 'groupIds')) {
          // 如果明确提供了 groupIds Parámetro（包括空Arreglo）
          if (mappedUpdates.groupIds && mappedUpdates.groupIds.length > 0) {
            // Establecer新的多Agrupar
            await accountGroupService.setAccountGroups(id, mappedUpdates.groupIds, 'openai')
          } else {
            // groupIds 为空Arreglo，从所有Agrupar中Eliminación
            await accountGroupService.removeAccountFromAllGroups(id)
          }
        } else if (mappedUpdates.groupId) {
          // 向后兼容：仅当没有 groupIds 但有 groupId 时使用单Agrupar逻辑
          await accountGroupService.addAccountToGroup(id, mappedUpdates.groupId, 'openai')
        }
      }
    }

    // 准备ActualizarDatos
    const updateData = { ...mappedUpdates }

    // Procesar敏感DatosCifrado
    if (mappedUpdates.openaiOauth) {
      updateData.openaiOauth = mappedUpdates.openaiOauth
      // 编辑时不允许直接输入 ID Token，只能通过刷新Obtener
      if (mappedUpdates.openaiOauth.accessToken) {
        updateData.accessToken = mappedUpdates.openaiOauth.accessToken
      }
      if (mappedUpdates.openaiOauth.refreshToken) {
        updateData.refreshToken = mappedUpdates.openaiOauth.refreshToken
      }
      if (mappedUpdates.openaiOauth.expires_in) {
        updateData.expiresAt = new Date(
          Date.now() + mappedUpdates.openaiOauth.expires_in * 1000
        ).toISOString()
      }
    }

    // ActualizarCuentaInformación
    if (mappedUpdates.accountInfo) {
      updateData.accountId = mappedUpdates.accountInfo.accountId || currentAccount.accountId
      updateData.chatgptUserId =
        mappedUpdates.accountInfo.chatgptUserId || currentAccount.chatgptUserId
      updateData.organizationId =
        mappedUpdates.accountInfo.organizationId || currentAccount.organizationId
      updateData.organizationRole =
        mappedUpdates.accountInfo.organizationRole || currentAccount.organizationRole
      updateData.organizationTitle =
        mappedUpdates.accountInfo.organizationTitle || currentAccount.organizationTitle
      updateData.planType = mappedUpdates.accountInfo.planType || currentAccount.planType
      updateData.email = mappedUpdates.accountInfo.email || currentAccount.email
      updateData.emailVerified =
        mappedUpdates.accountInfo.emailVerified !== undefined
          ? mappedUpdates.accountInfo.emailVerified
          : currentAccount.emailVerified
    }

    const updatedAccount = await openaiAccountService.updateAccount(id, updateData)

    // 如果需要刷新但不强制Éxito（非关键Actualizar）
    if (needsImmediateRefresh && !requireRefreshSuccess) {
      try {
        logger.info(`🔄 尝试刷新 OpenAI Cuenta ${id}`)
        await openaiAccountService.refreshAccountToken(id)
        logger.info(`✅ 刷新Éxito`)
      } catch (refreshError) {
        logger.warn(`⚠️ 刷新Falló，但CuentaInformación已Actualizar: ${refreshError.message}`)
      }
    }

    logger.success(`📝 Admin updated OpenAI account: ${id}`)
    return res.json({ success: true, data: updatedAccount })
  } catch (error) {
    logger.error('❌ Failed to update OpenAI account:', error)
    return res.status(500).json({ error: 'Failed to update account', message: error.message })
  }
})

// Eliminar OpenAI Cuenta
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const account = await openaiAccountService.getAccount(id)
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'La cuenta no existe'
      })
    }

    // 自动解绑所有绑定的 API Keys
    const unboundCount = await apiKeyService.unbindAccountFromAllKeys(id, 'openai')

    // 如果Cuenta在Agrupar中，从Agrupar中Eliminación
    if (account.accountType === 'group') {
      const group = await accountGroupService.getAccountGroup(id)
      if (group) {
        await accountGroupService.removeAccountFromGroup(id, group.id)
      }
    }

    await openaiAccountService.deleteAccount(id)

    let message = 'OpenAI账号已ÉxitoEliminar'
    if (unboundCount > 0) {
      message += `，${unboundCount} 个 API Key ha cambiado al modo de piscina compartida`
    }

    logger.success(
      `✅ Eliminar OpenAI CuentaÉxito: ${account.name} (ID: ${id}), unbound ${unboundCount} keys`
    )

    return res.json({
      success: true,
      message,
      unboundKeys: unboundCount
    })
  } catch (error) {
    logger.error('Eliminar OpenAI CuentaFalló:', error)
    return res.status(500).json({
      success: false,
      message: 'EliminarCuentaFalló',
      error: error.message
    })
  }
})

// 切换 OpenAI Cuenta状态
router.put('/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const account = await redis.getOpenAiAccount(id)
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'La cuenta no existe'
      })
    }

    // 切换Habilitar状态
    account.enabled = !account.enabled
    account.updatedAt = new Date().toISOString()

    // TODO: ActualizarMétodo
    // await redis.updateOpenAiAccount(id, account)

    logger.success(
      `✅ ${account.enabled ? 'Habilitar' : 'Deshabilitar'} OpenAI Cuenta: ${account.name} (ID: ${id})`
    )

    return res.json({
      success: true,
      data: account
    })
  } catch (error) {
    logger.error('切换 OpenAI Cuenta状态Falló:', error)
    return res.status(500).json({
      success: false,
      message: '切换Cuenta状态Falló',
      error: error.message
    })
  }
})

// 重置 OpenAI Cuenta状态（清除所有异常状态）
router.post('/:accountId/reset-status', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    const result = await openaiAccountService.resetAccountStatus(accountId)

    logger.success(`Admin reset status for OpenAI account: ${accountId}`)
    return res.json({ success: true, data: result })
  } catch (error) {
    logger.error('❌ Failed to reset OpenAI account status:', error)
    return res.status(500).json({ error: 'Failed to reset status', message: error.message })
  }
})

// 切换 OpenAI Cuenta调度状态
router.put('/:accountId/toggle-schedulable', authenticateAdmin, async (req, res) => {
  try {
    const { accountId } = req.params

    const result = await openaiAccountService.toggleSchedulable(accountId)

    // 如果账号被Deshabilitar，发送webhook通知
    if (!result.schedulable) {
      // Obtener账号Información
      const account = await redis.getOpenAiAccount(accountId)
      if (account) {
        await webhookNotifier.sendAccountAnomalyNotification({
          accountId: account.id,
          accountName: account.name || 'OpenAI Account',
          platform: 'openai',
          status: 'disabled',
          errorCode: 'OPENAI_MANUALLY_DISABLED',
          reason: '账号已被管理员手动Deshabilitar调度',
          timestamp: new Date().toISOString()
        })
      }
    }

    return res.json({
      success: result.success,
      schedulable: result.schedulable,
      message: result.schedulable ? 'Programación habilitada' : 'Programación deshabilitada'
    })
  } catch (error) {
    logger.error('切换 OpenAI Cuenta调度状态Falló:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al cambiar el estado de programación',
      error: error.message
    })
  }
})

module.exports = router
