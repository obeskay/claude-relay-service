/**
 * OAuth助手工具
 * 基于claude-code-login.js中的OAuth流程实现
 */

const crypto = require('crypto')
const ProxyHelper = require('./proxyHelper')
const axios = require('axios')
const logger = require('./logger')

// OAuth Configuración常量 - 从claude-code-login.js提取
const OAUTH_CONFIG = {
  AUTHORIZE_URL: 'https://claude.ai/oauth/authorize',
  TOKEN_URL: 'https://console.anthropic.com/v1/oauth/token',
  CLIENT_ID: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
  REDIRECT_URI: 'https://platform.claude.com/oauth/code/callback',
  SCOPES: 'org:create_api_key user:profile user:inference user:sessions:claude_code',
  SCOPES_SETUP: 'user:inference' // Setup Token 只需要推理Permiso
}

// Cookie自动授权Configuración常量
const COOKIE_OAUTH_CONFIG = {
  CLAUDE_AI_URL: 'https://claude.ai',
  ORGANIZATIONS_URL: 'https://claude.ai/api/organizations',
  AUTHORIZE_URL_TEMPLATE: 'https://claude.ai/v1/oauth/{organization_uuid}/authorize'
}

/**
 * Generar随机的 state Parámetro
 * @returns {string} 随机Generar的 state (base64urlCodificación)
 */
