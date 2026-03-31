package middleware

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Context keys set by VerifyToken and read by handlers.
const (
	CtxUID  = "uid"
	CtxRole = "role"
)

// authServiceURL is resolved once at startup from AUTH_SERVICE_URL.
// Default matches the Kubernetes service name and port used by the auth-service-node.
var authServiceURL string

var authHTTPClient = &http.Client{Timeout: 5 * time.Second}

func init() {
	authServiceURL = os.Getenv("AUTH_SERVICE_URL")
	if authServiceURL == "" {
		authServiceURL = "http://auth-service:3001"
	}
	log.Printf("[appointment-service] auth-service URL: %s", authServiceURL)
}

// meResponse is the subset of the auth-service GET /api/auth/me response we care about.
type meResponse struct {
	Success bool `json:"success"`
	Data    struct {
		UID  string `json:"uid"`
		Role string `json:"role"`
	} `json:"data"`
}

// VerifyToken is a Gin middleware that delegates token verification to the
// auth-service-node by forwarding the Bearer token to GET /api/auth/me.
//
// On success it sets CtxUID and CtxRole in the Gin context so handlers can
// enforce ownership and role-based access without re-reading the token.
func VerifyToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "missing or malformed Authorization header; expected: Bearer <token>",
			})
			return
		}

		// Forward the token to the auth-service.
		req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet,
			authServiceURL+"/api/auth/me", nil)
		if err != nil {
			log.Printf("[appointment-service] could not build auth request: %v", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "auth service unavailable"})
			return
		}
		req.Header.Set("Authorization", authHeader)

		resp, err := authHTTPClient.Do(req)
		if err != nil {
			log.Printf("[appointment-service] auth-service unreachable: %v", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "could not reach auth service"})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusUnauthorized {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			log.Printf("[appointment-service] auth-service returned %d: %s", resp.StatusCode, string(body))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token verification failed"})
			return
		}

		var me meResponse
		if err := json.NewDecoder(resp.Body).Decode(&me); err != nil || !me.Success {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid auth-service response"})
			return
		}

		c.Set(CtxUID, me.Data.UID)
		c.Set(CtxRole, me.Data.Role)
		c.Next()
	}
}

// RequireRole returns middleware that aborts with HTTP 403 unless the caller's
// role (set by VerifyToken) is one of the allowed roles.
// Must be used after VerifyToken in the middleware chain.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(c *gin.Context) {
		roleVal, exists := c.Get(CtxRole)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "role not present in context"})
			return
		}

		role := fmt.Sprint(roleVal)
		if _, ok := allowed[role]; !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": fmt.Sprintf("insufficient permissions; required one of: %v", roles),
			})
			return
		}

		c.Next()
	}
}
