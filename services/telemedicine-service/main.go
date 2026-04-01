package main

import (
	"log"
	"os"
	"strings"
	"time"

	"telemedicine-service/handlers"
	"telemedicine-service/routes"
	"telemedicine-service/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func loadEnv() {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load("../../.env")
}

func allowedOrigins() []string {
	raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if raw == "" {
		return []string{"http://localhost:3000", "http://127.0.0.1:3000"}
	}

	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, origin := range parts {
		trimmed := strings.TrimSpace(origin)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	if len(origins) == 0 {
		return []string{"http://localhost:3000", "http://127.0.0.1:3000"}
	}

	return origins
}

func main() {
	loadEnv()

	livekitService, err := services.NewLivekitServiceFromEnv()
	if err != nil {
		log.Fatalf("failed to initialize telemedicine-service: %v", err)
	}

	h := handlers.NewHandler(livekitService)
	router := gin.Default()
	router.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins(),
		AllowMethods:     []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
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
