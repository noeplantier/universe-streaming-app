import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { G, W } from './theme';

interface Props {
  uri: string;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  fallbackColors?: readonly [string, string];
}

// expo-image utilise contentFit (pas resizeMode) — mapping direct depuis
// l'ancienne API react-native Image pour ne rien changer côté appelants.
const CONTENT_FIT: Record<NonNullable<Props['resizeMode']>, ImageContentFit> = {
  cover: 'cover', contain: 'contain', stretch: 'fill', center: 'none',
};

export const ImageWithFallback = memo(function ImageWithFallback({
  uri,
  style,
  resizeMode = 'cover',
  fallbackColors = [G.surface, G.bg] as const,
}: Props) {
  const [state,   setState]   = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retried, setRetried] = useState(false);
  const shimTx = useRef(new Animated.Value(-W)).current;

  useEffect(() => { setState('loading'); setRetried(false); }, [uri]);

  // Shimmer loop while loading
  useEffect(() => {
    if (state !== 'loading') return;
    const anim = Animated.loop(
      Animated.timing(shimTx, { toValue: W, duration: 1050, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [state, shimTx]);

  const handleError = useCallback(() => {
    if (!retried) { setRetried(true); setTimeout(() => setState('loading'), 380); }
    else setState('error');
  }, [retried]);

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      {/* Fallback gradient */}
      <LinearGradient colors={fallbackColors as any} style={StyleSheet.absoluteFillObject} />

      {/* Real image */}
      {state !== 'error' && (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFillObject, { opacity: state === 'loaded' ? 1 : 0 }]}
          contentFit={CONTENT_FIT[resizeMode]}
          cachePolicy="memory-disk"
          onLoad={() => setState('loaded')}
          onError={handleError}
        />
      )}

      {/* Shimmer skeleton */}
      {state === 'loading' && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0E0E1A', overflow: 'hidden' }]}>
          <Animated.View style={{
            position: 'absolute', top: 0, bottom: 0, width: W * 0.42,
            backgroundColor: 'rgba(191,95,255,0.07)',
            transform: [{ translateX: shimTx }, { skewX: '-18deg' }],
          }} />
        </View>
      )}

      {/* Error icon */}
      {state === 'error' && (
        <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="film-outline" size={22} color="rgba(191,95,255,0.30)" />
        </View>
      )}
    </View>
  );
});