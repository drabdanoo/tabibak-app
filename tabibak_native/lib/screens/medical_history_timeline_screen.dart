import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:timeline_tile/timeline_tile.dart';
import '../providers/auth_provider.dart';
import '../providers/medical_record_provider.dart';
import '../models/medical_record_model.dart';

class MedicalHistoryTimelineScreen extends StatefulWidget {
  const MedicalHistoryTimelineScreen({super.key});

  @override
  _MedicalHistoryTimelineScreenState createState() => _MedicalHistoryTimelineScreenState();
}

class _MedicalHistoryTimelineScreenState extends State<MedicalHistoryTimelineScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final medicalRecordProvider = Provider.of<MedicalRecordProvider>(context, listen: false);
      medicalRecordProvider.loadMedicalRecords(authProvider.currentUser!.uid);
    });
  }

  @override
  Widget build(BuildContext context) {
    final medicalRecordProvider = Provider.of<MedicalRecordProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Medical History Timeline'),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
      ),
      body: medicalRecordProvider.isLoading && medicalRecordProvider.medicalRecords.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : medicalRecordProvider.medicalRecords.isEmpty
              ? _buildEmptyState()
              : _buildTimeline(medicalRecordProvider.medicalRecords),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.timeline,
            size: 64,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            'No medical records yet',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Your medical history timeline will appear here',
            style: TextStyle(
              color: Colors.grey[500],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildTimeline(List<MedicalRecord> records) {
    // Sort records by date (newest first)
    final sortedRecords = List<MedicalRecord>.from(records)
      ..sort((a, b) => b.date.compareTo(a.date));

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: sortedRecords.length,
      itemBuilder: (context, index) {
        final record = sortedRecords[index];
        final isFirst = index == 0;
        final isLast = index == sortedRecords.length - 1;

        return TimelineTile(
          alignment: TimelineAlign.manual,
          lineXY: 0.2,
          isFirst: isFirst,
          isLast: isLast,
          indicatorStyle: IndicatorStyle(
            width: 20,
            color: _getCategoryColor(record.category),
            indicatorXY: 0.2,
            padding: const EdgeInsets.all(6),
          ),
          endChild: _buildTimelineContent(record),
          beforeLineStyle: LineStyle(
            color: _getCategoryColor(record.category),
            thickness: 3,
          ),
        );
      },
    );
  }

  Widget _buildTimelineContent(MedicalRecord record) {
    return Container(
      margin: const EdgeInsets.only(left: 16, bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
        BoxShadow(
        color: Colors.black.withValues(alpha: 0.1),
        blurRadius: 4,
        offset: const Offset(0, 2),
        ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                _formatCategoryName(record.category),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: _getCategoryColor(record.category),
                ),
              ),
              const Spacer(),
              Text(
                _formatDate(record.date),
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            record.title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            record.description,
            style: const TextStyle(
              color: Colors.grey,
            ),
          ),
          if (record.doctorName != null && record.doctorName!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Doctor: ${record.doctorName}',
              style: const TextStyle(
                fontSize: 12,
                color: Colors.grey,
              ),
            ),
          ],
          if (record.hospitalName != null && record.hospitalName!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Hospital: ${record.hospitalName}',
              style: const TextStyle(
                fontSize: 12,
                color: Colors.grey,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Color _getCategoryColor(String category) {
    switch (category.toLowerCase()) {
      case 'allergy':
        return Colors.red;
      case 'medication':
        return Colors.blue;
      case 'treatment':
        return Colors.green;
      case 'diagnosis':
        return Colors.orange;
      case 'surgery':
        return Colors.purple;
      case 'vaccination':
        return Colors.teal;
      default:
        return Colors.grey;
    }
  }

  String _formatCategoryName(String category) {
    switch (category.toLowerCase()) {
      case 'allergy':
        return 'ALLERGY';
      case 'medication':
        return 'MEDICATION';
      case 'treatment':
        return 'TREATMENT';
      case 'diagnosis':
        return 'DIAGNOSIS';
      case 'surgery':
        return 'SURGERY';
      case 'vaccination':
        return 'VACCINATION';
      default:
        return category.toUpperCase();
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}
