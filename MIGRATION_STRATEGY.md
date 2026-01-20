# Migration Strategy: claude-relay-service → sub2api

## Executive Summary

This document outlines the strategy to migrate from Node.js/Redis-based `claude-relay-service` to Go/PostgreSQL/Redis-based `sub2api` while maintaining backward compatibility with existing API keys and encryption.

## Critical Requirements

1. ✅ Maintain compatibility with existing `cr_` prefixed API keys
2. ✅ Preserve ENCRYPTION_KEY from current `.env` configuration
3. ✅ Translate all Chinese text to English
4. ✅ Enable CI/CD deployment to Protec environment
5. ✅ Support future updates from sub2api upstream

---

## Architecture Comparison

| Aspect              | claude-relay-service (Current) | sub2api (Target)        | Compatibility Strategy     |
| ------------------- | ------------------------------ | ----------------------- | -------------------------- |
| **Backend**         | Node.js/TypeScript             | Go (Gin)                | API compatibility layer    |
| **Primary DB**      | Redis only                     | PostgreSQL + Redis      | Migration script           |
| **API Key Storage** | SHA-256 hash in Redis          | Plaintext in PostgreSQL | Dual-mode auth             |
| **API Key Prefix**  | `cr_` (fixed)                  | `sk_` (configurable)    | Configurable prefix        |
| **Authentication**  | Hash-based lookup              | Plaintext lookup        | Hybrid auth middleware     |
| **Encryption**      | Custom AES (ENCRYPTION_KEY)    | JWT secret              | Encryption key passthrough |
| **Language**        | Mixed CN/EN                    | Some CN                 | Full EN translation        |

---

## Phase 1: API Key Compatibility Layer (CRITICAL)

### Problem

- Current system: Hashes API keys, stores in Redis as `api_key_hash:{hash}` → `api_key:{id}`
- Target system: Stores full plaintext keys in PostgreSQL

### Solution: Dual-Mode Authentication

Create middleware in `analysis_sub2api/backend/internal/server/middleware/legacy_api_key_auth.go`:

```go
// LegacyAPIKeyAuthMiddleware provides hybrid authentication
type LegacyAPIKeyAuthMiddleware struct {
	encryptionKey string // ENCRYPTION_KEY from .env
}

// Determine authentication mode
func IsLegacyKey(apiKey string) bool {
	return strings.HasPrefix(apiKey, "cr_")
}

func IsStandardKey(apiKey string) bool {
	return strings.HasPrefix(apiKey, "sk-")
}

// HashAPIKey creates SHA-256 hash (for legacy keys)
func HashAPIKey(apiKey string) string {
	hash := sha256.Sum256([]byte(apiKey))
	return hex.EncodeToString(hash[:])
}
```

### Implementation Steps

1. **Update `config/config.go`** - Add configurable prefix support:

   ```yaml
   default:
     api_key_prefix: 'cr_' # Support legacy prefix
   ```

2. **Create migration mapping table** - Add to `backend/ent/schema/api_key_hash_mapping.go`:

   ```go
   type APIKeyHashMapping struct {
       ent.Schema
   }
   // Fields: id, hash (SHA-256), api_key_id (references api_keys)
   ```

3. **Update API key generation** - Support both `cr_` and `sk_` prefixes based on user preference

4. **Modify auth middleware** - Route to appropriate authentication method:
   - Legacy keys: Look up via hash mapping → fetch from api_keys table
   - Standard keys: Direct plaintext lookup in api_keys table

---

## Phase 2: Data Migration (CRITICAL)

### Required Migrations

Create `scripts/migrate-from-redis.js`:

