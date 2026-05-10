/**
 * BottomCard.tsx
 *
 * Barre bas du reel : titre · méta · synopsis · stats · seek bar draggable
 *
 * DRAG-TO-SEEK :
 *   • PanResponder capte touch sur la zone trackHit (hauteur 36px pour facilité)
 *   • Au grant  → seek immédiat + expand track height + appear thumb
 *   • Au move   → seek temps réel, thumb suit le doigt
 *   • Au release → seek final + collapse
 *
 * FIX :
 *   • bottom: 0 (était 70 → seek bar était coupée / mal positionnée)
 *   • onSeekRef stable → PanResponder ne se re-crée jamais inutilement
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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { FeedFilm } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface BottomCardProps {
  film:     FeedFilm;
  progress: number;    // 0 – 1 (mis à jour à chaque frame)
  duration: number;    // secondes (0 si pas encore connu)
  isReady:  boolean;   // seek bar visible seulement quand true
  insetBot: number;    // safe area bottom (padding iPhone)
  onSeek:   (seconds: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(n || 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// BottomCard
// ─────────────────────────────────────────────────────────────────────────────
const BottomCard = memo(function BottomCard({
  film, progress, duration, isReady, insetBot, onSeek,
}: BottomCardProps) {

  // ── Seek bar state ────────────────────────────────────────────────────────
  const [trackW,   setTrackW]   = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragPct,  setDragPct]  = useState(0);

  // Refs synchrones pour le PanResponder (évite stale closure)
  const trackWRef  = useRef(1);
  const durRef     = useRef(duration);
  const onSeekRef  = useRef(onSeek);
  trackWRef.current = trackW;
  durRef.current    = duration;
  onSeekRef.current = onSeek;

  // ── Animated values ───────────────────────────────────────────────────────
  const thumbScale  = useRef(new Animated.Value(0)).current;
  const trackHeight = useRef(new Animated.Value(3)).current;
  const controlsOp  = useRef(new Animated.Value(0)).current;

  // Pourcentage affiché (drag prend la priorité sur la progression réelle)
  const displayPct = dragging
    ? dragPct
    : Math.min(Math.max(progress, 0), 0.9999);
  const currentSec = displayPct * (duration || 0);

  // ── Expand / collapse track lors du drag ─────────────────────────────────
  const expand = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackHeight, {
        toValue: 6, useNativeDriver: false, tension: 280, friction: 12,
      }),
      Animated.spring(thumbScale, {
        toValue: 1, useNativeDriver: true, tension: 280, friction: 12,
      }),
    ]).start();
  }, [trackHeight, thumbScale]);

  const collapse = useCallback(() => {
    Animated.parallel([
      Animated.spring(trackHeight, {
        toValue: 3, useNativeDriver: false, tension: 280, friction: 12,
      }),
      Animated.spring(thumbScale, {
        toValue: 0, useNativeDriver: true, tension: 280, friction: 12,
      }),
    ]).start();
  }, [trackHeight, thumbScale]);

  const pctFromX = (lx: number) =>
    Math.max(0, Math.min(1, lx / Math.max(trackWRef.current, 1)));

  // ── PanResponder — créé UNE seule fois (refs stables) ────────────────────
  const pan = useRef(
    PanResponder.create({
      // Capturer le touch même si un ScrollView parent veut le prendre
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,

      onPanResponderGrant: (e) => {
        const pct = pctFromX(e.nativeEvent.locationX);
        setDragPct(pct);
        setDragging(true);
        expand();
        // Seek immédiat dès que le doigt touche
        onSeekRef.current(pct * durRef.current);
      },

      onPanResponderMove: (e) => {
        const pct = pctFromX(e.nativeEvent.locationX);
        setDragPct(pct);
        // Seek temps réel pendant le glissement
        onSeekRef.current(pct * durRef.current);
      },

      onPanResponderRelease: (e) => {
        const pct = pctFromX(e.nativeEvent.locationX);
        onSeekRef.current(pct * durRef.current);
        setDragging(false);
        collapse();
      },

      onPanResponderTerminate: () => {
        setDragging(false);
        collapse();
      },
    }),
  ).current;

  // ── Fade-in des contrôles quand isReady ──────────────────────────────────
  useEffect(() => {
    Animated.timing(controlsOp, {
      toValue:  isReady ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [isReady, controlsOp]);

  // Ligne de méta : réalisateur · année · genre
  const metaLine = [film.director, film.year, film.genre]
    .filter(Boolean)
    .join('  ·  ');

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View
      style={[bc.wrapper, { paddingBottom: insetBot + 16 }]}
      pointerEvents="box-none"
    >
      {/* Gradient de lisibilité */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.52)', 'rgba(0,0,0,0.90)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={bc.inner} pointerEvents="box-none">

        {/* Titre */}
        {!!film.title && (
          <Text style={bc.title} numberOfLines={2}>{film.title}</Text>
        )}

        {/* Réalisateur · Année · Genre */}
        {!!metaLine && (
          <Text style={bc.meta} numberOfLines={1}>{metaLine}</Text>
        )}

        {/* Synopsis */}
        {!!film.synopsis && (
          <Text style={bc.synopsis} numberOfLines={2}>{film.synopsis}</Text>
        )}

        {/* Stats : vues · likes · durée */}
        <View style={bc.stats} pointerEvents="none">
          {film.views_count > 0 && (
            <Text style={bc.stat}>👁 {fmtCount(film.views_count)}</Text>
          )}
          {film.views_count > 0 && film.likes_count > 0 && (
            <Text style={bc.dot}>·</Text>
          )}
          {film.likes_count > 0 && (
            <Text style={bc.stat}>♥ {fmtCount(film.likes_count)}</Text>
          )}
          {film.duration > 0 && (
            <>
              <Text style={bc.dot}>·</Text>
              <Text style={bc.stat}>⏱ {fmtTime(film.duration)}</Text>
            </>
          )}
        </View>

        {/* ── SEEK BAR + CHRONO ─────────────────────────────────────────── */}
        <Animated.View
          style={[bc.seekSection, { opacity: controlsOp }]}
          pointerEvents={isReady ? 'box-none' : 'none'}
        >
          {/* Chrono */}
          <View style={bc.timeRow} pointerEvents="none">
            <Text style={bc.timeCurrent}>{fmtTime(currentSec)}</Text>
            <Text style={bc.timeDuration}>{fmtTime(duration)}</Text>
          </View>

          {/* Zone tactile — plus haute que la track pour faciliter le drag */}
          <View
            style={bc.trackHit}
            onLayout={e => {
              const w = e.nativeEvent.layout.width;
              setTrackW(w);
              trackWRef.current = w;
            }}
            {...pan.panHandlers}
          >
            {/* Track animée */}
            <Animated.View style={[bc.track, { height: trackHeight }]}>

              {/* Background track */}
              <View style={bc.trackBg} />

              {/* Fill (progress) */}
              <View
                style={[bc.trackFill, { width: `${displayPct * 100}%` as any }]}
              />

              {/* Thumb (apparaît au drag) */}
              <Animated.View
                style={[
                  bc.thumb,
                  {
                    left:      `${displayPct * 100}%` as any,
                    transform: [{ scale: thumbScale }],
                  },
                ]}
              />
            </Animated.View>
          </View>
        </Animated.View>

      </View>
    </View>
  );
});

