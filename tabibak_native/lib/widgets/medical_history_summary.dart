import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'skeleton_loader.dart';

class MedicalHistorySummary extends StatefulWidget {
  @override
  _MedicalHistorySummaryState createState() => _MedicalHistorySummaryState();
}

class _MedicalHistorySummaryState extends State<MedicalHistorySummary>
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
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.userModel;
    
    // Check if data is loading
    final isLoading = authProvider.isLoading;
    
    if (isLoading) {
      return Card(
        margin: const EdgeInsets.all(16),
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  SkeletonLoader(
                    width: 28,
                    height: 28,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(width: 10),
                  SkeletonLoader(height: 20, width: 150),
                ],
              ),
              const SizedBox(height: 16),
              ...List.generate(3, (index) => index).map((index) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonLoader(
                        width: 20,
                        height: 20,
                        borderRadius: BorderRadius.circular(4),
                        margin: const EdgeInsets.only(right: 8),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SkeletonLoader(height: 14, width: 80),
                            const SizedBox(height: 4),
                            SkeletonLoader(height: 14, width: 150),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ],
          ),
        ),
      );
    }
    
    if (user == null) {
      return Container();
    }
    
    final hasAllergies = user.allergies != null && user.allergies!.trim().isNotEmpty;
    final hasMedications = user.medications != null && user.medications!.trim().isNotEmpty;
    final hasChronicDiseases = user.chronicDiseases != null && user.chronicDiseases!.trim().isNotEmpty;
    
    // If no medical history, don't show anything
    if (!hasAllergies && !hasMedications && !hasChronicDiseases) {
      return Container();
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
                  children: [
                    Semantics(
                      label: 'Medical history icon',
                      child: Icon(
                        Icons.medical_services,
                        color: Theme.of(context).primaryColor,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Semantics(
                      header: true,
                      label: 'Medical History Summary',
                      child: Text(
                        'Medical History Summary',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).primaryColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (hasAllergies) ...[
                  _buildInfoRow(
                    context,
                    Icons.warning_amber_rounded,
                    'Allergies',
                    user.allergies!,
                    Colors.red,
                  ),
                  const SizedBox(height: 12),
                ],
                if (hasMedications) ...[
                  _buildInfoRow(
                    context,
                    Icons.medication,
                    'Current Medications',
                    user.medications!,
                    Theme.of(context).primaryColor,
                  ),
                  const SizedBox(height: 12),
                ],
                if (hasChronicDiseases) ...[
                  _buildInfoRow(
                    context,
                    Icons.healing,
                    'Chronic Diseases',
                    user.chronicDiseases!,
                    Theme.of(context).colorScheme.tertiary,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(BuildContext context, IconData icon, String label,
      String value, Color color) {
    return Semantics(
      label: '$label: $value',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            label: '$label icon',
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(
                  label: '$label title',
                  child: Text(
                    label,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Semantics(
                  label: '$label value: $value',
                  child: Text(
                    value,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}