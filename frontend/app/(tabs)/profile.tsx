/**
 * profile.tsx — v2.0
 *
 * ── CHANGEMENTS ───────────────────────────────────────────────────────────────
 *
 *   1. PLUS DE "0" sur les cards
 *      RankedItem affiche le rang réel (index + 1) en overlay.
 *      FavCard ne reçoit plus rank=0 — il reçoit le rang réel.
 *
 *   2. Films favoris → fetch public.films (triés par likes_count desc)
 *      Cliquables → router.push(`/film/${id}`)
 *
 *   3. Films & Séries vus → fetch public.films (watchlist de l'utilisateur)
 *      via la table join seen_films ou directement films.
 *      Cliquables → router.push(`/film/${id}`)
 *
 *   4. Onglet Créas → fetch public.films filtré par durée / catégorie :
 *        - Courts métrages  : duration < 60
 *        - Moyens métrages  : 60 ≤ duration ≤ 100
 *        - Mini-séries      : category = 'Mini-série'
 *      Cliquables → router.push(`/film/${id}`)
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, RefreshControl, StyleSheet, Text, TouchableOpacity,
  View, ScrollView, Pressable,
} from 'react-native';
import { LinearGradient }                    from 'expo-linear-gradient';
import { SafeAreaView }                      from 'react-native-safe-area-context';
import { BlurView }                          from 'expo-blur';
import { Ionicons }                          from '@expo/vector-icons';
import { useRouter }                         from 'expo-router';
import { StatusBar }                         from 'expo-status-bar';

import { supabase }    from '@/lib/supabase';
import { useAuth }     from '../../contexts/AuthContext';

import GalaxyBackground                      from '../../components/social/GalaxyBackground';
import { ImageWithFallback }                 from '../../components/profile/ImageWithFallback';
import { FavCard, CritiqueCard, SeenCard, ReelCard } from '../../components/profile/Card';
import {
  SectionHeader, HScrollRow, EmptyState, StatColumn,
} from '../../components/profile/Section';
import {
  G, H_PADDING, HEADER_SCROLL_DISTANCE,
  CARD_W, CARD_H, NUM_W, NUM_OVERLAP, NUM_ITEM_W, CARD_GAP,
} from '../../components/profile/theme';
import { DEFAULT_REVIEWS, poster } from '../../components/profile/data';
import type { FilmItem, ReviewItem, ReelItem } from '../../components/profile/data';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type GridTab = 0 | 1 | 2;

const TAB_ICONS: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { icon: 'grid-outline',          label: 'Films'  },
  { icon: 'play-circle-outline',   label: 'Créas'  },
  { icon: 'person-circle-outline', label: 'Tags'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZER — public.films → FilmItem
// ─────────────────────────────────────────────────────────────────────────────
function normalizeFilm(row: Record<string, any>): FilmItem & { dbId: number } {
  const imgRaw = row.image ?? row.poster_url ?? null;
  let posterUrl = '';
  if (imgRaw) {
    if (imgRaw.startsWith('http')) {
      posterUrl = imgRaw;
    } else {
      const { data } = supabase.storage.from('community-images').getPublicUrl(imgRaw);
      posterUrl = data?.publicUrl ?? poster(String(row.title ?? ''));
    }
  } else {
    posterUrl = poster(String(row.title ?? ''));
  }

  const rawRating = row.rating ?? row.score ?? 0;
  const rating    = Math.min(5, Math.max(0, Number(rawRating) || 0));

  return {
    dbId:     Number(row.id),
    id:       String(row.id),
    title:    String(row.title ?? '—'),
    posterUrl,
    genre:    String(row.genre ?? '—'),
    type:     row.category === 'Mini-série' ? 'série' : 'film',
    director: row.director ? String(row.director) : undefined,
    year:     row.year ? Number(row.year) : undefined,
    rating,
    episodes: row.episodes ?? undefined,
    status:   undefined,
    duration: row.duration ? Number(row.duration) : undefined,
    likes:    Number(row.likes ?? row.likes_count ?? 0),
  };
}

function normalizeReelItem(row: Record<string, any>): ReelItem & { dbId: number } {
  const film = normalizeFilm(row);
  const dur  = row.duration ? `${row.duration} min` : '';
  const views = row.views_count ? `${Math.round(row.views_count / 1000)}K` : '—';
  return {
    dbId:     film.dbId,
    id:       film.id,
    title:    film.title,
    posterUrl: film.posterUrl,
    festival: row.category ?? 'Festival',
    duration: dur,
    views,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Films favoris — les N films les plus likés de public.films */
