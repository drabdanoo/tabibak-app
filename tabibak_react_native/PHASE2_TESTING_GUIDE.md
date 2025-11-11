# Phase 2 Features - Quick Start Guide

## 🚀 Running the Application

### Start Development Server
```bash
cd g:\tabibak-app\tabibak_react_native
npx expo start
```

### Platform Options
- **Web:** Press `w` or open http://localhost:8081
- **Android:** Press `a` (requires Android emulator or device)
- **iOS:** Press `i` (requires iOS simulator or device on Mac)

---

## 🧪 Testing Guide

### 1. Doctor Discovery Feature

#### Test Doctor List
1. Login as a **Patient** user
2. Navigate to "Home" tab → "Find a Doctor" button
3. **Search Test:**
   - Type in search bar (e.g., "cardiology", "Dr. John")
   - Verify list filters in real-time
4. **Specialty Filter Test:**
   - Tap specialty chips (All, Cardiology, Pediatrics, etc.)
   - Verify list updates with selected specialty
5. **Pagination Test:**
   - Scroll to bottom of list
   - Verify "Loading..." appears
   - Verify more doctors load automatically
6. **Pull-to-Refresh Test:**
   - Pull down from top of list
   - Verify refresh indicator shows
   - Verify data reloads

#### Test Doctor Details
1. Tap any doctor card
2. Verify details screen shows:
   - Profile photo
   - Name, specialty, hospital
   - Experience, education, fees
   - Bio/About section
   - Working hours
   - Languages
3. Tap "Book Appointment" button
4. Verify navigation to booking screen

---

### 2. Appointment Booking Feature

#### Test Booking Flow
1. From Doctor Details, tap "Book Appointment"
2. **Date Selection:**
   - Tap date button
   - Verify native date picker opens
   - Try selecting past date → Should show error
   - Select future date → Should proceed
3. **Time Slot Selection:**
   - Verify available slots show (green)
   - Verify booked slots are disabled (gray, strikethrough)
   - Select an available time slot
4. **Form Validation:**
   - Leave reason empty → Tap "Book Appointment"
   - Verify error: "Please provide a reason for visit"
   - Enter reason: "Regular checkup"
   - Tap "Book Appointment"
5. **Success Scenario:**
   - Verify loading indicator shows
   - Verify success message
   - Verify navigation back to previous screen

#### Test Validations
1. Try booking same doctor + date twice
   - Should show: "You already have an appointment..."
2. Try booking a time slot that's taken
   - Should show: "This time slot is not available..."
3. Try booking on doctor's day off (if configured)
   - Should show: "Clinic is closed on [day]..."

---

### 3. Push Notifications Feature

#### Test Token Registration
1. Login with any user account
2. **Check Console Logs:**
   - Look for: "Device token registered successfully"
3. **Verify Firestore:**
   - Open Firebase Console → Firestore
   - Navigate to `userTokens` collection
   - Find document with your userId
   - Verify fields: token, platform, deviceInfo

#### Test Notifications (Receptionist)
1. Login as **Receptionist** user
2. Navigate to Dashboard
3. Have another user create a new appointment
4. **Expected Behavior:**
   - Dashboard should update automatically (real-time)
   - Sound alert should play
   - New appointment should have "NEW" badge
   - Badge should show count

#### Test Local Notifications
```javascript
// You can test manually in the app by calling:
import notificationService from './src/services/notificationService';

notificationService.scheduleNotification(
  'Test Notification',
  'This is a test notification',
  { test: true }
);
```

---

### 4. Real-Time Dashboards Feature

#### Test Doctor Dashboard
1. Login as **Doctor** user
2. Navigate to Dashboard
3. **Verify Display:**
   - Stats cards: Today, Pending, Confirmed, Completed
   - Today's appointments list
   - Status badges with colors
4. **Test Real-Time Updates:**
   - Open Firebase Console in browser
   - Manually update an appointment status in Firestore
   - **Verify:** Dashboard updates within 1-2 seconds
5. **Test Pull-to-Refresh:**
   - Pull down on dashboard
   - Verify refresh indicator
   - Verify data reloads

#### Test Receptionist Dashboard
1. Login as **Receptionist** user
2. Navigate to Dashboard
3. **Verify Display:**
   - "Pending Confirmations" section
   - Badge showing count
   - Appointment cards with patient info
   - Confirm and Reschedule buttons
4. **Test Confirm Action:**
   - Tap "Confirm" on any appointment
   - Verify confirmation dialog
   - Tap "Confirm" in dialog
   - **Expected:** Appointment moves to confirmed state
   - **Verify:** It disappears from pending list
5. **Test Real-Time with Sound:**
   - Have another user create new appointment
   - **Expected:** Sound plays, new card appears with "NEW" badge

---

### 5. File Upload Feature

#### Test Camera Upload
1. Login as **Patient** user
2. Navigate to "Documents" tab
3. Tap "Upload Document" button
4. Select "Take Photo" from options
5. **Camera Permission:**
   - First time: Should request permission
   - Grant permission
6. **Take Photo:**
   - Use camera to take photo
   - Edit/crop if desired
   - Tap "Use Photo"
7. **Document Details Modal:**
   - Enter title: "Lab Report"
   - Select category: "Lab"
   - Tap "Upload"
8. **Verify Upload:**
   - Progress bar should show (0-100%)
   - Success message should appear
   - Document should appear in list

