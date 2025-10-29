# 📱 Update All Flutter Apps with New Firebase Key

**Date:** October 29, 2025  
**Purpose:** Update all three Flutter apps to use new service account key

---

## 📋 Apps to Update

You have **3 Flutter apps** in your project:

| App | Location | Type | Config File |
|-----|----------|------|-------------|
| **tabibak_native** | `g:\tabibak-app\tabibak_native` | Native Flutter | `google-services.json` |
| **tabibak_ios** | `g:\tabibak-app\tabibak_ios` | iOS Flutter | `GoogleService-Info.plist` |
| **tabibak_webview** | `g:\tabibak-app\tabibak_webview` | WebView Flutter | `google-services.json` |

---

## ✅ **Update tabibak_native (Android)**

### **Step 1: Get New Firebase Config**
1. Go to: https://console.firebase.google.com/
2. Select project: **medconnect-2**
3. Project Settings → Your Apps → Android app
4. Download `google-services.json`

### **Step 2: Replace Config File**
```bash
# Replace the old file with new one
cp ~/Downloads/google-services.json g:\tabibak-app\tabibak_native\android\app\
```

### **Step 3: Verify Package Name**
Open `g:\tabibak-app\tabibak_native\android\app\google-services.json` and check:
```json
"package_name": "com.abdullah.medbook"
```

### **Step 4: Update SHA-1 Fingerprint**
If you changed the package name, get new SHA-1:
```bash
cd g:\tabibak-app\tabibak_native\android
./gradlew signingReport
```

Copy the SHA-1 and update in Firebase Console:
1. Go to Firebase Console
2. Project Settings → Your Apps → Android
3. Add fingerprint to `oauth_client` section

### **Step 5: Clean & Rebuild**
```bash
cd g:\tabibak-app\tabibak_native
flutter clean
flutter pub get
flutter run
```

---

## ✅ **Update tabibak_ios (iOS)**

### **Step 1: Get New Firebase Config**
1. Go to: https://console.firebase.google.com/
2. Select project: **medconnect-2**
3. Project Settings → Your Apps → iOS app
4. Download `GoogleService-Info.plist`

### **Step 2: Replace Config File**
```bash
# Replace the old file with new one
cp ~/Downloads/GoogleService-Info.plist g:\tabibak-app\tabibak_ios\
```

### **Step 3: Update Xcode Project**
1. Open `g:\tabibak-app\tabibak_ios\Runner.xcworkspace` in Xcode
2. Delete old `GoogleService-Info.plist` from Xcode
3. Drag new `GoogleService-Info.plist` into Xcode
4. Make sure it's added to `Runner` target

### **Step 4: Update Bundle ID**
If you changed the bundle ID, update in Xcode:
1. Select `Runner` project
2. General tab → Bundle Identifier
3. Update to match Firebase config

### **Step 5: Clean & Rebuild**
```bash
cd g:\tabibak-app\tabibak_ios
flutter clean
flutter pub get
flutter run
```

---

## ✅ **Update tabibak_webview (Android WebView)**

### **Step 1: Get New Firebase Config**
1. Go to: https://console.firebase.google.com/
2. Select project: **medconnect-2**
3. Project Settings → Your Apps → Android app (WebView)
4. Download `google-services.json`

### **Step 2: Replace Config File**
```bash
# Replace the old file with new one
cp ~/Downloads/google-services.json g:\tabibak-app\tabibak_webview\android\app\
```

### **Step 3: Verify Package Name**
Open `g:\tabibak-app\tabibak_webview\android\app\google-services.json` and check:
```json
"package_name": "com.abdullah.tabibak"
```

### **Step 4: Update SHA-1 Fingerprint**
Get SHA-1:
```bash
cd g:\tabibak-app\tabibak_webview\android
./gradlew signingReport
```

Update in Firebase Console:
1. Go to Firebase Console
2. Project Settings → Your Apps → Android (WebView)
3. Add fingerprint to `oauth_client` section

### **Step 5: Clean & Rebuild**
```bash
cd g:\tabibak-app\tabibak_webview
flutter clean
flutter pub get
flutter run
```

---

## 🔐 **Backend (Cloud Functions)**

