package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"doctor-service/database"
	"doctor-service/middleware"
	"doctor-service/models"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// ── Shared helpers ────────────────────────────────────────────────────────────

// generateID builds a collision-resistant prefixed ID.
func generateID(prefix string) string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		b = make([]byte, 16)
	}
	return fmt.Sprintf("%s-%s-%s", prefix, time.Now().UTC().Format("20060102-1504"), hex.EncodeToString(b))
}

// dbReady verifies the database is actually reachable (not just the stale Connected flag).
func dbReady(db *database.Client) bool {
	return db != nil && db.IsConnected()
}

// callerUID extracts the authenticated user's UID from the Gin context.
func callerUID(c *gin.Context) string {
	uid, _ := c.Get(middleware.CtxUID)
	return fmt.Sprint(uid)
}

// svcURL resolves a service URL from an env var, falling back to the default.
func svcURL(envKey, fallback string) string {
	if v := os.Getenv(envKey); v != "" {
		switch {
		case strings.Contains(v, "appointment-service"):
			return "http://localhost:8083"
		case strings.Contains(v, "patient-service"):
			return "http://localhost:5002"
		case strings.Contains(v, "telemedicine-service"):
			return "http://localhost:8086"
		case strings.Contains(v, "notification-service"):
			return "http://localhost:8084"
		default:
			return v
		}
	}
	switch fallback {
	case "http://appointment-service:8081":
		return "http://localhost:8083"
	case "http://patient-service:8083":
		return "http://localhost:5002"
	case "http://telemedicine-service:8086":
		return "http://localhost:8086"
	case "http://notification-service:8084":
		return "http://localhost:8084"
	default:
		return fallback
	}
}

// outboundJSON performs an HTTP request with a JSON body and returns the status,
// response body, and any transport-level error. The provided context controls
// cancellation / timeout.
func outboundJSON(ctx context.Context, method, url string, payload interface{}, headers map[string]string) (int, []byte, error) {
	var body io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return 0, nil, err
		}
		body = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, respBody, nil
}

// fireNotification sends a best-effort notification via the notification-service.
func fireNotification(payload map[string]interface{}) {
	notifURL := svcURL("NOTIFICATION_SERVICE_URL", "http://notification-service:8084")
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _, err := outboundJSON(ctx, http.MethodPost, notifURL+"/notifications", payload, nil)
		if err != nil {
			log.Printf("[doctor-service] notification fire-and-forget failed: %v", err)
		}
	}()
}

// fetchDoctorByFirebaseUID finds a doctor by their Firebase UID.
func (h *Handler) fetchDoctorByFirebaseUID(ctx context.Context, firebaseUID string) (models.Doctor, error) {
	var doc models.Doctor
	err := h.db.DB.Collection("doctors").FindOne(ctx, bson.M{"firebase_uid": firebaseUID}).Decode(&doc)
	return doc, err
}

// ── CRUD handlers that were referenced in routes but missing from the main file ─

// Health is the liveness/readiness probe.
func (h *Handler) Health(c *gin.Context) {
	status := "ok"
	if !dbReady(h.db) {
		status = "degraded"
	}
	c.JSON(http.StatusOK, gin.H{"status": status, "service": "doctor-service"})
}

// RegisterDoctor creates a new doctor profile (POST /doctors).
func (h *Handler) RegisterDoctor(c *gin.Context) {
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	var req models.RegisterDoctorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	firebaseUID := callerUID(c)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Prevent duplicate registration.
	var existing models.Doctor
	err := h.db.DB.Collection("doctors").FindOne(ctx, bson.M{"firebase_uid": firebaseUID}).Decode(&existing)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "doctor profile already exists", "doctor_id": existing.ID})
		return
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check existing profile"})
		return
	}

	now := time.Now().UTC()
	doc := models.Doctor{
		ID:                   generateID("DOC"),
		FirebaseUID:          firebaseUID,
		Name:                 req.Name,
		Specialty:            req.Specialty,
		ExperienceYears:      req.ExperienceYears,
		ConsultationFeeCents: req.ConsultationFeeCents,
		VerificationStatus:   models.StatusPending,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if _, err := h.db.DB.Collection("doctors").InsertOne(ctx, doc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create doctor profile"})
		return
	}
	c.JSON(http.StatusCreated, doc)
}

// UpdateDoctor updates an existing doctor profile (PUT /doctors/:id).
func (h *Handler) UpdateDoctor(c *gin.Context) {
	id := c.Param("id")
	if id == "" || len(id) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid doctor id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	var req models.UpdateDoctorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	firebaseUID := callerUID(c)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existing models.Doctor
	if err := h.db.DB.Collection("doctors").FindOne(ctx, bson.M{"id": id}).Decode(&existing); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "doctor not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor"})
		return
	}
	if existing.FirebaseUID != firebaseUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "you do not own this profile"})
		return
	}

	update := bson.M{"updated_at": time.Now().UTC()}
	if req.Name != nil {
		update["name"] = *req.Name
	}
	if req.Specialty != nil {
		update["specialty"] = *req.Specialty
	}
	if req.ExperienceYears != nil {
		update["experience_years"] = *req.ExperienceYears
	}
	if req.ConsultationFeeCents != nil {
		update["consultation_fee_cents"] = *req.ConsultationFeeCents
	}

	if _, err := h.db.DB.Collection("doctors").UpdateOne(ctx, bson.M{"id": id}, bson.M{"$set": update}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update doctor profile"})
		return
	}

	var updated models.Doctor
	_ = h.db.DB.Collection("doctors").FindOne(ctx, bson.M{"id": id}).Decode(&updated)
	c.JSON(http.StatusOK, updated)
}
