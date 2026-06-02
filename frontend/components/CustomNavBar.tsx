/**
 * components/CustomNavBar.tsx — UNIVERSE
 *
 * ✦ Realtime profil via canal unique Date.now() → aucun conflit de subscription
 * ✦ Auth session récupérée une fois, listener onAuthStateChange pour les changements
 * ✦ Pas de shadow/elevation → fond blur subtil, bordure hairline
 * ✦ useRouter protégé (monté après 1 tick)
 * ✦ Callbacks mémorisés, re-renders minimaux
 */
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Platform,
} from 'react-native';
import { BlurView }                        from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase }                        from '@/lib/supabase';

// Chargements optionnels pour éviter les erreurs SSR / web
let _useRouter: (() => { push: (p: any) => void }) | null = null;
try { _useRouter = require('expo-router').useRouter; } catch {}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface ProfileMini {
  avatar_url:   string;
  display_name: string;
  username:     string;
}

// ─── UUID GUARD ───────────────────────────────────────────────────────────────
const isUUID = (v?: string | null): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ─── MINI AVATAR ─────────────────────────────────────────────────────────────
const NavAvatar = memo(function NavAvatar({ profile }: { profile: ProfileMini | null }) {
  const [imgErr, setImgErr] = useState(false);

  // Reset erreur quand l'URL change
  useEffect(() => { setImgErr(false); }, [profile?.avatar_url]);

  const name     = profile?.display_name || profile?.username || '?';
  const initials = name.trim().split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  if (profile?.avatar_url && !imgErr) {
    return (
      <View style={ns.avatarWrap}>
        <Image
          source={{ uri: profile.avatar_url }}
          style={ns.avatar}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      </View>
    );
  }

  return (
    <View style={[ns.avatarWrap, ns.monogramWrap]}>
      <Text style={ns.mono}>{initials}</Text>
    </View>
  );
});
NavAvatar.displayName = 'NavAvatar';

