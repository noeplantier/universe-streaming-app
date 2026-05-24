/**
 * components/create/VideoTab.tsx — UNIVERSE · ÉDITION ULTRA-OPTIMISÉE
 *
 * Flow : Sélection/Caméra → Miniature obligatoire → Métadonnées → Upload XHR → Bannière
 *
 * Nouveautés :
 *  ─ Caméra réelle : launchCameraAsync + permissions micro incluses
 *  ─ Miniature obligatoire : expo-video-thumbnails + upload storage + thumbnail_url en DB
 *  ─ 15 genres cinéma indépendant en liste déroulante (pas de chips)
 *  ─ Tous les callbacks stable (useCallback / memo)
 *  ─ uploadXHR module-level (jamais recréée)
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Image,
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { BlurView }      from 'expo-blur';
import { Ionicons }      from '@expo/vector-icons';
import * as ImagePicker  from 'expo-image-picker';
import * as Haptics      from 'expo-haptics';

import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// expo-video-thumbnails (natif uniquement)
// ─────────────────────────────────────────────────────────────────────────────
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
const MAX_DURATION = 180; // secondes

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#070C17',
  navyMid:  'rgba(13,34,64,0.55)',
  navyLow:  'rgba(13,34,64,0.30)',
  navyHi:   'rgba(13,34,64,0.85)',
  border:   'rgba(255,255,255,0.09)',
  borderBr: 'rgba(255,255,255,0.18)',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.85)',
  mid:      'rgba(255,255,255,0.55)',
  muted:    'rgba(255,255,255,0.38)',
  faint:    'rgba(255,255,255,0.12)',
  neonL:    '#A78BFA',
  amber:    '#F59E0B',
  success:  '#22C55E',
  error:    '#EF4444',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ★ 15 GENRES CINÉMA INDÉPENDANT — valeurs stockées en DB (reels.genre)
// ─────────────────────────────────────────────────────────────────────────────
interface GenreDef {
  value: string;   // valeur stockée en DB
  label: string;   // label affiché
  icon:  keyof typeof Ionicons.glyphMap;
}

const GENRES: GenreDef[] = [
  { value: 'drame_intimiste',          label: 'Drame intimiste',            icon: 'heart-half-outline'       },
  { value: 'documentaire_social',      label: 'Documentaire social',        icon: 'people-outline'           },
  { value: 'court_experimental',       label: 'Court-métrage expérimental', icon: 'flask-outline'            },
  { value: 'film_auteur',              label: "Film d'auteur",              icon: 'eye-outline'              },
  { value: 'comedie_independante',     label: 'Comédie indépendante',       icon: 'happy-outline'            },
  { value: 'thriller_psychologique',   label: 'Thriller psychologique',     icon: 'pulse-outline'            },
  { value: 'film_noir_contemporain',   label: 'Film noir contemporain',     icon: 'moon-outline'             },
  { value: 'cinema_du_reel',           label: 'Cinéma du réel',             icon: 'camera-outline'           },
  { value: 'horreur_atmospherique',    label: 'Horreur atmosphérique',      icon: 'cloud-offline-outline'    },
  { value: 'sf_lo_fi',                 label: 'Science-fiction lo-fi',      icon: 'planet-outline'           },
  { value: 'romance_naturaliste',      label: 'Romance naturaliste',        icon: 'leaf-outline'             },
  { value: 'biopic_alternatif',        label: 'Biopic alternatif',          icon: 'person-outline'           },
  { value: 'animation_independante',   label: 'Animation indépendante',     icon: 'sparkles-outline'         },
  { value: 'road_movie',               label: 'Road movie',                 icon: 'car-outline'              },
  { value: 'portrait_territoire',      label: 'Portrait de territoire',     icon: 'map-outline'              },
];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Asset {
  uri:       string;
  fileName?: string | null;
  fileSize?: number | null;
  duration?: number | null;  // ms (expo-image-picker)
  mimeType?: string | null;
}

interface Form {
  title:    string;
  genre:    string;   // valeur DB (ex: 'drame_intimiste')
  director: string;
  year:     string;
  synopsis: string;
}

const EMPTY_FORM: Form = { title:'', genre:'', director:'', year:'', synopsis:'' };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — module-level, jamais recréés
// ─────────────────────────────────────────────────────────────────────────────
const fmtSize = (b?: number | null): string =>
  !b ? '—' : b < 1e6 ? `${(b/1e3).toFixed(0)} Ko` : `${(b/1e6).toFixed(1)} Mo`;

const fmtDur = (ms?: number | null): string => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
};

const genreLabel = (val: string): string =>
  GENRES.find(g => g.value === val)?.label ?? val;

async function uploadXHR(
  path: string, blob: Blob, mime: string,
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
// PERMISSIONS — caméra + micro (nécessaire pour l'enregistrement vidéo)
// ─────────────────────────────────────────────────────────────────────────────
async function requestCameraPermissions(): Promise<boolean> {
  const [cam, mic] = await Promise.all([
    ImagePicker.requestCameraPermissionsAsync(),
    ImagePicker.requestMediaLibraryPermissionsAsync(), // micro inclus sur certains OS
  ]);
  // Sur iOS, le micro est demandé automatiquement par launchCameraAsync
  return cam.status === 'granted';
}

async function requestGalleryPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

// ─────────────────────────────────────────────────────────────────────────────
// BANNIÈRE VÉRIFICATION
// ─────────────────────────────────────────────────────────────────────────────
const VerificationBanner = memo(function VerificationBanner({ visible }: { visible: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0, tension: 80, friction: 12, useNativeDriver: true,
    }).start();
  }, [visible, anim]);
  const translateY = anim.interpolate({ inputRange:[0,1], outputRange:[-90,0] });
  const opacity    = anim.interpolate({ inputRange:[0,1], outputRange:[0,1] });
  return (
    <Animated.View style={[bn.root, { transform:[{translateY}], opacity }]} pointerEvents="none">
      <BlurView intensity={Platform.OS==='ios'?28:18} tint="dark" style={bn.inner}>
        <View style={bn.iconRing}>
          <Ionicons name="shield-checkmark" size={17} color={C.amber}/>
        </View>
        <View style={{flex:1}}>
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
  root:    { position:'absolute', top:8, left:14, right:14, zIndex:200, borderRadius:18, overflow:'hidden', borderWidth:1, borderColor:'rgba(245,158,11,0.35)', shadowColor:'#F59E0B', shadowOpacity:0.22, shadowRadius:14, shadowOffset:{width:0,height:4}, elevation:10 },
  inner:   { flexDirection:'row', alignItems:'flex-start', gap:12, padding:14 },
  iconRing:{ width:38, height:38, borderRadius:19, backgroundColor:'rgba(245,158,11,0.14)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(245,158,11,0.28)' },
  title:   { color:C.white, fontSize:13, fontWeight:'800', marginBottom:2 },
  body:    { color:'rgba(255,255,255,0.48)', fontSize:11, lineHeight:16 },
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAMP TEXTE
// ─────────────────────────────────────────────────────────────────────────────
interface FieldProps {
  label:         string;
  value:         string;
  onChange:      (v:string) => void;
  placeholder?:  string;
  multiline?:    boolean;
  maxLength?:    number;
  keyboardType?: 'default'|'numeric'|'email-address';
}
const Field = memo(function Field({
  label, value, onChange, placeholder,
  multiline, maxLength, keyboardType='default',
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
        returnKeyType={multiline?'default':'next'}
        selectionColor={C.neonL}
        autoCapitalize={keyboardType==='numeric'?'none':'sentences'}
        numberOfLines={multiline?4:1}
      />
      {!!maxLength && value.length > maxLength * 0.8 && (
        <Text style={fi.count}>{value.length}/{maxLength}</Text>
      )}
    </View>
  );
});
const fi = StyleSheet.create({
  wrap:  { marginBottom:14 },
  label: { color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 },
  input: { backgroundColor:C.navyMid, borderRadius:12, paddingHorizontal:14, paddingVertical:12, color:C.white, fontSize:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  multi: { height:96, textAlignVertical:'top', paddingTop:12 },
  count: { color:C.muted, fontSize:9, textAlign:'right', marginTop:3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ GENRE DROPDOWN — liste déroulante (pas de chips)
// ─────────────────────────────────────────────────────────────────────────────
interface GenreDropdownProps {
  value:    string;
  onSelect: (v:string) => void;
}
const GenreDropdown = memo(function GenreDropdown({ value, onSelect }: GenreDropdownProps) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    Animated.spring(anim, {
      toValue: next ? 1 : 0, tension: 70, friction: 12, useNativeDriver: false,
    }).start();
  }, [open, anim]);

  const maxHeight = anim.interpolate({ inputRange:[0,1], outputRange:[0, GENRES.length * 50] });
  const opacity   = anim.interpolate({ inputRange:[0,1], outputRange:[0,1] });

  const handleSelect = useCallback((val: string) => {
    onSelect(val);
    setOpen(false);
    Animated.timing(anim, { toValue:0, duration:200, useNativeDriver:false }).start();
  }, [onSelect, anim]);

  const selected = GENRES.find(g => g.value === value);

  return (
    <View style={gd.wrap}>
      <Text style={fi.label}>GENRE</Text>

      {/* Bouton déclencheur */}
      <TouchableOpacity style={gd.trigger} onPress={toggle} activeOpacity={0.80}>
        <View style={gd.triggerLeft}>
          {selected && <Ionicons name={selected.icon} size={16} color={C.neonL} style={{marginRight:8}}/>}
          <Text style={[gd.triggerTxt, !value && {color:C.muted}]}>
            {value ? selected?.label : 'Sélectionne un genre…'}
          </Text>
        </View>
        <Ionicons name={open?'chevron-up':'chevron-down'} size={14} color={C.muted}/>
      </TouchableOpacity>

      {/* Liste déroulante animée */}
      <Animated.View style={[gd.list, {maxHeight, opacity}]}>
        <View style={gd.listInner}>
          {GENRES.map((g, i) => {
            const isSelected = value === g.value;
            return (
              <TouchableOpacity
                key={g.value}
                style={[gd.item, isSelected && gd.itemSelected, i < GENRES.length-1 && gd.itemBorder]}
                onPress={() => handleSelect(g.value)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={g.icon}
                  size={15}
                  color={isSelected ? C.neonL : C.muted}
                  style={{marginRight:12}}
                />
                <Text style={[gd.itemTxt, isSelected && gd.itemTxtSelected]}>
                  {g.label}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={16} color={C.neonL} style={{marginLeft:'auto'}}/>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
});
const gd = StyleSheet.create({
  wrap:            { marginBottom:14 },
  trigger:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.navyMid, borderRadius:12, paddingHorizontal:14, paddingVertical:13, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  triggerLeft:     { flexDirection:'row', alignItems:'center', flex:1 },
  triggerTxt:      { color:C.white, fontSize:14 },
  list:            { overflow:'hidden', borderRadius:12, marginTop:4 },
  listInner:       { backgroundColor:C.navyHi, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderBr, overflow:'hidden' },
  item:            { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:13 },
  itemSelected:    { backgroundColor:'rgba(167,139,250,0.10)' },
  itemBorder:      { borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border },
  itemTxt:         { color:C.mid, fontSize:13, fontWeight:'500', flex:1 },
  itemTxtSelected: { color:C.white, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ VIDEO TAB
// ─────────────────────────────────────────────────────────────────────────────
const VideoTab = memo(function VideoTab() {

  // ── State ──────────────────────────────────────────────────────────────────
  const [asset,       setAsset]       = useState<Asset | null>(null);
  const [thumbUri,    setThumbUri]    = useState<string | null>(null);  // ★ miniature locale
  const [thumbLoading,setThumbLoading]= useState(false);
  const [form,        setForm]        = useState<Form>(EMPTY_FORM);
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [phase,       setPhase]       = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [showBanner,  setShowBanner]  = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const progAnim    = useRef(new Animated.Value(0)).current;
  const scrollRef   = useRef<ScrollView>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(bannerTimer.current), []);

  // ── Animation progression ──────────────────────────────────────────────────
  const animProg = useCallback((pct: number) => {
    setProgress(pct);
    Animated.timing(progAnim, {
      toValue: pct / 100, duration: 180, useNativeDriver: false,
    }).start();
  }, [progAnim]);

  // ── Bannière succès ────────────────────────────────────────────────────────
  const triggerBanner = useCallback(() => {
    clearTimeout(bannerTimer.current);
    setShowBanner(true);
    bannerTimer.current = setTimeout(() => setShowBanner(false), BANNER_TTL);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  // ── Setters form stables ───────────────────────────────────────────────────
  const setTitle    = useCallback((v:string) => setForm(p=>({...p,title:v})),    []);
  const setDirector = useCallback((v:string) => setForm(p=>({...p,director:v})), []);
  const setYear     = useCallback((v:string) => setForm(p=>({...p,year:v})),     []);
  const setSynopsis = useCallback((v:string) => setForm(p=>({...p,synopsis:v})), []);
  const setGenre    = useCallback((v:string) => setForm(p=>({...p,genre:v})),    []);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setAsset(null); setThumbUri(null); setForm(EMPTY_FORM);
    setError(null); setProgress(0); setPhase('');
    progAnim.setValue(0);
    scrollRef.current?.scrollTo({ y:0, animated:true });
  }, [progAnim]);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ GÉNÉRATION MINIATURE — expo-video-thumbnails
  // ─────────────────────────────────────────────────────────────────────────
  const generateThumbnail = useCallback(async (videoUri: string) => {
    if (!VideoThumbnails) {
      // Web : pas de génération native → l'utilisateur ne peut pas soumettre sans miniature
      setThumbUri(null);
      return;
    }
    setThumbLoading(true);
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time:    1500,   // ms depuis le début
        quality: 0.85,
      });
      setThumbUri(uri);
    } catch {
      setThumbUri(null);
    } finally {
      setThumbLoading(false);
    }
  }, []);

  // Regénère à un timestamp différent
  const regenerateThumbnail = useCallback(async () => {
    if (!asset || !VideoThumbnails) return;
    setThumbLoading(true);
    try {
      const randomMs = Math.random() * Math.min((asset.duration ?? 5000), 10_000);
      const { uri } = await VideoThumbnails.getThumbnailAsync(asset.uri, {
        time:    Math.round(randomMs),
        quality: 0.85,
      });
      setThumbUri(uri);
    } catch {}
    finally { setThumbLoading(false); }
  }, [asset]);

  // ── Processus commun après sélection d'un asset ────────────────────────
  const handleAsset = useCallback(async (a: Asset) => {
    setAsset(a);
    setError(null);
    // Génère automatiquement la miniature
    await generateThumbnail(a.uri);
    setTimeout(() => scrollRef.current?.scrollTo({ y:280, animated:true }), 400);
  }, [generateThumbnail]);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ CAMÉRA — filme réellement une vidéo
  // ─────────────────────────────────────────────────────────────────────────
  const pickCamera = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const granted = await requestCameraPermissions();
    if (!granted) {
      Alert.alert(
        'Caméra inaccessible',
        'Active la permission Caméra dans les réglages de ton téléphone.',
        [{ text: 'OK' }],
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes:       ['videos'] as any,
        videoMaxDuration: MAX_DURATION,
        videoQuality:     1, // meilleure qualité disponible
        allowsEditing:    false,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      await handleAsset({
        uri:      a.uri,
        fileName: a.fileName ?? `video_${Date.now()}.mp4`,
        fileSize: a.fileSize,
        duration: a.duration,
        mimeType: a.mimeType ?? 'video/mp4',
      });
    } catch (e: any) {
      // Sur simulateur iOS la caméra n'est pas disponible
      if (e?.message?.includes('simulat') || e?.message?.includes('unavailable')) {
        Alert.alert('Caméra indisponible', 'La caméra n\'est pas disponible sur cet appareil.');
      } else {
        Alert.alert('Erreur', e?.message ?? 'Impossible d\'ouvrir la caméra.');
      }
    }
  }, [handleAsset]);

  // ─────────────────────────────────────────────────────────────────────────
  // GALERIE
  // ─────────────────────────────────────────────────────────────────────────
  const pickGallery = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const granted = await requestGalleryPermissions();
    if (!granted) {
      Alert.alert('Galerie inaccessible', 'Active la permission Galerie dans les réglages.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ['videos'] as any,
      videoMaxDuration: MAX_DURATION,
      quality:       1,
      selectionLimit:1,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    await handleAsset({
      uri:      a.uri,
      fileName: a.fileName ?? a.uri.split('/').pop() ?? 'video.mp4',
      fileSize: a.fileSize,
      duration: a.duration,
      mimeType: a.mimeType ?? 'video/mp4',
    });
  }, [handleAsset]);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ UPLOAD — vidéo + miniature + INSERT reels
  // ─────────────────────────────────────────────────────────────────────────
  const upload = useCallback(async () => {
    if (!asset)           { setError('Sélectionne une vidéo.'); return; }
    if (!thumbUri)        { setError('La miniature est obligatoire. Attends la génération ou regénère-en une.'); return; }
    if (!form.title.trim()){ setError('Le titre est obligatoire.'); return; }
    if (!form.genre)       { setError('Choisis un genre.'); return; }

    setUploading(true); setError(null); animProg(2);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Non authentifié — connecte-toi d\'abord.');

      const ts   = Date.now();
      const ext  = (asset.fileName ?? 'video.mp4').split('.').pop() ?? 'mp4';
      const vidPath   = `reels/${user.id}/${ts}.${ext}`;
      const thumbPath = `reels/${user.id}/${ts}_thumb.jpg`;

      // ── A. Upload miniature (rapide, ~5 % de la progression) ─────────────
      setPhase('Miniature…');
      const thumbResp = await fetch(thumbUri);
      const thumbBlob = await thumbResp.blob();
      await uploadXHR(thumbPath, thumbBlob, 'image/jpeg', pct => animProg(2 + pct * 0.05));

      const { data: thumbUrlData } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath);
      if (!thumbUrlData?.publicUrl) throw new Error('URL miniature introuvable.');
      animProg(8);

      // ── B. Upload vidéo (progression 8 → 90 %) ────────────────────────────
      setPhase('Vidéo…');
      const vidResp = await fetch(asset.uri);
      const vidBlob = await vidResp.blob();
      await uploadXHR(
        vidPath, vidBlob,
        asset.mimeType ?? 'video/mp4',
        pct => animProg(8 + pct * 0.82),
      );

      animProg(92);
      setPhase('Finalisation…');

      const { data: vidUrlData } = supabase.storage.from(BUCKET).getPublicUrl(vidPath);
      if (!vidUrlData?.publicUrl) throw new Error('URL vidéo introuvable.');

      // ── C. INSERT reels ───────────────────────────────────────────────────
      const { error: insErr } = await supabase.from('reels').insert({
        user_id:       user.id,
        video_url:     vidUrlData.publicUrl,
        thumbnail_url: thumbUrlData.publicUrl,   // ★ miniature obligatoire
        title:         form.title.trim()    || null,
        genre:         form.genre           || null,
        director:      form.director.trim() || null,
        year:          form.year.trim()     || null,
        synopsis:      form.synopsis.trim() || null,
        duration:      asset.duration ? Math.round(asset.duration / 1000) : null,
        likes_count:   0,
        views_count:   0,
        // status: 'pending' par défaut (SQL)
      });
      if (insErr) throw new Error(insErr.message);

      animProg(100); setPhase('');
      triggerBanner();
      setTimeout(reset, 1_400);

    } catch (e: any) {
      setError(e?.message ?? 'Erreur inconnue.');
      animProg(0); setPhase('');
    } finally {
      setUploading(false);
    }
  }, [asset, thumbUri, form, animProg, triggerBanner, reset]);

  // Validité du formulaire
  const canSubmit = useMemo(
    () => !!asset && !!thumbUri && !thumbLoading && !uploading,
    [asset, thumbUri, thumbLoading, uploading],
  );

  // Largeur barre de progression
  const progWidth = useMemo(
    () => ({ width: progAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }),
    [progAnim],
  );

  // ────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex:1 }}>
      <VerificationBanner visible={showBanner}/>

      <KeyboardAvoidingView
        style={{ flex:1 }}
        behavior={Platform.OS==='ios' ? 'padding' : undefined}
        keyboardVerticalOffset={140}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── ÉTAPE 1 : SÉLECTION ─────────────────────────────────── */}
          {!asset ? (
            <View style={s.dropZone}>
              <View style={s.dropIcon}>
                <Ionicons name="cloud-upload" size={34} color={C.white}/>
              </View>
              <Text style={s.dropTitle}>Importe ta vidéo</Text>
              <Text style={s.dropSub}>MP4 · MOV · MKV  ·  {MAX_DURATION / 60} min maximum</Text>

              <View style={s.dropBtns}>
                <TouchableOpacity style={s.btnPrimary} onPress={pickGallery} activeOpacity={0.82}>
                  <Ionicons name="images" size={16} color={C.white}/>
                  <Text style={s.btnPrimaryTxt}>Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSecondary} onPress={pickCamera} activeOpacity={0.82}>
                  <Ionicons name="camera" size={16} color={C.offWhite}/>
                  <Text style={s.btnSecondaryTxt}>Caméra</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.dropHint}>
                Ta vidéo sera examinée par l'équipe Universe avant d'apparaître dans les Reels.
              </Text>
            </View>

          ) : (
            <>
              {/* ── ÉTAPE 2 : APERÇU VIDÉO + MINIATURE ─────────────── */}
              <View style={s.preview}>
                <BlurView intensity={18} tint="dark" style={s.previewBlur}>
                  <View style={s.previewIcon}>
                    <Ionicons name="videocam" size={24} color={C.white}/>
                  </View>
                  <View style={{flex:1,gap:3}}>
                    <Text style={s.previewName} numberOfLines={1}>
                      {asset.fileName ?? 'vidéo'}
                    </Text>
                    <View style={{flexDirection:'row',gap:12}}>
                      <Text style={s.previewMeta}>{fmtDur(asset.duration)}</Text>
                      <Text style={s.previewMeta}>{fmtSize(asset.fileSize)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={reset} hitSlop={12}>
                    <Ionicons name="close-circle" size={22} color={C.muted}/>
                  </TouchableOpacity>
                </BlurView>
              </View>

              {/* ── ★ MINIATURE OBLIGATOIRE ─────────────────────────── */}
              <View style={s.thumbSection}>
                <View style={s.thumbHeader}>
                  <Text style={s.thumbTitle}>Miniature</Text>
                  {thumbUri && !thumbLoading && (
                    <TouchableOpacity style={s.thumbRegen} onPress={regenerateThumbnail} activeOpacity={0.78}>
                      <Ionicons name="refresh-outline" size={12} color={C.muted}/>
                      <Text style={s.thumbRegenTxt}>Regénérer</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {thumbLoading ? (
                  <View style={s.thumbLoading}>
                    <ActivityIndicator color={C.neonL} size="small"/>
                    <Text style={s.thumbLoadingTxt}>Génération de la miniature…</Text>
                  </View>
                ) : thumbUri ? (
                  <View style={s.thumbPreview}>
                    <Image source={{uri:thumbUri}} style={s.thumbImg} resizeMode="cover"/>
                    <View style={s.thumbCheckBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={C.success}/>
                      <Text style={s.thumbCheckTxt}>Miniature prête</Text>
                    </View>
                  </View>
                ) : (
                  <View style={s.thumbEmpty}>
                    <Ionicons name="image-outline" size={28} color={C.muted}/>
                    <Text style={s.thumbEmptyTxt}>Miniature non disponible sur cette plateforme</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* ── ÉTAPE 3 : FORMULAIRE ────────────────────────────────── */}
          <View style={s.form}>
            <Text style={s.formHeading}>Informations</Text>

            <Field label="TITRE *" value={form.title} onChange={setTitle}
              placeholder="Titre de ton reel" maxLength={120}/>

            {/* ★ Dropdown genre */}
            <GenreDropdown value={form.genre} onSelect={setGenre}/>

            <View style={{flexDirection:'row',gap:10}}>
              <View style={{flex:1}}>
                <Field label="RÉALISATEUR" value={form.director} onChange={setDirector} placeholder="Nom"/>
              </View>
              <View style={{width:86}}>
                <Field label="ANNÉE" value={form.year} onChange={setYear}
                  placeholder="2024" keyboardType="numeric" maxLength={4}/>
              </View>
            </View>

            <Field label="SYNOPSIS" value={form.synopsis} onChange={setSynopsis}
              placeholder="Décris ton reel…" multiline maxLength={400}/>
          </View>

          {/* ── PROGRESSION ─────────────────────────────────────────── */}
          {uploading && (
            <View style={s.progressWrap}>
              <View style={s.progressBg}>
                <Animated.View style={[s.progressFill, progWidth]}/>
              </View>
              <Text style={s.progressTxt}>
                {phase || (progress < 90 ? `${progress}%` : 'Finalisation…')}
              </Text>
            </View>
          )}

          {/* ── ERREUR ──────────────────────────────────────────────── */}
          {!!error && (
            <View style={s.msgBox}>
              <Ionicons name="warning-outline" size={15} color={C.error}/>
              <Text style={s.msgTxt}>{error}</Text>
            </View>
          )}

          {/* ── INFO MODÉRATION ─────────────────────────────────────── */}
          {!!asset && !uploading && !error && (
            <View style={s.infoBox}>
              <Ionicons name="shield-checkmark-outline" size={14} color={C.amber}/>
              <Text style={s.infoTxt}>
                Chaque vidéo est examinée par l'équipe Universe avant publication dans les Reels.
              </Text>
            </View>
          )}

          {/* ── BOUTON SOUMETTRE ────────────────────────────────────── */}
          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitOff]}
            onPress={upload}
            activeOpacity={0.84}
            disabled={!canSubmit}
          >
            {uploading
              ? <ActivityIndicator color={C.white} size="small"/>
              : <Ionicons name="cloud-upload" size={17} color={C.white}/>
            }
            <Text style={s.submitTxt}>
              {uploading ? `${phase || 'Import en cours…'}` : 'Soumettre la vidéo'}
            </Text>
          </TouchableOpacity>

          {/* Raison de désactivation du bouton */}
          {!canSubmit && !uploading && (
            <Text style={s.submitHint}>
              {!asset       ? 'Sélectionne une vidéo'
              : thumbLoading ? 'Génération de la miniature…'
              : !thumbUri   ? 'Miniature requise'
              : ''}
            </Text>
          )}

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
  scroll:   { paddingHorizontal:16, paddingTop:4 },

  // Drop zone
  dropZone:      { alignItems:'center', borderRadius:20, padding:32, marginBottom:20, gap:10, borderWidth:1, borderColor:C.borderBr, borderStyle:'dashed', backgroundColor:C.navyLow },
  dropIcon:      { width:68, height:68, borderRadius:34, backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.borderBr, marginBottom:4 },
  dropTitle:     { color:C.white, fontSize:18, fontWeight:'800' },
  dropSub:       { color:C.muted, fontSize:12 },
  dropBtns:      { flexDirection:'row', gap:12, marginTop:6 },
  btnPrimary:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.navyMid, paddingHorizontal:24, paddingVertical:12, borderRadius:24, borderWidth:1, borderColor:C.borderBr },
  btnPrimaryTxt: { color:C.white, fontSize:14, fontWeight:'800' },
  btnSecondary:  { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.navyMid, paddingHorizontal:22, paddingVertical:12, borderRadius:24, borderWidth:1, borderColor:C.borderBr },
  btnSecondaryTxt:{ color:C.offWhite, fontSize:14, fontWeight:'700' },
  dropHint:      { color:C.muted, fontSize:10, textAlign:'center', lineHeight:15, paddingHorizontal:20 },

  // Preview
  preview:     { marginBottom:14 },
  previewBlur: { flexDirection:'row', alignItems:'center', gap:12, padding:14, borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:C.borderBr },
  previewIcon: { width:50, height:50, borderRadius:12, backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center' },
  previewName: { color:C.white, fontSize:13, fontWeight:'700' },
  previewMeta: { color:C.muted, fontSize:11 },

  // Thumbnail
  thumbSection:   { marginBottom:20, gap:10 },
  thumbHeader:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  thumbTitle:     { color:C.offWhite, fontSize:13, fontWeight:'700' },
  thumbRegen:     { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:5, borderRadius:10, backgroundColor:C.navyMid, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  thumbRegenTxt:  { color:C.muted, fontSize:11 },
  thumbLoading:   { flexDirection:'row', alignItems:'center', gap:10, padding:16, borderRadius:14, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  thumbLoadingTxt:{ color:C.muted, fontSize:12 },
  thumbPreview:   { borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:C.borderBr },
  thumbImg:       { width:'100%', height:180 },
  thumbCheckBadge:{ position:'absolute', bottom:10, left:10, flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(7,12,23,0.80)', paddingHorizontal:10, paddingVertical:5, borderRadius:10 },
  thumbCheckTxt:  { color:C.success, fontSize:11, fontWeight:'700' },
  thumbEmpty:     { alignItems:'center', gap:8, padding:24, borderRadius:14, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  thumbEmptyTxt:  { color:C.muted, fontSize:11, textAlign:'center' },

  // Form
  form:        { gap:0, marginBottom:16 },
  formHeading: { color:C.offWhite, fontSize:13, fontWeight:'700', letterSpacing:0.5, marginBottom:16 },

  // Progress
  progressWrap: { marginBottom:14, gap:6 },
  progressBg:   { height:4, borderRadius:3, backgroundColor:C.navyMid, overflow:'hidden' },
  progressFill: { height:'100%', backgroundColor:C.neonL, borderRadius:3 },
  progressTxt:  { color:C.muted, fontSize:11, textAlign:'center' },

  // Error
  msgBox: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(239,68,68,0.12)', borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:'rgba(239,68,68,0.25)' },
  msgTxt: { flex:1, color:'#FCA5A5', fontSize:12 },

  // Info
  infoBox: { flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:'rgba(245,158,11,0.08)', borderRadius:12, padding:12, marginBottom:14, borderWidth:1, borderColor:'rgba(245,158,11,0.20)' },
  infoTxt: { flex:1, color:'rgba(255,255,255,0.45)', fontSize:11, lineHeight:16 },

  // Submit
  submitBtn:  { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:C.navyMid, borderRadius:16, paddingVertical:15, marginBottom:8, borderWidth:1, borderColor:C.borderBr },
  submitOff:  { opacity:0.40 },
  submitTxt:  { color:C.white, fontSize:15, fontWeight:'800' },
  submitHint: { color:C.muted, fontSize:11, textAlign:'center', marginBottom:8 },
});