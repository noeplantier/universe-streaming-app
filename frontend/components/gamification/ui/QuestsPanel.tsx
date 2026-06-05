/**
 * components/gamification/ui/QuestsPanel.tsx
 */
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { QuestWithProgress } from '../types';

interface Props {
  quests:     QuestWithProgress[];
  doneCount:  number;
  onNavigate: (route: string) => void;
}

export const QuestsPanel = memo(function QuestsPanel({ quests, doneCount, onNavigate }: Props) {
  return (
    <View style={st.wrap}>
      <View style={st.header}>
        <Ionicons name="map-outline" size={13} color="rgba(255,255,255,0.55)" />
        <Text style={st.title}>Quêtes permanentes</Text>
        <Text style={st.count}>{doneCount}/{quests.length}</Text>
      </View>

      {quests.map(q => {
        const pctStr = `${Math.round(q.pct * 100)}%`;
        const col    = q.completed ? '#2ECC8A' : '#5A96E6';
        return (
          <TouchableOpacity
            key={q.id}
            onPress={() => !q.completed && onNavigate(q.route)}
            activeOpacity={0.88}
            style={[qr.row, q.completed && qr.rowDone]}
          >
            <View style={[qr.icon, q.completed && qr.iconDone]}>
              <Ionicons name={q.completed ? 'checkmark-circle' : q.icon as any} size={17} color={q.completed ? '#2ECC8A' : 'rgba(255,255,255,0.55)'} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[qr.title, q.completed && { color: '#FFFFFF' }]}>{q.title}</Text>
                {q.reward_badge && (
                  <View style={qr.badgeDot}><Ionicons name="ribbon-outline" size={7} color="#F5C842" /></View>
                )}
              </View>
              <Text style={qr.hook} numberOfLines={1}>{q.hook}</Text>
              <View style={qr.barRow}>
                <View style={qr.track}>
                  <View style={[qr.fill, { width: pctStr as any, backgroundColor: col }]} />
                </View>
                <Text style={qr.prog}>{q.progress}/{q.target}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="flash" size={9} color="#F5C842" />
                <Text style={{ color: '#F5C842', fontSize: 10, fontWeight: '800' }}>+{q.xp}</Text>
              </View>
              {!q.completed && <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.22)" />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const st = StyleSheet.create({
  wrap:   { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title:  { color: '#FFFFFF', fontSize: 15, fontWeight: '800', flex: 1 },
  count:  { color: 'rgba(255,255,255,0.38)', fontSize: 11 },
});
const qr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.05)' },
  rowDone:  { borderColor: 'rgba(46,204,138,0.18)', backgroundColor: 'rgba(46,204,138,0.04)' },
  icon:     { width: 36, height: 36, borderRadius: 10, backgroundColor: '#0D2040', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: 'rgba(46,204,138,0.12)', borderColor: 'rgba(46,204,138,0.28)' },
  title:    { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700', flex: 1 },
  hook:     { color: 'rgba(255,255,255,0.30)', fontSize: 9.5, fontStyle: 'italic' },
  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track:    { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill:     { height: '100%', borderRadius: 2 },
  prog:     { color: 'rgba(255,255,255,0.38)', fontSize: 9, fontWeight: '700', minWidth: 28, textAlign: 'right' },
  badgeDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(245,200,66,0.14)', alignItems: 'center', justifyContent: 'center' },
});