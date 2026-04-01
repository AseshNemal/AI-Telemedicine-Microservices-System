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
	neturl "net/url"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// timeSlotRegexp matches HH:MM.
var timeSlotRegexp = regexp.MustCompile(`^\d{2}:\d{2}$`)

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	db *database.Client
}

// NewHandler returns a ready-to-use Handler.
func NewHandler(db *database.Client) *Handler {
	return &Handler{db: db}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func dbReady(db *database.Client) bool {
	return db != nil && db.IsConnected()
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		b = make([]byte, 8)
	}
	return fmt.Sprintf("%s-%s-%s", prefix, time.Now().UTC().Format("20060102-1504"), hex.EncodeToString(b))
}

func callerUID(c *gin.Context) string {
	uid, _ := c.Get(middleware.CtxUID)
	return fmt.Sprint(uid)
}

// serviceURL resolves a downstream service base URL from env with a fallback.
func svcURL(envKey, fallback string) string {
	if v := os.Getenv(envKey); v != "" {
		return v
	}
	return fallback
}

// outboundJSON performs an outbound HTTP call with a 5-second context timeout.
// Returns status code, response body bytes, and any transport error.
func outboundJSON(ctx context.Context, method, url string, body interface{}, extraHeaders map[string]string) (int, []byte, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, nil, fmt.Errorf("marshal request: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(reqCtx, method, url, bodyReader)
	if err != nil {
		return 0, nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	return resp.StatusCode, respBody, err
}

// fireNotification sends a notification event fire-and-forget in a goroutine.
// Errors are only logged — never propagated to the caller.
func fireNotification(payload map[string]interface{}) {
	go func() {
		notifURL := svcURL("NOTIFICATION_SERVICE_URL", "http://notification-service:8084")
		ctx := context.Background()
		status, _, err := outboundJSON(ctx, http.MethodPost, notifURL+"/notifications", payload, nil)
		if err != nil {
			log.Printf("[doctor-service] notification fire failed: %v", err)
			return
		}
		if status >= 300 {
			log.Printf("[doctor-service] notification service returned %d", status)
		}
	}()
}

// fetchDoctorByFirebaseUID looks up a doctor record by the caller's firebase_uid.
func (h *Handler) fetchDoctorByFirebaseUID(ctx context.Context, uid string) (models.Doctor, error) {
	var doc models.Doctor
	err := h.db.DB.Collection("doctors").FindOne(ctx, bson.M{"firebase_uid": uid}).Decode(&doc)
	return doc, err
}

// ── Health ────────────────────────────────────────────────────────────────────

func (h *Handler) Health(c *gin.Context) {
	if !dbReady(h.db) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"service": "doctor-service", "status": "DEGRADED", "database": "disconnected"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"service": "doctor-service", "status": "OK"})
}

// ── POST /doctors — register new doctor ─────────────────────────────────────

func (h *Handler) RegisterDoctor(c *gin.Context) {
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	firebaseUID := callerUID(c)
	if firebaseUID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing caller identity"})
		return
	}

	var req models.RegisterDoctorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}
	if len(req.Name) > 150 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name must not exceed 150 characters"})
		return
	}
	if len(req.Specialty) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "specialty must not exceed 100 characters"})
		return
	}
	if req.ExperienceYears < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "experience_years must be non-negative"})
		return
	}
	if req.ConsultationFeeCents < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "consultation_fee_cents must be non-negative"})
		return
	}

	now := time.Now().UTC()
	doc := models.Doctor{
		ID:                   firebaseUID,
		FirebaseUID:          firebaseUID,
		Name:                 req.Name,
		Specialty:            req.Specialty,
		ExperienceYears:      req.ExperienceYears,
		ConsultationFeeCents: req.ConsultationFeeCents,
		VerificationStatus:   models.StatusPending,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := h.db.DB.Collection("doctors").InsertOne(ctx, doc); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "a doctor profile already exists for this account"})
			return
		}
		log.Printf("[doctor-service] mongo insert failed for doctor %s: %v", firebaseUID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register doctor"})
		return
	}
	c.JSON(http.StatusCreated, doc)
}

