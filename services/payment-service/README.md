# Payment Service

Go + Gin microservice for payment lifecycle operations in the telemedicine system.

## What this service does

- Create payment requests
- Track payment by transaction ID
- List all payments for a patient
- Cancel pending payments
- Process provider webhooks

## Default runtime

- Port: `8085`
- Health endpoint: `GET /health`
- MongoDB database name: `payment-db`
- Collection: `payments`

## Environment variables

Required:

- `DATABASE_URL` (MongoDB connection URI)

Optional:

- `PORT` (default: `8085`)

### Notes on env loading

This service supports local `.env` loading automatically (best effort) from:

1. `./.env`
2. `../.env`
3. `../../.env`

So from `services/payment-service`, `go run main.go` can still work if root `.env` exists.

## Run locally

From repo root:

1. `cd services/payment-service`
2. `go mod tidy`
3. `go run main.go`

Expected startup logs include:

- `MongoDB connected successfully to payment-db`
- `payment-service listening on :8085`

## API endpoints

### Health

- `GET /health`

Response:

```json
{"status":"ok","service":"payment-service"}
```

### Create payment

- `POST /payments`

Request body:

```json
{
  "appointmentId": "apt-001",
  "patientId": "pat-001",
  "doctorId": "doc-001",
  "amount": 150.0,
  "currency": "USD",
  "paymentMethod": "CARD"
}
```

### Get payment by transaction ID

- `GET /payments/:transactionId`

### Get all payments by patient

- `GET /patients/:patientId/payments`

### Cancel pending payment

- `DELETE /payments/:transactionId`

### Provider webhook

- `POST /webhook`

Example webhook body:

```json
{
  "eventType": "payment.updated",
  "transactionId": "TXN-123",
  "status": "completed",
  "amount": 150.0,
  "data": {
    "providerRef": "abc-123"
  }
}
```

## Quick curl examples

Health:

```bash
curl http://localhost:8085/health
```

Create payment:

```bash
curl -X POST http://localhost:8085/payments \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId":"apt-001",
    "patientId":"pat-001",
    "doctorId":"doc-001",
    "amount":150,
    "currency":"USD",
    "paymentMethod":"CARD"
  }'
```

Get payment:

```bash
curl http://localhost:8085/payments/TXN-REPLACE-ME
```

List patient payments:

```bash
curl http://localhost:8085/patients/pat-001/payments
```

Cancel payment:

```bash
curl -X DELETE http://localhost:8085/payments/TXN-REPLACE-ME
```

Webhook:

```bash
curl -X POST http://localhost:8085/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventType":"payment.updated",
    "transactionId":"TXN-REPLACE-ME",
    "status":"completed",
    "amount":150,
    "data":{"providerRef":"abc"}
  }'
```

## Integration path via API Gateway

If running full stack behind NGINX gateway:

- `POST /payments`
- `GET /payments/:transactionId`
- `GET /patients/:patientId/payments`
- `DELETE /payments/:transactionId`
- `POST /webhook`

through gateway host, typically: `http://localhost`.

## Common issues

### `DATABASE_URL environment variable not set`

- Ensure root `.env` exists and includes `DATABASE_URL`
- Ensure URI is valid and quoted if needed
- Run from `services/payment-service` or export explicitly

### Mongo authentication failed

- Check MongoDB Atlas username/password in `DATABASE_URL`
- Ensure Atlas network access allows your IP

### Port in use

- Start with another port:
  - `PORT=8090 go run main.go`
