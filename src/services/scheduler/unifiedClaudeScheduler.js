const claudeAccountService = require('../account/claudeAccountService')
const claudeConsoleAccountService = require('../account/claudeConsoleAccountService')
const bedrockAccountService = require('../account/bedrockAccountService')
const ccrAccountService = require('../account/ccrAccountService')
const accountGroupService = require('../accountGroupService')
const redis = require('../../models/redis')
const logger = require('../../utils/logger')
const { parseVendorPrefixedModel, isOpus45OrNewer } = require('../../utils/modelHelper')
const { isSchedulable, sortAccountsByPriority } = require('../../utils/commonHelper')
const upstreamErrorHelper = require('../../utils/upstreamErrorHelper')

/**
 * Check if account is Pro (not Max)
 *
 * ACCOUNT TYPE LOGIC (as of 2025-12-05):
 * Pro accounts can be identified by either:
 *   1. API real-time data: hasClaudePro=true && hasClaudeMax=false
 *   2. Local config data: accountType='claude_pro'
 *
 * Account type restrictions for Opus models:
 *   - Free account: No Opus access at all
 *   - Pro account: Only Opus 4.5+ (new versions)
 *   - Max account: All Opus versions (legacy 3.x, 4.0, 4.1 and new 4.5+)
 *
 * Compatible with both API real-time data (hasClaudePro) and local config (accountType)
 * @param {Object} info - Subscription info object
 * @returns {boolean} - true if Pro account (not Free, not Max)
 */
function isProAccount(info) {
  // API real-time status takes priority
  if (info.hasClaudePro === true && info.hasClaudeMax !== true) {
    return true
  }
  // Local configured account type
  return info.accountType === 'claude_pro'
}

class UnifiedClaudeScheduler {
  constructor() {
    this.SESSION_MAPPING_PREFIX = 'unified_claude_session_mapping:'
  }

  // 🔍 VerificarCuenta是否SoportarSolicitud的模型
  _isModelSupportedByAccount(account, accountType, requestedModel, context = '') {
    if (!requestedModel) {
      return true // 没有指定模型时，PredeterminadoSoportar
    }

    // Claude OAuth Cuenta的模型Verificar
    if (accountType === 'claude-official') {
      // 1. 首先Verificar是否为 Claude 官方Soportar的模型
      // Claude Official API 只Soportar Anthropic 自己的模型,不Soportar第三方模型(如 deepseek-chat)
      const isClaudeOfficialModel =
        requestedModel.startsWith('claude-') ||
        requestedModel.includes('claude') ||
        requestedModel.includes('sonnet') ||
        requestedModel.includes('opus') ||
        requestedModel.includes('haiku')

      if (!isClaudeOfficialModel) {
        logger.info(
          `🚫 Claude official account ${account.name} does not support non-Claude model ${requestedModel}${context ? ` ${context}` : ''}`
        )
        return false
      }

      // 2. Opus model subscription level check
      // VERSION RESTRICTION LOGIC:
      // - Free: No Opus models
      // - Pro: Only Opus 4.5+ (isOpus45OrNewer = true)
      // - Max: All Opus versions
      if (requestedModel.toLowerCase().includes('opus')) {
        const isNewOpus = isOpus45OrNewer(requestedModel)

        if (account.subscriptionInfo) {
          try {
            const info =
              typeof account.subscriptionInfo === 'string'
                ? JSON.parse(account.subscriptionInfo)
                : account.subscriptionInfo

            // Free account: does not support any Opus model
            if (info.accountType === 'free') {
              logger.info(
                `🚫 Claude account ${account.name} (Free) does not support Opus model${context ? ` ${context}` : ''}`
              )
              return false
            }

            // Pro account: only supports Opus 4.5+
            // Reject legacy Opus (3.x, 4.0-4.4) but allow new Opus (4.5+)
            if (isProAccount(info)) {
              if (!isNewOpus) {
                logger.info(
                  `🚫 Claude account ${account.name} (Pro) does not support legacy Opus model${context ? ` ${context}` : ''}`
                )
                return false
              }
              // Opus 4.5+ supported
              return true
            }

            // Max account: supports all Opus versions (no restriction)
          } catch (e) {
            // Parse failed, assume legacy data (Max), default support
            logger.debug(
              `Account ${account.name} has invalid subscriptionInfo${context ? ` ${context}` : ''}, assuming Max`
            )
          }
        }
        // Account without subscription info, default to supported (legacy data compatibility)
      }
    }

    // Claude Console Cuenta的模型SoportarVerificar
    if (accountType === 'claude-console' && account.supportedModels) {
      // 兼容旧Formato（Arreglo）和新Formato（Objeto）
      if (Array.isArray(account.supportedModels)) {
        // 旧Formato：Arreglo
        if (
          account.supportedModels.length > 0 &&
          !account.supportedModels.includes(requestedModel)
        ) {
          logger.info(
            `🚫 Claude Console account ${account.name} does not support model ${requestedModel}${context ? ` ${context}` : ''}`
          )
          return false
        }
      } else if (typeof account.supportedModels === 'object') {
        // 新Formato：映射Tabla
        if (
          Object.keys(account.supportedModels).length > 0 &&
          !claudeConsoleAccountService.isModelSupported(account.supportedModels, requestedModel)
        ) {
          logger.info(
            `🚫 Claude Console account ${account.name} does not support model ${requestedModel}${context ? ` ${context}` : ''}`
          )
          return false
        }
      }
    }

    // CCR Cuenta的模型SoportarVerificar
    if (accountType === 'ccr' && account.supportedModels) {
      // 兼容旧Formato（Arreglo）和新Formato（Objeto）
      if (Array.isArray(account.supportedModels)) {
        // 旧Formato：Arreglo
        if (
          account.supportedModels.length > 0 &&
          !account.supportedModels.includes(requestedModel)
        ) {
          logger.info(
            `🚫 CCR account ${account.name} does not support model ${requestedModel}${context ? ` ${context}` : ''}`
          )
          return false
        }
      } else if (typeof account.supportedModels === 'object') {
        // 新Formato：映射Tabla
        if (
          Object.keys(account.supportedModels).length > 0 &&
          !ccrAccountService.isModelSupported(account.supportedModels, requestedModel)
        ) {
          logger.info(
            `🚫 CCR account ${account.name} does not support model ${requestedModel}${context ? ` ${context}` : ''}`
          )
          return false
        }
      }
    }

    return true
  }

