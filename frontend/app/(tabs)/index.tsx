/**
 * app/(reels)/index.tsx — ReelsScreen v8.0
 *
 * ── LOGIQUE isActive ─────────────────────────────────────────────────────────
 *
 *   isActive = index === activeIndex && screenFocused
 *
 *   PAS de isScrolling dans le calcul :
 *   → la vidéo joue pendant le drag (comme TikTok / drama.tv)
 *   → elle change uniquement au snap (onMomentumScrollEnd)
 *
 * ── CYCLE AUTO-PLAY / AUTO-PAUSE ─────────────────────────────────────────────
 *
 *   Scroll commence  → video joue TOUJOURS (pas de pause pendant le drag)
 *   Snap sur index N → activeIndex = N
 *                      FeedItem[N-1].isActive = false → posterOpacity 0→1 + pause
 *                      FeedItem[N].isActive   = true  → play + posterOpacity 1→0
 *   Changement écran → screenFocused = false → tous en pause
 *   Retour écran     → screenFocused = true  → activeIndex reprend
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, FlatList, InteractionManager, Modal,
  Platform, StyleSheet, Text, View,
} from 'react-native';
import { StatusBar }                                from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets }          from 'react-native-safe-area-context';
import { useWindowDimensions }                      from 'react-native';
import { useFocusEffect, useLocalSearchParams }     from 'expo-router';
import * as Haptics                                 from 'expo-haptics';

import FeedItem      from '@/components/reels/FeedItem';
import TopHeader     from '@/components/reels/TopHeader';
import InfoSheet     from '@/components/reels/Infosheet';
import DropdownMenu, { type MenuKey } from '@/components/DropDownMenu';
import type { FeedFilm }              from '@/components/reels/types';
import { supabase }                   from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface SupabaseReel {
  id:          string;
  user_id:     string;
  video_url:   string;
  title:       string;
  genre:       string;
  director:    string;
  year:        string;
  synopsis:    string;
  duration:    number;
  likes_count: number;
  views_count: number;
  created_at:  string;
}

export interface VideoProgress { positionMs: number; durationMs: number; }

function mapReel(r: SupabaseReel): FeedFilm {
  return {
    id:               r.id,
    title:            r.title,
    director:         r.director || 'Réalisateur inconnu',
    year:             r.year     || String(new Date().getFullYear()),
    genre:            r.genre    || 'Cinéma',
    synopsis:         r.synopsis || '',
    video_url:        r.video_url,
    poster_url:       '',
    duration:         String(r.duration),
    likes_count:      r.likes_count,
    views_count:      r.views_count,
    is_liked:         false,
    is_saved:         false,
    liked_by_friends: [],
    tags:             ['#CinémaIndépendant', `#${r.genre}`].filter(Boolean),
    created_at:       r.created_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK FEED
// ─────────────────────────────────────────────────────────────────────────────
function useReelsFeed(feedKey: MenuKey) {
  const [films,   setFilms]   = useState<FeedFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        let q = supabase.from('reels').select('*')
          .order('created_at', { ascending: false }).limit(50);
        if (feedKey === 'following') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: ids } = await supabase
              .from('follows').select('following_id').eq('follower_id', user.id);
            const arr = (ids ?? []).map((f: { following_id: string }) => f.following_id);
            if (arr.length) q = q.in('user_id', arr);
          }
        }
        const { data, error: err } = await q;
        if (cancelled) return;
        if (err) throw err;
        setFilms(data?.length ? data.map(mapReel) : []);
      } catch {
        if (!cancelled) { setFilms([]); setError('Impossible de charger le feed.'); }
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [feedKey]);

  useEffect(() => {
    const ch = supabase.channel('reels:insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reels' },
        ({ new: r }: { new: SupabaseReel }) => {
          const film = mapReel(r);
          setFilms(prev => prev.some(f => f.id === film.id) ? prev : [film, ...prev]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleLike = useCallback((filmId: string) => {
    setFilms(prev => prev.map(f => {
      if (f.id !== filmId) return f;
      const liked = !f.is_liked;
      supabase.from('reels')
        .update({ likes_count: f.likes_count + (liked ? 1 : -1) }).eq('id', filmId)
        .then(({ error }) => { if (error) console.warn('[like]', error); });
      return { ...f, is_liked: liked, likes_count: f.likes_count + (liked ? 1 : -1) };
    }));
  }, []);

  const incrementViews = useCallback((filmId: string) => {
    supabase.rpc('increment_views', { reel_id: filmId }).then(() => {});
  }, []);

  return { films, setFilms, loading, error, toggleLike, incrementViews };
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BANNER
// ─────────────────────────────────────────────────────────────────────────────
const ErrorBanner = memo(function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={eb.wrap}><Text style={eb.txt}>{message}</Text></View>
  );
});
const eb = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 99, backgroundColor: 'rgba(255,59,92,0.18)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,59,92,0.35)', paddingHorizontal: 14, paddingVertical: 10 },
  txt:  { color: '#FF3B5C', fontSize: 12, textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// REELS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets    = useSafeAreaInsets();
  const { newReelId } = useLocalSearchParams<{ newReelId?: string }>();
  const ITEM_H = H;

  const [activeIndex,   setActiveIndex]   = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>('foryou');
  const [infoFilm,      setInfoFilm]      = useState<FeedFilm | null>(null);

  const flatListRef  = useRef<FlatList>(null);
  const scrollY      = useRef(new Animated.Value(0)).current;
  const activeIdxRef = useRef(0);

  const { films, setFilms, loading, error, toggleLike, incrementViews } = useReelsFeed(feedKey);

  const filmsRef          = useRef(films);
  const incrementViewsRef = useRef(incrementViews);
  filmsRef.current          = films;
  incrementViewsRef.current = incrementViews;

  // ── applyActiveIndex ────────────────────────────────────────────────────────
  const applyActiveIndex = useCallback((next: number) => {
    if (next === activeIdxRef.current) return;
    activeIdxRef.current = next;
    setActiveIndex(next);
    const film = filmsRef.current[next];
    if (film) incrementViewsRef.current(film.id);
  }, []);

  const applyActiveIndexRef = useRef(applyActiveIndex);
  applyActiveIndexRef.current = applyActiveIndex;

  // ── Viewability ─────────────────────────────────────────────────────────────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems[0];
    if (first?.index != null) applyActiveIndexRef.current(first.index);
  }).current;

  // ── Handlers scroll ─────────────────────────────────────────────────────────
  // onScrollBeginDrag : rien à faire — la vidéo joue pendant le drag
  const onMomentumScrollEnd = useCallback((e: any) => {
    const snapped = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    applyActiveIndexRef.current(snapped);
  }, [ITEM_H]);

  // Safety : si pas de momentum (très rare avec pagingEnabled)
  const onScrollEndDrag = useCallback((e: any) => {
    setTimeout(() => {
      const snapped = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
      applyActiveIndexRef.current(snapped);
    }, 120);
  }, [ITEM_H]);

  // ── Auto-avance fin de vidéo ────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    const next = activeIdxRef.current + 1;
    if (next >= filmsRef.current.length) return;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
  }, []);

  // ── Scroll vers newReelId ───────────────────────────────────────────────────
  const scrolledToNew = useRef(false);
  useEffect(() => {
    if (!newReelId || scrolledToNew.current || !films.length) return;
    const idx = films.findIndex(f => f.id === newReelId);
    if (idx === -1) return;
    scrolledToNew.current = true;
    InteractionManager.runAfterInteractions(() => {
      flatListRef.current?.scrollToIndex({ index: idx, animated: true });
    });
  }, [newReelId, films]);
  useEffect(() => { scrolledToNew.current = false; }, [newReelId]);

  // ── Focus screen ────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  // ── Callbacks stables ───────────────────────────────────────────────────────
  const handleInfoPress = useCallback((film: FeedFilm) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInfoFilm(film);
  }, []);
  const handleInfoClose = useCallback(() => setInfoFilm(null), []);
  const handleProgress  = useCallback((_: VideoProgress) => {}, []);
  const handleFollowFriend = useCallback((fid: string) => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setFilms(prev => prev.map(film => ({
      ...film,
      liked_by_friends: (film.liked_by_friends ?? []).map(f =>
        f.id === fid ? { ...f, followed: true } : f,
      ),
    })));
  }, [setFilms]);

  // ── RENDER ITEM ─────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: FeedFilm; index: number }) => (
      <FeedItem
        film={item}
        isActive={index === activeIndex && screenFocused}
        isNear={Math.abs(index - activeIndex) <= 1}
        screenFocused={screenFocused}
        itemW={W}
        itemH={ITEM_H}
        insetBot={insets.bottom}
        onFollowFriend={handleFollowFriend}
        onLike={toggleLike}
        onInfoPress={handleInfoPress}
        onProgress={handleProgress}
        onEnd={handleEnd}
      />
    ),
    [
      activeIndex, screenFocused, W, ITEM_H, insets.bottom,
      handleFollowFriend, toggleLike, handleInfoPress, handleProgress, handleEnd,
    ],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: ITEM_H, offset: ITEM_H * index, index }),
    [ITEM_H],
  );

  const keyExtractor = useCallback((item: FeedFilm) => item.id, []);

  const onScrollToIndexFailed = useCallback(({ index }: { index: number }) => {
    flatListRef.current?.scrollToOffset({ offset: index * ITEM_H, animated: false });
    InteractionManager.runAfterInteractions(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    });
  }, [ITEM_H]);

  const onScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: false },
    ),
    [scrollY],
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" translucent />

      <FlatList
        ref={flatListRef}
        data={films}
        keyExtractor={keyExtractor}
        renderItem={renderItem}

        pagingEnabled
        decelerationRate="fast"

        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}

        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}

        onScroll={onScroll}
        scrollEventThrottle={16}

        // Performances — anti pages noires
        windowSize={7}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={30}
        initialNumToRender={3}
        removeClippedSubviews={false}   // CRITIQUE : false = aucun flash noir

        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
      />

      <SafeAreaView edges={['top']} style={s.headerSafe} pointerEvents="box-none">
        <TopHeader feedKey={feedKey} onMenuPress={() => setMenuOpen(true)} scrollY={scrollY} />
      </SafeAreaView>

      {!!error && <ErrorBanner message={error} />}

      <Modal
        visible={menuOpen} transparent animationType="none"
        statusBarTranslucent onRequestClose={() => setMenuOpen(false)}
      >
        <DropdownMenu visible={menuOpen} onClose={() => setMenuOpen(false)}
          onSelect={setFeedKey} activeKey={feedKey} />
      </Modal>

      <InfoSheet film={infoFilm} onClose={handleInfoClose} />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#03000A' },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
});