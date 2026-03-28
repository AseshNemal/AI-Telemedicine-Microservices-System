package main

import (
	"log"
	"os"

	"telemedicine-service/handlers"
	"telemedicine-service/routes"
	"telemedicine-service/services"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func loadEnv() {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load("../../.env")
}

func main() {
	loadEnv()

	livekitService, err := services.NewLivekitServiceFromEnv()
	if err != nil {
		log.Fatalf("failed to initialize telemedicine-service: %v", err)
	}

	h := handlers.NewHandler(livekitService)
	router := gin.Default()
	routes.RegisterRoutes(router, h)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8086"
	}

	log.Printf("telemedicine-service listening on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("failed to start telemedicine-service: %v", err)
	}
}
