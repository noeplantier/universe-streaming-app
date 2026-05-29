/**
 * FeedItem.tsx — UNIVERSE · v4
 *
 * FIXES CRITIQUES :
 * ★ Pause/Play — isPaused géré dans un ref + effet dédié découplé de isActive/screenFocused
 * ★ Fullscreen — onUIVisibilityChange déclenche le masquage dans le parent (TopHeader + NavBar)
 * ★ Seek bar — currentTime passé comme state réactif (webCT ou nativeCT) + pas de snapshot stale
 *
 * COMPORTEMENT :
 * · Tap centre (overlay visible)  → pause / reprend la lecture + flash icône
 * · Tap centre (overlay caché)    → ré-affiche l'overlay, NE pause PAS
 * · Tap gauche/droite             → skip ±10 s si overlay visible
 * · Double-tap n'importe où       → like + cœur animé
 * · Long-press                    → force fullscreen (cache tout)
 * · Auto-hide overlay après 3 s   → appelle onUIVisibilityChange(false)
 */

import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Animated, Platform, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import * as Haptics       from 'expo-haptics';

import BottomCard from './BottomCard';
import { P }      from './types';
import type { FeedFilm } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// expo-video — natif uniquement
// ─────────────────────────────────────────────────────────────────────────────
function setupPlayer(p: any) {
  if (!p) return;
  p.loop  = false;
  p.muted = false;
  try {
    p.bufferOptions = {
      preferredForwardBufferDuration:  12,
      preferredBackwardBufferDuration: 2,
    };
  } catch {}
}

let _useVideoPlayer: ((src: any, setup: any) => any) | null = null;
let _VideoView:      any = null;
let _useEvent:       (player: any, event: string, initial: any) => any =
  (_p, _e, d) => d;

if (Platform.OS !== 'web') {
  try {
    const ev        = require('expo-video');
    _useVideoPlayer = ev.useVideoPlayer;
    _VideoView      = ev.VideoView;
    _useEvent       = ev.useEvent ?? require('expo').useEvent;
  } catch (e) { console.warn('[FeedItem] expo-video:', e); }
}

const _nullHook  = (_src: any, _setup: any) => null;
const _playerHook = _useVideoPlayer ?? _nullHook;

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const UI_AUTO_HIDE_MS = 3000;
const DBL_TAP_MS      = 280;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface FeedItemProps {
  film:                    FeedFilm;
  isActive:                boolean;
  isNear:                  boolean;
  screenFocused:           boolean;
  itemW:                   number;
  itemH:                   number;
  insetBot:                number;
  onLike?:                 (id: string) => void;
  onInfoPress?:            (f: FeedFilm) => void;
  /** Le parent (index.tsx) doit cacher/montrer TopHeader + NavBar */
  onUIVisibilityChange?:   (visible: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = memo(function Spinner() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(rot, { toValue:1, duration:800, useNativeDriver:true }),
    );
    a.start();
    return () => a.stop();
  }, [rot]);
  const spin = rot.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] });
  return <Animated.View style={[fi.spinner, { transform:[{ rotate:spin }] }]} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// WebPlayer
// ─────────────────────────────────────────────────────────────────────────────
interface WebPlayerProps {
  src:      string;
  paused:   boolean;
  isActive: boolean;
  muted:    boolean;
  itemW:    number;
  itemH:    number;
  onPlay:   (v: boolean) => void;
  onTime:   (ct: number, dur: number) => void;
  onWait:   (v: boolean) => void;
  onErr:    () => void;
  seekRef:  React.MutableRefObject<((t: number) => void) | null>;
}

