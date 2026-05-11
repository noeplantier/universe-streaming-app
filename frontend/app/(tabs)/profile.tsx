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
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { seenAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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
  OWN_EPISODES_MID,
  OWN_EPISODES_LONG,
  poster,
  type FilmItem,
  type ReviewItem,
} from '../../components/profile/data';

import { resolveWorkIdByTitleYear, supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
type GridTab = 0 | 1 | 2;

const TAB_ICONS: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { icon: 'grid-outline',           label: 'Films'   },
  { icon: 'play-circle-outline',    label: 'Créas'   },
  { icon: 'person-circle-outline',  label: 'Tags'    },
];

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ STAR ROW
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
// 🦴 SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonSection = memo(({ accentColor = G.primary }: { accentColor?: string }) => (
  <View>
    {/* skeleton header */}
    <View style={sk.header}>
      <View style={[sk.iconBox, { backgroundColor: `${accentColor}14` }]} />
      <View style={sk.titleBar} />
    </View>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingLeft: H_PADDING, paddingRight: H_PADDING, gap: CARD_GAP }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', width: NUM_ITEM_W }}>
          {/* ghost number */}
          <View style={sk.numCol}>
            <View style={sk.ghostNum} />
          </View>
          {/* ghost card */}
          <View style={[sk.ghostCard, { marginLeft: -NUM_OVERLAP }]}>
            <ImageWithFallback uri="" style={{ flex: 1 }} fallbackColors={[G.surface, G.bg]} />
          </View>
        </View>
      ))}
    </ScrollView>
  </View>
));
SkeletonSection.displayName = 'SkeletonSection';

const sk = StyleSheet.create({
  header:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: H_PADDING, paddingTop: 22, paddingBottom: 12 },
  iconBox:  { width: 26, height: 26, borderRadius: 9 },
  titleBar: { height: 12, width: 120, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' },
  numCol:   { width: NUM_W, height: CARD_H, justifyContent: 'flex-start', paddingTop: 6 },
  ghostNum: { height: 68, width: 38, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, alignSelf: 'flex-end' },
  ghostCard: { width: CARD_W, height: CARD_H, borderRadius: 13, backgroundColor: G.surface, overflow: 'hidden' },
});


