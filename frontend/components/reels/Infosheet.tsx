import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView }    from 'expo-blur';
import { Ionicons }    from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FeedFilm } from '@/components/reels/types';
import { C } from '@/components/create/tokens';
import GalaxyBackground from '../social/GalaxyBackground';

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:          C.navyMid,
  surface:     C.navyMid,
  border:      'rgba(255,255,255,0.07)',
  borderLight: 'rgba(255,255,255,0.13)',
  text:        '#FFFFFF',
  textSec:     'rgba(255,255,255,0.52)',
  textTer:     'rgba(255,255,255,0.28)',
  tag:         'rgba(255,255,255,0.08)',
  tagBorder:   'rgba(255,255,255,0.10)',
  gold:        '#E8C96B',
  close:       'rgba(255,255,255,0.10)',
} as const;

const SPRING_CONFIG = {
  tension:  68,
  friction: 12,
  useNativeDriver: true,
} as const;

const ANIM_DURATION = 260;
const SHEET_RADIUS  = 28;

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function formatDuration(raw: string | number): string {
  const secs = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  if (isNaN(secs) || secs <= 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M vues`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K vues`;
  return `${n} vues`;
}

function formatLikes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏷️ TAG PILL
// ─────────────────────────────────────────────────────────────────────────────
const TagPill = memo(({ label }: { label: string }) => (
  <View style={tp.pill}>
    <Text style={tp.txt}>{label}</Text>
  </View>
));
TagPill.displayName = 'TagPill';

const tp = StyleSheet.create({
  pill: {
    paddingHorizontal: 11,
    paddingVertical:    5,
    borderRadius:       20,
    borderWidth:        0.5,
    borderColor:       T.tagBorder,
    marginRight:        6,
    marginBottom:       6,
  },
  txt: { color: T.textSec, fontSize: 12, fontWeight: '500' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📊 STAT BLOCK
// ─────────────────────────────────────────────────────────────────────────────
interface StatBlockProps { value: string; label: string; icon: keyof typeof Ionicons.glyphMap }

const StatBlock = memo(({ value, label, icon }: StatBlockProps) => (
  <View style={sb.wrap}>
    <View style={sb.iconWrap}>
      <Ionicons name={icon} size={16} color={T.textSec} />
    </View>
    <Text style={sb.value}>{value}</Text>
    <Text style={sb.label}>{label}</Text>
  </View>
));
StatBlock.displayName = 'StatBlock';

const sb = StyleSheet.create({
  wrap: {
    flex:           1,
    alignItems:     'center',
    gap:             4,
    paddingVertical: 14,
    borderRadius:    14,
    backgroundColor: T.tag,
    borderWidth:     0.5,
    borderColor:     T.tagBorder,
  },
  iconWrap: { marginBottom: 2 },
  value:    { color: T.text,    fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  label:    { color: T.textTer, fontSize: 10, fontWeight: '500', letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📋 META ROW
// ─────────────────────────────────────────────────────────────────────────────
interface MetaRowProps { label: string; value: string }

const MetaRow = memo(({ label, value }: MetaRowProps) => (
  <View style={mr.row}>
    <Text style={mr.label}>{label}</Text>
    <Text style={mr.value}>{value}</Text>
  </View>
));
MetaRow.displayName = 'MetaRow';

const mr = StyleSheet.create({
  row: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    paddingVertical:  10,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  label: { color: T.textTer, fontSize: 13, fontWeight: '500', flex: 1 },
  value: { color: T.text,    fontSize: 13, fontWeight: '600', flex: 2, textAlign: 'right' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🪟 SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────
const SectionTitle = memo(({ label }: { label: string }) => (
  <View style={st.row}>
    <View style={st.line} />
    <Text style={st.txt}>{label}</Text>
    <View style={st.line} />
  </View>
));
SectionTitle.displayName = 'SectionTitle';

const st = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  line: { flex: 1, height: 0.5, backgroundColor: T.border },
  txt:  { color: T.textTer, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 INFO SHEET
// ─────────────────────────────────────────────────────────────────────────────
interface InfoSheetProps {
  film:    FeedFilm | null;
  onClose: () => void;
}

const InfoSheet = memo(({ film, onClose }: InfoSheetProps) => {
  const insets  = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(1000)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const visible    = useRef(false);

  // ── Animate in/out ────────────────────────────────────────────────────────
  useEffect(() => {
    if (film) {
      visible.current = true;
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, ...SPRING_CONFIG }),
        Animated.timing(opacity, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: true }),
      ]).start();
    } else if (visible.current) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 1000, ...SPRING_CONFIG }),
        Animated.timing(opacity, { toValue: 0, duration: ANIM_DURATION - 40, useNativeDriver: true }),
      ]).start(() => { visible.current = false; });
    }
  }, [film]);

  // ── Données dérivées mémoïsées ─────────────────────────────────────────────
  const durationFmt  = useMemo(() => film ? formatDuration(film.duration)   : '—', [film?.duration]);
  const viewsFmt     = useMemo(() => film ? formatViews(film.views_count)    : '—', [film?.views_count]);
  const likesFmt     = useMemo(() => film ? formatLikes(film.likes_count)    : '—', [film?.likes_count]);

  const metaRows = useMemo(() => film ? [
    { label: 'Réalisateur',    value: film.director },
    { label: 'Année',          value: film.year },
    { label: 'Genre',          value: film.genre },
    { label: 'Durée',          value: durationFmt },
  ] : [], [film, durationFmt]);

  if (!film && !visible.current) return null;

  const paddingBottom = Math.max(insets.bottom, 24);

  return (
    
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">

      {/* ── Backdrop ────────────────────────────────────────────────────── */}
      <Animated.View
        style={[is.backdrop, { opacity }]}
        pointerEvents={film ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>


      {/* ── Sheet ───────────────────────────────────────────────────────── */}

      <Animated.View
        style={[
          is.sheet,
          { transform: [{ translateY }], paddingBottom },
        ]}
        pointerEvents={film ? 'auto' : 'none'}
      >
        {/* Fond verre */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 30}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        {/* Fond navyMid */}
        <GalaxyBackground />


        {/* ── Handle ────────────────────────────────────────────────────── */}
        <View style={is.handleWrap}>
          <View style={is.handle} />
        </View>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={is.header}>
          <View style={is.headerLeft}>
            {/* Catégorie */}
            <View style={is.genreBadge}>
              <Text style={is.genreTxt}>{film?.genre ?? ''}</Text>
            </View>
            <Text style={is.title} numberOfLines={2}>{film?.title ?? ''}</Text>
          </View>
          {/* Bouton close */}
          <TouchableOpacity
            style={is.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color={T.text} />
          </TouchableOpacity>
        </View>

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <View style={is.statsRow}>
          <StatBlock icon="eye-outline"    value={viewsFmt}    label="VUES"  />
          <View style={{ width: 8 }} />
          <StatBlock icon="heart-outline"  value={likesFmt}    label="LIKES" />
          <View style={{ width: 8 }} />
          <StatBlock icon="time-outline"   value={durationFmt} label="DURÉE" />
        </View>

        {/* ── Corps scrollable ──────────────────────────────────────────── */}
        <ScrollView
          style={is.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={is.scrollContent}
          bounces
        >
          {/* Métadonnées */}
          <SectionTitle label="À propos de l'œuvre" />
          {metaRows.map((row) => (
            <MetaRow key={row.label} label={row.label} value={row.value} />
          ))}

          {/* Synopsis */}
          {!!film?.synopsis && (
            <>
              <SectionTitle label="Synopsis" />
              <Text style={is.synopsis}>{film.synopsis}</Text>
            </>
          )}

          {/* Tags */}
          {!!film?.tags?.length && (
            <>
              <SectionTitle label="Tags" />
              <View style={is.tagsWrap}>
                {film.tags.map((tag) => (
                  <TagPill key={tag} label={tag} />
                ))}
              </View>
            </>
          )}

          {/* Amis qui aiment */}
          {!!film?.liked_by_friends?.length && (
            <>
              <SectionTitle label={`Aimé par ${film.liked_by_friends.length} ami${film.liked_by_friends.length > 1 ? 's' : ''}`} />
              <View style={is.friendsRow}>
                {film.liked_by_friends.map((f) => (
                  <View key={f.id} style={is.friendChip}>
                    <Text style={is.friendName}>{f.username ?? f.id}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

            {/* Date de publication */}
            {!!film?.created_at && (
            <>
              <SectionTitle label="Publication" />
              <MetaRow
              label="Date"
              value={new Date(film.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
              />
            </>
            )}

            <View style={{ height: 80 }} />

          <View style={{ height: 12 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
});
InfoSheet.displayName = 'InfoSheet';
export default InfoSheet;

// ─────────────────────────────────────────────────────────────────────────────
// 💅 STYLES
// ─────────────────────────────────────────────────────────────────────────────
const is = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  
    zIndex:          90,
  },

  sheet: {
    position:             'absolute',
    bottom:                0,
    left:                  0,
    right:                 0,
    zIndex:                91,
    borderTopLeftRadius:   SHEET_RADIUS,
    borderTopRightRadius:  SHEET_RADIUS,
    overflow:              'hidden',
    maxHeight:             '92%',
  },

  handleWrap: {
    alignItems:   'center',
    paddingTop:    10,
    paddingBottom:  6,
  },
  handle: {
    width:           40,
    height:           4,
    borderRadius:     2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  header: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    paddingHorizontal: 22,
    paddingTop:        6,
    paddingBottom:     16,
    gap:               12,
  },
  headerLeft:  { flex: 1, gap: 6 },
  title: {
    color:         T.text,
    fontSize:       26,
    fontWeight:    '800',
    letterSpacing: -0.6,
    lineHeight:     31,
  },

  genreBadge: {
    alignSelf:         'flex-start',
    paddingHorizontal:  10,
    paddingVertical:     3,
    borderRadius:        20,
    backgroundColor:    'rgba(255,255,255,0.07)',
    borderWidth:         0.5,
    borderColor:        T.borderLight,
  },
  genreTxt: {
    color:         T.textSec,
    fontSize:       11,
    fontWeight:    '600',
    letterSpacing:  0.5,
    textTransform: 'uppercase',
  },

  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: T.close,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:        4,
  },

  statsRow: {
    flexDirection:    'row',
    paddingHorizontal: 22,
    marginBottom:      4,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom:     16,
  },

  synopsis: {
    color:       T.textSec,
    fontSize:     14,
    lineHeight:   22,
    fontWeight:  '400',
  },

  tagsWrap: {
    flexDirection: 'row',
    flexWrap:      'wrap',
  },

  friendsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:            8,
  },
  friendChip: {
    paddingHorizontal: 12,
    paddingVertical:    6,
    borderRadius:       20,
    backgroundColor:   T.tag,
    borderWidth:        0.5,
    borderColor:       T.tagBorder,
  },
  friendName: {
    color:      T.textSec,
    fontSize:    12,
    fontWeight: '500',
  },
});