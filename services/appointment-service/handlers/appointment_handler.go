package handlers

import (
	"appointment-service/database"
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
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ── Context key constants (must match middleware/auth.go) ──────────────────────
const ctxUID = "uid"
const ctxRole = "role"

// ── Role constants ──────────────────────────────────────────────────────────────
const (
	rolePatient = "PATIENT"
	roleDoctor  = "DOCTOR"
	roleAdmin   = "ADMIN"
)

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	db            *database.Client
	doctorSvc     *services.DoctorService
	paymentSvc    *services.PaymentService
	notifSvc      *services.NotificationService
	telemediaSvc  *services.TelemedicineService
}

// NewHandler wires up all downstream service clients from environment variables
// and returns a ready-to-use Handler.
func NewHandler(db *database.Client) *Handler {
	doctorBase := os.Getenv("DOCTOR_SERVICE_URL")
	if doctorBase == "" {
		doctorBase = "http://doctor-service:8082"
	}

	paymentBase := os.Getenv("PAYMENT_SERVICE_URL")
	if paymentBase == "" {
		paymentBase = "http://payment-service:8085"
	}

	notifBase := os.Getenv("NOTIFICATION_SERVICE_URL")
	if notifBase == "" {
		notifBase = "http://notification-service:8084"
	}

	telemediaBase := os.Getenv("TELEMEDICINE_SERVICE_URL")
	if telemediaBase == "" {
		telemediaBase = "http://telemedicine-service:8086"
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
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		b = []byte{0, 0}
	}
	// Format: APT-YYYYMMDD-HHMM-XXXX
	// Example: APT-20260401-1430-a3f9
	return fmt.Sprintf("%s-%s-%s", prefix, time.Now().Format("20060102-1504"), hex.EncodeToString(b))
}

func dbReady(db *database.Client) bool {
	return db != nil && db.Connected && db.DB != nil
}

func callerUID(c *gin.Context) string {
	uid, _ := c.Get(ctxUID)
	return fmt.Sprint(uid)
}

func callerRole(c *gin.Context) string {
	role, _ := c.Get(ctxRole)
	return fmt.Sprint(role)
}

// ── Doctor search (proxied) ─────────────────────────────────────────────────────

