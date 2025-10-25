import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

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
      await _auth.verifyPhoneNumber(
        phoneNumber: phoneNumber,
        verificationCompleted: (PhoneAuthCredential credential) async {
          // Auto-retrieval succeeded, sign in automatically
          print('✅ Auto-verification completed');
          await _auth.signInWithCredential(credential);
        },
        verificationFailed: (FirebaseAuthException e) {
          print('❌ Verification failed: ${e.code} - ${e.message}');
          onError(e.message ?? 'فشل التحقق من رقم الهاتف');
        },
        codeSent: (String verificationId, int? resendToken) {
          print('✅ Code sent, verificationId: $verificationId');
          onCodeSent(verificationId);
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          print('⏱️ Auto-retrieval timeout, manual entry required');
          // This is normal - just means user needs to enter code manually
        },
        timeout: const Duration(seconds: 120), // Increased timeout
      );
    } catch (e) {
      print('❌ Exception in sendOTP: $e');
      onError(e.toString());
    }
  }

  // Verify OTP and sign in
  Future<UserCredential?> verifyOTP({
    required String verificationId,
    required String otp,
  }) async {
    try {
      print('🔐 Verifying OTP: $otp with verificationId: ${verificationId.substring(0, 20)}...');
      PhoneAuthCredential credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: otp,
      );
      
      UserCredential? result;
      try {
        result = await _auth.signInWithCredential(credential);
      } catch (e) {
        // Handle PigeonUserDetails type cast error - user is actually signed in
        print('⚠️ Type cast error (known issue), checking current user...');
        if (_auth.currentUser != null) {
          print('✅ User is signed in despite error: ${_auth.currentUser?.uid}');
          // Create a mock UserCredential since sign-in succeeded
          return null; // We'll handle this in the provider
        }
        rethrow;
      }
      
      print('✅ OTP verification successful! User: ${result?.user?.uid}');
      return result;
    } catch (e) {
      print('❌ OTP verification failed: $e');
      throw Exception('رمز التحقق غير صحيح: ${e.toString()}');
    }
  }

  // Anonymous sign in (for guest browsing)
  Future<UserCredential> signInAnonymously() async {
    try {
      return await _auth.signInAnonymously();
    } catch (e) {
      throw Exception('فشل تسجيل الدخول كزائر');
    }
  }

  // Email/Password sign in (for doctors and receptionists)
  Future<UserCredential> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      return await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
    } on FirebaseAuthException catch (e) {
      if (e.code == 'user-not-found') {
        throw Exception('لم يتم العثور على المستخدم');
      } else if (e.code == 'wrong-password') {
        throw Exception('كلمة المرور غير صحيحة');
      }
      throw Exception(e.message ?? 'خطأ في تسجيل الدخول');
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
      print('📝 Creating patient profile for: $name ($userId)');
      await _firestore.collection(AppConstants.patientsCollection).doc(userId).set({
        'name': name,
        'phone': phone,
        'email': email,
        'role': AppConstants.rolePatient,
        'createdAt': FieldValue.serverTimestamp(),
      });
      print('✅ Patient profile created in Firestore');

      // Save to shared preferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.keyUserRole, AppConstants.rolePatient);
      await prefs.setString(AppConstants.keyUserId, userId);
      await prefs.setString(AppConstants.keyUserPhone, phone);
      await prefs.setBool(AppConstants.keyIsLoggedIn, true);
      print('✅ Patient data saved to SharedPreferences');
    } catch (e) {
      print('❌ Failed to create patient profile: $e');
      throw Exception('فشل إنشاء الملف الشخصي: ${e.toString()}');
    }
  }

  // Get user role
  Future<String?> getUserRole(String userId) async {
    try {
      // Check patients
      final patientDoc = await _firestore
          .collection(AppConstants.patientsCollection)
          .doc(userId)
          .get();
      if (patientDoc.exists) return AppConstants.rolePatient;

      // Check doctors
      final doctorDoc = await _firestore
          .collection(AppConstants.doctorsCollection)
          .doc(userId)
          .get();
      if (doctorDoc.exists) return AppConstants.roleDoctor;

      // Check receptionists
      final receptionistDoc = await _firestore
          .collection(AppConstants.receptionistsCollection)
          .doc(userId)
          .get();
      if (receptionistDoc.exists) return AppConstants.roleReceptionist;

      return null;
    } catch (e) {
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
    } catch (e) {
      throw Exception('فشل تسجيل الخروج');
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
