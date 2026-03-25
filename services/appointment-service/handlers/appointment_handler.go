package handlers

import (
	"appointment-service/database"
	"appointment-service/models"
	"appointment-service/services"
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	db         *database.Client
	doctorSvc  *services.DoctorService
	paymentSvc *services.PaymentService
	notifSvc   *services.NotificationService
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

	return &Handler{
		db:         db,
		doctorSvc:  services.NewDoctorService(doctorBase),
		paymentSvc: services.NewPaymentService(paymentBase),
		notifSvc:   services.NewNotificationService(notifBase),
	}
}

// CreateAppointment orchestrates the full appointment-booking workflow:
//
//  1. Validate the request body.
//  2. Check doctor availability via the doctor-service.
//  3. Process payment via the payment-service.
//  4. Persist the appointment document in MongoDB.
//  5. Send a confirmation notification (fire-and-forget goroutine).
//  6. Return HTTP 201 with a success message.
func (h *Handler) CreateAppointment(c *gin.Context) {
	// Step 1 – parse and validate request body.
	var req models.Appointment
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	// Step 2 – check doctor availability.
	available, err := h.doctorSvc.CheckAvailability(req.DoctorID, req.Date, req.Time)
	if err != nil {
		log.Printf("[appointment-service] doctor availability check failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach doctor service", "details": err.Error()})
		return
	}
	if !available {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Doctor not available"})
		return
	}

	// Step 3 – process payment.
	if err := h.paymentSvc.ProcessPayment(req.PatientID, req.DoctorID); err != nil {
		log.Printf("[appointment-service] payment failed: %v", err)
		c.JSON(http.StatusPaymentRequired, gin.H{"error": "Payment failed", "details": err.Error()})
		return
	}

	// Step 4 – persist appointment to MongoDB.
	if h.db == nil || !h.db.Connected || h.db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	req.ID = "apt-" + time.Now().Format("20060102150405")
	req.Status = "BOOKED"
	req.CreatedAt = time.Now()

	doc := bson.M{
		"id":        req.ID,
		"patientId": req.PatientID,
		"doctorId":  req.DoctorID,
		"date":      req.Date,
		"time":      req.Time,
		"status":    req.Status,
		"createdAt": req.CreatedAt,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := h.db.DB.Collection("appointments").InsertOne(ctx, doc); err != nil {
		log.Printf("[appointment-service] mongo insert failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save appointment", "details": err.Error()})
		return
	}

	// Step 5 – fire-and-forget: send confirmation notification without blocking.
	go h.notifSvc.SendAppointmentConfirmation()

	// Step 6 – return success.
	c.JSON(http.StatusCreated, gin.H{"message": "Appointment booked successfully"})
}

// GetAppointments returns the full list of appointments stored in MongoDB.
func (h *Handler) GetAppointments(c *gin.Context) {
	if h.db == nil || !h.db.Connected || h.db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := h.db.DB.Collection("appointments").Find(ctx, bson.D{})
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

// DeleteAppointment cancels an appointment identified by the :id URL parameter.
func (h *Handler) DeleteAppointment(c *gin.Context) {
	id := c.Param("id")

	if h.db == nil || !h.db.Connected || h.db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := h.db.DB.Collection("appointments").DeleteOne(ctx, bson.M{"id": id})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete appointment", "details": err.Error()})
		return
	}

	if res.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "appointment cancelled", "id": id})
}

// Health returns a simple liveness probe for the service.
func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"service":     "appointment-service",
		"status":      "OK",
		"dbConnected": h.db != nil && h.db.Connected,
	})
}
