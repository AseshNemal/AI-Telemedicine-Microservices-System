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

// authServiceURLs is resolved once at startup from AUTH_SERVICE_URL.
// When not provided, local/dev and container-network fallbacks are tried.
var authServiceURLs []string

var authHTTPClient = &http.Client{Timeout: 5 * time.Second}

// ── Token identity cache ──────────────────────────────────────────────────────
// Caches successful auth-service verifications for cacheTTL to reduce latency
// and provide resilience when the auth-service is temporarily unavailable.

const cacheTTL = 60 * time.Second

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
// expired entries from identityCache to prevent unbounded memory growth (issue B4).
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
	envURL := strings.TrimSpace(os.Getenv("AUTH_SERVICE_URL"))
	if envURL != "" {
		authServiceURLs = []string{envURL}
	} else {
		// Local dev defaults first, then container/service-network fallbacks.
		authServiceURLs = []string{
			"http://localhost:8081",
			"http://127.0.0.1:8081",
			"http://auth-service:5001",
			"http://auth-service:3001",
		}
	}
	log.Printf("[appointment-service] auth-service URLs: %v", authServiceURLs)
	startCacheSweep()
}

func verifyTokenWithAuthService(ctx *gin.Context, authHeader string) (meResponse, error) {
	var lastErr error

	for _, baseURL := range authServiceURLs {
		req, err := http.NewRequestWithContext(ctx.Request.Context(), http.MethodGet,
			baseURL+"/api/auth/me", nil)
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("Authorization", authHeader)

		resp, err := authHTTPClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusUnauthorized {
			resp.Body.Close()
			return meResponse{}, fmt.Errorf("invalid or expired token")
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("auth-service returned %d: %s", resp.StatusCode, string(body))
			continue
		}

		var me meResponse
		if err := json.NewDecoder(resp.Body).Decode(&me); err != nil || !me.Success {
			resp.Body.Close()
			lastErr = fmt.Errorf("invalid auth-service response")
			continue
		}

		resp.Body.Close()

		return me, nil
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("auth-service unreachable")
	}

	return meResponse{}, lastErr
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

		me, err := verifyTokenWithAuthService(c, authHeader)
		if err != nil {
			log.Printf("[appointment-service] auth verification failed: %v", err)
			if strings.Contains(err.Error(), "invalid or expired token") {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
				return
			}
			if strings.Contains(err.Error(), "returned") || strings.Contains(err.Error(), "response") {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token verification failed"})
				return
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "could not reach auth service"})
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
