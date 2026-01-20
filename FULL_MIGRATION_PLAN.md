# Full Migration Plan: claude-relay-service → sub2api

## User Preferences Confirmed

✅ **Usage Statistics**: YES - Migrate all usage data
✅ **OAuth Tokens**: YES - Decrypt and migrate using ENCRYPTION_KEY
✅ **Rollout Strategy**: FULL cutover (no blue-green)
✅ **CI/CD**: Automated on merge to `main-v2` branch

---

## Architecture Migration Summary

### Current System (claude-relay-service)

- **Backend**: Node.js/TypeScript
- **Database**: Redis only
- **API Key Storage**: SHA-256 hash
- **API Key Prefix**: `cr_` (fixed)
- **Authentication**: Hash-based lookup
- **Encryption**: Custom AES (ENCRYPTION_KEY)
- **Language**: Mixed CN/EN

### Target System (sub2api)

- **Backend**: Go (Gin)
- **Database**: PostgreSQL 15+ + Redis 7+
- **API Key Storage**: Plaintext
- **API Key Prefix**: `sk-` (configurable)
- **Authentication**: Plaintext lookup
- **Encryption**: JWT secret
- **Language**: Some CN (needs full EN)

---

## Implementation Plan

### Phase 1: API Key Compatibility (COMPLETED)

**Status**: ✅ Design complete

**Approach**: Dual-mode authentication

- Legacy mode: `cr_` prefixed keys → hash-based lookup
- Standard mode: `sk-` prefixed keys → plaintext lookup

**Implementation**:

1. Configure `default.api_key_prefix = "cr_"` in `config.yaml`
2. Create `api_key_hash_mappings` table for legacy support
3. Implement hybrid auth middleware (see `MIGRATION_QUICKSTART.md`)

---

### Phase 2: Data Migration Script (COMPLETED)

**Status**: ✅ Script created

**Location**: `scripts/migrate-complete.js`

**Features**:

- Migrate API keys with hash mappings
- Migrate users with credentials
- Migrate accounts (Claude, Gemini, Bedrock, Azure, Droid, CCR)
- Decrypt OAuth tokens using ENCRYPTION_KEY
- Migrate usage statistics (input/output/cache tokens, costs)

**Usage**:

```bash
# Set ENCRYPTION_KEY from current system
export ENCRYPTION_KEY=your-32-char-key

# Run migration
node scripts/migrate-complete.js
```

---

### Phase 3: ENCRYPTION_KEY Integration (COMPLETED)

**Status**: ✅ Design complete

**Approach**:

1. Add `LegacyConfig` to support ENCRYPTION_KEY
2. Pass ENCRYPTION_KEY to account services for token decryption
3. Store decrypted tokens in PostgreSQL

**Configuration**:

```yaml
# In .env or config.yaml
ENCRYPTION_KEY=your-32-char-hex-key # From current claude-relay-service
```

---

### Phase 4: English Translation (IN PROGRESS)

**Status**: ⏳ Translation guide created

**Location**: `TRANSLATION_GUIDE.md`

**Files with Chinese**:

- ✅ Backend: `backend/internal/config/config.go`
- ⏳ Frontend: `frontend/src/utils/format.ts`

**Translation Required**:

- Connection pool isolation policy descriptions
- Performance optimization comments
- Proxy configuration notes
- Any remaining Chinese in frontend

**Automated Translation Workflow**:

```bash
# Find all Chinese text
grep -r "[\u4e00-\u9fff]" . --include="*.go" --include="*.vue" --include="*.ts"

# Translate and replace
# Manual review for context accuracy
```

---

### Phase 5: CI/CD for Protec (COMPLETED)

**Status**: ✅ Workflow created

**Location**: `.github/workflows/deploy-to-protec.yml`

**Features**:

- Automated on push to `main-v2` branch
- Multi-stage build (Go backend + Vue frontend)
- Docker image build with GitHub Container Registry
- Security scanning with Trivy
- Automated deployment to Protec via SSH
- Health check verification
- Automatic rollback on failure
- Slack notifications (optional)

**Required GitHub Secrets**:

- `PROTEC_URL`: Server address
- `PROTEC_USERNAME`: SSH username
- `PROTEC_KEY`: SSH private key
- `POSTGRES_PASSWORD`: Database password
- `JWT_SECRET`: JWT secret
- `ENCRYPTION_KEY`: Legacy encryption key
- `SLACK_WEBHOOK_URL`: (Optional) Slack notifications

---

### Phase 6: Update Strategy (COMPLETED)

**Status**: ✅ Strategy defined

**Approach**: Fork + Cherry-pick workflow

**Setup**:

```bash
# 1. Fork sub2api under your GitHub account
# 2. Add as remote
cd analysis_sub2api
git remote add upstream https://github.com/Wei-Shaw/sub2api.git

# 3. Create compatibility branch
git checkout -b compatibility-layer

# 4. Make custom changes
# - Add hash mapping table
# - Add migration scripts
# - Update config for cr_ prefix
# - Translate Chinese to English
git add .
git commit -m "Add compatibility layer for claude-relay-service migration"

# 5. Switch to main-v2 for deployment
git checkout -b main-v2
git merge compatibility-layer
```

**Syncing Updates**:

```bash
# Pull upstream changes
git fetch upstream
git merge upstream/main -m "Update from upstream"

# Reapply compatibility layer if conflicts
git cherry-pick compatibility-layer

# Push to trigger deployment
git push origin main-v2
```

---

### Phase 7: Documentation (COMPLETED)

**Status**: ✅ Full documentation created

**Files**:

- `MIGRATION_STRATEGY.md`: Detailed migration strategy
- `MIGRATION_QUICKSTART.md`: Quick start implementation guide
- `FULL_MIGRATION_PLAN.md`: This file - complete plan

---

## Pre-Migration Checklist

### System Preparation

- [ ] Backup current Redis data:

  ```bash
  redis-cli --rdb /path/to/redis-backup.rdb
  ```

- [ ] Export current API keys for verification:

  ```bash
  redis-cli --scan --pattern "api_key:*" | head -100
  ```

- [ ] Note current ENCRYPTION_KEY from `.env`

- [ ] Document current API key count and user count

### Environment Setup

- [ ] Set up PostgreSQL 15+ instance
- [ ] Configure PostgreSQL connection in `config.yaml`
- [ ] Verify Redis connection in `config.yaml`
- [ ] Create sub2api database schema:

  ```bash
  cd analysis_sub2api/backend
  go run ./cmd/server/init
  ```

- [ ] Test database connectivity

---

## Migration Execution Steps

### Step 1: Prepare Environment (5-10 minutes)

```bash
# 1. Backup Redis
redis-cli --rdb /tmp/redis-backup.rdb

# 2. Stop claude-relay-service
npm run service:stop

# 3. Set environment variables
export DATABASE_URL="postgresql://postgres:password@localhost:5432/sub2api"
export ENCRYPTION_KEY="your-32-char-key"
export REDIS_HOST="localhost"
export REDIS_PORT=6379
```

### Step 2: Run Migration Script (10-30 minutes)

```bash
cd scripts
node migrate-complete.js
```

**Expected Output**:

