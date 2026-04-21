package handlers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"payment-service/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	"github.com/stripe/stripe-go/v81/refund"
	"github.com/stripe/stripe-go/v81/webhook"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
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

	_, err = h.db.Collection("payments").InsertOne(ctx, payment)
	if err != nil {
		log.Printf("failed to create payment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create payment"})
		return
	}

	// Return the user-facing transaction ID we generated so callers
	// (appointment-service) can use it to later verify the payment.
	response := models.PaymentResponse{
		ID:          transactionID,
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

	// Try to read back the payment record so the frontend can correlate the
	// Stripe session with our appointment/transaction IDs and act (e.g. auto-confirm).
	var payment models.Payment
	if err := h.db.Collection("payments").FindOne(ctx, bson.M{"providerId": stripeSession.ID}).Decode(&payment); err != nil {
		// If we couldn't find the record, log and still return the session status.
		log.Printf("failed to load payment after stripe session update: %v", err)
		c.JSON(http.StatusOK, gin.H{
			"message":       "payment verification completed",
			"sessionId":     stripeSession.ID,
			"paymentStatus": stripeSession.PaymentStatus,
			"status":        newStatus,
		})
		return
	}

	if newStatus == models.PaymentCompleted {
		if err := notifyAppointmentPaymentConfirmed(payment.AppointmentID, payment.TransactionID); err != nil {
			log.Printf("failed to auto-confirm appointment %s after payment completion: %v", payment.AppointmentID, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "payment verification completed",
		"sessionId":     stripeSession.ID,
		"paymentStatus": stripeSession.PaymentStatus,
		"status":        newStatus,
		"appointmentId": payment.AppointmentID,
		"transactionId": payment.TransactionID,
	})
}

func notifyAppointmentPaymentConfirmed(appointmentID, transactionID string) error {
	appointmentBase := strings.TrimSpace(os.Getenv("APPOINTMENT_SERVICE_URL"))
	if appointmentBase == "" {
		appointmentBase = "http://localhost:8083"
	}

	internalKey := strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_KEY"))
	if internalKey == "" {
		return fmt.Errorf("INTERNAL_SERVICE_KEY is not configured")
	}

	body, err := json.Marshal(map[string]string{"transactionId": transactionID})
	if err != nil {
		return fmt.Errorf("marshal internal confirm payload: %w", err)
	}

	endpoint := strings.TrimRight(appointmentBase, "/") + "/internal/appointments/" + url.PathEscape(strings.TrimSpace(appointmentID)) + "/confirm-payment"
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("create internal confirm request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Service-Key", internalKey)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("call appointment internal confirm: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("appointment internal confirm returned %d: %s", resp.StatusCode, string(b))
	}

	return nil
}

func resolveStripeSecretKey() string {
	if v := normalizeEnvScalar(os.Getenv("STRIPE_SECRET_KEY")); v != "" {
		return v
	}

	return normalizeEnvScalar(findEnvValue("STRIPE_SECRET_KEY", ".env", "../.env", "../../.env"))
}

func resolveStripeWebhookSecret() string {
	if v := normalizeEnvScalar(os.Getenv("STRIPE_WEBHOOK_SECRET")); v != "" {
		return v
	}

	return normalizeEnvScalar(findEnvValue("STRIPE_WEBHOOK_SECRET", ".env", "../.env", "../../.env"))
}

func normalizeEnvScalar(value string) string {
	v := strings.TrimSpace(value)
	if len(v) >= 2 {
		if (v[0] == '"' && v[len(v)-1] == '"') || (v[0] == '\'' && v[len(v)-1] == '\'') {
			v = v[1 : len(v)-1]
		}
	}
	return strings.TrimSpace(v)
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

	// Backwards-compat: older bookings used the Mongo inserted ID (string)
	// as the returned payment ID. Support lookup by either `transactionId`
	// (new behaviour) or by the Mongo `_id` so ConfirmPayment works for
	// payments created before the transactionId change.
	var filter bson.M
	if oid, err := primitive.ObjectIDFromHex(transactionID); err == nil {
		filter = bson.M{"$or": bson.A{bson.M{"transactionId": transactionID}, bson.M{"_id": oid}}}
	} else {
		filter = bson.M{"transactionId": transactionID}
	}

	err := h.db.Collection("payments").FindOne(ctx, filter).Decode(&payment)
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

// HandleWebhook processes Stripe webhook events with signature verification (C-5, C-7).
func (h *Handler) HandleWebhook(c *gin.Context) {
	// Read raw body for signature verification — Stripe requires the raw bytes.
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	// Verify Stripe webhook signature (C-5).
	endpointSecret := resolveStripeWebhookSecret()
	if endpointSecret == "" {
		log.Println("[payment-service] STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "webhook secret not configured"})
		return
	}

	sigHeader := c.GetHeader("Stripe-Signature")
	event, err := webhook.ConstructEvent(body, sigHeader, endpointSecret)
	if err != nil {
		log.Printf("[payment-service] webhook signature verification failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook signature"})
		return
	}

	// Only handle checkout.session.completed and checkout.session.expired events.
	switch event.Type {
	case "checkout.session.completed":
		var sess stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
			log.Printf("[payment-service] failed to unmarshal checkout session: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid event data"})
			return
		}
		h.handleCheckoutCompleted(&sess, c)
	case "checkout.session.expired":
		var sess stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
			log.Printf("[payment-service] failed to unmarshal checkout session: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid event data"})
			return
		}
		h.handleCheckoutExpired(&sess, c)
	default:
		// Acknowledge other event types without processing.
		c.JSON(http.StatusOK, gin.H{"message": "event type not handled", "type": event.Type})
		return
	}
}

