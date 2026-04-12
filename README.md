# AI Telemedicine Microservices System

Cloud-native distributed microservices starter for telemedicine use cases (patient, doctor, admin) using a hybrid backend stack:
- Node.js + Express + MongoDB (MERN-style services): `auth-service-node`, `patient-service-node`
- Go + Gin services: `doctor-service`, `appointment-service`, `notification-service`, `payment-service`, `AI-symptom-service`

Also includes Docker, Kubernetes manifests, and a Next.js frontend.

## Prerequisites

Install the following before running:

- Docker Desktop (with Kubernetes enabled)
- Git
- Node.js 22+ (only needed if running frontend without Docker)
- Go 1.25+ (only needed if running services without Docker)

## Quick Setup

1. Ensure `.env` exists at project root (same level as `README.md`).
2. Configure MongoDB + Firebase env values using `.env.example` or `deployments/kubernetes/secret.example.yaml` as templates.
3. Do NOT commit real credentials into the repository. Keep secret files locally and under `.gitignore`.
4. Place Firebase service account JSON and any other provider private files in a local `secrets/` folder that is gitignored (see `.gitignore`).
5. (Optional) Use `.env.example` as a reference template.

## 🚀 One-Command Run (Kubernetes)

From the project root, run:

```bash
chmod +x k8s-up.sh
./k8s-up.sh --port-forward --port 8080
```

What this single command does:

- Builds Docker images
- Applies Kubernetes manifests and secrets setup flow
- Waits for rollouts and runs health checks
- Starts port-forwarding for gateway + web-app + core services

Open after it starts:

- Frontend: `http://localhost:3000`
- API Gateway: `http://localhost:8080`
- Gateway health: `http://localhost:8080/health`

Fast rerun (skip image build):

```bash
./k8s-up.sh --skip-build --port-forward --port 8080
```

OS notes (same workflow, different shell launcher):

- macOS / Linux (zsh/bash):

```bash
chmod +x k8s-up.sh
./k8s-up.sh --port-forward --port 8080
```

- Windows (Git Bash or WSL):

```bash
chmod +x k8s-up.sh
./k8s-up.sh --port-forward --port 8080
```

- Windows (PowerShell):

```powershell
bash ./k8s-up.sh --port-forward --port 8080
```

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

## Secrets & secure storage

- This repository no longer contains real secret material. A template is provided at `deployments/kubernetes/secret.example.yaml`.
- Do NOT add files with real credentials to the repo. Add them to `.gitignore` (this project already ignores `deployments/kubernetes/secret.yaml`).

Recommended workflows:

- Create Kubernetes secrets from a local file (keeps values out of git):

```bash
# from project root (example: create secret from a local env file)
kubectl create secret generic telemedicine-secrets --from-env-file=./deployments/kubernetes/secret.example.env

# or create from a local YAML file (keep it outside the repo if it contains real values)
kubectl create secret generic telemedicine-secrets --from-file=secret.yaml=./path/to/local/secret.yaml
```

- If you accidentally committed secrets, rotate them immediately (API keys, private keys, tokens). To remove files from git history, use `git-filter-repo` or the BFG Repo-Cleaner and then force-push. Example (run locally and back up first):

```bash
# backup mirror
git clone --mirror git@github.com:YOUR/REPO.git repo-backup.git

# remove path from history (requires git-filter-repo)
git filter-repo --path deployments/kubernetes/secret.yaml --invert-paths

# force push cleaned history (coordinate with collaborators)
git push --force --all
git push --force --tags
```

- Use a secret manager for production (Vault, AWS/Google/Azure secret stores) or sealed-secrets for Kubernetes.

If you'd like, I can prepare a small helper script that creates the Kubernetes secret from a local env file without adding secrets to the repo.

## Primary Run Method: Kubernetes (recommended)

This project is intended to run primarily on Kubernetes.

### 1) Preflight

```bash
# verify cluster access
kubectl config current-context
kubectl get nodes
```

### 2) Build images (local cluster workflow)

Build all required images from the repo root (or run your existing build helper scripts):

