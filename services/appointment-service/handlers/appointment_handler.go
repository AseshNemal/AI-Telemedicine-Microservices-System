package handlers

import (
	"appointment-service/database"
	"appointment-service/middleware"
	"appointment-service/models"
	"appointment-service/services"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ── Role constants ──────────────────────────────────────────────────────────────
const (
	rolePatient = "PATIENT"
	roleDoctor  = "DOCTOR"
	roleAdmin   = "ADMIN"
)

// maxPendingBookings is the maximum number of PENDING_PAYMENT appointments a
// single patient may hold simultaneously (slot-exhaustion guard, issue #16).
const maxPendingBookings = 3

// emailRegexp is a basic RFC5322-ish email format check.
var emailRegexp = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
var phoneRegexp = regexp.MustCompile(`^\+?[0-9\-()\s]{7,20}$`)

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	db           *database.Client
	doctorSvc    *services.DoctorService
	paymentSvc   *services.PaymentService
	notifSvc     *services.NotificationService
	telemediaSvc *services.TelemedicineService
}

// NewHandler wires up all downstream service clients from environment variables
// and returns a ready-to-use Handler.
func NewHandler(db *database.Client) *Handler {
	doctorBase := os.Getenv("DOCTOR_SERVICE_URL")
	if doctorBase == "" {
		doctorBase = "http://localhost:8082"
	}

	paymentBase := os.Getenv("PAYMENT_SERVICE_URL")
	if paymentBase == "" {
		paymentBase = "http://localhost:8085"
	}

	notifBase := os.Getenv("NOTIFICATION_SERVICE_URL")
	if notifBase == "" {
		notifBase = "http://localhost:8084"
	}

	telemediaBase := os.Getenv("TELEMEDICINE_SERVICE_URL")
	if telemediaBase == "" {
		telemediaBase = "http://localhost:8086"
	}

	return &Handler{
		db:           db,
		doctorSvc:    services.NewDoctorService(doctorBase),
		paymentSvc:   services.NewPaymentService(paymentBase),
		notifSvc:     services.NewNotificationService(notifBase),
		telemediaSvc: services.NewTelemedicineService(telemediaBase),
	}
}

// ── Helper ──────────────────────────────────────────────────────────────────────

func generateID(prefix string) string {
	// Use 16 random bytes (128 bits) to ensure collision resistance, while
	// retaining the timestamp component for readability.
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		b = make([]byte, 16) // zeroed fallback; rand.Read failure is extremely rare
	}
	// Format: APT-YYYYMMDD-HHMM-<32-hex-char random suffix>
	return fmt.Sprintf("%s-%s-%s", prefix, time.Now().UTC().Format("20060102-1504"), hex.EncodeToString(b))
}

// dbReady performs a real MongoDB ping rather than trusting the stale Connected
// flag — catches disconnections that occur after startup (issue #10).
func dbReady(db *database.Client) bool {
	return db != nil && db.IsConnected()
}

func callerUID(c *gin.Context) string {
	uid, _ := c.Get(middleware.CtxUID)
	return fmt.Sprint(uid)
}

func callerRole(c *gin.Context) string {
	role, _ := c.Get(middleware.CtxRole)
	return fmt.Sprint(role)
}

// doctorDisplayName returns the doctor's name for display in notifications.
// Falls back to the DoctorID for appointments created before DoctorName was stored.
func doctorDisplayName(appt models.Appointment) string {
	if appt.DoctorName != "" {
		return appt.DoctorName
	}
	return appt.DoctorID
}

// validateID rejects obviously malformed appointment IDs before a DB round-trip (issue G2).
// Returns false (and writes HTTP 400) when the id is empty or exceeds 128 characters.
func validateID(c *gin.Context, id string) bool {
	if id == "" || len(id) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return false
	}
	return true
}

// fetchAppointment consolidates the repeated dbReady-check → FindOne → decode → error-handling
// block that previously appeared in six separate handlers (issue G2 deduplication).
// Returns (appt, true) on success; (zero-value, false) when an error response has already
// been written to c and the caller should return immediately.
func (h *Handler) fetchAppointment(c *gin.Context, id string) (models.Appointment, bool) {
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return models.Appointment{}, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var appt models.Appointment
	err := h.db.DB.Collection("appointments").FindOne(ctx, bson.M{"id": id}).Decode(&appt)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return models.Appointment{}, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointment"})
		return models.Appointment{}, false
	}
	return appt, true
}

// ── Doctor search (proxied) ─────────────────────────────────────────────────────

// SearchDoctors proxies GET /doctors?specialty=... to the doctor-service.
// Any authenticated user may call this.
func (h *Handler) SearchDoctors(c *gin.Context) {
	specialty := c.Query("specialty")

	doctors, err := h.doctorSvc.SearchDoctors(specialty)
	if err != nil {
		log.Printf("[appointment-service] doctor search failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach doctor service"})
		return
	}

	c.JSON(http.StatusOK, doctors)
}

// GetDoctorByID proxies GET /doctors/:id to the doctor-service.
func (h *Handler) GetDoctorByID(c *gin.Context) {
	id := c.Param("id")

	doctor, err := h.doctorSvc.GetDoctorByID(id)
	if err != nil {
		log.Printf("[appointment-service] get doctor failed: %v", err)
		if errors.Is(err, services.ErrDoctorNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "doctor not found"})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach doctor service"})
		return
	}

	c.JSON(http.StatusOK, doctor)
}

// ── Appointment CRUD ────────────────────────────────────────────────────────────

