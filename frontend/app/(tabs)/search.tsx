import React, {
  useState, useEffect, useRef, useMemo,
  useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, TextInput, Dimensions, Platform,
  Animated, Easing, Modal, ActivityIndicator, Pressable,
  FlatList, ImageBackground,
} from 'react-native';
import { BlurView }       from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { StatusBar }      from 'expo-status-bar';
import { useRouter }      from 'expo-router';
import GalaxyBackground   from '@/components/social/GalaxyBackground';

import {
  fetchWorks, fetchTrending,
  type Work, type SortOption, type DurationBand,
} from '@/lib/supabase';
import { C } from '@/components/create/tokens';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────
// 🎨 DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────
const T = {
  bg:        '#0A0A0F',
  bg1:       '#111118',
  bg2:       '#16161F',
  surf:      'rgba(255,255,255,0.055)',
  surfBorder:'rgba(255,255,255,0.08)',
  textPrim:  '#F2F2F7',
  textSec:   '#8E8E93',
  textTert:  '#636366',
  gold:      '#F2F2F7',
  goldSoft:  'rgba(245,166,35,0.18)',
  blue:      '#0A84FF',
  blueSoft: C.navyMid,
  badgePink: C.navyMid,
  badgePurp: C.navyMid,
  badgeTeal: C.navyMid,
};

// ─────────────────────────────────────────────────────────────────
// CARD DIMENSIONS
// ─────────────────────────────────────────────────────────────────
const PORT_W = 130;
const PORT_H = 195;
const LAND_W = 240;
const LAND_H = 135;
const HERO_H = H * 0.52;

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const GENRES    = ['Tous', 'Thriller', 'Drame', 'Sci-Fi', 'Action'];
const SORT_OPT: SortOption[]    = ['Popularité', 'Récent', 'Anciens'];
const DURATIONS: DurationBand[] = ['Toutes', '< 60 min', '60–100 min', '> 100 min'];
const YEARS     = ['Toutes', '2024', '2023', '2022'];


// ─────────────────────────────────────────────────────────────────
// ── SEARCH OVERLAY
//    Filtre compacts en rectangles discrets remplaçant la barre
// ─────────────────────────────────────────────────────────────────
interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  search: string;
  setSearch: (v: string) => void;
  genre: string; setGenre: (v: string) => void;
  sortBy: SortOption; setSortBy: (v: SortOption) => void;
  duration: DurationBand; setDuration: (v: DurationBand) => void;
  year: string; setYear: (v: string) => void;
  works: Work[]; loading: boolean; error: boolean;
  onRetry: () => void;
  activeFilterCount: number;
  onResetFilters: () => void;
  openDropdown: (key: string, ev: any) => void;
  openDrop: string | null;
  setOpenDrop: (v: string | null) => void;
  dropAnchor: { x: number; y: number };
}


