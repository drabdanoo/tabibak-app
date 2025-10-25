# 🐛 Troubleshooting White Screen

## Common Causes

### 1. **Firebase Not Initialized**
- Missing `google-services.json`
- Firebase config incorrect
- Internet connection required for first launch

### 2. **Assets Missing**
- Images folder empty
- Icons not found

### 3. **Runtime Error**
- Check device logs
- Provider error
- Navigation error

---

## Solutions Applied

### ✅ Added Error Handling
- Firebase initialization wrapped in try-catch
- Navigation errors caught
- App continues even if Firebase fails

### ✅ Simplified Splash Screen
- Removed complex dependencies
- Added fallback navigation
- Always navigates to role selection

---

## How to Debug

### Option 1: Check Logs in BlueStacks
1. Install APK
2. Open BlueStacks settings
3. Enable developer options
4. Check logcat

### Option 2: Use Android Studio
1. Open Android Studio
2. Open Logcat
3. Filter by "flutter"
4. See actual errors

### Option 3: Connect Real Device
```powershell
# Enable USB debugging on phone
# Connect phone
# Run:
flutter run --verbose
```

---

## Quick Fixes

### If Still White Screen:

**1. Check Internet Connection**
- Firebase needs internet on first launch
- Connect device to WiFi

**2. Wait Longer**
- First launch can take 10-20 seconds
- Firebase initialization takes time

**3. Reinstall**
```powershell
# Uninstall old version
# Install new APK
```

**4. Clear App Data**
- Go to Settings → Apps → Tabibak
- Clear data
- Reopen app

---

## What We Changed

### `lib/main.dart`
```dart
try {
  await FirebaseConfig.initialize();
} catch (e) {
  print('Firebase initialization error: $e');
  // Continue anyway
}
```

### `lib/screens/splash_screen.dart`
```dart
try {
  // Navigation logic
} catch (e) {
  print('Navigation error: $e');
  // Fallback to role selection
  Navigator.pushReplacement(...);
}
```

---

## Expected Behavior

**Normal Flow:**
1. White screen (0-1 second) - App loading
2. Green splash screen (2 seconds) - Logo animation
3. Role selection screen - Choose patient/doctor/receptionist

**If Error:**
1. White screen (0-1 second)
2. Directly to role selection (skips splash)

---

## Testing Checklist

After installing new APK:

- [ ] App opens (not white screen forever)
- [ ] Shows splash OR role selection
- [ ] Can click buttons
- [ ] Can navigate
- [ ] Firebase works (can login)

---

## If Still Not Working

**Try this minimal test:**

1. Uninstall app completely
2. Restart BlueStacks
3. Install new APK
4. Wait 30 seconds
5. If still white, check:
   - BlueStacks has internet
   - BlueStacks is updated
   - APK is not corrupted

---

## Alternative: Use Emulator

If BlueStacks has issues:

```powershell
# Check available emulators
flutter emulators

# Launch one
flutter emulators --launch Pixel_7

# Run app with logs
flutter run --verbose
```

This will show EXACT error messages!

---

## Current Build

**New APK with fixes building now...**

Location: `build\app\outputs\flutter-apk\app-debug.apk`

**Changes:**
- ✅ Better error handling
- ✅ Fallback navigation
- ✅ Continues even if Firebase fails
- ✅ Logs errors to console

---

**Try the new APK once build completes!** 🚀
