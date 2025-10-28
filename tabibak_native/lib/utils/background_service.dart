import 'dart:async';
import 'dart:developer' as developer;
import '../models/appointment_model.dart';
import '../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../services/firestore_service.dart';
import '../services/notification_service.dart';

class BackgroundService {
  static final BackgroundService _instance = BackgroundService._internal();
  factory BackgroundService() => _instance;
  BackgroundService._internal();

  final FirestoreService _firestoreService = FirestoreService();
  final NotificationService _notificationService = NotificationService();
  Timer? _timer;

  // Start background service
  void startBackgroundService(AuthProvider authProvider) {
    // Cancel any existing timer
    _timer?.cancel();
    
    // Run every hour
    _timer = Timer.periodic(Duration(hours: 1), (timer) {
      _checkAndScheduleReminders(authProvider);
    });
    
    // Also run immediately when starting
    _checkAndScheduleReminders(authProvider);
  }

  // Stop background service
  void stopBackgroundService() {
    _timer?.cancel();
    _timer = null;
  }

  // Check appointments and schedule reminders
  Future<void> _checkAndScheduleReminders(AuthProvider authProvider) async {
    try {
      // Only proceed if user is authenticated
      if (authProvider.currentUser == null || authProvider.userModel == null) {
        return;
      }

      final UserModel user = authProvider.userModel!;
      final String userId = user.id;
      final String? userRole = authProvider.userRole;

      // Only proceed for patients and doctors
      if (userRole != 'patient' && userRole != 'doctor') {
        return;
      }

      // Get upcoming appointments
      Stream<List<AppointmentModel>> appointmentStream;
      
      if (userRole == 'doctor') {
        appointmentStream = _firestoreService.getUpcomingDoctorAppointments(userId);
      } else {
        appointmentStream = _firestoreService.getUpcomingPatientAppointments(userId);
      }

      // Listen to appointments and schedule reminders
      appointmentStream.listen((appointments) {
        _scheduleRemindersForAppointments(appointments);
      });
    } catch (e) {
      developer.log('Error checking and scheduling reminders: $e', name: 'BackgroundService', level: 900);
    }
  }

  // Schedule reminders for appointments
  Future<void> _scheduleRemindersForAppointments(List<AppointmentModel> appointments) async {
    try {
      final now = DateTime.now();
      
      for (var appointment in appointments) {
        // Only schedule reminders for confirmed upcoming appointments
        if (appointment.status == 'confirmed') {
          final appointmentDateTime = _parseAppointmentDateTime(
            appointment.appointmentDate, 
            appointment.appointmentTime
          );
          
          // Check if appointment is in the future
          if (appointmentDateTime != null && appointmentDateTime.isAfter(now)) {
            // Check if we should schedule a reminder (1 hour before appointment)
            final reminderTime = appointmentDateTime.subtract(Duration(hours: 1));
            
            if (reminderTime.isAfter(now)) {
              // Schedule the reminder
              await _notificationService.scheduleAppointmentReminder(appointment);
            }
          }
        }
      }
    } catch (e) {
      developer.log('Error scheduling reminders for appointments: $e', name: 'BackgroundService', level: 900);
    }
  }

  // Parse appointment date and time
  DateTime? _parseAppointmentDateTime(String? dateStr, String? timeStr) {
    if (dateStr == null || timeStr == null) return null;
    
    try {
      // Expected format: date = "YYYY-MM-DD", time = "HH:MM"
      final dateParts = dateStr.split('-');
      final timeParts = timeStr.split(':');
      
      if (dateParts.length == 3 && timeParts.length == 2) {
        final year = int.parse(dateParts[0]);
        final month = int.parse(dateParts[1]);
        final day = int.parse(dateParts[2]);
        final hour = int.parse(timeParts[0]);
        final minute = int.parse(timeParts[1]);
        
        return DateTime(year, month, day, hour, minute);
      }
    } catch (e) {
      developer.log('Error parsing appointment date/time: $e', name: 'BackgroundService', level: 900);
    }
    return null;
  }
}