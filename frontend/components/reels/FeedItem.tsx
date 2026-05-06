/**
 * components/reels/FeedItem.tsx
 *
 * ── CAUSES IDENTIFIÉES DU POSTER FIGÉ ───────────────────────────────────────
 *
 *  A. useEvent importé depuis 'expo' → ne fonctionne PAS avec expo-video 2.x
 *     Doit venir de 'expo-video' directement.
 *
 *  B. player.replace({ uri: src }) → ignoré silencieusement sur certaines
 *     versions. La nouvelle API attend une string ou un objet VideoSource.
 *
 *  C. Architecture trop complexe : readyToPlay → pendingPlay → play()
 *     En expo-video 2.x, player.play() est une "intent" mise en queue.
 *     Il N'EST PAS nécessaire d'attendre readyToPlay pour appeler play().
 *     Le lecteur démarre dès qu'il est prêt, automatiquement.
 *
 * ── SOLUTION ────────────────────────────────────────────────────────────────
 *
 *  1. Source passée directement à useVideoPlayer (string).
 *     Quand isNear passe à true, la source change → expo-video charge.
 *     Quand isNear passe à false, source = null → expo-video libère.
 *
 *  2. isActive=true  → player.play()   (mis en queue par expo-video si pas prêt)
 *     isActive=false → player.pause()  + reset position
 *
 *  3. Crossfade poster basé sur l'événement isPlaying réel
 *     (pas sur un statut synthétique pendingPlay).
 *     Poster 1→0 quand la vidéo commence vraiment à jouer.
 *     Poster 0→1 quand la vidéo s'arrête.
 */

import React, {
  memo, useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Image, StyleSheet, Animated,
  Platform, TouchableOpacity, Text,
} from 'react-native';
import { BlurView }  from 'expo-blur';
import { Ionicons }  from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics  from 'expo-haptics';

import BottomCard from './BottomCard';
import { P } from './types';
import type { FeedFilm } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// expo-video — imports sécurisés
//
// CRITIQUE : useEvent doit venir de 'expo-video', PAS de 'expo'
// En expo-video 2.x, useEvent a été déplacé dans le package expo-video.
// ─────────────────────────────────────────────────────────────────────────────
let _useVideoPlayer: (source: any, setup?: (p: any) => void) => any =
  (_src: any, _cb?: any) => ({
    play(){}, pause(){}, seekBy(){},
    get duration(){ return 0; },
    get status(){ return ''; },
    muted: false,
  });

let _useEvent: (player: any, event: string, initial: any) => any =
  (_p: any, _e: string, def: any) => def;

let _VideoView: any = () => null;

if (Platform.OS !== 'web') {
  try {
    const expoVideo      = require('expo-video');
    _useVideoPlayer      = expoVideo.useVideoPlayer;
    _VideoView           = expoVideo.VideoView;
    // ★ FIX A : useEvent depuis expo-video, pas depuis expo
    _useEvent            = expoVideo.useEvent;
  } catch (e) {
    console.warn('[FeedItem] expo-video non disponible:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  film:     FeedFilm;
  isActive: boolean;
  isNear:   boolean;
  itemW:    number;
  itemH:    number;
  insetBot: number;
  onLike?:  (id: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = memo(function Spinner() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 900, useNativeDriver: true }),
    ).start();
    return () => rot.stopAnimation();
  }, [rot]);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={[fi.spinner, { transform: [{ rotate: spin }] }]} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// FeedItem
