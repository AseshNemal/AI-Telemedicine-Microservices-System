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

port_is_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

listening_pid() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1
}

listening_command() {
  local pid="$1"
  [[ -z "$pid" ]] && return 0
  ps -o comm= -p "$pid" 2>/dev/null | awk '{print $1}'
}

wait_for_local_http() {
  local port="$1"
  local attempts="${2:-20}"
  local path="${3:-/}"
  local i

  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "http://127.0.0.1:${port}${path}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

wait_for_local_listener() {
  local port="$1"
  local attempts="${2:-20}"
  local i

  for ((i=1; i<=attempts; i++)); do
    if port_is_listening "$port"; then
      return 0
    fi
    sleep 1
  done

  return 1
}

print_failure_hints() {
  local target="$1"

  log_warn "Possible fix for ${target}:"
  case "$target" in
    api-gateway-nginx)
      echo "  - Check the mounted gateway config: kubectl get configmap api-gateway-config -n ${NAMESPACE} -o yaml"
      echo "  - Restart the gateway after config changes: kubectl rollout restart deployment/api-gateway-nginx -n ${NAMESPACE}"
      echo "  - Re-test locally: curl -i http://127.0.0.1:8080/health"
      ;;
    web-app)
      echo "  - Check runtime logs: kubectl logs -n ${NAMESPACE} deployment/web-app --tail=200"
      echo "  - Rebuild the frontend image: docker build -t web-app:latest ${ROOT_DIR}/web-app"
      echo "  - Verify the standalone server is present in the image before rollout"
      ;;
    payment-service)
      echo "  - Check MongoDB connectivity and secret values in .env"
      echo "  - Inspect logs: kubectl logs -n ${NAMESPACE} deployment/payment-service --tail=200"
      ;;
    telemedicine-service)
      echo "  - Check LiveKit-related env vars in .env and the service logs"
      echo "  - Inspect logs: kubectl logs -n ${NAMESPACE} deployment/telemedicine-service --tail=200"
      ;;
    *)
      echo "  - Inspect deployment logs: kubectl logs -n ${NAMESPACE} deployment/${target} --tail=200"
      echo "  - Inspect pod events: kubectl describe deployment ${target} -n ${NAMESPACE}"
      ;;
  esac
}

start_port_forward_if_needed() {
  local service="$1"
  local local_port="$2"
  local remote_port="$3"
  local pid_var="$4"
  local label="$5"

  if port_is_listening "$local_port"; then
    local existing_pid existing_cmd
    existing_pid="$(listening_pid "$local_port")"
    existing_cmd="$(listening_command "$existing_pid")"

    if [[ "$existing_cmd" == "kubectl" ]]; then
      log_warn "${label} local port ${local_port} is held by an old kubectl listener; replacing it"
      kill "$existing_pid" 2>/dev/null || true
      sleep 1
    else
      log_warn "${label} local port ${local_port} is already in use; reusing existing listener"
      printf -v "$pid_var" '%s' ""
      return 0
    fi
  fi

  kubectl port-forward -n "$NAMESPACE" "svc/${service}" "${local_port}:${remote_port}" > /dev/null 2>&1 &
  local pf_pid=$!
  printf -v "$pid_var" '%s' "$pf_pid"
}

wait_for_port_forward() {
  local service="$1"
  local local_port="$2"
  local pid="$3"
  local path="${4:-/}"

  if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
    log_err "${service} port-forward exited before becoming ready on localhost:${local_port}"
    return 1
  fi

  if ! wait_for_local_listener "$local_port" 30; then
    log_err "${service} port-forward never bound localhost:${local_port}"
    return 1
  fi

  if ! wait_for_local_http "$local_port" 45 "$path"; then
    log_err "${service} did not become reachable on localhost:${local_port}${path}"
    return 1
  fi

  return 0
}

cleanup_port_forwards() {
  local pid
  for pid in "${PORT_FORWARD_PIDS[@]:-}"; do
    [[ -n "$pid" ]] || continue
    kill "$pid" 2>/dev/null || true
  done
}

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
  SKIP_ROLLOUT_WAIT=true "$deploy_script"
  log_ok "Deploy step complete"
}

