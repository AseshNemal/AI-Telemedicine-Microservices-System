FROM golang:1.25

WORKDIR /app

COPY . .

RUN GOOS=linux GOARCH=amd64 go build -o main

RUN chmod +x main

EXPOSE 8084

CMD ["./main"]