```bash
docker build -t auth-service:latest -f services/auth-service-node/Dockerfile services/auth-service-node
docker build -t patient-service:latest -f services/patient-service-node/Dockerfile services/patient-service-node
docker build -t doctor-service:latest -f services/doctor-service/Dockerfile services/doctor-service
docker build -t appointment-service:latest -f services/appointment-service/Dockerfile services/appointment-service
docker build -t notification-service:latest -f services/notification-service/Dockerfile services/notification-service
docker build -t payment-service:latest -f services/payment-service/Dockerfile services/payment-service
docker build -t symptom-service:latest -f services/AI-symptom-service/Dockerfile services/AI-symptom-service
docker build -t telemedicine-service:latest -f services/telemedicine-service/Dockerfile services/telemedicine-service
docker build -t web-app:latest -f web-app/Dockerfile web-app
docker build -t api-gateway-nginx:latest -f api-gateway-nginx/Dockerfile api-gateway-nginx
```

> If your cluster cannot access local images, push to a registry and update image names in manifests.

### 3) Create/update secrets (do not commit real values)

Use your local secret source and create the Kubernetes secret in `default` namespace:

```bash
# option A: from local env file
kubectl create secret generic telemedicine-secrets \
  --from-env-file=./deployments/kubernetes/secret.example.env \
  -n default \
  --dry-run=client -o yaml | kubectl apply -f -

# option B: from local YAML file outside git
# kubectl create secret generic telemedicine-secrets \
#   --from-file=secret.yaml=./path/to/local/secret.yaml \
#   -n default \
#   --dry-run=client -o yaml | kubectl apply -f -
```

### 4) Apply Kubernetes manifests

```bash
kubectl apply -f deployments/kubernetes/configmap.yaml
kubectl apply -f deployments/kubernetes/auth-deployment.yaml
kubectl apply -f deployments/kubernetes/patient-deployment.yaml
kubectl apply -f deployments/kubernetes/doctor-deployment.yaml
kubectl apply -f deployments/kubernetes/appointment-deployment.yaml
kubectl apply -f deployments/kubernetes/notification-deployment.yaml
kubectl apply -f deployments/kubernetes/mongodb-payment-statefulset.yaml
kubectl apply -f deployments/kubernetes/payment-deployment.yaml
kubectl apply -f deployments/kubernetes/symptom-deployment.yaml
kubectl apply -f deployments/kubernetes/telemedicine-deployment.yaml
kubectl apply -f deployments/kubernetes/web-app-deployment.yaml
kubectl apply -f deployments/kubernetes/api-gateway-deployment.yaml
kubectl apply -f deployments/kubernetes/api-gateway-service.yaml
```

### 5) Wait for rollouts and check status

```bash
kubectl get deployments
kubectl get statefulsets
kubectl get pods -o wide
kubectl get svc

kubectl rollout status deployment/auth-service
kubectl rollout status deployment/patient-service
kubectl rollout status deployment/doctor-service
kubectl rollout status deployment/appointment-service
kubectl rollout status deployment/notification-service
kubectl rollout status deployment/payment-service
kubectl rollout status deployment/symptom-service
kubectl rollout status deployment/telemedicine-service
kubectl rollout status deployment/web-app
kubectl rollout status deployment/api-gateway
kubectl rollout status statefulset/mongodb-payment
```

### 6) Access endpoints

If your `LoadBalancer` services are not exposed by your local cluster, use port-forward:

```bash
kubectl port-forward svc/api-gateway-nginx 8080:80
kubectl port-forward svc/web-app 3000:3000
```

Then use:

- Gateway health: `http://localhost:8080/health`
- Auth (via gateway): `http://localhost:8080/api/auth/health`
- Patient (via gateway): `http://localhost:8080/api/patients/health`
- Doctor (via gateway): `http://localhost:8080/doctors`
- Frontend: `http://localhost:3000`

### 7) Logs and troubleshooting

```bash
kubectl logs deployment/api-gateway --tail=200
kubectl logs deployment/web-app --tail=200
kubectl logs deployment/doctor-service --tail=200
kubectl describe pod <pod-name>
kubectl get events --sort-by=.metadata.creationTimestamp
```

### 8) Teardown

```bash
kubectl delete -f deployments/kubernetes/
```

