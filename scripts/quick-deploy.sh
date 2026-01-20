#!/bin/bash

# Quick Deployment Script for Protec Server
# Usage: ./quick-deploy.sh [ENCRYPTION_KEY] [DATABASE_URL]
#
# Example: ./quick-deploy.sh "32-char-key" "postgresql://user:pass@localhost:5432/sub2api?sslmode=disable"
# Prerequisites
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROTEC_HOST="admin.cloud.obeskay.com"
PROTEC_USER="obed.woow"
DEPLOY_PATH="/opt/sub2api"
MIGRATION_SCRIPT="./scripts/migrate-complete.js"
SQL_MIGRATION="./analysis_sub2api/backend/migrations/035_add_api_key_hash_mappings.sql"

# Arguments
ENCRYPTION_KEY="${1:-}"
DATABASE_URL="${2:-}"

# Validation
if [ -z "$ENCRYPTION_KEY" ]; then
    echo -e "${RED}ERROR: ENCRYPTION_KEY not provided${NC}"
    echo "Usage: $0 [ENCRYPTION_KEY] [DATABASE_URL]"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not provided${NC}"
    echo "Usage: $0 [ENCRYPTION_KEY] [DATABASE_URL]"
    exit 1
fi

# Check ENCRYPTION_KEY length
if [ ${#ENCRYPTION_KEY} -ne 32 ]; then
    echo -e "${YELLOW}WARNING: ENCRYPTION_KEY should be exactly 32 characters${NC}"
    echo "Current length: ${#ENCRYPTION_KEY}"
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Quick Deployment Script${NC}"
echo -e "${GREEN}  Target: $PROTEC_HOST${NC}"
echo -e "${GREEN}========================================${NC}"
echo

# Step 1: Verify SSH access
echo -e "${GREEN}[Step 1/10]${NC} Verifying SSH access to $PROTEC_HOST..."
if ! ssh -o ConnectTimeout=5 $PROTEC_USER@$PROTEC_HOST "echo 'SSH connection successful'"; then
    echo -e "${RED}ERROR: Cannot connect to $PROTEC_HOST via SSH${NC}"
    echo "Please ensure:"
    echo "  - SSH key is added to authorized_keys"
    echo "  - Server is accessible"
    echo "  - Username is correct ($PROTEC_USER)"
    exit 1
fi
echo -e "${GREEN}✓ SSH access verified${NC}"
echo

# Step 2: Check PostgreSQL
echo -e "${GREEN}[Step 2/10]${NC} Checking PostgreSQL on $PROTEC_HOST..."
if ! ssh $PROTEC_USER@$PROTEC_HOST "which psql > /dev/null 2>&1"; then
    echo -e "${YELLOW}WARNING: PostgreSQL not found or not in PATH${NC}"
    echo "Attempting to install PostgreSQL..."

    # Try common installation methods
    ssh $PROTEC_USER@$PROTEC_HOST bash -c "
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib
        elif command -v yum &> /dev/null; then
            sudo yum install -y postgresql postgresql-server
        elif command -v brew &> /dev/null; then
            brew install postgresql
        else
            echo 'ERROR: Cannot detect package manager'
            exit 1
        fi
    "
    echo -e "${GREEN}✓ PostgreSQL installed${NC}"
else
    echo -e "${GREEN}✓ PostgreSQL found${NC}"
fi
echo

# Step 3: Create database and user
echo -e "${GREEN}[Step 3/10]${NC} Setting up database..."

# Extract connection details
DB_USER=$(echo $DATABASE_URL | grep -oP '(?<=://)[^:]+')
DB_PASS=$(echo $DATABASE_URL | grep -oP '(?<=:)[^@]+')
DB_HOST=$(echo $DATABASE_URL | grep -oP '(?<=@)[^:]+')
DB_NAME=$(echo $DATABASE_URL | grep -oP '(?<=/)[^?]+')

echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Host: $DB_HOST"

# Create database if not exists
ssh $PROTEC_USER@$PROTEC_HOST bash -c "
    PGPASSWORD='$DB_PASS' psql -h $DB_HOST -U $DB_USER -tc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\" 2>/dev/null || \
    PGPASSWORD='$DB_PASS' psql -h $DB_HOST -U $DB_USER -c \"CREATE DATABASE $DB_NAME\"
" && echo -e "${GREEN}✓ Database setup complete${NC}" || echo -e "${YELLOW}WARNING: Database setup may have failed${NC}"
echo

# Step 4: Create deployment directory
echo -e "${GREEN}[Step 4/10]${NC} Creating deployment directory..."
ssh $PROTEC_USER@$PROTEC_HOST "mkdir -p $DEPLOY_PATH"
echo -e "${GREEN}✓ Deployment directory ready${NC}"
echo

# Step 5: Upload SQL migration file
echo -e "${GREEN}[Step 5/10]${NC} Uploading SQL migration file..."
if [ -f "$SQL_MIGRATION" ]; then
    scp "$SQL_MIGRATION" $PROTEC_USER@$PROTEC_HOST:$DEPLOY_PATH/
    echo -e "${GREEN}✓ SQL migration uploaded${NC}"
else
    echo -e "${YELLOW}WARNING: SQL migration file not found: $SQL_MIGRATION${NC}"
fi
echo

# Step 6: Upload migration script
echo -e "${GREEN}[Step 6/10]${NC} Uploading migration script..."
if [ -f "$MIGRATION_SCRIPT" ]; then
    scp "$MIGRATION_SCRIPT" $PROTEC_USER@$PROTEC_HOST:$DEPLOY_PATH/
    echo -e "${GREEN}✓ Migration script uploaded${NC}"
else
    echo -e "${YELLOW}WARNING: Migration script not found: $MIGRATION_SCRIPT${NC}"
fi
echo

# Step 7: Apply SQL migration
echo -e "${GREEN}[Step 7/10]${NC} Applying SQL migration..."
if [ -f "$SQL_MIGRATION" ]; then
    ssh $PROTEC_USER@$PROTEC_HOST bash -c "
        PGPASSWORD='$DB_PASS' psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f $DEPLOY_PATH/$(basename $SQL_MIGRATION)
    "
    echo -e "${GREEN}✓ SQL migration applied${NC}"
else
    echo -e "${YELLOW}SKIPPED: SQL migration file not found${NC}"
fi
echo

# Step 8: Configure environment variables
echo -e "${GREEN}[Step 8/10]${NC} Configuring environment variables..."

ENV_FILE="$DEPLOY_PATH/.env"

ssh $PROTEC_USER@$PROTEC_HOST "cat > $ENV_FILE <<EOF
DATABASE_URL=$DATABASE_URL
ENCRYPTION_KEY=$ENCRYPTION_KEY
JWT_SECRET=\$(openssl rand -base64 32)
NODE_ENV=production
EOF
"

echo -e "${GREEN}✓ Environment variables configured${NC}"
echo "  DATABASE_URL: $DATABASE_URL"
echo "  ENCRYPTION_KEY: $ENCRYPTION_KEY (set)"
echo "  JWT_SECRET: (randomly generated)"
echo

# Step 9: Execute migration script
echo -e "${GREEN}[Step 9/10]${NC} Executing migration script..."

ssh $PROTEC_USER@$PROTEC_HOST bash -c "
    cd $DEPLOY_PATH
    export DATABASE_URL='$DATABASE_URL'
    export ENCRYPTION_KEY='$ENCRYPTION_KEY'
    export REDIS_URL='redis://localhost:6379'
    node $DEPLOY_PATH/$(basename $MIGRATION_SCRIPT)
" && echo -e "${GREEN}✓ Migration script executed${NC}" || echo -e "${RED}ERROR: Migration script failed${NC}"
echo

# Step 10: Verify deployment
echo -e "${GREEN}[Step 10/10]${NC} Verifying deployment..."

echo "Checking for API keys..."
API_KEY_COUNT=$(ssh $PROTEC_USER@$PROTEC_HOST bash -c "
    PGPASSWORD='$DB_PASS' psql -h $DB_HOST -U $DB_USER -d $DB_NAME -tc \"SELECT COUNT(*) FROM api_keys\"
" 2>/dev/null || echo "0")

echo "  API keys migrated: $API_KEY_COUNT"

echo "Checking for users..."
USER_COUNT=$(ssh $PROTEC_USER@$PROTEC_HOST bash -c "
    PGPASSWORD='$DB_PASS' psql -h $DB_HOST -U $DB_USER -d $DB_NAME -tc \"SELECT COUNT(*) FROM users\"
" 2>/dev/null || echo "0")

echo "  Users migrated: $USER_COUNT"

echo "Checking for hash mappings..."
HASH_COUNT=$(ssh $PROTEC_USER@$PROTEC_HOST bash -c "
    PGPASSWORD='$DB_PASS' psql -h $DB_HOST -U $DB_USER -d $DB_NAME -tc \"SELECT COUNT(*) FROM api_key_hash_mappings\"
" 2>/dev/null || echo "0")

echo "  Hash mappings created: $HASH_COUNT"
echo

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo "Next steps:"
echo "  1. Start the sub2api service"
echo "  2. Test API keys with 'cr_' prefix"
echo "  3. Test user login: obeskay.mail@gmail.com / iQf1nd3r00!"
echo "  4. Monitor logs for errors"
echo
echo "Useful commands:"
echo "  - Check logs: ssh $PROTEC_USER@$PROTEC_HOST 'tail -f $DEPLOY_PATH/logs/*.log'"
echo "  - Restart service: ssh $PROTEC_USER@$PROTEC_HOST 'cd $DEPLOY_PATH && npm restart'"
echo "  - Check health: curl https://$PROTEC_HOST/health"
echo

exit 0
