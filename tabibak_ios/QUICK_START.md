# Tabibak iOS App - Quick Start

## 5-Minute Setup

### Step 1: Install Flutter Dependencies
```bash
cd tabibak_ios
flutter pub get
```

### Step 2: Run on Simulator
```bash
flutter run
```

Choose your simulator when prompted:
- iPhone 15
- iPhone 15 Pro
- iPad Pro
- etc.

### Step 3: Test the App
1. Splash screen appears (2 seconds)
2. App loads web version at https://medconnect-2.web.app
3. All features work through WebView

## Building for Device

### Connect Your iPhone
1. Plug iPhone into Mac
2. Trust the computer on your iPhone
3. Run:
```bash
flutter devices  # See your device listed
flutter run -d "Your iPhone"
```

## Building for App Store

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

## Project Structure

```
tabibak_ios/
├── lib/
│   ├── main.dart              # Splash screen + app setup
│   └── screens/
│       └── webview_screen.dart # WebView wrapper
├── ios/
│   ├── Runner/
│   │   └── Info.plist         # Add permissions here
│   └── Podfile                # iOS dependencies
└── pubspec.yaml               # Flutter packages
```

## Key Features

✅ **WebView Loading**: Loads https://medconnect-2.web.app
✅ **Permissions**: Camera, Microphone, Photos, Location
✅ **Navigation**: Back button, refresh button
✅ **Splash Screen**: Custom branding
✅ **Error Handling**: Shows errors gracefully

## Customization

### Change App Name
Edit `ios/Runner/Info.plist`:
```xml
<key>CFBundleDisplayName</key>
<string>طبيبك</string>
```

### Change App Icon
1. Prepare 1024x1024 PNG icon
2. Open `ios/Runner/Assets.xcassets`
3. Drag icon to AppIcon
4. Xcode auto-generates all sizes

### Change Splash Screen
Edit `lib/main.dart` in `SplashScreen` widget

### Change Web URL
Edit `lib/main.dart` line 64:
```dart
url: 'https://your-url.com',
```

## Common Issues

### "Pod install" fails
```bash
cd ios
pod repo update
pod install --repo-update
cd ..
```

### WebView shows blank page
- Check internet connection
- Verify URL is correct
- Try: `flutter clean && flutter run`

### Permission errors
- Go to iPhone Settings > Tabibak
- Enable all permissions

### Build fails
```bash
flutter clean
flutter pub get
flutter run
```

## Next Steps

1. ✅ Test on simulator
2. ✅ Test on real device
3. ✅ Add app icon
4. ✅ Configure signing
5. ✅ Submit to App Store

## Useful Commands

```bash
# List available devices
flutter devices

# Run on specific device
flutter run -d "device-id"

# Build release
flutter build ipa --release

# Clean everything
flutter clean

# Get latest dependencies
flutter pub get

# Update dependencies
flutter pub upgrade

# Check Flutter setup
flutter doctor
```

## Documentation

- **Flutter**: https://flutter.dev
- **WebView**: https://pub.dev/packages/webview_flutter
- **Permissions**: https://pub.dev/packages/permission_handler
- **iOS**: https://developer.apple.com/ios

## Support

For detailed setup, see: `IOS_SETUP_GUIDE.md`
