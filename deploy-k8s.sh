#!/bin/bash

# Kubernetes Deployment Script
# This script deploys all Kubernetes manifests to your cluster
# All environment variables are loaded from root .env file

set -e

# Configuration
NAMESPACE="default"
SECRETS_DIR="./secrets"
ENV_FILE="./.env"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Kubernetes Deployment for Telemedicine Microservices${NC}\n"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
    echo "Please create .env file with all required environment variables"
    exit 1
fi

# Load environment variables from .env
echo -e "${YELLOW}Loading environment variables from .env...${NC}"
set -a
. "$ENV_FILE"
set +a
echo -e "${GREEN}✓ Environment loaded${NC}\n"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl is not installed. Please install kubectl first.${NC}"
    exit 1
fi

# Check cluster connectivity
echo -e "${YELLOW}Checking Kubernetes cluster...${NC}"
kubectl cluster-info > /dev/null || { echo -e "${RED}Cannot connect to Kubernetes cluster${NC}"; exit 1; }
echo -e "${GREEN}✓ Connected to cluster${NC}\n"

# Create namespace if it doesn't exist
echo -e "${YELLOW}Creating namespace (if needed)...${NC}"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - > /dev/null
echo -e "${GREEN}✓ Namespace ready${NC}\n"

# Create Firebase secret from local file if it exists
if [ -f "${SECRETS_DIR}/firebase-service-account.json" ]; then
    echo -e "${YELLOW}Setting up Firebase service account secret...${NC}"
    kubectl create secret generic firebase-service-account \
        --from-file=service-account.json="${SECRETS_DIR}/firebase-service-account.json" \
        -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - > /dev/null
    echo -e "${GREEN}✓ Firebase service account secret created${NC}\n"
else
    echo -e "${YELLOW}⚠ Firebase service account file not found at ${SECRETS_DIR}/firebase-service-account.json${NC}"
    echo -e "${YELLOW}Skipping Firebase secret creation${NC}\n"
fi

# Create ConfigMap from .env variables
echo -e "${YELLOW}Creating ConfigMap from .env...${NC}"

# Extract public/non-sensitive variables for ConfigMap
PUBLIC_VARS=(
    "AUTH_PORT"
    "PATIENT_PORT"
    "DOCTOR_PORT"
    "APPOINTMENT_PORT"
    "NOTIFICATION_PORT"
    "PAYMENT_PORT"
    "TELEMEDICINE_PORT"
    "SYMPTOM_SERVICE_PORT"
    "NODE_ENV"
    "AUTH_SERVICE_URL"
    "PAYMENT_SERVICE_URL"
    "APPOINTMENT_SERVICE_URL"
    "PATIENT_SERVICE_URL"
    "SYMPTOM_SERVICE_URL"
    "NOTIFICATION_SERVICE_URL"
    "NEXT_PUBLIC_AUTH_SERVICE_URL"
    "NEXT_PUBLIC_PATIENT_SERVICE_URL"
    "NEXT_PUBLIC_DOCTOR_SERVICE_URL"
    "NEXT_PUBLIC_APPOINTMENT_SERVICE_URL"
    "NEXT_PUBLIC_PAYMENT_SERVICE_URL"
    "NEXT_PUBLIC_SYMPTOM_SERVICE_URL"
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    "GOOGLE_CLIENT_ID"
    "LIVEKIT_URL"
    "FIREBASE_PROJECT_ID"
)

