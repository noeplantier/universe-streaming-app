// app/search.tsx
// ═══════════════════════════════════════════════════════════════════
//  UNIVERSE — Recherche  /  Galaxy System
//  ─────────────────────────────────────────────────────────────────
//  Moteur Galaxy porté depuis social.tsx (intégral).
//  Search en temps réel, filtres actifs, tabs fonctionnels.
// ═══════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useMemo,
  useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, TextInput, Dimensions, Platform,
  Animated, Easing, Modal, FlatList, Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 PALETTE GALAXY (identique social.tsx)
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
  neb0: 'rgba(108,16,195,0.32)', neb1: 'rgba(172,24,160,0.20)',
  sW: '#F3EDFF', sB: '#B2CCFF', sG: '#FFE270', sP: '#CF98FF', sCy: '#86EEFF',
  glass: 'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
  primary: '#C060FF',
  pinkBadge: '#E91E63',
  purpleBadge: '#6A1B9A',
  accent: '#A855F7',
  textSub: '#BCB8C2',
};

// ─────────────────────────────────────────────────────────────────────────────
// 🍿 DONNÉES COMPLÈTES
// ─────────────────────────────────────────────────────────────────────────────
const ALL_WORKS = [
  { id: '1',  title: 'Interdit',           category: 'Interdit', genre: 'Thriller',  year: 2023, likes: 345, image: 'https://picsum.photos/seed/p1/400/600', isOriginal: false, adjective: 'Provocateur', duration: 95  },
  { id: '2',  title: 'La Mariée Captive',  category: 'ORIGINAL', genre: 'Drame',     year: 2024, likes: 212, comments: 45, image: 'https://picsum.photos/seed/p2/400/600', isOriginal: true, adjective: 'Captivant', duration: 110 },
  { id: '3',  title: 'Neon Abyss',         category: 'Mini-série',    genre: 'Sci-Fi',    year: 2023, likes: 371, image: 'https://picsum.photos/seed/p3/400/600', isOriginal: false, adjective: 'Visuel', duration: 45   },
  { id: '4',  title: 'Wasteland',          category: 'Film',     genre: 'Action',    year: 2022, likes: 128, image: 'https://picsum.photos/seed/p4/400/600', isOriginal: true, adjective: 'Brut', duration: 120  },
  { id: '5',  title: 'Nocturne',           category: 'Film',     genre: 'Drame',     year: 2024, likes: 490, image: 'https://picsum.photos/seed/p5/400/600', isOriginal: false, adjective: 'Sombre', duration: 98   },
  { id: '6',  title: 'Équinoxe',           category: 'Mini-série',    genre: 'Thriller',  year: 2023, likes: 670, image: 'https://picsum.photos/seed/p6/400/600', isOriginal: true, adjective: 'Haletant', duration: 52  },
  { id: '7',  title: 'Solar',              category: 'ORIGINAL', genre: 'Sci-Fi',    year: 2022, likes: 233, image: 'https://picsum.photos/seed/p7/400/600', isOriginal: true, adjective: 'Épique', duration: 130  },
  { id: '8',  title: 'Crimson Coast',      category: 'Film',     genre: 'Action',    year: 2024, likes: 815, image: 'https://picsum.photos/seed/p8/400/600', isOriginal: false, adjective: 'Intense', duration: 105 },
];

const GENRES   = ['Tous', 'Thriller', 'Drame', 'Sci-Fi', 'Action'];
const SORT_OPT = ['Popularité', 'Récent', 'Anciens'];
const DURATIONS= ['Toutes', '< 60 min', '60–100 min', '> 100 min'];
const YEARS    = ['Toutes', '2024', '2023', '2022'];
const MAIN_TABS = ['Catégories','Mini-séries', 'Films' ];

// ═══════════════════════════════════════════════════════════════════
//  ░░░  GALAXY ANIMATION ENGINE (Portage Intégral)  ░░░
// ═══════════════════════════════════════════════════════════════════

const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface Pt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
interface Met { id: number; sx: number; sy: number; ang: number; len: number; }

const STARS: Pt[] = Array.from({ length: 55 }, (_, i) => ({
  id: i, x: rnd(0, W), y: rnd(0, H * 1.5), sz: rnd(1.0, 2.3),
  col: pick([G.sW, G.sB, G.sP, G.sG]),
  del: rnd(0, 4200), dur: rnd(2000, 5000), mn: 0.25, mx: 0.95,
}));

