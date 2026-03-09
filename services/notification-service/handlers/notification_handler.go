package handlers

import (
	"log"
	"net/http"
	"notification-service/models"

	"github.com/gin-gonic/gin"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) SendEmail(c *gin.Context) {
	var req models.NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}
	log.Printf("[notification-service][EMAIL] to=%s subject=%s message=%s", req.To, req.Subject, req.Message)
	c.JSON(http.StatusOK, gin.H{"message": "email notification logged"})
}

func (h *Handler) SendSMS(c *gin.Context) {
	var req models.NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}
	log.Printf("[notification-service][SMS] to=%s message=%s", req.To, req.Message)
	c.JSON(http.StatusOK, gin.H{"message": "sms notification logged"})
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"service": "notification-service", "status": "ok"})
}
