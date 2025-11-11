# Tabibok React Native App

A comprehensive medical appointment management system built with React Native and Expo, featuring role-based authentication and navigation for Patients, Doctors, and Receptionists.

## 🎯 Project Overview

This React Native application is part of the Tabibok medical management platform, connecting to the existing Firebase backend (`medconnect-2`) with full support for:

- **Patient Portal**: Phone OTP authentication, doctor browsing, appointment booking
- **Doctor Portal**: Email/password authentication, appointment management, EMR system
- **Receptionist Portal**: Email/password authentication, appointment confirmation, patient registration

## 🏗️ Architecture

### Core Structure

```
tabibak_react_native/
├── src/
│   ├── config/
│   │   ├── firebase.js          # Firebase configuration
│   │   └── theme.js              # Theme colors, spacing, fonts
│   ├── contexts/
│   │   └── AuthContext.js        # Authentication state management
│   ├── services/
│   │   └── authService.js        # Firebase auth operations
│   ├── navigation/
│   │   ├── AppNavigator.js       # Root navigation
│   │   ├── PatientStack.js       # Patient screens navigation
│   │   ├── DoctorStack.js        # Doctor screens navigation
│   │   └── ReceptionistStack.js  # Receptionist screens navigation
│   ├── screens/
│   │   ├── auth/                 # Authentication screens
│   │   ├── patient/              # Patient portal screens
│   │   ├── doctor/               # Doctor portal screens
│   │   └── receptionist/         # Receptionist portal screens
│   └── components/
│       └── PlaceholderScreen.js  # Reusable placeholder component
├── App.js                        # App entry point
├── app.json                      # Expo configuration
├── google-services.json          # Android Firebase config
└── GoogleService-Info.plist      # iOS Firebase config
```

## 🔐 Authentication Flow

### Patient Authentication (Phone OTP)
1. User selects "Patient" role
2. Enters phone number
3. Receives OTP via SMS
4. Verifies OTP
5. If new user → Complete profile setup
6. Redirects to Patient Stack

### Doctor/Receptionist Authentication (Email/Password)
1. User selects "Doctor" or "Receptionist" role
2. Enters email and password
3. System verifies credentials and role
4. Redirects to appropriate stack (Doctor or Receptionist)

### Session Persistence
- Auth state managed by `AuthContext` using React Context API
- User data cached in `AsyncStorage` for offline persistence
- Automatic role-check on app restart
- Redirects to appropriate stack based on user role

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android) or Xcode (for iOS)

### Installation

```bash
cd g:\tabibak-app\tabibak_react_native
npm install
```

### Running the App

#### Development Mode (Expo Go)
```bash
npm start
# or
npx expo start
```

Then scan the QR code with:
- **iOS**: Camera app
- **Android**: Expo Go app

#### Android
```bash
npm run android
# or
npx expo run:android
```

#### iOS (macOS only)
```bash
npm run ios
# or
npx expo run:ios
```

#### Web
```bash
npm run web
# or
npx expo start --web
```

## 📱 Features Implemented

### ✅ Phase 1: Core Infrastructure
- [x] Firebase integration (Auth, Firestore)
- [x] Role-based authentication (Phone OTP, Email/Password)
- [x] Session persistence with AsyncStorage
- [x] Role-check and automatic redirection
- [x] Modular navigation structure (3 isolated stacks)
- [x] Theme configuration (colors, spacing, fonts)

### ✅ Phase 2: Authentication Screens
- [x] Role selection screen
- [x] Phone authentication screen
- [x] OTP verification screen
- [x] Email/password login screen
- [x] Profile setup screen

### ✅ Phase 3: Navigation Stacks
- [x] Patient Stack with bottom tabs (Home, Appointments, Documents, Profile)
- [x] Doctor Stack with bottom tabs (Dashboard, Appointments, Profile)
- [x] Receptionist Stack with bottom tabs (Dashboard, Appointments, Notifications, Profile)

