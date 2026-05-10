// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? 'https://knrzbdqfflobfjdmqyte.supabase.co';
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ─────────────────────────────────────────────────────────────────────────────
// Storage d'auth adapté selon l'environnement
// ─────────────────────────────────────────────────────────────────────────────
type StorageLike = {
  getItem:    (key: string) => Promise<string | null>;
  setItem:    (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// Fallback mémoire (SSR / Node)
const memStorage: StorageLike = (() => {
  const m = new Map<string, string>();
  return {
    getItem:    async (k) => m.get(k) ?? null,
    setItem:    async (k, v) => { m.set(k, v); },
    removeItem: async (k) => { m.delete(k); },
  };
})();

function makeAuthStorage(): StorageLike {
  // SSR / Node
  if (typeof window === 'undefined') return memStorage;

  // Web : localStorage
  try {
    const ls = window.localStorage;
    return {
      getItem:    async (k) => ls.getItem(k),
      setItem:    async (k, v) => { ls.setItem(k, v); },
      removeItem: async (k) => { ls.removeItem(k); },
    };
  } catch {
    return memStorage;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Supabase (singleton)
// ─────────────────────────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:           makeAuthStorage(),
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl:false,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────────────────────────────────────
export type Work = {
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
};

// Colonnes légères pour les listes (pas de description ni cast_list)
export const WORK_LIST_COLUMNS =
  'id,title,category,genre,year,likes,comments,image,is_original,adjective,duration' as const;

export type SortOption   = 'Popularité' | 'Récent' | 'Anciens';
export type DurationBand = 'Toutes' | '< 60 min' | '60–100 min' | '> 100 min';

// ─────────────────────────────────────────────────────────────────────────────
// fetchWorks — liste filtrée + triée
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchWorks(params: {
  tab:      string;
  search:   string;
  genre:    string;
  sortBy:   SortOption;
  duration: DurationBand;
  year:     string;
}): Promise<Work[]> {
  const { tab, search, genre, sortBy, duration, year } = params;

  let q = supabase.from('works').select(WORK_LIST_COLUMNS);

  // Catégorie
  if (tab === 'Mini-séries') {
    q = q.eq('category', 'Mini-série');
  } else if (tab === 'Films') {
    q = q.in('category', ['Film', 'ORIGINAL', 'Interdit']);
  }

  // Recherche full-text légère
  const s = search.trim();
  if (s) {
    q = q.or(`title.ilike.%${s}%,adjective.ilike.%${s}%,genre.ilike.%${s}%`);
  }

  if (genre !== 'Tous') q = q.eq('genre', genre);

  // Durée
  if (duration === '< 60 min')    q = q.lt('duration', 60);
  else if (duration === '60–100 min') q = q.gte('duration', 60).lte('duration', 100);
  else if (duration === '> 100 min')  q = q.gt('duration', 100);

  if (year !== 'Toutes') q = q.eq('year', parseInt(year, 10));

  // Tri
  if (sortBy === 'Popularité')    q = q.order('likes', { ascending: false });
  else if (sortBy === 'Récent')   q = q.order('year',  { ascending: false });
  else if (sortBy === 'Anciens')  q = q.order('year',  { ascending: true  });

  const { data, error } = await q.returns<Work[]>();
  if (error) throw error;
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchTrending — top N par likes
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchTrending(limit = 4): Promise<Work[]> {
  const { data, error } = await supabase
    .from('works')
    .select(WORK_LIST_COLUMNS)
    .order('likes', { ascending: false })
    .limit(limit)
    .returns<Work[]>();
  if (error) throw error;
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchWorkById
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchWorkById(id: number | string): Promise<Work | null> {
  const raw = String(id).trim();
  if (!/^\d+$/.test(raw)) return null;
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .eq('id', raw)
    .single<Work>();
  if (error) throw error;
  return data ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveWorkIdByTitleYear
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveWorkIdByTitleYear(params: {
  title: string;
  year?: number;
  type:  'film' | 'série';
}): Promise<number | null> {
  const { title, year, type } = params;
  let q = supabase
    .from('works')
    .select('id')
    .ilike('title', `%${title.trim()}%`);
  if (typeof year === 'number') q = q.eq('year', year);
  if (type === 'série') q = q.eq('category', 'Mini-série');
  else                  q = q.in('category', ['Film', 'ORIGINAL', 'Interdit']);
  const { data, error } = await q.limit(1);
  if (error) throw error;
  const id = data?.[0]?.id ?? null;
  return typeof id === 'number' ? id : null;
}