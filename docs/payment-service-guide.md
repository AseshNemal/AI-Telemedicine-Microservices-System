# Payment Service Integration Guide

## Overview

The Payment Service is a Go-based microservice responsible for managing payment transactions in the telemedicine system. It provides endpoints for creating payments, retrieving payment information, handling payment provider webhooks, and canceling payments.

## Architecture

The Payment Service follows a layered architecture:

```
┌─────────────────────────────────┐
│        HTTP Handlers            │  (handlers/payment.go)
│  - CreatePayment                │
│  - GetPayment                   │
│  - GetPaymentsByPatient         │
│  - HandleWebhook                │
│  - CancelPayment                │
└────────────────┬────────────────┘
                 │
┌────────────────▼─────────────────┐
│      Data Models                 │
│  - Payment                       │  (models/payment.go)
│  - PaymentRequest                │
│  - PaymentResponse               │
│  - WebhookPayload                │
└────────────────┬────────────────┘
                 │
┌────────────────▼──────────────────┐
│     Database Layer                │
│  - MongoDB Connection             │  (database/database.go)
│  - Index Management               │
│  - Document Operations            │
└───────────────────────────────────┘
```

## Database Schema

The Payment Service uses MongoDB with the following document structure:

```json
{
  "_id": ObjectId,
  "appointmentId": "string",
  "patientId": "string",
  "amount": number,
  "currency": "string (default: USD)",
  "status": "PENDING|COMPLETED|FAILED|CANCELLED|REFUNDED",
  "transactionId": "string (unique)",
  "checkoutUrl": "string",
  "providerResponse": {
    "paymentMethodId": "string",
    "authorizationCode": "string",
    "metadata": {}
  },
  "createdAt": ISODate,
  "updatedAt": ISODate,
  "completedAt": ISODate
}
```

### Database Indexes

The following indexes are automatically created for performance:

- `appointmentId` — for quick lookup by appointment
- `patientId` — for retrieving patient's payment history  
- `transactionId` — unique index for payment deduplication

## API Endpoints

### Create Payment

**Endpoint:** `POST /payments`

**Request Body:**
```json
{
  "appointmentId": "apt-12345",
  "patientId": "patient-001",
  "amount": 150.00,
  "currency": "USD"
}
```

**Response (201 Created):**
```json
{
  "id": "payment-001",
  "transactionId": "txn-abc123def456",
  "appointmentId": "apt-12345",
  "patientId": "patient-001",
  "amount": 150.00,
  "currency": "USD",
  "status": "PENDING",
  "checkoutUrl": "https://checkout.provider.com/payments/txn-abc123def456",
  "createdAt": "2026-03-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` — Missing required fields
- `500 Internal Server Error` — Database error

---

### Get Payment

**Endpoint:** `GET /payments/:transactionId`

**Response (200 OK):**
```json
{
  "id": "payment-001",
  "transactionId": "txn-abc123def456",
  "appointmentId": "apt-12345",
  "patientId": "patient-001",
  "amount": 150.00,
  "currency": "USD",
  "status": "COMPLETED",
  "checkoutUrl": "https://checkout.provider.com/payments/txn-abc123def456",
  "providerResponse": {
    "paymentMethodId": "pm-xyz789",
    "authorizationCode": "AUTH-12345",
    "metadata": {}
  },
  "createdAt": "2026-03-15T10:30:00Z",
  "completedAt": "2026-03-15T10:35:00Z"
}
```

**Error Responses:**
- `404 Not Found` — Payment does not exist
- `500 Internal Server Error` — Database error

---

### Get Payments by Patient

**Endpoint:** `GET /patients/:patientId/payments`

**Query Parameters:**
- `status` (optional) — Filter by payment status (PENDING, COMPLETED, FAILED, etc.)
- `limit` (optional, default: 20) — Number of records to return
- `offset` (optional, default: 0) — Pagination offset

