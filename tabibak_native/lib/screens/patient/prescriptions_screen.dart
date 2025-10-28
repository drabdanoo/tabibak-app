import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../models/prescription_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/prescription_provider.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/skeleton_list_loader.dart';

class PrescriptionsScreen extends StatefulWidget {
  const PrescriptionsScreen({super.key});

  @override
  PrescriptionsScreenState createState() => PrescriptionsScreenState();
}

class PrescriptionsScreenState extends State<PrescriptionsScreen> {
  @override
  void initState() {
    super.initState();
    _loadPrescriptions();
  }

  void _loadPrescriptions() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final prescriptionProvider = Provider.of<PrescriptionProvider>(context, listen: false);
      prescriptionProvider.loadPatientPrescriptions(authProvider.userModel!.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final prescriptionProvider = Provider.of<PrescriptionProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Prescriptions'),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          _loadPrescriptions();
        },
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(
                  'Prescription History',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ),
              const SizedBox(height: 20),
              if (authProvider.userModel == null)
                const Center(
                  child: Text('Please log in to view your prescriptions'),
                )
              else if (prescriptionProvider.isLoading)
                const SkeletonListLoader(
                  itemCount: 3,
                  hasAvatar: false,
                  hasSubtitle: true,
                )
              else if (prescriptionProvider.error != null)
                EmptyState(
                  title: 'Error Loading Prescriptions',
                  message:
                      'There was an error loading your prescriptions. Please try again later.',
                  icon: Icons.error_outline,
                  onRetry: _loadPrescriptions,
                  retryText: 'Retry',
                )
              else if (prescriptionProvider.prescriptions.isEmpty)
                const EmptyState(
                  title: 'No Prescriptions Yet',
                  message:
                      'You don\'t have any prescriptions yet. When your doctor writes a prescription, it will appear here.',
                  icon: Icons.medication,
                )
              else
                Expanded(
                  child: ListView.builder(
                    padding: EdgeInsets.zero,
                    itemCount: prescriptionProvider.prescriptions.length,
                    itemBuilder: (context, index) {
                      final prescription =
                          prescriptionProvider.prescriptions[index];
                      return _buildPrescriptionCard(context, prescription);
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPrescriptionCard(BuildContext context, PrescriptionModel prescription) {
    final dateFormat = DateFormat('MMM dd, yyyy');
    final isActive = prescription.isActive &&
        (prescription.validUntil == null ||
            prescription.validUntil!.isAfter(DateTime.now()));

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Semantics(
                  header: true,
                  label: 'Prescription from Dr. ${prescription.doctorName}',
                  child: Text(
                    'Dr. ${prescription.doctorName}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isActive
                        ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.1)
                        : Theme.of(context).colorScheme.secondary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isActive ? 'Active' : 'Expired',
                    style: TextStyle(
                      color: isActive
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(context).colorScheme.secondary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Semantics(
              label: 'Prescribed on ${dateFormat.format(prescription.prescribedAt)}',
              child: Text(
                'Prescribed: ${dateFormat.format(prescription.prescribedAt)}',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                ),
              ),
            ),
            if (prescription.validUntil != null) ...[
              const SizedBox(height: 4),
              Semantics(
                label: 'Valid until ${dateFormat.format(prescription.validUntil!)}',
                child: Text(
                  'Valid until: ${dateFormat.format(prescription.validUntil!)}',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                  ),
                ),
              ),
            ],
            if (prescription.doctorSpecialty != null && prescription.doctorSpecialty!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Semantics(
                label: 'Specialty: ${prescription.doctorSpecialty!}',
                child: Text(
                  'Specialty: ${prescription.doctorSpecialty!}',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Semantics(
              header: true,
              label: 'Medications',
              child: Text(
                'Medications',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).primaryColor,
                ),
              ),
            ),
            const SizedBox(height: 8),
            ...prescription.medications.map((med) => _buildMedicationItem(context, med)).toList(),
            if (prescription.notes != null && prescription.notes!.isNotEmpty) ...[
              const SizedBox(height: 16),
              Semantics(
                header: true,
                label: 'Doctor\'s Notes',
                child: Text(
                  'Doctor\'s Notes',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Semantics(
                label: 'Notes: ${prescription.notes!}',
                child: Text(
                  prescription.notes!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Center(
              child: ElevatedButton.icon(
                onPressed: () {
                  // TODO: Implement share or download functionality
                },
                icon: const Icon(Icons.share),
                label: const Text('Share with Pharmacy'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMedicationItem(BuildContext context, PrescriptionItem medication) {
    return Semantics(
      label:
          'Medication: ${medication.name}, dosage: ${medication.dosage}, frequency: ${medication.frequency}, duration: ${medication.duration}${medication.instructions != null && medication.instructions!.isNotEmpty ? ", instructions: ${medication.instructions!}" : ""}',
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(context).primaryColor.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.medication,
                  color: Theme.of(context).primaryColor,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Semantics(
                    label: 'Medication name: ${medication.name}',
                    child: Text(
                      medication.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(
                        label: 'Dosage: ${medication.dosage}',
                        child: Text('Dosage: ${medication.dosage}'),
                      ),
                      const SizedBox(height: 4),
                      Semantics(
                        label: 'Frequency: ${medication.frequency}',
                        child: Text('Frequency: ${medication.frequency}'),
                      ),
                    ],
                  ),
                ),
                Semantics(
                  label: 'Duration: ${medication.duration}',
                  child: Text('Duration: ${medication.duration}'),
                ),
              ],
            ),
            if (medication.instructions != null && medication.instructions!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Semantics(
                label: 'Instructions: ${medication.instructions}',
                child: Text('Instructions: ${medication.instructions!}'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
