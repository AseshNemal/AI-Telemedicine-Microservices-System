# AI Telemedicine Microservices System

Cloud-native distributed microservices starter for telemedicine use cases (patient, doctor, admin) using a hybrid backend stack:
- Node.js + Express + MongoDB (MERN-style services): `auth-service-node`, `patient-service-node`
- Go + Gin services: `doctor-service`, `appointment-service`, `notification-service`

Also includes Docker, Docker Compose, Kubernetes manifests, and a Next.js frontend.

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
│   ├── auth-service-node/
│   ├── patient-service-node/
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

- Auth Service (Node/Express) -> `5001`
- Patient Service (Node/Express) -> `5002`
- Doctor Service -> `8082`
- Appointment Service -> `8083`
- Notification Service -> `8084`
- Next.js Frontend -> `3000`

## API Endpoints

### Auth Service
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /health`

### Patient Service
- `POST /api/patients/internal/create` (internal)
- `GET /api/patients/me`
- `PUT /api/patients/me`
- `POST /api/patients/me/reports`
- `GET /api/patients/me/reports`
- `DELETE /api/patients/me/reports/:reportId`
- `GET /api/patients/me/prescriptions`
- `GET /api/patients/me/history`
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

- `DATABASE_URL` (for Go/Gin services still using shared env)
- `NOTIFICATION_SERVICE_URL` (optional; defaults to `http://notification-service:8084` in containers)
- `NEXT_PUBLIC_AUTH_SERVICE_URL`
- `NEXT_PUBLIC_DOCTOR_SERVICE_URL`
- `NEXT_PUBLIC_APPOINTMENT_SERVICE_URL`

Node service envs:
- `services/auth-service-node/.env`: `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_DAYS`, `INTERNAL_SERVICE_KEY`, `PATIENT_SERVICE_URL`
- `services/patient-service-node/.env`: `PORT`, `MONGO_URI`, `JWT_SECRET`, `INTERNAL_SERVICE_KEY`

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

- `http://localhost:5001/health`
- `http://localhost:5002/health`
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

- Backend stack is split: Auth + Patient are Node/Express services, while Doctor + Appointment + Notification are Go/Gin services.
- Appointment service triggers notification service after booking creation.
- MongoDB Atlas is configured via `DATABASE_URL`.
- Services are independently deployable and communicate via REST APIs.

## Kubernetes Starter Manifests

Minimal manifests are under `deployments/kubernetes/`:

- `configmap.yaml`
- `secret.yaml`
- `auth-deployment.yaml`
- `auth-service-deployment.yaml`
- `auth-service.yaml`
- `auth-mongo-deployment.yaml`
- `auth-mongo-service.yaml`
- `auth-mongo-pvc.yaml`
- `patient-service-deployment.yaml`
- `patient-service.yaml`
- `patient-mongo-deployment.yaml`
- `patient-mongo-service.yaml`
- `patient-mongo-pvc.yaml`
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

## Run a single service (developer mode)

During development each team member can run one service locally instead of the whole stack. This is useful when a member is responsible for a single microservice. Steps below assume you have Go installed and `.env` configured at the repo root.

Example (run only the Appointment service):

```bash
# from repo root
cd services/appointment-service
# load DB url from project .env into this shell, then run
set -o allexport; source ../../.env; set +o allexport
export PORT=8083
export NOTIFICATION_SERVICE_URL=http://localhost:8084   # point to local notification-service if running
go run main.go
```

Notes:
- Each service reads `DATABASE_URL` from the root `.env`. `DATABASE_URL` is required for the doctor and appointment services; the services will exit at startup if it is not set or the database cannot be reached.
- If a dependent service is required (e.g., appointment -> notification), either run that service locally on its port or change the `NOTIFICATION_SERVICE_URL` to a test endpoint.
- To run the Doctor service: `cd services/doctor-service && set -o allexport; source ../../.env; set +o allexport && PORT=8082 go run main.go`.
- To run Auth: use port `8081`, Notification: `8084`.

Working endpoints per service (use the service's host/port when running a single service):

- Auth Service (http://localhost:8081)
	- POST /register
	- POST /login
	- GET /profile
	- GET /health

- Doctor Service (http://localhost:8082)
	- GET /doctors
	- POST /doctor
	- GET /doctor/:id
	- GET /health

- Appointment Service (http://localhost:8083)
	- POST /appointments
	- GET /appointments
	- DELETE /appointments/:id
	- GET /health

- Notification Service (http://localhost:8084)
	- POST /send-email
	- POST /send-sms
	- GET /health

## Team workflow suggestion (4 members)

This repo maps naturally to a 4-person team — assign one service to each member for fast parallel development:

- Member A: `auth-service` — auth endpoints, token middleware, user lifecycle
- Member B: `doctor-service` — doctor CRUD and search
- Member C: `appointment-service` — booking flow, notifications, appointment history
- Member D: `notification-service` — email/SMS integrations and templates

Guidelines for working in parallel:

- Each developer runs their assigned service locally (see "Run a single service"). Use `PORT` environment variable so services don't conflict with others.
- For cross-service integration tests, developers can run dependent services locally or use the running Docker Compose stack for shared dependencies.
- Use the `deploy/k8s-deploy.sh` script to apply secrets/manifests for cluster testing — do not commit secrets.
- When implementing persistence, write to MongoDB using the `DATABASE_URL` from `.env` so all team members see the same DB in staging.
- Create small, focused PRs that update one service at a time. Include API contract notes (request/response shapes) in the PR description.


### Helpful deploy script

To avoid committing secrets into the repository, there is a small helper script that
creates the Kubernetes secret from your local `.env` and applies the manifests.

Usage (from repo root):
```bash
# make script executable once
chmod +x deploy/k8s-deploy.sh
./deploy/k8s-deploy.sh
```

What it does:
- extracts `DATABASE_URL` from your local `.env` into a temporary file (not committed)
- creates/updates the `telemedicine-secrets` Kubernetes Secret
- applies all manifests under `deployments/kubernetes`
- triggers rollout restarts so pods pick up the secret

Notes:
- If running on `kind` or `minikube`, load your local images into the cluster first
	(e.g. `kind load docker-image <image:tag>`).
- Do NOT commit the generated temporary files; the script removes them after use.

## Security Reminder

- Do not commit real secrets in `.env`.
- If credentials were exposed during development, rotate them immediately.

