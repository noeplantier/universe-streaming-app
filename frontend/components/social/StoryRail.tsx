import React, { memo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  FlatList, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';

import { useSocial }    from './SocialContext';
import type { Story }   from './types';
import { G }            from './types';

// ─────────────────────────────────────────────────────────────────────────────

const StoryBubble = memo(function StoryBubble({ story }: { story: Story }) {
  const { markStorySeen } = useSocial();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
    ]).start();
    markStorySeen(story.id);
  }, [story.id, markStorySeen, scale]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9} style={s.bubble}>
      <Animated.View style={{ transform: [{ scale }] }}>

        {/* Anneau dégradé si non vu */}
        {story.isMe ? (
          <View style={s.meRing}>
            <View style={s.addCircle}>
              <Ionicons name="add" size={11} color="#fff" />
            </View>
          </View>
        ) : story.seen ? (
          <View style={s.seenRing}>
            <Image source={{ uri: story.avi }} style={s.avi} />
          </View>
        ) : (
          <LinearGradient
            colors={['#C060FF', '#86EEFF', '#FFD60A']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={s.gradientRing}
          >
            <View style={s.gradientInner}>
              <Image source={{ uri: story.avi }} style={s.avi} />
            </View>
          </LinearGradient>
        )}

      </Animated.View>
      <Text style={[s.label, !story.seen && !story.isMe && s.labelActive]} numberOfLines={1}>
        {story.isMe ? 'Moi' : story.user.replace('@', '')}
      </Text>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

const StoryRail = memo(function StoryRail() {
  const { stories } = useSocial();

  return (
    <View style={s.rail}>
      <FlatList
        data={stories}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <StoryBubble story={item} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.list}
      />
    </View>
  );
});

export default StoryRail;

const AVI_SIZE  = 58;
const RING_SIZE = AVI_SIZE + 4;

const s = StyleSheet.create({
  rail:          { marginBottom: 6 },
  list:          { paddingHorizontal: 16, gap: 14 },
  bubble:        { alignItems: 'center', width: 64, gap: 6 },
  avi:           { width: AVI_SIZE, height: AVI_SIZE, borderRadius: AVI_SIZE / 2 },
  gradientRing:  { width: RING_SIZE + 4, height: RING_SIZE + 4, borderRadius: (RING_SIZE + 4) / 2, alignItems: 'center', justifyContent: 'center' },
  gradientInner: { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, backgroundColor: G.bg0, alignItems: 'center', justifyContent: 'center' },
  seenRing:      { width: RING_SIZE + 4, height: RING_SIZE + 4, borderRadius: (RING_SIZE + 4) / 2, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  meRing:        { width: RING_SIZE + 4, height: RING_SIZE + 4, borderRadius: (RING_SIZE + 4) / 2, borderWidth: 2, borderColor: G.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(192,96,255,0.12)' },
  addCircle:     { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: G.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: G.bg0, zIndex: 2 },
  label:         { color: 'rgba(237,232,255,0.45)', fontSize: 11, fontWeight: '600', textAlign: 'center', maxWidth: 60 },
  labelActive:   { color: G.sW, fontWeight: '700' },
});