// ── PUT /doctors/:id — update profile (owner only) ───────────────────────────

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

	var req models.UpdateDoctorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	setFields := bson.M{"updated_at": time.Now().UTC()}
	if req.Name != nil {
		if len(*req.Name) == 0 || len(*req.Name) > 150 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name must be 1–150 characters"})
			return
		}
		setFields["name"] = *req.Name
	}
	if req.Specialty != nil {
		if len(*req.Specialty) == 0 || len(*req.Specialty) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "specialty must be 1–100 characters"})
			return
		}
		setFields["specialty"] = *req.Specialty
	}
	if req.ExperienceYears != nil {
		if *req.ExperienceYears < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "experience_years must be non-negative"})
			return
		}
		setFields["experience_years"] = *req.ExperienceYears
	}
	if req.ConsultationFeeCents != nil {
		if *req.ConsultationFeeCents < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "consultation_fee_cents must be non-negative"})
			return
		}
		setFields["consultation_fee_cents"] = *req.ConsultationFeeCents
	}
	if len(setFields) == 1 { // only updated_at — nothing to do
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields provided to update"})
		return
	}

	after := options.After
	opts := options.FindOneAndUpdate().SetReturnDocument(after)
	upCtx, upCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer upCancel()
	var updated models.Doctor
	if err := h.db.DB.Collection("doctors").FindOneAndUpdate(upCtx,
		bson.M{"id": id},
		bson.M{"$set": setFields},
		opts,
	).Decode(&updated); err != nil {
		log.Printf("[doctor-service] FindOneAndUpdate failed for doctor %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update doctor"})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// ── GET /doctors/:id — public read (403 if not VERIFIED) ─────────────────────

func (h *Handler) GetDoctorByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" || len(id) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid doctor id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var doc models.Doctor
	if err := h.db.DB.Collection("doctors").FindOne(ctx, bson.M{"id": id}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "doctor not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor"})
		return
	}
	if doc.VerificationStatus != models.StatusVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "doctor profile is not available"})
		return
	}
	c.JSON(http.StatusOK, doc)
}

// ── GET /doctors — paginated list of VERIFIED doctors ────────────────────────

func (h *Handler) GetDoctors(c *gin.Context) {
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	filter := bson.M{"verification_status": models.StatusVerified}
	if specialty := c.Query("specialty"); specialty != "" {
		filter["specialty"] = bson.M{"$regex": regexp.QuoteMeta(specialty), "$options": "i"}
	}

	page, limit := 1, 50
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			if v > 100 {
				v = 100
			}
			limit = v
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := h.db.DB.Collection("doctors").Find(ctx, filter,
		options.Find().
			SetSort(bson.D{{Key: "name", Value: 1}}).
			SetSkip(int64((page-1)*limit)).
			SetLimit(int64(limit)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query doctors"})
		return
	}
	var docs []models.Doctor
	if err = cursor.All(ctx, &docs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read doctors"})
		return
	}
	if docs == nil {
		docs = []models.Doctor{}
	}
	c.JSON(http.StatusOK, docs)
}

// ── GET /doctors/:id/availability — public read (403 if not VERIFIED) ────────

func (h *Handler) GetAvailability(c *gin.Context) {
	id := c.Param("id")
	if id == "" || len(id) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid doctor id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var doc models.Doctor
	if err := h.db.DB.Collection("doctors").FindOne(ctx, bson.M{"id": id}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "doctor not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor"})
		return
	}
	if doc.VerificationStatus != models.StatusVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "doctor is not available"})
		return
	}

	avCtx, avCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer avCancel()
	cursor, err := h.db.DB.Collection("availability").Find(avCtx, bson.M{"doctor_id": id})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch availability"})
		return
	}
	var slots []models.Availability
	if err = cursor.All(avCtx, &slots); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read availability"})
		return
	}
	if slots == nil {
		slots = []models.Availability{}
	}
	c.JSON(http.StatusOK, slots)
}

// ── PUT /doctors/:id/availability — replace weekly schedule (owner only) ──────

