import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/medical_record_provider.dart';
import '../models/medical_record_model.dart';
import 'add_medical_record_screen.dart';

class MedicalRecordsScreen extends StatefulWidget {
  @override
  _MedicalRecordsScreenState createState() => _MedicalRecordsScreenState();
}

class _MedicalRecordsScreenState extends State<MedicalRecordsScreen> {
  @override
  void initState() {
    super.initState();
    // Load medical records when screen initializes
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
        title: Text('Medical Records'),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: Icon(Icons.timeline),
            tooltip: 'View Timeline',
            onPressed: () {
              Navigator.pushNamed(context, '/medical-history-timeline');
            },
          ),
          IconButton(
            icon: Icon(Icons.add),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => AddMedicalRecordScreen(),
                ),
              );
            },
          ),
        ],
      ),
      body: medicalRecordProvider.isLoading && medicalRecordProvider.medicalRecords.isEmpty
          ? Center(child: CircularProgressIndicator())
          : medicalRecordProvider.medicalRecords.isEmpty
              ? _buildEmptyState()
              : _buildMedicalRecordsList(medicalRecordProvider),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.assignment_outlined,
            size: 64,
            color: Colors.grey[400],
          ),
          SizedBox(height: 16),
          Text(
            'No medical records yet',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey[600],
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Add your medical history, allergies, medications, and treatments',
            style: TextStyle(
              color: Colors.grey[500],
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => AddMedicalRecordScreen(),
                ),
              );
            },
            child: Text('Add First Record'),
          ),
        ],
      ),
    );
  }

  Widget _buildMedicalRecordsList(MedicalRecordProvider provider) {
    final categories = provider.getCategories();
    
    return ListView.builder(
      padding: EdgeInsets.all(16),
      itemCount: categories.length + 1, // +1 for the header
      itemBuilder: (context, index) {
        if (index == 0) {
          return _buildHeader();
        }
        
        final category = categories[index - 1];
        final records = provider.getRecordsByCategory(category);
        
        return _buildCategorySection(category, records);
      },
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Your Medical Records',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        SizedBox(height: 8),
        Text(
          'Manage your medical history, allergies, medications, and treatments',
          style: TextStyle(
            color: Colors.grey[600],
          ),
        ),
        SizedBox(height: 16),
      ],
    );
  }

  Widget _buildCategorySection(String category, List<MedicalRecord> records) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8.0),
          child: Text(
            _formatCategoryName(category),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Theme.of(context).primaryColor,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[300]!),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            children: records.map((record) => _buildRecordItem(record)).toList(),
          ),
        ),
        SizedBox(height: 16),
      ],
    );
  }

  Widget _buildRecordItem(MedicalRecord record) {
    return ListTile(
      title: Text(
        record.title,
        style: TextStyle(fontWeight: FontWeight.w500),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(record.description),
          SizedBox(height: 4),
          Text(
            _formatDate(record.date),
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
      trailing: IconButton(
        icon: Icon(Icons.edit, color: Colors.grey[600]),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => AddMedicalRecordScreen(record: record),
            ),
          );
        },
      ),
      isThreeLine: true,
    );
  }

  String _formatCategoryName(String category) {
    switch (category.toLowerCase()) {
      case 'allergy':
        return 'Allergies';
      case 'medication':
        return 'Medications';
      case 'treatment':
        return 'Treatments';
      case 'diagnosis':
        return 'Diagnoses';
      case 'surgery':
        return 'Surgeries';
      case 'vaccination':
        return 'Vaccinations';
      default:
        return category.capitalize();
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}

extension StringExtension on String {
  String capitalize() {
    return this[0].toUpperCase() + this.substring(1);
  }
}