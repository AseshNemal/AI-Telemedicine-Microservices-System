package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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

// send posts to POST /send-email. Errors are only logged — never returned —
// so callers can safely fire-and-forget in a goroutine.
func (s *NotificationService) send(to, subject, message string) {
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

// SendBookingConfirmation notifies the patient that their appointment request
// was received and a payment checkout link is ready for them to complete.
func (s *NotificationService) SendBookingConfirmation(appointmentID, patientEmail, patientName, doctorID, specialty, date, timeSlot, checkoutURL string) {
	subject := "Complete Your Payment — Appointment Request Received"
	message := fmt.Sprintf(
		"Dear %s,\n\nYour appointment request (ID: %s) for %s with doctor %s on %s at %s has been received.\n\nYour appointment is NOT yet confirmed. Please complete payment to proceed:\n%s",
		patientName, appointmentID, specialty, doctorID, date, timeSlot, checkoutURL,
	)
	s.send(patientEmail, subject, message)
}

// SendPaymentConfirmation notifies the patient that payment was successful and
// their appointment is now confirmed (awaiting doctor acceptance).
func (s *NotificationService) SendPaymentConfirmation(appointmentID, patientEmail, patientName, doctorID, specialty, date, timeSlot string) {
	subject := fmt.Sprintf("Payment Successful — Appointment %s Confirmed", appointmentID)
	body := fmt.Sprintf(
		"Dear %s,\n\nYour payment has been received. Your appointment is now confirmed and awaiting the doctor's acceptance.\n\nAppointment Details:\n  ID:        %s\n  Specialty: %s\n  Doctor:    %s\n  Date:      %s\n  Time:      %s\n\nYou will be notified once the doctor accepts or rejects your request.",
		patientName, appointmentID, specialty, doctorID, date, timeSlot,
	)
	s.send(patientEmail, subject, body)
}

// SendStatusUpdate notifies the patient when their appointment status changes.
func (s *NotificationService) SendStatusUpdate(appointmentID, patientEmail, doctorID, date, timeSlot, newStatus string) {
	messages := map[string]string{
		"BOOKED":    "Great news! Your appointment has been accepted by the doctor.",
		"REJECTED":  "Unfortunately, your appointment request was declined by the doctor. You may book a new appointment.",
		"CANCELLED": "Your appointment has been cancelled.",
		"COMPLETED": "Your consultation has been completed. Thank you for using our service.",
	}
	msg, ok := messages[newStatus]
	if !ok {
		msg = "Your appointment status has been updated to: " + newStatus
	}

	subject := fmt.Sprintf("Appointment %s — %s", appointmentID, newStatus)
	body := fmt.Sprintf("%s\n\nAppointment ID: %s\nDoctor: %s\nDate: %s at %s", msg, appointmentID, doctorID, date, timeSlot)
	s.send(patientEmail, subject, body)
}

// SendRescheduleNotification notifies the patient that their reschedule is pending re-confirmation.
func (s *NotificationService) SendRescheduleNotification(appointmentID, patientEmail, doctorID, newDate, newTime string) {
	subject := fmt.Sprintf("Appointment %s — Rescheduled", appointmentID)
	body := fmt.Sprintf(
		"Your appointment with doctor %s has been rescheduled to %s at %s and is awaiting re-confirmation.\n\nAppointment ID: %s",
		doctorID, newDate, newTime, appointmentID,
	)
	s.send(patientEmail, subject, body)
}
