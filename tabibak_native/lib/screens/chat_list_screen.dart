import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import 'chat_screen.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  ChatListScreenState createState() => ChatListScreenState();
}

class ChatListScreenState extends State<ChatListScreen> {
  @override
  void initState() {
    super.initState();
    // Load user chats when screen initializes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final chatProvider = Provider.of<ChatProvider>(context, listen: false);
      chatProvider.loadUserChats(authProvider.currentUser!.uid);
    });
  }

  @override
  Widget build(BuildContext context) {
    final chatProvider = Provider.of<ChatProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('Messages'),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
      ),
      body: chatProvider.isLoading && chatProvider.chats.isEmpty
          ? Center(child: CircularProgressIndicator())
          : chatProvider.chats.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  itemCount: chatProvider.chats.length,
                  itemBuilder: (context, index) {
                    final chat = chatProvider.chats[index];
                    final otherParticipantName = chatProvider.getOtherParticipantName(
                      chat, 
                      authProvider.currentUser!.uid,
                    );
                    
                    return ListTile(
                      leading: CircleAvatar(
                        child: Text(
                          otherParticipantName.isNotEmpty 
                              ? otherParticipantName[0].toUpperCase() 
                              : '?',
                        ),
                      ),
                      title: Text(otherParticipantName),
                      subtitle: Text(
                        chat.lastMessage.isNotEmpty 
                            ? chat.lastMessage 
                            : 'No messages yet',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Text(
                        _formatTimestamp(chat.lastMessageAt),
                        style: TextStyle(
                          fontSize: 12,
                          color: chat.lastMessageSenderId == authProvider.currentUser!.uid
                              ? Colors.grey
                              : Theme.of(context).primaryColor,
                        ),
                      ),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => ChatScreen(
                              chatId: chat.id,
                              otherUserId: chatProvider.getOtherParticipantId(
                                chat, 
                                authProvider.currentUser!.uid,
                              ),
                              otherUserName: otherParticipantName,
                            ),
                          ),
                        );
                      },
                    );
                  },

                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.message_outlined,
            size: 64,
            color: Colors.grey[400],
          ),
          SizedBox(height: 16),
          Text(
            'No messages yet',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey[600],
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Start a conversation with your doctor or patient',
            style: TextStyle(
              color: Colors.grey[500],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  String _formatTimestamp(dynamic timestamp) {
    DateTime dateTime;
    
    if (timestamp is String) {
      // Try to parse the string timestamp
      try {
        dateTime = DateTime.parse(timestamp);
      } catch (e) {
        return 'Unknown';
      }
    } else if (timestamp is DateTime) {
      dateTime = timestamp;
    } else {
      return 'Unknown';
    }
    
    final now = DateTime.now();
    final difference = now.difference(dateTime);
    
    if (difference.inDays == 0) {
      return '${dateTime.hour}:${dateTime.minute.toString().padLeft(2, '0')}';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${dateTime.day}/${dateTime.month}/${dateTime.year}';
    }
  }
}