const SearchOverlay = memo(({
  visible, onClose,
  search, setSearch,
  genre, setGenre,
  sortBy, setSortBy,
  duration, setDuration,
  year, setYear,
  works, loading, error, onRetry,
  activeFilterCount, onResetFilters,
  openDropdown, openDrop, setOpenDrop, dropAnchor,
}: SearchOverlayProps) => {
  const router    = useRouter();
  const slideY    = useRef(new Animated.Value(H)).current;
  const inputRef  = useRef<TextInput>(null);

  // Phase : 'search' → barre active | 'filter' → rectangles filtres
  const [phase, setPhase] = useState<'search' | 'filter'>('search');

  useEffect(() => {
    if (visible) {
      setPhase('search');
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }).start();
      setTimeout(() => inputRef.current?.focus(), 350);
    } else {
      setPhase('search');
      Animated.timing(slideY, { toValue: H, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible]);

  const filterValues: Record<string, string> = {
    genre, sort: sortBy, duration, year,
  };


  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
    
      <Animated.View style={[so.root, { transform: [{ translateY: slideY }] }]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={so.inner}>

          {/* ── TOPBAR : barre de recherche OU rectangles filtres ── */}
          <View style={so.topBar}>

            {phase === 'search' ? (
              /* ── MODE RECHERCHE ── */
              <>
                <View style={so.inputRow}>
                  <Ionicons name="search" size={16} color={T.textSec} style={{ marginRight: 8 }} />
                  <TextInput
                    ref={inputRef}
                    style={so.input}
                    placeholder="Titre, genre, ambiance…"
                    placeholderTextColor={T.textTert}
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} style={so.clearBtn}>
                      <Ionicons name="close-circle" size={15} color={T.textSec} />
                    </TouchableOpacity>
                  )}
                </View>

             

                <TouchableOpacity onPress={onClose} style={so.cancelBtn}>
                  <Text style={so.cancelTxt}>Annuler</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ── MODE FILTRES — rectangles discrets ── */
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flex: 1 }}
                  contentContainerStyle={so.filterRectRow}
                >
               

                  {activeFilterCount > 0 && (
                    <TouchableOpacity style={so.resetRect} onPress={onResetFilters}>
                      <Ionicons name="close" size={11} color={T.textSec} />
                    </TouchableOpacity>
                  )}
                </ScrollView>

                {/* Retour à la recherche */}
                <TouchableOpacity
                  style={so.backSearchBtn}
                  onPress={() => setPhase('search')}
                >
                  <Ionicons name="search-outline" size={15} color={T.textSec} />
                </TouchableOpacity>

                <TouchableOpacity onPress={onClose} style={so.cancelBtn}>
                  <Text style={so.cancelTxt}>Annuler</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── RÉSULTATS ── */}


          <ScrollView
            contentContainerStyle={so.resultsContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={so.loadRow}>
                <ActivityIndicator color={T.gold} />
              </View>
            ) : error ? (
              <View style={so.emptyWrap}>
                <Ionicons name="cloud-offline-outline" size={44} color={T.textTert} />
                <Text style={so.emptyTxt}>Erreur de chargement</Text>
                <TouchableOpacity onPress={onRetry} style={so.retryBtn}>
                  <Text style={{ color: T.gold, fontWeight: '700', fontSize: 14 }}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            ) : works.length === 0 ? (
              <View style={so.emptyWrap}>
                <Ionicons name="film-outline" size={44} color={T.textTert} />
                <Text style={so.emptyTxt}>Aucun résultat</Text>
                <Text style={so.emptySub}>Essayez d'autres mots-clés ou filtres</Text>
              </View>
            ) : (
              <>
                <Text style={so.resultCount}>{works.length} œuvre{works.length > 1 ? 's' : ''}</Text>
                <View style={so.grid}>
                  {works.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={so.resultCard}
                      onPress={() => { onClose(); router.push(`/film/${item.id}`); }}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: item.image ?? `https://picsum.photos/seed/${item.id}/300/450` }}
                        style={so.resultImg}
                      />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFillObject} />
                      <View style={[so.resultBadge, { backgroundColor: item.is_original ? T.badgePurp : T.badgePink }]}>
                        <Text style={so.resultBadgeTxt}>{item.category.toUpperCase()}</Text>
                      </View>
                      <View style={so.resultInfo}>
                        <Text style={so.resultTitle} numberOfLines={2}>{item.title}</Text>
                        <View style={so.resultMeta}>
                          <Ionicons name="heart" size={10} color={T.gold} />
                          <Text style={so.resultMetaTxt}>{item.likes}</Text>
                          <Text style={[so.resultMetaTxt, { color: T.textTert }]}>· {item.duration}m</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
});
SearchOverlay.displayName = 'SearchOverlay';

