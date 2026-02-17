/**
 * Monitor Component
 * Health checks and metrics collection
 */

const axios = require('axios');
const { CronJob } = require('node-cron');
const logger = require('../utils/logger');

class Monitor {
  constructor({ projects, notifier, config }) {
    this.projects = projects;
    this.notifier = notifier;
    this.config = config;

    this.checks = new Map(); // projectId -> CronJob
    this.metrics = new Map(); // projectId -> metrics history
    this.failureCount = new Map(); // projectId -> consecutive failures
  }

  async start() {
    logger.info('Starting monitoring...');

    for (const project of this.projects) {
      const interval = project.critical ? '*/2 * * * *' : '*/5 * * * *';

      const job = new CronJob(interval, async () => {
        await this.checkProject(project);
      });

      this.checks.set(project.name, job);
      job.start();

      logger.info(`Monitoring started for ${project.name}`, {
        interval: project.critical ? '2min' : '5min',
        url: project.healthCheck.url
      });
    }
  }

  async stop() {
    logger.info('Stopping monitoring...');
    this.checks.forEach(job => job.stop());
    this.checks.clear();
  }

  async checkProject(project) {
    const startTime = Date.now();
    let status = 'healthy';
    let responseTime = 0;
    let error = null;

    try {
      const response = await axios.get(project.healthCheck.url, {
        timeout: project.healthCheck.timeout || 10000
      });

      responseTime = Date.now() - startTime;
      status = response.data?.status || 'healthy';

      if (status !== 'healthy') {
        logger.warn(`${project.name} health check degraded`, { status, responseTime });
      }

      // Reset failure count on success
      this.failureCount.set(project.name, 0);

    } catch (error) {
      responseTime = Date.now() - startTime;
      status = 'critical';
      this.failureCount.set(project.name, (this.failureCount.get(project.name) || 0) + 1);

      logger.error(`${project.name} health check failed`, {
        error: error.message,
        consecutiveFailures: this.failureCount.get(project.name)
      });

      // Check if should alert
      const threshold = this.notifier.config.proactiveRules?.errorThreshold || 3;
      if (this.failureCount.get(project.name) >= threshold) {
        await this.notifier.sendAlert({
          project: project.name,
          severity: 'critical',
          error: error.message,
          consecutiveFailures: this.failureCount.get(project.name),
          url: project.healthCheck.url
        });
      }
    }

    // Store metrics
    this.storeMetrics(project.name, {
      timestamp: new Date().toISOString(),
      status,
      responseTime,
      error: error?.message
    });

    // Check performance thresholds
    if (responseTime > (this.notifier.config.proactiveRules?.responseTimeThreshold || 2000)) {
      await this.notifier.sendPerformanceWarning(project.name, responseTime);
    }
  }

  storeMetrics(projectId, metrics) {
    if (!this.metrics.has(projectId)) {
      this.metrics.set(projectId, []);
    }

    const history = this.metrics.get(projectId);
    history.push(metrics);

    // Keep last 1000 data points
    if (history.length > 1000) {
      history.shift();
    }
  }

  getMetrics(projectId) {
    return this.metrics.get(projectId) || [];
  }
}

module.exports = Monitor;
