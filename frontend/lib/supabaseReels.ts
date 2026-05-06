import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════

export type Friend = {
  id:       string;
  name:     string;
  avatar:   string;
  followed: boolean;
};

export type Series = {
  id:        string;
  title:     string;
  director:  string | null;
  year:      number | null;
  tags:      string[];
  verified:  boolean;
};

export type Episode = {
  id:             string;
  series_id:      string;
  episode_number: number;
  episode_title:  string;
  poster_url:     string | null;
  video_url:      string | null;
  caption:        string | null;
  duration:       string | null;
  likes:          number;
  comment:        string | null;
  created_at:     string;
};

/** Type "enrichi" fusionnant épisode + série + likes amis — utilisé dans le Feed */
export type FeedFilm = {
  // Identité épisode
  id:            string;
  series_id:     string;
  title:         string;           // = series.title
  series:        string;           // = series.title (alias pour BottomCard)
  episode:       number;
  episode_title: string;
  // Médias
  poster_url:    string;
  video_url:     string;
  // Contenu
  caption:       string;
  duration:      string;
  likes:         number;
  comment?:      string;
  // Série
  director:      string;
  year:          number;
  tags:          string[];
  verified:      boolean;
  // Social
  liked_by_friends: Friend[];

  synopsis: string;


  likes_count: number;

  views_count: number;

  created_at: string;

  is_liked: boolean;

  is_saved: boolean;

}


// ═══════════════════════════════════════════════════════════════════
//  HELPERS INTERNES
// ═══════════════════════════════════════════════════════════════════

/** Récupère les amis qui ont liké chaque épisode d'une liste */
async function fetchFriendLikes(
  episodeIds: string[],
): Promise<Record<string, Friend[]>> {
  if (!episodeIds.length) return {};

  const { data, error } = await supabase
    .from('episode_friend_likes')
    .select('episode_id, friends(id, name, avatar, followed)')
    .in('episode_id', episodeIds);

  if (error) throw error;

  const map: Record<string, Friend[]> = {};
  for (const row of data ?? []) {
    const f = row.friends as unknown as Friend;
    if (!f) continue;
    (map[row.episode_id] ??= []).push(f);
  }
  return map;
}

/** Normalise un épisode brut (vue episodes_full) → FeedFilm */
function toFeedFilm(raw: any, friendLikes: Friend[]): FeedFilm {
  return {
    id:            raw.id,
    series_id:     raw.series_id,
    title:         raw.series_title   ?? raw.series_id,
    series:        raw.series_title   ?? raw.series_id,
    episode:       raw.episode_number,
    episode_title: raw.episode_title,
    poster_url:    raw.poster_url     ?? '',
    video_url:     raw.video_url      ?? '',
    caption:       raw.caption        ?? '',
    duration:      raw.duration       ?? '',
    likes:         raw.likes          ?? 0,
    comment:       raw.comment        ?? undefined,
    director:      raw.series_director ?? '',
    year:          raw.series_year     ?? 0,
    tags:          raw.series_tags     ?? [],
    verified:      raw.series_verified ?? false,
    liked_by_friends: friendLikes,
    synopsis:      raw.synopsis       ?? '',
    likes_count:   raw.likes          ?? 0,
    views_count:   raw.views_count    ?? 0,
    created_at:    raw.created_at     ?? '',
    is_liked:      raw.is_liked       ?? false,
    is_saved:      raw.is_saved       ?? false,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  API PUBLIQUE
// ═══════════════════════════════════════════════════════════════════

/**
 * Charge le feed complet, trié par nombre de likes (desc).
 * Utilise la vue `episodes_full` pour éviter les jointures côté client.
 */
export async function fetchFeed(limit = 20): Promise<FeedFilm[]> {
  const { data, error } = await supabase
    .from('episodes_full')
    .select('*')
    .order('likes', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = data ?? [];

  const ids       = rows.map((r: any) => r.id as string);
  const likeMap   = await fetchFriendLikes(ids);

  return rows.map((r: any) => toFeedFilm(r, likeMap[r.id] ?? []));
}

/**
 * Charge un épisode par son ID — pour la page détail /reel/[id]
 */
export async function fetchEpisodeById(id: string): Promise<FeedFilm | null> {
  const { data, error } = await supabase
    .from('episodes_full')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data)  return null;

  const likeMap = await fetchFriendLikes([id]);
  return toFeedFilm(data, likeMap[id] ?? []);
}

/**
 * Charge tous les épisodes d'une série
 */
export async function fetchEpisodesBySeries(seriesId: string): Promise<FeedFilm[]> {
  const { data, error } = await supabase
    .from('episodes_full')
    .select('*')
    .eq('series_id', seriesId)
    .order('episode_number', { ascending: true });

  if (error) throw error;
  const rows  = data ?? [];
  const ids   = rows.map((r: any) => r.id as string);
  const map   = await fetchFriendLikes(ids);

  return rows.map((r: any) => toFeedFilm(r, map[r.id] ?? []));
}

/**
 * Charge la liste des amis (pour la barre "Suggérés")
 */
export async function fetchFriends(): Promise<Friend[]> {
  const { data, error } = await supabase
    .from('friends')
    .select('id, name, avatar, followed')
    .order('followed', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Friend[];
}

/**
 * Toggle follow côté Supabase (nécessite auth)
 */
export async function toggleFollow(friendId: string, followed: boolean): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .update({ followed })
    .eq('id', friendId);

  if (error) throw error;
}

/**
 * Incrémente/décrémente les likes d'un épisode (optimistic update côté UI)
 */
export async function updateEpisodeLikes(episodeId: string, delta: 1 | -1): Promise<void> {
  const { error } = await supabase.rpc('increment_episode_likes', {
    episode_id: episodeId,
    delta,
  });
  // Si la fonction RPC n'existe pas encore, fallback silencieux
  if (error) console.warn('[supabaseReels] increment_episode_likes:', error.message);
}



  