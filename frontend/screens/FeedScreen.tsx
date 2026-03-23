// ─────────────────────────────────────────────
//  FeedScreen — Universe Reels
//  TikTok-style vertical scroll, galaxy overlay
//  Captions + action bar + info modal
// ─────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList,
  Dimensions, Animated, ActivityIndicator, Modal, ScrollView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, DURATION_LABELS, GENRE_COLORS, GRADIENTS, RADIUS, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { filmsAPI, seenAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');
const ITEM_HEIGHT = height;

interface Film {
  id: string; title: string; director: string; duration_minutes: number;
  duration_type: string; genre: string; synopsis: string; poster_url: string;
  year: number; rating: number; views_count: number; tags: string[];
}

function formatDuration(min: number) {
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}m` : ''}`;
}

// ── Action Button with glow ───────────────────
function ActionBtn({
  icon, label, color = '#fff', active = false, glow = false, onPress,
}: {
  icon: string; label: string; color?: string;
  active?: boolean; glow?: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function press() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 120, useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1,    useNativeDriver: true }),
    ]).start();
    onPress();
  }

  return (
    <TouchableOpacity onPress={press} style={ab.wrap} activeOpacity={0.8}>
      <View style={ab.iconBox}>
        {glow && active && <View style={[ab.glowRing, { borderColor: color }]} />}
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name={icon as any} size={30} color={active ? color : '#fff'} />
        </Animated.View>
      </View>
      <Text style={ab.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  wrap:    { alignItems: 'center', gap: 5 },
  iconBox: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  glowRing: { ...StyleSheet.absoluteFillObject, borderRadius: 25, borderWidth: 2, opacity: 0.6 },
  label:   { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
});

// ── Progress bar ──────────────────────────────
function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${progress * 100}%` }]} />
      <LinearGradient colors={GRADIENTS.primaryGlow} style={[pb.thumb, { left: `${progress * 100}%` }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, position: 'relative' },
  fill:  { height: '100%', backgroundColor: COLORS.primaryLight, borderRadius: 2 },
  thumb: { position: 'absolute', top: -4, marginLeft: -5, width: 11, height: 11, borderRadius: 6 },
});

// ── Feed Item ─────────────────────────────────
function FeedItem({ film, isActive }: { film: Film; isActive: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const [liked,     setLiked]     = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(film.views_count / 100));
  const [showInfo,  setShowInfo]  = useState(false);
  const [progress,  setProgress]  = useState(0.1);

  // Simulate playback progress when active
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setProgress(p => p >= 1 ? 0 : p + 0.003);
    }, 80);
    return () => clearInterval(interval);
  }, [isActive]);

  function handleLike() {
    setLiked(p => !p);
    setLikeCount(p => liked ? p - 1 : p + 1);
  }

  const genreColor = GENRE_COLORS[film.genre] || COLORS.primary;

  return (
    <View style={[fi.container, { height: ITEM_HEIGHT }]}>
      {/* Background poster */}
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

      {/* Multi-layer dark overlay */}
      <LinearGradient
        colors={['rgba(8,0,16,0.15)', 'transparent', 'rgba(8,0,16,0.5)', 'rgba(8,0,16,0.98)']}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Left purple edge glow */}
      <LinearGradient
        colors={['rgba(155,63,222,0.3)', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 0.25, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Top bar: Pour vous / Amies ── */}
      <SafeAreaView edges={['top']} style={fi.topBar}>
        <BlurView intensity={20} tint="dark" style={fi.topBlur}>
          <View style={fi.topInner}>
            <TouchableOpacity style={fi.topMenu}>
              <Ionicons name="menu" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={fi.tabs}>
              <TouchableOpacity>
                <Text style={fi.tabActive}>Pour vous</Text>
              </TouchableOpacity>
              <Text style={fi.tabSep}>·</Text>
              <TouchableOpacity>
                <Text style={fi.tabInactive}>Amies</Text>
              </TouchableOpacity>
            </View>
            <View style={fi.topAvatars}>
              <View style={fi.avatarSmall} />
              <View style={[fi.avatarSmall, { marginLeft: -10 }]} />
            </View>
          </View>
        </BlurView>
      </SafeAreaView>

      {/* ── Right action bar ── */}
      <View style={fi.rightBar}>
        <ActionBtn icon={liked ? 'heart' : 'heart-outline'} label={`${likeCount}`} color="#FF3B30" active={liked} glow onPress={handleLike} />
        <ActionBtn icon="list-outline" label="Info" onPress={() => setShowInfo(true)} />
        <ActionBtn icon="star-outline" label="Critique" color={COLORS.gold} onPress={() => router.push(`/film/${film.id}`)} />
        <ActionBtn icon={saved ? 'bookmark' : 'bookmark-outline'} label="Sauver" color={COLORS.primaryLight} active={saved} onPress={() => setSaved(p => !p)} />
        <ActionBtn icon="checkmark-circle-outline" label="Vu" color={COLORS.success} onPress={async () => { if (user) { try { await seenAPI.markSeen(film.id); } catch {} } }} />
      </View>

      {/* ── Bottom film info ── */}
      <View style={fi.bottomInfo}>
        {/* Tags */}
        <View style={fi.tagsRow}>
          <View style={[fi.genreBadge, { backgroundColor: genreColor + '33', borderColor: genreColor }]}>
            <Text style={[fi.genreBadgeText, { color: genreColor }]}>{film.genre}</Text>
          </View>
          <View style={fi.durationBadge}>
            <Text style={fi.durationText}>{DURATION_LABELS[film.duration_type]}</Text>
          </View>
          <Text style={fi.yearText}>{film.year}</Text>
        </View>

        {/* Title */}
        <Text style={fi.title}>{film.title}</Text>
        <Text style={fi.director}>{film.director} · {formatDuration(film.duration_minutes)}</Text>
        <Text style={fi.synopsis} numberOfLines={2}>{film.synopsis}</Text>

        {/* Stars + views */}
        <View style={fi.ratingRow}>
          {[1,2,3,4,5].map(s => (
            <Ionicons key={s} name={s <= Math.round(film.rating) ? 'star' : 'star-outline'} size={13} color={COLORS.gold} />
          ))}
          <Text style={fi.ratingVal}>{film.rating}/5</Text>
          <Text style={fi.views}>{film.views_count.toLocaleString()} vues</Text>
        </View>

        {/* Episode card + CTA */}
        <View style={fi.episodeCard}>
          <BlurView intensity={30} tint="dark" style={fi.episodeBlur}>
            <View style={fi.episodeInner}>
              <View style={{ flex: 1 }}>
                <Text style={fi.episodeTitle}>Épisode 1 · {film.title}</Text>
                <ProgressBar progress={progress} />
                <View style={fi.timesRow}>
                  <Text style={fi.timeText}>{Math.floor(progress * 180).toString().padStart(2, '0')}:00</Text>
                  <Text style={fi.timeText}>3:00</Text>
                </View>
              </View>
            </View>
          </BlurView>
        </View>

        {/* CTA */}
        <TouchableOpacity onPress={() => router.push(`/film/${film.id}`)} style={fi.watchWrap}>
          <LinearGradient colors={GRADIENTS.primaryGlow} style={fi.watchBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={fi.watchText}>Voir le film</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Info Modal ── */}
      <Modal visible={showInfo} transparent animationType="slide" onRequestClose={() => setShowInfo(false)}>
        <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={() => setShowInfo(false)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={modal.sheet}>
            {/* Purple top glow */}
            <View style={modal.topGlow} />
            <View style={modal.handle} />

            <Text style={modal.title}>{film.title}</Text>
            <Text style={modal.director}>Réalisé par {film.director}</Text>

            <View style={modal.statsRow}>
              {[
                { icon: 'time-outline', val: formatDuration(film.duration_minutes), label: 'Durée' },
                { icon: 'film-outline',  val: film.year.toString(),                 label: 'Année' },
                { icon: 'star',          val: film.rating.toString(),                label: 'Note', gold: true },
              ].map(s => (
                <View key={s.label} style={modal.stat}>
                  <View style={modal.statIcon}>
                    <Ionicons name={s.icon as any} size={20} color={s.gold ? COLORS.gold : COLORS.primary} />
                  </View>
                  <Text style={[modal.statVal, s.gold && { color: COLORS.gold }]}>{s.val}</Text>
                  <Text style={modal.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <Text style={modal.synopsis}>{film.synopsis}</Text>

            <View style={modal.tagsRow}>
              {film.tags?.map(t => (
                <View key={t} style={modal.tag}>
                  <Text style={modal.tagText}>#{t}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={() => { setShowInfo(false); router.push(`/film/${film.id}`); }}>
              <LinearGradient colors={GRADIENTS.primaryGlow} style={modal.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={modal.ctaText}>Voir la page complète</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Feed Screen ───────────────────────────────
export default function FeedScreen() {
  const [films,       setFilms]      = useState<Film[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [activeIndex, setActiveIndex]= useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  useEffect(() => {
    filmsAPI.getFeed().then(d => { setFilms(d); setLoading(false); }).catch(() => setLoading(false));
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
    </View>
  );
}

// ── Styles ────────────────────────────────────
const fi = StyleSheet.create({
  container: { width, backgroundColor: '#000' },
  topBar:    { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  topBlur:   { overflow: 'hidden' },
  topInner:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, gap: 12 },
  topMenu:   { width: 36, alignItems: 'center' },
  tabs:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  tabActive: { color: '#fff', fontSize: 16, fontWeight: '800' },
  tabSep:    { color: 'rgba(255,255,255,0.4)', fontSize: 16 },
  tabInactive:{ color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '500' },
  topAvatars: { flexDirection: 'row' },
  avatarSmall:{ width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.primaryLight },
  rightBar:  { position: 'absolute', right: 14, bottom: 220, alignItems: 'center', gap: 22 },
  bottomInfo:{ position: 'absolute', bottom: 0, left: 0, right: 86, padding: 20, paddingBottom: 110 },
  tagsRow:   { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' },
  genreBadge:{ borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  genreBadgeText: { fontSize: 11, fontWeight: '700' },
  durationBadge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(155,63,222,0.25)', borderWidth: 1, borderColor: COLORS.border },
  durationText: { color: COLORS.primaryLight, fontSize: 11, fontWeight: '600' },
  yearText:  { color: COLORS.textSecondary, fontSize: 12 },
  title:     { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 4, lineHeight: 30 },
  director:  { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8 },
  synopsis:  { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20, marginBottom: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  ratingVal: { color: COLORS.gold, fontSize: 12, fontWeight: '800', marginLeft: 6 },
  views:     { color: COLORS.textTertiary, fontSize: 11, marginLeft: 8 },
  episodeCard: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  episodeBlur: { overflow: 'hidden', borderRadius: RADIUS.lg },
  episodeInner:{ flexDirection: 'row', gap: 12, padding: 14 },
  episodeTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  timesRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timeText:  { color: COLORS.textTertiary, fontSize: 10 },
  watchWrap: { alignSelf: 'flex-start' },
  watchBtn:  { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 22, paddingVertical: 11, borderRadius: RADIUS.full, ...SHADOWS.primary },
  watchText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet:   { backgroundColor: '#100020', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 48, borderTopWidth: 1, borderColor: COLORS.borderGlow, position: 'relative', overflow: 'hidden' },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: COLORS.primaryLight, opacity: 0.7 },
  handle:  { width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 22 },
  title:   { ...TYPOGRAPHY.h1, marginBottom: 6 },
  director:{ color: COLORS.textSecondary, fontSize: 14, marginBottom: 22 },
  statsRow:{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(155,63,222,0.08)', borderRadius: RADIUS.lg, padding: 18, marginBottom: 22, borderWidth: 1, borderColor: COLORS.border },
  stat:    { alignItems: 'center', gap: 6 },
  statIcon:{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(155,63,222,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  statVal: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statLabel: { color: COLORS.textTertiary, fontSize: 11 },
  synopsis: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 18 },
  tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  tag:     { backgroundColor: 'rgba(155,63,222,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border },
  tagText: { color: COLORS.primaryLight, fontSize: 12 },
  cta:     { borderRadius: RADIUS.full, paddingVertical: 15, alignItems: 'center', ...SHADOWS.primary },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
