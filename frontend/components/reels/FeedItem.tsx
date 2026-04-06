// ─────────────────────────────────────────────────────────────────────────────
// components/reels/FeedItem.tsx
//
// STRATÉGIE CROSS-PLATFORM — fix du bug src="" sur Chrome :
//
//   WEB   → <video> HTML natif contrôlé par ref (autoPlay, loop, playsInline)
//           expo-video n'est PAS utilisé sur web (c'est lui qui génère src="")
//
//   NATIF → expo-video (useVideoPlayer + VideoView)
//
// Dans les deux cas :
//   · poster image en fond pendant le chargement
//   · autoplay dès isActive && screenFocused
//   · pause + reset quand l'item quitte l'écran (comportement TikTok)
//   · double-tap → like animé / simple-tap → play/pause
// ─────────────────────────────────────────────────────────────────────────────

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

// ── expo-video : importé uniquement sur natif ─────────────────────────────
// Sur web il génère <video src=""> → bug Chrome. On le court-circuite.
let _useVideoPlayer: any = () => ({
  play(){}, pause(){}, seekBy(){}, replace(){},
  duration: 0, currentTime: 0, muted: false,
  status: 'idle', playing: false,
});
let _useEvent: any = (_p: any, _e: string, def: any) => def;
let _VideoView: any = () => null;

if (Platform.OS !== 'web') {
  try {
    const ev = require('expo-video');
    _useVideoPlayer = ev.useVideoPlayer;
    _VideoView      = ev.VideoView;
    _useEvent       = require('expo').useEvent;
  } catch (e) {
    console.warn('[FeedItem] expo-video non dispo:', e);
  }
}