function generateState() {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Generar随机的 code verifier（PKCE）
 * 符合 RFC 7636 标准：32字节随机数 → base64urlCodificación → 43字符
 * @returns {string} base64url Codificación的随机Cadena
 */
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Generar code challenge（PKCE）
 * @param {string} codeVerifier - code verifier Cadena
 * @returns {string} SHA256 哈希后的 base64url CodificaciónCadena
 */
function generateCodeChallenge(codeVerifier) {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url')
}

/**
 * Generar授权 URL
 * @param {string} codeChallenge - PKCE code challenge
 * @param {string} state - state Parámetro
 * @returns {string} 完整的授权 URL
 */
function generateAuthUrl(codeChallenge, state) {
  const params = new URLSearchParams({
    code: 'true',
    client_id: OAUTH_CONFIG.CLIENT_ID,
    response_type: 'code',
    redirect_uri: OAUTH_CONFIG.REDIRECT_URI,
    scope: OAUTH_CONFIG.SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state
  })

  return `${OAUTH_CONFIG.AUTHORIZE_URL}?${params.toString()}`
}

/**
 * GenerarOAuth授权URL和相关Parámetro
 * @returns {{authUrl: string, codeVerifier: string, state: string, codeChallenge: string}}
 */
function generateOAuthParams() {
  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  const authUrl = generateAuthUrl(codeChallenge, state)

  return {
    authUrl,
    codeVerifier,
    state,
    codeChallenge
  }
}

/**
 * Generar Setup Token 授权 URL
 * @param {string} codeChallenge - PKCE code challenge
 * @param {string} state - state Parámetro
 * @returns {string} 完整的授权 URL
 */
function generateSetupTokenAuthUrl(codeChallenge, state) {
  const params = new URLSearchParams({
    code: 'true',
    client_id: OAUTH_CONFIG.CLIENT_ID,
    response_type: 'code',
    redirect_uri: OAUTH_CONFIG.REDIRECT_URI,
    scope: OAUTH_CONFIG.SCOPES_SETUP,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state
  })

  return `${OAUTH_CONFIG.AUTHORIZE_URL}?${params.toString()}`
}

/**
 * GenerarSetup Token授权URL和相关Parámetro
 * @returns {{authUrl: string, codeVerifier: string, state: string, codeChallenge: string}}
 */
function generateSetupTokenParams() {
  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  const authUrl = generateSetupTokenAuthUrl(codeChallenge, state)

  return {
    authUrl,
    codeVerifier,
    state,
    codeChallenge
  }
}

/**
 * CrearProxyagent（使用统一的Proxy工具）
 * @param {object|null} proxyConfig - ProxyConfiguraciónObjeto
 * @returns {object|null} Proxyagent或null
 */
function createProxyAgent(proxyConfig) {
  return ProxyHelper.createProxyAgent(proxyConfig)
}

/**
 * 使用授权码交换访问Token
 * @param {string} authorizationCode - 授权码
 * @param {string} codeVerifier - PKCE code verifier
 * @param {string} state - state Parámetro
 * @param {object|null} proxyConfig - ProxyConfiguración（Opcional）
 * @returns {Promise<object>} ClaudeFormato的tokenRespuesta
 */
async function exchangeCodeForTokens(authorizationCode, codeVerifier, state, proxyConfig = null) {
  // Limpiar授权码，EliminaciónURL片段
  const cleanedCode = authorizationCode.split('#')[0]?.split('&')[0] ?? authorizationCode

  const params = {
    grant_type: 'authorization_code',
    client_id: OAUTH_CONFIG.CLIENT_ID,
    code: cleanedCode,
    redirect_uri: OAUTH_CONFIG.REDIRECT_URI,
    code_verifier: codeVerifier,
    state
  }

  // CrearProxyagent
  const agent = createProxyAgent(proxyConfig)

  try {
    if (agent) {
      logger.info(
        `🌐 Using proxy for OAuth token exchange: ${ProxyHelper.maskProxyInfo(proxyConfig)}`
      )
    } else {
      logger.debug('🌐 No proxy configured for OAuth token exchange')
    }

    logger.debug('🔄 Attempting OAuth token exchange', {
      url: OAUTH_CONFIG.TOKEN_URL,
      codeLength: cleanedCode.length,
      codePrefix: `${cleanedCode.substring(0, 10)}...`,
      hasProxy: !!proxyConfig,
      proxyType: proxyConfig?.type || 'none'
    })

    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'claude-cli/1.0.56 (external, cli)',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://claude.ai/',
        Origin: 'https://claude.ai'
      },
      timeout: 30000
    }

    if (agent) {
      axiosConfig.httpAgent = agent
      axiosConfig.httpsAgent = agent
      axiosConfig.proxy = false
    }

    const response = await axios.post(OAUTH_CONFIG.TOKEN_URL, params, axiosConfig)

    // Registro完整的RespuestaDatos到专门的认证详细Registro
    logger.authDetail('OAuth token exchange response', response.data)

    // Registro简化Versión到主Registro
    logger.info('📊 OAuth token exchange response (analyzing for subscription info):', {
      status: response.status,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : []
    })

    logger.success('OAuth token exchange successful', {
      status: response.status,
      hasAccessToken: !!response.data?.access_token,
      hasRefreshToken: !!response.data?.refresh_token,
      scopes: response.data?.scope,
      // 尝试提取可能的套餐InformaciónCampo
      subscription: response.data?.subscription,
      plan: response.data?.plan,
      tier: response.data?.tier,
      accountType: response.data?.account_type,
      features: response.data?.features,
      limits: response.data?.limits
    })

    const { data } = response

    // Analizar组织与CuentaInformación
    const organizationInfo = data.organization || null
    const accountInfo = data.account || null
    const extInfo = extractExtInfo(data)

    // RetornarClaudeFormato的tokenDatos，Incluir可能的套餐Información
    const result = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: (Math.floor(Date.now() / 1000) + data.expires_in) * 1000,
      scopes: data.scope ? data.scope.split(' ') : ['user:inference', 'user:profile'],
      isMax: true,
      organization: organizationInfo,
      account: accountInfo,
      extInfo
    }

    // 如果Respuesta中Incluir套餐Información，添加到Retornar结果中
    if (data.subscription || data.plan || data.tier || data.account_type) {
      result.subscriptionInfo = {
        subscription: data.subscription,
        plan: data.plan,
        tier: data.tier,
        accountType: data.account_type,
        features: data.features,
        limits: data.limits
      }
      logger.info('🎯 Found subscription info in OAuth response:', result.subscriptionInfo)
    }

    return result
  } catch (error) {
    // ProcesaraxiosErrorRespuesta
    if (error.response) {
      // Servicio器Retornar了Error状态码
      const { status } = error.response
      const errorData = error.response.data

      logger.error('❌ OAuth token exchange failed with server error', {
        status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: errorData,
        codeLength: cleanedCode.length,
        codePrefix: `${cleanedCode.substring(0, 10)}...`
      })

      // 尝试从ErrorRespuesta中提取有用Información
      let errorMessage = `HTTP ${status}`

      if (errorData) {
        if (typeof errorData === 'string') {
          errorMessage += `: ${errorData}`
        } else if (errorData.error) {
          errorMessage += `: ${errorData.error}`
          if (errorData.error_description) {
            errorMessage += ` - ${errorData.error_description}`
          }
        } else {
          errorMessage += `: ${JSON.stringify(errorData)}`
        }
      }

      throw new Error(`Token exchange failed: ${errorMessage}`)
    } else if (error.request) {
      // Solicitud被发送但没有收到Respuesta
      logger.error('❌ OAuth token exchange failed with network error', {
        message: error.message,
        code: error.code,
        hasProxy: !!proxyConfig
      })
      throw new Error('Token exchange failed: No response from server (network error or timeout)')
    } else {
      // 其他Error
      logger.error('❌ OAuth token exchange failed with unknown error', {
        message: error.message,
        stack: error.stack
      })
      throw new Error(`Token exchange failed: ${error.message}`)
    }
  }
}

