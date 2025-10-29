# Testing Guide for Authentication Fixes

## Overview
This guide will help you test the authentication fixes for the tabibak native app. The app now has improved sign-in functionality for all three user types: patients, doctors, and receptionists.

## Prerequisites

### 1. Build the App
```bash
cd /path/to/tabibak-app/tabibak_native

# For Android APK
flutter build apk --debug

# For running on emulator
flutter run
```

### 2. Install on Device/Emulator
- **Physical Device**: Transfer the APK from `build/app/outputs/flutter-apk/app-debug.apk` and install
- **Emulator**: Use Android Studio emulator or `flutter run`
- **BlueStacks**: Drag and drop the APK file

## Test Scenarios

### Test 1: Patient Phone Authentication (Happy Path)

**Steps:**
1. Open the app
2. Select "مريض" (Patient) from role selection screen
3. Enter a valid phone number with country code (e.g., +964 7XXXXXXXXX)
4. Tap "إرسال رمز التحقق" (Send verification code)
5. Wait for OTP code (check your phone messages)
6. Enter the 6-digit OTP code
7. Tap "تحقق" (Verify)

**Expected Result:**
- ✅ OTP sent successfully
- ✅ OTP verification successful
- ✅ For new users: Navigate to profile setup screen
- ✅ For existing users: Navigate to patient home screen

**Check Logs:**
```
[AuthService] Sending OTP to: +964XXXXXXXXXX
[AuthService] Code sent successfully
[AuthService] OTP verification successful! User: [userId]
[AuthProvider] User successfully verified: [userId]
[AuthService] User role found: patient
```

### Test 2: Patient Phone Authentication (Error Cases)

#### Test 2a: Invalid Phone Number
1. Enter an invalid phone number (e.g., "123")
2. Tap "إرسال رمز التحقق"

**Expected Result:**
- ❌ Error message: "رقم الهاتف غير صحيح"

#### Test 2b: Wrong OTP Code
1. Complete steps 1-4 from Test 1
2. Enter a wrong OTP code (e.g., "123456")
3. Tap "تحقق"

**Expected Result:**
- ❌ Error message: "رمز التحقق غير صحيح"

#### Test 2c: No Internet Connection
1. Disable internet on device
2. Try to send OTP

**Expected Result:**
- ❌ Error message related to network connectivity

### Test 3: Doctor Email Authentication (Happy Path)

**Steps:**
1. Open the app
2. Select "طبيب" (Doctor) from role selection screen
3. Enter doctor email (e.g., doctor@example.com)
4. Enter password
5. Tap "تسجيل الدخول" (Sign In)

**Expected Result:**
- ✅ Sign-in successful
- ✅ User role verified as doctor
- ✅ Navigate to doctor dashboard

**Check Logs:**
```
[AuthService] Signing in with email: doctor@example.com
[AuthService] Email sign-in successful! User: [userId]
[AuthProvider] User successfully signed in: [userId]
[AuthService] User role found: doctor
```

### Test 4: Doctor Email Authentication (Error Cases)

#### Test 4a: Wrong Password
1. Enter valid doctor email
2. Enter incorrect password
3. Tap sign in

**Expected Result:**
- ❌ Error message: "البريد الإلكتروني أو كلمة المرور غير صحيحة"

#### Test 4b: Non-Doctor Account
1. Enter email of a patient or receptionist account
2. Enter correct password
3. Tap sign in

**Expected Result:**
- ❌ Error message: "هذا الحساب ليس حساب طبيب"
- ✅ User automatically signed out

#### Test 4c: Invalid Email Format
1. Enter invalid email (e.g., "notanemail")
2. Tap sign in

**Expected Result:**
- ❌ Form validation error: "الرجاء إدخال بريد إلكتروني صحيح"

### Test 5: Receptionist Email Authentication (Happy Path)

**Steps:**
1. Open the app
2. Select "سكرتير" (Receptionist) from role selection screen
3. Enter receptionist email
4. Enter password
5. Tap "تسجيل الدخول"

