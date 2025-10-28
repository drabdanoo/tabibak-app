import 'package:flutter/material.dart';
import '../models/medical_record_model.dart';
import '../services/firestore_service.dart';
import 'dart:developer' as developer;

class MedicalRecordProvider with ChangeNotifier {
  final FirestoreService _firestoreService = FirestoreService();
  
  List<MedicalRecord> _medicalRecords = [];
  bool _isLoading = false;
  String? _error;

  List<MedicalRecord> get medicalRecords => _medicalRecords;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Load patient's medical records
  void loadMedicalRecords(String patientId) {
    _setError(null);
    // We don't set loading to true here because this is a stream
    
    _firestoreService.getPatientMedicalRecords(patientId).listen(
      (records) {
        _medicalRecords = records;
        notifyListeners();
      },
      onError: (error) {
        _setError(error.toString());
        notifyListeners();
      },
    );
  }

  // Add a new medical record
  Future<bool> addMedicalRecord(MedicalRecord record) async {
    try {
      _setError(null);
      _setLoading(true);
      
      await _firestoreService.addMedicalRecord(record);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Update an existing medical record
  Future<bool> updateMedicalRecord(String recordId, Map<String, dynamic> data) async {
    try {
      _setError(null);
      _setLoading(true);
      
      await _firestoreService.updateMedicalRecord(recordId, data);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Delete a medical record
  Future<bool> deleteMedicalRecord(String recordId) async {
    try {
      _setError(null);
      _setLoading(true);
      
      await _firestoreService.deleteMedicalRecord(recordId);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Get records by category
  List<MedicalRecord> getRecordsByCategory(String category) {
    return _medicalRecords
        .where((record) => record.category == category)
        .toList();
  }

  // Get unique categories
  List<String> getCategories() {
    final categories = _medicalRecords
        .map((record) => record.category)
        .toSet()
        .toList();
    
    // Sort categories alphabetically
    categories.sort();
    return categories;
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _setError(String? value) {
    _error = value;
    if (value != null) {
      developer.log('MedicalRecordProvider Error: $value', name: 'MedicalRecordProvider', level: 900);
    }
    notifyListeners();
  }

  void clearError() {
    _setError(null);
  }
}