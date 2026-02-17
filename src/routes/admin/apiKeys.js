const express = require('express')
const apiKeyService = require('../../services/apiKeyService')
const redis = require('../../models/redis')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const CostCalculator = require('../../utils/costCalculator')
const config = require('../../../config/config')

const router = express.Router()

// 有效的PermisoValorColumnaTabla
const VALID_PERMISSIONS = ['claude', 'gemini', 'openai', 'droid']

/**
 * ValidarPermisoArregloFormato
 * @param {any} permissions - PermisoValor（可以是Arreglo或其他）
 * @returns {string|null} - RetornarError消息，null Tabla示Validar通过
 */
function validatePermissions(permissions) {
  // 空Valor或未定义Tabla示全部Servicio
  if (permissions === undefined || permissions === null || permissions === '') {
    return null
  }
  // 兼容旧FormatoCadena
  if (typeof permissions === 'string') {
    if (permissions === 'all' || VALID_PERMISSIONS.includes(permissions)) {
      return null
    }
    return `Invalid permissions value. Must be an array of: ${VALID_PERMISSIONS.join(', ')}`
  }
  // 新FormatoArreglo
  if (Array.isArray(permissions)) {
    // 空ArregloTabla示全部Servicio
    if (permissions.length === 0) {
      return null
    }
    // ValidarArreglo中的每个Valor
    for (const perm of permissions) {
      if (!VALID_PERMISSIONS.includes(perm)) {
        return `Invalid permission value "${perm}". Valid values are: ${VALID_PERMISSIONS.join(', ')}`
      }
    }
    return null
  }
  return `Permissions must be an array. Valid values are: ${VALID_PERMISSIONS.join(', ')}`
}

/**
 * Validar serviceRates Formato
 * @param {any} serviceRates - Servicio倍率Objeto
 * @returns {string|null} - RetornarError消息，null Tabla示Validar通过
 */
function validateServiceRates(serviceRates) {
  if (serviceRates === undefined || serviceRates === null) {
    return null
  }
  if (typeof serviceRates !== 'object' || Array.isArray(serviceRates)) {
    return 'Service rates must be an object'
  }
  for (const [service, rate] of Object.entries(serviceRates)) {
    const numRate = Number(rate)
    if (!Number.isFinite(numRate) || numRate < 0) {
      return `Invalid rate for service "${service}": must be a non-negative number`
    }
  }
  return null
}

// 👥 Usuario管理 (用于API Key分配)

// Obtener所有UsuarioColumnaTabla（用于API Key分配）
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const userService = require('../../services/userService')

    // Extract query parameters for filtering
    const { role, isActive } = req.query
    const options = { limit: 1000 }

    // Apply role filter if provided
    if (role) {
      options.role = role
    }

    // Apply isActive filter if provided, otherwise default to active users only
    if (isActive !== undefined) {
      options.isActive = isActive === 'true'
    } else {
      options.isActive = true // Default to active users for backwards compatibility
    }

    const result = await userService.getAllUsers(options)

    // Extract users array from the paginated result
    const allUsers = result.users || []

    // Map to the format needed for the dropdown
    const activeUsers = allUsers.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      email: user.email,
      role: user.role
    }))

    // 添加Admin选项作为第一个
    const usersWithAdmin = [
      {
        id: 'admin',
        username: 'admin',
        displayName: 'Admin',
        email: '',
        role: 'admin'
      },
      ...activeUsers
    ]

    return res.json({
      success: true,
      data: usersWithAdmin
    })
  } catch (error) {
    logger.error('❌ Failed to get users list:', error)
    return res.status(500).json({
      error: 'Failed to get users list',
      message: error.message
    })
  }
})

// 🔑 API Keys 管理

// Depurar：ObtenerAPI Key费用详情
router.get('/api-keys/:keyId/cost-debug', authenticateAdmin, async (req, res) => {
  try {
    const { keyId } = req.params
    const costStats = await redis.getCostStats(keyId)
    const dailyCost = await redis.getDailyCost(keyId)
    const today = redis.getDateStringInTimezone()

    // Obtener所有相关的Redis键
    const costKeys = await redis.scanKeys(`usage:cost:*:${keyId}:*`)
    const costValues = await redis.batchGetChunked(costKeys)
    const keyValues = {}

    for (let i = 0; i < costKeys.length; i++) {
      keyValues[costKeys[i]] = costValues[i]
    }

    return res.json({
      keyId,
      today,
      dailyCost,
      costStats,
      redisKeys: keyValues,
      timezone: config.system.timezoneOffset || 8
    })
  } catch (error) {
    logger.error('❌ Failed to get cost debug info:', error)
    return res.status(500).json({ error: 'Failed to get cost debug info', message: error.message })
  }
})

// Obtener所有被使用过的模型ColumnaTabla
router.get('/api-keys/used-models', authenticateAdmin, async (req, res) => {
  try {
    const models = await redis.getAllUsedModels()
    return res.json({ success: true, data: models })
  } catch (error) {
    logger.error('❌ Failed to get used models:', error)
    return res.status(500).json({ error: 'Failed to get used models', message: error.message })
  }
})

// Obtener所有API Keys
router.get('/api-keys', authenticateAdmin, async (req, res) => {
  try {
    const {
      // 分页Parámetro
      page = 1,
      pageSize = 20,
      // 搜索Parámetro
      searchMode = 'apiKey',
      search = '',
      // 筛选Parámetro
      tag = '',
      isActive = '',
      models = '', // 模型筛选（逗号分隔）
      // OrdenarParámetro
      sortBy = 'createdAt',
      sortOrder = 'desc',
      // 费用OrdenarParámetro
      costTimeRange = '7days', // 费用Ordenar的Tiempo范围
      costStartDate = '', // custom Tiempo范围的IniciandoFecha
      costEndDate = '', // custom Tiempo范围的结束Fecha
      // 兼容旧Parámetro（不再用于费用Calcular，仅标记）
      timeRange = 'all'
    } = req.query

    // Analizar模型筛选Parámetro
    const modelFilter = models ? models.split(',').filter((m) => m.trim()) : []

    // Validar分页Parámetro
    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSizeNum = [10, 20, 50, 100].includes(parseInt(pageSize)) ? parseInt(pageSize) : 20

    // ValidarOrdenarParámetro（Nueva característica cost Ordenar）
    const validSortFields = [
      'name',
      'createdAt',
      'expiresAt',
      'lastUsedAt',
      'isActive',
      'status',
      'cost'
    ]
    const validSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt'
    const validSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc'

    // ObtenerUsuarioServicio来补充ownerInformación
    const userService = require('../../services/userService')

    // 如果是绑定账号搜索模式，先刷新CuentaNombreCaché
    if (searchMode === 'bindingAccount' && search) {
      const accountNameCacheService = require('../../services/accountNameCacheService')
      await accountNameCacheService.refreshIfNeeded()
    }

    let result
    let costSortStatus = null

    // 如果是费用Ordenar
    if (validSortBy === 'cost') {
      const costRankService = require('../../services/costRankService')

      // Validar费用Ordenar的Tiempo范围
      const validCostTimeRanges = ['today', '7days', '30days', 'all', 'custom']
      const effectiveCostTimeRange = validCostTimeRanges.includes(costTimeRange)
        ? costTimeRange
        : '7days'

      // 如果是 custom Tiempo范围，使用实时Calcular
      if (effectiveCostTimeRange === 'custom') {
        // ValidarFechaParámetro
        if (!costStartDate || !costEndDate) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_DATE_RANGE',
            message: '自定义Tiempo范围需要提供 costStartDate 和 costEndDate Parámetro'
          })
        }

        const start = new Date(costStartDate)
        const end = new Date(costEndDate)
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_DATE_FORMAT',
            message: 'FechaFormato无效'
          })
        }

        if (start > end) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_DATE_RANGE',
            message: 'IniciandoFecha不能晚于结束Fecha'
          })
        }

        // Límite最大范围为 365 天
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
        if (daysDiff > 365) {
          return res.status(400).json({
            success: false,
            error: 'DATE_RANGE_TOO_LARGE',
            message: 'Fecha范围不能超过365天'
          })
        }

        logger.info(`📊 Cost sort with custom range: ${costStartDate} to ${costEndDate}`)

        // 实时Calcular费用Ordenar
        result = await getApiKeysSortedByCostCustom({
          page: pageNum,
          pageSize: pageSizeNum,
          sortOrder: validSortOrder,
          startDate: costStartDate,
          endDate: costEndDate,
          search,
          searchMode,
          tag,
          isActive,
          modelFilter
        })

        costSortStatus = {
          status: 'ready',
          isRealTimeCalculation: true
        }
      } else {
        // 使用预CalcularÍndice
        const rankStatus = await costRankService.getRankStatus()
        costSortStatus = rankStatus[effectiveCostTimeRange]

        // VerificarÍndice是否就绪
        if (!costSortStatus || costSortStatus.status !== 'ready') {
          return res.status(503).json({
            success: false,
            error: 'RANK_NOT_READY',
            message: `费用OrdenarÍndice (${effectiveCostTimeRange}) En progresoActualizar中，请稍后Reintentar`,
            costSortStatus: costSortStatus || { status: 'unknown' }
          })
        }

        logger.info(`📊 Cost sort using precomputed index: ${effectiveCostTimeRange}`)

        // 使用预CalcularÍndiceOrdenar
        result = await getApiKeysSortedByCostPrecomputed({
          page: pageNum,
          pageSize: pageSizeNum,
          sortOrder: validSortOrder,
          costTimeRange: effectiveCostTimeRange,
          search,
          searchMode,
          tag,
          isActive,
          modelFilter
        })

        costSortStatus.isRealTimeCalculation = false
      }
    } else {
      // 原有的非费用Ordenar逻辑
      result = await redis.getApiKeysPaginated({
        page: pageNum,
        pageSize: pageSizeNum,
        searchMode,
        search,
        tag,
        isActive,
        sortBy: validSortBy,
        sortOrder: validSortOrder,
        modelFilter
      })
    }

    // 为每个API Key添加owner的displayName（批量ObtenerOptimización）
    const userIdsToFetch = [...new Set(result.items.filter((k) => k.userId).map((k) => k.userId))]
    const userMap = new Map()

    if (userIdsToFetch.length > 0) {
      // 批量ObtenerUsuarioInformación
      const users = await Promise.all(
        userIdsToFetch.map((id) => userService.getUserById(id, false).catch(() => null))
      )
      userIdsToFetch.forEach((id, i) => {
        if (users[i]) {
          userMap.set(id, users[i])
        }
      })
    }

    for (const apiKey of result.items) {
      if (apiKey.userId && userMap.has(apiKey.userId)) {
        const user = userMap.get(apiKey.userId)
        apiKey.ownerDisplayName = user.displayName || user.username || 'Unknown User'
      } else if (apiKey.userId) {
        apiKey.ownerDisplayName = 'Unknown User'
      } else {
        apiKey.ownerDisplayName =
          apiKey.createdBy === 'admin' ? 'Admin' : apiKey.createdBy || 'Admin'
      }

      // Inicializar空的 usage Objeto（费用通过 batch-stats InterfazObtener）
      if (!apiKey.usage) {
        apiKey.usage = { total: { requests: 0, tokens: 0, cost: 0, formattedCost: '$0.00' } }
      }
    }

    // Retornar分页Datos
    const responseData = {
      success: true,
      data: {
        items: result.items,
        pagination: result.pagination,
        availableTags: result.availableTags
      },
      // 标记当前Solicitud的Tiempo范围（供前端参考）
      timeRange
    }

    // 如果是费用Ordenar，附加Ordenar状态
    if (costSortStatus) {
      responseData.data.costSortStatus = costSortStatus
    }

    return res.json(responseData)
  } catch (error) {
    logger.error('❌ Failed to get API keys:', error)
    return res.status(500).json({ error: 'Failed to get API keys', message: error.message })
  }
})

