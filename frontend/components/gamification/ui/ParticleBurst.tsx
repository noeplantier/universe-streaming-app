/**
 * components/gamification/ui/ParticleBurst.tsx
 * Explosion de particules — badge unlock · level up · streak milestone
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

interface Props { trigger: number; color?: string; radius?: number }

export const ParticleBurst = memo(function ParticleBurst({ trigger, color = '#F5C842', radius = 44 }: Props) {
  const anims = useRef(ANGLES.map(() => new Animated.Value(0))).current;
  const ops   = useRef(ANGLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!trigger) return;
    anims.forEach(a => a.setValue(0));
    ops.forEach(o => o.setValue(1));
    Animated.stagger(12, ANGLES.map((_, i) =>
      Animated.parallel([
        Animated.timing(anims[i], { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(ops[i], { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
      ]),
    )).start();
  }, [trigger]);

  return (
    <View style={{ position: 'absolute', width: 0, height: 0, alignSelf: 'center' }} pointerEvents="none">
      {ANGLES.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const tx  = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * radius] });
        const ty  = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * radius] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute', width: 6, height: 6, borderRadius: 3,
              backgroundColor: color,
              transform: [{ translateX: tx }, { translateY: ty }],
              opacity: ops[i],
            }}
          />
        );
      })}
    </View>
  );
});