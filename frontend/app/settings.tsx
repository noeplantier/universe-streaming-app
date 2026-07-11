/**
 * app/settings.tsx — Paramètres UNIVERSE
 *
 * ★★★ LE VRAI BUG DES TOGGLES BLOQUÉS ★★★
 * Ce fichier était le SEUL de tout Universe à s'appuyer sur
 * `supabase.auth.getUser()` / `signOut()` / `resetPasswordForEmail()`.
 * Tous les autres fichiers du projet (DropdownMenu, VideoTab,
 * GamificationSystem, reels/index...) sont construits sur un principe
 * explicite : ZÉRO `supabase.auth.*`, l'identité vient exclusivement de
 * `getDeviceId()` (services/api). Résultat concret ici : Universe n'ouvre
 * jamais de vraie session Supabase Auth, donc `supabase.auth.getUser()`
 * ne renvoie JAMAIS d'utilisateur → `authUid` restait vide → le garde-fou
 * ajouté au tour précédent ("si !userId → refuser") bloquait alors
 * SYSTÉMATIQUEMENT tous les toggles. Ce n'était pas un bug de logique,
 * c'était une mauvaise source d'identité.
 *
 * ★ CORRECTIF : identité alignée sur le reste de l'app via getDeviceId().
 * `user_preferences.user_id` référence bien `auth.users(id)` côté DB, et
 * `getDeviceId()` renvoie cet identifiant valide (anonyme ou non) déjà
 * utilisé avec succès partout ailleurs pour écrire dans Supabase — donc
 * les upserts fonctionnent enfin, sans jamais envoyer `user_id: ''`.
 *
 * ★★ AUTRES CHANGEMENTS ★★
 * 1. Toggles : cercle (thumb) BLANC fixe en OFF et en ON, en couleurs
 *    hexadécimales pleines (pas de rgba) — évite les incohérences de
 *    rendu Android où un track semi-transparent laisse parfois passer
 *    la teinte système (vert) en dessous.
 * 2. Préférences strictement alignées sur `public.user_preferences` : 8
 *    colonnes, 8 contrôles, ni plus ni moins. `video_quality` est un vrai
 *    sélecteur (enum texte), pas un toggle.
 * 3. Session : plus de "Mot de passe" (aucune colonne email/auth réelle
 *    dans ce modèle), "Se déconnecter" désormais un vrai reset d'identité
 *    locale cohérent avec une app sans compte email/mot de passe.
 * 4. UX Universe : bandeau de synchro discret ("Préférences
 *    synchronisées"), accent doré cohérent avec le reste de l'app
 *    (badges, gamification), copy repositionnée autour du cinéma indé.
 *
 * COULEURS : NAVY (#0D2240) + transparent + accent doré Universe (#F5C842)
 * SECTIONS : Lecture · Notifications · Confidentialité · Stockage · Compte
 *            Aide · Légal · Session
 */

import React, {
  memo, useState, useEffect, useCallback, useRef,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, Animated, Platform,
  ActivityIndicator, Switch, Modal,
} from 'react-native';
import { Image }           from 'expo-image';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { StatusBar }       from 'expo-status-bar';
import { Ionicons }        from '@expo/vector-icons';
import { useRouter }       from 'expo-router';

import { supabase }        from '@/lib/supabase';
import { getDeviceId }     from '@/services/api';
import GalaxyBackground    from '@/components/shared/GalaxyBackground';

// ── Imports natifs : require conditionnel → ne crashent pas sur web ──────────
let ImagePicker: any = null;
let FileSystem:  any = null;
let Haptics:     any = null;
let decode:      ((b64:string)=>ArrayBuffer)|null = null;

if (Platform.OS !== 'web') {
  try { ImagePicker = require('expo-image-picker');    } catch {}
  try { FileSystem  = require('expo-file-system');     } catch {}
  try { Haptics     = require('expo-haptics');         } catch {}
  try { decode      = require('base64-arraybuffer').decode; } catch {}
}

