package models

type Appointment struct {
	ID        string `json:"id"`
	PatientID string `json:"patientId" binding:"required"`
	DoctorID  string `json:"doctorId" binding:"required"`
	Date      string `json:"date" binding:"required"`
	Time      string `json:"time" binding:"required"`
	Status    string `json:"status"`
}
