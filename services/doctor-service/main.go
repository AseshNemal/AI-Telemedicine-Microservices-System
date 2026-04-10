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
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load("../../.env")

	db := database.Connect()
	db.EnsureIndexes()

	// 2. Wire handlers.
	h := handlers.NewHandler(db)

	router := gin.Default()

	// CORS: allow the frontend (localhost:3000) and common local origins
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Fallback header middleware to ensure CORS header appears for simple responses
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "http://localhost:3000")
		c.Header("Access-Control-Allow-Credentials", "true")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

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
