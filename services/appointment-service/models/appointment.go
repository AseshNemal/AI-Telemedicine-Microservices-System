package models

import "time"

// ── Appointment status constants ───────────────────────────────────────────────
//
// Full lifecycle:
//   PENDING_PAYMENT → (payment completed) → CONFIRMED
//   CONFIRMED       → (doctor accepts)    → BOOKED
//   CONFIRMED       → (doctor rejects)    → REJECTED
//   BOOKED          → (consultation)      → COMPLETED
//   * (any active)  → (patient/admin)     → CANCELLED  (only if not yet started)
const (
	StatusPendingPayment = "PENDING_PAYMENT" // Step 1: patient booked, payment not yet done
	StatusConfirmed      = "CONFIRMED"       // Step 2: payment done, awaiting doctor acceptance
	StatusBooked         = "BOOKED"          // Step 3: doctor accepted; LiveKit room created
	StatusRejected       = "REJECTED"        // Doctor declined the appointment
	StatusCancelled      = "CANCELLED"       // Cancelled by patient or admin
	StatusCompleted      = "COMPLETED"       // Consultation completed
)

// ── Payment status constants ───────────────────────────────────────────────────
const (
	PaymentPending   = "PENDING"
	PaymentCompleted = "COMPLETED"
	PaymentFailed    = "FAILED"
)

// ValidTransitions maps each status to the set of statuses it may legally advance to.
var ValidTransitions = map[string][]string{
	StatusPendingPayment: {StatusConfirmed, StatusCancelled},
	StatusConfirmed:      {StatusBooked, StatusRejected, StatusCancelled},
	StatusBooked:         {StatusCompleted, StatusCancelled},
	StatusRejected:       {},
	StatusCancelled:      {},
	StatusCompleted:      {},
}

// Appointment represents a patient-doctor consultation booking persisted in MongoDB.
type Appointment struct {
	ID                   string    `json:"id"                   bson:"id"`
	PatientID            string    `json:"patientId"            bson:"patientId"            binding:"required"`
	PatientName          string    `json:"patientName"          bson:"patientName"          binding:"required"` // display name shown to doctor
	PatientEmail         string    `json:"patientEmail"         bson:"patientEmail"         binding:"required"` // used for notifications
	DoctorID             string    `json:"doctorId"             bson:"doctorId"             binding:"required"`
	Specialty            string    `json:"specialty"            bson:"specialty"            binding:"required"` // e.g. "Cardiology"
	Date                 string    `json:"date"                 bson:"date"                 binding:"required"` // YYYY-MM-DD
	Time                 string    `json:"time"                 bson:"time"                 binding:"required"` // HH:MM (24-hour)
	Status               string    `json:"status"               bson:"status"`
	PaymentStatus        string    `json:"paymentStatus"        bson:"paymentStatus"`        // PENDING | COMPLETED | FAILED
	TransactionID        string    `json:"transactionId"        bson:"transactionId"`        // payment-service transaction/session ID
	CheckoutURL          string    `json:"checkoutUrl"          bson:"checkoutUrl"`          // Stripe checkout URL shown to patient
	ConsultationRoomName string    `json:"consultationRoomName" bson:"consultationRoomName"` // LiveKit room name (set when BOOKED)
	CreatedAt            time.Time `json:"createdAt"            bson:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"            bson:"updatedAt"`
}

// CanTransitionTo reports whether moving from the current status to next is a valid transition.
func (a *Appointment) CanTransitionTo(next string) bool {
	for _, allowed := range ValidTransitions[a.Status] {
		if allowed == next {
			return true
		}
	}
	return false
}

// IsStarted reports whether the appointment's scheduled datetime is in the past.
func (a *Appointment) IsStarted() bool {
	t, err := time.Parse("2006-01-02 15:04", a.Date+" "+a.Time)
	if err != nil {
		return false
	}
	return time.Now().After(t)
}

// ScheduledTime parses and returns the appointment's scheduled start time.
func (a *Appointment) ScheduledTime() time.Time {
	t, _ := time.Parse("2006-01-02 15:04", a.Date+" "+a.Time)
	return t
}

// ── Request types ─────────────────────────────────────────────────────────────

// RescheduleRequest is the payload for a reschedule operation.
// Reason is MANDATORY — the patient must explain why they are rescheduling.
type RescheduleRequest struct {
	Date   string `json:"date"   binding:"required"`
	Time   string `json:"time"   binding:"required"`
	Reason string `json:"reason" binding:"required"` // mandatory justification
}

// StatusUpdateRequest carries a new status value from the caller.
type StatusUpdateRequest struct {
	Status string `json:"status" binding:"required"`
}

// ConfirmPaymentRequest is the body for POST /appointments/:id/confirm-payment.
// No fields are required — the handler uses the transactionId already stored on
// the appointment to verify payment status with the payment-service.
type ConfirmPaymentRequest struct{}
