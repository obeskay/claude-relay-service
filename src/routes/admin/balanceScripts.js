const express = require('express')
const { authenticateAdmin } = require('../../middleware/auth')
const balanceScriptService = require('../../services/balanceScriptService')
const router = express.Router()

// Obtener全部脚本ConfiguraciónColumnaTabla
router.get('/balance-scripts', authenticateAdmin, (req, res) => {
  const items = balanceScriptService.listConfigs()
  return res.json({ success: true, data: items })
})

// Obtener单个脚本Configuración
router.get('/balance-scripts/:name', authenticateAdmin, (req, res) => {
  const { name } = req.params
  const config = balanceScriptService.getConfig(name || 'default')
  return res.json({ success: true, data: config })
})

// 保存脚本Configuración
router.put('/balance-scripts/:name', authenticateAdmin, (req, res) => {
  try {
    const { name } = req.params
    const saved = balanceScriptService.saveConfig(name || 'default', req.body || {})
    return res.json({ success: true, data: saved })
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message })
  }
})

// Probar脚本（不落库）
router.post('/balance-scripts/:name/test', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.params
    const result = await balanceScriptService.testScript(name || 'default', req.body || {})
    return res.json({ success: true, data: result })
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message })
  }
})

module.exports = router
