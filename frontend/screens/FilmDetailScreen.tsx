// ─────────────────────────────────────────────
//  FilmDetailScreen — Universe
//  Film/Series detail: Hero · Actions · Episodes
//  Dark galaxy aesthetic with glowing CTAs
// ─────────────────────────────────────────────
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, GENRE_COLORS, GRADIENTS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import StarField from '../components/StarField';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.52;

interface Episode {
  id: string; number: number; title: string;
  duration_minutes: number; thumbnail_url: string; synopsis: string;
}

// ── Episode Row ───────────────────────────────
function EpisodeRow({ ep, onPress }: { ep: Episode; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={er.row} activeOpacity={0.8}>
      <View style={er.thumb}>
        <Image source={{ uri: ep.thumbnail_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(8,0,16,0.7)']} style={StyleSheet.absoluteFillObject} />
        <View style={er.playOverlay}>
          <LinearGradient colors={GRADIENTS.primaryGlow} style={er.playCircle}>
            <Ionicons name="play" size={14} color="#fff" />
          </LinearGradient>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={er.epNum}>Épisode {ep.number}</Text>
        <Text style={er.epTitle}>{ep.title}</Text>
        <Text style={er.epSynopsis} numberOfLines={1}>{ep.synopsis}</Text>
        <View style={er.durationRow}>
          <Ionicons name="time-outline" size={11} color={COLORS.textTertiary} />
          <Text style={er.duration}>{ep.duration_minutes} min</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
const er = StyleSheet.create({
  row:        { flexDirection: 'row', gap: 14, marginBottom: 16 },
  thumb:      { width: 140, height: 82, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface },
  playOverlay:{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  epNum:      { fontSize: 11, color: COLORS.textTertiary, marginBottom: 3 },
  epTitle:    { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  epSynopsis: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 },
  durationRow:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  duration:   { fontSize: 11, color: COLORS.textTertiary },
});

// ── Tag chip ──────────────────────────────────
function Tag({ label }: { label: string }) {
  return (
    <View style={tag.wrap}>
      <Text style={tag.text}>{label}</Text>
    </View>
  );
}
const tag = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(155,63,222,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border },
  text: { color: COLORS.primaryLight, fontSize: 12 },
});

// ── Main Screen ───────────────────────────────
export default function FilmDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inList, setInList] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({ inputRange: [HERO_HEIGHT - 80, HERO_HEIGHT], outputRange: [0, 1], extrapolate: 'clamp' });

  // Placeholder — replace with actual API call
  const film = {
    id, title: 'PUFFERS', director: 'Universe Studio',
    genre: 'Horreur', year: 2024, rating: 4.2,
    synopsis: 'Un groupe de survivants se retrouve piégé dans une forêt mystérieuse où de sombres créatures rôdent. Chaque nuit, une nouvelle terreur les attend.',
    duration_minutes: 45, duration_type: 'long',
    poster_url: 'https://picsum.photos/seed/puffers/400/600',
    views_count: 12500, tags: ['horreur', 'survie', 'forêt', 'mystère'],
  };

  const episodes: Episode[] = [
    { id: '1', number: 1, title: 'Reprends là où tu t\'es arrêté', duration_minutes: 25, thumbnail_url: 'https://picsum.photos/seed/ep1/280/160', synopsis: 'Le groupe découvre la forêt et ses secrets' },
    { id: '2', number: 2, title: 'Dans l\'ombre des arbres', duration_minutes: 28, thumbnail_url: 'https://picsum.photos/seed/ep2/280/160', synopsis: 'La nuit tombe et les créatures s\'éveillent' },
  ];

  const genreColor = GENRE_COLORS[film.genre] || COLORS.primary;

  return (
    <View style={s.container}>
      <StarField />

      {/* Floating back header */}
      <Animated.View style={[s.floatingHeader, { opacity: headerOpacity }]}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={s.floatingHeaderBorder} />
        <SafeAreaView edges={['top']}>
          <View style={s.floatingHeaderInner}>
            <TouchableOpacity onPress={router.back} style={s.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={s.floatingTitle}>{film.title}</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* ── Hero ── */}
        <View style={[s.hero, { height: HERO_HEIGHT }]}>
          <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          {/* Layers */}
          <LinearGradient colors={['rgba(8,0,16,0.1)', 'transparent']} style={StyleSheet.absoluteFillObject} locations={[0, 0.3]} />
          <LinearGradient colors={['transparent', 'rgba(8,0,16,0.85)', 'rgba(8,0,16,0.99)']} style={StyleSheet.absoluteFillObject} locations={[0.45, 0.75, 1]} />
          <LinearGradient colors={['rgba(155,63,222,0.35)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 0.3, y: 0.5 }} style={StyleSheet.absoluteFillObject} />

          {/* Back button */}
          <SafeAreaView edges={['top']} style={s.heroBack}>
            <TouchableOpacity onPress={router.back} style={s.heroBackBtn}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Hero title area */}
          <View style={s.heroMeta}>
            <Text style={s.heroTitle}>{film.title}</Text>
            <View style={s.heroBadges}>
              <View style={[s.heroBadge, { backgroundColor: genreColor + '33', borderColor: genreColor }]}>
                <Text style={[s.heroBadgeText, { color: genreColor }]}>{film.genre}</Text>
              </View>
              <View style={s.heroBadge}>
                <Text style={s.heroBadgeText}>Série</Text>
              </View>
              <Text style={s.heroYear}>{film.year}</Text>
            </View>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={s.actionRow}>
          {/* Primary: Lecture */}
          <TouchableOpacity style={s.lectureWrap}>
            <View style={s.lectureGlow} />
            <LinearGradient colors={['#6B1FB0', '#9B3FDE']} style={s.lectureBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={s.lectureBtnText}>Lecture</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary: Ma liste */}
          <TouchableOpacity style={s.listBtn} onPress={() => setInList(p => !p)}>
            <Ionicons name={inList ? 'star' : 'star-outline'} size={18} color={inList ? COLORS.gold : '#fff'} />
            <Text style={s.listBtnText}>Ma liste</Text>
          </TouchableOpacity>

          {/* Download */}
          <TouchableOpacity style={s.iconActionBtn}>
            <BlurView intensity={20} tint="dark" style={s.iconActionBlur}>
              <Ionicons name="download-outline" size={22} color="#fff" />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* ── Meta ── */}
        <View style={s.metaSection}>
          <Text style={s.metaLine}>
            Épisode 1 · {film.year} · {film.duration_minutes} min
          </Text>
          <Text style={s.synopsis}>{film.synopsis}</Text>

          {/* Rating row */}
          <View style={s.ratingRow}>
            {[1,2,3,4,5].map(star => (
              <Ionicons key={star} name={star <= Math.round(film.rating) ? 'star' : 'star-outline'} size={15} color={COLORS.gold} />
            ))}
            <Text style={s.ratingVal}>{film.rating}/5</Text>
            <Text style={s.viewsText}>· {film.views_count.toLocaleString()} vues</Text>
          </View>

          {/* Tags */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {film.tags.map(t => <Tag key={t} label={`#${t}`} />)}
          </ScrollView>
        </View>

        {/* ── Episodes ── */}
        <View style={s.episodesSection}>
          <View style={s.sectionHeader}>
            <View style={s.sectionDot} />
            <Text style={s.sectionTitle}>ÉPISODES</Text>
          </View>

          {/* Episode thumbnails horizontal strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
            {episodes.map(ep => (
              <TouchableOpacity key={ep.id} style={s.epThumb}>
                <Image source={{ uri: ep.thumbnail_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                <LinearGradient colors={['transparent', 'rgba(8,0,16,0.9)']} style={StyleSheet.absoluteFillObject} />
                <Text style={s.epThumbNum}>Ep. {ep.number}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Episode list */}
          <View style={{ paddingHorizontal: SPACING.screenEdge }}>
            <Text style={s.epSectionLabel}>Épisode 1</Text>
            {episodes.map(ep => (
              <EpisodeRow 
                key={ep.id} 
                ep={ep} 
                onPress={() => router.push({ pathname: '/watch/[id]' as any, params: { id: film.id, ep: ep.id } })} 
              />
            ))}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  // Floating header
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, overflow: 'hidden' },
  floatingHeaderBorder: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.border },
  floatingHeaderInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.screenEdge, paddingVertical: 10 },
  floatingTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#fff' },
  backBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  // Hero
  hero:       { position: 'relative', backgroundColor: COLORS.surface },
  heroBack:   { position: 'absolute', top: 0, left: 0, right: 0 },
  heroBackBtn:{ margin: SPACING.screenEdge, width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroMeta:   { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.screenEdge },
  heroTitle:  { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 2, marginBottom: 10 },
  heroBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroBadge:  { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.08)' },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  heroYear:   { color: COLORS.textSecondary, fontSize: 12 },
  // Actions
  actionRow:  { flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.screenEdge, paddingVertical: 20, alignItems: 'center' },
  lectureWrap:{ flex: 1, position: 'relative' },
  lectureGlow:{ ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, opacity: 0.3, transform: [{ scaleY: 1.4 }] },
  lectureBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: RADIUS.full },
  lectureBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  listBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.06)' },
  listBtnText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
  iconActionBtn: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  iconActionBlur:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Meta
  metaSection:{ paddingHorizontal: SPACING.screenEdge, marginBottom: 28 },
  metaLine:   { fontSize: 12, color: COLORS.textTertiary, marginBottom: 12 },
  synopsis:   { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 14 },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  ratingVal:  { color: COLORS.gold, fontSize: 13, fontWeight: '800', marginLeft: 5 },
  viewsText:  { color: COLORS.textTertiary, fontSize: 12 },
  // Episodes
  episodesSection: { paddingTop: 4 },
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.screenEdge, marginBottom: 16 },
  sectionDot:      { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.primaryLight, shadowColor: COLORS.primaryLight, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6, elevation: 6 },
  sectionTitle:    { fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 2.5 },
  epThumb:  { width: 160, height: 90, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface, marginLeft: SPACING.screenEdge, position: 'relative' },
  epThumbNum: { position: 'absolute', bottom: 8, left: 10, color: '#fff', fontSize: 12, fontWeight: '700' },
  epSectionLabel: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 16 },
});
