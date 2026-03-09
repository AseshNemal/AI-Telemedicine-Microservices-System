package main

import (
	"auth-service/database"
	"auth-service/handlers"
	"auth-service/routes"
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
		port = "8081"
	}

	log.Printf("auth-service listening on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("failed to start auth-service: %v", err)
	}
}
