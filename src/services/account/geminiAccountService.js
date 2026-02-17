const redisClient = require('../../models/redis')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const https = require('https')
const logger = require('../../utils/logger')
const { OAuth2Client } = require('google-auth-library')
const { maskToken } = require('../../utils/tokenMask')
const ProxyHelper = require('../../utils/proxyHelper')
const upstreamErrorHelper = require('../../utils/upstreamErrorHelper')
const {
  logRefreshStart,
  logRefreshSuccess,
  logRefreshError,
  logTokenUsage,
  logRefreshSkipped
} = require('../../utils/tokenRefreshLogger')
const tokenRefreshService = require('../tokenRefreshService')
const { createEncryptor } = require('../../utils/commonHelper')
const antigravityClient = require('../antigravityClient')

// Gemini Cuenta键前缀
const GEMINI_ACCOUNT_KEY_PREFIX = 'gemini_account:'
const SHARED_GEMINI_ACCOUNTS_KEY = 'shared_gemini_accounts'
const ACCOUNT_SESSION_MAPPING_PREFIX = 'gemini_session_account_mapping:'

// Gemini OAuth Configuración - Soportar Gemini CLI 与 Antigravity 两种 OAuth 应用
const OAUTH_PROVIDER_GEMINI_CLI = 'gemini-cli'
const OAUTH_PROVIDER_ANTIGRAVITY = 'antigravity'

const OAUTH_PROVIDERS = {
  [OAUTH_PROVIDER_GEMINI_CLI]: {
    // Gemini CLI OAuth Configuración（公开）
    clientId:
      process.env.GEMINI_OAUTH_CLIENT_ID ||
      '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com',
    clientSecret: process.env.GEMINI_OAUTH_CLIENT_SECRET || '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',
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  },
  [OAUTH_PROVIDER_ANTIGRAVITY]: {
    // Antigravity OAuth Configuración（参考 gcli2api）
    clientId:
      process.env.ANTIGRAVITY_OAUTH_CLIENT_ID ||
      '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
    clientSecret:
      process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET || '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',
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/cclog',
      'https://www.googleapis.com/auth/experimentsandconfigs'
    ]
  }
}

if (!process.env.GEMINI_OAUTH_CLIENT_SECRET) {
  logger.warn(
    '⚠️ GEMINI_OAUTH_CLIENT_SECRET 未Establecer，使用内置PredeterminadoValor（建议在生产环境通过Variable de entorno覆盖）'
  )
}
if (!process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET) {
  logger.warn(
    '⚠️ ANTIGRAVITY_OAUTH_CLIENT_SECRET 未Establecer，使用内置PredeterminadoValor（建议在生产环境通过Variable de entorno覆盖）'
  )
}

function normalizeOauthProvider(oauthProvider) {
  if (!oauthProvider) {
    return OAUTH_PROVIDER_GEMINI_CLI
  }
  return oauthProvider === OAUTH_PROVIDER_ANTIGRAVITY
    ? OAUTH_PROVIDER_ANTIGRAVITY
    : OAUTH_PROVIDER_GEMINI_CLI
}

function getOauthProviderConfig(oauthProvider) {
  const normalized = normalizeOauthProvider(oauthProvider)
  return OAUTH_PROVIDERS[normalized] || OAUTH_PROVIDERS[OAUTH_PROVIDER_GEMINI_CLI]
}

// 🌐 TCP Keep-Alive Agent Configuración
// 解决长Tiempo流式Solicitud中 NAT/防火墙空闲Tiempo de espera agotado导致的Conexión中断问题
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000, // 每30秒发送一次 keep-alive 探测
  timeout: 120000, // 120秒ConexiónTiempo de espera agotado
  maxSockets: 100, // 最大ConcurrenciaConexión数
  maxFreeSockets: 10 // 保持的空闲Conexión数
})

logger.info('🌐 Gemini HTTPS Agent initialized with TCP Keep-Alive support')

// 使用 commonHelper 的Cifrado器
const encryptor = createEncryptor('gemini-account-salt')
const { encrypt, decrypt } = encryptor

async function fetchAvailableModelsAntigravity(
  accessToken,
  proxyConfig = null,
  refreshToken = null
) {
  try {
    let effectiveToken = accessToken
    if (refreshToken) {
      try {
        const client = await getOauthClient(
          accessToken,
          refreshToken,
          proxyConfig,
          OAUTH_PROVIDER_ANTIGRAVITY
        )
        if (client && client.getAccessToken) {
          const latest = await client.getAccessToken()
          if (latest?.token) {
            effectiveToken = latest.token
          }
        }
      } catch (error) {
        logger.warn('Failed to refresh Antigravity access token for models list:', {
          message: error.message
        })
      }
    }

    const data = await antigravityClient.fetchAvailableModels({
      accessToken: effectiveToken,
      proxyConfig
    })
    const modelsDict = data?.models
    const created = Math.floor(Date.now() / 1000)

    const models = []
    const seen = new Set()
    const {
      getAntigravityModelAlias,
      getAntigravityModelMetadata,
      normalizeAntigravityModelInput
    } = require('../../utils/antigravityModel')

    const pushModel = (modelId) => {
      if (!modelId || seen.has(modelId)) {
        return
      }
      seen.add(modelId)
      const metadata = getAntigravityModelMetadata(modelId)
      const entry = {
        id: modelId,
        object: 'model',
        created,
        owned_by: 'antigravity'
      }
      if (metadata?.name) {
        entry.name = metadata.name
      }
      if (metadata?.maxCompletionTokens) {
        entry.max_completion_tokens = metadata.maxCompletionTokens
      }
      if (metadata?.thinking) {
        entry.thinking = metadata.thinking
      }
      models.push(entry)
    }

    if (modelsDict && typeof modelsDict === 'object') {
      for (const modelId of Object.keys(modelsDict)) {
        const normalized = normalizeAntigravityModelInput(modelId)
        const alias = getAntigravityModelAlias(normalized)
        if (!alias) {
          continue
        }
        pushModel(alias)

        if (alias.endsWith('-thinking')) {
          pushModel(alias.replace(/-thinking$/, ''))
        }

        if (alias.startsWith('gemini-claude-')) {
          pushModel(alias.replace(/^gemini-/, ''))
        }
      }
    }

    return models
  } catch (error) {
    logger.error('Failed to fetch Antigravity models:', error.response?.data || error.message)
    return [
      {
        id: 'gemini-2.5-flash',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'antigravity'
      }
    ]
  }
}

async function countTokensAntigravity(client, contents, model, proxyConfig = null) {
  const { token } = await client.getAccessToken()
  const response = await antigravityClient.countTokens({
    accessToken: token,
    proxyConfig,
    contents,
    model
  })
  return response
}

// 🧹 定期LimpiarCaché（每10分钟）
setInterval(
  () => {
    encryptor.clearCache()
    logger.info('🧹 Gemini decrypt cache cleanup completed', encryptor.getStats())
  },
  10 * 60 * 1000
)

