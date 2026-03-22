package database

import (
	"bufio"
	"context"
	"log"
	"os"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var PaymentDB *mongo.Database

// Connect connects to MongoDB and initializes the database.
func Connect() *mongo.Database {
	mongoURI := os.Getenv("DATABASE_URL")
	if mongoURI == "" {
		mongoURI = findDatabaseURLInEnvFiles()
	}
	if mongoURI == "" {
		log.Fatalf("DATABASE_URL environment variable not set (checked env and .env fallback files)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("failed to connect to MongoDB: %v", err)
	}

	if err = client.Ping(ctx, nil); err != nil {
		log.Fatalf("failed to ping MongoDB: %v", err)
	}

	db := client.Database("payment-db")
	PaymentDB = db
	createIndexes(db)

	log.Println("MongoDB connected successfully to payment-db")
	return db
}

// createIndexes creates necessary MongoDB indexes.
func createIndexes(db *mongo.Database) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	indexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "appointmentId", Value: 1}}},
		{Keys: bson.D{{Key: "patientId", Value: 1}}},
		{Keys: bson.D{{Key: "transactionId", Value: 1}}, Options: options.Index().SetUnique(true)},
	}

	if _, err := db.Collection("payments").Indexes().CreateMany(ctx, indexes); err != nil {
		log.Printf("failed to create one or more indexes: %v", err)
		return
	}

	log.Println("MongoDB indexes created/verified")
}

func findDatabaseURLInEnvFiles() string {
	candidates := []string{".env", "../.env", "../../.env"}

	for _, file := range candidates {
		f, err := os.Open(file)
		if err != nil {
			continue
		}

		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if strings.HasPrefix(line, "DATABASE_URL=") {
				v := strings.TrimPrefix(line, "DATABASE_URL=")
				v = strings.TrimSpace(v)
				v = strings.Trim(v, `"`)
				_ = f.Close()
				return v
			}
		}

		_ = f.Close()
	}

	return ""
}