**Expected Result:**
- ✅ Sign-in successful
- ✅ User role verified as receptionist
- ✅ Navigate to receptionist dashboard

**Check Logs:**
```
[AuthService] Signing in with email: receptionist@example.com
[AuthService] Email sign-in successful! User: [userId]
[AuthProvider] User successfully signed in: [userId]
[AuthService] User role found: receptionist
```

### Test 6: Receptionist Email Authentication (Error Cases)

#### Test 6a: Non-Receptionist Account
1. Enter email of a doctor or patient account
2. Enter correct password
3. Tap sign in

**Expected Result:**
- ❌ Error message: "هذا الحساب ليس حساب سكرتير"
- ✅ User automatically signed out

## Log Monitoring

### Enable Developer Logs (Android)

1. Connect device via USB
2. Run `adb logcat | grep -E "(AuthService|AuthProvider)"`
3. Or use Android Studio Logcat with filter: `tag:AuthService | tag:AuthProvider`

### Key Log Messages to Watch For

**Success Indicators:**
- `Code sent successfully`
- `OTP verification successful!`
- `Email sign-in successful!`
- `User successfully verified`
- `User successfully signed in`
- `User role found: [role]`

**Error Indicators:**
- `Verification failed`
- `Firebase Auth error`
- `Error in verifyOTP`
- `Error in signInWithEmail`
- `No user role found`

## Troubleshooting

### Problem: OTP Not Received

**Possible Causes:**
1. Phone number format incorrect
2. Firebase phone auth not enabled
3. SMS quota exceeded
4. Carrier/country restrictions

**Solutions:**
1. Verify phone number format: `+[country_code][phone_number]`
2. Check Firebase Console → Authentication → Sign-in methods → Phone is enabled
3. Check Firebase quota limits
4. Try with a different phone number

### Problem: "operation-not-allowed" Error

**Cause:** Phone authentication not enabled in Firebase

**Solution:**
1. Go to Firebase Console
2. Navigate to Authentication → Sign-in methods
3. Enable "Phone" sign-in method
4. Save changes

### Problem: Type Cast Errors Still Occurring

**Cause:** Firebase SDK version compatibility issue

**What to Look For:**
- Check if user is actually signed in despite error
- Look for `currentUser` being non-null in logs

**Expected Behavior:**
- App should detect successful sign-in even if credential return is null
- User should still be navigated to correct screen

### Problem: User Role Not Found

**Possible Causes:**
1. User document not created in Firestore
2. User document in wrong collection
3. Firestore rules blocking access

**Solutions:**
1. Check Firestore Console → Collections → [patients/doctors/receptionists]
2. Verify user document exists with correct UID
3. Check Firestore security rules allow read access

## Test Data Setup

### Creating Test Accounts

#### Patient Account (Phone Auth)
- Any valid phone number can be used
- Profile created during first sign-in

#### Doctor Account
1. Go to Firebase Console → Authentication
2. Add user with email/password
3. Go to Firestore → doctors collection
4. Create document with UID as document ID
5. Add fields: name, email, specialty, listed: true

#### Receptionist Account
1. Go to Firebase Console → Authentication
2. Add user with email/password
3. Go to Firestore → receptionists collection
4. Create document with UID as document ID
5. Add fields: name, email, doctorId, listed: true

## Success Criteria

✅ **All tests pass**
✅ **No crashes during authentication**
✅ **Error messages are clear and in Arabic**
✅ **Users navigate to correct screen after sign-in**
✅ **Logs show successful authentication flow**
✅ **User roles are correctly identified**

## Reporting Issues

If you encounter issues during testing:

1. **Collect Information:**
   - Device logs (logcat output)
   - Screenshots of errors
   - Steps to reproduce
   - Device model and Android version

2. **Check Documentation:**
   - Review `AUTHENTICATION_FIX_SUMMARY.md`
   - Check Firebase Console for errors
   - Verify Firestore security rules

3. **Report:**
   - Create a GitHub issue with all collected information
   - Include relevant log excerpts
   - Mention which test scenario failed

---

**Last Updated:** October 29, 2025
**Version:** 1.0.1
