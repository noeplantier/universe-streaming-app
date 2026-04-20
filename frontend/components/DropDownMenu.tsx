// components/reels/DropdownMenu.tsx
// ─────────────────────────────────────────────────────────────────────────────
//  Menu latéral gauche — C.navyMid dominant · icônes blanches · transparent
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  memo, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Animated, Easing, Dimensions, ScrollView, PanResponder, Platform,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics       from 'expo-haptics';

import { C } from '@/components/create/tokens';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// PROFIL MOCK (avatar conservé)
// ─────────────────────────────────────────────────────────────────────────────
const USER_PROFILE = {
  name:      'Hugo Chassaing',
  handle:    '@hugo.chassaing',
  avatar:    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJAonSMhABsc42klQbsziDZ0ga-xmluRvfLQ&s',
  films:     247,
  watchlist: 38,
  niveau:    'Cinéphile',
};

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 TOKENS — blanc pur sur navyMid, aucune couleur vive
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:       C.navyMid,
  text:     'rgba(255,255,255,0.88)',
  textSec:  'rgba(255,255,255,0.45)',
  textTert: 'rgba(255,255,255,0.22)',
  surf:     'rgba(255,255,255,0.05)',
  surfHi:   'rgba(255,255,255,0.09)',
  border:   'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.13)',
  active:   'rgba(255,255,255,0.07)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CATALOGUE GENRES
// ─────────────────────────────────────────────────────────────────────────────
export const MENU_ITEMS = [
  { icon: 'play-circle-outline',   label: 'Pour vous',        key: 'foryou'   },
  { icon: 'film-outline',          label: 'Courts métrages',  key: 'short'    },
  { icon: 'heart-outline',         label: 'Drame',            key: 'drama'    },
  { icon: 'planet-outline',        label: 'Science-Fiction',  key: 'scifi'    },
  { icon: 'rose-outline',          label: 'Romance',          key: 'romance'  },
  { icon: 'skull-outline',         label: 'Thriller',         key: 'thriller' },
  { icon: 'sparkles-outline',      label: 'Films ORIGINAL',   key: 'original' },
  { icon: 'trophy-outline',        label: 'Sélection Cannes', key: 'cannes'   },
  { icon: 'color-wand-outline',    label: 'Fantasy',          key: 'fantasy'  },
  { icon: 'camera-outline',        label: 'Documentaire',     key: 'docu'     },
  { icon: 'brush-outline',         label: 'Animation',        key: 'anim'     },
  { icon: 'flame-outline',         label: 'Tendances',        key: 'trend'    },
] as const;

export type MenuKey = typeof MENU_ITEMS[number]['key'];

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window');
const PANEL_W = Math.min(W * 0.80, 320);

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface DropdownMenuProps {
  visible:   boolean;
  onClose:   () => void;
  onSelect:  (key: MenuKey) => void;
  activeKey: MenuKey;
}

interface UserProfile {
  display_name: string;
  username:     string;
  avatar_url:   string;
  films_seen?:  number;
  watchlist?:   number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU ITEM ROW
// ─────────────────────────────────────────────────────────────────────────────
interface MenuItemRowProps {
  item:      typeof MENU_ITEMS[number];
  isActive:  boolean;
  onPress:   () => void;
  slideAnim: Animated.Value;
}

const MenuItemRow = memo(function MenuItemRow({ item, isActive, onPress, slideAnim }: MenuItemRowProps) {
  const tx = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const op = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={{ transform: [{ translateX: tx }], opacity: op }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.65}
        style={[s.item, isActive && s.itemActive]}
      >
        {/* Barre active gauche */}
        {isActive && <View style={s.accentBar} />}

        {/* Icône */}
        <View style={[s.iconWrap, isActive && s.iconWrapActive]}>
          <Ionicons
            name={item.icon as any}
            size={18}
            color={isActive ? T.text : T.textSec}
          />
        </View>

        {/* Label */}
        <Text style={[s.itemLabel, isActive && s.itemLabelActive]} numberOfLines={1}>
          {item.label}
        </Text>

        {/* Chevron si actif */}
        {isActive && (
          <Ionicons name="chevron-forward" size={13} color={T.textTert} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});
MenuItemRow.displayName = 'MenuItemRow';

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE HEADER — avatar conservé, stats row, textes blancs
// ─────────────────────────────────────────────────────────────────────────────
const ProfileHeader = memo(function ProfileHeader({ statsAnim }: { statsAnim: Animated.Value }) {
  const ty = statsAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View style={[s.profileSection, { opacity: statsAnim, transform: [{ translateY: ty }] }]}>
      {/* Avatar + identité */}
      <View style={s.profileRow}>
        <View style={s.avatarWrap}>
          <Image source={{ uri: USER_PROFILE.avatar }} style={s.avatar} />
          <View style={s.onlineDot} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.profileName}>{USER_PROFILE.name}</Text>
          <Text style={s.profileHandle}>{USER_PROFILE.handle}</Text>
          <Text style={s.profileNiveau}>{USER_PROFILE.niveau}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statBlock}>
          <Text style={s.statVal}>{USER_PROFILE.films}</Text>
          <Text style={s.statLbl}>Films vus</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBlock}>
          <Text style={s.statVal}>{USER_PROFILE.watchlist}</Text>
          <Text style={s.statLbl}>Watchlist</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBlock}>
          <Text style={s.statVal}>★</Text>
          <Text style={s.statLbl}>{USER_PROFILE.niveau}</Text>
        </View>
      </View>
    </Animated.View>
  );
});
ProfileHeader.displayName = 'ProfileHeader';

