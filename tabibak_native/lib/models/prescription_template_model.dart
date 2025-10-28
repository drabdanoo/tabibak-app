import 'package:cloud_firestore/cloud_firestore.dart';

class PrescriptionTemplate {
  final String id;
  final String doctorId;
  final String name;
  final String condition;
  final List<PrescriptionItemTemplate> medications;
  final String notes;
  final DateTime createdAt;
  final DateTime updatedAt;

  PrescriptionTemplate({
    required this.id,
    required this.doctorId,
    required this.name,
    required this.condition,
    required this.medications,
    required this.notes,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PrescriptionTemplate.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return PrescriptionTemplate(
      id: doc.id,
      doctorId: data['doctorId'] ?? '',
      name: data['name'] ?? '',
      condition: data['condition'] ?? '',
      medications: (data['medications'] as List<dynamic>?)
          ?.map((item) => PrescriptionItemTemplate.fromMap(item as Map<String, dynamic>))
          .toList() ?? [],
      notes: data['notes'] ?? '',
      createdAt: (data['createdAt'] as Timestamp).toDate(),
      updatedAt: (data['updatedAt'] as Timestamp).toDate(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'doctorId': doctorId,
      'name': name,
      'condition': condition,
      'medications': medications.map((item) => item.toMap()).toList(),
      'notes': notes,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }

  PrescriptionTemplate copyWith({
    String? id,
    String? doctorId,
    String? name,
    String? condition,
    List<PrescriptionItemTemplate>? medications,
    String? notes,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return PrescriptionTemplate(
      id: id ?? this.id,
      doctorId: doctorId ?? this.doctorId,
      name: name ?? this.name,
      condition: condition ?? this.condition,
      medications: medications ?? this.medications,
      notes: notes ?? this.notes,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class PrescriptionItemTemplate {
  final String medicationName;
  final String defaultDosage;
  final String defaultFrequency;
  final int defaultDuration;
  final String instructions;

  PrescriptionItemTemplate({
    required this.medicationName,
    required this.defaultDosage,
    required this.defaultFrequency,
    required this.defaultDuration,
    required this.instructions,
  });

  factory PrescriptionItemTemplate.fromMap(Map<String, dynamic> map) {
    return PrescriptionItemTemplate(
      medicationName: map['medicationName'] ?? '',
      defaultDosage: map['defaultDosage'] ?? '',
      defaultFrequency: map['defaultFrequency'] ?? '',
      defaultDuration: map['defaultDuration'] ?? 0,
      instructions: map['instructions'] ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'medicationName': medicationName,
      'defaultDosage': defaultDosage,
      'defaultFrequency': defaultFrequency,
      'defaultDuration': defaultDuration,
      'instructions': instructions,
    };
  }
}
