/**
 * components/create/VideoTab.tsx — UNIVERSE
 *
 * Flow : Vidéo → Miniature (galerie, toujours dispo) → Infos → Upload → Backoffice
 *
 * Miniature :
 *   • Sélection manuelle depuis la galerie (JAMAIS bloquante)
 *   • Tentative auto via expo-video-thumbnails (bonus non-bloquant)
 *   • L'utilisateur peut changer à tout moment
 *
 * Upload :
 *   • XHR avec vraie progression (miniature → vidéo → INSERT DB)
 *   • Tous les champs reels matchent le schéma Supabase exactement
 *   • Triggers DB (tg_notif_reel_submitted, tg_reel_pending) → backoffice
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated,
  Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { BlurView }      from 'expo-blur';
import { Ionicons }      from '@expo/vector-icons';
import * as ImagePicker  from 'expo-image-picker';
import * as Haptics      from 'expo-haptics';
import { supabase, SUPABASE_ANON } from '@/lib/supabase';
import { getDeviceId }   from '@/services/api';

// ─── expo-video-thumbnails : bonus non-bloquant ───────────────────────────────
let VideoThumbnails: any = null;
if (Platform.OS !== 'web') {
  try { VideoThumbnails = require('expo-video-thumbnails'); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const BUCKET       = 'community-images';
const SUPABASE_URL = 'https://knrzbdqfflobfjdmqyte.supabase.co';
const BANNER_TTL   = 7_000;
const MAX_DUR_S    = 180;
// Au-delà, l'endpoint d'upload standard Supabase (non-resumable) rejette la
// requête — limite plateforme, pas configurable depuis le frontend. Mieux
// vaut prévenir avant un upload voué à échouer que laisser un 400 muet.
const MAX_FILE_MB  = 90;

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#070C17',
  navy:     'rgba(13,34,64,0.60)',
  navyLow:  'rgba(13,34,64,0.30)',
  navyHi:   'rgba(13,34,64,0.88)',
  border:   'rgba(255,255,255,0.09)',
  borderBr: 'rgba(255,255,255,0.20)',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.82)',
  mid:      'rgba(255,255,255,0.55)',
  muted:    'rgba(255,255,255,0.36)',
  faint:    'rgba(255,255,255,0.10)',
  accent:   '#A78BFA',
  amber:    '#F59E0B',
  success:  '#22C55E',
  error:    '#EF4444',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 15 GENRES — valeurs DB identiques à genres.sql
// ─────────────────────────────────────────────────────────────────────────────
const GENRES: { value: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value:'drame_intimiste',        label:'Drame intimiste',             icon:'heart-half-outline'     },
  { value:'documentaire_social',    label:'Documentaire social',         icon:'people-outline'         },
  { value:'court_experimental',     label:'Court-métrage expérimental',  icon:'flask-outline'          },
  { value:'film_auteur',            label:"Film d'auteur",               icon:'eye-outline'            },
  { value:'comedie_independante',   label:'Comédie indépendante',        icon:'happy-outline'          },
  { value:'thriller_psychologique', label:'Thriller psychologique',      icon:'pulse-outline'          },
  { value:'film_noir_contemporain', label:'Film noir contemporain',      icon:'moon-outline'           },
  { value:'cinema_du_reel',         label:'Cinéma du réel',              icon:'camera-outline'         },
  { value:'horreur_atmospherique',  label:'Horreur atmosphérique',       icon:'cloud-offline-outline'  },
  { value:'sf_lo_fi',               label:'Science-fiction lo-fi',       icon:'planet-outline'         },
  { value:'romance_naturaliste',    label:'Romance naturaliste',         icon:'leaf-outline'           },
  { value:'biopic_alternatif',      label:'Biopic alternatif',           icon:'person-outline'         },
  { value:'animation_independante', label:'Animation indépendante',      icon:'sparkles-outline'       },
  { value:'road_movie',             label:'Road movie',                  icon:'car-outline'            },
  { value:'portrait_territoire',    label:'Portrait de territoire',      icon:'map-outline'            },
];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface VideoAsset {
  uri:       string;
  fileName?: string | null;
  fileSize?: number | null;
  duration?: number | null;   // ms (expo-image-picker)
  mimeType?: string | null;
  // ★ Web uniquement — le File réel, gardé tel quel (déjà un Blob) pour
  // l'upload. Évite tout re-fetch('blob:…') qui peut échouer en silence
  // selon le navigateur (cf. l'erreur FileReader historique de ce flux).
  webBlob?:  Blob | null;
}
interface Form {
  title:    string;
  genre:    string;
  director: string;
  year:     string;
  synopsis: string;
}
const EMPTY: Form = { title:'', genre:'', director:'', year:'', synopsis:'' };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — module-level
// ─────────────────────────────────────────────────────────────────────────────
const fmtSize = (b?: number | null) =>
  !b ? '—' : b < 1e6 ? `${(b/1e3).toFixed(0)} Ko` : `${(b/1e6).toFixed(1)} Mo`;

const fmtDur = (ms?: number | null) => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
};

// ★ Fallback MIME par extension — file.type est souvent vide pour .mov côté
// navigateur (aucune entrée native dans la table de types web).
const VIDEO_MIME_BY_EXT: Record<string,string> = {
  mp4:'video/mp4', mov:'video/quicktime', webm:'video/webm',
  mkv:'video/x-matroska', avi:'video/x-msvideo', m4v:'video/x-m4v',
};
const mimeFromExt = (fileName: string) =>
  VIDEO_MIME_BY_EXT[fileName.split('.').pop()?.toLowerCase() ?? ''] ?? 'video/mp4';

const oversizeMsg = (bytes?: number | null) =>
  bytes != null && bytes > MAX_FILE_MB * 1_000_000
    ? `Vidéo trop volumineuse (${(bytes/1e6).toFixed(0)} Mo) — ${MAX_FILE_MB} Mo maximum. Réduis la résolution ou la durée et réessaie.`
    : null;

// Fallback uniquement pour les URI natives (file://) — jamais utilisé sur web
// quand un Blob a déjà été capturé à la sélection.
async function resolveBlob(uri: string): Promise<Blob> {
  const r = await fetch(uri);
  return r.blob();
}

async function uploadXHR(
  path: string, blob: Blob, mime: string,
  onProgress: (p: number) => void,
): Promise<void> {
  // ★ ZERO supabase.auth.* — la clé anon (RLS-protégée côté storage, déjà
  // utilisée avec succès par ComposeModal::uploadImage sur ce même bucket
  // community-images) sert de Bearer, jamais un token de session inexistant.
  return new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON}`);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total * 100); };
    // ★ Le message exact de Supabase (ex: "exceeded the maximum allowed size",
    // "mime type not supported", policy RLS…) est dans le corps de la réponse,
    // jamais dans le seul status code — sans ça, tout échec reste un 400 muet.
    xhr.onload  = () => {
      if (xhr.status < 300) { res(); return; }
      let detail = xhr.responseText || `HTTP ${xhr.status}`;
      try { detail = JSON.parse(xhr.responseText)?.message ?? detail; } catch {}
      rej(new Error(detail));
    };
    xhr.onerror = () => rej(new Error('Erreur réseau'));
    xhr.send(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BANNIÈRE SUCCÈS
// ─────────────────────────────────────────────────────────────────────────────
const Banner = memo(function Banner({ visible }: { visible: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: visible?1:0, tension:80, friction:12, useNativeDriver:true }).start();
  }, [visible, anim]);
  const ty = anim.interpolate({ inputRange:[0,1], outputRange:[-90,0] });
  return (
    <Animated.View style={[bn.root, { opacity:anim, transform:[{translateY:ty}] }]} pointerEvents="none">
      <BlurView intensity={Platform.OS==='ios'?28:18} tint="dark" style={bn.inner}>
        <View style={bn.iconWrap}><Ionicons name="shield-checkmark" size={18} color={C.amber}/></View>
        <View style={{flex:1}}>
          <Text style={bn.title}>Vidéo soumise à l'équipe Universe</Text>
          <Text style={bn.body}>Tu seras notifié dès qu'elle sera approuvée et visible dans les Reels.</Text>
        </View>
      </BlurView>
    </Animated.View>
  );
});
const bn = StyleSheet.create({
  root:    { position:'absolute', top:8, left:12, right:12, zIndex:300, borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:'rgba(245,158,11,0.35)', elevation:10 },
  inner:   { flexDirection:'row', alignItems:'flex-start', gap:12, padding:14 },
  iconWrap:{ width:36, height:36, borderRadius:18, backgroundColor:'rgba(245,158,11,0.15)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(245,158,11,0.30)' },
  title:   { color:C.white, fontSize:13, fontWeight:'800', marginBottom:2 },
  body:    { color:C.muted, fontSize:11, lineHeight:16 },
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAMP TEXTE
// ─────────────────────────────────────────────────────────────────────────────
const Field = memo(function Field({
  label, value, onChange, placeholder, multiline, maxLength, keyboardType='default',
}: {
  label:string; value:string; onChange:(v:string)=>void;
  placeholder?:string; multiline?:boolean; maxLength?:number;
  keyboardType?:'default'|'numeric'|'email-address';
}) {
  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <TextInput
        style={[fi.input, multiline && fi.multi]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={C.muted} multiline={multiline} maxLength={maxLength}
        keyboardType={keyboardType} returnKeyType={multiline?'default':'next'}
        selectionColor={C.accent} numberOfLines={multiline?4:1}
        autoCapitalize={keyboardType==='numeric'?'none':'sentences'}
      />
      {!!maxLength && value.length > maxLength * 0.75 && (
        <Text style={fi.count}>{value.length}/{maxLength}</Text>
      )}
    </View>
  );
});
const fi = StyleSheet.create({
  wrap:  { marginBottom:12 },
  label: { color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 },
  input: { backgroundColor:C.navy, borderRadius:12, paddingHorizontal:14, paddingVertical:12, color:C.white, fontSize:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  multi: { height:90, textAlignVertical:'top', paddingTop:12 },
  count: { color:C.muted, fontSize:9, textAlign:'right', marginTop:2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// GENRE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
const GenreDropdown = memo(function GenreDropdown({
  value, onSelect,
}: { value:string; onSelect:(v:string)=>void }) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = useCallback(() => {
    const next = !open; setOpen(next);
    Animated.spring(anim, { toValue:next?1:0, tension:70, friction:12, useNativeDriver:false }).start();
  }, [open, anim]);

  const select = useCallback((v: string) => {
    onSelect(v); setOpen(false);
    Animated.timing(anim, { toValue:0, duration:180, useNativeDriver:false }).start();
  }, [onSelect, anim]);

  const maxH   = anim.interpolate({ inputRange:[0,1], outputRange:[0, GENRES.length*50+8] });
  const sel    = GENRES.find(g => g.value === value);

  return (
    <View style={gd.wrap}>
      <Text style={fi.label}>GENRE</Text>
      <TouchableOpacity style={gd.trigger} onPress={toggle} activeOpacity={0.80}>
        <View style={gd.left}>
          {sel && <Ionicons name={sel.icon} size={15} color={C.accent} style={{marginRight:9}}/>}
          <Text style={[gd.trigTxt, !value && {color:C.muted}]}>
            {sel?.label ?? 'Sélectionne un genre…'}
          </Text>
        </View>
        <Ionicons name={open?'chevron-up':'chevron-down'} size={14} color={C.muted}/>
      </TouchableOpacity>
      <Animated.View style={[gd.listWrap, {maxHeight:maxH}]}>
        <View style={gd.list}>
          {GENRES.map((g, i) => {
            const on = value === g.value;
            return (
              <TouchableOpacity
                key={g.value}
                style={[gd.item, on && gd.itemOn, i<GENRES.length-1 && gd.itemBorder]}
                onPress={() => select(g.value)} activeOpacity={0.75}
              >
                <Ionicons name={g.icon} size={15} color={on?C.accent:C.muted} style={{marginRight:12}}/>
                <Text style={[gd.itemTxt, on && gd.itemTxtOn]}>{g.label}</Text>
                {on && <Ionicons name="checkmark-circle" size={15} color={C.accent} style={{marginLeft:'auto'}}/>}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
});
const gd = StyleSheet.create({
  wrap:      { marginBottom:12 },
  trigger:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.navy, borderRadius:12, paddingHorizontal:14, paddingVertical:13, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  left:      { flexDirection:'row', alignItems:'center', flex:1 },
  trigTxt:   { color:C.white, fontSize:14 },
  listWrap:  { overflow:'hidden', marginTop:4, borderRadius:12 },
  list:      { backgroundColor:C.navyHi, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderBr, overflow:'hidden' },
  item:      { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:13 },
  itemOn:    { backgroundColor:'rgba(167,139,250,0.12)' },
  itemBorder:{ borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border },
  itemTxt:   { color:C.mid, fontSize:13, fontWeight:'500', flex:1 },
  itemTxtOn: { color:C.white, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ SECTION MINIATURE — sélection galerie (toujours opérationnelle)
// ─────────────────────────────────────────────────────────────────────────────
interface ThumbSectionProps {
  thumbUri:      string | null;
  autoLoading:   boolean;
  onPickGallery: () => void;
}
const ThumbSection = memo(function ThumbSection({
  thumbUri, autoLoading, onPickGallery,
}: ThumbSectionProps) {
  return (
    <View style={th.wrap}>
      {/* En-tête */}
      <View style={th.header}>
        <Text style={fi.label}>MINIATURE</Text>
        {thumbUri && (
          <TouchableOpacity style={th.changeBtn} onPress={onPickGallery} activeOpacity={0.78}>
            <Ionicons name="image-outline" size={12} color={C.muted}/>
            <Text style={th.changeTxt}>Changer</Text>
          </TouchableOpacity>
        )}
      </View>

      {autoLoading && !thumbUri ? (
        /* Génération auto en cours */
        <View style={th.loading}>
          <ActivityIndicator size="small" color={C.accent}/>
          <Text style={th.loadingTxt}>Génération automatique…</Text>
        </View>
      ) : thumbUri ? (
        /* Aperçu miniature */
        <View style={th.preview}>
          <Image source={{ uri:thumbUri }} style={th.img} resizeMode="cover"/>
          <View style={th.badge}>
            <Ionicons name="checkmark-circle" size={14} color={C.success}/>
            <Text style={th.badgeTxt}>Miniature prête</Text>
          </View>
        </View>
      ) : (
        /* Bouton de sélection */
        <TouchableOpacity style={th.pick} onPress={onPickGallery} activeOpacity={0.80}>
          <View style={th.pickIcon}>
            <Ionicons name="image-outline" size={28} color={C.accent}/>
          </View>
          <Text style={th.pickTitle}>Choisir une miniature</Text>
          <Text style={th.pickSub}>Sélectionne une image depuis ta galerie</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});
