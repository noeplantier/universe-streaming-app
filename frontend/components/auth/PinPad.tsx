/**
 * components/auth/PinPad.tsx — Clavier PIN Universe
 *
 * Design : fond sombre/glass, touches circulaires avec glow violet,
 * dots de progression, animation de secousse sur erreur.
 * Le PIN brut n'est JAMAIS loggé ni exposé via props vers le parent —
 * le composant appelle onComplete(pin) une seule fois à 6 chiffres,
 * puis efface immédiatement l'état interne.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Platform, Pressable, StyleSheet,
  Text, Vibration, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const PIN_LENGTH = 6;
const KEYS: Array<string | null> = [
  '1','2','3',
  '4','5','6',
  '7','8','9',
  null,'0','⌫',
];

// Palette Universe
const C = {
  dot_empty:   'rgba(255,255,255,0.15)',
  dot_filled:  '#8B5CF6',
  key_bg:      'rgba(255,255,255,0.08)',
  key_border:  'rgba(255,255,255,0.12)',
  key_pressed: 'rgba(139,92,246,0.28)',
  key_text:    '#FFFFFF',
  error:       '#F87171',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  onComplete:  (pin: string) => void;
  disabled?:   boolean;
  error?:      string | null;
  onReset?:    () => void; // appelé quand l'utilisateur efface après une erreur
}

// ─────────────────────────────────────────────────────────────────────────────
// PinPad
// ─────────────────────────────────────────────────────────────────────────────
export default function PinPad({ onComplete, disabled, error, onReset }: Props) {
  const [digits,    setDigits]   = useState<string[]>([]);
  const shakeX                   = useRef(new Animated.Value(0)).current;
  const dotsScale                = useRef(
    Array.from({ length: PIN_LENGTH }, () => new Animated.Value(1)),
  ).current;

  // ── Effet secousse + vibration sur erreur ─────────────────────────────────
  useEffect(() => {
    if (!error) return;

    if (Platform.OS !== 'web') Vibration.vibrate(300);

    Animated.sequence([
      Animated.timing(shakeX, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(() => {
      setDigits([]);
    });
  }, [error]);

  // ── Animation d'un dot (remplissage) ─────────────────────────────────────
  const animateDot = useCallback((index: number, fill: boolean) => {
    Animated.spring(dotsScale[index], {
      toValue:         fill ? 1.2 : 1,
      useNativeDriver: true,
      speed:           30,
      bounciness:      12,
    }).start(() => {
      Animated.spring(dotsScale[index], {
        toValue:         1,
        useNativeDriver: true,
        speed:           20,
        bounciness:      0,
      }).start();
    });
  }, [dotsScale]);

  // ── Pression sur une touche ───────────────────────────────────────────────
  const handleKey = useCallback((key: string | null) => {
    if (key === null || disabled) return;

    if (key === '⌫') {
      setDigits(prev => {
        if (prev.length === 0) return prev;
        animateDot(prev.length - 1, false);
        onReset?.();
        return prev.slice(0, -1);
      });
      return;
    }

    setDigits(prev => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = [...prev, key];
      animateDot(next.length - 1, true);

      if (next.length === PIN_LENGTH) {
        // Appelle onComplete au prochain tick pour laisser l'animation se faire
        const pin = next.join('');
        setTimeout(() => {
          onComplete(pin);
          setDigits([]); // efface immédiatement l'état interne
        }, 80);
      }
      return next;
    });
  }, [disabled, animateDot, onComplete, onReset]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>

      {/* Dots de progression */}
      <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeX }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <Animated.View
            key={i}
            style={[
              s.dot,
              i < digits.length && s.dotFilled,
              { transform: [{ scale: dotsScale[i] }] },
            ]}
          />
        ))}
      </Animated.View>

      {/* Message d'erreur */}
      {!!error && (
        <Text style={s.errorText} numberOfLines={2}>{error}</Text>
      )}

      {/* Clavier 3×4 */}
      <View style={s.grid}>
        {KEYS.map((key, i) => (
          key === null ? (
            <View key={i} style={s.keyPlaceholder} />
          ) : (
            <Pressable
              key={i}
              style={({ pressed }) => [
                s.key,
                pressed && !disabled && s.keyPressed,
                disabled && s.keyDisabled,
              ]}
              onPress={() => handleKey(key)}
              disabled={disabled}
              accessibilityLabel={key === '⌫' ? 'Supprimer' : `Chiffre ${key}`}
            >
              {key === '⌫' ? (
                <Ionicons
                  name="backspace-outline"
                  size={22}
                  color={disabled ? 'rgba(255,255,255,0.25)' : C.key_text}
                />
              ) : (
                <Text style={[s.keyText, disabled && s.keyTextDisabled]}>
                  {key}
                </Text>
              )}
            </Pressable>
          )
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 24,
  },

  dotsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.dot_empty,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  dotFilled: {
    backgroundColor: C.dot_filled,
    borderColor: '#A78BFA',
    shadowColor: '#8B5CF6',
    shadowRadius: 8,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },

  errorText: {
    color: C.error,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
    minHeight: 36,
    paddingHorizontal: 24,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 270,
    gap: 12,
    justifyContent: 'center',
  },
  key: {
    width: 82,
    height: 64,
    borderRadius: 16,
    backgroundColor: C.key_bg,
    borderWidth: 1,
    borderColor: C.key_border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    backgroundColor: C.key_pressed,
    borderColor: 'rgba(139,92,246,0.5)',
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyPlaceholder: {
    width: 82,
    height: 64,
  },
  keyText: {
    color: C.key_text,
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  keyTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
});
