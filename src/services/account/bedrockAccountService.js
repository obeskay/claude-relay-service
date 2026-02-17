const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const redis = require('../../models/redis')
const logger = require('../../utils/logger')
const config = require('../../../config/config')
const bedrockRelayService = require('../relay/bedrockRelayService')
const LRUCache = require('../../utils/lruCache')
const upstreamErrorHelper = require('../../utils/upstreamErrorHelper')

class BedrockAccountService {
  constructor() {
    // Cifrado相关常量
    this.ENCRYPTION_ALGORITHM = 'aes-256-cbc'
    this.ENCRYPTION_SALT = 'salt'

    // 🚀 RendimientoOptimización：Caché派生的CifradoClave，避免每次重复Calcular
    this._encryptionKeyCache = null

    // 🔄 Descifrado结果Caché，提高DescifradoRendimiento
    this._decryptCache = new LRUCache(500)

    // 🧹 定期LimpiarCaché（每10分钟）
    setInterval(
      () => {
        this._decryptCache.cleanup()
        logger.info('🧹 Bedrock decrypt cache cleanup completed', this._decryptCache.getStats())
      },
      10 * 60 * 1000
    )
  }

  // 🏢 CrearBedrockCuenta
  async createAccount(options = {}) {
    const {
      name = 'Unnamed Bedrock Account',
      description = '',
      region = process.env.AWS_REGION || 'us-east-1',
      awsCredentials = null, // { accessKeyId, secretAccessKey, sessionToken }
      bearerToken = null, // AWS Bearer Token for Bedrock API Keys
      defaultModel = 'us.anthropic.claude-sonnet-4-20250514-v1:0',
      isActive = true,
      accountType = 'shared', // 'dedicated' or 'shared'
      priority = 50, // 调度优先级 (1-100，Número越小优先级越高)
      schedulable = true, // 是否可被调度
      credentialType = 'access_key', // 'access_key', 'bearer_token'（Predeterminado为 access_key）
      disableAutoProtection = false // 是否关闭自动防护（429/401/400/529 不自动Deshabilitar）
    } = options

    const accountId = uuidv4()

    const accountData = {
      id: accountId,
      name,
      description,
      region,
      defaultModel,
      isActive,
      accountType,
      priority,
      schedulable,
      credentialType,

      // ✅ Nueva característica：Cuenta订阅到期Tiempo（业务Campo，手动管理）
      // 注意：Bedrock 使用 AWS 凭证，没有 OAuth token，因此没有 expiresAt
      subscriptionExpiresAt: options.subscriptionExpiresAt || null,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'bedrock', // 标识这是BedrockCuenta
      disableAutoProtection // 关闭自动防护
    }

    // Cifrado存储AWS凭证
    if (awsCredentials) {
      accountData.awsCredentials = this._encryptAwsCredentials(awsCredentials)
    }

    // Cifrado存储 Bearer Token
    if (bearerToken) {
      accountData.bearerToken = this._encryptAwsCredentials({ token: bearerToken })
    }

    const client = redis.getClientSafe()
    await client.set(`bedrock_account:${accountId}`, JSON.stringify(accountData))
    await redis.addToIndex('bedrock_account:index', accountId)

    logger.info(`✅ CrearBedrockCuentaÉxito - ID: ${accountId}, Nombre: ${name}, 区域: ${region}`)

    return {
      success: true,
      data: {
        id: accountId,
        name,
        description,
        region,
        defaultModel,
        isActive,
        accountType,
        priority,
        schedulable,
        credentialType,
        createdAt: accountData.createdAt,
        type: 'bedrock'
      }
    }
  }

