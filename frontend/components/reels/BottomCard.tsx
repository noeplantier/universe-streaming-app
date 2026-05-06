import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Animated, PanResponder, StyleSheet, Text, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface BottomCardProps {
  reelId:     string;
  title?:     string | null;
  director?:  string | null;
  genre?:     string | null;
  year?:      string | null;
  likesCount: number;
  viewsCount: number;
  progress:   number;    // 0–1
  duration:   number;    // secondes
  isReady:    boolean;
  insetBot:   number;
  onSeek:     (seconds: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};
const fmtN = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${Math.round(n / 1_000)}K`
  : String(n);

// ─────────────────────────────────────────────────────────────────────────────
// BottomCard
// ─────────────────────────────────────────────────────────────────────────────
const BottomCard = memo(function BottomCard({
  title, director, genre, year,
  likesCount, viewsCount,
  progress, duration, isReady, insetBot, onSeek,
}: BottomCardProps) {

  // ── Seek bar ───────────────────────────────────────────────────────────────
  const [trackW,     setTrackW]     = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPct,    setDragPct]    = useState(0);

  const trackWRef = useRef(1);
  const durRef    = useRef(duration);
  trackWRef.current = trackW;
  durRef.current    = duration;

  const thumbSc = useRef(new Animated.Value(0)).current;
  const trackH  = useRef(new Animated.Value(2)).current;

  const displayPct = isDragging ? dragPct : Math.min(progress, 0.9999);
  const currentSec = displayPct * (duration || 0);

  const expand = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackH,  { toValue: 4, useNativeDriver: false, tension: 250, friction: 14 }),
      Animated.spring(thumbSc, { toValue: 1, useNativeDriver: true,  tension: 250, friction: 14 }),
    ]).start();
  }, [trackH, thumbSc]);

  const collapse = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackH,  { toValue: 2, useNativeDriver: false, tension: 250, friction: 14 }),
      Animated.spring(thumbSc, { toValue: 0, useNativeDriver: true,  tension: 250, friction: 14 }),
    ]).start();
  }, [trackH, thumbSc]);

  const clamp = (lx: number) =>
    Math.max(0, Math.min(1, lx / Math.max(trackWRef.current, 1)));

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder:         () => true,
    onMoveShouldSetPanResponderCapture:  () => true,
    onPanResponderGrant: (e) => {
      const p = clamp(e.nativeEvent.locationX);
      setDragPct(p); setIsDragging(true); expand();
      onSeek(p * durRef.current);
    },
    onPanResponderMove: (e) => {
      const p = clamp(e.nativeEvent.locationX);
      setDragPct(p); onSeek(p * durRef.current);
    },
    onPanResponderRelease: (e) => {
      onSeek(clamp(e.nativeEvent.locationX) * durRef.current);
      setIsDragging(false); collapse();
    },
    onPanResponderTerminate: () => { setIsDragging(false); collapse(); },
  })).current;

  // Fade-in contrôles quand isReady
  const ctrlOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(ctrlOpacity, {
      toValue: isReady ? 1 : 0, duration: 300, useNativeDriver: true,
    }).start();
  }, [isReady, ctrlOpacity]);

  // Ligne de méta (director · year · genre)
  const metaLine = [director, year, genre].filter(Boolean).join(' · ');

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={[bc.wrapper, { paddingBottom: insetBot + 16 }]} pointerEvents="box-none">
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.78)']}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={bc.inner} pointerEvents="box-none">

        {/* Titre + méta */}
        {(title || metaLine) && (
          <View style={bc.meta} pointerEvents="none">
            {!!title     && <Text style={bc.title}    numberOfLines={1}>{title}</Text>}
            {!!metaLine  && <Text style={bc.metaLine} numberOfLines={1}>{metaLine}</Text>}
            <View style={bc.statsRow}>
              {!!viewsCount && <Text style={bc.stat}>👁 {fmtN(viewsCount)}</Text>}
              {!!viewsCount && !!likesCount && <Text style={bc.dot}>·</Text>}
              {!!likesCount && <Text style={bc.stat}>♥ {fmtN(likesCount)}</Text>}
            </View>
          </View>
        )}

        {/* Seek bar + chrono */}
        <Animated.View
          style={[bc.seekWrap, { opacity: ctrlOpacity }]}
          pointerEvents={isReady ? 'box-none' : 'none'}
        >
          {/* Chrono */}
          <View style={bc.timeRow} pointerEvents="none">
            <Text style={bc.timeCurr}>{fmt(currentSec)}</Text>
            <Text style={bc.timeTot}>{fmt(duration)}</Text>
          </View>

          {/* Track */}
          <View
            style={bc.trackHit}
            onLayout={e => {
              setTrackW(e.nativeEvent.layout.width);
              trackWRef.current = e.nativeEvent.layout.width;
            }}
            {...pan.panHandlers}
          >
            <Animated.View style={[bc.track, { height: trackH }]}>
              <View style={bc.trackBg} />
              <View style={[bc.trackFill, { width: `${displayPct * 100}%` as any }]} />
              <Animated.View style={[bc.thumb, {
                left: `${displayPct * 100}%` as any,
                transform: [{ scale: thumbSc }],
              }]} />
            </Animated.View>
          </View>
        </Animated.View>

      </View>
    </View>
  );
});

export default BottomCard;

const bc = StyleSheet.create({
  wrapper:  { position: 'absolute', bottom: 0, left: 0, right: 0 },
  inner:    { paddingHorizontal: 18, paddingTop: 52 },

  meta:     { marginBottom: 14 },
  title:    { color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: '700',
              letterSpacing: -0.2, marginBottom: 3 },
  metaLine: { color: 'rgba(255,255,255,0.40)', fontSize: 11, marginBottom: 5 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stat:     { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  dot:      { color: 'rgba(255,255,255,0.18)', fontSize: 11 },

  seekWrap:  { gap: 4, paddingBottom: 2 },
  timeRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
  timeCurr:  { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '700' },
  timeTot:   { color: 'rgba(255,255,255,0.35)', fontSize: 11 },

  trackHit: { height: 28, justifyContent: 'center' },
  track:    { width: '100%', borderRadius: 3, justifyContent: 'center', overflow: 'visible' },
  trackBg:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3 },
  trackFill:{ height: '100%', backgroundColor: '#FFFFFF', borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: '#FFFFFF', marginLeft: -6.5, top: '50%', marginTop: -6.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35, shadowRadius: 3, elevation: 4,
  },
});