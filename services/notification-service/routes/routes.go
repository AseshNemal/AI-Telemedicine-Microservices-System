package routes

import (
	"notification-service/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.Engine, h *handlers.Handler) {
	router.GET("/health", h.Health)
	router.POST("/send-email", h.SendEmail)
	router.POST("/send-sms", h.SendSMS)
}