  // 🎯 统一调度Claude账号（官方和Console）
  async selectAccountForApiKey(
    apiKeyData,
    sessionHash = null,
    requestedModel = null,
    forcedAccount = null
  ) {
    try {
      // 🔒 如果有强制绑定的Cuenta（全局Sesión绑定），仅 claude-official Tipo受影响
      if (forcedAccount && forcedAccount.accountId && forcedAccount.accountType) {
        // ⚠️ 只有 claude-official TipoCuenta受全局Sesión绑定Límite
        // 其他Tipo（bedrock, ccr, claude-console等）忽略绑定，走正常调度
        if (forcedAccount.accountType !== 'claude-official') {
          logger.info(
            `🔗 Session binding ignored for non-official account type: ${forcedAccount.accountType}, proceeding with normal scheduling`
          )
          // 不使用 forcedAccount，继续走下面的正常调度逻辑
        } else {
          // claude-official Tipo需要Verificar可用性并强制使用
          logger.info(
            `🔗 Forced session binding detected: ${forcedAccount.accountId} (${forcedAccount.accountType})`
          )

          const isAvailable = await this._isAccountAvailableForSessionBinding(
            forcedAccount.accountId,
            forcedAccount.accountType,
            requestedModel
          )

          if (isAvailable) {
            logger.info(
              `✅ Using forced session binding account: ${forcedAccount.accountId} (${forcedAccount.accountType})`
            )
            return {
              accountId: forcedAccount.accountId,
              accountType: forcedAccount.accountType
            }
          } else {
            // 绑定Cuenta不可用，抛出特定Error（不 fallback）
            logger.warn(
              `❌ Forced session binding account unavailable: ${forcedAccount.accountId} (${forcedAccount.accountType})`
            )
            const error = new Error('Session binding account unavailable')
            error.code = 'SESSION_BINDING_ACCOUNT_UNAVAILABLE'
            error.accountId = forcedAccount.accountId
            error.accountType = forcedAccount.accountType
            throw error
          }
        }
      }

      // Analizar供应商前缀
      const { vendor, baseModel } = parseVendorPrefixedModel(requestedModel)
      const effectiveModel = vendor === 'ccr' ? baseModel : requestedModel

      logger.debug(
        `🔍 Model parsing - Original: ${requestedModel}, Vendor: ${vendor}, Effective: ${effectiveModel}`
      )
      const isOpusRequest =
        effectiveModel && typeof effectiveModel === 'string'
          ? effectiveModel.toLowerCase().includes('opus')
          : false

      // 如果是 CCR 前缀，只在 CCR Cuenta池中选择
      if (vendor === 'ccr') {
        logger.info(`🎯 CCR vendor prefix detected, routing to CCR accounts only`)
        return await this._selectCcrAccount(apiKeyData, sessionHash, effectiveModel)
      }
      // 如果API Key绑定了专属Cuenta或Agrupar，优先使用
      if (apiKeyData.claudeAccountId) {
        // Verificar是否是Agrupar
        if (apiKeyData.claudeAccountId.startsWith('group:')) {
          const groupId = apiKeyData.claudeAccountId.replace('group:', '')
          logger.info(
            `🎯 API key ${apiKeyData.name} is bound to group ${groupId}, selecting from group`
          )
          return await this.selectAccountFromGroup(
            groupId,
            sessionHash,
            effectiveModel,
            vendor === 'ccr'
          )
        }

        // 普通专属Cuenta
        const boundAccount = await redis.getClaudeAccount(apiKeyData.claudeAccountId)
        if (boundAccount && boundAccount.isActive === 'true' && boundAccount.status !== 'error') {
          // Verificar是否临时不可用
          const isTempUnavailable = await this.isAccountTemporarilyUnavailable(
            boundAccount.id,
            'claude-official'
          )
          if (isTempUnavailable) {
            logger.warn(
              `⏱️ Bound Claude OAuth account ${boundAccount.id} is temporarily unavailable, falling back to pool`
            )
          } else {
            const isRateLimited = await claudeAccountService.isAccountRateLimited(boundAccount.id)
            if (isRateLimited) {
              const rateInfo = await claudeAccountService.getAccountRateLimitInfo(boundAccount.id)
              const error = new Error('Dedicated Claude account is rate limited')
              error.code = 'CLAUDE_DEDICATED_RATE_LIMITED'
              error.accountId = boundAccount.id
              error.rateLimitEndAt = rateInfo?.rateLimitEndAt || boundAccount.rateLimitEndAt || null
              throw error
            }

            if (!isSchedulable(boundAccount.schedulable)) {
              logger.warn(
                `⚠️ Bound Claude OAuth account ${apiKeyData.claudeAccountId} is not schedulable (schedulable: ${boundAccount?.schedulable}), falling back to pool`
              )
            } else {
              if (isOpusRequest) {
                await claudeAccountService.clearExpiredOpusRateLimit(boundAccount.id)
              }
              logger.info(
                `🎯 Using bound dedicated Claude OAuth account: ${boundAccount.name} (${apiKeyData.claudeAccountId}) for API key ${apiKeyData.name}`
              )
              return {
                accountId: apiKeyData.claudeAccountId,
                accountType: 'claude-official'
              }
            }
          }
        } else {
          logger.warn(
            `⚠️ Bound Claude OAuth account ${apiKeyData.claudeAccountId} is not available (isActive: ${boundAccount?.isActive}, status: ${boundAccount?.status}), falling back to pool`
          )
        }
      }

      // 2. VerificarClaude ConsoleCuenta绑定
      if (apiKeyData.claudeConsoleAccountId) {
        const boundConsoleAccount = await claudeConsoleAccountService.getAccount(
          apiKeyData.claudeConsoleAccountId
        )
        if (
          boundConsoleAccount &&
          boundConsoleAccount.isActive === true &&
          boundConsoleAccount.status === 'active' &&
          isSchedulable(boundConsoleAccount.schedulable)
        ) {
          // Verificar是否临时不可用
          const isTempUnavailable = await this.isAccountTemporarilyUnavailable(
            boundConsoleAccount.id,
            'claude-console'
          )
          if (isTempUnavailable) {
            logger.warn(
              `⏱️ Bound Claude Console account ${boundConsoleAccount.id} is temporarily unavailable, falling back to pool`
            )
          } else {
            logger.info(
              `🎯 Using bound dedicated Claude Console account: ${boundConsoleAccount.name} (${apiKeyData.claudeConsoleAccountId}) for API key ${apiKeyData.name}`
            )
            return {
              accountId: apiKeyData.claudeConsoleAccountId,
              accountType: 'claude-console'
            }
          }
        } else {
          logger.warn(
            `⚠️ Bound Claude Console account ${apiKeyData.claudeConsoleAccountId} is not available (isActive: ${boundConsoleAccount?.isActive}, status: ${boundConsoleAccount?.status}, schedulable: ${boundConsoleAccount?.schedulable}), falling back to pool`
          )
        }
      }

      // 3. VerificarBedrockCuenta绑定
      if (apiKeyData.bedrockAccountId) {
        const boundBedrockAccountResult = await bedrockAccountService.getAccount(
          apiKeyData.bedrockAccountId
        )
        if (
          boundBedrockAccountResult.success &&
          boundBedrockAccountResult.data.isActive === true &&
          isSchedulable(boundBedrockAccountResult.data.schedulable)
        ) {
          // Verificar是否临时不可用
          const isTempUnavailable = await this.isAccountTemporarilyUnavailable(
            apiKeyData.bedrockAccountId,
            'bedrock'
          )
          if (isTempUnavailable) {
            logger.warn(
              `⏱️ Bound Bedrock account ${apiKeyData.bedrockAccountId} is temporarily unavailable, falling back to pool`
            )
          } else {
            logger.info(
              `🎯 Using bound dedicated Bedrock account: ${boundBedrockAccountResult.data.name} (${apiKeyData.bedrockAccountId}) for API key ${apiKeyData.name}`
            )
            return {
              accountId: apiKeyData.bedrockAccountId,
              accountType: 'bedrock'
            }
          }
        } else {
          logger.warn(
            `⚠️ Bound Bedrock account ${apiKeyData.bedrockAccountId} is not available (isActive: ${boundBedrockAccountResult?.data?.isActive}, schedulable: ${boundBedrockAccountResult?.data?.schedulable}), falling back to pool`
          )
        }
      }

      // CCR Cuenta不Soportar绑定（仅通过 ccr, 前缀进Fila CCR Ruta）

      // 如果有Sesión哈希，Verificar是否有已映射的Cuenta
      if (sessionHash) {
        const mappedAccount = await this._getSessionMapping(sessionHash)
        if (mappedAccount) {
          // 当本次Solicitud不是 CCR 前缀时，不允许使用指向 CCR 的粘性Sesión映射
          if (vendor !== 'ccr' && mappedAccount.accountType === 'ccr') {
            logger.info(
              `ℹ️ Skipping CCR sticky session mapping for non-CCR request; removing mapping for session ${sessionHash}`
            )
            await this._deleteSessionMapping(sessionHash)
          } else {
            // Validar映射的Cuenta是否仍然可用
            const isAvailable = await this._isAccountAvailable(
              mappedAccount.accountId,
              mappedAccount.accountType,
              effectiveModel
            )
            if (isAvailable) {
              // 🚀 智能Sesión续期：剩余Tiempo少于14天时自动续期到15天（续期正确的 unified 映射键）
              await this._extendSessionMappingTTL(sessionHash)
              logger.info(
                `🎯 Using sticky session account: ${mappedAccount.accountId} (${mappedAccount.accountType}) for session ${sessionHash}`
              )
              return mappedAccount
            } else {
              logger.warn(
                `⚠️ Mapped account ${mappedAccount.accountId} is no longer available, selecting new account`
              )
              await this._deleteSessionMapping(sessionHash)
            }
          }
        }
      }

      // Obtener所有可用Cuenta（传递Solicitud的模型进FilaFiltrar）
      const availableAccounts = await this._getAllAvailableAccounts(
        apiKeyData,
        effectiveModel,
        false // 仅前缀才走 CCR：Predeterminado池不Incluir CCR Cuenta
      )

      if (availableAccounts.length === 0) {
        // 提供更详细的ErrorInformación
        if (effectiveModel) {
          throw new Error(
            `No available Claude accounts support the requested model: ${effectiveModel}`
          )
        } else {
          throw new Error('No available Claude accounts (neither official nor console)')
        }
      }

      // 按优先级和最后使用TiempoOrdenar
      const sortedAccounts = sortAccountsByPriority(availableAccounts)

      // 选择第一个Cuenta
      const selectedAccount = sortedAccounts[0]

      // 如果有Sesión哈希，建立新的映射
      if (sessionHash) {
        await this._setSessionMapping(
          sessionHash,
          selectedAccount.accountId,
          selectedAccount.accountType
        )
        logger.info(
          `🎯 Created new sticky session mapping: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) for session ${sessionHash}`
        )
      }

      logger.info(
        `🎯 Selected account: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) with priority ${selectedAccount.priority} for API key ${apiKeyData.name}`
      )

      return {
        accountId: selectedAccount.accountId,
        accountType: selectedAccount.accountType
      }
    } catch (error) {
      logger.error('❌ Failed to select account for API key:', error)
      throw error
    }
  }

