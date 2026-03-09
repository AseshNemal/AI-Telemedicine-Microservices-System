package models

type Doctor struct {
	ID           string   `json:"id" bson:"id"`
	Name         string   `json:"name" binding:"required" bson:"name"`
	Specialty    string   `json:"specialty" binding:"required" bson:"specialty"`
	Hospital     string   `json:"hospital" binding:"required" bson:"hospital"`
	Availability []string `json:"availability" bson:"availability"`
}
