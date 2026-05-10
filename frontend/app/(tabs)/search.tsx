/**
 * app/(tabs)/search.tsx
 *
 * Écran Découverte — entièrement auto-contenu (aucun import de composant
 * custom externe) pour éliminer toute risque d'"Element type is invalid".
 *
 * Chaque composant est défini dans ce fichier et correctement exporté.
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
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

const { width: SW, height: SH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:        '#0A0A0F',
  navy:      '#0D2240',
  navyBr:    '#1E4A7A',
  surf:      'rgba(13,34,64,0.55)',
  bord:      'rgba(255,255,255,0.08)',
  text:      '#F2F2F7',
  textSec:   '#8E8E93',
  textTert:  '#636366',
  blue:      '#5A96E6',
  gold:      '#F5C842',
  white:     '#FFFFFF',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE — miroir public.works
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
// IMAGE HELPER
// ─────────────────────────────────────────────────────────────────────────────
function resolveImage(w: Pick<Work, 'id' | 'image'>): string {
  if (!w.image) return `https://picsum.photos/seed/work_${w.id}/400/600`;
  if (w.image.startsWith('http')) return w.image;
  try {
    const { data } = supabase.storage.from('community-images').getPublicUrl(w.image);
    return data?.publicUrl ?? `https://picsum.photos/seed/work_${w.id}/400/600`;
  } catch {
    return `https://picsum.photos/seed/work_${w.id}/400/600`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — TOUTES les œuvres sans exception
//
// PostgREST applique un max_rows serveur (100–1000 selon le plan Supabase).
// Un batch=1000 peut être tronqué silencieusement si max_rows < 1000.
//
// Solution :
//   1. count exact pour connaître le total réel
//   2. Pages de 100 lignes (safe sur tous les plans)
//   3. Téléchargement parallèle pour minimiser la latence
// ─────────────────────────────────────────────────────────────────────────────
const COLS = 'id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director';
const PAGE = 100;

async function fetchAllWorks(): Promise<Work[]> {
  // 1. Compte total exact
  const { count, error: countErr } = await supabase
    .from('works')
    .select('id', { count: 'exact', head: true });

  if (countErr) {
    console.error('[fetchAllWorks] count:', countErr.message);
    return [];
  }

  const total = count ?? 0;
  if (total === 0) return [];

  // 2. Télécharge toutes les pages en parallèle (rapide + complet)
  const pageCount = Math.ceil(total / PAGE);
  const promises  = Array.from({ length: pageCount }, (_, i) =>
    supabase
      .from('works')
      .select(COLS)
      .order('likes', { ascending: false })
      .range(i * PAGE, i * PAGE + PAGE - 1)
      .then(({ data, error }) => {
        if (error) { console.warn('[fetchAllWorks] page', i, error.message); return [] as Work[]; }
        return (data ?? []) as Work[];
      }),
  );

  const pages = await Promise.all(promises);
  const all   = pages.flat();

  // 3. Re-trier (les pages parallèles peuvent arriver dans le désordre)
  all.sort((a, b) => b.likes - a.likes);

  console.log('[fetchAllWorks]', all.length, '/', total, 'oeuvres');
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) {
  const op = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [op]);
  return (
    <Animated.View style={{
      width: w as any, height: h, borderRadius: r,
      backgroundColor: 'rgba(255,255,255,0.09)', opacity: op,
    }} />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// HERO BANNER — carousel auto-play
// ─────────────────────────────────────────────────────────────────────────────
const HERO_H  = SH * 0.50;
const AUTO_MS = 4000;

const HeroSlide = memo(function HeroSlide({
  item, onPress,
}: { item: Work; onPress: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const uri  = useMemo(() => resolveImage(item), [item.image, item.id]);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      style={{ width: SW, height: HERO_H }}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.navy }]} />
      <Animated.Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { opacity: fade }]}
        resizeMode="cover"
        onLoad={() => Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start()}
        onError={() => Animated.timing(fade, { toValue: 0.6, duration: 200, useNativeDriver: true }).start()}
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
            {item.is_original ? '★ ORIGINAL' : item.category.toUpperCase()}
          </Text>
        </View>
        <Text style={hs.title} numberOfLines={2}>{item.title}</Text>
        <Text style={hs.adj} numberOfLines={1}>
          {item.adjective || `${item.genre} · ${item.year}`}
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
  content:  { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingBottom: 50, gap: 7 },
  badge:    { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7 },
  badgeTxt: { color: C.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  title:    { color: C.white, fontSize: 28, fontWeight: '800', letterSpacing: -0.4, lineHeight: 34 },
  adj:      { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontStyle: 'italic' },
  actions:  { flexDirection: 'row', gap: 12, marginTop: 4 },
  playBtn:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.white, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22 },
  playTxt:  { color: C.navy, fontSize: 14, fontWeight: '700' },
  infoBtn:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  infoTxt:  { color: C.white, fontSize: 14, fontWeight: '600' },
});

const HeroBanner = memo(function HeroBanner({
  works, loading,
}: { works: Work[]; loading: boolean }) {
  const router   = useRouter();
  const scrollX  = useRef(new Animated.Value(0)).current;
  const flatRef  = useRef<FlatList<Work>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const pauseRef = useRef(false);
  const idxRef   = useRef(0);

  const scrollTo = useCallback((i: number, animated = true) => {
    if (!works.length) return;
    const next = ((i % works.length) + works.length) % works.length;
    flatRef.current?.scrollToIndex({ index: next, animated });
    idxRef.current = next;
  }, [works.length]);

  useEffect(() => {
    if (works.length < 2) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!pauseRef.current) scrollTo(idxRef.current + 1);
    }, AUTO_MS);
    return () => clearInterval(timerRef.current);
  }, [works.length, scrollTo]);

  const onScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false },
  ), [scrollX]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<Work>) => (
    <HeroSlide item={item} onPress={() => router.push(`/film/${item.id}` as any)} />
  ), [router]);

  const getItemLayout = useCallback((_: any, i: number) => ({ length: SW, offset: SW * i, index: i }), []);
  const keyExtractor  = useCallback((w: Work) => String(w.id), []);

  if (loading || !works.length) {
    return <View style={{ height: HERO_H, backgroundColor: C.navy }}><View style={{ ...StyleSheet.absoluteFillObject, padding: 22, justifyContent: 'flex-end', gap: 10 }}><Shimmer w="60%" h={14} /><Shimmer w="78%" h={28} /><Shimmer w="45%" h={12} /><Shimmer w="55%" h={40} r={22} /></View></View>;
  }

  const dotCount = Math.min(works.length, 10);

  return (
    <View style={{ height: HERO_H, overflow: 'hidden' }}>
      <FlatList
        ref={flatRef}
        data={works}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        horizontal pagingEnabled bounces={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { pauseRef.current = true; }}
        onMomentumScrollEnd={e => {
          idxRef.current = Math.round(e.nativeEvent.contentOffset.x / SW);
          pauseRef.current = false;
        }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        removeClippedSubviews={false}
        onScrollToIndexFailed={() => {}}
      />
      {works.length > 1 && (
        <View style={hb.dots}>
          {Array.from({ length: dotCount }).map((_, i) => {
            const op = scrollX.interpolate({ inputRange: [(i-1)*SW, i*SW, (i+1)*SW], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
            const w  = scrollX.interpolate({ inputRange: [(i-1)*SW, i*SW, (i+1)*SW], outputRange: [6, 20, 6], extrapolate: 'clamp' });
            return (
              <TouchableOpacity key={i} onPress={() => scrollTo(i)} hitSlop={8}>
                <Animated.View style={{ height: 5, borderRadius: 3, backgroundColor: C.blue, opacity: op, width: w }} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
});

const hb = StyleSheet.create({
  dots: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT CARD
// ─────────────────────────────────────────────────────────────────────────────
const PORT_W = 128, PORT_H = 192;

const PortraitCard = memo(function PortraitCard({
  item, rank,
}: { item: Work; rank?: number }) {
  const router = useRouter();
  const uri    = useMemo(() => resolveImage(item), [item.image, item.id]);

  const rankColor =
    rank === 1 ? C.gold :
    rank === 2 ? '#C0C0C0' :
    rank === 3 ? '#CD7F32' :
    'rgba(255,255,255,0.42)';

  return (
    <TouchableOpacity
      style={{ marginRight: 12 }}
      onPress={() => router.push(`/film/${item.id}` as any)}
      activeOpacity={0.88}
    >
      <View style={pc.card}>
        <Image source={{ uri }} style={pc.img} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.82)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }}
        />
        <View style={[pc.badge, { backgroundColor: item.is_original ? C.navyBr : C.navy }]}>
          <Text style={pc.badgeTxt}>{item.is_original ? 'ORIG' : item.category.slice(0,4).toUpperCase()}</Text>
        </View>
        {rank != null && (
          <Text style={[pc.rankNum, { color: rankColor }]}>{rank}</Text>
        )}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="heart" size={9} color={C.gold} />
            <Text style={pc.stat}>{item.likes.toLocaleString('fr-FR')}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const pc = StyleSheet.create({
  card:     { width: PORT_W, height: PORT_H, borderRadius: 12, overflow: 'hidden', backgroundColor: C.navy },
  img:      { width: '100%', height: '100%', resizeMode: 'cover' },
  badge:    { position: 'absolute', top: 7, left: 7, paddingHorizontal: 5, paddingVertical: 2.5, borderRadius: 4 },
  badgeTxt: { color: C.white, fontSize: 7, fontWeight: '800', letterSpacing: 0.3 },
  rankNum:  { position: 'absolute', bottom: 30, right: 5, fontSize: 52, fontWeight: '900', lineHeight: 52, letterSpacing: -4, opacity: 0.9 },
  meta:     { position: 'absolute', bottom: 8, left: 8, right: 8, gap: 2 },
  title:    { color: C.white, fontSize: 11, fontWeight: '700', lineHeight: 14 },
  stat:     { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LANDSCAPE CARD
// ─────────────────────────────────────────────────────────────────────────────
const LAND_W = 230, LAND_H = 130;

const LandscapeCard = memo(function LandscapeCard({ item }: { item: Work }) {
  const router = useRouter();
  const uri    = useMemo(() => resolveImage(item), [item.image, item.id]);

  return (
    <TouchableOpacity
      style={{ marginRight: 12 }}
      onPress={() => router.push(`/film/${item.id}` as any)}
      activeOpacity={0.88}
    >
      <View style={lc.card}>
        <Image source={{ uri }} style={lc.img} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(2,8,16,0.90)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }}
        />
        {item.duration != null && (
          <View style={lc.dur}>
            <Ionicons name="time-outline" size={8} color="rgba(255,255,255,0.7)" />
            <Text style={lc.durTxt}>{item.duration}m</Text>
          </View>
        )}
        <View style={lc.meta}>
          <Text style={lc.title} numberOfLines={1}>{item.title}</Text>
          {item.adjective && <Text style={lc.adj} numberOfLines={1}>{item.adjective}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="heart" size={9} color={C.gold} />
            <Text style={lc.stat}>{item.likes.toLocaleString('fr-FR')}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const lc = StyleSheet.create({
  card:   { width: LAND_W, height: LAND_H, borderRadius: 12, overflow: 'hidden', backgroundColor: C.navy },
  img:    { width: '100%', height: '100%', resizeMode: 'cover' },
  dur:    { position: 'absolute', top: 7, right: 7, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(2,8,16,0.65)', paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 7 },
  durTxt: { color: 'rgba(255,255,255,0.75)', fontSize: 8, fontWeight: '600' },
  meta:   { position: 'absolute', bottom: 8, left: 9, right: 9, gap: 2 },
  title:  { color: C.white, fontSize: 12, fontWeight: '700' },
  adj:    { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontStyle: 'italic' },
  stat:   { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROW SECTION
// ─────────────────────────────────────────────────────────────────────────────
const RowSection = memo(function RowSection({
  title, subtitle, items, loading, variant, showRank, onSeeAll,
}: {
  title: string; subtitle?: string;
  items: Work[]; loading: boolean;
  variant: 'portrait' | 'landscape';
  showRank?: boolean; onSeeAll?: () => void;
}) {
  const isPort = variant === 'portrait';
  const snapW  = isPort ? PORT_W + 12 : LAND_W + 12;

  const renderItem = useCallback(({ item, index }: { item: Work; index: number }) =>
    isPort
      ? <PortraitCard  item={item} rank={showRank ? index + 1 : undefined} />
      : <LandscapeCard item={item} />,
  [isPort, showRank]);

  return (
    <View style={rs.section}>
      <View style={rs.head}>
        <View>
          <Text style={rs.sectionTitle}>{title}</Text>
          {subtitle && <Text style={rs.sectionSub}>{subtitle}</Text>}
        </View>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} style={rs.seeAll}>
            <Text style={rs.seeAllTxt}>Tout voir</Text>
            <Ionicons name="chevron-forward" size={13} color={C.blue} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {[0,1,2,3].map(i => (
            <Shimmer key={i} w={isPort ? PORT_W : LAND_W} h={isPort ? PORT_H : LAND_H} r={12} />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={w => String(w.id)}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          decelerationRate="fast"
          snapToInterval={snapW}
          snapToAlignment="start"
          removeClippedSubviews
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
        />
      )}
    </View>
  );
});

const rs = StyleSheet.create({
  section:      { marginBottom: 30 },
  head:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { color: C.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub:   { color: C.textTert, fontSize: 11, marginTop: 1 },
  seeAll:       { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllTxt:    { color: C.blue, fontSize: 12, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
const SearchOverlay = memo(function SearchOverlay({
  visible, onClose, works,
}: {
  visible: boolean; onClose: () => void; works: Work[];
}) {
  const router   = useRouter();
  const [q, setQ] = useState('');
  const inputRef = useRef<TextInput>(null);
  const slideY   = useRef(new Animated.Value(SH)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }).start();
      const t = setTimeout(() => inputRef.current?.focus(), 320);
      return () => clearTimeout(t);
    } else {
      setQ('');
      Animated.timing(slideY, { toValue: SH, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, slideY]);

  const results = useMemo(() => {
    if (!q.trim()) return works.slice(0, 40);
    const lower = q.toLowerCase();
    return works.filter(w =>
      w.title.toLowerCase().includes(lower) ||
      w.genre.toLowerCase().includes(lower) ||
      (w.director ?? '').toLowerCase().includes(lower),
    ).slice(0, 60);
  }, [q, works]);

  const goFilm = useCallback((id: number) => {
    onClose();
    router.push(`/film/${id}` as any);
  }, [onClose, router]);

  const renderResult = useCallback(({ item }: ListRenderItemInfo<Work>) => {
    const uri = resolveImage(item);
    return (
      <TouchableOpacity style={so.card} onPress={() => goFilm(item.id)} activeOpacity={0.85}>
        <Image source={{ uri }} style={so.cardImg} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(2,8,16,0.92)']} style={StyleSheet.absoluteFillObject} />
        <View style={so.cardInfo}>
          <Text style={so.cardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="heart" size={9} color={C.gold} />
            <Text style={so.cardMeta}>{item.likes.toLocaleString('fr-FR')}</Text>
            {item.duration != null && <Text style={[so.cardMeta, { color: C.textTert }]}>· {item.duration}m</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [goFilm]);

  if (!visible) return null;

  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={so.backdrop} />
      <Animated.View style={[so.root, { transform: [{ translateY: slideY }] }]}>
        <View style={so.topBar}>
          <View style={so.inputRow}>
            <Ionicons name="search" size={15} color={C.textSec} />
            <TextInput
              ref={inputRef}
              style={so.input}
              placeholder="Titre, genre, réalisateur…"
              placeholderTextColor={C.textTert}
              value={q}
              onChangeText={setQ}
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ('')} hitSlop={8}>
                <Ionicons name="close-circle" size={14} color={C.textSec} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={{ paddingLeft: 6 }}>
            <Text style={so.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View>

        {results.length === 0 ? (
          <View style={so.empty}>
            <Ionicons name="film-outline" size={42} color={C.textTert} />
            <Text style={so.emptyTxt}>Aucun résultat</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={w => String(w.id)}
            renderItem={renderResult}
            numColumns={2}
            columnWrapperStyle={so.colWrap}
            contentContainerStyle={so.listPad}
            ListHeaderComponent={
              <Text style={so.count}>{results.length} œuvre{results.length > 1 ? 's' : ''}</Text>
            }
            keyboardDismissMode="on-drag"
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        )}
      </Animated.View>
    </Modal>
  );
});

const so = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,15,0.96)' },
  root:     { flex: 1, paddingTop: Platform.OS === 'ios' ? 52 : 22 },
  topBar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10, gap: 8 },
  inputRow: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 10, height: 38, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  input:    { flex: 1, color: C.text, fontSize: 14 },
  cancelTxt:{ color: C.textSec, fontSize: 14, fontWeight: '600' },
  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTxt: { color: C.textSec, fontSize: 16, fontWeight: '600' },
  count:    { color: C.textTert, fontSize: 11, marginBottom: 10, paddingHorizontal: 16 },
  listPad:  { paddingHorizontal: 16, paddingBottom: 50 },
  colWrap:  { justifyContent: 'space-between', gap: 10 },
  card:     { width: (SW - 42) / 2, height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: C.surf, marginBottom: 0 },
  cardImg:  { width: '100%', height: '100%' },
  cardInfo: { position: 'absolute', bottom: 8, left: 9, right: 9, gap: 3 },
  cardTitle:{ color: C.white, fontSize: 13, fontWeight: '700' },
  cardMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [works,       setWorks]       = useState<Work[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [searchOpen,  setSearchOpen]  = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Fetch all works on mount
  useEffect(() => {
    let dead = false;
    fetchAllWorks()
      .then(data => { if (!dead) { setWorks(data); setLoading(false); } })
      .catch(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, []);

  // Derived slices
  const popular      = useMemo(() => works.slice(0, 20), [works]);
  const courtMetrage = useMemo(() => works.filter(w => (w.duration ?? 0) > 0 && (w.duration ?? 0) < 60).slice(0, 15), [works]);
  const moyenMetrage = useMemo(() => works.filter(w => (w.duration ?? 0) >= 60 && (w.duration ?? 0) <= 100).slice(0, 15), [works]);
  const longMetrage  = useMemo(() => works.filter(w => (w.duration ?? 0) > 100).slice(0, 15), [works]);
  const originals    = useMemo(() => works.filter(w => w.is_original).slice(0, 15), [works]);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100], outputRange: [1, 0], extrapolate: 'clamp',
  });

  return (
    <View style={ss.root}>
      <StatusBar style="light" />

      {/* Titre sticky disparaissant */}
      <Animated.View
        style={[ss.stickyTitle, { opacity: headerOpacity, paddingTop: insets.top }]}
        pointerEvents="none"
      >
        <Text style={ss.stickyTitleTxt}>UNIVERSE</Text>

      {/* Bouton recherche */}
      <View style={[ss.searchBtn, { top: insets.top + 10 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={ss.searchBtnInner}
          onPress={() => setSearchOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color={C.white} />
        </TouchableOpacity>
      </View>
            </Animated.View>


      {/* Overlay recherche */}
      <SearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        works={works}
      />

      {/* Scroll principal */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ss.scroll}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* Hero banner */}
        <HeroBanner works={works} loading={loading} />

        <View style={{ height: 28 }} />

        {/* Populaires */}
        <RowSection
          title="Les plus populaires"
          subtitle="Classés par likes"
          items={popular}
          loading={loading}
          variant="portrait"
          showRank
          onSeeAll={() => router.push('/popular' as any)}
        />

        {/* Originaux */}
        {(originals.length > 0 || loading) && (
          <RowSection
            title="Originaux"
            subtitle="Créations exclusives"
            items={originals}
            loading={loading}
            variant="portrait"
          />
        )}

        {/* Courts métrages */}
        {(courtMetrage.length > 0 || loading) && (
          <RowSection
            title="Courts métrages"
            subtitle="Moins de 60 min"
            items={courtMetrage}
            loading={loading}
            variant="landscape"
          />
        )}

        {/* Moyens métrages */}
        {(moyenMetrage.length > 0 || loading) && (
          <RowSection
            title="Moyens métrages"
            subtitle="60 – 100 min"
            items={moyenMetrage}
            loading={loading}
            variant="landscape"
          />
        )}

        {/* Longs métrages */}
        {(longMetrage.length > 0 || loading) && (
          <RowSection
            title="Mini-séries"
            subtitle="Plus de 100 min"
            items={longMetrage}
            loading={loading}
            variant="landscape"
          />
        )}

        <View style={{ height: 120 }} />
      </Animated.ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  scroll:       { paddingBottom: 40 },
  stickyTitle:  { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 20, paddingBottom: 8 },
  stickyTitleTxt:{ color: C.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  searchBtn:    { position: 'absolute', right: 16, zIndex: 20 },
  searchBtnInner:{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(13,34,64,0.70)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
});