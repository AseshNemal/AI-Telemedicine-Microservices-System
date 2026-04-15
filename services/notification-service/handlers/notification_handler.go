package handlers

import (
	"log"
	"net/http"
	"notification-service/models"
	emailsvc "notification-service/services/email"
	smssvc "notification-service/services/sms"
	"os"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	smsClient   *smssvc.Client
	emailClient *emailsvc.Client
}

func NewHandler() *Handler {
	// read env vars for SMS (Twilio)
	twilioSID := os.Getenv("TWILIO_ACCOUNT_SID")
	twilioToken := os.Getenv("TWILIO_AUTH_TOKEN")
	twilioFrom := os.Getenv("TWILIO_FROM_NUMBER")
	if twilioFrom == "" {
		// Backward compatibility with existing .env naming.
		twilioFrom = os.Getenv("TWILIO_PHONE_NUMBER")
	}

	// read env vars for Email (SendGrid)
	sendgridKey := os.Getenv("SENDGRID_API_KEY")
	sendgridFrom := os.Getenv("SENDGRID_FROM_EMAIL")
	if sendgridFrom == "" {
		// Backward compatibility with existing .env naming.
		sendgridFrom = os.Getenv("SENDGRID_SENDER_EMAIL")
	}

	var smsClient *smssvc.Client
	if twilioSID != "" && twilioToken != "" && twilioFrom != "" {
		smsClient = smssvc.NewClient(twilioSID, twilioToken, twilioFrom)
	} else {
		log.Println("[notification-service] Twilio credentials not fully configured; SMS disabled")
	}

	var emailClient *emailsvc.Client
	if sendgridKey != "" && sendgridFrom != "" {
		emailClient = emailsvc.NewClient(sendgridKey, sendgridFrom)
	} else {
		log.Println("[notification-service] SendGrid credentials not fully configured; Email disabled")
	}

	return &Handler{smsClient: smsClient, emailClient: emailClient}
}

func (h *Handler) SendEmail(c *gin.Context) {
	var req models.NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	if h.emailClient == nil {
		log.Printf("[notification-service][EMAIL] disabled to=%s subject=%s", req.To, req.Subject)
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email provider not configured"})
		return
	}

	if err := h.emailClient.SendEmail(req.To, req.Subject, req.Message); err != nil {
		log.Printf("[notification-service][EMAIL] error to=%s err=%v", req.To, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send email", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "email sent"})
}

func (h *Handler) SendSMS(c *gin.Context) {
	var req models.NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	if h.smsClient == nil {
		log.Printf("[notification-service][SMS] disabled to=%s", req.To)
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "sms provider not configured"})
		return
	}

	if err := h.smsClient.SendSMS(req.To, req.Message); err != nil {
		log.Printf("[notification-service][SMS] error to=%s err=%v", req.To, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send sms", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "sms sent"})
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"service": "notification-service", "status": "ok"})
}
