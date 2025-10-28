import 'package:flutter/material.dart';
import '../../config/theme.dart';
import 'prescription_templates_screen.dart';
import 'medical_note_templates_screen.dart';
import 'analytics_dashboard_screen.dart';
import 'voice_notes_screen.dart'; // Import the new voice notes screen

class DoctorToolsScreen extends StatelessWidget {
  const DoctorToolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Doctor Tools'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: AppTheme.primaryGradient,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Streamline your workflow with these powerful tools',
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 24),
            Expanded(
              child: GridView.count(
                crossAxisCount: 2,
                mainAxisSpacing: 16,
                crossAxisSpacing: 16,
                children: [
                  _buildToolCard(
                    context,
                    'Prescription Templates',
                    'Create and manage prescription templates',
                    Icons.receipt_long,
                    AppTheme.primaryIndigo,
                    () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const PrescriptionTemplatesScreen(),
                        ),
                      );
                    },
                  ),
                  _buildToolCard(
                    context,
                    'Medical Note Templates',
                    'Standardize your documentation process',
                    Icons.note_alt,
                    AppTheme.accentCyan,
                    () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const MedicalNoteTemplatesScreen(),
                        ),
                      );
                    },
                  ),
                  _buildToolCard(
                    context,
                    'Analytics Dashboard',
                    'Track patient visits and performance metrics',
                    Icons.analytics,
                    AppTheme.successEmerald,
                    () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const AnalyticsDashboardScreen(),
                        ),
                      );
                    },
                  ),
                  _buildToolCard(
                    context,
                    'Voice Notes',
                    'Record voice notes for patient documentation',
                    Icons.mic,
                    AppTheme.primaryPurple,
                    () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const VoiceNotesScreen(),
                        ),
                      );
                    },
                  ),
                  _buildToolCard(
                    context,
                    'Quick Actions',
                    'Frequently used medical tools',
                    Icons.flash_on,
                    AppTheme.warningAmber,
                    () {
                      // TODO: Implement quick actions
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Quick actions coming soon!')),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildToolCard(
    BuildContext context,
    String title,
    String description,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  size: 32,
                  color: color,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                description,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
