import { useState, useEffect, useRef, useCallback } from 'react';
import { getDeviceId } from '../services/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';
const TOKEN_TTL_MS = 3.5 * 60 * 60 * 1000; // refresh at 3.5h (token expires at 4h)

export interface StreamToken {
  token: string;
  signedUrl: string;
  expiresAt: number;
  qualities: QualityLevel[];
}

export interface QualityLevel {
  label: string;       // '360p' | '720p' | '1080p' | '4K'
  bandwidth: number;   // bps
  resolution: string;
  playlistUrl: string;
}

// Backend (Pydantic) renvoie du snake_case — on remappe explicitement plutôt
// que de faire confiance au cast TS, sinon expiresAt vaut `undefined` et le
// timer de refresh se redéclenche en boucle quasi immédiate (setTimeout(NaN)).
async function fetchStreamToken(filmId: string): Promise<StreamToken> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${BACKEND_URL}/api/stream/${filmId}/token`, {
    method: 'POST',
    headers: {
      'X-Device-Id': deviceId,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const raw = await res.json();
  return {
    token:      raw.token,
    signedUrl:  raw.signed_url,
    expiresAt:  raw.expires_at,
    qualities:  raw.qualities ?? [],
  };
}

export function useStreamingToken(filmId: string | null) {
  const [streamToken, setStreamToken] = useState<StreamToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const token = await fetchStreamToken(id);
      setStreamToken(token);

      // Schedule next refresh before expiry
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      const delay = Math.max(0, token.expiresAt - Date.now() - 10_000);
      const clampedDelay = Math.min(delay, TOKEN_TTL_MS);
      refreshTimer.current = setTimeout(() => refresh(id), clampedDelay);
    } catch (e: any) {
      setError(e.message ?? 'Stream token error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!filmId) return;
    refresh(filmId);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [filmId, refresh]);

  return { streamToken, loading, error, refresh: () => filmId && refresh(filmId) };
}
