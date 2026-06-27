/**
 * SpringToast — toast slide-in (spring) + glow + burst optionnel + auto-dismiss.
 * Généralisation de BadgeUnlockedToast (contexts/GamificationSystem.tsx),
 * découplée d'un objet GamiBadge — n'importe quel écran peut l'utiliser pour
 * annoncer un événement (pas seulement un déblocage de badge).
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { ParticleBurst } from './ParticleBurst';

export interface SpringToastProps {
  visible: boolean;
  onDone: () => void;
  accentColor: string;
  glowColor?: string;
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  /** Contenu optionnel affiché juste après l'eyebrow (ex: pastille "+XP"). */
  eyebrowExtra?: React.ReactNode;
  title: string;
  description?: string;
  durationMs?: number;
  withParticles?: boolean;
}

export const SpringToast = memo(function SpringToast({
  visible, onDone, accentColor, glowColor, icon, eyebrow, eyebrowExtra, title, description,
  durationMs = 3200, withParticles = true,
}: SpringToastProps) {
  const slideY = useRef(new Animated.Value(-120)).current;
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setBurst(0);
    Animated.spring(slideY, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true })
      .start(() => setBurst(v => v + 1));
    const t = setTimeout(() => {
      Animated.timing(slideY, { toValue: -140, duration: 300, useNativeDriver: true }).start(onDone);
    }, durationMs);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;
  const glow = glowColor ?? `${accentColor}24`;

  return (
    <Animated.View style={[st.wrap, { backgroundColor: glow, borderColor: `${accentColor}45`, transform: [{ translateY: slideY }] }]}>
      <BlurView intensity={Platform.OS === 'ios' ? 28 : 16} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        {withParticles && <ParticleBurst trigger={burst} color={accentColor} />}
        <View style={[st.iconWrap, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}35` }]}>
          <Ionicons name={icon} size={22} color={accentColor} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text style={[st.eyebrow, { color: accentColor }]}>{eyebrow}</Text>
          {eyebrowExtra}
        </View>
        <Text style={st.title}>{title}</Text>
        {description && <Text style={st.desc} numberOfLines={2}>{description}</Text>}
      </View>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  wrap:    { position: 'absolute', top: 0, left: 16, right: 16, zIndex: 9999, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  iconWrap:{ width: 46, height: 46, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 7.5, fontWeight: '900', letterSpacing: 1.2 },
  title:   { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
  desc:    { color: 'rgba(255,255,255,0.60)', fontSize: 11, lineHeight: 15 },
});

export default SpringToast;
