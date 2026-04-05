import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, tokenAPI } from '../services/api';

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  bio: string;
  role: string;
  followers_count: number;
  following_count: number;
  films_seen_count: number;
  reviews_count: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Guest user for bypass auth mode
const GUEST_USER: User = {
  id: 'Hugo Chassaing',
  username: 'Hugo Chassaing',
  email: 'guest@universe.com',
  avatar_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJAonSMhABsc42klQbsziDZ0ga-xmluRvfLQ&s',
  bio: 'Bienvenue dans UNIVERSE 🌌',
  role: 'viewer',
  followers_count: 0,
  following_count: 0,
  films_seen_count: 0,
  reviews_count: 0,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    autoLogin();
  }, []);

  async function autoLogin() {
    try {
      // Check for existing token first
      const savedToken = await tokenAPI.get();
      if (savedToken) {
        setToken(savedToken);
        const me = await authAPI.me();
        setUser(me);
      } else {
        // Auto-login as guest for seamless experience
        setUser(GUEST_USER);
        setToken('guest-token');
      }
    } catch {
      // Fallback to guest user
      setUser(GUEST_USER);
      setToken('guest-token');
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await authAPI.login({ email, password });
    await tokenAPI.save(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function register(username: string, email: string, password: string) {
    const res = await authAPI.register({ username, email, password });
    await tokenAPI.save(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    await tokenAPI.remove();
    // Return to guest mode instead of null
    setToken('guest-token');
    setUser(GUEST_USER);
  }

  function updateUser(data: Partial<User>) {
    setUser(prev => prev ? { ...prev, ...data } : null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
