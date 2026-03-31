FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o appointment-service .

FROM alpine:3.20

WORKDIR /app

COPY --from=builder /app/appointment-service .

RUN apk add --no-cache ca-certificates

EXPOSE 8083

CMD ["./appointment-service"]