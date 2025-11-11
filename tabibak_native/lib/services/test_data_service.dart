import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../utils/constants.dart';

class TestDataService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Add sample appointments for testing analytics
  Future<void> addSampleAppointments(String doctorId) async {
    try {
      final now = DateTime.now();
      
      // Sample appointments data
      final sampleAppointments = [
        {
          'doctorId': doctorId,
          'patientId': 'patient1',
          'patientName': 'Ahmed Hassan',
          'patientPhone': '+201234567890',
          'appointmentDate': '${now.year}-${now.month.toString().padLeft(2, '0')}-01',
          'appointmentTime': '10:00',
          'status': 'completed',
          'reason': 'Headache and fever',
          'notes': 'Patient complained of severe headache',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month, 1)),
        },
        {
          'doctorId': doctorId,
          'patientId': 'patient2',
          'patientName': 'Fatima Ali',
          'patientPhone': '+201234567891',
          'appointmentDate': '${now.year}-${now.month.toString().padLeft(2, '0')}-03',
          'appointmentTime': '14:00',
          'status': 'completed',
          'reason': 'Diabetes checkup',
          'notes': 'Regular diabetes monitoring',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month, 3)),
        },
        {
          'doctorId': doctorId,
          'patientId': 'patient3',
          'patientName': 'Omar Mohamed',
          'patientPhone': '+201234567892',
          'appointmentDate': '${now.year}-${now.month.toString().padLeft(2, '0')}-05',
          'appointmentTime': '11:30',
          'status': 'completed',
          'reason': 'Back pain consultation',
          'notes': 'Lower back pain after exercise',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month, 5)),
        },
        {
          'doctorId': doctorId,
          'patientId': 'patient4',
          'patientName': 'Layla Ibrahim',
          'patientPhone': '+201234567893',
          'appointmentDate': '${now.year}-${now.month.toString().padLeft(2, '0')}-08',
          'appointmentTime': '09:00',
          'status': 'completed',
          'reason': 'Hypertension follow up',
          'notes': 'Blood pressure monitoring',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month, 8)),
        },
        {
          'doctorId': doctorId,
          'patientId': 'patient5',
          'patientName': 'Youssef Ahmed',
          'patientPhone': '+201234567894',
          'appointmentDate': '${now.year}-${now.month.toString().padLeft(2, '0')}-10',
          'appointmentTime': '16:00',
          'status': 'completed',
          'reason': 'Common cold symptoms',
          'notes': 'Cough and runny nose',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month, 10)),
        },
        {
          'doctorId': doctorId,
          'patientId': 'patient1',
          'patientName': 'Ahmed Hassan',
          'patientPhone': '+201234567890',
          'appointmentDate': '${now.year}-${now.month.toString().padLeft(2, '0')}-15',
          'appointmentTime': '13:00',
          'status': 'completed',
          'reason': 'Allergy consultation',
          'notes': 'Seasonal allergies',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month, 15)),
        },
        {
          'doctorId': doctorId,
          'patientId': 'patient6',
          'patientName': 'Mona Khaled',
          'patientPhone': '+201234567895',
          'appointmentDate': '${now.year}-${now.month.toString().padLeft(2, '0')}-20',
          'appointmentTime': '10:30',
          'status': 'completed',
          'reason': 'General checkup',
          'notes': 'Annual health checkup',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month, 20)),
        },
        {
          'doctorId': doctorId,
          'patientId': 'patient7',
          'patientName': 'Hassan Omar',
          'patientPhone': '+201234567896',
          'appointmentDate': '${now.year}-${now.month.toString().padLeft(2, '0')}-22',
          'appointmentTime': '15:30',
          'status': 'completed',
          'reason': 'Asthma treatment',
          'notes': 'Inhaler prescription',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month, 22)),
        },
        // Add some appointments from previous months
        {
          'doctorId': doctorId,
          'patientId': 'patient8',
          'patientName': 'Nadia Said',
          'patientPhone': '+201234567897',
          'appointmentDate': '${now.year}-${(now.month - 1).toString().padLeft(2, '0')}-15',
          'appointmentTime': '12:00',
          'status': 'completed',
          'reason': 'Headache treatment',
          'notes': 'Migraine consultation',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month - 1, 15)),
        },
        {
          'doctorId': doctorId,
          'patientId': 'patient9',
          'patientName': 'Karim Farouk',
          'patientPhone': '+201234567898',
          'appointmentDate': '${now.year}-${(now.month - 1).toString().padLeft(2, '0')}-25',
          'appointmentTime': '14:30',
          'status': 'completed',
          'reason': 'Diabetes management',
          'notes': 'Insulin adjustment',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month - 1, 25)),
        },
        // Add some cancelled appointments
        {
          'doctorId': doctorId,
          'patientId': 'patient10',
          'patientName': 'Sara Ali',
          'patientPhone': '+201234567899',
          'appointmentDate': '${now.year}-${now.month.toString().padLeft(2, '0')}-25',
          'appointmentTime': '11:00',
          'status': 'cancelled',
          'reason': 'Follow up consultation',
          'notes': 'Patient cancelled',
          'createdAt': Timestamp.fromDate(DateTime(now.year, now.month, 25)),
        },
      ];

      // Add appointments to Firestore
      final batch = _firestore.batch();
      
      for (final appointment in sampleAppointments) {
        final docRef = _firestore.collection(AppConstants.appointmentsCollection).doc();
        batch.set(docRef, appointment);
      }
      
      await batch.commit();
      print('Successfully added ${sampleAppointments.length} sample appointments');
      
    } catch (e) {
      print('Error adding sample appointments: $e');
      throw e;
    }
  }

  // Check if sample data already exists
  Future<bool> hasSampleData(String doctorId) async {
    try {
      final query = await _firestore
          .collection(AppConstants.appointmentsCollection)
          .where('doctorId', isEqualTo: doctorId)
          .limit(1)
          .get();
      
      return query.docs.isNotEmpty;
    } catch (e) {
      print('Error checking sample data: $e');
      return false;
    }
  }
}