/**
 * 使用预CalcularÍndice进Fila费用Ordenar的分页Consulta
 */
async function getApiKeysSortedByCostPrecomputed(options) {
  const {
    page,
    pageSize,
    sortOrder,
    costTimeRange,
    search,
    searchMode,
    tag,
    isActive,
    modelFilter = []
  } = options
  const costRankService = require('../../services/costRankService')

  // 1. ObtenerOrdenar后的全量 keyId ColumnaTabla
  const rankedKeyIds = await costRankService.getSortedKeyIds(costTimeRange, sortOrder)

  if (rankedKeyIds.length === 0) {
    return {
      items: [],
      pagination: { page: 1, pageSize, total: 0, totalPages: 1 },
      availableTags: []
    }
  }

  // 2. 批量Obtener API Key 基础Datos
  const allKeys = await redis.batchGetApiKeys(rankedKeyIds)

  // 3. 保持Ordenar顺序（使用 Map Optimización查找）
  const keyMap = new Map(allKeys.map((k) => [k.id, k]))
  let orderedKeys = rankedKeyIds.map((id) => keyMap.get(id)).filter((k) => k && !k.isDeleted)

  // 4. 应用筛选Condición
  // 状态筛选
  if (isActive !== '' && isActive !== undefined && isActive !== null) {
    const activeValue = isActive === 'true' || isActive === true
    orderedKeys = orderedKeys.filter((k) => k.isActive === activeValue)
  }

  // 标签筛选
  if (tag) {
    orderedKeys = orderedKeys.filter((k) => {
      const tags = Array.isArray(k.tags) ? k.tags : []
      return tags.includes(tag)
    })
  }

  // 搜索筛选
  if (search) {
    const lowerSearch = search.toLowerCase().trim()
    if (searchMode === 'apiKey') {
      orderedKeys = orderedKeys.filter((k) => k.name && k.name.toLowerCase().includes(lowerSearch))
    } else if (searchMode === 'bindingAccount') {
      const accountNameCacheService = require('../../services/accountNameCacheService')
      orderedKeys = accountNameCacheService.searchByBindingAccount(orderedKeys, lowerSearch)
    }
  }

  // 模型筛选
  if (modelFilter.length > 0) {
    const keyIdsWithModels = await redis.getKeyIdsWithModels(
      orderedKeys.map((k) => k.id),
      modelFilter
    )
    orderedKeys = orderedKeys.filter((k) => keyIdsWithModels.has(k.id))
  }

  // 5. 收集所有可用标签
  const allTags = new Set()
  for (const key of allKeys) {
    if (!key.isDeleted) {
      const tags = Array.isArray(key.tags) ? key.tags : []
      tags.forEach((t) => allTags.add(t))
    }
  }
  const availableTags = [...allTags].sort()

  // 6. 分页
  const total = orderedKeys.length
  const totalPages = Math.ceil(total / pageSize) || 1
  const validPage = Math.min(Math.max(1, page), totalPages)
  const start = (validPage - 1) * pageSize
  const items = orderedKeys.slice(start, start + pageSize)

  // 7. 为当前页的 Keys 附加费用Datos
  const keyCosts = await costRankService.getBatchKeyCosts(
    costTimeRange,
    items.map((k) => k.id)
  )
  for (const key of items) {
    key._cost = keyCosts.get(key.id) || 0
  }

  return {
    items,
    pagination: {
      page: validPage,
      pageSize,
      total,
      totalPages
    },
    availableTags
  }
}

/**
 * 使用实时Calcular进Fila custom Tiempo范围的费用Ordenar
 */
async function getApiKeysSortedByCostCustom(options) {
  const {
    page,
    pageSize,
    sortOrder,
    startDate,
    endDate,
    search,
    searchMode,
    tag,
    isActive,
    modelFilter = []
  } = options
  const costRankService = require('../../services/costRankService')

  // 1. 实时Calcular所有 Keys 的费用
  const costs = await costRankService.calculateCustomRangeCosts(startDate, endDate)

  if (costs.size === 0) {
    return {
      items: [],
      pagination: { page: 1, pageSize, total: 0, totalPages: 1 },
      availableTags: []
    }
  }

  // 2. Convertir为Arreglo并Ordenar
  const sortedEntries = [...costs.entries()].sort((a, b) =>
    sortOrder === 'desc' ? b[1] - a[1] : a[1] - b[1]
  )
  const rankedKeyIds = sortedEntries.map(([keyId]) => keyId)

  // 3. 批量Obtener API Key 基础Datos
  const allKeys = await redis.batchGetApiKeys(rankedKeyIds)

  // 4. 保持Ordenar顺序
  const keyMap = new Map(allKeys.map((k) => [k.id, k]))
  let orderedKeys = rankedKeyIds.map((id) => keyMap.get(id)).filter((k) => k && !k.isDeleted)

  // 5. 应用筛选Condición
  // 状态筛选
  if (isActive !== '' && isActive !== undefined && isActive !== null) {
    const activeValue = isActive === 'true' || isActive === true
    orderedKeys = orderedKeys.filter((k) => k.isActive === activeValue)
  }

  // 标签筛选
  if (tag) {
    orderedKeys = orderedKeys.filter((k) => {
      const tags = Array.isArray(k.tags) ? k.tags : []
      return tags.includes(tag)
    })
  }

  // 搜索筛选
  if (search) {
    const lowerSearch = search.toLowerCase().trim()
    if (searchMode === 'apiKey') {
      orderedKeys = orderedKeys.filter((k) => k.name && k.name.toLowerCase().includes(lowerSearch))
    } else if (searchMode === 'bindingAccount') {
      const accountNameCacheService = require('../../services/accountNameCacheService')
      orderedKeys = accountNameCacheService.searchByBindingAccount(orderedKeys, lowerSearch)
    }
  }

  // 模型筛选
  if (modelFilter.length > 0) {
    const keyIdsWithModels = await redis.getKeyIdsWithModels(
      orderedKeys.map((k) => k.id),
      modelFilter
    )
    orderedKeys = orderedKeys.filter((k) => keyIdsWithModels.has(k.id))
  }

  // 6. 收集所有可用标签
  const allTags = new Set()
  for (const key of allKeys) {
    if (!key.isDeleted) {
      const tags = Array.isArray(key.tags) ? key.tags : []
      tags.forEach((t) => allTags.add(t))
    }
  }
  const availableTags = [...allTags].sort()

  // 7. 分页
  const total = orderedKeys.length
  const totalPages = Math.ceil(total / pageSize) || 1
  const validPage = Math.min(Math.max(1, page), totalPages)
  const start = (validPage - 1) * pageSize
  const items = orderedKeys.slice(start, start + pageSize)

  // 8. 为当前页的 Keys 附加费用Datos
  for (const key of items) {
    key._cost = costs.get(key.id) || 0
  }

  return {
    items,
    pagination: {
      page: validPage,
      pageSize,
      total,
      totalPages
    },
    availableTags
  }
}

// Obtener费用OrdenarÍndice状态
router.get('/api-keys/cost-sort-status', authenticateAdmin, async (req, res) => {
  try {
    const costRankService = require('../../services/costRankService')
    const status = await costRankService.getRankStatus()
    return res.json({ success: true, data: status })
  } catch (error) {
    logger.error('❌ Failed to get cost sort status:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get cost sort status',
      message: error.message
    })
  }
})

// Obtener API Key Índice状态
router.get('/api-keys/index-status', authenticateAdmin, async (req, res) => {
  try {
    const apiKeyIndexService = require('../../services/apiKeyIndexService')
    const status = await apiKeyIndexService.getStatus()
    return res.json({ success: true, data: status })
  } catch (error) {
    logger.error('❌ Failed to get API Key index status:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get index status',
      message: error.message
    })
  }
})

// 手动重建 API Key Índice
router.post('/api-keys/index-rebuild', authenticateAdmin, async (req, res) => {
  try {
    const apiKeyIndexService = require('../../services/apiKeyIndexService')
    const status = await apiKeyIndexService.getStatus()

    if (status.building) {
      return res.status(409).json({
        success: false,
        error: 'INDEX_BUILDING',
        message: 'ÍndiceEn progreso重建中，请稍后再试',
        progress: status.progress
      })
    }

    // Asíncrono重建，不等待Completado
    apiKeyIndexService.rebuildIndexes().catch((err) => {
      logger.error('❌ Failed to rebuild API Key index:', err)
    })

    return res.json({
      success: true,
      message: 'API Key Índice重建已Iniciando'
    })
  } catch (error) {
    logger.error('❌ Failed to trigger API Key index rebuild:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger rebuild',
      message: error.message
    })
  }
})

