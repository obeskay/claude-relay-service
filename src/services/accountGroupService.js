const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')
const redis = require('../models/redis')

class AccountGroupService {
  constructor() {
    this.GROUPS_KEY = 'account_groups'
    this.GROUP_PREFIX = 'account_group:'
    this.GROUP_MEMBERS_PREFIX = 'account_group_members:'
    this.REVERSE_INDEX_PREFIX = 'account_groups_reverse:'
    this.REVERSE_INDEX_MIGRATED_KEY = 'account_groups_reverse:migrated'
  }

  /**
   * 确保反向Índice存在（启动时自动调用）
   * Verificar是否已Migración，如果没有则自动回填
   */
  async ensureReverseIndexes() {
    try {
      const client = redis.getClientSafe()
      if (!client) {
        return
      }

      // Verificar是否已Migración
      const migrated = await client.get(this.REVERSE_INDEX_MIGRATED_KEY)
      if (migrated === 'true') {
        logger.debug('📁 CuentaAgrupar反向Índice已存在，跳过回填')
        return
      }

      logger.info('📁 Iniciando回填CuentaAgrupar反向Índice...')

      const allGroupIds = await client.smembers(this.GROUPS_KEY)
      if (allGroupIds.length === 0) {
        await client.set(this.REVERSE_INDEX_MIGRATED_KEY, 'true')
        return
      }

      let totalOperations = 0

      for (const groupId of allGroupIds) {
        const group = await client.hgetall(`${this.GROUP_PREFIX}${groupId}`)
        if (!group || !group.platform) {
          continue
        }

        const members = await client.smembers(`${this.GROUP_MEMBERS_PREFIX}${groupId}`)
        if (members.length === 0) {
          continue
        }

        const pipeline = client.pipeline()
        for (const accountId of members) {
          pipeline.sadd(`${this.REVERSE_INDEX_PREFIX}${group.platform}:${accountId}`, groupId)
        }
        await pipeline.exec()
        totalOperations += members.length
      }

      await client.set(this.REVERSE_INDEX_MIGRATED_KEY, 'true')
      logger.success(`📁 CuentaAgrupar反向Índice回填Completado，共 ${totalOperations} 条`)
    } catch (error) {
      logger.error('❌ CuentaAgrupar反向Índice回填Falló:', error)
    }
  }

  /**
   * CrearCuentaAgrupar
   * @param {Object} groupData - AgruparDatos
   * @param {string} groupData.name - AgruparNombre
   * @param {string} groupData.platform - 平台Tipo (claude/gemini/openai)
   * @param {string} groupData.description - Agrupar描述
   * @returns {Object} Crear的Agrupar
   */
  async createGroup(groupData) {
    try {
      const { name, platform, description = '' } = groupData

      // Validar必填Campo
      if (!name || !platform) {
        throw new Error('Group name and platform type are required')
      }

      // Validar平台Tipo
      if (!['claude', 'gemini', 'openai', 'droid'].includes(platform)) {
        throw new Error('Platform type must be claude, gemini, openai, or droid')
      }

      const client = redis.getClientSafe()
      const groupId = uuidv4()
      const now = new Date().toISOString()

      const group = {
        id: groupId,
        name,
        platform,
        description,
        createdAt: now,
        updatedAt: now
      }

      // 保存AgruparDatos
      await client.hmset(`${this.GROUP_PREFIX}${groupId}`, group)

      // 添加到Agrupar集合
      await client.sadd(this.GROUPS_KEY, groupId)

      logger.success(`✅ Successfully created account group: ${name} (${platform})`)

      return group
    } catch (error) {
      logger.error('❌ Failed to create account group:', error)
      throw error
    }
  }

