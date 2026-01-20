# Migration README - Quick Start Guide

## Quick Summary

This document provides quick commands to migrate from claude-relay-service to sub2api with all your preferences:

- ✅ Usage statistics: YES
- ✅ OAuth tokens: YES
- ✅ Rollout: FULL cutover
- ✅ CI/CD: Automated on main-v2

---

## Pre-Migration Checklist

### 1. Backup Current System

```bash
# Backup Redis data
redis-cli --rdb /tmp/claude-relay-backup-$(date +%Y%m%d-%H%M%S).rdb

# Export current API key count
redis-cli --scan --pattern "api_key:*" | wc -l

# Note your ENCRYPTION_KEY
cat .env | grep ENCRYPTION_KEY
```

### 2. Set Up PostgreSQL

```bash
# Install PostgreSQL 15+ (Ubuntu/Debian)
sudo apt update
sudo apt install -y postgresql-15 postgresql-contrib-15

# Install PostgreSQL 15+ (CentOS/RHEL)
sudo yum install -y postgresql15-server postgresql15-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE sub2api;
CREATE USER sub2api WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE sub2api TO sub2api;
\q
```

### 3. Clone sub2api and Create Branch

```bash
# Clone sub2api (if not already done)
cd analysis_sub2api
git remote add upstream https://github.com/Wei-Shaw/sub2api.git

# Create compatibility branch
git checkout -b compatibility-layer

# Create deployment branch
git checkout -b main-v2
```

---

## Migration Steps

### Step 1: Add Hash Mapping Schema

**File**: `analysis_sub2api/backend/ent/schema/api_key_hash_mapping.go`

This file has already been created. Generate Ent schema:

```bash
cd analysis_sub2api/backend

# Generate Ent code
go generate ./ent

# This creates migration files in: ./migrations/
```

### Step 2: Run Database Migrations

```bash
cd analysis_sub2api/backend

# Run all migrations
./sub2api migrate up

# Verify tables created
psql -h localhost -U sub2api -d sub2api -c "\dt"
```

Expected tables:

- `api_keys` - API keys (plaintext)
- `api_key_hash_mappings` - Legacy hash mappings
- `users` - User accounts
- `accounts` - Account configurations
- `usage_logs` - Usage statistics

### Step 3: Configure Environment Variables

```bash
# Copy environment template
cp deploy/.env.example deploy/.env.local

# Edit with your values
nano deploy/.env.local
```

Required variables:

```bash
# PostgreSQL
DATABASE_URL="postgresql://sub2api:your_password@localhost:5432/sub2api"

# Redis (same as current system)
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=

# Legacy compatibility
DEFAULT_API_KEY_PREFIX="cr_"
ENCRYPTION_KEY="your-32-char-hex-key-from-current-system"

# Security
JWT_SECRET="generate-new-secure-random-string-32+"

# Server
SERVER_PORT=8080
SERVER_HOST="0.0.0.0"

# Simple mode (optional)
# RUN_MODE=simple
# SIMPLE_MODE_CONFIRM=true
```

### Step 4: Run Migration Script

```bash
# Set environment variables
export DATABASE_URL="postgresql://sub2api:password@localhost:5432/sub2api"
export ENCRYPTION_KEY="your-32-char-hex-key"

# Run migration
node scripts/migrate-complete.js
```

Expected output:

