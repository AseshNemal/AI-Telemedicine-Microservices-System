package main

import (
	"log"
	"notification-service/handlers"
	"notification-service/routes"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load shared workspace .env when running locally from service directory.
	_ = godotenv.Load("../../.env")

	h := handlers.NewHandler()
	router := gin.Default()
	routes.RegisterRoutes(router, h)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8084"
	}

	log.Printf("notification-service listening on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("failed to start notification-service: %v", err)
	}
}
