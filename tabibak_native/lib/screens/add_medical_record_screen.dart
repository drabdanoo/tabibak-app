import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/medical_record_provider.dart';
import '../models/medical_record_model.dart';

class AddMedicalRecordScreen extends StatefulWidget {
  final MedicalRecord? record;

  const AddMedicalRecordScreen({super.key, this.record});

  @override
  AddMedicalRecordScreenState createState() => AddMedicalRecordScreenState();
}

class AddMedicalRecordScreenState extends State<AddMedicalRecordScreen> {
  final _formKey = GlobalKey<FormState>();
  
  late String _title;
  late String _description;
  late String _category;
  late DateTime _date;
  String? _doctorName;
  String? _hospitalName;
  String? _notes;
  
  final List<String> _categories = [
    'Allergy',
    'Medication',
    'Treatment',
    'Diagnosis',
    'Surgery',
    'Vaccination',
    'Other',
  ];

  @override
  void initState() {
    super.initState();
    
    if (widget.record != null) {
      _title = widget.record!.title;
      _description = widget.record!.description;
      _category = widget.record!.category;
      _date = widget.record!.date;
      _doctorName = widget.record!.doctorName;
      _hospitalName = widget.record!.hospitalName;
      _notes = widget.record!.notes;
    } else {
      _title = '';
      _description = '';
      _category = _categories[0];
      _date = DateTime.now();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
        title: Text(widget.record != null ? 'Edit Record' : 'Add Record'),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.record != null ? 'Edit Medical Record' : 'Add Medical Record',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              SizedBox(height: 8),
              Text(
                'Fill in the details of your medical record',
                style: TextStyle(
                  color: Colors.grey[600],
                ),
              ),
              SizedBox(height: 24),
              
              // Title field
              _buildTextField(
                label: 'Title',
                hint: 'e.g., Penicillin Allergy',
                initialValue: _title,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter a title';
                  }
                  return null;
                },
                onSaved: (value) => _title = value!,
              ),
              
              SizedBox(height: 16),
              