// CreateAppointment orchestrates the full appointment-booking workflow.
// Only PATIENT role is allowed.
//
//  1. Extract patientId from the JWT (never trust request body for identity).
//  2. Validate the request body (all fields required).
//  3. Validate the appointment is in the future (≥ 15 min, ≤ 5 months).
//  4. Check doctor availability via the doctor-service (mandatory; returns 502
//     if the doctor-service is unavailable).
//  5. Initiate payment via the payment-service (Stripe checkout session).
//  6. Persist with status=PENDING_PAYMENT, paymentStatus=PENDING.
//  7. Send a booking-received notification (fire-and-forget goroutine).
//  8. Return HTTP 201 with { appointment, checkoutUrl }.
//     The patient MUST complete payment; the appointment is NOT confirmed yet.
func (h *Handler) CreateAppointment(c *gin.Context) {
	patientID := callerUID(c)

	var req models.Appointment
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	// Enforce: patientId must always match the authenticated caller — never trust the body.
	req.PatientID = patientID

	// Validate required string fields are non-empty after binding.
	if req.PatientName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patientName is required"})
		return
	}
	if len(req.PatientName) > 150 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patientName must not exceed 150 characters"})
		return
	}
	if req.PatientEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patientEmail is required"})
		return
	}
	if !emailRegexp.MatchString(req.PatientEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patientEmail must be a valid email address"})
		return
	}
	if req.PatientPhone != "" && !phoneRegexp.MatchString(req.PatientPhone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patientPhone must be a valid phone number"})
		return
	}
	if req.DoctorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "doctorId is required"})
		return
	}
	if len(req.DoctorID) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "doctorId is invalid"})
		return
	}
	if req.Specialty == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "specialty is required"})
		return
	}
	if len(req.Specialty) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "specialty must not exceed 100 characters"})
		return
	}
	if req.Date == "" || req.Time == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date and time are required"})
		return
	}

	// Step 3a – parse and validate date/time format.
	// All times are treated as UTC to ensure consistent behaviour regardless
	// of the server's local timezone (issue #4).
	scheduled, err := time.ParseInLocation("2006-01-02 15:04", req.Date+" "+req.Time, time.UTC)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date/time format; expected YYYY-MM-DD and HH:MM (24-hour UTC)"})
		return
	}

	// Step 3b – must be at least 15 minutes in the future.
	if scheduled.Sub(time.Now().UTC()) < 15*time.Minute {
		c.JSON(http.StatusBadRequest, gin.H{"error": "appointment must be scheduled at least 15 minutes in the future"})
		return
	}

	// Step 3c – must NOT be more than 5 months ahead.
	maxDate := time.Now().UTC().AddDate(0, 5, 0)
	if scheduled.After(maxDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "appointment cannot be booked more than 5 months in advance"})
		return
	}

	// Step 4 – check doctor availability (mandatory).
	available, err := h.doctorSvc.CheckAvailability(req.DoctorID, req.Date, req.Time)
	if err != nil {
		log.Printf("[appointment-service] doctor availability check failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not verify doctor availability; please try again"})
		return
	}
	if !available {
		c.JSON(http.StatusConflict, gin.H{"error": "doctor is not available for the requested slot"})
		return
	}

	// Step 4b – fetch doctor name and fee for payment and notifications.
	var doctorFeeCents int
	if doctorInfo, nameErr := h.doctorSvc.GetDoctorByID(req.DoctorID); nameErr != nil {
		log.Printf("[appointment-service] could not fetch doctor info for %s: %v", req.DoctorID, nameErr)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not fetch doctor information; please try again"})
		return
	} else {
		if doctorInfo.Name != "" {
			req.DoctorName = doctorInfo.Name
		} else {
			req.DoctorName = req.DoctorID
		}
		doctorFeeCents = doctorInfo.ConsultationFeeCents

		// C-8: Validate submitted specialty matches the doctor's actual specialty.
		if !strings.EqualFold(strings.TrimSpace(req.Specialty), strings.TrimSpace(doctorInfo.Specialty)) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("specialty mismatch: you requested %q but Dr. %s is a %s specialist",
					req.Specialty, doctorInfo.Name, doctorInfo.Specialty),
			})
			return
		}
		// Use the doctor's canonical specialty to avoid casing inconsistencies.
		req.Specialty = doctorInfo.Specialty
	}

	// Generate the appointment ID.
	appointmentID := generateID("APT")

	// Step 5 – check DB connectivity and enforce per-patient rate limit to
	// prevent slot-exhaustion attacks (issue #16).
	// M-1 FIX: Use a MongoDB transaction to atomically check the pending count
	// and insert the new appointment, preventing TOCTOU race conditions.
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	now := time.Now().UTC()
	req.ID = appointmentID
	req.Status = models.StatusPendingPayment
	req.PaymentStatus = models.PaymentPending
	req.CreatedAt = now
	req.UpdatedAt = now

	doc := bson.M{
		"id":            req.ID,
		"patientId":     req.PatientID,
		"patientName":   req.PatientName,
		"patientEmail":  req.PatientEmail,
		"patientPhone":  req.PatientPhone,
		"doctorId":      req.DoctorID,
		"doctorName":    req.DoctorName,
		"doctorEmail":   req.DoctorEmail,
		"specialty":     req.Specialty,
		"date":          req.Date,
		"time":          req.Time,
		"status":        req.Status,
		"paymentStatus": req.PaymentStatus,
		"transactionId": "",
		"checkoutUrl":   "",
		"createdAt":     req.CreatedAt,
		"updatedAt":     req.UpdatedAt,
	}

	// Atomic insert with pending-count guard inside a MongoDB session (M-1 fix).
	txCtx, txCancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer txCancel()

	session, sessionErr := h.db.MongoClient.StartSession()
	if sessionErr != nil {
		log.Printf("[appointment-service] failed to start mongo session: %v", sessionErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	defer session.EndSession(txCtx)

	var insertErr error
	var pendingLimitHit bool
	_, txErr := session.WithTransaction(txCtx, func(sCtx mongo.SessionContext) (interface{}, error) {
		pendingLimitHit = false
		pendingCount, countErr := h.db.DB.Collection("appointments").CountDocuments(sCtx, bson.M{
			"patientId": patientID,
			"status":    models.StatusPendingPayment,
		})
		if countErr != nil {
			return nil, countErr
		}
		if pendingCount >= maxPendingBookings {
			pendingLimitHit = true
			return nil, fmt.Errorf("pending limit exceeded")
		}
		_, insertErr = h.db.DB.Collection("appointments").InsertOne(sCtx, doc)
		return nil, insertErr
	})

	if pendingLimitHit {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": fmt.Sprintf("you have %d incomplete bookings awaiting payment; complete or cancel them before booking again", maxPendingBookings),
		})
		return
	}
	if txErr != nil || insertErr != nil {
		err := txErr
		if err == nil {
			err = insertErr
		}
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "this doctor slot is already booked"})
			return
		}
		log.Printf("[appointment-service] mongo insert failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save appointment"})
		return
	}

	// Step 6 – initiate Stripe payment session. If this fails, delete the
	// persisted appointment as a compensating action to avoid stranded records.
	paymentResult, err := h.paymentSvc.InitiatePayment(appointmentID, patientID, req.DoctorID, doctorFeeCents)
	if err != nil {
		log.Printf("[appointment-service] payment initiation failed for %s: %v — rolling back", appointmentID, err)
		rollbackCtx, rollbackCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer rollbackCancel()
		if _, delErr := h.db.DB.Collection("appointments").DeleteOne(rollbackCtx, bson.M{"id": appointmentID}); delErr != nil {
			log.Printf("[appointment-service] rollback delete failed for %s: %v", appointmentID, delErr)
		}
		c.JSON(http.StatusPaymentRequired, gin.H{"error": "payment initiation failed"})
		return
	}

	req.TransactionID = paymentResult.TransactionID
	req.CheckoutURL = paymentResult.CheckoutURL

	// Update the appointment record with the payment session details.
	// This is treated as fatal: if we cannot persist the transactionId, the
	// appointment has no path to confirmation, so we roll back (issue #1).
	payUpdateCtx, payUpdateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer payUpdateCancel()
	if _, updErr := h.db.DB.Collection("appointments").UpdateOne(
		payUpdateCtx,
		bson.M{"id": appointmentID},
		bson.M{"$set": bson.M{
			"transactionId": req.TransactionID,
			"checkoutUrl":   req.CheckoutURL,
			"updatedAt":     time.Now().UTC(),
		}},
	); updErr != nil {
		log.Printf("[appointment-service] failed to store payment details for %s: %v — rolling back", appointmentID, updErr)
		rollback2Ctx, rollback2Cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer rollback2Cancel()
		if _, delErr := h.db.DB.Collection("appointments").DeleteOne(rollback2Ctx, bson.M{"id": appointmentID}); delErr != nil {
			log.Printf("[appointment-service] rollback delete failed for %s: %v", appointmentID, delErr)
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist payment details; please retry booking"})
		return
	}

	// Step 7 – fire-and-forget notification with payment link.
	go h.notifSvc.SendBookingConfirmation(req.ID, req.PatientEmail, req.PatientPhone, req.PatientName, doctorDisplayName(req), req.Specialty, req.Date, req.Time, req.CheckoutURL)

	// Step 8 – return the appointment with the checkout URL the patient must visit.
	c.JSON(http.StatusCreated, gin.H{
		"message": "Appointment created. Please complete payment to confirm your booking.",
		"appointment": gin.H{
			"id":            req.ID,
			"patientId":     req.PatientID,
			"patientName":   req.PatientName,
			"patientPhone":  req.PatientPhone,
			"doctorId":      req.DoctorID,
			"specialty":     req.Specialty,
			"date":          req.Date,
			"time":          req.Time,
			"status":        req.Status,
			"paymentStatus": req.PaymentStatus,
		},
		"checkoutUrl": req.CheckoutURL,
	})
}

