import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, MAX_DURATION } from './tokens';
import TrimBar from './TrimBar';

interface Props {
  videoUri:      string | null;
  videoFileName: string;
  videoDuration: number;
  trimStart:     number;
  trimEnd:       number;
  onPick:        () => void;
  onRemove:      () => void;
  onTrimChange:  (s: number, e: number) => void;
}

const StepImport = memo(function StepImport({
  videoUri, videoFileName, videoDuration,
  trimStart, trimEnd, onPick, onRemove, onTrimChange,
}: Props) {
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View>
      <Text style={s.sectionTitle}>Sélectionnez votre passage</Text>
      <Text style={s.hint}>
        Choisissez le moment le plus fort de votre film — {MAX_DURATION} secondes maximum.
      </Text>

      {!videoUri ? (
        <TouchableOpacity style={s.pickZone} onPress={onPick} activeOpacity={0.85}>
          <LinearGradient
            colors={['rgba(0,201,255,0.06)', 'rgba(0,30,80,0.04)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.pickIconWrap}>
            <LinearGradient
              colors={[C.teal, C.navyMid]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.pickIconBg}
            >
              <Ionicons name="film-outline" size={28} color="white" />
            </LinearGradient>
          </View>
          <Text style={s.pickTitle}>Importer une vidéo</Text>
          <Text style={s.pickSub}>Depuis votre galerie</Text>
          <View style={s.pickFormatRow}>
            {['MP4', 'MOV', 'ProRes', 'HEVC'].map(f => (
              <View key={f} style={s.pickFormat}>
                <Text style={s.pickFormatTxt}>{f}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      ) : (
        <>
          <View style={s.previewCard}>
            <LinearGradient colors={[C.tealSoft, 'transparent']} style={StyleSheet.absoluteFill} />
            <View style={s.previewLeft}>
              <View style={s.previewThumb}>
                <Ionicons name="play-circle" size={28} color={C.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.previewName} numberOfLines={1}>
                  {videoFileName || 'Vidéo importée'}
                </Text>
                <Text style={s.previewMeta}>Durée totale : {fmt(videoDuration)}</Text>
              </View>
            </View>
            <TouchableOpacity style={s.removeBtn} onPress={onRemove}>
              <Ionicons name="close" size={16} color={C.textSec} />
            </TouchableOpacity>
          </View>

          <TrimBar
            duration={videoDuration}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onChange={onTrimChange}
          />

          <View style={s.tipCard}>
            <Ionicons name="bulb-outline" size={16} color={C.gold} style={{ marginTop: 1 }} />
            <Text style={s.tipTxt}>
              Choisissez le passage le plus marquant — une scène clé, un plan fort,
              un moment d'émotion intense. C'est cette fenêtre de {MAX_DURATION}s
              qui donnera envie de découvrir votre film.
            </Text>
          </View>
        </>
      )}
    </View>
  );
});

export default StepImport;

const s = StyleSheet.create({
  sectionTitle:  { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  hint:          { color: C.textTert, fontSize: 13, lineHeight: 19, marginBottom: 20, fontStyle: 'italic' },
  pickZone:      { borderRadius: 22, borderWidth: 1.5, borderColor: C.borderAcc, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12, overflow: 'hidden', marginBottom: 16 },
  pickIconWrap:  { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', marginBottom: 4 },
  pickIconBg:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pickTitle:     { color: C.text, fontSize: 16, fontWeight: '700' },
  pickSub:       { color: C.textTert, fontSize: 13 },
  pickFormatRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pickFormat:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  pickFormatTxt: { color: C.textSec, fontSize: 11, fontWeight: '600' },
  previewCard:   { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 14, overflow: 'hidden' },
  previewLeft:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewThumb:  { width: 48, height: 48, borderRadius: 12, backgroundColor: C.tealSoft, borderWidth: 1, borderColor: C.borderAcc, alignItems: 'center', justifyContent: 'center' },
  previewName:   { color: C.text, fontSize: 14, fontWeight: '700' },
  previewMeta:   { color: C.textTert, fontSize: 12, marginTop: 2 },
  removeBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  tipCard:       { flexDirection: 'row', gap: 10, backgroundColor: C.goldDim, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(245,200,66,0.18)', padding: 14 },
  tipTxt:        { flex: 1, color: C.textSec, fontSize: 12, lineHeight: 18 },
});