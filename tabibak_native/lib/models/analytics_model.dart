import 'package:cloud_firestore/cloud_firestore.dart';

class DoctorAnalytics {
  final String doctorId;
  final int totalPatients;
  final int totalAppointments;
  final int completedAppointments;
  final int cancelledAppointments;
  final Map<String, int> appointmentsByMonth;
  final Map<String, int> conditionsCount;
  final Map<String, int> appointmentsByDayOfWeek;
  final double averageAppointmentDuration;
  final Map<String, double> patientSatisfaction;
  final DateTime lastUpdated;

  DoctorAnalytics({
    required this.doctorId,
    required this.totalPatients,
    required this.totalAppointments,
    required this.completedAppointments,
    required this.cancelledAppointments,
    required this.appointmentsByMonth,
    required this.conditionsCount,
    required this.appointmentsByDayOfWeek,
    required this.averageAppointmentDuration,
    required this.patientSatisfaction,
    required this.lastUpdated,
  });

  factory DoctorAnalytics.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return DoctorAnalytics(
      doctorId: doc.id,
      totalPatients: data['totalPatients'] ?? 0,
      totalAppointments: data['totalAppointments'] ?? 0,
      completedAppointments: data['completedAppointments'] ?? 0,
      cancelledAppointments: data['cancelledAppointments'] ?? 0,
      appointmentsByMonth: Map<String, int>.from(data['appointmentsByMonth'] ?? {}),
      conditionsCount: Map<String, int>.from(data['conditionsCount'] ?? {}),
      appointmentsByDayOfWeek: Map<String, int>.from(data['appointmentsByDayOfWeek'] ?? {}),
      averageAppointmentDuration: _parseDouble(data['averageAppointmentDuration']) ?? 0.0,
      patientSatisfaction: _parseSatisfactionMap(data['patientSatisfaction']),
      lastUpdated: (data['lastUpdated'] as Timestamp).toDate(),
    );
  }

  // Helper method to safely parse double values
  static double? _parseDouble(dynamic value) {
    if (value == null) return null;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) {
      try {
        return double.parse(value);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // Helper method to safely parse satisfaction map
  static Map<String, double> _parseSatisfactionMap(dynamic value) {
    if (value == null) return {};
    if (value is Map<String, dynamic>) {
      final Map<String, double> result = {};
      value.forEach((key, val) {
        final parsedValue = _parseDouble(val);
        if (parsedValue != null) {
          result[key] = parsedValue;
        }
      });
      return result;
    }
    return {};
  }

  Map<String, dynamic> toMap() {
    return {
      'totalPatients': totalPatients,
      'totalAppointments': totalAppointments,
      'completedAppointments': completedAppointments,
      'cancelledAppointments': cancelledAppointments,
      'appointmentsByMonth': appointmentsByMonth,
      'conditionsCount': conditionsCount,
      'appointmentsByDayOfWeek': appointmentsByDayOfWeek,
      'averageAppointmentDuration': averageAppointmentDuration,
      'patientSatisfaction': patientSatisfaction,
      'lastUpdated': lastUpdated,
    };
  }

  // Computed properties
  double get completionRate => totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;

  double get cancellationRate => totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0;

  List<String> get topConditions {
    final sortedEntries = conditionsCount.entries.toList();
    sortedEntries.sort((a, b) => b.value.compareTo(a.value));
    return sortedEntries.take(5).map((e) => e.key).toList();
  }

  int get appointmentsThisMonth {
    final now = DateTime.now();
    final monthKey = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    return appointmentsByMonth[monthKey] ?? 0;
  }

  int get appointmentsLastMonth {
    final lastMonth = DateTime.now().subtract(const Duration(days: 30));
    final monthKey = '${lastMonth.year}-${lastMonth.month.toString().padLeft(2, '0')}';
    return appointmentsByMonth[monthKey] ?? 0;
  }
}

class AnalyticsDataPoint {
  final String label;
  final double value;
  final String? color;

  AnalyticsDataPoint({
    required this.label,
    required this.value,
    this.color,
  });
}

class MonthlyStats {
  final String month;
  final int appointments;
  final int patients;
  final int completed;
  final int cancelled;

  MonthlyStats({
    required this.month,
    required this.appointments,
    required this.patients,
    required this.completed,
    required this.cancelled,
  });

  factory MonthlyStats.fromMap(Map<String, dynamic> map) {
    return MonthlyStats(
      month: map['month'] ?? '',
      appointments: map['appointments'] ?? 0,
      patients: map['patients'] ?? 0,
      completed: map['completed'] ?? 0,
      cancelled: map['cancelled'] ?? 0,
    );
  }
}
