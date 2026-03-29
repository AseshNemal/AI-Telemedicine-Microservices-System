#!/bin/bash

# Docker Build Script
# This script builds Docker images using environment variables from root .env file

set -e

# Configuration
REGISTRY="${DOCKER_REGISTRY:-docker.io}"
NAMESPACE="${DOCKER_NAMESPACE:-telemedicine}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ENV_FILE="./.env"
PUSH_TO_REGISTRY="${PUSH_TO_REGISTRY:-false}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Building Telemedicine Microservices - Docker Images${NC}\n"

# Ensure we're in the root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
    echo -e "${YELLOW}Creating placeholder .env file...${NC}"
    echo "# Add your environment variables here" > "$ENV_FILE"
    echo "NODE_ENV=production" >> "$ENV_FILE"
    echo -e "${YELLOW}Please update ${ENV_FILE} with your configuration and run again${NC}\n"
    exit 1
fi

# Load environment variables from .env
echo -e "${YELLOW}Loading environment variables from .env...${NC}"
export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
echo -e "${GREEN}✓ Environment loaded${NC}\n"

# Extract key build arguments from .env
BUILD_ARGS=""
if [ -n "$NODE_ENV" ]; then
    BUILD_ARGS+="--build-arg NODE_ENV=$NODE_ENV "
fi
if [ -n "$OPENAI_MODEL" ]; then
    BUILD_ARGS+="--build-arg OPENAI_MODEL=$OPENAI_MODEL "
fi

# Function to build and push image
build_image() {
    local service=$1
    local dockerfile_path=$2
    local image_name="${REGISTRY}/${NAMESPACE}/${service}:${IMAGE_TAG}"
    
    echo -e "${YELLOW}Building ${service}...${NC}"
    echo -e "${YELLOW}  Build args: $BUILD_ARGS${NC}"
    
    docker build \
        $BUILD_ARGS \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        -t "$image_name" \
        -f "$dockerfile_path" \
        . \
        --progress=plain
    
    if [ "$PUSH_TO_REGISTRY" = "true" ]; then
        echo -e "${YELLOW}Pushing ${service} to registry...${NC}"
        docker push "$image_name"
    fi
    
    echo -e "${GREEN}✓ ${service} built successfully${NC}\n"
}

echo -e "${BLUE}Building all services...${NC}\n"

# Build all services
build_image "auth-service" "services/auth-service-node/Dockerfile"
build_image "patient-service" "services/patient-service-node/Dockerfile"
build_image "doctor-service" "services/doctor-service/Dockerfile"
build_image "appointment-service" "services/appointment-service/Dockerfile"
build_image "notification-service" "services/notification-service/Dockerfile"
build_image "symptom-service" "services/AI-symptom-service/Dockerfile"
build_image "payment-service" "services/payment-service/Dockerfile"
build_image "telemedicine-service" "services/telemedicine-service/Dockerfile"
build_image "web-app" "web-app/Dockerfile"

echo -e "${GREEN}✅ All images built successfully!${NC}"

# Show built images
echo -e "\n${BLUE}Built Docker Images:${NC}"
docker images --filter "reference=${REGISTRY}/${NAMESPACE}/*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Tag images for local use (without registry prefix)
echo -e "\n${YELLOW}Tagging images for local use...${NC}"
docker tag "${REGISTRY}/${NAMESPACE}/auth-service:${IMAGE_TAG}" "auth-service:${IMAGE_TAG}"
docker tag "${REGISTRY}/${NAMESPACE}/patient-service:${IMAGE_TAG}" "patient-service:${IMAGE_TAG}"
docker tag "${REGISTRY}/${NAMESPACE}/doctor-service:${IMAGE_TAG}" "doctor-service:${IMAGE_TAG}"
docker tag "${REGISTRY}/${NAMESPACE}/appointment-service:${IMAGE_TAG}" "appointment-service:${IMAGE_TAG}"
docker tag "${REGISTRY}/${NAMESPACE}/notification-service:${IMAGE_TAG}" "notification-service:${IMAGE_TAG}"
docker tag "${REGISTRY}/${NAMESPACE}/symptom-service:${IMAGE_TAG}" "symptom-service:${IMAGE_TAG}"
docker tag "${REGISTRY}/${NAMESPACE}/payment-service:${IMAGE_TAG}" "payment-service:${IMAGE_TAG}"
docker tag "${REGISTRY}/${NAMESPACE}/telemedicine-service:${IMAGE_TAG}" "telemedicine-service:${IMAGE_TAG}"
docker tag "${REGISTRY}/${NAMESPACE}/web-app:${IMAGE_TAG}" "web-app:${IMAGE_TAG}"

echo -e "${GREEN}✓ Images tagged for local use${NC}\n"

echo -e "${BLUE}Next Steps:${NC}"
echo "1. Start Docker containers (local):"
echo "   ./docker-compose.sh up"
echo ""
echo "2. Or deploy to Kubernetes:"
echo "   ./deploy-k8s.sh"
echo ""
echo "3. Check deployment status:"
echo "   docker ps (for Docker Compose)"
echo "   kubectl get pods (for Kubernetes)"
echo ""
echo -e "${YELLOW}Note: Images built using environment variables from .env${NC}"
echo "   kubectl get deployments -n default"
echo "   kubectl get pods -n default"