// ConfirmPayment transitions an appointment from PENDING_PAYMENT → CONFIRMED
// after verifying that the Stripe checkout session was completed.
//
// POST /appointments/:id/confirm-payment
//
// Flow:
//  1. Fetch appointment; verify caller is the owning patient (or admin).
//  2. Guard: appointment must still be in PENDING_PAYMENT status.
//  3. Call payment-service GET /payments/:transactionId to verify completion.
//  4. On success: set status=CONFIRMED, paymentStatus=COMPLETED.
//  5. Fire-and-forget notification to the patient.
//  6. Return the confirmed appointment details.
func (h *Handler) ConfirmPayment(c *gin.Context) {
	id := c.Param("id")
	if !validateID(c, id) {
		return
	}

	appt, ok := h.fetchAppointment(c, id)
	if !ok {
		return
	}

	uid := callerUID(c)
	role := callerRole(c)

	// Doctors cannot confirm patient payments (defence in depth; routes also enforce this) (issue G3).
	if role == roleDoctor {
		c.JSON(http.StatusForbidden, gin.H{"error": "doctors cannot confirm patient payments"})
		return
	}
	if role == rolePatient && appt.PatientID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not the patient for this appointment"})
		return
	}

	if appt.Status != models.StatusPendingPayment {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("payment confirmation is not applicable for appointments with status %s", appt.Status),
		})
		return
	}

	if appt.TransactionID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "appointment has no associated payment transaction"})
		return
	}

	// Verify payment with the payment-service.
	verification, err := h.paymentSvc.VerifyPayment(appt.TransactionID)
	if err != nil {
		log.Printf("[appointment-service] payment verification failed for %s (txn=%s): %v", id, appt.TransactionID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "payment verification failed"})
		return
	}

	if verification.Status != models.PaymentCompleted {
		c.JSON(http.StatusPaymentRequired, gin.H{
			"error":         "payment has not been completed",
			"paymentStatus": verification.Status,
		})
		return
	}

	// Transition PENDING_PAYMENT → CONFIRMED.
	updateCtx, updateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer updateCancel()

	res, err := h.db.DB.Collection("appointments").UpdateOne(
		updateCtx,
		bson.M{"id": id, "status": models.StatusPendingPayment}, // optimistic guard
		bson.M{"$set": bson.M{
			"status":        models.StatusConfirmed,
			"paymentStatus": models.PaymentCompleted,
			"updatedAt":     time.Now().UTC(),
		}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to confirm appointment"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "appointment status changed concurrently; please retry"})
		return
	}

	// Notify the patient: payment successful, appointment confirmed.
	go h.notifSvc.SendPaymentConfirmation(appt.ID, appt.PatientEmail, appt.PatientPhone, appt.PatientName, doctorDisplayName(appt), appt.Specialty, appt.Date, appt.Time)

	c.JSON(http.StatusOK, gin.H{
		"message": "Payment confirmed. Your appointment is now confirmed and awaiting the doctor's acceptance.",
		"appointment": gin.H{
			"id":            appt.ID,
			"patientName":   appt.PatientName,
			"doctorId":      appt.DoctorID,
			"specialty":     appt.Specialty,
			"date":          appt.Date,
			"time":          appt.Time,
			"status":        models.StatusConfirmed,
			"paymentStatus": models.PaymentCompleted,
		},
	})
}

