#!/usr/bin/env node

/**
 * OpenClaw PI Agent - Main Entry Point
 * Autonomous infrastructure monitoring and self-healing agent
 */

const path = require('path');
require('dotenv').config();

const PI Agent = require('./core/PIAgent');
const logger = require('./utils/logger');

async function main() {
  const configPath = path.join(__dirname, '..', 'openclaw.json');
  const cronSchedulePath = path.join(__dirname, '..', 'cron-schedule.json');
  const personaPath = path.join(__dirname, '..', 'pi-persona.md');

  try {
    const agent = new PI Agent({
      configPath,
      cronSchedulePath,
      personaPath
    });

    logger.info('🤖 OpenClaw PI Agent starting...', {
      agentName: agent.config.agentName,
      environment: agent.config.environment
    });

    await agent.initialize();

    // Graceful shutdown
    process.on('SIGTERM', () => agent.shutdown('SIGTERM'));
    process.on('SIGINT', () => agent.shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start PI Agent', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PI Agent };