### 🚧 Phase 4: Screen Implementation (Placeholders Created)
- [ ] Patient screens (Doctor list, booking, appointments, etc.)
- [ ] Doctor screens (Dashboard, EMR, prescriptions, etc.)
- [ ] Receptionist screens (Appointment management, notifications, etc.)

## 🎨 Design System

### Colors
- **Primary**: `#10b981` (Green) - Medical theme
- **Secondary**: `#3b82f6` (Blue)
- **Background**: `#ffffff`, `#f9fafb`
- **Text**: `#1f2937`, `#6b7280`
- **Error**: `#ef4444`
- **Success**: `#10b981`

### Typography
- Font sizes: xs (12), sm (14), md (16), lg (18), xl (24), xxl (32)
- Default font: System font

### Spacing
- xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48

## 🔥 Firebase Configuration

The app connects to the existing Firebase project:
- **Project ID**: `medconnect-2`
- **Collections**: `users`, `patients`, `doctors`, `receptionists`, `appointments`, `medicalDocuments`

### Firebase Services Used
- **Authentication**: Phone OTP, Email/Password
- **Firestore**: User profiles, appointments, medical records
- **Storage**: (Future) Medical documents, images

## 📦 Dependencies

### Core
- `react-native` - Core React Native framework
- `expo` - Expo framework for easy development
- `firebase` - Firebase JS SDK

### Navigation
- `@react-navigation/native` - Navigation library
- `@react-navigation/native-stack` - Stack navigator
- `@react-navigation/bottom-tabs` - Bottom tab navigator
- `react-native-screens` - Native screen management
- `react-native-safe-area-context` - Safe area handling

### UI
- `@expo/vector-icons` - Icon library

### Storage
- `@react-native-async-storage/async-storage` - Local storage

### Authentication
- `expo-auth-session` - OAuth and auth utilities
- `expo-crypto` - Cryptography utilities
- `expo-web-browser` - Web browser integration

## 🛠️ Development Guidelines

### Adding New Screens
1. Create screen component in appropriate directory (`patient/`, `doctor/`, `receptionist/`)
2. Import and add to navigation stack
3. Follow existing pattern for styling and structure

### State Management
- Use `useAuth()` hook to access authentication state
- User profile data available via `userProfile`
- Role information via `userRole`

### Styling
- Use theme constants from `src/config/theme.js`
- Follow consistent spacing and sizing
- Use StyleSheet.create() for performance

## 🔧 Troubleshooting

### Firebase Auth Issues
- Ensure `google-services.json` and `GoogleService-Info.plist` are present
- Verify Firebase project has Phone Authentication enabled
- Check Firebase console for auth errors

### Navigation Issues
- Clear Metro bundler cache: `npx expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### Build Issues
- For Android: Check `android/` folder exists after first build
- For iOS: Run `npx pod-install` if needed

## 📝 Next Steps

### Immediate (Phase 4)
1. Implement Patient screens:
   - Doctor list with real Firestore data
   - Doctor profile details
   - Appointment booking form
   - My appointments list
   - Medical documents viewer

2. Implement Doctor screens:
   - Dashboard with statistics
   - Appointment list and management
   - Patient details and history
   - EMR system
   - Prescription creation

3. Implement Receptionist screens:
   - Dashboard
   - Appointment confirmation
   - Patient registration
   - Real-time notifications

### Future Enhancements
- Push notifications (Firebase Cloud Messaging)
- Offline mode support
- Medical document upload
- Video consultation integration
- Multi-language support (Arabic/English)
- Dark mode theme

## 📄 License

This project is part of the Tabibok medical platform.

## 👥 Team

- Backend: Firebase (medconnect-2)
- Mobile: React Native + Expo
- Platform: iOS, Android, Web

---

**Status**: Core infrastructure complete ✅  
**Next Priority**: Implement screen functionality with Firestore integration
