import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Dimensions, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS, GENRE_COLORS } from '../../constants/theme';
import { usersAPI, reviewsAPI, seenAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');
const PROFILE_TABS = ['Top 10', 'Critiques', 'Films Vus'] as const;
type ProfileTab = typeof PROFILE_TABS[number];

const TAB_TYPE_MAP: Record<ProfileTab, string> = {
  'Top 10': 'top10',
  'Critiques': 'critiques',
  'Films Vus': 'seen',
};

const ROLE_BADGES: Record<string, { label: string; icon: string }> = {
  director: { label: 'Réalisateur', icon: '🎬' },
  critic:   { label: 'Critique',    icon: '✍️' },
  creator:  { label: 'Créateur',    icon: '⭐' },
  viewer:   { label: 'Spectateur',  icon: '👁️' },
};

interface User {
  id: string; username: string; email: string; avatar_url: string;
  bio: string; role: string; followers_count: number; following_count: number;
  films_seen_count: number; reviews_count: number; is_following?: boolean;
}
interface Film {
  id: string; title: string; poster_url: string; genre: string; rating: number;
}
interface Review {
  id: string; content: string; rating: number; likes_count: number;
  film?: { id: string; title: string; poster_url: string };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(s => <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={12} color="#FFD60A" />)}
    </View>
  );
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('Top 10');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [seenFilms, setSeenFilms] = useState<Film[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  
  const fetchData = useCallback(async () => {
    if (!id) return;
  
    try {
      setLoading(true);
  
      // 1) Récupère le user cible (id métier = "cr2")
      const userData = await usersAPI.getById(id);
      console.log(userData);
      // 2) Déduis l'UUID à utiliser (à adapter selon ton payload)
      const userUuid =
        userData.auth_user_id ??
        userData.user_id ??
        userData.uuid ??
        userData.id;
  
      if (!userUuid) {
        throw new Error("Impossible de trouver l'UUID du user dans usersAPI.getById()");
      }
  
      // (optionnel mais conseillé) log rapide pour vérifier que ce n'est plus "cr2"
      console.log("route id =", id, "userUuid =", userUuid);
  
      // 3) Appelle reviews/seen avec l'UUID
      const [revData, seenData] = await Promise.all([
        reviewsAPI.getByUser(userUuid),
        seenAPI.getByUser(userUuid),
      ]);
  
      setUser(userData);
      setFollowing(!!userData.is_following);
      setReviews(revData || []);
      setSeenFilms(seenData || []);
    } catch (e) {
      console.error("Error fetching user:", e);
      Alert.alert("Erreur", (e as any)?.message ?? "Fetch impossible");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleFollow() {
    if (!currentUser) {
      Alert.alert('Connexion requise', 'Connectez-vous pour suivre cet utilisateur');
      return;
    }
    if (currentUser.id === id) {
      Alert.alert('', 'Vous ne pouvez pas vous suivre vous-même');
      return;
    }
    setFollowLoading(true);
    try {
      const res = await usersAPI.follow(id!);
      setFollowing(res.following);
      setUser(prev => prev ? {
        ...prev,
        followers_count: res.following ? prev.followers_count + 1 : prev.followers_count - 1
      } : null);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setFollowLoading(false);
    }
  }

  function formatN(n: number) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
  }

  function renderContent() {
    const type = TAB_TYPE_MAP[activeTab];
    if (type === 'critiques') {
      const preview = reviews.slice(0, 5);
      if (!preview.length) return <EmptyState text="Aucune critique" />;
      return (
        <View style={styles.contentList}>
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

    const films = seenFilms.slice(0, 6);
    if (!films.length) return <EmptyState text={`Aucun film dans ${activeTab}`} />;
    return (
      <View style={styles.filmGrid}>
        {films.map((film, i) => (
          <TouchableOpacity key={film.id} style={styles.gridFilm} onPress={() => router.push(`/film/${film.id}`)}>
            <Image source={{ uri: film.poster_url }} style={styles.gridFilmImage} />
            <LinearGradient colors={GRADIENTS.cardOverlay} style={StyleSheet.absoluteFillObject} />
            {activeTab === 'Top 10' && <Text style={styles.gridRank}>{i + 1}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-outline" size={48} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Utilisateur introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const roleMeta = ROLE_BADGES[user.role] || ROLE_BADGES.viewer;
  const isOwnProfile = currentUser?.id === user.id;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={COLORS.primary} />}
      >
        {/* Header with gradient */}
        <View style={styles.profileBg}>
          <LinearGradient colors={['#240056', '#8C2EBA', '#000000']} style={StyleSheet.absoluteFillObject} locations={[0, 0.5, 1]} />

          <SafeAreaView edges={['top']}>
            <View style={styles.topBar}>
              <TouchableOpacity testID="user-back-btn" onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>Profil</Text>
              <TouchableOpacity style={styles.moreBtn}>
                <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <View style={styles.profileContent}>
            <View style={styles.avatarWrap}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.avatarRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              </LinearGradient>
            </View>

            <Text style={styles.username}>{user.username}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleMeta.icon} {roleMeta.label}</Text>
            </View>
            <Text style={styles.bio}>{user.bio}</Text>

            {/* Follow Button */}
            {!isOwnProfile && (
              <TouchableOpacity
                testID="follow-btn"
                onPress={handleFollow}
                disabled={followLoading}
                style={styles.followBtnWrap}
              >
                {following ? (
                  <View style={styles.followingBtn}>
                    <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                    <Text style={styles.followingBtnText}>Abonné</Text>
                  </View>
                ) : (
                  <LinearGradient colors={GRADIENTS.primary} style={styles.followBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {followLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="person-add-outline" size={16} color="#fff" />
                        <Text style={styles.followBtnText}>Suivre</Text>
                      </>
                    )}
                  </LinearGradient>
                )}
              </TouchableOpacity>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{user.reviews_count}</Text>
                <Text style={styles.statLabel}>Critiques</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{user.films_seen_count}</Text>
                <Text style={styles.statLabel}>Films vus</Text>
              </View>
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

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8 }}>
            {PROFILE_TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                testID={`user-tab-${tab}`}
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

        {/* Content */}
        <View style={styles.contentSection}>
          {renderContent()}

          <TouchableOpacity
            onPress={() => router.push({ pathname: '/category/[type]', params: { type: TAB_TYPE_MAP[activeTab], userId: user.id } })}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>Voir tout — {activeTab}</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="film-outline" size={40} color={COLORS.textTertiary} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { color: COLORS.textSecondary, fontSize: 16 },
  backLink: { marginTop: 8 },
  backLinkText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  profileBg: { paddingBottom: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screenEdge, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  moreBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  profileContent: { alignItems: 'center', paddingHorizontal: SPACING.screenEdge, paddingTop: 8 },
  avatarWrap: { marginBottom: 12 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: COLORS.background },
  username: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  roleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  bio: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
  followBtnWrap: { marginBottom: 20 },
  followBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: RADIUS.full },
  followBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  followingBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: 'rgba(140,46,186,0.2)', borderWidth: 1, borderColor: COLORS.primary },
  followingBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
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
  contentSection: { paddingHorizontal: SPACING.screenEdge, paddingTop: 16 },
  contentList: { gap: 10, marginBottom: 16 },
  filmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  gridFilm: { width: (width - SPACING.screenEdge * 2 - 16) / 3, height: 130, borderRadius: RADIUS.md, overflow: 'hidden', position: 'relative' },
  gridFilmImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  gridRank: { position: 'absolute', top: 6, left: 6, fontSize: 20, fontWeight: '900', color: 'rgba(140,46,186,0.9)' },
  reviewRow: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  reviewPoster: { width: 44, height: 62, borderRadius: 6 },
  reviewFilmTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  reviewText: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(140,46,186,0.1)', borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  seeAllText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: COLORS.textTertiary, fontSize: 14 },
});
