import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, TextInput,
  Dimensions, Platform, Animated, Modal, ActivityIndicator,
  FlatList, ListRenderItemInfo, ScrollView, ImageBackground,
  Pressable,
} from 'react-native';
import { StatusBar }      from 'expo-status-bar';
import { BlurView }       from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';

import {
  type Work, type SortOption, type DurationBand,
  fetchTrending, fetchWorks, supabase,
} from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:         '#0A0A0F',
  bg2:        '#16161F',
  navyMid:    '#0D2240',
  navyLight:  '#163356',
  navyBright: '#1E4A7A',
  surf:       'rgba(13,34,64,0.55)',
  surfBorder: 'rgba(255,255,255,0.08)',
  text:       '#F2F2F7',
  textSec:    '#8E8E93',
  textTert:   '#636366',
  blue:       '#5A96E6',
  blueDim:    'rgba(90,150,230,0.15)',
  gold:       '#F5C842',
  goldDim:    'rgba(245,200,66,0.14)',
  silver:     '#C0C0C0',
  silverDim:  'rgba(192,192,192,0.12)',
  bronze:     '#CD7F32',
  bronzeDim:  'rgba(205,127,50,0.12)',
  red:        '#FF3B5C',
  white:      '#FFFFFF',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────
const CAROUSEL_ITEM_W  = W * 0.72;
const CAROUSEL_ITEM_H  = CAROUSEL_ITEM_W * 1.46;
const CAROUSEL_SPACING = 14;
const CAROUSEL_SIDE    = (W - CAROUSEL_ITEM_W) / 2;

const LAND_W  = 240;
const LAND_H  = 135;
const HERO_H  = H * 0.50;

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE HELPER — Supabase Storage public URL
// ─────────────────────────────────────────────────────────────────────────────
function getImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  // Si c'est déjà une URL complète (http/https), on la retourne directement
  if (imagePath.startsWith('http')) return imagePath;
  // Sinon on construit l'URL depuis le bucket community-images
  const { data } = supabase.storage.from('community-images').getPublicUrl(imagePath);
  return data?.publicUrl ?? null;
}

