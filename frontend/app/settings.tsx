// ─────────────────────────────────────────────────────────────────────────────
// app/settings.tsx — Paramètres UNIVERSE
// Couleur dominante : C.navyMid · Background : GalaxyBackground
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  useState, useEffect, useCallback, useRef, memo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Animated, Platform, ActivityIndicator,
  Image, Switch,
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
import { C }              from '@/components/create/tokens';
import GalaxyBackground   from '@/components/social/GalaxyBackground';

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — C.navyMid dominant, surfaces ultra-transparentes
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:         C.navyMid,
  surf:       'rgba(255,255,255,0.04)',
  surfHi:     'rgba(255,255,255,0.07)',
  border:     'rgba(255,255,255,0.07)',
  borderHi:   'rgba(255,255,255,0.13)',
  text:       '#FFFFFF',
  textSec:    'rgba(255,255,255,0.52)',
  textTert:   'rgba(255,255,255,0.25)',
  accent:     C.navyMid,          // teinte pour les badges/pills
  dim:        'rgba(255,255,255,0.06)',
} as const;

const EDGE = 16;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Profile {
  id:           string;
  display_name: string;
  username:     string;
  bio:          string;
  avatar_url:   string;
  email:        string;
  role:         string;
  plan:         'free' | 'pro' | 'cinephile';
  created_at:   string;
}

interface Prefs {
  autoplay:         boolean;
  data_saver:       boolean;
  notif_releases:   boolean;
  notif_social:     boolean;
  notif_festivals:  boolean;
  private_profile:  boolean;
  public_watchlist: boolean;
}

const DEFAULT_PREFS: Prefs = {
  autoplay: true,         data_saver: false,
  notif_releases: true,   notif_social: true,  notif_festivals: false,
  private_profile: false, public_watchlist: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function uploadAvatar(uri: string, userId: string): Promise<string | null> {
  try {
    const isBlob = uri.startsWith('blob:');
    const rawExt = isBlob ? 'jpg' : (uri.split('.').pop()?.toLowerCase() ?? 'jpg');
    const ext    = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
    const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
    const path   = `avatars/${userId}.${ext}`;
    let payload: ArrayBuffer;
    if (Platform.OS === 'web' || isBlob) {
      payload = await (await fetch(uri)).arrayBuffer();
    } else {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      payload = decode(b64);
    }
    const { error } = await supabase.storage.from('avatars').upload(path, payload, { contentType: mime, upsert: true });
    if (error) throw error;
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + `?t=${Date.now()}`;
  } catch { return null; }
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const [{ data }, { data: authData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.auth.getUser(),
  ]);
  if (!data) return null;
  return { ...(data as Profile), email: authData.user?.email ?? '' };
}

async function fetchPrefs(userId: string): Promise<Prefs> {
  const { data } = await supabase.from('user_preferences').select('*').eq('user_id', userId).single();
  return data ? { ...DEFAULT_PREFS, ...data } as Prefs : DEFAULT_PREFS;
}

async function upsertPref<K extends keyof Prefs>(userId: string, key: K, value: Prefs[K]) {
  await supabase.from('user_preferences').upsert({ user_id: userId, [key]: value }, { onConflict: 'user_id' });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔤 SECTION TITLE
// ─────────────────────────────────────────────────────────────────────────────
const SectionTitle = memo(({ label }: { label: string }) => (
  <View style={sct.row}>
    <View style={sct.line} />
    <Text style={sct.txt}>{label.toUpperCase()}</Text>
    <View style={sct.line} />
  </View>
));
SectionTitle.displayName = 'SectionTitle';
const sct = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: EDGE, marginTop: 28, marginBottom: 10 },
  line:{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: T.border },
  txt: { color: T.textTert, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📦 GROUP CONTAINER
// ─────────────────────────────────────────────────────────────────────────────
const Group = memo(({ children }: { children: React.ReactNode }) => (
  <View style={grp.outer}>
    <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={grp.inner}>{children}</View>
  </View>
));
Group.displayName = 'Group';
const grp = StyleSheet.create({
  outer: { marginHorizontal: EDGE, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, overflow: 'hidden' },
  inner: { backgroundColor: T.surf },
});

const RowDivider = () => (
  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginLeft: 54 }} />
);

