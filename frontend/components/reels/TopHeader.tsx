import React, { memo, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Animated, Platform,
} from 'react-native';
import { Ionicons }  from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics  from 'expo-haptics';

import { P } from './types';
import { FRIENDS_POOL as FP } from './mockData';
import DropdownMenu, { MENU_ITEMS, type MenuKey } from '../DropDownMenu';

interface TopHeaderProps {
  feedKey:     MenuKey;
  onMenuPress: () => void;
  scrollY:     Animated.Value;
}

const TopHeader = memo(function TopHeader({ feedKey, onMenuPress, scrollY }: TopHeaderProps) {
  const router = useRouter();
  const item   = useMemo(() => MENU_ITEMS.find(m => m.key === feedKey) ?? MENU_ITEMS[0], [feedKey]);

  const opacity = scrollY.interpolate({
    inputRange:  [0, 100],
    outputRange: [1, 0.35],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[s.container, { opacity }]} pointerEvents="box-none">

      {/* ── Hamburger + feed label ── */}
      <TouchableOpacity
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onMenuPress();
        }}
        style={s.leftBtn}
        activeOpacity={0.7}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      >
        <View style={s.hamburger}>
          <View style={[s.hLine, { width: 20 }]} />
          <View style={[s.hLine, { width: 13 }]} />
          <View style={[s.hLine, { width: 20 }]} />
        </View>
        <Text style={s.feedLabel} numberOfLines={1}>{item.label}</Text>
        <Ionicons name="chevron-down" size={13} color={P?.t2 || '#AAA'} style={{ marginTop: 1 }} />
      </TouchableOpacity>

      {/* ── Amis + avatars ── */}
      <TouchableOpacity
        style={s.rightGroup}
        activeOpacity={0.7}
        onPress={() => router.push('/social')}
      >
        <Text style={s.amisLabel}>Amis</Text>
        <View style={s.avatarPile}>
          {(FP || []).slice(0, 2).map((f, i) => (
            <Image
              key={f.id}
              source={{ uri: f.avatar }}
              style={[s.avatar, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}
            />
          ))}
          <View style={[s.avatar, s.globeCircle, { marginLeft: -10, zIndex: 0 }]}>
            <Text style={{ fontSize: 12 }}>🌍</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default TopHeader;

const s = StyleSheet.create({
  container:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  leftBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '70%' },
  hamburger:   { gap: 4.5 },
  hLine:       { height: 2.5, borderRadius: 2, backgroundColor: P?.t1 || '#FFF' },
  feedLabel:   { color: P?.t1 || '#FFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.2, flexShrink: 1 },
  rightGroup:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amisLabel:  { color: P?.t2 || '#AAA', fontSize: 15, fontWeight: '600' },
  avatarPile:  { flexDirection: 'row', alignItems: 'center' },
  avatar:      { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: P.bg },
  globeCircle: { backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' },
});