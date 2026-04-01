package middleware

import (
	"crypto/subtle"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// RequireInternalKey is a Gin middleware that validates the X-Internal-Key
// header against the INTERNAL_SERVICE_KEY environment variable using a
// constant-time comparison to prevent timing-based attacks.
//
// This protects service-to-service endpoints (e.g. POST /check-availability)
// from direct access by external clients. The shared secret must be configured
// identically in both the doctor-service and appointment-service deployments.
func RequireInternalKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		secret := os.Getenv("INTERNAL_SERVICE_KEY")
		if secret == "" {
			// Misconfigured environment — reject all requests rather than
			// silently allowing unauthenticated access.
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "internal service key not configured",
			})
			return
		}

		key := c.GetHeader("X-Internal-Key")
		// Use subtle.ConstantTimeCompare to prevent timing oracle attacks.
		if subtle.ConstantTimeCompare([]byte(key), []byte(secret)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or missing internal service key",
			})
			return
		}

		c.Next()
	}
}
