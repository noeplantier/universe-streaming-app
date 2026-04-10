import React, {
  useState, useRef, useCallback, useEffect, memo,
} from 'react';
import {
  View, StyleSheet, FlatList, Animated, Modal, Platform,
  Text, TouchableOpacity,
} from 'react-native';
import { StatusBar }                       from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions }             from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

// Composants reels
import FeedItem  from '@/components/reels/FeedItem';
import TopHeader from '@/components/reels/TopHeader';

// Data & types
import { MOCK_FEED }     from '@/components/reels/mockData';
import type { FeedFilm } from '@/components/reels/types';

// Sidebar
import DropdownMenu, { type MenuKey } from '@/components/DropDownMenu';

// Supabase
import { supabase } from '@/lib/supabase';

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

// ─────────────────────────────────────────────────────────────────────────────
// MAPPER Supabase → FeedFilm
// Adapte un enregistrement Supabase au format attendu par FeedItem.
// ─────────────────────────────────────────────────────────────────────────────
function mapReelToFeedFilm(reel: SupabaseReel): FeedFilm {
  return {
    id:          reel.id,
    title:       reel.title,
    director:    reel.director || 'Réalisateur inconnu',
    year:        reel.year    || String(new Date().getFullYear()),
    genre:       reel.genre   || 'Cinéma',
    synopsis:    reel.synopsis || '',
    video_url:   reel.video_url,
    poster_url:  '',                
    duration:    String(reel.duration),
    likes_count: reel.likes_count,
    views_count: reel.views_count,
    is_liked:    false,
    is_saved:    false,
    // Champ attendu par FeedItem — liste vide pour les reels uploadés
    liked_by_friends: [],
    tags:        ['#CinémaIndépendant', `#${reel.genre}`].filter(Boolean),
    created_at:  reel.created_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — Chargement + temps réel Supabase
// ─────────────────────────────────────────────────────────────────────────────
function useReelsFeed(feedKey: MenuKey) {
  const [films,   setFilms]   = useState<FeedFilm[]>(MOCK_FEED);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Chargement initial + refresh sur changement de feedKey
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

        // Filtrage selon l'onglet actif
        if (feedKey === 'following') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Films des utilisateurs suivis
            const { data: followingIds } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', user.id);

            const ids = followingIds?.map((f: { following_id: string }) => f.following_id) ?? [];
            if (ids.length > 0) {
              query = query.in('user_id', ids);
            }
          }
        }

        const { data, error: fetchError } = await query;

        if (cancelled) return;
        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          setFilms(data.map(mapReelToFeedFilm));
        } else {
          // Fallback MOCK si la table est vide
          setFilms(MOCK_FEED);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[ReelsFeed] Supabase error — fallback MOCK:', err);
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

  // Subscription temps réel — nouveau reel inséré → prepend
  useEffect(() => {
    const channel = supabase
      .channel('reels:realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reels' },
        (payload: { new: SupabaseReel }) => {
          const newFilm = mapReelToFeedFilm(payload.new);
          setFilms(prev => {
            // Éviter les doublons
            if (prev.some(f => f.id === newFilm.id)) return prev;
            return [newFilm, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Toggle like optimiste
  const toggleLike = useCallback((filmId: string) => {
    setFilms(prev =>
      prev.map(f => {
        if (f.id !== filmId) return f;
        const liked = !f.is_liked;
        // Fire-and-forget vers Supabase
        supabase
          .from('reels')
          .update({ likes_count: f.likes_count + (liked ? 1 : -1) })
          .eq('id', filmId)
          .then(({ error }) => {
            if (error) console.warn('[toggleLike]', error);
          });
        return {
          ...f,
          is_liked:    liked,
          likes_count: f.likes_count + (liked ? 1 : -1),
        };
      }),
    );
  }, []);

  // Incrément vues silencieux
  const incrementViews = useCallback((filmId: string) => {
    supabase.rpc('increment_views', { reel_id: filmId }).then(() => {});
  }, []);

  return { films, setFilms, loading, error, toggleLike, incrementViews };
}

// ─────────────────────────────────────────────────────────────────────────────
// BANNER D'ERREUR (facultatif)
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
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ newReelId?: string }>();

  const ITEM_H = H; // plein écran, notch inclus

  // ── État ──────────────────────────────────────────────────────────────────
  const [activeIndex,   setActiveIndex]   = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>('foryou');

  const scrollY        = useRef(new Animated.Value(0)).current;
  const flatListRef    = useRef<FlatList>(null);
  const activeIndexRef = useRef(0);

  // ── Feed data ─────────────────────────────────────────────────────────────
  const { films, setFilms, loading, error, toggleLike, incrementViews } =
    useReelsFeed(feedKey);

  // ── Scroll vers le nouveau reel après upload ──────────────────────────────
  // Quand create.tsx navigue avec newReelId, on attend que le film soit dans
  // le feed (via la subscription temps réel) puis on scrolle vers lui.
  const newReelId       = params.newReelId;
  const scrolledToNew   = useRef(false);

  useEffect(() => {
    if (!newReelId || scrolledToNew.current || films.length === 0) return;

    const idx = films.findIndex(f => f.id === newReelId);
    if (idx === -1) return; // pas encore arrivé via la subscription

    scrolledToNew.current = true;

    // Court délai pour laisser FlatList se rendre
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: idx, animated: true });
    }, 300);

    return () => clearTimeout(timer);
  }, [newReelId, films]);

  // ── Focus / blur de l'onglet ──────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  // ── Viewability ───────────────────────────────────────────────────────────
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      // votre logique pour gérer l'élément visible, par exemple :
      setActiveIndex(viewableItems[0].index);
    }
  }).current;


  // ── Follow friend ─────────────────────────────────────────────────────────
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

  // ── Render item ───────────────────────────────────────────────────────────
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
      />
    ),
    [activeIndex, screenFocused, W, ITEM_H, insets.bottom, handleFollowFriend, toggleLike],
  );

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_H, offset: ITEM_H * index, index,
  }), [ITEM_H]);

  const keyExtractor = useCallback((item: FeedFilm) => item.id, []);

  // scrollToIndex fallback si l'index est hors portée
  const onScrollToIndexFailed = useCallback(({ index }: { index: number }) => {
    flatListRef.current?.scrollToOffset({
      offset: index * ITEM_H,
      animated: true,
    });
  }, [ITEM_H]);

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

        // Snap TikTok
        pagingEnabled
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"

        // Viewability
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged}

        // Layout
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}

        // Header opacity
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}

        // Perf — window=5 : -2/-1/0/+1/+2 montés → transitions sans flash
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

      {/* ── Bannière erreur (si Supabase KO) ─────────────────────────────── */}
      {error && <ErrorBanner message={error} />}

      {/* ── Sidebar modal ────────────────────────────────────────────────── */}
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
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#03000A' },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
});