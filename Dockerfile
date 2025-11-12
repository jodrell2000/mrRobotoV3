# Use official Node.js runtime as the base image
# Using Node.js 18 LTS for stability
FROM node:18-alpine

# Set metadata for the image
LABEL maintainer="MrRobotoV3 Team"
LABEL description="Discord bot for hang.fm - Version 3"
LABEL version="1.0.0"

# Create app directory
WORKDIR /usr/src/app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mrroboto -u 1001 -G nodejs

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
# Use npm install if package-lock.json doesn't exist, otherwise use npm ci
RUN if [ -f package-lock.json ]; then \
        npm ci --omit=dev; \
    else \
        npm install --omit=dev; \
    fi && \
    npm cache clean --force

# Copy application source code
COPY --chown=mrroboto:nodejs . .

# Create necessary directories with proper permissions
RUN mkdir -p logs && \
    chown -R mrroboto:nodejs logs && \
    chmod 755 logs

# Ensure data directory and botConfig.json exist with proper permissions
RUN mkdir -p data && \
    touch data/botConfig.json && \
    chown -R mrroboto:nodejs data && \
    chmod -R 755 data && \
    chmod 644 data/botConfig.json

# Switch to non-root user
USER mrroboto

# Expose port (if needed for health checks or future web interface)
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Set default environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Start the application
CMD ["npm", "start"]