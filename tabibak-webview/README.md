# Tabibok Android App 🏥

**Tabibok** (طبيبك) - Your Healthcare Partner

A native Android WebView wrapper for the Tabibok medical appointment booking web application.

---

## 📱 App Information

- **Package Name**: `com.abdullah.tabibak`
- **App Name**: Tabibok
- **Version**: 1.0.0
- **Target SDK**: Android 14 (API 34)
- **Minimum SDK**: Android 7.0 (API 24)
- **Web URL**: https://medconnect-2.web.app

---

## ✨ Features

### Core Features
- ✅ Full WebView integration with your web app
- ✅ Beautiful splash screen with logo animation
- ✅ Swipe-to-refresh functionality
- ✅ Back button navigation support
- ✅ Progress bar for page loading
- ✅ Offline error handling

### Advanced Features
- 📸 **Camera Access** - For profile pictures and document uploads
- 📁 **File Upload** - Select images/documents from gallery
- 📥 **File Download** - Download prescriptions and medical documents
- 📍 **Geolocation** - Find nearby clinics and doctors
- 🔔 **Push Notifications** - Firebase Cloud Messaging integration
- 🌐 **External Links** - Opens phone, email, WhatsApp links in native apps

### Security & Performance
- 🔒 Network security configuration
- 💾 Local storage and cache support
- 🚀 Optimized WebView settings
- 📱 Responsive design support

---

## 🛠️ Prerequisites

Before building the app, ensure you have:

1. **Android Studio** (Latest version recommended)
   - Download from: https://developer.android.com/studio

2. **Java Development Kit (JDK) 8 or higher**
   - Check: `java -version`

3. **Android SDK** with the following components:
   - Android SDK Platform 34
   - Android SDK Build-Tools 34.0.0
   - Android SDK Platform-Tools

---

## 📦 Project Structure

```
tabibak-webview/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── java/com/abdullah/tabibak/
│   │       │   ├── MainActivity.java          # Main WebView activity
│   │       │   ├── SplashActivity.java        # Splash screen
│   │       │   └── MyFirebaseMessagingService.java  # Push notifications
│   │       ├── res/
│   │       │   ├── layout/
│   │       │   │   ├── activity_main.xml      # Main layout
│   │       │   │   └── activity_splash.xml    # Splash layout
│   │       │   ├── drawable/                  # Icons and graphics
│   │       │   ├── mipmap-*/                  # App launcher icons
│   │       │   ├── values/
│   │       │   │   ├── colors.xml             # App colors (teal theme)
│   │       │   │   ├── strings.xml            # App strings
│   │       │   │   └── themes.xml             # App themes
│   │       │   ├── anim/                      # Splash animations
│   │       │   └── xml/
│   │       │       ├── network_security_config.xml
│   │       │       └── file_paths.xml
│   │       ├── AndroidManifest.xml            # App manifest
│   │       └── google-services.json           # Firebase config
│   ├── build.gradle                           # App-level Gradle
│   └── proguard-rules.pro                     # ProGuard rules
├── gradle/                                    # Gradle wrapper
├── build.gradle                               # Project-level Gradle
├── settings.gradle                            # Gradle settings
└── README.md                                  # This file
```

---

## 🚀 Building the APK

### Method 1: Using Android Studio (Recommended)

1. **Open the Project**
   ```
   - Launch Android Studio
   - Click "Open an Existing Project"
   - Navigate to: G:\tabibak-app\tabibak-webview
   - Click "OK"
   ```

2. **Sync Gradle**
   ```
   - Android Studio will automatically sync Gradle
   - Wait for "Gradle sync finished" message
   - If errors occur, click "Sync Project with Gradle Files"
   ```

3. **Add App Icons** (IMPORTANT!)
   ```
   - Export your logo from Canva in PNG format
   - Create icons in these sizes:
     * mdpi: 48x48
     * hdpi: 72x72
     * xhdpi: 96x96
     * xxhdpi: 144x144
     * xxxhdpi: 192x192
   
   - Replace placeholder icons in:
     app/src/main/res/mipmap-*/ic_launcher.png
     app/src/main/res/mipmap-*/ic_launcher_round.png
   
   - Replace splash logo:
     app/src/main/res/drawable/logo_splash.png (512x512)
   ```

4. **Build Debug APK**
   ```
   - Click "Build" menu
   - Select "Build Bundle(s) / APK(s)"
   - Click "Build APK(s)"
   - Wait for build to complete
   - APK location: app/build/outputs/apk/debug/app-debug.apk
   ```

5. **Build Release APK** (For Production)
   ```
   - Click "Build" menu
   - Select "Generate Signed Bundle / APK"
   - Choose "APK"
   - Click "Next"
   
   - Create new keystore or use existing:
     * Key store path: Choose location
     * Password: Create strong password
     * Key alias: tabibok-key
     * Key password: Same as keystore password
     * Validity: 25 years
     * Certificate info: Fill your details
   
   - Click "Next"
   - Select "release" build variant
   - Check both signature versions (V1 and V2)
   - Click "Finish"
   
   - APK location: app/release/app-release.apk
   ```

### Method 2: Using Command Line

1. **Navigate to Project Directory**
   ```bash
   cd G:\tabibak-app\tabibak-webview
   ```

2. **Build Debug APK**
   ```bash
   # Windows
   gradlew.bat assembleDebug
   
   # Output: app\build\outputs\apk\debug\app-debug.apk
   ```

