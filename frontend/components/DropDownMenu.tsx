
import React, {
    memo, useEffect, useRef, useCallback, useMemo,
  } from 'react';
  import {
    View, Text, StyleSheet, TouchableOpacity, Image,
    Animated, Easing, Dimensions, ScrollView, PanResponder,
    Platform,
  } from 'react-native';
  import { SafeAreaView }  from 'react-native-safe-area-context';
  import { BlurView }      from 'expo-blur';
  import { Ionicons }      from '@expo/vector-icons';
  import { LinearGradient } from 'expo-linear-gradient';
  import * as Haptics      from 'expo-haptics';
  
  // ─── Types ────────────────────────────────────────────────────────
  
  export const MENU_ITEMS = [
    { icon: '🎬', label: 'Pour vous',        key: 'foryou',   badge: null,   hot: true  },
    { icon: '🌟', label: 'Courts métrages',  key: 'short',    badge: 'NEW',  hot: false },
    { icon: '🎭', label: 'Drame',            key: 'drama',    badge: null,   hot: false },
    { icon: '🚀', label: 'Science-Fiction',  key: 'scifi',    badge: null,   hot: false },
    { icon: '💜', label: 'Romance',          key: 'romance',  badge: null,   hot: false },
    { icon: '🔪', label: 'Thriller',         key: 'thriller', badge: '12',   hot: true  },
    { icon: '✨', label: 'Films ORIGINAL',   key: 'original', badge: null,   hot: false },
    { icon: '🏆', label: 'Sélection Cannes', key: 'cannes',   badge: null,   hot: false },
    { icon: '🎪', label: 'Fantasy',          key: 'fantasy',  badge: null,   hot: false },
    { icon: '📽',  label: 'Documentaire',    key: 'docu',     badge: null,   hot: false },
    { icon: '🎨', label: 'Animation',        key: 'anim',     badge: 'NEW',  hot: false },
    { icon: '🔥', label: 'Tendances',        key: 'trend',    badge: null,   hot: true  },
  ] as const;
  
  export type MenuKey = typeof MENU_ITEMS[number]['key'];
  
  interface DropdownMenuProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (key: MenuKey) => void;
    activeKey: MenuKey;
  }
  
  // ─── Palette (en miroir de index.tsx) ────────────────────────────
  
  const P = {
    bg:      '#07000F',
    surface: '#130025',
    glass:   'rgba(255,255,255,0.06)',
    primary: '#9240D6',
    primL:   '#C060FF',
    primGl:  'rgba(146,64,214,0.38)',
    t1:      '#F0E8FF',
    t2:      'rgba(240,232,255,0.62)',
    t3:      'rgba(240,232,255,0.36)',
    bord:    'rgba(146,64,214,0.30)',
    bordL:   'rgba(255,255,255,0.08)',
    gold:    '#FFD60A',
    red:     '#EF4444',
    hot:     '#FF6B35',
  } as const;
  
  const { width: W } = Dimensions.get('window');
  const PANEL_W = Math.min(W * 0.82, 340);
  
  // ─── Constante profil mock ────────────────────────────────────────
  
  const USER_PROFILE = {
    name:     'Alexandre D.',
    handle:   '@alex.cinema',
    avatar:   'https://i.pravatar.cc/100?img=11',
    films:    247,
    watchlist: 38,
    niveau:   'Cinéphile Confirmé',
    stars:    4,
  };
  
  // ─── Animated Star Row ────────────────────────────────────────────
  
  const StarRow = memo(function StarRow({ count }: { count: number }) {
    return (
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Ionicons
            key={i}
            name={i < count ? 'star' : 'star-outline'}
            size={12}
            color={i < count ? P.gold : P.t3}
          />
        ))}
      </View>
    );
  });
  
  // ─── Menu Item ────────────────────────────────────────────────────
  
  interface MenuItemRowProps {
    item: typeof MENU_ITEMS[number];
    isActive: boolean;
    onPress: () => void;
    delay: number;
    slideAnim: Animated.Value;
  }
  
  const MenuItemRow = memo(function MenuItemRow({
    item, isActive, onPress, delay, slideAnim,
  }: MenuItemRowProps) {
    const translateX = slideAnim.interpolate({
      inputRange:  [0, 1],
      outputRange: [-30, 0],
    });
    const opacity = slideAnim.interpolate({
      inputRange:  [0, 1],
      outputRange: [0, 1],
    });
  
    return (
      <Animated.View style={{ transform: [{ translateX }], opacity }}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.72}
          style={[s.item, isActive && s.itemActive]}
        >
          {isActive && (
            <LinearGradient
              colors={['rgba(192,96,255,0.22)', 'rgba(146,64,214,0.08)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {isActive && <View style={s.accentBar} />}
  
          <Text style={s.icon}>{item.icon}</Text>
          <Text style={[s.label, isActive && s.labelActive]} numberOfLines={1}>
            {item.label}
          </Text>
  
          <View style={s.rightGroup}>
            {item.hot && !isActive && (
              <View style={s.hotDot}>
                <Text style={s.hotTxt}>🔥</Text>
              </View>
            )}
            {item.badge && (
              <View style={[s.badge, item.badge === 'NEW' && s.badgeNew]}>
                <Text style={s.badgeTxt}>{item.badge}</Text>
              </View>
            )}
            {isActive && (
              <Ionicons name="play" size={12} color={P.primL} />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  });
  
  // ─── Main Component ───────────────────────────────────────────────
  
  const DropdownMenu = memo(function DropdownMenu({
    visible, onClose, onSelect, activeKey,
  }: DropdownMenuProps) {
    const slideX    = useRef(new Animated.Value(-PANEL_W)).current;
    const bgOpacity = useRef(new Animated.Value(0)).current;
    const itemAnims = useRef(MENU_ITEMS.map(() => new Animated.Value(0))).current;
  
    // ── Swipe-to-close PanResponder ──────────────────────────────
    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dx < -15 && Math.abs(g.dy) < 40,
        onPanResponderMove: (_, g) => {
          if (g.dx < 0) {
            slideX.setValue(Math.max(g.dx, -PANEL_W));
          }
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -60 || g.vx < -0.6) {
            onClose();
          } else {
            Animated.spring(slideX, {
              toValue: 0, useNativeDriver: true, speed: 22, bounciness: 4,
            }).start();
          }
        },
      }),
    ).current;
  
    // ── Ouverture / fermeture animée ──────────────────────────────
    useEffect(() => {
      if (visible) {
        // Reset item anims
        itemAnims.forEach(a => a.setValue(0));
  
        Animated.parallel([
          Animated.spring(slideX, {
            toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6,
          }),
          Animated.timing(bgOpacity, {
            toValue: 1, duration: 220, useNativeDriver: true,
          }),
        ]).start(() => {
          // Cascade d'entrée des items
          Animated.stagger(
            28,
            itemAnims.map(a =>
              Animated.spring(a, {
                toValue: 1, useNativeDriver: true, speed: 24, bounciness: 5,
              }),
            ),
          ).start();
        });
      } else {
        Animated.parallel([
          Animated.timing(slideX, {
            toValue: -PANEL_W,
            duration: 240,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(bgOpacity, {
            toValue: 0, duration: 200, useNativeDriver: true,
          }),
        ]).start();
      }
    }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  
    // ── Handler item ─────────────────────────────────────────────
    const handleSelect = useCallback((key: MenuKey) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onSelect(key);
      onClose();
    }, [onSelect, onClose]);
  
    // ── Stats user animées ────────────────────────────────────────
    const statsAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      if (visible) {
        Animated.spring(statsAnim, {
          toValue: 1, delay: 180, useNativeDriver: true, speed: 18, bounciness: 8,
        }).start();
      } else {
        statsAnim.setValue(0);
      }
    }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  
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
          {/* Glow border droit */}
          <View style={s.glowEdge} />
          <LinearGradient
            colors={['rgba(192,96,255,0.18)', 'transparent', 'rgba(146,64,214,0.10)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
  
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
            {/* ── Profil ── */}
            <Animated.View
              style={[s.profileSection, {
                opacity: statsAnim,
                transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              }]}
            >
              <View style={s.profileRow}>
                <View style={s.avatarWrap}>
                  <Image source={{ uri: USER_PROFILE.avatar }} style={s.profileAvatar} />
                  <View style={s.onlineDot} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.profileName}>{USER_PROFILE.name}</Text>
                  <Text style={s.profileHandle}>{USER_PROFILE.handle}</Text>
                  <StarRow count={USER_PROFILE.stars} />
                </View>
              </View>
  
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
                  <Text style={[s.statVal, { color: P.gold }]}>★</Text>
                  <Text style={s.statLbl}>{USER_PROFILE.niveau}</Text>
                </View>
              </View>
            </Animated.View>
  
            {/* ── Séparateur ── */}
            <View style={s.sep} />
  
            {/* ── Titre section ── */}
            <Text style={s.sectionTitle}>MON UNIVERS</Text>
  
            {/* ── Items scrollables ── */}
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {MENU_ITEMS.map((item, idx) => (
                <MenuItemRow
                  key={item.key}
                  item={item}
                  isActive={activeKey === item.key}
                  onPress={() => handleSelect(item.key as MenuKey)}
                  delay={idx * 30}
                  slideAnim={itemAnims[idx]}
                />
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
  
            {/* ── Footer ── */}
            <View style={s.footer}>
              <LinearGradient
                colors={['transparent', 'rgba(7,0,15,0.95)']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <Text style={s.footerBrand}>UNIVERSE</Text>
              <Text style={s.footerSub}>Films indépendants · Beta</Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    );
  });
  
  export default DropdownMenu;
  
  // ─── Styles ───────────────────────────────────────────────────────
  
  const s = StyleSheet.create({
    backdrop:      { backgroundColor: 'rgba(0,0,0,0.65)' },
    panel: {
      position:          'absolute',
      left:              0, top: 0, bottom: 0,
      width:             PANEL_W,
      backgroundColor:   'rgba(8,0,18,0.97)',
      borderRightWidth:  1,
      borderRightColor:  P.bord,
      shadowColor:       P.primary,
      shadowOffset:      { width: 8, height: 0 },
      shadowOpacity:     0.35,
      shadowRadius:      24,
      elevation:         20,
      overflow:          'hidden',
    },
    glowEdge:      { position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: P.primL, opacity: 0.5 },
  
    // Profile
    profileSection: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    profileRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
    avatarWrap:     { position: 'relative' },
    profileAvatar:  { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, borderColor: P.primL },
    onlineDot:      { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: 'rgba(8,0,18,0.97)' },
    profileName:    { color: P.t1, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
    profileHandle:  { color: P.t3, fontSize: 12, marginTop: 1 },
  
    statsRow:     { flexDirection: 'row', backgroundColor: 'rgba(146,64,214,0.12)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.bord },
    statBlock:    { flex: 1, alignItems: 'center', gap: 3 },
    statVal:      { color: P.t1, fontSize: 17, fontWeight: '900' },
    statLbl:      { color: P.t3, fontSize: 9, fontWeight: '600', textAlign: 'center', letterSpacing: 0.5 },
    statDivider:  { width: 1, backgroundColor: P.bord, marginVertical: 4 },
  
    sep:          { height: 1, backgroundColor: 'rgba(146,64,214,0.20)', marginHorizontal: 20, marginBottom: 8 },
    sectionTitle: { color: P.t3, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, paddingHorizontal: 20, marginBottom: 8 },
  
    // Items
    item:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14, overflow: 'hidden' },
    itemActive: { backgroundColor: 'transparent' },
    accentBar:  { position: 'absolute', left: 0, top: 4, bottom: 4, width: 3.5, backgroundColor: P.primL, borderRadius: 2 },
    icon:       { fontSize: 20, width: 30, textAlign: 'center' },
    label:      { flex: 1, color: P.t2, fontSize: 15, fontWeight: '500' },
    labelActive:{ color: P.t1, fontWeight: '800' },
    rightGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    hotDot:     { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
    hotTxt:     { fontSize: 11 },
    badge:      { backgroundColor: 'rgba(146,64,214,0.35)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: P.bord },
    badgeNew:   { backgroundColor: 'rgba(34,197,94,0.22)', borderColor: 'rgba(34,197,94,0.45)' },
    badgeTxt:   { color: P.t1, fontSize: 9, fontWeight: '800' },
  
    // Footer
    footer:      { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 14, position: 'relative' },
    footerBrand: { color: P.primL, fontSize: 13, fontWeight: '900', letterSpacing: 3 },
    footerSub:   { color: P.t3, fontSize: 10, marginTop: 2 },
  });