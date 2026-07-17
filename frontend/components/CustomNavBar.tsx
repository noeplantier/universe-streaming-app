/**
 * components/CustomNavBar.tsx — UNIVERSE
 *
 * ★ UX/UI identique v4 : floating pill, BlurView, MaterialCommunityIcons
 * ★ getDeviceId() — ZERO supabase.auth.* → fonctionne sans session
 * ★ Avatar live : Realtime profiles UPDATE + SecureStore 'profile_dirty'
 * ★ Canal nav_{mountId}_{uid} unique par montage (.on() AVANT .subscribe())
 * ★ Monté après 1 tick (contexte navigation initialisé)
 */
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Image, Platform, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { BlurView }               from 'expo-blur';
import { Ionicons }               from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase }               from '@/lib/supabase';
import { getDeviceId }            from '@/services/api';

// useRouter chargé dynamiquement (évite crash si contexte pas prêt)
let _useRouter: (() => { push: (p: any) => void }) | null = null;
try { _useRouter = require('expo-router').useRouter; } catch {}

// SecureStore — natif uniquement
const SecureStore: any = Platform.select({
  native:  () => { try { return require('expo-secure-store'); } catch { return null; } },
  default: () => null,
})?.() ?? null;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProfileMini {
  avatar_url:   string;
  display_name: string;
  username:     string;
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
const NavAvatar = memo(function NavAvatar({ profile }: { profile: ProfileMini | null }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => { setImgErr(false); }, [profile?.avatar_url]);

  const name     = profile?.display_name || profile?.username || '?';
  const initials = name.trim().split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const hasAvatar = !!(profile?.avatar_url) && !imgErr;

  return (
    <View style={ns.avatarWrap}>
      {hasAvatar ? (
        <Image
          source={{ uri: profile!.avatar_url }}
          style={ns.avatar}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        <View style={[ns.avatar, ns.monogram]}>
          <Ionicons name="person-circle-outline" size={28} color="rgba(255,255,255,0.45)"/>
        </View>
      )}
    </View>
  );
});

// ─── NAV ITEM ─────────────────────────────────────────────────────────────────
const NavItem = memo(function NavItem({
  icon, label, onPress,
}: { icon: React.ReactNode; label?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={ns.item} onPress={onPress} activeOpacity={0.65}>
      {icon}
      {!!label && <Text style={ns.label}>{label}</Text>}
    </TouchableOpacity>
  );
});