### **Already Updated!**
Your Cloud Functions use `admin.initializeApp()` which automatically uses the service account from Google Cloud.

### **Just Deploy:**
```bash
firebase deploy --only functions
```

---

## 🌐 **Web App (Firebase Hosting)**

### **No Changes Needed!**
Your web app uses Firebase SDK which automatically connects to your Firebase project.

### **Just Deploy:**
```bash
firebase deploy --only hosting
```

---

## 📋 **Checklist - Update All Apps**

### **tabibak_native (Android Native)**
- [ ] Download new `google-services.json` from Firebase Console
- [ ] Replace file in `tabibak_native/android/app/`
- [ ] Verify package name: `com.abdullah.medbook`
- [ ] Update SHA-1 fingerprint in Firebase Console
- [ ] Run `flutter clean && flutter pub get && flutter run`
- [ ] Test that it builds and runs

### **tabibak_ios (iOS)**
- [ ] Download new `GoogleService-Info.plist` from Firebase Console
- [ ] Replace file in `tabibak_ios/`
- [ ] Update in Xcode (delete old, add new)
- [ ] Verify bundle ID matches Firebase config
- [ ] Run `flutter clean && flutter pub get && flutter run`
- [ ] Test that it builds and runs

### **tabibak_webview (Android WebView)**
- [ ] Download new `google-services.json` from Firebase Console
- [ ] Replace file in `tabibak_webview/android/app/`
- [ ] Verify package name: `com.abdullah.tabibak`
- [ ] Update SHA-1 fingerprint in Firebase Console
- [ ] Run `flutter clean && flutter pub get && flutter run`
- [ ] Test that it builds and runs

### **Backend (Cloud Functions)**
- [ ] Deploy functions: `firebase deploy --only functions`
- [ ] Verify functions are working

### **Web App (Firebase Hosting)**
- [ ] Deploy hosting: `firebase deploy --only hosting`
- [ ] Verify web app is working

---

## 🚀 **Deploy Everything**

Once all apps are updated and tested:

```bash
# Deploy everything at once
firebase deploy

# Or deploy specific services
firebase deploy --only functions,hosting
```

---

## ✅ **Verification**

After updating all apps, verify:

1. **tabibak_native** - Builds and runs on Android emulator/device
2. **tabibak_ios** - Builds and runs on iOS simulator/device
3. **tabibak_webview** - Builds and runs on Android emulator/device
4. **Cloud Functions** - All functions working
5. **Web App** - Loads at https://medconnect-2.web.app
6. **Firebase Console** - No errors or warnings

---

## 🔐 **Security Notes**

- ✅ Service account key is stored in `.env` (local only)
- ✅ `.env` is in `.gitignore` (never committed)
- ✅ All apps use Firebase SDK (secure by default)
- ✅ No hardcoded keys in source code
- ✅ Cloud Functions use automatic authentication

---

## 📞 **Troubleshooting**

### **Error: "google-services.json not found"**
- Make sure file is in correct location: `android/app/google-services.json`
- Run `flutter clean` and try again

### **Error: "SHA-1 fingerprint mismatch"**
- Get correct SHA-1: `./gradlew signingReport`
- Update in Firebase Console
- Make sure package name matches

### **Error: "GoogleService-Info.plist not found"**
- Make sure file is in `ios/` directory
- Add to Xcode project (drag and drop)
- Make sure it's in `Runner` target

### **Error: "Firebase initialization failed"**
- Check internet connection
- Verify Firebase project is active
- Check Firestore security rules
- Check Cloud Functions are deployed

---

## 🎯 **Summary**

| App | Status | Action |
|-----|--------|--------|
| tabibak_native | ⏳ TODO | Update google-services.json |
| tabibak_ios | ⏳ TODO | Update GoogleService-Info.plist |
| tabibak_webview | ⏳ TODO | Update google-services.json |
| Cloud Functions | ✅ Ready | Deploy with `firebase deploy` |
| Web App | ✅ Ready | Deploy with `firebase deploy` |

---

**All apps will use the same Firebase project: `medconnect-2`**

**Last Updated:** October 29, 2025  
**Status:** Ready to update all apps
