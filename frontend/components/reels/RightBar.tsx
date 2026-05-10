// components/reels/RightBar.tsx
import React, { memo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { P } from './types';
import type { FeedFilm } from './types';

interface RightBarProps {
  film:    FeedFilm;
  liked:   boolean;
  muted:   boolean;
  saved:   boolean;
  onLike:  () => void;
  onMute:  () => void;
  onSave:  () => void;
  onInfo:  () => void;
}

const Btn = memo(function Btn({
  icon, label, color = '#fff', onPress, active = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string | number;
  color?: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <TouchableOpacity style={rb.btn} onPress={onPress} activeOpacity={0.7}>
      <View style={[rb.iconWrap, active && rb.iconWrapActive]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
     
    </TouchableOpacity>
  );
});

const RightBar = memo(function RightBar({
  film, liked, muted, saved, onLike, onMute, onSave, onInfo,
}: RightBarProps) {
  const likesDisplay = film.likes_count >= 1000
    ? `${(film.likes_count / 1000).toFixed(1)}k`
    : String(film.likes_count);

  return (
    <View style={rb.bar} pointerEvents="box-none">
      {/* Like */}
      <Btn
        icon={liked ? 'heart' : 'heart-outline'}
        color={liked ? P.red : '#fff'}
        onPress={onLike}
        active={liked}
      />

      {/* Mute */}
      <Btn
        icon={muted ? 'volume-mute' : 'volume-high-outline'}
        color={muted ? P.primL : '#fff'}
        onPress={onMute}
        active={muted}
      />

      {/* Save */}
      <Btn
        icon={saved ? 'bookmark' : 'bookmark-outline'}
        color={saved ? P.gold : '#fff'}
        onPress={onSave}
        active={saved}
      />

      {/* Info */}
      <Btn
        icon="information-circle-outline"
        color="rgba(255,255,255,0.80)"
        onPress={onInfo}
      />
    </View>
  );
});

export default RightBar;

const rb = StyleSheet.create({
  bar: {
    position:  'absolute',
    right:      14,
    bottom:    130,
    alignItems:'center',
    gap:        18,
    zIndex:     20,
  },
  btn: {
    alignItems: 'center',
    gap:         3,
  },
  iconWrap: {
    width:           46,
    height:          46,
    borderRadius:    23,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:     1,
    borderColor:    'rgba(255,255,255,0.10)',
  },
  
  iconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderColor:    'rgba(255,255,255,0.25)',
  },
}); 