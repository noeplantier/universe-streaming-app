 
import React, { memo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { P } from './types';
import type { FeedFilm } from './types';

interface RightBarProps {
  film:   FeedFilm;
  liked:  boolean;
  muted:  boolean;
  saved:  boolean;
  onLike: () => void;
  onMute: () => void;
  onInfo: () => void;
  onSave: () => void;
}

const RightBar = memo(function RightBar({
  film, liked, muted, saved, onLike, onMute, onInfo, onSave,
}: RightBarProps) {
  const heartSc = useRef(new Animated.Value(1)).current;
  const saveSc  = useRef(new Animated.Value(1)).current;

  const bounce = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim,  { toValue: 1.45, duration: 90,  useNativeDriver: true }),
      Animated.spring(anim,  { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 14 }),
    ]).start();
  }, []);

  const pressHeart = useCallback(() => {
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

  const likeCount = film.likes + (liked ? 1 : 0);

  return (
    <View style={s.bar}>

      {/* ── Mute ── */}
      <TouchableOpacity
        style={s.iconBtn}
        onPress={pressMute}
        activeOpacity={0.75}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <View style={[s.iconWrap, muted && s.iconWrapActive]}>
          <Ionicons
            name={muted ? 'volume-mute' : 'volume-high'}
            size={22}
            color={muted ? P.primL : P?.t1 || '#FFF'}
          />
        </View>
      </TouchableOpacity>

      {/* ── Like ── */}
      <View style={s.item}>
        <TouchableOpacity
          onPress={pressHeart}
          activeOpacity={0.82}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Animated.View style={{ transform: [{ scale: heartSc }] }}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={34}
              color={liked ? P.red : 'rgba(240,232,255,0.90)'}
            />
          </Animated.View>
        </TouchableOpacity>
        <Text style={s.count}>{likeCount.toLocaleString('fr-FR')}</Text>
      </View>

      {/* ── Info ── */}
      <View style={s.item}>
        <TouchableOpacity
          onPress={pressInfo}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={s.iconWrap}>
            <Ionicons name="information-circle-outline" size={26} color="rgba(240,232,255,0.90)" />
          </View>
        </TouchableOpacity>
        <Text style={s.count}>Infos</Text>
      </View>

      {/* ── Watchlist ── */}
      <View style={s.item}>
        <TouchableOpacity
          onPress={pressSave}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Animated.View style={{ transform: [{ scale: saveSc }] }}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={30}
              color={saved ? P.gold : 'rgba(240,232,255,0.90)'}
            />
          </Animated.View>
        </TouchableOpacity>
        <Text style={s.count}>Sauver</Text>
      </View>

      {/* ── Partager ── */}
      <View style={s.item}>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={s.iconWrap}>
            <Ionicons name="arrow-redo-outline" size={26} color="rgba(240,232,255,0.90)" />
          </View>
        </TouchableOpacity>
        <Text style={s.count}>Partager</Text>
      </View>
    </View>
  );
});

export default RightBar;

const s = StyleSheet.create({
  bar:            { position: 'absolute', right: 14, bottom: 220, alignItems: 'center', gap: 20 },
  iconBtn:        { alignItems: 'center', justifyContent: 'center' },
  iconWrap:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)' },
  iconWrapActive: { backgroundColor: '#0a2f63' },
  item:           { alignItems: 'center', gap: 4 },
  count:          { color: 'rgba(240,232,255,0.82)', fontSize: 11, fontWeight: '700' },
});