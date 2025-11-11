import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../models/prescription_template_model.dart';
import '../../services/firestore_service.dart';
import '../../config/theme.dart';
import '../../utils/auth_debug.dart';

class PrescriptionTemplatesScreen extends StatefulWidget {
  const PrescriptionTemplatesScreen({super.key});

  @override
  State<PrescriptionTemplatesScreen> createState() => _PrescriptionTemplatesScreenState();
}

class _PrescriptionTemplatesScreenState extends State<PrescriptionTemplatesScreen> {
  final FirestoreService _firestoreService = FirestoreService();
  bool _isLoading = true;
  Stream<List<PrescriptionTemplate>>? _templatesStream;
  late final void Function() _loadTemplates;

  @override
  void initState() {
    super.initState();
    _loadTemplates = () {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final doctorId = authProvider.currentUser?.uid;
      final userRole = authProvider.userRole;

      print('DEBUG - Doctor ID: $doctorId');
      print('DEBUG - User Role: $userRole');
      print('DEBUG - Current User: ${authProvider.currentUser?.email}');
      
      // Debug auth claims to see what's actually available
      AuthDebug.printUserClaims();

      if (doctorId != null) {
        setState(() {
          _templatesStream = _firestoreService.getPrescriptionTemplates(doctorId);
          _isLoading = false;
        });
      }
    };
    _loadTemplates();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Prescription Templates'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: AppTheme.primaryGradient,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _createNewTemplate,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _templatesStream == null
              ? const Center(child: Text('No templates available'))
              : StreamBuilder<List<PrescriptionTemplate>>(
                  stream: _templatesStream,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    
                    if (snapshot.hasError) {
                      return Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.error_outline,
                                size: 64,
                                color: Colors.red,
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'Template Access Issue',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'The app needs permission to access template storage. This is a Firebase configuration issue.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Colors.grey[600],
                                ),
                              ),
                              const SizedBox(height: 24),
                              ElevatedButton(
                                onPressed: () async {
                                  // Force token refresh
                                  try {
                                    final authProvider = Provider.of<AuthProvider>(context, listen: false);
                                    await authProvider.currentUser?.getIdToken(true);
                                    print('DEBUG - Token refreshed');
                                  } catch (e) {
                                    print('DEBUG - Token refresh error: $e');
                                  }
                                  setState(() {
                                    _loadTemplates();
                                  });
                                },
                                child: const Text('Refresh Token & Try Again'),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'Error: ${snapshot.error}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey[500],
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      );
                    }
                    
                    if (!snapshot.hasData || snapshot.data!.isEmpty) {
                      return Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.receipt_long,
                              size: 64,
                              color: Colors.grey[400],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No prescription templates yet',
                              style: TextStyle(
                                fontSize: 18,
                                color: Colors.grey[600],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Create templates to speed up your workflow',
                              style: TextStyle(
                                color: Colors.grey[500],
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 24),
                            ElevatedButton(
                              onPressed: _createNewTemplate,
                              child: const Text('Create First Template'),
                            ),
                          ],
                        ),
                      );
                    }
                    
                    final templates = snapshot.data!;
                    return ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: templates.length,
                      itemBuilder: (context, index) {
                        final template = templates[index];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.all(16),
                            title: Text(
                              template.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                Text(
                                  'Condition: ${template.condition}',
                                  style: TextStyle(
                                    color: Colors.grey[600],
                                    fontSize: 14,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${template.medications.length} medications',
                                  style: TextStyle(
                                    color: Colors.grey[500],
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                            trailing: PopupMenuButton<String>(
                              onSelected: (value) {
                                switch (value) {
                                  case 'edit':
                                    _editTemplate(template);
                                    break;
                                  case 'delete':
                                    _deleteTemplate(template);
                                    break;
                                  case 'use':
                                    _useTemplate(template);
                                    break;
                                }
                              },
                              itemBuilder: (context) => [
                                const PopupMenuItem(
                                  value: 'use',
                                  child: Row(
                                    children: [
                                      Icon(Icons.check, size: 18),
                                      SizedBox(width: 8),
                                      Text('Use Template'),
                                    ],
                                  ),
                                ),
                                const PopupMenuItem(
                                  value: 'edit',
                                  child: Row(
                                    children: [
                                      Icon(Icons.edit, size: 18),
                                      SizedBox(width: 8),
                                      Text('Edit'),
                                    ],
                                  ),
                                ),
                                const PopupMenuItem(
                                  value: 'delete',
                                  child: Row(
                                    children: [
                                      Icon(Icons.delete, size: 18),
                                      SizedBox(width: 8),
                                      Text('Delete'),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
    );
  }

  void _createNewTemplate() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreatePrescriptionTemplateScreen(
          onTemplateSaved: _loadTemplates,
        ),
      ),
    );
  }

  void _editTemplate(PrescriptionTemplate template) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreatePrescriptionTemplateScreen(
          template: template,
          onTemplateSaved: _loadTemplates,
        ),
      ),
    );
  }

  void _deleteTemplate(PrescriptionTemplate template) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Template'),
        content: Text('Are you sure you want to delete "${template.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _firestoreService.deletePrescriptionTemplate(template.id);
        // No need to call _loadTemplates() as Stream will automatically update
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Template deleted successfully')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error deleting template: $e')),
          );
        }
      }
    }
  }

  void _useTemplate(PrescriptionTemplate template) {
    // Navigate back with the selected template
    Navigator.pop(context, template);
  }
}

class CreatePrescriptionTemplateScreen extends StatefulWidget {
  final PrescriptionTemplate? template;
  final VoidCallback onTemplateSaved;

