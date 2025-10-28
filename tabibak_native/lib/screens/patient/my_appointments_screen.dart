import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/firestore_service.dart';
import '../../models/appointment_model.dart';
import '../../config/theme.dart';
import 'appointment_details_screen.dart';

class MyAppointmentsScreen extends StatefulWidget {
  const MyAppointmentsScreen({super.key});

  @override
  State<MyAppointmentsScreen> createState() => _MyAppointmentsScreenState();
}

class _MyAppointmentsScreenState extends State<MyAppointmentsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  List<AppointmentModel> _filterAppointments(List<AppointmentModel> appointments, int tabIndex) {
    final now = DateTime.now();
    
    switch (tabIndex) {
      case 0: // All
        return appointments;
      case 1: // Upcoming
        return appointments.where((apt) {
          if (apt.appointmentDate == null) return false;
          try {
            final aptDate = DateTime.parse(apt.appointmentDate!);
            return aptDate.isAfter(now.subtract(const Duration(days: 1))) && 
                   (apt.isPending || apt.isConfirmed);
          } catch (e) {
            return false;
          }
        }).toList();
      case 2: // Past
        return appointments.where((apt) {
          if (apt.appointmentDate == null) return apt.isCompleted || apt.isCancelled;
          try {
            final aptDate = DateTime.parse(apt.appointmentDate!);
            return aptDate.isBefore(now) || apt.isCompleted || apt.isCancelled;
          } catch (e) {
            return apt.isCompleted || apt.isCancelled;
          }
        }).toList();
      default:
        return appointments;
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.currentUser;

    if (user == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('مواعيدي'),
        ),
        body: const Center(
          child: Text('يجب تسجيل الدخول أولاً'),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('مواعيدي'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(text: 'الكل'),
            Tab(text: 'القادمة'),
            Tab(text: 'السابقة'),
          ],
        ),
      ),
      body: StreamBuilder<List<AppointmentModel>>(
        stream: FirestoreService().getPatientAppointments(user.uid),
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
                  const Icon(
                    Icons.error_outline,
                    size: 60,
                    color: AppTheme.errorRed,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'حدث خطأ في تحميل المواعيد',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            );
          }

          final allAppointments = snapshot.data ?? [];

          return TabBarView(
            controller: _tabController,
            children: List.generate(3, (tabIndex) {
              final appointments = _filterAppointments(allAppointments, tabIndex);
              
              if (appointments.isEmpty) {
                return _buildEmptyState(tabIndex);
              }

              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: appointments.length,
                itemBuilder: (context, index) {
                  final appointment = appointments[index];
                  return _AppointmentCard(appointment: appointment);
                },
              );
            }),
          );
        },
      ),
    );
  }

  Widget _buildEmptyState(int tabIndex) {
    String message;
    IconData icon;
    
    switch (tabIndex) {
      case 1:
        message = 'لا توجد مواعيد قادمة';
        icon = Icons.event_available;
        break;
      case 2:
        message = 'لا توجد مواعيد سابقة';
        icon = Icons.history;
        break;
      default:
        message = 'لا توجد مواعيد';
        icon = Icons.calendar_today;
    }

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            size: 80,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 24),
          Text(
            message,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.grey[600],
            ),
          ),
          if (tabIndex == 0) ...[
            const SizedBox(height: 12),
            Text(
              'احجز موعدك الأول مع أحد الأطباء',
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[500],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AppointmentCard extends StatelessWidget {
  final AppointmentModel appointment;

  const _AppointmentCard({required this.appointment});

  Color _getStatusColor() {
    switch (appointment.status) {
      case 'confirmed':
        return AppTheme.successGreen;
      case 'completed':
        return Colors.blue;
      case 'cancelled':
        return AppTheme.errorRed;
      default:
        return AppTheme.warningOrange;
    }
  }

  IconData _getStatusIcon() {
    switch (appointment.status) {
      case 'confirmed':
        return Icons.check_circle;
      case 'completed':
        return Icons.done_all;
      case 'cancelled':
        return Icons.cancel;
      default:
        return Icons.schedule;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => AppointmentDetailsScreen(appointment: appointment),
            ),
          );
        },
        borderRadius: BorderRadius.circular(20),
        child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Doctor Name & Status
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'د. ${appointment.doctorName ?? "غير محدد"}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: _getStatusColor().withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _getStatusIcon(),
                        size: 16,
                        color: _getStatusColor(),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        appointment.statusArabic,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: _getStatusColor(),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 8),

            // Specialty
            if (appointment.doctorSpecialty != null)
              Text(
                appointment.doctorSpecialty!,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
              ),

            const Divider(height: 24),

            // Date & Time
            Row(
              children: [
                Icon(
                  Icons.calendar_today,
                  size: 16,
                  color: Colors.grey[600],
                ),
                const SizedBox(width: 8),
                Text(
                  appointment.appointmentDate ?? 'غير محدد',
                  style: const TextStyle(fontSize: 14),
                ),
                const SizedBox(width: 16),
                Icon(
                  Icons.access_time,
                  size: 16,
                  color: Colors.grey[600],
                ),
                const SizedBox(width: 8),
                Text(
                  appointment.appointmentTime ?? 'غير محدد',
                  style: const TextStyle(fontSize: 14),
                ),
              ],
            ),

            // Reason
            if (appointment.reason != null && appointment.reason!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.note,
                      size: 16,
                      color: Colors.grey[600],
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        appointment.reason!,
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Actions
            if (appointment.isPending || appointment.isConfirmed) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  if (appointment.isPending || appointment.isConfirmed)
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          _showCancelDialog(context);
                        },
                        icon: const Icon(Icons.cancel_outlined, size: 18),
                        label: const Text('إلغاء'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.errorRed,
                          side: const BorderSide(color: AppTheme.errorRed),
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

  void _showCancelDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('إلغاء الموعد'),
        content: const Text('هل أنت متأكد من إلغاء هذا الموعد؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('لا'),
          ),
          ElevatedButton(
            onPressed: () async {
              try {
                await FirestoreService().cancelAppointment(appointment.id);
                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('تم إلغاء الموعد بنجاح'),
                      backgroundColor: AppTheme.successGreen,
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('فشل إلغاء الموعد: ${e.toString()}'),
                      backgroundColor: AppTheme.errorRed,
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorRed,
            ),
            child: const Text('نعم، إلغاء'),
          ),
        ],
      ),
    );
  }
}
