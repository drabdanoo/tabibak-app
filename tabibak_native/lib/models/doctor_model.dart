import 'package:cloud_firestore/cloud_firestore.dart';

class DoctorModel {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String specialty;
  final String? bio;
  final String? profileImageUrl;
  final double rating;
  final int reviewCount;
  final bool isAvailable;
  final List<String> languages;
  final String clinicAddress;
  final String? openingTime;
  final String? closingTime;
  final double? consultationFee;
  final String? location;

  DoctorModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.specialty,
    this.bio,
    this.profileImageUrl,
    required this.rating,
    required this.reviewCount,
    required this.isAvailable,
    required this.languages,
    required this.clinicAddress,
    this.openingTime,
    this.closingTime,
    this.consultationFee,
    this.location,
  });

  /// Get the initials of the doctor's name (first letter of first name and last name)
  String get initials {
    if (name.isEmpty) return '';
    
    final names = name.split(' ');
    if (names.length >= 2) {
      return '${names.first.substring(0, 1)}${names.last.substring(0, 1)}';
    } else {
      return names.first.substring(0, 1);
    }
  }

  factory DoctorModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return DoctorModel(
      id: doc.id,
      name: data['name'] ?? '',
      email: data['email'] ?? '',
      phone: data['phone'] ?? '',
      specialty: data['specialty'] ?? '',
      bio: data['bio'],
      profileImageUrl: data['profileImageUrl'],
      rating: (data['rating'] ?? 0.0).toDouble(),
      reviewCount: data['reviewCount'] ?? 0,
      isAvailable: data['isAvailable'] ?? true,
      languages: List<String>.from(data['languages'] ?? []),
      clinicAddress: data['clinicAddress'] ?? '',
      openingTime: data['openingTime'],
      closingTime: data['closingTime'],
      consultationFee: data['consultationFee']?.toDouble(),
      location: data['location'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'email': email,
      'phone': phone,
      'specialty': specialty,
      'bio': bio,
      'profileImageUrl': profileImageUrl,
      'rating': rating,
      'reviewCount': reviewCount,
      'isAvailable': isAvailable,
      'languages': languages,
      'clinicAddress': clinicAddress,
      'openingTime': openingTime,
      'closingTime': closingTime,
      'consultationFee': consultationFee,
      'location': location,
    };
  }
}