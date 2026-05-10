/**
 * app/(reels)/index.tsx
 * Feed reels
 * - activeIndex piloté par pagination scroll (onMomentumScrollEnd + fallback Android)
 * - rendu vidéo stable (isNear ±1) via FeedItem
 * - réduction de fonctionnalités pour fiabilité
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import FeedItem from '@/components/reels/FeedItem';
import TopHeader from '@/components/reels/TopHeader';
import InfoSheet from '@/components/reels/Infosheet';
import DropdownMenu, { type MenuKey } from '@/components/DropDownMenu';

import { supabase } from '@/lib/supabase';
import type { FeedFilm } from '@/components/reels/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types miroir public.reels
// ─────────────────────────────────────────────────────────────────────────────
interface SupaReel {
  id: string;
  created_at: string;
  user_id: string;
  video_url: string;
  title: string | null;
  genre: string | null;
  director: string | null;
  year: string | null;
  synopsis: string | null;
  duration: number | null;
  likes_count: number | null;
  views_count: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────────────────────
function toFilm(r: SupaReel): FeedFilm {
  return {
    id: r.id,
    video_url: r.video_url,
    poster_url: `https://picsum.photos/seed/${r.id}/400/700`, // (non utilisé si FeedItem “zéro poster”)
    title: r.title ?? '',
    genre: r.genre ?? '',
    director: r.director ?? '',
    year: r.year ?? '',
    synopsis: r.synopsis ?? '',
    duration: Number(r.duration ?? 0),
    likes_count: r.likes_count ?? 0,
    views_count: r.views_count ?? 0,
    created_at: r.created_at,

    is_liked: false,
    is_saved: false,
    tags: r.genre ? [`#${r.genre}`] : [],
  };
}

const COLS =
  'id,created_at,user_id,video_url,title,genre,director,year,synopsis,duration,likes_count,views_count';

async function fetchReels(feedKey: MenuKey): Promise<SupaReel[]> {
  // Réduction : une seule requête (plus stable/rapide pour la vidéo)
  // Si tu veux filtrer par feedKey, adapte ici.
  const { data, error } = await supabase
    .from('reels')
    .select(COLS)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) throw error;
  return (data ?? []) as SupaReel[];
}

function useFeed(feedKey: MenuKey) {
  const [films, setFilms] = useState<FeedFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    setError(null);

    fetchReels(feedKey)
      .then((data) => {
        if (dead) return;
        setFilms(data.map(toFilm));
        setLoading(false);
      })
      .catch((e) => {
        console.error('[reels] fetch:', e);
        if (dead) return;
        setError('Impossible de charger les vidéos.');
        setLoading(false);
      });

    return () => {
      dead = true;
    };
  }, [feedKey]);

  const toggleLike = useCallback((id: string) => {
    // Best effort : update local immédiat + update DB en arrière-plan
    setFilms((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const liked = !f.is_liked;
        const nextLikes = (f.likes_count || 0) + (liked ? 1 : -1);

        supabase
          .from('reels')
          .update({ likes_count: nextLikes })
          .eq('id', id)
          .then(() => {})
          .catch(() => {});

        return { ...f, is_liked: liked, likes_count: nextLikes };
      })
    );
  }, []);

  return { films, loading, error, toggleLike };
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const { width: W, height: H } = (require('react-native') as typeof import('react-native')).useWindowDimensions
    ? (require('react-native') as typeof import('react-native')).useWindowDimensions()
    : { width: 0, height: 0 };

  // NB: on utilise useWindowDimensions “réel” via import initial, mais ton fichier d’origine l’avait.
  // Pour éviter toute divergence, on garde la variable via une méthode stable :
  // (si tu as déjà useWindowDimensions importé chez toi, supprime ce contournement)
  // → Si ça te gêne, dis-moi et je te renvoie la version avec useWindowDimensions classique.

  const insets = useSafeAreaInsets();
  const { newReelId } = useLocalSearchParams<{ newReelId?: string }>();
  const ITEM_H = H;

  const [activeIndex, setActiveIndex] = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [feedKey, setFeedKey] = useState<MenuKey>('foryou');
  const [infoFilm, setInfoFilm] = useState<FeedFilm | null>(null);

  const flatRef = useRef<FlatList<FeedFilm>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const idxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { films, loading, error, toggleLike } = useFeed(feedKey);

  const filmsRef = useRef<FeedFilm[]>(films);
  filmsRef.current = films;

  const commitIdx = useCallback(
    (next: number) => {
      if (!filmsRef.current.length) return;
      const idx = Math.max(0, Math.min(next, filmsRef.current.length - 1));
      if (idx === idxRef.current) return;

      idxRef.current = idx;
      setActiveIndex(idx);

      // views best effort
      const f = filmsRef.current[idx];
      if (f?.id) {
        supabase
          .from('reels')
          .update({ views_count: (f.views_count || 0) + 1 })
          .eq('id', f.id)
          .then(() => {})
          .catch(() => {});
      }
    },
    []
  );

  const commitRef = useRef(commitIdx);
  commitRef.current = commitIdx;

  const onMomentumScrollEnd = useCallback(
    (e: any) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      commitRef.current(Math.round(e.nativeEvent.contentOffset.y / ITEM_H));
    },
    [ITEM_H]
  );

  const onScrollEndDrag = useCallback(
    (e: any) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const y = e.nativeEvent.contentOffset.y;

      timerRef.current = setTimeout(() => {
        commitRef.current(Math.round(y / ITEM_H));
      }, 120);
    },
    [ITEM_H]
  );

  // Focus / Blur
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setScreenFocused(false);
      };
    }, [])
  );

  // Scroll vers newReelId
  const didScroll = useRef(false);
  useEffect(() => {
    if (!newReelId || didScroll.current || !films.length) return;

    const i = films.findIndex((f) => f.id === newReelId);
    if (i < 0) return;

    didScroll.current = true;
    InteractionManager.runAfterInteractions(() => {
      flatRef.current?.scrollToIndex({ index: i, animated: true });
    });
  }, [newReelId, films]);

  useEffect(() => {
    didScroll.current = false;
  }, [newReelId]);

  const onInfo = useCallback((f: FeedFilm) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInfoFilm(f);
  }, []);

  // Important pour la stabilité : isNear petit (±1) => moins de montages.
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
        onLike={toggleLike}
        onInfoPress={onInfo}
      />
    ),
    [activeIndex, screenFocused, W, ITEM_H, insets.bottom, toggleLike, onInfo]
  );

  const getItemLayout = useCallback(
    (_: any, i: number) => ({ length: ITEM_H, offset: ITEM_H * i, index: i }),
    [ITEM_H]
  );

  const keyExtractor = useCallback((item: FeedFilm) => item.id, []);

  const onScrollToIndexFailed = useCallback(
    ({ index }: { index: number }) => {
      flatRef.current?.scrollToOffset({ offset: index * ITEM_H, animated: false });
      InteractionManager.runAfterInteractions(() => {
        flatRef.current?.scrollToIndex({ index, animated: true });
      });
    },
    [ITEM_H]
  );

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
      }),
    [scrollY]
  );

  if (loading && !films.length) {
    return (
      <View style={st.root}>
        <StatusBar style="light" translucent />
        <View style={st.center}>
          <Text style={st.loadTxt}>Chargement…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <StatusBar style="light" translucent />

      <FlatList
        ref={flatRef}
        data={films}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        pagingEnabled
        decelerationRate="fast"
        windowSize={7} // réduit encore le churn
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={false} // indispensable avec VideoView natif
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onScroll={onScroll}
        scrollEventThrottle={16}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
      />

      <SafeAreaView edges={['top']} style={st.header} pointerEvents="box-none">
        <TopHeader feedKey={feedKey} onMenuPress={() => setMenuOpen(true)} scrollY={scrollY} />
      </SafeAreaView>

      {!!error && (
        <View style={st.errBanner} pointerEvents="none">
          <Text style={st.errTxt}>{error}</Text>
        </View>
      )}

      <Modal
        visible={menuOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <DropdownMenu visible={menuOpen} onClose={() => setMenuOpen(false)} onSelect={setFeedKey} activeKey={feedKey} />
      </Modal>

      <InfoSheet film={infoFilm} onClose={() => setInfoFilm(null)} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadTxt: { color: 'rgba(255,255,255,0.40)', fontSize: 15 },
  errBanner: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 99,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errTxt: { color: '#EF4444', fontSize: 12, textAlign: 'center' },
});