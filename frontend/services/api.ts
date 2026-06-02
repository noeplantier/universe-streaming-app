// services/api.ts
// ─────────────────────────────────────────────────────────────────────────────
//  Point d'entrée unique pour tous les appels API de l'app Universe
//  Auth anonyme Supabase — une session persistée par device
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES PUBLICS
// ─────────────────────────────────────────────────────────────────────────────
export interface User {
  id:                  string;
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
  id:         string;
  title:      string;
  poster_url: string;
  year:       number;
  genre:      string;
  rating:     number;
  seen_at:    string;
}

const PROFILE_COLS = [
  'id', 'username', 'display_name', 'avatar_url', 'bio',
  'role', 'location', 'website',
  'is_verified', 'is_pro', 'is_industry_contact',
  'followers_count', 'following_count', 'films_seen_count',
].join(', ');

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN API — abstraction SecureStore / fallback web
// ─────────────────────────────────────────────────────────────────────────────
const TOKEN_KEY = 'universe_session_token';

export const tokenAPI = {
  /** Lit le token persisté sur le device */
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem(TOKEN_KEY)
        : null;
    }
    try { return await SecureStore.getItemAsync(TOKEN_KEY); }
    catch { return null; }
  },

  /** Sauvegarde le token (appelé après login/register) */
  async save(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
      return;
    }
    try { await SecureStore.setItemAsync(TOKEN_KEY, token); }
    catch { /* silently ignore */ }
  },

  /** Supprime le token (appelé au logout) */
  async remove(): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
      return;
    }
    try { await SecureStore.deleteItemAsync(TOKEN_KEY); }
    catch { /* silently ignore */ }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNES
// ─────────────────────────────────────────────────────────────────────────────

/** Construit un User à partir d'une row profiles + email optionnel */
function rowToUser(row: Record<string, any>, email = ''): User {
  return {
    id:                  String(row.id ?? ''),
    username:            String(row.username ?? ''),
    display_name:        String(row.display_name ?? row.username ?? ''),
    email:               email,
    avatar_url:          String(row.avatar_url ?? ''),
    bio:                 String(row.bio ?? ''),
    role:                String(row.role ?? 'creator'),
    location:            String(row.location ?? ''),
    website:             String(row.website ?? ''),
    is_verified:         Boolean(row.is_verified),
    is_pro:              Boolean(row.is_pro),
    is_industry_contact: Boolean(row.is_industry_contact),
    followers_count:     Number(row.followers_count ?? 0),
    following_count:     Number(row.following_count ?? 0),
    films_seen_count:    Number(row.films_seen_count ?? 0),
    reviews_count:       Number(row.reviews_count ?? 0),
  };
}

