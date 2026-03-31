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
// Use this instead of the Connected flag so stale post-startup disconnections
// are detected on the actual request path.
func (c *Client) IsConnected() bool {
	if c.MongoClient == nil || c.DB == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	return c.MongoClient.Ping(ctx, nil) == nil
}

// EnsureIndexes creates all indexes required by the appointment service.
// It should be called once at startup, after Connect().
//
// Critical index: unique compound on (doctorId, date, time) scoped to active
// appointments only (PENDING_PAYMENT, CONFIRMED, and BOOKED). This prevents
// double-booking at the database layer under concurrent writes.
// Terminal statuses (REJECTED, CANCELLED, COMPLETED) are excluded so their
// slots can be legitimately rebooked.
func (c *Client) EnsureIndexes() {
	if c.DB == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	coll := c.DB.Collection("appointments")

	indexModel := mongo.IndexModel{
		Keys: bson.D{
			{Key: "doctorId", Value: 1},
			{Key: "date", Value: 1},
			{Key: "time", Value: 1},
		},
		Options: options.Index().
			SetUnique(true).
			SetName("ux_doctor_slot_active").
			// Only enforce uniqueness for active (non-terminal) appointments so that
			// cancelled/rejected slots can be legitimately rebooked.
			SetPartialFilterExpression(bson.D{
				{Key: "status", Value: bson.D{
					{Key: "$in", Value: bson.A{"PENDING_PAYMENT", "CONFIRMED", "BOOKED"}},
				}},
			}),
	}

	if _, err := coll.Indexes().CreateOne(ctx, indexModel); err != nil {
		// Log a warning but do not abort: the index may already exist.
		log.Printf("[appointment-service] index creation warning (may already exist): %v", err)
	} else {
		log.Println("[appointment-service] unique doctor-slot index ensured")
	}
}