  // 📋 Obtener所有可用Cuenta（合并官方和Console）
  async _getAllAvailableAccounts(apiKeyData, requestedModel = null, includeCcr = false) {
    const availableAccounts = []
    const isOpusRequest =
      requestedModel && typeof requestedModel === 'string'
        ? requestedModel.toLowerCase().includes('opus')
        : false

    // 如果API Key绑定了专属Cuenta，优先Retornar
    // 1. VerificarClaude OAuthCuenta绑定
    if (apiKeyData.claudeAccountId) {
      const boundAccount = await redis.getClaudeAccount(apiKeyData.claudeAccountId)
      if (
        boundAccount &&
        boundAccount.isActive === 'true' &&
        boundAccount.status !== 'error' &&
        boundAccount.status !== 'blocked' &&
        boundAccount.status !== 'temp_error'
      ) {
        const isRateLimited = await claudeAccountService.isAccountRateLimited(boundAccount.id)
        if (isRateLimited) {
          const rateInfo = await claudeAccountService.getAccountRateLimitInfo(boundAccount.id)
          const error = new Error('Dedicated Claude account is rate limited')
          error.code = 'CLAUDE_DEDICATED_RATE_LIMITED'
          error.accountId = boundAccount.id
          error.rateLimitEndAt = rateInfo?.rateLimitEndAt || boundAccount.rateLimitEndAt || null
          throw error
        }

        if (!isSchedulable(boundAccount.schedulable)) {
          logger.warn(
            `⚠️ Bound Claude OAuth account ${apiKeyData.claudeAccountId} is not schedulable (schedulable: ${boundAccount?.schedulable})`
          )
        } else {
          logger.info(
            `🎯 Using bound dedicated Claude OAuth account: ${boundAccount.name} (${apiKeyData.claudeAccountId})`
          )
          return [
            {
              ...boundAccount,
              accountId: boundAccount.id,
              accountType: 'claude-official',
              priority: parseInt(boundAccount.priority) || 50,
              lastUsedAt: boundAccount.lastUsedAt || '0'
            }
          ]
        }
      } else {
        logger.warn(
          `⚠️ Bound Claude OAuth account ${apiKeyData.claudeAccountId} is not available (isActive: ${boundAccount?.isActive}, status: ${boundAccount?.status})`
        )
      }
    }

    // 2. VerificarClaude ConsoleCuenta绑定
    if (apiKeyData.claudeConsoleAccountId) {
      const boundConsoleAccount = await claudeConsoleAccountService.getAccount(
        apiKeyData.claudeConsoleAccountId
      )
      if (
        boundConsoleAccount &&
        boundConsoleAccount.isActive === true &&
        boundConsoleAccount.status === 'active' &&
        isSchedulable(boundConsoleAccount.schedulable)
      ) {
        // 主动触发一次额度Verificar
        try {
          await claudeConsoleAccountService.checkQuotaUsage(boundConsoleAccount.id)
        } catch (e) {
          logger.warn(
            `Failed to check quota for bound Claude Console account ${boundConsoleAccount.name}: ${e.message}`
          )
          // 继续使用该账号
        }

        // Verificar限流状态和额度状态
        const isRateLimited = await claudeConsoleAccountService.isAccountRateLimited(
          boundConsoleAccount.id
        )
        const isQuotaExceeded = await claudeConsoleAccountService.isAccountQuotaExceeded(
          boundConsoleAccount.id
        )

        if (!isRateLimited && !isQuotaExceeded) {
          logger.info(
            `🎯 Using bound dedicated Claude Console account: ${boundConsoleAccount.name} (${apiKeyData.claudeConsoleAccountId})`
          )
          return [
            {
              ...boundConsoleAccount,
              accountId: boundConsoleAccount.id,
              accountType: 'claude-console',
              priority: parseInt(boundConsoleAccount.priority) || 50,
              lastUsedAt: boundConsoleAccount.lastUsedAt || '0'
            }
          ]
        }
      } else {
        logger.warn(
          `⚠️ Bound Claude Console account ${apiKeyData.claudeConsoleAccountId} is not available (isActive: ${boundConsoleAccount?.isActive}, status: ${boundConsoleAccount?.status}, schedulable: ${boundConsoleAccount?.schedulable})`
        )
      }
    }

    // 3. VerificarBedrockCuenta绑定
    if (apiKeyData.bedrockAccountId) {
      const boundBedrockAccountResult = await bedrockAccountService.getAccount(
        apiKeyData.bedrockAccountId
      )
      if (
        boundBedrockAccountResult.success &&
        boundBedrockAccountResult.data.isActive === true &&
        isSchedulable(boundBedrockAccountResult.data.schedulable)
      ) {
        logger.info(
          `🎯 Using bound dedicated Bedrock account: ${boundBedrockAccountResult.data.name} (${apiKeyData.bedrockAccountId})`
        )
        return [
          {
            ...boundBedrockAccountResult.data,
            accountId: boundBedrockAccountResult.data.id,
            accountType: 'bedrock',
            priority: parseInt(boundBedrockAccountResult.data.priority) || 50,
            lastUsedAt: boundBedrockAccountResult.data.lastUsedAt || '0'
          }
        ]
      } else {
        logger.warn(
          `⚠️ Bound Bedrock account ${apiKeyData.bedrockAccountId} is not available (isActive: ${boundBedrockAccountResult?.data?.isActive}, schedulable: ${boundBedrockAccountResult?.data?.schedulable})`
        )
      }
    }

    // Obtener官方ClaudeCuenta（共享池）
    const claudeAccounts = await redis.getAllClaudeAccounts()
    for (const account of claudeAccounts) {
      if (
        account.isActive === 'true' &&
        account.status !== 'error' &&
        account.status !== 'blocked' &&
        account.status !== 'temp_error' &&
        (account.accountType === 'shared' || !account.accountType) && // 兼容旧Datos
        isSchedulable(account.schedulable)
      ) {
        // Verificar是否可调度

        // Verificar模型Soportar
        if (!this._isModelSupportedByAccount(account, 'claude-official', requestedModel)) {
          continue
        }

        // Verificar是否临时不可用
        const isTempUnavailable = await this.isAccountTemporarilyUnavailable(
          account.id,
          'claude-official'
        )
        if (isTempUnavailable) {
          logger.debug(
            `⏭️ Skipping Claude Official account ${account.name} - temporarily unavailable`
          )
          continue
        }

        // Verificar是否被限流
        const isRateLimited = await claudeAccountService.isAccountRateLimited(account.id)
        if (isRateLimited) {
          continue
        }

        if (isOpusRequest) {
          const isOpusRateLimited = await claudeAccountService.isAccountOpusRateLimited(account.id)
          if (isOpusRateLimited) {
            logger.info(
              `🚫 Skipping account ${account.name} (${account.id}) due to active Opus limit`
            )
            continue
          }
        }

        availableAccounts.push({
          ...account,
          accountId: account.id,
          accountType: 'claude-official',
          priority: parseInt(account.priority) || 50, // Predeterminado优先级50
          lastUsedAt: account.lastUsedAt || '0'
        })
      }
    }

    // ObtenerClaude ConsoleCuenta
    const consoleAccounts = await claudeConsoleAccountService.getAllAccounts()
    logger.info(`📋 Found ${consoleAccounts.length} total Claude Console accounts`)

    // 🔢 EstadísticaConsoleCuentaConcurrenciaExcluir情况
    let consoleAccountsEligibleCount = 0 // 符合基本Condición的Cuenta数
    let consoleAccountsExcludedByConcurrency = 0 // 因Concurrencia满额被Excluir的Cuenta数

    // 🚀 收集需要ConcurrenciaVerificar的CuentaIDColumnaTabla（批量ConsultaOptimización）
    const accountsNeedingConcurrencyCheck = []

    for (const account of consoleAccounts) {
      // 主动Verificar封禁状态并尝试Restauración（在Filtrar之前Ejecutar，确保可以Restauración被封禁的Cuenta）
      const wasBlocked = await claudeConsoleAccountService.isAccountBlocked(account.id)

      // 如果Cuenta之前被封禁但现在已Restauración，重新Obtener最新状态
      let currentAccount = account
      if (wasBlocked === false && account.status === 'account_blocked') {
        // 可能刚刚被Restauración，重新ObtenerCuenta状态
        const freshAccount = await claudeConsoleAccountService.getAccount(account.id)
        if (freshAccount) {
          currentAccount = freshAccount
          logger.info(`🔄 Account ${account.name} was recovered from blocked status`)
        }
      }

      // 主动VerificarCuota超限状态并尝试Restauración（在Filtrar之前Ejecutar，确保可以RestauraciónCuota超限的Cuenta）
      if (currentAccount.status === 'quota_exceeded') {
        // 触发CuotaVerificar，如果已到重置Tiempo会自动RestauraciónCuenta
        const isStillExceeded = await claudeConsoleAccountService.isAccountQuotaExceeded(
          currentAccount.id
        )
        if (!isStillExceeded) {
          // 重新ObtenerCuenta最新状态
          const refreshedAccount = await claudeConsoleAccountService.getAccount(currentAccount.id)
          if (refreshedAccount) {
            // Actualizar当前Bucle中的CuentaDatos
            currentAccount = refreshedAccount
            logger.info(`✅ Account ${currentAccount.name} recovered from quota_exceeded status`)
          }
        }
      }

      logger.info(
        `🔍 Checking Claude Console account: ${currentAccount.name} - isActive: ${currentAccount.isActive}, status: ${currentAccount.status}, accountType: ${currentAccount.accountType}, schedulable: ${currentAccount.schedulable}`
      )

      // 注意：getAllAccountsRetornar的isActive是布尔Valor，getAccountRetornar的也是布尔Valor
      if (
        currentAccount.isActive === true &&
        currentAccount.status === 'active' &&
        currentAccount.accountType === 'shared' &&
        isSchedulable(currentAccount.schedulable)
      ) {
        // Verificar是否可调度

        // Verificar模型Soportar
        if (!this._isModelSupportedByAccount(currentAccount, 'claude-console', requestedModel)) {
          continue
        }

        // Verificar订阅是否过期
        if (claudeConsoleAccountService.isSubscriptionExpired(currentAccount)) {
          logger.debug(
            `⏰ Claude Console account ${currentAccount.name} (${currentAccount.id}) expired at ${currentAccount.subscriptionExpiresAt}`
          )
          continue
        }

        // 主动触发一次额度Verificar，确保状态即时生效
        try {
          await claudeConsoleAccountService.checkQuotaUsage(currentAccount.id)
        } catch (e) {
          logger.warn(
            `Failed to check quota for Claude Console account ${currentAccount.name}: ${e.message}`
          )
          // 继续Procesar该账号
        }

        // Verificar是否临时不可用
        const isTempUnavailable = await this.isAccountTemporarilyUnavailable(
          currentAccount.id,
          'claude-console'
        )
        if (isTempUnavailable) {
          logger.debug(
            `⏭️ Skipping Claude Console account ${currentAccount.name} - temporarily unavailable`
          )
          continue
        }

        // Verificar是否被限流
        const isRateLimited = await claudeConsoleAccountService.isAccountRateLimited(
          currentAccount.id
        )
        const isQuotaExceeded = await claudeConsoleAccountService.isAccountQuotaExceeded(
          currentAccount.id
        )

        // 🔢 Registro符合基本Condición的Cuenta（通过了前面所有Verificar，但可能因Concurrencia被Excluir）
        if (!isRateLimited && !isQuotaExceeded) {
          consoleAccountsEligibleCount++
          // 🚀 将符合Condición且需要ConcurrenciaVerificar的Cuenta加入批量ConsultaColumnaTabla
          if (currentAccount.maxConcurrentTasks > 0) {
            accountsNeedingConcurrencyCheck.push(currentAccount)
          } else {
            // 未ConfiguraciónConcurrenciaLímite的Cuenta直接加入可用池
            availableAccounts.push({
              ...currentAccount,
              accountId: currentAccount.id,
              accountType: 'claude-console',
              priority: parseInt(currentAccount.priority) || 50,
              lastUsedAt: currentAccount.lastUsedAt || '0'
            })
            logger.info(
              `✅ Added Claude Console account to available pool: ${currentAccount.name} (priority: ${currentAccount.priority}, no concurrency limit)`
            )
          }
        } else {
          if (isRateLimited) {
            logger.warn(`⚠️ Claude Console account ${currentAccount.name} is rate limited`)
          }
          if (isQuotaExceeded) {
            logger.warn(`💰 Claude Console account ${currentAccount.name} quota exceeded`)
          }
        }
      } else {
        logger.info(
          `❌ Claude Console account ${currentAccount.name} not eligible - isActive: ${currentAccount.isActive}, status: ${currentAccount.status}, accountType: ${currentAccount.accountType}, schedulable: ${currentAccount.schedulable}`
        )
      }
    }

    // 🚀 批量Consulta所有Cuenta的Nivel de concurrencia（Promise.all 并FilaEjecutar）
    if (accountsNeedingConcurrencyCheck.length > 0) {
      logger.debug(
        `🚀 Batch checking concurrency for ${accountsNeedingConcurrencyCheck.length} accounts`
      )

      const concurrencyCheckPromises = accountsNeedingConcurrencyCheck.map((account) =>
        redis.getConsoleAccountConcurrency(account.id).then((currentConcurrency) => ({
          account,
          currentConcurrency
        }))
      )

      const concurrencyResults = await Promise.all(concurrencyCheckPromises)

      // Procesar批量Consulta结果
      for (const { account, currentConcurrency } of concurrencyResults) {
        const isConcurrencyFull = currentConcurrency >= account.maxConcurrentTasks

        if (!isConcurrencyFull) {
          availableAccounts.push({
            ...account,
            accountId: account.id,
            accountType: 'claude-console',
            priority: parseInt(account.priority) || 50,
            lastUsedAt: account.lastUsedAt || '0'
          })
          logger.info(
            `✅ Added Claude Console account to available pool: ${account.name} (priority: ${account.priority}, concurrency: ${currentConcurrency}/${account.maxConcurrentTasks})`
          )
        } else {
          // 🔢 因Concurrencia满额被Excluir，计数器加1
          consoleAccountsExcludedByConcurrency++
          logger.warn(
            `⚠️ Claude Console account ${account.name} reached concurrency limit: ${currentConcurrency}/${account.maxConcurrentTasks}`
          )
        }
      }
    }

    // ObtenerBedrockCuenta（共享池）
    const bedrockAccountsResult = await bedrockAccountService.getAllAccounts()
    if (bedrockAccountsResult.success) {
      const bedrockAccounts = bedrockAccountsResult.data
      logger.info(`📋 Found ${bedrockAccounts.length} total Bedrock accounts`)

      for (const account of bedrockAccounts) {
        logger.info(
          `🔍 Checking Bedrock account: ${account.name} - isActive: ${account.isActive}, accountType: ${account.accountType}, schedulable: ${account.schedulable}`
        )

        if (
          account.isActive === true &&
          account.accountType === 'shared' &&
          isSchedulable(account.schedulable)
        ) {
          // Verificar是否临时不可用
          const isTempUnavailable = await this.isAccountTemporarilyUnavailable(
            account.id,
            'bedrock'
          )
          if (isTempUnavailable) {
            logger.debug(`⏭️ Skipping Bedrock account ${account.name} - temporarily unavailable`)
            continue
          }

          availableAccounts.push({
            ...account,
            accountId: account.id,
            accountType: 'bedrock',
            priority: parseInt(account.priority) || 50,
            lastUsedAt: account.lastUsedAt || '0'
          })
          logger.info(
            `✅ Added Bedrock account to available pool: ${account.name} (priority: ${account.priority})`
          )
        } else {
          logger.info(
            `❌ Bedrock account ${account.name} not eligible - isActive: ${account.isActive}, accountType: ${account.accountType}, schedulable: ${account.schedulable}`
          )
        }
      }
    }

    // ObtenerCCRCuenta（共享池）- 仅当明确要求Incluir时
    if (includeCcr) {
      const ccrAccounts = await ccrAccountService.getAllAccounts()
      logger.info(`📋 Found ${ccrAccounts.length} total CCR accounts`)

      for (const account of ccrAccounts) {
        logger.info(
          `🔍 Checking CCR account: ${account.name} - isActive: ${account.isActive}, status: ${account.status}, accountType: ${account.accountType}, schedulable: ${account.schedulable}`
        )

        if (
          account.isActive === true &&
          account.status === 'active' &&
          account.accountType === 'shared' &&
          isSchedulable(account.schedulable)
        ) {
          // Verificar模型Soportar
          if (!this._isModelSupportedByAccount(account, 'ccr', requestedModel)) {
            continue
          }

          // Verificar订阅是否过期
          if (ccrAccountService.isSubscriptionExpired(account)) {
            logger.debug(
              `⏰ CCR account ${account.name} (${account.id}) expired at ${account.subscriptionExpiresAt}`
            )
            continue
          }

          // Verificar是否临时不可用
          const isTempUnavailable = await this.isAccountTemporarilyUnavailable(account.id, 'ccr')
          if (isTempUnavailable) {
            logger.debug(`⏭️ Skipping CCR account ${account.name} - temporarily unavailable`)
            continue
          }

          // Verificar是否被限流
          const isRateLimited = await ccrAccountService.isAccountRateLimited(account.id)
          const isQuotaExceeded = await ccrAccountService.isAccountQuotaExceeded(account.id)

          if (!isRateLimited && !isQuotaExceeded) {
            availableAccounts.push({
              ...account,
              accountId: account.id,
              accountType: 'ccr',
              priority: parseInt(account.priority) || 50,
              lastUsedAt: account.lastUsedAt || '0'
            })
            logger.info(
              `✅ Added CCR account to available pool: ${account.name} (priority: ${account.priority})`
            )
          } else {
            if (isRateLimited) {
              logger.warn(`⚠️ CCR account ${account.name} is rate limited`)
            }
            if (isQuotaExceeded) {
              logger.warn(`💰 CCR account ${account.name} quota exceeded`)
            }
          }
        } else {
          logger.info(
            `❌ CCR account ${account.name} not eligible - isActive: ${account.isActive}, status: ${account.status}, accountType: ${account.accountType}, schedulable: ${account.schedulable}`
          )
        }
      }
    }

    logger.info(
      `📊 Total available accounts: ${availableAccounts.length} (Claude: ${availableAccounts.filter((a) => a.accountType === 'claude-official').length}, Console: ${availableAccounts.filter((a) => a.accountType === 'claude-console').length}, Bedrock: ${availableAccounts.filter((a) => a.accountType === 'bedrock').length}, CCR: ${availableAccounts.filter((a) => a.accountType === 'ccr').length})`
    )

    // 🚨 最终Verificar：只有在没有任何可用Cuenta时，才根据ConsoleConcurrenciaExcluir情况抛出专用Error码
    if (availableAccounts.length === 0) {
      // 如果所有ConsoleCuenta都因Concurrencia满额被Excluir，抛出专用Error码（503）
      if (
        consoleAccountsEligibleCount > 0 &&
        consoleAccountsExcludedByConcurrency === consoleAccountsEligibleCount
      ) {
        logger.error(
          `❌ All ${consoleAccountsEligibleCount} eligible Console accounts are at concurrency limit (no other account types available)`
        )
        const error = new Error(
          'All available Claude Console accounts have reached their concurrency limit'
        )
        error.code = 'CONSOLE_ACCOUNT_CONCURRENCY_FULL'
        throw error
      }
      // 否则走通用的"无可用Cuenta"ErrorProcesar（由上层 selectAccountForApiKey 捕获）
    }

    return availableAccounts
  }

