// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://knrzbdqfflobfjdmqyte.supabase.co';
const SUPABASE_ANON =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// ✅ Environnements sans window (Node/SSR) : on évite AsyncStorage
const memoryStorage: StorageLike = {
  _m: new Map<string, string>(),
  getItem: async function (key) {
    return this._m.has(key) ? this._m.get(key)! : null;
  },
  setItem: async function (key, value) {
    this._m.set(key, value);
  },
  removeItem: async function (key) {
    this._m.delete(key);
  },
} as any;

function getAuthStorage(): StorageLike | undefined {
  // Si on n’est pas dans un navigateur, on évite @react-native-async-storage
  if (typeof window === 'undefined') return memoryStorage;

  // Sur le web (Expo Web), on peut utiliser localStorage directement
  // (Supabase auth-js est compatible avec un storage "like")
  try {
    const ls = window.localStorage;
    return {
      getItem: async (key) => ls.getItem(key),
      setItem: async (key, value) => {
        ls.setItem(key, value);
      },
      removeItem: async (key) => {
        ls.removeItem(key);
      },
    };
  } catch {
    return memoryStorage;
  }
}

const authStorage = getAuthStorage();

// ── Client ──
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// ── Types ──
export type Work = {
  id: number;
  title: string;
  category: 'Film' | 'Mini-série' | 'ORIGINAL' | 'Interdit';
  genre: string;
  year: number;
  likes: number;
  comments: number | null;
  image: string | null;
  is_original: boolean;
  adjective: string | null;
  duration: number | null;
  description: string | null;
  director: string | null;
  cast_list: string[] | null;
  created_at: string;
};

export const WORK_LIST_COLUMNS =
  'id,title,category,genre,year,likes,comments,image,is_original,adjective,duration' as const;

export type SortOption = 'Popularité' | 'Récent' | 'Anciens';
export type DurationBand = 'Toutes' | '< 60 min' | '60–100 min' | '> 100 min';

export async function fetchWorks(params: {
  tab: string;
  search: string;
  genre: string;
  sortBy: SortOption;
  duration: DurationBand;
  year: string;
}) {
  const { tab, search, genre, sortBy, duration, year } = params;

  let q = supabase.from('works').select(WORK_LIST_COLUMNS);

  if (tab === 'Mini-séries') q = q.eq('category', 'Mini-série');
  else if (tab === 'Films') q = q.in('category', ['Film', 'ORIGINAL', 'Interdit']);

  const s = search.trim();
  if (s) {
    q = q.or(
      `title.ilike.%${s}%,adjective.ilike.%${s}%,genre.ilike.%${s}%`
    );
  }

  if (genre !== 'Tous') q = q.eq('genre', genre);

  if (duration === '< 60 min') q = q.lt('duration', 60);
  else if (duration === '60–100 min') q = q.gte('duration', 60).lte('duration', 100);
  else if (duration === '> 100 min') q = q.gt('duration', 100);

  if (year !== 'Toutes') q = q.eq('year', Number.parseInt(year, 10));

  if (sortBy === 'Popularité') q = q.order('likes', { ascending: false });
  else if (sortBy === 'Récent') q = q.order('year', { ascending: false });
  else if (sortBy === 'Anciens') q = q.order('year', { ascending: true });

  const { data, error } = await q.returns<Work[]>();
  if (error) throw error;
  return data ?? [];
}

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

export async function fetchWorkById(id: number | string): Promise<Work | null> {
  const raw = typeof id === 'string' ? id.trim() : String(id);

  if (!/^\d+$/.test(raw)) return null;

  const { data, error } = await supabase
    .from('works')
    .select('*')
    .eq('id', raw) // ✅ évite bigint -> Number
    .single<Work>();

  if (error) throw error;
  return data ?? null;
}

export async function resolveWorkIdByTitleYear(params: {
  title: string;
  year?: number;
  type: 'film' | 'série';
}): Promise<number | null> {
  const { title, year, type } = params;

  let q = supabase.from('works').select('id').ilike('title', title);

  if (typeof year === 'number') q = q.eq('year', year);

  if (type === 'série') {
    q = q.eq('category', 'Mini-série');
  } else {
    // tes favs sont des films : tu peux élargir comme ça
    q = q.in('category', ['Film', 'ORIGINAL', 'Interdit']);
  }

  const { data, error } = await q.limit(1);
  if (error) throw error;

  const id = data?.[0]?.id ?? null;
  return typeof id === 'number' ? id : null;
}