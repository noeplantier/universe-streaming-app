/* eslint-disable react/display-name */
/**
 * create.tsx — Écran de création complet
 * • Tab Vidéo  : wizard 3 étapes + upload Supabase Storage + POST API
 * • Tab Critique: composant autonome (CritiqueTab)
 * • Design     : glass morphism, quasi-transparent, GalaxyBackground visible
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState, memo,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { BlurView }      from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useRouter }     from 'expo-router';
import * as FileSystem   from 'expo-file-system';
import * as Haptics      from 'expo-haptics';
import * as ImagePicker  from 'expo-image-picker';
import { decode }        from 'base64-arraybuffer';

import GalaxyBackground from '@/components/social/GalaxyBackground';
import CritiqueTab      from '@/components/create/CritiqueTab';
import TrimBar          from '@/components/create/TrimBar';
import { supabase }     from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window');
const MAX_DURATION = 15;

const GENRES = [
  'Drame', 'Thriller', 'Documentaire', 'Sci-Fi',
  'Animation', 'Expérimental', 'Biopic', 'Court métrage',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE — deep-space glass
// ─────────────────────────────────────────────────────────────────────────────
const P = {
  bg:           '#03000A',
  glass:        'rgba(255,255,255,0.04)',
  glassMid:     'rgba(255,255,255,0.07)',
  glassHi:      'rgba(255,255,255,0.11)',
  edge:         'rgba(255,255,255,0.08)',
  edgeMid:      'rgba(255,255,255,0.14)',
  edgeHi:       'rgba(255,255,255,0.22)',
  white:        '#FFFFFF',
  txt:          '#EDF6FF',
  txtSec:       'rgba(255,255,255,0.50)',
  txtTert:      'rgba(255,255,255,0.24)',
  teal:         '#00C9FF',
  tealGlass:    'rgba(0,201,255,0.08)',
  tealEdge:     'rgba(0,201,255,0.22)',
  navy:         '#0A1628',
  navyMid:      '#0D2240',
  green:        '#2ECC8A',
  greenGlass:   'rgba(46,204,138,0.10)',
  greenEdge:    'rgba(46,204,138,0.22)',
  gold:         '#F5C842',
  goldGlass:    'rgba(245,200,66,0.08)',
  goldEdge:     'rgba(245,200,66,0.18)',
  red:          '#FF3B5C',
  redGlass:     'rgba(255,59,92,0.10)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Tab  = 'video' | 'critique';
type Step = 0 | 1 | 2;

interface ReelMeta {
  title:    string;
  genre:    string;
  director: string;
  year:     string;
  synopsis: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD — Supabase Storage + POST to API route
// ─────────────────────────────────────────────────────────────────────────────
async function uploadReel(
  localUri:   string,
  meta:       ReelMeta,
  userId:     string,
  onProgress: (pct: number, msg: string) => void,
): Promise<{ id: string; video_url: string } | null> {
  try {
    onProgress(5, 'Préparation…');

    const isBlob   = localUri.startsWith('blob:');
    const rawExt   = isBlob ? 'mp4' : (localUri.split('.').pop()?.toLowerCase() ?? 'mp4');
    const ext      = rawExt === 'mov' ? 'mp4' : rawExt;
    const mime     = ext === 'mp4' ? 'video/mp4' : ext === 'webm' ? 'video/webm' : `video/${ext}`;
    const filename = `reel_${userId}_${Date.now()}.${ext}`;

    // ── Lire le fichier ────────────────────────────────────────────────────
    onProgress(15, 'Lecture du fichier…');

    let payload: ArrayBuffer | Blob;

    if (Platform.OS === 'web' || isBlob) {
      const res = await fetch(localUri);
      payload   = await res.blob();            // Blob natif Web
    } else {
      // iOS / Android → base64 + decode ArrayBuffer
      const b64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64',
      });
      payload = decode(b64);
    }

    // ── Upload Storage ─────────────────────────────────────────────────────
    onProgress(30, 'Upload vidéo…');

    const { data: storageData, error: storageErr } = await supabase.storage
      .from('social')
      .upload(`videos/${filename}`, payload as any, {
        contentType: mime,
        upsert:      false,
      });

    if (storageErr) throw storageErr;

    onProgress(65, 'Métadonnées…');

    const videoUrl = supabase.storage
      .from('social')
      .getPublicUrl(storageData.path).data.publicUrl;

    // ── POST to API route (index.tsx / reels endpoint) ─────────────────────
    // Construit un FormData pour le POST — compatible Expo Router API routes
    const form = new FormData();
    form.append('user_id',  userId);
    form.append('video_url', videoUrl);
    form.append('title',    meta.title.trim());
    form.append('genre',    meta.genre);
    form.append('director', meta.director.trim());
    form.append('year',     meta.year.trim());
    form.append('synopsis', meta.synopsis.trim());
    form.append('duration', String(MAX_DURATION));

    onProgress(80, 'Publication…');

    // Tentative POST vers l'API route
    // → Ajustez l'URL selon votre endpoint Expo Router (ex: /api/reels)
    let reelId: string | null = null;

    try {
      const apiRes = await fetch('/api/reels', {
        method:  'POST',
        body:    form,
        headers: { Accept: 'application/json' },
      });

      if (apiRes.ok) {
        const json = await apiRes.json();
        reelId = json?.id ?? null;
      }
    } catch {
      // L'API route n'est pas joignable → fallback direct Supabase
    }

    // ── Fallback : insert Supabase si POST API échoue ─────────────────────
    if (!reelId) {
      const { data, error } = await supabase
        .from('reels')
        .insert({
          user_id:     userId,
          video_url:   videoUrl,
          title:       meta.title.trim(),
          genre:       meta.genre,
          director:    meta.director.trim(),
          year:        meta.year.trim(),
          synopsis:    meta.synopsis.trim(),
          duration:    MAX_DURATION,
          likes_count: 0,
          views_count: 0,
          created_at:  new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;
      reelId = data?.id ?? null;
    }

    if (!reelId) throw new Error('No reel ID returned');

    onProgress(100, 'Publié !');
    return { id: reelId, video_url: videoUrl };
  } catch (e) {
    console.error('[uploadReel]', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLASS CARD — wrapper semi-transparent
// ─────────────────────────────────────────────────────────────────────────────
interface GlassCardProps { children: React.ReactNode; style?: object }

const GlassCard = memo(({ children, style }: GlassCardProps) => (
  <View style={[gc.wrap, style]}>
    <BlurView
      intensity={Platform.OS === 'ios' ? 16 : 10}
      tint="dark"
      style={StyleSheet.absoluteFillObject}
    />
    {children}
  </View>
));
GlassCard.displayName = 'GlassCard';

const gc = StyleSheet.create({
  wrap: {
    borderRadius:    20,
    borderWidth:      0.5,
    borderColor:      P.edge,
    overflow:        'hidden',
    backgroundColor:  P.glass,
    marginBottom:     14,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
const STEP_LABELS = ['Import', 'Infos', 'Publier'] as const;

const StepIndicator = memo(({ step }: { step: Step }) => (
  <View style={si.wrap}>
    {STEP_LABELS.map((lbl, i) => {
      const done   = i < step;
      const active = i === step;
      return (
        <React.Fragment key={lbl}>
          <View style={si.item}>
            <View style={[si.dot, done && si.dotDone, active && si.dotActive]}>
              {done
                ? <Ionicons name="checkmark" size={10} color="white" />
                : <Text style={[si.dotNum, active && { color: P.white }]}>{i + 1}</Text>
              }
            </View>
            <Text style={[si.lbl, active && si.lblActive, done && si.lblDone]}>
              {lbl}
            </Text>
          </View>
          {i < STEP_LABELS.length - 1 && (
            <View style={[si.line, done && si.lineDone]} />
          )}
        </React.Fragment>
      );
    })}
  </View>
));

const si = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, marginBottom: 22 },
  item:      { alignItems: 'center', gap: 5 },
  dot:       { width: 26, height: 26, borderRadius: 13, backgroundColor: P.glass, borderWidth: 0.5, borderColor: P.edge, alignItems: 'center', justifyContent: 'center' },
  dotActive: { borderColor: P.edgeHi, backgroundColor: P.glassMid },
  dotDone:   { borderColor: P.greenEdge, backgroundColor: P.greenGlass },
  dotNum:    { color: P.txtTert, fontSize: 11, fontWeight: '700' },
  lbl:       { color: P.txtTert, fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  lblActive: { color: P.txt },
  lblDone:   { color: P.green },
  line:      { flex: 1, height: 0.5, backgroundColor: P.edge, marginBottom: 14, marginHorizontal: 6 },
  lineDone:  { backgroundColor: P.greenEdge },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 0 — IMPORT
// ─────────────────────────────────────────────────────────────────────────────
interface ImportProps {
  videoUri:      string | null;
  videoFileName: string;
  videoDuration: number;
  trimStart:     number;
  trimEnd:       number;
  onPick:        () => void;
  onRemove:      () => void;
  onTrimChange:  (s: number, e: number) => void;
}

const StepImport = memo(({
  videoUri, videoFileName, videoDuration,
  trimStart, trimEnd, onPick, onRemove, onTrimChange,
}: ImportProps) => {
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={{ gap: 10 }}>
      <Text style={step.title}>Votre extrait</Text>
      <Text style={step.hint}>Le passage le plus fort — {MAX_DURATION}s maximum.</Text>

      {!videoUri ? (
        /* ── Dropzone ── */
        <TouchableOpacity onPress={onPick} activeOpacity={0.85}>
          <GlassCard style={{ marginBottom: 0 }}>
            <View style={imp.zone}>
              {/* ring */}
              <View style={imp.ring}>
                <Ionicons name="film-outline" size={26} color={P.txtSec} />
              </View>
              <Text style={imp.zoneTitle}>Importer une vidéo</Text>
              <Text style={imp.zoneSub}>Depuis votre galerie</Text>
              <View style={imp.formats}>
                {['MP4', 'MOV', 'HEVC'].map(f => (
                  <View key={f} style={imp.fmt}>
                    <Text style={imp.fmtTxt}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          </GlassCard>
        </TouchableOpacity>
      ) : (
        <>
          {/* ── File card ── */}
          <GlassCard>
            <View style={imp.fileRow}>
              <View style={imp.fileIcon}>
                <Ionicons name="play-circle-outline" size={22} color={P.txtSec} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={imp.fileName} numberOfLines={1}>
                  {videoFileName || 'Vidéo importée'}
                </Text>
                <Text style={imp.fileMeta}>{fmt(videoDuration)}</Text>
              </View>
              <TouchableOpacity style={imp.removeBtn} onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={14} color={P.txtTert} />
              </TouchableOpacity>
            </View>
          </GlassCard>

          {/* ── Trim ── */}
          <TrimBar
            start={trimStart}
            end={trimEnd}
            duration={videoDuration}
            onStartChange={s => onTrimChange(s, trimEnd)}
            onEndChange={e => onTrimChange(trimStart, e)}
          />

          {/* ── Tip ── */}
          <GlassCard style={{ borderColor: P.goldEdge, backgroundColor: P.goldGlass }}>
            <View style={imp.tip}>
              <Ionicons name="bulb-outline" size={13} color={P.gold} style={{ marginTop: 1 }} />
              <Text style={imp.tipTxt}>
                Choisissez la scène la plus intense — c'est cette fenêtre de {MAX_DURATION}s
                qui décide si quelqu'un regarde votre film.
              </Text>
            </View>
          </GlassCard>
        </>
      )}
    </View>
  );
});
StepImport.displayName = 'StepImport';

