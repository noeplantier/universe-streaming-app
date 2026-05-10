import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  InteractionManager,
  StyleSheet,
  View,
  useWindowDimensions,
  Platform,
  Text,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import FeedItem from '../../components/reels/FeedItem';
import { supabase } from '../../lib/supabase';
import { FeedFilm } from '../../lib/supabaseReels';
import type { Reel } from '../../lib/supabaseReels';

// ─────────────────────────────────────────────────────────────────────────────
// Mapper Supabase → FeedFilm
// ─────────────────────────────────────────────────────────────────────────────
function mapReel(r: Reel): FeedFilm {
  return {
    id:          r.id,
    video_url:   r.video_url,
    poster_url:  `https://picsum.photos/seed/reel_${r.id}/400/700`,
    title:       r.title    ?? 'Sans titre',
    genre:       r.genre    ?? 'Cinéma',
    director:    r.director ?? '',
    year:        r.year     ?? '',
    synopsis:    r.synopsis ?? '',
    duration:    Number(r.duration ?? 0),
    likes_count: r.likes_count ?? 0,
    views_count: r.views_count ?? 0,
    created_at:  r.created_at,
    is_liked:    false,
    is_saved:    false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Data Feed
// ─────────────────────────────────────────────────────────────────────────────
function useReels() {
  const [films,   setFilms]   = useState<FeedFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('reels')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      if (data) setFilms(data.map(mapReel));
    } catch (e: any) {
      console.warn('[useReels] fetch error:', e);
      setError(e.message || 'Erreur lors du chargement des vidéos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime — nouveau reel publié
  useEffect(() => {
    const ch = supabase.channel('reels:new')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reels' },
        ({ new: r }) => {
          setFilms(prev => {
            const film = mapReel(r as Reel);
            return prev.some(f => f.id === film.id) ? prev : [film, ...prev];
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleLike = useCallback((id: string) => {
    setFilms(prev => prev.map(f => {
      if (f.id !== id) return f;
      const liked = !f.is_liked;
      // Sync DB fire-and-forget
      supabase.from('reels')
        .update({ likes_count: f.likes_count + (liked ? 1 : -1) })
        .eq('id', id)
        .then(({ error }) => { if (error) console.warn('[like]', error.message); });
      return { ...f, is_liked: liked, likes_count: f.likes_count + (liked ? 1 : -1) };
    }));
  }, []);

  return { films, loading, error, toggleLike, refresh: load };
}

// ─────────────────────────────────────────────────────────────────────────────
// ReelsScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { newReelId } = useLocalSearchParams<{ newReelId?: string }>();

  const ITEM_H = Platform.OS === 'android' ? H + insets.top : H;

  const [activeIndex,   setActiveIndex]   = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);

  const flatRef      = useRef<FlatList>(null);
  const scrollY      = useRef(new Animated.Value(0)).current;
  const activeIdxRef = useRef(0);

  const { films, loading, error, toggleLike } = useReels();
  const filmsRef = useRef(films);
  filmsRef.current = films;

  // ── Commit activeIndex ────────────────────────────────────────────────────
  const commit = useCallback((next: number) => {
    if (next === activeIdxRef.current) return;
    activeIdxRef.current = next;
    setActiveIndex(next);

    // ── Incrément de vues : UPDATE direct (pas de RPC) ───────────────────
    // La fonction public.increment_view_count n'existe pas dans la BDD.
    // On utilise un UPDATE direct sur views_count — acceptable pour un compteur de vues.
    const film = filmsRef.current[next];
    if (film?.id) {
      supabase
        .from('reels')
        .update({ views_count: (film.views_count ?? 0) + 1 })
        .eq('id', film.id)
        .then(({ error }) => {
          if (error) console.warn('[views] update:', error.message);
        });
    }
  }, []);

  const commitRef = useRef(commit);
  commitRef.current = commit;

  // ── Source de vérité du scroll ────────────────────────────────────────────
  const handleActiveScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (e: any) => {
        const offsetY = e.nativeEvent.contentOffset.y;
        const newIndex = Math.max(
          0,
          Math.min(Math.round(offsetY / ITEM_H), filmsRef.current.length - 1),
        );
        commitRef.current(newIndex);
      },
    },
  ), [scrollY, ITEM_H]);

  // Scroll vers newReelId (ex : après publication)
  const didScrollNew = useRef(false);
  useEffect(() => {
    if (!newReelId || didScrollNew.current || !films.length) return;
    const idx = films.findIndex(f => f.id === newReelId);
    if (idx < 0) return;
    didScrollNew.current = true;
    InteractionManager.runAfterInteractions(() => {
      flatRef.current?.scrollToIndex({ index: idx, animated: true });
    });
  }, [newReelId, films]);
  useEffect(() => { didScrollNew.current = false; }, [newReelId]);

  // Pause/reprise sur changement d'écran
  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    return () => setScreenFocused(false);
  }, []));

  const getItemLayout = useCallback(
    (_: any, i: number) => ({ length: ITEM_H, offset: ITEM_H * i, index: i }),
    [ITEM_H],
  );

  const keyExtractor = useCallback((item: FeedFilm) => item.id, []);

  const renderItem = useCallback(({ item, index }: { item: FeedFilm; index: number }) => (
    <FeedItem
      key={item.id}
      film={item}
      isActive={index === activeIndex && screenFocused}
      isNear={Math.abs(index - activeIndex) <= 1}
      itemW={W}
      itemH={ITEM_H}
      insetBot={insets.bottom}
      onLike={toggleLike}
    />
  ), [activeIndex, screenFocused, W, ITEM_H, insets.bottom, toggleLike]);

  if (loading && !films.length) {
    return (
      <View style={s.root}>
        <View style={s.loadingWrap}>
          <Text style={s.loadingTxt}>Chargement des épisodes…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" translucent />

      <FlatList
        ref={flatRef}
        data={films}

        // ★ FIX CRITIQUE ★
        // Sans extraData, FlatList ne re-rend PAS les cellules existantes
        // quand activeIndex change → isActive reste false → vidéo ne joue pas.
        // Avec extraData, FlatList sait qu'il doit mettre à jour toutes
        // les cellules visibles quand activeIndex ou screenFocused changent.
        extraData={`${activeIndex}-${screenFocused}`}

        keyExtractor={keyExtractor}
        renderItem={renderItem}
        pagingEnabled
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onScroll={handleActiveScroll}
        scrollEventThrottle={16}

        // ── Performances vidéo ─────────────────────────────────────────────
        // windowSize=9 : ±4 items toujours montés → aucun player détruit
        // removeClippedSubviews=false : critique pour VideoView natif Android
        windowSize={9}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={50}
        initialNumToRender={3}
        removeClippedSubviews={false}

        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
      />

      {!!error && (
        <View style={s.errBanner} pointerEvents="none">
          <Text style={s.errTxt}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#07000F' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingTxt:  { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  errBanner:   {
    position: 'absolute', bottom: 80, left: 20, right: 20,
    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errTxt: { color: '#EF4444', fontSize: 12, textAlign: 'center' },
});