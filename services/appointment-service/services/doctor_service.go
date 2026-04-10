package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

// ErrDoctorNotFound is returned by GetDoctorByID when the doctor-service responds with 404.
var ErrDoctorNotFound = errors.New("doctor not found")

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

// Doctor is a lightweight representation of a doctor returned by the doctor-service.
type Doctor struct {
	ID                   string `json:"id"`
	Name                 string `json:"name"`
	Specialty            string `json:"specialty"`
	ExperienceYears      int    `json:"experience_years"`
	ConsultationFeeCents int    `json:"consultation_fee_cents"`
	VerificationStatus   string `json:"verification_status"`
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

	req, err := http.NewRequest(http.MethodPost,
		s.baseURL+"/check-availability",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		return false, fmt.Errorf("build availability request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if key := os.Getenv("INTERNAL_SERVICE_KEY"); key != "" {
		req.Header.Set("X-Internal-Key", key)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("doctor-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return false, fmt.Errorf("doctor-service returned %d: %s", resp.StatusCode, string(body))
	}

	var result availabilityResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("doctor-service bad response body: %w", err)
	}

	return result.Available, nil
}

// SearchDoctors calls GET /doctors on the doctor service, optionally filtering by specialty.
// Returns the raw JSON body so the appointment service can forward it directly to clients.
func (s *DoctorService) SearchDoctors(specialty string) ([]Doctor, error) {
	endpoint := s.baseURL + "/doctors"
	if specialty != "" {
		endpoint += "?specialty=" + url.QueryEscape(specialty)
	}

	resp, err := s.httpClient.Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("doctor-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("doctor-service returned %d: %s", resp.StatusCode, string(body))
	}

	var doctors []Doctor
	if err := json.NewDecoder(resp.Body).Decode(&doctors); err != nil {
		return nil, fmt.Errorf("doctor-service bad response body: %w", err)
	}

	return doctors, nil
}

// GetDoctorByID calls GET /doctor/:id on the doctor service.
func (s *DoctorService) GetDoctorByID(doctorID string) (*Doctor, error) {
	resp, err := s.httpClient.Get(s.baseURL + "/doctors/" + url.PathEscape(doctorID))
	if err != nil {
		return nil, fmt.Errorf("doctor-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("%w: %s", ErrDoctorNotFound, doctorID)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("doctor-service returned %d: %s", resp.StatusCode, string(body))
	}

	var doctor Doctor
	if err := json.NewDecoder(resp.Body).Decode(&doctor); err != nil {
		return nil, fmt.Errorf("doctor-service bad response body: %w", err)
	}

	return &doctor, nil
}
