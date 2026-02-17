#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}===== Claude Relay Service - Staging Deployment =====${NC}\n"

# Check if .env.staging exists
if [ ! -f .env.staging ]; then
    echo -e "${YELLOW}Warning: .env.staging not found. Creating from template...${NC}"
    cp .env.staging .env.staging.local
    echo -e "${YELLOW}Please edit .env.staging.local with your configuration.${NC}"
    exit 1
fi

# Load environment variables
if [ -f .env.staging.local ]; then
    export $(cat .env.staging.local | grep -v '^#' | xargs)
fi

echo -e "${GREEN}Step 1: Building Docker image...${NC}"
docker-compose -f docker-compose.staging.yml build

echo -e "\n${GREEN}Step 2: Stopping existing containers...${NC}"
docker-compose -f docker-compose.staging.yml down

echo -e "\n${GREEN}Step 3: Starting staging containers...${NC}"
docker-compose -f docker-compose.staging.yml up -d

echo -e "\n${GREEN}Step 4: Waiting for services to be healthy...${NC}"
sleep 10

# Check health
echo -e "\n${GREEN}Step 5: Checking service health...${NC}"
MAX_ATTEMPTS=12
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker-compose -f docker-compose.staging.yml ps | grep -q "claude-relay-staging.*healthy"; then
        echo -e "${GREEN}✓ Staging service is healthy${NC}"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo -e "${YELLOW}Waiting for service to be healthy... ($ATTEMPT/$MAX_ATTEMPTS)${NC}"
    sleep 5
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}✗ Service health check failed${NC}"
    echo -e "\n${YELLOW}Showing recent logs:${NC}"
    docker-compose -f docker-compose.staging.yml logs --tail=50 claude-relay-staging
    exit 1
fi

echo -e "\n${GREEN}===== Deployment Complete =====${NC}"
echo -e "${GREEN}Staging URL: http://localhost:3012${NC}"
echo -e "${GREEN}Health Check: http://localhost:3012/health${NC}\n"

echo -e "${YELLOW}Showing logs (Ctrl+C to exit, containers continue running):${NC}\n"
docker-compose -f docker-compose.staging.yml logs -f