**Response (200 OK):**
```json
{
  "payments": [
    {
      "id": "payment-001",
      "transactionId": "txn-abc123def456",
      "appointmentId": "apt-12345",
      "amount": 150.00,
      "status": "COMPLETED",
      "createdAt": "2026-03-15T10:30:00Z"
    },
    {
      "id": "payment-002",
      "transactionId": "txn-xyz789abc123",
      "appointmentId": "apt-12346",
      "amount": 100.00,
      "status": "PENDING",
      "createdAt": "2026-03-16T14:00:00Z"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

---

### Cancel Payment

**Endpoint:** `DELETE /payments/:transactionId`

**Response (200 OK):**
```json
{
  "message": "Payment cancelled successfully",
  "id": "payment-001",
  "transactionId": "txn-abc123def456",
  "status": "CANCELLED",
  "cancelledAt": "2026-03-15T10:45:00Z"
}
```

**Error Responses:**
- `404 Not Found` — Payment does not exist
- `400 Bad Request` — Cannot cancel completed or failed payments
- `500 Internal Server Error` — Database error

---

### Handle Webhook

**Endpoint:** `POST /webhook`

**Request Body (From Payment Provider):**
```json
{
  "event": "payment.completed",
  "transactionId": "txn-abc123def456",
  "status": "COMPLETED",
  "amount": 150.00,
  "paymentMethodId": "pm-xyz789",
  "authorizationCode": "AUTH-12345",
  "timestamp": "2026-03-15T10:35:00Z"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "transactionId": "txn-abc123def456",
  "status": "COMPLETED"
}
```

**Error Responses:**
- `400 Bad Request` — Missing transactionId
- `404 Not Found` — Payment does not exist
- `500 Internal Server Error` — Database error

---

### Health Check

**Endpoint:** `GET /health`

**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "payment-service"
}
```

## Testing

### Using Docker Compose (Recommended)

From the `deployments/` directory:

```bash
cd deployments
docker compose up --build
```

The Payment Service will be accessible at `http://localhost:8085` directly, or through the API Gateway at `http://localhost/payments`.

### Using Postman

Import the following collection examples:

#### 1. Create Payment
```
POST http://localhost/payments
Content-Type: application/json

{
  "appointmentId": "apt-12345",
  "patientId": "patient-001",
  "amount": 150.00,
  "currency": "USD"
}
```

#### 2. Get Payment
```
GET http://localhost/payments/txn-abc123def456
```

#### 3. Get Patient Payments
```
GET http://localhost/patients/patient-001/payments
```

#### 4. Simulate Webhook
```
POST http://localhost/webhook
Content-Type: application/json

{
  "event": "payment.completed",
  "transactionId": "txn-abc123def456",
  "status": "COMPLETED",
  "amount": 150.00,
  "paymentMethodId": "pm-xyz789",
  "authorizationCode": "AUTH-12345",
  "timestamp": "2026-03-15T10:35:00Z"
}
```

#### 5. Cancel Payment
```
DELETE http://localhost/payments/txn-abc123def456
```

#### 6. Health Check
```
GET http://localhost/payments/health
```

### Manual cURL Tests

```bash
# Create payment
curl -X POST http://localhost/payments \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": "apt-12345",
    "patientId": "patient-001",
    "amount": 150.00,
    "currency": "USD"
  }'

# Get payment (replace txn-xxx with actual transaction ID)
curl http://localhost/payments/txn-abc123def456

# Get patient payments
curl http://localhost/patients/patient-001/payments

# Cancel payment
curl -X DELETE http://localhost/payments/txn-abc123def456

# Webhook simulation
curl -X POST http://localhost/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.completed",
    "transactionId": "txn-abc123def456",
    "status": "COMPLETED",
    "amount": 150.00
  }'

# Health check
curl http://localhost:8085/health
```

## Integration with Appointment Service

The Payment Service is designed to work seamlessly with the Appointment Service:

1. **Payment Creation** — When an appointment is scheduled, the UI calls `POST /payments` with the appointment ID
2. **Payment Status Tracking** — The appointment view queries `GET /patients/:patientId/payments` to show payment history
3. **Webhook Integration** — Payment providers call `POST /webhook` to update payment status in real-time
4. **Payment Cancellation** — If an appointment is cancelled, the associated payment can be cancelled via `DELETE /payments/:transactionId`

