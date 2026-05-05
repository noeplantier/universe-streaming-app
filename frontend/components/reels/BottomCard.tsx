import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, PanResponder, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { supabase }       from '@/lib/supabase';

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
  reelId:      string | number;
  progress:    number;      // 0–1
  duration:    number;      // secondes
  isPlaying:   boolean;
  isReady:     boolean;     // contrôles visibles seulement quand prêt
  insetBot:    number;      // safe-area
  onSeek:      (seconds: number) => void;
  onPlayPause: () => void;
  onSkip:      (delta: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE Supabase — évite les re-fetch
// ─────────────────────────────────────────────────────────────────────────────
const metaCache = new Map<string | number, ReelMeta>();

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────
function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h }: { w: number | `${number}%`; h: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.65, duration: 750, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.3,  duration: 750, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View style={{
      width: w as any, height: h, borderRadius: 5,
      backgroundColor: 'rgba(255,255,255,0.13)', opacity: anim, marginBottom: 6,
    }} />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM CARD
// ─────────────────────────────────────────────────────────────────────────────
const BottomCard = memo(function BottomCard({
  reelId, progress, duration, isPlaying, isReady, insetBot,
  onSeek, onPlayPause, onSkip,
}: BottomCardProps) {

  // ── Métadonnées ───────────────────────────────────────────────────────────
  const [meta,    setMeta]    = useState<ReelMeta | null>(metaCache.get(reelId) ?? null);
  const [loading, setLoading] = useState(!metaCache.has(reelId));

  useEffect(() => {
    if (metaCache.has(reelId)) {
      setMeta(metaCache.get(reelId)!);
      setLoading(false);
      return;
    }
    setMeta(null); setLoading(true);
    const ctrl = new AbortController();
    Promise.resolve(
      supabase
        .from('reels')
        .select('title, director, year, genre, duration, views_count, likes_count')
        .eq('id', reelId)
        .abortSignal(ctrl.signal)
        .single()
        .then(({ data, error }) => {
          if (ctrl.signal.aborted || error || !data) { setLoading(false); return; }
          metaCache.set(reelId, data as ReelMeta);
          setMeta(data as ReelMeta); setLoading(false);
        })
    ).catch(() => setLoading(false));
    return () => ctrl.abort();
  }, [reelId]);

  const metaLine = useMemo(() => [
    meta?.director,
    meta?.year ? String(meta.year) : undefined,
    meta?.genre,
  ].filter(Boolean).join('  ·  '), [meta]);

  // ── Seek bar state ────────────────────────────────────────────────────────
  const [trackW,     setTrackW]     = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPct,    setDragPct]    = useState(0);

  const trackWRef  = useRef(1);
  const durRef     = useRef(duration);
  trackWRef.current = trackW;
  durRef.current    = duration;

  // Animated values pour thumb + track height
  const thumbSc = useRef(new Animated.Value(0)).current;
  const trackH  = useRef(new Animated.Value(3)).current;

  const displayPct = isDragging ? dragPct : Math.min(progress, 0.9999);
  const currentSec = displayPct * duration;

  const expand = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackH,  { toValue: 5, useNativeDriver: false, tension: 300, friction: 15 }),
      Animated.spring(thumbSc, { toValue: 1, useNativeDriver: true,  tension: 300, friction: 15 }),
    ]).start();
  }, [trackH, thumbSc]);

  const collapse = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackH,  { toValue: 3, useNativeDriver: false, tension: 300, friction: 15 }),
      Animated.spring(thumbSc, { toValue: 0, useNativeDriver: true,  tension: 300, friction: 15 }),
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

  // ── Visibilité contrôles ──────────────────────────────────────────────────
  const ctrlOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(ctrlOpacity, {
      toValue:  isReady ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isReady, ctrlOpacity]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.wrapper, { paddingBottom: insetBot + 12 }]} pointerEvents="box-none">

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.inner} pointerEvents="box-none">

        {/* ── Metadata ───────────────────────────────────────────────── */}
        {loading ? (
          <View style={{ marginBottom: 10 }}>
            <Shimmer w="55%" h={14} />
            <Shimmer w="38%" h={10} />
          </View>
        ) : meta ? (
          <View style={s.metaBlock} pointerEvents="none">
            <Text style={s.title} numberOfLines={1}>{meta.title}</Text>
            {!!metaLine && <Text style={s.metaLine} numberOfLines={1}>{metaLine}</Text>}
            <View style={s.statsRow}>
              <Text style={s.stat}>👁 {fmtNum(meta.views_count)}</Text>
              <Text style={s.statDot}>·</Text>
              <Text style={s.stat}>♥ {fmtNum(meta.likes_count)}</Text>
            </View>
          </View>
        ) : null}

        {/* ── Contrôles (visibles quand isReady) ─────────────────────── */}
        <Animated.View style={[s.controls, { opacity: ctrlOpacity }]} pointerEvents={isReady ? 'box-none' : 'none'}>

          {/* ROW 1 — Chrono + Seek bar + Durée */}
          <View style={s.seekRow}>
            <Text style={s.timeCurr}>{fmt(currentSec)}</Text>

            <View
              style={s.trackHit}
              onLayout={e => { setTrackW(e.nativeEvent.layout.width); trackWRef.current = e.nativeEvent.layout.width; }}
              {...pan.panHandlers}
            >
              <Animated.View style={[s.track, { height: trackH }]}>
                <View style={s.trackBg} />
                <View style={[s.trackFill, { width: `${displayPct * 100}%` as any }]} />
                <Animated.View style={[s.thumb, {
                  left:      `${displayPct * 100}%` as any,
                  transform: [{ scale: thumbSc }],
                }]} />
              </Animated.View>
            </View>

            <Text style={s.timeTotal}>{fmt(duration)}</Text>
          </View>

          {/* ROW 2 — ◀5 | play/pause | 5▶ */}
          <View style={s.btnRow} pointerEvents="box-none">

            {/* ◀ 5s */}
            <TouchableOpacity
              style={s.skipBtn}
              onPress={() => onSkip(-5)}
              activeOpacity={0.6}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 8 }}
            >
              <Ionicons name="play-back" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={s.skipLabel}>5</Text>
            </TouchableOpacity>

            {/* play / pause */}
            <TouchableOpacity
              style={s.playBtn}
              onPress={onPlayPause}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#fff"
                style={!isPlaying ? { marginLeft: 2 } : undefined}
              />
            </TouchableOpacity>

            {/* 5s ▶ */}
            <TouchableOpacity
              style={s.skipBtn}
              onPress={() => onSkip(5)}
              activeOpacity={0.6}
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 14 }}
            >
              <Text style={s.skipLabel}>5</Text>
              <Ionicons name="play-forward" size={16} color="rgba(255,255,255,0.75)" />
            </TouchableOpacity>

          </View>
        </Animated.View>

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
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  inner: {
    paddingHorizontal: 20,
    paddingTop:        40,     // espace pour le dégradé
  },

  // Metadata
  metaBlock:  { marginBottom: 14 },
  title:      { color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
  metaLine:   { color: 'rgba(255,255,255,0.42)', fontSize: 11, fontWeight: '500', marginBottom: 5 },
  statsRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stat:       { color: 'rgba(255,255,255,0.38)', fontSize: 11 },
  statDot:    { color: 'rgba(255,255,255,0.20)', fontSize: 11 },

  // Controls container
  controls:   { gap: 10 },

  // Seek row
  seekRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeCurr:   { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700', width: 34, textAlign: 'right' },
  timeTotal:  { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '500', width: 34 },
  trackHit:   { flex: 1, height: 28, justifyContent: 'center' },  // zone de hit large

  track:      { width: '100%', borderRadius: 3, overflow: 'visible', justifyContent: 'center' },
  trackBg:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 3 },
  trackFill:  { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 3 },
  thumb: {
    position:      'absolute',
    width:          14, height: 14, borderRadius: 7,
    backgroundColor: '#FFFFFF',
    marginLeft:    -7,
    top:           '50%', marginTop: -7,
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 5,
  },

  // Button row
  btnRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, paddingBottom: 6 },
  skipBtn:   { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6 },
  skipLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  playBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
  },
});