async function fetchFavorites(limit = 20): Promise<Array<FilmItem & { dbId: number }>> {
  const { data, error } = await supabase
    .from('films')
    .select('id, title, image, poster_url, genre, category, director, year, rating, duration, likes, likes_count')
    .order('likes', { ascending: false })
    .limit(limit);
  if (error || !data?.length) return [];
  return data.map(normalizeFilm);
}

/** Films déjà vus pour l'utilisateur courant */
async function fetchSeenFilms(userId: string): Promise<Array<FilmItem & { dbId: number }>> {
  // Si une table de watchlist existe, on l'utilise.
  // Sinon on retombe sur les films généraux triés par note.
  try {
    const { data: watchlist } = await supabase
      .from('seen_films')
      .select('film_id, rating_override')
      .eq('user_id', userId)
      .limit(30);

    if (watchlist?.length) {
      const ids = watchlist.map((w: any) => w.film_id);
      const { data: films } = await supabase
        .from('films')
        .select('id, title, image, poster_url, genre, category, director, year, rating, duration, likes')
        .in('id', ids)
        .limit(30);
      if (films?.length) {
        return films.map((f: any) => {
          const overrideEntry = watchlist.find((w: any) => w.film_id === f.id);
          return normalizeFilm({
            ...f,
            rating: overrideEntry?.rating_override ?? f.rating,
            status: 'Vu',
          });
        });
      }
    }
  } catch { /* pas de table seen_films → fallback */ }

  // Fallback : derniers films de la BDD
  const { data } = await supabase
    .from('films')
    .select('id, title, image, poster_url, genre, category, director, year, rating, duration')
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []).map(r => normalizeFilm({ ...r, status: 'Vu' }));
}

/** Critiques de l'utilisateur */
async function fetchUserReviews(userId: string): Promise<ReviewItem[]> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (!isUUID) return DEFAULT_REVIEWS;

  const { data, error } = await supabase
    .from('critiques_with_profile')
    .select('id, user_id, reel_id, film_title, title, content, rating, likes_count, created_at')
    .eq('user_id', userId)
    .order('likes_count', { ascending: false })
    .limit(20);

  if (error || !data?.length) return DEFAULT_REVIEWS;

  return data.map((c: any): ReviewItem => {
    const filmTitle = String(c.title ?? c.film_title ?? '—');
    return {
      id:      String(c.id),
      filmId:  String(c.reel_id ?? c.id),
      content: String(c.content ?? ''),
      rating:  Number(c.rating) || 0,
      likes:   Number(c.likes_count ?? 0),
      date:    c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
      film: {
        id:       String(c.reel_id ?? c.id),
        title:    filmTitle,
        posterUrl: poster(filmTitle),
        genre:    '—',
        type:     'film',
      },
    };
  });
}

/** Courts métrages (duration < 60) depuis public.films */
async function fetchCourtMetrages(limit = 15): Promise<Array<ReelItem & { dbId: number }>> {
  const { data } = await supabase
    .from('films')
    .select('id, title, image, poster_url, genre, category, director, year, duration, views_count, likes')
    .lt('duration', 60)
    .order('likes', { ascending: false })
    .limit(limit);
  return (data ?? []).map(normalizeReelItem);
}

