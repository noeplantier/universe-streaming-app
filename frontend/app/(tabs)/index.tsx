/**
 * app/(reels)/index.tsx — ReelsScreen
 *
 * Auto-play TikTok-like :
 *  - Double détection activeIndex :
 *      1. onViewableItemsChanged (seuil 75 %) → mise à jour continue pendant le drag
 *      2. onMomentumScrollEnd   → confirmation pixel-perfect au snap final
 *  - isActive passe true → FeedItem joue depuis le début
 *  - isActive passe false → FeedItem stoppe et reset (géré via isActive dans FeedItem)
 *  - isNear précharge ±1 slide pour un démarrage instantané
 *  - Toutes les refs sont stables → zéro re-render parasite
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
import { StatusBar }                                      from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets }                from 'react-native-safe-area-context';
import { useWindowDimensions }                            from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
// MAPPER Supabase → FeedFilm (pur, zéro allocation répétée)
// ─────────────────────────────────────────────────────────────────────────────
function mapReelToFeedFilm(reel: SupabaseReel): FeedFilm {
  return {
    id:               reel.id,
    title:            reel.title,
    director:         reel.director  || 'Réalisateur inconnu',
    year:             reel.year      || String(new Date().getFullYear()),
    genre:            reel.genre     || 'Cinéma',
    synopsis:         reel.synopsis  || '',
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
// HOOK — chargement + realtime + actions optimistes
// ─────────────────────────────────────────────────────────────────────────────
function useReelsFeed(feedKey: MenuKey) {
  const [films,   setFilms]   = useState<FeedFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── Fetch initial ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadFeed() {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('reels')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (feedKey === 'following') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: followingIds } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', user.id);

            const ids = (followingIds ?? []).map(
              (f: { following_id: string }) => f.following_id,
            );
            if (ids.length > 0) query = query.in('user_id', ids);
          }
        }

        const { data, error: fetchError } = await query;
        if (cancelled) return;
        if (fetchError) throw fetchError;

        setFilms(data?.length ? data.map(mapReelToFeedFilm) : []);
      } catch (err) {
        if (!cancelled) {
          console.warn('[ReelsFeed] fetch error:', err);
          setFilms([]);
          setError('Impossible de charger le feed.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFeed();
    return () => { cancelled = true; };
  }, [feedKey]);

  // ── Realtime INSERT — nouveau reel publié (ex. StepPublish) ───────────────
  useEffect(() => {
    const ch = supabase
      .channel('reels:insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reels' },
        ({ new: reel }: { new: SupabaseReel }) => {
          const film = mapReelToFeedFilm(reel);
          // Guard : évite les doublons si le fetch initial était encore en cours
          setFilms(prev =>
            prev.some(f => f.id === film.id) ? prev : [film, ...prev],
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Like optimiste + sync DB ───────────────────────────────────────────────
  const toggleLike = useCallback((filmId: string) => {
    setFilms(prev =>
      prev.map(f => {
        if (f.id !== filmId) return f;
        const liked = !f.is_liked;
        // Fire-and-forget — la UI est déjà à jour
        supabase
          .from('reels')
          .update({ likes_count: f.likes_count + (liked ? 1 : -1) })
          .eq('id', filmId)
          .then(({ error }) => { if (error) console.warn('[like sync]', error); });
        return { ...f, is_liked: liked, likes_count: f.likes_count + (liked ? 1 : -1) };
      }),
    );
  }, []);

  // ── Vues fire-and-forget ───────────────────────────────────────────────────
  const incrementViews = useCallback((filmId: string) => {
    supabase.rpc('increment_views', { reel_id: filmId }).then(() => {});
  }, []);

  return { films, setFilms, loading, error, toggleLike, incrementViews };
}

// ─────────────────────────────────────────────────────────────────────────────
// BANNIÈRE ERREUR
// ─────────────────────────────────────────────────────────────────────────────
const ErrorBanner = memo(function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={eb.wrap}>
      <Text style={eb.txt}>{message}</Text>
    </View>
  );
});
ErrorBanner.displayName = 'ErrorBanner';

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
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets      = useSafeAreaInsets();
  const router      = useRouter();
  const { newReelId } = useLocalSearchParams<{ newReelId?: string }>();

  const ITEM_H = H; // plein écran, pas de safe-area offset

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeIndex,   setActiveIndex]   = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>('foryou');
  const [infoFilm,      setInfoFilm]      = useState<FeedFilm | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const flatListRef  = useRef<FlatList>(null);
  const scrollY      = useRef(new Animated.Value(0)).current;
  // Ref miroir de activeIndex — lisible dans les callbacks sans dépendance stale
  const activeIdxRef = useRef(0);

  // ── Feed ───────────────────────────────────────────────────────────────────
  const { films, setFilms, loading, error, toggleLike, incrementViews } =
    useReelsFeed(feedKey);

  // ─────────────────────────────────────────────────────────────────────────
  // MISE À JOUR ACTIVE INDEX
  // Fonction partagée entre viewability et momentumScrollEnd.
  // Utilise activeIdxRef pour éviter les stale closures dans les callbacks.
  // ─────────────────────────────────────────────────────────────────────────
  const applyActiveIndex = useCallback((next: number) => {
    if (next === activeIdxRef.current) return;
    activeIdxRef.current = next;
    setActiveIndex(next);
    // Incrément de vue au moment du "focus" réel sur la slide
    if (films[next]) incrementViews(films[next].id);
  }, [films, incrementViews]);

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWABILITY — seuil 75 % pour que le reel soit considéré "actif"
  // Déclenché pendant le drag → mise à jour continue (pas seulement au snap).
  // ─────────────────────────────────────────────────────────────────────────
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 75,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems[0];
    if (first?.index != null) applyActiveIndex(first.index);
  }).current;

  // ─────────────────────────────────────────────────────────────────────────
  // MOMENTUM SCROLL END — confirmation pixel-perfect après le snap
  // C'est le signal définitif : la FlatList s'est immobilisée.
  // ─────────────────────────────────────────────────────────────────────────
  const onMomentumScrollEnd = useCallback((e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const snapped = Math.round(offsetY / ITEM_H);
    applyActiveIndex(snapped);
  }, [ITEM_H, applyActiveIndex]);

  // ─────────────────────────────────────────────────────────────────────────
  // SCROLL PROGRAMMATIQUE vers un newReelId transmis par StepPublish
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
  // FOCUS SCREEN — pause globale quand l'écran perd le focus
  // ─────────────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // CALLBACKS STABLES
  // ─────────────────────────────────────────────────────────────────────────
  const handleInfoPress = useCallback((film: FeedFilm) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInfoFilm(film);
  }, []);

  const handleInfoClose = useCallback(() => setInfoFilm(null), []);

  // onProgress géré localement par FeedItem — pas de state global nécessaire
  const handleProgress = useCallback((_: VideoProgress) => {}, []);

  const handleFollowFriend = useCallback((fid: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setFilms(prev =>
      prev.map(film => ({
        ...film,
        liked_by_friends: film.liked_by_friends.map(f =>
          f.id === fid ? { ...f, followed: true } : f,
        ),
      })),
    );
  }, [setFilms]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER ITEM
  //
  // isActive  = true  → FeedItem joue la vidéo depuis le début (ou reprend)
  // isActive  = false → FeedItem stoppe + reset à t=0
  // isNear    = true  → FeedItem précharge la vidéo (±1 slide)
  //
  // La combinaison pagingEnabled + onMomentumScrollEnd garantit que
  // isActive ne devient true qu'une fois le snap terminé, évitant
  // les lectures parasites pendant le drag.
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
      />
    ),
    [
      activeIndex, screenFocused, W, ITEM_H, insets.bottom,
      handleFollowFriend, toggleLike, handleInfoPress, handleProgress,
    ],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: ITEM_H, offset: ITEM_H * index, index }),
    [ITEM_H],
  );

  const keyExtractor = useCallback((item: FeedFilm) => item.id, []);

  // Récupération sur échec de scrollToIndex (ex. item pas encore rendu)
  const onScrollToIndexFailed = useCallback(
    ({ index }: { index: number }) => {
      // Scroll offset direct, puis retry après un frame
      flatListRef.current?.scrollToOffset({ offset: index * ITEM_H, animated: false });
      InteractionManager.runAfterInteractions(() => {
        flatListRef.current?.scrollToIndex({ index, animated: true });
      });
    },
    [ITEM_H],
  );

  // scrollY pour TopHeader (opacité, etc.)
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

      {/* ── Feed plein écran ─────────────────────────────────────────────── */}
      <FlatList
        ref={flatListRef}
        data={films}
        keyExtractor={keyExtractor}
        renderItem={renderItem}

        // ── Snap TikTok ──────────────────────────────────────────────────
        pagingEnabled
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"

        // ── Double détection activeIndex ─────────────────────────────────
        // viewability → mise à jour continue pendant le drag
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        // momentumScrollEnd → confirmation au pixel après snap
        onMomentumScrollEnd={onMomentumScrollEnd}

        // ── Layout O(1) ──────────────────────────────────────────────────
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}

        // ── Scroll tracking pour TopHeader ───────────────────────────────
        onScroll={onScroll}
        scrollEventThrottle={16}

        // ── Performances ─────────────────────────────────────────────────
        // windowSize 5 = actif ± 2 slides rendus, le reste est démonté
        // → évite l'accumulation de décodeurs vidéo en mémoire
        windowSize={5}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        initialNumToRender={2}
        removeClippedSubviews={Platform.OS === 'android'}

        // ── Comportement ─────────────────────────────────────────────────
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
      />

      {/* ── Header flottant ──────────────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={s.headerSafe} pointerEvents="box-none">
        <TopHeader
          feedKey={feedKey}
          onMenuPress={() => setMenuOpen(true)}
          scrollY={scrollY}
        />
      </SafeAreaView>

      {/* ── Bannière erreur ──────────────────────────────────────────────── */}
      {error && <ErrorBanner message={error} />}

      {/* ── Sidebar feed ─────────────────────────────────────────────────── */}
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

      {/* ── InfoSheet ────────────────────────────────────────────────────── */}
      <InfoSheet film={infoFilm} onClose={handleInfoClose} />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#03000A' },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
});