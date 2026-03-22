package main

import (
	"log"
	"os"
	"payment-service/database"
	"payment-service/handlers"
	"payment-service/routes"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Best-effort local .env loading (safe no-op in Docker/K8s where envs are injected)
	// Overload is used so empty shell vars don't block values from .env during local runs.
	_ = godotenv.Overload(".env", "../.env", "../../.env")

	// Load environment
	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}

	// Connect to database
	db := database.Connect()
	h := handlers.NewHandler(db)

	// Create router
	router := gin.Default()

	// Enable CORS for browser-based requests
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000", "http://localhost", "http://api-gateway-nginx"},
		AllowMethods:     []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "payment-service"})
	})

	// Register routes
	routes.RegisterRoutes(router, h)

	log.Printf("payment-service listening on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("failed to start payment-service: %v", err)
	}
}
