import 'dart:async';
import 'dart:developer' as developer;
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';
import '../models/user_model.dart';
import '../utils/background_service.dart'; // Added import for background service

class AuthProvider with ChangeNotifier {
  final AuthService _authService = AuthService();
  
  User? _currentUser;
  UserModel? _userModel;
  String? _userRole;
  bool _isLoading = false;
  String? _error;
  String? _verificationId;
  bool _isAuthStateLoading = true;

  // Getters
  User? get currentUser => _currentUser;
  UserModel? get userModel => _userModel;
  String? get userRole => _userRole;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _currentUser != null;
  bool get isAuthStateLoading => _isAuthStateLoading;

  AuthProvider() {
    _initAuth();
  }

  void _initAuth() {
    try {
      _authService.authStateChanges.listen((User? user) async {
        _currentUser = user;
        if (user != null) {
          await _loadUserRole();
        } else {
          _userRole = null;
          _userModel = null;
        }
        _isAuthStateLoading = false;
        notifyListeners();
      }, onError: (error) {
        developer.log('Auth state changes error: $error', name: 'AuthProvider', level: 900);
        _setError('حدث خطأ في المصادقة: $error');
        _isAuthStateLoading = false;
        notifyListeners();
      });
    } catch (e) {
      developer.log('Auth initialization error: $e', name: 'AuthProvider', level: 900);
      _setError('فشل تهيئة المصادقة: $e');
      _isAuthStateLoading = false;
      notifyListeners();
    }
  }

  Future<void> _loadUserRole() async {
    if (_currentUser == null) return;
    try {
      developer.log('Loading user role for: ${_currentUser!.uid}', name: 'AuthProvider');
      _userRole = await _authService.getUserRole(_currentUser!.uid);
      developer.log('User role loaded: $_userRole', name: 'AuthProvider');
      
      // Schedule appointment reminders after loading user role
      if (_userRole != null) {
        _scheduleAppointmentReminders();
      }
    } catch (e) {
      developer.log('Error loading user role: $e', name: 'AuthProvider', level: 900);
      _setError('فشل تحميل دور المستخدم: $e');
    }
    notifyListeners();
  }

  // Schedule appointment reminders for the user
  Future<void> _scheduleAppointmentReminders() async {
    try {
      // Start background service for this user
      BackgroundService().startBackgroundService(this);
    } catch (e) {
      developer.log('Error scheduling appointment reminders: $e', name: 'AuthProvider', level: 900);
    }
  }

  // Send OTP
  Future<bool> sendOTP(String phoneNumber) async {
    _setLoading(true);
    _clearError();

    try {
      final completer = Completer<bool>();
      
      await _authService.sendOTP(
        phoneNumber: phoneNumber,
        onCodeSent: (verificationId) {
          _verificationId = verificationId;
          _setLoading(false);
          if (!completer.isCompleted) completer.complete(true);
        },
        onError: (error) {
          _setError(error);
          _setLoading(false);
          if (!completer.isCompleted) completer.complete(false);
        },
      );
      
      // Wait for either callback to fire
      return await completer.future;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Verify OTP
  Future<bool> verifyOTP(String otp) async {
    if (_verificationId == null) {
      _setError('لم يتم إرسال رمز التحقق');
      return false;
    }

    _setLoading(true);
    _clearError();

    try {
      final credential = await _authService.verifyOTP(
        verificationId: _verificationId!,
        otp: otp,
      );
      
      // Check if user is signed in (credential might be null due to type cast error)
      _currentUser = credential?.user ?? _authService.currentUser;
      
      if (_currentUser != null) {
        await _loadUserRole();
        _setLoading(false);
        return true;
      }
      
      _setError('فشل التحقق من الرمز');
      _setLoading(false);
      return false;
    } catch (e) {
      // Check if user is actually signed in despite error
      _currentUser = _authService.currentUser;
      if (_currentUser != null) {
        developer.log('User signed in despite error', name: 'AuthProvider');
        await _loadUserRole();
        _setLoading(false);
        return true;
      }
      
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Create patient profile
  Future<bool> createPatientProfile({
    required String name,
    required String phone,
    String? email,
  }) async {
    if (_currentUser == null) {
      _setError('المستخدم غير مسجل الدخول');
      return false;
    }

    _setLoading(true);
    _clearError();

    try {
      await _authService.createPatientProfile(
        userId: _currentUser!.uid,
        name: name,
        phone: phone,
        email: email,
      );
      
      _userRole = 'patient';
      _setLoading(false);
      notifyListeners();
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Email/Password sign in
  Future<bool> signInWithEmail(String email, String password) async {
    _setLoading(true);
    _clearError();

    try {
      final credential = await _authService.signInWithEmail(
        email: email,
        password: password,
      );
      
      // Check if user is signed in (credential might be null due to type cast error)
      _currentUser = credential?.user ?? _authService.currentUser;
      
      if (_currentUser != null) {
        await _loadUserRole();
        _setLoading(false);
        return true;
      }
      
      _setError('فشل تسجيل الدخول');
      _setLoading(false);
      return false;
    } catch (e) {
      // Check if user is actually signed in despite error
      _currentUser = _authService.currentUser;
      if (_currentUser != null) {
        developer.log('User signed in despite error', name: 'AuthProvider');
        await _loadUserRole();
        _setLoading(false);
        return true;
      }
      
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Sign in anonymously (for guest browsing)
  Future<bool> signInAnonymously() async {
    _setLoading(true);
    _clearError();

    try {
      // Try anonymous sign in first
      try {
        await _authService.signInAnonymously();
        _currentUser = _authService.currentUser;
        _userRole = 'guest';
        _setLoading(false);
        notifyListeners();
        return true;
      } catch (e) {
        // If anonymous auth fails, try guest email/password account
        developer.log('Anonymous auth failed, trying guest account: $e', name: 'AuthProvider', level: 900);
        await _authService.signInWithEmail(
          email: 'guest@tabibak.app',
          password: 'Guest@123456',
        );
        _currentUser = _authService.currentUser;
        _userRole = 'guest';
        _setLoading(false);
        notifyListeners();
        return true;
      }
    } catch (e) {
      _setError('فشل تسجيل الدخول كزائر: ${e.toString()}');
      _setLoading(false);
      return false;
    }
  }

  // Sign out
  Future<void> signOut() async {
    _setLoading(true);
    _clearError();

    try {
      await _authService.signOut();
      _currentUser = null;
      _userRole = null;
      _userModel = null;
      _verificationId = null;
    } catch (e) {
      _setError(e.toString());
    }

    _setLoading(false);
    notifyListeners();
  }

  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }

  // Private helper methods
  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _setError(String? error) {
    _error = error;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
  }
}