// ─────────────────────────────────────────────────────────────────────────────
// DROPDOWN MENU
// ─────────────────────────────────────────────────────────────────────────────
const DropdownMenu = memo(function DropdownMenu({
  visible, onClose, onSelect, activeKey,
}: DropdownMenuProps) {
  const slideX    = useRef(new Animated.Value(-PANEL_W)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(MENU_ITEMS.map(() => new Animated.Value(0))).current;

  // ── Swipe-to-close ──────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -15 && Math.abs(g.dy) < 40,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) slideX.setValue(Math.max(g.dx, -PANEL_W));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -60 || g.vx < -0.6) {
          onClose();
        } else {
          Animated.spring(slideX, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 4 }).start();
        }
      },
    }),
  ).current;

  // ── Animations ouverture/fermeture ──────────────────────────────────────
  useEffect(() => {
    if (visible) {
      itemAnims.forEach(a => a.setValue(0));
      statsAnim.setValue(0);
      slideX.setValue(0);
      bgOpacity.setValue(0.55);

      Animated.parallel([
        Animated.stagger(12, itemAnims.map(a =>
          Animated.timing(a, { toValue: 1, duration: 150, useNativeDriver: true }),
        )),
        Animated.timing(statsAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      slideX.setValue(-PANEL_W);
      bgOpacity.setValue(0);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((key: MenuKey) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(key);
    onClose();
  }, [onSelect, onClose]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, s.backdrop, { opacity: bgOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[s.panel, { transform: [{ translateX: slideX }] }]}
        {...panResponder.panHandlers}
      >
        {/* Fond blur + navyMid */}
        <BlurView intensity={Platform.OS === 'ios' ? 50 : 20} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[C.navyMid, `${C.navyMid}F2`]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Bord droit décoratif */}
        <View style={s.edgeLine} />

        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>

          {/* ── Profil ── */}
          <ProfileHeader statsAnim={statsAnim} />

          {/* ── Séparateur ── */}
          <View style={s.sep} />

          {/* ── Label section ── */}
          <Text style={s.sectionLabel}>MON UNIVERS</Text>

          {/* ── Items ── */}
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            {MENU_ITEMS.map((item, idx) => (
              <MenuItemRow
                key={item.key}
                item={item}
                isActive={activeKey === item.key}
                onPress={() => handleSelect(item.key as MenuKey)}
                slideAnim={itemAnims[idx]}
              />
            ))}
          </ScrollView>

          {/* ── Footer ── */}
          <View style={s.footer}>
            <View style={s.footerLine} />
            <Text style={s.footerBrand}>UNIVERSE</Text>
            <Text style={s.footerSub}>Cinéma Indépendant · Beta</Text>
          </View>

        </SafeAreaView>
      </Animated.View>
    </View>
  );
});

export default DropdownMenu;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },

  panel: {
    position:         'absolute',
    left: 0, top: 0, bottom: 0,
    width:            PANEL_W,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: T.border,
    overflow:         'hidden',
    shadowColor:      '#000',
    shadowOffset:     { width: 6, height: 0 },
    shadowOpacity:    0.25,
    shadowRadius:     20,
    elevation:        18,
  },

  edgeLine: {
    position:        'absolute',
    right:            0, top: 0, bottom: 0,
    width:            StyleSheet.hairlineWidth,
    backgroundColor: T.borderHi,
  },

  // Profil
  profileSection: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 },
  profileRow:     { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 14 },
  avatarWrap:     { position: 'relative' },
  avatar:         { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: T.borderHi },
  avatarFallback: { backgroundColor: T.surf, alignItems: 'center', justifyContent: 'center' },
  onlineDot:      { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 2, borderColor: C.navyMid },
  profileName:    { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  profileHandle:  { color: 'rgba(255,255,255,0.50)', fontSize: 12, fontWeight: '500' },
  profileNiveau:  { color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },

  statsRow:    { flexDirection: 'row', backgroundColor: T.surf, borderRadius: 14, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  statBlock:   { flex: 1, alignItems: 'center', gap: 3 },
  statVal:     { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  statLbl:     { color: 'rgba(255,255,255,0.30)', fontSize: 9, fontWeight: '600', textAlign: 'center', letterSpacing: 0.5 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: T.border, marginVertical: 4 },

  // Section
  sep:          { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginHorizontal: 20, marginBottom: 10 },
  sectionLabel: { color: T.textTert, fontSize: 9, fontWeight: '700', letterSpacing: 2.2, paddingHorizontal: 20, marginBottom: 4 },

  // Items
  item:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12, overflow: 'hidden' },
  itemActive:     { backgroundColor: T.active },
  accentBar:      { position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 2 },
  iconWrap:       { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surf, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border },
  iconWrapActive: { backgroundColor: T.surfHi, borderColor: T.borderHi },
  itemLabel:      { flex: 1, color: T.textSec, fontSize: 14, fontWeight: '500' },
  itemLabelActive:{ color: T.text, fontWeight: '700' },

  // Footer
  footer:      { paddingHorizontal: 20, paddingBottom: 10, paddingTop: 14, gap: 3, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border },
  footerLine:  { width: 20, height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginBottom: 6 },
  footerBrand: { color: T.textSec, fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  footerSub:   { color: T.textTert, fontSize: 9, letterSpacing: 0.5 },
});