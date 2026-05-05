/**
 * app/(reels)/index.tsx — ReelsScreen v4.0
 *
 * ── CAUSES DES PAGES NOIRES (et fixes) ───────────────────────────────────────
 *
 *  ① removeClippedSubviews=true sur Android
 *     Détache les vues natives hors viewport → flash noir au retour.
 *     Fix : removeClippedSubviews={false} (désactivé partout).
 *
 *  ② windowSize=3 + maxToRenderPerBatch=1 trop agressif
 *     Les items ne sont pas rendus assez vite au scroll → page noire.
 *     Fix : windowSize=7, maxToRenderPerBatch=3, initialNumToRender=3.
 *
 *  ③ poster_url='' → Image avec uri vide → fond noir
 *     Fix dans FeedItem : fallback View backgroundColor si poster_url absent.
 *
 *  ④ pagingEnabled + snapToInterval conflictuels (déjà corrigé v3)
 *     Gardé : pagingEnabled seul, decelerationRate="fast".
 *
 * ── STALE CLOSURES (déjà corrigés v3, inchangés) ─────────────────────────────
 *   applyActiveIndex stable (deps vides), lit depuis filmsRef/incrementViewsRef.
 *   applyActiveIndexRef mis à jour chaque render.
 *   onViewableItemsChanged stable, délègue via applyActiveIndexRef.current.
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
// MAPPER — pur, stable
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
    poster_url:       '',             // BottomCard affiche les métas via Supabase
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
// HOOK — fetch + realtime + like optimiste + vues
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
        if (!cancelled) {
          console.warn('[ReelsFeed]', e);
          setFilms([]); setError('Impossible de charger le feed.');
        }
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

  // Like optimiste
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

  // Vues fire-and-forget
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
  const [screenFocused, setScreenFocused] = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>('foryou');
  const [infoFilm,      setInfoFilm]      = useState<FeedFilm | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const flatListRef  = useRef<FlatList>(null);
  const scrollY      = useRef(new Animated.Value(0)).current;
  const activeIdxRef = useRef(0);

  // ── Feed ───────────────────────────────────────────────────────────────────
  const { films, setFilms, loading, error, toggleLike, incrementViews } =
    useReelsFeed(feedKey);

  // Refs stables (évite deps en cascade dans applyActiveIndex)
  const filmsRef          = useRef(films);
  const incrementViewsRef = useRef(incrementViews);
  filmsRef.current          = films;
  incrementViewsRef.current = incrementViews;

  // ─────────────────────────────────────────────────────────────────────────
  // applyActiveIndex — stable, deps vides, lit depuis refs
  // ─────────────────────────────────────────────────────────────────────────
  const applyActiveIndex = useCallback((next: number) => {
    if (next === activeIdxRef.current) return;
    activeIdxRef.current = next;
    setActiveIndex(next);
    const film = filmsRef.current[next];
    if (film) incrementViewsRef.current(film.id);
  }, []); // intentionnellement vide

  // Toujours à jour pour les callbacks FlatList stables
  const applyActiveIndexRef = useRef(applyActiveIndex);
  applyActiveIndexRef.current = applyActiveIndex;

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWABILITY — 60 % visible = slide active
  // Callback stable → ne recrée jamais → FlatList ne se plaint pas
  // ─────────────────────────────────────────────────────────────────────────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems[0];
    if (first?.index != null) applyActiveIndexRef.current(first.index);
  }).current;

  // ─────────────────────────────────────────────────────────────────────────
  // MOMENTUM SCROLL END — confirmation après snap
  // ─────────────────────────────────────────────────────────────────────────
  const onMomentumScrollEnd = useCallback((e: any) => {
    const snapped = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    applyActiveIndexRef.current(snapped);
  }, [ITEM_H]);

  // ─────────────────────────────────────────────────────────────────────────
  // onEnd — auto-avance en fin de vidéo
  // ─────────────────────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    const next = activeIdxRef.current + 1;
    if (next >= filmsRef.current.length) return;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    // activeIndex sera mis à jour par onMomentumScrollEnd/onViewableItemsChanged
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Scroll vers newReelId (depuis StepPublish)
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
  // Focus screen
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
  const handleInfoClose = useCallback(() => setInfoFilm(null), []);
  const handleProgress  = useCallback((_: VideoProgress) => {}, []);
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
  //   isActive  : index === activeIndex (pas de screenFocused dans le calcul
  //               → FeedItem gère sa propre logique pause/play)
  //   isNear    : ±1 slide → précharge la source vidéo
  //   onEnd     : auto-avance au reel suivant
  // ─────────────────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: FeedFilm; index: number }) => (
      <FeedItem
        film={item}
        isActive={index === activeIndex}
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
        onMomentumScrollEnd={onMomentumScrollEnd}

        // ── Layout O(1) ───────────────────────────────────────────────────
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}

        // ── Tracking scroll (TopHeader) ───────────────────────────────────
        onScroll={onScroll}
        scrollEventThrottle={16}

        // ── PERFORMANCES — paramètres clés anti pages-noires ─────────────
        //
        //   windowSize={7}
        //     → 3 items au-dessus + actif + 3 en dessous pré-rendus.
        //     → Évite les frames non rendus au scroll rapide.
        //
        //   maxToRenderPerBatch={3}
        //     → 3 items rendus par frame JS (était 1 → trop lent).
        //
        //   initialNumToRender={3}
        //     → Démarre avec 3 items rendus (poster + vidéo 0 et 1 prêts).
        //
        //   removeClippedSubviews={false}  ← CRITIQUE
        //     → Sur Android, true détache les vues natives hors-écran →
        //       flash noir quand elles reviennent. false garde les vues
        //       attachées en permanence dans le window.
        //
        //   updateCellsBatchingPeriod={30} → batches plus fréquents.
        //
        windowSize={7}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={30}
        initialNumToRender={3}
        removeClippedSubviews={false}   // ← JAMAIS true pour un feed vidéo

        // ── Comportement ──────────────────────────────────────────────────
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