# Backend Integration Testing Checklist (Firebase Auth-Only)

This checklist is backend-only and manual/Postman friendly.

## 0. Preconditions

1. Start backend services (`auth-service-node`, `patient-service-node`) with valid env.
2. Ensure MongoDB is reachable for both services.
3. Ensure Firebase Admin credentials are configured for both services.
4. Have Firebase Web API Key available for token generation (for manual testing).

## 1. Health checks

1. `GET http://localhost:5001/health`
2. `GET http://localhost:5002/health`

Expected:
- `200 OK` for both
- JSON status shows correct service name

## 2. Register PATIENT user (happy path)

Request:
```http
POST /api/auth/register
Host: localhost:5001
Content-Type: application/json

{
  "fullName": "Test Patient",
  "email": "test.patient@example.com",
  "password": "Pass12345!",
  "phone": "+94770000001",
  "role": "PATIENT"
}
```

Expected:
- `201 Created`
- Response contains Firebase `uid` and role `PATIENT`
- `profileSync.status` is `created` (or `pending-retry` if Patient Service was temporarily unavailable)

## 3. Register failure cases

1. Duplicate email registration:
- Same request as above with same email
- Expected: `409 Conflict`

2. Weak/invalid password:
- Use short password
- Expected: `400 Bad Request`

3. Invalid role value:
- role = `SUPERADMIN`
- Expected: `400 Bad Request` from validation

## 4. Obtain Firebase ID token for manual API tests

Use Firebase Identity Toolkit REST API:

```http
POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<FIREBASE_WEB_API_KEY>
Content-Type: application/json

{
  "email": "test.patient@example.com",
  "password": "Pass12345!",
  "returnSecureToken": true
}
```

Expected:
- `200 OK`
- Response includes `idToken` (use as Bearer token)

## 5. Verify Auth `/me` with Firebase token

Request:
```http
GET /api/auth/me
Host: localhost:5001
Authorization: Bearer <ID_TOKEN>
```

Expected:
- `200 OK`
- Includes `uid`, `email`, `role`, and safe user metadata

Failure cases:
- Missing token -> `401`
- Invalid token -> `401`

## 6. Verify patient profile bootstrap

Request (internal check):
```http
GET /api/patients/internal/<FIREBASE_UID>
Host: localhost:5002
x-internal-key: <INTERNAL_SERVICE_KEY>
```

Expected:
- `200 OK` with patient profile (authUserId matches Firebase UID)

Failure cases:
- Missing/invalid internal key -> `401`
- Non-existing UID -> `404`

## 7. Verify PATIENT self-service `/me`

Request:
```http
GET /api/patients/me
Host: localhost:5002
Authorization: Bearer <ID_TOKEN>
```

Expected:
- `200 OK`
- Returns patient profile resolved by `authUserId = req.user.uid`

Failure cases:
- Missing token -> `401`
- Token without PATIENT role claim -> `403`

## 8. Verify profile update with safe fields only

Request:
```http
PUT /api/patients/me
Host: localhost:5002
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json

{
  "phone": "+94770000002",
  "address": "Colombo",
  "bloodGroup": "O+",
  "authUserId": "tamper-attempt"
}
```

Expected:
- `200 OK`
- Allowed fields updated
- `authUserId` remains unchanged (tamper ignored)

## 9. Report upload/list/delete flow

1. Upload report:
```http
POST /api/patients/me/reports
Host: localhost:5002
Authorization: Bearer <ID_TOKEN>
Content-Type: multipart/form-data

file: <sample.pdf>
description: annual checkup
```
Expected: `201 Created`

2. List reports:
```http
GET /api/patients/me/reports
Host: localhost:5002
Authorization: Bearer <ID_TOKEN>
```
Expected: `200 OK` with uploaded report

3. Delete report:
```http
DELETE /api/patients/me/reports/<reportId>
Host: localhost:5002
Authorization: Bearer <ID_TOKEN>
```
Expected: `200 OK`

Failure cases:
- Invalid file type upload -> `400`
- Delete unknown report -> `404`

## 10. Prescriptions and history endpoints

1. `GET /api/patients/me/prescriptions`
2. `GET /api/patients/me/history`

Headers:
- `Authorization: Bearer <ID_TOKEN>`

Expected:
- `200 OK`
- Data sorted newest first
- PATIENT-only access enforced

## 11. Cross-role authorization checks

1. Register/login a `DOCTOR` user in Firebase.
2. Call PATIENT self-service endpoints with DOCTOR token.

Expected:
- `403 Forbidden` for `/api/patients/me*` endpoints

## 12. Operational failure scenarios

1. Stop Patient Service, register PATIENT from Auth Service.
- Expected: Auth registration still succeeds; `profileSync.status = pending-retry`

2. Remove Firebase credential env from one service and restart.
- Expected: service fail-fast startup error explaining missing Firebase credentials.