// ConfirmPaymentInternal is an internal service-to-service endpoint called by
// payment-service after Stripe verification succeeds.
//
// POST /internal/appointments/:id/confirm-payment
// Headers:
//
//	X-Internal-Service-Key: <INTERNAL_SERVICE_KEY>
//
// Body (optional): {"transactionId":"..."}
func (h *Handler) ConfirmPaymentInternal(c *gin.Context) {
	configuredKey := strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_KEY"))
	providedKey := strings.TrimSpace(c.GetHeader("X-Internal-Service-Key"))
	if configuredKey == "" || providedKey == "" || providedKey != configuredKey {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized internal request"})
		return
	}

	id := c.Param("id")
	if !validateID(c, id) {
		return
	}

	var req struct {
		TransactionID string `json:"transactionId"`
	}
	if c.ContentType() == "application/json" {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
			return
		}
	}

	appt, ok := h.fetchAppointment(c, id)
	if !ok {
		return
	}

	if appt.Status != models.StatusPendingPayment {
		// Idempotent success for already-confirmed (or later) appointments.
		if appt.Status == models.StatusConfirmed || appt.Status == models.StatusBooked || appt.Status == models.StatusCompleted {
			c.JSON(http.StatusOK, gin.H{"message": "appointment already confirmed", "status": appt.Status})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("payment confirmation is not applicable for appointments with status %s", appt.Status),
		})
		return
	}

	if appt.TransactionID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "appointment has no associated payment transaction"})
		return
	}

	txnToVerify := appt.TransactionID
	if req.TransactionID != "" {
		// Trust payment-service supplied transaction id for backward compatibility
		// with legacy appointments that stored a Mongo _id instead of TXN-*.
		txnToVerify = req.TransactionID
	}

	verification, err := h.paymentSvc.VerifyPayment(txnToVerify)
	if err != nil {
		log.Printf("[appointment-service] internal payment verification failed for %s (txn=%s): %v", id, txnToVerify, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "payment verification failed", "details": err.Error()})
		return
	}

	if verification.Status != models.PaymentCompleted {
		c.JSON(http.StatusPaymentRequired, gin.H{
			"error":         "payment has not been completed",
			"paymentStatus": verification.Status,
		})
		return
	}

	updateCtx, updateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer updateCancel()

	res, err := h.db.DB.Collection("appointments").UpdateOne(
		updateCtx,
		bson.M{"id": id, "status": models.StatusPendingPayment},
		bson.M{"$set": bson.M{
			"status":        models.StatusConfirmed,
			"paymentStatus": models.PaymentCompleted,
			"transactionId": txnToVerify,
			"updatedAt":     time.Now().UTC(),
		}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to confirm appointment", "details": err.Error()})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "appointment status changed concurrently; please retry"})
		return
	}

	go h.notifSvc.SendPaymentConfirmation(appt.ID, appt.PatientEmail, appt.PatientPhone, appt.PatientName, doctorDisplayName(appt), appt.Specialty, appt.Date, appt.Time)

	c.JSON(http.StatusOK, gin.H{
		"message": "Payment confirmed automatically.",
		"appointment": gin.H{
			"id":            appt.ID,
			"status":        models.StatusConfirmed,
			"paymentStatus": models.PaymentCompleted,
		},
	})
}

// GetAppointmentByID returns a single appointment by its :id URL parameter.
// PATIENT may only see their own; DOCTOR may only see theirs; ADMIN sees any.
func (h *Handler) GetAppointmentByID(c *gin.Context) {
	id := c.Param("id")
	if !validateID(c, id) {
		return
	}

	appt, ok := h.fetchAppointment(c, id)
	if !ok {
		return
	}

	role := callerRole(c)
	uid := callerUID(c)

	if role == rolePatient && appt.PatientID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	if role == roleDoctor && appt.DoctorID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	if role != rolePatient && role != roleDoctor && role != roleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	// Sanitize sensitive fields for non-payer roles before returning.
	if role == roleDoctor {
		appt.TransactionID = ""
		appt.CheckoutURL = ""
		appt.PatientEmail = ""
	}

	c.JSON(http.StatusOK, appt)
}

// GetMyAppointments returns appointments for the authenticated caller.
//   - PATIENT  → appointments where patientId == uid                (sorted date/time asc)
//   - DOCTOR   → appointments where doctorId  == uid                (sorted date/time asc)
//   - ADMIN    → all appointments (optionally filtered by ?status=) (sorted date/time asc)
//
// Doctors see: patientName, specialty, date, time, status.
// Results are always sorted by date ascending then time ascending so doctors
// see the earliest upcoming appointment first.
func (h *Handler) GetMyAppointments(c *gin.Context) {
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	uid := callerUID(c)
	role := callerRole(c)
	statusFilter := c.Query("status")

	// Validate status query param against known values (issue #15).
	if statusFilter != "" {
		validStatuses := map[string]bool{
			models.StatusPendingPayment: true,
			models.StatusConfirmed:      true,
			models.StatusBooked:         true,
			models.StatusRejected:       true,
			models.StatusCancelled:      true,
			models.StatusCompleted:      true,
		}
		if !validStatuses[statusFilter] {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("unknown status %q; valid values: PENDING_PAYMENT, CONFIRMED, BOOKED, REJECTED, CANCELLED, COMPLETED", statusFilter),
			})
			return
		}
	}

	filter := bson.D{}
	switch role {
	case rolePatient:
		filter = bson.D{{Key: "patientId", Value: uid}}
	case roleDoctor:
		filter = bson.D{{Key: "doctorId", Value: uid}}
	case roleAdmin:
		// no additional filter
	default:
		c.JSON(http.StatusForbidden, gin.H{"error": "unknown role"})
		return
	}

	if statusFilter != "" {
		filter = append(filter, bson.E{Key: "status", Value: statusFilter})
	}

	// Pagination for all roles: ?page=1&limit=50 (max 100) (issue #B6).
	// Admin defaults to 50; patient/doctor default to 50 but can adjust up to 100.
	page := 1
	limit := int64(50)
	if p, _ := strconv.Atoi(c.Query("page")); p > 0 {
		page = p
	}
	if l, _ := strconv.Atoi(c.Query("limit")); l > 0 && l <= 100 {
		limit = int64(l)
	}
	skip := int64(page-1) * limit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Sort by date ascending, then time ascending — ensures correct chronological order
	// regardless of insertion order. Critical for doctors reviewing their schedule.
	sortOpts := options.Find().SetSort(bson.D{
		{Key: "date", Value: 1},
		{Key: "time", Value: 1},
	}).SetSkip(skip).SetLimit(limit)

	cursor, err := h.db.DB.Collection("appointments").Find(ctx, filter, sortOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query appointments"})
		return
	}

	var results []models.Appointment
	if err = cursor.All(ctx, &results); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read appointments"})
		return
	}

	// Return a stripped-down projection for doctors to avoid leaking patient
	// contact details and payment artifacts to a different principal.
	if role == roleDoctor {
		views := make([]models.DoctorAppointmentView, len(results))
		for i, r := range results {
			views[i] = models.DoctorAppointmentView{
				ID:                   r.ID,
				PatientName:          r.PatientName,
				Specialty:            r.Specialty,
				Date:                 r.Date,
				Time:                 r.Time,
				Status:               r.Status,
				ConsultationRoomName: r.ConsultationRoomName,
				CreatedAt:            r.CreatedAt,
			}
		}
		c.JSON(http.StatusOK, views)
		return
	}

	c.JSON(http.StatusOK, results)
}

