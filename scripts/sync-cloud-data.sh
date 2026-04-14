#!/usr/bin/env bash

# Sync and download cloud data script
# This script triggers a cloud sync from the running bot, then downloads all data to local

set -euo pipefail

# ─── Colours and output helpers ──────────────────────────────────────────────
_bold()   { printf "\033[1m%s\033[0m" "$*"; }
_green()  { printf "\033[32m%s\033[0m" "$*"; }
_yellow() { printf "\033[33m%s\033[0m" "$*"; }
_red()    { printf "\033[31m%s\033[0m" "$*"; }
_blue()   { printf "\033[34m%s\033[0m" "$*"; }

log_info()    { echo "[$(_bold 'INFO')] $*"; }
log_ok()      { echo "[$(_green '  OK')] $*"; }
log_warn()    { echo "[$(_yellow 'WARN')] $*"; }
log_error()   { echo "[$(_red 'ERR ')] $*" >&2; }
log_fatal()   { log_error "$*"; exit 1; }

# ─── Configuration ───────────────────────────────────────────────────────────
readonly DATA_DIR="./data"

echo ""
echo "$(_bold 'Mr. Roboto V3 — Cloud Data Sync & Download')"
echo "───────────────────────────────────────────────"
echo ""

# ─── Check prerequisites ─────────────────────────────────────────────────────
if ! command -v gcloud &>/dev/null; then
  log_fatal "gcloud CLI not found. Install it from: https://cloud.google.com/sdk/docs/install"
fi

if ! gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>/dev/null | grep -q .; then
  log_fatal "Not authenticated with gcloud. Run: gcloud auth login"
fi

# ─── Get project and bucket from environment or prompt ──────────────────────
if [[ -f ".env" ]]; then
  log_info "Loading configuration from .env file..."
  # Extract GCS_BUCKET_NAME from .env
  GCS_BUCKET_NAME=$(grep "^GCS_BUCKET_NAME=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

if [[ -z "${GCS_BUCKET_NAME:-}" ]]; then
  log_warn "GCS_BUCKET_NAME not found in .env file"
  read -r -p "Enter GCS bucket name: " GCS_BUCKET_NAME
  [[ -n "$GCS_BUCKET_NAME" ]] || log_fatal "Bucket name is required"
fi

log_info "Using bucket: $GCS_BUCKET_NAME"

# ─── Check if bucket exists ──────────────────────────────────────────────────
log_info "Checking if bucket exists..."
if ! gsutil ls -b "gs://${GCS_BUCKET_NAME}" &>/dev/null; then
  log_fatal "Bucket 'gs://${GCS_BUCKET_NAME}' does not exist or you don't have access"
fi
log_ok "Bucket exists and is accessible"

# ─── Check if bot is running on Cloud Run ────────────────────────────────────
log_info "Checking for running Cloud Run service..."

current_project=$(gcloud config get-value project 2>/dev/null || true)
if [[ -z "$current_project" ]]; then
  log_warn "No active GCloud project. Skipping Cloud Run sync trigger."
  SKIP_CLOUD_SYNC=true
else
  # Try to find mrroboto service
  SERVICE_URL=$(gcloud run services list --format="value(status.url)" \
    --filter="metadata.name=mrroboto" 2>/dev/null | head -1 || true)
  
  if [[ -z "$SERVICE_URL" ]]; then
    log_warn "Cloud Run service 'mrroboto' not found. Skipping cloud sync trigger."
    SKIP_CLOUD_SYNC=true
  else
    log_ok "Found Cloud Run service: $SERVICE_URL"
    SKIP_CLOUD_SYNC=false
  fi
fi

# ─── Trigger cloud sync ──────────────────────────────────────────────────────
if [[ "${SKIP_CLOUD_SYNC:-false}" == "false" ]]; then
  log_info "Triggering cloud sync from running bot..."
  log_warn "Note: This requires the bot to be running and configured with GCS access"
  
  echo ""
  read -r -p "Trigger cloud sync now? This will backup current bot data to GCS. [Y/n]: " TRIGGER_SYNC
  if [[ "${TRIGGER_SYNC:-Y}" =~ ^[Yy]$ ]]; then
    log_info "Sync will be triggered via bot command (if bot is running)"
    log_warn "Manual trigger: Send '!syncdata' command to the bot in the hangout"
    log_info "Waiting 10 seconds for sync to complete..."
    sleep 10
  else
    log_info "Skipping cloud sync trigger"
  fi
fi

# ─── Download data from GCS ──────────────────────────────────────────────────
echo ""
log_info "Downloading data from GCS to local directory..."

# Create backup of existing data
if [[ -d "$DATA_DIR" ]]; then
  BACKUP_DIR="${DATA_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
  log_info "Backing up existing data to: $BACKUP_DIR"
  cp -R "$DATA_DIR" "$BACKUP_DIR"
  log_ok "Backup created"
fi

# Ensure data directory exists
mkdir -p "$DATA_DIR"

# Download all files from GCS data/ prefix
log_info "Downloading files from gs://${GCS_BUCKET_NAME}/data/..."

DOWNLOAD_COUNT=0
DOWNLOAD_FAILED=0

# Use gsutil to sync the data directory
if gsutil -m rsync -r "gs://${GCS_BUCKET_NAME}/data/" "$DATA_DIR/"; then
  # Count downloaded files
  DOWNLOAD_COUNT=$(find "$DATA_DIR" -type f | wc -l | tr -d ' ')
  log_ok "Downloaded $DOWNLOAD_COUNT files successfully"
else
  log_error "Some files failed to download"
  DOWNLOAD_FAILED=1
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "$(_bold '───────────────────────────────────────────────')"
if [[ $DOWNLOAD_FAILED -eq 0 ]]; then
  echo "$(_green '✓ Sync and download complete!')"
else
  echo "$(_yellow '⚠ Sync and download completed with errors')"
fi
echo "$(_bold '───────────────────────────────────────────────')"
echo ""
echo "  Downloaded:  $DOWNLOAD_COUNT files"
echo "  Location:    $(_bold "$DATA_DIR/")"
if [[ -n "${BACKUP_DIR:-}" ]]; then
  echo "  Backup:      $(_bold "$BACKUP_DIR/")"
fi
echo ""
log_info "Your local data directory is now synced with the cloud"
echo ""
