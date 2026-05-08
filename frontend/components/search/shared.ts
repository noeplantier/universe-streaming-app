/**
 * components/search/shared.ts
 * Types + design tokens + helpers partagés par tous les composants search.
 */

import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TYPE — miroir exact de public.works
// ─────────────────────────────────────────────────────────────────────────────
export interface FilmRow {
  id:          number;
  title:       string;
  category:    'Film' | 'Mini-série' | 'ORIGINAL' | 'Interdit';
  genre:       string;
  year:        number;
  likes:       number;
  comments:    number | null;
  image:       string | null;
  is_original: boolean;
  adjective:   string | null;
  duration:    number | null;
  description: string | null;
  director:    string | null;
  cast_list:   string[] | null;
  created_at:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
export const T = {
  bg:         '#0A0A0F',
  navyMid:    '#0D2240',
  navyBright: '#1E4A7A',
  surf:       'rgba(13,34,64,0.55)',
  surfBorder: 'rgba(255,255,255,0.08)',
  text:       '#F2F2F7',
  textSec:    '#8E8E93',
  textTert:   '#636366',
  blue:       '#5A96E6',
  gold:       '#F5C842',
  goldDim:    'rgba(245,200,66,0.14)',
  silver:     '#C0C0C0',
  bronze:     '#CD7F32',
  white:      '#FFFFFF',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────
import { Dimensions } from 'react-native';
const { width: W } = Dimensions.get('window');

export const DIMS = {
  W,
  CAROUSEL_ITEM_W:  W * 0.72,
  CAROUSEL_SPACING: 14,
  get CAROUSEL_SIDE() { return (W - this.CAROUSEL_ITEM_W) / 2; },
  get CAROUSEL_ITEM_H() { return this.CAROUSEL_ITEM_W * 1.46; },
  LAND_W: 240,
  LAND_H: 135,
  PORT_W: 130,
  PORT_H: 195,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export function resolveStorageUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('community-images').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/** Résout l'image d'un FilmRow (champ "image" uniquement, pas de poster_url) */
export function resolveFilmImage(row: Pick<FilmRow, 'id' | 'image'>): string {
  const url = resolveStorageUrl(row.image);
  return url ?? `https://picsum.photos/seed/work_${row.id}/800/600`;
}

/** Résout l'image d'un Work (depuis @/lib/supabase) */
export function resolveWorkImage(item: { id: string | number; image?: string | null }): string {
  const url = resolveStorageUrl(item.image);
  return url ?? `https://picsum.photos/seed/work_${item.id}/400/600`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RANK CONFIG
// ─────────────────────────────────────────────────────────────────────────────
export interface RankConfig { num: string; color: string; glow: string; border: string }

export function getRankConfig(rank: number): RankConfig {
  if (rank === 1) return { num: '1', color: T.gold,   glow: 'rgba(245,200,66,0.35)',  border: 'rgba(245,200,66,0.50)'  };
  if (rank === 2) return { num: '2', color: T.silver, glow: 'rgba(192,192,192,0.28)', border: 'rgba(192,192,192,0.45)' };
  if (rank === 3) return { num: '3', color: T.bronze, glow: 'rgba(205,127,50,0.28)',  border: 'rgba(205,127,50,0.45)'  };
  return { num: String(rank), color: 'rgba(255,255,255,0.45)', glow: 'transparent', border: 'transparent' };
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — toutes les œuvres pour HeroBanner (sans limit)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchAllWorks(): Promise<FilmRow[]> {
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .order('likes', { ascending: false });
  if (error) { console.error('[fetchAllWorks]', error); return []; }
  return (data ?? []) as FilmRow[];
}