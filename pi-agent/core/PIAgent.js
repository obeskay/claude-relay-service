/**
 * PI Agent Core
 * Main orchestrator for monitoring, self-healing, and notifications
 */

const fs = require('fs');
const path = require('path');

const Monitor = require('./Monitor');
const SelfHealer = require('./SelfHealer');
const CronScheduler = require('./CronScheduler');
const TelegramNotifier = require('../channels/TelegramNotifier');
const logger = require('../utils/logger');

class PIAgent {
  constructor({ configPath, cronSchedulePath, personaPath }) {
    this.config = this.loadConfig(configPath);
    this.cronSchedule = this.loadConfig(cronSchedulePath);
    this.persona = fs.readFileSync(personaPath, 'utf8');

    this.monitor = null;
    this.selfHealer = null;
    this.scheduler = null;
    this.notifier = null;

    this.isRunning = false;
  }

  loadConfig(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to load config: ${filePath}`, { error: error.message });
      throw error;
    }
  }

  async initialize() {
    logger.info('Initializing PI Agent components...');

    // Initialize notifier
    this.notifier = new TelegramNotifier(this.config.channels.telegram);
    await this.notifier.verify();

    // Initialize monitor
    this.monitor = new Monitor({
      projects: this.config.monitoredProjects,
      notifier: this.notifier,
      config: this.config.skills.monitoring
    });

    // Initialize self-healer
    this.selfHealer = new SelfHealer({
      actions: this.config.skills.selfHealing.actions,
      maxRetries: this.config.skills.selfHealing.maxRetries,
      notifier: this.notifier
    });

    // Initialize cron scheduler
    this.scheduler = new CronScheduler({
      schedule: this.cronSchedule,
      projects: this.config.monitoredProjects,
      notifier: this.notifier
    });

    // Start monitoring
    await this.monitor.start();

    // Start cron jobs
    await this.scheduler.start();

    this.isRunning = true;
    logger.info('✅ PI Agent fully initialized and running', {
      monitoredProjects: this.config.monitoredProjects.length,
      cronJobs: Object.keys(this.scheduler.jobs).length
    });

    // Send startup notification
    await this.notifier.sendStartup(this.config.agentName, this.config.monitoredProjects);
  }

  async shutdown(signal) {
    if (!this.isRunning) return;

    logger.info(`Received ${signal}, shutting down PI Agent...`);

    this.isRunning = false;

    if (this.monitor) {
      await this.monitor.stop();
    }

    if (this.scheduler) {
      await this.scheduler.stop();
    }

    if (this.notifier) {
      await this.notifier.sendShutdown(this.config.agentName);
    }

    logger.info('PI Agent shut down complete');
    process.exit(0);
  }
}

module.exports = PIAgent;
