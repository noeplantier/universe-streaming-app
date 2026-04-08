// app/search.tsx  –  Apple TV–inspired redesign
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

import {
  fetchWorks, fetchTrending,
  type Work, type SortOption, type DurationBand,
} from '@/lib/supabase';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────
// 🎨 DESIGN TOKENS  (Apple TV dark cinema palette)
// ─────────────────────────────────────────────────────────────────
const T = {
  // backgrounds
  bg:       '#0A0A0F',
  bg1:      '#111118',
  bg2:      '#16161F',
  // surfaces
  surf:     'rgba(255,255,255,0.055)',
  surfBorder:'rgba(255,255,255,0.08)',
  // text
  textPrim: '#F2F2F7',
  textSec:  '#8E8E93',
  textTert: '#636366',
  // accent – warm gold like Apple TV highlight
  gold:     '#F5A623',
  goldSoft: 'rgba(245,166,35,0.18)',
  blue:     '#0A84FF',
  blueSoft: 'rgba(10,132,255,0.18)',
  // badges
  badgePink: '#FF375F',
  badgePurp: '#5E5CE6',
  badgeTeal: '#30D158',
};

// ─────────────────────────────────────────────────────────────────
// CARD DIMENSIONS
// ─────────────────────────────────────────────────────────────────
const PORT_W  = 130;  // portrait  (mini-série / film)
const PORT_H  = 195;
const LAND_W  = 240;  // landscape (court/moyen/long métrage)
const LAND_H  = 135;
const HERO_H  = H * 0.52;

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const GENRES    = ['Tous', 'Thriller', 'Drame', 'Sci-Fi', 'Action'];
const SORT_OPT: SortOption[]    = ['Popularité', 'Récent', 'Anciens'];
const DURATIONS: DurationBand[] = ['Toutes', '< 60 min', '60–100 min', '> 100 min'];
const YEARS     = ['Toutes', '2024', '2023', '2022'];

