package router

import (
	"net/http"

	"AI-symptom-service/internal/handler"

	"github.com/gin-gonic/gin"
)

func New(symptomHandler *handler.SymptomHandler) *gin.Engine {
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "AI-symptom-service"})
	})

	r.POST("/symptoms/chat", symptomHandler.Chat)

	return r
}
