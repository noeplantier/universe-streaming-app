/**
 * components/gamification/ui/LevelUpModal.tsx
 * Modal plein-écran de level-up avec rayons + particules + copy ciné
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Platform, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LEVEL_COLORS, LEVEL_UP_COPY } from '../constants';
import { ParticleBurst } from './ParticleBurst';

interface Props { level: number; title: string; visible: boolean; onClose: () => void }

export const LevelUpModal = memo(function LevelUpModal({ level, title, visible, onClose }: Props) {
  const numScale = useRef(new Animated.Value(0.3)).current;
  const numOp    = useRef(new Animated.Value(0)).current;
  const textOp   = useRef(new Animated.Value(0)).current;
  const rayRot   = useRef(new Animated.Value(0)).current;
  const btnOp    = useRef(new Animated.Value(0)).current;
  const [burst, setBurst] = useState(0);

  const accentColor = LEVEL_COLORS[level] ?? '#5A96E6';
  const copy = LEVEL_UP_COPY[level] ?? { headline: 'Nouveau niveau.', body: 'Votre voyage dans le cinéma indépendant continue.' };

  useEffect(() => {
    if (!visible) return;
    numScale.setValue(0.3); numOp.setValue(0); textOp.setValue(0); btnOp.setValue(0); setBurst(0);
    const loop = Animated.loop(Animated.timing(rayRot, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    Animated.sequence([
      Animated.parallel([
        Animated.spring(numScale, { toValue: 1.12, tension: 120, friction: 6, useNativeDriver: true }),
        Animated.timing(numOp, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.spring(numScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
      Animated.timing(textOp, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(btnOp,  { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => setBurst(v => v + 1));
    return () => loop.stop();
  }, [visible]);

  if (!visible) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent>
      <View style={st.overlay}>
        <LinearGradient colors={['#06101F', '#070C17']} style={StyleSheet.absoluteFillObject} />
        {/* Rotating rays */}
        <Animated.View
          style={{ position: 'absolute', width: 320, height: 320, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: rayRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
          pointerEvents="none"
        >
          {[...Array(12)].map((_, i) => (
            <View key={i} style={{ position: 'absolute', width: 1.5, height: 160, borderRadius: 1, backgroundColor: `${accentColor}20`, transform: [{ rotate: `${i * 30}deg` }, { translateY: -80 }] }} />
          ))}
        </Animated.View>

        <View style={{ alignItems: 'center', gap: 22, paddingHorizontal: 32 }}>
          {/* ASCENSION label */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: `${accentColor}50` }} />
            <Text style={{ color: accentColor, fontSize: 8, fontWeight: '900', letterSpacing: 4 }}>ASCENSION</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: `${accentColor}50` }} />
          </View>

          {/* Level circle */}
          <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
            <ParticleBurst trigger={burst} color={accentColor} radius={60} />
            <Animated.View style={{ transform: [{ scale: numScale }], opacity: numOp }}>
              <View style={[st.circle, { borderColor: accentColor, backgroundColor: `${accentColor}14` }]}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: accentColor, letterSpacing: 2.5 }}>NIVEAU</Text>
                <Text style={{ fontSize: 58, fontWeight: '900', color: '#FFFFFF', letterSpacing: -3, lineHeight: 66 }}>{level}</Text>
              </View>
            </Animated.View>
          </View>

          {/* Text content */}
          <Animated.View style={{ alignItems: 'center', gap: 12, opacity: textOp }}>
            <Text style={{ color: '#F5C842', fontSize: 9, fontWeight: '900', letterSpacing: 2.5 }}>NOUVELLE IDENTITÉ</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, lineHeight: 30 }}>{title}</Text>
            <View style={{ height: 1, width: 60, backgroundColor: `${accentColor}50` }} />
            <Text style={{ color: accentColor, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>{copy.headline}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 290 }}>{copy.body}</Text>
          </Animated.View>

          {/* CTA button */}
          <Animated.View style={{ opacity: btnOp, width: '100%' }}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={{ borderRadius: 16, overflow: 'hidden' }}>
              <LinearGradient colors={[accentColor, `${accentColor}BB`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 16 }}>
                <Text style={{ color: '#06101F', fontSize: 15, fontWeight: '900' }}>Continuer votre voyage →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
});

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(6,16,31,0.96)', alignItems: 'center', justifyContent: 'center' },
  circle:  { width: 128, height: 128, borderRadius: 64, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
});