const th = StyleSheet.create({
  wrap:      { marginBottom:16 },
  header:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  changeBtn: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:5, borderRadius:10, backgroundColor:C.navy, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  changeTxt: { color:C.muted, fontSize:11 },
  loading:   { flexDirection:'row', alignItems:'center', gap:10, padding:16, borderRadius:14, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  loadingTxt:{ color:C.muted, fontSize:12 },
  preview:   { borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:C.borderBr },
  img:       { width:'100%', height:180, resizeMode:'cover' },
  badge:     { position:'absolute', bottom:10, left:10, flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(7,12,23,0.82)', paddingHorizontal:10, paddingVertical:5, borderRadius:10 },
  badgeTxt:  { color:C.success, fontSize:11, fontWeight:'700' },
  pick:      { alignItems:'center', gap:8, padding:24, borderRadius:14, backgroundColor:C.navyLow, borderWidth:1, borderColor:C.borderBr, borderStyle:'dashed' },
  pickIcon:  { width:56, height:56, borderRadius:14, backgroundColor:C.navy, alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  pickTitle: { color:C.offWhite, fontSize:14, fontWeight:'700' },
  pickSub:   { color:C.muted, fontSize:11 },
});

// ─────────────────────────────────────────────────────────────────────────────
// BARRE PROGRESSION
// ─────────────────────────────────────────────────────────────────────────────
const ProgressBar = memo(function ProgressBar({
  anim, label,
}: { anim: Animated.Value; label: string }) {
  const width = anim.interpolate({ inputRange:[0,100], outputRange:['0%','100%'] });
  return (
    <View style={pb.wrap}>
      <View style={pb.track}>
        <Animated.View style={[pb.fill, {width}]}/>
      </View>
      <Text style={pb.label}>{label}</Text>
    </View>
  );
});
const pb = StyleSheet.create({
  wrap:  { gap:6, marginBottom:14 },
  track: { height:4, borderRadius:2, backgroundColor:C.navy, overflow:'hidden' },
  fill:  { height:'100%', borderRadius:2, backgroundColor:C.accent },
  label: { color:C.muted, fontSize:11, textAlign:'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★★★ VIDEO TAB ★★★
// ─────────────────────────────────────────────────────────────────────────────
const VideoTab = memo(function VideoTab() {

  // ── State ─────────────────────────────────────────────────────────────────
  const [video,       setVideo]       = useState<VideoAsset | null>(null);
  const [thumbUri,    setThumbUri]    = useState<string | null>(null);
  const [thumbBlob,   setThumbBlob]   = useState<Blob | null>(null); // web uniquement
  const [autoLoading, setAutoLoading] = useState(false);
  const [form,        setForm]        = useState<Form>(EMPTY);
  const [uploading,   setUploading]   = useState(false);
  const [phase,       setPhase]       = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [showBanner,  setShowBanner]  = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const progAnim    = useRef(new Animated.Value(0)).current;
  const scrollRef   = useRef<ScrollView>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(bannerTimer.current), []);

  // ── Animation progression ─────────────────────────────────────────────────
  const animProg = useCallback((val: number) => {
    Animated.timing(progAnim, { toValue:val, duration:200, useNativeDriver:false }).start();
  }, [progAnim]);

  // ── Form setters ──────────────────────────────────────────────────────────
  const setTitle    = useCallback((v:string) => setForm(p=>({...p,title:v})),    []);
  const setGenre    = useCallback((v:string) => setForm(p=>({...p,genre:v})),    []);
  const setDirector = useCallback((v:string) => setForm(p=>({...p,director:v})), []);
  const setYear     = useCallback((v:string) => setForm(p=>({...p,year:v})),     []);
  const setSynopsis = useCallback((v:string) => setForm(p=>({...p,synopsis:v})), []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setVideo(null); setThumbUri(null); setThumbBlob(null); setForm(EMPTY);
    setError(null); setPhase(''); progAnim.setValue(0);
    scrollRef.current?.scrollTo({ y:0, animated:true });
  }, [progAnim]);

  // ── Bannière ──────────────────────────────────────────────────────────────
  const triggerBanner = useCallback(() => {
    clearTimeout(bannerTimer.current);
    setShowBanner(true);
    bannerTimer.current = setTimeout(() => setShowBanner(false), BANNER_TTL);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ GÉNÉRATION AUTO — non-bloquante, bonus uniquement
  // ─────────────────────────────────────────────────────────────────────────
  const tryAutoThumb = useCallback(async (uri: string, durationMs?: number | null) => {
    if (!VideoThumbnails) return; // web ou module absent → skip silencieusement
    setAutoLoading(true);
    try {
      const seekMs = Math.min(1500, Math.round((durationMs ?? 3000) * 0.1));
      const { uri: tUri } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: seekMs, quality: 0.85,
      });
      setThumbUri(tUri);
    } catch {
      // Échec silencieux → l'utilisateur choisira manuellement
    } finally {
      setAutoLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ SÉLECTION MINIATURE DEPUIS LA GALERIE (toujours opérationnelle)
  // ─────────────────────────────────────────────────────────────────────────
  const pickThumbnail = useCallback(async () => {
    // ★ FIX FileReader — expo-image-picker passe par FileReader.readAsDataURL()
    // sur web, qui échoue de façon imprévisible sur certains fichiers (HEIC,
    // photos iCloud non téléchargées localement…) avec "Failed to read the
    // selected media". Même bypass que app/(tabs)/edit.tsx::handlePickAvatar —
    // <input type="file"> + URL.createObjectURL(), jamais de FileReader.
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0]; if (!file) return;
        setThumbUri(URL.createObjectURL(file));
        setThumbBlob(file); // ★ Blob réel gardé — jamais de re-fetch('blob:…') au submit
      };
      input.click();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Active l\'accès à la galerie dans les réglages.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ['images'] as any,
      allowsEditing: true,
      aspect:        [16, 9],
      quality:       0.90,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setThumbUri(result.assets[0].uri);
    setThumbBlob(null); // natif — pas de Blob web, submit() refera un fetch(file://…)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // SÉLECTION VIDÉO — galerie
  // ─────────────────────────────────────────────────────────────────────────
  const pickGallery = useCallback(async () => {
    // ★ FIX FileReader — même bypass que pickThumbnail/edit.tsx : ImagePicker
    // sur web lit le fichier via FileReader.readAsDataURL(), qui échoue
    // ("Failed to read the selected media") sur des vidéos volumineuses ou
    // certains formats. Un <input type="file"> + URL.createObjectURL() lit
    // le fichier directement, sans jamais passer par FileReader.
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'video/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0]; if (!file) return;
        const sizeErr = oversizeMsg(file.size);
        if (sizeErr) { setError(sizeErr); return; }
        const uri = URL.createObjectURL(file);
        const fileName = file.name || 'video.mp4';
        const asset: VideoAsset = {
          uri,
          fileName,
          fileSize: file.size,
          duration: null,
          // ★ file.type est souvent vide pour .mov dans les navigateurs (pas de
          // mapping MIME natif) — sans fallback par extension, le Content-Type
          // envoyé au storage ne correspond plus au fichier réel et le bucket
          // rejette l'upload avec un 400.
          mimeType: file.type || mimeFromExt(fileName),
          webBlob: file, // ★ Blob réel gardé — jamais de re-fetch('blob:…') au submit
        };
        setVideo(asset); setError(null);
        tryAutoThumb(uri, null);
        setTimeout(() => scrollRef.current?.scrollTo({ y:280, animated:true }), 350);
      };
      input.click();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Active la galerie dans les réglages.'); return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:       ['videos'] as any,
      videoMaxDuration: MAX_DUR_S,
      quality:          1,
      selectionLimit:   1,
      allowsEditing:    false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    const sizeErr = oversizeMsg(a.fileSize);
    if (sizeErr) { setError(sizeErr); return; }
    const asset: VideoAsset = {
      uri:      a.uri,
      fileName: a.fileName ?? a.uri.split('/').pop() ?? 'video.mp4',
      fileSize: a.fileSize,
      duration: a.duration,
      mimeType: a.mimeType ?? 'video/mp4',
    };
    setVideo(asset); setError(null);
    // Tente la génération auto en arrière-plan (non-bloquant)
    tryAutoThumb(a.uri, a.duration);
    setTimeout(() => scrollRef.current?.scrollTo({ y:280, animated:true }), 350);
  }, [tryAutoThumb]);

  // ─────────────────────────────────────────────────────────────────────────
  // CAMÉRA — filme réellement une vidéo
  // ─────────────────────────────────────────────────────────────────────────
  const pickCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Caméra inaccessible', 'Active la permission Caméra dans les réglages.'); return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes:       ['videos'] as any,
        videoMaxDuration: MAX_DUR_S,
        videoQuality:     1,
        allowsEditing:    false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const sizeErr = oversizeMsg(a.fileSize);
      if (sizeErr) { setError(sizeErr); return; }
      const asset: VideoAsset = {
        uri:      a.uri,
        fileName: a.fileName ?? `record_${Date.now()}.mp4`,
        fileSize: a.fileSize,
        duration: a.duration,
        mimeType: a.mimeType ?? 'video/mp4',
      };
      setVideo(asset); setError(null);
      tryAutoThumb(a.uri, a.duration);
      setTimeout(() => scrollRef.current?.scrollTo({ y:280, animated:true }), 350);
    } catch (e: any) {
      if (e?.message?.includes('simulat') || e?.message?.includes('unavailable')) {
        Alert.alert('Caméra indisponible', 'La caméra n\'est pas disponible sur cet appareil.');
      } else {
        Alert.alert('Erreur', e?.message ?? 'Impossible d\'ouvrir la caméra.');
      }
    }
  }, [tryAutoThumb]);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ UPLOAD COMPLET — miniature + vidéo + INSERT DB
  // Tous les champs correspondent au schéma public.reels exactement.
  // Les triggers tg_notif_reel_submitted + tg_reel_pending notifient le backoffice.
  // ─────────────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    // Validation
    if (!thumbUri)           { setError('Ajoute une miniature.');       return; }
    if (!form.title.trim())  { setError('Le titre est obligatoire.');   return; }
    if (!form.genre)         { setError('Sélectionne un genre.');       return; }

    setUploading(true); setError(null); animProg(2);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});

    try {
      // ★ ZERO supabase.auth.* — identité via getDeviceId(), comme partout
      // ailleurs dans l'app (CritiqueTab, profile, edit…). L'import vidéo ne
      // doit jamais exiger une connexion.
      const userId = await getDeviceId();

      const ts       = Date.now();
      const ext      = (video.fileName ?? 'video.mp4').split('.').pop() ?? 'mp4';
      // ★ Préfixe "posts/" — c'est le seul préfixe de community-images confirmé
      // accepter des écritures anonymes (ComposeModal::uploadImage l'utilise
      // avec succès, zéro session). "reels/" exigeait jusqu'ici une vraie
      // session (supabase.auth.getUser()) — la policy storage associée n'a
      // probablement jamais été ouverte à l'anon, d'où le 400 systématique
      // une fois l'auth retirée côté frontend.
      const vidPath  = `posts/${userId}_reel_${ts}.${ext}`;
      const thPath   = `posts/${userId}_reel_${ts}_thumb.jpg`;

      // ── A. Upload miniature (~8 % de la progression) ───────────────────
      // ★ Préfère le Blob déjà en main (web) — un fetch('blob:…') peut être
      // lu en interne via FileReader selon le runtime et échouer en silence.
      setPhase('Miniature…');
      const thBlob = thumbBlob ?? await resolveBlob(thumbUri);
      await uploadXHR(thPath, thBlob, thBlob.type || 'image/jpeg', p => animProg(2 + p * 0.06));

      const { data:thUrl } = supabase.storage.from(BUCKET).getPublicUrl(thPath);
      if (!thUrl?.publicUrl) throw new Error('URL miniature introuvable — vérifie que le bucket est public.');
      animProg(10);

      // ── B. Upload vidéo (10 → 90 %) ────────────────────────────────────
      // ★ Même principe que la miniature — Blob déjà en main sur web, jamais
      // de re-fetch('blob:…') qui peut déclencher l'erreur FileReader.
      setPhase('Vidéo en cours…');
      const vidBlob = video.webBlob ?? await resolveBlob(video.uri);
      await uploadXHR(vidPath, vidBlob, video.mimeType || mimeFromExt(vidPath), p => animProg(10 + p * 0.80));

      animProg(92);
      setPhase('Enregistrement…');

      const { data:vidUrl } = supabase.storage.from(BUCKET).getPublicUrl(vidPath);
      if (!vidUrl?.publicUrl) throw new Error('URL vidéo introuvable — vérifie que le bucket est public.');

      // ── C. INSERT reels (schéma exact) ─────────────────────────────────
      // Les triggers tg_notif_reel_submitted et tg_reel_pending se déclenchent
      // automatiquement et notifient le backoffice universe-admin.
      const { error:insErr } = await supabase.from('reels').insert({
        user_id:       userId,
        video_url:     vidUrl.publicUrl,
        thumbnail_url: thUrl.publicUrl,
        title:         form.title.trim()    || null,
        genre:         form.genre           || null,
        director:      form.director.trim() || null,
        year:          form.year.trim()     || null,
        synopsis:      form.synopsis.trim() || null,
        duration:      video.duration ? Math.round(video.duration / 1000) : null,
        likes_count:   0,
        views_count:   0,
        // status:     'pending'  ← valeur DEFAULT SQL, inutile de l'envoyer
        // rejection_category, rejection_reason, moderated_by, moderated_at
        //             ← null par défaut, remplis par le backoffice lors de la modération
      });
      if (insErr) throw new Error(insErr.message);

      // ── D. Succès ───────────────────────────────────────────────────────
      animProg(100);
      setPhase('');
      triggerBanner();
      setTimeout(reset, 1_800);

    } catch (e: any) {
      setError(e?.message ?? 'Une erreur est survenue. Réessaie.');
      animProg(0); setPhase('');
    } finally {
      setUploading(false);
    }
  }, [video, thumbUri, thumbBlob, form, animProg, triggerBanner, reset]);

  // ── Booleans dérivés ──────────────────────────────────────────────────────
  const canSubmit = useMemo(
    () => !!video && !!thumbUri && !uploading,
    [video, thumbUri, uploading],
  );

  const progressLabel = useMemo(() => {
    if (phase) return phase;
    const v = Math.round((progAnim as any)._value ?? 0);
    return v > 0 && v < 100 ? `${v}%` : '';
  }, [phase, progAnim]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex:1 }}>
      <Banner visible={showBanner}/>

      <KeyboardAvoidingView style={{ flex:1 }}
        behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={140}>
        <ScrollView ref={scrollRef}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* ────── ÉTAPE 1 : SÉLECTION VIDÉO ─────────────────────────── */}
          {!video ? (
            <View style={s.dropZone}>
              <View style={s.dropIconWrap}>
                <Ionicons name="cloud-upload-outline" size={36} color={C.white}/>
              </View>
              <Text style={s.dropTitle}>Importe ta vidéo</Text>
              <Text style={s.dropSub}>MP4 · MOV · MKV — {MAX_DUR_S/60} min maximum</Text>
              <View style={s.dropBtns}>
                <TouchableOpacity style={s.btnPrimary} onPress={pickGallery} activeOpacity={0.82}>
                  <Ionicons name="images-outline" size={16} color={C.white}/>
                  <Text style={s.btnPrimaryTxt}>Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSecondary} onPress={pickCamera} activeOpacity={0.82}>
                  <Ionicons name="camera-outline" size={16} color={C.offWhite}/>
                  <Text style={s.btnSecondaryTxt}>Caméra</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.dropHint}>
                Chaque vidéo est vérifiée par l'équipe Universe avant publication.
              </Text>
            </View>

          ) : (
            <>
              {/* ── Aperçu vidéo sélectionnée ─────────────────────────── */}
              <View style={s.videoPreview}>
                <BlurView intensity={16} tint="dark" style={s.videoBlur}>
                  <View style={s.videoIcon}>
                    <Ionicons name="videocam" size={22} color={C.white}/>
                  </View>
                  <View style={{flex:1,gap:3}}>
                    <Text style={s.videoName} numberOfLines={1}>{video.fileName ?? 'vidéo'}</Text>
                    <View style={{flexDirection:'row',gap:14}}>
                      <Text style={s.videoMeta}>{fmtDur(video.duration)}</Text>
                      <Text style={s.videoMeta}>{fmtSize(video.fileSize)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={reset} hitSlop={12}>
                    <Ionicons name="close-circle" size={22} color={C.muted}/>
                  </TouchableOpacity>
                </BlurView>
              </View>

              {/* ── ★ MINIATURE ──────────────────────────────────────── */}
              <ThumbSection
                thumbUri={thumbUri}
                autoLoading={autoLoading}
                onPickGallery={pickThumbnail}
              />
            </>
          )}

          {/* ────── ÉTAPE 2 : FORMULAIRE ────────────────────────────── */}
          <View style={s.form}>
            <Text style={s.formTitle}>Informations</Text>

            <Field label="TITRE *" value={form.title} onChange={setTitle}
              placeholder="Titre de ta vidéo" maxLength={120}/>

            <GenreDropdown value={form.genre} onSelect={setGenre}/>

            <View style={{flexDirection:'row',gap:10}}>
              <View style={{flex:1}}>
                <Field label="RÉALISATEUR" value={form.director} onChange={setDirector} placeholder="Nom"/>
              </View>
              <View style={{width:84}}>
                <Field label="ANNÉE" value={form.year} onChange={setYear}
                  placeholder="2024" keyboardType="numeric" maxLength={4}/>
              </View>
            </View>

            <Field label="SYNOPSIS" value={form.synopsis} onChange={setSynopsis}
              placeholder="Décris ta vidéo…" multiline maxLength={400}/>
          </View>

          {/* ────── PROGRESSION ─────────────────────────────────────── */}
          {uploading && <ProgressBar anim={progAnim} label={progressLabel}/>}

          {/* ────── ERREUR ───────────────────────────────────────────── */}
          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="warning-outline" size={15} color={C.error}/>
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          )}

          {/* ────── INFO MODÉRATION ──────────────────────────────────── */}
          {!!video && !uploading && !error && (
            <View style={s.infoBox}>
              <Ionicons name="shield-checkmark-outline" size={14} color={C.amber}/>
              <Text style={s.infoTxt}>
                Ta vidéo sera transmise à l'équipe Universe (backoffice) dès soumission.
                Tu seras notifié de la décision de modération.
              </Text>
            </View>
          )}

          {/* ────── BOUTON SOUMETTRE ─────────────────────────────────── */}
          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitOff]}
            onPress={submit} activeOpacity={0.84} disabled={!canSubmit}>
            {uploading
              ? <ActivityIndicator color={C.white} size="small"/>
              : <Ionicons name="cloud-upload" size={17} color={C.white}/>}
            <Text style={s.submitTxt}>
              {uploading ? phase || 'Upload en cours…' : 'Soumettre la vidéo'}
            </Text>
          </TouchableOpacity>


          <View style={{height:80}}/>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
});

