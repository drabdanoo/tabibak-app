import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:developer' as developer;
import '../../providers/auth_provider.dart';
import '../../services/firestore_service.dart';
import '../../models/appointment_model.dart';
import '../../config/theme.dart';
import 'create_prescription_screen.dart';
import 'doctor_tools_screen.dart';
import '../../widgets/animated_button.dart';
import '../../widgets/animated_card.dart';
import '../../widgets/animated_icon_button.dart';
import '../../widgets/empty_state.dart';
import '../../providers/appointment_reminder_provider.dart';

class DoctorAppointmentCard extends StatelessWidget {
  final AppointmentModel appointment;
  final VoidCallback onTap;

  const DoctorAppointmentCard({
    Key? key,
    required this.appointment,
    required this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Patient Info
              Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: AppTheme.primaryGradient,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.person,
                      color: Colors.white,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          appointment.patientName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(
                              Icons.phone,
                              size: 16,
                              color: AppTheme.textSecondary,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              appointment.patientPhone,
                              style: const TextStyle(
                                fontSize: 14,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  _buildStatusBadge(appointment.status),
                ],
              ),
              
              const Divider(height: 24),
              
              // Appointment Details
              _buildInfoRow(
                Icons.calendar_today,
                'التاريخ',
                appointment.appointmentDate ?? 'غير محدد',
              ),
              const SizedBox(height: 12),
              _buildInfoRow(
                Icons.access_time,
                'الوقت',
                appointment.appointmentTime ?? 'غير محدد',
              ),
              
              if (appointment.reason != null && appointment.reason!.isNotEmpty) ...[
                const SizedBox(height: 12),
                _buildInfoRow(
                  Icons.medical_services,
                  'السبب',
                  appointment.reason!,
                ),
              ],
              
              // Action Buttons
              if (appointment.isPending) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: AnimatedButton(
                        onPressed: () => _handleUpdateStatus(context, 'confirmed'),
                        backgroundColor: AppTheme.successEmerald,
                        child: const Text('تأكيد'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: AnimatedButton(
                        onPressed: () => _handleUpdateStatus(context, 'cancelled'),
                        backgroundColor: AppTheme.errorRed,
                        child: const Text('إلغاء'),
                      ),
                    ),
                  ],
                ),
              ],
              
              if (appointment.isConfirmed) ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: AnimatedButton(
                    onPressed: () => _handleUpdateStatus(context, 'completed'),
                    backgroundColor: AppTheme.primaryIndigo,
                    child: const Text('تم الانتهاء'),
                  ),
                ),
              ],
              
              if (appointment.isCompleted) ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: AnimatedButton(
                    onPressed: () => _handleCreatePrescription(context),
                    backgroundColor: AppTheme.primaryIndigo,
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.medication, size: 20),
                        SizedBox(width: 8),
                        Text('Write Prescription'),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppTheme.primaryIndigo),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppTheme.textSecondary,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              color: AppTheme.textPrimary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    IconData icon;
    
    switch (status) {
      case 'pending':
        color = AppTheme.warningAmber;
        icon = Icons.schedule;
        break;
      case 'confirmed':
        color = AppTheme.accentCyan;
        icon = Icons.check_circle;
        break;
      case 'completed':
        color = AppTheme.successEmerald;
        icon = Icons.done_all;
        break;
      case 'cancelled':
        color = AppTheme.errorRed;
        icon = Icons.cancel;
        break;
      default:
        color = AppTheme.textSecondary;
        icon = Icons.help;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 4),
          Text(
            _getStatusText(status),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  String _getStatusText(String status, {bool english = false}) {
    if (english) {
      switch (status) {
        case 'pending':
          return 'Pending';
        case 'confirmed':
          return 'Confirmed';
        case 'completed':
          return 'Completed';
        case 'cancelled':
          return 'Cancelled';
        default:
          return status;
      }
    } else {
      switch (status) {
        case 'pending':
          return 'انتظار';
        case 'confirmed':
          return 'مؤكد';
        case 'completed':
          return 'مكتمل';
        case 'cancelled':
          return 'ملغى';
        default:
          return status;
      }
    }
  }

  void _handleUpdateStatus(BuildContext context, String newStatus) {
    // Call the parent widget's update method through callback or provider
    final parentState = context.findAncestorStateOfType<_DoctorDashboardScreenState>();
    parentState?._updateAppointmentStatus(appointment, newStatus);
  }

  void _handleCreatePrescription(BuildContext context) {
    // Call the parent widget's create prescription method
    final parentState = context.findAncestorStateOfType<_DoctorDashboardScreenState>();
    parentState?._createPrescription(appointment);
  }
}