const so = StyleSheet.create({
  root:          { flex: 1, backgroundColor: 'transparent' },
  inner:         { flex: 1, paddingTop: Platform.OS === 'ios' ? 54 : 24 },

  // ── Top bar ──
  topBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10, gap: 8 },

  // Barre recherche
  inputRow:      { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 11, height: 38, borderWidth: StyleSheet.hairlineWidth, borderColor: T.surfBorder },
  input:         { flex: 1, color: T.textPrim, fontSize: 14, fontWeight: '500' },
  clearBtn:      { padding: 4 },
  cancelBtn:     { paddingLeft: 4 },
  cancelTxt:     { color: T.textSec, fontSize: 14, fontWeight: '600' },

  // Bouton toggle filtres
  filterToggleBtn:{ position: 'relative', width: 36, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: T.surfBorder, alignItems: 'center', justifyContent: 'center' },
  filterBadge:   { position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: 7, backgroundColor: T.gold, alignItems: 'center', justifyContent: 'center' },
  filterBadgeTxt:{ color: '#000', fontSize: 8, fontWeight: '800' },

  // Rectangles filtres compacts
  filterRectRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 },
  filterRect:    { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 11, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.09)' },
  filterRectOn:  { backgroundColor: 'rgba(245,166,35,0.10)', borderColor: 'rgba(245,166,35,0.30)' },
  filterRectTxt: { color: T.textSec, fontSize: 12, fontWeight: '600' },
  filterRectTxtOn:{ color: T.gold },

  // Bouton reset (×)
  resetRect:     { width: 32, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },

  // Retour recherche
  backSearchBtn: { width: 36, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },

  // Résultats
  resultsContent:{ paddingHorizontal: 16, paddingBottom: 50 },
  loadRow:       { paddingTop: 60, alignItems: 'center' },
  emptyWrap:     { alignItems: 'center', paddingTop: 70 },
  emptyTxt:      { color: T.textSec, fontSize: 17, fontWeight: '600', marginTop: 14 },
  emptySub:      { color: T.textTert, fontSize: 13, marginTop: 6 },
  retryBtn:      { marginTop: 16, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: T.gold },
  resultCount:   { color: T.textTert, fontSize: 12, marginBottom: 12 },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  resultCard:    { width: (W - 42) / 2, height: 220, borderRadius: 14, overflow: 'hidden', backgroundColor: T.surf },
  resultImg:     { width: '100%', height: '100%', resizeMode: 'cover' },
  resultBadge:   { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  resultBadgeTxt:{ color: 'white', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  resultInfo:    { position: 'absolute', bottom: 10, left: 10, right: 10 },
  resultTitle:   { color: 'white', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  resultMeta:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultMetaTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
});

// ─────────────────────────────────────────────────────────────────
// ── PORTRAIT CARD
// ─────────────────────────────────────────────────────────────────
const PortraitCard = memo(({ item }: { item: Work }) => {
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }).start();
  return (
    <TouchableOpacity activeOpacity={1} onPressIn={onIn} onPressOut={onOut} onPress={() => router.push(`/film/${item.id}`)} style={pcS.wrap}>
      <Animated.View style={[pcS.card, { transform: [{ scale }] }]}>
        <Image source={{ uri: item.image ?? `https://picsum.photos/seed/${item.id}/300/450` }} style={pcS.img} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={pcS.grad} start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }} />
        <View style={[pcS.badge, { backgroundColor: item.is_original ? T.badgePurp : T.badgePink }]}>
          <Text style={pcS.badgeTxt}>{item.is_original ? 'ORIGINAL' : item.category.toUpperCase()}</Text>
        </View>
        <View style={pcS.meta}>
          <Text style={pcS.title} numberOfLines={2}>{item.title}</Text>
          <View style={pcS.stats}>
            <Ionicons name="heart" size={10} color={T.gold} />
            <Text style={pcS.statTxt}>{item.likes}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});