```
╔══════════════════════════════════════════════════╗
║     CLAUDE RELAY SERVICE → SUB2API MIGRATION        ║
╚══════════════════════════════════════════════════╝

USER PREFERENCES:
  ✓ Usage statistics: YES
  ✓ OAuth tokens: YES
  ✓ Rollout: FULL cutover
  ✓ CI/CD: Automated on main-v2

=== Migrating API Keys ===
  ✓ Migrated: API Key 1 (cr_xxx...)
  ✓ Migrated: API Key 2 (cr_xxx...)
[...]
✅ API Keys: 25/25 migrated

=== Migrating Users ===
  ✓ Migrated: user1@example.com
  ✓ Migrated: user2@example.com
[...]
✅ Users: 10/10 migrated

=== Migrating Accounts ===
--- CLAUDE Accounts ---
  ✓ Decrypted accessToken
  ✓ Migrated: Claude Account 1
[...]
✅ Total Accounts: 5 migrated

=== Migrating Usage Statistics ===
Found 523 daily usage records
  Progress: 100/523 records
  Progress: 200/523 records
[...]
✅ Usage Stats: 523/523 records migrated

=== Verifying Migration ===
✓ API Keys: 25
✓ Users: 10
✓ Hash Mappings: 25
✓ Usage Logs: 523
✓ Tables: 12

╔════════════════════════════════════════════════════╗
║           ✅ MIGRATION COMPLETED SUCCESSFULLY!          ║
╚════════════════════════════════════════════════╝

Duration: 45.32 seconds

NEXT STEPS:
1. Verify API keys work with existing clients
2. Check frontend login functionality
3. Review migrated usage statistics
4. Test OAuth token decryption
5. Deploy to Protec via CI/CD
```

### Step 5: Start sub2api

```bash
cd analysis_sub2api/backend

# Run with embedded frontend
./sub2api

# Or in development mode
go run ./cmd/server

# Or using Docker
docker-compose up -d
```

### Step 6: Verify Migration

#### Test API Key Authentication

```bash
# Test with legacy cr_ key
curl -H "X-API-Key: cr_your-existing-key" \
     http://localhost:8080/v1/models

# Expected: HTTP 200 with model list
```

#### Test Frontend Access

```bash
# Open in browser
open http://localhost:8080

# Log in with existing user credentials
# Verify dashboard shows correct usage statistics
```

#### Test API Endpoints

```bash
# Claude endpoint
curl http://localhost:8080/v1/models

# Gemini endpoint
curl http://localhost:8080/v1beta/models

# OpenAI endpoint
curl http://localhost:8080/openai/v1/chat/completions

# Health check
curl http://localhost:8080/health
```

#### Verify OAuth Tokens

```bash
# Check logs for decryption errors
tail -f logs/error.log | grep -i "decrypt"

# Test account functionality by making API calls
curl -H "X-API-Key: cr_your-key" \
     -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}' \
     http://localhost:8080/v1/messages
```

---

## Deployment to Protec

### 1. Configure GitHub Secrets

Go to: `https://github.com/YOUR-ORG/claude-relay-service/settings/secrets`

Add these secrets:

| Secret              | Value                 | Description                     |
| ------------------- | --------------------- | ------------------------------- |
| `PROTEC_URL`        | `protec.example.com`  | Your Protec server URL          |
| `PROTEC_USERNAME`   | `deploy`              | SSH username                    |
| `PROTEC_KEY`        | `<SSH-PRIVATE-KEY>`   | SSH private key for deployment  |
| `POSTGRES_PASSWORD` | `your_password`       | Database password               |
| `JWT_SECRET`        | `your-32-char-secret` | JWT signing secret              |
| `ENCRYPTION_KEY`    | `your-32-char-hex`    | Legacy encryption key           |
| `SLACK_WEBHOOK_URL` | (Optional)            | Slack webhook for notifications |

### 2. Push to main-v2

```bash
cd analysis_sub2api

# Merge compatibility changes to deployment branch
git checkout main-v2
git merge compatibility-layer -m "Add migration compatibility layer"

# Push to trigger CI/CD
git push origin main-v2
```

### 3. Monitor Deployment

```bash
# Watch CI/CD workflow
# https://github.com/YOUR-ORG/claude-relay-service/actions

# Expected workflow: "Deploy to Protec"
# Build time: ~5-10 minutes
# Deployment time: ~2-5 minutes
```

---

## Rollback Procedure

If migration fails or issues arise:

### Immediate Rollback (< 5 minutes)

