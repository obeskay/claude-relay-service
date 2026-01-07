/**
 * Rate Limit Automatic Cleanup Service
 * Periodically checks and cleans up expired rate limit states for all account types
 */

const logger = require('../utils/logger')
const openaiAccountService = require('./openaiAccountService')
const claudeAccountService = require('./claudeAccountService')
const claudeConsoleAccountService = require('./claudeConsoleAccountService')
const unifiedOpenAIScheduler = require('./unifiedOpenAIScheduler')
const webhookService = require('./webhookService')

class RateLimitCleanupService {
  constructor() {
    this.cleanupInterval = null
    this.isRunning = false
    // Default: check every 5 minutes
    this.intervalMs = 5 * 60 * 1000
    // Store cleared account information for sending recovery notifications
    this.clearedAccounts = []
  }

  /**
   * Start automatic cleanup service
   * @param {number} intervalMinutes - Check interval (minutes), default 5 minutes
   */
  start(intervalMinutes = 5) {
    if (this.cleanupInterval) {
      logger.warn('⚠️ Rate limit cleanup service is already running')
      return
    }

    this.intervalMs = intervalMinutes * 60 * 1000

    logger.info(`🧹 Starting rate limit cleanup service (interval: ${intervalMinutes} minutes)`)

    // Execute cleanup immediately once
    this.performCleanup()

    // Set periodic execution
    this.cleanupInterval = setInterval(() => {
      this.performCleanup()
    }, this.intervalMs)
  }

  /**
   * Stop automatic cleanup service
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      logger.info('🛑 Rate limit cleanup service stopped')
    }
  }

  /**
   * Perform one cleanup check
   */
  async performCleanup() {
    if (this.isRunning) {
      logger.debug('⏭️ Cleanup already in progress, skipping this cycle')
      return
    }

    this.isRunning = true
    const startTime = Date.now()

    try {
      logger.debug('🔍 Starting rate limit cleanup check...')

      const results = {
        openai: { checked: 0, cleared: 0, errors: [] },
        claude: { checked: 0, cleared: 0, errors: [] },
        claudeConsole: { checked: 0, cleared: 0, errors: [] }
      }

      // Cleanup OpenAI accounts
      await this.cleanupOpenAIAccounts(results.openai)

      // Cleanup Claude accounts
      await this.cleanupClaudeAccounts(results.claude)

      // Cleanup Claude Console accounts
      await this.cleanupClaudeConsoleAccounts(results.claudeConsole)

      const totalChecked =
        results.openai.checked + results.claude.checked + results.claudeConsole.checked
      const totalCleared =
        results.openai.cleared + results.claude.cleared + results.claudeConsole.cleared
      const duration = Date.now() - startTime

      if (totalCleared > 0) {
        logger.info(
          `✅ Rate limit cleanup completed: ${totalCleared} accounts cleared out of ${totalChecked} checked (${duration}ms)`
        )
        logger.info(`   OpenAI: ${results.openai.cleared}/${results.openai.checked}`)
        logger.info(`   Claude: ${results.claude.cleared}/${results.claude.checked}`)
        logger.info(
          `   Claude Console: ${results.claudeConsole.cleared}/${results.claudeConsole.checked}`
        )

        // Send webhook recovery notifications
        if (this.clearedAccounts.length > 0) {
          await this.sendRecoveryNotifications()
        }
      } else {
        logger.debug(
          `🔍 Rate limit cleanup check completed: no expired limits found (${duration}ms)`
        )
      }

      // Log errors
      const allErrors = [
        ...results.openai.errors,
        ...results.claude.errors,
        ...results.claudeConsole.errors
      ]
      if (allErrors.length > 0) {
        logger.warn(`⚠️ Encountered ${allErrors.length} errors during cleanup:`, allErrors)
      }
    } catch (error) {
      logger.error('❌ Rate limit cleanup failed:', error)
    } finally {
      // Ensure list is reset regardless of success or failure to avoid duplicate notifications
      this.clearedAccounts = []
      this.isRunning = false
    }
  }

