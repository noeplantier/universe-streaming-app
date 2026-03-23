// ─────────────────────────────────────────────
//  HomeScreen — Universe
//  Hero banner + trending + new content
//  Dark galaxy aesthetic
// ─────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Dimensions, RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import {
  COLORS, SPACING, RADIUS, GRADIENTS, DURATION_LABELS,
  GENRE_COLORS, SHADOWS, TYPOGRAPHY,
} from '../constants/theme';
import { filmsAPI, discoverAPI } from '../services/api';
import StarField from '../components/StarField';

const { width } = Dimensions.get('window');
const CARD_GAP  = 10;
const HALF_W    = (width - SPACING.screenEdge * 2 - CARD_GAP) / 2;

const GENRES = ['Tous', 'Thriller', 'Drame', 'Romance', 'Fantasy', 'Science-Fiction', 'Documentaire'];

interface Film {
  id: string; title: string; director: string; duration_minutes: number;
  duration_type: string; genre: string; synopsis: string; poster_url: string;
  year: number; rating: number; views_count: number;
}

function formatDuration(min: number) {
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}m` : ''}`;
}

// ── Glowing section label ─────────────────────
function SectionLabel({ title, accent = COLORS.primary, onSeeAll }:
  { title: string; accent?: string; onSeeAll?: () => void }) {
  return (
    <View style={sLabel.row}>
      <View style={[sLabel.dot, { backgroundColor: accent, shadowColor: accent }]} />
      <Text style={sLabel.text}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={sLabel.seeAll}>Voir tout →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sLabel = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dot:    { width: 7, height: 7, borderRadius: 3.5, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6, elevation: 6 },
  text:   { flex: 1, fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 2.5 },
  seeAll: { fontSize: 12, fontWeight: '700', color: COLORS.primaryLight },
});

// ── Genre Chip ────────────────────────────────
function GenreChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  if (active) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={chip.activeWrap}>
        <LinearGradient colors={GRADIENTS.primaryGlow} style={chip.activeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={chip.activeText}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={chip.inactive}>
      <Text style={chip.inactiveText}>{label}</Text>
    </TouchableOpacity>
  );
}
const chip = StyleSheet.create({
  activeWrap: { borderRadius: RADIUS.full, ...SHADOWS.primary },
  activeGrad: { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 7 },
  activeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  inactive:   { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border },
  inactiveText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '500' },
});

// ── Genre Badge ───────────────────────────────
function GenreBadge({ genre }: { genre: string }) {
  const color = GENRE_COLORS[genre] || COLORS.primary;
  return (
    <View style={[badge.wrap, { backgroundColor: color + '33', borderColor: color + '88' }]}>
      <Text style={[badge.text, { color }]}>{genre}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  text: { fontSize: 10, fontWeight: '700' },
});

