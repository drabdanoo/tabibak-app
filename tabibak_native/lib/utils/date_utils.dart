class DateUtils {
  static String formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);
    
    if (difference.inDays == 0) {
      // Same day - show time
      return '${timestamp.hour}:${timestamp.minute.toString().padLeft(2, '0')}';
    } else if (difference.inDays == 1) {
      // Yesterday
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      // Within a week - show days
      return '${difference.inDays}d ago';
    } else {
      // More than a week - show date
      return '${timestamp.day}/${timestamp.month}/${timestamp.year}';
    }
  }
  
  static String formatChatDate(DateTime date) {
    final now = DateTime.now();
    
    if (date.year == now.year && date.month == now.month && date.day == now.day) {
      // Today - show time
      return '${date.hour}:${date.minute.toString().padLeft(2, '0')}';
    } else if (date.year == now.year && date.month == now.month && date.day == now.day - 1) {
      // Yesterday
      return 'Yesterday';
    } else if (date.year == now.year) {
      // Same year - show month and day
      return '${date.day}/${date.month}';
    } else {
      // Different year - show full date
      return '${date.day}/${date.month}/${date.year}';
    }
  }
}