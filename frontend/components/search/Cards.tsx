import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';

import type { Work } from '@/lib/supabase';
import { T, DIMS, getRankConfig, resolveWorkImage } from './shared';

const { PORT_W, PORT_H, LAND_W, LAND_H } = DIMS;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — skeleton shimmer
// ─────────────────────────────────────────────────────────────────────────────
export function usePulse() {
  const op = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.5,  duration: 850, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 850, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [op]);
  return op;
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT CARD
// ─────────────────────────────────────────────────────────────────────────────
export const PortraitCard = memo(function PortraitCard({
  item, rank,
}: { item: Work; rank?: number }) {
  const router  = useRouter();
  const scale   = useRef(new Animated.Value(1)).current;
  const rankCfg = rank != null ? getRankConfig(rank) : null;

  const onIn  = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }).start();

  return (
    <TouchableOpacity
      activeOpacity={1} onPressIn={onIn} onPressOut={onOut}
      onPress={() => router.push(`/film/${item.id}` as any)}
      style={{ marginRight: 14 }}
    >
      <Animated.View style={[pc.card, { transform: [{ scale }] }]}>
        <Image source={{ uri: resolveWorkImage(item) }} style={pc.img} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.78)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }}
        />
        <View style={[pc.badge, { backgroundColor: item.is_original ? T.navyBright : T.navyMid }]}>
          <Text style={pc.badgeTxt}>
            {item.is_original ? 'ORIGINAL' : item.category.toUpperCase()}
          </Text>
        </View>

        {rankCfg != null && (
          <Text style={[
            pc.rankNum, { color: rankCfg.color },
            rank! <= 3 && {
              textShadowColor: rankCfg.glow,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 14,
            },
          ]}>
            {rankCfg.num}
          </Text>
        )}
        {rank != null && rank <= 3 && (
          <View style={[pc.rankBorder, { borderColor: rankCfg!.border }]} />
        )}

        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="heart" size={10} color={T.gold} />
            <Text style={pc.stat}>{item.likes.toLocaleString('fr-FR')}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

const pc = StyleSheet.create({
  card:      { width: PORT_W, height: PORT_H, borderRadius: 14, overflow: 'hidden', backgroundColor: T.navyMid },
  img:       { width: '100%', height: '100%', resizeMode: 'cover' },
  badge:     { position: 'absolute', top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  badgeTxt:  { color: T.white, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  rankNum:   { position: 'absolute', bottom: 34, right: 6, fontSize: 58, fontWeight: '900', lineHeight: 58, letterSpacing: -4, opacity: 0.92 },
  rankBorder:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, borderWidth: 1.5 },
  meta:      { position: 'absolute', bottom: 10, left: 9, right: 9, gap: 3 },
  title:     { color: T.white, fontSize: 12, fontWeight: '700', lineHeight: 15 },
  stat:      { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LANDSCAPE CARD
// ─────────────────────────────────────────────────────────────────────────────
export const LandscapeCard = memo(function LandscapeCard({ item }: { item: Work }) {
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;

  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }).start();

  return (
    <TouchableOpacity
      activeOpacity={1} onPressIn={onIn} onPressOut={onOut}
      onPress={() => router.push(`/film/${item.id}` as any)}
      style={{ marginRight: 14 }}
    >
      <Animated.View style={[lc.card, { transform: [{ scale }] }]}>
        <Image source={{ uri: resolveWorkImage(item) }} style={lc.img} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.88)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }}
        />
        {item.duration != null && (
          <View style={lc.durBadge}>
            <Ionicons name="time-outline" size={9} color="rgba(255,255,255,0.7)" />
            <Text style={lc.durTxt}>{item.duration}m</Text>
          </View>
        )}
        <View style={lc.meta}>
          <Text style={lc.title} numberOfLines={1}>{item.title}</Text>
          {item.adjective && <Text style={lc.adj} numberOfLines={1}>{item.adjective}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="heart" size={10} color={T.gold} />
            <Text style={lc.stat}>{item.likes.toLocaleString('fr-FR')}</Text>
            {item.comments != null && (
              <>
                <Ionicons name="chatbubble" size={9} color={T.textSec} />
                <Text style={[lc.stat, { color: T.textSec }]}>{item.comments}</Text>
              </>
            )}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

const lc = StyleSheet.create({
  card:     { width: LAND_W, height: LAND_H, borderRadius: 14, overflow: 'hidden', backgroundColor: T.navyMid },
  img:      { width: '100%', height: '100%', resizeMode: 'cover' },
  durBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(2,8,16,0.60)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  durTxt:   { color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: '600' },
  meta:     { position: 'absolute', bottom: 10, left: 10, right: 10, gap: 2 },
  title:    { color: T.white, fontSize: 13, fontWeight: '700' },
  adj:      { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontStyle: 'italic' },
  stat:     { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETONS
// ─────────────────────────────────────────────────────────────────────────────
export const PortraitSkeleton  = memo(function PortraitSkeleton()  { const op = usePulse(); return <Animated.View style={[pc.card, { backgroundColor: T.surf, opacity: op, marginRight: 14 }]} />; });
export const LandscapeSkeleton = memo(function LandscapeSkeleton() { const op = usePulse(); return <Animated.View style={[lc.card, { backgroundColor: T.surf, opacity: op, marginRight: 14 }]} />; });