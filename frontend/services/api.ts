// services/api.ts — UNIVERSE
// ─────────────────────────────────────────────────────────────────────────────
// ZÉRO appel Supabase Auth → zéro 402, zéro signup, zéro paiement.
//
// Identité utilisateur = UUID v4 généré une fois, persisté en SecureStore.
// Toutes les requêtes Supabase utilisent la clé `anon` (gratuite, toujours
// disponible). Les RLS sont USING (true) → accessible sans JWT.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface User {
  id:                  string;  // device UUID — stable par appareil
  username:            string;
  email:               string;
  avatar_url:          string;
  bio:                 string;
  role:                string;
  display_name:        string;
  location:            string;
  website:             string;
  is_verified:         boolean;
  is_pro:              boolean;
  is_industry_contact: boolean;
  followers_count:     number;
  following_count:     number;
  films_seen_count:    number;
  reviews_count:       number;
}

export interface SeenFilm {
  work_id:    number;
  watched_at: string;
}

const PROFILE_COLS = [
  'id','username','display_name','avatar_url','bio','role',
  'location','website','is_verified','is_pro','is_industry_contact',
  'followers_count','following_count','films_seen_count',
].join(',');

// ─── STORAGE — SecureStore / localStorage selon la plateforme ────────────────
const DEVICE_KEY = 'universe_device_uuid';

async function _get(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
async function _set(key: string, v: string): Promise<void> {
  if (Platform.OS === 'web') { if (typeof localStorage !== 'undefined') localStorage.setItem(key, v); return; }
  try { await SecureStore.setItemAsync(key, v); } catch {}
}

/** UUID v4 sans dépendance externe */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Retourne l'UUID du device.
 * Généré une seule fois, stocké en SecureStore → permanent par appareil.
 * C'est l'identité unique de l'utilisateur, sans aucun compte.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await _get(DEVICE_KEY);
  if (existing) return existing;
  const id = uuidv4();
  await _set(DEVICE_KEY, id);
  return id;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function rowToUser(row: Record<string, any>): User {
  return {
    id:                  String(row.id          ?? ''),
    username:            String(row.username     ?? ''),
    display_name:        String(row.display_name ?? row.username ?? ''),
    email:               '',
    avatar_url:          String(row.avatar_url   ?? ''),
    bio:                 String(row.bio           ?? ''),
    role:                String(row.role          ?? 'creator'),
    location:            String(row.location      ?? ''),
    website:             String(row.website       ?? ''),
    is_verified:         Boolean(row.is_verified),
    is_pro:              Boolean(row.is_pro),
    is_industry_contact: Boolean(row.is_industry_contact),
    followers_count:     Number(row.followers_count  ?? 0),
    following_count:     Number(row.following_count  ?? 0),
    films_seen_count:    Number(row.films_seen_count ?? 0),
    reviews_count:       Number(row.reviews_count    ?? 0),
  };
}

/** User minimal basé sur l'UUID device (avant fetch/création du profil) */
function localUser(deviceId: string): User {
  return {
    id: deviceId, username: '', display_name: 'Cinéphile', email: '',
    avatar_url: '', bio: '', role: 'creator', location: '', website: '',
    is_verified: false, is_pro: false, is_industry_contact: false,
    followers_count: 0, following_count: 0, films_seen_count: 0, reviews_count: 0,
  };
}

// ─── TOKEN API (stub vide — conservé pour compatibilité AuthContext) ──────────
export const tokenAPI = {
  get:    async () => await _get('universe_token'),
  save:   async (t: string) => _set('universe_token', t),
  remove: async () => { if (Platform.OS === 'web') localStorage?.removeItem('universe_token'); else try { await SecureStore.deleteItemAsync('universe_token'); } catch {} },
};

// ─── AUTH API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  /**
   * Point d'entrée principal — appelé par AuthContext au démarrage.
   * NE fait AUCUN appel à supabase.auth.*
   * 1. Récupère ou génère l'UUID device
   * 2. Tente de lire le profil Supabase correspondant
   * 3. Si absent → crée le profil (clé anon, RLS ouverte)
   */
  async initSession(): Promise<{ user: User; token: null }> {
    const deviceId = await getDeviceId();

    // Lecture profil (RLS publique, clé anon)
    try {
      const { data, error } = await supabase
        .from('profiles').select(PROFILE_COLS).eq('id', deviceId).single();

      if (data) return { user: rowToUser(data), token: null };

      // Profil absent → insertion avec la clé anon (RLS WITH CHECK true)
      if (error?.code === 'PGRST116') {
        const username = `user_${deviceId.replace(/-/g, '').slice(0, 8)}`;
        await supabase.from('profiles').insert({
          id: deviceId, username, display_name: 'Cinéphile', role: 'creator',
          films_seen_count: 0, followers_count: 0, following_count: 0,
        });
        const { data: created } = await supabase
          .from('profiles').select(PROFILE_COLS).eq('id', deviceId).single();
        if (created) return { user: rowToUser(created), token: null };
      }
    } catch { /* ignore réseau */ }

    // Fallback local si Supabase injoignable
    return { user: localUser(deviceId), token: null };
  },

  /** Recharge le profil depuis Supabase (pour useFocusEffect) */
  async me(): Promise<User | null> {
    const deviceId = await getDeviceId();
    try {
      const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', deviceId).single();
      return data ? rowToUser(data) : null;
    } catch { return null; }
  },

  /** Logout = réinitialiser en conservant le même UUID device */
  async logout(): Promise<User> {
    const deviceId = await getDeviceId();
    return localUser(deviceId);
  },

  /** Mise à jour profil (sans auth JWT — RLS ouverte) */
  async updateProfile(
    uid: string,
    patch: Partial<Omit<User, 'id'|'email'|'reviews_count'>>,
  ): Promise<User | null> {
    const { error } = await supabase.from('profiles').update(patch).eq('id', uid);
    if (error) { console.warn('[api] updateProfile:', error.message); return null; }
    const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', uid).single();
    return data ? rowToUser(data) : null;
  },

  // Stubs conservés pour compatibilité — ne lèvent plus d'exception
  async login(_: { email: string; password: string }): Promise<{ user: User; token: null }> {
    return authAPI.initSession();
  },
  async register(_: { username: string; email: string; password: string }): Promise<{ user: User; token: null }> {
    return authAPI.initSession();
  },
  async signInAnonymously(): Promise<{ user: User; token: null }> {
    return authAPI.initSession();
  },
};

