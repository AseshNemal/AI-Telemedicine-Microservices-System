package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
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
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type paymentRequest struct {
	AppointmentID string  `json:"appointmentId"`
	PatientID     string  `json:"patientId"`
	DoctorID      string  `json:"doctorId"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	PaymentMethod string  `json:"paymentMethod"`
}

// PaymentResult is returned by InitiatePayment on success.
type PaymentResult struct {
	TransactionID string  `json:"transactionId"`
	CheckoutURL   string  `json:"checkoutUrl"`
	Status        string  `json:"status"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
}

type paymentResponse struct {
	ID          string  `json:"id"`
	Status      string  `json:"status"`
	CheckoutURL string  `json:"checkoutUrl"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
}

// platformFeeCents is the fixed platform (AI Telemedicine) fee: $20.00
const platformFeeCents = 2000

// internalServiceKey returns the service-to-service auth key for calling the payment service.
func internalServiceKey() string {
	return strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_KEY"))
}

// InitiatePayment calls POST /payments on the payment-service to create a
// Stripe checkout session. doctorFeeCents is the doctor's configured fee in
// cents. Final amount = doctorFeeCents + $20 platform fee (C-2).
func (s *PaymentService) InitiatePayment(appointmentID, patientID, doctorID string, doctorFeeCents int) (*PaymentResult, error) {
	if doctorFeeCents < 0 {
		doctorFeeCents = 0
	}
	totalCents := doctorFeeCents + platformFeeCents
	amount := float64(totalCents) / 100.0

	payload, err := json.Marshal(paymentRequest{
		AppointmentID: appointmentID,
		PatientID:     patientID,
		DoctorID:      doctorID,
		Amount:        amount,
		Currency:      "usd",
		PaymentMethod: "CARD",
	})
	if err != nil {
		return nil, fmt.Errorf("marshal payment request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, s.baseURL+"/payments", bytes.NewBuffer(payload))
	if err != nil {
		return nil, fmt.Errorf("build payment request: %w", err)
	}
	key := internalServiceKey()
	if key == "" {
		return nil, fmt.Errorf("payment-service configuration error: INTERNAL_SERVICE_KEY is empty")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Service-Key", key)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("payment-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("payment-service returned %d: %s", resp.StatusCode, string(body))
	}

	var result paymentResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("payment-service bad response body: %w", err)
	}

	return &PaymentResult{
		TransactionID: result.ID,
		CheckoutURL:   result.CheckoutURL,
		Status:        result.Status,
		Amount:        result.Amount,
		Currency:      result.Currency,
	}, nil
}

// PaymentVerification is the response from GET /payments/:id on the payment-service.
type PaymentVerification struct {
	ID     string `json:"id"`
	Status string `json:"status"` // PENDING | COMPLETED | FAILED
}

// VerifyPayment calls GET /payments/:transactionID on the payment-service to
// confirm whether a Stripe checkout session has been completed.
func (s *PaymentService) VerifyPayment(transactionID string) (*PaymentVerification, error) {
	req, err := http.NewRequest(http.MethodGet, s.baseURL+"/payments/"+url.PathEscape(transactionID), nil)
	if err != nil {
		return nil, fmt.Errorf("build verify request: %w", err)
	}
	vKey := internalServiceKey()
	if vKey == "" {
		return nil, fmt.Errorf("payment-service configuration error: INTERNAL_SERVICE_KEY is empty")
	}
	req.Header.Set("X-Internal-Service-Key", vKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("payment-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("payment transaction not found: %s", transactionID)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("payment-service returned %d: %s", resp.StatusCode, string(body))
	}

	var v PaymentVerification
	if err := json.NewDecoder(resp.Body).Decode(&v); err != nil {
		return nil, fmt.Errorf("payment-service bad response body: %w", err)
	}
	return &v, nil
}

// RefundPayment calls POST /payments/:transactionID/refund on the payment-service
// to initiate a Stripe refund for a completed payment (C-1).
func (s *PaymentService) RefundPayment(transactionID string) error {
	req, err := http.NewRequest(http.MethodPost,
		s.baseURL+"/payments/"+url.PathEscape(transactionID)+"/refund",
		nil,
	)
	if err != nil {
		return fmt.Errorf("build refund request: %w", err)
	}
	rKey := internalServiceKey()
	if rKey == "" {
		return fmt.Errorf("payment-service configuration error: INTERNAL_SERVICE_KEY is empty")
	}
	req.Header.Set("X-Internal-Service-Key", rKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("payment-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("payment-service refund returned %d: %s", resp.StatusCode, string(body))
	}
	return nil
}