// ── Hero Banner ───────────────────────────────
function HeroBanner({ film, onPress }: { film: Film; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn()  { Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start(); }
  function onPressOut() { Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start(); }

  return (
    <Animated.View style={[hero.container, { transform: [{ scale }] }]}>
      <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1} style={hero.inner}>
        <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        {/* Gradient overlay */}
        <LinearGradient colors={['rgba(8,0,16,0.05)', 'rgba(8,0,16,0.97)']} style={StyleSheet.absoluteFillObject} locations={[0.35, 1]} />
        {/* Purple edge glow */}
        <LinearGradient colors={['rgba(155,63,222,0.4)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 0.3, y: 0.5 }} style={StyleSheet.absoluteFillObject} />

        {/* Play button */}
        <View style={hero.playRing}>
          <LinearGradient colors={GRADIENTS.primaryGlow} style={hero.playBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="play" size={18} color="#fff" />
          </LinearGradient>
        </View>

        {/* Chips row */}
        <View style={hero.meta}>
          <View style={hero.chips}>
            <View style={[hero.typeBadge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary }]}>
              <Text style={hero.typeBadgeText}>{film.genre}</Text>
            </View>
            <View style={hero.durationChip}>
              <Ionicons name="time-outline" size={10} color={COLORS.primaryLight} />
              <Text style={hero.durationChipText}>{formatDuration(film.duration_minutes)} · {DURATION_LABELS[film.duration_type]}</Text>
            </View>
          </View>
          <Text style={hero.title} numberOfLines={2}>{film.title}</Text>
          <Text style={hero.director}>{film.director} · {film.year}</Text>
          <View style={hero.stars}>
            {[1,2,3,4,5].map(s => (
              <Ionicons key={s} name={s <= Math.round(film.rating) ? 'star' : 'star-outline'} size={12} color={COLORS.gold} />
            ))}
            <Text style={hero.rating}>{film.rating}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const hero = StyleSheet.create({
  container: { borderRadius: RADIUS.xl, ...SHADOWS.primary, marginBottom: 4 },
  inner:     { height: 290, borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: COLORS.surface },
  playRing: {
    position: 'absolute', top: 16, right: 16,
    width: 42, height: 42, borderRadius: 21,
    padding: 2,
    backgroundColor: 'rgba(155,63,222,0.3)',
    borderWidth: 1, borderColor: COLORS.primaryLight,
  },
  playBtn:  { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  meta:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18 },
  chips:    { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  typeBadge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  durationChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(155,63,222,0.25)', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  durationChipText: { color: COLORS.primaryLight, fontSize: 10, fontWeight: '600' },
  title:    { ...TYPOGRAPHY.h1, marginBottom: 4 },
  director: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  stars:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating:   { color: COLORS.gold, fontSize: 12, fontWeight: '800', marginLeft: 5 },
});

// ── Ranked Card (Trending) ────────────────────
function RankedCard({ film, rank, onPress }: { film: Film; rank: number; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={ranked.card}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(8,0,16,0.95)']} style={StyleSheet.absoluteFillObject} locations={[0.4, 1]} />
      {/* Rank number */}
      <Text style={ranked.rank}>{rank}</Text>
      <View style={ranked.info}>
        <GenreBadge genre={film.genre} />
        <Text style={ranked.title} numberOfLines={2}>{film.title}</Text>
      </View>
      {/* Heart count */}
      <View style={ranked.likeRow}>
        <Ionicons name="heart" size={11} color="#FF3B30" />
        <Text style={ranked.likeText}>{(film.views_count / 1000).toFixed(1)}K</Text>
      </View>
    </TouchableOpacity>
  );
}
const ranked = StyleSheet.create({
  card:  { width: 140, height: 200, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surface, ...SHADOWS.card },
  rank:  { position: 'absolute', bottom: 38, left: 8, fontSize: 52, fontWeight: '900', color: 'rgba(192,96,255,0.8)', lineHeight: 60 },
  info:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
  title: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },
  likeRow: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 3 },
  likeText: { color: '#fff', fontSize: 9, fontWeight: '600' },
});

// ── Landscape Card (Nouveautés) ───────────────
function LandscapeCard({ film, onPress }: { film: Film; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={land.card}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(8,0,16,0.9)']} style={StyleSheet.absoluteFillObject} />
      <View style={land.info}>
        <View style={land.row}>
          <GenreBadge genre={film.genre} />
          <Text style={land.year}>{film.year}</Text>
        </View>
        <Text style={land.title}>{film.title}</Text>
        <View style={land.metaRow}>
          <Ionicons name="star" size={11} color={COLORS.gold} />
          <Text style={land.rating}>{film.rating}</Text>
          <Text style={land.views}>· {(film.views_count / 1000).toFixed(1)}K vues</Text>
        </View>
      </View>
      {/* Play overlay */}
      <View style={land.playIcon}>
        <Ionicons name="play-circle" size={32} color="rgba(192,96,255,0.85)" />
      </View>
    </TouchableOpacity>
  );
}
const land = StyleSheet.create({
  card:    { height: 150, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surface, ...SHADOWS.card },
  info:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  year:    { color: COLORS.textTertiary, fontSize: 11 },
  title:   { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating:  { color: COLORS.gold, fontSize: 11, fontWeight: '700' },
  views:   { color: COLORS.textTertiary, fontSize: 11 },
  playIcon: { position: 'absolute', top: '50%', right: 16, transform: [{ translateY: -16 }] },
});

// ── Main Screen ───────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const [films,         setFilms]       = useState<Film[]>([]);
  const [featured,      setFeatured]    = useState<Film | null>(null);
  const [loading,       setLoading]     = useState(true);
  const [refreshing,    setRefreshing]  = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('Tous');
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });

  const fetchData = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedGenre !== 'Tous') params.genre = selectedGenre;
      const [filmsData, featuredData] = await Promise.all([
        filmsAPI.getAll(params),
        discoverAPI.featured(),
      ]);
      setFilms(filmsData);
      setFeatured(featuredData);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [selectedGenre]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const trending   = films.slice(0, 5);
  const nouvelles  = films.slice(5, 9);

  function goFilm(id: string) { router.push(`/film/${id}`); }

  return (
    <View style={styles.container}>
      {/* Galaxy star background */}
      <StarField />

      {/* Nebula ambient glow */}
      <View style={styles.nebulaGlow1} />
      <View style={styles.nebulaGlow2} />

      {/* Scrolled header blur */}
      <Animated.View style={[styles.headerBlur, { opacity: headerOpacity }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
      </Animated.View>

      {/* Sticky top bar */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Text style={styles.logo}>UNIVERSE</Text>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="search-outline" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <View style={styles.giftGlow} />
            <Ionicons name="gift-outline" size={22} color={COLORS.primaryLight} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={COLORS.primary} />
          }
        >
          {/* Genre filter */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={styles.genreBar}
            contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8 }}
          >
            {GENRES.map(g => (
              <GenreChip key={g} label={g} active={selectedGenre === g} onPress={() => setSelectedGenre(g)} />
            ))}
          </ScrollView>

          <View style={styles.content}>
            {/* HERO */}
            {featured && (
              <View style={styles.section}>
                <SectionLabel title="À LA UNE" />
                <HeroBanner film={featured} onPress={() => goFilm(featured.id)} />
              </View>
            )}

            {/* TRENDING */}
            {trending.length > 0 && (
              <View style={styles.section}>
                <SectionLabel
                  title="LES PLUS TENDANCES"
                  onSeeAll={() => router.push({ pathname: '/category/[type]', params: { type: 'trending' } })}
                />
                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10 }}
                >
                  {trending.map((film, i) => (
                    <RankedCard key={film.id} film={film} rank={i + 1} onPress={() => goFilm(film.id)} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* NOUVEAUTÉS */}
            {nouvelles.length > 0 && (
              <View style={styles.section}>
                <SectionLabel
                  title="NOUVEAUTÉS DANS L'UNIVERS"
                  accent="#A78BFA"
                  onSeeAll={() => router.push({ pathname: '/category/[type]', params: { type: 'new' } })}
                />
                <View style={{ gap: CARD_GAP }}>
                  {nouvelles.map(film => (
                    <LandscapeCard key={film.id} film={film} onPress={() => goFilm(film.id)} />
                  ))}
                </View>
              </View>
            )}
          </View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  loading:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 110, paddingTop: 0 },
  content:      { paddingHorizontal: SPACING.screenEdge },
  section:      { marginBottom: 30 },

  // Nebula ambient
  nebulaGlow1: {
    position: 'absolute', top: -100, left: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: COLORS.primaryDark,
    opacity: 0.25,
  },
  nebulaGlow2: {
    position: 'absolute', top: 200, right: -120,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: '#3B0764',
    opacity: 0.2,
  },

  // Header
  headerBlur: { position: 'absolute', top: 0, left: 0, right: 0, height: 90, zIndex: 10 },
  topBar:     { paddingHorizontal: SPACING.screenEdge, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 },
  logo:       { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 6 },
  topActions: { flexDirection: 'row', gap: 8 },
  iconBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  giftGlow:   { ...StyleSheet.absoluteFillObject, borderRadius: 20, backgroundColor: COLORS.primary, opacity: 0.2 },

  genreBar: { paddingVertical: 10, marginBottom: 16 },
});
