import 'package:cloud_firestore/cloud_firestore.dart';

class PatientModel {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final int? age;
  final String? gender;
  final String? bloodType;
  final List<String>? allergies;
  final List<String>? medications;
  final String? medicalHistory;
  final DateTime? createdAt;

  PatientModel({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.age,
    this.gender,
    this.bloodType,
    this.allergies,
    this.medications,
    this.medicalHistory,
    this.createdAt,
  });

  factory PatientModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return PatientModel(
      id: doc.id,
      name: data['name'] ?? '',
      phone: data['phone'] ?? '',
      email: data['email'],
      age: data['age'],
      gender: data['gender'],
      bloodType: data['bloodType'],
      allergies: data['allergies'] != null 
          ? List<String>.from(data['allergies']) 
          : null,
      medications: data['medications'] != null 
          ? List<String>.from(data['medications']) 
          : null,
      medicalHistory: data['medicalHistory'],
      createdAt: data['createdAt']?.toDate(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'phone': phone,
      'email': email,
      'age': age,
      'gender': gender,
      'bloodType': bloodType,
      'allergies': allergies,
      'medications': medications,
      'medicalHistory': medicalHistory,
      'createdAt': createdAt ?? FieldValue.serverTimestamp(),
    };
  }

  PatientModel copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    int? age,
    String? gender,
    String? bloodType,
    List<String>? allergies,
    List<String>? medications,
    String? medicalHistory,
    DateTime? createdAt,
  }) {
    return PatientModel(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      age: age ?? this.age,
      gender: gender ?? this.gender,
      bloodType: bloodType ?? this.bloodType,
      allergies: allergies ?? this.allergies,
      medications: medications ?? this.medications,
      medicalHistory: medicalHistory ?? this.medicalHistory,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
