/**
 * app/(tabs)/search.tsx
 *
 * ── CORRECTIF HERO BANNER ────────────────────────────────────────────────────
 *
 *  SYMPTÔME : slides 4+ vides dans le carousel
 *
 *  CAUSE : getItemLayout retournait length: SW (largeur écran).
 *    FlatList mesure les items après le rendu et trouve une légère différence
 *    (sous-pixel, padding interne, DPR). À partir du 3e ou 4e slide, l'offset
 *    cumulé s'écarte assez pour que le slide soit positionné hors de la fenêtre
 *    visible → rendu vide.
 *
 *  FIX :
 *    1. Suppression de getItemLayout → FlatList mesure lui-même, zéro dérive
 *    2. scrollToIndex() → scrollToOffset(index * SW) → calcul direct, fiable
 *    3. windowSize augmenté à 5 → 2 slides de chaque côté toujours rendus
 *    4. initialNumToRender = 3 → 3 premiers slides prêts dès le montage
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import { StatusBar }         from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase }     from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';

const { width: SW, height: SH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0A0A0F',
  navy:     '#0D2240',
  navyBr:   '#1E4A7A',
  surf:     'rgba(13,34,64,0.55)',
  bord:     'rgba(255,255,255,0.08)',
  text:     '#F2F2F7',
  textSec:  '#8E8E93',
  textTert: '#636366',
  blue:     '#5A96E6',
  gold:     '#F5C842',
  white:    '#FFFFFF',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE
// ─────────────────────────────────────────────────────────────────────────────
interface Work {
  id:          number;
  title:       string;
  category:    string;
  genre:       string;
  year:        number;
  likes:       number;
  comments:    number | null;
  image:       string | null;
  is_original: boolean;
  adjective:   string | null;
  duration:    number | null;
  description: string | null;
  director:    string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE
// ─────────────────────────────────────────────────────────────────────────────
function resolveImage(id: number, image: string | null): string {
  if (!image) return `https://picsum.photos/seed/work_${id}/400/600`;
  if (image.startsWith('http')) return image;
  try {
    const { data } = supabase.storage.from('community-images').getPublicUrl(image);
    return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/400/600`;
  } catch {
    return `https://picsum.photos/seed/work_${id}/400/600`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────────────────────
const COLS =
  'id,title,category,genre,year,likes,comments,image,' +
  'is_original,adjective,duration,description,director';

async function fetchAllWorks(): Promise<Work[]> {
  // 1. count + premier lot en une seule requête
  const { data: first, count, error } = await supabase
    .from('works')
    .select(COLS, { count: 'exact' })
    .order('likes', { ascending: false })
    .limit(100);

  if (error) {
    // Fallback sans count
    const { data: fb } = await supabase
      .from('works').select(COLS)
      .order('likes', { ascending: false }).limit(100);
    return (fb ?? []) as Work[];
  }

  const batch1 = (first ?? []) as Work[];
  const total  = count ?? batch1.length;
  if (batch1.length >= total) return batch1;

  // 2. Pages suivantes en parallèle
  const extra = await Promise.all(
    Array.from({ length: Math.ceil((total - batch1.length) / 100) }, (_, i) =>
      supabase
        .from('works').select(COLS)
        .order('likes', { ascending: false })
        .range(batch1.length + i * 100, batch1.length + (i + 1) * 100 - 1)
        .then(({ data }) => (data ?? []) as Work[])
    )
  );
  return [...batch1, ...extra.flat()].sort((a, b) => b.likes - a.likes);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) {
  const op = useRef(new Animated.Value(0.22)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.52, duration: 850, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.22, duration: 850, useNativeDriver: true }),
    ]));
    a.start(); return () => a.stop();
  }, [op]);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: 'rgba(255,255,255,0.09)', opacity: op }} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// HERO SLIDE
// ─────────────────────────────────────────────────────────────────────────────
const HERO_H  = SH * 0.50;
const AUTO_MS = 4200;

const HeroSlide = memo(function HeroSlide({
  item, width, onPress,
}: { item: Work; width: number; onPress: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  // URI toujours valide (picsum en fallback)
  const uri  = useMemo(() => resolveImage(item.id, item.image), [item.id, item.image]);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      // ★ Largeur passée en prop (= mesure réelle de FlatList) ★
      style={{ width, height: HERO_H }}
    >
      {/* Fond navy pendant le chargement de l'image */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.navy }]} />

      <Animated.Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { opacity: fade }]}
        resizeMode="cover"
        onLoad={() =>
          Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }).start()
        }
        onError={() =>
          Animated.timing(fade, { toValue: 0.55, duration: 200, useNativeDriver: true }).start()
        }
      />

      <LinearGradient
        colors={['rgba(10,10,15,0.55)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(10,10,15,0.75)', C.bg]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '62%' as any }}
        pointerEvents="none"
      />

      <View style={hs.content}>
        <View style={[hs.badge, { backgroundColor: item.is_original ? C.navyBr : C.navy }]}>
          <Text style={hs.badgeTxt}>
            {item.is_original ? '★ ORIGINAL' : (item.category ?? 'FILM').toUpperCase()}
          </Text>
        </View>

        <Text style={hs.title} numberOfLines={2}>{item.title ?? ''}</Text>

        <Text style={hs.adj} numberOfLines={1}>
          {item.adjective || `${item.genre ?? ''} · ${item.year ?? ''}`}
        </Text>

        <View style={hs.actions}>
          <TouchableOpacity style={hs.playBtn} onPress={onPress} activeOpacity={0.85}>
            <Ionicons name="play" size={15} color={C.navy} />
            <Text style={hs.playTxt}>Regarder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={hs.infoBtn} onPress={onPress} activeOpacity={0.80}>
            <Ionicons name="information-circle-outline" size={15} color={C.white} />
            <Text style={hs.infoTxt}>Infos</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const hs = StyleSheet.create({
  content:  { position:'absolute', bottom:0, left:0, right:0, paddingHorizontal:22, paddingBottom:50, gap:7 },
  badge:    { alignSelf:'flex-start', paddingHorizontal:9, paddingVertical:4, borderRadius:7 },
  badgeTxt: { color:C.white, fontSize:10, fontWeight:'800', letterSpacing:0.5 },
  title:    { color:C.white, fontSize:28, fontWeight:'800', letterSpacing:-0.4, lineHeight:34 },
  adj:      { color:'rgba(255,255,255,0.55)', fontSize:13, fontStyle:'italic' },
  actions:  { flexDirection:'row', gap:12, marginTop:4 },
  playBtn:  { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:C.white, paddingHorizontal:20, paddingVertical:10, borderRadius:22 },
  playTxt:  { color:C.navy, fontSize:14, fontWeight:'700' },
  infoBtn:  { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:'rgba(255,255,255,0.18)', paddingHorizontal:18, paddingVertical:10, borderRadius:22, borderWidth:1, borderColor:'rgba(255,255,255,0.20)' },
  infoTxt:  { color:C.white, fontSize:14, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// HERO BANNER
//
//  ★ CORRECTIF PRINCIPAL ★
//
//  Ancienne version : getItemLayout + scrollToIndex
//    → offset cumulé divergeait → slides vides à partir du 3e
//
//  Nouvelle version : pas de getItemLayout + scrollToOffset
//    → FlatList mesure lui-même chaque slide → positions exactes
//    → scrollToOffset(index * slotW) → positionnement pixel-perfect
//
//  slotW est mesuré via onLayout sur le conteneur
//  (évite toute dépendance à SW qui peut différer légèrement)
// ─────────────────────────────────────────────────────────────────────────────
const HeroBanner = memo(function HeroBanner({
  works, loading,
}: { works: Work[]; loading: boolean }) {
  const router  = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<FlatList<Work>>(null);
  const timer   = useRef<ReturnType<typeof setInterval>>();
  const paused  = useRef(false);
  const idxRef  = useRef(0);

  // Largeur réelle du conteneur (mesurée une fois au montage)
  const [slotW, setSlotW] = useState(SW);

  // ── Scroll vers l'index N ──────────────────────────────────────────────────
  // ★ scrollToOffset au lieu de scrollToIndex → pas de dépendance à getItemLayout
  const scrollTo = useCallback((i: number, animated = true) => {
    if (!works.length || slotW === 0) return;
    const next = ((i % works.length) + works.length) % works.length;
    flatRef.current?.scrollToOffset({ offset: next * slotW, animated });
    idxRef.current = next;
  }, [works.length, slotW]);

  // Auto-scroll
  useEffect(() => {
    if (works.length < 2) return;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      if (!paused.current) scrollTo(idxRef.current + 1);
    }, AUTO_MS);
    return () => clearInterval(timer.current);
  }, [works.length, scrollTo]);

  const onScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false },
  ), [scrollX]);

  // ★ width passée au slide = slotW mesuré (pas SW) ★
  const renderItem = useCallback(({ item }: ListRenderItemInfo<Work>) => (
    <HeroSlide
      item={item}
      width={slotW}
      onPress={() => router.push(`/film/${item.id}` as any)}
    />
  ), [router, slotW]);

  const keyExtract = useCallback((w: Work) => `hero-${w.id}`, []);

  if (loading || !works.length) {
    return (
      <View style={{ height: HERO_H, backgroundColor: C.navy }}>
        <View style={{ ...StyleSheet.absoluteFillObject, padding:22, justifyContent:'flex-end', gap:10 }}>
          <Shimmer w="60%" h={14} /><Shimmer w="78%" h={28} />
          <Shimmer w="45%" h={12} /><Shimmer w="55%" h={40} r={22} />
        </View>
      </View>
    );
  }

  const dotCount = Math.min(works.length, 10);

  return (
    <View
      style={{ height: HERO_H, overflow: 'hidden' }}
      onLayout={e => setSlotW(e.nativeEvent.layout.width)}
    >
      <FlatList
        ref={flatRef}
        data={works}
        keyExtractor={keyExtract}
        renderItem={renderItem}

        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"

        // ★ PAS de getItemLayout → FlatList mesure chaque slide lui-même
        //   → positions toujours exactes → plus de slides vides ★

        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { paused.current = true; }}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / slotW);
          idxRef.current = idx;
          paused.current = false;
        }}

        // Performances
        windowSize={5}           // 2 slides de chaque côté toujours en mémoire
        initialNumToRender={3}   // 3 premiers slides prêts au montage
        maxToRenderPerBatch={3}
        removeClippedSubviews={false}
      />

      {/* Dots de pagination */}
      {works.length > 1 && (
        <View style={hb.dots}>
          {Array.from({ length: dotCount }).map((_, i) => {
            const inp = [(i - 1) * slotW, i * slotW, (i + 1) * slotW];
            return (
              <TouchableOpacity key={i} onPress={() => scrollTo(i)} hitSlop={8}>
                <Animated.View style={{
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: C.blue,
                  opacity: scrollX.interpolate({ inputRange: inp, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' }),
                  width:   scrollX.interpolate({ inputRange: inp, outputRange: [6, 20, 6],      extrapolate: 'clamp' }),
                }} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
});

const hb = StyleSheet.create({
  dots: { position:'absolute', bottom:16, left:0, right:0, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT CARD
// ─────────────────────────────────────────────────────────────────────────────
const PORT_W = 128, PORT_H = 192;

const PortraitCard = memo(function PortraitCard({ item, rank }: { item: Work; rank?: number }) {
  const router = useRouter();
  const uri    = useMemo(() => resolveImage(item.id, item.image), [item.id, item.image]);
  const rankColor = rank === 1 ? C.gold : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(255,255,255,0.42)';

  return (
    <TouchableOpacity style={{ marginRight:12 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={pc.card}>
        <Image source={{ uri }} style={pc.img} resizeMode="cover" />
        <LinearGradient colors={['transparent','rgba(2,8,16,0.82)']} style={StyleSheet.absoluteFillObject} start={{ x:0,y:0.4 }} end={{ x:0,y:1 }} />
        <View style={[pc.badge, { backgroundColor: item.is_original ? C.navyBr : C.navy }]}>
          <Text style={pc.badgeTxt}>{item.is_original ? 'ORIG' : (item.category ?? '').slice(0,4).toUpperCase()}</Text>
        </View>
        {rank != null && <Text style={[pc.rankNum, { color: rankColor }]}>{rank}</Text>}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
            <Ionicons name="heart" size={9} color={C.gold} />
            <Text style={pc.stat}>{(item.likes ?? 0).toLocaleString('fr-FR')}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const pc = StyleSheet.create({
  card:    { width:PORT_W, height:PORT_H, borderRadius:12, overflow:'hidden', backgroundColor:C.navy },
  img:     { width:'100%', height:'100%', resizeMode:'cover' },
  badge:   { position:'absolute', top:7, left:7, paddingHorizontal:5, paddingVertical:2.5, borderRadius:4 },
  badgeTxt:{ color:C.white, fontSize:7, fontWeight:'800', letterSpacing:0.3 },
  rankNum: { position:'absolute', bottom:30, right:5, fontSize:52, fontWeight:'900', lineHeight:52, letterSpacing:-4, opacity:0.9 },
  meta:    { position:'absolute', bottom:8, left:8, right:8, gap:2 },
  title:   { color:C.white, fontSize:11, fontWeight:'700', lineHeight:14 },
  stat:    { color:'rgba(255,255,255,0.6)', fontSize:9 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LANDSCAPE CARD
// ─────────────────────────────────────────────────────────────────────────────
const LAND_W = 230, LAND_H = 130;

const LandscapeCard = memo(function LandscapeCard({ item }: { item: Work }) {
  const router = useRouter();
  const uri    = useMemo(() => resolveImage(item.id, item.image), [item.id, item.image]);

  return (
    <TouchableOpacity style={{ marginRight:12 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={lc.card}>
        <Image source={{ uri }} style={lc.img} resizeMode="cover" />
        <LinearGradient colors={['transparent','rgba(2,8,16,0.90)']} style={StyleSheet.absoluteFillObject} start={{ x:0.3,y:0 }} end={{ x:1,y:1 }} />
        {item.duration != null && (
          <View style={lc.dur}>
            <Ionicons name="time-outline" size={8} color="rgba(255,255,255,0.7)" />
            <Text style={lc.durTxt}>{item.duration}m</Text>
          </View>
        )}
        <View style={lc.meta}>
          <Text style={lc.title} numberOfLines={1}>{item.title}</Text>
          {!!item.adjective && <Text style={lc.adj} numberOfLines={1}>{item.adjective}</Text>}
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="heart" size={9} color={C.gold} />
            <Text style={lc.stat}>{(item.likes ?? 0).toLocaleString('fr-FR')}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const lc = StyleSheet.create({
  card:   { width:LAND_W, height:LAND_H, borderRadius:12, overflow:'hidden', backgroundColor:C.navy },
  img:    { width:'100%', height:'100%', resizeMode:'cover' },
  dur:    { position:'absolute', top:7, right:7, flexDirection:'row', alignItems:'center', gap:2, backgroundColor:'rgba(2,8,16,0.65)', paddingHorizontal:6, paddingVertical:2.5, borderRadius:7 },
  durTxt: { color:'rgba(255,255,255,0.75)', fontSize:8, fontWeight:'600' },
  meta:   { position:'absolute', bottom:8, left:9, right:9, gap:2 },
  title:  { color:C.white, fontSize:12, fontWeight:'700' },
  adj:    { color:'rgba(255,255,255,0.45)', fontSize:9, fontStyle:'italic' },
  stat:   { color:'rgba(255,255,255,0.6)', fontSize:9 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROW SECTION
// ─────────────────────────────────────────────────────────────────────────────
const RowSection = memo(function RowSection({
  title, subtitle, items, loading, variant, showRank, onSeeAll,
}: {
  title: string; subtitle?: string; items: Work[]; loading: boolean;
  variant: 'portrait' | 'landscape'; showRank?: boolean; onSeeAll?: () => void;
}) {
  const isPort = variant === 'portrait';
  const CW     = isPort ? PORT_W : LAND_W;
  const CH     = isPort ? PORT_H : LAND_H;
  const SNAP   = CW + 12;

  const renderItem = useCallback(({ item, index }: { item: Work; index: number }) =>
    isPort
      ? <PortraitCard  item={item} rank={showRank ? index + 1 : undefined} />
      : <LandscapeCard item={item} />,
  [isPort, showRank]);

  const getLayout  = useCallback((_: any, i: number) => ({ length: SNAP, offset: SNAP * i, index: i }), [SNAP]);
  const keyExtract = useCallback((w: Work) => `${variant}-${w.id}`, [variant]);

  if (loading) {
    return (
      <View style={rs.section}>
        <View style={{ paddingHorizontal:20, marginBottom:14 }}><Shimmer w="40%" h={17} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:20, gap:12 }}>
          {[0,1,2,3,4].map(i => <Shimmer key={i} w={CW} h={CH} r={12} />)}
        </ScrollView>
      </View>
    );
  }

  if (!items.length) return null;

  return (
    <View style={rs.section}>
      <View style={rs.head}>
        <View>
          <Text style={rs.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={rs.sectionSub}>{subtitle}</Text>}
        </View>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} style={rs.seeAll}>
            <Text style={rs.seeAllTxt}>Tout voir</Text>
            <Ionicons name="chevron-forward" size={13} color={C.blue} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={keyExtract}
        renderItem={renderItem}
        getItemLayout={getLayout}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal:20 }}
        decelerationRate="fast"
        snapToInterval={SNAP}
        snapToAlignment="start"
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
});

const rs = StyleSheet.create({
  section:     { marginBottom:30 },
  head:        { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end', paddingHorizontal:20, marginBottom:14 },
  sectionTitle:{ color:C.text, fontSize:19, fontWeight:'800', letterSpacing:-0.3 },
  sectionSub:  { color:C.textTert, fontSize:11, marginTop:1 },
  seeAll:      { flexDirection:'row', alignItems:'center', gap:2 },
  seeAllTxt:   { color:C.blue, fontSize:12, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
const SearchOverlay = memo(function SearchOverlay({
  visible, onClose, works,
}: { visible: boolean; onClose: () => void; works: Work[] }) {
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const inputRef  = useRef<TextInput>(null);
  const slideY    = useRef(new Animated.Value(SH)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue:0, useNativeDriver:true, tension:65, friction:10 }).start();
      const t = setTimeout(() => inputRef.current?.focus(), 320);
      return () => clearTimeout(t);
    } else {
      setQ('');
      Animated.timing(slideY, { toValue:SH, duration:220, useNativeDriver:true }).start();
    }
  }, [visible, slideY]);

  const results = useMemo(() => {
    if (!q.trim()) return works.slice(0, 40);
    const lower = q.toLowerCase();
    return works.filter(w =>
      (w.title ?? '').toLowerCase().includes(lower) ||
      (w.genre ?? '').toLowerCase().includes(lower) ||
      (w.director ?? '').toLowerCase().includes(lower) ||
      (w.adjective ?? '').toLowerCase().includes(lower),
    ).slice(0, 80);
  }, [q, works]);

  const goFilm = useCallback((id: number) => { onClose(); router.push(`/film/${id}` as any); }, [onClose, router]);
  const CW     = (SW - 42) / 2;

  const renderResult = useCallback(({ item }: ListRenderItemInfo<Work>) => (
    <TouchableOpacity style={[so.card, { width: CW }]} onPress={() => goFilm(item.id)} activeOpacity={0.85}>
      <Image source={{ uri: resolveImage(item.id, item.image) }} style={so.cardImg} resizeMode="cover" />
      <LinearGradient colors={['transparent','rgba(2,8,16,0.92)']} style={StyleSheet.absoluteFillObject} />
      <View style={so.cardInfo}>
        <Text style={so.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <Ionicons name="heart" size={9} color={C.gold} />
          <Text style={so.cardMeta}>{(item.likes ?? 0).toLocaleString('fr-FR')}</Text>
          {item.duration != null && <Text style={[so.cardMeta, { color:C.textTert }]}>· {item.duration}m</Text>}
        </View>
      </View>
    </TouchableOpacity>
  ), [goFilm, CW]);

  if (!visible) return null;

  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={so.backdrop} />
      <Animated.View style={[so.root, { transform:[{ translateY:slideY }] }]}>
        <View style={[so.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={so.inputRow}>
            <Ionicons name="search" size={15} color={C.textSec} />
            <TextInput
              ref={inputRef} style={so.input} value={q} onChangeText={setQ}
              placeholder="Titre, genre, réalisateur…" placeholderTextColor={C.textTert}
              returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing"
            />
          </View>
          <TouchableOpacity onPress={onClose} style={{ paddingLeft:6 }}>
            <Text style={so.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View>
        <Text style={so.count}>
          {results.length} œuvre{results.length > 1 ? 's' : ''}
          {q.trim() ? ` · "${q.trim()}"` : ''}
        </Text>
        {results.length === 0 ? (
          <View style={so.empty}>
            <Ionicons name="film-outline" size={42} color={C.textTert} />
            <Text style={so.emptyTxt}>Aucun résultat</Text>
          </View>
        ) : (
          <FlatList
            data={results} keyExtractor={w => `s${w.id}`} renderItem={renderResult}
            numColumns={2} columnWrapperStyle={so.colWrap}
            contentContainerStyle={[so.listPad, { paddingBottom: insets.bottom + 40 }]}
            keyboardDismissMode="on-drag" removeClippedSubviews
            initialNumToRender={8} maxToRenderPerBatch={10} windowSize={5}
          />
        )}
      </Animated.View>
    </Modal>
  );
});

const so = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(10,10,15,0.97)' },
  root:     { flex:1 },
  topBar:   { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingBottom:10, gap:8 },
  inputRow: { flex:1, flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.07)', borderRadius:10, paddingHorizontal:10, height:40, gap:8, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.08)' },
  input:    { flex:1, color:C.text, fontSize:14 },
  cancelTxt:{ color:C.textSec, fontSize:14, fontWeight:'600' },
  count:    { color:C.textTert, fontSize:11, marginBottom:10, paddingHorizontal:16 },
  empty:    { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  emptyTxt: { color:C.textSec, fontSize:16, fontWeight:'600' },
  listPad:  { paddingHorizontal:16 },
  colWrap:  { justifyContent:'space-between', gap:10, marginBottom:10 },
  card:     { height:200, borderRadius:12, overflow:'hidden', backgroundColor:C.surf },
  cardImg:  { width:'100%', height:'100%' },
  cardInfo: { position:'absolute', bottom:8, left:9, right:9, gap:3 },
  cardTitle:{ color:C.white, fontSize:13, fontWeight:'700' },
  cardMeta: { color:'rgba(255,255,255,0.55)', fontSize:10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [works,      setWorks]      = useState<Work[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Fetch
  useEffect(() => {
    let dead = false;
    setLoading(true);
    fetchAllWorks()
      .then(data => { if (!dead) { setWorks(data); setLoading(false); } })
      .catch(() =>  { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, []);

  // Sections mémoïsées — aucun slice artificiel
  const heroItems = useMemo(() => works.slice(0, 20),  [works]);
  const popular   = useMemo(() => works,                [works]);
  const originals = useMemo(() => works.filter(w => w.is_original),                               [works]);
  const courts    = useMemo(() => works.filter(w => (w.duration ?? 0) > 0 && (w.duration ?? 0) < 60),   [works]);
  const moyens    = useMemo(() => works.filter(w => (w.duration ?? 0) >= 60 && (w.duration ?? 0) <= 100),[works]);
  const longs     = useMemo(() => works.filter(w => (w.duration ?? 0) > 100),                     [works]);

  const headerOp = scrollY.interpolate({ inputRange:[0,100], outputRange:[1,0], extrapolate:'clamp' });

  return (
    <View style={ss.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Header */}
      <Animated.View style={[ss.header, { opacity:headerOp, paddingTop:insets.top + 4 }]} pointerEvents="box-none">
        <Text style={ss.brand}>UNIVERSE</Text>
        <View style={ss.searchBtnWrap} pointerEvents="box-none">
          <TouchableOpacity style={ss.searchBtn} onPress={() => setSearchOpen(true)} activeOpacity={0.80}>
            <Ionicons name="search" size={20} color={C.white} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <SearchOverlay visible={searchOpen} onClose={() => setSearchOpen(false)} works={works} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ss.scroll}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {/* Hero — scroll par scroll entre les works */}
        <HeroBanner works={heroItems} loading={loading} />

        <View style={{ height:28 }} />

        <RowSection
          title="Les plus populaires"
          subtitle={loading ? '…' : `${works.length} œuvre${works.length > 1 ? 's' : ''}`}
          items={popular} loading={loading} variant="portrait" showRank
          onSeeAll={() => router.push('/popular' as any)}
        />

        {(originals.length > 0 || loading) && (
          <RowSection title="Originaux" subtitle="Créations exclusives" items={originals} loading={loading} variant="portrait" />
        )}

        {(courts.length > 0 || loading) && (
          <RowSection title="Courts métrages" subtitle="Moins de 60 min" items={courts} loading={loading} variant="landscape" />
        )}

        {(moyens.length > 0 || loading) && (
          <RowSection title="Moyens métrages" subtitle="60 – 100 min" items={moyens} loading={loading} variant="landscape" />
        )}

        {(longs.length > 0 || loading) && (
          <RowSection title="Mini-séries" subtitle="Plus de 100 min" items={longs} loading={loading} variant="landscape" />
        )}

        <View style={{ height:120 }} />
      </Animated.ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  root:         { flex:1, backgroundColor:C.bg },
  scroll:       { paddingBottom:40 },
  header:       { position:'absolute', top:0, left:0, right:0, zIndex:10, flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingBottom:8 },
  brand:        { color:C.text, fontSize:32, fontWeight:'800', letterSpacing:-0.5, flex:1 },
  searchBtnWrap:{ zIndex:20 },
  searchBtn:    { width:40, height:40, borderRadius:20, backgroundColor:'rgba(13,34,64,0.70)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.10)' },
});