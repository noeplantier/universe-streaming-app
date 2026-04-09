import React, {
  useState, useRef, useCallback, useMemo, useEffect, memo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, KeyboardAvoidingView, Platform, Alert,
  Dimensions, TextInput, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useRouter }      from 'expo-router';
import * as ImagePicker   from 'expo-image-picker';
import * as FileSystem    from 'expo-file-system';
import * as Haptics       from 'expo-haptics';

import GalaxyBackground from '@/components/social/GalaxyBackground';
import { supabase }     from '@/lib/supabase';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS  (alignés sur social.tsx)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg0:       '#07000F',
  bg1:       '#0D0020',
  surf:      'rgba(255,255,255,0.055)',
  surfHi:    'rgba(255,255,255,0.09)',
  border:    'rgba(255,255,255,0.08)',
  borderHi:  'rgba(255,255,255,0.18)',
  borderAcc: 'rgba(192,96,255,0.35)',
  text:      '#F3EDFF',
  textSec:   '#9B94AA',
  textTert:  '#584F66',
  gold:      '#F5C842',
  goldDim:   'rgba(245,200,66,0.14)',
  violet:    '#9B6DCA',          // moins flashy que C060FF
  violetSoft:'rgba(155,109,202,0.12)',
  violetMid: 'rgba(155,109,202,0.25)',
  green:     '#30D158',
  greenDim:  'rgba(48,209,88,0.14)',
  red:       '#FF3B5C',
  teal:      '#5AC8FA',
  tealDim:   'rgba(90,200,250,0.12)',
} as const;

const GENRES = [
  'Drame', 'Thriller', 'Documentaire', 'Sci-Fi',
  'Animation', 'Expérimental', 'Biopic', 'Court métrage',
] as const;

const MAX_DURATION = 15; // secondes — micro-format reel
const MOCK_UID     = 'mock-user-id'; // remplacer par auth.uid()

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Step = 0 | 1 | 2;

