# Firebase Auth Refactor - Phase 1

## FA1 - Auth Service review (what changes)

### Remove
- Local password hashing and verification in `services/auth-service-node/src/services/authService.js` (`bcryptjs`, `passwordHash`).
- Local login endpoint behavior in `services/auth-service-node/src/controllers/authController.js` (`/login` that checks password).
- Refresh token model and lifecycle:
  - `services/auth-service-node/src/models/RefreshToken.js`
  - `services/auth-service-node/src/utils/tokenUtils.js`
  - `services/auth-service-node/src/controllers/authController.js` (`refresh`, `logout` logic)
  - `services/auth-service-node/src/routes/authRoutes.js` (`/refresh`, `/logout`)
- Local JWT signing utility in `services/auth-service-node/src/utils/jwt.js`.

### Replace
- Token verification middleware with Firebase ID token verification:
  - `services/auth-service-node/src/middleware/authMiddleware.js` (implemented in Phase 1)
- Registration flow should create Firebase Auth user first, then optionally sync lightweight app metadata in Auth DB.

### Keep
- Role logic (`PATIENT|DOCTOR|ADMIN`) and role-based access checks.
- Patient bootstrap integration via `services/auth-service-node/src/utils/patientServiceClient.js`.
- Existing microservice API surface where practical (`/register`, `/me`) during transition.
- Docker/Kubernetes deployment structure.

### Final Auth Service responsibilities
- Create users in Firebase Auth.
- Optionally store app metadata (role, active flags, profile sync state).
- Verify Firebase ID tokens on protected routes.
- Return current authenticated user (`/me`).
- Trigger patient profile bootstrap for `PATIENT` via internal endpoint.

## FP1 - Patient Service review (auth dependency)

### Code paths needing refactor
- `services/patient-service-node/src/middleware/authMiddleware.js`
  - Replace `jsonwebtoken` verification with Firebase Admin token verification.
  - Keep role checks but source role from Firebase custom claims.
- `services/patient-service-node/src/controllers/patientController.js`
  - Already compatible after middleware migration because it reads `req.user.sub || req.user.id`.
  - With Firebase middleware, `sub` should map to `uid`.
- `services/patient-service-node/src/routes/patientRoutes.js`
  - Keep route structure.
  - Keep `x-internal-key` protection for internal bootstrap endpoint.

### Can stay unchanged
- MongoDB patient domain models (`Patient`, `MedicalReport`, `Prescription`, `MedicalHistory`).
- Patient self-service and domain APIs (`/me`, reports, prescriptions, history).
- Internal route protection with `x-internal-key`.

### Final Patient Service responsibilities
- Verify Firebase ID tokens for user identity.
- Read Firebase UID from `req.user.uid`/`req.user.sub`.
- Resolve patient profile by `authUserId = Firebase UID`.
- Keep all patient domain data in MongoDB.

## FA2 - Firebase Admin config in Auth Service (implemented)

### Added files
- `services/auth-service-node/src/config/firebaseAdmin.js`

### Integration points
- `services/auth-service-node/src/middleware/authMiddleware.js` now verifies Firebase ID tokens.
- `services/auth-service-node/src/server.js` initializes Firebase Admin at startup (fail-fast).
- `services/auth-service-node/package.json` includes `firebase-admin`.

### Safe initialization behavior
- Initializes only once (`admin.apps.length` guard).
- Supports two credential-loading modes:
  - `FIREBASE_SERVICE_ACCOUNT_PATH` (recommended)
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

## FP2 - Firebase Admin config in Patient Service (implemented)

### Added files
- `services/patient-service-node/src/config/firebaseAdmin.js`

### Integration points
- `services/patient-service-node/src/middleware/authMiddleware.js` now verifies Firebase ID tokens.
- `services/patient-service-node/src/server.js` initializes Firebase Admin at startup.
- `services/patient-service-node/package.json` includes `firebase-admin`.

### Token shape
- Middleware maps token info to:
  - `req.user.uid`
  - `req.user.sub` (same UID, backward-compatible)
  - `req.user.email`
  - `req.user.role` (from Firebase custom claims)

## FX1 - Root .env structure (implemented)

Updated: `AI-Telemedicine-Microservices-System/.env.example`

### Includes
- Firebase variables for both file-based and env-based credential loading.
- MongoDB URLs (`AUTH_DATABASE_URL`, `PATIENT_DATABASE_URL`, compatibility `DATABASE_URL`).
- Internal service call settings (`PATIENT_SERVICE_URL`, `INTERNAL_SERVICE_KEY`).
- Port and frontend URL configuration.

### Kubernetes placement
- Secret:
  - `FIREBASE_SERVICE_ACCOUNT_PATH` (path points to mounted secret file)
  - Firebase JSON content (stored as secret volume)
  - `FIREBASE_PRIVATE_KEY` (if env mode is used)
  - `AUTH_DATABASE_URL`, `PATIENT_DATABASE_URL`, `DATABASE_URL`
  - `INTERNAL_SERVICE_KEY`
- ConfigMap:
  - `NODE_ENV`
  - `AUTH_PORT`, `PATIENT_PORT`, `DOCTOR_PORT`, `APPOINTMENT_PORT`, `NOTIFICATION_PORT`
  - `PATIENT_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`
  - `NEXT_PUBLIC_AUTH_SERVICE_URL`, `NEXT_PUBLIC_DOCTOR_SERVICE_URL`, `NEXT_PUBLIC_APPOINTMENT_SERVICE_URL`

## FX2 - Firebase credential strategy

### Options compared
1. Full service account JSON mounted as file.
2. Service account fields passed as env vars.
3. Workload identity / cloud-native identity federation.

### Recommended option
- Option 1 for this project: mount full service account JSON as a file and set `FIREBASE_SERVICE_ACCOUNT_PATH`.

### Why
- Practical and easy to debug for student microservices.
- Avoids fragile private-key formatting issues in env vars.
- Works consistently for local development, Docker, and Kubernetes.

### Usage
- Local: keep JSON under a gitignored `secrets/` folder.
- Docker: mount JSON into container read-only and pass `FIREBASE_SERVICE_ACCOUNT_PATH`.
- Kubernetes: store JSON in a Secret, mount as volume, set `FIREBASE_SERVICE_ACCOUNT_PATH` in deployment env.

### When to use env vars
- Use Option 2 only if file-mount flow is not possible; ensure newline escaping (`\n`) for private key.

## Recommended transition plan

1. Keep Firebase token verification middleware active in both services (done).
2. Refactor Auth registration endpoint to call Firebase Admin `createUser` and set custom claims.
3. Stop issuing local JWTs; remove `/login`, `/refresh`, and local refresh-token store after frontend switches to Firebase client auth.
4. Remove `passwordHash` from Auth user model once no local password endpoints remain.
5. Update Swagger docs to remove local password/refresh token APIs and document Firebase Bearer token usage.
6. Add integration tests for:
   - Firebase token verification in both services
   - PATIENT registration bootstrap (`auth -> patient/internal/create`)
   - role claim enforcement on patient endpoints.
