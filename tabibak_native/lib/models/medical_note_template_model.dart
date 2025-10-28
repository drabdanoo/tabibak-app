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
      commonFindings: List<String>.from(data['commonFindings'] ?? []),
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
