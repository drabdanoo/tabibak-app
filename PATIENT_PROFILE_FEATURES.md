# Patient Profile and Appointment Notification System

## New Features Implemented

### 1. Patient Profile System (patient.html)
- **Automatic Profile Creation**: When patients sign in with phone authentication, a profile is automatically created in Firestore
- **Profile Data Storage**: Stores patient information including:
  - Phone number (primary identifier)
  - Name, age, gender (filled during first appointment booking)
  - Login history
  - Appointment history

### 2. My Appointments Tab
- **New Tab Added**: "مواعيدي" (My Appointments) tab appears after patient login
- **Real-time Updates**: Shows all patient appointments with current status
- **Status Tracking**: Displays appointment status (pending, confirmed, postponed, cancelled, completed)
- **Appointment Details**: Shows doctor info, date, time, reason, and any doctor notes

### 3. Enhanced Appointment Booking
- **Login Required**: Patients must be logged in to book appointments
- **Auto-fill Information**: Pre-fills patient information from profile
- **Firestore Integration**: Appointments are saved to Firestore database
- **Profile Updates**: Patient profile is updated with latest information during booking

### 4. Doctor Notification System (doctor.html)
- **Real-time Notifications**: Doctors receive notifications when patients book appointments
- **Notification Badge**: Shows count of unread notifications
- **Auto-refresh**: Appointment list refreshes to show new bookings

### 5. Doctor Appointment Management
- **New Status System**: 
  - `pending` - Waiting for doctor response
  - `confirmed` - Doctor confirmed the appointment
  - `postponed` - Doctor rescheduled the appointment
  - `cancelled` - Appointment cancelled
  - `in_progress` - Appointment currently happening
  - `completed` - Appointment finished

- **Action Buttons**:
  - **Confirm**: Doctor can confirm pending appointments
  - **Postpone**: Reschedule with new date/time
  - **Cancel**: Cancel with optional reason
  - **Start**: Mark appointment as in progress
  - **Complete**: Mark appointment as finished with optional notes

### 6. Patient Notification System
- **Automatic Notifications**: Patients receive notifications when doctors:
  - Confirm their appointment
  - Postpone/reschedule their appointment  
  - Cancel their appointment
- **Status Updates**: Appointment status updates automatically in patient's "My Appointments" tab

## Database Collections

### 1. `patients`
```javascript
{
  uid: "firebase_user_uid",
  phone: "+964XXXXXXXXX", 
  name: "Patient Name",
  email: "email@example.com",
  age: "25",
  gender: "male|female",
  createdAt: timestamp,
  lastLogin: timestamp
}
```

### 2. `appointments`
```javascript
{
  doctorId: "doctor_id",
  patientId: "patient_document_id",
  patientName: "Patient Name",
  patientPhone: "+964XXXXXXXXX",
  patientAge: "25",
  patientGender: "male|female",
  appointmentDate: "2025-10-02",
  appointmentTime: "10:00 AM",
  reason: "Appointment reason",
  allergies: "Patient allergies",
  chronicConditions: ["condition1", "condition2"],
  currentMedications: "Current medications",
  status: "pending|confirmed|postponed|cancelled|in_progress|completed",
  doctorNotes: "Doctor notes",
  createdAt: timestamp,
  confirmedAt: timestamp,
  startedAt: timestamp,
  completedAt: timestamp
}
```

### 3. `notifications` (for doctors)
```javascript
{
  doctorId: "doctor_id",
  appointmentId: "appointment_id",
  type: "new_appointment",
  title: "New Appointment Request",
  message: "New appointment from Patient Name",
  patientName: "Patient Name",
  appointmentDate: "2025-10-02",
  appointmentTime: "10:00 AM",
  isRead: false,
  createdAt: timestamp
}
```

### 4. `patientNotifications` (for patients)
```javascript
{
  patientPhone: "+964XXXXXXXXX",
  type: "appointment_confirmed|appointment_postponed|appointment_cancelled",
  title: "Appointment Confirmed",
  message: "Your appointment has been confirmed",
  appointmentId: "appointment_id",
  isRead: false,
  createdAt: timestamp
}
```

## How It Works

### Patient Flow:
1. Patient visits patient.html
2. Clicks "تسجيل الدخول" (Login)
3. Enters phone number and completes OTP verification
4. Profile is automatically created/updated in Firestore
5. "My Appointments" tab becomes visible
6. Patient can book appointments (requires login)
7. Patient receives real-time notifications about appointment status changes

### Doctor Flow:
1. Doctor visits doctor.html and logs in
2. New appointment requests appear in appointment list with "pending" status
3. Notification badge shows count of new appointments
4. Doctor can confirm, postpone, or cancel appointments
5. Patients are automatically notified of status changes

## Key Features:
- ✅ Simple and clean implementation
- ✅ Real-time updates using Firestore
- ✅ Phone-based authentication
- ✅ Automatic profile creation
- ✅ Bi-directional notifications
- ✅ Comprehensive appointment status tracking
- ✅ Preserves all existing functionality