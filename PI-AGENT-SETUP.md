# OpenClaw PI Agent - obeskay

Personal Infrastructure agent for autonomous monitoring, self-healing, and proactive notifications across obeskay projects.

## What It Does

- **Autonomous Monitoring**: 2-minute health checks on critical services
- **Self-Healing**: Auto-restart failed services, clear stale connections, optimize resources
- **Proactive Notifications**: Telegram alerts before users notice issues
- **Async Maintenance**: 2-hour block cron jobs (backups, security scans, optimization)
- **Daily Digests**: 06:00 UTC health reports

## Monitored Projects

| Project | Type | Critical | Health Check |
|---------|------|----------|--------------|
| claude-relay-service | Node.js | ✅ | Every 2 min |
| sticky-covers | Next.js | | Every 5 min |
| qrapidito | Node.js | | Every 5 min |
| chatea-la | Next.js | | Every 5 min |

## Quick Setup

### 1. Environment Variables

Add to your `.env` file:

```bash
# Telegram Bot Setup (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Project URLs (for health checks)
RELAY_SERVICE_URL=https://your-relay-service.com
STICKY_COVERS_URL=https://your-sticky-covers.com
QRAPIDITO_URL=https://your-qrapidito.com
CHATEA_LA_URL=https://your-chatea-la.com

# Project Paths (for local operations)
CLAUDE_RELAY_SERVICE_PATH=/var/www/claude-relay-service
STICKY_COVERS_PATH=/var/www/sticky-covers
QRAPIDITO_PATH=/var/www/qrapidito
CHATEA_LA_PATH=/var/www/chatea-la

# Optional Webhook
WEBHOOK_ENDPOINT=https://your-webhook-url.com/hooks/pi-agent
```

### 2. Get Telegram Credentials

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow prompts
3. Copy the bot token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Save as `TELEGRAM_BOT_TOKEN`

**Get Your Chat ID:**
1. Search for your bot in Telegram
2. Send any message to the bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find `"chat":{"id":123456}` in the response
5. Save as `TELEGRAM_CHAT_ID`

### 3. Initialize Telegram Bot

```bash
# Test the connection and send confirmation
node init-telegram.js
```

You'll receive a confirmation message with system info and capabilities.

### 4. Deploy to Coolify VPS

**Option A: Via Coolify Dashboard**
1. Create new service in Coolify
2. Select "Dockerfile" or "Node.js" template
3. Set environment variables
4. Deploy

**Option B: Via SSH**
```bash
# SSH into your Coolify VPS
ssh root@your-vps-ip

# Clone/update repository
cd /var/www/claude-relay-service
git pull origin main

# Install dependencies
npm install

# Initialize PI agent
node init-telegram.js

# Set up cron jobs (if needed)
crontab -e
# Add: 0 */2 * * * cd /var/www/claude-relay-service && node pi-agent/cron-runner.js
```

### 5. Start PI Agent

```bash
# Development mode
npm run pi:dev

# Production mode (with PM2)
pm2 start ecosystem.config.js --only pi-agent

# Check status
pm2 status
pm2 logs pi-agent
```

## File Structure

```
claude-relay-service/
├── openclaw.json           # Main agent configuration
├── cron-schedule.json      # 2-hour block async jobs
├── init-telegram.js        # Telegram initialization script
├── pi-persona.md           # Agent personality & behavior
└── PI-AGENT-SETUP.md       # This file
```

## Configuration Files Explained

### `openclaw.json`
- Channel integrations (Telegram, Webhook, Email)
- Skill definitions (monitoring, self-healing, security)
- Monitored projects with health check configs
- Alert thresholds and proactive rules

### `cron-schedule.json`
- 12 two-hour blocks (00:00-02:00, 02:00-04:00, etc.)
- Async job definitions with timeouts and retries
- Maintenance windows (low/high traffic)
- Notification rules (success/failure/retry)

### `pi-persona.md`
- Agent personality and decision framework
- Communication style and message format
- Self-healing triggers and escalation rules
- Monitoring focus per project

## PI Agent Behavior

