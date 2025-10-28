import 'package:flutter/material.dart';

class FocusNodeManager {
  final List<FocusNode> _focusNodes = [];
  
  /// Create and register a new focus node
  FocusNode createNode() {
    final node = FocusNode();
    _focusNodes.add(node);
    return node;
  }
  
  /// Request focus for a specific node
  void requestFocus(FocusNode node) {
    node.requestFocus();
  }
  
  /// Move focus to the next node in the list
  void focusNext(BuildContext context) {
    if (_focusNodes.isEmpty) return;
    
    final currentFocus = FocusScope.of(context);
    currentFocus.nextFocus();
  }
  
  /// Move focus to the previous node in the list
  void focusPrevious(BuildContext context) {
    if (_focusNodes.isEmpty) return;
    
    final currentFocus = FocusScope.of(context);
    currentFocus.previousFocus();
  }
  
  /// Unfocus all nodes
  void unfocusAll(BuildContext context) {
    FocusScope.of(context).unfocus();
  }
  
  /// Dispose all focus nodes
  void dispose() {
    for (final node in _focusNodes) {
      node.dispose();
    }
    _focusNodes.clear();
  }
  
  /// Get the list of focus nodes
  List<FocusNode> get focusNodes => List.unmodifiable(_focusNodes);
}