/**
 * Analizar回调 URL 或授权码
 * @param {string} input - 完整的回调 URL 或直接的授权码
 * @returns {string} 授权码
 */
function parseCallbackUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('请提供有效的授权码或回调 URL')
  }

  const trimmedInput = input.trim()

  // 情况1: 尝试作为完整URLAnalizar
  if (trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://')) {
    try {
      const urlObj = new URL(trimmedInput)
      const authorizationCode = urlObj.searchParams.get('code')

      if (!authorizationCode) {
        throw new Error('回调 URL 中未找到授权码 (code Parámetro)')
      }

      return authorizationCode
    } catch (error) {
      if (error.message.includes('回调 URL 中未找到授权码')) {
        throw error
      }
      throw new Error('无效的 URL Formato，请Verificar回调 URL 是否正确')
    }
  }

  // 情况2: 直接的授权码（可能IncluirURL fragments）
  // 参考claude-code-login.js的Procesar方式：EliminaciónURL fragments和Parámetro
  const cleanedCode = trimmedInput.split('#')[0]?.split('&')[0] ?? trimmedInput

  // Validar授权码Formato（Claude的授权码通常是base64urlFormato）
  if (!cleanedCode || cleanedCode.length < 10) {
    throw new Error('授权码Formato无效，请确保复制了完整的 Authorization Code')
  }

  // 基本FormatoValidar：授权码应该只Incluir字母、Número、下划线、连字符
  const validCodePattern = /^[A-Za-z0-9_-]+$/
  if (!validCodePattern.test(cleanedCode)) {
    throw new Error('授权码Incluir无效字符，请Verificar是否复制了正确的 Authorization Code')
  }

  return cleanedCode
}

/**
 * 使用授权码交换Setup Token
 * @param {string} authorizationCode - 授权码
 * @param {string} codeVerifier - PKCE code verifier
 * @param {string} state - state Parámetro
 * @param {object|null} proxyConfig - ProxyConfiguración（Opcional）
 * @returns {Promise<object>} ClaudeFormato的tokenRespuesta
 */
