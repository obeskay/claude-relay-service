/**
 * Cuenta定时Probar调度Servicio
 * 使用 node-cron Soportar crontab Tabla达式，为每个CuentaCrear独立的Tarea programada
 */

const cron = require('node-cron')
const redis = require('../models/redis')
const logger = require('../utils/logger')

class AccountTestSchedulerService {
  constructor() {
    // 存储每个Cuenta的 cron 任务: Map<string, { task: ScheduledTask, cronExpression: string }>
    this.scheduledTasks = new Map()
    // 定期刷新Configuración的间隔 (毫秒)
    this.refreshIntervalMs = 60 * 1000
    this.refreshInterval = null
    // 当前En progresoProbar的Cuenta
    this.testingAccounts = new Set()
    // 是否已启动
    this.isStarted = false
  }

  /**
   * Validar cron Tabla达式是否有效
   * @param {string} cronExpression - cron Tabla达式
   * @returns {boolean}
   */
  validateCronExpression(cronExpression) {
    // 长度Verificar（防止 DoS）
    if (!cronExpression || cronExpression.length > 100) {
      return false
    }
    return cron.validate(cronExpression)
  }

  /**
   * 启动调度器
   */
  async start() {
    if (this.isStarted) {
      logger.warn('⚠️ Account test scheduler is already running')
      return
    }

    this.isStarted = true
    logger.info('🚀 Starting account test scheduler service (node-cron mode)')

    // Inicializar所有已ConfiguraciónCuenta的Tarea programada
    await this._refreshAllTasks()

    // 定期刷新Configuración，以便动态添加/修改的Configuración能生效
    this.refreshInterval = setInterval(() => {
      this._refreshAllTasks()
    }, this.refreshIntervalMs)

    logger.info(
      `📅 Account test scheduler started (refreshing configs every ${this.refreshIntervalMs / 1000}s)`
    )
  }

