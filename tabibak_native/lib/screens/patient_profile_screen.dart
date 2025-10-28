import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/medical_record_provider.dart';
import '../widgets/medical_records_summary.dart';
import '../widgets/allergies_list.dart';
import '../widgets/medications_list.dart';
import '../widgets/medical_history_summary.dart';
import '../widgets/animated_list_tile.dart';
import '../widgets/animated_card.dart';
import '../widgets/page_transition.dart';
import 'patient/medical_history_screen.dart';
import 'notification_settings_screen.dart';

class PatientProfileScreen extends StatefulWidget {
  @override
  _PatientProfileScreenState createState() => _PatientProfileScreenState();
}

class _PatientProfileScreenState extends State<PatientProfileScreen> {
  void _showMedicalHistory(BuildContext context) {
    Navigator.push(
      context,
      PageTransition(
        page: MedicalHistoryScreen(),
      ),
    );
  }

  void _showNotificationSettings(BuildContext context) {
    Navigator.push(
      context,
      PageTransition(
        page: NotificationSettingsScreen(),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    // Load medical records when screen initializes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final medicalRecordProvider = Provider.of<MedicalRecordProvider>(context, listen: false);
      medicalRecordProvider.loadMedicalRecords(authProvider.userModel!.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text('My Profile'),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Profile header
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 30,
                        child: Icon(Icons.person, size: 30),
                      ),
                      SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              authProvider.userModel?.name ?? 'Patient',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              authProvider.userModel?.email ?? '',
                              style: TextStyle(
                                color: Colors.grey[600],
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              authProvider.userModel?.phone ?? '',
                              style: TextStyle(
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              
              SizedBox(height: 20),
              
              // Allergies section (if any)
              AllergiesList(),
              
              // Medications section (if any)
              MedicationsList(),
              
              // Medical records summary
              MedicalRecordsSummary(),
              
              SizedBox(height: 20),
              
              // Medical history summary
              MedicalHistorySummary(),
              
              SizedBox(height: 20),

              // Additional options
              AnimatedCard(
                child: AnimatedListTile(
                  leading: Icon(Icons.person),
                  title: Text('Personal Information'),
                  subtitle: Text('Manage your profile details'),
                  trailing: Icon(Icons.arrow_forward_ios),
                  onTap: () {
                    // TODO: Implement personal info editing
                  },
                ),
              ),
              Divider(),
              AnimatedCard(
                child: AnimatedListTile(
                  leading: Icon(Icons.medical_services),
                  title: Text('Medical History'),
                  subtitle: Text('Manage allergies, medications, and chronic conditions'),
                  trailing: Icon(Icons.arrow_forward_ios),
                  onTap: () => _showMedicalHistory(context),
                ),
              ),
              Divider(),
              AnimatedCard(
                child: AnimatedListTile(
                  leading: Icon(Icons.notifications),
                  title: Text('Notification Settings'),
                  subtitle: Text('Manage appointment reminders and notifications'),
                  trailing: Icon(Icons.arrow_forward_ios),
                  onTap: () => _showNotificationSettings(context),
                ),
              ),
              Divider(),
              AnimatedCard(
                child: AnimatedListTile(
                  leading: Icon(Icons.lock),
                  title: Text('Privacy Settings'),
                  subtitle: Text('Manage your privacy preferences'),
                  trailing: Icon(Icons.arrow_forward_ios),
                  onTap: () {
                    // TODO: Implement privacy settings
                  },
                ),
              ),

            ],
          ),
        ),
      ),
    );
  }
}