```javascript
/**
 * Migration Script: Redis (claude-relay-service) → PostgreSQL (sub2api)
 *
 * This script:
 * 1. Connects to existing Redis instance
 * 2. Exports API keys, users, accounts, usage data
 * 3. Transforms data to sub2api schema
 * 4. Inserts into PostgreSQL
 * 5. Creates hash mappings for legacy keys
 */

const redis = require('./src/models/redis') // Current system
const { Pool } = require('pg') // PostgreSQL client for target

async function migrateAPIKeys() {
  // Export from Redis
  const hashedKeys = await redis.client.keys('api_key_hash:*')
  const keyMappings = []

  for (const hashKey of hashedKeys) {
    const hash = hashKey.replace('api_key_hash:', '')
    const keyId = await redis.client.get(hashKey)
    const keyData = await redis.hgetall(`api_key:${keyId}`)

    // Insert into sub2api PostgreSQL
    const newKeyId = await pg.query(
      `
      INSERT INTO api_keys (
        user_id, key, name, status, created_at, updated_at
      ) VALUES ($1, $2, $3, 'active', NOW(), NOW())
      RETURNING id
    `,
      [keyData.userId, keyData.apiKey, keyData.name]
    )

    // Create hash mapping for legacy auth
    await pg.query(
      `
      INSERT INTO api_key_hash_mappings (hash, api_key_id)
      VALUES ($1, $2)
    `,
      [hash, newKeyId.rows[0].id]
    )

    keyMappings.push({ hash, newId: newKeyId.rows[0].id })
  }

  return keyMappings
}

async function migrateUsers() {
  // Export users from Redis
  const users = await redis.client.keys('user:*')

  for (const userKey of users) {
    const userId = userKey.replace('user:', '')
    const userData = await redis.hgetall(userKey)

    await pg.query(
      `
      INSERT INTO users (
        email, password_hash, role, balance, concurrency, status, created_at, updated_at
      ) VALUES ($1, $2, 'user', 0, 5, 'active', NOW(), NOW())
      RETURNING id
    `,
      [userData.email, userData.passwordHash]
    )
  }
}

async function migrateAccounts() {
  // Migrate account configurations
  const accountTypes = [
    'claude_account',
    'gemini_account',
    'bedrock_account',
    'azure_openai_account',
    'droid_account',
    'ccr_account'
  ]

  for (const type of accountTypes) {
    const keys = await redis.client.keys(`${type}:*`)
    // Migrate each account to PostgreSQL accounts table
  }
}

async function migrateUsageStats() {
  // Export usage statistics
  const usageKeys = await redis.client.keys('usage:*')

  for (const key of usageKeys) {
    // Transform and insert into usage_logs table
  }
}

// Main migration function
async function main() {
  console.log('Starting migration from Redis to PostgreSQL...')

  try {
    await migrateAPIKeys()
    console.log('✓ API keys migrated')

    await migrateUsers()
    console.log('✓ Users migrated')

    await migrateAccounts()
    console.log('✓ Accounts migrated')

    await migrateUsageStats()
    console.log('✓ Usage stats migrated')

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

main()
```

### Migration Checklist

- [ ] Backup current Redis data (`redis-cli --rdb /path/to/backup.rdb`)
- [ ] Set up PostgreSQL 15+ instance
- [ ] Create sub2api database schema
- [ ] Run migration script
- [ ] Verify API keys work with `cr_` prefix
- [ ] Verify users can log in with existing credentials
- [ ] Verify usage statistics preserved
- [ ] Test all API endpoints

---

## Phase 3: ENCRYPTION_KEY Compatibility (CRITICAL)

### Current System

Uses `ENCRYPTION_KEY` (32-char AES key) for:

- OAuth token encryption in Redis
- Sensitive credential storage

### Target System Integration

Add to `analysis_sub2api/backend/internal/config/config.go`:

```go
type LegacyConfig struct {
	EncryptionKey string `mapstructure:"encryption_key"` // For compatibility
}

// In Load() function:
if legacyKey := os.Getenv("ENCRYPTION_KEY"); legacyKey != "" {
	cfg.Legacy = LegacyConfig{
		EncryptionKey: legacyKey,
	}
	log.Println("Legacy ENCRYPTION_KEY loaded for compatibility")
}
```

### Usage in Account Services

For services that need encryption (OAuth tokens, etc.):

```go
// Use legacy encryption key if available
if cfg.Legacy.EncryptionKey != "" {
	encrypted := encryptWithAES(token, cfg.Legacy.EncryptionKey)
	// Store in database
}
```

