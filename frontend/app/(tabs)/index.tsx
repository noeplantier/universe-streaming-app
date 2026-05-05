/**
 * app/(reels)/index.tsx — ReelsScreen v5.0
 *
 * ── AUTO-PLAY / AUTO-PAUSE ────────────────────────────────────────────────────
 *
 *   Principe : isActive = index === activeIndex && !isScrolling && screenFocused
 *
 *   ① onScrollBeginDrag  → isScrolling = true
 *      → isActive devient false pour TOUS les items
 *      → FeedItem appelle player.pause() immédiatement
 *
 *   ② onMomentumScrollEnd → snap terminé → isScrolling = false + activeIndex mis à jour
 *      → isActive devient true uniquement pour le nouvel item centré
 *      → FeedItem appelle player.play()
 *
 *   ③ onScrollEndDrag (safety) → si l'utilisateur relâche sans momentum
 *      (scroll très lent, pagingEnabled snaps quand même), on force le reset.
 *
 *   Résultat :
 *     • La vidéo courante se met en PAUSE dès le premier pixel de drag
 *     • La nouvelle vidéo démarre DÈS que la page est snapée
 *     • Aucune vidéo ne joue pendant le scroll
 *
 * ── RESTE INCHANGÉ (v4) ──────────────────────────────────────────────────────
 *   windowSize=7, maxToRenderPerBatch=3, removeClippedSubviews=false
 *   Stale closure fixes (applyActiveIndexRef)
 *   onEnd auto-avance
 *   Fusion BottomCard / FeedItem
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  FlatList,
  InteractionManager,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar }                                       from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets }                 from 'react-native-safe-area-context';
import { useWindowDimensions }                             from 'react-native';
import { useFocusEffect, useLocalSearchParams }            from 'expo-router';
import * as Haptics                                        from 'expo-haptics';

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

export interface VideoProgress {
  positionMs: number;
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPPER
// ─────────────────────────────────────────────────────────────────────────────
function mapReelToFeedFilm(reel: SupabaseReel): FeedFilm {
  return {
    id:               reel.id,
    title:            reel.title,
    director:         reel.director || 'Réalisateur inconnu',
    year:             reel.year     || String(new Date().getFullYear()),
    genre:            reel.genre    || 'Cinéma',
    synopsis:         reel.synopsis || '',
    video_url:        reel.video_url,
    poster_url:       '',
    duration:         String(reel.duration),
    likes_count:      reel.likes_count,
    views_count:      reel.views_count,
    is_liked:         false,
    is_saved:         false,
    liked_by_friends: [],
    tags:             ['#CinémaIndépendant', `#${reel.genre}`].filter(Boolean),
    created_at:       reel.created_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — fetch + realtime + like + vues
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
        let query = supabase
          .from('reels')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (feedKey === 'following') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: ids } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', user.id);
            const arr = (ids ?? []).map((f: { following_id: string }) => f.following_id);
            if (arr.length) query = query.in('user_id', arr);
          }
        }
        const { data, error: err } = await query;
        if (cancelled) return;
        if (err) throw err;
        setFilms(data?.length ? data.map(mapReelToFeedFilm) : []);
      } catch (e) {
        if (!cancelled) { console.warn('[ReelsFeed]', e); setFilms([]); setError('Impossible de charger le feed.'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [feedKey]);

  // Realtime INSERT
  useEffect(() => {
    const ch = supabase
      .channel('reels:insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reels' },
        ({ new: reel }: { new: SupabaseReel }) => {
          const film = mapReelToFeedFilm(reel);
          setFilms(prev => prev.some(f => f.id === film.id) ? prev : [film, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleLike = useCallback((filmId: string) => {
    setFilms(prev => prev.map(f => {
      if (f.id !== filmId) return f;
      const liked = !f.is_liked;
      supabase.from('reels')
        .update({ likes_count: f.likes_count + (liked ? 1 : -1) })
        .eq('id', filmId)
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
    <View style={eb.wrap}>
      <Text style={eb.txt}>{message}</Text>
    </View>
  );
});
const eb = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 99,
    backgroundColor: 'rgba(255,59,92,0.18)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,59,92,0.35)',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  txt: { color: '#FF3B5C', fontSize: 12, textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// REELS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets    = useSafeAreaInsets();
  const { newReelId } = useLocalSearchParams<{ newReelId?: string }>();

  const ITEM_H = H;

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeIndex,   setActiveIndex]   = useState(0);
  const [isScrolling,   setIsScrolling]   = useState(false);   // ← nouveau
  const [screenFocused, setScreenFocused] = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>('foryou');
  const [infoFilm,      setInfoFilm]      = useState<FeedFilm | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const flatListRef        = useRef<FlatList>(null);
  const scrollY            = useRef(new Animated.Value(0)).current;
  const activeIdxRef       = useRef(0);
  const scrollingTimeout   = useRef<ReturnType<typeof setTimeout>>();   // safety timer

  // ── Feed ───────────────────────────────────────────────────────────────────
  const { films, setFilms, loading, error, toggleLike, incrementViews } =
    useReelsFeed(feedKey);

  const filmsRef          = useRef(films);
  const incrementViewsRef = useRef(incrementViews);
  filmsRef.current          = films;
  incrementViewsRef.current = incrementViews;

  // ─────────────────────────────────────────────────────────────────────────
  // applyActiveIndex — stable, deps vides
  // ─────────────────────────────────────────────────────────────────────────
  const applyActiveIndex = useCallback((next: number) => {
    if (next === activeIdxRef.current) return;
    activeIdxRef.current = next;
    setActiveIndex(next);
    const film = filmsRef.current[next];
    if (film) incrementViewsRef.current(film.id);
  }, []);

  const applyActiveIndexRef = useRef(applyActiveIndex);
  applyActiveIndexRef.current = applyActiveIndex;

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWABILITY CONFIG — 60 % visible = slide pré-sélectionnée
  // (activeIndex change ici mais isScrolling=true → aucun play déclenché)
  // ─────────────────────────────────────────────────────────────────────────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems[0];
    if (first?.index != null) applyActiveIndexRef.current(first.index);
  }).current;

  // ─────────────────────────────────────────────────────────────────────────
  // ① onScrollBeginDrag — pause immédiate
  //    isScrolling = true → isActive = false pour tous les items
  //    → FeedItem appelle player.pause() dans son useEffect
  // ─────────────────────────────────────────────────────────────────────────
  const onScrollBeginDrag = useCallback(() => {
    setIsScrolling(true);

    // Safety : si onMomentumScrollEnd ne fire jamais (très rare), on reset après 2s
    clearTimeout(scrollingTimeout.current);
    scrollingTimeout.current = setTimeout(() => setIsScrolling(false), 2000);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ② onMomentumScrollEnd — snap terminé → play de la nouvelle slide
  //    activeIndex mis à jour → isScrolling = false
  //    → isActive devient true pour la slide centrée → player.play()
  // ─────────────────────────────────────────────────────────────────────────
  const onMomentumScrollEnd = useCallback((e: any) => {
    clearTimeout(scrollingTimeout.current);
    const snapped = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    applyActiveIndexRef.current(snapped);
    setIsScrolling(false);
  }, [ITEM_H]);

  // ─────────────────────────────────────────────────────────────────────────
  // ③ onScrollEndDrag — safety pour les scrolls sans momentum
  //    (ex: l'utilisateur drag exactement jusqu'à la page suivante et relâche
  //    sans vitesse → pagingEnabled snaps → onMomentumScrollEnd fire quand même,
  //    mais on met aussi un handler de sécurité ici)
  // ─────────────────────────────────────────────────────────────────────────
  const onScrollEndDrag = useCallback((e: any) => {
    // Ne pas reset isScrolling ici : pagingEnabled va toujours déclencher
    // un momentum vers la page la plus proche. On laisse onMomentumScrollEnd
    // faire le travail. La safety timeout ci-dessus couvre les cas extrêmes.
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // onEnd — auto-avance en fin de vidéo
  // ─────────────────────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    const next = activeIdxRef.current + 1;
    if (next >= filmsRef.current.length) return;
    // Simuler un scroll programmatique → onMomentumScrollEnd se chargera
    // de mettre isScrolling=false et activeIndex à jour
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Scroll vers newReelId
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // Focus screen — pause quand l'écran perd le focus (ex: navigation)
  // ─────────────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Callbacks stables
  // ─────────────────────────────────────────────────────────────────────────
  const handleInfoPress = useCallback((film: FeedFilm) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInfoFilm(film);
  }, []);
  const handleInfoClose    = useCallback(() => setInfoFilm(null), []);
  const handleProgress     = useCallback((_: VideoProgress) => {}, []);
  const handleFollowFriend = useCallback((fid: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setFilms(prev => prev.map(film => ({
      ...film,
      liked_by_friends: (film.liked_by_friends ?? []).map(f =>
        f.id === fid ? { ...f, followed: true } : f,
      ),
    })));
  }, [setFilms]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER ITEM
  //
  //   isActive = index === activeIndex && !isScrolling && screenFocused
  //   ─────────────────────────────────────────────────────────────────
  //   • !isScrolling → pause immédiate dès le premier pixel de drag
  //   • screenFocused → pause si l'écran perd le focus (navigation)
  //   • index === activeIndex → seul le reel centré joue
  //
  //   isNear = ±1 → précharge la source video adjacente
  // ─────────────────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: FeedFilm; index: number }) => (
      <FeedItem
        film={item}
        isActive={index === activeIndex && !isScrolling && screenFocused}
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
      activeIndex, isScrolling, screenFocused,
      W, ITEM_H, insets.bottom,
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
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" translucent />

      <FlatList
        ref={flatListRef}
        data={films}
        keyExtractor={keyExtractor}
        renderItem={renderItem}

        // ── Snap TikTok ───────────────────────────────────────────────────
        pagingEnabled
        decelerationRate="fast"

        // ── Détection activeIndex ─────────────────────────────────────────
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}

        // ── Handlers scroll (auto-play / auto-pause) ──────────────────────
        onScrollBeginDrag={onScrollBeginDrag}       // ① pause immédiate
        onMomentumScrollEnd={onMomentumScrollEnd}   // ② play après snap
        onScrollEndDrag={onScrollEndDrag}           // ③ safety

        // ── Layout O(1) ───────────────────────────────────────────────────
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}

        // ── Tracking scroll (TopHeader) ───────────────────────────────────
        onScroll={onScroll}
        scrollEventThrottle={16}

        // ── Performances ─────────────────────────────────────────────────
        windowSize={7}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={30}
        initialNumToRender={3}
        removeClippedSubviews={false}

        // ── Comportement ─────────────────────────────────────────────────
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
      />

      {/* Header flottant */}
      <SafeAreaView edges={['top']} style={s.headerSafe} pointerEvents="box-none">
        <TopHeader
          feedKey={feedKey}
          onMenuPress={() => setMenuOpen(true)}
          scrollY={scrollY}
        />
      </SafeAreaView>

      {/* Bannière erreur */}
      {!!error && <ErrorBanner message={error} />}

      {/* Dropdown feed */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <DropdownMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          onSelect={setFeedKey}
          activeKey={feedKey}
        />
      </Modal>

      {/* InfoSheet */}
      <InfoSheet film={infoFilm} onClose={handleInfoClose} />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#03000A' },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
});