const wd = StyleSheet.create({
  row:        { flexDirection: 'row', paddingHorizontal: H_PADDING, gap: 8, marginTop: 14 },
  card:       { flex: 1, borderRadius: 14, overflow: 'hidden', paddingVertical: 9, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center', gap: 3 },
  streakCard: { borderColor: 'rgba(255,160,30,0.18)' },
  cardInner:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardVal:    { color: G.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  cardLabel:  { color: 'rgba(255,255,255,0.42)', fontSize: 9, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  streakEmoji:{ fontSize: 12 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📌 RANKED CARD ITEM — chiffre positionné en haut à gauche, overlapping
// ─────────────────────────────────────────────────────────────────────────────
type RankedItemProps = {
  rank: number;
  children: React.ReactNode;
  accentColor?: string;
};

const RankedItem = memo(({ rank, children, accentColor = 'rgba(255,255,255,0.9)' }: RankedItemProps) => (
  <View style={ri.wrap}>
    {/* Rank badge — top-left, overlapping the card */}
    <View style={ri.badge} pointerEvents="none">
     
        <Text style={[ri.rankTxt, { color: accentColor }]}>{rank}</Text>
    </View>
    {children}
  </View>
));
RankedItem.displayName = 'RankedItem';

const ri = StyleSheet.create({
  wrap:      { position: 'relative' },
  badge:     { position: 'absolute', top: 6, left: 6, zIndex: 30, borderRadius: 8, overflow: 'hidden' },
  badgeGrad: { paddingHorizontal: 7, paddingVertical: 4 },
  rankTxt:   { fontSize: 60, fontWeight: '900', letterSpacing: -0.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🏠 PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const [activeTab,  setActiveTab]  = useState<GridTab>(0);
  const [reviews,    setReviews]    = useState<ReviewItem[]>([]);
  const [seenFilms,  setSeenFilms]  = useState<FilmItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Animated values ────────────────────────────────────────────────────────
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goFilm = useCallback(
    async (filmOrId: any) => {
      if (typeof filmOrId === 'number' || (typeof filmOrId === 'string' && /^\d+$/.test(filmOrId))) {
        router.push(`/film/${Number(filmOrId)}`);
        return;
      }
      const film = filmOrId as Partial<FilmItem> | undefined;
      if (!film?.title) return;

      const workId = await resolveWorkIdByTitleYear({
        title: String(film.title),
        year:  typeof film.year === 'number' ? film.year : undefined,
        type:  (film as any).type === 'série' ? 'série' : 'film',
      });
      if (workId) router.push(`/film/${workId}`);
    },
    [router],
  );

  // ── Data fetching ────────────────────────────────────────────────────────────
  const loadReviews = useCallback(async (uid: string) => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid);
    if (!isUUID) { setReviews(DEFAULT_REVIEWS); return; }

    const { data, error } = await supabase
      .from('critiques_with_profile')
      .select('id, user_id, reel_id, film_title, title, content, rating, likes_count, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) { setReviews(DEFAULT_REVIEWS); return; }

    const normalized: ReviewItem[] = (data ?? []).map((c: any) => {
      const filmTitle = String(c.title ?? c.film_title ?? '—');
      return {
        id:     String(c.id),
        filmId: String(c.reel_id ?? c.id),
        content: String(c.content ?? ''),
        rating:  c.rating == null ? 0 : Number(c.rating) || 0,
        likes:   
        (c.likes_count ?? 0),
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

    normalized.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    setReviews(normalized);
  }, []);

  const loadSeen = useCallback(async (uid: string) => {
    const seen = await seenAPI.getByUser(uid).catch(() => null);
    setSeenFilms(seen?.length ? seen : DEFAULT_SEEN);
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await Promise.all([loadReviews(user.id), loadSeen(user.id)]);
    } catch {
      setReviews(DEFAULT_REVIEWS);
      setSeenFilms(DEFAULT_SEEN);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, loadReviews, loadSeen]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const sortedReviews = useMemo(
    () => [...reviews].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)),
    [reviews],
  );

  const sortedSeen = useMemo(
    () => [...seenFilms].sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title)),
    [seenFilms],
  );

  const avgRating = useMemo(() => {
    const rated = reviews.filter((r) => r.rating > 0);
    if (!rated.length) return 0;
    return rated.reduce((s, r) => s + r.rating, 0) / rated.length;
  }, [reviews]);

  const fmt = useCallback((n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
    return `${n}`;
  }, []);

  if (!user) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // 📋 TAB 0 — Main
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

    return (
      <View>
        {/* ── SECTION 1 — Favoris ── */}
        <SectionHeader
          icon="trophy"
          label="Films favoris"
          subtitle="Tes œuvres préférées"
          count={ALL_FAVS.length}
          accentColor={G.gold}
          onViewAll={() => router.push('/profile/favorites' as any)}
        />

        {ALL_FAVS.length === 0 ? (
          <EmptyState icon="heart-outline" text="Aucun favori" subtext="Note des films 4★ ou plus" />
        ) : (
          <HScrollRow>
            {ALL_FAVS.map((film, idx) => (
              <RankedItem
                key={String((film as any).workId ?? film.id)}
                rank={idx + 1}
                accentColor={idx === 0 ? G.gold : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : 'rgba(255,255,255,0.75)'}
              >
                <FavCard film={film} onPress={() => goFilm(film)} />
              </RankedItem>
            ))}
          </HScrollRow>
        )}

        <View style={pg.divider} />

        {/* ── SECTION 2 — Critiques ── */}
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
            {sortedReviews.map((rev, idx) => (
             
                <CritiqueCard
                  key={rev.id}
                  review={rev}
                  rank={idx + 1}
                  onPress={() => router.push(`/review/${rev.id}` as any)}
                />
        
            ))}
          </HScrollRow>
        )}

        <View style={pg.divider} />

        {/* ── SECTION 3 — Vus ── */}
        <SectionHeader
          icon="eye"
          label="Films & Séries visionnés"
          subtitle="Classés par note"
          accentColor={G.cyan}
          onViewAll={() => router.push('/profile/seen_films' as any)}
        />

        {sortedSeen.length === 0 ? (
          <EmptyState icon="film-outline" text="Aucun visionnage" subtext="Marque des films comme vus" />
        ) : (
          <HScrollRow>
            {sortedSeen.map((film, idx) => (
              <SeenCard
                key={film.id}
                film={film}
                rank={idx + 1}
                onPress={() => goFilm(film as any)}
              />
            ))}
          </HScrollRow>
        )}

        <View style={{ height: 110 }} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🎬 TAB 1 — Créations
  // ─────────────────────────────────────────────────────────────────────────
  function renderReelsContent() {
    const sections = [
      { label: 'Courts métrages',  subtitle: 'Sélection festival', icon: 'videocam' as const, data: OWN_REELS,        route: '/profile/reels',         itemRoute: '/reel/'     },
      { label: 'Moyens métrages',  subtitle: 'Sélection festival', icon: 'tv'       as const, data: OWN_EPISODES_MID, route: '/profile/episodes-mid',  itemRoute: '/episode/' },
      { label: 'Mini-séries',   subtitle: 'Sélection festival', icon: 'film'     as const, data: OWN_EPISODES_LONG,route: '/profile/episodes-long', itemRoute: '/episode/' },
    ];

    return (
      <View>
        {sections.map((s, si) => (
          <View key={s.label}>
            <SectionHeader
              icon={s.icon}
              label={`Mes ${s.label.toLowerCase()}`}
              subtitle={s.subtitle}
              accentColor={G.primary}
              onViewAll={() => router.push(s.route as any)}
            />
            <HScrollRow paddingBottom={8}>
              {s.data.map((item) => (
                <ReelCard
                  key={item.id}
                  reel={item}
                  onPress={() => router.push(`${s.itemRoute}${item.id}` as any)}
                />
              ))}
            </HScrollRow>
            {si < sections.length - 1 && <View style={pg.divider} />}
          </View>
        ))}
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

      {/* ── Sticky top bar (appears on scroll) ── */}
      <Animated.View
        pointerEvents="none"
        style={[pg.stickyBar, { opacity: headerOpacity }]}
      >
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
          {/* Top gradient fade */}
          <LinearGradient
            colors={['rgba(13,13,18,0.55)', 'transparent']}
            style={pg.topGradient}
            pointerEvents="none"
          />

          {/* ── TOP NAV ── */}
          <View style={pg.topNav}>
            {/* LEFT — identity */}
            <View style={pg.topNavLeft}>
              <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.5)" />
              <Text style={pg.topNavUser}>{user.username}</Text>
              <Ionicons name="chevron-down" size={11} color="rgba(255,255,255,0.4)" />
            </View>

            {/* RIGHT — actions */}
            <View style={pg.topNavRight}>
              <TouchableOpacity style={pg.navIconBtn} onPress={() => router.push('/notifications' as any)}>
                <Ionicons name="notifications-outline" size={21} color="rgba(255,255,255,0.85)" />
                {/* unread dot */}
                <View style={pg.notifDot} />
              </TouchableOpacity>
              <TouchableOpacity testID="profile-settings-btn" style={pg.navIconBtn} onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={21} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── AVATAR + STATS ROW ── */}
          <View style={pg.avatarRow}>
            {/* Avatar */}
            <View style={pg.avatarWrap}>
              <ImageWithFallback
                uri={user.avatar_url ?? `https://i.pravatar.cc/150?u=${user.id}`}
                style={pg.avatar}
                fallbackColors={[G.surface, G.bg]}
              />
              <View style={pg.avatarRing} pointerEvents="none" />
              {/* Online indicator */}
            </View>

            {/* Stats */}
            <View style={pg.statsRow}>
              <StatColumn
                value={`${user.films_seen_count ?? seenFilms.length}`}
                label="films"
              />
              <View style={pg.statDivider} />
              <StatColumn
                value={fmt(user.followers_count ?? 2840)}
                label="critiques"
              />
              <View style={pg.statDivider} />
              <StatColumn
                value={fmt(user.following_count ?? 318)}
                label="festivals"
              />
            </View>
          </View>

          {/* ── ROLE PILLS + BIO ── */}
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
            {/* Edit profile shortcut */}
            <Pressable
              style={pg.editBtn}
              onPress={() => router.push('/profile/edit' as any)}
            >
              <Text style={pg.editBtnTxt}>Modifier</Text>
            </Pressable>
          </View>


          {/* glow separator */}
          <View style={pg.glowSep} />
        </SafeAreaView>

        {/* ── TAB BAR ── */}
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

        {/* ── TAB CONTENT ── */}
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
  root: { flex: 1, backgroundColor: G.bg },

  // Sticky bar
  stickyBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
  },
  stickyInner: { alignItems: 'center', paddingBottom: 10, paddingTop: 4 },
  stickyUser:  { color: G.text, fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },

  // Top gradient
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },

  // Top nav — left/right split
  topNav: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: H_PADDING,
    paddingVertical: 10,
  },
  topNavLeft:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  topNavRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topNavUser:  { fontSize: 17, fontWeight: '800', color: G.text, letterSpacing: -0.2 },
  navIconBtn:  { padding: 6, position: 'relative' },
  notifDot:    {
    position: 'absolute', top: 5, right: 5,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: G.primary,
    borderWidth: 1.5, borderColor: G.bg,
  },

  // Avatar row
  avatarRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: H_PADDING, marginTop: 6, gap: 16 },
  avatarWrap:  { position: 'relative' },
  avatar:      { width: 84, height: 84, borderRadius: 42 },
  avatarRing:  {
    position: 'absolute', top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 44, borderWidth: 2, borderColor: 'rgba(191,95,255,0.4)',
  },
  onlineDot:   {
    position: 'absolute', bottom: 3, right: 3,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#34D399',
    borderWidth: 2, borderColor: G.bg,
  },

  // Stats
  statsRow:    { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.07)' },

  // Bio row
  bioRow:      { paddingHorizontal: H_PADDING, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rolePill:    {
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3.5,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(191,95,255,0.30)',
  },
  rolePillTxt: { color: 'rgba(255,255,255,0.88)', fontSize: 10, fontWeight: '700' },
  editBtn:     {
    marginLeft: 'auto', paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  editBtnTxt: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },

  // Separators
  glowSep: {
    height: 1, marginTop: 16,
    backgroundColor: 'rgba(191,95,255,0.14)',
    shadowColor: G.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 4,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginTop: 20 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5, borderBottomWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    marginTop: 4,
  },
  tabItem:       { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3, position: 'relative' },
  tabLabel:      { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.28)', letterSpacing: 0.5, textTransform: 'uppercase' },
  tabLabelActive:{ color: G.primary },
  tabIndicator:  { position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
});