func (h *Handler) SetAvailability(c *gin.Context) {
	id := c.Param("id")
	if id == "" || len(id) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid doctor id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
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
	if existing.VerificationStatus != models.StatusVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "only verified doctors can set availability"})
		return
	}

	var slots []models.AvailabilitySlot
	if err := c.ShouldBindJSON(&slots); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}
	seenDays := map[int]bool{}
	for _, s := range slots {
		if s.DayOfWeek < 0 || s.DayOfWeek > 6 {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("day_of_week must be 0–6, got %d", s.DayOfWeek)})
			return
		}
		if seenDays[s.DayOfWeek] {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("duplicate day_of_week: %d", s.DayOfWeek)})
			return
		}
		seenDays[s.DayOfWeek] = true
		if !timeSlotRegexp.MatchString(s.StartTime) || !timeSlotRegexp.MatchString(s.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "start_time and end_time must be HH:MM"})
			return
		}
		if s.StartTime >= s.EndTime {
			c.JSON(http.StatusBadRequest, gin.H{"error": "start_time must be before end_time"})
			return
		}
	}

	// Transactional replace: delete all existing slots then insert the new set.
	session, err := h.db.MongoClient.StartSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start session"})
		return
	}
	defer session.EndSession(context.Background())

	_, txErr := session.WithTransaction(context.Background(), func(sCtx mongo.SessionContext) (interface{}, error) {
		if _, err := h.db.DB.Collection("availability").DeleteMany(sCtx, bson.M{"doctor_id": id}); err != nil {
			return nil, err
		}
		if len(slots) == 0 {
			return nil, nil
		}
		docs := make([]interface{}, 0, len(slots))
		for _, s := range slots {
			docs = append(docs, models.Availability{
				ID:        generateID("AV"),
				DoctorID:  id,
				DayOfWeek: s.DayOfWeek,
				StartTime: s.StartTime,
				EndTime:   s.EndTime,
			})
		}
		_, insErr := h.db.DB.Collection("availability").InsertMany(sCtx, docs)
		return nil, insErr
	})
	if txErr != nil {
		log.Printf("[doctor-service] availability transaction failed for doctor %s: %v", id, txErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update availability"})
		return
	}

	avCtx, avCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer avCancel()
	cursor, _ := h.db.DB.Collection("availability").Find(avCtx, bson.M{"doctor_id": id})
	var result []models.Availability
	_ = cursor.All(avCtx, &result)
	if result == nil {
		result = []models.Availability{}
	}
	c.JSON(http.StatusOK, result)
}

// ── GET /admin/doctors — list all doctors, filterable by status ──────────────

func (h *Handler) AdminListDoctors(c *gin.Context) {
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	filter := bson.M{}
	if vs := c.Query("verification_status"); vs != "" {
		filter["verification_status"] = vs
	}

	page, limit := 1, 50
	if p, _ := strconv.Atoi(c.Query("page")); p > 0 {
		page = p
	}
	if l, _ := strconv.Atoi(c.Query("limit")); l > 0 && l <= 100 {
		limit = l
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := h.db.DB.Collection("doctors").Find(ctx, filter,
		options.Find().
			SetSort(bson.D{{Key: "created_at", Value: -1}}).
			SetSkip(int64((page-1)*limit)).
			SetLimit(int64(limit)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query doctors"})
		return
	}
	var docs []models.Doctor
	if err = cursor.All(ctx, &docs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read doctors"})
		return
	}
	if docs == nil {
		docs = []models.Doctor{}
	}
	c.JSON(http.StatusOK, docs)
}

// ── PUT /admin/doctors/:id/verify ────────────────────────────────────────────

func (h *Handler) AdminVerifyDoctor(c *gin.Context) {
	h.adminSetStatus(c, models.StatusVerified)
}

// ── PUT /admin/doctors/:id/suspend ───────────────────────────────────────────

func (h *Handler) AdminSuspendDoctor(c *gin.Context) {
	h.adminSetStatus(c, models.StatusSuspended)
}

func (h *Handler) adminSetStatus(c *gin.Context, status models.VerificationStatus) {
	id := c.Param("id")
	if id == "" || len(id) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid doctor id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Fetch current state to enforce state guards.
	var current models.Doctor
	if err := h.db.DB.Collection("doctors").FindOne(ctx, bson.M{"id": id}).Decode(&current); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "doctor not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor"})
		return
	}
	if current.VerificationStatus == status {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("doctor is already %s", status)})
		return
	}

	after := options.After
	opts := options.FindOneAndUpdate().SetReturnDocument(after)

	var updated models.Doctor
	err := h.db.DB.Collection("doctors").FindOneAndUpdate(ctx,
		bson.M{"id": id},
		bson.M{"$set": bson.M{
			"verification_status": status,
			"updated_at":          time.Now().UTC(),
		}},
		opts,
	).Decode(&updated)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "doctor not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update doctor status"})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// ── GET /doctor/appointments — proxied from Appointment Service ───────────────

