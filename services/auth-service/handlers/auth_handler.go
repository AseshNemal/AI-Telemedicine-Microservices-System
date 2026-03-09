package handlers

import (
	"auth-service/database"
	"auth-service/models"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	db    *database.Client
	mu    sync.RWMutex
	users map[string]models.User
}

func NewHandler(db *database.Client) *Handler {
	return &Handler{db: db, users: make(map[string]models.User)}
}

func (h *Handler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	if _, exists := h.users[req.Email]; exists {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	user := models.User{ID: time.Now().Format("20060102150405.000000000"), Name: req.Name, Email: req.Email, Password: req.Password, Role: req.Role}
	h.users[req.Email] = user
	c.JSON(http.StatusCreated, gin.H{"message": "user registered (mock auth mode)", "user": gin.H{"id": user.ID, "name": user.Name, "email": user.Email, "role": user.Role}})
}

func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	h.mu.RLock()
	user, exists := h.users[req.Email]
	h.mu.RUnlock()
	if !exists || user.Password != req.Password {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "login successful (mock token)", "token": "mock-token-" + user.ID, "user": gin.H{"id": user.ID, "name": user.Name, "email": user.Email, "role": user.Role}})
}

func (h *Handler) Profile(c *gin.Context) {
	email := c.Query("email")
	if email == "" {
		email = c.GetHeader("X-User-Email")
	}
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email query parameter or X-User-Email header is required"})
		return
	}

	h.mu.RLock()
	user, exists := h.users[email]
	h.mu.RUnlock()
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": user.ID, "name": user.Name, "email": user.Email, "role": user.Role})
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"service": "auth-service", "status": "ok", "dbConnected": h.db.Connected})
}