# Build ConfigMap from variables, falling back to safe defaults when .env omits a key
config_default() {
    case "$1" in
        AUTH_PORT) echo "${AUTH_PORT:-5001}" ;;
        PATIENT_PORT) echo "${PATIENT_PORT:-5002}" ;;
        DOCTOR_PORT) echo "${DOCTOR_PORT:-8082}" ;;
        APPOINTMENT_PORT) echo "${APPOINTMENT_PORT:-8083}" ;;
        NOTIFICATION_PORT) echo "${NOTIFICATION_PORT:-8084}" ;;
        PAYMENT_PORT) echo "${PAYMENT_PORT:-8085}" ;;
        TELEMEDICINE_PORT) echo "${TELEMEDICINE_PORT:-8086}" ;;
        SYMPTOM_SERVICE_PORT) echo "${SYMPTOM_SERVICE_PORT:-8091}" ;;
        NODE_ENV) echo "${NODE_ENV:-production}" ;;
        AUTH_SERVICE_URL) echo "${AUTH_SERVICE_URL:-http://auth-service:8081}" ;;
        PAYMENT_SERVICE_URL) echo "${PAYMENT_SERVICE_URL:-http://payment-service:8085}" ;;
        APPOINTMENT_SERVICE_URL) echo "${APPOINTMENT_SERVICE_URL:-http://appointment-service:8083}" ;;
        PATIENT_SERVICE_URL) echo "${PATIENT_SERVICE_URL:-http://patient-service:5002}" ;;
        SYMPTOM_SERVICE_URL) echo "${SYMPTOM_SERVICE_URL:-http://symptom-service:8091}" ;;
        NOTIFICATION_SERVICE_URL) echo "${NOTIFICATION_SERVICE_URL:-http://notification-service:8084}" ;;
        NEXT_PUBLIC_AUTH_SERVICE_URL) echo "http://localhost" ;;
        NEXT_PUBLIC_PATIENT_SERVICE_URL) echo "http://localhost" ;;
        NEXT_PUBLIC_DOCTOR_SERVICE_URL) echo "http://localhost" ;;
        NEXT_PUBLIC_APPOINTMENT_SERVICE_URL) echo "http://localhost" ;;
        NEXT_PUBLIC_PAYMENT_SERVICE_URL) echo "http://localhost" ;;
        NEXT_PUBLIC_SYMPTOM_SERVICE_URL) echo "http://localhost" ;;
        NEXT_PUBLIC_FIREBASE_PROJECT_ID) echo "${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-${FIREBASE_PROJECT_ID:-}}" ;;
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) echo "${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-}" ;;
        GOOGLE_CLIENT_ID) echo "${GOOGLE_CLIENT_ID:-}" ;;
        LIVEKIT_URL) echo "${LIVEKIT_URL:-http://telemedicine-service:8086}" ;;
        FIREBASE_PROJECT_ID) echo "${FIREBASE_PROJECT_ID:-}" ;;
        *) echo "" ;;
    esac
}

CONFIGMAP_ARGS=()
for var in "${PUBLIC_VARS[@]}"; do
    val="$(config_default "$var")"
    CONFIGMAP_ARGS+=("--from-literal=${var}=${val}")
done

# Create ConfigMap directly from literals so missing .env keys still get defaults
kubectl create configmap telemedicine-config \
    "${CONFIGMAP_ARGS[@]}" \
    -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓ ConfigMap created from .env${NC}\n"

# Create Secret from .env sensitive variables
echo -e "${YELLOW}Creating Secret from .env...${NC}"

# Extract sensitive variables for Secret
SECRET_VARS=(
    "DATABASE_URL"
    "FIREBASE_PROJECT_ID"
    "FIREBASE_CLIENT_EMAIL"
    "FIREBASE_PRIVATE_KEY"
    "FIREBASE_SERVICE_ACCOUNT_PATH"
    "FIREBASE_WEB_API_KEY"
    "NEXT_PUBLIC_FIREBASE_API_KEY"
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "OPENAI_API_KEY"
    "OPENAI_MODEL"
    "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN"
    "TWILIO_PHONE_NUMBER"
    "SENDGRID_API_KEY"
    "SENDGRID_SENDER_EMAIL"
    "LIVEKIT_API_KEY"
    "LIVEKIT_API_SECRET"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "STRIPE_PUBLIC_KEY"
    "INTERNAL_SERVICE_KEY"
    "Web_client_ID"
    "Web_client_secret"
)