// ─────────────────────────────────────────────────────────────────────────────
const FeedItem = memo(function FeedItem({
  film, isActive, isNear, itemW, itemH, insetBot, onLike,
}: Props) {
  const router = useRouter();
  const isWeb  = Platform.OS === 'web';
  const src    = film.video_url?.trim() || null;

  // ── Source réactive ───────────────────────────────────────────────────────
  //
  // ★ FIX B+C : on passe la source DIRECTEMENT à useVideoPlayer
  //   • String (pas d'objet { uri }) — compatibilité maximale expo-video 2.x
  //   • isNear ? src : null → expo-video charge quand nécessaire, libère sinon
  //   • Quand isNear change, expo-video remplace la source en interne
  //   • PAS de player.replace() manuel nécessaire
  //
  const source = isWeb ? null : (isNear && src ? src : null);

  const player = _useVideoPlayer(source, (p: any) => {
    if (!p || isWeb) return;
    p.loop  = false;
    p.muted = false;
    try {
      p.bufferOptions = {
        preferredForwardBufferDuration:  12,
        preferredBackwardBufferDuration: 0,
      };
    } catch {}
  });

  // ── Events expo-video ─────────────────────────────────────────────────────
  // useEvent depuis expo-video (fix A)
  const { isPlaying }       = _useEvent(player, 'playingChange', { isPlaying: false });
  const { currentTime }     = _useEvent(player, 'timeUpdate',    {
    currentTime: 0, bufferedPosition: 0,
    currentLiveTimestamp: null, currentOffsetFromLive: null,
  });
  const { isPlaybackEnded } = _useEvent(player, 'playToEnd', { isPlaybackEnded: false });

  // ── Refs ──────────────────────────────────────────────────────────────────
  const currentTimeRef = useRef(0);
  const endFiredRef    = useRef(false);

  useEffect(() => { if (!isWeb) currentTimeRef.current = currentTime; }, [currentTime, isWeb]);

  // ── State UI ──────────────────────────────────────────────────────────────
  const [liked,       setLiked]       = useState(film.is_liked ?? false);
  const [muted,       setMuted]       = useState(false);
  const [hasErr,      setHasErr]      = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const nativeDur = !isWeb && player?.duration ? player.duration : 0;
  const progress  = nativeDur > 0 ? Math.min(currentTime / nativeDur, 1) : 0;

  // ── Poster overlay ────────────────────────────────────────────────────────
  const posterOp  = useRef(new Animated.Value(1)).current;
  const posterRef = useRef<Animated.CompositeAnimation>();

  const revealVideo = useCallback(() => {
    posterRef.current?.stop();
    posterRef.current = Animated.timing(posterOp, {
      toValue: 0, duration: 280, useNativeDriver: true,
    });
    posterRef.current.start();
  }, [posterOp]);

  const showPoster = useCallback((instant = false) => {
    posterRef.current?.stop();
    posterRef.current = Animated.timing(posterOp, {
      toValue: 1, duration: instant ? 0 : 160, useNativeDriver: true,
    });
    posterRef.current.start();
  }, [posterOp]);

  // ── Status listener (buffering + erreur UI uniquement) ────────────────────
  useEffect(() => {
    if (isWeb || !player) return;
    let sub: any;
    try {
      sub = player.addListener('statusChange', (ev: any) => {
        const raw  = ev?.status ?? ev;
        const stat = typeof raw === 'string' ? raw : (raw?.status ?? '');
        if (stat === 'loading')      setIsBuffering(true);
        if (stat === 'readyToPlay')  { setIsBuffering(false); setHasErr(false); }
        if (stat === 'error')        { setHasErr(true); setIsBuffering(false); }
        if (stat === 'idle')         setIsBuffering(false);
      });
    } catch {}
    return () => { try { sub?.remove(); } catch {} };
  }, [player, isWeb]);

  // ── Crossfade basé sur isPlaying réel ────────────────────────────────────
  //
  // On n'essaie plus de deviner quand la vidéo va jouer.
  // On réagit à ce qui se passe réellement :
  //   isPlaying=true  → la vidéo joue  → poster disparaît
  //   isPlaying=false → la vidéo s'arrête → poster réapparaît
  //
  useEffect(() => {
    if (isPlaying) revealVideo();
    else           showPoster();
  }, [isPlaying, revealVideo, showPoster]);

  // ── ★ AUTO-PLAY / AUTO-PAUSE — Le plus simple possible ★ ─────────────────
  //
  // En expo-video 2.x, player.play() est une INTENTION mise en file d'attente.
  // Pas besoin d'attendre readyToPlay : expo-video démarre dès que prêt.
  //
  // isActive=true  → play() en queue → démarre dès buffering OK
  // isActive=false → pause() immédiat + reset position
  //
  useEffect(() => {
    if (isWeb || !player) return;

    if (isActive) {
      try { player.play(); } catch (e) {
        console.warn('[FeedItem] play():', e);
      }
    } else {
      try { player.pause(); } catch {}
      // Reset position dans le tick suivant (évite conflit thread natif)
      const ct = currentTimeRef.current;
      const t  = setTimeout(() => {
        if (ct > 0.5) { try { player.seekBy(-ct); } catch {} }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isActive, player, isWeb]);

  // Mute
  useEffect(() => {
    if (isWeb || !player) return;
    try { player.muted = muted; } catch {}
  }, [muted, player, isWeb]);

  // Auto-avance fin de vidéo
  useEffect(() => {
    if (isWeb || !isPlaybackEnded || endFiredRef.current) return;
    endFiredRef.current = true;
    const ct = currentTimeRef.current;
    setTimeout(() => { try { player.seekBy(-ct); } catch {} }, 0);
  }, [isPlaybackEnded, isWeb, player]);

  // Reset quand film change
  useEffect(() => {
    endFiredRef.current = false;
    setHasErr(false);
    setIsBuffering(false);
    posterOp.setValue(1);
  }, [film.id, posterOp]);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const handleSeek = useCallback((s: number) => {
    if (!isWeb && player) { try { player.seekBy(s - currentTimeRef.current); } catch {} }
  }, [isWeb, player]);

  const handlePlayPause = useCallback(() => {
    if (!isWeb && player) {
      try { isPlaying ? player.pause() : player.play(); } catch {}
    }
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [isWeb, player, isPlaying]);

  const handleRetry = useCallback(() => {
    setHasErr(false);
    setIsBuffering(false);
    endFiredRef.current = false;
    posterOp.setValue(1);
    // La source est réactive → si isNear=true, le player rechargera automatiquement
    // via le changement de props. Pas besoin d'appeler replace() manuellement.
  }, [posterOp]);

  // ── Gestes (tiers gauche / centre / droite) ───────────────────────────────
  const heartAnim  = useRef(new Animated.Value(0)).current;
  const heartScale = heartAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1.3, 1] });
  const heartOpac  = heartAnim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });

  const triggerLike = useCallback(() => {
    if (!liked) {
      setLiked(true);
      onLike?.(film.id);
      if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 12 }),
      Animated.delay(480),
      Animated.timing(heartAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [liked, heartAnim, isWeb, film.id, onLike]);

  const tL = useRef(0), tC = useRef(0), tR = useRef(0);

  const onLeft = useCallback(() => {
    const n = Date.now();
    if (n - tL.current < 300) triggerLike();
    else if (!isWeb && player) { try { player.seekBy(-10); } catch {} }
    tL.current = n;
  }, [triggerLike, player, isWeb]);

  const onCenter = useCallback(() => {
    const n = Date.now();
    if (n - tC.current < 300) triggerLike();
    else handlePlayPause();
    tC.current = n;
  }, [triggerLike, handlePlayPause]);

  const onRight = useCallback(() => {
    const n = Date.now();
    if (n - tR.current < 300) triggerLike();
    else if (!isWeb && player) { try { player.seekBy(10); } catch {} }
    tR.current = n;
  }, [triggerLike, player, isWeb]);

  const handleLike = useCallback(() => {
    setLiked(p => !p);
    onLike?.(film.id);
  }, [film.id, onLike]);

  const handleMute = useCallback(() => setMuted(p => !p), []);

  const posterUri = film.poster_url?.trim()
    || `https://picsum.photos/seed/reel_${film.id}/400/700`;

  const zW = itemW / 3;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  //   1. Fond sombre
  //   2. VideoView natif (opacity=1 fixe, JAMAIS dans Animated.View)
  //   3. Image poster en overlay (fondu piloté par isPlaying)
  //   4. Zones de geste
  //   5. UI (spinner, erreur, pause, cœur, sidebar, bottomcard)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[fi.root, { width: itemW, height: itemH }]}>

      {/* 1 — Fond */}
      <View style={[StyleSheet.absoluteFill, fi.bg]} />

      {/* 2 — VideoView natif — JAMAIS dans Animated.View */}
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

      {/* 3 — Poster overlay (suit isPlaying via useEffect) */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: posterOp }]}
        pointerEvents="none"
      >
        <Image
          source={{ uri: posterUri }}
          style={{ width: itemW, height: itemH }}
          resizeMode="cover"
        />
        <View style={fi.posterGrad} />
      </Animated.View>

      {/* 4 — Zones de geste */}
      <TouchableOpacity style={[fi.zone, { left: 0 }]}    onPress={onLeft}   activeOpacity={1} />
      <TouchableOpacity style={[fi.zone, { left: zW }]}   onPress={onCenter} activeOpacity={1} />
      <TouchableOpacity style={[fi.zone, { left: zW*2 }]} onPress={onRight}  activeOpacity={1} />

      {/* 5a — Buffering */}
      {isActive && isBuffering && !hasErr && (
        <View style={fi.center} pointerEvents="none"><Spinner /></View>
      )}

      {/* 5b — Erreur */}
      {hasErr && (
        <View style={fi.errWrap}>
          <Ionicons name="warning-outline" size={32} color={P.hot} />
          <Text style={fi.errTxt}>Vidéo indisponible</Text>
          <TouchableOpacity onPress={handleRetry} style={fi.retryBtn}>
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={fi.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 5c — Indicateur pause (vidéo prête mais en pause) */}
      {isActive && !isPlaying && !isBuffering && !hasErr && isNear && !!src && (
        <View style={fi.center} pointerEvents="none">
          <BlurView intensity={18} tint="dark" style={fi.pauseBlur}>
            <Ionicons name="play" size={24} color="rgba(255,255,255,0.92)" style={{ marginLeft: 3 }} />
          </BlurView>
        </View>
      )}

      {/* 5d — Cœur double-tap */}
      <Animated.View
        style={[fi.heart, { opacity: heartOpac, transform: [{ scale: heartScale }] }]}
        pointerEvents="none"
      >
        <Ionicons name="heart" size={80} color={P.red} />
      </Animated.View>

      {/* 5e — Barre droite */}
      <View style={fi.sideBar} pointerEvents="box-none">
        <TouchableOpacity style={fi.sideBtn} onPress={handleLike}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? P.red : '#fff'} />
          <Text style={fi.sideBtnTxt}>{film.likes_count || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fi.sideBtn} onPress={handleMute}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={fi.sideBtn} onPress={() => router.push(`/film/${film.id}` as any)}>
          <Ionicons name="information-circle-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 5f — BottomCard */}
      <BottomCard
        reelId={film.id}
        title={film.title}
        director={film.director}
        genre={film.genre}
        year={film.year}
        likesCount={film.likes_count}
        viewsCount={film.views_count}
        progress={progress}
        duration={nativeDur}
        isReady={!isBuffering && !hasErr && isNear && !!src}
        insetBot={insetBot}
        onSeek={handleSeek}
      />
    </View>
  );
});

export default FeedItem;

const fi = StyleSheet.create({
  root:       { overflow: 'hidden' },
  bg:         { backgroundColor: '#07000F' },
  posterGrad: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  zone:     { position: 'absolute', top: 0, bottom: 0, width: '33.33%', zIndex: 10 },
  center:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  spinner:  {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2.5,
    borderColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.85)',
    borderRightColor: 'rgba(255,255,255,0.15)',
  },
  errWrap:  {
    ...StyleSheet.absoluteFillObject, zIndex: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(7,0,15,0.9)', gap: 10,
  },
  errTxt:   { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: P.primary, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  retryTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pauseBlur:{ width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  heart:    { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -40, zIndex: 20 },
  sideBar:  { position: 'absolute', right: 12, bottom: 120, alignItems: 'center', gap: 22, zIndex: 15 },
  sideBtn:  { alignItems: 'center', gap: 4 },
  sideBtnTxt:{ color: '#fff', fontSize: 12, fontWeight: '700' },
});