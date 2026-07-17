/**
 * app/(tabs)/reels/index.tsx — UNIVERSE · v7
 *
 * ★ ReelsUIProvider est instancié ICI — plus besoin de modifier _layout.tsx
 * ★ ReelsScreenInner consomme useReelsUI() → TopHeader animé
 * ★ FeedItem consomme useReelsUI() → NavBar + TopHeader cachés SIMULTANÉMENT
 * ★ Filtrage RÉEL par genre : feedKey = 'all' | <genres.value exacte>
 *   La query Supabase applique .eq('genre', feedKey) sauf pour 'all'.
 *
 * Pour brancher la CustomNavBar (dans _layout.tsx ou le composant NavBar) :
 *   import { useReelsUI } from '@/contexts/ReelsUIContext';
 *   const { uiOpacity, uiVisible } = useReelsUI();
 *   <Animated.View style={{ opacity: uiOpacity }}
 *                  pointerEvents={uiVisible ? 'auto' : 'none'}>
 *     <CustomNavBar />
 *   </Animated.View>
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, FlatList, InteractionManager, Modal,
  Platform, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { StatusBar }                            from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets }      from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics                             from 'expo-haptics';

import FeedItem      from '@/components/reels/FeedItem';
import TopHeader     from '@/components/reels/TopHeader';
import InfoSheet     from '@/components/reels/Infosheet';
import DropdownMenu, { type MenuKey } from '@/components/DropDownMenu';
import { useReelsUI } from '@/contexts/ReelsUIContext';
import { supabase }      from '@/lib/supabase';
import { getDeviceId }   from '@/services/api';
import type { FeedFilm } from '@/components/reels/types';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://knrzbdqfflobfjdmqyte.supabase.co';
const VIDEO_BUCKET   = 'community-images';
const ALL_GENRES_KEY = 'all'; // doit matcher la clé émise par DropdownMenu

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SupabaseReel {
  id: string; created_at: string; user_id: string; video_url: string;
  title: string | null; genre: string | null; director: string | null;
  year: string | null; synopsis: string | null; duration: number | null;
  likes_count: number; views_count: number; status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function resolveVideoUrl(raw: string | null): string {
  if (!raw?.trim()) return '';
  const url = raw.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(url);
    if (data?.publicUrl) return data.publicUrl;
  } catch {}
  return `${SUPABASE_URL}/storage/v1/object/public/${VIDEO_BUCKET}/${url}`;
}

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

const COLS =
  'id,created_at,user_id,video_url,title,genre,director,' +
  'year,synopsis,duration,likes_count,views_count,status';

const PAGE_SIZE = 20;

// ★ Affinity — pondère les genres likés par l'utilisateur pour le reranking client-side.
// Ne bloque pas le fetch (fire-and-forget, résultat mis en cache dans le hook).
function useUserAffinity(userId?: string): Record<string, number> {
  const [affinity, setAffinity] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!userId) return;
    let dead = false;
    supabase.from('user_liked_reels').select('reel_id').eq('user_id', userId).limit(60)
      .then(({ data: ld }) => {
        if (dead || !ld?.length) return;
        const ids = ld.map((r: any) => String(r.reel_id));
        supabase.from('reels').select('genre').in('id', ids)
          .then(({ data: rd }) => {
            if (dead) return;
            const s: Record<string, number> = {};
            (rd ?? []).forEach((r: any) => { if (r.genre) s[r.genre] = (s[r.genre] ?? 0) + 2; });
            if (Object.keys(s).length) setAffinity(s);
          }, () => {});
      }, () => {});
    return () => { dead = true; };
  }, [userId]);
  return affinity;
}

// Client-side score pour reranker page 0 selon les goûts du user.
// Boost genre aimé (max 16pts) + fraîcheur (max 4pts) + engagement (max 2pts).
function scoreForFeed(r: SupabaseReel, aff: Record<string, number>): number {
  const g = aff[r.genre ?? ''] ?? 0;
  const ageD = (Date.now() - new Date(r.created_at).getTime()) / 86400000;
  const recency = Math.max(0, 1 - ageD / 30);
  const eng = Math.min(1, (r.likes_count * 3 + r.views_count) / 2000);
  return g * 8 + recency * 4 + eng * 2;
}

// Direct XP award (sans hook complet) — utile pour récompenser les interactions
// depuis des écrans qui ne consomment pas useGamification.
function awardXPDirect(userId: string, amount: number, _reason: string) {
  supabase.from('quest_progress').select('xp').eq('user_id', userId).maybeSingle()
    .then(({ data }) => {
      const cur = (data as any)?.xp ?? 0;
      supabase.from('quest_progress').upsert(
        { user_id: userId, xp: cur + amount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      ).then(() => {}, () => {
        supabase.from('profiles').update({ contribution_score: cur + amount }).eq('id', userId).then(() => {}, () => {});
      });
    }, () => {});
}

// ★ Filtrage réel par genre : genre = clé exacte de public.genres.value,
//   'all' (ou vide) = aucun filtre → tous les reels approuvés.
async function fetchApprovedPage(page: number, genre: MenuKey): Promise<SupabaseReel[]> {
  const from = page * PAGE_SIZE;
  let query = supabase
    .from('reels')
    .select(COLS)
    .eq('status', 'approved');

  if (genre && genre !== ALL_GENRES_KEY) {
    query = query.eq('genre', genre);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
    .returns<SupabaseReel[]>();

  if (error) throw error;
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook feed — re-fetch complet à chaque changement de feedKey (genre)
// ─────────────────────────────────────────────────────────────────────────────
function useReelsFeed(feedKey: MenuKey, affinity: Record<string, number> = {}) {
  const [films,   setFilms]   = useState<FeedFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const pageRef     = useRef(0);
  const hasMoreRef  = useRef(true);
  const loadingMore = useRef(false);
  const feedKeyRef  = useRef(feedKey);
  feedKeyRef.current = feedKey;
  const affinityRef = useRef(affinity);
  affinityRef.current = affinity;

  useEffect(() => {
    let dead = false;
    setLoading(true); setError(null); setFilms([]);
    pageRef.current = 0; hasMoreRef.current = true; loadingMore.current = false;
    fetchApprovedPage(0, feedKey)
      .then(rows => {
        if (!dead) {
          // ★ Rerank page 0 si le user a des préférences genre (feed global seulement)
          const aff = affinityRef.current;
          const hasAff = feedKey === ALL_GENRES_KEY && Object.keys(aff).length > 0;
          const ranked = hasAff
            ? [...rows].sort((a, b) => scoreForFeed(b, aff) - scoreForFeed(a, aff))
            : rows;
          setFilms(ranked.map(mapReel));
          hasMoreRef.current = rows.length === PAGE_SIZE;
          setLoading(false);
        }
      })
      .catch(e => {
        if (!dead) {
          console.error('[reels]', e);
          setError('Erreur de chargement.');
          setLoading(false);
        }
      });
    return () => { dead = true; };
  }, [feedKey]);

  const loadMore = useCallback(async () => {
    if (loadingMore.current || !hasMoreRef.current) return;
    loadingMore.current = true;
    const next = pageRef.current + 1;
    try {
      const rows = await fetchApprovedPage(next, feedKeyRef.current);
      setFilms(prev => [...prev, ...rows.map(mapReel)]);
      pageRef.current = next;
      hasMoreRef.current = rows.length === PAGE_SIZE;
    } catch (e) {
      console.error('[reels:loadMore]', e);
    } finally {
      loadingMore.current = false;
    }
  }, []);

  // ── Realtime — ne réinjecte/maj que si le reel appartient au genre actif ──
  useEffect(() => {
    const ch = supabase
      .channel(`reels_rt_${Date.now()}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reels' },
        ({ new: row }) => {
          const r = row as SupabaseReel;
          const activeGenre = feedKeyRef.current;
          const matchesGenre = activeGenre === ALL_GENRES_KEY || r.genre === activeGenre;

          if (r.status === 'approved' && matchesGenre) {
            setFilms(prev =>
              prev.some(x => x.id === r.id)
                ? prev.map(x => x.id === r.id ? mapReel(r) : x)
                : [mapReel(r), ...prev],
            );
          } else {
            setFilms(prev => prev.filter(x => x.id !== r.id));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleLike = useCallback((id: string, userId?: string) => {
    setFilms(prev => prev.map(f => {
      if (f.id !== id) return f;
      const liked = !f.is_liked;
      supabase.from('reels')
        .update({ likes_count: f.likes_count + (liked ? 1 : -1) })
        .eq('id', id)
        .then(() => {}, () => {});
      // ★ +5 XP par like (uniquement en likant, pas en unlikant)
      if (liked && userId) awardXPDirect(userId, 5, 'reel_like');
      return { ...f, is_liked: liked, likes_count: f.likes_count + (liked ? 1 : -1) };
    }));
  }, []);

  const incrementViews = useCallback((id: string, current: number) => {
    supabase.from('reels')
      .update({ views_count: current + 1 })
      .eq('id', id)
      .then(() => {}, () => {});
  }, []);

  const updateSaved = useCallback((savedIds: Set<string>) => {
    setFilms(prev => prev.map(f => ({ ...f, is_saved: savedIds.has(f.id) })));
  }, []);

  const updateLiked = useCallback((likedIds: Set<string>) => {
    setFilms(prev => prev.map(f => ({ ...f, is_liked: likedIds.has(f.id) })));
  }, []);

  return { films, loading, error, loadMore, toggleLike, incrementViews, updateSaved, updateLiked };
}

// ─────────────────────────────────────────────────────────────────────────────
// ReelsScreenInner — consomme le contexte (doit être enfant du Provider)
// ─────────────────────────────────────────────────────────────────────────────
function ReelsScreenInner() {
  const { width: W, height: H } = useWindowDimensions();
  const insets                  = useSafeAreaInsets();
  const { newReelId }           = useLocalSearchParams<{ newReelId?: string }>();
  const [feedH, setFeedH]       = useState(H);
  const ITEM_H                  = feedH;

  // ★ Contexte — même Animated.Value pour TopHeader ET NavBar
  const { uiVisible, uiOpacity, setUIVisible } = useReelsUI();

  const [activeIndex,   setActiveIndex]   = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [feedKey,       setFeedKey]       = useState<MenuKey>(ALL_GENRES_KEY);
  const [infoFilm,      setInfoFilm]      = useState<FeedFilm | null>(null);
  const [userId,        setUserId]        = useState<string | undefined>(undefined);
  const [userPrefs,     setUserPrefs]     = useState<{ autoplay: boolean; data_saver: boolean }>({ autoplay: true, data_saver: false });

  // ★ Résout le device ID une seule fois — pas de getDeviceId dans chaque FeedItem
  useEffect(()=>{ getDeviceId().then(id=>setUserId(id||undefined)); },[]);

  // ★ Charge autoplay + data_saver dès que l'userId est disponible
  useEffect(()=>{
    if(!userId) return;
    supabase.from('user_preferences').select('autoplay,data_saver').eq('user_id',userId).maybeSingle()
      .then(({data})=>{ if(data) setUserPrefs({ autoplay: data.autoplay??true, data_saver: data.data_saver??false }); },()=>{});
  },[userId]);

  const flatRef      = useRef<FlatList>(null);
  const scrollY      = useRef(new Animated.Value(0)).current;
  const activeIdxRef = useRef(0);
  const snapTimer    = useRef<ReturnType<typeof setTimeout>>();

  // ★ Affinity — chargée après userId, reranke la page 0 sur le feed global
  const affinity = useUserAffinity(userId);

  const { films, loading, error, loadMore, toggleLike, incrementViews, updateSaved, updateLiked } =
    useReelsFeed(feedKey, affinity);

  // ── Charge is_saved / is_liked depuis Supabase quand userId + films sont prêts ──
  useEffect(() => {
    if (!userId || !films.length) return;
    const ids = films.map(f => f.id);
    // Saved : user_saved_reels.reel_id (uuid) — table dédiée aux reels,
    //   distincte de user_favorites (integer work_id pour les œuvres classiques)
    supabase.from('user_saved_reels').select('reel_id').eq('user_id', userId).in('reel_id', ids)
      .then(({ data }) => {
        const s = new Set((data ?? []).map((r: any) => String(r.reel_id)));
        if (s.size) updateSaved(s);
      }, () => {});
    // Liked : user_liked_reels.reel_id
    supabase.from('user_liked_reels').select('reel_id').eq('user_id', userId).in('reel_id', ids)
      .then(({ data }) => {
        const l = new Set((data ?? []).map((r: any) => String(r.reel_id)));
        if (l.size) updateLiked(l);
      }, () => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, films.length]);

  const filmsRef = useRef(films);
  filmsRef.current = films;

  // ── Sélection d'un genre depuis le DropdownMenu ───────────────────────────
  const handleGenreSelect = useCallback((key: MenuKey) => {
    setFeedKey(key);
    activeIdxRef.current = 0;
    setActiveIndex(0);
    // Reset immédiat en haut du feed filtré
    flatRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  // ── Index actif ───────────────────────────────────────────────────────────
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const commitIndex = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, filmsRef.current.length - 1));
    if (clamped === activeIdxRef.current) return;
    activeIdxRef.current = clamped;
    setActiveIndex(clamped);
    setUIVisible(true);
    const f = filmsRef.current[clamped];
    if (f) {
      incrementViews(f.id, f.views_count);
      // ★ +2 XP par reel visionné (new video scrolled to)
      if (userIdRef.current) awardXPDirect(userIdRef.current, 2, 'reel_view');
    }
  }, [incrementViews, setUIVisible]);

  const commitRef = useRef(commitIndex);
  commitRef.current = commitIndex;

  // ── Scroll ────────────────────────────────────────────────────────────────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) commitRef.current(first.index);
    },
  ).current;

  const onMomentumScrollEnd = useCallback((e: any) => {
    clearTimeout(snapTimer.current);
    commitRef.current(Math.round(e.nativeEvent.contentOffset.y / ITEM_H));
  }, [ITEM_H]);

  const onScrollEndDrag = useCallback((e: any) => {
    clearTimeout(snapTimer.current);
    const y = e.nativeEvent.contentOffset.y;
    snapTimer.current = setTimeout(
      () => commitRef.current(Math.round(y / ITEM_H)), 80,
    );
  }, [ITEM_H]);

  // ── newReelId ─────────────────────────────────────────────────────────────
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

  // ── Focus ─────────────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    setUIVisible(true); // Retour sur l'écran → tout ré-afficher
    return () => {
      clearTimeout(snapTimer.current);
      setScreenFocused(false);
    };
  }, [setUIVisible]));

  const handleInfoPress = useCallback((film: FeedFilm) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setInfoFilm(film);
  }, []);

  // ★ onLike : forward l'userId pour que toggleLike puisse award l'XP
  const handleLike = useCallback((id: string) => {
    toggleLike(id, userIdRef.current);
  }, [toggleLike]);

  // ── renderItem — SANS onUIVisibilityChange (géré par le contexte) ─────────
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
        onLike={handleLike}
        onInfoPress={handleInfoPress}
        userId={userId}
        autoplay={userPrefs.autoplay}
        dataSaver={userPrefs.data_saver}
      />
    ),
    [activeIndex, screenFocused, W, ITEM_H, insets.bottom, handleLike, handleInfoPress, userId, userPrefs],
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
        <View style={s.center}>
          <Text style={s.loadTxt}>Chargement…</Text>
        </View>
      </View>
    );
  }

  // ── Aucun résultat pour ce genre ──────────────────────────────────────────
  if (!loading && !films.length) {
    return (
      <View style={s.root}>
        <StatusBar style="light" translucent />
        <View style={s.center}>
          <Text style={s.loadTxt}>Aucune vidéo dans ce genre pour l'instant.</Text>
        </View>

        <Animated.View
          style={[s.header, { opacity: uiOpacity }]}
          pointerEvents={uiVisible ? 'box-none' : 'none'}
        >
          <SafeAreaView edges={['top']}>
            <TopHeader
              feedKey={feedKey}
              onMenuPress={() => setMenuOpen(true)}
              scrollY={scrollY}
            />
          </SafeAreaView>
        </Animated.View>

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
            onSelect={handleGenreSelect}
            activeKey={feedKey}
          />
        </Modal>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View
      style={s.root}
      onLayout={e => { const h = e.nativeEvent.layout.height; if (h > 0) setFeedH(h); }}
    >
      <StatusBar style="light" translucent />

      <FlatList
        ref={flatRef}
        data={films}
        extraData={`${activeIndex}-${screenFocused}`}
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
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        windowSize={5}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
        updateCellsBatchingPeriod={100}
        removeClippedSubviews={Platform.OS !== 'web'}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
      />

      {/* ★ TopHeader — uiOpacity partagée avec la NavBar → synchro parfaite */}
      <Animated.View
        style={[s.header, { opacity: uiOpacity }]}
        pointerEvents={uiVisible ? 'box-none' : 'none'}
      >
        <SafeAreaView edges={['top']}>
          <TopHeader
            feedKey={feedKey}
            onMenuPress={() => setMenuOpen(true)}
            scrollY={scrollY}
          />
        </SafeAreaView>
      </Animated.View>

      {/* Erreur */}
      {!!error && (
        <View style={s.errBanner} pointerEvents="none">
          <Text style={s.errTxt}>{error}</Text>
        </View>
      )}

      {/* Menu — onSelect déclenche le re-fetch filtré par genre */}
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
          onSelect={handleGenreSelect}
          activeKey={feedKey}
        />
      </Modal>

      {/* Info sheet */}
      <InfoSheet film={infoFilm} onClose={() => setInfoFilm(null)} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export — Provider wrappé ICI, pas besoin de modifier _layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  return <ReelsScreenInner />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  loadTxt: { color: 'rgba(255,255,255,0.40)', fontSize: 15, textAlign: 'center' },
  errBanner: {
    position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 99,
    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  errTxt: { color: '#EF4444', fontSize: 12, textAlign: 'center' },
});