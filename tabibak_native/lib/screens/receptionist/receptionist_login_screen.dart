import 'package:flutter/material.dart';
import '../../config/theme.dart';

class ReceptionistLoginScreen extends StatelessWidget {
  const ReceptionistLoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('تسجيل دخول السكرتير'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.assignment_ind,
                size: 100,
                color: AppTheme.warningOrange,
              ),
              const SizedBox(height: 32),
              const Text(
                'بوابة السكرتارية',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'جاري التطوير...',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