const StarDot = memo(({ p }: { p: Pt }) => {
  const op = useRef(new Animated.Value(p.mn)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(p.del % p.dur),
      Animated.timing(op, { toValue: p.mx, duration: p.dur * 0.5, useNativeDriver: true }),
      Animated.timing(op, { toValue: p.mn, duration: p.dur * 0.5, useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line
  return (
    <Animated.View style={{
      position: 'absolute', left: p.x, top: p.y,
      width: p.sz, height: p.sz, borderRadius: p.sz,
      backgroundColor: p.col, opacity: op,
    }} />
  );
});
StarDot.displayName = 'StarDot';

const ShootingStar = memo(({ m, onDone }: { m: Met; onDone: () => void }) => {
  const prog = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
      ]),
      Animated.timing(prog, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(onDone);
  }, []); // eslint-disable-line
  const tx = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(m.ang * Math.PI / 180) * 200] });
  const ty = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(m.ang * Math.PI / 180) * 200] });
  return (
    <Animated.View style={{
      position: 'absolute', left: m.sx, top: m.sy,
      opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${m.ang}deg` }],
    }}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(175,110,255,0.8)', '#fff']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ width: m.len, height: 2, borderRadius: 1 }}
      />
    </Animated.View>
  );
});
ShootingStar.displayName = 'ShootingStar';

const GalaxyBackground = memo(() => {
  const [meteors, setMeteors] = useState<Met[]>([]);
  useEffect(() => {
    const i = setInterval(() => {
      if (Math.random() > 0.7)
        setMeteors(m => [...m, {
          id: Date.now(), sx: rnd(0, W), sy: rnd(0, H * 0.4),
          ang: rnd(20, 50), len: rnd(80, 150),
        }]);
    }, 2000);
    return () => clearInterval(i);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[G.bg0, G.bg1, G.bg2]} style={StyleSheet.absoluteFill} />
      {STARS.map(s => <StarDot key={s.id} p={s} />)}
      {meteors.map(m => (
        <ShootingStar key={m.id} m={m}
          onDone={() => setMeteors(prev => prev.filter(x => x.id !== m.id))} />
      ))}
    </View>
  );
});
GalaxyBackground.displayName = 'GalaxyBackground';

// ═══════════════════════════════════════════════════════════════════
//  ░░░  COMPOSANTS  ░══════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════

// ─── Dropdown Filtre ───────────────────────────────────────────────
interface DropdownProps {
  visible: boolean;
  onClose: () => void;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  anchor: { x: number; y: number };
}
const FilterDropdown = memo(({ visible, onClose, options, selected, onSelect, anchor }: DropdownProps) => {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[dd.box, { top: anchor.y + 36, left: anchor.x }]}>
        {options.map(opt => (
          <TouchableOpacity key={opt} style={dd.item} onPress={() => { onSelect(opt); onClose(); }}>
            <Text style={[dd.txt, selected === opt && dd.txtOn]}>{opt}</Text>
            {selected === opt && <Ionicons name="checkmark" size={14} color={G.primary} />}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
});
FilterDropdown.displayName = 'FilterDropdown';

const dd = StyleSheet.create({
  box:   { position: 'absolute', minWidth: 130, backgroundColor: '#1A0B2E', borderRadius: 12, borderWidth: 1, borderColor: G.glassBorder, overflow: 'hidden', zIndex: 999, elevation: 10 },
  item:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  txt:   { color: G.textSub, fontSize: 14 },
  txtOn: { color: G.sW, fontWeight: '700' },
});

// ─── Chip Filtre ───────────────────────────────────────────────────
interface ChipProps {
  label: string;
  value: string;
  onPress: (ev: any) => void;
  active?: boolean;
}
const FilterChip = memo(({ label, value, onPress, active }: ChipProps) => (
  <TouchableOpacity
    style={[fc.chip, active && fc.chipOn]}
    onPress={onPress}
  >
    <Text style={[fc.txt, active && fc.txtOn]}>{label}: {value}</Text>
    <Ionicons name="chevron-down" size={13} color={active ? G.primary : G.textSub} style={{ marginLeft: 3 }} />
  </TouchableOpacity>
));
FilterChip.displayName = 'FilterChip';

const fc = StyleSheet.create({
  chip:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, borderRadius: 20, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass },
  chipOn:{ borderColor: G.primary, backgroundColor: 'rgba(192,96,255,0.12)' },
  txt:   { color: G.textSub, fontSize: 13 },
  txtOn: { color: G.primary },
});

// ─── Carte Film ────────────────────────────────────────────────────
type Work = typeof ALL_WORKS[0];
const MovieCard = memo(({ item }: { item: Work }) => {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={mc.container}
      activeOpacity={0.85}
      onPress={() => router.push(`/film/${item.id}`)}
    >
      <Image source={{ uri: item.image }} style={mc.image} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={mc.overlay} />
      <View style={[mc.badge, { backgroundColor: item.isOriginal ? G.purpleBadge : G.pinkBadge }]}>
        <Text style={mc.badgeText}>{item.category.toUpperCase()}</Text>
      </View>
      <View style={mc.content}>
        <Text style={mc.title} numberOfLines={1}>{item.title}</Text>
        <Text style={mc.adj}>{item.adjective}</Text>
        <View style={mc.stats}>
          <View style={mc.stat}>
            <Ionicons name="heart" size={12} color={G.accent} />
            <Text style={mc.statTxt}>{item.likes}</Text>
          </View>
          {item.comments != null && (
            <View style={mc.stat}>
              <Ionicons name="chatbubble" size={11} color={G.accent} />
              <Text style={mc.statTxt}>{item.comments}</Text>
            </View>
          )}
          <View style={mc.stat}>
            <Ionicons name="time-outline" size={11} color={G.textSub} />
            <Text style={[mc.statTxt, { color: G.textSub }]}>{item.duration}m</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
MovieCard.displayName = 'MovieCard';

const CARD_W = (W - 45) / 2;
const mc = StyleSheet.create({
  container: { width: CARD_W, height: 250, borderRadius: 18, overflow: 'hidden', marginBottom: 15 },
  image:     { width: '100%', height: '100%', resizeMode: 'cover' },
  overlay:   { ...StyleSheet.absoluteFillObject },
  badge:     { position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: 'white', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  content:   { position: 'absolute', bottom: 12, left: 12, right: 8 },
  title:     { color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  adj:       { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 6, fontStyle: 'italic' },
  stats:     { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  stat:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statTxt:   { color: 'white', fontSize: 11, fontWeight: '500' },
});

// ─── Résultat vide ─────────────────────────────────────────────────
const EmptyState = memo(() => (
  <View style={es.wrap}>
    <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.15)" />
    <Text style={es.txt}>Aucun résultat trouvé</Text>
    <Text style={es.sub}>Essayez d'autres mots-clés ou filtres</Text>
  </View>
));
EmptyState.displayName = 'EmptyState';

const es = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 60 },
  txt:  { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '600', marginTop: 14 },
  sub:  { color: 'rgba(255,255,255,0.2)', fontSize: 13, marginTop: 6 },
});

// ═══════════════════════════════════════════════════════════════════
//  ░░░  ÉCRAN PRINCIPAL  ░░░
// ═══════════════════════════════════════════════════════════════════

export default function SearchScreen() {
  const router = useRouter();

  // ── État filtres ────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [activeTab,   setActiveTab]   = useState('Catégories');
  const [genre,       setGenre]       = useState('Tous');
  const [sortBy,      setSortBy]      = useState('Popularité');
  const [duration,    setDuration]    = useState('Toutes');
  const [year,        setYear]        = useState('Toutes');

  // ── Dropdowns ──────────────────────────────────────────────────
  const [openDrop, setOpenDrop]  = useState<string | null>(null);
  const [dropAnchor, setDropAnchor] = useState({ x: 0, y: 0 });

  const openDropdown = useCallback((key: string, ev: any) => {
    ev.target.measure((_: any, __: any, ___: any, h: number, px: number, py: number) => {
      setDropAnchor({ x: px, y: py + h });
      setOpenDrop(key);
    });
  }, []);

  // ── Filtrage & tri ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...ALL_WORKS];

    // Tab principal
    if (activeTab === 'Mini-séries') list = list.filter(w => w.category === 'Mini-série');
    else if (activeTab === 'Films') list = list.filter(w => w.category === 'Film' || w.category === 'ORIGINAL' || w.category === 'Interdit');

    // Recherche texte
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(w =>
        w.title.toLowerCase().includes(q) ||
        w.genre.toLowerCase().includes(q) ||
        w.adjective.toLowerCase().includes(q)
      );
    }

    // Genre
    if (genre !== 'Tous') list = list.filter(w => w.genre === genre);

    // Durée
    if (duration === '< 60 min')    list = list.filter(w => w.duration < 60);
    else if (duration === '60–100 min') list = list.filter(w => w.duration >= 60 && w.duration <= 100);
    else if (duration === '> 100 min')  list = list.filter(w => w.duration > 100);

    // Année
    if (year !== 'Toutes') list = list.filter(w => String(w.year) === year);

    // Tri
    if (sortBy === 'Popularité') list.sort((a, b) => b.likes - a.likes);
    else if (sortBy === 'Récent')  list.sort((a, b) => b.year - a.year);
    else if (sortBy === 'Anciens') list.sort((a, b) => a.year - b.year);

    return list;
  }, [search, activeTab, genre, sortBy, duration, year]);

  // ── Trending = top 4 toutes catégories ────────────────────────
  const trending = useMemo(() =>
    [...ALL_WORKS].sort((a, b) => b.likes - a.likes).slice(0, 4),
    []
  );

  const activeFilterCount = [
    genre !== 'Tous', sortBy !== 'Popularité', duration !== 'Toutes', year !== 'Toutes',
  ].filter(Boolean).length;

  const resetFilters = useCallback(() => {
    setGenre('Tous'); setSortBy('Popularité'); setDuration('Toutes'); setYear('Toutes');
  }, []);

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* ── Dropdowns modaux ── */}
      <FilterDropdown visible={openDrop === 'genre'}    onClose={() => setOpenDrop(null)} options={GENRES}    selected={genre}    onSelect={setGenre}    anchor={dropAnchor} />
      <FilterDropdown visible={openDrop === 'sort'}     onClose={() => setOpenDrop(null)} options={SORT_OPT}  selected={sortBy}   onSelect={setSortBy}   anchor={dropAnchor} />
      <FilterDropdown visible={openDrop === 'duration'} onClose={() => setOpenDrop(null)} options={DURATIONS} selected={duration} onSelect={setDuration} anchor={dropAnchor} />
      <FilterDropdown visible={openDrop === 'year'}     onClose={() => setOpenDrop(null)} options={YEARS}     selected={year}     onSelect={setYear}     anchor={dropAnchor} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollPadding}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Rechercher</Text>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={s.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color="white" />
          </TouchableOpacity>
        </View>

        {/* ── BARRE DE RECHERCHE ── */}
        <View style={s.searchContainer}>
          <Ionicons name="search" size={20} color={G.textSub} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Titre, genre, ambiance…"
            placeholderTextColor={G.textSub}
            style={s.input}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={G.textSub} />
            </TouchableOpacity>
          )}
        </View>

          {/* ── TABS PRINCIPAUX ── */}
          <View style={s.tabRow}>
            {MAIN_TABS.map((tab) => {
              const active = activeTab === tab || (activeTab === '' && tab === 'Catégories');
              return (
                <TouchableOpacity
            key={tab}
            style={[s.mainTab, active && s.activeTab]}
            onPress={() => setActiveTab(tab)}
                >
            <Text style={[s.mainTabText, active && { color: 'white' }]}>{tab}</Text>
            {tab === 'Catégories' && (
              <Ionicons name="chevron-forward" size={14} color={active ? 'white' : G.textSub} style={{ marginLeft: 4 }} />
            )}
                </TouchableOpacity>
              );
            })}
          </View>

        {/* ── FILTRES AVANCÉS ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
          <FilterChip label="Genre"      value={genre}    active={genre !== 'Tous'}       onPress={(e) => openDropdown('genre', e)} />
          <FilterChip label="Tri"        value={sortBy}   active={sortBy !== 'Popularité'} onPress={(e) => openDropdown('sort', e)}  />
          <FilterChip label="Durée"      value={duration} active={duration !== 'Toutes'}  onPress={(e) => openDropdown('duration', e)} />
          <FilterChip label="Année"      value={year}     active={year !== 'Toutes'}      onPress={(e) => openDropdown('year', e)}  />
          {activeFilterCount > 0 && (
            <TouchableOpacity style={s.resetBtn} onPress={resetFilters}>
              <Ionicons name="refresh" size={14} color={G.primary} />
              <Text style={s.resetTxt}>Réinitialiser ({activeFilterCount})</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ── TRENDING (si pas de recherche active & tab Catégories) ── */}
        {!search.trim() && activeTab === 'Catégories' && (
          <>
            <View style={s.gridHeader}>
              <Text style={s.sectionTitle}>Les plus tendances</Text>
              <Ionicons name="chevron-forward" size={20} color={G.textSub} />
            </View>
            <View style={s.grid}>
              {trending.map(item => <MovieCard key={item.id} item={item} />)}
            </View>
          </>
        )}

        {/* ── RÉSULTATS FILTRÉS ── */}
        {(search.trim() || activeTab !== 'Catégories') && (
          <>
            <View style={s.gridHeader}>
              <Text style={s.sectionTitle}>
                {search.trim() ? `Résultats "${search}"` : activeTab}
              </Text>
              <Text style={s.resultCount}>{filtered.length} œuvres</Text>
            </View>

            {filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <View style={s.grid}>
                {filtered.map(item => <MovieCard key={item.id} item={item} />)}
              </View>
            )}
          </>
        )}

        {/* ── BANNER POPULAIRES ── */}
        <TouchableOpacity style={s.popularBanner} activeOpacity={0.85} onPress={() => router.push('/popular')}>
          <BlurView intensity={20} tint="dark" style={s.bannerBlur}>
            <View style={s.bannerLeft}>
              <View style={s.bannerIconCircle}>
                <Ionicons name="flame" size={16} color={G.sG} />
              </View>
              <View>
                <Text style={s.bannerTitle}>Populaires cette semaine</Text>
                <Text style={s.bannerSub}>{ALL_WORKS.reduce((a, w) => a + w.likes, 0).toLocaleString()} appréciations</Text>
              </View>
            </View>
            <View style={s.avatarStack}>
              {['1', '2', '3'].map((u, i) => (
                <Image
                  key={u}
                  source={{ uri: `https://i.pravatar.cc/100?u=${u}` }}
                  style={[s.avatar, i > 0 && { marginLeft: -10 }]}
                />
              ))}
              <View style={[s.avatar, { marginLeft: -10, backgroundColor: G.glass, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: 'white', fontSize: 8, fontWeight: '700' }}>+5k</Text>
              </View>
            </View>
          </BlurView>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  🎨 STYLES
// ═══════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: G.bg0 },
  scrollPadding:    { paddingBottom: 120 },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: Platform.OS === 'ios' ? 54 : 20, marginBottom: 18 },
  headerTitle:      { color: 'white', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  notifBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, justifyContent: 'center', alignItems: 'center' },
  searchContainer:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 20, paddingHorizontal: 15, height: 50, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: G.glassBorder },
  input:            { flex: 1, color: 'white', fontSize: 15 },
  tabRow:           { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  mainTab:          { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 20, borderWidth: 1, borderColor: G.glassBorder },
  activeTab:        { backgroundColor: '#5A2A94', borderColor: G.primary },
  mainTabText:      { color: G.textSub, fontWeight: '600', fontSize: 14 },
  filterRow:        { paddingLeft: 20, marginBottom: 22 },
  resetBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, marginRight: 10, borderRadius: 20, borderWidth: 1, borderColor: G.primary, backgroundColor: 'rgba(192,96,255,0.08)' },
  resetTxt:         { color: G.primary, fontSize: 12, fontWeight: '600' },
  gridHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle:     { color: 'white', fontSize: 20, fontWeight: '800' },
  resultCount:      { color: G.textSub, fontSize: 13 },
  grid:             { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 15, justifyContent: 'space-between' },
  popularBanner:    { marginHorizontal: 20, marginTop: 10, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: G.glassBorder },
  bannerBlur:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  bannerLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,226,112,0.15)', justifyContent: 'center', alignItems: 'center' },
  bannerTitle:      { color: 'white', fontSize: 15, fontWeight: '700' },
  bannerSub:        { color: G.textSub, fontSize: 12, marginTop: 2 },
  avatarStack:      { flexDirection: 'row' },
  avatar:           { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: 'white', overflow: 'hidden' },
});