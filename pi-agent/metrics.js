#!/usr/bin/env node

/**
 * Metrics Display Script
 * Show current metrics for all monitored projects
 */

const fs = require('fs');
const path = require('path');

const metricsDir = path.join(__dirname, '..', '.openclaw-metrics');

function getProjectMetrics(projectName) {
  const metricsFile = path.join(metricsDir, `${projectName}.json`);

  if (!fs.existsSync(metricsFile)) {
    return null;
  }

  try {
    const data = fs.readFileSync(metricsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

function calculateStats(metrics) {
  if (!metrics || metrics.length === 0) {
    return null;
  }

  const recent = metrics.slice(-100); // Last 100 data points

  const responseTimes = recent.map(m => m.responseTime).filter(t => t > 0);
  const errors = recent.filter(m => m.status === 'critical').length;
  const uptime = ((recent.length - errors) / recent.length) * 100;

  const avgResponse = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const p95Response = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

  return {
    uptime: uptime.toFixed(2),
    avgResponse: Math.round(avgResponse),
    p95Response: Math.round(p95Response),
    errors,
    totalChecks: recent.length
  };
}

async function main() {
  const config = require('../openclaw.json');

  console.log('📊 Project Metrics\n');
  console.log('─'.repeat(70));

  for (const project of config.monitoredProjects) {
    const metrics = getProjectMetrics(project.name);
    const stats = calculateStats(metrics);

    console.log(`\n${project.critical ? '🔴' : '🟢'} ${project.name}`);

    if (stats) {
      console.log(`  Uptime:       ${stats.uptime}%`);
      console.log(`  Avg Response: ${stats.avgResponse}ms`);
      console.log(`  P95 Response: ${stats.p95Response}ms`);
      console.log(`  Errors:       ${stats.errors}/${stats.totalChecks}`);
    } else {
      console.log('  No metrics available yet');
    }
  }

  console.log('\n' + '─'.repeat(70));
}

if (require.main === module) {
  main().catch(error => {
    console.error('Failed to display metrics:', error.message);
    process.exit(1);
  });
}

module.exports = { getProjectMetrics, calculateStats };
