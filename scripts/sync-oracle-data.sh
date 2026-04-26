#!/bin/bash

# Oracle Cloud Data Sync Script for Mr. Roboto V3
# Bidirectional sync between local and Oracle VM

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
readonly ORACLE_USER="ubuntu"
readonly REMOTE_DIR="~/mrroboto"

# Function to print colored output
print_info() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Sync data between local machine and Oracle Cloud VM

Required Environment:
  ORACLE_IP         Public IP address of your Oracle VM

Optional Environment:
  ORACLE_SSH_KEY    Path to SSH private key (omit if using SSH agent like 1Password)

Options:
  --download        Download data from VM to local (default)
  --upload          Upload local data to VM
  --backup          Create timestamped backup before download
  -h, --help        Show this help message

Examples:
  # Download data from VM (default)
  ORACLE_IP=144.24.xxx.xxx ./scripts/sync-oracle-data.sh

  # Download with local backup first
  ORACLE_IP=144.24.xxx.xxx ./scripts/sync-oracle-data.sh --backup

  # Upload local data to VM
  ORACLE_IP=144.24.xxx.xxx ./scripts/sync-oracle-data.sh --upload

EOF
    exit 1
}

# Parse command line arguments
MODE="download"
CREATE_BACKUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --download)
            MODE="download"
            shift
            ;;
        --upload)
            MODE="upload"
            shift
            ;;
        --backup)
            CREATE_BACKUP=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required environment variables
if [[ -z "${ORACLE_IP}" ]]; then
    print_error "ORACLE_IP environment variable is required"
    echo "Example: ORACLE_IP=144.24.xxx.xxx ./scripts/sync-oracle-data.sh"
    exit 1
fi

# Set SSH key path (optional for SSH agent users)
if [[ -n "${ORACLE_SSH_KEY}" ]]; then
    if [[ ! -f "${ORACLE_SSH_KEY}" ]]; then
        print_error "SSH key not found: ${ORACLE_SSH_KEY}"
        exit 1
    fi
    SSH_KEY_ARG="-i ${ORACLE_SSH_KEY}"
else
    # Using SSH agent (e.g., 1Password)
    SSH_KEY_ARG=""
fi

# SCP command wrapper
scp_copy() {
    scp ${SSH_KEY_ARG} -o StrictHostKeyChecking=no "$@"
}

# SSH command wrapper
ssh_exec() {
    ssh ${SSH_KEY_ARG} -o StrictHostKeyChecking=no "${ORACLE_USER}@${ORACLE_IP}" "$@"
}

echo "================================================================"
echo "  Mr. Roboto V3 - Oracle Data Sync"
echo "================================================================"
echo ""
echo "Oracle VM IP: ${ORACLE_IP}"
if [[ -n "${ORACLE_SSH_KEY}" ]]; then
    echo "SSH Key: ${ORACLE_SSH_KEY}"
else
    echo "SSH: Using SSH agent"
fi
echo "Mode: ${MODE}"
echo ""

# Test SSH connection
print_info "Testing SSH connection..."
if ! ssh_exec "echo 'Connection successful'" > /dev/null 2>&1; then
    print_error "Cannot connect to Oracle VM"
    exit 1
fi

if [[ "$MODE" == "download" ]]; then
    # Create backup of local data if requested
    if [[ "$CREATE_BACKUP" == "true" ]] && [[ -d "./data" ]]; then
        BACKUP_DIR="./data-backup-$(date +%Y%m%d-%H%M%S)"
        print_info "Creating local backup: $BACKUP_DIR"
        cp -r ./data "$BACKUP_DIR"
        print_info "Local backup created"
    fi

    # Download data from VM
    print_info "Downloading data from Oracle VM..."
    mkdir -p ./data
    scp_copy -r "${ORACLE_USER}@${ORACLE_IP}:${REMOTE_DIR}/data/" ./
    
    # Get file count and size
    FILE_COUNT=$(find ./data -type f | wc -l | tr -d ' ')
    DATA_SIZE=$(du -sh ./data | cut -f1)
    
    print_info "Downloaded $FILE_COUNT files ($DATA_SIZE total)"
    
elif [[ "$MODE" == "upload" ]]; then
    # Upload data to VM
    if [[ ! -d "./data" ]]; then
        print_error "Local data directory not found"
        exit 1
    fi
    
    print_warn "This will overwrite data on the Oracle VM"
    read -p "Continue? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        exit 0
    fi
    
    # Create remote directory if it doesn't exist
    print_info "Ensuring remote directory exists..."
    ssh_exec "mkdir -p ${REMOTE_DIR}/data"
    
    print_info "Uploading data to Oracle VM (excluding *_example files)..."
    # Use rsync to exclude _example files
    rsync -avz --exclude='*_example' ${SSH_KEY_ARG} ./data/ "${ORACLE_USER}@${ORACLE_IP}:${REMOTE_DIR}/data/"
    
    # Get file count and size (excluding _example files)
    FILE_COUNT=$(find ./data -type f ! -name '*_example' | wc -l | tr -d ' ')
    DATA_SIZE=$(du -sh ./data | cut -f1)
    
    print_info "Uploaded $FILE_COUNT files ($DATA_SIZE total)"
    
    print_warn "You may need to restart the bot for changes to take effect:"
    if [[ -n "${ORACLE_SSH_KEY}" ]]; then
        echo "  ssh -i ${ORACLE_SSH_KEY} ${ORACLE_USER}@${ORACLE_IP} 'docker restart mrroboto'"
    else
        echo "  ssh ${ORACLE_USER}@${ORACLE_IP} 'docker restart mrroboto'"
    fi
fi

echo ""
print_info "Sync complete"