  // 🔍 ObtenerCuentaInformación
  async getAccount(accountId) {
    try {
      const client = redis.getClientSafe()
      const accountData = await client.get(`bedrock_account:${accountId}`)
      if (!accountData) {
        return { success: false, error: 'Account not found' }
      }

      const account = JSON.parse(accountData)

      // 根据凭证TipoDescifrado对应的凭证
      // 增强逻辑：优先按照 credentialType Descifrado，如果Campo不存在则尝试Descifrado实际存在的Campo（兜底）
      try {
        let accessKeyDecrypted = false
        let bearerTokenDecrypted = false

        // 第一步：按照 credentialType 尝试Descifrado对应的凭证
        if (account.credentialType === 'access_key' && account.awsCredentials) {
          // Access Key 模式：Descifrado AWS 凭证
          account.awsCredentials = this._decryptAwsCredentials(account.awsCredentials)
          accessKeyDecrypted = true
          logger.debug(
            `🔓 Descifrado Access Key Éxito - ID: ${accountId}, Tipo: ${account.credentialType}`
          )
        } else if (account.credentialType === 'bearer_token' && account.bearerToken) {
          // Bearer Token 模式：Descifrado Bearer Token
          const decrypted = this._decryptAwsCredentials(account.bearerToken)
          account.bearerToken = decrypted.token
          bearerTokenDecrypted = true
          logger.debug(
            `🔓 Descifrado Bearer Token Éxito - ID: ${accountId}, Tipo: ${account.credentialType}`
          )
        } else if (!account.credentialType || account.credentialType === 'default') {
          // 向后兼容：旧Versión账号可能没有 credentialType Campo，尝试Descifrado所有存在的凭证
          if (account.awsCredentials) {
            account.awsCredentials = this._decryptAwsCredentials(account.awsCredentials)
            accessKeyDecrypted = true
          }
          if (account.bearerToken) {
            const decrypted = this._decryptAwsCredentials(account.bearerToken)
            account.bearerToken = decrypted.token
            bearerTokenDecrypted = true
          }
          logger.debug(
            `🔓 兼容模式Descifrado - ID: ${accountId}, Access Key: ${accessKeyDecrypted}, Bearer Token: ${bearerTokenDecrypted}`
          )
        }

        // 第二步：兜底逻辑 - 如果按照 credentialType 没有Descifrado到任何凭证，尝试Descifrado实际存在的Campo
        if (!accessKeyDecrypted && !bearerTokenDecrypted) {
          logger.warn(
            `⚠️ credentialType="${account.credentialType}" 与实际Campo不匹配，尝试兜底Descifrado - ID: ${accountId}`
          )
          if (account.awsCredentials) {
            account.awsCredentials = this._decryptAwsCredentials(account.awsCredentials)
            accessKeyDecrypted = true
            logger.warn(
              `🔓 兜底Descifrado Access Key Éxito - ID: ${accountId}, credentialType 应为 'access_key'`
            )
          }
          if (account.bearerToken) {
            const decrypted = this._decryptAwsCredentials(account.bearerToken)
            account.bearerToken = decrypted.token
            bearerTokenDecrypted = true
            logger.warn(
              `🔓 兜底Descifrado Bearer Token Éxito - ID: ${accountId}, credentialType 应为 'bearer_token'`
            )
          }
        }

        // Validar至少Descifrado了一种凭证
        if (!accessKeyDecrypted && !bearerTokenDecrypted) {
          logger.error(
            `❌ 未找到任何凭证可Descifrado - ID: ${accountId}, credentialType: ${account.credentialType}, hasAwsCredentials: ${!!account.awsCredentials}, hasBearerToken: ${!!account.bearerToken}`
          )
          return {
            success: false,
            error: 'No valid credentials found in account data'
          }
        }
      } catch (decryptError) {
        logger.error(
          `❌ DescifradoBedrock凭证Falló - ID: ${accountId}, Tipo: ${account.credentialType}`,
          decryptError
        )
        return {
          success: false,
          error: `Credentials decryption failed: ${decryptError.message}`
        }
      }

      logger.debug(`🔍 ObtenerBedrockCuenta - ID: ${accountId}, Nombre: ${account.name}`)

      return {
        success: true,
        data: account
      }
    } catch (error) {
      logger.error(`❌ ObtenerBedrockCuentaFalló - ID: ${accountId}`, error)
      return { success: false, error: error.message }
    }
  }

