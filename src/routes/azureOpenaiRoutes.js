const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')
const { authenticateApiKey } = require('../middleware/auth')
const azureOpenaiAccountService = require('../services/account/azureOpenaiAccountService')
const azureOpenaiRelayService = require('../services/relay/azureOpenaiRelayService')
const apiKeyService = require('../services/apiKeyService')
const crypto = require('crypto')
const upstreamErrorHelper = require('../utils/upstreamErrorHelper')

// Soportar的模型ColumnaTabla - 基于真实的 Azure OpenAI 模型
const ALLOWED_MODELS = {
  CHAT_MODELS: [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-5',
    'gpt-5-mini',
    'gpt-35-turbo',
    'gpt-35-turbo-16k',
    'codex-mini'
  ],
  EMBEDDING_MODELS: ['text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large']
}

const ALL_ALLOWED_MODELS = [...ALLOWED_MODELS.CHAT_MODELS, ...ALLOWED_MODELS.EMBEDDING_MODELS]

// Azure OpenAI 稳定 API Versión
// const AZURE_API_VERSION = '2024-02-01' // 当前未使用，保留以备后用

// 原子使用Estadística报告器
class AtomicUsageReporter {
  constructor() {
    this.reportedUsage = new Set()
    this.pendingReports = new Map()
  }

  async reportOnce(requestId, usageData, apiKeyId, modelToRecord, accountId) {
    if (this.reportedUsage.has(requestId)) {
      logger.debug(`Usage already reported for request: ${requestId}`)
      return false
    }

    // 防止Concurrencia重复报告
    if (this.pendingReports.has(requestId)) {
      return this.pendingReports.get(requestId)
    }

    const reportPromise = this._performReport(
      requestId,
      usageData,
      apiKeyId,
      modelToRecord,
      accountId
    )
    this.pendingReports.set(requestId, reportPromise)

    try {
      const result = await reportPromise
      this.reportedUsage.add(requestId)
      return result
    } finally {
      this.pendingReports.delete(requestId)
      // Limpiar过期的已报告Registro
      setTimeout(() => this.reportedUsage.delete(requestId), 60 * 1000) // 1分钟后Limpiar
    }
  }

  async _performReport(requestId, usageData, apiKeyId, modelToRecord, accountId) {
    try {
      const inputTokens = usageData.prompt_tokens || usageData.input_tokens || 0
      const outputTokens = usageData.completion_tokens || usageData.output_tokens || 0
      const cacheCreateTokens =
        usageData.prompt_tokens_details?.cache_creation_tokens ||
        usageData.input_tokens_details?.cache_creation_tokens ||
        0
      const cacheReadTokens =
        usageData.prompt_tokens_details?.cached_tokens ||
        usageData.input_tokens_details?.cached_tokens ||
        0

      await apiKeyService.recordUsage(
        apiKeyId,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        modelToRecord,
        accountId,
        'azure-openai'
      )

      // SincronizaciónActualizar Azure Cuenta的 lastUsedAt 和累计使用量
      try {
        const totalTokens = inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens
        if (accountId) {
          await azureOpenaiAccountService.updateAccountUsage(accountId, totalTokens)
        }
      } catch (acctErr) {
        logger.warn(`Failed to update Azure account usage for ${accountId}: ${acctErr.message}`)
      }

      logger.info(
        `📊 Azure OpenAI Usage recorded for ${requestId}: ` +
          `model=${modelToRecord}, ` +
          `input=${inputTokens}, output=${outputTokens}, ` +
          `cache_create=${cacheCreateTokens}, cache_read=${cacheReadTokens}`
      )
      return true
    } catch (error) {
      logger.error('Failed to report Azure OpenAI usage:', error)
      return false
    }
  }
}

const usageReporter = new AtomicUsageReporter()

// Verificación de salud
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'azure-openai-relay',
    timestamp: new Date().toISOString()
  })
})

