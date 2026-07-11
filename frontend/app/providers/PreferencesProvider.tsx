// src/providers/PreferencesProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export type UserPreferences = {
  user_id: string;
  autoplay: boolean;
  video_quality: 'auto' | '4k' | '1080p' | '720p' | '480p';
  data_saver: boolean;
  notif_releases: boolean;
  notif_social: boolean;
  notif_festivals: boolean;
  private_profile: boolean;
  public_watchlist: boolean;
  updated_at: string;
};

type PrefKey = Exclude<keyof UserPreferences, 'user_id' | 'updated_at'>;

type PreferencesContextType = {
  prefs: UserPreferences | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setPref: <K extends PrefKey>(key: K, value: UserPreferences[K]) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const defaultPrefs = (uid: string): UserPreferences => ({
  user_id: uid,
  autoplay: true,
  video_quality: 'auto',
  data_saver: false,
  notif_releases: true,
  notif_social: true,
  notif_festivals: false,
  private_profile: false,
  public_watchlist: true,
  updated_at: new Date().toISOString(),
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setPrefs(null);
        setLoading(false);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('get_or_create_user_preferences');

      if (rpcError) throw rpcError;
      if (!data) {
        setPrefs(defaultPrefs(session.user.id));
      } else {
        setPrefs(data as UserPreferences);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger les préférences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setPrefs(null);
        setLoading(false);
        return;
      }
      refresh();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const setPref = async <K extends PrefKey>(key: K, value: UserPreferences[K]) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) throw new Error('Session expirée, reconnectez-vous');

    const uid = session.user.id;

    // Optimistic update
    setPrefs((prev) => {
      const base = prev ?? defaultPrefs(uid);
      return {
        ...base,
        [key]: value,
        updated_at: new Date().toISOString(),
      };
    });

    // Upsert DB
    let { error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: uid, [key]: value }, { onConflict: 'user_id' });

    // Retry 1x en cas de token expiré
    if (error && (error.code === 'PGRST301' || error.message?.toLowerCase().includes('jwt'))) {
      await supabase.auth.refreshSession();
      const retry = await supabase
        .from('user_preferences')
        .upsert({ user_id: uid, [key]: value }, { onConflict: 'user_id' });
      error = retry.error;
    }

    if (error) {
      // rollback soft: on recharge depuis la DB
      await refresh();
      throw error;
    }

    // resync léger pour récupérer updated_at exact
    await refresh();
  };

  const value = useMemo(
    () => ({
      prefs,
      loading,
      error,
      refresh,
      setPref,
    }),
    [prefs, loading, error]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}