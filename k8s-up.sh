#!/usr/bin/env bash
set -euo pipefail

# k8s-up.sh
# Build local images, deploy Kubernetes manifests, and run basic health checks.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="default"
SKIP_BUILD=false
SKIP_DEPLOY=false
SKIP_WAIT=false
SKIP_HEALTH=false
PORT_FORWARD=false
PORT_FORWARD_PORT=8080

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

usage() {
  cat <<'EOF'
Usage: ./k8s-up.sh [options]

Options:
  --skip-build         Skip Docker image build step
  --skip-deploy        Skip deploy step (secrets + kubectl apply)
  --skip-wait          Skip rollout wait step
  --skip-health        Skip gateway health checks
  --port-forward       Start port-forward to api-gateway-nginx
  --port <number>      Port for --port-forward (default: 8080)
  -h, --help           Show this help

Examples:
  ./k8s-up.sh
  ./k8s-up.sh --skip-build
  ./k8s-up.sh --port-forward --port 8080
EOF
}

log_info() { echo -e "${BLUE}$*${NC}"; }
log_warn() { echo -e "${YELLOW}$*${NC}"; }
log_ok() { echo -e "${GREEN}$*${NC}"; }
log_err() { echo -e "${RED}$*${NC}"; }

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_err "Missing required command: $cmd"
    exit 1
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skip-build) SKIP_BUILD=true ;;
      --skip-deploy) SKIP_DEPLOY=true ;;
      --skip-wait) SKIP_WAIT=true ;;
      --skip-health) SKIP_HEALTH=true ;;
      --port-forward) PORT_FORWARD=true ;;
      --port)
        shift
        PORT_FORWARD_PORT="${1:-}"
        if [[ -z "$PORT_FORWARD_PORT" ]]; then
          log_err "--port requires a value"
          exit 1
        fi
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        log_err "Unknown option: $1"
        usage
        exit 1
        ;;
    esac
    shift
  done
}

check_cluster() {
  log_info "Checking Kubernetes cluster connectivity..."
  if ! kubectl cluster-info >/dev/null 2>&1; then
    log_err "Cannot connect to Kubernetes API server."
    log_warn "If using Docker Desktop: enable Kubernetes, then retry."
    exit 1
  fi
  local context
  context="$(kubectl config current-context 2>/dev/null || true)"
  log_ok "Connected to cluster (context: ${context:-unknown})"
}

build_images() {
  log_info "Building local Docker images used by Kubernetes manifests..."

  local builds=(
    "auth-service:latest|services/auth-service-node"
    "patient-service:latest|services/patient-service-node"
    "doctor-service:latest|services/doctor-service"
    "appointment-service:latest|services/appointment-service"
    "notification-service:latest|services/notification-service"
    "payment-service:latest|services/payment-service"
    "telemedicine-service:latest|services/telemedicine-service"
    "symptom-service:latest|services/AI-symptom-service"
    "web-app:latest|web-app"
  )

  local item image context
  for item in "${builds[@]}"; do
    image="${item%%|*}"
    context="${item##*|}"
    log_info "- docker build -t ${image} ${context}"
    docker build -t "$image" "$ROOT_DIR/$context"
  done

  log_ok "Image build step complete"
}

deploy_manifests() {
  local deploy_script="$ROOT_DIR/deploy-k8s.sh"
  if [[ ! -f "$deploy_script" ]]; then
    log_err "Deploy script not found: $deploy_script"
    exit 1
  fi

  log_info "Running deploy script (secrets + manifests)..."
  chmod +x "$deploy_script"
  "$deploy_script"
  log_ok "Deploy step complete"
}

wait_rollout() {
  log_info "Waiting for deployments to become available..."
  kubectl wait --for=condition=available --timeout=300s deployment --all -n "$NAMESPACE" || true
  kubectl get deployments -n "$NAMESPACE"
  kubectl get pods -n "$NAMESPACE"
  log_ok "Rollout wait step complete"
}

