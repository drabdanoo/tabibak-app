import 'package:flutter/material.dart';
import '../models/appointment_model.dart';
import 'skeleton_loader.dart';

class DoctorAppointmentCard extends StatefulWidget {
  final AppointmentModel appointment;
  final VoidCallback? onTap;

  const DoctorAppointmentCard({Key? key, required this.appointment, this.onTap}) : super(key: key);

  @override
  _DoctorAppointmentCardState createState() => _DoctorAppointmentCardState();
}

class _DoctorAppointmentCardState extends State<DoctorAppointmentCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.95).animate(
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
    // Check if appointment data is loading
    final isLoading = widget.appointment.patientName.isEmpty;
    
    if (isLoading) {
      return Card(
        margin: const EdgeInsets.only(bottom: 10),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonLoader(
                width: 50,
                height: 50,
                isCircular: true,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonLoader(height: 16, width: 150),
                    const SizedBox(height: 8),
                    SkeletonLoader(height: 14, width: 100),
                    const SizedBox(height: 8),
                    SkeletonLoader(height: 14, width: 80),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) => _controller.reverse(),
      onTapCancel: () => _controller.reverse(),
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: Card(
          margin: const EdgeInsets.only(bottom: 10),
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: widget.appointment.status == 'confirmed'
                  ? LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Theme.of(context).colorScheme.surface,
                        Theme.of(context).primaryColor.withValues(alpha: 0.05),
                      ],
                    )
                  : null,
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              title: Semantics(
                label: 'Patient name: ${widget.appointment.patientName}',
                child: Text(
                  '${widget.appointment.patientName}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.access_time, size: 16),
                      const SizedBox(width: 4),
                      Semantics(
                        label: 'Appointment time: ${widget.appointment.appointmentTime}',
                        child: Text('${widget.appointment.appointmentTime}'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Semantics(
                    label: 'Appointment status: ${_getStatusText(widget.appointment.status)}',
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: widget.appointment.status == 'confirmed'
                            ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.1)
                            : Theme.of(context).colorScheme.secondary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _getStatusText(widget.appointment.status),
                        style: TextStyle(
                          color: widget.appointment.status == 'confirmed'
                              ? Theme.of(context).colorScheme.primary
                              : Theme.of(context).colorScheme.secondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                  if (widget.appointment.notes != null &&
                      widget.appointment.notes!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Semantics(
                      label: 'Appointment notes: ${widget.appointment.notes}',
                      child: Text(
                        'Notes: ${widget.appointment.notes}',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              trailing: Semantics(
                label: 'Status icon for ${_getStatusText(widget.appointment.status)} appointment',
                child: Icon(
                  widget.appointment.status == 'confirmed'
                      ? Icons.check_circle
                      : widget.appointment.status == 'completed'
                          ? Icons.done_all
                          : Icons.access_time,
                  color: widget.appointment.status == 'confirmed'
                      ? Theme.of(context).colorScheme.primary
                      : widget.appointment.status == 'completed'
                          ? Theme.of(context).colorScheme.tertiary
                          : Theme.of(context).colorScheme.secondary,
                  size: 28,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _getStatusText(String status) {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }
}