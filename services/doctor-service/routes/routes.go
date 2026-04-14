package routes

import (
	"doctor-service/handlers"
	"doctor-service/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes wires all routes onto the Gin engine.
//
// Route table:
//
//	GET    /health                                                    — public liveness/readiness probe
//
//	POST   /doctors                                                   — register doctor (DOCTOR role only)
//	PUT    /doctors/:id                                               — update profile (owner only)
//	GET    /doctors/:id                                               — public read (403 if not VERIFIED)
//	GET    /doctors/:id/availability                                  — public read (403 if not VERIFIED)
//	PUT    /doctors/:id/availability                                  — set schedule (owner only, VERIFIED)
//	GET    /doctors                                                   — list VERIFIED doctors (public)
//
//	GET    /appointments/:appointment_id/prescription                 — view prescription (PATIENT or DOCTOR, auth required)
//
//	GET    /admin/doctors                                             — list all doctors (ADMIN, paginated)
//	PUT    /admin/doctors/:id/verify                                  — verify doctor (ADMIN)
//	PUT    /admin/doctors/:id/suspend                                 — suspend doctor (ADMIN)
//
//	GET    /doctor/appointments                                       — proxied appointment list (doctor)
//	POST   /doctor/appointments/:appointment_id/accept                — accept appointment (doctor)
//	POST   /doctor/appointments/:appointment_id/reject                — reject appointment (doctor)
//	POST   /doctor/appointments/:appointment_id/prescription          — write prescription (doctor)
//	GET    /doctor/appointments/:appointment_id/prescription          — read prescription (doctor)
//	GET    /doctor/appointments/:appointment_id/patient-reports       — read patient reports (doctor)
//	POST   /doctor/appointments/:appointment_id/consultation/start    — start consultation (doctor)
//	POST   /doctor/appointments/:appointment_id/consultation/end      — end consultation (doctor)
//
//	POST   /check-availability                                        — internal (X-Internal-Key)
func RegisterRoutes(router *gin.Engine, h *handlers.Handler) {
	// ── Public ────────────────────────────────────────────────────────────────
	router.GET("/health", h.Health)
	router.GET("/doctors", h.GetDoctors)
	router.GET("/doctors/:id", h.GetDoctorByID)
	router.GET("/doctors/:id/availability", h.GetAvailability)

	// ── Internal (service-to-service, X-Internal-Key guard) ──────────────────
	router.POST("/check-availability", middleware.RequireInternalKey(), h.CheckAvailability)

	// ── Authenticated ─────────────────────────────────────────────────────────
	auth := router.Group("/")
	auth.Use(middleware.VerifyToken())
	{
		// Doctor self-registration and profile management — DOCTOR role required
		auth.POST("/doctors", middleware.RequireRole("DOCTOR"), h.RegisterDoctor)
		auth.PUT("/doctors/:id", h.UpdateDoctor)
		auth.PUT("/doctors/:id/availability", h.SetAvailability)

		// Shared authenticated prescription endpoint — patient or doctor may read
		auth.GET("/appointments/:appointment_id/prescription",
			middleware.RequireRole("PATIENT", "DOCTOR"),
			h.GetPrescriptionShared,
		)

		// Admin routes — ADMIN role required
		admin := auth.Group("/admin")
		admin.Use(middleware.RequireRole("ADMIN"))
		{
			admin.GET("/doctors", h.AdminListDoctors)
			admin.PUT("/doctors/:id/verify", h.AdminVerifyDoctor)
			admin.PUT("/doctors/:id/suspend", h.AdminSuspendDoctor)
		}

		// Doctor workflow routes — DOCTOR role required
		doctor := auth.Group("/doctor")
		doctor.Use(middleware.RequireRole("DOCTOR"))
		{
			doctor.GET("/appointments", h.GetMyAppointments)
			doctor.GET("/profile", h.GetMyDoctorProfile)
			doctor.PUT("/profile", h.UpdateMyDoctorProfile)
			doctor.POST("/appointments/:appointment_id/accept", h.AcceptAppointment)
			doctor.POST("/appointments/:appointment_id/reject", h.RejectAppointment)
			doctor.POST("/appointments/:appointment_id/prescription", h.WritePrescription)
			doctor.GET("/appointments/:appointment_id/prescription", h.GetMyPrescription)
			doctor.GET("/appointments/:appointment_id/patient-reports", h.GetPatientReports)
			doctor.POST("/appointments/:appointment_id/consultation/start", h.StartConsultation)
			doctor.POST("/appointments/:appointment_id/consultation/end", h.EndConsultation)
		}
	}
}
