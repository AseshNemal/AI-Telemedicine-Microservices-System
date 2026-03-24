FROM golang:1.26.1-alpine AS builder
WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o AI-symptom-service .

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/AI-symptom-service .

EXPOSE 8091
CMD ["./AI-symptom-service"]