## Environment Variables

The Payment Service reads the following environment variables:

- `PORT` (default: `8085`) — Server port
- `DATABASE_URL` (required) — MongoDB connection string  
  Example: `mongodb://admin:admin@mongodb-payment:27017/payment-db?authSource=admin`
- `APPOINTMENT_PORT` (default: `8083`) — For future service-to-service calls
- `FIREBASE_SERVICE_ACCOUNT_PATH` (optional) — Path to Firebase credentials
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (optional) — Firebase env vars

### Docker Compose Configuration

In `docker-compose.yml`, the Payment Service is configured with:

```yaml
payment-service:
  build:
    context: ./services/payment-service
    dockerfile: Dockerfile
  container_name: payment-service
  environment:
    PORT: "8085"
    DATABASE_URL: mongodb://admin:admin@mongodb-payment:27017/payment-db?authSource=admin
  depends_on:
    mongodb-payment:
      condition: service_started
  ports:
    - "8085:8085"
```

## Kubernetes Deployment

The Payment Service Kubernetes manifests are located in `deployments/kubernetes/`:

- `payment-deployment.yaml` — Payment Service deployment with 2 replicas, health checks, resource limits
- `mongodb-payment-statefulset.yaml` — MongoDB StatefulSet with persistent storage

### Deploy to Kubernetes

```bash
# Apply Payment Service
kubectl apply -f deployments/kubernetes/payment-deployment.yaml

# Apply MongoDB StatefulSet
kubectl apply -f deployments/kubernetes/mongodb-payment-statefulset.yaml

# Verify deployment
kubectl get deployments
kubectl get statefulsets
kubectl get services | grep payment

# Port forward for testing
kubectl port-forward svc/payment-service 8085:8085
```

## Production Considerations

- **Database Backups** — Implement automated MongoDB backups using K8s CronJobs
- **Payment Provider Integration** — Replace stub webhook handling with real provider integration
- **Idempotency** — All operations use unique `transactionId` to ensure idempotent webhook processing
- **Audit Logging** — Add detailed audit logs for all payment operations
- **Rate Limiting** — Gateway already limits to 10 req/s; configure stricter limits for `/webhook` endpoint
- **Encrypted Storage** — Store sensitive payment data encrypted at rest in MongoDB
- **Compliance** — Ensure PCI-DSS compliance for payment data handling; consider using payment provider vaults for sensitive data

## Troubleshooting

### Payment Service Not Starting

**Check service logs:**
```bash
docker logs payment-service
# or in K8s:
kubectl logs deployment/payment-service
```

**Common errors:**
- `connection refused` — Verify `DATABASE_URL` and MongoDB is running
- `address already in use` — Check if port 8085 is in use; change `PORT` environment variable

### MongoDB Connection Issues

**Verify MongoDB is running:**
```bash
docker ps | grep mongo
# or in K8s:
kubectl get statefulsets
kubectl logs mongodb-payment-0
```

**Test connection:**
```bash
# Direct MongoDB shell connection
mongosh "mongodb://admin:admin@mongodb-payment:27017/payment-db?authSource=admin"
```

### Webhook Not Processing

**Verify webhook endpoint:**
```bash
curl -X POST http://localhost/webhook \
  -H "Content-Type: application/json" \
  -d '{"transactionId":"test-txn","event":"payment.completed","status":"COMPLETED"}'
```

**Check logs for errors:**
```bash
docker logs payment-service | grep webhook
```

## Future Enhancements

- [ ] Real payment provider integration (Stripe, PayPal, Square)
- [ ] Refund management endpoints
- [ ] Payment retry logic for failed transactions
- [ ] Email notifications on payment status changes
- [ ] Payment analytics and reporting
- [ ] Support for multiple currencies and payment methods
- [ ] Webhook signature verification for security

## Related Documentation

- [Main README](../README.md) — Project overview and setup
- [API Gateway README](../api-gateway-nginx/README.md) — Gateway configuration
- [Backend Integration Testing](backend-integration-testing-checklist.md) — Testing procedures