---

## Phase 4: English Translation (HIGH PRIORITY)

### Files to Translate

Check these directories for Chinese text:

1. **Backend (Go)**:

   ```bash
   grep -r "中文\|Chinese" analysis_sub2api/backend/ --include="*.go"
   ```

2. **Frontend (Vue/TS)**:
   ```bash
   grep -r "中文\|[\u4e00-\u9fff]" analysis_sub2api/frontend/src/ --include="*.vue"
   ```

### Common Translations

| Chinese                     | English                                         |
| --------------------------- | ----------------------------------------------- |
| 连接池隔离策略              | Connection Pool Isolation Policy                |
| 按...隔离                   | Isolation by ...                                |
| 用于控制...                 | Used to control...                              |
| 同一...共享连接池           | Same ... shares connection pool                 |
| 适合...场景                 | Suitable for ... scenarios                      |
| 每个账户独立连接池          | Each account has independent connection pool    |
| 同一账户+代理组合共享连接池 | Same account+proxy combo shares connection pool |

### Automated Translation Script

Create `scripts/translate-chinese.sh`:

```bash
#!/bin/bash
# Find and translate Chinese text in codebase

echo "Scanning for Chinese text..."
grep -rn "[\u4e00-\u9fff]" analysis_sub2api/backend/ --include="*.go" > chinese_backend.txt
grep -rn "[\u4e00-\u9fff]" analysis_sub2api/frontend/src/ --include="*.vue" > chinese_frontend.txt

echo "Found Chinese text in:"
echo "Backend: $(wc -l < chinese_backend.txt) lines"
echo "Frontend: $(wc -l < chinese_frontend.txt) lines"

echo "Manual translation required for these files"
```

---

## Phase 5: CI/CD Pipeline for Protec (HIGH PRIORITY)

### GitHub Actions Workflow

Create `.github/workflows/deploy-to-protec.yml`:

```yaml
name: Deploy to Protec

on:
  push:
    branches: [main, protec-deploy]
  workflow_dispatch:

env:
  PROTEC_URL: ${{ secrets.PROTEC_URL }}
  PROTEC_USERNAME: ${{ secrets.PROTEC_USERNAME }}
  PROTEC_KEY: ${{ secrets.PROTEC_KEY }}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for versioning

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.25.5'

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Cache Go modules
        uses: actions/cache@v4
        with:
          path: |
            ~/.cache/go-build
            ~/go/pkg/mod
          key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
          restore-keys: |
            ${{ runner.os }}-go-

      - name: Cache Node modules
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Install frontend dependencies
        working-directory: ./frontend
        run: pnpm install

      - name: Build frontend
        working-directory: ./frontend
        run: pnpm run build

      - name: Build backend
        working-directory: ./backend
        run: go build -tags embed -o sub2api ./cmd/server
        env:
          CGO_ENABLED: 0

      - name: Build Docker image
        run: |
          docker build -t protec-sub2api:${{ github.sha }} .
          docker tag protec-sub2api:${{ github.sha }} protec-sub2api:latest

      - name: Run tests
        run: |
          cd backend
          go test ./...

      - name: Deploy to Protec
        env:
          DOCKER_TLS_VERIFY: 0
        run: |
          echo "Deploying to Protec..."
          docker save protec-sub2api:${{ github.sha }} | \
            ssh ${{ secrets.PROTEC_USERNAME }}@${{ secrets.PROTEC_URL }} \
            "docker load && docker stop sub2api && docker rm sub2api && docker run -d --name sub2api -p 8080:8080 --restart unless-stopped protec-sub2api:${{ github.sha }}"

      - name: Health check
        run: |
          sleep 30
          curl -f ${{ secrets.PROTEC_URL }}/health || exit 1

      - name: Notify deployment
        if: always()
        run: |
          if [ ${{ job.status }} == 'success' ]; then
            echo "✅ Deployment successful to Protec"
          else
            echo "❌ Deployment failed to Protec"
          fi
```

