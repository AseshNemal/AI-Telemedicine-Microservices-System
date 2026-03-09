# AI Telemedicine Microservices System

Cloud-native distributed microservices starter for telemedicine use cases (patient, doctor, admin) using Go, Gin, Docker, Docker Compose, Kubernetes manifests, and a Next.js frontend.

## Prerequisites

Install the following before running:

- Docker Desktop (with Docker Compose v2)
- Git
- Node.js 22+ (only needed if running frontend without Docker)
- Go 1.25+ (only needed if running services without Docker)

## Quick Setup

1. Ensure `.env` exists at project root (same level as `README.md`).
2. Put your MongoDB Atlas connection string in `DATABASE_URL`.
3. (Optional) Use `.env.example` as a reference template.

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

## Local Run (Docker Compose) - macOS / Linux (zsh/bash)

Run from the `deployments/` directory:

1. Start all services:
	 - `cd deployments`
	 - `docker compose up --build`
2. Open frontend:
	 - `http://localhost:3000`
3. Stop services:
	 - `Ctrl + C`
	 - `docker compose down`

## Local Run (Docker Compose) - Windows (PowerShell)

Run from the `deployments` folder:

1. Start all services:
	 - `Set-Location .\deployments`
	 - `docker compose up --build`
2. Open frontend:
	 - `http://localhost:3000`
3. Stop services:
	 - `Ctrl + C`
	 - `docker compose down`

## Health Check (All Platforms)

After startup, verify:

- `http://localhost:8081/health`
- `http://localhost:8082/health`
- `http://localhost:8083/health`
- `http://localhost:8084/health`

## API Smoke Test (Sample Data)

Register user:

- Endpoint: `POST http://localhost:8081/register`
- Sample payload:
	- `{"name":"Alex","email":"alex@example.com","password":"123456","role":"Patient"}`

Create appointment:

- Endpoint: `POST http://localhost:8083/appointments`
- Sample payload:
	- `{"patientId":"patient-001","doctorId":"doc-1","date":"2026-03-10","time":"10:30"}`

Expected behavior:

- Appointment is created with status `BOOKED`
- Notification service logs a simulated email event

## Common Run Issues

- Running `docker compose` from the wrong folder:
	- Always run from `deployments/` where `docker-compose.yml` exists.
- Port already in use:
	- Stop conflicting process or change host port mapping in `deployments/docker-compose.yml`.
- MongoDB connection errors:
	- Re-check `DATABASE_URL` in root `.env`.
- Stale containers/images:
	- Run `docker compose down` then `docker compose up --build`.

## Project Notes

- Auth service is currently **mock-first** by design, so Firebase can be integrated in a later increment.
- Appointment service triggers notification service after booking creation.
- MongoDB Atlas is configured via `DATABASE_URL`.
- Services are independently deployable and communicate via REST APIs.

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

## Security Reminder

- Do not commit real secrets in `.env`.
- If credentials were exposed during development, rotate them immediately.

