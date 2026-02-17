# User Migration Guide

This directory contains scripts to migrate user data from a production Redis instance to a QA/staging Redis instance.

## Overview

The migration system safely duplicates all user-related data including:
- API Keys with all configurations
- Claude Accounts (OAuth tokens, settings)
- Gemini Accounts
- Admin Users
- Usage Statistics

## Features

- **Safe & Idempotent**: Existing data in target is never overwritten
- **Dry-run Mode**: Preview what will be copied without making changes
- **Progress Tracking**: Real-time feedback during migration
- **Error Handling**: Continues on individual item failures
- **Selective Migration**: Copy specific data types only

## Quick Start

### 1. Dry Run (Preview)

Always start with a dry run to preview what will be migrated:

```bash
npm run migrate:dry-run
```

### 2. Configure Environment

Set environment variables for source and target Redis:

```bash
# Source Redis (Production)
export SOURCE_REDIS_HOST=prod-redis.example.com
export SOURCE_REDIS_PORT=6379
export SOURCE_REDIS_PASSWORD=your-password
export SOURCE_REDIS_DB=0

# Target Redis (QA)
export TARGET_REDIS_HOST=qa-redis.example.com
export TARGET_REDIS_PORT=6379
export TARGET_REDIS_PASSWORD=qa-password
export TARGET_REDIS_DB=0
```

### 3. Execute Migration

```bash
npm run migrate:users
```

## Usage Options

### Using npm scripts

```bash
# Preview migration (safe, no changes)
npm run migrate:dry-run

# Full migration with confirmation prompt
npm run migrate:users
```

### Using shell script directly

```bash
# Dry run
./scripts/migrate-users.sh --dry-run

# Full migration
./scripts/migrate-users.sh

# Migrate specific types
./scripts/migrate-users.sh --types=apikeys,claude
```

### Using Node.js script directly

```bash
# Dry run
node scripts/migrate-users.js --dry-run

# Full migration
node scripts/migrate-users.js

# With custom Redis hosts
node scripts/migrate-users.js --source=prod.example.com --target=qa.example.com --types=all

# Migrate only API keys
node scripts/migrate-users.js --types=apikeys
```

## Data Types

You can specify which data types to migrate:

- `all` - All data (default)
- `apikeys` - API Keys and configurations
- `claude` - Claude Accounts
- `gemini` - Gemini Accounts
- `admins` - Admin users
- `usage` - Usage statistics

Examples:

```bash
# Migrate everything
npm run migrate:users

# Migrate only API keys
npm run migrate:users -- --types=apikeys

# Migrate API keys and accounts
npm run migrate:users -- --types=apikeys,claude,gemini
```

## Command Line Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview migration without making changes |
| `--source=HOST` | Source Redis host (overrides env var) |
| `--target=HOST` | Target Redis host (overrides env var) |
| `--types=LIST` | Comma-separated list of data types |
| `--source-port=PORT` | Source Redis port |
| `--source-password=PASS` | Source Redis password |
| `--source-db=DB` | Source Redis DB number |
| `--target-port=PORT` | Target Redis port |
| `--target-password=PASS` | Target Redis password |
| `--target-db=DB` | Target Redis DB number |

## Environment Variables

Environment variables provide default values and are recommended for production use:

| Variable | Description | Default |
|----------|-------------|---------|
| `SOURCE_REDIS_HOST` | Source Redis hostname | localhost |
| `SOURCE_REDIS_PORT` | Source Redis port | 6379 |
| `SOURCE_REDIS_PASSWORD` | Source Redis password | (empty) |
| `SOURCE_REDIS_DB` | Source Redis DB number | 0 |
| `TARGET_REDIS_HOST` | Target Redis hostname | localhost |
| `TARGET_REDIS_PORT` | Target Redis port | 6379 |
| `TARGET_REDIS_PASSWORD` | Target Redis password | (empty) |
| `TARGET_REDIS_DB` | Target Redis DB number | 0 |

## Safety Features

### 1. Idempotent

The script never overwrites existing data in the target Redis. If a key already exists, it will be skipped.

### 2. Dry Run Mode

Always run with `--dry-run` first to see what will be copied:

```bash
npm run migrate:dry-run
```

### 3. Confirmation Prompt

The script asks for confirmation before making any changes (unless in dry-run mode).

### 4. Progress Tracking

Real-time feedback shows:
- Number of items found
- Items copied, skipped, and failed
- Error messages for any failures

### 5. Error Recovery

If an item fails to copy, the script continues with remaining items and reports errors at the end.

## Migration Output

The script provides detailed output:

```
📋 Migration Configuration:
────────────────────────────────────────────────────────────
Mode: LIVE MIGRATION

Source Redis: prod-redis.example.com:6379 (DB: 0)
Target Redis: qa-redis.example.com:6379 (DB: 0)

Data Types: all
────────────────────────────────────────────────────────────

✅ Connected to Source Redis at prod-redis.example.com:6379
✅ Connected to Target Redis at qa-redis.example.com:6379

📤 Copying API Keys...
Found 25 API keys in source
  ✅ Copied: Production Key 1
  ✅ Copied: Staging Key 2
  ⏭️  Skipped existing: Test Key
✅ API Keys complete: 24 copied, 1 skipped, 0 errors

[... continues for other data types ...]

============================================================
📊 MIGRATION SUMMARY
============================================================

API Keys:
  ✅ Copied: 24
  ⏭️  Skipped: 1
  ❌ Errors: 0

Claude Accounts:
  ✅ Copied: 5
  ⏭️  Skipped: 0
  ❌ Errors: 0

[... continues ...]

────────────────────────────────────────────────────────────
TOTAL: 34 copied, 1 skipped, 0 errors
============================================================
```

## Best Practices

### 1. Always Dry Run First

```bash
npm run migrate:dry-run
```

### 2. Use Environment Variables

Create a `.env.migration` file:

```bash
# Production
SOURCE_REDIS_HOST=prod.example.com
SOURCE_REDIS_PORT=6379
SOURCE_REDIS_PASSWORD=prod-secret
SOURCE_REDIS_DB=0

# QA
TARGET_REDIS_HOST=qa.example.com
TARGET_REDIS_PORT=6379
TARGET_REDIS_PASSWORD=qa-secret
TARGET_REDIS_DB=0
```

Then load it:

```bash
source .env.migration
npm run migrate:users
```

### 3. Schedule During Low Traffic

Migrations read from production Redis. Schedule during low-traffic periods.

### 4. Monitor Target After Migration

Verify data in QA environment:

```bash
npm run cli status
```

### 5. Keep Audit Logs

Save migration output for documentation:

```bash
npm run migrate:users 2>&1 | tee migration-$(date +%Y%m%d).log
```

## Troubleshooting

### Connection Errors

**Error**: `Failed to connect to Source Redis`

**Solution**:
- Verify Redis host and port are correct
- Check firewall rules allow connection
- Verify password is correct
- Ensure Redis is running: `redis-cli -h <host> -p <port> ping`

### Permission Errors

**Error**: `NOAUTH Authentication required`

**Solution**: Set the correct password environment variable

### Out of Memory

**Error**: `OOM command not allowed when used memory > 'maxmemory'`

**Solution**:
- Check target Redis has enough memory
- Consider migrating data types separately
- Clear old data from target if needed

### Keys Already Exist

**Behavior**: Existing keys are skipped (never overwritten)

**Solution**:
- This is expected behavior for safety
- To "refresh" data, delete keys from target first
- Or use a different target DB

## Advanced Usage

### Migrate to Different Database

Use a different DB number to keep multiple environments:

```bash
export TARGET_REDIS_DB=1  # Use DB 1 instead of 0
npm run migrate:users
```

### Selective Migration

Migrate only what you need:

```bash
# Only API keys
npm run migrate:users -- --types=apikeys

# Only accounts (no API keys)
npm run migrate:users -- --types=claude,gemini

# Only admins
npm run migrate:users -- --types=admins
```

### Automated Migration

Create a script for automated migrations:

```bash
#!/bin/bash
# migrate-to-qa.sh

set -e

# Load environment
source /path/to/production.env
export TARGET_REDIS_HOST=qa.example.com
export TARGET_REDIS_PASSWORD=$QA_REDIS_PASSWORD

# Dry run first
npm run migrate:dry-run

# Ask for confirmation
read -p "Proceed with migration? (yes/no): " confirm
if [ "$confirm" = "yes" ]; then
  npm run migrate:users
fi
```

## Security Considerations

1. **Never commit passwords**: Use environment variables, never hardcode
2. **Use read-only source**: If possible, use Redis replication with read-only slave
3. **Encrypt in transit**: Use rediss:// (TLS) for remote connections
4. **Audit logs**: Keep migration logs for compliance
5. **Access control**: Limit who can run migration scripts

## Related Scripts

- `data-transfer.js` - Export/import to/from JSON files
- `data-transfer-enhanced.js` - Export with encryption
- `migrate-apikey-expiry.js` - Migrate API key expiry settings

## Support

For issues or questions:
1. Check the logs for specific error messages
2. Verify Redis connectivity using `redis-cli`
3. Review environment variables are set correctly
4. Check Redis memory usage: `INFO memory`
