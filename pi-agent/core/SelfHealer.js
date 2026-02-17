/**
 * Self-Healer Component
 * Automatic recovery actions for common issues
 */

const { execSync } = require('child_process');
const logger = require('../utils/logger');

class SelfHealer {
  constructor({ actions, maxRetries, notifier }) {
    this.actions = actions;
    this.maxRetries = maxRetries;
    this.notifier = notifier;
    this.retryCount = new Map(); // actionId -> attempts
  }

  async heal(projectName, issue) {
    logger.info(`Self-healing triggered for ${projectName}`, { issue });

    const action = this.determineAction(issue);
    if (!action) {
      logger.warn(`No self-healing action for issue: ${issue}`);
      return false;
    }

    const attempts = this.retryCount.get(action) || 0;

    if (attempts >= this.maxRetries) {
      logger.error(`Max retries reached for action: ${action}`);
      await this.notifier.sendEscalation(projectName, issue, action, attempts);
      this.retryCount.set(action, 0);
      return false;
    }

    try {
      const result = await this.executeAction(action, projectName);
      this.retryCount.set(action, attempts + 1);

      logger.info(`Self-healing action ${action} executed`, { result });
      await this.notifier.sendSelfHealSuccess(projectName, action);

      // Reset on success
      this.retryCount.set(action, 0);
      return true;

    } catch (error) {
      logger.error(`Self-healing action ${action} failed`, {
        error: error.message,
        attempt: attempts + 1
      });

      if (attempts + 1 >= this.maxRetries) {
        await this.notifier.sendEscalation(projectName, issue, action, attempts + 1);
      }

      return false;
    }
  }

  determineAction(issue) {
    if (issue.includes('service') || issue.includes('unresponsive')) {
      return 'restart-failed-services';
    }
    if (issue.includes('memory') || issue.includes('leak')) {
      return 'restart-overloaded-workers';
    }
    if (issue.includes('connection') || issue.includes('stale')) {
      return 'clear-stale-connections';
    }
    if (issue.includes('disk') || issue.includes('space')) {
      return 'rotate-logs';
    }

    return null;
  }

  async executeAction(action, projectName) {
    const commands = {
      'restart-failed-services': `pm2 restart ${projectName}`,
      'clear-stale-connections': `redis-cli FLUSHDB`,
      'rotate-logs': `logrotate -f /etc/logrotate.conf`,
      'cleanup-cache': `rm -rf /tmp/${projectName}/*`,
      'restart-overloaded-workers': `pm2 reload ${projectName}`
    };

    const command = commands[action];
    if (!command) {
      throw new Error(`Unknown action: ${action}`);
    }

    try {
      const output = execSync(command, { encoding: 'utf8', timeout: 30000 });
      return { success: true, output };
    } catch (error) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  resetRetryCount(action) {
    this.retryCount.set(action, 0);
  }
}

module.exports = SelfHealer;