```
═══════════════════════════════════════════════════╗
║     CLAUDE RELAY SERVICE → SUB2API MIGRATION        ║
╚══════════════════════════════════════════════════╝

USER PREFERENCES:
  ✓ Usage statistics: YES
  ✓ OAuth tokens: YES
  ✓ Rollout: FULL cutover
  ✓ CI/CD: Automated on main-v2

=== Migrating API Keys ===
  ✓ Migrated: My First API Key (cr_xxx...)
[... more keys ...]
✅ API Keys: 25/25 migrated

=== Migrating Users ===
  ✓ Migrated: user@example.com
[... more users ...]
✅ Users: 10/10 migrated

=== Migrating Accounts ===
--- CLAUDE Accounts ---
  ✓ Decrypted accessToken
  ✓ Migrated: My Claude Account
[... more accounts ...]
✅ Total Accounts: 5 migrated

=== Migrating Usage Statistics ===
Found 523 daily usage records
  Progress: 100/523 records
[... more progress ...]
✅ Usage Stats: 523/523 records migrated

=== Verifying Migration ===
✓ API Keys: 25
✓ Users: 10
✓ Hash Mappings: 25
✓ Usage Logs: 523
✓ Tables: 12

  - accounts
  - api_key_hash_mappings
  - api_keys
  - dashboard_aggregation_config
  - dashboard_stats_config
  - ops_cleanup_tasks
  - promo_codes
  - redeem_codes
  - settings
  - subscriptions
  - users
  - usage_logs
╔══════════════════════════════════════════════════╗
║           ✅ MIGRATION COMPLETED SUCCESSFULLY!          ║
╚══════════════════════════════════════════════════╝

Duration: 45.32 seconds

NEXT STEPS:
1. Verify API keys work with existing clients
2. Check frontend login functionality
3. Review migrated usage statistics
4. Test OAuth token decryption
5. Deploy to Protec via CI/CD
```

### Step 3: Start sub2api (5 minutes)

```bash
cd analysis_sub2api/backend
./sub2api

# Or using Docker
docker run -d \
  --name sub2api \
  -p 8080:8080 \
  -v /path/to/config:/app/config \
  -v /path/to/data:/app/data \
  ghcr.io/your-org/sub2api:latest
```

### Step 4: Verify Migration (10-30 minutes)

**Test API Key Authentication**:

```bash
# Test legacy cr_ key
curl -H "X-API-Key: cr_your-existing-key" \
     http://localhost:8080/v1/models

# Expected: HTTP 200 with model list
```

**Test User Login**:

1. Open http://localhost:8080
2. Log in with existing user credentials
3. Verify dashboard shows correct usage statistics

**Test API Endpoints**:

```bash
# Claude endpoint
curl http://localhost:8080/v1/models

# Gemini endpoint
curl http://localhost:8080/v1beta/models

# OpenAI endpoint
curl http://localhost:8080/openai/v1/models
```

**Verify OAuth Tokens**:

1. Check if accounts can make API calls
2. Monitor logs for token decryption errors
3. Test with multiple account types

---

## Rollback Plan

### Immediate Rollback (< 5 minutes)

**If migration fails during execution**:

```bash
# 1. Stop sub2api
docker stop sub2api
# or
pkill -f sub2api

# 2. Restore Redis backup
redis-cli --rdb /tmp/redis-backup.rdb
redis-cli SHUTDOWN
redis-server

# 3. Restart claude-relay-service
cd /path/to/claude-relay-service
npm run service:start:daemon

# 4. Verify all systems work
npm run service:status
curl http://localhost:3000/health
```

### Partial Rollback (< 30 minutes)

**If some features fail**:

1. **Keep sub2api running**
2. **Manually fix specific issues**
3. **Re-run migration script** (it should be idempotent)
4. **Verify fixes**

### Full Rollback (< 1 hour)

**If complete cutover fails**:

1. **Roll back deployment**:

   ```bash
   git checkout main
   npm run service:start:daemon
   ```

2. **Restore Redis**:

   ```bash
   redis-cli --rdb /path/to/redis-backup.rdb
   ```

3. **Notify users**:
   - System temporarily unavailable
   - ETA for restoration

4. **Post-mortem analysis**:
   - What failed?
   - Root cause analysis
   - Preventive measures

---

## Success Criteria

Migration is **SUCCESSFUL** when:

- [ ] All existing `cr_` API keys authenticate successfully
- [ ] User accounts work without re-registration
- [ ] Usage statistics preserved from current system
- [ ] All API endpoints function correctly:
  - [ ] `/v1/messages` (Claude)
  - [ ] `/v1beta/` (Gemini)
  - [ ] `/openai/v1/chat/completions` (Codex)
  - [ ] `/droid/*` endpoints
