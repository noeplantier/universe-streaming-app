import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
  Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS, DURATION_LABELS, GENRE_COLORS } from '../../constants/theme';
import { filmsAPI } from '../../services/api';

const GENRES = ['Tous', 'Thriller', 'Drame', 'Romance', 'Fantasy', 'Science-Fiction', 'Documentaire'];
const DURATIONS = [
  { key: 'all', label: 'Toutes durées' },
  { key: 'short', label: '< 10 min' },
  { key: 'medium', label: '10-40 min' },
  { key: 'long', label: '40+ min' },
];

interface Film {
  id: string; title: string; director: string; duration_minutes: number;
  duration_type: string; genre: string; poster_url: string;
  year: number; rating: number; views_count: number;
}

function FilmSearchCard({ film, onPress }: { film: Film; onPress: () => void }) {
  return (
    <TouchableOpacity testID={`search-film-${film.id}`} onPress={onPress} style={styles.filmCard} activeOpacity={0.8}>
      <Image source={{ uri: film.poster_url }} style={styles.filmCardImage} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.filmCardOverlay}>
        <View style={[styles.genreBadge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary }]}>
          <Text style={styles.genreBadgeText}>{film.genre}</Text>
        </View>
        <Text style={styles.filmCardTitle} numberOfLines={2}>{film.title}</Text>
        <Text style={styles.filmCardDir} numberOfLines={1}>{film.director}</Text>
        <View style={styles.filmCardMeta}>
          <Text style={styles.filmCardDuration}>{DURATION_LABELS[film.duration_type]}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="star" size={11} color="#FFD60A" />
            <Text style={styles.filmCardRating}>{film.rating}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Tous');
  const [selectedDuration, setSelectedDuration] = useState('all');
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchFilms = useCallback(async (q?: string) => {
    setSearchLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedGenre !== 'Tous') params.genre = selectedGenre;
      if (selectedDuration !== 'all') params.duration_type = selectedDuration;
      if (q) params.q = q;
      const data = await filmsAPI.getAll(params);
      setFilms(data);
    } catch {} finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, [selectedGenre, selectedDuration]);

  useEffect(() => {
    const timer = setTimeout(() => fetchFilms(query), 300);
    return () => clearTimeout(timer);
  }, [query, selectedGenre, selectedDuration, fetchFilms]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.background }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Découvrir</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textTertiary} style={{ marginRight: 10 }} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            placeholder="Rechercher un film, réalisateur..."
            placeholderTextColor={COLORS.textTertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
          {searchLoading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
        </View>

        {/* Duration Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8 }}>
          {DURATIONS.map(d => (
            <TouchableOpacity
              key={d.key}
              testID={`duration-filter-${d.key}`}
              onPress={() => setSelectedDuration(d.key)}
              style={[styles.filterChip, selectedDuration === d.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, selectedDuration === d.key && styles.filterChipTextActive]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Genre Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8 }}>
          {GENRES.map(g => (
            <TouchableOpacity
              key={g}
              testID={`genre-search-${g}`}
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
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={films}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: SPACING.screenEdge }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FilmSearchCard film={item} onPress={() => router.push(`/film/${item.id}`)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="film-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>Aucun film trouvé</Text>
              <Text style={styles.emptySubText}>Essayez d&aposautres filtres</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.screenEdge, paddingVertical: 14 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.md, marginHorizontal: SPACING.screenEdge,
    paddingHorizontal: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15, paddingVertical: 14 },
  filterRow: { marginBottom: 10 },
  filterChip: {
    borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderLight,
  },
  filterChipActive: { backgroundColor: 'rgba(140,46,186,0.3)', borderColor: COLORS.primary },
  filterChipText: { color: COLORS.textTertiary, fontSize: 12 },
  filterChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  genreActive: { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 7, marginBottom: 14 },
  genreInactive: { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  genreText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '500' },
  filmCard: { flex: 1, height: 200, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface },
  filmCardImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  filmCardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
  genreBadge: { alignSelf: 'flex-start', borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 4 },
  genreBadgeText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  filmCardTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  filmCardDir: { color: COLORS.textSecondary, fontSize: 10, marginTop: 2 },
  filmCardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  filmCardDuration: { color: COLORS.textTertiary, fontSize: 9 },
  filmCardRating: { color: '#FFD60A', fontSize: 10, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 18, fontWeight: '600' },
  emptySubText: { color: COLORS.textTertiary, fontSize: 13 },
});
