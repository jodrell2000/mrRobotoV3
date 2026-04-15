#!/usr/bin/env bash

# Deploy Mr. Roboto V3 to Google Cloud Run
#
# Usage: bash scripts/deploy-to-cloudrun.sh [--upload-data]
#
# Flags:
#   --upload-data    Upload local data directory to GCS before deploying
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - .env file configured in the project root directory

set -euo pipefail

# ─── Colours and output helpers ──────────────────────────────────────────────
_bold()   { printf "\033[1m%s\033[0m" "$*"; }
_green()  { printf "\033[32m%s\033[0m" "$*"; }
_yellow() { printf "\033[33m%s\033[0m" "$*"; }
_red()    { printf "\033[31m%s\033[0m" "$*"; }

log_info()    { echo "[$(_bold 'INFO')] $*"; }
log_ok()      { echo "[$(_green '  OK')] $*"; }
log_warn()    { echo "[$(_yellow 'WARN')] $*"; }
log_error()   { echo "[$(_red 'ERR ')] $*" >&2; }
log_fatal()   { log_error "$*"; exit 1; }

# ─── Argument parsing ────────────────────────────────────────────────────────
UPLOAD_DATA=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --upload-data)
      UPLOAD_DATA=true
      shift
      ;;
    -h|--help)
      echo "Usage: bash scripts/deploy-to-cloudrun.sh [--upload-data]"
      echo ""
      echo "Flags:"
      echo "  --upload-data    Upload local data directory to GCS before deploying"
      echo ""
      exit 0
      ;;
    *)
      log_fatal "Unknown flag: $1 (use --help for usage)"
      ;;
  esac
done

# ─── Defaults ────────────────────────────────────────────────────────────────
readonly DEFAULT_IMAGE_REPO="ghcr.io/jodrell2000/mrrobotov3"
readonly DEFAULT_REGION="europe-west1"
readonly DEFAULT_SERVICE="mrroboto"
readonly ENV_FILE=".env"
readonly MIN_INSTANCES=1
readonly MAX_INSTANCES=1
readonly MEMORY="128Mi"
readonly CPU="1"

# ─── Prerequisites ───────────────────────────────────────────────────────────
check_prerequisites() {
  log_info "Checking prerequisites..."

  if ! command -v gcloud &>/dev/null; then
    log_fatal "gcloud CLI not found. Install it from: https://cloud.google.com/sdk/docs/install"
  fi

  if ! gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>/dev/null | grep -q .; then
    log_fatal "Not authenticated with gcloud. Run: gcloud auth login"
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    log_fatal ".env file not found. Run this script from the mrRobotoV3 project directory."
  fi

  log_ok "Prerequisites OK"
}