  // 🔍 VerificarCuenta是否可用
  async _isAccountAvailable(accountId, accountType, requestedModel = null) {
    try {
      if (accountType === 'claude-official') {
        const account = await redis.getClaudeAccount(accountId)
        if (
          !account ||
          account.isActive !== 'true' ||
          account.status === 'error' ||
          account.status === 'temp_error'
        ) {
          return false
        }
        // Verificar是否可调度
        if (!isSchedulable(account.schedulable)) {
          logger.info(`🚫 Account ${accountId} is not schedulable`)
          return false
        }

        // Verificar模型兼容性
        if (
          !this._isModelSupportedByAccount(
            account,
            'claude-official',
            requestedModel,
            'in session check'
          )
        ) {
          return false
        }

        // Verificar是否限流或过载
        const isRateLimited = await claudeAccountService.isAccountRateLimited(accountId)
        const isOverloaded = await claudeAccountService.isAccountOverloaded(accountId)
        if (isRateLimited || isOverloaded) {
          return false
        }

        if (
          requestedModel &&
          typeof requestedModel === 'string' &&
          requestedModel.toLowerCase().includes('opus')
        ) {
          const isOpusRateLimited = await claudeAccountService.isAccountOpusRateLimited(accountId)
          if (isOpusRateLimited) {
            logger.info(`🚫 Account ${accountId} skipped due to active Opus limit (session check)`)
            return false
          }
        }

        return true
      } else if (accountType === 'claude-console') {
        const account = await claudeConsoleAccountService.getAccount(accountId)
        if (!account || !account.isActive) {
          return false
        }
        // VerificarCuenta状态
        if (
          account.status !== 'active' &&
          account.status !== 'unauthorized' &&
          account.status !== 'overloaded'
        ) {
          return false
        }
        // Verificar是否可调度
        if (!isSchedulable(account.schedulable)) {
          logger.info(`🚫 Claude Console account ${accountId} is not schedulable`)
          return false
        }
        // Verificar模型Soportar
        if (
          !this._isModelSupportedByAccount(
            account,
            'claude-console',
            requestedModel,
            'in session check'
          )
        ) {
          return false
        }
        // Verificar订阅是否过期
        if (claudeConsoleAccountService.isSubscriptionExpired(account)) {
          logger.debug(
            `⏰ Claude Console account ${account.name} (${accountId}) expired at ${account.subscriptionExpiresAt} (session check)`
          )
          return false
        }
        // Verificar是否超额
        try {
          await claudeConsoleAccountService.checkQuotaUsage(accountId)
        } catch (e) {
          logger.warn(`Failed to check quota for Claude Console account ${accountId}: ${e.message}`)
          // 继续Procesar
        }

        // Verificar是否被限流
        if (await claudeConsoleAccountService.isAccountRateLimited(accountId)) {
          return false
        }
        if (await claudeConsoleAccountService.isAccountQuotaExceeded(accountId)) {
          return false
        }
        // Verificar是否未授权（401Error）
        if (account.status === 'unauthorized') {
          return false
        }
        // Verificar是否过载（529Error）
        if (await claudeConsoleAccountService.isAccountOverloaded(accountId)) {
          return false
        }

        // VerificarConcurrenciaLímite（预Verificar，真正的原子抢占在 relayService 中进Fila）
        if (account.maxConcurrentTasks > 0) {
          const currentConcurrency = await redis.getConsoleAccountConcurrency(accountId)
          if (currentConcurrency >= account.maxConcurrentTasks) {
            logger.info(
              `🚫 Claude Console account ${accountId} reached concurrency limit: ${currentConcurrency}/${account.maxConcurrentTasks} (pre-check)`
            )
            return false
          }
        }

        return true
      } else if (accountType === 'bedrock') {
        const accountResult = await bedrockAccountService.getAccount(accountId)
        if (!accountResult.success || !accountResult.data.isActive) {
          return false
        }
        // Verificar是否可调度
        if (!isSchedulable(accountResult.data.schedulable)) {
          logger.info(`🚫 Bedrock account ${accountId} is not schedulable`)
          return false
        }
        // BedrockCuenta暂不需要限流Verificar，因为AWS管理限流
        return true
      } else if (accountType === 'ccr') {
        const account = await ccrAccountService.getAccount(accountId)
        if (!account || !account.isActive) {
          return false
        }
        // VerificarCuenta状态
        if (
          account.status !== 'active' &&
          account.status !== 'unauthorized' &&
          account.status !== 'overloaded'
        ) {
          return false
        }
        // Verificar是否可调度
        if (!isSchedulable(account.schedulable)) {
          logger.info(`🚫 CCR account ${accountId} is not schedulable`)
          return false
        }
        // Verificar模型Soportar
        if (!this._isModelSupportedByAccount(account, 'ccr', requestedModel, 'in session check')) {
          return false
        }
        // Verificar订阅是否过期
        if (ccrAccountService.isSubscriptionExpired(account)) {
          logger.debug(
            `⏰ CCR account ${account.name} (${accountId}) expired at ${account.subscriptionExpiresAt} (session check)`
          )
          return false
        }
        // Verificar是否超额
        try {
          await ccrAccountService.checkQuotaUsage(accountId)
        } catch (e) {
          logger.warn(`Failed to check quota for CCR account ${accountId}: ${e.message}`)
          // 继续Procesar
        }

        // Verificar是否被限流
        if (await ccrAccountService.isAccountRateLimited(accountId)) {
          return false
        }
        if (await ccrAccountService.isAccountQuotaExceeded(accountId)) {
          return false
        }
        // Verificar是否未授权（401Error）
        if (account.status === 'unauthorized') {
          return false
        }
        // Verificar是否过载（529Error）
        if (await ccrAccountService.isAccountOverloaded(accountId)) {
          return false
        }
        return true
      }
      return false
    } catch (error) {
      logger.warn(`⚠️ Failed to check account availability: ${accountId}`, error)
      return false
    }
  }

