import React, {
    createContext, useContext, useState, useCallback, useMemo,
    type ReactNode,
  } from 'react';
  
  import type { PostData, Comment, Author, Story } from './types';
  import { INITIAL_POSTS, INITIAL_STORIES } from './mockData';
  import { ME } from './types';
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface SocialCtx {
    posts:         PostData[];
    stories:       Story[];
    // Actions
    toggleLike:    (postId: string) => void;
    toggleSave:    (postId: string) => void;
    toggleFollow:  (handle: string) => void;
    addPost:       (content: string, filmEmbed?: PostData['film']) => void;
    addComment:    (postId: string, text: string) => void;
    toggleCommentLike: (postId: string, commentId: string) => void;
    markStorySeen: (storyId: string) => void;
  }
  
  const Ctx = createContext<SocialCtx | null>(null);
  
  export const useSocial = (): SocialCtx => {
    const c = useContext(Ctx);
    if (!c) throw new Error('useSocial must be inside SocialProvider');
    return c;
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  export function SocialProvider({ children }: { children: ReactNode }) {
    const [posts,   setPosts]   = useState<PostData[]>(INITIAL_POSTS);
    const [stories, setStories] = useState<Story[]>(INITIAL_STORIES);
  
    // ── Toggle like (optimiste) ───────────────────────────────────────────────
    const toggleLike = useCallback((postId: string) => {
      setPosts(prev => prev.map(p =>
        p.id !== postId ? p : {
          ...p,
          liked: !p.liked,
          likes: p.liked ? p.likes - 1 : p.likes + 1,
        },
      ));
    }, []);
  
    // ── Toggle save ───────────────────────────────────────────────────────────
    const toggleSave = useCallback((postId: string) => {
      setPosts(prev => prev.map(p =>
        p.id !== postId ? p : { ...p, saved: !p.saved },
      ));
    }, []);
  
    // ── Follow / Unfollow (propagé dans tous les posts du même auteur) ─────────
    const toggleFollow = useCallback((handle: string) => {
      setPosts(prev => prev.map(p =>
        p.author.handle !== handle ? p : {
          ...p,
          author: { ...p.author, following: !p.author.following },
        },
      ));
    }, []);
  
    // ── Nouveau post (inséré en tête de feed) ─────────────────────────────────
    const addPost = useCallback((content: string, filmEmbed?: PostData['film']) => {
      const newPost: PostData = {
        id:       `local_${Date.now()}`,
        tab:      'foryou',
        author:   ME,
        content,
        time:     'À l\'instant',
        liked:    false,
        saved:    false,
        likes:    0,
        comments: [],
        film:     filmEmbed,
      };
      setPosts(prev => [newPost, ...prev]);
    }, []);
  
    // ── Nouveau commentaire ───────────────────────────────────────────────────
    const addComment = useCallback((postId: string, text: string) => {
      const comment: Comment = {
        id:     `cmt_${Date.now()}`,
        author: ME,
        text,
        time:   'maintenant',
        likes:  0,
        liked:  false,
      };
      setPosts(prev => prev.map(p =>
        p.id !== postId ? p : { ...p, comments: [...p.comments, comment] },
      ));
    }, []);
  
    // ── Like commentaire ──────────────────────────────────────────────────────
    const toggleCommentLike = useCallback((postId: string, commentId: string) => {
      setPosts(prev => prev.map(p =>
        p.id !== postId ? p : {
          ...p,
          comments: p.comments.map(c =>
            c.id !== commentId ? c : {
              ...c,
              liked: !c.liked,
              likes: c.liked ? c.likes - 1 : c.likes + 1,
            },
          ),
        },
      ));
    }, []);
  
    // ── Marquer story comme vue ───────────────────────────────────────────────
    const markStorySeen = useCallback((storyId: string) => {
      setStories(prev => prev.map(s =>
        s.id !== storyId ? s : { ...s, seen: true },
      ));
    }, []);
  
    const value = useMemo<SocialCtx>(() => ({
      posts, stories,
      toggleLike, toggleSave, toggleFollow,
      addPost, addComment, toggleCommentLike,
      markStorySeen,
    }), [
      posts, stories,
      toggleLike, toggleSave, toggleFollow,
      addPost, addComment, toggleCommentLike,
      markStorySeen,
    ]);
  
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }