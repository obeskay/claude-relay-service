const redisClient = require('../../models/redis')
const { v4: uuidv4 } = require('uuid')
const axios = require('axios')
const ProxyHelper = require('../../utils/proxyHelper')
const config = require('../../../config/config')
const logger = require('../../utils/logger')
const upstreamErrorHelper = require('../../utils/upstreamErrorHelper')
// const { maskToken } = require('../../utils/tokenMask')
const {
  logRefreshStart,
  logRefreshSuccess,
  logRefreshError,
  logTokenUsage,
  logRefreshSkipped
} = require('../../utils/tokenRefreshLogger')
const tokenRefreshService = require('../tokenRefreshService')
const { createEncryptor } = require('../../utils/commonHelper')

// 使用 commonHelper 的Cifrado器
const encryptor = createEncryptor('openai-account-salt')
const { encrypt, decrypt } = encryptor

// OpenAI Cuenta键前缀
const OPENAI_ACCOUNT_KEY_PREFIX = 'openai:account:'
const SHARED_OPENAI_ACCOUNTS_KEY = 'shared_openai_accounts'
const ACCOUNT_SESSION_MAPPING_PREFIX = 'openai_session_account_mapping:'

// 🧹 定期LimpiarCaché（每10分钟）
setInterval(
  () => {
    encryptor.clearCache()
    logger.info('🧹 OpenAI decrypt cache cleanup completed', encryptor.getStats())
  },
  10 * 60 * 1000
)

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function computeResetMeta(updatedAt, resetAfterSeconds) {
  if (!updatedAt || resetAfterSeconds === null || resetAfterSeconds === undefined) {
    return {
      resetAt: null,
      remainingSeconds: null
    }
  }

  const updatedMs = Date.parse(updatedAt)
  if (Number.isNaN(updatedMs)) {
    return {
      resetAt: null,
      remainingSeconds: null
    }
  }

  const resetMs = updatedMs + resetAfterSeconds * 1000
  return {
    resetAt: new Date(resetMs).toISOString(),
    remainingSeconds: Math.max(0, Math.round((resetMs - Date.now()) / 1000))
  }
}

function buildCodexUsageSnapshot(accountData) {
  const updatedAt = accountData.codexUsageUpdatedAt

  const primaryUsedPercent = toNumberOrNull(accountData.codexPrimaryUsedPercent)
  const primaryResetAfterSeconds = toNumberOrNull(accountData.codexPrimaryResetAfterSeconds)
  const primaryWindowMinutes = toNumberOrNull(accountData.codexPrimaryWindowMinutes)
  const secondaryUsedPercent = toNumberOrNull(accountData.codexSecondaryUsedPercent)
  const secondaryResetAfterSeconds = toNumberOrNull(accountData.codexSecondaryResetAfterSeconds)
  const secondaryWindowMinutes = toNumberOrNull(accountData.codexSecondaryWindowMinutes)
  const overSecondaryPercent = toNumberOrNull(accountData.codexPrimaryOverSecondaryLimitPercent)

  const hasPrimaryData =
    primaryUsedPercent !== null ||
    primaryResetAfterSeconds !== null ||
    primaryWindowMinutes !== null
  const hasSecondaryData =
    secondaryUsedPercent !== null ||
    secondaryResetAfterSeconds !== null ||
    secondaryWindowMinutes !== null

  if (!updatedAt && !hasPrimaryData && !hasSecondaryData) {
    return null
  }

  const primaryMeta = computeResetMeta(updatedAt, primaryResetAfterSeconds)
  const secondaryMeta = computeResetMeta(updatedAt, secondaryResetAfterSeconds)

  return {
    updatedAt,
    primary: {
      usedPercent: primaryUsedPercent,
      resetAfterSeconds: primaryResetAfterSeconds,
      windowMinutes: primaryWindowMinutes,
      resetAt: primaryMeta.resetAt,
      remainingSeconds: primaryMeta.remainingSeconds
    },
    secondary: {
      usedPercent: secondaryUsedPercent,
      resetAfterSeconds: secondaryResetAfterSeconds,
      windowMinutes: secondaryWindowMinutes,
      resetAt: secondaryMeta.resetAt,
      remainingSeconds: secondaryMeta.remainingSeconds
    },
    primaryOverSecondaryPercent: overSecondaryPercent
  }
}

// 刷新访问Token
async function refreshAccessToken(refreshToken, proxy = null) {
  try {
    // Codex CLI 的官方 CLIENT_ID
    const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'

    // 准备SolicitudDatos
    const requestData = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
      scope: 'openid profile email'
    }).toString()

    // ConfiguraciónSolicitud选项
    const requestOptions = {
      method: 'POST',
      url: 'https://auth.openai.com/oauth/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': requestData.length
      },
      data: requestData,
      timeout: config.requestTimeout || 600000 // 使用统一的SolicitudTiempo de espera agotadoConfiguración
    }

    // ConfiguraciónProxy（如果有）
    const proxyAgent = ProxyHelper.createProxyAgent(proxy)
    if (proxyAgent) {
      requestOptions.httpAgent = proxyAgent
      requestOptions.httpsAgent = proxyAgent
      requestOptions.proxy = false
      logger.info(
        `🌐 Using proxy for OpenAI token refresh: ${ProxyHelper.getProxyDescription(proxy)}`
      )
    } else {
      logger.debug('🌐 No proxy configured for OpenAI token refresh')
    }

    // 发送Solicitud
    logger.info('🔍 发送 token 刷新Solicitud，使用Proxy:', !!requestOptions.httpsAgent)
    const response = await axios(requestOptions)

    if (response.status === 200 && response.data) {
      const result = response.data

      logger.info('✅ Successfully refreshed OpenAI token')

      // Retornar新的 token Información
      return {
        access_token: result.access_token,
        id_token: result.id_token,
        refresh_token: result.refresh_token || refreshToken, // 如果没有Retornar新的，保留原来的
        expires_in: result.expires_in || 3600,
        expiry_date: Date.now() + (result.expires_in || 3600) * 1000 // Calcular过期Tiempo
      }
    } else {
      throw new Error(`Failed to refresh token: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    if (error.response) {
      // Servicio器Respuesta了Error状态码
      const errorData = error.response.data || {}
      logger.error('OpenAI token refresh failed:', {
        status: error.response.status,
        data: errorData,
        headers: error.response.headers
      })

      // Construir详细的ErrorInformación
      let errorMessage = `OpenAI Servicio器RetornarError (${error.response.status})`

      if (error.response.status === 400) {
        if (errorData.error === 'invalid_grant') {
          errorMessage = 'Refresh Token 无效或已过期，请重新授权'
        } else if (errorData.error === 'invalid_request') {
          errorMessage = `SolicitudParámetroError：${errorData.error_description || errorData.error}`
        } else {
          errorMessage = `SolicitudError：${errorData.error_description || errorData.error || '未知Error'}`
        }
      } else if (error.response.status === 401) {
        errorMessage = '认证Falló：Refresh Token 无效'
      } else if (error.response.status === 403) {
        errorMessage = '访问被拒绝：可能是 IP 被封或Cuenta被Deshabilitar'
      } else if (error.response.status === 429) {
        errorMessage = 'Solicitud过于频繁，请稍后Reintentar'
      } else if (error.response.status >= 500) {
        errorMessage = 'OpenAI Servicio器内部Error，请稍后Reintentar'
      } else if (errorData.error_description) {
        errorMessage = errorData.error_description
      } else if (errorData.error) {
        errorMessage = errorData.error
      } else if (errorData.message) {
        errorMessage = errorData.message
      }

      const fullError = new Error(errorMessage)
      fullError.status = error.response.status
      fullError.details = errorData
      throw fullError
    } else if (error.request) {
      // Solicitud已发出但没有收到Respuesta
      logger.error('OpenAI token refresh no response:', error.message)

      let errorMessage = '无法Conexión到 OpenAI Servicio器'
      if (proxy) {
        errorMessage += `（Proxy: ${ProxyHelper.getProxyDescription(proxy)}）`
      }
      if (error.code === 'ECONNREFUSED') {
        errorMessage += ' - Conexión被拒绝'
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += ' - ConexiónTiempo de espera agotado'
      } else if (error.code === 'ENOTFOUND') {
        errorMessage += ' - 无法Analizar域名'
      } else if (error.code === 'EPROTO') {
        errorMessage += ' - ProtocoloError（可能是ProxyConfiguración问题）'
      } else if (error.message) {
        errorMessage += ` - ${error.message}`
      }

      const fullError = new Error(errorMessage)
      fullError.code = error.code
      throw fullError
    } else {
      // EstablecerSolicitud时发生Error
      logger.error('OpenAI token refresh error:', error.message)
      const fullError = new Error(`SolicitudEstablecerError: ${error.message}`)
      fullError.originalError = error
      throw fullError
    }
  }
}

// Verificar token 是否过期
function isTokenExpired(account) {
  if (!account.expiresAt) {
    return false
  }
  return new Date(account.expiresAt) <= new Date()
}

/**
 * VerificarCuenta订阅是否过期
 * @param {Object} account - CuentaObjeto
 * @returns {boolean} - true: 已过期, false: 未过期
 */
function isSubscriptionExpired(account) {
  if (!account.subscriptionExpiresAt) {
    return false // 未Establecer视为永不过期
  }
  const expiryDate = new Date(account.subscriptionExpiresAt)
  return expiryDate <= new Date()
}

// 刷新Cuenta的 access token（带分布式锁）
async function refreshAccountToken(accountId) {
  let lockAcquired = false
  let account = null
  let accountName = accountId

  try {
    account = await getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    accountName = account.name || accountId

    // Verificar是否有 refresh token
    // account.refreshToken 在 getAccount 中已经被Descifrado了，直接使用即可
    const refreshToken = account.refreshToken || null

    if (!refreshToken) {
      logRefreshSkipped(accountId, accountName, 'openai', 'No refresh token available')
      throw new Error('No refresh token available')
    }

    // 尝试Obtener分布式锁
    lockAcquired = await tokenRefreshService.acquireRefreshLock(accountId, 'openai')

    if (!lockAcquired) {
      // 如果无法Obtener锁，说明另一个ProcesoEn progreso刷新
      logger.info(
        `🔒 Token refresh already in progress for OpenAI account: ${accountName} (${accountId})`
      )
      logRefreshSkipped(accountId, accountName, 'openai', 'already_locked')

      // 等待一段Tiempo后Retornar，期望其他Proceso已Completado刷新
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // 重新ObtenerCuentaDatos（可能已被其他Proceso刷新）
      const updatedAccount = await getAccount(accountId)
      if (updatedAccount && !isTokenExpired(updatedAccount)) {
        return {
          access_token: decrypt(updatedAccount.accessToken),
          id_token: updatedAccount.idToken,
          refresh_token: updatedAccount.refreshToken,
          expires_in: 3600,
          expiry_date: new Date(updatedAccount.expiresAt).getTime()
        }
      }

      throw new Error('Token refresh in progress by another process')
    }

    // Obtener锁Éxito，Iniciando刷新
    logRefreshStart(accountId, accountName, 'openai')
    logger.info(`🔄 Starting token refresh for OpenAI account: ${accountName} (${accountId})`)

    // ObtenerProxyConfiguración
    let proxy = null
    if (account.proxy) {
      try {
        proxy = typeof account.proxy === 'string' ? JSON.parse(account.proxy) : account.proxy
      } catch (e) {
        logger.warn(`Failed to parse proxy config for account ${accountId}:`, e)
      }
    }

    const newTokens = await refreshAccessToken(refreshToken, proxy)
    if (!newTokens) {
      throw new Error('Failed to refresh token')
    }

    // 准备ActualizarDatos - 不要在这里Cifrado，让 updateAccount 统一Procesar
    const updates = {
      accessToken: newTokens.access_token, // 不Cifrado，让 updateAccount Procesar
      expiresAt: new Date(newTokens.expiry_date).toISOString()
    }

    // 如果有新的 ID token，也Actualizar它（这对于首次未提供 ID Token 的Cuenta特别重要）
    if (newTokens.id_token) {
      updates.idToken = newTokens.id_token // 不Cifrado，让 updateAccount Procesar

      // 如果之前没有 ID Token，尝试Analizar并ActualizarUsuarioInformación
      if (!account.idToken || account.idToken === '') {
        try {
          const idTokenParts = newTokens.id_token.split('.')
          if (idTokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(idTokenParts[1], 'base64').toString())
            const authClaims = payload['https://api.openai.com/auth'] || {}

            // ActualizarCuentaInformación - 使用正确的Campo名
            // OpenAI ID Token中UsuarioID在chatgpt_account_id、chatgpt_user_id和user_idCampo
            if (authClaims.chatgpt_account_id) {
              updates.accountId = authClaims.chatgpt_account_id
            }
            if (authClaims.chatgpt_user_id) {
              updates.chatgptUserId = authClaims.chatgpt_user_id
            } else if (authClaims.user_id) {
              // 有些情况下可能只有user_idCampo
              updates.chatgptUserId = authClaims.user_id
            }
            if (authClaims.organizations?.[0]?.id) {
              updates.organizationId = authClaims.organizations[0].id
            }
            if (authClaims.organizations?.[0]?.role) {
              updates.organizationRole = authClaims.organizations[0].role
            }
            if (authClaims.organizations?.[0]?.title) {
              updates.organizationTitle = authClaims.organizations[0].title
            }
            if (payload.email) {
              updates.email = payload.email // 不Cifrado，让 updateAccount Procesar
            }
            if (payload.email_verified !== undefined) {
              updates.emailVerified = payload.email_verified
            }

            logger.info(`Updated user info from ID Token for account ${accountId}`)
          }
        } catch (e) {
          logger.warn(`Failed to parse ID Token for account ${accountId}:`, e)
        }
      }
    }

    // 如果Retornar了新的 refresh token，Actualizar它
    if (newTokens.refresh_token && newTokens.refresh_token !== refreshToken) {
      updates.refreshToken = newTokens.refresh_token // 不Cifrado，让 updateAccount Procesar
      logger.info(`Updated refresh token for account ${accountId}`)
    }

    // ActualizarCuentaInformación
    await updateAccount(accountId, updates)

    logRefreshSuccess(accountId, accountName, 'openai', newTokens) // 传入完整的 newTokens Objeto
    return newTokens
  } catch (error) {
    logRefreshError(accountId, account?.name || accountName, 'openai', error.message)

    // 发送 Webhook 通知（如果Habilitar）
    try {
      const webhookNotifier = require('../../utils/webhookNotifier')
      await webhookNotifier.sendAccountAnomalyNotification({
        accountId,
        accountName: account?.name || accountName,
        platform: 'openai',
        status: 'error',
        errorCode: 'OPENAI_TOKEN_REFRESH_FAILED',
        reason: `Token refresh failed: ${error.message}`,
        timestamp: new Date().toISOString()
      })
      logger.info(
        `📢 Webhook notification sent for OpenAI account ${account?.name || accountName} refresh failure`
      )
    } catch (webhookError) {
      logger.error('Failed to send webhook notification:', webhookError)
    }

    throw error
  } finally {
    // 确保释放锁
    if (lockAcquired) {
      await tokenRefreshService.releaseRefreshLock(accountId, 'openai')
      logger.debug(`🔓 Released refresh lock for OpenAI account ${accountId}`)
    }
  }
}

// CrearCuenta
async function createAccount(accountData) {
  const accountId = uuidv4()
  const now = new Date().toISOString()

  // ProcesarOAuthDatos
  let oauthData = {}
  if (accountData.openaiOauth) {
    oauthData =
      typeof accountData.openaiOauth === 'string'
        ? JSON.parse(accountData.openaiOauth)
        : accountData.openaiOauth
  }

  // ProcesarCuentaInformación
  const accountInfo = accountData.accountInfo || {}

  // Verificar邮箱是否已经是CifradoFormato（Incluir冒号分隔的32位十六进制字符）
  const isEmailEncrypted =
    accountInfo.email && accountInfo.email.length >= 33 && accountInfo.email.charAt(32) === ':'

  const account = {
    id: accountId,
    name: accountData.name,
    description: accountData.description || '',
    accountType: accountData.accountType || 'shared',
    groupId: accountData.groupId || null,
    priority: accountData.priority || 50,
    rateLimitDuration:
      accountData.rateLimitDuration !== undefined && accountData.rateLimitDuration !== null
        ? accountData.rateLimitDuration
        : 60,
    // OAuth相关Campo（Cifrado存储）
    // ID Token 现在是Opcional的，如果没有提供会在首次刷新时自动Obtener
    idToken: oauthData.idToken && oauthData.idToken.trim() ? encrypt(oauthData.idToken) : '',
    accessToken:
      oauthData.accessToken && oauthData.accessToken.trim() ? encrypt(oauthData.accessToken) : '',
    refreshToken:
      oauthData.refreshToken && oauthData.refreshToken.trim()
        ? encrypt(oauthData.refreshToken)
        : '',
    openaiOauth: encrypt(JSON.stringify(oauthData)),
    // CuentaInformaciónCampo - 确保所有Campo都被保存，即使是空Cadena
    accountId: accountInfo.accountId || '',
    chatgptUserId: accountInfo.chatgptUserId || '',
    organizationId: accountInfo.organizationId || '',
    organizationRole: accountInfo.organizationRole || '',
    organizationTitle: accountInfo.organizationTitle || '',
    planType: accountInfo.planType || '',
    // 邮箱Campo：Verificar是否已经Cifrado，避免双重Cifrado
    email: isEmailEncrypted ? accountInfo.email : encrypt(accountInfo.email || ''),
    emailVerified: accountInfo.emailVerified === true ? 'true' : 'false',
    // 过期Tiempo
    expiresAt: oauthData.expires_in
      ? new Date(Date.now() + oauthData.expires_in * 1000).toISOString()
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // OAuth Token 过期Tiempo（技术Campo）

    // ✅ Nueva característica：Cuenta订阅到期Tiempo（业务Campo，手动管理）
    subscriptionExpiresAt: accountData.subscriptionExpiresAt || null,

    // 状态Campo
    isActive: accountData.isActive !== false ? 'true' : 'false',
    status: 'active',
    schedulable: accountData.schedulable !== false ? 'true' : 'false',
    // 自动防护开关
    disableAutoProtection:
      accountData.disableAutoProtection === true || accountData.disableAutoProtection === 'true'
        ? 'true'
        : 'false',
    lastRefresh: now,
    createdAt: now,
    updatedAt: now
  }

  // ProxyConfiguración
  if (accountData.proxy) {
    account.proxy =
      typeof accountData.proxy === 'string' ? accountData.proxy : JSON.stringify(accountData.proxy)
  }

  const client = redisClient.getClientSafe()
  await client.hset(`${OPENAI_ACCOUNT_KEY_PREFIX}${accountId}`, account)
  await redisClient.addToIndex('openai:account:index', accountId)

  // 如果是共享Cuenta，添加到共享Cuenta集合
  if (account.accountType === 'shared') {
    await client.sadd(SHARED_OPENAI_ACCOUNTS_KEY, accountId)
  }

  logger.info(`Created OpenAI account: ${accountId}`)
  return account
}

// ObtenerCuenta
async function getAccount(accountId) {
  const client = redisClient.getClientSafe()
  const accountData = await client.hgetall(`${OPENAI_ACCOUNT_KEY_PREFIX}${accountId}`)

  if (!accountData || Object.keys(accountData).length === 0) {
    return null
  }

  // Descifrado敏感Datos（仅用于内部Procesar，不Retornar给前端）
  if (accountData.idToken) {
    accountData.idToken = decrypt(accountData.idToken)
  }
  // 注意：accessToken 在 openaiRoutes.js 中会被单独Descifrado，这里不Descifrado
  // if (accountData.accessToken) {
  //   accountData.accessToken = decrypt(accountData.accessToken)
  // }
  if (accountData.refreshToken) {
    accountData.refreshToken = decrypt(accountData.refreshToken)
  }
  if (accountData.email) {
    accountData.email = decrypt(accountData.email)
  }
  if (accountData.openaiOauth) {
    try {
      accountData.openaiOauth = JSON.parse(decrypt(accountData.openaiOauth))
    } catch (e) {
      accountData.openaiOauth = null
    }
  }

  // AnalizarProxyConfiguración
  if (accountData.proxy && typeof accountData.proxy === 'string') {
    try {
      accountData.proxy = JSON.parse(accountData.proxy)
    } catch (e) {
      accountData.proxy = null
    }
  }

  return accountData
}

// ActualizarCuenta
async function updateAccount(accountId, updates) {
  const existingAccount = await getAccount(accountId)
  if (!existingAccount) {
    throw new Error('Account not found')
  }

  updates.updatedAt = new Date().toISOString()

  // Cifrado敏感Datos
  if (updates.openaiOauth) {
    const oauthData =
      typeof updates.openaiOauth === 'string'
        ? updates.openaiOauth
        : JSON.stringify(updates.openaiOauth)
    updates.openaiOauth = encrypt(oauthData)
  }
  if (updates.idToken) {
    updates.idToken = encrypt(updates.idToken)
  }
  if (updates.accessToken) {
    updates.accessToken = encrypt(updates.accessToken)
  }
  if (updates.refreshToken && updates.refreshToken.trim()) {
    updates.refreshToken = encrypt(updates.refreshToken)
  }
  if (updates.email) {
    updates.email = encrypt(updates.email)
  }

  // ProcesarProxyConfiguración
  if (updates.proxy) {
    updates.proxy =
      typeof updates.proxy === 'string' ? updates.proxy : JSON.stringify(updates.proxy)
  }

  // ✅ 如果通过Ruta映射Actualizar了 subscriptionExpiresAt，直接保存
  // subscriptionExpiresAt 是业务Campo，与 token 刷新独立
  if (updates.subscriptionExpiresAt !== undefined) {
    // 直接保存，不做任何调整
  }

  // Procesar disableAutoProtection 布尔Valor转Cadena
  if (updates.disableAutoProtection !== undefined) {
    updates.disableAutoProtection =
      updates.disableAutoProtection === true || updates.disableAutoProtection === 'true'
        ? 'true'
        : 'false'
  }

  // ActualizarCuentaTipo时Procesar共享Cuenta集合
  const client = redisClient.getClientSafe()
  if (updates.accountType && updates.accountType !== existingAccount.accountType) {
    if (updates.accountType === 'shared') {
      await client.sadd(SHARED_OPENAI_ACCOUNTS_KEY, accountId)
    } else {
      await client.srem(SHARED_OPENAI_ACCOUNTS_KEY, accountId)
    }
  }

  await client.hset(`${OPENAI_ACCOUNT_KEY_PREFIX}${accountId}`, updates)

  logger.info(`Updated OpenAI account: ${accountId}`)

  // Combina actualización后的CuentaDatos
  const updatedAccount = { ...existingAccount, ...updates }

  // Retornar时AnalizarProxyConfiguración
  if (updatedAccount.proxy && typeof updatedAccount.proxy === 'string') {
    try {
      updatedAccount.proxy = JSON.parse(updatedAccount.proxy)
    } catch (e) {
      updatedAccount.proxy = null
    }
  }

  return updatedAccount
}

// EliminarCuenta
async function deleteAccount(accountId) {
  const account = await getAccount(accountId)
  if (!account) {
    throw new Error('Account not found')
  }

  // 从 Redis Eliminar
  const client = redisClient.getClientSafe()
  await client.del(`${OPENAI_ACCOUNT_KEY_PREFIX}${accountId}`)
  await redisClient.removeFromIndex('openai:account:index', accountId)

  // 从共享Cuenta集合中Eliminación
  if (account.accountType === 'shared') {
    await client.srem(SHARED_OPENAI_ACCOUNTS_KEY, accountId)
  }

  // LimpiarSesión映射（使用反向Índice）
  const sessionHashes = await client.smembers(`openai_account_sessions:${accountId}`)
  if (sessionHashes.length > 0) {
    const pipeline = client.pipeline()
    sessionHashes.forEach((hash) => pipeline.del(`${ACCOUNT_SESSION_MAPPING_PREFIX}${hash}`))
    pipeline.del(`openai_account_sessions:${accountId}`)
    await pipeline.exec()
  }

  logger.info(`Deleted OpenAI account: ${accountId}`)
  return true
}

// Obtener所有Cuenta
async function getAllAccounts() {
  const _client = redisClient.getClientSafe()
  const accountIds = await redisClient.getAllIdsByIndex(
    'openai:account:index',
    `${OPENAI_ACCOUNT_KEY_PREFIX}*`,
    /^openai:account:(.+)$/
  )
  const keys = accountIds.map((id) => `${OPENAI_ACCOUNT_KEY_PREFIX}${id}`)
  const accounts = []
  const dataList = await redisClient.batchHgetallChunked(keys)

  for (let i = 0; i < keys.length; i++) {
    const accountData = dataList[i]
    if (accountData && Object.keys(accountData).length > 0) {
      const codexUsage = buildCodexUsageSnapshot(accountData)

      // Descifrado敏感Datos（但不Retornar给前端）
      if (accountData.email) {
        accountData.email = decrypt(accountData.email)
      }

      // 先保存 refreshToken 是否存在的标记
      const hasRefreshTokenFlag = !!accountData.refreshToken
      const maskedAccessToken = accountData.accessToken ? '[ENCRYPTED]' : ''
      const maskedRefreshToken = accountData.refreshToken ? '[ENCRYPTED]' : ''
      const maskedOauth = accountData.openaiOauth ? '[ENCRYPTED]' : ''

      // 屏蔽敏感Información（token等不应该Retornar给前端）
      delete accountData.idToken
      delete accountData.accessToken
      delete accountData.refreshToken
      delete accountData.openaiOauth
      delete accountData.codexPrimaryUsedPercent
      delete accountData.codexPrimaryResetAfterSeconds
      delete accountData.codexPrimaryWindowMinutes
      delete accountData.codexSecondaryUsedPercent
      delete accountData.codexSecondaryResetAfterSeconds
      delete accountData.codexSecondaryWindowMinutes
      delete accountData.codexPrimaryOverSecondaryLimitPercent
      // Tiempo戳改由 codexUsage.updatedAt 暴露
      delete accountData.codexUsageUpdatedAt

      // Obtener限流状态Información
      const rateLimitInfo = await getAccountRateLimitInfo(accountData.id)

      // AnalizarProxyConfiguración
      if (accountData.proxy) {
        try {
          accountData.proxy = JSON.parse(accountData.proxy)
        } catch (e) {
          // 如果AnalizarFalló，Establecer为null
          accountData.proxy = null
        }
      }

      const tokenExpiresAt = accountData.expiresAt || null
      const subscriptionExpiresAt =
        accountData.subscriptionExpiresAt && accountData.subscriptionExpiresAt !== ''
          ? accountData.subscriptionExpiresAt
          : null

      // 不Descifrado敏感Campo，只Retornar基本Información
      accounts.push({
        ...accountData,
        isActive: accountData.isActive === 'true',
        schedulable: accountData.schedulable !== 'false',
        openaiOauth: maskedOauth,
        accessToken: maskedAccessToken,
        refreshToken: maskedRefreshToken,

        // ✅ 前端显示订阅过期Tiempo（业务Campo）
        tokenExpiresAt,
        subscriptionExpiresAt,
        expiresAt: subscriptionExpiresAt,

        // 添加 scopes Campo用于判断认证方式
        // Procesar空Cadena的情况
        scopes:
          accountData.scopes && accountData.scopes.trim() ? accountData.scopes.split(' ') : [],
        // 添加 hasRefreshToken 标记
        hasRefreshToken: hasRefreshTokenFlag,
        // 添加限流状态Información（统一Formato）
        rateLimitStatus: rateLimitInfo
          ? {
              status: rateLimitInfo.status,
              isRateLimited: rateLimitInfo.isRateLimited,
              rateLimitedAt: rateLimitInfo.rateLimitedAt,
              rateLimitResetAt: rateLimitInfo.rateLimitResetAt,
              minutesRemaining: rateLimitInfo.minutesRemaining
            }
          : {
              status: 'normal',
              isRateLimited: false,
              rateLimitedAt: null,
              rateLimitResetAt: null,
              minutesRemaining: 0
            },
        codexUsage
      })
    }
  }

  return accounts
}

// Obtener单个Cuenta的概要Información（用于外部展示基本状态）
async function getAccountOverview(accountId) {
  const client = redisClient.getClientSafe()
  const accountData = await client.hgetall(`${OPENAI_ACCOUNT_KEY_PREFIX}${accountId}`)

  if (!accountData || Object.keys(accountData).length === 0) {
    return null
  }

  const codexUsage = buildCodexUsageSnapshot(accountData)
  const rateLimitInfo = await getAccountRateLimitInfo(accountId)

  if (accountData.proxy) {
    try {
      accountData.proxy = JSON.parse(accountData.proxy)
    } catch (error) {
      accountData.proxy = null
    }
  }

  const scopes =
    accountData.scopes && accountData.scopes.trim() ? accountData.scopes.split(' ') : []

  return {
    id: accountData.id,
    accountType: accountData.accountType || 'shared',
    platform: accountData.platform || 'openai',
    isActive: accountData.isActive === 'true',
    schedulable: accountData.schedulable !== 'false',
    rateLimitStatus: rateLimitInfo || {
      status: 'normal',
      isRateLimited: false,
      rateLimitedAt: null,
      rateLimitResetAt: null,
      minutesRemaining: 0
    },
    codexUsage,
    scopes
  }
}

// 选择可用Cuenta（Soportar专属和共享Cuenta）
async function selectAvailableAccount(apiKeyId, sessionHash = null) {
  // 首先Verificar是否有粘性Sesión
  const client = redisClient.getClientSafe()
  if (sessionHash) {
    const mappedAccountId = await client.get(`${ACCOUNT_SESSION_MAPPING_PREFIX}${sessionHash}`)

    if (mappedAccountId) {
      const account = await getAccount(mappedAccountId)
      if (account && account.isActive === 'true' && !isTokenExpired(account)) {
        logger.debug(`Using sticky session account: ${mappedAccountId}`)
        return account
      }
    }
  }

  // Obtener API Key Información
  const apiKeyData = await client.hgetall(`api_key:${apiKeyId}`)

  // Verificar是否绑定了 OpenAI Cuenta
  if (apiKeyData.openaiAccountId) {
    const account = await getAccount(apiKeyData.openaiAccountId)
    if (account && account.isActive === 'true') {
      // Verificar token 是否过期
      const isExpired = isTokenExpired(account)

      // Registrotoken使用情况
      logTokenUsage(account.id, account.name, 'openai', account.expiresAt, isExpired)

      if (isExpired) {
        await refreshAccountToken(account.id)
        return await getAccount(account.id)
      }

      // Crear粘性Sesión映射
      if (sessionHash) {
        await client.setex(
          `${ACCOUNT_SESSION_MAPPING_PREFIX}${sessionHash}`,
          3600, // 1小时过期
          account.id
        )
        // 反向Índice：accountId -> sessionHash（用于EliminarCuenta时快速Limpiar）
        await client.sadd(`openai_account_sessions:${account.id}`, sessionHash)
        await client.expire(`openai_account_sessions:${account.id}`, 3600)
      }

      return account
    }
  }

  // 从共享Cuenta池选择
  const sharedAccountIds = await client.smembers(SHARED_OPENAI_ACCOUNTS_KEY)
  const availableAccounts = []

  for (const accountId of sharedAccountIds) {
    const account = await getAccount(accountId)
    if (
      account &&
      account.isActive === 'true' &&
      !isRateLimited(account) &&
      !isSubscriptionExpired(account)
    ) {
      availableAccounts.push(account)
    } else if (account && isSubscriptionExpired(account)) {
      logger.debug(
        `⏰ Skipping expired OpenAI account: ${account.name}, expired at ${account.subscriptionExpiresAt}`
      )
    }
  }

  if (availableAccounts.length === 0) {
    throw new Error('No available OpenAI accounts')
  }

  // 选择使用最少的Cuenta
  const selectedAccount = availableAccounts.reduce((prev, curr) => {
    const prevUsage = parseInt(prev.totalUsage || 0)
    const currUsage = parseInt(curr.totalUsage || 0)
    return prevUsage <= currUsage ? prev : curr
  })

  // Verificar token 是否过期
  if (isTokenExpired(selectedAccount)) {
    await refreshAccountToken(selectedAccount.id)
    return await getAccount(selectedAccount.id)
  }

  // Crear粘性Sesión映射
  if (sessionHash) {
    await client.setex(
      `${ACCOUNT_SESSION_MAPPING_PREFIX}${sessionHash}`,
      3600, // 1小时过期
      selectedAccount.id
    )
    await client.sadd(`openai_account_sessions:${selectedAccount.id}`, sessionHash)
    await client.expire(`openai_account_sessions:${selectedAccount.id}`, 3600)
  }

  return selectedAccount
}

// VerificarCuenta是否被限流
function isRateLimited(account) {
  if (account.rateLimitStatus === 'limited' && account.rateLimitedAt) {
    const limitedAt = new Date(account.rateLimitedAt).getTime()
    const now = Date.now()
    const limitDuration = 60 * 60 * 1000 // 1小时

    return now < limitedAt + limitDuration
  }
  return false
}

// EstablecerCuenta限流状态
async function setAccountRateLimited(accountId, isLimited, resetsInSeconds = null) {
  const updates = {
    rateLimitStatus: isLimited ? 'limited' : 'normal',
    rateLimitedAt: isLimited ? new Date().toISOString() : null,
    // 限流时停止调度，解除限流时Restauración调度
    schedulable: isLimited ? 'false' : 'true'
  }

  // 如果提供了重置Tiempo（秒数），Calcular重置Tiempo戳
  if (isLimited && resetsInSeconds !== null && resetsInSeconds > 0) {
    const resetTime = new Date(Date.now() + resetsInSeconds * 1000).toISOString()
    updates.rateLimitResetAt = resetTime
    logger.info(
      `🕐 Account ${accountId} will be reset at ${resetTime} (in ${resetsInSeconds} seconds / ${Math.ceil(resetsInSeconds / 60)} minutes)`
    )
  } else if (isLimited) {
    // 如果没有提供重置Tiempo，使用Predeterminado的60分钟
    const defaultResetSeconds = 60 * 60 // 1小时
    const resetTime = new Date(Date.now() + defaultResetSeconds * 1000).toISOString()
    updates.rateLimitResetAt = resetTime
    logger.warn(
      `⚠️ No reset time provided for account ${accountId}, using default 60 minutes. Reset at ${resetTime}`
    )
  } else if (!isLimited) {
    updates.rateLimitResetAt = null
  }

  await updateAccount(accountId, updates)
  logger.info(
    `Set rate limit status for OpenAI account ${accountId}: ${updates.rateLimitStatus}, schedulable: ${updates.schedulable}`
  )

  // 如果被限流，发送 Webhook 通知
  if (isLimited) {
    try {
      const account = await getAccount(accountId)
      const webhookNotifier = require('../../utils/webhookNotifier')
      await webhookNotifier.sendAccountAnomalyNotification({
        accountId,
        accountName: account.name || accountId,
        platform: 'openai',
        status: 'blocked',
        errorCode: 'OPENAI_RATE_LIMITED',
        reason: resetsInSeconds
          ? `Account rate limited (429 error). Reset in ${Math.ceil(resetsInSeconds / 60)} minutes`
          : 'Account rate limited (429 error). Estimated reset in 1 hour',
        timestamp: new Date().toISOString()
      })
      logger.info(`📢 Webhook notification sent for OpenAI account ${account.name} rate limit`)
    } catch (webhookError) {
      logger.error('Failed to send rate limit webhook notification:', webhookError)
    }
  }
}

// 🚫 标记Cuenta为未授权状态（401Error）
async function markAccountUnauthorized(accountId, reason = 'OpenAI账号认证Falló（401Error）') {
  const account = await getAccount(accountId)
  if (!account) {
    throw new Error('Account not found')
  }

  const now = new Date().toISOString()
  const currentCount = parseInt(account.unauthorizedCount || '0', 10)
  const unauthorizedCount = Number.isFinite(currentCount) ? currentCount + 1 : 1

  const updates = {
    status: 'unauthorized',
    schedulable: 'false',
    errorMessage: reason,
    unauthorizedAt: now,
    unauthorizedCount: unauthorizedCount.toString()
  }

  await updateAccount(accountId, updates)
  logger.warn(
    `🚫 Marked OpenAI account ${account.name || accountId} as unauthorized due to 401 error`
  )

  try {
    const webhookNotifier = require('../../utils/webhookNotifier')
    await webhookNotifier.sendAccountAnomalyNotification({
      accountId,
      accountName: account.name || accountId,
      platform: 'openai',
      status: 'unauthorized',
      errorCode: 'OPENAI_UNAUTHORIZED',
      reason,
      timestamp: now
    })
    logger.info(
      `📢 Webhook notification sent for OpenAI account ${account.name} unauthorized state`
    )
  } catch (webhookError) {
    logger.error('Failed to send unauthorized webhook notification:', webhookError)
  }
}

// 🔄 重置Cuenta所有异常状态
async function resetAccountStatus(accountId) {
  const account = await getAccount(accountId)
  if (!account) {
    throw new Error('Account not found')
  }

  const updates = {
    // 根据是否有有效的 accessToken 来Establecer status
    status: account.accessToken ? 'active' : 'created',
    // Restauración可调度状态
    schedulable: 'true',
    // 清除Error相关Campo
    errorMessage: null,
    rateLimitedAt: null,
    rateLimitStatus: 'normal',
    rateLimitResetAt: null
  }

  await updateAccount(accountId, updates)
  logger.info(`✅ Reset all error status for OpenAI account ${accountId}`)

  // 清除临时不可用状态
  await upstreamErrorHelper.clearTempUnavailable(accountId, 'openai').catch(() => {})

  // 发送 Webhook 通知
  try {
    const webhookNotifier = require('../../utils/webhookNotifier')
    await webhookNotifier.sendAccountAnomalyNotification({
      accountId,
      accountName: account.name || accountId,
      platform: 'openai',
      status: 'recovered',
      errorCode: 'STATUS_RESET',
      reason: 'Account status manually reset',
      timestamp: new Date().toISOString()
    })
    logger.info(`📢 Webhook notification sent for OpenAI account ${account.name} status reset`)
  } catch (webhookError) {
    logger.error('Failed to send status reset webhook notification:', webhookError)
  }

  return { success: true, message: 'Account status reset successfully' }
}

// 切换Cuenta调度状态
async function toggleSchedulable(accountId) {
  const account = await getAccount(accountId)
  if (!account) {
    throw new Error('Account not found')
  }

  // 切换调度状态
  const newSchedulable = account.schedulable === 'false' ? 'true' : 'false'

  await updateAccount(accountId, {
    schedulable: newSchedulable
  })

  logger.info(`Toggled schedulable status for OpenAI account ${accountId}: ${newSchedulable}`)

  return {
    success: true,
    schedulable: newSchedulable === 'true'
  }
}

// ObtenerCuenta限流Información
async function getAccountRateLimitInfo(accountId) {
  const account = await getAccount(accountId)
  if (!account) {
    return null
  }

  const status = account.rateLimitStatus || 'normal'
  const rateLimitedAt = account.rateLimitedAt || null
  const rateLimitResetAt = account.rateLimitResetAt || null

  if (status === 'limited') {
    const now = Date.now()
    let remainingTime = 0

    if (rateLimitResetAt) {
      const resetAt = new Date(rateLimitResetAt).getTime()
      remainingTime = Math.max(0, resetAt - now)
    } else if (rateLimitedAt) {
      const limitedAt = new Date(rateLimitedAt).getTime()
      const limitDuration = 60 * 60 * 1000 // Predeterminado1小时
      remainingTime = Math.max(0, limitedAt + limitDuration - now)
    }

    const minutesRemaining = remainingTime > 0 ? Math.ceil(remainingTime / (60 * 1000)) : 0

    return {
      status,
      isRateLimited: minutesRemaining > 0,
      rateLimitedAt,
      rateLimitResetAt,
      minutesRemaining
    }
  }

  return {
    status,
    isRateLimited: false,
    rateLimitedAt,
    rateLimitResetAt,
    minutesRemaining: 0
  }
}

// ActualizarCuenta使用Estadística（tokensParámetroOpcional，Predeterminado为0，仅Actualizar最后使用Tiempo）
async function updateAccountUsage(accountId, tokens = 0) {
  const account = await getAccount(accountId)
  if (!account) {
    return
  }

  const updates = {
    lastUsedAt: new Date().toISOString()
  }

  // 如果有 tokens Parámetro且大于0，同时Actualizar使用Estadística
  if (tokens > 0) {
    const totalUsage = parseInt(account.totalUsage || 0) + tokens
    updates.totalUsage = totalUsage.toString()
  }

  await updateAccount(accountId, updates)
}

// 为了兼容性，保留recordUsage作为updateAccountUsage的别名
const recordUsage = updateAccountUsage

async function updateCodexUsageSnapshot(accountId, usageSnapshot) {
  if (!usageSnapshot || typeof usageSnapshot !== 'object') {
    return
  }

  const fieldMap = {
    primaryUsedPercent: 'codexPrimaryUsedPercent',
    primaryResetAfterSeconds: 'codexPrimaryResetAfterSeconds',
    primaryWindowMinutes: 'codexPrimaryWindowMinutes',
    secondaryUsedPercent: 'codexSecondaryUsedPercent',
    secondaryResetAfterSeconds: 'codexSecondaryResetAfterSeconds',
    secondaryWindowMinutes: 'codexSecondaryWindowMinutes',
    primaryOverSecondaryPercent: 'codexPrimaryOverSecondaryLimitPercent'
  }

  const updates = {}
  let hasPayload = false

  for (const [key, field] of Object.entries(fieldMap)) {
    if (usageSnapshot[key] !== undefined && usageSnapshot[key] !== null) {
      updates[field] = String(usageSnapshot[key])
      hasPayload = true
    }
  }

  if (!hasPayload) {
    return
  }

  updates.codexUsageUpdatedAt = new Date().toISOString()

  const client = redisClient.getClientSafe()
  await client.hset(`${OPENAI_ACCOUNT_KEY_PREFIX}${accountId}`, updates)
}

module.exports = {
  createAccount,
  getAccount,
  getAccountOverview,
  updateAccount,
  deleteAccount,
  getAllAccounts,
  selectAvailableAccount,
  refreshAccountToken,
  isTokenExpired,
  setAccountRateLimited,
  markAccountUnauthorized,
  resetAccountStatus,
  toggleSchedulable,
  getAccountRateLimitInfo,
  updateAccountUsage,
  recordUsage, // 别名，指向updateAccountUsage
  updateCodexUsageSnapshot,
  encrypt,
  decrypt,
  encryptor // 暴露Cifrado器以便Probar和Monitorear
}