async function exchangeSetupTokenCode(authorizationCode, codeVerifier, state, proxyConfig = null) {
  // Limpiar授权码，EliminaciónURL片段
  const cleanedCode = authorizationCode.split('#')[0]?.split('&')[0] ?? authorizationCode

  const params = {
    grant_type: 'authorization_code',
    client_id: OAUTH_CONFIG.CLIENT_ID,
    code: cleanedCode,
    redirect_uri: OAUTH_CONFIG.REDIRECT_URI,
    code_verifier: codeVerifier,
    state,
    expires_in: 31536000 // Setup Token 可以Establecer较长的过期Tiempo
  }

  // CrearProxyagent
  const agent = createProxyAgent(proxyConfig)

  try {
    if (agent) {
      logger.info(
        `🌐 Using proxy for Setup Token exchange: ${ProxyHelper.maskProxyInfo(proxyConfig)}`
      )
    } else {
      logger.debug('🌐 No proxy configured for Setup Token exchange')
    }

    logger.debug('🔄 Attempting Setup Token exchange', {
      url: OAUTH_CONFIG.TOKEN_URL,
      codeLength: cleanedCode.length,
      codePrefix: `${cleanedCode.substring(0, 10)}...`,
      hasProxy: !!proxyConfig,
      proxyType: proxyConfig?.type || 'none'
    })

    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'claude-cli/1.0.56 (external, cli)',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://claude.ai/',
        Origin: 'https://claude.ai'
      },
      timeout: 30000
    }

    if (agent) {
      axiosConfig.httpAgent = agent
      axiosConfig.httpsAgent = agent
      axiosConfig.proxy = false
    }

    const response = await axios.post(OAUTH_CONFIG.TOKEN_URL, params, axiosConfig)

    // Registro完整的RespuestaDatos到专门的认证详细Registro
    logger.authDetail('Setup Token exchange response', response.data)

    // Registro简化Versión到主Registro
    logger.info('📊 Setup Token exchange response (analyzing for subscription info):', {
      status: response.status,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : []
    })

    logger.success('Setup Token exchange successful', {
      status: response.status,
      hasAccessToken: !!response.data?.access_token,
      scopes: response.data?.scope,
      // 尝试提取可能的套餐InformaciónCampo
      subscription: response.data?.subscription,
      plan: response.data?.plan,
      tier: response.data?.tier,
      accountType: response.data?.account_type,
      features: response.data?.features,
      limits: response.data?.limits
    })

    const { data } = response

    // Analizar组织与CuentaInformación
    const organizationInfo = data.organization || null
    const accountInfo = data.account || null
    const extInfo = extractExtInfo(data)

    // RetornarClaudeFormato的tokenDatos，Incluir可能的套餐Información
    const result = {
      accessToken: data.access_token,
      refreshToken: '',
      expiresAt: (Math.floor(Date.now() / 1000) + data.expires_in) * 1000,
      scopes: data.scope ? data.scope.split(' ') : ['user:inference', 'user:profile'],
      isMax: true,
      organization: organizationInfo,
      account: accountInfo,
      extInfo
    }

    // 如果Respuesta中Incluir套餐Información，添加到Retornar结果中
    if (data.subscription || data.plan || data.tier || data.account_type) {
      result.subscriptionInfo = {
        subscription: data.subscription,
        plan: data.plan,
        tier: data.tier,
        accountType: data.account_type,
        features: data.features,
        limits: data.limits
      }
      logger.info('🎯 Found subscription info in Setup Token response:', result.subscriptionInfo)
    }

    return result
  } catch (error) {
    // 使用与标准OAuth相同的ErrorProcesar逻辑
    if (error.response) {
      const { status } = error.response
      const errorData = error.response.data

      logger.error('❌ Setup Token exchange failed with server error', {
        status,
        statusText: error.response.statusText,
        data: errorData,
        codeLength: cleanedCode.length,
        codePrefix: `${cleanedCode.substring(0, 10)}...`
      })

      let errorMessage = `HTTP ${status}`
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMessage += `: ${errorData}`
        } else if (errorData.error) {
          errorMessage += `: ${errorData.error}`
          if (errorData.error_description) {
            errorMessage += ` - ${errorData.error_description}`
          }
        } else {
          errorMessage += `: ${JSON.stringify(errorData)}`
        }
      }

      throw new Error(`Setup Token exchange failed: ${errorMessage}`)
    } else if (error.request) {
      logger.error('❌ Setup Token exchange failed with network error', {
        message: error.message,
        code: error.code,
        hasProxy: !!proxyConfig
      })
      throw new Error(
        'Setup Token exchange failed: No response from server (network error or timeout)'
      )
    } else {
      logger.error('❌ Setup Token exchange failed with unknown error', {
        message: error.message,
        stack: error.stack
      })
      throw new Error(`Setup Token exchange failed: ${error.message}`)
    }
  }
}