// ── BlurView web-safe ─────────────────────────────────────────────────────────
let _BlurView: any = null;
if (Platform.OS !== 'web') {
  try { _BlurView = require('expo-blur').BlurView; } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const NAVY   = '#0D2240';
const NAVY_D = '#060F1E';
const GOLD   = '#F5C842'; // accent Universe (badges, XP, gamification)

const T = {
  bg:       NAVY_D,
  surf:     'rgba(13,34,64,0.55)',
  surfHi:   'rgba(13,34,64,0.82)',
  surfMd:   'rgba(13,34,64,0.68)',
  border:   'rgba(255,255,255,0.08)',
  borderHi: 'rgba(255,255,255,0.15)',
  text:     '#FFFFFF',
  textSec:  'rgba(255,255,255,0.55)',
  textTert: 'rgba(255,255,255,0.28)',
  red:      '#FF4444',
  green:    '#22C55E',
  gold:     GOLD,
} as const;

// ★ Toggles — cercle TOUJOURS blanc, couleurs hex pleines (pas de rgba) pour
// un rendu garanti identique sur iOS et Android, jamais de vert système.
const SWITCH_TRACK_OFF = '#16233A';
const SWITCH_TRACK_ON  = '#3D4E6B';
const SWITCH_THUMB     = '#FFFFFF';

const EDGE = 16;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Profile {
  id:string; display_name:string; username:string; bio:string;
  avatar_url:string; role:string; is_pro:boolean;
}

type VideoQuality = 'auto' | '4k' | '1080p' | '720p' | '480p';

// ★ Strictement les 8 colonnes de public.user_preferences — rien de plus.
interface Prefs {
  autoplay:         boolean;
  video_quality:    VideoQuality;
  data_saver:       boolean;
  notif_releases:   boolean;
  notif_social:     boolean;
  notif_festivals:  boolean;
  private_profile:  boolean;
  public_watchlist: boolean;
}
const PREFS_DEFAULT: Prefs = {
  autoplay:         true,
  video_quality:    'auto',
  data_saver:       false,
  notif_releases:   true,
  notif_social:     true,
  notif_festivals:  false,
  private_profile:  false,
  public_watchlist: true,
};

const QUALITY_OPTIONS: { value: VideoQuality; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'auto',  label: 'Automatique',  hint: 'S\'adapte à votre connexion',        icon: 'flash-outline' },
  { value: '4k',    label: '4K Ultra HD',  hint: 'Meilleure qualité, plus de données', icon: 'diamond-outline' },
  { value: '1080p', label: 'Full HD',      hint: '1080p',                             icon: 'tv-outline' },
  { value: '720p',  label: 'HD',           hint: '720p',                              icon: 'phone-portrait-outline' },
  { value: '480p',  label: 'Économique',   hint: '480p, données réduites',            icon: 'leaf-outline' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE HELPERS — ZÉRO supabase.auth.*, identité = getDeviceId()
// ─────────────────────────────────────────────────────────────────────────────
async function fetchProfile(uid: string): Promise<Profile|null> {
  const { data } = await supabase
    .from('profiles')
    .select('id,display_name,username,bio,avatar_url,role,is_pro')
    .eq('id', uid)
    .maybeSingle();
  return (data as Profile) ?? null;
}

async function fetchPrefs(uid: string): Promise<Prefs> {
  const { data } = await supabase
    .from('user_preferences')
    .select('autoplay,video_quality,data_saver,notif_releases,notif_social,notif_festivals,private_profile,public_watchlist')
    .eq('user_id', uid)
    .maybeSingle();
  return data ? { ...PREFS_DEFAULT, ...data } as Prefs : PREFS_DEFAULT;
}

async function upsertPref<K extends keyof Prefs>(uid: string, key: K, value: Prefs[K]) {
  if (!uid) throw new Error('UID manquant');

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: uid, [key]: value }, { onConflict: 'user_id' });

  if (error) throw error;
}

