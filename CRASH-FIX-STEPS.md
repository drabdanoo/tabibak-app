# 🔧 App Crash - Debugging Steps

## Current Status
App installs but crashes immediately on startup.

## Most Likely Causes

### 1. **Firebase Initialization Failure** (90% likely)
- Firebase trying to initialize before app is ready
- Missing permissions
- Network timeout

### 2. **Missing Dependencies**
- Provider not initialized correctly
- Auth service failing

### 3. **Android Permissions**
- Internet permission missing
- Firebase needs network access

---

## Fix Applied

### **Temporarily Disabled Firebase**

Changed `lib/main.dart` to skip Firebase initialization:

```dart
void main() {
  // Initialize without Firebase for now
  runApp(const TabibakApp());
}
```

This will let us see if Firebase is the problem.

---

## How to Test the Fix

### **Option 1: Hot Reload (if flutter run is still running)**
In the terminal where `flutter run` is active:
- Press `r` - Hot reload
- App should restart without Firebase

### **Option 2: Rebuild**
```powershell
# Stop current run (Ctrl+C if running)
cd g:\tabibak-app\tabibak_native
flutter run
```

---

## What Should Happen Now

**If Firebase was the problem:**
- ✅ App opens successfully
- ✅ Shows splash screen
- ✅ Shows role selection
- ❌ Login won't work (needs Firebase)

**If still crashes:**
- Need to check other issues
- Will need actual crash logs

---

## Getting Crash Logs

If it still crashes, run:

```powershell
flutter run --verbose
```

Look for lines with:
- `[ERROR]`
- `Exception`
- `FATAL`

Copy those lines and share them.

---

## Next Steps

### **If App Opens Without Firebase:**

1. **Test UI Navigation**
   - Can you see splash screen?
   - Can you see role selection?
   - Can you click buttons?

2. **Re-enable Firebase Gradually**
   - Add Firebase back
   - Add better error handling
   - Test again

### **If Still Crashes:**

Need to see actual error logs. Run:

```powershell
flutter logs
```

This shows real-time Android logs.

---

## Alternative: Check Android Manifest

The crash might be due to missing internet permission.

**File:** `android/app/src/main/AndroidManifest.xml`

Should have:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
```

---

## Quick Test Commands

```powershell
# Check if app is installed
flutter devices

# Run with verbose logging
flutter run --verbose

# View logs
flutter logs

# Hot reload (if running)
# Press 'r' in terminal

# Hot restart (if running)
# Press 'R' in terminal

# Quit
# Press 'q' in terminal
```

---

## Current Change

**File Modified:** `lib/main.dart`
**Change:** Disabled Firebase initialization
**Purpose:** Test if Firebase is causing crash

**Try running the app now!** 🚀
