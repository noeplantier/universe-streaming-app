// lib/supabase.ts
// ─────────────────────────────────────────────────────────────────────────────
//  Client Supabase partagé + types générés manuellement
//  Usage : import { supabase } from '@/lib/supabase'
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

// ── Variables d'environnement ──────────────────────────────────────────────
// Dans .env.local (ou app.config.js extra) :
//   EXPO_PUBLIC_SUPABASE_URL=https://knrzbdqfflobfjdmqyte.supabase.co
//   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL
  ?? 'https://knrzbdqfflobfjdmqyte.supabase.co';
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ── Types ──────────────────────────────────────────────────────────────────
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

// Colonnes légères pour les listes (évite de charger description/cast)
export const WORK_LIST_COLUMNS =
  'id,title,category,genre,year,likes,comments,image,is_original,adjective,duration' as const;

// ── Helpers ────────────────────────────────────────────────────────────────
export type SortOption   = 'Popularité' | 'Récent' | 'Anciens';
export type DurationBand = 'Toutes' | '< 60 min' | '60–100 min' | '> 100 min';

/** Construit et exécute la requête works filtrée côté Supabase */
export async function fetchWorks(params: {
  tab:      string;
  search:   string;
  genre:    string;
  sortBy:   SortOption;
  duration: DurationBand;
  year:     string;
}) {
  const { tab, search, genre, sortBy, duration, year } = params;

  let q = supabase
    .from('works')
    .select(WORK_LIST_COLUMNS);

  // ── Filtre tab principal ─────────────────────────────────────
  if (tab === 'Mini-séries') {
    q = q.eq('category', 'Mini-série');
  } else if (tab === 'Films') {
    q = q.in('category', ['Film', 'ORIGINAL', 'Interdit']);
  }

  // ── Recherche texte (titre ou adjective) ─────────────────────
  if (search.trim()) {
    q = q.or(`title.ilike.%${search.trim()}%,adjective.ilike.%${search.trim()}%,genre.ilike.%${search.trim()}%`);
  }

  // ── Genre ────────────────────────────────────────────────────
  if (genre !== 'Tous') q = q.eq('genre', genre);

  // ── Durée ────────────────────────────────────────────────────
  if (duration === '< 60 min')    q = q.lt('duration', 60);
  else if (duration === '60–100 min') q = q.gte('duration', 60).lte('duration', 100);
  else if (duration === '> 100 min')  q = q.gt('duration', 100);

  // ── Année ────────────────────────────────────────────────────
  if (year !== 'Toutes') q = q.eq('year', parseInt(year, 10));

  // ── Tri ──────────────────────────────────────────────────────
  if (sortBy === 'Popularité') q = q.order('likes', { ascending: false });
  else if (sortBy === 'Récent')  q = q.order('year',  { ascending: false });
  else if (sortBy === 'Anciens') q = q.order('year',  { ascending: true  });

  const { data, error } = await q.returns<Work[]>();
  if (error) throw error;
  return data ?? [];
}

/** Top N films par likes (trending) */
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

/** Détail complet d'un film par son id */
export async function fetchWorkById(id: number | string): Promise<Work | null> {
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .eq('id', id)
    .single<Work>();

  if (error) throw error;
  return data;
}