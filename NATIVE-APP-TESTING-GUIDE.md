# 🧪 Native App Testing Guide

## 🎯 What We're Testing

**Patient Portal (85% Complete)**
- Authentication flow
- Doctor discovery
- Booking system
- Appointments management

---

## 🚀 How to Test

### **Step 1: Install Dependencies**

Open a **NEW PowerShell window**:

```powershell
cd g:\tabibak-app\tabibak_native
flutter pub get
```

**Expected Output:**
```
Resolving dependencies...
Got dependencies!
```

---

### **Step 2: Check for Errors**

```powershell
flutter analyze
```

This checks for any code errors.

---

### **Step 3: Run the App**

#### **Option A: Chrome (Fastest)**
```powershell
flutter run -d chrome
```

#### **Option B: Android Emulator**
```powershell
# Start emulator first
flutter emulators --launch Pixel_7

# Then run
flutter run
```

#### **Option C: BlueStacks**
```powershell
# Build APK
flutter build apk --debug

# APK location:
# g:\tabibak-app\tabibak_native\build\app\outputs\flutter-apk\app-debug.apk

# Install in BlueStacks by dragging the APK file
```

---

## ✅ Testing Checklist

### **1. Splash Screen**
- [ ] App opens with green splash screen
- [ ] Shows "طبيبك" logo
- [ ] Loading indicator appears
- [ ] Transitions to role selection (2 seconds)

### **2. Role Selection**
- [ ] Shows 3 cards: Patient, Doctor, Receptionist
- [ ] Cards are clickable
- [ ] Clicking "مريض" goes to phone auth

### **3. Phone Authentication**
- [ ] Phone input screen appears
- [ ] Country code dropdown works (+964, +965, +966)
- [ ] Can enter phone number
- [ ] "إرسال رمز التحقق" button works
- [ ] Shows loading indicator

**Note:** OTP will be sent to real phone number!

### **4. OTP Verification**
- [ ] 6-digit PIN input appears
- [ ] Can enter OTP code
- [ ] "تحقق" button works
- [ ] Shows loading indicator
- [ ] Goes to profile setup (new user) or home (existing user)

### **5. Profile Setup**
- [ ] Name input field works
- [ ] Email input field works (optional)
- [ ] Phone number is displayed (read-only)
- [ ] "إنشاء الحساب" button works
- [ ] Validation works (name required)

### **6. Patient Home Screen**
- [ ] Shows "طبيبك" in app bar
- [ ] Search bar appears
- [ ] Doctors list loads
- [ ] Doctor cards show:
  - [ ] Doctor photo/initials
  - [ ] Name
  - [ ] Specialty
  - [ ] Rating
  - [ ] Fee
  - [ ] Open/Closed status
- [ ] Search works (type doctor name)
- [ ] Bottom navigation shows (Home, Appointments, Profile)
- [ ] Logout button works

### **7. Doctor Profile**
- [ ] Clicking doctor card opens profile
- [ ] Shows doctor details
- [ ] Shows clinic hours
- [ ] Shows consultation fee
- [ ] "حجز موعد" button works

### **8. Booking Screen**
- [ ] Doctor info card appears
- [ ] Date picker works
- [ ] Time slots appear after selecting date
- [ ] Can select time slot
- [ ] Reason text field works
- [ ] "تأكيد الحجز" button works
- [ ] Shows success message
- [ ] Returns to home

### **9. My Appointments**
- [ ] Click "مواعيدي" in bottom nav
- [ ] Shows appointments list
- [ ] Each appointment shows:
  - [ ] Doctor name
  - [ ] Status badge
  - [ ] Date & time
  - [ ] Reason
- [ ] "إلغاء" button works
- [ ] Confirmation dialog appears
- [ ] Appointment cancels successfully

### **10. Logout**
- [ ] Click logout button
- [ ] Returns to role selection
- [ ] Can login again

---

## 🐛 Common Issues & Solutions

### **Issue 1: Flutter not recognized**
**Solution:**
```powershell
# Open NEW PowerShell window
# Flutter should work in new window
```

### **Issue 2: Dependencies fail**
**Solution:**
```powershell
flutter clean
flutter pub get
```

### **Issue 3: Build fails**
**Solution:**
```powershell
# Check error message
# Most common: Missing google-services.json
# Already added at: android/app/google-services.json
```

### **Issue 4: OTP doesn't arrive**
**Solution:**
- Check phone number format
- Make sure phone number is real
- Check Firebase Console → Authentication
- OTP might take 1-2 minutes

### **Issue 5: Doctors don't load**
**Solution:**
- Check internet connection
- Check Firebase Console → Firestore
- Make sure doctors collection has data with `listed: true`

### **Issue 6: Can't book appointment**
**Solution:**
- Make sure you're logged in
- Check Firestore rules are deployed
- Check console for errors

---

## 📊 Expected Results

### **What Should Work:**
✅ Authentication (phone OTP)
✅ Browse doctors
✅ Search doctors
✅ View doctor profiles
✅ Book appointments
✅ View appointments
✅ Cancel appointments
✅ Logout

### **What Won't Work Yet:**
❌ Doctor portal (placeholder)
❌ Receptionist portal (placeholder)
❌ Profile editing
❌ Medical documents
❌ Ratings

---

## 🎥 Testing Scenarios

### **Scenario 1: New User Journey**
1. Open app
2. Choose "Patient"
3. Enter phone: +964 7XXXXXXXXX
4. Verify OTP
5. Create profile
6. Browse doctors
7. Book appointment
8. View appointments
9. Cancel appointment
10. Logout

**Expected Time:** 5-10 minutes

### **Scenario 2: Existing User**
1. Open app
2. Choose "Patient"
3. Enter phone
4. Verify OTP
5. Goes directly to home
6. View appointments
7. Book new appointment

**Expected Time:** 2-3 minutes

### **Scenario 3: Search & Discovery**
1. Login
2. Search for doctor by name
3. Search by specialty
4. View doctor profile
5. Book appointment

**Expected Time:** 2-3 minutes

---

## 📝 Bug Report Template

If you find bugs, note:

```markdown
## Bug Report

**Screen:** [e.g., Booking Screen]
**Action:** [e.g., Clicked "تأكيد الحجز"]
**Expected:** [e.g., Should book appointment]
**Actual:** [e.g., Shows error message]
**Error Message:** [Copy exact error]
**Steps to Reproduce:**
1. 
2. 
3. 
```

---

## 🎉 Success Criteria

**Test is successful if:**
- ✅ App opens without crashes
- ✅ Can login with phone
- ✅ Can see doctors
- ✅ Can book appointment
- ✅ Can view appointments
- ✅ UI looks good
- ✅ No major errors in console

---

## 💡 Testing Tips

1. **Test on Chrome first** (fastest)
2. **Check console for errors** (F12)
3. **Test with real phone number** (for OTP)
4. **Take screenshots** of any issues
5. **Note any slow loading**
6. **Check if data persists** after refresh

---

## 🚀 Ready to Test!

**Quick Start:**
```powershell
cd g:\tabibak-app\tabibak_native
flutter pub get
flutter run -d chrome
```

**Then follow the testing checklist above!**

---

## 📞 Need Help?

If you encounter issues:
1. Check the error message
2. Look in "Common Issues" section above
3. Check Firebase Console
4. Let me know the exact error!

**Happy Testing!** 🧪✨
