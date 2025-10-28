import 'dart:io';
import 'package:flutter/material.dart';
import 'package:voice_note_kit/voice_note_kit.dart';
import '../../config/theme.dart';

class VoiceNotesScreen extends StatefulWidget {
  const VoiceNotesScreen({super.key});

  @override
  State<VoiceNotesScreen> createState() => _VoiceNotesScreenState();
}

class _VoiceNotesScreenState extends State<VoiceNotesScreen> {
  File? recordedFile;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Voice Notes'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: AppTheme.primaryGradient,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            Navigator.pop(context);
          },
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            const Expanded(
              child: Center(
                child: Text(
                  'Record voice notes to document patient information quickly and efficiently',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            VoiceRecorderWidget(
              iconSize: 80,
              showTimerText: true,
              showSwipeLeftToCancel: true,
              onRecorded: (file) {
                setState(() {
                  recordedFile = file;
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Recording saved: ${file.path}'),
                    action: SnackBarAction(
                      label: 'Play',
                      onPressed: () {
                        // Play the recorded audio
                        if (recordedFile != null) {
                          _playAudio(recordedFile!);
                        }
                      },
                    ),
                  ),
                );
              },
              onError: (error) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Error: $error')),
                );
              },
              actionWhenCancel: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Recording cancelled')),
                );
              },
              maxRecordDuration: const Duration(minutes: 5),
              permissionNotGrantedMessage: 'Microphone permission required to record voice notes',
              dragToLeftText: 'Swipe left to cancel recording',
              backgroundColor: AppTheme.primaryPurple,
              cancelHintColor: Colors.red,
              iconColor: Colors.white,
              timerFontSize: 16,
            ),
            const SizedBox(height: 20),
            if (recordedFile != null)
              AudioPlayerWidget(
                audioPath: recordedFile!.path,
                audioType: AudioType.file,
                playerStyle: PlayerStyle.style5,
                backgroundColor: AppTheme.primaryPurple,
                progressBarColor: Colors.white,
                progressBarBackgroundColor: Colors.white30,
                iconColor: Colors.white,
                showProgressBar: true,
                showTimer: true,
                width: double.infinity,
                audioSpeeds: const [0.5, 1.0, 1.5, 2.0],
              ),
          ],
        ),
      ),
    );
  }

  void _playAudio(File file) {
    // This will be handled by the AudioPlayerWidget
    // We just need to make sure the recordedFile is set
    setState(() {});
  }
}