const express = require('express')
const accountGroupService = require('../../services/accountGroupService')
const claudeAccountService = require('../../services/account/claudeAccountService')
const claudeConsoleAccountService = require('../../services/account/claudeConsoleAccountService')
const geminiAccountService = require('../../services/account/geminiAccountService')
const openaiAccountService = require('../../services/account/openaiAccountService')
const droidAccountService = require('../../services/account/droidAccountService')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')

const router = express.Router()

// 👥 CuentaAgrupar管理

// CrearCuentaAgrupar
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, platform, description } = req.body

    const group = await accountGroupService.createGroup({
      name,
      platform,
      description
    })

    return res.json({ success: true, data: group })
  } catch (error) {
    logger.error('❌ Failed to create account group:', error)
    return res.status(400).json({ error: error.message })
  }
})

// Obtener所有Agrupar
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { platform } = req.query
    const groups = await accountGroupService.getAllGroups(platform)
    return res.json({ success: true, data: groups })
  } catch (error) {
    logger.error('❌ Failed to get account groups:', error)
    return res.status(500).json({ error: error.message })
  }
})

// ObtenerAgrupar详情
router.get('/:groupId', authenticateAdmin, async (req, res) => {
  try {
    const { groupId } = req.params
    const group = await accountGroupService.getGroup(groupId)

    if (!group) {
      return res.status(404).json({ error: 'El grupo no existe' })
    }

    return res.json({ success: true, data: group })
  } catch (error) {
    logger.error('❌ Failed to get account group:', error)
    return res.status(500).json({ error: error.message })
  }
})

// ActualizarAgrupar
router.put('/:groupId', authenticateAdmin, async (req, res) => {
  try {
    const { groupId } = req.params
    const updates = req.body

    const updatedGroup = await accountGroupService.updateGroup(groupId, updates)
    return res.json({ success: true, data: updatedGroup })
  } catch (error) {
    logger.error('❌ Failed to update account group:', error)
    return res.status(400).json({ error: error.message })
  }
})

// EliminarAgrupar
router.delete('/:groupId', authenticateAdmin, async (req, res) => {
  try {
    const { groupId } = req.params
    await accountGroupService.deleteGroup(groupId)
    return res.json({ success: true, message: 'Grupo eliminado con éxito' })
  } catch (error) {
    logger.error('❌ Failed to delete account group:', error)
    return res.status(400).json({ error: error.message })
  }
})

// ObtenerAgrupar成员
router.get('/:groupId/members', authenticateAdmin, async (req, res) => {
  try {
    const { groupId } = req.params
    const group = await accountGroupService.getGroup(groupId)

    if (!group) {
      return res.status(404).json({ error: 'El grupo no existe' })
    }

    const memberIds = await accountGroupService.getGroupMembers(groupId)

    // Obtener成员详细Información
    const members = []
    for (const memberId of memberIds) {
      // 根据Agrupar平台优先查找对应Cuenta
      let account = null
      switch (group.platform) {
        case 'droid':
          account = await droidAccountService.getAccount(memberId)
          break
        case 'gemini':
          account = await geminiAccountService.getAccount(memberId)
          break
        case 'openai':
          account = await openaiAccountService.getAccount(memberId)
          break
        case 'claude':
        default:
          account = await claudeAccountService.getAccount(memberId)
          if (!account) {
            account = await claudeConsoleAccountService.getAccount(memberId)
          }
          break
      }

      // 兼容旧Datos：若按平台未找到，则继续尝试其他平台
      if (!account) {
        account = await claudeAccountService.getAccount(memberId)
      }
      if (!account) {
        account = await claudeConsoleAccountService.getAccount(memberId)
      }
      if (!account) {
        account = await geminiAccountService.getAccount(memberId)
      }
      if (!account) {
        account = await openaiAccountService.getAccount(memberId)
      }
      if (!account && group.platform !== 'droid') {
        account = await droidAccountService.getAccount(memberId)
      }

      if (account) {
        members.push(account)
      }
    }

    return res.json({ success: true, data: members })
  } catch (error) {
    logger.error('❌ Failed to get group members:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
