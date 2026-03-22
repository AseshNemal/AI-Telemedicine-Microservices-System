package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PaymentStatus defines the status of a payment
type PaymentStatus string

const (
	PaymentPending   PaymentStatus = "PENDING"
	PaymentCompleted PaymentStatus = "COMPLETED"
	PaymentFailed    PaymentStatus = "FAILED"
	PaymentCancelled PaymentStatus = "CANCELLED"
	PaymentRefunded  PaymentStatus = "REFUNDED"
)

// PaymentMethod defines the payment method
type PaymentMethod string

const (
	CardPayment   PaymentMethod = "CARD"
	MobilePayment PaymentMethod = "MOBILE"
	BankTransfer  PaymentMethod = "BANK_TRANSFER"
)

// Payment represents a payment transaction
type Payment struct {
	ID               primitive.ObjectID     `bson:"_id,omitempty" json:"id,omitempty"`
	AppointmentID    string                 `bson:"appointmentId" json:"appointmentId"`
	PatientID        string                 `bson:"patientId" json:"patientId"`
	DoctorID         string                 `bson:"doctorId" json:"doctorId"`
	Amount           float64                `bson:"amount" json:"amount"`
	Currency         string                 `bson:"currency" json:"currency"`
	Status           PaymentStatus          `bson:"status" json:"status"`
	PaymentMethod    PaymentMethod          `bson:"paymentMethod" json:"paymentMethod"`
	TransactionID    string                 `bson:"transactionId" json:"transactionId"`
	CheckoutURL      string                 `bson:"checkoutUrl" json:"checkoutUrl"`
	ProviderID       string                 `bson:"providerId" json:"providerId"` // Stripe, PayHere, etc.
	ProviderResponse map[string]interface{} `bson:"providerResponse" json:"providerResponse"`
	CreatedAt        time.Time              `bson:"createdAt" json:"createdAt"`
	UpdatedAt        time.Time              `bson:"updatedAt" json:"updatedAt"`
	CompletedAt      *time.Time             `bson:"completedAt,omitempty" json:"completedAt,omitempty"`
	Notes            string                 `bson:"notes" json:"notes"`
}

// PaymentRequest represents incoming payment request
type PaymentRequest struct {
	AppointmentID string        `json:"appointmentId" binding:"required"`
	PatientID     string        `json:"patientId" binding:"required"`
	DoctorID      string        `json:"doctorId" binding:"required"`
	Amount        float64       `json:"amount" binding:"required,min=0.01"`
	Currency      string        `json:"currency" binding:"required"`
	PaymentMethod PaymentMethod `json:"paymentMethod" binding:"required"`
}

// PaymentResponse represents payment response
type PaymentResponse struct {
	ID          string    `json:"id"`
	Status      string    `json:"status"`
	CheckoutURL string    `json:"checkoutUrl"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	CreatedAt   time.Time `json:"createdAt"`
}

// WebhookPayload represents payment provider webhook payload
type WebhookPayload struct {
	EventType     string                 `json:"eventType"`
	TransactionID string                 `json:"transactionId"`
	Status        string                 `json:"status"`
	Amount        float64                `json:"amount"`
	Data          map[string]interface{} `json:"data"`
}
