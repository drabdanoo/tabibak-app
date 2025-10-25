# 📱 How to Build Tabibak APK for BlueStacks

## ⚠️ Current Issue: Corrupted NDK

The Android NDK (Native Development Kit) folder is corrupted. Here's how to fix it:

---

## 🔧 **Option 1: Delete Corrupted NDK (Recommended)**

### **Step 1: Delete the corrupted folder**
Open File Explorer and delete this folder:
```
C:\Users\2023\AppData\Local\Android\sdk\ndk\27.0.12077973
```

### **Step 2: Build APK**
```bash
cd g:\tabibak-app\tabibak_mobile
flutter build apk --debug
```

Flutter will automatically download a fresh NDK.

---

## 🔧 **Option 2: Use Android Studio**

### **Step 1: Open Android Studio**
1. Open Android Studio
2. Go to: **Tools** → **SDK Manager**
3. Click **SDK Tools** tab
4. **Uncheck** "NDK (Side by side)"
5. Click **Apply** → **OK**
6. **Check** "NDK (Side by side)" again
7. Click **Apply** → **OK** (re-downloads fresh NDK)

### **Step 2: Build APK**
```bash
cd g:\tabibak-app\tabibak_mobile
flutter build apk --debug
```

---

## 🔧 **Option 3: Manual Command (PowerShell as Admin)**

### **Step 1: Delete folder via PowerShell**
```powershell
Remove-Item "C:\Users\2023\AppData\Local\Android\sdk\ndk\27.0.12077973" -Recurse -Force
```

### **Step 2: Build APK**
```bash
cd g:\tabibak-app\tabibak_mobile
flutter build apk --debug
```

---

## 📦 **After Successful Build**

### **APK Location:**
```
g:\tabibak-app\tabibak_mobile\build\app\outputs\flutter-apk\app-debug.apk
```

### **Install on BlueStacks:**
1. Open BlueStacks
2. Drag and drop `app-debug.apk` into BlueStacks window
3. Or use: **System Apps** → **Media Manager** → **Import from Windows**
4. Select the APK file
5. App will install automatically

---

## 🎯 **Quick Test Without Building APK**

If you want to test immediately without fixing NDK:

### **Option A: Test on Chrome**
```bash
cd g:\tabibak-app\tabibak_mobile
flutter run -d chrome
```
Opens in Chrome browser - works exactly like mobile app!

### **Option B: Test on Windows**
```bash
cd g:\tabibak-app\tabibak_mobile
flutter run -d windows
```
Opens as Windows desktop app!

---

## 🚀 **Alternative: Pre-built APK**

I can guide you to build a release APK once NDK is fixed:

```bash
# For release APK (smaller, optimized)
flutter build apk --release

# Output location:
# g:\tabibak-app\tabibak_mobile\build\app\outputs\flutter-apk\app-release.apk
```

---

## 📝 **Summary**

**Easiest Fix:**
1. Delete: `C:\Users\2023\AppData\Local\Android\sdk\ndk\27.0.12077973`
2. Run: `flutter build apk --debug`
3. Wait 2-3 minutes
4. Get APK from: `build\app\outputs\flutter-apk\app-debug.apk`
5. Install on BlueStacks

**Quick Test (No APK needed):**
```bash
flutter run -d chrome
```

---

## ✅ **What the App Does**

Once installed on BlueStacks, the app will:
- ✅ Load your web app: https://medconnect-2.web.app
- ✅ Work exactly like the website
- ✅ Support Firebase login
- ✅ Access Firestore database
- ✅ Show Arabic interface
- ✅ Detect internet connection
- ✅ Show loading progress

---

## 🎉 **Next Steps After APK Works**

1. **Test all features** in BlueStacks
2. **Build release APK** for production
3. **Publish to Google Play Store** (optional)
4. **Create iOS version** (requires Mac)

---

Need help? Just ask! 😊