```bash
# 1. Stop sub2api
docker stop sub2api
# or kill process
pkill -f sub2api

# 2. Restore Redis backup
redis-cli --rdb /tmp/claude-relay-backup-*.rdb
redis-cli SHUTDOWN
redis-server

# 3. Restart claude-relay-service
cd /path/to/claude-relay-service
npm run service:start:daemon

# 4. Verify
npm run service:status
curl http://localhost:3000/health
```

### Partial Rollback (< 30 minutes)

Keep sub2api running and fix specific issues:

```bash
# 1. Check logs
tail -f logs/error.log

# 2. Re-run migration script (idempotent)
node scripts/migrate-complete.js

# 3. Verify specific data
psql -h localhost -U sub2api -d sub2api -c "SELECT COUNT(*) FROM api_key_hash_mappings;"
```

---

## Troubleshooting

### Common Issues

#### 1. Migration Fails

**Problem**: Migration script exits with error

**Solution**:

```bash
# Check ENCRYPTION_KEY is correct
echo $ENCRYPTION_KEY | wc -c  # Should be 32 characters

# Check database connection
psql -h localhost -U sub2api -d sub2api -c "SELECT 1;"

# Check Redis connection
redis-cli ping
```

#### 2. API Keys Don't Work

**Problem**: `cr_` keys return 401 unauthorized

**Solution**:

```bash
# Check hash mappings exist
psql -h localhost -U sub2api -d sub2api -c "SELECT COUNT(*) FROM api_key_hash_mappings;"

# Check API key prefix in config
psql -h localhost -U sub2api -d sub2api -c "SELECT api_key_prefix FROM settings;" -- assuming settings table

# Or check .env
grep DEFAULT_API_KEY_PREFIX .env.local
```

#### 3. OAuth Tokens Not Decrypted

**Problem**: Accounts show encrypted tokens in database

**Solution**:

```bash
# Verify ENCRYPTION_KEY matches original system
# It should be EXACT same 32-char string from claude-relay-service .env

# Re-run migration
node scripts/migrate-complete.js

# Manual verification
psql -h localhost -U sub2api -d sub2api -c "SELECT access_token FROM claude_accounts WHERE access_token LIKE '%:%' LIMIT 1;"
```

#### 4. CI/CD Fails

**Problem**: GitHub Actions workflow fails

**Solution**:

```bash
# Check workflow logs on GitHub
# https://github.com/YOUR-ORG/claude-relay-service/actions/workflows/deploy-to-protec

# Common causes:
# - Missing secrets
# - SSH key issues
# - Database connection failures

# Manually deploy to Protec
docker build -t protec-sub2api:latest .
docker save protec-sub2api:latest | ssh $PROTEC_USERNAME@$PROTEC_URL "docker load"
```

---

## Success Checklist

Migration is complete when:

- [ ] API keys authenticate with `cr_` prefix
- [ ] Users can log in with existing credentials
- [ ] Usage statistics visible in dashboard
- [ ] OAuth tokens work (accounts make API calls)
- [ ] All API endpoints respond correctly
- [ ] Health check returns 200 OK
- [ ] CI/CD successfully deploys to Protec
- [ ] All Chinese text translated to English

---

## Additional Resources

- **Full Migration Strategy**: `MIGRATION_STRATEGY.md`
- **Quick Start Guide**: `MIGRATION_QUICKSTART.md`
- **Complete Plan**: `FULL_MIGRATION_PLAN.md`
- **Translation Guide**: `TRANSLATION_GUIDE.md`
- **Migration Script**: `scripts/migrate-complete.js`

---

## Support

If you encounter issues:

1. **Check logs**: `analysis_sub2api/backend/logs/`
2. **Verify environment**: All variables in `.env.local` or `config.yaml`
3. **Test migration script**: Run with verbose logging
4. **Database issues**: Check PostgreSQL logs
5. **Redis issues**: Verify Redis is running and accessible

---

**Last Updated**: January 19, 2026

**Estimated Total Time**: 2-4 hours for execution, plus testing and verification