// 强制刷新费用OrdenarÍndice
router.post('/api-keys/cost-sort-refresh', authenticateAdmin, async (req, res) => {
  try {
    const { timeRange } = req.body
    const costRankService = require('../../services/costRankService')

    // ValidarTiempo范围
    if (timeRange) {
      const validTimeRanges = ['today', '7days', '30days', 'all']
      if (!validTimeRanges.includes(timeRange)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_TIME_RANGE',
          message: '无效的Tiempo范围，OpcionalValor：today, 7days, 30days, all'
        })
      }
    }

    // Asíncrono刷新，不等待Completado
    costRankService.forceRefresh(timeRange || null).catch((err) => {
      logger.error('❌ Failed to refresh cost rank:', err)
    })

    return res.json({
      success: true,
      message: timeRange ? `费用OrdenarÍndice (${timeRange}) 刷新已Iniciando` : '所有费用OrdenarÍndice刷新已Iniciando'
    })
  } catch (error) {
    logger.error('❌ Failed to trigger cost sort refresh:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger refresh',
      message: error.message
    })
  }
})

// ObtenerSoportar的ClienteColumnaTabla（使用新的Validar器）
router.get('/supported-clients', authenticateAdmin, async (req, res) => {
  try {
    // 使用新的 ClientValidator Obtener所有可用Cliente
    const ClientValidator = require('../../validators/clientValidator')
    const availableClients = ClientValidator.getAvailableClients()

    // Formato化RetornarDatos
    const clients = availableClients.map((client) => ({
      id: client.id,
      name: client.name,
      description: client.description,
      icon: client.icon
    }))

    logger.info(`📱 Returning ${clients.length} supported clients`)
    return res.json({ success: true, data: clients })
  } catch (error) {
    logger.error('❌ Failed to get supported clients:', error)
    return res
      .status(500)
      .json({ error: 'Failed to get supported clients', message: error.message })
  }
})

// Obtener已存在的标签ColumnaTabla
router.get('/api-keys/tags', authenticateAdmin, async (req, res) => {
  try {
    const tags = await apiKeyService.getAllTags()

    logger.info(`📋 Retrieved ${tags.length} unique tags from API keys`)
    return res.json({ success: true, data: tags })
  } catch (error) {
    logger.error('❌ Failed to get API key tags:', error)
    return res.status(500).json({ error: 'Failed to get API key tags', message: error.message })
  }
})

// Obtener标签详情（含使用数量）
router.get('/api-keys/tags/details', authenticateAdmin, async (req, res) => {
  try {
    const tagDetails = await apiKeyService.getTagsWithCount()
    logger.info(`📋 Retrieved ${tagDetails.length} tags with usage counts`)
    return res.json({ success: true, data: tagDetails })
  } catch (error) {
    logger.error('❌ Failed to get tag details:', error)
    return res.status(500).json({ error: 'Failed to get tag details', message: error.message })
  }
})

// Crear新标签
router.post('/api-keys/tags', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '标签Nombre不能为空' })
    }

    const result = await apiKeyService.createTag(name.trim())
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    logger.info(`🏷️ Created new tag: ${name}`)
    return res.json({ success: true, message: '标签CrearÉxito' })
  } catch (error) {
    logger.error('❌ Failed to create tag:', error)
    return res.status(500).json({ error: 'Failed to create tag', message: error.message })
  }
})

// Eliminar标签（从所有 API Key 中Eliminación）
router.delete('/api-keys/tags/:tagName', authenticateAdmin, async (req, res) => {
  try {
    const { tagName } = req.params
    if (!tagName) {
      return res.status(400).json({ error: 'Tag name is required' })
    }

    const decodedTagName = decodeURIComponent(tagName)
    const result = await apiKeyService.removeTagFromAllKeys(decodedTagName)

    logger.info(`🏷️ Removed tag "${decodedTagName}" from ${result.affectedCount} API keys`)
    return res.json({
      success: true,
      message: `Tag "${decodedTagName}" removed from ${result.affectedCount} API keys`,
      affectedCount: result.affectedCount
    })
  } catch (error) {
    logger.error('❌ Failed to delete tag:', error)
    return res.status(500).json({ error: 'Failed to delete tag', message: error.message })
  }
})

// 重命名标签
router.put('/api-keys/tags/:tagName', authenticateAdmin, async (req, res) => {
  try {
    const { tagName } = req.params
    const { newName } = req.body
    if (!tagName || !newName || !newName.trim()) {
      return res.status(400).json({ error: 'Tag name and new name are required' })
    }

    const decodedTagName = decodeURIComponent(tagName)
    const trimmedNewName = newName.trim()
    const result = await apiKeyService.renameTag(decodedTagName, trimmedNewName)

    if (result.error) {
      return res.status(400).json({ error: result.error })
    }

    logger.info(
      `🏷️ Renamed tag "${decodedTagName}" to "${trimmedNewName}" in ${result.affectedCount} API keys`
    )
    return res.json({
      success: true,
      message: `Tag renamed in ${result.affectedCount} API keys`,
      affectedCount: result.affectedCount
    })
  } catch (error) {
    logger.error('❌ Failed to rename tag:', error)
    return res.status(500).json({ error: 'Failed to rename tag', message: error.message })
  }
})

/**
 * ObtenerCuenta绑定的 API Key 数量Estadística
 * GET /admin/accounts/binding-counts
 *
 * Retornar每种CuentaTipo的绑定数量Estadística，用于CuentaColumnaTablaPágina显示"绑定: X 个API Key"
 * 这是一个轻量级Interfaz，只Retornar计数而不是完整的 API Key Datos
 */
router.get('/accounts/binding-counts', authenticateAdmin, async (req, res) => {
  try {
    // 使用Optimización的分页MétodoObtener所有非Eliminar的 API Keys（只需要绑定Campo）
    const result = await redis.getApiKeysPaginated({
      page: 1,
      pageSize: 10000, // Obtener所有
      excludeDeleted: true
    })

    const apiKeys = result.items

    // InicializarEstadísticaObjeto
    const bindingCounts = {
      claudeAccountId: {},
      claudeConsoleAccountId: {},
      geminiAccountId: {},
      openaiAccountId: {},
      azureOpenaiAccountId: {},
      bedrockAccountId: {},
      droidAccountId: {},
      ccrAccountId: {}
    }

    // 遍历一次，Estadística每个Cuenta的绑定数量
    for (const key of apiKeys) {
      // Claude Cuenta
      if (key.claudeAccountId) {
        const id = key.claudeAccountId
        bindingCounts.claudeAccountId[id] = (bindingCounts.claudeAccountId[id] || 0) + 1
      }

      // Claude Console Cuenta
      if (key.claudeConsoleAccountId) {
        const id = key.claudeConsoleAccountId
        bindingCounts.claudeConsoleAccountId[id] =
          (bindingCounts.claudeConsoleAccountId[id] || 0) + 1
      }

      // Gemini Cuenta（包括 api: 前缀的 Gemini-API Cuenta）
      if (key.geminiAccountId) {
        const id = key.geminiAccountId
        bindingCounts.geminiAccountId[id] = (bindingCounts.geminiAccountId[id] || 0) + 1
      }

      // OpenAI Cuenta（包括 responses: 前缀的 OpenAI-Responses Cuenta）
      if (key.openaiAccountId) {
        const id = key.openaiAccountId
        bindingCounts.openaiAccountId[id] = (bindingCounts.openaiAccountId[id] || 0) + 1
      }

      // Azure OpenAI Cuenta
      if (key.azureOpenaiAccountId) {
        const id = key.azureOpenaiAccountId
        bindingCounts.azureOpenaiAccountId[id] = (bindingCounts.azureOpenaiAccountId[id] || 0) + 1
      }

      // Bedrock Cuenta
      if (key.bedrockAccountId) {
        const id = key.bedrockAccountId
        bindingCounts.bedrockAccountId[id] = (bindingCounts.bedrockAccountId[id] || 0) + 1
      }

      // Droid Cuenta
      if (key.droidAccountId) {
        const id = key.droidAccountId
        bindingCounts.droidAccountId[id] = (bindingCounts.droidAccountId[id] || 0) + 1
      }

      // CCR Cuenta
      if (key.ccrAccountId) {
        const id = key.ccrAccountId
        bindingCounts.ccrAccountId[id] = (bindingCounts.ccrAccountId[id] || 0) + 1
      }
    }

    logger.debug(`📊 Account binding counts calculated from ${apiKeys.length} API keys`)
    return res.json({ success: true, data: bindingCounts })
  } catch (error) {
    logger.error('❌ Failed to get account binding counts:', error)
    return res.status(500).json({
      error: 'Failed to get account binding counts',
      message: error.message
    })
  }
})

/**
 * 批量Obtener指定 Keys 的EstadísticaDatos和费用
 * POST /admin/api-keys/batch-stats
 *
 * 用于 API Keys ColumnaTablaPáginaAsíncrono加载EstadísticaDatos
 */
