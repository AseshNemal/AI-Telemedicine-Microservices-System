# AI Telemedicine Microservices System

Cloud-native distributed microservices starter for telemedicine use cases (patient, doctor, admin) using a hybrid backend stack:
- Node.js + Express + MongoDB (MERN-style services): `auth-service-node`, `patient-service-node`
- Go + Gin services: `doctor-service`, `appointment-service`, `notification-service`, `payment-service`, `AI-symptom-service`

Also includes Docker, Docker Compose, Kubernetes manifests, and a Next.js frontend.

## Prerequisites

Install the following before running:

- Docker Desktop (with Docker Compose v2)
- Git
- Node.js 22+ (only needed if running frontend without Docker)
- Go 1.25+ (only needed if running services without Docker)

## Quick Setup

1. Ensure `.env` exists at project root (same level as `README.md`).
2. Configure MongoDB + Firebase env values using `.env.example`.
3. Place Firebase service account JSON at `secrets/firebase-service-account.json`.
4. (Optional) Use `.env.example` as a reference template.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Next.js Web App (3000)                    │
├──────────────────────────────────────────────────────────────┤
│                  NGINX API Gateway (80)                      │
├──────┬──────────┬──────────┬──────────┬────────┬────────────┤
│      │          │          │          │        │            │
│ Auth │ Patient  │ Doctor   │Appt      │ Notify │  Payment   │
│5001  │  5002    │  8082    │ 8083     │  8084  │  8085      │
│Node  │  Node    │   Go     │   Go     │   Go   │    Go      │
└──────┴──────────┴──────────┴──────────┴────────┴────────────┘
```

The **NGINX API Gateway** provides a single entry point for all microservices. See [api-gateway-nginx/README.md](api-gateway-nginx/README.md) for detailed configuration and deployment options.

## Project Structure

```text
AI Telemedicine Microservices System/
├── services/
│   ├── auth-service-node/
│   ├── patient-service-node/
│   ├── doctor-service/
│   ├── appointment-service/
│   ├── notification-service/
│   ├── payment-service/
│   └── AI-symptom-service/
├── web-app/
├── deployments/
│   ├── docker-compose.yml
│   └── kubernetes/
├── docs/
│   └── architecture.md
└── .env
```

## Services and Ports

**API Gateway (single entry point):**
- Gateway -> `80` (access all services via `/api/*`, `/doctors`, `/appointments`, `/payments`, etc.)

**Individual Service Ports (for direct access during development):**
- Auth Service (Node/Express) -> `5001`
- Patient Service (Node/Express) -> `5002`
- Doctor Service -> `8082`
- Appointment Service -> `8083`
- Notification Service -> `8084`
- Payment Service -> `8085`
- AI Symptom Service -> `8091`
- Next.js Frontend -> `3000`

## API Endpoints

### Auth Service
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /health`

### Patient Service
- `POST /api/patients/internal/create` (internal)
- `GET /api/patients/internal/:authUserId` (internal)
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

### Payment Service
- `POST /payments` (Create payment)
- `GET /payments/:transactionId` (Get payment by transaction ID)
- `GET /patients/:patientId/payments` (Get all patient payments)
- `DELETE /payments/:transactionId` (Cancel payment)
- `POST /webhook` (Payment provider webhook)
- `GET /health` (Health check)

### AI Symptom Service
- `POST /symptoms/chat` (AI triage conversation)
- `GET /health` (Health check)

### Frontend Symptom Routes
- `GET /symptoms` (chat-first symptom assessment)
- `GET /symptoms/voice` (voice assistant mode)
- `POST /api/symptoms/chat` (Next.js backend proxy to AI symptom service)

## Environment Variables

Use your current `.env` for local runtime and `.env.example` as template.

Required:

- Shared:
	- `DATABASE_URL` (Go services compatibility)
	- `NOTIFICATION_SERVICE_URL`
	- `INTERNAL_SERVICE_KEY`
- Auth service:
	- `AUTH_MONGO_URI`
	- `PATIENT_SERVICE_URL`
- Patient service:
	- `PATIENT_MONGO_URI`
- Firebase (recommended file-based credentials):
	- `FIREBASE_SERVICE_ACCOUNT_PATH`
	- Optional fallback: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Frontend URLs:
	- `NEXT_PUBLIC_AUTH_SERVICE_URL`
	- `NEXT_PUBLIC_PATIENT_SERVICE_URL`
	- `NEXT_PUBLIC_DOCTOR_SERVICE_URL`
	- `NEXT_PUBLIC_APPOINTMENT_SERVICE_URL`
	- `NEXT_PUBLIC_PAYMENT_SERVICE_URL`
	- `NEXT_PUBLIC_SYMPTOM_SERVICE_URL`
- AI symptom service:
	- `OPENAI_API_KEY` (required)
	- `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)
	- `SYMPTOM_SERVICE_URL` (for Next.js server-side proxy, default: `http://localhost:8091`)

Node service runtime mapping in Docker/K8s:
- Auth service uses `MONGO_URI`, `PATIENT_SERVICE_URL`, `INTERNAL_SERVICE_KEY`, Firebase vars
- Patient service uses `MONGO_URI`, `INTERNAL_SERVICE_KEY`, Firebase vars

## Local Run (Docker Compose) - macOS / Linux (zsh/bash)

Run from the `deployments/` directory:

1. Start all services (with API Gateway):
	 - `cd deployments`
	 - `docker compose up --build`
2. **All services accessible via API Gateway:**
	 - Gateway: `http://localhost`
	 - Auth Service: `http://localhost/api/auth`
	 - Patient Service: `http://localhost/api/patients`
	 - Doctor Service: `http://localhost/doctors`
	 - Appointment Service: `http://localhost/appointments`
	 - Payment Service: `http://localhost/payments`
	 - AI Symptom Service (direct): `http://localhost:8091`
	 - Notifications: `http://localhost/send-email`, `/send-sms`
	 - Frontend: `http://localhost:3000`
	 - Frontend symptom proxy: `http://localhost:3000/api/symptoms/chat`
	 - Swagger Docs: `http://localhost/api-docs`
3. Stop services:
	 - `Ctrl + C`
	 - `docker compose down`

## Local Run (Docker Compose) - Windows (PowerShell)

Run from the `deployments` folder:

1. Start all services (with API Gateway):
	 - `Set-Location .\deployments`
	 - `docker compose up --build`
2. **All services accessible via API Gateway:**
	 - Gateway: `http://localhost`
	 - Auth Service: `http://localhost/api/auth`
	 - Patient Service: `http://localhost/api/patients`
	 - Doctor Service: `http://localhost/doctors`
	 - Appointment Service: `http://localhost/appointments`
	 - Payment Service: `http://localhost/payments`
	 - AI Symptom Service (direct): `http://localhost:8091`
	 - Notifications: `http://localhost/send-email`, `/send-sms`
	 - Frontend: `http://localhost:3000`
	 - Frontend symptom proxy: `http://localhost:3000/api/symptoms/chat`
	 - Swagger Docs: `http://localhost/api-docs`
3. Stop services:
	 - `Ctrl + C`
	 - `docker compose down`

## Health Check (All Platforms)

After startup, verify (via API Gateway):

- `http://localhost/health` (Gateway)
- `http://localhost/api/auth/health` (Auth Service via gateway)
- `http://localhost/api/patients/health` (Patient Service via gateway)
- `http://localhost/doctors` (Doctor Service via gateway)
- `http://localhost/appointments` (Appointment Service via gateway)

Or direct service checks:

- `http://localhost:5001/health`
- `http://localhost:5002/health`
- `http://localhost:8082/health`
- `http://localhost:8083/health`
- `http://localhost:8084/health`
- `http://localhost:8085/health`
- `http://localhost:8091/health`

## API Smoke Test (Sample Data)

Register user (via gateway):

- Endpoint: `POST http://localhost/api/auth/register`
- Sample payload:
	- `{"fullName":"Alex","email":"alex@example.com","password":"Pass12345!","role":"PATIENT"}`

Get current user (requires Firebase ID token):

- Endpoint: `GET http://localhost/api/auth/me`
- Header: `Authorization: Bearer <firebase_id_token>`

Create appointment (via gateway):

- Endpoint: `POST http://localhost/appointments`
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
	- Re-check `AUTH_MONGO_URI` / `PATIENT_MONGO_URI` (or fallback `DATABASE_URL`) in root `.env`.
- Firebase credential errors at startup:
	- Ensure `FIREBASE_SERVICE_ACCOUNT_PATH` points to mounted file and file exists.
- AI symptom service exits with code 1:
	- Ensure `OPENAI_API_KEY` is present in root `.env`.
	- Ensure `OPENAI_MODEL` is valid (or omit to use default `gpt-4o-mini`).
- Symptom replies not reaching frontend:
	- Verify `SYMPTOM_SERVICE_URL` (server-side) or `NEXT_PUBLIC_SYMPTOM_SERVICE_URL` points to `http://localhost:8091`.
- Stale containers/images:
	- Run `docker compose down` then `docker compose up --build`.

## Project Notes

- Backend stack is split: Auth + Patient are Node/Express services, while Doctor + Appointment + Notification are Go/Gin services.
- Authentication is Firebase-auth-only:
	- Auth Service creates Firebase users + role claims.
	- Auth/Patient verify Firebase ID tokens with Firebase Admin SDK.
- Appointment service triggers notification service after booking creation.
- Symptom flow supports chat + voice modes; frontend uses `/api/symptoms/chat` as backend proxy.
- MongoDB Atlas is configured via `DATABASE_URL`.
- Services are independently deployable and communicate via REST APIs.

## Backend Integration Testing

Use the manual/Postman checklist in:

- `docs/backend-integration-testing-checklist.md`

It covers:
- PATIENT registration + profile bootstrap
- Firebase token verification in Auth/Patient services
- `/api/patients/me` profile/report/prescription/history flows
- happy path + failure case scenarios

## Kubernetes Starter Manifests

Minimal manifests are under `deployments/kubernetes/`:

**API Gateway (recommended entry point):**
- `api-gateway-deployment.yaml`
- `api-gateway-service.yaml`

**Service Manifests:**
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
- `payment-deployment.yaml`
- `mongodb-payment-statefulset.yaml`

Apply with your cluster context:

1. `kubectl apply -f deployments/kubernetes/api-gateway-deployment.yaml`
2. `kubectl apply -f deployments/kubernetes/api-gateway-service.yaml`
3. `kubectl apply -f deployments/kubernetes/configmap.yaml`
4. `kubectl apply -f deployments/kubernetes/secret.yaml`
5. `kubectl apply -f deployments/kubernetes/auth-deployment.yaml`
6. `kubectl apply -f deployments/kubernetes/doctor-deployment.yaml`
7. `kubectl apply -f deployments/kubernetes/appointment-deployment.yaml`
8. `kubectl apply -f deployments/kubernetes/notification-deployment.yaml`
9. `kubectl apply -f deployments/kubernetes/mongodb-payment-statefulset.yaml`
10. `kubectl apply -f deployments/kubernetes/payment-deployment.yaml`

All services are automatically accessible through the API Gateway LoadBalancer service.

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
- To run Notification: use port `8084`.
- To run Payment service: `cd services/payment-service && set -o allexport; source ../../.env; set +o allexport && PORT=8085 DATABASE_URL=mongodb://admin:admin@localhost:27017/payment-db?authSource=admin go run main.go`.
- To run AI Symptom service:
	- `cd services/AI-symptom-service`
	- `set -o allexport; source ../../.env; set +o allexport`
	- `export PORT=8091`
	- `go run main.go`

Run Auth Service (Node/Express, Firebase-auth-only):

```bash
cd services/auth-service-node
npm install
npm start
```

Run Patient Service (Node/Express):

```bash
cd services/patient-service-node
npm install
npm start
```

Auth and Patient services read from the root `.env` file.

Working endpoints per service (use the service's host/port when running a single service):

- Auth Service (http://localhost:5001)
	- POST /api/auth/register
	- GET /api/auth/me
	- POST /api/auth/logout
	- GET /health

- Patient Service (http://localhost:5002)
	- POST /api/patients/internal/create (internal)
	- GET /api/patients/internal/:authUserId (internal)
	- GET /api/patients/me
	- PUT /api/patients/me
	- POST /api/patients/me/reports
	- GET /api/patients/me/reports
	- DELETE /api/patients/me/reports/:reportId
	- GET /api/patients/me/prescriptions
	- GET /api/patients/me/history
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

- Payment Service (http://localhost:8085)
	- POST /payments
	- GET /payments/:transactionId
	- GET /patients/:patientId/payments
	- DELETE /payments/:transactionId
	- POST /webhook
	- GET /health

- AI Symptom Service (http://localhost:8091)
	- POST /symptoms/chat
	- GET /health

## Team workflow suggestion (5 members)

This repo maps naturally to a 5-person team — assign one service to each member for fast parallel development:

- Member A: `auth-service-node` — auth endpoints, token middleware, user lifecycle
- Member B: `patient-service-node` — patient profile, records, reports, history
- Member C: `doctor-service` — doctor CRUD and search
- Member D: `appointment-service` — booking flow and appointment lifecycle
- Member E: `notification-service` + `payment-service` — messaging and payment lifecycle integrations

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
- extracts shared secret env keys from your local `.env` into a temporary file (not committed)
- creates/updates Firebase service account Kubernetes secret if local file exists
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
- A pre-commit secret scan hook is included at `.githooks/pre-commit`.
- Enable it once per clone by setting Git hooks path to `.githooks`.
- Emergency bypass (use sparingly): set `SKIP_SECRET_SCAN=1` for a single commit.

