# 🚀 Tabibak Native Flutter App - Complete Setup Guide

## 📋 Project Overview

We're building a **full native Flutter app** with 3 portals:
1. **Patient App** - Browse doctors, book appointments, view documents
2. **Doctor App** - Manage appointments, EMR, prescriptions
3. **Receptionist App** - Confirm bookings, manage schedule

---

## 🔧 Step 1: Create Flutter Project

Open a **NEW PowerShell window** and run:

```powershell
cd g:\tabibak-app
flutter create --org com.abdullah tabibak_native
cd tabibak_native
```

---

## 🔥 Step 2: Add Firebase Configuration

### **2.1: Download google-services.json**

Save your Firebase config as `google-services.json`:

```json
{
  "project_info": {
    "project_number": "464755135042",
    "project_id": "medconnect-2",
    "storage_bucket": "medconnect-2.firebasestorage.app"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:464755135042:android:02d0efac2c9316ca83d3db",
        "android_client_info": {
          "package_name": "com.abdullah.tabibak"
        }
      },
      "oauth_client": [
        {
          "client_id": "464755135042-tuml1lmjvb7sqc05m2546kl4oqm2nnjb.apps.googleusercontent.com",
          "client_type": 3
        }
      ],
      "api_key": [
        {
          "current_key": "AIzaSyB8F4FEvB9cq-bN_ue0pSh5V-ERADhdSRA"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": [
            {
              "client_id": "464755135042-tuml1lmjvb7sqc05m2546kl4oqm2nnjb.apps.googleusercontent.com",
              "client_type": 3
            }
          ]
        }
      }
    }
  ],
  "configuration_version": "1"
}
```

**Place it here:**
```
tabibak_native/android/app/google-services.json
```

### **2.2: Update Android Package Name**

Edit `android/app/build.gradle.kts`:
```kotlin
defaultConfig {
    applicationId = "com.abdullah.tabibak"  // Changed from com.example
    minSdk = 21  // For Firebase
    targetSdk = flutter.targetSdkVersion
    versionCode = flutter.versionCode
    versionName = flutter.versionName
}
```

### **2.3: Add Firebase to Android**

Edit `android/build.gradle.kts`, add at the top:
```kotlin
buildscript {
    dependencies {
        classpath("com.google.gms:google-services:4.4.0")
    }
}
```

Edit `android/app/build.gradle.kts`, add at the bottom:
```kotlin
apply plugin: 'com.google.gms.google-services'
```

---

## 📦 Step 3: Add Dependencies

Edit `pubspec.yaml`:

```yaml
name: tabibak_native
description: "Tabibak - Native Medical Appointment System"
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: ^3.9.2

dependencies:
  flutter:
    sdk: flutter
  
  # UI
  cupertino_icons: ^1.0.8
  google_fonts: ^6.1.0
  flutter_svg: ^2.0.9
  
  # Firebase
  firebase_core: ^2.24.2
  firebase_auth: ^4.16.0
  cloud_firestore: ^4.14.0
  firebase_storage: ^11.6.0
  
  # State Management
  provider: ^6.1.1
  get: ^4.6.6
  
  # Utilities
  intl: ^0.19.0
  shared_preferences: ^2.2.2
  connectivity_plus: ^5.0.2
  url_launcher: ^6.2.5
  
  # Phone Auth
  country_code_picker: ^3.0.0
  pin_code_fields: ^8.0.1
  
  # UI Components
  flutter_spinkit: ^5.2.0
  shimmer: ^3.0.0
  cached_network_image: ^3.3.1
  
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0

flutter:
  uses-material-design: true
  
  # Add assets
  assets:
    - assets/images/
    - assets/icons/
```

Install dependencies:
```bash
flutter pub get
```

---

## 🏗️ Step 4: Project Structure

Create this folder structure:

```
lib/
├── main.dart
├── app.dart
├── config/
│   ├── firebase_config.dart
│   └── theme.dart
├── models/
│   ├── user_model.dart
│   ├── doctor_model.dart
│   ├── appointment_model.dart
│   └── patient_model.dart
├── services/
│   ├── auth_service.dart
│   ├── firestore_service.dart
│   └── storage_service.dart
├── providers/
│   ├── auth_provider.dart
│   ├── doctor_provider.dart
│   └── appointment_provider.dart
├── screens/
│   ├── splash_screen.dart
│   ├── role_selection_screen.dart
│   ├── patient/
│   │   ├── patient_home_screen.dart
│   │   ├── doctors_list_screen.dart
│   │   ├── booking_screen.dart
│   │   └── appointments_screen.dart
│   ├── doctor/
│   │   ├── doctor_login_screen.dart
│   │   ├── doctor_dashboard_screen.dart
│   │   ├── appointments_management_screen.dart
│   │   └── emr_screen.dart
│   └── receptionist/
│       ├── receptionist_login_screen.dart
│       ├── receptionist_dashboard_screen.dart
│       └── confirm_appointments_screen.dart
├── widgets/
│   ├── custom_button.dart
│   ├── custom_text_field.dart
│   ├── doctor_card.dart
│   └── appointment_card.dart
└── utils/
    ├── constants.dart
    ├── validators.dart
    └── helpers.dart
```

---

## 🎨 Step 5: Theme Configuration

Create `lib/config/theme.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      primaryColor: const Color(0xFF10B981), // Green
      scaffoldBackgroundColor: Colors.white,
      fontFamily: GoogleFonts.cairo().fontFamily,
      
      colorScheme: const ColorScheme.light(
        primary: Color(0xFF10B981),
        secondary: Color(0xFF3B82F6),
        error: Color(0xFFEF4444),
      ),
      
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF10B981),
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF10B981),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        filled: true,
        fillColor: Colors.grey[50],
      ),
    );
  }
}
```

---

## 🔥 Step 6: Firebase Initialization

Create `lib/config/firebase_config.dart`:

```dart
import 'package:firebase_core/firebase_core.dart';

class FirebaseConfig {
  static const firebaseOptions = FirebaseOptions(
    apiKey: 'AIzaSyB8F4FEvB9cq-bN_ue0pSh5V-ERADhdSRA',
    appId: '1:464755135042:android:02d0efac2c9316ca83d3db',
    messagingSenderId: '464755135042',
    projectId: 'medconnect-2',
    storageBucket: 'medconnect-2.firebasestorage.app',
  );
  
  static Future<void> initialize() async {
    await Firebase.initializeApp(options: firebaseOptions);
  }
}
```

---

## 📱 Step 7: Main App Entry

Create `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/firebase_config.dart';
import 'config/theme.dart';
import 'providers/auth_provider.dart';
import 'screens/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FirebaseConfig.initialize();
  runApp(const TabibakApp());
}

class TabibakApp extends StatelessWidget {
  const TabibakApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
      ],
      child: MaterialApp(
        title: 'طبيبك',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const SplashScreen(),
      ),
    );
  }
}
```

---

## ⏭️ Next Steps

After setting up the basic structure, I'll help you build:

1. **Authentication System** (Phone OTP + Email/Password)
2. **Patient Portal** (Browse doctors, book appointments)
3. **Doctor Portal** (Dashboard, EMR, prescriptions)
4. **Receptionist Portal** (Confirm bookings)

---

## 🚀 Ready to Start?

Once you've created the project and added the dependencies, let me know and I'll start building the screens!

**Estimated Timeline:**
- Week 1: Auth + Patient Portal
- Week 2: Doctor Portal
- Week 3: Receptionist Portal + Testing
- Week 4: Polish + Deploy

Let's do this! 💪
