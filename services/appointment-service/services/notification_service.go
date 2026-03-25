package services

import (
	"bytes"
	"encoding/json"
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

type notificationPayload struct {
	Message string `json:"message"`
}

// SendAppointmentConfirmation posts a booking-confirmed message to the
// notification service at POST /send-email.
//
// This method is designed to be called inside a goroutine — it only logs
// errors and never returns them, so failures never block the caller.
func (s *NotificationService) SendAppointmentConfirmation() {
	payload, err := json.Marshal(notificationPayload{
		Message: "Your appointment has been successfully booked",
	})
	if err != nil {
		log.Printf("[appointment-service] failed to marshal notification payload: %v", err)
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
