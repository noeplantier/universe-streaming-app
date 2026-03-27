import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import {
  COLORS,
  SPACING,
  RADIUS,
  GRADIENTS,
  GENRE_COLORS,
} from '../../constants/theme';
import { reviewsAPI, seenAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ─── Constants ──────────────────────────────────────────────────────────────
const { width, height } = Dimensions.get('window');
const CELL_SIZE = (width - 2) / 3; // 2px total gap between 3 columns
const GRID_GUTTER = 1;
const HEADER_MAX_HEIGHT = 300;
const HEADER_SCROLL_DISTANCE = 80;
const TABS = ['grid', 'play-circle', 'person-crop-circle'] as const; // icon names
type GridTab = 0 | 1 | 2;

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Review {
  id: string;
  film_id: string;
  content: string;
  rating: number;
  likes_count: number;
  created_at: string;
  film?: {
    id: string;
    title: string;
    poster_url: string;
    genre: string;
    duration_type: string;
  };
}

export interface Film {
  id: string;
  title: string;
  poster_url: string;
  genre: string;
  duration_type: string;
  rating: number;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Star rating row */
function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color="#FFD60A"
        />
      ))}
    </View>
  );
}

/** Empty placeholder */
function EmptyState({
  icon,
  text,
  subtext,
}: {
  icon: string;
  text: string;
  subtext?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={48} color={COLORS.textTertiary} />
      <Text style={styles.emptyText}>{text}</Text>
      {subtext && <Text style={styles.emptySubText}>{subtext}</Text>}
    </View>
  );
}

