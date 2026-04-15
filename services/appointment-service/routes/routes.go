package routes

import (
	"appointment-service/handlers"
	"appointment-service/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes wires all routes onto the Gin engine.
//
// Route table:
//
//	GET  /health                                    — public liveness probe
//
//	GET  /doctors                                   — search doctors (any authenticated user)
//	GET  /doctors/:id                               — get doctor by ID (any authenticated user)
//
//	POST   /appointments                            — create booking              (PATIENT only)
//	POST   /appointments/:id/confirm-payment        — confirm payment + activate  (PATIENT | ADMIN)
//	GET    /appointments/my                         — list my appointments        (all roles, sorted)
//	GET    /appointments/:id                        — get single appointment      (owner or ADMIN)
//	PUT    /appointments/:id/status                 — accept/reject/cancel        (DOCTOR | PATIENT | ADMIN)
//	PUT    /appointments/:id/reschedule             — reschedule with reason      (PATIENT only)
//	DELETE /appointments/:id                        — cancel shortcut             (PATIENT | ADMIN)
//	GET    /appointments/:id/consultation-token     — get LiveKit join token      (PATIENT | DOCTOR | ADMIN)
func RegisterRoutes(router *gin.Engine, h *handlers.Handler) {
	// ── Public ────────────────────────────────────────────────────────────────
	router.GET("/health", h.Health)

	// Internal service-to-service endpoint used by payment-service after Stripe
	// verification. Guarded by INTERNAL_SERVICE_KEY in handler.
	router.POST("/internal/appointments/:id/confirm-payment", h.ConfirmPaymentInternal)

	// Internal endpoint used by doctor-service EndConsultation to mark BOOKED → COMPLETED (C-6).
	router.POST("/internal/appointments/:id/complete", h.CompleteAppointmentInternal)

	// Internal endpoint used by doctor-service CheckAvailability to verify slot bookings (M-2).
	router.GET("/internal/appointments/check-slot", h.CheckSlotInternal)

	// ── Authenticated ─────────────────────────────────────────────────────────
	auth := router.Group("/")
	auth.Use(middleware.VerifyToken())
	{
		// Doctor discovery (any authenticated role may search)
		auth.GET("/doctors", h.SearchDoctors)
		auth.GET("/doctors/:id", h.GetDoctorByID)
		auth.GET("/doctors/:id/schedule-summary", h.GetDoctorScheduleSummary)

		// Appointment creation — patients only
		auth.POST("/appointments", middleware.RequireRole("PATIENT"), h.CreateAppointment)

		// Payment confirmation — called by the patient after completing Stripe checkout
		auth.POST("/appointments/:id/confirm-payment",
			middleware.RequireRole("PATIENT", "ADMIN"),
			h.ConfirmPayment,
		)

		// Reading appointments (sorted by date/time ascending)
		auth.GET("/appointments/my", h.GetMyAppointments)
		auth.GET("/appointments/doctor/:id", h.GetAppointmentsByDoctorID)
		auth.GET("/appointments/:id", h.GetAppointmentByID)

		// Status update — DOCTOR accepts/rejects CONFIRMED; PATIENT or ADMIN cancels
		auth.PUT("/appointments/:id/status",
			middleware.RequireRole("DOCTOR", "PATIENT", "ADMIN"),
			h.UpdateAppointmentStatus,
		)

		// Reschedule with mandatory reason — patients only
		auth.PUT("/appointments/:id/reschedule",
			middleware.RequireRole("PATIENT"),
			h.RescheduleAppointment,
		)

		// Cancel via DELETE — patients and admins
		auth.DELETE("/appointments/:id",
			middleware.RequireRole("PATIENT", "ADMIN"),
			h.CancelAppointment,
		)

		// Get LiveKit join token for a BOOKED appointment's consultation room
		auth.GET("/appointments/:id/consultation-token",
			middleware.RequireRole("PATIENT", "DOCTOR", "ADMIN"),
			h.GetConsultationToken,
		)
	}
}