  // 🔗 ObtenerSesión映射
  async _getSessionMapping(sessionHash) {
    const client = redis.getClientSafe()
    const mappingData = await client.get(`${this.SESSION_MAPPING_PREFIX}${sessionHash}`)

    if (mappingData) {
      try {
        return JSON.parse(mappingData)
      } catch (error) {
        logger.warn('⚠️ Failed to parse session mapping:', error)
        return null
      }
    }

    return null
  }

  // 💾 EstablecerSesión映射
  async _setSessionMapping(sessionHash, accountId, accountType) {
    const client = redis.getClientSafe()
    const mappingData = JSON.stringify({ accountId, accountType })
    // 依据ConfiguraciónEstablecerTTL（小时）
    const appConfig = require('../../../config/config')
    const ttlHours = appConfig.session?.stickyTtlHours || 1
    const ttlSeconds = Math.max(1, Math.floor(ttlHours * 60 * 60))
    await client.setex(`${this.SESSION_MAPPING_PREFIX}${sessionHash}`, ttlSeconds, mappingData)
  }

  // 🗑️ EliminarSesión映射
  async _deleteSessionMapping(sessionHash) {
    const client = redis.getClientSafe()
    await client.del(`${this.SESSION_MAPPING_PREFIX}${sessionHash}`)
  }

