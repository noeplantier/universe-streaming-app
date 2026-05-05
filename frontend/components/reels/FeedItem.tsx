import React, {
  memo, useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Image, StyleSheet, TouchableWithoutFeedback,
  Animated, Platform, TouchableOpacity, Text,
} from 'react-native';
import { BlurView }  from 'expo-blur';
import { Ionicons }  from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics  from 'expo-haptics';

import RightBar   from './RightBar';
import BottomCard from './BottomCard';
import { P }      from './types';
import type { FeedFilm } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// expo-video — chargement conditionnel (natif uniquement)
// ─────────────────────────────────────────────────────────────────────────────
let _useVideoPlayer: any = () => ({
  play(){}, pause(){}, seekBy(){}, replace(){},
  addListener(){ return { remove(){} }; },
  duration: 0, currentTime: 0, muted: false, status: 'idle', playing: false,
});
let _useEvent:  any = (_p: any, _e: string, def: any) => def;
let _VideoView: any = () => null;

if (Platform.OS !== 'web') {
  try {
    const ev        = require('expo-video');
    _useVideoPlayer = ev.useVideoPlayer;
    _VideoView      = ev.VideoView;
    _useEvent       = require('expo').useEvent;
  } catch (e) {
    console.warn('[FeedItem] expo-video non disponible :', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface FeedItemProps {
  film:            FeedFilm;
  isActive:        boolean;
  isNear:          boolean;
  screenFocused?:  boolean;
  itemW:           number;
  itemH:           number;
  insetBot:        number;
  onFollowFriend:  (fid: string) => void;
  onLike?:         (id: string) => void;
  onInfoPress?:    (film: FeedFilm) => void;
  onProgress?:     (p: { positionMs: number; durationMs: number }) => void;
  onEnd?:          () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB VIDEO PLAYER
// ─────────────────────────────────────────────────────────────────────────────
interface WebVideoProps {
  src:             string;
  muted:           boolean;
  isActive:        boolean;
  itemW:           number;
  itemH:           number;
  onProgress:      (pct: number) => void;
  onTimeUpdate?:   (posMs: number, durMs: number) => void;
  onReady:         () => void;
  onError:         () => void;
  onEnd:           () => void;
  onPlayingChange: (p: boolean) => void;
  seekRef:         React.MutableRefObject<((t: number) => void) | null>;
  playPauseRef:    React.MutableRefObject<(() => void) | null>;
  durationRef:     React.MutableRefObject<number>;
}

const WebVideoPlayer = memo(function WebVideoPlayer({
  src, muted, isActive, itemW, itemH,
  onProgress, onTimeUpdate, onReady, onError, onEnd,
  onPlayingChange, seekRef, playPauseRef, durationRef,
}: WebVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    seekRef.current      = (t: number) => { if (ref.current) ref.current.currentTime = t; };
    playPauseRef.current = () => {
      const v = ref.current; if (!v) return;
      v.paused ? v.play().catch(() => {}) : v.pause();
    };
    return () => { seekRef.current = null; playPauseRef.current = null; };
  }, [seekRef, playPauseRef]);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    isActive ? v.play().catch(() => {}) : (v.pause(), (v.currentTime = 0));
  }, [isActive]);

  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    const onTime  = () => {
      if (v.duration > 0) {
        durationRef.current = v.duration;
        onProgress(v.currentTime / v.duration);
        onTimeUpdate?.(v.currentTime * 1000, v.duration * 1000);
      }
    };
    const onCan   = () => onReady();
    const onErr   = () => onError();
    const onEnded = () => { v.currentTime = 0; onEnd(); };
    const onPlay  = () => onPlayingChange(true);
    const onPause = () => onPlayingChange(false);
    v.addEventListener('timeupdate', onTime); v.addEventListener('canplay', onCan);
    v.addEventListener('error', onErr);       v.addEventListener('ended', onEnded);
    v.addEventListener('play', onPlay);       v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTime); v.removeEventListener('canplay', onCan);
      v.removeEventListener('error', onErr);       v.removeEventListener('ended', onEnded);
      v.removeEventListener('play', onPlay);       v.removeEventListener('pause', onPause);
    };
  }, [onProgress, onTimeUpdate, onReady, onError, onEnd, onPlayingChange, durationRef]);

  return React.createElement('video', {
    ref, src, autoPlay: true, loop: false, playsInline: true, muted,
    style: {
      position: 'absolute', top: 0, left: 0,
      width: itemW, height: itemH,
      objectFit: 'cover', display: 'block', background: '#000',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SPINNER CSS
// ─────────────────────────────────────────────────────────────────────────────
const LoadingSpinner = memo(function LoadingSpinner() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 900, useNativeDriver: true }),
    ).start();
  }, [rot]);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={[fi.spinner, { transform: [{ rotate: spin }] }]} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// FEEDITEM
