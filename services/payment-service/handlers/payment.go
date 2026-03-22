package handlers

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"payment-service/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
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

	stripeSecret := resolveStripeSecretKey()
	if stripeSecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "STRIPE_SECRET_KEY is not configured"})
		return
	}

	stripe.Key = stripeSecret

	currency := strings.ToLower(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "usd"
	}

	frontendBaseURL := strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL"))
	if frontendBaseURL == "" {
		frontendBaseURL = "http://localhost:3000"
	}

	stripeParams := &stripe.CheckoutSessionParams{
		Mode:               stripe.String(string(stripe.CheckoutSessionModePayment)),
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String(currency),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String("Telemedicine Appointment Payment"),
					},
					UnitAmount: stripe.Int64(int64(math.Round(req.Amount * 100))),
				},
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(frontendBaseURL + "/payments/success?session_id={CHECKOUT_SESSION_ID}"),
		CancelURL:  stripe.String(frontendBaseURL + "/payments/cancel"),
		Metadata: map[string]string{
			"transactionId": transactionID,
			"appointmentId": req.AppointmentID,
			"patientId":     req.PatientID,
			"doctorId":      req.DoctorID,
		},
	}

	stripeSession, err := session.New(stripeParams)
	if err != nil {
		log.Printf("failed to create stripe checkout session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create stripe checkout session"})
		return
	}

	checkoutURL := stripeSession.URL

	payment := models.Payment{
		AppointmentID: req.AppointmentID,
		PatientID:     req.PatientID,
		DoctorID:      req.DoctorID,
		Amount:        req.Amount,
		Currency:      strings.ToUpper(currency),
		Status:        models.PaymentPending,
		PaymentMethod: req.PaymentMethod,
		TransactionID: transactionID,
		CheckoutURL:   checkoutURL,
		ProviderID:    stripeSession.ID,
		ProviderResponse: map[string]interface{}{
			"provider":  "stripe",
			"sessionId": stripeSession.ID,
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
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
		ID:          fmt.Sprint(result.InsertedID),
		Status:      string(models.PaymentPending),
		CheckoutURL: checkoutURL,
		Amount:      req.Amount,
		Currency:    strings.ToUpper(currency),
		CreatedAt:   time.Now(),
	}

	c.JSON(http.StatusCreated, response)
}

// VerifyPaymentNoWebhook verifies Stripe checkout session and updates payment status
func (h *Handler) VerifyPaymentNoWebhook(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Query("session_id"))
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id query parameter is required"})
		return
	}

	stripeSecret := resolveStripeSecretKey()
	if stripeSecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "STRIPE_SECRET_KEY is not configured"})
		return
	}

	stripe.Key = stripeSecret

	stripeSession, err := session.Get(sessionID, nil)
	if err != nil {
		log.Printf("failed to retrieve stripe session %s: %v", sessionID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	newStatus := models.PaymentPending
	if stripeSession.PaymentStatus == stripe.CheckoutSessionPaymentStatusPaid {
		newStatus = models.PaymentCompleted
	} else if stripeSession.Status == stripe.CheckoutSessionStatusExpired {
		newStatus = models.PaymentFailed
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	updateData := bson.M{
		"status":    newStatus,
		"updatedAt": time.Now(),
		"providerResponse": bson.M{
			"provider":      "stripe",
			"sessionId":     stripeSession.ID,
			"paymentStatus": stripeSession.PaymentStatus,
			"sessionStatus": stripeSession.Status,
		},
	}

	if newStatus == models.PaymentCompleted {
		now := time.Now()
		updateData["completedAt"] = &now
	}

	result, err := h.db.Collection("payments").UpdateOne(
		ctx,
		bson.M{"providerId": stripeSession.ID},
		bson.M{"$set": updateData},
	)
	if err != nil {
		log.Printf("failed to update payment status from stripe session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update payment status"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found for given session_id"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "payment verification completed",
		"sessionId":     stripeSession.ID,
		"paymentStatus": stripeSession.PaymentStatus,
		"status":        newStatus,
	})
}

func resolveStripeSecretKey() string {
	if v := strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")); v != "" {
		return v
	}

	return findEnvValue("STRIPE_SECRET_KEY", ".env", "../.env", "../../.env")
}

func findEnvValue(key string, paths ...string) string {
	for _, p := range paths {
		if value, ok := readEnvValueFromFile(key, p); ok {
			return value
		}
	}
	return ""
}

func readEnvValueFromFile(key, path string) (string, bool) {
	file, err := os.Open(filepath.Clean(path))
	if err != nil {
		return "", false
	}
	defer file.Close()

	prefix := key + "="
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, prefix) {
			value := strings.TrimSpace(strings.TrimPrefix(line, prefix))
			value = strings.Trim(value, `"'`)
			return value, true
		}
	}

	return "", false
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