  // 📋 Obtener所有CuentaColumnaTabla
  async getAllAccounts() {
    try {
      const _client = redis.getClientSafe()
      const accountIds = await redis.getAllIdsByIndex(
        'bedrock_account:index',
        'bedrock_account:*',
        /^bedrock_account:(.+)$/
      )
      const keys = accountIds.map((id) => `bedrock_account:${id}`)
      const accounts = []
      const dataList = await redis.batchGetChunked(keys)

      for (let i = 0; i < keys.length; i++) {
        const accountData = dataList[i]
        if (accountData) {
          const account = JSON.parse(accountData)

          // Retornar给前端时，不Incluir敏感Información，只显示掩码
          accounts.push({
            id: account.id,
            name: account.name,
            description: account.description,
            region: account.region,
            defaultModel: account.defaultModel,
            isActive: account.isActive,
            accountType: account.accountType,
            priority: account.priority,
            schedulable: account.schedulable,
            credentialType: account.credentialType,

            // ✅ 前端显示订阅过期Tiempo（业务Campo）
            expiresAt: account.subscriptionExpiresAt || null,

            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
            type: 'bedrock',
            platform: 'bedrock',
            // 根据凭证Tipo判断是否有凭证
            hasCredentials:
              account.credentialType === 'bearer_token'
                ? !!account.bearerToken
                : !!account.awsCredentials
          })
        }
      }

      // 按优先级和NombreOrdenar
      accounts.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority
        }
        return a.name.localeCompare(b.name)
      })

      logger.debug(`📋 Obtener所有BedrockCuenta - 共 ${accounts.length} 个`)

      return {
        success: true,
        data: accounts
      }
    } catch (error) {
      logger.error('❌ ObtenerBedrockCuentaColumnaTablaFalló', error)
      return { success: false, error: error.message }
    }
  }

  // ✏️ ActualizarCuentaInformación
  async updateAccount(accountId, updates = {}) {
    try {
      // Obtener原始CuentaDatos（不Descifrado凭证）
      const client = redis.getClientSafe()
      const accountData = await client.get(`bedrock_account:${accountId}`)
      if (!accountData) {
        return { success: false, error: 'Account not found' }
      }

      const account = JSON.parse(accountData)

      // ActualizarCampo
      if (updates.name !== undefined) {
        account.name = updates.name
      }
      if (updates.description !== undefined) {
        account.description = updates.description
      }
      if (updates.region !== undefined) {
        account.region = updates.region
      }
      if (updates.defaultModel !== undefined) {
        account.defaultModel = updates.defaultModel
      }
      if (updates.isActive !== undefined) {
        account.isActive = updates.isActive
      }
      if (updates.accountType !== undefined) {
        account.accountType = updates.accountType
      }
      if (updates.priority !== undefined) {
        account.priority = updates.priority
      }
      if (updates.schedulable !== undefined) {
        account.schedulable = updates.schedulable
      }
      if (updates.credentialType !== undefined) {
        account.credentialType = updates.credentialType
      }

      // ActualizarAWS凭证
      if (updates.awsCredentials !== undefined) {
        if (updates.awsCredentials) {
          account.awsCredentials = this._encryptAwsCredentials(updates.awsCredentials)
        } else {
          delete account.awsCredentials
        }
      } else if (account.awsCredentials && account.awsCredentials.accessKeyId) {
        // 如果没有提供新凭证但现有凭证是明文Formato，重新Cifrado
        const plainCredentials = account.awsCredentials
        account.awsCredentials = this._encryptAwsCredentials(plainCredentials)
        logger.info(`🔐 重新CifradoBedrockCuenta凭证 - ID: ${accountId}`)
      }

      // Actualizar Bearer Token
      if (updates.bearerToken !== undefined) {
        if (updates.bearerToken) {
          account.bearerToken = this._encryptAwsCredentials({ token: updates.bearerToken })
        } else {
          delete account.bearerToken
        }
      }

      // ✅ 直接保存 subscriptionExpiresAt（如果提供）
      // Bedrock 没有 token 刷新逻辑，不会覆盖此Campo
      if (updates.subscriptionExpiresAt !== undefined) {
        account.subscriptionExpiresAt = updates.subscriptionExpiresAt
      }

      // 自动防护开关
      if (updates.disableAutoProtection !== undefined) {
        account.disableAutoProtection = updates.disableAutoProtection
      }

      account.updatedAt = new Date().toISOString()

      await client.set(`bedrock_account:${accountId}`, JSON.stringify(account))

      logger.info(`✅ ActualizarBedrockCuentaÉxito - ID: ${accountId}, Nombre: ${account.name}`)

      return {
        success: true,
        data: {
          id: account.id,
          name: account.name,
          description: account.description,
          region: account.region,
          defaultModel: account.defaultModel,
          isActive: account.isActive,
          accountType: account.accountType,
          priority: account.priority,
          schedulable: account.schedulable,
          credentialType: account.credentialType,
          updatedAt: account.updatedAt,
          type: 'bedrock'
        }
      }
    } catch (error) {
      logger.error(`❌ ActualizarBedrockCuentaFalló - ID: ${accountId}`, error)
      return { success: false, error: error.message }
    }
  }

  // 🗑️ EliminarCuenta
  async deleteAccount(accountId) {
    try {
      const accountResult = await this.getAccount(accountId)
      if (!accountResult.success) {
        return accountResult
      }

      const client = redis.getClientSafe()
      await client.del(`bedrock_account:${accountId}`)
      await redis.removeFromIndex('bedrock_account:index', accountId)

      logger.info(`✅ EliminarBedrockCuentaÉxito - ID: ${accountId}`)

      return { success: true }
    } catch (error) {
      logger.error(`❌ EliminarBedrockCuentaFalló - ID: ${accountId}`, error)
      return { success: false, error: error.message }
    }
  }

  // 🎯 选择可用的BedrockCuenta (用于Solicitud转发)
  async selectAvailableAccount() {
    try {
      const accountsResult = await this.getAllAccounts()
      if (!accountsResult.success) {
        return { success: false, error: 'Failed to get accounts' }
      }

      const availableAccounts = accountsResult.data.filter((account) => {
        // ✅ VerificarCuenta订阅是否过期
        if (this.isSubscriptionExpired(account)) {
          logger.debug(
            `⏰ Skipping expired Bedrock account: ${account.name}, expired at ${account.subscriptionExpiresAt || account.expiresAt}`
          )
          return false
        }

        return account.isActive && account.schedulable
      })

      if (availableAccounts.length === 0) {
        return { success: false, error: 'No available Bedrock accounts' }
      }

      // 简单的轮询选择Política - 选择优先级最高的Cuenta
      const selectedAccount = availableAccounts[0]

      // Obtener完整CuentaInformación（IncluirDescifrado的凭证）
      const fullAccountResult = await this.getAccount(selectedAccount.id)
      if (!fullAccountResult.success) {
        return { success: false, error: 'Failed to get selected account details' }
      }

      logger.debug(`🎯 选择BedrockCuenta - ID: ${selectedAccount.id}, Nombre: ${selectedAccount.name}`)

      return {
        success: true,
        data: fullAccountResult.data
      }
    } catch (error) {
      logger.error('❌ 选择BedrockCuentaFalló', error)
      return { success: false, error: error.message }
    }
  }

  // 🧪 ProbarCuentaConexión
  async testAccount(accountId) {
    try {
      const accountResult = await this.getAccount(accountId)
      if (!accountResult.success) {
        return accountResult
      }

      const account = accountResult.data

      logger.info(
        `🧪 ProbarBedrockCuentaConexión - ID: ${accountId}, Nombre: ${account.name}, 凭证Tipo: ${account.credentialType}`
      )

      // Validar凭证是否已Descifrado
      const hasValidCredentials =
        (account.credentialType === 'access_key' && account.awsCredentials) ||
        (account.credentialType === 'bearer_token' && account.bearerToken) ||
        (!account.credentialType && (account.awsCredentials || account.bearerToken))

      if (!hasValidCredentials) {
        logger.error(
          `❌ ProbarFalló：Cuenta没有有效凭证 - ID: ${accountId}, credentialType: ${account.credentialType}`
        )
        return {
          success: false,
          error: 'No valid credentials found after decryption'
        }
      }

      // 尝试Crear Bedrock Cliente来Validar凭证Formato
      try {
        bedrockRelayService._getBedrockClient(account.region, account)
        logger.debug(`✅ BedrockClienteCrearÉxito - ID: ${accountId}`)
      } catch (clientError) {
        logger.error(`❌ CrearBedrockClienteFalló - ID: ${accountId}`, clientError)
        return {
          success: false,
          error: `Failed to create Bedrock client: ${clientError.message}`
        }
      }

      // Obtener可用模型ColumnaTabla（硬Codificación，但至少Validar了凭证Formato正确）
      const models = await bedrockRelayService.getAvailableModels(account)

      if (models && models.length > 0) {
        logger.info(
          `✅ BedrockCuentaProbarÉxito - ID: ${accountId}, 发现 ${models.length} 个模型, 凭证Tipo: ${account.credentialType}`
        )
        return {
          success: true,
          data: {
            status: 'connected',
            modelsCount: models.length,
            region: account.region,
            credentialType: account.credentialType
          }
        }
      } else {
        return {
          success: false,
          error: 'Unable to retrieve models from Bedrock'
        }
      }
    } catch (error) {
      logger.error(`❌ ProbarBedrockCuentaFalló - ID: ${accountId}`, error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 🧪 Probar Bedrock CuentaConexión（SSE 流式Retornar，供前端ProbarPágina使用）
   * @param {string} accountId - CuentaID
   * @param {Object} res - Express response Objeto
   * @param {string} model - Probar使用的模型
   */
  async testAccountConnection(accountId, res, model = null) {
    const { InvokeModelWithResponseStreamCommand } = require('@aws-sdk/client-bedrock-runtime')

    try {
      // ObtenerCuentaInformación
      const accountResult = await this.getAccount(accountId)
      if (!accountResult.success) {
        throw new Error(accountResult.error || 'Account not found')
      }

      const account = accountResult.data

      // 根据CuentaTipo选择合适的Probar模型
      if (!model) {
        // Access Key 模式使用 Haiku（更快更便宜）
        model = account.defaultModel || 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
      }

      logger.info(
        `🧪 Testing Bedrock account connection: ${account.name} (${accountId}), model: ${model}, credentialType: ${account.credentialType}`
      )

      // Establecer SSE Respuesta头
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      res.status(200)

      // 发送 test_start Evento
      res.write(`data: ${JSON.stringify({ type: 'test_start' })}\n\n`)

      // 构造ProbarSolicitud体（Bedrock Formato）
      const bedrockPayload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content:
              'Hello! Please respond with a simple greeting to confirm the connection is working. And tell me who are you?'
          }
        ]
      }

      // Obtener Bedrock Cliente
      const region = account.region || bedrockRelayService.defaultRegion
      const client = bedrockRelayService._getBedrockClient(region, account)

      // Crear流式调用命令
      const command = new InvokeModelWithResponseStreamCommand({
        modelId: model,
        body: JSON.stringify(bedrockPayload),
        contentType: 'application/json',
        accept: 'application/json'
      })

      logger.debug(`🌊 Bedrock test stream - model: ${model}, region: ${region}`)

      const startTime = Date.now()
      const response = await client.send(command)

      // Procesar流式Respuesta
      // let responseText = ''
      for await (const chunk of response.body) {
        if (chunk.chunk) {
          const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes))

          // 提取文本内容
          if (chunkData.type === 'content_block_delta' && chunkData.delta?.text) {
            const { text } = chunkData.delta
            // responseText += text

            // 发送 content Evento
            res.write(`data: ${JSON.stringify({ type: 'content', text })}\n\n`)
          }

          // 检测Error
          if (chunkData.type === 'error') {
            throw new Error(chunkData.error?.message || 'Bedrock API error')
          }
        }
      }

      const duration = Date.now() - startTime
      logger.info(`✅ Bedrock test completed - model: ${model}, duration: ${duration}ms`)

      // 发送 message_stop Evento（前端兼容）
      res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`)

      // 发送 test_complete Evento
      res.write(`data: ${JSON.stringify({ type: 'test_complete', success: true })}\n\n`)

      // 结束Respuesta
      res.end()

      logger.info(`✅ Test request completed for Bedrock account: ${account.name}`)
    } catch (error) {
      logger.error(`❌ Test Bedrock account connection failed:`, error)

      // 发送ErrorEvento给前端
      try {
        // VerificarRespuesta流是否仍然可写
        if (!res.writableEnded && !res.destroyed) {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')
            res.status(200)
          }
          const errorMsg = error.message || 'ProbarFalló'
          res.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`)
          res.end()
        }
      } catch (writeError) {
        logger.error('Failed to write error to response stream:', writeError)
      }

      // 不再重新抛出Error，避免Ruta层再次Procesar
      // throw error
    }
  }

  /**
   * VerificarCuenta订阅是否过期
   * @param {Object} account - CuentaObjeto
   * @returns {boolean} - true: 已过期, false: 未过期
   */
  isSubscriptionExpired(account) {
    if (!account.subscriptionExpiresAt) {
      return false // 未Establecer视为永不过期
    }
    const expiryDate = new Date(account.subscriptionExpiresAt)
    return expiryDate <= new Date()
  }

  // 🔑 GenerarCifradoClave（CachéOptimización）
  _generateEncryptionKey() {
    if (!this._encryptionKeyCache) {
      this._encryptionKeyCache = crypto
        .createHash('sha256')
        .update(config.security.encryptionKey)
        .digest()
      logger.info('🔑 Bedrock encryption key derived and cached for performance optimization')
    }
    return this._encryptionKeyCache
  }

  // 🔐 CifradoAWS凭证
  _encryptAwsCredentials(credentials) {
    try {
      const key = this._generateEncryptionKey()
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv)

      const credentialsString = JSON.stringify(credentials)
      let encrypted = cipher.update(credentialsString, 'utf8', 'hex')
      encrypted += cipher.final('hex')

      return {
        encrypted,
        iv: iv.toString('hex')
      }
    } catch (error) {
      logger.error('❌ AWS凭证CifradoFalló', error)
      throw new Error('Credentials encryption failed')
    }
  }

  // 🔓 DescifradoAWS凭证
  _decryptAwsCredentials(encryptedData) {
    try {
      // VerificarDatosFormato
      if (!encryptedData || typeof encryptedData !== 'object') {
        logger.error('❌ 无效的CifradoDatosFormato:', encryptedData)
        throw new Error('Invalid encrypted data format')
      }

      // Verificar是否为CifradoFormato (有 encrypted 和 iv Campo)
      if (encryptedData.encrypted && encryptedData.iv) {
        // 🎯 VerificarCaché
        const cacheKey = crypto
          .createHash('sha256')
          .update(JSON.stringify(encryptedData))
          .digest('hex')
        const cached = this._decryptCache.get(cacheKey)
        if (cached !== undefined) {
          return cached
        }

        // CifradoDatos - 进FilaDescifrado
        const key = this._generateEncryptionKey()
        const iv = Buffer.from(encryptedData.iv, 'hex')
        const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv)

        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        const result = JSON.parse(decrypted)

        // 💾 存入Caché（5分钟过期）
        this._decryptCache.set(cacheKey, result, 5 * 60 * 1000)

        // 📊 定期打印CachéEstadística
        if ((this._decryptCache.hits + this._decryptCache.misses) % 1000 === 0) {
          this._decryptCache.printStats()
        }

        return result
      } else if (encryptedData.accessKeyId) {
        // 纯文本Datos - 直接Retornar (向后兼容)
        logger.warn('⚠️ 发现未Cifrado的AWS凭证，建议ActualizarCuenta以HabilitarCifrado')
        return encryptedData
      } else {
        // 既不是CifradoFormato也不是有效的凭证Formato
        logger.error('❌ 缺少CifradoDatosCampo:', {
          hasEncrypted: !!encryptedData.encrypted,
          hasIv: !!encryptedData.iv,
          hasAccessKeyId: !!encryptedData.accessKeyId
        })
        throw new Error('Missing encrypted data fields or valid credentials')
      }
    } catch (error) {
      logger.error('❌ AWS凭证DescifradoFalló', error)
      throw new Error('Credentials decryption failed')
    }
  }

  // 🔍 ObtenerCuentaEstadísticaInformación
  async getAccountStats() {
    try {
      const accountsResult = await this.getAllAccounts()
      if (!accountsResult.success) {
        return { success: false, error: accountsResult.error }
      }

      const accounts = accountsResult.data
      const stats = {
        total: accounts.length,
        active: accounts.filter((acc) => acc.isActive).length,
        inactive: accounts.filter((acc) => !acc.isActive).length,
        schedulable: accounts.filter((acc) => acc.schedulable).length,
        byRegion: {},
        byCredentialType: {}
      }

      // 按区域Estadística
      accounts.forEach((acc) => {
        stats.byRegion[acc.region] = (stats.byRegion[acc.region] || 0) + 1
        stats.byCredentialType[acc.credentialType] =
          (stats.byCredentialType[acc.credentialType] || 0) + 1
      })

      return { success: true, data: stats }
    } catch (error) {
      logger.error('❌ ObtenerBedrockCuentaEstadísticaFalló', error)
      return { success: false, error: error.message }
    }
  }

  // 🔄 重置BedrockCuenta所有异常状态
  async resetAccountStatus(accountId) {
    try {
      const accountData = await this.getAccount(accountId)
      if (!accountData) {
        throw new Error('Account not found')
      }

      const client = redis.getClientSafe()
      const accountKey = `bedrock:account:${accountId}`

      const updates = {
        status: 'active',
        errorMessage: '',
        schedulable: 'true',
        isActive: 'true'
      }

      const fieldsToDelete = [
        'rateLimitedAt',
        'rateLimitStatus',
        'unauthorizedAt',
        'unauthorizedCount',
        'overloadedAt',
        'overloadStatus',
        'blockedAt',
        'quotaStoppedAt'
      ]

      await client.hset(accountKey, updates)
      await client.hdel(accountKey, ...fieldsToDelete)

      logger.success(`Reset all error status for Bedrock account ${accountId}`)

      // 清除临时不可用状态
      await upstreamErrorHelper.clearTempUnavailable(accountId, 'bedrock').catch(() => {})

      // Asíncrono发送 Webhook 通知（忽略Error）
      try {
        const webhookNotifier = require('../../utils/webhookNotifier')
        await webhookNotifier.sendAccountAnomalyNotification({
          accountId,
          accountName: accountData.name || accountId,
          platform: 'bedrock',
          status: 'recovered',
          errorCode: 'STATUS_RESET',
          reason: 'Account status manually reset',
          timestamp: new Date().toISOString()
        })
      } catch (webhookError) {
        logger.warn('Failed to send webhook notification for Bedrock status reset:', webhookError)
      }

      return { success: true, accountId }
    } catch (error) {
      logger.error(`❌ Failed to reset Bedrock account status: ${accountId}`, error)
      throw error
    }
  }
}

module.exports = new BedrockAccountService()