# Build Secret directly from literals to support multiline values and safe defaults
secret_default() {
    case "$1" in
        DATABASE_URL) echo "${DATABASE_URL:-mongodb://admin:admin@mongodb-payment:27017/payment-db?authSource=admin}" ;;
        FIREBASE_PROJECT_ID) echo "${FIREBASE_PROJECT_ID:-}" ;;
        FIREBASE_CLIENT_EMAIL) echo "${FIREBASE_CLIENT_EMAIL:-}" ;;
        FIREBASE_PRIVATE_KEY) echo "${FIREBASE_PRIVATE_KEY:-}" ;;
        FIREBASE_SERVICE_ACCOUNT_PATH) echo "${FIREBASE_SERVICE_ACCOUNT_PATH:-/var/secrets/firebase/service-account.json}" ;;
        FIREBASE_WEB_API_KEY) echo "${FIREBASE_WEB_API_KEY:-}" ;;
        NEXT_PUBLIC_FIREBASE_API_KEY) echo "${NEXT_PUBLIC_FIREBASE_API_KEY:-}" ;;
        GOOGLE_CLIENT_ID) echo "${GOOGLE_CLIENT_ID:-}" ;;
        GOOGLE_CLIENT_SECRET) echo "${GOOGLE_CLIENT_SECRET:-}" ;;
        OPENAI_API_KEY) echo "${OPENAI_API_KEY:-}" ;;
        OPENAI_MODEL) echo "${OPENAI_MODEL:-gpt-4o-mini}" ;;
        TWILIO_ACCOUNT_SID) echo "${TWILIO_ACCOUNT_SID:-}" ;;
        TWILIO_AUTH_TOKEN) echo "${TWILIO_AUTH_TOKEN:-}" ;;
        TWILIO_PHONE_NUMBER) echo "${TWILIO_PHONE_NUMBER:-}" ;;
        SENDGRID_API_KEY) echo "${SENDGRID_API_KEY:-}" ;;
        SENDGRID_SENDER_EMAIL) echo "${SENDGRID_SENDER_EMAIL:-}" ;;
        LIVEKIT_API_KEY) echo "${LIVEKIT_API_KEY:-}" ;;
        LIVEKIT_API_SECRET) echo "${LIVEKIT_API_SECRET:-}" ;;
        STRIPE_SECRET_KEY) echo "${STRIPE_SECRET_KEY:-}" ;;
        STRIPE_WEBHOOK_SECRET) echo "${STRIPE_WEBHOOK_SECRET:-}" ;;
        STRIPE_PUBLIC_KEY) echo "${STRIPE_PUBLIC_KEY:-}" ;;
        INTERNAL_SERVICE_KEY) echo "${INTERNAL_SERVICE_KEY:-}" ;;
        Web_client_ID) echo "${Web_client_ID:-}" ;;
        Web_client_secret) echo "${Web_client_secret:-}" ;;
        *) echo "" ;;
    esac
}

SECRET_ARGS=()
for var in "${SECRET_VARS[@]}"; do
    val="$(secret_default "$var")"
    SECRET_ARGS+=("--from-literal=${var}=${val}")
done

kubectl create secret generic telemedicine-secrets \
    "${SECRET_ARGS[@]}" \
    -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✓ Secret created from .env${NC}\n"

# Deploy all manifests (deployments, services, statefulsets, configmaps, secrets)
echo -e "${YELLOW}Deploying services...${NC}"
kubectl apply -f deployments/kubernetes -n "$NAMESPACE"

echo -e "${YELLOW}Re-applying generated ConfigMap/Secret from .env to override static placeholders...${NC}"
kubectl create configmap telemedicine-config \
    "${CONFIGMAP_ARGS[@]}" \
    -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic telemedicine-secrets \
    "${SECRET_ARGS[@]}" \
    -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✓ All services deployed${NC}\n"

# Wait for deployments to be ready
echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment --all -n "$NAMESPACE" || true

# Show deployment status
echo -e "\n${BLUE}Deployment Status:${NC}"
kubectl get deployments -n "$NAMESPACE"
echo ""
kubectl get pods -n "$NAMESPACE"
echo ""
kubectl get services -n "$NAMESPACE"

echo -e "\n${GREEN}✓ Deployment complete!${NC}\n"

echo -e "${BLUE}Useful Commands:${NC}"
echo "  View logs:         kubectl logs -f deployment/auth-service -n $NAMESPACE"
echo "  Port forward:      kubectl port-forward svc/web-app 3000:3000 -n $NAMESPACE"
echo "  Delete deployment: kubectl delete -f deployments/kubernetes/ -n $NAMESPACE"
echo "  Update secret:     kubectl set env deployment/auth-service <VAR>=<VALUE> -n $NAMESPACE"
echo ""
echo -e "${YELLOW}Note: All environment variables are loaded from .env file${NC}"