// Crear OAuth2 Cliente（SoportarProxyConfiguración）
function createOAuth2Client(redirectUri = null, proxyConfig = null, oauthProvider = null) {
  // 如果没有提供 redirectUri，使用PredeterminadoValor
  const uri = redirectUri || 'http://localhost:45462'
  const oauthConfig = getOauthProviderConfig(oauthProvider)

  // 准备Cliente选项
  const clientOptions = {
    clientId: oauthConfig.clientId,
    clientSecret: oauthConfig.clientSecret,
    redirectUri: uri
  }

  // 如果有ProxyConfiguración，Establecer transporterOptions
  if (proxyConfig) {
    const proxyAgent = ProxyHelper.createProxyAgent(proxyConfig)
    if (proxyAgent) {
      // 通过 transporterOptions 传递ProxyConfiguración给底层的 Gaxios
      clientOptions.transporterOptions = {
        agent: proxyAgent,
        httpsAgent: proxyAgent
      }
      logger.debug('Created OAuth2Client with proxy configuration')
    }
  }

  return new OAuth2Client(clientOptions)
}

// Generar授权 URL (Soportar PKCE 和Proxy)
async function generateAuthUrl(
  state = null,
  redirectUri = null,
  proxyConfig = null,
  oauthProvider = null
) {
  // 使用新的 redirect URI
  const finalRedirectUri = redirectUri || 'https://codeassist.google.com/authcode'
  const normalizedProvider = normalizeOauthProvider(oauthProvider)
  const oauthConfig = getOauthProviderConfig(normalizedProvider)
  const oAuth2Client = createOAuth2Client(finalRedirectUri, proxyConfig, normalizedProvider)

  if (proxyConfig) {
    logger.info(
      `🌐 Using proxy for Gemini auth URL generation: ${ProxyHelper.getProxyDescription(proxyConfig)}`
    )
  } else {
    logger.debug('🌐 No proxy configured for Gemini auth URL generation')
  }

  // Generar PKCE code verifier
  const codeVerifier = await oAuth2Client.generateCodeVerifierAsync()
  const stateValue = state || crypto.randomBytes(32).toString('hex')

  const authUrl = oAuth2Client.generateAuthUrl({
    redirect_uri: finalRedirectUri,
    access_type: 'offline',
    scope: oauthConfig.scopes,
    code_challenge_method: 'S256',
    code_challenge: codeVerifier.codeChallenge,
    state: stateValue,
    prompt: 'select_account'
  })

  return {
    authUrl,
    state: stateValue,
    codeVerifier: codeVerifier.codeVerifier,
    redirectUri: finalRedirectUri,
    oauthProvider: normalizedProvider
  }
}

// 轮询Verificar OAuth 授权状态
async function pollAuthorizationStatus(sessionId, maxAttempts = 60, interval = 2000) {
  let attempts = 0
  const client = redisClient.getClientSafe()

  while (attempts < maxAttempts) {
    try {
      const sessionData = await client.get(`oauth_session:${sessionId}`)
      if (!sessionData) {
        throw new Error('OAuth session not found')
      }

      const session = JSON.parse(sessionData)
      if (session.code) {
        // 授权码已Obtener，交换 tokens
        const tokens = await exchangeCodeForTokens(session.code)

        // Limpiar session
        await client.del(`oauth_session:${sessionId}`)

        return {
          success: true,
          tokens
        }
      }

      if (session.error) {
        // 授权Falló
        await client.del(`oauth_session:${sessionId}`)
        return {
          success: false,
          error: session.error
        }
      }

      // 等待下一次轮询
      await new Promise((resolve) => setTimeout(resolve, interval))
      attempts++
    } catch (error) {
      logger.error('Error polling authorization status:', error)
      throw error
    }
  }

  // Tiempo de espera agotado
  await client.del(`oauth_session:${sessionId}`)
  return {
    success: false,
    error: 'Authorization timeout'
  }
}

// 交换授权码Obtener tokens (Soportar PKCE 和Proxy)
async function exchangeCodeForTokens(
  code,
  redirectUri = null,
  codeVerifier = null,
  proxyConfig = null,
  oauthProvider = null
) {
  try {
    const normalizedProvider = normalizeOauthProvider(oauthProvider)
    const oauthConfig = getOauthProviderConfig(normalizedProvider)
    // Crear带ProxyConfiguración的 OAuth2Client
    const oAuth2Client = createOAuth2Client(redirectUri, proxyConfig, normalizedProvider)

    if (proxyConfig) {
      logger.info(
        `🌐 Using proxy for Gemini token exchange: ${ProxyHelper.getProxyDescription(proxyConfig)}`
      )
    } else {
      logger.debug('🌐 No proxy configured for Gemini token exchange')
    }

    const tokenParams = {
      code,
      redirect_uri: redirectUri
    }

    // 如果提供了 codeVerifier，添加到Parámetro中
    if (codeVerifier) {
      tokenParams.codeVerifier = codeVerifier
    }

    const { tokens } = await oAuth2Client.getToken(tokenParams)

    // Convertir为兼容Formato
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope || oauthConfig.scopes.join(' '),
      token_type: tokens.token_type || 'Bearer',
      expiry_date: tokens.expiry_date || Date.now() + tokens.expires_in * 1000
    }
  } catch (error) {
    logger.error('Error exchanging code for tokens:', error)
    throw new Error('Failed to exchange authorization code')
  }
}

// 刷新访问Token
async function refreshAccessToken(refreshToken, proxyConfig = null, oauthProvider = null) {
  const normalizedProvider = normalizeOauthProvider(oauthProvider)
  const oauthConfig = getOauthProviderConfig(normalizedProvider)
  // Crear带ProxyConfiguración的 OAuth2Client
  const oAuth2Client = createOAuth2Client(null, proxyConfig, normalizedProvider)

  try {
    // Establecer refresh_token
    oAuth2Client.setCredentials({
      refresh_token: refreshToken
    })

    if (proxyConfig) {
      logger.info(
        `🔄 Using proxy for Gemini token refresh: ${ProxyHelper.maskProxyInfo(proxyConfig)}`
      )
    } else {
      logger.debug('🔄 No proxy configured for Gemini token refresh')
    }

    // 调用 refreshAccessToken Obtener新的 tokens
    const response = await oAuth2Client.refreshAccessToken()
    const { credentials } = response

    // Verificar是否ÉxitoObtener了新的 access_token
    if (!credentials || !credentials.access_token) {
      throw new Error('No access token returned from refresh')
    }

    logger.info(
      `🔄 Successfully refreshed Gemini token. New expiry: ${new Date(credentials.expiry_date).toISOString()}`
    )

    return {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || refreshToken, // 保留原 refresh_token 如果没有Retornar新的
      scope: credentials.scope || oauthConfig.scopes.join(' '),
      token_type: credentials.token_type || 'Bearer',
      expiry_date: credentials.expiry_date || Date.now() + 3600000 // Predeterminado1小时过期
    }
  } catch (error) {
    logger.error('Error refreshing access token:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      hasProxy: !!proxyConfig,
      proxy: proxyConfig ? ProxyHelper.maskProxyInfo(proxyConfig) : 'No proxy'
    })
    throw new Error(`Failed to refresh access token: ${error.message}`)
  }
}

