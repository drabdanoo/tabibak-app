import 'package:flutter/material.dart';

class DoctorStatsCard extends StatefulWidget {
  @override
  _DoctorStatsCardState createState() => _DoctorStatsCardState();
}

class _DoctorStatsCardState extends State<DoctorStatsCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _fadeAnimation = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.1),
          end: Offset.zero,
        ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut)),
        child: Card(
          margin: const EdgeInsets.all(16),
          elevation: 6,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Semantics(
                      label: 'Statistics icon',
                      child: Icon(
                        Icons.bar_chart,
                        color: Theme.of(context).primaryColor,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Semantics(
                      header: true,
                      label: 'Today\'s Statistics',
                      child: Text(
                        'Today\'s Statistics',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).primaryColor,
                            ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildAnimatedStatItem(context, '12', 'Appointments', 0),
                    _buildAnimatedStatItem(context, '10', 'Completed', 200),
                    _buildAnimatedStatItem(context, '2', 'Pending', 400),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAnimatedStatItem(
      BuildContext context, String number, String label, int delay) {
    return Semantics(
      label: '$label: $number',
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeOutBack,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Theme.of(context).primaryColor.withValues(alpha: 0.05),
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            TweenAnimationBuilder(
              tween: IntTween(begin: 0, end: int.tryParse(number) ?? 0),
              duration: Duration(milliseconds: 1000 + delay),
              builder: (context, int value, child) {
                return Semantics(
                  label: '$label count: $value',
                  child: Text(
                    '$value',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).primaryColor,
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 4),
            Semantics(
              label: '$label description',
              child: Text(
                label,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}