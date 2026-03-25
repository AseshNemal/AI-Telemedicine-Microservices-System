package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// PaymentService handles HTTP communication with the payment-service.
type PaymentService struct {
	baseURL    string
	httpClient *http.Client
}

// NewPaymentService creates a PaymentService that talks to the given baseURL.
func NewPaymentService(baseURL string) *PaymentService {
	return &PaymentService{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

type paymentRequest struct {
	PatientID string  `json:"patientId"`
	DoctorID  string  `json:"doctorId"`
	Amount    float64 `json:"amount"`
}

type paymentResponse struct {
	Status string `json:"status"`
}

// consultationFee is the fixed fee charged per appointment in USD.
const consultationFee = 50.0

// ProcessPayment calls POST /payments on the payment service.
// Returns nil on SUCCESS, or a descriptive error on failure or non-SUCCESS status.
func (s *PaymentService) ProcessPayment(patientID, doctorID string) error {
	payload, err := json.Marshal(paymentRequest{
		PatientID: patientID,
		DoctorID:  doctorID,
		Amount:    consultationFee,
	})
	if err != nil {
		return fmt.Errorf("marshal payment request: %w", err)
	}

	resp, err := s.httpClient.Post(
		s.baseURL+"/payments",
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		return fmt.Errorf("payment-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	var result paymentResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("payment-service bad response body: %w", err)
	}

	if result.Status != "SUCCESS" {
		return fmt.Errorf("payment declined with status: %s", result.Status)
	}

	return nil
}
