import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS, DURATION_LABELS, GENRE_COLORS } from '../../constants/theme';
import { filmsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

const GENRES = ['Tous', 'Thriller', 'Drame', 'Romance', 'Fantasy', 'Science-Fiction', 'Documentaire'];

interface Film {
  id: string; title: string; director: string; duration_minutes: number;
  duration_type: string; genre: string; synopsis: string; poster_url: string;
  year: number; rating: number; views_count: number; content_type: string;
}

function formatDuration(min: number) {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}m` : ''}`;
}

function LongCard({ film, onPress }: { film: Film; onPress: () => void }) {
  return (
    <TouchableOpacity testID={`film-long-${film.id}`} onPress={onPress} activeOpacity={0.9} style={styles.longCard}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={GRADIENTS.heroOverlay} style={StyleSheet.absoluteFillObject} />
      <View style={styles.durationBadge}>
        <Text style={styles.durationBadgeText}>{DURATION_LABELS[film.duration_type]}</Text>
      </View>
      <View style={styles.longCardInfo}>
        <View style={[styles.genreBadge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary }]}>
          <Text style={styles.genreBadgeText}>{film.genre}</Text>
        </View>
        <Text style={styles.longCardTitle} numberOfLines={2}>{film.title}</Text>
        <Text style={styles.longCardDir}>{film.director} · {formatDuration(film.duration_minutes)}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#FFD60A" />
          <Text style={styles.ratingText}>{film.rating}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MediumCard({ film, onPress }: { film: Film; onPress: () => void }) {
  return (
    <TouchableOpacity testID={`film-medium-${film.id}`} onPress={onPress} activeOpacity={0.9} style={styles.mediumCard}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={GRADIENTS.cardOverlay} style={StyleSheet.absoluteFillObject} />
      <View style={styles.durationBadge}>
        <Text style={styles.durationBadgeText}>{DURATION_LABELS[film.duration_type]}</Text>
      </View>
      <View style={styles.mediumCardInfo}>
        <View style={[styles.genreBadge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary }]}>
          <Text style={styles.genreBadgeText}>{film.genre}</Text>
        </View>
        <Text style={styles.mediumCardTitle} numberOfLines={1}>{film.title}</Text>
        <Text style={styles.mediumCardDir} numberOfLines={1}>{film.director} · {formatDuration(film.duration_minutes)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ShortCard({ film, onPress }: { film: Film; onPress: () => void }) {
  return (
    <TouchableOpacity testID={`film-short-${film.id}`} onPress={onPress} activeOpacity={0.9} style={styles.shortCard}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={GRADIENTS.cardOverlay} style={StyleSheet.absoluteFillObject} />
      <View style={styles.shortCardInfo}>
        <Text style={styles.shortDuration}>{formatDuration(film.duration_minutes)}</Text>
        <Text style={styles.shortCardTitle} numberOfLines={2}>{film.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('Tous');

  const fetchFilms = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedGenre !== 'Tous') params.genre = selectedGenre;
      const data = await filmsAPI.getAll(params);
      setFilms(data);
    } catch (e) {
      console.error('Error fetching films:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedGenre]);

  useEffect(() => { fetchFilms(); }, [fetchFilms]);

  const longFilms = films.filter(f => f.duration_type === 'long');
  const mediumFilms = films.filter(f => f.duration_type === 'medium');
  const shortFilms = films.filter(f => f.duration_type === 'short');

  function goToFilm(id: string) {
    router.push(`/film/${id}`);
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.background }}>
        <View style={styles.header}>
          <Text style={styles.logo}>UNIVERSE</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity testID="home-search-btn" onPress={() => router.push('/(tabs)/search')} style={styles.headerBtn}>
              <Ionicons name="search-outline" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity testID="home-notif-btn" style={styles.headerBtn}>
              <Ionicons name="notifications-outline" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFilms(); }} tintColor={COLORS.primary} />}
        >
          {/* Greeting */}
          <View style={styles.greetingRow}>
            <View>
              <Text style={styles.greetingText}>Bonjour{user ? `, ${user.username}` : ''} 👋</Text>
              <Text style={styles.greetingSubtext}>Que souhaitez-vous découvrir ?</Text>
            </View>
          </View>

          {/* Genre Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8 }}>
            {GENRES.map(g => (
              <TouchableOpacity
                key={g}
                testID={`genre-filter-${g}`}
                onPress={() => setSelectedGenre(g)}
                activeOpacity={0.8}
              >
                {selectedGenre === g ? (
                  <LinearGradient colors={GRADIENTS.primary} style={styles.genreActive} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={[styles.genreText, { color: '#fff', fontWeight: '700' }]}>{g}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.genreInactive}>
                    <Text style={styles.genreText}>{g}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Long Films Section */}
          {longFilms.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Longs Métrages</Text>
                <Text style={styles.sectionSub}>40+ min</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 12 }}>
                {longFilms.map(film => (
                  <LongCard key={film.id} film={film} onPress={() => goToFilm(film.id)} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Medium Films Section */}
          {mediumFilms.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Moyens Métrages</Text>
                <Text style={styles.sectionSub}>10 — 40 min</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 12 }}>
                {mediumFilms.map(film => (
                  <MediumCard key={film.id} film={film} onPress={() => goToFilm(film.id)} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Short Films Section */}
          {shortFilms.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Courts Métrages</Text>
                <Text style={styles.sectionSub}>{'< 10 min'}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 12 }}>
                {shortFilms.map(film => (
                  <ShortCard key={film.id} film={film} onPress={() => goToFilm(film.id)} />
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenEdge, paddingVertical: 12,
  },
  logo: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 6, textShadowColor: '#8C2EBA', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  greetingRow: { paddingHorizontal: SPACING.screenEdge, paddingTop: 16, paddingBottom: 8 },
  greetingText: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  greetingSubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  genreScroll: { marginVertical: 16 },
  genreActive: { borderRadius: RADIUS.full, paddingHorizontal: 18, paddingVertical: 8 },
  genreInactive: { borderRadius: RADIUS.full, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: COLORS.border },
  genreText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: SPACING.screenEdge, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  sectionSub: { fontSize: 12, color: COLORS.textTertiary, fontWeight: '400' },
  // Long card: tall portrait, 160x240
  longCard: { width: 160, height: 240, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface },
  longCardInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
  longCardTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 6 },
  longCardDir: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { color: '#FFD60A', fontSize: 11, fontWeight: '600' },
  // Medium card: landscape wide, 260x160
  mediumCard: { width: 260, height: 160, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface },
  mediumCardInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
  mediumCardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 4 },
  mediumCardDir: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  // Short card: square small, 110x110
  shortCard: { width: 110, height: 110, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface },
  shortCardInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8 },
  shortDuration: { color: COLORS.primary, fontSize: 10, fontWeight: '700' },
  shortCardTitle: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 2 },
  genreBadge: { alignSelf: 'flex-start', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  genreBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  durationBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(140,46,186,0.5)',
  },
  durationBadgeText: { color: COLORS.textSecondary, fontSize: 9, fontWeight: '500' },
});