  /**
   * 🧹 公共Método：Limpiar粘性Sesión映射（用于Concurrencia满额时的DegradaciónProcesar）
   * @param {string} sessionHash - Sesión哈希Valor
   */
  async clearSessionMapping(sessionHash) {
    // 防御空Sesión哈希
    if (!sessionHash || typeof sessionHash !== 'string') {
      logger.debug('⚠️ Skipping session mapping clear - invalid sessionHash')
      return
    }

    try {
      await this._deleteSessionMapping(sessionHash)
      logger.info(
        `🧹 Cleared sticky session mapping for session: ${sessionHash.substring(0, 8)}...`
      )
    } catch (error) {
      logger.error(`❌ Failed to clear session mapping for ${sessionHash}:`, error)
      throw error
    }
  }

  // 🔁 续期统一调度Sesión映射TTL（针对 unified_claude_session_mapping:* 键），遵循SesiónConfiguración
  async _extendSessionMappingTTL(sessionHash) {
    try {
      const client = redis.getClientSafe()
      const key = `${this.SESSION_MAPPING_PREFIX}${sessionHash}`
      const remainingTTL = await client.ttl(key)

      // -2: key 不存在；-1: 无过期Tiempo
      if (remainingTTL === -2) {
        return false
      }
      if (remainingTTL === -1) {
        return true
      }

      const appConfig = require('../../../config/config')
      const ttlHours = appConfig.session?.stickyTtlHours || 1
      const renewalThresholdMinutes = appConfig.session?.renewalThresholdMinutes || 0

      // 阈Valor为0则不续期
      if (!renewalThresholdMinutes) {
        return true
      }

      const fullTTL = Math.max(1, Math.floor(ttlHours * 60 * 60))
      const threshold = Math.max(0, Math.floor(renewalThresholdMinutes * 60))

      if (remainingTTL < threshold) {
        await client.expire(key, fullTTL)
        logger.debug(
          `🔄 Renewed unified session TTL: ${sessionHash} (was ${Math.round(remainingTTL / 60)}m, renewed to ${ttlHours}h)`
        )
      } else {
        logger.debug(
          `✅ Unified session TTL sufficient: ${sessionHash} (remaining ${Math.round(remainingTTL / 60)}m)`
        )
      }
      return true
    } catch (error) {
      logger.error('❌ Failed to extend unified session TTL:', error)
      return false
    }
  }

