import 'package:flutter/material.dart';

class CustomIllustration extends StatelessWidget {
  const CustomIllustration({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 120,
      height: 120,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Theme.of(context).primaryColor.withValues(alpha: 0.1),
      ),
      child: Center(
        child: Icon(
          Icons.inbox,
          size: 60,
          color: Theme.of(context).primaryColor,
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  final String title;
  final String message;
  final IconData? icon;
  final VoidCallback? onRetry;
  final String? retryText;
  final bool useCustomIllustration;

  const EmptyState({
    Key? key,
    required this.title,
    required this.message,
    this.icon,
    this.onRetry,
    this.retryText,
    this.useCustomIllustration = true,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (useCustomIllustration) ...[
              CustomIllustration(),
              const SizedBox(height: 24),
            ] else if (icon != null) ...[
              Icon(
                icon,
                size: 80,
                color: Theme.of(context).primaryColor.withValues(alpha: 0.3),
              ),
              const SizedBox(height: 24),
            ],
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                  ),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: onRetry,
                child: Text(retryText ?? 'Try Again'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}