function workImgUri(item: Work): string {
  const url = getImageUrl(item.image);
  return url ?? `https://picsum.photos/seed/work_${item.id}/400/600`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RANK CONFIG — or / argent / bronze
// ─────────────────────────────────────────────────────────────────────────────
interface RankConfig {
  num:    string;
  color:  string;
  glow:   string;
  border: string;
}

function getRankConfig(rank: number): RankConfig | null {
  if (rank === 1) return { num: '1', color: T.gold,   glow: 'rgba(245,200,66,0.35)',  border: 'rgba(245,200,66,0.50)'  };
  if (rank === 2) return { num: '2', color: T.silver, glow: 'rgba(192,192,192,0.28)', border: 'rgba(192,192,192,0.45)' };
  if (rank === 3) return { num: '3', color: T.bronze, glow: 'rgba(205,127,50,0.28)',  border: 'rgba(205,127,50,0.45)'  };
  return { num: String(rank), color: 'rgba(255,255,255,0.45)', glow: 'transparent', border: 'transparent' };
}

// ─────────────────────────────────────────────────────────────────────────────
// CAROUSEL CARD — card principale du carrousel interactif
// ─────────────────────────────────────────────────────────────────────────────
interface CarouselCardProps {
  item:      Work;
  rank:      number;
  inputRange: number[];
  scrollX:   Animated.Value;
  index:     number;
}

const CarouselCard = memo(function CarouselCard({
  item, rank, inputRange, scrollX, index,
}: CarouselCardProps) {
  const router = useRouter();
  const rankCfg = getRankConfig(rank);
  const imgUri  = workImgUri(item);

  // Animations parallax par card
  const position = index * (CAROUSEL_ITEM_W + CAROUSEL_SPACING);

  const scale = scrollX.interpolate({
    inputRange: [position - W, position, position + W],
    outputRange: [0.88, 1, 0.88],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange: [position - W, position, position + W],
    outputRange: [0.55, 1, 0.55],
    extrapolate: 'clamp',
  });

  const imgTranslate = scrollX.interpolate({
    inputRange: [position - W, position, position + W],
    outputRange: [-30, 0, 30],
    extrapolate: 'clamp',
  });

  return (
    <TouchableOpacity
      style={cc.wrap}
      onPress={() => router.push(`/film/${item.id}` as any)}
      activeOpacity={0.92}
    >
      <Animated.View style={[cc.card, { transform: [{ scale }], opacity }]}>
        {/* Image avec parallax */}
        <Animated.Image
          source={{ uri: imgUri }}
          style={[cc.img, { transform: [{ translateX: imgTranslate }] }]}
          resizeMode="cover"
        />

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.45)', 'rgba(2,8,16,0.92)']}
          locations={[0.35, 0.65, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Numéro de rang — grand, côté droit */}
        {rankCfg && (
          <View style={cc.rankWrap}>
            <Text
              style={[
                cc.rankNum,
                { color: rankCfg.color },
                rank <= 3 && {
                  textShadowColor: rankCfg.glow,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 18,
                },
              ]}
            >
              {rankCfg.num}
            </Text>
          </View>
        )}

        {/* Badge catégorie top-left */}
        {item.is_original && (
          <View style={cc.originalBadge}>
            <Ionicons name="star" size={9} color={T.gold} />
            <Text style={cc.originalTxt}>ORIGINAL</Text>
          </View>
        )}

        {/* Infos bas */}
        <View style={cc.info}>
          {item.genre && (
            <Text style={cc.genre}>{item.genre.toUpperCase()}</Text>
          )}
          <Text style={cc.title} numberOfLines={2}>{item.title}</Text>
          {item.adjective && (
            <Text style={cc.adj} numberOfLines={1}>{item.adjective}</Text>
          )}
          <View style={cc.stats}>
            <View style={cc.statChip}>
              <Ionicons name="heart" size={11} color={T.gold} />
              <Text style={cc.statTxt}>{item.likes.toLocaleString('fr-FR')}</Text>
            </View>
            {item.duration && (
              <View style={cc.statChip}>
                <Ionicons name="time-outline" size={11} color={T.textSec} />
                <Text style={cc.statTxt}>{item.duration} min</Text>
              </View>
            )}
            {item.year && (
              <View style={cc.statChip}>
                <Ionicons name="calendar-outline" size={11} color={T.textSec} />
                <Text style={cc.statTxt}>{item.year}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Rank border glow pour top 3 */}
        {rank <= 3 && rankCfg && (
          <View style={[cc.rankBorder, { borderColor: rankCfg.border }]} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

const cc = StyleSheet.create({
  wrap:         { width: CAROUSEL_ITEM_W, marginHorizontal: CAROUSEL_SPACING / 2 },
  card:         { width: '100%', height: CAROUSEL_ITEM_H, borderRadius: 22, overflow: 'hidden', backgroundColor: T.navyMid },
  img:          { width: '115%', height: '100%', position: 'absolute', left: '-7.5%' as any },
  rankWrap:     { position: 'absolute', top: 0, right: 0, bottom: '35%', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 12 },
  rankNum:      { fontSize: 96, fontWeight: '900', lineHeight: 96, letterSpacing: -6, opacity: 0.9 },
  originalBadge:{ position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,200,66,0.18)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(245,200,66,0.4)' },
  originalTxt:  { color: T.gold, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  info:         { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, gap: 5 },
  genre:        { color: T.blue, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  title:        { color: T.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, lineHeight: 25 },
  adj:          { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontStyle: 'italic' },
  stats:        { flexDirection: 'row', gap: 8, marginTop: 4 },
  statChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(2,8,16,0.55)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' },
  statTxt:      { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  rankBorder:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, borderWidth: 1.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING CAROUSEL — carrousel interactif principal
// ─────────────────────────────────────────────────────────────────────────────
const TrendingCarousel = memo(function TrendingCarousel({
  items, loading,
}: { items: Work[]; loading: boolean }) {
  const scrollX         = useRef(new Animated.Value(0)).current;
  const flatRef         = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const snapInterval = CAROUSEL_ITEM_W + CAROUSEL_SPACING;

  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
      useNativeDriver: true,
    }),
    [scrollX],
  );

  const onMomentumEnd = useCallback((e: any) => {
    const offset = e.nativeEvent.contentOffset.x;
    const index  = Math.round(offset / snapInterval);
    setActiveIndex(Math.min(index, items.length - 1));
  }, [items.length, snapInterval]);

  // Skeleton
  if (loading || items.length === 0) {
    return (
      <View style={car.container}>
        <View style={car.sectionHead}>
          <Text style={car.sectionTitle}>Les plus tendances</Text>
          <Text style={car.sectionSub}>Cette semaine</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: CAROUSEL_SIDE - CAROUSEL_SPACING / 2 }}>
          {[0,1,2,3].map(i => <CarouselSkeleton key={i} />)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={car.container}>
      {/* Header section */}
      <View style={car.sectionHead}>
        <View>
          <Text style={car.sectionTitle}>Les plus tendances</Text>
          <Text style={car.sectionSub}>Cette semaine · {items.length} œuvres</Text>
        </View>
        <View style={car.rankLegend}>
          {[{ c: T.gold, l: '#1' }, { c: T.silver, l: '#2' }, { c: T.bronze, l: '#3' }].map(({ c, l }) => (
            <View key={l} style={car.legendItem}>
              <View style={[car.legendDot, { backgroundColor: c }]} />
              <Text style={[car.legendTxt, { color: c }]}>{l}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Carrousel */}
      <Animated.FlatList
        ref={flatRef as any}
        data={items}
        keyExtractor={item => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={{
          paddingLeft:  CAROUSEL_SIDE - CAROUSEL_SPACING / 2,
          paddingRight: CAROUSEL_SIDE - CAROUSEL_SPACING / 2,
        }}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <CarouselCard
            item={item}
            rank={index + 1}
            index={index}
            scrollX={scrollX}
            inputRange={[]}
          />
        )}
        getItemLayout={(_, i) => ({
          length: snapInterval,
          offset: snapInterval * i,
          index:  i,
        })}
      />

      {/* Dots pagination */}
      <View style={car.dots}>
        {items.slice(0, Math.min(items.length, 8)).map((_, i) => {
          const op = scrollX.interpolate({
            inputRange: [(i - 1) * snapInterval, i * snapInterval, (i + 1) * snapInterval],
            outputRange: [0.35, 1, 0.35],
            extrapolate: 'clamp',
          });
          const w = scrollX.interpolate({
            inputRange: [(i - 1) * snapInterval, i * snapInterval, (i + 1) * snapInterval],
            outputRange: [6, 20, 6],
            extrapolate: 'clamp',
          });
          return (
            <TouchableOpacity
              key={i}
              onPress={() => flatRef.current?.scrollToIndex({ index: i, animated: true })}
            >
              <Animated.View style={[car.dot, { opacity: op, width: w }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

// Carousel skeleton
const CarouselSkeleton = memo(function CarouselSkeleton() {
  const op = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 900, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, []);
  return (
    <Animated.View style={[cc.card, {
      width: CAROUSEL_ITEM_W, marginHorizontal: CAROUSEL_SPACING / 2,
      backgroundColor: T.navyMid, opacity: op,
    }]} />
  );
});

const car = StyleSheet.create({
  container:    { marginBottom: 32 },
  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { color: T.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub:   { color: T.textTert, fontSize: 12, marginTop: 2 },
  rankLegend:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:    { width: 7, height: 7, borderRadius: 4 },
  legendTxt:    { fontSize: 11, fontWeight: '700' },
  dots:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 16 },
  dot:          { height: 5, borderRadius: 3, backgroundColor: T.blue },
});

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT CARD — grille résultats de recherche
// ─────────────────────────────────────────────────────────────────────────────
const PORT_W = 130;
const PORT_H = 195;

export const PortraitCard = memo(function PortraitCard({ item }: { item: Work }) {
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;
  const imgUri = workImgUri(item);

  const onIn  = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={() => router.push(`/film/${item.id}` as any)}
      style={{ marginRight: 14 }}
    >
      <Animated.View style={[pcS.card, { transform: [{ scale }] }]}>
        <Image source={{ uri: imgUri }} style={pcS.img} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.78)']}
          style={pcS.grad}
          start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }}
        />
        <View style={[pcS.badge, { backgroundColor: item.is_original ? T.navyBright : T.navyMid }]}>
          <Text style={pcS.badgeTxt}>
            {item.is_original ? 'ORIGINAL' : item.category.toUpperCase()}
          </Text>
        </View>
        <View style={pcS.meta}>
          <Text style={pcS.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="heart" size={10} color={T.gold} />
            <Text style={pcS.statTxt}>{item.likes}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

const pcS = StyleSheet.create({
  card:    { width: PORT_W, height: PORT_H, borderRadius: 14, overflow: 'hidden', backgroundColor: T.navyMid },
  img:     { width: '100%', height: '100%', resizeMode: 'cover' },
  grad:    { ...StyleSheet.absoluteFillObject },
  badge:   { position: 'absolute', top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  badgeTxt:{ color: T.white, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  meta:    { position: 'absolute', bottom: 10, left: 9, right: 9, gap: 3 },
  title:   { color: T.white, fontSize: 12, fontWeight: '700', lineHeight: 15 },
  statTxt: { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LANDSCAPE CARD
// ─────────────────────────────────────────────────────────────────────────────
const LandscapeCard = memo(function LandscapeCard({ item }: { item: Work }) {
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;
  const imgUri = workImgUri(item);

  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onIn} onPressOut={onOut}
      onPress={() => router.push(`/film/${item.id}` as any)}
      style={{ marginRight: 14 }}
    >
      <Animated.View style={[lcS.card, { transform: [{ scale }] }]}>
        <Image source={{ uri: imgUri }} style={lcS.img} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(2,8,16,0.88)']} style={lcS.grad}
          start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={lcS.durBadge}>
          <Ionicons name="time-outline" size={9} color="rgba(255,255,255,0.7)" />
          <Text style={lcS.durTxt}>{item.duration}m</Text>
        </View>
        <View style={lcS.meta}>
          <Text style={lcS.title} numberOfLines={1}>{item.title}</Text>
          {item.adjective && <Text style={lcS.adj} numberOfLines={1}>{item.adjective}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="heart" size={10} color={T.gold} />
            <Text style={lcS.statTxt}>{item.likes}</Text>
            {item.comments != null && (
              <>
                <Ionicons name="chatbubble" size={9} color={T.textSec} />
                <Text style={[lcS.statTxt, { color: T.textSec }]}>{item.comments}</Text>
              </>
            )}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

const lcS = StyleSheet.create({
  card:    { width: LAND_W, height: LAND_H, borderRadius: 14, overflow: 'hidden', backgroundColor: T.navyMid },
  img:     { width: '100%', height: '100%', resizeMode: 'cover' },
  grad:    { ...StyleSheet.absoluteFillObject },
  durBadge:{ position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(2,8,16,0.60)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  durTxt:  { color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: '600' },
  meta:    { position: 'absolute', bottom: 10, left: 10, right: 10, gap: 2 },
  title:   { color: T.white, fontSize: 13, fontWeight: '700' },
  adj:     { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontStyle: 'italic' },
  statTxt: { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETONS
// ─────────────────────────────────────────────────────────────────────────────
const usePulse = () => {
  const op = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.5, duration: 850, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 850, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, []);
  return op;
};

const PortraitSkeleton = memo(function PortraitSkeleton() {
  const op = usePulse();
  return <Animated.View style={[pcS.card, { backgroundColor: T.surf, opacity: op, marginRight: 14 }]} />;
});

const LandscapeSkeleton = memo(function LandscapeSkeleton() {
  const op = usePulse();
  return <Animated.View style={[lcS.card, { backgroundColor: T.surf, opacity: op, marginRight: 14 }]} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// HERO BANNER
// ─────────────────────────────────────────────────────────────────────────────
const HeroBanner = memo(function HeroBanner({ item }: { item: Work | null }) {
  const router = useRouter();
  if (!item) return <View style={hb.skeleton} />;
  const imgUri = workImgUri(item);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => router.push(`/film/${item.id}` as any)}
      style={hb.wrap}
    >
      <ImageBackground source={{ uri: imgUri }} style={hb.img} resizeMode="cover">
        <LinearGradient
          colors={['rgba(10,10,15,0.5)', 'transparent']}
          style={hb.topGrad}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,15,0.65)', T.bg]}
          style={hb.botGrad}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        />
        <View style={hb.content}>
          <View style={[hb.badge, { backgroundColor: item.is_original ? T.navyBright : T.navyMid }]}>
            <Text style={hb.badgeTxt}>{item.is_original ? '★ ORIGINAL' : item.category.toUpperCase()}</Text>
          </View>
          <Text style={hb.title}>{item.title}</Text>
          {item.adjective && <Text style={hb.adj} numberOfLines={1}>{item.adjective}</Text>}
          <View style={hb.actions}>
            <TouchableOpacity
              style={hb.playBtn}
              onPress={() => router.push(`/film/${item.id}` as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={16} color={T.navyMid} />
              <Text style={hb.playTxt}>Regarder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={hb.infoBtn}
              onPress={() => router.push(`/film/${item.id}` as any)}
            >
              <Ionicons name="information-circle-outline" size={16} color={T.white} />
              <Text style={hb.infoTxt}>Infos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
});

const hb = StyleSheet.create({
  wrap:    { height: HERO_H, width: W, overflow: 'hidden' },
  img:     { width: '100%', height: '100%', justifyContent: 'flex-end' },
  skeleton:{ height: HERO_H, backgroundColor: T.surf },
  topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  botGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%' },
  content: { paddingHorizontal: 22, paddingBottom: 28, gap: 8 },
  badge:   { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, marginBottom: 2 },
  badgeTxt:{ color: T.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  title:   { color: T.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, lineHeight: 35 },
  adj:     { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  playBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: T.white, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22 },
  playTxt: { color: T.navyMid, fontSize: 15, fontWeight: '700' },
  infoBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  infoTxt: { color: T.white, fontSize: 15, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROW SECTION
// ─────────────────────────────────────────────────────────────────────────────
interface RowSectionProps {
  title: string; subtitle?: string;
  items: Work[]; loading: boolean;
  variant: 'portrait' | 'landscape';
  onSeeAll?: () => void;
}

const RowSection = memo(function RowSection({
  title, subtitle, items, loading, variant, onSeeAll,
}: RowSectionProps) {
  const isPort = variant === 'portrait';
  return (
    <View style={rs.section}>
      <View style={rs.head}>
        <View>
          <Text style={rs.title}>{title}</Text>
          {subtitle && <Text style={rs.sub}>{subtitle}</Text>}
        </View>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} style={rs.seeAllBtn}>
            <Text style={rs.seeAllTxt}>Tout voir</Text>
            <Ionicons name="chevron-forward" size={14} color={T.blue} />
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={rs.listPad}
        >
          {[0,1,2,3,4].map(i =>
            isPort ? <PortraitSkeleton key={i} /> : <LandscapeSkeleton key={i} />,
          )}
        </ScrollView>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={i => String(i.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={rs.listPad}
          renderItem={({ item }) =>
            isPort ? <PortraitCard item={item} /> : <LandscapeCard item={item} />
          }
          decelerationRate="fast"
          snapToInterval={isPort ? PORT_W + 14 : LAND_W + 14}
          snapToAlignment="start"
        />
      )}
    </View>
  );
});

const rs = StyleSheet.create({
  section:  { marginBottom: 32 },
  head:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 14 },
  title:    { color: T.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sub:      { color: T.textTert, fontSize: 12, marginTop: 2 },
  seeAllBtn:{ flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllTxt:{ color: T.blue, fontSize: 13, fontWeight: '600' },
  listPad:  { paddingHorizontal: 20 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
const SearchOverlay = memo(function SearchOverlay({
  visible, onClose, search, setSearch,
  works, loading, error, onRetry,
  activeFilterCount, onResetFilters,
}: {
  visible: boolean; onClose: () => void;
  search: string; setSearch: (v: string) => void;
  works: Work[]; loading: boolean; error: boolean; onRetry: () => void;
  activeFilterCount: number; onResetFilters: () => void;
  // unused but kept for API compat
  genre?: string; setGenre?: (v: string) => void;
  sortBy?: SortOption; setSortBy?: (v: SortOption) => void;
  duration?: DurationBand; setDuration?: (v: DurationBand) => void;
  year?: string; setYear?: (v: string) => void;
  openDropdown?: (key: string, ev: any) => void;
  openDrop?: string | null; setOpenDrop?: (v: string | null) => void;
  dropAnchor?: { x: number; y: number };
}) {
  const router   = useRouter();
  const inputRef = useRef<TextInput>(null);
  const slideY   = useRef(new Animated.Value(H)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }).start();
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    } else {
      Animated.timing(slideY, { toValue: H, duration: 240, useNativeDriver: true }).start();
    }
  }, [visible]);

  const goFilm = useCallback((id: Work['id']) => {
    onClose();
    router.push(`/film/${id}` as any);
  }, [onClose, router]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<Work>) => {
    const imgUri = workImgUri(item);
    return (
      <TouchableOpacity
        style={ov.resultCard}
        onPress={() => goFilm(item.id)}
        activeOpacity={0.85}
      >
        <Image source={{ uri: imgUri }} style={ov.resultImg} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.92)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[ov.resultBadge, { backgroundColor: item.is_original ? T.navyBright : T.navyMid }]}>
          <Text style={ov.resultBadgeTxt}>{item.category.toUpperCase()}</Text>
        </View>
        <View style={ov.resultInfo}>
          <Text style={ov.resultTitle} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="heart" size={10} color={T.gold} />
            <Text style={ov.resultMetaTxt}>{item.likes}</Text>
            <Text style={[ov.resultMetaTxt, { color: T.textTert }]}>· {item.duration}m</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [goFilm]);

  if (!visible) return null;

  return (
    <Modal visible animationType="none" onRequestClose={onClose}>
      <GalaxyBackground/>
      <Animated.View style={[ov.root, { transform: [{ translateY: slideY }] }]}>
        <View style={ov.inner}>
          {/* Top bar */}
          <View style={ov.topBar}>
            <View style={ov.inputRow}>
              <Ionicons name="search" size={16} color={T.textSec} style={{ marginRight: 8 }} />
              <TextInput
                ref={inputRef}
                style={ov.input}
                placeholder="Titre, genre, ambiance…"
                placeholderTextColor={T.textTert}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={15} color={T.textSec} />
                </TouchableOpacity>
              )}
            </View>
            {activeFilterCount > 0 && (
              <TouchableOpacity style={ov.resetBtn} onPress={onResetFilters}>
                <Ionicons name="close" size={13} color={T.textSec} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={ov.cancelBtn}>
              <Text style={ov.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>

          {/* Results */}
          {loading ? (
            <View style={ov.center}>
              <ActivityIndicator color={T.blue} size="large" />
            </View>
          ) : error ? (
            <View style={ov.center}>
              <Ionicons name="cloud-offline-outline" size={44} color={T.textTert} />
              <Text style={ov.emptyTxt}>Erreur de chargement</Text>
              <TouchableOpacity onPress={onRetry} style={ov.retryBtn}>
                <Text style={{ color: T.blue, fontWeight: '700', fontSize: 14 }}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : works.length === 0 ? (
            <View style={ov.center}>
              <Ionicons name="film-outline" size={44} color={T.textTert} />
              <Text style={ov.emptyTxt}>Aucun résultat</Text>
              <Text style={{ color: T.textTert, fontSize: 13, marginTop: 4 }}>Essayez d'autres mots-clés</Text>
            </View>
          ) : (
            <FlatList
              data={works}
              keyExtractor={i => String(i.id)}
              renderItem={renderItem}
              numColumns={2}
              columnWrapperStyle={ov.colWrap}
              contentContainerStyle={ov.listContent}
              ListHeaderComponent={
                <Text style={ov.resultCount}>
                  {works.length} œuvre{works.length > 1 ? 's' : ''}
                </Text>
              }
              removeClippedSubviews
              initialNumToRender={8}
              maxToRenderPerBatch={10}
              windowSize={7}
            />
          )}
        </View>
      </Animated.View>
    </Modal>
  );
});

const ov = StyleSheet.create({
  root:         { flex: 1, backgroundColor: 'transparent' },
  inner:        { flex: 1, paddingTop: Platform.OS === 'ios' ? 54 : 24 },
  topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10, gap: 8 },
  inputRow:     { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 11, height: 38, borderWidth: StyleSheet.hairlineWidth, borderColor: T.surfBorder },
  input:        { flex: 1, color: T.text, fontSize: 14, fontWeight: '500' },
  resetBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: T.surfBorder, alignItems: 'center', justifyContent: 'center' },
  cancelBtn:    { paddingLeft: 4 },
  cancelTxt:    { color: T.textSec, fontSize: 14, fontWeight: '600' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyTxt:     { color: T.textSec, fontSize: 17, fontWeight: '600', marginTop: 14 },
  retryBtn:     { marginTop: 16, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: T.blue },
  resultCount:  { color: T.textTert, fontSize: 12, marginBottom: 12, paddingHorizontal: 16, paddingTop: 4 },
  listContent:  { paddingHorizontal: 16, paddingBottom: 50 },
  colWrap:      { justifyContent: 'space-between', gap: 10 },
  resultCard:   { width: (W - 42) / 2, height: 220, borderRadius: 14, overflow: 'hidden', backgroundColor: T.surf },
  resultImg:    { width: '100%', height: '100%' },
  resultBadge:  { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  resultBadgeTxt:{ color: T.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  resultInfo:   { position: 'absolute', bottom: 10, left: 10, right: 10, gap: 4 },
  resultTitle:  { color: T.white, fontSize: 14, fontWeight: '700' },
  resultMetaTxt:{ color: 'rgba(255,255,255,0.6)', fontSize: 11 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();

  const [search,      setSearch]      = useState('');
  const [genre,       setGenre]       = useState('Tous');
  const [sortBy,      setSortBy]      = useState<SortOption>('Popularité');
  const [duration,    setDuration]    = useState<DurationBand>('Toutes');
  const [year,        setYear]        = useState('Toutes');
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [works,       setWorks]       = useState<Work[]>([]);
  const [trending,    setTrending]    = useState<Work[]>([]);
  const [popular,     setPopular]     = useState<Work[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(false);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(debRef.current);
  }, [search]);

  const loadWorks = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const data = await fetchWorks({
        tab: 'Catégories', search: debouncedSearch,
        genre, sortBy, duration, year,
      });
      setWorks(data);
    } catch { setError(true); }
    finally  { setLoading(false); }
  }, [debouncedSearch, genre, sortBy, duration, year]);

  useEffect(() => { loadWorks(); }, [loadWorks]);

  // Trending initial load
  useEffect(() => {
    fetchTrending(12).then(data => {
      setTrending(data);
      setPopular([...data].reverse());
    }).catch(() => {});
  }, []);

  const activeFilterCount = [
    genre !== 'Tous', sortBy !== 'Popularité', duration !== 'Toutes', year !== 'Toutes',
  ].filter(Boolean).length;

  const resetFilters = useCallback(() => {
    setGenre('Tous'); setSortBy('Popularité'); setDuration('Toutes'); setYear('Toutes');
  }, []);

  // Catégories
  const courtMetrage = useMemo(() => works.filter(w => w.duration < 60),                      [works]);
  const moyenMetrage = useMemo(() => works.filter(w => w.duration >= 60 && w.duration <= 100),[works]);
  const longMetrage  = useMemo(() => works.filter(w => w.duration > 100),                     [works]);

  const heroItem   = trending[0] ?? null;
  const isFiltered = !!(debouncedSearch.trim()) || activeFilterCount > 0;

  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <View style={ms.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Sticky header */}
      <Animated.View
        style={[ms.stickyHeader, {
          opacity: scrollY.interpolate({
            inputRange: [0, 120], outputRange: [1, 0], extrapolate: 'clamp',
          }),
        }]}
        pointerEvents="none"
      >
        <View style={ms.stickyInner}>
          <Text style={ms.stickyTitle}>UNIVERSE</Text>
        </View>

  

  

          {/* Search button */}
          <View style={ms.topRight} pointerEvents="box-none">
        <TouchableOpacity style={ms.searchBtn} onPress={() => setSearchOpen(true)}>
          <BlurView intensity={Platform.OS === 'ios' ? 20 : 12} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="search" size={25} color={T.white} />
        </TouchableOpacity>
      </View>

                {/* Gift button */}
                <View style={{ position: 'absolute', top: Platform.OS === 'ios' ? 50 : 14, right: 68, zIndex: 100 }}>
        <TouchableOpacity style={[ms.searchBtn, { width: 36, height: 36 }]} onPress={() => router.push('/cadeau' as any)}>
          <BlurView intensity={Platform.OS === 'ios' ? 20 : 12} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="gift" size={25} color={T.white} />
        </TouchableOpacity> 
      </View>

      </Animated.View>



      {/* Search overlay */}
      <SearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        search={search} setSearch={setSearch}
        genre={genre} setGenre={setGenre}
        sortBy={sortBy} setSortBy={setSortBy}
        duration={duration} setDuration={setDuration}
        year={year} setYear={setYear}
        works={works} loading={loading} error={error} onRetry={loadWorks}
        activeFilterCount={activeFilterCount} onResetFilters={resetFilters}
      />

      {/* Main scroll */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ms.scroll}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* Hero */}
        <HeroBanner item={heroItem} />

        {/* ── Résultats filtrés ── */}
        {isFiltered ? (
          <RowSection
            title={debouncedSearch.trim() ? `"${debouncedSearch}"` : 'Résultats'}
            subtitle={!loading && !error ? `${works.length} œuvre${works.length > 1 ? 's' : ''}` : undefined}
            items={works}
            loading={loading}
            variant="portrait"
          />
        ) : (
          <>
            {/* Carrousel interactif tendances */}
            <TrendingCarousel items={trending} loading={trending.length === 0} />

            {/* Populaires */}
            <RowSection
              title="Les plus populaires"
              subtitle="Tous les temps"
              items={popular}
              loading={popular.length === 0}
              variant="portrait"
              onSeeAll={() => router.push('/popular' as any)}
            />

            {/* Par durée */}
            {(courtMetrage.length > 0 || loading) && (
              <RowSection title="Courts métrages" subtitle="Moins de 60 min" items={courtMetrage} loading={loading} variant="landscape" />
            )}
            {(moyenMetrage.length > 0 || loading) && (
              <RowSection title="Moyens métrages" subtitle="60 – 100 min" items={moyenMetrage} loading={loading} variant="landscape" />
            )}
            {(longMetrage.length > 0 || loading) && (
              <RowSection title="Longs métrages" subtitle="Plus de 100 min" items={longMetrage} loading={loading} variant="landscape" />
            )}

            {/* CTA Populaires */}
            <TouchableOpacity
              style={ms.banner}
              activeOpacity={0.85}
              onPress={() => router.push('/popular' as any)}
            >
              <BlurView intensity={25} tint="dark" style={ms.bannerBlur}>
                <LinearGradient
                  colors={['rgba(90,150,230,0.14)', 'rgba(90,150,230,0.04)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                <View style={ms.bannerLeft}>
                  <View style={ms.bannerIcon}>
                    <Ionicons name="flame" size={18} color={T.gold} />
                  </View>
                  <View>
                    <Text style={ms.bannerTitle}>Populaires cette semaine</Text>
                    <Text style={ms.bannerSub}>Voir tout le classement</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={T.blue} />
              </BlurView>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

const ms = StyleSheet.create({
  root:        { flex: 1, backgroundColor: T.bg },
  scroll:      { paddingBottom: 120 },
  stickyHeader:{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, height: Platform.OS === 'ios' ? 90 : 60 },
  stickyInner: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 10, marginTop: Platform.OS === 'ios' ? 44 : 0 },
  stickyTitle: { color: T.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  topLeft:     { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 14, left: 18, zIndex: 100 },
  topRight:    { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 14, right: 18, zIndex: 100 },
  searchBtn:   { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.surfBorder },
  banner:      { marginHorizontal: 20, marginBottom: 20, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: T.surfBorder },
  bannerBlur:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  bannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 13 },
  bannerIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: T.goldDim, justifyContent: 'center', alignItems: 'center' },
  bannerTitle: { color: T.text, fontSize: 15, fontWeight: '700' },
  bannerSub:   { color: T.textSec, fontSize: 12, marginTop: 2 },
});