// UpdateAppointmentStatus changes an appointment's status with full business-rule enforcement.
//
// DOCTOR may: CONFIRMED → BOOKED (accept) | CONFIRMED → REJECTED (reject)
// PATIENT may: PENDING_PAYMENT → CANCELLED | CONFIRMED → CANCELLED | BOOKED → CANCELLED (if not started)
// ADMIN may: any valid transition.
func (h *Handler) UpdateAppointmentStatus(c *gin.Context) {
	id := c.Param("id")
	if !validateID(c, id) {
		return
	}

	var req models.StatusUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	appt, ok := h.fetchAppointment(c, id)
	if !ok {
		return
	}

	uid := callerUID(c)
	role := callerRole(c)
	newStatus := req.Status

	// ── Authorization per role ──────────────────────────────────────────────────
	switch role {
	case roleDoctor:
		if appt.DoctorID != uid {
			c.JSON(http.StatusForbidden, gin.H{"error": "you are not the doctor for this appointment"})
			return
		}

		// C-3/M-6: Verify doctor is VERIFIED before allowing any status change.
		doctorInfo, doctorErr := h.doctorSvc.GetDoctorByID(appt.DoctorID)
		if doctorErr != nil {
			log.Printf("[appointment-service] doctor verification check failed for %s: %v", uid, doctorErr)
			c.JSON(http.StatusBadGateway, gin.H{"error": "could not verify doctor status"})
			return
		}
		if doctorInfo.VerificationStatus != "VERIFIED" {
			c.JSON(http.StatusForbidden, gin.H{"error": "your doctor account is not verified; you cannot manage appointments"})
			return
		}

		if newStatus != models.StatusBooked && newStatus != models.StatusRejected {
			c.JSON(http.StatusBadRequest, gin.H{"error": "doctors may only accept (BOOKED) or reject (REJECTED) appointments through this endpoint"})
			return
		}
		// Note: state machine enforces that only CONFIRMED → BOOKED/REJECTED is valid.
		// A PENDING_PAYMENT appointment cannot be accepted until the patient pays.

	case rolePatient:
		if appt.PatientID != uid {
			c.JSON(http.StatusForbidden, gin.H{"error": "you are not the patient for this appointment"})
			return
		}
		if newStatus != models.StatusCancelled {
			c.JSON(http.StatusBadRequest, gin.H{"error": "patients may only cancel appointments"})
			return
		}
		if appt.IsStarted() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot cancel an appointment that has already started"})
			return
		}

	case roleAdmin:
		if newStatus == models.StatusCancelled && appt.IsStarted() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot cancel an appointment that has already started"})
			return
		}
		// Prevent bypassing the payment verification flow: PENDING_PAYMENT → CONFIRMED
		// must go through POST /appointments/:id/confirm-payment (issue #3).
		if appt.Status == models.StatusPendingPayment && newStatus == models.StatusConfirmed {
			c.JSON(http.StatusBadRequest, gin.H{"error": "use POST /appointments/:id/confirm-payment to confirm a paid appointment"})
			return
		}

	default:
		c.JSON(http.StatusForbidden, gin.H{"error": "unknown role"})
		return
	}

	// ── Validate state machine ──────────────────────────────────────────────────
	if !appt.CanTransitionTo(newStatus) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("transition from %s → %s is not allowed", appt.Status, newStatus),
		})
		return
	}

	// ── If doctor is accepting: do NOT create the LiveKit room yet.
	// Room creation happens AFTER the DB write succeeds to avoid orphaned rooms
	// if the optimistic concurrency guard fires (issue B1).

	// ── Persist ────────────────────────────────────────────────────────────────
	updateCtx, updateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer updateCancel()

	setFields := bson.M{
		"status":    newStatus,
		"updatedAt": time.Now().UTC(),
	}
	if newStatus == models.StatusRejected && req.Reason != "" {
		setFields["rejectionReason"] = req.Reason
	}

	res, err := h.db.DB.Collection("appointments").UpdateOne(
		updateCtx,
		bson.M{"id": id, "status": appt.Status}, // optimistic concurrency guard
		bson.M{"$set": setFields},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update appointment"})
		return
	}
	if res.MatchedCount == 0 {
		// Another goroutine changed the status between our read and write.
		c.JSON(http.StatusConflict, gin.H{"error": "appointment status was modified concurrently; please retry"})
		return
	}

	// Refund on cancellation or rejection of a paid appointment.
	if (newStatus == models.StatusCancelled || newStatus == models.StatusRejected) &&
		appt.PaymentStatus == models.PaymentCompleted && appt.TransactionID != "" {
		if refundErr := h.paymentSvc.RefundPayment(appt.TransactionID); refundErr != nil {
			log.Printf("[appointment-service] refund failed for %s (txn=%s): %v", id, appt.TransactionID, refundErr)
		}
	}

	// ── Create LiveKit room AFTER successful DB write (issue B1) ────────────
	// Only now is it safe to create the room; the DB record is authoritative.
	var roomName string
	if newStatus == models.StatusBooked {
		var createErr error
		roomName, createErr = h.telemediaSvc.CreateRoom(appt.ID)
		if createErr != nil {
			log.Printf("[appointment-service] failed to create consultation room for %s: %v", appt.ID, createErr)
			// Non-fatal: the appointment is already BOOKED in the DB.
			// The room will be created lazily when GetConsultationToken is called.
			roomName = ""
		} else if roomName != "" {
			// Persist the room name into the appointment record.
			roomCtx, roomCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer roomCancel()
			if _, roomErr := h.db.DB.Collection("appointments").UpdateOne(
				roomCtx,
				bson.M{"id": id},
				bson.M{"$set": bson.M{"consultationRoomName": roomName, "updatedAt": time.Now().UTC()}},
			); roomErr != nil {
				log.Printf("[appointment-service] failed to persist consultationRoomName for %s: %v", id, roomErr)
			}
		}
	}

	// Fire-and-forget notification.
	go h.notifSvc.SendStatusUpdate(appt.ID, appt.PatientEmail, appt.PatientPhone, doctorDisplayName(appt), appt.Date, appt.Time, newStatus, req.Reason)

	resp := gin.H{"message": "status updated", "id": id, "status": newStatus}
	if roomName != "" {
		resp["consultationRoomName"] = roomName
	}
	c.JSON(http.StatusOK, resp)
}

