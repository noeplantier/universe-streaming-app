/**
 * contexts/PinAuthContext.tsx — État global d'authentification PIN
 *
 * Fournit :
 *   - isAuthenticated  : boolean
 *   - member           : { id, displayName } | null
 *   - isLoading        : boolean (vérification initiale de session)
 *   - login()          : déclenche l'auth + sauvegarde session
 *   - logout()         : invalide côté serveur + supprime session locale
 *
 * Pattern :
 *   Au démarrage, charge la session depuis SecureStore et vérifie côté
 *   serveur (via verify_session RPC). Si valide → authentifié directement,
 *   pas d'écran de login. Si invalide → redirige vers login.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import { authenticate, verifyToken, logoutToken, type AuthMember } from '@/services/auth/pinAuth';
import { saveSession, loadSession, clearSession } from '@/services/auth/session';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface PinAuthState {
  isAuthenticated: boolean;
  member:          AuthMember | null;
  isLoading:       boolean;
  error:           string | null;
  attemptsLeft:    number | null;
  isLocked:        boolean;
  lockUntil:       Date | null;
}

interface PinAuthActions {
  login:           (displayName: string, pin: string) => Promise<boolean>;
  logout:          () => Promise<void>;
  clearError:      () => void;
}

type PinAuthContextValue = PinAuthState & PinAuthActions;

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const PinAuthContext = createContext<PinAuthContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function PinAuthProvider({ children }: { children: React.ReactNode }) {
  const [member,          setMember]         = useState<AuthMember | null>(null);
  const [isAuthenticated, setAuthenticated]  = useState(false);
  const [isLoading,       setLoading]        = useState(true);
  const [error,           setError]          = useState<string | null>(null);
  const [attemptsLeft,    setAttemptsLeft]   = useState<number | null>(null);
  const [isLocked,        setLocked]         = useState(false);
  const [lockUntil,       setLockUntil]      = useState<Date | null>(null);

  // ── Restauration de session au démarrage ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadSession();
        if (!stored) { if (!cancelled) setLoading(false); return; }

        // Vérification côté serveur (token expiré, révoqué ?)
        const check = await verifyToken(stored.token);
        if (cancelled) return;

        if (check.valid && check.displayName && check.memberId) {
          setMember({ id: check.memberId, displayName: check.displayName });
          setAuthenticated(true);
        } else {
          await clearSession();
        }
      } catch {
        await clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (displayName: string, pin: string): Promise<boolean> => {
    setError(null);
    setAttemptsLeft(null);
    setLocked(false);
    setLockUntil(null);

    const result = await authenticate(displayName, pin);

    if (result.success) {
      await saveSession({
        token:       result.sessionToken,
        expiresAt:   result.expiresAt,
        memberId:    result.member.id,
        displayName: result.member.displayName,
      });
      setMember(result.member);
      setAuthenticated(true);
      return true;
    }

    // Gestion des erreurs (sans révéler de détail cryptographique)
    if (result.error === 'account_locked' && result.lockUntil) {
      const until = new Date(result.lockUntil * 1000);
      setLocked(true);
      setLockUntil(until);
      setError('Trop de tentatives. Réessayez dans 15 minutes.');
    } else if (result.error === 'network_error') {
      setError('Erreur de connexion. Vérifiez votre réseau.');
    } else {
      const left = result.attemptsLeft ?? null;
      setAttemptsLeft(left);
      if (left !== null && left <= 0) {
        setError('Compte bloqué temporairement.');
      } else if (left !== null && left <= 2) {
        setError(`Code incorrect — ${left} tentative${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}`);
      } else {
        setError('Code incorrect.');
      }
    }
    return false;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const stored = await loadSession();
      if (stored?.token) await logoutToken(stored.token);
    } finally {
      await clearSession();
      setMember(null);
      setAuthenticated(false);
      setError(null);
    }
  }, []);

  // ── clearError ────────────────────────────────────────────────────────────
  const clearError = useCallback(() => {
    setError(null);
    setAttemptsLeft(null);
  }, []);

  return (
    <PinAuthContext.Provider value={{
      isAuthenticated, member, isLoading,
      error, attemptsLeft, isLocked, lockUntil,
      login, logout, clearError,
    }}>
      {children}
    </PinAuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function usePinAuth(): PinAuthContextValue {
  const ctx = useContext(PinAuthContext);
  if (!ctx) throw new Error('usePinAuth doit être utilisé dans <PinAuthProvider>');
  return ctx;
}