PortraitCard.displayName = 'PortraitCard';
const pcS = StyleSheet.create({
  wrap:     { marginRight: 14 },
  card:     { width: PORT_W, height: PORT_H, borderRadius: 14, overflow: 'hidden', backgroundColor: T.bg2 },
  img:      { width: '100%', height: '100%', resizeMode: 'cover' },
  grad:     { ...StyleSheet.absoluteFillObject },
  badge:    { position: 'absolute', top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  badgeTxt: { color: 'white', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  meta:     { position: 'absolute', bottom: 10, left: 9, right: 9 },
  title:    { color: 'white', fontSize: 12, fontWeight: '700', marginBottom: 4, lineHeight: 16 },
  stats:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statTxt:  { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
});

// ─────────────────────────────────────────────────────────────────
// ── LANDSCAPE CARD
// ─────────────────────────────────────────────────────────────────
const LandscapeCard = memo(({ item }: { item: Work }) => {
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }).start();
  return (
    <TouchableOpacity activeOpacity={1} onPressIn={onIn} onPressOut={onOut} onPress={() => router.push(`/film/${item.id}`)} style={lcS.wrap}>
      <Animated.View style={[lcS.card, { transform: [{ scale }] }]}>
        <Image source={{ uri: item.image ?? `https://picsum.photos/seed/${item.id + 100}/600/340` }} style={lcS.img} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={lcS.grad} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={lcS.durBadge}>
          <Ionicons name="time-outline" size={9} color="rgba(255,255,255,0.7)" />
          <Text style={lcS.durTxt}>{item.duration}m</Text>
        </View>
        <View style={lcS.meta}>
          <Text style={lcS.title} numberOfLines={1}>{item.title}</Text>
          <Text style={lcS.adj} numberOfLines={1}>{item.adjective}</Text>
          <View style={lcS.stats}>
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
LandscapeCard.displayName = 'LandscapeCard';
const lcS = StyleSheet.create({
  wrap:     { marginRight: 14 },
  card:     { width: LAND_W, height: LAND_H, borderRadius: 14, overflow: 'hidden', backgroundColor: T.bg2 },
  img:      { width: '100%', height: '100%', resizeMode: 'cover' },
  grad:     { ...StyleSheet.absoluteFillObject },
  durBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  durTxt:   { color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: '600' },
  meta:     { position: 'absolute', bottom: 10, left: 10, right: 10 },
  title:    { color: 'white', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  adj:      { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontStyle: 'italic', marginBottom: 5 },
  stats:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statTxt:  { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
});

// ─────────────────────────────────────────────────────────────────
// ── SKELETONS
// ─────────────────────────────────────────────────────────────────
const PortraitSkeleton = memo(() => {
  const op = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line
  return <Animated.View style={[pcS.card, { backgroundColor: T.surf, opacity: op, marginRight: 14 }]} />;
});
PortraitSkeleton.displayName = 'PortraitSkeleton';

const LandscapeSkeleton = memo(() => {
  const op = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line
  return <Animated.View style={[lcS.card, { backgroundColor: T.surf, opacity: op, marginRight: 14 }]} />;
});
LandscapeSkeleton.displayName = 'LandscapeSkeleton';

// ─────────────────────────────────────────────────────────────────
// ── HERO BANNER
// ─────────────────────────────────────────────────────────────────
const HeroBanner = memo(({ item }: { item: Work | null }) => {
  const router = useRouter();
  if (!item) return <Animated.View style={hb.skeleton} />;
  return (
    <TouchableOpacity activeOpacity={0.95} onPress={() => router.push(`/film/${item.id}`)} style={hb.wrap}>
      <ImageBackground source={{ uri: item.image ?? `https://picsum.photos/seed/${item.id}/800/500` }} style={hb.img} resizeMode="cover">
        <LinearGradient colors={['rgba(10,10,15,0.55)', 'transparent']} style={hb.topGrad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        <LinearGradient colors={['transparent', 'rgba(10,10,15,0.6)', T.bg]} style={hb.botGrad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        <View style={hb.content}>
          <View style={[hb.badge, { backgroundColor: item.is_original ? T.badgePurp : T.badgePink }]}>
            <Text style={hb.badgeTxt}>{item.is_original ? '★ ORIGINAL' : item.category.toUpperCase()}</Text>
          </View>
          <Text style={hb.title}>{item.title}</Text>
          <Text style={hb.adj} numberOfLines={1}>{item.adjective}</Text>
          <View style={hb.actions}>
            <TouchableOpacity style={hb.playBtn} onPress={() => router.push(`/film/${item.id}`)} activeOpacity={0.85}>
              <Ionicons name="play" size={16} color={T.bg} />
              <Text style={hb.playTxt}>Regarder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={hb.infoBtn} onPress={() => router.push(`/film/${item.id}`)}>
              <Ionicons name="information-circle-outline" size={16} color="white" />
              <Text style={hb.infoTxt}>Infos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
});
HeroBanner.displayName = 'HeroBanner';
const hb = StyleSheet.create({
  wrap:     { height: HERO_H, width: W, overflow: 'hidden' },
  img:      { width: '100%', height: '100%', justifyContent: 'flex-end' },
  skeleton: { height: HERO_H, backgroundColor: T.surf },
  topGrad:  { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  botGrad:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' },
  content:  { paddingHorizontal: 22, paddingBottom: 28 },
  badge:    { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  badgeTxt: { color: 'white', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  title:    { color: 'white', fontSize: 32, fontWeight: '800', letterSpacing: -0.5, lineHeight: 37, marginBottom: 5 },
  adj:      { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontStyle: 'italic', marginBottom: 18 },
  actions:  { flexDirection: 'row', gap: 12 },
  playBtn:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'white', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22 },
  playTxt:  { color: T.bg, fontSize: 15, fontWeight: '700' },
  infoBtn:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  infoTxt:  { color: 'white', fontSize: 15, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────
// ── ROW SECTION
// ─────────────────────────────────────────────────────────────────
interface RowSectionProps {
  title: string; subtitle?: string;
  items: Work[]; loading: boolean;
  variant: 'portrait' | 'landscape';
  onSeeAll?: () => void;
}
const RowSection = memo(({ title, subtitle, items, loading, variant, onSeeAll }: RowSectionProps) => {
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
            <Ionicons name="chevron-forward" size={14} color={T.gold} />
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rs.listPad}>
          {[0,1,2,3,4].map(i => isPort ? <PortraitSkeleton key={i} /> : <LandscapeSkeleton key={i} />)}
        </ScrollView>
      ) : (
        <FlatList
          horizontal data={items}
          keyExtractor={i => String(i.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={rs.listPad}
          renderItem={({ item }) => isPort ? <PortraitCard item={item} /> : <LandscapeCard item={item} />}
          decelerationRate="fast"
          snapToInterval={isPort ? PORT_W + 14 : LAND_W + 14}
          snapToAlignment="start"
        />
      )}
    </View>
  );
});
RowSection.displayName = 'RowSection';
const rs = StyleSheet.create({
  section:   { marginBottom: 32 },
  head:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 14 },
  title:     { color: T.textPrim, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sub:       { color: T.textTert, fontSize: 12, marginTop: 2 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllTxt: { color: T.gold, fontSize: 13, fontWeight: '600' },
  listPad:   { paddingHorizontal: 20 },
});

// ─────────────────────────────────────────────────────────────────
// ══ MAIN SCREEN
// ─────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();

  const [search,      setSearch]      = useState('');
  const [activeTab,   setActiveTab]   = useState('Catégories');
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

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debTimer.current);
    debTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(debTimer.current);
  }, [search]);

  const loadWorks = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const data = await fetchWorks({ tab: activeTab, search: debouncedSearch, genre, sortBy, duration, year });
      setWorks(data);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [activeTab, debouncedSearch, genre, sortBy, duration, year]);

  useEffect(() => { loadWorks(); }, [loadWorks]);

  useEffect(() => {
    fetchTrending(10).then(data => {
      setTrending(data);
      setPopular([...data].reverse());
    }).catch(() => {});
  }, []);

  const [openDrop,   setOpenDrop]   = useState<string | null>(null);
  const [dropAnchor, setDropAnchor] = useState({ x: 0, y: 0 });

  const openDropdown = useCallback((key: string, ev: any) => {
    ev.target.measure((_: any, __: any, ___: any, h: number, px: number, py: number) => {
      setDropAnchor({ x: px, y: py + h });
      setOpenDrop(key);
    });
  }, []);

  const activeFilterCount = [
    genre !== 'Tous', sortBy !== 'Popularité', duration !== 'Toutes', year !== 'Toutes',
  ].filter(Boolean).length;

  const resetFilters = useCallback(() => {
    setGenre('Tous'); setSortBy('Popularité'); setDuration('Toutes'); setYear('Toutes');
  }, []);

  const portraitWorks = useMemo(() => works.filter(w => w.is_original || ['film', 'mini-série', 'série'].includes(w.category.toLowerCase())), [works]);
  const courtMetrage  = useMemo(() => works.filter(w => w.duration < 60), [works]);
  const moyenMetrage  = useMemo(() => works.filter(w => w.duration >= 60 && w.duration <= 100), [works]);
  const longMetrage   = useMemo(() => works.filter(w => w.duration > 100), [works]);

  const heroItem   = trending[0] ?? null;
  const isFiltered = debouncedSearch.trim() || activeTab !== 'Catégories' || activeFilterCount > 0;

  const scrollY    = useRef(new Animated.Value(0)).current;

  console.log('works state =', works);
  
  return (
    <View style={ms.root}>
      <StatusBar style="light" />

      {/* Sticky header */}
      <Animated.View
        style={[ms.stickyHeader, { opacity: scrollY.interpolate({ inputRange: [0, 120], outputRange: [1, 0], extrapolate: 'clamp' }) }]}
        pointerEvents="none"
      >
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={ms.stickyInner}>
          <Text style={ms.stickyTitle}>UNIVERSE</Text>
        </View>
      </Animated.View>

      {/* Bouton recherche top-right */}
      <View style={ms.topRight} pointerEvents="box-none">
        <TouchableOpacity style={ms.searchIconBtn} onPress={() => setSearchOpen(true)}>
          <Ionicons name="search" size={20} color="white" />
        </TouchableOpacity>
      </View>

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
        openDropdown={openDropdown}
        openDrop={openDrop} setOpenDrop={setOpenDrop}
        dropAnchor={dropAnchor}
      />

      {/* Main scroll */}

          <GalaxyBackground/>
      
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ms.scroll}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <HeroBanner item={heroItem} />

        {isFiltered && (
          <RowSection
            title={debouncedSearch.trim() ? `"${debouncedSearch}"` : activeTab}
            subtitle={!loading && !error ? `${works.length} œuvres` : undefined}
            items={portraitWorks}
            loading={loading}
            variant="portrait"
          />
        )}



        {!isFiltered && (
          <>
            <RowSection title="Les plus tendances" subtitle="Cette semaine" items={trending} loading={trending.length === 0} variant="portrait" onSeeAll={() => router.push('/popular')} />
            <RowSection title="Les plus populaires" subtitle="Tous les temps" items={popular} loading={popular.length === 0} variant="portrait" onSeeAll={() => router.push('/popular')} />
            {(courtMetrage.length > 0 || loading) && <RowSection title="Courts métrages" subtitle="Moins de 60 min" items={courtMetrage} loading={loading} variant="landscape" />}
            {(moyenMetrage.length > 0 || loading) && <RowSection title="Moyens métrages" subtitle="60 – 100 min" items={moyenMetrage} loading={loading} variant="landscape" />}
            {(longMetrage.length > 0 || loading)  && <RowSection title="Longs métrages" subtitle="Plus de 100 min" items={longMetrage} loading={loading} variant="landscape" />}

            <TouchableOpacity style={ms.banner} activeOpacity={0.85} onPress={() => router.push('/popular')}>
              <BlurView intensity={25} tint="dark" style={ms.bannerBlur}>
                <LinearGradient colors={['rgba(245,166,35,0.12)', 'rgba(245,166,35,0.04)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={ms.bannerLeft}>
                  <View style={ms.bannerIcon}>
                    <Ionicons name="flame" size={18} color={T.gold} />
                  </View>
                  <View>
                    <Text style={ms.bannerTitle}>Populaires cette semaine</Text>
                    <Text style={ms.bannerSub}>Voir tout le classement</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={T.gold} />
              </BlurView>
            </TouchableOpacity>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  root:        { flex: 1 },
  scroll:      { paddingBottom: 120 },
  stickyHeader:{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, height: Platform.OS === 'ios' ? 90 : 60 },
  stickyInner: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 10, marginTop: Platform.OS === 'ios' ? 44 : 0 },
  stickyTitle: { color: T.textPrim, fontSize: 35, fontWeight: '700' },
  topRight:    { position: 'absolute', top: Platform.OS === 'ios' ? 44 : 10, right: 20, zIndex: 100 },
  searchIconBtn:{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.surfBorder },
  banner:      { marginHorizontal: 20, marginTop: 8, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: T.surfBorder },
  bannerBlur:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  bannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 13 },
  bannerIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: T.goldSoft, justifyContent: 'center', alignItems: 'center' },
  bannerTitle: { color: T.textPrim, fontSize: 15, fontWeight: '700' },
  bannerSub:   { color: T.textSec, fontSize: 12, marginTop: 2 },
});