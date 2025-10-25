import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/doctor_model.dart';
import '../models/patient_model.dart';
import '../models/appointment_model.dart';
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
    } catch (e) {
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
    } catch (e) {
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
  Stream<List<AppointmentModel>> getDoctorAppointments(String doctorId) {
    return _firestore
        .collection(AppConstants.appointmentsCollection)
        .where('doctorId', isEqualTo: doctorId)
        .orderBy('createdAt', descending: true)
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
    } catch (e) {
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
    } catch (e) {
      throw Exception('فشل تحديث الموعد');
    }
  }

  // Cancel appointment
  Future<void> cancelAppointment(String appointmentId) async {
    try {
      await updateAppointmentStatus(appointmentId, AppConstants.statusCancelled);
    } catch (e) {
      throw Exception('فشل إلغاء الموعد');
    }
  }

  // Check for appointment conflicts
  Future<bool> hasAppointmentConflict({
    required String doctorId,
    required String date,
    required String time,
  }) async {
    try {
      final snapshot = await _firestore
          .collection(AppConstants.appointmentsCollection)
          .where('doctorId', isEqualTo: doctorId)
          .where('appointmentDate', isEqualTo: date)
          .where('appointmentTime', isEqualTo: time)
          .where('status', whereIn: ['pending', 'confirmed'])
          .get();
      
      return snapshot.docs.isNotEmpty;
    } catch (e) {
      return false;
    }
  }

  // ========== STATISTICS ==========

  // Get doctor stats
  Future<Map<String, int>> getDoctorStats(String doctorId) async {
    try {
      final today = DateTime.now();
      final todayStr = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
      
      final snapshot = await _firestore
          .collection(AppConstants.appointmentsCollection)
          .where('doctorId', isEqualTo: doctorId)
          .get();
      
      int todayCount = 0;
      int pendingCount = 0;
      int confirmedCount = 0;
      int completedCount = 0;
      
      for (var doc in snapshot.docs) {
        final data = doc.data();
        final status = data['status'];
        final date = data['appointmentDate'];
        
        if (date == todayStr) todayCount++;
        if (status == 'pending') pendingCount++;
        if (status == 'confirmed') confirmedCount++;
        if (status == 'completed') completedCount++;
      }
      
      return {
        'today': todayCount,
        'pending': pendingCount,
        'confirmed': confirmedCount,
        'completed': completedCount,
        'total': snapshot.docs.length,
      };
    } catch (e) {
      return {
        'today': 0,
        'pending': 0,
        'confirmed': 0,
        'completed': 0,
        'total': 0,
      };
    }
  }
}