// ─── INNER ───────────────────────────────────────────────────────────────────
function CustomNavBarInner() {
  const router = _useRouter!();

  const [profile, setProfile] = useState<ProfileMini | null>(null);
  const [uid,     setUid]     = useState<string | null>(null);

  const rtRef     = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountId   = useRef(Date.now());
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDirty = useRef<string | null>(null);

  // ── ★ Fetch profil ─────────────────────────────────────────────────────
  const loadProfile = useCallback(async (deviceId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url,display_name,username')
        .eq('id', deviceId)
        .maybeSingle();
      if (data) {
        setProfile({
          avatar_url:   data.avatar_url   ?? '',
          display_name: data.display_name ?? '',
          username:     data.username     ?? '',
        });
      }
    } catch {}
  }, []);

  // ── ★ Init — UUID device (ZERO supabase.auth.*) ────────────────────────
  useEffect(() => {
    let alive = true;
    getDeviceId().then(deviceId => {
      if (!alive) return;
      setUid(deviceId);
      loadProfile(deviceId);
    });
    return () => {
      alive = false;
      if (rtRef.current)   { supabase.removeChannel(rtRef.current); rtRef.current  = null; }
      if (pollRef.current) { clearInterval(pollRef.current);        pollRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ★ Realtime — profiles UPDATE → avatar live ─────────────────────────
  // Tous les .on() AVANT .subscribe() (évite "cannot add callbacks after subscribe")
  useEffect(() => {
    if (!uid) return;
    if (rtRef.current) { supabase.removeChannel(rtRef.current); rtRef.current = null; }

    rtRef.current = supabase
      .channel(`nav_${mountId.current}_${uid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
        ({ new: row }) => {
          const r = row as any;
          setProfile(prev => ({
            avatar_url:   r.avatar_url   ?? prev?.avatar_url   ?? '',
            display_name: r.display_name ?? prev?.display_name ?? '',
            username:     r.username     ?? prev?.username     ?? '',
          }));
        },
      )
      .subscribe();

    return () => {
      if (rtRef.current) { supabase.removeChannel(rtRef.current); rtRef.current = null; }
    };
  }, [uid]);

  // ── ★ SecureStore polling (1.2s) — détecte save edit.tsx ───────────────
  // edit.tsx écrit SecureStore('profile_dirty', timestamp) → re-fetch
  useEffect(() => {
    if (!uid || !SecureStore || Platform.OS === 'web') return;

    pollRef.current = setInterval(async () => {
      try {
        const val = await SecureStore.getItemAsync('profile_dirty');
        if (val && val !== lastDirty.current) {
          lastDirty.current = val;
          loadProfile(uid);
        }
      } catch {}
    }, 1200);

    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [uid, loadProfile]);

  const go = useCallback((path: string) => {
    try { router.push(path as any); } catch {}
  }, [router]);

  return (
    <View style={ns.bar}>
      <BlurView intensity={Platform.OS === 'ios' ? 40 : 20} tint="dark" style={ns.blur}>

        {/* Accueil */}
        <NavItem
          icon={<Ionicons name="home-outline" size={22} color="rgba(255,255,255,0.78)"/>}
          label="Accueil"
          onPress={() => go('/search')}
        />

        {/* Véloces */}
        <NavItem
          icon={<MaterialCommunityIcons name="filmstrip" size={22} color="rgba(255,255,255,0.78)"/>}
          label="Véloces"
          onPress={() => go('/')}
        />

        {/* ★ Bouton central */}
        <TouchableOpacity style={ns.center} onPress={() => go('/create')} activeOpacity={0.75}>
          <MaterialCommunityIcons name="star-four-points" size={30} color="rgba(255,255,255,0.90)"/>
        </TouchableOpacity>

        {/* Amis */}
        <NavItem
          icon={<Ionicons name="people-outline" size={22} color="rgba(255,255,255,0.78)"/>}
          label="Amis"
          onPress={() => go('/social')}
        />

        {/* ★ Profil — avatar live mis à jour */}
        <NavItem
          icon={
        profile?.avatar_url ? (
          <NavAvatar profile={profile}/>
        ) : (
          <Ionicons name="person-circle-outline" size={26} color="rgba(255,255,255,0.78)"/>
        )
          }
          label="Profil"
          onPress={() => go('/profile')}
        />

      </BlurView>
    </View>
  );
}

// ─── EXPORT — monté après 1 tick ──────────────────────────────────────────────
function CustomNavBar() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ready || !_useRouter) return null;
  return <CustomNavBarInner/>;
}

export default memo(CustomNavBar);

// ─── STYLES — fidèles à la v4, sans shadow ni elevation ──────────────────────
const ns = StyleSheet.create({
  bar: {
    position:     'absolute',
    bottom:        12,
    left:          10,
    right:         10,
    height:        66,
    borderRadius:  20,
    overflow:     'hidden',
    borderWidth:   StyleSheet.hairlineWidth,
    borderColor:  'rgba(255,255,255,0.08)',
    // ★ Pas de shadowColor/elevation → brillance supprimée
  },
  blur: {
    flex:               1,
    flexDirection:     'row',
    justifyContent:    'space-around',
    alignItems:        'center',
    paddingHorizontal:  8,
    backgroundColor:   'rgba(3,0,10,0.30)',
  },
  item: {
    alignItems:        'center',
    justifyContent:    'center',
    height:            '100%',
    paddingTop:         6,
    paddingHorizontal:  6,
  },
  label: {
    color:         'rgba(255,255,255,0.55)',
    fontSize:       9.5,
    marginTop:      3,
    fontWeight:    '500',
    letterSpacing:  0.2,
  },
  center: {
    width:           52,
    height:          52,
    borderRadius:    26,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth:      StyleSheet.hairlineWidth,
    borderColor:     'rgba(255,255,255,0.12)',
  },
  avatarWrap: { width:26, height:26 },
  avatar:     { width:26, height:26, borderRadius:13 },
  monogram:   { backgroundColor:'rgba(13,32,64,0.80)', alignItems:'center', justifyContent:'center' },
  mono:       { color:'#FFFFFF', fontSize:9, fontWeight:'800' },
});