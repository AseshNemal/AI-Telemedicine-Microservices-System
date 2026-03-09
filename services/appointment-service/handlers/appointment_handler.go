package handlers

import (
	"appointment-service/database"
	"appointment-service/models"
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	db               *database.Client
	notificationBase string
	mu               sync.RWMutex
	appointments     map[string]models.Appointment
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
		appointments:     make(map[string]models.Appointment),
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

	h.mu.Lock()
	h.appointments[req.ID] = req
	h.mu.Unlock()

	h.notify(req)
	c.JSON(http.StatusCreated, req)
}

func (h *Handler) GetAppointments(c *gin.Context) {
	h.mu.RLock()
	result := make([]models.Appointment, 0, len(h.appointments))
	for _, apt := range h.appointments {
		result = append(result, apt)
	}
	h.mu.RUnlock()
	c.JSON(http.StatusOK, result)
}

func (h *Handler) DeleteAppointment(c *gin.Context) {
	id := c.Param("id")
	h.mu.Lock()
	_, exists := h.appointments[id]
	if exists {
		delete(h.appointments, id)
	}
	h.mu.Unlock()

	if !exists {
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
