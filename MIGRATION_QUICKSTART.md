# Quick Start: Migration Implementation

## 1. Create Branch for Compatibility Layer

```bash
cd analysis_sub2api
git checkout -b compatibility-layer
```

## 2. Implement API Key Prefix Support

### Backend Changes

**File**: `backend/internal/config/config.go`

Add to `DefaultConfig` struct:

```go
type DefaultConfig struct {
	// ... existing fields ...
	APIKeyPrefix    string `mapstructure:"api_key_prefix"` // Already exists, just verify it's configurable
}
```

Update default in `setDefaults()`:

```go
viper.SetDefault("default.api_key_prefix", "cr_") // Support legacy prefix
```

### Frontend Changes

**File**: `frontend/src/composables/useForm.ts`

Update API key generation to support prefix:

```typescript
const generateAPIKey = (prefix: string = 'sk-') => {
  const secret = generateRandomString(64)
  return `${prefix}${secret}`
}
```

## 3. Create Hash Mapping Table

**New File**: `backend/ent/schema/api_key_hash_mapping.go`

```go
package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/Wei-Shaw/sub2api/ent/schema/mixins"
)

type APIKeyHashMapping struct {
	ent.Schema
}

func (APIKeyHashMapping) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "api_key_hash_mappings"},
	}
}

func (APIKeyHashMapping) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixins.TimeMixin{},
	}
}

func (APIKeyHashMapping) Fields() []ent.Field {
	return []ent.Field{
		field.String("hash").
			MaxLen(64).
			NotEmpty().
			Unique(),
		field.Int64("api_key_id").
			NotEmpty(),
	}
}

func (APIKeyHashMapping) Edges() []ent.Edge {
	return []ent.Edge{
		// No edges - this is a mapping table
	}
}
```

**Generate schema**:

```bash
cd backend
go generate ./ent
```

## 4. Create Migration Script

**File**: `scripts/migrate-from-redis.js`

