import 'package:cloud_firestore/cloud_firestore.dart';

class AppointmentModel {
  final String id;
  final String doctorId;
  final String patientId;
  final String? userId;
  final String patientName;
  final String patientPhone;
  final String? doctorName;
  final String? doctorSpecialty;
  final String? appointmentDate;
  final String? appointmentTime;
  final String status; // pending, confirmed, completed, cancelled
  final String? reason;
  final String? notes;
  final List<String>? allergies;
  final List<String>? medications;
  final DateTime createdAt;
  final DateTime? updatedAt;

  AppointmentModel({
    required this.id,
    required this.doctorId,
    required this.patientId,
    this.userId,
    required this.patientName,
    required this.patientPhone,
    this.doctorName,
    this.doctorSpecialty,
    this.appointmentDate,
    this.appointmentTime,
    required this.status,
    this.reason,
    this.notes,
    this.allergies,
    this.medications,
    required this.createdAt,
    this.updatedAt,
  });

  // Helper method to safely parse string lists from Firestore
  static List<String>? _parseStringList(dynamic value) {
    if (value == null) return null;
    if (value is List) {
      return value.map((item) => item?.toString() ?? '').toList();
    }
    if (value is String) {
      // If it's a single string, treat it as a list with one item
      return value.isEmpty ? null : [value];
    }
    return null;
  }

  factory AppointmentModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return AppointmentModel(
      id: doc.id,
      doctorId: data['doctorId'] ?? '',
      patientId: data['patientId'] ?? data['userId'] ?? '',
      userId: data['userId'],
      patientName: data['patientName'] ?? '',
      patientPhone: data['patientPhone'] ?? '',
      doctorName: data['doctorName'],
      doctorSpecialty: data['doctorSpecialty'],
      appointmentDate: data['appointmentDate'],
      appointmentTime: data['appointmentTime'],
      status: data['status'] ?? 'pending',
      reason: data['reason'],
      notes: data['notes'],
      allergies: _parseStringList(data['allergies']),
      medications: _parseStringList(data['medications']),
      createdAt: data['createdAt']?.toDate() ?? DateTime.now(),
      updatedAt: data['updatedAt']?.toDate(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'doctorId': doctorId,
      'patientId': patientId,
      'userId': userId,
      'patientName': patientName,
      'patientPhone': patientPhone,
      'doctorName': doctorName,
      'doctorSpecialty': doctorSpecialty,
      'appointmentDate': appointmentDate,
      'appointmentTime': appointmentTime,
      'status': status,
      'reason': reason,
      'notes': notes,
      'allergies': allergies,
      'medications': medications,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  bool get isPending => status == 'pending';
  bool get isConfirmed => status == 'confirmed';
  bool get isCompleted => status == 'completed';
  bool get isCancelled => status == 'cancelled';

  String get statusArabic {
    switch (status) {
      case 'pending':
        return 'قيد الانتظار';
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

  AppointmentModel copyWith({
    String? id,
    String? doctorId,
    String? patientId,
    String? userId,
    String? patientName,
    String? patientPhone,
    String? doctorName,
    String? doctorSpecialty,
    String? appointmentDate,
    String? appointmentTime,
    String? status,
    String? reason,
    String? notes,
    List<String>? allergies,
    List<String>? medications,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return AppointmentModel(
      id: id ?? this.id,
      doctorId: doctorId ?? this.doctorId,
      patientId: patientId ?? this.patientId,
      userId: userId ?? this.userId,
      patientName: patientName ?? this.patientName,
      patientPhone: patientPhone ?? this.patientPhone,
      doctorName: doctorName ?? this.doctorName,
      doctorSpecialty: doctorSpecialty ?? this.doctorSpecialty,
      appointmentDate: appointmentDate ?? this.appointmentDate,
      appointmentTime: appointmentTime ?? this.appointmentTime,
      status: status ?? this.status,
      reason: reason ?? this.reason,
      notes: notes ?? this.notes,
      allergies: allergies ?? this.allergies,
      medications: medications ?? this.medications,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
