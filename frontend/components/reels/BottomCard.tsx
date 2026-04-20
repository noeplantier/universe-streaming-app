import React, { memo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, Animated, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 HELPERS
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

// ─────────────────────────────────────────────────────────────────────────────
// 📦 TYPES
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

// ─────────────────────────────────────────────────────────────────────────────
// 📊 VIDEO PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────
interface VideoProgressBarProps {
  progress: Animated.Value | number;
}

const VideoProgressBar = memo(({ progress }: VideoProgressBarProps) => {
  const isAnimated = progress && typeof (progress as any).interpolate === 'function';

  const width = isAnimated
    ? (progress as Animated.Value).interpolate({
        inputRange:  [0, 1],
        outputRange: ['0%', '100%'],
        extrapolate: 'clamp',
      })
    : `${Math.min(Math.max(Number(progress) || 0, 0), 1) * 100}%`;

  return (
    <View style={pb.track} pointerEvents="none">
      <Animated.View style={[pb.fill, { width: width as any }]} />
      <Animated.View style={[pb.thumb, { left: width as any }]} />
    </View>
  );
});
VideoProgressBar.displayName = 'VideoProgressBar';

const pb = StyleSheet.create({
  track: {
    height:          3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    width:           '100%',
    position:        'relative',
    borderRadius:     2,
    marginTop:       12,
  },
  fill: {
    height:          '100%',
    backgroundColor: '#FFFFFF',
    position:        'absolute',
    left:             0,
    top:              0,
    borderRadius:     2,
  },
  thumb: {
    position:        'absolute',
    top:             -2,
    marginLeft:      -3.5,
    width:            7,
    height:           7,
    borderRadius:     3.5,
    backgroundColor: '#FFFFFF',
    shadowColor:     '#FFF',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    6,
    elevation:        4,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 BOTTOM CARD
// ─────────────────────────────────────────────────────────────────────────────
export interface BottomCardProps {
  /** ID du reel Supabase en cours de lecture */
  reelId:   string | number;
  progress: Animated.Value | number;
}

const BottomCard = memo(({ reelId, progress }: BottomCardProps) => {
  const [meta, setMeta] = useState<ReelMeta | null>(null);

  // ── Fetch minimal depuis Supabase ──────────────────────────────────────────
  const fetchMeta = useCallback(async () => {
    if (!reelId) return;
    try {
      const { data, error } = await supabase
        .from('reels')                          // adapte si ta table s'appelle autrement
        .select('title, director, year, genre, duration, views_count, likes_count')
        .eq('id', reelId)
        .single();

      if (error || !data) return;
      setMeta(data as ReelMeta);
    } catch {
      // silently ignore — la carte reste vide plutôt que de crasher
    }
  }, [reelId]);

  useEffect(() => {
    setMeta(null);   // reset entre deux reels
    fetchMeta();
  }, [fetchMeta]);

  // ── Méta ligne discrète ───────────────────────────────────────────────────
  const metaParts = [
    meta?.director,
    meta?.year ? String(meta.year) : undefined,
    meta?.genre,
    meta?.duration ? formatDuration(meta.duration) : undefined,
  ].filter(Boolean).join('  ·  ');

  return (
    <View style={s.wrapper} pointerEvents="box-none">
      {/* Dégradé bas de page pour la lisibilité */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.inner}>
        {/* Titre */}
        {!!meta?.title && (
          <Text style={s.title} numberOfLines={1}>{meta.title}</Text>
        )}

        {/* Métadonnées en ligne */}
        {!!metaParts && (
          <Text style={s.meta} numberOfLines={1}>{metaParts}</Text>
        )}

        {/* Stats minimalistes */}
        {!!meta && (
          <View style={s.stats}>
            <Text style={s.stat}>👁 {formatViews(meta.views_count)}</Text>
            <Text style={s.dot}>·</Text>
            <Text style={s.stat}>♥ {formatLikes(meta.likes_count)}</Text>
          </View>
        )}

        {/* Barre de progression */}
        <VideoProgressBar progress={progress} />
      </View>
    </View>
  );
});
BottomCard.displayName = 'BottomCard';
export default BottomCard;

// ─────────────────────────────────────────────────────────────────────────────
// 💅 STYLES
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
    color:       'rgba(255,255,255,0.45)',
    fontSize:     11,
    fontWeight:  '500',
    letterSpacing: 0.2,
    marginBottom:  6,
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