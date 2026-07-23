import React, { memo, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GoldenGlowProps {
  children: React.ReactNode;
  intensity?: 'subtle' | 'medium' | 'strong';
  borderRadius?: number;
  style?: any;
  animated?: boolean; // ★ breathing effect like GamificationBadge
}

/**
 * GoldenGlow — Aura dorée réutilisable inspirée du GamificationBadge
 * 
 * Utilisation:
 * <GoldenGlow intensity="medium" borderRadius={16} animated>
 *   <YourComponent />
 * </GoldenGlow>
 */
const GoldenGlow = memo(function GoldenGlow({
  children,
  intensity = 'medium',
  borderRadius = 16,
  style,
  animated = false,
}: GoldenGlowProps) {
  const glowConfig = {
    subtle: { opacityMin: 0.12, opacityMax: 0.28, shadowMin: 0.25, shadowMax: 0.45 },
    medium: { opacityMin: 0.22, opacityMax: 0.48, shadowMin: 0.40, shadowMax: 0.65 },
    strong: { opacityMin: 0.35, opacityMax: 0.65, shadowMin: 0.55, shadowMax: 0.85 },
  };

  const config = glowConfig[intensity];
  const glowOp = useRef(new Animated.Value(config.opacityMin)).current;

  // ★ Breathing animation — identical to GamificationBadge
  useEffect(() => {
    if (!animated) return;
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOp, {
          toValue: config.opacityMax,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOp, {
          toValue: config.opacityMin,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    l.start();
    return () => l.stop();
  }, [animated, config.opacityMin, config.opacityMax, glowOp]);

  const glowStyle: any = {
    position: 'absolute',
    top: -6,
    bottom: -6,
    left: -6,
    right: -6,
    borderRadius: borderRadius + 6,
    opacity: animated ? glowOp : config.opacityMax,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: animated
            ? undefined // handled by opacity
            : `0 0 24px 8px rgba(245,200,66,${config.opacityMax}), 0 0 8px 2px rgba(245,200,66,${config.shadowMax * 0.5})`,
        }
      : {
          shadowColor: '#F5C842',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: animated ? glowOp.interpolate({
            inputRange: [config.opacityMin, config.opacityMax],
            outputRange: [config.shadowMin, config.shadowMax],
          }) : config.shadowMax,
          shadowRadius: 16,
          elevation: 5,
        }),
  };

  return (
    <View style={[styles.container, { borderRadius }, style]}>
      {/* Golden glow effect */}
      <Animated.View style={glowStyle} pointerEvents="none" />
      
      {/* Gradient overlay */}
      <LinearGradient
        colors={['rgba(245,200,66,0.12)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius }]}
        pointerEvents="none"
      />
      
      {/* Content */}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
});

export default GoldenGlow;