  /**
   * 停止调度器
   */
  stop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }

    // 停止所有 cron 任务
    for (const [accountKey, taskInfo] of this.scheduledTasks.entries()) {
      taskInfo.task.stop()
      logger.debug(`🛑 Stopped cron task for ${accountKey}`)
    }
    this.scheduledTasks.clear()

    this.isStarted = false
    logger.info('🛑 Account test scheduler stopped')
  }

  /**
   * 刷新所有Cuenta的Tarea programada
   * @private
   */
  async _refreshAllTasks() {
    try {
      const platforms = ['claude', 'gemini', 'openai']
      const activeAccountKeys = new Set()

      // 并Fila加载所有平台的Configuración
      const allEnabledAccounts = await Promise.all(
        platforms.map((platform) =>
          redis
            .getEnabledTestAccounts(platform)
            .then((accounts) => accounts.map((acc) => ({ ...acc, platform })))
            .catch((error) => {
              logger.warn(`⚠️ Failed to load test accounts for platform ${platform}:`, error)
              return []
            })
        )
      )

      // 展平平台Datos
      const flatAccounts = allEnabledAccounts.flat()

      for (const { accountId, cronExpression, model, platform } of flatAccounts) {
        if (!cronExpression) {
          logger.warn(
            `⚠️ Account ${accountId} (${platform}) has no valid cron expression, skipping`
          )
          continue
        }

        const accountKey = `${platform}:${accountId}`
        activeAccountKeys.add(accountKey)

        // Verificar是否需要Actualizar任务
        const existingTask = this.scheduledTasks.get(accountKey)
        if (existingTask) {
          // 如果 cron Tabla达式和模型都没变，不需要Actualizar
          if (existingTask.cronExpression === cronExpression && existingTask.model === model) {
            continue
          }
          // Configuración变了，停止旧任务
          existingTask.task.stop()
          logger.info(`🔄 Updating cron task for ${accountKey}: ${cronExpression}, model: ${model}`)
        } else {
          logger.info(`➕ Creating cron task for ${accountKey}: ${cronExpression}, model: ${model}`)
        }

        // Crear新的 cron 任务
        this._createCronTask(accountId, platform, cronExpression, model)
      }

      // Limpiar已Eliminar或Deshabilitar的Cuenta任务
      for (const [accountKey, taskInfo] of this.scheduledTasks.entries()) {
        if (!activeAccountKeys.has(accountKey)) {
          taskInfo.task.stop()
          this.scheduledTasks.delete(accountKey)
          logger.info(`➖ Removed cron task for ${accountKey} (disabled or deleted)`)
        }
      }
    } catch (error) {
      logger.error('❌ Error refreshing account test tasks:', error)
    }
  }

  /**
   * 为单个CuentaCrear cron 任务
   * @param {string} accountId
   * @param {string} platform
   * @param {string} cronExpression
   * @param {string} model - Probar使用的模型
   * @private
   */
  _createCronTask(accountId, platform, cronExpression, model) {
    const accountKey = `${platform}:${accountId}`

    // Validar cron Tabla达式
    if (!this.validateCronExpression(cronExpression)) {
      logger.error(`❌ Invalid cron expression for ${accountKey}: ${cronExpression}`)
      return
    }

    const task = cron.schedule(
      cronExpression,
      async () => {
        await this._runAccountTest(accountId, platform, model)
      },
      {
        scheduled: true,
        timezone: process.env.TZ || 'Asia/Shanghai'
      }
    )

    this.scheduledTasks.set(accountKey, {
      task,
      cronExpression,
      model,
      accountId,
      platform
    })
  }

  /**
   * Ejecutar单个CuentaProbar
   * @param {string} accountId - CuentaID
   * @param {string} platform - 平台Tipo
   * @param {string} model - Probar使用的模型
   * @private
   */
  async _runAccountTest(accountId, platform, model) {
    const accountKey = `${platform}:${accountId}`

    // 避免重复Probar
    if (this.testingAccounts.has(accountKey)) {
      logger.debug(`⏳ Account ${accountKey} is already being tested, skipping`)
      return
    }

    this.testingAccounts.add(accountKey)

    try {
      logger.info(
        `🧪 Running scheduled test for ${platform} account: ${accountId} (model: ${model})`
      )

      let testResult

      // 根据平台调用对应的ProbarMétodo
      switch (platform) {
        case 'claude':
          testResult = await this._testClaudeAccount(accountId, model)
          break
        case 'gemini':
          testResult = await this._testGeminiAccount(accountId, model)
          break
        case 'openai':
          testResult = await this._testOpenAIAccount(accountId, model)
          break
        default:
          testResult = {
            success: false,
            error: `Unsupported platform: ${platform}`,
            timestamp: new Date().toISOString()
          }
      }

      // 保存Probar结果
      await redis.saveAccountTestResult(accountId, platform, testResult)

      // Actualizar最后ProbarTiempo
      await redis.setAccountLastTestTime(accountId, platform)

      // RegistroRegistro
      if (testResult.success) {
        logger.info(
          `✅ Scheduled test passed for ${platform} account ${accountId} (${testResult.latencyMs}ms)`
        )
      } else {
        logger.warn(
          `❌ Scheduled test failed for ${platform} account ${accountId}: ${testResult.error}`
        )
      }

      return testResult
    } catch (error) {
      logger.error(`❌ Error testing ${platform} account ${accountId}:`, error)

      const errorResult = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }

      await redis.saveAccountTestResult(accountId, platform, errorResult)
      await redis.setAccountLastTestTime(accountId, platform)

      return errorResult
    } finally {
      this.testingAccounts.delete(accountKey)
    }
  }

  /**
   * Probar Claude Cuenta
   * @param {string} accountId
   * @param {string} model - Probar使用的模型
   * @private
   */
  async _testClaudeAccount(accountId, model) {
    const claudeRelayService = require('./relay/claudeRelayService')
    return await claudeRelayService.testAccountConnectionSync(accountId, model)
  }

  /**
   * Probar Gemini Cuenta
   * @param {string} _accountId
   * @param {string} _model
   * @private
   */
  async _testGeminiAccount(_accountId, _model) {
    // Gemini Probar暂时Retornar未实现
    return {
      success: false,
      error: 'Gemini scheduled test not implemented yet',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Probar OpenAI Cuenta
   * @param {string} _accountId
   * @param {string} _model
   * @private
   */
  async _testOpenAIAccount(_accountId, _model) {
    // OpenAI Probar暂时Retornar未实现
    return {
      success: false,
      error: 'OpenAI scheduled test not implemented yet',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 手动触发CuentaProbar
   * @param {string} accountId - CuentaID
   * @param {string} platform - 平台Tipo
   * @param {string} model - Probar使用的模型
   * @returns {Promise<Object>} Probar结果
   */
  async triggerTest(accountId, platform, model = 'claude-sonnet-4-5-20250929') {
    logger.info(`🎯 Manual test triggered for ${platform} account: ${accountId} (model: ${model})`)
    return await this._runAccountTest(accountId, platform, model)
  }

  /**
   * ObtenerCuentaProbar历史
   * @param {string} accountId - CuentaID
   * @param {string} platform - 平台Tipo
   * @returns {Promise<Array>} Probar历史
   */
  async getTestHistory(accountId, platform) {
    return await redis.getAccountTestHistory(accountId, platform)
  }

  /**
   * ObtenerCuentaProbarConfiguración
   * @param {string} accountId - CuentaID
   * @param {string} platform - 平台Tipo
   * @returns {Promise<Object|null>}
   */
  async getTestConfig(accountId, platform) {
    return await redis.getAccountTestConfig(accountId, platform)
  }

  /**
   * EstablecerCuentaProbarConfiguración
   * @param {string} accountId - CuentaID
   * @param {string} platform - 平台Tipo
   * @param {Object} testConfig - ProbarConfiguración { enabled: boolean, cronExpression: string, model: string }
   * @returns {Promise<void>}
   */
  async setTestConfig(accountId, platform, testConfig) {
    // Validar cron Tabla达式
    if (testConfig.cronExpression && !this.validateCronExpression(testConfig.cronExpression)) {
      throw new Error(`Invalid cron expression: ${testConfig.cronExpression}`)
    }

    await redis.saveAccountTestConfig(accountId, platform, testConfig)
    logger.info(
      `📝 Test config updated for ${platform} account ${accountId}: enabled=${testConfig.enabled}, cronExpression=${testConfig.cronExpression}, model=${testConfig.model}`
    )

    // 立即刷新任务，使Configuración立即生效
    if (this.isStarted) {
      await this._refreshAllTasks()
    }
  }

  /**
   * Actualizar单个Cuenta的Tarea programada（Configuración变更时调用）
   * @param {string} accountId
   * @param {string} platform
   */
  async refreshAccountTask(accountId, platform) {
    if (!this.isStarted) {
      return
    }

    const accountKey = `${platform}:${accountId}`
    const testConfig = await redis.getAccountTestConfig(accountId, platform)

    // 停止现有任务
    const existingTask = this.scheduledTasks.get(accountKey)
    if (existingTask) {
      existingTask.task.stop()
      this.scheduledTasks.delete(accountKey)
    }

    // 如果Habilitar且有有效的 cron Tabla达式，Crear新任务
    if (testConfig?.enabled && testConfig?.cronExpression) {
      this._createCronTask(accountId, platform, testConfig.cronExpression, testConfig.model)
      logger.info(
        `🔄 Refreshed cron task for ${accountKey}: ${testConfig.cronExpression}, model: ${testConfig.model}`
      )
    }
  }

  /**
   * Obtener调度器状态
   * @returns {Object}
   */
  getStatus() {
    const tasks = []
    for (const [accountKey, taskInfo] of this.scheduledTasks.entries()) {
      tasks.push({
        accountKey,
        accountId: taskInfo.accountId,
        platform: taskInfo.platform,
        cronExpression: taskInfo.cronExpression,
        model: taskInfo.model
      })
    }

    return {
      running: this.isStarted,
      refreshIntervalMs: this.refreshIntervalMs,
      scheduledTasksCount: this.scheduledTasks.size,
      scheduledTasks: tasks,
      currentlyTesting: Array.from(this.testingAccounts)
    }
  }
}

// 单例模式
const accountTestSchedulerService = new AccountTestSchedulerService()

module.exports = accountTestSchedulerService
