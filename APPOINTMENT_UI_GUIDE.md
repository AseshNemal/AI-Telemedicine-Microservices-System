# Appointment Service UI - Implementation Guide

## Overview
Completely redesigned appointment booking and management UI for the AI Telemedicine Microservices System. The new UI provides a modern, intuitive workflow for patients to discover doctors, book appointments, and manage their bookings.

## New Components

### 1. **AppointmentBooking.tsx**
Interactive two-step appointment booking workflow:
- **Step 1: Doctor Discovery**
  - Search doctors by specialty
  - View doctor profiles (name, specialty, hospital, availability)
  - Select a doctor to proceed
  
- **Step 2: Appointment Booking**
  - Confirm doctor selection
  - Enter patient ID
  - Select preferred date and time
  - Submit booking request

**Features:**
- Real-time doctor search with filtering
- Loading states and error handling
- Success confirmation with appointment ID
- Form reset after successful booking
- Responsive design (mobile & desktop)

### 2. **AppointmentManagement.tsx**
Comprehensive appointment management interface:
- View all upcoming and past appointments
- List view with status badges (CONFIRMED, ACCEPTED, REJECTED, CANCELLED, PENDING)
- Detailed appointment view showing:
  - Appointment ID
  - Doctor ID
  - Patient ID
  - Date & Time (formatted)
  - Current status

**Actions:**
- **Reschedule:** Change appointment date/time with mandatory reason field
- **Cancel:** Withdraw appointment booking
- **Join Consultation:** Generate LiveKit token for video consultation
- **Refresh:** Reload appointment list

**Features:**
- Conditional action buttons based on appointment status
- Color-coded status badges
- Confirmation dialogs for destructive actions
- Error and success messaging
- Loading states

## Enhanced API Functions

All appointment API functions are defined in `lib/api.ts`:

```typescript
// Get all user's appointments
getAppointments(): Promise<Appointment[]>

// Get specific appointment by ID
getAppointmentByID(id: string): Promise<Appointment>

// Create new appointment
createAppointment(payload: {
  patientId: string
  doctorId: string
  date: string
  time: string
}): Promise<Appointment>

// Reschedule appointment
rescheduleAppointment(
  id: string,
  payload: {
    date: string
    time: string
    reason: string
  }
): Promise<Appointment>

// Cancel appointment
cancelAppointment(id: string): Promise<void>

// Update appointment status
updateAppointmentStatus(
  id: string,
  payload: { status: "ACCEPTED" | "REJECTED" | "CANCELLED" }
): Promise<Appointment>

// Get LiveKit consultation token
getConsultationToken(id: string): Promise<{ token: string }>
```

## Service Integration

### Appointment Service Endpoints Used
- `GET /doctors` - List all doctors with optional specialty filter
- `GET /doctors/:id` - Get specific doctor details
- `POST /appointments` - Create new appointment booking
- `GET /appointments/my` - List user's appointments
- `GET /appointments/:id` - Get appointment details
- `PUT /appointments/:id/reschedule` - Reschedule appointment
- `DELETE /appointments/:id` - Cancel appointment
- `GET /appointments/:id/consultation-token` - Get LiveKit token

## Updated Page Layout

The `/app/appointments` page now displays:
1. **Hero Section** - Title, description, and workflow steps
2. **Two-Column Layout** (on desktop)
   - Left: AppointmentBooking component
   - Right: AppointmentManagement component
3. **Single Column** (on mobile) - Stacked layout

## Usage Example

### For Patients
1. Navigate to `/appointments`
2. In the left panel (AppointmentBooking):
   - Search for doctors by specialty
   - View available doctors
   - Click "Select doctor"
   - Enter patient ID, date, and time
   - Click "Confirm appointment"
3. In the right panel (AppointmentManagement):
   - View all booked appointments
   - Click "Manage" to see details
   - Reschedule or cancel as needed
   - Click "Join consultation" when ready for video call

## Styling

All components use the existing design system:
- `.surface-card` - Card wrapper with border and background
- `.field-input` - Text input styling
- `.btn-primary` - Primary action button (blue)
- `.btn-secondary` - Secondary action button (outline)
- `.section-kicker` - Small label above headings
- Responsive grid layouts with `md:` and `lg:` breakpoints

## Error Handling

- Network errors are caught and displayed to user
- Form validation ensures required fields are filled
- API error messages are extracted and shown
- Confirmation dialogs prevent accidental cancellations
- Loading states prevent duplicate submissions

## State Management

Components use React hooks for local state:
- `useState` - Form state, appointments list, UI state
- `useEffect` - Load appointments on component mount
- Form submission handlers with loading and error states

## Environment Variables

The appointment service URL is configured via environment variable:
```
NEXT_PUBLIC_APPOINTMENT_SERVICE_URL=http://localhost:8083
```

Default: `http://localhost:8083`

## Next Steps

1. **Authentication Integration**
   - Add Firebase Auth token to API requests (currently in middleware)
   - Extract user ID from auth context

2. **Payment Integration**
   - Link to payment flow after booking
   - Show payment status in appointment list

3. **Doctor Availability**
   - Fetch available time slots from doctor service
   - Display time picker instead of manual input

4. **LiveKit Integration**
   - Use consultation tokens to join video calls
   - Add video room UI component

5. **Notifications**
   - Send SMS/email confirmations (via notification service)
   - Remind users before appointment

## Testing

To test the appointment features:
1. Ensure appointment service is running on port 8083
2. Have test doctor IDs available (e.g., "doc-1", "doc-2")
3. Have test patient IDs available (e.g., "PAT-1234")
4. Use valid dates in the future for bookings

## Files Modified/Created

```
web-app/
├── app/
│   ├── lib/
│   │   └── api.ts (enhanced with new functions)
│   ├── components/
│   │   ├── AppointmentBooking.tsx (NEW)
│   │   ├── AppointmentManagement.tsx (NEW)
│   │   └── AppointmentConsole.tsx (deprecated)
│   └── appointments/
│       └── page.tsx (updated to use new components)
```

## TypeScript Types

```typescript
type Doctor = {
  id: string
  name: string
  specialty: string
  hospital: string
  availability: string[]
}

type Appointment = {
  id: string
  patientId: string
  doctorId: string
  date: string
  time: string
  status: string
}
```