// ─────────────────────────────────────────────────────────────────────────────
const FeedItem = memo(function FeedItem({
  film, isActive, isNear,
  itemW, itemH, insetBot,
  onFollowFriend, onLike, onInfoPress, onProgress, onEnd,
}: FeedItemProps) {
  const router = useRouter();
  const isWeb  = Platform.OS === 'web';
  const src    = film.video_url?.trim().length ? film.video_url.trim() : null;

  // ── NATIVE PLAYER — TOUJOURS null au départ ────────────────────────────────
  //   replace() dans le sourceLoaded effect ci-dessous.
  //   → comportement identique slide 0, 1, 2, 3…
  const player = _useVideoPlayer(
    isWeb ? null : null,    // ← toujours null
    (p: any) => {
      if (!p || isWeb) return;
      p.loop  = false;
      p.muted = false;
      try {
        p.bufferOptions = {
          preferredForwardBufferDuration:  12,
          preferredBackwardBufferDuration: 0,
        };
      } catch {}
    },
  );

  // Events natifs — _useEvent fiable pour playingChange et timeUpdate
  const { isPlaying }       = _useEvent(player, 'playingChange', { isPlaying: false });
  const { currentTime }     = _useEvent(player, 'timeUpdate',    {
    currentTime: 0, bufferedPosition: 0,
    currentLiveTimestamp: null, currentOffsetFromLive: null,
  });
  const { isPlaybackEnded } = _useEvent(player, 'playToEnd', { isPlaybackEnded: false });

  // ── REFS ───────────────────────────────────────────────────────────────────
  const currentTimeRef = useRef(0);
  const isActiveRef    = useRef(isActive);   // mis à jour SYNCHRONIQUEMENT ci-dessous
  const webSeekRef     = useRef<((t: number) => void) | null>(null);
  const webPlayPauseRef= useRef<(() => void) | null>(null);
  const webDurationRef = useRef<number>(0);
  const sourceLoaded   = useRef(false);
  const endFiredRef    = useRef(false);

  // ★ Mise à jour synchrone (pas dans useEffect) → listener async toujours à jour
  isActiveRef.current = isActive;

  useEffect(() => {
    if (!isWeb) currentTimeRef.current = currentTime;
  }, [currentTime, isWeb]);

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [liked,       setLiked]       = useState(film.is_liked ?? false);
  const [muted,       setMuted]       = useState(false);
  const [saved,       setSaved]       = useState(film.is_saved ?? false);
  const [hasErr,      setHasErr]      = useState(false);
  const [nativeReady, setNativeReady] = useState(false);
  const [webReady,    setWebReady]    = useState(false);
  const [webProgress, setWebProgress] = useState(0);
  const [webPlaying,  setWebPlaying]  = useState(false);

  const isReady          = isWeb ? webReady    : nativeReady;
  const showLoading      = !!src && !isReady && !hasErr;
  const nativeDuration   = (!isWeb && player?.duration) ? player.duration : 0;
  const nativeProgress   = nativeDuration > 0 ? Math.min(currentTime / nativeDuration, 1) : 0;
  const progress         = isWeb ? webProgress : nativeProgress;
  const duration         = isWeb ? webDurationRef.current : nativeDuration;
  const currentlyPlaying = isWeb ? webPlaying  : isPlaying;

  // ── STATUS via addListener — fiable même après replace() ──────────────────
  useEffect(() => {
    if (isWeb || !player) return;
    let sub: any;
    try {
      sub = player.addListener('statusChange', (event: any) => {
        const raw  = event?.status ?? event;
        const stat = typeof raw === 'string' ? raw : (raw?.status ?? '');

        if (stat === 'readyToPlay') {
          setNativeReady(true); setHasErr(false);
          // ★ Play immédiat si déjà actif (isActiveRef = synchrone) ★
          if (isActiveRef.current) {
            const ct = currentTimeRef.current;
            if (ct > 0.1) try { player.seekBy(-ct); } catch {}
            try { player.play(); } catch {}
          }
        } else if (stat === 'error') {
          setHasErr(true); setNativeReady(false);
        } else if (stat === 'loading' || stat === 'idle') {
          setNativeReady(false);
        }
      });
    } catch (e) { console.warn('[FeedItem] addListener:', e); }
    return () => { try { sub?.remove(); } catch {} };
  }, [player, isWeb]);

  // ── CHARGEMENT SOURCE quand isNear devient true ────────────────────────────
  useEffect(() => {
    if (isWeb || !src || !player || sourceLoaded.current) return;
    if (isNear) {
      sourceLoaded.current = true;
      try { player.replace({ uri: src }); } catch {}
    }
  }, [isNear, isWeb, src, player]);

  // Reset guards sur changement de film
  useEffect(() => {
    sourceLoaded.current = false;
    endFiredRef.current  = false;
    setNativeReady(false); setHasErr(false);
    setWebReady(false); setWebProgress(0); setWebPlaying(false);
  }, [film.id]);

  // ── AUTO-PLAY / PAUSE / RESET (garde complémentaire) ──────────────────────
  //   Si nativeReady était déjà vrai quand isActive change → play() ici.
  //   Si nativeReady pas encore vrai → addListener s'en charge dès readyToPlay.
  useEffect(() => {
    if (isWeb || !src || !player) return;
    if (isActive && nativeReady) {
      const ct = currentTimeRef.current;
      if (ct > 0.1) try { player.seekBy(-ct); } catch {}
      try { player.play(); } catch {}
    } else if (!isActive) {
      try { player.pause(); } catch {}
      const ct = currentTimeRef.current;
      if (ct > 0.1) try { player.seekBy(-ct); } catch {}
    }
  }, [isActive, nativeReady, player, src, isWeb]);

  // Mute natif
  useEffect(() => {
    if (isWeb || !player) return;
    try { player.muted = muted; } catch {}
  }, [muted, player, isWeb]);

  // ── AUTO-AVANCE (playToEnd) ────────────────────────────────────────────────
  useEffect(() => {
    if (isWeb || !isPlaybackEnded || endFiredRef.current) return;
    endFiredRef.current = true;
    try { player.seekBy(-currentTimeRef.current); } catch {}
    onEnd?.();
  }, [isPlaybackEnded, isWeb, player, onEnd]);

  // ── SEEK ──────────────────────────────────────────────────────────────────
  const handleSeek = useCallback((seconds: number) => {
    if (isWeb) { webSeekRef.current?.(seconds); }
    else if (player) {
      try { player.seekBy(seconds - currentTimeRef.current); } catch {}
    }
  }, [isWeb, player]);

  // ── SKIP ±N s ─────────────────────────────────────────────────────────────
  const handleSkip = useCallback((delta: number) => {
    const target = Math.max(0, Math.min(duration, currentTimeRef.current + delta));
    handleSeek(target);
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [duration, handleSeek, isWeb]);

  // ── PLAY / PAUSE ──────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    if (!isWeb && player) { currentlyPlaying ? player.pause() : player.play(); }
    else { webPlayPauseRef.current?.(); }
  }, [isWeb, player, currentlyPlaying]);

  // ── DISPATCH PROGRESSION ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isWeb && nativeDuration > 0 && onProgress) {
      onProgress({ positionMs: currentTime * 1000, durationMs: nativeDuration * 1000 });
    }
  }, [currentTime, nativeDuration, isWeb, onProgress]);

  // ── CALLBACKS WEB ─────────────────────────────────────────────────────────
  const handleWebProgress   = useCallback((p: number) => setWebProgress(p), []);
  const handleWebReady      = useCallback(() => { setWebReady(true);  setHasErr(false);  }, []);
  const handleWebError      = useCallback(() => { setHasErr(true);    setWebReady(false); }, []);
  const handleWebPlaying    = useCallback((p: boolean) => setWebPlaying(p), []);
  const handleWebTimeUpdate = useCallback((posMs: number, durMs: number) => {
    onProgress?.({ positionMs: posMs, durationMs: durMs });
  }, [onProgress]);
  const handleWebEnd = useCallback(() => onEnd?.(), [onEnd]);

  // ── RETRY ─────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setHasErr(false); setNativeReady(false); setWebReady(false);
    endFiredRef.current = false; sourceLoaded.current = false;
    if (!isWeb && src && player) {
      try { player.replace({ uri: src }); } catch {}
      setTimeout(() => { try { player.play(); } catch {} }, 200);
    }
  }, [isWeb, src, player]);

  // ── TAP : simple = play/pause / double = like ─────────────────────────────
  const lastTap   = useRef(0);
  const heartAnim = useRef(new Animated.Value(0)).current;

  const handleTap = useCallback(() => {
    const now      = Date.now();
    const isDouble = now - lastTap.current < 290;
    lastTap.current = now;

    if (isDouble) {
      if (!liked) {
        setLiked(true); onLike?.(film.id);
        if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }
      Animated.sequence([
        Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 14 }),
        Animated.delay(520),
        Animated.timing(heartAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      handlePlayPause();
    }
  }, [liked, heartAnim, isWeb, film.id, onLike, handlePlayPause]);

  const heartScale = heartAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1.3, 1] });
  const heartOpac  = heartAnim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });

  // ── ACTIONS DROITE ────────────────────────────────────────────────────────
  const handleLike = useCallback(() => { setLiked(p => { onLike?.(film.id); return !p; }); }, [film.id, onLike]);
  const handleMute = useCallback(() => setMuted(p => !p), []);
  const handleSave = useCallback(() => setSaved(p => !p), []);
  const handleInfo = useCallback(() => {
    if (onInfoPress) onInfoPress(film);
    else router.push(`/film/${film.id}`);
  }, [film, router, onInfoPress]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={{ width: itemW, height: itemH, overflow: 'hidden', backgroundColor: '#0D0D1A' }}>

        {/* Poster / fallback fond sombre */}
        {!!film.poster_url ? (
          <Image
            source={{ uri: film.poster_url }}
            style={[StyleSheet.absoluteFill, { width: itemW, height: itemH }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0D0D1A' }]} />
        )}

        {/* ── WEB ──────────────────────────────────────────────────── */}
        {isWeb && !!src && !hasErr && (
          <WebVideoPlayer
            src={src} muted={muted} isActive={isActive}
            itemW={itemW} itemH={itemH}
            onProgress={handleWebProgress} onTimeUpdate={handleWebTimeUpdate}
            onReady={handleWebReady} onError={handleWebError} onEnd={handleWebEnd}
            onPlayingChange={handleWebPlaying}
            seekRef={webSeekRef} playPauseRef={webPlayPauseRef} durationRef={webDurationRef}
          />
        )}

        {/* ── NATIF ────────────────────────────────────────────────── */}
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

        {/* ── LOADING ──────────────────────────────────────────────── */}
        {showLoading && (
          <View style={fi.loadWrap} pointerEvents="none">
            <LoadingSpinner />
          </View>
        )}

        {/* ── ERREUR ───────────────────────────────────────────────── */}
        {hasErr && (
          <View style={fi.errWrap}>
            <Ionicons name="warning-outline" size={36} color={P.primL} />
            <Text style={fi.errTxt}>Impossible de charger la vidéo</Text>
            <TouchableOpacity onPress={handleRetry} style={fi.retryBtn} activeOpacity={0.85}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={fi.retryTxt}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── INDICATEUR PAUSE ─────────────────────────────────────── */}
        {!isWeb && nativeReady && !isPlaying && (
          <View style={fi.pauseWrap} pointerEvents="none">
            <BlurView intensity={20} tint="dark" style={fi.pauseBlur}>
              <Ionicons name="pause" size={28} color="rgba(255,255,255,0.88)" />
            </BlurView>
          </View>
        )}

        {/* ── CŒUR DOUBLE TAP ──────────────────────────────────────── */}
        <Animated.View
          style={[fi.bigHeart, { opacity: heartOpac, transform: [{ scale: heartScale }] }]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={90} color={P.red} />
        </Animated.View>

        {/* ── BARRE DROITE ─────────────────────────────────────────── */}
        <RightBar
          film={film} liked={liked} muted={muted} saved={saved}
          onLike={handleLike} onMute={handleMute} onInfo={handleInfo} onSave={handleSave}
        />

        {/* ── BOTTOM CARD — FUSION COMPLÈTE ────────────────────────── */}
        <BottomCard
          reelId={film.id}
          progress={progress}
          duration={duration}
          isPlaying={currentlyPlaying}
          isReady={isReady}
          insetBot={insetBot}
          onSeek={handleSeek}
          onPlayPause={handlePlayPause}
          onSkip={handleSkip}
        />

      </View>
    </TouchableWithoutFeedback>
  );
});

export default FeedItem;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const fi = StyleSheet.create({
  loadWrap:  { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  spinner:   {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2.5,
    borderColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.85)',
    borderRightColor: 'rgba(255,255,255,0.2)',
  },
  errWrap:  {
    ...StyleSheet.absoluteFillObject, alignItems: 'center',
    justifyContent: 'center', backgroundColor: 'rgba(7,0,15,0.8)', gap: 12,
  },
  errTxt:   { color: '#ccc', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  pauseWrap:{ position: 'absolute', top: '50%', left: '50%', marginTop: -30, marginLeft: -30 },
  pauseBlur:{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bigHeart: { position: 'absolute', top: '50%', left: '50%', marginTop: -45, marginLeft: -45 },
});