func (h *Handler) GetMyAppointments(c *gin.Context) {
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	firebaseUID := callerUID(c)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := h.fetchDoctorByFirebaseUID(ctx, firebaseUID); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "doctor profile not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor profile"})
		return
	}

	apptURL := svcURL("APPOINTMENT_SERVICE_URL", "http://appointment-service:8081")
	proxyURL := fmt.Sprintf("%s/appointments/my", apptURL)
	if status := c.Query("status"); status != "" {
		proxyURL += "?status=" + neturl.QueryEscape(status)
	}

	authHeader := c.GetHeader("Authorization")
	statusCode, body, callErr := outboundJSON(c.Request.Context(), http.MethodGet, proxyURL, nil,
		map[string]string{"Authorization": authHeader})
	if callErr != nil {
		log.Printf("[doctor-service] appointment service unreachable: %v", callErr)
		c.JSON(http.StatusBadGateway, gin.H{"error": "appointment service unavailable"})
		return
	}
	if statusCode >= 500 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "appointment service error"})
		return
	}

	var appointments []map[string]interface{}
	if err := json.Unmarshal(body, &appointments); err != nil {
		// Not a JSON array — proxy the raw response as-is
		c.Data(statusCode, "application/json", body)
		return
	}

	// Sort by date ASC, then time ASC
	sort.Slice(appointments, func(i, j int) bool {
		di, _ := appointments[i]["date"].(string)
		dj, _ := appointments[j]["date"].(string)
		if di != dj {
			return di < dj
		}
		ti, _ := appointments[i]["time"].(string)
		tj, _ := appointments[j]["time"].(string)
		return ti < tj
	})
	c.JSON(http.StatusOK, appointments)
}

// ── POST /doctor/appointments/:appointment_id/accept ─────────────────────────

func (h *Handler) AcceptAppointment(c *gin.Context) {
	h.acceptOrReject(c, "BOOKED")
}

// ── POST /doctor/appointments/:appointment_id/reject ─────────────────────────

func (h *Handler) RejectAppointment(c *gin.Context) {
	h.acceptOrReject(c, "REJECTED")
}

