import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, MAX_DURATION } from './tokens';
import type { ReelMeta } from './types';

interface Props {
  meta:           ReelMeta;
  videoFileName:  string;
  trimStart:      number;
  trimEnd:        number;
  uploading:      boolean;
  uploadProgress: number;
  uploadMsg:      string;
  onUpload:       () => void;
}

const StepPublish = memo(function StepPublish({
  meta, trimStart, trimEnd,
  uploading, uploadProgress, uploadMsg, onUpload,
}: Props) {
  const trimDur = trimEnd - trimStart;
  const fmt     = (s: number) => `${Math.floor(s)}s`;

  const checks = useMemo(() => [
    { ok: meta.title.trim().length > 0,           txt: 'Titre renseigné' },
    { ok: meta.genre.length > 0,                  txt: 'Genre sélectionné' },
    { ok: trimDur > 0 && trimDur <= MAX_DURATION, txt: `Durée ≤ ${MAX_DURATION}s` },
    { ok: true,                                   txt: 'Tag #CinémaIndépendant' },
  ], [meta.title, meta.genre, trimDur]);

  const allOk = checks.every(c => c.ok);

  return (
    <View>
      <Text style={s.sectionTitle}>Aperçu et publication</Text>
      <Text style={s.hint}>Vérifiez les informations avant de publier votre Réel.</Text>

      {/* Reel preview card */}
      <View style={s.reelPreview}>
        <LinearGradient
          colors={['rgba(0,201,255,0.12)', 'rgba(3,0,10,0.95)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.reelFrame}>
          <LinearGradient
            colors={[C.teal, C.navy]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.reelFrameBg}
          >
            <View style={s.reelPlay}>
              <Ionicons name="play" size={22} color="white" />
            </View>
            <View style={s.reelDurBadge}>
              <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.8)" />
              <Text style={s.reelDurTxt}>{fmt(trimDur)}</Text>
            </View>
          </LinearGradient>
        </View>

        <View style={s.reelInfo}>
          <View style={s.genreTag}>
            <Text style={s.genreTagTxt}>{meta.genre || 'Cinéma'}</Text>
          </View>
          <Text style={s.reelTitle}>{meta.title || 'Sans titre'}</Text>
          {meta.director ? (
            <Text style={s.reelDir}>
              par {meta.director}{meta.year ? ` · ${meta.year}` : ''}
            </Text>
          ) : null}
          {meta.synopsis.length > 0 && (
            <Text style={s.reelSynopsis} numberOfLines={2}>{meta.synopsis}</Text>
          )}
        </View>
      </View>

      {/* Checklist */}
      <View style={s.checkList}>
        {checks.map(item => (
          <View key={item.txt} style={s.checkRow}>
            <Ionicons
              name={item.ok ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={item.ok ? C.green : C.red}
            />
            <Text style={[s.checkTxt, !item.ok && { color: C.red }]}>{item.txt}</Text>
          </View>
        ))}
      </View>

      {/* Upload progress */}
      {uploading && (
        <View style={s.progressWrap}>
          <View style={s.progressHeader}>
            <ActivityIndicator size="small" color={C.teal} />
            <Text style={s.progressMsg}>{uploadMsg}</Text>
          </View>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${uploadProgress}%` as any }]} />
          </View>
          <Text style={s.progressPct}>{uploadProgress}%</Text>
        </View>
      )}

      {/* CTA */}
      {!uploading && (
        <TouchableOpacity
          style={[s.cta, !allOk && { opacity: 0.4 }]}
          onPress={allOk ? onUpload : undefined}
          activeOpacity={0.88}
          disabled={!allOk}
        >
          <LinearGradient
            colors={[C.teal, C.navyMid, C.navy]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.ctaGrad}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="white" />
            <Text style={s.ctaTxt}>Publier dans mes Réels</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <Text style={s.legal}>
        En publiant, vous certifiez être l'auteur ou ayant-droits de cette œuvre
        et acceptez les conditions d'utilisation de la plateforme.
      </Text>
    </View>
  );
});

export default StepPublish;

const s = StyleSheet.create({
  sectionTitle:  { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  hint:          { color: C.textTert, fontSize: 13, lineHeight: 19, marginBottom: 20, fontStyle: 'italic' },
  reelPreview:   { borderRadius: 20, borderWidth: 1, borderColor: C.borderAcc, overflow: 'hidden', marginBottom: 20, padding: 16, gap: 14, flexDirection: 'row', alignItems: 'center' },
  reelFrame:     { width: 80, height: 120, borderRadius: 14, overflow: 'hidden' },
  reelFrameBg:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reelPlay:      { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  reelDurBadge:  { position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  reelDurTxt:    { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700' },
  reelInfo:      { flex: 1, gap: 5 },
  genreTag:      { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.tealMid, borderWidth: 1, borderColor: C.borderAcc },
  genreTagTxt:   { color: C.teal, fontSize: 10, fontWeight: '700' },
  reelTitle:     { color: C.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  reelDir:       { color: C.textSec, fontSize: 12 },
  reelSynopsis:  { color: C.textTert, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
  checkList:     { gap: 10, marginBottom: 24, backgroundColor: C.surf, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  checkRow:      { flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkTxt:      { color: C.textSec, fontSize: 13 },
  progressWrap:  { marginBottom: 20, gap: 8 },
  progressHeader:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressMsg:   { color: C.textSec, fontSize: 13 },
  progressBg:    { height: 4, borderRadius: 2, backgroundColor: C.surf, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 2, backgroundColor: C.teal },
  progressPct:   { color: C.teal, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  cta:           { borderRadius: 22, overflow: 'hidden', marginBottom: 14 },
  ctaGrad:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  ctaTxt:        { color: 'white', fontSize: 16, fontWeight: '800' },
  legal:         { color: C.textTert, fontSize: 10, textAlign: 'center', lineHeight: 15, fontStyle: 'italic' },
});