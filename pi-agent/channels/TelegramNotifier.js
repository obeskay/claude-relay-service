/**
 * Telegram Notifier Channel
 * Proactive notifications with concise formatting
 */

const axios = require('axios');
const logger = require('../utils/logger');

class TelegramNotifier {
  constructor(config) {
    this.config = config;
    this.baseUrl = `https://api.telegram.org/bot${config.botToken}`;
    this.chatId = config.chatId;
  }

  async verify() {
    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      logger.info(`Telegram bot verified: @${response.data.result.username}`);
      return true;
    } catch (error) {
      logger.error('Telegram bot verification failed', { error: error.message });
      throw error;
    }
  }

  async sendMessage(text, options = {}) {
    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...options
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to send Telegram message', { error: error.message, text: text.substring(0, 100) });
      return null;
    }
  }

  async sendAlert({ project, severity, error, consecutiveFailures, url }) {
    const emoji = severity === 'critical' ? '🔴' : '🟡';
    const message = `${emoji} [${project}] Service Unresponsive\n• ${consecutiveFailures} consecutive failures\n• Error: ${error}\n• Investigating...`;

    await this.sendMessage(message);
  }

  async sendPerformanceWarning(project, responseTime) {
    const message = `🟡 [${project}] High Response Time\n• ${responseTime}ms (threshold: 2000ms)\n• Monitoring for 5min`;

    await this.sendMessage(message);
  }

  async sendSelfHealSuccess(project, action) {
    const message = `🟢 [${project}] Self-Healed\n• Action: ${action}\n• Resolved automatically`;

    await this.sendMessage(message);
  }

  async sendEscalation(project, issue, action, attempts) {
    const message = `🔴 [${project}] Escalation Required\n• Issue: ${issue}\n• Action: ${action}\n• Attempts: ${attempts}\n• Manual intervention needed`;

    await this.sendMessage(message);
  }

  async sendCronSuccess(jobId, duration) {
    const message = `✅ [Cron] ${jobId}\n• Completed in ${duration}ms`;

    await this.sendMessage(message);
  }

  async sendCronFailure(jobId, error) {
    const message = `❌ [Cron] ${jobId} Failed\n• Error: ${error}\n• Check logs for details`;

    await this.sendMessage(message);
  }

  async sendStartup(agentName, projects) {
    const message = `🚀 PI Agent ${agentName} Started\n• Monitoring ${projects.length} projects\n${projects.map(p => `• ${p.name}`).join('\n')}\n\n✅ All systems operational`;

    await this.sendMessage(message);
  }

  async sendShutdown(agentName) {
    const message = `🛑 PI Agent ${agentName} Shut Down\n• Manual or system-initiated stop`;

    await this.sendMessage(message);
  }

  async sendDailyReport(metrics) {
    const { formatDate } = require('../utils/helpers');
    const date = formatDate(new Date());

    let message = `📊 Daily Health Report - ${date}\n\n`;

    for (const [project, stats] of Object.entries(metrics)) {
      const emoji = stats.uptime > 99 ? '🟢' : stats.uptime > 95 ? '🟡' : '🔴';
      message += `${emoji} ${project}\n`;
      message += `• Uptime: ${stats.uptime}%\n`;
      message += `• Avg Response: ${stats.avgResponse}ms\n`;
      message += `• Errors: ${stats.errors}\n\n`;
    }

    await this.sendMessage(message);
  }
}

module.exports = TelegramNotifier;
