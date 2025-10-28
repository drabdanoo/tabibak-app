import 'package:flutter/material.dart';
import '../models/prescription_model.dart';
import '../services/firestore_service.dart';

class PrescriptionProvider with ChangeNotifier {
  final FirestoreService _firestoreService = FirestoreService();
  
  List<PrescriptionModel> _prescriptions = [];
  bool _isLoading = false;
  String? _error;

  List<PrescriptionModel> get prescriptions => _prescriptions;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Load patient's prescriptions
  void loadPatientPrescriptions(String patientId) {
    _setError(null);
    // We don't set loading to true here because this is a stream
    
    _firestoreService.getPatientPrescriptions(patientId).listen(
      (prescriptions) {
        _prescriptions = prescriptions;
        notifyListeners();
      },
      onError: (error) {
        _setError(error.toString());
        notifyListeners();
      },
    );
  }

  // Load doctor's prescriptions
  void loadDoctorPrescriptions(String doctorId) {
    _setError(null);
    // We don't set loading to true here because this is a stream
    
    _firestoreService.getDoctorPrescriptions(doctorId).listen(
      (prescriptions) {
        _prescriptions = prescriptions;
        notifyListeners();
      },
      onError: (error) {
        _setError(error.toString());
        notifyListeners();
      },
    );
  }

  // Create a new prescription
  Future<bool> createPrescription(PrescriptionModel prescription) async {
    try {
      _setError(null);
      _setLoading(true);
      
      await _firestoreService.createPrescription(prescription);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Update prescription status (activate/deactivate)
  Future<bool> updatePrescriptionStatus(String prescriptionId, bool isActive) async {
    try {
      _setError(null);
      _setLoading(true);
      
      await _firestoreService.updatePrescriptionStatus(prescriptionId, isActive);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Get a specific prescription by ID
  Future<PrescriptionModel?> getPrescriptionById(String prescriptionId) async {
    return await _firestoreService.getPrescriptionById(prescriptionId);
  }

  // Private methods for managing state
  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _setError(String? value) {
    _error = value;
    notifyListeners();
  }
}