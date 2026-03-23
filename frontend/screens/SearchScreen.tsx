// ─────────────────────────────────────────────
//  SearchScreen — Universe Rechercher
//  Séries / Films / Catégories tabs
//  Filter chips: Genre · Popularité · Durée · Année
//  2-col film grid with like counts
// ─────────────────────────────────────────────
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
  Image, ActivityIndicator, ScrollView, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, GENRE_COLORS, GRADIENTS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { filmsAPI } from '../services/api';
import StarField from '../components/StarField';

const { width } = Dimensions.get('window');

const CONTENT_TABS  = ['Séries', 'Films', 'Catégories'] as const;
const FILTER_CHIPS  = ['Genre', 'Popularité', 'Durée', 'Année'] as const;
const GENRES        = ['Tous', 'Thriller', 'Drame', 'Romance', 'Fantasy', 'Science-Fiction', 'Documentaire', 'Horreur'];
const DURATIONS     = [{ key: 'all', label: 'Toutes durées' }, { key: 'short', label: '< 10 min' }, { key: 'medium', label: '10-40 min' }, { key: 'long', label: '40+ min' }];

interface Film {
  id: string; title: string; director: string; duration_minutes: number;
  duration_type: string; genre: string; poster_url: string;
  year: number; rating: number; views_count: number;
}

// ── Content Tab Button ────────────────────────
function ContentTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  if (active) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={ct.activeWrap}>
        <LinearGradient colors={GRADIENTS.primaryGlow} style={ct.activeBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={ct.activeText}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={ct.inactive}>
      <Text style={ct.inactiveText}>{label}</Text>
    </TouchableOpacity>
  );
}
const ct = StyleSheet.create({
  activeWrap: { borderRadius: RADIUS.md, ...SHADOWS.primary },
  activeBtn:  { borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 9 },
  activeText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  inactive:   { borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border },
  inactiveText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
});

// ── Filter chip ───────────────────────────────
function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[fc.chip, active && fc.chipActive]}
      activeOpacity={0.75}
    >
      <Text style={[fc.text, active && fc.textActive]}>{label}</Text>
      {!active && <Ionicons name="chevron-down" size={12} color={COLORS.textTertiary} />}
    </TouchableOpacity>
  );
}
const fc = StyleSheet.create({
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderLight },
  chipActive: { backgroundColor: 'rgba(155,63,222,0.2)', borderColor: COLORS.primaryLight },
  text:       { color: COLORS.textTertiary, fontSize: 12, fontWeight: '500' },
  textActive: { color: COLORS.primaryLight, fontWeight: '700' },
});

