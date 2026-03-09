package routes

import (
	"appointment-service/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.Engine, h *handlers.Handler) {
	router.GET("/health", h.Health)
	router.POST("/appointments", h.CreateAppointment)
	router.GET("/appointments", h.GetAppointments)
	router.DELETE("/appointments/:id", h.DeleteAppointment)
}
