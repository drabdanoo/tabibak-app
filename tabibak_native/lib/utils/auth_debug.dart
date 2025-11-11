import 'package:firebase_auth/firebase_auth.dart';
import 'dart:developer' as developer;

class AuthDebug {
  static Future<void> printUserClaims() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final idTokenResult = await user.getIdTokenResult(true); // Force refresh
        developer.log('=== AUTH DEBUG ===', name: 'AuthDebug');
        developer.log('User UID: ${user.uid}', name: 'AuthDebug');
        developer.log('User Email: ${user.email}', name: 'AuthDebug');
        developer.log('User Claims: ${idTokenResult.claims}', name: 'AuthDebug');
        developer.log('Has Doctor Claim: ${idTokenResult.claims?['doctor']}', name: 'AuthDebug');
        developer.log('Has Admin Claim: ${idTokenResult.claims?['admin']}', name: 'AuthDebug');
        developer.log('Has Patient Claim: ${idTokenResult.claims?['patient']}', name: 'AuthDebug');
        developer.log('Has Receptionist Claim: ${idTokenResult.claims?['receptionist']}', name: 'AuthDebug');
        developer.log('==================', name: 'AuthDebug');
      } else {
        developer.log('No user is signed in.', name: 'AuthDebug');
      }
    } catch (e) {
      developer.log('Error getting user claims: $e', name: 'AuthDebug', level: 900);
    }
  }
}