/** Instagram-style stat column */
function StatColumn({
  value,
  label,
  onPress,
}: {
  value: string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statColumn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Row 1 Cell – Top film (favorite #1) */
function TopFilmCell({
  film,
  onPress,
}: {
  film: Film | null;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.gridCell, { width: CELL_SIZE, height: CELL_SIZE * 1.25 }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {film ? (
        <Image
          source={{ uri: film.poster_url }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.gridCellPlaceholder]} />
      )}
      {/* Star sparkle */}
      <View style={styles.sparkleTopLeft}>
        <Text style={styles.sparkleEmoji}>✨</Text>
      </View>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
        style={styles.cellOverlay}
      >
        <Text style={styles.cellLabel}>Ton film préf</Text>
        {film && <StarRating rating={film.rating} size={10} />}
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** Row 1 Cell – Top 2 & 3 films */
function Top2FilmsCell({
  films,
  onPress,
}: {
  films: Film[];
  onPress: () => void;
}) {
  const film1 = films[0] ?? null;
  const film2 = films[1] ?? null;
  return (
    <TouchableOpacity
      style={[styles.gridCell, { width: CELL_SIZE, height: CELL_SIZE * 1.25 }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Split vertically */}
      <View style={styles.splitCell}>
        <View style={[styles.splitHalf, { borderBottomWidth: GRID_GUTTER, borderColor: COLORS.background }]}>
          {film1 ? (
            <Image source={{ uri: film1.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.gridCellPlaceholder]} />
          )}
          <View style={styles.rankBadge}><Text style={styles.rankText}>02</Text></View>
        </View>
        <View style={styles.splitHalf}>
          {film2 ? (
            <Image source={{ uri: film2.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.gridCellPlaceholder]} />
          )}
          <View style={styles.rankBadge}><Text style={styles.rankText}>03</Text></View>
        </View>
      </View>
      {/* Sparkle top */}
      <View style={styles.sparkleTopLeft}>
        <Text style={styles.sparkleEmoji}>⭐</Text>
      </View>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.78)']}
        style={[styles.cellOverlay, { paddingBottom: 8 }]}
      >
        <Text style={styles.cellLabel}>Tes 2 film préf</Text>
        <Text style={styles.cellSublabel}>après le 1</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** Row 1 Cell – Other favorites (mini grid) */
function OtherFavsCell({
  films,
  onPress,
}: {
  films: Film[];
  onPress: () => void;
}) {
  const displayed = films.slice(0, 4);
  return (
    <TouchableOpacity
      style={[styles.gridCell, { width: CELL_SIZE, height: CELL_SIZE * 1.25 }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* 2×2 micro grid */}
      <View style={styles.microGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.microCell,
              i % 2 === 0 ? { marginRight: GRID_GUTTER / 2 } : { marginLeft: GRID_GUTTER / 2 },
              i < 2 ? { marginBottom: GRID_GUTTER / 2 } : { marginTop: GRID_GUTTER / 2 },
            ]}
          >
            {displayed[i] ? (
              <Image
                source={{ uri: displayed[i].poster_url }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, styles.gridCellPlaceholder]} />
            )}
          </View>
        ))}
      </View>
      <View style={styles.sparkleTopLeft}>
        <Text style={styles.sparkleEmoji}>✦</Text>
      </View>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
        style={[styles.cellOverlay, { paddingBottom: 8 }]}
      >
        <Text style={styles.cellLabel}>T'es autres fav</Text>
        <Text style={styles.cellSublabel}>après ton top</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** Critique cell (row 2) */
function CritiqueCell({
  review,
  index,
  onPress,
}: {
  review: Review;
  index: number;
  onPress: () => void;
}) {
  const isWide = index === 0; // first critique takes 2/3 width
  const cellW = isWide ? CELL_SIZE * 2 + GRID_GUTTER : CELL_SIZE;
  return (
    <TouchableOpacity
      style={[styles.gridCell, { width: cellW, height: CELL_SIZE }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {review.film ? (
        <Image
          source={{ uri: review.film.poster_url }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.papyrusBackground]} />
      )}
      {/* Papyrus/parchment texture overlay */}
      <LinearGradient
        colors={['rgba(180,120,40,0.3)', 'rgba(100,60,10,0.55)']}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.cellOverlay}
      >
        <View style={styles.critiqueIconRow}>
          <Ionicons name="pencil" size={11} color="rgba(255,220,120,0.9)" />
          <Text style={styles.critiqueCellLabel}>Critique</Text>
        </View>
        {isWide && (
          <Text style={styles.critiqueSnippet} numberOfLines={2}>
            {review.content}
          </Text>
        )}
        <StarRating rating={review.rating} size={9} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** Seen film cell (row 3+) – standard square */
function SeenCell({ film, onPress }: { film: Film; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.gridCell, { width: CELL_SIZE, height: CELL_SIZE }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <Image
        source={{ uri: film.poster_url }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={styles.seenCheckBadge}>
        <Ionicons name="eye" size={9} color="#fff" />
      </View>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={styles.cellOverlayThin}
      >
        <Text style={styles.seenCellTitle} numberOfLines={1}>{film.title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Shimmer Skeleton ─────────────────────────────────────────
function Shimmer() {
  const translateX = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: 300,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A2E', overflow: 'hidden' }}>
      <Animated.View
        style={{
          width: '40%',
          height: '100%',
          backgroundColor: 'rgba(255,255,255,0.08)',
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}
// ── Prefetch + Optimistic Nav ─────────────────────────────
  const prefetched = useRef<Set<string>>(new Set());

  const prefetchFilm = useCallback((id: string) => {
    if (prefetched.current.has(id)) return;
    prefetched.current.add(id);

    // Warm screen (simulate prefetch)
    setTimeout(() => {
      router.push(`/film/${id}`);
      router.back();
    }, 0);
  }, []);

  const handleNavigateFilm = useCallback((id: string) => {
    // Optimistic navigation
    router.push(`/film/${id}`);
  }, []);

  // ── Replace loading UI ────────────────────────────────────
  function renderGridContent() {
    if (loading) {
      return (
        <View>
          {/* Row skeleton */}
          <View style={styles.gridRow}>
            <SkeletonCell style={{ width: CELL_SIZE, height: CELL_SIZE * 1.25 }} />
            <View style={{ width: GRID_GUTTER }} />
            <SkeletonCell style={{ width: CELL_SIZE, height: CELL_SIZE * 1.25 }} />
            <View style={{ width: GRID_GUTTER }} />
            <SkeletonCell style={{ width: CELL_SIZE, height: CELL_SIZE * 1.25 }} />
          </View>

          {[...Array(6)].map((_, i) => (
            <View key={i} style={{ marginTop: GRID_GUTTER }}>
              <View style={styles.gridRow}>
                {[...Array(3)].map((_, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <View style={{ width: GRID_GUTTER }} />}
                    <SkeletonCell style={{ width: CELL_SIZE, height: CELL_SIZE }} />
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View>
        {/* TOP FILMS */}
        <View style={styles.gridRow}>
          <TopFilmCell
            film={topFilm}
            onPress={() => topFilm && handleNavigateFilm(topFilm.id)}
          />

          <View style={{ width: GRID_GUTTER }} />

          <Top2FilmsCell
            films={top2to3Films}
            onPress={() =>
              top2to3Films[0] && handleNavigateFilm(top2to3Films[0].id)
            }
          />

          <View style={{ width: GRID_GUTTER }} />

          <OtherFavsCell
            films={otherFavs}
            onPress={() => router.push('/profile/favorites')}
          />
        </View>

        {/* CRITIQUES */}
        {reviews.map((rev, i) => (
          <View key={rev.id} style={{ marginTop: GRID_GUTTER }}>
            <View style={styles.gridRow}>
              <CritiqueCell
                review={rev}
                index={i}
                onPress={() => {
                  if (rev.film) handleNavigateFilm(rev.film.id);
                }}
              />
            </View>
          </View>
        ))}

        {/* SEEN */}
        {seenFilms.map((film, i) => (
          <View key={film.id} style={{ marginTop: GRID_GUTTER }}>
            <View style={styles.gridRow}>
              <SeenCell
                film={film}
                onPress={() => handleNavigateFilm(film.id)}
              />
            </View>
          </View>
        ))}
      </View>
    );
  }

  // ── Prefetch trigger on hover/touch ───────────────────────
  function withPrefetch(id: string, children: React.ReactNode) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => handleNavigateFilm(id)}
        onPressIn={() => prefetchFilm(id)} // key UX boost
      >
        {children}
      </TouchableOpacity>
    );
  }

function SkeletonCell({ style }: { style?: any }) {
  return (
    <View style={[styles.gridCell, style]}>
      <Shimmer />
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeGridTab, setActiveGridTab] = useState<GridTab>(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [seenFilms, setSeenFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Data loading ────────────────────────────────────────────────────────
  const loadProfileData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [reviewsData, seenData] = await Promise.all([
        reviewsAPI.getByUser(user.id),
        seenAPI.getByUser(user.id),
      ]);
      setReviews(reviewsData || []);
      setSeenFilms(seenData || []);
    } catch (e) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // ── Derived data ────────────────────────────────────────────────────────
  const allFavoriteFilms = useMemo<Film[]>(() => {
    const fromReviews = reviews
      .filter((r) => r.film && r.rating >= 4)
      .sort((a, b) => b.rating - a.rating)
      .map((r) => r.film as Film);
    const fromSeen = seenFilms.filter(
      (f) => !fromReviews.some((r) => r.id === f.id)
    );
    return [...fromReviews, ...fromSeen];
  }, [reviews, seenFilms]);

  const topFilm = allFavoriteFilms[0] ?? null;
  const top2to3Films = allFavoriteFilms.slice(1, 3);
  const otherFavs = allFavoriteFilms.slice(3, 13);

  // ── Helpers ─────────────────────────────────────────────────────────────
  function formatStat(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
    return `${n}`;
  }

  // ── Grid rows builder ────────────────────────────────────────────────────
  /**
   * The grid is a flat list of "rows".
   * Row 0 (index 0): Top-films triple (special sizes)
   * Rows 1…N: critique cells (3 per row, first=wide 2/3)
   * Rows N+1…M: seen-films cells (3 per row)
   */

  function renderGridContent() {
    if (loading) {
      return (
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      );
    }

    return (
      <View>
        {/* ── ROW 1: Top films ─────────────────── */}
        <View style={styles.gridRow}>
          <TopFilmCell
            film={topFilm}
            onPress={() => topFilm && router.push(`/film/${topFilm.id}`)}
          />
          <View style={{ width: GRID_GUTTER }} />
          <Top2FilmsCell
            films={top2to3Films}
            onPress={() => top2to3Films[0] && router.push(`/film/${top2to3Films[0].id}`)}
          />
          <View style={{ width: GRID_GUTTER }} />
          <OtherFavsCell
            films={otherFavs}
            onPress={() => router.push('/profile/favorites')}
          />
        </View>

        <View style={{ height: GRID_GUTTER * 2 }} />

        {/* ── ROW 2: Critiques ─────────────────── */}
        {reviews.length === 0 ? (
          <EmptyState icon="chatbubble-outline" text="Aucune critique publiée" />
        ) : (
          (() => {
            // Build rows: first row = wide(2/3) + 1 cell; subsequent = 3 per row
            const rows: Review[][] = [];
            let i = 0;
            // first critique row
            if (reviews[0]) rows.push([reviews[0], reviews[1]].filter(Boolean) as Review[]);
            i = rows[0]?.length ?? 0;
            // remaining rows of 3
            while (i < reviews.length) {
              rows.push(reviews.slice(i, i + 3));
              i += 3;
            }
            return rows.map((rowReviews, rowIdx) => (
              <View key={`crit-row-${rowIdx}`}>
                <View style={styles.gridRow}>
                  {rowIdx === 0 ? (
                    // First review row: 2/3 wide + 1/3 narrow
                    <>
                      <CritiqueCell
                        review={rowReviews[0]}
                        index={0}
                        onPress={() => rowReviews[0].film && router.push(`/film/${rowReviews[0].film.id}`)}
                      />
                      {rowReviews[1] && (
                        <>
                          <View style={{ width: GRID_GUTTER }} />
                          <CritiqueCell
                            review={rowReviews[1]}
                            index={1}
                            onPress={() => rowReviews[1].film && router.push(`/film/${rowReviews[1].film.id}`)}
                          />
                        </>
                      )}
                    </>
                  ) : (
                    rowReviews.map((rev, rIdx) => (
                      <React.Fragment key={rev.id}>
                        {rIdx > 0 && <View style={{ width: GRID_GUTTER }} />}
                        <CritiqueCell
                          review={rev}
                          index={rIdx + 2} // not wide
                          onPress={() => rev.film && router.push(`/film/${rev.film.id}`)}
                        />
                      </React.Fragment>
                    ))
                  )}
                </View>
                <View style={{ height: GRID_GUTTER }} />
              </View>
            ));
          })()
        )}

        <View style={{ height: GRID_GUTTER }} />

        {/* ── ROW 3+: Films vus ─────────────────── */}
        {seenFilms.length === 0 ? (
          <EmptyState icon="film-outline" text="Aucun film vu pour l'instant" />
        ) : (
          (() => {
            const seenRows: Film[][] = [];
            for (let si = 0; si < seenFilms.length; si += 3) {
              seenRows.push(seenFilms.slice(si, si + 3));
            }
            return seenRows.map((rowFilms, rowIdx) => (
              <View key={`seen-row-${rowIdx}`}>
                <View style={styles.gridRow}>
                  {rowFilms.map((film, fIdx) => (
                    <React.Fragment key={film.id}>
                      {fIdx > 0 && <View style={{ width: GRID_GUTTER }} />}
                      <SeenCell
                        film={film}
                        onPress={() => router.push(`/film/${film.id}`)}
                      />
                    </React.Fragment>
                  ))}
                </View>
                <View style={{ height: GRID_GUTTER }} />
              </View>
            ));
          })()
        )}

        <View style={{ height: 120 }} />
      </View>
    );
  }

  if (!user) return null;

  // ── Animated header opacity ──────────────────────────────────────────────
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* ── Sticky mini-header (appears on scroll) ── */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { opacity: headerBgOpacity },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.stickyUsername}>{user.username}</Text>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProfileData();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ══════════════════════════════════════
            PROFILE HEADER (Instagram-style)
        ══════════════════════════════════════ */}
        <LinearGradient
          colors={['#1A003A', '#5C1A8C', '#0D0D0D']}
          locations={[0, 0.45, 1]}
          style={styles.profileHeaderGradient}
        >
          <SafeAreaView edges={['top']}>
            {/* Top nav: UNIVERSE logo + settings */}
            <View style={styles.topNav}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.usernameNav}>{user.username}</Text>
                <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <TouchableOpacity
                  testID="profile-add-post-btn"
                  style={styles.navIconBtn}
                  onPress={() => router.push('/create')}
                >
                  <Ionicons name="add-circle-outline" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  testID="profile-settings-btn"
                  style={styles.navIconBtn}
                  onPress={() => router.push('/settings')}
                >
                  <Ionicons name="menu" size={26} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Avatar + stats row */}
            <View style={styles.avatarStatsRow}>
              {/* Avatar with ring */}
              <View style={styles.avatarWrapper}>
                <LinearGradient
                  colors={['#D300C5', '#FF7A00', '#FFDC80']}
                  style={styles.avatarRing}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.avatarInnerBorder}>
                    <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
                  </View>
                </LinearGradient>
                {/* Add button */}
                <View style={styles.avatarAddBtn}>
                  <LinearGradient
                    colors={[COLORS.primary, '#8C2EBA']}
                    style={styles.avatarAddGrad}
                  >
                    <Ionicons name="add" size={14} color="#fff" />
                  </LinearGradient>
                </View>
              </View>

              {/* Stats: Posts, Followers, Following */}
              <View style={styles.statsRow}>
                <StatColumn
                  value={`${user.reviews_count + user.films_seen_count}`}
                  label="publications"
                  onPress={() => {}}
                />
                <StatColumn
                  value={formatStat(user.followers_count)}
                  label="abonnés"
                  onPress={() => router.push('/followers')}
                />
                <StatColumn
                  value={formatStat(user.following_count)}
                  label="abonnements"
                  onPress={() => router.push('/following')}
                />
              </View>
            </View>

            {/* Name + role badge + bio */}
            <View style={styles.bioSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.displayName}>{user.username}</Text>
                {user.role === 'director' && (
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>🎬 Réalisateur</Text>
                  </View>
                )}
                {user.role === 'critic' && (
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>✍️ Critique</Text>
                  </View>
                )}
                {user.role === 'creator' && (
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>⭐ Créateur</Text>
                  </View>
                )}
              </View>
              <Text style={styles.bioText}>{user.bio}</Text>
            </View>

            {/* Action buttons: Modifier / Partager / + */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                testID="profile-edit-btn"
                style={styles.actionBtn}
                onPress={() => router.push('/edit-profile')}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {/* share */}}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>Partager le profil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSquare}
                onPress={() => router.push('/discover-people')}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ══════════════════════════════════════
            HIGHLIGHTS ROW (scrollable chips)
            → repurposed as film-category chips
        ══════════════════════════════════════ */}
        <View style={styles.highlightsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.highlightsScroll}
          >
            {[
              { emoji: '🏆', label: 'Top 10' },
              { emoji: '✍️', label: 'Critiques' },
              { emoji: '👁', label: 'Films vus' },
              { emoji: '🎬', label: 'Réalisés' },
              { emoji: '⭐', label: 'Favoris' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.highlightChip}
                activeOpacity={0.8}
                onPress={() => {}}
              >
                <LinearGradient
                  colors={['#2A0060', '#7B1FA0']}
                  style={styles.highlightCircle}
                >
                  <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                </LinearGradient>
                <Text style={styles.highlightLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ══════════════════════════════════════
            GRID TAB BAR (Instagram icons)
        ══════════════════════════════════════ */}
        <View style={styles.gridTabBar}>
          {(['grid-outline', 'play-circle-outline', 'person-circle-outline'] as const).map(
            (icon, idx) => (
              <TouchableOpacity
                key={icon}
                style={styles.gridTabItem}
                onPress={() => setActiveGridTab(idx as GridTab)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={icon}
                  size={24}
                  color={
                    activeGridTab === idx
                      ? '#fff'
                      : 'rgba(255,255,255,0.4)'
                  }
                />
                {activeGridTab === idx && (
                  <View style={styles.gridTabIndicator} />
                )}
              </TouchableOpacity>
            )
          )}
        </View>

        {/* ══════════════════════════════════════
            GRID CONTENT
        ══════════════════════════════════════ */}
        {activeGridTab === 0 && renderGridContent()}

        {activeGridTab === 1 && (
          // Reels / court métrages
          <EmptyState
            icon="film-outline"
            text="Aucun court métrage"
            subtext="Soumettez votre court métrage"
          />
        )}

        {activeGridTab === 2 && (
          // Tagged
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Sticky header ───────────────────────────────────
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: 44,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  stickyUsername: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Profile header gradient ─────────────────────────
  profileHeaderGradient: {
    paddingBottom: 16,
  },

  // ── Top nav ─────────────────────────────────────────
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  usernameNav: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.1,
  },
  navIconBtn: {
    padding: 4,
  },

  // ── Avatar + Stats ──────────────────────────────────
  avatarStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginTop: 4,
    gap: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInnerBorder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarAddBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAddGrad: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Bio section ─────────────────────────────────────
  bioSection: {
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 3,
  },
  displayName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  rolePill: {
    backgroundColor: 'rgba(140,46,186,0.35)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(140,46,186,0.5)',
  },
  rolePillText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
  },
  bioText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  // ── Action buttons ──────────────────────────────────
  actionButtonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginTop: 14,
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnSquare: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },

  // ── Highlights ──────────────────────────────────────
  highlightsSection: {
    backgroundColor: '#000',
    borderBottomWidth: 0,
  },
  highlightsScroll: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 16,
  },
  highlightChip: {
    alignItems: 'center',
    gap: 6,
  },
  highlightCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(140,46,186,0.4)',
  },
  highlightLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Grid tab bar ────────────────────────────────────
  gridTabBar: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  gridTabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  gridTabIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#fff',
  },

  // ── Grid layout ─────────────────────────────────────
  gridRow: {
    flexDirection: 'row',
    backgroundColor: '#000',
  },
  gridCell: {
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
  },
  gridCellPlaceholder: {
    backgroundColor: '#1A1A2E',
  },

  // ── Cell overlays ────────────────────────────────────
  cellOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 7,
    paddingTop: 24,
    paddingBottom: 7,
    gap: 3,
  },
  cellOverlayThin: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 5,
    paddingTop: 12,
    paddingBottom: 4,
  },
  cellLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cellSublabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // ── Sparkle icon ─────────────────────────────────────
  sparkleTopLeft: {
    position: 'absolute',
    top: 5,
    left: 5,
  },
  sparkleEmoji: {
    fontSize: 16,
  },

  // ── Top 2 cell (split) ──────────────────────────────
  splitCell: {
    flex: 1,
    flexDirection: 'column',
  },
  splitHalf: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rankText: {
    color: '#FFD60A',
    fontSize: 9,
    fontWeight: '900',
  },

  // ── Other favs micro-grid ───────────────────────────
  microGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  microCell: {
    width: '50%',
    height: '50%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1A1A2E',
  },

  // ── Critique cells ───────────────────────────────────
  papyrusBackground: {
    backgroundColor: '#2C1A08',
  },
  critiqueIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  critiqueCellLabel: {
    color: 'rgba(255,220,120,0.95)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  critiqueSnippet: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    lineHeight: 13,
    fontStyle: 'italic',
  },

  // ── Seen cells ───────────────────────────────────────
  seenCheckBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(30,215,96,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seenCellTitle: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // ── Empty state ─────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 30,
    gap: 10,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubText: {
    color: COLORS.textTertiary,
    fontSize: 13,
  },
});