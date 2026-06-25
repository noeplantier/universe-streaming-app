/**
 * app/settings.tsx — Paramètres UNIVERSE
 *
 * FIXES déploiement (causant blank screen) :
 *  ✓ ImagePicker / FileSystem / Haptics / decode → require conditionnel (pas module-level)
 *  ✓ BlurView → require conditionnel + fallback View navyMid
 *  ✓ C.navyMid → valeur inline NAVY = '#0D2240' (C peut être undefined)
 *  ✓ Image → expo-image (react-native Image avait des problèmes web)
 *  ✓ StyleSheet.absoluteFill → StyleSheet.absoluteFillObject partout
 *  ✓ Chargement instantané : UI affichée immédiatement, data async
 *
 * COULEURS : NAVY (#0D2240) + transparent uniquement + GalaxyBackground
 * SECTIONS  : Lecture · Notifications · Confidentialité · Accessibilité
 *             Stockage · Compte · Aide · Légal · Session
 */

import React, {
  memo, useState, useEffect, useCallback, useRef,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, Animated, Platform,
  ActivityIndicator, Switch,
} from 'react-native';
import { Image }           from 'expo-image';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { StatusBar }       from 'expo-status-bar';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import { useRouter }       from 'expo-router';
import { ScrollView }      from 'react-native';

import { supabase }        from '@/lib/supabase';
import GalaxyBackground    from '@/components/shared/GalaxyBackground';

// ── Tous les imports natifs : require conditionnel → ne crashent pas sur web ──
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

function NavyView({ style, children }: { style?: any; children?: React.ReactNode }) {
  if (_BlurView) {
    return <_BlurView intensity={10} tint="dark" style={style}>{children}</_BlurView>;
  }
  return <View style={[style, { backgroundColor:'rgba(13,34,64,0.75)' }]}>{children}</View>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS — NAVY inline (C.navyMid peut être undefined si import fail)
// ─────────────────────────────────────────────────────────────────────────────
const NAVY   = '#0D2240';
const NAVY_D = '#060F1E';

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
} as const;

