package handlers

import (
	"doctor-service/database"
	"doctor-service/models"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	db      *database.Client
	mu      sync.RWMutex
	doctors map[string]models.Doctor
}

func NewHandler(db *database.Client) *Handler {
	h := &Handler{db: db, doctors: make(map[string]models.Doctor)}
	h.seed()
	return h
}

func (h *Handler) seed() {
	h.doctors["doc-1"] = models.Doctor{ID: "doc-1", Name: "Dr Silva", Specialty: "Cardiology", Hospital: "Central Hospital", Availability: []string{"Mon 09:00", "Wed 13:00"}}
	h.doctors["doc-2"] = models.Doctor{ID: "doc-2", Name: "Dr Fernando", Specialty: "Dermatology", Hospital: "City Clinic", Availability: []string{"Tue 10:00", "Thu 15:00"}}
}

func (h *Handler) GetDoctors(c *gin.Context) {
	specialty := c.Query("specialty")
	h.mu.RLock()
	defer h.mu.RUnlock()

	result := make([]models.Doctor, 0, len(h.doctors))
	for _, doc := range h.doctors {
		if specialty == "" || specialty == doc.Specialty {
			result = append(result, doc)
		}
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) CreateDoctor(c *gin.Context) {
	var req models.Doctor
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	if req.ID == "" {
		req.ID = "doc-" + time.Now().Format("150405000")
	}
	h.doctors[req.ID] = req
	c.JSON(http.StatusCreated, req)
}

func (h *Handler) GetDoctorByID(c *gin.Context) {
	id := c.Param("id")
	h.mu.RLock()
	doctor, found := h.doctors[id]
	h.mu.RUnlock()
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "doctor not found"})
		return
	}
	c.JSON(http.StatusOK, doctor)
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"service": "doctor-service", "status": "ok", "dbConnected": h.db.Connected})
}