func (h *Handler) acceptOrReject(c *gin.Context, newStatus string) {
	appointmentID := c.Param("appointment_id")
	if appointmentID == "" || len(appointmentID) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	var req models.AcceptRejectRequest
	_ = c.ShouldBindJSON(&req) // reason is optional

	firebaseUID := callerUID(c)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	doctor, err := h.fetchDoctorByFirebaseUID(ctx, firebaseUID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "doctor profile not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor profile"})
		return
	}
	if doctor.VerificationStatus != models.StatusVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "only verified doctors can manage appointments"})
		return
	}

	// Fetch appointment from Appointment Service
	apptURL := svcURL("APPOINTMENT_SERVICE_URL", "http://appointment-service:8081")
	authHeader := c.GetHeader("Authorization")
	statusCode, body, callErr := outboundJSON(c.Request.Context(), http.MethodGet,
		fmt.Sprintf("%s/appointments/%s", apptURL, appointmentID),
		nil, map[string]string{"Authorization": authHeader})
	if callErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "appointment service unavailable"})
		return
	}
	if statusCode == http.StatusNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	if statusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to fetch appointment"})
		return
	}

	var appt map[string]interface{}
	if err := json.Unmarshal(body, &appt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid appointment response"})
		return
	}

	// Ownership check
	apptDoctorID, _ := appt["doctorId"].(string)
	if apptDoctorID != doctor.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "this appointment does not belong to you"})
		return
	}

	// Only CONFIRMED appointments (payment done, awaiting doctor) can be accepted or rejected.
	apptStatus, _ := appt["status"].(string)
	if apptStatus != "CONFIRMED" {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("cannot accept or reject appointment with status %s; appointment must be CONFIRMED (payment completed)", apptStatus)})
		return
	}

	// Past appointment guard
	dateStr, _ := appt["date"].(string)
	timeStr, _ := appt["time"].(string)
	if dateStr != "" && timeStr != "" {
		scheduled, parseErr := time.ParseInLocation("2006-01-02 15:04", dateStr+" "+timeStr, time.UTC)
		if parseErr == nil && scheduled.Before(time.Now().UTC()) {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "cannot act on a past appointment"})
			return
		}
	}

	// Patch appointment status via Appointment Service
	patchBody := map[string]interface{}{"status": newStatus}
	if req.Reason != "" {
		patchBody["reason"] = req.Reason
	}
	patchStatus, _, patchErr := outboundJSON(c.Request.Context(), http.MethodPut,
		fmt.Sprintf("%s/appointments/%s/status", apptURL, appointmentID),
		patchBody, map[string]string{"Authorization": authHeader})
	if patchErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "appointment service unavailable"})
		return
	}
	if patchStatus == http.StatusConflict {
		c.JSON(http.StatusConflict, gin.H{"error": "appointment status already finalized"})
		return
	}
	if patchStatus == http.StatusNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	if patchStatus >= 300 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to update appointment status"})
		return
	}

	patientID, _ := appt["patientId"].(string)
	if newStatus == "BOOKED" {
		fireNotification(map[string]interface{}{
			"type": "APPOINTMENT_BOOKED", "appointment_id": appointmentID, "patient_id": patientID,
		})
	} else {
		fireNotification(map[string]interface{}{
			"type": "APPOINTMENT_REJECTED", "appointment_id": appointmentID, "patient_id": patientID, "reason": req.Reason,
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("appointment %s", strings.ToLower(newStatus))})
}

// ── POST /doctor/appointments/:appointment_id/prescription ───────────────────

func (h *Handler) WritePrescription(c *gin.Context) {
	appointmentID := c.Param("appointment_id")
	if appointmentID == "" || len(appointmentID) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	firebaseUID := callerUID(c)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	doctor, err := h.fetchDoctorByFirebaseUID(ctx, firebaseUID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "doctor profile not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor profile"})
		return
	}

	var req models.PrescriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}
	if len(req.Notes) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "notes must not exceed 5000 characters"})
		return
	}
	if len(req.PrescriptionText) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prescription_text must not exceed 5000 characters"})
		return
	}
	if len(req.Medications) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "medications list must not exceed 50 items"})
		return
	}

	findCtx, findCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer findCancel()
	var consultation models.Consultation
	if err := h.db.DB.Collection("consultations").FindOne(findCtx, bson.M{
		"appointment_id": appointmentID,
		"doctor_id":      doctor.ID,
	}).Decode(&consultation); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "consultation not found for this appointment"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch consultation"})
		return
	}

	if consultation.Status == models.ConsultationCompleted {
		c.JSON(http.StatusConflict, gin.H{"error": "consultation is completed; prescription is read-only"})
		return
	}
	if consultation.Status != models.ConsultationActive {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "prescription can only be written during an active consultation"})
		return
	}

	medications := req.Medications
	if medications == nil {
		medications = []models.Medication{}
	}

	after := options.After
	opts := options.FindOneAndUpdate().SetReturnDocument(after)
	upCtx, upCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer upCancel()
	var updated models.Consultation
	if err := h.db.DB.Collection("consultations").FindOneAndUpdate(upCtx,
		bson.M{"appointment_id": appointmentID, "doctor_id": doctor.ID},
		bson.M{"$set": bson.M{
			"notes":        req.Notes,
			"prescription": req.PrescriptionText,
			"medications":  medications,
			"updated_at":   time.Now().UTC(),
		}},
		opts,
	).Decode(&updated); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update prescription"})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// ── GET /doctor/appointments/:appointment_id/prescription — doctor auth ───────

func (h *Handler) GetMyPrescription(c *gin.Context) {
	appointmentID := c.Param("appointment_id")
	if appointmentID == "" || len(appointmentID) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	firebaseUID := callerUID(c)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	doctor, err := h.fetchDoctorByFirebaseUID(ctx, firebaseUID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "doctor profile not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor profile"})
		return
	}

	findCtx, findCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer findCancel()
	var consultation models.Consultation
	if err := h.db.DB.Collection("consultations").FindOne(findCtx, bson.M{
		"appointment_id": appointmentID,
		"doctor_id":      doctor.ID,
	}).Decode(&consultation); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "consultation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch consultation"})
		return
	}
	c.JSON(http.StatusOK, consultation)
}

