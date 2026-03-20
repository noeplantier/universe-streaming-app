import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = 'universe_push_token';
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationService {
  token: string | null;
  initialize: () => Promise<string | null>;
  registerForPushNotifications: () => Promise<string | null>;
  savePushToken: (userId: string, token: string) => Promise<void>;
  sendLocalNotification: (title: string, body: string, data?: Record<string, any>) => Promise<string>;
  scheduleNotification: (title: string, body: string, triggerSeconds: number, data?: Record<string, any>) => Promise<string>;
  addNotificationReceivedListener: (callback: (notification: Notifications.Notification) => void) => () => void;
  addNotificationResponseListener: (callback: (response: Notifications.NotificationResponse) => void) => () => void;
  getBadgeCount: () => Promise<number>;
  setBadgeCount: (count: number) => Promise<void>;
}

class PushNotificationServiceImpl implements PushNotificationService {
  token: string | null = null;

  async initialize(): Promise<string | null> {
    // Check for saved token
    const savedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (savedToken) {
      this.token = savedToken;
      return savedToken;
    }

    // Register for push notifications
    return this.registerForPushNotifications();
  }

  async registerForPushNotifications(): Promise<string | null> {
    let token: string | null = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'UNIVERSE',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8C2EBA',
        sound: 'default',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      try {
        // Get Expo push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'universe-52b3b', // Your Firebase project ID
        });
        token = tokenData.data;
        this.token = token;

        // Save token locally
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      } catch (error) {
        console.error('Error getting push token:', error);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  async savePushToken(userId: string, token: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/users/${userId}/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ push_token: token }),
      });
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  async sendLocalNotification(title: string, body: string, data?: Record<string, any>): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Immediate
    });
  }

  async scheduleNotification(
    title: string,
    body: string,
    triggerSeconds: number,
    data?: Record<string, any>
  ): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: { seconds: triggerSeconds },
    });
  }

  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): () => void {
    const subscription = Notifications.addNotificationReceivedListener(callback);
    return () => subscription.remove();
  }

  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(callback);
    return () => subscription.remove();
  }

  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }
}

export const pushNotificationService = new PushNotificationServiceImpl();

// Notification templates for UNIVERSE app
export const NotificationMessages = {
  newFilm: (title: string, director: string) => ({
    title: '🎬 Nouvelle sortie !',
    body: `"${title}" de ${director} est maintenant disponible`,
  }),
  
  premiumActivated: () => ({
    title: '💎 Bienvenue dans Premium !',
    body: 'Profitez de tous les avantages exclusifs',
  }),
  
  continueWatching: (title: string, progress: number) => ({
    title: '▶️ Reprendre le visionnage',
    body: `Continuez "${title}" (${progress}% terminé)`,
  }),
  
  newFollower: (username: string) => ({
    title: '👥 Nouvel abonné',
    body: `${username} vous suit maintenant`,
  }),
  
  recommendation: (title: string) => ({
    title: '✨ Recommandé pour vous',
    body: `Découvrez "${title}" basé sur vos goûts`,
  }),
  
  weeklyDigest: (count: number) => ({
    title: '📊 Votre semaine sur UNIVERSE',
    body: `${count} nouveaux films cette semaine !`,
  }),
};