              // Description field
              _buildTextField(
                label: 'Description',
                hint: 'Detailed description',
                initialValue: _description,
                maxLines: 3,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter a description';
                  }
                  return null;
                },
                onSaved: (value) => _description = value!,
              ),
              
              SizedBox(height: 16),
              
              // Category dropdown
              _buildCategoryDropdown(),
              
              SizedBox(height: 16),
              
              // Date picker
              _buildDatePicker(),
              
              SizedBox(height: 16),
              
              // Doctor name field
              _buildTextField(
                label: 'Doctor Name (Optional)',
                hint: 'Name of the treating doctor',
                initialValue: _doctorName,
                onSaved: (value) => _doctorName = value,
              ),
              
              SizedBox(height: 16),
              
              // Hospital name field
              _buildTextField(
                label: 'Hospital/Clinic (Optional)',
                hint: 'Name of the hospital or clinic',
                initialValue: _hospitalName,
                onSaved: (value) => _hospitalName = value,
              ),
              
              SizedBox(height: 16),
              
              // Notes field
              _buildTextField(
                label: 'Notes (Optional)',
                hint: 'Additional notes',
                initialValue: _notes,
                maxLines: 2,
                onSaved: (value) => _notes = value,
              ),
              
              SizedBox(height: 32),
              
              // Save button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submitForm,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: Text(
                    widget.record != null ? 'Update Record' : 'Add Record',
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
              ),
              
              if (widget.record != null) ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: _deleteRecord,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: const Text(
                      'Delete Record',
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.red,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required String label,
    required String hint,
    required FormFieldSetter<String> onSaved,
    String? initialValue,
    int maxLines = 1,
    FormFieldValidator<String>? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w500,
            fontSize: 16,
          ),
        ),
        SizedBox(height: 8),
        TextFormField(
          initialValue: initialValue,
          decoration: InputDecoration(
            hintText: hint,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            contentPadding: EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
          ),
          maxLines: maxLines,
          validator: validator,
          onSaved: onSaved,
        ),
      ],
    );
  }

  Widget _buildCategoryDropdown() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Category',
          style: TextStyle(
            fontWeight: FontWeight.w500,
            fontSize: 16,
          ),
        ),
        SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _category,
          decoration: InputDecoration(
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            contentPadding: EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
          ),
          items: _categories.map((String category) {
            return DropdownMenuItem<String>(
              value: category,
              child: Text(category),
            );
          }).toList(),
          onChanged: (value) {
            if (value != null) {
              setState(() {
                _category = value;
              });
            }
          },
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please select a category';
            }
            return null;
          },
          onSaved: (value) => _category = value!,
        ),
      ],
    );
  }

  Widget _buildDatePicker() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Date',
          style: TextStyle(
            fontWeight: FontWeight.w500,
            fontSize: 16,
          ),
        ),
        SizedBox(height: 8),
        TextFormField(
          decoration: InputDecoration(
            hintText: 'Select date',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            contentPadding: EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
            suffixIcon: Icon(Icons.calendar_today),
          ),
          controller: TextEditingController(
            text: '${_date.day}/${_date.month}/${_date.year}',
          ),
          readOnly: true,
          onTap: () async {
            DateTime? pickedDate = await showDatePicker(
              context: context,
              initialDate: _date,
              firstDate: DateTime(1900),
              lastDate: DateTime.now(),
            );
            
            if (pickedDate != null) {
              setState(() {
                _date = pickedDate;
              });
            }
          },
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please select a date';
            }
            return null;
          },
        ),
      ],
    );
  }

  void _submitForm() async {
    if (_formKey.currentState!.validate()) {
      _formKey.currentState!.save();
      
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final medicalRecordProvider = Provider.of<MedicalRecordProvider>(context, listen: false);
      
      final record = MedicalRecord(
        id: widget.record?.id ?? '',
        patientId: authProvider.currentUser!.uid,
        title: _title,
        description: _description,
        category: _category,
        date: _date,
        doctorName: _doctorName,
        hospitalName: _hospitalName,
        notes: _notes,
        createdAt: widget.record?.createdAt ?? DateTime.now(),
      );
      
      bool success;
      if (widget.record != null) {
        // Update existing record
        success = await medicalRecordProvider.updateMedicalRecord(
          widget.record!.id,
          record.toMap(),
        );
      } else {
        // Add new record
        success = await medicalRecordProvider.addMedicalRecord(record);
      }
      
      // Capture the context to ensure we can safely use it after async operations
      BuildContext currentContext = context;
      
      if (success) {
        if (currentContext.mounted) {
          ScaffoldMessenger.of(currentContext).showSnackBar(
            SnackBar(
              content: Text(
                widget.record != null 
                    ? 'Record updated successfully' 
                    : 'Record added successfully',
              ),
              backgroundColor: Colors.green,
            ),
          );
          
          if (currentContext.mounted) {
            Navigator.pop(currentContext);
          }
        }
      } else {
        if (currentContext.mounted) {
          ScaffoldMessenger.of(currentContext).showSnackBar(
            SnackBar(
              content: Text(
                medicalRecordProvider.error ?? 
                    (widget.record != null 
                        ? 'Failed to update record' 
                        : 'Failed to add record'),
              ),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  void _deleteRecord() async {
    if (widget.record != null) {
      final medicalRecordProvider = Provider.of<MedicalRecordProvider>(context, listen: false);
      
      bool success = await medicalRecordProvider.deleteMedicalRecord(widget.record!.id);
      
      // Capture the context to ensure we can safely use it after async operations
      BuildContext currentContext = context;
      
      if (success) {
        if (currentContext.mounted) {
          ScaffoldMessenger.of(currentContext).showSnackBar(
            SnackBar(
              content: Text('Record deleted successfully'),
              backgroundColor: Colors.green,
            ),
          );
          
          if (currentContext.mounted) {
            Navigator.pop(currentContext);
          }
        }
      } else {
        if (currentContext.mounted) {
          ScaffoldMessenger.of(currentContext).showSnackBar(
            SnackBar(
              content: Text(
                medicalRecordProvider.error ?? 'Failed to delete record',
              ),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }
}
