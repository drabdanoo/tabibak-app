import 'package:cloud_firestore/cloud_firestore.dart';

class ChatModel {
  final String id;
  final String participant1Id;
  final String participant2Id;
  final String lastMessage;
  final DateTime lastMessageTime;
  final int unreadCount1;
  final int unreadCount2;

  // Computed properties
  String get lastMessageAt => lastMessageTime.toString();
  String get lastMessageSenderId => participant2Id; // Simplified - would need actual logic
  List<String> get participantNames => [participant1Id, participant2Id]; // Simplified

  ChatModel({
    required this.id,
    required this.participant1Id,
    required this.participant2Id,
    required this.lastMessage,
    required this.lastMessageTime,
    this.unreadCount1 = 0,
    this.unreadCount2 = 0,
  });

  factory ChatModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return ChatModel(
      id: doc.id,
      participant1Id: data['participant1Id'] ?? '',
      participant2Id: data['participant2Id'] ?? '',
      lastMessage: data['lastMessage'] ?? '',
      lastMessageTime: (data['lastMessageTime'] as Timestamp).toDate(),
      unreadCount1: data['unreadCount1'] ?? 0,
      unreadCount2: data['unreadCount2'] ?? 0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'participant1Id': participant1Id,
      'participant2Id': participant2Id,
      'lastMessage': lastMessage,
      'lastMessageTime': lastMessageTime,
      'unreadCount1': unreadCount1,
      'unreadCount2': unreadCount2,
    };
  }
}
