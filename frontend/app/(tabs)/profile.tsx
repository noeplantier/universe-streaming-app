import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS, GENRE_COLORS } from '../../constants/theme';
import { reviewsAPI, seenAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');
const PROFILE_TABS = ['Top 10', 'Critiques', 'Films Vus', 'Réalisés'] as const;
type ProfileTab = typeof PROFILE_TABS[number];

interface Review {
  id: string; film_id: string; content: string; rating: number;
  likes_count: number; created_at: string;
  film?: { id: string; title: string; poster_url: string; genre: string; duration_type: string };
}
interface Film {
  id: string; title: string; poster_url: string; genre: string; duration_type: string; rating: number;
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color="#FFD60A" />
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('Top 10');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [seenFilms, setSeenFilms] = useState<Film[]>([]);
  const [top10Films, setTop10Films] = useState<Film[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      // Top10 from seen or reviews films
      const top = (reviewsData || []).map((r: Review) => r.film).filter(Boolean).slice(0, 10);
      setTop10Films(top);
    } catch (e) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadProfileData(); }, [loadProfileData]);

  function formatFollowers(n: number) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return `${n}`;
  }

  function renderTabContent() {
    if (loading) return <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />;

    if (activeTab === 'Top 10') {
      const films = top10Films.length > 0 ? top10Films : seenFilms.slice(0, 10);
      if (!films.length) return <EmptyState icon="star-outline" text="Aucun film dans votre Top 10" />;
      return (
        <View style={styles.top10List}>
          {films.map((film, idx) => (
            <TouchableOpacity key={film.id} testID={`top10-film-${film.id}`} onPress={() => router.push(`/film/${film.id}`)} style={styles.top10Item} activeOpacity={0.8}>
              <Text style={styles.top10Rank}>{String(idx + 1).padStart(2, '0')}</Text>
              <Image source={{ uri: film.poster_url }} style={styles.top10Image} />
              <View style={styles.top10Info}>
                <Text style={styles.top10Title} numberOfLines={1}>{film.title}</Text>
                <View style={[styles.genreBadge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary, alignSelf: 'flex-start', marginTop: 4 }]}>
                  <Text style={styles.genreBadgeText}>{film.genre}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (activeTab === 'Critiques') {
      if (!reviews.length) return <EmptyState icon="chatbubble-outline" text="Aucune critique publiée" />;
      return (
        <View style={styles.reviewsList}>
          {reviews.map(review => (
            <TouchableOpacity key={review.id} testID={`profile-review-${review.id}`} onPress={() => review.film && router.push(`/film/${review.film.id}`)} style={styles.reviewCard} activeOpacity={0.8}>
              {review.film && (
                <Image source={{ uri: review.film.poster_url }} style={styles.reviewFilmImage} />
              )}
              <View style={styles.reviewContent}>
                {review.film && <Text style={styles.reviewFilmTitle} numberOfLines={1}>{review.film.title}</Text>}
                <StarRating rating={review.rating} />
                <Text style={styles.reviewText} numberOfLines={3}>{review.content}</Text>
                <View style={styles.reviewMeta}>
                  <Ionicons name="heart-outline" size={12} color={COLORS.textTertiary} />
                  <Text style={styles.reviewMetaText}>{review.likes_count}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (activeTab === 'Films Vus') {
      if (!seenFilms.length) return <EmptyState icon="film-outline" text="Aucun film vu pour l'instant" />;
      return (
        <View style={styles.seenGrid}>
          {seenFilms.map(film => (
            <TouchableOpacity key={film.id} testID={`seen-film-${film.id}`} onPress={() => router.push(`/film/${film.id}`)} style={styles.seenCard} activeOpacity={0.8}>
              <Image source={{ uri: film.poster_url }} style={styles.seenImage} />
              <LinearGradient colors={GRADIENTS.cardOverlay} style={StyleSheet.absoluteFillObject} />
              <View style={styles.seenCheck}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
              <Text style={styles.seenTitle} numberOfLines={2}>{film.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (activeTab === 'Réalisés') {
      return <EmptyState icon="camera-outline" text="Aucun film réalisé" subtext="Soumettez votre court métrage" />;
    }

    return null;
  }

  if (!user) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfileData(); }} tintColor={COLORS.primary} />}
      >
        {/* Profile Header */}
        <View style={styles.profileHeaderBg}>
          <LinearGradient colors={['#240056', '#8C2EBA', '#000000']} style={StyleSheet.absoluteFillObject} locations={[0, 0.5, 1]} />
          <SafeAreaView edges={['top']}>
            <View style={styles.headerActions}>
              <Text style={styles.headerLogoText}>UNIVERSE</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity testID="profile-settings-btn" onPress={() => router.push('/settings')} style={styles.headerIconBtn}>
                  <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          <View style={styles.profileInfo}>
            <View style={styles.avatarWrapper}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.avatarRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              </LinearGradient>
              {user.role === 'director' && <View style={styles.roleIconBadge}><Text style={{ fontSize: 12 }}>🎬</Text></View>}
              {user.role === 'creator' && <View style={styles.roleIconBadge}><Text style={{ fontSize: 12 }}>⭐</Text></View>}
              {user.role === 'critic' && <View style={styles.roleIconBadge}><Text style={{ fontSize: 12 }}>✍️</Text></View>}
            </View>

            <Text style={styles.username}>{user.username}</Text>
            <Text style={styles.bio}>{user.bio}</Text>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user.reviews_count}</Text>
                <Text style={styles.statLabel}>Critiques</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user.films_seen_count}</Text>
                <Text style={styles.statLabel}>Films Vus</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatFollowers(user.followers_count)}</Text>
                <Text style={styles.statLabel}>Abonnés</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatFollowers(user.following_count)}</Text>
                <Text style={styles.statLabel}>Abonnements</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Horizontal Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8 }}>
            {PROFILE_TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                testID={`profile-tab-${tab}`}
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                activeOpacity={0.8}
              >
                {activeTab === tab ? (
                  <LinearGradient colors={GRADIENTS.primary} style={styles.tabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={[styles.tabText, styles.tabTextActive]}>{tab}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.tabText}>{tab}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>
      </ScrollView>
    </View>
  );
}

function EmptyState({ icon, text, subtext }: { icon: string; text: string; subtext?: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={48} color={COLORS.textTertiary} />
      <Text style={styles.emptyText}>{text}</Text>
      {subtext && <Text style={styles.emptySubText}>{subtext}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profileHeaderBg: { paddingBottom: 28 },
  headerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.screenEdge, paddingVertical: 12 },
  headerLogoText: { fontSize: 16, fontWeight: '900', color: 'rgba(255,255,255,0.9)', letterSpacing: 5 },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 18 },
  profileInfo: { alignItems: 'center', paddingHorizontal: SPACING.screenEdge },
  avatarWrapper: { marginBottom: 12, position: 'relative' },
  avatarRing: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.background },
  roleIconBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  username: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  bio: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: RADIUS.lg, paddingVertical: 16, paddingHorizontal: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabsContainer: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  tab: { borderRadius: RADIUS.full, overflow: 'hidden' },
  tabActive: {},
  tabGrad: { paddingHorizontal: 20, paddingVertical: 9 },
  tabText: { color: COLORS.textTertiary, fontSize: 13, fontWeight: '500', paddingHorizontal: 16, paddingVertical: 9 },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  tabContent: { paddingHorizontal: SPACING.screenEdge, paddingTop: 20 },
  // Top 10
  top10List: { gap: 12 },
  top10Item: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  top10Rank: { fontSize: 22, fontWeight: '900', color: COLORS.primary, width: 32, textAlign: 'center' },
  top10Image: { width: 48, height: 64, borderRadius: 8 },
  top10Info: { flex: 1 },
  top10Title: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  genreBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  genreBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  // Reviews
  reviewsList: { gap: 12 },
  reviewCard: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  reviewFilmImage: { width: 52, height: 72, borderRadius: 8 },
  reviewContent: { flex: 1, gap: 6 },
  reviewFilmTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  reviewText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewMetaText: { color: COLORS.textTertiary, fontSize: 11 },
  // Seen Grid
  seenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  seenCard: { width: (width - SPACING.screenEdge * 2 - 20) / 3, aspectRatio: 0.7, borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: COLORS.surface },
  seenImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  seenCheck: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  seenTitle: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 6, color: '#fff', fontSize: 9, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.7)' },
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },
  emptySubText: { color: COLORS.textTertiary, fontSize: 13 },
});
