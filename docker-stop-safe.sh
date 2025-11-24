#!/bin/bash

# Safe Docker shutdown script
# Gracefully stops containers with proper cleanup to prevent DB corruption

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 MrRoboto Docker Safe Shutdown Script${NC}"
echo "=========================================="

# Determine which Docker Compose command to use
DOCKER_COMPOSE_CMD=""
if command -v docker-compose > /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    echo -e "${RED}❌ Neither 'docker-compose' nor 'docker compose' is available.${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running.${NC}"
    exit 1
fi

# Check if containers are running
if [ -z "$($DOCKER_COMPOSE_CMD ps -q)" ]; then
    echo -e "${YELLOW}⚠️  No containers are currently running${NC}"
    exit 0
fi

echo -e "${BLUE}📊 Current container status:${NC}"
$DOCKER_COMPOSE_CMD ps

echo ""
echo -e "${BLUE}⏳ Gracefully shutting down containers...${NC}"
echo -e "${BLUE}   (Giving applications 30 seconds to shut down cleanly)${NC}"
echo ""

# Stop containers gracefully (30 second timeout)
# This sends SIGTERM first, allowing apps to clean up gracefully
# After 30s, Docker sends SIGKILL if still running
$DOCKER_COMPOSE_CMD stop -t 30

echo ""
echo -e "${GREEN}✅ Containers stopped successfully${NC}"

# Optional: Remove stopped containers to clean up
read -p "Remove stopped containers? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🧹 Removing stopped containers...${NC}"
    $DOCKER_COMPOSE_CMD rm -f
    echo -e "${GREEN}✅ Containers removed${NC}"
else
    echo -e "${YELLOW}⚠️  Containers are stopped but not removed (can restart with docker-start-safe.sh)${NC}"
fi

echo ""
echo -e "${BLUE}📋 Final container status:${NC}"
$DOCKER_COMPOSE_CMD ps -a

echo ""
echo -e "${GREEN}🎉 Shutdown complete!${NC}"
echo ""
echo -e "${YELLOW}ℹ️  Data in ./data/ directory is preserved on your local machine${NC}"
echo ""
