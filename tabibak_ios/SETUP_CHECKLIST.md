# Tabibak iOS App - Setup Checklist

## Pre-Setup Requirements

- [ ] Mac computer (required for iOS development)
- [ ] Xcode installed (from App Store)
- [ ] Flutter SDK installed
- [ ] CocoaPods installed (`sudo gem install cocoapods`)
- [ ] Apple Developer Account (for App Store)

## Initial Setup (5-10 minutes)

### 1. Install Dependencies
- [ ] Navigate to `tabibak_ios` folder
- [ ] Run `flutter pub get`
- [ ] Wait for dependencies to download

### 2. Verify Flutter Setup
```bash
flutter doctor
```
- [ ] Flutter version shows ✓
- [ ] Xcode shows ✓
- [ ] CocoaPods shows ✓
- [ ] iOS deployment target is 12.0+

### 3. Test on Simulator
- [ ] Run `flutter run`
- [ ] Choose iOS simulator (e.g., iPhone 15)
- [ ] App launches and shows splash screen
- [ ] Web app loads at https://medconnect-2.web.app
- [ ] All buttons work (back, refresh)

## iOS Configuration (10-15 minutes)

### 4. Update Info.plist
- [ ] Open `ios/Runner/Info.plist`
- [ ] Add Camera permission description
- [ ] Add Microphone permission description
- [ ] Add Photo Library permission description
- [ ] Add Location permission description

### 5. Configure Podfile
- [ ] Open `ios/Podfile`
- [ ] Set minimum iOS version to 12.0
- [ ] Run `cd ios && pod install --repo-update && cd ..`

### 6. Test Permissions
- [ ] Run app on simulator
- [ ] Grant camera permission
- [ ] Grant microphone permission
- [ ] Grant photo library permission
- [ ] Grant location permission
- [ ] Verify all permissions work

## App Customization (5-10 minutes)

### 7. Add App Icon
- [ ] Prepare 1024x1024 PNG icon
- [ ] Open `ios/Runner/Assets.xcassets`
- [ ] Drag icon to AppIcon set
- [ ] Verify all sizes generated
- [ ] Run app to see new icon

### 8. Customize Splash Screen
- [ ] Edit `lib/main.dart` SplashScreen widget
- [ ] Change colors if desired
- [ ] Change text if desired
- [ ] Test on simulator

### 9. Update App Name (Optional)
- [ ] Edit `ios/Runner/Info.plist`
- [ ] Change `CFBundleDisplayName` to desired name
- [ ] Run `flutter run` to verify

## Device Testing (10-15 minutes)

### 10. Connect iPhone
- [ ] Plug iPhone into Mac
- [ ] Trust the computer on iPhone
- [ ] Run `flutter devices` to verify connection
- [ ] Run `flutter run -d "Your iPhone"`

### 11. Test on Device
- [ ] App installs successfully
- [ ] Splash screen appears
- [ ] Web app loads
- [ ] All features work
- [ ] Permissions work correctly
- [ ] Back button works
- [ ] Refresh button works

### 12. Test Features
- [ ] Open camera (if available)
- [ ] Access photo library
- [ ] Enable location services
- [ ] Test all web app features
- [ ] Test offline behavior

## Release Build (5-10 minutes)

### 13. Create Release Build
- [ ] Run `flutter clean`
- [ ] Run `flutter pub get`
- [ ] Run `flutter build ipa --release`
- [ ] Wait for build to complete
- [ ] Verify `build/ios/ipa/tabibak_ios.ipa` exists

### 14. Test Release Build
- [ ] Install IPA on test device
- [ ] Verify all features work
- [ ] Check app performance
- [ ] Verify no debug messages

## App Store Preparation (15-30 minutes)

### 15. Create App Store Account
- [ ] Go to App Store Connect
- [ ] Create new app
- [ ] Fill in app information
- [ ] Set pricing and availability
- [ ] Add app description and screenshots

### 16. Configure Signing
- [ ] Open Xcode workspace: `ios/Runner.xcworkspace`
- [ ] Select Runner project
- [ ] Go to Signing & Capabilities
- [ ] Select team
- [ ] Verify bundle ID matches
- [ ] Verify provisioning profile

