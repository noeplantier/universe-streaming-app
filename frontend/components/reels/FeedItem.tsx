/**
 * FeedItem.tsx
 * - Zéro poster
 * - VideoView natif rendu quand isNear
 * - Une seule logique play/pause
 * - Fond noir pendant chargement / erreur
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import BottomCard from './BottomCard';
import { P } from './types';
import type { FeedFilm } from './types';

let _useVideoPlayer: (src: any, setup?: any) => any = () => ({
  play() {},
  pause() {},
  seekBy() {},
  replace() {},
  addListener() {
    return { remove() {} };
  },
  get duration() {
    return 0;
  },
  get status() {
    return 'idle';
  },
  muted: false,
});
let _VideoView: any = () => null;

let _useEvent: any = (_p: any, _e: string, d: any) => d;

if (Platform.OS !== 'web') {
  try {
    const ev = require('expo-video');
    _useVideoPlayer = ev.useVideoPlayer;
    _VideoView = ev.VideoView;

    // expo-video expose souvent useEvent ; sinon fallback vers expo
    _useEvent = ev.useEvent ?? require('expo').useEvent;
  } catch {
    try {
      _useEvent = require('expo').useEvent;
    } catch {}
  }
}

export interface FeedItemProps {
  film: FeedFilm;
  isActive: boolean;
  isNear: boolean;
  screenFocused: boolean;
  itemW: number;
  itemH: number;
  insetBot: number;
  onLike?: (id: string) => void;
  onInfoPress?: (f: FeedFilm) => void;
}

const Spinner = memo(function Spinner() {
  const rot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 900, useNativeDriver: true })
    );
    a.start();
    return () => a.stop();
  }, [rot]);

  return (
    <Animated.View
      style={[
        s.spinner,
        {
          transform: [
            {
              rotate: rot.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    />
  );
});

const FeedItem = memo(function FeedItem({
  film,
  isActive,
  isNear,
  screenFocused,
  itemW,
  itemH,
  insetBot,
  onLike,
  onInfoPress,
}: FeedItemProps) {
  const isWeb = Platform.OS === 'web';

  const src = useMemo(() => {
    const u = film?.video_url?.trim();
    return u ? u : null;
  }, [film?.video_url]);

  // Rendu : la source n’est donnée que si on est proche + pas web.
  // On évite que le player crée un flux inutile.
  const source = useMemo(() => {
    if (isWeb) return null;
    if (!isNear) return null;
    if (!src) return null;
    return { uri: src };
  }, [isWeb, isNear, src]);

  const player = _useVideoPlayer(source, (p: any) => {
    if (!p || isWeb) return;
    p.loop = false;
    p.muted = false;

    // buffer tuning (si supporté)
    try {
      p.bufferOptions = {
        preferredForwardBufferDuration: 12,
        preferredBackwardBufferDuration: 0,
      };
    } catch {}
  });

  // --- Etat UI
  const [liked, setLiked] = useState(!!film.is_liked);
  const [muted, setMuted] = useState(false);
  const [saved, setSaved] = useState(!!film.is_saved);

  const [buffering, setBuffering] = useState(false);
  const [hasErr, setHasErr] = useState(false);

  // --- Time/progress (si disponible)
  const currentTime = _useEvent(player, 'timeUpdate', {
    currentTime: 0,
  })?.currentTime ?? 0;

  const dur = !isWeb && player?.duration ? player.duration : 0;
  const progress = dur > 0 ? Math.min(currentTime / dur, 1) : 0;

  // --- Listener status (loading/error/ready)
  useEffect(() => {
    if (isWeb || !player?.addListener) return;

    const sub = player.addListener('statusChange', (ev: any) => {
      const st =
        typeof ev?.status === 'string'
          ? ev.status
          : ev?.status?.status ?? '';

      if (st === 'loading') {
        setBuffering(true);
      }
      if (st === 'readyToPlay') {
        setBuffering(false);
        setHasErr(false);
      }
      if (st === 'error') {
        setHasErr(true);
        setBuffering(false);
      }
      if (st === 'idle') {
        setBuffering(false);
      }
    });

    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, [player, isWeb]);

  // --- Reset quand le film change
  useEffect(() => {
    setHasErr(false);
    setBuffering(false);
  }, [film.id]);

  // --- Mute
  useEffect(() => {
    if (isWeb || !player) return;
    try {
      player.muted = muted;
    } catch {}
  }, [muted, player, isWeb]);

  // --- PLAY / PAUSE : UN seul effet (pas de concurrence)
  useEffect(() => {
    if (isWeb || !player) return;

    const ready = !!src && !!isNear && !hasErr;
    const shouldPlay = isActive && screenFocused && ready;

    if (shouldPlay) {
      try {
        player.play();
      } catch {}
    } else {
      try {
        player.pause();
      } catch {}

      // reset léger (évite les “reels qui restent figés”)
      try {
        // seekBy(-Infinity-like) non; on remet au début si possible
        player.seekBy?.(0);
      } catch {}
    }
  }, [isWeb, player, isActive, screenFocused, isNear, src, hasErr]);

  // --- Progress/finish : on boucle par “playToEnd” seulement si dispo
  const isPlaybackEnded = _useEvent(player, 'playToEnd', { isPlaybackEnded: false })
    ?.isPlaybackEnded;

  const endHandledRef = useRef(false);
  useEffect(() => {
    if (isWeb) return;
    if (!isPlaybackEnded) {
      endHandledRef.current = false;
      return;
    }
    if (endHandledRef.current) return;
    endHandledRef.current = true;
    try {
      player.seekBy?.(0);
    } catch {}
  }, [isPlaybackEnded, isWeb, player]);

  const handleSeek = useCallback(
    (sec: number) => {
      if (isWeb) return;
      try {
        player.seekBy?.(sec);
      } catch {}
    },
    [isWeb, player]
  );

  const handlePlayPause = useCallback(() => {
    if (isWeb || !player) return;
    try {
      // On ne dépend pas de isPlaying (event parfois fragile).
      // Donc on bascule selon le status interne si disponible.
      const st = player?.status;
      if (st === 'playing') player.pause();
      else player.play();
    } catch {}
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [isWeb, player]);

  // Cœur animé (optionnel, conservé)
  const heartOp = useRef(new Animated.Value(0)).current;
  const heartScale = heartOp.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1.3, 1] });
  const heartAlpha = heartOp.interpolate({
    inputRange: [0, 0.1, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });

  const doLike = useCallback(() => {
    setLiked((p) => {
      const next = !p;
      if (next) onLike?.(film.id);
      return next;
    });
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    Animated.sequence([
      Animated.spring(heartOp, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }),
      Animated.delay(500),
      Animated.timing(heartOp, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [film.id, isWeb, onLike, heartOp]);

  const zW = itemW / 3;

  return (
    <View style={[{ width: itemW, height: itemH }]}>
      {/* Fond noir : toujours présent => pas de poster */}
      <View style={StyleSheet.absoluteFill} />

      {/* VideoView natif : uniquement quand proche et pas web.
          Toujours rendu “proche” => améliore la stabilité. */}
      {!isWeb && isNear && !!src && !hasErr && (
        <_VideoView
          player={player}
          style={[StyleSheet.absoluteFill, { width: itemW, height: itemH }]}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      )}

      {/* Gradient bas (lisibilité) */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.90)']}
        locations={[0.35, 0.7, 1]}
        style={s.grad}
        pointerEvents="none"
      />

      {/* Loading spinner */}
      {isActive && buffering && !hasErr && !!src && (
        <View style={s.center} pointerEvents="none">
          <Spinner />
        </View>
      )}

      {/* Erreur */}
      {hasErr && (
        <View style={s.errBox}>
          <Ionicons name="warning-outline" size={34} color={P.hot} />
          <Text style={s.errTxt}>Vidéo indisponible</Text>

          <TouchableOpacity
            style={s.retryBtn}
            activeOpacity={0.85}
            onPress={() => {
              setHasErr(false);
              setBuffering(false);
              // Le useEffect play/pause relancera quand ça redevient ready
            }}
          >
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={s.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Indicateur pause (simple sans dépendre de isPlaying) */}
      {isNear && !!src && !hasErr && !buffering && isActive && !screenFocused && (
        <View style={s.center} pointerEvents="none">
          <BlurView intensity={22} tint="dark" style={s.pauseCircle}>
            <Ionicons name="play" size={26} color="rgba(255,255,255,0.92)" style={{ marginLeft: 3 }} />
          </BlurView>
        </View>
      )}

      {/* Cœur */}
      <Animated.View
        style={[s.heart, { opacity: heartAlpha, transform: [{ scale: heartScale }] }]}
        pointerEvents="none"
      >
        <Ionicons name="heart" size={90} color={P.red} />
      </Animated.View>

      {/* Sidebar droite */}
      <View style={s.sidebar} pointerEvents="box-none">
        <TouchableOpacity style={s.sideBtn} onPress={doLike}>
          <View style={[s.sideIcon, liked && s.sideIconActive]}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? P.red : '#fff'} />
          </View>
          <Text style={s.sideLbl}>{fmtN(film.likes_count)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.sideBtn} onPress={() => setMuted((p) => !p)}>
          <View style={[s.sideIcon, muted && s.sideIconActive]}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={23} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.sideBtn} onPress={() => setSaved((p) => !p)}>
          <View style={[s.sideIcon, saved && s.sideIconActive]}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={23}
              color={saved ? P.gold : '#fff'}
            />
          </View>
        </TouchableOpacity>

        {onInfoPress && (
          <TouchableOpacity style={s.sideBtn} onPress={() => onInfoPress(film)}>
            <View style={s.sideIcon}>
              <Ionicons name="information-circle-outline" size={24} color="rgba(255,255,255,0.75)" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* BottomCard (seek/progress) */}
      <BottomCard
        film={film}
        progress={progress}
        duration={dur}
        isReady={!buffering && !hasErr && !!src}
        insetBot={insetBot}
        onSeek={handleSeek}
      />

      {/* Click play/pause (optionnel) */}
      {/* Si tu veux : décommente, sinon ignore */}
      {/* <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handlePlayPause} /> */}
    </View>
  );
});

export default FeedItem;

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n || 0);
}

const s = StyleSheet.create({
  grad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  spinner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.88)',
    borderRightColor: 'rgba(255,255,255,0.22)',
  },
  errBox: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    gap: 14,
  },
  errTxt: { color: 'rgba(255,255,255,0.60)', fontSize: 14 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: P.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pauseCircle: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  heart: { position: 'absolute', top: '50%', left: '50%', marginTop: -45, marginLeft: -45, zIndex: 20 },
  sidebar: { position: 'absolute', right: 14, bottom: 160, alignItems: 'center', gap: 20, zIndex: 15 },
  sideBtn: { alignItems: 'center', gap: 4 },
  sideIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sideIconActive: { backgroundColor: 'rgba(146,64,214,0.32)', borderColor: 'rgba(146,64,214,0.55)' },
  sideLbl: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '700' },
});