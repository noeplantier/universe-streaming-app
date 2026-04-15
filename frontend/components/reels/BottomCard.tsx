import React, { memo } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 HELPERS (Importés depuis Infosheet)
// ─────────────────────────────────────────────────────────────────────────────
function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M vues`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K vues`;
  return `${n} vues`;
}

function formatLikes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 📊 VIDEO PROGRESS BAR — barre réelle, Animated.Value pour 0 GC pression
// ─────────────────────────────────────────────────────────────────────────────
interface VideoProgressBarProps {
  progress: Animated.Value | number;
}

const VideoProgressBar = memo(({ progress }: VideoProgressBarProps) => {
  const isAnimated = progress && typeof (progress as any).interpolate === 'function';

  const width = isAnimated
    ? (progress as Animated.Value).interpolate({
        inputRange:  [0, 1],
        outputRange: ['0%', '100%'],
        extrapolate: 'clamp',
      })
    : `${Math.min(Math.max(Number(progress) || 0, 0), 1) * 100}%`;

  return (
    <View style={pb.track} pointerEvents="none">
      <Animated.View style={[pb.fill, { width: width as any }]} />
      {/* Curseur lumineux à l'extrémité */}
      <Animated.View style={[pb.thumb, { left: width as any }]} />
    </View>
  );
});
VideoProgressBar.displayName = 'VideoProgressBar';

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 BOTTOM VIEW — Informations de la vidéo (Textes Blancs, Mode Galaxie)
// ─────────────────────────────────────────────────────────────────────────────
export interface BottomCardProps {
  title?: string;
  director?: string;
  year?: number | string;
  genre?: string;
  synopsis?: string;
  viewsCount?: number;
  likesCount?: number;
  progress: Animated.Value | number;
}

const BottomCard = memo(({ 
  title, 
  director, 
  year, 
  genre, 
  synopsis, 
  viewsCount = 0, 
  likesCount = 0, 
  progress 
}: BottomCardProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        {/* Titre (Blanc éclatant) */}
        <Text style={styles.title} numberOfLines={1}>
          {title || 'Titre inconnu'}
        </Text>
        
        {/* Meta Infos: Réalisateur, Année, Genre */}
        <Text style={styles.metaText} numberOfLines={1}>
          {director ? `${director} ` : ''}
          {year ? `• ${year} ` : ''}
          {genre ? `• ${genre}` : ''}
        </Text>

        {/* Synopsis */}
        {synopsis && (
          <Text style={styles.synopsis} numberOfLines={2}>
            {synopsis}
          </Text>
        )}

        {/* Stats: Vues et Likes */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>👁 {formatViews(viewsCount)}</Text>
          <Text style={styles.statsText}>♥ {formatLikes(likesCount)}</Text>
        </View>
      </View>
      
      <VideoProgressBar progress={progress} />
    </View>
  );
});
BottomCard.displayName = 'BottomCard';

export default BottomCard;

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 STYLES
// ─────────────────────────────────────────────────────────────────────────────
const pb = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Fond semi-transparent étoilé
    width: '100%',
    position: 'relative',
    borderRadius: 2,
    marginTop: 12,
  },
  fill: {
    height: '100%',
    backgroundColor: '#FFF', // Cyan brillant (Galaxie)
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: -2,
    marginLeft: -3.5, 
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  }
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 40,
    paddingBottom: 90,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dégradé sombre pour lisibilité des textes blancs
  },
  infoContainer: {
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF', // Texte Blanc
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  metaText: {
    color: '#FFFFFF', // Texte Blanc
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
    marginBottom: 6,
  },
  synopsis: {
    color: '#FFFFFF', // Texte Blanc
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statsText: {
    color: '#FFFFFF', // Texte Blanc
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
});