// ── GET /appointments/:appointment_id/prescription — authenticated shared ─────

func (h *Handler) GetPrescriptionShared(c *gin.Context) {
	appointmentID := c.Param("appointment_id")
	if appointmentID == "" || len(appointmentID) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var consultation models.Consultation
	if err := h.db.DB.Collection("consultations").FindOne(ctx, bson.M{"appointment_id": appointmentID}).Decode(&consultation); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "prescription not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch prescription"})
		return
	}

	// Verify the caller is either the doctor or the patient of this consultation.
	uid := callerUID(c)
	role, _ := c.Get(middleware.CtxRole)
	callerRoleStr := fmt.Sprint(role)

	if callerRoleStr == "DOCTOR" && consultation.DoctorID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not the doctor for this consultation"})
		return
	}
	if callerRoleStr == "PATIENT" && consultation.PatientID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not the patient for this consultation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"appointment_id": consultation.AppointmentID,
		"notes":          consultation.Notes,
		"prescription":   consultation.Prescription,
		"medications":    consultation.Medications,
	})
}

// ── GET /doctor/appointments/:appointment_id/patient-reports ─────────────────

func (h *Handler) GetPatientReports(c *gin.Context) {
	appointmentID := c.Param("appointment_id")
	if appointmentID == "" || len(appointmentID) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	firebaseUID := callerUID(c)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	doctor, err := h.fetchDoctorByFirebaseUID(ctx, firebaseUID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "doctor profile not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor profile"})
		return
	}

	// Fetch appointment to validate ownership
	apptURL := svcURL("APPOINTMENT_SERVICE_URL", "http://appointment-service:8081")
	authHeader := c.GetHeader("Authorization")
	statusCode, body, callErr := outboundJSON(c.Request.Context(), http.MethodGet,
		fmt.Sprintf("%s/appointments/%s", apptURL, appointmentID),
		nil, map[string]string{"Authorization": authHeader})
	if callErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "appointment service unavailable"})
		return
	}
	if statusCode == http.StatusNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	if statusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to fetch appointment"})
		return
	}

	var appt map[string]interface{}
	if err := json.Unmarshal(body, &appt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid appointment response"})
		return
	}

	// Strict ownership: appointment.doctorId must match the authenticated doctor
	apptDoctorID, _ := appt["doctorId"].(string)
	if apptDoctorID != doctor.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "this appointment does not belong to you"})
		return
	}

	patientID, _ := appt["patientId"].(string)

	// Proxy to Patient Service with internal secret
	patientURL := svcURL("PATIENT_SERVICE_URL", "http://patient-service:8083")
	internalSecret := os.Getenv("INTERNAL_SERVICE_SECRET")
	rStatus, rBody, rErr := outboundJSON(c.Request.Context(), http.MethodGet,
		fmt.Sprintf("%s/patients/%s/reports", patientURL, patientID),
		nil, map[string]string{"Authorization": "Bearer " + internalSecret})
	if rErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "patient service unavailable"})
		return
	}
	c.Data(rStatus, "application/json", rBody)
}

// ── POST /doctor/appointments/:appointment_id/consultation/start ──────────────

