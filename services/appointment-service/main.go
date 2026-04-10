package main

import (
	"appointment-service/database"
	"appointment-service/handlers"
	"appointment-service/routes"
	"log"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file
	godotenv.Load("../../.env")

	// 1. Connect to MongoDB and ensure indexes are in place.
	db := database.Connect()
	db.EnsureIndexes()

	// 2. Wire handlers.
	h := handlers.NewHandler(db)

	router := gin.Default()

	// 4. CORS — restrict to known origins in production via APPOINTMENT_CORS_ORIGINS env var.
	// Multiple origins may be specified as a comma-separated list.
	allowedOrigins := []string{"http://localhost:3000", "http://127.0.0.1:3000"}
	if envOrigins := os.Getenv("APPOINTMENT_CORS_ORIGINS"); envOrigins != "" {
		parts := strings.Split(envOrigins, ",")
		parsed := make([]string, 0, len(parts))
		for _, o := range parts {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				parsed = append(parsed, trimmed)
			}
		}
		// Only adopt the env-var list if it produced at least one valid origin (issue B11).
		if len(parsed) > 0 {
			allowedOrigins = parsed
		}
	}

	router.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// 5. Register all routes (public + authenticated).
	routes.RegisterRoutes(router, h)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}

	log.Printf("[appointment-service] listening on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("[appointment-service] failed to start: %v", err)
	}
}
