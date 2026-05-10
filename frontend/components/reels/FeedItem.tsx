/**
 * FeedItem.tsx — v FINAL
 *
 * CORRECTIF PRINCIPAL : callback setup stable au niveau module
 * ─────────────────────────────────────────────────────────────
 * Le bug "seule la 1ère vidéo joue" venait du callback inline :
 *
 *   _useVideoPlayer(src, (p) => { p.loop = false; ... })
 *                        ↑ fonction recréée à CHAQUE render
 *
 * expo-video détecte que le setup a changé → recrée le player
 * → la source est rechargée → la vidéo repart de zéro.
 *
 * FIX : callback défini UNE FOIS au niveau du module (jamais recréé).
 */

import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Animated, Platform, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }  from 'expo-blur';
import { Ionicons }  from '@expo/vector-icons';
import * as Haptics  from 'expo-haptics';

import BottomCard from './BottomCard';
import { P }      from './types';
import type { FeedFilm } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// ★ CALLBACK STABLE — jamais recréé → expo-video ne recrée pas le player
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

// ─────────────────────────────────────────────────────────────────────────────
// expo-video — natif uniquement
// ─────────────────────────────────────────────────────────────────────────────
let _useVideoPlayer: ((src: any, setup: any) => any) | null = null;
let _VideoView:      any = null;
let _useEvent:       (player: any, event: string, initial: any) => any =
  (_p, _e, d) => d;

if (Platform.OS !== 'web') {
  try {
    const ev     = require('expo-video');
    _useVideoPlayer = ev.useVideoPlayer;
    _VideoView      = ev.VideoView;
    _useEvent       = ev.useEvent ?? require('expo').useEvent;
  } catch (e) {
    console.warn('[FeedItem] expo-video:', e);
  }
}

// Hook stable : retourne null si expo-video absent (web)
const _nullHook = (_src: any, _setup: any) => null;
const _playerHook = _useVideoPlayer ?? _nullHook;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface FeedItemProps {
  film:          FeedFilm;
  isActive:      boolean;
  isNear:        boolean;
  screenFocused: boolean;
  itemW:         number;
  itemH:         number;
  insetBot:      number;
  onLike?:       (id: string) => void;
  onInfoPress?:  (f: FeedFilm) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = memo(function Spinner() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 800, useNativeDriver: true })
    );
    a.start();
    return () => a.stop();
  }, [rot]);
  const spin = rot.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] });
  return <Animated.View style={[fi.spinner, { transform:[{ rotate:spin }] }]} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// WebPlayer — <video> HTML pour Expo Web
// ─────────────────────────────────────────────────────────────────────────────
interface WebPlayerProps {
  src:      string;
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
  src, isActive, muted, itemW, itemH,
  onPlay, onTime, onWait, onErr, seekRef,
}: WebPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    seekRef.current = (t: number) => { if (ref.current) ref.current.currentTime = t; };
    return () => { seekRef.current = null; };
  }, [seekRef]);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    if (isActive) { v.currentTime = 0; v.play().catch(() => {}); }
    else          { v.pause();          v.currentTime = 0;        }
  }, [isActive]);

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
      position:'absolute', top:0, left:0,
      width:itemW, height:itemH,
      objectFit:'cover', background:'#000',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FeedItem
