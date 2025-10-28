import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz;
import 'package:flutter/foundation.dart';
import '../models/appointment_model.dart';
import 'dart:developer' as developer;

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    // Initialize timezone data
    tz.initializeTimeZones();

    // Request permission for notifications
    if (!kIsWeb) {
      await _firebaseMessaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      // Initialize local notifications
      const AndroidInitializationSettings androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      
      const InitializationSettings initializationSettings =
          InitializationSettings(
        android: androidSettings,
      );

      await _localNotificationsPlugin.initialize(
        initializationSettings,
        onDidReceiveNotificationResponse: onDidReceiveNotificationResponse,
      );

      // Handle background messages
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

      // Handle when user taps on notification
      FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);
    }
  }

  // Background message handler
  static Future<void> _firebaseMessagingBackgroundHandler(
      RemoteMessage message) async {
    // Handle background message
    developer.log('Background message received: ${message.notification?.title}', name: 'NotificationService');
  }

  // Handle foreground messages
  void _handleForegroundMessage(RemoteMessage message) {
    developer.log('Foreground message received: ${message.notification?.title}', name: 'NotificationService');
    
    // Show local notification
    _showLocalNotification(
      message.notification?.title ?? 'Appointment Reminder',
      message.notification?.body ?? 'You have an upcoming appointment',
    );
  }

  // Handle when user taps on notification
  void _handleMessageOpenedApp(RemoteMessage message) {
    developer.log('User tapped on notification: ${message.notification?.title}', name: 'NotificationService');
    // TODO: Navigate to appointment details screen
  }

  // Handle notification tap
  void onDidReceiveNotificationResponse(NotificationResponse response) {
    developer.log('Notification tapped: ${response.payload}', name: 'NotificationService');
    // TODO: Navigate to appointment details screen based on payload
  }

  // Parse appointment date and time
  DateTime? _parseAppointmentDateTime(String date, String time) {
    try {
      // Expected format: date = "DD/MM/YYYY", time = "HH:MM"
      final dateParts = date.split('/');
      final timeParts = time.split(':');
      
      if (dateParts.length == 3 && timeParts.length == 2) {
        return DateTime(
          int.parse(dateParts[2]), // year
          int.parse(dateParts[1]), // month
          int.parse(dateParts[0]), // day
          int.parse(timeParts[0]), // hour
          int.parse(timeParts[1]), // minute
        );
      }
    } catch (e) {
      developer.log('Error parsing appointment date/time: $e', name: 'NotificationService', level: 900);
    }
    return null;
  }

  // Show local notification
  Future<void> _showLocalNotification(String title, String body) async {
    if (!kIsWeb) {
      const AndroidNotificationDetails androidDetails =
          AndroidNotificationDetails(
        'appointment_reminder_channel',
        'Appointment Reminders',
        channelDescription: 'Reminders for upcoming appointments',
        importance: Importance.max,
        priority: Priority.high,
      );

      const NotificationDetails notificationDetails = NotificationDetails(
        android: androidDetails,
      );

      await _localNotificationsPlugin.show(
        DateTime.now().millisecondsSinceEpoch ~/ 1000,
        title,
        body,
        notificationDetails,
      );
    }
  }

  // Schedule appointment reminder
  Future<void> scheduleAppointmentReminder(AppointmentModel appointment) async {
    if (!kIsWeb && appointment.appointmentDate != null && appointment.appointmentTime != null) {
      try {
        // Calculate reminder time (1 hour before appointment)
        final appointmentDateTime = _parseAppointmentDateTime(
          appointment.appointmentDate!, 
          appointment.appointmentTime!
        );
        
        if (appointmentDateTime != null) {
          final reminderTime = appointmentDateTime.subtract(Duration(hours: 1));
          
          // Only schedule if reminder time is in the future
          if (reminderTime.isAfter(DateTime.now())) {
            // Create notification payload
            final title = 'Appointment Reminder';
            final body = 'You have an appointment with ${appointment.patientName} '
                'on ${appointment.appointmentDate} at ${appointment.appointmentTime}';
            
            // Schedule local notification
            const AndroidNotificationDetails androidDetails =
                AndroidNotificationDetails(
              'appointment_reminder_channel',
              'Appointment Reminders',
              channelDescription: 'Reminders for upcoming appointments',
              importance: Importance.max,
              priority: Priority.high,
            );

            const NotificationDetails notificationDetails = NotificationDetails(
              android: androidDetails,
            );

            await _localNotificationsPlugin.zonedSchedule(
              appointment.id.hashCode,
              title,
              body,
              tz.TZDateTime.from(reminderTime, tz.local),
              notificationDetails,
              androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
              uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
            );
            
            developer.log('Scheduled reminder for appointment ${appointment.id} at $reminderTime', name: 'NotificationService');
          }
        }
      } catch (e) {
        developer.log('Error scheduling appointment reminder: $e', name: 'NotificationService', level: 900);
      }
    }
  }

  Future<void> scheduleNotification({
    required int id,
    required String title,
    required String body,
    required DateTime scheduledDate,
    String? payload,
  }) async {
    try {
      // Only schedule if the date is in the future
      if (scheduledDate.isAfter(DateTime.now())) {
        const AndroidNotificationDetails androidDetails =
            AndroidNotificationDetails(
          'appointment_reminder_channel',
          'Appointment Reminders',
          channelDescription: 'Reminders for upcoming appointments',
          importance: Importance.max,
          priority: Priority.high,
        );

        const NotificationDetails notificationDetails = NotificationDetails(
          android: androidDetails,
        );

        await _localNotificationsPlugin.zonedSchedule(
          id,
          title,
          body,
          tz.TZDateTime.from(scheduledDate, tz.local),
          notificationDetails,
          androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
          uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
        );

        developer.log('Scheduled notification $id at $scheduledDate', name: 'NotificationService');
      }
    } catch (e) {
      developer.log('Error scheduling notification: $e', name: 'NotificationService', level: 900);
    }
  }

  // Subscribe to appointment reminders
  Future<void> subscribeToAppointmentReminders() async {
    try {
      if (!kIsWeb) {
        await _firebaseMessaging.subscribeToTopic('appointment_reminders');
        developer.log('Subscribed to appointment reminders', name: 'NotificationService');
      }
    } catch (e) {
      developer.log('Error subscribing to appointment reminders: $e', name: 'NotificationService', level: 900);
    }
  }

  // Unsubscribe from appointment reminders
  Future<void> unsubscribeFromAppointmentReminders() async {
    try {
      if (!kIsWeb) {
        await _firebaseMessaging.unsubscribeFromTopic('appointment_reminders');
        developer.log('Unsubscribed from appointment reminders', name: 'NotificationService');
      }
    } catch (e) {
      developer.log('Error unsubscribing from appointment reminders: $e', name: 'NotificationService', level: 900);
    }
  }
}