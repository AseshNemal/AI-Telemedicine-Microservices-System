package models

type NotificationRequest struct {
	To      string `json:"to" binding:"required"`
	Subject string `json:"subject"`
	Message string `json:"message" binding:"required"`
}
