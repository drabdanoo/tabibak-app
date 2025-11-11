import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/prescription_template_model.dart';
import '../models/medical_note_template_model.dart';

class LocalTemplateService {
  static const String _prescriptionTemplatesKey = 'prescription_templates';
  static const String _medicalNoteTemplatesKey = 'medical_note_templates';

  // Prescription Template Methods
  Future<List<PrescriptionTemplate>> getPrescriptionTemplates(String doctorId) async {
    final prefs = await SharedPreferences.getInstance();
    final templatesJson = prefs.getStringList(_prescriptionTemplatesKey) ?? [];
    
    return templatesJson
        .map((json) => PrescriptionTemplate.fromJson(jsonDecode(json)))
        .where((template) => template.doctorId == doctorId)
        .toList();
  }

  Future<String> savePrescriptionTemplate(PrescriptionTemplate template) async {
    final prefs = await SharedPreferences.getInstance();
    final templatesJson = prefs.getStringList(_prescriptionTemplatesKey) ?? [];
    
    // Generate an ID if it doesn't exist
    final templateId = template.id.isEmpty ? 
        DateTime.now().millisecondsSinceEpoch.toString() : 
        template.id;
    
    final updatedTemplate = template.copyWith(id: templateId);
    
    // Remove existing template with same ID if updating
    templatesJson.removeWhere((json) {
      final existing = PrescriptionTemplate.fromJson(jsonDecode(json));
      return existing.id == templateId;
    });
    
    // Add the new/updated template
    templatesJson.add(jsonEncode(updatedTemplate.toJson()));
    
    await prefs.setStringList(_prescriptionTemplatesKey, templatesJson);
    return templateId;
  }

  Future<void> deletePrescriptionTemplate(String templateId) async {
    final prefs = await SharedPreferences.getInstance();
    final templatesJson = prefs.getStringList(_prescriptionTemplatesKey) ?? [];
    
    templatesJson.removeWhere((json) {
      final template = PrescriptionTemplate.fromJson(jsonDecode(json));
      return template.id == templateId;
    });
    
    await prefs.setStringList(_prescriptionTemplatesKey, templatesJson);
  }

  // Medical Note Template Methods
  Future<List<MedicalNoteTemplate>> getMedicalNoteTemplates(String doctorId) async {
    final prefs = await SharedPreferences.getInstance();
    final templatesJson = prefs.getStringList(_medicalNoteTemplatesKey) ?? [];
    
    return templatesJson
        .map((json) => MedicalNoteTemplate.fromJson(jsonDecode(json)))
        .where((template) => template.doctorId == doctorId)
        .toList();
  }

  Future<String> saveMedicalNoteTemplate(MedicalNoteTemplate template) async {
    final prefs = await SharedPreferences.getInstance();
    final templatesJson = prefs.getStringList(_medicalNoteTemplatesKey) ?? [];
    
    // Generate an ID if it doesn't exist
    final templateId = template.id.isEmpty ? 
        DateTime.now().millisecondsSinceEpoch.toString() : 
        template.id;
    
    final updatedTemplate = template.copyWith(id: templateId);
    
    // Remove existing template with same ID if updating
    templatesJson.removeWhere((json) {
      final existing = MedicalNoteTemplate.fromJson(jsonDecode(json));
      return existing.id == templateId;
    });
    
    // Add the new/updated template
    templatesJson.add(jsonEncode(updatedTemplate.toJson()));
    
    await prefs.setStringList(_medicalNoteTemplatesKey, templatesJson);
    return templateId;
  }

  Future<void> deleteMedicalNoteTemplate(String templateId) async {
    final prefs = await SharedPreferences.getInstance();
    final templatesJson = prefs.getStringList(_medicalNoteTemplatesKey) ?? [];
    
    templatesJson.removeWhere((json) {
      final template = MedicalNoteTemplate.fromJson(jsonDecode(json));
      return template.id == templateId;
    });
    
    await prefs.setStringList(_medicalNoteTemplatesKey, templatesJson);
  }
}