  // ⏱️ 标记Cuenta为临时不可用状态（用于5xx等临时故障，Predeterminado5分钟后自动Restauración）
  async markAccountTemporarilyUnavailable(
    accountId,
    accountType,
    sessionHash = null,
    ttlSeconds = 300
  ) {
    try {
      await upstreamErrorHelper.markTempUnavailable(accountId, accountType, 500, ttlSeconds)
      if (sessionHash) {
        await this._deleteSessionMapping(sessionHash)
      }
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to mark account temporarily unavailable: ${accountId}`, error)
      return { success: false }
    }
  }

  // 🔍 VerificarCuenta是否临时不可用
  async isAccountTemporarilyUnavailable(accountId, accountType) {
    return upstreamErrorHelper.isTempUnavailable(accountId, accountType)
  }

  // 🚫 标记Cuenta为限流状态
  async markAccountRateLimited(
    accountId,
    accountType,
    sessionHash = null,
    rateLimitResetTimestamp = null
  ) {
    try {
      if (accountType === 'claude-official') {
        await claudeAccountService.markAccountRateLimited(
          accountId,
          sessionHash,
          rateLimitResetTimestamp
        )
      } else if (accountType === 'claude-console') {
        await claudeConsoleAccountService.markAccountRateLimited(accountId)
      } else if (accountType === 'ccr') {
        await ccrAccountService.markAccountRateLimited(accountId)
      }

      // EliminarSesión映射
      if (sessionHash) {
        await this._deleteSessionMapping(sessionHash)
      }

      return { success: true }
    } catch (error) {
      logger.error(
        `❌ Failed to mark account as rate limited: ${accountId} (${accountType})`,
        error
      )
      throw error
    }
  }

  // ✅ EliminaciónCuenta的限流状态
  async removeAccountRateLimit(accountId, accountType) {
    try {
      if (accountType === 'claude-official') {
        await claudeAccountService.removeAccountRateLimit(accountId)
      } else if (accountType === 'claude-console') {
        await claudeConsoleAccountService.removeAccountRateLimit(accountId)
      } else if (accountType === 'ccr') {
        await ccrAccountService.removeAccountRateLimit(accountId)
      }

      return { success: true }
    } catch (error) {
      logger.error(
        `❌ Failed to remove rate limit for account: ${accountId} (${accountType})`,
        error
      )
      throw error
    }
  }

  // 🔍 VerificarCuenta是否处于限流状态
  async isAccountRateLimited(accountId, accountType) {
    try {
      if (accountType === 'claude-official') {
        return await claudeAccountService.isAccountRateLimited(accountId)
      } else if (accountType === 'claude-console') {
        return await claudeConsoleAccountService.isAccountRateLimited(accountId)
      } else if (accountType === 'ccr') {
        return await ccrAccountService.isAccountRateLimited(accountId)
      }
      return false
    } catch (error) {
      logger.error(`❌ Failed to check rate limit status: ${accountId} (${accountType})`, error)
      return false
    }
  }

  // 🚫 标记Cuenta为未授权状态（401Error）
  async markAccountUnauthorized(accountId, accountType, sessionHash = null) {
    try {
      // 只Procesarclaude-officialTipo的Cuenta，不Procesarclaude-console和gemini
      if (accountType === 'claude-official') {
        await claudeAccountService.markAccountUnauthorized(accountId, sessionHash)

        // EliminarSesión映射
        if (sessionHash) {
          await this._deleteSessionMapping(sessionHash)
        }

        logger.warn(`🚫 Account ${accountId} marked as unauthorized due to consecutive 401 errors`)
      } else {
        logger.info(
          `ℹ️ Skipping unauthorized marking for non-Claude OAuth account: ${accountId} (${accountType})`
        )
      }

      return { success: true }
    } catch (error) {
      logger.error(
        `❌ Failed to mark account as unauthorized: ${accountId} (${accountType})`,
        error
      )
      throw error
    }
  }

  // 🚫 标记Cuenta为被封锁状态（403Error）
  async markAccountBlocked(accountId, accountType, sessionHash = null) {
    try {
      // 只Procesarclaude-officialTipo的Cuenta，不Procesarclaude-console和gemini
      if (accountType === 'claude-official') {
        await claudeAccountService.markAccountBlocked(accountId, sessionHash)

        // EliminarSesión映射
        if (sessionHash) {
          await this._deleteSessionMapping(sessionHash)
        }

        logger.warn(`🚫 Account ${accountId} marked as blocked due to 403 error`)
      } else {
        logger.info(
          `ℹ️ Skipping blocked marking for non-Claude OAuth account: ${accountId} (${accountType})`
        )
      }

      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to mark account as blocked: ${accountId} (${accountType})`, error)
      throw error
    }
  }

  // 🚫 标记Claude ConsoleCuenta为封锁状态（模型不Soportar）
  async blockConsoleAccount(accountId, reason) {
    try {
      await claudeConsoleAccountService.blockAccount(accountId, reason)
      return { success: true }
    } catch (error) {
      logger.error(`❌ Failed to block console account: ${accountId}`, error)
      throw error
    }
  }

  // 👥 从Agrupar中选择Cuenta
  async selectAccountFromGroup(
    groupId,
    sessionHash = null,
    requestedModel = null,
    allowCcr = false
  ) {
    try {
      // ObtenerAgruparInformación
      const group = await accountGroupService.getGroup(groupId)
      if (!group) {
        throw new Error(`Group ${groupId} not found`)
      }

      logger.info(`👥 Selecting account from group: ${group.name} (${group.platform})`)

      // 如果有Sesión哈希，Verificar是否有已映射的Cuenta
      if (sessionHash) {
        const mappedAccount = await this._getSessionMapping(sessionHash)
        if (mappedAccount) {
          // Validar映射的Cuenta是否属于这个Agrupar
          const memberIds = await accountGroupService.getGroupMembers(groupId)
          if (memberIds.includes(mappedAccount.accountId)) {
            // 非 CCR Solicitud时不允许 CCR 粘性映射
            if (!allowCcr && mappedAccount.accountType === 'ccr') {
              await this._deleteSessionMapping(sessionHash)
            } else {
              const isAvailable = await this._isAccountAvailable(
                mappedAccount.accountId,
                mappedAccount.accountType,
                requestedModel
              )
              if (isAvailable) {
                // 🚀 智能Sesión续期：续期 unified 映射键
                await this._extendSessionMappingTTL(sessionHash)
                logger.info(
                  `🎯 Using sticky session account from group: ${mappedAccount.accountId} (${mappedAccount.accountType}) for session ${sessionHash}`
                )
                return mappedAccount
              }
            }
          }
          // 如果映射的Cuenta不可用或不在Agrupar中，Eliminar映射
          await this._deleteSessionMapping(sessionHash)
        }
      }

      // ObtenerAgrupar内的所有Cuenta
      const memberIds = await accountGroupService.getGroupMembers(groupId)
      if (memberIds.length === 0) {
        throw new Error(`Group ${group.name} has no members`)
      }

      const availableAccounts = []
      const isOpusRequest =
        requestedModel && typeof requestedModel === 'string'
          ? requestedModel.toLowerCase().includes('opus')
          : false

      // Obtener所有成员Cuenta的详细Información
      for (const memberId of memberIds) {
        let account = null
        let accountType = null

        // 根据平台TipoObtenerCuenta
        if (group.platform === 'claude') {
          // 先尝试官方Cuenta
          account = await redis.getClaudeAccount(memberId)
          if (account?.id) {
            accountType = 'claude-official'
          } else {
            // 尝试ConsoleCuenta
            account = await claudeConsoleAccountService.getAccount(memberId)
            if (account) {
              accountType = 'claude-console'
            } else {
              // 尝试CCRCuenta（仅允许在 allowCcr 为 true 时）
              if (allowCcr) {
                account = await ccrAccountService.getAccount(memberId)
                if (account) {
                  accountType = 'ccr'
                }
              }
            }
          }
        } else if (group.platform === 'gemini') {
          // Gemini暂时不Soportar，预留Interfaz
          logger.warn('⚠️ Gemini group scheduling not yet implemented')
          continue
        }

        if (!account) {
          logger.warn(`⚠️ Account ${memberId} not found in group ${group.name}`)
          continue
        }

        // VerificarCuenta是否可用
        const isActive =
          accountType === 'claude-official'
            ? account.isActive === 'true'
            : account.isActive === true

        const status =
          accountType === 'claude-official'
            ? account.status !== 'error' && account.status !== 'blocked'
            : accountType === 'ccr'
              ? account.status === 'active'
              : account.status === 'active'

        if (isActive && status && isSchedulable(account.schedulable)) {
          // Verificar模型Soportar
          if (!this._isModelSupportedByAccount(account, accountType, requestedModel, 'in group')) {
            continue
          }

          // Verificar是否被限流
          const isRateLimited = await this.isAccountRateLimited(account.id, accountType)
          if (isRateLimited) {
            continue
          }

          if (accountType === 'claude-official' && isOpusRequest) {
            const isOpusRateLimited = await claudeAccountService.isAccountOpusRateLimited(
              account.id
            )
            if (isOpusRateLimited) {
              logger.info(
                `🚫 Skipping group member ${account.name} (${account.id}) due to active Opus limit`
              )
              continue
            }
          }

          // 🔒 Verificar Claude Console Cuenta的ConcurrenciaLímite
          if (accountType === 'claude-console' && account.maxConcurrentTasks > 0) {
            const currentConcurrency = await redis.getConsoleAccountConcurrency(account.id)
            if (currentConcurrency >= account.maxConcurrentTasks) {
              logger.info(
                `🚫 Skipping group member ${account.name} (${account.id}) due to concurrency limit: ${currentConcurrency}/${account.maxConcurrentTasks}`
              )
              continue
            }
          }

          availableAccounts.push({
            ...account,
            accountId: account.id,
            accountType,
            priority: parseInt(account.priority) || 50,
            lastUsedAt: account.lastUsedAt || '0'
          })
        }
      }

      if (availableAccounts.length === 0) {
        throw new Error(`No available accounts in group ${group.name}`)
      }

      // 使用现有的优先级Ordenar逻辑
      const sortedAccounts = sortAccountsByPriority(availableAccounts)

      // 选择第一个Cuenta
      const selectedAccount = sortedAccounts[0]

      // 如果有Sesión哈希，建立新的映射
      if (sessionHash) {
        await this._setSessionMapping(
          sessionHash,
          selectedAccount.accountId,
          selectedAccount.accountType
        )
        logger.info(
          `🎯 Created new sticky session mapping in group: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) for session ${sessionHash}`
        )
      }

      logger.info(
        `🎯 Selected account from group ${group.name}: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) with priority ${selectedAccount.priority}`
      )

      return {
        accountId: selectedAccount.accountId,
        accountType: selectedAccount.accountType
      }
    } catch (error) {
      logger.error(`❌ Failed to select account from group ${groupId}:`, error)
      throw error
    }
  }

  // 🎯 专门选择CCRCuenta（仅限CCR前缀Ruta使用）
  async _selectCcrAccount(apiKeyData, sessionHash = null, effectiveModel = null) {
    try {
      // 1. VerificarSesión粘性
      if (sessionHash) {
        const mappedAccount = await this._getSessionMapping(sessionHash)
        if (mappedAccount && mappedAccount.accountType === 'ccr') {
          // Validar映射的CCRCuenta是否仍然可用
          const isAvailable = await this._isAccountAvailable(
            mappedAccount.accountId,
            mappedAccount.accountType,
            effectiveModel
          )
          if (isAvailable) {
            // 🚀 智能Sesión续期：续期 unified 映射键
            await this._extendSessionMappingTTL(sessionHash)
            logger.info(
              `🎯 Using sticky CCR session account: ${mappedAccount.accountId} for session ${sessionHash}`
            )
            return mappedAccount
          } else {
            logger.warn(
              `⚠️ Mapped CCR account ${mappedAccount.accountId} is no longer available, selecting new account`
            )
            await this._deleteSessionMapping(sessionHash)
          }
        }
      }

      // 2. Obtener所有可用的CCRCuenta
      const availableCcrAccounts = await this._getAvailableCcrAccounts(effectiveModel)

      if (availableCcrAccounts.length === 0) {
        throw new Error(
          `No available CCR accounts support the requested model: ${effectiveModel || 'unspecified'}`
        )
      }

      // 3. 按优先级和最后使用TiempoOrdenar
      const sortedAccounts = sortAccountsByPriority(availableCcrAccounts)
      const selectedAccount = sortedAccounts[0]

      // 4. 建立Sesión映射
      if (sessionHash) {
        await this._setSessionMapping(
          sessionHash,
          selectedAccount.accountId,
          selectedAccount.accountType
        )
        logger.info(
          `🎯 Created new sticky CCR session mapping: ${selectedAccount.name} (${selectedAccount.accountId}) for session ${sessionHash}`
        )
      }

      logger.info(
        `🎯 Selected CCR account: ${selectedAccount.name} (${selectedAccount.accountId}) with priority ${selectedAccount.priority} for API key ${apiKeyData.name}`
      )

      return {
        accountId: selectedAccount.accountId,
        accountType: selectedAccount.accountType
      }
    } catch (error) {
      logger.error('❌ Failed to select CCR account:', error)
      throw error
    }
  }

  // 📋 Obtener所有可用的CCRCuenta
  async _getAvailableCcrAccounts(requestedModel = null) {
    const availableAccounts = []

    try {
      const ccrAccounts = await ccrAccountService.getAllAccounts()
      logger.info(`📋 Found ${ccrAccounts.length} total CCR accounts for CCR-only selection`)

      for (const account of ccrAccounts) {
        logger.debug(
          `🔍 Checking CCR account: ${account.name} - isActive: ${account.isActive}, status: ${account.status}, accountType: ${account.accountType}, schedulable: ${account.schedulable}`
        )

        if (
          account.isActive === true &&
          account.status === 'active' &&
          account.accountType === 'shared' &&
          isSchedulable(account.schedulable)
        ) {
          // Verificar模型Soportar
          if (!this._isModelSupportedByAccount(account, 'ccr', requestedModel)) {
            logger.debug(`CCR account ${account.name} does not support model ${requestedModel}`)
            continue
          }

          // Verificar订阅是否过期
          if (ccrAccountService.isSubscriptionExpired(account)) {
            logger.debug(
              `⏰ CCR account ${account.name} (${account.id}) expired at ${account.subscriptionExpiresAt}`
            )
            continue
          }

          // Verificar是否被限流或超额
          const isRateLimited = await ccrAccountService.isAccountRateLimited(account.id)
          const isQuotaExceeded = await ccrAccountService.isAccountQuotaExceeded(account.id)
          const isOverloaded = await ccrAccountService.isAccountOverloaded(account.id)

          if (!isRateLimited && !isQuotaExceeded && !isOverloaded) {
            availableAccounts.push({
              ...account,
              accountId: account.id,
              accountType: 'ccr',
              priority: parseInt(account.priority) || 50,
              lastUsedAt: account.lastUsedAt || '0'
            })
            logger.debug(`✅ Added CCR account to available pool: ${account.name}`)
          } else {
            logger.debug(
              `❌ CCR account ${account.name} not available - rateLimited: ${isRateLimited}, quotaExceeded: ${isQuotaExceeded}, overloaded: ${isOverloaded}`
            )
          }
        } else {
          logger.debug(
            `❌ CCR account ${account.name} not eligible - isActive: ${account.isActive}, status: ${account.status}, accountType: ${account.accountType}, schedulable: ${account.schedulable}`
          )
        }
      }

      logger.info(`📊 Total available CCR accounts: ${availableAccounts.length}`)
      return availableAccounts
    } catch (error) {
      logger.error('❌ Failed to get available CCR accounts:', error)
      return []
    }
  }

  /**
   * 🔒 Verificar claude-official Cuenta是否可用于Sesión绑定
   * 注意：此Método仅用于 claude-official TipoCuenta，其他Tipo不受Sesión绑定Límite
   * @param {string} accountId - CuentaID
   * @param {string} accountType - CuentaTipo（应为 'claude-official'）
   * @param {string} _requestedModel - Solicitud的模型（保留Parámetro，当前未使用）
   * @returns {Promise<boolean>}
   */
  async _isAccountAvailableForSessionBinding(accountId, accountType, _requestedModel = null) {
    try {
      // 此Método仅Procesar claude-official Tipo
      if (accountType !== 'claude-official') {
        logger.warn(
          `Session binding: _isAccountAvailableForSessionBinding called for non-official type: ${accountType}`
        )
        return true // 非 claude-official Tipo不受Límite
      }

      const account = await redis.getClaudeAccount(accountId)
      if (!account) {
        logger.warn(`Session binding: Claude OAuth account ${accountId} not found`)
        return false
      }

      const isActive = account.isActive === 'true' || account.isActive === true
      const { status } = account

      if (!isActive) {
        logger.warn(`Session binding: Claude OAuth account ${accountId} is not active`)
        return false
      }

      if (status === 'error' || status === 'temp_error') {
        logger.warn(
          `Session binding: Claude OAuth account ${accountId} has error status: ${status}`
        )
        return false
      }

      // Verificar是否被限流
      if (await claudeAccountService.isAccountRateLimited(accountId)) {
        logger.warn(`Session binding: Claude OAuth account ${accountId} is rate limited`)
        return false
      }

      // Verificar临时不可用
      if (await this.isAccountTemporarilyUnavailable(accountId, accountType)) {
        logger.warn(`Session binding: Claude OAuth account ${accountId} is temporarily unavailable`)
        return false
      }

      return true
    } catch (error) {
      logger.error(
        `❌ Error checking account availability for session binding: ${accountId} (${accountType})`,
        error
      )
      return false
    }
  }
}

module.exports = new UnifiedClaudeScheduler()
