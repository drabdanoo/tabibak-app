import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:developer' as developer;
import '../utils/constants.dart';
import '../utils/math_utils.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Get current user
  User? get currentUser => _auth.currentUser;

  // Auth state stream
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  // Send OTP for phone authentication
  Future<void> sendOTP({
    required String phoneNumber,
    required Function(String verificationId) onCodeSent,
    required Function(String error) onError,
  }) async {
    try {
      developer.log('Sending OTP to: $phoneNumber', name: 'AuthService');
      
      // Disable reCAPTCHA for testing - only works in debug/test mode
      await _auth.setSettings(appVerificationDisabledForTesting: true);
      
      await _auth.verifyPhoneNumber(
        phoneNumber: phoneNumber,
        verificationCompleted: (PhoneAuthCredential credential) async {
          // Auto-retrieval succeeded, sign in automatically
          developer.log('Auto-verification completed', name: 'AuthService');
          try {
            await _auth.signInWithCredential(credential);
            developer.log('Auto sign-in successful', name: 'AuthService');
          } catch (e) {
            developer.log('Auto-verification sign in error: $e', name: 'AuthService', level: 900);
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          developer.log('Verification failed: ${e.code} - ${e.message}', name: 'AuthService', level: 900);
          String errorMessage = 'فشل التحقق من رقم الهاتف';
          
          switch (e.code) {
            case 'invalid-phone-number':
              errorMessage = 'رقم الهاتف غير صحيح';
              break;
            case 'too-many-requests':
              errorMessage = 'لقد تجاوزت عدد محاولات التحقق المسموح بها، حاول لاحقاً';
              break;
            case 'quota-exceeded':
              errorMessage = 'تم تجاوز الحد الأقصى لطلبات التحقق، حاول لاحقاً';
              break;
            case 'operation-not-allowed':
              errorMessage = 'المصادقة عبر الهاتف غير مفعلة. الرجاء التواصل مع الدعم الفني';
              break;
            default:
              errorMessage = e.message ?? 'فشل التحقق من رقم الهاتف';
          }
          
          onError(errorMessage);
        },
        codeSent: (String verificationId, int? resendToken) {
          developer.log('Code sent successfully, verificationId: ${verificationId.substring(0, MathUtils.min(verificationId.length, 20))}...', name: 'AuthService');
          onCodeSent(verificationId);
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          developer.log('Auto-retrieval timeout for verificationId: ${verificationId.substring(0, MathUtils.min(verificationId.length, 20))}... - manual entry required', name: 'AuthService');
          // This is normal - just means user needs to enter code manually
        },
        timeout: const Duration(seconds: 120), // Increased timeout
      );
    } on FirebaseAuthException catch (e) {
      developer.log('FirebaseAuth exception in sendOTP: ${e.code} - ${e.message}', name: 'AuthService', level: 900);
      onError(e.message ?? 'خطأ في إرسال رمز التحقق');
    } catch (e) {
      developer.log('Exception in sendOTP: $e', name: 'AuthService', level: 900);
      onError(e.toString());
    }
  }

  // Verify OTP and sign in
  Future<UserCredential?> verifyOTP({
    required String verificationId,
    required String otp,
  }) async {
    try {
      developer.log('Verifying OTP: $otp with verificationId: ${verificationId.substring(0, MathUtils.min(verificationId.length, 20))}...', name: 'AuthService');
      PhoneAuthCredential credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: otp,
      );
      
      UserCredential result = await _auth.signInWithCredential(credential);
      developer.log('OTP verification successful! User: ${result.user?.uid ?? 'N/A'}', name: 'AuthService');
      return result;
    } on FirebaseAuthException catch (e) {
      developer.log('Firebase Auth error in verifyOTP: ${e.code} - ${e.message}', name: 'AuthService', level: 900);
      
      String errorMessage = 'رمز التحقق غير صحيح';
      switch (e.code) {
        case 'invalid-verification-code':
          errorMessage = 'رمز التحقق غير صحيح';
          break;
        case 'session-expired':
          errorMessage = 'انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد';
          break;
        default:
          errorMessage = e.message ?? 'خطأ في التحقق من الرمز';
      }
      
      throw Exception(errorMessage);
    } catch (e) {
      developer.log('OTP verification error: $e', name: 'AuthService', level: 900);
      
      // Check if user is actually signed in despite the error
      if (_auth.currentUser != null) {
        developer.log('User is signed in despite error: ${_auth.currentUser?.uid ?? 'unknown'}', name: 'AuthService');
        // Return null to indicate success but no UserCredential object
        return null;
      }
      
      throw Exception('رمز التحقق غير صحيح: ${e.toString()}');
    }
  }

  // Anonymous sign in (for guest browsing)
  Future<UserCredential> signInAnonymously() async {
    try {
      return await _auth.signInAnonymously();
    } on FirebaseAuthException catch (e) {
      developer.log('Firebase Auth error in signInAnonymously: ${e.code} - ${e.message}', name: 'AuthService', level: 900);
      throw Exception('فشل تسجيل الدخول كزائر: ${e.message}');
    } catch (e) {
      throw Exception('فشل تسجيل الدخول كزائر');
    }
  }

  // Email/Password sign in (for doctors and receptionists)
  Future<UserCredential?> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      developer.log('Signing in with email: $email', name: 'AuthService');
      UserCredential result = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      developer.log('Email sign-in successful! User: ${result.user?.uid ?? 'N/A'}', name: 'AuthService');
      return result;
    } on FirebaseAuthException catch (e) {
      developer.log('Firebase Auth error: ${e.code} - ${e.message}', name: 'AuthService', level: 900);
      String errorMessage = 'خطأ في تسجيل الدخول';
      
      switch (e.code) {
        case 'user-not-found':
          errorMessage = 'لم يتم العثور على المستخدم';
          break;
        case 'wrong-password':
          errorMessage = 'كلمة المرور غير صحيحة';
          break;
        case 'invalid-email':
          errorMessage = 'البريد الإلكتروني غير صحيح';
          break;
        case 'user-disabled':
          errorMessage = 'تم تعطيل هذا الحساب';
          break;
        case 'network-request-failed':
          errorMessage = 'خطأ في الاتصال بالإنترنت';
          break;
        case 'invalid-credential':
          errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
          break;
        default:
          errorMessage = e.message ?? 'خطأ في تسجيل الدخول';
      }
      
      throw Exception(errorMessage);
    } catch (e) {
      developer.log('Unexpected error in signInWithEmail: $e', name: 'AuthService', level: 900);
      
      // Check if user is actually signed in despite the error
      if (_auth.currentUser != null) {
        developer.log('User is signed in despite error: ${_auth.currentUser?.uid ?? 'unknown'}', name: 'AuthService');
        // Return null to indicate success but no UserCredential object
        return null;
      }
      
      throw Exception('خطأ غير متوقع: ${e.toString()}');
    }
  }

  // Create patient profile after phone auth
  Future<void> createPatientProfile({
    required String userId,
    required String name,
    required String phone,
    String? email,
  }) async {
    try {
      developer.log('Creating patient profile for: $name ($userId)', name: 'AuthService');
      await _firestore.collection(AppConstants.patientsCollection).doc(userId).set({
        'name': name,
        'phone': phone,
        'email': email,
        'role': AppConstants.rolePatient,
        'createdAt': FieldValue.serverTimestamp(),
      });
      developer.log('Patient profile created in Firestore', name: 'AuthService');

      // Save to shared preferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.keyUserRole, AppConstants.rolePatient);
      await prefs.setString(AppConstants.keyUserId, userId);
      await prefs.setString(AppConstants.keyUserPhone, phone);
      await prefs.setBool(AppConstants.keyIsLoggedIn, true);
      developer.log('Patient data saved to SharedPreferences', name: 'AuthService');
    } on FirebaseException catch (e) {
      developer.log('Firebase error in createPatientProfile: ${e.code} - ${e.message}', name: 'AuthService', level: 900);
      throw Exception('فشل إنشاء الملف الشخصي: ${e.message}');
    } catch (e) {
      developer.log('Failed to create patient profile: $e', name: 'AuthService', level: 900);
      throw Exception('فشل إنشاء الملف الشخصي: ${e.toString()}');
    }
  }

  // Get user role
  Future<String?> getUserRole(String userId) async {
    try {
      developer.log('Getting user role for userId: $userId', name: 'AuthService');
      
      // Check patients
      final patientDoc = await _firestore
          .collection(AppConstants.patientsCollection)
          .doc(userId)
          .get();
      if (patientDoc.exists) {
        developer.log('User role found: patient', name: 'AuthService');
        return AppConstants.rolePatient;
      }

      // Check doctors
      final doctorDoc = await _firestore
          .collection(AppConstants.doctorsCollection)
          .doc(userId)
          .get();
      if (doctorDoc.exists) {
        developer.log('User role found: doctor', name: 'AuthService');
        return AppConstants.roleDoctor;
      }

      // Check receptionists
      final receptionistDoc = await _firestore
          .collection(AppConstants.receptionistsCollection)
          .doc(userId)
          .get();
      if (receptionistDoc.exists) {
        developer.log('User role found: receptionist', name: 'AuthService');
        return AppConstants.roleReceptionist;
      }

      developer.log('No user role found for userId: $userId', name: 'AuthService', level: 900);
      return null;
    } catch (e) {
      developer.log('Error getting user role: $e', name: 'AuthService', level: 900);
      return null;
    }
  }

  // Sign out
  Future<void> signOut() async {
    try {
      await _auth.signOut();
      
      // Clear shared preferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.clear();
    } on FirebaseAuthException catch (e) {
      developer.log('Firebase Auth error in signOut: ${e.code} - ${e.message}', name: 'AuthService', level: 900);
      throw Exception('فشل تسجيل الخروج: ${e.message}');
    } catch (e) {
      throw Exception('فشل تسجيل الخروج: ${e.toString()}');
    }
  }

  // Check if user is logged in
  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(AppConstants.keyIsLoggedIn) ?? false;
  }

  // Get saved user role
  Future<String?> getSavedUserRole() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(AppConstants.keyUserRole);
  }
}