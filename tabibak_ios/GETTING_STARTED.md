# Getting Started with Tabibak iOS App

## 🎯 Your iOS App is Ready!

You now have a complete iOS app that wraps your web application using Flutter and WebView.

## 📋 Prerequisites

Before you start, make sure you have:

- [ ] **Mac computer** (required for iOS development)
- [ ] **Xcode** installed (from App Store)
- [ ] **Flutter SDK** installed
- [ ] **CocoaPods** installed

### Check Your Setup

```bash
flutter doctor
```

You should see ✓ for:
- Flutter
- Xcode
- CocoaPods

## 🚀 Quick Start (5 Minutes)

### Step 1: Navigate to Project
```bash
cd tabibak_ios
```

### Step 2: Install Dependencies
```bash
flutter pub get
```

### Step 3: Run on Simulator
```bash
flutter run
```

When prompted, choose an iOS simulator (e.g., iPhone 15)

### Step 4: Test the App
1. Splash screen appears
2. App loads your web app
3. Try clicking buttons
4. Test back navigation

**That's it!** Your app is running! 🎉

## 📱 Run on Real Device

### Connect Your iPhone
1. Plug iPhone into Mac
2. Trust the computer on your iPhone
3. Run:
```bash
flutter devices
flutter run -d "Your iPhone"
```

## 🏗️ Build for Release

### Create Release Build
```bash
flutter build ipa --release
```

This creates: `build/ios/ipa/tabibak_ios.ipa`

### Upload to App Store
1. Open Xcode Organizer
2. Select your build
3. Click "Distribute App"
4. Follow the wizard

## 📚 Documentation

Read these in order:

1. **QUICK_START.md** - Quick reference
2. **IOS_SETUP_GUIDE.md** - Detailed setup
3. **SETUP_CHECKLIST.md** - Complete checklist
4. **PROJECT_SUMMARY.md** - Project overview

## 🎨 Customization

### Change App Icon
1. Prepare 1024x1024 PNG
2. Open `ios/Runner/Assets.xcassets`
3. Drag icon to AppIcon
4. Done!

### Change Web URL
Edit `lib/main.dart` line 64:
```dart
url: 'https://your-url.com',
```

### Change App Name
Edit `ios/Runner/Info.plist`:
```xml
<key>CFBundleDisplayName</key>
<string>Your App Name</string>
```

## 🔧 Common Commands

```bash
# Run on simulator
flutter run

# Run on device
flutter run -d "device-name"

# List devices
flutter devices

# Build for release
flutter build ipa --release

# Clean everything
flutter clean

# Get dependencies
flutter pub get

# Check setup
flutter doctor

# View logs
flutter logs
```

## ⚠️ Troubleshooting

### App Won't Run
```bash
flutter clean
flutter pub get
flutter run
```

### WebView Shows Blank
- Check internet connection
- Try hard refresh (Cmd+Shift+R)
- Check URL is correct

### Build Fails
```bash
cd ios
pod install --repo-update
cd ..
flutter run
```

### Permission Issues
- Settings > Tabibak > Enable permissions

## 📊 Project Structure

```
tabibak_ios/
├── lib/
│   ├── main.dart              ← App entry point
│   └── screens/
│       └── webview_screen.dart ← WebView wrapper
├── ios/
│   ├── Runner/
│   │   ├── Info.plist         ← Permissions
│   │   └── Assets.xcassets    ← App icon
│   └── Podfile                ← Dependencies
├── pubspec.yaml               ← Packages
└── docs/
    ├── README.md
    ├── QUICK_START.md
    ├── IOS_SETUP_GUIDE.md
    ├── SETUP_CHECKLIST.md
    └── PROJECT_SUMMARY.md
```

## ✨ Features

✅ WebView loads your web app
✅ Camera access
✅ Microphone support
✅ Photo library access
✅ Location services
✅ Back navigation
✅ Refresh button
✅ Error handling
✅ Loading indicators
✅ Splash screen

## 🎯 Next Steps

1. ✅ Run on simulator
2. ✅ Test on device
3. ✅ Add app icon
4. ✅ Configure signing
5. ✅ Submit to App Store

## 📞 Need Help?

- **Flutter Docs**: https://flutter.dev
- **WebView**: https://pub.dev/packages/webview_flutter
- **iOS**: https://developer.apple.com/ios

## 🔐 Important

⚠️ **Android Project Untouched** - Your Android app in `tabibak_native/` is unchanged
✅ **Separate Projects** - iOS and Android are independent
✅ **No Interference** - Changes to one don't affect the other

## 📝 Version Info

- Flutter: 3.9.2+
- iOS: 12.0+
- Dart: 3.9.2+
- webview_flutter: 4.4.2

---

**Ready to start?** Run `flutter run` now! 🚀

For detailed setup, see `IOS_SETUP_GUIDE.md`
