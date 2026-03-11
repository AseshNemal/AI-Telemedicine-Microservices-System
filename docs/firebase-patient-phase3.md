# Firebase Auth Refactor - Phase 3 (Patient Service)

## FP3 - Firebase token verification middleware

### File
- `services/patient-service-node/src/middleware/authMiddleware.js`

### Behavior
- Reads `Authorization: Bearer <idToken>`.
- Verifies Firebase ID token via Firebase Admin SDK.
- Returns `401` for missing/invalid tokens.
- Attaches verified identity to `req.user`:
  - `uid`
  - `sub` (compatibility alias)
  - `email`
  - `role`
  - `claims`

### Route usage pattern
- `router.get('/me', authenticateFirebaseToken, requireRole(['PATIENT']), controller)`

## FP4 - Identity mapping to Firebase UID

### Model/controller adjustment
- `Patient.authUserId` continues as `String`, now explicitly documented as Firebase UID.
- All self-service lookups now resolve patient by `authUserId = req.user.uid`.

### Schema changes
- No schema field type change needed.
- Existing unique index on `authUserId` remains valid.

### Migration notes for legacy records
- If old records used local auth IDs, run a one-time mapping script to update:
  - old auth user id -> Firebase UID
- Keep a temporary mapping table/export during migration to avoid orphaned profiles.

## FP5 - GET `/api/patients/me`

### Updated controller behavior
- Resolve Firebase UID from verified token.
- Query `Patient.findOne({ authUserId: uid })`.
- Return profile data.
- Guarded by `requireRole(['PATIENT'])`.

### Sample response
```json
{
  "success": true,
  "data": {
    "authUserId": "firebase-uid-123",
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+94771234567"
  }
}
```

## FP6 - PUT `/api/patients/me`

### Updated controller behavior
- Uses `req.user.uid` for identity.
- Updates only safe fields:
  - `phone, address, dob, gender, bloodGroup, allergies, chronicConditions, emergencyContact`
- Ignores `authUserId`, `email`, and other immutable identity fields.
- Guarded by `requireRole(['PATIENT'])`.

## FP7 - Internal profile creation endpoint

### Endpoint
- `POST /api/patients/internal/create`

### Behavior
- Accepts `authUserId` (Firebase UID), `fullName`, `email`, optional `phone`.
- Rejects duplicates by `authUserId` with `409`.
- Protected by `x-internal-key` middleware (`protectInternalRoute`).

### Compatibility
- Fully compatible with Auth Service bootstrap payload after Firebase registration.

## FP8 - Report upload endpoint

### Endpoint
- `POST /api/patients/me/reports`

### Behavior
- Resolves patient by Firebase UID.
- Keeps multer-based local file upload.
- Keeps MongoDB metadata in `MedicalReport`.
- Restricts to `PATIENT` role.
- Validates file types (`pdf/jpg/jpeg/png`) and max size.
- Accepts both multipart field names: `file` and `report`.

## FP9 - Report list/delete endpoints

### Endpoints
- `GET /api/patients/me/reports`
- `DELETE /api/patients/me/reports/:reportId`

### Behavior
- Resolve patient by `req.user.uid`.
- Owner-only access via `{ patientId: patient._id }` query.
- Keep Mongo metadata + local file deletion strategy unchanged.

## FP10 - Prescriptions endpoint

### Endpoint
- `GET /api/patients/me/prescriptions`

### Behavior
- Resolve patient by Firebase UID.
- Return prescriptions sorted newest first (`issuedAt: -1`).
- Restrict to PATIENT role.

## FP11 - Medical history endpoint

### Endpoint
- `GET /api/patients/me/history`

### Behavior
- Resolve patient by Firebase UID.
- Return history latest first (`consultationDate: -1`).
- Restrict to PATIENT role.

## FP12 - PATIENT-only route protection review

### Checklist
- `GET /api/patients/me` -> Firebase auth + PATIENT role
- `PUT /api/patients/me` -> Firebase auth + PATIENT role
- `POST /api/patients/me/reports` -> Firebase auth + PATIENT role
- `GET /api/patients/me/reports` -> Firebase auth + PATIENT role
- `DELETE /api/patients/me/reports/:reportId` -> Firebase auth + PATIENT role
- `GET /api/patients/me/prescriptions` -> Firebase auth + PATIENT role
- `GET /api/patients/me/history` -> Firebase auth + PATIENT role

### Recommended middleware pattern
```js
router.get('/me', authenticateFirebaseToken, requireRole(['PATIENT']), patientController.getMyProfile);
```

### Additional hardening applied
- Removed obsolete public `POST /api/patients` profile-creation route.
- Protected authUserId lookup endpoint as internal-only:
  - `GET /api/patients/internal/:authUserId` + `x-internal-key`

## FP13 - Keep report storage design unchanged

### Recommendation
- Keep current design for now: local file uploads + MongoDB metadata.

### Justification
- Minimal refactor risk while authentication is being migrated.
- Practical for university scope and viva explanation.
- Works with Docker/Kubernetes if uploads path is persisted/mounted.

### What to document in README/report
- Upload directory path (`uploads/reports`).
- Supported file types and max file size.
- Metadata fields in MongoDB (`fileName`, `fileUrl`, `fileType`, `description`, `patientId`).
- Deployment note:
  - local files are ephemeral unless volume is mounted in Docker/K8s.
  - for production-grade durability, object storage (S3/GCS/Azure Blob) is future work.
