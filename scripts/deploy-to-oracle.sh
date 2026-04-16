#!/bin/bash

# Oracle Cloud Deployment Script for Mr. Roboto V3
# Deploys the bot to an Oracle Cloud VM with data sync

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
readonly ORACLE_USER="ubuntu"
readonly REMOTE_DIR="~/mrroboto"
readonly IMAGE_NAME="ghcr.io/jodrell2000/mrrobotov3:1.0.0-test"
readonly CONTAINER_NAME="mrroboto"

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

Deploy Mr. Roboto V3 to Oracle Cloud VM

Required Environment:
  ORACLE_IP         Public IP address of your Oracle VM

Optional Environment:
  ORACLE_SSH_KEY    Path to SSH private key (omit if using SSH agent like 1Password)

Options:
  --upload-data     Upload local data directory before deployment
  --skip-env        Skip .env file upload (use existing on VM)
  --logs            Show logs after deployment
  -h, --help        Show this help message

Examples:
  # Deploy with data upload
  ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh --upload-data

  # Deploy without data upload (faster, keeps VM data)
  ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh

  # Deploy and watch logs
  ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh --logs

EOF
    exit 1
}

# Parse command line arguments
UPLOAD_DATA=false
SKIP_ENV=false
SHOW_LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --upload-data)
            UPLOAD_DATA=true
            shift
            ;;
        --skip-env)
            SKIP_ENV=true
            shift
            ;;
        --logs)
            SHOW_LOGS=true
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
    echo "Example: ORACLE_IP=144.24.xxx.xxx ./scripts/deploy-to-oracle.sh"
    exit 1
fi

# Set SSH key path (optional for SSH agent users)
if [[ -n "${ORACLE_SSH_KEY}" ]]; then
    if [[ ! -f "${ORACLE_SSH_KEY}" ]]; then
        print_error "SSH key not found: ${ORACLE_SSH_KEY}"
        exit 1
    fi
    
    # Verify SSH key permissions
    KEY_PERMS=$(stat -f "%OLp" "${ORACLE_SSH_KEY}" 2>/dev/null || stat -c "%a" "${ORACLE_SSH_KEY}" 2>/dev/null)
    if [[ "$KEY_PERMS" != "400" ]]; then
        print_warn "SSH key permissions are $KEY_PERMS, setting to 400"
        chmod 400 "${ORACLE_SSH_KEY}"
    fi
    SSH_KEY_ARG="-i ${ORACLE_SSH_KEY}"
else
    # Using SSH agent (e.g., 1Password)
    SSH_KEY_ARG=""
fi

# Verify .env file exists
if [[ ! -f ".env" ]] && [[ "$SKIP_ENV" == "false" ]]; then
    print_error ".env file not found in current directory"
    exit 1
fi

# SSH command wrapper
ssh_exec() {
    ssh ${SSH_KEY_ARG} -o StrictHostKeyChecking=no "${ORACLE_USER}@${ORACLE_IP}" "$@"
}

# SCP command wrapper
scp_copy() {
    scp ${SSH_KEY_ARG} -o StrictHostKeyChecking=no "$@"
}

echo "================================================================"
echo "  Mr. Roboto V3 - Oracle Cloud Deployment"
echo "================================================================"
echo ""
echo "Oracle VM IP: ${ORACLE_IP}"
if [[ -n "${ORACLE_SSH_KEY}" ]]; then
    echo "SSH Key: ${ORACLE_SSH_KEY}"
else
    echo "SSH: Using SSH agent"
fi
echo "Image: ${IMAGE_NAME}"
echo ""

# Step 1: Test SSH connection
print_info "Testing SSH connection..."
if ! ssh_exec "echo 'Connection successful'" > /dev/null 2>&1; then
    print_error "Cannot connect to Oracle VM"
    echo "Verify:"
    echo "  - VM is running (Oracle Console)"
    echo "  - IP address is correct: ${ORACLE_IP}"
    if [[ -n "${ORACLE_SSH_KEY}" ]]; then
        echo "  - SSH key is correct: ${ORACLE_SSH_KEY}"
    else
        echo "  - SSH agent is configured (e.g., 1Password)"
    fi
    echo "  - Firewall allows SSH (port 22)"
    exit 1
fi
print_info "SSH connection successful"

# Step 2: Create remote directory
print_info "Creating remote directory..."
ssh_exec "mkdir -p ${REMOTE_DIR}"

