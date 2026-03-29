#!/bin/bash

# Docker Compose Deployment Script
# This script manages Docker Compose deployments

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

COMMAND="${1:-up}"
COMPOSE_FILE="deployments/docker-compose.yml"

echo -e "${BLUE}Telemedicine Microservices - Docker Compose${NC}\n"

# Check if docker and docker-compose are installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker Desktop first.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}docker-compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Determine which compose command to use
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

case "$COMMAND" in
    up)
        echo -e "${YELLOW}Building and starting services...${NC}"
        $COMPOSE_CMD -f "$COMPOSE_FILE" up -d --build
        echo -e "${GREEN}✓ Services started${NC}"
        echo -e "\n${BLUE}Services available at:${NC}"
        echo "  Web App:           http://localhost:3000"
        echo "  Auth Service:      http://localhost:5001"
        echo "  Patient Service:   http://localhost:5002"
        echo "  Doctor Service:    http://localhost:8082"
        echo "  Appointment Svc:   http://localhost:8083"
        echo "  Notification Svc:  http://localhost:8084"
        echo "  Symptom Service:   http://localhost:8091"
        echo "  Payment Service:   http://localhost:8085"
        echo "  Telemedicine Svc:  http://localhost:8086"
        ;;
    
    down)
        echo -e "${YELLOW}Stopping all services...${NC}"
        $COMPOSE_CMD -f "$COMPOSE_FILE" down
        echo -e "${GREEN}✓ Services stopped${NC}"
        ;;
    
    restart)
        echo -e "${YELLOW}Restarting services...${NC}"
        $COMPOSE_CMD -f "$COMPOSE_FILE" restart
        echo -e "${GREEN}✓ Services restarted${NC}"
        ;;
    
    logs)
        SERVICE="${2:-}"
        if [ -z "$SERVICE" ]; then
            $COMPOSE_CMD -f "$COMPOSE_FILE" logs -f
        else
            $COMPOSE_CMD -f "$COMPOSE_FILE" logs -f "$SERVICE"
        fi
        ;;
    
    ps)
        echo -e "${BLUE}Running Services:${NC}"
        $COMPOSE_CMD -f "$COMPOSE_FILE" ps
        ;;
    
    build)
        echo -e "${YELLOW}Building Docker images...${NC}"
        $COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache
        echo -e "${GREEN}✓ Images built${NC}"
        ;;
    
    prune)
        echo -e "${YELLOW}Cleaning up Docker resources...${NC}"
        $COMPOSE_CMD -f "$COMPOSE_FILE" down -v
        docker system prune -f
        echo -e "${GREEN}✓ Resources cleaned${NC}"
        ;;
    
    *)
        echo -e "${BLUE}Usage: $0 {up|down|restart|logs|ps|build|prune} [service]${NC}"
        echo ""
        echo "Commands:"
        echo "  up       - Build and start all services"
        echo "  down     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  logs     - View service logs (optionally follow specific service)"
        echo "  ps       - Show running services"
        echo "  build    - Build all Docker images"
        echo "  prune    - Remove all containers, volumes, and clean up"
        ;;
esac
