package models

type Appointment struct {
	ID        string `json:"id" bson:"id"`
	PatientID string `json:"patientId" binding:"required" bson:"patientId"`
	DoctorID  string `json:"doctorId" binding:"required" bson:"doctorId"`
	Date      string `json:"date" binding:"required" bson:"date"`
	Time      string `json:"time" binding:"required" bson:"time"`
	Status    string `json:"status" bson:"status"`
}
