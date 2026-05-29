/**
 * BottomCard.tsx — UNIVERSE · v3
 *
 * ★ Seek bar haute précision — position mise à jour à la milliseconde
 *   (onLayout → trackW précis, pctFromX exact, seek immédiat)
 * ★ currentTime prop passée depuis FeedItem pour lecture synchrone
 * ★ Thumb glisse en temps réel pendant le drag
 * ★ Track s'épaissit (3→7 px) + thumb scale au drag
 * ★ Release → seek final précis
 * ★ visible prop → opacity fade 200 ms (masquage via showUI)
 * ★ Dégagement CustomNavBar conservé
 * ★ Compatible iOS / Android / Web
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Platform,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { FeedFilm } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────
const NAV_BAR_CLEARANCE = 92; // CustomNavBar : bottom=12, h=70, +10 marge

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface BottomCardProps {
  film:        FeedFilm;
  progress:    number;      // 0–1 (calculé depuis currentTime/duration)
  duration:    number;      // secondes (0 = inconnu)
  currentTime: number;      // secondes (lecture synchrone)
  isReady:     boolean;
  insetBot:    number;
  onSeek:      (seconds: number) => void;
  visible?:    boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────
function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function fmtCount(n: number): string {
  if (!n || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// BottomCard
// ─────────────────────────────────────────────────────────────────────────────
const BottomCard = memo(function BottomCard({
  film, progress, duration, currentTime,
  isReady, insetBot, onSeek, visible = true,
}: BottomCardProps) {

  // ── Seek state ─────────────────────────────────────────────────────────────
  const [trackW,   setTrackW]   = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragPct,  setDragPct]  = useState(0);

  // Refs stables pour PanResponder (évite re-création)
  const trackWRef   = useRef(1);
  const durRef      = useRef(duration);
  const onSeekRef   = useRef(onSeek);
  const draggingRef = useRef(false);

  trackWRef.current  = trackW;
  durRef.current     = duration;
  onSeekRef.current  = onSeek;

  // ── Animated values ─────────────────────────────────────────────────────────
  const controlsOp  = useRef(new Animated.Value(0)).current;
  const overlayOp   = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const trackHeight = useRef(new Animated.Value(3)).current;
  const thumbScale  = useRef(new Animated.Value(0)).current;
  // Animated value pour la position du thumb (évite re-render à chaque frame)
  const fillAnim    = useRef(new Animated.Value(progress)).current;

  // ── Sync fill animation depuis progress (quand pas en drag) ─────────────────
  useEffect(() => {
    if (!draggingRef.current) {
      fillAnim.setValue(Math.min(Math.max(progress, 0), 0.9999));
    }
  }, [progress, fillAnim]);

  // ── Visibility ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(overlayOp, {
      toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true,
    }).start();
  }, [visible, overlayOp]);

  // ── isReady fade ──────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(controlsOp, {
      toValue: isReady ? 1 : 0, duration: 280, useNativeDriver: true,
    }).start();
  }, [isReady, controlsOp]);

  // ── Expand / collapse ────────────────────────────────────────────────────
  const expand = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackHeight, { toValue:7, useNativeDriver:false, tension:320, friction:14 }),
      Animated.spring(thumbScale,  { toValue:1, useNativeDriver:true,  tension:320, friction:14 }),
    ]).start();
  }, [trackHeight, thumbScale]);

  const collapse = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackHeight, { toValue:3, useNativeDriver:false, tension:320, friction:14 }),
      Animated.spring(thumbScale,  { toValue:0, useNativeDriver:true,  tension:320, friction:14 }),
    ]).start();
  }, [trackHeight, thumbScale]);

  // ── Calcul précis depuis coordonnée X ────────────────────────────────────
  const pctFromX = useCallback((lx: number) =>
    Math.max(0, Math.min(1, lx / Math.max(trackWRef.current, 1))),
  []);

  // ── PanResponder stable ───────────────────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,

      onPanResponderGrant: (e) => {
        const pct = pctFromX(e.nativeEvent.locationX);
        draggingRef.current = true;
        setDragging(true);
        setDragPct(pct);
        fillAnim.setValue(pct);
        expand();
        // Seek immédiat → latence minimale
        onSeekRef.current(pct * durRef.current);
      },

      onPanResponderMove: (e) => {
        const pct = pctFromX(e.nativeEvent.locationX);
        setDragPct(pct);
        fillAnim.setValue(pct); // mise à jour frame par frame
        // Seek continu pour aperçu temps réel
        onSeekRef.current(pct * durRef.current);
      },

      onPanResponderRelease: (e) => {
        const pct = pctFromX(e.nativeEvent.locationX);
        fillAnim.setValue(pct);
        onSeekRef.current(pct * durRef.current);
        draggingRef.current = false;
        setDragging(false);
        collapse();
      },

      onPanResponderTerminate: () => {
        draggingRef.current = false;
        setDragging(false);
        collapse();
      },
    }),
  ).current;

  // ── Valeurs affichées ─────────────────────────────────────────────────────
  const displaySec = dragging
    ? dragPct * (duration || 0)
    : currentTime;

  // ── Données film ──────────────────────────────────────────────────────────
  const metaParts: string[] = [];
  if (film.director) metaParts.push(film.director);
  if (film.year)     metaParts.push(String(film.year));
  if (film.genre)    metaParts.push(film.genre);
  const metaLine = metaParts.join('  ·  ');
  const hasStats = (film.views_count ?? 0) > 0 || (film.likes_count ?? 0) > 0;

  // fillWidth interpolée depuis fillAnim (0→1 → 0%→100%)
  const fillWidth = fillAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  // thumbLeft identique à fillWidth mais le thumb est positionné en %
  // On utilise une interpolation sur fillAnim pour éviter re-renders
  // (le thumb suit le fill à la même valeur)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        bc.wrapper,
        { paddingBottom: insetBot + NAV_BAR_CLEARANCE },
        { opacity: overlayOp },
      ]}
      pointerEvents="box-none"
    >
      {/* Gradient de lisibilité */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(0,0,0,0.45)',
          'rgba(0,0,0,0.82)',
          'rgba(0,0,0,0.96)',
        ]}
        locations={[0, 0.28, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={bc.inner} pointerEvents="box-none">

        {/* ── Titre ──────────────────────────────────────────────────────── */}
        {!!film.title && (
          <Text style={bc.title} numberOfLines={2}>{film.title}</Text>
        )}

        {/* ── Meta ──────────────────────────────────────────────────────── */}
        {!!metaLine && (
          <Text style={bc.meta} numberOfLines={1}>{metaLine}</Text>
        )}

        {/* ── Synopsis ──────────────────────────────────────────────────── */}
        {!!film.synopsis && (
          <Text style={bc.synopsis} numberOfLines={2}>{film.synopsis}</Text>
        )}

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        {hasStats && (
          <View style={bc.stats} pointerEvents="none">
            {(film.views_count ?? 0) > 0 && (
              <>
                <Text style={bc.statIcon}>👁</Text>
                <Text style={bc.stat}>{fmtCount(film.views_count ?? 0)}</Text>
              </>
            )}
            {(film.views_count ?? 0) > 0 && (film.likes_count ?? 0) > 0 && (
              <Text style={bc.dot}>·</Text>
            )}
            {(film.likes_count ?? 0) > 0 && (
              <>
                <Text style={bc.statIcon}>♥</Text>
                <Text style={bc.stat}>{fmtCount(film.likes_count ?? 0)}</Text>
              </>
            )}
          </View>
        )}

        {/* ── SEEK BAR + CHRONO ──────────────────────────────────────────── */}
        <Animated.View
          style={[bc.seekSection, { opacity: controlsOp }]}
          pointerEvents={isReady ? 'box-none' : 'none'}
        >
          {/* Chrono */}
          <View style={bc.timeRow} pointerEvents="none">
            <Text style={bc.timeCurrent}>{fmtTime(displaySec)}</Text>
            <Text style={bc.timeDuration}>{fmtTime(duration)}</Text>
          </View>

          {/* Zone tactile 44 px → ergonomique */}
          <View
            style={[
              bc.trackHit,
              Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
            ]}
            onLayout={e => {
              const w = e.nativeEvent.layout.width;
              setTrackW(w);
              trackWRef.current = w;
            }}
            {...pan.panHandlers}
          >
            {/* Track animée en hauteur */}
            <Animated.View style={[bc.track, { height: trackHeight }]}>

              {/* Background track */}
              <View style={bc.trackBg} />

              {/* Fill — Animated.View pour perf native */}
              <Animated.View style={[bc.trackFill, { width: fillWidth }]} />

              {/* Thumb — scale au drag */}
              <Animated.View
                style={[
                  bc.thumb,
                  { left: fillWidth },
                  { transform: [{ scale: thumbScale }] },
                ]}
              />

            </Animated.View>
          </View>
        </Animated.View>

      </View>
    </Animated.View>
  );
});

