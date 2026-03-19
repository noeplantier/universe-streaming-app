import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS, DURATION_LABELS, GENRE_COLORS } from '../../constants/theme';
import { filmsAPI, discoverAPI } from '../../services/api';
import GlobalHeader from '../../components/GlobalHeader';

const { width } = Dimensions.get('window');
const CARD_GAP = 10;
const HALF_W = (width - SPACING.screenEdge * 2 - CARD_GAP) / 2;

const GENRES = ['Tous', 'Thriller', 'Drame', 'Romance', 'Fantasy', 'Science-Fiction', 'Documentaire'];

interface Film {
  id: string; title: string; director: string; duration_minutes: number;
  duration_type: string; genre: string; synopsis: string; poster_url: string;
  year: number; rating: number; views_count: number;
}

function formatDuration(min: number) {
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}m` : ''}`;
}

// Hero Banner — Long film (40+ min), full width
function HeroBanner({ film, onPress }: { film: Film; onPress: () => void }) {
  return (
    <TouchableOpacity testID={`hero-${film.id}`} onPress={onPress} activeOpacity={0.9} style={styles.heroBanner}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.heroPlayBtn}>
        <Ionicons name="play" size={18} color="#fff" />
      </View>
      <View style={styles.heroMeta}>
        <View style={styles.heroBadges}>
          <View style={[styles.badge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary }]}>
            <Text style={styles.badgeText}>{film.genre}</Text>
          </View>
          <View style={styles.durationBadge}>
            <Text style={styles.durationBadgeText}>Long Métrage · {formatDuration(film.duration_minutes)}</Text>
          </View>
        </View>
        <Text style={styles.heroTitle} numberOfLines={2}>{film.title}</Text>
        <Text style={styles.heroDir}>{film.director} · {film.year}</Text>
        <View style={styles.heroRating}>
          {[1,2,3,4,5].map(s => <Ionicons key={s} name={s <= Math.round(film.rating) ? 'star' : 'star-outline'} size={12} color="#FFD60A" />)}
          <Text style={styles.heroRatingText}>{film.rating}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Long portrait card (half width, tall) — 40+ min
function LongPortraitCard({ film, rank, onPress }: { film: Film; rank?: number; onPress: () => void }) {
  return (
    <TouchableOpacity testID={`long-card-${film.id}`} onPress={onPress} activeOpacity={0.88} style={[styles.longCard, { width: HALF_W }]}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.92)']} style={StyleSheet.absoluteFillObject} />
      {rank && <Text style={styles.rankBadge}>{rank}</Text>}
      <View style={styles.durationTypeBadge}>
        <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.7)" />
        <Text style={styles.durationTypeBadgeText}>{formatDuration(film.duration_minutes)}</Text>
      </View>
      <View style={styles.longCardInfo}>
        <View style={[styles.badge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary, marginBottom: 6 }]}>
          <Text style={styles.badgeText}>{film.genre}</Text>
        </View>
        <Text style={styles.longCardTitle} numberOfLines={2}>{film.title}</Text>
        <Text style={styles.longCardDir} numberOfLines={1}>{film.director}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Medium landscape card (full width) — 10-40 min
function MediumLandscapeCard({ film, onPress }: { film: Film; onPress: () => void }) {
  return (
    <TouchableOpacity testID={`medium-card-${film.id}`} onPress={onPress} activeOpacity={0.88} style={styles.mediumCard}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.durationTypeBadge}>
        <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.7)" />
        <Text style={styles.durationTypeBadgeText}>{formatDuration(film.duration_minutes)} · Moyen Métrage</Text>
      </View>
      <View style={styles.mediumCardInfo}>
        <View style={[styles.badge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary }]}>
          <Text style={styles.badgeText}>{film.genre}</Text>
        </View>
        <Text style={styles.mediumCardTitle}>{film.title}</Text>
        <Text style={styles.mediumCardDir}>{film.director} · {film.year}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Ionicons name="star" size={11} color="#FFD60A" />
          <Text style={styles.mediumCardRating}>{film.rating}</Text>
          <Text style={styles.mediumCardViews}>· {(film.views_count / 1000).toFixed(1)}K vues</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Short square card (1/3 width, square) — < 10 min