// Crear Gemini Cuenta
async function createAccount(accountData) {
  const id = uuidv4()
  const now = new Date().toISOString()
  const oauthProvider = normalizeOauthProvider(accountData.oauthProvider)
  const oauthConfig = getOauthProviderConfig(oauthProvider)

  // Procesar凭证Datos
  let geminiOauth = null
  let accessToken = ''
  let refreshToken = ''
  let expiresAt = ''

  if (accountData.geminiOauth || accountData.accessToken) {
    // 如果提供了完整的 OAuth Datos
    if (accountData.geminiOauth) {
      geminiOauth =
        typeof accountData.geminiOauth === 'string'
          ? accountData.geminiOauth
          : JSON.stringify(accountData.geminiOauth)

      const oauthData =
        typeof accountData.geminiOauth === 'string'
          ? JSON.parse(accountData.geminiOauth)
          : accountData.geminiOauth

      accessToken = oauthData.access_token || ''
      refreshToken = oauthData.refresh_token || ''
      expiresAt = oauthData.expiry_date ? new Date(oauthData.expiry_date).toISOString() : ''
    } else {
      // 如果只提供了 access token
      ;({ accessToken } = accountData)
      refreshToken = accountData.refreshToken || ''

      // 构造完整的 OAuth Datos
      geminiOauth = JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        scope: accountData.scope || oauthConfig.scopes.join(' '),
        token_type: accountData.tokenType || 'Bearer',
        expiry_date: accountData.expiryDate || Date.now() + 3600000 // Predeterminado1小时
      })

      expiresAt = new Date(accountData.expiryDate || Date.now() + 3600000).toISOString()
    }
  }

  const account = {
    id,
    platform: 'gemini', // 标识为 Gemini Cuenta
    name: accountData.name || 'Gemini Account',
    description: accountData.description || '',
    accountType: accountData.accountType || 'shared',
    isActive: 'true',
    status: 'active',

    // 调度相关
    schedulable: accountData.schedulable !== undefined ? String(accountData.schedulable) : 'true',
    priority: accountData.priority || 50, // 调度优先级 (1-100，Número越小优先级越高)

    // OAuth 相关Campo（Cifrado存储）
    geminiOauth: geminiOauth ? encrypt(geminiOauth) : '',
    accessToken: accessToken ? encrypt(accessToken) : '',
    refreshToken: refreshToken ? encrypt(refreshToken) : '',
    expiresAt, // OAuth Token 过期Tiempo（技术Campo，自动刷新）
    // 只有OAuth方式才有scopes，手动添加的没有
    scopes: accountData.geminiOauth ? accountData.scopes || oauthConfig.scopes.join(' ') : '',
    oauthProvider,

    // ✅ Nueva característica：Cuenta订阅到期Tiempo（业务Campo，手动管理）
    subscriptionExpiresAt: accountData.subscriptionExpiresAt || null,

    // ProxyEstablecer
    proxy: accountData.proxy ? JSON.stringify(accountData.proxy) : '',

    // 项目 ID（Google Cloud/Workspace 账号需要）
    projectId: accountData.projectId || '',

    // 临时项目 ID（从 loadCodeAssist Interfaz自动Obtener）
    tempProjectId: accountData.tempProjectId || '',

    // Soportar的模型ColumnaTabla（Opcional）
    supportedModels: accountData.supportedModels || [], // 空ArregloTabla示Soportar所有模型

    // 自动防护开关
    disableAutoProtection:
      accountData.disableAutoProtection === true || accountData.disableAutoProtection === 'true'
        ? 'true'
        : 'false',

    // Tiempo戳
    createdAt: now,
    updatedAt: now,
    lastUsedAt: '',
    lastRefreshAt: ''
  }

  // 保存到 Redis
  const client = redisClient.getClientSafe()
  await client.hset(`${GEMINI_ACCOUNT_KEY_PREFIX}${id}`, account)
  await redisClient.addToIndex('gemini_account:index', id)

  // 如果是共享Cuenta，添加到共享Cuenta集合
  if (account.accountType === 'shared') {
    await client.sadd(SHARED_GEMINI_ACCOUNTS_KEY, id)
  }

  logger.info(`Created Gemini account: ${id}`)

  // Retornar时AnalizarProxyConfiguración
  const returnAccount = { ...account }
  if (returnAccount.proxy) {
    try {
      returnAccount.proxy = JSON.parse(returnAccount.proxy)
    } catch (e) {
      returnAccount.proxy = null
    }
  }

  return returnAccount
}

// ObtenerCuenta
async function getAccount(accountId) {
  const client = redisClient.getClientSafe()
  const accountData = await client.hgetall(`${GEMINI_ACCOUNT_KEY_PREFIX}${accountId}`)

  if (!accountData || Object.keys(accountData).length === 0) {
    return null
  }

  // Descifrado敏感Campo
  if (accountData.geminiOauth) {
    accountData.geminiOauth = decrypt(accountData.geminiOauth)
  }
  if (accountData.accessToken) {
    accountData.accessToken = decrypt(accountData.accessToken)
  }
  if (accountData.refreshToken) {
    accountData.refreshToken = decrypt(accountData.refreshToken)
  }

  // AnalizarProxyConfiguración
  if (accountData.proxy) {
    try {
      accountData.proxy = JSON.parse(accountData.proxy)
    } catch (e) {
      // 如果AnalizarFalló，保持原样或Establecer为null
      accountData.proxy = null
    }
  }

  // Convertir schedulable Cadena为布尔Valor（与 claudeConsoleAccountService 保持一致）
  accountData.schedulable = accountData.schedulable !== 'false' // Predeterminado为true，只有明确Establecer为'false'才为false

  return accountData
}