// RescheduleAppointment allows a PATIENT to propose a new date/time for their appointment.
// The appointment resets to CONFIRMED (payment is retained) so the doctor must re-accept.
//
// Business rules:
//   - Only the owning patient may reschedule.
//   - Only CONFIRMED or BOOKED appointments can be rescheduled.
//   - Cannot reschedule after the appointment start time.
//   - A reason is mandatory.
//   - New slot must be ≥ 15 minutes in the future and ≤ 5 months ahead.
//   - Doctor availability on the new slot is re-validated (graceful fallback).
func (h *Handler) RescheduleAppointment(c *gin.Context) {
	id := c.Param("id")
	if !validateID(c, id) {
		return
	}

	var req models.RescheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	// Reject whitespace-only reason (issue B8).
	req.Reason = strings.TrimSpace(req.Reason)
	if req.Reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason must not be blank"})
		return
	}

	// Validate new date/time format.
	scheduled, err := time.ParseInLocation("2006-01-02 15:04", req.Date+" "+req.Time, time.UTC)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date/time format; expected YYYY-MM-DD and HH:MM (24-hour UTC)"})
		return
	}

	// New slot must be at least 15 minutes in the future.
	if scheduled.Sub(time.Now().UTC()) < 15*time.Minute {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rescheduled slot must be at least 15 minutes in the future"})
		return
	}

	// New slot must be within the 5-month booking window.
	maxDate := time.Now().UTC().AddDate(0, 5, 0)
	if scheduled.After(maxDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "appointment cannot be rescheduled more than 5 months in advance"})
		return
	}

	appt, ok := h.fetchAppointment(c, id)
	if !ok {
		return
	}

	// Only the patient who owns the appointment may reschedule.
	uid := callerUID(c)
	if appt.PatientID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not the patient for this appointment"})
		return
	}

	// Cannot reschedule after the appointment has already started.
	if appt.IsStarted() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot reschedule an appointment that has already started"})
		return
	}

	// Only CONFIRMED or BOOKED appointments can be rescheduled.
	// PENDING_PAYMENT → patient should cancel and rebook instead.
	if appt.Status != models.StatusConfirmed && appt.Status != models.StatusBooked {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("cannot reschedule an appointment with status %s; only CONFIRMED or BOOKED appointments can be rescheduled", appt.Status),
		})
		return
	}

	// Re-validate availability on the new slot (mandatory).
	available, err := h.doctorSvc.CheckAvailability(appt.DoctorID, req.Date, req.Time)
	if err != nil {
		log.Printf("[appointment-service] doctor availability check failed during reschedule: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not verify doctor availability; please try again"})
		return
	}
	if !available {
		c.JSON(http.StatusConflict, gin.H{"error": "doctor is not available for the requested new slot"})
		return
	}

	// Reject pointless reschedule to the exact same slot (issue #22).
	if req.Date == appt.Date && req.Time == appt.Time {
		c.JSON(http.StatusBadRequest, gin.H{"error": "the new slot is the same as the current appointment time; no change made"})
		return
	}

	// Update the appointment. Optimistic concurrency: match current status to prevent races.
	updateCtx, updateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer updateCancel()

	res, err := h.db.DB.Collection("appointments").UpdateOne(
		updateCtx,
		bson.M{"id": id, "status": appt.Status}, // optimistic guard
		bson.M{"$set": bson.M{
			"date":                 req.Date,
			"time":                 req.Time,
			"status":               models.StatusConfirmed, // payment already done; doctor must re-accept the new slot
			"consultationRoomName": "",                     // clear stale LiveKit room from previous BOOKED state (issue #6)
			"updatedAt":            time.Now().UTC(),
		}},
	)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "the new slot is already taken by another booking"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reschedule appointment"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "appointment was modified concurrently; please retry"})
		return
	}

	log.Printf("[appointment-service] appointment %s rescheduled by patient %s to %s %s (reason: %s)", id, uid, req.Date, req.Time, req.Reason)

	// Fire-and-forget notifications: patient confirmation + doctor alert (issue B7).
	go h.notifSvc.SendRescheduleNotification(appt.ID, appt.PatientEmail, appt.PatientPhone, doctorDisplayName(appt), req.Date, req.Time)
	if appt.DoctorEmail != "" {
		go h.notifSvc.SendDoctorRescheduleAlert(appt.ID, appt.DoctorEmail, appt.PatientName, req.Date, req.Time)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "appointment rescheduled; awaiting doctor re-confirmation",
		"id":      id,
		"date":    req.Date,
		"time":    req.Time,
		"status":  models.StatusConfirmed,
		"reason":  req.Reason,
	})
}

// CancelAppointment cancels an appointment via DELETE /appointments/:id.
// This is a convenience shortcut for PATIENT callers; it enforces the same
// business rules as UpdateAppointmentStatus with status=CANCELLED.
func (h *Handler) CancelAppointment(c *gin.Context) {
	id := c.Param("id")
	if !validateID(c, id) {
		return
	}

	appt, ok := h.fetchAppointment(c, id)
	if !ok {
		return
	}

	uid := callerUID(c)
	role := callerRole(c)

	// Only the owning patient or admin may cancel.
	if role == rolePatient && appt.PatientID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not the patient for this appointment"})
		return
	}

	if appt.IsStarted() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot cancel an appointment that has already started"})
		return
	}

	if !appt.CanTransitionTo(models.StatusCancelled) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("cannot cancel an appointment with status %s", appt.Status),
		})
		return
	}

	updateCtx, updateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer updateCancel()

	res, err := h.db.DB.Collection("appointments").UpdateOne(
		updateCtx,
		bson.M{"id": id, "status": appt.Status},
		bson.M{"$set": bson.M{
			"status":    models.StatusCancelled,
			"updatedAt": time.Now().UTC(),
		}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to cancel appointment"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "appointment was modified concurrently; please retry"})
		return
	}

	// Refund if payment was completed.
	if appt.PaymentStatus == models.PaymentCompleted && appt.TransactionID != "" {
		if refundErr := h.paymentSvc.RefundPayment(appt.TransactionID); refundErr != nil {
			log.Printf("[appointment-service] refund failed for %s (txn=%s): %v", id, appt.TransactionID, refundErr)
		}
	}

	go h.notifSvc.SendStatusUpdate(appt.ID, appt.PatientEmail, appt.PatientPhone, doctorDisplayName(appt), appt.Date, appt.Time, models.StatusCancelled, "")

	c.JSON(http.StatusOK, gin.H{"message": "appointment cancelled", "id": id})
}

