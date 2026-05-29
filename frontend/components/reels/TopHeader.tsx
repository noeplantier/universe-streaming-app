/**
 * components/reels/TopHeader.tsx — UNIVERSE · v3
 *
 * ★ GAUCHE  : hamburger + label feed COMPLET (ex: "Pour vous") sans troncature
 * ★ DROITE  : pile de 3 avatars amis (FRIENDS_POOL) — sans label "Amis"
 *             border semi-transparent (plus de border #03000A opaque)
 * ★ Scroll  : opacity fade conservé
 */

import React, {
  memo, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { Image }     from 'expo-image';
import { Ionicons }  from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { type MenuKey } from '../DropDownMenu';
import { FRIENDS_POOL } from './mockData';

// ── Haptics web-safe ──────────────────────────────────────────────────────────
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
  bg:     '#03000A',
  border: 'rgba(255,255,255,0.18)', // ★ border semi-transparent
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
// FALLBACK LABELS
// ─────────────────────────────────────────────────────────────────────────────
const STATIC_LABELS: Record<string, string> = {
  foryou:   'Pour vous',
  trending: 'Tendances',
  original: 'Originaux',
  cannes:   'Sélection Cannes',
};

// ─────────────────────────────────────────────────────────────────────────────
// ★ FRIENDS PILE — 3 cercles, sans label, border transparent
// ─────────────────────────────────────────────────────────────────────────────
const FriendsPile = memo(function FriendsPile({ onPress }: { onPress: () => void }) {
  // Toujours 3 avatars (compléter avec fallback si pool < 3)
  const visible = FRIENDS_POOL.slice(0, 3);

  return (
    <TouchableOpacity
      style={fp.wrap}
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={{ top:12, bottom:12, left:12, right:12 }}
    >
      {visible.map((f, i) => (
        <View
          key={f.id}
          style={[
            fp.avatarRing,
            { marginLeft: i > 0 ? -11 : 0, zIndex: 10 - i },
          ]}
        >
          {f.avatar ? (
            <Image
              source={{ uri: f.avatar }}
              style={fp.avatarImg}
              contentFit="cover"
            />
          ) : (
            // Fallback initiales si pas d'avatar
            <View style={fp.avatarFallback}>
              <Text style={fp.avatarInitial}>
                {(f.name ?? f.username ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      ))}
    </TouchableOpacity>
  );
});

const fp = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  // Anneau extérieur — border semi-transparent
  avatarRing: {
    width:         34,
    height:        34,
    borderRadius:  17,
    borderWidth:    2,
    borderColor:   T.border,   // ★ semi-transparent
    overflow:      'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatarImg: {
    width:  30,
    height: 30,
  },
  avatarFallback: {
    width:           30,
    height:          30,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatarInitial: {
    color:      T.white,
    fontSize:   13,
    fontWeight: '700',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TOP HEADER
// ─────────────────────────────────────────────────────────────────────────────
const TopHeader = memo(function TopHeader({
  feedKey, menuItems = [], onMenuPress, scrollY,
}: TopHeaderProps) {
  const router = useRouter();

  // ── Label feed complet — aucune troncature forcée ─────────────────────────
  const feedLabel = useMemo(() => {
    const found = menuItems.find(m => m.key === feedKey);
    if (found)                   return found.label;
    if (STATIC_LABELS[feedKey])  return STATIC_LABELS[feedKey];
    return feedKey.charAt(0).toUpperCase() + feedKey.slice(1);
  }, [feedKey, menuItems]);

  // ── Scroll fade ───────────────────────────────────────────────────────────
  const opacity = scrollY.interpolate({
    inputRange: [0, 100], outputRange: [1, 0.35], extrapolate: 'clamp',
  });

  const handleMenuPress    = useCallback(() => { hapticLight(); onMenuPress(); }, [onMenuPress]);
  const handleFriendsPress = useCallback(() => router.push('/(tabs)/social' as any), [router]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[s.container, { opacity }]} pointerEvents="box-none">

      {/* ── Gauche : hamburger + label feed complet ── */}
      <TouchableOpacity
        onPress={handleMenuPress}
        style={s.leftBtn}
        activeOpacity={0.70}
        hitSlop={{ top:14, bottom:14, left:14, right:14 }}
      >
        <View style={s.hamburger}>
          <View style={[s.hLine, { width: 20 }]} />
          <View style={[s.hLine, { width: 13 }]} />
          <View style={[s.hLine, { width: 20 }]} />
        </View>

        {/* ★ Label complet — pas de maxWidth restrictif, wrap naturel */}
        <Text style={s.feedLabel}>
          {feedLabel}
        </Text>

        <Ionicons
          name="chevron-down"
          size={13}
          color={T.muted}
          style={{ marginTop: 1 }}
        />
      </TouchableOpacity>

      {/* ── Droite : pile de 3 avatars amis (sans label) ── */}
      <FriendsPile onPress={handleFriendsPress} />

    </Animated.View>
  );
});

export default TopHeader;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   10,
  },

  leftBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    // ★ flex:1 + shrink=1 → le label prend tout l'espace disponible
    //   sans mordre sur la pile d'avatars
    flex:          1,
    marginRight:   16,
  },

  hamburger: {
    gap:       4.5,
    flexShrink: 0, // ne se compresse jamais
  },

  hLine: {
    height:          2.5,
    borderRadius:    2,
    backgroundColor: T.white,
  },

  feedLabel: {
    color:         T.white,
    fontSize:      16,
    fontWeight:    '700',
    letterSpacing: 0.2,
    flexShrink:    1,
    // ★ Pas de numberOfLines={1} → affichage complet si le label est long
  },
});