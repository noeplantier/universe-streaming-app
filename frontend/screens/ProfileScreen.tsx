// ─────────────────────────────────────────────
//  ProfileScreen — Universe
//  @user profile with galaxy gradient header
//  Tabs: Top 10 · Critiques · Films Vus · Réalisés
// ─────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Dimensions, RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, GENRE_COLORS, GRADIENTS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { reviewsAPI, seenAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StarField from '../components/StarField';

const { width } = Dimensions.get('window');
const PROFILE_TABS = ['Top 10', 'Critiques', 'Films Vus', 'Réalisés'] as const;
type ProfileTab = typeof PROFILE_TABS[number];

interface Review {
  id: string; film_id: string; content: string; rating: number;
  likes_count: number; created_at: string;
  film?: { id: string; title: string; poster_url: string; genre: string };
}
interface Film {
  id: string; title: string; poster_url: string; genre: string; rating: number;
}

const ROLE_ICONS: Record<string, string> = {
  director: '🎬', critic: '✍️', viewer: '👁️',
};

function StarRow({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color={COLORS.gold} />
      ))}
    </View>
  );
}

// ── Stat tile ─────────────────────────────────
function StatTile({ val, label, onPress }: { val: string | number; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={st.tile} disabled={!onPress}>
      <Text style={st.val}>{val}</Text>
      <Text style={st.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const st = StyleSheet.create({
  tile:  { flex: 1, alignItems: 'center', paddingVertical: 4 },
  val:   { fontSize: 20, fontWeight: '900', color: '#fff' },
  label: { fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 2, letterSpacing: 0.5 },
});

// ── Profile Tab Button ────────────────────────
function ProfileTabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  if (active) {
    return (
      <TouchableOpacity onPress={onPress} style={ptb.activeWrap}>
        <LinearGradient colors={GRADIENTS.primaryGlow} style={ptb.activeInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={ptb.activeText}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} style={ptb.inactive}>
      <Text style={ptb.inactiveText}>{label}</Text>
    </TouchableOpacity>
  );
}
const ptb = StyleSheet.create({
  activeWrap:   { borderRadius: RADIUS.full, ...SHADOWS.primary },
  activeInner:  { borderRadius: RADIUS.full, paddingHorizontal: 18, paddingVertical: 8 },
  activeText:   { color: '#fff', fontSize: 13, fontWeight: '800' },
  inactive:     { borderRadius: RADIUS.full, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border },
  inactiveText: { color: COLORS.textTertiary, fontSize: 13, fontWeight: '500' },
});

// ── Film grid card ────────────────────────────
function GridFilmCard({ film, rank, showSeen, onPress }: { film: Film; rank?: number; showSeen?: boolean; onPress: () => void }) {
  const genreColor = GENRE_COLORS[film.genre] || COLORS.primary;
  return (
    <TouchableOpacity onPress={onPress} style={gfc.card}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(8,0,16,0.85)']} style={StyleSheet.absoluteFillObject} />
      {rank !== undefined && <Text style={gfc.rank}>{rank}</Text>}
      {showSeen && (
        <View style={gfc.seenBadge}>
          <LinearGradient colors={['#10B981', '#059669']} style={gfc.seenGrad}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </LinearGradient>
        </View>
      )}
      <View style={gfc.info}>
        <Text style={[gfc.genre, { color: genreColor }]}>{film.genre}</Text>
        <Text style={gfc.title} numberOfLines={2}>{film.title}</Text>
      </View>
    </TouchableOpacity>
  );
}
const gfc = StyleSheet.create({
  card:     { flex: 1, height: 140, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface, ...SHADOWS.card },
  rank:     { position: 'absolute', top: 6, left: 8, fontSize: 28, fontWeight: '900', color: 'rgba(192,96,255,0.85)', lineHeight: 36 },
  seenBadge:{ position: 'absolute', top: 8, right: 8, borderRadius: 12, overflow: 'hidden' },
  seenGrad: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  info:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8 },
  genre:    { fontSize: 9, fontWeight: '700', marginBottom: 2 },
  title:    { color: '#fff', fontSize: 11, fontWeight: '700' },
});

// ── Review card ───────────────────────────────
function ReviewCard({ review, onPress }: { review: Review; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={rc.card}>
      {review.film && <Image source={{ uri: review.film.poster_url }} style={rc.poster} />}
      <View style={{ flex: 1 }}>
        {review.film && <Text style={rc.filmTitle} numberOfLines={1}>{review.film.title}</Text>}
        <StarRow rating={review.rating} size={11} />
        <Text style={rc.content} numberOfLines={2}>{review.content}</Text>
        <View style={rc.likeRow}>
          <Ionicons name="heart" size={11} color="#FF3B30" />
          <Text style={rc.likeCount}>{review.likes_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
const rc = StyleSheet.create({
  card:      { flexDirection: 'row', gap: 12, backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  poster:    { width: 50, height: 70, borderRadius: RADIUS.sm },
  filmTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 5 },
  content:   { color: COLORS.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 5 },
  likeRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  likeCount: { color: COLORS.textTertiary, fontSize: 10 },
});

// ── Main Screen ───────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab,  setActiveTab]  = useState<ProfileTab>('Top 10');
  const [reviews,    setReviews]    = useState<Review[]>([]);
  const [seenFilms,  setSeenFilms]  = useState<Film[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const avatarScale = scrollY.interpolate({ inputRange: [0, 120], outputRange: [1, 0.6], extrapolate: 'clamp' });
  const avatarOpacity = scrollY.interpolate({ inputRange: [60, 120], outputRange: [1, 0], extrapolate: 'clamp' });

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
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  function formatN(n: number) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
  }

  function renderContent() {
    if (loading) return <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />;

    if (activeTab === 'Critiques') {
      const preview = reviews.slice(0, 4);
      if (!preview.length) return <Empty tab={activeTab} />;
      return preview.map(r => <ReviewCard key={r.id} review={r} onPress={() => r.film && router.push(`/film/${r.film.id}`)} />);
    }

    const films: Film[] = activeTab === 'Top 10'
      ? (reviews.map(r => r.film).filter(Boolean) as Film[]).slice(0, 6)
      : activeTab === 'Films Vus'
      ? seenFilms.slice(0, 6)
      : [];

    if (!films.length) return <Empty tab={activeTab} />;

    const rows: Film[][] = [];
    for (let i = 0; i < films.length; i += 3) rows.push(films.slice(i, i + 3));

    return rows.map((row, rowIdx) => (
      <View key={rowIdx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {row.map((film, i) => (
          <GridFilmCard
            key={film.id}
            film={film}
            rank={activeTab === 'Top 10' ? rowIdx * 3 + i + 1 : undefined}
            showSeen={activeTab === 'Films Vus'}
            onPress={() => router.push(`/film/${film.id}`)}
          />
        ))}
        {/* Fill empty spots */}
        {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => <View key={`empty-${i}`} style={{ flex: 1 }} />)}
      </View>
    ));
  }

  if (!user) return null;

  return (
    <View style={s.container}>
      <StarField />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* ── Profile header with galaxy gradient ── */}
        <View style={s.headerBg}>
          {/* Galaxy gradient */}
          <LinearGradient colors={['#240056', '#5B1FB0', '#1A0035', '#000000']} style={StyleSheet.absoluteFillObject} locations={[0, 0.35, 0.65, 1]} />
          {/* Star ambient blobs */}
          <View style={s.blob1} />
          <View style={s.blob2} />

          <SafeAreaView edges={['top']}>
            <View style={s.topActions}>
              <TouchableOpacity style={s.iconBtn}>
                <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn}>
                <Ionicons name="share-outline" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Avatar */}
          <Animated.View style={[s.avatarArea, { transform: [{ scale: avatarScale }], opacity: avatarOpacity }]}>
            <View style={s.avatarRingOuter}>
              <LinearGradient colors={GRADIENTS.primaryGlow} style={s.avatarRingGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Image source={{ uri: user.avatar_url }} style={s.avatar} />
              </LinearGradient>
            </View>
            {/* Glow pulse behind avatar */}
            <View style={s.avatarGlow} />
            {/* Role badge */}
            <View style={s.roleBadge}>
              <Text style={{ fontSize: 12 }}>{ROLE_ICONS[user.role] || '👁️'}</Text>
            </View>
          </Animated.View>

          <View style={s.profileInfo}>
            <Text style={s.username}>@{user.username}</Text>
            <View style={s.roleTag}>
              <Text style={s.roleTagText}>{user.role === 'director' ? 'Réalisateur' : user.role === 'critic' ? 'Critique' : 'Spectateur'}</Text>
            </View>
            <Text style={s.bio}>{user.bio}</Text>
          </View>

          {/* Stats bar */}
          <View style={s.statsBar}>
            <BlurView intensity={20} tint="dark" style={s.statsBlur}>
              <View style={s.statsInner}>
                <StatTile val={user.reviews_count} label="Critiques" onPress={() => router.push({ pathname: '/category/[type]', params: { type: 'critiques', userId: user.id } })} />
                <View style={s.statsDivider} />
                <StatTile val={user.films_seen_count} label="Films vus" onPress={() => router.push({ pathname: '/category/[type]', params: { type: 'seen', userId: user.id } })} />
                <View style={s.statsDivider} />
                <StatTile val={formatN(user.followers_count)} label="Abonnés" />
                <View style={s.statsDivider} />
                <StatTile val={formatN(user.following_count)} label="Abonnements" />
              </View>
            </BlurView>
          </View>

          {/* Action buttons */}
          <View style={s.actionBtns}>
            <TouchableOpacity style={s.editBtn}>
              <Text style={s.editBtnText}>Modifier le profil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.followBtn}>
              <LinearGradient colors={GRADIENTS.primaryGlow} style={s.followGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="person-add-outline" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Profile Tabs ── */}
        <View style={s.tabsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.screenEdge, gap: 8 }}>
            {PROFILE_TABS.map(tab => (
              <ProfileTabBtn key={tab} label={tab} active={activeTab === tab} onPress={() => setActiveTab(tab)} />
            ))}
          </ScrollView>
        </View>

        {/* ── Content ── */}
        <View style={s.content}>
          {renderContent()}

          {/* See all button */}
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/category/[type]', params: { type: activeTab.toLowerCase().replace(' ', '_'), userId: user.id } })}
            style={s.seeAllBtn}
          >
            <View style={s.seeAllLeft}>
              <LinearGradient colors={GRADIENTS.primaryGlow} style={s.seeAllIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="grid-outline" size={14} color="#fff" />
              </LinearGradient>
              <Text style={s.seeAllText}>Explorer tout — {activeTab}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primaryLight} />
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function Empty({ tab }: { tab: ProfileTab }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(155,63,222,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border }}>
        <Ionicons name="film-outline" size={26} color={COLORS.primary} />
      </View>
      <Text style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>Aucun contenu dans {tab}</Text>
      <Text style={{ color: COLORS.textTertiary, fontSize: 12 }}>Découvrez des films et commencez à construire votre univers</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  // Header
  headerBg:  { paddingBottom: 20, position: 'relative', overflow: 'hidden' },
  blob1:     { position: 'absolute', top: 0, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: '#7B2FBE', opacity: 0.4 },
  blob2:     { position: 'absolute', top: 60, right: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: '#4B0082', opacity: 0.3 },
  topActions:{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: SPACING.screenEdge, paddingTop: 8 },
  iconBtn:   { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  // Avatar
  avatarArea: { alignItems: 'center', marginTop: 8, position: 'relative' },
  avatarRingOuter: { position: 'relative' },
  avatarRingGrad: { width: 94, height: 94, borderRadius: 47, alignItems: 'center', justifyContent: 'center', padding: 3 },
  avatar:    { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: COLORS.background },
  avatarGlow:{ position: 'absolute', width: 94, height: 94, borderRadius: 47, backgroundColor: COLORS.primary, opacity: 0.25, top: 0, left: 0 },
  roleBadge: { position: 'absolute', bottom: 0, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border },
  profileInfo:{ alignItems: 'center', marginTop: 14, paddingHorizontal: SPACING.screenEdge },
  username:  { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 6 },
  roleTag:   { borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 3, backgroundColor: 'rgba(155,63,222,0.25)', borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  roleTagText:{ color: COLORS.primaryLight, fontSize: 11, fontWeight: '600' },
  bio:       { color: 'rgba(255,255,255,0.65)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  // Stats
  statsBar:  { marginHorizontal: SPACING.screenEdge, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginTop: 20 },
  statsBlur: { overflow: 'hidden', borderRadius: RADIUS.lg },
  statsInner:{ flexDirection: 'row', alignItems: 'center', padding: 16 },
  statsDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 4 },
  // Action buttons
  actionBtns:{ flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.screenEdge, marginTop: 16 },
  editBtn:   { flex: 1, paddingVertical: 10, borderRadius: RADIUS.full, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  editBtnText:{ color: '#fff', fontSize: 13, fontWeight: '700' },
  followBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', ...SHADOWS.primary },
  followGrad:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Tabs
  tabsRow:   { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  // Content
  content:   { paddingHorizontal: SPACING.screenEdge, paddingTop: 18 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(155,63,222,0.08)', borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 8 },
  seeAllLeft:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  seeAllIcon:{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  seeAllText:{ color: COLORS.primaryLight, fontSize: 14, fontWeight: '700' },
});
