import AsyncStorage from '@react-native-async-storage/async-storage';

const PREMIUM_STATUS_KEY = 'universe_premium_status';
const WATCH_HISTORY_KEY = 'universe_watch_history';
const WATCH_PROGRESS_KEY = 'universe_watch_progress';

export interface PremiumStatus {
  isPremium: boolean;
  plan: 'free' | 'premium' | 'premium_annual';
  expiresAt: string | null;
  features: PremiumFeatures;
}

export interface PremiumFeatures {
  noAds: boolean;
  hdQuality: boolean;
  exclusiveContent: boolean;
  earlyAccess: boolean;
  offlineDownloads: boolean;
  multipleDevices: number;
}

export interface WatchHistoryItem {
  filmId: string;
  title: string;
  posterUrl: string;
  duration: number;
  watchedAt: string;
  progress: number; // 0-100
  episodeId?: string;
  episodeNumber?: number;
  seasonNumber?: number;
}

const FREE_FEATURES: PremiumFeatures = {
  noAds: false,
  hdQuality: false,
  exclusiveContent: false,
  earlyAccess: false,
  offlineDownloads: false,
  multipleDevices: 1,
};

const PREMIUM_FEATURES: PremiumFeatures = {
  noAds: true,
  hdQuality: true,
  exclusiveContent: true,
  earlyAccess: true,
  offlineDownloads: true,
  multipleDevices: 4,
};

export const PREMIUM_PLANS = {
  free: {
    name: 'Gratuit',
    price: 0,
    features: FREE_FEATURES,
    limitations: ['Publicités', 'Qualité standard', 'Pas de téléchargement'],
  },
  premium: {
    name: 'Premium',
    price: 3.99,
    period: 'mois',
    features: PREMIUM_FEATURES,
    benefits: ['Sans publicité', 'Qualité HD', 'Contenus exclusifs', 'Téléchargement offline', '4 appareils'],
  },
  premium_annual: {
    name: 'Premium Annuel',
    price: 39.99,
    period: 'an',
    savings: '17%',
    features: PREMIUM_FEATURES,
    benefits: ['Sans publicité', 'Qualité HD', 'Contenus exclusifs', 'Téléchargement offline', '4 appareils'],
  },
};

export async function getPremiumStatus(): Promise<PremiumStatus> {
  try {
    const stored = await AsyncStorage.getItem(PREMIUM_STATUS_KEY);
    if (stored) {
      const status = JSON.parse(stored);
      // Check if expired
      if (status.expiresAt && new Date(status.expiresAt) < new Date()) {
        return getFreePremiumStatus();
      }
      return status;
    }
  } catch {}
  return getFreePremiumStatus();
}

function getFreePremiumStatus(): PremiumStatus {
  return {
    isPremium: false,
    plan: 'free',
    expiresAt: null,
    features: FREE_FEATURES,
  };
}

export async function activatePremium(plan: 'premium' | 'premium_annual'): Promise<PremiumStatus> {
  const expiresAt = new Date();
  if (plan === 'premium') {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  }
  
  const status: PremiumStatus = {
    isPremium: true,
    plan,
    expiresAt: expiresAt.toISOString(),
    features: PREMIUM_FEATURES,
  };
  
  await AsyncStorage.setItem(PREMIUM_STATUS_KEY, JSON.stringify(status));
  return status;
}

export async function cancelPremium(): Promise<PremiumStatus> {
  const status = getFreePremiumStatus();
  await AsyncStorage.setItem(PREMIUM_STATUS_KEY, JSON.stringify(status));
  return status;
}

// Watch History
export async function getWatchHistory(): Promise<WatchHistoryItem[]> {
  try {
    const stored = await AsyncStorage.getItem(WATCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function addToWatchHistory(item: Omit<WatchHistoryItem, 'watchedAt'>): Promise<void> {
  const history = await getWatchHistory();
  
  // Remove existing entry for same film
  const filtered = history.filter(h => h.filmId !== item.filmId);
  
  // Add new entry at beginning
  filtered.unshift({
    ...item,
    watchedAt: new Date().toISOString(),
  });
  
  // Keep only last 100 items
  const trimmed = filtered.slice(0, 100);
  await AsyncStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(trimmed));
}

export async function getWatchProgress(filmId: string): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(WATCH_PROGRESS_KEY);
    const progress = stored ? JSON.parse(stored) : {};
    return progress[filmId] || 0;
  } catch {
    return 0;
  }
}

export async function updateWatchProgress(filmId: string, progress: number): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(WATCH_PROGRESS_KEY);
    const allProgress = stored ? JSON.parse(stored) : {};
    allProgress[filmId] = Math.min(100, Math.max(0, progress));
    await AsyncStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(allProgress));
  } catch {}
}

export async function getContinueWatching(): Promise<WatchHistoryItem[]> {
  const history = await getWatchHistory();
  // Return films that are not complete (progress < 95%)
  return history.filter(h => h.progress < 95).slice(0, 10);
}

export function shouldShowAd(premiumStatus: PremiumStatus): boolean {
  return !premiumStatus.features.noAds;
}

export function getVideoQuality(premiumStatus: PremiumStatus): 'sd' | 'hd' | '4k' {
  return premiumStatus.features.hdQuality ? 'hd' : 'sd';
}

export function canAccessExclusiveContent(premiumStatus: PremiumStatus): boolean {
  return premiumStatus.features.exclusiveContent;
}
