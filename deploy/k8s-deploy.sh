#!/usr/bin/env bash
set -euo pipefail

# k8s-deploy.sh
# Safely create/update the telemedicine-secrets from the local .env and apply
# the Kubernetes manifests under deployments/kubernetes.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found in PATH; please install and configure kubectl." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env not found at $ENV_FILE" >&2
  exit 1
fi

K8S_ENV_FILE=$(mktemp)
trap 'rm -f "$K8S_ENV_FILE"' EXIT

# Extract secret keys into a temp env file (safe: we don't commit this)
grep -E '^(DATABASE_URL|LIVEKIT_API_KEY|LIVEKIT_API_SECRET)=' "$ENV_FILE" > "$K8S_ENV_FILE" || true

if [ -s "$K8S_ENV_FILE" ]; then
  echo "Creating/updating Kubernetes secret 'telemedicine-secrets' from .env..."
  kubectl create secret generic telemedicine-secrets \
    --from-env-file="$K8S_ENV_FILE" \
    --namespace=default --dry-run=client -o yaml | kubectl apply -f -
else
  echo "WARNING: no matching secret keys found in $ENV_FILE; skipping secret creation." >&2
fi

echo "Applying Kubernetes manifests in deployments/kubernetes..."
kubectl apply -f "$ROOT/deployments/kubernetes"

echo "Rolling restart deployments to pick up new secrets (if available)..."
kubectl rollout restart deployment/appointment-service || true
kubectl rollout restart deployment/doctor-service || true
kubectl rollout restart deployment/notification-service || true
kubectl rollout restart deployment/auth-service || true
kubectl rollout restart deployment/telemedicine-service || true

echo "Done. Current pod status:"
kubectl get pods -o wide

echo
echo "Notes:"
echo " - This script does NOT commit secrets to the repo. It reads .env locally and"
echo "   creates/updates a Kubernetes Secret."
echo " - If you use 'kind' or 'minikube' and built images locally, remember to load"
echo "   images into the cluster (e.g., 'kind load docker-image <image:tag>')."
