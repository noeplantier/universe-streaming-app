import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, Modal, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, GRADIENTS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

// Mock YouTube video IDs for demo (independent cinema trailers)
const DEMO_VIDEO_IDS = [
  'dQw4w9WgXcQ', // Placeholder - would be real indie film trailers
  'L_jWHffIx5E',
  'YoHD9XEInc0',
  'fJ9rUzIMcZQ',
  '2Vv-BfVoq4g',
];

function getVideoId(filmId: string): string {
  // In production, this would fetch from your backend
  // For demo, we use deterministic selection based on film ID
  const index = filmId.charCodeAt(filmId.length - 1) % DEMO_VIDEO_IDS.length;
  return DEMO_VIDEO_IDS[index];
}

interface Props {
  filmId: string;
  filmTitle: string;
  posterUrl: string;
  onClose?: () => void;
}

export function VideoPlayerButton({ filmId, filmTitle, onPress }: { filmId: string; filmTitle: string; onPress: () => void }) {
  return (
    <TouchableOpacity testID="video-play-btn" onPress={onPress} activeOpacity={0.85} style={styles.playButton}>
      <LinearGradient colors={GRADIENTS.primary} style={styles.playBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Ionicons name="play" size={20} color="#fff" />
        <Text style={styles.playBtnText}>Regarder</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function VideoPlayer({ filmId, filmTitle, posterUrl, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const videoId = getVideoId(filmId);
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&controls=1`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
        iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
      </style>
    </head>
    <body>
      <iframe
        src="${embedUrl}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="video-close-btn" onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>{filmTitle}</Text>
          <Text style={styles.headerSub}>Lecture en cours</Text>
        </View>
        <TouchableOpacity style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Video Area */}
      <View style={styles.videoContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Chargement de la vidéo...</Text>
          </View>
        )}

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
            <Text style={styles.errorText}>Impossible de charger la vidéo</Text>
            <TouchableOpacity onPress={() => { setError(false); setLoading(true); }} style={styles.retryBtn}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={styles.webview}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            onHttpError={() => { setLoading(false); setError(true); }}
          />
        )}
      </View>

      {/* Bottom Info */}
      <View style={styles.bottomInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.textTertiary} />
          <Text style={styles.infoText}>Contenu de démonstration — Vidéo YouTube intégrée</Text>
        </View>
        <Text style={styles.disclaimer}>
          En production, ce lecteur diffuserait le contenu original du film depuis votre CDN.
        </Text>
      </View>
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: COLORS.textTertiary, fontSize: 11, marginTop: 2 },
  moreBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  videoContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  webview: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 10,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: 14 },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: { color: COLORS.textSecondary, fontSize: 15 },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(140,46,186,0.2)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  retryText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  bottomInfo: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: 'rgba(11,0,20,0.95)',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoText: { color: COLORS.textTertiary, fontSize: 12, flex: 1 },
  disclaimer: { color: COLORS.textTertiary, fontSize: 11, lineHeight: 16 },
  playButton: { flex: 1 },
  playBtnGrad: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.full,
  },
  playBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
