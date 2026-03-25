package models

import "time"

// Appointment represents a patient-doctor consultation booking persisted in MongoDB.
type Appointment struct {
	ID        string    `json:"id"        bson:"id"`
	PatientID string    `json:"patientId" bson:"patientId" binding:"required"`
	DoctorID  string    `json:"doctorId"  bson:"doctorId"  binding:"required"`
	Date      string    `json:"date"      bson:"date"      binding:"required"`
	Time      string    `json:"time"      bson:"time"      binding:"required"`
	Status    string    `json:"status"    bson:"status"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
}
