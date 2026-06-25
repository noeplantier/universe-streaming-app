/**
 * components/gamification/ui/DailyChallengesSection.tsx
 */
import React, { memo, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DailyChallenge } from '../types';

interface Props {
  challenges: DailyChallenge[];
  doneCount:  number;
  onComplete: (id: string, xp: number) => void;
  onNavigate: (route: string) => void;
}

const BONUS_XP = 50;

export const DailyChallengesSection = memo(function DailyChallengesSection({ challenges, doneCount, onComplete, onNavigate }: Props) {
  const allDone = doneCount >= 3;

  return (
    <View style={st.wrap}>
      <View style={st.header}>
        <Ionicons name="today-outline" size={13} color="rgba(255,255,255,0.55)" />
        <Text style={st.title}>Défis du jour</Text>
        <View style={[st.badge, allDone && { backgroundColor: 'rgba(46,204,138,0.15)', borderColor: 'rgba(46,204,138,0.30)' }]}>
          <Text style={[st.badgeTxt, allDone && { color: '#2ECC8A' }]}>{doneCount}/3</Text>
        </View>
        {allDone && (
          <View style={st.bonusPill}>
            <Ionicons name="flash" size={9} color="#F5C842" />
            <Text style={{ color: '#F5C842', fontSize: 9, fontWeight: '800' }}>+{BONUS_XP} XP bonus</Text>
          </View>
        )}
      </View>
      <Text style={st.sub}>Complétez les 3 pour +{BONUS_XP} XP de bonus</Text>

      {challenges.map(c => (
        <ChallengeRow
          key={c.id}
          challenge={c}
          onPress={() => { if (!c.completed) { onComplete(c.id, c.xp); onNavigate(c.route); } }}
        />
      ))}
    </View>
  );
});

const ChallengeRow = memo(function ChallengeRow({ challenge: c, onPress }: { challenge: DailyChallenge; onPress: () => void }) {
  const sc = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    if (c.completed) return;
    Animated.sequence([
      Animated.spring(sc, { toValue: 0.94, tension: 300, friction: 7, useNativeDriver: true }),
      Animated.spring(sc, { toValue: 1,    tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: sc }] }}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.88} style={[cr.row, c.completed && cr.rowDone]}>
        <View style={[cr.icon, c.completed && { backgroundColor: 'rgba(46,204,138,0.14)', borderColor: 'rgba(46,204,138,0.30)' }]}>
          <Ionicons name={c.completed ? 'checkmark-circle' : c.icon as any} size={18} color={c.completed ? '#2ECC8A' : '#5A96E6'} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[cr.title, c.completed && { color: '#2ECC8A' }]}>{c.title}</Text>
          <Text style={cr.desc}>{c.desc}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="flash" size={9} color="#F5C842" />
            <Text style={{ color: '#F5C842', fontSize: 10, fontWeight: '800' }}>+{c.xp}</Text>
          </View>
          {c.gems > 0 && <Text style={{ color: '#5A96E6', fontSize: 9 }}>💎+{c.gems}</Text>}
          {!c.completed && <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.25)" />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  wrap:      { gap: 8 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title:     { color: '#FFFFFF', fontSize: 15, fontWeight: '800', flex: 1 },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#0D2040', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)' },
  badgeTxt:  { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700' },
  bonusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(245,200,66,0.13)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,200,66,0.28)' },
  sub:       { color: 'rgba(255,255,255,0.32)', fontSize: 11, fontStyle: 'italic' },
});
const cr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.05)' },
  rowDone: { borderColor: 'rgba(46,204,138,0.20)', backgroundColor: 'rgba(46,204,138,0.04)' },
  icon:    { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(90,150,230,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(90,150,230,0.28)', alignItems: 'center', justifyContent: 'center' },
  title:   { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '700' },
  desc:    { color: 'rgba(255,255,255,0.40)', fontSize: 11 },
});