router.post('/api-keys/batch-stats', authenticateAdmin, async (req, res) => {
  try {
    const {
      keyIds, // Requerido：API Key ID Arreglo
      timeRange = 'all', // Tiempo范围：all, today, 7days, monthly, custom
      startDate, // custom 时Requerido
      endDate // custom 时Requerido
    } = req.body

    // ParámetroValidar
    if (!Array.isArray(keyIds) || keyIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'keyIds is required and must be a non-empty array'
      })
    }

    // Límite单次最多Procesar 100 个 Key
    if (keyIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Max 100 keys per request'
      })
    }

    // Validar custom Tiempo范围的Parámetro
    if (timeRange === 'custom') {
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required for custom time range'
        })
      }
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        })
      }
      if (start > end) {
        return res.status(400).json({
          success: false,
          error: 'startDate must be before or equal to endDate'
        })
      }
      // Límite最大范围为 365 天
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
      if (daysDiff > 365) {
        return res.status(400).json({
          success: false,
          error: 'Date range cannot exceed 365 days'
        })
      }
    }

    logger.info(
      `📊 Batch stats request: ${keyIds.length} keys, timeRange=${timeRange}`,
      timeRange === 'custom' ? `, ${startDate} to ${endDate}` : ''
    )

    const stats = {}

    // 并FilaCalcular每个 Key 的EstadísticaDatos
    await Promise.all(
      keyIds.map(async (keyId) => {
        try {
          stats[keyId] = await calculateKeyStats(keyId, timeRange, startDate, endDate)
        } catch (error) {
          logger.error(`❌ Failed to calculate stats for key ${keyId}:`, error)
          stats[keyId] = {
            requests: 0,
            tokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreateTokens: 0,
            cacheReadTokens: 0,
            cost: 0,
            formattedCost: '$0.00',
            dailyCost: 0,
            weeklyOpusCost: 0,
            currentWindowCost: 0,
            currentWindowRequests: 0,
            currentWindowTokens: 0,
            windowRemainingSeconds: null,
            windowStartTime: null,
            windowEndTime: null,
            allTimeCost: 0,
            error: error.message
          }
        }
      })
    )

    return res.json({ success: true, data: stats })
  } catch (error) {
    logger.error('❌ Failed to calculate batch stats:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate stats',
      message: error.message
    })
  }
})

/**
 * Calcular单个 Key 的EstadísticaDatos
 * @param {string} keyId - API Key ID
 * @param {string} timeRange - Tiempo范围
 * @param {string} startDate - IniciandoFecha (custom 模式)
 * @param {string} endDate - 结束Fecha (custom 模式)
 * @returns {Object} EstadísticaDatos
 */
async function calculateKeyStats(keyId, timeRange, startDate, endDate) {
  const client = redis.getClientSafe()
  const tzDate = redis.getDateInTimezone()
  const today = redis.getDateStringInTimezone()

  // Construir搜索模式
  const searchPatterns = []

  if (timeRange === 'custom' && startDate && endDate) {
    // 自定义Fecha范围
    const start = new Date(startDate)
    const end = new Date(endDate)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = redis.getDateStringInTimezone(d)
      searchPatterns.push(`usage:${keyId}:model:daily:*:${dateStr}`)
    }
  } else if (timeRange === 'today') {
    searchPatterns.push(`usage:${keyId}:model:daily:*:${today}`)
  } else if (timeRange === '7days') {
    // 最近7天
    for (let i = 0; i < 7; i++) {
      const d = new Date(tzDate)
      d.setDate(d.getDate() - i)
      const dateStr = redis.getDateStringInTimezone(d)
      searchPatterns.push(`usage:${keyId}:model:daily:*:${dateStr}`)
    }
  } else if (timeRange === 'monthly') {
    // 当月
    const currentMonth = `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(2, '0')}`
    searchPatterns.push(`usage:${keyId}:model:monthly:*:${currentMonth}`)
  } else {
    // all - Obtener所有Datos（日和月Datos都查）
    searchPatterns.push(`usage:${keyId}:model:daily:*`)
    searchPatterns.push(`usage:${keyId}:model:monthly:*`)
  }

  // 使用 SCAN 收集所有匹配的 keys
  const allKeys = []
  for (const pattern of searchPatterns) {
    let cursor = '0'
    do {
      const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = newCursor
      allKeys.push(...keys)
    } while (cursor !== '0')
  }

  // 去重（避免日Datos和月Datos重复Calcular）
  const uniqueKeys = [...new Set(allKeys)]

  // Obtener实时LímiteDatos（窗口Datos不受Tiempo范围筛选影响，始终Obtener当前窗口状态）
  let dailyCost = 0
  let weeklyOpusCost = 0 // Campo名沿用 weeklyOpusCost*，语义为"Claude 周费用"
  let currentWindowCost = 0
  let currentWindowRequests = 0 // 当前窗口Solicitud次数
  let currentWindowTokens = 0 // 当前窗口 Token 使用量
  let windowRemainingSeconds = null
  let windowStartTime = null
  let windowEndTime = null
  let allTimeCost = 0

  try {
    // 先Obtener API Key Configuración，判断是否需要ConsultaLímite相关Datos
    const apiKey = await redis.getApiKey(keyId)
    const rateLimitWindow = parseInt(apiKey?.rateLimitWindow) || 0
    const dailyCostLimit = parseFloat(apiKey?.dailyCostLimit) || 0
    const totalCostLimit = parseFloat(apiKey?.totalCostLimit) || 0
    const weeklyOpusCostLimit = parseFloat(apiKey?.weeklyOpusCostLimit) || 0

    // 只在Habilitar了每日费用Límite时Consulta
    if (dailyCostLimit > 0) {
      dailyCost = await redis.getDailyCost(keyId)
    }

    // 只在Habilitar了总费用Límite时Consulta
    if (totalCostLimit > 0) {
      const totalCostKey = `usage:cost:total:${keyId}`
      allTimeCost = parseFloat((await client.get(totalCostKey)) || '0')
    }

    // 只在Habilitar了 Claude 周费用Límite时Consulta（Campo名沿用 weeklyOpusCostLimit）
    if (weeklyOpusCostLimit > 0) {
      weeklyOpusCost = await redis.getWeeklyOpusCost(keyId)
    }

    // 只在Habilitar了窗口Límite时Consulta窗口Datos（移到早期Retornar之前，确保窗口Datos始终被Obtener）
    if (rateLimitWindow > 0) {
      const requestCountKey = `rate_limit:requests:${keyId}`
      const tokenCountKey = `rate_limit:tokens:${keyId}`
      const costCountKey = `rate_limit:cost:${keyId}`
      const windowStartKey = `rate_limit:window_start:${keyId}`

      currentWindowRequests = parseInt((await client.get(requestCountKey)) || '0')
      currentWindowTokens = parseInt((await client.get(tokenCountKey)) || '0')
      currentWindowCost = parseFloat((await client.get(costCountKey)) || '0')

      // Obtener窗口IniciandoTiempo和Calcular剩余Tiempo
      const windowStart = await client.get(windowStartKey)
      if (windowStart) {
        const now = Date.now()
        windowStartTime = parseInt(windowStart)
        const windowDuration = rateLimitWindow * 60 * 1000 // Convertir为毫秒
        windowEndTime = windowStartTime + windowDuration

        // 如果窗口还有效
        if (now < windowEndTime) {
          windowRemainingSeconds = Math.max(0, Math.floor((windowEndTime - now) / 1000))
        } else {
          // 窗口已过期
          windowRemainingSeconds = 0
          currentWindowRequests = 0
          currentWindowTokens = 0
          currentWindowCost = 0
        }
      }
    }

    // 🔧 FIX: 对于 "全部Tiempo" Tiempo范围，直接使用 allTimeCost
    // 因为 usage:*:model:daily:* 键有 30 天 TTL，旧Datos已经过期
    if (timeRange === 'all' && allTimeCost > 0) {
      logger.debug(`📊 使用 allTimeCost Calcular timeRange='all': ${allTimeCost}`)

      return {
        requests: 0, // 旧Datos详情不可用
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreateTokens: 0,
        cacheReadTokens: 0,
        cost: allTimeCost,
        formattedCost: CostCalculator.formatCost(allTimeCost),
        // 实时LímiteDatos（始终Retornar，不受Tiempo范围影响）
        dailyCost,
        weeklyOpusCost,
        currentWindowCost,
        currentWindowRequests,
        currentWindowTokens,
        windowRemainingSeconds,
        windowStartTime,
        windowEndTime,
        allTimeCost
      }
    }
  } catch (error) {
    logger.warn(`⚠️ Obtener实时LímiteDatosFalló (key: ${keyId}):`, error.message)
  }

  // 如果没有使用Datos，Retornar零Valor但Incluir窗口Datos
  if (uniqueKeys.length === 0) {
    return {
      requests: 0,
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreateTokens: 0,
      cacheReadTokens: 0,
      cost: 0,
      formattedCost: '$0.00',
      // 实时LímiteDatos（始终Retornar，不受Tiempo范围影响）
      dailyCost,
      weeklyOpusCost,
      currentWindowCost,
      currentWindowRequests,
      currentWindowTokens,
      windowRemainingSeconds,
      windowStartTime,
      windowEndTime,
      allTimeCost
    }
  }

  // 使用 Pipeline 批量ObtenerDatos
  const pipeline = client.pipeline()
  for (const key of uniqueKeys) {
    pipeline.hgetall(key)
  }
  const results = await pipeline.exec()

  // 汇总Calcular
  const modelStatsMap = new Map()
  let totalRequests = 0

  // 用于去重：先Estadística月Datos，避免与日Datos重复
  const dailyKeyPattern = /usage:.+:model:daily:(.+):\d{4}-\d{2}-\d{2}$/
  const monthlyKeyPattern = /usage:.+:model:monthly:(.+):\d{4}-\d{2}$/
  const currentMonth = `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(2, '0')}`

  for (let i = 0; i < results.length; i++) {
    const [err, data] = results[i]
    if (err || !data || Object.keys(data).length === 0) {
      continue
    }

    const key = uniqueKeys[i]
    let model = null
    let isMonthly = false

    // 提取模型Nombre
    const dailyMatch = key.match(dailyKeyPattern)
    const monthlyMatch = key.match(monthlyKeyPattern)

    if (dailyMatch) {
      model = dailyMatch[1]
    } else if (monthlyMatch) {
      model = monthlyMatch[1]
      isMonthly = true
    }

    if (!model) {
      continue
    }

    // 跳过当前月的月Datos
    if (isMonthly && key.includes(`:${currentMonth}`)) {
      continue
    }
    // 跳过非当前月的日Datos
    if (!isMonthly && !key.includes(`:${currentMonth}-`)) {
      continue
    }

    if (!modelStatsMap.has(model)) {
      modelStatsMap.set(model, {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreateTokens: 0,
        cacheReadTokens: 0,
        requests: 0
      })
    }

    const stats = modelStatsMap.get(model)
    stats.inputTokens += parseInt(data.totalInputTokens) || parseInt(data.inputTokens) || 0
    stats.outputTokens += parseInt(data.totalOutputTokens) || parseInt(data.outputTokens) || 0
    stats.cacheCreateTokens +=
      parseInt(data.totalCacheCreateTokens) || parseInt(data.cacheCreateTokens) || 0
    stats.cacheReadTokens +=
      parseInt(data.totalCacheReadTokens) || parseInt(data.cacheReadTokens) || 0
    stats.requests += parseInt(data.totalRequests) || parseInt(data.requests) || 0

    totalRequests += parseInt(data.totalRequests) || parseInt(data.requests) || 0
  }

  // Calcular费用
  let totalCost = 0
  let inputTokens = 0
  let outputTokens = 0
  let cacheCreateTokens = 0
  let cacheReadTokens = 0

  for (const [model, stats] of modelStatsMap) {
    inputTokens += stats.inputTokens
    outputTokens += stats.outputTokens
    cacheCreateTokens += stats.cacheCreateTokens
    cacheReadTokens += stats.cacheReadTokens

    const costResult = CostCalculator.calculateCost(
      {
        input_tokens: stats.inputTokens,
        output_tokens: stats.outputTokens,
        cache_creation_input_tokens: stats.cacheCreateTokens,
        cache_read_input_tokens: stats.cacheReadTokens
      },
      model
    )
    totalCost += costResult.costs.total
  }

  const tokens = inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens

  return {
    requests: totalRequests,
    tokens,
    inputTokens,
    outputTokens,
    cacheCreateTokens,
    cacheReadTokens,
    cost: totalCost,
    formattedCost: CostCalculator.formatCost(totalCost),
    // 实时LímiteDatos
    dailyCost,
    weeklyOpusCost,
    currentWindowCost,
    currentWindowRequests,
    currentWindowTokens,
    windowRemainingSeconds,
    windowStartTime,
    windowEndTime,
    allTimeCost // 历史总费用（用于总费用Límite）
  }
}