# Step 3: Upload .env file (strip GCS_BUCKET_NAME and quotes)
if [[ "$SKIP_ENV" == "false" ]]; then
    print_info "Uploading .env file..."
    
    # Create temp .env without GCS_BUCKET_NAME and strip quotes from values
    # Docker's --env-file doesn't strip quotes, so we need to do it manually
    TEMP_ENV=$(mktemp)
    grep -v "^GCS_BUCKET_NAME=" .env | sed -E 's/^([^=]+)="(.*)"/\1=\2/' | sed -E "s/^([^=]+)='(.*)'/\1=\2/" > "$TEMP_ENV" || true
    
    scp_copy "$TEMP_ENV" "${ORACLE_USER}@${ORACLE_IP}:${REMOTE_DIR}/.env"
    rm "$TEMP_ENV"
    print_info ".env file uploaded (GCS_BUCKET_NAME removed, quotes stripped for Docker)"
else
    print_warn "Skipping .env upload (using existing file on VM)"
fi

# Step 4: Upload data directory (optional)
if [[ "$UPLOAD_DATA" == "true" ]]; then
    if [[ -d "./data" ]]; then
        print_info "Uploading data directory..."
        scp_copy -r ./data "${ORACLE_USER}@${ORACLE_IP}:${REMOTE_DIR}/"
        print_info "Data directory uploaded"
    else
        print_warn "Local data directory not found, skipping"
    fi
else
    print_warn "Skipping data upload (keeping VM data)"
fi

# Step 5: Pull latest Docker image
print_info "Pulling Docker image on VM..."
ssh_exec "docker pull ${IMAGE_NAME}"

# Step 6: Stop and remove old container (if exists)
print_info "Stopping old container (if exists)..."
ssh_exec "docker stop ${CONTAINER_NAME} 2>/dev/null || true"
ssh_exec "docker rm ${CONTAINER_NAME} 2>/dev/null || true"

# Step 7: Start new container
print_info "Starting new container..."
ssh_exec "cd ${REMOTE_DIR} && docker run -d \
  --name ${CONTAINER_NAME} \
  --restart unless-stopped \
  --env-file .env \
  -v ${REMOTE_DIR}/data:/usr/src/app/data \
  ${IMAGE_NAME}"

# Step 8: Verify container is running
sleep 2
CONTAINER_STATUS=$(ssh_exec "docker ps --filter name=${CONTAINER_NAME} --format '{{.Status}}'")
if [[ -n "$CONTAINER_STATUS" ]]; then
    print_info "Container is running: $CONTAINER_STATUS"
else
    print_error "Container failed to start"
    echo ""
    echo "View logs with:"
    if [[ -n "${ORACLE_SSH_KEY}" ]]; then
        echo "  ssh -i ${ORACLE_SSH_KEY} ${ORACLE_USER}@${ORACLE_IP} 'docker logs ${CONTAINER_NAME}'"
    else
        echo "  ssh ${ORACLE_USER}@${ORACLE_IP} 'docker logs ${CONTAINER_NAME}'"
    fi
    exit 1
fi

echo ""
echo "================================================================"
echo "  Deployment Complete!"
echo "================================================================"
echo ""
echo "Management Commands:"
echo ""
echo "  View logs:"
if [[ -n "${ORACLE_SSH_KEY}" ]]; then
    echo "    ssh -i ${ORACLE_SSH_KEY} ${ORACLE_USER}@${ORACLE_IP} 'docker logs -f ${CONTAINER_NAME}'"
else
    echo "    ssh ${ORACLE_USER}@${ORACLE_IP} 'docker logs -f ${CONTAINER_NAME}'"
fi
echo ""
echo "  Restart bot:"
if [[ -n "${ORACLE_SSH_KEY}" ]]; then
    echo "    ssh -i ${ORACLE_SSH_KEY} ${ORACLE_USER}@${ORACLE_IP} 'docker restart ${CONTAINER_NAME}'"
else
    echo "    ssh ${ORACLE_USER}@${ORACLE_IP} 'docker restart ${CONTAINER_NAME}'"
fi
echo ""
echo "  Download data from VM:"
if [[ -n "${ORACLE_SSH_KEY}" ]]; then
    echo "    scp -i ${ORACLE_SSH_KEY} -r ${ORACLE_USER}@${ORACLE_IP}:${REMOTE_DIR}/data ./oracle-data-backup"
else
    echo "    scp -r ${ORACLE_USER}@${ORACLE_IP}:${REMOTE_DIR}/data ./oracle-data-backup"
fi
echo ""
echo "  Redeploy:"
echo "    ORACLE_IP=${ORACLE_IP} ./scripts/deploy-to-oracle.sh"
echo ""

# Optional: Show logs
if [[ "$SHOW_LOGS" == "true" ]]; then
    echo "Showing container logs (Ctrl+C to exit):"
    echo ""
    ssh_exec "docker logs -f ${CONTAINER_NAME}"
fi