import RightBar   from './RightBar';
import BottomCard from './BottomCard';
import { P }      from './types';
import type { FeedFilm } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface FeedItemProps {
  film:           FeedFilm;
  isActive:       boolean;
  isNear:         boolean;   // ±1 de l'actif → player pré-initialisé
  screenFocused:  boolean;
  itemW:          number;
  itemH:          number;
  insetBot:       number;
  onFollowFriend: (fid: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecteur WEB — <video> natif du navigateur
// ─────────────────────────────────────────────────────────────────────────────

interface WebVideoProps {
  src:           string;
  muted:         boolean;
  isActive:      boolean;
  screenFocused: boolean;
  itemW:         number;
  itemH:         number;
  onProgress:    (pct: number) => void;
  onReady:       () => void;
  onError:       () => void;
}

const WebVideoPlayer = memo(function WebVideoPlayer({
  src, muted, isActive, screenFocused,
  itemW, itemH, onProgress, onReady, onError,
}: WebVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);

  // Autoplay / pause
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isActive && screenFocused) {
      v.play().catch(() => {}); // la politique autoplay peut rejeter en silent
    } else {
      v.pause();
      if (!isActive) v.currentTime = 0;
    }
  }, [isActive, screenFocused]);

  // Sync mute
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  // Listeners DOM
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onTime  = () => { if (v.duration > 0) onProgress(v.currentTime / v.duration); };
    const onCan   = () => onReady();
    const onErr   = () => onError();
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('canplay',    onCan);
    v.addEventListener('error',      onErr);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('canplay',    onCan);
      v.removeEventListener('error',      onErr);
    };
  }, [onProgress, onReady, onError]);

  // React.createElement pour éviter les erreurs TypeScript sur <video> dans RN
  return React.createElement('video', {
    ref,
    src,           // ← toujours une URL valide (jamais "")
    autoPlay: true,
    loop:     true,
    playsInline: true,
    muted,
    style: {
      position:  'absolute',
      top:       0,
      left:      0,
      width:     itemW,
      height:    itemH,
      objectFit: 'cover',
      display:   'block',
      background:'#000',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FeedItem principal
// ─────────────────────────────────────────────────────────────────────────────

const FeedItem = memo(function FeedItem({
  film, isActive, isNear, screenFocused,
  itemW, itemH, insetBot, onFollowFriend,
}: FeedItemProps) {

  const router = useRouter();
  const isWeb  = Platform.OS === 'web';

  // Source JAMAIS vide — null si absente
  const src: string | null =
    film.video_url && film.video_url.trim().length > 0
      ? film.video_url.trim()
      : null;

  // ── Player natif (expo-video) — ignoré sur web ────────────────────────────
  // Le hook est toujours appelé (règle des hooks React) mais le mock
  // no-op est renvoyé sur web grâce à la substitution ci-dessus.
  const player = _useVideoPlayer(
    isWeb ? null : (isNear ? src : null),
    (p: any) => {
      if (!p || isWeb) return;
      p.loop  = true;
      p.muted = false;
      try { p.bufferOptions = { preferredForwardBufferDuration: 10, preferredBackwardBufferDuration: 0 }; }
      catch {}
    },
  );

  const { status }      = _useEvent(player, 'statusChange',  { status:    player?.status    ?? 'idle'  });
  const { isPlaying }   = _useEvent(player, 'playingChange', { isPlaying: player?.playing   ?? false   });
  const { currentTime } = _useEvent(player, 'timeUpdate',    {
    currentTime: player?.currentTime ?? 0,
    bufferedPosition: 0, currentLiveTimestamp: null, currentOffsetFromLive: null,
  });

  // ── État local ────────────────────────────────────────────────────────────
  const [liked,       setLiked]       = useState(false);
  const [muted,       setMuted]       = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [hasErr,      setHasErr]      = useState(false);
  const [nativeReady, setNativeReady] = useState(false);
  const [webReady,    setWebReady]    = useState(false);
  const [webProgress, setWebProgress] = useState(0);

  const isReady = isWeb ? webReady : nativeReady;

  // ── Surveillance erreurs/readyToPlay natif ────────────────────────────────
  useEffect(() => {
    if (isWeb) return;
    if (status === 'error')          { setHasErr(true);       setNativeReady(false); }
    else if (status === 'readyToPlay') { setNativeReady(true);  setHasErr(false);      }
  }, [status, isWeb]);

  // ── Autoplay natif ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isWeb || !src || !player) return;
    if (isActive && screenFocused && nativeReady) {
      player.play();
    } else {
      player.pause();
      if (!isActive) {
        try { if ((player.currentTime ?? 0) > 0) player.seekBy(-(player.currentTime)); } catch {}
      }
    }
  }, [isActive, screenFocused, nativeReady, isNear, player, src, isWeb]);

  // ── Sync mute natif ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isWeb || !player) return;
    player.muted = muted;
  }, [muted, player, isWeb]);

  // ── Progression ───────────────────────────────────────────────────────────
  const nativeDuration = (!isWeb && player?.duration) ? player.duration : 0;
  const nativeProgress = nativeDuration > 0 ? Math.min(currentTime / nativeDuration, 1) : 0;
  const progress       = isWeb ? webProgress : nativeProgress;
  const showLoading    = !!src && !isReady && !hasErr;

  // ── Callbacks web ─────────────────────────────────────────────────────────
  const handleWebProgress = useCallback((p: number) => setWebProgress(p), []);
  const handleWebReady    = useCallback(() => { setWebReady(true);  setHasErr(false); }, []);
  const handleWebError    = useCallback(() => { setHasErr(true);    setWebReady(false); }, []);

  // ── Retry ─────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setHasErr(false);
    setNativeReady(false);
    setWebReady(false);
    if (!isWeb && src && player) {
      try { player.replace({ uri: src }); } catch {}
      setTimeout(() => player.play(), 200);
    }
  }, [isWeb, src, player]);

  // ── Double-tap / Simple-tap ───────────────────────────────────────────────
  const lastTap   = useRef(0);
  const heartAnim = useRef(new Animated.Value(0)).current;

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 290) {
      if (!liked) {
        setLiked(true);
        if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      Animated.sequence([
        Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 14 }),
        Animated.delay(520),
        Animated.timing(heartAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      if (!isWeb) isPlaying ? player?.pause() : player?.play();
    }
    lastTap.current = now;
  }, [liked, heartAnim, isPlaying, player, isWeb]);

  const heartScale = heartAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1.3, 1] });
  const heartOpac  = heartAnim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });

  const handleLike = useCallback(() => setLiked(p => !p), []);
  const handleMute = useCallback(() => setMuted(p => !p), []);
  const handleSave = useCallback(() => setSaved(p => !p), []);
  const handleInfo = useCallback(() => router.push(`/film/${film.id}`), [film.id, router]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={{ width: itemW, height: itemH, backgroundColor: '#000', overflow: 'hidden' }}>

        {/* ── Poster en fond ── */}
        <Image
          source={{ uri: film.poster_url }}
          style={[StyleSheet.absoluteFill, { width: itemW, height: itemH }]}
          resizeMode="cover"
        />

        {/* ════════ LECTEUR WEB — <video> HTML natif ════════ */}
        {isWeb && !!src && !hasErr && (
          <WebVideoPlayer
            src={src}
            muted={muted}
            isActive={isActive}
            screenFocused={screenFocused}
            itemW={itemW}
            itemH={itemH}
            onProgress={handleWebProgress}
            onReady={handleWebReady}
            onError={handleWebError}
          />
        )}

        {/* ════════ LECTEUR NATIF — expo-video ════════ */}
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

        {/* ── Loader discret ── */}
        {showLoading && (
          <View style={s.loadWrap} pointerEvents="none">
            <View style={s.loadRing}>
              <View style={s.loadDot} />
            </View>
          </View>
        )}

        {/* ── Erreur + retry ── */}
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

        {/* ── Gradients cinématiques ── */}
        <LinearGradient
          colors={['rgba(7,0,15,0.06)', 'transparent', 'rgba(7,0,15,0.28)', 'rgba(7,0,15,0.94)']}
          locations={[0, 0.30, 0.62, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(90,15,200,0.28)', 'transparent']}
          start={{ x: 0, y: 0.5 }} end={{ x: 0.36, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── Cœur double-tap ── */}
        <Animated.View
          style={[s.bigHeart, { opacity: heartOpac, transform: [{ scale: heartScale }] }]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={100} color={P.red} />
        </Animated.View>

        {/* ── Icône pause (natif uniquement) ── */}
        {!isWeb && !isPlaying && nativeReady && (
          <View style={s.pauseWrap} pointerEvents="none">
            <BlurView intensity={22} tint="dark" style={s.pauseBlur}>
              <Ionicons name="pause" size={32} color="rgba(255,255,255,0.90)" />
            </BlurView>
          </View>
        )}

        {/* ── Actions droite ── */}
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

        {/* ── Card épisode bas ── */}
        <BottomCard
          film={film}
          progress={progress}
          onFollow={onFollowFriend}
          insetBot={insetBot}
        />

      </View>
    </TouchableWithoutFeedback>
  );
});

export default FeedItem;

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  loadWrap:  { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  loadRing:  { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(192,96,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  loadDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(192,96,255,0.7)' },
  errWrap:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,0,15,0.78)', gap: 14 },
  errTxt:    { color: P.t2, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  retryTxt:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  bigHeart:  { position: 'absolute', top: '50%', left: '50%', marginTop: -50, marginLeft: -50 },
  pauseWrap: { position: 'absolute', top: '50%', left: '50%', marginTop: -32, marginLeft: -32 },
  pauseBlur: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});