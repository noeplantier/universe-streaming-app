/**
 * app/(tabs)/search.tsx — UNIVERSE · PROFESSIONAL EDITION
 *
 * Palette   : blanc (opacités variables) + C.navyMid uniquement
 * Icônes    : Ionicons partout, zéro emoji
 * Données   : 100 % Supabase — aucune valeur simulée
 *
 * Sections réelles :
 *   Hero      → top 20 par likes
 *   Populaires→ tri likes DESC
 *   Récents   → tri created_at DESC
 *   Originaux → is_original = true
 *   Courts    → duration < 60 min
 *   Moyens    → 60–100 min
 *   Séries    → > 100 min
 *
 * HeroBanner fix conservé :
 *   scrollToOffset (pas scrollToIndex),
 *   pas de getItemLayout sur le carrousel,
 *   windowSize = 5
 */

import React, {
  memo, useCallback, useEffect,
  useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, FlatList, Image,
  Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
  type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import { StatusBar }         from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase }     from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';

const { width: SW, height: SH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE — blanc + navyMid uniquement
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#070C17',
  navyMid:  '#0D2040',
  navyLow:  '#0A1830',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.82)',
  mid:      'rgba(255,255,255,0.55)',
  muted:    'rgba(255,255,255,0.36)',
  subtle:   'rgba(255,255,255,0.14)',
  faint:    'rgba(255,255,255,0.07)',
  border:   'rgba(255,255,255,0.09)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE
