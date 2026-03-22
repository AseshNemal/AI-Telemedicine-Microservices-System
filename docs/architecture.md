# AI Telemedicine Microservices System - Architecture

## Overview

This project is a cloud-native telemedicine starter built with distributed microservices.

- Frontend: Next.js (`web-app`)
- Backend: Go + Gin microservices
- Data Layer: MongoDB Atlas (via `DATABASE_URL`)
- Local Orchestration: Docker Compose
- Kubernetes Readiness: deployment manifests under `deployments/kubernetes`

## Service Boundaries

### Auth Service (Node/Express, `:5001`)
Responsible for Firebase-auth-only user registration, token-verified identity lookup, and PATIENT bootstrap orchestration.

Endpoints:
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /health`

### Patient Service (Node/Express, `:5002`)
Responsible for patient domain data in MongoDB and Firebase-authenticated self-service APIs.

Endpoints:
- `POST /api/patients/internal/create` (internal)
- `GET /api/patients/me`
- `PUT /api/patients/me`
- `POST /api/patients/me/reports`
- `GET /api/patients/me/reports`
- `DELETE /api/patients/me/reports/:reportId`
- `GET /api/patients/me/prescriptions`
- `GET /api/patients/me/history`
- `GET /health`

### Doctor Service (`:8082`)
Responsible for doctor directory and profile management.

Endpoints:
- `GET /doctors`
- `POST /doctor`
- `GET /doctor/:id`
- `GET /health`

### Appointment Service (`:8083`)
Responsible for appointment scheduling lifecycle.

Endpoints:
- `POST /appointments`
- `GET /appointments`
- `DELETE /appointments/:id`
- `GET /health`

### Notification Service (`:8084`)
Responsible for event notifications (log-only in starter).

Endpoints:
- `POST /send-email`
- `POST /send-sms`
- `GET /health`

## Request Flow: Booking

1. Auth Service creates user in Firebase Auth and sets role custom claim.
2. Frontend fetches doctors from Doctor Service.
3. User books appointment via Appointment Service.
4. Appointment Service stores booking and calls Notification Service (`/send-email`).
5. Notification Service logs outbound notification payload.

Patient profile lifecycle:
1. Register with role `PATIENT` via Auth Service.
2. Auth Service calls Patient Service internal endpoint with `authUserId = Firebase UID`.
3. Patient Service stores profile in MongoDB and serves self-service APIs using `req.user.uid`.

## Internal Service Communication

- Appointment -> Notification uses `NOTIFICATION_SERVICE_URL`
- In Docker Compose and Kubernetes, service DNS names are used for resolution.

## Firebase Auth Notes

- Firebase is used only for authentication and identity verification.
- Domain data (patient profile/reports/prescriptions/history) remains in MongoDB.
- PATIENT/DOCTOR/ADMIN role is read from Firebase custom claims, with optional Auth DB mirror fallback.
