import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';
import '../models/user_model.dart';

class AuthProvider with ChangeNotifier {
  final AuthService _authService = AuthService();
  
  User? _currentUser;
  UserModel? _userModel;
  String? _userRole;
  bool _isLoading = false;
  String? _error;
  String? _verificationId;

  // Getters
  User? get currentUser => _currentUser;
  UserModel? get userModel => _userModel;
  String? get userRole => _userRole;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _currentUser != null;

  AuthProvider() {
    _initAuth();
  }

  void _initAuth() {
    try {
      _authService.authStateChanges.listen((User? user) {
        _currentUser = user;
        if (user != null) {
          _loadUserRole();
        } else {
          _userRole = null;
          _userModel = null;
        }
        notifyListeners();
      });
    } catch (e) {
      print('❌ Auth initialization error: $e');
    }
  }

  Future<void> _loadUserRole() async {
    if (_currentUser == null) return;
    try {
      _userRole = await _authService.getUserRole(_currentUser!.uid);
    } catch (e) {
      print('❌ Error loading user role: $e');
    }
    notifyListeners();
  }

  // Send OTP
  Future<bool> sendOTP(String phoneNumber) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final completer = Completer<bool>();
      
      await _authService.sendOTP(
        phoneNumber: phoneNumber,
        onCodeSent: (verificationId) {
          _verificationId = verificationId;
          _isLoading = false;
          notifyListeners();
          if (!completer.isCompleted) completer.complete(true);
        },
        onError: (error) {
          _error = error;
          _isLoading = false;
          notifyListeners();
          if (!completer.isCompleted) completer.complete(false);
        },
      );
      
      // Wait for either callback to fire
      return await completer.future;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Verify OTP
  Future<bool> verifyOTP(String otp) async {
    if (_verificationId == null) {
      _error = 'لم يتم إرسال رمز التحقق';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final credential = await _authService.verifyOTP(
        verificationId: _verificationId!,
        otp: otp,
      );
      
      // Check if user is signed in (credential might be null due to type cast error)
      _currentUser = credential?.user ?? _authService.currentUser;
      
      if (_currentUser != null) {
        await _loadUserRole();
        _isLoading = false;
        notifyListeners();
        return true;
      }
      
      _error = 'فشل التحقق من الرمز';
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      // Check if user is actually signed in despite error
      _currentUser = _authService.currentUser;
      if (_currentUser != null) {
        print('✅ User signed in despite error');
        await _loadUserRole();
        _isLoading = false;
        notifyListeners();
        return true;
      }
      
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Create patient profile
  Future<bool> createPatientProfile({
    required String name,
    required String phone,
    String? email,
  }) async {
    if (_currentUser == null) return false;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _authService.createPatientProfile(
        userId: _currentUser!.uid,
        name: name,
        phone: phone,
        email: email,
      );
      
      _userRole = 'patient';
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Email/Password sign in
  Future<bool> signInWithEmail(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final credential = await _authService.signInWithEmail(
        email: email,
        password: password,
      );
      
      _currentUser = credential.user;
      await _loadUserRole();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Sign in anonymously (for guest browsing)
  Future<bool> signInAnonymously() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _authService.signInAnonymously();
      _currentUser = _authService.currentUser;
      _userRole = 'guest';
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Sign out
  Future<void> signOut() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _authService.signOut();
      _currentUser = null;
      _userRole = null;
      _userModel = null;
      _verificationId = null;
    } catch (e) {
      _error = e.toString();
    }

    _isLoading = false;
    notifyListeners();
  }

  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}
