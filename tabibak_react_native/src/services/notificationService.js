import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getFirestore, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../config/firebase';

const db = getFirestore();

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.db = db;
    this.notificationListener = null;
    this.responseListener = null;
  }

  /**
   * Request notification permissions
   * @returns {Promise<boolean>} - Whether permission was granted
   */
  async requestPermissions() {
    try {
      if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push notification permissions');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Get Expo Push Token
   * @returns {Promise<string|null>} - The push token
   */
  async getExpoPushToken() {
    try {
      if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return null;
      }

      // Try to get projectId from multiple sources for better compatibility
      const projectId = 
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.manifest?.extra?.eas?.projectId ||
        process.env.EXPO_PROJECT_ID;
      
      // Allow running without projectId in development
      if (!projectId) {
        console.warn('Project ID not found. Push notifications will not work. This is expected in development.');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      return token.data;
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      return null;
    }
  }

  /**
   * Register device token with Firestore
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @returns {Promise<boolean>}
   */
  async registerDeviceToken(userId, role) {
    try {
      const hasPermission = await this.requestPermissions();
      
      if (!hasPermission) {
        console.log('Notification permissions not granted');
        return false;
      }

      const token = await this.getExpoPushToken();
      
      if (!token) {
        console.log('Failed to get push token');
        return false;
      }

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });

        // Channel for appointment reminders
        await Notifications.setNotificationChannelAsync('appointments', {
          name: 'Appointment Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
      }

      // Save token to Firestore
      const tokenDocRef = doc(this.db, COLLECTIONS.USER_TOKENS, userId);
      await setDoc(tokenDocRef, {
        userId,
        role,
        token,
        platform: Platform.OS,
        deviceInfo: {
          brand: Device.brand,
          modelName: Device.modelName,
          osName: Device.osName,
          osVersion: Device.osVersion,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      console.log('Device token registered successfully');
      return true;
    } catch (error) {
      console.error('Error registering device token:', error);
      return false;
    }
  }

  /**
   * Unregister device token (on logout)
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async unregisterDeviceToken(userId) {
    try {
      const tokenDocRef = doc(this.db, COLLECTIONS.USER_TOKENS, userId);
      await deleteDoc(tokenDocRef);
      console.log('Device token unregistered');
      return true;
    } catch (error) {
      // Gracefully handle permissions errors
      if (error.code === 'permission-denied') {
        console.warn('Permission denied when unregistering device token. This is expected if user does not have delete permissions.');
        // Return true since the user is logging out anyway
        return true;
      }
      console.error('Error unregistering device token:', error);
      // Don't block logout on token unregistration failure
      return true;
    }
  }

  /**
   * Setup notification listeners
   * @param {function} onNotificationReceived - Callback when notification is received
   * @param {function} onNotificationTapped - Callback when notification is tapped
   */
  setupNotificationListeners(onNotificationReceived, onNotificationTapped) {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response);
      if (onNotificationTapped) {
        onNotificationTapped(response);
      }
    });
  }

  /**
   * Remove notification listeners
   */
  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }

    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  /**
   * Schedule a local notification
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {object} data - Additional data
   * @param {Date} triggerDate - When to trigger (optional, immediate if not provided)
   * @returns {Promise<string>} - Notification identifier
   */
  async scheduleNotification(title, body, data = {}, triggerDate = null) {
    try {
      const trigger = triggerDate 
        ? { date: triggerDate }
        : null; // null means immediate

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger,
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   * @param {string} notificationId - Notification identifier
   */
  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  /**
   * Get badge count
   * @returns {Promise<number>}
   */
  async getBadgeCount() {
    try {
      const count = await Notifications.getBadgeCountAsync();
      return count;
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set badge count
   * @param {number} count - Badge count
   */
  async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  /**
   * Play notification sound (for custom alerts like receptionist inbox)
   */
  async playNotificationSound() {
    try {
      // Schedule an immediate local notification with sound
      await this.scheduleNotification(
        'New Appointment',
        'You have a new appointment request',
        { type: 'new_appointment' }
      );
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }
}

export default new NotificationService();