  /**
   * ActualizarAgruparInformación
   * @param {string} groupId - AgruparID
   * @param {Object} updates - Actualizar的Campo
   * @returns {Object} Actualizar后的Agrupar
   */
  async updateGroup(groupId, updates) {
    try {
      const client = redis.getClientSafe()
      const groupKey = `${this.GROUP_PREFIX}${groupId}`

      // VerificarAgrupar是否存在
      const exists = await client.exists(groupKey)
      if (!exists) {
        throw new Error('Group does not exist')
      }

      // Obtener现有AgruparDatos
      const existingGroup = await client.hgetall(groupKey)

      // 不允许修改平台Tipo
      if (updates.platform && updates.platform !== existingGroup.platform) {
        throw new Error('Cannot modify group platform type')
      }

      // 准备ActualizarDatos
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      }

      // Eliminación不允许修改的Campo
      delete updateData.id
      delete updateData.platform
      delete updateData.createdAt

      // ActualizarAgrupar
      await client.hmset(groupKey, updateData)

      // RetornarActualizar后的完整Datos
      const updatedGroup = await client.hgetall(groupKey)

      logger.success(`✅ Successfully updated account group: ${updatedGroup.name}`)

      return updatedGroup
    } catch (error) {
      logger.error('❌ Failed to update account group:', error)
      throw error
    }
  }

  /**
   * EliminarAgrupar
   * @param {string} groupId - AgruparID
   */
  async deleteGroup(groupId) {
    try {
      const client = redis.getClientSafe()

      // VerificarAgrupar是否存在
      const group = await this.getGroup(groupId)
      if (!group) {
        throw new Error('Group does not exist')
      }

      // VerificarAgrupar是否为空
      const members = await this.getGroupMembers(groupId)
      if (members.length > 0) {
        throw new Error('Group still has accounts, cannot delete')
      }

      // Verificar是否有API Key绑定此Agrupar
      const boundApiKeys = await this.getApiKeysUsingGroup(groupId)
      if (boundApiKeys.length > 0) {
        throw new Error('API keys are still using this group, cannot delete')
      }

      // EliminarAgruparDatos
      await client.del(`${this.GROUP_PREFIX}${groupId}`)
      await client.del(`${this.GROUP_MEMBERS_PREFIX}${groupId}`)

      // 从Agrupar集合中Eliminación
      await client.srem(this.GROUPS_KEY, groupId)

      logger.success(`✅ Successfully deleted account group: ${group.name}`)
    } catch (error) {
      logger.error('❌ Failed to delete account group:', error)
      throw error
    }
  }

  /**
   * ObtenerAgrupar详情
   * @param {string} groupId - AgruparID
   * @returns {Object|null} AgruparInformación
   */
  async getGroup(groupId) {
    try {
      const client = redis.getClientSafe()
      const groupData = await client.hgetall(`${this.GROUP_PREFIX}${groupId}`)

      if (!groupData || Object.keys(groupData).length === 0) {
        return null
      }

      // Obtener成员数量
      const memberCount = await client.scard(`${this.GROUP_MEMBERS_PREFIX}${groupId}`)

      return {
        ...groupData,
        memberCount: memberCount || 0
      }
    } catch (error) {
      logger.error('❌ ObtenerAgrupar详情Falló:', error)
      throw error
    }
  }

  /**
   * Obtener所有Agrupar
   * @param {string} platform - 平台筛选 (Opcional)
   * @returns {Array} AgruparColumnaTabla
   */
  async getAllGroups(platform = null) {
    try {
      const client = redis.getClientSafe()
      const groupIds = await client.smembers(this.GROUPS_KEY)

      const groups = []
      for (const groupId of groupIds) {
        const group = await this.getGroup(groupId)
        if (group) {
          // 如果指定了平台，进Fila筛选
          if (!platform || group.platform === platform) {
            groups.push(group)
          }
        }
      }

      // 按CrearTiempo倒序Ordenar
      groups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      return groups
    } catch (error) {
      logger.error('❌ ObtenerAgruparColumnaTablaFalló:', error)
      throw error
    }
  }

  /**
   * 添加Cuenta到Agrupar
   * @param {string} accountId - CuentaID
   * @param {string} groupId - AgruparID
   * @param {string} accountPlatform - Cuenta平台
   */
  async addAccountToGroup(accountId, groupId, accountPlatform) {
    try {
      const client = redis.getClientSafe()

      // ObtenerAgruparInformación
      const group = await this.getGroup(groupId)
      if (!group) {
        throw new Error('Group does not exist')
      }

      // Validar平台一致性 (Claude和Claude Console视为同一平台)
      const normalizedAccountPlatform =
        accountPlatform === 'claude-console' ? 'claude' : accountPlatform
      if (normalizedAccountPlatform !== group.platform) {
        throw new Error('Account platform does not match group platform')
      }

      // 添加到Agrupar成员集合
      await client.sadd(`${this.GROUP_MEMBERS_PREFIX}${groupId}`, accountId)

      // 维护反向Índice
      await client.sadd(`account_groups_reverse:${group.platform}:${accountId}`, groupId)

      logger.success(`✅ Successfully added account to group: ${accountId} -> ${group.name}`)
    } catch (error) {
      logger.error('❌ Failed to add account to group:', error)
      throw error
    }
  }

  /**
   * 从AgruparEliminaciónCuenta
   * @param {string} accountId - CuentaID
   * @param {string} groupId - AgruparID
   * @param {string} platform - 平台（Opcional，如果不传则从AgruparObtener）
   */
  async removeAccountFromGroup(accountId, groupId, platform = null) {
    try {
      const client = redis.getClientSafe()

      // 从Agrupar成员集合中Eliminación
      await client.srem(`${this.GROUP_MEMBERS_PREFIX}${groupId}`, accountId)

      // 维护反向Índice
      let groupPlatform = platform
      if (!groupPlatform) {
        const group = await this.getGroup(groupId)
        groupPlatform = group?.platform
      }
      if (groupPlatform) {
        await client.srem(`account_groups_reverse:${groupPlatform}:${accountId}`, groupId)
      }

      logger.success(`✅ Successfully removed account from group: ${accountId}`)
    } catch (error) {
      logger.error('❌ Failed to remove account from group:', error)
      throw error
    }
  }

  /**
   * ObtenerAgrupar成员
   * @param {string} groupId - AgruparID
   * @returns {Array} 成员IDColumnaTabla
   */
  async getGroupMembers(groupId) {
    try {
      const client = redis.getClientSafe()
      const members = await client.smembers(`${this.GROUP_MEMBERS_PREFIX}${groupId}`)
      return members || []
    } catch (error) {
      logger.error('❌ ObtenerAgrupar成员Falló:', error)
      throw error
    }
  }

  /**
   * VerificarAgrupar是否为空
   * @param {string} groupId - AgruparID
   * @returns {boolean} 是否为空
   */
  async isGroupEmpty(groupId) {
    try {
      const members = await this.getGroupMembers(groupId)
      return members.length === 0
    } catch (error) {
      logger.error('❌ VerificarAgrupar是否为空Falló:', error)
      throw error
    }
  }

  /**
   * Obtener使用指定Agrupar的API KeyColumnaTabla
   * @param {string} groupId - AgruparID
   * @returns {Array} API KeyColumnaTabla
   */
  async getApiKeysUsingGroup(groupId) {
    try {
      const client = redis.getClientSafe()
      const groupKey = `group:${groupId}`

      // Obtener所有API Key
      const apiKeyIds = await client.smembers('api_keys')
      const boundApiKeys = []

      for (const keyId of apiKeyIds) {
        const keyData = await client.hgetall(`api_key:${keyId}`)
        if (
          keyData &&
          (keyData.claudeAccountId === groupKey ||
            keyData.geminiAccountId === groupKey ||
            keyData.openaiAccountId === groupKey ||
            keyData.droidAccountId === groupKey)
        ) {
          boundApiKeys.push({
            id: keyId,
            name: keyData.name
          })
        }
      }

      return boundApiKeys
    } catch (error) {
      logger.error('❌ Obtener使用Agrupar的API KeyFalló:', error)
      throw error
    }
  }

  /**
   * 根据CuentaIDObtener其所属的Agrupar（兼容性Método，Retornar单个Agrupar）
   * @param {string} accountId - CuentaID
   * @returns {Object|null} AgruparInformación
   */
  async getAccountGroup(accountId) {
    try {
      const client = redis.getClientSafe()
      const allGroupIds = await client.smembers(this.GROUPS_KEY)

      for (const groupId of allGroupIds) {
        const isMember = await client.sismember(`${this.GROUP_MEMBERS_PREFIX}${groupId}`, accountId)
        if (isMember) {
          return await this.getGroup(groupId)
        }
      }

      return null
    } catch (error) {
      logger.error('❌ ObtenerCuenta所属AgruparFalló:', error)
      throw error
    }
  }

  /**
   * 根据CuentaIDObtener其所属的所有Agrupar
   * @param {string} accountId - CuentaID
   * @returns {Array} AgruparInformaciónArreglo
   */
  async getAccountGroups(accountId) {
    try {
      const client = redis.getClientSafe()
      const allGroupIds = await client.smembers(this.GROUPS_KEY)
      const memberGroups = []

      for (const groupId of allGroupIds) {
        const isMember = await client.sismember(`${this.GROUP_MEMBERS_PREFIX}${groupId}`, accountId)
        if (isMember) {
          const group = await this.getGroup(groupId)
          if (group) {
            memberGroups.push(group)
          }
        }
      }

      // 按CrearTiempo倒序Ordenar
      memberGroups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      return memberGroups
    } catch (error) {
      logger.error('❌ ObtenerCuenta所属AgruparColumnaTablaFalló:', error)
      throw error
    }
  }

  /**
   * 批量EstablecerCuenta的Agrupar
   * @param {string} accountId - CuentaID
   * @param {Array} groupIds - AgruparIDArreglo
   * @param {string} accountPlatform - Cuenta平台
   */
  async setAccountGroups(accountId, groupIds, accountPlatform) {
    try {
      // 首先EliminaciónCuenta的所有现有Agrupar
      await this.removeAccountFromAllGroups(accountId)

      // 然后添加到新的Agrupar中
      for (const groupId of groupIds) {
        await this.addAccountToGroup(accountId, groupId, accountPlatform)
      }

      logger.success(
        `✅ Successfully batch set account groups: ${accountId} -> [${groupIds.join(', ')}]`
      )
    } catch (error) {
      logger.error('❌ Failed to batch set account groups:', error)
      throw error
    }
  }

  /**
   * 从所有Agrupar中EliminaciónCuenta
   * @param {string} accountId - CuentaID
   * @param {string} platform - 平台（Opcional，用于Limpiar反向Índice）
   */
  async removeAccountFromAllGroups(accountId, platform = null) {
    try {
      const client = redis.getClientSafe()
      const allGroupIds = await client.smembers(this.GROUPS_KEY)

      for (const groupId of allGroupIds) {
        await client.srem(`${this.GROUP_MEMBERS_PREFIX}${groupId}`, accountId)
      }

      // Limpiar反向Índice
      if (platform) {
        await client.del(`account_groups_reverse:${platform}:${accountId}`)
      } else {
        // 如果没有指定平台，Limpiar所有可能的平台
        const platforms = ['claude', 'gemini', 'openai', 'droid']
        const pipeline = client.pipeline()
        for (const p of platforms) {
          pipeline.del(`account_groups_reverse:${p}:${accountId}`)
        }
        await pipeline.exec()
      }

      logger.success(`✅ Successfully removed account from all groups: ${accountId}`)
    } catch (error) {
      logger.error('❌ Failed to remove account from all groups:', error)
      throw error
    }
  }

  /**
   * 批量Obtener多个Cuenta的AgruparInformación（RendimientoOptimizaciónVersión，使用反向Índice）
   * @param {Array<string>} accountIds - CuentaIDArreglo
   * @param {string} platform - 平台Tipo
   * @param {Object} options - 选项
   * @param {boolean} options.skipMemberCount - 是否跳过 memberCount（Predeterminado true）
   * @returns {Map<string, Array>} accountId -> AgruparInformaciónArreglo的映射
   */
  async batchGetAccountGroupsByIndex(accountIds, platform, options = {}) {
    const { skipMemberCount = true } = options

    if (!accountIds || accountIds.length === 0) {
      return new Map()
    }

    try {
      const client = redis.getClientSafe()

      // Pipeline 批量Obtener所有Cuenta的AgruparID
      const pipeline = client.pipeline()
      for (const accountId of accountIds) {
        pipeline.smembers(`${this.REVERSE_INDEX_PREFIX}${platform}:${accountId}`)
      }
      const groupIdResults = await pipeline.exec()

      // 收集所有需要的AgruparID
      const uniqueGroupIds = new Set()
      const accountGroupIdsMap = new Map()
      let hasAnyGroups = false
      accountIds.forEach((accountId, i) => {
        const [err, groupIds] = groupIdResults[i]
        const ids = err ? [] : groupIds || []
        accountGroupIdsMap.set(accountId, ids)
        ids.forEach((id) => {
          uniqueGroupIds.add(id)
          hasAnyGroups = true
        })
      })

      // 如果反向Índice全空，Retirada到原Método（兼容未Migración的Datos）
      if (!hasAnyGroups) {
        const migrated = await client.get(this.REVERSE_INDEX_MIGRATED_KEY)
        if (migrated !== 'true') {
          logger.debug('📁 Reverse index not migrated, falling back to getAccountGroups')
          const result = new Map()
          for (const accountId of accountIds) {
            try {
              const groups = await this.getAccountGroups(accountId)
              result.set(accountId, groups)
            } catch {
              result.set(accountId, [])
            }
          }
          return result
        }
      }

      // 对于反向Índice为空的Cuenta，单独Consulta并补建Índice（Procesar部分缺失情况）
      const emptyIndexAccountIds = []
      for (const accountId of accountIds) {
        const ids = accountGroupIdsMap.get(accountId) || []
        if (ids.length === 0) {
          emptyIndexAccountIds.push(accountId)
        }
      }
      if (emptyIndexAccountIds.length > 0 && emptyIndexAccountIds.length < accountIds.length) {
        // 部分CuentaÍndice缺失，逐个Consulta并补建
        for (const accountId of emptyIndexAccountIds) {
          try {
            const groups = await this.getAccountGroups(accountId)
            if (groups.length > 0) {
              const groupIds = groups.map((g) => g.id)
              accountGroupIdsMap.set(accountId, groupIds)
              groupIds.forEach((id) => uniqueGroupIds.add(id))
              // Asíncrono补建反向Índice
              client
                .sadd(`${this.REVERSE_INDEX_PREFIX}${platform}:${accountId}`, ...groupIds)
                .catch(() => {})
            }
          } catch {
            // 忽略Error，保持空Arreglo
          }
        }
      }

      // 批量ObtenerAgrupar详情
      const groupDetailsMap = new Map()
      if (uniqueGroupIds.size > 0) {
        const detailPipeline = client.pipeline()
        const groupIdArray = Array.from(uniqueGroupIds)
        for (const groupId of groupIdArray) {
          detailPipeline.hgetall(`${this.GROUP_PREFIX}${groupId}`)
          if (!skipMemberCount) {
            detailPipeline.scard(`${this.GROUP_MEMBERS_PREFIX}${groupId}`)
          }
        }
        const detailResults = await detailPipeline.exec()

        const step = skipMemberCount ? 1 : 2
        for (let i = 0; i < groupIdArray.length; i++) {
          const groupId = groupIdArray[i]
          const [err1, groupData] = detailResults[i * step]
          if (!err1 && groupData && Object.keys(groupData).length > 0) {
            const group = { ...groupData }
            if (!skipMemberCount) {
              const [err2, memberCount] = detailResults[i * step + 1]
              group.memberCount = err2 ? 0 : memberCount || 0
            }
            groupDetailsMap.set(groupId, group)
          }
        }
      }

      // Construir最终结果
      const result = new Map()
      for (const [accountId, groupIds] of accountGroupIdsMap) {
        const groups = groupIds
          .map((gid) => groupDetailsMap.get(gid))
          .filter(Boolean)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        result.set(accountId, groups)
      }

      return result
    } catch (error) {
      logger.error('❌ 批量ObtenerCuentaAgruparFalló:', error)
      return new Map(accountIds.map((id) => [id, []]))
    }
  }
}

module.exports = new AccountGroupService()
