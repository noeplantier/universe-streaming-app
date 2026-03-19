import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS, GENRE_COLORS, DURATION_LABELS } from '../constants/theme';
import { watchlistAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Film {
  id: string; title: string; director: string; duration_minutes: number;
  duration_type: string; genre: string; poster_url: string; rating: number;
}

function formatDuration(min: number) {
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}m` : ''}`;
}

export default function WatchlistScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    if (!user) return;
    try {
      const data = await watchlistAPI.get(user.id);
      setFilms(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { fetchWatchlist(); }, [fetchWatchlist]);

  async function handleRemove(filmId: string) {
    try {
      await watchlistAPI.remove(filmId);
      setFilms(prev => prev.filter(f => f.id !== filmId));
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="watchlist-back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Ma Watchlist</Text>
            <Text style={styles.headerSub}>{films.length} film{films.length !== 1 ? 's' : ''} à voir</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={films}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 8, paddingHorizontal: SPACING.screenEdge, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWatchlist(); }} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`watchlist-film-${item.id}`}
              onPress={() => router.push(`/film/${item.id}`)}
              style={styles.filmCard}
              activeOpacity={0.85}
            >
              <Image source={{ uri: item.poster_url }} style={styles.poster} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFillObject} />

              <View style={styles.info}>
                <View style={styles.badges}>
                  <View style={[styles.genreBadge, { backgroundColor: GENRE_COLORS[item.genre] || COLORS.primary }]}>
                    <Text style={styles.genreBadgeText}>{item.genre}</Text>
                  </View>
                  <Text style={styles.durationText}>{DURATION_LABELS[item.duration_type]} · {formatDuration(item.duration_minutes)}</Text>
                </View>
                <Text style={styles.filmTitle}>{item.title}</Text>
                <Text style={styles.filmDir}>{item.director}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={12} color="#FFD60A" />
                  <Text style={styles.ratingText}>{item.rating}</Text>
                </View>
              </View>

              <TouchableOpacity
                testID={`watchlist-remove-${item.id}`}
                onPress={() => handleRemove(item.id)}
                style={styles.removeBtn}
              >
                <Ionicons name="bookmark" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bookmark-outline" size={56} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>Watchlist vide</Text>
              <Text style={styles.emptyText}>Ajoutez des films depuis leurs fiches</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/search')} style={styles.discoverBtn}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.discoverBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.discoverBtnText}>Découvrir des films</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screenEdge, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filmCard: { height: 130, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surface, flexDirection: 'row', position: 'relative' },
  poster: { width: 90, height: '100%' },
  info: { flex: 1, padding: 14, justifyContent: 'flex-end' },
  badges: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
  genreBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  genreBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  durationText: { color: COLORS.textTertiary, fontSize: 10 },
  filmTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  filmDir: { color: COLORS.textSecondary, fontSize: 11 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { color: '#FFD60A', fontSize: 11, fontWeight: '600' },
  removeBtn: { position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  discoverBtn: { marginTop: 8 },
  discoverBtnGrad: { borderRadius: RADIUS.full, paddingHorizontal: 24, paddingVertical: 12 },
  discoverBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
