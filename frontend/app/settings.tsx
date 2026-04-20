// ─────────────────────────────────────────────────────────────────────────────
// app/settings.tsx — Paramètres UNIVERSE
// Design : galactique transparent, cohérent avec profile.tsx
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
import GalaxyBackground   from '@/components/social/GalaxyBackground';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — alignés sur profile.tsx (G)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:        '#0D0D12',
  // surfaces — ultra-transparentes pour laisser la galaxie respirer
  surf:      'rgba(255,255,255,0.04)',
  surfHi:    'rgba(255,255,255,0.07)',
  border:    'rgba(255,255,255,0.07)',
  borderHi:  'rgba(255,255,255,0.13)',
  // texte
  text:      '#EDF6FF',
  textSec:   'rgba(255,255,255,0.55)',
  textTert:  'rgba(255,255,255,0.28)',
  // accents (cohérents avec G.primary / G.gold / G.cyan / G.amber)
  primary:   '#BF5FFF',
  gold:      '#F5C842',
  cyan:      '#00C9FF',
  amber:     '#FF9A3C',
  red:       '#FF3B5C',
  redDim:    'rgba(255,59,92,0.10)',
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
  role:         'critic' | 'creator' | 'director';
  plan:         'free' | 'pro' | 'cinephile';
  created_at:   string;
  films_seen_count:  number;
  followers_count:   number;
  following_count:   number;
  is_industry_contact?: boolean;
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
  autoplay: true, data_saver: false,
  notif_releases: true, notif_social: true, notif_festivals: false,
  private_profile: false, public_watchlist: true,
};

const PLAN_META: Record<string, { label: string; color: string; icon: string }> = {
  free:      { label: 'Gratuit',           color: T.textTert, icon: 'person-outline'      },
  pro:       { label: 'Universe Pro',      color: T.cyan,     icon: 'flash-outline'        },
  cinephile: { label: 'Cinéphile Ultimate',color: T.gold,     icon: 'diamond-outline'      },
};

const ROLE_LABEL: Record<string, string> = {
  critic:   '✍️ Critique',
  creator:  '⭐ Créateur·rice',
  director: '🎬 Réalisateur·rice',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function uploadAvatar(uri: string, userId: string): Promise<string | null> {
  try {
    const isBlob = uri.startsWith('blob:');
    const rawExt = isBlob ? 'jpg' : (uri.split('.').pop()?.toLowerCase() ?? 'jpg');
    const ext    = ['jpg','jpeg','png','webp'].includes(rawExt) ? rawExt : 'jpg';
    const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
    const path   = `avatars/${userId}.${ext}`;

    let payload: ArrayBuffer;
    if (Platform.OS === 'web' || isBlob) {
      payload = await (await fetch(uri)).arrayBuffer();
    } else {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      payload = decode(b64);
    }

    const { error } = await supabase.storage.from('avatars').upload(path, payload, { contentType: mime, upsert: true });
    if (error) throw error;
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + `?t=${Date.now()}`;
  } catch (e) {
    console.error('[uploadAvatar]', e);
    return null;
  }
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

async function fetchLiveStats(userId: string) {
  const [reviews, seen] = await Promise.all([
    supabase.from('critiques_with_profile').select('id, rating', { count: 'exact' }).eq('user_id', userId),
    supabase.from('seen_films').select('id', { count: 'exact' }).eq('user_id', userId),
  ]);
  const reviewRows  = reviews.data ?? [];
  const ratedRows   = reviewRows.filter((r: any) => r.rating > 0);
  const avgRating   = ratedRows.length
    ? ratedRows.reduce((s: number, r: any) => s + Number(r.rating), 0) / ratedRows.length
    : 0;
  return {
    reviewCount: reviews.count ?? reviewRows.length,
    seenCount:   seen.count ?? 0,
    avgRating,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── PRIMITIVES UI (cohérents avec profile.tsx)
// ─────────────────────────────────────────────────────────────────────────────

// Section header — même style que profile SectionHeader
const SectionTitle = memo(({ label, icon }: { label: string; icon: keyof typeof Ionicons.glyphMap }) => (
  <View style={st.row}>
    <Ionicons name={icon} size={13} color={T.primary} />
    <Text style={st.txt}>{label.toUpperCase()}</Text>
  </View>
));
const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: EDGE, marginTop: 26, marginBottom: 8 },
  txt: { color: T.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
});

// Blur group container
const Group = memo(({ children }: { children: React.ReactNode }) => (
  <View style={grp.outer}>
    <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={grp.inner}>{children}</View>
  </View>
));
const grp = StyleSheet.create({
  outer: { marginHorizontal: EDGE, borderRadius: 18, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },
  inner: { backgroundColor: T.surf },
});

const RowDivider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginLeft: 54 }} />;