// ─────────────────────────────────────────────────────────────────────────────
interface Work {
  id:number; title:string; category:string; genre:string;
  year:number; likes:number; comments:number|null;
  image:string|null; is_original:boolean; adjective:string|null;
  duration:number|null; description:string|null; director:string|null;
  created_at?:string;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE
// ─────────────────────────────────────────────────────────────────────────────
function resolveImage(id:number, image:string|null): string {
  if (!image) return `https://picsum.photos/seed/work_${id}/400/600`;
  if (image.startsWith('http')) return image;
  try {
    const { data } = supabase.storage.from('community-images').getPublicUrl(image);
    return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/400/600`;
  } catch { return `https://picsum.photos/seed/work_${id}/400/600`; }
}

function fmtLikes(n:number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(n>=10_000?0:1)}K`;
  return `${n}`;
}

function fmtDuration(min:number|null): string {
  if (!min) return '';
  if (min >= 60) return `${Math.floor(min/60)}h${min%60>0?` ${min%60}min`:''}`;
  return `${min}min`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — données réelles uniquement
// ─────────────────────────────────────────────────────────────────────────────
const COLS =
  'id,title,category,genre,year,likes,comments,image,' +
  'is_original,adjective,duration,description,director,created_at';

async function fetchAllWorks(): Promise<Work[]> {
  const { data: first, count, error } = await supabase
    .from('works').select(COLS, { count:'exact' })
    .order('likes', { ascending:false }).limit(100);

  if (error) {
    const { data: fb } = await supabase.from('works').select(COLS)
      .order('likes', { ascending:false }).limit(100);
    return (fb ?? []) as Work[];
  }

  const batch1 = (first ?? []) as Work[];
  const total  = count ?? batch1.length;
  if (batch1.length >= total) return batch1;

  const extra = await Promise.all(
    Array.from({ length: Math.ceil((total - batch1.length) / 100) }, (_, i) =>
      supabase.from('works').select(COLS)
        .order('likes', { ascending:false })
        .range(batch1.length + i*100, batch1.length + (i+1)*100 - 1)
        .then(({ data }) => (data ?? []) as Work[])
    )
  );
  return [...batch1, ...extra.flat()].sort((a,b) => b.likes - a.likes);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({ w, h, r=8 }:{ w:number|string; h:number; r?:number }) {
  const op = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(op,{ toValue:0.38, duration:900, useNativeDriver:true }),
      Animated.timing(op,{ toValue:0.18, duration:900, useNativeDriver:true }),
    ]));
    a.start(); return () => a.stop();
  },[op]);
  return (
    <Animated.View style={{
      width:w as any, height:h, borderRadius:r,
      backgroundColor:C.navyMid, opacity:op,
    }}/>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// HERO SLIDE
// ─────────────────────────────────────────────────────────────────────────────
const HERO_H  = SH * 0.50;
const AUTO_MS = 5000;

const HeroSlide = memo(function HeroSlide({
  item, width, onPress,
}: { item:Work; width:number; onPress:()=>void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const uri  = useMemo(() => resolveImage(item.id, item.image), [item.id, item.image]);

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={{ width, height:HERO_H }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor:C.navyMid }]}/>

      <Animated.Image
        source={{ uri }} style={[StyleSheet.absoluteFill, { opacity:fade }]}
        resizeMode="cover"
        onLoad={() => Animated.timing(fade,{ toValue:1, duration:400, useNativeDriver:true }).start()}
        onError={() => Animated.timing(fade,{ toValue:0.5, duration:200, useNativeDriver:true }).start()}
      />

      <LinearGradient
        colors={['rgba(7,12,23,0.50)','transparent']}
        style={{ position:'absolute', top:0, left:0, right:0, height:140 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent','rgba(7,12,23,0.72)','rgba(7,12,23,0.97)']}
        style={{ position:'absolute', bottom:0, left:0, right:0, height:'65%' as any }}
        pointerEvents="none"
      />

      <View style={hs.content}>
        <View style={hs.metaRow}>
          {item.is_original && (
            <View style={hs.origBadge}>
              <Ionicons name="star" size={8} color={C.white}/>
              <Text style={hs.origTxt}>ORIGINAL</Text>
            </View>
          )}
          <View style={hs.catBadge}>
            <Text style={hs.catTxt}>{(item.category ?? 'FILM').toUpperCase()}</Text>
          </View>
        </View>

        <Text style={hs.title} numberOfLines={2}>{item.title ?? ''}</Text>

        {!!(item.adjective || item.genre) && (
          <Text style={hs.sub} numberOfLines={1}>
            {item.adjective || `${item.genre ?? ''}${item.year ? ` · ${item.year}` : ''}`}
          </Text>
        )}

        <View style={hs.statsRow}>
          <View style={hs.stat}>
            <Ionicons name="heart" size={11} color={C.mid}/>
            <Text style={hs.statTxt}>{fmtLikes(item.likes ?? 0)}</Text>
          </View>
          {item.duration != null && (
            <>
              <View style={hs.dot}/>
              <View style={hs.stat}>
                <Ionicons name="time-outline" size={11} color={C.mid}/>
                <Text style={hs.statTxt}>{fmtDuration(item.duration)}</Text>
              </View>
            </>
          )}
          {item.year != null && (
            <>
              <View style={hs.dot}/>
              <Text style={hs.statTxt}>{item.year}</Text>
            </>
          )}
        </View>

        <View style={hs.actions}>
          <TouchableOpacity style={hs.playBtn} onPress={onPress} activeOpacity={0.85}>
            <Ionicons name="play" size={14} color={C.navyMid}/>
            <Text style={hs.playTxt}>Regarder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={hs.infoBtn} onPress={onPress} activeOpacity={0.80}>
            <Ionicons name="information-circle-outline" size={14} color={C.white}/>
            <Text style={hs.infoTxt}>Détails</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const hs = StyleSheet.create({
  content:  { position:'absolute', bottom:0, left:0, right:0, paddingHorizontal:22, paddingBottom:52, gap:8 },
  metaRow:  { flexDirection:'row', alignItems:'center', gap:6 },
  origBadge:{ flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:6, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:'rgba(255,255,255,0.08)' },
  origTxt:  { color:C.white, fontSize:9, fontWeight:'800', letterSpacing:0.6 },
  catBadge: { paddingHorizontal:8, paddingVertical:3, borderRadius:6, backgroundColor:C.navyMid },
  catTxt:   { color:C.mid, fontSize:9, fontWeight:'700', letterSpacing:0.5 },
  title:    { color:C.white, fontSize:26, fontWeight:'800', letterSpacing:-0.4, lineHeight:32 },
  sub:      { color:C.muted, fontSize:13 },
  statsRow: { flexDirection:'row', alignItems:'center', gap:7 },
  stat:     { flexDirection:'row', alignItems:'center', gap:4 },
  statTxt:  { color:C.muted, fontSize:11, fontWeight:'600' },
  dot:      { width:3, height:3, borderRadius:1.5, backgroundColor:C.subtle },
  actions:  { flexDirection:'row', gap:10, marginTop:2 },
  playBtn:  { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:C.white, paddingHorizontal:20, paddingVertical:10, borderRadius:24 },
  playTxt:  { color:C.navyMid, fontSize:13, fontWeight:'700' },
  infoBtn:  { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:C.faint, paddingHorizontal:16, paddingVertical:10, borderRadius:24, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  infoTxt:  { color:C.white, fontSize:13, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// HERO BANNER — scrollToOffset, pas de getItemLayout
// ─────────────────────────────────────────────────────────────────────────────
const HeroBanner = memo(function HeroBanner({ works, loading }:{ works:Work[]; loading:boolean }) {
  const router  = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<FlatList<Work>>(null);
  const timer   = useRef<ReturnType<typeof setInterval>>();
  const paused  = useRef(false);
  const idxRef  = useRef(0);
  const [slotW, setSlotW] = useState(SW);

  const scrollTo = useCallback((i:number, animated=true) => {
    if (!works.length || slotW === 0) return;
    const next = ((i % works.length) + works.length) % works.length;
    flatRef.current?.scrollToOffset({ offset: next * slotW, animated });
    idxRef.current = next;
  },[works.length, slotW]);

  useEffect(() => {
    if (works.length < 2) return;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      if (!paused.current) scrollTo(idxRef.current + 1);
    }, AUTO_MS);
    return () => clearInterval(timer.current);
  },[works.length, scrollTo]);

  const onScroll = useMemo(() => Animated.event(
    [{ nativeEvent:{ contentOffset:{ x:scrollX } } }],
    { useNativeDriver:false },
  ),[scrollX]);

  const renderItem = useCallback(({ item }:ListRenderItemInfo<Work>) => (
    <HeroSlide item={item} width={slotW} onPress={() => router.push(`/film/${item.id}` as any)}/>
  ),[router, slotW]);

  const keyExtract = useCallback((w:Work) => `hero-${w.id}`, []);

  if (loading || !works.length) return (
    <View style={{ height:HERO_H, backgroundColor:C.navyLow }}>
      <View style={{ ...StyleSheet.absoluteFillObject, padding:22, justifyContent:'flex-end', gap:10 }}>
        <Shimmer w="50%" h={12}/><Shimmer w="75%" h={26}/>
        <Shimmer w="40%" h={11}/><Shimmer w="54%" h={40} r={24}/>
      </View>
    </View>
  );

  const dotCount = Math.min(works.length, 8);

  return (
    <View style={{ height:HERO_H, overflow:'hidden' }}
      onLayout={e => setSlotW(e.nativeEvent.layout.width)}>
      <FlatList
        ref={flatRef} data={works} keyExtractor={keyExtract} renderItem={renderItem}
        horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false}
        decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16}
        onScrollBeginDrag={() => { paused.current = true; }}
        onMomentumScrollEnd={e => {
          idxRef.current = Math.round(e.nativeEvent.contentOffset.x / slotW);
          paused.current = false;
        }}
        windowSize={5} initialNumToRender={3} maxToRenderPerBatch={3} removeClippedSubviews={false}
      />

      {works.length > 1 && (
        <View style={hb.dots}>
          {Array.from({ length:dotCount }).map((_,i) => {
            const inp = [(i-1)*slotW, i*slotW, (i+1)*slotW];
            return (
              <TouchableOpacity key={i} onPress={() => scrollTo(i)} hitSlop={10}>
                <Animated.View style={{
                  height:3, borderRadius:2, backgroundColor:C.white,
                  opacity: scrollX.interpolate({ inputRange:inp, outputRange:[0.25,1,0.25], extrapolate:'clamp' }),
                  width:   scrollX.interpolate({ inputRange:inp, outputRange:[6,20,6],      extrapolate:'clamp' }),
                }}/>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
});

const hb = StyleSheet.create({
  dots: { position:'absolute', bottom:14, left:0, right:0, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT CARD
// ─────────────────────────────────────────────────────────────────────────────
const PORT_W = 128, PORT_H = 190;

const PortraitCard = memo(function PortraitCard({ item, rank }:{ item:Work; rank?:number }) {
  const router = useRouter();
  const uri    = useMemo(() => resolveImage(item.id, item.image), [item.id, item.image]);
  return (
    <TouchableOpacity style={{ marginRight:10 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={prc.card}>
        <Image source={{ uri }} style={prc.img} resizeMode="cover"/>
        <LinearGradient colors={['transparent','rgba(7,12,23,0.90)']} style={StyleSheet.absoluteFillObject} start={{ x:0,y:0.4 }} end={{ x:0,y:1 }}/>

        {/* Badge catégorie */}
        <View style={prc.badge}>
          <Text style={prc.badgeTxt}>
            {item.is_original ? 'ORIG' : (item.category ?? '').slice(0,4).toUpperCase()}
          </Text>
        </View>

        {/* Numéro de rang */}
        {rank != null && (
          <Text style={prc.rankNum}>{rank}</Text>
        )}

        <View style={prc.meta}>
          <Text style={prc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="heart" size={9} color={C.mid}/>
            <Text style={prc.stat}>{fmtLikes(item.likes ?? 0)}</Text>
            {item.year && (
              <>
                <View style={prc.dot}/>
                <Text style={prc.stat}>{item.year}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const prc = StyleSheet.create({
  card:    { width:PORT_W, height:PORT_H, borderRadius:12, overflow:'hidden', backgroundColor:C.navyMid },
  img:     { width:'100%', height:'100%', resizeMode:'cover' },
  badge:   { position:'absolute', top:7, left:7, paddingHorizontal:5, paddingVertical:2.5, borderRadius:5, backgroundColor:'rgba(7,12,23,0.72)' },
  badgeTxt:{ color:C.mid, fontSize:7, fontWeight:'800', letterSpacing:0.4 },
  rankNum: { position:'absolute', bottom:32, right:6, fontSize:48, fontWeight:'900', lineHeight:48, letterSpacing:-3, color:'rgba(255,255,255,0.12)' },
  meta:    { position:'absolute', bottom:8, left:9, right:9, gap:3 },
  title:   { color:C.white, fontSize:11, fontWeight:'700', lineHeight:14 },
  stat:    { color:C.muted, fontSize:9, fontWeight:'600' },
  dot:     { width:2, height:2, borderRadius:1, backgroundColor:C.subtle },
});

// ─────────────────────────────────────────────────────────────────────────────
// LANDSCAPE CARD
// ─────────────────────────────────────────────────────────────────────────────
const LAND_W = 226, LAND_H = 128;

const LandscapeCard = memo(function LandscapeCard({ item }:{ item:Work }) {
  const router = useRouter();
  const uri    = useMemo(() => resolveImage(item.id, item.image), [item.id, item.image]);
  return (
    <TouchableOpacity style={{ marginRight:10 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={lc.card}>
        <Image source={{ uri }} style={lc.img} resizeMode="cover"/>
        <LinearGradient colors={['transparent','rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{ x:0.3,y:0 }} end={{ x:1,y:1 }}/>

        {item.duration != null && (
          <View style={lc.dur}>
            <Ionicons name="time-outline" size={8} color={C.muted}/>
            <Text style={lc.durTxt}>{fmtDuration(item.duration)}</Text>
          </View>
        )}

        <View style={lc.meta}>
          <Text style={lc.title} numberOfLines={1}>{item.title}</Text>
          {!!item.adjective && <Text style={lc.adj} numberOfLines={1}>{item.adjective}</Text>}
          <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
            <Ionicons name="heart" size={9} color={C.mid}/>
            <Text style={lc.stat}>{fmtLikes(item.likes ?? 0)}</Text>
            {item.director && (
              <>
                <View style={lc.dot}/>
                <Text style={lc.stat} numberOfLines={1}>{item.director}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const lc = StyleSheet.create({
  card:   { width:LAND_W, height:LAND_H, borderRadius:12, overflow:'hidden', backgroundColor:C.navyMid },
  img:    { width:'100%', height:'100%', resizeMode:'cover' },
  dur:    { position:'absolute', top:8, right:8, flexDirection:'row', alignItems:'center', gap:3, backgroundColor:'rgba(7,12,23,0.72)', paddingHorizontal:7, paddingVertical:3, borderRadius:7 },
  durTxt: { color:C.muted, fontSize:8, fontWeight:'600' },
  meta:   { position:'absolute', bottom:9, left:10, right:10, gap:2 },
  title:  { color:C.white, fontSize:12, fontWeight:'700' },
  adj:    { color:C.muted, fontSize:9 },
  stat:   { color:C.muted, fontSize:9, fontWeight:'600', flexShrink:1 },
  dot:    { width:2, height:2, borderRadius:1, backgroundColor:C.subtle },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROW SECTION
// ─────────────────────────────────────────────────────────────────────────────
const RowSection = memo(function RowSection({
  title, subtitle, count, items, loading, variant, showRank, onSeeAll,
}:{
  title:string; subtitle?:string; count?:number; items:Work[];
  loading:boolean; variant:'portrait'|'landscape';
  showRank?:boolean; onSeeAll?:()=>void;
}) {
  const isPort = variant === 'portrait';
  const CW     = isPort ? PORT_W : LAND_W;
  const CH     = isPort ? PORT_H : LAND_H;
  const SNAP   = CW + 10;

  const renderItem = useCallback(({ item, index }:{ item:Work; index:number }) =>
    isPort
      ? <PortraitCard  item={item} rank={showRank ? index+1 : undefined}/>
      : <LandscapeCard item={item}/>
  ,[isPort, showRank]);

  const getLayout  = useCallback((_:any, i:number) => ({ length:SNAP, offset:SNAP*i, index:i }), [SNAP]);
  const keyExtract = useCallback((w:Work) => `${variant}-${w.id}`, [variant]);

  if (loading) return (
    <View style={rs.section}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal:20, gap:10 }}>
        {[0,1,2,3,4].map(i => <Shimmer key={i} w={CW} h={CH} r={12}/>)}
      </ScrollView>
    </View>
  );

  if (!items.length) return null;

  return (
    <View style={rs.section}>
      <View style={rs.head}>
        <View style={{ flex:1, gap:2 }}>
          <Text style={rs.title}>{title}</Text>
          {(subtitle || count != null) && (
            <Text style={rs.sub}>
              {[subtitle, count != null ? `${count} œuvres` : null].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} style={rs.seeAllBtn} activeOpacity={0.75}>
            <Text style={rs.seeAllTxt}>Tout voir</Text>
            <Ionicons name="chevron-forward" size={11} color={C.muted}/>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal data={items} keyExtractor={keyExtract} renderItem={renderItem}
        getItemLayout={getLayout} showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal:20 }}
        decelerationRate="fast" snapToInterval={SNAP} snapToAlignment="start"
        initialNumToRender={6} maxToRenderPerBatch={8} windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
});

const rs = StyleSheet.create({
  section:  { marginBottom:0 },
  head:     { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingHorizontal:20, marginBottom:14 },
  title:    { color:C.white, fontSize:17, fontWeight:'800', letterSpacing:-0.3 },
  sub:      { color:C.muted, fontSize:11 },
  seeAllBtn:{ flexDirection:'row', alignItems:'center', gap:2, paddingTop:3 },
  seeAllTxt:{ color:C.muted, fontSize:11, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDER
// ─────────────────────────────────────────────────────────────────────────────
function Divider() {
  return <View style={{ height:StyleSheet.hairlineWidth, backgroundColor:C.faint, marginVertical:24, marginHorizontal:20 }}/>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
const SearchOverlay = memo(function SearchOverlay({
  visible, onClose, works,
}:{ visible:boolean; onClose:()=>void; works:Work[] }) {
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const inputRef  = useRef<TextInput>(null);
  const slideY    = useRef(new Animated.Value(SH)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY,{ toValue:0, useNativeDriver:true, tension:65, friction:10 }).start();
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    } else {
      setQ('');
      Animated.timing(slideY,{ toValue:SH, duration:220, useNativeDriver:true }).start();
    }
  },[visible, slideY]);

  const results = useMemo(() => {
    if (!q.trim()) return works.slice(0, 40);
    const lower = q.toLowerCase();
    return works.filter(w =>
      (w.title ?? '').toLowerCase().includes(lower) ||
      (w.genre ?? '').toLowerCase().includes(lower) ||
      (w.director ?? '').toLowerCase().includes(lower) ||
      (w.adjective ?? '').toLowerCase().includes(lower),
    ).slice(0, 80);
  },[q, works]);

  const CW     = (SW - 42) / 2;
  const goFilm = useCallback((id:number) => { onClose(); router.push(`/film/${id}` as any); },[onClose, router]);

  const renderResult = useCallback(({ item }:ListRenderItemInfo<Work>) => (
    <TouchableOpacity style={[so.card, { width:CW }]} onPress={() => goFilm(item.id)} activeOpacity={0.85}>
      <Image source={{ uri:resolveImage(item.id, item.image) }} style={so.cardImg} resizeMode="cover"/>
      <LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject}/>
      <View style={so.cardInfo}>
        <Text style={so.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
          <Ionicons name="heart" size={9} color={C.mid}/>
          <Text style={so.cardMeta}>{fmtLikes(item.likes ?? 0)}</Text>
          {item.duration != null && (
            <>
              <View style={so.dot}/>
              <Text style={so.cardMeta}>{fmtDuration(item.duration)}</Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  ),[goFilm, CW]);

  if (!visible) return null;

  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={so.backdrop}/>
      <Animated.View style={[so.root, { transform:[{ translateY:slideY }] }]}>
        {/* Barre de recherche */}
        <View style={[so.topBar, { paddingTop:insets.top + 10 }]}>
          <View style={so.inputRow}>
            <Ionicons name="search-outline" size={15} color={C.muted}/>
            <TextInput
              ref={inputRef} style={so.input} value={q} onChangeText={setQ}
              placeholder="Titre, genre, réalisateur…" placeholderTextColor={C.muted}
              returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing"
            />
          </View>
          <TouchableOpacity onPress={onClose} style={{ paddingLeft:8 }}>
            <Text style={so.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View>

        <View style={so.countRow}>
          <Ionicons name="film-outline" size={11} color={C.muted}/>
          <Text style={so.count}>
            {results.length} résultat{results.length !== 1 ? 's' : ''}
            {q.trim() ? ` pour « ${q.trim()} »` : ' · Catalogue'}
          </Text>
        </View>

        {results.length === 0 ? (
          <View style={so.empty}>
            <Ionicons name="search-outline" size={36} color={C.subtle}/>
            <Text style={so.emptyTxt}>Aucun résultat</Text>
          </View>
        ) : (
          <FlatList
            data={results} keyExtractor={w => `s${w.id}`} renderItem={renderResult}
            numColumns={2} columnWrapperStyle={so.colWrap}
            contentContainerStyle={[so.listPad, { paddingBottom:insets.bottom + 40 }]}
            keyboardDismissMode="on-drag" removeClippedSubviews
            initialNumToRender={8} maxToRenderPerBatch={10} windowSize={5}
          />
        )}
      </Animated.View>
    </Modal>
  );
});

const so = StyleSheet.create({
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(7,12,23,0.98)' },
  root:      { flex:1 },
  topBar:    { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingBottom:10, gap:8 },
  inputRow:  { flex:1, flexDirection:'row', alignItems:'center', backgroundColor:C.navyMid, borderRadius:10, paddingHorizontal:12, height:40, gap:8, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  input:     { flex:1, color:C.white, fontSize:14 },
  cancelTxt: { color:C.muted, fontSize:14, fontWeight:'600' },
  countRow:  { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:16, marginBottom:12 },
  count:     { color:C.muted, fontSize:11 },
  empty:     { flex:1, alignItems:'center', justifyContent:'center', gap:10 },
  emptyTxt:  { color:C.mid, fontSize:15, fontWeight:'600' },
  listPad:   { paddingHorizontal:16 },
  colWrap:   { justifyContent:'space-between', gap:10, marginBottom:10 },
  card:      { height:200, borderRadius:12, overflow:'hidden', backgroundColor:C.navyMid },
  cardImg:   { width:'100%', height:'100%' },
  cardInfo:  { position:'absolute', bottom:8, left:9, right:9, gap:4 },
  cardTitle: { color:C.white, fontSize:12, fontWeight:'700' },
  cardMeta:  { color:C.muted, fontSize:10, fontWeight:'600' },
  dot:       { width:2, height:2, borderRadius:1, backgroundColor:C.subtle },
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

  useEffect(() => {
    let dead = false;
    setLoading(true);
    fetchAllWorks()
      .then(data => { if (!dead) { setWorks(data); setLoading(false); } })
      .catch(() =>  { if (!dead) setLoading(false); });
    return () => { dead = true; };
  },[]);

  // ── Sections — données réelles ──────────────────────────────────────────
  const heroItems = useMemo(() => works.slice(0, 20), [works]);
  const popular   = useMemo(() => works, [works]);

  // Récents : tri par created_at DESC
  const recent    = useMemo(() => (
    [...works].sort((a,b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    }).slice(0, 30)
  ),[works]);

  const originals = useMemo(() => works.filter(w => w.is_original), [works]);
  const courts    = useMemo(() => works.filter(w => (w.duration??0) > 0 && (w.duration??0) < 60),    [works]);
  const moyens    = useMemo(() => works.filter(w => (w.duration??0) >= 60 && (w.duration??0) <= 100),[works]);
  const longs     = useMemo(() => works.filter(w => (w.duration??0) > 100),                           [works]);

  const headerOp = scrollY.interpolate({ inputRange:[0,80], outputRange:[1,0], extrapolate:'clamp' });

  return (
    <View style={ss.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      {/* Header */}
      <Animated.View style={[ss.header, { opacity:headerOp, paddingTop:insets.top + 4 }]} pointerEvents="box-none">
        <Text style={ss.brand}>UNIVERSE</Text>
        <TouchableOpacity style={ss.searchBtn} onPress={() => setSearchOpen(true)} activeOpacity={0.78}>
          <Ionicons name="search-outline" size={18} color={C.white}/>
        </TouchableOpacity>
      </Animated.View>

      <SearchOverlay visible={searchOpen} onClose={() => setSearchOpen(false)} works={works}/>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom:0 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent:{ contentOffset:{ y:scrollY } } }],
          { useNativeDriver:true },
        )}
      >
        {/* ── Hero ── */}
        <HeroBanner works={heroItems} loading={loading}/>

        <View style={{ height:30 }}/>

        {/* ── Populaires ── */}
        <RowSection
          title="Les plus populaires"
          count={loading ? undefined : works.length}
          items={popular} loading={loading} variant="portrait" showRank
          onSeeAll={() => router.push('/popular' as any)}
        />

        <Divider/>

        {/* ── Récents ── */}
        {(recent.length > 0 || loading) && (
          <>
            <RowSection
              title="Récemment ajoutés"
              subtitle="Nouvelles œuvres"
              items={recent} loading={loading} variant="landscape"
            />
            <Divider/>
          </>
        )}

        {/* ── Originaux ── */}
        {(originals.length > 0 || loading) && (
          <>
            <RowSection
              title="Originaux Universe"
              subtitle="Créations exclusives"
              count={loading ? undefined : originals.length}
              items={originals} loading={loading} variant="portrait"
            />
            <Divider/>
          </>
        )}

        {/* ── Courts métrages ── */}
        {(courts.length > 0 || loading) && (
          <>
            <RowSection
              title="Courts métrages"
              subtitle="Moins de 60 min"
              count={loading ? undefined : courts.length}
              items={courts} loading={loading} variant="landscape"
            />
            <Divider/>
          </>
        )}

        {/* ── Moyens métrages ── */}
        {(moyens.length > 0 || loading) && (
          <>
            <RowSection
              title="Moyens métrages"
              subtitle="60 – 100 min"
              count={loading ? undefined : moyens.length}
              items={moyens} loading={loading} variant="landscape"
            />
            <Divider/>
          </>
        )}

        {/* ── Mini-séries ── */}
        {(longs.length > 0 || loading) && (
          <RowSection
            title="Mini-séries"
            subtitle="Plus de 100 min"
            count={loading ? undefined : longs.length}
            items={longs} loading={loading} variant="landscape"
          />
        )}

        <View style={{ height:120 }}/>
      </Animated.ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  root:      { flex:1, backgroundColor:C.bg },
  header:    { position:'absolute', top:5, left:0, right:0, zIndex:10, flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingBottom:8 },
  brand:     { flex:1, color:C.white, fontSize:30, fontWeight:'800', letterSpacing:-0.5 },
  searchBtn: { width:38, height:38, borderRadius:19, backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
});