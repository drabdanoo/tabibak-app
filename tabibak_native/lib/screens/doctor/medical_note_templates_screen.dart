import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../models/medical_note_template_model.dart';
import '../../services/firestore_service.dart';
import '../../config/theme.dart';

class MedicalNoteTemplatesScreen extends StatefulWidget {
  const MedicalNoteTemplatesScreen({super.key});

  @override
  State<MedicalNoteTemplatesScreen> createState() => _MedicalNoteTemplatesScreenState();
}

class _MedicalNoteTemplatesScreenState extends State<MedicalNoteTemplatesScreen> {
  final FirestoreService _firestoreService = FirestoreService();
  bool _isLoading = true;
  Stream<List<MedicalNoteTemplate>>? _templatesStream;
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

      if (doctorId != null) {
        setState(() {
          _templatesStream = _firestoreService.getMedicalNoteTemplates(doctorId);
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
        title: const Text('Medical Note Templates'),
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
              : StreamBuilder<List<MedicalNoteTemplate>>(
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
                      return _buildEmptyState();
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
                                  '${template.commonFindings.length} common findings',
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

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.note_alt,
            size: 64,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            'No medical note templates yet',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Create templates to speed up your documentation',
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


  void _createNewTemplate() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreateMedicalNoteTemplateScreen(
          onTemplateSaved: _loadTemplates,
        ),
      ),
    );
  }

  void _editTemplate(MedicalNoteTemplate template) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreateMedicalNoteTemplateScreen(
          template: template,
          onTemplateSaved: _loadTemplates,
        ),
      ),
    );
  }

  void _deleteTemplate(MedicalNoteTemplate template) async {
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
        await _firestoreService.deleteMedicalNoteTemplate(template.id);
        _loadTemplates();
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

  void _useTemplate(MedicalNoteTemplate template) {
    // Navigate back with the selected template
    Navigator.pop(context, template);
  }
}

class CreateMedicalNoteTemplateScreen extends StatefulWidget {
  final MedicalNoteTemplate? template;
  final VoidCallback onTemplateSaved;

  const CreateMedicalNoteTemplateScreen({
    super.key,
    this.template,
    required this.onTemplateSaved,
  });

  @override
  State<CreateMedicalNoteTemplateScreen> createState() => _CreateMedicalNoteTemplateScreenState();
}

class _CreateMedicalNoteTemplateScreenState extends State<CreateMedicalNoteTemplateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _conditionController = TextEditingController();
  final _chiefComplaintController = TextEditingController();
  final _historyController = TextEditingController();
  final _examinationController = TextEditingController();
  final _assessmentController = TextEditingController();
  final _planController = TextEditingController();

  List<String> _commonFindings = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.template != null) {
      final template = widget.template!;
      _nameController.text = template.name;
      _conditionController.text = template.condition;
      _chiefComplaintController.text = template.chiefComplaint;
      _historyController.text = template.historyOfPresentIllness;
      _examinationController.text = template.physicalExamination;
      _assessmentController.text = template.assessment;
      _planController.text = template.plan;
      _commonFindings = List.from(template.commonFindings);
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
                        hintText: 'e.g., Routine Checkup',
                      ),
                      validator: (value) =>
                          value?.isEmpty ?? true ? 'Required' : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _conditionController,
                      decoration: const InputDecoration(
                        labelText: 'Condition',
                        hintText: 'e.g., General Health Check',
                      ),
                      validator: (value) =>
                          value?.isEmpty ?? true ? 'Required' : null,
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Medical Note Structure',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _chiefComplaintController,
                      decoration: const InputDecoration(
                        labelText: 'Chief Complaint',
                        hintText: 'Patient\'s main complaint',
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _historyController,
                      decoration: const InputDecoration(
                        labelText: 'History of Present Illness',
                        hintText: 'HPI template',
                      ),
                      maxLines: 3,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _examinationController,
                      decoration: const InputDecoration(
                        labelText: 'Physical Examination',
                        hintText: 'Examination findings template',
                      ),
                      maxLines: 3,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _assessmentController,
                      decoration: const InputDecoration(
                        labelText: 'Assessment',
                        hintText: 'Assessment template',
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _planController,
                      decoration: const InputDecoration(
                        labelText: 'Plan',
                        hintText: 'Treatment plan template',
                      ),
                      maxLines: 3,
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Common Findings',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        ..._commonFindings.map((finding) => Chip(
                          label: Text(finding),
                          onDeleted: () => _removeFinding(finding),
                        )),
                        ActionChip(
                          label: const Text('+ Add Finding'),
                          onPressed: _addFinding,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  void _addFinding() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Common Finding'),
        content: TextField(
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'e.g., Normal vital signs',
          ),
          onSubmitted: (value) {
            if (value.trim().isNotEmpty) {
              setState(() => _commonFindings.add(value.trim()));
              Navigator.pop(context);
            }
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }

  void _removeFinding(String finding) {
    setState(() => _commonFindings.remove(finding));
  }

  void _saveTemplate() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final doctorId = authProvider.currentUser!.uid;

      final template = MedicalNoteTemplate(
        id: widget.template?.id ?? '',
        doctorId: doctorId,
        name: _nameController.text.trim(),
        condition: _conditionController.text.trim(),
        chiefComplaint: _chiefComplaintController.text.trim(),
        historyOfPresentIllness: _historyController.text.trim(),
        physicalExamination: _examinationController.text.trim(),
        assessment: _assessmentController.text.trim(),
        plan: _planController.text.trim(),
        commonFindings: _commonFindings,
        createdAt: widget.template?.createdAt ?? DateTime.now(),
        updatedAt: DateTime.now(),
      );

      if (widget.template == null) {
        await FirestoreService().createMedicalNoteTemplate(template);
      } else {
        await FirestoreService().updateMedicalNoteTemplate(template);
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


