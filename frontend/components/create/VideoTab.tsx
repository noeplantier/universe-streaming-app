/**
 * components/create/VideoTab.tsx
 *
 * Flow : Sélection → Aperçu → Métadonnées → Upload (XHR progress) → Succès
 * Thème : navyMid transparent sur GalaxyBackground
 */

import React, { memo, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import * as ImagePicker      from 'expo-image-picker';
import * as Haptics          from 'expo-haptics';

import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const BUCKET       = 'community-images';
const SUPABASE_URL = 'https://knrzbdqfflobfjdmqyte.supabase.co';

// ─────────────────────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  navyMid:  'rgba(13,34,64,0.55)',
  navyLow:  'rgba(13,34,64,0.30)',
  navyHigh: 'rgba(13,34,64,0.80)',
  border:   'rgba(255,255,255,0.09)',
  borderBr: 'rgba(255,255,255,0.18)',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.85)',
  muted:    'rgba(255,255,255,0.38)',
  faint:    'rgba(255,255,255,0.14)',
  neon:     '#7C5EFC',
  neonL:    '#A78BFA',
  gold:     '#F5C842',
  success:  '#22C55E',
  error:    '#EF4444',
} as const;

const GENRES = [
  'Drame','Comédie','Thriller','Horreur','Science-Fiction',
  'Documentaire','Animation','Romance','Action','Fantastique',
  'Policier','Biopic','Court-métrage','Expérimental',
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Asset {
  uri:       string;
  fileName?: string | null;
  fileSize?: number | null;
  duration?: number | null;
  mimeType?: string | null;
}
interface Form {
  title: string; genre: string; director: string; year: string; synopsis: string;
}
const EMPTY: Form = { title:'', genre:'', director:'', year:'', synopsis:'' };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtSize(b: number | null | undefined) {
  if (!b) return '—';
  return b < 1e6 ? `${(b/1e3).toFixed(0)} Ko` : `${(b/1e6).toFixed(1)} Mo`;
}
function fmtDur(ms: number | null | undefined) {
  if (!ms) return '—';
  const s = Math.round(ms/1000), m = Math.floor(s/60);
  return `${m}:${(s%60).toString().padStart(2,'0')}`;
}

async function uploadXHR(
  path: string, blob: Blob, mime: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round(e.loaded/e.total*100));
    };
    xhr.onload  = () => xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Erreur réseau'));
    xhr.send(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Input field
// ─────────────────────────────────────────────────────────────────────────────
const Field = memo(function Field({
  label, value, onChange, placeholder,
  multiline, maxLength, keyboardType,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; maxLength?: number; keyboardType?: any;
}) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <TextInput
        style={[f.input, multiline && f.multi]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        returnKeyType={multiline ? 'default' : 'next'}
        selectionColor={C.neonL}
        autoCapitalize="sentences"
        numberOfLines={multiline ? 4 : 1}
      />
      {!!maxLength && value.length > maxLength * 0.8 && (
        <Text style={f.count}>{value.length}/{maxLength}</Text>
      )}
    </View>
  );
});
const f = StyleSheet.create({
  wrap:  { marginBottom: 14 },
  label: { color: C.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, marginBottom: 6 },
  input: {
    backgroundColor: C.navyMid, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: C.white, fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
  },
  multi: { height: 96, textAlignVertical: 'top', paddingTop: 12 },
  count: { color: C.muted, fontSize: 9, textAlign: 'right', marginTop: 3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// VideoTab
// ─────────────────────────────────────────────────────────────────────────────
const VideoTab = memo(function VideoTab() {
  const [asset,      setAsset]      = useState<Asset | null>(null);
  const [form,       setForm]       = useState<Form>(EMPTY);
  const [genreOpen,  setGenreOpen]  = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [successId,  setSuccessId]  = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const progAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const animProg = useCallback((pct: number) => {
    setProgress(pct);
    Animated.timing(progAnim, { toValue: pct/100, duration: 180, useNativeDriver: false }).start();
  }, [progAnim]);

  // ── Picker ────────────────────────────────────────────────────────────────
  const pick = useCallback(async (src: 'gallery' | 'camera') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    let result: ImagePicker.ImagePickerResult;
    if (src === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la caméra dans les paramètres.'); return; }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'] as any, videoMaxDuration: 180, quality: 1,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la galerie dans les paramètres.'); return; }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'] as any, videoMaxDuration: 180, quality: 1, selectionLimit: 1,
      });
    }
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setAsset({ uri: a.uri, fileName: a.fileName ?? a.uri.split('/').pop(), fileSize: a.fileSize, duration: a.duration, mimeType: a.mimeType ?? 'video/mp4' });
    setSuccessId(null); setError(null);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 260, animated: true }), 400);
  }, []);

  const setField = useCallback((k: keyof Form) => (v: string) => setForm(f => ({...f, [k]: v})), []);

  const reset = useCallback(() => {
    setAsset(null); setForm(EMPTY); setSuccessId(null); setError(null);
    setProgress(0); progAnim.setValue(0);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [progAnim]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const upload = useCallback(async () => {
    if (!asset) return;
    if (!form.title.trim()) { setError('Le titre est obligatoire.'); return; }
    setUploading(true); setError(null); animProg(2);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Non authentifié. Connecte-toi d\'abord.');

      const resp = await fetch(asset.uri);
      const blob = await resp.blob();
      const ext  = (asset.fileName ?? 'video.mp4').split('.').pop() ?? 'mp4';
      const path = `reels/${user.id}/${Date.now()}.${ext}`;

      await uploadXHR(path, blob, asset.mimeType ?? 'video/mp4', pct => animProg(5 + pct*0.80));
      animProg(90);

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!urlData?.publicUrl) throw new Error('URL introuvable. Vérifie que le bucket est public.');

      const { data: reel, error: insErr } = await supabase
        .from('reels')
        .insert({
          user_id:     user.id,
          video_url:   urlData.publicUrl,
          title:       form.title.trim()    || null,
          genre:       form.genre           || null,
          director:    form.director.trim() || null,
          year:        form.year.trim()     || null,
          synopsis:    form.synopsis.trim() || null,
          duration:    asset.duration ? Math.round(asset.duration/1000) : null,
          likes_count: 0,
          views_count: 0,
        })
        .select('id').single();

      if (insErr) throw new Error(insErr.message);

      animProg(100);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSuccessId(reel.id);
      setTimeout(reset, 3000);

    } catch (e: any) {
      setError(e?.message ?? 'Erreur inconnue.');
      animProg(0);
    } finally {
      setUploading(false);
    }
  }, [asset, form, animProg, reset]);

  const canSubmit = !!asset && !uploading && !successId;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={140}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={vt.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Zone de sélection ───────────────────────────────────────── */}
        {!asset ? (
          <View style={vt.dropZone}>
            <View style={vt.dropIcon}>
              <Ionicons name="cloud-upload" size={34} color={C.neonL} />
            </View>
            <Text style={vt.dropTitle}>Importe ta vidéo</Text>
            <Text style={vt.dropSub}>MP4 · MOV · MKV  ·  3 min maximum</Text>
            <View style={vt.dropBtns}>
              <TouchableOpacity style={vt.btnPrimary} onPress={() => pick('gallery')} activeOpacity={0.82}>
                <Ionicons name="images" size={16} color="#03000A" />
                <Text style={vt.btnPrimaryTxt}>Galerie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={vt.btnSecondary} onPress={() => pick('camera')} activeOpacity={0.82}>
                <Ionicons name="camera" size={16} color={C.offWhite} />
                <Text style={vt.btnSecondaryTxt}>Caméra</Text>
              </TouchableOpacity>
            </View>
            <Text style={vt.dropHint}>
              La vidéo sera publiée dans le feed Reels de la communauté.
            </Text>
          </View>
        ) : (
          /* ── Aperçu ──────────────────────────────────────────────────── */
          <View style={vt.preview}>
            <BlurView intensity={18} tint="dark" style={vt.previewBlur}>
              <View style={vt.previewIcon}>
                <Ionicons name="videocam" size={26} color={C.neonL} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={vt.previewName} numberOfLines={1}>{asset.fileName}</Text>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <Text style={vt.previewMeta}>⏱ {fmtDur(asset.duration)}</Text>
                  <Text style={vt.previewMeta}>📦 {fmtSize(asset.fileSize)}</Text>
                </View>
                <Text style={vt.previewReady}>✓ Prête à publier</Text>
              </View>
              <TouchableOpacity onPress={reset} hitSlop={12}>
                <Ionicons name="close-circle" size={22} color={C.muted} />
              </TouchableOpacity>
            </BlurView>
          </View>
        )}

        {/* ── Formulaire ──────────────────────────────────────────────── */}
        <View style={vt.form}>
          <Text style={vt.formHeading}>Informations</Text>

          <Field label="TITRE *" value={form.title} onChange={setField('title')}
            placeholder="Titre de ton reel" maxLength={120} />

          {/* Genre */}
          <View style={f.wrap}>
            <Text style={f.label}>GENRE</Text>
            <TouchableOpacity style={vt.selectRow} onPress={() => setGenreOpen(o => !o)} activeOpacity={0.80}>
              <Text style={[vt.selectTxt, !form.genre && { color: C.muted }]}>
                {form.genre || 'Sélectionne un genre'}
              </Text>
              <Ionicons name={genreOpen ? 'chevron-up' : 'chevron-down'} size={14} color={C.muted} />
            </TouchableOpacity>
            {genreOpen && (
              <View style={vt.chipGrid}>
                {GENRES.map(g => {
                  const on = form.genre === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[vt.chip, on && vt.chipOn]}
                      onPress={() => { setField('genre')(g); setGenreOpen(false); }}
                      activeOpacity={0.76}
                    >
                      <Text style={[vt.chipTxt, on && vt.chipTxtOn]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="RÉALISATEUR" value={form.director} onChange={setField('director')} placeholder="Nom" />
            </View>
            <View style={{ width: 86 }}>
              <Field label="ANNÉE" value={form.year} onChange={setField('year')} placeholder="2024" keyboardType="numeric" maxLength={4} />
            </View>
          </View>

          <Field label="SYNOPSIS" value={form.synopsis} onChange={setField('synopsis')}
            placeholder="Décris ton reel…" multiline maxLength={400} />
        </View>

        {/* ── Barre de progression ─────────────────────────────────────── */}
        {uploading && (
          <View style={vt.progressWrap}>
            <View style={vt.progressBg}>
              <Animated.View style={[vt.progressFill, {
                width: progAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }),
              }]} />
            </View>
            <Text style={vt.progressTxt}>
              {progress < 88 ? `Envoi en cours… ${progress}%` : 'Finalisation…'}
            </Text>
          </View>
        )}

        {/* ── Messages ─────────────────────────────────────────────────── */}
        {!!error && (
          <View style={vt.msgBox}>
            <Ionicons name="warning-outline" size={15} color={C.error} />
            <Text style={[vt.msgTxt, { color: '#FCA5A5' }]}>{error}</Text>
          </View>
        )}
        {!!successId && (
          <View style={[vt.msgBox, { borderColor: 'rgba(34,197,94,0.28)', backgroundColor: 'rgba(34,197,94,0.12)' }]}>
            <Ionicons name="checkmark-circle" size={16} color={C.success} />
            <Text style={[vt.msgTxt, { color: '#86EFAC', fontWeight: '700' }]}>Reel publié avec succès !</Text>
          </View>
        )}

        {/* ── Bouton publier ───────────────────────────────────────────── */}
        {!successId && (
          <TouchableOpacity
            style={[vt.submitBtn, !canSubmit && vt.submitOff]}
            onPress={upload}
            activeOpacity={0.84}
            disabled={!canSubmit}
          >
            {uploading
              ? <ActivityIndicator color="#03000A" size="small" />
              : <Ionicons name="cloud-upload" size={17} color={canSubmit ? '#03000A' : C.muted} />
            }
            <Text style={[vt.submitTxt, !canSubmit && { color: C.muted }]}>
              {uploading ? 'Publication…' : 'Publier le reel'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

export default VideoTab;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const vt = StyleSheet.create({
  scroll:   { paddingHorizontal: 16, paddingTop: 4 },

  dropZone: {
    alignItems: 'center', borderRadius: 20, padding: 32, marginBottom: 20, gap: 10,
    borderWidth: 1, borderColor: C.borderBr, borderStyle: 'dashed',
    backgroundColor: C.navyLow,
  },
  dropIcon: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: C.navyMid, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.borderBr, marginBottom: 4,
  },
  dropTitle:   { color: C.white, fontSize: 18, fontWeight: '800' },
  dropSub:     { color: C.muted, fontSize: 12 },
  dropBtns:    { flexDirection: 'row', gap: 12, marginTop: 6 },
  btnPrimary:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.neonL, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  btnPrimaryTxt:{ color: '#03000A', fontSize: 14, fontWeight: '800' },
  btnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.navyMid, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: C.borderBr },
  btnSecondaryTxt: { color: C.offWhite, fontSize: 14, fontWeight: '700' },
  dropHint:   { color: C.muted, fontSize: 10, textAlign: 'center', lineHeight: 15, paddingHorizontal: 20 },

  preview:     { marginBottom: 20 },
  previewBlur: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.borderBr },
  previewIcon: { width: 52, height: 52, borderRadius: 12, backgroundColor: C.navyMid, alignItems: 'center', justifyContent: 'center' },
  previewName: { color: C.white, fontSize: 13, fontWeight: '700' },
  previewMeta: { color: C.muted, fontSize: 11 },
  previewReady:{ color: '#86EFAC', fontSize: 11, fontWeight: '600' },

  form:        { gap: 0, marginBottom: 16 },
  formHeading: { color: C.offWhite, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginBottom: 16 },

  selectRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.navyMid, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  selectTxt:   { color: C.white, fontSize: 14 },
  chipGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingBottom: 4 },
  chip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.navyMid, borderWidth: 1, borderColor: C.border },
  chipOn:      { backgroundColor: C.neon, borderColor: C.neon },
  chipTxt:     { color: C.muted, fontSize: 12, fontWeight: '600' },
  chipTxtOn:   { color: C.white, fontWeight: '700' },

  progressWrap: { marginBottom: 14, gap: 6 },
  progressBg:   { height: 4, borderRadius: 3, backgroundColor: C.navyMid, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.neonL, borderRadius: 3 },
  progressTxt:  { color: C.muted, fontSize: 11, textAlign: 'center' },

  msgBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  msgTxt:  { flex: 1, fontSize: 12 },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.neonL, borderRadius: 16, paddingVertical: 15, marginBottom: 12 },
  submitOff: { backgroundColor: C.navyMid },
  submitTxt: { color: '#03000A', fontSize: 15, fontWeight: '800' },
});