// ── Film Grid Card ────────────────────────────
function FilmCard({ film, onPress }: { film: Film; onPress: () => void }) {
  const genreColor = GENRE_COLORS[film.genre] || COLORS.primary;
  const isOriginal = film.rating >= 4.5;

  return (
    <TouchableOpacity onPress={onPress} style={fc2.card} activeOpacity={0.82}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(8,0,16,0.92)']} style={StyleSheet.absoluteFillObject} locations={[0.45, 1]} />

      {/* Original badge */}
      {isOriginal && (
        <View style={fc2.originalBadge}>
          <LinearGradient colors={GRADIENTS.primaryGlow} style={fc2.originalGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Ionicons name="planet" size={9} color="#fff" />
            <Text style={fc2.originalText}>ORIGINAL</Text>
          </LinearGradient>
        </View>
      )}

      {/* Info overlay */}
      <View style={fc2.info}>
        <Text style={[fc2.genreText, { color: genreColor }]}>{film.genre}</Text>
        <Text style={fc2.title} numberOfLines={2}>{film.title}</Text>
      </View>

      {/* Like count */}
      <View style={fc2.likeRow}>
        <Ionicons name="heart" size={11} color="#FF3B30" />
        <Text style={fc2.likeText}>{Math.floor(film.views_count / 80)}</Text>
      </View>
    </TouchableOpacity>
  );
}
const fc2 = StyleSheet.create({
  card: { flex: 1, height: 220, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surface, ...SHADOWS.card },
  originalBadge: { position: 'absolute', top: 10, left: 10 },
  originalGrad:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4 },
  originalText:  { color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  info:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
  genreText: { fontSize: 10, fontWeight: '700', marginBottom: 3 },
  title:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  likeRow:   { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 3 },
  likeText:  { color: '#fff', fontSize: 10, fontWeight: '600' },
});

// ── Main Screen ───────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const [query,            setQuery]           = useState('');
  const [contentTab,       setContentTab]      = useState<typeof CONTENT_TABS[number]>('Séries');
  const [activeFilter,     setActiveFilter]    = useState<string | null>(null);
  const [selectedGenre,    setSelectedGenre]   = useState('Tous');
  const [selectedDuration, setSelectedDuration]= useState('all');
  const [films,            setFilms]           = useState<Film[]>([]);
  const [loading,          setLoading]         = useState(true);
  const [searching,        setSearching]       = useState(false);
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchFilms = useCallback(async (q?: string) => {
    setSearching(true);
    try {
      const params: Record<string, string> = {};
      if (selectedGenre !== 'Tous') params.genre = selectedGenre;
      if (selectedDuration !== 'all') params.duration_type = selectedDuration;
      if (q) params.q = q;
      const data = await filmsAPI.getAll(params);
      setFilms(data);
    } catch {}
    finally { setLoading(false); setSearching(false); }
  }, [selectedGenre, selectedDuration]);

  useEffect(() => {
    const t = setTimeout(() => fetchFilms(query), 300);
    return () => clearTimeout(t);
  }, [query, selectedGenre, selectedDuration, fetchFilms]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const trending = films.slice(0, 3);

  return (
    <View style={s.container}>
      <StarField />
      {/* Ambient glow */}
      <View style={s.glow1} />
      <View style={s.glow2} />

      <SafeAreaView edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Rechercher</Text>
          <TouchableOpacity style={s.headerIcon} onPress={() => inputRef.current?.focus()}>
            <Ionicons name="search" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={s.searchWrap}>
          <BlurView intensity={20} tint="dark" style={s.searchBlur}>
            <Ionicons name="search-outline" size={18} color={COLORS.textTertiary} />
            <TextInput
              ref={inputRef}
              style={s.searchInput}
              placeholder="Rechercher dans Universe..."
              placeholderTextColor={COLORS.textTertiary}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              selectionColor={COLORS.primaryLight}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
            {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
          </BlurView>
        </View>

        {/* Content type tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsBar} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 10 }}>
          {CONTENT_TABS.map(t => (
            <ContentTab key={t} label={t} active={contentTab === t} onPress={() => setContentTab(t)} />
          ))}
          <TouchableOpacity style={s.moreBtn}>
            <Text style={s.moreBtnText}>Catégories</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </ScrollView>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersBar} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8 }}>
          {FILTER_CHIPS.map(f => (
            <FilterChip key={f} label={f} active={activeFilter === f} onPress={() => setActiveFilter(activeFilter === f ? null : f)} />
          ))}
          <TouchableOpacity style={s.allFiltersBtn}>
            <Ionicons name="options-outline" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {loading ? (
        <View style={s.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          <FlatList
            data={films}
            keyExtractor={item => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12, paddingHorizontal: SPACING.screenEdge }}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 120, gap: 12 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              trending.length > 0 && !query ? (
                <View style={s.trendingSection}>
                  <View style={s.trendingHeader}>
                    <Text style={s.trendingTitle}>Les Plus tendances</Text>
                    <TouchableOpacity>
                      <Ionicons name="chevron-forward" size={18} color={COLORS.primaryLight} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: SPACING.screenEdge }}>
                    {trending.map((film, i) => (
                      <TouchableOpacity key={film.id} onPress={() => router.push(`/film/${film.id}`)} style={s.trendCard}>
                        <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        <LinearGradient colors={['transparent', 'rgba(8,0,16,0.9)']} style={StyleSheet.absoluteFillObject} />
                        <Text style={s.trendRank}>{i + 1}</Text>
                        <View style={s.trendInfo}>
                          <Text style={s.trendTitle} numberOfLines={2}>{film.title}</Text>
                          <View style={s.trendLikes}>
                            <Ionicons name="heart" size={10} color="#FF3B30" />
                            <Text style={s.trendLikeText}>{Math.floor(film.views_count / 80)}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Popular section row */}
                  <TouchableOpacity style={s.popularRow}>
                    <View style={s.popularIcon}>
                      <LinearGradient colors={GRADIENTS.primaryGlow} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="heart" size={16} color="#fff" />
                      </LinearGradient>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.popularLabel}>Populaires</Text>
                      <Text style={s.popularSub}>Pinpularires</Text>
                    </View>
                    <View style={s.popularAvatars}>
                      {[1,2].map(i => <View key={i} style={[s.popularAvatar, { marginLeft: i > 1 ? -10 : 0 }]} />)}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <FilmCard film={item} onPress={() => router.push(`/film/${item.id}`)} />
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="film-outline" size={52} color={COLORS.textTertiary} />
                <Text style={s.emptyTitle}>Aucun film trouvé</Text>
                <Text style={s.emptySub}>Essayez d&aposautres filtres</Text>
              </View>
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow1: { position: 'absolute', top: -60, left: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: COLORS.primaryDark, opacity: 0.2 },
  glow2: { position: 'absolute', top: 300, right: -100, width: 220, height: 220, borderRadius: 110, backgroundColor: '#3B0764', opacity: 0.18 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screenEdge, paddingVertical: 14 },
  headerTitle:{ ...TYPOGRAPHY.h1 },
  headerIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: COLORS.border },
  searchWrap: { marginHorizontal: SPACING.screenEdge, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  searchBlur: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, overflow: 'hidden' },
  searchInput:{ flex: 1, color: COLORS.textPrimary, fontSize: 15, paddingVertical: 14 },
  tabsBar:    { paddingVertical: 2, marginBottom: 10 },
  filtersBar: { marginBottom: 16 },
  moreBtn:    { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 14, paddingVertical: 9 },
  moreBtnText:{ color: COLORS.textTertiary, fontSize: 14 },
  allFiltersBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: COLORS.borderLight },
  // Trending header in list
  trendingSection: { paddingHorizontal: 0, marginBottom: 20 },
  trendingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screenEdge, marginBottom: 14 },
  trendingTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  trendCard: { width: 160, height: 200, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surface, ...SHADOWS.card },
  trendRank: { position: 'absolute', bottom: 38, left: 8, fontSize: 44, fontWeight: '900', color: 'rgba(192,96,255,0.85)', lineHeight: 52 },
  trendInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
  trendTitle: { color: '#fff', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  trendLikes: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trendLikeText: { color: '#fff', fontSize: 10 },
  // Popular row
  popularRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.lg, padding: 14, marginHorizontal: SPACING.screenEdge, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  popularIcon: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  popularLabel:{ color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  popularSub:  { color: COLORS.textTertiary, fontSize: 12 },
  popularAvatars: { flexDirection: 'row' },
  popularAvatar:  { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.background },
  empty:      { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyTitle: { color: COLORS.textSecondary, fontSize: 18, fontWeight: '700' },
  emptySub:   { color: COLORS.textTertiary, fontSize: 13 },
});
