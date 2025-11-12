# Docker Setup Guide for MrRobotoV3

This guide will help you run MrRobotoV3 in Docker containers for consistent, isolated execution across different systems.

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 1.27+ installed (or Docker Desktop with Compose support)

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd mrRobotoV3

# create bespoke .env and data files for your Bot
cp .env_example .env
cp data/botConfig.json_example data/botConfig.json
cp data/chat.json_example data/chat.json
cp data/aliases.json_example data/aliases.json
cp data/themes.json_example data/themes.json
# Edit the .env and data files with your actual values (see [SETTING_UP_YOUR_ENVIRONMENT.md](./SETTING_UP_YOUR_ENVIRONMENT.md))
```

### 2. Build and Run with Docker Compose (Recommended)

```bash
# Build and start the bot
docker compose up -d

# Check if it's running
docker compose ps

# View logs
docker compose logs -f

# Stop the bot
docker compose down
```

### 3. Alternative: Direct Docker Commands

```bash
# Build the image
docker build -t mrroboto:latest .

# Run the container
docker run -d \
  --name mrroboto-bot \
  --env-file .env \
  -v $(pwd)/data:/usr/src/app/data \
  -v $(pwd)/logs:/usr/src/app/logs \
  --restart unless-stopped \
  mrroboto:latest
```

## Configuration

### Environment Variables

The bot uses the same environment variables as the non-Docker version. Ensure your `.env` file contains:

```env
BOT_USER_TOKEN=your-bot-token
COMETCHAT_AUTH_TOKEN=your-comet-chat-token
BOT_UID=your-bot-uuid
HANGOUT_ID=your-hangout-uuid
COMMAND_SWITCH="/"
LOG_LEVEL=info
SOCKET_MESSAGE_LOG_LEVEL=OFF
```

### Persistent Data

The Docker setup automatically handles:
- **data/botConfig.json**: Bot's memory/configuration (persisted via volume mount)
- **logs/**: Application logs (persisted via volume mount)

## Managing the Bot

### Viewing Logs

```bash
# View Docker container logs (startup and basic output)
docker compose logs

# Follow Docker container logs in real-time
docker compose logs -f

# View only recent Docker logs
docker compose logs --tail=50

# View Docker logs for specific time period
docker compose logs --since="2023-01-01T00:00:00"

# View application logs (detailed bot activity)
# Note: The bot writes detailed logs to files in the logs/ directory
tail -f logs/$(date +%Y-%m-%d).log

# View recent application log entries
tail -50 logs/$(date +%Y-%m-%d).log

# Search for specific events in application logs
grep -i "error\|warn\|failed" logs/$(date +%Y-%m-%d).log

# Follow all log files in real-time
tail -f logs/*.log
```

### Restarting the Bot

```bash
# Restart the bot
docker compose restart

# Rebuild and restart (after code changes)
docker compose up -d --build
```

### Updating the Bot

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose down
docker compose up -d --build
```

### Health Monitoring

```bash
# Check container health
docker compose ps

# Get detailed health status
docker inspect mrroboto-bot --format='{{.State.Health.Status}}'

# View health check logs
docker inspect mrroboto-bot --format='{{range .State.Health.Log}}{{.Output}}{{end}}'
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs for errors
docker compose logs

# Check if .env file exists and is readable
ls -la .env

# Verify environment variables
docker compose config
```

#### 2. Environment Variable Parsing Errors

If you see errors like "unexpected character" when running `docker compose config`, this is usually due to special characters in JWT tokens in your `.env` file.

**Solution A: Quote your environment variables**
```env
BOT_USER_TOKEN="your-jwt-token-here"
COMETCHAT_AUTH_TOKEN="your-comet-token-here"
```

**Solution B: Use direct environment variables in docker-compose.yml**
Comment out `env_file: - .env` and uncomment the environment section:
```yaml
environment:
  - BOT_USER_TOKEN=${BOT_USER_TOKEN}
  - COMETCHAT_AUTH_TOKEN=${COMETCHAT_AUTH_TOKEN}
  - BOT_UID=${BOT_UID}
  - HANGOUT_ID=${HANGOUT_ID}
  - COMMAND_SWITCH=${COMMAND_SWITCH}
```

**Solution C: Use environment variable substitution**
```bash
# Set environment variables in your shell
export BOT_USER_TOKEN="your-token"
export COMETCHAT_AUTH_TOKEN="your-token"

# Then run docker-compose
docker compose up -d
```

#### 3. Permission Issues

```bash
# Fix file permissions
chmod 644 .env
chmod 644 data/botConfig.json
chmod 755 logs/
```

#### 3. Memory/Resource Issues

```bash
# Check resource usage
docker stats mrroboto-bot

# Increase memory limits in docker-compose.yml if needed
```

#### 4. Network Connectivity Issues

```bash
# Test network connectivity from inside container
docker compose exec mrroboto sh
# Then: ping google.com or curl https://gateway.prod.tt.fm
```

### Debugging

#### Access Container Shell

```bash
# Access running container
docker compose exec mrroboto sh

# Run a new container for debugging
docker run -it --env-file .env mrroboto:latest sh
```

#### Inspect Configuration

```bash
# View effective configuration
docker compose config

# Check environment variables in container
docker compose exec mrroboto env
```

## Advanced Configuration

### Custom Resource Limits

Edit `docker-compose.yml` to adjust resource limits:

```yaml
deploy:
  resources:
    limits:
      memory: 1G      # Increase if needed
      cpus: '1.0'     # Increase if needed
```

### Custom Logging

```yaml
logging:
  driver: "syslog"  # Or "journald", "fluentd", etc.
  options:
    syslog-address: "tcp://localhost:514"
```

### Multiple Environments

Create environment-specific compose files:

```bash
# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Security Considerations

- The container runs as a non-root user (`mrroboto`)
- Sensitive data (tokens) are passed via environment variables
- Network access is limited to what the bot needs
- Resource limits prevent runaway processes
- Regular security updates via base image updates

## Backup and Recovery

### Backup Bot Data

```bash
# Backup botConfig.json
cp data/botConfig.json data/botConfig.json.backup.$(date +%Y%m%d_%H%M%S)

# Backup logs
tar -czf logs_backup_$(date +%Y%m%d_%H%M%S).tar.gz logs/
```

### Restore Bot Data

```bash
# Stop the bot
docker compose down

# Restore botConfig.json
cp data/botConfig.json.backup.20231201_143000 data/botConfig.json

# Start the bot
docker compose up -d
```

## Performance Optimization

### Build Optimization

```bash
# Build with build cache
docker compose build --parallel

# Build with no cache (clean build)
docker compose build --no-cache
```

### Runtime Optimization

- Use multi-stage builds for smaller images
- Enable Docker BuildKit for faster builds
- Use volume mounts for development, named volumes for production

## Support

If you encounter issues:

1. Check the logs: `docker compose logs`
2. Verify your environment configuration
3. Ensure Docker has sufficient resources allocated
4. Check the troubleshooting section above

For additional help, refer to the main documentation or open an issue in the repository.