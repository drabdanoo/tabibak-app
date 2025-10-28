import 'package:cloud_firestore/cloud_firestore.dart';

class PrescriptionModel {
  final String id;
  final String patientId;
  final String doctorId;
  final String doctorName;
  final String? doctorSpecialty;
  final String diagnosis;
  final List<PrescriptionItem> medications;
  final String? notes;
  final DateTime prescribedAt;
  final DateTime? validUntil;
  final bool isActive;

  PrescriptionModel({
    required this.id,
    required this.patientId,
    required this.doctorId,
    required this.doctorName,
    this.doctorSpecialty,
    required this.diagnosis,
    required this.medications,
    this.notes,
    required this.prescribedAt,
    this.validUntil,
    this.isActive = true,
  });

  factory PrescriptionModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return PrescriptionModel(
      id: doc.id,
      patientId: data['patientId'] ?? '',
      doctorId: data['doctorId'] ?? '',
      doctorName: data['doctorName'] ?? 'Unknown Doctor',
      doctorSpecialty: data['doctorSpecialty'],
      diagnosis: data['diagnosis'] ?? '',
      medications: (data['medications'] as List<dynamic>?)
          ?.map((item) => PrescriptionItem.fromMap(item as Map<String, dynamic>))
          .toList() ?? [],
      notes: data['notes'],
      prescribedAt: (data['prescribedAt'] as Timestamp).toDate(),
      validUntil: (data['validUntil'] as Timestamp?)?.toDate(),
      isActive: data['isActive'] ?? true,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'patientId': patientId,
      'doctorId': doctorId,
      'doctorName': doctorName,
      'doctorSpecialty': doctorSpecialty,
      'diagnosis': diagnosis,
      'medications': medications.map((item) => item.toMap()).toList(),
      'notes': notes,
      'prescribedAt': prescribedAt,
      'validUntil': validUntil,
      'isActive': isActive,
    };
  }
}

class PrescriptionItem {
  final String medicationName;
  final String dosage;
  final String frequency;
  final int duration;
  final String? instructions;

  PrescriptionItem({
    required this.medicationName,
    required this.dosage,
    required this.frequency,
    required this.duration,
    this.instructions,
  });

  String get name => medicationName;

  factory PrescriptionItem.fromMap(Map<String, dynamic> map) {
    return PrescriptionItem(
      medicationName: map['medicationName'] ?? '',
      dosage: map['dosage'] ?? '',
      frequency: map['frequency'] ?? '',
      duration: map['duration'] ?? 0,
      instructions: map['instructions'] ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'medicationName': medicationName,
      'dosage': dosage,
      'frequency': frequency,
      'duration': duration,
      'instructions': instructions,
    };
  }
}