// SearchDoctors proxies GET /doctors?specialty=... to the doctor-service.
// Any authenticated user may call this.
func (h *Handler) SearchDoctors(c *gin.Context) {
	specialty := c.Query("specialty")

	doctors, err := h.doctorSvc.SearchDoctors(specialty)
	if err != nil {
		log.Printf("[appointment-service] doctor search failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach doctor service", "details": err.Error()})
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
		if fmt.Sprintf("%v", err) == fmt.Sprintf("doctor not found: %s", id) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach doctor service", "details": err.Error()})
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
//  4. Check doctor availability via the doctor-service (graceful: if service is
//     unavailable, fall back to DB-only uniqueness guard).
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
	if req.PatientEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patientEmail is required"})
		return
	}
	if req.DoctorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "doctorId is required"})
		return
	}
	if req.Specialty == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "specialty is required"})
		return
	}
	if req.Date == "" || req.Time == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date and time are required"})
		return
	}

	// Step 3a – parse and validate date/time format.
	scheduled, err := time.Parse("2006-01-02 15:04", req.Date+" "+req.Time)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date/time format; expected YYYY-MM-DD and HH:MM (24-hour)"})
		return
	}

	// Step 3b – must be at least 15 minutes in the future.
	if time.Until(scheduled) < 15*time.Minute {
		c.JSON(http.StatusBadRequest, gin.H{"error": "appointment must be scheduled at least 15 minutes in the future"})
		return
	}

	// Step 3c – must NOT be more than 5 months ahead.
	maxDate := time.Now().AddDate(0, 5, 0)
	if scheduled.After(maxDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "appointment cannot be booked more than 5 months in advance"})
		return
	}

	// Step 4 – check doctor availability (graceful: doctor-service may not be deployed yet).
	available, err := h.doctorSvc.CheckAvailability(req.DoctorID, req.Date, req.Time)
	if err != nil {
		// Doctor-service is not yet available in all environments.
		// Log a warning and fall through; the DB unique index is the safety net.
		log.Printf("[appointment-service] doctor availability check unavailable: %v — relying on DB uniqueness guard", err)
	} else if !available {
		c.JSON(http.StatusConflict, gin.H{"error": "doctor is not available for the requested slot"})
		return
	}

	// Generate the appointment ID before payment so it is recorded in the transaction.
	appointmentID := generateID("APT")

	// Step 5 – initiate Stripe payment session.
	paymentResult, err := h.paymentSvc.InitiatePayment(appointmentID, patientID, req.DoctorID)
	if err != nil {
		log.Printf("[appointment-service] payment initiation failed: %v", err)
		c.JSON(http.StatusPaymentRequired, gin.H{"error": "payment initiation failed", "details": err.Error()})
		return
	}

	// Step 6 – persist to MongoDB.
	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	now := time.Now()
	req.ID = appointmentID
	req.Status = models.StatusPendingPayment
	req.PaymentStatus = models.PaymentPending
	req.TransactionID = paymentResult.TransactionID
	req.CheckoutURL = paymentResult.CheckoutURL
	req.CreatedAt = now
	req.UpdatedAt = now

	doc := bson.M{
		"id":            req.ID,
		"patientId":     req.PatientID,
		"patientName":   req.PatientName,
		"patientEmail":  req.PatientEmail,
		"doctorId":      req.DoctorID,
		"specialty":     req.Specialty,
		"date":          req.Date,
		"time":          req.Time,
		"status":        req.Status,
		"paymentStatus": req.PaymentStatus,
		"transactionId": req.TransactionID,
		"checkoutUrl":   req.CheckoutURL,
		"createdAt":     req.CreatedAt,
		"updatedAt":     req.UpdatedAt,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := h.db.DB.Collection("appointments").InsertOne(ctx, doc); err != nil {
		// E11000 duplicate key → doctor slot already taken (race-condition safe).
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "this doctor slot is already booked"})
			return
		}
		log.Printf("[appointment-service] mongo insert failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save appointment", "details": err.Error()})
		return
	}

	// Step 7 – fire-and-forget notification with payment link.
	go h.notifSvc.SendBookingConfirmation(req.ID, req.PatientEmail, req.PatientName, req.DoctorID, req.Specialty, req.Date, req.Time, req.CheckoutURL)

	// Step 8 – return the appointment with the checkout URL the patient must visit.
	c.JSON(http.StatusCreated, gin.H{
		"message": "Appointment created. Please complete payment to confirm your booking.",
		"appointment": gin.H{
			"id":            req.ID,
			"patientId":     req.PatientID,
			"patientName":   req.PatientName,
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

	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var appt models.Appointment
	err := h.db.DB.Collection("appointments").FindOne(ctx, bson.M{"id": id}).Decode(&appt)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointment", "details": err.Error()})
		return
	}

	uid := callerUID(c)
	role := callerRole(c)

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

	// Transition PENDING_PAYMENT → CONFIRMED.
	updateCtx, updateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer updateCancel()

	res, err := h.db.DB.Collection("appointments").UpdateOne(
		updateCtx,
		bson.M{"id": id, "status": models.StatusPendingPayment}, // optimistic guard
		bson.M{"$set": bson.M{
			"status":        models.StatusConfirmed,
			"paymentStatus": models.PaymentCompleted,
			"updatedAt":     time.Now(),
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

	// Notify the patient: payment successful, appointment confirmed.
	go h.notifSvc.SendPaymentConfirmation(appt.ID, appt.PatientEmail, appt.PatientName, appt.DoctorID, appt.Specialty, appt.Date, appt.Time)

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

// GetAppointmentByID returns a single appointment by its :id URL parameter.
// PATIENT may only see their own; DOCTOR may only see theirs; ADMIN sees any.
func (h *Handler) GetAppointmentByID(c *gin.Context) {
	id := c.Param("id")

	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var appt models.Appointment
	err := h.db.DB.Collection("appointments").FindOne(ctx, bson.M{"id": id}).Decode(&appt)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointment", "details": err.Error()})
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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Sort by date ascending, then time ascending — ensures correct chronological order
	// regardless of insertion order. Critical for doctors reviewing their schedule.
	sortOpts := options.Find().SetSort(bson.D{
		{Key: "date", Value: 1},
		{Key: "time", Value: 1},
	})

	cursor, err := h.db.DB.Collection("appointments").Find(ctx, filter, sortOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query appointments", "details": err.Error()})
		return
	}

	var results []models.Appointment
	if err = cursor.All(ctx, &results); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read appointments", "details": err.Error()})
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

	var req models.StatusUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Fetch the current appointment.
	var appt models.Appointment
	err := h.db.DB.Collection("appointments").FindOne(ctx, bson.M{"id": id}).Decode(&appt)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointment", "details": err.Error()})
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
		if newStatus != models.StatusBooked && newStatus != models.StatusRejected {
			c.JSON(http.StatusBadRequest, gin.H{"error": "doctors may only accept (BOOKED) or reject (REJECTED) appointments"})
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
		// Admin may perform any valid transition; no additional restriction.

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

	// ── If doctor is accepting: create a LiveKit consultation room ────────────
	var roomName string
	if newStatus == models.StatusBooked {
		roomName, err = h.telemediaSvc.CreateRoom(appt.ID)
		if err != nil {
			log.Printf("[appointment-service] failed to create consultation room for %s: %v", appt.ID, err)
			// Non-fatal: proceed without a room rather than blocking acceptance.
			roomName = ""
		}
	}

	// ── Persist ────────────────────────────────────────────────────────────────
	updateCtx, updateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer updateCancel()

	setFields := bson.M{
		"status":    newStatus,
		"updatedAt": time.Now(),
	}
	if roomName != "" {
		setFields["consultationRoomName"] = roomName
	}

	res, err := h.db.DB.Collection("appointments").UpdateOne(
		updateCtx,
		bson.M{"id": id, "status": appt.Status}, // optimistic concurrency guard
		bson.M{"$set": setFields},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update appointment", "details": err.Error()})
		return
	}
	if res.MatchedCount == 0 {
		// Another goroutine changed the status between our read and write.
		c.JSON(http.StatusConflict, gin.H{"error": "appointment status was modified concurrently; please retry"})
		return
	}

	// Fire-and-forget notification.
	go h.notifSvc.SendStatusUpdate(appt.ID, appt.PatientEmail, appt.DoctorID, appt.Date, appt.Time, newStatus)

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

	var req models.RescheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	// Validate new date/time format.
	scheduled, err := time.Parse("2006-01-02 15:04", req.Date+" "+req.Time)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date/time format; expected YYYY-MM-DD and HH:MM (24-hour)"})
		return
	}

	// New slot must be at least 15 minutes in the future.
	if time.Until(scheduled) < 15*time.Minute {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rescheduled slot must be at least 15 minutes in the future"})
		return
	}

	// New slot must be within the 5-month booking window.
	maxDate := time.Now().AddDate(0, 5, 0)
	if scheduled.After(maxDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "appointment cannot be rescheduled more than 5 months in advance"})
		return
	}

	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var appt models.Appointment
	err = h.db.DB.Collection("appointments").FindOne(ctx, bson.M{"id": id}).Decode(&appt)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointment", "details": err.Error()})
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

	// Re-validate availability on the new slot (graceful: proceed if service down).
	available, err := h.doctorSvc.CheckAvailability(appt.DoctorID, req.Date, req.Time)
	if err != nil {
		log.Printf("[appointment-service] doctor availability check unavailable during reschedule: %v — relying on DB uniqueness guard", err)
	} else if !available {
		c.JSON(http.StatusConflict, gin.H{"error": "doctor is not available for the requested new slot"})
		return
	}

	// Update the appointment. Optimistic concurrency: match current status to prevent races.
	updateCtx, updateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer updateCancel()

	res, err := h.db.DB.Collection("appointments").UpdateOne(
		updateCtx,
		bson.M{"id": id, "status": appt.Status}, // optimistic guard
		bson.M{"$set": bson.M{
			"date":      req.Date,
			"time":      req.Time,
			"status":    models.StatusConfirmed, // payment already done; doctor must re-accept the new slot
			"updatedAt": time.Now(),
		}},
	)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "the new slot is already taken by another booking"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reschedule appointment", "details": err.Error()})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "appointment was modified concurrently; please retry"})
		return
	}

	log.Printf("[appointment-service] appointment %s rescheduled by patient %s to %s %s (reason: %s)", id, uid, req.Date, req.Time, req.Reason)

	// Fire-and-forget notification.
	go h.notifSvc.SendRescheduleNotification(appt.ID, appt.PatientEmail, appt.DoctorID, req.Date, req.Time)

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

	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var appt models.Appointment
	err := h.db.DB.Collection("appointments").FindOne(ctx, bson.M{"id": id}).Decode(&appt)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointment", "details": err.Error()})
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
			"updatedAt": time.Now(),
		}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to cancel appointment", "details": err.Error()})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "appointment was modified concurrently; please retry"})
		return
	}

	go h.notifSvc.SendStatusUpdate(appt.ID, appt.PatientEmail, appt.DoctorID, appt.Date, appt.Time, models.StatusCancelled)

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

	if !dbReady(h.db) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var appt models.Appointment
	err := h.db.DB.Collection("appointments").FindOne(ctx, bson.M{"id": id}).Decode(&appt)
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch appointment", "details": err.Error()})
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

	// Use optional ?name= query param as the LiveKit display name.
	displayName := c.Query("name")
	if displayName == "" {
		displayName = uid
	}

	token, err := h.telemediaSvc.GetJoinToken(appt.ConsultationRoomName, uid, displayName)
	if err != nil {
		log.Printf("[appointment-service] failed to get join token for %s (room=%s uid=%s): %v", id, appt.ConsultationRoomName, uid, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to issue consultation token", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"appointmentId": id,
		"roomName":      token.RoomName,
		"token":         token.Token,
		"wsUrl":         token.WsURL,
	})
}

// Health returns a liveness probe for the service.
func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"service":     "appointment-service",
		"status":      "OK",
		"dbConnected": dbReady(h.db),
	})
}
