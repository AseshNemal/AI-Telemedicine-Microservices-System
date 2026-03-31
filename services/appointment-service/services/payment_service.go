package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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

// consultationFee is the fixed fee charged per appointment in USD.
const consultationFee = 50.0

// InitiatePayment calls POST /payments on the payment-service to create a
// Stripe checkout session. It returns the checkout URL the client must visit
// to complete payment. The appointment should remain in PENDING_PAYMENT status
// until payment is confirmed via ConfirmPayment.
func (s *PaymentService) InitiatePayment(appointmentID, patientID, doctorID string) (*PaymentResult, error) {
	payload, err := json.Marshal(paymentRequest{
		AppointmentID: appointmentID,
		PatientID:     patientID,
		DoctorID:      doctorID,
		Amount:        consultationFee,
		Currency:      "usd",
		PaymentMethod: "CARD",
	})
	if err != nil {
		return nil, fmt.Errorf("marshal payment request: %w", err)
	}

	resp, err := s.httpClient.Post(
		s.baseURL+"/payments",
		"application/json",
		bytes.NewBuffer(payload),
	)
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
	resp, err := s.httpClient.Get(s.baseURL + "/payments/" + transactionID)
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