#### Test Gallery Upload
1. Tap "Upload Document" button
2. Select "Choose from Gallery"
3. **Gallery Permission:**
   - First time: Should request permission
   - Grant permission
4. **Select Image:**
   - Browse gallery
   - Select an image
   - Edit/crop if desired
   - Tap "Done"
5. **Document Details Modal:**
   - Enter title: "Prescription"
   - Select category: "Prescription"
   - Tap "Upload"
6. **Verify Upload:**
   - Progress should show
   - Success message appears
   - Document appears in list

#### Verify in Firebase Storage
1. Open Firebase Console → Storage
2. Navigate to `documents/{patientId}/`
3. Verify file exists with timestamp filename
4. Click file → Verify it's accessible

#### Verify in Firestore
1. Open Firebase Console → Firestore
2. Navigate to `documents` collection
3. Find uploaded document
4. Verify metadata:
   - patientId
   - title
   - category
   - fileUrl
   - storagePath
   - uploadedAt

---

## 🐛 Troubleshooting

### Issue: Date picker doesn't show
**Solution:** Native date picker requires physical device or proper emulator. On web, it falls back to HTML input.

### Issue: Notifications not working
**Solution:** 
- Ensure you're testing on physical device (not emulator)
- Check notification permissions in device settings
- Verify Expo project ID is configured

### Issue: File upload fails
**Solution:**
- Check Firebase Storage rules allow writes
- Verify Firebase config is correct
- Ensure permissions are granted

### Issue: Real-time updates not working
**Solution:**
- Check Firebase console for Firestore connection
- Verify user is authenticated
- Check browser console for errors

### Issue: Camera not opening
**Solution:**
- Physical device required for camera
- Emulator requires virtual camera setup
- Check permissions granted

---

## 📊 Sample Test Data

### Create Test Doctor (Firestore Console)
```javascript
// doctors collection
{
  name: "Dr. John Smith",
  specialty: "Cardiology",
  hospital: "City Hospital",
  experience: 15,
  education: "MD, MBBS",
  fees: 150,
  rating: 4.8,
  reviewCount: 234,
  bio: "Experienced cardiologist specializing in heart disease...",
  photoURL: "https://...",
  workingHours: {
    Monday: { open: true, start: "09:00", end: "17:00" },
    Tuesday: { open: true, start: "09:00", end: "17:00" },
    Wednesday: { open: true, start: "09:00", end: "17:00" },
    Thursday: { open: true, start: "09:00", end: "17:00" },
    Friday: { open: true, start: "09:00", end: "13:00" },
    Saturday: { open: false },
    Sunday: { open: false }
  },
  languages: ["English", "Spanish"]
}
```

### Create Test Appointment
```javascript
// appointments collection
{
  patientId: "user123",
  patientName: "Jane Doe",
  doctorId: "doctor456",
  appointmentDate: Timestamp.fromDate(new Date("2025-11-15T10:00:00")),
  reason: "Regular checkup",
  notes: "First visit",
  status: "pending",
  createdAt: serverTimestamp()
}
```

---

## 🎯 Success Criteria Checklist

### Doctor Discovery
- [ ] Search filters list in real-time
- [ ] Specialty filter works correctly
- [ ] Pagination loads more doctors
- [ ] Pull-to-refresh updates data
- [ ] Doctor details show all information
- [ ] Navigation works between screens

### Appointment Booking
- [ ] Native date picker opens
- [ ] Past dates are blocked
- [ ] Time slots show availability
- [ ] Booked slots are disabled
- [ ] Form validation works
- [ ] Success message appears
- [ ] Appointment created in Firestore

### Push Notifications
- [ ] Token registered on login
- [ ] Token appears in Firestore
- [ ] Local notifications work
- [ ] Sound plays for new appointments
- [ ] Badge count updates

### Real-Time Dashboards
- [ ] Doctor dashboard shows stats
- [ ] Receptionist dashboard shows pending
- [ ] Updates happen within 2 seconds
- [ ] Sound plays for receptionist
- [ ] Pull-to-refresh works
- [ ] Confirm action updates status

### File Upload
- [ ] Camera permission requested
- [ ] Gallery permission requested
- [ ] Photo captured successfully
- [ ] Image selected from gallery
- [ ] Upload progress shows
- [ ] File appears in Storage
- [ ] Metadata saved in Firestore
- [ ] Success message appears

---

## 📱 Platform-Specific Notes

### iOS
- Date picker uses spinner style
- Requires physical device for camera
- Push notifications require Apple Developer account

### Android
- Date picker uses calendar style
- Notification channels configured
- Camera works on emulator with virtual camera

### Web
- Date picker uses HTML5 input
- No camera/gallery (use file input)
- Push notifications work with service worker

---

## 🔗 Quick Links

- **Firebase Console:** https://console.firebase.google.com/project/medconnect-2
- **Firestore Data:** https://console.firebase.google.com/project/medconnect-2/firestore
- **Storage Files:** https://console.firebase.google.com/project/medconnect-2/storage
- **Expo Project:** https://expo.dev/

---

## 💡 Tips for Testing

1. **Use React Native Debugger** for better logging
2. **Enable Firestore debug logs** to see queries
3. **Use Firebase Emulator** for local testing
4. **Test on real devices** for full native features
5. **Check network tab** for API calls
6. **Monitor Firestore usage** to avoid exceeding quotas

---

**Last Updated:** November 11, 2025  
**Next:** Complete Tasks 4 & 6 (Medical Documents Viewer, Doctor Finish Visit)
