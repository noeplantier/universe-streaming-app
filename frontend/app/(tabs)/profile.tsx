// app/(tabs)/profile.tsx
// ═══════════════════════════════════════════════════════════════════════════════
//  UNIVERSE — Profil Cinéaste  /  Galaxy System
//  ─────────────────────────────────────────────────────────────────────────────
//  • Galaxy background intégral (search.tsx)
//  • Instagram pixel-perfect grid + header
//  • Cards avec vrais films / séries / courts métrages
//  • Shimmer skeleton + prefetch optimiste
//  • Génération vidéo façon Reels (IA Studio)
//  • Architecture ultra-scalable & mémo-optimisée
// ═══════════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useCallback, useRef, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Dimensions, RefreshControl,
  Animated, Easing, Platform, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  COLORS, SPACING, RADIUS, GRADIENTS, GENRE_COLORS,
} from '../../constants/theme';
import { reviewsAPI, seenAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// 📐 DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────
const { width: W, height: H } = Dimensions.get('window');
const CELL_SIZE   = (W - 2) / 3;
const GRID_GUTTER = 1;
const HEADER_SCROLL_DISTANCE = 80;

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 PALETTE GALAXY (identique search.tsx)
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
  neb0: 'rgba(108,16,195,0.28)', neb1: 'rgba(172,24,160,0.18)',
  sW: '#F3EDFF', sB: '#B2CCFF', sG: '#FFE270', sP: '#CF98FF', sCy: '#86EEFF',
  glass: 'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
  primary: '#C060FF',
  accent: '#A855F7',
  gold: '#FFE270',
  cyan: '#86EEFF',
  success: '#1ED760',
  textSub: '#BCB8C2',
};

// ─────────────────────────────────────────────────────────────────────────────
// 🌟 GALAXY ANIMATION ENGINE — Portage intégral depuis search.tsx
// ─────────────────────────────────────────────────────────────────────────────
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface StarPt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
interface MeteorT { id: number; sx: number; sy: number; ang: number; len: number; }

const STARS: StarPt[] = Array.from({ length: 60 }, (_, i) => ({
  id: i, x: rnd(0, W), y: rnd(0, H * 1.8), sz: rnd(1.0, 2.4),
  col: pick([G.sW, G.sB, G.sP, G.sG]),
  del: rnd(0, 4200), dur: rnd(2000, 5500), mn: 0.18, mx: 0.9,
}));

const StarDot = memo(({ p }: { p: StarPt }) => {
  const op = useRef(new Animated.Value(p.mn)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(p.del % p.dur),
      Animated.timing(op, { toValue: p.mx, duration: p.dur * 0.5, useNativeDriver: true }),
      Animated.timing(op, { toValue: p.mn, duration: p.dur * 0.5, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: p.x, top: p.y,
      width: p.sz, height: p.sz, borderRadius: p.sz,
      backgroundColor: p.col, opacity: op,
    }} />
  );
});
StarDot.displayName = 'StarDot';

