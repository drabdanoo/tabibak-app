import 'dart:developer' as developer;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'config/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/firestore_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/medical_record_provider.dart';
import 'providers/prescription_provider.dart';
import 'providers/appointment_reminder_provider.dart';
import 'services/notification_service.dart';
import 'utils/background_service.dart'; // Added import for background service
import 'screens/splash_screen.dart';
import 'screens/patient/patient_home_screen.dart';
import 'screens/chat_list_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/medical_records_screen.dart';
import 'screens/add_medical_record_screen.dart';
import 'config/firebase_config.dart';
import 'widgets/page_transition.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Lock device orientation to portrait
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  
  // Initialize date formatting for Arabic locale
  await initializeDateFormatting('ar', null);
  
  try {
    await FirebaseConfig.initialize();
    developer.log('Firebase initialized successfully', name: 'Main', level: 0);
  } catch (e) {
    developer.log('Firebase initialization error: $e', name: 'Main', level: 900);
    // Continue anyway - app will work without Firebase features
  }
  
  runApp(const TabibakApp());
}

class TabibakApp extends StatelessWidget {
  const TabibakApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Initialize notification service
    NotificationService().initialize();
    
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => FirestoreProvider()),
        ChangeNotifierProvider(create: (_) => ChatProvider()),
        ChangeNotifierProvider(create: (_) => MedicalRecordProvider()),
        ChangeNotifierProvider(create: (_) => PrescriptionProvider()),
        ChangeNotifierProvider(create: (_) => AppointmentReminderProvider()),
      ],
      child: Builder(
        builder: (context) {
          // Start background service after AuthProvider is available
          final authProvider = Provider.of<AuthProvider>(context, listen: false);
          BackgroundService().startBackgroundService(authProvider);
          
          return MaterialApp(
            title: 'طبيبك',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const SplashScreen(),
        onGenerateRoute: (settings) {
          switch (settings.name) {
            case '/patient-home':
              return PageTransition(page: PatientHomeScreen());
            case '/chats':
              return PageTransition(page: ChatListScreen());
            case '/chat':
              final args = settings.arguments as Map;
              return PageTransition(
                page: ChatScreen(
                  chatId: args['chatId'],
                  otherUserId: args['otherUserId'],
                  otherUserName: args['otherUserName'],
                ),
              );
            case '/medical-records':
              return PageTransition(page: MedicalRecordsScreen());
            case '/add-medical-record':
              return PageTransition(page: AddMedicalRecordScreen());
            default:
              return null;
          }
        },

        // Error handling
        builder: (context, widget) {
          // Add error boundary here if needed
          return Directionality(
            textDirection: TextDirection.rtl,
            child: widget!,
          );
        },
        // Handle routing errors
        onUnknownRoute: (settings) {
          return MaterialPageRoute(
            builder: (context) => const Scaffold(
              body: Center(
                child: Text('الصفحة غير موجودة'),
              ),
            ),
          );
        },
      ); // Closing MaterialApp
    }, // Closing Builder's builder function
    ), // Closing Builder widget, with a comma because it's the child of MultiProvider
    ); // Closing MultiProvider
  }
}