// GetConsultationToken returns a LiveKit join token for the consultation room
// attached to a BOOKED appointment.
//
// GET /appointments/:id/consultation-token?name=<display-name>
//
// Access: the patient who owns the appointment, the assigned doctor, or an admin.
// The optional `name` query parameter sets the participant display name in the
// LiveKit room; when omitted it defaults to the caller's uid.
func (h *Handler) GetConsultationToken(c *gin.Context) {
	id := c.Param("id")
	if !validateID(c, id) {
		return
	}

	appt, ok := h.fetchAppointment(c, id)
	if !ok {
		return
	}

	uid := callerUID(c)
	role := callerRole(c)

	// Authorisation: patient or doctor of this appointment, or admin.
	switch role {
	case rolePatient:
		if appt.PatientID != uid {
			c.JSON(http.StatusForbidden, gin.H{"error": "you are not the patient for this appointment"})
			return
		}
	case roleDoctor:
		if appt.DoctorID != uid {
			c.JSON(http.StatusForbidden, gin.H{"error": "you are not the doctor for this appointment"})
			return
		}
	case roleAdmin:
		// admins may obtain tokens for any appointment
	default:
		c.JSON(http.StatusForbidden, gin.H{"error": "unknown role"})
		return
	}

	// Consultation is only available once the appointment is BOOKED.
	if appt.Status != models.StatusBooked {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("consultation is not available for appointments with status %s", appt.Status)})
		return
	}

	if appt.ConsultationRoomName == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "consultation room has not been created yet; please try again shortly"})
		return
	}

	// Enforce consultation access window: 30 min before to 2 hours after scheduled time (issue #12).
	scheduled := appt.ScheduledTime()
	now := time.Now().UTC()
	windowStart := scheduled.Add(-30 * time.Minute)
	windowEnd := scheduled.Add(2 * time.Hour)
	if now.Before(windowStart) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": fmt.Sprintf("consultation room is not yet open; you may join from %s UTC", windowStart.Format("2006-01-02 15:04")),
		})
		return
	}
	if now.After(windowEnd) {
		c.JSON(http.StatusForbidden, gin.H{"error": "consultation window has closed"})
		return
	}

	// Sanitize optional ?name= query param for the LiveKit display name (issue #13, B5, B10).
	displayName := strings.TrimSpace(c.Query("name"))
	if displayName == "" {
		displayName = uid
	} else {
		// Truncate by rune count (not bytes) to avoid splitting multi-byte UTF-8 (issue B5).
		runes := []rune(displayName)
		if len(runes) > 100 {
			displayName = string(runes[:100])
		}
		for _, r := range displayName {
			if r < 32 || r == 127 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "display name contains invalid characters"})
				return
			}
		}
	}

	token, err := h.telemediaSvc.GetJoinToken(appt.ConsultationRoomName, uid, displayName)
	if err != nil {
		log.Printf("[appointment-service] failed to get join token for %s (room=%s uid=%s): %v", id, appt.ConsultationRoomName, uid, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to issue consultation token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"appointmentId": id,
		"roomName":      token.RoomName,
		"token":         token.Token,
		"wsUrl":         token.WsURL,
	})
}

// Health returns a readiness probe for the service.
func (h *Handler) Health(c *gin.Context) {
	if !dbReady(h.db) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"service": "appointment-service", "status": "DEGRADED", "database": "disconnected"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"service": "appointment-service",
		"status":  "OK",
	})
}

type scheduleSummaryDate struct {
	Date           string `json:"date"`
	DayOfWeek      int    `json:"dayOfWeek"`
	TotalSlots     int    `json:"totalSlots"`
	BookedCount    int    `json:"bookedCount"`
	AvailableSlots int    `json:"availableSlots"`
}

type scheduleSummarySlot struct {
	Time       string `json:"time"`
	BookedCount int   `json:"bookedCount"`
	Available  bool   `json:"available"`
}

