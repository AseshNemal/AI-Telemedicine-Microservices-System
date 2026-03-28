package routes

import (
	"telemedicine-service/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.Engine, h *handlers.Handler) {
	router.GET("/health", h.Health)

	telemedicine := router.Group("/telemedicine")
	{
		telemedicine.GET("/health", h.Health)
		telemedicine.POST("/token", h.CreateToken)
		telemedicine.POST("/rooms", h.CreateRoom)
		telemedicine.GET("/rooms/:roomName", h.GetRoom)
		telemedicine.DELETE("/rooms/:roomName", h.DeleteRoom)
	}
}
