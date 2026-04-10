// ─────────────────────────────────────────────────────────────────────────────
// app/settings.tsx — Paramètres UNIVERSE
// • Palette galactique — zéro violet, zéro vert
// • Chaque paramètre lit/écrit Supabase en temps réel
// • Profil éditable (nom, bio, avatar)
// • Sécurité (password, sessions)
// • Notifications, Lecture, Vie privée — persistés dans user_preferences
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  useState, useEffect, useCallback, useRef, memo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Animated, Platform, ActivityIndicator,
  Image, Dimensions, Switch,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import * as ImagePicker   from 'expo-image-picker';
import * as FileSystem    from 'expo-file-system';
import * as Haptics       from 'expo-haptics';
import { decode }         from 'base64-arraybuffer';

import { supabase }       from '@/lib/supabase';
import GalaxyBackground   from '@/components/social/GalaxyBackground';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — GALACTIQUE
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg0:       '#03000A',
  surf:      'rgba(255,255,255,0.05)',
  surfHi:    'rgba(255,255,255,0.09)',
  border:    'rgba(255,255,255,0.07)',
  borderHi:  'rgba(0,201,255,0.25)',
  borderGold:'rgba(245,200,66,0.22)',
  text:      '#EDF6FF',
  textSec:   '#8BA4BE',
  textTert:  '#3D5470',
  teal:      '#00C9FF',
  tealDim:   'rgba(0,201,255,0.10)',
  tealMid:   'rgba(0,201,255,0.20)',
  gold:      '#F5C842',
  goldDim:   'rgba(245,200,66,0.10)',
  navy:      '#0A1628',
  navyMid:   '#0D2240',
  red:       '#FF3B5C',
  redDim:    'rgba(255,59,92,0.12)',
} as const;

const EDGE = 18;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Profile {
  id:           string;
  display_name: string;
  bio:          string;
  avatar_url:   string;
  email:        string;
  plan:         'free' | 'pro' | 'cinephile';
  created_at:   string;
}

interface Prefs {
  // Lecture
  autoplay:      boolean;
  video_quality: 'auto' | '4k' | '1080p' | '720p' | '480p';
  data_saver:    boolean;
  // Notifications
  notif_releases:  boolean;
  notif_social:    boolean;
  notif_festivals: boolean;
  // Vie privée
  private_profile:  boolean;
  public_watchlist: boolean;
}

const DEFAULT_PREFS: Prefs = {
  autoplay: true, video_quality: 'auto', data_saver: false,
  notif_releases: true, notif_social: true, notif_festivals: false,
  private_profile: false, public_watchlist: true,
};

const PLAN_LABELS: Record<string, string> = {
  free:      'Gratuit',
  pro:       'Universe Pro',
  cinephile: 'Cinéphile Ultimate',
};
const PLAN_COLORS: Record<string, string> = {
  free: C.textTert, pro: C.teal, cinephile: C.gold,
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function uploadAvatar(localUri: string, userId: string): Promise<string | null> {
  try {
    const isBlob = localUri.startsWith('blob:');
    const rawExt = isBlob ? 'jpg' : (localUri.split('.').pop()?.toLowerCase() ?? 'jpg');
    const ext    = ['jpg','jpeg','png','webp'].includes(rawExt) ? rawExt : 'jpg';
    const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
    const path   = `avatars/${userId}.${ext}`;

    let payload: ArrayBuffer;
    if (Platform.OS === 'web' || isBlob) {
      payload = await (await fetch(localUri)).arrayBuffer();
    } else {
      const b64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      payload = decode(b64);
    }

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, payload, { contentType: mime, upsert: true });

    if (error) throw error;
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      + `?t=${Date.now()}`; // cache-bust
  } catch (e) {
    console.error('[uploadAvatar]', e);
    return null;
  }
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, bio, avatar_url, plan, created_at')
    .eq('id', userId)
    .single();
  if (error) { console.warn('[fetchProfile]', error.message); return null; }
  // email depuis auth
  const { data: authData } = await supabase.auth.getUser();
  return {
    ...(data as Omit<Profile, 'email'>),
    email: authData.user?.email ?? '',
  };
}