wait_rollout() {
  log_info "Waiting for deployments to become available..."

  local deployments
  deployments="$(kubectl get deployments -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')"

  if [[ -z "${deployments}" ]]; then
    log_warn "No deployments found in namespace ${NAMESPACE}"
    return 0
  fi

  local dep
  while IFS= read -r dep; do
    [[ -z "$dep" ]] && continue
    log_info "- rollout status deployment/${dep}"
    if ! kubectl rollout status "deployment/${dep}" -n "$NAMESPACE" --timeout=300s; then
      log_err "Deployment ${dep} failed to roll out"
      kubectl describe deployment "${dep}" -n "$NAMESPACE" || true
      kubectl get pods -n "$NAMESPACE" --show-labels || true
      kubectl logs -n "$NAMESPACE" "deployment/${dep}" --tail=120 || true
      print_failure_hints "$dep"
      return 1
    fi
  done <<EOF
$deployments
EOF

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
    print_failure_hints "api-gateway-nginx"
  fi
}

start_port_forward() {
  log_info "Starting comprehensive port-forwarding for all services..."
  log_info "Press Ctrl+C to stop all port-forwards."

  PORT_FORWARD_PIDS=()

  local GATEWAY_PID="" WEB_PID="" AUTH_PID="" PATIENT_PID="" DOCTOR_PID="" APPT_PID="" NOTIFY_PID="" PAY_PID="" TELEMED_PID="" SYMPTOM_PID=""

  start_port_forward_if_needed "api-gateway-nginx" "$PORT_FORWARD_PORT" 80 GATEWAY_PID "API Gateway"
  PORT_FORWARD_PIDS=("$GATEWAY_PID")

  if [[ -n "$GATEWAY_PID" ]] && ! wait_for_port_forward "API Gateway" "$PORT_FORWARD_PORT" "$GATEWAY_PID" "/health"; then
    print_failure_hints "api-gateway-nginx"
    cleanup_port_forwards
    exit 1
  fi

  start_port_forward_if_needed "web-app" 3000 3000 WEB_PID "Web Frontend"
  start_port_forward_if_needed "auth-service" 8081 8081 AUTH_PID "Auth Service"
  start_port_forward_if_needed "patient-service" 5002 5002 PATIENT_PID "Patient Service"
  start_port_forward_if_needed "doctor-service" 8082 8082 DOCTOR_PID "Doctor Service"
  start_port_forward_if_needed "appointment-service" 8083 8083 APPT_PID "Appointment Service"
  start_port_forward_if_needed "notification-service" 8084 8084 NOTIFY_PID "Notification Service"
  start_port_forward_if_needed "payment-service" 8085 8085 PAY_PID "Payment Service"
  start_port_forward_if_needed "telemedicine-service" 8086 8086 TELEMED_PID "Telemedicine Service"
  start_port_forward_if_needed "symptom-service" 8091 8091 SYMPTOM_PID "Symptom Service"

  PORT_FORWARD_PIDS=("$GATEWAY_PID" "$WEB_PID" "$AUTH_PID" "$PATIENT_PID" "$DOCTOR_PID" "$APPT_PID" "$NOTIFY_PID" "$PAY_PID" "$TELEMED_PID" "$SYMPTOM_PID")

  if [[ -n "$WEB_PID" ]] && ! wait_for_local_listener 3000 30; then
    log_warn "Web Frontend port-forward did not bind localhost:3000 before timeout"
  fi

  echo -e "\n✅ Success! Your apps and individual services are now exposed locally."
  echo "   - Web Frontend:  http://localhost:3000"
  echo "   - API Gateway:   http://localhost:${PORT_FORWARD_PORT}"
  echo "   - Auth:          http://localhost:8081"
  echo "   - Patient:       http://localhost:5002"
  echo "   - Doctor:        http://localhost:8082"
  echo "   - Appointment:   http://localhost:8083"
  echo "   - Notification:  http://localhost:8084"
  echo "   - Payment:       http://localhost:8085"
  echo "   - Telemedicine:  http://localhost:8086"
  echo "   - Symptom:       http://localhost:8091"
  echo ""

  trap "log_info '\nStopping all port forwards...'; cleanup_port_forwards; exit" INT
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