/** Moyens métrages (60 ≤ duration ≤ 100) */
async function fetchMoyenMetrages(limit = 15): Promise<Array<ReelItem & { dbId: number }>> {
  const { data } = await supabase
    .from('films')
    .select('id, title, image, poster_url, genre, category, director, year, duration, views_count, likes')
    .gte('duration', 60)
    .lte('duration', 100)
    .order('likes', { ascending: false })
    .limit(limit);
  return (data ?? []).map(normalizeReelItem);
}

/** Mini-séries (category = 'Mini-série') */
async function fetchMiniSeries(limit = 15): Promise<Array<ReelItem & { dbId: number }>> {
  const { data } = await supabase
    .from('films')
    .select('id, title, image, poster_url, genre, category, director, year, duration, views_count, likes')
    .eq('category', 'Mini-série')
    .order('likes', { ascending: false })
    .limit(limit);
  return (data ?? []).map(normalizeReelItem);
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonSection = memo(function SkeletonSection({ accentColor = G.primary }: { accentColor?: string }) {
  return (
    <View>
      <View style={sk.header}>
        <View style={[sk.iconBox, { backgroundColor: `${accentColor}14` }]} />
        <View style={sk.titleBar} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: H_PADDING, paddingRight: H_PADDING, gap: CARD_GAP }}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', width: NUM_ITEM_W }}>
            <View style={sk.numCol}><View style={sk.ghostNum} /></View>
            <View style={[sk.ghostCard, { marginLeft: -NUM_OVERLAP }]}>
              <ImageWithFallback uri="" style={{ flex: 1 }} fallbackColors={[G.surface, G.bg]} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const sk = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: H_PADDING, paddingTop: 22, paddingBottom: 12 },
  iconBox:   { width: 26, height: 26, borderRadius: 9 },
  titleBar:  { height: 12, width: 120, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' },
  numCol:    { width: NUM_W, height: CARD_H, justifyContent: 'flex-start', paddingTop: 6 },
  ghostNum:  { height: 68, width: 38, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, alignSelf: 'flex-end' },
  ghostCard: { width: CARD_W, height: CARD_H, borderRadius: 13, backgroundColor: G.surface, overflow: 'hidden' },
});

// ─────────────────────────────────────────────────────────────────────────────
// RANKED ITEM — overlay du numéro de rang, sans "0"
// ─────────────────────────────────────────────────────────────────────────────
type RankedItemProps = { rank: number; children: React.ReactNode; accentColor?: string };

const RANK_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

const RankedItem = memo(function RankedItem({ rank, children, accentColor }: RankedItemProps) {
  // Ne pas afficher de chiffre si rank < 1 (valeur invalide)
  if (rank < 1) return <>{children}</>;
  const color = accentColor ?? RANK_COLORS[rank] ?? 'rgba(255,255,255,0.7)';
  return (
    <View style={ri.wrap}>
      <View style={ri.badge} pointerEvents="none">
        <Text style={[ri.rankTxt, { color, fontSize: rank < 10 ? 52 : 38 }]}>
          {rank}
        </Text>
      </View>
      {children}
    </View>
  );
});