const ShootingStar = memo(({ m, onDone }: { m: MeteorT; onDone: () => void }) => {
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
  }, []);
  const tx = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(m.ang * Math.PI / 180) * 200] });
  const ty = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(m.ang * Math.PI / 180) * 200] });
  return (
    <Animated.View style={{
      position: 'absolute', left: m.sx, top: m.sy,
      opacity: op,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${m.ang}deg` }],
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
  const [meteors, setMeteors] = useState<MeteorT[]>([]);
  useEffect(() => {
    const i = setInterval(() => {
      if (Math.random() > 0.68)
        setMeteors(prev => [...prev, {
          id: Date.now(), sx: rnd(0, W), sy: rnd(0, H * 0.35),
          ang: rnd(20, 50), len: rnd(80, 160),
        }]);
    }, 2200);
    return () => clearInterval(i);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[G.bg0, G.bg1, G.bg2]} style={StyleSheet.absoluteFill} />
      <View style={gx.neb1} />
      <View style={gx.neb2} />
      <View style={gx.neb3} />
      {STARS.map(s => <StarDot key={s.id} p={s} />)}
      {meteors.map(m => (
        <ShootingStar key={m.id} m={m}
          onDone={() => setMeteors(prev => prev.filter(x => x.id !== m.id))} />
      ))}
    </View>
  );
});
GalaxyBackground.displayName = 'GalaxyBackground';

const gx = StyleSheet.create({
  neb1: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: G.neb0, top: -60, right: -60, opacity: 0.55 },
  neb2: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: G.neb1, top: 200, left: -90, opacity: 0.4 },
  neb3: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(86,238,255,0.06)', bottom: 400, right: -50, opacity: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 REAL CINEMA DATA
// ─────────────────────────────────────────────────────────────────────────────

const TOP_FILM = {
  id: 'tf1', title: 'Mulholland Drive',
  poster_url: 'https://image.tmdb.org/t/p/w500/obRBIOqfTimPwCh2bfevHBo1a6.jpg',
  genre: 'Néo-Noir', duration_type: 'film', rating: 5,
  director: 'David Lynch', year: 2001,
};

const TOP_2_3 = [
  { id: 'tf2', title: 'La Haine', poster_url: 'https://image.tmdb.org/t/p/w500/unFLMqTBzYkjT3UeMoOSixzXpHk.jpg', genre: 'Drame', duration_type: 'film', rating: 5, director: 'M. Kassovitz', year: 1995 },
  { id: 'tf3', title: 'Parasite', poster_url: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', genre: 'Thriller', duration_type: 'film', rating: 5, director: 'Bong Joon-ho', year: 2019 },
];

const OTHER_FAVS = [
  { id: 'of1', title: 'Moonlight', poster_url: 'https://image.tmdb.org/t/p/w500/4911T5FbJ9eAlnDw0RUUKA2P0Ep.jpg', genre: 'Drame', duration_type: 'film', rating: 5 },
  { id: 'of2', title: 'Mad Max: Fury Road', poster_url: 'https://image.tmdb.org/t/p/w500/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg', genre: 'Action', duration_type: 'film', rating: 5 },
  { id: 'of3', title: '2001: A Space Odyssey', poster_url: 'https://image.tmdb.org/t/p/w500/ve72VxNqjGM69Uky4WTo2bK6rfq.jpg', genre: 'Sci-Fi', duration_type: 'film', rating: 5 },
  { id: 'of4', title: 'The Grand Budapest Hotel', poster_url: 'https://image.tmdb.org/t/p/w500/nX5XotM9yprCKarRH4fzOq1VM1J.jpg', genre: 'Comédie', duration_type: 'film', rating: 5 },
];

const CRITIQUE_REVIEWS = [
  { id: 'cr1', film_id: 'cr1', content: 'Une œuvre visuelle d\'une densité rare. Villeneuve signe ici un manifeste sur la mémoire et l\'identité, porté par une photographie de Deakins qui frôle le sublime pictural.', rating: 5, likes_count: 342, created_at: '2024-11-12',
    film: { id: 'cr1', title: 'Dune: Part Two', poster_url: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', genre: 'Épique', duration_type: 'film' } },
  { id: 'cr2', film_id: 'cr2', content: 'Anatomy of a Fall déconstruit le récit judiciaire pour révéler l\'opacité fondamentale des relations humaines. Hüller est phénoménale.', rating: 5, likes_count: 218, created_at: '2024-10-01',
    film: { id: 'cr2', title: 'Anatomy of a Fall', poster_url: 'https://image.tmdb.org/t/p/w500/kQs6keheMwCxJxrzV83VUwFtHkB.jpg', genre: 'Thriller', duration_type: 'film' } },
  
];

const SEEN_WORKS = [
  { id: 'sw1',  title: 'The Bear',           poster_url: 'https://image.tmdb.org/t/p/w500/9Xw0I5RV2ZqNLpul6lXKoviYg55.jpg', genre: 'Drame',      duration_type: 'série', rating: 5 },
  { id: 'sw2',  title: 'Shogun',             poster_url: 'https://image.tmdb.org/t/p/w500/8UlWHLMpgZm9bx6QYh0NFoq67TZ.jpg', genre: 'Historique', duration_type: 'série', rating: 5 },
  { id: 'sw6',  title: 'Priscilla',          poster_url: 'https://image.tmdb.org/t/p/w500/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg', genre: 'Biopic',     duration_type: 'film',  rating: 4 },
  { id: 'sw8',  title: 'The Substance',      poster_url: 'https://image.tmdb.org/t/p/w500/5KCVkau1HEl7ZzfPsKAPM0sMiKc.jpg', genre: 'Horreur',    duration_type: 'film',  rating: 4 },
  { id: 'sw4',  title: 'Dune (2021)',        poster_url: 'https://image.tmdb.org/t/p/w500/8c4a8kE7PizaGQQnditMmI1xbRp.jpg', genre: 'Épique',     duration_type: 'film',  rating: 4 },
  { id: 'sw5',  title: 'Tenet',              poster_url: 'https://image.tmdb.org/t/p/w500/k68nPLbIST6NP96JmTxmZijEvCA.jpg', genre: 'Action',     duration_type: 'film',  rating: 4 },
  
];

const OWN_REELS = [
  { id: 'rl1', title: 'Fragmenta',    duration: "12'", poster_url: 'https://picsum.photos/seed/reel1/400/600', views: '2.4K', festival: 'Clermont-Ferrand 2024' },
  { id: 'rl2', title: 'Ekho',         duration: "8'",  poster_url: 'https://picsum.photos/seed/reel2/400/600', views: '1.1K', festival: 'SXSW 2024' },
  { id: 'rl3', title: 'La Fenêtre',   duration: "18'", poster_url: 'https://picsum.photos/seed/reel3/400/600', views: '890',  festival: 'Sundance 2023' },
  { id: 'rl4', title: 'Nox',          duration: "6'",  poster_url: 'https://picsum.photos/seed/reel4/400/600', views: '3.2K', festival: 'Cannes 2023' },
  { id: 'rl5', title: 'Seuil',        duration: "22'", poster_url: 'https://picsum.photos/seed/reel5/400/600', views: '670',  festival: 'Berlin 2024' },
  { id: 'rl6', title: 'Miroir Noir',  duration: "15'", poster_url: 'https://picsum.photos/seed/reel6/400/600', views: '1.8K', festival: 'Tribeca 2024' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 📐 TYPES
// ─────────────────────────────────────────────────────────────────────────────
type GridTab = 0 | 1 | 2;
interface Film   { id: string; title: string; poster_url: string; genre: string; duration_type: string; rating: number; director?: string; year?: number; }
interface Review { id: string; film_id: string; content: string; rating: number; likes_count: number; created_at: string; film?: { id: string; title: string; poster_url: string; genre: string; duration_type: string }; }

// ─────────────────────────────────────────────────────────────────────────────
// ✨ SHIMMER SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(() => {
  const tx = useRef(new Animated.Value(-W)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(tx, { toValue: W, duration: 1100, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: '#12002A', overflow: 'hidden' }}>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: W * 0.45, backgroundColor: 'rgba(192,96,255,0.07)', transform: [{ translateX: tx }, { skewX: '-15deg' }] }} />
    </View>
  );
});
Shimmer.displayName = 'Shimmer';

const SkeletonCell = memo(({ style }: { style?: any }) => (
  <View style={[{ overflow: 'hidden' }, style]}><Shimmer /></View>
));
SkeletonCell.displayName = 'SkeletonCell';

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ STAR RATING
// ─────────────────────────────────────────────────────────────────────────────
const StarRating = memo(({ rating, size = 10 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 1 }}>
    {[1, 2, 3, 4, 5].map(s => (
      <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color={G.gold} />
    ))}
  </View>
));
StarRating.displayName = 'StarRating';

// ─────────────────────────────────────────────────────────────────────────────
// 🎛️ STAT COLUMN
// ─────────────────────────────────────────────────────────────────────────────
const StatColumn = memo(({ value, label, onPress }: { value: string; label: string; onPress?: () => void }) => (
  <TouchableOpacity style={sc.col} onPress={onPress} activeOpacity={0.7}>
    <Text style={sc.val}>{value}</Text>
    <Text style={sc.lbl}>{label}</Text>
  </TouchableOpacity>
));
StatColumn.displayName = 'StatColumn';
const sc = StyleSheet.create({
  col: { alignItems: 'center', flex: 1 },
  val: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  lbl: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1, textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🃏 GRID CELLS
// ─────────────────────────────────────────────────────────────────────────────

/** #1 — Film préféré absolu */
const TopFilmCell = memo(({ film, onPress, onPressIn }: { film: Film | null; onPress: () => void; onPressIn?: () => void }) => {
  const pulseOp = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseOp, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(pulseOp, { toValue: 0.5, duration: 1600, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <TouchableOpacity style={[cells.cell, { width: CELL_SIZE, height: CELL_SIZE * 1.3 }]} onPress={onPress} onPressIn={onPressIn} activeOpacity={0.88}>
      {film
        ? <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1A0035' }]} />
      }
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(192,96,255,0.06)' }]} />
      <Animated.View style={[cells.glowRing, { opacity: pulseOp }]} />
      <View style={cells.sparkle}><Text style={{ fontSize: 15 }}>✨</Text></View>
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.88)']} style={cells.overlay}>
        <Text style={cells.overlayLabel}>Ton film préf</Text>
        {film && <StarRating rating={film.rating} size={9} />}
        {film?.director && <Text style={cells.metaText} numberOfLines={1}>{film.director} · {film.year}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
});
TopFilmCell.displayName = 'TopFilmCell';

/** #2 — Top 2 & 3 (split vertical) */
const Top2FilmsCell = memo(({ films, onPress }: { films: Film[]; onPress: () => void }) => {
  const [f1, f2] = films;
  return (
    <TouchableOpacity style={[cells.cell, { width: CELL_SIZE, height: CELL_SIZE * 1.3 }]} onPress={onPress} activeOpacity={0.88}>
      <View style={{ flex: 1 }}>
        <View style={[cells.splitHalf, { borderBottomWidth: GRID_GUTTER, borderColor: G.bg0 }]}>
          {f1 ? <Image source={{ uri: f1.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#120025' }]} />}
          <BlurView intensity={28} tint="dark" style={cells.rankTag}><Text style={cells.rankNum}>02</Text></BlurView>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,226,112,0.04)' }]} />
        </View>
        <View style={cells.splitHalf}>
          {f2 ? <Image source={{ uri: f2.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#120025' }]} />}
          <BlurView intensity={28} tint="dark" style={cells.rankTag}><Text style={cells.rankNum}>03</Text></BlurView>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(192,96,255,0.04)' }]} />
        </View>
      </View>
      <View style={cells.sparkle}><Text style={{ fontSize: 15 }}>⭐</Text></View>
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.85)']} style={[cells.overlay, { paddingBottom: 6 }]}>
        <Text style={cells.overlayLabel}>Tes 2 film préf</Text>
        <Text style={cells.overlaySub}>après le 1</Text>
        <Text style={cells.metaText}>Une grosse étoile · 2 slide</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
});
Top2FilmsCell.displayName = 'Top2FilmsCell';

/** #3 — Autres favoris (micro-grid 2×2) */
const OtherFavsCell = memo(({ films, onPress }: { films: Film[]; onPress: () => void }) => (
  <TouchableOpacity style={[cells.cell, { width: CELL_SIZE, height: CELL_SIZE * 1.3 }]} onPress={onPress} activeOpacity={0.88}>
    <View style={cells.microGrid}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={[cells.microCell,
          i % 2 === 0 ? { marginRight: 0.5 } : { marginLeft: 0.5 },
          i < 2 ? { marginBottom: 0.5 } : { marginTop: 0.5 },
        ]}>
          {films[i]
            ? <Image source={{ uri: films[i].poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1A0030' }]} />
          }
        </View>
      ))}
    </View>
    <View style={cells.sparkle}><Text style={{ fontSize: 15 }}>✦</Text></View>
    <LinearGradient colors={['transparent', 'rgba(6,0,16,0.84)']} style={[cells.overlay, { paddingBottom: 6 }]}>
      <Text style={cells.overlayLabel}>Tes autres fav</Text>
      <Text style={cells.overlaySub}>Après ton top</Text>
    </LinearGradient>
  </TouchableOpacity>
));
OtherFavsCell.displayName = 'OtherFavsCell';

/** Critique cell — papyrus texture */
const CritiqueCell = memo(({ review, index, onPress }: { review: Review; index: number; onPress: () => void }) => {
  const isWide = index === 0;
  const cellW  = isWide ? CELL_SIZE * 2 + GRID_GUTTER : CELL_SIZE;
  return (
    <TouchableOpacity style={[cells.cell, { width: cellW, height: CELL_SIZE }]} onPress={onPress} activeOpacity={0.88}>
      {review.film
        ? <Image source={{ uri: review.film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1C0A02' }]} />
      }
      <LinearGradient colors={['rgba(160,90,20,0.2)', 'rgba(80,40,5,0.5)']} style={StyleSheet.absoluteFillObject} />
      {[0.28, 0.55, 0.78].map(t => (
        <View key={t} style={{ position: 'absolute', left: 0, right: 0, top: `${t * 100}%`, height: 0.5, backgroundColor: 'rgba(255,220,120,0.07)' }} />
      ))}
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.92)']} style={cells.overlay}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="pencil" size={9} color="rgba(255,220,120,0.9)" />
          <Text style={cells.critiqueLabel}>Critique</Text>
          {isWide && review.film && <Text style={[cells.metaText, { marginLeft: 4 }]} numberOfLines={1}>— {review.film.title}</Text>}
        </View>
        {isWide && <Text style={cells.critiqueSnippet} numberOfLines={2}>{review.content}</Text>}
        <StarRating rating={review.rating} size={9} />
      </LinearGradient>
    </TouchableOpacity>
  );
});
CritiqueCell.displayName = 'CritiqueCell';

/** Films vus */
const SeenCell = memo(({ film, onPress, onPressIn }: { film: Film; onPress: () => void; onPressIn?: () => void }) => {
  const isShow = film.duration_type === 'série';
  return (
    <TouchableOpacity style={[cells.cell, { width: CELL_SIZE, height: CELL_SIZE }]} onPress={onPress} onPressIn={onPressIn} activeOpacity={0.88}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <View style={[cells.eyeBadge, { backgroundColor: isShow ? `${G.cyan}CC` : `${G.success}CC` }]}>
        <Ionicons name={isShow ? 'tv' : 'eye'} size={8} color="#fff" />
      </View>
      <View style={cells.typeTag}>
        <Text style={cells.typeTagText}>{isShow ? 'Série' : 'Film'}</Text>
      </View>
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.7)']} style={cells.overlayThin}>
        <Text style={cells.seenTitle} numberOfLines={1}>{film.title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
});
SeenCell.displayName = 'SeenCell';

/** Court métrage (Reels tab) */
const ReelCell = memo(({ reel, onPress }: { reel: typeof OWN_REELS[0]; onPress: () => void }) => (
  <TouchableOpacity style={[cells.cell, { width: CELL_SIZE, height: CELL_SIZE * 1.4 }]} onPress={onPress} activeOpacity={0.88}>
    <Image source={{ uri: reel.poster_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
    <LinearGradient colors={['rgba(6,0,16,0.15)', 'rgba(6,0,16,0.9)']} style={StyleSheet.absoluteFillObject} />
    <View style={cells.playBtn}>
      <Ionicons name="play" size={16} color="#fff" />
    </View>
    <BlurView intensity={22} tint="dark" style={cells.festivalBadge}>
      <Text style={cells.festivalText}>{reel.festival}</Text>
    </BlurView>
    <LinearGradient colors={['transparent', 'rgba(6,0,16,0.94)']} style={cells.overlay}>
      <Text style={cells.overlayLabel} numberOfLines={1}>{reel.title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="time-outline" size={8} color={G.textSub} /><Text style={cells.metaText}>{reel.duration}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="eye-outline" size={8} color={G.textSub} /><Text style={cells.metaText}>{reel.views}</Text>
        </View>
      </View>
    </LinearGradient>
  </TouchableOpacity>
));
ReelCell.displayName = 'ReelCell';

const cells = StyleSheet.create({
  cell:          { overflow: 'hidden', backgroundColor: '#0A0018', position: 'relative' },
  overlay:       { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 7, paddingTop: 22, paddingBottom: 6, gap: 3 },
  overlayThin:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 5, paddingTop: 10, paddingBottom: 4 },
  overlayLabel:  { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.1, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  overlaySub:    { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '500' },
  metaText:      { color: 'rgba(255,255,255,0.4)', fontSize: 8, fontStyle: 'italic' },
  sparkle:       { position: 'absolute', top: 5, left: 5 },
  glowRing:      { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderRadius: 4, borderWidth: 1.5, borderColor: G.primary },
  splitHalf:     { flex: 1, overflow: 'hidden', position: 'relative' },
  rankTag:       { position: 'absolute', top: 4, right: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, overflow: 'hidden' },
  rankNum:       { color: G.gold, fontSize: 9, fontWeight: '900' },
  microGrid:     { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  microCell:     { width: '50%', height: '50%', overflow: 'hidden', position: 'relative', backgroundColor: '#1A0030' },
  critiqueLabel: { color: 'rgba(255,220,120,0.95)', fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  critiqueSnippet: { color: 'rgba(255,255,255,0.65)', fontSize: 9, lineHeight: 13, fontStyle: 'italic' },
  eyeBadge:      { position: 'absolute', top: 5, right: 5, width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  typeTag:       { position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  typeTagText:   { color: 'rgba(255,255,255,0.7)', fontSize: 7, fontWeight: '700', letterSpacing: 0.3 },
  seenTitle:     { color: '#fff', fontSize: 8, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  playBtn:       { position: 'absolute', top: '50%', left: '50%', marginTop: -17, marginLeft: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  festivalBadge: { position: 'absolute', top: 7, left: 7, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,226,112,0.25)' },
  festivalText:  { color: G.gold, fontSize: 7, fontWeight: '800', letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🤖 VIDEO GENERATION MODAL — AI Reels Studio
// ─────────────────────────────────────────────────────────────────────────────

const VIDEO_STYLES = [
  { id: 'noir',   label: 'Néo-Noir',      icon: '🌑', color: '#888' },
  { id: 'dream',  label: 'Onirique',      icon: '🌀', color: G.accent },
  { id: 'docu',   label: 'Documentaire',  icon: '🎙️', color: G.cyan },
  { id: 'essay',  label: 'Essai visuel',  icon: '🎞️', color: G.gold },
  { id: 'experi', label: 'Expérimental',  icon: '✦',  color: '#FF6B9D' },
];
const GEN_PHASES = ['Analyse du scénario', 'Génération des plans', 'Color grading IA', 'Mixage sonore', 'Rendu final'];

const VideoGenModal = memo(({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const [style,      setStyle]      = useState('noir');
  const [generating, setGenerating] = useState(false);
  const [phase,      setPhase]      = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    for (let i = 0; i < GEN_PHASES.length; i++) {
      setPhase(i);
      await new Promise(r => setTimeout(r, 900 + Math.random() * 500));
    }
    Animated.timing(progress, { toValue: 1, duration: 600, useNativeDriver: false }).start();
    await new Promise(r => setTimeout(r, 700));
    setGenerating(false); setPhase(0); progress.setValue(0);
    onClose();
  }, [onClose]);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const activeStyle = VIDEO_STYLES.find(s => s.id === style)!;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={vg.backdrop} onPress={onClose} />
      <View style={vg.sheet}>
        <GalaxyBackground />
        <View style={vg.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={vg.content}>

          {/* Header */}
          <View style={vg.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <LinearGradient colors={['#3A0070', G.primary]} style={vg.headerIcon}>
                <Ionicons name="sparkles" size={20} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={vg.title}>Studio IA Cinéma</Text>
                <Text style={vg.subtitle}>Génération de court métrage</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={vg.closeBtn}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {/* Style selector */}
          <Text style={vg.sectionLabel}>STYLE CINÉMATOGRAPHIQUE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4, paddingRight: 20, marginBottom: 18 }}>
            {VIDEO_STYLES.map(st => {
              const on = style === st.id;
              return (
                <TouchableOpacity key={st.id} style={[vg.styleChip, on && { borderColor: st.color, backgroundColor: `${st.color}15` }]} onPress={() => setStyle(st.id)} activeOpacity={0.8}>
                  <Text style={{ fontSize: 22 }}>{st.icon}</Text>
                  <Text style={[vg.styleLabel, on && { color: st.color }]}>{st.label}</Text>
                  {on && <View style={[vg.styleDot, { backgroundColor: st.color }]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Prompt area */}
          <Text style={vg.sectionLabel}>INTENTION NARRATIVE</Text>
          <BlurView intensity={14} tint="dark" style={vg.promptBox}>
            <Ionicons name="create-outline" size={15} color={activeStyle.color} style={{ marginRight: 10, marginTop: 2 }} />
            <Text style={vg.promptPlaceholder}>
              Une femme seule dans un appartement vide contemple la pluie sur Paris. Le néon d'en face pulse doucement…
            </Text>
          </BlurView>

          {/* Params grid */}
          <Text style={vg.sectionLabel}>PARAMÈTRES TECHNIQUES</Text>
          <View style={vg.paramsGrid}>
            {[
              { label: 'Durée', val: '2–4 min', icon: 'timer-outline' },
              { label: 'Format', val: '4K 16:9', icon: 'resize-outline' },
              { label: 'Fps', val: '24 fps cinéma', icon: 'film-outline' },
              { label: 'Son', val: 'IA + ambiance', icon: 'musical-notes-outline' },
            ].map(p => (
              <BlurView key={p.label} intensity={10} tint="dark" style={vg.paramCard}>
                <Ionicons name={p.icon as any} size={14} color={activeStyle.color} />
                <Text style={vg.paramLabel}>{p.label}</Text>
                <Text style={vg.paramVal}>{p.val}</Text>
              </BlurView>
            ))}
          </View>

          {/* Generation progress */}
          {generating && (
            <BlurView intensity={14} tint="dark" style={vg.genBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <ActivityIndicator color={activeStyle.color} size="small" />
                <Text style={vg.genPhase}>{GEN_PHASES[phase]}</Text>
              </View>
              <View style={vg.genTrack}>
                <Animated.View style={[vg.genBar, { width: barWidth }]}>
                  <LinearGradient colors={[G.accent, G.primary, G.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
                </Animated.View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 10 }}>
                {GEN_PHASES.map((_, i) => (
                  <View key={i} style={[vg.phaseDot, i <= phase && { backgroundColor: activeStyle.color }]} />
                ))}
              </View>
            </BlurView>
          )}

          {/* CTA */}
          <TouchableOpacity onPress={handleGenerate} disabled={generating} activeOpacity={0.88}>
            <LinearGradient
              colors={generating ? ['#1A0035', '#2A0050'] : ['#5A0FA0', G.primary]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={vg.genBtn}
            >
              {generating
                ? <><ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} /><Text style={vg.genBtnTxt}>Génération en cours…</Text></>
                : <><Ionicons name="sparkles" size={18} color="#fff" style={{ marginRight: 10 }} /><Text style={vg.genBtnTxt}>Générer le court métrage</Text></>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Info */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14 }}>
            <Ionicons name="information-circle-outline" size={13} color={G.textSub} />
            <Text style={{ color: G.textSub, fontSize: 11, lineHeight: 16, flex: 1 }}>
              Modèle diffusion vidéo entraîné sur des corpus de cinéma d'auteur. Résultat disponible en 3–8 min.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
});
VideoGenModal.displayName = 'VideoGenModal';

const vg = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet:      { height: H * 0.88, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', backgroundColor: G.bg0, borderTopWidth: 1, borderColor: G.glassBorder },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 10 },
  content:    { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 50 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title:      { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  subtitle:   { color: G.textSub, fontSize: 12, marginTop: 1 },
  closeBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  styleChip:  { alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass, minWidth: 78 },
  styleLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  styleDot:   { width: 5, height: 5, borderRadius: 3 },
  promptBox:  { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 14, marginBottom: 16, overflow: 'hidden' },
  promptPlaceholder: { color: 'rgba(255,255,255,0.22)', fontSize: 13, lineHeight: 20, fontStyle: 'italic', flex: 1 },
  paramsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  paramCard:  { width: (W - 50) / 2, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 12, gap: 4, overflow: 'hidden' },
  paramLabel: { color: G.textSub, fontSize: 10, fontWeight: '600', marginTop: 2 },
  paramVal:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  genBox:     { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(192,96,255,0.28)', padding: 16, marginBottom: 16, overflow: 'hidden' },
  genPhase:   { color: '#fff', fontSize: 13, fontWeight: '600' },
  genTrack:   { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  genBar:     { height: '100%', borderRadius: 3, overflow: 'hidden' },
  phaseDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)' },
  genBtn:     { paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  genBtnTxt:  { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🖼️ EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = memo(({ icon, text, subtext }: { icon: string; text: string; subtext?: string }) => (
  <View style={es.wrap}>
    <LinearGradient colors={['rgba(192,96,255,0.1)', 'transparent']} style={es.iconCircle}>
      <Ionicons name={icon as any} size={36} color={G.primary} />
    </LinearGradient>
    <Text style={es.text}>{text}</Text>
    {subtext && <Text style={es.sub}>{subtext}</Text>}
  </View>
));
EmptyState.displayName = 'EmptyState';
const es = StyleSheet.create({
  wrap:      { alignItems: 'center', paddingVertical: 48, gap: 12 },
  iconCircle:{ width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(192,96,255,0.2)' },
  text:      { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' },
  sub:       { color: 'rgba(255,255,255,0.22)', fontSize: 12 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🏠 MAIN PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeGridTab,   setActiveGridTab]   = useState<GridTab>(0);
  const [reviews,         setReviews]         = useState<Review[]>([]);
  const [seenFilms,       setSeenFilms]       = useState<Film[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [videoGenVisible, setVideoGenVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Prefetch ────────────────────────────────────────────────────────────
  const prefetched = useRef<Set<string>>(new Set());
  const prefetchFilm = useCallback((id: string) => {
    if (prefetched.current.has(id)) return;
    prefetched.current.add(id);
  }, []);
  const navigateFilm = useCallback((id: string) => { router.push(`/film/${id}`); }, [router]);

  // ── Load ────────────────────────────────────────────────────────────────
  const loadProfileData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [rev, seen] = await Promise.all([
        reviewsAPI.getByUser(user.id).catch(() => CRITIQUE_REVIEWS),
        seenAPI.getByUser(user.id).catch(() => SEEN_WORKS),
      ]);
      setReviews(rev?.length ? rev : CRITIQUE_REVIEWS);
      setSeenFilms(seen?.length ? seen : SEEN_WORKS);
    } catch {
      setReviews(CRITIQUE_REVIEWS);
      setSeenFilms(SEEN_WORKS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadProfileData(); }, [loadProfileData]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const allFavs = useMemo<Film[]>(() => {
    const fromRev = reviews
      .filter(r => r.film && r.rating >= 4)
      .sort((a, b) => b.rating - a.rating)
      .map(r => r.film as Film);
    const extra = seenFilms.filter(f => !fromRev.some(r => r.id === f.id));
    return [...fromRev, ...extra];
  }, [reviews, seenFilms]);

  const topFilm  = useMemo(() => (allFavs[0] ?? TOP_FILM) as Film,   [allFavs]);
  const top2to3  = useMemo(() => (allFavs.slice(1, 3).length ? allFavs.slice(1, 3) : TOP_2_3) as Film[], [allFavs]);
  const otherFavs= useMemo(() => (allFavs.slice(3, 13).length ? allFavs.slice(3, 13) : OTHER_FAVS) as Film[], [allFavs]);

  const formatStat = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
    return `${n}`;
  };

  const stickyOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE], outputRange: [0, 1], extrapolate: 'clamp',
  });

  // ── Grid content ────────────────────────────────────────────────────────
  function renderGridContent() {
    if (loading) {
      return (
        <View>
          <View style={{ flexDirection: 'row', backgroundColor: G.bg0 }}>
            <SkeletonCell style={{ width: CELL_SIZE, height: CELL_SIZE * 1.3 }} />
            <View style={{ width: GRID_GUTTER }} />
            <SkeletonCell style={{ width: CELL_SIZE, height: CELL_SIZE * 1.3 }} />
            <View style={{ width: GRID_GUTTER }} />
            <SkeletonCell style={{ width: CELL_SIZE, height: CELL_SIZE * 1.3 }} />
          </View>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={{ marginTop: GRID_GUTTER }}>
              <View style={{ flexDirection: 'row', backgroundColor: G.bg0 }}>
                {[...Array(3)].map((_, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <View style={{ width: GRID_GUTTER }} />}
                    <SkeletonCell style={{ width: CELL_SIZE, height: CELL_SIZE }} />
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    }

    // Build critique rows
    const critiqueRows: Review[][] = [];
    if (reviews[0]) critiqueRows.push([reviews[0], reviews[1]].filter(Boolean) as Review[]);
    let ci = critiqueRows[0]?.length ?? 0;
    while (ci < reviews.length) { critiqueRows.push(reviews.slice(ci, ci + 3)); ci += 3; }

    // Build seen rows
    const seenRows: Film[][] = [];
    for (let si = 0; si < seenFilms.length; si += 3) seenRows.push(seenFilms.slice(si, si + 3));

    return (
      <View>
        {/* TOP FILMS ROW */}
        <View style={{ flexDirection: 'row', backgroundColor: G.bg0 }}>
          <TopFilmCell film={topFilm} onPress={() => navigateFilm(topFilm.id)} onPressIn={() => prefetchFilm(topFilm.id)} />
          <View style={{ width: GRID_GUTTER }} />
          <Top2FilmsCell films={top2to3} onPress={() => navigateFilm(top2to3[0]?.id ?? '')} />
          <View style={{ width: GRID_GUTTER }} />
          <OtherFavsCell films={otherFavs} onPress={() => router.push('/profile/favorites')} />
        </View>

        {/* CRITIQUE SECTION BANNER */}
        <BlurView intensity={10} tint="dark" style={pg.sectionBanner}>
          <Ionicons name="pencil" size={11} color="rgba(255,220,120,0.85)" />
          <Text style={pg.sectionBannerText}>Critiques cinématographiques</Text>
          <View style={pg.sectionBannerLine} />
        </BlurView>

        {/* CRITIQUES ROWS */}
        {reviews.length === 0
          ? <EmptyState icon="chatbubble-outline" text="Aucune critique publiée" />
          : critiqueRows.map((rowRevs, rowIdx) => (
              <View key={`cr-${rowIdx}`}>
                <View style={{ flexDirection: 'row', backgroundColor: G.bg0 }}>
                  {rowIdx === 0 ? (
                    <>
                      <CritiqueCell review={rowRevs[0]} index={0} onPress={() => rowRevs[0].film && navigateFilm(rowRevs[0].film.id)} />
                      {rowRevs[1] && <>
                        <View style={{ width: GRID_GUTTER }} />
                        <CritiqueCell review={rowRevs[1]} index={1} onPress={() => rowRevs[1].film && navigateFilm(rowRevs[1].film.id)} />
                      </>}
                    </>
                  ) : (
                    rowRevs.map((rev, rIdx) => (
                      <React.Fragment key={rev.id}>
                        {rIdx > 0 && <View style={{ width: GRID_GUTTER }} />}
                        <CritiqueCell review={rev} index={rIdx} onPress={() => rev.film && navigateFilm(rev.film.id)} />
                      </React.Fragment>
                    ))
                  )}
                </View>
                <View style={{ height: GRID_GUTTER }} />
              </View>
            ))
        }

        {/* SEEN SECTION BANNER */}
        <BlurView intensity={10} tint="dark" style={pg.sectionBanner}>
          <Ionicons name="eye" size={11} color={G.cyan} />
          <Text style={[pg.sectionBannerText, { color: G.cyan }]}>Films & Séries visionnés</Text>
          <View style={[pg.sectionBannerLine, { backgroundColor: `${G.cyan}28` }]} />
        </BlurView>

        {/* SEEN ROWS */}
        {seenFilms.length === 0
          ? <EmptyState icon="film-outline" text="Aucun film vu pour l'instant" />
          : seenRows.map((rowFilms, rowIdx) => (
              <View key={`sw-${rowIdx}`}>
                <View style={{ flexDirection: 'row', backgroundColor: G.bg0 }}>
                  {rowFilms.map((film, fIdx) => (
                    <React.Fragment key={film.id}>
                      {fIdx > 0 && <View style={{ width: GRID_GUTTER }} />}
                      <SeenCell film={film} onPress={() => navigateFilm(film.id)} onPressIn={() => prefetchFilm(film.id)} />
                    </React.Fragment>
                  ))}
                </View>
                <View style={{ height: GRID_GUTTER }} />
              </View>
            ))
        }

        <View style={{ height: 120 }} />
      </View>
    );
  }

  // ── Reels content (tab 1) ────────────────────────────────────────────────
  function renderReelsContent() {
    const rows: (typeof OWN_REELS)[] = [];
    for (let i = 0; i < OWN_REELS.length; i += 3) rows.push(OWN_REELS.slice(i, i + 3));
    return (
      <View>
        <TouchableOpacity onPress={() => setVideoGenVisible(true)} activeOpacity={0.88} style={{ margin: 12 }}>
          <LinearGradient colors={['#2A0060', '#7B1FA2', G.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={pg.genCta}>
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={pg.genCtaText}>Générer un court métrage avec l'IA</Text>
            <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.65)" />
          </LinearGradient>
        </TouchableOpacity>
        {rows.map((rowReels, ri) => (
          <View key={`rl-${ri}`}>
            <View style={{ flexDirection: 'row', backgroundColor: G.bg0 }}>
              {rowReels.map((reel, idx) => (
                <React.Fragment key={reel.id}>
                  {idx > 0 && <View style={{ width: GRID_GUTTER }} />}
                  <ReelCell reel={reel} onPress={() => router.push(`/reel/${reel.id}` as any)} />
                </React.Fragment>
              ))}
            </View>
            <View style={{ height: GRID_GUTTER }} />
          </View>
        ))}
        <View style={{ height: 120 }} />
      </View>
    );
  }

  if (!user) return null;

  return (
    <View style={pg.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Sticky header */}
      <Animated.View style={[pg.stickyHeader, { opacity: stickyOpacity }]} pointerEvents="none">
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        <Text style={pg.stickyUsername}>{user.username}</Text>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfileData(); }} tintColor={G.primary} />}
      >
        {/* ══════════════════════════════════════════════════════════════
            PROFILE HEADER
        ══════════════════════════════════════════════════════════════ */}
        <LinearGradient colors={['#160030', '#3A0070', '#0A0018']} locations={[0, 0.42, 1]} style={pg.headerGrad}>
          <SafeAreaView edges={['top']}>
            {/* Top nav */}
            <View style={pg.topNav}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="lock-closed" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={pg.usernameNav}>{user.username}</Text>
                <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.6)" />
              </View>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                <TouchableOpacity style={pg.navBtn} onPress={() => setVideoGenVisible(true)}>
                  <Ionicons name="sparkles-outline" size={23} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity testID="profile-add-post-btn" style={pg.navBtn} onPress={() => router.push('/create')}>
                  <Ionicons name="add-circle-outline" size={23} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity testID="profile-settings-btn" style={pg.navBtn} onPress={() => router.push('/settings')}>
                  <Ionicons name="menu" size={23} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Avatar + Stats */}
            <View style={pg.avatarStatsRow}>
              <View>
                <LinearGradient colors={['#D300C5', '#FF7A00', '#FFDC80']} style={pg.avatarRing} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}>
                  <View style={pg.avatarInner}>
                    <Image source={{ uri: user.avatar_url ?? `https://i.pravatar.cc/150?u=${user.id}` }} style={pg.avatar} />
                  </View>
                </LinearGradient>
                <View style={pg.avatarAddBtn}>
                  <LinearGradient colors={[G.accent, G.primary]} style={pg.avatarAddGrad}>
                    <Ionicons name="add" size={13} color="#fff" />
                  </LinearGradient>
                </View>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
                <StatColumn value={`${(user.reviews_count ?? 6) + (user.films_seen_count ?? 12)}`} label="publications" />
                <StatColumn value={formatStat(user.followers_count ?? 2840)} label="abonnés" onPress={() => router.push('/followers')} />
                <StatColumn value={formatStat(user.following_count ?? 318)} label="abonnements" onPress={() => router.push('/following')} />
              </View>
            </View>

            {/* Bio */}
            <View style={pg.bioSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <Text style={pg.displayName}>{user.username}</Text>
                <BlurView intensity={18} tint="dark" style={pg.rolePill}>
                  <Text style={pg.rolePillText}>
                    {user.role === 'critic' ? '✍️ Critique' : user.role === 'creator' ? '⭐ Créateur' : '🎬 Réalisateur·rice'}
                  </Text>
                </BlurView>
              </View>
              <Text style={pg.bioText}>{user.bio ?? 'Cinéaste indépendant · Court métrages · Cannes, Sundance, Berlin 🎞️'}</Text>
              <View style={pg.cinephileRow}>
                <View style={pg.cinephileStat}>
                  <Ionicons name="film" size={10} color={G.gold} />
                  <Text style={pg.cinephileStatText}>{seenFilms.length + 12} films</Text>
                </View>
                <View style={pg.cinephileStat}>
                  <Ionicons name="pencil" size={10} color={G.primary} />
                  <Text style={pg.cinephileStatText}>{reviews.length} critiques</Text>
                </View>
                <View style={pg.cinephileStat}>
                  <Ionicons name="trophy" size={10} color={G.cyan} />
                  <Text style={pg.cinephileStatText}>6 festivals</Text>
                </View>
              </View>
            </View>

            {/* Action buttons */}
            <View style={pg.actionRow}>
              <TouchableOpacity testID="profile-edit-btn" style={pg.actionBtn} onPress={() => router.push('/edit-profile')} activeOpacity={0.8}>
                <Text style={pg.actionBtnText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={pg.actionBtn} activeOpacity={0.8}>
                <Text style={pg.actionBtnText}>Partager le profil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={pg.actionBtnSquare} onPress={() => router.push('/discover-people')} activeOpacity={0.8}>
                <Ionicons name="person-add-outline" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* HIGHLIGHTS ROW */}
        <View style={{ backgroundColor: G.bg0 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pg.highlightsScroll}>
            {[
              { emoji: '🏆', label: 'Top 10',    color: G.gold },
              { emoji: '✍️', label: 'Critiques', color: 'rgba(255,220,120,0.9)' },
              { emoji: '👁',  label: 'Films vus', color: G.cyan },
              { emoji: '🎬', label: 'Réalisés',   color: G.primary },
              { emoji: '⭐', label: 'Favoris',    color: '#FF6B9D' },
            ].map(item => (
              <TouchableOpacity key={item.label} style={pg.highlightChip} activeOpacity={0.8}>
                <LinearGradient colors={['#1A0040', '#3A0080']} style={[pg.highlightCircle, { borderColor: `${item.color}45` }]}>
                  <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                </LinearGradient>
                <Text style={pg.highlightLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* GRID TAB BAR */}
        <View style={pg.gridTabBar}>
          {(['grid-outline', 'play-circle-outline', 'person-circle-outline'] as const).map((icon, idx) => (
            <TouchableOpacity key={icon} style={pg.gridTabItem} onPress={() => setActiveGridTab(idx as GridTab)} activeOpacity={0.8}>
              <Ionicons name={icon} size={22} color={activeGridTab === idx ? '#fff' : 'rgba(255,255,255,0.32)'} />
              {activeGridTab === idx && <View style={pg.gridTabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* GRID CONTENT */}
        {activeGridTab === 0 && renderGridContent()}
        {activeGridTab === 1 && renderReelsContent()}
        {activeGridTab === 2 && <EmptyState icon="pricetag-outline" text="Aucun tag" subtext="Les films où vous êtes tagué apparaissent ici" />}
      </Animated.ScrollView>

      <VideoGenModal visible={videoGenVisible} onClose={() => setVideoGenVisible(false)} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 STYLES PRINCIPAUX
// ─────────────────────────────────────────────────────────────────────────────
const pg = StyleSheet.create({
  root:        { flex: 1, backgroundColor: G.bg0 },

  stickyHeader:{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, height: 46, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8, overflow: 'hidden' },
  stickyUsername: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2, zIndex: 1 },

  headerGrad:  { paddingBottom: 18 },
  topNav:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  usernameNav: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  navBtn:      { padding: 5 },

  avatarStatsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginTop: 4, gap: 14 },
  avatarRing:  { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 86, height: 86, borderRadius: 43, backgroundColor: G.bg0, alignItems: 'center', justifyContent: 'center' },
  avatar:      { width: 82, height: 82, borderRadius: 41 },
  avatarAddBtn:{ position: 'absolute', bottom: 0, right: 0, width: 27, height: 27, borderRadius: 14, backgroundColor: G.bg0, alignItems: 'center', justifyContent: 'center' },
  avatarAddGrad: { width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  bioSection:  { paddingHorizontal: 16, marginTop: 11, gap: 4 },
  displayName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  rolePill:    { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(192,96,255,0.3)' },
  rolePillText:{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' },
  bioText:     { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, lineHeight: 18 },
  cinephileRow:{ flexDirection: 'row', gap: 14, marginTop: 5 },
  cinephileStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cinephileStatText: { color: 'rgba(255,255,255,0.5)', fontSize: 10.5, fontWeight: '600' },

  actionRow:   { flexDirection: 'row', paddingHorizontal: 12, marginTop: 14, gap: 6 },
  actionBtn:   { flex: 1, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionBtnSquare: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },

  highlightsScroll: { paddingHorizontal: 12, paddingVertical: 14, gap: 16 },
  highlightChip:    { alignItems: 'center', gap: 6 },
  highlightCircle:  { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  highlightLabel:   { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '500', textAlign: 'center' },

  gridTabBar:   { flexDirection: 'row', backgroundColor: G.bg0, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  gridTabItem:  { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  gridTabIndicator: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: '#fff' },

  sectionBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, overflow: 'hidden', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  sectionBannerText: { color: 'rgba(255,220,120,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  sectionBannerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(255,220,120,0.14)' },

  genCta:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16 },
  genCtaText:  { color: '#fff', fontSize: 14, fontWeight: '800', flex: 1 },
});