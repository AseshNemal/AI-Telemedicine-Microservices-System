package database

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
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
		log.Fatalf("[doctor-service] DATABASE_URL missing; aborting startup (DATABASE_URL is required)")
	}

	log.Println("[doctor-service] database URL detected")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(uri)
	mc, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Fatalf("[doctor-service] mongo connect error: %v", err)
	}

	// Derive DB name: explicit env var takes priority over URI path parsing.
	dbName := os.Getenv("MONGO_DB_NAME")
	if dbName == "" {
		dbName = "telemedicine"
		if idx := strings.LastIndex(uri, "/"); idx != -1 {
			rest := uri[idx+1:]
			if q := strings.Index(rest, "?"); q != -1 {
				dbName = rest[:q]
			} else if rest != "" {
				dbName = rest
			}
		}
	}

	db := mc.Database(dbName)

	return &Client{URI: uri, Connected: true, MongoClient: mc, DB: db}
}

// IsConnected performs a lightweight ping to verify MongoDB is reachable.
func (c *Client) IsConnected() bool {
	if c.MongoClient == nil || c.DB == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	return c.MongoClient.Ping(ctx, nil) == nil
}

// EnsureIndexes creates all indexes required by the doctor service.
// Called once at startup after Connect().
func (c *Client) EnsureIndexes() {
	if c.DB == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	ensureIndex := func(collName string, model mongo.IndexModel) {
		if _, err := c.DB.Collection(collName).Indexes().CreateOne(ctx, model); err != nil {
			log.Printf("[doctor-service] EnsureIndexes warning (%s): %v", collName, err)
		}
	}

	// doctors collection
	ensureIndex("doctors", mongo.IndexModel{
		Keys:    bson.D{{Key: "id", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("ux_doctor_id"),
	})
	ensureIndex("doctors", mongo.IndexModel{
		Keys:    bson.D{{Key: "firebase_uid", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("ux_doctor_firebase_uid"),
	})
	ensureIndex("doctors", mongo.IndexModel{
		Keys:    bson.D{{Key: "verification_status", Value: 1}},
		Options: options.Index().SetName("ix_doctor_verification_status"),
	})
	ensureIndex("doctors", mongo.IndexModel{
		Keys:    bson.D{{Key: "specialty", Value: 1}},
		Options: options.Index().SetName("ix_doctor_specialty"),
	})
	ensureIndex("doctors", mongo.IndexModel{
		Keys:    bson.D{{Key: "name", Value: 1}},
		Options: options.Index().SetName("ix_doctor_name"),
	})

	// availability collection — unique per (doctor_id, day_of_week)
	ensureIndex("availability", mongo.IndexModel{
		Keys:    bson.D{{Key: "id", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("ux_availability_id"),
	})
	ensureIndex("availability", mongo.IndexModel{
		Keys:    bson.D{{Key: "doctor_id", Value: 1}, {Key: "day_of_week", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("ux_availability_doctor_day"),
	})

	// consultations collection
	ensureIndex("consultations", mongo.IndexModel{
		Keys:    bson.D{{Key: "id", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("ux_consultation_id"),
	})
	ensureIndex("consultations", mongo.IndexModel{
		Keys:    bson.D{{Key: "appointment_id", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("ux_consultation_appointment_id"),
	})
	ensureIndex("consultations", mongo.IndexModel{
		Keys:    bson.D{{Key: "doctor_id", Value: 1}},
		Options: options.Index().SetName("ix_consultation_doctor_id"),
	})

	log.Println("[doctor-service] EnsureIndexes completed")
}
