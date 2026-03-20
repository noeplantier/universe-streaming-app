import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_SETTINGS_KEY = 'universe_notification_settings';
const NOTIFICATION_HISTORY_KEY = 'universe_notification_history';

export interface NotificationSettings {
  enabled: boolean;
  newReleases: boolean;
  recommendations: boolean;
  social: boolean;
  promotions: boolean;
}

export interface AppNotification {
  id: string;
  type: 'new_release' | 'recommendation' | 'social' | 'promotion' | 'system';
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
  imageUrl?: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  newReleases: true,
  recommendations: true,
  social: true,
  promotions: false,
};

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

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
  const current = await getNotificationSettings();
  const updated = { ...current, ...settings };
  await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

export async function getNotificationHistory(): Promise<AppNotification[]> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function addNotification(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): Promise<AppNotification> {
  const history = await getNotificationHistory();
  const newNotification: AppNotification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  
  history.unshift(newNotification);
  // Keep only last 50 notifications
  const trimmed = history.slice(0, 50);
  await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(trimmed));
  
  return newNotification;
}

export async function markNotificationRead(id: string): Promise<void> {
  const history = await getNotificationHistory();
  const updated = history.map(n => n.id === id ? { ...n, read: true } : n);
  await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
}

export async function markAllNotificationsRead(): Promise<void> {
  const history = await getNotificationHistory();
  const updated = history.map(n => ({ ...n, read: true }));
  await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
}

export async function getUnreadCount(): Promise<number> {
  const history = await getNotificationHistory();
  return history.filter(n => !n.read).length;
}

export async function scheduleLocalNotification(title: string, body: string, data?: Record<string, any>, delaySeconds: number = 0): Promise<string> {
  const settings = await getNotificationSettings();
  if (!settings.enabled) return '';
  
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: delaySeconds > 0 ? { seconds: delaySeconds } : null,
  });
  
  return id;
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Pre-built notification templates
export const NotificationTemplates = {
  newFilmRelease: (filmTitle: string, director: string) => ({
    type: 'new_release' as const,
    title: '🎬 Nouvelle sortie !',
    body: `"${filmTitle}" de ${director} est maintenant disponible`,
  }),
  
  recommendation: (filmTitle: string) => ({
    type: 'recommendation' as const,
    title: '✨ Recommandé pour vous',
    body: `Basé sur vos goûts, découvrez "${filmTitle}"`,
  }),
  
  socialActivity: (username: string, action: string) => ({
    type: 'social' as const,
    title: '👥 Activité sociale',
    body: `${username} ${action}`,
  }),
  
  continueWatching: (filmTitle: string, progress: number) => ({
    type: 'system' as const,
    title: '▶️ Reprendre le visionnage',
    body: `Continuez "${filmTitle}" (${progress}% terminé)`,
  }),
  
  premium: () => ({
    type: 'promotion' as const,
    title: '💎 Passez à Premium',
    body: 'Profitez de HD, sans pub et contenus exclusifs à 3,99€/mois',
  }),
};