// ─── NAV ITEM ─────────────────────────────────────────────────────────────────
const NavItem = memo(function NavItem({
  icon, label, onPress, badge = 0,
}: {
  icon:    React.ReactNode;
  label?:  string;
  onPress: () => void;
  badge?:  number;
}) {
  return (
    <TouchableOpacity style={ns.item} onPress={onPress} activeOpacity={0.65}>
      <View style={{ position:'relative' }}>
        {icon}
        {badge > 0 && (
          <View style={ns.badge}>
            <Text style={ns.badgeTxt}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      {label && <Text style={ns.label}>{label}</Text>}
    </TouchableOpacity>
  );
});
NavItem.displayName = 'NavItem';

// ─── INNER ────────────────────────────────────────────────────────────────────
function CustomNavBarInner() {
  const router = _useRouter!();

  const [profile,  setProfile]  = useState<ProfileMini | null>(null);
  const [userId,   setUserId]   = useState<string | null>(null);

  // Ref pour le channel realtime — évite les fuites
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // ID unique par montage du composant → nom de channel toujours unique
  const mountId     = useRef(Date.now());

  // ── Fetch profil ──────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url,display_name,username')
      .eq('id', uid)
      .maybeSingle();
    if (data) setProfile(data as ProfileMini);
  }, []);

  // ── Auth init + listener ──────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      const uid = session?.user?.id;
      if (isUUID(uid)) { setUserId(uid); fetchProfile(uid); }
    }).catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, sess) => {
      if (!alive) return;
      const uid = sess?.user?.id;
      if (isUUID(uid)) { setUserId(uid); fetchProfile(uid); }
      else             { setUserId(null); setProfile(null); }
    });

    return () => { alive = false; subscription.unsubscribe(); };
  }, [fetchProfile]);

  // ── Realtime profil — canal unique par montage ─────────────────────────────
  //    Règle : tous les .on() AVANT .subscribe()
  //    Nom unique = pas de collision "cannot add callbacks after subscribe()"
  useEffect(() => {
    if (!isUUID(userId)) return;

    // Cleanup canal précédent
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const chName = `nav_${mountId.current}_${userId}`;

    channelRef.current = supabase
      .channel(chName)
      .on(
        'postgres_changes',
        { event:'UPDATE', schema:'public', table:'profiles', filter:`id=eq.${userId}` },
        ({ new: row }: any) => {
          setProfile(prev => ({
            avatar_url:   row.avatar_url   ?? prev?.avatar_url   ?? '',
            display_name: row.display_name ?? prev?.display_name ?? '',
            username:     row.username     ?? prev?.username     ?? '',
          }));
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const go = useCallback((path: string) => {
    try { router.push(path as any); } catch {}
  }, [router]);

  const goSearch  = useCallback(() => go('/search'),  [go]);
  const goReels   = useCallback(() => go('/'),        [go]);
  const goCreate  = useCallback(() => go('/create'),  [go]);
  const goSocial  = useCallback(() => go('/social'),  [go]);
  const goProfile = useCallback(() => go('/profile'), [go]);

  return (
    <View style={ns.bar}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 42 : 22}
        tint="dark"
        style={ns.blur}
      >
        {/* Accueil */}
        <NavItem
          icon={<Ionicons name="home-outline" size={22} color={ICON_COLOR} />}
          label="Accueil"
          onPress={goSearch}
        />

        {/* Véloces */}
        <NavItem
          icon={<MaterialCommunityIcons name="filmstrip" size={22} color={ICON_COLOR} />}
          label="Véloces"
          onPress={goReels}
        />

        {/* Bouton central */}
        <TouchableOpacity style={ns.center} onPress={goCreate} activeOpacity={0.75}>
          <MaterialCommunityIcons name="star-four-points" size={28} color="rgba(255,255,255,0.92)" />
        </TouchableOpacity>

        {/* Amis */}
        <NavItem
          icon={<Ionicons name="people-outline" size={22} color={ICON_COLOR} />}
          label="Amis"
          onPress={goSocial}
        />

        {/* Profil */}
        <TouchableOpacity style={ns.item} onPress={goProfile} activeOpacity={0.65}>
          {profile
            ? <NavAvatar profile={profile} />
            : <View style={ns.avatarWrap}>
                <Ionicons name="person-circle-outline" size={26} color={ICON_COLOR} />
              </View>
          }
          <Text style={ns.label}>Profil</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
// Monté après 1 tick — laisse le contexte expo-router s'initialiser
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

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const ICON_COLOR = 'rgba(255,255,255,0.78)';

// ─── STYLES ───────────────────────────────────────────────────────────────────
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
    // Pas de shadow/elevation — fond blur seul suffit
  },

  blur: {
    flex:            1,
    flexDirection:   'row',
    justifyContent:  'space-around',
    alignItems:      'center',
    backgroundColor: 'rgba(3,0,10,0.68)',
  },

  item: {
    alignItems:        'center',
    justifyContent:    'center',
    height:            '100%',
    paddingTop:         6,
    paddingHorizontal:  8,
    gap:               3,
  },

  label: {
    color:         'rgba(255,255,255,0.78)',
    fontSize:       9.5,
    fontWeight:    '500',
    letterSpacing:  0.2,
  },

  // Bouton central
  center: {
    width:           52,
    height:          52,
    borderRadius:    26,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth:      StyleSheet.hairlineWidth,
    borderColor:     'rgba(255,255,255,0.13)',
  },

  // Avatar
  avatarWrap:   { width:26, height:26, borderRadius:13, overflow:'hidden', alignItems:'center', justifyContent:'center' },
  avatar:       { width:26, height:26, borderRadius:13 },
  monogramWrap: { backgroundColor:'rgba(13,32,64,0.85)' },
  mono:         { color:'#FFFFFF', fontSize:9, fontWeight:'800' },

  // Badge notification
  badge: {
    position:        'absolute',
    top:             -4,
    right:           -6,
    minWidth:         14,
    height:           14,
    borderRadius:     7,
    backgroundColor: 'rgba(255,255,255,0.90)',
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 2,
  },
  badgeTxt: { color:'#07001A', fontSize:7, fontWeight:'900' },
});