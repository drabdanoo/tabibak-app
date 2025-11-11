import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/analytics_model.dart';
import '../models/appointment_model.dart';
import '../utils/constants.dart';

class AnalyticsService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Future<DoctorAnalytics> generateDoctorAnalytics(String doctorId) async {
    try {
      // Get all appointments for this doctor
      final appointmentsQuery = await _firestore
          .collection(AppConstants.appointmentsCollection)
          .where('doctorId', isEqualTo: doctorId)
          .get();

      final appointments = appointmentsQuery.docs
          .map((doc) => AppointmentModel.fromFirestore(doc))
          .toList();

      if (appointments.isEmpty) {
        return _generateEmptyAnalytics(doctorId);
      }

      // Calculate basic metrics
      final totalAppointments = appointments.length;
      final completedAppointments = appointments
          .where((apt) => apt.status.toLowerCase() == 'completed')
          .length;
      final cancelledAppointments = appointments
          .where((apt) => apt.status.toLowerCase() == 'cancelled')
          .length;
      
      // Get unique patients
      final uniquePatientIds = appointments.map((apt) => apt.patientId).toSet();
      final totalPatients = uniquePatientIds.length;

      // Calculate appointments by month (last 6 months)
      final appointmentsByMonth = _calculateAppointmentsByMonth(appointments);

      // Calculate appointments by day of week
      final appointmentsByDayOfWeek = _calculateAppointmentsByDayOfWeek(appointments);

      // Extract conditions from appointment reasons
      final conditionsCount = _extractConditionsFromReasons(appointments);

      // Calculate average appointment duration (mock for now)
      const averageAppointmentDuration = 30.0; // Default 30 minutes

      // Generate patient satisfaction (mock for now - would need separate feedback collection)
      final patientSatisfaction = _generateMockSatisfaction();

      return DoctorAnalytics(
        doctorId: doctorId,
        totalPatients: totalPatients,
        totalAppointments: totalAppointments,
        completedAppointments: completedAppointments,
        cancelledAppointments: cancelledAppointments,
        appointmentsByMonth: appointmentsByMonth,
        conditionsCount: conditionsCount,
        appointmentsByDayOfWeek: appointmentsByDayOfWeek,
        averageAppointmentDuration: averageAppointmentDuration,
        patientSatisfaction: patientSatisfaction,
        lastUpdated: DateTime.now(),
      );
    } catch (e) {
      print('Error generating analytics: $e');
      return _generateEmptyAnalytics(doctorId);
    }
  }

  Map<String, int> _calculateAppointmentsByMonth(List<AppointmentModel> appointments) {
    final Map<String, int> monthlyCount = {};
    final now = DateTime.now();

    // Initialize last 6 months
    for (int i = 5; i >= 0; i--) {
      final date = DateTime(now.year, now.month - i, 1);
      final monthKey = '${date.year}-${date.month.toString().padLeft(2, '0')}';
      monthlyCount[monthKey] = 0;
    }

    // Count appointments by month
    for (final appointment in appointments) {
      if (appointment.appointmentDate != null) {
        try {
          final appointmentDate = DateTime.parse(appointment.appointmentDate!);
          final monthKey = '${appointmentDate.year}-${appointmentDate.month.toString().padLeft(2, '0')}';
          if (monthlyCount.containsKey(monthKey)) {
            monthlyCount[monthKey] = monthlyCount[monthKey]! + 1;
          }
        } catch (e) {
          print('Error parsing appointment date: ${appointment.appointmentDate}');
        }
      }
    }

    return monthlyCount;
  }

  Map<String, int> _calculateAppointmentsByDayOfWeek(List<AppointmentModel> appointments) {
    final Map<String, int> dayCount = {
      'Monday': 0,
      'Tuesday': 0,
      'Wednesday': 0,
      'Thursday': 0,
      'Friday': 0,
      'Saturday': 0,
      'Sunday': 0,
    };

    final dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (final appointment in appointments) {
      if (appointment.appointmentDate != null) {
        try {
          final appointmentDate = DateTime.parse(appointment.appointmentDate!);
          final dayOfWeek = appointmentDate.weekday; // 1 = Monday, 7 = Sunday
          final dayName = dayNames[dayOfWeek - 1];
          dayCount[dayName] = dayCount[dayName]! + 1;
        } catch (e) {
          print('Error parsing appointment date for day calculation: ${appointment.appointmentDate}');
        }
      }
    }

    return dayCount;
  }

  Map<String, int> _extractConditionsFromReasons(List<AppointmentModel> appointments) {
    final Map<String, int> conditions = {};

    // Common medical conditions to look for in appointment reasons
    final commonConditions = {
      'headache': 'Headache',
      'fever': 'Fever',
      'cold': 'Common Cold',
      'cough': 'Cough',
      'back pain': 'Back Pain',
      'stomach': 'Stomach Issues',
      'diabetes': 'Diabetes',
      'hypertension': 'Hypertension',
      'blood pressure': 'Hypertension',
      'allergy': 'Allergies',
      'asthma': 'Asthma',
      'checkup': 'General Checkup',
      'consultation': 'General Consultation',
      'follow up': 'Follow-up',
      'followup': 'Follow-up',
    };

    for (final appointment in appointments) {
      if (appointment.reason != null && appointment.reason!.isNotEmpty) {
        final reason = appointment.reason!.toLowerCase();
        bool conditionFound = false;

        // Look for specific conditions
        for (final entry in commonConditions.entries) {
          if (reason.contains(entry.key)) {
            final conditionName = entry.value;
            conditions[conditionName] = (conditions[conditionName] ?? 0) + 1;
            conditionFound = true;
            break; // Only count one condition per appointment
          }
        }

        // If no specific condition found, categorize as "Other"
        if (!conditionFound) {
          conditions['Other'] = (conditions['Other'] ?? 0) + 1;
        }
      } else {
        // No reason provided
        conditions['General Consultation'] = (conditions['General Consultation'] ?? 0) + 1;
      }
    }

    return conditions;
  }

  Map<String, double> _generateMockSatisfaction() {
    // This would ideally come from a separate patient feedback collection
    // For now, generate reasonable mock data
    return {
      'Excellent': 4.2,
      'Good': 3.8,
      'Average': 1.5,
      'Poor': 0.5,
    };
  }

  DoctorAnalytics _generateEmptyAnalytics(String doctorId) {
    final now = DateTime.now();
    final Map<String, int> emptyMonths = {};
    
    // Initialize last 6 months with 0
    for (int i = 5; i >= 0; i--) {
      final date = DateTime(now.year, now.month - i, 1);
      final monthKey = '${date.year}-${date.month.toString().padLeft(2, '0')}';
      emptyMonths[monthKey] = 0;
    }

    return DoctorAnalytics(
      doctorId: doctorId,
      totalPatients: 0,
      totalAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      appointmentsByMonth: emptyMonths,
      conditionsCount: {},
      appointmentsByDayOfWeek: {
        'Monday': 0,
        'Tuesday': 0,
        'Wednesday': 0,
        'Thursday': 0,
        'Friday': 0,
        'Saturday': 0,
        'Sunday': 0,
      },
      averageAppointmentDuration: 0.0,
      patientSatisfaction: {
        'Excellent': 0.0,
        'Good': 0.0,
        'Average': 0.0,
        'Poor': 0.0,
      },
      lastUpdated: DateTime.now(),
    );
  }
}