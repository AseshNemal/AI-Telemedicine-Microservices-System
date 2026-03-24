package handler

import (
	"net/http"

	"AI-symptom-service/internal/model"
	"AI-symptom-service/internal/service"

	"github.com/gin-gonic/gin"
)

type SymptomHandler struct {
	service *service.SymptomService
}

func NewSymptomHandler(service *service.SymptomService) *SymptomHandler {
	return &SymptomHandler{service: service}
}

func (h *SymptomHandler) Chat(c *gin.Context) {
	var req model.SymptomChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	response, err := h.service.Chat(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "symptom triage failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}