### Required GitHub Secrets

Set these in repository settings:

- `PROTEC_URL`: Server URL (e.g., `protec.example.com`)
- `PROTEC_USERNAME`: SSH username
- `PROTEC_KEY`: SSH private key
- `POSTGRES_PASSWORD`: Database password
- `JWT_SECRET`: JWT secret
- `ENCRYPTION_KEY`: Legacy encryption key (from current .env)

---

## Phase 6: Update Strategy (MEDIUM PRIORITY)

### Fork and Merge Strategy

1. **Fork sub2api**:

   ```bash
   # Create fork under your GitHub account
   # Add as remote
   cd analysis_sub2api
   git remote add upstream https://github.com/Wei-Shaw/sub2api.git
   ```

2. **Track custom changes**:

   ```bash
   # Create branch for compatibility features
   git checkout -b compatibility-layer

   # Add custom migration files, middleware, etc.
   git add .
   git commit -m "Add compatibility layer for claude-relay-service migration"
   ```

3. **Merge upstream updates**:

   ```bash
   # Fetch upstream changes
   git fetch upstream
   git checkout main
   git merge upstream/main

   # Reapply compatibility layer if conflicts
   git cherry-pick compatibility-layer

   # Resolve conflicts and test
   ```

### Branch Management

```
main (production)
├── upstream/main ( Wei-Shaw/sub2api )
├── compatibility (custom migration features)
│   ├── legacy_api_key_auth.go
│   ├── api_key_hash_mapping schema
│   └── migration scripts
└── protec-deploy (deployment branch)
```

### Automated Update Process

Create `.github/workflows/sync-upstream.yml`:

```yaml
name: Sync Upstream

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday midnight
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Fetch upstream
        run: |
          git remote add upstream https://github.com/Wei-Shaw/sub2api.git
          git fetch upstream

      - name: Create PR for upstream update
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: |
          git checkout main
          git merge upstream/main -m "Update from upstream"
          git push origin main
```

---

## Phase 7: Documentation (HIGH PRIORITY)

### Migration Documentation

Create `MIGRATION_GUIDE.md` with:

1. **Pre-migration checklist**
2. **Step-by-step migration process**
3. **Verification procedures**
4. **Rollback plan**
5. **Troubleshooting guide**

### Rollback Plan

If migration fails:

1. **Restore Redis**:

   ```bash
   redis-cli --rdb /path/to/backup.rdb
   ```

2. **Stop sub2api**:

   ```bash
   docker stop sub2api
   ```

3. **Restart claude-relay-service**:

   ```bash
   npm run service:start:daemon
   ```

4. **Verify all API keys still work**

---

## Success Criteria

Migration is considered successful when:

- [ ] All existing `cr_` API keys authenticate successfully
- [ ] User accounts work without re-registration
- [ ] Usage statistics preserved from current system
- [ ] All API endpoints (Claude, Gemini, OpenAI, etc.) function correctly
- [ ] CI/CD pipeline successfully deploys to Protec
- [ ] Frontend UI is fully in English
- [ ] ENCRYPTION_KEY configuration preserved and functional
- [ ] Can pull updates from sub2api upstream

---

## Timeline Estimate

| Phase                               | Estimated Time |
| ----------------------------------- | -------------- |
| Phase 1: API Key Compatibility      | 2-3 days       |
| Phase 2: Data Migration             | 3-5 days       |
| Phase 3: ENCRYPTION_KEY Integration | 1-2 days       |
| Phase 4: English Translation        | 2-3 days       |
| Phase 5: CI/CD Setup                | 2-3 days       |
| Phase 6: Update Strategy Setup      | 1 day          |
| Phase 7: Documentation              | 1-2 days       |
| **Total**                           | **12-19 days** |

---

## Next Steps

1. ✅ Review this migration strategy
2. ✅ Approve or modify as needed
3. ✅ Begin Phase 1: API Key Compatibility Layer
4. ✅ Create migration script (Phase 2)
5. ✅ Set up CI/CD pipeline (Phase 5)