class DoctorDashboardScreen extends StatefulWidget {
  const DoctorDashboardScreen({super.key});

  @override
  State<DoctorDashboardScreen> createState() => _DoctorDashboardScreenState();
}

class _DoctorDashboardScreenState extends State<DoctorDashboardScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final FirestoreService _firestoreService = FirestoreService();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final doctorId = authProvider.currentUser?.uid;

    if (doctorId == null) {
      return const Scaffold(
        body: Center(child: Text('خطأ: لم يتم تسجيل الدخول')),
      );
    }

    return Scaffold(
      backgroundColor: AppTheme.backgroundStone,
      appBar: AppBar(
        title: const Text('لوحة تحكم الطبيب'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: AppTheme.primaryGradient,
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(text: 'قيد الانتظار'),
            Tab(text: 'مؤكدة'),
            Tab(text: 'مكتملة'),
            Tab(text: 'ملغاة'),
          ],
        ),
        actions: [
          AnimatedIconButton(
            icon: Icons.build,
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const DoctorToolsScreen()),
              );
            },
            tooltip: 'Doctor Tools',
          ),
          AnimatedIconButton(
            icon: Icons.logout,
            onPressed: () async {
              await authProvider.signOut();
              if (context.mounted) {
                Navigator.of(context).pushReplacementNamed('/');
              }
            },
            tooltip: 'Logout',
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildAppointmentsList(doctorId, 'pending'),
          _buildAppointmentsList(doctorId, 'confirmed'),
          _buildAppointmentsList(doctorId, 'completed'),
          _buildAppointmentsList(doctorId, 'cancelled'),
        ],
      ),
    );
  }

  Widget _buildAppointmentsList(String doctorId, String status) {
    return StreamBuilder<List<AppointmentModel>>(
      stream: _firestoreService.getDoctorAppointments(doctorId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
            child: CircularProgressIndicator(),
          );
        }

        if (snapshot.hasError) {
          return Center(
            child: EmptyState(
              title: 'Error Loading Appointments',
              message: 'There was an error loading your appointments. Please try again later.',
              icon: Icons.error_outline,
              onRetry: () => setState(() {}),
              retryText: 'Retry',
            ),
          );
        }

        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return Center(
            child: EmptyState(
              title: 'No Appointments',
              message: 'You don\'t have any appointments yet. When patients book appointments, they will appear here.',
              icon: Icons.calendar_today,
            ),
          );
        }

        final appointments = snapshot.data!
            .where((appointment) => appointment.status == status)
            .toList();

        if (appointments.isEmpty) {
          return Center(
            child: EmptyState(
              title: 'No ${_getStatusText(status, english: true)} Appointments',
              message: 'You don\'t have any ${_getStatusText(status, english: true).toLowerCase()} appointments at the moment.',
              icon: Icons.calendar_today,
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: appointments.length,
          itemBuilder: (context, index) {
            return _buildAppointmentCard(appointments[index]);
          },
        );
      },
    );
  }

  Widget _buildAppointmentCard(AppointmentModel appointment) {
    return AnimatedCard(
      onTap: () => _showAppointmentDetails(appointment),
      child: DoctorAppointmentCard(
        appointment: appointment,
        onTap: () => _showAppointmentDetails(appointment),
      ),
    );
  }

  void _createPrescription(AppointmentModel appointment) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreatePrescriptionScreen(appointment: appointment),
      ),
    );

    // Refresh the appointments if a prescription was created
    if (result == true) {
      setState(() {
        // This will trigger a rebuild and refresh the data
      });
    }
  }

  String _getStatusText(String status, {bool english = false}) {
    if (english) {
      switch (status) {
        case 'pending':
          return 'Pending';
        case 'confirmed':
          return 'Confirmed';
        case 'completed':
          return 'Completed';
        case 'cancelled':
          return 'Cancelled';
        default:
          return status;
      }
    } else {
      switch (status) {
        case 'pending':
          return 'انتظار';
        case 'confirmed':
          return 'مؤكد';
        case 'completed':
          return 'مكتمل';
        case 'cancelled':
          return 'ملغى';
        default:
          return status;
      }
    }
  }

  Future<void> _updateAppointmentStatus(AppointmentModel appointment, String newStatus) async {
    try {
      await _firestoreService.updateAppointmentStatus(appointment.id, newStatus);
      
      // Schedule reminder if appointment is confirmed
      if (newStatus == 'confirmed') {
        _scheduleAppointmentReminder(appointment);
      }
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('تم تحديث حالة الموعد إلى: ${_getStatusText(newStatus)}'),
            backgroundColor: AppTheme.successEmerald,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('خطأ: $e'),
            backgroundColor: AppTheme.errorRed,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    }
  }

  // Schedule appointment reminder
  Future<void> _scheduleAppointmentReminder(AppointmentModel appointment) async {
    try {
      final appointmentReminderProvider = AppointmentReminderProvider();
      
      // Schedule the reminder
      await appointmentReminderProvider.scheduleAppointmentReminder(appointment);
    } catch (e) {
      developer.log('Error scheduling appointment reminder: $e', name: 'DoctorDashboard', level: 900);
    }
  }

  void _showAppointmentDetails(AppointmentModel appointment) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: AppTheme.cardWhite,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.textSecondary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),
            
            // Title
            const Text(
              'تفاصيل الموعد',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 24),
            
            // Patient Details
            _buildDetailRow('اسم المريض', appointment.patientName),
            _buildDetailRow('رقم الهاتف', appointment.patientPhone),
            _buildDetailRow('التاريخ', appointment.appointmentDate ?? 'غير محدد'),
            _buildDetailRow('الوقت', appointment.appointmentTime ?? 'غير محدد'),
            _buildDetailRow('الحالة', appointment.statusArabic),
            
            if (appointment.reason != null && appointment.reason!.isNotEmpty)
              _buildDetailRow('السبب', appointment.reason!),
            
            if (appointment.notes != null && appointment.notes!.isNotEmpty)
              _buildDetailRow('ملاحظات', appointment.notes!),
            
            if (appointment.allergies != null && appointment.allergies!.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text(
                'الحساسية:',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: appointment.allergies!.map((allergy) => Chip(
                  label: Text(allergy),
                  backgroundColor: AppTheme.errorRed.withOpacity(0.1),
                  labelStyle: const TextStyle(color: AppTheme.errorRed),
                )).toList(),
              ),
            ],
            
            if (appointment.medications != null && appointment.medications!.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text(
                'الأدوية الحالية:',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: appointment.medications!.map((med) => Chip(
                  label: Text(med),
                  backgroundColor: AppTheme.accentCyan.withOpacity(0.1),
                  labelStyle: const TextStyle(color: AppTheme.accentCyan),
                )).toList(),
              ),
            ],
            
            const SizedBox(height: 24),
            
            // Close button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('إغلاق'),
              ),
            ),
            
            SizedBox(height: MediaQuery.of(context).viewInsets.bottom),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              '$label:',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppTheme.textSecondary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}