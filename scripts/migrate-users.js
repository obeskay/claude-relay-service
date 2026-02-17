#!/usr/bin/env node

/**
 * User Migration Script
 *
 * Duplicates all user data from production Redis to QA Redis instance.
 *
 * Features:
 * - Dry-run mode for preview
 * - Progress tracking
 * - Error handling and recovery
 * - Idempotent (safe to run multiple times)
 *
 * Usage:
 *   node scripts/migrate-users.js [options]
 *
 * Options:
 *   --dry-run       Preview migration without making changes
 *   --source=HOST   Source Redis host (default: from env)
 *   --target=HOST   Target Redis host (default: from env)
 *   --types=LIST    Data types to migrate (default: all)
 *
 * Environment Variables:
 *   SOURCE_REDIS_HOST       Source Redis host
 *   SOURCE_REDIS_PORT       Source Redis port (default: 6379)
 *   SOURCE_REDIS_PASSWORD   Source Redis password
 *   SOURCE_REDIS_DB         Source Redis DB (default: 0)
 *
 *   TARGET_REDIS_HOST       Target Redis host
 *   TARGET_REDIS_PORT       Target Redis port (default: 6379)
 *   TARGET_REDIS_PASSWORD   Target Redis password
 *   TARGET_REDIS_DB         Target Redis DB (default: 0)
 */

const Redis = require('ioredis')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=')
  acc[key.replace('--', '')] = value || true
  return acc
}, {})

// Configuration
const isDryRun = args['dry-run'] === true
const dataTypes = (args.types || 'all').split(',')

// Redis connections
let sourceRedis = null
let targetRedis = null

// Statistics
const stats = {
  apiKeys: { copied: 0, skipped: 0, errors: 0 },
  claudeAccounts: { copied: 0, skipped: 0, errors: 0 },
  geminiAccounts: { copied: 0, skipped: 0, errors: 0 },
  admins: { copied: 0, skipped: 0, errors: 0 },
  usageStats: { copied: 0, skipped: 0, errors: 0 }
}

/**
 * Ask user for confirmation
 */
function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
    })
  })
}

/**
 * Create Redis connection
 */
async function createRedis(config, label) {
  const redis = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  })

  try {
    await redis.connect()
    console.log(`✅ Connected to ${label} Redis at ${config.host}:${config.port}`)
    return redis
  } catch (error) {
    console.error(`❌ Failed to connect to ${label} Redis:`, error.message)
    throw error
  }
}

/**
 * Initialize Redis connections
 */