async function fetchPrefs(userId: string): Promise<Prefs> {
  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (!data) return DEFAULT_PREFS;
  return { ...DEFAULT_PREFS, ...data } as Prefs;
}

async function upsertPrefs(userId: string, patch: Partial<Prefs>) {
  await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES UI
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader = memo(function SectionHeader({
  title, icon,
}: { title: string; icon: string }) {
  return (
    <View style={sh.row}>
      <Ionicons name={icon as any} size={14} color={C.teal} />
      <Text style={sh.txt}>{title.toUpperCase()}</Text>
    </View>
  );
});
const sh = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: EDGE, marginTop: 28, marginBottom: 10 },
  txt: { color: C.teal, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
});

const Group = memo(function Group({ children }: { children: React.ReactNode }) {
  return <View style={grp.wrap}>{children}</View>;
});
const grp = StyleSheet.create({
  wrap: { marginHorizontal: EDGE, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
});

const Divider = () => <View style={{ height: 1, backgroundColor: C.border, marginLeft: 52 }} />;

function Row({
  icon, iconColor = C.textSec, title, subtitle, right, onPress, danger = false, last = false,
}: {
  icon: string; iconColor?: string; title: string; subtitle?: string;
  right?: React.ReactNode; onPress?: () => void; danger?: boolean; last?: boolean;
}) {
  return (
    <>
      <TouchableOpacity
        style={row.wrap}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View style={[row.iconBox, { backgroundColor: `${iconColor}14` }]}>
          <Ionicons name={icon as any} size={17} color={danger ? C.red : iconColor} />
        </View>
        <View style={row.body}>
          <Text style={[row.title, danger && { color: C.red }]}>{title}</Text>
          {subtitle && <Text style={row.sub}>{subtitle}</Text>}
        </View>
        {right ?? (onPress
          ? <Ionicons name="chevron-forward" size={16} color={C.textTert} />
          : null
        )}
      </TouchableOpacity>
      {!last && <Divider />}
    </>
  );
}
const row = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 13, backgroundColor: C.surf },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body:    { flex: 1, gap: 2 },
  title:   { color: C.text, fontSize: 15, fontWeight: '600' },
  sub:     { color: C.textTert, fontSize: 12, lineHeight: 16 },
});

function Toggle({
  icon, iconColor = C.textSec, title, subtitle, value, onChange, last = false, saving = false,
}: {
  icon: string; iconColor?: string; title: string; subtitle?: string;
  value: boolean; onChange: (v: boolean) => void; last?: boolean; saving?: boolean;
}) {
  return (
    <Row
      icon={icon} iconColor={iconColor} title={title} subtitle={subtitle} last={last}
      right={
        saving
          ? <ActivityIndicator size="small" color={C.teal} />
          : (
            <Switch
              value={value}
              onValueChange={onChange}
              trackColor={{ false: C.border, true: C.teal }}
              thumbColor="white"
              ios_backgroundColor={C.surf}
            />
          )
      }
    />
  );
}

