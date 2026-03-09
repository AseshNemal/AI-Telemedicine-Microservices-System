package database

import (
	"log"
	"os"
)

type Client struct {
	URI       string
	Connected bool
}

func Connect() *Client {
	uri := os.Getenv("DATABASE_URL")
	if uri == "" {
		log.Println("[doctor-service] DATABASE_URL missing; running in in-memory mode")
		return &Client{Connected: false}
	}
	log.Println("[doctor-service] database URL detected")
	return &Client{URI: uri, Connected: true}
}