/** Fetch le profil Supabase d'un uid, crée-le s'il n'existe pas */
async function fetchOrCreateProfile(uid: string, email = ''): Promise<User | null> {
  // 1. Tentative de lecture
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('id', uid)
    .single();

  if (data) return rowToUser(data, email);

  // 2. Pas trouvé (PGRST116) → insertion manuelle (fallback trigger)
  if (error?.code === 'PGRST116') {
    const username = 'user_' + uid.replace(/-/g, '').slice(0, 8);
    await supabase.from('profiles').insert({
      id:           uid,
      username,
      display_name: 'Cinéphile',
      role:         'creator',
      films_seen_count: 0,
      followers_count:  0,
      following_count:  0,
    });

    const { data: created } = await supabase
      .from('profiles').select(PROFILE_COLS).eq('id', uid).single();
    return created ? rowToUser(created, email) : null;
  }

  console.warn('[api] fetchOrCreateProfile:', error?.message);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH API
// ─────────────────────────────────────────────────────────────────────────────
export const authAPI = {

  /**
   * Sign-in anonyme — crée une session persistée par device.
   * Appelé automatiquement si aucune session n'existe.
   */
  async signInAnonymously(): Promise<{ user: User; token: string } | null> {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) {
      console.error('[api] signInAnonymously:', error?.message);
      return null;
    }
    const { session } = data;
    await tokenAPI.save(session.access_token);
    const user = await fetchOrCreateProfile(session.user.id, session.user.email ?? '');
    return user ? { user, token: session.access_token } : null;
  },

  /**
   * Charge le profil de l'utilisateur actuellement connecté (session active).
   */
  async me(): Promise<User | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    return fetchOrCreateProfile(session.user.id, session.user.email ?? '');
  },

  /**
   * Connexion email/password (utilisateurs enregistrés).
   */
  async login(params: { email: string; password: string }): Promise<{ user: User; token: string }> {
    const { data, error } = await supabase.auth.signInWithPassword(params);
    if (error || !data.session) throw new Error(error?.message ?? 'Login failed');
    const { session } = data;
    await tokenAPI.save(session.access_token);
    const user = await fetchOrCreateProfile(session.user.id, session.user.email ?? '');
    if (!user) throw new Error('Profile introuvable');
    return { user, token: session.access_token };
  },

  /**
   * Inscription email/password.
   */
  async register(params: { username: string; email: string; password: string }): Promise<{ user: User; token: string }> {
    const { data, error } = await supabase.auth.signUp({
      email:    params.email,
      password: params.password,
      options:  { data: { username: params.username } },
    });
    if (error || !data.session) throw new Error(error?.message ?? 'Register failed');
    const { session } = data;
    // Mettre à jour le username dans profiles
    await supabase.from('profiles').update({ username: params.username }).eq('id', session.user.id);
    await tokenAPI.save(session.access_token);
    const user = await fetchOrCreateProfile(session.user.id, session.user.email ?? '');
    if (!user) throw new Error('Profile introuvable');
    return { user, token: session.access_token };
  },

  /**
   * Déconnexion — revient en mode anonyme.
   */
  async logout(): Promise<void> {
    await tokenAPI.remove();
    await supabase.auth.signOut();
  },

  /**
   * Met à jour le profil dans public.profiles.
   */
  async updateProfile(uid: string, patch: Partial<User>): Promise<User | null> {
    // Exclure les champs readonly
    const { id: _id, email: _email, reviews_count: _rc, ...safe } = patch as any;
    const { error } = await supabase.from('profiles').update(safe).eq('id', uid);
    if (error) { console.warn('[api] updateProfile:', error.message); return null; }
    return fetchOrCreateProfile(uid);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SEEN API
// ─────────────────────────────────────────────────────────────────────────────
export const seenAPI = {
  /** Films marqués comme vus pour un utilisateur */
  async getByUser(uid: string): Promise<SeenFilm[]> {
    const { data, error } = await supabase
      .from('seen_films')
      .select('id, title, poster_url, year, genre, rating, seen_at')
      .eq('user_id', uid)
      .order('seen_at', { ascending: false });

    if (error) { console.warn('[api] seenAPI.getByUser:', error.message); return []; }
    return (data ?? []) as SeenFilm[];
  },

  /** Marquer un film comme vu */
  async markSeen(uid: string, filmId: string, rating = 0): Promise<void> {
    await supabase.from('seen_films').upsert(
      { user_id: uid, film_id: filmId, rating, seen_at: new Date().toISOString() },
      { onConflict: 'user_id,film_id' },
    );
  },

  /** Retirer un film de la liste */
  async removeSeen(uid: string, filmId: string): Promise<void> {
    await supabase.from('seen_films').delete().match({ user_id: uid, film_id: filmId });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE API
// ─────────────────────────────────────────────────────────────────────────────
export const profileAPI = {
  /** Fetch un profil par id */
  async getById(uid: string): Promise<User | null> {
    return fetchOrCreateProfile(uid);
  },

  /** Fetch un profil par username */
  async getByUsername(username: string): Promise<User | null> {
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('username', username)
      .single();
    return data ? rowToUser(data) : null;
  },

  /** Mise à jour partielle */
  async update(uid: string, patch: Partial<User>): Promise<User | null> {
    return authAPI.updateProfile(uid, patch);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS API
// ─────────────────────────────────────────────────────────────────────────────
export const notifAPI = {
  async getByUser(uid: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
    return data ?? [];
  },

  async markRead(notifId: string): Promise<void> {
    await supabase.from('notifications').update({ read: true }).eq('id', notifId);
  },

  async markAllRead(uid: string): Promise<void> {
    await supabase.from('notifications').update({ read: true }).eq('user_id', uid);
  },
};