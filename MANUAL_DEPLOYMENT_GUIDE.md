# Manual Deployment Guide - claude-relay-service → sub2api on Protec

## ⚠️ IMPORTANT - Automation Not Available

Playwright browser automation is currently unavailable as an MCP tool. **Manual deployment is required.**

---

## Prerequisites

### 1. Access to Protec Server

You need:

- SSH access to: `admin.cloud.obeskay.com`
- Username and password for SSH and PostgreSQL
- Database password for `sub2api` user

**Request access if you don't have it**:

1. Contact: support@obeskay.com
2. Request:
   - SSH access credentials
   - Database superuser access
   - Application deployment permissions

---

## Phase 1: Setup PostgreSQL (30-60 minutes)

### 1.1 Install PostgreSQL

**On Protec server (Ubuntu/Debian)**:

```bash
sudo apt update
sudo apt install -y postgresql-15 postgresql-contrib-15
```

**On Protec server (CentOS/RHEL)**:

```bash
sudo yum install -y postgresql15-server postgresql15-contrib
```

### 1.2 Create Database and User

```bash
# Login as postgres superuser
sudo -u postgres psql

# Create database
CREATE DATABASE sub2api;

# Create user (replace 'your_username' with your actual username)
CREATE USER your_username WITH PASSWORD 'your_secure_password';

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE sub2api TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;

# Exit psql
\q
```

### 1.3 Verify Database

```bash
# Test connection
psql -h localhost -U your_username -d sub2api -c "SELECT 1;"

# Show databases
\l
```

---

## Phase 2: Configure Environment Variables (5 minutes)

### 2.1 Create .env.local File

**On Protec server**, create file: `/home/your_username/sub2api/.env.local`

```bash
# PostgreSQL connection
DATABASE_URL="postgresql://your_username:your_password@localhost:5432/sub2api"

# Legacy compatibility (YOUR ENCRYPTION_KEY from claude-relay-service .env)
ENCRYPTION_KEY="your-32-char-hex-key-exact-copy-from-existing-system"

# API key prefix (your preference)
DEFAULT_API_KEY_PREFIX="cr_"

# Redis connection (same as current system)
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT secret (generate new secure string)
JWT_SECRET="generate-new-32-char-random-string"
```

**Copy to deployment directory**:

```bash
cd /home/your_username/sub2api
cp .env.example .env.local
nano .env.local
# Paste all variables above and save
```

---

## Phase 3: Apply Migration (10-15 minutes)

### 3.1 Transfer Migration Files

**From your local machine to Protec**:

```bash
# Upload SQL migration file
scp 035_add_api_key_hash_mappings.sql your_username@protec:/home/your_username/sub2api/migrations/

# Upload migration script
scp scripts/migrate-complete.js your_username@protec:/home/your_username/sub2api/scripts/

# Verify files exist
ssh your_username@protec ls -la /home/your_username/sub2api/migrations/
ssh your_username@protec ls -la /home/your_username/sub2api/scripts/
```

### 3.2 Generate Ent Schema (5 minutes)

**On Protec server**:

```bash
cd /home/your_username/sub2api/backend

# Generate Ent schema (including api_key_hash_mapping)
go generate ./ent

# Verify files created
ls -la ent/migrate/migrations/
ls -la ent/api_key_hash_mapping.go
```

**Expected output**: Migration files created successfully

---

### 3.3 Apply SQL Migration (5 minutes)

**On Protec server**:

```bash
cd /home/your_username/sub2api

# Apply migrations (runs 035_add_api_key_hash_mappings.sql automatically)
# This creates the api_key_hash_mappings table
./sub2api migrate up

# Verify table created
psql -h localhost -U your_username -d sub2api -c "SELECT COUNT(*) FROM api_key_hash_mappings;"

# Expected: Table with X rows (X = number of api keys you have)
```

---

## Phase 4: Execute Migration Script (10-20 minutes)

### 4.1 Backup Current System Data

**From your current system**:

```bash
# Backup Redis
redis-cli --rdb /tmp/claude-relay-backup-$(date +%Y%m%d-%H%M%S).rdb

# Stop claude-relay-service
npm run service:stop

# Count API keys
redis-cli --scan --pattern "api_key_hash:*" | wc -l

# Note your ENCRYPTION_KEY for the migration script
cat .env | grep ENCRYPTION_KEY
```

### 4.2 Run Migration Script

**On Protec server**:

```bash
cd /home/your_username/sub2api

# Set environment for migration
export DATABASE_URL="postgresql://your_username:your_password@localhost:5432/sub2api"
export ENCRYPTION_KEY="your-32-char-hex-key-exact"
export REDIS_HOST=localhost
export REDIS_PORT=6379

# Run migration (this will stop/start sub2api)
node scripts/migrate-complete.js
```

**Expected output**:

```
╔════════════════════════════════════════╗
║     CLAUDE RELAY SERVICE → SUB2API MIGRATION        ║
╚══════════════════════════════════════════╝

USER PREFERENCES:
  ✓ Usage statistics: YES
  ✓ OAuth tokens: YES
  ✓ Rollout: FULL cutover
  ✓ CI/CD: Automated on main-v2

=== Migrating API Keys ===
  ✓ Migrated: Your First API Key Name (cr_xxx...)
[... all your keys ...]
✅ API Keys: 25/25 migrated

=== Migrating Users ===
  ✓ Migrated: user1@example.com
[... all your users ...]
✅ Users: 10/10 migrated

=== Migrating Accounts ===
--- CLAUDE Accounts ---
  ✓ Decrypted accessToken
  ✓ Migrated: Claude Account 1
[...]

=== Migrating Usage Statistics ===
Found 523 daily usage records
  Progress: 523/523 records
[... progress ...]
✅ Usage Stats: 523/523 records migrated

=== Verifying Migration ===
✓ API Keys: 25
✓ Users: 10
✓ Hash Mappings: 25
✓ Usage Logs: 523

╔════════════════════════════════════════════════════╝

Duration: 45.32 seconds

NEXT STEPS:
1. Verify API keys work with existing clients
2. Check frontend login functionality
3. Review migrated usage statistics
4. Test OAuth token decryption
5. Deploy to Protec via CI/CD
```

---

## Phase 5: Start sub2api (5 minutes)

### 5.1 Update Configuration

**Edit `.env.local`**:

```bash
cd /home/your_username/sub2api

# Add these lines if not present
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
SERVER_MODE=production
```

### 5.2 Build Backend

**On Protec server**:

```bash
cd /home/your_username/sub2api/backend

# Build
go build -o sub2api

# Or with tags for embedded frontend
go build -tags embed -o sub2api
```

### 5.3 Start Service

```bash
# Development mode (foreground)
./sub2api

# Or production mode (background with logs)
nohup ./sub2api > /dev/null 2>&1 &

# Or using systemd
sudo systemctl enable sub2api
sudo systemctl start sub2api
```

### 5.4 Verify Service

```bash
# Check if running
ps aux | grep sub2api

# Check logs
tail -f logs/app.log | grep "Server started"

# Health check
curl http://localhost:8080/health

# Models endpoint
curl http://localhost:8080/v1/models
```

**Expected response**:

```json
{
  "status": "healthy",
  "version": "x.y.z",
  "components": {
    "redis": "connected",
    "database": "connected",
    "storage": "available"
  },
  "models": [... model list ...]
}
```

---

## Phase 6: Verification (5-10 minutes)

### 6.1 Test API Key Authentication

**From your local machine**:

```bash
# Test with your existing cr_ prefixed API key
curl -H "X-API-Key: cr_your-existing-key" \
     http://protec.cloud.obeskay.com/v1/models

# Expected: HTTP 200 with model list
```

### 6.2 Test User Login

1. Access: http://protec.cloud.obeskay.com
2. Log in with existing user credentials
3. Navigate to admin panel
4. Verify dashboard shows correct usage statistics

### 6.3 Test API Endpoints

```bash
# Claude endpoint
curl http://protec.cloud.obeskay.com/v1/models

# Gemini endpoint
curl http://protec.cloud.obeskay.com/v1beta/models

# OpenAI endpoint
curl http://protec.cloud.obeskay.com/openai/v1/chat/completions

# Health check
curl http://protec.cloud.obeskay.com/health
```

**Verify all return HTTP 200 with expected data**

### 6.4 Verify OAuth Tokens

Check logs:

```bash
ssh your_username@protec tail -f logs/error.log | grep -i "decrypt\|token\|oauth"
```

Should see successful OAuth decryptions

---

## Phase 7: Monitor and Troubleshooting

### 7.1 Check Logs Regularly

```bash
ssh your_username@protec
# Recent errors
tail -n 50 logs/error.log

# Application logs
tail -n 50 logs/app.log

# Migration completion check
grep "MIGRATION COMPLETED SUCCESSFULLY" logs/app.log
```

### 7.2 Check Database State

```bash
# On Protec server
psql -h localhost -U your_username -d sub2api -c "\dn" 2>&1 | head -10

# Count API keys
psql -h localhost -U your_username -d sub2api -c "SELECT COUNT(*) FROM api_key_hash_mappings;"
psql -h localhost -U your_username -d sub2api -c "SELECT COUNT(*) FROM api_keys;"

# Count usage logs
psql -h localhost -U your_username -d sub2api -c "SELECT COUNT(*) FROM usage_logs;"
```

### 7.3 Restart if Needed

```bash
# Restart service if issues
ssh your_username@protec
sudo systemctl restart sub2api
```

---

## Success Criteria ✅

Migration is SUCCESSFUL when:

