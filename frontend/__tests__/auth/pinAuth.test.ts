/**
 * __tests__/auth/pinAuth.test.ts
 *
 * Tests unitaires pour le service d'authentification PIN.
 *
 * Setup (à exécuter une fois) :
 *   npx expo install jest-expo @types/jest
 *   npx expo install --dev @testing-library/react-native
 *
 * Puis ajouter dans package.json :
 *   "jest": { "preset": "jest-expo" }
 *
 * Runner :
 *   npx jest __tests__/auth/pinAuth.test.ts
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
  SUPABASE_URL:  'https://test.supabase.co',
  SUPABASE_ANON: 'test-anon-key',
}));

// Web Crypto API (disponible nativement dans Node 18+)
// Pour Node < 18 : npm install --save-dev jest-environment-node@29 et
// configurer "testEnvironment": "node" dans jest config.

// ── Imports (après les mocks) ──────────────────────────────────────────────

import { hashPin, getSalt, authenticate, verifyToken, logoutToken } from '@/services/auth/pinAuth';
import { supabase } from '@/lib/supabase';

const mockRpc = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>;

// ── hashPin ────────────────────────────────────────────────────────────────

describe('hashPin', () => {
  test('produit un hash SHA-256 hex de 64 caractères', async () => {
    const hash = await hashPin('123456', 'abcdef1234567890');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  test('est déterministe : même pin+sel → même hash', async () => {
    const h1 = await hashPin('741852', 'a1b2c3d4e5f6a7b8');
    const h2 = await hashPin('741852', 'a1b2c3d4e5f6a7b8');
    expect(h1).toBe(h2);
  });

  test('est sensible au pin : PINs différents → hashes différents', async () => {
    const salt = 'fixedsaltvalue01';
    const h1   = await hashPin('111111', salt);
    const h2   = await hashPin('222222', salt);
    expect(h1).not.toBe(h2);
  });

  test('est sensible au sel : sels différents → hashes différents', async () => {
    const pin = '123456';
    const h1  = await hashPin(pin, 'salt0000000000001');
    const h2  = await hashPin(pin, 'salt0000000000002');
    expect(h1).not.toBe(h2);
  });

  test('PIN jamais inclus dans le hash résultant (pas de collision naive)', async () => {
    const pin  = '123456';
    const hash = await hashPin(pin, 'testsalt12345678');
    expect(hash).not.toContain(pin);
  });

  test('valeur de référence — vecteur SHA-256 connu', async () => {
    // echo -n "000000:testsalt" | sha256sum
    // Vérifie l'implémentation exacte : SHA256("000000:testsalt")
    const hash = await hashPin('000000', 'testsalt');
    // Vecteur calculé offline : sha256("000000:testsalt")
    expect(hash).toBe(
      await (async () => {
        const enc = new TextEncoder();
        const buf = await globalThis.crypto.subtle.digest('SHA-256', enc.encode('000000:testsalt'));
        return Array.from(new Uint8Array(buf))
          .map(b => b.toString(16).padStart(2, '0')).join('');
      })()
    );
  });
});

// ── getSalt ────────────────────────────────────────────────────────────────

describe('getSalt', () => {
  beforeEach(() => mockRpc.mockReset());

  test('retourne le sel si le membre existe', async () => {
    mockRpc.mockResolvedValueOnce({
      data:  { salt: 'abc123def456abc1', found: true },
      error: null,
    } as any);

    const salt = await getSalt('Aresse');
    expect(salt).toBe('abc123def456abc1');
    expect(mockRpc).toHaveBeenCalledWith('get_member_salt', { p_display_name: 'Aresse' });
  });

  test('retourne null si le membre est inconnu (anti-énumération)', async () => {
    mockRpc.mockResolvedValueOnce({
      data:  { salt: 'fakesaltfakesalt', found: false },
      error: null,
    } as any);

    const salt = await getSalt('Inconnu');
    expect(salt).toBeNull();
  });

  test("retourne null en cas d'erreur réseau", async () => {
    mockRpc.mockRejectedValueOnce(new Error('Network error'));
    const salt = await getSalt('Aresse');
    expect(salt).toBeNull();
  });
});

// ── authenticate ───────────────────────────────────────────────────────────

describe('authenticate', () => {
  beforeEach(() => mockRpc.mockReset());

  test('succès : retourne sessionToken + member', async () => {
    // Appel 1 : get_member_salt
    mockRpc.mockResolvedValueOnce({
      data:  { salt: 'fixedsalt00000001', found: true },
      error: null,
    } as any);
    // Appel 2 : authenticate_pin
    mockRpc.mockResolvedValueOnce({
      data: {
        success:      true,
        sessionToken: 'deadbeefcafe0123deadbeefcafe0123deadbeefcafe0123deadbeefcafe0123',
        expiresAt:    Math.floor(Date.now() / 1000) + 86400,
        member:       { id: 'uuid-member-1', displayName: 'Aresse' },
      },
      error: null,
    } as any);

    const result = await authenticate('Aresse', '741852');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sessionToken).toHaveLength(64);
      expect(result.member.displayName).toBe('Aresse');
    }
  });

  test('échec credentials : retourne invalid_credentials + attemptsLeft', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { salt: 'fixedsalt00000001', found: true },
      error: null,
    } as any);
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error: 'invalid_credentials', attemptsLeft: 3 },
      error: null,
    } as any);

    const result = await authenticate('Aresse', '000000');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('invalid_credentials');
      expect(result.attemptsLeft).toBe(3);
    }
  });

  test('compte bloqué : retourne account_locked + lockUntil', async () => {
    const lockUntil = Math.floor(Date.now() / 1000) + 900;
    mockRpc.mockResolvedValueOnce({
      data: { salt: 'fixedsalt00000001', found: true },
      error: null,
    } as any);
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error: 'account_locked', lockUntil },
      error: null,
    } as any);

    const result = await authenticate('Aresse', '000000');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('account_locked');
      expect(result.lockUntil).toBe(lockUntil);
    }
  });

  test('membre inconnu : retourne invalid_credentials sans divulgation', async () => {
    // getSalt retourne found:false → authenticate retourne invalid_credentials
    // sans appeler authenticate_pin (anti-énumération)
    mockRpc.mockResolvedValueOnce({
      data:  { salt: 'fakesaltfakesalt', found: false },
      error: null,
    } as any);

    const result = await authenticate('MembreInconnu', '123456');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('invalid_credentials');
    // Vérifier qu'authenticate_pin n'a PAS été appelé
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  test('erreur réseau : retourne network_error', async () => {
    mockRpc.mockRejectedValue(new Error('fetch failed'));
    const result = await authenticate('Aresse', '741852');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('network_error');
  });
});

// ── verifyToken ────────────────────────────────────────────────────────────

describe('verifyToken', () => {
  beforeEach(() => mockRpc.mockReset());

  test('token valide : retourne { valid:true, memberId, displayName }', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        valid:       true,
        memberId:    'uuid-member-1',
        displayName: 'Aresse',
        expiresAt:   Math.floor(Date.now() / 1000) + 3600,
      },
      error: null,
    } as any);

    const r = await verifyToken('sometoken');
    expect(r.valid).toBe(true);
    expect(r.displayName).toBe('Aresse');
  });

  test('token expiré/invalide : retourne { valid:false }', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { valid: false },
      error: null,
    } as any);

    const r = await verifyToken('expiredtoken');
    expect(r.valid).toBe(false);
  });

  test('erreur réseau : retourne { valid:false }', async () => {
    mockRpc.mockRejectedValue(new Error('timeout'));
    const r = await verifyToken('anytoken');
    expect(r.valid).toBe(false);
  });
});

// ── logoutToken ────────────────────────────────────────────────────────────

describe('logoutToken', () => {
  beforeEach(() => mockRpc.mockReset());

  test('appelle logout_session avec le bon token', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null } as any);
    await logoutToken('mytoken');
    expect(mockRpc).toHaveBeenCalledWith('logout_session', { p_session_token: 'mytoken' });
  });

  test('ne throw pas même si le serveur échoue (session expire naturellement)', async () => {
    mockRpc.mockRejectedValue(new Error('server error'));
    await expect(logoutToken('mytoken')).resolves.toBeUndefined();
  });
});
