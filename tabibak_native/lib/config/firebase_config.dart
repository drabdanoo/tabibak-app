import 'package:firebase_core/firebase_core.dart';
import '../firebase_options.dart';
import 'package:firebase_app_check/firebase_app_check.dart';

class FirebaseConfig {
  static Future<void> initialize() async {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    
    // Enable App Check for security
    await FirebaseAppCheck.instance.activate(
      // Use debug provider for development, replace with play integrity for production
      androidProvider: AndroidProvider.debug,
      // For production, use: AndroidProvider.playIntegrity,
    );
  }
}