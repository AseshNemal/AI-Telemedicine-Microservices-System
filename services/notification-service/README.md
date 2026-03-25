Notification Service

Environment variables
- `PORT` (optional) — service port, default `8084`
- `TWILIO_ACCOUNT_SID` — Twilio Account SID (for SMS)
- `TWILIO_AUTH_TOKEN` — Twilio Auth Token
- `TWILIO_FROM_NUMBER` — Twilio phone number to send from (e.g. +1234567890)
- `SENDGRID_API_KEY` — SendGrid API key (for email)
- `SENDGRID_FROM_EMAIL` — From email address for SendGrid

Endpoints
- `GET /health` — health check
- `POST /send-sms` — send SMS; request JSON: `{ "to": "+123..", "message": "..." }`
- `POST /send-email` — send email; request JSON: `{ "to": "user@example.com", "subject": "..", "message": ".." }`

Notes
- SMS uses Twilio REST API; email uses SendGrid v3 API.
- If providers are not configured the endpoints will return `503 Service Unavailable`.
