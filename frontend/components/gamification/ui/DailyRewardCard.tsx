/**
 * components/gamification/ui/DailyRewardCard.tsx
 * Coffre quotidien animé + streak calendar + claim button
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Platform, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getStreakReward } from '../constants';
import type { DailyCheckin } from '../types';
import { ParticleBurst } from './ParticleBurst';

interface Props {
  checkin:       DailyCheckin | null;
  streak:        number;
  loading:       boolean;
  claiming:      boolean;
  onClaim:       () => void;
}

export const DailyRewardCard = memo(function DailyRewardCard({ checkin, streak, loading, claiming, onClaim }: Props) {
  const bounceA = useRef(new Animated.Value(1)).current;
  const glowA   = useRef(new Animated.Value(0)).current;
  const [burst, setBurst] = useState(0);

  const claimed    = checkin?.claimed ?? false;
  const streakDay  = checkin?.streak_day ?? Math.max(1, streak);
  const reward     = getStreakReward(streakDay);
  const rarCol     = reward.color;

  useEffect(() => {
    if (claimed) { bounceA.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.spring(bounceA, { toValue: 1.06, tension: 180, friction: 5, useNativeDriver: true }),
      Animated.spring(bounceA, { toValue: 1,    tension: 200, friction: 8, useNativeDriver: true }),
      Animated.delay(2000),
    ]));
    loop.start();
    const gLoop = Animated.loop(Animated.sequence([
      Animated.timing(glowA, { toValue: 1, duration: 1600, useNativeDriver: false }),
      Animated.timing(glowA, { toValue: 0, duration: 1600, useNativeDriver: false }),
    ]));
    gLoop.start();
    return () => { loop.stop(); gLoop.stop(); };
  }, [claimed]);

  const handleClaim = () => { setBurst(v => v + 1); onClaim(); };

  // Streak calendar — 7 dots
  const calDots = Array.from({ length: 7 }, (_, i) => {
    const dayNum  = i + 1;
    const done    = streakDay >= dayNum;
    const isToday = streakDay === dayNum;
    return { dayNum, done, isToday };
  });

  return (
    <View style={st.wrap}>
      <BlurView intensity={Platform.OS === 'ios' ? 16 : 10} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={[`${rarCol}0A`, 'rgba(7,12,23,0.98)']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={[st.title, { color: rarCol }]}>RÉCOMPENSE QUOTIDIENNE</Text>
          <Text style={st.sub}>Revient à minuit · Ne pas manquer !</Text>
        </View>
        <View style={[st.streakBadge, { borderColor: `${rarCol}50`, backgroundColor: `${rarCol}15` }]}>
          <Ionicons name="flame" size={13} color={rarCol} />
          <Text style={{ color: rarCol, fontSize: 13, fontWeight: '900' }}>{streakDay}j</Text>
        </View>
      </View>

      {/* Streak calendar */}
      <View style={st.calRow}>
        {calDots.map(({ dayNum, done, isToday }) => (
          <View key={dayNum} style={[st.calDay, done && { backgroundColor: `${rarCol}20`, borderColor: `${rarCol}55` }, isToday && { borderWidth: 1.5 }]}>
            {done
              ? <Ionicons name="checkmark" size={10} color={rarCol} />
              : <Text style={[st.calNum, done && { color: rarCol }]}>J{dayNum}</Text>
            }
            {!done && <Text style={st.calNum}>J{dayNum}</Text>}
          </View>
        ))}
      </View>

      {/* Chest + reward info */}
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 4 }}>
        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ scale: bounceA }] }}>
            <View style={[st.chest, { borderColor: `${rarCol}45`, backgroundColor: `${rarCol}12` }]}>
              <Text style={{ fontSize: 46 }}>{claimed ? '📦' : '🎁'}</Text>
            </View>
          </Animated.View>
          <ParticleBurst trigger={burst} color={rarCol} radius={50} />
        </View>
        <Text style={[st.rewardLabel, { color: rarCol }]}>{reward.label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={st.pillXP}>
            <Ionicons name="flash" size={11} color="#F5C842" />
            <Text style={{ color: '#F5C842', fontSize: 13, fontWeight: '900' }}>+{reward.xp} XP</Text>
          </View>
          {reward.gems > 0 && (
            <View style={st.pillGems}>
              <Text style={{ fontSize: 11 }}>💎</Text>
              <Text style={{ color: '#5A96E6', fontSize: 12, fontWeight: '900' }}>+{reward.gems}</Text>
            </View>
          )}
          {reward.badge && (
            <View style={st.pillBadge}>
              <Ionicons name="ribbon-outline" size={11} color="#8B5CF6" />
              <Text style={{ color: '#8B5CF6', fontSize: 11, fontWeight: '800' }}>Badge</Text>
            </View>
          )}
        </View>
      </View>

      {/* CTA */}
      {loading ? (
        <ActivityIndicator color={rarCol} style={{ paddingVertical: 14 }} />
      ) : !claimed ? (
        <TouchableOpacity onPress={handleClaim} disabled={claiming} activeOpacity={0.85} style={st.claimBtn}>
          <LinearGradient colors={[rarCol, `${rarCol}BB`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
          {claiming
            ? <ActivityIndicator color="#06101F" size="small" />
            : <><Ionicons name="gift-outline" size={16} color="#06101F" /><Text style={st.claimTxt}>Réclamer ma récompense</Text></>
          }
        </TouchableOpacity>
      ) : (
        <View style={st.claimedRow}>
          <Ionicons name="checkmark-circle" size={16} color="#2ECC8A" />
          <Text style={{ color: '#2ECC8A', fontSize: 13, fontWeight: '700' }}>Réclamée · Revenez demain !</Text>
        </View>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  wrap:        { borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,200,66,0.28)', padding: 16, gap: 14 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title:       { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  sub:         { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  calRow:      { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  calDay:      { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)', gap: 3 },
  calNum:      { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '700' },
  chest:       { width: 84, height: 84, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rewardLabel: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  pillXP:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(245,200,66,0.14)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.30)' },
  pillGems:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(90,150,230,0.14)', borderWidth: 1, borderColor: 'rgba(90,150,230,0.30)' },
  pillBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(139,92,246,0.14)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.30)' },
  claimBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14, overflow: 'hidden' },
  claimTxt:    { color: '#06101F', fontSize: 15, fontWeight: '900' },
  claimedRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(46,204,138,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(46,204,138,0.28)' },
});