#!/usr/bin/env node

/**
 * Test Alert Script
 * Send a test notification to verify Telegram integration
 */

const TelegramNotifier = require('./channels/TelegramNotifier');
const config = require('../openclaw.json');
require('dotenv').config();

async function main() {
  console.log('📤 Sending test alert...\n');

  const notifier = new TelegramNotifier(config.channels.telegram);

  // Verify bot connection
  await notifier.verify();

  // Send test alert
  await notifier.sendMessage(`
🧪 PI Agent Test Alert

This is a test notification from your OpenClaw PI Agent.

If you received this, Telegram integration is working correctly!

Timestamp: ${new Date().toISOString()}
  `.trim());

  console.log('✅ Test alert sent!');
  console.log('Check your Telegram to confirm receipt.');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Failed to send test alert:', error.message);
    process.exit(1);
  });
}