## Health Check (Kubernetes)

After startup, verify (via API Gateway):

- `http://localhost/health` (Gateway)
- `http://localhost/api/auth/health` (Auth Service via gateway)
- `http://localhost/api/patients/health` (Patient Service via gateway)
- `http://localhost/doctors` (Doctor Service via gateway)
- `http://localhost/appointments` (Appointment Service via gateway)

Direct service checks (cluster-local / forwarded):

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

- Kubernetes context mismatch:
	- Verify with `kubectl config current-context` and `kubectl get nodes`.
- Port already in use:
	- Stop conflicting local process or change `kubectl port-forward` local port.
- MongoDB connection errors:
	- Re-check `AUTH_MONGO_URI` / `PATIENT_MONGO_URI` (or fallback `DATABASE_URL`) in root `.env`.
- Firebase credential errors at startup:
	- Ensure the Kubernetes secret exists and pods reference correct keys.
- AI symptom service exits with code 1:
	- Ensure `OPENAI_API_KEY` exists in `telemedicine-secrets`.
	- Ensure `OPENAI_MODEL` is valid (or omit to use default `gpt-4o-mini`).
- Symptom replies not reaching frontend:
	- Verify `SYMPTOM_SERVICE_URL` points to service DNS in cluster (for example `http://symptom-service:8091`).
- Stale pods after config changes:
	- Restart deployments: `kubectl rollout restart deployment/<name>`.

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

## Kubernetes Manifest Inventory

Current manifests under `deployments/kubernetes/` include:

- `configmap.yaml`
- `auth-deployment.yaml`
- `patient-deployment.yaml`
- `doctor-deployment.yaml`
- `appointment-deployment.yaml`
- `notification-deployment.yaml`
- `payment-deployment.yaml`
- `mongodb-payment-statefulset.yaml`
- `symptom-deployment.yaml`
- `telemedicine-deployment.yaml`
- `web-app-deployment.yaml`
- `api-gateway-deployment.yaml`
- `api-gateway-service.yaml`
- `secret.example.yaml` (template only; do not apply as real secret)

> Real secrets should be created using `kubectl create secret ...` from local files or env values.

## Kubernetes Quick Run (Recommended)

Use the helper script from repo root to build images, deploy manifests, wait for rollout, and run a gateway health check.

1. Enable Kubernetes in Docker Desktop.
2. Run from repo root:

```bash
chmod +x k8s-up.sh
./k8s-up.sh
```

3. Expose services to your local machine (Nginx Gateway + All backend services individually):

```bash
./k8s-up.sh --port-forward
# OR you can run it standalone anytime via:
# ./start-port-forwarding.sh
```

4. Verify it works in your browser:

- Web Frontend: `http://localhost:3000`
- API Gateway (Handles all routing!): `http://localhost:8080/health`
- Individual Doctor Service (Bypassing Gateway): `http://localhost:8082/doctors`

Useful script flags:

```bash
./k8s-up.sh --skip-build
./k8s-up.sh --port-forward --port 8080
./k8s-up.sh --help
```

Teardown:

```bash
kubectl delete -f deployments/kubernetes/
```

Troubleshooting:

- If `./k8s-up.sh` says `Cannot connect to Kubernetes API server`, enable Kubernetes in Docker Desktop and retry.
- If a service image fails to build, rebuild that image locally first, then rerun `./k8s-up.sh --skip-build`.
- **Apple Silicon (M1/M2/M3) Issue:** If standard public images like nginx or mongodb fail to pull in a local Linux cluster (e.g. `kind` running on AMD64) with `unexpected EOF`, you must explicitly pull the linux/amd64 versions and load them manually. Example: `docker pull --platform linux/amd64 nginx:1.27-alpine`, then load them `kind load docker-image nginx:1.27-alpine --name <cluster-name>`.
- **Missing Secrets:** Make sure to create all necessary required secrets before starting apps. Example for Mongo payment credential generation: `kubectl create secret generic mongodb-payment-credentials --from-literal=username=<username> --from-literal=password=<password> -n default`

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
- For cross-service integration tests, developers can run dependent services locally or use the Kubernetes namespace deployment.
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

