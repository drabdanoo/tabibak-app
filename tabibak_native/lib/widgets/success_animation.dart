import 'package:flutter/material.dart';

class SuccessAnimation extends StatefulWidget {
  final double size;
  final Color? color;
  final VoidCallback? onAnimationComplete;

  const SuccessAnimation({
    Key? key,
    this.size = 100.0,
    this.color,
    this.onAnimationComplete,
  }) : super(key: key);

  @override
  _SuccessAnimationState createState() => _SuccessAnimationState();
}

class _SuccessAnimationState extends State<SuccessAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );

    _scaleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: Curves.elasticOut,
      ),
    );

    _opacityAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.8, curve: Curves.easeOut),
      ),
    );

    // Start the animation
    _controller.forward().then((_) {
      // Wait a bit and then call the completion callback
      Future.delayed(const Duration(milliseconds: 1000), () {
        if (widget.onAnimationComplete != null) {
          widget.onAnimationComplete!();
        }
      });
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? Theme.of(context).colorScheme.tertiary;

    return ScaleTransition(
      scale: _scaleAnimation,
      child: FadeTransition(
        opacity: _opacityAnimation,
        child: Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color.withValues(alpha: 0.1),
          ),
          child: Center(
            child: Icon(
              Icons.check,
              color: color,
              size: widget.size * 0.6,
            ),
          ),
        ),
      ),
    );
  }
}