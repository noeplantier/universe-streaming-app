/**
 * components/reels/FeedItem.tsx
 *
 * Priorité absolue : LECTURE VIDÉO FIABLE
 *
 * Architecture simplifiée au maximum :
 *
 *   COUCHE 1 — fond sombre
 *   COUCHE 2 — VideoView natif (opacity=1 fixe, JAMAIS wrappé)
 *   COUCHE 3 — Image poster en overlay (fondu 1→0 révèle la vidéo)
 *   COUCHE 4 — Zones de geste (gauche / centre / droite)
 *   COUCHE 5 — UI (spinner, erreur, indicateur pause, like, BottomCard)
 *
 * Auto-play garanti — pattern pendingPlay :
 *
 *   isActive=true
 *     → replace(src) si pas encore chargé
 *     → si readyToPlay  → play() + revealVideo() immédiat
 *     → sinon           → pendingPlay=true → déclenché par statusChange
 *
 *   statusChange → 'readyToPlay'
 *     → si pendingPlay || isActive → play() + revealVideo()
 *
 *   isActive=false
 *     → showPoster() → pause() après 160ms → seekBy(-t) après pause
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
// expo-video — chargement conditionnel (web safe)
// ─────────────────────────────────────────────────────────────────────────────
let _useVideoPlayer: any = (_: any, __: any) => ({
  play(){}, pause(){}, seekBy(){}, replace(){},
  addListener(){ return { remove(){} }; },
  get duration(){ return 0; },
  muted: false, playing: false,
});
let _useEvent:  any = (_p: any, _e: string, def: any) => def;
let _VideoView: any = () => null;

if (Platform.OS !== 'web') {
  try {
    const ev = require('expo-video');
    _useVideoPlayer = ev.useVideoPlayer;
    _VideoView      = ev.VideoView;
    _useEvent       = require('expo').useEvent;
  } catch (e) { console.warn('[FeedItem] expo-video:', e); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  film:     FeedFilm;
  isActive: boolean;   // cette slide est centrée + écran visible
  isNear:   boolean;   // ±1 slide → préchargement
  itemW:    number;
  itemH:    number;
  insetBot: number;
  onLike?:  (id: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner de buffering
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = memo(function Spinner() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(rot, {
      toValue: 1, duration: 900, useNativeDriver: true,
    })).start();
  }, [rot]);
  return (
    <Animated.View style={[fi.spinner, {
      transform: [{ rotate: rot.interpolate({ inputRange: [0,1], outputRange: ['0deg','360deg'] }) }],
    }]} />
  );
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

  // ── Poster overlay — Animated.Value ──────────────────────────────────────
  // 1 = poster visible (couvre la vidéo)
  // 0 = poster transparent (vidéo visible)
  const posterOp   = useRef(new Animated.Value(1)).current;
  const animRef    = useRef<Animated.CompositeAnimation>();

  const revealVideo = useCallback(() => {
    animRef.current?.stop();
    animRef.current = Animated.timing(posterOp, {
      toValue: 0, duration: 280, useNativeDriver: true,
    });
    animRef.current.start();
  }, [posterOp]);

  const showPoster = useCallback((fast = false) => {
    animRef.current?.stop();
    animRef.current = Animated.timing(posterOp, {
      toValue: 1, duration: fast ? 0 : 160, useNativeDriver: true,
    });
    animRef.current.start();
  }, [posterOp]);

  // ── Player — TOUJOURS null au départ ─────────────────────────────────────
  // Ne pas passer src directement à useVideoPlayer :
  // expo-video crée le player UNE FOIS avec la valeur initiale.
  // replace() via useEffect est le seul moyen fiable de charger la source.
  const player = _useVideoPlayer(null, (p: any) => {
    if (!p || isWeb) return;
    p.loop  = false;
    p.muted = false;
    try {
      p.bufferOptions = {
        preferredForwardBufferDuration:  10,
        preferredBackwardBufferDuration: 0,
      };
    } catch {}
  });

  // Événements expo-video
  const { isPlaying }       = _useEvent(player, 'playingChange', { isPlaying: false });
  const { currentTime }     = _useEvent(player, 'timeUpdate', {
    currentTime: 0, bufferedPosition: 0,
    currentLiveTimestamp: null, currentOffsetFromLive: null,
  });
  const { isPlaybackEnded } = _useEvent(player, 'playToEnd', { isPlaybackEnded: false });

  // ── Refs synchrones (pas de stale closure) ───────────────────────────────
  const currentTimeRef  = useRef(0);
  const isActiveRef     = useRef(isActive);
  const replacedRef     = useRef(false);   // replace() appelé ?
  const pendingPlayRef  = useRef(false);   // play() en attente de readyToPlay ?
  const statusRef       = useRef('');      // dernier status connu
  const endFiredRef     = useRef(false);

  isActiveRef.current = isActive;
  useEffect(() => {
    if (!isWeb) currentTimeRef.current = currentTime;
  }, [currentTime, isWeb]);

  // ── State UI ──────────────────────────────────────────────────────────────
  const [liked,       setLiked]       = useState(film.is_liked ?? false);
  const [muted,       setMuted]       = useState(false);
  const [hasErr,      setHasErr]      = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const nativeDur  = !isWeb && player?.duration ? player.duration : 0;
  const progress   = nativeDur > 0 ? Math.min(currentTime / nativeDur, 1) : 0;
  const isReady    = statusRef.current === 'readyToPlay' && !hasErr;

  // ── ÉTAPE 1 : Chargement source quand isNear ─────────────────────────────
  useEffect(() => {
    if (isWeb || !src || !player || replacedRef.current || !isNear) return;
    replacedRef.current = true;
    try { player.replace({ uri: src }); } catch (e) {
      console.warn('[FeedItem] replace:', e);
    }
  }, [isNear, isWeb, src, player]);

  // ── ÉTAPE 2 : Reset quand le film change ─────────────────────────────────
  useEffect(() => {
    replacedRef.current  = false;
    pendingPlayRef.current = false;
    endFiredRef.current  = false;
    statusRef.current    = '';
    setHasErr(false); setIsBuffering(false);
    posterOp.setValue(1);   // poster visible immédiatement
  }, [film.id, posterOp]);

  // ── ÉTAPE 3 : statusChange listener ──────────────────────────────────────
  // play() n'est appelé QUE depuis ici (readyToPlay confirmé)
  // ou directement si le lecteur est déjà prêt (voir étape 4).
  useEffect(() => {
    if (isWeb || !player) return;
    let sub: any;
    try {
      sub = player.addListener('statusChange', (ev: any) => {
        const raw  = ev?.status ?? ev;
        const stat = typeof raw === 'string' ? raw : (raw?.status ?? '');
        statusRef.current = stat;

        if (stat === 'loading')      { setIsBuffering(true); }
        if (stat === 'idle')         { setIsBuffering(false); }
        if (stat === 'error')        { setHasErr(true); setIsBuffering(false); pendingPlayRef.current = false; }

        if (stat === 'readyToPlay') {
          setIsBuffering(false); setHasErr(false);
          // ★ Déclenchement garanti si isActive était true avant readyToPlay
          if (pendingPlayRef.current || isActiveRef.current) {
            pendingPlayRef.current = false;
            try { player.play(); } catch {}
            revealVideo();
          }
        }
      });
    } catch (e) { console.warn('[FeedItem] listener:', e); }
    return () => { try { sub?.remove(); } catch {} };
  }, [player, isWeb, revealVideo]);

  // ── ÉTAPE 4 : Auto-play / Auto-pause sur changement de isActive ──────────
  useEffect(() => {
    if (isWeb || !player) return;

    if (isActive) {
      // Charger la source si pas encore fait (cas slide 0 au mount)
      if (!replacedRef.current && src) {
        replacedRef.current = true;
        try { player.replace({ uri: src }); } catch {}
      }

      if (statusRef.current === 'readyToPlay') {
        // Prêt → play immédiat
        pendingPlayRef.current = false;
        try { player.play(); } catch {}
        revealVideo();
      } else {
        // Pas encore prêt → pendingPlay déclenchera depuis statusChange
        pendingPlayRef.current = true;
      }
    } else {
      // ── Séquence pause sans glitch ───────────────────────────────────────
      // 1. Poster visible (visuellement instantané)
      pendingPlayRef.current = false;
      showPoster();
      // 2. Pause après le fondu (évite glitch audio/image)
      const t = setTimeout(() => {
        try { player.pause(); } catch {}
        // 3. Reset à t=0 dans le prochain tick
        const ct = currentTimeRef.current;
        setTimeout(() => {
          if (ct > 0.3) { try { player.seekBy(-ct); } catch {} }
        }, 0);
      }, 160);
      return () => clearTimeout(t);
    }
  }, [isActive, player, isWeb, src, revealVideo, showPoster]);

  // Mute
  useEffect(() => {
    if (isWeb || !player) return;
    try { player.muted = muted; } catch {}
  }, [muted, player, isWeb]);

  // Auto-avance fin de vidéo
  useEffect(() => {
    if (isWeb || !isPlaybackEnded || endFiredRef.current) return;
    endFiredRef.current = true;
    try { player.seekBy(-currentTimeRef.current); } catch {}
  }, [isPlaybackEnded, isWeb, player]);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const handleSeek = useCallback((s: number) => {
    if (player && !isWeb) { try { player.seekBy(s - currentTimeRef.current); } catch {} }
  }, [isWeb, player]);

  // ── Play/pause manuel (tap centre) ───────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    if (!isWeb && player) { try { isPlaying ? player.pause() : player.play(); } catch {} }
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [isWeb, player, isPlaying]);

  // ── Retry ─────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setHasErr(false); setIsBuffering(false);
    replacedRef.current   = false;
    pendingPlayRef.current = false;
    statusRef.current     = '';
    endFiredRef.current   = false;
    posterOp.setValue(1);
    if (!isWeb && src && player) {
      try { player.replace({ uri: src }); } catch {}
    }
  }, [isWeb, src, player, posterOp]);

  // ── Gestes ────────────────────────────────────────────────────────────────
  const heartAnim  = useRef(new Animated.Value(0)).current;
  const heartScale = heartAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1.3, 1] });
  const heartOpac  = heartAnim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });

  const triggerLike = useCallback(() => {
    if (!liked) {
      setLiked(true); onLike?.(film.id);
      if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 12 }),
      Animated.delay(480),
      Animated.timing(heartAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [liked, heartAnim, isWeb, film.id, onLike]);

  const tL = useRef(0), tC = useRef(0), tR = useRef(0);

  const onLeft   = useCallback(() => {
    const n = Date.now();
    if (n - tL.current < 300) triggerLike();
    else if (player && !isWeb) { try { player.seekBy(-10); } catch {} }
    tL.current = n;
  }, [triggerLike, player, isWeb]);

  const onCenter = useCallback(() => {
    const n = Date.now();
    if (n - tC.current < 300) triggerLike();
    else handlePlayPause();
    tC.current = n;
  }, [triggerLike, handlePlayPause]);

  const onRight  = useCallback(() => {
    const n = Date.now();
    if (n - tR.current < 300) triggerLike();
    else if (player && !isWeb) { try { player.seekBy(10); } catch {} }
    tR.current = n;
  }, [triggerLike, player, isWeb]);

  const handleLike = useCallback(() => {
    setLiked(p => !p); onLike?.(film.id);
  }, [film.id, onLike]);

  const handleMute = useCallback(() => setMuted(p => !p), []);

  // Poster URL garanti non-vide
  const posterUri = film.poster_url?.trim()
    || `https://picsum.photos/seed/reel_${film.id}/400/700`;

  const zW = itemW / 3;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[fi.root, { width: itemW, height: itemH }]}>

      {/* 1 — Fond */}
      <View style={[StyleSheet.absoluteFill, fi.bg]} />

      {/* 2 — VideoView NATIF — JAMAIS dans Animated.View */}
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

      {/* 3 — Poster overlay (crossfade : opacity 1→0 révèle la vidéo) */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: posterOp }]}
        pointerEvents="none"
      >
        <Image source={{ uri: posterUri }} style={{ width: itemW, height: itemH }} resizeMode="cover" />
        {/* Dégradé bas pour lisibilité du texte sur le poster */}
        <View style={fi.posterGrad} />
      </Animated.View>

      {/* 4 — Zones de geste */}
      <TouchableOpacity style={[fi.zone, { left: 0 }]}    onPress={onLeft}   activeOpacity={1} hitSlop={{ top: 0, bottom: 0, left: 0, right: 0 }} />
      <TouchableOpacity style={[fi.zone, { left: zW }]}   onPress={onCenter} activeOpacity={1} />
      <TouchableOpacity style={[fi.zone, { left: zW*2 }]} onPress={onRight}  activeOpacity={1} />

      {/* 5 — Buffering spinner */}
      {isActive && isBuffering && !hasErr && (
        <View style={fi.center} pointerEvents="none">
          <Spinner />
        </View>
      )}

      {/* 6 — Erreur */}
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

      {/* 7 — Indicateur pause (visible seulement si actif + en pause manuelle) */}
      {isActive && !isPlaying && !isBuffering && !hasErr && statusRef.current === 'readyToPlay' && (
        <View style={fi.center} pointerEvents="none">
          <BlurView intensity={18} tint="dark" style={fi.pauseBlur}>
            <Ionicons name="play" size={24} color="rgba(255,255,255,0.92)" style={{ marginLeft: 3 }} />
          </BlurView>
        </View>
      )}

      {/* 8 — Cœur double-tap */}
      <Animated.View
        style={[fi.heart, { opacity: heartOpac, transform: [{ scale: heartScale }] }]}
        pointerEvents="none"
      >
        <Ionicons name="heart" size={80} color={P.red} />
      </Animated.View>

      {/* 9 — Actions droite */}
      <View style={fi.sideBar} pointerEvents="box-none">
        {/* Like */}
        <TouchableOpacity style={fi.sideBtn} onPress={handleLike}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? P.red : '#fff'} />
          <Text style={fi.sideBtnTxt}>{film.likes_count || 0}</Text>
        </TouchableOpacity>

        {/* Mute */}
        <TouchableOpacity style={fi.sideBtn} onPress={handleMute}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={24} color="#fff" />
        </TouchableOpacity>

        {/* Info film */}
        <TouchableOpacity style={fi.sideBtn} onPress={() => router.push(`/film/${film.id}` as any)}>
          <Ionicons name="information-circle-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 10 — BottomCard (métadonnées + seek) */}
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
        isReady={isReady}
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
  posterGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
                backgroundColor: 'rgba(0,0,0,0.40)' },

  // zones de geste (tiers horizontaux, plein écran vertical)
  zone: { position: 'absolute', top: 0, bottom: 0, width: '33.33%', zIndex: 10 },

  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 20 },

  spinner: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2.5,
    borderColor: 'transparent',
    borderTopColor:   'rgba(255,255,255,0.85)',
    borderRightColor: 'rgba(255,255,255,0.15)',
  },

  errWrap:  { ...StyleSheet.absoluteFillObject, zIndex: 20,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(7,0,15,0.88)', gap: 10 },
  errTxt:   { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 7,
              backgroundColor: P.primary, borderRadius: 10,
              paddingHorizontal: 16, paddingVertical: 9 },
  retryTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  pauseBlur: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden',
               alignItems: 'center', justifyContent: 'center' },

  heart: { position: 'absolute', top: '50%', left: '50%',
           marginTop: -40, marginLeft: -40, zIndex: 20 },

  // Barre d'actions droite (like, mute, info)
  sideBar: {
    position: 'absolute', right: 12, bottom: 120,
    alignItems: 'center', gap: 22, zIndex: 15,
  },
  sideBtn:    { alignItems: 'center', gap: 4 },
  sideBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
});