package handlers

import (
	"context"
	"log"
	"net/http"
	"time"

	"payment-service/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// Handler holds the database connection
type Handler struct {
	db *mongo.Database
}

// NewHandler creates a new payment handler
func NewHandler(db *mongo.Database) *Handler {
	return &Handler{db: db}
}

// CreatePayment initiates a payment transaction
func (h *Handler) CreatePayment(c *gin.Context) {
	var req models.PaymentRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request", "details": err.Error()})
		return
	}

	// Validate required fields
	if req.AppointmentID == "" || req.PatientID == "" || req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing or invalid required fields"})
		return
	}

	// Generate unique transaction ID
	transactionID := "TXN-" + uuid.New().String()
	checkoutURL := "https://sandbox-payment.com/checkout/" + transactionID

	payment := models.Payment{
		AppointmentID: req.AppointmentID,
		PatientID:     req.PatientID,
		DoctorID:      req.DoctorID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Status:        models.PaymentPending,
		PaymentMethod: req.PaymentMethod,
		TransactionID: transactionID,
		CheckoutURL:   checkoutURL,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := h.db.Collection("payments").InsertOne(ctx, payment)
	if err != nil {
		log.Printf("failed to create payment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create payment"})
		return
	}

	response := models.PaymentResponse{
		ID:          result.InsertedID.(interface{}).(string),
		Status:      string(models.PaymentPending),
		CheckoutURL: checkoutURL,
		Amount:      req.Amount,
		Currency:    req.Currency,
		CreatedAt:   time.Now(),
	}

	c.JSON(http.StatusCreated, response)
}

// GetPayment retrieves a payment by transaction ID
func (h *Handler) GetPayment(c *gin.Context) {
	transactionID := c.Param("transactionId")

	if transactionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "transaction ID required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var payment models.Payment
	err := h.db.Collection("payments").FindOne(ctx, bson.M{"transactionId": transactionID}).Decode(&payment)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
			return
		}
		log.Printf("failed to retrieve payment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve payment"})
		return
	}

	c.JSON(http.StatusOK, payment)
}

// HandleWebhook processes payment provider webhook
func (h *Handler) HandleWebhook(c *gin.Context) {
	var payload models.WebhookPayload

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook payload"})
		return
	}

	if payload.TransactionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "transactionId required in webhook"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Update payment status based on webhook
	status := models.PaymentFailed
	completedAt := (*time.Time)(nil)

	if payload.Status == "success" || payload.Status == "completed" {
		status = models.PaymentCompleted
		now := time.Now()
		completedAt = &now
	} else if payload.Status == "cancelled" {
		status = models.PaymentCancelled
	}

	updateData := bson.M{
		"status":           status,
		"updatedAt":        time.Now(),
		"providerResponse": payload.Data,
	}

	if completedAt != nil {
		updateData["completedAt"] = completedAt
	}

	result, err := h.db.Collection("payments").UpdateOne(
		ctx,
		bson.M{"transactionId": payload.TransactionID},
		bson.M{"$set": updateData},
	)

	if err != nil {
		log.Printf("failed to update payment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process webhook"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "webhook processed successfully",
		"transactionId": payload.TransactionID,
		"status":        status,
	})
}

// GetPaymentsByPatient retrieves all payments for a patient
func (h *Handler) GetPaymentsByPatient(c *gin.Context) {
	patientID := c.Param("patientId")

	if patientID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patient ID required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := h.db.Collection("payments").Find(ctx, bson.M{"patientId": patientID})
	if err != nil {
		log.Printf("failed to retrieve payments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve payments"})
		return
	}
	defer cursor.Close(ctx)

	var payments []models.Payment
	if err = cursor.All(ctx, &payments); err != nil {
		log.Printf("failed to decode payments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode payments"})
		return
	}

	c.JSON(http.StatusOK, payments)
}

// CancelPayment cancels a pending payment
func (h *Handler) CancelPayment(c *gin.Context) {
	transactionID := c.Param("transactionId")

	if transactionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "transaction ID required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := h.db.Collection("payments").UpdateOne(
		ctx,
		bson.M{
			"transactionId": transactionID,
			"status":        models.PaymentPending,
		},
		bson.M{"$set": bson.M{
			"status":    models.PaymentCancelled,
			"updatedAt": time.Now(),
		}},
	)

	if err != nil {
		log.Printf("failed to cancel payment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to cancel payment"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found or not in pending status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "payment cancelled successfully",
		"transactionId": transactionID,
	})
}
