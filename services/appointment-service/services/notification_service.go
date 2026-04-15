package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"log"
	"net/http"
	"strings"
	"time"
)

// NotificationService handles HTTP communication with the notification-service.
type NotificationService struct {
	baseURL    string
	httpClient *http.Client
}

// NewNotificationService creates a NotificationService that talks to the given baseURL.
func NewNotificationService(baseURL string) *NotificationService {
	return &NotificationService{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 3 * time.Second},
	}
}

// notificationRequest matches the notification-service POST /send-email payload:
// { "to": "...", "subject": "...", "message": "..." }
type notificationRequest struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Message string `json:"message"`
}

// readableAppointmentID converts internal IDs (e.g. APT-...) into user-friendly IDs (e.g. AP-1042).
// It is deterministic so the same internal ID always maps to the same public display ID.
func readableAppointmentID(appointmentID string) string {
	s := strings.TrimSpace(appointmentID)
	if s == "" {
		return "AP-0000"
	}
	h := fnv.New32a()
	_, _ = h.Write([]byte(s))
	n := 1000 + int(h.Sum32()%9000)
	return fmt.Sprintf("AP-%04d", n)
}

// sendEmail posts to POST /send-email. Errors are only logged — never returned —
// so callers can safely fire-and-forget in a goroutine.
func (s *NotificationService) sendEmail(to, subject, message string) {
	if to == "" {
		return
	}

	payload, err := json.Marshal(notificationRequest{
		To:      to,
		Subject: subject,
		Message: message,
	})
	if err != nil {
		log.Printf("[appointment-service] notification marshal error: %v", err)
		return
	}

	resp, err := s.httpClient.Post(
		s.baseURL+"/send-email",
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		log.Printf("[appointment-service] notification-service unreachable: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("[appointment-service] notification-service returned HTTP %d", resp.StatusCode)
	}
}

// sendSMS posts to POST /send-sms. Errors are only logged.
func (s *NotificationService) sendSMS(to, message string) {
	if to == "" {
		return
	}

	payload, err := json.Marshal(notificationRequest{
		To:      to,
		Message: message,
	})
	if err != nil {
		log.Printf("[appointment-service] sms marshal error: %v", err)
		return
	}

	resp, err := s.httpClient.Post(
		s.baseURL+"/send-sms",
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		log.Printf("[appointment-service] sms service unreachable: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("[appointment-service] sms service returned HTTP %d", resp.StatusCode)
	}
}

// SendBookingConfirmation notifies the patient that their appointment request
// was received and payment is required. m-7: The Stripe checkout URL is no
// longer embedded in the email body to prevent leaking a sensitive payment
// link. The patient should complete payment through the platform UI.
func (s *NotificationService) SendBookingConfirmation(appointmentID, patientEmail, patientPhone, patientName, doctorDisplay, specialty, date, timeSlot, _ string) {
	publicID := readableAppointmentID(appointmentID)
	subject := "Complete Your Payment — Appointment Request Received"
	message := fmt.Sprintf(
		"Dear %s,\n\nYour appointment request has been received.\n\nAppointment Details:\n  Appointment ID: %s\n  Patient Name:   %s\n  Patient Email:   %s\n  Doctor:         Dr. %s\n  Specialty:      %s\n  Date:           %s\n  Time:           %s\n  Status:         PENDING_PAYMENT\n\nYour appointment is NOT yet confirmed. Please log in to the platform to complete payment and proceed.",
		patientName, publicID, patientName, patientEmail, doctorDisplay, specialty, date, timeSlot,
	)
	s.sendEmail(patientEmail, subject, message)
	s.sendSMS(patientPhone, fmt.Sprintf("Appt %s received: Dr. %s, %s %s, status PENDING_PAYMENT. Pay in app.", publicID, doctorDisplay, date, timeSlot))
}

// SendPaymentConfirmation notifies the patient that payment was successful and
// their appointment is now confirmed (awaiting doctor acceptance).
func (s *NotificationService) SendPaymentConfirmation(appointmentID, patientEmail, patientPhone, patientName, doctorDisplay, specialty, appointmentType, hospitalName, meetingLink, date, timeSlot string) {
	publicID := readableAppointmentID(appointmentID)
	subject := fmt.Sprintf("Payment Successful — Appointment %s Confirmed", publicID)
	body := fmt.Sprintf(
		"Dear %s,\n\nYour payment has been received. Your appointment is now confirmed.\n\nAppointment Details:\n  Appointment ID: %s\n  Patient Name:   %s\n  Doctor:         Dr. %s\n  Specialty:      %s\n  Type:           %s\n  Date:           %s\n  Time:           %s\n  Status:         CONFIRMED\n  Payment Status: COMPLETED",
		patientName, publicID, patientName, doctorDisplay, specialty, appointmentType, date, timeSlot,
	)
	if appointmentType == "PHYSICAL" && hospitalName != "" {
		body += fmt.Sprintf("\n  Hospital:       %s", hospitalName)
	}
	if appointmentType == "VIRTUAL" && meetingLink != "" {
		body += fmt.Sprintf("\n  Meeting Link:   %s", meetingLink)
	}
	body += "\n\nYou will be notified once the doctor accepts or rejects your request."
	s.sendEmail(patientEmail, subject, body)
	sms := fmt.Sprintf("Payment confirmed for appt %s: Dr. %s, %s %s. Status CONFIRMED.", publicID, doctorDisplay, date, timeSlot)
	if appointmentType == "PHYSICAL" && hospitalName != "" {
		sms += " Hospital: " + hospitalName + "."
	}
	if appointmentType == "VIRTUAL" && meetingLink != "" {
		sms += " Meeting: " + meetingLink
	}
	s.sendSMS(patientPhone, sms)
}

// SendStatusUpdate notifies the patient when their appointment status changes.
// reason is included in the message when status is REJECTED.
func (s *NotificationService) SendStatusUpdate(appointmentID, patientEmail, patientPhone, doctorDisplay, date, timeSlot, newStatus, reason string) {
	publicID := readableAppointmentID(appointmentID)
	messages := map[string]string{
		"BOOKED":    "Great news! Your appointment has been accepted by the doctor.",
		"REJECTED":  "Unfortunately, your appointment request was declined by the doctor. If you had already paid, a refund will be processed automatically. You may reschedule with the same or a different doctor at any time.",
		"CANCELLED": "Your appointment has been cancelled.",
		"COMPLETED": "Your consultation has been completed. Thank you for using our service.",
	}
	msg, ok := messages[newStatus]
	if !ok {
		msg = "Your appointment status has been updated to: " + newStatus
	}
	if newStatus == "REJECTED" && reason != "" {
		msg += "\nReason provided: " + reason
	}

	subject := fmt.Sprintf("Appointment %s — %s", publicID, newStatus)
	body := fmt.Sprintf("%s\n\nAppointment ID: %s\nDoctor: Dr. %s\nDate: %s at %s", msg, publicID, doctorDisplay, date, timeSlot)
	s.sendEmail(patientEmail, subject, body)
	s.sendSMS(patientPhone, fmt.Sprintf("Appointment %s is now %s. %s", publicID, newStatus, msg))
}

// SendRescheduleNotification notifies the patient that their reschedule is pending re-confirmation.
func (s *NotificationService) SendRescheduleNotification(appointmentID, patientEmail, patientPhone, doctorDisplay, newDate, newTime string) {
	publicID := readableAppointmentID(appointmentID)
	subject := fmt.Sprintf("Appointment %s — Rescheduled", publicID)
	body := fmt.Sprintf(
		"Your appointment with Dr. %s has been rescheduled to %s at %s and is awaiting re-confirmation.\n\nAppointment ID: %s",
		doctorDisplay, newDate, newTime, publicID,
	)
	s.sendEmail(patientEmail, subject, body)
	s.sendSMS(patientPhone, fmt.Sprintf("Appointment %s rescheduled to %s %s. Awaiting doctor reconfirmation.", publicID, newDate, newTime))
}

// SendDoctorRescheduleAlert notifies the doctor that a patient has rescheduled
// their appointment and that their acceptance is required again.
func (s *NotificationService) SendDoctorRescheduleAlert(appointmentID, doctorEmail, patientName, newDate, newTime string) {
	publicID := readableAppointmentID(appointmentID)
	subject := fmt.Sprintf("Patient Rescheduled — Appointment %s", publicID)
	body := fmt.Sprintf(
		"Your patient %s has rescheduled appointment %s to %s at %s.\n\nPlease log in to accept or reject the new slot.",
		patientName, publicID, newDate, newTime,
	)
	s.sendEmail(doctorEmail, subject, body)
}
