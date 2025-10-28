import 'package:cloud_firestore/cloud_firestore.dart';

class MedicalRecord {
  final String id;
  final String patientId;
  final String title;
  final String description;
  final String category; // e.g., 'allergy', 'medication', 'treatment', 'diagnosis'
  final DateTime date;
  final String? doctorName;
  final String? hospitalName;
  final String? notes;
  final DateTime createdAt;

  MedicalRecord({
    required this.id,
    required this.patientId,
    required this.title,
    required this.description,
    required this.category,
    required this.date,
    this.doctorName,
    this.hospitalName,
    this.notes,
    required this.createdAt,
  });

  factory MedicalRecord.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return MedicalRecord(
      id: doc.id,
      patientId: data['patientId'] ?? '',
      title: data['title'] ?? '',
      description: data['description'] ?? '',
      category: data['category'] ?? '',
      date: (data['date'] as Timestamp).toDate(),
      doctorName: data['doctorName'],
      hospitalName: data['hospitalName'],
      notes: data['notes'],
      createdAt: (data['createdAt'] as Timestamp).toDate(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'patientId': patientId,
      'title': title,
      'description': description,
      'category': category,
      'date': date,
      'doctorName': doctorName,
      'hospitalName': hospitalName,
      'notes': notes,
      'createdAt': createdAt,
    };
  }

  MedicalRecord copyWith({
    String? id,
    String? patientId,
    String? title,
    String? description,
    String? category,
    DateTime? date,
    String? doctorName,
    String? hospitalName,
    String? notes,
    DateTime? createdAt,
  }) {
    return MedicalRecord(
      id: id ?? this.id,
      patientId: patientId ?? this.patientId,
      title: title ?? this.title,
      description: description ?? this.description,
      category: category ?? this.category,
      date: date ?? this.date,
      doctorName: doctorName ?? this.doctorName,
      hospitalName: hospitalName ?? this.hospitalName,
      notes: notes ?? this.notes,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}