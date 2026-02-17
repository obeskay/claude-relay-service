# OpenClaw PI Agent - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         COOLIFY VPS                              │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    PM2 Process Manager                     │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │            PI Agent (openclaw-pi)                   │  │  │
│  │  │                                                       │  │  │
│  │  │  ┌───────────────────────────────────���─────────┐    │  │  │
│  │  │  │         PIAgent (Orchestrator)              │    │  │  │
│  │  │  │                                             │    │  │  │
│  │  │  │  ┌─────────┐  ┌────────────┐  ┌──────────┐ │    │  │  │
│  │  │  │  │ Monitor │  │ SelfHealer │  │Scheduler │ │    │  │  │
│  │  │  │  └────┬────┘  └──────┬─────┘  └────┬─────┘ │    │  │  │
│  │  │  │       │              │             │        │    │  │  │
│  │  │  │       │              │             │        │    │  │  │
│  │  │  │  ┌────▼────┐    ┌────▼─────┐  ┌────▼─────┐  │    │  │  │
│  │  │  │  │Logger   │    │Commands  │  │Cron Jobs │  │    │  │  │
│  │  │  │  └─────────┘    └──────────┘  └──────────┘  │    │  │  │
│  │  │  └─────────────────────────────────────────────┘    │  │  │
│  │  │                       │                             │  │  │
│  │  │              ┌────────▼────────┐                    │  │  │
│  │  │              │TelegramNotifier │                    │  │  │
│  │  │              └────────┬────────┘                    │  │  │
│  │  └───────────────────────┼─────────────────────────────┘  │  │
│  └──────────────────────────┼───────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Telegram API   │
                    │  (@BotFather)   │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Your Telegram  │
                    │     (Mobile)    │
                    └─────────────────┘
```

## Component Details

### 1. PIAgent (Orchestrator)
- **Purpose**: Main coordinator for all PI agent operations
- **Responsibilities**:
  - Initialize all components
  - Manage graceful shutdown
  - Coordinate between Monitor, SelfHealer, and Scheduler
  - Send startup/shutdown notifications

### 2. Monitor
- **Purpose**: Continuous health checking and metrics collection
- **Features**:
  - 2-minute checks for critical services
  - 5-minute checks for standard services
  - Consecutive failure tracking
  - Response time monitoring
  - Performance threshold alerts
- **Alerts**:
  - Service down (3 consecutive failures)
  - High response time (>2000ms)
  - Degraded health status

### 3. SelfHealer
- **Purpose**: Automatic recovery from common issues
- **Actions**:
  - Restart failed services (PM2)
  - Clear stale connections (Redis FLUSHDB)
  - Rotate logs (logrotate)
  - Cleanup cache
  - Restart overloaded workers
- **Strategy**:
  - 3 automatic retry attempts
  - Escalate to human on 4th failure
  - Cooldown period between attempts
  - Reset success count on successful heal

### 4. CronScheduler
- **Purpose**: Execute maintenance tasks in 2-hour blocks
- **Schedule**:
  - 12 blocks (00:00-02:00, 02:00-04:00, etc.)
  - Async job execution
  - 5 concurrent max
  - 3 retry attempts with exponential backoff
- **Job Types**:
  - Health checks (deep, quick)
  - Backups (database)
  - Security scans (dependencies, vulnerabilities)
  - Performance (cache warmup, index optimization)
  - Maintenance (log rotation, cleanup)
  - Analytics (usage reports, resource usage)

### 5. TelegramNotifier
- **Purpose**: Proactive notifications via Telegram
- **Message Types**:
  - 🔴 Critical alerts (immediate)
  - 🟡 Warnings (batched every 30min)
  - 🟢 Info (daily digest at 06:00 UTC)
  - ✅ Success confirmations
  - 📊 Daily reports
- **Format**:
  - Max 280 characters
  - Bullet points
  - One emoji per message
  - Actionable advice

## Data Flow

### Health Check Flow
```
1. Cron triggers health check (2/5 min interval)
   ↓
2. Monitor sends HTTP request to health endpoint
   ↓
3. Response received:
   - Success → Reset failure count, store metrics
   - Failure → Increment failure count
   ↓
4. If failures >= threshold:
   - Send alert via Telegram
   - Trigger SelfHealer
   ↓
5. SelfHealer determines action:
   - Execute auto-recovery (3 attempts max)
   - On success: Notify recovery
   - On 4th failure: Escalate to human
```

### Cron Job Flow
```
1. CronScheduler loads schedule from cron-schedule.json
   ↓
2. Schedule jobs based on cron expression
   ↓
3. When job triggers:
   - Check if already running (skip if active)
   - Mark as active
   - Execute task
   - Store result
   ↓
4. On completion:
   - Send notification (if configured)
   - Mark as inactive
   - Log metrics
```

### Alert Flow
```
1. Event detected (health failure, high latency, etc.)
   ↓
2. Component determines severity:
   - Critical (immediate)
   - Warning (batch)
   - Info (digest)
   ↓
