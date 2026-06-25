
/**
 * components/gamification/ui/XPBar.tsx
 * Barre XP animée — compact (inline) ou full (carte)
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LEVEL_COLORS } from '../constants';
import type { GamiProfile } from '../types';

interface Props { profile: GamiProfile; compact?: boolean }

const fmtXP = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

export const XPBar = memo(function XPBar({ profile, compact = false }: Props) {
  const prog  = useRef(new Animated.Value(0)).current;
  const glow  = useRef(new Animated.Value(0.4)).current;
  const lvlColor = LEVEL_COLORS[profile.level] ?? '#5A96E6';

  useEffect(() => {
    Animated.timing(prog, { toValue: profile.pct, duration: 1100, useNativeDriver: false }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1,   duration: 2000, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [profile.pct]);

  const barW = prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  if (compact) return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <View style={[st.compactCircle, { borderColor: lvlColor }]}>
        <Text style={[st.compactNum, { color: lvlColor }]}>{profile.level}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={st.compactTitle} numberOfLines={1}>{profile.title}</Text>
        <View style={st.track}><Animated.View style={[st.fill, { width: barW, backgroundColor: `${lvlColor}CC` }]} /></View>
      </View>
      <Text style={st.xpLabel}>{fmtXP(profile.xp)} XP</Text>
    </View>
  );

  return (
    <View style={st.wrap}>
      <BlurView intensity={Platform.OS === 'ios' ? 16 : 10} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View>
          <Animated.View style={[st.glowRing, { borderColor: `${lvlColor}45`, opacity: glow }]} />
          <View style={[st.circle, { borderColor: `${lvlColor}80` }]}>
            <Text style={[st.lvlNum, { color: lvlColor }]}>{profile.level}</Text>
            <Text style={st.lvlLbl}>NIV</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={st.title} numberOfLines={1}>{profile.title}</Text>
            {profile.streak_days >= 3 && (
              <View style={st.streakPill}>
                <Ionicons name="flame" size={10} color="#F97316" />
                <Text style={{ color: '#F97316', fontSize: 10, fontWeight: '800' }}>{profile.streak_days}j</Text>
              </View>
            )}
            {profile.gems > 0 && (
              <View style={st.gemsPill}>
                <Text style={{ fontSize: 9 }}>💎</Text>
                <Text style={{ color: '#5A96E6', fontSize: 9, fontWeight: '800' }}>{profile.gems}</Text>
              </View>
            )}
          </View>
          <View style={st.track}><Animated.View style={[st.fill, { width: barW, backgroundColor: `${lvlColor}CC` }]} /></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={st.xpSub}>{fmtXP(profile.xpInLevel)} XP</Text>
            {profile.level < 10
              ? <Text style={st.xpSub}>{fmtXP(profile.xpToNext)} → niv.{profile.level + 1}</Text>
              : <Text style={[st.xpSub, { color: '#F5C842' }]}>NIVEAU MAX ✦</Text>
            }
          </View>
        </View>
      </View>
      {/* Stats row */}
      <View style={st.statsRow}>
        <View style={st.stat}><Ionicons name="flash" size={11} color="#F5C842" /><Text style={[st.statVal, { color: '#F5C842' }]}>{fmtXP(profile.xp)} XP</Text></View>
        <View style={st.statDiv} />
        <View style={st.stat}><Ionicons name="diamond-outline" size={11} color="#5A96E6" /><Text style={[st.statVal, { color: '#5A96E6' }]}>{profile.gems} 💎</Text></View>
        <View style={st.statDiv} />
        <View style={st.stat}><Ionicons name="flame" size={11} color="#F97316" /><Text style={[st.statVal, { color: '#F97316' }]}>{profile.streak_days}j</Text></View>
        {profile.contribution_score > 0 && <>
          <View style={st.statDiv} />
          <View style={st.stat}><Ionicons name="star-outline" size={11} color="#8B5CF6" /><Text style={[st.statVal, { color: '#8B5CF6' }]}>{profile.contribution_score}</Text></View>
        </>}
      </View>
    </View>
  );
});

const st = StyleSheet.create({
  wrap:         { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)', padding: 14, position: 'relative', gap: 12 },
  glowRing:     { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, top: -6, left: -6 },
  circle:       { width: 74, height: 74, borderRadius: 37, borderWidth: 2, backgroundColor: '#0D2040', alignItems: 'center', justifyContent: 'center' },
  lvlNum:       { fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  lvlLbl:       { color: 'rgba(255,255,255,0.35)', fontSize: 7, fontWeight: '800', letterSpacing: 2.5, marginTop: -4 },
  title:        { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flex: 1 },
  track:        { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill:         { height: '100%', borderRadius: 2 },
  xpLabel:      { color: 'rgba(255,255,255,0.40)', fontSize: 10, fontWeight: '700' },
  xpSub:        { color: 'rgba(255,255,255,0.38)', fontSize: 9.5 },
  compactCircle:{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, backgroundColor: '#0D2040', alignItems: 'center', justifyContent: 'center' },
  compactNum:   { fontSize: 12, fontWeight: '900' },
  compactTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  streakPill:   { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(249,115,22,0.30)' },
  gemsPill:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, backgroundColor: 'rgba(90,150,230,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(90,150,230,0.28)' },
  statsRow:     { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  stat:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  statVal:      { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700' },
  statDiv:      { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.08)' },
});