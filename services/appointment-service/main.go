package main

import (
	"appointment-service/database"
	"appointment-service/handlers"
	"appointment-service/routes"
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
		port = "8083"
	}

	log.Printf("appointment-service listening on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("failed to start appointment-service: %v", err)
	}
}
