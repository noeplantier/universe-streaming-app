import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { FeedTab, POSTS_LIMIT } from '@/components/social/SocialTokens';
import type { Post, SupabasePost, Pro, mapPost } from '@/components/social/SocialTypes';
import { dbToggleLike } from '@/components/social/InteractionContext';

const FEED_FIELDS =
  'id, user_id, work_title, work_year, work_director, ' +
  'work_genre, rating, body, image_url, image_valid, ' +
  'tags, tone, likes_count, shares_count, created_at';

  

export function usePostsFeed(tab: FeedTab) {
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (tab === 'Pros') { setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('community_posts_enriched')
          .select(FEED_FIELDS)
          .order('created_at', { ascending: false })
          .limit(POSTS_LIMIT);
        if (cancelled) return;
        if (err) throw err;
        setPosts((data ?? []).map(r => mapPost(r as unknown as SupabasePost)));
      } catch {
        if (!cancelled) setError('Impossible de charger le feed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, refreshKey]);

  useEffect(() => {
    if (tab === 'Pros') return;
    const ch = supabase
    .channel('social:inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'community_posts' },
      async (payload) => {
        const { data } = await supabase
          .from('community_posts_enriched')
          .select(FEED_FIELDS)
          .eq('id', payload.new.id)
          .single();
  
        if (!data) return;
  
        const p = mapPost(data as unknown as SupabasePost);
        setPosts(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]);
      },
    )
    .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tab]);

  const toggleLike = useCallback(async (postId: string, userId: string, wasLiked: boolean) => {
    setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, likes: p.likes + (wasLiked ? -1 : 1) }));
    try { await dbToggleLike(postId, userId, wasLiked); } catch {
      setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, likes: p.likes + (wasLiked ? 1 : -1) }));
    }
  }, []);

  return { posts, loading, error, refresh, toggleLike };
}


export function useProDirectory(search = '', role = '') {
  const [pros, setPros] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roleToDb: Record<string, string> = {
    'Tous': '',
    'Réalisateur·ice': 'réalisateur',
    'Producteur·ice': 'producteur',
    'Acteur·ice': 'acteur',

    'Scénariste': 'scénariste',
    'Directeur·ice photo': 'directeur·ice photo',
    'Compositeur·ice': 'compositeur·ice',
    'Monteur·euse': 'monteur·euse',
    'Distributeur·ice': 'distributeur·ice',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let q = supabase
        .from('professionals')
        .select('id,name,role,avatar,bio,films,location,contact_email,website,verified,open_to,created_at')
        .order('verified', { ascending: false })
        .order('name', { ascending: true })
        .limit(80);

      const dbRole = roleToDb[role] ?? '';

      // Filtre rôle en DB (pas en UI)
      if (dbRole) q = q.eq('role', dbRole);

      // Filtre recherche
      if (search) q = q.ilike('name', `%${search}%`);

      const { data, error: err } = await q;
      if (err) throw err;

      setPros((data ?? []) as Pro[]);
    } catch {
      setError('Impossible de charger le répertoire.');
    } finally {
      setLoading(false);
    }
  }, [search, role]);

  useEffect(() => { load(); }, [load]);

  return { pros, loading, error, refresh: load };
}

type PublishPayload = {
  work_title: string; work_year: string; work_director: string;
  work_genre: string; rating: number; body: string;
  image_url: string; image_valid: boolean; tags: string[]; tone: string;
};

export async function dbPublishPost(payload: PublishPayload): Promise<string | null> {
  try {
    const { data: sd } = await supabase.auth.getSession();
    let userId = sd.session?.user?.id;
    if (!userId) {
      const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) throw anonErr;
      userId = anon.session?.user?.id;
    }
    if (!userId) return null;
    const { data, error } = await supabase
      .from('community_posts')
      .insert({ ...payload, user_id: userId })
      .select('id').single();
    if (error) throw error;
    return (data as any).id ?? null;
  } catch (e) { console.error('[dbPublishPost]', e); return null; }
}

export async function dbContactPro(
  proId: string, subject: string, message: string, senderEmail: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from('pro_contact_requests')
      .insert({ pro_id: proId, subject, message, sender_email: senderEmail });
    return !error;
  } catch { return false; }
}