### Proactive Self-Healing
- Service unresponsive → Auto-restart (3 attempts)
- High memory (>85%) → Clear cache, restart if needed
- Stale connections → Connection pool reset
- High disk (>80%) → Log cleanup

### Alert Levels
- 🔴 **Critical**: Immediate notification (service down, security breach)
- 🟡 **Warning**: Batched every 30 min (performance, high resource usage)
- 🟢 **Info**: Daily digest at 06:00 UTC (deployments, maintenance)

### Communication Style
- Max 280 characters (when possible)
- Bullet points over paragraphs
- One emoji per message
- Actionable error messages
- Group by project

### Async Maintenance Blocks
- **00:00-06:00**: Deep maintenance (backups, log rotation)
- **06:00-12:00**: Health checks, security scans
- **12:00-18:00**: Quick checks only (peak hours)
- **18:00-24:00**: Analytics, cost optimization

## Monitoring & Logs

### View PI Agent Logs
```bash
# PM2 logs
pm2 logs pi-agent

# Log file
tail -f logs/pi-agent.log

# System journal
journalctl -u openclaw-pi -f
```

### Check Health Status
```bash
# Manual health check
npm run pi:health

# View metrics
npm run pi:metrics

# Test notifications
npm run pi:test-alert
```

## Troubleshooting

### Telegram Not Receiving Messages
1. Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
2. Test manually: `node init-telegram.js`
3. Check bot is not blocked by Telegram
4. Verify bot has permission to send messages

### Health Checks Failing
1. Check project URLs are accessible from VPS
2. Verify health endpoints exist (add `/health` routes if needed)
3. Check firewall rules and network connectivity
4. Review logs: `pm2 logs pi-agent --lines 100`

### Cron Jobs Not Running
1. Verify cron schedule syntax
2. Check timezone settings (UTC)
3. Ensure node path is correct in crontab
4. Test manually: `node pi-agent/cron-runner.js block-00-02`

### High Memory Usage
1. PI agent auto-clears cache at 85%
2. Manually restart: `pm2 restart pi-agent`
3. Check for memory leaks in logs
4. Adjust `maxConcurrent` in cron-schedule.json

## Security Best Practices

1. **Never commit** `.env` file with real tokens
2. **Rotate** `TELEGRAM_BOT_TOKEN` if compromised
3. **Limit** bot permissions (only send messages needed)
4. **Use** read-only API keys for health checks
5. **Enable** 2FA on Telegram account
6. **Monitor** for unauthorized access attempts

## Scaling & Performance

### Horizontal Scaling
- Deploy multiple PI agents with different `agentName`
- Each monitors subset of projects
- Use Redis for coordination

### Vertical Scaling
- Increase `maxConcurrent` jobs in cron-schedule.json
- Adjust `samplingInterval` for monitoring
- Add more cron blocks if needed

### Performance Tips
- Use async blocks during low traffic
- Batch notifications when possible
- Cache health check results (30s TTL)
- Compress logs older than 7 days

## Maintenance

### Daily (Automatic)
- Health checks every 2 min (critical services)
- Log rotation
- Cache cleanup

### Weekly (Manual)
- Review alert accuracy
- Check for false positives
- Optimize thresholds
- Review cost reports

### Monthly (Manual)
- Update dependencies
- Security vulnerability scan
- Backup verification
- Performance review

## Support & Feedback

PI agent learns from incidents. Weekly self-audits happen Sundays at 22:00 UTC.

**To improve behavior:**
1. Review `pi-persona.md` for decision framework
2. Adjust thresholds in `openclaw.json`
3. Modify cron schedule in `cron-schedule.json`
4. Restart agent: `pm2 restart pi-agent`

## Philosophy

> **Simple code that scales infinitely. Developer/User experience above all. Autonomous, agile, proactive. Zero over-engineering.**

The PI agent is designed to be infrastructure that cares: monitors relentlessly, heals automatically, and communicates proactively. It scales horizontally, fails gracefully, and learns constantly.

---

*Built with OpenClaw PI Agent Framework v1.0.0*
*Deployed on Coolify VPS*
*Environment: production*
