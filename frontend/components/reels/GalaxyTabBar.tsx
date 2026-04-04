import React, { memo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Image,
} from 'react-native';
import { BlurView }  from 'expo-blur';
import { Ionicons }  from '@expo/vector-icons';

import { P } from './types';

interface GalaxyTabBarProps {
  active:   string;
  set:      (v: string) => void;
  insetBot: number;
}

const TABS = [
  { key: 'accueil', label: 'Accueil', icon: 'home-outline'     as const },
  { key: 'reels',   label: 'Reels',   icon: 'play-circle'      as const },
  { key: 'spark',   label: 'Spark',   icon: 'sparkles-outline' as const },
  { key: 'amies',   label: 'Amies',   icon: 'people-outline'   as const },
  { key: 'profil',  label: 'Profil',  icon: 'person-circle'    as const },
] as const;

const GalaxyTabBar = memo(function GalaxyTabBar({ active, set, insetBot }: GalaxyTabBarProps) {
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insetBot, 8) }]}>
      <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />

      {/* Bordure supérieure lumineuse */}
      <View style={s.borderTop}>
        <Animated.View style={[s.borderGlow, { opacity: glowAnim }]} />
      </View>

      <View style={s.row}>
        {TABS.map(item => {
          const on = active === item.key;
          const c  = on ? P.primL : 'rgba(240,232,255,0.36)';

          if (item.key === 'profil') return (
            <TouchableOpacity key={item.key} onPress={() => set(item.key)} style={s.tab} activeOpacity={0.75}>
              <View style={[s.avBox, on && s.avBoxOn]}>
                <Image
                  source={{ uri: 'https://i.pravatar.cc/50?img=11' }}
                  style={{ width: '100%', height: '100%', borderRadius: on ? 10 : 13 }}
                />
              </View>
              <Text style={[s.label, on && s.labelOn]}>{item.label}</Text>
            </TouchableOpacity>
          );

          return (
            <TouchableOpacity key={item.key} onPress={() => set(item.key)} style={s.tab} activeOpacity={0.75}>
              <View style={[s.iconBox, on && s.iconBoxOn]}>
                {on && (
                  <Animated.View style={[StyleSheet.absoluteFill, s.iconGlow, { opacity: glowAnim }]} />
                )}
                <Ionicons name={item.icon} size={24} color={c} />
              </View>
              <Text style={[s.label, on && s.labelOn]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

export default GalaxyTabBar;

const s = StyleSheet.create({
  wrap:       { position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden' },
  borderTop:  { height: 1, overflow: 'hidden', backgroundColor: 'rgba(146,64,214,0.35)', position: 'relative' },
  borderGlow: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: P.primL },
  row:        { flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingHorizontal: 4 },
  tab:        { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  iconBox:    { width: 42, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, position: 'relative', overflow: 'hidden' },
  iconBoxOn:  { backgroundColor: 'rgba(146,64,214,0.20)' },
  iconGlow:   { borderRadius: 11, backgroundColor: 'rgba(192,96,255,0.15)' },
  label:      { fontSize: 10, fontWeight: '600', color: 'rgba(240,232,255,0.36)' },
  labelOn:    { color: P.primL, fontWeight: '800' },
  avBox:      { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', backgroundColor: P.surface },
  avBoxOn:    { borderWidth: 2.5, borderColor: P.primL, borderRadius: 12 },
});