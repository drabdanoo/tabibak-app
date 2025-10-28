// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pin_code_fields/pin_code_fields.dart';
import '../../providers/auth_provider.dart';
import '../../config/theme.dart';
import 'patient_profile_setup_screen.dart';
import 'patient_home_screen.dart';

class OTPVerificationScreen extends StatefulWidget {
  final String phoneNumber;

  const OTPVerificationScreen({
    super.key,
    required this.phoneNumber,
  });

  @override
  State<OTPVerificationScreen> createState() => _OTPVerificationScreenState();
}

class _OTPVerificationScreenState extends State<OTPVerificationScreen> {
  final _otpController = TextEditingController();
  String _currentOTP = '';
  bool _isLoading = false;

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _verifyOTP() async {
    if (_currentOTP.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('الرجاء إدخال رمز التحقق كاملاً'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final success = await authProvider.verifyOTP(_currentOTP);

      if (!mounted) return;

      if (success) {
        // Check if user profile exists
        if (authProvider.userRole == null) {
          // New user, go to profile setup
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => PatientProfileSetupScreen(
                phoneNumber: widget.phoneNumber,
              ),
            ),
          );
        } else {
          // Existing user, go to home
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => const PatientHomeScreen(),
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(authProvider.error ?? 'رمز التحقق غير صحيح'),
              backgroundColor: AppTheme.errorRed,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('حدث خطأ أثناء التحقق: ${e.toString()}'),
            backgroundColor: AppTheme.errorRed,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('التحقق من الهاتف'),
        elevation: 0,
      ),
      body: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 40),
                
                // Icon
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryGreen.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.lock,
                    size: 50,
                    color: AppTheme.primaryGreen,
                  ),
                ),
                
                const SizedBox(height: 32),
                
                // Title
                const Text(
                  'التحقق من رقم الهاتف',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                
                const SizedBox(height: 12),
                
                // Description
                Text(
                  'تم إرسال رمز مكون من 6 أرقام إلى ${widget.phoneNumber}',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey[600],
                  ),
                  textAlign: TextAlign.center,
                ),
                
                const SizedBox(height: 40),
                
                // OTP Field
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: PinCodeTextField(
                    appContext: context,
                    length: 6,
                    obscureText: false,
                    animationType: AnimationType.fade,
                    pinTheme: PinTheme(
                      shape: PinCodeFieldShape.box,
                      borderRadius: BorderRadius.circular(12),
                      fieldHeight: 60,
                      fieldWidth: 45,
                      activeColor: AppTheme.primaryGreen,
                      activeFillColor: AppTheme.primaryGreen.withValues(alpha: 0.1),
                      selectedColor: AppTheme.primaryGreen,
                      selectedFillColor: Colors.white,
                      inactiveColor: Colors.grey[300]!,
                      inactiveFillColor: Colors.white,
                      errorBorderColor: AppTheme.errorRed,
                    ),
                    cursorColor: AppTheme.primaryGreen,
                    animationDuration: const Duration(milliseconds: 300),
                    enableActiveFill: true,
                    controller: _otpController,
                    keyboardType: TextInputType.number,
                    onCompleted: (value) {
                      _currentOTP = value;
                      _verifyOTP();
                    },
                    onChanged: (value) {
                      _currentOTP = value;
                    },
                  ),
                ),
                
                const SizedBox(height: 32),
                
                // Verify Button
                ElevatedButton(
                  onPressed: _isLoading ? null : _verifyOTP,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            strokeWidth: 2,
                          ),
                        )
                      : const Text(
                          'تحقق',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
                
                const SizedBox(height: 20),
                
                // Resend Code
                TextButton(
                  onPressed: _isLoading ? null : () {
                    // TODO: Implement resend code functionality
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('إعادة إرسال الرمز غير متوفرة حالياً'),
                      ),
                    );
                  },
                  child: const Text(
                    'إعادة إرسال الرمز',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppTheme.primaryGreen,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
                
                if (authProvider.error != null && !authProvider.isLoading) ...[
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.errorRed.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.error_outline,
                          color: AppTheme.errorRed,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            authProvider.error!,
                            style: const TextStyle(
                              color: AppTheme.errorRed,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