// Generic row
function Row({
  icon, iconBg, title, subtitle, right, onPress, danger = false, last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
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
        activeOpacity={onPress ? 0.65 : 1}
        disabled={!onPress}
      >
        <View style={[rw.iconBox, { backgroundColor: iconBg ?? (danger ? T.redDim : T.surfHi) }]}>
          <Ionicons name={icon} size={16} color={danger ? T.red : (iconBg ? 'rgba(255,255,255,0.85)' : T.textSec)} />
        </View>
        <View style={rw.body}>
          <Text style={[rw.title, danger && { color: T.red }]}>{title}</Text>
          {subtitle ? <Text style={rw.sub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right !== undefined
          ? right
          : onPress
            ? <Ionicons name="chevron-forward" size={15} color={T.textTert} />
            : null
        }
      </TouchableOpacity>
      {!last && <RowDivider />}
    </>
  );
}
const rw = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 13 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body:    { flex: 1, gap: 1 },
  title:   { color: T.text, fontSize: 14, fontWeight: '600' },
  sub:     { color: T.textTert, fontSize: 11, lineHeight: 15 },
});

// Toggle row
function ToggleRow({
  icon, iconBg, title, subtitle, value, onChange, saving = false, last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  saving?: boolean;
  last?: boolean;
}) {
  return (
    <Row
      icon={icon} iconBg={iconBg} title={title} subtitle={subtitle} last={last}
      right={
        saving
          ? <ActivityIndicator size="small" color={T.primary} />
          : (
            <Switch
              value={value}
              onValueChange={onChange}
              trackColor={{ false: T.border, true: T.primary }}
              thumbColor="white"
              ios_backgroundColor={T.surf}
            />
          )
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📊 LIVE STAT WIDGETS (mêmes widgets que profile.tsx, synchronisés)
// ─────────────────────────────────────────────────────────────────────────────
type LiveStats = { reviewCount: number; seenCount: number; avgRating: number };

const StatsWidgets = memo(({ stats, onNavigate }: {
  stats: LiveStats;
  onNavigate: (route: string) => void;
}) => (
  <View style={sw.row}>
    <TouchableOpacity style={sw.card} activeOpacity={0.7} onPress={() => onNavigate('/profile/seen_films')}>
      <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={sw.inner}>
        <Ionicons name="eye" size={13} color={T.cyan} />
        <Text style={sw.val}>{stats.seenCount}</Text>
      </View>
      <Text style={sw.label}>Films vus</Text>
    </TouchableOpacity>

    <TouchableOpacity style={sw.card} activeOpacity={0.7} onPress={() => onNavigate('/profile/reviews')}>
      <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={sw.inner}>
        <Ionicons name="pencil" size={13} color={T.amber} />
        <Text style={sw.val}>{stats.reviewCount}</Text>
      </View>
      <Text style={sw.label}>Critiques</Text>
    </TouchableOpacity>

    <TouchableOpacity style={sw.card} activeOpacity={0.7} onPress={() => onNavigate('/profile/reviews')}>
      <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={sw.inner}>
        <Ionicons name="star" size={13} color={T.gold} />
        <Text style={sw.val}>{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}</Text>
      </View>
      <Text style={sw.label}>Note moy.</Text>
    </TouchableOpacity>
  </View>
));
const sw = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 8, paddingHorizontal: EDGE, marginBottom: 4 },
  card:  { flex: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: T.border, paddingVertical: 10, alignItems: 'center', gap: 4 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  val:   { color: T.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.4 },
  label: { color: T.textTert, fontSize: 9, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🪪 PROFILE CARD — Édition inline, avatar upload, plan badge
// ─────────────────────────────────────────────────────────────────────────────
type ProfileCardProps = {
  profile: Profile;
  onUpdate: (patch: Partial<Profile>) => void;
};

const ProfileCard = memo(function ProfileCard({ profile, onUpdate }: ProfileCardProps) {
  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState(profile.display_name);
  const [bio,       setBio]       = useState(profile.bio ?? '');
  const [saving,    setSaving]    = useState(false);
  const [avatarUri, setAvatarUri] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);

  const plan = PLAN_META[profile.plan ?? 'free'] ?? PLAN_META.free;

  const saveProfile = useCallback(async () => {
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
      <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
      {/* accent glow top */}
      <LinearGradient
        colors={[`${T.primary}12`, 'transparent']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={pc.header}>
        {/* Avatar */}
        <TouchableOpacity onPress={pickAvatar} style={pc.avatarWrap} activeOpacity={0.8}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={pc.avatar} />
          ) : (
            <LinearGradient colors={[T.primary, '#5500AA']} style={pc.avatar}>
              <Ionicons name="person" size={32} color="rgba(255,255,255,0.5)" />
            </LinearGradient>
          )}
          {/* purple ring (cohérent avec profile.tsx) */}
          <View style={pc.avatarRing} pointerEvents="none" />
          <View style={pc.avatarBadge}>
            {uploading
              ? <ActivityIndicator size="small" color={T.primary} />
              : <Ionicons name="camera" size={11} color="white" />
            }
          </View>
        </TouchableOpacity>

        {/* Identity */}
        <View style={pc.identity}>
          <Text style={pc.name} numberOfLines={1}>{profile.display_name || 'Cinéphile'}</Text>
          <Text style={pc.username} numberOfLines={1}>@{profile.username}</Text>
          <Text style={pc.email} numberOfLines={1}>{profile.email}</Text>
          {/* plan + role pills */}
          <View style={pc.pills}>
            <View style={[pc.pill, { borderColor: `${plan.color}30`, backgroundColor: `${plan.color}0E` }]}>
              <Ionicons name={plan.icon as any} size={9} color={plan.color} />
              <Text style={[pc.pillTxt, { color: plan.color }]}>{plan.label}</Text>
            </View>
            <View style={[pc.pill, { borderColor: 'rgba(191,95,255,0.25)', backgroundColor: 'rgba(191,95,255,0.07)' }]}>
              <Text style={[pc.pillTxt, { color: T.primary }]}>{ROLE_LABEL[profile.role] ?? '🎬 Cinéphile'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bio / Edit */}
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
            multiline maxLength={120}
          />
          <View style={pc.editBtns}>
            <TouchableOpacity style={pc.cancelBtn} onPress={() => {
              setName(profile.display_name); setBio(profile.bio ?? ''); setEditing(false);
            }}>
              <Text style={{ color: T.textSec, fontSize: 13, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pc.saveBtn} onPress={saveProfile} disabled={saving}>
              <LinearGradient colors={[T.primary, '#7700DD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={pc.saveBtnGrad}>
                {saving
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>Enregistrer</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={pc.bioRow}>
          {profile.bio ? <Text style={pc.bio} numberOfLines={2}>{profile.bio}</Text> : null}
          <TouchableOpacity style={pc.editChip} onPress={() => setEditing(true)}>
            <Ionicons name="create-outline" size={12} color={T.primary} />
            <Text style={pc.editChipTxt}>Modifier</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const pc = StyleSheet.create({
  wrap:       { marginHorizontal: EDGE, borderRadius: 20, borderWidth: 1, borderColor: T.borderHi, overflow: 'hidden', padding: 16, gap: 12 },
  header:     { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatarWrap: { position: 'relative', alignSelf: 'flex-start' },
  avatar:     { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 38, borderWidth: 2, borderColor: 'rgba(191,95,255,0.35)' },
  avatarBadge:{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: T.bg, borderWidth: 2, borderColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  identity:   { flex: 1, gap: 2 },
  name:       { color: T.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  username:   { color: T.primary, fontSize: 12, fontWeight: '600' },
  email:      { color: T.textTert, fontSize: 11, marginTop: 1 },
  pills:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  pillTxt:    { fontSize: 10, fontWeight: '700' },
  bioRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bio:        { flex: 1, color: T.textSec, fontSize: 12, lineHeight: 17 },
  editChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(191,95,255,0.25)', backgroundColor: 'rgba(191,95,255,0.07)' },
  editChipTxt:{ color: T.primary, fontSize: 11, fontWeight: '700' },
  editBlock:  { gap: 8 },
  input:      { backgroundColor: T.surfHi, borderRadius: 12, borderWidth: 1, borderColor: T.border, paddingHorizontal: 13, paddingVertical: 10, color: T.text, fontSize: 14 },
  bioInput:   { minHeight: 64, textAlignVertical: 'top', lineHeight: 19 },
  editBtns:   { flexDirection: 'row', gap: 8 },
  cancelBtn:  { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, backgroundColor: T.surf, borderWidth: 1, borderColor: T.border },
  saveBtn:    { flex: 2, borderRadius: 12, overflow: 'hidden' },
  saveBtnGrad:{ paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 RACCOURCIS APP — quick links vers les features de l'app
// ─────────────────────────────────────────────────────────────────────────────
const APP_SHORTCUTS = [
  { icon: 'trophy-outline'  as const, label: 'Favoris',    color: '#F5C842', route: '/profile/favorites'  },
  { icon: 'pencil-outline'  as const, label: 'Critiques',  color: '#FF9A3C', route: '/profile/reviews'    },
  { icon: 'film-outline'    as const, label: 'Visionnés',  color: '#00C9FF', route: '/profile/seen_films' },
  { icon: 'videocam-outline'as const, label: 'Mes Reels',  color: '#BF5FFF', route: '/profile/reels'      },
];

const AppShortcuts = memo(({ onNavigate }: { onNavigate: (r: string) => void }) => (
  <View style={as.row}>
    {APP_SHORTCUTS.map((s) => (
      <TouchableOpacity key={s.route} style={as.item} onPress={() => onNavigate(s.route)} activeOpacity={0.65}>
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[as.iconCircle, { backgroundColor: `${s.color}14`, borderColor: `${s.color}22` }]}>
          <Ionicons name={s.icon} size={18} color={s.color} />
        </View>
        <Text style={as.label}>{s.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
));
const as = StyleSheet.create({
  row:        { flexDirection: 'row', paddingHorizontal: EDGE, gap: 8 },
  item:       { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border, alignItems: 'center', paddingVertical: 12, gap: 7 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  label:      { color: T.textSec, fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();

  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [prefs,    setPrefs]    = useState<Prefs>(DEFAULT_PREFS);
  const [stats,    setStats]    = useState<LiveStats>({ reviewCount: 0, seenCount: 0, avgRating: 0 });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<Partial<Record<keyof Prefs, boolean>>>({});

  const scrollY = useRef(new Animated.Value(0)).current;

  // Animated sticky bar
  const stickyOp = scrollY.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const [prof, pref, liveStats] = await Promise.all([
        fetchProfile(user.id),
        fetchPrefs(user.id),
        fetchLiveStats(user.id),
      ]);
      if (cancelled) return;
      if (prof) setProfile(prof);
      setPrefs(pref);
      setStats(liveStats);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const userId = profile?.id ?? '';

  // ── Pref toggle ────────────────────────────────────────────────────────────
  const setPref = useCallback(async <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrefs(p => ({ ...p, [key]: value }));
    setSaving(s => ({ ...s, [key]: true }));
    await upsertPref(userId, key, value);
    setSaving(s => ({ ...s, [key]: false }));
  }, [userId]);

  // ── Password reset ─────────────────────────────────────────────────────────
  const handlePasswordReset = useCallback(() => {
    Alert.alert(
      'Réinitialiser le mot de passe',
      'Un lien de réinitialisation sera envoyé à votre adresse email.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer le lien',
          onPress: async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(profile?.email ?? '');
            Alert.alert(error ? 'Erreur' : 'Email envoyé !', error ? error.message : `Lien envoyé à ${profile?.email}`);
          },
        },
      ],
    );
  }, [profile?.email]);

  // ── Logout ─────────────────────────────────────────────────────────────────
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

  // ── Delete account ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Profil, critiques et watchlist seront effacés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement', style: 'destructive',
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

  const navigate = useCallback((route: string) => router.push(route as any), [router]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.root}>
        <StatusBar style="light" />
        <GalaxyBackground />
        <ActivityIndicator color={T.primary} size="large" style={{ marginTop: 200 }} />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Sticky title on scroll */}
      <Animated.View pointerEvents="none" style={[s.stickyBar, { opacity: stickyOp }]}>
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
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
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <SafeAreaView edges={['top']}>
          {/* ── TOP NAV ── */}
          <View style={s.topNav}>
            {/* LEFT — back */}
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="chevron-back" size={20} color={T.textSec} />
            </TouchableOpacity>

            {/* CENTER — title */}
            <View style={s.topNavCenter}>
              <Text style={s.topNavTitle}>Paramètres</Text>
              <Text style={s.topNavSub}>UNIVERSE · Cinéma Indé</Text>
            </View>

            {/* RIGHT — placeholder to balance */}
            <View style={{ width: 40 }} />
          </View>

          {/* glow separator (même que profile.tsx) */}
          <View style={s.glowSep} />
        </SafeAreaView>

        {/* ── PROFIL CARD ── */}
        <SectionTitle label="Mon profil" icon="person-outline" />
        {profile && (
          <ProfileCard
            profile={profile}
            onUpdate={patch => setProfile(p => p ? { ...p, ...patch } : p)}
          />
        )}

        {/* ── STATS LIVE (mêmes widgets que profile.tsx) ── */}
        <SectionTitle label="Mon activité" icon="bar-chart-outline" />
        <StatsWidgets stats={stats} onNavigate={navigate} />

        {/* ── RACCOURCIS APP ── */}
        <SectionTitle label="Accès rapide" icon="grid-outline" />
        <AppShortcuts onNavigate={navigate} />

        {/* ── CINÉPHILE ── */}
        <SectionTitle label="Lecture" icon="play-circle-outline" />
        <Group>
          <ToggleRow
            icon="play-circle-outline" iconBg={`${T.cyan}18`}
            title="Lecture automatique"
            subtitle="Lance la vidéo sans appuyer sur Play"
            value={prefs.autoplay}
            onChange={v => setPref('autoplay', v)}
            saving={!!saving.autoplay}
          />
          <ToggleRow
            icon="cellular-outline" iconBg={`${T.gold}18`}
            title="Économiseur de données"
            subtitle="Réduit la qualité sur réseau mobile"
            value={prefs.data_saver}
            onChange={v => setPref('data_saver', v)}
            saving={!!saving.data_saver}
            last
          />
        </Group>

        {/* ── NOTIFICATIONS ── */}
        <SectionTitle label="Notifications" icon="notifications-outline" />
        <Group>
          <ToggleRow
            icon="film-outline" iconBg={`${T.cyan}18`}
            title="Nouvelles sorties"
            subtitle="Films & séries indépendants ajoutés"
            value={prefs.notif_releases}
            onChange={v => setPref('notif_releases', v)}
            saving={!!saving.notif_releases}
          />
          <ToggleRow
            icon="people-outline" iconBg={`${T.amber}18`}
            title="Activité sociale"
            subtitle="Likes & commentaires sur vos critiques"
            value={prefs.notif_social}
            onChange={v => setPref('notif_social', v)}
            saving={!!saving.notif_social}
          />
          <ToggleRow
            icon="trophy-outline" iconBg={`${T.gold}18`}
            title="Festivals"
            subtitle="Cannes, Sundance et avant-premières"
            value={prefs.notif_festivals}
            onChange={v => setPref('notif_festivals', v)}
            saving={!!saving.notif_festivals}
            last
          />
        </Group>

        {/* ── CONFIDENTIALITÉ ── */}
        <SectionTitle label="Confidentialité" icon="eye-off-outline" />
        <Group>
          <ToggleRow
            icon="eye-off-outline" iconBg={`${T.primary}18`}
            title="Profil privé"
            subtitle="Seuls vos abonnés voient vos critiques"
            value={prefs.private_profile}
            onChange={v => setPref('private_profile', v)}
            saving={!!saving.private_profile}
          />
          <ToggleRow
            icon="bookmark-outline" iconBg={`${T.gold}18`}
            title="Watchlist publique"
            subtitle="Visible par votre communauté"
            value={prefs.public_watchlist}
            onChange={v => setPref('public_watchlist', v)}
            saving={!!saving.public_watchlist}
            last
          />
        </Group>

        {/* ── COMPTE ── */}
        <SectionTitle label="Compte" icon="shield-outline" />
        <Group>
          <Row
            icon="lock-closed-outline" iconBg={`${T.cyan}18`}
            title="Réinitialiser le mot de passe"
            subtitle={`Email envoyé à ${profile?.email ?? '—'}`}
            onPress={handlePasswordReset}
          />
          <Row
            icon="card-outline" iconBg={`${T.gold}18`}
            title="Abonnement"
            subtitle={`Plan actuel : ${PLAN_META[profile?.plan ?? 'free'].label}`}
            onPress={() => navigate('/subscription')}
            last
          />
        </Group>

        {/* ── ACTIONS SENSIBLES ── */}
        <View style={{ marginTop: 10, marginBottom: 4 }}>
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
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <LinearGradient
            colors={[T.primary, T.gold]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.footerLine}
          />
          <Text style={s.footerTitle}>UNIVERSE</Text>
          <Text style={s.footerSub}>Cinéma Indépendant · v2.0.0 · Fait avec ✦</Text>
        </View>

      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  // Sticky bar
  stickyBar:   { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  stickyInner: { alignItems: 'center', paddingBottom: 10, paddingTop: 4 },
  stickyTitle: { color: T.text, fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },

  // Top nav
  topNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EDGE, paddingVertical: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.border,
  },
  topNavCenter: { alignItems: 'center', gap: 1 },
  topNavTitle:  { color: T.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  topNavSub:    { color: T.textTert, fontSize: 9, fontWeight: '600', letterSpacing: 1.5 },

  // Glow sep (même que profile.tsx)
  glowSep: {
    height: 1, marginTop: 6,
    backgroundColor: 'rgba(191,95,255,0.12)',
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
  },

  // Footer
  footer:      { alignItems: 'center', paddingTop: 36, paddingBottom: 8, gap: 8 },
  footerLine:  { width: 36, height: 2, borderRadius: 1 },
  footerTitle: { color: T.primary, fontSize: 12, fontWeight: '900', letterSpacing: 4 },
  footerSub:   { color: T.textTert, fontSize: 10, letterSpacing: 0.4 },
});