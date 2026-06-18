import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, Modal, Platform, Pressable,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, GRADIENTS } from '../constants/theme';
import { useScreenProtection } from '../hooks/useScreenProtection';
import { useStreamingToken, QualityLevel } from '../hooks/useStreamingToken';
import { streamingService, QualityKey } from '../services/streamingService';

const { width } = Dimensions.get('window');
const VIDEO_HEIGHT = (width * 9) / 16;

interface Props {
  filmId: string;
  filmTitle: string;
  posterUrl?: string;
  onClose?: () => void;
}

// ── Quality selector pill ────────────────────────────────────
function QualityBadge({
  current, qualities, onSelect,
}: {
  current: QualityKey;
  qualities: QualityLevel[];
  onSelect: (q: QualityKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: QualityKey[] = ['auto', ...qualities.map(q => q.label as QualityKey)];
  return (
    <View style={styles.qualityWrap}>
      {open && (
        <View style={styles.qualityMenu}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.qualityOption, current === opt && styles.qualityActive]}
              onPress={() => { onSelect(opt); setOpen(false); }}
            >
              <Text style={[styles.qualityText, current === opt && styles.qualityTextActive]}>
                {opt === 'auto' ? 'Auto (ABR)' : opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TouchableOpacity style={styles.qualityPill} onPress={() => setOpen(v => !v)}>
        <Ionicons name="settings-outline" size={12} color="#fff" />
        <Text style={styles.qualityPillText}>{current === 'auto' ? 'Auto' : current}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Progress bar ─────────────────────────────────────────────
function ProgressBar({ player }: { player: ReturnType<typeof useVideoPlayer> }) {
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition(player.currentTime ?? 0);
      setDuration(player.duration ?? 1);
    }, 500);
    return () => clearInterval(interval);
  }, [player]);

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{fmt(position)}</Text>
        <Text style={styles.timeText}>{fmt(duration)}</Text>
      </View>
    </View>
  );
}

// ── Main VideoPlayer ─────────────────────────────────────────
export default function VideoPlayer({ filmId, filmTitle, onClose }: Props) {
  const [playing, setPlaying] = useState(false);
  const [quality, setQuality] = useState<QualityKey>('auto');
  const [tokenError, setTokenError] = useState(false);

  // DRM token + signed URL from backend
  const { streamToken, loading: tokenLoading, error: tokenFetchError } = useStreamingToken(filmId);

  // Anti-screenshot: active as soon as player mounts
  useScreenProtection(true);

  // Resolve the best quality URL
  const resolvedUrl = streamToken
    ? streamingService.selectPlaylistUrl(
        quality === 'auto'
          ? streamToken.qualities
          : streamToken.qualities.filter(q => q.label === quality).length
            ? streamToken.qualities.filter(q => q.label === quality)
            : streamToken.qualities,
      )
    : null;

  // expo-video player — created once, source updated when URL changes
  const player = useVideoPlayer(
    resolvedUrl
      ? {
          uri: resolvedUrl,
          headers: streamingService.buildRequestHeaders(streamToken!.token),
          metadata: { title: filmTitle },
        }
      : null,
    p => { p.loop = false; },
  );

  useEffect(() => {
    if (resolvedUrl && !tokenLoading) {
      player.play();
      setPlaying(true);
    }
  }, [resolvedUrl]);

  useEffect(() => {
    if (tokenFetchError) setTokenError(true);
  }, [tokenFetchError]);

  const togglePlay = useCallback(() => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  }, [playing, player]);

  const skip = useCallback((seconds: number) => {
    player.seekBy(seconds);
  }, [player]);

  const isLoading = tokenLoading && !streamToken;
  const isError = tokenError || (!tokenLoading && !streamToken);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['rgba(0,0,0,0.9)', 'transparent']} style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="video-close-btn">
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{filmTitle}</Text>
          <Text style={styles.headerSub}>Lecture sécurisée</Text>
        </View>
        {streamToken && (
          <QualityBadge
            current={quality}
            qualities={streamToken.qualities}
            onSelect={setQuality}
          />
        )}
      </LinearGradient>

      {/* Video Area */}
      <View style={styles.videoArea}>
        {isLoading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.overlayText}>Initialisation du flux sécurisé…</Text>
          </View>
        )}
        {isError && (
          <View style={styles.overlay}>
            <Ionicons name="lock-closed-outline" size={48} color={COLORS.error} />
            <Text style={styles.overlayText}>Flux protégé indisponible</Text>
            <Text style={styles.overlaySubText}>Vérifiez votre connexion ou votre abonnement</Text>
          </View>
        )}
        {resolvedUrl && !isError && (
          <VideoView
            player={player}
            style={styles.video}
            allowsFullscreen
            allowsPictureInPicture={false}
            nativeControls={false}
          />
        )}
      </View>

      {/* Controls */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} style={styles.controls}>
        {player && streamToken && <ProgressBar player={player} />}
        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => skip(-10)}>
            <Ionicons name="play-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.playBtnGrad}>
              <Ionicons name={playing ? 'pause' : 'play'} size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => skip(10)}>
            <Ionicons name="play-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        {/* DRM badge */}
        <View style={styles.drmBadge}>
          <Ionicons name="shield-checkmark" size={10} color={COLORS.success} />
          <Text style={styles.drmText}>Contenu protégé DRM</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

export function VideoPlayerButton({ onPress }: { filmId: string; filmTitle: string; onPress: () => void }) {
  return (
    <TouchableOpacity testID="video-play-btn" onPress={onPress} activeOpacity={0.85} style={styles.playButton}>
      <LinearGradient colors={GRADIENTS.primary} style={styles.playBtnGradFull} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Ionicons name="play" size={20} color="#fff" />
        <Text style={styles.playBtnText}>Regarder</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function VideoPlayerModal({ visible, onClose, ...props }: Props & { visible: boolean }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <VideoPlayer {...props} onClose={onClose} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 18,
    paddingBottom: 20,
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  headerSub: { color: COLORS.textTertiary, fontSize: 10, marginTop: 2 },

  // Video
  videoArea: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 10,
  },
  overlayText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  overlaySubText: { color: COLORS.textTertiary, fontSize: 12 },

  // Controls
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingTop: 40,
  },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, marginBottom: 4 },
  ctrlBtn: { padding: 10 },
  playBtn: { borderRadius: 32 },
  playBtnGrad: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },

  // Progress
  progressWrap: { marginBottom: 16 },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { color: COLORS.textTertiary, fontSize: 11 },

  // Quality selector
  qualityWrap: { position: 'relative', alignItems: 'flex-end' },
  qualityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(155,63,222,0.4)', borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  qualityPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  qualityMenu: {
    position: 'absolute', bottom: 36, right: 0,
    backgroundColor: 'rgba(17,0,34,0.98)',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    minWidth: 130, overflow: 'hidden', zIndex: 50,
  },
  qualityOption: { paddingHorizontal: 16, paddingVertical: 10 },
  qualityActive: { backgroundColor: 'rgba(155,63,222,0.3)' },
  qualityText: { color: COLORS.textSecondary, fontSize: 13 },
  qualityTextActive: { color: '#fff', fontWeight: '700' },

  // DRM badge
  drmBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 8 },
  drmText: { color: COLORS.textTertiary, fontSize: 9, letterSpacing: 0.5 },

  // Play button (film page)
  playButton: { flex: 1 },
  playBtnGradFull: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: RADIUS.full,
  },
  playBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