  /**
   * Cleanup expired rate limits for OpenAI accounts
   */
  async cleanupOpenAIAccounts(result) {
    try {
      // Get account data using service layer
      const accounts = await openaiAccountService.getAllAccounts()

      for (const account of accounts) {
        const { rateLimitStatus } = account
        const isRateLimited =
          rateLimitStatus === 'limited' ||
          (rateLimitStatus &&
            typeof rateLimitStatus === 'object' &&
            (rateLimitStatus.status === 'limited' || rateLimitStatus.isRateLimited === true))

        if (isRateLimited) {
          result.checked++

          try {
            // Use unifiedOpenAIScheduler's check method, which automatically clears expired rate limits
            const isStillLimited = await unifiedOpenAIScheduler.isAccountRateLimited(account.id)

            if (!isStillLimited) {
              result.cleared++
              logger.info(
                `🧹 Auto-cleared expired rate limit for OpenAI account: ${account.name} (${account.id})`
              )

              // 记录已清理的账户信息
              this.clearedAccounts.push({
                platform: 'OpenAI',
                accountId: account.id,
                accountName: account.name,
                previousStatus: 'rate_limited',
                currentStatus: 'active'
              })
            }
          } catch (error) {
            result.errors.push({
              accountId: account.id,
              accountName: account.name,
              error: error.message
            })
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup OpenAI accounts:', error)
      result.errors.push({ error: error.message })
    }
  }

  /**
   * Cleanup expired rate limits for Claude accounts
   */
  async cleanupClaudeAccounts(result) {
    try {
      // Get account data using Redis
      const redis = require('../models/redis')
      const accounts = await redis.getAllClaudeAccounts()

      for (const account of accounts) {
        // Check if rate limited (compatible with object and string formats)
        const isRateLimited =
          account.rateLimitStatus === 'limited' ||
          (account.rateLimitStatus &&
            typeof account.rateLimitStatus === 'object' &&
            account.rateLimitStatus.status === 'limited')

        const autoStopped = account.rateLimitAutoStopped === 'true'
        const needsAutoStopRecovery =
          autoStopped && (account.rateLimitEndAt || account.schedulable === 'false')

        // 检查所有可能处于限流状态的账号，包括自动停止的账号
        if (isRateLimited || account.rateLimitedAt || needsAutoStopRecovery) {
          result.checked++

          try {
            // 使用 claudeAccountService 的检查方法，它会自动清除过期的限流
            const isStillLimited = await claudeAccountService.isAccountRateLimited(account.id)

            if (!isStillLimited) {
              if (!isRateLimited && autoStopped) {
                await claudeAccountService.removeAccountRateLimit(account.id)
              }
              result.cleared++
              logger.info(
                `🧹 Auto-cleared expired rate limit for Claude account: ${account.name} (${account.id})`
              )

              // 记录已清理的账户信息
              this.clearedAccounts.push({
                platform: 'Claude',
                accountId: account.id,
                accountName: account.name,
                previousStatus: 'rate_limited',
                currentStatus: 'active'
              })
            }
          } catch (error) {
            result.errors.push({
              accountId: account.id,
              accountName: account.name,
              error: error.message
            })
          }
        }
      }

      // 检查并恢复因5小时限制被自动停止的账号
      try {
        const fiveHourResult = await claudeAccountService.checkAndRecoverFiveHourStoppedAccounts()

        if (fiveHourResult.recovered > 0) {
          // 将5小时限制恢复的账号也加入到已清理账户列表中，用于发送通知
          for (const account of fiveHourResult.accounts) {
            this.clearedAccounts.push({
              platform: 'Claude',
              accountId: account.id,
              accountName: account.name,
              previousStatus: '5hour_limited',
              currentStatus: 'active',
              windowInfo: account.newWindow
            })
          }

          // 更新统计数据
          result.checked += fiveHourResult.checked
          result.cleared += fiveHourResult.recovered

          logger.info(
            `🕐 Claude 5-hour limit recovery: ${fiveHourResult.recovered}/${fiveHourResult.checked} accounts recovered`
          )
        }
      } catch (error) {
        logger.error('Failed to check and recover 5-hour stopped Claude accounts:', error)
        result.errors.push({
          type: '5hour_recovery',
          error: error.message
        })
      }
    } catch (error) {
      logger.error('Failed to cleanup Claude accounts:', error)
      result.errors.push({ error: error.message })
    }
  }

  /**
   * 清理 Claude Console 账号的过期限流
   */
  async cleanupClaudeConsoleAccounts(result) {
    try {
      // 使用服务层获取账户数据
      const accounts = await claudeConsoleAccountService.getAllAccounts()

      for (const account of accounts) {
        // 检查是否处于限流状态（兼容对象和字符串格式）
        const isRateLimited =
          account.rateLimitStatus === 'limited' ||
          (account.rateLimitStatus &&
            typeof account.rateLimitStatus === 'object' &&
            account.rateLimitStatus.status === 'limited')

        const autoStopped = account.rateLimitAutoStopped === 'true'
        const needsAutoStopRecovery = autoStopped && account.schedulable === 'false'

        // 检查两种状态字段：rateLimitStatus 和 status
        const hasStatusRateLimited = account.status === 'rate_limited'

        if (isRateLimited || hasStatusRateLimited || needsAutoStopRecovery) {
          result.checked++

          try {
            // 使用 claudeConsoleAccountService 的检查方法，它会自动清除过期的限流
            const isStillLimited = await claudeConsoleAccountService.isAccountRateLimited(
              account.id
            )

            if (!isStillLimited) {
              if (!isRateLimited && autoStopped) {
                await claudeConsoleAccountService.removeAccountRateLimit(account.id)
              }
              result.cleared++

              // 如果 status 字段是 rate_limited，需要额外清理
              if (hasStatusRateLimited && !isRateLimited) {
                await claudeConsoleAccountService.updateAccount(account.id, {
                  status: 'active'
                })
              }

              logger.info(
                `🧹 Auto-cleared expired rate limit for Claude Console account: ${account.name} (${account.id})`
              )

              // 记录已清理的账户信息
              this.clearedAccounts.push({
                platform: 'Claude Console',
                accountId: account.id,
                accountName: account.name,
                previousStatus: 'rate_limited',
                currentStatus: 'active'
              })
            }
          } catch (error) {
            result.errors.push({
              accountId: account.id,
              accountName: account.name,
              error: error.message
            })
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup Claude Console accounts:', error)
      result.errors.push({ error: error.message })
    }
  }

  /**
   * 手动触发一次清理（供 API 或 CLI 调用）
   */
  async manualCleanup() {
    logger.info('🧹 Manual rate limit cleanup triggered')
    await this.performCleanup()
  }

  /**
   * 发送Recuperación de límite de velocidad Notification
   */
  async sendRecoveryNotifications() {
    try {
      // 按平台分组账户
      const groupedAccounts = {}
      for (const account of this.clearedAccounts) {
        if (!groupedAccounts[account.platform]) {
          groupedAccounts[account.platform] = []
        }
        groupedAccounts[account.platform].push(account)
      }

      // 构建通知消息
      const platforms = Object.keys(groupedAccounts)
      const totalAccounts = this.clearedAccounts.length

      let message = `🎉 A total of ${totalAccounts} accounts have been recovered from rate limit\n\n`

      for (const platform of platforms) {
        const accounts = groupedAccounts[platform]
        message += `**${platform}** (${accounts.length} 个):\n`
        for (const account of accounts) {
          message += `• ${account.accountName} (ID: ${account.accountId})\n`
        }
        message += '\n'
      }

      // 发送 webhook 通知
      await webhookService.sendNotification('rateLimitRecovery', {
        title: 'Recuperación de límite de velocidad Notification',
        message,
        totalAccounts,
        platforms: Object.keys(groupedAccounts),
        accounts: this.clearedAccounts,
        timestamp: new Date().toISOString()
      })

      logger.info(`📢 Rate limit recovery notification sent, involving ${totalAccounts} accounts`)
    } catch (error) {
      logger.error('❌ Failed to send rate limit recovery notification:', error)
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      running: !!this.cleanupInterval,
      intervalMinutes: this.intervalMs / (60 * 1000),
      isProcessing: this.isRunning
    }
  }
}

// 创建单例实例
const rateLimitCleanupService = new RateLimitCleanupService()

module.exports = rateLimitCleanupService
