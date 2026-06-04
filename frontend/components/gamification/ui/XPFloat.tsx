/**
 * components/gamification/ui/XPFloat.tsx
 * Texte +XP qui monte et disparaît sur chaque gain
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props { amount: number; color?: string; visible: boolean; onDone?: () => void }

export const XPFloat = memo(function XPFloat({ amount, color = '#F5C842', visible, onDone }: Props) {
  const y  = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    y.setValue(0); op.setValue(1);
    Animated.parallel([
      Animated.timing(y,  { toValue: -64, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(650),
        Animated.timing(op, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start(() => onDone?.());
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View
      style={{ position: 'absolute', alignSelf: 'center', top: -12, zIndex: 999, transform: [{ translateY: y }], opacity: op, pointerEvents: 'none' } as any}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: `${color}22`, borderWidth: 1, borderColor: `${color}55` }}>
        <Ionicons name="flash" size={11} color={color} />
        <Text style={{ color, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>+{amount} XP</Text>
      </View>
    </Animated.View>
  );
});

