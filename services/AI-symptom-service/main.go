package main

import (
	"log"
	"os"

	"AI-symptom-service/internal/ai"
	"AI-symptom-service/internal/handler"
	"AI-symptom-service/internal/router"
	"AI-symptom-service/internal/service"

	"github.com/joho/godotenv"
)

func main() {
	// Load only workspace root .env
	_ = godotenv.Overload("../../.env")

	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		log.Fatal("OPENAI_API_KEY is required")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8091"
	}

	aiClient, err := ai.NewOpenAIClient(apiKey)
	if err != nil {
		log.Fatalf("failed to init ai client: %v", err)
	}

	symptomService := service.NewSymptomService(aiClient)
	symptomHandler := handler.NewSymptomHandler(symptomService)
	r := router.New(symptomHandler)

	log.Printf("AI-symptom-service listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
