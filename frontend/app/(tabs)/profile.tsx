import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { reviewsAPI, seenAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ── Local components ──────────────────────────────────────────────────────────
import GalaxyBackground from '../../components/social/GalaxyBackground';
import { ImageWithFallback } from '../../components/profile/ImageWithFallback';
import { FavCard, CritiqueCard, SeenCard, ReelCard } from '../../components/profile/Card';
import {
  SectionHeader,
  HScrollRow,
  EmptyState,
  StatColumn,
} from '../../components/profile/Section';

import {
  G,
  H_PADDING,
  HEADER_SCROLL_DISTANCE,
  CARD_W,
  CARD_H,
  NUM_W,
  NUM_OVERLAP,
  NUM_ITEM_W,
  CARD_GAP,
} from '../../components/profile/theme';

import {
  ALL_FAVS,
  DEFAULT_REVIEWS,
  DEFAULT_SEEN,
  OWN_REELS,
  poster, // ✅ important (pas de thumbnail_url -> on génère une image)
  type FilmItem,
  type ReviewItem,
} from '../../components/profile/data';

import { resolveWorkIdByTitleYear } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/create/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ STAR RATING (inline — small helper, no separate file needed)
// ─────────────────────────────────────────────────────────────────────────────
const StarRatingRow = memo(({ rating }: { rating: number }) => (
  <View style={{ flexDirection: 'row', gap: 1.5 }}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Ionicons
        key={s}
        name={s <= rating ? 'star' : 'star-outline'}
        size={9}
        color={G.gold}
      />
    ))}
  </View>
));
StarRatingRow.displayName = 'StarRatingRow';

// ─────────────────────────────────────────────────────────────────────────────
// 🔵 TAB BAR ICON
// ─────────────────────────────────────────────────────────────────────────────
type GridTab = 0 | 1 | 2;
const TAB_ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  'grid-outline',
  'play-circle-outline',
  'person-circle-outline',
];

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 SKELETON PLACEHOLDER — horizontal scroll of ghost cards
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonSection = memo(({ accentColor = G.primary }: { accentColor?: string }) => (
  <View>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: H_PADDING,
        paddingTop: 22,
        paddingBottom: 12,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 9,
          backgroundColor: `${accentColor}14`,
        }}
      />
      <View
        style={{
          height: 12,
          width: 120,
          borderRadius: 6,
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      />
    </View>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingLeft: H_PADDING,
        paddingRight: H_PADDING,
        gap: CARD_GAP,
      }}
    >
      {[...Array(4)].map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', width: NUM_ITEM_W }}>
          {/* Ghost number */}
          <View style={{ width: NUM_W, height: CARD_H, justifyContent: 'flex-end', paddingBottom: 6 }}>
            <View
              style={{
                height: 68,
                width: 38,
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 6,
                alignSelf: 'flex-end',
              }}
            />
          </View>

          {/* Ghost card */}
          <View
            style={{
              marginLeft: -NUM_OVERLAP,
              width: CARD_W,
              height: CARD_H,
              borderRadius: 13,
              backgroundColor: G.surface,
              overflow: 'hidden',
            }}
          >
            <ImageWithFallback uri="" style={{ flex: 1 }} fallbackColors={[G.surface, G.bg]} />
          </View>
        </View>
      ))}
    </ScrollView>
  </View>
));
SkeletonSection.displayName = 'SkeletonSection';

