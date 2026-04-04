import React, {
    memo, useState, useEffect, useRef, useCallback,
  } from 'react';
  import {
    View, Image, StyleSheet, TouchableWithoutFeedback,
    Animated, Platform,
  } from 'react-native';
  import { LinearGradient }    from 'expo-linear-gradient';
  import { BlurView }          from 'expo-blur';
  import { Ionicons }          from '@expo/vector-icons';
  import { VideoView, useVideoPlayer } from 'expo-video';
  import { useEvent }          from 'expo';
  import { useRouter }         from 'expo-router';
  import * as Haptics          from 'expo-haptics';

  
  import Shimmer     from './Shimmer';
  import RightBar    from './RightBar';
  import BottomCard  from './BottomCard';
  import { P } from './types';
  import type { FeedFilm } from './types';
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface FeedItemProps {
    film:          FeedFilm;
    isActive:      boolean;  // cet item est actuellement affiché
    screenFocused: boolean;  // l'écran est focus (useFocusEffect)
    itemW:         number;
    itemH:         number;
    insetBot:      number;
    onFollowFriend:(fid: string) => void;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  const FeedItem = memo(function FeedItem({
    film, isActive, screenFocused, itemW, itemH, insetBot, onFollowFriend,
  }: FeedItemProps) {
    const router = useRouter();
  
    // ── Source vidéo ─────────────────────────────────────────────────────────
    // null si la vidéo est absente → le player gère proprement
    const videoSource: string | null = film.video_url?.length ? film.video_url : null;
  
    // ── Player expo-video ─────────────────────────────────────────────────────
    // RÈGLE : useVideoPlayer JAMAIS conditionnel (hooks React)
    // On passe null si pas de source — expo-video l'accepte sans crash
    const player = useVideoPlayer(videoSource, (p) => {
      p.loop  = true;
      p.muted = false;
  
      // Pré-buffer 10 secondes devant, 0 derrière (économie mémoire)
      try {
        (p as any).bufferOptions = {
          preferredForwardBufferDuration:  10,
          preferredBackwardBufferDuration: 0,
        };
      } catch { /* API non disponible sur certaines versions */ }
    });
  
    // ── Events expo-video ─────────────────────────────────────────────────────
    // Shapes vérifiées sur expo-video@2.x
    const { status } = useEvent(player, 'statusChange', {
      status: player.status,
    });
  
    const { isPlaying } = useEvent(player, 'playingChange', {
      isPlaying: player.playing,
    });
  
    const { currentTime } = useEvent(player, 'timeUpdate', {
      currentTime:           player.currentTime ?? 0,
      bufferedPosition:      0,
      currentLiveTimestamp:  null,
      currentOffsetFromLive: null,
    });
  
    // ── État local ────────────────────────────────────────────────────────────
    const [liked,  setLiked]  = useState(false);
    const [muted,  setMuted]  = useState(false);
    const [saved,  setSaved]  = useState(false);
    const [hasErr, setHasErr] = useState(false);
  
    const isReady   = status === 'readyToPlay';
    const isLoading = !!videoSource && !isReady && !hasErr;
    const duration  = player.duration ?? 0;
    const progress  = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  
    // ── Watch erreur ──────────────────────────────────────────────────────────
    useEffect(() => {
      if (status === 'error')        setHasErr(true);
      else if (status === 'readyToPlay') setHasErr(false);
    }, [status]);
  
    // ── Autoplay / Pause — le cœur du fix ────────────────────────────────────
    useEffect(() => {
      if (!videoSource || !player) return;
  
      if (isActive && screenFocused) {
        // Jouer dès que prêt
        if (isReady) {
          player.play();
        }
        // Sinon le player se lancera automatiquement quand readyToPlay
      } else {
        // Item hors écran → pause + reset position (comportement TikTok)
        player.pause();
        if (!isActive && player.currentTime > 0) {
          try { player.seekBy(-player.currentTime); } catch { /* ignoré */ }
        }
      }
    }, [isActive, screenFocused, isReady, player, videoSource]);
  
    // ── Sync mute ─────────────────────────────────────────────────────────────
    useEffect(() => {
      if (!player) return;
      player.muted = muted;
    }, [muted, player]);
  
    // ── Double-tap → like / Simple-tap → play-pause ───────────────────────────
    const lastTap   = useRef(0);
    const heartAnim = useRef(new Animated.Value(0)).current;
  
    const handleTap = useCallback(() => {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        // Double-tap → like
        if (!liked) {
          setLiked(true);
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
        Animated.sequence([
          Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 14 }),
          Animated.delay(480),
          Animated.timing(heartAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]).start();
      } else {
        // Simple-tap → toggle play/pause
        if (isPlaying) {
          player.pause();
        } else {
          player.play();
        }
      }
      lastTap.current = now;
    }, [isPlaying, liked, heartAnim, player]);
  
    const heartScale = heartAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1.3, 1] });
    const heartOpac  = heartAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  
    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleLike = useCallback(() => setLiked(p => !p), []);
    const handleMute = useCallback(() => setMuted(p => !p), []);
    const handleSave = useCallback(() => setSaved(p => !p), []);
    const handleInfo = useCallback(() => router.push(`/film/${film.id}`), [film.id, router]);
  
    const handleRetry = useCallback(() => {
      setHasErr(false);
      if (videoSource) {
        try {
          player.replace({ uri: videoSource });
          player.play();
        } catch {
          player.play();
        }
      }
    }, [player, videoSource]);
  
    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={{ width: itemW, height: itemH, backgroundColor: '#000' }}>
  
          {/* ── Poster (toujours affiché en fond) ── */}
          <Image
            source={{ uri: film.poster_url }}
            style={[StyleSheet.absoluteFill, { width: itemW, height: itemH }]}
            resizeMode="cover"
          />
  
          {/* ── Shimmer skeleton pendant le buffering ── */}
          {isLoading && (
            <View style={[StyleSheet.absoluteFill, { opacity: 0.82 }]}>
              <Shimmer width={itemW} height={itemH} />
            </View>
          )}
  
          {/* ── VideoView — toujours monté si on a une source valide ──────────
              La source null est gérée par le player (pas d'affichage)
              contentFit="cover" → plein écran sans bandes noires             */}
          {!!videoSource && !hasErr && (
            <VideoView
              player={player}
              style={[StyleSheet.absoluteFill, { width: itemW, height: itemH }]}
              contentFit="cover"
              nativeControls={false}
              allowsFullscreen={false}
              allowsPictureInPicture={false}
            />
          )}
  
          {/* ── Erreur + retry ── */}
          {hasErr && (
            <View style={s.errOverlay}>
              <TouchableWithoutFeedback onPress={handleRetry}>
                <View style={s.retryBtn}>
                  <Ionicons name="refresh" size={16} color={P?.t2 || '#AAA'} />
                </View>
              </TouchableWithoutFeedback>
            </View>
          )}
  
          {/* ── Gradients cinématiques ── */}
          <LinearGradient
            colors={['rgba(7,0,15,0.08)', 'transparent', 'rgba(7,0,15,0.30)', 'rgba(7,0,15,0.92)']}
            locations={[0, 0.28, 0.60, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(100,20,200,0.30)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.38, y: 0.5 }}
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
  
          {/* ── Icône pause ── */}
          {!isPlaying && isReady && (
            <View style={s.pauseIcon} pointerEvents="none">
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
  
  const s = StyleSheet.create({
    errOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(7,0,15,0.78)', gap: 16,
    },
    retryBtn: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: P.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    bigHeart: {
      position: 'absolute',
      top: '50%', left: '50%',
      marginTop: -50, marginLeft: -50,
    },
    pauseIcon: {
      position: 'absolute',
      top: '50%', left: '50%',
      marginTop: -32, marginLeft: -32,
    },
    pauseBlur: {
      width: 64, height: 64, borderRadius: 32,
      overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
    },
  });