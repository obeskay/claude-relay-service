const axios = require('axios')
const logger = require('../utils/logger')
const redis = require('../models/redis')

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const DEFAULT_GITHUB_REPO = 'Wei-Shaw/sub2api'
const UPDATE_STATUS_CACHE_KEY = 'system:update_status'

function getConfiguredRepo() {
  const fromEnv = process.env.UPDATE_GITHUB_REPO
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim()
  }

  return DEFAULT_GITHUB_REPO
}

class UpdateService {
  constructor() {
    this.currentVersion = require('../../package.json').version
  }

  async getUpdateStatus() {
    try {
      const client = redis.getClient()
      if (client) {
        const cached = await client.get(UPDATE_STATUS_CACHE_KEY)
        if (cached) {
          return JSON.parse(cached)
        }
      }

      const status = await this.checkGitHub()

      if (client) {
        await client.set(
          UPDATE_STATUS_CACHE_KEY,
          JSON.stringify(status),
          'PX',
          UPDATE_CHECK_INTERVAL_MS
        )
      }

      return status
    } catch (error) {
      logger.error('❌ Update check failed:', error.message)
      return {
        hasUpdate: false,
        error: true,
        currentVersion: this.currentVersion
      }
    }
  }

  async checkGitHub() {
    try {
      const repo = getConfiguredRepo()
      const response = await axios.get(`https://api.github.com/repos/${repo}/releases/latest`, {
        timeout: 5000
      })

      const latestVersion = response.data.tag_name.replace(/^v/, '')
      const hasUpdate = this.compareVersions(latestVersion, this.currentVersion)

      return {
        hasUpdate,
        currentVersion: this.currentVersion,
        latestVersion,
        releaseNotes: response.data.body,
        releaseUrl: response.data.html_url,
        checkedAt: new Date().toISOString()
      }
    } catch (error) {
      logger.warn('⚠️ GitHub API check failed (rate limit or network):', error.message)
      // Fallback to false if check fails
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        checkedAt: new Date().toISOString()
      }
    }
  }

  compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number)
    const p2 = v2.split('.').map(Number)

    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0
      const n2 = p2[i] || 0
      if (n1 > n2) {
        return true
      }
      if (n1 < n2) {
        return false
      }
    }
    return false
  }
}

module.exports = new UpdateService()
