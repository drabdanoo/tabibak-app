import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/firestore_service.dart';
import '../../models/appointment_model.dart';
import '../../config/theme.dart';
import '../../widgets/animated_icon_button.dart';
import '../../providers/appointment_reminder_provider.dart';
import 'dart:developer' as developer;

class ReceptionistDashboardScreen extends StatefulWidget {
  const ReceptionistDashboardScreen({super.key});

  @override
  State<ReceptionistDashboardScreen> createState() => _ReceptionistDashboardScreenState();
}

class _ReceptionistDashboardScreenState extends State<ReceptionistDashboardScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final FirestoreService _firestoreService = FirestoreService();
  String? _doctorId;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadReceptionistData();
  }

  Future<void> _loadReceptionistData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final receptionistId = authProvider.currentUser?.uid;

    if (receptionistId != null) {
      try {
        // Get receptionist document to find assigned doctorId
        final doc = await FirebaseFirestore.instance
            .collection('receptionists')
            .doc(receptionistId)
            .get();
        
        if (doc.exists) {
          setState(() {
            _doctorId = doc.data()?['doctorId'];
            _isLoading = false;
          });
        } else {
          setState(() {
            _isLoading = false;
          });
        }
      } catch (e) {
        developer.log('Error loading receptionist data: $e', name: 'ReceptionistDashboard', level: 900);
        setState(() {
          _isLoading = false;
        });
      }
    } else {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_doctorId == null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: AppTheme.errorRed),
              const SizedBox(height: 16),
              const Text('خطأ: لم يتم تعيين طبيب لهذا الحساب'),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () async {
                  await authProvider.signOut();
                  if (context.mounted) {
                    Navigator.of(context).pushReplacementNamed('/');
                  }
                },
                child: const Text('تسجيل الخروج'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppTheme.backgroundStone,
      appBar: AppBar(
        title: const Text('لوحة تحكم السكرتير'),
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
          _buildAppointmentsList(_doctorId!, 'pending'),
          _buildAppointmentsList(_doctorId!, 'confirmed'),
          _buildAppointmentsList(_doctorId!, 'completed'),
          _buildAppointmentsList(_doctorId!, 'cancelled'),
        ],
      ),
    );
  }

  Widget _buildAppointmentsList(String doctorId, String status) {
    return StreamBuilder<List<AppointmentModel>>(
      stream: _firestoreService.getDoctorAppointments(doctorId, status),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
            child: CircularProgressIndicator(),
          );
        }

        if (snapshot.hasError) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 64, color: AppTheme.errorRed),
                const SizedBox(height: 16),
                Text('خطأ: ${snapshot.error}'),
              ],
            ),
          );
        }

        final appointments = snapshot.data ?? [];

        if (appointments.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _getStatusIcon(status),
                  size: 80,
                  color: AppTheme.textSecondary.withValues(alpha: 0.3),
                ),
                const SizedBox(height: 16),
                Text(
                  _getEmptyMessage(status),
                  style: const TextStyle(
                    fontSize: 16,
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
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
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showAppointmentDetails(appointment),
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
              
              // Action Buttons (Receptionist can manage appointments)
              if (appointment.isPending) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _updateAppointmentStatus(appointment, 'confirmed'),
                        icon: const Icon(Icons.check_circle, size: 20),
                        label: const Text('تأكيد'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.successEmerald,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _updateAppointmentStatus(appointment, 'cancelled'),
                        icon: const Icon(Icons.cancel, size: 20),
                        label: const Text('إلغاء'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.errorRed,
                          side: const BorderSide(color: AppTheme.errorRed),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              
              if (appointment.isConfirmed) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _updateAppointmentStatus(appointment, 'completed'),
                        icon: const Icon(Icons.done_all, size: 20),
                        label: const Text('تم الانتهاء'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primaryIndigo,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _showEditDialog(appointment),
                        icon: const Icon(Icons.edit, size: 20),
                        label: const Text('تعديل'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.accentCyan,
                          side: const BorderSide(color: AppTheme.accentCyan),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
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

  String _getStatusText(String status) {
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

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'pending':
        return Icons.schedule;
      case 'confirmed':
        return Icons.check_circle_outline;
      case 'completed':
        return Icons.done_all;
      case 'cancelled':
        return Icons.cancel_outlined;
      default:
        return Icons.event;
    }
  }

  String _getEmptyMessage(String status) {
    switch (status) {
      case 'pending':
        return 'لا توجد مواعيد قيد الانتظار';
      case 'confirmed':
        return 'لا توجد مواعيد مؤكدة';
      case 'completed':
        return 'لا توجد مواعيد مكتملة';
      case 'cancelled':
        return 'لا توجد مواعيد ملغاة';
      default:
        return 'لا توجد مواعيد';
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
      // Get the appointment reminder provider
      final appointmentReminderProvider = 
          Provider.of<AppointmentReminderProvider>(context, listen: false);
      
      // Schedule the reminder
      await appointmentReminderProvider.scheduleAppointmentReminder(appointment);
    } catch (e) {
      developer.log('Error scheduling appointment reminder: $e', name: 'ReceptionistDashboard', level: 900);
    }
  }

  void _showEditDialog(AppointmentModel appointment) {
    // TODO: Implement edit appointment dialog
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('قريباً: تعديل الموعد')),
    );
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
                  color: AppTheme.textSecondary.withValues(alpha: 0.3),
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
                  backgroundColor: AppTheme.errorRed.withValues(alpha: 0.1),
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
                  backgroundColor: AppTheme.accentCyan.withValues(alpha: 0.1),
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
