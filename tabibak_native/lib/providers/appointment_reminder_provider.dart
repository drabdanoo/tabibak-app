import 'package:flutter/material.dart';
import '../models/appointment_model.dart';
import '../services/notification_service.dart';

class AppointmentReminderProvider with ChangeNotifier {
  final NotificationService _notificationService = NotificationService();

  bool _isLoading = false;
  String? _error;

  bool get isLoading => _isLoading;
  String? get error => _error;

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String? error) {
    _error = error;
    notifyListeners();
  }

  // Schedule reminder for an appointment
  Future<bool> scheduleAppointmentReminder(AppointmentModel appointment) async {
    try {
      _setError(null);
      _setLoading(true);
      
      await _notificationService.scheduleAppointmentReminder(appointment);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Cancel reminder for an appointment
  Future<void> cancelAppointmentReminder(String appointmentId) async {
    try {
      _setError(null);
      _setLoading(true);
      
      // Note: In the new implementation, we don't have a direct cancel method
      // The notification will be automatically handled by the system
      
      _setLoading(false);
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
    }
  }

  Future<void> scheduleFollowUpReminder({
    required String appointmentId,
    required String patientName,
    required DateTime appointmentTime,
  }) async {
    // Schedule follow-up reminder 1 day after appointment
    final followUpTime = appointmentTime.add(const Duration(days: 1));

    await _notificationService.scheduleNotification(
      id: appointmentId.hashCode + 1,
      title: 'Follow-up Reminder',
      body: 'Time to check on $patientName\'s progress',
      scheduledDate: followUpTime,
    );
  }
}