3. **Build Release APK**
   ```bash
   # First, create keystore (one-time)
   keytool -genkey -v -keystore tabibok-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias tabibok-key
   
   # Then build release APK
   gradlew.bat assembleRelease
   
   # Sign the APK
   jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore tabibok-keystore.jks app\build\outputs\apk\release\app-release-unsigned.apk tabibok-key
   
   # Align the APK
   zipalign -v 4 app\build\outputs\apk\release\app-release-unsigned.apk app\build\outputs\apk\release\app-release.apk
   ```

---

## 📲 Installing the APK

### On Physical Device

1. **Enable Developer Options**
   ```
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings > Developer Options
   - Enable "USB Debugging"
   ```

2. **Install via USB**
   ```bash
   # Connect device via USB
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

3. **Install via File Transfer**
   ```
   - Copy APK to device storage
   - Open file manager on device
   - Tap the APK file
   - Allow "Install from Unknown Sources" if prompted
   - Tap "Install"
   ```

### On Emulator

1. **Create Emulator in Android Studio**
   ```
   - Click "Device Manager" (phone icon)
   - Click "Create Device"
   - Select device (e.g., Pixel 5)
   - Select system image (API 34)
   - Click "Finish"
   ```

2. **Run App**
   ```
   - Click "Run" (green play button)
   - Select emulator
   - App will install and launch automatically
   ```

---

## 🎨 Customization Guide

### Change App Colors
Edit `app/src/main/res/values/colors.xml`:
```xml
<color name="primary">#2D9B9B</color>        <!-- Main teal color -->
<color name="primary_dark">#1F7A7A</color>   <!-- Darker teal -->
<color name="splash_background">#2D9B9B</color>
```

### Change App Name
Edit `app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">Tabibok</string>
<string name="app_tagline">طبيبك - Your Healthcare Partner</string>
```

### Change Web URL
Edit `MainActivity.java` line 47:
```java
private static final String BASE_URL = "https://medconnect-2.web.app";
```

### Change Splash Duration
Edit `SplashActivity.java` line 15:
```java
private static final int SPLASH_DURATION = 2500; // milliseconds
```

---

## 🔧 Troubleshooting

### Build Errors

**Error: "SDK location not found"**
```
Solution: Create local.properties file with:
sdk.dir=C\:\\Users\\YourUsername\\AppData\\Local\\Android\\Sdk
```

**Error: "Gradle sync failed"**
```
Solution:
1. File > Invalidate Caches / Restart
2. Delete .gradle folder
3. Sync again
```

**Error: "Manifest merger failed"**
```
Solution: Check AndroidManifest.xml for duplicate entries
```

### Runtime Errors

**WebView not loading**
```
Solution:
1. Check internet connection
2. Verify BASE_URL is correct
3. Check network_security_config.xml
```

**Camera/File upload not working**
```
Solution:
1. Grant permissions in device settings
2. Check AndroidManifest.xml has required permissions
3. Test on physical device (emulator may have issues)
```

**Push notifications not working**
```
Solution:
1. Verify google-services.json is correct
2. Check Firebase Console for app registration
3. Enable notifications in device settings
```

---

## 📝 Important Notes

### Before Publishing to Google Play

1. **Update Version**
   - Edit `app/build.gradle`:
   ```gradle
   versionCode 1          // Increment for each release
   versionName "1.0.0"    // Update version string
   ```

2. **Create Signed Release APK**
   - Use release keystore (keep it safe!)
   - Enable ProGuard for code obfuscation

3. **Test Thoroughly**
   - Test on multiple devices
   - Test all features (camera, location, notifications)
   - Test offline behavior

4. **Prepare Store Listing**
   - App icon (512x512)
   - Feature graphic (1024x500)
   - Screenshots (at least 2)
   - App description
   - Privacy policy URL

5. **Firebase Configuration**
   - Add SHA-1 certificate fingerprint to Firebase Console
   - Enable required Firebase services

### Getting SHA-1 Fingerprint

```bash
# Debug keystore
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android

# Release keystore
keytool -list -v -keystore tabibok-keystore.jks -alias tabibok-key
```

Copy the SHA-1 fingerprint and add it to Firebase Console:
1. Go to Firebase Console
2. Select your project
3. Go to Project Settings
4. Add fingerprint under "Your apps" > Android app

---

## 🔐 Security Checklist

- ✅ Use HTTPS for all web requests
- ✅ Validate SSL certificates
- ✅ Store sensitive data securely
- ✅ Keep keystore file safe (never commit to Git!)
- ✅ Use ProGuard for release builds
- ✅ Request only necessary permissions
- ✅ Handle permission denials gracefully

---

## 📱 Supported Features

| Feature | Status |
|---------|--------|
| WebView | ✅ |
| Splash Screen | ✅ |
| Camera Access | ✅ |
| File Upload | ✅ |
| File Download | ✅ |
| Geolocation | ✅ |
| Push Notifications | ✅ |
| Offline Detection | ✅ |
| Back Button | ✅ |
| Pull to Refresh | ✅ |
| External Links | ✅ |
| JavaScript | ✅ |
| Local Storage | ✅ |
| Cookies | ✅ |

---

## 📞 Support

For issues or questions:
- Email: support@tabibok.com
- Web: https://medconnect-2.web.app

---

## 📄 License

Copyright © 2025 Tabibok. All rights reserved.

---

## 🎉 You're All Set!

Your Tabibok Android app is ready to build! Follow the steps above to create your APK and deploy to the Google Play Store.

**Good luck! 🚀**