// ActualizarCuenta
async function updateAccount(accountId, updates) {
  const existingAccount = await getAccount(accountId)
  if (!existingAccount) {
    throw new Error('Account not found')
  }

  const now = new Date().toISOString()
  updates.updatedAt = now

  // Verificar是否Nueva característica了 refresh token
  // existingAccount.refreshToken 已经是Descifrado后的Valor了（从 getAccount Retornar）
  const oldRefreshToken = existingAccount.refreshToken || ''
  let needUpdateExpiry = false

  // ProcesarProxyEstablecer
  if (updates.proxy !== undefined) {
    updates.proxy = updates.proxy ? JSON.stringify(updates.proxy) : ''
  }

  // Procesar schedulable Campo，确保正确Convertir为Cadena存储
  if (updates.schedulable !== undefined) {
    updates.schedulable = updates.schedulable.toString()
  }

  if (updates.oauthProvider !== undefined) {
    updates.oauthProvider = normalizeOauthProvider(updates.oauthProvider)
  }

  // Cifrado敏感Campo
  if (updates.geminiOauth) {
    updates.geminiOauth = encrypt(
      typeof updates.geminiOauth === 'string'
        ? updates.geminiOauth
        : JSON.stringify(updates.geminiOauth)
    )
  }
  if (updates.accessToken) {
    updates.accessToken = encrypt(updates.accessToken)
  }
  if (updates.refreshToken) {
    updates.refreshToken = encrypt(updates.refreshToken)
    // 如果之前没有 refresh token，现在有了，标记需要Actualizar过期Tiempo
    if (!oldRefreshToken && updates.refreshToken) {
      needUpdateExpiry = true
    }
  }

  // ActualizarCuentaTipo时Procesar共享Cuenta集合
  const client = redisClient.getClientSafe()
  if (updates.accountType && updates.accountType !== existingAccount.accountType) {
    if (updates.accountType === 'shared') {
      await client.sadd(SHARED_GEMINI_ACCOUNTS_KEY, accountId)
    } else {
      await client.srem(SHARED_GEMINI_ACCOUNTS_KEY, accountId)
    }
  }

  // ✅ 关键：如果Nueva característica了 refresh token，只Actualizar token 过期Tiempo
  // 不要覆盖 subscriptionExpiresAt
  if (needUpdateExpiry) {
    const newExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    updates.expiresAt = newExpiry // 只Actualizar OAuth Token 过期Tiempo
    // ⚠️ 重要：不要修改 subscriptionExpiresAt
    logger.info(
      `🔄 New refresh token added for Gemini account ${accountId}, setting token expiry to 10 minutes`
    )
  }

  // ✅ 如果通过Ruta映射Actualizar了 subscriptionExpiresAt，直接保存
  // subscriptionExpiresAt 是业务Campo，与 token 刷新独立
  if (updates.subscriptionExpiresAt !== undefined) {
    // 直接保存，不做任何调整
  }

  // 自动防护开关
  if (updates.disableAutoProtection !== undefined) {
    updates.disableAutoProtection =
      updates.disableAutoProtection === true || updates.disableAutoProtection === 'true'
        ? 'true'
        : 'false'
  }

  // 如果通过 geminiOauth Actualizar，也要Verificar是否Nueva característica了 refresh token
  if (updates.geminiOauth && !oldRefreshToken) {
    const oauthData =
      typeof updates.geminiOauth === 'string'
        ? JSON.parse(decrypt(updates.geminiOauth))
        : updates.geminiOauth

    if (oauthData.refresh_token) {
      // 如果 expiry_date Establecer的Tiempo过长（超过1小时），调整为10分钟
      const providedExpiry = oauthData.expiry_date || 0
      const currentTime = Date.now()
      const oneHour = 60 * 60 * 1000

      if (providedExpiry - currentTime > oneHour) {
        const newExpiry = new Date(currentTime + 10 * 60 * 1000).toISOString()
        updates.expiresAt = newExpiry
        logger.info(
          `🔄 Adjusted expiry time to 10 minutes for Gemini account ${accountId} with refresh token`
        )
      }
    }
  }

  // Verificar是否手动Deshabilitar了账号，如果是则发送webhook通知
  if (updates.isActive === 'false' && existingAccount.isActive !== 'false') {
    try {
      const webhookNotifier = require('../../utils/webhookNotifier')
      await webhookNotifier.sendAccountAnomalyNotification({
        accountId,
        accountName: updates.name || existingAccount.name || 'Unknown Account',
        platform: 'gemini',
        status: 'disabled',
        errorCode: 'GEMINI_MANUALLY_DISABLED',
        reason: 'Account manually disabled by administrator'
      })
    } catch (webhookError) {
      logger.error('Failed to send webhook notification for manual account disable:', webhookError)
    }
  }

  await client.hset(`${GEMINI_ACCOUNT_KEY_PREFIX}${accountId}`, updates)

  logger.info(`Updated Gemini account: ${accountId}`)

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
  await client.del(`${GEMINI_ACCOUNT_KEY_PREFIX}${accountId}`)
  await redisClient.removeFromIndex('gemini_account:index', accountId)

  // 从共享Cuenta集合中Eliminación
  if (account.accountType === 'shared') {
    await client.srem(SHARED_GEMINI_ACCOUNTS_KEY, accountId)
  }

  // LimpiarSesión映射（使用反向Índice）
  const sessionHashes = await client.smembers(`gemini_account_sessions:${accountId}`)
  if (sessionHashes.length > 0) {
    const pipeline = client.pipeline()
    sessionHashes.forEach((hash) => pipeline.del(`${ACCOUNT_SESSION_MAPPING_PREFIX}${hash}`))
    pipeline.del(`gemini_account_sessions:${accountId}`)
    await pipeline.exec()
  }

  logger.info(`Deleted Gemini account: ${accountId}`)
  return true
}

// Obtener所有Cuenta
async function getAllAccounts() {
  const _client = redisClient.getClientSafe()
  const accountIds = await redisClient.getAllIdsByIndex(
    'gemini_account:index',
    `${GEMINI_ACCOUNT_KEY_PREFIX}*`,
    /^gemini_account:(.+)$/
  )
  const keys = accountIds.map((id) => `${GEMINI_ACCOUNT_KEY_PREFIX}${id}`)
  const accounts = []
  const dataList = await redisClient.batchHgetallChunked(keys)

  for (let i = 0; i < keys.length; i++) {
    const accountData = dataList[i]
    if (accountData && Object.keys(accountData).length > 0) {
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

      // Convertir schedulable Cadena为布尔Valor（与 getAccount 保持一致）
      accountData.schedulable = accountData.schedulable !== 'false' // Predeterminado为true，只有明确Establecer为'false'才为false

      const tokenExpiresAt = accountData.expiresAt || null
      const subscriptionExpiresAt =
        accountData.subscriptionExpiresAt && accountData.subscriptionExpiresAt !== ''
          ? accountData.subscriptionExpiresAt
          : null

      // 不Descifrado敏感Campo，只Retornar基本Información
      accounts.push({
        ...accountData,
        geminiOauth: accountData.geminiOauth ? '[ENCRYPTED]' : '',
        accessToken: accountData.accessToken ? '[ENCRYPTED]' : '',
        refreshToken: accountData.refreshToken ? '[ENCRYPTED]' : '',

        // ✅ 前端显示订阅过期Tiempo（业务Campo）
        // 注意：前端看到的 expiresAt 实际上是 subscriptionExpiresAt
        tokenExpiresAt,
        subscriptionExpiresAt,
        expiresAt: subscriptionExpiresAt,

        // 添加 scopes Campo用于判断认证方式
        // Procesar空Cadena和PredeterminadoValor的情况
        scopes:
          accountData.scopes && accountData.scopes.trim() ? accountData.scopes.split(' ') : [],
        // 添加 hasRefreshToken 标记
        hasRefreshToken: !!accountData.refreshToken,
        // 添加限流状态Información（统一Formato）
        rateLimitStatus: rateLimitInfo
          ? {
              isRateLimited: rateLimitInfo.isRateLimited,
              rateLimitedAt: rateLimitInfo.rateLimitedAt,
              minutesRemaining: rateLimitInfo.minutesRemaining
            }
          : {
              isRateLimited: false,
              rateLimitedAt: null,
              minutesRemaining: 0
            }
      })
    }
  }

  return accounts
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

  // Verificar是否绑定了 Gemini Cuenta
  if (apiKeyData.geminiAccountId) {
    const account = await getAccount(apiKeyData.geminiAccountId)
    if (account && account.isActive === 'true') {
      // Verificar token 是否过期
      const isExpired = isTokenExpired(account)

      // Registrotoken使用情况
      logTokenUsage(account.id, account.name, 'gemini', account.expiresAt, isExpired)

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
        await client.sadd(`gemini_account_sessions:${account.id}`, sessionHash)
        await client.expire(`gemini_account_sessions:${account.id}`, 3600)
      }

      return account
    }
  }

  // 从共享Cuenta池选择
  const sharedAccountIds = await client.smembers(SHARED_GEMINI_ACCOUNTS_KEY)
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
        `⏰ Skipping expired Gemini account: ${account.name}, expired at ${account.subscriptionExpiresAt}`
      )
    }
  }

  if (availableAccounts.length === 0) {
    throw new Error('No available Gemini accounts')
  }

  // 选择最少使用的Cuenta
  availableAccounts.sort((a, b) => {
    const aLastUsed = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0
    const bLastUsed = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0
    return aLastUsed - bLastUsed
  })

  const selectedAccount = availableAccounts[0]

  // Verificar并刷新 token
  const isExpired = isTokenExpired(selectedAccount)

  // Registrotoken使用情况
  logTokenUsage(
    selectedAccount.id,
    selectedAccount.name,
    'gemini',
    selectedAccount.expiresAt,
    isExpired
  )

  if (isExpired) {
    await refreshAccountToken(selectedAccount.id)
    return await getAccount(selectedAccount.id)
  }

  // Crear粘性Sesión映射
  if (sessionHash) {
    await client.setex(`${ACCOUNT_SESSION_MAPPING_PREFIX}${sessionHash}`, 3600, selectedAccount.id)
    await client.sadd(`gemini_account_sessions:${selectedAccount.id}`, sessionHash)
    await client.expire(`gemini_account_sessions:${selectedAccount.id}`, 3600)
  }

  return selectedAccount
}

