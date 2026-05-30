/**
 * components/CustomNavBar.tsx — UNIVERSE · v4
 *
 * ★ Brillance supprimée (shadowColor, shadowOpacity, shadowRadius, elevation retirés)
 * ★ Design épuré : fond blur subtil, bordure fine semi-transparente
 * ★ useRouter protégé (CustomNavBarInner monté après 1 tick)
 * ★ .on() AVANT .subscribe() sur le channel Realtime
 * ★ Callbacks mémorisés, re-renders minimisés
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Platform,
} from 'react-native';
import { BlurView }  from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

let _useRouter: (() => { push: (p: any) => void }) | null = null;
try { _useRouter = require('expo-router').useRouter; } catch {}

let C: any = { navyMid: '#0D2040' };
try { C = require('./create/tokens').C; } catch {}

interface ProfileMini { avatar_url: string; display_name: string; username: string }

// ─── AVATAR ───────────────────────────────────────────────────────────────────
const NavAvatar = memo(function NavAvatar({ profile }: { profile: ProfileMini | null }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => { setImgErr(false); }, [profile?.avatar_url]);

  const name     = profile?.display_name || profile?.username || '?';
  const initials = name.trim().split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const hasAvatar = !!profile?.avatar_url && !imgErr;

  if (hasAvatar) {
    return (
      <View style={ns.avatarWrap}>
        <Image
          source={{ uri: profile!.avatar_url }}
          style={ns.avatar}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      </View>
    );
  }

  return (
    <View style={ns.avatarWrap}>
      <View style={[ns.avatar, ns.monogram]}>
        <Text style={ns.mono}>{initials}</Text>
      </View>
    </View>
  );
});

// ─── NAV ITEM ─────────────────────────────────────────────────────────────────
const NavItem = memo(function NavItem({ icon, label, onPress }: {
  icon: React.ReactNode; label?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={ns.item} onPress={onPress} activeOpacity={0.65}>
      {icon}
      {label && <Text style={ns.label}>{label}</Text>}
    </TouchableOpacity>
  );
});

// ─── INNER ────────────────────────────────────────────────────────────────────
function CustomNavBarInner() {
  const router = _useRouter!();
  const [profile, setProfile] = useState<ProfileMini | null>(null);
  const [userId,  setUserId]  = useState<string | null>(null);

  // Auth + profil initial
  useEffect(() => {
    let alive = true;

    async function fetchProfile(uid: string) {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url,display_name,username')
        .eq('id', uid)
        .maybeSingle();
      if (alive && data) setProfile(data as ProfileMini);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      if (session?.user?.id) {
        setUserId(session.user.id);
        fetchProfile(session.user.id);
      }
    }).catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      if (!alive) return;
      if (s?.user?.id) {
        setUserId(s.user.id);
        fetchProfile(s.user.id);
      } else {
        setUserId(null);
        setProfile(null);
      }
    });

    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  // Realtime avatar — .on() AVANT .subscribe()
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`nav_${userId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
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
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const go = useCallback((path: string) => {
    try { router.push(path as any); } catch {}
  }, [router]);

  return (
    <View style={ns.bar}>
      <BlurView intensity={Platform.OS === 'ios' ? 40 : 20} tint="dark" style={ns.blur}>
        {/* Accueil */}
        <NavItem
          icon={<Ionicons name="home-outline" size={22} color="rgba(255,255,255,0.78)" />}
          label="Accueil"
          onPress={() => go('/search')}
        />

        {/* Véloces */}
        <NavItem
          icon={<MaterialCommunityIcons name="filmstrip" size={22} color="rgba(255,255,255,0.78)" />}
          label="Véloces"
          onPress={() => go('/')}
        />

        {/* Bouton central — sans brillance */}
        <TouchableOpacity
          style={ns.center}
          onPress={() => go('/create')}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="star-four-points" size={30} color="rgba(255,255,255,0.90)" />
        </TouchableOpacity>

        {/* Amis */}
        <NavItem
          icon={<Ionicons name="people-outline" size={22} color="rgba(255,255,255,0.78)" />}
          label="Amis"
          onPress={() => go('/social')}
        />

        {/* Profil */}
        <TouchableOpacity style={ns.item} onPress={() => go('/profile')} activeOpacity={0.65}>
          <NavAvatar profile={profile} />
          <Text style={ns.label}>Profil</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
// Monté après 1 tick pour laisser le contexte de navigation s'initialiser
function CustomNavBar() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ready || !_useRouter) return null;
  return <CustomNavBarInner />;
}

export default memo(CustomNavBar);

// ─── STYLES ───────────────────────────────────────────────────────────────────
const ns = StyleSheet.create({
  bar: {
    position:    'absolute',
    bottom:       12,
    left:         10,
    right:        10,
    height:       66,
    borderRadius: 20,
    overflow:    'hidden',
    // ★ Pas de shadow/elevation → brillance supprimée
    borderWidth:  StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  blur: {
    flex:           1,
    flexDirection:  'row',
    justifyContent: 'space-around',
    alignItems:     'center',
    // Fond très légèrement teinté pour séparer la barre du contenu
    backgroundColor: 'rgba(3, 0, 10, 0.68)',
  },
  item: {
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100%',
    paddingTop:      6,
    paddingHorizontal: 6,
  },
  label: {
    color:      'rgb(255, 255, 255)',
    fontSize:    9.5,
    marginTop:   3,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // Bouton central — cercle simple sans brillance
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

  // Avatar
  avatarWrap: { width: 26, height: 26 },
  avatar:     { width: 26, height: 26, borderRadius: 13 },
  monogram:   { backgroundColor: 'rgba(13,32,64,0.80)', alignItems: 'center', justifyContent: 'center' },
  mono:       { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});