/**
 * 批量Obtener指定 Keys 的最后使用账号Información
 * POST /admin/api-keys/batch-last-usage
 *
 * 用于 API Keys ColumnaTablaPáginaAsíncrono加载最后使用账号Datos
 */
router.post('/api-keys/batch-last-usage', authenticateAdmin, async (req, res) => {
  try {
    const { keyIds } = req.body

    // ParámetroValidar
    if (!Array.isArray(keyIds) || keyIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'keyIds is required and must be a non-empty array'
      })
    }

    // Límite单次最多Procesar 100 个 Key
    if (keyIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Max 100 keys per request'
      })
    }

    logger.debug(`📊 Batch last-usage request: ${keyIds.length} keys`)

    const client = redis.getClientSafe()
    const lastUsageData = {}
    const accountInfoCache = new Map()

    // 并FilaObtener每个 Key 的最后使用Registro
    await Promise.all(
      keyIds.map(async (keyId) => {
        try {
          // Obtener最新的使用Registro
          const usageRecords = await redis.getUsageRecords(keyId, 1)
          if (!Array.isArray(usageRecords) || usageRecords.length === 0) {
            lastUsageData[keyId] = null
            return
          }

          const lastUsageRecord = usageRecords[0]
          if (!lastUsageRecord || (!lastUsageRecord.accountId && !lastUsageRecord.accountType)) {
            lastUsageData[keyId] = null
            return
          }

          // Analizar账号Información
          const resolvedAccount = await apiKeyService._resolveAccountByUsageRecord(
            lastUsageRecord,
            accountInfoCache,
            client
          )

          if (resolvedAccount) {
            lastUsageData[keyId] = {
              accountId: resolvedAccount.accountId,
              rawAccountId: lastUsageRecord.accountId || resolvedAccount.accountId,
              accountType: resolvedAccount.accountType,
              accountCategory: resolvedAccount.accountCategory,
              accountName: resolvedAccount.accountName,
              recordedAt: lastUsageRecord.timestamp || null
            }
          } else {
            // 账号已Eliminar
            lastUsageData[keyId] = {
              accountId: null,
              rawAccountId: lastUsageRecord.accountId || null,
              accountType: 'deleted',
              accountCategory: 'deleted',
              accountName: '已Eliminar',
              recordedAt: lastUsageRecord.timestamp || null
            }
          }
        } catch (error) {
          logger.debug(`Obtener API Key ${keyId} 的最后使用RegistroFalló:`, error)
          lastUsageData[keyId] = null
        }
      })
    )

    return res.json({ success: true, data: lastUsageData })
  } catch (error) {
    logger.error('❌ Failed to get batch last-usage:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get last-usage data',
      message: error.message
    })
  }
})

// Crear新的API Key
router.post('/api-keys', authenticateAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      tokenLimit,
      expiresAt,
      claudeAccountId,
      claudeConsoleAccountId,
      geminiAccountId,
      openaiAccountId,
      bedrockAccountId,
      droidAccountId,
      permissions,
      concurrencyLimit,
      rateLimitWindow,
      rateLimitRequests,
      rateLimitCost,
      enableModelRestriction,
      restrictedModels,
      enableClientRestriction,
      allowedClients,
      dailyCostLimit,
      totalCostLimit,
      weeklyOpusCostLimit,
      tags,
      activationDays, // Nueva característica：激活后有效天数
      activationUnit, // Nueva característica：激活Tiempo单位 (hours/days)
      expirationMode, // Nueva característica：过期模式
      icon, // Nueva característica：图标
      serviceRates // API Key 级别Servicio倍率
    } = req.body

    // 输入Validar
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required and must be a non-empty string' })
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'Name must be less than 100 characters' })
    }

    if (description && (typeof description !== 'string' || description.length > 500)) {
      return res
        .status(400)
        .json({ error: 'Description must be a string with less than 500 characters' })
    }

    if (tokenLimit && (!Number.isInteger(Number(tokenLimit)) || Number(tokenLimit) < 0)) {
      return res.status(400).json({ error: 'Token limit must be a non-negative integer' })
    }

    if (
      concurrencyLimit !== undefined &&
      concurrencyLimit !== null &&
      concurrencyLimit !== '' &&
      (!Number.isInteger(Number(concurrencyLimit)) || Number(concurrencyLimit) < 0)
    ) {
      return res.status(400).json({ error: 'Concurrency limit must be a non-negative integer' })
    }

    if (
      rateLimitWindow !== undefined &&
      rateLimitWindow !== null &&
      rateLimitWindow !== '' &&
      (!Number.isInteger(Number(rateLimitWindow)) || Number(rateLimitWindow) < 1)
    ) {
      return res
        .status(400)
        .json({ error: 'Rate limit window must be a positive integer (minutes)' })
    }

    if (
      rateLimitRequests !== undefined &&
      rateLimitRequests !== null &&
      rateLimitRequests !== '' &&
      (!Number.isInteger(Number(rateLimitRequests)) || Number(rateLimitRequests) < 1)
    ) {
      return res.status(400).json({ error: 'Rate limit requests must be a positive integer' })
    }

    // Validar模型LímiteCampo
    if (enableModelRestriction !== undefined && typeof enableModelRestriction !== 'boolean') {
      return res.status(400).json({ error: 'Enable model restriction must be a boolean' })
    }

    if (restrictedModels !== undefined && !Array.isArray(restrictedModels)) {
      return res.status(400).json({ error: 'Restricted models must be an array' })
    }

    // ValidarClienteLímiteCampo
    if (enableClientRestriction !== undefined && typeof enableClientRestriction !== 'boolean') {
      return res.status(400).json({ error: 'Enable client restriction must be a boolean' })
    }

    if (allowedClients !== undefined && !Array.isArray(allowedClients)) {
      return res.status(400).json({ error: 'Allowed clients must be an array' })
    }

    // Validar标签Campo
    if (tags !== undefined && !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' })
    }

    if (tags && tags.some((tag) => typeof tag !== 'string' || tag.trim().length === 0)) {
      return res.status(400).json({ error: 'All tags must be non-empty strings' })
    }

    if (
      totalCostLimit !== undefined &&
      totalCostLimit !== null &&
      totalCostLimit !== '' &&
      (Number.isNaN(Number(totalCostLimit)) || Number(totalCostLimit) < 0)
    ) {
      return res.status(400).json({ error: 'Total cost limit must be a non-negative number' })
    }

    // Validar激活相关Campo
    if (expirationMode && !['fixed', 'activation'].includes(expirationMode)) {
      return res
        .status(400)
        .json({ error: 'Expiration mode must be either "fixed" or "activation"' })
    }

    if (expirationMode === 'activation') {
      // Validar激活Tiempo单位
      if (!activationUnit || !['hours', 'days'].includes(activationUnit)) {
        return res.status(400).json({
          error: 'Activation unit must be either "hours" or "days" when using activation mode'
        })
      }

      // Validar激活Tiempo数Valor
      if (
        !activationDays ||
        !Number.isInteger(Number(activationDays)) ||
        Number(activationDays) < 1
      ) {
        const unitText = activationUnit === 'hours' ? 'hours' : 'days'
        return res.status(400).json({
          error: `Activation ${unitText} must be a positive integer when using activation mode`
        })
      }
      // 激活模式下不应该Establecer固定过期Tiempo
      if (expiresAt) {
        return res
          .status(400)
          .json({ error: 'Cannot set fixed expiration date when using activation mode' })
      }
    }

    // ValidarServicioPermisoCampo（SoportarArregloFormato）
    const permissionsError = validatePermissions(permissions)
    if (permissionsError) {
      return res.status(400).json({ error: permissionsError })
    }

    // ValidarServicio倍率
    const serviceRatesError = validateServiceRates(serviceRates)
    if (serviceRatesError) {
      return res.status(400).json({ error: serviceRatesError })
    }

    const newKey = await apiKeyService.generateApiKey({
      name,
      description,
      tokenLimit,
      expiresAt,
      claudeAccountId,
      claudeConsoleAccountId,
      geminiAccountId,
      openaiAccountId,
      bedrockAccountId,
      droidAccountId,
      permissions,
      concurrencyLimit,
      rateLimitWindow,
      rateLimitRequests,
      rateLimitCost,
      enableModelRestriction,
      restrictedModels,
      enableClientRestriction,
      allowedClients,
      dailyCostLimit,
      totalCostLimit,
      weeklyOpusCostLimit,
      tags,
      activationDays,
      activationUnit,
      expirationMode,
      icon,
      serviceRates
    })

    logger.success(`🔑 Admin created new API key: ${name}`)
    return res.json({ success: true, data: newKey })
  } catch (error) {
    logger.error('❌ Failed to create API key:', error)
    return res.status(500).json({ error: 'Failed to create API key', message: error.message })
  }
})