/**
 * Formato化为Claude标准Formato
 * @param {object} tokenData - tokenDatos
 * @returns {object} claudeAiOauthFormato的Datos
 */
function formatClaudeCredentials(tokenData) {
  return {
    claudeAiOauth: {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: tokenData.expiresAt,
      scopes: tokenData.scopes,
      isMax: tokenData.isMax,
      organization: tokenData.organization || null,
      account: tokenData.account || null,
      extInfo: tokenData.extInfo || null
    }
  }
}

/**
 * 从TokenRespuesta中提取ExtensiónInformación
 * @param {object} data - TokenRespuesta
 * @returns {object|null} Incluir组织与CuentaUUID的ExtensiónInformación
 */
function extractExtInfo(data) {
  if (!data || typeof data !== 'object') {
    return null
  }

  const organization = data.organization || null
  const account = data.account || null

  const ext = {}

  const orgUuid =
    organization?.uuid ||
    organization?.id ||
    organization?.organization_uuid ||
    organization?.organization_id
  const accountUuid = account?.uuid || account?.id || account?.account_uuid || account?.account_id

  if (orgUuid) {
    ext.org_uuid = orgUuid
  }

  if (accountUuid) {
    ext.account_uuid = accountUuid
  }

  return Object.keys(ext).length > 0 ? ext : null
}

// =============================================================================
// Cookie自动授权相关Método (基于Clove项目实现)
// =============================================================================

/**
 * Construir带Cookie的Solicitud头
 * @param {string} sessionKey - sessionKeyValor
 * @returns {object} Solicitud头Objeto
 */
function buildCookieHeaders(sessionKey) {
  return {
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Cookie: `sessionKey=${sessionKey}`,
    Origin: COOKIE_OAUTH_CONFIG.CLAUDE_AI_URL,
    Referer: `${COOKIE_OAUTH_CONFIG.CLAUDE_AI_URL}/new`,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
}

/**
 * 使用CookieObtener组织UUID和能力ColumnaTabla
 * @param {string} sessionKey - sessionKeyValor
 * @param {object|null} proxyConfig - ProxyConfiguración（Opcional）
 * @returns {Promise<{organizationUuid: string, capabilities: string[]}>}
 */
async function getOrganizationInfo(sessionKey, proxyConfig = null) {
  const headers = buildCookieHeaders(sessionKey)
  const agent = createProxyAgent(proxyConfig)

  try {
    if (agent) {
      logger.info(`🌐 Using proxy for organization info: ${ProxyHelper.maskProxyInfo(proxyConfig)}`)
    }

    logger.debug('🔄 Fetching organization info with Cookie', {
      url: COOKIE_OAUTH_CONFIG.ORGANIZATIONS_URL,
      hasProxy: !!proxyConfig
    })

    const axiosConfig = {
      headers,
      timeout: 30000,
      maxRedirects: 0 // 禁止自动重定向，以便检测Cloudflare拦截(302)
    }

    if (agent) {
      axiosConfig.httpAgent = agent
      axiosConfig.httpsAgent = agent
      axiosConfig.proxy = false
    }

    const response = await axios.get(COOKIE_OAUTH_CONFIG.ORGANIZATIONS_URL, axiosConfig)

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Obtener组织InformaciónFalló：RespuestaFormato无效')
    }

    // 找到具有chat能力且能力最多的组织
    let bestOrg = null
    let maxCapabilities = []

    for (const org of response.data) {
      const capabilities = org.capabilities || []

      // 必须有chat能力
      if (!capabilities.includes('chat')) {
        continue
      }

      // 选择能力最多的组织
      if (capabilities.length > maxCapabilities.length) {
        bestOrg = org
        maxCapabilities = capabilities
      }
    }

    if (!bestOrg || !bestOrg.uuid) {
      throw new Error('未找到具有chat能力的组织')
    }

    logger.success('Found organization', {
      uuid: bestOrg.uuid,
      capabilities: maxCapabilities
    })

    return {
      organizationUuid: bestOrg.uuid,
      capabilities: maxCapabilities
    }
  } catch (error) {
    if (error.response) {
      const { status } = error.response

      if (status === 403 || status === 401) {
        throw new Error('Cookie authorization failed: invalid sessionKey or expired')
      }

      if (status === 302) {
        throw new Error('Solicitud被Cloudflare拦截，请稍后Reintentar')
      }

      throw new Error(`Obtener组织InformaciónFalló：HTTP ${status}`)
    } else if (error.request) {
      throw new Error('Obtener组织InformaciónFalló：网络Error或Tiempo de espera agotado')
    }

    throw error
  }
}

