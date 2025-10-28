import 'package:flutter/material.dart';
import '../services/notification_service.dart';

class NotificationSettingsScreen extends StatefulWidget {
  @override
  _NotificationSettingsScreenState createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends State<NotificationSettingsScreen> {
  bool _appointmentRemindersEnabled = true;
  bool _pushNotificationsEnabled = true;
  bool _smsNotificationsEnabled = false; // SMS would require additional backend services

  @override
  void initState() {
    super.initState();
    _loadNotificationPreferences();
  }

  Future<void> _loadNotificationPreferences() async {
    // TODO: Load user notification preferences from shared preferences or Firestore
    // For now, we'll use default values
    setState(() {
      _appointmentRemindersEnabled = true;
      _pushNotificationsEnabled = true;
      _smsNotificationsEnabled = false;
    });
  }

  Future<void> _saveNotificationPreferences() async {
    try {
      final notificationService = NotificationService();
      
      if (_appointmentRemindersEnabled) {
        await notificationService.subscribeToAppointmentReminders();
      } else {
        await notificationService.unsubscribeFromAppointmentReminders();
      }
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Notification settings saved successfully'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error saving notification settings: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Notification Settings'),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Manage your notification preferences',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    SwitchListTile(
                      title: Text('Appointment Reminders'),
                      subtitle: Text('Receive reminders for upcoming appointments'),
                      value: _appointmentRemindersEnabled,
                      onChanged: (value) {
                        setState(() {
                          _appointmentRemindersEnabled = value;
                        });
                      },
                    ),
                    Divider(),
                    SwitchListTile(
                      title: Text('Push Notifications'),
                      subtitle: Text('Receive push notifications on your device'),
                      value: _pushNotificationsEnabled,
                      onChanged: (value) {
                        setState(() {
                          _pushNotificationsEnabled = value;
                        });
                      },
                    ),
                    Divider(),
                    SwitchListTile(
                      title: Text('SMS Notifications'),
                      subtitle: Text('Receive SMS notifications (additional charges may apply)'),
                      value: _smsNotificationsEnabled,
                      onChanged: (value) {
                        setState(() {
                          _smsNotificationsEnabled = value;
                        });
                      },
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 20),
            Text(
              'Reminder Timing',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    ListTile(
                      title: Text('1 hour before appointment'),
                      trailing: Radio<String>(
                        value: '1_hour',
                        groupValue: '1_hour', // Default value
                        onChanged: (value) {
                          // Handle selection
                        },
                      ),
                    ),
                    Divider(),
                    ListTile(
                      title: Text('2 hours before appointment'),
                      trailing: Radio<String>(
                        value: '2_hours',
                        groupValue: '1_hour', // Default value
                        onChanged: (value) {
                          // Handle selection
                        },
                      ),
                    ),
                    Divider(),
                    ListTile(
                      title: Text('1 day before appointment'),
                      trailing: Radio<String>(
                        value: '1_day',
                        groupValue: '1_hour', // Default value
                        onChanged: (value) {
                          // Handle selection
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 30),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saveNotificationPreferences,
                child: Text('Save Settings'),
                style: ElevatedButton.styleFrom(
                  padding: EdgeInsets.all(16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}