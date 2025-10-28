import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/firestore_provider.dart';
import '../../widgets/accessible_text_field.dart';
import '../../widgets/accessible_button.dart';

class MedicalHistoryScreen extends StatefulWidget {
  @override
  _MedicalHistoryScreenState createState() => _MedicalHistoryScreenState();
}

class _MedicalHistoryScreenState extends State<MedicalHistoryScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _allergiesController;
  late TextEditingController _medicationsController;
  late TextEditingController _chronicDiseasesController;

  @override
  void initState() {
    super.initState();
    _allergiesController = TextEditingController();
    _medicationsController = TextEditingController();
    _chronicDiseasesController = TextEditingController();
  }

  @override
  void dispose() {
    _allergiesController.dispose();
    _medicationsController.dispose();
    _chronicDiseasesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.userModel;
    
    if (user == null) {
      return const Scaffold(
        body: Center(child: Text('Please log in to view medical history')),
      );
    }
    
    return Scaffold(
      appBar: AppBar(
        title: Semantics(
          header: true,
          label: 'Medical History',
          child: const Text('Medical History'),
        ),
        leading: Semantics(
          label: 'Go back',
          child: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              header: true,
              label: 'Allergies section',
              child: Text(
                'Allergies',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).primaryColor,
                    ),
              ),
            ),
            const SizedBox(height: 16),
            Semantics(
              label: 'Allergies text field',
              child: AccessibleTextField(
                controller: _allergiesController,
                label: 'List your allergies',
                hint: 'e.g., Penicillin, Pollen, etc.',
                maxLines: 3,
                semanticLabel: 'Allergies text area',
              ),
            ),
            const SizedBox(height: 24),
            Semantics(
              header: true,
              label: 'Current medications section',
              child: Text(
                'Current Medications',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).primaryColor,
                    ),
              ),
            ),
            const SizedBox(height: 16),
            Semantics(
              label: 'Current medications text field',
              child: AccessibleTextField(
                controller: _medicationsController,
                label: 'List your current medications',
                hint: 'e.g., Aspirin 100mg daily, etc.',
                maxLines: 3,
                semanticLabel: 'Current medications text area',
              ),
            ),
            const SizedBox(height: 24),
            Semantics(
              header: true,
              label: 'Chronic diseases section',
              child: Text(
                'Chronic Diseases',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).primaryColor,
                    ),
              ),
            ),
            const SizedBox(height: 16),
            Semantics(
              label: 'Chronic diseases text field',
              child: AccessibleTextField(
                controller: _chronicDiseasesController,
                label: 'List your chronic diseases',
                hint: 'e.g., Diabetes, Hypertension, etc.',
                maxLines: 3,
                semanticLabel: 'Chronic diseases text area',
              ),
            ),
            const SizedBox(height: 32),
            Semantics(
              label: 'Save medical history button',
              child: AccessibleButton(
                onPressed: () => _saveMedicalHistory(context, authProvider),
                semanticLabel: 'Save medical history changes',
                backgroundColor: Theme.of(context).colorScheme.primary,
                child: const Text('Save Changes'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _saveMedicalHistory(BuildContext context, AuthProvider authProvider) async {
    final firestoreProvider = Provider.of<FirestoreProvider>(context, listen: false);

    // Initialize controllers with existing data if available
    if (authProvider.userModel != null) {
      _allergiesController.text = authProvider.userModel!.allergies ?? '';
      _medicationsController.text = authProvider.userModel!.medications ?? '';
      _chronicDiseasesController.text = authProvider.userModel!.chronicDiseases ?? '';
    }

    if (_formKey.currentState!.validate()) {
      try {
        await firestoreProvider.updatePatientMedicalHistory(
          authProvider.userModel!.id,
          {
            'allergies': _allergiesController.text.trim(),
            'medications': _medicationsController.text.trim(),
            'chronicDiseases': _chronicDiseasesController.text.trim(),
          },
        );
        
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Medical history updated successfully'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to update medical history: $e'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }
}