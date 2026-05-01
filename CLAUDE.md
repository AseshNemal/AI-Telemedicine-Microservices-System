# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the System

### Kubernetes (recommended — full stack)
```bash
./k8s-up.sh --port-forward --port 8080   # build images, apply manifests, port-forward
./k8s-up.sh --skip-build --port-forward  # skip image rebuild on subsequent runs
```
After startup: frontend at `http://localhost:3000`, gateway at `http://localhost:8080`.

### Local development (without Docker)
Every backend terminal must load the root `.env` first:
```bash
set -a; source ./.env; set +a
```

Then start services in separate terminals:
```bash
# Node services
cd services/auth-service-node && npm start
cd services/patient-service-node && npm start

# Go services (each in its own terminal, from service directory)
cd services/doctor-service && go run .
cd services/appointment-service && go run .
cd services/notification-service && go run .
cd services/payment-service && go run .
cd services/AI-symptom-service && go run main.go
cd services/telemedicine-service && go run main.go

# Frontend
cd web-app && npm run dev
```

### Frontend commands
```bash
cd web-app
npm run dev    # development server (uses webpack)
npm run build  # production build
npm run lint   # ESLint
```

### Node service dev mode
```bash
cd services/auth-service-node && npm run dev   # nodemon hot-reload
```

### Rebuilding a single Docker image
```bash
docker build -t <service-name>:latest -f services/<service-dir>/Dockerfile services/<service-dir>
# e.g.
docker build -t doctor-service:latest -f services/doctor-service/Dockerfile services/doctor-service
```

**web-app lockfile note**: The web-app Docker build uses `node:22-alpine`. If your local npm is v11+, regenerate the lockfile before building to avoid `npm ci` sync errors:
```bash
cd web-app && rm -rf node_modules package-lock.json
docker run --rm -u "$(id -u):$(id -g)" -e npm_config_cache=/tmp/.npm -v "$PWD:/app" -w /app node:22-alpine sh -lc 'npm install --no-audit --no-fund'
```

## Architecture

### Service map

| Service | Language | Port | Purpose |
|---|---|---|---|
| auth-service-node | Node/Express | 8081 | Firebase user registration, role claims, `/api/auth/me` identity endpoint |
| patient-service-node | Node/Express | 5002 | Patient profiles, medical reports, prescriptions, history in MongoDB |
| doctor-service | Go/Gin | 8082 | Doctor directory and profile management |
| appointment-service | Go/Gin | 8083 | Appointment booking lifecycle; calls notification, payment, telemedicine services |
| notification-service | Go/Gin | 8084 | Email/SMS dispatch (Twilio + SendGrid) |
| payment-service | Go/Gin | 8085 | Stripe payment sessions; owns its own MongoDB StatefulSet in K8s |
| AI-symptom-service | Go/Gin | 8091 | OpenAI-backed chat triage (`gpt-4o-mini` default) |
| telemedicine-service | Go/Gin | 8086 | LiveKit room and token generation for video consultations |
| api-gateway-nginx | NGINX | 80/8080 | Single entry point; routes `/api/{service}/` to each upstream |
| web-app | Next.js 16 | 3000 | App Router frontend with Tailwind CSS v4 |

### Authentication architecture
Firebase is used **only for authentication** — domain data lives in MongoDB.

- **Node services** (auth, patient) verify Firebase ID tokens directly via Firebase Admin SDK.
- **Go services** delegate token verification to `auth-service-node`'s `GET /api/auth/me` endpoint, forwarding the `Authorization: Bearer <token>` header. Results are cached for 60 seconds. The auth-service URL is configured via `AUTH_SERVICE_URL` env var; if not set, the Go middleware tries a list of localhost and container-network fallbacks.
- The frontend obtains a Firebase ID token on login and attaches it as `Authorization: Bearer <token>` to all API calls.
- Roles (`PATIENT`, `DOCTOR`, `ADMIN`) are stored as Firebase custom claims and surfaced through the `/api/auth/me` response.

### Request routing through the gateway
NGINX routes `/api/{service-prefix}/` to the corresponding upstream (stripping the prefix):
- `/api/auth/` → auth-service
- `/api/patients/` → patient-service
- `/api/doctors/` → doctor-service
- `/api/appointments/` → appointment-service
- `/api/payments/` → payment-service
- `/api/symptoms/` → AI-symptom-service
- `/api/telemedicine/` → telemedicine-service

The frontend resolves all service base URLs via `web-app/lib/api/baseUrls.ts`. If individual `NEXT_PUBLIC_*_SERVICE_URL` vars are not set, they all fall back to `NEXT_PUBLIC_API_URL` (defaulting to `http://localhost:8080`).

### Service-to-service communication
- Appointment service calls notification, payment, telemedicine, and doctor services on booking creation, using `*_SERVICE_URL` env vars (service DNS names in K8s, localhost URLs locally).
- Auth service calls patient service's internal endpoint (`/api/patients/internal/create`) on PATIENT registration to bootstrap the patient profile.
- Internal calls are authenticated via the `INTERNAL_SERVICE_KEY` header.

### Go service internal structure
Each Go service follows the same pattern: `main.go` → `routes/` → `handlers/` → `models/` + `database/`. Services that require auth include a `middleware/auth.go` with `VerifyToken()` and `RequireRole()` Gin middleware.

### Frontend structure
The `web-app/` uses the Next.js App Router (`app/` directory). Pages are thin route containers; heavy UI logic lives in `app/components/`. API calls go through `app/lib/api.ts` (typed client functions) and `web-app/lib/api/baseUrls.ts` (URL resolution). The symptom chat is proxied through a Next.js API route to avoid CORS issues.

## Secrets and environment

All services load configuration from the repo-root `.env`. Go services call `godotenv.Load("../../.env")` relative to their service directory. Node services use `dotenv.config({ path: path.resolve(__dirname, '../../../.env') })`.

Required env vars and their purpose are documented in `.env.example`. Key points:
- Firebase credentials: use `FIREBASE_SERVICE_ACCOUNT_PATH` (file path) preferred over individual env fields.
- `INTERNAL_SERVICE_KEY`: required; Go services fail fast at startup if missing.
- `STRIPE_SECRET_KEY`: must not have wrapping quotes in K8s secrets.
- `OPENAI_API_KEY`: required for AI-symptom-service; service exits if absent.
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`: required for telemedicine-service.
- MongoDB: `AUTH_MONGO_URI` and `PATIENT_MONGO_URI` for Node services; `DATABASE_URL` for Go services.

Create Kubernetes secrets from local env without committing values:
```bash
kubectl create secret generic telemedicine-secrets --from-env-file=./.env -n default --dry-run=client -o yaml | kubectl apply -f -
```

## Testing

There is no automated test suite. Integration testing uses the manual/Postman checklist at `docs/backend-integration-testing-checklist.md`. Health check all services via the gateway after startup:
```bash
curl http://localhost:8080/health          # gateway
curl http://localhost:8080/api/auth/health
curl http://localhost:8080/api/patients/health
curl http://localhost:8080/doctors
```
