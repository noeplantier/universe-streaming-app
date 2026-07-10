/**
 * lib/deviceId.ts — UNIVERSE
 *
 * Source of truth pour l'identité utilisateur.
 * Universe n'utilise JAMAIS supabase.auth.* — toute l'auth
 * repose sur cet UUID de device persisté localement.
 *
 * Stratégie (par ordre de priorité) :
 *   1. Mémoire (cache in-process, retour immédiat)
 *   2. SecureStore (iOS Keychain — survit aux réinstalls)
 *   3. AsyncStorage (Android / Web — survit aux kills)
 *   4. Génération d'un nouvel UUID v4 → persisté dans les deux
 *
 * API publique :
 *   getDeviceId()            → Promise<string>  (UUID courant)
 *   resetDeviceId()          → Promise<string>  (force nouveau UUID)
 *   isDeviceIdReady()        → boolean          (sync, pour les guards)
 *   onDeviceIdReady(cb)      → unsubscribe fn   (listener)
 */

import AsyncStorage  from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform }  from 'react-native';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const SECURE_KEY  = 'universe_device_id';
const STORAGE_KEY = 'universe_device_id';

// ─── CACHE IN-PROCESS ────────────────────────────────────────────────────────
let _cached: string | null = null;
let _ready = false;
const _listeners: Array<(id: string) => void> = [];

// ─── UUID v4 GENERATOR ────────────────────────────────────────────────────────
/**
 * Génère un UUID v4 compatible RFC 4122.
 * Utilise crypto.getRandomValues si disponible, sinon Math.random.
 */
function generateUUID(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Version 4 bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Variant bits
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  // Fallback Math.random (web sans crypto, très rare)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── SECURE STORE (iOS Keychain) ─────────────────────────────────────────────
async function readSecureStore(): Promise<string | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    return await SecureStore.getItemAsync(SECURE_KEY);
  } catch {
    return null;
  }
}

async function writeSecureStore(id: string): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    await SecureStore.setItemAsync(SECURE_KEY, id);
  } catch {
    // SecureStore peut échouer sur simulateurs sans Keychain configuré
    console.warn('[deviceId] SecureStore write failed — using AsyncStorage only');
  }
}

async function deleteSecureStore(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    await SecureStore.deleteItemAsync(SECURE_KEY);
  } catch { /* silencieux */ }
}

// ─── ASYNC STORAGE (Android + Web) ───────────────────────────────────────────
async function readAsyncStorage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function writeAsyncStorage(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch {
    console.warn('[deviceId] AsyncStorage write failed');
  }
}

async function deleteAsyncStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch { /* silencieux */ }
}

// ─── VALIDATION FORMAT UUID ───────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(v: string | null | undefined): v is string {
  return typeof v === 'string' && UUID_RE.test(v.trim());
}

// ─── INIT INTERNE ────────────────────────────────────────────────────────────
let _initPromise: Promise<string> | null = null;

function _notifyListeners(id: string): void {
  _ready = true;
  for (const cb of _listeners) {
    try { cb(id); } catch { /* ignore */ }
  }
}

async function _init(): Promise<string> {
  // 1. Cache mémoire
  if (_cached) return _cached;

  // 2. SecureStore (iOS Keychain)
  const fromSecure = await readSecureStore();
  if (isValidUUID(fromSecure)) {
    _cached = fromSecure!.trim();
    // Sync AsyncStorage si absent (migration cross-platform)
    const fromAsync = await readAsyncStorage();
    if (!isValidUUID(fromAsync)) {
      await writeAsyncStorage(_cached);
    }
    _notifyListeners(_cached);
    return _cached;
  }

  // 3. AsyncStorage (Android / Web)
  const fromAsync = await readAsyncStorage();
  if (isValidUUID(fromAsync)) {
    _cached = fromAsync!.trim();
    // Backfill SecureStore
    await writeSecureStore(_cached);
    _notifyListeners(_cached);
    return _cached;
  }

  // 4. Nouveau UUID — première installation ou données effacées
  const fresh = generateUUID();
  await Promise.all([
    writeSecureStore(fresh),
    writeAsyncStorage(fresh),
  ]);
  _cached = fresh;
  _notifyListeners(_cached);
  console.info(`[deviceId] New device ID generated: ${_cached}`);
  return _cached;
}

// ─── API PUBLIQUE ─────────────────────────────────────────────────────────────

/**
 * Retourne l'UUID de device persisté.
 * Idempotent : plusieurs appels simultanés reçoivent le même Promise.
 *
 * @example
 *   const uid = await getDeviceId();
 *   // → "a3f2e1d0-1234-4abc-8def-000000000000"
 */
export async function getDeviceId(): Promise<string> {
  if (_cached) return _cached;
  if (!_initPromise) _initPromise = _init();
  return _initPromise;
}

/**
 * Vrai si l'UUID a déjà été résolu (utile pour les guards synchrones).
 *
 * @example
 *   if (!isDeviceIdReady()) return null; // render guard
 */
export function isDeviceIdReady(): boolean {
  return _ready;
}

/**
 * Retourne le cache synchrone si disponible, sinon null.
 * Utiliser uniquement quand isDeviceIdReady() === true.
 */
export function getDeviceIdSync(): string | null {
  return _cached;
}

/**
 * S'abonne à la résolution de l'UUID.
 * Appelé immédiatement si déjà prêt.
 *
 * @returns fonction pour se désabonner
 *
 * @example
 *   const unsub = onDeviceIdReady(id => setMyId(id));
 *   return () => unsub();
 */
export function onDeviceIdReady(cb: (id: string) => void): () => void {
  if (_cached) {
    // Déjà prêt : callback asynchrone pour éviter les problèmes de rendu
    const timer = setTimeout(() => cb(_cached!), 0);
    return () => clearTimeout(timer);
  }
  _listeners.push(cb);
  // Déclenche l'init si pas encore démarré
  if (!_initPromise) _initPromise = _init();
  return () => {
    const i = _listeners.indexOf(cb);
    if (i !== -1) _listeners.splice(i, 1);
  };
}

/**
 * Force la génération d'un nouvel UUID (réinitialisation de compte).
 * Supprime les deux stores, crée un nouvel UUID et met à jour le cache.
 *
 * ⚠️ L'utilisateur perdra toutes ses données liées à l'ancien device ID.
 *    À utiliser uniquement derrière une confirmation explicite.
 *
 * @example
 *   const newId = await resetDeviceId();
 */
export async function resetDeviceId(): Promise<string> {
  _cached    = null;
  _ready     = false;
  _initPromise = null;

  await Promise.all([
    deleteSecureStore(),
    deleteAsyncStorage(),
  ]);

  const fresh = generateUUID();
  await Promise.all([
    writeSecureStore(fresh),
    writeAsyncStorage(fresh),
  ]);

  _cached = fresh;
  _notifyListeners(fresh);
  console.info(`[deviceId] Device ID reset: ${_cached}`);
  return _cached;
}

/**
 * Pré-charge l'UUID dès le démarrage de l'app.
 * À appeler dans _layout.tsx ou App.tsx pour éviter
 * le délai au premier composant qui en a besoin.
 *
 * @example
 *   // app/_layout.tsx
 *   import { prefetchDeviceId } from '@/lib/deviceId';
 *   prefetchDeviceId();
 */
export function prefetchDeviceId(): void {
  if (!_initPromise) _initPromise = _init();
}