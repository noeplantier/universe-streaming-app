/**
 * components/gamification/ui/BadgeChip.tsx + BadgesRow.tsx
 */
import React, { memo, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RARITY_COLOR, RARITY_BG, RARITY_LABEL } from '../constants';
import type { GamiBadge } from '../types';

interface ChipProps { badge: GamiBadge; size?: 'normal' | 'small' }

export const BadgeChip = memo(function BadgeChip({ badge: b, size = 'normal' }: ChipProps) {
  const [open, setOpen] = useState(false);
  const sc = useRef(new Animated.Value(1)).current;
  const col = RARITY_COLOR[b.rarity] ?? 'rgba(255,255,255,0.58)';
  const bg  = RARITY_BG[b.rarity]    ?? 'rgba(255,255,255,0.06)';
  const sm  = size === 'small';

  const press = () => {
    Animated.sequence([
      Animated.spring(sc, { toValue: 0.88, tension: 350, friction: 7, useNativeDriver: true }),
      Animated.spring(sc, { toValue: 1,    tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    setOpen(v => !v);
  };

  return (
    <Animated.View style={{ transform: [{ scale: sc }] }}>
      <TouchableOpacity onPress={press} activeOpacity={0.85}
        style={[st.wrap, b.earned && { opacity: 1, borderColor: `${col}40`, backgroundColor: bg }, sm && st.wrapSm]}
      >
        <View style={[st.icon, b.earned && { borderColor: `${col}30`, backgroundColor: `${col}14` }, sm && st.iconSm]}>
          <Ionicons name={b.icon as any} size={sm ? 13 : 18} color={b.earned ? col : 'rgba(255,255,255,0.35)'} />
        </View>
        {b.earned && (
          <View style={[st.rarity, { backgroundColor: `${col}12`, borderColor: `${col}28` }]}>
            <Text style={[st.rarityTxt, { color: col }]}>{RARITY_LABEL[b.rarity]}</Text>
          </View>
        )}
        <Text style={[st.label, b.earned && { color: 'rgba(255,255,255,0.88)' }]} numberOfLines={open ? undefined : 2}>{b.label}</Text>
        {b.earned && <Text style={st.xp}>+{b.xp_reward} XP</Text>}
        {open && b.earned && <Text style={st.impact}>{b.impact ?? b.description}</Text>}
        {!b.earned && <Ionicons name="lock-closed" size={8} color="rgba(255,255,255,0.25)" style={{ position: 'absolute', top: 7, right: 7 }} />}
      </TouchableOpacity>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  wrap:     { alignItems: 'center', gap: 5, padding: 11, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.05)', width: 90, opacity: 0.52, minHeight: 100 },
  wrapSm:   { width: 70, padding: 8, minHeight: 78 },
  icon:     { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0D2040', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  iconSm:   { width: 30, height: 30, borderRadius: 15 },
  label:    { color: 'rgba(255,255,255,0.38)', fontSize: 8.5, fontWeight: '600', textAlign: 'center', lineHeight: 12 },
  rarity:   { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
  rarityTxt:{ fontSize: 6.5, fontWeight: '900', letterSpacing: 0.5 },
  xp:       { color: '#F5C842', fontSize: 8, fontWeight: '800' },
  impact:   { color: 'rgba(255,255,255,0.60)', fontSize: 8.5, textAlign: 'center', lineHeight: 12, marginTop: 2, fontStyle: 'italic' },
});

// ─── BadgesRow ───────────────────────────────────────────────────────────────
interface RowProps { badges: GamiBadge[] }

export const BadgesRow = memo(function BadgesRow({ badges }: RowProps) {
  const sorted = useMemo(() => [...badges.filter(b => b.earned), ...badges.filter(b => !b.earned)], [badges]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingHorizontal: 2 }}>
      {sorted.map(b => <BadgeChip key={b.id} badge={b} />)}
    </ScrollView>
  );
});

// ─── BadgeGrid ───────────────────────────────────────────────────────────────
interface GridProps { badges: GamiBadge[]; columns?: number }

export const BadgeGrid = memo(function BadgeGrid({ badges, columns = 4 }: GridProps) {
  const [expanded, setExpanded] = useState(false);
  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);
  const all    = [...earned, ...locked];
  const visible= expanded ? all : all.slice(0, columns * 2);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {visible.map(b => <BadgeChip key={b.id} badge={b} />)}
      </View>
      {all.length > columns * 2 && (
        <TouchableOpacity onPress={() => setExpanded(v => !v)} style={{ alignItems: 'center', paddingVertical: 10 }} activeOpacity={0.80}>
          <Text style={{ color: '#5A96E6', fontSize: 12, fontWeight: '700' }}>
            {expanded ? 'Voir moins ↑' : `Voir les ${all.length} badges ↓`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});