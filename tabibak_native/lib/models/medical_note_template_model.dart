import 'package:cloud_firestore/cloud_firestore.dart';

class MedicalNoteTemplate {
  final String id;
  final String doctorId;
  final String name;
  final String condition;
  final String chiefComplaint;
  final String historyOfPresentIllness;
  final String physicalExamination;
  final String assessment;
  final String plan;
  final List<String> commonFindings;
  final DateTime createdAt;
  final DateTime updatedAt;

  MedicalNoteTemplate({
    required this.id,
    required this.doctorId,
    required this.name,
    required this.condition,
    required this.chiefComplaint,
    required this.historyOfPresentIllness,
    required this.physicalExamination,
    required this.assessment,
    required this.plan,
    required this.commonFindings,
    required this.createdAt,
    required this.updatedAt,
  });

  // Helper method to safely parse string lists from Firestore
  static List<String> _parseStringList(dynamic value) {
    if (value == null) return [];
    if (value is List) {
      return value.map((item) => item?.toString() ?? '').toList();
    }
    if (value is String) {
      // If it's a single string, treat it as a list with one item
      return value.isEmpty ? [] : [value];
    }
    return [];
  }

  factory MedicalNoteTemplate.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return MedicalNoteTemplate(
      id: doc.id,
      doctorId: data['doctorId'] ?? '',
      name: data['name'] ?? '',
      condition: data['condition'] ?? '',
      chiefComplaint: data['chiefComplaint'] ?? '',
      historyOfPresentIllness: data['historyOfPresentIllness'] ?? '',
      physicalExamination: data['physicalExamination'] ?? '',
      assessment: data['assessment'] ?? '',
      plan: data['plan'] ?? '',
      commonFindings: _parseStringList(data['commonFindings']),
      createdAt: (data['createdAt'] as Timestamp).toDate(),
      updatedAt: (data['updatedAt'] as Timestamp).toDate(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'doctorId': doctorId,
      'name': name,
      'condition': condition,
      'chiefComplaint': chiefComplaint,
      'historyOfPresentIllness': historyOfPresentIllness,
      'physicalExamination': physicalExamination,
      'assessment': assessment,
      'plan': plan,
      'commonFindings': commonFindings,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }

  // JSON serialization for local storage
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'doctorId': doctorId,
      'name': name,
      'condition': condition,
      'chiefComplaint': chiefComplaint,
      'historyOfPresentIllness': historyOfPresentIllness,
      'physicalExamination': physicalExamination,
      'assessment': assessment,
      'plan': plan,
      'commonFindings': commonFindings,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  factory MedicalNoteTemplate.fromJson(Map<String, dynamic> json) {
    return MedicalNoteTemplate(
      id: json['id'] ?? '',
      doctorId: json['doctorId'] ?? '',
      name: json['name'] ?? '',
      condition: json['condition'] ?? '',
      chiefComplaint: json['chiefComplaint'] ?? '',
      historyOfPresentIllness: json['historyOfPresentIllness'] ?? '',
      physicalExamination: json['physicalExamination'] ?? '',
      assessment: json['assessment'] ?? '',
      plan: json['plan'] ?? '',
      commonFindings: List<String>.from(json['commonFindings'] ?? []),
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }

  MedicalNoteTemplate copyWith({
    String? id,
    String? doctorId,
    String? name,
    String? condition,
    String? chiefComplaint,
    String? historyOfPresentIllness,
    String? physicalExamination,
    String? assessment,
    String? plan,
    List<String>? commonFindings,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return MedicalNoteTemplate(
      id: id ?? this.id,
      doctorId: doctorId ?? this.doctorId,
      name: name ?? this.name,
      condition: condition ?? this.condition,
      chiefComplaint: chiefComplaint ?? this.chiefComplaint,
      historyOfPresentIllness: historyOfPresentIllness ?? this.historyOfPresentIllness,
      physicalExamination: physicalExamination ?? this.physicalExamination,
      assessment: assessment ?? this.assessment,
      plan: plan ?? this.plan,
      commonFindings: commonFindings ?? this.commonFindings,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
