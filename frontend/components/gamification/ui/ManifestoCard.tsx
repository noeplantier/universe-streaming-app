/**
 * components/gamification/ui/ManifestoCard.tsx
 * Phrase du manifeste cinéma — rotation automatique + tap pour avancer
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CINEMA_MANIFESTO } from '../constants';

interface Props { intervalMs?: number }

export const ManifestoCard = memo(function ManifestoCard({ intervalMs = 5500 }: Props) {
  const [idx,  setIdx]  = useState(() => Math.floor(Math.random() * CINEMA_MANIFESTO.length));
  const fadeA  = useRef(new Animated.Value(1)).current;
  const slideA = useRef(new Animated.Value(0)).current;

  const rotate = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeA,  { toValue: 0,   duration: 300, useNativeDriver: true }),
      Animated.timing(slideA, { toValue: -10, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setIdx(i => (i + 1) % CINEMA_MANIFESTO.length);
      slideA.setValue(12);
      Animated.parallel([
        Animated.timing(fadeA,  { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(slideA, { toValue: 0, tension: 120, friction: 10, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  useEffect(() => {
    const t = setInterval(rotate, intervalMs);
    return () => clearInterval(t);
  }, [rotate, intervalMs]);

  const progress = (idx + 1) / CINEMA_MANIFESTO.length;

  return (
    <TouchableOpacity onPress={rotate} activeOpacity={0.88} style={st.wrap}>
      <LinearGradient colors={['rgba(90,150,230,0.10)', 'rgba(7,12,23,0.98)']} style={StyleSheet.absoluteFillObject} />
      <View style={st.header}>
        <Ionicons name="film" size={11} color="#5A96E6" />
        <Text style={st.label}>UNIVERSE · MANIFESTE</Text>
        <Text style={st.hint}>toucher →</Text>
      </View>
      <Animated.Text style={[st.quote, { opacity: fadeA, transform: [{ translateY: slideA }] }]}>
        "{CINEMA_MANIFESTO[idx]}"
      </Animated.Text>
      {/* Progress bar */}
      <View style={st.progressTrack}>
        <View style={[st.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>
      <View style={st.dots}>
        {[...Array(Math.min(8, CINEMA_MANIFESTO.length))].map((_, i) => (
          <View key={i} style={[st.dot, i === idx % 8 && { backgroundColor: '#5A96E6', width: 12 }]} />
        ))}
      </View>
    </TouchableOpacity>
  );
});

const st = StyleSheet.create({
  wrap:          { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(90,150,230,0.30)', padding: 16, gap: 10 },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label:         { color: '#5A96E6', fontSize: 8, fontWeight: '800', letterSpacing: 1.8, flex: 1 },
  hint:          { color: 'rgba(255,255,255,0.28)', fontSize: 8, fontStyle: 'italic' },
  quote:         { color: 'rgba(255,255,255,0.90)', fontSize: 14, fontWeight: '700', lineHeight: 22, fontStyle: 'italic' },
  progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: 'rgba(90,150,230,0.60)', borderRadius: 1 },
  dots:          { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  dot:           { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
});