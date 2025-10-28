# Tabibak iOS App

**طبيبك - Medical Appointment Management System for iOS**

A Flutter-based iOS app that wraps the Tabibak web application using WebView technology. This allows the web app to run natively on iOS devices with full access to device features like camera, microphone, and location.

## Features

✅ **WebView Integration**: Seamless web app integration
✅ **Camera Access**: For video consultations
✅ **Microphone Support**: For audio calls
✅ **Photo Library**: Upload medical documents
✅ **Location Services**: Find nearby clinics
✅ **Offline Support**: Works with cached content
✅ **Push Notifications**: Firebase messaging ready
✅ **Responsive Design**: Adapts to all iPhone sizes

## Quick Start

### Prerequisites
- Mac with Xcode
- Flutter SDK (3.9.2+)
- CocoaPods

### Installation
```bash
cd tabibak_ios
flutter pub get
flutter run
```

### Build for Release
```bash
flutter build ipa --release
```

## Project Structure

```
tabibak_ios/
├── lib/
│   ├── main.dart                 # App entry & splash screen
│   └── screens/
│       └── webview_screen.dart   # WebView implementation
├── ios/
│   ├── Runner/
│   │   ├── Info.plist           # Permissions & config
│   │   └── Assets.xcassets      # Icons & images
│   └── Podfile                  # Dependencies
├── pubspec.yaml                 # Flutter packages
├── IOS_SETUP_GUIDE.md          # Detailed setup
└── QUICK_START.md              # Quick reference
```

## Configuration

### Web URL
Edit `lib/main.dart` line 64 to change the web app URL:
```dart
url: 'https://medconnect-2.web.app',
```

### App Icon
1. Prepare 1024x1024 PNG
2. Open `ios/Runner/Assets.xcassets`
3. Drag to AppIcon set

### Permissions
Edit `ios/Runner/Info.plist` to customize permission messages

## Deployment

### To App Store
1. Build release: `flutter build ipa --release`
2. Open Xcode Organizer
3. Select build and distribute
4. Follow App Store Connect wizard

### To TestFlight
1. Build: `flutter build ipa --release`
2. Upload via Xcode or Transporter
3. Invite testers in App Store Connect

## Troubleshooting

### WebView Not Loading
```bash
flutter clean
flutter pub get
flutter run
```

### Permission Denied
- Settings > Tabibak > Enable permissions

### Build Issues
```bash
cd ios
pod install --repo-update
cd ..
flutter run
```

## Documentation

- **Setup Guide**: See `IOS_SETUP_GUIDE.md`
- **Quick Start**: See `QUICK_START.md`
- **Flutter Docs**: https://flutter.dev
- **WebView Plugin**: https://pub.dev/packages/webview_flutter

## Technologies

- **Framework**: Flutter 3.9.2+
- **Language**: Dart
- **iOS Support**: 12.0+
- **WebView**: webview_flutter 4.4.2
- **Permissions**: permission_handler 12.0.1

## Project Info

- **App Name**: طبيبك (Tabibak)
- **Package**: com.abdullah.tabibak
- **Web App**: https://medconnect-2.web.app
- **Version**: 1.0.0

## Support

For issues or questions, refer to:
- Flutter documentation: https://flutter.dev
- WebView documentation: https://pub.dev/packages/webview_flutter
- iOS development: https://developer.apple.com/ios

---

**Note**: This is a separate iOS project. The Android version is in `tabibak_native/` folder.
