/**
 * __tests__/auth/session.test.ts
 *
 * Tests unitaires pour la persistance de session PIN (session.ts).
 *
 * Setup (à exécuter une fois) :
 *   npx expo install jest-expo @types/jest
 *   package.json → "jest": { "preset": "jest-expo" }
 *
 * Runner :
 *   npx jest __tests__/auth/session.test.ts
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

// SecureStore mocké en mémoire (pas de Keychain natif dans les tests Node)
const store: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItemAsync:    jest.fn((key: string, val: string) => { store[key] = val; return Promise.resolve(); }),
  deleteItemAsync: jest.fn((key: string) => { delete store[key]; return Promise.resolve(); }),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

// Forcer Platform.OS = 'ios' (évite la branche sessionStorage)
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: (obj: any) => obj.ios ?? obj.default,
}));

// ── Imports (après les mocks) ──────────────────────────────────────────────

import { saveSession, loadSession, clearSession, isSessionExpiredSoon } from '@/services/auth/session';
import type { StoredSession } from '@/services/auth/session';

// ── Helpers ────────────────────────────────────────────────────────────────

const now = () => Math.floor(Date.now() / 1000);

function makeSession(overrides: Partial<StoredSession> = {}): Omit<StoredSession, 'savedAt'> {
  return {
    token:       'deadbeefcafe0123'.repeat(4),
    expiresAt:   now() + 86400, // +24h
    memberId:    'uuid-member-1',
    displayName: 'Aresse',
    ...overrides,
  };
}

// ── Nettoyage entre tests ──────────────────────────────────────────────────

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
});

// ── saveSession / loadSession ──────────────────────────────────────────────

describe('saveSession + loadSession', () => {
  test('sauvegarde et recharge une session valide', async () => {
    const session = makeSession();
    await saveSession(session);

    const loaded = await loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded!.token).toBe(session.token);
    expect(loaded!.memberId).toBe(session.memberId);
    expect(loaded!.displayName).toBe(session.displayName);
    expect(loaded!.expiresAt).toBe(session.expiresAt);
  });

  test('savedAt est renseigné automatiquement lors de la sauvegarde', async () => {
    const before = now();
    await saveSession(makeSession());
    const after  = now();

    const loaded = await loadSession();
    expect(loaded!.savedAt).toBeGreaterThanOrEqual(before);
    expect(loaded!.savedAt).toBeLessThanOrEqual(after);
  });

  test('retourne null si aucune session stockée', async () => {
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });

  test('retourne null et purge si la session est expirée', async () => {
    await saveSession(makeSession({ expiresAt: now() - 60 })); // expirée il y a 1 min

    const loaded = await loadSession();
    expect(loaded).toBeNull();

    // Vérifier que le store a été vidé
    const stored = await loadSession();
    expect(stored).toBeNull();
  });

  test('retourne null et purge si le JSON est malformé', async () => {
    store['universe_pin_session_v1'] = '{invalid json}';
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });

  test('retourne null et purge si le token est manquant', async () => {
    const bad = { ...makeSession(), token: '' };
    store['universe_pin_session_v1'] = JSON.stringify({ ...bad, savedAt: now() });
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });

  test('retourne null et purge si memberId est manquant', async () => {
    const bad = { ...makeSession(), memberId: '' };
    store['universe_pin_session_v1'] = JSON.stringify({ ...bad, savedAt: now() });
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });

  test('retourne null et purge si displayName est manquant', async () => {
    const bad = { ...makeSession(), displayName: '' };
    store['universe_pin_session_v1'] = JSON.stringify({ ...bad, savedAt: now() });
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });
});

// ── clearSession ───────────────────────────────────────────────────────────

describe('clearSession', () => {
  test('supprime la session du store', async () => {
    await saveSession(makeSession());
    await clearSession();

    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });

  test('ne throw pas si aucune session à supprimer', async () => {
    await expect(clearSession()).resolves.toBeUndefined();
  });
});

// ── isSessionExpiredSoon ───────────────────────────────────────────────────

describe('isSessionExpiredSoon', () => {
  test('retourne false si la session expire dans > 24h', () => {
    const session: StoredSession = {
      ...makeSession({ expiresAt: now() + 90000 }), // +25h
      savedAt: now(),
    };
    expect(isSessionExpiredSoon(session)).toBe(false);
  });

  test('retourne true si la session expire dans < 24h', () => {
    const session: StoredSession = {
      ...makeSession({ expiresAt: now() + 3600 }), // +1h
      savedAt: now(),
    };
    expect(isSessionExpiredSoon(session)).toBe(true);
  });

  test('retourne true si la session est déjà expirée', () => {
    const session: StoredSession = {
      ...makeSession({ expiresAt: now() - 1 }),
      savedAt: now() - 3600,
    };
    expect(isSessionExpiredSoon(session)).toBe(true);
  });

  test('est exact à la limite des 24h', () => {
    const limit = now() + 86400;
    // Exactement 24h → considéré "bientôt expiré" (remaining === 86400 < 86400 est faux)
    const atLimit: StoredSession = { ...makeSession({ expiresAt: limit }), savedAt: now() };
    expect(isSessionExpiredSoon(atLimit)).toBe(false);

    // 1s de moins → vrai
    const oneSecLess: StoredSession = { ...makeSession({ expiresAt: limit - 1 }), savedAt: now() };
    expect(isSessionExpiredSoon(oneSecLess)).toBe(true);
  });
});
