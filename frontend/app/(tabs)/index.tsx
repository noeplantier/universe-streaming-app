
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
import { StatusBar }                       from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions }             from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import FeedItem      from '@/components/reels/FeedItem';
import TopHeader     from '@/components/reels/TopHeader';
import InfoSheet     from '@/components/reels/Infosheet';
import DropdownMenu, { type MenuKey } from '@/components/DropDownMenu';

import { MOCK_FEED }     from '@/components/reels/mockData';
import type { FeedFilm } from '@/components/reels/types';

import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 TYPES
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
// 🗺️ MAPPER Supabase → FeedFilm
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
// 📡 HOOK — chargement + realtime Supabase
// ─────────────────────────────────────────────────────────────────────────────
function useReelsFeed(feedKey: MenuKey) {
  const [films,   setFilms]   = useState<FeedFilm[]>(MOCK_FEED);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

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
        setFilms(data?.length ? data.map(mapReelToFeedFilm) : MOCK_FEED);
      } catch (err) {
        if (!cancelled) {
          console.warn('[ReelsFeed] fallback MOCK:', err);
          setFilms(MOCK_FEED);
          setError('Impossible de charger le feed. Affichage local.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFeed();
    return () => { cancelled = true; };
  }, [feedKey]);

  // Realtime — channel singleton par session
  useEffect(() => {
    const ch = supabase
      .channel('reels:insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reels' },
        ({ new: reel }: { new: SupabaseReel }) => {
          const film = mapReelToFeedFilm(reel);
          setFilms(prev =>
            prev.some(f => f.id === film.id) ? prev : [film, ...prev],
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Like optimiste + sync DB
  const toggleLike = useCallback((filmId: string) => {
    setFilms(prev =>
      prev.map(f => {
        if (f.id !== filmId) return f;
        const liked = !f.is_liked;
        supabase
          .from('reels')
          .update({ likes_count: f.likes_count + (liked ? 1 : -1) })
          .eq('id', filmId)
          .then(({ error }) => { if (error) console.warn('[like]', error); });
        return { ...f, is_liked: liked, likes_count: f.likes_count + (liked ? 1 : -1) };
      }),
    );
  }, []);

  // Incrément vues fire-and-forget
  const incrementViews = useCallback((filmId: string) => {
    supabase.rpc('increment_views', { reel_id: filmId }).then(() => {});
  }, []);

  return { films, setFilms, loading, error, toggleLike, incrementViews };
}


const pb = StyleSheet.create({
  track: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow:        'visible',
    zIndex:          60,
  },
  fill: {
    height:          '100%',
    backgroundColor: '#FFFFFF',
    borderRadius:    1,
  },
  thumb: {
    position:        'absolute',
    top:             -3,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#FFFFFF',
    marginLeft:      -4,
    ...Platform.select({
      ios: {
        shadowColor:   '#fff',
        shadowOpacity: 0.9,
        shadowRadius:  4,
        shadowOffset:  { width: 0, height: 0 },
      },
    }),
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ BANNIÈRE ERREUR
// ─────────────────────────────────────────────────────────────────────────────
const ErrorBanner = memo(({ message }: { message: string }) => (
  <View style={eb.wrap}>
    <Text style={eb.txt}>{message}</Text>
  </View>
));
ErrorBanner.displayName = 'ErrorBanner';

const eb = StyleSheet.create({
  wrap: {
    position:        'absolute', bottom: 100, left: 20, right: 20, zIndex: 99,
    backgroundColor: 'rgba(255,59,92,0.18)', borderRadius: 12,
    borderWidth:      1, borderColor: 'rgba(255,59,92,0.35)',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  txt: { color: '#FF3B5C', fontSize: 12, textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const params  = useLocalSearchParams<{ newReelId?: string }>();

  const ITEM_H = H;

  // ── État ──────────────────────────────────────────────────────────────────
  const [activeIndex,   setActiveIndex]   = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>('foryou');
  const [infoFilm,      setInfoFilm]      = useState<FeedFilm | null>(null);

  const scrollY     = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  // Animated.Value pour la barre de progression (0 → 1, native driver)
  const videoProgress = useRef(new Animated.Value(0)).current;

  // ── Feed ──────────────────────────────────────────────────────────────────
  const { films, setFilms, loading, error, toggleLike, incrementViews } =
    useReelsFeed(feedKey);

  // ── Reset barre quand on change d'item ────────────────────────────────────
  useEffect(() => {
    videoProgress.setValue(0);
  }, [activeIndex]);

  // ── Callback progression vidéo (remontée depuis FeedItem) ─────────────────
  // FeedItem doit appeler onProgress({ positionMs, durationMs })
  // depuis son onPlaybackStatusUpdate
  const handleProgress = useCallback(
    ({ positionMs, durationMs }: VideoProgress) => {
      if (durationMs <= 0) return;
      const ratio = Math.min(positionMs / durationMs, 1);
      // setNativeProps-style via Animated : 0 setState, 0 re-render
      videoProgress.setValue(ratio);
    },
    [videoProgress],
  );

  // ── Callback info ──────────────────────────────────────────────────────────
  const handleInfoPress = useCallback(
    (film: FeedFilm) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setInfoFilm(film);
    },
    [],
  );
  const handleInfoClose = useCallback(() => setInfoFilm(null), []);

  // ── Scroll vers nouveau reel post-upload ──────────────────────────────────
  const newReelId     = params.newReelId;
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

  // ── Focus ─────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  // ── Viewability — ref stable, jamais recréée ──────────────────────────────
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: any) => {
      const first = viewableItems[0];
      if (first?.index != null) setActiveIndex(first.index);
    },
  ).current;

  // ── Follow friend ─────────────────────────────────────────────────────────
  const handleFollowFriend = useCallback(
    (fid: string) => {
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
    },
    [setFilms],
  );

  // ── Render item — aucune closure inline ───────────────────────────────────
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

  const onScrollToIndexFailed = useCallback(
    ({ index }: { index: number }) => {
      flatListRef.current?.scrollToOffset({ offset: index * ITEM_H, animated: true });
    },
    [ITEM_H],
  );

  const onScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false },
      ),
    [scrollY],
  );

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

        pagingEnabled
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"

        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}

        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onScroll={onScroll}
        scrollEventThrottle={16}

        // windowSize=5 → -2/-1/active/+1/+2 montés simultanément
        windowSize={5}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        initialNumToRender={2}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
      />

     

      {/* ── Header flottant ───────────────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={s.headerSafe} pointerEvents="box-none">
        <TopHeader
          feedKey={feedKey}
          onMenuPress={() => setMenuOpen(true)}
          scrollY={scrollY}
        />
      </SafeAreaView>

      {/* ── Bannière erreur ───────────────────────────────────────────────── */}
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

      {/* ── InfoSheet ─────────────────────────────────────────────────────── */}
      <InfoSheet film={infoFilm} onClose={handleInfoClose} />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#03000A' },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
});