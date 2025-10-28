import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/chat_model.dart';
import '../models/message_model.dart';
import '../services/firestore_service.dart';
import 'dart:developer' as developer;

class ChatProvider with ChangeNotifier {
  final FirestoreService _firestoreService = FirestoreService();
  
  List<ChatModel> _chats = [];
  List<MessageModel> _messages = [];
  bool _isLoading = false;
  String? _error;

  List<ChatModel> get chats => _chats;
  List<MessageModel> get messages => _messages;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Create or get existing chat
  Future<String?> createOrGetChat(String userId1, String userId2) async {
    try {
      _setError(null);
      _setLoading(true);
      
      final chatId = await _firestoreService.createOrGetChat(userId1, userId2);
      
      _setLoading(false);
      return chatId;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return null;
    }
  }

  // Send a message
  Future<bool> sendMessage(String chatId, MessageModel message) async {
    try {
      _setError(null);
      _setLoading(true);
      
      await _firestoreService.sendMessage(chatId, message);
      
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }

  // Load user's chats
  void loadUserChats(String userId) {
    _setError(null);
    // We don't set loading to true here because this is a stream
    
    _firestoreService.getUserChats(userId).listen(
      (chatMaps) {
        _chats = chatMaps.map((map) {
          final lastMessageTime = map['lastMessageTime'];
          return ChatModel(
            id: map['id'] as String? ?? '',
            participant1Id: map['participant1Id'] as String? ?? '',
            participant2Id: map['participant2Id'] as String? ?? '',
            lastMessage: map['lastMessage'] as String? ?? '',
            lastMessageTime: lastMessageTime is Timestamp 
                ? lastMessageTime.toDate() 
                : DateTime.now(),
            unreadCount1: map['unreadCount1'] as int? ?? 0,
            unreadCount2: map['unreadCount2'] as int? ?? 0,
          );
        }).toList();
        notifyListeners();
      },
      onError: (error) {
        _setError(error.toString());
        notifyListeners();
      },
    );
  }

  // Load messages for a chat
  void loadChatMessages(String chatId) {
    _setError(null);
    // We don't set loading to true here because this is a stream
    
    _firestoreService.getChatMessages(chatId).listen(
      (messages) {
        _messages = messages;
        notifyListeners();
      },
      onError: (error) {
        _setError(error.toString());
        notifyListeners();
      },
    );
  }

  // Mark messages as read
  Future<void> markMessagesAsRead(String chatId, String userId) async {
    try {
      await _firestoreService.markMessagesAsRead(chatId, userId);
    } catch (e) {
      developer.log('Error marking messages as read: $e', name: 'ChatProvider', level: 900);
    }
  }

  // Get other participant's ID from a chat
  String getOtherParticipantId(ChatModel chat, String currentUserId) {
    return chat.participant1Id == currentUserId 
        ? chat.participant2Id 
        : chat.participant1Id;
  }

  // Get other participant's name from a chat
  String getOtherParticipantName(ChatModel chat, String currentUserId) {
    if (chat.participant1Id == currentUserId) {
      // Return participant 2's name
      return chat.participantNames.length > 1 ? chat.participantNames[1] : 'Unknown';
    } else {
      // Return participant 1's name
      return chat.participantNames.isNotEmpty ? chat.participantNames[0] : 'Unknown';
    }
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _setError(String? value) {
    _error = value;
    if (value != null) {
      developer.log('ChatProvider Error: $value', name: 'ChatProvider', level: 900);
    }
    notifyListeners();
  }

  void clearError() {
    _setError(null);
  }
}
