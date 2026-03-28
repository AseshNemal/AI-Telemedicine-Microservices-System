package handlers

import (
	"net/http"
	"strings"

	"telemedicine-service/models"
	"telemedicine-service/services"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	livekit *services.LiveKitService
}

func NewHandler(livekit *services.LiveKitService) *Handler {
	return &Handler{livekit: livekit}
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "telemedicine-service",
	})
}

func (h *Handler) CreateToken(c *gin.Context) {
	var req models.CreateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	res, err := h.livekit.CreateToken(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *Handler) CreateRoom(c *gin.Context) {
	var req models.CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	room, err := h.livekit.CreateRoom(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, room)
}

func (h *Handler) GetRoom(c *gin.Context) {
	roomName := c.Param("roomName")
	room, err := h.livekit.GetRoom(roomName)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, room)
}

func (h *Handler) DeleteRoom(c *gin.Context) {
	roomName := c.Param("roomName")
	if err := h.livekit.DeleteRoom(roomName); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
