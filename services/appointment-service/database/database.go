package database

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Client struct {
	URI         string
	Connected   bool
	MongoClient *mongo.Client
	DB          *mongo.Database
}

func Connect() *Client {
	uri := os.Getenv("DATABASE_URL")
	if uri == "" {
		log.Fatalf("[appointment-service] DATABASE_URL missing; aborting startup (DATABASE_URL is required)")
	}

	log.Println("[appointment-service] database URL detected")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(uri)
	mc, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Fatalf("[appointment-service] mongo connect error: %v", err)
	}

	// derive DB name from URI (path portion)
	dbName := "telemedicine"
	if idx := strings.LastIndex(uri, "/"); idx != -1 {
		rest := uri[idx+1:]
		if q := strings.Index(rest, "?"); q != -1 {
			dbName = rest[:q]
		} else if rest != "" {
			dbName = rest
		}
	}

	db := mc.Database(dbName)

	return &Client{URI: uri, Connected: true, MongoClient: mc, DB: db}
}
