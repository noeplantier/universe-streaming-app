/**
 * app/(reels)/index.tsx
 *
 * Feed TikTok — public.reels
 * • Fetch tous les reels (pagination parallèle)
 * • onMomentumScrollEnd = seule source de vérité de l'index actif
 * • windowSize=9, removeClippedSubviews=false
 * • TopHeader + InfoSheet + DropdownMenu
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, FlatList, InteractionManager, Modal,
  Platform, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { StatusBar }                            from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets }      from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics                             from 'expo-haptics';

import FeedItem  from '@/components/reels/FeedItem';
import TopHeader from '@/components/reels/TopHeader';
import InfoSheet from '@/components/reels/Infosheet';
import DropdownMenu, { type MenuKey } from '@/components/DropDownMenu';
import { supabase }  from '@/lib/supabase';
import type { FeedFilm } from '@/components/reels/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types Supabase (miroir public.reels)
// ─────────────────────────────────────────────────────────────────────────────
interface SupaReel {
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
// Mapper — poster_url picsum (fallback si pas de thumbnail)
// ─────────────────────────────────────────────────────────────────────────────
function toFilm(r: SupaReel): FeedFilm {
  return {
    id:          r.id,
    video_url:   r.video_url,
    poster_url:  `https://picsum.photos/seed/${r.id}/400/700`,
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
// Fetch — TOUS les reels en parallèle (contourne max_rows PostgREST)
// ─────────────────────────────────────────────────────────────────────────────
const COLS = 'id,created_at,user_id,video_url,title,genre,director,year,synopsis,duration,likes_count,views_count';

async function fetchReels(): Promise<SupaReel[]> {
  // 1. Count exact
  const { count, error: cErr } = await supabase
    .from('reels')
    .select('id', { count: 'exact', head: true });

  if (cErr || !count) {
    console.warn('[reels] count:', cErr?.message);
    // Fallback : une seule page
    const { data } = await supabase.from('reels').select(COLS)
      .order('created_at', { ascending: false }).limit(100);
    return (data ?? []) as SupaReel[];
  }

  // 2. Pages en parallèle (100 items/page)
  const pages = await Promise.all(
    Array.from({ length: Math.ceil(count / 100) }, (_, i) =>
      supabase.from('reels').select(COLS)
        .order('created_at', { ascending: false })
        .range(i * 100, i * 100 + 99)
        .then(({ data }) => (data ?? []) as SupaReel[])
    )
  );

  const all = pages.flat();
  console.log(`[reels] ${all.length}/${count} chargés`);
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook feed
// ─────────────────────────────────────────────────────────────────────────────
function useFeed(feedKey: MenuKey) {
  const [films,   setFilms]   = useState<FeedFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    setLoading(true); setError(null);
    fetchReels()
      .then(data => {
        if (!dead) { setFilms(data.map(toFilm)); setLoading(false); }
      })
      .catch(e => {
        console.error('[reels] fetch:', e);
        if (!dead) { setError('Impossible de charger les vidéos.'); setLoading(false); }
      });
    return () => { dead = true; };
  }, [feedKey]);

  // Realtime : nouveau reel publié (create.tsx → Supabase)
  useEffect(() => {
    const ch = supabase.channel('reels_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reels' },
        ({ new: r }) => {
          const f = toFilm(r as SupaReel);
          setFilms(prev => prev.some(x => x.id === f.id) ? prev : [f, ...prev]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleLike = useCallback((id: string) => {
    setFilms(prev => prev.map(f => {
      if (f.id !== id) return f;
      const liked = !f.is_liked;
      supabase.from('reels')
        .update({ likes_count: f.likes_count + (liked ? 1 : -1) })
        .eq('id', id).then(() => {});
      return { ...f, is_liked: liked, likes_count: f.likes_count + (liked ? 1 : -1) };
    }));
  }, []);

  return { films, loading, error, toggleLike };
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets  = useSafeAreaInsets();
  const { newReelId } = useLocalSearchParams<{ newReelId?: string }>();
  const ITEM_H  = H;

  const [activeIndex,   setActiveIndex]   = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>('foryou');
  const [infoFilm,      setInfoFilm]      = useState<FeedFilm | null>(null);

  const flatRef  = useRef<FlatList>(null);
  const scrollY  = useRef(new Animated.Value(0)).current;
  const idxRef   = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const { films, loading, error, toggleLike } = useFeed(feedKey);
  const filmsRef = useRef(films);
  filmsRef.current = films;

  // ── Commit index ──────────────────────────────────────────────────────────
  const commitIdx = useCallback((next: number) => {
    const idx = Math.max(0, Math.min(next, filmsRef.current.length - 1));
    if (idx === idxRef.current && idx === 0 && films.length > 0) {
      // premier chargement → forcer commit
    } else if (idx === idxRef.current) return;
    idxRef.current = idx;
    setActiveIndex(idx);
    // Vues fire-and-forget
    const f = filmsRef.current[idx];
    if (f?.id) {
      supabase.from('reels')
        .update({ views_count: (f.views_count || 0) + 1 })
        .eq('id', f.id).then(() => {});
    }
  }, [films.length]);

  const commitRef = useRef(commitIdx);
  commitRef.current = commitIdx;

  // ── onMomentumScrollEnd — SOURCE UNIQUE de vérité ─────────────────────────
  const onMomentumScrollEnd = useCallback((e: any) => {
    clearTimeout(timerRef.current);
    commitRef.current(Math.round(e.nativeEvent.contentOffset.y / ITEM_H));
  }, [ITEM_H]);

  // Safety net Android
  const onScrollEndDrag = useCallback((e: any) => {
    clearTimeout(timerRef.current);
    const y = e.nativeEvent.contentOffset.y;
    timerRef.current = setTimeout(() => {
      commitRef.current(Math.round(y / ITEM_H));
    }, 100);
  }, [ITEM_H]);

  // ── Scroll vers newReelId ─────────────────────────────────────────────────
  const didScroll = useRef(false);
  useEffect(() => {
    if (!newReelId || didScroll.current || !films.length) return;
    const i = films.findIndex(f => f.id === newReelId);
    if (i < 0) return;
    didScroll.current = true;
    InteractionManager.runAfterInteractions(() => {
      flatRef.current?.scrollToIndex({ index: i, animated: true });
    });
  }, [newReelId, films]);
  useEffect(() => { didScroll.current = false; }, [newReelId]);

  // ── Focus / Blur ──────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    return () => { clearTimeout(timerRef.current); setScreenFocused(false); };
  }, []));

  const onInfo = useCallback((f: FeedFilm) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInfoFilm(f);
  }, []);

  // ── Render item ───────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }: { item: FeedFilm; index: number }) => (
    <FeedItem
      film={item}
      isActive={index === activeIndex && screenFocused}
      isNear={Math.abs(index - activeIndex) <= 1}
      screenFocused={screenFocused}
      itemW={W}
      itemH={ITEM_H}
      insetBot={insets.bottom}
      onLike={toggleLike}
      onInfoPress={onInfo}
    />
  ), [activeIndex, screenFocused, W, ITEM_H, insets.bottom, toggleLike, onInfo]);

  const getItemLayout = useCallback(
    (_: any, i: number) => ({ length: ITEM_H, offset: ITEM_H * i, index: i }),
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

  // ─────────────────────────────────────────────────────────────────────────
  if (loading && !films.length) {
    return (
      <View style={st.root}>
        <StatusBar style="light" translucent />
        <View style={st.center}><Text style={st.loadTxt}>Chargement…</Text></View>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <StatusBar style="light" translucent />

      {/* Feed principal */}
      <FlatList
        ref={flatRef}
        data={films}
        keyExtractor={keyExtractor}
        renderItem={renderItem}

        pagingEnabled
        decelerationRate="fast"

        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}

        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onScroll={onScroll}
        scrollEventThrottle={16}

        windowSize={9}               // ±4 items montés — aucun player détruit
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={false}  // JAMAIS true avec VideoView natif

        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
      />

      {/* TopHeader flottant */}
      <SafeAreaView edges={['top']} style={st.header} pointerEvents="box-none">
        <TopHeader feedKey={feedKey} onMenuPress={() => setMenuOpen(true)} scrollY={scrollY} />
      </SafeAreaView>

      {/* Erreur */}
      {!!error && (
        <View style={st.errBanner} pointerEvents="none">
          <Text style={st.errTxt}>{error}</Text>
        </View>
      )}

      {/* Dropdown menu */}
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

const st = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#000' },
  header:    { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadTxt:   { color: 'rgba(255,255,255,0.40)', fontSize: 15 },
  errBanner: { position:'absolute', bottom:100, left:20, right:20, zIndex:99,
               backgroundColor:'rgba(239,68,68,0.15)', borderRadius:12,
               borderWidth:1, borderColor:'rgba(239,68,68,0.30)',
               paddingHorizontal:16, paddingVertical:10 },
  errTxt:    { color:'#EF4444', fontSize:12, textAlign:'center' },
});