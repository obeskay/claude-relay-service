/**
 * 标准 Gemini API RutaMódulo
 *
 * 该MóduloProcesar标准 Gemini API Formato的Solicitud：
 * - v1beta/models/:modelName:generateContent
 * - v1beta/models/:modelName:streamGenerateContent
 * - v1beta/models/:modelName:countTokens
 * - v1beta/models/:modelName:loadCodeAssist
 * - v1beta/models/:modelName:onboardUser
 * - v1/models/:modelName:* (同上)
 * - v1internal:* (内部Formato)
 * - v1beta/models, v1/models (模型ColumnaTabla)
 * - v1beta/models/:modelName, v1/models/:modelName (模型详情)
 *
 * 所有ProcesarFunción都从 geminiHandlers.js 导入，以避免代码重复。
 */

const express = require('express')
const router = express.Router()
const { authenticateApiKey } = require('../middleware/auth')
const logger = require('../utils/logger')

// 从 handlers/geminiHandlers.js 导入所有ProcesarFunción
const {
  ensureGeminiPermissionMiddleware,
  handleLoadCodeAssist,
  handleOnboardUser,
  handleCountTokens,
  handleGenerateContent,
  handleStreamGenerateContent,
  handleStandardGenerateContent,
  handleStandardStreamGenerateContent,
  handleModels,
  handleModelDetails
} = require('../handlers/geminiHandlers')

// ============================================================================
// v1beta Versión的标准Ruta - Soportar动态模型Nombre
// ============================================================================

/**
 * POST /v1beta/models/:modelName:loadCodeAssist
 */
router.post(
  '/v1beta/models/:modelName\\:loadCodeAssist',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  (req, res, next) => {
    logger.info(`Standard Gemini API request: ${req.method} ${req.originalUrl}`)
    handleLoadCodeAssist(req, res, next)
  }
)

/**
 * POST /v1beta/models/:modelName:onboardUser
 */
router.post(
  '/v1beta/models/:modelName\\:onboardUser',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  (req, res, next) => {
    logger.info(`Standard Gemini API request: ${req.method} ${req.originalUrl}`)
    handleOnboardUser(req, res, next)
  }
)

/**
 * POST /v1beta/models/:modelName:countTokens
 */
router.post(
  '/v1beta/models/:modelName\\:countTokens',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  (req, res, next) => {
    logger.info(`Standard Gemini API request: ${req.method} ${req.originalUrl}`)
    handleCountTokens(req, res, next)
  }
)

/**
 * POST /v1beta/models/:modelName:generateContent
 * 使用专门的标准 API ProcesarFunción（Soportar OAuth 和 API Cuenta）
 */
router.post(
  '/v1beta/models/:modelName\\:generateContent',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  handleStandardGenerateContent
)

/**
 * POST /v1beta/models/:modelName:streamGenerateContent
 * 使用专门的标准 API 流式ProcesarFunción（Soportar OAuth 和 API Cuenta）
 */
router.post(
  '/v1beta/models/:modelName\\:streamGenerateContent',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  handleStandardStreamGenerateContent
)

// ============================================================================
// v1 Versión的标准Ruta（为了完整性，虽然 Gemini 主要使用 v1beta）
// ============================================================================

/**
 * POST /v1/models/:modelName:generateContent
 */
router.post(
  '/v1/models/:modelName\\:generateContent',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  handleStandardGenerateContent
)

/**
 * POST /v1/models/:modelName:streamGenerateContent
 */
router.post(
  '/v1/models/:modelName\\:streamGenerateContent',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  handleStandardStreamGenerateContent
)

/**
 * POST /v1/models/:modelName:countTokens
 */
router.post(
  '/v1/models/:modelName\\:countTokens',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  (req, res, next) => {
    logger.info(`Standard Gemini API request (v1): ${req.method} ${req.originalUrl}`)
    handleCountTokens(req, res, next)
  }
)

// ============================================================================
// v1internal Versión的标准Ruta（这些使用内部Formato的ProcesarFunción）
// ============================================================================

/**
 * POST /v1internal:loadCodeAssist
 */
router.post(
  '/v1internal\\:loadCodeAssist',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  (req, res, next) => {
    logger.info(`Standard Gemini API request (v1internal): ${req.method} ${req.originalUrl}`)
    handleLoadCodeAssist(req, res, next)
  }
)

/**
 * POST /v1internal:onboardUser
 */
router.post(
  '/v1internal\\:onboardUser',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  (req, res, next) => {
    logger.info(`Standard Gemini API request (v1internal): ${req.method} ${req.originalUrl}`)
    handleOnboardUser(req, res, next)
  }
)

/**
 * POST /v1internal:countTokens
 */
router.post(
  '/v1internal\\:countTokens',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  (req, res, next) => {
    logger.info(`Standard Gemini API request (v1internal): ${req.method} ${req.originalUrl}`)
    handleCountTokens(req, res, next)
  }
)

/**
 * POST /v1internal:generateContent
 * v1internal Formato使用内部Formato的ProcesarFunción
 */
router.post(
  '/v1internal\\:generateContent',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  (req, res, next) => {
    logger.info(`Standard Gemini API request (v1internal): ${req.method} ${req.originalUrl}`)
    handleGenerateContent(req, res, next)
  }
)

/**
 * POST /v1internal:streamGenerateContent
 * v1internal Formato使用内部Formato的ProcesarFunción
 */
router.post(
  '/v1internal\\:streamGenerateContent',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  (req, res, next) => {
    logger.info(`Standard Gemini API request (v1internal): ${req.method} ${req.originalUrl}`)
    handleStreamGenerateContent(req, res, next)
  }
)

// ============================================================================
// 模型ColumnaTablaEndpoint
// ============================================================================

/**
 * GET /v1beta/models
 * Obtener模型ColumnaTabla（v1beta Versión）
 */
router.get('/v1beta/models', authenticateApiKey, ensureGeminiPermissionMiddleware, (req, res) => {
  logger.info('Standard Gemini API models request (v1beta)')
  handleModels(req, res)
})

/**
 * GET /v1/models
 * Obtener模型ColumnaTabla（v1 Versión）
 */
router.get('/v1/models', authenticateApiKey, ensureGeminiPermissionMiddleware, (req, res) => {
  logger.info('Standard Gemini API models request (v1)')
  handleModels(req, res)
})

// ============================================================================
// 模型详情Endpoint
// ============================================================================

/**
 * GET /v1beta/models/:modelName
 * Obtener模型详情（v1beta Versión）
 */
router.get(
  '/v1beta/models/:modelName',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  handleModelDetails
)

/**
 * GET /v1/models/:modelName
 * Obtener模型详情（v1 Versión）
 */
router.get(
  '/v1/models/:modelName',
  authenticateApiKey,
  ensureGeminiPermissionMiddleware,
  handleModelDetails
)

// ============================================================================
// InicializarRegistro
// ============================================================================

logger.info('Standard Gemini API routes initialized')

module.exports = router