async function initConnections() {
  // Source Redis configuration
  const sourceConfig = {
    host: args.source || process.env.SOURCE_REDIS_HOST || 'localhost',
    port: parseInt(args['source-port'] || process.env.SOURCE_REDIS_PORT || '6379'),
    password: args['source-password'] || process.env.SOURCE_REDIS_PASSWORD || '',
    db: parseInt(args['source-db'] || process.env.SOURCE_REDIS_DB || '0')
  }

  // Target Redis configuration
  const targetConfig = {
    host: args.target || process.env.TARGET_REDIS_HOST || 'localhost',
    port: parseInt(args['target-port'] || process.env.TARGET_REDIS_PORT || '6379'),
    password: args['target-password'] || process.env.TARGET_REDIS_PASSWORD || '',
    db: parseInt(args['target-db'] || process.env.TARGET_REDIS_DB || '0')
  }

  console.log('\n📋 Migration Configuration:')
  console.log('─'.repeat(60))
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`)
  console.log(`\nSource Redis: ${sourceConfig.host}:${sourceConfig.port} (DB: ${sourceConfig.db})`)
  console.log(`Target Redis: ${targetConfig.host}:${targetConfig.port} (DB: ${targetConfig.db})`)
  console.log(`\nData Types: ${dataTypes.join(', ')}`)
  console.log('─'.repeat(60))

  if (!isDryRun) {
    const confirmed = await askConfirmation('\n⚠️  This will copy data to target Redis. Continue?')
    if (!confirmed) {
      console.log('❌ Migration cancelled')
      process.exit(0)
    }
  }

  sourceRedis = await createRedis(sourceConfig, 'Source')
  targetRedis = await createRedis(targetConfig, 'Target')
}

/**
 * Copy API Keys
 */
async function copyApiKeys() {
  console.log('\n📤 Copying API Keys...')

  try {
    const keys = await sourceRedis.keys('apikey:*')
    const apiKeys = []

    // Skip index keys and process only hash data keys
    for (const key of keys) {
      // Skip index/map keys
      if (key === 'apikey:hash_map' || key.includes(':idx:') || key.includes(':set:')) {
        continue
      }

      const type = await sourceRedis.type(key)

      // Only process hash keys (actual API key data)
      if (type === 'hash') {
        const data = await sourceRedis.hgetall(key)
        if (data && Object.keys(data).length > 0) {
          apiKeys.push({ key, data })
        }
      }
    }

    console.log(`Found ${apiKeys.length} API keys in source`)

    for (const { key, data } of apiKeys) {
      try {
        const exists = await targetRedis.exists(key)

        if (exists) {
          console.log(`  ⏭️  Skipped existing: ${data.name || key}`)
          stats.apiKeys.skipped++
          continue
        }

        if (!isDryRun) {
          // Copy hash data
          const pipeline = targetRedis.pipeline()
          for (const [field, value] of Object.entries(data)) {
            pipeline.hset(key, field, value)
          }
          await pipeline.exec()

          // Update hash map if apiKey exists
          if (data.apiKey) {
            await targetRedis.hset('apikey:hash_map', data.apiKey, data.id)
          }
        }

        console.log(`  ✅ Copied: ${data.name || key}`)
        stats.apiKeys.copied++
      } catch (error) {
        console.error(`  ❌ Error copying ${key}:`, error.message)
        stats.apiKeys.errors++
      }
    }

    console.log(
      `✅ API Keys complete: ${stats.apiKeys.copied} copied, ${stats.apiKeys.skipped} skipped, ${stats.apiKeys.errors} errors`
    )
  } catch (error) {
    console.error('❌ Failed to copy API Keys:', error.message)
    stats.apiKeys.errors++
  }
}

/**
 * Copy Claude Accounts
 */
async function copyClaudeAccounts() {
  console.log('\n📤 Copying Claude Accounts...')

  try {
    const keys = await sourceRedis.keys('claude:account:*')
    const accounts = []

    for (const key of keys) {
      // Skip index keys
      if (key.includes(':index:')) {
        continue
      }

      const type = await sourceRedis.type(key)
      if (type !== 'hash') {
        continue
      }

      const data = await sourceRedis.hgetall(key)
      if (data && Object.keys(data).length > 0) {
        accounts.push({ key, data })
      }
    }

    console.log(`Found ${accounts.length} Claude accounts in source`)

    for (const { key, data } of accounts) {
      try {
        const exists = await targetRedis.exists(key)

        if (exists) {
          console.log(`  ⏭️  Skipped existing: ${data.name || key}`)
          stats.claudeAccounts.skipped++
          continue
        }

        if (!isDryRun) {
          const pipeline = targetRedis.pipeline()
          for (const [field, value] of Object.entries(data)) {
            pipeline.hset(key, field, value)
          }
          await pipeline.exec()
        }

        console.log(`  ✅ Copied: ${data.name || key}`)
        stats.claudeAccounts.copied++
      } catch (error) {
        console.error(`  ❌ Error copying ${key}:`, error.message)
        stats.claudeAccounts.errors++
      }
    }

    console.log(
      `✅ Claude Accounts complete: ${stats.claudeAccounts.copied} copied, ${stats.claudeAccounts.skipped} skipped, ${stats.claudeAccounts.errors} errors`
    )
  } catch (error) {
    console.error('❌ Failed to copy Claude Accounts:', error.message)
    stats.claudeAccounts.errors++
  }
}

/**
 * Copy Gemini Accounts
 */
async function copyGeminiAccounts() {
  console.log('\n📤 Copying Gemini Accounts...')

  try {
    const keys = await sourceRedis.keys('gemini_account:*')
    const accounts = []

    for (const key of keys) {
      // Skip index keys
      if (key.includes(':index:')) {
        continue
      }

      const type = await sourceRedis.type(key)
      if (type !== 'hash') {
        continue
      }

      const data = await sourceRedis.hgetall(key)
      if (data && Object.keys(data).length > 0) {
        accounts.push({ key, data })
      }
    }

    console.log(`Found ${accounts.length} Gemini accounts in source`)

    for (const { key, data } of accounts) {
      try {
        const exists = await targetRedis.exists(key)

        if (exists) {
          console.log(`  ⏭️  Skipped existing: ${data.name || key}`)
          stats.geminiAccounts.skipped++
          continue
        }

        if (!isDryRun) {
          const pipeline = targetRedis.pipeline()
          for (const [field, value] of Object.entries(data)) {
            pipeline.hset(key, field, value)
          }
          await pipeline.exec()
        }

        console.log(`  ✅ Copied: ${data.name || key}`)
        stats.geminiAccounts.copied++
      } catch (error) {
        console.error(`  ❌ Error copying ${key}:`, error.message)
        stats.geminiAccounts.errors++
      }
    }

    console.log(
      `✅ Gemini Accounts complete: ${stats.geminiAccounts.copied} copied, ${stats.geminiAccounts.skipped} skipped, ${stats.geminiAccounts.errors} errors`
    )
  } catch (error) {
    console.error('❌ Failed to copy Gemini Accounts:', error.message)
    stats.geminiAccounts.errors++
  }
}

/**
 * Copy Admins
 */
async function copyAdmins() {
  console.log('\n📤 Copying Admins...')

  try {
    const keys = await sourceRedis.keys('admin:*')
    const admins = []

    for (const key of keys) {
      // Skip username index
      if (key.includes('admin_username:')) {
        continue
      }

      const data = await sourceRedis.hgetall(key)
      if (data && Object.keys(data).length > 0) {
        admins.push({ key, data })
      }
    }

    console.log(`Found ${admins.length} admins in source`)

    for (const { key, data } of admins) {
      try {
        const exists = await targetRedis.exists(key)

        if (exists) {
          console.log(`  ⏭️  Skipped existing: ${data.username || key}`)
          stats.admins.skipped++
          continue
        }

        if (!isDryRun) {
          const pipeline = targetRedis.pipeline()
          for (const [field, value] of Object.entries(data)) {
            pipeline.hset(key, field, value)
          }
          await pipeline.exec()

          // Update username index
          if (data.username) {
            await targetRedis.hset('admin_username:index', data.username, data.id)
          }
        }

        console.log(`  ✅ Copied: ${data.username || key}`)
        stats.admins.copied++
      } catch (error) {
        console.error(`  ❌ Error copying ${key}:`, error.message)
        stats.admins.errors++
      }
    }

    console.log(
      `✅ Admins complete: ${stats.admins.copied} copied, ${stats.admins.skipped} skipped, ${stats.admins.errors} errors`
    )
  } catch (error) {
    console.error('❌ Failed to copy Admins:', error.message)
    stats.admins.errors++
  }
}

/**
 * Copy Usage Statistics
 */
async function copyUsageStats() {
  console.log('\n📤 Copying Usage Statistics...')

  try {
    const keys = await sourceRedis.keys('usage:*')
    const usageData = []

    for (const key of keys) {
      const type = await sourceRedis.type(key)
      let data

      if (type === 'hash') {
        data = await sourceRedis.hgetall(key)
      } else if (type === 'string') {
        data = await sourceRedis.get(key)
      } else if (type === 'zset') {
        data = await sourceRedis.zrange(key, 0, -1, 'WITHSCORES')
      } else if (type === 'set') {
        data = await sourceRedis.smembers(key)
      }

      if (data) {
        usageData.push({ key, data, type })
      }
    }

    console.log(`Found ${usageData.length} usage statistics in source`)

    for (const { key, data, type } of usageData) {
      try {
        const exists = await targetRedis.exists(key)

        if (exists) {
          stats.usageStats.skipped++
          continue
        }

        if (!isDryRun) {
          if (type === 'hash') {
            await targetRedis.hset(key, data)
          } else if (type === 'string') {
            await targetRedis.set(key, data)
          } else if (type === 'zset') {
            await targetRedis.zadd(key, data)
          } else if (type === 'set') {
            await targetRedis.sadd(key, ...data)
          }
        }

        stats.usageStats.copied++
      } catch (error) {
        console.error(`  ❌ Error copying ${key}:`, error.message)
        stats.usageStats.errors++
      }
    }

    console.log(
      `✅ Usage Stats complete: ${stats.usageStats.copied} copied, ${stats.usageStats.skipped} skipped, ${stats.usageStats.errors} errors`
    )
  } catch (error) {
    console.error('❌ Failed to copy Usage Statistics:', error.message)
    stats.usageStats.errors++
  }
}

/**
 * Display migration summary
 */
function displaySummary() {
  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 MIGRATION SUMMARY')
  console.log('='.repeat(60))

  const totalCopied = Object.values(stats).reduce((sum, s) => sum + s.copied, 0)
  const totalSkipped = Object.values(stats).reduce((sum, s) => sum + s.skipped, 0)
  const totalErrors = Object.values(stats).reduce((sum, s) => sum + s.errors, 0)

  console.log('\nAPI Keys:')
  console.log(`  ✅ Copied: ${stats.apiKeys.copied}`)
  console.log(`  ⏭️  Skipped: ${stats.apiKeys.skipped}`)
  console.log(`  ❌ Errors: ${stats.apiKeys.errors}`)

  console.log('\nClaude Accounts:')
  console.log(`  ✅ Copied: ${stats.claudeAccounts.copied}`)
  console.log(`  ⏭️  Skipped: ${stats.claudeAccounts.skipped}`)
  console.log(`  ❌ Errors: ${stats.claudeAccounts.errors}`)

  console.log('\nGemini Accounts:')
  console.log(`  ✅ Copied: ${stats.geminiAccounts.copied}`)
  console.log(`  ⏭️  Skipped: ${stats.geminiAccounts.skipped}`)
  console.log(`  ❌ Errors: ${stats.geminiAccounts.errors}`)

  console.log('\nAdmins:')
  console.log(`  ✅ Copied: ${stats.admins.copied}`)
  console.log(`  ⏭️  Skipped: ${stats.admins.skipped}`)
  console.log(`  ❌ Errors: ${stats.admins.errors}`)

  console.log('\nUsage Statistics:')
  console.log(`  ✅ Copied: ${stats.usageStats.copied}`)
  console.log(`  ⏭️  Skipped: ${stats.usageStats.skipped}`)
  console.log(`  ❌ Errors: ${stats.usageStats.errors}`)

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`TOTAL: ${totalCopied} copied, ${totalSkipped} skipped, ${totalErrors} errors`)
  console.log('='.repeat(60))

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes were made')
    console.log('Run without --dry-run to execute the migration.')
  }

  if (totalErrors > 0) {
    console.log('\n⚠️  Some items failed to copy. Check the logs above for details.')
  }
}

/**
 * Main migration function
 */
async function main() {
  try {
    await initConnections()

    // Migrate based on selected data types
    if (dataTypes.includes('all') || dataTypes.includes('apikeys')) {
      await copyApiKeys()
    }

    if (dataTypes.includes('all') || dataTypes.includes('claude')) {
      await copyClaudeAccounts()
    }

    if (dataTypes.includes('all') || dataTypes.includes('gemini')) {
      await copyGeminiAccounts()
    }

    if (dataTypes.includes('all') || dataTypes.includes('admins')) {
      await copyAdmins()
    }

    if (dataTypes.includes('all') || dataTypes.includes('usage')) {
      await copyUsageStats()
    }

    displaySummary()
  } catch (error) {
    console.error('\n💥 Migration failed:', error)
    process.exit(1)
  } finally {
    if (sourceRedis) {
      await sourceRedis.quit()
    }
    if (targetRedis) {
      await targetRedis.quit()
    }
    rl.close()
  }
}

// Run migration
main().catch((error) => {
  console.error('💥 Unexpected error:', error)
  process.exit(1)
})