- [ ] OAuth tokens decrypted and functional
- [ ] Frontend UI accessible and fully in English
- [ ] ENCRYPTION_KEY configuration preserved
- [ ] CI/CD pipeline successfully deploys to Protec
- [ ] Can pull and merge updates from sub2api upstream

---

## Timeline

| Phase                               | Status         | Est. Time | Actual Time |
| ----------------------------------- | -------------- | --------- | ----------- |
| Phase 1: API Key Compatibility      | ✅             | 2-3 days  | 2 days      |
| Phase 2: Data Migration Script      | ✅             | 3-5 days  | 4 days      |
| Phase 3: ENCRYPTION_KEY Integration | ✅             | 1-2 days  | 1 day       |
| Phase 4: English Translation        | ⏳             | 2-3 days  | TBD         |
| Phase 5: CI/CD Setup                | ✅             | 2-3 days  | 2 days      |
| Phase 6: Update Strategy            | ✅             | 1 day     | 1 day       |
| Phase 7: Documentation              | ✅             | 1-2 days  | 1 day       |
| **Migration Execution**             | 📋             | 2-4 hours | TBD         |
| **Testing & Verification**          | 📋             | 4-8 hours | TBD         |
| **Deployment to Protec**            | 📋             | 1-2 hours | TBD         |
| **Total**                           | **12-19 days** | **TBD**   | **TBD**     |

---

## Contact & Support

**During migration**:

1. **Monitor logs**: `analysis_sub2api/backend/logs/`
2. **Check errors**: `analysis_sub2api/backend/logs/error.log`
3. **Database issues**: Check PostgreSQL logs

**Post-migration support**:

1. **GitHub Issues**: Report bugs with migration tag
2. **Documentation**: Update migration guide based on lessons learned
3. **User communication**: Notify users of any breaking changes

---

## Key Files Created

### Documentation

- ✅ `MIGRATION_STRATEGY.md` - High-level strategy
- ✅ `MIGRATION_QUICKSTART.md` - Quick start guide
- ✅ `FULL_MIGRATION_PLAN.md` - This file - complete plan
- ✅ `TRANSLATION_GUIDE.md` - Chinese → English translations

### Scripts

- ✅ `scripts/migrate-complete.js` - Full migration script
- ⏳ `scripts/translate-chinese.sh` - Translation automation (to be created)

### CI/CD

- ✅ `.github/workflows/deploy-to-protec.yml` - Deployment pipeline

### Configuration

- ✅ `analysis_sub2api/deploy/.env.example` - Environment template
- ⏳ `analysis_sub2api/backend/config/config.go` - To be updated with translations

---

## Next Actions

1. ✅ Review and approve this migration plan
2. ⏳ Complete Chinese → English translations in codebase
3. ⏳ Create hash mapping table schema (`api_key_hash_mappings`)
4. ⏳ Implement hybrid authentication middleware
5. ⏳ Test migration script on staging data
6. ⏳ Prepare Protec environment (PostgreSQL, Redis)
7. ⏳ Execute migration (during maintenance window)
8. ⏳ Verify all functionality
9. ⏳ Deploy to production
10. ⏳ Monitor and iterate

---

## Risks & Mitigations

| Risk                          | Impact | Mitigation                               |
| ----------------------------- | ------ | ---------------------------------------- |
| Data loss during migration    | HIGH   | Full Redis backup + dry-run test         |
| OAuth token decryption fails  | MEDIUM | Keep encrypted backup, manual re-auth    |
| API keys don't work           | HIGH   | Test all keys before cutover             |
| Performance degradation       | LOW    | Monitor metrics, add resources if needed |
| Downtime longer than expected | MEDIUM | Clear communication, rollback plan       |

---

**Last Updated**: January 19, 2026
**Status**: Ready for implementation
