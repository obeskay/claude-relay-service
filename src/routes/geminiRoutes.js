/**
 * Gemini API RutaMódulo（精简版）
 *
 * 该Módulo只Incluir geminiRoutes 独有的Ruta：
 * - /messages - OpenAI 兼容Formato消息Procesar
 * - /models - 模型ColumnaTabla
 * - /usage - 使用Estadística
 * - /key-info - API Key Información
 * - /v1internal:listExperiments - 实验ColumnaTabla
 * - /v1beta/models/:modelName:listExperiments - 带模型Parámetro的实验ColumnaTabla
 *
 * 其他标准 Gemini API Ruta由 standardGeminiRoutes.js Procesar。
 * 所有ProcesarFunción都从 geminiHandlers.js 导入，以避免代码重复。
 */

const express = require('express')
const router = express.Router()
const { authenticateApiKey } = require('../middleware/auth')

// 从 handlers/geminiHandlers.js 导入所有ProcesarFunción
const {
  handleMessages,
  handleModels,
  handleUsage,
  handleKeyInfo,
  handleSimpleEndpoint,
  // 以下Función需要导出供其他Módulo使用（如 unified.js）
  handleGenerateContent,
  handleStreamGenerateContent,
  handleLoadCodeAssist,
  handleOnboardUser,
  handleRetrieveUserQuota,
  handleCountTokens,
  handleStandardGenerateContent,
  handleStandardStreamGenerateContent,
  ensureGeminiPermissionMiddleware
} = require('../handlers/geminiHandlers')

// ============================================================================
// OpenAI 兼容FormatoRuta
// ============================================================================

/**
 * POST /messages
 * OpenAI 兼容Formato的消息ProcesarEndpoint
 */
router.post('/messages', authenticateApiKey, handleMessages)

// ============================================================================
// 模型和InformaciónRuta
// ============================================================================

/**
 * GET /models
 * Obtener可用模型ColumnaTabla
 */
router.get('/models', authenticateApiKey, handleModels)

/**
 * GET /usage
 * Obtener使用情况Estadística
 */
router.get('/usage', authenticateApiKey, handleUsage)

/**
 * GET /key-info
 * Obtener API Key Información
 */
router.get('/key-info', authenticateApiKey, handleKeyInfo)

// ============================================================================
// v1internal 独有Ruta
// ============================================================================

/**
 * POST /v1internal:listExperiments
 * Columna出实验（只有 geminiRoutes 定义此Ruta）
 */
router.post(
  '/v1internal\\:listExperiments',
  authenticateApiKey,
  handleSimpleEndpoint('listExperiments')
)

/**
 * POST /v1internal:retrieveUserQuota
 * ObtenerUsuarioCuotaInformación（Gemini CLI 0.22.2+ 需要）
 */
router.post('/v1internal\\:retrieveUserQuota', authenticateApiKey, handleRetrieveUserQuota)

/**
 * POST /v1beta/models/:modelName:listExperiments
 * 带模型Parámetro的实验ColumnaTabla（只有 geminiRoutes 定义此Ruta）
 */
router.post(
  '/v1beta/models/:modelName\\:listExperiments',
  authenticateApiKey,
  handleSimpleEndpoint('listExperiments')
)

// ============================================================================
// 导出
// ============================================================================

module.exports = router

// 导出ProcesarFunción供其他Módulo使用（如 unified.js、standardGeminiRoutes.js）
module.exports.handleLoadCodeAssist = handleLoadCodeAssist
module.exports.handleOnboardUser = handleOnboardUser
module.exports.handleCountTokens = handleCountTokens
module.exports.handleGenerateContent = handleGenerateContent
module.exports.handleStreamGenerateContent = handleStreamGenerateContent
module.exports.handleStandardGenerateContent = handleStandardGenerateContent
module.exports.handleStandardStreamGenerateContent = handleStandardStreamGenerateContent
module.exports.ensureGeminiPermissionMiddleware = ensureGeminiPermissionMiddleware
