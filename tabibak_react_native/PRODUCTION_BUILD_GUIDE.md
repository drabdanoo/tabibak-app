# Production Build Guide - Tabibok Health

This guide walks through building and submitting the Tabibok Health app to app stores using EAS (Expo Application Services).

## Prerequisites

1. **EAS Account**: Create account at https://expo.dev
2. **EAS CLI**: Install with `npm install -g eas-cli`
3. **Login**: `eas login` (use your Expo credentials)
4. **Native Build Tools**:
   - **iOS**: Xcode + Apple Developer Account
   - **Android**: Android Studio + Google Play Developer Account

## Configuration

### eas.json

The project includes a pre-configured `eas.json` with three build profiles:

```json
{
  "build": {
    "development": {},
    "preview": {
      "ios": { "buildConfiguration": "Release" },
      "android": { "buildType": "apk" }
    },
    "production": {
      "ios": { "buildConfiguration": "Release" },
      "android": { "buildType": "aab" }
    }
  }
}
```

### app.json

Ensure `app.json` has the correct production values:

```json
{
  "expo": {
    "name": "Tabibok Health",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.tabibok.health",
      "buildNumber": "1"
    },
    "android": {
      "package": "com.tabibok.health",
      "versionCode": 1
    }
  }
}
```

## Building for Production

### Step 1: Clean Prebuild (First Time Only)

If this is the first native build or if you've added new native modules:

```bash
npx expo prebuild --clean
```

This creates `ios/` and `android/` directories with native code.

### Step 2: Build for Android (AAB for Play Store)

```bash
eas build -p android --profile production
```

**What happens:**
- Creates Android App Bundle (AAB) format for Google Play
- Takes 5-10 minutes
- Generates a production-ready binary

**Output**: Download the `.aab` file from EAS dashboard

### Step 3: Build for iOS (Archive for App Store)

```bash
eas build -p ios --profile production
```

**What happens:**
- Creates iOS archive (.ipa) for App Store
- Takes 10-15 minutes
- Requires Apple Developer account

**Output**: Download the `.ipa` file or submit directly from EAS

## Submitting to App Stores

### Google Play Store (Android)

1. Open [Google Play Console](https://play.console.google.com)
2. Create new app or select existing "Tabibok Health"
3. Navigate to **Release > Production**
4. Upload the `.aab` file
5. Add screenshots, description, and store listing
6. Submit for review (typically 3-4 hours)

**Requirements:**
- App icon (512x512 PNG)
- Screenshots (min 2, max 8)
- Feature graphic (1024x500)
- Privacy policy URL
- Target API level: 34+

### Apple App Store (iOS)

1. Open [App Store Connect](https://appstoreconnect.apple.com)
2. Create new app or select existing "Tabibok Health"
3. Navigate to **Build** section
4. Upload `.ipa` via Xcode or TestFlight
5. Add screenshots and metadata
6. Submit for review (typically 24-48 hours)

**Requirements:**
- App icon (1024x1024 PNG)
- Screenshots (min 2, max 5 per device type)
- Privacy policy URL
- Category and keywords
- Version release notes

## Versioning for Updates

For subsequent updates, increment version numbers:

```json
// app.json
{
  "expo": {
    "version": "1.0.1",
    "ios": { "buildNumber": "2" },
    "android": { "versionCode": 2 }
  }
}
```

Then rebuild:

```bash
eas build -p android --profile production  # versionCode: 2
eas build -p ios --profile production       # buildNumber: 2
```

## Environment Variables & Secrets

Store sensitive data securely:

```bash
# Push secret to EAS
eas secret:push --scope PROJECT_ID --name API_KEY --value "your-secret-value"
```

Access in app:

```javascript
// Not recommended for production - use Firebase config instead
const apiKey = process.env.API_KEY;
```

## Testing Before Submission

### Preview Builds (Internal Testing)

```bash
# Android APK (for manual testing on devices)
eas build -p android --profile preview

# iOS preview
eas build -p ios --profile preview
```

### Shared Links

EAS provides shareable links for testers:
1. Build completes on EAS
2. Copy "QR code" or link
3. Share with testers
4. Testers scan or open link to install

## Troubleshooting

### Build Failures

**Error: "Provisioning profile not found"**
- Ensure Apple Developer account is connected
- Check team ID in app.json

**Error: "Firebase configuration missing"**
- Verify `GoogleService-Info.plist` (iOS) and `google-services.json` (Android) exist
- Ensure correct Firebase project is configured

**Error: "Native module compatibility"**
- Run `npx expo prebuild --clean` if native deps changed
- Check package.json for incompatible native modules

### Performance

- Profile app startup: `eas analytics`
- Monitor app size: Check EAS build details
- Optimize bundle: `expo-optimize`

## Rollback Procedure

If an update causes issues:

1. **Revert app.json** to previous version numbers
2. **Rebuild** with EAS:
   ```bash
   eas build -p android --profile production  # Lower version code
   eas build -p ios --profile production       # Lower build number
   ```
3. **Submit to app stores** as hotfix
4. **Communicate with users** about critical fix

## Monitoring Post-Launch

After submission:

1. **Google Play Console**: Monitor crash rates, ratings, reviews
2. **App Store Connect**: Check analytics and crash logs
3. **Firebase Console**: Monitor app errors and performance
4. **Sentry** (optional): Add for advanced error tracking

## Useful Commands

```bash
# View build status
eas build:list

# Cancel ongoing build
eas build:cancel [BUILD_ID]

# View EAS config
eas config

# Generate credentials
eas credentials

# Simulate native build locally (advanced)
npm run android:prod
npm run ios:prod
```

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policies](https://play.google.com/about/developer-content-policy/)
- [Firebase Deployment](https://firebase.google.com/docs/app-check/setup-js)

---

**Last Updated**: November 12, 2025
**App Name**: Tabibok Health
**Status**: Ready for Production