const WebPlayer = memo(function WebPlayer({
  src, paused, isActive, muted, itemW, itemH,
  onPlay, onTime, onWait, onErr, seekRef,
}: WebPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    seekRef.current = (t: number) => {
      if (ref.current) ref.current.currentTime = t;
    };
    return () => { seekRef.current = null; };
  }, [seekRef]);

  // Active/inactive → play ou reset
  useEffect(() => {
    const v = ref.current; if (!v) return;
    if (isActive && !paused) { v.currentTime = 0; v.play().catch(() => {}); }
    else if (!isActive)      { v.pause(); v.currentTime = 0; }
  }, [isActive]);

  // Pause/Play séparé pour ne pas reset currentTime
  useEffect(() => {
    const v = ref.current; if (!v || !isActive) return;
    if (paused) v.pause();
    else        v.play().catch(() => {});
  }, [paused, isActive]);

  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    const onP = () => onPlay(true);
    const onA = () => onPlay(false);
    const onT = () => { if (v.duration > 0) onTime(v.currentTime, v.duration); };
    const onW = () => onWait(true);
    const onC = () => onWait(false);
    v.addEventListener('play',       onP);
    v.addEventListener('pause',      onA);
    v.addEventListener('ended',      onA);
    v.addEventListener('timeupdate', onT);
    v.addEventListener('waiting',    onW);
    v.addEventListener('canplay',    onC);
    v.addEventListener('error',      onErr);
    return () => {
      v.removeEventListener('play',       onP);
      v.removeEventListener('pause',      onA);
      v.removeEventListener('ended',      onA);
      v.removeEventListener('timeupdate', onT);
      v.removeEventListener('waiting',    onW);
      v.removeEventListener('canplay',    onC);
      v.removeEventListener('error',      onErr);
    };
  }, [onPlay, onTime, onWait, onErr]);

  return React.createElement('video', {
    ref, src, muted, playsInline: true, preload: 'auto',
    style: {
      position: 'absolute', top: 0, left: 0,
      width: itemW, height: itemH,
      objectFit: 'cover', background: '#000',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PlayPauseFlash
// ─────────────────────────────────────────────────────────────────────────────
const PlayPauseFlash = memo(function PlayPauseFlash({
  anim, isPaused,
}: { anim: Animated.Value; isPaused: boolean }) {
  return (
    <Animated.View style={[fi.ppFlash, { opacity: anim }]} pointerEvents="none">
      <View style={fi.ppCircle}>
        <Ionicons
          name={isPaused ? 'play' : 'pause'}
          size={38}
          color="rgba(255,255,255,0.95)"
        />
      </View>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FeedItem
// ─────────────────────────────────────────────────────────────────────────────
const FeedItem = memo(function FeedItem({
  film, isActive, isNear, screenFocused,
  itemW, itemH, insetBot, onLike, onInfoPress,
  onUIVisibilityChange,
}: FeedItemProps) {
  const isWeb = Platform.OS === 'web';
  const src   = film.video_url?.trim() || null;

  // ── Player natif ──────────────────────────────────────────────────────────
  const nativeSrc = !isWeb && isNear && src ? src : null;
  const player    = _playerHook(nativeSrc, setupPlayer);

  const { isPlaying: nativePlaying } = _useEvent(
    player, 'playingChange', { isPlaying: false },
  );
  // ★ nativeCT est réactif — mis à jour par expo-video à chaque frame
  const { currentTime: nativeCT } = _useEvent(
    player, 'timeUpdate',
    { currentTime: 0, bufferedPosition: 0, currentLiveTimestamp: null, currentOffsetFromLive: null },
  );
  const { isPlaybackEnded } = _useEvent(
    player, 'playToEnd', { isPlaybackEnded: false },
  );

  // ── State ─────────────────────────────────────────────────────────────────
  const [liked,      setLiked]      = useState(film.is_liked ?? false);
  const [muted,      setMuted]      = useState(false);
  const [saved,      setSaved]      = useState(film.is_saved ?? false);
  const [buffering,  setBuffering]  = useState(true);
  const [hasErr,     setHasErr]     = useState(false);
  const [webPlaying, setWebPlaying] = useState(false);
  const [webCT,      setWebCT]      = useState(0);
  const [webDur,     setWebDur]     = useState(0);
  const [showUI,     setShowUI]     = useState(true);

  // ★ isPaused : state ET ref — le state déclenche l'effet player, le ref est lisible dans callbacks
  const [isPaused, _setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const setIsPaused = useCallback((v: boolean) => {
    isPausedRef.current = v;
    _setIsPaused(v);
  }, []);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const endRef      = useRef(false);
  const seekRef     = useRef<((t: number) => void) | null>(null);
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ppFlashAnim = useRef(new Animated.Value(0)).current;

  // ── Métriques réactives ───────────────────────────────────────────────────
  // ★ currentTime est maintenant un STATE réactif (pas un ref snapshot)
  const currentTime = isWeb ? webCT : nativeCT;
  const dur         = isWeb ? webDur : (player?.duration ?? 0);
  const progress    = dur > 0 ? Math.min(currentTime / dur, 1) : 0;

  // ── Auto-hide timer ───────────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    // Ne pas auto-cacher si en pause (l'utilisateur veut voir les contrôles)
    if (isPausedRef.current) return;
    hideTimer.current = setTimeout(() => {
      setShowUI(false);
      onUIVisibilityChange?.(false);
    }, UI_AUTO_HIDE_MS);
  }, [onUIVisibilityChange]);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    if (isActive && showUI) resetHideTimer();
    return clearHideTimer;
  }, [isActive, showUI, resetHideTimer, clearHideTimer]);

  // ── Status listener natif ─────────────────────────────────────────────────
  useEffect(() => {
    if (isWeb || !player?.addListener) return;
    let sub: any;
    try {
      sub = player.addListener('statusChange', (ev: any) => {
        const st = typeof ev?.status === 'string'
          ? ev.status : (ev?.status?.status ?? '');
        if (st === 'loading')     setBuffering(true);
        if (st === 'readyToPlay') { setBuffering(false); setHasErr(false); }
        if (st === 'error')       { setHasErr(true); setBuffering(false); }
        if (st === 'idle')        setBuffering(false);
      });
    } catch {}
    return () => { try { sub?.remove(); } catch {} };
  }, [player, isWeb]);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ EFFET PLAY/PAUSE NATIF — découplé proprement
  //   Dépendances : isActive, screenFocused, isPaused, player
  //   → Se déclenche à chaque changement d'une de ces 4 valeurs
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isWeb || !player) return;

    const shouldPlay = isActive && screenFocused && !isPaused;

    if (shouldPlay) {
      try { player.play(); } catch {}
    } else {
      try { player.pause(); } catch {}
      // Reset position uniquement si on quitte la vidéo (pas si on pause)
      if (!isActive && !isPaused) {
        const ct = nativeCT;
        if (ct > 0.3) {
          setTimeout(() => {
            try { player.seekBy(-ct); } catch {}
          }, 0);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, screenFocused, isPaused, player, isWeb]);
  // ↑ nativeCT intentionnellement exclu — on ne veut pas relancer l'effet à chaque frame

  // Mute natif
  useEffect(() => {
    if (isWeb || !player) return;
    try { player.muted = muted; } catch {}
  }, [muted, player, isWeb]);

  // Fin vidéo
  useEffect(() => {
    if (isWeb || !isPlaybackEnded || endRef.current || !player) return;
    endRef.current = true;
    setIsPaused(false);
    try { player.seekBy(-nativeCT); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaybackEnded, isWeb, player]);

  // Reset sur changement de film
  useEffect(() => {
    endRef.current = false;
    setHasErr(false);
    setBuffering(true);
    setWebPlaying(false);
    setWebCT(0);
    setWebDur(0);
    setShowUI(true);
    setIsPaused(false);
    onUIVisibilityChange?.(true);
    // Lance le timer après le reset
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowUI(false);
      onUIVisibilityChange?.(false);
    }, UI_AUTO_HIDE_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film.id]);

  // Cleanup timer au démontage
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  // ── Callbacks Web ─────────────────────────────────────────────────────────
  const onWebPlay = useCallback((v: boolean) => { setWebPlaying(v); setBuffering(false); }, []);
  const onWebTime = useCallback((ct: number, d: number) => { setWebCT(ct); setWebDur(d); }, []);
  const onWebWait = useCallback((v: boolean) => setBuffering(v), []);
  const onWebErr  = useCallback(() => { setHasErr(true); setBuffering(false); }, []);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const handleSeek = useCallback((sec: number) => {
    if (isWeb) {
      seekRef.current?.(sec);
    } else if (player) {
      try { player.seekBy(sec - nativeCT); } catch {}
    }
  }, [isWeb, player, nativeCT]);

  // ── Toggle Pause/Play ─────────────────────────────────────────────────────
  const ppFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashIcon = useCallback(() => {
    if (ppFlashTimeout.current) clearTimeout(ppFlashTimeout.current);
    ppFlashAnim.setValue(1);
    ppFlashTimeout.current = setTimeout(() => {
      Animated.timing(ppFlashAnim, { toValue:0, duration:200, useNativeDriver:true }).start();
    }, 380);
  }, [ppFlashAnim]);

  const togglePlayPause = useCallback(() => {
    const next = !isPausedRef.current;
    setIsPaused(next);
    flashIcon();
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Quand on reprend → relancer le timer auto-hide
    if (!next) resetHideTimer();
    else clearHideTimer(); // En pause → ne pas cacher l'overlay
  }, [setIsPaused, flashIcon, isWeb, resetHideTimer, clearHideTimer]);

  // ── Skip ±10s ─────────────────────────────────────────────────────────────
  const leftBadge  = useRef(new Animated.Value(0)).current;
  const rightBadge = useRef(new Animated.Value(0)).current;

  const flashBadge = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue:1, duration:80,  useNativeDriver:true }),
      Animated.delay(350),
      Animated.timing(anim, { toValue:0, duration:200, useNativeDriver:true }),
    ]).start();
  }, []);

  const skip = useCallback((d: number) => {
    handleSeek(Math.max(0, Math.min(dur, currentTime + d)));
    d < 0 ? flashBadge(leftBadge) : flashBadge(rightBadge);
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [dur, currentTime, handleSeek, flashBadge, leftBadge, rightBadge, isWeb]);

  // ── Like + cœur animé ─────────────────────────────────────────────────────
  const heartOp    = useRef(new Animated.Value(0)).current;
  const heartScale = heartOp.interpolate({ inputRange:[0,0.4,1], outputRange:[0,1.3,1] });
  const heartAlpha = heartOp.interpolate({ inputRange:[0,0.1,0.85,1], outputRange:[0,1,1,0] });

  const doLike = useCallback(() => {
    if (!liked) { setLiked(true); onLike?.(film.id); }
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Animated.sequence([
      Animated.spring(heartOp, { toValue:1, useNativeDriver:true, speed:20, bounciness:12 }),
      Animated.delay(500),
      Animated.timing(heartOp, { toValue:0, duration:250, useNativeDriver:true }),
    ]).start();
  }, [liked, heartOp, isWeb, film.id, onLike]);

  // ── Zones de tap — gestion simple/double ─────────────────────────────────
  // On utilise des refs de timestamp pour détecter le double-tap
  const tL = useRef(0);
  const tC = useRef(0);
  const tR = useRef(0);

  const showUICallback = useCallback(() => {
    setShowUI(true);
    onUIVisibilityChange?.(true);
    resetHideTimer();
  }, [onUIVisibilityChange, resetHideTimer]);

  const tapL = useCallback(() => {
    const n = Date.now();
    const isDbl = n - tL.current < DBL_TAP_MS;
    tL.current = n;
    if (isDbl) { doLike(); return; }
    if (!showUI) { showUICallback(); return; }
    skip(-10);
    resetHideTimer();
  }, [doLike, skip, showUI, showUICallback, resetHideTimer]);

  const tapC = useCallback(() => {
    const n = Date.now();
    const isDbl = n - tC.current < DBL_TAP_MS;
    tC.current = n;
    if (isDbl) { doLike(); return; }
    if (!showUI) {
      // ★ Premier tap centre quand overlay caché → JUSTE ré-afficher, ne pas pauser
      showUICallback();
      return;
    }
    // Overlay visible → toggle pause/play
    togglePlayPause();
    resetHideTimer();
  }, [doLike, showUI, showUICallback, togglePlayPause, resetHideTimer]);

  const tapR = useCallback(() => {
    const n = Date.now();
    const isDbl = n - tR.current < DBL_TAP_MS;
    tR.current = n;
    if (isDbl) { doLike(); return; }
    if (!showUI) { showUICallback(); return; }
    skip(10);
    resetHideTimer();
  }, [doLike, skip, showUI, showUICallback, resetHideTimer]);

  const handleLongPress = useCallback(() => {
    clearHideTimer();
    setShowUI(false);
    onUIVisibilityChange?.(false);
  }, [clearHideTimer, onUIVisibilityChange]);

  const zW = itemW / 3;

  // ── Sidebar handlers ──────────────────────────────────────────────────────
  const handleSideLike = useCallback(() => {
    setLiked(v => { if (!v) onLike?.(film.id); return !v; });
    resetHideTimer();
  }, [film.id, onLike, resetHideTimer]);

  const handleSideMute = useCallback(() => {
    setMuted(v => !v); resetHideTimer();
  }, [resetHideTimer]);

  const handleSideSave = useCallback(() => {
    setSaved(v => !v); resetHideTimer();
  }, [resetHideTimer]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[fi.root, { width: itemW, height: itemH }]}>

      <View style={[StyleSheet.absoluteFill, fi.bg]} />

      {/* ── VideoView NATIF ──────────────────────────────────────────────── */}
      {!isWeb && isNear && !!src && !hasErr && _VideoView && player && (
        <_VideoView
          player={player}
          style={[StyleSheet.absoluteFill, { width: itemW, height: itemH }]}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      )}

      {/* ── Web <video> ───────────────────────────────────────────────────── */}
      {isWeb && !!src && !hasErr && (
        <WebPlayer
          src={src}
          paused={isPaused}
          isActive={isActive && screenFocused}
          muted={muted}
          itemW={itemW} itemH={itemH}
          onPlay={onWebPlay} onTime={onWebTime}
          onWait={onWebWait} onErr={onWebErr}
          seekRef={seekRef}
        />
      )}

      {/* ── URL manquante ─────────────────────────────────────────────────── */}
      {!src && (
        <View style={fi.diagBox} pointerEvents="none">
          <Ionicons name="videocam-off-outline" size={36} color="rgba(255,255,255,0.25)" />
          <Text style={fi.diagTxt}>video_url manquante</Text>
        </View>
      )}

      {/* ── Gradient bas ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
        locations={[0.30, 0.68, 1]}
        style={fi.grad}
        pointerEvents="none"
      />

      {/* ── Zones de geste ────────────────────────────────────────────────── */}
      <TouchableOpacity style={[fi.zone, { left: 0    }]} onPress={tapL} onLongPress={handleLongPress} activeOpacity={1} />
      <TouchableOpacity style={[fi.zone, { left: zW   }]} onPress={tapC} onLongPress={handleLongPress} activeOpacity={1} />
      <TouchableOpacity style={[fi.zone, { left: zW*2 }]} onPress={tapR} onLongPress={handleLongPress} activeOpacity={1} />

      {/* ── Flash pause/play ──────────────────────────────────────────────── */}
      <PlayPauseFlash anim={ppFlashAnim} isPaused={isPaused} />

      {/* ── Buffering ─────────────────────────────────────────────────────── */}
      {isActive && buffering && !hasErr && !!src && (
        <View style={fi.center} pointerEvents="none"><Spinner /></View>
      )}

      {/* ── Erreur ────────────────────────────────────────────────────────── */}
      {hasErr && (
        <View style={fi.errBox}>
          <Ionicons name="warning-outline" size={34} color={P.hot} />
          <Text style={fi.errTxt}>Impossible de lire la vidéo</Text>
          <Text style={fi.errUrl} numberOfLines={1}>{src}</Text>
          <TouchableOpacity
            style={fi.retryBtn}
            onPress={() => { setHasErr(false); setBuffering(true); }}
          >
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={fi.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Badges skip ───────────────────────────────────────────────────── */}
      <Animated.View style={[fi.badge, { opacity: leftBadge,  left:16,  top: itemH*0.45 }]} pointerEvents="none" />
      <Animated.View style={[fi.badge, { opacity: rightBadge, right:16, top: itemH*0.45 }]} pointerEvents="none" />

      {/* ── Cœur double-tap ───────────────────────────────────────────────── */}
      <Animated.View
        style={[fi.heart, { opacity: heartAlpha, transform:[{ scale: heartScale }] }]}
        pointerEvents="none"
      >
        <Ionicons name="heart" size={90} color={P.red} />
      </Animated.View>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      {showUI && (
        <View style={fi.sidebar} pointerEvents="box-none">
          <TouchableOpacity style={fi.sBtn} onPress={handleSideLike}>
            <View style={[fi.sIcon, liked && fi.sIconOn]}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? P.red : '#fff'} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={fi.sBtn} onPress={handleSideMute}>
            <View style={[fi.sIcon, muted && fi.sIconOn]}>
              <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={23} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={fi.sBtn} onPress={handleSideSave}>
            <View style={[fi.sIcon, saved && fi.sIconOn]}>
              <Ionicons name={saved ? 'star' : 'star-outline'} size={23} color={saved ? P.gold : '#fff'} />
            </View>
          </TouchableOpacity>

          {onInfoPress && (
            <TouchableOpacity style={fi.sBtn} onPress={() => { onInfoPress(film); resetHideTimer(); }}>
              <View style={fi.sIcon}>
                <Ionicons name="list-outline" size={24} color="rgba(255,255,255,0.75)" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── BottomCard ────────────────────────────────────────────────────── */}
      <BottomCard
        film={film}
        progress={progress}
        duration={dur}
        currentTime={currentTime}
        isReady={!buffering && !hasErr && !!src}
        insetBot={insetBot}
        onSeek={handleSeek}
        visible={showUI}
      />

    </View>
  );
});

export default FeedItem;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const fi = StyleSheet.create({
  root:    { overflow: 'hidden' },
  bg:      { backgroundColor: '#000' },
  grad:    { position:'absolute', bottom:0, left:0, right:0, height:'62%' },
  zone:    { position:'absolute', top:0, bottom:0, width:'33.33%', zIndex:10 },
  center:  { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center', zIndex:20 },

  spinner: {
    width:38, height:38, borderRadius:19, borderWidth:3,
    borderColor:'transparent',
    borderTopColor:'rgba(255,255,255,0.90)',
    borderRightColor:'rgba(255,255,255,0.20)',
  },

  diagBox: {
    ...StyleSheet.absoluteFillObject, zIndex:5,
    alignItems:'center', justifyContent:'center', gap:10,
  },
  diagTxt: { color:'rgba(255,255,255,0.35)', fontSize:13, textAlign:'center' },

  errBox:   { ...StyleSheet.absoluteFillObject, zIndex:20, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(0,0,0,0.88)', gap:12, padding:32 },
  errTxt:   { color:'rgba(255,255,255,0.70)', fontSize:14, fontWeight:'600' },
  errUrl:   { color:'rgba(255,255,255,0.28)', fontSize:10, textAlign:'center' },
  retryBtn: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:P.primary, borderRadius:12, paddingHorizontal:18, paddingVertical:10 },
  retryTxt: { color:'#fff', fontSize:13, fontWeight:'700' },

  badge: { position:'absolute', zIndex:20 },
  heart: {
    position:'absolute', top:'50%', left:'50%',
    marginTop:-45, marginLeft:-45, zIndex:20,
  },

  ppFlash: {
    position:'absolute', zIndex:25,
    top:'50%', left:'50%',
    marginTop:-40, marginLeft:-40,
  },
  ppCircle: {
    width:80, height:80, borderRadius:40,
    backgroundColor:'rgba(0,0,0,0.60)',
    alignItems:'center', justifyContent:'center',
    borderWidth:1.5,
    borderColor:'rgba(255,255,255,0.22)',
  },

  sidebar: {
    position:  'absolute',
    right:      14,
    bottom:    270,
    alignItems:'center',
    gap:        20,
    zIndex:     15,
  },
  sBtn:    { alignItems:'center', gap:4 },
  sIcon:   {
    width:50, height:50, borderRadius:25,
    backgroundColor:'rgba(0,0,0,0.40)',
    alignItems:'center', justifyContent:'center',
    borderWidth:1, borderColor:'rgba(255,255,255,0.12)',
  },
  sIconOn: { backgroundColor:'rgba(255,255,255,0.15)' },
});