export default BottomCard;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const bc = StyleSheet.create({
  // ★ FIX bottom:70 → bottom:0 (la seek bar était coupée)
  wrapper: {
    position: 'absolute',
    bottom:    60,
    left:      0,
    right:     0,
  },

  inner: {
    paddingHorizontal: 20,
    paddingTop:        48,   // espace pour le gradient
  },

  // Texte
  title: {
    color:         'rgba(255,255,255,0.96)',
    fontSize:       17,
    fontWeight:    '800',
    letterSpacing: -0.4,
    lineHeight:     22,
    marginBottom:   4,
    textShadowColor:  'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius:  4,
  },
  meta: {
    color:        'rgba(255,255,255,0.46)',
    fontSize:      12,
    fontStyle:    'italic',
    marginBottom:  4,
  },
  synopsis: {
    color:        'rgba(255,255,255,0.36)',
    fontSize:      11,
    lineHeight:    15,
    marginBottom:  8,
  },

  // Stats
  stats: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            6,
    marginBottom:   12,
  },
  stat: {
    color:      'rgba(255,255,255,0.45)',
    fontSize:    11,
    fontWeight: '600',
  },
  dot: {
    color:    'rgba(255,255,255,0.22)',
    fontSize:  11,
  },

  // Seek bar
  seekSection: {
    gap:          3,
    paddingBottom: 2,
  },
  timeRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:    3,
  },
  timeCurrent: {
    color:      'rgba(255,255,255,0.88)',
    fontSize:    11,
    fontWeight: '700',
    // Pour éviter le saut de layout au changement de chiffre
    fontVariant: ['tabular-nums'],
  },
  timeDuration: {
    color:       'rgba(255,255,255,0.32)',
    fontSize:     11,
    fontVariant: ['tabular-nums'],
  },

  // Zone tactile (hauteur volontairement grande pour facilité du drag)
  trackHit: {
    height:          36,
    justifyContent: 'center',
  },

  // Track elle-même (hauteur animée)
  track: {
    width:        '100%',
    borderRadius:  4,
    justifyContent:'center',
    overflow:     'visible',
  },

  trackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius:     4,
  },

  trackFill: {
    height:          '100%',
    backgroundColor: '#FFFFFF',
    borderRadius:     4,
  },

  thumb: {
    position:        'absolute',
    width:            16,
    height:           16,
    borderRadius:      8,
    backgroundColor: '#FFFFFF',
    marginLeft:       -8,
    top:             '50%',
    marginTop:        -8,
    // Glow blanc pour le rendre visible
    shadowColor:     '#FFFFFF',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:    0.80,
    shadowRadius:      6,
    elevation:         6,
  },
});