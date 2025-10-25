import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_app_check/firebase_app_check.dart';

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
    
    // Temporarily disabled App Check to test phone auth
    // TODO: Re-enable for production
    // await FirebaseAppCheck.instance.activate(
    //   androidProvider: AndroidProvider.debug,
    // );
  }
}
