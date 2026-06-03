// contexts/AuthContext.tsx
// ─────────────────────────────────────────────────────────────────────────────
//  Auth anonyme — session persistée par device via Supabase
//  Compatible avec l'interface existante (login / register / logout / updateUser)
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useRef, ReactNode,
} from 'react';
import { authAPI, tokenAPI, type User } from '../services/api';

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface AuthContextType {
  user:     User | null;
  token:    string | null;
  loading:  boolean;
  login:            (email: string, password: string) => Promise<void>;
  register:         (username: string, email: string, password: string) => Promise<void>;
  logout:           () => Promise<void>;
  updateUser:       (data: Partial<User>) => void;
  refreshProfile:   () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── GUEST FALLBACK (réseau indisponible au 1er lancement) ───────────────────
const GUEST_USER: User = {
  id:                  'hugo-chassaing',
  username:            'Hugo Chassaing',
  display_name:        'Hugo Chassaing',
  email:               'guest@universe.com',
  avatar_url:          'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJAonSMhABsc42klQbsziDZ0ga-xmluRvfLQ&s',
  bio:                 'Bienvenue dans UNIVERSE 🌌',
  role:                'creator',
  location:            '',
  website:             '',
  is_verified:         false,
  is_pro:              false,
  is_industry_contact: false,
  followers_count:     0,
  following_count:     0,
  films_seen_count:    0,
  reviews_count:       0,
};

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const booted = useRef(false);

  // ── Bootstrap — une seule fois au démarrage ──────────────────────────────
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    autoLogin();
  }, []);

  async function autoLogin() {
    try {
      // initSession gère les 3 niveaux : session existante → anon Supabase → UUID device
      const { user, token } = await authAPI.initSession();
      setUser(user);
      setToken(token ?? 'device-session');
    } catch {
      // Fallback absolu (pas de réseau au 1er lancement)
      setUser(GUEST_USER);
      setToken('device-session');
    } finally {
      setLoading(false);
    }
  }

  // ── refreshProfile — appelé par useFocusEffect dans profile.tsx ──────────
  const refreshProfile = useCallback(async () => {
    const me = await authAPI.me();
    if (me) setUser(me);
  }, []);

  // ── login — pour les users qui souhaitent se connecter officiellement ────
  async function login(email: string, password: string) {
    const res = await authAPI.login({ email, password });
    setToken(res.token);
    setUser(res.user);
  }

  // ── register ─────────────────────────────────────────────────────────────
  async function register(username: string, email: string, password: string) {
    const res = await authAPI.register({ username, email, password });
    setToken(res.token);
    setUser(res.user);
  }

  // ── logout — revient en mode UUID device ─────────────────────────────────
  async function logout() {
    const fallbackUser = await authAPI.logout();
    setUser(fallbackUser);
    setToken('device-session');
  }

  // ── updateUser — mise à jour optimiste locale ─────────────────────────────
  function updateUser(data: Partial<User>) {
    setUser(prev => prev ? { ...prev, ...data } : null);
  }

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout,
      updateUser, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── HOOK ────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}