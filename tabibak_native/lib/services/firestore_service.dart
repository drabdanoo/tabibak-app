import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:developer' as developer;
import '../models/doctor_model.dart';
import '../models/patient_model.dart';
import '../models/appointment_model.dart';
import '../models/message_model.dart';
import '../models/medical_record_model.dart';
import '../models/prescription_model.dart';
import '../models/prescription_template_model.dart';
import '../models/medical_note_template_model.dart';
import '../utils/constants.dart';

class FirestoreService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // ========== DOCTORS ==========

  // Get all listed doctors
  Stream<List<DoctorModel>> getDoctors() {
    return _firestore
        .collection(AppConstants.doctorsCollection)
        .where('listed', isEqualTo: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => DoctorModel.fromFirestore(doc))
            .toList());
  }

  // Get doctor by ID
  Future<DoctorModel?> getDoctorById(String doctorId) async {
    try {
      final doc = await _firestore
          .collection(AppConstants.doctorsCollection)
          .doc(doctorId)
          .get();
      
      if (doc.exists) {
        return DoctorModel.fromFirestore(doc);
      }
      return null;
    } catch (e) {
      developer.log('Error getting doctor: $e', name: 'FirestoreService', level: 900);
      return null;
    }
  }

  // Search doctors by name or specialty
  Stream<List<DoctorModel>> searchDoctors(String query) {
    return _firestore
        .collection(AppConstants.doctorsCollection)
        .where('listed', isEqualTo: true)
        .snapshots()
        .map((snapshot) {
      final doctors = snapshot.docs
          .map((doc) => DoctorModel.fromFirestore(doc))
          .toList();
      
      if (query.isEmpty) return doctors;
      
      return doctors.where((doctor) {
        final nameLower = doctor.name.toLowerCase();
        final specialtyLower = doctor.specialty.toLowerCase();
        final queryLower = query.toLowerCase();
        return nameLower.contains(queryLower) || 
               specialtyLower.contains(queryLower);
      }).toList();
    });
  }

  // ========== PATIENTS ==========

  // Get patient by ID
  Future<PatientModel?> getPatientById(String patientId) async {
    try {
      final doc = await _firestore
          .collection(AppConstants.patientsCollection)
          .doc(patientId)
          .get();
      
      if (doc.exists) {
        return PatientModel.fromFirestore(doc);
      }
      return null;
    } catch (e) {
      developer.log('Error getting patient: $e', name: 'FirestoreService', level: 900);
      return null;
    }
  }

  // Update patient profile
  Future<void> updatePatientProfile(String patientId, Map<String, dynamic> data) async {
    try {
      await _firestore
          .collection(AppConstants.patientsCollection)
          .doc(patientId)
          .update(data);
    } on FirebaseException catch (e) {
      developer.log('Firebase error updating patient profile: ${e.code} - ${e.message}', name: 'FirestoreService', level: 900);
      throw Exception('فشل تحديث الملف الشخصي: ${e.message}');
    } catch (e) {
      developer.log('Error updating patient profile: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل تحديث الملف الشخصي');
    }
  }

  // ========== APPOINTMENTS ==========

  // Create appointment
  Future<String> createAppointment(AppointmentModel appointment) async {
    try {
      final docRef = await _firestore
          .collection(AppConstants.appointmentsCollection)
          .add(appointment.toMap());
      return docRef.id;
    } on FirebaseException catch (e) {
      developer.log('Firebase error creating appointment: ${e.code} - ${e.message}', name: 'FirestoreService', level: 900);
      throw Exception('فشل إنشاء الموعد: ${e.message}');
    } catch (e) {
      developer.log('Error creating appointment: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل إنشاء الموعد');
    }
  }

  // Get patient appointments
  Stream<List<AppointmentModel>> getPatientAppointments(String patientId) {
    return _firestore
        .collection(AppConstants.appointmentsCollection)
        .where('patientId', isEqualTo: patientId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => AppointmentModel.fromFirestore(doc))
            .toList());
  }

  // Get doctor appointments
  Stream<List<AppointmentModel>> getDoctorAppointments(String doctorId, [String? status]) {
    Query query = _firestore
        .collection(AppConstants.appointmentsCollection)
        .where('doctorId', isEqualTo: doctorId);
    
    if (status != null) {
      query = query.where('status', isEqualTo: status);
    }
    
    return query
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => AppointmentModel.fromFirestore(doc))
            .toList());
  }

  // Get upcoming appointments for a doctor
  Stream<List<AppointmentModel>> getUpcomingDoctorAppointments(String doctorId) {
    final now = DateTime.now();
    final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    
    return _firestore
        .collection(AppConstants.appointmentsCollection)
        .where('doctorId', isEqualTo: doctorId)
        .where('status', isEqualTo: 'confirmed')
        .where('appointmentDate', isGreaterThanOrEqualTo: todayStr)
        .orderBy('appointmentDate')
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => AppointmentModel.fromFirestore(doc))
            .toList());
  }

  // Get upcoming appointments for a patient
  Stream<List<AppointmentModel>> getUpcomingPatientAppointments(String patientId) {
    final now = DateTime.now();
    final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    
    return _firestore
        .collection(AppConstants.appointmentsCollection)
        .where('patientId', isEqualTo: patientId)
        .where('status', isEqualTo: 'confirmed')
        .where('appointmentDate', isGreaterThanOrEqualTo: todayStr)
        .orderBy('appointmentDate')
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => AppointmentModel.fromFirestore(doc))
            .toList());
  }

  // Update appointment status
  Future<void> updateAppointmentStatus(String appointmentId, String status) async {
    try {
      await _firestore
          .collection(AppConstants.appointmentsCollection)
          .doc(appointmentId)
          .update({
        'status': status,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (e) {
      developer.log('Firebase error updating appointment status: ${e.code} - ${e.message}', name: 'FirestoreService', level: 900);
      throw Exception('فشل تحديث حالة الموعد: ${e.message}');
    } catch (e) {
      developer.log('Error updating appointment status: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل تحديث حالة الموعد');
    }
  }

  // Update appointment
  Future<void> updateAppointment(String appointmentId, Map<String, dynamic> data) async {
    try {
      data['updatedAt'] = FieldValue.serverTimestamp();
      await _firestore
          .collection(AppConstants.appointmentsCollection)
          .doc(appointmentId)
          .update(data);
    } on FirebaseException catch (e) {
      developer.log('Firebase error updating appointment: ${e.code} - ${e.message}', name: 'FirestoreService', level: 900);
      throw Exception('فشل تحديث الموعد: ${e.message}');
    } catch (e) {
      developer.log('Error updating appointment: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل تحديث الموعد');
    }
  }

  // Cancel appointment
  Future<void> cancelAppointment(String appointmentId) async {
    try {
      await updateAppointmentStatus(appointmentId, AppConstants.statusCancelled);
    } catch (e) {
      developer.log('Error cancelling appointment: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل إلغاء الموعد: ${e.toString()}');
    }
  }

  // Check for appointment conflicts
  Future<bool> hasAppointmentConflict(String doctorId, DateTime appointmentDate, String? existingAppointmentId) async {
    try {
      final startOfDay = DateTime(appointmentDate.year, appointmentDate.month, appointmentDate.day);
      final endOfDay = startOfDay.add(const Duration(days: 1));

      Query query = _firestore
          .collection(AppConstants.appointmentsCollection)
          .where('doctorId', isEqualTo: doctorId)
          .where('date', isGreaterThanOrEqualTo: startOfDay)
          .where('date', isLessThan: endOfDay)
          .where('status', whereIn: [AppConstants.statusConfirmed, AppConstants.statusPending]);

      // If updating an existing appointment, exclude it from conflict check
      if (existingAppointmentId != null) {
        query = query.where('id', isNotEqualTo: existingAppointmentId);
      }

      final snapshot = await query.get();
      return snapshot.docs.isNotEmpty;
    } catch (e) {
      developer.log('Error checking appointment conflicts: $e', name: 'FirestoreService', level: 900);
      return false; // Assume no conflicts on error to avoid blocking the user
    }
  }

  // Get doctor statistics
  Future<Map<String, dynamic>> getDoctorStats(String doctorId) async {
    try {
      final stats = {
        'totalAppointments': 0,
        'completedAppointments': 0,
        'cancelledAppointments': 0,
        'totalPatients': 0,
      };

      // Get all doctor's appointments
      final appointmentsSnapshot = await _firestore
          .collection(AppConstants.appointmentsCollection)
          .where('doctorId', isEqualTo: doctorId)
          .get();

      stats['totalAppointments'] = appointmentsSnapshot.docs.length;

      // Count by status
      int completed = 0;
      int cancelled = 0;
      final patientIds = <String>{};

      for (var doc in appointmentsSnapshot.docs) {
        final data = doc.data();
        final status = data['status'] as String?;
        final patientId = data['patientId'] as String?;

        if (status == AppConstants.statusCompleted) {
          completed++;
        } else if (status == AppConstants.statusCancelled) {
          cancelled++;
        }

        if (patientId != null) {
          patientIds.add(patientId);
        }
      }

      stats['completedAppointments'] = completed;
      stats['cancelledAppointments'] = cancelled;
      stats['totalPatients'] = patientIds.length;

      return stats;
    } catch (e) {
      developer.log('Error getting doctor stats: $e', name: 'FirestoreService', level: 900);
      return {
        'totalAppointments': 0,
        'completedAppointments': 0,
        'cancelledAppointments': 0,
        'totalPatients': 0,
      };
    }
  }

  // ========== CHAT ==========

  // Create or get existing chat between two users
  Future<String> createOrGetChat(String doctorId, String patientId) async {
    try {
      // Check if chat already exists
      final snapshot = await _firestore
          .collection('chats')
          .where('participant1Id', whereIn: [doctorId, patientId])
          .where('participant2Id', whereIn: [doctorId, patientId])
          .limit(1)
          .get();

      if (snapshot.docs.isNotEmpty) {
        return snapshot.docs.first.id;
      }

      // Create new chat
      final doctorDoc = await getDoctorById(doctorId);
      final patientDoc = await getPatientById(patientId);

      if (doctorDoc == null || patientDoc == null) {
        throw Exception('Could not find doctor or patient');
      }

      final chatData = {
        'participant1Id': doctorId,
        'participant2Id': patientId,
        'participantNames': [doctorDoc.name, patientDoc.name],
        'createdAt': FieldValue.serverTimestamp(),
        'lastMessage': null,
        'lastMessageTime': null,
      };

      final docRef = await _firestore.collection('chats').add(chatData);
      return docRef.id;
    } catch (e) {
      developer.log('Error creating/getting chat: $e', name: 'FirestoreService', level: 900);
      throw Exception('Failed to create/get chat: $e');
    }
  }

  // Send a message
  Future<String> sendMessage(String chatId, MessageModel message) async {
    try {
      final docRef = await _firestore
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .add(message.toMap());
      
      // Update chat's last message
      await _firestore.collection('chats').doc(chatId).update({
        'lastMessage': message.content,
        'lastMessageTime': FieldValue.serverTimestamp(),
      });
      
      return docRef.id;
    } catch (e) {
      developer.log('Error sending message: $e', name: 'FirestoreService', level: 900);
      throw Exception('Failed to send message: $e');
    }
  }

  // Mark messages as read
  Future<void> markMessagesAsRead(String chatId, String userId) async {
    try {
      final snapshot = await _firestore
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .where('senderId', isNotEqualTo: userId)
          .where('isRead', isEqualTo: false)
          .get();

      final batch = _firestore.batch();
      for (var doc in snapshot.docs) {
        batch.update(doc.reference, {'isRead': true});
      }
      await batch.commit();
    } catch (e) {
      developer.log('Error marking messages as read: $e', name: 'FirestoreService', level: 900);
    }
  }

  // Get user chats
  Stream<List<Map<String, dynamic>>> getUserChats(String userId) {
    return _firestore
        .collection('chats')
        .where('participantIds', arrayContains: userId)
        .orderBy('lastMessageTime', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => {'id': doc.id, ...doc.data()})
            .toList());
  }

  // Get chat messages
  Stream<List<MessageModel>> getChatMessages(String chatId) {
    return _firestore
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', descending: false)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => MessageModel.fromFirestore(doc))
            .toList());
  }

  // ========== MEDICAL RECORDS ==========

  // Add a new medical record
  Future<String> addMedicalRecord(MedicalRecord record) async {
    try {
      final docRef = await _firestore
          .collection('medical_records')
          .add(record.toMap());
      return docRef.id;
    } catch (e) {
      developer.log('Error adding medical record: $e', name: 'FirestoreService', level: 900);
      throw Exception('Failed to add medical record: $e');
    }
  }

  // Get patient's medical records
  Stream<List<MedicalRecord>> getPatientMedicalRecords(String patientId) {
    return _firestore
        .collection('medical_records')
        .where('patientId', isEqualTo: patientId)
        .orderBy('date', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => MedicalRecord.fromFirestore(doc))
            .toList());
  }

  // Update a medical record
  Future<void> updateMedicalRecord(String recordId, Map<String, dynamic> data) async {
    try {
      await _firestore
          .collection('medical_records')
          .doc(recordId)
          .update(data);
    } catch (e) {
      developer.log('Error updating medical record: $e', name: 'FirestoreService', level: 900);
      throw Exception('Failed to update medical record: $e');
    }
  }

  // Delete a medical record
  Future<void> deleteMedicalRecord(String recordId) async {
    try {
      await _firestore
          .collection('medical_records')
          .doc(recordId)
          .delete();
    } catch (e) {
      developer.log('Error deleting medical record: $e', name: 'FirestoreService', level: 900);
      throw Exception('Failed to delete medical record: $e');
    }
  }

  // ========== PRESCRIPTIONS ==========

  // Create a new prescription
  Future<String> createPrescription(PrescriptionModel prescription) async {
    try {
      final docRef = await _firestore
          .collection('prescriptions')
          .add(prescription.toMap());
      return docRef.id;
    } on FirebaseException catch (e) {
      developer.log('Firebase error creating prescription: ${e.code} - ${e.message}', name: 'FirestoreService', level: 900);
      throw Exception('فشل إنشاء الوصفة الطبية: ${e.message}');
    } catch (e) {
      developer.log('Error creating prescription: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل إنشاء الوصفة الطبية');
    }
  }

  // Get patient's prescriptions
  Stream<List<PrescriptionModel>> getPatientPrescriptions(String patientId) {
    return _firestore
        .collection('prescriptions')
        .where('patientId', isEqualTo: patientId)
        .orderBy('prescribedAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => PrescriptionModel.fromFirestore(doc))
            .toList());
  }

  // Get doctor's prescriptions
  Stream<List<PrescriptionModel>> getDoctorPrescriptions(String doctorId) {
    return _firestore
        .collection('prescriptions')
        .where('doctorId', isEqualTo: doctorId)
        .orderBy('prescribedAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => PrescriptionModel.fromFirestore(doc))
            .toList());
  }

  // Get a specific prescription by ID
  Future<PrescriptionModel?> getPrescriptionById(String prescriptionId) async {
    try {
      final doc = await _firestore
          .collection('prescriptions')
          .doc(prescriptionId)
          .get();
      
      if (doc.exists) {
        return PrescriptionModel.fromFirestore(doc);
      }
      return null;
    } catch (e) {
      developer.log('Error getting prescription: $e', name: 'FirestoreService', level: 900);
      return null;
    }
  }

  // Update prescription status (activate/deactivate)
  Future<void> updatePrescriptionStatus(String prescriptionId, bool isActive) async {
    try {
      await _firestore
          .collection('prescriptions')
          .doc(prescriptionId)
          .update({
        'isActive': isActive,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (e) {
      developer.log('Firebase error updating prescription status: ${e.code} - ${e.message}', name: 'FirestoreService', level: 900);
      throw Exception('فشل تحديث حالة الوصفة الطبية: ${e.message}');
    } catch (e) {
      developer.log('Error updating prescription status: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل تحديث حالة الوصفة الطبية');
    }
  }

  // Template Methods
  Future<String> createPrescriptionTemplate(PrescriptionTemplate template) async {
    try {
      final docRef = await _firestore.collection('prescription_templates').add(template.toMap());
      developer.log('Prescription template created: ${docRef.id}', name: 'FirestoreService');
      return docRef.id;
    } catch (e) {
      developer.log('Error creating prescription template: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل إنشاء قالب الوصفة الطبية');
    }
  }

  Future<void> updatePrescriptionTemplate(PrescriptionTemplate template) async {
    try {
      await _firestore.collection('prescription_templates').doc(template.id).update(template.toMap());
      developer.log('Prescription template updated: ${template.id}', name: 'FirestoreService');
    } catch (e) {
      developer.log('Error updating prescription template: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل تحديث قالب الوصفة الطبية');
    }
  }

  Future<void> deletePrescriptionTemplate(String templateId) async {
    try {
      await _firestore.collection('prescription_templates').doc(templateId).delete();
      developer.log('Prescription template deleted: $templateId', name: 'FirestoreService');
    } catch (e) {
      developer.log('Error deleting prescription template: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل حذف قالب الوصفة الطبية');
    }
  }

  Stream<List<PrescriptionTemplate>> getPrescriptionTemplates(String doctorId) {
    return _firestore
        .collection('prescription_templates')
        .where('doctorId', isEqualTo: doctorId)
        .orderBy('updatedAt', descending: true)
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map((doc) => PrescriptionTemplate.fromFirestore(doc)).toList());
  }

  Future<String> createMedicalNoteTemplate(MedicalNoteTemplate template) async {
    try {
      final docRef = await _firestore.collection('medical_note_templates').add(template.toMap());
      developer.log('Medical note template created: ${docRef.id}', name: 'FirestoreService');
      return docRef.id;
    } catch (e) {
      developer.log('Error creating medical note template: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل إنشاء قالب الملاحظة الطبية');
    }
  }

  Future<void> updateMedicalNoteTemplate(MedicalNoteTemplate template) async {
    try {
      await _firestore.collection('medical_note_templates').doc(template.id).update(template.toMap());
      developer.log('Medical note template updated: ${template.id}', name: 'FirestoreService');
    } catch (e) {
      developer.log('Error updating medical note template: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل تحديث قالب الملاحظة الطبية');
    }
  }

  Future<void> deleteMedicalNoteTemplate(String templateId) async {
    try {
      await _firestore.collection('medical_note_templates').doc(templateId).delete();
      developer.log('Medical note template deleted: $templateId', name: 'FirestoreService');
    } catch (e) {
      developer.log('Error deleting medical note template: $e', name: 'FirestoreService', level: 900);
      throw Exception('فشل حذف قالب الملاحظة الطبية');
    }
  }

  Stream<List<MedicalNoteTemplate>> getMedicalNoteTemplates(String doctorId) {
    return _firestore
        .collection('medical_note_templates')
        .where('doctorId', isEqualTo: doctorId)
        .orderBy('updatedAt', descending: true)
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map((doc) => MedicalNoteTemplate.fromFirestore(doc)).toList());
  }
}