/**
 * FeedItem.tsx — v10.0
 *
 * ── POURQUOI LES VIDÉOS N'AFFICHAIENT PAS (son seul) ────────────────────────
 *
 *   expo-video `VideoView` est une VUE NATIVE.
 *   Envelopper une vue native dans `Animated.View` avec une opacity JS
 *   n'affecte pas le rendu natif de la vidéo : le son passe, l'image non.
 *
 * ── FIX — INVERSION DE LA LOGIQUE ───────────────────────────────────────────
 *
 *   AVANT (cassé) :
 *     [poster]                    ← fond
 *     [Animated.View opacity=0→1] ← enveloppe VideoView (ne marche pas)
 *       [VideoView]
 *
 *   APRÈS (correct) :
 *     [fond noir]                 ← fond absolu
 *     [VideoView] opacity=1       ← TOUJOURS à pleine opacité, jamais wrappé
 *     [Animated.Image poster]     ← OVERLAY qui fade-OUT quand la vidéo joue
 *
 *   Résultat : la vidéo est toujours visible quand elle joue.
 *   Le crossfade est fait par le poster qui disparaît progressivement.
 *   → Transition fondu enchaîné identique à drama.tv.
 *
 * ── AUTO-PLAY GARANTI ────────────────────────────────────────────────────────
 *
 *   1. useVideoPlayer(isNear ? src : null)
 *      → expo-video charge + buffe dès isNear=true (préchargement ±1)
 *
 *   2. useEffect([isActive]) → play() sans condition
 *      → expo-video met en file d'attente si pas encore prêt
 *
 *   3. addListener('statusChange') → backup play() dès 'readyToPlay'
 *      → couvre le cas où isActive=true AVANT que la vidéo soit prête
 *
 * ── TRANSITION DRAMA.TV ───────────────────────────────────────────────────────
 *
 *   isActive=true  → posterOpacity : 1 → 0 en 320ms (fondu révèle la vidéo)
 *   isActive=false → posterOpacity : 0 → 1 en 160ms (fondu cache la vidéo)
 */

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
// expo-video — chargement conditionnel
// ─────────────────────────────────────────────────────────────────────────────
let _useVideoPlayer: any = (_src: any, _cb: any) => ({
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
  } catch (e) { console.warn('[FeedItem] expo-video non disponible:', e); }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface FeedItemProps {
  film:           FeedFilm;
  isActive:       boolean;
  isNear:         boolean;
  screenFocused?: boolean;
  itemW:          number;
  itemH:          number;
  insetBot:       number;
  onFollowFriend: (fid: string) => void;
  onLike?:        (id: string) => void;
  onInfoPress?:   (film: FeedFilm) => void;
  onProgress?:    (p: { positionMs: number; durationMs: number }) => void;
  onEnd?:         () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB VIDEO PLAYER
// ─────────────────────────────────────────────────────────────────────────────
interface WebProps {
  src: string; muted: boolean; isActive: boolean;
  itemW: number; itemH: number;
  onProgress: (p: number) => void;
  onTimeUpdate?: (posMs: number, durMs: number) => void;
  onReady: () => void; onError: () => void; onEnd: () => void;
  onPlayingChange: (p: boolean) => void;
  seekRef: React.MutableRefObject<((t: number) => void) | null>;
  playPauseRef: React.MutableRefObject<(() => void) | null>;
  durationRef: React.MutableRefObject<number>;
}

const WebVideoPlayer = memo(function WebVideoPlayer({
  src, muted, isActive, itemW, itemH,
  onProgress, onTimeUpdate, onReady, onError, onEnd,
  onPlayingChange, seekRef, playPauseRef, durationRef,
}: WebProps) {
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
    if (isActive) { v.currentTime = 0; v.play().catch(() => {}); }
    else { v.pause(); v.currentTime = 0; }
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
    ref, src, autoPlay: false, loop: false, playsInline: true, muted,
    style: {
      position: 'absolute', top: 0, left: 0,
      width: itemW, height: itemH,
      objectFit: 'cover', display: 'block', background: '#000',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SPINNER
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
  const src    = film.video_url?.trim() || null;

  // ── POSTER OVERLAY — Animated.Value pour le fondu du poster ───────────────
  //
  //   posterOpacity = 1 → poster visible (cache la vidéo)
  //   posterOpacity = 0 → poster transparent (vidéo visible)
  //
  //   C'est le poster qui s'anime, PAS la VideoView native.
  //   La VideoView reste toujours à opacity=1 → visible quand elle joue.
  //
  const posterOpacity = useRef(new Animated.Value(1)).current;
  const posterAnim    = useRef<Animated.CompositeAnimation>();

  // Fondu du poster vers 0 → révèle la vidéo (drama.tv style)
  const revealVideo = useCallback(() => {
    posterAnim.current?.stop();
    posterAnim.current = Animated.timing(posterOpacity, {
      toValue:         0,
      duration:        320,
      useNativeDriver: true,
    });
    posterAnim.current.start();
  }, [posterOpacity]);

  // Fondu du poster vers 1 → cache la vidéo
  const hidePoster = useCallback(() => {
    posterAnim.current?.stop();
    posterAnim.current = Animated.timing(posterOpacity, {
      toValue:         1,
      duration:        160,
      useNativeDriver: true,
    });
    posterAnim.current.start();
  }, [posterOpacity]);

  // ── NATIVE PLAYER ─────────────────────────────────────────────────────────
  //
  //   ★ Source passée directement (isNear ? src : null) ★
  //   expo-video charge + buffe la source dès isNear=true.
  //   Quand play() est appelé, la vidéo est déjà en mémoire → démarrage immédiat.
  //
  const player = _useVideoPlayer(
    isWeb ? null : (isNear && src ? src : null),
    (p: any) => {
      if (!p || isWeb) return;
      p.loop  = false;
      p.muted = false;
      try {
        p.bufferOptions = {
          preferredForwardBufferDuration:  15,
          preferredBackwardBufferDuration: 0,
        };
      } catch {}
    },
  );

  const { isPlaying }       = _useEvent(player, 'playingChange', { isPlaying: false });
  const { currentTime }     = _useEvent(player, 'timeUpdate',    {
    currentTime: 0, bufferedPosition: 0,
    currentLiveTimestamp: null, currentOffsetFromLive: null,
  });
  const { isPlaybackEnded } = _useEvent(player, 'playToEnd', { isPlaybackEnded: false });

  // ── REFS ──────────────────────────────────────────────────────────────────
  const currentTimeRef  = useRef(0);
  const isActiveRef     = useRef(isActive);     // synchrone, pour addListener
  const endFiredRef     = useRef(false);
  const webSeekRef      = useRef<((t: number) => void) | null>(null);
  const webPlayPauseRef = useRef<(() => void) | null>(null);
  const webDurationRef  = useRef<number>(0);

  isActiveRef.current = isActive;   // mise à jour synchrone à chaque render
  useEffect(() => { if (!isWeb) currentTimeRef.current = currentTime; }, [currentTime, isWeb]);

  // ── STATE ─────────────────────────────────────────────────────────────────
  const [liked,       setLiked]       = useState(film.is_liked ?? false);
  const [muted,       setMuted]       = useState(false);
  const [saved,       setSaved]       = useState(film.is_saved ?? false);
  const [hasErr,      setHasErr]      = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [webReady,    setWebReady]    = useState(false);
  const [webProgress, setWebProgress] = useState(0);
  const [webPlaying,  setWebPlaying]  = useState(false);

  const nativeDuration   = (!isWeb && player?.duration) ? player.duration : 0;
  const nativeProgress   = nativeDuration > 0 ? Math.min(currentTime / nativeDuration, 1) : 0;
  const progress         = isWeb ? webProgress : nativeProgress;
  const duration         = isWeb ? webDurationRef.current : nativeDuration;
  const currentlyPlaying = isWeb ? webPlaying : isPlaying;
  const isReady          = isWeb ? webReady    : !isBuffering && !hasErr && !!src;

  // ── addListener — backup play() + déclencheur revealVideo ─────────────────
  useEffect(() => {
    if (isWeb || !player) return;
    let sub: any;
    try {
      sub = player.addListener('statusChange', (ev: any) => {
        const raw  = ev?.status ?? ev;
        const stat = typeof raw === 'string' ? raw : (raw?.status ?? '');

        if (stat === 'readyToPlay') {
          setIsBuffering(false); setHasErr(false);
          if (isActiveRef.current) {
            // Backup : play() au cas où l'effet principal a manqué le timing
            try { player.play(); } catch {}
            revealVideo();
          }
        } else if (stat === 'loading') {
          setIsBuffering(true);
        } else if (stat === 'error') {
          setHasErr(true); setIsBuffering(false);
          if (isActiveRef.current) hidePoster(); // garde le fond visible
        }
      });
    } catch (e) { console.warn('[FeedItem] addListener:', e); }
    return () => { try { sub?.remove(); } catch {} };
  }, [player, isWeb, revealVideo, hidePoster]);

  // ── ★ AUTO-PLAY + TRANSITION ★ ─────────────────────────────────────────────
  //
  //   isActive=true  :
  //     • play() SANS condition → expo-video met en queue si pas prêt
  //     • revealVideo() → posterOpacity 1→0 en 320ms (drama.tv crossfade)
  //
  //   isActive=false :
  //     • hidePoster() → posterOpacity 0→1 en 160ms (re-cache la vidéo)
  //     • pause() immédiat
  //     • reset à t=0
  //
  useEffect(() => {
    if (isWeb || !player) return;

    if (isActive) {
      // Reset au début si on revient sur ce reel
      const ct = currentTimeRef.current;
      if (ct > 0.1) { try { player.seekBy(-ct); } catch {} }
      try { player.play(); } catch {}
      revealVideo();
    } else {
      hidePoster();
      try { player.pause(); } catch {}
      const ct = currentTimeRef.current;
      if (ct > 0.1) { try { player.seekBy(-ct); } catch {} }
    }
  }, [isActive, player, isWeb, revealVideo, hidePoster]);

  // Web : transition poster sur isActive
  useEffect(() => {
    if (!isWeb) return;
    isActive ? revealVideo() : hidePoster();
  }, [isActive, isWeb, revealVideo, hidePoster]);

  // Mute natif
  useEffect(() => {
    if (isWeb || !player) return;
    try { player.muted = muted; } catch {}
  }, [muted, player, isWeb]);

  // Auto-avance fin de vidéo
  useEffect(() => {
    if (isWeb || !isPlaybackEnded || endFiredRef.current) return;
    endFiredRef.current = true;
    try { player.seekBy(-currentTimeRef.current); } catch {}
    onEnd?.();
  }, [isPlaybackEnded, isWeb, player, onEnd]);

  // Reset sur changement de film
  useEffect(() => {
    endFiredRef.current = false;
    setHasErr(false); setIsBuffering(false);
    setWebReady(false); setWebProgress(0); setWebPlaying(false);
    posterOpacity.setValue(1);   // reset immédiat : poster visible
  }, [film.id, posterOpacity]);

  // ── SEEK / SKIP / PLAY-PAUSE ──────────────────────────────────────────────
  const handleSeek = useCallback((seconds: number) => {
    if (isWeb) { webSeekRef.current?.(seconds); }
    else if (player) { try { player.seekBy(seconds - currentTimeRef.current); } catch {} }
  }, [isWeb, player]);

  const handleSkip = useCallback((delta: number) => {
    const target = Math.max(0, Math.min(duration, currentTimeRef.current + delta));
    handleSeek(target);
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [duration, handleSeek, isWeb]);

  const handlePlayPause = useCallback(() => {
    if (!isWeb && player) { currentlyPlaying ? player.pause() : player.play(); }
    else { webPlayPauseRef.current?.(); }
  }, [isWeb, player, currentlyPlaying]);

  // Progression au parent
  useEffect(() => {
    if (!isWeb && nativeDuration > 0 && onProgress) {
      onProgress({ positionMs: currentTime * 1000, durationMs: nativeDuration * 1000 });
    }
  }, [currentTime, nativeDuration, isWeb, onProgress]);

  // Callbacks web
  const handleWebProgress   = useCallback((p: number) => setWebProgress(p), []);
  const handleWebReady      = useCallback(() => { setWebReady(true);  setHasErr(false);  }, []);
  const handleWebError      = useCallback(() => { setHasErr(true);    setWebReady(false); }, []);
  const handleWebPlaying    = useCallback((p: boolean) => setWebPlaying(p), []);
  const handleWebTimeUpdate = useCallback((posMs: number, durMs: number) => {
    onProgress?.({ positionMs: posMs, durationMs: durMs });
  }, [onProgress]);
  const handleWebEnd = useCallback(() => onEnd?.(), [onEnd]);

  // Retry
  const handleRetry = useCallback(() => {
    setHasErr(false); setIsBuffering(false);
    endFiredRef.current = false;
    posterOpacity.setValue(1);
    if (!isWeb && src && player) {
      try { player.replace({ uri: src }); } catch {}
      setTimeout(() => {
        if (isActiveRef.current) { try { player.play(); } catch {} revealVideo(); }
      }, 300);
    }
  }, [isWeb, src, player, revealVideo, posterOpacity]);

  // Double tap → like / simple tap → play-pause
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
      <View style={[fi.root, { width: itemW, height: itemH }]}>

        {/* ── COUCHE 1 : FOND NOIR ─────────────────────────────────────── */}
        <View style={[StyleSheet.absoluteFill, fi.bg]} />

        {/* ── COUCHE 2 : VIDÉO NATIVE à opacity=1 (JAMAIS wrappée) ────── */}
        {/*   CRITIQUE : VideoView directement enfant de la View racine     */}
        {/*   → aucun Animated.View entre la vidéo et le root               */}
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

        {/* Web */}
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

        {/* ── COUCHE 3 : POSTER EN OVERLAY ─────────────────────────────── */}
        {/*   posterOpacity = 1 (visible) → cache la vidéo                 */}
        {/*   posterOpacity = 0 (transparent) → révèle la vidéo            */}
        {/*                                                                  */}
        {/*   C'est le poster qui s'anime (pas la vidéo) → fonctionne      */}
        {/*   avec les vues natives.                                         */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: posterOpacity }]}
          pointerEvents="none"
        >
          {film.poster_url ? (
            <Image
              source={{ uri: film.poster_url }}
              style={{ width: itemW, height: itemH }}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, fi.posterFallback]} />
          )}
        </Animated.View>

        {/* ── COUCHE 4 : BUFFERING ─────────────────────────────────────── */}
        {isActive && isBuffering && !hasErr && (
          <View style={fi.loadWrap} pointerEvents="none">
            <LoadingSpinner />
          </View>
        )}

        {/* ── COUCHE 5 : ERREUR ────────────────────────────────────────── */}
        {hasErr && (
          <View style={fi.errWrap}>
            <Ionicons name="warning-outline" size={36} color={P.primL} />
            <Text style={fi.errTxt}>Impossible de charger</Text>
            <TouchableOpacity onPress={handleRetry} style={fi.retryBtn} activeOpacity={0.85}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={fi.retryTxt}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── COUCHE 6 : INDICATEUR PAUSE ──────────────────────────────── */}
        {!isWeb && isActive && !isPlaying && !isBuffering && !hasErr && (
          <View style={fi.pauseWrap} pointerEvents="none">
            <BlurView intensity={20} tint="dark" style={fi.pauseBlur}>
              <Ionicons name="pause" size={28} color="rgba(255,255,255,0.88)" />
            </BlurView>
          </View>
        )}

        {/* ── COUCHE 7 : CŒUR DOUBLE TAP ───────────────────────────────── */}
        <Animated.View
          style={[fi.bigHeart, { opacity: heartOpac, transform: [{ scale: heartScale }] }]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={90} color={P.red} />
        </Animated.View>

        {/* ── COUCHE 8 : BARRE DROITE ──────────────────────────────────── */}
        <RightBar
          film={film} liked={liked} muted={muted} saved={saved}
          onLike={handleLike} onMute={handleMute} onInfo={handleInfo} onSave={handleSave}
        />

        {/* ── COUCHE 9 : BOTTOM CARD ───────────────────────────────────── */}
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
  root:          { overflow: 'hidden' },
  loadWrap:      { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  spinner: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2.5, borderColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.85)',
    borderRightColor: 'rgba(255,255,255,0.2)',
  },
  errWrap:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,0,15,0.82)', gap: 12 },
  errTxt:    { color: '#ccc', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryTxt:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  pauseWrap: { position: 'absolute', top: '50%', left: '50%', marginTop: -30, marginLeft: -30 },
  pauseBlur: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bigHeart:  { position: 'absolute', top: '50%', left: '50%', marginTop: -45, marginLeft: -45 },
});