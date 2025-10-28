import 'package:flutter/material.dart';
import '../models/doctor_model.dart';
import 'skeleton_loader.dart';

class DoctorCard extends StatefulWidget {
  final DoctorModel doctor;
  final VoidCallback? onTap;

  DoctorCard({required this.doctor, this.onTap});

  @override
  _DoctorCardState createState() => _DoctorCardState();
}

class _DoctorCardState extends State<DoctorCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  bool _isHovered = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.02).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Check if doctor data is loading
    final isLoading = widget.doctor.name.isEmpty;
    
    if (isLoading) {
      return Card(
        margin: const EdgeInsets.all(8),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonLoader(
                width: 60,
                height: 60,
                isCircular: true,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonLoader(height: 18, width: 150),
                    const SizedBox(height: 8),
                    SkeletonLoader(height: 16, width: 100),
                    const SizedBox(height: 8),
                    SkeletonLoader(height: 14, width: double.infinity),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }
    
    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => _controller.forward(),
        onTapUp: (_) => _controller.reverse(),
        onTapCancel: () => _controller.reverse(),
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: Card(
            margin: const EdgeInsets.all(8),
            elevation: _isHovered ? 8 : 4,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: _isHovered
                    ? LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Theme.of(context).cardColor,
                          Theme.of(context).primaryColor.withValues(alpha: 0.05),
                        ],
                      )
                    : null,
              ),
              child: ListTile(
                contentPadding: const EdgeInsets.all(16),
                leading: Hero(
                  tag: 'doctor_${widget.doctor.id}',
                  child: Semantics(
                    label: 'Doctor profile picture',
                    child: CircleAvatar(
                      radius: 30,
                      backgroundImage: widget.doctor.profileImageUrl != null
                          ? NetworkImage(widget.doctor.profileImageUrl!)
                          : null,
                      child: widget.doctor.profileImageUrl == null
                          ? Icon(Icons.person, size: 30)
                          : null,
                      backgroundColor: _isHovered
                          ? Theme.of(context).primaryColor.withValues(alpha: 0.1)
                          : null,
                    ),
                  ),
                ),
                title: Semantics(
                  label: 'Doctor name: Dr. ${widget.doctor.name}',
                  child: Text(
                    'Dr. ${widget.doctor.name}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                      color: _isHovered ? Theme.of(context).primaryColor : null,
                    ),
                  ),
                ),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(height: 4),
                    Semantics(
                      label: 'Specialty: ${widget.doctor.specialty}',
                      child: Text(
                        widget.doctor.specialty,
                        style: TextStyle(
                          color: Theme.of(context).primaryColor,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    SizedBox(height: 4),
                    if (widget.doctor.bio != null && widget.doctor.bio!.isNotEmpty)
                      Semantics(
                        label: 'Doctor bio: ${widget.doctor.bio}',
                        child: Text(
                          widget.doctor.bio!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
                trailing: Semantics(
                  label: 'Navigate to doctor details',
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.arrow_forward_ios,
                        size: 16,
                        color: _isHovered ? Theme.of(context).primaryColor : Colors.grey,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}