// ─────────────────────────────────────────────────────────────────────────────
// 🏠 PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<GridTab>(0);

  // Critiques (compat CritiqueCard via ReviewItem)
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [seenFilms, setSeenFilms] = useState<FilmItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goFilm = useCallback(
    async (filmOrId: any) => {
      if (typeof filmOrId === 'number') {
        router.push(`/film/${filmOrId}`);
        return;
      }
      if (typeof filmOrId === 'string' && /^\d+$/.test(filmOrId)) {
        router.push(`/film/${Number(filmOrId)}`);
        return;
      }

      const film = filmOrId as Partial<FilmItem> | undefined;
      if (!film?.title) return;

      const workId = await resolveWorkIdByTitleYear({
        title: String(film.title),
        year: typeof film.year === 'number' ? film.year : undefined,
        type: (film as any).type === 'série' ? 'série' : 'film',
      });

      if (!workId) return;
      router.push(`/film/${workId}`);
    },
    [router],
  );

  // ── Fetch critiques + reels (pour reconstruire review.film) ────────────
  const loadReviewsFromSupabase = useCallback(async (uid: string) => {
    setLoading(true);

    // ✅ Sécurité : Empêche la requête Supabase si l'ID n'est pas un UUID valide (ex: données mockées)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid);
    if (!isUUID) {
      console.warn("UID invalide (non-UUID), utilisation des données par défaut.");
      setReviews(DEFAULT_REVIEWS);
      setLoading(false);
      return;
    }
  
    const { data, error } = await supabase
      .from('critiques_with_profile')
      .select(`
        id,
        user_id,
        reel_id,
        film_title,
        title,
        content,
        rating,
        likes_count,
        created_at
      `)
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
  
    if (error) {
      console.error('loadReviewsFromSupabase error:', error);
      setReviews(DEFAULT_REVIEWS);
      setLoading(false);
      return;
    }
  
    const normalized: ReviewItem[] = (data ?? []).map((c: any) => {
      const filmTitle = String(c.title ?? c.film_title ?? '—');
  
      return {
        id: String(c.id),
        filmId: String(c.reel_id ?? c.id),
  
        // ✅ Match CritiqueCard (ReviewItem)
        content: String(c.content ?? ''),
        rating:
          c.rating === null || c.rating === undefined
            ? 0
            : typeof c.rating === 'number'
              ? c.rating
              : Number(c.rating) || 0,
  
        likes: Number(c.likes_count ?? 0),
  
        date: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
  
        film: {
          id: String(c.reel_id ?? c.id),
          title: filmTitle,
  
          // ✅ tu n'as pas thumbnail_url => on génère depuis ton helper
          posterUrl: poster(filmTitle),
  
          genre: '—',
          type: 'film',
        },
      };
    });
  
    // ✅ rank par likes desc si tu veux le classement identique à ton UI
    normalized.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
  
    setReviews(normalized);
    setLoading(false);
  }, []);

  const loadSeen = useCallback(async (uid: string) => {
    const seen = await seenAPI.getByUser(uid).catch(() => null);
    setSeenFilms(seen?.length ? seen : DEFAULT_SEEN);
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      await Promise.all([
        loadReviewsFromSupabase(user.id),
        loadSeen(user.id),
      ]);
    } catch {
      setReviews(DEFAULT_REVIEWS);
      setSeenFilms(DEFAULT_SEEN);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, loadReviewsFromSupabase, loadSeen]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Critiques triées par likes desc (définit rank)
  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
  }, [reviews]);

  // Seen triés par rating then title
  const sortedSeen = useMemo(
    () => [...seenFilms].sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title)),
    [seenFilms],
  );

  // ── Format stat numbers ───────────────────────────────────────────────────
  const fmt = useCallback((n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
    return `${n}`;
  }, []);

  // ── Animated header opacity ───────────────────────────────────────────────
  const stickyOp = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (!user) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // 🎬 TAB 0 — Main grid content
  // ─────────────────────────────────────────────────────────────────────────
  function renderMainContent() {
    if (loading) {
      return (
        <View>
          <SkeletonSection accentColor={G.gold} />
          <SkeletonSection accentColor={G.amber} />
          <SkeletonSection accentColor={G.cyan} />
          <View style={{ height: 80 }} />
        </View>
      );
    }

    // ⚠️ ta section "Films favoris" dans ton extrait ne dépend pas de critiquesAPI:
    // je garde ALL_FAVS comme dans ton fichier d’origine
    const favFilms = ALL_FAVS;

    return (
      <View>
        <SectionHeader
          icon="trophy"
          label="Films favoris"
          subtitle="Tes œuvres préférées classées"
          count={favFilms.length}
          accentColor={G.gold}
          onViewAll={() => router.push('/profile/favorites')}
        />

        {favFilms.length === 0 ? (
          <EmptyState icon="heart-outline" text="Aucun favori" subtext="Note des films 4★ ou plus" />
        ) : (
          <HScrollRow>
            {favFilms.map((film, idx) => (
              <View
                key={String((film as any).workId ?? film.id)}
                style={{ flexDirection: 'row', alignItems: 'flex-end', zIndex: 10 }}
              >
                <View style={{ marginRight: -NUM_OVERLAP, zIndex: 20, justifyContent: 'flex-end', paddingBottom: 30 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 60, fontWeight: '900' }}>
                    {idx + 1}
                  </Text>
                </View>
                <FavCard film={film} onPress={() => goFilm(film)} />
              </View>
            ))}
          </HScrollRow>
        )}

        <View style={pg.divider} />

        {/* SECTION 2 — ✍️ CRITIQUES */}
        <SectionHeader
          icon="pencil"
          label="Critiques"
          subtitle="Classées par popularité"
          accentColor={G.amber}
          onViewAll={() => router.push('/profile/reviews')}
        />

        {sortedReviews.length === 0 ? (
          <EmptyState icon="chatbubble-outline" text="Aucune critique publiée" />
        ) : (
          <HScrollRow>
            {sortedReviews.map((rev, idx) => (
              <View key={rev.id} style={{ zIndex: 10 }}>
                <CritiqueCard
                  review={rev}
                  rank={idx + 1}
                  onPress={() => router.push(`/review/${rev.id}` as any)}
                />
              </View>
            ))}
          </HScrollRow>
        )}

        <View style={pg.divider} />

        {/* SECTION 3 — 👁️ FILMS & SÉRIES VISIONNÉS */}
        <SectionHeader
          icon="eye"
          label="Films & Séries visionnés"
          subtitle="Classés par note"
          accentColor={G.cyan}
          onViewAll={() => router.push('/profile/seen')}
        />

        {sortedSeen.length === 0 ? (
          <EmptyState icon="film-outline" text="Aucun visionnage" subtext="Marque des films comme vus" />
        ) : (
          <HScrollRow>
            {sortedSeen.map((film) => (
              <View key={String((film as any).workId ?? film.id)} style={{ zIndex: 10 }}>
                <SeenCard film={film} onPress={() => goFilm(film as any)} />
              </View>
            ))}
          </HScrollRow>
        )}

        <View style={{ height: 110 }} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🎬 TAB 1 — Reels content
  // ─────────────────────────────────────────────────────────────────────────
  function renderReelsContent() {
    return (
      <View>
        <SectionHeader
          icon="videocam"
          label="Mes courts métrages"
          subtitle="Sélection festival"
          accentColor={G.primary}
          onViewAll={() => router.push('/profile/reels' as any)}
        />
        <HScrollRow paddingBottom={8}>
          {OWN_REELS.map((reel) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              onPress={() => router.push(`/reel/${reel.id}` as any)}
            />
          ))}
        </HScrollRow>
        <View style={{ height: 110 }} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🖼️ RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={pg.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

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
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={G.primary}
          />
        }
      >
        <SafeAreaView edges={['top']}>
          <LinearGradient
            colors={['rgba(13,13,18,0.55)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }}
            pointerEvents="none"
          />

          <View style={pg.topNav}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.68)" />
              <Text style={pg.topNavUser}>{user
.username}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.55)" />
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity testID="profile-settings-btn" style={pg.navBtn} onPress={() => router.push('/settings')}>
              <Ionicons name="settings" size={23} color={C.textTert} />
            </TouchableOpacity>
          </View>
          </View>

          {/* Avatar row */}
          <View style={pg.avatarRow}>
            <View style={pg.avatarWrap}>
              <ImageWithFallback
                uri={user.avatar_url ?? `https://i.pravatar.cc/150?u=${user.id}`}
                style={pg.avatar}
                fallbackColors={[G.surface, G.bg]}
              />
              <View style={pg.avatarRing} pointerEvents="none" />
            </View>

            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
              <StatColumn
                value={`${(user.films_seen_count ?? seenFilms.length)}`}
                label="films vus"
              />
              <StatColumn
                value={fmt(user.followers_count ?? 2840)}
                label="critiques"
                onPress={() => router.push('/followers' as any)}
              />
              <StatColumn
                value={fmt(user.following_count ?? 318)}
                label="festivals"
                onPress={() => router.push('/following' as any)}
              />
            </View>
          </View>

            {/* Bio */}
            <View style={pg.bioRow}>
            <BlurView intensity={20} tint="dark" style={pg.rolePill}>
              <Text style={pg.rolePillTxt}>
              {user.role === 'critic'
                ? '✍️ Critique'
                : user.role === 'creator'
                ? '⭐ Créateur·rice'
                : '🎬 Réalisateur·rice'}
              </Text>
            </BlurView>
            {(user as any).is_industry_contact && (
              <BlurView intensity={20} tint="dark" style={pg.rolePill}>
              <Text style={pg.rolePillTxt}>📧 Contactable</Text>
              </BlurView>
            )}
            </View>

            <View style={pg.glowSep} />
          </SafeAreaView>

        {/* Tab bar */}
        <View style={pg.tabBar}>
          {TAB_ICONS.map((icon, idx) => (
            <TouchableOpacity
              key={icon}
              style={pg.tabItem}
              onPress={() => setActiveTab(idx as GridTab)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={icon}
                size={22}
                color={activeTab === idx ? G.text : 'rgba(255,255,255,0.28)'}
              />
              {activeTab === idx && <View style={pg.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
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

const pg = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },


  stickyInner: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  stickyUser: { color: G.text, fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },

  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: H_PADDING, // Garde l'espacement à gauche
    paddingRight: 0,        // Retire l'espacement à droite
    paddingVertical: 10,
  },
  topNavUser: { fontSize: 17, fontWeight: '800', color: G.text, letterSpacing: -0.2 },
  navBtn: { 
    paddingVertical: 5,
    paddingLeft: 90,
  },

  avatarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: H_PADDING, marginTop: 6, gap: 16 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarRing: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 44, borderWidth: 2, borderColor: 'rgba(191,95,255,0.35)' },

  bioRow: { paddingHorizontal: H_PADDING, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  displayName: { color: G.text, fontSize: 14, fontWeight: '800' },
  rolePill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3.5, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(191,95,255,0.30)' },
  rolePillTxt: { color: 'rgba(255,255,255,0.88)', fontSize: 10, fontWeight: '700' },

  glowSep: { height: 1, marginTop: 16, backgroundColor: 'rgba(191,95,255,0.14)', shadowColor: G.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginTop: 20 },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.07)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(13,13,18,0.60)',
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 11, position: 'relative' },
  tabIndicator: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: G.text },
});