package models

import "time"

// VerificationStatus represents the lifecycle state of a doctor registration.
type VerificationStatus string

const (
	StatusPending   VerificationStatus = "PENDING"
	StatusVerified  VerificationStatus = "VERIFIED"
	StatusSuspended VerificationStatus = "SUSPENDED"
)

// ConsultationStatus represents the lifecycle of a consultation session.
type ConsultationStatus string

const (
	ConsultationPending   ConsultationStatus = "PENDING"
	ConsultationActive    ConsultationStatus = "ACTIVE"
	ConsultationCompleted ConsultationStatus = "COMPLETED"
)

// Medication is an element in the medications JSONB/array field.
type Medication struct {
	Name     string `json:"name" bson:"name"`
	Dosage   string `json:"dosage" bson:"dosage"`
	Duration string `json:"duration" bson:"duration"`
}

// Doctor is the canonical stored representation in the "doctors" collection.
type Doctor struct {
	ID                   string             `json:"id" bson:"id"`
	FirebaseUID          string             `json:"firebase_uid" bson:"firebase_uid"`
	Name                 string             `json:"name" bson:"name"`
	Specialty            string             `json:"specialty" bson:"specialty"`
	ExperienceYears      int                `json:"experience_years" bson:"experience_years"`
	ConsultationFeeCents int                `json:"consultation_fee_cents" bson:"consultation_fee_cents"`
	VerificationStatus   VerificationStatus `json:"verification_status" bson:"verification_status"`
	CreatedAt            time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt            time.Time          `json:"updated_at" bson:"updated_at"`
}

// Availability is one row in the "availability" collection.
type Availability struct {
	ID        string `json:"id" bson:"id"`
	DoctorID  string `json:"doctor_id" bson:"doctor_id"`
	DayOfWeek int    `json:"day_of_week" bson:"day_of_week"` // 0=Sunday … 6=Saturday
	StartTime string `json:"start_time" bson:"start_time"`   // "HH:MM"
	EndTime   string `json:"end_time" bson:"end_time"`       // "HH:MM"
}

// Consultation is one row in the "consultations" collection.
type Consultation struct {
	ID            string             `json:"id" bson:"id"`
	AppointmentID string             `json:"appointment_id" bson:"appointment_id"`
	DoctorID      string             `json:"doctor_id" bson:"doctor_id"`
	PatientID     string             `json:"patient_id" bson:"patient_id"`
	SessionID     string             `json:"session_id" bson:"session_id"`
	MeetingLink   string             `json:"meeting_link" bson:"meeting_link"`
	Notes         string             `json:"notes" bson:"notes"`
	Prescription  string             `json:"prescription" bson:"prescription"`
	Medications   []Medication       `json:"medications" bson:"medications"`
	Status        ConsultationStatus `json:"status" bson:"status"`
	CreatedAt     time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at" bson:"updated_at"`
}

// ── Request / Response types ──────────────────────────────────────────────────

// RegisterDoctorRequest is the payload for POST /doctors.
type RegisterDoctorRequest struct {
	Name                 string `json:"name" binding:"required"`
	Specialty            string `json:"specialty" binding:"required"`
	ExperienceYears      int    `json:"experience_years"`
	ConsultationFeeCents int    `json:"consultation_fee_cents"`
}

// UpdateDoctorRequest is the payload for PUT /doctors/:id (owner only).
type UpdateDoctorRequest struct {
	Name                 *string `json:"name"`
	Specialty            *string `json:"specialty"`
	ExperienceYears      *int    `json:"experience_years"`
	ConsultationFeeCents *int    `json:"consultation_fee_cents"`
}

// AvailabilitySlot is one element in the PUT /doctors/:id/availability body.
type AvailabilitySlot struct {
	DayOfWeek int    `json:"day_of_week" binding:"min=0,max=6"`
	StartTime string `json:"start_time" binding:"required"`
	EndTime   string `json:"end_time" binding:"required"`
}

// PrescriptionRequest is the POST /doctor/appointments/:id/prescription body.
type PrescriptionRequest struct {
	Notes            string       `json:"notes"`
	PrescriptionText string       `json:"prescription_text"`
	Medications      []Medication `json:"medications"`
}

// AcceptRejectRequest is the body for accept/reject appointment endpoints.
type AcceptRejectRequest struct {
	Reason string `json:"reason"`
}

// StartConsultationRequest is unused (no body needed) but kept for future extension.

// EndConsultationRequest is the body for POST …/consultation/end.
type EndConsultationRequest struct {
	Notes        string       `json:"notes"`
	Prescription string       `json:"prescription"`
	Medications  []Medication `json:"medications"`
}

// AvailabilityRequest is the POST /check-availability request body (internal).
type AvailabilityRequest struct {
	DoctorID string `json:"doctorId"`
	Date     string `json:"date"` // YYYY-MM-DD
	Time     string `json:"time"` // HH:MM
}

// AvailabilityResponse is the POST /check-availability response body.
type AvailabilityResponse struct {
	Available bool `json:"available"`
}
