import React, { memo, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Platform,
} from 'react-native';
import { BlurView }      from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }      from '@expo/vector-icons';
import * as Haptics      from 'expo-haptics';

import { P } from './types';
import type { FeedFilm } from './types';

interface BottomCardProps {
  film:     FeedFilm;
  progress: number;       // 0 → 1
  onFollow: (fid: string) => void;
  insetBot: number;
}

const BottomCard = memo(function BottomCard({
  film, progress, onFollow, insetBot,
}: BottomCardProps) {
  // Calcul temps affiché
  const { elMin, elSec, clampedPct } = useMemo(() => {
    const [min, sec] = film.duration.split(':').map(Number);
    const totalSec   = (min || 0) * 60 + (sec || 0);
    const elapsed    = Math.floor(totalSec * Math.min(progress, 1));
    return {
      elMin:      String(Math.floor(elapsed / 60)).padStart(2, '0'),
      elSec:      String(elapsed % 60).padStart(2, '0'),
      clampedPct: Math.min(progress * 100, 100),
    };
  }, [film.duration, progress]);

  const unfollowed = useMemo(
    () => film.liked_by_friends.find(f => !f.followed),
    [film.liked_by_friends],
  );

  return (
    <View style={[s.wrap, { bottom: insetBot + 90 }]}>
      {/* Caption cinématique */}
      <View style={s.captionBlock}>
        {(film.caption || '').split('\n').map((line, i) => (
          <Text key={i} style={s.captionLine}>{line}</Text>
        ))}
      </View>

      {/* Info card glassmorphism */}
      <View style={s.inner}>

        {/* Header */}
        <View style={s.topRow}>
          <View style={{ flex: 1 }}>
            <View style={s.titleRow}>
              <Text style={s.seriesName} numberOfLines={1}>{film.series}</Text>
            </View>
            <Text style={s.epLabel} numberOfLines={1}>
              Ép. {film.episode} · {film.episode_title}
            </Text>
          </View>
          <View style={s.tagsRow}>
          </View>
        </View>

        {/* Réalisateur */}
        <Text style={s.directorTxt}>{film.director} · {film.year}</Text>

        {/* Barre de progression */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${clampedPct}%`, backgroundColor: '#fff' }]} />
        </View>
        <View style={s.timesRow}>
          <Text style={s.timeText}>{elMin}:{elSec}</Text>
          <Text style={[s.timeText, { color: P?.t3 || '#fff' }]}>{film.duration}</Text>
        </View>
      </View>
    </View>

  );
});

export default BottomCard;

const s = StyleSheet.create({
  wrap:           { position: 'absolute', left: 14, right: 14 },
  captionBlock:   { marginBottom: 12, paddingHorizontal: 4 },
  captionLine:    { color: 'rgba(255,255,255,0.93)', fontSize: 22, fontWeight: '800', lineHeight: 30, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  blurCard:       { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(146,64,214,0.32)' },
  inner:          { padding: 15, gap: 9 },
  topRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleRow:       { flexDirection: 'row', alignItems: 'center' },
  seriesName:     { color: P?.t1 || '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.1, flexShrink: 1 },
  epLabel:        { color: P?.t2 || '#FFF', fontSize: 12, marginTop: 2 },
  directorTxt:    { color: P?.t3 || '#FFF', fontSize: 11, fontWeight: '500' },
  tagsRow:        { flexDirection: 'row', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' },
  tag:            { backgroundColor: 'rgba(146,64,214,0.22)', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: P.bord },
  tagOriginal:    { backgroundColor: 'rgba(192,96,255,0.22)', borderColor: P.primL },
  tagTxt:         { color: P?.t2 || '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  tagTxtOriginal: { color: P.primL },
  progressTrack:  { height: 3.5, backgroundColor: 'rgb(255, 255, 255)', borderRadius: 2, overflow: 'visible' },
  progressFill:   { height: '100%', backgroundColor: P.primL, borderRadius: 2, position: 'relative', overflow: 'hidden' },
  progressGlow:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.30)' },
  progressThumb:  { position: 'absolute', top: -5, marginLeft: -6, width: 13, height: 13, borderRadius: 7, backgroundColor: '#fff', borderWidth: 2.5, borderColor: P.primL, shadowColor: P.primL, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 },
  timesRow:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  timeText:       { color: P?.t2 || '#AAA', fontSize: 11, fontWeight: '600' },
  friendsRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarStack:    { flexDirection: 'row', alignItems: 'center' },
  friendAvWrap:   { position: 'relative' },
  friendAv:       { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, borderColor: 'rgba(8,0,18,0.9)' },
  followedDot:    { position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: P.green, borderWidth: 1.5, borderColor: 'rgba(8,0,18,0.9)' },
  extraCount:     { width: 36, height: 36, borderRadius: 18, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'rgba(8,0,18,0.9)' },
  extraCountTxt:  { color: P?.t2 || '#AAA', fontSize: 10, fontWeight: '800' },
  followBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(146,64,214,0.22)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: P.bord },
  allFollowedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(34,197,94,0.28)' },
  followTxt:      { color: P?.t1 || '#FFF', fontSize: 12, fontWeight: '700' },
  commentRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  commentTxt:     { color: P?.t2 || '#AAA', fontSize: 12, fontStyle: 'italic', flex: 1 },
});