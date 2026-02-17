#!/usr/bin/env node

/**
 * Manual Health Check Script
 * Run health checks on all monitored projects
 */

const axios = require('axios');
const config = require('../openclaw.json');
require('dotenv').config();

async function checkProject(project) {
  const startTime = Date.now();

  try {
    const response = await axios.get(project.healthCheck.url, {
      timeout: project.healthCheck.timeout || 10000
    });

    const responseTime = Date.now() - startTime;
    const status = response.data?.status || 'unknown';

    return {
      name: project.name,
      status: status === 'healthy' ? '✅' : '⚠️',
      responseTime: `${responseTime}ms`,
      critical: project.critical ? '🔴' : '🟢'
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      name: project.name,
      status: '❌',
      responseTime: `${responseTime}ms`,
      error: error.message
    };
  }
}

async function main() {
  console.log('🔍 Running health checks...\n');

  const checks = await Promise.all(
    config.monitoredProjects.map(checkProject)
  );

  console.log('Health Check Results:');
  console.log('─'.repeat(60));

  checks.forEach(check => {
    const { name, status, responseTime, critical, error } = check;

    console.log(`${critical || ''} ${name} ${status} - ${responseTime}`);

    if (error) {
      console.log(`  ⚠️  ${error}`);
    }
  });

  console.log('─'.repeat(60));

  const healthy = checks.filter(c => !c.error && !c.status.includes('⚠️')).length;
  console.log(`\nSummary: ${healthy}/${checks.length} healthy`);

  process.exit(healthy === checks.length ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Health check failed:', error.message);
    process.exit(1);
  });
}

module.exports = { checkProject };