health_checks() {
  log_info "Running in-cluster gateway health check..."
  if kubectl run curl-check --rm -i --restart=Never --image=curlimages/curl:8.7.1 -- \
    -sS "http://api-gateway-nginx.${NAMESPACE}.svc.cluster.local/health"; then
    log_ok "Gateway health endpoint reachable in cluster"
  else
    log_warn "Gateway health check failed. Inspect pods and logs."
  fi
}

start_port_forward() {
  log_info "Starting comprehensive port-forwarding for all services..."
  log_info "Press Ctrl+C to stop all port-forwards."
  
  # Forward API Gateway
  kubectl port-forward -n "$NAMESPACE" svc/api-gateway-nginx "${PORT_FORWARD_PORT}:80" > /dev/null 2>&1 &
  GATEWAY_PID=$!

  # Forward Web App Service
  kubectl port-forward -n "$NAMESPACE" svc/web-app 3000:3000 > /dev/null 2>&1 &
  WEB_PID=$!

  # Forward Individual Backend Services (For direct debugging)
  kubectl port-forward -n "$NAMESPACE" svc/auth-service 8081:8081 > /dev/null 2>&1 &
  AUTH_PID=$!
  kubectl port-forward -n "$NAMESPACE" svc/patient-service 5002:5002 > /dev/null 2>&1 &
  PATIENT_PID=$!
  kubectl port-forward -n "$NAMESPACE" svc/doctor-service 8082:8082 > /dev/null 2>&1 &
  DOCTOR_PID=$!
  kubectl port-forward -n "$NAMESPACE" svc/appointment-service 8083:8083 > /dev/null 2>&1 &
  APPT_PID=$!
  kubectl port-forward -n "$NAMESPACE" svc/notification-service 8084:8084 > /dev/null 2>&1 &
  NOTIFY_PID=$!
  kubectl port-forward -n "$NAMESPACE" svc/payment-service 8085:8085 > /dev/null 2>&1 &
  PAY_PID=$!
  kubectl port-forward -n "$NAMESPACE" svc/symptom-service 8091:8091 > /dev/null 2>&1 &
  SYMPTOM_PID=$!

  echo -e "\n✅ Success! Your apps and individual services are now exposed locally."
  echo "   - Web Frontend:  http://localhost:3000"
  echo "   - API Gateway:   http://localhost:${PORT_FORWARD_PORT}"
  echo "   - Auth:          http://localhost:8081"
  echo "   - Patient:       http://localhost:5002"
  echo "   - Doctor:        http://localhost:8082"
  echo "   - Appointment:   http://localhost:8083"
  echo "   - Notification:  http://localhost:8084"
  echo "   - Payment:       http://localhost:8085"
  echo "   - Symptom:       http://localhost:8091"
  echo ""

  trap "log_info '\nStopping all port forwards...'; kill \$GATEWAY_PID \$WEB_PID \$AUTH_PID \$PATIENT_PID \$DOCTOR_PID \$APPT_PID \$NOTIFY_PID \$PAY_PID \$SYMPTOM_PID 2>/dev/null; exit" INT
  wait
}

main() {
  parse_args "$@"

  require_cmd kubectl
  require_cmd docker

  check_cluster

  if [[ "$SKIP_BUILD" == false ]]; then
    build_images
  else
    log_warn "Skipping build step"
  fi

  if [[ "$SKIP_DEPLOY" == false ]]; then
    deploy_manifests
  else
    log_warn "Skipping deploy step"
  fi

  if [[ "$SKIP_WAIT" == false ]]; then
    wait_rollout
  else
    log_warn "Skipping rollout wait step"
  fi

  if [[ "$SKIP_HEALTH" == false ]]; then
    health_checks
  else
    log_warn "Skipping health checks"
  fi

  log_ok "Kubernetes up workflow completed"

  if [[ "$PORT_FORWARD" == true ]]; then
    start_port_forward
  else
    log_info "To expose gateway locally: kubectl port-forward -n ${NAMESPACE} svc/api-gateway-nginx ${PORT_FORWARD_PORT}:80"
  fi
}

main "$@"
