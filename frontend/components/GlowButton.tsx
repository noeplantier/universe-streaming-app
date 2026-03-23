// ─────────────────────────────────────────────
//  GlowButton — Primary CTA with nebula glow
// ─────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity, Text, StyleSheet, Animated,
  ViewStyle, TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, RADIUS } from '../constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
}

export default function GlowButton({
  label, onPress, variant = 'primary', icon, style, textStyle, size = 'md',
}: Props) {
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (variant !== 'primary') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.6, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [variant]);

  const pad = size === 'sm'
    ? { paddingHorizontal: 14, paddingVertical: 8 }
    : size === 'lg'
    ? { paddingHorizontal: 32, paddingVertical: 16 }
    : { paddingHorizontal: 22, paddingVertical: 12 };

  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;

  if (variant === 'outline') {
    return (
      <TouchableOpacity onPress={onPress} style={[styles.outlineBtn, pad, style]} activeOpacity={0.75}>
        {icon}
        <Text style={[styles.outlineText, { fontSize }, textStyle]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'ghost') {
    return (
      <TouchableOpacity onPress={onPress} style={[styles.ghostBtn, pad, style]} activeOpacity={0.75}>
        {icon}
        <Text style={[styles.ghostText, { fontSize }, textStyle]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.wrapper, style]}>
      {/* Glow halo */}
      <Animated.View style={[styles.glowHalo, { opacity: glowAnim }]} />
      <LinearGradient
        colors={GRADIENTS.primaryGlow}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, pad]}
      >
        {icon}
        <Text style={[styles.primaryText, { fontSize }, textStyle]}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  glowHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    transform: [{ scaleX: 1.15 }, { scaleY: 1.5 }],
    opacity: 0.6,
    zIndex: -1,
  },
  gradient: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.full,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  outlineText: { color: '#fff', fontWeight: '600' },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghostText: { color: COLORS.primaryLight, fontWeight: '600' },
});
