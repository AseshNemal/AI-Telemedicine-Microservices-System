package handlers

import (
	"appointment-service/database"
	"appointment-service/models"
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

type Handler struct {
	db               *database.Client
	notificationBase string
	httpClient       *http.Client
}

func NewHandler(db *database.Client) *Handler {
	notificationBase := os.Getenv("NOTIFICATION_SERVICE_URL")
	if notificationBase == "" {
		notificationBase = "http://notification-service:8084"
	}

	return &Handler{
		db:               db,
		notificationBase: notificationBase,
		httpClient:       &http.Client{Timeout: 3 * time.Second},
	}
}

func (h *Handler) CreateAppointment(c *gin.Context) {
	var req models.Appointment
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	req.ID = "apt-" + time.Now().Format("20060102150405")
	if req.Status == "" {
		req.Status = "BOOKED"
	}

	if h.db == nil || !h.db.Connected || h.db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// include an insertedAt timestamp; store ID as 'id' field
	doc := bson.M{
		"id":        req.ID,
		"patientId": req.PatientID,
		"doctorId":  req.DoctorID,
		"date":      req.Date,
		"time":      req.Time,
		"status":    req.Status,
		"createdAt": time.Now(),
	}
	if _, err := h.db.DB.Collection("appointments").InsertOne(ctx, doc); err != nil {
		log.Printf("[appointment-service] failed to insert appointment to mongo: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to insert appointment", "details": err.Error()})
		return
	}

	h.notify(req)
	c.JSON(http.StatusCreated, req)
}

func (h *Handler) GetAppointments(c *gin.Context) {
	if h.db == nil || !h.db.Connected || h.db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := h.db.DB.Collection("appointments").Find(ctx, bson.D{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query appointments", "details": err.Error()})
		return
	}
	var results []models.Appointment
	if err = cursor.All(ctx, &results); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read appointments from cursor", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, results)
}

func (h *Handler) DeleteAppointment(c *gin.Context) {
	id := c.Param("id")
	if h.db == nil || !h.db.Connected || h.db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	res, err := h.db.DB.Collection("appointments").DeleteOne(ctx, bson.M{"id": id})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete appointment", "details": err.Error()})
		return
	}
	if res.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "appointment not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "appointment cancelled", "id": id})
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"service": "appointment-service", "status": "ok", "dbConnected": h.db.Connected})
}

func (h *Handler) notify(apt models.Appointment) {
	payload := map[string]string{
		"to":      apt.PatientID,
		"subject": "Appointment Confirmation",
		"message": "Appointment booked with doctor " + apt.DoctorID + " on " + apt.Date + " at " + apt.Time,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[appointment-service] failed to marshal notification payload: %v", err)
		return
	}

	url := h.notificationBase + "/send-email"
	resp, err := h.httpClient.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		log.Printf("[appointment-service] failed to notify notification-service: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("[appointment-service] notification-service returned status %d", resp.StatusCode)
	}
}
