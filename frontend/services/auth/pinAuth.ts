/**
 * services/auth/pinAuth.ts — Authentification PIN Universe App
 *
 * Flux complet :
 *   1. getSalt(name)          → récupère le sel du membre via RPC (sel non secret)
 *   2. hashPin(pin, salt)     → SHA-256(pin:salt) via Web Crypto API (intégré RN/web)
 *   3. authenticate(name,pin) → envoie le hash au serveur, reçoit un session token
 *   4. verifyToken(token)     → vérifie qu'un token stocké est encore valide
 *   5. logoutToken(token)     → invalide le token côté serveur
 *
 * ⚠️ Règles OWASP :
 *   - Le PIN brut ne sort JAMAIS de cette fonction (hashé avant réseau)
 *   - Les logs ne contiennent JAMAIS le PIN ni le token brut
 *   - Aucune donnée sensible dans AsyncStorage (SecureStore uniquement)
 */

import { supabase, SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface AuthMember {
  id:          string;
  displayName: string;
}

export interface AuthSuccess {
  success:      true;
  sessionToken: string;
  expiresAt:    number; // unix timestamp
  member:       AuthMember;
}

export interface AuthFailure {
  success:      false;
  error:        'invalid_credentials' | 'account_locked' | 'network_error' | 'unknown';
  attemptsLeft?: number;
  lockUntil?:    number; // unix timestamp
}

export type AuthResult = AuthSuccess | AuthFailure;

export interface SessionVerification {
  valid:        boolean;
  memberId?:    string;
  displayName?: string;
  expiresAt?:   number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 via Web Crypto API (disponible dans React Native >= 0.71 et web)
// Aucune dépendance externe requise.
// ─────────────────────────────────────────────────────────────────────────────
export async function hashPin(pin: string, salt: string): Promise<string> {
  const input   = `${pin}:${salt}`;
  const encoder = new TextEncoder();
  const data    = encoder.encode(input);
  const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Appel RPC générique (ZERO supabase.auth.*)
// ─────────────────────────────────────────────────────────────────────────────
async function callRpc<T>(fn: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// getSalt — récupère le sel du membre (non secret, sert à calculer le hash)
// ─────────────────────────────────────────────────────────────────────────────
export async function getSalt(displayName: string): Promise<string | null> {
  try {
    const result = await callRpc<{ salt: string; found: boolean }>(
      'get_member_salt',
      { p_display_name: displayName },
    );
    return result.found ? result.salt : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// authenticate — flux complet d'authentification
// ─────────────────────────────────────────────────────────────────────────────
export async function authenticate(
  displayName: string,
  pin: string,
): Promise<AuthResult> {
  try {
    // 1. Récupérer le sel
    const salt = await getSalt(displayName);
    if (salt === null) {
      // Membre non trouvé — réponse générique (pas de divulgation)
      return { success: false, error: 'invalid_credentials' };
    }

    // 2. Hasher le PIN côté client (le PIN brut ne part jamais sur le réseau)
    const pinHash = await hashPin(pin, salt);

    // 3. Authentification serveur
    const result = await callRpc<{
      success:      boolean;
      error?:       string;
      sessionToken?: string;
      expiresAt?:   number;
      member?:      { id: string; displayName: string };
      attemptsLeft?: number;
      lockUntil?:   number;
    }>('authenticate_pin', {
      p_display_name: displayName,
      p_pin_hash:     pinHash,
    });

    if (result.success && result.sessionToken && result.member && result.expiresAt) {
      return {
        success:      true,
        sessionToken: result.sessionToken,
        expiresAt:    result.expiresAt,
        member:       {
          id:          result.member.id,
          displayName: result.member.displayName,
        },
      };
    }

    if (result.error === 'account_locked') {
      return {
        success:   false,
        error:     'account_locked',
        lockUntil: result.lockUntil,
      };
    }

    return {
      success:      false,
      error:        'invalid_credentials',
      attemptsLeft: result.attemptsLeft,
    };

  } catch (e) {
    console.error('[pinAuth] Erreur réseau (sans données sensibles)');
    return { success: false, error: 'network_error' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyToken — vérifie un token de session stocké en SecureStore
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyToken(token: string): Promise<SessionVerification> {
  try {
    const result = await callRpc<{
      valid:        boolean;
      memberId?:    string;
      displayName?: string;
      expiresAt?:   number;
    }>('verify_session', { p_session_token: token });

    return {
      valid:       result.valid,
      memberId:    result.memberId,
      displayName: result.displayName,
      expiresAt:   result.expiresAt,
    };
  } catch {
    return { valid: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// logoutToken — invalide le token côté serveur
// ─────────────────────────────────────────────────────────────────────────────
export async function logoutToken(token: string): Promise<void> {
  try {
    await callRpc('logout_session', { p_session_token: token });
  } catch {
    // Échec silencieux — la session expirera naturellement côté serveur
  }
}
