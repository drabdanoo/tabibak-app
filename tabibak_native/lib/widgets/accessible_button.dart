import 'package:flutter/material.dart';

class AccessibleButton extends StatelessWidget {
  final VoidCallback onPressed;
  final Widget child;
  final String? semanticLabel;
  final String? tooltip;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final EdgeInsetsGeometry? padding;
  final BorderSide? borderSide;
  final double? borderRadius;
  final double? elevation;
  final FocusNode? focusNode;
  final bool autofocus;

  const AccessibleButton({
    Key? key,
    required this.onPressed,
    required this.child,
    this.semanticLabel,
    this.tooltip,
    this.backgroundColor,
    this.foregroundColor,
    this.padding,
    this.borderSide,
    this.borderRadius,
    this.elevation,
    this.focusNode,
    this.autofocus = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final button = ElevatedButton(
      onPressed: onPressed,
      focusNode: focusNode,
      autofocus: autofocus,
      style: ElevatedButton.styleFrom(
        backgroundColor: backgroundColor ?? theme.primaryColor,
        foregroundColor: foregroundColor ?? theme.colorScheme.onPrimary,
        padding: padding ?? const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(borderRadius ?? 12),
          side: borderSide ?? BorderSide.none,
        ),
        elevation: elevation ?? 4,
      ),
      child: child,
    );

    Widget widget = Semantics(
      label: semanticLabel,
      button: true,
      child: button,
    );

    if (tooltip != null) {
      widget = Tooltip(
        message: tooltip!,
        child: widget,
      );
    }

    return widget;
  }
}