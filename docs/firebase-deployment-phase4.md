# Firebase Auth Refactor - Phase 4 (Deployment)

## FA11 - Auth Service env variables

### Updated env variable list
- Required runtime:
  - `PORT`
  - `MONGO_URI`
  - `PATIENT_SERVICE_URL`
  - `INTERNAL_SERVICE_KEY`
- Firebase auth-only:
  - `FIREBASE_SERVICE_ACCOUNT_PATH` (recommended)
  - optional fallback: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

### Removed from Auth design
- `JWT_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `REFRESH_TOKEN_EXPIRES_DAYS`

### Sample `.env` entries
```env
AUTH_PORT=5001
AUTH_MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/auth-db?retryWrites=true&w=majority
PATIENT_SERVICE_URL=http://patient-service:5002
INTERNAL_SERVICE_KEY=replace-with-long-random-string
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
```

### Secret vs Config (Auth)
- Secret:
  - `MONGO_URI`
  - `INTERNAL_SERVICE_KEY`
  - Firebase service account JSON content
- ConfigMap:
  - `PORT`
  - `PATIENT_SERVICE_URL`
  - `FIREBASE_SERVICE_ACCOUNT_PATH`

## FP14 - Patient Service env variables

### Updated env variable list
- Required runtime:
  - `PORT`
  - `MONGO_URI`
  - `INTERNAL_SERVICE_KEY` (for internal routes)
- Firebase token verification:
  - `FIREBASE_SERVICE_ACCOUNT_PATH` (recommended)
  - optional fallback: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

### Sample `.env` entries
```env
PATIENT_PORT=5002
PATIENT_MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/patient-db?retryWrites=true&w=majority
INTERNAL_SERVICE_KEY=replace-with-long-random-string
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
```

### Secret vs Config (Patient)
- Secret:
  - `MONGO_URI`
  - `INTERNAL_SERVICE_KEY`
  - Firebase service account JSON content
- ConfigMap:
  - `PORT`
  - `FIREBASE_SERVICE_ACCOUNT_PATH`

## FA12 - Auth Docker setup

### Updated files
- `services/auth-service-node/Dockerfile`
- `deployments/docker-compose.yml`

### Changes
- Dockerfile sets default `FIREBASE_SERVICE_ACCOUNT_PATH=/var/secrets/firebase/service-account.json`.
- Docker Compose mounts Firebase JSON read-only:
  - `../secrets/firebase-service-account.json:/var/secrets/firebase/service-account.json:ro`
- Secrets are not baked into images.

### Best practices
- Keep service account file out of git (`secrets/` + `.gitignore`).
- Use read-only mounts for credentials.
- Use env vars to reference secret file paths, not secret values in Dockerfile.

## FP15 - Patient Docker setup

### Updated files
- `services/patient-service-node/Dockerfile`
- `deployments/docker-compose.yml`

### Changes
- Same secure Firebase mount pattern as Auth.
- Preserved Mongo integration via `MONGO_URI` env.
- Preserved local upload storage; compose mounts uploads folder for persistence:
  - `../services/patient-service-node/uploads:/app/uploads`

## FA13 - Auth Kubernetes manifests

### Updated file
- `deployments/kubernetes/auth-service-deployment.yaml`

### Manifest changes
- Added `auth-service-config` ConfigMap with:
  - `PORT`, `PATIENT_SERVICE_URL`, `FIREBASE_SERVICE_ACCOUNT_PATH`
- Added `auth-service-secret` with:
  - `MONGO_URI`, `INTERNAL_SERVICE_KEY`
- Added Firebase secret volume mount from shared secret:
  - `firebase-service-account` -> `/var/secrets/firebase/service-account.json`

## FP16 - Patient Kubernetes manifests

### Updated file
- `deployments/kubernetes/patient-service-deployment.yaml`

### Manifest changes
- Added `patient-service-config` ConfigMap with:
  - `PORT`, `FIREBASE_SERVICE_ACCOUNT_PATH`
- Added `patient-service-secret` with:
  - `MONGO_URI`, `INTERNAL_SERVICE_KEY`
- Added Firebase secret volume mount:
  - `firebase-service-account` -> `/var/secrets/firebase/service-account.json`
- Preserved patient-mongo deployment/service flow (`patient-mongo` remains intact).

### Firebase secret template
- New file: `deployments/kubernetes/firebase-service-account-secret.yaml`
- Contains placeholder only; replace at deploy time.

## FX3 - Docker Compose integration plan

### Updated file
- `deployments/docker-compose.yml`

### Integration recommendations applied
- Corrected service build paths:
  - `auth-service-node`
  - `patient-service-node`
- Added `patient-service` container to compose flow.
- Wired service-to-service URL:
  - Auth -> `http://patient-service:5002`
- Kept root `.env` usage with readable interpolation:
  - Auth: `MONGO_URI=${AUTH_MONGO_URI:-${DATABASE_URL}}`
  - Patient: `MONGO_URI=${PATIENT_MONGO_URI:-${DATABASE_URL}}`

### Common mistakes to avoid
- Hardcoding service-account JSON into Dockerfiles/images.
- Forgetting read-only mount (`:ro`) for credentials.
- Using host URL in inter-container calls (use service names).
- Missing `INTERNAL_SERVICE_KEY` parity between Auth and Patient.
- Not mounting uploads volume if you need report persistence in local Docker runs.
