import React, { createContext, useContext, useState, useCallback } from 'react';
import { Share } from 'react-native';
import { supabase } from '@/lib/supabase';

export async function dbToggleLike(postId: string, userId: string, wasLiked: boolean) {
  if (wasLiked) {
    await supabase.from('post_likes').delete().match({ post_id: postId, user_id: userId });
    await supabase.rpc('decrement_likes', { pid: postId });
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    await supabase.rpc('increment_likes', { pid: postId });
  }
}

export async function dbRecordShare(postId: string, userId: string, platform: string) {
  await supabase.from('post_shares').insert({ post_id: postId, user_id: userId, platform });
}

interface ICtx {
  liked:      Record<string, boolean>;
  saved:      Record<string, boolean>;
  toggleLike: (postId: string, userId: string) => void;
  toggleSave: (postId: string) => void;
  sharePost:  (postId: string, title: string, userId: string) => Promise<void>;
}

export const InteractionCtx = createContext<ICtx>({
  liked: {}, saved: {},
  toggleLike: () => {},
  toggleSave: () => {},
  sharePost: async () => {},
});

export function useInteraction() { return useContext(InteractionCtx); }

export function InteractionProvider({
  children, onToggleLike,
}: { children: React.ReactNode; onToggleLike: (id: string, uid: string, was: boolean) => void }) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const toggleLike = useCallback((postId: string, userId: string) => {
    const was = !!liked[postId];
    setLiked(p => ({ ...p, [postId]: !was }));
    onToggleLike(postId, userId, was);
  }, [liked, onToggleLike]);

  const toggleSave = useCallback((postId: string) => {
    setSaved(p => ({ ...p, [postId]: !p[postId] }));
  }, []);

  const sharePost = useCallback(async (postId: string, title: string, userId: string) => {
    try {
      const r = await Share.share({ message: `Découvrez cette critique de "${title}" sur Universe App !` });
      if (r.action === Share.sharedAction)
        await dbRecordShare(postId, userId, r.activityType ?? 'unknown');
    } catch {}
  }, []);

  return (
    <InteractionCtx.Provider value={{ liked, saved, toggleLike, toggleSave, sharePost }}>
      {children}
    </InteractionCtx.Provider>
  );
}
