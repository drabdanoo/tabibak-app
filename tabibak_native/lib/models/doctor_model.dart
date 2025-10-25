import 'package:cloud_firestore/cloud_firestore.dart';

class DoctorModel {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String specialty;
  final String? photoUrl;
  final double? consultationFee;
  final String? openingTime;
  final String? closingTime;
  final bool listed;
  final bool? clinicClosed;
  final DateTime? closureEndDate;
  final String? location;
  final double? rating;
  final int? reviewsCount;
  final DateTime? createdAt;

  DoctorModel({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.specialty,
    this.photoUrl,
    this.consultationFee,
    this.openingTime,
    this.closingTime,
    this.listed = true,
    this.clinicClosed,
    this.closureEndDate,
    this.location,
    this.rating,
    this.reviewsCount,
    this.createdAt,
  });

  factory DoctorModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return DoctorModel(
      id: doc.id,
      name: data['name'] ?? '',
      email: data['email'] ?? '',
      phone: data['phone'],
      specialty: data['specialty'] ?? '',
      photoUrl: data['photoUrl'],
      consultationFee: _parseDouble(data['consultationFee']),
      openingTime: data['openingTime'],
      closingTime: data['closingTime'],
      listed: data['listed'] ?? true,
      clinicClosed: data['clinicClosed'],
      closureEndDate: data['closureEndDate']?.toDate(),
      location: data['location'],
      rating: _parseDouble(data['rating']),
      reviewsCount: data['reviewsCount'],
      createdAt: data['createdAt']?.toDate(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'email': email,
      'phone': phone,
      'specialty': specialty,
      'photoUrl': photoUrl,
      'consultationFee': consultationFee,
      'openingTime': openingTime,
      'closingTime': closingTime,
      'listed': listed,
      'clinicClosed': clinicClosed,
      'closureEndDate': closureEndDate,
      'location': location,
      'rating': rating,
      'reviewsCount': reviewsCount,
      'createdAt': createdAt ?? FieldValue.serverTimestamp(),
    };
  }

  String get initials {
    final names = name.split(' ');
    if (names.length >= 2) {
      return '${names[0][0]}${names[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  bool get isOpen {
    if (clinicClosed == true) {
      if (closureEndDate != null && closureEndDate!.isAfter(DateTime.now())) {
        return false;
      }
    }
    return true;
  }

  // Helper function to parse double from dynamic (handles String, int, double)
  static double? _parseDouble(dynamic value) {
    if (value == null) return null;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }
}
