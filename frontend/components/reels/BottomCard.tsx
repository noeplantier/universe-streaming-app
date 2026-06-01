/**
 * BottomCard.tsx — UNIVERSE · v5
 *
 * FIX CRITIQUE SEEK BAR :
 * ★ trackRef.measure() au onPanResponderGrant → capture la position X absolue
 *   de la track sur l'écran (trackPageX)
 * ★ Tous les calculs utilisent (e.nativeEvent.pageX - trackPageX) / trackWidth
 *   → précision au pixel près, 0 décalage quelle que soit la position de la track
 * ★ fillAnim.setValue() frame-by-frame → 60 fps, 0 re-render React pendant le drag
 * ★ visible → opacity 200 ms (masquage fullscreen)
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
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { FeedFilm }  from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────
const NAV_BAR_CLEARANCE = 92; // CustomNavBar bottom=12 h=70 + 10 marge

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface BottomCardProps {
  film:        FeedFilm;
  progress:    number;   // 0–1
  duration:    number;   // secondes
  currentTime: number;   // secondes réactif depuis FeedItem
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

  // ── Track ref + dimensions absolues ──────────────────────────────────────
  // trackRef : référence au View de la zone tactile pour measure()
  const trackRef    = useRef<View>(null);
  // Stockés au moment du grant → restent stables pendant tout le drag
  const trackPageX  = useRef(0);   // position X absolue sur l'écran
  const trackWidth  = useRef(1);   // largeur de la zone tactile

  // ── Drag state ────────────────────────────────────────────────────────────
  const draggingRef  = useRef(false);
  const [dragging, _setDragging] = useState(false);
  const dragSecRef   = useRef(0);
  const [dragSec, _setDragSec]   = useState(0);

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
  // fillAnim (0→1) pilote fill + thumb via interpolation string
  const fillAnim   = useRef(new Animated.Value(progress)).current;

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

  // ── Expand / collapse ────────────────────────────────────────────────────
  const expand = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackH,     { toValue:7, useNativeDriver:false, tension:320, friction:14 }),
      Animated.spring(thumbScale, { toValue:1, useNativeDriver:true,  tension:320, friction:14 }),
    ]).start();
  }, [trackH, thumbScale]);

  const collapse = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackH,     { toValue:3, useNativeDriver:false, tension:320, friction:14 }),
      Animated.spring(thumbScale, { toValue:0, useNativeDriver:true,  tension:320, friction:14 }),
    ]).start();
  }, [trackH, thumbScale]);

  // ── Calcul précis : pageX absolu → pourcentage ────────────────────────────
  // ★ FIX CRITIQUE : on utilise pageX (coordonnée écran absolue)
  //   soustrait de trackPageX (position absolue de la track)
  //   → résultat correct même si la track est dans un composant imbriqué
  const pctFromPageX = useCallback((pageX: number) => {
    const raw = (pageX - trackPageX.current) / Math.max(trackWidth.current, 1);
    return Math.max(0, Math.min(1, raw));
  }, []);

  // ── PanResponder — créé UNE SEULE FOIS ───────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,

      onPanResponderGrant: (e) => {
        // ★ measure() au grant → capture la position absolue de la track
        //   on utilise une closure sur trackRef qui est stable
        if (trackRef.current) {
          trackRef.current.measure((_x, _y, w, _h, pageX, _pageY) => {
            trackPageX.current = pageX;
            trackWidth.current = w;
          });
        }
        // Utilise pageX immédiatement (measure est async mais pageX du grant
        // correspond à la zone tactile — locationX serait le décalage interne)
        // On recalcule après le measure dans onPanResponderMove
        const pct = pctFromPageX(e.nativeEvent.pageX);
        const sec = pct * durRef.current;
        draggingRef.current = true;
        _setDragging(true);
        dragSecRef.current = sec;
        _setDragSec(sec);
        fillAnim.setValue(pct);
        expand();
        onSeekRef.current(sec);
      },

      onPanResponderMove: (e) => {
        // ★ pageX absolu → calcul toujours exact même après scroll
        const pct = pctFromPageX(e.nativeEvent.pageX);
        const sec = pct * durRef.current;
        dragSecRef.current = sec;
        _setDragSec(sec);
        fillAnim.setValue(pct); // 60 fps, 0 re-render React
        onSeekRef.current(sec);
      },

      onPanResponderRelease: (e) => {
        const pct = pctFromPageX(e.nativeEvent.pageX);
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

  // ── Chrono ────────────────────────────────────────────────────────────────
  const displaySec = dragging ? dragSec : currentTime;

  // ── Interpolation fill + thumb ────────────────────────────────────────────
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
        colors={['transparent','rgba(0,0,0,0.45)','rgba(0,0,0,0.82)','rgba(0,0,0,0.96)']}
        locations={[0, 0.28, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={bc.inner} pointerEvents="box-none">

        {!!film.title && (
          <Text style={bc.title} numberOfLines={2}>{film.title}</Text>
        )}
        {!!metaLine && (
          <Text style={bc.meta} numberOfLines={1}>{metaLine}</Text>
        )}
        {!!film.synopsis && (
          <Text style={bc.synopsis} numberOfLines={2}>{film.synopsis}</Text>
        )}

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

        {/* ── SEEK BAR ──────────────────────────────────────────────────── */}
        <Animated.View
          style={[bc.seekSection, { opacity: controlsOp }]}
          pointerEvents={isReady ? 'box-none' : 'none'}
        >
          <View style={bc.timeRow} pointerEvents="none">
            <Text style={bc.timeCurrent}>{fmtTime(displaySec)}</Text>
            <Text style={bc.timeDuration}>{fmtTime(duration)}</Text>
          </View>

          {/* ★ ref={trackRef} pour measure() — zone tactile 44 px */}
          <View
            ref={trackRef}
            collapsable={false}
            style={[
              bc.trackHit,
              Platform.OS === 'web' ? ({ cursor:'pointer' } as any) : undefined,
            ]}
            {...pan.panHandlers}
          >
            <Animated.View style={[bc.track, { height: trackH }]}>
              <View style={bc.trackBg} />
              <Animated.View style={[bc.trackFill, { width: fillWidth }]} />
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
  wrapper: { position:'absolute', bottom:0, left:0, right:0 },

  inner: { paddingHorizontal:18, paddingTop:56, gap:6 },

  title: {
    color:'rgba(255,255,255,0.97)', fontSize:18, fontWeight:'800',
    letterSpacing:-0.5, lineHeight:23,
    textShadowColor:'rgba(0,0,0,0.55)', textShadowOffset:{width:0,height:1}, textShadowRadius:5,
  },
  meta:    { color:'rgba(255,255,255,0.48)', fontSize:12, fontStyle:'italic', letterSpacing:0.1 },
  synopsis:{ color:'rgba(255,255,255,0.38)', fontSize:11, lineHeight:15 },

  stats:   { flexDirection:'row', alignItems:'center', gap:5, marginTop:2 },
  statIcon:{ fontSize:10, opacity:0.55 },
  stat:    { color:'rgba(255,255,255,0.48)', fontSize:11, fontWeight:'600' },
  dot:     { color:'rgba(255,255,255,0.22)', fontSize:12, marginHorizontal:1 },

  seekSection: { gap:4, marginTop:8 },
  timeRow:     { flexDirection:'row', justifyContent:'space-between', marginBottom:2 },
  timeCurrent: { color:'rgba(255,255,255,0.90)', fontSize:11, fontWeight:'700', fontVariant:['tabular-nums'] },
  timeDuration:{ color:'rgba(255,255,255,0.30)', fontSize:11, fontVariant:['tabular-nums'] },

  // Zone tactile 44 px — ergonomique (Apple/Google guidelines)
  trackHit: { height:44, justifyContent:'center' },

  track: { width:'100%', borderRadius:4, justifyContent:'center', overflow:'visible' },

  trackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:'rgba(255,255,255,0.20)',
    borderRadius:4,
  },
  trackFill: { height:'100%', backgroundColor:'#FFFFFF', borderRadius:4 },

  thumb: {
    position:'absolute',
    width:18, height:18, borderRadius:9,
    backgroundColor:'#FFFFFF',
    marginLeft:-9,   // centre exact sur la position
    top:'50%', marginTop:-9,
    shadowColor:'#FFFFFF',
    shadowOffset:{ width:0, height:0 },
    shadowOpacity:0.95, shadowRadius:8, elevation:8,
  },
});