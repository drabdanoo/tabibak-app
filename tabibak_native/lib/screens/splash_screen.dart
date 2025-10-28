import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../screens/role_selection_screen.dart';
import '../screens/patient/patient_home_screen.dart';
import '../screens/doctor/doctor_dashboard_screen.dart';
import '../screens/receptionist/receptionist_dashboard_screen.dart';
import '../config/theme.dart';
import 'dart:developer' as developer;

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  bool _navigationStarted = false;

  @override
  void initState() {
    super.initState();
    
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );

    _scaleAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );

    _controller.forward();
    _checkAuthAndNavigate();
  }

  Future<void> _checkAuthAndNavigate() async {
    try {
      // Add a small delay for better UX
      await Future.delayed(const Duration(seconds: 2));
      
      // Prevent multiple navigation attempts
      if (_navigationStarted) return;
      _navigationStarted = true;

      if (!mounted) return;

      final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
      if (authProvider.isAuthenticated && authProvider.userRole != null) {
        // User is logged in, navigate to appropriate screen
        _navigateToHome(authProvider.userRole!);
      } else {
        // User not logged in, show role selection
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const RoleSelectionScreen()),
          );
        }
      }
    } catch (e) {
      developer.log('Navigation error: $e', name: 'SplashScreen', level: 900);
      // Even if there's an error, we should navigate to role selection
      if (mounted && !_navigationStarted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const RoleSelectionScreen()),
        );
      }
    }
  }

  void _navigateToHome(String role) {
    Widget homeScreen;
    
    switch (role) {
      case 'patient':
        homeScreen = const PatientHomeScreen();
        break;
      case 'doctor':
        homeScreen = const DoctorDashboardScreen();
        break;
      case 'receptionist':
        homeScreen = const ReceptionistDashboardScreen();
        break;
      default:
        homeScreen = const RoleSelectionScreen();
    }

    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => homeScreen),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.primaryGreen,
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: ScaleTransition(
            scale: _scaleAnimation,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // App Logo/Icon
                Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(30),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.local_hospital,
                    size: 60,
                    color: AppTheme.primaryGreen,
                  ),
                ),
                const SizedBox(height: 30),
                // App Name
                const Text(
                  'طبيبك',
                  style: TextStyle(
                    fontSize: 48,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 10),
                // Tagline
                const Text(
                  'نظام إدارة المواعيد الطبية',
                  style: TextStyle(
                    fontSize: 18,
                    color: Colors.white70,
                  ),
                ),
                const SizedBox(height: 50),
                // Loading indicator
                const CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}