  const CreatePrescriptionTemplateScreen({
    super.key,
    this.template,
    required this.onTemplateSaved,
  });

  @override
  State<CreatePrescriptionTemplateScreen> createState() => _CreatePrescriptionTemplateScreenState();
}

class _CreatePrescriptionTemplateScreenState extends State<CreatePrescriptionTemplateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _conditionController = TextEditingController();
  final _notesController = TextEditingController();

  List<PrescriptionItemTemplate> _medications = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.template != null) {
      _nameController.text = widget.template!.name;
      _conditionController.text = widget.template!.condition;
      _notesController.text = widget.template!.notes;
      _medications = List.from(widget.template!.medications);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.template == null ? 'Create Template' : 'Edit Template'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: AppTheme.primaryGradient,
          ),
        ),
        actions: [
          TextButton(
            onPressed: _saveTemplate,
            child: const Text(
              'Save',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextFormField(
                      controller: _nameController,
                      decoration: const InputDecoration(
                        labelText: 'Template Name',
                        hintText: 'e.g., Hypertension Treatment',
                      ),
                      validator: (value) =>
                          value?.isEmpty ?? true ? 'Required' : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _conditionController,
                      decoration: const InputDecoration(
                        labelText: 'Condition',
                        hintText: 'e.g., Essential Hypertension',
                      ),
                      validator: (value) =>
                          value?.isEmpty ?? true ? 'Required' : null,
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Medications',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ..._medications.map((medication) => _buildMedicationCard(medication)),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _addMedication,
                      icon: const Icon(Icons.add),
                      label: const Text('Add Medication'),
                    ),
                    const SizedBox(height: 24),
                    TextFormField(
                      controller: _notesController,
                      decoration: const InputDecoration(
                        labelText: 'Notes',
                        hintText: 'Additional instructions or notes',
                      ),
                      maxLines: 3,
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMedicationCard(PrescriptionItemTemplate medication) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    medication.medicationName,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.delete, color: Colors.red),
                  onPressed: () => _removeMedication(medication),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('Dosage: ${medication.defaultDosage}'),
            Text('Frequency: ${medication.defaultFrequency}'),
            Text('Duration: ${medication.defaultDuration} days'),
            if (medication.instructions.isNotEmpty)
              Text('Instructions: ${medication.instructions}'),
          ],
        ),
      ),
    );
  }

  void _addMedication() {
    showDialog(
      context: context,
      builder: (context) => AddMedicationDialog(
        onMedicationAdded: (medication) {
          setState(() => _medications.add(medication));
        },
      ),
    );
  }

  void _removeMedication(PrescriptionItemTemplate medication) {
    setState(() => _medications.remove(medication));
  }

  void _saveTemplate() async {
    if (!_formKey.currentState!.validate()) return;

    if (_medications.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one medication')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final doctorId = authProvider.currentUser!.uid;

      final template = PrescriptionTemplate(
        id: widget.template?.id ?? '',
        doctorId: doctorId,
        name: _nameController.text.trim(),
        condition: _conditionController.text.trim(),
        medications: _medications,
        notes: _notesController.text.trim(),
        createdAt: widget.template?.createdAt ?? DateTime.now(),
        updatedAt: DateTime.now(),
      );

      if (widget.template == null) {
        await FirestoreService().createPrescriptionTemplate(template);
      } else {
        await FirestoreService().updatePrescriptionTemplate(template);
      }

      widget.onTemplateSaved();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Template saved successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = 'Error saving template';
        if (e.toString().contains('permission-denied')) {
          errorMessage = 'Permission denied: Firebase needs to be configured to allow template storage';
        } else if (e.toString().contains('network')) {
          errorMessage = 'Network error: Please check your internet connection';
        }
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
            action: SnackBarAction(
              label: 'Details',
              textColor: Colors.white,
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Error Details'),
                    content: Text(e.toString()),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('OK'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }
}

class AddMedicationDialog extends StatefulWidget {
  final Function(PrescriptionItemTemplate) onMedicationAdded;

  const AddMedicationDialog({super.key, required this.onMedicationAdded});

  @override
  State<AddMedicationDialog> createState() => _AddMedicationDialogState();
}

class _AddMedicationDialogState extends State<AddMedicationDialog> {
  final _nameController = TextEditingController();
  final _dosageController = TextEditingController();
  final _frequencyController = TextEditingController();
  final _durationController = TextEditingController();
  final _instructionsController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add Medication'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Medication Name'),
            ),
            TextField(
              controller: _dosageController,
              decoration: const InputDecoration(labelText: 'Dosage (e.g., 10mg)'),
            ),
            TextField(
              controller: _frequencyController,
              decoration: const InputDecoration(labelText: 'Frequency (e.g., twice daily)'),
            ),
            TextField(
              controller: _durationController,
              decoration: const InputDecoration(labelText: 'Duration (days)'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: _instructionsController,
              decoration: const InputDecoration(labelText: 'Instructions'),
              maxLines: 2,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: _addMedication,
          child: const Text('Add'),
        ),
      ],
    );
  }

  void _addMedication() {
    if (_nameController.text.isEmpty) return;

    final medication = PrescriptionItemTemplate(
      medicationName: _nameController.text.trim(),
      defaultDosage: _dosageController.text.trim(),
      defaultFrequency: _frequencyController.text.trim(),
      defaultDuration: int.tryParse(_durationController.text) ?? 0,
      instructions: _instructionsController.text.trim(),
    );

    widget.onMedicationAdded(medication);
    Navigator.pop(context);
  }
}
