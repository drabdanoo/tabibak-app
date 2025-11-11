import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/medical_record_provider.dart';

class MedicationsList extends StatefulWidget {
  const MedicationsList({super.key});

  @override
  _MedicationsListState createState() => _MedicationsListState();
}

class _MedicationsListState extends State<MedicationsList>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
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
    final medications = medicalRecordProvider.getRecordsByCategory('Medication');
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
    
    if (medications.isEmpty) {
      return Container();
    }
    
    return FadeTransition(
      opacity: _animation,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.1),
          end: Offset.zero,
        ).animate(_animation),
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
                      label: 'Medication icon',
                      child: Icon(
                        Icons.medication,
                        color: Theme.of(context).primaryColor,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Semantics(
                      header: true,
                      label: 'Current Medications',
                      child: Text(
                        'Current Medications',
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
                ...medications.asMap().entries.map((entry) {
                  int idx = entry.key;
                  var medication = entry.value;
                  return _buildAnimatedMedicationItem(context, medication, idx);
                }),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAnimatedMedicationItem(BuildContext context, var medication, int index) {
    return Semantics(
      label: 'Medication: ${medication.title}, Since ${_formatDate(medication.date)}${medication.description.isNotEmpty ? ", ${medication.description}" : ""}',
      child: AnimatedContainer(
        duration: Duration(milliseconds: 300 + (index * 100)),
        curve: Curves.easeOut,
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Theme.of(context).primaryColor.withValues(alpha: 0.05),
        ),
        child: ListTile(
          leading: Semantics(
            label: 'Medication icon',
            child: Icon(
              Icons.medication_outlined,
              color: Theme.of(context).primaryColor,
            ),
          ),
          title: Semantics(
            label: 'Medication name: ${medication.title}',
            child: Text(
              medication.title,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (medication.description.isNotEmpty)
                Semantics(
                  label: 'Medication description: ${medication.description}',
                  child: Text(medication.description),
                ),
              const SizedBox(height: 4),
              Semantics(
                label: 'Started on: ${_formatDate(medication.date)}',
                child: Text(
                  'Since ${_formatDate(medication.date)}',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
              ),
            ],
          ),
          trailing: Semantics(
            label: 'Medication status: active',
            child: Icon(
              Icons.check_circle,
              color: Theme.of(context).colorScheme.tertiary,
            ),
          ),
          contentPadding: EdgeInsets.zero,
          onTap: () {
            // Could show more details about the medication
          },
        ),
      ),
    );
  }
  
  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}