func (h *Handler) handleCheckoutCompleted(sess *stripe.CheckoutSession, c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	updateData := bson.M{
		"status":      models.PaymentCompleted,
		"updatedAt":   now,
		"completedAt": &now,
		"providerResponse": bson.M{
			"provider":      "stripe",
			"sessionId":     sess.ID,
			"paymentStatus": sess.PaymentStatus,
			"sessionStatus": sess.Status,
		},
	}

	result, err := h.db.Collection("payments").UpdateOne(
		ctx,
		bson.M{"providerId": sess.ID, "status": models.PaymentPending},
		bson.M{"$set": updateData},
	)
	if err != nil {
		log.Printf("[payment-service] failed to update payment from webhook: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process webhook"})
		return
	}

	if result.MatchedCount == 0 {
		// Idempotent: already processed or unknown session.
		c.JSON(http.StatusOK, gin.H{"message": "already processed or not found"})
		return
	}

	// Auto-confirm the appointment (C-7).
	var payment models.Payment
	if err := h.db.Collection("payments").FindOne(ctx, bson.M{"providerId": sess.ID}).Decode(&payment); err == nil {
		if cErr := notifyAppointmentPaymentConfirmed(payment.AppointmentID, payment.TransactionID); cErr != nil {
			log.Printf("[payment-service] failed to auto-confirm appointment %s: %v", payment.AppointmentID, cErr)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "payment completed via webhook"})
}

func (h *Handler) handleCheckoutExpired(sess *stripe.CheckoutSession, c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := h.db.Collection("payments").UpdateOne(
		ctx,
		bson.M{"providerId": sess.ID, "status": models.PaymentPending},
		bson.M{"$set": bson.M{
			"status":    models.PaymentFailed,
			"updatedAt": time.Now(),
		}},
	)
	if err != nil {
		log.Printf("[payment-service] failed to expire payment from webhook: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "session expiry processed"})
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

// RefundPayment issues a Stripe refund for a completed payment (C-1).
// POST /payments/:transactionId/refund
func (h *Handler) RefundPayment(c *gin.Context) {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve payment"})
		return
	}

	if payment.Status == models.PaymentRefunded {
		// Idempotent: already refunded.
		c.JSON(http.StatusOK, gin.H{"message": "payment already refunded", "transactionId": transactionID})
		return
	}

	if payment.Status != models.PaymentCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("cannot refund payment with status %s; must be COMPLETED", payment.Status)})
		return
	}

	// Issue refund via Stripe using the checkout session's payment_intent.
	stripeSecret := resolveStripeSecretKey()
	if stripeSecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "STRIPE_SECRET_KEY is not configured"})
		return
	}
	stripe.Key = stripeSecret

	// Retrieve the checkout session to get the PaymentIntent ID.
	if payment.ProviderID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no Stripe session ID found on payment record"})
		return
	}

	sess, err := session.Get(payment.ProviderID, nil)
	if err != nil {
		log.Printf("[payment-service] failed to retrieve stripe session %s for refund: %v", payment.ProviderID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to retrieve Stripe session for refund"})
		return
	}

	if sess.PaymentIntent == nil || sess.PaymentIntent.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no payment intent associated with this session; cannot refund"})
		return
	}

	refundParams := &stripe.RefundParams{
		PaymentIntent: stripe.String(sess.PaymentIntent.ID),
	}
	// Idempotency key to prevent duplicate refunds.
	refundParams.IdempotencyKey = stripe.String("refund-" + transactionID)

	_, err = refund.New(refundParams)
	if err != nil {
		log.Printf("[payment-service] Stripe refund failed for txn %s: %v", transactionID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Stripe refund failed"})
		return
	}

	// Mark payment as REFUNDED in the database.
	refundCtx, refundCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer refundCancel()

	_, err = h.db.Collection("payments").UpdateOne(
		refundCtx,
		bson.M{"transactionId": transactionID, "status": models.PaymentCompleted},
		bson.M{"$set": bson.M{
			"status":    models.PaymentRefunded,
			"updatedAt": time.Now(),
		}},
	)
	if err != nil {
		log.Printf("[payment-service] failed to mark payment %s as REFUNDED in DB: %v", transactionID, err)
		// Refund already issued to Stripe — log but don't fail the response.
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "payment refunded successfully",
		"transactionId": transactionID,
	})
}
