import 'package:flutter/material.dart';

class FocusManagerUtil {
  /// Request focus for a specific node and scroll to it if needed
  static void requestFocusAndScroll(
    BuildContext context,
    FocusNode focusNode,
    ScrollController? scrollController,
    double offset,
  ) {
    focusNode.requestFocus();
    
    if (scrollController != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (scrollController.hasClients) {
          scrollController.animateTo(
            offset,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      });
    }
  }

  /// Move focus to the next focusable widget in the scope
  static void focusNext(BuildContext context) {
    FocusScope.of(context).nextFocus();
  }

  /// Move focus to the previous focusable widget in the scope
  static void focusPrevious(BuildContext context) {
    FocusScope.of(context).previousFocus();
  }

  /// Unfocus the current widget
  static void unfocus(BuildContext context) {
    FocusScope.of(context).unfocus();
  }

  /// Check if a widget has focus
  static bool hasFocus(FocusNode focusNode) {
    return focusNode.hasFocus;
  }
}