/**
 * components/gamification/ui/LeaderboardSection.tsx
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LEVEL_COLORS } from '../constants';
import type { LeaderEntry } from '../types';

const MEDALS = ['🥇', '🥈', '🥉'];
const fmtXP  = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

interface Props { leaders: LeaderEntry[]; myRank: number | null; userId: string }

export const LeaderboardSection = memo(function LeaderboardSection({ leaders, myRank, userId }: Props) {
  if (!leaders.length) return null;
  return (
    <View style={st.wrap}>
      <View style={st.header}>
        <Ionicons name="podium-outline" size={13} color="rgba(255,255,255,0.55)" />
        <Text style={st.title}>Classement Universe</Text>
        {myRank && (
          <View style={st.rankPill}>
            <Text style={st.rankTxt}>#{myRank}</Text>
          </View>
        )}
      </View>

      {leaders.slice(0, 5).map((l, i) => {
        const isMe     = l.user_id === userId;
        const lvlColor = LEVEL_COLORS[l.level] ?? '#5A96E6';
        const medal    = MEDALS[i] ?? `#${i + 1}`;

        return (
          <View key={l.user_id} style={[lr.row, isMe && lr.rowMe]}>
            <Text style={lr.medal}>{medal}</Text>
            <View style={[lr.avatar, { borderColor: `${lvlColor}50` }]}>
              <Text style={{ fontSize: 18 }}>🎬</Text>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[lr.name, isMe && { color: '#5A96E6' }]} numberOfLines={1}>
                  {isMe ? 'Vous' : l.display_name}
                </Text>
                {isMe && <View style={lr.mePill}><Text style={{ color: '#5A96E6', fontSize: 7, fontWeight: '800' }}>VOUS</Text></View>}
              </View>
              <Text style={lr.titleTxt} numberOfLines={1}>{l.title}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="flash" size={9} color="#F5C842" />
                <Text style={{ color: '#F5C842', fontSize: 11, fontWeight: '800' }}>{fmtXP(l.xp)}</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.32)', fontSize: 9 }}>Niv.{l.level}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
});

const st = StyleSheet.create({
  wrap:     { gap: 8 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title:    { color: '#FFFFFF', fontSize: 15, fontWeight: '800', flex: 1 },
  rankPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(90,150,230,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(90,150,230,0.30)' },
  rankTxt:  { color: '#5A96E6', fontSize: 11, fontWeight: '800' },
});
const lr = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.05)' },
  rowMe:  { borderColor: 'rgba(90,150,230,0.30)', backgroundColor: 'rgba(90,150,230,0.08)' },
  medal:  { fontSize: 18, width: 28, textAlign: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#0D2040', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  name:   { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '800' },
  titleTxt:{ color: 'rgba(255,255,255,0.38)', fontSize: 9.5 },
  mePill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, backgroundColor: 'rgba(90,150,230,0.14)' },
});