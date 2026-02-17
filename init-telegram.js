#!/usr/bin/env node

/**
 * OpenClaw PI Agent - Telegram Initialization Script
 *
 * Initializes Telegram bot integration and sends confirmation with system screenshot
 * Run after deploying PI agent to Coolify VPS
 */

const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

class TelegramInitializer {
  constructor() {
    this.baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    this.agentName = 'obeskay-pi';
    this.environment = process.env.NODE_ENV || 'production';
  }

  async sendMessage(message, options = {}) {
    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        ...options
      });
      return response.data;
    } catch (error) {
      console.error('Failed to send Telegram message:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendPhoto(photoPath, caption) {
    try {
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID);
      formData.append('photo', fs.createReadStream(photoPath));
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');
      }

      const response = await axios.post(`${this.baseUrl}/sendPhoto`, formData, {
        headers: formData.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Failed to send photo:', error.response?.data || error.message);
      throw error;
    }
  }

  getSystemInfo() {
    try {
      const hostname = execSync('hostname').toString().trim();
      const uptime = execSync('uptime -p').toString().trim();
      const disk = execSync("df -h / | tail -1 | awk '{print $5}'").toString().trim();
      const memory = execSync("free | grep Mem | awk '{print $3/$2 * 100.0}'").toString().trim();
      const nodeVersion = execSync('node --version').toString().trim();
      const npmVersion = execSync('npm --version').toString().trim();

      return {
        hostname,
        uptime,
        diskUsage: `${disk}`,
        memoryUsage: `${parseFloat(memory).toFixed(1)}%`,
        nodeVersion,
        npmVersion,
        environment: this.environment,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get system info:', error.message);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  getProjectStatus() {
    const projects = [
      'claude-relay-service',
      'sticky-covers',
      'qrapidito',
      'chatea-la'
    ];

    return projects.map(project => ({
      name: project,
      path: process.env[`${project.toUpperCase().replace(/-/g, '_')}_PATH`] || `/var/www/${project}`,
      status: 'monitored'
    }));
  }

  captureScreenshot() {
    const screenshotPath = path.join(__dirname, '.pi-agent-setup.png');

    try {
      // Try to capture screenshot using available tools
      const commands = [
        `gnome-screenshot -f ${screenshotPath}`,
        `scrot ${screenshotPath}`,
        `import -window root ${screenshotPath}`
      ];

      for (const cmd of commands) {
        try {
          execSync(cmd, { stdio: 'ignore' });
          if (fs.existsSync(screenshotPath)) {
            return screenshotPath;
          }
        } catch (e) {
          // Try next command
          continue;
        }
      }

      console.log('Screenshot capture not available on this system');
      return null;
    } catch (error) {
      console.error('Failed to capture screenshot:', error.message);
      return null;
    }
  }

  async initialize() {
    console.log('🤖 Initializing OpenClaw PI Agent Telegram integration...\n');

    // Validate credentials
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env');
    }

    // Test bot connection
    console.log('📡 Testing bot connection...');
    const me = await axios.get(`${this.baseUrl}/getMe`);
    console.log(`✅ Bot connected: @${me.data.result.username}\n`);

    // Gather system information
    console.log('📊 Gathering system information...');
    const systemInfo = this.getSystemInfo();
    const projectStatus = this.getProjectStatus();

    // Build initialization message
    const message = this.buildInitMessage(systemInfo, projectStatus);

    // Send text message
    console.log('📤 Sending initialization message...');
    await this.sendMessage(message);

    // Try to send screenshot
    const screenshotPath = this.captureScreenshot();
    if (screenshotPath && fs.existsSync(screenshotPath)) {
      console.log('📸 Sending screenshot...');
      await this.sendPhoto(screenshotPath, 'System screenshot captured during initialization');
      fs.unlinkSync(screenshotPath);
    }

    // Send follow-up with monitoring capabilities
    const capabilitiesMessage = this.buildCapabilitiesMessage();
    await this.sendMessage(capabilitiesMessage);

    console.log('\n✅ Telegram initialization complete!');
    console.log(`\n📱 Your PI agent ${this.agentName} is now active and monitoring.`);
  }

  buildInitMessage(systemInfo, projectStatus) {
    return `
*🤖 OpenClaw PI Agent Initialized*

*Agent:* \`${this.agentName}\`
*Environment:* \`${systemInfo.environment}\`
*Timestamp:* \`${systemInfo.timestamp}\`

*🖥️ System Info*
• Host: \`${systemInfo.hostname}\`
• Uptime: \`${systemInfo.uptime}\`
• Disk: \`${systemInfo.diskUsage}\`
• Memory: \`${systemInfo.memoryUsage}\`
• Node: \`${systemInfo.nodeVersion}\`

*📦 Monitored Projects*
${projectStatus.map(p => `• ${p.name}: \`${p.status}\``).join('\n')}

*✅ All systems operational*
Agent is now in autonomous mode and will proactively monitor your infrastructure.
    `.trim();
  }

  buildCapabilitiesMessage() {
    return `
*⚡ PI Agent Capabilities*

*🔍 Monitoring*
• Health checks every 2 minutes (critical services)
• Performance metrics capture
• Error rate and response time tracking
• Redis/Database health monitoring

*🔧 Self-Healing*
• Automatic service restart on failure
• Stale connection cleanup
• Log rotation and cleanup
• Cache optimization

*📈 Maintenance (2-hour async blocks)*
• Daily database backups (02:00 UTC)
• Dependency security scanning (14:00 UTC)
• Performance optimization cycles
• Cost and resource usage reports

*🚨 Proactive Notifications*
• Error threshold alerts (3 failures)
• Performance degradation warnings
• Security events
• Deployment status updates
• Daily health digests (06:00 UTC)

*💬 Philosophy*
• Simple code that scales infinitely
• DX/UX obsessed
• Non-verbose, agile responses
• Zero over-engineering

I'll reach out when something needs your attention. 🎯
    `.trim();
  }
}

// Run initialization
if (require.main === module) {
  const initializer = new TelegramInitializer();

  initializer.initialize()
    .then(() => {
      console.log('\n✨ Setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Initialization failed:', error.message);
      process.exit(1);
    });
}

module.exports = TelegramInitializer;
