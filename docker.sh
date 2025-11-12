#!/bin/bash

# MrRobotoV3 Docker Management Script

# Function to detect and set Docker Compose command
detect_docker_compose() {
    if command -v docker-compose > /dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker-compose"
        print_status "Using legacy docker-compose command"
    elif docker compose version > /dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker compose"
        print_status "Using modern docker compose command"
    else
        print_error "Neither 'docker-compose' nor 'docker compose' is available."
        print_error "Please install Docker Compose."
        exit 1
    fi
}

# Provides easy commands for common Docker operations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Function to detect and set Docker Compose command
detect_docker_compose() {
    if command -v docker-compose > /dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker-compose"
        print_status "Using legacy docker-compose command"
    elif docker compose version > /dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker compose"
        print_status "Using modern docker compose command"
    else
        print_error "Neither 'docker-compose' nor 'docker compose' is available."
        print_error "Please install Docker Compose."
        exit 1
    fi
}

# Initialize Docker Compose command
detect_docker_compose

# Check if Docker is running
check_docker() {
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Check if .env file exists
check_env() {
    if [ ! -f ".env" ]; then
        print_error ".env file not found!"
        print_warning "Please copy .env_example to .env and configure it:"
        echo "  cp .env_example .env"
        echo "  # Edit .env with your bot configuration"
        exit 1
    fi
}

# Show usage
show_help() {
    echo "MrRobotoV3 Docker Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start         Start the bot (production mode)"
    echo "  start-dev     Start the bot in development mode"
    echo "  stop          Stop the bot"
    echo "  restart       Restart the bot"
    echo "  rebuild       Rebuild and restart the bot"
    echo "  logs          Show bot logs"
    echo "  logs-f        Follow bot logs in real-time"
    echo "  status        Show bot status"
    echo "  shell         Access bot container shell"
    echo "  clean         Clean up containers and images"
    echo "  backup        Backup bot data"
    echo "  test          Run tests in container"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start       # Start the bot"
    echo "  $0 logs-f      # Watch logs in real-time"
    echo "  $0 restart     # Restart the bot"
}

# Start bot (production)
start_bot() {
    print_header "Starting MrRobotoV3 Bot (Production)"
    check_docker
    check_env
    $DOCKER_COMPOSE_CMD up -d
    print_status "Bot started successfully!"
    print_status "Use '$0 logs' to view logs or '$0 status' to check status"
}

# Start bot (development)
start_dev() {
    print_header "Starting MrRobotoV3 Bot (Development)"
    check_docker
    check_env
    $DOCKER_COMPOSE_CMD -f docker-compose.yml -f docker-compose.dev.yml up -d
    print_status "Bot started in development mode!"
    print_status "Source code changes will trigger automatic restarts"
}

# Stop bot
stop_bot() {
    print_header "Stopping MrRobotoV3 Bot"
    $DOCKER_COMPOSE_CMD down
    print_status "Bot stopped successfully!"
}

# Restart bot
restart_bot() {
    print_header "Restarting MrRobotoV3 Bot"
    $DOCKER_COMPOSE_CMD restart
    print_status "Bot restarted successfully!"
}

# Rebuild and restart
rebuild_bot() {
    print_header "Rebuilding and Restarting MrRobotoV3 Bot"
    $DOCKER_COMPOSE_CMD down
    $DOCKER_COMPOSE_CMD build --no-cache
    $DOCKER_COMPOSE_CMD up -d
    print_status "Bot rebuilt and restarted successfully!"
}

# Show logs
show_logs() {
    print_header "MrRobotoV3 Bot Logs"
    $DOCKER_COMPOSE_CMD logs --tail=50
}

# Follow logs
follow_logs() {
    print_header "Following MrRobotoV3 Bot Logs (Press Ctrl+C to exit)"
    $DOCKER_COMPOSE_CMD logs -f
}

# Show status
show_status() {
    print_header "MrRobotoV3 Bot Status"
    $DOCKER_COMPOSE_CMD ps
    echo ""
    
    if $DOCKER_COMPOSE_CMD ps | grep -q "Up"; then
        print_status "Bot is running"
        
        # Show resource usage
        echo ""
        print_header "Resource Usage"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $($DOCKER_COMPOSE_CMD ps -q) 2>/dev/null || true
        
        # Show health status
        echo ""
        print_header "Health Status"
        CONTAINER_ID=$($DOCKER_COMPOSE_CMD ps -q)
        if [ ! -z "$CONTAINER_ID" ]; then
            HEALTH=$(docker inspect $CONTAINER_ID --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
            echo "Health: $HEALTH"
        fi
    else
        print_warning "Bot is not running"
    fi
}

# Access shell
access_shell() {
    print_header "Accessing MrRobotoV3 Bot Container Shell"
    if $DOCKER_COMPOSE_CMD ps | grep -q "Up"; then
        $DOCKER_COMPOSE_CMD exec mrroboto sh
    else
        print_error "Bot is not running. Start it first with '$0 start'"
        exit 1
    fi
}

# Clean up
clean_up() {
    print_header "Cleaning Up Docker Resources"
    print_warning "This will remove containers, networks, and unused images"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $DOCKER_COMPOSE_CMD down -v
        docker system prune -f
        print_status "Cleanup completed!"
    else
        print_status "Cleanup cancelled"
    fi
}

# Backup data
backup_data() {
    print_header "Backing Up Bot Data"
    BACKUP_DIR="backups"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    mkdir -p $BACKUP_DIR
    
    if [ -f "data/botConfig.json" ]; then
        cp data/botConfig.json "$BACKUP_DIR/botConfig.json.backup.$TIMESTAMP"
        print_status "botConfig.json backed up to $BACKUP_DIR/botConfig.json.backup.$TIMESTAMP"
    fi
    
    if [ -d "logs" ]; then
        tar -czf "$BACKUP_DIR/logs_backup_$TIMESTAMP.tar.gz" logs/
        print_status "Logs backed up to $BACKUP_DIR/logs_backup_$TIMESTAMP.tar.gz"
    fi
    
    print_status "Backup completed!"
}

# Run tests
run_tests() {
    print_header "Running Tests in Container"
    check_docker
    $DOCKER_COMPOSE_CMD run --rm mrroboto npm test
}

# Main script logic
case "${1:-}" in
    start)
        start_bot
        ;;
    start-dev)
        start_dev
        ;;
    stop)
        stop_bot
        ;;
    restart)
        restart_bot
        ;;
    rebuild)
        rebuild_bot
        ;;
    logs)
        show_logs
        ;;
    logs-f)
        follow_logs
        ;;
    status)
        show_status
        ;;
    shell)
        access_shell
        ;;
    clean)
        clean_up
        ;;
    backup)
        backup_data
        ;;
    test)
        run_tests
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: ${1:-}"
        echo ""
        show_help
        exit 1
        ;;
esac