// ─── SEEN API — user_history ──────────────────────────────────────────────────
export const seenAPI = {
  async getByUser(uid: string): Promise<SeenFilm[]> {
    const { data, error } = await supabase
      .from('user_history').select('work_id,watched_at')
      .eq('user_id', uid).order('watched_at', { ascending: false });
    if (error) { console.warn('[api] seenAPI.getByUser:', error.message); return []; }
    return (data ?? []) as SeenFilm[];
  },
  async markSeen(uid: string, workId: number): Promise<void> {
    await supabase.from('user_history')
      .upsert({ user_id: uid, work_id: workId, watched_at: new Date().toISOString() },
               { onConflict: 'user_id,work_id' })
      .catch(() => {});
  },
  async removeSeen(uid: string, workId: number): Promise<void> {
    await supabase.from('user_history')
      .delete().match({ user_id: uid, work_id: workId }).catch(() => {});
  },
};

// ─── PROFILE API ─────────────────────────────────────────────────────────────
export const profileAPI = {
  async getById(uid: string): Promise<User | null> {
    try {
      const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', uid).single();
      return data ? rowToUser(data) : null;
    } catch { return null; }
  },
  async getByUsername(username: string): Promise<User | null> {
    try {
      const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('username', username).single();
      return data ? rowToUser(data) : null;
    } catch { return null; }
  },
  async update(uid: string, patch: Partial<User>): Promise<User | null> {
    return authAPI.updateProfile(uid, patch as any);
  },
};

// ─── NOTIFICATIONS API ────────────────────────────────────────────────────────
export const notifAPI = {
  async getByUser(uid: string) {
    try {
      const { data } = await supabase
        .from('notifications').select('*').eq('user_id', uid)
        .order('created_at', { ascending: false }).limit(50);
      return data ?? [];
    } catch { return []; }
  },
  async markRead(notifId: string): Promise<void> {
    await supabase.from('notifications').update({ read: true }).eq('id', notifId).catch(() => {});
  },
  async markAllRead(uid: string): Promise<void> {
    await supabase.from('notifications').update({ read: true }).eq('user_id', uid).catch(() => {});
  },
  async getUnreadCount(uid: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).eq('read', false);
      return count ?? 0;
    } catch { return 0; }
  },
};