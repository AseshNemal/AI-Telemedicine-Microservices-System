# AI Telemedicine Microservices System - Architecture

## Overview

This project is a cloud-native telemedicine starter built with distributed microservices.

- Frontend: Next.js (`web-app`)
- Backend: Go + Gin microservices
- Data Layer: MongoDB Atlas (via `DATABASE_URL`)
- Local Orchestration: Docker Compose
- Kubernetes Readiness: deployment manifests under `deployments/kubernetes`

## Service Boundaries

### Auth Service (`:8081`)
Responsible for mock-first authentication and user profile APIs.

Endpoints:
- `POST /register`
- `POST /login`
- `GET /profile`
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

1. User logs in via Auth Service.
2. Frontend fetches doctors from Doctor Service.
3. User books appointment via Appointment Service.
4. Appointment Service stores booking and calls Notification Service (`/send-email`).
5. Notification Service logs outbound notification payload.

## Internal Service Communication

- Appointment -> Notification uses `NOTIFICATION_SERVICE_URL`
- In Docker Compose and Kubernetes, service DNS names are used for resolution.

## Future Firebase Integration Point

Auth Service is intentionally mock-first in this starter.

When integrating Firebase:
- Replace `POST /login` and `GET /profile` internals with Firebase token verification.
- Keep endpoint contracts stable so frontend and downstream services do not need major changes.
- Optionally add middleware for role claims (`Patient`, `Doctor`, `Admin`).
