#!/bin/bash
set -euo pipefail

APP_CONTAINER="mmpz_erp_app"
DB_CONTAINER="mmpz_erp_db"
STREAMLIT_CONTAINER="mmpz_erp_streamlit"

log() {
  printf '[deploy] %s\n' "$1"
}

fail_with_logs() {
  local container_name="$1"
  log "Deployment failed while waiting for ${container_name}. Recent logs:"
  docker logs --tail=120 "$container_name" || true
  exit 1
}

resolve_compose() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi

  if docker-compose version >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi

  log "Neither 'docker compose' nor 'docker-compose' is available."
  exit 1
}

wait_for_health() {
  local container_name="$1"
  local timeout_seconds="${2:-240}"
  local start_ts
  start_ts="$(date +%s)"

  while true; do
    local status
    status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || true)"

    case "$status" in
      healthy)
        log "${container_name} is healthy."
        return 0
        ;;
      running)
        log "${container_name} is running."
        return 0
        ;;
      unhealthy|exited|dead)
        fail_with_logs "$container_name"
        ;;
      "")
        ;;
      *)
        log "Waiting for ${container_name}: current status is '${status}'."
        ;;
    esac

    if [ $(( $(date +%s) - start_ts )) -ge "$timeout_seconds" ]; then
      log "Timed out waiting for ${container_name} after ${timeout_seconds}s."
      fail_with_logs "$container_name"
    fi

    sleep 5
  done
}

DC_CMD="$(resolve_compose)"

log "Starting MMPZ ERP deployment..."
log "Pulling latest code with a fast-forward only merge."
git pull --ff-only origin main

log "Ensuring required host directories exist."
mkdir -p uploads/avatars uploads/documents uploads/volunteer-submissions

log "Building application and analytics images."
$DC_CMD build app streamlit

log "Starting database first."
$DC_CMD up -d db
wait_for_health "$DB_CONTAINER" 120

log "Starting application and analytics services."
$DC_CMD up -d --remove-orphans app streamlit
wait_for_health "$APP_CONTAINER" 240
wait_for_health "$STREAMLIT_CONTAINER" 180

log "Current compose status:"
$DC_CMD ps

log "Pruning dangling images."
docker image prune -f >/dev/null 2>&1 || true

log "Deployment complete."
