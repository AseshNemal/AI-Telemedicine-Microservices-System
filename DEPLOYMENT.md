# Telemedicine Microservices - Deployment Guide

Complete deployment setup for AI Telemedicine Microservices System with Docker and Kubernetes configurations.

## 📋 Overview

This deployment includes:

- **9 Microservices**:
  - Auth Service (Node.js) - Port 5001
  - Patient Service (Node.js) - Port 5002
  - Doctor Service (Go) - Port 8082
  - Appointment Service (Go) - Port 8083
  - Notification Service (Go) - Port 8084
  - AI Symptom Service (Go) - Port 8091
  - Payment Service (Go) - Port 8085
  - Telemedicine Service (Go) - Port 8086
  - Web App (Next.js) - Port 3000

- **Message Queues & Databases**:
  - MongoDB (Auth, Patient, Payment)
  - Firebase (Authentication & Real-time)

- **External Integrations**:
  - OpenAI (AI Symptom Assessment)
  - Stripe (Payment Processing)
  - Twilio (SMS Notifications)
  - SendGrid (Email Notifications)
  - LiveKit (Video Conferencing)

## 🚀 Quick Start

### Prerequisites

#### For Docker Compose
- Docker Desktop (v20.10+) with Docker Compose v2
- 6GB+ available RAM
- 20GB+ disk space

#### For Kubernetes
- kubectl (v1.24+)
- Kubernetes cluster (v1.24+)
- Docker Registry access (optional)
- 2+ CPU cores & 4GB+ RAM per node

### Local Development with Docker Compose

```bash
# Make scripts executable
chmod +x build.sh docker-compose.sh deploy-k8s.sh

# Build and start all services
./docker-compose.sh up

# View logs
./docker-compose.sh logs auth-service

# Stop services
./docker-compose.sh down
```

### Kubernetes Deployment

```bash
# Make script executable
chmod +x deploy-k8s.sh

# Deploy to cluster
./deploy-k8s.sh

# Check status
kubectl get pods -n default
kubectl get svc -n default
```

## 📦 Docker Configuration

### Optimized Dockerfiles

All services use multi-stage builds to minimize image sizes:

**Go Services** (Alpine-based, ~30-40MB):
```dockerfile
FROM golang:1.25-alpine AS builder
# Build stage
FROM alpine:3.20
# Runtime stage - minimal footprint
```

**Node.js Services** (Alpine-based, ~80-120MB):
```dockerfile
FROM node:22-alpine AS dependencies
FROM node:22-alpine AS builder
FROM node:22-alpine
# Optimized caching layers
```

**Next.js Web App** (Alpine-based, ~150-200MB):
```dockerfile
FROM node:22-alpine AS dependencies
FROM node:22-alpine AS builder
FROM node:22-alpine
# Separate dependencies, build, and runtime
```

### Docker Compose Features

- **Health checks** for all services
- **Ordered startup** with dependency management
- **Volume mounts** for persistent data
- **Environment variable** loading from `.env`
- **Network isolation** with bridge network
- **Port mappings** for local development

**Key volumes:**
```yaml
auth-db-data: MongoDB data (auth-service)
patient-db-data: MongoDB data (patient-service)
payment-db-data: MongoDB data (payment-service)
patient-uploads: Patient file uploads
```

**Health check example:**
```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5001/api/auth/health"]
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 30s
```

## ☸️ Kubernetes Configuration

### Deployment Features

- **Rolling updates** with zero downtime
- **Resource limits** (CPU & memory per service)
- **Readiness/liveness probes** for health management
- **ConfigMap** for environment variables
- **Secrets** for sensitive credentials
- **Service discovery** via DNS
- **Load balancing** with Service resources

### Environment Management

**ConfigMap** (`deployments/kubernetes/configmap.yaml`):
- Service ports and URLs
- Firebase configuration
- LiveKit settings
- Service-to-service communication URLs
- Google OAuth client ID

**Secret** (`deployments/kubernetes/secret.yaml`):
- Database credentials
- Firebase admin SDK credentials
- API keys (OpenAI, Stripe, Twilio, etc.)
- Auth tokens and secrets
- Private keys

### Service Architecture

```
LoadBalancer (web-app:3000)
    ↓
Kubernetes Services (ClusterIP)
    ↓
Deployments (2 replicas each)
    ↓
StatefulSets (MongoDB)
```

### Replica Configuration

- **Production services**: 2 replicas (rolling updates)
- **Web app**: 2 replicas (load balanced)
- **Databases**: Single instance (can be scaled separately)

## 🔧 Environment Variables

### Required for Production

```bash
# Database
DATABASE_URL=mongodb+srv://user:pass@host/db

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=admin@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."

# Firebase Web SDK
FIREBASE_WEB_API_KEY=AIzaSy...

# Google OAuth
GOOGLE_CLIENT_ID=xxx-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# APIs
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# Notifications
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1...
SENDGRID_API_KEY=SG...
SENDGRID_SENDER_EMAIL=noreply@company.com

# Payment
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLIC_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Video
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=xxx
LIVEKIT_URL=wss://...

# Internal
INTERNAL_SERVICE_KEY=long-random-secret
```

### Kubernetes Secret Creation

```bash
# Create from .env file
kubectl create secret generic telemedicine-secrets \
  --from-literal=DATABASE_URL="$(grep DATABASE_URL .env | cut -d= -f2)" \
  --from-literal=FIREBASE_PROJECT_ID="$(grep FIREBASE_PROJECT_ID .env | cut -d= -f2)" \
  # ... add more secrets
```