// GetDoctorScheduleSummary returns real booking-aware availability for a doctor.
//
// GET /doctors/:id/schedule-summary?from=YYYY-MM-DD&days=30
//
// Access: any authenticated user.
func (h *Handler) GetDoctorScheduleSummary(c *gin.Context) {
	doctorID := strings.TrimSpace(c.Param("id"))
	if doctorID == "" || len(doctorID) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid doctor id"})
		return
	}

	if _, err := h.doctorSvc.GetDoctorByID(doctorID); err != nil {
		if errors.Is(err, services.ErrDoctorNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "doctor not found"})
			return
		}
		log.Printf("[appointment-service] get doctor schedule summary failed to resolve doctor %s: %v", doctorID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach doctor service"})
		return
	}

	availability, err := h.doctorSvc.GetDoctorAvailability(doctorID)
	if err != nil {
		log.Printf("[appointment-service] get doctor schedule summary availability failed for doctor %s: %v", doctorID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not load doctor availability"})
		return
	}

	fromDate := time.Now().UTC().Truncate(24 * time.Hour)
	if raw := strings.TrimSpace(c.Query("from")); raw != "" {
		parsed, parseErr := time.ParseInLocation("2006-01-02", raw, time.UTC)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid from date; expected YYYY-MM-DD"})
			return
		}
		fromDate = parsed
	}

	days := 30
	if rawDays := strings.TrimSpace(c.Query("days")); rawDays != "" {
		parsedDays, parseErr := strconv.Atoi(rawDays)
		if parseErr != nil || parsedDays < 1 || parsedDays > 90 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid days; expected 1-90"})
			return
		}
		days = parsedDays
	}

	parseHHMMToMinutes := func(s string) (int, bool) {
		parts := strings.Split(s, ":")
		if len(parts) != 2 {
			return 0, false
		}
		h, errH := strconv.Atoi(parts[0])
		m, errM := strconv.Atoi(parts[1])
		if errH != nil || errM != nil || h < 0 || h > 23 || m < 0 || m > 59 {
			return 0, false
		}
		return h*60 + m, true
	}

	makeSlots := func(startHHMM, endHHMM string) []string {
		start, okStart := parseHHMMToMinutes(startHHMM)
		end, okEnd := parseHHMMToMinutes(endHHMM)
		if !okStart || !okEnd || end <= start {
			return nil
		}
		slots := make([]string, 0, (end-start)/15)
		for minute := start; minute < end; minute += 15 {
			hh := minute / 60
			mm := minute % 60
			slots = append(slots, fmt.Sprintf("%02d:%02d", hh, mm))
		}
		return slots
	}

	weeklySlots := map[int][]string{}
	for _, block := range availability {
		if block.DayOfWeek < 0 || block.DayOfWeek > 6 {
			continue
		}
		slots := makeSlots(block.StartTime, block.EndTime)
		if len(slots) == 0 {
			continue
		}
		weeklySlots[block.DayOfWeek] = append(weeklySlots[block.DayOfWeek], slots...)
	}

	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	toDate := fromDate.AddDate(0, 0, days-1)
	fromStr := fromDate.Format("2006-01-02")
	toStr := toDate.Format("2006-01-02")

	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	cursor, findErr := h.db.DB.Collection("appointments").Find(ctx, bson.M{
		"doctorId": doctorID,
		"date": bson.M{
			"$gte": fromStr,
			"$lte": toStr,
		},
		"status": bson.M{
			"$in": []string{models.StatusPendingPayment, models.StatusConfirmed, models.StatusBooked},
		},
	})
	if findErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load appointment bookings"})
		return
	}

	var appts []models.Appointment
	if err := cursor.All(ctx, &appts); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read appointment bookings"})
		return
	}

	bookingsByDateAndTime := map[string]map[string]int{}
	for _, appt := range appts {
		if bookingsByDateAndTime[appt.Date] == nil {
			bookingsByDateAndTime[appt.Date] = map[string]int{}
		}
		bookingsByDateAndTime[appt.Date][appt.Time]++
	}

	dates := make([]scheduleSummaryDate, 0, days)
	slotsByDate := map[string][]scheduleSummarySlot{}

	for i := 0; i < days; i++ {
		current := fromDate.AddDate(0, 0, i)
		dateKey := current.Format("2006-01-02")
		dow := int(current.Weekday())

		weekdaySlots := weeklySlots[dow]
		if len(weekdaySlots) == 0 {
			continue
		}

		seen := map[string]bool{}
		uniqueSlots := make([]string, 0, len(weekdaySlots))
		for _, slot := range weekdaySlots {
			if slot == "" || seen[slot] {
				continue
			}
			seen[slot] = true
			uniqueSlots = append(uniqueSlots, slot)
		}

		totalSlots := len(uniqueSlots)
		if totalSlots == 0 {
			continue
		}

		dateSlots := make([]scheduleSummarySlot, 0, totalSlots)
		bookedCount := 0
		for _, slot := range uniqueSlots {
			count := bookingsByDateAndTime[dateKey][slot]
			bookedCount += count
			dateSlots = append(dateSlots, scheduleSummarySlot{
				Time:        slot,
				BookedCount: count,
				Available:   count == 0,
			})
		}

		availableSlots := totalSlots - bookedCount
		if availableSlots < 0 {
			availableSlots = 0
		}

		dates = append(dates, scheduleSummaryDate{
			Date:           dateKey,
			DayOfWeek:      dow,
			TotalSlots:     totalSlots,
			BookedCount:    bookedCount,
			AvailableSlots: availableSlots,
		})
		slotsByDate[dateKey] = dateSlots
	}

	c.JSON(http.StatusOK, gin.H{
		"doctorId":    doctorID,
		"from":        fromStr,
		"to":          toStr,
		"days":        days,
		"dates":       dates,
		"slotsByDate": slotsByDate,
	})
}

// CompleteAppointmentInternal is an internal service-to-service endpoint called by
// doctor-service after EndConsultation completes a consultation (C-6).
//
// POST /internal/appointments/:id/complete
// Headers: X-Internal-Service-Key: <INTERNAL_SERVICE_KEY>
func (h *Handler) CompleteAppointmentInternal(c *gin.Context) {
	configuredKey := strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_KEY"))
	providedKey := strings.TrimSpace(c.GetHeader("X-Internal-Service-Key"))
	if configuredKey == "" || providedKey == "" || providedKey != configuredKey {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized internal request"})
		return
	}

	id := c.Param("id")
	if !validateID(c, id) {
		return
	}

	appt, ok := h.fetchAppointment(c, id)
	if !ok {
		return
	}

	if appt.Status != models.StatusBooked {
		if appt.Status == models.StatusCompleted {
			c.JSON(http.StatusOK, gin.H{"message": "appointment already completed", "status": appt.Status})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("cannot complete appointment with status %s; must be BOOKED", appt.Status),
		})
		return
	}

	updateCtx, updateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer updateCancel()

	res, err := h.db.DB.Collection("appointments").UpdateOne(
		updateCtx,
		bson.M{"id": id, "status": models.StatusBooked},
		bson.M{"$set": bson.M{
			"status":    models.StatusCompleted,
			"updatedAt": time.Now().UTC(),
		}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete appointment"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "appointment status changed concurrently"})
		return
	}

	go h.notifSvc.SendStatusUpdate(appt.ID, appt.PatientEmail, appt.PatientPhone, doctorDisplayName(appt), appt.Date, appt.Time, models.StatusCompleted, "")

	c.JSON(http.StatusOK, gin.H{
		"message": "appointment completed via consultation workflow",
		"id":      id,
		"status":  models.StatusCompleted,
	})
}

// CheckSlotInternal is an internal endpoint used by doctor-service CheckAvailability
// to verify whether a slot is already booked (M-2).
//
// GET /internal/appointments/check-slot?doctorId=...&date=...&time=...
func (h *Handler) CheckSlotInternal(c *gin.Context) {
	configuredKey := strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_KEY"))
	providedKey := strings.TrimSpace(c.GetHeader("X-Internal-Service-Key"))
	if configuredKey == "" || providedKey == "" || providedKey != configuredKey {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized internal request"})
		return
	}

	doctorID := c.Query("doctorId")
	date := c.Query("date")
	timeSlot := c.Query("time")

	if doctorID == "" || date == "" || timeSlot == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "doctorId, date, and time are required"})
		return
	}

	if !dbReady(h.db) {
		// Cannot verify — return not-booked so the caller allows the attempt
		// (the unique index catches it at insert).
		c.JSON(http.StatusOK, gin.H{"booked": false})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Check for any active appointment (not CANCELLED/REJECTED) at this slot.
	count, err := h.db.DB.Collection("appointments").CountDocuments(ctx, bson.M{
		"doctorId": doctorID,
		"date":     date,
		"time":     timeSlot,
		"status": bson.M{"$nin": []string{
			models.StatusCancelled,
			models.StatusRejected,
		}},
	})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"booked": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"booked": count > 0})
}