3. TelegramNotifier formats message:
   - Add emoji based on severity
   - Keep under 280 chars
   - Include actionable steps
   ↓
4. Send via Telegram Bot API
   ↓
5. Log delivery status
```

## File Structure

```
pi-agent/
├── index.js                    # Entry point
├── health-check.js             # Manual health check tool
├── metrics.js                  # Metrics display tool
├── test-alert.js               # Test notification tool
├── core/
│   ├── PIAgent.js             # Main orchestrator
│   ├── Monitor.js             # Health checks
│   ├── SelfHealer.js          # Auto-recovery
│   └── CronScheduler.js       # Async jobs
├── channels/
│   └── TelegramNotifier.js    # Telegram integration
└── utils/
    ├── logger.js              # Winston logging
    └── helpers.js             # Utility functions

Configuration:
├── openclaw.json              # Main config
├── cron-schedule.json         # Job schedule
├── pi-persona.md              # Agent personality
├── init-telegram.js           # Setup script
└── DEPLOY-PI-AGENT.sh         # Deploy script

State (gitignored):
├── .openclaw-state.json       # Agent state
└── .openclaw-metrics/         # Metrics storage
```

## Monitoring Targets

### claude-relay-service (Critical)
- **Health**: `/health` endpoint
- **Interval**: 2 minutes
- **Metrics**:
  - API response time (p50, p95, p99)
  - Error rate by endpoint
  - Redis connection health
  - Token refresh success rate
- **Alerts**: downtime, auth failures, 529 errors

### sticky-covers
- **Health**: `/api/health` endpoint
- **Interval**: 5 minutes
- **Metrics**: Build success, API errors, load time
- **Alerts**: Build failures, downtime

### qrapidito
- **Health**: `/health` endpoint
- **Interval**: 5 minutes
- **Metrics**: Queue depth, processing lag, DB queries
- **Alerts**: Database errors, queue backlog

### chatea-la
- **Health**: `/api/health` endpoint
- **Interval**: 5 minutes
- **Metrics**: WebSocket stability, delivery rate, latency
- **Alerts**: WebSocket failures, high latency

## Deployment Process

### 1. Setup (Local)
```bash
# Get Telegram credentials
# 1. Chat with @BotFather → /newbot
# 2. Copy bot token
# 3. Send message to bot
# 4. Visit: https://api.telegram.org/bot<TOKEN>/getUpdates
# 5. Copy chat_id

# Add to .env
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
RELAY_SERVICE_URL=https://...
```

### 2. Deploy (VPS)
```bash
# SSH into VPS
ssh root@vps-ip

# Navigate to project
cd /var/www/claude-relay-service

# Run deployment script
sudo ./DEPLOY-PI-AGENT.sh

# Verify
pm2 status openclaw-pi
pm2 logs openclaw-pi
```

### 3. Verify
```bash
# Test notification
npm run pi:test-alert

# Manual health check
npm run pi:health

# View metrics
npm run pi:metrics
```

## Scaling Strategy

### Horizontal Scaling
- Deploy multiple PI agents
- Each monitors subset of projects
- Coordinate via Redis
- No single point of failure

### Vertical Scaling
- Increase `maxConcurrent` in cron-schedule.json
- Adjust `samplingInterval` for monitoring
- Add more cron blocks if needed
- Scale memory limits in PM2

## Security Considerations

1. **Credentials**
   - Never commit `.env` file
   - Use environment variables
   - Rotate `TELEGRAM_BOT_TOKEN` quarterly

2. **API Access**
   - Health endpoints should be read-only
   - Use separate API keys for monitoring
   - Implement rate limiting

3. **Data Protection**
   - Encrypt sensitive metrics
   - Retain logs for 30 days max
   - Sanitize error messages

4. **Access Control**
   - Limit bot permissions (send messages only)
   - Use separate chat ID for alerts
   - Enable 2FA on Telegram account

## Performance Optimization

1. **Async Operations**
   - Non-blocking health checks
   - Parallel project monitoring
   - Queue-based cron execution

2. **Resource Management**
   - Max memory limit: 500MB
   - Auto-restart on memory leak
   - Log rotation (5MB files, max 10)

3. **Caching**
   - Cache health check results (30s TTL)
   - Store metrics in memory
   - Batch notifications

## Troubleshooting

### Issue: PI Agent not starting
- Check PM2 logs: `pm2 logs openclaw-pi`
- Verify environment variables
- Check Node.js version (>=18.0.0)

### Issue: Telegram notifications not received
- Verify bot token and chat ID
- Test: `npm run pi:test-alert`
- Check bot is not blocked

### Issue: High memory usage
- Check metrics history size
- Reduce retention period
- Restart agent: `pm2 restart openclaw-pi`

### Issue: Cron jobs not running
- Verify cron syntax
- Check timezone (UTC)
- Test manually: `node pi-agent/cron-runner.js`

---

*Built with simple code that scales infinitely*
*Autonomous, agile, proactive - Zero over-engineering*
