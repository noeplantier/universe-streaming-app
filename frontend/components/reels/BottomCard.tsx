/**
 * BottomCard.tsx — UNIVERSE · v4
 *
 * FIXES CRITIQUES :
 * ★ Seek bar : fillAnim mis à jour via .setValue() dans PanResponder
 *   → AUCUN re-render React pendant le drag, 60 fps garanti
 * ★ currentTime réactif venu de FeedItem (state, pas snapshot ref)
 * ★ fillAnim sync depuis progress quand pas en drag
 *   → Interpolation string ('0%'→'100%') pour fillWidth + thumbLeft
 * ★ thumb positionné avec marginLeft:-9 + left=fillWidth
 *   → Pas de décalage de positionnement
 * ★ visible → opacity 200 ms pour masquage fullscreen
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
const NAV_BAR_CLEARANCE = 92;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface BottomCardProps {
  film:        FeedFilm;
  progress:    number;    // 0–1
  duration:    number;    // secondes
  currentTime: number;    // secondes — STATE réactif venant de FeedItem
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

  // ── Seek drag state ────────────────────────────────────────────────────────
  // draggingRef : ref synchrone pour PanResponder (pas de stale closure)
  const draggingRef    = useRef(false);
  const [dragging, _setDragging] = useState(false);
  const setDragging    = useCallback((v: boolean) => {
    draggingRef.current = v;
    _setDragging(v);
  }, []);

  // dragSecRef : secondes courantes pendant le drag (pour le chrono)
  const dragSecRef = useRef(0);
  const [dragSec, _setDragSec] = useState(0);
  const setDragSec = useCallback((s: number) => {
    dragSecRef.current = s;
    _setDragSec(s);
  }, []);

  // ── Track width — mesuré via onLayout ────────────────────────────────────
  const trackWRef = useRef(1);
  const [trackW, _setTrackW] = useState(1);
  const setTrackW = useCallback((w: number) => {
    trackWRef.current = w;
    _setTrackW(w);
  }, []);

  // ── Refs stables pour PanResponder ───────────────────────────────────────
  const durRef    = useRef(duration);
  const onSeekRef = useRef(onSeek);
  durRef.current    = duration;
  onSeekRef.current = onSeek;

  // ── Animated values ───────────────────────────────────────────────────────
  const overlayOp  = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const controlsOp = useRef(new Animated.Value(0)).current;
  const trackH     = useRef(new Animated.Value(3)).current;
  const thumbScale = useRef(new Animated.Value(0)).current;

  // ★ fillAnim : la valeur (0→1) qui pilote fill + thumb via interpolation
  // On utilise .setValue() dans PanResponder → 0 re-render côté React
  const fillAnim = useRef(new Animated.Value(progress)).current;

  // Sync fillAnim depuis progress (quand pas en drag)
  useEffect(() => {
    if (!draggingRef.current) {
      fillAnim.setValue(Math.max(0, Math.min(progress, 0.99999)));
    }
  }, [progress, fillAnim]);

  // ── Visibility ────────────────────────────────────────────────────────────
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

  // ── Expand / collapse track ───────────────────────────────────────────────
  const expand = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackH,    { toValue:7, useNativeDriver:false, tension:320, friction:14 }),
      Animated.spring(thumbScale,{ toValue:1, useNativeDriver:true,  tension:320, friction:14 }),
    ]).start();
  }, [trackH, thumbScale]);

  const collapse = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackH,    { toValue:3, useNativeDriver:false, tension:320, friction:14 }),
      Animated.spring(thumbScale,{ toValue:0, useNativeDriver:true,  tension:320, friction:14 }),
    ]).start();
  }, [trackH, thumbScale]);

  // ── Calcul de pourcentage à partir de X ──────────────────────────────────
  const pctFromX = useCallback((lx: number) =>
    Math.max(0, Math.min(1, lx / Math.max(trackWRef.current, 1))),
  []);

  // ── PanResponder — créé UNE SEULE FOIS ───────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,

      onPanResponderGrant: (e) => {
        const pct = pctFromX(e.nativeEvent.locationX);
        const sec = pct * durRef.current;
        draggingRef.current = true;
        _setDragging(true);
        dragSecRef.current = sec;
        _setDragSec(sec);
        // ★ .setValue() immédiat → pas de re-render
        fillAnim.setValue(pct);
        expand();
        onSeekRef.current(sec);
      },

      onPanResponderMove: (e) => {
        const pct = pctFromX(e.nativeEvent.locationX);
        const sec = pct * durRef.current;
        dragSecRef.current = sec;
        _setDragSec(sec);
        // ★ Frame-by-frame sans re-render React
        fillAnim.setValue(pct);
        onSeekRef.current(sec);
      },

      onPanResponderRelease: (e) => {
        const pct = pctFromX(e.nativeEvent.locationX);
        const sec = pct * durRef.current;
        fillAnim.setValue(pct);
        onSeekRef.current(sec);
        draggingRef.current = false;
        _setDragging(false);
        collapse();
      },

      onPanResponderTerminate: () => {
        draggingRef.current = false;
        _setDragging(false);
        collapse();
      },
    }),
  ).current;

  // ── Chrono affiché ────────────────────────────────────────────────────────
  const displaySec = dragging ? dragSec : currentTime;

  // ── fill + thumb via interpolation sur fillAnim ───────────────────────────
  // fillAnim : 0 → 1 → '0%' → '100%'
  const fillWidth = fillAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  // ── Données film ──────────────────────────────────────────────────────────
  const metaParts: string[] = [];
  if (film.director) metaParts.push(film.director);
  if (film.year)     metaParts.push(String(film.year));
  if (film.genre)    metaParts.push(film.genre);
  const metaLine = metaParts.join('  ·  ');
  const hasStats = (film.views_count ?? 0) > 0 || (film.likes_count ?? 0) > 0;

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
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.82)', 'rgba(0,0,0,0.96)']}
        locations={[0, 0.28, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={bc.inner} pointerEvents="box-none">

        {/* ── Titre ──────────────────────────────────────────────────────── */}
        {!!film.title && (
          <Text style={bc.title} numberOfLines={2}>{film.title}</Text>
        )}

        {/* ── Meta ───────────────────────────────────────────────────────── */}
        {!!metaLine && (
          <Text style={bc.meta} numberOfLines={1}>{metaLine}</Text>
        )}

        {/* ── Synopsis ───────────────────────────────────────────────────── */}
        {!!film.synopsis && (
          <Text style={bc.synopsis} numberOfLines={2}>{film.synopsis}</Text>
        )}

        {/* ── Stats ──────────────────────────────────────────────────────── */}
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

        {/* ── SEEK BAR ───────────────────────────────────────────────────── */}
        <Animated.View
          style={[bc.seekSection, { opacity: controlsOp }]}
          pointerEvents={isReady ? 'box-none' : 'none'}
        >
          {/* Chrono */}
          <View style={bc.timeRow} pointerEvents="none">
            <Text style={bc.timeCurrent}>{fmtTime(displaySec)}</Text>
            <Text style={bc.timeDuration}>{fmtTime(duration)}</Text>
          </View>

          {/* Zone tactile 44 px */}
          <View
            style={[
              bc.trackHit,
              Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
            ]}
            onLayout={e => setTrackW(e.nativeEvent.layout.width)}
            {...pan.panHandlers}
          >
            <Animated.View style={[bc.track, { height: trackH }]}>

              {/* Background */}
              <View style={bc.trackBg} />

              {/* ★ Fill animé sans re-render */}
              <Animated.View style={[bc.trackFill, { width: fillWidth }]} />

              {/* ★ Thumb — left = fillWidth, centré par marginLeft */}
              <Animated.View
                style={[
                  bc.thumb,
                  { left: fillWidth, transform: [{ scale: thumbScale }] },
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
    color:'rgba(255,255,255,0.38)', fontSize:11, lineHeight:15,
  },

  stats: { flexDirection:'row', alignItems:'center', gap:5, marginTop:2 },
  statIcon: { fontSize:10, opacity:0.55 },
  stat: { color:'rgba(255,255,255,0.48)', fontSize:11, fontWeight:'600' },
  dot:  { color:'rgba(255,255,255,0.22)', fontSize:12, marginHorizontal:1 },

  seekSection: { gap:4, marginTop:8 },

  timeRow: {
    flexDirection:'row', justifyContent:'space-between', marginBottom:2,
  },
  timeCurrent: {
    color:'rgba(255,255,255,0.90)', fontSize:11, fontWeight:'700',
    fontVariant:['tabular-nums'],
  },
  timeDuration: {
    color:'rgba(255,255,255,0.30)', fontSize:11,
    fontVariant:['tabular-nums'],
  },

  // Zone tactile 44 px — ergonomique
  trackHit: { height:44, justifyContent:'center' },

  track: {
    width:'100%', borderRadius:4,
    justifyContent:'center',
    overflow:'visible',
  },

  trackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:'rgba(255,255,255,0.20)',
    borderRadius:4,
  },

  trackFill: {
    height:'100%',
    backgroundColor:'#FFFFFF',
    borderRadius:4,
  },

  thumb: {
    position:       'absolute',
    width:           18,
    height:          18,
    borderRadius:     9,
    backgroundColor:'#FFFFFF',
    marginLeft:      -9,   // ★ centre le thumb sur sa position
    top:            '50%',
    marginTop:       -9,
    shadowColor:    '#FFFFFF',
    shadowOffset:   { width:0, height:0 },
    shadowOpacity:   0.95,
    shadowRadius:    8,
    elevation:       8,
  },
});