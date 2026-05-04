/**
 * BottomCard.tsx — v2.0
 *
 * ✦ Barre de progression seekable — PanResponder (tap + drag)
 * ✦ Feedback immédiat pendant le drag (dragProgress local)
 * ✦ Thumb animé qui suit le doigt sans re-render
 * ✦ Fetch Supabase avec AbortController + cache par reelId
 * ✦ Skeleton shimmer pendant le chargement
 */

import React, {
  memo, useCallback, useEffect, useMemo,
  useRef, useState,
} from 'react';
import {
  Animated, PanResponder, StyleSheet,
  Text, View, GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase }       from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function formatLikes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function formatDuration(raw: string | number | undefined): string {
  if (!raw) return '';
  const secs = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  if (isNaN(secs) || secs <= 0) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m} min`;
}

/** Formate des secondes en mm:ss pour l'indicateur de temps pendant le seek */
function formatTime(secs: number): string {
  if (secs <= 0 || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface ReelMeta {
  title:       string;
  director?:   string;
  year?:       string | number;
  genre?:      string;
  duration?:   string | number;
  views_count: number;
  likes_count: number;
}

export interface BottomCardProps {
  /** ID du reel Supabase en cours de lecture */
  reelId:    string | number;
  /** Progression lecture 0→1 (Animated.Value ou number) */
  progress:  Animated.Value | number;
  /** Durée totale en secondes — requis pour le seek absolu */
  duration?: number;
  /** Callback seek : appelé avec le temps cible en secondes */
  onSeek?:   (seconds: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE — évite de re-fetcher quand on revient sur un reel déjà vu
// ─────────────────────────────────────────────────────────────────────────────
const metaCache = new Map<string | number, ReelMeta>();

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h, r = 4 }: { w: number | `${number}%`; h: number; r?: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View style={{
      width: w as any, height: h, borderRadius: r,
      backgroundColor: 'rgba(255,255,255,0.12)',
      opacity: anim, marginBottom: 5,
    }} />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SEEKABLE PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────
interface ProgressBarProps {
  /** Progression lecture 0→1 */
  progress:   Animated.Value | number;
  /** Durée totale en secondes */
  duration:   number;
  /** Appelé avec le temps cible en secondes */
  onSeek?:    (seconds: number) => void;
}

const ProgressBar = memo(function ProgressBar({
  progress, duration, onSeek,
}: ProgressBarProps) {

  // ── Layout track ────────────────────────────────────────────────────────────
  // trackWidth via onLayout — synchrone, toujours à jour après rotation.
  const trackWidthRef = useRef(1);

  // ── Drag state ─────────────────────────────────────────────────────────────
  const dragAnim   = useRef(new Animated.Value(0)).current;
  const isDragging = useRef(false);
  const [dragging, setDragging]  = useState(false);
  const [seekTime, setSeekTime]  = useState(0);

  // ── Conversion locationX → pct ─────────────────────────────────────────────
  // locationX est relatif au View qui porte le PanResponder :
  // pas besoin de measure() ni de pageX − trackX.current.
  const pctFromLocationX = useCallback((lx: number): number =>
    Math.min(1, Math.max(0, lx / trackWidthRef.current))
  , []);

  // ── PanResponder ────────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,

      onPanResponderGrant: (e) => {
        isDragging.current = true;
        setDragging(true);
        const pct = pctFromLocationX(e.nativeEvent.locationX);
        dragAnim.setValue(pct);
        setSeekTime(pct * duration);
      },

      onPanResponderMove: (e) => {
        if (!isDragging.current) return;
        const pct = pctFromLocationX(e.nativeEvent.locationX);
        dragAnim.setValue(pct);
        setSeekTime(pct * duration);
      },

      onPanResponderRelease: (e) => {
        const pct  = pctFromLocationX(e.nativeEvent.locationX);
        const secs = pct * duration;
        isDragging.current = false;
        setDragging(false);
        onSeek?.(secs);
      },

      onPanResponderTerminate: () => {
        isDragging.current = false;
        setDragging(false);
      },
    }),
  ).current;

  const trackWidth = useRef(1);

  const trackRef = useRef<View>(null);
  useEffect(() => {
    // Mesure initiale via ref + setTimeout (fallback si onLayout n'a pas encore eu lieu)
    const measureTrack = () => {
      trackRef.current?.measure((x, y, w) => {
        if (w > 0) trackWidthRef.current = w;
      });
    };
    measureTrack();
    const timeout = setTimeout(measureTrack, 1000);
    return () => clearTimeout(timeout);
  }, []);

  // ── Valeur effective de progression (drag override ou lecture normale) ─────
  const isAnimatedValue = progress && typeof (progress as any).interpolate === 'function';

  // Interpolation de la largeur de la fill + position du thumb
  const activeProg: Animated.Value | Animated.AnimatedInterpolation<string | number> =
    dragging
      ? dragAnim
      : isAnimatedValue
        ? (progress as Animated.Value)
        : new Animated.Value(Number(progress) || 0);

  const fillWidth = (activeProg as any).interpolate
    ? (activeProg as Animated.Value).interpolate({
        inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp',
      })
    : `${Math.min(1, Math.max(0, Number(activeProg))) * 100}%`;

  // Position absolue du thumb (0%→100% sur la track)
  const thumbLeft = fillWidth;

  // ── Zone de touche agrandie (hitSlop vertical) ──────────────────────────────
  return (
    <View style={pb.container} {...panResponder.panHandlers}>
      {/* Indicateur de temps pendant le drag */}
      {dragging && duration > 0 && (
        <Animated.View
          style={[
            pb.seekBubble,
            {
              left: (dragAnim as any).interpolate({
                inputRange:  [0, 1],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
          pointerEvents="none"
        >
          <View style={pb.seekBubbleInner}>
            <Text style={pb.seekBubbleTxt}>{formatTime(seekTime)}</Text>
          </View>
        </Animated.View>
      )}

      {/* Track */}
      <View
        ref={trackRef}
        style={[pb.track, dragging && pb.trackActive]}
        onLayout={e => {
          // Mesure initiale via onLayout (fallback si measure échoue)
          trackWidth.current = e.nativeEvent.layout.width;
        }}
      >
        {/* Fill */}
        <Animated.View style={[pb.fill, { width: fillWidth as any }]} />

        {/* Thumb */}
        <Animated.View
          style={[
            pb.thumb,
            { left: thumbLeft as any },
            dragging && pb.thumbActive,
          ]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
});

const pb = StyleSheet.create({
  // Zone de touch agrandie (padding vertical = zone cliquable plus grande)
  container: {
    paddingVertical: 14,
    marginTop:        4,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },

  track: {
    height:          3,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius:    2,
    position:        'relative',
    // Transition subtile lors du drag
  },
  trackActive: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  fill: {
    position:        'absolute',
    left:             0,
    top:              0,
    bottom:           0,
    backgroundColor: '#FFFFFF',
    borderRadius:    2,
  },

  thumb: {
    position:        'absolute',
    top:             -4.5,       // centré verticalement sur la track (3px)
    marginLeft:      -5,
    width:            10,
    height:           10,
    borderRadius:    5,
    backgroundColor: '#FFFFFF',
    shadowColor:     '#FFFFFF',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.9,
    shadowRadius:    6,
    elevation:        4,
    // Invisible tant que la vidéo n'a pas encore commencé
  },
  thumbActive: {
    width:           14,
    height:          14,
    borderRadius:    7,
    top:             -5.5,
    marginLeft:      -7,
    shadowRadius:    10,
  },

  // Bulle temps au-dessus du thumb
  seekBubble: {
    position:  'absolute',
    bottom:    16,           // au-dessus de la track
    transform: [{ translateX: -22 }],
  },
  seekBubbleInner: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius:    6,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.15)',
  },
  seekBubbleTxt: {
    color:      '#FFFFFF',
    fontSize:   12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM CARD
// ─────────────────────────────────────────────────────────────────────────────
const BottomCard = memo(function BottomCard({
  reelId, progress, duration = 0, onSeek,
}: BottomCardProps) {

  const [meta,    setMeta]    = useState<ReelMeta | null>(metaCache.get(reelId) ?? null);
  const [loading, setLoading] = useState(!metaCache.has(reelId));

  // ── Fetch avec AbortController + cache ────────────────────────────────────
  useEffect(() => {
    // Déjà en cache → pas de requête
    if (metaCache.has(reelId)) {
      setMeta(metaCache.get(reelId)!);
      setLoading(false);
      return;
    }

    setMeta(null);
    setLoading(true);

    const controller = new AbortController();

    supabase
      .from('reels')
      .select('title, director, year, genre, duration, views_count, likes_count')
      .eq('id', reelId)
      .abortSignal(controller.signal)
      .single()
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        if (error || !data) { setLoading(false); return; }
        metaCache.set(reelId, data as ReelMeta);
        setMeta(data as ReelMeta);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });

    return () => controller.abort();
  }, [reelId]);

  // ── Durée effective : prop duration (depuis FeedItem) ou meta.duration ────
  const effectiveDuration = useMemo(() => {
    if (duration > 0) return duration;
    if (!meta?.duration) return 0;
    const d = typeof meta.duration === 'string'
      ? parseInt(meta.duration, 10)
      : meta.duration;
    return isNaN(d) ? 0 : d;
  }, [duration, meta?.duration]);

  // ── Ligne de métadonnées ──────────────────────────────────────────────────
  const metaLine = useMemo(() => [
    meta?.director,
    meta?.year ? String(meta.year) : undefined,
    meta?.genre,
    effectiveDuration > 0 ? formatDuration(effectiveDuration) : undefined,
  ].filter(Boolean).join('  ·  '), [meta, effectiveDuration]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.wrapper} pointerEvents="box-none">

      {/* Dégradé bas pour lisibilité */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.68)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.inner} pointerEvents="box-none">

        {/* ── Skeleton pendant le chargement ── */}
        {loading && (
          <View style={s.skeletonWrap}>
            <Shimmer w="60%" h={14} r={5} />
            <Shimmer w="42%" h={10} r={4} />
          </View>
        )}

        {/* ── Contenu chargé ── */}
        {!loading && meta && (
          <>
            <Text style={s.title} numberOfLines={1}>{meta.title}</Text>
            {!!metaLine && (
              <Text style={s.meta} numberOfLines={1}>{metaLine}</Text>
            )}
            <View style={s.stats}>
              <Text style={s.stat}>👁 {formatViews(meta.views_count)}</Text>
              <Text style={s.dot}>·</Text>
              <Text style={s.stat}>♥ {formatLikes(meta.likes_count)}</Text>
            </View>
          </>
        )}

        {/* ── Barre de progression seekable ── */}
        {/*
          Toujours rendu (même pendant le chargement) pour que
          l'utilisateur puisse déjà interagir si la vidéo joue.
          pointerEvents="auto" explicite pour que le PanResponder
          ne soit pas bloqué par le pointerEvents="box-none" parent.
        */}
        <View pointerEvents="auto">
          <ProgressBar
            progress={progress}
            duration={effectiveDuration}
            onSeek={onSeek}
          />
        </View>

      </View>
    </View>
  );
});

BottomCard.displayName = 'BottomCard';
export default BottomCard;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrapper: {
    position:     'absolute',
    bottom:        0,
    left:          0,
    right:         0,
    paddingBottom: 90,
  },

  inner: {
    paddingHorizontal: 24,
    paddingTop:        32,
    paddingBottom:     0,
  },

  skeletonWrap: {
    gap: 4,
    marginBottom: 4,
  },

  title: {
    color:            'rgba(255,255,255,0.95)',
    fontSize:          16,
    fontWeight:       '700',
    letterSpacing:    -0.3,
    marginBottom:      3,
    textShadowColor:  'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius:  4,
  },

  meta: {
    color:         'rgba(255,255,255,0.45)',
    fontSize:       11,
    fontWeight:    '500',
    letterSpacing:  0.2,
    marginBottom:   6,
  },

  stats: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            6,
  },

  stat: {
    color:      'rgba(255,255,255,0.40)',
    fontSize:    11,
    fontWeight: '500',
  },

  dot: {
    color:    'rgba(255,255,255,0.20)',
    fontSize:  11,
  },
});