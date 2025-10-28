import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../providers/auth_provider.dart';
import '../models/message_model.dart';

class ChatScreen extends StatefulWidget {
  final String chatId;
  final String otherUserId;
  final String otherUserName;

  const ChatScreen({
    super.key,
    required this.chatId,
    required this.otherUserId,
    required this.otherUserName,
  });

  @override
  ChatScreenState createState() => ChatScreenState();
}

class ChatScreenState extends State<ChatScreen> {
  final TextEditingController _textController = TextEditingController();
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    // Load messages when screen initializes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final chatProvider = Provider.of<ChatProvider>(context, listen: false);
      chatProvider.loadChatMessages(widget.chatId);
      
      // Mark messages as read
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (authProvider.currentUser != null) {
        chatProvider.markMessagesAsRead(widget.chatId, authProvider.currentUser!.uid);
      }
    });

  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.otherUserName),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: authProvider.currentUser == null
          ? const Center(child: Text('Please log in to view chat'))
          : Column(
              children: [
                Expanded(
                  child: authProvider.currentUser != null
                      ? _buildMessageList(authProvider.currentUser!.uid)
                      : const Center(child: Text('User not found')),
                ),
                _buildMessageInput(authProvider.currentUser!.uid),
              ],
            ),
    );
  }

  Widget _buildMessageList(String currentUserId) {
    final chatProvider = Provider.of<ChatProvider>(context);
    
    if (chatProvider.messages.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.chat_bubble_outline,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              'No messages yet',
              style: TextStyle(
                fontSize: 18,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Start a conversation!',
              style: TextStyle(
                color: Colors.grey[500],
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: chatProvider.messages.length,
      itemBuilder: (context, index) {
        final message = chatProvider.messages[index];
        final isMe = message.senderId == currentUserId;
        
        return _buildMessageBubble(message, isMe);
      },
    );
  }

  Widget _buildMessageBubble(MessageModel message, bool isMe) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isMe 
              ? Theme.of(context).primaryColor 
              : Colors.grey[300],
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          message.content,
          style: TextStyle(
            color: isMe ? Colors.white : Colors.black87,
          ),
        ),
      ),
    );
  }

  Widget _buildMessageInput(String currentUserId) {
    return Container(
      padding: const EdgeInsets.all(8),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _textController,
              decoration: InputDecoration(
                hintText: 'Type a message...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none,
                ),
                filled: true,
                fillColor: Colors.grey[200],
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
              ),
              maxLines: null,
            ),
          ),
          IconButton(
            icon: _isSending
                ? const CircularProgressIndicator()
                : Icon(Icons.send, color: Theme.of(context).primaryColor),
            onPressed: _isSending ? null : () => _sendMessage(currentUserId),
          ),
        ],
      ),
    );
  }

  void _sendMessage(String currentUserId) async {
    if (_textController.text.trim().isEmpty) return;

    setState(() {
      _isSending = true;
    });

    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    final message = MessageModel(
      id: '',
      chatId: widget.chatId,
      senderId: currentUserId,
      content: _textController.text.trim(),
      timestamp: DateTime.now(),
      isRead: false,
    );
    final success = await chatProvider.sendMessage(
      widget.chatId,
      message,
    );

    if (success) {
      _textController.clear();
    } else {
      if (context.mounted) {
        // Show error message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(chatProvider.error ?? 'Failed to send message'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }

    setState(() {
      _isSending = false;
    });
  }
}
