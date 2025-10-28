import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'doctor/doctor_login_screen.dart';

import '../widgets/accessible_text_field.dart';
import '../widgets/accessible_button.dart';
import '../widgets/focus_node_manager.dart';

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  
  final FocusNodeManager _focusNodeManager = FocusNodeManager();
  late FocusNode _phoneFocusNode;
  late FocusNode _otpFocusNode;

  bool _isOtpSent = false;

  @override
  void initState() {
    super.initState();
    _phoneFocusNode = _focusNodeManager.createNode();
    _otpFocusNode = _focusNodeManager.createNode();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    _focusNodeManager.dispose();
    super.dispose();
  }

  void _sendOTP(BuildContext context) {
    if (_formKey.currentState!.validate()) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      authProvider.sendOTP(_phoneController.text).then((_) {
        setState(() {
          _isOtpSent = true;
        });
      }).catchError((error) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('حدث خطأ أثناء إرسال الرمز')),
        );
      });
    }
  }

  void _verifyOTP(BuildContext context) {
    if (_formKey.currentState!.validate()) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      authProvider.verifyOTP(_otpController.text).then((_) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => DoctorLoginScreen(),
          ),
        );
      }).catchError((error) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('رمز التحقق غير صحيح')),
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 40),
                  Semantics(
                    header: true,
                    label: 'Welcome to Tabibak App',
                    child: Text(
                      'مرحباً بك',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).primaryColor,
                          ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Semantics(
                    label: 'Sign in to your account',
                    child: Text(
                      'قم بتسجيل الدخول إلى حسابك',
                      style: TextStyle(
                        fontSize: 18,
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 40),
                  if (!_isOtpSent) ...[
                    Semantics(
                      label: 'Phone number input field',
                      child: AccessibleTextField(
                        controller: _phoneController,
                        focusNode: _phoneFocusNode,
                        label: 'رقم الهاتف',
                        hint: 'أدخل رقم هاتفك',
                        keyboardType: TextInputType.phone,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'الرجاء إدخال رقم الهاتف';
                          }
                          if (value.length < 10) {
                            return 'رقم الهاتف غير صحيح';
                          }
                          return null;
                        },
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _sendOTP(context),
                        semanticLabel: 'Phone number text field',
                      ),
                    ),
                    const SizedBox(height: 24),
                    Semantics(
                      label: 'Send OTP button',
                      child: AccessibleButton(
                        onPressed: () => _sendOTP(context),
                        semanticLabel: 'Send verification code button',
                        child: authProvider.isLoading
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : const Text('إرسال رمز التحقق'),
                      ),
                    ),
                  ] else ...[
                    Semantics(
                      label: 'Enter verification code',
                      child: Text(
                        'تم إرسال رمز التحقق إلى رقمك',
                        style: TextStyle(
                          fontSize: 16,
                          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Semantics(
                      label: 'Verification code input field',
                      child: AccessibleTextField(
                        controller: _otpController,
                        focusNode: _otpFocusNode,
                        label: 'رمز التحقق',
                        hint: 'أدخل الرمز المؤلف من 6 أرقام',
                        keyboardType: TextInputType.number,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'الرجاء إدخال رمز التحقق';
                          }
                          if (value.length != 6) {
                            return 'الرمز يجب أن يكون مؤلفاً من 6 أرقام';
                          }
                          return null;
                        },
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _verifyOTP(context),
                        semanticLabel: 'Verification code text field',
                      ),
                    ),
                    const SizedBox(height: 24),
                    Semantics(
                      label: 'Verify OTP button',
                      child: AccessibleButton(
                        onPressed: () => _verifyOTP(context),
                        semanticLabel: 'Verify code and sign in button',
                        child: authProvider.isLoading
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : const Text('تحقق وتسجيل الدخول'),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Semantics(
                      label: 'Resend code button',
                      child: TextButton(
                        onPressed: () {
                          setState(() {
                            _isOtpSent = false;
                            _otpController.clear();
                          });
                        },
                        child: const Text('إعادة إرسال الرمز'),
                      ),
                    ),
                  ],
                  if (authProvider.error != null) ...[
                    const SizedBox(height: 24),
                    Semantics(
                      label: 'Error message: ${authProvider.error}',
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.error_outline,
                              color: Theme.of(context).colorScheme.error,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                authProvider.error!,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
