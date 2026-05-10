/**
 * FeedItem.tsx
 *
 * Fonctionne sur WEB (HTML <video>) et NATIF (expo-video).
 * Résout automatiquement les chemins Supabase Storage → URL publique.
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
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// expo-video — natif uniquement
// ─────────────────────────────────────────────────────────────────────────────
let _useVideoPlayer: any = null;
let _VideoView:      any = null;
let _useEvent:       any = (_p: any, _e: string, d: any) => d;

if (Platform.OS !== 'web') {
  try {
    const ev     = require('expo-video');
    _useVideoPlayer = ev.useVideoPlayer;
    _VideoView      = ev.VideoView;
    // useEvent depuis expo-video OU depuis expo (selon la version)
    _useEvent = ev.useEvent ?? require('expo').useEvent;
  } catch (e) {
    console.warn('[FeedItem] expo-video non disponible:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Résolution URL Supabase Storage
// Si video_url est déjà https:// → utilisé tel quel
// Si c'est un chemin relatif → converti en URL publique
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://knrzbdqfflobfjdmqyte.supabase.co';
// Nom de ton bucket vidéo (vérifie dans Supabase → Storage)
const VIDEO_BUCKET = 'community-images';

function resolveUrl(raw: string): string {
  if (!raw || raw.trim() === '') return '';
  const url = raw.trim();

  // Déjà une URL complète
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  // Chemin Storage relatif → URL publique
  try {
    const { data } = supabase.storage
      .from(VIDEO_BUCKET)
      .getPublicUrl(url);
    return data?.publicUrl ?? '';
  } catch {
    return `${SUPABASE_URL}/storage/v1/object/public/${VIDEO_BUCKET}/${url}`;
  }
}

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
  return (
    <Animated.View style={[s.spinner, {
      transform: [{ rotate: rot.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] }) }],
    }]} />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Lecteur WEB — <video> HTML natif navigateur
// ─────────────────────────────────────────────────────────────────────────────
interface WebPlayerProps {
  src: string;
  isActive: boolean;
  muted: boolean;
  itemW: number;
  itemH: number;
  onPlaying: (v: boolean) => void;
  onTime:    (ct: number, dur: number) => void;
  onBuffer:  (v: boolean) => void;
  onError:   () => void;
  seekRef:   React.MutableRefObject<((t: number) => void) | null>;
}

const WebPlayer = memo(function WebPlayer({
  src, isActive, muted, itemW, itemH,
  onPlaying, onTime, onBuffer, onError, seekRef,
}: WebPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    seekRef.current = (t: number) => {
      if (ref.current) ref.current.currentTime = t;
    };
    return () => { seekRef.current = null; };
  }, [seekRef]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onP   = () => onPlaying(true);
    const onPa  = () => onPlaying(false);
    const onT   = () => {
      if (v.duration > 0) onTime(v.currentTime, v.duration);
    };
    const onW   = () => onBuffer(true);
    const onC   = () => onBuffer(false);
    const onE   = () => onError();
    v.addEventListener('play',        onP);
    v.addEventListener('pause',       onPa);
    v.addEventListener('ended',       onPa);
    v.addEventListener('timeupdate',  onT);
    v.addEventListener('waiting',     onW);
    v.addEventListener('canplay',     onC);
    v.addEventListener('error',       onE);
    return () => {
      v.removeEventListener('play',       onP);
      v.removeEventListener('pause',      onPa);
      v.removeEventListener('ended',      onPa);
      v.removeEventListener('timeupdate', onT);
      v.removeEventListener('waiting',    onW);
      v.removeEventListener('canplay',    onC);
      v.removeEventListener('error',      onE);
    };
  }, [onPlaying, onTime, onBuffer, onError]);

  return React.createElement('video', {
    ref,
    src,
    muted,
    playsInline: true,
    preload:     'auto',
    style: {
      position:   'absolute',
      top:         0,
      left:        0,
      width:       itemW,
      height:      itemH,
      objectFit:  'cover',
      background: '#000',
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

  // Résolution URL (chemin relatif → URL publique Supabase)
  const src = resolveUrl(film.video_url ?? '');

  // ── State ─────────────────────────────────────────────────────────────────
  const [liked,     setLiked]     = useState(film.is_liked  ?? false);
  const [muted,     setMuted]     = useState(false);
  const [saved,     setSaved]     = useState(film.is_saved  ?? false);
  const [buffering, setBuffering] = useState(true);   // true au départ
  const [hasErr,    setHasErr]    = useState(false);
  const [playing,   setPlaying]   = useState(false);  // état réel du player
  const [curTime,   setCurTime]   = useState(0);
  const [durTime,   setDurTime]   = useState(0);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const ctRef    = useRef(0);
  const endRef   = useRef(false);
  const seekRef  = useRef<((t: number) => void) | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // NATIF — expo-video
  // ─────────────────────────────────────────────────────────────────────────
  const nativeSrc  = !isWeb && isNear && src ? src : null;
  const nativePlayer = _useVideoPlayer
    ? _useVideoPlayer(nativeSrc, (p: any) => {
        if (!p) return;
        p.loop  = false;
        p.muted = false;
        try {
          p.bufferOptions = {
            preferredForwardBufferDuration:  10,
            preferredBackwardBufferDuration: 0,
          };
        } catch {}
      })
    : null;

  const { isPlaying: nativePlaying } = _useEvent(
    nativePlayer, 'playingChange', { isPlaying: false }
  );
  const { currentTime: nativeCT } = _useEvent(
    nativePlayer, 'timeUpdate',
    { currentTime: 0, bufferedPosition: 0, currentLiveTimestamp: null, currentOffsetFromLive: null }
  );
  const { isPlaybackEnded } = _useEvent(
    nativePlayer, 'playToEnd', { isPlaybackEnded: false }
  );

  // Sync état natif → state commun
  useEffect(() => {
    if (!isWeb) setPlaying(nativePlaying);
  }, [nativePlaying, isWeb]);

  useEffect(() => {
    if (!isWeb) { ctRef.current = nativeCT; setCurTime(nativeCT); }
  }, [nativeCT, isWeb]);

  // Status natif → buffering / erreur
  useEffect(() => {
    if (isWeb || !nativePlayer?.addListener) return;
    let sub: any;
    try {
      sub = nativePlayer.addListener('statusChange', (ev: any) => {
        const st = typeof ev?.status === 'string'
          ? ev.status
          : (ev?.status?.status ?? '');
        if (st === 'loading')     setBuffering(true);
        if (st === 'readyToPlay') { setBuffering(false); setHasErr(false); }
        if (st === 'error')       { setHasErr(true); setBuffering(false); }
        if (st === 'idle')        setBuffering(false);
      });
    } catch {}
    return () => { try { sub?.remove(); } catch {} };
  }, [nativePlayer, isWeb]);

  // AUTO-PLAY / AUTO-PAUSE natif
  useEffect(() => {
    if (isWeb || !nativePlayer) return;
    if (isActive && screenFocused) {
      try { nativePlayer.play(); } catch {}
    } else {
      try { nativePlayer.pause(); } catch {}
      const ct = ctRef.current;
      if (ct > 0.3) setTimeout(() => { try { nativePlayer.seekBy(-ct); } catch {} }, 0);
    }
  }, [isActive, screenFocused, nativePlayer, isWeb]);

  // Fin de vidéo natif
  useEffect(() => {
    if (isWeb || !isPlaybackEnded || endRef.current || !nativePlayer) return;
    endRef.current = true;
    try { nativePlayer.seekBy(-ctRef.current); } catch {}
  }, [isPlaybackEnded, isWeb, nativePlayer]);

  // Mute natif
  useEffect(() => {
    if (isWeb || !nativePlayer) return;
    try { nativePlayer.muted = muted; } catch {}
  }, [muted, nativePlayer, isWeb]);

  // Reset sur changement de film
  useEffect(() => {
    endRef.current = false;
    setHasErr(false); setBuffering(true);
    setPlaying(false); setCurTime(0); setDurTime(0);
  }, [film.id]);

  // ─────────────────────────────────────────────────────────────────────────
  // Callbacks WEB
  // ─────────────────────────────────────────────────────────────────────────
  const onWebPlaying = useCallback((v: boolean) => { if (isWeb) { setPlaying(v); setBuffering(false); } }, [isWeb]);
  const onWebTime    = useCallback((ct: number, dur: number) => {
    if (!isWeb) return;
    ctRef.current = ct; setCurTime(ct); setDurTime(dur);
  }, [isWeb]);
  const onWebBuffer  = useCallback((v: boolean) => { if (isWeb) setBuffering(v); }, [isWeb]);
  const onWebError   = useCallback(() => { if (isWeb) { setHasErr(true); setBuffering(false); } }, [isWeb]);

  // ─────────────────────────────────────────────────────────────────────────
  // Durée et progression
  // ─────────────────────────────────────────────────────────────────────────
  const dur      = isWeb ? durTime : (!isWeb && nativePlayer?.duration ? nativePlayer.duration : 0);
  const progress = dur > 0 ? Math.min(ctRef.current / dur, 1) : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Seek
  // ─────────────────────────────────────────────────────────────────────────
  const handleSeek = useCallback((sec: number) => {
    if (isWeb) {
      seekRef.current?.(sec);
    } else if (nativePlayer?.seekBy) {
      try { nativePlayer.seekBy(sec - ctRef.current); } catch {}
    }
  }, [isWeb, nativePlayer]);

  const handlePlayPause = useCallback(() => {
    if (isWeb) {
      // Le WebPlayer gère isActive → nothing to do here
    } else if (nativePlayer) {
      try { playing ? nativePlayer.pause() : nativePlayer.play(); } catch {}
    }
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [isWeb, nativePlayer, playing]);

  // ─────────────────────────────────────────────────────────────────────────
  // Skip ±10s
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // Like / cœur
  // ─────────────────────────────────────────────────────────────────────────
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

  // Zones de geste (double-tap = like / tap = action)
  const tL = useRef(0), tC = useRef(0), tR = useRef(0);
  const tapL = useCallback(() => { const n=Date.now(); n-tL.current<300 ? doLike() : skip(-10); tL.current=n; }, [doLike, skip]);
  const tapC = useCallback(() => { const n=Date.now(); n-tC.current<300 ? doLike() : handlePlayPause(); tC.current=n; }, [doLike, handlePlayPause]);
  const tapR = useCallback(() => { const n=Date.now(); n-tR.current<300 ? doLike() : skip(10);  tR.current=n; }, [doLike, skip]);

  const zW = itemW / 3;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { width: itemW, height: itemH }]}>

      {/* Fond */}
      <View style={[StyleSheet.absoluteFill, s.bg]} />

      {/* ── NATIF : VideoView expo-video ──────────────────────────────── */}
      {!isWeb && isNear && !!src && !hasErr && _VideoView && nativePlayer && (
        <_VideoView
          player={nativePlayer}
          style={[StyleSheet.absoluteFill, { width: itemW, height: itemH }]}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      )}

      {/* ── WEB : <video> HTML ────────────────────────────────────────── */}
      {isWeb && !!src && !hasErr && (
        <WebPlayer
          src={src}
          isActive={isActive && screenFocused}
          muted={muted}
          itemW={itemW}
          itemH={itemH}
          onPlaying={onWebPlaying}
          onTime={onWebTime}
          onBuffer={onWebBuffer}
          onError={onWebError}
          seekRef={seekRef}
        />
      )}

      {/* ── Diagnostic : URL manquante ────────────────────────────────── */}
      {!src && (
        <View style={s.diagBox} pointerEvents="none">
          <Ionicons name="videocam-off-outline" size={36} color="rgba(255,255,255,0.30)" />
          <Text style={s.diagTxt}>Aucune vidéo liée à ce reel</Text>
          <Text style={s.diagSub} numberOfLines={2}>
            Vérifie que video_url est renseigné dans public.reels{'\n'}
            et que le bucket Supabase Storage est public.
          </Text>
        </View>
      )}

      {/* Gradient bas */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
        locations={[0.30, 0.68, 1]}
        style={s.grad}
        pointerEvents="none"
      />

      {/* Zones de geste */}
      <TouchableOpacity style={[s.zone, { left:0    }]} onPress={tapL} activeOpacity={1} />
      <TouchableOpacity style={[s.zone, { left:zW   }]} onPress={tapC} activeOpacity={1} />
      <TouchableOpacity style={[s.zone, { left:zW*2 }]} onPress={tapR} activeOpacity={1} />

      {/* Buffering */}
      {isActive && buffering && !hasErr && !!src && (
        <View style={s.center} pointerEvents="none"><Spinner /></View>
      )}

      {/* Erreur */}
      {hasErr && (
        <View style={s.errBox}>
          <Ionicons name="warning-outline" size={34} color={P.hot} />
          <Text style={s.errTxt}>Impossible de lire la vidéo</Text>
          <Text style={s.errSub} numberOfLines={2}>{src}</Text>
          <TouchableOpacity style={s.retryBtn} activeOpacity={0.85}
            onPress={() => { setHasErr(false); setBuffering(true); }}>
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={s.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Indicateur pause */}
      {isActive && !playing && !buffering && !hasErr && !!src && (
        <View style={s.center} pointerEvents="none">
          <BlurView intensity={22} tint="dark" style={s.pauseCircle}>
            <Ionicons name="play" size={26} color="rgba(255,255,255,0.92)" style={{ marginLeft:3 }} />
          </BlurView>
        </View>
      )}

      {/* Badges skip */}
      <Animated.View style={[s.badge, { opacity:leftBadge,  left:16,  top:itemH*0.45 }]} pointerEvents="none">
        <BlurView intensity={40} tint="dark" style={s.badgeBlur}>
          <Ionicons name="play-back"    size={15} color="#fff" />
          <Text style={s.badgeTxt}>-10s</Text>
        </BlurView>
      </Animated.View>
      <Animated.View style={[s.badge, { opacity:rightBadge, right:16, top:itemH*0.45 }]} pointerEvents="none">
        <BlurView intensity={40} tint="dark" style={s.badgeBlur}>
          <Ionicons name="play-forward" size={15} color="#fff" />
          <Text style={s.badgeTxt}>+10s</Text>
        </BlurView>
      </Animated.View>

      {/* Cœur */}
      <Animated.View
        style={[s.heart, { opacity:heartAlpha, transform:[{ scale:heartScale }] }]}
        pointerEvents="none"
      >
        <Ionicons name="heart" size={90} color={P.red} />
      </Animated.View>

      {/* Sidebar droite */}
      <View style={s.sidebar} pointerEvents="box-none">
        <TouchableOpacity style={s.sBtn}
          onPress={() => { setLiked(p => { onLike?.(film.id); return !p; }); }}>
          <View style={[s.sIcon, liked && s.sIconOn]}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? P.red : '#fff'} />
          </View>
          <Text style={s.sLbl}>{fmtN(film.likes_count)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.sBtn} onPress={() => setMuted(p=>!p)}>
          <View style={[s.sIcon, muted && s.sIconOn]}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={23} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.sBtn} onPress={() => setSaved(p=>!p)}>
          <View style={[s.sIcon, saved && s.sIconOn]}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={23} color={saved ? P.gold : '#fff'} />
          </View>
        </TouchableOpacity>

        {onInfoPress && (
          <TouchableOpacity style={s.sBtn} onPress={() => onInfoPress(film)}>
            <View style={s.sIcon}>
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

// ─────────────────────────────────────────────────────────────────────────────
function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n/1_000)}K`;
  return String(n || 0);
}

const s = StyleSheet.create({
  root:       { overflow: 'hidden' },
  bg:         { backgroundColor: '#000' },
  grad:       { position:'absolute', bottom:0, left:0, right:0, height:'60%' },
  zone:       { position:'absolute', top:0, bottom:0, width:'33.33%', zIndex:10 },
  center:     { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center', zIndex:20 },
  spinner: {
    width:38, height:38, borderRadius:19, borderWidth:3,
    borderColor:'transparent',
    borderTopColor:'rgba(255,255,255,0.90)',
    borderRightColor:'rgba(255,255,255,0.20)',
  },
  diagBox: {
    ...StyleSheet.absoluteFillObject, zIndex:5,
    alignItems:'center', justifyContent:'center', gap:10, padding:32,
  },
  diagTxt:  { color:'rgba(255,255,255,0.45)', fontSize:14, fontWeight:'600', textAlign:'center' },
  diagSub:  { color:'rgba(255,255,255,0.25)', fontSize:11, textAlign:'center', lineHeight:16 },
  errBox:   { ...StyleSheet.absoluteFillObject, zIndex:20, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(0,0,0,0.85)', gap:12, padding:32 },
  errTxt:   { color:'rgba(255,255,255,0.70)', fontSize:14, fontWeight:'600' },
  errSub:   { color:'rgba(255,255,255,0.30)', fontSize:10, textAlign:'center' },
  retryBtn: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:P.primary, borderRadius:12, paddingHorizontal:18, paddingVertical:10 },
  retryTxt: { color:'#fff', fontSize:13, fontWeight:'700' },
  pauseCircle: { width:60, height:60, borderRadius:30, overflow:'hidden', alignItems:'center', justifyContent:'center' },
  badge:    { position:'absolute', zIndex:20 },
  badgeBlur:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14, paddingVertical:9, borderRadius:20, overflow:'hidden', borderWidth:1, borderColor:'rgba(255,255,255,0.14)' },
  badgeTxt: { color:'#fff', fontSize:14, fontWeight:'800' },
  heart:    { position:'absolute', top:'50%', left:'50%', marginTop:-45, marginLeft:-45, zIndex:20 },
  sidebar:  { position:'absolute', right:14, bottom:160, alignItems:'center', gap:20, zIndex:15 },
  sBtn:     { alignItems:'center', gap:4 },
  sIcon:    { width:50, height:50, borderRadius:25, backgroundColor:'rgba(0,0,0,0.40)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  sIconOn:  { backgroundColor:'rgba(146,64,214,0.32)', borderColor:'rgba(146,64,214,0.55)' },
  sLbl:     { color:'rgba(255,255,255,0.78)', fontSize:12, fontWeight:'700' },
});