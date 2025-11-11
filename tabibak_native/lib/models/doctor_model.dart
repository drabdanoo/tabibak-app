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
      rating: _parseDouble(data['rating']) ?? 0.0,
      reviewCount: data['reviewCount'] ?? 0,
      isAvailable: data['isAvailable'] ?? true,
      languages: _parseStringList(data['languages']) ?? [],
      clinicAddress: data['clinicAddress'] ?? '',
      openingTime: data['openingTime'],
      closingTime: data['closingTime'],
      consultationFee: _parseDouble(data['consultationFee']),
      location: data['location'],
    );
  }

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

  // Helper method to safely parse double values from Firestore
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