// 批量CrearAPI Keys
router.post('/api-keys/batch', authenticateAdmin, async (req, res) => {
  try {
    const {
      baseName,
      count,
      description,
      tokenLimit,
      expiresAt,
      claudeAccountId,
      claudeConsoleAccountId,
      geminiAccountId,
      openaiAccountId,
      bedrockAccountId,
      droidAccountId,
      permissions,
      concurrencyLimit,
      rateLimitWindow,
      rateLimitRequests,
      rateLimitCost,
      enableModelRestriction,
      restrictedModels,
      enableClientRestriction,
      allowedClients,
      dailyCostLimit,
      totalCostLimit,
      weeklyOpusCostLimit,
      tags,
      activationDays,
      activationUnit,
      expirationMode,
      icon,
      serviceRates
    } = req.body

    // 输入Validar
    if (!baseName || typeof baseName !== 'string' || baseName.trim().length === 0) {
      return res.status(400).json({ error: 'Base name is required and must be a non-empty string' })
    }

    if (!count || !Number.isInteger(count) || count < 2 || count > 500) {
      return res.status(400).json({ error: 'Count must be an integer between 2 and 500' })
    }

    if (baseName.length > 90) {
      return res
        .status(400)
        .json({ error: 'Base name must be less than 90 characters to allow for numbering' })
    }

    // ValidarServicioPermisoCampo（SoportarArregloFormato）
    const batchPermissionsError = validatePermissions(permissions)
    if (batchPermissionsError) {
      return res.status(400).json({ error: batchPermissionsError })
    }

    // ValidarServicio倍率
    const batchServiceRatesError = validateServiceRates(serviceRates)
    if (batchServiceRatesError) {
      return res.status(400).json({ error: batchServiceRatesError })
    }

    // Generar批量API Keys
    const createdKeys = []
    const errors = []

    for (let i = 1; i <= count; i++) {
      try {
        const name = `${baseName}_${i}`
        const newKey = await apiKeyService.generateApiKey({
          name,
          description,
          tokenLimit,
          expiresAt,
          claudeAccountId,
          claudeConsoleAccountId,
          geminiAccountId,
          openaiAccountId,
          bedrockAccountId,
          droidAccountId,
          permissions,
          concurrencyLimit,
          rateLimitWindow,
          rateLimitRequests,
          rateLimitCost,
          enableModelRestriction,
          restrictedModels,
          enableClientRestriction,
          allowedClients,
          dailyCostLimit,
          totalCostLimit,
          weeklyOpusCostLimit,
          tags,
          activationDays,
          activationUnit,
          expirationMode,
          icon,
          serviceRates
        })

        // 保留原始 API Key 供Retornar
        createdKeys.push({
          ...newKey,
          apiKey: newKey.apiKey
        })
      } catch (error) {
        errors.push({
          index: i,
          name: `${baseName}_${i}`,
          error: error.message
        })
      }
    }

    // 如果有部分Falló，Retornar部分Éxito的结果
    if (errors.length > 0 && createdKeys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create any API keys',
        errors
      })
    }

    // RetornarCrear的keys（Incluir完整的apiKey）
    return res.json({
      success: true,
      data: createdKeys,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        requested: count,
        created: createdKeys.length,
        failed: errors.length
      }
    })
  } catch (error) {
    logger.error('Failed to batch create API keys:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to batch create API keys',
      message: error.message
    })
  }
})

// 批量编辑API Keys
router.put('/api-keys/batch', authenticateAdmin, async (req, res) => {
  try {
    const { keyIds, updates } = req.body

    if (!keyIds || !Array.isArray(keyIds) || keyIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'keyIds must be a non-empty array'
      })
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'updates must be an object'
      })
    }

    // ValidarServicioPermisoCampo（SoportarArregloFormato）
    if (updates.permissions !== undefined) {
      const updatePermissionsError = validatePermissions(updates.permissions)
      if (updatePermissionsError) {
        return res.status(400).json({ error: updatePermissionsError })
      }
    }

    // ValidarServicio倍率
    if (updates.serviceRates !== undefined) {
      const updateServiceRatesError = validateServiceRates(updates.serviceRates)
      if (updateServiceRatesError) {
        return res.status(400).json({ error: updateServiceRatesError })
      }
    }

    logger.info(
      `🔄 Admin batch editing ${keyIds.length} API keys with updates: ${JSON.stringify(updates)}`
    )
    logger.info(`🔍 Debug: keyIds received: ${JSON.stringify(keyIds)}`)

    const results = {
      successCount: 0,
      failedCount: 0,
      errors: []
    }

    // Procesar每个API Key
    for (const keyId of keyIds) {
      try {
        // Obtener当前API KeyInformación
        const currentKey = await redis.getApiKey(keyId)
        if (!currentKey || Object.keys(currentKey).length === 0) {
          results.failedCount++
          results.errors.push(`API key ${keyId} not found`)
          continue
        }

        // Construir最终ActualizarDatos
        const finalUpdates = {}

        // Procesar普通Campo
        if (updates.name) {
          finalUpdates.name = updates.name
        }
        if (updates.tokenLimit !== undefined) {
          finalUpdates.tokenLimit = updates.tokenLimit
        }
        if (updates.rateLimitCost !== undefined) {
          finalUpdates.rateLimitCost = updates.rateLimitCost
        }
        if (updates.concurrencyLimit !== undefined) {
          finalUpdates.concurrencyLimit = updates.concurrencyLimit
        }
        if (updates.rateLimitWindow !== undefined) {
          finalUpdates.rateLimitWindow = updates.rateLimitWindow
        }
        if (updates.rateLimitRequests !== undefined) {
          finalUpdates.rateLimitRequests = updates.rateLimitRequests
        }
        if (updates.dailyCostLimit !== undefined) {
          finalUpdates.dailyCostLimit = updates.dailyCostLimit
        }
        if (updates.totalCostLimit !== undefined) {
          finalUpdates.totalCostLimit = updates.totalCostLimit
        }
        if (updates.weeklyOpusCostLimit !== undefined) {
          finalUpdates.weeklyOpusCostLimit = updates.weeklyOpusCostLimit
        }
        if (updates.permissions !== undefined) {
          finalUpdates.permissions = updates.permissions
        }
        if (updates.isActive !== undefined) {
          finalUpdates.isActive = updates.isActive
        }
        if (updates.monthlyLimit !== undefined) {
          finalUpdates.monthlyLimit = updates.monthlyLimit
        }
        if (updates.priority !== undefined) {
          finalUpdates.priority = updates.priority
        }
        if (updates.enabled !== undefined) {
          finalUpdates.enabled = updates.enabled
        }
        if (updates.serviceRates !== undefined) {
          finalUpdates.serviceRates = updates.serviceRates
        }

        // ProcesarCuenta绑定
        if (updates.claudeAccountId !== undefined) {
          finalUpdates.claudeAccountId = updates.claudeAccountId
        }
        if (updates.claudeConsoleAccountId !== undefined) {
          finalUpdates.claudeConsoleAccountId = updates.claudeConsoleAccountId
        }
        if (updates.geminiAccountId !== undefined) {
          finalUpdates.geminiAccountId = updates.geminiAccountId
        }
        if (updates.openaiAccountId !== undefined) {
          finalUpdates.openaiAccountId = updates.openaiAccountId
        }
        if (updates.bedrockAccountId !== undefined) {
          finalUpdates.bedrockAccountId = updates.bedrockAccountId
        }
        if (updates.droidAccountId !== undefined) {
          finalUpdates.droidAccountId = updates.droidAccountId || ''
        }

        // Procesar标签Operación
        if (updates.tags !== undefined) {
          if (updates.tagOperation) {
            const currentTags = currentKey.tags ? JSON.parse(currentKey.tags) : []
            const operationTags = updates.tags

            switch (updates.tagOperation) {
              case 'replace': {
                finalUpdates.tags = operationTags
                break
              }
              case 'add': {
                const newTags = [...currentTags]
                operationTags.forEach((tag) => {
                  if (!newTags.includes(tag)) {
                    newTags.push(tag)
                  }
                })
                finalUpdates.tags = newTags
                break
              }
              case 'remove': {
                finalUpdates.tags = currentTags.filter((tag) => !operationTags.includes(tag))
                break
              }
            }
          } else {
            // 如果没有指定OperaciónTipo，Predeterminado为Reemplazo
            finalUpdates.tags = updates.tags
          }
        }

        // EjecutarActualizar
        await apiKeyService.updateApiKey(keyId, finalUpdates)
        results.successCount++
        logger.success(`Batch edit: API key ${keyId} updated successfully`)
      } catch (error) {
        results.failedCount++
        results.errors.push(`Failed to update key ${keyId}: ${error.message}`)
        logger.error(`❌ Batch edit failed for key ${keyId}:`, error)
      }
    }

    // Registro批量编辑结果
    if (results.successCount > 0) {
      logger.success(
        `🎉 Batch edit completed: ${results.successCount} successful, ${results.failedCount} failed`
      )
    } else {
      logger.warn(
        `⚠️ Batch edit completed with no successful updates: ${results.failedCount} failed`
      )
    }

    return res.json({
      success: true,
      message: `Edición por lotes completada`,
      data: results
    })
  } catch (error) {
    logger.error('❌ Failed to batch edit API keys:', error)
    return res.status(500).json({
      error: 'Batch edit failed',
      message: error.message
    })
  }
})

