import React, { memo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  FlatList,
  Dimensions,
  Image,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

export interface Work {
  id: number;
  title: string;
  category: string;
  genre: string;
  year: number;
  likes: number;
  comments: number | null;
  image: string | null;
  is_original: boolean;
  adjective: string | null;
  duration: number | null;
  description: string | null;
  director: string | null;
  cast_list: string[] | null;
  created_at: string;
}

const { width: SCREEN_W } = Dimensions.get('window');
const CAROUSEL_ITEM_W = SCREEN_W * 0.8;
const CAROUSEL_ITEM_H = CAROUSEL_ITEM_W * 1.5;
const CAROUSEL_SPACING = 16;

const T = {
  navyMid: '#1a2235',
  gold: '#f5c842',
  blue: '#3b82f6',
  white: '#ffffff',
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const cc = StyleSheet.create({
  card: { width: CAROUSEL_ITEM_W, height: CAROUSEL_ITEM_H, borderRadius: 22, overflow: 'hidden', backgroundColor: T.navyMid },
  img: { width: '115%', height: '100%', position: 'absolute', left: '-7.5%' as any },
  rankWrap: { position: 'absolute', top: 0, right: 0, bottom: '35%', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 12 },
  rankNum: { fontSize: 96, fontWeight: '900', lineHeight: 96, letterSpacing: -6, opacity: 0.9, color: 'rgba(255,255,255,0.2)' },
  originalBadge: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,200,66,0.18)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(245,200,66,0.4)' },
  originalTxt: { color: T.gold, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  info: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, gap: 5 },
  genre: { color: T.blue, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  title: { color: T.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, lineHeight: 25 },
  adj: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontStyle: 'italic' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(2,8,16,0.55)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' },
  chipTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  rankBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, borderWidth: 1.5, borderColor: 'transparent' },
  dot: { height: 5, borderRadius: 3, backgroundColor: T.blue },
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT CARTE (MEMOISÉ)
// ─────────────────────────────────────────────────────────────────────────────

const TrendingCard = memo(({ item, index }: { item: Work; index: number }) => {
  return (
    <View style={cc.card}>
      {item.image && (
        <Image source={{ uri: item.image }} style={cc.img} resizeMode="cover" />
      )}
      
      {item.is_original && (
        <View style={cc.originalBadge}>
          <Text style={cc.originalTxt}>ORIGINAL</Text>
        </View>
      )}

      <View style={cc.rankWrap}>
        <Text style={cc.rankNum}>{index + 1}</Text>
      </View>

      <View style={cc.info}>
        <Text style={cc.genre}>{item.genre?.toUpperCase()}</Text>
        <Text style={cc.title} numberOfLines={2}>{item.title}</Text>
        {item.adjective && <Text style={cc.adj}>{item.adjective}</Text>}

        <View style={cc.stats}>
          <View style={cc.chip}>
            <Text style={cc.chipTxt}>{item.year}</Text>
          </View>
          {item.duration && (
            <View style={cc.chip}>
              <Text style={cc.chipTxt}>{item.duration} min</Text>
            </View>
          )}
          <View style={cc.chip}>
            <Text style={cc.chipTxt}>{item.category}</Text>
          </View>
        </View>
      </View>
      <View style={cc.rankBorder} />
    </View>
  );
});

TrendingCard.displayName = 'TrendingCard';

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────

interface TrendingCarouselProps {
  items: Work[];
  loading: boolean;
}

export const TrendingCarousel = memo(function TrendingCarousel({ items, loading }: TrendingCarouselProps) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<FlatList>(null);
  const snapIv = CAROUSEL_ITEM_W + CAROUSEL_SPACING;

  // Extracteurs et rendu factorisés pour la performance
  const keyExtractor = useCallback((item: Work) => item.id.toString(), []);
  
  const renderItem = useCallback(({ item, index }: { item: Work; index: number }) => (
    <View style={{ marginRight: CAROUSEL_SPACING }}>
      <TrendingCard item={item} index={index} />
    </View>
  ), []);

  // Calcul exact des positions pour éviter au moteur de list de devoir reflow les layout
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: snapIv,
    offset: snapIv * index,
    index,
  }), [snapIv]);

  if (loading) {
    return (
      <View style={{ height: CAROUSEL_ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: T.white }}>Chargement...</Text>
      </View>
    );
  }

  return (
    <Animated.FlatList
      ref={flatRef}
      data={items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={snapIv}
      decelerationRate="fast"
      bounces={false}
      contentContainerStyle={{ paddingHorizontal: CAROUSEL_SPACING }}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true }
      )}
      scrollEventThrottle={16}
      
      // OPTIMISATIONS POUR LE FETCH ET RENDU DES LISTES
      removeClippedSubviews={true}
      getItemLayout={getItemLayout}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
      windowSize={5}
    />
  );
});