// ─────────────────────────────────────────────────────────────────
// ── FILTER DROPDOWN  (identical logic, new look)
// ─────────────────────────────────────────────────────────────────
interface DropdownProps {
  visible: boolean; onClose: () => void;
  options: string[]; selected: string;
  onSelect: (v: string) => void;
  anchor: { x: number; y: number };
}
const FilterDropdown = memo(({ visible, onClose, options, selected, onSelect, anchor }: DropdownProps) => {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <BlurView intensity={40} tint="dark"
        style={[dd.box, { top: anchor.y + 8, left: anchor.x }]}>
        {options.map(opt => (
          <TouchableOpacity key={opt} style={dd.item} onPress={() => { onSelect(opt); onClose(); }}>
            <Text style={[dd.txt, selected === opt && dd.txtOn]}>{opt}</Text>
            {selected === opt && (
              <View style={dd.check}>
                <Ionicons name="checkmark" size={12} color={T.gold} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </BlurView>
    </Modal>
  );
});
FilterDropdown.displayName = 'FilterDropdown';
const dd = StyleSheet.create({
  box:   { position: 'absolute', minWidth: 150, backgroundColor: 'rgba(22,22,32,0.95)', borderRadius: 14, borderWidth: 1, borderColor: T.surfBorder, overflow: 'hidden', zIndex: 999, elevation: 10 },
  item:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11 },
  txt:   { color: T.textSec, fontSize: 14, fontWeight: '500' },
  txtOn: { color: T.textPrim, fontWeight: '700' },
  check: { width: 20, height: 20, borderRadius: 10, backgroundColor: T.goldSoft, justifyContent: 'center', alignItems: 'center' },
});

// ─────────────────────────────────────────────────────────────────
// ── SEARCH OVERLAY  (full-screen, triggered by 🔍 icon)
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
  const router = useRouter();
  const slideY = useRef(new Animated.Value(H)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }).start();
      setTimeout(() => inputRef.current?.focus(), 350);
    } else {
      Animated.timing(slideY, { toValue: H, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
    {/* Dropdowns inside overlay */}
    <FilterDropdown visible={openDrop === 'genre'}    onClose={() => setOpenDrop(null)} options={GENRES}    selected={genre}    onSelect={setGenre}    anchor={dropAnchor} />
    <FilterDropdown visible={openDrop === 'sort'}     onClose={() => setOpenDrop(null)} options={SORT_OPT}  selected={sortBy}   onSelect={v => setSortBy(v as SortOption)}    anchor={dropAnchor} />
    <FilterDropdown visible={openDrop === 'duration'} onClose={() => setOpenDrop(null)} options={DURATIONS} selected={duration} onSelect={v => setDuration(v as DurationBand)} anchor={dropAnchor} />
    <FilterDropdown visible={openDrop === 'year'}     onClose={() => setOpenDrop(null)} options={YEARS}     selected={year}     onSelect={setYear}     anchor={dropAnchor} />

    <Animated.View style={[so.root, { transform: [{ translateY: slideY }] }]}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      {/* Ajout de la notion de top (ex: top provenant de useSafeAreaInsets ou valeur par défaut) */}
      <View style={[so.inner, { paddingTop: typeof top !== 'undefined' ? top + 10 : 50 }]}>
   

        {/* Header row */}
        <View style={so.header}>
          <View style={so.inputRow}>
            <Ionicons name="search" size={18} color={T.textSec} style={{ marginRight: 10 }} />
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
                  <Ionicons name="close-circle" size={16} color={T.textSec} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={so.cancelBtn}>
              <Text style={so.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={so.filterRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {([
              { key: 'genre',    label: 'Genre',  val: genre,    def: 'Tous' },
              { key: 'sort',     label: 'Tri',    val: sortBy,   def: 'Popularité' },
              { key: 'duration', label: 'Durée',  val: duration, def: 'Toutes' },
              { key: 'year',     label: 'Année',  val: year,     def: 'Toutes' },
            ] as const).map(f => {
              const active = f.val !== f.def;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[so.chip, active && so.chipOn]}
                  onPress={e => openDropdown(f.key, e)}
                >
                  <Text style={[so.chipTxt, active && so.chipTxtOn]}>{f.label}: {f.val}</Text>
                  <Ionicons name="chevron-down" size={11} color={active ? T.gold : T.textTert} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              );
            })}
            {activeFilterCount > 0 && (
              <TouchableOpacity style={so.resetChip} onPress={onResetFilters}>
                <Ionicons name="refresh" size={12} color={T.gold} />
                <Text style={so.resetTxt}>Réinitialiser</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Results */}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {loading
              ? <View style={so.loadRow}><ActivityIndicator color={T.gold} /></View>
              : error
                ? (
                  <View style={so.emptyWrap}>
                    <Ionicons name="cloud-offline-outline" size={44} color={T.textTert} />
                    <Text style={so.emptyTxt}>Erreur de chargement</Text>
                    <TouchableOpacity onPress={onRetry} style={so.retryBtn}>
                      <Text style={{ color: T.gold, fontWeight: '700', fontSize: 14 }}>Réessayer</Text>
                    </TouchableOpacity>
                  </View>
                )
                : works.length === 0
                  ? (
                    <View style={so.emptyWrap}>
                      <Ionicons name="film-outline" size={44} color={T.textTert} />
                      <Text style={so.emptyTxt}>Aucun résultat</Text>
                      <Text style={so.emptySub}>Essayez d'autres mots-clés ou filtres</Text>
                    </View>
                  )
                  : (
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
                  )
            }
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
});
SearchOverlay.displayName = 'SearchOverlay';

const so = StyleSheet.create({
  root:       { flex: 1, backgroundColor: 'transparent' },
  inner:      { flex: 1, paddingTop: Platform.OS === 'ios' ? 54 : 24 },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  inputRow:   { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: T.surfBorder },
  input:      { flex: 1, color: T.textPrim, fontSize: 15, fontWeight: '500' },
  clearBtn:   { padding: 4 },
  cancelBtn:  { paddingHorizontal: 6 },
  cancelTxt:  { color: T.gold, fontSize: 15, fontWeight: '600' },
  filterRow:  { marginBottom: 14 },
  chip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, borderRadius: 20, backgroundColor: T.surf, borderWidth: 1, borderColor: T.surfBorder },
  chipOn:     { borderColor: T.gold, backgroundColor: T.goldSoft },
  chipTxt:    { color: T.textSec, fontSize: 13 },
  chipTxtOn:  { color: T.gold },
  resetChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, borderRadius: 20, borderWidth: 1, borderColor: T.gold, backgroundColor: T.goldSoft },
  resetTxt:   { color: T.gold, fontSize: 13, fontWeight: '600' },
  loadRow:    { paddingTop: 60, alignItems: 'center' },
  emptyWrap:  { alignItems: 'center', paddingTop: 70 },
  emptyTxt:   { color: T.textSec, fontSize: 17, fontWeight: '600', marginTop: 14 },
  emptySub:   { color: T.textTert, fontSize: 13, marginTop: 6 },
  retryBtn:   { marginTop: 16, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: T.gold },
  resultCount:{ color: T.textTert, fontSize: 13, marginBottom: 14 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  resultCard: { width: (W - 42) / 2, height: 220, borderRadius: 14, overflow: 'hidden', backgroundColor: T.surf },
  resultImg:  { width: '100%', height: '100%', resizeMode: 'cover' },
  resultBadge:{ position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  resultBadgeTxt: { color: 'white', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  resultInfo: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  resultTitle:{ color: 'white', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultMetaTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
});

// ─────────────────────────────────────────────────────────────────
// ── PORTRAIT CARD  (mini-série / film)
// ─────────────────────────────────────────────────────────────────
const PortraitCard = memo(({ item }: { item: Work }) => {
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;

  const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onIn} onPressOut={onOut}
      onPress={() => router.push(`/film/${item.id}`)}
      style={pc.wrap}
    >
      <Animated.View style={[pc.card, { transform: [{ scale }] }]}>
        <Image
          source={{ uri: item.image ?? `https://picsum.photos/seed/${item.id}/300/450` }}
          style={pc.img}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={pc.grad}
          start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }}
        />
        {/* badge */}
        <View style={[pc.badge, { backgroundColor: item.is_original ? T.badgePurp : T.badgePink }]}>
          <Text style={pc.badgeTxt}>{item.is_original ? 'ORIGINAL' : item.category.toUpperCase()}</Text>
        </View>
        {/* meta */}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={pc.stats}>
            <Ionicons name="heart" size={10} color={T.gold} />
            <Text style={pc.statTxt}>{item.likes}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});
PortraitCard.displayName = 'PortraitCard';
const pc = StyleSheet.create({
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
// ── LANDSCAPE CARD  (court / moyen / long métrage)
// ─────────────────────────────────────────────────────────────────
const LandscapeCard = memo(({ item }: { item: Work }) => {
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;

  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onIn} onPressOut={onOut}
      onPress={() => router.push(`/film/${item.id}`)}
      style={lc.wrap}
    >
      <Animated.View style={[lc.card, { transform: [{ scale }] }]}>
        <Image
          source={{ uri: item.image ?? `https://picsum.photos/seed/${item.id + 100}/600/340` }}
          style={lc.img}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={lc.grad}
          start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }}
        />
        {/* duration badge */}
        <View style={lc.durBadge}>
          <Ionicons name="time-outline" size={9} color="rgba(255,255,255,0.7)" />
          <Text style={lc.durTxt}>{item.duration}m</Text>
        </View>
        {/* info */}
        <View style={lc.meta}>
          <Text style={lc.title} numberOfLines={1}>{item.title}</Text>
          <Text style={lc.adj} numberOfLines={1}>{item.adjective}</Text>
          <View style={lc.stats}>
            <Ionicons name="heart" size={10} color={T.gold} />
            <Text style={lc.statTxt}>{item.likes}</Text>
            {item.comments != null && (
              <>
                <Ionicons name="chatbubble" size={9} color={T.textSec} />
                <Text style={[lc.statTxt, { color: T.textSec }]}>{item.comments}</Text>
              </>
            )}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});
LandscapeCard.displayName = 'LandscapeCard';
const lc = StyleSheet.create({
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
// ── SKELETON CARDS
// ─────────────────────────────────────────────────────────────────
const PortraitSkeleton = memo(() => {
  const op = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line
  return <Animated.View style={[pc.card, { backgroundColor: T.surf, opacity: op, marginRight: 14 }]} />;
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
  return <Animated.View style={[lc.card, { backgroundColor: T.surf, opacity: op, marginRight: 14 }]} />;
});
LandscapeSkeleton.displayName = 'LandscapeSkeleton';

// ─────────────────────────────────────────────────────────────────
// ── HERO BANNER  (premier trending, Apple TV top-shelf style)
// ─────────────────────────────────────────────────────────────────
const HeroBanner = memo(({ item }: { item: Work | null }) => {
  const router = useRouter();
  if (!item) return (
    <Animated.View style={hb.skeleton} />
  );
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => router.push(`/film/${item.id}`)}
      style={hb.wrap}
    >
      <ImageBackground
        source={{ uri: item.image ?? `https://picsum.photos/seed/${item.id}/800/500` }}
        style={hb.img}
        resizeMode="cover"
      >
        {/* top vignette */}
        <LinearGradient
          colors={['rgba(10,10,15,0.55)', 'transparent']}
          style={hb.topGrad}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        />
        {/* bottom gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(10,10,15,0.6)', T.bg]}
          style={hb.botGrad}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        />

        {/* content */}
        <View style={hb.content}>
          <View style={[hb.badge, { backgroundColor: item.is_original ? T.badgePurp : T.badgePink }]}>
            <Text style={hb.badgeTxt}>{item.is_original ? '★ ORIGINAL' : item.category.toUpperCase()}</Text>
          </View>
          <Text style={hb.title}>{item.title}</Text>
          <Text style={hb.adj} numberOfLines={1}>{item.adjective}</Text>

          {/* action row */}
          <View style={hb.actions}>
            <TouchableOpacity
              style={hb.playBtn}
              onPress={() => router.push(`/film/${item.id}`)}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={16} color={T.bg} />
              <Text style={hb.playTxt}>Regarder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={hb.infoBtn}>
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
// ── ROW SECTION  (section title + horizontal FlatList)
// ─────────────────────────────────────────────────────────────────
interface RowSectionProps {
  title: string;
  subtitle?: string;
  items: Work[];
  loading: boolean;
  variant: 'portrait' | 'landscape';
  onSeeAll?: () => void;
}
const RowSection = memo(({ title, subtitle, items, loading, variant, onSeeAll }: RowSectionProps) => {
  const isPort = variant === 'portrait';
  return (
    <View style={rs.section}>
      {/* header */}
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

      {/* list */}
      {loading
        ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rs.listPad}>
            {[0,1,2,3,4].map(i => isPort
              ? <PortraitSkeleton  key={i} />
              : <LandscapeSkeleton key={i} />
            )}
          </ScrollView>
        )
        : (
          <FlatList
            horizontal
            data={items}
            keyExtractor={i => String(i.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={rs.listPad}
            renderItem={({ item }) => isPort
              ? <PortraitCard  item={item} />
              : <LandscapeCard item={item} />
            }
            decelerationRate="fast"
            snapToInterval={isPort ? PORT_W + 14 : LAND_W + 14}
            snapToAlignment="start"
          />
        )
      }
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

//────────────────────────────────────────────────────────
// ══ MAIN SCREEN
// ─────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();

  // ── state ────────────────────────────────────────────────────
  const [search,    setSearch]    = useState('');
  const [activeTab, setActiveTab] = useState('Catégories');
  const [genre,     setGenre]     = useState('Tous');
  const [sortBy,    setSortBy]    = useState<SortOption>('Popularité');
  const [duration,  setDuration]  = useState<DurationBand>('Toutes');
  const [year,      setYear]      = useState('Toutes');
  const [searchOpen, setSearchOpen] = useState(false);

  const [works,    setWorks]    = useState<Work[]>([]);
  const [trending, setTrending] = useState<Work[]>([]);
  const [popular,  setPopular]  = useState<Work[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  // ── debounced search ─────────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debTimer.current);
    debTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(debTimer.current);
  }, [search]);

  // ── fetch filtered ───────────────────────────────────────────
  const loadWorks = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const data = await fetchWorks({
        tab: activeTab, search: debouncedSearch,
        genre, sortBy, duration, year,
      });
      setWorks(data);
    } catch { setError(true); }
    finally   { setLoading(false); }
  }, [activeTab, debouncedSearch, genre, sortBy, duration, year]);

  useEffect(() => { loadWorks(); }, [loadWorks]);

  // ── fetch trending + popular once ────────────────────────────
  useEffect(() => {
    fetchTrending(10).then(data => {
      setTrending(data);
      // popular = same source, shuffled differently (or separate endpoint if available)
      setPopular([...data].reverse());
    }).catch(() => {});
  }, []);

  // ── dropdowns ────────────────────────────────────────────────
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

  // ── split works by type ──────────────────────────────────────
  // Portrait: mini-séries & films (is_original or category matches)
  const portraitWorks   = useMemo(() => works.filter(w => w.is_original || ['film', 'mini-série', 'série'].includes(w.category.toLowerCase())), [works]);
  // Landscape: court / moyen / long métrage by duration
  const courtMetrage    = useMemo(() => works.filter(w => w.duration < 60),              [works]);
  const moyenMetrage    = useMemo(() => works.filter(w => w.duration >= 60 && w.duration <= 100), [works]);
  const longMetrage     = useMemo(() => works.filter(w => w.duration > 100),             [works]);

  const heroItem = trending[0] ?? null;

  const isFiltered = debouncedSearch.trim() || activeTab !== 'Catégories' || activeFilterCount > 0;

  // ── header scroll fade ───────────────────────────────────────
  const scrollY    = useRef(new Animated.Value(0)).current;
  const headerOpac = scrollY.interpolate({ inputRange: [0, 120], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={ms.root}>
      <StatusBar style="light" />

      {/* ── STICKY HEADER (appears on scroll) ── */}
      <Animated.View style={[ms.stickyHeader, { opacity: headerOpac }]} pointerEvents="none">
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={ms.stickyInner}>
          <Text style={ms.stickyTitle}>UNIVERSE</Text>
        </View>
      </Animated.View>

      {/* ── SEARCH ICON TOP-RIGHT ── */}
      <View style={ms.topRight} pointerEvents="box-none">
        <TouchableOpacity style={ms.searchIconBtn} onPress={() => setSearchOpen(true)}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="search" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* ── SEARCH OVERLAY ── */}
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

      {/* ── MAIN SCROLL ── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ms.scroll}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* HERO */}
        <HeroBanner item={heroItem} />

     

        {/* ── FILTERED MODE ── */}
        {isFiltered && (
          <RowSection
            title={debouncedSearch.trim() ? `"${debouncedSearch}"` : activeTab}
            subtitle={!loading && !error ? `${works.length} œuvres` : undefined}
            items={portraitWorks}
            loading={loading}
            variant="portrait"
          />
        )}

        {/* ── HOME MODE ── */}
        {!isFiltered && (
          <>
            {/* Trending – portrait */}
            <RowSection
              title="Les plus tendances"
              subtitle="Cette semaine"
              items={trending}
              loading={trending.length === 0}
              variant="portrait"
              onSeeAll={() => router.push('/popular')}
            />

            {/* Popular – portrait */}
            <RowSection
              title="Les plus populaires"
              subtitle="Tous les temps"
              items={popular}
              loading={popular.length === 0}
              variant="portrait"
              onSeeAll={() => router.push('/popular')}
            />

            {/* Court métrage – landscape */}
            {(courtMetrage.length > 0 || loading) && (
              <RowSection
                title="Courts métrages"
                subtitle="Moins de 60 min"
                items={courtMetrage}
                loading={loading}
                variant="landscape"
              />
            )}

            {/* Moyen métrage – landscape */}
            {(moyenMetrage.length > 0 || loading) && (
              <RowSection
                title="Moyens métrages"
                subtitle="60 – 100 min"
                items={moyenMetrage}
                loading={loading}
                variant="landscape"
              />
            )}

            {/* Long métrage – landscape */}
            {(longMetrage.length > 0 || loading) && (
              <RowSection
                title="Longs métrages"
                subtitle="Plus de 100 min"
                items={longMetrage}
                loading={loading}
                variant="landscape"
              />
            )}

            {/* Popular banner (footer CTA) */}
            <TouchableOpacity
              style={ms.banner}
              activeOpacity={0.85}
              onPress={() => router.push('/popular')}
            >
              <BlurView intensity={25} tint="dark" style={ms.bannerBlur}>
                <LinearGradient
                  colors={['rgba(245,166,35,0.12)', 'rgba(245,166,35,0.04)']}
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
// MAIN STYLES
// ─────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  root:        { flex: 1, backgroundColor: T.bg },
  scroll:      { paddingBottom: 120 },

  // sticky header
  stickyHeader:{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, height: Platform.OS === 'ios' ? 90 : 60 },
  stickyInner: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 10, marginTop: Platform.OS === 'ios' ? 44 : 0 },
  stickyTitle: { color: T.textPrim, fontSize: 35, fontWeight: '700' },

  // search icon
  topRight:     { position: 'absolute', top: Platform.OS === 'ios' ? 44 : 10, right: 20, zIndex: 100 },
  searchIconBtn:{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.surfBorder },

  // tab wrapper
  tabWrap:  { marginTop: 24 },

  // popular banner
  banner:     { marginHorizontal: 20, marginTop: 8, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: T.surfBorder },
  bannerBlur: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  bannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.goldSoft, justifyContent: 'center', alignItems: 'center' },
  bannerTitle:{ color: T.textPrim, fontSize: 15, fontWeight: '700' },
  bannerSub:  { color: T.textSec, fontSize: 12, marginTop: 2 },
});