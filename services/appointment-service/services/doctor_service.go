package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// DoctorService handles HTTP communication with the doctor-service.
type DoctorService struct {
	baseURL    string
	httpClient *http.Client
}

// NewDoctorService creates a DoctorService that talks to the given baseURL.
func NewDoctorService(baseURL string) *DoctorService {
	return &DoctorService{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

type availabilityRequest struct {
	DoctorID string `json:"doctorId"`
	Date     string `json:"date"`
	Time     string `json:"time"`
}

type availabilityResponse struct {
	Available bool `json:"available"`
}

// CheckAvailability calls POST /check-availability on the doctor service.
// Returns (true, nil) when the slot is free, (false, nil) when taken,
// and (false, err) when the remote call itself fails.
func (s *DoctorService) CheckAvailability(doctorID, date, timeSlot string) (bool, error) {
	payload, err := json.Marshal(availabilityRequest{
		DoctorID: doctorID,
		Date:     date,
		Time:     timeSlot,
	})
	if err != nil {
		return false, fmt.Errorf("marshal availability request: %w", err)
	}

	resp, err := s.httpClient.Post(
		s.baseURL+"/check-availability",
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		return false, fmt.Errorf("doctor-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	var result availabilityResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("doctor-service bad response body: %w", err)
	}

	return result.Available, nil
}
