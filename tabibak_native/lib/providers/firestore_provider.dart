import 'package:flutter/material.dart';
import '../services/firestore_service.dart';
import '../models/appointment_model.dart';

class FirestoreProvider with ChangeNotifier {
  final FirestoreService _firestoreService = FirestoreService();
  String? _currentDoctorId;
  String? _currentPatientId;

  void setCurrentDoctorId(String doctorId) {
    _currentDoctorId = doctorId;
    notifyListeners();
  }
  
  void setCurrentPatientId(String patientId) {
    _currentPatientId = patientId;
    notifyListeners();
  }

  // Get doctor appointments stream
  Stream<List<AppointmentModel>> getDoctorAppointments(String doctorId) {
    return _firestoreService.getDoctorAppointments(doctorId);
  }

  // Getter for doctor appointments based on current doctor ID
  Stream<List<AppointmentModel>> get doctorAppointments {
    if (_currentDoctorId == null) {
      // Return an empty stream if no doctor ID is set
      return Stream.value([]);
    }
    return _firestoreService.getDoctorAppointments(_currentDoctorId!);
  }
  
  // Getter for patient appointments based on current patient ID
  Stream<List<AppointmentModel>> get patientAppointments {
    if (_currentPatientId == null) {
      // Return an empty stream if no patient ID is set
      return Stream.value([]);
    }
    return _firestoreService.getPatientAppointments(_currentPatientId!);
  }
  
  // Method to update patient medical history
  Future<void> updatePatientMedicalHistory(String patientId, Map<String, dynamic> data) async {
    await _firestoreService.updatePatientProfile(patientId, data);
    // Notify listeners to refresh the data
    notifyListeners();
  }
}