/**
 * 使用Cookie自动Obtener授权code
 * @param {string} sessionKey - sessionKeyValor
 * @param {string} organizationUuid - 组织UUID
 * @param {string} scope - 授权scope
 * @param {object|null} proxyConfig - ProxyConfiguración（Opcional）
 * @returns {Promise<{authorizationCode: string, codeVerifier: string, state: string}>}
 */
async function authorizeWithCookie(sessionKey, organizationUuid, scope, proxyConfig = null) {
  // GenerarPKCEParámetro
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = generateState()

  // Construir授权URL
  const authorizeUrl = COOKIE_OAUTH_CONFIG.AUTHORIZE_URL_TEMPLATE.replace(
    '{organization_uuid}',
    organizationUuid
  )

  // ConstruirSolicitudpayload
  const payload = {
    response_type: 'code',
    client_id: OAUTH_CONFIG.CLIENT_ID,
    organization_uuid: organizationUuid,
    redirect_uri: OAUTH_CONFIG.REDIRECT_URI,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  }

  const headers = {
    ...buildCookieHeaders(sessionKey),
    'Content-Type': 'application/json'
  }

  const agent = createProxyAgent(proxyConfig)

  try {
    if (agent) {
      logger.info(
        `🌐 Using proxy for Cookie authorization: ${ProxyHelper.maskProxyInfo(proxyConfig)}`
      )
    }

    logger.debug('🔄 Requesting authorization with Cookie', {
      url: authorizeUrl,
      scope,
      hasProxy: !!proxyConfig
    })

    const axiosConfig = {
      headers,
      timeout: 30000,
      maxRedirects: 0 // 禁止自动重定向，以便检测Cloudflare拦截(302)
    }

    if (agent) {
      axiosConfig.httpAgent = agent
      axiosConfig.httpsAgent = agent
      axiosConfig.proxy = false
    }

    const response = await axios.post(authorizeUrl, payload, axiosConfig)

    // 从Respuesta中Obtenerredirect_uri
    const redirectUri = response.data?.redirect_uri

    if (!redirectUri) {
      throw new Error('授权Respuesta中未找到redirect_uri')
    }

    logger.debug('📎 Got redirect URI', { redirectUri: `${redirectUri.substring(0, 80)}...` })

    // Analizarredirect_uriObtenerauthorization code
    const url = new URL(redirectUri)
    const authorizationCode = url.searchParams.get('code')
    const responseState = url.searchParams.get('state')

    if (!authorizationCode) {
      throw new Error('redirect_uri中未找到授权码')
    }

    // Construir完整的授权码（Incluirstate，如果有的话）
    const fullCode = responseState ? `${authorizationCode}#${responseState}` : authorizationCode

    logger.success('Got authorization code via Cookie', {
      codeLength: authorizationCode.length,
      codePrefix: `${authorizationCode.substring(0, 10)}...`
    })

    return {
      authorizationCode: fullCode,
      codeVerifier,
      state
    }
  } catch (error) {
    if (error.response) {
      const { status } = error.response

      if (status === 403 || status === 401) {
        throw new Error('Cookie authorization failed: invalid sessionKey or expired')
      }

      if (status === 302) {
        throw new Error('Solicitud被Cloudflare拦截，请稍后Reintentar')
      }

      const errorData = error.response.data
      let errorMessage = `HTTP ${status}`

      if (errorData) {
        if (typeof errorData === 'string') {
          errorMessage += `: ${errorData}`
        } else if (errorData.error) {
          errorMessage += `: ${errorData.error}`
        }
      }

      throw new Error(`授权SolicitudFalló：${errorMessage}`)
    } else if (error.request) {
      throw new Error('授权SolicitudFalló：网络Error或Tiempo de espera agotado')
    }

    throw error
  }
}