export default VideoTab;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll:        { paddingHorizontal:16, paddingTop:4 },

  // Drop zone
  dropZone:      { alignItems:'center', borderRadius:20, padding:32, marginBottom:20, gap:10, borderWidth:1, borderColor:C.borderBr, borderStyle:'dashed', backgroundColor:C.navyLow },
  dropIconWrap:  { width:70, height:70, borderRadius:35, backgroundColor:C.navy, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.borderBr, marginBottom:4 },
  dropTitle:     { color:C.white, fontSize:18, fontWeight:'800' },
  dropSub:       { color:C.muted, fontSize:12 },
  dropBtns:      { flexDirection:'row', gap:12, marginTop:8 },
  btnPrimary:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.navy, paddingHorizontal:24, paddingVertical:12, borderRadius:24, borderWidth:1, borderColor:C.borderBr },
  btnPrimaryTxt: { color:C.white, fontSize:14, fontWeight:'800' },
  btnSecondary:  { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.navy, paddingHorizontal:22, paddingVertical:12, borderRadius:24, borderWidth:1, borderColor:C.borderBr },
  btnSecondaryTxt:{ color:C.offWhite, fontSize:14, fontWeight:'700' },
  dropHint:      { color:C.muted, fontSize:10, textAlign:'center', lineHeight:15, paddingHorizontal:20, marginTop:4 },

  // Video preview
  videoPreview:  { marginBottom:14 },
  videoBlur:     { flexDirection:'row', alignItems:'center', gap:12, padding:14, borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:C.borderBr },
  videoIcon:     { width:48, height:48, borderRadius:12, backgroundColor:C.navy, alignItems:'center', justifyContent:'center' },
  videoName:     { color:C.white, fontSize:13, fontWeight:'700' },
  videoMeta:     { color:C.muted, fontSize:11 },

  // Form
  form:          { marginBottom:16 },
  formTitle:     { color:C.offWhite, fontSize:13, fontWeight:'700', letterSpacing:0.4, marginBottom:14 },

  // Error
  errorBox:      { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(239,68,68,0.12)', borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:'rgba(239,68,68,0.25)' },
  errorTxt:      { flex:1, color:'#FCA5A5', fontSize:12 },

  // Info
  infoBox:       { flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:'rgba(245,158,11,0.08)', borderRadius:12, padding:12, marginBottom:14, borderWidth:1, borderColor:'rgba(245,158,11,0.20)' },
  infoTxt:       { flex:1, color:C.muted, fontSize:11, lineHeight:16 },

  // Submit
  submitBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:C.navy, borderRadius:16, paddingVertical:15, marginBottom:8, borderWidth:1, borderColor:C.borderBr },
  submitOff:     { opacity:0.38 },
  submitTxt:     { color:C.white, fontSize:15, fontWeight:'800' },
  hint:          { color:C.muted, fontSize:11, textAlign:'center' },
});