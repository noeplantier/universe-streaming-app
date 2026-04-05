import React, {
    createContext, useContext, useState, useCallback,
    useEffect, useMemo, type ReactNode,
  } from 'react';
  import { Platform, Vibration } from 'react-native';
  
  import {
    DEFAULT_SETTINGS,
    type AppSettings, type UserProfile, type UserRole,
  } from './types';
  
  // AsyncStorage optionnel (peut manquer selon la config Expo)
  let AsyncStorage: any = null;
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch { /* pas disponible — on fonctionne in-memory */ }
  
  const STORAGE_KEY = '@universe_settings_v2';
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Profil mock (dans un vrai projet → vient de AuthContext)
  const MOCK_USER: UserProfile = {
    id:         'u_hugo',
    username:   'hugoch',
    email:      'hugo@universe.film',
    bio:        'Réalisateur indépendant. Passionné de cinéma de genre et de documentaires poétiques.',
    avatar_url: 'https://i.pravatar.cc/200?u=hugoch',
    role:       'director',
    isPremium:  false,
    followers:  1240,
    following:  348,
    posts:      87,
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface SettingsCtx {
    settings: AppSettings;
    user:     UserProfile;
    loaded:   boolean;
    // Modifier un seul paramètre
    setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
    // Modifier le profil
    updateProfile: (patch: Partial<Pick<UserProfile, 'username' | 'bio' | 'avatar_url' | 'role'>>) => void;
    // Réinitialiser tout
    resetSettings: () => void;
    // Déconnexion (simulée)
    logout: () => void;
  }
  
  const Ctx = createContext<SettingsCtx | null>(null);
  
  export const useSettings = (): SettingsCtx => {
    const c = useContext(Ctx);
    if (!c) throw new Error('useSettings must be inside SettingsProvider');
    return c;
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [user,     setUser]     = useState<UserProfile>(MOCK_USER);
    const [loaded,   setLoaded]   = useState(false);
  
    // ── Chargement initial depuis AsyncStorage ────────────────────────────────
    useEffect(() => {
      (async () => {
        if (AsyncStorage) {
          try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) {
              const saved = JSON.parse(raw) as Partial<AppSettings>;
              setSettings(prev => ({ ...prev, ...saved }));
            }
          } catch { /* ignoré */ }
        }
        setLoaded(true);
      })();
    }, []);
  
    // ── Persistance à chaque changement ──────────────────────────────────────
    useEffect(() => {
      if (!loaded) return;
      if (AsyncStorage) {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
      }
      // Application réelle des paramètres sur l'app :
      // — haptics : désactivé si Platform.OS === 'web'
      // — dataSaver, theme, language → propager via EventEmitter ou useContext en cascade
    }, [settings, loaded]);
  
    // ── setSetting (optimiste + haptic feedback) ──────────────────────────────
    const setSetting = useCallback(<K extends keyof AppSettings>(
      key: K, value: AppSettings[K],
    ) => {
      setSettings(prev => ({ ...prev, [key]: value }));
  
      // Feedback haptique sur toggle (si activé et natif)
      if (Platform.OS !== 'web' && key !== 'haptics') {
        // On lit la valeur courante via closure — suffisant ici
        try {
          if (typeof value === 'boolean') Vibration.vibrate(30);
        } catch { /* ignoré */ }
      }
    }, []);
  
    // ── Profil ────────────────────────────────────────────────────────────────
    const updateProfile = useCallback((patch: Partial<Pick<UserProfile, 'username' | 'bio' | 'avatar_url' | 'role'>>) => {
      setUser(prev => ({ ...prev, ...patch }));
    }, []);
  
    // ── Reset ─────────────────────────────────────────────────────────────────
    const resetSettings = useCallback(() => {
      setSettings(DEFAULT_SETTINGS);
      if (AsyncStorage) AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }, []);
  
    // ── Logout simulé ─────────────────────────────────────────────────────────
    const logout = useCallback(() => {
      // Dans un vrai projet : appel à AuthContext.logout()
      setUser(MOCK_USER);
      resetSettings();
    }, [resetSettings]);
  
    const value = useMemo<SettingsCtx>(() => ({
      settings, user, loaded,
      setSetting, updateProfile, resetSettings, logout,
    }), [settings, user, loaded, setSetting, updateProfile, resetSettings, logout]);
  
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }