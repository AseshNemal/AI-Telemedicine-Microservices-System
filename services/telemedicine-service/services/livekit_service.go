package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"telemedicine-service/models"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

const defaultTokenTTL = 3600

type LiveKitService struct {
	apiKey     string
	apiSecret  string
	wsURL      string
	roomClient *lksdk.RoomServiceClient
}

func NewLivekitServiceFromEnv() (*LiveKitService, error) {
	apiKey := strings.TrimSpace(os.Getenv("LIVEKIT_API_KEY"))
	apiSecret := strings.TrimSpace(os.Getenv("LIVEKIT_API_SECRET"))
	wsURL := strings.TrimSpace(os.Getenv("LIVEKIT_URL"))

	if apiKey == "" || apiSecret == "" || wsURL == "" {
		return nil, errors.New("LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL are required")
	}

	roomServiceURL := toRoomServiceURL(wsURL)
	roomClient := lksdk.NewRoomServiceClient(roomServiceURL, apiKey, apiSecret)

	return &LiveKitService{
		apiKey:     apiKey,
		apiSecret:  apiSecret,
		wsURL:      wsURL,
		roomClient: roomClient,
	}, nil
}

func (s *LiveKitService) WSURL() string {
	return s.wsURL
}

func (s *LiveKitService) CreateToken(req models.CreateTokenRequest) (*models.CreateTokenResponse, error) {
	if strings.TrimSpace(req.RoomName) == "" || strings.TrimSpace(req.ParticipantIdentity) == "" {
		return nil, errors.New("roomName and participantIdentity are required")
	}

	ttl := req.TTLSeconds
	if ttl <= 0 {
		ttl = defaultTokenTTL
	}

	canPublish := true
	canSubscribe := true
	canPublishData := true

	if req.CanPublish != nil {
		canPublish = *req.CanPublish
	}
	if req.CanSubscribe != nil {
		canSubscribe = *req.CanSubscribe
	}
	if req.CanPublishData != nil {
		canPublishData = *req.CanPublishData
	}

	at := auth.NewAccessToken(s.apiKey, s.apiSecret)
	at.SetIdentity(req.ParticipantIdentity)
	at.SetName(req.ParticipantName)
	at.SetMetadata(req.Metadata)
	at.SetValidFor(time.Duration(ttl) * time.Second)
	at.AddGrant(&auth.VideoGrant{
		RoomJoin:       true,
		Room:           req.RoomName,
		CanPublish:     boolPtr(canPublish),
		CanSubscribe:   boolPtr(canSubscribe),
		CanPublishData: boolPtr(canPublishData),
	})

	token, err := at.ToJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to create LiveKit token: %w", err)
	}

	res := &models.CreateTokenResponse{
		Token:               token,
		WsURL:               s.wsURL,
		RoomName:            req.RoomName,
		ParticipantIdentity: req.ParticipantIdentity,
		ParticipantName:     req.ParticipantName,
		ExpiresInSeconds:    ttl,
	}

	return res, nil
}

func (s *LiveKitService) CreateRoom(req models.CreateRoomRequest) (*models.RoomResponse, error) {
	if strings.TrimSpace(req.RoomName) == "" {
		return nil, errors.New("roomName is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	room, err := s.roomClient.CreateRoom(ctx, &livekit.CreateRoomRequest{
		Name:            req.RoomName,
		EmptyTimeout:    req.EmptyTimeout,
		MaxParticipants: req.MaxParticipants,
		Metadata:        req.Metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create room: %w", err)
	}

	return mapRoom(room), nil
}

func (s *LiveKitService) GetRoom(roomName string) (*models.RoomResponse, error) {
	if strings.TrimSpace(roomName) == "" {
		return nil, errors.New("roomName is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := s.roomClient.ListRooms(ctx, &livekit.ListRoomsRequest{Names: []string{roomName}})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch room: %w", err)
	}

	if len(result.Rooms) == 0 {
		return nil, errors.New("room not found")
	}

	return mapRoom(result.Rooms[0]), nil
}

func (s *LiveKitService) DeleteRoom(roomName string) error {
	if strings.TrimSpace(roomName) == "" {
		return errors.New("roomName is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := s.roomClient.DeleteRoom(ctx, &livekit.DeleteRoomRequest{Room: roomName})
	if err != nil {
		return fmt.Errorf("failed to delete room: %w", err)
	}

	return nil
}

func mapRoom(room *livekit.Room) *models.RoomResponse {
	if room == nil {
		return nil
	}

	return &models.RoomResponse{
		Name:            room.Name,
		SID:             room.Sid,
		EmptyTimeout:    room.EmptyTimeout,
		MaxParticipants: room.MaxParticipants,
		CreationTime:    room.CreationTime,
		Metadata:        room.Metadata,
	}
}

func toRoomServiceURL(livekitURL string) string {
	if strings.HasPrefix(livekitURL, "wss://") {
		return "https://" + strings.TrimPrefix(livekitURL, "wss://")
	}
	if strings.HasPrefix(livekitURL, "ws://") {
		return "http://" + strings.TrimPrefix(livekitURL, "ws://")
	}
	return livekitURL
}

func boolPtr(v bool) *bool {
	return &v
}
