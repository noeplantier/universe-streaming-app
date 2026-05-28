/**
 * components/CustomNavBar.tsx — UNIVERSE · DYNAMIC AVATAR
 *
 * ★ Avatar dynamique depuis Supabase profiles.avatar_url
 * ★ Realtime : se met à jour quand edit.tsx upload une nouvelle photo
 * ★ Monogramme (initiales) si pas d'avatar ou erreur de chargement
 * ★ Auth state subscription
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
} from 'react-native';
import { BlurView }  from 'expo-blur';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

// Import des tokens si disponibles, sinon fallback
let C: any = { navyMid: '#0D2040' };
try { C = require('./create/tokens').C; } catch {}

interface ProfileMini { avatar_url: string; display_name: string; username: string }

// ─── ★ AVATAR OR MONOGRAM ─────────────────────────────────────────────────────
const NavAvatar = memo(({ profile }: { profile: ProfileMini | null }) => {
  const [imgErr, setImgErr] = useState(false);

  // Reset error when avatar changes
  useEffect(() => { setImgErr(false); }, [profile?.avatar_url]);

  const name = profile?.display_name || profile?.username || '?';
  const initials = name.trim().split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const hasAvatar = !!profile?.avatar_url && !imgErr;

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
          <Text style={ns.mono}>{initials}</Text>
        </View>
      )}
    </View>
  );
});

// ─── NAV ITEM ─────────────────────────────────────────────────────────────────
type NavItemProps = { icon: React.ReactNode; label?: string; onPress: () => void };
const NavItem = memo(({ icon, label, onPress }: NavItemProps) => (
  <TouchableOpacity style={ns.navItem} onPress={onPress} activeOpacity={0.7}>
    {icon}
    {label && <Text style={ns.navLabel}>{label}</Text>}
  </TouchableOpacity>
));

// ─── MAIN NAVBAR ──────────────────────────────────────────────────────────────
function CustomNavBar() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileMini | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // ★ Auth + fetch profile
  useEffect(() => {
    let mounted = true;

    const fetchProfile = async (uid: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url,display_name,username')
        .eq('id', uid)
        .maybeSingle();
      if (mounted && data) setProfile(data as ProfileMini);
    };

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session?.user?.id) {
          setUserId(session.user.id);
          fetchProfile(session.user.id);
        }
      } catch (e) { /* silent */ }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      if (!mounted) return;
      if (s?.user?.id) {
        setUserId(s.user.id);
        fetchProfile(s.user.id);
      } else {
        setUserId(null);
        setProfile(null);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // ★ Realtime — MAJ immédiate quand edit.tsx upload un avatar
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`nav_profile_${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      }, ({ new: row }) => {
        const r = row as any;
        setProfile(prev => ({
          avatar_url: r.avatar_url ?? prev?.avatar_url ?? '',
          display_name: r.display_name ?? prev?.display_name ?? '',
          username: r.username ?? prev?.username ?? '',
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const navigate = useCallback((path: string) => { router.push(path); }, [router]);

  return (
    <View style={ns.container}>
      <BlurView intensity={30} tint="dark" style={ns.blur}>
        <NavItem
          icon={<Ionicons name="home" size={24} color="white" />}
          label="Accueil"
          onPress={() => navigate('/search')}
        />
        <NavItem
          icon={<MaterialCommunityIcons name="filmstrip" size={24} color="white" />}
          label="Véloces"
          onPress={() => navigate('/')}
        />
        {/* ★ Bouton central */}
        <TouchableOpacity
          style={ns.centerButton}
          onPress={() => navigate('/create')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="star-four-points" size={36} color="white" />
        </TouchableOpacity>
        <NavItem
          icon={<Ionicons name="people" size={24} color="white" />}
          label="Amis"
          onPress={() => navigate('/social')}
        />
        {/* ★ Avatar dynamique (photo ou monogramme) */}
        <TouchableOpacity
          style={ns.navItem}
          onPress={() => navigate('/profile')}
          activeOpacity={0.7}
        >
          <NavAvatar profile={profile} />
          <Text style={ns.navLabel}>Profil</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

export default memo(CustomNavBar);

// ─── STYLES ───────────────────────────────────────────────────────────────────
const ns = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 12, left: 10, right: 10, height: 70,
    borderRadius: 20, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', zIndex: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 20,
  },
  blur: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-around',
    alignItems: 'center', paddingHorizontal: 10,
  },
  navItem: {
    alignItems: 'center', justifyContent: 'center',
    height: '100%', paddingTop: 8, paddingBottom: 0,
  },
  navLabel: { color: 'white', fontSize: 10, marginTop: 4, fontWeight: '500' },
  centerButton: {
    width: 60, height: 60, borderRadius: 30, marginTop: 4,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(70,130,180,0.3)', borderWidth: 1,
    borderColor: C.navyMid, shadowColor: C.navyMid,
    shadowRadius: 10, shadowOpacity: 0.6, elevation: 10,
  },
  avatarWrap: { width: 28, height: 28 },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.navyMid },
  monogram: {
    backgroundColor: '#0D2040', alignItems: 'center', justifyContent: 'center',
  },
  mono: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});