func (h *Handler) StartConsultation(c *gin.Context) {
	appointmentID := c.Param("appointment_id")
	if appointmentID == "" || len(appointmentID) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	firebaseUID := callerUID(c)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	doctor, err := h.fetchDoctorByFirebaseUID(ctx, firebaseUID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "doctor profile not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor profile"})
		return
	}
	if doctor.VerificationStatus != models.StatusVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "only verified doctors can start consultations"})
		return
	}

	// Fetch appointment from Appointment Service
	apptURL := svcURL("APPOINTMENT_SERVICE_URL", "http://appointment-service:8081")
	authHeader := c.GetHeader("Authorization")
	statusCode, body, callErr := outboundJSON(c.Request.Context(), http.MethodGet,
		fmt.Sprintf("%s/appointments/%s", apptURL, appointmentID),
		nil, map[string]string{"Authorization": authHeader})
	if callErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "appointment service unavailable"})
		return
	}
	if statusCode == http.StatusNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	if statusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to fetch appointment"})
		return
	}

	var appt map[string]interface{}
	if err := json.Unmarshal(body, &appt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid appointment response"})
		return
	}

	apptDoctorID, _ := appt["doctorId"].(string)
	if apptDoctorID != doctor.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "this appointment does not belong to you"})
		return
	}

	apptStatus, _ := appt["status"].(string)
	if apptStatus != "BOOKED" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "appointment must be BOOKED (doctor-accepted) before starting a consultation"})
		return
	}

	// 15-minute early-start guard
	dateStr, _ := appt["date"].(string)
	timeStr, _ := appt["time"].(string)
	if dateStr != "" && timeStr != "" {
		scheduled, parseErr := time.ParseInLocation("2006-01-02 15:04", dateStr+" "+timeStr, time.UTC)
		if parseErr == nil && time.Until(scheduled) > 15*time.Minute {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "cannot start consultation more than 15 minutes before scheduled time"})
			return
		}
	}

	patientID, _ := appt["patientId"].(string)

	// Call Telemedicine Service — if it fails, do NOT persist consultation row
	teleURL := svcURL("TELEMEDICINE_SERVICE_URL", "http://telemedicine-service:8086")
	tStatus, tBody, tErr := outboundJSON(c.Request.Context(), http.MethodPost,
		teleURL+"/sessions",
		map[string]interface{}{
			"appointment_id": appointmentID,
			"doctor_id":      doctor.ID,
			"patient_id":     patientID,
		},
		map[string]string{"Authorization": authHeader})
	if tErr != nil || tStatus >= 300 {
		if tErr != nil {
			log.Printf("[doctor-service] telemedicine service error: %v", tErr)
		} else {
			log.Printf("[doctor-service] telemedicine service returned %d: %s", tStatus, string(tBody))
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "telemedicine service failed; consultation not started"})
		return
	}

	var teleResp struct {
		SessionID   string `json:"session_id"`
		MeetingLink string `json:"meeting_link"`
	}
	if err := json.Unmarshal(tBody, &teleResp); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "invalid telemedicine service response"})
		return
	}

	now := time.Now().UTC()
	consultation := models.Consultation{
		ID:            generateID("CON"),
		AppointmentID: appointmentID,
		DoctorID:      doctor.ID,
		PatientID:     patientID,
		SessionID:     teleResp.SessionID,
		MeetingLink:   teleResp.MeetingLink,
		Medications:   []models.Medication{},
		Status:        models.ConsultationActive,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	insCtx, insCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer insCancel()
	if _, insErr := h.db.DB.Collection("consultations").InsertOne(insCtx, consultation); insErr != nil {
		if mongo.IsDuplicateKeyError(insErr) {
			c.JSON(http.StatusConflict, gin.H{"error": "consultation already exists for this appointment"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist consultation"})
		return
	}

	fireNotification(map[string]interface{}{
		"type":           "CONSULTATION_STARTED",
		"appointment_id": appointmentID,
		"meeting_link":   teleResp.MeetingLink,
		"patient_id":     patientID,
	})

	c.JSON(http.StatusCreated, consultation)
}

// ── POST /doctor/appointments/:appointment_id/consultation/end ────────────────

func (h *Handler) EndConsultation(c *gin.Context) {
	appointmentID := c.Param("appointment_id")
	if appointmentID == "" || len(appointmentID) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	firebaseUID := callerUID(c)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	doctor, err := h.fetchDoctorByFirebaseUID(ctx, firebaseUID)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "doctor profile not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doctor profile"})
		return
	}

	var req models.EndConsultationRequest
	_ = c.ShouldBindJSON(&req)

	if len(req.Notes) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "notes must not exceed 5000 characters"})
		return
	}
	if len(req.Prescription) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prescription must not exceed 5000 characters"})
		return
	}
	if len(req.Medications) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "medications list must not exceed 50 items"})
		return
	}

	// FindOneAndUpdate with status guard in the filter to prevent double-end race
	after := options.After
	opts := options.FindOneAndUpdate().SetReturnDocument(after)
	medications := req.Medications
	if medications == nil {
		medications = []models.Medication{}
	}

	upCtx, upCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer upCancel()
	var updated models.Consultation
	if err := h.db.DB.Collection("consultations").FindOneAndUpdate(upCtx,
		bson.M{
			"appointment_id": appointmentID,
			"doctor_id":      doctor.ID,
			"status":         models.ConsultationActive, // atomic guard against race
		},
		bson.M{"$set": bson.M{
			"status":       models.ConsultationCompleted,
			"notes":        req.Notes,
			"prescription": req.Prescription,
			"medications":  medications,
			"updated_at":   time.Now().UTC(),
		}},
		opts,
	).Decode(&updated); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			// Could be: not found, wrong doctor, or already completed
			// Distinguish by looking up the doc without status filter
			checkCtx, checkCancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer checkCancel()
			var existing models.Consultation
			lookupErr := h.db.DB.Collection("consultations").FindOne(checkCtx, bson.M{
				"appointment_id": appointmentID,
				"doctor_id":      doctor.ID,
			}).Decode(&existing)
			if errors.Is(lookupErr, mongo.ErrNoDocuments) {
				c.JSON(http.StatusNotFound, gin.H{"error": "consultation not found for this appointment"})
				return
			}
			if existing.Status == models.ConsultationCompleted {
				c.JSON(http.StatusConflict, gin.H{"error": "consultation is already completed"})
				return
			}
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "consultation is not active"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to end consultation"})
		return
	}

	// Best-effort: mark appointment COMPLETED in Appointment Service
	apptURL := svcURL("APPOINTMENT_SERVICE_URL", "http://appointment-service:8081")
	authHeader := c.GetHeader("Authorization")
	pStatus, _, pErr := outboundJSON(c.Request.Context(), http.MethodPut,
		fmt.Sprintf("%s/appointments/%s/status", apptURL, appointmentID),
		map[string]interface{}{"status": "COMPLETED"},
		map[string]string{"Authorization": authHeader})
	if pErr != nil {
		log.Printf("[doctor-service] failed to update appointment status to COMPLETED: %v", pErr)
	} else if pStatus >= 300 {
		log.Printf("[doctor-service] appointment status update returned %d", pStatus)
	}

	fireNotification(map[string]interface{}{
		"type":           "CONSULTATION_COMPLETED",
		"appointment_id": appointmentID,
		"patient_id":     updated.PatientID,
	})

	c.JSON(http.StatusOK, updated)
}

