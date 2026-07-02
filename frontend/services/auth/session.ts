/**
 * services/auth/session.ts — Persistance sécurisée des sessions PIN
 *
 * Utilise expo-secure-store (déjà installé) — données chiffrées par l'OS :
 *   iOS  : SecureEnclave / Keychain (AES-256-GCM)
 *   Android : Keystore system
 *   Web  : sessionStorage (pas de SecureStore natif sur web — pas de persistance)
 *
 * Ce qui est stocké : { token, expiresAt, memberId, displayName }
 * Ce qui n'est JAMAIS stocké : le PIN, le hash du PIN, le hash du token
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORE_KEY = 'universe_pin_session_v1';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface StoredSession {
  token:       string;  // session token brut (256 bits hex)
  expiresAt:   number;  // unix timestamp
  memberId:    string;
  displayName: string;
  savedAt:     number;  // unix timestamp de sauvegarde
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de stockage cross-platform
// ─────────────────────────────────────────────────────────────────────────────
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { sessionStorage.setItem(key, value); } catch {}
    return;
  }
  return SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { sessionStorage.removeItem(key); } catch {}
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

// ─────────────────────────────────────────────────────────────────────────────
// saveSession — persiste la session après authentification réussie
// ─────────────────────────────────────────────────────────────────────────────
export async function saveSession(params: Omit<StoredSession, 'savedAt'>): Promise<void> {
  const data: StoredSession = { ...params, savedAt: Math.floor(Date.now() / 1000) };
  await secureSet(STORE_KEY, JSON.stringify(data));
}

// ─────────────────────────────────────────────────────────────────────────────
// loadSession — charge et valide la session stockée
// Retourne null si absente, mal formée ou expirée localement
// ─────────────────────────────────────────────────────────────────────────────
export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await secureGet(STORE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as StoredSession;

    // Validation structurelle
    if (
      typeof session.token       !== 'string' || !session.token ||
      typeof session.expiresAt   !== 'number' ||
      typeof session.memberId    !== 'string' || !session.memberId ||
      typeof session.displayName !== 'string' || !session.displayName
    ) {
      await clearSession();
      return null;
    }

    // Validation locale de l'expiration (garde-fou avant vérification serveur)
    const nowSec = Math.floor(Date.now() / 1000);
    if (session.expiresAt <= nowSec) {
      await clearSession();
      return null;
    }

    return session;
  } catch {
    await clearSession();
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// clearSession — supprime la session du stockage sécurisé
// ─────────────────────────────────────────────────────────────────────────────
export async function clearSession(): Promise<void> {
  await secureDelete(STORE_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// isSessionExpiredSoon — true si la session expire dans < 24h (pour refresh)
// ─────────────────────────────────────────────────────────────────────────────
export function isSessionExpiredSoon(session: StoredSession): boolean {
  const nowSec    = Math.floor(Date.now() / 1000);
  const remaining = session.expiresAt - nowSec;
  return remaining < 86_400; // moins de 24 heures
}
