# OpenClaw PI Agent - Quick Reference Card

## Setup Commands

```bash
# 1. Add Telegram credentials to .env
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id

# 2. Test Telegram connection
npm run pi:init

# 3. Deploy to Coolify VPS
chmod +x DEPLOY-PI-AGENT.sh
sudo ./DEPLOY-PI-AGENT.sh

# 4. Test alert
npm run pi:test-alert
```

## Daily Operations

```bash
# Check PI agent status
pm2 status openclaw-pi

# View logs
pm2 logs openclaw-pi

# Restart agent
pm2 restart openclaw-pi

# Health check all projects
npm run pi:health

# View metrics
npm run pi:metrics

# Send test notification
npm run pi:test-alert
```

## File Structure

```
claude-relay-service/
├── openclaw.json              # Main config (channels, skills, projects)
├── cron-schedule.json         # 2-hour block async jobs
├── pi-persona.md              # Agent personality & behavior
├── init-telegram.js           # Telegram setup script
├── DEPLOY-PI-AGENT.sh         # Deployment script
├── PI-AGENT-SETUP.md          # Full documentation
└── pi-agent/
    ├── index.js               # Entry point
    ├── health-check.js        # Manual health checks
    ├── metrics.js             # Metrics display
    ├── test-alert.js          # Test notifications
    ├── core/
    │   ├── PIAgent.js         # Main orchestrator
    │   ├── Monitor.js         # Health checks & metrics
    │   ├── SelfHealer.js      # Auto-recovery actions
    │   └── CronScheduler.js   # Async job execution
    ├── channels/
    │   └── TelegramNotifier.js # Telegram integration
    └── utils/
        ├── logger.js          # Winston logging
        └── helpers.js         # Utility functions
```

## Alert Levels

| Level | Emoji | When | Example |
|-------|-------|------|---------|
| Critical | 🔴 | Immediate | Service down, security breach |
| Warning | 🟡 | Batched (30min) | High latency, elevated errors |
| Info | 🟢 | Daily digest (06:00) | Deployments, maintenance |

## Monitored Projects

| Project | Check Interval | Critical |
|---------|---------------|----------|
| claude-relay-service | 2 min | ✅ |
| sticky-covers | 5 min | |
| qrapidito | 5 min | |
| chatea-la | 5 min | |

## Self-Healing Actions

- Service unresponsive → Auto-restart (3 attempts)
- High memory (>85%) → Clear cache, restart
- Stale connections → Connection pool reset
- High disk (>80%) → Log cleanup, temp removal
- Redis failure → Retry, restart service

## Cron Schedule (2-Hour Blocks)

- **00:00-02:00**: Deep health checks, log cleanup
- **02:00-04:00**: Database backups, Redis cleanup
- **04:00-06:00**: Cache warmup, dependency checks
- **06:00-08:00**: Morning health report
- **08:00-10:00**: Peak hours monitoring
- **10:00-12:00**: Performance snapshots
- **12:00-14:00**: Midday optimization
- **14:00-16:00**: Security scans
- **16:00-18:00**: Usage analytics
- **18:00-20:00**: Evening health check
- **20:00-22:00**: Cost optimization
- **22:00-00:00**: Nightly maintenance

## Troubleshooting

**Telegram not working?**
```bash
# Verify credentials
node init-telegram.js
```

**Health checks failing?**
```bash
# Manual check
npm run pi:health

# Verify URLs are accessible
curl -I https://your-relay-service.com/health
```

**High memory usage?**
```bash
# Check PM2 stats
pm2 show openclaw-pi

# Restart if needed
pm2 restart openclaw-pi
```

**View metrics?**
```bash
npm run pi:metrics
```

## Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `TELEGRAM_CHAT_ID` - From getUpdates API

Optional:
- `WEBHOOK_ENDPOINT` - Additional notifications
- `PI_LOG_LEVEL` - debug|info|warn|error
- `PI_METRICS_RETENTION` - Days to keep (default: 30)

## Philosophy

> Simple code that scales infinitely. Developer/User experience above all. Autonomous, agile, proactive. Zero over-engineering.

---

*Full documentation: PI-AGENT-SETUP.md*
*Agent persona: pi-persona.md*