interface ReelMeta {
  title:     string;
  genre:     string;
  director:  string;
  year:      string;
  synopsis:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE HELPER
// ─────────────────────────────────────────────────────────────────────────────
async function uploadReelToSupabase(
  localUri: string,
  meta:     ReelMeta,
  onProgress: (pct: number, msg: string) => void,
): Promise<{ id: string; video_url: string } | null> {
  try {
    onProgress(10, 'Préparation du fichier…');
    
    // Correction de l'extraction de l'extension pour gérer les URLs "blob:"
    const isBlob = localUri.startsWith('blob:');
    const ext = isBlob ? 'mp4' : (localUri.split('.').pop() ?? 'mp4');
    const filename = `reel_${Date.now()}.${ext}`;
    
    // Convertir en ArrayBuffer pour un upload plus robuste au lieu d'un Blob pur
    const response = await fetch(localUri);
    const arrayBuffer = await response.arrayBuffer();

    onProgress(30, 'Upload en cours…');
    const { data: storageData, error: storageError } = await supabase.storage
      .from('social')
      .upload(`videos/${filename}`, arrayBuffer, { 
         contentType: `video/${ext}`, 
         upsert: false 
        });

    if (storageError) throw storageError;

    onProgress(70, 'Finalisation…');
    // Remplacement du bucket 'reels' par 'social'
    const videoUrl = supabase.storage.from('social').getPublicUrl(storageData.path).data.publicUrl;

    const { data, error } = await supabase
      .from('reels') // Je suppose que la table BDD s'appelle toujours 'reels'
      .insert({
        user_id:   MOCK_UID,
        video_url: videoUrl,
        title:     meta.title.trim(),
        genre:     meta.genre,
        director:  meta.director.trim(),
        year:      meta.year.trim(),
        synopsis:  meta.synopsis.trim(),
        duration:  MAX_DURATION,
        likes_count: 0,
        views_count: 0,
      })
      .select('id, video_url')
      .single();

    if (error) throw error;
    onProgress(100, 'Publié !');
    return data as { id: string; video_url: string };
  } catch (e) {
    console.error('[uploadReel]', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
const STEP_LABELS = ['Import', 'Infos', 'Publication'] as const;

const StepIndicator = memo(function StepIndicator({ step }: { step: Step }) {
  return (
    <View style={si.wrap}>
      {STEP_LABELS.map((label, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <React.Fragment key={label}>
            <View style={si.item}>
              <View style={[si.dot, done && si.dotDone, active && si.dotActive, !done && !active && si.dotInactive]}>
                {done
                  ? <Ionicons name="checkmark" size={11} color="white" />
                  : <Text style={[si.dotTxt, active && { color: 'white' }]}>{i + 1}</Text>
                }
              </View>
              <Text style={[si.label, active && si.labelActive, done && si.labelDone]}>
                {label}
              </Text>
            </View>
            {i < STEP_LABELS.length - 1 && (
              <View style={[si.line, done && si.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
});

const si = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, marginBottom: 24 },
  item:       { alignItems: 'center', gap: 5 },
  dot:        { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  dotActive:  { backgroundColor: C.violet, borderColor: C.violet },
  dotDone:    { backgroundColor: C.green,  borderColor: C.green },
  dotTxt:     { color: C.textTert, fontSize: 12, fontWeight: '700' },
  label:      { color: C.textTert, fontSize: 10, fontWeight: '600' },
  labelActive:{ color: C.text },
  labelDone:  { color: C.green },
  line:       { flex: 1, height: 1, backgroundColor: C.border, marginBottom: 14, marginHorizontal: 6 },
  lineDone:   { backgroundColor: C.green },
});

// ─────────────────────────────────────────────────────────────────────────────
// TRIM SLIDER  (durée ≤ 15 sec)
// ─────────────────────────────────────────────────────────────────────────────
const TRIM_W = W - 56;

const TrimBar = memo(function TrimBar({
  duration, trimStart, trimEnd, onChange,
}: {
  duration: number;
  trimStart: number;
  trimEnd: number;
  onChange: (start: number, end: number) => void;
}) {
  const trimDur = Math.max(0, trimEnd - trimStart);
  const overMax = trimDur > MAX_DURATION;

  const leftPct  = duration > 0 ? trimStart / duration : 0;
  const rightPct = duration > 0 ? trimEnd   / duration : 1;

  const fmt = (s: number) => `${Math.floor(s)}s`;

  return (
    <View style={tb.wrap}>
      <View style={tb.header}>
        <Text style={tb.label}>Passage sélectionné</Text>
        <View style={[tb.durBadge, overMax && tb.durBadgeErr]}>
          <Ionicons name="time-outline" size={11} color={overMax ? C.red : C.green} />
          <Text style={[tb.durTxt, overMax && { color: C.red }]}>
            {fmt(trimDur)} / {MAX_DURATION}s max
          </Text>
        </View>
      </View>

      {/* Barre visuelle */}
      <View style={tb.track}>
        {/* Zone hors sélection gauche */}
        <View style={[tb.excluded, { width: `${leftPct * 100}%` }]} />
        {/* Zone sélectionnée */}
        <LinearGradient
          colors={overMax ? ['#FF3B5C55', '#FF3B5C88'] : [ '#0a2f63', 'rgba(90,200,250,0.5)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[tb.selected, { width: `${(rightPct - leftPct) * 100}%` }]}
        />
        {/* Zone hors sélection droite */}
        <View style={[tb.excluded, { flex: 1 }]} />
      </View>

      {/* Contrôles manuels */}
      <View style={tb.controls}>
        <View style={tb.ctrl}>
          <Text style={tb.ctrlLabel}>Début</Text>
          <View style={tb.ctrlRow}>
            <TouchableOpacity style={tb.ctrlBtn} onPress={() => onChange(Math.max(0, trimStart - 1), trimEnd)}>
              <Ionicons name="remove" size={14} color={C.textSec} />
            </TouchableOpacity>
            <Text style={tb.ctrlVal}>{fmt(trimStart)}</Text>
            <TouchableOpacity style={tb.ctrlBtn} onPress={() => onChange(Math.min(trimEnd - 1, trimStart + 1), trimEnd)}>
              <Ionicons name="add" size={14} color={C.textSec} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={tb.divider} />

        <View style={tb.ctrl}>
          <Text style={tb.ctrlLabel}>Fin</Text>
          <View style={tb.ctrlRow}>
            <TouchableOpacity style={tb.ctrlBtn} onPress={() => onChange(trimStart, Math.max(trimStart + 1, trimEnd - 1))}>
              <Ionicons name="remove" size={14} color={C.textSec} />
            </TouchableOpacity>
            <Text style={tb.ctrlVal}>{fmt(trimEnd)}</Text>
            <TouchableOpacity style={tb.ctrlBtn} onPress={() => onChange(trimStart, Math.min(duration, trimEnd + 1))}>
              <Ionicons name="add" size={14} color={C.textSec} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {overMax && (
        <Text style={tb.errTxt}>
          Réduisez la sélection à {MAX_DURATION} secondes maximum pour le format Réel.
        </Text>
      )}
    </View>
  );
});

const tb = StyleSheet.create({
  wrap:       { backgroundColor: C.surf, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  label:      { color: C.textSec, fontSize: 13, fontWeight: '700' },
  durBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: C.greenDim, borderWidth: 1, borderColor: 'rgba(48,209,88,0.25)' },
  durBadgeErr:{ backgroundColor: 'rgba(255,59,92,0.12)', borderColor: 'rgba(255,59,92,0.3)' },
  durTxt:     { color: C.green, fontSize: 11, fontWeight: '700' },
  track:      { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', overflow: 'hidden', marginBottom: 16 },
  excluded:   { height: '100%', backgroundColor: 'rgba(255,255,255,0.04)' },
  selected:   { height: '100%' },
  controls:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctrl:       { flex: 1, alignItems: 'center', gap: 6 },
  ctrlLabel:  { color: C.textTert, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  ctrlRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctrlBtn:    { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surfHi, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  ctrlVal:    { color: C.text, fontSize: 15, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  divider:    { width: 1, height: 36, backgroundColor: C.border },
  errTxt:     { color: C.red, fontSize: 11, marginTop: 10, textAlign: 'center', fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 0 — IMPORT
// ─────────────────────────────────────────────────────────────────────────────
const StepImport = memo(function StepImport({
  videoUri, videoFileName, videoDuration,
  trimStart, trimEnd,
  onPick, onRemove, onTrimChange,
}: {
  videoUri:      string | null;
  videoFileName: string;
  videoDuration: number;
  trimStart:     number;
  trimEnd:       number;
  onPick:        () => void;
  onRemove:      () => void;
  onTrimChange:  (s: number, e: number) => void;
}) {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View>
      <Text style={imp.sectionTitle}>Sélectionnez votre passage</Text>
      <Text style={imp.hint}>
        Choisissez le moment le plus fort de votre film — 15 secondes maximum pour le format Réel.
      </Text>

      {!videoUri ? (
        <TouchableOpacity style={imp.pickZone} onPress={onPick} activeOpacity={0.85}>
          <LinearGradient
            colors={['#0a2f63', 'rgba(90,200,250,0.05)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          <View style={imp.pickIconWrap}>
            <LinearGradient colors={[C.violet, '#0a2f63']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={imp.pickIconBg}>
              <Ionicons name="film-outline" size={28} color="white" />
            </LinearGradient>
          </View>
          <Text style={imp.pickTitle}>Importer une vidéo</Text>
          <Text style={imp.pickSub}>MP4 · MOV · Galerie</Text>
          <View style={imp.pickFormatRow}>
            {['MP4', 'MOV', 'ProRes', 'HEVC'].map(f => (
              <View key={f} style={imp.pickFormat}>
                <Text style={imp.pickFormatTxt}>{f}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      ) : (
        <>
          {/* Preview card */}
          <View style={imp.previewCard}>
            <LinearGradient colors={[C.violetSoft, 'transparent']} style={StyleSheet.absoluteFill} />
            <View style={imp.previewLeft}>
              <View style={imp.previewThumb}>
                <Ionicons name="play-circle" size={28} color={C.violet} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={imp.previewName} numberOfLines={1}>{videoFileName || 'Vidéo importée'}</Text>
                <Text style={imp.previewMeta}>Durée totale : {fmt(videoDuration)}</Text>
              </View>
            </View>
            <TouchableOpacity style={imp.removeBtn} onPress={onRemove}>
              <Ionicons name="close" size={16} color={C.textSec} />
            </TouchableOpacity>
          </View>

          {/* Trim */}
          <TrimBar
            duration={videoDuration}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onChange={onTrimChange}
          />

          {/* Conseil */}
          <View style={imp.tipCard}>
            <Ionicons name="bulb-outline" size={16} color={C.gold} style={{ marginTop: 1 }} />
            <Text style={imp.tipTxt}>
              Choisissez le passage le plus marquant — une scène clé, un plan fort, un moment d'émotion intense.
              C'est cette fenêtre de {MAX_DURATION}s qui donnera envie de découvrir votre film.
            </Text>
          </View>
        </>
      )}
    </View>
  );
});

const imp = StyleSheet.create({
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  hint:         { color: C.textTert, fontSize: 13, lineHeight: 19, marginBottom: 20, fontStyle: 'italic' },
  pickZone:     { borderRadius: 22, borderWidth: 1.5, borderColor: C.borderAcc, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12, overflow: 'hidden', marginBottom: 16 },
  pickIconWrap: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', marginBottom: 4 },
  pickIconBg:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pickTitle:    { color: C.text, fontSize: 16, fontWeight: '700' },
  pickSub:      { color: C.textTert, fontSize: 13 },
  pickFormatRow:{ flexDirection: 'row', gap: 8, marginTop: 4 },
  pickFormat:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  pickFormatTxt:{ color: C.textSec, fontSize: 11, fontWeight: '600' },
  previewCard:  { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 14, overflow: 'hidden' },
  previewLeft:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.violetSoft, borderWidth: 1, borderColor: C.borderAcc, alignItems: 'center', justifyContent: 'center' },
  previewName:  { color: C.text, fontSize: 14, fontWeight: '700' },
  previewMeta:  { color: C.textTert, fontSize: 12, marginTop: 2 },
  removeBtn:    { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  tipCard:      { flexDirection: 'row', gap: 10, backgroundColor: C.goldDim, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(245,200,66,0.2)', padding: 14 },
  tipTxt:       { flex: 1, color: C.textSec, fontSize: 12, lineHeight: 18 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — INFOS
// ─────────────────────────────────────────────────────────────────────────────
const StepInfos = memo(function StepInfos({
  meta, onChange,
}: {
  meta:     ReelMeta;
  onChange: <K extends keyof ReelMeta>(key: K, val: string) => void;
}) {
  return (
    <View>
      <Text style={inf.sectionTitle}>Présentez votre film</Text>
      <Text style={inf.hint}>Ces informations apparaîtront sur votre Réel.</Text>

      {/* Titre */}
      <View style={inf.field}>
        <Text style={inf.label}>TITRE DU FILM *</Text>
        <TextInput
          style={inf.input}
          placeholder="Ex : Les Silences du Lac"
          placeholderTextColor={C.textTert}
          value={meta.title}
          onChangeText={v => onChange('title', v)}
        />
      </View>

      {/* Réalisateur + Année */}
      <View style={inf.row2}>
        <View style={[inf.field, { flex: 1 }]}>
          <Text style={inf.label}>RÉALISATEUR</Text>
          <TextInput style={inf.input} placeholder="Prénom Nom" placeholderTextColor={C.textTert} value={meta.director} onChangeText={v => onChange('director', v)} />
        </View>
        <View style={[inf.field, { width: 88 }]}>
          <Text style={inf.label}>ANNÉE</Text>
          <TextInput style={inf.input} placeholder="2025" placeholderTextColor={C.textTert} value={meta.year} onChangeText={v => onChange('year', v)} keyboardType="numeric" maxLength={4} />
        </View>
      </View>

      {/* Genre */}
      <View style={inf.field}>
        <Text style={inf.label}>GENRE *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {GENRES.map(g => {
            const on = meta.genre === g;
            return (
              <TouchableOpacity
                key={g}
                style={[inf.chip, on && inf.chipOn]}
                onPress={() => onChange('genre', on ? '' : g)}
              >
                <Text style={[inf.chipTxt, on && inf.chipTxtOn]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Synopsis court */}
      <View style={inf.field}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={inf.label}>ACCROCHE</Text>
          <Text style={{ color: C.textTert, fontSize: 10 }}>{meta.synopsis.length}/120</Text>
        </View>
        <TextInput
          style={[inf.input, inf.textarea]}
          multiline
          placeholder="Une phrase qui donne envie de découvrir votre film…"
          placeholderTextColor={C.textTert}
          value={meta.synopsis}
          onChangeText={v => v.length <= 120 && onChange('synopsis', v)}
          textAlignVertical="top"
        />
      </View>

      {/* Tag "Cinéma indépendant" info */}
      <View style={inf.indieBadge}>
        <Ionicons name="ribbon-outline" size={14} color={C.violet} />
        <Text style={inf.indieTxt}>Votre Réel sera taggé <Text style={{ color: C.violet, fontWeight: '700' }}>#CinémaIndépendant</Text> automatiquement.</Text>
      </View>
    </View>
  );
});

const inf = StyleSheet.create({
  sectionTitle:{ color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  hint:        { color: C.textTert, fontSize: 13, lineHeight: 19, marginBottom: 20, fontStyle: 'italic' },
  field:       { marginBottom: 20 },
  label:       { color: C.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  input:       { backgroundColor: C.surf, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 13, color: C.text, fontSize: 15 },
  textarea:    { minHeight: 80, lineHeight: 21 },
  row2:        { flexDirection: 'row', gap: 10, marginBottom: 20 },
  chip:        { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  chipOn:      { backgroundColor: C.violetMid, borderColor: C.violet },
  chipTxt:     { color: C.textSec, fontSize: 13, fontWeight: '600' },
  chipTxtOn:   { color: '#D4B8F5', fontWeight: '700' },
  indieBadge:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.violetSoft, borderRadius: 14, borderWidth: 1, borderColor: C.borderAcc, padding: 14 },
  indieTxt:    { flex: 1, color: C.textSec, fontSize: 12, lineHeight: 18 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — PUBLICATION
// ─────────────────────────────────────────────────────────────────────────────
const StepPublish = memo(function StepPublish({
  meta, videoFileName, trimStart, trimEnd,
  uploading, uploadProgress, uploadMsg,
  onUpload,
}: {
  meta:           ReelMeta;
  videoFileName:  string;
  trimStart:      number;
  trimEnd:        number;
  uploading:      boolean;
  uploadProgress: number;
  uploadMsg:      string;
  onUpload:       () => void;
}) {
  const trimDur = trimEnd - trimStart;
  const fmt     = (s: number) => `${Math.floor(s)}s`;

  return (
    <View>
      <Text style={pub.sectionTitle}>Aperçu et publication</Text>
      <Text style={pub.hint}>Vérifiez les informations avant de publier votre Réel.</Text>

      {/* Preview card style "reel" */}
      <View style={pub.reelPreview}>
        <LinearGradient
          colors={['rgba(155,109,202,0.18)', 'rgba(7,0,15,0.9)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Fake reel frame */}
        <View style={pub.reelFrame}>
          <View style={pub.reelPlay}>
            <LinearGradient colors={[C.violet, '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={pub.reelPlayBg}>
              <Ionicons name="play" size={22} color="white" />
            </LinearGradient>
          </View>
          <View style={pub.reelDurBadge}>
            <Ionicons name="time-outline" size={10} color="white" />
            <Text style={pub.reelDurTxt}>{fmt(trimDur)}</Text>
          </View>
        </View>

        {/* Infos */}
        <View style={pub.reelInfo}>
          <View style={pub.genreTag}>
            <Text style={pub.genreTagTxt}>{meta.genre || 'Cinéma'}</Text>
          </View>
          <Text style={pub.reelTitle}>{meta.title || 'Sans titre'}</Text>
          {meta.director ? <Text style={pub.reelDir}>par {meta.director}{meta.year ? ` · ${meta.year}` : ''}</Text> : null}
          {meta.synopsis.length > 0 && (
            <Text style={pub.reelSynopsis} numberOfLines={2}>{meta.synopsis}</Text>
          )}
        </View>
      </View>

      {/* Checklist */}
      <View style={pub.checkList}>
        {([
          { ok: meta.title.trim().length > 0,  txt: 'Titre renseigné' },
          { ok: meta.genre.length > 0,          txt: 'Genre sélectionné' },
          { ok: trimDur > 0 && trimDur <= MAX_DURATION, txt: `Durée ≤ ${MAX_DURATION}s` },
          { ok: true,                           txt: 'Tag #CinémaIndépendant' },
        ]).map(item => (
          <View key={item.txt} style={pub.checkRow}>
            <Ionicons name={item.ok ? 'checkmark-circle' : 'close-circle'} size={16} color={item.ok ? C.green : C.red} />
            <Text style={[pub.checkTxt, !item.ok && { color: C.red }]}>{item.txt}</Text>
          </View>
        ))}
      </View>

      {/* Barre de progression upload */}
      {uploading && (
        <View style={pub.progressWrap}>
          <View style={pub.progressHeader}>
            <ActivityIndicator size="small" color={C.violet} />
            <Text style={pub.progressMsg}>{uploadMsg}</Text>
          </View>
          <View style={pub.progressBg}>
            <Animated.View style={[pub.progressFill, { width: `${uploadProgress}%` as any }]} />
          </View>
          <Text style={pub.progressPct}>{uploadProgress}%</Text>
        </View>
      )}

      {/* CTA */}
      {!uploading && (
        <TouchableOpacity style={pub.cta} onPress={onUpload} activeOpacity={0.88}>
          <LinearGradient
            colors={[C.violet, '#0a2f63',  '#0a2f63']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={pub.ctaGrad}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="white" />
            <Text style={pub.ctaTxt}>Publier dans mes Réels</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <Text style={pub.legal}>
        En publiant, vous certifiez être l'auteur ou ayant-droits de cette œuvre
        et acceptez les conditions d'utilisation de la plateforme.
      </Text>
    </View>
  );
});

const pub = StyleSheet.create({
  sectionTitle:  { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  hint:          { color: C.textTert, fontSize: 13, lineHeight: 19, marginBottom: 20, fontStyle: 'italic' },
  reelPreview:   { borderRadius: 20, borderWidth: 1, borderColor: C.borderAcc, overflow: 'hidden', marginBottom: 20, padding: 16, gap: 14, flexDirection: 'row', alignItems: 'center' },
  reelFrame:     { width: 80, height: 120, borderRadius: 14, backgroundColor: C.violetSoft, borderWidth: 1, borderColor: C.borderAcc, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  reelPlay:      { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  reelPlayBg:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reelDurBadge:  { position: 'absolute', bottom: 6, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  reelDurTxt:    { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700' },
  reelInfo:      { flex: 1, gap: 5 },
  genreTag:      { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.violetMid, borderWidth: 1, borderColor: C.borderAcc },
  genreTagTxt:   { color:  '#0a2f63', fontSize: 10, fontWeight: '700' },
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
  progressFill:  { height: '100%', borderRadius: 2, backgroundColor: C.violet },
  progressPct:   { color: C.violet, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  cta:           { borderRadius: 22, overflow: 'hidden', marginBottom: 14 },
  ctaGrad:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  ctaTxt:        { color: 'white', fontSize: 16, fontWeight: '800' },
  legal:         { color: C.textTert, fontSize: 10, textAlign: 'center', lineHeight: 15, fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const router = useRouter();

  // ── État wizard ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(0);

  // ── Vidéo ─────────────────────────────────────────────────────────────────
  const [videoUri,      setVideoUri]      = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart,     setTrimStart]     = useState(0);
  const [trimEnd,       setTrimEnd]       = useState(0);
  const [activeTab, setActiveTab] = useState<'video' | 'critiques'>('video');


    // 2. États pour le CritiquePanel
    const [filmTitle, setFilmTitle] = useState('');
    const [critiqueText, setCritiqueText] = useState('');
    const [publishing, setPublishing] = useState(false);
  
    const handlePublishCritique = async () => {
      setPublishing(true);
      // Logique de publication API ici...
      setPublishing(false);
    };
  

  // ── Métadonnées ───────────────────────────────────────────────────────────
  const [meta, setMeta] = useState<ReelMeta>({
    title: '', genre: '', director: '', year: String(new Date().getFullYear()), synopsis: '',
  });

  const patchMeta = useCallback(<K extends keyof ReelMeta>(key: K, val: string) => {
    setMeta(m => ({ ...m, [key]: val }));
  }, []);

  // ── Upload ────────────────────────────────────────────────────────────────
  const [uploading,       setUploading]       = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [uploadMsg,       setUploadMsg]       = useState('');

  // ── Animation step ────────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(0)).current;
  const prevStep  = useRef<Step>(0);

  useEffect(() => {
    const dir = step > prevStep.current ? 1 : -1;
    prevStep.current = step;
    slideAnim.setValue(dir * W * 0.08);
    Animated.spring(slideAnim, { toValue: 0, tension: 180, friction: 22, useNativeDriver: true }).start();
  }, [step]);

  // ── Pick vidéo ────────────────────────────────────────────────────────────
  const pickVideo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès à la galerie dans les réglages.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1, videoMaxDuration: 3600, allowsEditing: false,
    });
    if (res.canceled || !res.assets[0]) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const asset = res.assets[0];
    const dur   = Math.floor(asset.duration ?? 30);
    setVideoUri(asset.uri);
    setVideoFileName(asset.fileName ?? asset.uri.split('/').pop() ?? 'video');
    setVideoDuration(dur);
    // Proposer automatiquement les 15 premières secondes
    setTrimStart(0);
    setTrimEnd(Math.min(dur, MAX_DURATION));
  }, []);

  const removeVideo = useCallback(() => {
    setVideoUri(null); setVideoFileName(''); setVideoDuration(0);
    setTrimStart(0); setTrimEnd(0);
  }, []);

  const handleTrimChange = useCallback((s: number, e: number) => {
    setTrimStart(s); setTrimEnd(e);
  }, []);

  // ── Validation par étape ──────────────────────────────────────────────────
  const canContinue = useMemo(() => {
    if (step === 0) return !!videoUri && (trimEnd - trimStart) > 0 && (trimEnd - trimStart) <= MAX_DURATION;
    if (step === 1) return meta.title.trim().length > 0 && meta.genre.length > 0;
    return true;
  }, [step, videoUri, trimStart, trimEnd, meta]);

  const errorHint = useMemo(() => {
    if (step === 0) {
      if (!videoUri) return 'Importez une vidéo pour continuer';
      if ((trimEnd - trimStart) > MAX_DURATION) return `Réduisez la sélection à ${MAX_DURATION}s max`;
      if ((trimEnd - trimStart) <= 0) return 'Sélectionnez une durée valide';
    }
    if (step === 1) {
      if (!meta.title.trim()) return 'Renseignez le titre du film';
      if (!meta.genre) return 'Sélectionnez un genre';
    }
    return '';
  }, [step, videoUri, trimStart, trimEnd, meta]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (!canContinue) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 2) setStep(s => (s + 1) as Step);
  }, [canContinue, step]);

  const goPrev = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 0) setStep(s => (s - 1) as Step);
    else router.back();
  }, [step, router]);

  // ── Upload + navigation vers reels ───────────────────────────────────────
const handleUpload = useCallback(async () => {
  if (!videoUri || uploading) return;

  setUploading(true);
  setUploadProgress(0);

  const result = await uploadReelToSupabase(
    videoUri,
    meta,
    (pct, msg) => {
      setUploadProgress(pct);
      setUploadMsg(msg);
    },
  );

  setUploading(false);

  if (result) {
    router.replace({
      pathname: '/(tabs)/reels',
      params: { newReelId: result.id },
    });
  } else {
    Alert.alert('Erreur', 'Upload échoué');
  }
}, [videoUri, meta, uploading]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <View style={s.header}>
         
            <View style={{ flex: 1 }}>
            </View>
          </View>

          {/* ── Step indicator ─────────────────────────────────────────────── */}
          <StepIndicator step={step} />

          {/* ── Contenu ────────────────────────────────────────────────────── */}
          <Animated.ScrollView
            style={{ flex: 1, transform: [{ translateX: slideAnim }] }}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 0 && (
              <StepImport
                videoUri={videoUri}
                videoFileName={videoFileName}
                videoDuration={videoDuration}
                trimStart={trimStart}
                trimEnd={trimEnd}
                onPick={pickVideo}
                onRemove={removeVideo}
                onTrimChange={handleTrimChange}
              />
            )}

            {step === 1 && (
              <StepInfos meta={meta} onChange={patchMeta} />
            )}

            {step === 2 && (
              <StepPublish
                meta={meta}
                videoFileName={videoFileName}
                trimStart={trimStart}
                trimEnd={trimEnd}
                uploading={uploading}
                uploadProgress={uploadProgress}
                uploadMsg={uploadMsg}
                onUpload={handleUpload}
              />
            )}

            <View style={{ height: 40 }} />
          </Animated.ScrollView>

          {/* ── Footer navigation ───────────────────────────────────────────── */}
          {step < 2 && (
            <View style={s.footer}>
              <View style={s.footerRow}>
                {step > 0 && (
                  <TouchableOpacity style={s.footerBack} onPress={goPrev}>
                    <Ionicons name="chevron-back" size={18} color={C.textSec} />
                    <Text style={s.footerBackTxt}>Retour</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.footerNext, !canContinue && s.footerNextDisabled, step === 0 && { marginLeft: 'auto' as any }]}
                  onPress={goNext}
                  disabled={!canContinue}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={canContinue ? [C.violet, '#7B6DB0'] : [C.surf, C.surf]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.footerNextGrad}
                  >
                    <Text style={[s.footerNextTxt, !canContinue && { color: C.textTert }]}>
                      {step === 0 ? 'Informations' : 'Aperçu'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={canContinue ? 'white' : C.textTert} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {!canContinue && errorHint.length > 0 && (
                <Text style={s.footerHint}>{errorHint}</Text>
              )}
            </View>
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES PRINCIPAUX
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg0 },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 },
  backBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  headerSub:      { color: C.textTert, fontSize: 11, marginTop: 1 },
  skipBtn:        { paddingHorizontal: 14, paddingVertical: 8 },
  skipTxt:        { color: C.violet, fontSize: 14, fontWeight: '700' },
  scroll:         { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 },
  footer:         { position: 'absolute', bottom: 80, left: 0, right: 0, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 16, zIndex: 10 },
  footerRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerBack:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 14 },
  footerBackTxt:  { color: C.textSec, fontSize: 14, fontWeight: '600' },
  footerNext:     { flex: 1, borderRadius: 22, overflow: 'hidden' },
  footerNextDisabled: { opacity: 0.5 },
  footerNextGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  footerNextTxt:  { color: 'white', fontSize: 15, fontWeight: '700' },
  footerHint:     { textAlign: 'center', color: C.textTert, fontSize: 11, marginTop: 8, fontStyle: 'italic' },
});