// ActualizarAPI Key
router.put('/api-keys/:keyId', authenticateAdmin, async (req, res) => {
  try {
    const { keyId } = req.params
    const {
      name, // 添加NombreCampo
      tokenLimit,
      concurrencyLimit,
      rateLimitWindow,
      rateLimitRequests,
      rateLimitCost,
      isActive,
      claudeAccountId,
      claudeConsoleAccountId,
      geminiAccountId,
      openaiAccountId,
      bedrockAccountId,
      droidAccountId,
      permissions,
      enableModelRestriction,
      restrictedModels,
      enableClientRestriction,
      allowedClients,
      expiresAt,
      dailyCostLimit,
      totalCostLimit,
      weeklyOpusCostLimit,
      tags,
      ownerId, // Nueva característica：所有者IDCampo
      serviceRates // API Key 级别Servicio倍率
    } = req.body

    // 只允许Actualizar指定Campo
    const updates = {}

    // ProcesarNombreCampo
    if (name !== undefined && name !== null && name !== '') {
      const trimmedName = name.toString().trim()
      if (trimmedName.length === 0) {
        return res.status(400).json({ error: 'API Key name cannot be empty' })
      }
      if (trimmedName.length > 100) {
        return res.status(400).json({ error: 'API Key name must be less than 100 characters' })
      }
      updates.name = trimmedName
    }

    if (tokenLimit !== undefined && tokenLimit !== null && tokenLimit !== '') {
      if (!Number.isInteger(Number(tokenLimit)) || Number(tokenLimit) < 0) {
        return res.status(400).json({ error: 'Token limit must be a non-negative integer' })
      }
      updates.tokenLimit = Number(tokenLimit)
    }

    if (concurrencyLimit !== undefined && concurrencyLimit !== null && concurrencyLimit !== '') {
      if (!Number.isInteger(Number(concurrencyLimit)) || Number(concurrencyLimit) < 0) {
        return res.status(400).json({ error: 'Concurrency limit must be a non-negative integer' })
      }
      updates.concurrencyLimit = Number(concurrencyLimit)
    }

    if (rateLimitWindow !== undefined && rateLimitWindow !== null && rateLimitWindow !== '') {
      if (!Number.isInteger(Number(rateLimitWindow)) || Number(rateLimitWindow) < 0) {
        return res
          .status(400)
          .json({ error: 'Rate limit window must be a non-negative integer (minutes)' })
      }
      updates.rateLimitWindow = Number(rateLimitWindow)
    }

    if (rateLimitRequests !== undefined && rateLimitRequests !== null && rateLimitRequests !== '') {
      if (!Number.isInteger(Number(rateLimitRequests)) || Number(rateLimitRequests) < 0) {
        return res.status(400).json({ error: 'Rate limit requests must be a non-negative integer' })
      }
      updates.rateLimitRequests = Number(rateLimitRequests)
    }

    if (rateLimitCost !== undefined && rateLimitCost !== null && rateLimitCost !== '') {
      const cost = Number(rateLimitCost)
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({ error: 'Rate limit cost must be a non-negative number' })
      }
      updates.rateLimitCost = cost
    }

    if (claudeAccountId !== undefined) {
      // 空CadenaTabla示解绑，null或空Cadena都Establecer为空Cadena
      updates.claudeAccountId = claudeAccountId || ''
    }

    if (claudeConsoleAccountId !== undefined) {
      // 空CadenaTabla示解绑，null或空Cadena都Establecer为空Cadena
      updates.claudeConsoleAccountId = claudeConsoleAccountId || ''
    }

    if (geminiAccountId !== undefined) {
      // 空CadenaTabla示解绑，null或空Cadena都Establecer为空Cadena
      updates.geminiAccountId = geminiAccountId || ''
    }

    if (openaiAccountId !== undefined) {
      // 空CadenaTabla示解绑，null或空Cadena都Establecer为空Cadena
      updates.openaiAccountId = openaiAccountId || ''
    }

    if (bedrockAccountId !== undefined) {
      // 空CadenaTabla示解绑，null或空Cadena都Establecer为空Cadena
      updates.bedrockAccountId = bedrockAccountId || ''
    }

    if (droidAccountId !== undefined) {
      // 空CadenaTabla示解绑，null或空Cadena都Establecer为空Cadena
      updates.droidAccountId = droidAccountId || ''
    }

    if (permissions !== undefined) {
      // ValidarServicioPermisoCampo（SoportarArregloFormato）
      const singlePermissionsError = validatePermissions(permissions)
      if (singlePermissionsError) {
        return res.status(400).json({ error: singlePermissionsError })
      }
      updates.permissions = permissions
    }

    // Procesar模型LímiteCampo
    if (enableModelRestriction !== undefined) {
      if (typeof enableModelRestriction !== 'boolean') {
        return res.status(400).json({ error: 'Enable model restriction must be a boolean' })
      }
      updates.enableModelRestriction = enableModelRestriction
    }

    if (restrictedModels !== undefined) {
      if (!Array.isArray(restrictedModels)) {
        return res.status(400).json({ error: 'Restricted models must be an array' })
      }
      updates.restrictedModels = restrictedModels
    }

    // ProcesarClienteLímiteCampo
    if (enableClientRestriction !== undefined) {
      if (typeof enableClientRestriction !== 'boolean') {
        return res.status(400).json({ error: 'Enable client restriction must be a boolean' })
      }
      updates.enableClientRestriction = enableClientRestriction
    }

    if (allowedClients !== undefined) {
      if (!Array.isArray(allowedClients)) {
        return res.status(400).json({ error: 'Allowed clients must be an array' })
      }
      updates.allowedClients = allowedClients
    }

    // Procesar过期TiempoCampo
    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        // null Tabla示永不过期
        updates.expiresAt = null
        updates.isActive = true
      } else {
        // ValidarFechaFormato
        const expireDate = new Date(expiresAt)
        if (isNaN(expireDate.getTime())) {
          return res.status(400).json({ error: 'Invalid expiration date format' })
        }
        updates.expiresAt = expiresAt
        updates.isActive = expireDate > new Date() // 如果过期Tiempo在当前Tiempo之后，则Establecer为激活状态
      }
    }

    // Procesar每日费用Límite
    if (dailyCostLimit !== undefined && dailyCostLimit !== null && dailyCostLimit !== '') {
      const costLimit = Number(dailyCostLimit)
      if (isNaN(costLimit) || costLimit < 0) {
        return res.status(400).json({ error: 'Daily cost limit must be a non-negative number' })
      }
      updates.dailyCostLimit = costLimit
    }

    if (totalCostLimit !== undefined && totalCostLimit !== null && totalCostLimit !== '') {
      const costLimit = Number(totalCostLimit)
      if (isNaN(costLimit) || costLimit < 0) {
        return res.status(400).json({ error: 'Total cost limit must be a non-negative number' })
      }
      updates.totalCostLimit = costLimit
    }

    // Procesar Opus 周费用Límite
    if (
      weeklyOpusCostLimit !== undefined &&
      weeklyOpusCostLimit !== null &&
      weeklyOpusCostLimit !== ''
    ) {
      const costLimit = Number(weeklyOpusCostLimit)
      // 明确Validar非负数（0 Tabla示Deshabilitar，负数无意义）
      if (isNaN(costLimit) || costLimit < 0) {
        return res
          .status(400)
          .json({ error: 'Weekly Opus cost limit must be a non-negative number' })
      }
      updates.weeklyOpusCostLimit = costLimit
    }

    // Procesar标签
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'Tags must be an array' })
      }
      if (tags.some((tag) => typeof tag !== 'string' || tag.trim().length === 0)) {
        return res.status(400).json({ error: 'All tags must be non-empty strings' })
      }
      updates.tags = tags
    }

    // ProcesarServicio倍率
    if (serviceRates !== undefined) {
      const singleServiceRatesError = validateServiceRates(serviceRates)
      if (singleServiceRatesError) {
        return res.status(400).json({ error: singleServiceRatesError })
      }
      updates.serviceRates = serviceRates
    }

    // Procesar活跃/Deshabilitar状态状态, 放在过期Procesar后，以确保后续增加Deshabilitarkey功能
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' })
      }
      updates.isActive = isActive
    }

    // Procesar所有者变更
    if (ownerId !== undefined) {
      const userService = require('../../services/userService')

      if (ownerId === 'admin') {
        // 分配给Admin
        updates.userId = ''
        updates.userUsername = ''
        updates.createdBy = 'admin'
      } else if (ownerId) {
        // 分配给Usuario
        try {
          const user = await userService.getUserById(ownerId, false)
          if (!user) {
            return res.status(400).json({ error: 'Invalid owner: User not found' })
          }
          if (!user.isActive) {
            return res.status(400).json({ error: 'Cannot assign to inactive user' })
          }

          // Establecer新的所有者Información
          updates.userId = ownerId
          updates.userUsername = user.username
          updates.createdBy = user.username

          // 管理员重新分配时，不VerificarUsuario的API Key数量Límite
          logger.info(`🔄 Admin reassigning API key ${keyId} to user ${user.username}`)
        } catch (error) {
          logger.error('Error fetching user for owner reassignment:', error)
          return res.status(400).json({ error: 'Invalid owner ID' })
        }
      } else {
        // 清空所有者（分配给Admin）
        updates.userId = ''
        updates.userUsername = ''
        updates.createdBy = 'admin'
      }
    }

    await apiKeyService.updateApiKey(keyId, updates)

    logger.success(`📝 Admin updated API key: ${keyId}`)
    return res.json({ success: true, message: 'API key updated successfully' })
  } catch (error) {
    logger.error('❌ Failed to update API key:', error)
    return res.status(500).json({ error: 'Failed to update API key', message: error.message })
  }
})

