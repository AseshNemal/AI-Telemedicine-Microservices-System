package routes

import (
	"doctor-service/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.Engine, h *handlers.Handler) {
	router.GET("/health", h.Health)
	router.GET("/doctors", h.GetDoctors)
	router.POST("/doctor", h.CreateDoctor)
	router.GET("/doctor/:id", h.GetDoctorByID)
}
