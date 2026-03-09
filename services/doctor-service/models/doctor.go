package models

type Doctor struct {
	ID           string   `json:"id"`
	Name         string   `json:"name" binding:"required"`
	Specialty    string   `json:"specialty" binding:"required"`
	Hospital     string   `json:"hospital" binding:"required"`
	Availability []string `json:"availability"`
}
