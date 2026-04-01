package handlers

import (
	"context"
	"doctor-service/database"
	"doctor-service/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

type Handler struct {
	db *database.Client
}

func NewHandler(db *database.Client) *Handler {
	return &Handler{db: db}
}

func (h *Handler) GetDoctors(c *gin.Context) {
	specialty := c.Query("specialty")
	// Allow browser requests from local frontend during development
	c.Header("Access-Control-Allow-Origin", "http://localhost:3000")
	c.Header("Access-Control-Allow-Credentials", "true")
	// Require database; no in-memory fallback
	if h.db == nil || !h.db.Connected || h.db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	filter := bson.D{}
	if specialty != "" {
		filter = bson.D{{Key: "specialty", Value: specialty}}
	}
	cursor, err := h.db.DB.Collection("doctors").Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query doctors", "details": err.Error()})
		return
	}
	var docs []models.Doctor
	if err = cursor.All(ctx, &docs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read doctors from cursor", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, docs)
}

func (h *Handler) CreateDoctor(c *gin.Context) {
	var req models.Doctor
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	if req.ID == "" {
		req.ID = "doc-" + time.Now().Format("150405000")
	}

	// require DB and persist
	if h.db == nil || !h.db.Connected || h.db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	doc := bson.M{
		"id":           req.ID,
		"name":         req.Name,
		"specialty":    req.Specialty,
		"hospital":     req.Hospital,
		"availability": req.Availability,
		"createdAt":    time.Now(),
	}
	if _, err := h.db.DB.Collection("doctors").InsertOne(ctx, doc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to insert doctor", "details": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, req)
}

func (h *Handler) GetDoctorByID(c *gin.Context) {
	id := c.Param("id")
	if h.db == nil || !h.db.Connected || h.db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var doc models.Doctor
	err := h.db.DB.Collection("doctors").FindOne(ctx, bson.M{"id": id}).Decode(&doc)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "doctor not found"})
		return
	}
	c.JSON(http.StatusOK, doc)
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"service": "doctor-service", "status": "ok", "dbConnected": h.db.Connected})
}
