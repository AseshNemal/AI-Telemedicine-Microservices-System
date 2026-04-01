package main

import (
	"doctor-service/database"
	"doctor-service/handlers"
	"doctor-service/routes"
	"log"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Connect to MongoDB and ensure indexes are in place.
	db := database.Connect()
	db.EnsureIndexes()

	// 2. Wire handlers.
	h := handlers.NewHandler(db)

	router := gin.Default()

	// 3. CORS — restrict to known origins in production via DOCTOR_CORS_ORIGINS env var.
	// Multiple origins may be specified as a comma-separated list.
	allowedOrigins := []string{"http://localhost:3000", "http://127.0.0.1:3000"}
	if envOrigins := os.Getenv("DOCTOR_CORS_ORIGINS"); envOrigins != "" {
		parts := strings.Split(envOrigins, ",")
		parsed := make([]string, 0, len(parts))
		for _, o := range parts {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				parsed = append(parsed, trimmed)
			}
		}
		// Only adopt the env-var list if it produced at least one valid origin.
		if len(parsed) > 0 {
			allowedOrigins = parsed
		}
	}

	router.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Internal-Key"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// 4. Register all routes (public + authenticated + internal).
	routes.RegisterRoutes(router, h)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	log.Printf("[doctor-service] listening on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("[doctor-service] failed to start: %v", err)
	}
}
