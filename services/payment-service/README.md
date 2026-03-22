# Payment Service

Go + Gin microservice for payment lifecycle operations in the telemedicine system.

## What this service does

- Create Stripe Checkout payment sessions
- Track payment by transaction ID
- List all payments for a patient
- Cancel pending payments
- Verify Stripe payment status without webhook (using `session_id`)
- Process provider webhooks (optional)

## Default runtime

- Port: `8085`
- Health endpoint: `GET /health`
- MongoDB database name: `payment-db`
- Collection: `payments`

## Environment variables

Required:

- `DATABASE_URL` (MongoDB connection URI)
- `STRIPE_SECRET_KEY` (Stripe test secret key, starts with `sk_test_` in sandbox)

Optional:

- `PORT` (default: `8085`)
- `FRONTEND_BASE_URL` (default: `http://localhost:3000`)
- `STRIPE_WEBHOOK_SECRET` (only required when webhook flow is enabled)
- `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` (frontend/browser usage)

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

### Verify payment (no-webhook flow)

- `GET /payments/verify?session_id=cs_test_...`

Use this after successful Stripe redirect to mark payment completed.

### Get all payments by patient

- `GET /patients/:patientId/payments`

### Cancel pending payment

- `DELETE /payments/:transactionId`

### Provider webhook

- `POST /webhook`

> Webhook is optional if you use `/payments/verify` after checkout success redirect.

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

Verify payment (no webhook):

```bash
curl "http://localhost:8085/payments/verify?session_id=cs_test_REPLACE_ME"
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
- `GET /payments/verify?session_id=...`
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

## Stripe sandbox quick test (no webhook)

1. Ensure `STRIPE_SECRET_KEY` is set in root `.env`.
2. Start service:
  - `PORT=8090 go run main.go`
3. Create payment (`POST /payments`) and copy `checkoutUrl`.
4. Open `checkoutUrl` in browser and pay with test card:
  - `4242 4242 4242 4242`
  - Any future expiry, any CVC, any ZIP
5. From success URL, copy `session_id` query param.
6. Verify via:
  - `GET /payments/verify?session_id=<SESSION_ID>`
7. Fetch by transaction ID to confirm status changed to `COMPLETED`.