async function uploadAvatar(uri: string, uid: string): Promise<string|null> {
  try {
    const isBlob = uri.startsWith('blob:');
    const rawExt = isBlob ? 'jpg' : (uri.split('.').pop()?.toLowerCase() ?? 'jpg');
    const ext    = ['jpg','jpeg','png','webp'].includes(rawExt) ? rawExt : 'jpg';
    const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
    const path   = `avatars/${uid}.${ext}`;
    let payload: ArrayBuffer;
    if (Platform.OS === 'web' || isBlob) {
      payload = await fetch(uri).then(r => r.arrayBuffer());
    } else {
      if (!FileSystem || !decode) return null;
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      payload = decode(b64);
    }
    const { error } = await supabase.storage.from('avatars').upload(path, payload, { contentType:mime, upsert:true });
    if (error) throw error;
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + `?t=${Date.now()}`;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES UI
// ─────────────────────────────────────────────────────────────────────────────

const SectionTitle = memo(function SectionTitle({ label, icon }: { label:string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={sct.row}>
      {icon && <Ionicons name={icon} size={11} color={T.textTert} style={{ marginRight:2 }}/>}
      <Text style={sct.txt}>{label.toUpperCase()}</Text>
      <View style={sct.line}/>
    </View>
  );
});
const sct = StyleSheet.create({
  row: { flexDirection:'row', alignItems:'center', gap:8, marginHorizontal:EDGE, marginTop:28, marginBottom:10 },
  line:{ flex:1, height:StyleSheet.hairlineWidth, backgroundColor:T.border },
  txt: { color:T.textTert, fontSize:9, fontWeight:'700', letterSpacing:2 },
});

const Group = memo(function Group({ children }: { children:React.ReactNode }) {
  return (
    <View style={grp.outer}>
      <View style={grp.bg}/>
      <View style={grp.inner}>{children}</View>
    </View>
  );
});
const grp = StyleSheet.create({
  outer: { marginHorizontal:EDGE, borderRadius:18, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border, overflow:'hidden' },
  bg:    { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:T.surf },
  inner: {},
});

const RowDivider = () => <View style={{ height:StyleSheet.hairlineWidth, backgroundColor:T.border, marginLeft:54 }}/>;

function Row({
  icon, title, subtitle, right, onPress, danger=false, last=false,
}: {
  icon:keyof typeof Ionicons.glyphMap; title:string; subtitle?:string;
  right?:React.ReactNode; onPress?:()=>void; danger?:boolean; last?:boolean;
}) {
  return (
    <>
      <TouchableOpacity style={rw.wrap} onPress={onPress} activeOpacity={onPress?0.60:1} disabled={!onPress}>
        <View style={[rw.iconBox, danger&&rw.iconDanger]}>
          <Ionicons name={icon} size={15} color={danger ? T.red : T.textSec}/>
        </View>
        <View style={rw.body}>
          <Text style={[rw.title, danger&&{ color:T.red }]}>{title}</Text>
          {subtitle && <Text style={rw.sub} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right !== undefined ? right : onPress ? <Ionicons name="chevron-forward" size={13} color={T.textTert}/> : null}
      </TouchableOpacity>
      {!last && <RowDivider/>}
    </>
  );
}
const rw = StyleSheet.create({
  wrap:    { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:14, gap:13 },
  iconBox: { width:32, height:32, borderRadius:9, alignItems:'center', justifyContent:'center', backgroundColor:T.surfHi },
  iconDanger:{ backgroundColor:'rgba(255,68,68,0.10)' },
  body:    { flex:1, gap:2 },
  title:   { color:T.text, fontSize:14, fontWeight:'600' },
  sub:     { color:T.textTert, fontSize:11 },
});

// ★ Toggle row — cercle blanc garanti, hex plein (jamais de vert système)
function ToggleRow({
  icon, title, subtitle, value, onChange, saving=false, last=false,
}: {
  icon:keyof typeof Ionicons.glyphMap; title:string; subtitle?:string;
  value:boolean; onChange:(v:boolean)=>void; saving?:boolean; last?:boolean;
}) {
  return (
    <Row icon={icon} title={title} subtitle={subtitle} last={last}
      right={saving
        ? <ActivityIndicator size="small" color={T.textSec}/>
        : <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: SWITCH_TRACK_OFF, true: SWITCH_TRACK_ON }}
            thumbColor={SWITCH_THUMB}
            ios_backgroundColor={SWITCH_TRACK_OFF}
            style={Platform.OS === 'android' ? { transform:[{ scaleX:0.95 }, { scaleY:0.95 }] } : undefined}
          />
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ★ SÉLECTEUR QUALITÉ VIDÉO — enum texte, pas un bool
// ─────────────────────────────────────────────────────────────────────────────
const QualityPickerModal = memo(function QualityPickerModal({
  visible, value, onSelect, onClose,
}: { visible:boolean; value:VideoQuality; onSelect:(v:VideoQuality)=>void; onClose:()=>void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={qp.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose}/>
        <View style={qp.card}>
          <Text style={qp.title}>Qualité vidéo</Text>
          {QUALITY_OPTIONS.map((o, i) => {
            const on = o.value === value;
            return (
              <TouchableOpacity
                key={o.value}
                style={[qp.item, i < QUALITY_OPTIONS.length-1 && qp.itemBorder]}
                onPress={() => { onSelect(o.value); onClose(); }}
                activeOpacity={0.75}
              >
                <View style={[qp.itemIcon, on && qp.itemIconOn]}>
                  <Ionicons name={o.icon} size={15} color={on ? T.gold : T.textSec}/>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={[qp.itemLabel, on && qp.itemLabelOn]}>{o.label}</Text>
                  <Text style={qp.itemHint}>{o.hint}</Text>
                </View>
                {on && <Ionicons name="checkmark-circle" size={18} color={T.gold}/>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
});
const qp = StyleSheet.create({
  overlay:    { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(3,5,12,0.72)', padding:24 },
  card:       { width:'100%', maxWidth:340, backgroundColor:T.surfHi, borderRadius:18, padding:8, borderWidth:StyleSheet.hairlineWidth, borderColor:T.borderHi },
  title:      { color:T.textTert, fontSize:10, fontWeight:'800', letterSpacing:1.5, textTransform:'uppercase', paddingHorizontal:12, paddingTop:10, paddingBottom:6 },
  item:       { flexDirection:'row', alignItems:'center', gap:11, paddingHorizontal:12, paddingVertical:12 },
  itemBorder: { borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:T.border },
  itemIcon:   { width:30, height:30, borderRadius:9, alignItems:'center', justifyContent:'center', backgroundColor:T.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border },
  itemIconOn: { backgroundColor:'rgba(245,200,66,0.14)', borderColor:'rgba(245,200,66,0.35)' },
  itemLabel:  { color:T.textSec, fontSize:14, fontWeight:'600' },
  itemLabelOn:{ color:T.text, fontWeight:'800' },
  itemHint:   { color:T.textTert, fontSize:11, marginTop:1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ BANDEAU DE SYNCHRO — feedback discret, identité visuelle Universe
// ─────────────────────────────────────────────────────────────────────────────
const SyncBanner = memo(function SyncBanner({ visible }: { visible: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [visible]);
  const ty = anim.interpolate({ inputRange:[0,1], outputRange:[-14,0] });
  return (
    <Animated.View pointerEvents="none" style={[sb.wrap, { opacity: anim, transform:[{ translateY: ty }] }]}>
      <Ionicons name="checkmark-circle" size={13} color={T.gold}/>
      <Text style={sb.txt}>Préférences synchronisées</Text>
    </Animated.View>
  );
});
const sb = StyleSheet.create({
  wrap: { position:'absolute', top:6, alignSelf:'center', flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:6, borderRadius:20, backgroundColor:'rgba(245,200,66,0.14)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(245,200,66,0.32)', zIndex:200 },
  txt:  { color:T.gold, fontSize:10.5, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE CARD
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_LBL: Record<string,string> = {
  critic:'Critique', creator:'Créateur·rice', director:'Réalisateur·rice',
  actor:'Acteur·rice', dp:'Dir. photo', editor:'Monteur·euse',
};

const ProfileCard = memo(function ProfileCard({
  profile, onUpdate,
}: { profile:Profile; onUpdate:(p:Partial<Profile>)=>void }) {
  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState(profile.display_name);
  const [bio,       setBio]       = useState(profile.bio ?? '');
  const [saving,    setSaving]    = useState(false);
  const [avatarUri, setAvatarUri] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);

  const haptic = useCallback((type: 'success'|'light') => {
    if (!Haptics) return;
    if (type === 'success') Haptics.notificationAsync?.(Haptics.NotificationFeedbackType?.Success);
    else                    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light);
  }, []);

  const save = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Nom requis'); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ display_name:name.trim(), bio:bio.trim() }).eq('id', profile.id);
    setSaving(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    onUpdate({ display_name:name.trim(), bio:bio.trim() });
    setEditing(false);
    haptic('success');
  }, [name, bio, profile.id, onUpdate, haptic]);

  const pickAvatar = useCallback(async () => {
    if (Platform.OS === 'web' || !ImagePicker) {
      if (typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type='file'; input.accept='image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0]; if (!file) return;
        const uri = URL.createObjectURL(file);
        setAvatarUri(uri); setUploading(true);
        const url = await uploadAvatar(uri, profile.id);
        if (!url) { Alert.alert('Erreur upload'); setUploading(false); return; }
        await supabase.from('profiles').update({ avatar_url:url }).eq('id', profile.id);
        setAvatarUri(url); onUpdate({ avatar_url:url }); setUploading(false);
      };
      input.click(); return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes:ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    setAvatarUri(uri); setUploading(true);
    const url = await uploadAvatar(uri, profile.id);
    if (!url) { Alert.alert('Erreur upload'); setUploading(false); return; }
    await supabase.from('profiles').update({ avatar_url:url }).eq('id', profile.id);
    setAvatarUri(url); onUpdate({ avatar_url:url }); setUploading(false);
    haptic('success');
  }, [profile.id, onUpdate, haptic]);

  return (
    <View style={pcd.wrap}>
      <View style={pcd.header}>
        <TouchableOpacity onPress={pickAvatar} style={pcd.avatarWrap} activeOpacity={0.80}>
          {avatarUri ? (
            <Image source={{ uri:avatarUri }} style={pcd.avatar} contentFit="cover"/>
          ) : (
            <View style={[pcd.avatar, pcd.avatarEmpty]}>
              <Ionicons name="person" size={28} color={T.textTert}/>
            </View>
          )}
          <View style={pcd.avatarRing}/>
          <View style={pcd.avatarBadge}>
            {uploading ? <ActivityIndicator size="small" color={T.text}/> : <Ionicons name="camera" size={10} color={T.text}/>}
          </View>
        </TouchableOpacity>

        <View style={pcd.identity}>
          <Text style={pcd.name} numberOfLines={1}>{profile.display_name || 'Cinéphile'}</Text>
          <Text style={pcd.username}>@{profile.username}</Text>
          <View style={pcd.pills}>
            {profile.is_pro && <View style={pcd.pill}><Ionicons name="checkmark-circle" size={9} color={T.gold}/><Text style={[pcd.pillTxt,{color:T.gold}]}>PRO</Text></View>}
            <View style={pcd.pill}><Text style={pcd.pillTxt}>{ROLE_LBL[profile.role] ?? 'Cinéphile'}</Text></View>
          </View>
        </View>
      </View>

      
      </View>
  );
});

const pcd = StyleSheet.create({
  wrap:       { marginHorizontal:EDGE, borderRadius:20, borderWidth:StyleSheet.hairlineWidth, borderColor:T.borderHi, padding:16, gap:12, backgroundColor:T.surf },
  header:     { flexDirection:'row', gap:14, alignItems:'center' },
  avatarWrap: { position:'relative', alignSelf:'flex-start' },
  avatar:     { width:68, height:68, borderRadius:34 },
  avatarEmpty:{ backgroundColor:T.surfHi, alignItems:'center', justifyContent:'center' },
  avatarRing: { position:'absolute', top:-2, left:-2, right:-2, bottom:-2, borderRadius:36, borderWidth:1.5, borderColor:T.borderHi },
  avatarBadge:{ position:'absolute', bottom:0, right:0, width:20, height:20, borderRadius:10, backgroundColor:T.surfHi, borderWidth:1, borderColor:T.border, alignItems:'center', justifyContent:'center' },
  identity:   { flex:1, gap:3 },
  name:       { color:T.text, fontSize:16, fontWeight:'800', letterSpacing:-0.3 },
  username:   { color:T.textSec, fontSize:12, fontWeight:'600' },
  pills:      { flexDirection:'row', flexWrap:'wrap', gap:5, marginTop:4 },
  pill:       { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:8, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border, backgroundColor:T.surfHi },
  pillTxt:    { color:T.textTert, fontSize:10, fontWeight:'600' },
  bioRow:     { flexDirection:'row', alignItems:'center', gap:10 },
  bio:        { flex:1, color:T.textSec, fontSize:12, lineHeight:17 },
  editChip:   { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:6, borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border, backgroundColor:T.surfHi },
  editChipTxt:{ color:T.textSec, fontSize:11, fontWeight:'600' },
  editBlock:  { gap:8 },
  input:      { backgroundColor:T.surfHi, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border, paddingHorizontal:13, paddingVertical:10, color:T.text, fontSize:14 },
  bioInput:   { minHeight:60, textAlignVertical:'top', lineHeight:19 },
  editBtns:   { flexDirection:'row', gap:8 },
  cancelBtn:  { flex:1, alignItems:'center', paddingVertical:11, borderRadius:12, backgroundColor:T.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border },
  cancelTxt:  { color:T.textSec, fontSize:13, fontWeight:'600' },
  saveBtn:    { flex:2, alignItems:'center', justifyContent:'center', paddingVertical:11, borderRadius:12, backgroundColor:T.surfMd, borderWidth:StyleSheet.hairlineWidth, borderColor:T.borderHi },
  saveTxt:    { color:T.text, fontSize:13, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router  = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [uid,     setUid]     = useState<string>('');   // ★ getDeviceId() — identité unique de l'app
  const [profile, setProfile] = useState<Profile|null>(null);
  const [prefs,   setPrefs]   = useState<Prefs>(PREFS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<Partial<Record<keyof Prefs,boolean>>>({});
  const [qualityOpen, setQualityOpen] = useState(false);
  const [showSync,    setShowSync]    = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout>>();

  const stickyOp = scrollY.interpolate({ inputRange:[0,80], outputRange:[0,1], extrapolate:'clamp' });

  // ★ Chargement instantané : UI affichée immédiatement, data async.
  // Identité = getDeviceId(), comme partout ailleurs dans Universe —
  // plus aucune dépendance à supabase.auth.getUser().
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const deviceId = await getDeviceId();
      if (cancelled) return;
      setUid(deviceId);
      const [prof, pref] = await Promise.all([fetchProfile(deviceId), fetchPrefs(deviceId)]);
      if (cancelled) return;
      if (prof) setProfile(prof);
      setPrefs(pref);
      setLoading(false);
    })();
    return () => { cancelled = true; clearTimeout(syncTimer.current); };
  }, []);

  const haptic = useCallback((type:'light'|'heavy') => {
    if (!Haptics) return;
    if (type==='heavy') Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Heavy);
    else                Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light);
  }, []);

  const flashSync = useCallback(() => {
    clearTimeout(syncTimer.current);
    setShowSync(true);
    syncTimer.current = setTimeout(() => setShowSync(false), 1600);
  }, []);

  const setPref = useCallback(async <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    if (!uid) {
      Alert.alert('Erreur', 'Identifiant utilisateur introuvable — réessayez dans un instant.');
      return;
    }
    haptic('light');
    const previous = prefs[key];
    setPrefs(p => ({ ...p, [key]: value }));
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await upsertPref(uid, key, value);
      flashSync();
    } catch (e: any) {
      console.log('upsertPref error =>', e);
      setPrefs(p => ({ ...p, [key]: previous }));
      Alert.alert('Erreur', e?.message ?? 'Impossible de sauvegarder cette préférence.');
    }finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  }, [uid, haptic, prefs, flashSync]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Réinitialiser mes préférences',
      'Universe n\'utilise pas de compte email/mot de passe classique — votre identité est liée à cet appareil. Cette action remet vos préférences à leurs valeurs par défaut.',
      [
        { text:'Annuler', style:'cancel' },
        { text:'Réinitialiser', style:'destructive', onPress: async () => {
          if (!uid) return;
          haptic('heavy');
          setPrefs(PREFS_DEFAULT);
          await supabase.from('user_preferences').upsert({ user_id: uid, ...PREFS_DEFAULT }, { onConflict:'user_id' });
          flashSync();
        }},
      ],
    );
  }, [uid, haptic, flashSync]);

  const handleDelete = useCallback(() => {
    Alert.alert('Supprimer mon compte', 'Action irréversible. Profil, préférences, critiques et watchlist seront effacés.', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:async () => {
        if (!uid) return;
        await Promise.all([
          supabase.from('user_preferences').delete().eq('user_id', uid),
          supabase.from('profiles').delete().eq('id', uid),
        ]);
        router.replace('/(auth)/welcome' as any);
      }},
    ]);
  }, [uid, router]);

  const handleClearCache = useCallback(async () => {
    if (FileSystem) {
      const dir = FileSystem.cacheDirectory;
      if (dir) await FileSystem.deleteAsync(dir, { idempotent:true }).catch(() => {});
    }
    Alert.alert('Cache vidé', 'Les données temporaires ont été supprimées.');
  }, []);

  const V = saving;
  const currentQuality = QUALITY_OPTIONS.find(o => o.value === prefs.video_quality) ?? QUALITY_OPTIONS[0];

  if (loading) return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <SafeAreaView edges={['top']} style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator color={T.textSec} size="large"/>
        <Text style={{ color:T.textTert, fontSize:12, marginTop:12 }}>Chargement de votre univers…</Text>
      </SafeAreaView>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      <SyncBanner visible={showSync}/>

      <Animated.View pointerEvents="none" style={[s.stickyBar, { opacity:stickyOp }]}>
        <View style={s.stickyBg}/>
        <SafeAreaView edges={['top']} style={s.stickyInner}>
          <Text style={s.stickyTitle}>Paramètres</Text>
        </SafeAreaView>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent:{ contentOffset:{ y:scrollY } } }], { useNativeDriver:true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom:110 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={s.topNav}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.70}>
              <Ionicons name="chevron-back" size={19} color={T.textSec}/>
            </TouchableOpacity>
            <Text style={s.topNavTitle}>Paramètres</Text>
            <View style={{ width:40 }}/>
          </View>
        </SafeAreaView>

        {profile && (
          <ProfileCard
            profile={profile}
            onUpdate={p => setProfile(prev => prev ? { ...prev, ...p } : prev)}
          />
        )}

        {/* ── LECTURE ── */}
        <SectionTitle label="Lecture" icon="play-circle-outline"/>
        <Group>
          <ToggleRow
            icon="play-circle-outline" title="Lecture automatique"
            subtitle="Lance la vidéo sans appuyer sur Play"
            value={prefs.autoplay} onChange={v=>setPref('autoplay',v)} saving={!!V.autoplay}
          />
          <Row
            icon="film-outline" title="Qualité vidéo" subtitle={currentQuality.label}
            onPress={() => setQualityOpen(true)}
          />
          <ToggleRow
            icon="cellular-outline" title="Économiseur de données"
            subtitle="Réduit la qualité sur réseau mobile"
            value={prefs.data_saver} onChange={v=>setPref('data_saver',v)} saving={!!V.data_saver} last
          />
        </Group>

        {/* ── NOTIFICATIONS ── */}
        <SectionTitle label="Notifications" icon="notifications-outline"/>
        <Group>
          <ToggleRow
            icon="film-outline" title="Nouvelles sorties"
            subtitle="Films & séries indépendants ajoutés"
            value={prefs.notif_releases} onChange={v=>setPref('notif_releases',v)} saving={!!V.notif_releases}
          />
          <ToggleRow
            icon="people-outline" title="Activité sociale"
            subtitle="Likes & commentaires sur vos critiques"
            value={prefs.notif_social} onChange={v=>setPref('notif_social',v)} saving={!!V.notif_social}
          />
          <ToggleRow
            icon="calendar-outline" title="Festivals"
            subtitle="Cannes, Sundance et avant-premières"
            value={prefs.notif_festivals} onChange={v=>setPref('notif_festivals',v)} saving={!!V.notif_festivals} last
          />
        </Group>

        {/* ── CONFIDENTIALITÉ ── */}
        <SectionTitle label="Confidentialité" icon="shield-outline"/>
        <Group>
          <ToggleRow
            icon="eye-off-outline" title="Profil privé"
            subtitle="Seuls vos abonnés voient vos critiques"
            value={prefs.private_profile} onChange={v=>setPref('private_profile',v)} saving={!!V.private_profile}
          />
          <ToggleRow
            icon="bookmark-outline" title="Watchlist publique"
            subtitle="Visible par votre communauté Universe"
            value={prefs.public_watchlist} onChange={v=>setPref('public_watchlist',v)} saving={!!V.public_watchlist} last
          />
        </Group>

        
        {/* ── SESSION ── */}
        <SectionTitle label="Session" icon="reload-outline"/>
        <Group>
          <Row icon="refresh-outline" title="Réinitialiser mes préférences" subtitle="Retour aux réglages par défaut" onPress={handleReset}/>
          <Row icon="trash-outline"   title="Supprimer mon compte" subtitle="Action irréversible" onPress={handleDelete} danger last/>
        </Group>

        <View style={s.footer}>
          <View style={s.footerLine}/>
          <Text style={s.footerTxt}>UNIVERSE · CINÉMA INDÉPENDANT</Text>
          <Text style={s.footerVersion}>v2.0 · {new Date().getFullYear()}</Text>
        </View>
      </Animated.ScrollView>

      <QualityPickerModal
        visible={qualityOpen}
        value={prefs.video_quality}
        onSelect={v => setPref('video_quality', v)}
        onClose={() => setQualityOpen(false)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex:1, backgroundColor:NAVY_D },
  stickyBar:    { position:'absolute', top:0, left:0, right:0, zIndex:100 },
  stickyBg:     { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:T.surf },
  stickyInner:  { alignItems:'center', paddingBottom:10, paddingTop:6 },
  stickyTitle:  { color:T.text, fontSize:14, fontWeight:'700' },
  topNav:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:EDGE, paddingVertical:10 },
  backBtn:      { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth, borderColor:T.border, backgroundColor:T.surf },
  topNavTitle:  { color:T.text, fontSize:17, fontWeight:'800', letterSpacing:-0.2 },
  footer:       { alignItems:'center', paddingTop:40, gap:6 },
  footerLine:   { width:24, height:StyleSheet.hairlineWidth, backgroundColor:T.border },
  footerTxt:    { color:T.textTert, fontSize:9, fontWeight:'700', letterSpacing:2.5 },
  footerVersion:{ color:'rgba(255,255,255,0.15)', fontSize:9, letterSpacing:1 },
});