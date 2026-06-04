/**
 * components/gamification/ui/BadgeUnlockedToast.tsx
 * Toast slide-in lors du déblocage d'un badge
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { RARITY_COLOR, RARITY_BG, RARITY_LABEL } from '../constants';
import type { GamiBadge } from '../types';
import { ParticleBurst } from './ParticleBurst';

interface Props { badge: GamiBadge | null; visible: boolean; onDone: () => void }

export const BadgeUnlockedToast = memo(function BadgeUnlockedToast({ badge, visible, onDone }: Props) {
  const slideY = useRef(new Animated.Value(-130)).current;
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (visible && badge) {
      setBurst(0);
      Animated.spring(slideY, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }).start(() => {
        setBurst(v => v + 1);
      });
      const t = setTimeout(() => {
        Animated.timing(slideY, { toValue: -160, duration: 300, useNativeDriver: true }).start(onDone);
      }, 3400);
      return () => clearTimeout(t);
    }
  }, [visible, badge]);

  if (!badge || !visible) return null;
  const col  = RARITY_COLOR[badge.rarity] ?? 'rgba(255,255,255,0.6)';
  const bg   = RARITY_BG[badge.rarity]   ?? 'rgba(255,255,255,0.06)';

  return (
    <Animated.View
      style={[st.wrap, { backgroundColor: bg, borderColor: `${col}50`, transform: [{ translateY: slideY }] }]}
    >
      <BlurView intensity={Platform.OS === 'ios' ? 28 : 16} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        <ParticleBurst trigger={burst} color={col} radius={28} />
        <View style={[st.iconWrap, { backgroundColor: `${col}18`, borderColor: `${col}35` }]}>
          <Ionicons name={badge.icon as any} size={24} color={col} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[st.rarityLabel, { color: col }]}>BADGE DÉBLOQUÉ · {RARITY_LABEL[badge.rarity] ?? 'COMMUN'}</Text>
          <View style={[st.xpPill, { backgroundColor: `${col}15`, borderColor: `${col}30` }]}>
            <Ionicons name="flash" size={8} color="#F5C842" />
            <Text style={{ color: '#F5C842', fontSize: 9, fontWeight: '800' }}>+{badge.xp_reward} XP</Text>
          </View>
        </View>
        <Text style={st.title}>{badge.label}</Text>
        <Text style={st.impact} numberOfLines={2}>{badge.impact ?? badge.description}</Text>
      </View>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  wrap:       { position: 'absolute', top: 0, left: 14, right: 14, zIndex: 9999, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  iconWrap:   { width: 50, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rarityLabel:{ fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  xpPill:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
  title:      { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  impact:     { color: 'rgba(255,255,255,0.62)', fontSize: 11, lineHeight: 15 },
});