/**
 * FeedItem.tsx — v3.0
 *
 * ✦ Auto-play dès que isActive=true (reset automatique à t=0)
 * ✦ Reset propre à t=0 quand isActive=false (currentTimeRef = valeur fraîche)
 * ✦ Auto-avance au reel suivant en fin de vidéo (onEnd prop)
 * ✦ Barre de progression seekable — onSeek + duration passés à BottomCard
 * ✦ seekFnRef partagé native/web — zéro re-render lors du seek
 */

import React, {
  memo, useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Image, StyleSheet, TouchableWithoutFeedback,
  Animated, Platform, TouchableOpacity, Text,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { BlurView }        from 'expo-blur';
import { Ionicons }        from '@expo/vector-icons';
import { useRouter }       from 'expo-router';
import * as Haptics        from 'expo-haptics';

import RightBar   from './RightBar';
import BottomCard from './BottomCard';
import { P }      from './types';
import type { FeedFilm } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// expo-video — chargement conditionnel (natif uniquement)
// ─────────────────────────────────────────────────────────────────────────────
let _useVideoPlayer: any = () => ({
  play(){}, pause(){}, seekBy(){}, replace(){},
  duration: 0, currentTime: 0, muted: false,
  status: 'idle', playing: false,
});
let _useEvent:  any = (_p: any, _e: string, def: any) => def;
let _VideoView: any = () => null;

if (Platform.OS !== 'web') {
  try {
    const ev       = require('expo-video');
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
  film:           FeedFilm;
  isActive:       boolean;
  isNear:         boolean;
  screenFocused:  boolean;
  itemW:          number;
  itemH:          number;
  insetBot:       number;
  onFollowFriend: (fid: string) => void;
  onLike?:        (id: string) => void;
  onInfoPress?:   (film: FeedFilm) => void;
  onProgress?:    (p: { positionMs: number; durationMs: number }) => void;
  /** Appelé en fin de vidéo → l'écran parent scroll au reel suivant */
  onEnd?:         () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTEUR WEB — <video> natif, toutes features : seek + ended + reset
// ─────────────────────────────────────────────────────────────────────────────
interface WebVideoProps {
  src:           string;
  muted:         boolean;
  isActive:      boolean;
  screenFocused: boolean;
  itemW:         number;
  itemH:         number;
  onProgress:    (pct: number) => void;
  onTimeUpdate?: (posMs: number, durMs: number) => void;
  onReady:       () => void;
  onError:       () => void;
  onEnd:         () => void;
  /** Ref pour que FeedItem puisse déclencher un seek sans re-render */
  seekRef:       React.MutableRefObject<((t: number) => void) | null>;
  /** Ref pour exposer la durée totale */
  durationRef:   React.MutableRefObject<number>;
}

const WebVideoPlayer = memo(function WebVideoPlayer({
  src, muted, isActive, screenFocused,
  itemW, itemH,
  onProgress, onTimeUpdate, onReady, onError, onEnd,
  seekRef, durationRef,
}: WebVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);

  // Expose la fonction seek au parent via seekRef
  useEffect(() => {
    seekRef.current = (t: number) => {
      if (ref.current) ref.current.currentTime = t;
    };
    return () => { seekRef.current = null; };
  }, [seekRef]);

  // Play / pause / reset
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isActive && screenFocused) {
      v.play().catch(() => {});
    } else {
      v.pause();
      if (!isActive) v.currentTime = 0;   // reset propre
    }
  }, [isActive, screenFocused]);

  // Mute
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  // Listeners DOM (stables)
  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const onTime  = () => {
      if (v.duration > 0) {
        durationRef.current = v.duration;
        onProgress(v.currentTime / v.duration);
        onTimeUpdate?.(v.currentTime * 1000, v.duration * 1000);
      }
    };
    const onCan  = () => onReady();
    const onErr  = () => onError();
    const onEnded = () => { v.currentTime = 0; onEnd(); };  // reset + avance

    v.addEventListener('timeupdate', onTime);
    v.addEventListener('canplay',    onCan);
    v.addEventListener('error',      onErr);
    v.addEventListener('ended',      onEnded);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('canplay',    onCan);
      v.removeEventListener('error',      onErr);
      v.removeEventListener('ended',      onEnded);
    };
  }, [onProgress, onTimeUpdate, onReady, onError, onEnd, durationRef]);

  return React.createElement('video', {
    ref,
    src,
    autoPlay:    true,
    loop:        false,    // false : on gère onEnd manuellement
    playsInline: true,
    muted,
    style: {
      position:  'absolute', top: 0, left: 0,
      width: itemW, height: itemH,
      objectFit: 'cover', display: 'block', background: '#000',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FEEDITEM PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const FeedItem = memo(function FeedItem({
  film, isActive, isNear, screenFocused,
  itemW, itemH, insetBot,
  onFollowFriend, onLike, onInfoPress, onProgress, onEnd,
}: FeedItemProps) {
  const router = useRouter();
  const isWeb  = Platform.OS === 'web';

  const src: string | null =
    film.video_url?.trim().length > 0 ? film.video_url.trim() : null;

  // ─────────────────────────────────────────────────────────────────────────
  // NATIVE PLAYER
  // ─────────────────────────────────────────────────────────────────────────
  const player = _useVideoPlayer(
    isWeb ? null : (isNear ? src : null),
    (p: any) => {
      if (!p || isWeb) return;
      p.loop  = false;    // false → playToEnd déclenche l'auto-avance
      p.muted = false;
      try {
        p.bufferOptions = {
          preferredForwardBufferDuration:  10,
          preferredBackwardBufferDuration: 0,
        };
      } catch {}
    },
  );

  const { status }      = _useEvent(player, 'statusChange',  { status: player?.status  ?? 'idle'  });
  const { isPlaying }   = _useEvent(player, 'playingChange', { isPlaying: player?.playing ?? false });
  const { currentTime } = _useEvent(player, 'timeUpdate',    {
    currentTime: player?.currentTime ?? 0,
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });

  // playToEnd → auto-avance (loop=false garantit que cet event est émis)
  const { isPlaybackEnded } = _useEvent(player, 'playToEnd', { isPlaybackEnded: false });

  // ─────────────────────────────────────────────────────────────────────────
  // REFS
  // ─────────────────────────────────────────────────────────────────────────
  /** currentTime natif toujours frais — évite le stale sur le reset */
  const currentTimeRef = useRef(0);
  /** Fonction seek exposée par WebVideoPlayer (web only) */
  const webSeekRef     = useRef<((t: number) => void) | null>(null);
  /** Durée totale exposée par WebVideoPlayer */
  const webDurationRef = useRef<number>(0);

  // Sync ref natif à chaque event timeUpdate
  useEffect(() => {
    if (!isWeb) currentTimeRef.current = currentTime;
  }, [currentTime, isWeb]);

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [liked,       setLiked]       = useState(film.is_liked ?? false);
  const [muted,       setMuted]       = useState(false);
  const [saved,       setSaved]       = useState(film.is_saved ?? false);
  const [hasErr,      setHasErr]      = useState(false);
  const [nativeReady, setNativeReady] = useState(false);
  const [webReady,    setWebReady]    = useState(false);
  const [webProgress, setWebProgress] = useState(0);

  const isReady    = isWeb ? webReady : nativeReady;
  const showLoading = !!src && !isReady && !hasErr;

  // Durée native calculée depuis le player
  const nativeDuration = (!isWeb && player?.duration) ? player.duration : 0;
  const nativeProgress = nativeDuration > 0 ? Math.min(currentTime / nativeDuration, 1) : 0;
  const progress       = isWeb ? webProgress : nativeProgress;

  // ─────────────────────────────────────────────────────────────────────────
  // CHARGEMENT SOURCE — quand isNear devient true pour un player initialisé
  // avec null (tous les reels sauf le 1er au démarrage).
  // Sans cet effet, player.status reste 'idle' indéfiniment et
  // 'readyToPlay' n'est jamais émis → nativeReady reste false → pas de play.
  // ─────────────────────────────────────────────────────────────────────────
  const sourceLoaded = useRef(false);

  useEffect(() => {
    if (isWeb || !src || !player || sourceLoaded.current) return;
    if (isNear) {
      sourceLoaded.current = true;
      try { player.replace({ uri: src }); } catch {}
    }
  }, [isNear, isWeb, src, player]);

  // Reset quand on change de film
  useEffect(() => { sourceLoaded.current = false; }, [film.id]);

  // ─────────────────────────────────────────────────────────────────────────
  // STATUS NATIF
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isWeb) return;
    if (status === 'error')           { setHasErr(true);  setNativeReady(false); }
    else if (status === 'readyToPlay') { setNativeReady(true); setHasErr(false); }
  }, [status, isWeb]);

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-PLAY + RESET NATIF
  //
  // Quand isActive → true  : play depuis t=0 (reset d'abord si nécessaire)
  // Quand isActive → false : pause + reset à t=0 via currentTimeRef (frais)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isWeb || !src || !player) return;

    if (isActive && screenFocused && nativeReady) {
      // Reset propre avant de jouer (si on revient en arrière)
      const ct = currentTimeRef.current;
      if (ct > 0.2) {
        try { player.seekBy(-ct); } catch {}
      }
      // Petit délai pour laisser le seek s'appliquer
      const t = setTimeout(() => { try { player.play(); } catch {} }, 80);
      return () => clearTimeout(t);
    } else {
      try { player.pause(); } catch {}
      if (!isActive) {
        // Reset à t=0 avec la valeur fraîche du ref
        const ct = currentTimeRef.current;
        if (ct > 0.2) {
          try { player.seekBy(-ct); } catch {}
        }
      }
    }
  }, [isActive, screenFocused, nativeReady, player, src, isWeb]);

  // Sync mute natif
  useEffect(() => {
    if (isWeb || !player) return;
    try { player.muted = muted; } catch {}
  }, [muted, player, isWeb]);

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-AVANCE NATIF — playToEnd
  // ─────────────────────────────────────────────────────────────────────────
  const endFiredRef = useRef(false);  // évite le double-fire

  useEffect(() => {
    if (isWeb || !isPlaybackEnded || endFiredRef.current) return;
    endFiredRef.current = true;
    // Reset le player pour le prochain play
    try { player.seekBy(-(currentTimeRef.current)); } catch {}
    onEnd?.();
  }, [isPlaybackEnded, isWeb, player, onEnd]);

  // Reset le guard quand on change de reel
  useEffect(() => { endFiredRef.current = false; }, [film.id]);

  // ─────────────────────────────────────────────────────────────────────────
  // SEEK — fonction unifiée native + web
  // ─────────────────────────────────────────────────────────────────────────
  const handleSeek = useCallback((seconds: number) => {
    if (isWeb) {
      webSeekRef.current?.(seconds);
    } else if (player) {
      const delta = seconds - (currentTimeRef.current);
      try { player.seekBy(delta); } catch {}
    }
  }, [isWeb, player]);

  // ─────────────────────────────────────────────────────────────────────────
  // DISPATCH PROGRESSION (parent)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isWeb && nativeDuration > 0 && onProgress) {
      onProgress({ positionMs: currentTime * 1000, durationMs: nativeDuration * 1000 });
    }
  }, [currentTime, nativeDuration, isWeb, onProgress]);

  // ─────────────────────────────────────────────────────────────────────────
  // CALLBACKS WEB
  // ─────────────────────────────────────────────────────────────────────────
  const handleWebProgress  = useCallback((p: number) => setWebProgress(p), []);
  const handleWebReady     = useCallback(() => { setWebReady(true);  setHasErr(false);  }, []);
  const handleWebError     = useCallback(() => { setHasErr(true);    setWebReady(false); }, []);
  const handleWebTimeUpdate = useCallback((posMs: number, durMs: number) => {
    onProgress?.({ positionMs: posMs, durationMs: durMs });
  }, [onProgress]);
  const handleWebEnd       = useCallback(() => { onEnd?.(); }, [onEnd]);

  // ─────────────────────────────────────────────────────────────────────────
  // RETRY
  // ─────────────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setHasErr(false);
    setNativeReady(false);
    setWebReady(false);
    endFiredRef.current = false;
    if (!isWeb && src && player) {
      try { player.replace({ uri: src }); } catch {}
      setTimeout(() => { try { player.play(); } catch {} }, 200);
    }
  }, [isWeb, src, player]);

  // ─────────────────────────────────────────────────────────────────────────
  // DOUBLE TAP → like / single tap → play-pause
  // ─────────────────────────────────────────────────────────────────────────
  const lastTap   = useRef(0);
  const heartAnim = useRef(new Animated.Value(0)).current;

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 290) {
      // Double tap → like
      if (!liked) {
        setLiked(true);
        onLike?.(film.id);
        if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      Animated.sequence([
        Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 14 }),
        Animated.delay(520),
        Animated.timing(heartAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      // Single tap → play/pause
      if (!isWeb && player) {
        isPlaying ? player.pause() : player.play();
      }
    }
    lastTap.current = now;
  }, [liked, heartAnim, isPlaying, player, isWeb, film.id, onLike]);

  const heartScale = heartAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1.3, 1] });
  const heartOpac  = heartAnim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS BARRE DROITE
  // ─────────────────────────────────────────────────────────────────────────
  const handleLike = useCallback(() => {
    setLiked(p => {
      const next = !p;
      onLike?.(film.id);
      return next;
    });
  }, [film.id, onLike]);

  const handleMute  = useCallback(() => setMuted(p => !p), []);
  const handleSave  = useCallback(() => setSaved(p => !p), []);

  const handleInfo  = useCallback(() => {
    if (onInfoPress) onInfoPress(film);
    else router.push(`/film/${film.id}`);
  }, [film, router, onInfoPress]);

  // ─────────────────────────────────────────────────────────────────────────
  // DURÉE EXPOSÉE POUR BOTTOMCARD
  // ─────────────────────────────────────────────────────────────────────────
  const duration = isWeb ? webDurationRef.current : nativeDuration;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={{ width: itemW, height: itemH, backgroundColor: '#000', overflow: 'hidden' }}>

        {/* Poster — affiché pendant le chargement */}
        <Image
          source={{ uri: film.poster_url }}
          style={[StyleSheet.absoluteFill, { width: itemW, height: itemH }]}
          resizeMode="cover"
        />

        {/* ── LECTEUR WEB ────────────────────────────────────────────── */}
        {isWeb && !!src && !hasErr && (
          <WebVideoPlayer
            src={src}
            muted={muted}
            isActive={isActive}
            screenFocused={screenFocused}
            itemW={itemW}
            itemH={itemH}
            onProgress={handleWebProgress}
            onTimeUpdate={handleWebTimeUpdate}
            onReady={handleWebReady}
            onError={handleWebError}
            onEnd={handleWebEnd}
            seekRef={webSeekRef}
            durationRef={webDurationRef}
          />
        )}

        {/* ── LECTEUR NATIF ──────────────────────────────────────────── */}
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

        {/* ── LOADING ────────────────────────────────────────────────── */}
        {showLoading && (
          <View style={s.loadWrap} pointerEvents="none">
            <View style={s.loadRing}>
              <View style={s.loadDot} />
            </View>
          </View>
        )}

        {/* ── ERREUR ─────────────────────────────────────────────────── */}
        {hasErr && (
          <View style={s.errWrap}>
            <Ionicons name="warning-outline" size={38} color={P.primL} />
            <Text style={s.errTxt}>Impossible de charger la vidéo</Text>
            <TouchableOpacity onPress={handleRetry} style={s.retryBtn} activeOpacity={0.85}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={s.retryTxt}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── COEUR DOUBLE TAP ───────────────────────────────────────── */}
        <Animated.View
          style={[s.bigHeart, { opacity: heartOpac, transform: [{ scale: heartScale }] }]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={100} color={P.red} />
        </Animated.View>

        {/* ── INDICATEUR PAUSE ───────────────────────────────────────── */}
        {!isWeb && !isPlaying && nativeReady && (
          <View style={s.pauseWrap} pointerEvents="none">
            <BlurView intensity={22} tint="dark" style={s.pauseBlur}>
              <Ionicons name="pause" size={32} color="rgba(255,255,255,0.90)" />
            </BlurView>
          </View>
        )}

        {/* ── BARRE DROITE ───────────────────────────────────────────── */}
        <RightBar
          film={film}
          liked={liked}
          muted={muted}
          saved={saved}
          onLike={handleLike}
          onMute={handleMute}
          onInfo={handleInfo}
          onSave={handleSave}
        />

        {/* ── BOTTOM CARD + PROGRESS BAR SEEKABLE ────────────────────── */}
        {/*
          BottomCard reçoit :
            progress  → 0-1 pour la largeur de la barre
            duration  → durée totale en secondes (seek absolu)
            onSeek    → callback(seconds) pour repositionner la lecture
        */}
        <BottomCard
          reelId={film.id}
          progress={progress}
          duration={duration}
          onSeek={handleSeek}
        />

      </View>
    </TouchableWithoutFeedback>
  );
});

export default FeedItem;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Loading
  loadWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  loadRing: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: 'rgba(23,29,74,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  loadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(23,29,74,0.7)',
  },

  // Erreur
  errWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(7,0,15,0.78)', gap: 14,
  },
  errTxt:  { color: P.t2, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  retryTxt:{ color: '#fff', fontSize: 14, fontWeight: '700' },

  // Double tap heart
  bigHeart: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -50, marginLeft: -50,
  },

  // Pause indicator
  pauseWrap: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -32, marginLeft: -32,
  },
  pauseBlur: {
    width: 64, height: 64, borderRadius: 32,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
});