// Verificar token 是否过期
function isTokenExpired(account) {
  if (!account.expiresAt) {
    return true
  }

  const expiryTime = new Date(account.expiresAt).getTime()
  const now = Date.now()
  const buffer = 10 * 1000 // 10秒缓冲

  return now >= expiryTime - buffer
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

// 刷新Cuenta token
async function refreshAccountToken(accountId) {
  let lockAcquired = false
  let account = null

  try {
    account = await getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    if (!account.refreshToken) {
      throw new Error('No refresh token available')
    }

    // 尝试Obtener分布式锁
    lockAcquired = await tokenRefreshService.acquireRefreshLock(accountId, 'gemini')

    if (!lockAcquired) {
      // 如果无法Obtener锁，说明另一个ProcesoEn progreso刷新
      logger.info(
        `🔒 Token refresh already in progress for Gemini account: ${account.name} (${accountId})`
      )
      logRefreshSkipped(accountId, account.name, 'gemini', 'already_locked')

      // 等待一段Tiempo后Retornar，期望其他Proceso已Completado刷新
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // 重新ObtenerCuentaDatos（可能已被其他Proceso刷新）
      const updatedAccount = await getAccount(accountId)
      if (updatedAccount && updatedAccount.accessToken) {
        const oauthConfig = getOauthProviderConfig(updatedAccount.oauthProvider)
        const accessToken = decrypt(updatedAccount.accessToken)
        return {
          access_token: accessToken,
          refresh_token: updatedAccount.refreshToken ? decrypt(updatedAccount.refreshToken) : '',
          expiry_date: updatedAccount.expiresAt ? new Date(updatedAccount.expiresAt).getTime() : 0,
          scope: updatedAccount.scopes || oauthConfig.scopes.join(' '),
          token_type: 'Bearer'
        }
      }

      throw new Error('Token refresh in progress by another process')
    }

    // RegistroIniciando刷新
    logRefreshStart(accountId, account.name, 'gemini', 'manual_refresh')
    logger.info(`🔄 Starting token refresh for Gemini account: ${account.name} (${accountId})`)

    // account.refreshToken 已经是Descifrado后的Valor（从 getAccount Retornar）
    // 传入Cuenta的ProxyConfiguración
    const newTokens = await refreshAccessToken(
      account.refreshToken,
      account.proxy,
      account.oauthProvider
    )

    // ActualizarCuentaInformación
    const updates = {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || account.refreshToken,
      expiresAt: new Date(newTokens.expiry_date).toISOString(),
      lastRefreshAt: new Date().toISOString(),
      geminiOauth: JSON.stringify(newTokens),
      status: 'active', // 刷新Éxito后，将状态Actualizar为 active
      errorMessage: '' // 清空ErrorInformación
    }

    await updateAccount(accountId, updates)

    // Registro刷新Éxito
    logRefreshSuccess(accountId, account.name, 'gemini', {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      expiresAt: newTokens.expiry_date,
      scopes: newTokens.scope
    })

    logger.info(
      `Refreshed token for Gemini account: ${accountId} - Access Token: ${maskToken(newTokens.access_token)}`
    )

    return newTokens
  } catch (error) {
    // Registro刷新Falló
    logRefreshError(accountId, account ? account.name : 'Unknown', 'gemini', error)

    logger.error(`Failed to refresh token for account ${accountId}:`, error)

    // 标记Cuenta为Error状态（只有在Cuenta存在时）
    if (account) {
      try {
        await updateAccount(accountId, {
          status: 'error',
          errorMessage: error.message
        })

        // 发送Webhook通知
        try {
          const webhookNotifier = require('../../utils/webhookNotifier')
          await webhookNotifier.sendAccountAnomalyNotification({
            accountId,
            accountName: account.name,
            platform: 'gemini',
            status: 'error',
            errorCode: 'GEMINI_ERROR',
            reason: `Token refresh failed: ${error.message}`
          })
        } catch (webhookError) {
          logger.error('Failed to send webhook notification:', webhookError)
        }
      } catch (updateError) {
        logger.error('Failed to update account status after refresh error:', updateError)
      }
    }

    throw error
  } finally {
    // 释放锁
    if (lockAcquired) {
      await tokenRefreshService.releaseRefreshLock(accountId, 'gemini')
    }
  }
}

// 标记Cuenta被使用
async function markAccountUsed(accountId) {
  await updateAccount(accountId, {
    lastUsedAt: new Date().toISOString()
  })
}

// EstablecerCuenta限流状态
async function setAccountRateLimited(accountId, isLimited = true) {
  const updates = isLimited
    ? {
        rateLimitStatus: 'limited',
        rateLimitedAt: new Date().toISOString()
      }
    : {
        rateLimitStatus: '',
        rateLimitedAt: ''
      }

  await updateAccount(accountId, updates)
}

// ObtenerCuenta的限流Información（参考 claudeAccountService 的实现）
async function getAccountRateLimitInfo(accountId) {
  try {
    const account = await getAccount(accountId)
    if (!account) {
      return null
    }

    if (account.rateLimitStatus === 'limited' && account.rateLimitedAt) {
      const rateLimitedAt = new Date(account.rateLimitedAt)
      const now = new Date()
      const minutesSinceRateLimit = Math.floor((now - rateLimitedAt) / (1000 * 60))

      // Gemini 限流持续Tiempo为 1 小时
      const minutesRemaining = Math.max(0, 60 - minutesSinceRateLimit)
      const rateLimitEndAt = new Date(rateLimitedAt.getTime() + 60 * 60 * 1000).toISOString()

      return {
        isRateLimited: minutesRemaining > 0,
        rateLimitedAt: account.rateLimitedAt,
        minutesSinceRateLimit,
        minutesRemaining,
        rateLimitEndAt
      }
    }

    return {
      isRateLimited: false,
      rateLimitedAt: null,
      minutesSinceRateLimit: 0,
      minutesRemaining: 0,
      rateLimitEndAt: null
    }
  } catch (error) {
    logger.error(`❌ Failed to get rate limit info for Gemini account: ${accountId}`, error)
    return null
  }
}

// ObtenerConfiguración的OAuthCliente - 参考GeminiCliSimulator的getOauthClientMétodo（SoportarProxy）
async function getOauthClient(accessToken, refreshToken, proxyConfig = null, oauthProvider = null) {
  const normalizedProvider = normalizeOauthProvider(oauthProvider)
  const oauthConfig = getOauthProviderConfig(normalizedProvider)
  const client = createOAuth2Client(null, proxyConfig, normalizedProvider)

  const creds = {
    access_token: accessToken,
    refresh_token: refreshToken,
    scope: oauthConfig.scopes.join(' '),
    token_type: 'Bearer',
    expiry_date: 1754269905646
  }

  if (proxyConfig) {
    logger.info(
      `🌐 Using proxy for Gemini OAuth client: ${ProxyHelper.getProxyDescription(proxyConfig)}`
    )
  } else {
    logger.debug('🌐 No proxy configured for Gemini OAuth client')
  }

  // Establecer凭据
  client.setCredentials(creds)

  // Validar凭据本地有效性
  const { token } = await client.getAccessToken()

  if (!token) {
    return false
  }

  // ValidarServicio器端token状态（Verificar是否被撤销）
  await client.getTokenInfo(token)

  logger.info('✅ OAuthCliente已Crear')
  return client
}

// 通用的 Code Assist API 转发Función（用于简单的Solicitud/RespuestaEndpoint）
// 适用于：loadCodeAssist, onboardUser, countTokens, listExperiments 等不需要特殊Procesar的Endpoint
async function forwardToCodeAssist(client, apiMethod, requestBody, proxyConfig = null) {
  const axios = require('axios')
  const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com'
  const CODE_ASSIST_API_VERSION = 'v1internal'

  const { token } = await client.getAccessToken()
  const proxyAgent = ProxyHelper.createProxyAgent(proxyConfig)

  logger.info(`📡 ${apiMethod} API调用Iniciando`)

  const axiosConfig = {
    url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${apiMethod}`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data: requestBody,
    timeout: 30000
  }

  // 添加ProxyConfiguración
  if (proxyAgent) {
    // 只Establecer httpsAgent，因为目标 URL 是 HTTPS (cloudcode-pa.googleapis.com)
    axiosConfig.httpsAgent = proxyAgent
    axiosConfig.proxy = false
    logger.info(`🌐 Using proxy for ${apiMethod}: ${ProxyHelper.getProxyDescription(proxyConfig)}`)
  } else {
    logger.debug(`🌐 No proxy configured for ${apiMethod}`)
  }

  const response = await axios(axiosConfig)

  logger.info(`✅ ${apiMethod} API调用Éxito`)
  return response.data
}

// 调用 Google Code Assist API 的 loadCodeAssist Método（SoportarProxy）
async function loadCodeAssist(client, projectId = null, proxyConfig = null) {
  const axios = require('axios')
  const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com'
  const CODE_ASSIST_API_VERSION = 'v1internal'

  const { token } = await client.getAccessToken()
  const proxyAgent = ProxyHelper.createProxyAgent(proxyConfig)
  // 🔍 只有个人Cuenta（无 projectId）才需要调用 tokeninfo/userinfo
  // 这些调用有助于 Google Obtener临时 projectId
  if (!projectId) {
    const tokenInfoConfig = {
      url: 'https://oauth2.googleapis.com/tokeninfo',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({ access_token: token }).toString(),
      timeout: 15000
    }

    if (proxyAgent) {
      tokenInfoConfig.httpAgent = proxyAgent
      tokenInfoConfig.httpsAgent = proxyAgent
      tokenInfoConfig.proxy = false
    }

    try {
      await axios(tokenInfoConfig)
      logger.info('📋 tokeninfo InterfazValidarÉxito')
    } catch (error) {
      logger.warn('⚠️ tokeninfo Interfaz调用Falló:', error.message)
    }

    const userInfoConfig = {
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: '*/*'
      },
      timeout: 15000
    }

    if (proxyAgent) {
      userInfoConfig.httpAgent = proxyAgent
      userInfoConfig.httpsAgent = proxyAgent
      userInfoConfig.proxy = false
    }

    try {
      await axios(userInfoConfig)
      logger.info('📋 userinfo InterfazObtenerÉxito')
    } catch (error) {
      logger.warn('⚠️ userinfo Interfaz调用Falló:', error.message)
    }
  }

  // CrearClientMetadata
  const clientMetadata = {
    ideType: 'IDE_UNSPECIFIED',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI'
  }

  // 只有当projectId存在时才添加duetProject
  if (projectId) {
    clientMetadata.duetProject = projectId
  }

  const request = {
    metadata: clientMetadata
  }

  // 只有当projectId存在时才添加cloudaicompanionProject
  if (projectId) {
    request.cloudaicompanionProject = projectId
  }

  const axiosConfig = {
    url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:loadCodeAssist`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data: request,
    timeout: 30000
  }

  // 添加ProxyConfiguración
  if (proxyAgent) {
    // 只Establecer httpsAgent，因为目标 URL 是 HTTPS (cloudcode-pa.googleapis.com)
    axiosConfig.httpsAgent = proxyAgent
    axiosConfig.proxy = false
    logger.info(
      `🌐 Using proxy for Gemini loadCodeAssist: ${ProxyHelper.getProxyDescription(proxyConfig)}`
    )
  } else {
    logger.debug('🌐 No proxy configured for Gemini loadCodeAssist')
  }

  const response = await axios(axiosConfig)

  logger.info('📋 loadCodeAssist API调用Éxito')
  return response.data
}

// Obteneronboard层级 - 参考GeminiCliSimulator的getOnboardTierMétodo
function getOnboardTier(loadRes) {
  // Usuario层级枚举
  const UserTierId = {
    LEGACY: 'LEGACY',
    FREE: 'FREE',
    PRO: 'PRO'
  }

  if (loadRes.currentTier) {
    return loadRes.currentTier
  }

  for (const tier of loadRes.allowedTiers || []) {
    if (tier.isDefault) {
      return tier
    }
  }

  return {
    name: '',
    description: '',
    id: UserTierId.LEGACY,
    userDefinedCloudaicompanionProject: true
  }
}

// 调用 Google Code Assist API 的 onboardUser Método（Incluir轮询逻辑，SoportarProxy）
async function onboardUser(client, tierId, projectId, clientMetadata, proxyConfig = null) {
  const axios = require('axios')
  const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com'
  const CODE_ASSIST_API_VERSION = 'v1internal'

  const { token } = await client.getAccessToken()

  const onboardReq = {
    tierId,
    metadata: clientMetadata
  }

  // 只有当projectId存在时才添加cloudaicompanionProject
  if (projectId) {
    onboardReq.cloudaicompanionProject = projectId
  }

  // Crear基础axiosConfiguración
  const baseAxiosConfig = {
    url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:onboardUser`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data: onboardReq,
    timeout: 30000
  }

  // 添加ProxyConfiguración
  const proxyAgent = ProxyHelper.createProxyAgent(proxyConfig)
  if (proxyAgent) {
    baseAxiosConfig.httpAgent = proxyAgent
    baseAxiosConfig.httpsAgent = proxyAgent
    baseAxiosConfig.proxy = false
    logger.info(
      `🌐 Using proxy for Gemini onboardUser: ${ProxyHelper.getProxyDescription(proxyConfig)}`
    )
  } else {
    logger.debug('🌐 No proxy configured for Gemini onboardUser')
  }

  logger.info('📋 IniciandoonboardUser API调用', {
    tierId,
    projectId,
    hasProjectId: !!projectId,
    isFreeTier: tierId === 'free-tier' || tierId === 'FREE'
  })

  // 轮询onboardUser直到长运FilaOperaciónCompletado
  let lroRes = await axios(baseAxiosConfig)

  let attempts = 0
  const maxAttempts = 12 // 最多等待1分钟（5秒 * 12次）

  while (!lroRes.data.done && attempts < maxAttempts) {
    logger.info(`⏳ 等待onboardUserCompletado... (${attempts + 1}/${maxAttempts})`)
    await new Promise((resolve) => setTimeout(resolve, 5000))

    lroRes = await axios(baseAxiosConfig)
    attempts++
  }

  if (!lroRes.data.done) {
    throw new Error('onboardUserOperaciónTiempo de espera agotado')
  }

  logger.info('✅ onboardUser API调用Completado')
  return lroRes.data
}

// 完整的UsuarioEstablecer流程 - 参考setup.ts的逻辑（SoportarProxy）
async function setupUser(
  client,
  initialProjectId = null,
  clientMetadata = null,
  proxyConfig = null
) {
  logger.info('🚀 setupUser Iniciando', { initialProjectId, hasClientMetadata: !!clientMetadata })

  let projectId = initialProjectId || process.env.GOOGLE_CLOUD_PROJECT || null
  logger.info('📋 初始项目ID', { projectId, fromEnv: !!process.env.GOOGLE_CLOUD_PROJECT })

  // Predeterminado的ClientMetadata
  if (!clientMetadata) {
    clientMetadata = {
      ideType: 'IDE_UNSPECIFIED',
      platform: 'PLATFORM_UNSPECIFIED',
      pluginType: 'GEMINI',
      duetProject: projectId
    }
    logger.info('🔧 使用Predeterminado ClientMetadata')
  }

  // 调用loadCodeAssist
  logger.info('📞 调用 loadCodeAssist...')
  const loadRes = await loadCodeAssist(client, projectId, proxyConfig)
  logger.info('✅ loadCodeAssist Completado', {
    hasCloudaicompanionProject: !!loadRes.cloudaicompanionProject
  })

  // 如果没有projectId，尝试从loadResObtener
  if (!projectId && loadRes.cloudaicompanionProject) {
    projectId = loadRes.cloudaicompanionProject
    logger.info('📋 从 loadCodeAssist Obtener项目ID', { projectId })
  }

  const tier = getOnboardTier(loadRes)
  logger.info('🎯 ObtenerUsuario层级', {
    tierId: tier.id,
    userDefinedProject: tier.userDefinedCloudaicompanionProject
  })

  if (tier.userDefinedCloudaiCompanionProject && !projectId) {
    throw new Error('此账号需要EstablecerGOOGLE_CLOUD_PROJECTVariable de entorno或提供projectId')
  }

  // 调用onboardUser
  logger.info('📞 调用 onboardUser...', { tierId: tier.id, projectId })
  const lroRes = await onboardUser(client, tier.id, projectId, clientMetadata, proxyConfig)
  logger.info('✅ onboardUser Completado', { hasDone: !!lroRes.done, hasResponse: !!lroRes.response })

  const result = {
    projectId: lroRes.response?.cloudaicompanionProject?.id || projectId || '',
    userTier: tier.id,
    loadRes,
    onboardRes: lroRes.response || {}
  }

  logger.info('🎯 setupUser Completado', { resultProjectId: result.projectId, userTier: result.userTier })
  return result
}

// 调用 Code Assist API Calcular token 数量（SoportarProxy）
async function countTokens(client, contents, model = 'gemini-2.0-flash-exp', proxyConfig = null) {
  const axios = require('axios')
  const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com'
  const CODE_ASSIST_API_VERSION = 'v1internal'

  const { token } = await client.getAccessToken()

  // 按照 gemini-cli 的ConvertirFormato构造Solicitud
  const request = {
    request: {
      model: `models/${model}`,
      contents
    }
  }

  logger.info('📊 countTokens API调用Iniciando', { model, contentsLength: contents.length })

  const axiosConfig = {
    url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:countTokens`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data: request,
    timeout: 30000
  }

  // 添加ProxyConfiguración
  const proxyAgent = ProxyHelper.createProxyAgent(proxyConfig)
  if (proxyAgent) {
    // 只Establecer httpsAgent，因为目标 URL 是 HTTPS (cloudcode-pa.googleapis.com)
    axiosConfig.httpsAgent = proxyAgent
    axiosConfig.proxy = false
    logger.info(
      `🌐 Using proxy for Gemini countTokens: ${ProxyHelper.getProxyDescription(proxyConfig)}`
    )
  } else {
    logger.debug('🌐 No proxy configured for Gemini countTokens')
  }

  const response = await axios(axiosConfig)

  logger.info('✅ countTokens API调用Éxito', { totalTokens: response.data.totalTokens })
  return response.data
}

// 调用 Code Assist API Generar内容（非流式）
async function generateContent(
  client,
  requestData,
  userPromptId,
  projectId = null,
  sessionId = null,
  proxyConfig = null
) {
  const axios = require('axios')
  const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com'
  const CODE_ASSIST_API_VERSION = 'v1internal'

  const { token } = await client.getAccessToken()

  // 按照 gemini-cli 的ConvertirFormato构造Solicitud
  const request = {
    model: requestData.model,
    request: {
      ...requestData.request,
      session_id: sessionId
    }
  }

  // 只有当 userPromptId 存在时才添加
  if (userPromptId) {
    request.user_prompt_id = userPromptId
  }

  // 只有当projectId存在时才添加projectCampo
  if (projectId) {
    request.project = projectId
  }

  logger.info('🤖 generateContent API调用Iniciando', {
    model: requestData.model,
    userPromptId,
    projectId,
    sessionId
  })

  // 添加详细的SolicitudRegistro
  logger.info('📦 generateContent Solicitud详情', {
    url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:generateContent`,
    requestBody: JSON.stringify(request, null, 2)
  })

  const axiosConfig = {
    url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:generateContent`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data: request,
    timeout: 600000 // Generar内容可能需要更长Tiempo
  }

  // 添加ProxyConfiguración
  const proxyAgent = ProxyHelper.createProxyAgent(proxyConfig)
  if (proxyAgent) {
    // 只Establecer httpsAgent，因为目标 URL 是 HTTPS (cloudcode-pa.googleapis.com)
    axiosConfig.httpsAgent = proxyAgent
    axiosConfig.proxy = false
    logger.info(
      `🌐 Using proxy for Gemini generateContent: ${ProxyHelper.getProxyDescription(proxyConfig)}`
    )
  } else {
    // 没有Proxy时，使用 keepAlive agent 防止长TiempoSolicitud被中断
    axiosConfig.httpsAgent = keepAliveAgent
    logger.debug('🌐 Using keepAlive agent for Gemini generateContent')
  }

  const response = await axios(axiosConfig)

  logger.info('✅ generateContent API调用Éxito')
  return response.data
}

// 调用 Antigravity 上游Generar内容（非流式）
async function generateContentAntigravity(
  client,
  requestData,
  userPromptId,
  projectId = null,
  sessionId = null,
  proxyConfig = null
) {
  const { token } = await client.getAccessToken()
  const { model } = antigravityClient.buildAntigravityEnvelope({
    requestData,
    projectId,
    sessionId,
    userPromptId
  })

  logger.info('🪐 Antigravity generateContent API调用Iniciando', {
    model,
    userPromptId,
    projectId,
    sessionId
  })

  const { response } = await antigravityClient.request({
    accessToken: token,
    proxyConfig,
    requestData,
    projectId,
    sessionId,
    userPromptId,
    stream: false
  })
  logger.info('✅ Antigravity generateContent API调用Éxito')
  return response.data
}

// 调用 Code Assist API Generar内容（流式）
async function generateContentStream(
  client,
  requestData,
  userPromptId,
  projectId = null,
  sessionId = null,
  signal = null,
  proxyConfig = null
) {
  const axios = require('axios')
  const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com'
  const CODE_ASSIST_API_VERSION = 'v1internal'

  const { token } = await client.getAccessToken()

  // 按照 gemini-cli 的ConvertirFormato构造Solicitud
  const request = {
    model: requestData.model,
    request: {
      ...requestData.request,
      session_id: sessionId
    }
  }

  // 只有当 userPromptId 存在时才添加
  if (userPromptId) {
    request.user_prompt_id = userPromptId
  }

  // 只有当projectId存在时才添加projectCampo
  if (projectId) {
    request.project = projectId
  }

  logger.info('🌊 streamGenerateContent API调用Iniciando', {
    model: requestData.model,
    userPromptId,
    projectId,
    sessionId
  })

  const axiosConfig = {
    url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:streamGenerateContent`,
    method: 'POST',
    params: {
      alt: 'sse'
    },
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data: request,
    responseType: 'stream',
    timeout: 0 // 流式Solicitud不EstablecerTiempo de espera agotadoLímite，由 keepAlive 和 AbortSignal 控制
  }

  // 添加ProxyConfiguración
  const proxyAgent = ProxyHelper.createProxyAgent(proxyConfig)
  if (proxyAgent) {
    // 只Establecer httpsAgent，因为目标 URL 是 HTTPS (cloudcode-pa.googleapis.com)
    // 同时Establecer httpAgent 和 httpsAgent 可能导致 axios/follow-redirects 选择Error的Protocolo
    axiosConfig.httpsAgent = proxyAgent
    axiosConfig.proxy = false
    logger.info(
      `🌐 Using proxy for Gemini streamGenerateContent: ${ProxyHelper.getProxyDescription(proxyConfig)}`
    )
  } else {
    // 没有Proxy时，使用 keepAlive agent 防止长Tiempo流式Solicitud被中断
    axiosConfig.httpsAgent = keepAliveAgent
    logger.debug('🌐 Using keepAlive agent for Gemini streamGenerateContent')
  }

  // 如果提供了中止信号，添加到Configuración中
  if (signal) {
    axiosConfig.signal = signal
  }

  const response = await axios(axiosConfig)

  logger.info('✅ streamGenerateContent API调用Éxito，Iniciando流式传输')
  return response.data // Retornar流Objeto
}

// 调用 Antigravity 上游Generar内容（流式）
async function generateContentStreamAntigravity(
  client,
  requestData,
  userPromptId,
  projectId = null,
  sessionId = null,
  signal = null,
  proxyConfig = null
) {
  const { token } = await client.getAccessToken()
  const { model } = antigravityClient.buildAntigravityEnvelope({
    requestData,
    projectId,
    sessionId,
    userPromptId
  })

  logger.info('🌊 Antigravity streamGenerateContent API调用Iniciando', {
    model,
    userPromptId,
    projectId,
    sessionId
  })

  const { response } = await antigravityClient.request({
    accessToken: token,
    proxyConfig,
    requestData,
    projectId,
    sessionId,
    userPromptId,
    stream: true,
    signal,
    params: { alt: 'sse' }
  })
  logger.info('✅ Antigravity streamGenerateContent API调用Éxito，Iniciando流式传输')
  return response.data
}

// ActualizarCuenta的临时项目 ID
async function updateTempProjectId(accountId, tempProjectId) {
  if (!tempProjectId) {
    return
  }

  try {
    const account = await getAccount(accountId)
    if (!account) {
      logger.warn(`Account ${accountId} not found when updating tempProjectId`)
      return
    }

    // 只有在没有固定项目 ID 的情况下才Actualizar临时项目 ID
    if (!account.projectId && tempProjectId !== account.tempProjectId) {
      await updateAccount(accountId, { tempProjectId })
      logger.info(`Updated tempProjectId for account ${accountId}: ${tempProjectId}`)
    }
  } catch (error) {
    logger.error(`Failed to update tempProjectId for account ${accountId}:`, error)
  }
}

// 重置Cuenta状态（清除所有异常状态）
async function resetAccountStatus(accountId) {
  const account = await getAccount(accountId)
  if (!account) {
    throw new Error('Account not found')
  }

  const updates = {
    // 根据是否有有效的 refreshToken 来Establecer status
    status: account.refreshToken ? 'active' : 'created',
    // Restauración可调度状态
    schedulable: 'true',
    // 清除Error相关Campo
    errorMessage: '',
    rateLimitedAt: '',
    rateLimitStatus: ''
  }

  await updateAccount(accountId, updates)
  logger.info(`✅ Reset all error status for Gemini account ${accountId}`)

  // 清除临时不可用状态
  await upstreamErrorHelper.clearTempUnavailable(accountId, 'gemini').catch(() => {})

  // 发送 Webhook 通知
  try {
    const webhookNotifier = require('../../utils/webhookNotifier')
    await webhookNotifier.sendAccountAnomalyNotification({
      accountId,
      accountName: account.name || accountId,
      platform: 'gemini',
      status: 'recovered',
      errorCode: 'STATUS_RESET',
      reason: 'Account status manually reset',
      timestamp: new Date().toISOString()
    })
    logger.info(`📢 Webhook notification sent for Gemini account ${account.name} status reset`)
  } catch (webhookError) {
    logger.error('Failed to send status reset webhook notification:', webhookError)
  }

  return {
    success: true,
    message: 'Account status reset successfully'
  }
}

module.exports = {
  generateAuthUrl,
  pollAuthorizationStatus,
  exchangeCodeForTokens,
  refreshAccessToken,
  createAccount,
  getAccount,
  updateAccount,
  deleteAccount,
  getAllAccounts,
  selectAvailableAccount,
  refreshAccountToken,
  markAccountUsed,
  setAccountRateLimited,
  getAccountRateLimitInfo,
  isTokenExpired,
  getOauthClient,
  forwardToCodeAssist, // 通用转发Función
  loadCodeAssist,
  getOnboardTier,
  onboardUser,
  setupUser,
  encrypt,
  decrypt,
  encryptor, // 暴露Cifrado器以便Probar和Monitorear
  countTokens,
  countTokensAntigravity,
  generateContent,
  generateContentStream,
  generateContentAntigravity,
  generateContentStreamAntigravity,
  fetchAvailableModelsAntigravity,
  updateTempProjectId,
  resetAccountStatus
}