// 修改API Key过期Tiempo（包括手动激活功能）
router.patch('/api-keys/:keyId/expiration', authenticateAdmin, async (req, res) => {
  try {
    const { keyId } = req.params
    const { expiresAt, activateNow } = req.body

    // Obtener当前API KeyInformación
    const keyData = await redis.getApiKey(keyId)
    if (!keyData || Object.keys(keyData).length === 0) {
      return res.status(404).json({ error: 'API key not found' })
    }

    const updates = {}

    // 如果是激活Operación（用于未激活的key）
    if (activateNow === true) {
      if (keyData.expirationMode === 'activation' && keyData.isActivated !== 'true') {
        const now = new Date()
        const activationDays = parseInt(keyData.activationDays || 30)
        const newExpiresAt = new Date(now.getTime() + activationDays * 24 * 60 * 60 * 1000)

        updates.isActivated = 'true'
        updates.activatedAt = now.toISOString()
        updates.expiresAt = newExpiresAt.toISOString()

        logger.success(
          `🔓 API key manually activated by admin: ${keyId} (${
            keyData.name
          }), expires at ${newExpiresAt.toISOString()}`
        )
      } else {
        return res.status(400).json({
          error: 'Cannot activate',
          message: 'Key is either already activated or not in activation mode'
        })
      }
    }

    // 如果提供了新的过期Tiempo（但不是激活Operación）
    if (expiresAt !== undefined && activateNow !== true) {
      // Validar过期TiempoFormato
      if (expiresAt && isNaN(Date.parse(expiresAt))) {
        return res.status(400).json({ error: 'Invalid expiration date format' })
      }

      // 如果Establecer了过期Tiempo，确保key是激活状态
      if (expiresAt) {
        updates.expiresAt = new Date(expiresAt).toISOString()
        // 如果之前是未激活状态，现在激活它
        if (keyData.isActivated !== 'true') {
          updates.isActivated = 'true'
          updates.activatedAt = new Date().toISOString()
        }
      } else {
        // 清除过期Tiempo（永不过期）
        updates.expiresAt = ''
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' })
    }

    // ActualizarAPI Key
    await apiKeyService.updateApiKey(keyId, updates)

    logger.success(`📝 Updated API key expiration: ${keyId} (${keyData.name})`)
    return res.json({
      success: true,
      message: 'API key expiration updated successfully',
      updates
    })
  } catch (error) {
    logger.error('❌ Failed to update API key expiration:', error)
    return res.status(500).json({
      error: 'Failed to update API key expiration',
      message: error.message
    })
  }
})

// 批量EliminarAPI Keys（必须在 :keyId Ruta之前定义）
router.delete('/api-keys/batch', authenticateAdmin, async (req, res) => {
  try {
    const { keyIds } = req.body

    // DepurarInformación
    logger.info(`🐛 Batch delete request body: ${JSON.stringify(req.body)}`)
    logger.info(`🐛 keyIds type: ${typeof keyIds}, value: ${JSON.stringify(keyIds)}`)

    // ParámetroValidar
    if (!keyIds || !Array.isArray(keyIds) || keyIds.length === 0) {
      logger.warn(
        `🚨 Invalid keyIds: ${JSON.stringify({
          keyIds,
          type: typeof keyIds,
          isArray: Array.isArray(keyIds)
        })}`
      )
      return res.status(400).json({
        error: 'Invalid request',
        message: 'keyIds 必须是一个非空Arreglo'
      })
    }

    if (keyIds.length > 100) {
      return res.status(400).json({
        error: 'Too many keys',
        message: 'Solo se pueden eliminar hasta 100 claves API a la vez'
      })
    }

    // ValidarkeyIdsFormato
    const invalidKeys = keyIds.filter((id) => !id || typeof id !== 'string')
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        error: 'Invalid key IDs',
        message: 'Contiene IDs de claves API no válidos'
      })
    }

    logger.info(
      `🗑️ Admin attempting batch delete of ${keyIds.length} API keys: ${JSON.stringify(keyIds)}`
    )

    const results = {
      successCount: 0,
      failedCount: 0,
      errors: []
    }

    // 逐个Eliminar，RegistroÉxito和Falló情况
    for (const keyId of keyIds) {
      try {
        // VerificarAPI Key是否存在
        const apiKey = await redis.getApiKey(keyId)
        if (!apiKey || Object.keys(apiKey).length === 0) {
          results.failedCount++
          results.errors.push({ keyId, error: 'API Key 不存在' })
          continue
        }

        // EjecutarEliminar
        await apiKeyService.deleteApiKey(keyId)
        results.successCount++

        logger.success(`Batch delete: API key ${keyId} deleted successfully`)
      } catch (error) {
        results.failedCount++
        results.errors.push({
          keyId,
          error: error.message || 'EliminarFalló'
        })

        logger.error(`❌ Batch delete failed for key ${keyId}:`, error)
      }
    }

    // Registro批量Eliminar结果
    if (results.successCount > 0) {
      logger.success(
        `🎉 Batch delete completed: ${results.successCount} successful, ${results.failedCount} failed`
      )
    } else {
      logger.warn(
        `⚠️ Batch delete completed with no successful deletions: ${results.failedCount} failed`
      )
    }

    return res.json({
      success: true,
      message: `Eliminación por lotes completada`,
      data: results
    })
  } catch (error) {
    logger.error('❌ Failed to batch delete API keys:', error)
    return res.status(500).json({
      error: 'Batch delete failed',
      message: error.message
    })
  }
})

// Eliminar单个API Key（必须在批量EliminarRuta之后定义）
router.delete('/api-keys/:keyId', authenticateAdmin, async (req, res) => {
  try {
    const { keyId } = req.params

    await apiKeyService.deleteApiKey(keyId, req.admin.username, 'admin')

    logger.success(`🗑️ Admin deleted API key: ${keyId}`)
    return res.json({ success: true, message: 'API key deleted successfully' })
  } catch (error) {
    logger.error('❌ Failed to delete API key:', error)
    return res.status(500).json({ error: 'Failed to delete API key', message: error.message })
  }
})

// 📋 Obtener已Eliminar的API Keys
router.get('/api-keys/deleted', authenticateAdmin, async (req, res) => {
  try {
    const deletedApiKeys = await apiKeyService.getAllApiKeysFast(true) // Include deleted
    const onlyDeleted = deletedApiKeys.filter((key) => key.isDeleted === true)

    // Add additional metadata for deleted keys
    const enrichedKeys = onlyDeleted.map((key) => ({
      ...key,
      isDeleted: key.isDeleted === true,
      deletedAt: key.deletedAt,
      deletedBy: key.deletedBy,
      deletedByType: key.deletedByType,
      canRestore: true // 已Eliminar的API Key可以Restauración
    }))

    logger.success(`📋 Admin retrieved ${enrichedKeys.length} deleted API keys`)
    return res.json({ success: true, apiKeys: enrichedKeys, total: enrichedKeys.length })
  } catch (error) {
    logger.error('❌ Failed to get deleted API keys:', error)
    return res
      .status(500)
      .json({ error: 'Failed to retrieve deleted API keys', message: error.message })
  }
})

// 🔄 Restauración已Eliminar的API Key
router.post('/api-keys/:keyId/restore', authenticateAdmin, async (req, res) => {
  try {
    const { keyId } = req.params
    const adminUsername = req.session?.admin?.username || 'unknown'

    // 调用Servicio层的RestauraciónMétodo
    const result = await apiKeyService.restoreApiKey(keyId, adminUsername, 'admin')

    if (result.success) {
      logger.success(`Admin ${adminUsername} restored API key: ${keyId}`)
      return res.json({
        success: true,
        message: 'Clave API recuperada con éxito',
        apiKey: result.apiKey
      })
    } else {
      return res.status(400).json({
        success: false,
        error: 'Failed to restore API key'
      })
    }
  } catch (error) {
    logger.error('❌ Failed to restore API key:', error)

    // 根据ErrorTipoRetornar适当的Respuesta
    if (error.message === 'API key not found') {
      return res.status(404).json({
        success: false,
        error: 'API Key 不存在'
      })
    } else if (error.message === 'API key is not deleted') {
      return res.status(400).json({
        success: false,
        error: '该 API Key 未被Eliminar，无需Restauración'
      })
    }

    return res.status(500).json({
      success: false,
      error: 'Restauración API Key Falló',
      message: error.message
    })
  }
})

// 🗑️ 彻底EliminarAPI Key（物理Eliminar）
router.delete('/api-keys/:keyId/permanent', authenticateAdmin, async (req, res) => {
  try {
    const { keyId } = req.params
    const adminUsername = req.session?.admin?.username || 'unknown'

    // 调用Servicio层的彻底EliminarMétodo
    const result = await apiKeyService.permanentDeleteApiKey(keyId)

    if (result.success) {
      logger.success(`🗑️ Admin ${adminUsername} permanently deleted API key: ${keyId}`)
      return res.json({
        success: true,
        message: 'Clave API eliminada permanentemente'
      })
    }
  } catch (error) {
    logger.error('❌ Failed to permanently delete API key:', error)

    if (error.message === 'API key not found') {
      return res.status(404).json({
        success: false,
        error: 'API Key 不存在'
      })
    } else if (error.message === '只能彻底Eliminar已经Eliminar的API Key') {
      return res.status(400).json({
        success: false,
        error: '只能彻底Eliminar已经Eliminar的API Key'
      })
    }

    return res.status(500).json({
      success: false,
      error: '彻底Eliminar API Key Falló',
      message: error.message
    })
  }
})

// 🧹 清空所有已Eliminar的API Keys
router.delete('/api-keys/deleted/clear-all', authenticateAdmin, async (req, res) => {
  try {
    const adminUsername = req.session?.admin?.username || 'unknown'

    // 调用Servicio层的清空Método
    const result = await apiKeyService.clearAllDeletedApiKeys()

    logger.success(
      `🧹 Admin ${adminUsername} cleared deleted API keys: ${result.successCount}/${result.total}`
    )

    return res.json({
      success: true,
      message: `Se han vaciado con éxito ${result.successCount} claves API eliminadas`,
      details: {
        total: result.total,
        successCount: result.successCount,
        failedCount: result.failedCount,
        errors: result.errors
      }
    })
  } catch (error) {
    logger.error('❌ Failed to clear all deleted API keys:', error)
    return res.status(500).json({
      success: false,
      error: '清空已Eliminar的 API Keys Falló',
      message: error.message
    })
  }
})

module.exports = router
