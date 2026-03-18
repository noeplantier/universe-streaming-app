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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkToken();
  }, []);

  async function checkToken() {
    try {
      const savedToken = await tokenAPI.get();
      if (savedToken) {
        setToken(savedToken);
        const me = await authAPI.me();
        setUser(me);
      }
    } catch {
      await tokenAPI.remove();
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
    setToken(null);
    setUser(null);
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
