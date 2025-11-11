import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../models/prescription_model.dart';
import '../../models/appointment_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/prescription_provider.dart';
import '../../services/firestore_service.dart';

class CreatePrescriptionScreen extends StatefulWidget {
  final AppointmentModel appointment;

  const CreatePrescriptionScreen({Key? key, required this.appointment}) : super(key: key);

  @override
  _CreatePrescriptionScreenState createState() => _CreatePrescriptionScreenState();
}

class _CreatePrescriptionScreenState extends State<CreatePrescriptionScreen> {
  final _formKey = GlobalKey<FormState>();
  final List<Map<String, String>> _medications = [];
  final TextEditingController _instructionsController = TextEditingController();
  final FirestoreService _firestoreService = FirestoreService();

  @override
  void initState() {
    super.initState();
    // Add one medication field by default
    _addMedicationField();
  }

  @override
  void dispose() {
    _instructionsController.dispose();
    super.dispose();
  }

  void _addMedicationField() {
    setState(() {
      _medications.add({
        'name': '',
        'dosage': '',
        'frequency': '',
        'duration': '',
      });
    });
  }

  void _removeMedicationField(int index) {
    setState(() {
      _medications.removeAt(index);
    });
  }

  void _createPrescription() async {
    if (!_validateMedications()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please fill in all medication fields'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final doctorId = authProvider.currentUser?.uid;

    if (doctorId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Doctor information not found'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    try {
      // Get doctor information from Firestore
      final doctorDoc = await FirestoreService().getDoctorById(doctorId);
      if (doctorDoc == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Could not load doctor information'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      final prescription = PrescriptionModel(
        id: '',
        patientId: widget.appointment.patientId,
        doctorId: doctorId,
        doctorName: doctorDoc.name,
        doctorSpecialty: doctorDoc.specialty,
        diagnosis: widget.appointment.reason ?? '', // Provides an empty string if reason is null
        medications: _medications.map((med) {
          return PrescriptionItem(
            medicationName: med['name'] ?? '',
            dosage: med['dosage'] ?? '',
            frequency: med['frequency'] ?? '',
            duration: int.tryParse(med['duration'] ?? '0') ?? 0,
            instructions: null, // Instructions are now nullable
          );
        }).toList(),
        notes: _instructionsController.text.trim().isEmpty ? null : _instructionsController.text.trim(),
        prescribedAt: DateTime.now(),
        validUntil: null, // Assuming no default validUntil
        isActive: true,
      );

      await _firestoreService.createPrescription(prescription);

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Prescription created successfully'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error creating prescription: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  bool _validateMedications() {
    return _medications.every((med) => 
          (med['name']?.isNotEmpty ?? false) &&
          (med['dosage']?.isNotEmpty ?? false) &&
          (med['frequency']?.isNotEmpty ?? false) &&
          (med['duration']?.isNotEmpty ?? false));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Semantics(
          header: true,
          label: 'إنشاء وصفة طبية',
          child: Text('إنشاء وصفة طبية'),
        ),
        leading: Semantics(
          label: 'العودة للخلف',
          child: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(
                        header: true,
                        label: 'معلومات المريض',
                        child: Text(
                          'معلومات المريض',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text('الاسم: ${widget.appointment.patientName}'),
                      Text('رقم الهاتف: ${widget.appointment.patientPhone}'),
                      if (widget.appointment.appointmentDate != null && widget.appointment.appointmentTime != null)
                        Text(
                'الموعد: ${widget.appointment.appointmentDate} في ${widget.appointment.appointmentTime}',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                ),
              ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Semantics(
                header: true,
                label: 'قسم الأدوية',
                child: Text(
                  'الأدوية',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ),
              const SizedBox(height: 12),
              if (_medications.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Text(
                      'لم تتم إضافة أي أدوية بعد',
                      style: TextStyle(
                        fontStyle: FontStyle.italic,
                        color: Colors.grey[600],
                      ),
                    ),
                  ),
                ),
              ...List.generate(_medications.length, (index) {
                return _buildMedicationCard(index);
              }),
              SizedBox(height: 10),
              Semantics(
                label: 'إضافة زر الدواء',
                child: ElevatedButton.icon(
                  onPressed: _addMedicationField,
                  icon: Icon(Icons.add),
                  label: Text('إضافة دواء'),
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Semantics(
                header: true,
                label: 'قسم الملاحظات الإضافية',
                child: Text(
                  'ملاحظات إضافية',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _instructionsController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'أي ملاحظات إضافية للمريض أو الصيدلي',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _createPrescription,
                  child: Text('حفظ الوصفة الطبية'),
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.all(16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMedicationCard(int index) {
    return Card(
      margin: EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Semantics(
                    header: true,
                    label: 'الدواء #${index + 1}',
                    child: Text(
                      'الدواء #${index + 1}',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                if (_medications.length > 1)
                  Semantics(
                    label: 'إزالة الدواء #${index + 1}',
                    child: IconButton(
                      icon: Icon(Icons.delete, color: Colors.red),
                      onPressed: () => _removeMedicationField(index),
                    ),
                  ),
              ],
            ),
            SizedBox(height: 10),
            Semantics(
              label: 'اسم الدواء #${index + 1}',
              child: TextFormField(
                initialValue: _medications[index]['name'],
                onChanged: (value) {
                  setState(() {
                    _medications[index]['name'] = value;
                  });
                },
                decoration: InputDecoration(
                  labelText: 'اسم الدواء *',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'الرجاء إدخال اسم الدواء';
                  }
                  return null;
                },
              ),
            ),
            SizedBox(height: 10),
            Semantics(
              label: 'الجرعة للدواء #${index + 1}',
              child: TextFormField(
                initialValue: _medications[index]['dosage'],
                onChanged: (value) {
                  setState(() {
                    _medications[index]['dosage'] = value;
                  });
                },
                decoration: InputDecoration(
                  labelText: 'الجرعة * (مثال: 500 مجم)',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'الرجاء إدخال الجرعة';
                  }
                  return null;
                },
              ),
            ),
            SizedBox(height: 10),
            Semantics(
              label: 'التكرار للدواء #${index + 1}',
              child: TextFormField(
                initialValue: _medications[index]['frequency'],
                onChanged: (value) {
                  setState(() {
                    _medications[index]['frequency'] = value;
                  });
                },
                decoration: InputDecoration(
                  labelText: 'التكرار * (مثال: يوميًا مرتين)',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'الرجاء إدخال التكرار';
                  }
                  return null;
                },
              ),
            ),
            SizedBox(height: 10),
            Semantics(
              label: 'المدة للدواء #${index + 1}',
              child: TextFormField(
                initialValue: _medications[index]['duration'],
                onChanged: (value) {
                  setState(() {
                    _medications[index]['duration'] = value;
                  });
                },
                decoration: InputDecoration(
                  labelText: 'المدة * (مثال: 7 أيام)',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'الرجاء إدخال المدة';
                  }
                  return null;
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
