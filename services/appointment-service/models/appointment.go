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
	PatientID            string    `json:"patientId"            bson:"patientId"`
	PatientName          string    `json:"patientName"          bson:"patientName"          binding:"required"` // display name shown to doctor
	PatientEmail         string    `json:"patientEmail"         bson:"patientEmail"         binding:"required"` // used for notifications
	DoctorID             string    `json:"doctorId"             bson:"doctorId"             binding:"required"`
	DoctorName           string    `json:"doctorName"           bson:"doctorName"`                              // populated at booking time; used for human-readable notifications
	DoctorEmail          string    `json:"doctorEmail"          bson:"doctorEmail"`                             // populated at booking time; used to notify doctor of reschedule
	Specialty            string    `json:"specialty"            bson:"specialty"            binding:"required"` // e.g. "Cardiology"
	Date                 string    `json:"date"                 bson:"date"                 binding:"required"` // YYYY-MM-DD
	Time                 string    `json:"time"                 bson:"time"                 binding:"required"` // HH:MM (24-hour)
	Status               string    `json:"status"               bson:"status"`
	PaymentStatus        string    `json:"paymentStatus"        bson:"paymentStatus"`                  // PENDING | COMPLETED | FAILED
	TransactionID        string    `json:"transactionId"        bson:"transactionId"`                  // payment-service transaction/session ID
	CheckoutURL          string    `json:"checkoutUrl"          bson:"checkoutUrl"`                    // Stripe checkout URL shown to patient
	ConsultationRoomName string    `json:"consultationRoomName" bson:"consultationRoomName"`           // LiveKit room name (set when BOOKED)
	RejectionReason      string    `json:"rejectionReason,omitempty" bson:"rejectionReason,omitempty"` // Doctor's reason for rejecting
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

// IsStarted reports whether the appointment's scheduled datetime (interpreted as UTC) is in the past.
// Returns true conservatively on parse failure so that a corrupt date/time cannot be used to
// bypass the "no cancel after start" guard.
func (a *Appointment) IsStarted() bool {
	t, err := time.ParseInLocation("2006-01-02 15:04", a.Date+" "+a.Time, time.UTC)
	if err != nil {
		return true // conservative: treat unparseable time as already started
	}
	return time.Now().UTC().After(t)
}

// ScheduledTime parses and returns the appointment's scheduled start time in UTC.
func (a *Appointment) ScheduledTime() time.Time {
	t, _ := time.ParseInLocation("2006-01-02 15:04", a.Date+" "+a.Time, time.UTC)
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
// Reason is required when Status == REJECTED.
type StatusUpdateRequest struct {
	Status string `json:"status" binding:"required"`
	Reason string `json:"reason"` // mandatory when Status == REJECTED
}

// DoctorAppointmentView is a read-only projection of an Appointment for doctor callers.
// It omits payment artifacts and patient contact details.
type DoctorAppointmentView struct {
	ID                   string    `json:"id"`
	PatientName          string    `json:"patientName"`
	Specialty            string    `json:"specialty"`
	Date                 string    `json:"date"`
	Time                 string    `json:"time"`
	Status               string    `json:"status"`
	ConsultationRoomName string    `json:"consultationRoomName,omitempty"`
	CreatedAt            time.Time `json:"createdAt"`
}

// ConfirmPaymentRequest is the body for POST /appointments/:id/confirm-payment.
// No fields are required — the handler uses the transactionId already stored on
// the appointment to verify payment status with the payment-service.
type ConfirmPaymentRequest struct{}