export default BottomCard;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const bc = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },

  inner: {
    paddingHorizontal: 18,
    paddingTop:        56,
    gap:                6,
  },

  // ── Texte ────────────────────────────────────────────────────────────────
  title: {
    color:         'rgba(255,255,255,0.97)',
    fontSize:       18,
    fontWeight:    '800',
    letterSpacing: -0.5,
    lineHeight:     23,
    textShadowColor:  'rgba(0,0,0,0.55)',
    textShadowOffset: { width:0, height:1 },
    textShadowRadius:  5,
  },

  meta: {
    color:        'rgba(255,255,255,0.48)',
    fontSize:      12,
    fontStyle:    'italic',
    letterSpacing: 0.1,
  },

  synopsis: {
    color:     'rgba(255,255,255,0.38)',
    fontSize:   11,
    lineHeight: 15,
  },

  // ── Stats ────────────────────────────────────────────────────────────────
  stats: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            5,
    marginTop:      2,
  },
  statIcon: { fontSize:10, opacity:0.55 },
  stat:  { color:'rgba(255,255,255,0.48)', fontSize:11, fontWeight:'600' },
  dot:   { color:'rgba(255,255,255,0.22)', fontSize:12, marginHorizontal:1 },

  // ── Seek bar ─────────────────────────────────────────────────────────────
  seekSection: {
    gap:       4,
    marginTop: 8,
  },

  timeRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:    2,
  },

  timeCurrent: {
    color:       'rgba(255,255,255,0.90)',
    fontSize:     11,
    fontWeight:  '700',
    fontVariant: ['tabular-nums'],
  },

  timeDuration: {
    color:       'rgba(255,255,255,0.30)',
    fontSize:     11,
    fontVariant: ['tabular-nums'],
  },

  // Zone tactile haute — 44 px (guidelines Apple/Google)
  trackHit: {
    height:          44,
    justifyContent: 'center',
  },

  track: {
    width:          '100%',
    borderRadius:    4,
    justifyContent: 'center',
    overflow:       'visible',
  },

  trackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius:     4,
  },

  trackFill: {
    height:          '100%',
    backgroundColor: '#FFFFFF',
    borderRadius:     4,
  },

  thumb: {
    position:        'absolute',
    width:            18,
    height:           18,
    borderRadius:      9,
    backgroundColor: '#FFFFFF',
    marginLeft:       -9,  // centre le thumb sur la position
    top:             '50%',
    marginTop:        -9,
    shadowColor:     '#FFFFFF',
    shadowOffset:    { width:0, height:0 },
    shadowOpacity:    0.95,
    shadowRadius:      8,
    elevation:         8,
  },
});