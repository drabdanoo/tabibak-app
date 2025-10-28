import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/medical_record_provider.dart';

class MedicalRecordsSummary extends StatefulWidget {
  const MedicalRecordsSummary({super.key});

  @override
  _MedicalRecordsSummaryState createState() => _MedicalRecordsSummaryState();
}

class _MedicalRecordsSummaryState extends State<MedicalRecordsSummary>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _fadeAnimation = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final medicalRecordProvider = Provider.of<MedicalRecordProvider>(context);
    
    // Check if data is loading
    final isLoading = medicalRecordProvider.isLoading;
    
    if (isLoading) {
      return const Card(
        margin: EdgeInsets.all(16),
        child: Padding(
          padding: EdgeInsets.all(20.0),
          child: Center(
            child: CircularProgressIndicator(),
          ),
        ),
      );
    }
    
    return FadeTransition(
      opacity: _fadeAnimation,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.1),
          end: Offset.zero,
        ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut)),
        child: Card(
          margin: const EdgeInsets.all(16),
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Semantics(
                          label: 'Medical records icon',
                          child: Icon(
                            Icons.description,
                            color: Theme.of(context).primaryColor,
                            size: 28,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Semantics(
                          header: true,
                          label: 'Medical Records',
                          child: Text(
                            'Medical Records',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).primaryColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Semantics(
                      label: 'View all medical records',
                      child: TextButton(
                        onPressed: () {
                          Navigator.pushNamed(context, '/medical-records');
                        },
                        child: Text(
                          'View All',
                          style: TextStyle(
                            color: Theme.of(context).primaryColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _buildStatItem(context, medicalRecordProvider.getRecordsByCategory('Diagnosis').length.toString(), 'Diagnoses'),
                const SizedBox(height: 12),
                _buildStatItem(context, medicalRecordProvider.getRecordsByCategory('Treatment').length.toString(), 'Treatments'),
                const SizedBox(height: 12),
                _buildStatItem(context, medicalRecordProvider.getRecordsByCategory('Test').length.toString(), 'Tests'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatItem(BuildContext context, String count, String label) {
    return Semantics(
      label: '$label count: $count',
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Theme.of(context).primaryColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Semantics(
              label: '$label value: $count',
              child: Text(
                count,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).primaryColor,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Semantics(
            label: '$label description',
            child: Text(
              label,
              style: TextStyle(
                fontSize: 16,
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
              ),
            ),
          ),
        ],
      ),
    );
  }
}