/**
 * 完整的Cookie自动授权流程
 * @param {string} sessionKey - sessionKeyValor
 * @param {object|null} proxyConfig - ProxyConfiguración（Opcional）
 * @param {boolean} isSetupToken - 是否为Setup Token模式
 * @returns {Promise<{claudeAiOauth: object, organizationUuid: string, capabilities: string[]}>}
 */
async function oauthWithCookie(sessionKey, proxyConfig = null, isSetupToken = false) {
  logger.info('🍪 Starting Cookie-based OAuth flow', {
    isSetupToken,
    hasProxy: !!proxyConfig
  })

  // 步骤1：Obtener组织Información
  logger.debug('Step 1/3: Fetching organization info...')
  const { organizationUuid, capabilities } = await getOrganizationInfo(sessionKey, proxyConfig)

  // 步骤2：确定scope并Obtener授权code
  const scope = isSetupToken ? OAUTH_CONFIG.SCOPES_SETUP : 'user:profile user:inference'

  logger.debug('Step 2/3: Getting authorization code...', { scope })
  const { authorizationCode, codeVerifier, state } = await authorizeWithCookie(
    sessionKey,
    organizationUuid,
    scope,
    proxyConfig
  )

  // 步骤3：交换token
  logger.debug('Step 3/3: Exchanging token...')
  const tokenData = isSetupToken
    ? await exchangeSetupTokenCode(authorizationCode, codeVerifier, state, proxyConfig)
    : await exchangeCodeForTokens(authorizationCode, codeVerifier, state, proxyConfig)

  logger.success('Cookie-based OAuth flow completed', {
    isSetupToken,
    organizationUuid,
    hasAccessToken: !!tokenData.accessToken,
    hasRefreshToken: !!tokenData.refreshToken
  })

  return {
    claudeAiOauth: tokenData,
    organizationUuid,
    capabilities
  }
}

module.exports = {
  OAUTH_CONFIG,
  COOKIE_OAUTH_CONFIG,
  generateOAuthParams,
  generateSetupTokenParams,
  exchangeCodeForTokens,
  exchangeSetupTokenCode,
  parseCallbackUrl,
  formatClaudeCredentials,
  extractExtInfo,
  generateState,
  generateCodeVerifier,
  generateCodeChallenge,
  generateAuthUrl,
  generateSetupTokenAuthUrl,
  createProxyAgent,
  // Cookie自动授权相关Método
  buildCookieHeaders,
  getOrganizationInfo,
  authorizeWithCookie,
  oauthWithCookie
}