Or update `secret.yaml` with actual values before applying.

## 📊 Monitoring & Troubleshooting

### Kubernetes

```bash
# Check pod status
kubectl get pods -n default
kubectl describe pod <pod-name> -n default

# View logs
kubectl logs -f deployment/auth-service -n default

# Port forwarding
kubectl port-forward svc/web-app 3000:3000 -n default

# Service endpoints
kubectl get endpoints -n default

# Resource usage
kubectl top nodes
kubectl top pods -n default
```

### Docker Compose

```bash
# View running services
./docker-compose.sh ps

# View specific service logs
./docker-compose.sh logs auth-service -f

# Access container shell
docker exec -it auth-service sh

# Check network
docker network inspect telemedicine-net
```

## 🔐 Security Considerations

### Docker

- ✅ Non-root user (`node:node` or Alpine user)
- ✅ Read-only filesystem (where possible)
- ✅ Secrets mounted as volumes
- ✅ No credentials in Dockerfiles
- ⚠️ Network isolation with bridge network

### Kubernetes

- ✅ Resource quotas (CPU/memory limits)
- ✅ Network policies (restrict traffic)
- ✅ RBAC where needed
- ✅ Secrets not stored in ConfigMap
- ✅ Rolling updates (no service disruption)
- ⚠️ Consider adding ingress with TLS
- ⚠️ Add pod security policies

### Recommendations

```bash
# Enable network policies
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-services
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector: {}
EOF
```

## 📈 Scaling

### Horizontal Pod Autoscaling (Kubernetes)

```bash
kubectl autoscale deployment auth-service --min=2 --max=10 -n default
kubectl autoscale deployment symptom-service --min=3 --max=15 -n default
```

### Manual Scaling

```bash
# Kubernetes
kubectl scale deployment auth-service --replicas=5 -n default

# Docker Compose (not directly supported)
docker-compose up -d --scale service-name=3
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build images
        run: ./build.sh
      - name: Deploy to K8s
        run: ./deploy-k8s.sh
        env:
          KUBECONFIG: ${{ secrets.KUBE_CONFIG }}
```

## ❌ Troubleshooting

### Services won't start

```bash
# Docker Compose
docker-compose logs auth-service
docker exec auth-service npm list

# Kubernetes
kubectl describe pod <pod-name>
kubectl logs <pod-name> --previous  # Previous crash logs
```

### Image pull errors

```bash
# Check Docker daemon (Compose)
docker ps

# Check image availability (K8s)
kubectl get images
docker image ls
```

### Health check failures

```bash
# Manual health check
curl http://localhost:5001/api/auth/health

# Kubernetes describe
kubectl describe deployment auth-service
```

### Firebase authentication issues

- Verify `FIREBASE_SERVICE_ACCOUNT_PATH` points to valid JSON
- Check Firebase Admin SDK credentials validity
- Ensure Firebase project ID matches `.env`

### Database connection failures

```bash
# Kubernetes
kubectl logs deployment/mongodb-auth
kubectl get secrets

# Docker Compose
docker logs mongodb-auth
docker exec auth-service npm run db:migrate
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Go Container Best Practices](https://docs.docker.com/language/golang/build-images/)

## 🛠️ Maintenance

### Database Backups (MongoDB)

```bash
# Docker
docker exec mongodb-auth mongodump --out /backup

# Kubernetes
kubectl exec -i deployment/mongodb-auth -- mongodump --out /backup
```

### Logs Archival

```bash
# Docker
docker logs auth-service > auth-service-$(date +%Y%m%d).log

# Kubernetes
kubectl logs deployment/auth-service > auth-service-$(date +%Y%m%d).log
```

### Rolling Updates

```bash
# Kubernetes will handle automatically
# Docker Compose - manual restart chains
./docker-compose.sh restart auth-service
```

## 📝 Development Notes

### Port Mappings

| Service | Port | Health Check |
|---------|------|--------------|
| Web App | 3000 | `GET /` |
| Auth | 5001 | `GET /api/auth/health` |
| Patient | 5002 | `GET /api/patients/health` |
| Doctor | 8082 | `GET /api/doctors/health` |
| Appointment | 8083 | `GET /api/appointments/health` |
| Notification | 8084 | `GET /api/notifications/health` |
| Symptom | 8091 | `GET /api/symptom/health` |
| Payment | 8085 | N/A |
| Telemedicine | 8086 | `GET /api/telemedicine/health` |

### MongoDB Connection Strings

| Database | Connection |
|----------|-----------|
| Auth | `mongodb://admin:admin@mongodb-auth:27017/auth-db?authSource=admin` |
| Patient | `mongodb://admin:admin@mongodb-patient:27017/patient-db?authSource=admin` |
| Payment | `mongodb://admin:admin@mongodb-payment:27017/payment-db?authSource=admin` |

## 🎯 Next Steps

1. ✅ **Review Configuration**: Update `.env` with real credentials
2. ✅ **Build Images**: `./build.sh` (requires Docker)
3. ✅ **Deploy Locally**: `./docker-compose.sh up` for testing
4. ✅ **Deploy to K8s**: `./deploy-k8s.sh` for production
5. ✅ **Configure CI/CD**: Set up automated deployments
6. ✅ **Add Monitoring**: Set up Prometheus, Grafana, ELK

---

**Last Updated**: March 29, 2026  
**Version**: 1.0.0
