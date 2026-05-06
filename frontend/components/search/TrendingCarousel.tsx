/**
 * components/search/TrendingCarousel.tsx
 * Carrousel horizontal des œuvres les plus tendances avec badges de rang.
 */

import React, { memo, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Dimensions, FlatList, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';

import type { Work } from '@/lib/supabase';
import { T, DIMS, getRankConfig, resolveWorkImage } from './shared';
import { usePulse } from './Cards';

const { width: W } = Dimensions.get('window');
const { CAROUSEL_ITEM_W, CAROUSEL_ITEM_H, CAROUSEL_SPACING, CAROUSEL_SIDE } = DIMS;

// ─────────────────────────────────────────────────────────────────────────────
// CAROUSEL CARD
// ─────────────────────────────────────────────────────────────────────────────
const CarouselCard = memo(function CarouselCard({
  item, rank, scrollX, index,
}: {
  item: Work; rank: number; scrollX: Animated.Value; index: number;
}) {
  const router   = useRouter();
  const rankCfg  = getRankConfig(rank);
  const snapIv   = CAROUSEL_ITEM_W + CAROUSEL_SPACING;
  const position = index * snapIv;

  const scale = scrollX.interpolate({
    inputRange:  [position - W, position, position + W],
    outputRange: [0.88, 1, 0.88], extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange:  [position - W, position, position + W],
    outputRange: [0.55, 1, 0.55], extrapolate: 'clamp',
  });
  const imgX = scrollX.interpolate({
    inputRange:  [position - W, position, position + W],
    outputRange: [-30, 0, 30], extrapolate: 'clamp',
  });

  return (
    <TouchableOpacity
      style={{ width: CAROUSEL_ITEM_W, marginHorizontal: CAROUSEL_SPACING / 2 }}
      onPress={() => router.push(`/film/${item.id}` as any)}
      activeOpacity={0.92}
    >
      <Animated.View style={[cc.card, { transform: [{ scale }], opacity }]}>
        <Animated.Image
          source={{ uri: resolveWorkImage(item) }}
          style={[cc.img, { transform: [{ translateX: imgX }] }]}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.45)', 'rgba(2,8,16,0.92)']}
          locations={[0.35, 0.65, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Rang */}
        <View style={cc.rankWrap}>
          <Text style={[
            cc.rankNum, { color: rankCfg.color },
            rank <= 3 && { textShadowColor: rankCfg.glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 },
          ]}>
            {rankCfg.num}
          </Text>
        </View>

        {item.is_original && (
          <View style={cc.originalBadge}>
            <Ionicons name="star" size={9} color={T.gold} />
            <Text style={cc.originalTxt}>ORIGINAL</Text>
          </View>
        )}

        <View style={cc.info}>
          {item.genre && <Text style={cc.genre}>{item.genre.toUpperCase()}</Text>}
          <Text style={cc.title} numberOfLines={2}>{item.title}</Text>
          {item.adjective && <Text style={cc.adj} numberOfLines={1}>{item.adjective}</Text>}
          <View style={cc.stats}>
            <View style={cc.chip}>
              <Ionicons name="heart" size={11} color={T.gold} />
              <Text style={cc.chipTxt}>{item.likes.toLocaleString('fr-FR')}</Text>
            </View>
            {item.duration != null && (
              <View style={cc.chip}>
                <Ionicons name="time-outline" size={11} color={T.textSec} />
                <Text style={cc.chipTxt}>{item.duration} min</Text>
              </View>
            )}
            {item.year != null && (
              <View style={cc.chip}>
                <Ionicons name="calendar-outline" size={11} color={T.textSec} />
                <Text style={cc.chipTxt}>{item.year}</Text>
              </View>
            )}
          </View>
        </View>

        {rank <= 3 && <View style={[cc.rankBorder, { borderColor: rankCfg.border }]} />}
      </Animated.View>
    </TouchableOpacity>
  );
});

const cc = StyleSheet.create({
  card:          { width: '100%', height: CAROUSEL_ITEM_H, borderRadius: 22, overflow: 'hidden', backgroundColor: T.navyMid },
  img:           { width: '115%', height: '100%', position: 'absolute', left: '-7.5%' as any },
  rankWrap:      { position: 'absolute', top: 0, right: 0, bottom: '35%', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 12 },
  rankNum:       { fontSize: 96, fontWeight: '900', lineHeight: 96, letterSpacing: -6, opacity: 0.9 },
  originalBadge: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,200,66,0.18)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(245,200,66,0.4)' },
  originalTxt:   { color: T.gold, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  info:          { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, gap: 5 },
  genre:         { color: T.blue, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  title:         { color: T.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, lineHeight: 25 },
  adj:           { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontStyle: 'italic' },
  stats:         { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(2,8,16,0.55)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' },
  chipTxt:       { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  rankBorder:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, borderWidth: 1.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────
export const TrendingCarousel = memo(function TrendingCarousel({
  items, loading,
}: { items: Work[]; loading: boolean }) {
  const scrollX    = useRef(new Animated.Value(0)).current;
  const flatRef    = useRef<FlatList>(null);
  const snapIv     = CAROUSEL_ITEM_W + CAROUSEL_SPACING;

  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }),
    [scrollX],
  );

  const CarouselSkeleton = useCallback(() => {
    const op = usePulse();
    return <Animated.View style={[cc.card, { width: CAROUSEL_ITEM_W, marginHorizontal: CAROUSEL_SPACING / 2, opacity: op }]} />;
  }, []);

  if (loading || items.length === 0) {
    return (
      <View style={tr.container}>
        <View style={tr.head}>
          <Text style={tr.sectionTitle}>Les plus tendances</Text>
          <Text style={tr.sectionSub}>Cette semaine</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: CAROUSEL_SIDE - CAROUSEL_SPACING / 2 }}>
          {[0, 1, 2, 3].map(i => <CarouselSkeleton key={i} />)}
        </ScrollView>
      </View>
    );
  }

  const dotsCount = Math.min(items.length, 8);

  return (
    <View style={tr.container}>
      <View style={tr.head}>
        <View>
          <Text style={tr.sectionTitle}>Les plus tendances</Text>
          <Text style={tr.sectionSub}>Cette semaine · {items.length} œuvres</Text>
        </View>
        <View style={tr.legend}>
          {([{ c: T.gold, l: '#1' }, { c: T.silver, l: '#2' }, { c: T.bronze, l: '#3' }] as const).map(({ c, l }) => (
            <View key={l} style={tr.legendItem}>
              <View style={[tr.legendDot, { backgroundColor: c }]} />
              <Text style={[tr.legendTxt, { color: c }]}>{l}</Text>
            </View>
          ))}
        </View>
      </View>

      <Animated.FlatList
        ref={flatRef as any}
        data={items}
        keyExtractor={item => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapIv}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={{
          paddingLeft:  CAROUSEL_SIDE - CAROUSEL_SPACING / 2,
          paddingRight: CAROUSEL_SIDE - CAROUSEL_SPACING / 2,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <CarouselCard item={item} rank={index + 1} index={index} scrollX={scrollX} />
        )}
        getItemLayout={(_, i) => ({ length: snapIv, offset: snapIv * i, index: i })}
        removeClippedSubviews initialNumToRender={3} maxToRenderPerBatch={3} windowSize={5}
      />

      {items.length > 1 && (
        <View style={tr.dots}>
          {Array.from({ length: dotsCount }).map((_, i) => {
            const op = scrollX.interpolate({ inputRange: [(i - 1) * snapIv, i * snapIv, (i + 1) * snapIv], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
            const w  = scrollX.interpolate({ inputRange: [(i - 1) * snapIv, i * snapIv, (i + 1) * snapIv], outputRange: [6, 20, 6],    extrapolate: 'clamp' });
            return (
              <TouchableOpacity key={i} onPress={() => flatRef.current?.scrollToIndex({ index: i, animated: true })}>
                <Animated.View style={[tr.dot, { opacity: op, width: w }]} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
});

const tr = StyleSheet.create({
  container:    { marginBottom: 32 },
  head:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { color: T.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub:   { color: T.textTert, fontSize: 12, marginTop: 2 },
  legend:       { flexDirection: 'row', gap: 8, alignItems: 'center' },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:    { width: 7, height: 7, borderRadius: 4 },
  legendTxt:    { fontSize: 11, fontWeight: '700' },
  dots:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 16 },
  dot:          { height: 5, borderRadius: 3, backgroundColor: T.blue },
});