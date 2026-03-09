# AI Telemedicine Microservices System

Cloud-native distributed microservices starter for telemedicine use cases (patient, doctor, admin) using Go, Gin, Docker, Docker Compose, Kubernetes manifests, and a Next.js frontend.

## Project Structure

```text
AI Telemedicine Microservices System/
├── services/
│   ├── auth-service/
│   │   ├── main.go
│   │   ├── database/
│   │   ├── handlers/
│   │   ├── models/
│   │   └── routes/
│   ├── doctor-service/
│   ├── appointment-service/
│   └── notification-service/
├── web-app/
├── deployments/
│   ├── docker-compose.yml
│   └── kubernetes/
├── docs/
│   └── architecture.md
└── .env
```

## Services and Ports

- Auth Service -> `8081`
- Doctor Service -> `8082`
- Appointment Service -> `8083`
- Notification Service -> `8084`
- Next.js Frontend -> `3000`

## API Endpoints

### Auth Service
- `POST /register`
- `POST /login`
- `GET /profile`
- `GET /health`

### Doctor Service
- `GET /doctors`
- `POST /doctor`
- `GET /doctor/:id`
- `GET /health`

### Appointment Service
- `POST /appointments`
- `GET /appointments`
- `DELETE /appointments/:id`
- `GET /health`

### Notification Service
- `POST /send-email`
- `POST /send-sms`
- `GET /health`

## Environment Variables

Use your current `.env` for local runtime and `.env.example` as template.

Required:

- `DATABASE_URL`
- `NOTIFICATION_SERVICE_URL` (optional; defaults to `http://notification-service:8084` in containers)
- `NEXT_PUBLIC_AUTH_SERVICE_URL`
- `NEXT_PUBLIC_DOCTOR_SERVICE_URL`
- `NEXT_PUBLIC_APPOINTMENT_SERVICE_URL`

## Local Run (Docker Compose)

From `deployments/` directory:

1. Build and run all services:
	- `docker compose up --build`
2. Open frontend:
	- `http://localhost:3000`
3. Check health endpoints:
	- `http://localhost:8081/health`
	- `http://localhost:8082/health`
	- `http://localhost:8083/health`
	- `http://localhost:8084/health`

## Kubernetes Starter Manifests

Minimal manifests are under `deployments/kubernetes/`:

- `configmap.yaml`
- `secret.yaml`
- `auth-deployment.yaml`
- `doctor-deployment.yaml`
- `appointment-deployment.yaml`
- `notification-deployment.yaml`

Apply with your cluster context:

1. `kubectl apply -f deployments/kubernetes/configmap.yaml`
2. `kubectl apply -f deployments/kubernetes/secret.yaml`
3. `kubectl apply -f deployments/kubernetes/auth-deployment.yaml`
4. `kubectl apply -f deployments/kubernetes/doctor-deployment.yaml`
5. `kubectl apply -f deployments/kubernetes/appointment-deployment.yaml`
6. `kubectl apply -f deployments/kubernetes/notification-deployment.yaml`

## Notes

- Auth service is currently **mock-first** by design, so Firebase can be integrated in a later increment.
- Appointment service triggers notification service after booking creation.
- MongoDB Atlas is configured via `DATABASE_URL`.

