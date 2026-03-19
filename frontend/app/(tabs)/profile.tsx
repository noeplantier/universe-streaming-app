import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS, GENRE_COLORS, DURATION_LABELS } from '../../constants/theme';
import { reviewsAPI, seenAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import GlobalHeader from '../../components/GlobalHeader';

const { width } = Dimensions.get('window');
const PROFILE_TABS = ['Top 10', 'Critiques', 'Films Vus', 'Réalisés'] as const;
type ProfileTab = typeof PROFILE_TABS[number];

const TAB_TYPE_MAP: Record<ProfileTab, string> = {
  'Top 10': 'top10',
  'Critiques': 'critiques',
  'Films Vus': 'seen',
  'Réalisés': 'directed',
};

interface Review {
  id: string; film_id: string; content: string; rating: number;
  likes_count: number; created_at: string;
  film?: { id: string; title: string; poster_url: string; genre: string; duration_type: string };
}
interface Film {
  id: string; title: string; poster_url: string; genre: string; duration_type: string; rating: number;
}

function StarRating({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(s => <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color="#FFD60A" />)}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('Top 10');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [seenFilms, setSeenFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [revData, seenData] = await Promise.all([
        reviewsAPI.getByUser(user.id),
        seenAPI.getByUser(user.id),
      ]);
      setReviews(revData || []);
      setSeenFilms(seenData || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  function formatN(n: number) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
  }

  function renderPreview() {
    if (loading) return <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />;
    const type = TAB_TYPE_MAP[activeTab];
    const films = type === 'top10' ? (reviews.map(r => r.film).filter(Boolean) as Film[]).slice(0, 3)
                : type === 'critiques' ? [] : seenFilms.slice(0, 3);

    if (type === 'critiques') {
      const preview = reviews.slice(0, 3);
      if (!preview.length) return <EmptyPreview tab={activeTab} />;
      return (
        <View style={styles.previewList}>
          {preview.map(rev => (
            <TouchableOpacity key={rev.id} style={styles.reviewRow} onPress={() => rev.film && router.push(`/film/${rev.film.id}`)}>
              {rev.film && <Image source={{ uri: rev.film.poster_url }} style={styles.reviewPoster} />}
              <View style={{ flex: 1 }}>
                {rev.film && <Text style={styles.reviewFilmTitle} numberOfLines={1}>{rev.film.title}</Text>}
                <StarRating rating={rev.rating} />
                <Text style={styles.reviewText} numberOfLines={2}>{rev.content}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (!films.length) return <EmptyPreview tab={activeTab} />;
    return (
      <View style={styles.filmGrid}>
        {films.map((film, i) => film && (
          <TouchableOpacity key={film.id} style={styles.gridFilm} onPress={() => router.push(`/film/${film.id}`)}>
            <Image source={{ uri: film.poster_url }} style={styles.gridFilmImage} />
            <LinearGradient colors={GRADIENTS.cardOverlay} style={StyleSheet.absoluteFillObject} />
            {activeTab === 'Top 10' && <Text style={styles.gridRank}>{i + 1}</Text>}
            {activeTab === 'Films Vus' && (
              <View style={styles.seenCheck}><Ionicons name="checkmark" size={12} color="#fff" /></View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (!user) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
      >
        {/* Profile Header */}
        <View style={styles.profileBg}>
          <LinearGradient colors={['#240056', '#8C2EBA', '#000000']} style={StyleSheet.absoluteFillObject} locations={[0, 0.5, 1]} />
          <SafeAreaView edges={['top']}>
            <GlobalHeader notificationCount={2} />
          </SafeAreaView>

          <View style={styles.profileContent}>
            <View style={styles.avatarWrap}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.avatarRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              </LinearGradient>
              <View style={styles.roleIconBadge}>
                <Text style={{ fontSize: 10 }}>{user.role === 'director' ? '🎬' : user.role === 'critic' ? '✍️' : '👁️'}</Text>
              </View>
            </View>
            <Text style={styles.username}>{user.username}</Text>
            <Text style={styles.bio}>{user.bio}</Text>

            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/category/[type]', params: { type: 'critiques', userId: user.id } })}>
                <Text style={styles.statVal}>{user.reviews_count}</Text>
                <Text style={styles.statLabel}>Critiques</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/category/[type]', params: { type: 'seen', userId: user.id } })}>
                <Text style={styles.statVal}>{user.films_seen_count}</Text>
                <Text style={styles.statLabel}>Films vus</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{formatN(user.followers_count)}</Text>
                <Text style={styles.statLabel}>Abonnés</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{formatN(user.following_count)}</Text>
                <Text style={styles.statLabel}>Abonnements</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Category Tabs */}
        <View style={styles.tabsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8 }}>
            {PROFILE_TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                testID={`profile-tab-${tab}`}
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
              >
                {activeTab === tab ? (
                  <LinearGradient colors={GRADIENTS.primary} style={styles.tabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={[styles.tabText, { color: '#fff', fontWeight: '700' }]}>{tab}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.tabText}>{tab}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Preview Content + "Voir tout" */}
        <View style={styles.previewSection}>
          {renderPreview()}

          <TouchableOpacity
            testID={`see-all-${activeTab}`}
            onPress={() => router.push({ pathname: '/category/[type]', params: { type: TAB_TYPE_MAP[activeTab], userId: user.id } })}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>Explorer tout — {activeTab}</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function EmptyPreview({ tab }: { tab: ProfileTab }) {
  return (
    <View style={styles.emptyPreview}>
      <Text style={styles.emptyPreviewText}>Aucun contenu dans {tab}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profileBg: { paddingBottom: 24 },
  profileContent: { alignItems: 'center', paddingHorizontal: SPACING.screenEdge, paddingTop: 8 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatarRing: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.background },
  roleIconBadge: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  username: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bio: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 18, paddingHorizontal: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: RADIUS.lg, padding: 14, paddingHorizontal: 8 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabsRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  tab: { borderRadius: RADIUS.full, overflow: 'hidden' },
  tabActive: {},
  tabGrad: { paddingHorizontal: 18, paddingVertical: 8 },
  tabText: { color: COLORS.textTertiary, fontSize: 13, paddingHorizontal: 14, paddingVertical: 8 },
  previewSection: { paddingHorizontal: SPACING.screenEdge, paddingTop: 16 },
  // Preview content
  filmGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  gridFilm: { flex: 1, height: 130, borderRadius: RADIUS.md, overflow: 'hidden', position: 'relative' },
  gridFilmImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  gridRank: { position: 'absolute', top: 6, left: 6, fontSize: 20, fontWeight: '900', color: 'rgba(140,46,186,0.9)' },
  seenCheck: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  reviewRow: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.borderLight },
  reviewPoster: { width: 44, height: 62, borderRadius: 6 },
  reviewFilmTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  reviewText: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4 },
  previewList: { marginBottom: 16 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(140,46,186,0.1)', borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  seeAllText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  emptyPreview: { paddingVertical: 24, alignItems: 'center' },
  emptyPreviewText: { color: COLORS.textTertiary, fontSize: 13 },
});