```javascript
const redis = require('./src/models/redis')
const { Pool } = require('pg')

// PostgreSQL connection
const pg = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sub2api'
})

// SHA-256 hashing function (same as legacy system)
const crypto = require('crypto')
function hashAPIKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

async function migrateAPIKeys() {
  console.log('Migrating API keys...')

  // Get all hashed API keys from Redis
  const hashedKeys = await redis.client.keys('api_key_hash:*')

  for (const hashKey of hashedKeys) {
    const hash = hashKey.replace('api_key_hash:', '')
    const keyId = await redis.client.get(hashKey)

    if (!keyId) continue

    // Get full API key data from Redis
    const keyData = await redis.hgetall(`api_key:${keyId}`)

    // Insert into PostgreSQL with plaintext key
    const result = await pg.query(
      `
      INSERT INTO api_keys (
        user_id,
        key,
        name,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, 'active', NOW(), NOW())
      ON CONFLICT (key) DO UPDATE
      SET name = EXCLUDED.name
      RETURNING id
    `,
      [keyData.userId, keyData.apiKey, keyData.name]
    )

    const newKeyId = result.rows[0].id

    // Create hash mapping for legacy authentication
    await pg.query(
      `
      INSERT INTO api_key_hash_mappings (hash, api_key_id)
      VALUES ($1, $2)
      ON CONFLICT (hash) DO UPDATE
      SET api_key_id = EXCLUDED.api_key_id
    `,
      [hash, newKeyId]
    )

    console.log(`  ✓ Migrated API key: ${keyData.name}`)
  }

  console.log(`Total: ${hashedKeys.length} API keys migrated`)
}

async function migrateUsers() {
  console.log('Migrating users...')

  const userKeys = await redis.client.keys('user:*')

  for (const userKey of userKeys) {
    const userId = userKey.replace('user:', '')
    const userData = await redis.hgetall(userKey)

    const result = await pg.query(
      `
      INSERT INTO users (
        email,
        password_hash,
        role,
        balance,
        concurrency,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, 'user', 0, 5, 'active', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `,
      [userData.email, userData.passwordHash]
    )

    console.log(`  ✓ Migrated user: ${userData.email}`)
  }

  console.log(`Total: ${userKeys.length} users migrated`)
}

async function main() {
  console.log('=== Migration: Redis → PostgreSQL ===\n')

  try {
    await migrateAPIKeys()
    console.log('')
    await migrateUsers()
    console.log('\n✅ Migration completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Verify API keys work with existing clients')
    console.log('2. Check frontend login functionality')
    console.log('3. Review usage statistics')
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pg.end()
    await redis.client.quit()
  }
}

main()
```

## 5. Update .env.example

Add legacy compatibility variables to `analysis_sub2api/deploy/.env.example`:

```bash
# Legacy Compatibility (claude-relay-service)
# API key prefix to support existing keys
DEFAULT_API_KEY_PREFIX="cr_"
# Legacy encryption key for OAuth tokens (optional)
ENCRYPTION_KEY=

# ... existing sub2api variables ...
```

## 6. Create CI/CD Workflow

**File**: `.github/workflows/deploy-to-protec.yml` (see MIGRATION_STRATEGY.md for full content)

## 7. Translation Work

Find and translate Chinese text:

```bash
# Find Chinese in backend
grep -r "[\u4e00-\u9fff]" analysis_sub2api/backend/internal --include="*.go"

# Find Chinese in frontend
grep -r "[\u4e00-\u9fff]" analysis_sub2api/frontend/src --include="*.vue" --include="*.ts"

# Find Chinese in frontend (using file encoding)
find analysis_sub2api/frontend/src -name "*.vue" -exec grep -l "中文" {} \;
```

## Testing Migration

1. **Backup Redis**:

   ```bash
   redis-cli --rdb /tmp/redis-backup.rdb
   ```

2. **Test Migration Script**:

   ```bash
   cd scripts
   node migrate-from-redis.js
   ```

3. **Verify in PostgreSQL**:

   ```bash
   psql -h localhost -U postgres -d sub2api
   SELECT COUNT(*) FROM api_keys;
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM api_key_hash_mappings;
   ```

4. **Test API Key Authentication**:
   ```bash
   # Use existing cr_ key
   curl -H "X-API-Key: cr_your-existing-key" \
        http://localhost:8080/v1/models
   ```

## Rollback Plan

If anything fails:

1. **Stop sub2api**:

   ```bash
   docker stop sub2api
   ```

2. **Restore Redis**:

   ```bash
   redis-cli --rdb /tmp/redis-backup.rdb
   redis-cli SHUTDOWN
   redis-server
   ```

3. **Start claude-relay-service**:

   ```bash
   cd ..
   npm run service:start:daemon
   ```

4. **Verify all clients still work**

---

## Implementation Order

| Priority | Task                             | Est. Time |
| -------- | -------------------------------- | --------- |
| 1        | Create compatibility branch      | 5 min     |
| 2        | Add hash mapping schema          | 30 min    |
| 3        | Create migration script          | 2-3 hours |
| 4        | Update config for prefix support | 30 min    |
| 5        | Test migration                   | 1-2 hours |
| 6        | Translate Chinese text           | 2-3 hours |
| 7        | Set up CI/CD pipeline            | 1-2 hours |
| 8        | Document and verify              | 1 hour    |

**Total**: ~8-12 hours

---

## Questions for Review

1. **Do you want to migrate usage statistics?**
   - If yes: Requires additional table analysis
   - If no: Start fresh in sub2api

2. **Do you want to migrate account OAuth tokens?**
   - If yes: Requires ENCRYPTION_KEY integration
   - If no: Users will need to re-authorize

3. **What's your preferred rollout strategy?**
   - Blue-green deployment (recommended)
   - Canary release
   - Full cutover

4. **CI/CD timing?**
   - Manual deployment approval
   - Automated on merge to main
   - Scheduled maintenance windows