// Obtener可用模型ColumnaTabla（兼容 OpenAI API）
router.get('/models', authenticateApiKey, async (req, res) => {
  try {
    const models = ALL_ALLOWED_MODELS.map((model) => ({
      id: `azure/${model}`,
      object: 'model',
      created: Date.now(),
      owned_by: 'azure-openai'
    }))

    res.json({
      object: 'list',
      data: models
    })
  } catch (error) {
    logger.error('Error fetching Azure OpenAI models:', error)
    res.status(500).json({ error: { message: 'Failed to fetch models' } })
  }
})

// Procesar聊天CompletadoSolicitud
router.post('/chat/completions', authenticateApiKey, async (req, res) => {
  const requestId = `azure_req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
  const sessionId = req.sessionId || req.headers['x-session-id'] || null

  logger.info(`🚀 Azure OpenAI Chat Request ${requestId}`, {
    apiKeyId: req.apiKey?.id,
    sessionId,
    model: req.body.model,
    stream: req.body.stream || false,
    messages: req.body.messages?.length || 0
  })

  try {
    // Obtener绑定的 Azure OpenAI Cuenta
    let account = null
    if (req.apiKey?.azureOpenaiAccountId) {
      account = await azureOpenaiAccountService.getAccount(req.apiKey.azureOpenaiAccountId)
      if (account) {
        const isTempUnavailable = await upstreamErrorHelper.isTempUnavailable(
          account.id,
          'azure-openai'
        )
        if (isTempUnavailable) {
          logger.warn(`⏱️ Bound Azure OpenAI account temporarily unavailable, falling back to pool`)
          account = null
        }
      }
      if (!account) {
        logger.warn(`Bound Azure OpenAI account not found: ${req.apiKey.azureOpenaiAccountId}`)
      }
    }

    // 如果没有绑定Cuenta或Cuenta不可用，选择一个可用Cuenta
    if (!account || account.isActive !== 'true') {
      account = await azureOpenaiAccountService.selectAvailableAccount(sessionId)
    }

    // 发送Solicitud到 Azure OpenAI
    const response = await azureOpenaiRelayService.handleAzureOpenAIRequest({
      account,
      requestBody: req.body,
      headers: req.headers,
      isStream: req.body.stream || false,
      endpoint: 'chat/completions'
    })

    // Verificar上游Respuesta状态码（仅对认证/限流/Servicio端Error暂停，不对 400/404 等ClienteError暂停）
    const azureAutoProtectionDisabled =
      account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
    const shouldPause =
      account?.id &&
      !azureAutoProtectionDisabled &&
      (response.status === 401 ||
        response.status === 403 ||
        response.status === 429 ||
        response.status >= 500)
    if (shouldPause) {
      const customTtl =
        response.status === 429 ? upstreamErrorHelper.parseRetryAfter(response.headers) : null
      await upstreamErrorHelper
        .markTempUnavailable(account.id, 'azure-openai', response.status, customTtl)
        .catch(() => {})
    }

    // Procesar流式Respuesta
    if (req.body.stream) {
      await azureOpenaiRelayService.handleStreamResponse(response, res, {
        onEnd: async ({ usageData, actualModel }) => {
          if (usageData) {
            const modelToRecord = actualModel || req.body.model || 'unknown'
            await usageReporter.reportOnce(
              requestId,
              usageData,
              req.apiKey.id,
              modelToRecord,
              account.id
            )
          }
        },
        onError: (error) => {
          logger.error(`Stream error for request ${requestId}:`, error)
        }
      })
    } else {
      // Procesar非流式Respuesta
      const { usageData, actualModel } = azureOpenaiRelayService.handleNonStreamResponse(
        response,
        res
      )

      if (usageData) {
        const modelToRecord = actualModel || req.body.model || 'unknown'
        await usageReporter.reportOnce(
          requestId,
          usageData,
          req.apiKey.id,
          modelToRecord,
          account.id
        )
      }
    }
  } catch (error) {
    logger.error(`Azure OpenAI request failed ${requestId}:`, error)

    if (!res.headersSent) {
      const statusCode = error.response?.status || 500
      const errorMessage =
        error.response?.data?.error?.message || error.message || 'Internal server error'

      res.status(statusCode).json({
        error: {
          message: errorMessage,
          type: 'azure_openai_error',
          code: error.code || 'unknown'
        }
      })
    }
  }
})

// ProcesarRespuestaSolicitud (gpt-5, gpt-5-mini, codex-mini models)
router.post('/responses', authenticateApiKey, async (req, res) => {
  const requestId = `azure_resp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
  const sessionId = req.sessionId || req.headers['x-session-id'] || null

  logger.info(`🚀 Azure OpenAI Responses Request ${requestId}`, {
    apiKeyId: req.apiKey?.id,
    sessionId,
    model: req.body.model,
    stream: req.body.stream || false,
    messages: req.body.messages?.length || 0
  })

  try {
    // Obtener绑定的 Azure OpenAI Cuenta
    let account = null
    if (req.apiKey?.azureOpenaiAccountId) {
      account = await azureOpenaiAccountService.getAccount(req.apiKey.azureOpenaiAccountId)
      if (account) {
        const isTempUnavailable = await upstreamErrorHelper.isTempUnavailable(
          account.id,
          'azure-openai'
        )
        if (isTempUnavailable) {
          logger.warn(`⏱️ Bound Azure OpenAI account temporarily unavailable, falling back to pool`)
          account = null
        }
      }
      if (!account) {
        logger.warn(`Bound Azure OpenAI account not found: ${req.apiKey.azureOpenaiAccountId}`)
      }
    }

    // 如果没有绑定Cuenta或Cuenta不可用，选择一个可用Cuenta
    if (!account || account.isActive !== 'true') {
      account = await azureOpenaiAccountService.selectAvailableAccount(sessionId)
    }

    // 发送Solicitud到 Azure OpenAI
    const response = await azureOpenaiRelayService.handleAzureOpenAIRequest({
      account,
      requestBody: req.body,
      headers: req.headers,
      isStream: req.body.stream || false,
      endpoint: 'responses'
    })

    // Verificar上游Respuesta状态码（仅对认证/限流/Servicio端Error暂停，不对 400/404 等ClienteError暂停）
    const azureAutoProtectionDisabled =
      account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
    const shouldPause =
      account?.id &&
      !azureAutoProtectionDisabled &&
      (response.status === 401 ||
        response.status === 403 ||
        response.status === 429 ||
        response.status >= 500)
    if (shouldPause) {
      const customTtl =
        response.status === 429 ? upstreamErrorHelper.parseRetryAfter(response.headers) : null
      await upstreamErrorHelper
        .markTempUnavailable(account.id, 'azure-openai', response.status, customTtl)
        .catch(() => {})
    }

    // Procesar流式Respuesta
    if (req.body.stream) {
      await azureOpenaiRelayService.handleStreamResponse(response, res, {
        onEnd: async ({ usageData, actualModel }) => {
          if (usageData) {
            const modelToRecord = actualModel || req.body.model || 'unknown'
            await usageReporter.reportOnce(
              requestId,
              usageData,
              req.apiKey.id,
              modelToRecord,
              account.id
            )
          }
        },
        onError: (error) => {
          logger.error(`Stream error for request ${requestId}:`, error)
        }
      })
    } else {
      // Procesar非流式Respuesta
      const { usageData, actualModel } = azureOpenaiRelayService.handleNonStreamResponse(
        response,
        res
      )

      if (usageData) {
        const modelToRecord = actualModel || req.body.model || 'unknown'
        await usageReporter.reportOnce(
          requestId,
          usageData,
          req.apiKey.id,
          modelToRecord,
          account.id
        )
      }
    }
  } catch (error) {
    logger.error(`Azure OpenAI responses request failed ${requestId}:`, error)

    if (!res.headersSent) {
      const statusCode = error.response?.status || 500
      const errorMessage =
        error.response?.data?.error?.message || error.message || 'Internal server error'

      res.status(statusCode).json({
        error: {
          message: errorMessage,
          type: 'azure_openai_error',
          code: error.code || 'unknown'
        }
      })
    }
  }
})