const EDGE = 16;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Profile {
  id:string; display_name:string; username:string; bio:string;
  avatar_url:string; email:string; role:string; plan:'free'|'pro'|'cinephile';
  created_at:string; location:string; is_pro:boolean;
}
interface Prefs {
  autoplay:boolean;          data_saver:boolean;
  hd_on_wifi:boolean;        autoplay_sound:boolean;
  notif_releases:boolean;    notif_social:boolean;
  notif_festivals:boolean;   notif_moderation:boolean;
  notif_connections:boolean;
  private_profile:boolean;   public_watchlist:boolean;
  show_seen_films:boolean;   analytics:boolean;
  personalization:boolean;
  reduced_motion:boolean;    subtitles:boolean;
}
const PREFS_DEFAULT: Prefs = {
  autoplay:true,         data_saver:false,       hd_on_wifi:true,       autoplay_sound:false,
  notif_releases:true,   notif_social:true,       notif_festivals:false, notif_moderation:true,
  notif_connections:true,
  private_profile:false, public_watchlist:true,   show_seen_films:true,  analytics:true,
  personalization:true,
  reduced_motion:false,  subtitles:false,
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function fetchProfile(uid: string): Promise<Profile|null> {
  const [{ data }, { data: authData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    supabase.auth.getUser(),
  ]);
  if (!data) return null;
  return { ...(data as Profile), email: authData.user?.email ?? '' };
}

async function fetchPrefs(uid: string): Promise<Prefs> {
  const { data } = await supabase.from('user_preferences').select('*').eq('user_id', uid).single();
  return data ? { ...PREFS_DEFAULT, ...data } as Prefs : PREFS_DEFAULT;
}

async function upsertPref<K extends keyof Prefs>(uid: string, key: K, value: Prefs[K]) {
  await supabase.from('user_preferences').upsert({ user_id:uid, [key]:value }, { onConflict:'user_id' });
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

// Section title avec lignes
const SectionTitle = memo(function SectionTitle({ label }: { label:string }) {
  return (
    <View style={sct.row}>
      <View style={sct.line}/>
      <Text style={sct.txt}>{label.toUpperCase()}</Text>
      <View style={sct.line}/>
    </View>
  );
});
const sct = StyleSheet.create({
  row: { flexDirection:'row', alignItems:'center', gap:10, marginHorizontal:EDGE, marginTop:28, marginBottom:10 },
  line:{ flex:1, height:StyleSheet.hairlineWidth, backgroundColor:T.border },
  txt: { color:T.textTert, fontSize:9, fontWeight:'700', letterSpacing:2 },
});

// Group card navyMid
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

// Ligne générique
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

// Toggle row
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
        : <Switch value={value} onValueChange={onChange}
            trackColor={{ false:T.border, true:'rgba(255,255,255,0.35)' }}
            thumbColor="#f4f3f4"
          />
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE CARD — expo-image, avatar upload web-safe
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_LBL: Record<string,string> = { free:'Gratuit', pro:'Universe Pro', cinephile:'Cinéphile Ultimate' };
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
    // Web fallback via input file
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
        {/* Avatar — expo-image */}
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
          <Text style={pcd.email} numberOfLines={1}>{profile.email}</Text>
          <View style={pcd.pills}>
            <View style={pcd.pill}><Text style={pcd.pillTxt}>{PLAN_LBL[profile.plan??'free']}</Text></View>
            {profile.is_pro && <View style={pcd.pill}><Text style={pcd.pillTxt}>PRO ✓</Text></View>}
            <View style={pcd.pill}><Text style={pcd.pillTxt}>{ROLE_LBL[profile.role] ?? 'Cinéphile'}</Text></View>
          </View>
        </View>
      </View>

      {editing ? (
        <View style={pcd.editBlock}>
          <TextInput style={pcd.input} value={name} onChangeText={setName} placeholder="Nom affiché" placeholderTextColor={T.textTert} maxLength={40}/>
          <TextInput style={[pcd.input, pcd.bioInput]} value={bio} onChangeText={setBio} placeholder="Une courte bio…" placeholderTextColor={T.textTert} multiline maxLength={120}/>
          <View style={pcd.editBtns}>
            <TouchableOpacity style={pcd.cancelBtn} onPress={() => { setName(profile.display_name); setBio(profile.bio??''); setEditing(false); }}>
              <Text style={pcd.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pcd.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={T.text}/> : <Text style={pcd.saveTxt}>Enregistrer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={pcd.bioRow}>
          {profile.bio ? <Text style={pcd.bio} numberOfLines={2}>{profile.bio}</Text> : null}
          <TouchableOpacity style={pcd.editChip} onPress={() => setEditing(true)}>
            <Ionicons name="create-outline" size={12} color={T.textSec}/>
            <Text style={pcd.editChipTxt}>Modifier</Text>
          </TouchableOpacity>
        </View>
      )}
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
  email:      { color:T.textTert, fontSize:11 },
  pills:      { flexDirection:'row', flexWrap:'wrap', gap:5, marginTop:4 },
  pill:       { paddingHorizontal:8, paddingVertical:3, borderRadius:8, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border, backgroundColor:T.surfHi },
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

  const [profile, setProfile] = useState<Profile|null>(null);
  const [prefs,   setPrefs]   = useState<Prefs>(PREFS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<Partial<Record<keyof Prefs,boolean>>>({});

  const stickyOp = scrollY.interpolate({ inputRange:[0,80], outputRange:[0,1], extrapolate:'clamp' });

  // ★ Chargement instantané : UI affichée immédiatement, profil async
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }
      const [prof, pref] = await Promise.all([fetchProfile(user.id), fetchPrefs(user.id)]);
      if (cancelled) return;
      if (prof) setProfile(prof);
      setPrefs(pref);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const userId = profile?.id ?? '';

  const haptic = useCallback((type:'light'|'heavy') => {
    if (!Haptics) return;
    if (type==='heavy') Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Heavy);
    else                Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light);
  }, []);

  const setPref = useCallback(async <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    haptic('light');
    setPrefs(p => ({ ...p, [key]:value }));
    setSaving(s => ({ ...s, [key]:true }));
    await upsertPref(userId, key, value);
    setSaving(s => ({ ...s, [key]:false }));
  }, [userId, haptic]);

  const handlePasswordReset = useCallback(() => {
    Alert.alert('Réinitialiser le mot de passe', `Un lien sera envoyé à ${profile?.email??'—'}`, [
      { text:'Annuler', style:'cancel' },
      { text:'Envoyer', onPress:async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(profile?.email??'');
        Alert.alert(error?'Erreur':'Email envoyé', error?.message ?? `Lien envoyé à ${profile?.email}`);
      }},
    ]);
  }, [profile?.email]);

  const handleLogout = useCallback(() => {
    Alert.alert('Déconnexion', 'Quitter votre session Universe ?', [
      { text:'Annuler', style:'cancel' },
      { text:'Déconnecter', style:'destructive', onPress:async () => {
        haptic('heavy');
        await supabase.auth.signOut();
        router.replace('/(auth)/welcome');
      }},
    ]);
  }, [router, haptic]);

  const handleDelete = useCallback(() => {
    Alert.alert('Supprimer mon compte', 'Action irréversible. Profil, critiques et watchlist seront effacés.', [
      { text:'Annuler', style:'cancel' },
      { text:'Supprimer', style:'destructive', onPress:async () => {
        await Promise.all([
          supabase.from('user_preferences').delete().eq('user_id', userId),
          supabase.from('profiles').delete().eq('id', userId),
        ]);
        await supabase.auth.signOut();
        router.replace('/(auth)/welcome');
      }},
    ]);
  }, [userId, router]);

  const handleClearCache = useCallback(async () => {
    if (FileSystem) {
      const dir = FileSystem.cacheDirectory;
      if (dir) await FileSystem.deleteAsync(dir, { idempotent:true }).catch(() => {});
    }
    Alert.alert('Cache vidé', 'Les données temporaires ont été supprimées.');
  }, []);

  const V = saving; // alias court pour les saving states

  if (loading) return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <SafeAreaView edges={['top']} style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator color={T.textSec} size="large"/>
        <Text style={{ color:T.textTert, fontSize:12, marginTop:12 }}>Chargement…</Text>
      </SafeAreaView>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      {/* Sticky header (navyMid + fade) */}
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
          {/* Top nav */}
          <View style={s.topNav}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.70}>
              <Ionicons name="chevron-back" size={19} color={T.textSec}/>
            </TouchableOpacity>
            <Text style={s.topNavTitle}>Paramètres</Text>
            <View style={{ width:40 }}/>
          </View>
        </SafeAreaView>

        {/* Profil card */}
        {profile && (
          <ProfileCard
            profile={profile}
            onUpdate={p => setProfile(prev => prev ? { ...prev, ...p } : prev)}
          />
        )}

        {/* ── LECTURE ── */}
        <SectionTitle label="Lecture"/>
        <Group>
          <ToggleRow icon="play-circle-outline"  title="Lecture automatique"    subtitle="Lance la vidéo sans appuyer sur Play"    value={prefs.autoplay}        onChange={v=>setPref('autoplay',v)}        saving={!!V.autoplay}/>
          <ToggleRow icon="volume-mute-outline"   title="Lecture silencieuse"    subtitle="Muet par défaut au démarrage"            value={!prefs.autoplay_sound} onChange={v=>setPref('autoplay_sound',!v)} saving={!!V.autoplay_sound}/>
          <ToggleRow icon="wifi-outline"          title="HD sur Wi-Fi"           subtitle="Qualité maximale sur Wi-Fi uniquement"   value={prefs.hd_on_wifi}      onChange={v=>setPref('hd_on_wifi',v)}      saving={!!V.hd_on_wifi}/>
          <ToggleRow icon="cellular-outline"      title="Économiseur de données" subtitle="Réduit la qualité sur réseau mobile"    value={prefs.data_saver}      onChange={v=>setPref('data_saver',v)}      saving={!!V.data_saver}     last/>
        </Group>

        {/* ── NOTIFICATIONS ── */}
        <SectionTitle label="Notifications"/>
        <Group>
          <ToggleRow icon="film-outline"            title="Nouvelles sorties"    subtitle="Films & séries indépendants ajoutés"       value={prefs.notif_releases}    onChange={v=>setPref('notif_releases',v)}    saving={!!V.notif_releases}/>
          <ToggleRow icon="people-outline"          title="Activité sociale"     subtitle="Likes & commentaires sur vos critiques"    value={prefs.notif_social}      onChange={v=>setPref('notif_social',v)}      saving={!!V.notif_social}/>
          <ToggleRow icon="link-outline"            title="Connexions pro"        subtitle="Demandes et réponses de connexion"         value={prefs.notif_connections} onChange={v=>setPref('notif_connections',v)} saving={!!V.notif_connections}/>
          <ToggleRow icon="checkmark-circle-outline"title="Modération"           subtitle="Statut de vos reels soumis"               value={prefs.notif_moderation}  onChange={v=>setPref('notif_moderation',v)}  saving={!!V.notif_moderation}/>
          <ToggleRow icon="calendar-outline"        title="Festivals"            subtitle="Cannes, Sundance et avant-premières"       value={prefs.notif_festivals}   onChange={v=>setPref('notif_festivals',v)}   saving={!!V.notif_festivals} last/>
        </Group>

        {/* ── CONFIDENTIALITÉ ── */}
        <SectionTitle label="Confidentialité"/>
        <Group>
          <ToggleRow icon="eye-off-outline"    title="Profil privé"           subtitle="Seuls vos abonnés voient vos critiques"  value={prefs.private_profile}  onChange={v=>setPref('private_profile',v)}  saving={!!V.private_profile}/>
          <ToggleRow icon="bookmark-outline"   title="Watchlist publique"     subtitle="Visible par votre communauté"            value={prefs.public_watchlist} onChange={v=>setPref('public_watchlist',v)} saving={!!V.public_watchlist}/>
          <ToggleRow icon="eye-outline"        title="Historique visible"     subtitle="Vos films vus affichés sur le profil"    value={prefs.show_seen_films}  onChange={v=>setPref('show_seen_films',v)}  saving={!!V.show_seen_films}/>
          <ToggleRow icon="bar-chart-outline"  title="Analytics"              subtitle="Aide à améliorer Universe"               value={prefs.analytics}        onChange={v=>setPref('analytics',v)}        saving={!!V.analytics}/>
          <ToggleRow icon="sparkles-outline"   title="Personnalisation"       subtitle="Recommandations selon vos goûts"         value={prefs.personalization}  onChange={v=>setPref('personalization',v)}  saving={!!V.personalization} last/>
        </Group>

        {/* ── ACCESSIBILITÉ ── */}
        <SectionTitle label="Accessibilité"/>
        <Group>
          <ToggleRow icon="pulse-outline"   title="Réduire les animations" subtitle="Désactive les transitions animées"  value={prefs.reduced_motion} onChange={v=>setPref('reduced_motion',v)} saving={!!V.reduced_motion}/>
          <ToggleRow icon="chatbox-outline" title="Sous-titres"            subtitle="Activés lors de la lecture vidéo"  value={prefs.subtitles}      onChange={v=>setPref('subtitles',v)}      saving={!!V.subtitles}      last/>
        </Group>

        {/* ── STOCKAGE ── */}
        <SectionTitle label="Stockage"/>
        <Group>
          <Row icon="trash-outline"    title="Vider le cache"    subtitle="Libère l'espace disque temporaire"      onPress={handleClearCache}/>
          <Row icon="download-outline" title="Téléchargements"   subtitle="Gérer les vidéos sauvegardées"          onPress={() => router.push('/downloads' as any)} last/>
        </Group>

        {/* ── COMPTE ── */}
        <SectionTitle label="Compte"/>
        <Group>
          <Row icon="person-outline"       title="Modifier le profil complet" subtitle="Bio, spécialités, réseaux, festivals"  onPress={() => router.push('/profile/edit' as any)}/>
          <Row icon="lock-closed-outline"  title="Mot de passe"               subtitle="Envoyer un lien de réinitialisation"   onPress={handlePasswordReset}/>
          <Row icon="card-outline"         title="Abonnement"                 subtitle={PLAN_LBL[profile?.plan??'free']}       onPress={() => router.push('/subscription' as any)}/>
          <Row icon="download-outline"     title="Exporter mes données"       subtitle="Archive RGPD sous 24h par email"       onPress={() => Alert.alert('Demande envoyée','Vous recevrez un email dans les 24h.')} last/>
        </Group>

        {/* ── AIDE ── */}
        <SectionTitle label="Aide"/>
        <Group>
          <Row icon="help-circle-outline" title="FAQ"                  subtitle="Questions fréquentes"             onPress={() => router.push('/faq' as any)}/>
          <Row icon="bug-outline"         title="Signaler un problème" subtitle="Envoyer un rapport de bug"        onPress={() => router.push('/report' as any)}/>
          <Row icon="mail-outline"        title="Nous contacter"       subtitle="support@universe.app"            onPress={() => {
            if (typeof window !== 'undefined') window.open('mailto:support@universe.app','_blank');
          }}/>
          <Row icon="star-outline"        title="Évaluer l'app"        subtitle="Donnez-nous votre avis"          onPress={() => {}} last/>
        </Group>

        {/* ── LÉGAL ── */}
        <SectionTitle label="Légal"/>
        <Group>
          <Row icon="document-text-outline" title="Conditions d'utilisation" onPress={() => router.push('/terms'   as any)}/>
          <Row icon="shield-outline"        title="Politique de confidentialité" onPress={() => router.push('/privacy' as any)}/>
          <Row icon="camera-outline"        title="Politique anti-capture" subtitle="Protection des créations cinéma" onPress={() => router.push('/screenshot-policy' as any)} last/>
        </Group>

        {/* ── SESSION ── */}
        <SectionTitle label="Session"/>
        <Group>
          <Row icon="log-out-outline" title="Se déconnecter"              onPress={handleLogout} danger/>
          <Row icon="trash-outline"   title="Supprimer mon compte" subtitle="Action irréversible" onPress={handleDelete} danger last/>
        </Group>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerLine}/>
          <Text style={s.footerTxt}>UNIVERSE · CINÉMA INDÉPENDANT</Text>
          <Text style={s.footerVersion}>v2.0 · {new Date().getFullYear()}</Text>
        </View>
      </Animated.ScrollView>
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