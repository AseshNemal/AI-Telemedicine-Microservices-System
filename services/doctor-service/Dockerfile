FROM golang:latest

WORKDIR /app

COPY . .

RUN go build -o main

RUN chmod +x main

EXPOSE 8082

CMD ["./main"]