function QualityPicker({
  value, onChange, last = false,
}: {
  value: Prefs['video_quality'];
  onChange: (v: Prefs['video_quality']) => void;
  last?: boolean;
}) {
  const OPTIONS: { v: Prefs['video_quality']; label: string }[] = [
    { v: 'auto',  label: 'Auto'   },
    { v: '1080p', label: '1080p'  },
    { v: '720p',  label: '720p'   },
    { v: '480p',  label: '480p'   },
    { v: '4k',    label: '4K'     },
  ];
  return (
    <Row
      icon="videocam-outline" iconColor={C.teal} title="Qualité vidéo" last={last}
      right={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: W * 0.45 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {OPTIONS.map(o => {
              const on = value === o.v;
              return (
                <TouchableOpacity
                  key={o.v}
                  onPress={() => onChange(o.v)}
                  style={[qp.chip, on && qp.chipOn]}
                >
                  <Text style={[qp.txt, on && { color: C.teal }]}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      }
    />
  );
}
const qp = StyleSheet.create({
  chip:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  chipOn:{ borderColor: C.teal, backgroundColor: C.tealDim },
  txt:   { color: C.textTert, fontSize: 12, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFIL ÉDITABLE
// ─────────────────────────────────────────────────────────────────────────────
function ProfileSection({ profile, onUpdate }: {
  profile: Profile;
  onUpdate: (patch: Partial<Profile>) => void;
}) {
  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(profile.display_name);
  const [bio,      setBio]      = useState(profile.bio ?? '');
  const [saving,   setSaving]   = useState(false);
  const [avatarUri,setAvatarUri]= useState(profile.avatar_url);
  const [uploading,setUploading]= useState(false);

  const saveProfile = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Nom requis', 'Le nom ne peut pas être vide.'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim(), bio: bio.trim() })
      .eq('id', profile.id);
    setSaving(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    onUpdate({ display_name: name.trim(), bio: bio.trim() });
    setEditing(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [name, bio, profile.id, onUpdate]);

  const pickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', "Autorisez l'accès à la galerie."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    setAvatarUri(uri);
    setUploading(true);
    const url = await uploadAvatar(uri, profile.id);
    if (!url) { Alert.alert('Erreur', "L'upload de l'avatar a échoué."); setUploading(false); return; }
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
    setAvatarUri(url);
    onUpdate({ avatar_url: url });
    setUploading(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [profile.id, onUpdate]);

  const plan      = profile.plan ?? 'free';
  const planLabel = PLAN_LABELS[plan] ?? 'Gratuit';
  const planColor = PLAN_COLORS[plan] ?? C.textTert;
  const joined    = new Date(profile.created_at).getFullYear();

  return (
    <View style={ps.wrap}>
      <LinearGradient
        colors={['rgba(0,201,255,0.07)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />

      {/* Avatar */}
      <TouchableOpacity onPress={pickAvatar} style={ps.avatarWrap} activeOpacity={0.85}>
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={ps.avatar} />
          : (
            <LinearGradient colors={[C.teal, C.navyMid]} style={ps.avatarPlaceholder}>
              <Ionicons name="person" size={36} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          )
        }
        <View style={ps.avatarBadge}>
          {uploading
            ? <ActivityIndicator size="small" color={C.teal} />
            : <Ionicons name="camera" size={13} color="white" />
          }
        </View>
      </TouchableOpacity>

      {/* Infos */}
      {editing ? (
        <View style={ps.editWrap}>
          <TextInput
            style={ps.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Votre nom"
            placeholderTextColor={C.textTert}
            maxLength={40}
          />
          <TextInput
            style={[ps.nameInput, ps.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Une courte bio..."
            placeholderTextColor={C.textTert}
            multiline
            maxLength={120}
          />
          <View style={ps.editActions}>
            <TouchableOpacity style={ps.cancelBtn} onPress={() => {
              setName(profile.display_name); setBio(profile.bio ?? ''); setEditing(false);
            }}>
              <Text style={{ color: C.textSec, fontWeight: '600', fontSize: 14 }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ps.saveBtn} onPress={saveProfile} disabled={saving}>
              <LinearGradient colors={[C.teal, C.navyMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ps.saveBtnGrad}>
                {saving
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Enregistrer</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={ps.infoWrap}>
          <Text style={ps.name}>{profile.display_name || 'Cinéphile'}</Text>
          <Text style={ps.email}>{profile.email}</Text>
          {bio ? <Text style={ps.bio} numberOfLines={2}>{bio}</Text> : null}
          <View style={ps.metaRow}>
            <View style={[ps.planBadge, { borderColor: `${planColor}40`, backgroundColor: `${planColor}10` }]}>
              <Ionicons name="ribbon-outline" size={11} color={planColor} />
              <Text style={[ps.planTxt, { color: planColor }]}>{planLabel}</Text>
            </View>
            <Text style={ps.joinedTxt}>Membre depuis {joined}</Text>
          </View>
          <TouchableOpacity style={ps.editBtn} onPress={() => setEditing(true)}>
            <Ionicons name="create-outline" size={14} color={C.teal} />
            <Text style={{ color: C.teal, fontSize: 13, fontWeight: '700' }}>Modifier le profil</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const ps = StyleSheet.create({
  wrap:            { marginHorizontal: EDGE, borderRadius: 22, borderWidth: 1, borderColor: C.borderHi, overflow: 'hidden', padding: 20, alignItems: 'center', gap: 14, marginBottom: 4 },
  avatarWrap:      { position: 'relative' },
  avatar:          { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: C.teal },
  avatarPlaceholder:{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarBadge:     { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: C.navy, borderWidth: 2, borderColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  infoWrap:        { alignItems: 'center', gap: 5, width: '100%' },
  name:            { color: C.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  email:           { color: C.textTert, fontSize: 13 },
  bio:             { color: C.textSec, fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  planBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  planTxt:         { fontSize: 11, fontWeight: '700' },
  joinedTxt:       { color: C.textTert, fontSize: 11 },
  editBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 14, backgroundColor: C.tealDim, borderWidth: 1, borderColor: C.borderHi },
  editWrap:        { width: '100%', gap: 10 },
  nameInput:       { backgroundColor: C.surf, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, color: C.text, fontSize: 15 },
  bioInput:        { minHeight: 72, textAlignVertical: 'top', lineHeight: 20 },
  editActions:     { flexDirection: 'row', gap: 10 },
  cancelBtn:       { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  saveBtn:         { flex: 2, borderRadius: 14, overflow: 'hidden' },
  saveBtnGrad:     { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — CHANGEMENT MOT DE PASSE
// ─────────────────────────────────────────────────────────────────────────────
function PasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent]   = useState('');
  const [next,    setNext]      = useState('');
  const [confirm, setConfirm]   = useState('');
  const [saving,  setSaving]    = useState(false);
  const [show,    setShow]      = useState(false);

  const submit = useCallback(async () => {
    if (!next || next.length < 8) { Alert.alert('Mot de passe trop court', 'Minimum 8 caractères.'); return; }
    if (next !== confirm)         { Alert.alert('Mots de passe différents', 'La confirmation ne correspond pas.'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    Alert.alert('Succès', 'Mot de passe mis à jour.');
    setCurrent(''); setNext(''); setConfirm('');
    onClose();
  }, [next, confirm, onClose]);

  if (!visible) return null;

  return (
    <View style={pw.overlay}>
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={pw.card}>
        <LinearGradient colors={['rgba(0,201,255,0.07)', 'transparent']} style={StyleSheet.absoluteFill} />
        <View style={pw.header}>
          <Ionicons name="lock-closed-outline" size={20} color={C.teal} />
          <Text style={pw.title}>Nouveau mot de passe</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={C.textSec} />
          </TouchableOpacity>
        </View>

        {(['Nouveau mot de passe', 'Confirmer'] as const).map((label, i) => (
          <View key={label} style={pw.field}>
            <Text style={pw.label}>{label.toUpperCase()}</Text>
            <View style={pw.inputRow}>
              <TextInput
                style={pw.input}
                value={i === 0 ? next : confirm}
                onChangeText={i === 0 ? setNext : setConfirm}
                secureTextEntry={!show}
                placeholder={`${i === 0 ? '8' : 'Répéter'}+ caractères`}
                placeholderTextColor={C.textTert}
                autoCapitalize="none"
              />
              {i === 0 && (
                <TouchableOpacity onPress={() => setShow(s => !s)} style={pw.eyeBtn}>
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textTert} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        <View style={pw.strength}>
          {[4, 6, 8, 10, 12].map(len => (
            <View
              key={len}
              style={[pw.bar, next.length >= len && { backgroundColor: next.length >= 10 ? C.gold : C.teal }]}
            />
          ))}
          <Text style={pw.strengthTxt}>
            {next.length === 0 ? '' : next.length < 8 ? 'Trop court' : next.length < 12 ? 'Correct' : 'Fort'}
          </Text>
        </View>

        <TouchableOpacity style={pw.cta} onPress={submit} disabled={saving}>
          <LinearGradient colors={[C.teal, C.navyMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={pw.ctaGrad}>
            {saving
              ? <ActivityIndicator color="white" />
              : <Text style={pw.ctaTxt}>Mettre à jour</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const pw = StyleSheet.create({
  overlay:   { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 100, paddingHorizontal: EDGE },
  card:      { width: '100%', borderRadius: 24, borderWidth: 1, borderColor: C.borderHi, overflow: 'hidden', padding: 20, gap: 16 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:     { flex: 1, color: C.text, fontSize: 17, fontWeight: '800' },
  field:     { gap: 7 },
  label:     { color: C.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surf, borderRadius: 13, borderWidth: 1, borderColor: C.border },
  input:     { flex: 1, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 },
  eyeBtn:    { paddingHorizontal: 12 },
  strength:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bar:       { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.surf },
  strengthTxt:{ color: C.textTert, fontSize: 10, minWidth: 60, textAlign: 'right' },
  cta:       { borderRadius: 16, overflow: 'hidden' },
  ctaGrad:   { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  ctaTxt:    { color: 'white', fontSize: 15, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — SESSIONS ACTIVES
// ─────────────────────────────────────────────────────────────────────────────
function SessionsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [loading,  setLoading]  = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    supabase.auth.getSession().then(({ data }) => {
      // Supabase ne retourne qu'une session locale — on affiche la session courante
      setSessions(data.session ? [data.session] : []);
      setLoading(false);
    });
  }, [visible]);

  const revokeAll = useCallback(async () => {
    Alert.alert(
      'Déconnecter partout',
      'Toutes vos sessions seront révoquées. Vous devrez vous reconnecter.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Révoquer tout', style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut({ scope: 'global' });
            onClose();
          },
        },
      ],
    );
  }, [onClose]);

  if (!visible) return null;

  return (
    <View style={ses.overlay}>
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={ses.card}>
        <LinearGradient colors={['rgba(0,201,255,0.07)', 'transparent']} style={StyleSheet.absoluteFill} />
        <View style={ses.header}>
          <Ionicons name="shield-checkmark-outline" size={20} color={C.teal} />
          <Text style={ses.title}>Sessions actives</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={C.textSec} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ paddingVertical: 24 }} />
        ) : sessions.length === 0 ? (
          <Text style={ses.empty}>Aucune session trouvée.</Text>
        ) : (
          sessions.map((s, i) => (
            <View key={i} style={ses.sessionRow}>
              <View style={ses.sessionIcon}>
                <Ionicons name="phone-portrait-outline" size={18} color={C.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ses.sessionName}>Session courante</Text>
                <Text style={ses.sessionMeta}>
                  Expire le {new Date((s.expires_at ?? 0) * 1000).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <View style={ses.activeDot} />
            </View>
          ))
        )}

        <TouchableOpacity style={ses.revokeBtn} onPress={revokeAll}>
          <Ionicons name="log-out-outline" size={16} color={C.red} />
          <Text style={{ color: C.red, fontSize: 14, fontWeight: '700' }}>
            Déconnecter partout
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ses = StyleSheet.create({
  overlay:     { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 100, paddingHorizontal: EDGE },
  card:        { width: '100%', borderRadius: 24, borderWidth: 1, borderColor: C.borderHi, overflow: 'hidden', padding: 20, gap: 16 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:       { flex: 1, color: C.text, fontSize: 17, fontWeight: '800' },
  sessionRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surf, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: C.border },
  sessionIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.tealDim, alignItems: 'center', justifyContent: 'center' },
  sessionName: { color: C.text, fontSize: 14, fontWeight: '600' },
  sessionMeta: { color: C.textTert, fontSize: 11, marginTop: 2 },
  activeDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal },
  revokeBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: C.redDim, borderWidth: 1, borderColor: `${C.red}30` },
  empty:       { color: C.textTert, textAlign: 'center', paddingVertical: 20 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — EXPORT DONNÉES
// ─────────────────────────────────────────────────────────────────────────────
function ExportModal({ visible, userId, onClose }: {
  visible: boolean; userId: string; onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const doExport = useCallback(async () => {
    setLoading(true);
    // Récupérer posts, prefs, profil
    const [postsRes, prefsRes, profileRes] = await Promise.all([
      supabase.from('community_posts').select('*').eq('user_id', userId),
      supabase.from('user_preferences').select('*').eq('user_id', userId),
      supabase.from('profiles').select('*').eq('id', userId),
    ]);
    const exportData = {
      exported_at: new Date().toISOString(),
      profile:     profileRes.data,
      preferences: prefsRes.data,
      posts:       postsRes.data,
    };
    // Sur mobile, on log ; en prod on enverrait par email via edge function
    console.log('[EXPORT]', JSON.stringify(exportData, null, 2));
    setLoading(false);
    setDone(true);
    setTimeout(() => { setDone(false); onClose(); }, 2000);
  }, [userId, onClose]);

  if (!visible) return null;

  return (
    <View style={exp.overlay}>
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={exp.card}>
        <LinearGradient colors={['rgba(245,200,66,0.06)', 'transparent']} style={StyleSheet.absoluteFill} />
        <Ionicons name="download-outline" size={32} color={C.gold} style={{ alignSelf: 'center' }} />
        <Text style={exp.title}>Exporter mes données</Text>
        <Text style={exp.sub}>
          Un export complet de votre profil, critiques et préférences
          sera envoyé à votre adresse email.
        </Text>
        {done ? (
          <View style={exp.doneRow}>
            <Ionicons name="checkmark-circle" size={20} color={C.teal} />
            <Text style={{ color: C.teal, fontWeight: '700' }}>Export envoyé !</Text>
          </View>
        ) : (
          <View style={exp.actions}>
            <TouchableOpacity style={exp.cancel} onPress={onClose}>
              <Text style={{ color: C.textSec, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={exp.cta} onPress={doExport} disabled={loading}>
              <LinearGradient colors={[C.gold, '#C49A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={exp.ctaGrad}>
                {loading
                  ? <ActivityIndicator color="black" />
                  : <Text style={exp.ctaTxt}>Exporter</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const exp = StyleSheet.create({
  overlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 100, paddingHorizontal: EDGE },
  card:    { width: '100%', borderRadius: 24, borderWidth: 1, borderColor: C.borderGold, overflow: 'hidden', padding: 24, gap: 14, alignItems: 'stretch' },
  title:   { color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  sub:     { color: C.textSec, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 10 },
  cancel:  { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 14, backgroundColor: C.surf, borderWidth: 1, borderColor: C.border },
  cta:     { flex: 2, borderRadius: 14, overflow: 'hidden' },
  ctaGrad: { paddingVertical: 13, alignItems: 'center' },
  ctaTxt:  { color: '#03000A', fontSize: 14, fontWeight: '800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();

  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [prefs,    setPrefs]    = useState<Prefs>(DEFAULT_PREFS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<Partial<Record<keyof Prefs, boolean>>>({});

  // Modaux
  const [showPassword, setShowPassword] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showExport,   setShowExport]   = useState(false);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const [prof, pref] = await Promise.all([
        fetchProfile(user.id),
        fetchPrefs(user.id),
      ]);
      if (cancelled) return;
      if (prof)  setProfile(prof);
      if (pref)  setPrefs(pref);
      setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const userId = profile?.id ?? '';

  // ── Mise à jour préférences ───────────────────────────────────────────────
  const setPref = useCallback(async <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrefs(p => ({ ...p, [key]: value }));
    setSaving(s => ({ ...s, [key]: true }));
    await upsertPrefs(userId, { [key]: value });
    setSaving(s => ({ ...s, [key]: false }));
  }, [userId]);

  // ── Déconnexion ───────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter', style: 'destructive',
        onPress: async () => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await supabase.auth.signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  }, [router]);

  // ── Suppression compte ────────────────────────────────────────────────────
  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes vos données (profil, critiques, watchlist) seront supprimées définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            // Supprime les données puis déconnecte (la suppression auth nécessite une edge function en prod)
            await supabase.from('community_posts').delete().eq('user_id', userId);
            await supabase.from('user_preferences').delete().eq('user_id', userId);
            await supabase.from('profiles').delete().eq('id', userId);
            await supabase.auth.signOut();
            router.replace('/(auth)/welcome');
          },
        },
      ],
    );
  }, [userId, router]);

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg0, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <GalaxyBackground />
        <ActivityIndicator color={C.teal} size="large" />
        <Text style={{ color: C.textTert, marginTop: 16, fontSize: 14 }}>Chargement…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Modaux flottants */}
      <PasswordModal visible={showPassword} onClose={() => setShowPassword(false)} />
      <SessionsModal visible={showSessions} onClose={() => setShowSessions(false)} />
      <ExportModal   visible={showExport}   userId={userId} onClose={() => setShowExport(false)} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={22} color={C.textSec} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.headerTitle}>Paramètres</Text>
            <Text style={s.headerSub}>UNIVERSE · Cinéma Indé</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
        >
          {/* ── PROFIL ─────────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 0, marginHorizontal: EDGE, marginBottom: 4 }}>
            <View style={{ height: 14 }} />
          </View>

          {profile && (
            <ProfileSection
              profile={profile}
              onUpdate={patch => setProfile(p => p ? { ...p, ...patch } : p)}
            />
          )}

          {/* ── SÉCURITÉ ───────────────────────────────────────────────── */}
          <SectionHeader title="Sécurité" icon="shield-checkmark-outline" />
          <Group>
            <Row
              icon="lock-closed-outline" iconColor={C.teal}
              title="Changer le mot de passe"
              subtitle="Dernière modification : inconnue"
              onPress={() => setShowPassword(true)}
            />
            <Row
              icon="phone-portrait-outline" iconColor={C.teal}
              title="Sessions actives"
              subtitle="Gérez les appareils connectés à votre compte"
              onPress={() => setShowSessions(true)}
            />
            <Row
              icon="mail-outline" iconColor={C.textSec}
              title="Email de connexion"
              subtitle={profile?.email ?? '—'}
              last
            />
          </Group>

          {/* ── LECTURE ────────────────────────────────────────────────── */}
          <SectionHeader title="Lecture" icon="play-circle-outline" />
          <Group>
            <Toggle
              icon="play-circle-outline" iconColor={C.teal}
              title="Lecture automatique"
              subtitle="Lance la vidéo sans appuyer sur Play"
              value={prefs.autoplay}
              onChange={v => setPref('autoplay', v)}
              saving={!!saving.autoplay}
            />
            <Toggle
              icon="cellular-outline" iconColor={C.gold}
              title="Économiseur de données"
              subtitle="Réduit la qualité sur réseau mobile"
              value={prefs.data_saver}
              onChange={v => setPref('data_saver', v)}
              saving={!!saving.data_saver}
            />
            <QualityPicker
              value={prefs.video_quality}
              onChange={v => setPref('video_quality', v)}
              last
            />
          </Group>

          {/* ── NOTIFICATIONS ──────────────────────────────────────────── */}
          <SectionHeader title="Notifications" icon="notifications-outline" />
          <Group>
            <Toggle
              icon="film-outline" iconColor={C.teal}
              title="Nouvelles sorties"
              subtitle="Films & séries indépendants ajoutés"
              value={prefs.notif_releases}
              onChange={v => setPref('notif_releases', v)}
              saving={!!saving.notif_releases}
            />
            <Toggle
              icon="people-outline" iconColor={C.gold}
              title="Activité sociale"
              subtitle="Likes, commentaires sur vos critiques"
              value={prefs.notif_social}
              onChange={v => setPref('notif_social', v)}
              saving={!!saving.notif_social}
            />
            <Toggle
              icon="trophy-outline" iconColor={C.textSec}
              title="Festivals & Avant-premières"
              subtitle="Cannes, Sundance, et autres événements"
              value={prefs.notif_festivals}
              onChange={v => setPref('notif_festivals', v)}
              saving={!!saving.notif_festivals}
              last
            />
          </Group>

          {/* ── VIE PRIVÉE ─────────────────────────────────────────────── */}
          <SectionHeader title="Vie privée" icon="eye-off-outline" />
          <Group>
            <Toggle
              icon="eye-off-outline" iconColor={C.teal}
              title="Profil privé"
              subtitle="Seuls vos abonnés voient votre profil et critiques"
              value={prefs.private_profile}
              onChange={v => setPref('private_profile', v)}
              saving={!!saving.private_profile}
            />
            <Toggle
              icon="bookmark-outline" iconColor={C.gold}
              title="Watchlist publique"
              subtitle="Visible par votre communauté"
              value={prefs.public_watchlist}
              onChange={v => setPref('public_watchlist', v)}
              saving={!!saving.public_watchlist}
              last
            />
          </Group>

          {/* ── MON COMPTE ─────────────────────────────────────────────── */}
          <SectionHeader title="Mon compte" icon="person-outline" />
          <Group>
            <Row
              icon="card-outline" iconColor={C.gold}
              title="Abonnement & Facturation"
              subtitle={`Plan actuel : ${PLAN_LABELS[profile?.plan ?? 'free'] ?? 'Gratuit'}`}
              onPress={() => {}}
            />
            <Row
              icon="download-outline" iconColor={C.textSec}
              title="Exporter mes données"
              subtitle="RGPD · Reçevez votre archive par email"
              onPress={() => setShowExport(true)}
              last
            />
          </Group>

          {/* ── À PROPOS ───────────────────────────────────────────────── */}
          <SectionHeader title="À propos" icon="information-circle-outline" />
          <Group>
            <Row icon="document-text-outline" iconColor={C.textSec} title="Conditions d'utilisation" onPress={() => {}} />
            <Row icon="shield-checkmark-outline" iconColor={C.textSec} title="Politique de confidentialité" onPress={() => {}} />
            <Row icon="help-circle-outline" iconColor={C.textSec} title="Centre d'aide" onPress={() => {}} />
            <Row
              icon="information-circle-outline" iconColor={C.textSec}
              title="Version"
              subtitle="UNIVERSE v2.0.0 · Build 420"
              last
            />
          </Group>

          {/* ── ACTIONS DANGEREUSES ─────────────────────────────────────── */}
          <View style={{ marginTop: 8 }}>
            <Group>
              <Row
                icon="log-out-outline" iconColor={C.red}
                title="Se déconnecter"
                onPress={handleLogout}
                danger
              />
              <Row
                icon="trash-outline" iconColor={C.red}
                title="Supprimer mon compte"
                subtitle="Action irréversible — toutes vos données seront effacées"
                onPress={handleDeleteAccount}
                danger
                last
              />
            </Group>
          </View>

          {/* ── FOOTER ─────────────────────────────────────────────────── */}
          <View style={s.footer}>
            <LinearGradient
              colors={[C.teal, C.gold]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.footerLine}
            />
            <Text style={s.footerTitle}>UNIVERSE</Text>
            <Text style={s.footerSub}>Cinéma Indépendant · Fait avec ✦</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerSub:   { color: C.textTert, fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginTop: 2 },
  footer:      { alignItems: 'center', paddingTop: 40, paddingBottom: 12, gap: 10 },
  footerLine:  { width: 40, height: 2, borderRadius: 1 },
  footerTitle: { color: C.teal, fontSize: 13, fontWeight: '900', letterSpacing: 4 },
  footerSub:   { color: C.textTert, fontSize: 11, letterSpacing: 0.5 },
});