// Procesar嵌入Solicitud
router.post('/embeddings', authenticateApiKey, async (req, res) => {
  const requestId = `azure_embed_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
  const sessionId = req.sessionId || req.headers['x-session-id'] || null

  logger.info(`🚀 Azure OpenAI Embeddings Request ${requestId}`, {
    apiKeyId: req.apiKey?.id,
    sessionId,
    model: req.body.model,
    input: Array.isArray(req.body.input) ? req.body.input.length : 1
  })

  try {
    // Obtener绑定的 Azure OpenAI Cuenta
    let account = null
    if (req.apiKey?.azureOpenaiAccountId) {
      account = await azureOpenaiAccountService.getAccount(req.apiKey.azureOpenaiAccountId)
      if (account) {
        const isTempUnavailable = await upstreamErrorHelper.isTempUnavailable(
          account.id,
          'azure-openai'
        )
        if (isTempUnavailable) {
          logger.warn(`⏱️ Bound Azure OpenAI account temporarily unavailable, falling back to pool`)
          account = null
        }
      }
      if (!account) {
        logger.warn(`Bound Azure OpenAI account not found: ${req.apiKey.azureOpenaiAccountId}`)
      }
    }

    // 如果没有绑定Cuenta或Cuenta不可用，选择一个可用Cuenta
    if (!account || account.isActive !== 'true') {
      account = await azureOpenaiAccountService.selectAvailableAccount(sessionId)
    }

    // 发送Solicitud到 Azure OpenAI
    const response = await azureOpenaiRelayService.handleAzureOpenAIRequest({
      account,
      requestBody: req.body,
      headers: req.headers,
      isStream: false,
      endpoint: 'embeddings'
    })

    // Verificar上游Respuesta状态码（仅对认证/限流/Servicio端Error暂停，不对 400/404 等ClienteError暂停）
    const azureAutoProtectionDisabled =
      account?.disableAutoProtection === true || account?.disableAutoProtection === 'true'
    const shouldPause =
      account?.id &&
      !azureAutoProtectionDisabled &&
      (response.status === 401 ||
        response.status === 403 ||
        response.status === 429 ||
        response.status >= 500)
    if (shouldPause) {
      const customTtl =
        response.status === 429 ? upstreamErrorHelper.parseRetryAfter(response.headers) : null
      await upstreamErrorHelper
        .markTempUnavailable(account.id, 'azure-openai', response.status, customTtl)
        .catch(() => {})
    }

    // ProcesarRespuesta
    const { usageData, actualModel } = azureOpenaiRelayService.handleNonStreamResponse(
      response,
      res
    )

    if (usageData) {
      const modelToRecord = actualModel || req.body.model || 'unknown'
      await usageReporter.reportOnce(requestId, usageData, req.apiKey.id, modelToRecord, account.id)
    }
  } catch (error) {
    logger.error(`Azure OpenAI embeddings request failed ${requestId}:`, error)

    if (!res.headersSent) {
      const statusCode = error.response?.status || 500
      const errorMessage =
        error.response?.data?.error?.message || error.message || 'Internal server error'

      res.status(statusCode).json({
        error: {
          message: errorMessage,
          type: 'azure_openai_error',
          code: error.code || 'unknown'
        }
      })
    }
  }
})

// Obtener使用Estadística
router.get('/usage', authenticateApiKey, async (req, res) => {
  try {
    const { start_date, end_date } = req.query
    const usage = await apiKeyService.getUsageStats(req.apiKey.id, start_date, end_date)

    res.json({
      object: 'usage',
      data: usage
    })
  } catch (error) {
    logger.error('Error fetching Azure OpenAI usage:', error)
    res.status(500).json({ error: { message: 'Failed to fetch usage data' } })
  }
})

module.exports = router