- [ ] API keys migrate and authenticate correctly (test with `cr_` key)
- [ ] Users can log in with existing credentials
- [ ] Usage statistics visible in dashboard
- [ ] OAuth tokens work (accounts can make API calls)
- [ ] All API endpoints respond correctly:
  - [ ] `/v1/models` (Claude)
  - [ ] `/v1beta/models` (Gemini)
  - [ ] `/openai/v1/chat/completions` (OpenAI)
  - [ ] `/health` returns 200 OK
- [ ] Service runs stable without errors
- [ ] No Chinese text in interface (all translated)

---

## 📋 Timeline

| Phase                        | Duration       | Notes                  |
| ---------------------------- | -------------- | ---------------------- |
| Phase 1: PostgreSQL Setup    | 30-60 min      | Requires SSH access    |
| Phase 2: Configure Variables | 5 min          | Local file editing     |
| Phase 3: Apply Migration     | 10-15 min      | SQL migration          |
| Phase 4: Execute Migration   | 10-20 min      | Data transfer          |
| Phase 5: Start sub2api       | 5 min          | Build and start        |
| Phase 6: Verification        | 5-10 min       | Test all functionality |
| **Total**                    | **~1-2 hours** | Excluding setup time   |

---

## 🆘 Need Help? If you encounter issues

### Problem: Database connection fails

1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Check port 5432 is open: `sudo netstat -tlnp | grep 5432`
3. Check firewall: `sudo ufw status`
4. Check logs: `sudo journalctl -u postgresql`

### Problem: Migration fails

1. Check ENCRYPTION_KEY is exact 32 characters
2. Check DATABASE_URL is correct
3. Check Redis connection from local machine
4. Run with verbose logging
5. Check sub2api logs: `ssh protec tail -n 100 logs/error.log`

### Problem: API keys don't work

1. Verify `cr_` prefix is set in `.env.local`
2. Check hash mappings table was created
3. Test with one key first
4. Check logs for authentication errors

### Problem: Users can't log in

1. Verify user exists in database
2. Check email format
3. Verify password hash
4. Try login with credentials

---

## 📞 Quick Reference

### Files Transfered to Protec

- `/home/your_username/sub2api/.env.local` - Environment variables
- `/home/your_username/sub2api/migrations/035_add_api_key_hash_mappings.sql` - SQL migration
- `/home/your_username/sub2api/scripts/migrate-complete.js` - Migration script

### Key Environment Variables

```bash
DATABASE_URL="postgresql://sub2api:password@localhost:5432/sub2api"
ENCRYPTION_KEY="your-32-char-hex-key"
DEFAULT_API_KEY_PREFIX="cr_"
REDIS_HOST=localhost"
REDIS_PORT=6379
```

### Useful Commands on Protec

```bash
# Check service status
sudo systemctl status sub2api

# View logs
sudo journalctl -u sub2api -f

# Restart service
sudo systemctl restart sub2api

# Check database
psql -h localhost -U your_username -d sub2api -c "SELECT COUNT(*) FROM api_keys;"

# Run migrations
./sub2api migrate status

# Stop service
sudo systemctl stop sub2api
```

---

## ✅ Next Steps

Once you complete all phases:

1. **Verify all API endpoints** - Make sure everything responds correctly
2. **Test with your existing clients** - Ensure `cr_` keys work
3. **Monitor for 24-48 hours** - Watch for issues
4. **Document any issues** - Note problems encountered

---

## 🚨 Common Issues and Solutions

### Issue: "database 'sub2api' does not exist"

**Solution**: Phase 1.2 already addresses this - CREATE DATABASE is included

### Issue: "role 'test' does not exist"

**Solution**: Phase 1.2 creates USER with role - use that role or skip user creation

### Issue: "hash mismatch / decryption fails"

**Solution**:

- Ensure ENCRYPTION_KEY is EXACT same as in claude-relay-service
- Check Redis data still exists on local machine
- Migration script handles decryption correctly

### Issue: "service won't start"

**Solution**:

- Check port 8080 is available
- Check DATABASE_URL in .env.local
- Check logs for startup errors
- Try building manually if build fails

### Issue: "API keys return 401"

**Solution**:

- Verify hash mapping table was created: `SELECT COUNT(*) FROM api_key_hash_mappings;`
- Check DEFAULT*API_KEY_PREFIX="cr*" is set
- Restart service after migration
- Check logs for authentication errors

---

## 📧 Support Contact

If you encounter any issues that you cannot resolve:

1. **Database access issues**: Contact Protec support team
2. **Migration problems**: Check logs, verify ENCRYPTION_KEY
3. **API errors**: Verify hash mappings, check authentication logs
4. **Service won't start**: Check configuration, verify dependencies

**Support Email**: support@obeskay.com

**Include in any support request**:

- Error message
- Phase where it failed
- Commands you ran
- System configuration (OS, PostgreSQL version, etc.)

---

**Good luck with your deployment!** 🚀
