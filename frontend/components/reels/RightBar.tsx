import React, { memo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import type { FeedFilm } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS — blanc pur, surfaces navyMid/transparent
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  icon:     'rgba(255,255,255,0.88)',
  iconDim:  'rgba(255,255,255,0.40)',
  label:    'rgba(255,255,255,0.42)',
  surface:  'rgba(255,255,255,0.07)',
  active:   'rgba(255,255,255,0.14)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface LeftBarProps {
  film:   FeedFilm;
  liked:  boolean;
  muted:  boolean;
  saved:  boolean;
  onLike: () => void;
  onMute: () => void;
  onInfo: () => void;
  onSave: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICON BUTTON ATOMIQUE
// ─────────────────────────────────────────────────────────────────────────────
interface IconBtnProps {
  name:    keyof typeof Ionicons.glyphMap;
  label?:  string;
  active?: boolean;
  scale?:  Animated.Value;
  onPress: () => void;
}

const IconBtn = memo(function IconBtn({ name, label, active, scale, onPress }: IconBtnProps) {
  const inner = (
    <View style={[s.iconWrap, active && s.iconWrapActive]}>
      <BlurView intensity={active ? 18 : 10} tint="dark" style={StyleSheet.absoluteFill} />
      <Ionicons name={name} size={22} color={active ? T.icon : T.iconDim} />
    </View>
  );

  return (
    <View style={s.item}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {scale
          ? <Animated.View style={{ transform: [{ scale }] }}>{inner}</Animated.View>
          : inner
        }
      </TouchableOpacity>
      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  );
});
IconBtn.displayName = 'IconBtn';

// ─────────────────────────────────────────────────────────────────────────────
// LEFT BAR
// ─────────────────────────────────────────────────────────────────────────────
const LeftBar = memo(function LeftBar({
  film, liked, muted, saved, onLike, onMute, onInfo, onSave,
}: LeftBarProps) {
  const heartSc = useRef(new Animated.Value(1)).current;
  const saveSc  = useRef(new Animated.Value(1)).current;

  const bounce = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.4, duration: 85,  useNativeDriver: true }),
      Animated.spring (anim, { toValue: 1,   useNativeDriver: true, speed: 30, bounciness: 12 }),
    ]).start();
  }, []);

  const pressLike = useCallback(() => {
    bounce(heartSc);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLike();
  }, [onLike, heartSc, bounce]);

  const pressSave = useCallback(() => {
    bounce(saveSc);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave();
  }, [onSave, saveSc, bounce]);

  const pressInfo = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onInfo();
  }, [onInfo]);

  const pressMute = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMute();
  }, [onMute]);

  const pressShare = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `🎬 "${film.title}" sur Universe — Cinéma Indépendant`,
        title: film.title,
      });
    } catch { /* silently ignore */ }
  }, [film.title]);

  return (
    <View style={s.bar}>

      {/* Mute */}
      <IconBtn
        name={muted ? 'volume-mute' : 'volume-high'}
        active={muted}
        onPress={pressMute}
      />

      {/* Like */}
      <IconBtn
        name={liked ? 'heart' : 'heart-outline'}
        active={liked}
        scale={heartSc}
        onPress={pressLike}
      />

      {/* Save / Watchlist */}
      <IconBtn
        name={saved ? 'bookmark' : 'bookmark-outline'}
        label="Sauver"
        active={saved}
        scale={saveSc}
        onPress={pressSave}
      />

      {/* Info */}
      <IconBtn
        name="information-circle-outline"
        label="Infos"
        onPress={pressInfo}
      />

      {/* Partager */}
      <IconBtn
        name="arrow-redo-outline"
        label="Partager"
        onPress={pressShare}
      />

    </View>
  );
});

export default LeftBar;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  bar: {
    position:   'absolute',
    right:        14,
    bottom:      220,
    alignItems: 'center',
    gap:         18,
  },

  item: {
    alignItems: 'center',
    gap:         4,
  },

  iconWrap: {
    width:           44,
    height:          44,
    borderRadius:    22,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:      StyleSheet.hairlineWidth,
    borderColor:     'rgba(255,255,255,0.08)',
  },

  iconWrapActive: {
    borderColor: 'rgba(255,255,255,0.20)',
  },

  label: {
    color:         T.label,
    fontSize:       10,
    fontWeight:    '600',
    letterSpacing:  0.2,
  },
});