// ─────────────────────────────────────────────────────────────────────────────
// ROW — ligne générique
// ─────────────────────────────────────────────────────────────────────────────
function Row({
  icon, title, subtitle, right, onPress, danger = false, last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <>
      <TouchableOpacity
        style={rw.wrap}
        onPress={onPress}
        activeOpacity={onPress ? 0.6 : 1}
        disabled={!onPress}
      >
        <View style={[rw.iconBox, danger && rw.iconBoxDanger]}>
          <Ionicons name={icon} size={15} color={danger ? 'rgba(255,80,80,0.9)' : T.textSec} />
        </View>
        <View style={rw.body}>
          <Text style={[rw.title, danger && { color: 'rgba(255,80,80,0.9)' }]}>{title}</Text>
          {subtitle ? <Text style={rw.sub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right !== undefined
          ? right
          : onPress
            ? <Ionicons name="chevron-forward" size={13} color={T.textTert} />
            : null
        }
      </TouchableOpacity>
      {!last && <RowDivider />}
    </>
  );
}
const rw = StyleSheet.create({
  wrap:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 13 },
  iconBox:     { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surfHi },
  iconBoxDanger:{ backgroundColor: 'rgba(255,80,80,0.08)' },
  body:        { flex: 1, gap: 2 },
  title:       { color: T.text, fontSize: 14, fontWeight: '600' },
  sub:         { color: T.textTert, fontSize: 11 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE ROW
// ─────────────────────────────────────────────────────────────────────────────
function ToggleRow({
  icon, title, subtitle, value, onChange, saving = false, last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  saving?: boolean;
  last?: boolean;
}) {
  return (
    <Row
      icon={icon} title={title} subtitle={subtitle} last={last}
      right={
        saving
          ? <ActivityIndicator size="small" color={T.textSec} />
          : (
            <Switch
              value={value}
              onValueChange={onChange}
              trackColor={{ false: T.border, true: 'rgba(255,255,255,0.35)' }}
              thumbColor='#f4f3f4'
            />
          )
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🪪 PROFILE CARD
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_LABEL: Record<string, string> = {
  free:      'Gratuit',
  pro:       'Universe Pro',
  cinephile: 'Cinéphile Ultimate',
};
const ROLE_LABEL: Record<string, string> = {
  critic:   'Critique',
  creator:  'Créateur·rice',
  director: 'Réalisateur·rice',
};

const ProfileCard = memo(function ProfileCard({
  profile, onUpdate,
}: { profile: Profile; onUpdate: (p: Partial<Profile>) => void }) {
  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState(profile.display_name);
  const [bio,       setBio]       = useState(profile.bio ?? '');
  const [saving,    setSaving]    = useState(false);
  const [avatarUri, setAvatarUri] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);

  const save = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Nom requis'); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles')
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
    if (!perm.granted) { Alert.alert('Permission requise'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    setAvatarUri(uri);
    setUploading(true);
    const url = await uploadAvatar(uri, profile.id);
    if (!url) { Alert.alert('Erreur upload'); setUploading(false); return; }
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
    setAvatarUri(url);
    onUpdate({ avatar_url: url });
    setUploading(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [profile.id, onUpdate]);

  return (
    <View style={pc.wrap}>
      <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />

      <View style={pc.header}>
        {/* Avatar */}
        <TouchableOpacity onPress={pickAvatar} style={pc.avatarWrap} activeOpacity={0.8}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={pc.avatar} />
            : <View style={[pc.avatar, pc.avatarFallback]}>
                <Ionicons name="person" size={28} color={T.textTert} />
              </View>
          }
          <View style={pc.avatarRing} pointerEvents="none" />
          <View style={pc.avatarBadge}>
            {uploading
              ? <ActivityIndicator size="small" color={T.text} />
              : <Ionicons name="camera" size={10} color={T.text} />
            }
          </View>
        </TouchableOpacity>

        {/* Identité */}
        <View style={pc.identity}>
          <Text style={pc.name} numberOfLines={1}>{profile.display_name || 'Cinéphile'}</Text>
          <Text style={pc.username}>@{profile.username}</Text>
          <Text style={pc.email} numberOfLines={1}>{profile.email}</Text>
          <View style={pc.pills}>
            <View style={pc.pill}>
              <Text style={pc.pillTxt}>{PLAN_LABEL[profile.plan ?? 'free']}</Text>
            </View>
            <View style={pc.pill}>
              <Text style={pc.pillTxt}>{ROLE_LABEL[profile.role] ?? 'Cinéphile'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bio / Édition */}
      {editing ? (
        <View style={pc.editBlock}>
          <TextInput
            style={pc.input}
            value={name}
            onChangeText={setName}
            placeholder="Nom affiché"
            placeholderTextColor={T.textTert}
            maxLength={40}
          />
          <TextInput
            style={[pc.input, pc.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Une courte bio..."
            placeholderTextColor={T.textTert}
            multiline
            maxLength={120}
          />
          <View style={pc.editBtns}>
            <TouchableOpacity
              style={pc.cancelBtn}
              onPress={() => { setName(profile.display_name); setBio(profile.bio ?? ''); setEditing(false); }}
            >
              <Text style={pc.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pc.saveBtn} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={T.text} />
                : <Text style={pc.saveTxt}>Enregistrer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={pc.bioRow}>
          {profile.bio ? <Text style={pc.bio} numberOfLines={2}>{profile.bio}</Text> : null}
          <TouchableOpacity style={pc.editChip} onPress={() => setEditing(true)}>
            <Ionicons name="create-outline" size={12} color={T.textSec} />
            <Text style={pc.editChipTxt}>Modifier</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});
ProfileCard.displayName = 'ProfileCard';

const pc = StyleSheet.create({
  wrap:          { marginHorizontal: EDGE, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: T.borderHi, overflow: 'hidden', padding: 16, gap: 12 },
  header:        { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatarWrap:    { position: 'relative', alignSelf: 'flex-start' },
  avatar:        { width: 68, height: 68, borderRadius: 34 },
  avatarFallback:{ backgroundColor: T.surfHi, alignItems: 'center', justifyContent: 'center' },
  avatarRing:    { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 36, borderWidth: 1.5, borderColor: T.borderHi },
  avatarBadge:   { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: T.surfHi, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  identity:      { flex: 1, gap: 3 },
  name:          { color: T.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  username:      { color: T.textSec, fontSize: 12, fontWeight: '600' },
  email:         { color: T.textTert, fontSize: 11 },
  pills:         { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  pill:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, backgroundColor: T.surf },
  pillTxt:       { color: T.textTert, fontSize: 10, fontWeight: '600' },
  bioRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bio:           { flex: 1, color: T.textSec, fontSize: 12, lineHeight: 17 },
  editChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, backgroundColor: T.surf },
  editChipTxt:   { color: T.textSec, fontSize: 11, fontWeight: '600' },
  editBlock:     { gap: 8 },
  input:         { backgroundColor: T.surfHi, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, paddingHorizontal: 13, paddingVertical: 10, color: T.text, fontSize: 14 },
  bioInput:      { minHeight: 60, textAlignVertical: 'top', lineHeight: 19 },
  editBtns:      { flexDirection: 'row', gap: 8 },
  cancelBtn:     { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  cancelTxt:     { color: T.textSec, fontSize: 13, fontWeight: '600' },
  saveBtn:       { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 12, backgroundColor: T.surfHi, borderWidth: StyleSheet.hairlineWidth, borderColor: T.borderHi },
  saveTxt:       { color: T.text, fontSize: 13, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs,   setPrefs]   = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<Partial<Record<keyof Prefs, boolean>>>({});

  const scrollY = useRef(new Animated.Value(0)).current;
  const stickyOp = scrollY.interpolate({ inputRange: [0, 70], outputRange: [0, 1], extrapolate: 'clamp' });

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const [prof, pref] = await Promise.all([
        fetchProfile(user.id),
        fetchPrefs(user.id),
      ]);
      if (cancelled) return;
      if (prof) setProfile(prof);
      setPrefs(pref);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const userId = profile?.id ?? '';

  // ── Toggle pref ──────────────────────────────────────────────────────────────
  const setPref = useCallback(async <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrefs(p => ({ ...p, [key]: value }));
    setSaving(s => ({ ...s, [key]: true }));
    await upsertPref(userId, key, value);
    setSaving(s => ({ ...s, [key]: false }));
  }, [userId]);

  // ── Actions compte ───────────────────────────────────────────────────────────
  const handlePasswordReset = useCallback(() => {
    Alert.alert(
      'Réinitialiser le mot de passe',
      `Un lien sera envoyé à ${profile?.email ?? '—'}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer', onPress: async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(profile?.email ?? '');
            Alert.alert(error ? 'Erreur' : 'Email envoyé', error?.message ?? `Lien envoyé à ${profile?.email}`);
          },
        },
      ],
    );
  }, [profile?.email]);

  const handleLogout = useCallback(() => {
    Alert.alert('Déconnexion', 'Quitter votre session Universe ?', [
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

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer mon compte',
      'Action irréversible. Profil, critiques et watchlist seront effacés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            await Promise.all([
              supabase.from('user_preferences').delete().eq('user_id', userId),
              supabase.from('profiles').delete().eq('id', userId),
            ]);
            await supabase.auth.signOut();
            router.replace('/(auth)/welcome');
          },
        },
      ],
    );
  }, [userId, router]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />
      <ActivityIndicator color={T.textSec} size="large" style={{ flex: 1 }} />
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Sticky bar transparente */}
      <Animated.View pointerEvents="none" style={[s.stickyBar, { opacity: stickyOp }]}>
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['top']} style={s.stickyInner}>
          <Text style={s.stickyTitle}>Paramètres</Text>
        </SafeAreaView>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        <SafeAreaView edges={['top']}>
          {/* Nav */}
          <View style={s.topNav}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="chevron-back" size={19} color={T.textSec} />
            </TouchableOpacity>
            <Text style={s.topNavTitle}>Paramètres</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>

        {/* ── LECTURE ── */}
        <SectionTitle label="Lecture" />
        <Group>
          <ToggleRow
            icon="play-circle-outline"
            title="Lecture automatique"
            subtitle="Lance la vidéo sans appuyer sur Play"
            value={prefs.autoplay}
            onChange={v => setPref('autoplay', v)}
            saving={!!saving.autoplay}
          />
          <ToggleRow
            icon="cellular-outline"
            title="Économiseur de données"
            subtitle="Réduit la qualité sur réseau mobile"
            value={prefs.data_saver}
            onChange={v => setPref('data_saver', v)}
            saving={!!saving.data_saver}
            last
          />
        </Group>

        {/* ── NOTIFICATIONS ── */}
        <SectionTitle label="Notifications" />
        <Group>
          <ToggleRow
            icon="film-outline"
            title="Nouvelles sorties"
            subtitle="Films & séries indépendants ajoutés"
            value={prefs.notif_releases}
            onChange={v => setPref('notif_releases', v)}
            saving={!!saving.notif_releases}
          />
          <ToggleRow
            icon="people-outline"
            title="Activité sociale"
            subtitle="Likes & commentaires sur vos critiques"
            value={prefs.notif_social}
            onChange={v => setPref('notif_social', v)}
            saving={!!saving.notif_social}
          />
          <ToggleRow
            icon="calendar-outline"
            title="Festivals"
            subtitle="Cannes, Sundance et avant-premières"
            value={prefs.notif_festivals}
            onChange={v => setPref('notif_festivals', v)}
            saving={!!saving.notif_festivals}
            last
          />
        </Group>

        {/* ── CONFIDENTIALITÉ ── */}
        <SectionTitle label="Confidentialité" />
        <Group>
          <ToggleRow
            icon="eye-off-outline"
            title="Profil privé"
            subtitle="Seuls vos abonnés voient vos critiques"
            value={prefs.private_profile}
            onChange={v => setPref('private_profile', v)}
            saving={!!saving.private_profile}
          />
          <ToggleRow
            icon="bookmark-outline"
            title="Watchlist publique"
            subtitle="Visible par votre communauté"
            value={prefs.public_watchlist}
            onChange={v => setPref('public_watchlist', v)}
            saving={!!saving.public_watchlist}
            last
          />
        </Group>

        {/* ── COMPTE ── */}
        <SectionTitle label="Compte" />
        <Group>
          <Row
            icon="lock-closed-outline"
            title="Mot de passe"
            subtitle="Envoyer un lien de réinitialisation"
            onPress={handlePasswordReset}
          />
          <Row
            icon="card-outline"
            title="Abonnement"
            subtitle={PLAN_LABEL[profile?.plan ?? 'free']}
            onPress={() => router.push('/subscription' as any)}
            last
          />
        </Group>

        {/* ── ZONE SENSIBLE ── */}
        <SectionTitle label="Session" />
        <Group>
          <Row
            icon="log-out-outline"
            title="Se déconnecter"
            onPress={handleLogout}
            danger
          />
          <Row
            icon="trash-outline"
            title="Supprimer mon compte"
            subtitle="Action irréversible"
            onPress={handleDelete}
            danger
            last
          />
        </Group>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerLine} />
          <Text style={s.footerTxt}>UNIVERSE · v2.0</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.navyMid },

  stickyBar:  { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  stickyInner:{ alignItems: 'center', paddingBottom: 10, paddingTop: 6 },
  stickyTitle:{ color: T.text, fontSize: 14, fontWeight: '700' },

  topNav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: EDGE, paddingVertical: 10 },
  backBtn:    { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  topNavTitle:{ color: T.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

  sep:        { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginHorizontal: EDGE, marginTop: 6 },

  footer:     { alignItems: 'center', paddingTop: 40, gap: 8 },
  footerLine: { width: 24, height: StyleSheet.hairlineWidth, backgroundColor: T.border },
  footerTxt:  { color: T.textTert, fontSize: 9, fontWeight: '700', letterSpacing: 2.5 },
});