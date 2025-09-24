#!/bin/bash

# Script to fix .env file for Docker Compose compatibility
# Wraps all values in quotes to handle special characters

ENV_FILE=".env"
TEMP_FILE=".env.temp"
BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found!"
    exit 1
fi

echo "🔧 Fixing .env file for Docker Compose compatibility..."

# Create backup
cp "$ENV_FILE" "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"

# Process the file
while IFS= read -r line; do
    if [[ $line =~ ^[[:space:]]*# ]] || [[ -z "${line// }" ]]; then
        # Keep comments and empty lines as-is
        echo "$line" >> "$TEMP_FILE"
    elif [[ $line =~ ^([^=]+)=(.*)$ ]]; then
        # Extract key and value
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        
        # Remove existing quotes if present
        value="${value#\"}"
        value="${value%\"}"
        value="${value#\'}"
        value="${value%\'}"
        
        # Write with double quotes
        echo "${key}=\"${value}\"" >> "$TEMP_FILE"
    else
        # Keep other lines as-is
        echo "$line" >> "$TEMP_FILE"
    fi
done < "$ENV_FILE"

# Replace original file
mv "$TEMP_FILE" "$ENV_FILE"

echo "✅ .env file has been fixed!"
echo "🧪 Testing Docker Compose configuration..."

if docker-compose config --quiet > /dev/null 2>&1; then
    echo "✅ Docker Compose configuration is now valid!"
else
    echo "❌ Still having issues. Restoring backup..."
    mv "$BACKUP_FILE" "$ENV_FILE"
    echo "💡 Consider using environment variables directly instead of .env file"
    exit 1
fi

echo "🐳 Ready to run: docker-compose up -d"