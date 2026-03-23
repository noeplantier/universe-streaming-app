// ─────────────────────────────────────────────
//  StarField — Animated galaxy background
// ─────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface StarProps { x: number; y: number; size: number; delay: number; }

function Star({ x, y, size, delay }: StarProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.15, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#fff',
        opacity,
      }}
    />
  );
}

// Pre-generate star positions
const STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height,
  size: Math.random() * 2.5 + 0.5,
  delay: Math.random() * 3000,
}));

export default function StarField() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {STARS.map(s => <Star key={s.id} x={s.x} y={s.y} size={s.size} delay={s.delay} />)}
    </View>
  );
}