# ─── GHCR tag discovery ──────────────────────────────────────────────────────
fetch_ghcr_tags() {
  local repo="jodrell2000/mrrobotov3"
  local token tags_raw
  token=$(curl -sf \
    "https://ghcr.io/token?scope=repository:${repo}:pull&service=ghcr.io" \
    | sed 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' 2>/dev/null) || true
  [[ -z "$token" ]] && return
  tags_raw=$(curl -sf \
    -H "Authorization: Bearer ${token}" \
    "https://ghcr.io/v2/${repo}/tags/list" 2>/dev/null) || true
  [[ -z "$tags_raw" ]] && return
  printf '%s' "$tags_raw" \
    | grep -o '"[^"]*"' | tr -d '"' \
    | grep -v '^tags$\|^name$\|sha256-' \
    | sort -V
}

# ─── Interactive configuration ───────────────────────────────────────────────
configure_deployment() {
  echo ""
  echo "$(_bold 'Mr. Roboto V3 — Google Cloud Run Deployment')"
  echo "─────────────────────────────────────────────"
  echo ""

  local current_project
  current_project=$(gcloud config get-value project 2>/dev/null || true)

  if [[ -n "$current_project" ]]; then
    read -r -p "Google Cloud Project ID [$current_project]: " PROJECT_ID
    PROJECT_ID="${PROJECT_ID:-$current_project}"
  else
    read -r -p "Google Cloud Project ID: " PROJECT_ID
    [[ -n "$PROJECT_ID" ]] || log_fatal "Project ID is required."
  fi

  read -r -p "Region [$DEFAULT_REGION]: " REGION
  REGION="${REGION:-$DEFAULT_REGION}"

  read -r -p "Service name [$DEFAULT_SERVICE]: " SERVICE
  SERVICE="${SERVICE:-$DEFAULT_SERVICE}"

  local default_tag available_tags
  log_info "Fetching available GHCR tags..."
  available_tags=$(fetch_ghcr_tags 2>/dev/null) || true
  if [[ -n "$available_tags" ]]; then
    echo "  Available tags:"
    printf '%s\n' $available_tags | sed 's/^/    /'
    default_tag=$(printf '%s\n' $available_tags | tail -1)
  else
    default_tag="latest"
  fi

  read -r -p "Image tag [$default_tag]: " IMAGE_TAG
  IMAGE_TAG="${IMAGE_TAG:-$default_tag}"
  IMAGE="${DEFAULT_IMAGE_REPO}:${IMAGE_TAG}"

  # Resolve to project ID string in case a project number was entered/defaulted
  PROJECT_ID=$(gcloud projects describe "$PROJECT_ID" --format="value(projectId)" 2>/dev/null) \
    || log_fatal "Could not resolve project '$PROJECT_ID'. Check the project ID and that you have access."

  echo ""
  echo "  Project : $PROJECT_ID"
  echo "  Region  : $REGION"
  echo "  Service : $SERVICE"
  echo "  Image   : $IMAGE"
  echo ""
  read -r -p "Proceed? [Y/n]: " CONFIRM
  [[ "${CONFIRM:-Y}" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }

  gcloud config set project "$PROJECT_ID" --quiet
}

# ─── API enablement ──────────────────────────────────────────────────────────
enable_apis() {
  log_info "Enabling required Google Cloud APIs (this may take a moment)..."
  gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    --quiet
  log_ok "APIs enabled"
}

# ─── .env parsing ────────────────────────────────────────────────────────────
# Plain array of KEY=VALUE strings — compatible with bash 3.2 (no associative arrays)
ENV_ENTRIES=()

parse_env_file() {
  log_info "Parsing .env file..."
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue

    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local value="${BASH_REMATCH[2]}"

      # Strip surrounding single or double quotes
      if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi

      # Skip unmodified placeholder values from .env_example
      if [[ "$value" == *"paste-your"* ]] || [[ "$value" == *"paste-hangout"* ]]; then
        log_warn "Skipping placeholder value for: $key (edit your .env first)"
        continue
      fi

      # Skip empty values
      [[ -z "$value" ]] && continue

      ENV_ENTRIES+=("${key}=${value}")
    fi
  done < "$ENV_FILE"
  log_ok "Parsed ${#ENV_ENTRIES[@]} environment variables"
}

# ─── Environment variable setup ──────────────────────────────────────────────
setup_env_vars() {
  log_info "Preparing environment variables..."
  
  # Ensure NODE_ENV=production is set
  local found_node_env=false
  local entry
  for entry in "${ENV_ENTRIES[@]}"; do
    [[ "$entry" == NODE_ENV=* ]] && found_node_env=true && break
  done
  [[ "$found_node_env" == false ]] && ENV_ENTRIES+=("NODE_ENV=production")
  
  log_ok "Environment variables ready (${#ENV_ENTRIES[@]} total)"
}

# ─── Artifact Registry ───────────────────────────────────────────────────────
# Cloud Run only accepts images from Artifact Registry, GCR, or Docker Hub.
# This copies the public GHCR image into Artifact Registry via Cloud Build
# (no local Docker installation required).
copy_image_to_ar() {
  local ar_repo="mrroboto"
  AR_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ar_repo}/mrrobotov3:${IMAGE_TAG}"

  log_info "Creating Artifact Registry repository (if it doesn't exist)..."
  if ! gcloud artifacts repositories describe "$ar_repo" \
      --location="$REGION" --quiet &>/dev/null 2>&1; then
    gcloud artifacts repositories create "$ar_repo" \
      --repository-format=docker \
      --location="$REGION" \
      --quiet
    log_ok "Artifact Registry repository created: $ar_repo"
  fi

  log_info "Copying image from GHCR to Artifact Registry via Cloud Build..."
  log_info "  Source : $IMAGE"
  log_info "  Target : $AR_IMAGE"

  local tmpconfig
  tmpconfig=$(mktemp /tmp/cloudbuild-XXXXXX)
  cat > "$tmpconfig" <<'CLOUDBUILD'
steps:
- name: 'gcr.io/go-containerregistry/crane'
  args: ['copy', '--platform', 'linux/amd64', '$_SOURCE', '$_TARGET']
CLOUDBUILD

  gcloud builds submit \
    --no-source \
    --substitutions="_SOURCE=${IMAGE},_TARGET=${AR_IMAGE}" \
    --config="$tmpconfig" \
    --quiet

  rm -f "$tmpconfig"

  log_ok "Image copied to Artifact Registry"
}

# ─── Data upload to GCS ──────────────────────────────────────────────────────
upload_data_to_gcs() {
  log_info "Checking for GCS bucket configuration..."
  
  # Extract GCS_BUCKET_NAME from ENV_ENTRIES
  local bucket_name=""
  local entry
  for entry in "${ENV_ENTRIES[@]}"; do
    if [[ "$entry" == GCS_BUCKET_NAME=* ]]; then
      bucket_name="${entry#GCS_BUCKET_NAME=}"
      break
    fi
  done
  
  if [[ -z "$bucket_name" ]]; then
    log_warn "GCS_BUCKET_NAME not found in .env file — skipping data upload"
    log_warn "To enable data persistence, add GCS_BUCKET_NAME to your .env file"
    return
  fi
  
  if [[ ! -d "./data" ]]; then
    log_warn "No ./data directory found — skipping upload"
    return
  fi
  
  log_info "Uploading data directory to gs://${bucket_name}/ ..."
  
  # Use gcloud storage rsync for efficient upload
  # Upload to data/ subdirectory to match CloudStorageService expectations
  if gcloud storage rsync ./data "gs://${bucket_name}/data/" --recursive --delete-unmatched-destination-objects --quiet 2>&1; then
    log_ok "Data uploaded to GCS bucket: ${bucket_name}"
  else
    log_error "Failed to upload data to GCS — deployment will continue but data may not be in sync"
    log_warn "Check that the bucket exists and you have write permissions"
  fi
}



# ─── Cloud Run deployment ────────────────────────────────────────────────────
deploy_service() {
  log_info "Deploying to Cloud Run (this may take 1–2 minutes)..."

  local deploy_cmd=(
    gcloud run deploy "$SERVICE"
    --image "$AR_IMAGE"
    --platform managed
    --region "$REGION"
    --port 8080
    --min-instances "$MIN_INSTANCES"
    --max-instances "$MAX_INSTANCES"
    --memory "$MEMORY"
    --cpu "$CPU"
    --no-cpu-throttling
    --no-allow-unauthenticated
    --quiet
  )

  if [[ ${#ENV_ENTRIES[@]} -gt 0 ]]; then
    local env_str
    env_str=$(IFS=','; echo "${ENV_ENTRIES[*]}")
    deploy_cmd+=(--set-env-vars "$env_str")
  fi

  "${deploy_cmd[@]}"
  log_ok "Deployed successfully"
}

# ─── Post-deployment summary ─────────────────────────────────────────────────
show_summary() {
  echo ""
  echo "$(_bold '─────────────────────────────────────────────')"
  echo "$(_green '✓ Deployment complete!')"
  echo "$(_bold '─────────────────────────────────────────────')"
  echo ""
  printf "  %-10s %s\n" "Service:" "$SERVICE"
  printf "  %-10s %s\n" "Region:"  "$REGION"
  printf "  %-10s %s\n" "Image:"   "$AR_IMAGE"
  echo ""
  echo "$(_bold 'Useful commands:')"
  echo ""
  echo "  Stream logs:"
  echo "    gcloud logging tail \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE\""
  echo ""
  echo "  Check service status:"
  echo "    gcloud run services describe $SERVICE --region $REGION"
  echo ""
  echo "  Stop the bot (scale to zero):"
  echo "    gcloud run services update $SERVICE --region $REGION --min-instances 0 --max-instances 1"
  echo ""
  echo "  Update to latest image:"
  echo "    gcloud run services update $SERVICE --region $REGION --image ${DEFAULT_IMAGE_REPO}:latest"
  echo ""
  log_info "Check the logs above to confirm the bot is connecting correctly."
}

# ─── Entry point ─────────────────────────────────────────────────────────────
main() {
  check_prerequisites
  configure_deployment
  enable_apis
  parse_env_file
  setup_env_vars
  
  # Upload data to GCS if --upload-data flag is set
  if [[ "$UPLOAD_DATA" == true ]]; then
    upload_data_to_gcs
  fi
  
  copy_image_to_ar
  deploy_service
  show_summary
}

main "$@"
