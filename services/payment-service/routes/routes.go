package routes

import (
	"payment-service/handlers"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers all payment service routes
func RegisterRoutes(r *gin.Engine, h *handlers.Handler) {
	// Payment endpoints
	r.POST("/payments", h.CreatePayment)
	r.GET("/payments/verify", h.VerifyPaymentNoWebhook)
	r.GET("/payments/:transactionId", h.GetPayment)
	r.GET("/patients/:patientId/payments", h.GetPaymentsByPatient)
	r.DELETE("/payments/:transactionId", h.CancelPayment)

	// Webhook endpoint (for payment provider callbacks)
	r.POST("/webhook", h.HandleWebhook)
}
