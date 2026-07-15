/**
 * components/reels/TopHeader.tsx — UNIVERSE · v2
 *
 * ★ Label feed complet affiché (ex : "Pour vous", "Tendances"…)
 * ★ "AMIS" supprimé — 3 cercles amis sans bordure noire (border transparent)
 * ★ Visible prop pour se masquer en plein écran
 * ★ Fetch depuis FRIENDS_POOL (mockData) — 3 avatars max
 */

import React, {
  memo, useCallback, useMemo, useEffect, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { Image }          from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';

import { type MenuKey }   from '../DropDownMenu';
import { supabase }        from '@/lib/supabase';
import { getDeviceId }    from '@/services/api';

// ── Haptics web-safe ──────────────────────────────────────────────────────
let _Haptics: any = null;
if (Platform.OS !== 'web') {
  try { _Haptics = require('expo-haptics'); } catch {}
}
function hapticLight() {
  _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Light).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  white:  '#FFFFFF',
  muted:  'rgba(255,255,255,0.45)',
  faint:  'rgba(255,255,255,0.22)',
  surf:   'rgba(255,255,255,0.10)',
  bg:     '#03000A',
  /** ★ Bordure transparente pour les cercles amis */
  avatarBorder: 'rgba(255,255,255,0.25)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface MenuItem { key: string; label: string; }

export interface TopHeaderProps {
  feedKey:      MenuKey;
  menuItems?:   MenuItem[];
  onMenuPress:  () => void;
  scrollY:      Animated.Value;
  /** Masquer/afficher (plein écran) */
  visible?:     boolean;
  /** Inset top pour safe area */
  insetTop?:    number;
}

const STATIC_LABELS: Record<string,string> = {
  foryou:   'Pour vous',
  trending: 'Tendances',
  original: 'Originaux',
  cannes:   'Sélection Cannes',
};

// ─────────────────────────────────────────────────────────────────────────────
// FRIENDS PILE — 3 cercles, sans label "Amis", bordure transparente
// ─────────────────────────────────────────────────────────────────────────────
const FriendsPile = memo(function FriendsPile({ onPress }: { onPress: () => void }) {
  const [liveProfiles, setLiveProfiles] = useState<{ id: string; avatar_url: string | null; display_name: string | null }[]>([]);

  useEffect(() => {
    let dead = false;
    getDeviceId().then(deviceId => {
      if (!deviceId || dead) return;
      supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', deviceId)
        .limit(3)
        .then(({ data: followData }) => {
          if (dead) return;
          const ids = (followData ?? []).map((r: any) => r.following_id).filter(Boolean);
          if (!ids.length) {
            // Fallback : top contributeurs si l'utilisateur ne suit personne encore
            supabase.from('profiles').select('id,avatar_url,display_name')
              .neq('id', deviceId).order('contribution_score', { ascending: false }).limit(3)
              .then(({ data }) => { if (!dead && data?.length) setLiveProfiles(data as any); }, () => {});
            return;
          }
          supabase.from('profiles').select('id,avatar_url,display_name')
            .in('id', ids).limit(3)
            .then(({ data }) => { if (!dead && data?.length) setLiveProfiles(data as any); }, () => {});
        }, () => {});
    }, () => {});
    return () => { dead = true; };
  }, []);

  const slots = useMemo(() => {
    const result: ({ type: 'avatar'; id: string; uri: string } | { type: 'initials'; id: string; initials: string })[] = [];
    for (let i = 0; i < 3; i++) {
      const p = liveProfiles[i];
      if (p?.avatar_url) {
        result.push({ type: 'avatar', id: p.id, uri: p.avatar_url });
      } else {
        const name = p?.display_name ?? '';
        const initials = name.trim()
          ? name.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
          : '?';
        result.push({ type: 'initials', id: p?.id ?? `slot-${i}`, initials });
      }
    }
    return result;
  }, [liveProfiles]);

  return (
    <TouchableOpacity style={fp.wrap} onPress={onPress} activeOpacity={0.75}>
      <View style={fp.pile}>
        {slots.map((slot: any, i) => (
          slot.type === 'avatar' ? (
            <Image
              key={slot.id}
              source={{ uri: slot.uri }}
              style={[fp.avatar, { marginLeft: i > 0 ? -9 : 0, zIndex: 10 - i }]}
              contentFit="cover"
            />
          ) : (
            <View key={slot.id}
              style={[fp.avatar, fp.initials, { marginLeft: i > 0 ? -9 : 0, zIndex: 10 - i }]}
            >
              <Text style={fp.initTxt}>{slot.initials}</Text>
            </View>
          )
        ))}
      </View>
    </TouchableOpacity>
  );
});

const fp = StyleSheet.create({
  wrap:   { flexDirection:'row', alignItems:'center' },
  pile:   { flexDirection:'row', alignItems:'center' },
  avatar: {
    width:30, height:30, borderRadius:15,
    /** ★ Bordure transparente (pas noire) */
    borderWidth:   1.5,
    borderColor:   T.avatarBorder,
    backgroundColor: T.surf,
  },
  initials: {
    alignItems:'center', justifyContent:'center',
    backgroundColor: 'rgba(90,130,210,0.30)',
  },
  initTxt: {
    color: T.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TOP HEADER
// ─────────────────────────────────────────────────────────────────────────────
const TopHeader = memo(function TopHeader({
  feedKey, menuItems = [], onMenuPress, scrollY,
  visible = true, insetTop = 0,
}: TopHeaderProps) {
  const router = useRouter();

  // ── Opacity animée (visible + scroll fade) ────────────────────────────────
  const visOp = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(visOp, {
      toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true,
    }).start();
  }, [visible, visOp]);

  const scrollOp = scrollY.interpolate({
    inputRange: [0, 100], outputRange: [1, 0.30], extrapolate: 'clamp',
  });

  // Combiner les deux opacités
  const opacity = Animated.multiply(visOp, scrollOp);

  // ── Label feed (texte complet) ────────────────────────────────────────────
  const feedLabel = useMemo(() => {
    const found = menuItems.find(m => m.key === feedKey);
    if (found)                  return found.label;
    if (STATIC_LABELS[feedKey]) return STATIC_LABELS[feedKey];
    return feedKey.charAt(0).toUpperCase() + feedKey.slice(1);
  }, [feedKey, menuItems]);

  const handleMenuPress  = useCallback(() => { hapticLight(); onMenuPress(); }, [onMenuPress]);
  const handleFriendsPress = useCallback(() => router.push('/(tabs)/social' as any), [router]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[s.container, { paddingTop: insetTop + 10 }, { opacity }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      {/* Gradient haut pour lisibilité */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.20)', 'transparent']}
        locations={[0, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.inner} pointerEvents="box-none">
        {/* ── Gauche : hamburger + label feed complet ── */}
        <TouchableOpacity
          onPress={handleMenuPress}
          style={s.leftBtn}
          activeOpacity={0.70}
          hitSlop={{ top:14, bottom:14, left:14, right:14 }}
        >
          <View style={s.hamburger}>
            <View style={[s.hLine, { width:20 }]}/>
            <View style={[s.hLine, { width:13 }]}/>
            <View style={[s.hLine, { width:20 }]}/>
          </View>
          {/* ★ Label complet, pas tronqué côté gauche */}
          <Text style={s.feedLabel}>{feedLabel}</Text>
          <Ionicons name="chevron-down" size={13} color={T.muted} style={{ marginTop:1 }}/>
        </TouchableOpacity>

        {/* ── Droite : 3 cercles amis (sans label "Amis") ── */}
        <FriendsPile onPress={handleFriendsPress}/>
      </View>
    </Animated.View>
  );
});

export default TopHeader;

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    position:   'absolute',
    top:         0,
    left:        0,
    right:       0,
    zIndex:      30,
    paddingBottom: 8,
  },
  inner: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 18,
    paddingVertical:   6,
  },
  leftBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            10,
    // ★ Pas de maxWidth restrictif — label s'affiche en entier
    flexShrink:     1,
    paddingRight:   12,
  },
  hamburger: { gap:4.5 },
  hLine:     { height:2.5, borderRadius:2, backgroundColor:T.white },
  feedLabel: {
    color:         T.white,
    fontSize:      16,
    fontWeight:    '700',
    letterSpacing: 0.2,
    // Texte en entier, pas de troncature
    flexShrink:    0,
    textShadowColor:  'rgba(0,0,0,0.50)',
    textShadowOffset: { width:0, height:1 },
    textShadowRadius: 4,
  },
});