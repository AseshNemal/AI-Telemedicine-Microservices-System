package main

import (
	"doctor-service/database"
	"doctor-service/handlers"
	"doctor-service/routes"
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	db := database.Connect()
	h := handlers.NewHandler(db)

	router := gin.Default()
	routes.RegisterRoutes(router, h)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	log.Printf("doctor-service listening on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("failed to start doctor-service: %v", err)
	}
}
