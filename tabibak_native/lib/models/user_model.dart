import 'package:cloud_firestore/cloud_firestore.dart';

class UserModel {
  final String id;
  final String? name;
  final String? email;
  final String? phone;
  final String role; // patient, doctor, receptionist
  final String? specialty; // For doctors
  final DateTime? createdAt;
  final DateTime? updatedAt;
  
  // Medical history fields (for patients)
  final String? allergies;
  final String? medications;
  final String? chronicDiseases;

  String get fullName => name ?? ''; // Assuming fullName is the same as name

  UserModel({
    required this.id,
    this.name,
    this.email,
    this.phone,
    required this.role,
    this.specialty,
    this.createdAt,
    this.updatedAt,
    this.allergies,
    this.medications,
    this.chronicDiseases,
  });

  factory UserModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return UserModel(
      id: doc.id,
      name: data['name'],
      email: data['email'],
      phone: data['phone'],
      role: data['role'] ?? 'patient',
      specialty: data['specialty'],
      createdAt: data['createdAt']?.toDate(),
      updatedAt: data['updatedAt']?.toDate(),
      allergies: data['allergies'],
      medications: data['medications'],
      chronicDiseases: data['chronicDiseases'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'email': email,
      'phone': phone,
      'role': role,
      'specialty': specialty,
      'createdAt': createdAt ?? FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      'allergies': allergies,
      'medications': medications,
      'chronicDiseases': chronicDiseases,
    };
  }

  UserModel copyWith({
    String? id,
    String? name,
    String? email,
    String? phone,
    String? role,
    String? specialty,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? allergies,
    String? medications,
    String? chronicDiseases,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      specialty: specialty ?? this.specialty,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      allergies: allergies ?? this.allergies,
      medications: medications ?? this.medications,
      chronicDiseases: chronicDiseases ?? this.chronicDiseases,
    );
  }
}
