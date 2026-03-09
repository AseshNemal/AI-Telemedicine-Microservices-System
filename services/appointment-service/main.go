package main

import (
	"appointment-service/database"
	"appointment-service/handlers"
	"appointment-service/routes"
	"log"
	"os"

	"github.com/gin-gonic/gin"

    "github.com/gin-contrib/cors"
)

func main() {
	db := database.Connect()
	h := handlers.NewHandler(db)

	router := gin.Default()

	// Enable CORS for browser-based requests (development friendly)
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	routes.RegisterRoutes(router, h)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}

	log.Printf("appointment-service listening on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("failed to start appointment-service: %v", err)
	}
}
