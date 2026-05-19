/**
 * components/create/VideoTab.tsx
 *
 * Flow : Sélection → Aperçu → Métadonnées → XHR progress → Bannière vérification
 *
 * Optimisations :
 *   • Tous les callbacks stable (useCallback)
 *   • Pas de re-render inutile (memo sur tous les sous-composants)
 *   • progAnim : useRef Animated.Value, jamais recréée
 *   • bannerAnim : Animated.Value séparée, animation spring + timing
 *   • uploadXHR : définie hors du composant (stable)
 *   • Field : memoïsé, keyboardType typé Any via prop
 *   • GenreGrid : memoïsé, stable onSelect
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics     from 'expo-haptics';

import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG (stables, module-level)
// ─────────────────────────────────────────────────────────────────────────────
const BUCKET        = 'community-images';
const SUPABASE_URL  = 'https://knrzbdqfflobfjdmqyte.supabase.co';
const BANNER_TTL_MS = 7_000;   // durée d'affichage de la bannière de vérification

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
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
  neon:     'rgba(13,34,64,0.55)',
  neonL:    '#A78BFA',
  gold:     '#F5C842',
  amber:    '#F59E0B',
  success:  '#22C55E',
  error:    '#EF4444',
} as const;

const GENRES = [
  'Drame', 'Comédie', 'Thriller', 'Horreur', 'Science-Fiction',
  'Documentaire', 'Animation', 'Romance', 'Action', 'Fantastique',
  'Policier', 'Biopic', 'Court-métrage', 'Expérimental',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Asset {
  uri:       string;
  fileName?: string | null;
  fileSize?: number | null;
  duration?: number | null;
  mimeType?: string | null;
}

interface Form {
  title:    string;
  genre:    string;
  director: string;
  year:     string;
  synopsis: string;
}

const FORM_EMPTY: Form = { title:'', genre:'', director:'', year:'', synopsis:'' };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS (module-level — stables, jamais recréées)
// ─────────────────────────────────────────────────────────────────────────────
function fmtSize(b?: number | null): string {
  if (!b) return '—';
  return b < 1e6 ? `${(b / 1e3).toFixed(0)} Ko` : `${(b / 1e6).toFixed(1)} Mo`;
}

function fmtDur(ms?: number | null): string {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

async function uploadXHR(
  path: string,
  blob: Blob,
  mime: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token ?? ''}`);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload  = () => xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Erreur réseau'));
    xhr.send(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ★ BANNIÈRE DE VÉRIFICATION
//   Slide-down depuis le haut + BlurView + auto-dismiss après BANNER_TTL_MS
// ─────────────────────────────────────────────────────────────────────────────
const VerificationBanner = memo(function VerificationBanner({
  visible,
}: { visible: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue:   visible ? 1 : 0,
      useNativeDriver: true,
      tension:   80,
      friction:  12,
    }).start();
  }, [visible, anim]);

  const translateY = anim.interpolate({ inputRange:[0,1], outputRange:[-90,0] });
  const opacity    = anim.interpolate({ inputRange:[0,1], outputRange:[0,1] });

  return (
    <Animated.View
      style={[bn.root, { transform:[{ translateY }], opacity }]}
      pointerEvents="none"
    >
      <BlurView intensity={Platform.OS === 'ios' ? 28 : 18} tint="dark" style={bn.inner}>
        <View style={bn.iconRing}>
          <Ionicons name="shield-checkmark" size={17} color={C.amber} />
        </View>
        <View style={{ flex:1 }}>
          <Text style={bn.title}>Vérification en cours</Text>
          <Text style={bn.body}>
            Ta vidéo est soumise à l'équipe Universe.{'\n'}
            Tu seras notifié dès qu'elle sera approuvée.
          </Text>
        </View>
      </BlurView>
    </Animated.View>
  );
});

const bn = StyleSheet.create({
  root:    {
    position:'absolute', top:8, left:14, right:14, zIndex:200,
    borderRadius:18, overflow:'hidden',
    borderWidth:1, borderColor:'rgba(245,158,11,0.35)',
    shadowColor:'#F59E0B', shadowOpacity:0.22,
    shadowRadius:14, shadowOffset:{width:0,height:4}, elevation:10,
  },
  inner:   { flexDirection:'row', alignItems:'flex-start', gap:12, padding:14 },
  iconRing:{ width:38, height:38, borderRadius:19, backgroundColor:'rgba(245,158,11,0.14)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(245,158,11,0.28)' },
  title:   { color:C.white, fontSize:13, fontWeight:'800', marginBottom:2 },
  body:    { color:'rgba(255,255,255,0.48)', fontSize:11, lineHeight:16 },
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAMP DE FORMULAIRE
// ─────────────────────────────────────────────────────────────────────────────
interface FieldProps {
  label:        string;
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  multiline?:   boolean;
  maxLength?:   number;
  keyboardType?: 'default' | 'numeric' | 'email-address';
}

const Field = memo(function Field({
  label, value, onChange, placeholder,
  multiline, maxLength, keyboardType = 'default',
}: FieldProps) {
  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <TextInput
        style={[fi.input, multiline && fi.multi]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        returnKeyType={multiline ? 'default' : 'next'}
        selectionColor={C.neonL}
        autoCapitalize={keyboardType === 'numeric' ? 'none' : 'sentences'}
        numberOfLines={multiline ? 4 : 1}
      />
      {!!maxLength && value.length > maxLength * 0.8 && (
        <Text style={fi.count}>{value.length}/{maxLength}</Text>
      )}
    </View>
  );
});

const fi = StyleSheet.create({
  wrap:  { marginBottom:14 },
  label: { color:C.muted, fontSize:11, fontWeight:'600', letterSpacing:0.4, marginBottom:6 },
  input: {
    backgroundColor:C.navyMid, borderRadius:12,
    paddingHorizontal:14, paddingVertical:12,
    color:C.white, fontSize:14,
    borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
  },
  multi: { height:96, textAlignVertical:'top', paddingTop:12 },
  count: { color:C.muted, fontSize:9, textAlign:'right', marginTop:3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// GRILLE DE GENRES (memoïsé, stable)
// ─────────────────────────────────────────────────────────────────────────────
const GenreGrid = memo(function GenreGrid({
  selected, onSelect,
}: { selected: string; onSelect: (g: string) => void }) {
  return (
    <View style={gg.grid}>
      {GENRES.map(g => {
        const on = selected === g;
        return (
          <TouchableOpacity
            key={g}
            style={[gg.chip, on && gg.chipOn]}
            onPress={() => onSelect(g)}
            activeOpacity={0.76}
          >
            <Text style={[gg.txt, on && gg.txtOn]}>{g}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const gg = StyleSheet.create({
  grid:  { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:10, paddingBottom:4 },
  chip:  { paddingHorizontal:12, paddingVertical:7, borderRadius:20, backgroundColor:C.navyMid, borderWidth:1, borderColor:C.border },
  chipOn:{ backgroundColor:C.neon, borderColor:"#fff" },
  txt:   { color:C.muted, fontSize:12, fontWeight:'600' },
  txtOn: { color:C.white, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO TAB
// ─────────────────────────────────────────────────────────────────────────────
const VideoTab = memo(function VideoTab() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [asset,      setAsset]      = useState<Asset | null>(null);
  const [form,       setForm]       = useState<Form>(FORM_EMPTY);
  const [genreOpen,  setGenreOpen]  = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [error,      setError]      = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const progAnim    = useRef(new Animated.Value(0)).current;
  const scrollRef   = useRef<ScrollView>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Nettoyage timer à l'unmount ───────────────────────────────────────────
  useEffect(() => () => clearTimeout(bannerTimer.current), []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const animProg = useCallback((pct: number) => {
    setProgress(pct);
    Animated.timing(progAnim, {
      toValue: pct / 100, duration: 180, useNativeDriver: false,
    }).start();
  }, [progAnim]);

  const triggerBanner = useCallback(() => {
    clearTimeout(bannerTimer.current);
    setShowBanner(true);
    bannerTimer.current = setTimeout(() => setShowBanner(false), BANNER_TTL_MS);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  // ── Setters de form stables ───────────────────────────────────────────────
  const setTitle    = useCallback((v: string) => setForm(p => ({...p, title:    v})), []);
  const setGenre    = useCallback((v: string) => setForm(p => ({...p, genre:    v})), []);
  const setDirector = useCallback((v: string) => setForm(p => ({...p, director: v})), []);
  const setYear     = useCallback((v: string) => setForm(p => ({...p, year:     v})), []);
  const setSynopsis = useCallback((v: string) => setForm(p => ({...p, synopsis: v})), []);

  // Genre picker
  const handleGenreSelect = useCallback((g: string) => {
    setGenre(g);
    setGenreOpen(false);
  }, [setGenre]);

  const toggleGenreOpen = useCallback(() => setGenreOpen(o => !o), []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setAsset(null);
    setForm(FORM_EMPTY);
    setError(null);
    setProgress(0);
    setGenreOpen(false);
    progAnim.setValue(0);
    scrollRef.current?.scrollTo({ y:0, animated:true });
  }, [progAnim]);

  // ── Picker ────────────────────────────────────────────────────────────────
  const pick = useCallback(async (src: 'gallery' | 'camera') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    let result: ImagePicker.ImagePickerResult;

    if (src === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Active la caméra dans les paramètres.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'] as any, videoMaxDuration: 180, quality: 1,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Active la galerie dans les paramètres.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'] as any, videoMaxDuration: 180, quality: 1, selectionLimit: 1,
      });
    }

    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setAsset({
      uri:      a.uri,
      fileName: a.fileName ?? a.uri.split('/').pop(),
      fileSize: a.fileSize,
      duration: a.duration,
      mimeType: a.mimeType ?? 'video/mp4',
    });
    setError(null);
    setTimeout(() => scrollRef.current?.scrollTo({ y:240, animated:true }), 350);
  }, []);

  const pickGallery = useCallback(() => pick('gallery'), [pick]);
  const pickCamera  = useCallback(() => pick('camera'),  [pick]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const upload = useCallback(async () => {
    if (!asset || !form.title.trim()) {
      if (!form.title.trim()) setError('Le titre est obligatoire.');
      return;
    }

    setUploading(true);
    setError(null);
    animProg(2);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Non authentifié — connecte-toi d\'abord.');

      // Fetch → blob
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();
      const ext  = (asset.fileName ?? 'video.mp4').split('.').pop() ?? 'mp4';
      const path = `reels/${user.id}/${Date.now()}.${ext}`;

      // XHR upload avec progression réelle
      await uploadXHR(
        path, blob,
        asset.mimeType ?? 'video/mp4',
        pct => animProg(5 + pct * 0.82),
      );

      animProg(92);

      // URL publique
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!urlData?.publicUrl) throw new Error('URL introuvable — vérifie que le bucket est public.');

      // INSERT dans reels (status='pending' par défaut)
      // → trigger SQL fn_notify_reel_pending insère une notification en base
      const { error: insErr } = await supabase
        .from('reels')
        .insert({
          user_id:     user.id,
          video_url:   urlData.publicUrl,
          title:       form.title.trim()    || null,
          genre:       form.genre           || null,
          director:    form.director.trim() || null,
          year:        form.year.trim()     || null,
          synopsis:    form.synopsis.trim() || null,
          duration:    asset.duration ? Math.round(asset.duration / 1000) : null,
          likes_count: 0,
          views_count: 0,
          // status: 'pending' ← valeur par défaut SQL, pas besoin de l'envoyer
        });

      if (insErr) throw new Error(insErr.message);

      animProg(100);

      // ★ Bannière de vérification (slide-down depuis le haut)
      triggerBanner();

      // Reset formulaire après un bref délai
      setTimeout(reset, 1_400);

    } catch (e: any) {
      setError(e?.message ?? 'Erreur inconnue.');
      animProg(0);
    } finally {
      setUploading(false);
    }
  }, [asset, form, animProg, triggerBanner, reset]);

  // Dérivé stable
  const canSubmit = !!asset && !uploading;

  // Barre de progression interpolée
  const progWidth = useMemo(() => ({
    width: progAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }),
  }), [progAnim]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex:1 }}>

      {/* ★ Bannière flottante — "Vérification en cours" */}
      <VerificationBanner visible={showBanner} />

      <KeyboardAvoidingView
        style={{ flex:1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={140}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={vt.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── ZONE DE SÉLECTION ─────────────────────────────────────── */}
          {!asset ? (
            <View style={vt.dropZone}>
              <View style={vt.dropIcon}>
                <Ionicons name="cloud-upload" size={34} color={C.white} />
              </View>
              <Text style={vt.dropTitle}>Importe ta vidéo</Text>
              <Text style={vt.dropSub}>MP4 · MOV · MKV  ·  3 min maximum</Text>

              <View style={vt.dropBtns}>
                <TouchableOpacity style={vt.btnPrimary} onPress={pickGallery} activeOpacity={0.82}>
                  <Ionicons name="images" size={16} color={C.white} />
                  <Text style={vt.btnPrimaryTxt}>Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={vt.btnSecondary} onPress={pickCamera} activeOpacity={0.82}>
                  <Ionicons name="camera" size={16} color={C.offWhite} />
                  <Text style={vt.btnSecondaryTxt}>Caméra</Text>
                </TouchableOpacity>
              </View>

              <Text style={vt.dropHint}>
                Ta vidéo sera examinée par l'équipe Universe avant d'apparaître dans les Reels.
              </Text>
            </View>

          ) : (

            /* ── APERÇU FICHIER ─────────────────────────────────────────── */
            <View style={vt.preview}>
              <BlurView intensity={18} tint="dark" style={vt.previewBlur}>
                <View style={vt.previewIcon}>
                  <Ionicons name="videocam" size={26} color={C.white} />
                </View>

                <View style={{ flex:1, gap:4 }}>
                  <Text style={vt.previewName} numberOfLines={1}>
                    {asset.fileName ?? 'video'}
                  </Text>
                  <View style={{ flexDirection:'row', gap:14 }}>
                    <Text style={vt.previewMeta}>⏱ {fmtDur(asset.duration)}</Text>
                    <Text style={vt.previewMeta}>📦 {fmtSize(asset.fileSize)}</Text>
                  </View>
                  <Text style={vt.previewReady}>✓ Prête à soumettre</Text>
                </View>

                <TouchableOpacity onPress={reset} hitSlop={12}>
                  <Ionicons name="close-circle" size={22} color={C.muted} />
                </TouchableOpacity>
              </BlurView>
            </View>
          )}

          {/* ── FORMULAIRE ────────────────────────────────────────────── */}
          <View style={vt.form}>
            <Text style={vt.formHeading}>Informations</Text>

            <Field
              label="TITRE *"
              value={form.title}
              onChange={setTitle}
              placeholder="Titre de ton reel"
              maxLength={120}
            />

            {/* Genre — select + chips */}
            <View style={fi.wrap}>
              <Text style={fi.label}>GENRE</Text>
              <TouchableOpacity
                style={vt.selectRow}
                onPress={toggleGenreOpen}
                activeOpacity={0.80}
              >
                <Text style={[vt.selectTxt, !form.genre && { color:C.muted }]}>
                  {form.genre || 'Sélectionne un genre'}
                </Text>
                <Ionicons
                  name={genreOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={C.muted}
                />
              </TouchableOpacity>

              {genreOpen && (
                <GenreGrid selected={form.genre} onSelect={handleGenreSelect} />
              )}
            </View>

            {/* Réalisateur + Année côte à côte */}
            <View style={{ flexDirection:'row', gap:10 }}>
              <View style={{ flex:1 }}>
                <Field label="RÉALISATEUR" value={form.director} onChange={setDirector} placeholder="Nom" />
              </View>
              <View style={{ width:86 }}>
                <Field label="ANNÉE" value={form.year} onChange={setYear} placeholder="2024" keyboardType="numeric" maxLength={4} />
              </View>
            </View>

            <Field
              label="SYNOPSIS"
              value={form.synopsis}
              onChange={setSynopsis}
              placeholder="Décris ton reel…"
              multiline
              maxLength={400}
            />
          </View>

          {/* ── BARRE DE PROGRESSION ──────────────────────────────────── */}
          {uploading && (
            <View style={vt.progressWrap}>
              <View style={vt.progressBg}>
                <Animated.View style={[vt.progressFill, progWidth]} />
              </View>
              <Text style={vt.progressTxt}>
                {progress < 90 ? `Import en cours… ${progress}%` : 'Finalisation…'}
              </Text>
            </View>
          )}

          {/* ── ERREUR ────────────────────────────────────────────────── */}
          {!!error && (
            <View style={vt.msgBox}>
              <Ionicons name="warning-outline" size={15} color={C.error} />
              <Text style={vt.msgTxt}>{error}</Text>
            </View>
          )}

          {/* ── INFO MODÉRATION (quand prêt) ──────────────────────────── */}
          {!!asset && !uploading && !error && (
            <View style={vt.infoBox}>
              <Ionicons name="shield-checkmark-outline" size={14} color={C.amber} />
              <Text style={vt.infoTxt}>
                Chaque vidéo est examinée par l'équipe Universe avant publication dans les Reels.
              </Text>
            </View>
          )}

          {/* ── BOUTON SOUMETTRE ──────────────────────────────────────── */}
          <TouchableOpacity
            style={[vt.submitBtn, !canSubmit && vt.submitOff]}
            onPress={upload}
            activeOpacity={0.84}
            disabled={!canSubmit}
          >
            {uploading
              ? <ActivityIndicator color={C.white} size="small" />
              : <Ionicons name="cloud-upload" size={17} color={C.white} />
            }
            <Text style={vt.submitTxt}>
              {uploading ? 'Import en cours…' : 'Soumettre la vidéo'}
            </Text>
          </TouchableOpacity>

          <View style={{ height:60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
});

export default VideoTab;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const vt = StyleSheet.create({
  scroll:   { paddingHorizontal:16, paddingTop:4 },

  // Drop zone
  dropZone: {
    alignItems:'center', borderRadius:20, padding:32, marginBottom:20, gap:10,
    borderWidth:1, borderColor:C.borderBr, borderStyle:'dashed',
    backgroundColor:C.navyLow,
  },
  dropIcon: {
    width:68, height:68, borderRadius:34,
    backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center',
    borderWidth:1, borderColor:C.borderBr, marginBottom:4,
  },
  dropTitle:      { color:C.white,    fontSize:18, fontWeight:'800' },
  dropSub:        { color:C.muted,    fontSize:12 },
  dropBtns:       { flexDirection:'row', gap:12, marginTop:6 },
  btnPrimary:     {
    flexDirection:'row', alignItems:'center', gap:8,
    backgroundColor:C.navyMid, paddingHorizontal:24, paddingVertical:12,
    borderRadius:24, borderWidth:1, borderColor:C.borderBr,
  },
  btnPrimaryTxt:  { color:C.white,    fontSize:14, fontWeight:'800' },
  btnSecondary:   {
    flexDirection:'row', alignItems:'center', gap:8,
    backgroundColor:C.navyMid, paddingHorizontal:22, paddingVertical:12,
    borderRadius:24, borderWidth:1, borderColor:C.borderBr,
  },
  btnSecondaryTxt:{ color:C.offWhite, fontSize:14, fontWeight:'700' },
  dropHint:       { color:C.muted, fontSize:10, textAlign:'center', lineHeight:15, paddingHorizontal:20 },

  // Preview
  preview:     { marginBottom:20 },
  previewBlur: {
    flexDirection:'row', alignItems:'center', gap:12, padding:14,
    borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:C.borderBr,
  },
  previewIcon: {
    width:52, height:52, borderRadius:12,
    backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center',
  },
  previewName: { color:C.white,   fontSize:13, fontWeight:'700' },
  previewMeta: { color:C.muted,   fontSize:11 },
  previewReady:{ color:'#86EFAC', fontSize:11, fontWeight:'600' },

  // Form
  form:        { gap:0, marginBottom:16 },
  formHeading: { color:C.offWhite, fontSize:13, fontWeight:'700', letterSpacing:0.5, marginBottom:16 },

  selectRow: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    backgroundColor:C.navyMid, borderRadius:12,
    paddingHorizontal:14, paddingVertical:12,
    borderWidth:StyleSheet.hairlineWidth, borderColor:C.border,
  },
  selectTxt: { color:C.white, fontSize:14 },

  // Progress
  progressWrap: { marginBottom:14, gap:6 },
  progressBg:   { height:4, borderRadius:3, backgroundColor:C.navyMid, overflow:'hidden' },
  progressFill: { height:'100%', backgroundColor:C.neonL, borderRadius:3 },
  progressTxt:  { color:C.muted, fontSize:11, textAlign:'center' },

  // Error
  msgBox: {
    flexDirection:'row', alignItems:'center', gap:8,
    backgroundColor:'rgba(239,68,68,0.12)', borderRadius:12, padding:12, marginBottom:12,
    borderWidth:1, borderColor:'rgba(239,68,68,0.25)',
  },
  msgTxt: { flex:1, color:'#FCA5A5', fontSize:12 },

  // Info modération
  infoBox: {
    flexDirection:'row', alignItems:'flex-start', gap:8,
    backgroundColor:'rgba(245,158,11,0.08)', borderRadius:12, padding:12, marginBottom:14,
    borderWidth:1, borderColor:'rgba(245,158,11,0.20)',
  },
  infoTxt: { flex:1, color:'rgba(255,255,255,0.45)', fontSize:11, lineHeight:16 },

  // Submit
  submitBtn: {
    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10,
    backgroundColor:C.navyMid, borderRadius:16, paddingVertical:15, marginBottom:12,
    borderWidth:1, borderColor:C.borderBr,
  },
  submitOff: { opacity:0.45 },
  submitTxt: { color:C.white, fontSize:15, fontWeight:'800' },
});