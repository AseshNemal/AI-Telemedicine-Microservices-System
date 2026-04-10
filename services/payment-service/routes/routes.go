package routes

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"payment-service/handlers"

	"github.com/gin-gonic/gin"
)

// requireInternalKey is middleware that validates the X-Internal-Service-Key header
// for service-to-service calls (C-4).
func requireInternalKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		configuredKey := strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_KEY"))
		providedKey := strings.TrimSpace(c.GetHeader("X-Internal-Service-Key"))
		if configuredKey == "" || providedKey == "" || providedKey != configuredKey {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}

// requireBearerOrInternalKey allows requests that have either a valid bearer token
// forwarded through the gateway, or the internal service key. This is used for
// endpoints that may be called by both users (through the gateway) and internal services.
func requireBearerOrInternalKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check internal key first (service-to-service).
		configuredKey := strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_KEY"))
		providedKey := strings.TrimSpace(c.GetHeader("X-Internal-Service-Key"))
		if configuredKey != "" && providedKey != "" && providedKey == configuredKey {
			c.Next()
			return
		}
		// Check Bearer token presence (validation happens at the gateway/auth-service level).
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") && len(authHeader) > 10 {
			c.Next()
			return
		}
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"error": fmt.Sprintf("unauthorized: provide Authorization header or X-Internal-Service-Key"),
		})
	}
}

// RegisterRoutes registers all payment service routes
func RegisterRoutes(r *gin.Engine, h *handlers.Handler) {
	// Stripe webhook — verified by Stripe signature, NOT by our auth (C-5).
	r.POST("/webhook", h.HandleWebhook)

	// Internal service-to-service endpoints — require INTERNAL_SERVICE_KEY (C-4).
	internal := r.Group("/")
	internal.Use(requireInternalKey())
	{
		internal.POST("/payments/:transactionId/refund", h.RefundPayment)
		internal.DELETE("/payments/:transactionId", h.CancelPayment)
	}

	// User-facing and shared service endpoints — require either Bearer token or internal key (C-4).
	authed := r.Group("/")
	authed.Use(requireBearerOrInternalKey())
	{
		authed.POST("/payments", h.CreatePayment)
		authed.GET("/payments/:transactionId", h.GetPayment)
		authed.GET("/payments/verify", h.VerifyPaymentNoWebhook)
		authed.GET("/patients/:patientId/payments", h.GetPaymentsByPatient)
	}
}
