import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/medical_record_provider.dart';
import 'skeleton_loader.dart';

class AllergiesList extends StatefulWidget {
  @override
  _AllergiesListState createState() => _AllergiesListState();
}

class _AllergiesListState extends State<AllergiesList>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final medicalRecordProvider = Provider.of<MedicalRecordProvider>(context);
    final allergies = medicalRecordProvider.getRecordsByCategory('Allergy');
    
    // Check if data is loading
    final isLoading = medicalRecordProvider.isLoading;
    
    if (isLoading) {
      return Card(
        margin: const EdgeInsets.all(16),
        color: Colors.red[50],
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  SkeletonLoader(
                    width: 28,
                    height: 28,
                    borderRadius: BorderRadius.circular(4),
                    margin: const EdgeInsets.only(right: 10),
                  ),
                  Expanded(
                    child: SkeletonLoader(height: 20, width: 100),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ...List.generate(2, (index) => index).map((index) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      SkeletonLoader(
                        width: 24,
                        height: 24,
                        borderRadius: BorderRadius.circular(4),
                        margin: const EdgeInsets.only(right: 12),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SkeletonLoader(height: 16, width: 100),
                            const SizedBox(height: 4),
                            SkeletonLoader(height: 14, width: 150),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ],
          ),
        ),
      );
    }
    
    if (allergies.isEmpty) {
      return Container(); // Return empty container if no allergies
    }
    
    return FadeTransition(
      opacity: _animation,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.1),
          end: Offset.zero,
        ).animate(_animation),
        child: Card(
          margin: const EdgeInsets.all(16),
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          color: Colors.red[50],
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Semantics(
                      label: 'Allergy warning icon',
                      child: Icon(
                        Icons.warning_amber_rounded,
                        color: Colors.red[700],
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Semantics(
                      header: true,
                      label: 'Allergies',
                      child: Text(
                        'Allergies',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.red[700],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ...allergies.asMap().entries.map((entry) {
                  int idx = entry.key;
                  var allergy = entry.value;
                  return _buildAnimatedAllergyItem(context, allergy, idx);
                }).toList(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAnimatedAllergyItem(BuildContext context, var allergy, int index) {
    return Semantics(
      label: 'Allergy: ${allergy.name}, ${allergy.description ?? ''}',
      child: AnimatedContainer(
        duration: Duration(milliseconds: 300 + (index * 100)),
        curve: Curves.easeOut,
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Colors.red[100],
        ),
        child: ListTile(
          leading: Semantics(
            label: 'Allergy icon',
            child: Icon(
              Icons.warning_amber_outlined,
              color: Colors.red[700],
            ),
          ),
          title: Semantics(
            label: 'Allergy name: ${allergy.name}',
            child: Text(
              allergy.name,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.red,
              ),
            ),
          ),
          subtitle: allergy.description != null
              ? Semantics(
                  label: 'Allergy description: ${allergy.description}',
                  child: Text(
                    allergy.description ?? '',
                    style: const TextStyle(color: Colors.red),
                  ),
                )
              : null,
          trailing: Semantics(
            label: 'Allergy warning',
            child: Icon(
              Icons.error_outline,
              color: Colors.red[700],
            ),
          ),
        ),
      ),
    );
  }
}