### 17. Add App Screenshots
- [ ] Take 5-6 screenshots of app
- [ ] Resize to required dimensions
- [ ] Add to App Store Connect
- [ ] Write screenshot descriptions

### 18. Add App Description
- [ ] Write app name (Arabic + English)
- [ ] Write subtitle
- [ ] Write description (features, benefits)
- [ ] Add keywords for search
- [ ] Add support URL
- [ ] Add privacy policy URL

## App Store Submission (10-15 minutes)

### 19. Upload Build
- [ ] Open Xcode Organizer
- [ ] Select your release build
- [ ] Click "Distribute App"
- [ ] Select "App Store Connect"
- [ ] Follow upload wizard
- [ ] Wait for upload to complete

### 20. Submit for Review
- [ ] Go to App Store Connect
- [ ] Fill in review information
- [ ] Select content rating
- [ ] Verify all information
- [ ] Click "Submit for Review"
- [ ] Wait for Apple review (1-3 days)

## Post-Launch (Ongoing)

### 21. Monitor App
- [ ] Check App Store reviews
- [ ] Monitor crash reports
- [ ] Check user ratings
- [ ] Respond to user feedback

### 22. Plan Updates
- [ ] Plan new features
- [ ] Fix reported bugs
- [ ] Improve performance
- [ ] Update web app as needed

### 23. Maintenance
- [ ] Keep Flutter updated
- [ ] Keep dependencies updated
- [ ] Monitor iOS updates
- [ ] Test on new iOS versions

## Troubleshooting Checklist

### If Build Fails
- [ ] Run `flutter clean`
- [ ] Run `flutter pub get`
- [ ] Run `cd ios && pod install --repo-update && cd ..`
- [ ] Run `flutter run` again

### If WebView Shows Blank
- [ ] Check internet connection
- [ ] Verify URL is correct
- [ ] Clear app cache
- [ ] Try hard refresh (Ctrl+Shift+R)

### If Permissions Don't Work
- [ ] Check Info.plist has all permissions
- [ ] Check iOS device settings
- [ ] Grant permissions in Settings app
- [ ] Restart app

### If App Crashes
- [ ] Check Xcode console for errors
- [ ] Check Flutter logs: `flutter logs`
- [ ] Try `flutter clean && flutter run`
- [ ] Check Firebase configuration

## Quick Reference Commands

```bash
# Navigate to project
cd tabibak_ios

# Install dependencies
flutter pub get

# Run on simulator
flutter run

# Run on device
flutter run -d "device-name"

# Build for release
flutter build ipa --release

# Clean everything
flutter clean

# Check setup
flutter doctor

# View logs
flutter logs

# List devices
flutter devices
```

## Important Files

| File | Purpose |
|------|---------|
| `lib/main.dart` | App entry point & splash screen |
| `lib/screens/webview_screen.dart` | WebView implementation |
| `ios/Runner/Info.plist` | Permissions & app config |
| `ios/Podfile` | iOS dependencies |
| `pubspec.yaml` | Flutter packages |

## Support Resources

- **Flutter Docs**: https://flutter.dev
- **WebView Plugin**: https://pub.dev/packages/webview_flutter
- **iOS Development**: https://developer.apple.com/ios
- **App Store Connect**: https://appstoreconnect.apple.com
- **Xcode Help**: https://help.apple.com/xcode

## Estimated Timeline

- **Initial Setup**: 5-10 minutes
- **iOS Configuration**: 10-15 minutes
- **Customization**: 5-10 minutes
- **Device Testing**: 10-15 minutes
- **Release Build**: 5-10 minutes
- **App Store Prep**: 15-30 minutes
- **Submission**: 10-15 minutes

**Total**: ~1-2 hours for complete setup and submission

## Next Steps

1. ✅ Complete all checklist items
2. ✅ Test thoroughly on device
3. ✅ Prepare App Store listing
4. ✅ Submit for review
5. ✅ Monitor reviews and ratings
6. ✅ Plan future updates

---

**Last Updated**: October 2025
**Version**: 1.0.0
