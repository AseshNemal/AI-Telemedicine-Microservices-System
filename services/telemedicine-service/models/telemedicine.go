package models

type CreateTokenRequest struct {
	RoomName            string `json:"roomName" binding:"required"`
	ParticipantIdentity string `json:"participantIdentity" binding:"required"`
	ParticipantName     string `json:"participantName"`
	Metadata            string `json:"metadata"`
	TTLSeconds          int64  `json:"ttlSeconds"`
	CanPublish          *bool  `json:"canPublish"`
	CanSubscribe        *bool  `json:"canSubscribe"`
	CanPublishData      *bool  `json:"canPublishData"`
}

type CreateTokenResponse struct {
	Token               string `json:"token"`
	WsURL               string `json:"wsUrl"`
	RoomName            string `json:"roomName"`
	ParticipantIdentity string `json:"participantIdentity"`
	ParticipantName     string `json:"participantName"`
	ExpiresInSeconds    int64  `json:"expiresInSeconds"`
}

type CreateRoomRequest struct {
	RoomName        string `json:"roomName" binding:"required"`
	EmptyTimeout    uint32 `json:"emptyTimeout"`
	MaxParticipants uint32 `json:"maxParticipants"`
	Metadata        string `json:"metadata"`
}

type RoomResponse struct {
	Name            string `json:"name"`
	SID             string `json:"sid"`
	EmptyTimeout    uint32 `json:"emptyTimeout"`
	MaxParticipants uint32 `json:"maxParticipants"`
	CreationTime    int64  `json:"creationTime"`
	Metadata        string `json:"metadata"`
}
