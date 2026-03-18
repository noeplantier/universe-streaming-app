import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList,
  Dimensions, Animated, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, GRADIENTS, DURATION_LABELS, GENRE_COLORS } from '../../constants/theme';
import { filmsAPI, seenAPI, reviewsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { width, height } = Dimensions.get('window');
const ITEM_HEIGHT = height;

interface Film {
  id: string; title: string; director: string; duration_minutes: number;
  duration_type: string; genre: string; synopsis: string; poster_url: string;
  year: number; rating: number; views_count: number; tags: string[];
}

function formatDuration(min: number) {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}m` : ''}`;
}

function FeedItem({ film, isActive }: { film: Film; isActive: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(film.views_count / 100));
  const [showInfo, setShowInfo] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  function handleLike() {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  }

  async function handleSeen() {
    if (!user) return;
    try {
      await seenAPI.markSeen(film.id);
    } catch {}
  }

  return (
    <View style={[styles.feedItem, { height: ITEM_HEIGHT }]}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.95)']} style={StyleSheet.absoluteFillObject} locations={[0.3, 0.7, 1]} />

      {/* Right Action Bar */}
      <View style={styles.rightBar}>
        {/* Like */}
        <View style={styles.actionItem}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <TouchableOpacity testID={`feed-like-${film.id}`} onPress={handleLike} style={styles.actionBtn}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#FF3B30' : '#fff'} />
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.actionCount}>{likeCount}</Text>
        </View>

        {/* Info */}
        <View style={styles.actionItem}>
          <TouchableOpacity testID={`feed-info-${film.id}`} onPress={() => setShowInfo(true)} style={styles.actionBtn}>
            <Ionicons name="list-outline" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.actionCount}>Info</Text>
        </View>

        {/* Review / Star */}
        <View style={styles.actionItem}>
          <TouchableOpacity testID={`feed-review-${film.id}`} onPress={() => router.push(`/film/${film.id}`)} style={styles.actionBtn}>
            <Ionicons name="star-outline" size={28} color="#FFD60A" />
          </TouchableOpacity>
          <Text style={styles.actionCount}>Critique</Text>
        </View>

        {/* Seen */}
        <View style={styles.actionItem}>
          <TouchableOpacity testID={`feed-seen-${film.id}`} onPress={handleSeen} style={styles.actionBtn}>
            <Ionicons name="checkmark-circle-outline" size={28} color={COLORS.success} />
          </TouchableOpacity>
          <Text style={styles.actionCount}>Vu</Text>
        </View>
      </View>

      {/* Bottom Info */}
      <View style={styles.bottomInfo}>
        <View style={styles.tagsRow}>
          <View style={[styles.genreBadge, { backgroundColor: GENRE_COLORS[film.genre] || COLORS.primary }]}>
            <Text style={styles.genreBadgeText}>{film.genre}</Text>
          </View>
          <View style={styles.durationBadge}>
            <Text style={styles.durationBadgeText}>{DURATION_LABELS[film.duration_type]}</Text>
          </View>
          <Text style={styles.yearText}>{film.year}</Text>
        </View>
        <Text style={styles.filmTitle}>{film.title}</Text>
        <Text style={styles.directorText}>{film.director} · {formatDuration(film.duration_minutes)}</Text>
        <Text style={styles.synopsisText} numberOfLines={2}>{film.synopsis}</Text>

        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map(s => (
            <Ionicons key={s} name={s <= Math.round(film.rating) ? 'star' : 'star-outline'} size={14} color="#FFD60A" />
          ))}
          <Text style={styles.ratingVal}>{film.rating}/5</Text>
          <Text style={styles.viewsText}>{film.views_count.toLocaleString()} vues</Text>
        </View>

        <TouchableOpacity testID={`feed-watch-${film.id}`} onPress={() => router.push(`/film/${film.id}`)} style={styles.watchBtn}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.watchBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={styles.watchBtnText}>Voir le film</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Info Modal */}
      <Modal visible={showInfo} transparent animationType="slide" onRequestClose={() => setShowInfo(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInfo(false)}>
          <View style={styles.infoSheet}>
            <View style={styles.infoSheetHandle} />
            <Text style={styles.infoTitle}>{film.title}</Text>
            <Text style={styles.infoDirector}>Réalisé par {film.director}</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoStat}>
                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                <Text style={styles.infoStatVal}>{formatDuration(film.duration_minutes)}</Text>
                <Text style={styles.infoStatLabel}>Durée</Text>
              </View>
              <View style={styles.infoStat}>
                <Ionicons name="film-outline" size={20} color={COLORS.primary} />
                <Text style={styles.infoStatVal}>{film.year}</Text>
                <Text style={styles.infoStatLabel}>Année</Text>
              </View>
              <View style={styles.infoStat}>
                <Ionicons name="star" size={20} color="#FFD60A" />
                <Text style={styles.infoStatVal}>{film.rating}</Text>
                <Text style={styles.infoStatLabel}>Note</Text>
              </View>
            </View>
            <Text style={styles.infoSynopsis}>{film.synopsis}</Text>
            <View style={styles.infoTagsRow}>
              {film.tags?.map(t => (
                <View key={t} style={styles.infoTag}><Text style={styles.infoTagText}>#{t}</Text></View>
              ))}
            </View>
            <TouchableOpacity onPress={() => { setShowInfo(false); router.push(`/film/${film.id}`); }} style={styles.infoDetailsBtn}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.infoDetailsBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.infoDetailsBtnText}>Voir la page complète</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function FeedScreen() {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  useEffect(() => {
    filmsAPI.getFeed().then(data => { setFilms(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index);
  }, []);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={films}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => <FeedItem film={item} isActive={index === activeIndex} />}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      />
      {/* Indicator dots */}
      <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="none">
        <Text style={styles.feedLabel}>UNIVERS</Text>
        <View style={styles.progressDots}>
          {films.slice(0, 8).map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  feedItem: { width, backgroundColor: '#000' },
  rightBar: {
    position: 'absolute', right: 16, bottom: 180,
    alignItems: 'center', gap: 20,
  },
  actionItem: { alignItems: 'center', gap: 4 },
  actionBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  actionCount: { color: '#fff', fontSize: 11, fontWeight: '500' },
  bottomInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 80,
    padding: 20, paddingBottom: 100,
  },
  tagsRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  genreBadge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  genreBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  durationBadge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(140,46,186,0.4)', borderWidth: 1, borderColor: COLORS.primary },
  durationBadgeText: { color: '#fff', fontSize: 11 },
  yearText: { color: COLORS.textSecondary, fontSize: 12 },
  filmTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  directorText: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 6 },
  synopsisText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  ratingVal: { color: '#FFD60A', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  viewsText: { color: COLORS.textTertiary, fontSize: 11, marginLeft: 8 },
  watchBtn: { alignSelf: 'flex-start' },
  watchBtnGrad: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.full },
  watchBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 8 },
  feedLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: 4, textAlign: 'center' },
  progressDots: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 16, backgroundColor: COLORS.primary },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  infoSheet: {
    backgroundColor: '#0B0014', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: COLORS.border,
  },
  infoSheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  infoTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  infoDirector: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.md, padding: 16, marginBottom: 20 },
  infoStat: { alignItems: 'center', gap: 6 },
  infoStatVal: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoStatLabel: { color: COLORS.textTertiary, fontSize: 11 },
  infoSynopsis: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  infoTagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  infoTag: { backgroundColor: 'rgba(140,46,186,0.2)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border },
  infoTagText: { color: COLORS.primary, fontSize: 12 },
  infoDetailsBtn: {},
  infoDetailsBtnGrad: { borderRadius: RADIUS.full, paddingVertical: 14, alignItems: 'center' },
  infoDetailsBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