const imp = StyleSheet.create({
  zone:       { alignItems: 'center', paddingVertical: 44, gap: 10 },
  ring:       { width: 60, height: 60, borderRadius: 30, borderWidth: 0.5, borderColor: P.edgeMid, alignItems: 'center', justifyContent: 'center', backgroundColor: P.glass, marginBottom: 6 },
  zoneTitle:  { color: P.txt, fontSize: 15, fontWeight: '700' },
  zoneSub:    { color: P.txtTert, fontSize: 12 },
  formats:    { flexDirection: 'row', gap: 6, marginTop: 6 },
  fmt:        { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, backgroundColor: P.glass, borderWidth: 0.5, borderColor: P.edge },
  fmtTxt:     { color: P.txtTert, fontSize: 10, fontWeight: '600' },
  fileRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  fileIcon:   { width: 42, height: 42, borderRadius: 12, backgroundColor: P.glass, borderWidth: 0.5, borderColor: P.edge, alignItems: 'center', justifyContent: 'center' },
  fileName:   { color: P.txt, fontSize: 13, fontWeight: '600' },
  fileMeta:   { color: P.txtTert, fontSize: 11, marginTop: 2 },
  removeBtn:  { width: 26, height: 26, borderRadius: 13, backgroundColor: P.glass, borderWidth: 0.5, borderColor: P.edge, alignItems: 'center', justifyContent: 'center' },
  tip:        { flexDirection: 'row', gap: 9, padding: 14 },
  tipTxt:     { flex: 1, color: P.txtSec, fontSize: 12, lineHeight: 18 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — INFOS
// ─────────────────────────────────────────────────────────────────────────────
interface InfosProps {
  meta:     ReelMeta;
  onChange: <K extends keyof ReelMeta>(k: K, v: string) => void;
}

const GlassInput = memo(({ value, onChangeText, placeholder, ...rest }: any) => (
  <TextInput
    style={inf.input}
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={P.txtTert}
    {...rest}
  />
));
GlassInput.displayName = 'GlassInput';

// eslint-disable-next-line react/display-name
const StepInfos = memo(({ meta, onChange }: InfosProps) => (
  <View style={{ gap: 10 }}>
    <Text style={step.title}>Votre film</Text>
    <Text style={step.hint}>Ces infos apparaîtront sur votre Réel.</Text>

    {/* Titre */}
    <GlassCard>
      <View style={inf.fieldWrap}>
        <Text style={inf.label}>TITRE *</Text>
        <GlassInput
          value={meta.title}
          onChangeText={(v: string) => onChange('title', v)}
          placeholder="Les Silences du Lac…"
        />
      </View>
    </GlassCard>

    {/* Réalisateur + Année */}
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <GlassCard style={{ flex: 1, marginBottom: 0 }}>
        <View style={inf.fieldWrap}>
          <Text style={inf.label}>RÉALISATEUR</Text>
          <GlassInput
            value={meta.director}
            onChangeText={(v: string) => onChange('director', v)}
            placeholder="Prénom Nom"
          />
        </View>
      </GlassCard>
      <GlassCard style={{ width: 90, marginBottom: 0 }}>
        <View style={inf.fieldWrap}>
          <Text style={inf.label}>ANNÉE</Text>
          <GlassInput
            value={meta.year}
            onChangeText={(v: string) => onChange('year', v)}
            placeholder="2025"
            keyboardType="numeric"
            maxLength={4}
          />
        </View>
      </GlassCard>
    </View>

    {/* Genre chips */}
    <GlassCard>
      <View style={inf.fieldWrap}>
        <Text style={inf.label}>GENRE *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
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
    </GlassCard>

    {/* Synopsis */}
    <GlassCard>
      <View style={inf.fieldWrap}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={inf.label}>ACCROCHE</Text>
          <Text style={{ color: P.txtTert, fontSize: 9 }}>{meta.synopsis.length}/120</Text>
        </View>
        <GlassInput
          value={meta.synopsis}
          onChangeText={(v: string) => v.length <= 120 && onChange('synopsis', v)}
          placeholder="Une phrase qui donne envie…"
          multiline
          style={[inf.input, { minHeight: 72, lineHeight: 20 }]}
          textAlignVertical="top"
        />
      </View>
    </GlassCard>

    {/* Auto-tag notice */}
    <GlassCard style={{ borderColor: P.tealEdge, backgroundColor: P.tealGlass }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
        <Ionicons name="ribbon-outline" size={13} color={P.teal} />
        <Text style={{ flex: 1, color: P.txtSec, fontSize: 11, lineHeight: 17 }}>
          Tagué <Text style={{ color: P.teal, fontWeight: '700' }}>#CinémaIndépendant</Text> automatiquement.
        </Text>
      </View>
    </GlassCard>
  </View>
));

const inf = StyleSheet.create({
  fieldWrap: { padding: 14 },
  label:     { color: P.txtTert, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  input:     { color: P.txt, fontSize: 14, fontWeight: '500', padding: 0 },
  chip:      { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16, backgroundColor: P.glass, borderWidth: 0.5, borderColor: P.edge },
  chipOn:    { backgroundColor: P.glassMid, borderColor: P.edgeHi },
  chipTxt:   { color: P.txtSec, fontSize: 12, fontWeight: '600' },
  chipTxtOn: { color: P.white, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — PUBLICATION
// ─────────────────────────────────────────────────────────────────────────────
interface PublishProps {
  meta:           ReelMeta;
  trimStart:      number;
  trimEnd:        number;
  uploading:      boolean;
  uploadProgress: number;
  uploadMsg:      string;
  onUpload:       () => void;
}

const StepPublish = memo(({
  meta, trimStart, trimEnd,
  uploading, uploadProgress, uploadMsg, onUpload,
}: PublishProps) => {
  const dur    = trimEnd - trimStart;
  const checks = useMemo(() => [
    { ok: meta.title.trim().length > 0,          txt: 'Titre renseigné' },
    { ok: meta.genre.length > 0,                 txt: 'Genre sélectionné' },
    { ok: dur > 0 && dur <= MAX_DURATION,         txt: `Extrait ≤ ${MAX_DURATION}s` },
    { ok: true,                                  txt: '#CinémaIndépendant' },
  ], [meta.title, meta.genre, dur]);
  const allOk = checks.every(c => c.ok);

  return (
    <View style={{ gap: 10 }}>
      <Text style={step.title}>Vérification</Text>
      <Text style={step.hint}>Un dernier regard avant publication.</Text>

      {/* Preview mini card */}
      <GlassCard style={{ borderColor: P.edgeMid }}>
        <View style={{ padding: 14, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={pub.thumb}>
              <Ionicons name="play" size={16} color={P.txtSec} />
              <Text style={pub.thumbDur}>{dur}s</Text>
            </View>
            <View style={{ flex: 1 }}>
              {meta.genre.length > 0 && (
                <Text style={pub.genre}>{meta.genre}</Text>
              )}
              <Text style={pub.filmTitle}>{meta.title || 'Sans titre'}</Text>
              {meta.director.length > 0 && (
                <Text style={pub.director}>
                  {meta.director}{meta.year ? ` · ${meta.year}` : ''}
                </Text>
              )}
            </View>
          </View>
          {meta.synopsis.length > 0 && (
            <Text style={pub.synopsis} numberOfLines={2}>{meta.synopsis}</Text>
          )}
        </View>
      </GlassCard>

      {/* Checklist */}
      <GlassCard>
        <View style={{ padding: 14, gap: 10 }}>
          {checks.map(c => (
            <View key={c.txt} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Ionicons
                name={c.ok ? 'checkmark-circle-outline' : 'close-circle-outline'}
                size={14}
                color={c.ok ? P.green : P.red}
              />
              <Text style={{ color: c.ok ? P.txtSec : P.red, fontSize: 12, fontWeight: '500' }}>
                {c.txt}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>

      {/* Upload progress */}
      {uploading && (
        <GlassCard>
          <View style={{ padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={P.white} />
              <Text style={{ color: P.txtSec, fontSize: 12 }}>{uploadMsg}</Text>
            </View>
            <View style={pub.progressBg}>
              <Animated.View style={[pub.progressFill, { width: `${uploadProgress}%` as any }]} />
            </View>
            <Text style={{ color: P.txtTert, fontSize: 10, textAlign: 'right' }}>
              {uploadProgress}%
            </Text>
          </View>
        </GlassCard>
      )}

      {/* CTA */}
      {!uploading && (
        <TouchableOpacity
          style={[pub.cta, !allOk && { opacity: 0.35 }]}
          onPress={allOk ? onUpload : undefined}
          activeOpacity={0.88}
          disabled={!allOk}
        >
          <BlurView intensity={Platform.OS === 'ios' ? 20 : 12} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={pub.ctaInner}>
            <Ionicons name="cloud-upload-outline" size={17} color={P.white} />
            <Text style={pub.ctaTxt}>Publier le Réel</Text>
          </View>
        </TouchableOpacity>
      )}

      <Text style={pub.legal}>
        En publiant, vous certifiez être l&apos;auteur ou ayant-droits de cette œuvre.
      </Text>
    </View>
  );
});

const pub = StyleSheet.create({
  thumb:       { width: 60, height: 90, borderRadius: 10, backgroundColor: P.glass, borderWidth: 0.5, borderColor: P.edge, alignItems: 'center', justifyContent: 'center', gap: 4 },
  thumbDur:    { color: P.txtTert, fontSize: 9, fontWeight: '600' },
  genre:       { color: P.txtTert, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  filmTitle:   { color: P.txt, fontSize: 14, fontWeight: '800' },
  director:    { color: P.txtSec, fontSize: 11, marginTop: 2 },
  synopsis:    { color: P.txtTert, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
  progressBg:  { height: 3, borderRadius: 2, backgroundColor: P.glass, overflow: 'hidden' },
  progressFill:{ height: '100%', backgroundColor: P.white, borderRadius: 2 },
  cta:         { borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: P.edgeMid },
  ctaInner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 16 },
  ctaTxt:      { color: P.white, fontSize: 15, fontWeight: '700' },
  legal:       { color: P.txtTert, fontSize: 10, textAlign: 'center', lineHeight: 15, fontStyle: 'italic' },
});

const step = StyleSheet.create({
  title: { color: P.txt, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  hint:  { color: P.txtTert, fontSize: 12, marginBottom: 6, fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO WIZARD
// ─────────────────────────────────────────────────────────────────────────────
const VideoTab = memo(function VideoTab() {
  const router = useRouter();

  const [currentStep,    setCurrentStep]    = useState<Step>(0);
  const prevStepRef                          = useRef<Step>(0);
  const slideAnim                            = useRef(new Animated.Value(0)).current;

  const [videoUri,       setVideoUri]        = useState<string | null>(null);
  const [videoFileName,  setVideoFileName]   = useState('');
  const [videoDuration,  setVideoDuration]   = useState(0);
  const [trimStart,      setTrimStart]       = useState(0);
  const [trimEnd,        setTrimEnd]         = useState(0);

  const [meta, setMeta] = useState<ReelMeta>({
    title: '', genre: '', director: '',
    year:  String(new Date().getFullYear()), synopsis: '',
  });

  const [uploading,      setUploading]       = useState(false);
  const [uploadProgress, setUploadProgress]  = useState(0);
  const [uploadMsg,      setUploadMsg]       = useState('');

  // ── Step slide animation ─────────────────────────────────────────────────
  useEffect(() => {
    const dir = currentStep > prevStepRef.current ? 1 : -1;
    prevStepRef.current = currentStep;
    slideAnim.setValue(dir * W * 0.06);
    Animated.spring(slideAnim, {
      toValue: 0, tension: 200, friction: 26, useNativeDriver: true,
    }).start();
  }, [currentStep, slideAnim]);

  // ── Meta patch ────────────────────────────────────────────────────────────
  const patchMeta = useCallback(<K extends keyof ReelMeta>(k: K, v: string) => {
    setMeta(m => ({ ...m, [k]: v }));
  }, []);

  // ── Video pick ────────────────────────────────────────────────────────────
  const pickVideo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès à la galerie dans Réglages.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:       ImagePicker.MediaTypeOptions.Videos,
      quality:           1,
      videoMaxDuration: 3600,
      allowsEditing:    false,
    });
    if (res.canceled || !res.assets?.[0]) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const asset = res.assets[0];
    const dur   = Math.floor(asset.duration ?? 30);
    setVideoUri(asset.uri);
    setVideoFileName(asset.fileName ?? asset.uri.split('/').pop() ?? 'video');
    setVideoDuration(dur);
    setTrimStart(0);
    setTrimEnd(Math.min(dur, MAX_DURATION));
  }, []);

  const removeVideo = useCallback(() => {
    setVideoUri(null); setVideoFileName(''); setVideoDuration(0);
    setTrimStart(0);   setTrimEnd(0);
  }, []);

  const handleTrimChange = useCallback((s: number, e: number) => {
    setTrimStart(s); setTrimEnd(e);
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const canContinue = useMemo(() => {
    if (currentStep === 0)
      return !!videoUri && (trimEnd - trimStart) > 0 && (trimEnd - trimStart) <= MAX_DURATION;
    if (currentStep === 1)
      return meta.title.trim().length > 0 && meta.genre.length > 0;
    return true;
  }, [currentStep, videoUri, trimStart, trimEnd, meta.title, meta.genre]);

  const errorHint = useMemo(() => {
    if (currentStep === 0) {
      if (!videoUri)                              return 'Importez une vidéo pour continuer';
      if ((trimEnd - trimStart) > MAX_DURATION)   return `Réduisez à ${MAX_DURATION}s max`;
      if ((trimEnd - trimStart) <= 0)             return 'Sélectionnez une durée valide';
    }
    if (currentStep === 1) {
      if (!meta.title.trim()) return 'Renseignez le titre';
      if (!meta.genre)        return 'Sélectionnez un genre';
    }
    return '';
  }, [currentStep, videoUri, trimStart, trimEnd, meta.title, meta.genre]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (!canContinue) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep(s => Math.min(2, s + 1) as Step);
  }, [canContinue]);

  const goPrev = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 0) setCurrentStep(s => (s - 1) as Step);
    else router.back();
  }, [currentStep, router]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!videoUri || uploading) return;

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) { Alert.alert('Non connecté', 'Connectez-vous pour publier.'); return; }

    setUploading(true);
    setUploadProgress(0);
    setUploadMsg('Démarrage…');

    const result = await uploadReel(
      videoUri, meta, userId,
      (pct, msg) => { setUploadProgress(pct); setUploadMsg(msg); },
    );

    setUploading(false);

    if (result) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/(tabs)/reels', params: { newReelId: result.id } });
    } else {
      Alert.alert('Erreur', "L'upload a échoué. Vérifiez votre connexion.");
    }
  }, [videoUri, meta, uploading, router]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Back */}
      <View style={wiz.backRow}>
        <TouchableOpacity style={wiz.backBtn} onPress={goPrev} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={18} color={P.txtSec} />
        </TouchableOpacity>
      </View>

      <StepIndicator step={currentStep} />

      {/* Scrollable content */}
      <Animated.ScrollView
        style={{ transform: [{ translateX: slideAnim }] }}
        contentContainerStyle={wiz.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 0 && (
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
        {currentStep === 1 && <StepInfos meta={meta} onChange={patchMeta} />}
        {currentStep === 2 && (
          <StepPublish
            meta={meta}
            trimStart={trimStart}
            trimEnd={trimEnd}
            uploading={uploading}
            uploadProgress={uploadProgress}
            uploadMsg={uploadMsg}
            onUpload={handleUpload}
          />
        )}
        <View style={{ height: 50 }} />
      </Animated.ScrollView>

      {/* Footer nav */}
      {currentStep < 2 && (
        <View style={wiz.footer}>
          <View style={wiz.footerRow}>
            {currentStep > 0 && (
              <TouchableOpacity style={wiz.backFooterBtn} onPress={goPrev}>
                <Ionicons name="chevron-back" size={15} color={P.txtSec} />
                <Text style={wiz.backFooterTxt}>Retour</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[wiz.nextBtn, !canContinue && { opacity: 0.35 }, currentStep === 0 && { marginLeft: 'auto' as any }]}
              onPress={goNext}
              disabled={!canContinue}
              activeOpacity={0.85}
            >
              <BlurView intensity={Platform.OS === 'ios' ? 18 : 10} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={wiz.nextInner}>
                <Text style={wiz.nextTxt}>
                  {currentStep === 0 ? 'Informations' : 'Aperçu'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={P.white} />
              </View>
            </TouchableOpacity>
          </View>

          {!canContinue && errorHint.length > 0 && (
            <Text style={wiz.hint}>{errorHint}</Text>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
});

const wiz = StyleSheet.create({
  backRow:       { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  backBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: P.glass, borderWidth: 0.5, borderColor: P.edge, alignItems: 'center', justifyContent: 'center' },
  scroll:        { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 120 },
  footer:        { borderTopWidth: 0.5, borderTopColor: P.edge, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 20, marginBottom: 80 },
  footerRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backFooterBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 14, paddingHorizontal: 8 },
  backFooterTxt: { color: P.txtSec, fontSize: 13, fontWeight: '600' },
  nextBtn:       { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: P.edgeMid },
  nextInner:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 14 },
  nextTxt:       { color: P.white, fontSize: 14, fontWeight: '700' },
  hint:          { textAlign: 'center', color: P.txtTert, fontSize: 10, marginTop: 8, fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────────────────
// TAB BAR
// ─────────────────────────────────────────────────────────────────────────────
const TAB_CONFIG = [
  { id: 'video' as Tab,    label: 'Vidéo',    icon: 'videocam-outline' as const },
  { id: 'critique' as Tab, label: 'Critique', icon: 'document-text-outline' as const },
];

const HIT = { top: 4, bottom: 4, left: 4, right: 4 } as const;

const TabItem = memo(({ cfg, active, onPress }: {
  cfg:     (typeof TAB_CONFIG)[0];
  active:  boolean;
  onPress: (t: Tab) => void;
}) => {
  const press = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(cfg.id);
  }, [cfg.id, onPress]);

  return (
    <TouchableOpacity
      style={[tabbar.tab, active && tabbar.tabActive]}
      onPress={press}
      activeOpacity={0.8}
      hitSlop={HIT}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      {active && (
        <BlurView
          intensity={Platform.OS === 'ios' ? 24 : 14}
          tint="light"
          style={[StyleSheet.absoluteFillObject, tabbar.pill]}
        />
      )}
      <Ionicons
        name={cfg.icon}
        size={14}
        color={active ? P.white : P.txtTert}
      />
      <Text style={[tabbar.label, active ? tabbar.labelOn : tabbar.labelOff]}>
        {cfg.label}
      </Text>
    </TouchableOpacity>
  );
});

const TabBar = memo(({ active, onSwitch }: { active: Tab; onSwitch: (t: Tab) => void }) => (
  <View style={tabbar.wrap}>
    {TAB_CONFIG.map(cfg => (
      <TabItem key={cfg.id} cfg={cfg} active={active === cfg.id} onPress={onSwitch} />
    ))}
  </View>
));

const tabbar = StyleSheet.create({
  wrap:     {
    flexDirection:    'row',
    marginHorizontal:  16,
    marginBottom:      16,
    backgroundColor:   'rgba(10,10,14,0.45)',
    borderRadius:      18,
    borderWidth:        0.5,
    borderColor:        P.edge,
    padding:            4,
    overflow:          'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  tab:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14, overflow: 'hidden' },
  tabActive:{},
  pill:     { borderRadius: 14, overflow: 'hidden', backgroundColor: P.navyMid, borderWidth: 0.5, borderColor: P.edgeMid },
  label:    { fontSize: 13, fontWeight: '600' },
  labelOn:  { color: P.white, fontWeight: '700' },
  labelOff: { color: P.txtTert },
});

// ─────────────────────────────────────────────────────────────────────────────
// TAB PANELS — montés une fois, masqués via position absolute + opacity 0
// → Aucun reset d'état au switch d'onglet
// ─────────────────────────────────────────────────────────────────────────────
const TabPanels = memo(({ active }: { active: Tab }) => {
  const videoStyle    = useMemo(
    () => [panels.panel, active !== 'video'    && panels.hidden],
    [active],
  );
  const critiqueStyle = useMemo(
    () => [panels.panel, active !== 'critique' && panels.hidden],
    [active],
  );
  return (
    <>
      <View style={videoStyle}    pointerEvents={active === 'video'    ? 'auto' : 'none'}>
        <VideoTab />
      </View>
      <View style={critiqueStyle} pointerEvents={active === 'critique' ? 'auto' : 'none'}>
        <CritiqueTab />
      </View>
    </>
  );
});

const panels = StyleSheet.create({
  panel:  { flex: 1 },
  hidden: { position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN HEADER
// ─────────────────────────────────────────────────────────────────────────────
const ScreenHeader = memo(() => (
  <View style={hdr.wrap}>
    <Text style={hdr.title}>Créer</Text>
    <View style={hdr.rule} />
  </View>
));

const hdr = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingTop: 8, paddingBottom: 14 },
  title: { color: P.white, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  rule:  { marginTop: 8, width: 28, height: 0.5, backgroundColor: P.edgeMid, borderRadius: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROOT SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('video');
  const handleSwitch = useCallback((t: Tab) => setActiveTab(t), []);

  return (
    <View style={root.container}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <SafeAreaView style={root.safe}>
        <ScreenHeader />
        <TabBar active={activeTab} onSwitch={handleSwitch} />
        <View style={{ flex: 1 }}>
          <TabPanels active={activeTab} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const root = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  safe:      { flex: 1 },
});