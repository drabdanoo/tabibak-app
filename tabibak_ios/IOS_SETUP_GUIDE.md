# Tabibak iOS App - Setup & Build Guide

## Project Overview
- **App Name**: طبيبك (Tabibak)
- **Package**: com.abdullah.tabibak
- **Web URL**: https://medconnect-2.web.app
- **Framework**: Flutter + WebView
- **Platform**: iOS 12.0+

## Prerequisites
1. **Mac with Xcode** (required for iOS development)
2. **Flutter SDK** (latest version)
3. **CocoaPods** (for iOS dependencies)
4. **Apple Developer Account** (for App Store deployment)

## Setup Steps

### 1. Install Dependencies
```bash
cd tabibak_ios
flutter pub get
```

### 2. iOS-Specific Configuration

#### A. Update Info.plist
Navigate to `ios/Runner/Info.plist` and add these permissions:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is needed for video consultations</string>

<key>NSMicrophoneUsageDescription</key>
<string>Microphone access is needed for audio calls</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Photo library access is needed to upload medical documents</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Location is needed to find nearby clinics</string>

<key>NSLocalNetworkUsageDescription</key>
<string>Local network access for better connectivity</string>

<key>NSBonjourServices</key>
<array>
  <string>_http._tcp</string>
  <string>_https._tcp</string>
</array>
```

#### B. Update Podfile
Edit `ios/Podfile` and ensure minimum iOS version is set:

```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    flutter_additional_ios_build_settings(target)
    target.build_configurations.each do |config|
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= [
        '$(inherited)',
        'PERMISSION_CAMERA=1',
        'PERMISSION_MICROPHONE=1',
        'PERMISSION_PHOTOS=1',
        'PERMISSION_LOCATION=1',
      ]
    end
  end
end
```

### 3. Build Configuration

#### A. Update Build Settings
In Xcode:
1. Open `ios/Runner.xcworkspace` (NOT .xcodeproj)
2. Select Runner project
3. Go to Build Settings
4. Set Minimum Deployment Target to 12.0

#### B. Configure App Icon
1. Prepare app icon (1024x1024 PNG)
2. Use Xcode's Asset Catalog:
   - Open `ios/Runner/Assets.xcassets`
   - Drag icon to AppIcon set
   - Xcode auto-generates all sizes

#### C. Configure Launch Screen
1. Open `ios/Runner/Base.lproj/LaunchScreen.storyboard`
2. Customize with app branding (optional)

### 4. Build for Development

```bash
# Clean build
flutter clean

# Get dependencies
flutter pub get

# Build for iOS simulator
flutter run -d "iPhone 15"

# Or build for specific device
flutter run -d "your-device-name"
```

### 5. Build for Release

#### A. Create Release Build
```bash
# Build IPA for App Store
flutter build ipa --release

# Or build for Ad Hoc distribution
flutter build ipa --release --export-method=ad-hoc
```

#### B. Upload to App Store
1. Open `build/ios/ipa/tabibak_ios.ipa`
2. Use Xcode Organizer or Transporter app
3. Follow App Store Connect submission process

### 6. Firebase Configuration (Optional)

If you want to add Firebase:

1. Download `GoogleService-Info.plist` from Firebase Console
2. Add to Xcode:
   - Right-click `ios/Runner` folder
   - Select "Add Files to Runner"
   - Select `GoogleService-Info.plist`
   - Check "Copy items if needed"

3. Update `pubspec.yaml` with Firebase packages (already included)

### 7. Troubleshooting

#### WebView Not Loading
- Check internet connectivity
- Verify URL is correct: `https://medconnect-2.web.app`
- Clear app cache: Settings > General > iPhone Storage > Tabibak > Offload App

#### Permission Denied Errors
- Go to Settings > Tabibak
- Enable Camera, Microphone, Photos, Location permissions

#### Build Fails
```bash
# Clean everything
flutter clean
rm -rf ios/Pods
rm ios/Podfile.lock

# Rebuild
flutter pub get
flutter run
```

#### Pod Install Issues
```bash
cd ios
pod repo update
pod install --repo-update
cd ..
flutter run
```

## Features Implemented

✅ WebView loading web app
✅ Camera permission handling
✅ Microphone permission handling
✅ Photo library access
✅ Location services
✅ Back navigation
✅ Pull-to-refresh
✅ Loading indicators
✅ Error handling
✅ Splash screen with branding

## File Structure

```
tabibak_ios/
├── lib/
│   ├── main.dart                 # App entry point with splash screen
│   └── screens/
│       └── webview_screen.dart   # WebView implementation
├── ios/
│   ├── Runner/
│   │   ├── Info.plist           # Permissions & app config
│   │   ├── Assets.xcassets      # App icons & images
│   │   └── LaunchScreen.storyboard
│   ├── Podfile                  # iOS dependencies
│   └── Runner.xcworkspace       # Xcode workspace
├── pubspec.yaml                 # Flutter dependencies
└── README.md
```

## Next Steps

1. **Test on Device**: Run on actual iPhone to test all features
2. **Configure App Icon**: Add your custom app icon
3. **Set Up Signing**: Configure Apple Developer signing certificates
4. **Submit to App Store**: Follow Apple's review guidelines
5. **Monitor Analytics**: Track app usage and crashes

## Support

For issues or questions:
- Check Flutter documentation: https://flutter.dev
- WebView plugin docs: https://pub.dev/packages/webview_flutter
- Permission handler docs: https://pub.dev/packages/permission_handler

## Version Info

- Flutter: 3.9.2+
- iOS: 12.0+
- Dart: 3.9.2+
- webview_flutter: 4.4.2
- permission_handler: 12.0.1