const ri = StyleSheet.create({
  wrap:    { position: 'relative' },
  badge:   { position: 'absolute', top: 4, left: 5, zIndex: 30 },
  rankTxt: { fontWeight: '900', letterSpacing: -2, opacity: 0.88, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STAR ROW
// ─────────────────────────────────────────────────────────────────────────────
const StarRatingRow = memo(function StarRatingRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1.5 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Ionicons key={s} name={s <= rating ? 'star' : 'star-outline'} size={9} color={G.gold} />
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const [activeTab,    setActiveTab]    = useState<GridTab>(0);
  const [favorites,    setFavorites]    = useState<Array<FilmItem & { dbId: number }>>([]);
  const [seenFilms,    setSeenFilms]    = useState<Array<FilmItem & { dbId: number }>>([]);
  const [reviews,      setReviews]      = useState<ReviewItem[]>([]);
  const [courtMetrages, setCourtMetrages] = useState<Array<ReelItem & { dbId: number }>>([]);
  const [moyenMetrages, setMoyenMetrages] = useState<Array<ReelItem & { dbId: number }>>([]);
  const [miniSeries,    setMiniSeries]    = useState<Array<ReelItem & { dbId: number }>>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 1], extrapolate: 'clamp',
  });

  // ── Navigation film ────────────────────────────────────────────────────────
  const goFilm = useCallback((id: number | string) => {
    router.push(`/film/${id}`);
  }, [router]);

  // ── Chargement des données ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [favs, seen, revs, courts, moyens, minis] = await Promise.all([
        fetchFavorites(20),
        fetchSeenFilms(user.id),
        fetchUserReviews(user.id),
        fetchCourtMetrages(15),
        fetchMoyenMetrages(15),
        fetchMiniSeries(15),
      ]);
      setFavorites(favs);
      setSeenFilms(seen);
      setReviews(revs);
      setCourtMetrages(courts);
      setMoyenMetrages(moyens);
      setMiniSeries(minis);
    } catch (e) {
      console.warn('[Profile] loadData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Dérivés ────────────────────────────────────────────────────────────────
  const sortedReviews = useMemo(
    () => [...reviews].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)),
    [reviews],
  );

  const fmt = useCallback((n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
    return `${n}`;
  }, []);

  if (!user) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 0 — Films
  // ─────────────────────────────────────────────────────────────────────────
  function renderMainContent() {
    if (loading) {
      return (
        <View>
          <SkeletonSection accentColor={G.gold}  />
          <SkeletonSection accentColor={G.amber} />
          <SkeletonSection accentColor={G.cyan}  />
          <View style={{ height: 80 }} />
        </View>
      );
    }

    return (
      <View>
        {/* ── Films favoris ── */}
        <SectionHeader
          icon="trophy"
          label="Films favoris"
          subtitle="Les œuvres les plus aimées"
          count={favorites.length}
          accentColor={G.gold}
          onViewAll={() => router.push('/profile/favorites' as any)}
        />
        {favorites.length === 0 ? (
          <EmptyState icon="heart-outline" text="Aucun favori" subtext="Aucun film dans la base" />
        ) : (
          <HScrollRow>
            {favorites.map((film, idx) => (
              <RankedItem
                key={film.id}
                rank={idx + 1}
                accentColor={RANK_COLORS[idx + 1]}
              >
                {/* rank passé réellement → plus de "0" */}
                <FavCard
                  film={film}
                  rank={idx + 1}
                  onPress={() => goFilm(film.dbId)}
                />
              </RankedItem>
            ))}
          </HScrollRow>
        )}

        <View style={pg.divider} />

        {/* ── Critiques ── */}
        <SectionHeader
          icon="pencil"
          label="Critiques"
          subtitle="Classées par popularité"
          accentColor={G.amber}
          onViewAll={() => router.push('/profile/reviews' as any)}
        />
        {sortedReviews.length === 0 ? (
          <EmptyState icon="chatbubble-outline" text="Aucune critique publiée" />
        ) : (
          <HScrollRow>
            {sortedReviews.map(rev => (
              <CritiqueCard
                key={rev.id}
                review={rev}
                onPress={() => router.push(`/review/${rev.id}` as any)}
              />
            ))}
          </HScrollRow>
        )}

        <View style={pg.divider} />

        {/* ── Films & Séries vus ── */}
        <SectionHeader
          icon="eye"
          label="Films & Séries visionnés"
          subtitle="Classés par note"
          accentColor={G.cyan}
          onViewAll={() => router.push('/profile/seen_films' as any)}
        />
        {seenFilms.length === 0 ? (
          <EmptyState icon="film-outline" text="Aucun visionnage" subtext="Marque des films comme vus" />
        ) : (
          <HScrollRow>
            {seenFilms.map(film => (
              /* Cliquable → /film/:id */
              <SeenCard
                key={film.id}
                film={film}
                onPress={() => goFilm(film.dbId)}
              />
            ))}
          </HScrollRow>
        )}

        <View style={{ height: 110 }} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1 — Créas (courts / moyens / mini-séries depuis public.films)
  // ─────────────────────────────────────────────────────────────────────────
  function renderReelsContent() {
    if (loading) {
      return (
        <View>
          <SkeletonSection accentColor={G.primary} />
          <SkeletonSection accentColor={G.primary} />
          <SkeletonSection accentColor={G.primary} />
          <View style={{ height: 80 }} />
        </View>
      );
    }

    const sections = [
      {
        label:    'Courts métrages',
        subtitle: '< 60 min',
        icon:     'videocam' as const,
        data:     courtMetrages,
        route:    '/profile/courts' as any,
      },
      {
        label:    'Moyens métrages',
        subtitle: '60 – 100 min',
        icon:     'tv' as const,
        data:     moyenMetrages,
        route:    '/profile/moyens' as any,
      },
      {
        label:    'Mini-séries',
        subtitle: 'Catégorie Mini-série',
        icon:     'film' as const,
        data:     miniSeries,
        route:    '/profile/mini-series' as any,
      },
    ];

    return (
      <View>
        {sections.map((sec, si) => (
          <View key={sec.label}>
            <SectionHeader
              icon={sec.icon}
              label={sec.label}
              subtitle={sec.subtitle}
              accentColor={G.primary}
              onViewAll={() => router.push(sec.route)}
            />
            {sec.data.length === 0 ? (
              <EmptyState icon="film-outline" text={`Aucun ${sec.label.toLowerCase()}`} />
            ) : (
              <HScrollRow paddingBottom={8}>
                {sec.data.map(item => (
                  /* Chaque card ouvre /film/:id */
                  <ReelCard
                    key={item.id}
                    reel={item}
                    onPress={() => goFilm((item as any).dbId ?? item.id)}
                  />
                ))}
              </HScrollRow>
            )}
            {si < sections.length - 1 && <View style={pg.divider} />}
          </View>
        ))}
        <View style={{ height: 110 }} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={pg.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Sticky bar */}
      <Animated.View pointerEvents="none" style={[pg.stickyBar, { opacity: headerOpacity }]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['top']} style={pg.stickyInner}>
          <Text style={pg.stickyUser}>{user.username}</Text>
        </SafeAreaView>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={G.primary}
          />
        }
      >
        <SafeAreaView edges={['top']}>
          <LinearGradient
            colors={['rgba(13,13,18,0.55)', 'transparent']}
            style={pg.topGradient}
            pointerEvents="none"
          />

          {/* Top nav */}
          <View style={pg.topNav}>
            <View style={pg.topNavLeft}>
              <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.5)" />
              <Text style={pg.topNavUser}>{user.username}</Text>
              <Ionicons name="chevron-down" size={11} color="rgba(255,255,255,0.4)" />
            </View>
            <View style={pg.topNavRight}>
              <TouchableOpacity style={pg.navIconBtn} onPress={() => router.push('/notifications' as any)}>
                <Ionicons name="notifications-outline" size={21} color="rgba(255,255,255,0.85)" />
                <View style={pg.notifDot} />
              </TouchableOpacity>
              <TouchableOpacity style={pg.navIconBtn} onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={21} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar + Stats */}
          <View style={pg.avatarRow}>
            <View style={pg.avatarWrap}>
              <ImageWithFallback
                uri={user.avatar_url ?? `https://i.pravatar.cc/150?u=${user.id}`}
                style={pg.avatar}
                fallbackColors={[G.surface, G.bg]}
              />
              <View style={pg.avatarRing} pointerEvents="none" />
            </View>
            <View style={pg.statsRow}>
              <StatColumn value={`${seenFilms.length}`} label="films" />
              <View style={pg.statDivider} />
              <StatColumn value={`${reviews.length}`} label="critiques" />
              <View style={pg.statDivider} />
              <StatColumn value={fmt(user.following_count ?? 0)} label="abonnements" />
            </View>
          </View>

          {/* Role + Bio */}
          <View style={pg.bioRow}>
            <BlurView intensity={20} tint="dark" style={pg.rolePill}>
              <Text style={pg.rolePillTxt}>
                {user.role === 'critic'   ? '✍️ Critique'
                  : user.role === 'creator' ? '⭐ Créateur·rice'
                  : '🎬 Cinéphile'}
              </Text>
            </BlurView>
            <Pressable style={pg.editBtn} onPress={() => router.push('/profile/edit' as any)}>
              <Text style={pg.editBtnTxt}>Modifier</Text>
            </Pressable>
          </View>

          <View style={pg.glowSep} />
        </SafeAreaView>

        {/* Tab bar */}
        <View style={pg.tabBar}>
          {TAB_ICONS.map(({ icon, label }, idx) => {
            const active = activeTab === idx;
            return (
              <TouchableOpacity
                key={icon}
                style={pg.tabItem}
                onPress={() => setActiveTab(idx as GridTab)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={active ? (icon.replace('-outline', '') as any) : icon}
                  size={20}
                  color={active ? G.primary : 'rgba(255,255,255,0.28)'}
                />
                <Text style={[pg.tabLabel, active && pg.tabLabelActive]}>{label}</Text>
                {active && <View style={[pg.tabIndicator, { backgroundColor: G.primary }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Contenu par tab */}
        {activeTab === 0 && renderMainContent()}
        {activeTab === 1 && renderReelsContent()}
        {activeTab === 2 && (
          <EmptyState
            icon="pricetag-outline"
            text="Aucun tag"
            subtext="Les films où vous êtes tagué apparaissent ici"
          />
        )}
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const pg = StyleSheet.create({
  root:        { flex: 1, backgroundColor: G.bg },
  stickyBar:   { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  stickyInner: { alignItems: 'center', paddingBottom: 10, paddingTop: 4 },
  stickyUser:  { color: G.text, fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },

  topNav:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: H_PADDING, paddingVertical: 10 },
  topNavLeft:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  topNavRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topNavUser:  { fontSize: 17, fontWeight: '800', color: G.text, letterSpacing: -0.2 },
  navIconBtn:  { padding: 6, position: 'relative' },
  notifDot:    { position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: 3.5, backgroundColor: G.primary, borderWidth: 1.5, borderColor: G.bg },

  avatarRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: H_PADDING, marginTop: 6, gap: 16 },
  avatarWrap:  { position: 'relative' },
  avatar:      { width: 84, height: 84, borderRadius: 42 },
  avatarRing:  { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 44, borderWidth: 2, borderColor: 'rgba(191,95,255,0.4)' },

  statsRow:    { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.07)' },

  bioRow:      { paddingHorizontal: H_PADDING, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rolePill:    { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3.5, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(191,95,255,0.30)' },
  rolePillTxt: { color: 'rgba(255,255,255,0.88)', fontSize: 10, fontWeight: '700' },
  editBtn:     { marginLeft: 'auto', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' },
  editBtnTxt:  { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },

  glowSep:     { height: 1, marginTop: 16, backgroundColor: 'rgba(191,95,255,0.14)', shadowColor: G.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 },
  divider:     { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginTop: 20 },

  tabBar:          { flexDirection: 'row', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', marginTop: 4 },
  tabItem:         { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3, position: 'relative' },
  tabLabel:        { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.28)', letterSpacing: 0.5, textTransform: 'uppercase' },
  tabLabelActive:  { color: G.primary },
  tabIndicator:    { position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
});