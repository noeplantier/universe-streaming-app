/**
 * components/reels/TopHeader.tsx
 *
 * Header du feed — Universe
 *
 *  GAUCHE   : hamburger + label du feed actif
 *  CENTRE   : avatar (gradient ring) + stats films / critiques / créas
 *             fetch depuis public.profiles + user_favorites + critiques + reels
 *  DROITE   : "Amis" + pile d'avatars (FRIENDS_POOL mockData) + globe
 *  SCROLL   : opacity fade sur scroll
 */

import React, {
  memo, useEffect, useState, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform,
} from 'react-native';
import { Image }          from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';

import { type MenuKey }   from '../DropDownMenu';
import { FRIENDS_POOL }   from './mockData';

// ── Haptics web-safe ──────────────────────────────────────────────────────────
let _Haptics: any = null;
if (Platform.OS !== 'web') {
  try { _Haptics = require('expo-haptics'); } catch {}
}
function hapticLight() {
  _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Light).catch(() => {});
}

// ── ImageWithFallback web-safe ────────────────────────────────────────────────
let _ImageWithFallback: any = null;
try { _ImageWithFallback = require('@/components/profile/ImageWithFallback').ImageWithFallback; } catch {}

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  white:   '#FFFFFF',
  muted:   'rgba(255,255,255,0.45)',
  faint:   'rgba(255,255,255,0.22)',
  border:  'rgba(255,255,255,0.12)',
  surf:    'rgba(255,255,255,0.10)',
  gold:    '#F5C842',
  bg:      '#03000A',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface MenuItem {
  key:   string;
  label: string;
}

interface TopHeaderProps {
  feedKey:     MenuKey;
  menuItems?:  MenuItem[];
  onMenuPress: () => void;
  scrollY:     Animated.Value;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC LABEL FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
const STATIC_LABELS: Record<string,string> = {
  foryou:'Pour vous', trending:'Tendances',
  original:'Originaux', cannes:'Sélection Cannes',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────
function fmtN(n: number): string {
  if (n >= 1000) return `${(n/1000).toFixed(1)}K`;
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const _sOp = new Animated.Value(0.18);
let _sGo = false;
function startShimmer() {
  if (_sGo) return; _sGo = true;
  Animated.loop(Animated.sequence([
    Animated.timing(_sOp, { toValue:0.42, duration:750, useNativeDriver:true }),
    Animated.timing(_sOp, { toValue:0.18, duration:750, useNativeDriver:true }),
  ])).start();
}
function Shimmer({ w, h, r=6 }: { w:number; h:number; r?:number }) {
  useEffect(() => startShimmer(), []);
  return <Animated.View style={{ width:w, height:h, borderRadius:r, backgroundColor:'rgba(255,255,255,0.09)', opacity:_sOp }}/>;
}


// ─────────────────────────────────────────────────────────────────────────────
// FRIENDS PILE — avatars depuis FRIENDS_POOL (mockData) + globe
// ─────────────────────────────────────────────────────────────────────────────
const FriendsPile = memo(function FriendsPile({ onPress }: { onPress:()=>void }) {
  const visible = FRIENDS_POOL.slice(0, 2);
  return (
    <TouchableOpacity style={fp.wrap} onPress={onPress} activeOpacity={0.75}>
      <Text style={fp.label}>Amis</Text>
      <View style={fp.pile}>
        {visible.map((f, i) => (
          <Image
            key={f.id}
            source={{ uri: f.avatar }}
            style={[fp.avatar, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}
            contentFit="cover"
          />
        ))}
        {/* Globe 🌍 — comme dans la version originale */}
        <View style={[fp.avatar, fp.globe, { marginLeft: -10, zIndex: 0 }]}>
          <Text style={{ fontSize: 12 }}>🌍</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const fp = StyleSheet.create({
  wrap:   { flexDirection:'row', alignItems:'center', gap:10 },
  label:  { color:T.muted, fontSize:15, fontWeight:'600' },
  pile:   { flexDirection:'row', alignItems:'center' },
  avatar: { width:32, height:32, borderRadius:16, borderWidth:2, borderColor:T.bg },
  globe:  { backgroundColor:T.surf, alignItems:'center', justifyContent:'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// TOP HEADER
// ─────────────────────────────────────────────────────────────────────────────
const TopHeader = memo(function TopHeader({
  feedKey, menuItems = [], onMenuPress, scrollY,
}: TopHeaderProps) {
  const router = useRouter();

  // Stats supprimées du TopHeader → déplacées dans DropdownMenu

  // ── Feed label ─────────────────────────────────────────────────────────────
  const feedLabel = useMemo(() => {
    const found = menuItems.find(m => m.key === feedKey);
    if (found)              return found.label;
    if (STATIC_LABELS[feedKey]) return STATIC_LABELS[feedKey];
    return feedKey.charAt(0).toUpperCase() + feedKey.slice(1);
  }, [feedKey, menuItems]);

  // Stats profil → dans DropdownMenu · Amis → FRIENDS_POOL mockData

  // ── Scroll fade ────────────────────────────────────────────────────────────
  const opacity = scrollY.interpolate({
    inputRange:[0,100], outputRange:[1,0.35], extrapolate:'clamp',
  });

  const handleMenuPress = useCallback(() => { hapticLight(); onMenuPress(); }, [onMenuPress]);
  const handleFriendsPress = useCallback(() => router.push('/(tabs)/social' as any), [router]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[s.container, { opacity }]} pointerEvents="box-none">

      {/* ── Gauche : hamburger + label ── */}
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
        <Text style={s.feedLabel} numberOfLines={1}>{feedLabel}</Text>
        <Ionicons name="chevron-down" size={13} color={T.muted} style={{ marginTop:1 }}/>
      </TouchableOpacity>

      {/* ── Droite : amis + globe (FRIENDS_POOL) ── */}
      <FriendsPile onPress={handleFriendsPress}/>

    </Animated.View>
  );
});

export default TopHeader;

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:10 },
  leftBtn:    { flexDirection:'row', alignItems:'center', gap:10, maxWidth:'30%' },
  hamburger:  { gap:4.5 },
  hLine:      { height:2.5, borderRadius:2, backgroundColor:T.white },
  feedLabel:  { color:T.white, fontSize:16, fontWeight:'700', letterSpacing:0.2, flexShrink:1 },
});