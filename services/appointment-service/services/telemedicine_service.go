package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	neturl "net/url"
	"time"
)

// TelemedicineService handles HTTP communication with the telemedicine-service (LiveKit).
type TelemedicineService struct {
	baseURL    string
	httpClient *http.Client
}

// NewTelemedicineService creates a TelemedicineService pointing at the given baseURL.
func NewTelemedicineService(baseURL string) *TelemedicineService {
	return &TelemedicineService{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// ── Room management ────────────────────────────────────────────────────────────

type createRoomRequest struct {
	RoomName        string `json:"roomName"`
	EmptyTimeout    uint32 `json:"emptyTimeout"`
	MaxParticipants uint32 `json:"maxParticipants"`
	Metadata        string `json:"metadata"`
}

type roomResponse struct {
	Name string `json:"name"`
	SID  string `json:"sid"`
}

// CreateRoom calls POST /telemedicine/rooms on the telemedicine-service.
// Uses the appointmentID as the room name so it is stable and human-readable.
// Returns the confirmed room name on success.
func (s *TelemedicineService) CreateRoom(appointmentID string) (string, error) {
	payload, err := json.Marshal(createRoomRequest{
		RoomName:        appointmentID,
		EmptyTimeout:    300, // close room after 5 minutes empty
		MaxParticipants: 2,   // patient + doctor
		Metadata:        "appointmentId=" + appointmentID,
	})
	if err != nil {
		return "", fmt.Errorf("marshal create-room request: %w", err)
	}

	resp, err := s.httpClient.Post(
		s.baseURL+"/telemedicine/rooms",
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		return "", fmt.Errorf("telemedicine-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("telemedicine-service returned %d: %s", resp.StatusCode, string(body))
	}

	var room roomResponse
	if err := json.NewDecoder(resp.Body).Decode(&room); err != nil {
		return "", fmt.Errorf("telemedicine-service bad response: %w", err)
	}

	return room.Name, nil
}

// ── Token minting ──────────────────────────────────────────────────────────────

type createTokenRequest struct {
	RoomName            string `json:"roomName"`
	ParticipantIdentity string `json:"participantIdentity"`
	ParticipantName     string `json:"participantName"`
}

// ConsultationToken is returned to the caller so they can join the LiveKit room.
type ConsultationToken struct {
	Token    string `json:"token"`
	WsURL    string `json:"wsUrl"`
	RoomName string `json:"roomName"`
}

// GetJoinToken calls POST /telemedicine/token to mint a LiveKit access token for
// the given participant (identified by their uid) in the given room.
func (s *TelemedicineService) GetJoinToken(roomName, participantUID, participantName string) (*ConsultationToken, error) {
	payload, err := json.Marshal(createTokenRequest{
		RoomName:            roomName,
		ParticipantIdentity: participantUID,
		ParticipantName:     participantName,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal token request: %w", err)
	}

	resp, err := s.httpClient.Post(
		s.baseURL+"/telemedicine/token",
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		return nil, fmt.Errorf("telemedicine-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("telemedicine-service returned %d: %s", resp.StatusCode, string(body))
	}

	var result ConsultationToken
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("telemedicine-service bad response: %w", err)
	}

	return &result, nil
}

// BuildJoinURL turns a LiveKit token response into the standard browser join URL.
func (s *TelemedicineService) BuildJoinURL(wsURL, token string) string {
	return "https://meet.livekit.io/custom?liveKitUrl=" + neturl.QueryEscape(wsURL) + "&token=" + neturl.QueryEscape(token)
}
