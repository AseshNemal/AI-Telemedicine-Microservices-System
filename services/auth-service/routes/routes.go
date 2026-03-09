package routes

import (
	"auth-service/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.Engine, h *handlers.Handler) {
	router.GET("/health", h.Health)
	router.POST("/register", h.Register)
	router.POST("/login", h.Login)
	router.GET("/profile", h.Profile)
}
