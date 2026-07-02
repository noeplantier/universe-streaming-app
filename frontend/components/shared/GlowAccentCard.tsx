/**
 * GlowAccentCard — bordure à glow coloré + spring bounce au tap.
 * Généralisation de BadgeChip (contexts/GamificationSystem.tsx), découplée
 * de la rareté de badge : la couleur et l'intensité viennent des props,
 * n'importe quel écran peut donc l'utiliser avec sa propre palette locale.
 */
import React, { memo, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

export type GlowTier = 'subtle' | 'normal' | 'strong';

const TIER_ALPHA: Record<GlowTier, string> = { subtle: '22', normal: '35', strong: '55' };

export interface GlowAccentCardProps {
  accentColor: string;
  tier?: GlowTier;
  /** false = bordure neutre (état "verrouillé"/inactif), comme un badge non obtenu. */
  active?: boolean;
  /** Si fourni, ajoute le spring bounce (tension 350→200, friction 7→8) au tap. */
  onPress?: () => void;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  neutralBorderColor?: string;
  children: React.ReactNode;
}

export const GlowAccentCard = memo(function GlowAccentCard({
  accentColor, tier = 'normal', active = true, onPress, borderRadius = 14, style,
  neutralBorderColor = 'rgba(255,255,255,0.09)', children,
}: GlowAccentCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;

  const press = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.96, tension: 350, friction: 7, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    if (active) {
      flash.setValue(1);
      Animated.timing(flash, { toValue: 0, duration: 1200, useNativeDriver: false }).start();
    }
    onPress?.();
  };

  const dim = `${accentColor}${TIER_ALPHA[tier]}`;
  const borderColor = flash.interpolate({ inputRange: [0, 1], outputRange: [dim, accentColor] });

  const card = (
    <Animated.View
      style={[
        styles.wrap,
        { borderRadius, borderColor: active ? borderColor : neutralBorderColor },
        style as any,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (!onPress) return card;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity onPress={press} activeOpacity={0.88}>
        {card}
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, overflow: 'hidden' },
});

export default GlowAccentCard;
