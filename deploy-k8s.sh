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
export $(cat "$ENV_FILE" | grep -v '#' | xargs)
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
    "NODE_ENV"
    "NEXT_PUBLIC_AUTH_SERVICE_URL"
    "NEXT_PUBLIC_PATIENT_SERVICE_URL"
    "NEXT_PUBLIC_DOCTOR_SERVICE_URL"
    "NEXT_PUBLIC_APPOINTMENT_SERVICE_URL"
    "NEXT_PUBLIC_PAYMENT_SERVICE_URL"
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    "LIVEKIT_URL"
    "FIREBASE_PROJECT_ID"
)

# Build ConfigMap from variables
CONFIGMAP_DATA=""
for var in "${PUBLIC_VARS[@]}"; do
    val="${!var}"
    if [ -n "$val" ]; then
        CONFIGMAP_DATA+="  $var: \"$val\"\n"
    fi
done

# Create ConfigMap manifest
cat > /tmp/configmap-generated.yaml <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: telemedicine-config
  namespace: $NAMESPACE
data:
$(echo -e "$CONFIGMAP_DATA" | sed 's/^/  /')
EOF

kubectl apply -f /tmp/configmap-generated.yaml
echo -e "${GREEN}✓ ConfigMap created from .env${NC}\n"

# Create Secret from .env sensitive variables
echo -e "${YELLOW}Creating Secret from .env...${NC}"

# Extract sensitive variables for Secret
SECRET_VARS=(
    "DATABASE_URL"
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

# Build Secret from variables
SECRET_DATA=""
for var in "${SECRET_VARS[@]}"; do
    val="${!var}"
    if [ -n "$val" ]; then
        # Escape special characters for YAML
        val_escaped=$(printf '%s\n' "$val" | sed 's/[\/&]/\\&/g' | sed 's/"/\\"/g')
        SECRET_DATA+="  $var: \"$val_escaped\"\n"
    else
        SECRET_DATA+="  $var: \"<set-at-deploy-time>\"\n"
    fi
done

# Create Secret manifest
cat > /tmp/secret-generated.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: telemedicine-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
$(echo -e "$SECRET_DATA" | sed 's/^/  /')
EOF

kubectl apply -f /tmp/secret-generated.yaml
echo -e "${GREEN}✓ Secret created from .env${NC}\n"

# Deploy all services
echo -e "${YELLOW}Deploying services...${NC}"

for manifest in deployments/kubernetes/*-deployment.yaml; do
    if [ -f "$manifest" ]; then
        service_name=$(basename "$manifest" -deployment.yaml)
        echo -e "${YELLOW}  - Deploying ${service_name}...${NC}"
        kubectl apply -f "$manifest" -n "$NAMESPACE"
    fi
done

for manifest in deployments/kubernetes/*-service.yaml; do
    if [ -f "$manifest" ]; then
        service_name=$(basename "$manifest" -service.yaml)
        echo -e "${YELLOW}  - Deploying service ${service_name}...${NC}"
        kubectl apply -f "$manifest" -n "$NAMESPACE"
    fi
done

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