// ─────────────────────────────────────────────────────────────────────────────
const FeedItem = memo(function FeedItem({
  film, isActive, isNear, screenFocused,
  itemW, itemH, insetBot, onLike, onInfoPress,
}: FeedItemProps) {
  const isWeb = Platform.OS === 'web';
  const src   = film.video_url?.trim() || null;

  // ── Player natif ──────────────────────────────────────────────────────────
  // nativeSrc change selon isNear → expo-video charge/libère la source
  // setupPlayer est STABLE (module-level) → player jamais recréé par erreur
  const nativeSrc = !isWeb && isNear && src ? src : null;
  const player    = _playerHook(nativeSrc, setupPlayer);

  // Events (depuis expo-video OU expo selon la version)
  const { isPlaying: nativePlaying } = _useEvent(
    player, 'playingChange', { isPlaying: false }
  );
  const { currentTime: nativeCT } = _useEvent(
    player, 'timeUpdate',
    { currentTime:0, bufferedPosition:0, currentLiveTimestamp:null, currentOffsetFromLive:null }
  );
  const { isPlaybackEnded } = _useEvent(
    player, 'playToEnd', { isPlaybackEnded: false }
  );

  // ── State ─────────────────────────────────────────────────────────────────
  const [liked,     setLiked]     = useState(film.is_liked  ?? false);
  const [muted,     setMuted]     = useState(false);
  const [saved,     setSaved]     = useState(film.is_saved  ?? false);
  const [buffering, setBuffering] = useState(true);
  const [hasErr,    setHasErr]    = useState(false);
  const [webPlaying,setWebPlaying]= useState(false);
  const [webCT,     setWebCT]     = useState(0);
  const [webDur,    setWebDur]    = useState(0);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const ctRef   = useRef(0);
  const endRef  = useRef(false);
  const seekRef = useRef<((t: number) => void) | null>(null);

  // currentTime synchrone
  useEffect(() => {
    if (!isWeb) ctRef.current = nativeCT;
    else        ctRef.current = webCT;
  }, [nativeCT, webCT, isWeb]);

  // ── Métriques ─────────────────────────────────────────────────────────────
  const playing  = isWeb ? webPlaying : nativePlaying;
  const dur      = isWeb ? webDur : (player?.duration ?? 0);
  const progress = dur > 0 ? Math.min(ctRef.current / dur, 1) : 0;

  // ── Status listener (natif) ───────────────────────────────────────────────
  useEffect(() => {
    if (isWeb || !player?.addListener) return;
    let sub: any;
    try {
      sub = player.addListener('statusChange', (ev: any) => {
        const st = typeof ev?.status === 'string'
          ? ev.status : (ev?.status?.status ?? '');
        if (st === 'loading')     setBuffering(true);
        if (st === 'readyToPlay') { setBuffering(false); setHasErr(false); }
        if (st === 'error')       { setHasErr(true);     setBuffering(false); }
        if (st === 'idle')        setBuffering(false);
      });
    } catch {}
    return () => { try { sub?.remove(); } catch {} };
  }, [player, isWeb]);

  // ── ★ AUTO-PLAY / AUTO-PAUSE ★ ────────────────────────────────────────────
  //
  //   isActive=true  → play() — expo-video met en queue si pas encore prêt
  //   isActive=false → pause() + reset t=0
  //
  //   Note : player est dans les deps MAIS ne change pas entre renders
  //   puisque le setupPlayer stable empêche expo-video de le recréer.
  useEffect(() => {
    if (isWeb || !player) return;
    if (isActive && screenFocused) {
      try { player.play(); } catch {}
    } else {
      try { player.pause(); } catch {}
      const ct = ctRef.current;
      if (ct > 0.3) {
        // Tick suivant pour ne pas bloquer le thread natif
        setTimeout(() => { try { player.seekBy(-ct); } catch {} }, 0);
      }
    }
  }, [isActive, screenFocused, player, isWeb]);

  // Mute natif
  useEffect(() => {
    if (isWeb || !player) return;
    try { player.muted = muted; } catch {}
  }, [muted, player, isWeb]);

  // Fin de vidéo → retour t=0
  useEffect(() => {
    if (isWeb || !isPlaybackEnded || endRef.current || !player) return;
    endRef.current = true;
    try { player.seekBy(-ctRef.current); } catch {}
  }, [isPlaybackEnded, isWeb, player]);

  // Reset sur changement de film
  useEffect(() => {
    endRef.current = false;
    setHasErr(false); setBuffering(true);
    setWebPlaying(false); setWebCT(0); setWebDur(0);
  }, [film.id]);

  // ── Callbacks Web ─────────────────────────────────────────────────────────
  const onWebPlay  = useCallback((v: boolean) => { setWebPlaying(v); setBuffering(false); }, []);
  const onWebTime  = useCallback((ct: number, d: number) => { setWebCT(ct); setWebDur(d); }, []);
  const onWebWait  = useCallback((v: boolean) => setBuffering(v), []);
  const onWebErr   = useCallback(() => { setHasErr(true); setBuffering(false); }, []);

  // ── Seek ─────────────────────────────────────────────────────────────────
  const handleSeek = useCallback((sec: number) => {
    if (isWeb) {
      seekRef.current?.(sec);
    } else if (player) {
      try { player.seekBy(sec - ctRef.current); } catch {}
    }
  }, [isWeb, player]);

  const handlePlayPause = useCallback(() => {
    if (!isWeb && player) {
      try { playing ? player.pause() : player.play(); } catch {}
    }
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [isWeb, player, playing]);

  // ── Skip ±10s ─────────────────────────────────────────────────────────────
  const leftBadge  = useRef(new Animated.Value(0)).current;
  const rightBadge = useRef(new Animated.Value(0)).current;

  const flash = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue:1, duration:80,  useNativeDriver:true }),
      Animated.delay(350),
      Animated.timing(anim, { toValue:0, duration:200, useNativeDriver:true }),
    ]).start();
  }, []);

  const skip = useCallback((d: number) => {
    handleSeek(Math.max(0, Math.min(dur, ctRef.current + d)));
    d < 0 ? flash(leftBadge) : flash(rightBadge);
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [dur, handleSeek, flash, leftBadge, rightBadge, isWeb]);

  // ── Like + cœur ───────────────────────────────────────────────────────────
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

  // Zones de geste : double-tap = like / tap simple = action
  const tL = useRef(0), tC = useRef(0), tR = useRef(0);
  const tapL = useCallback(() => { const n=Date.now(); n-tL.current<300 ? doLike() : skip(-10); tL.current=n; }, [doLike, skip]);
  const tapC = useCallback(() => { const n=Date.now(); n-tC.current<300 ? doLike() : handlePlayPause(); tC.current=n; }, [doLike, handlePlayPause]);
  const tapR = useCallback(() => { const n=Date.now(); n-tR.current<300 ? doLike() : skip(10);  tR.current=n; }, [doLike, skip]);

  const zW = itemW / 3;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[fi.root, { width:itemW, height:itemH }]}>

      {/* Fond noir */}
      <View style={[StyleSheet.absoluteFill, fi.bg]} />

      {/* VideoView NATIF — jamais dans Animated.View */}
      {!isWeb && isNear && !!src && !hasErr && _VideoView && player && (
        <_VideoView
          player={player}
          style={[StyleSheet.absoluteFill, { width:itemW, height:itemH }]}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      )}

      {/* Web <video> */}
      {isWeb && !!src && !hasErr && (
        <WebPlayer
          src={src}
          isActive={isActive && screenFocused}
          muted={muted}
          itemW={itemW} itemH={itemH}
          onPlay={onWebPlay} onTime={onWebTime}
          onWait={onWebWait} onErr={onWebErr}
          seekRef={seekRef}
        />
      )}

      {/* URL manquante */}
      {!src && (
        <View style={fi.diagBox} pointerEvents="none">
          <Ionicons name="videocam-off-outline" size={36} color="rgba(255,255,255,0.25)" />
          <Text style={fi.diagTxt}>video_url vide dans public.reels</Text>
        </View>
      )}

      {/* Gradient bas */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
        locations={[0.30, 0.68, 1]}
        style={fi.grad}
        pointerEvents="none"
      />

      {/* Zones de geste */}
      <TouchableOpacity style={[fi.zone, { left:0    }]} onPress={tapL} activeOpacity={1} />
      <TouchableOpacity style={[fi.zone, { left:zW   }]} onPress={tapC} activeOpacity={1} />
      <TouchableOpacity style={[fi.zone, { left:zW*2 }]} onPress={tapR} activeOpacity={1} />

      {/* Buffering */}
      {isActive && buffering && !hasErr && !!src && (
        <View style={fi.center} pointerEvents="none"><Spinner /></View>
      )}

      {/* Erreur */}
      {hasErr && (
        <View style={fi.errBox}>
          <Ionicons name="warning-outline" size={34} color={P.hot} />
          <Text style={fi.errTxt}>Impossible de lire la vidéo</Text>
          <Text style={fi.errUrl} numberOfLines={1}>{src}</Text>
          <TouchableOpacity style={fi.retryBtn}
            onPress={() => { setHasErr(false); setBuffering(true); }}>
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={fi.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Indicateur pause */}
      {isActive && !playing && !buffering && !hasErr && !!src && (
        <View style={fi.center} pointerEvents="none">
          <BlurView intensity={22} tint="dark" style={fi.pauseCircle}>
            <Ionicons name="play" size={26} color="rgba(255,255,255,0.92)" style={{ marginLeft:3 }} />
          </BlurView>
        </View>
      )}

      {/* Badges skip */}
      <Animated.View style={[fi.badge, { opacity:leftBadge,  left:16,  top:itemH*0.45 }]} pointerEvents="none">
        <BlurView intensity={40} tint="dark" style={fi.badgeBlur}>
          <Ionicons name="play-back" size={15} color="#fff" />
          <Text style={fi.badgeTxt}>-10s</Text>
        </BlurView>
      </Animated.View>
      <Animated.View style={[fi.badge, { opacity:rightBadge, right:16, top:itemH*0.45 }]} pointerEvents="none">
        <BlurView intensity={40} tint="dark" style={fi.badgeBlur}>
          <Ionicons name="play-forward" size={15} color="#fff" />
          <Text style={fi.badgeTxt}>+10s</Text>
        </BlurView>
      </Animated.View>

      {/* Cœur */}
      <Animated.View style={[fi.heart, { opacity:heartAlpha, transform:[{ scale:heartScale }] }]} pointerEvents="none">
        <Ionicons name="heart" size={90} color={P.red} />
      </Animated.View>

      {/* Sidebar droite */}
      <View style={fi.sidebar} pointerEvents="box-none">

        <TouchableOpacity style={fi.sBtn}
          onPress={() => { setLiked(p => { onLike?.(film.id); return !p; }); }}>
          <View style={[fi.sIcon, liked && fi.sIconOn]}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? P.red : '#fff'} />
          </View>
          <Text style={fi.sLbl}>{fmtN(film.likes_count)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={fi.sBtn} onPress={() => setMuted(p=>!p)}>
          <View style={[fi.sIcon, muted && fi.sIconOn]}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={23} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={fi.sBtn} onPress={() => setSaved(p=>!p)}>
          <View style={[fi.sIcon, saved && fi.sIconOn]}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={23} color={saved ? P.gold : '#fff'} />
          </View>
        </TouchableOpacity>

        {onInfoPress && (
          <TouchableOpacity style={fi.sBtn} onPress={() => onInfoPress(film)}>
            <View style={fi.sIcon}>
              <Ionicons name="information-circle-outline" size={24} color="rgba(255,255,255,0.75)" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* BottomCard */}
      <BottomCard
        film={film}
        progress={progress}
        duration={dur}
        isReady={!buffering && !hasErr && !!src}
        insetBot={insetBot}
        onSeek={handleSeek}
      />
    </View>
  );
});

export default FeedItem;

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n/1_000)}K`;
  return String(n || 0);
}

const fi = StyleSheet.create({
  root:       { overflow:'hidden' },
  bg:         { backgroundColor:'#000' },
  grad:       { position:'absolute', bottom:0, left:0, right:0, height:'62%' },
  zone:       { position:'absolute', top:0, bottom:0, width:'33.33%', zIndex:10 },
  center:     { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center', zIndex:20 },
  spinner: {
    width:38, height:38, borderRadius:19, borderWidth:3,
    borderColor:'transparent',
    borderTopColor:'rgba(255,255,255,0.90)',
    borderRightColor:'rgba(255,255,255,0.20)',
  },
  diagBox:    { ...StyleSheet.absoluteFillObject, zIndex:5, alignItems:'center', justifyContent:'center', gap:10 },
  diagTxt:    { color:'rgba(255,255,255,0.35)', fontSize:13, textAlign:'center' },
  errBox:     { ...StyleSheet.absoluteFillObject, zIndex:20, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(0,0,0,0.88)', gap:12, padding:32 },
  errTxt:     { color:'rgba(255,255,255,0.70)', fontSize:14, fontWeight:'600' },
  errUrl:     { color:'rgba(255,255,255,0.28)', fontSize:10, textAlign:'center' },
  retryBtn:   { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:P.primary, borderRadius:12, paddingHorizontal:18, paddingVertical:10 },
  retryTxt:   { color:'#fff', fontSize:13, fontWeight:'700' },
  pauseCircle:{ width:60, height:60, borderRadius:30, overflow:'hidden', alignItems:'center', justifyContent:'center' },
  badge:      { position:'absolute', zIndex:20 },
  badgeBlur:  { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14, paddingVertical:9, borderRadius:20, overflow:'hidden', borderWidth:1, borderColor:'rgba(255,255,255,0.14)' },
  badgeTxt:   { color:'#fff', fontSize:14, fontWeight:'800' },
  heart:      { position:'absolute', top:'50%', left:'50%', marginTop:-45, marginLeft:-45, zIndex:20 },
  sidebar:    { position:'absolute', right:14, bottom:170, alignItems:'center', gap:20, zIndex:15 },
  sBtn:       { alignItems:'center', gap:4 },
  sIcon:      { width:50, height:50, borderRadius:25, backgroundColor:'rgba(0,0,0,0.40)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  sIconOn:    { backgroundColor:'rgba(146,64,214,0.32)', borderColor:'rgba(146,64,214,0.55)' },
  sLbl:       { color:'rgba(255,255,255,0.78)', fontSize:12, fontWeight:'700' },
});