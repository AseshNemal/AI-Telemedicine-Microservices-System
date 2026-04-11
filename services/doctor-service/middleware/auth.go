package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
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

// ── Token identity cache ──────────────────────────────────────────────────────
// Caches successful auth-service verifications for cacheTTL to reduce latency
// and provide resilience when the auth-service is temporarily unavailable.

// m-6: Reduced from 60s to 10s so revoked tokens/role changes propagate faster.
const cacheTTL = 10 * time.Second

type cachedIdentity struct {
	uid    string
	role   string
	expiry time.Time
}

var identityCache sync.Map // key: string (SHA-256 of Authorization header), value: cachedIdentity

// tokenCacheKey returns a short opaque key derived from the Authorization header.
// We hash the full header so the raw token is never stored in memory.
func tokenCacheKey(authHeader string) string {
	h := sha256.Sum256([]byte(authHeader))
	return hex.EncodeToString(h[:])
}

// startCacheSweep launches a background goroutine that periodically evicts
// expired entries from identityCache to prevent unbounded memory growth.
// It runs every cacheTTL (60 s) so the maximum age of a dead entry is 2×cacheTTL.
func startCacheSweep() {
	go func() {
		ticker := time.NewTicker(cacheTTL)
		defer ticker.Stop()
		for range ticker.C {
			now := time.Now()
			identityCache.Range(func(key, value any) bool {
				if identity, ok := value.(cachedIdentity); ok && now.After(identity.expiry) {
					identityCache.Delete(key)
				}
				return true
			})
		}
	}()
}

func init() {
	authServiceURL = os.Getenv("AUTH_SERVICE_URL")
	if authServiceURL == "" {
		authServiceURL = "http://auth-service:3001"
	}
	log.Printf("[doctor-service] auth-service URL: %s", authServiceURL)
	startCacheSweep()
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
// Results are cached for cacheTTL to reduce auth-service load and provide
// short-term resilience against auth-service unavailability.
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

		// ── Cache lookup ──────────────────────────────────────────────────────
		cacheKey := tokenCacheKey(authHeader)
		if cached, ok := identityCache.Load(cacheKey); ok {
			identity := cached.(cachedIdentity)
			if time.Now().Before(identity.expiry) {
				c.Set(CtxUID, identity.uid)
				c.Set(CtxRole, identity.role)
				c.Next()
				return
			}
			identityCache.Delete(cacheKey) // evict expired entry
		}

		// Forward the token to the auth-service.
		req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet,
			authServiceURL+"/api/auth/me", nil)
		if err != nil {
			log.Printf("[doctor-service] could not build auth request: %v", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "auth service unavailable"})
			return
		}
		req.Header.Set("Authorization", authHeader)

		resp, err := authHTTPClient.Do(req)
		if err != nil {
			log.Printf("[doctor-service] auth-service unreachable: %v", err)
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
			log.Printf("[doctor-service] auth-service returned %d: %s", resp.StatusCode, string(body))
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

		// ── Cache store ───────────────────────────────────────────────────────
		identityCache.Store(cacheKey, cachedIdentity{
			uid:    me.Data.UID,
			role:   me.Data.Role,
			expiry: time.Now().Add(cacheTTL),
		})

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
