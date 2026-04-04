# Telemedicine Service

Go + Gin microservice for LiveKit-based telemedicine sessions.

## What this service does

- Creates participant access tokens for LiveKit rooms
- Creates rooms in LiveKit
- Fetches room details
- Deletes rooms

## Default runtime

- Port: `8086`
- Health endpoint: `GET /health`

## Environment variables

Required:

- `LIVEKIT_URL` (example: `wss://your-livekit-host`)
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Optional:

- `PORT` (default: `8086`)

### Notes on env loading

This service supports local `.env` loading automatically (best effort) from:

1. `./.env`
2. `../.env`
3. `../../.env`

## Run locally

From repo root:

1. `cd services/telemedicine-service`
2. `go mod tidy`
3. `go run main.go`

## API endpoints

- `GET /health`
- `GET /telemedicine/health`
- `POST /telemedicine/token`
- `POST /telemedicine/rooms`
- `GET /telemedicine/rooms/:roomName`
- `DELETE /telemedicine/rooms/:roomName`

### Create token

`POST /telemedicine/token`

Request body:

```json
{
  "roomName": "appointment-123",
  "participantIdentity": "patient-001",
  "participantName": "John Doe",
  "metadata": "{\"role\":\"PATIENT\"}",
  "ttlSeconds": 3600,
  "canPublish": true,
  "canSubscribe": true,
  "canPublishData": true
}
```

### Create room

`POST /telemedicine/rooms`

Request body:

```json
{
  "roomName": "appointment-123",
  "emptyTimeout": 600,
  "maxParticipants": 2,
  "metadata": "{\"appointmentId\":\"apt-123\"}"
}
```

If `emptyTimeout` is omitted or set to `0`, the service applies a default of `300` seconds (5 minutes).
This means a room with no participants will be automatically cleaned up by LiveKit after 5 minutes.
