/**
 * app/(reels)/index.tsx
 *
 * ─── CORRECTIF PRINCIPAL ─────────────────────────────────────────────────────
 *
 *  SYMPTÔME  : seule la 1ère vidéo se lit. Les suivantes restent noires.
 *
 *  CAUSE     : extraData manquant dans FlatList.
 *
 *              FlatList optimise le rendu : il ne re-rend PAS une cellule
 *              existante si son `item` dans `data` n'a pas changé — même si
 *              `renderItem` a un nouveau closure avec un `activeIndex` différent.
 *
 *              Résultat : isActive reste false pour les vidéos 2, 3, 4...
 *              → player.play() n'est JAMAIS appelé → écran noir.
 *
 *  FIX       : extraData={activeIndex}
 *              Indique à FlatList : "force le re-rendu de toutes les cellules
 *              visibles quand activeIndex change."
 *              → isActive se met à jour → player.play() s'exécute. ✓
 *
 *  FIX 2     : onViewableItemsChanged en SOURCE DE VÉRITÉ (80% visible)
 *              Plus fiable que onMomentumScrollEnd car déclenché dès que
 *              la vidéo est réellement visible, pas seulement à la fin du snap.
 *              onMomentumScrollEnd reste en safety net Android.
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
  useWindowDimensions,
} from 'react-native';
import { StatusBar }                            from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets }      from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics                             from 'expo-haptics';

import FeedItem      from '@/components/reels/FeedItem';
import TopHeader     from '@/components/reels/TopHeader';
import InfoSheet     from '@/components/reels/Infosheet';
import DropdownMenu, { type MenuKey } from '@/components/DropDownMenu';
import { supabase }      from '@/lib/supabase';
import type { FeedFilm } from '@/components/reels/types';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://knrzbdqfflobfjdmqyte.supabase.co';
const VIDEO_BUCKET = 'community-images'; // ← nom de ton bucket Supabase Storage

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SupabaseReel {
  id:          string;
  created_at:  string;
  user_id:     string;
  video_url:   string;
  title:       string | null;
  genre:       string | null;
  director:    string | null;
  year:        string | null;
  synopsis:    string | null;
  duration:    number | null;
  likes_count: number;
  views_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Résolution URL Supabase Storage
// ─────────────────────────────────────────────────────────────────────────────
function resolveVideoUrl(raw: string | null): string {
  if (!raw || raw.trim() === '') return '';
  const url = raw.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(url);
    if (data?.publicUrl) return data.publicUrl;
  } catch {}
  return `${SUPABASE_URL}/storage/v1/object/public/${VIDEO_BUCKET}/${url}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapper Supabase → FeedFilm
// ─────────────────────────────────────────────────────────────────────────────
function mapReel(r: SupabaseReel): FeedFilm {
  return {
    id:          r.id,
    video_url:   resolveVideoUrl(r.video_url),
    poster_url:  `https://picsum.photos/seed/${r.id}/720/1280`,
    title:       r.title    ?? '',
    genre:       r.genre    ?? '',
    director:    r.director ?? '',
    year:        r.year     ?? '',
    synopsis:    r.synopsis ?? '',
    duration:    Number(r.duration ?? 0),
    likes_count: r.likes_count ?? 0,
    views_count: r.views_count ?? 0,
    created_at:  r.created_at,
    is_liked:    false,
    is_saved:    false,
    tags:        r.genre ? [`#${r.genre}`] : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch — tous les reels (pages de 100 en parallèle)
// ─────────────────────────────────────────────────────────────────────────────
const COLS =
  'id,created_at,user_id,video_url,title,genre,director,' +
  'year,synopsis,duration,likes_count,views_count';

async function fetchAllReels(): Promise<SupabaseReel[]> {
  const { count, error: cErr } = await supabase
    .from('reels')
    .select('id', { count: 'exact', head: true });

  if (cErr) console.warn('[reels] count:', cErr.message);

  const total     = count ?? 100;
  const pageCount = Math.max(1, Math.ceil(total / 100));

  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      supabase
        .from('reels')
        .select(COLS)
        .order('created_at', { ascending: false })
        .range(i * 100, i * 100 + 99)
        .then(({ data, error }) => {
          if (error) { console.warn('[reels] page', i, error.message); return []; }
          return (data ?? []) as SupabaseReel[];
        }),
    ),
  );

  const all = pages.flat();
  if (__DEV__) {
    console.log(`[reels] ${all.length} reels chargés`);
    all.slice(0, 3).forEach((r, i) =>
      console.log(`[reels] #${i} video_url:`, resolveVideoUrl(r.video_url))
    );
  }
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook feed
// ─────────────────────────────────────────────────────────────────────────────
function useReelsFeed(feedKey: MenuKey) {
  const [films,   setFilms]   = useState<FeedFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    setLoading(true); setError(null);
    fetchAllReels()
      .then(rows => { if (!dead) { setFilms(rows.map(mapReel)); setLoading(false); } })
      .catch(e   => { if (!dead) { console.error('[reels]', e); setError('Erreur de chargement.'); setLoading(false); } });
    return () => { dead = true; };
  }, [feedKey]);

  // Realtime — nouveau reel publié depuis create.tsx
  useEffect(() => {
    const ch = supabase.channel('reels_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reels' },
        ({ new: row }) => {
          const f = mapReel(row as SupabaseReel);
          setFilms(prev => prev.some(x => x.id === f.id) ? prev : [f, ...prev]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Like optimiste
  const toggleLike = useCallback((id: string) => {
    setFilms(prev => prev.map(f => {
      if (f.id !== id) return f;
      const liked = !f.is_liked;
      supabase.from('reels')
        .update({ likes_count: f.likes_count + (liked ? 1 : -1) })
        .eq('id', id)
        .then(({ error }) => { if (error) console.warn('[like]', error.message); });
      return { ...f, is_liked: liked, likes_count: f.likes_count + (liked ? 1 : -1) };
    }));
  }, []);

  // Vues fire-and-forget
  const incrementViews = useCallback((id: string, current: number) => {
    supabase.from('reels')
      .update({ views_count: current + 1 })
      .eq('id', id)
      .then(() => {});
  }, []);

  return { films, loading, error, toggleLike, incrementViews };
}

// ─────────────────────────────────────────────────────────────────────────────
// ReelsScreen
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

  const flatRef      = useRef<FlatList>(null);
  const scrollY      = useRef(new Animated.Value(0)).current;
  const activeIdxRef = useRef(0);
  const snapTimer    = useRef<ReturnType<typeof setTimeout>>();

  const { films, loading, error, toggleLike, incrementViews } = useReelsFeed(feedKey);
  const filmsRef = useRef(films);
  filmsRef.current = films;

  // ── Commit index actif — idempotent ──────────────────────────────────────
  const commitIndex = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, filmsRef.current.length - 1));
    if (clamped === activeIdxRef.current) return;
    activeIdxRef.current = clamped;
    setActiveIndex(clamped);
    // Vues fire-and-forget
    const f = filmsRef.current[clamped];
    if (f) incrementViews(f.id, f.views_count);
  }, [incrementViews]);

  const commitRef = useRef(commitIndex);
  commitRef.current = commitIndex;

  // ── SOURCE DE VÉRITÉ 1 : onViewableItemsChanged (80% visible) ────────────
  // Plus fiable que onMomentumScrollEnd : déclenché dès que la vidéo
  // est vraiment visible à l'écran, pas seulement après la fin du snap.
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,  // vidéo visible à 80% → active
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        commitRef.current(first.index);
      }
    }
  ).current;

  // ── SOURCE DE VÉRITÉ 2 : onMomentumScrollEnd (safety net) ────────────────
  const onMomentumScrollEnd = useCallback((e: any) => {
    clearTimeout(snapTimer.current);
    commitRef.current(Math.round(e.nativeEvent.contentOffset.y / ITEM_H));
  }, [ITEM_H]);

  // Safety net Android (snap sans momentum)
  const onScrollEndDrag = useCallback((e: any) => {
    clearTimeout(snapTimer.current);
    const y = e.nativeEvent.contentOffset.y;
    snapTimer.current = setTimeout(() => {
      commitRef.current(Math.round(y / ITEM_H));
    }, 80);
  }, [ITEM_H]);

  // ── Scroll vers newReelId ─────────────────────────────────────────────────
  const scrolledNew = useRef(false);
  useEffect(() => {
    if (!newReelId || scrolledNew.current || !films.length) return;
    const i = films.findIndex(f => f.id === newReelId);
    if (i < 0) return;
    scrolledNew.current = true;
    InteractionManager.runAfterInteractions(() => {
      flatRef.current?.scrollToIndex({ index: i, animated: true });
    });
  }, [newReelId, films]);
  useEffect(() => { scrolledNew.current = false; }, [newReelId]);

  // ── Pause globale quand on quitte l'écran ─────────────────────────────────
  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    return () => { clearTimeout(snapTimer.current); setScreenFocused(false); };
  }, []));

  const handleInfoPress = useCallback((film: FeedFilm) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInfoFilm(film);
  }, []);

  // ── Render item ───────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: FeedFilm; index: number }) => (
      <FeedItem
        film={item}
        isActive={index === activeIndex && screenFocused}
        isNear={Math.abs(index - activeIndex) <= 2}
        screenFocused={screenFocused}
        itemW={W}
        itemH={ITEM_H}
        insetBot={insets.bottom}
        onLike={toggleLike}
        onInfoPress={handleInfoPress}
      />
    ),
    [activeIndex, screenFocused, W, ITEM_H, insets.bottom, toggleLike, handleInfoPress],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: ITEM_H, offset: ITEM_H * index, index }),
    [ITEM_H],
  );

  const keyExtractor = useCallback((item: FeedFilm) => item.id, []);

  const onScrollToIndexFailed = useCallback(({ index }: { index: number }) => {
    flatRef.current?.scrollToOffset({ offset: index * ITEM_H, animated: false });
    InteractionManager.runAfterInteractions(() => {
      flatRef.current?.scrollToIndex({ index, animated: true });
    });
  }, [ITEM_H]);

  const onScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false },
  ), [scrollY]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && !films.length) {
    return (
      <View style={s.root}>
        <StatusBar style="light" translucent />
        <View style={s.center}><Text style={s.loadTxt}>Chargement…</Text></View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
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

        // Sources de vérité pour l'index actif
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}

        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onScroll={onScroll}
        scrollEventThrottle={16}

        // Performances
        windowSize={9}              // ±4 items toujours en mémoire
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={false}  // CRITIQUE : VideoView jamais détruite

        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
      />

      {/* TopHeader flottant */}
      <SafeAreaView edges={['top']} style={s.header} pointerEvents="box-none">
        <TopHeader feedKey={feedKey} onMenuPress={() => setMenuOpen(true)} scrollY={scrollY} />
      </SafeAreaView>

      {/* Erreur */}
      {!!error && (
        <View style={s.errBanner} pointerEvents="none">
          <Text style={s.errTxt}>{error}</Text>
        </View>
      )}

      {/* Menu */}
      <Modal visible={menuOpen} transparent animationType="none"
             statusBarTranslucent onRequestClose={() => setMenuOpen(false)}>
        <DropdownMenu visible={menuOpen} onClose={() => setMenuOpen(false)}
          onSelect={setFeedKey} activeKey={feedKey} />
      </Modal>

      {/* InfoSheet */}
      <InfoSheet film={infoFilm} onClose={() => setInfoFilm(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#000' },
  header:    { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadTxt:   { color: 'rgba(255,255,255,0.40)', fontSize: 15 },
  errBanner: { position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 99,
               backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12,
               borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)',
               paddingHorizontal: 16, paddingVertical: 10 },
  errTxt:    { color: '#EF4444', fontSize: 12, textAlign: 'center' },
});