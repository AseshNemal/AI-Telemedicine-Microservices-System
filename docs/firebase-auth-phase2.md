# Firebase Auth Refactor - Phase 2 (Auth Service)

## FA3 - Role storage strategy

### Recommended option
- Use both Firebase custom claims and a lightweight Auth DB mirror.

### Why this is best for this project
- Firebase custom claims provide fast, stateless RBAC checks in all services after token verification.
- A small MongoDB mirror in Auth Service gives operational flexibility for admin views, audits, and fallback reads.
- Keeps architecture practical for a university microservices project while still demonstrating production-style RBAC patterns.

### Middleware role resolution order
1. Read role from verified Firebase token claim (`decoded.role`).
2. If missing, resolve role from Auth Service mirror by `firebaseUid`.
3. Deny with `403` if role still unavailable or not allowed.

## FA4 - Register endpoint refactor (implemented)

### Updated flow
1. Validate `fullName, email, password, phone, role`.
2. Create Firebase Auth user.
3. Set Firebase custom claim `role` (`PATIENT|DOCTOR|ADMIN`).
4. Upsert lightweight app-user mirror in Auth DB.
5. If role is `PATIENT`, call Patient Service internal bootstrap with Firebase UID.

### Files
- `services/auth-service-node/src/controllers/authController.js`
- `services/auth-service-node/src/services/firebaseAuthService.js`
- `services/auth-service-node/src/services/authService.js`

## FA5 - Firebase token verification middleware (implemented)

### File
- `services/auth-service-node/src/middleware/authMiddleware.js`

### Behavior
- Reads `Authorization: Bearer <idToken>`
- Verifies token with Firebase Admin SDK
- Attaches decoded identity to `req.user`
- Returns `401` for missing/invalid token

### `req.user` shape
- `uid`
- `sub` (same as UID for compatibility)
- `email`
- `role` (custom claim if present)
- `claims` (full decoded token)

### Example usage
- `router.get('/me', authenticateJWT, authController.me)`

## FA6 - RBAC middleware refactor (implemented)

### File
- `services/auth-service-node/src/middleware/roleMiddleware.js`

### Middleware factory
- `authorizeRoles(...roles)`

### Role source
- Primary: `req.user.role` / Firebase custom claim
- Fallback: Mongo mirror lookup by `req.user.uid`
- Forbidden: returns `403`

### Example usage
```js
router.get('/admin-only', authenticateJWT, authorizeRoles('ADMIN'), handler);
```

## FA7 - `/me` endpoint refactor (implemented)

### File
- `services/auth-service-node/src/controllers/authController.js`

### Response fields
- `uid`
- `email`
- `fullName`
- `role`
- `emailVerified`
- optional `appUser` (safe mirror data)

### Sample response
```json
{
  "success": true,
  "data": {
    "uid": "firebase-uid-123",
    "email": "user@example.com",
    "fullName": "Jane Doe",
    "role": "PATIENT",
    "emailVerified": false,
    "appUser": {
      "id": "firebase-uid-123",
      "uid": "firebase-uid-123",
      "fullName": "Jane Doe",
      "email": "user@example.com",
      "phone": "+94771234567",
      "role": "PATIENT",
      "isActive": true,
      "isVerified": false
    }
  }
}
```

## FA8 - Logout behavior for Firebase-only auth (implemented)

### Recommended design
- Backend logout is an acknowledgement endpoint only.
- No local refresh-token revocation since local refresh system is removed.
- Frontend responsibility:
  - clear stored access/session state
  - call Firebase client `signOut()`

### Endpoint
- `POST /api/auth/logout` returns `200` with guidance message.

## FA9 - Obsolete local auth cleanup

### Removed now
- `services/auth-service-node/src/models/RefreshToken.js`
- `services/auth-service-node/src/utils/jwt.js`
- `services/auth-service-node/src/utils/tokenUtils.js`
- Local `/login` and `/refresh` routes
- `bcryptjs` and `jsonwebtoken` deps from Auth Service package

### Kept during migration
- `services/auth-service-node/src/models/User.js` as lightweight mirror
- `services/auth-service-node/src/utils/patientServiceClient.js` internal bootstrap client

### Final recommended Auth Service folder shape
- `config/firebaseAdmin.js`
- `controllers/authController.js`
- `middleware/authMiddleware.js`
- `middleware/roleMiddleware.js`
- `models/User.js`
- `routes/authRoutes.js`
- `services/firebaseAuthService.js`
- `services/authService.js` (mirror + response composition)
- `utils/patientServiceClient.js`

## FA10 - Patient bootstrap with Firebase UID (implemented)

### Updated register behavior
- For `PATIENT`, send internal payload:
  - `authUserId = firebase uid`
  - `fullName`
  - `email`
  - `phone`

### Helper and env usage
- Helper: `services/auth-service-node/src/utils/patientServiceClient.js`
- Env vars:
  - `PATIENT_SERVICE_URL`
  - `INTERNAL_SERVICE_KEY`

### Failure handling choice
- Chosen approach: soft-fail profile sync.
- Registration remains successful even if Patient Service bootstrap fails.
- Response includes `profileSync: pending-retry` to support manual/admin retry flows.
- Rationale: practical resilience for distributed student-project deployments.
