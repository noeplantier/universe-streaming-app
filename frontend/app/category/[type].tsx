import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS, GENRE_COLORS, DURATION_LABELS } from '../../constants/theme';
import { reviewsAPI, seenAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

type CategoryType = 'top10' | 'critiques' | 'seen' | 'directed';

const CATEGORY_META: Record<CategoryType, { title: string; subtitle: string; icon: string; color: string }> = {
  top10:     { title: 'Mon Top 10',      subtitle: 'Mes films préférés de tous les temps', icon: 'trophy-outline',        color: '#FFD60A' },
  critiques: { title: 'Mes Critiques',   subtitle: 'Toutes mes critiques de films',        icon: 'chatbubble-outline',    color: COLORS.primary },
  seen:      { title: 'Films Vus',        subtitle: 'Mon journal de cinéphile',             icon: 'film-outline',          color: COLORS.success },
  directed:  { title: 'Films Réalisés',   subtitle: 'Ma filmographie en tant que réalisateur', icon: 'camera-outline',    color: '#FF6B6B' },
};

interface Film {
  id: string; title: string; director: string; duration_minutes: number;
  duration_type: string; genre: string; poster_url: string; rating: number; year: number;
}
interface Review {
  id: string; film_id: string; content: string; rating: number;
  likes_count: number; created_at: string;
  film?: Film;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(s => <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={12} color="#FFD60A" />)}
    </View>
  );
}

export default function CategoryScreen() {
  const { type, userId } = useLocalSearchParams<{ type: CategoryType; userId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const meta = CATEGORY_META[type] || CATEGORY_META.seen;

  const fetchData = useCallback(async () => {
    const uid = userId || user?.id;
    if (!uid) { setLoading(false); return; }
    try {
      if (type === 'critiques') {
        const reviews = await reviewsAPI.getByUser(uid);
        setData(reviews || []);
      } else if (type === 'seen' || type === 'top10') {
        const films = await seenAPI.getByUser(uid);
        setData(films || []);
      } else {
        setData([]);
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [type, userId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function renderItem({ item, index }: { item: any; index: number }) {
    if (type === 'critiques') {
      const review = item as Review;
      return (
        <TouchableOpacity
          testID={`category-review-${review.id}`}
          style={styles.reviewCard}
          onPress={() => review.film && router.push(`/film/${review.film.id}`)}
          activeOpacity={0.85}
        >
          {review.film && (
            <Image source={{ uri: review.film.poster_url }} style={styles.reviewPoster} />
          )}
          <View style={styles.reviewBody}>
            <View style={styles.reviewTop}>
              {review.film && (
                <Text style={styles.reviewFilmTitle} numberOfLines={1}>{review.film.title}</Text>
              )}
              <StarRow rating={review.rating} />
            </View>
            <Text style={styles.reviewText} numberOfLines={4}>{review.content}</Text>
            <View style={styles.reviewMeta}>
              <Ionicons name="heart-outline" size={14} color={COLORS.textTertiary} />
              <Text style={styles.reviewMetaText}>{review.likes_count} j'aime</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Film item (seen / top10)
    const film = item as Film;
    return (
      <TouchableOpacity
        testID={`category-film-${film.id}`}
        style={styles.filmCard}
        onPress={() => router.push(`/film/${film.id}`)}
        activeOpacity={0.85}
      >
        {type === 'top10' && (
          <Text style={styles.rankNumber}>{String(index + 1).padStart(2, '0')}</Text>
        )}
        <Image source={{ uri: film.poster_url }} style={styles.filmPoster} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.filmInfo}>
          <View style={[styles.genreBadge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary }]}>
            <Text style={styles.genreBadgeText}>{film.genre}</Text>
          </View>
          <Text style={styles.filmTitle}>{film.title}</Text>
          <Text style={styles.filmDir}>{film.director} · {film.year}</Text>
          <View style={styles.filmRating}>
            <Ionicons name="star" size={12} color="#FFD60A" />
            <Text style={styles.filmRatingText}>{film.rating}</Text>
            <Text style={styles.filmDuration}>{DURATION_LABELS[film.duration_type]}</Text>
          </View>
        </View>
        {type === 'seen' && (
          <View style={styles.seenBadge}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="category-back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{meta.title}</Text>
            <Text style={styles.headerSub}>{data.length} {type === 'critiques' ? 'critique' : 'film'}{data.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {/* Category Hero */}
      <LinearGradient
        colors={['rgba(140,46,186,0.15)', 'transparent']}
        style={styles.categoryHero}
      >
        <View style={[styles.categoryIconWrap, { backgroundColor: `${meta.color}20` }]}>
          <Ionicons name={meta.icon as any} size={32} color={meta.color} />
        </View>
        <Text style={styles.categoryTitle}>{meta.title}</Text>
        <Text style={styles.categorySubtitle}>{meta.subtitle}</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id || String(i)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, paddingBottom: 60, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={meta.icon as any} size={52} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>Aucun contenu pour l'instant</Text>
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
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  headerSub: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  categoryHero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: SPACING.screenEdge, marginBottom: 8 },
  categoryIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  categoryTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  categorySubtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  // Review card
  reviewCard: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.borderLight },
  reviewPoster: { width: 56, height: 80, borderRadius: RADIUS.sm },
  reviewBody: { flex: 1, gap: 6 },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reviewFilmTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  reviewText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewMetaText: { color: COLORS.textTertiary, fontSize: 11 },
  // Film card
  filmCard: { height: 180, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'flex-end', position: 'relative' },
  rankNumber: { position: 'absolute', left: 12, top: 12, fontSize: 36, fontWeight: '900', color: 'rgba(140,46,186,0.8)', zIndex: 2 },
  filmPoster: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  filmInfo: { flex: 1, padding: 14, gap: 4 },
  genreBadge: { alignSelf: 'flex-start', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  genreBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  filmTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  filmDir: { color: COLORS.textSecondary, fontSize: 11 },
  filmRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  filmRatingText: { color: '#FFD60A', fontSize: 11, fontWeight: '600' },
  filmDuration: { color: COLORS.textTertiary, fontSize: 10, marginLeft: 8 },
  seenBadge: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
});
