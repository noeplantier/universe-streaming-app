import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS, DURATION_LABELS, GENRE_COLORS, SHADOWS } from '../../constants/theme';
import { filmsAPI, reviewsAPI, seenAPI, watchlistAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { VideoPlayerModal } from '../../components/VideoPlayer';

interface Film {
  id: string; title: string; director: string; duration_minutes: number;
  duration_type: string; genre: string; synopsis: string; poster_url: string;
  year: number; language: string; rating: number; views_count: number;
  tags?: string[]; content_type: string;
}
interface Review {
  id: string; user_id: string; content: string; rating: number;
  likes_count: number; created_at: string;
  user?: { id: string; username: string; avatar_url: string };
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <TouchableOpacity key={s} onPress={() => onChange(s)}>
          <Ionicons name={s <= value ? 'star' : 'star-outline'} size={28} color="#FFD60A" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

export default function FilmDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [film, setFilm] = useState<Film | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewRating, setReviewRating] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [seen, setSeen] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [filmData, reviewsData] = await Promise.all([
        filmsAPI.getById(id),
        reviewsAPI.getByFilm(id),
      ]);
      setFilm(filmData);
      setReviews(reviewsData || []);
    } catch (e) {
      console.error('Film detail error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleMarkSeen() {
    if (!user) { Alert.alert('', 'Connectez-vous pour marquer comme vu'); return; }
    try {
      await seenAPI.markSeen(id!);
      setSeen(true);
    } catch {}
  }

  async function handleWatchlist() {
    if (!user) { Alert.alert('', 'Connectez-vous pour ajouter à votre watchlist'); return; }
    try {
      if (inWatchlist) {
        await watchlistAPI.remove(id!);
        setInWatchlist(false);
      } else {
        await watchlistAPI.add(id!);
        setInWatchlist(true);
      }
    } catch {}
  }

  async function handleSubmitReview() {
    if (!reviewContent.trim()) return;
    if (!user) { Alert.alert('', 'Connectez-vous pour écrire une critique'); return; }
    setSubmitting(true);
    try {
      const rev = await reviewsAPI.create({ film_id: id!, content: reviewContent.trim(), rating: reviewRating });
      setReviews(prev => [{ ...rev, user: { id: user.id, username: user.username, avatar_url: user.avatar_url } }, ...prev]);
      setReviewContent('');
      setShowReviewModal(false);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatDuration(min: number) {
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h ${min % 60 > 0 ? min % 60 + 'min' : ''}`;
  }

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
  if (!film) return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff' }}>Film introuvable</Text>
    </View>
  );

  const avgRating = reviews.length > 0
    ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
    : film.rating.toFixed(1);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.7)', '#000']} style={StyleSheet.absoluteFillObject} locations={[0, 0.6, 1]} />

          {/* Back btn */}
          <SafeAreaView edges={['top']}>
            <TouchableOpacity testID="film-back-btn" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.heroContent}>
            <View style={styles.heroBadges}>
              <View style={[styles.badge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary }]}>
                <Text style={styles.badgeText}>{film.genre}</Text>
              </View>
              <View style={styles.durationBadge}>
                <Text style={styles.durationBadgeText}>{DURATION_LABELS[film.duration_type]}</Text>
              </View>
              <View style={styles.yearBadge}>
                <Text style={styles.yearBadgeText}>{film.year}</Text>
              </View>
            </View>
            <Text style={styles.filmTitle}>{film.title}</Text>
            <Text style={styles.directorText}>par {film.director}</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="star" size={20} color="#FFD60A" />
            <Text style={styles.statValue}>{avgRating}</Text>
            <Text style={styles.statLabel}>{reviews.length} avis</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            <Text style={styles.statValue}>{formatDuration(film.duration_minutes)}</Text>
            <Text style={styles.statLabel}>Durée</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={20} color={COLORS.success} />
            <Text style={styles.statValue}>{(film.views_count / 1000).toFixed(1)}K</Text>
            <Text style={styles.statLabel}>Vues</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity testID="film-watch-btn" onPress={() => setShowVideo(true)} style={styles.watchBtn} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.watchBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.watchBtnText}>Regarder</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity testID="film-watchlist-btn" onPress={handleWatchlist} style={[styles.iconBtn, inWatchlist && styles.iconBtnActive]}>
            <Ionicons name={inWatchlist ? 'bookmark' : 'bookmark-outline'} size={22} color={inWatchlist ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.iconBtnText, inWatchlist && { color: COLORS.primary }]}>Watchlist</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="film-seen-btn" onPress={handleMarkSeen} style={[styles.iconBtn, seen && styles.iconBtnActive]}>
            <Ionicons name={seen ? 'checkmark-circle' : 'checkmark-circle-outline'} size={22} color={seen ? COLORS.success : COLORS.textSecondary} />
            <Text style={[styles.iconBtnText, seen && { color: COLORS.success }]}>Vu</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="film-review-btn" onPress={() => setShowReviewModal(true)} style={styles.iconBtn}>
            <Ionicons name="star-outline" size={22} color="#FFD60A" />
            <Text style={[styles.iconBtnText, { color: '#FFD60A' }]}>Critique</Text>
          </TouchableOpacity>
        </View>

        {/* Synopsis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synopsis</Text>
          <Text style={styles.synopsis}>{film.synopsis}</Text>
        </View>

        {/* Tags */}
        {film.tags && film.tags.length > 0 && (
          <View style={styles.tagsSection}>
            {film.tags.map(t => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>Critiques ({reviews.length})</Text>
            <TouchableOpacity testID="film-add-review-btn" onPress={() => setShowReviewModal(true)} style={styles.addReviewBtn}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.addReviewBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addReviewBtnText}>Écrire</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {reviews.length === 0 && (
            <View style={styles.noReviews}>
              <Ionicons name="chatbubble-outline" size={32} color={COLORS.textTertiary} />
              <Text style={styles.noReviewsText}>Soyez le premier à écrire une critique</Text>
            </View>
          )}

          {reviews.map(review => (
            <View key={review.id} testID={`review-card-${review.id}`} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Image source={{ uri: review.user?.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60' }} style={styles.reviewAvatar} />
                <View style={styles.reviewHeaderInfo}>
                  <Text style={styles.reviewUsername}>{review.user?.username || 'Anonyme'}</Text>
                  <Text style={styles.reviewTime}>{timeAgo(review.created_at)}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Ionicons key={s} name={s <= Math.round(review.rating) ? 'star' : 'star-outline'} size={12} color="#FFD60A" />
                  ))}
                </View>
              </View>
              <Text style={styles.reviewText}>{review.content}</Text>
              <View style={styles.reviewLikes}>
                <Ionicons name="heart-outline" size={14} color={COLORS.textTertiary} />
                <Text style={styles.reviewLikesText}>{review.likes_count} j'aime</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={showReviewModal} transparent animationType="slide" onRequestClose={() => setShowReviewModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReviewModal(false)}>
            <View style={styles.reviewSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Votre Critique</Text>
              <Text style={styles.sheetFilmName}>{film.title}</Text>

              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>Note</Text>
                <StarPicker value={reviewRating} onChange={setReviewRating} />
              </View>

              <TextInput
                testID="review-input"
                style={styles.reviewInput}
                placeholder="Partagez votre expérience cinématographique..."
                placeholderTextColor={COLORS.textTertiary}
                value={reviewContent}
                onChangeText={setReviewContent}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity testID="review-submit-btn" onPress={handleSubmitReview} disabled={submitting} activeOpacity={0.85}>
                <LinearGradient
                  colors={!reviewContent.trim() ? ['#333', '#222'] : GRADIENTS.primary}
                  style={styles.submitReviewBtn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitReviewText}>Publier ma Critique</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Video Player Modal */}
      <VideoPlayerModal
        visible={showVideo}
        onClose={() => setShowVideo(false)}
        filmId={film.id}
        filmTitle={film.title}
        posterUrl={film.poster_url}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  hero: { height: 400, position: 'relative' },
  backBtn: { margin: 16, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.screenEdge },
  heroBadges: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  badge: { borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  durationBadge: { borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(140,46,186,0.4)', borderWidth: 1, borderColor: COLORS.primary },
  durationBadgeText: { color: '#fff', fontSize: 12 },
  yearBadge: { borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.1)' },
  yearBadgeText: { color: COLORS.textSecondary, fontSize: 12 },
  filmTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 6 },
  directorText: { fontSize: 14, color: COLORS.textSecondary },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, marginHorizontal: SPACING.screenEdge, borderRadius: RADIUS.lg, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 10, color: COLORS.textTertiary },
  statDivider: { width: 1, height: 30, backgroundColor: COLORS.border },
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.screenEdge, paddingVertical: 16, alignItems: 'center' },
  watchBtn: { flex: 1 },
  watchBtnGrad: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: RADIUS.full, ...SHADOWS.neonGlow },
  watchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  iconBtn: { alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  iconBtnActive: {},
  iconBtnText: { color: COLORS.textSecondary, fontSize: 10 },
  section: { paddingHorizontal: SPACING.screenEdge, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  synopsis: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 24 },
  tagsSection: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingHorizontal: SPACING.screenEdge, marginTop: 12 },
  tag: { backgroundColor: 'rgba(140,46,186,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  tagText: { color: COLORS.primary, fontSize: 12 },
  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addReviewBtn: {},
  addReviewBtnGrad: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full },
  addReviewBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  noReviews: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  noReviewsText: { color: COLORS.textTertiary, fontSize: 13 },
  reviewCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border },
  reviewHeaderInfo: { flex: 1 },
  reviewUsername: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  reviewTime: { color: COLORS.textTertiary, fontSize: 10 },
  reviewText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  reviewLikes: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  reviewLikesText: { color: COLORS.textTertiary, fontSize: 11 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  reviewSheet: { backgroundColor: '#0B0014', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: COLORS.border },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  sheetFilmName: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20 },
  ratingSection: { marginBottom: 20 },
  ratingLabel: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 10 },
  reviewInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 14, color: COLORS.textPrimary, fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 20 },
  submitReviewBtn: { borderRadius: RADIUS.full, paddingVertical: 14, alignItems: 'center' },
  submitReviewText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
