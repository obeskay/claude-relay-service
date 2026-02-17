#!/bin/bash

# User Migration Script Wrapper
#
# This script provides a convenient wrapper for the Node.js migration script
# with environment variable configuration.
#
# Usage:
#   ./scripts/migrate-users.sh [options]
#
# Examples:
#   # Dry run (preview only)
#   ./scripts/migrate-users.sh --dry-run
#
#   # Full migration
#   ./scripts/migrate-users.sh
#
#   # Migrate only API keys
#   ./scripts/migrate-users.sh --types=apikeys
#
#   # Migrate specific data types
#   ./scripts/migrate-users.sh --types=apikeys,claude,gemini
#
# Environment Variables (optional):
#   SOURCE_REDIS_HOST       Source Redis host (default: localhost)
#   SOURCE_REDIS_PORT       Source Redis port (default: 6379)
#   SOURCE_REDIS_PASSWORD   Source Redis password
#   SOURCE_REDIS_DB         Source Redis DB (default: 0)
#
#   TARGET_REDIS_HOST       Target Redis host (default: localhost)
#   TARGET_REDIS_PORT       Target Redis port (default: 6379)
#   TARGET_REDIS_PASSWORD   Target Redis password
#   TARGET_REDIS_DB         Target Redis DB (default: 0)

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values (can be overridden by environment variables)
SOURCE_REDIS_HOST=${SOURCE_REDIS_HOST:-localhost}
SOURCE_REDIS_PORT=${SOURCE_REDIS_PORT:-6379}
SOURCE_REDIS_PASSWORD=${SOURCE_REDIS_PASSWORD:-}
SOURCE_REDIS_DB=${SOURCE_REDIS_DB:-0}

TARGET_REDIS_HOST=${TARGET_REDIS_HOST:-localhost}
TARGET_REDIS_PORT=${TARGET_REDIS_PORT:-6379}
TARGET_REDIS_PASSWORD=${TARGET_REDIS_PASSWORD:-}
TARGET_REDIS_DB=${TARGET_REDIS_DB:-0}

# Export environment variables for the Node.js script
export SOURCE_REDIS_HOST
export SOURCE_REDIS_PORT
export SOURCE_REDIS_PASSWORD
export SOURCE_REDIS_DB
export TARGET_REDIS_HOST
export TARGET_REDIS_PORT
export TARGET_REDIS_PASSWORD
export TARGET_REDIS_DB

# Run the Node.js migration script
echo "🚀 Starting user migration..."
echo ""

node "$SCRIPT_DIR/migrate-users.js" "$@"

echo ""
echo "✅ Migration script completed"