function ShortSquareCard({ film, onPress }: { film: Film; onPress: () => void }) {
  const size = (width - SPACING.screenEdge * 2 - CARD_GAP * 2) / 3;
  return (
    <TouchableOpacity testID={`short-card-${film.id}`} onPress={onPress} activeOpacity={0.88} style={[styles.shortCard, { width: size, height: size }]}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.88)']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.shortDurationBadge}>
        <Text style={styles.shortDurationText}>{formatDuration(film.duration_minutes)}</Text>
      </View>
      <View style={styles.shortCardInfo}>
        <Text style={styles.shortCardTitle} numberOfLines={2}>{film.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

function buildBentoRows(films: Film[]) {
  const long = films.filter(f => f.duration_type === 'long');
  const medium = films.filter(f => f.duration_type === 'medium');
  const short = films.filter(f => f.duration_type === 'short');
  return { long, medium, short };
}

export default function HomeScreen() {
  const router = useRouter();
  const [films, setFilms] = useState<Film[]>([]);
  const [featured, setFeatured] = useState<Film | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('Tous');

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

  const { long, medium, short } = buildBentoRows(films);

  function goFilm(id: string) { router.push(`/film/${id}`); }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <GlobalHeader notificationCount={2} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={COLORS.primary} />}
        >
          {/* Genre filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreBar} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8 }}>
            {GENRES.map(g => (
              <TouchableOpacity key={g} testID={`genre-${g}`} onPress={() => setSelectedGenre(g)} activeOpacity={0.8}>
                {selectedGenre === g ? (
                  <LinearGradient colors={GRADIENTS.primary} style={styles.genreActive} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={[styles.genreText, { color: '#fff', fontWeight: '700' }]}>{g}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.genreInactive}><Text style={styles.genreText}>{g}</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.bentoContainer}>
            {/* HERO — Featured film */}
            {featured && (
              <View style={styles.bentoSection}>
                <View style={styles.sectionLabelRow}>
                  <View style={styles.sectionLabelDot} />
                  <Text style={styles.sectionLabel}>À LA UNE</Text>
                </View>
                <HeroBanner film={featured} onPress={() => goFilm(featured.id)} />
              </View>
            )}

            {/* Long films — pair of portrait cards */}
            {long.length > 0 && (
              <View style={styles.bentoSection}>
                <View style={styles.sectionLabelRow}>
                  <View style={styles.sectionLabelDot} />
                  <Text style={styles.sectionLabel}>LONGS MÉTRAGES · 40+ MIN</Text>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/category/[type]', params: { type: 'seen' } })}>
                    <Text style={styles.seeAll}>Voir tout</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.pairRow}>
                  {long.slice(0, 2).map((film, i) => (
                    <LongPortraitCard key={film.id} film={film} onPress={() => goFilm(film.id)} />
                  ))}
                </View>
                {long.length > 2 && (
                  <View style={[styles.pairRow, { marginTop: CARD_GAP }]}>
                    {long.slice(2, 4).map(film => (
                      <LongPortraitCard key={film.id} film={film} onPress={() => goFilm(film.id)} />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Medium films — full width landscape */}
            {medium.length > 0 && (
              <View style={styles.bentoSection}>
                <View style={styles.sectionLabelRow}>
                  <View style={[styles.sectionLabelDot, { backgroundColor: '#A78BFA' }]} />
                  <Text style={styles.sectionLabel}>MOYENS MÉTRAGES · 10–40 MIN</Text>
                </View>
                {medium.map(film => (
                  <View key={film.id} style={{ marginBottom: CARD_GAP }}>
                    <MediumLandscapeCard film={film} onPress={() => goFilm(film.id)} />
                  </View>
                ))}
              </View>
            )}

            {/* Short films — trio of squares */}
            {short.length > 0 && (
              <View style={styles.bentoSection}>
                <View style={styles.sectionLabelRow}>
                  <View style={[styles.sectionLabelDot, { backgroundColor: '#34D399' }]} />
                  <Text style={styles.sectionLabel}>COURTS MÉTRAGES · {'< 10 MIN'}</Text>
                </View>
                <View style={styles.trioRow}>
                  {short.map(film => (
                    <ShortSquareCard key={film.id} film={film} onPress={() => goFilm(film.id)} />
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  genreBar: { paddingVertical: 14 },
  genreActive: { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 7 },
  genreInactive: { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: COLORS.border },
  genreText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '500' },
  bentoContainer: { paddingHorizontal: SPACING.screenEdge },
  bentoSection: { marginBottom: 28 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionLabelDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  sectionLabel: { flex: 1, fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 2 },
  seeAll: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  // Hero Banner
  heroBanner: { height: 280, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surface },
  heroPlayBtn: { position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(140,46,186,0.8)', alignItems: 'center', justifyContent: 'center' },
  heroMeta: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  heroBadges: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  badge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  durationBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(140,46,186,0.5)', borderWidth: 1, borderColor: COLORS.primary },
  durationBadgeText: { color: '#fff', fontSize: 10 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 4 },
  heroDir: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  heroRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  heroRatingText: { color: '#FFD60A', fontSize: 11, fontWeight: '700', marginLeft: 4 },
  // Long card
  longCard: { height: 240, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface, position: 'relative' },
  rankBadge: { position: 'absolute', top: 10, left: 10, fontSize: 24, fontWeight: '900', color: 'rgba(140,46,186,0.9)', zIndex: 2 },
  durationTypeBadge: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4 },
  durationTypeBadgeText: { color: 'rgba(255,255,255,0.7)', fontSize: 9 },
  longCardInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
  longCardTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  longCardDir: { color: COLORS.textSecondary, fontSize: 10 },
  pairRow: { flexDirection: 'row', gap: CARD_GAP },
  // Medium card
  mediumCard: { height: 160, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface, position: 'relative' },
  mediumCardInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  mediumCardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 6 },
  mediumCardDir: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  mediumCardRating: { color: '#FFD60A', fontSize: 11, fontWeight: '600' },
  mediumCardViews: { color: COLORS.textTertiary, fontSize: 11 },
  // Short card
  shortCard: { borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface, position: 'relative' },
  trioRow: { flexDirection: 'row', gap: CARD_GAP, flexWrap: 'wrap' },
  shortDurationBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 3 },
  shortDurationText: { color: COLORS.primary, fontSize: 9, fontWeight: '700' },
  shortCardInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 7 },
  shortCardTitle: { color: '#fff', fontSize: 10, fontWeight: '600' },
});