// ── POST /check-availability — internal endpoint for Appointment Service ──────

func (h *Handler) CheckAvailability(c *gin.Context) {
	var req models.AvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.AvailabilityResponse{Available: false})
		return
	}
	if req.DoctorID == "" || len(req.DoctorID) > 128 {
		c.JSON(http.StatusBadRequest, models.AvailabilityResponse{Available: false})
		return
	}
	if !dbReady(h.db) {
		c.JSON(http.StatusOK, models.AvailabilityResponse{Available: false})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var doctor models.Doctor
	if err := h.db.DB.Collection("doctors").FindOne(ctx, bson.M{"id": req.DoctorID}).Decode(&doctor); err != nil {
		c.JSON(http.StatusOK, models.AvailabilityResponse{Available: false})
		return
	}
	if doctor.VerificationStatus != models.StatusVerified {
		c.JSON(http.StatusOK, models.AvailabilityResponse{Available: false})
		return
	}

	t, err := time.ParseInLocation("2006-01-02", req.Date, time.UTC)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.AvailabilityResponse{Available: false})
		return
	}
	dow := int(t.Weekday()) // 0=Sunday

	avCtx, avCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer avCancel()
	var slot models.Availability
	if err = h.db.DB.Collection("availability").FindOne(avCtx, bson.M{
		"doctor_id":   req.DoctorID,
		"day_of_week": dow,
	}).Decode(&slot); errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusOK, models.AvailabilityResponse{Available: false})
		return
	} else if err != nil {
		c.JSON(http.StatusOK, models.AvailabilityResponse{Available: false})
		return
	}

	available := req.Time >= slot.StartTime && req.Time < slot.EndTime
	c.JSON(http.StatusOK, models.AvailabilityResponse{Available: available})
}
