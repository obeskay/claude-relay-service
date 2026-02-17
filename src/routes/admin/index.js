/**
 * Admin Routes - 主入口Archivo
 * 导入并挂载所有子RutaMódulo
 */

const express = require('express')
const router = express.Router()

// 导入所有子Ruta
const apiKeysRoutes = require('./apiKeys')
const accountGroupsRoutes = require('./accountGroups')
const claudeAccountsRoutes = require('./claudeAccounts')
const claudeConsoleAccountsRoutes = require('./claudeConsoleAccounts')
const ccrAccountsRoutes = require('./ccrAccounts')
const bedrockAccountsRoutes = require('./bedrockAccounts')
const geminiAccountsRoutes = require('./geminiAccounts')
const geminiApiAccountsRoutes = require('./geminiApiAccounts')
const openaiAccountsRoutes = require('./openaiAccounts')
const azureOpenaiAccountsRoutes = require('./azureOpenaiAccounts')
const openaiResponsesAccountsRoutes = require('./openaiResponsesAccounts')
const droidAccountsRoutes = require('./droidAccounts')
const dashboardRoutes = require('./dashboard')
const usageStatsRoutes = require('./usageStats')
const accountBalanceRoutes = require('./accountBalance')
const systemRoutes = require('./system')
const concurrencyRoutes = require('./concurrency')
const claudeRelayConfigRoutes = require('./claudeRelayConfig')
const syncRoutes = require('./sync')
const serviceRatesRoutes = require('./serviceRates')
const quotaCardsRoutes = require('./quotaCards')

// 挂载所有子Ruta
// 使用完整Ruta的Módulo（直接挂载到根Ruta）
router.use('/', apiKeysRoutes)
router.use('/', claudeAccountsRoutes)
router.use('/', claudeConsoleAccountsRoutes)
router.use('/', geminiApiAccountsRoutes)
router.use('/', azureOpenaiAccountsRoutes)
router.use('/', openaiResponsesAccountsRoutes)
router.use('/', droidAccountsRoutes)
router.use('/', dashboardRoutes)
router.use('/', usageStatsRoutes)
router.use('/', accountBalanceRoutes)
router.use('/', systemRoutes)
router.use('/', concurrencyRoutes)
router.use('/', claudeRelayConfigRoutes)
router.use('/', syncRoutes)
router.use('/', serviceRatesRoutes)
router.use('/', quotaCardsRoutes)

// 使用相对Ruta的Módulo（需要指定基础Ruta前缀）
router.use('/account-groups', accountGroupsRoutes)
router.use('/ccr-accounts', ccrAccountsRoutes)
router.use('/bedrock-accounts', bedrockAccountsRoutes)
router.use('/gemini-accounts', geminiAccountsRoutes)
router.use('/openai-accounts', openaiAccountsRoutes)

module.exports = router
