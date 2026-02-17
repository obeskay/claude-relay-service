#!/bin/bash

# OpenClaw PI Agent Deployment Script for Coolify VPS
# This script deploys the PI agent to your Coolify infrastructure

set -e

echo "🚀 OpenClaw PI Agent Deployment Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="claude-relay-service"
PI_AGENT_DIR="/var/www/${PROJECT_NAME}/pi-agent"
SERVICE_NAME="openclaw-pi"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root or with sudo${NC}"
  exit 1
fi

# Function to print colored output
print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
  print_error "Node.js is not installed"
  exit 1
fi
print_success "Node.js $(node --version) found"

# Check npm
if ! command -v npm &> /dev/null; then
  print_error "npm is not installed"
  exit 1
fi
print_success "npm $(npm --version) found"

# Check PM2
if ! command -v pm2 &> /dev/null; then
  print_warning "PM2 not found. Installing..."
  npm install -g pm2
  print_success "PM2 installed"
fi
print_success "PM2 $(pm2 --version) found"

# Verify project directory exists
if [ ! -d "/var/www/${PROJECT_NAME}" ]; then
  print_error "Project directory not found: /var/www/${PROJECT_NAME}"
  exit 1
fi
print_success "Project directory found"

cd "/var/www/${PROJECT_NAME}"

# Check environment variables
echo ""
echo "🔐 Checking environment variables..."

if [ ! -f ".env" ]; then
  print_error ".env file not found"
  exit 1
fi

# Source .env file
set -a
source .env
set +a

# Check required variables
REQUIRED_VARS=("TELEGRAM_BOT_TOKEN" "TELEGRAM_CHAT_ID")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  print_error "Missing required environment variables:"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  exit 1
fi

print_success "All required environment variables found"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
print_success "Dependencies installed"

# Create logs directory
mkdir -p logs
print_success "Logs directory created"

# Create metrics directory
mkdir -p .openclaw-metrics
print_success "Metrics directory created"

# Test Telegram connection
echo ""
echo "📡 Testing Telegram connection..."
if node init-telegram.js; then
  print_success "Telegram connection verified"
else
  print_error "Telegram connection failed"
  exit 1
fi

# Create PM2 ecosystem file if it doesn't exist
echo ""
echo "📝 Creating PM2 ecosystem configuration..."

cat > ecosystem.pi-agent.config.js <<EOF
module.exports = {
  apps: [{
    name: '${SERVICE_NAME}',
    script: './pi-agent/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    error_file: './logs/pi-agent-error.log',
    out_file: './logs/pi-agent-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000
  }]
};
EOF

print_success "PM2 ecosystem configuration created"

# Start PI agent with PM2
echo ""
echo "🤖 Starting PI agent with PM2..."

pm2 start ecosystem.pi-agent.config.js --only "${SERVICE_NAME}" || pm2 restart "${SERVICE_NAME}"
print_success "PI agent started"

# Save PM2 configuration
pm2 save
print_success "PM2 configuration saved"

# Setup PM2 startup script
if ! pm2 startup | grep -q "already been"; then
  echo ""
  print_warning "Run the following command to enable PM2 startup on boot:"
  pm2 startup
fi

# Display status
echo ""
echo "📊 PI Agent Status:"
pm2 status

echo ""
echo "========================================"
print_success "PI Agent deployment complete!"
echo ""
echo "📱 Useful Commands:"
echo "  View logs:        pm2 logs ${SERVICE_NAME}"
echo "  Restart:          pm2 restart ${SERVICE_NAME}"
echo "  Stop:             pm2 stop ${SERVICE_NAME}"
echo "  Health check:     npm run pi:health"
echo "  Test alert:       npm run pi:test-alert"
echo "  View metrics:     npm run pi:metrics"
echo ""
echo "📖 Full documentation: PI-AGENT-SETUP.md"
echo "========================================"
