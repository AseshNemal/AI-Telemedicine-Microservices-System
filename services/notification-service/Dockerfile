FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o notification-service .

FROM alpine:3.20

WORKDIR /app

COPY --from=builder /app/notification-service .

RUN apk add --no-cache ca-certificates

EXPOSE 8084

CMD ["./notification-service"]