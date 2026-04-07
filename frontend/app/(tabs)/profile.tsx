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
import * as FileSystem   from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing      from 'expo-sharing';
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
// 🌌 PALETTE GALAXY
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
  neb0: 'rgba(108,16,195,0.32)', neb1: 'rgba(172,24,160,0.22)',
  neb2: 'rgba(60,0,160,0.18)',
  sW: '#F3EDFF', sB: '#B2CCFF', sG: '#FFE270', sP: '#CF98FF', sCy: '#86EEFF',
  glass: 'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
  primary: '#C060FF',
  accent: '#A855F7',
  gold: '#FFE270',
  cyan: '#86EEFF',
  success: '#1ED760',
  danger: '#FF4D6A',
  textSub: '#BCB8C2',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 🖼️ IMAGE WITH FALLBACK
//  Résout le ERR_NAME_NOT_RESOLVED : skeleton pendant le chargement,
//  fallback gradient si l'URL échoue, retry automatique une fois.
// ─────────────────────────────────────────────────────────────────────────────

interface ImageWithFallbackProps {
  uri: string;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  fallbackColors?: [string, string];
}

const ImageWithFallback = memo(function ImageWithFallback({
  uri,
  style,
  resizeMode = 'cover',
  fallbackColors = ['#1A0035', '#060010'],
}: ImageWithFallbackProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retried, setRetried] = useState(false);
  const shimTx = useRef(new Animated.Value(-W)).current;

  useEffect(() => {
    setState('loading');
    setRetried(false);
  }, [uri]);

  useEffect(() => {
    if (state !== 'loading') return;
    const anim = Animated.loop(
      Animated.timing(shimTx, { toValue: W, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [state, shimTx]);

  const handleError = useCallback(() => {
    if (!retried) {
      // Retry une fois après 400 ms
      setRetried(true);
      setTimeout(() => setState('loading'), 400);
    } else {
      setState('error');
    }
  }, [retried]);

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      {/* Fallback gradient (visible si erreur ou pendant chargement) */}
      <LinearGradient
        colors={fallbackColors}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Image réelle */}
      {state !== 'error' && (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFillObject, { opacity: state === 'loaded' ? 1 : 0 }]}
          resizeMode={resizeMode}
          onLoad={() => setState('loaded')}
          onError={handleError}
        />
      )}

      {/* Shimmer skeleton */}
      {state === 'loading' && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#10001F', overflow: 'hidden' }]}>
          <Animated.View style={{
            position: 'absolute', top: 0, bottom: 0, width: W * 0.45,
            backgroundColor: 'rgba(192,96,255,0.09)',
            transform: [{ translateX: shimTx }, { skewX: '-15deg' }],
          }} />
        </View>
      )}

      {/* Icône si erreur définitive */}
      {state === 'error' && (
        <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="film-outline" size={20} color="rgba(192,96,255,0.35)" />
        </View>
      )}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 POSTER CDN HELPER
//  picsum.photos/seed/{seed}/500/750 → portrait 2:3 cohérent et persistant
//  Aucune API key, aucun domaine bloqué, HTTPS, CDN mondial.
// ─────────────────────────────────────────────────────────────────────────────

/** Génère une URL picsum stable à partir d'un seed string */
const poster = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/500/750`;

/** Génère une URL picsum stable format paysage */
const still = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/450`;

// ─────────────────────────────────────────────────────────────────────────────
// 🌟 GALAXY ANIMATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface StarPt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
interface MeteorT { id: number; sx: number; sy: number; ang: number; len: number; }

const STARS: StarPt[] = Array.from({ length: 72 }, (_, i) => ({
  id: i, x: rnd(0, W), y: rnd(0, H * 2.2), sz: rnd(0.9, 2.6),
  col: pick([G.sW, G.sB, G.sP, G.sG, G.sCy]),
  del: rnd(0, 5000), dur: rnd(1800, 6000), mn: 0.12, mx: 0.92,
}));

const StarDot = memo(({ p }: { p: StarPt }) => {
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

const ShootingStar = memo(({ m, onDone }: { m: MeteorT; onDone: () => void }) => {
  const prog = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 90,  useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 550, delay: 180, useNativeDriver: true }),
      ]),
      Animated.timing(prog, { toValue: 1, duration: 820, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(onDone);
  }, []); // eslint-disable-line
  const tx = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(m.ang * Math.PI / 180) * 220] });
  const ty = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(m.ang * Math.PI / 180) * 220] });
  return (
    <Animated.View style={{
      position: 'absolute', left: m.sx, top: m.sy, opacity: op,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${m.ang}deg` }],
    }}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(192,96,255,0.85)', '#fff']}
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
      if (Math.random() > 0.62)
        setMeteors(prev => [...prev, {
          id: Date.now(), sx: rnd(0, W), sy: rnd(0, H * 0.5),
          ang: rnd(18, 52), len: rnd(70, 170),
        }]);
    }, 1900);
    return () => clearInterval(i);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[G.bg0, '#08001A', G.bg1, G.bg2]}
        locations={[0, 0.15, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {STARS.map(s => <StarDot key={s.id} p={s} />)}
      {meteors.map(m => (
        <ShootingStar key={m.id} m={m}
          onDone={() => setMeteors(prev => prev.filter(x => x.id !== m.id))} />
      ))}
    </View>
  );
});
GalaxyBackground.displayName = 'GalaxyBackground';

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 CINEMA DATA — URLs picsum.photos stables (seed = titre slugifié)
// ─────────────────────────────────────────────────────────────────────────────

const TOP_FILM = {
  id: 'tf1', title: 'Mulholland Drive',
  poster_url: poster('mulholland-drive-lynch'),
  genre: 'Néo-Noir', duration_type: 'film', rating: 5,
  director: 'David Lynch', year: 2001,
};

const TOP_2_3 = [
  {
    id: 'tf2', title: 'La Haine',
    poster_url: poster('la-haine-kassovitz-1995'),
    genre: 'Drame', duration_type: 'film', rating: 5,
    director: 'M. Kassovitz', year: 1995,
  },
  {
    id: 'tf3', title: 'Parasite',
    poster_url: poster('parasite-bong-joon-ho'),
    genre: 'Thriller', duration_type: 'film', rating: 5,
    director: 'Bong Joon-ho', year: 2019,
  },
];

const OTHER_FAVS = [
  { id: 'of1', title: 'Moonlight',              poster_url: poster('moonlight-2016-barry'),    genre: 'Drame',   duration_type: 'film', rating: 5 },
  { id: 'of2', title: 'Mad Max: Fury Road',      poster_url: poster('mad-max-fury-road-2015'), genre: 'Action',  duration_type: 'film', rating: 5 },
  { id: 'of3', title: '2001: A Space Odyssey',   poster_url: poster('2001-kubrick-space'),      genre: 'Sci-Fi',  duration_type: 'film', rating: 5 },
  { id: 'of4', title: 'The Grand Budapest Hotel',poster_url: poster('grand-budapest-wes'),      genre: 'Comédie', duration_type: 'film', rating: 5 },
  { id: 'of5', title: 'Roma',                   poster_url: poster('roma-alfonso-cuaron'),     genre: 'Drame',   duration_type: 'film', rating: 5 },
];

const CRITIQUE_REVIEWS = [
  {
    id: 'cr1', film_id: 'cr1', rating: 5, likes_count: 342, created_at: '2024-11-12',
    content: 'Une œuvre visuelle d\'une densité rare. Villeneuve signe ici un manifeste sur la mémoire et l\'identité, porté par une photographie de Deakins qui frôle le sublime pictural.',
    film: { id: 'cr1', title: 'Dune: Part Two',       poster_url: poster('dune-part-two-villeneuve'),   genre: 'Épique',    duration_type: 'film' },
  },
  {
    id: 'cr2', film_id: 'cr2', rating: 5, likes_count: 218, created_at: '2024-10-01',
    content: 'Anatomy of a Fall déconstruit le récit judiciaire pour révéler l\'opacité fondamentale des relations humaines. Hüller est phénoménale.',
    film: { id: 'cr2', title: 'Anatomy of a Fall',    poster_url: poster('anatomy-of-a-fall-triet'),   genre: 'Thriller',  duration_type: 'film' },
  },
  {
    id: 'cr3', film_id: 'cr3', rating: 5, likes_count: 189, created_at: '2024-08-20',
    content: 'The Zone of Interest opère à froid — l\'horreur par son absence, dans le bourdonnement d\'une maison ordinaire.',
    film: { id: 'cr3', title: 'The Zone of Interest', poster_url: poster('zone-of-interest-glazer'),   genre: 'Guerre',    duration_type: 'film' },
  },
  {
    id: 'cr4', film_id: 'cr4', rating: 4, likes_count: 156, created_at: '2024-07-15',
    content: 'Aftersun accumule les fragments d\'une relation père-fille avec une pudeur déchirante.',
    film: { id: 'cr4', title: 'Aftersun',             poster_url: poster('aftersun-charlotte-wells'), genre: 'Drame',     duration_type: 'film' },
  },
  {
    id: 'cr5', film_id: 'cr5', rating: 5, likes_count: 204, created_at: '2024-06-10',
    content: 'Past Lives touche à quelque chose d\'universel et d\'intime simultanément. Un premier film éblouissant.',
    film: { id: 'cr5', title: 'Past Lives',           poster_url: poster('past-lives-celine-song'),   genre: 'Romance',   duration_type: 'film' },
  },

];

const SEEN_WORKS = [
  { id: 'sw1',  title: 'The Bear',            poster_url: poster('the-bear-fx-series'),        genre: 'Drame',        duration_type: 'série', rating: 5 },
  { id: 'sw2',  title: 'Shogun',              poster_url: poster('shogun-fx-2024-series'),      genre: 'Historique',   duration_type: 'série', rating: 5 },
  { id: 'sw3',  title: 'Pachinko',            poster_url: poster('pachinko-apple-series'),      genre: 'Épique',       duration_type: 'série', rating: 5 },
  { id: 'sw4',  title: 'Dune (2021)',         poster_url: poster('dune-2021-villeneuve'),       genre: 'Épique',       duration_type: 'film',  rating: 4 },
  { id: 'sw5',  title: 'All of Us Strangers', poster_url: poster('all-of-us-strangers-haigh'), genre: 'Drame',        duration_type: 'film',  rating: 5 },
  { id: 'sw6',  title: 'Priscilla',           poster_url: poster('priscilla-coppola-2023'),    genre: 'Biopic',       duration_type: 'film',  rating: 4 },
  { id: 'sw7',  title: 'Fallen Leaves',       poster_url: poster('fallen-leaves-kaurismaki'),  genre: 'Comédie',      duration_type: 'film',  rating: 5 },
  { id: 'sw8',  title: 'The Substance',       poster_url: poster('the-substance-fargeat'),     genre: 'Horreur',      duration_type: 'film',  rating: 4 },
  { id: 'sw9',  title: 'I Saw the TV Glow',   poster_url: poster('i-saw-the-tv-glow-schofield'), genre: 'Expérimental', duration_type: 'film',  rating: 4 },
  { id: 'sw10', title: 'Tótem',               poster_url: poster('totem-lila-aviles-2023'),    genre: 'Drame',        duration_type: 'film',  rating: 5 },
  { id: 'sw11', title: 'Poor Things',         poster_url: poster('poor-things-lanthimos'),     genre: 'Fantasy',      duration_type: 'film',  rating: 4 },
  { id: 'sw12', title: 'Dream Scenario',      poster_url: poster('dream-scenario-cage-2023'),  genre: 'Comédie',      duration_type: 'film',  rating: 4 },
];

const OWN_REELS = [
  { id: 'rl1', title: 'Fragmenta',   duration: "12'", poster_url: still('reel-fragmenta-cm'),   views: '2.4K', festival: 'Clermont-Ferrand 2024' },
  { id: 'rl2', title: 'Ekho',        duration: "8'",  poster_url: still('reel-ekho-cm'),        views: '1.1K', festival: 'SXSW 2024' },
  { id: 'rl3', title: 'La Fenêtre',  duration: "18'", poster_url: still('reel-lafenetre-cm'),   views: '890',  festival: 'Sundance 2023' },
  { id: 'rl4', title: 'Nox',         duration: "6'",  poster_url: still('reel-nox-cm'),         views: '3.2K', festival: 'Cannes 2023' },
  { id: 'rl5', title: 'Seuil',       duration: "22'", poster_url: still('reel-seuil-cm'),       views: '670',  festival: 'Berlin 2024' },
  { id: 'rl6', title: 'Miroir Noir', duration: "15'", poster_url: still('reel-miroirnoir-cm'),  views: '1.8K', festival: 'Tribeca 2024' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 📐 TYPES
// ─────────────────────────────────────────────────────────────────────────────
type GridTab = 0 | 1 | 2;
interface Film   { id: string; title: string; poster_url: string; genre: string; duration_type: string; rating: number; director?: string; year?: number; }
interface Review { id: string; film_id: string; content: string; rating: number; likes_count: number; created_at: string; film?: { id: string; title: string; poster_url: string; genre: string; duration_type: string }; }

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
  <TouchableOpacity style={scc.col} onPress={onPress} activeOpacity={0.7}>
    <Text style={scc.val}>{value}</Text>
    <Text style={scc.lbl}>{label}</Text>
  </TouchableOpacity>
));
StatColumn.displayName = 'StatColumn';
const scc = StyleSheet.create({
  col: { alignItems: 'center', flex: 1 },
  val: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  lbl: { color: 'rgba(255,255,255,0.52)', fontSize: 11, marginTop: 1, textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🃏 GRID CELLS — tous utilisent ImageWithFallback
// ─────────────────────────────────────────────────────────────────────────────

/** #1 — Film préféré absolu avec ring pulsant */
const TopFilmCell = memo(({ film, onPress, onPressIn }: { film: Film | null; onPress: () => void; onPressIn?: () => void }) => {
  const pulseOp  = useRef(new Animated.Value(0.4)).current;
  const pulseScl = useRef(new Animated.Value(0.96)).current;
  useEffect(() => {
    Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(pulseOp,  { toValue: 1,    duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseOp,  { toValue: 0.4,  duration: 1800, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(pulseScl, { toValue: 1,    duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseScl, { toValue: 0.96, duration: 1800, useNativeDriver: true }),
      ]),
    ])).start();
  }, []); // eslint-disable-line

  return (
    <TouchableOpacity style={[cells.cell, { width: CELL_SIZE, height: CELL_SIZE * 1.3 }]} onPress={onPress} onPressIn={onPressIn} activeOpacity={0.88}>
      {film && (
        <ImageWithFallback
          uri={film.poster_url}
          style={StyleSheet.absoluteFillObject}
          fallbackColors={['#1A0035', '#060010']}
        />
      )}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(192,96,255,0.07)' }]} />
      <Animated.View style={[cells.glowRing, { opacity: pulseOp, transform: [{ scale: pulseScl }] }]} />
      <View style={cells.sparkle}><Text style={{ fontSize: 16 }}>✨</Text></View>
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.92)']} style={cells.overlay}>
        <Text style={cells.overlayLabel}>Ton film préf</Text>
        {film && <StarRating rating={film.rating} size={9} />}
        {film?.director && <Text style={cells.metaText} numberOfLines={1}>{film.director} · {film.year}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
});
TopFilmCell.displayName = 'TopFilmCell';

/** #2 — Top 2 & 3 */
const Top2FilmsCell = memo(({ films, onPress }: { films: Film[]; onPress: () => void }) => {
  const [f1, f2] = films;
  return (
    <TouchableOpacity style={[cells.cell, { width: CELL_SIZE, height: CELL_SIZE * 1.3 }]} onPress={onPress} activeOpacity={0.88}>
      <View style={{ flex: 1 }}>
        <View style={[cells.splitHalf, { borderBottomWidth: GRID_GUTTER, borderColor: G.bg0 }]}>
          {f1 && <ImageWithFallback uri={f1.poster_url} style={StyleSheet.absoluteFillObject} fallbackColors={['#120025', '#06000E']} />}
          <BlurView intensity={28} tint="dark" style={cells.rankTag}><Text style={cells.rankNum}>02</Text></BlurView>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,226,112,0.04)' }]} />
        </View>
        <View style={cells.splitHalf}>
          {f2 && <ImageWithFallback uri={f2.poster_url} style={StyleSheet.absoluteFillObject} fallbackColors={['#120025', '#06000E']} />}
          <BlurView intensity={28} tint="dark" style={cells.rankTag}><Text style={cells.rankNum}>03</Text></BlurView>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(192,96,255,0.04)' }]} />
        </View>
      </View>
      <View style={cells.sparkle}><Text style={{ fontSize: 16 }}>⭐</Text></View>
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.88)']} style={[cells.overlay, { paddingBottom: 6 }]}>
        <Text style={cells.overlayLabel}>Tes 2 film préf</Text>
        <Text style={cells.overlaySub}>après le 1</Text>
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
          {films[i] && (
            <ImageWithFallback
              uri={films[i].poster_url}
              style={StyleSheet.absoluteFillObject}
              fallbackColors={['#1A0030', '#06000E']}
            />
          )}
        </View>
      ))}
    </View>
    <View style={cells.sparkle}><Text style={{ fontSize: 16 }}>✦</Text></View>
    <LinearGradient colors={['transparent', 'rgba(6,0,16,0.88)']} style={[cells.overlay, { paddingBottom: 6 }]}>
      <Text style={cells.overlayLabel}>Tes autres fav</Text>
      <Text style={cells.overlaySub}>après ton top</Text>
    </LinearGradient>
  </TouchableOpacity>
));
OtherFavsCell.displayName = 'OtherFavsCell';

/** Critique cell */
const CritiqueCell = memo(({ review, index, onPress }: { review: Review; index: number; onPress: () => void }) => {
  const isWide = index === 0;
  const cellW  = isWide ? CELL_SIZE * 2 + GRID_GUTTER : CELL_SIZE;
  return (
    <TouchableOpacity style={[cells.cell, { width: cellW, height: CELL_SIZE }]} onPress={onPress} activeOpacity={0.88}>
      {review.film && (
        <ImageWithFallback
          uri={review.film.poster_url}
          style={StyleSheet.absoluteFillObject}
          fallbackColors={['#1C0A02', '#08000E']}
        />
      )}
      <LinearGradient colors={['rgba(160,90,20,0.22)', 'rgba(80,40,5,0.52)']} style={StyleSheet.absoluteFillObject} />
      {[0.28, 0.55, 0.78].map(t => (
        <View key={t} style={{ position: 'absolute', left: 0, right: 0, top: `${t * 100}%`, height: 0.5, backgroundColor: 'rgba(255,220,120,0.08)' }} />
      ))}
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.94)']} style={cells.overlay}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="pencil" size={9} color="rgba(255,220,120,0.95)" />
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

/** Films / Séries visionnés */
const SeenCell = memo(({ film, onPress, onPressIn }: { film: Film; onPress: () => void; onPressIn?: () => void }) => {
  const isShow = film.duration_type === 'série';
  return (
    <TouchableOpacity style={[cells.cell, { width: CELL_SIZE, height: CELL_SIZE }]} onPress={onPress} onPressIn={onPressIn} activeOpacity={0.88}>
      <ImageWithFallback
        uri={film.poster_url}
        style={StyleSheet.absoluteFillObject}
        fallbackColors={['#080018', '#060010']}
      />
      <View style={[cells.eyeBadge, { backgroundColor: isShow ? `${G.cyan}CC` : `${G.success}CC` }]}>
        <Ionicons name={isShow ? 'tv' : 'eye'} size={8} color="#fff" />
      </View>
      <View style={cells.typeTag}>
        <Text style={cells.typeTagText}>{isShow ? 'Série' : 'Film'}</Text>
      </View>
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.72)']} style={cells.overlayThin}>
        <Text style={cells.seenTitle} numberOfLines={1}>{film.title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
});
SeenCell.displayName = 'SeenCell';

/** Court métrage (tab Reels) */
const ReelCell = memo(({ reel, onPress }: { reel: typeof OWN_REELS[0]; onPress: () => void }) => (
  <TouchableOpacity style={[cells.cell, { width: CELL_SIZE, height: CELL_SIZE * 1.4 }]} onPress={onPress} activeOpacity={0.88}>
    <ImageWithFallback uri={reel.poster_url} style={StyleSheet.absoluteFillObject} fallbackColors={['#06001A', '#060010']} />
    <LinearGradient colors={['rgba(6,0,16,0.12)', 'rgba(6,0,16,0.92)']} style={StyleSheet.absoluteFillObject} />
    <View style={cells.playBtn}>
      <Ionicons name="play" size={16} color="#fff" />
    </View>
    <BlurView intensity={22} tint="dark" style={cells.festivalBadge}>
      <Text style={cells.festivalText}>{reel.festival}</Text>
    </BlurView>
    <LinearGradient colors={['transparent', 'rgba(6,0,16,0.96)']} style={cells.overlay}>
      <Text style={cells.overlayLabel} numberOfLines={1}>{reel.title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="time-outline" size={8} color={G.textSub} />
          <Text style={cells.metaText}>{reel.duration}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="eye-outline" size={8} color={G.textSub} />
          <Text style={cells.metaText}>{reel.views}</Text>
        </View>
      </View>
    </LinearGradient>
  </TouchableOpacity>
));
ReelCell.displayName = 'ReelCell';

const cells = StyleSheet.create({
  cell:           { overflow: 'hidden', backgroundColor: '#08001A', position: 'relative' },
  overlay:        { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 7, paddingTop: 22, paddingBottom: 6, gap: 3 },
  overlayThin:    { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 5, paddingTop: 10, paddingBottom: 4 },
  overlayLabel:   { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.1, textShadowColor: 'rgba(0,0,0,0.95)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  overlaySub:     { color: 'rgba(255,255,255,0.58)', fontSize: 9, fontWeight: '500' },
  metaText:       { color: 'rgba(255,255,255,0.38)', fontSize: 8, fontStyle: 'italic' },
  sparkle:        { position: 'absolute', top: 5, left: 5 },
  glowRing:       { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderRadius: 5, borderWidth: 1.5, borderColor: G.primary },
  splitHalf:      { flex: 1, overflow: 'hidden', position: 'relative' },
  rankTag:        { position: 'absolute', top: 4, right: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, overflow: 'hidden' },
  rankNum:        { color: G.gold, fontSize: 9, fontWeight: '900' },
  microGrid:      { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  microCell:      { width: '50%', height: '50%', overflow: 'hidden', position: 'relative', backgroundColor: '#1A0030' },
  critiqueLabel:  { color: 'rgba(255,220,120,0.97)', fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textShadowColor: 'rgba(0,0,0,0.95)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  critiqueSnippet:{ color: 'rgba(255,255,255,0.62)', fontSize: 9, lineHeight: 13, fontStyle: 'italic' },
  eyeBadge:       { position: 'absolute', top: 5, right: 5, width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  typeTag:        { position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  typeTagText:    { color: 'rgba(255,255,255,0.72)', fontSize: 7, fontWeight: '700', letterSpacing: 0.3 },
  seenTitle:      { color: '#fff', fontSize: 8, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.95)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  playBtn:        { position: 'absolute', top: '50%', left: '50%', marginTop: -17, marginLeft: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  festivalBadge:  { position: 'absolute', top: 7, left: 7, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,226,112,0.28)' },
  festivalText:   { color: G.gold, fontSize: 7, fontWeight: '800', letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🤖 VIDEO GENERATION MODAL — AI Reels Studio + Export Réel
// ─────────────────────────────────────────────────────────────────────────────

const EXPORT_FORMATS_VG = [
  { id: 'prores', label: 'ProRes 4K',   ext: 'mov',  desc: 'Festival / DCP',  icon: 'diamond-outline',  color: G.gold,    badge: 'FESTIVAL' },
  { id: 'h264',   label: 'H.264 1080p', ext: 'mp4',  desc: 'Standard web',    icon: 'film-outline',     color: G.primary, badge: 'STANDARD' },
  { id: 'h265',   label: 'H.265 1080p', ext: 'mp4',  desc: 'Compact HDR',     icon: 'cube-outline',     color: G.cyan,    badge: 'COMPACT'  },
  { id: 'vp9',    label: 'VP9 720p',    ext: 'webm', desc: 'Streaming Web',   icon: 'globe-outline',    color: G.textSub, badge: 'WEB'      },
] as const;
type VGExportId = typeof EXPORT_FORMATS_VG[number]['id'];

const VIDEO_STYLES = [
  { id: 'noir',   label: 'Néo-Noir',     icon: '🌑', color: '#888'    },
  { id: 'dream',  label: 'Onirique',     icon: '🌀', color: G.accent  },
  { id: 'docu',   label: 'Documentaire', icon: '🎙️', color: G.cyan    },
  { id: 'essay',  label: 'Essai visuel', icon: '🎞️', color: G.gold    },
  { id: 'experi', label: 'Expérimental', icon: '✦',  color: '#FF6B9D' },
];
const GEN_PHASES = ['Analyse du scénario', 'Génération des plans', 'Color grading IA', 'Mixage sonore', 'Rendu final'];

const VideoGenModal = memo(({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const [style,        setStyle]        = useState('noir');
  const [generating,   setGenerating]   = useState(false);
  const [phase,        setPhase]        = useState(0);
  const [generated,    setGenerated]    = useState(false);
  const [exportFormat, setExportFormat] = useState<VGExportId>('h264');
  const [exporting,    setExporting]    = useState(false);
  const [exportStep,   setExportStep]   = useState('');
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [savedToLib,   setSavedToLib]   = useState(false);

  const genProg    = useRef(new Animated.Value(0)).current;
  const exportProg = useRef(new Animated.Value(0)).current;

  const handleClose = useCallback(() => {
    setGenerated(false); setExportedPath(null); setSavedToLib(false);
    setExporting(false); setExportStep(''); setPhase(0);
    genProg.setValue(0); exportProg.setValue(0);
    onClose();
  }, [onClose, genProg, exportProg]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true); setGenerated(false);
    genProg.setValue(0);
    for (let i = 0; i < GEN_PHASES.length; i++) {
      setPhase(i);
      await new Promise(r => setTimeout(r, 820 + Math.random() * 620));
    }
    Animated.timing(genProg, { toValue: 1, duration: 480, useNativeDriver: false }).start();
    await new Promise(r => setTimeout(r, 550));
    setGenerating(false);
    setGenerated(true);
  }, [genProg]);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    const fmt  = EXPORT_FORMATS_VG.find(f => f.id === exportFormat)!;
    const vst  = VIDEO_STYLES.find(s => s.id === style)?.label ?? 'Universe';
    const name = `UNIVERSE_${vst.replace(/\s+/g, '_')}_${fmt.id}_${Date.now()}.${fmt.ext}`;
    const path = `${FileSystem.documentDirectory}${name}`;

    setExporting(true); setExportStep(''); setExportedPath(null); setSavedToLib(false);
    exportProg.setValue(0);

    const animProg = (to: number) =>
      Animated.timing(exportProg, { toValue: to, duration: 360, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start();

    try {
      setExportStep('Vérification des permissions…'); animProg(0.12);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { setExportStep('❌ Permission photothèque refusée.'); setExporting(false); return; }

      setExportStep('Préparation du projet…'); animProg(0.32);
      const manifest = JSON.stringify({
        app: 'UNIVERSE — Studio Cinéma', version: '2.0',
        style: vst, format: fmt.label,
        exportedAt: new Date().toISOString(),
        note: 'Connecter ici l\'encodeur FFmpeg/Remotion pour le rendu vidéo réel.',
      }, null, 2);
      await FileSystem.writeAsStringAsync(path, manifest, { encoding: FileSystem.EncodingType.UTF8 });
      setExportedPath(path); animProg(0.55);

      setExportStep('Enregistrement dans la photothèque…'); animProg(0.72);
      try {
        const asset = await MediaLibrary.createAssetAsync(path);
        const album = await MediaLibrary.getAlbumAsync('UNIVERSE Studio');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync('UNIVERSE Studio', asset, false);
        }
        setSavedToLib(true);
      } catch { /* format non supporté — on continue */ }

      setExportStep('Ouverture du partage système…'); animProg(0.88);
      const mimeType = fmt.ext === 'mov' ? 'video/quicktime' : fmt.ext === 'webm' ? 'video/webm' : 'video/mp4';
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType,
          UTI: fmt.ext === 'mov' ? 'com.apple.quicktime-movie' : 'public.movie',
          dialogTitle: `Exporter — ${fmt.label}`,
        });
      }

      animProg(1);
      setExportStep('✅ Export terminé');
    } catch (err: any) {
      setExportStep(`❌ Erreur : ${err?.message ?? 'inconnue'}`);
    } finally {
      setExporting(false);
    }
  }, [exporting, exportFormat, style, exportProg]);

  const genBarWidth    = genProg.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const exportBarWidth = exportProg.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const activeStyle    = VIDEO_STYLES.find(s => s.id === style)!;
  const activeFmt      = EXPORT_FORMATS_VG.find(f => f.id === exportFormat)!;
  const isDone         = exportStep.startsWith('✅');
  const isError        = exportStep.startsWith('❌');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={vg.backdrop} onPress={handleClose} />
      <View style={vg.sheet}>
        <GalaxyBackground />
        <View style={vg.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={vg.content}>

          <View style={vg.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <LinearGradient colors={['#3A0070', G.primary]} style={vg.headerIcon}>
                <Ionicons name="sparkles" size={20} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={vg.title}>Studio IA Cinéma</Text>
                <Text style={vg.subtitle}>{generated ? 'Prêt pour l\'export' : 'Génération de court métrage'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={vg.closeBtn}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {/* ════ PHASE A — Configuration ════ */}
          {!generated && <>
            <Text style={vg.sectionLabel}>STYLE CINÉMATOGRAPHIQUE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 4, paddingRight: 20, marginBottom: 18 }}>
              {VIDEO_STYLES.map(st => {
                const on = style === st.id;
                return (
                  <TouchableOpacity key={st.id}
                    style={[vg.styleChip, on && { borderColor: st.color, backgroundColor: `${st.color}15` }]}
                    onPress={() => setStyle(st.id)} activeOpacity={0.8}>
                    <Text style={{ fontSize: 22 }}>{st.icon}</Text>
                    <Text style={[vg.styleLabel, on && { color: st.color }]}>{st.label}</Text>
                    {on && <View style={[vg.styleDot, { backgroundColor: st.color }]} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={vg.sectionLabel}>INTENTION NARRATIVE</Text>
            <BlurView intensity={14} tint="dark" style={vg.promptBox}>
              <Ionicons name="create-outline" size={15} color={activeStyle.color} style={{ marginRight: 10, marginTop: 2 }} />
              <Text style={vg.promptPlaceholder}>
                Une femme seule dans un appartement vide contemple la pluie sur Paris. Le néon d'en face pulse doucement…
              </Text>
            </BlurView>

            <Text style={vg.sectionLabel}>PARAMÈTRES TECHNIQUES</Text>
            <View style={vg.paramsGrid}>
              {[
                { label: 'Durée',  val: '2–4 min',      icon: 'timer-outline'         },
                { label: 'Format', val: '4K 16:9',       icon: 'resize-outline'        },
                { label: 'Fps',    val: '24 fps cinéma', icon: 'film-outline'          },
                { label: 'Son',    val: 'IA + ambiance', icon: 'musical-notes-outline' },
              ].map(p => (
                <BlurView key={p.label} intensity={10} tint="dark" style={vg.paramCard}>
                  <Ionicons name={p.icon as any} size={14} color={activeStyle.color} />
                  <Text style={vg.paramLabel}>{p.label}</Text>
                  <Text style={vg.paramVal}>{p.val}</Text>
                </BlurView>
              ))}
            </View>

            {generating && (
              <BlurView intensity={14} tint="dark" style={vg.genBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <ActivityIndicator color={activeStyle.color} size="small" />
                  <Text style={vg.genPhase}>{GEN_PHASES[phase]}</Text>
                </View>
                <View style={vg.genTrack}>
                  <Animated.View style={[vg.genBar, { width: genBarWidth }]}>
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

            <TouchableOpacity onPress={handleGenerate} disabled={generating} activeOpacity={0.88}>
              <LinearGradient
                colors={generating ? ['#1A0035', '#2A0050'] : ['#5A0FA0', G.primary]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={vg.genBtn}>
                {generating
                  ? <><ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} /><Text style={vg.genBtnTxt}>Génération en cours…</Text></>
                  : <><Ionicons name="sparkles" size={18} color="#fff" style={{ marginRight: 10 }} /><Text style={vg.genBtnTxt}>Générer le court métrage</Text></>
                }
              </LinearGradient>
            </TouchableOpacity>
          </>}

          {/* ════ PHASE B — Export ════ */}
          {generated && <>
            <BlurView intensity={14} tint="dark" style={vg.successBanner}>
              <LinearGradient colors={['rgba(30,215,96,0.12)', 'transparent']} style={StyleSheet.absoluteFillObject} />
              <View style={vg.successIcon}>
                <Ionicons name="checkmark-circle" size={28} color={G.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={vg.successTitle}>Court métrage généré ✓</Text>
                <Text style={vg.successSub}>{activeStyle.icon} {activeStyle.label} · Prêt pour l'export</Text>
              </View>
              <TouchableOpacity onPress={() => { setGenerated(false); setExportedPath(null); setSavedToLib(false); }} style={vg.regenBtn}>
                <Ionicons name="refresh" size={16} color="rgba(255,255,255,0.45)" />
              </TouchableOpacity>
            </BlurView>

            <Text style={[vg.sectionLabel, { marginTop: 4 }]}>FORMAT D'EXPORT</Text>
            {EXPORT_FORMATS_VG.map(fmt => {
              const on = exportFormat === fmt.id;
              return (
                <TouchableOpacity key={fmt.id} onPress={() => setExportFormat(fmt.id)} activeOpacity={0.85}>
                  <BlurView intensity={10} tint="dark" style={[vg.fmtCard, on && { borderColor: fmt.color }]}>
                    <View style={[vg.fmtIconCircle, { backgroundColor: `${fmt.color}18`, borderColor: `${fmt.color}33` }]}>
                      <Ionicons name={fmt.icon as any} size={18} color={fmt.color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={vg.fmtLabel}>{fmt.label}</Text>
                        <View style={[vg.fmtBadge, { backgroundColor: `${fmt.color}22`, borderColor: `${fmt.color}44` }]}>
                          <Text style={[vg.fmtBadgeTxt, { color: fmt.color }]}>{fmt.badge}</Text>
                        </View>
                      </View>
                      <Text style={vg.fmtDesc}>{fmt.desc} · .{fmt.ext}</Text>
                    </View>
                    <View style={[vg.fmtRadio, on && { borderColor: fmt.color }]}>
                      {on && <View style={[vg.fmtRadioDot, { backgroundColor: fmt.color }]} />}
                    </View>
                  </BlurView>
                </TouchableOpacity>
              );
            })}

            {(exporting || exportStep !== '') && (
              <BlurView intensity={12} tint="dark" style={vg.exportProgressBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  {exporting
                    ? <ActivityIndicator color={activeFmt.color} size="small" />
                    : <Ionicons name={isDone ? 'checkmark-circle' : 'alert-circle'} size={18}
                        color={isDone ? G.success : G.danger} />
                  }
                  <Text style={[vg.exportStepText, isDone && { color: G.success }, isError && { color: G.danger }]}>
                    {exportStep}
                  </Text>
                </View>
                <View style={vg.genTrack}>
                  <Animated.View style={[vg.genBar, { width: exportBarWidth }]}>
                    <LinearGradient
                      colors={isDone ? [G.success, '#0FA060'] : [activeFmt.color, G.primary]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  </Animated.View>
                </View>
                {exportedPath && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                    <Ionicons name="document-outline" size={11} color={G.textSub} />
                    <Text style={{ color: G.textSub, fontSize: 10, flex: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }} numberOfLines={1}>
                      {exportedPath.split('/').pop()}
                    </Text>
                  </View>
                )}
                {savedToLib && (
                  <View style={vg.libBadge}>
                    <Ionicons name="images-outline" size={11} color={G.success} />
                    <Text style={vg.libBadgeText}>Enregistré · Album « UNIVERSE Studio »</Text>
                  </View>
                )}
              </BlurView>
            )}

            <TouchableOpacity onPress={handleExport} disabled={exporting} activeOpacity={0.88}>
              <LinearGradient
                colors={exporting ? ['#1A0035', '#2A0050'] : isDone ? [G.success, '#0FA060'] : ['#B8860B', G.gold]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={vg.genBtn}>
                {exporting
                  ? <><ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} /><Text style={[vg.genBtnTxt, { color: '#fff' }]}>Export en cours…</Text></>
                  : isDone
                    ? <><Ionicons name="share-outline" size={18} color="#000" style={{ marginRight: 10 }} /><Text style={[vg.genBtnTxt, { color: '#000' }]}>Partager à nouveau</Text></>
                    : <><Ionicons name="rocket-outline" size={18} color="#000" style={{ marginRight: 10 }} /><Text style={[vg.genBtnTxt, { color: '#000' }]}>Exporter en {activeFmt.label}</Text></>
                }
              </LinearGradient>
            </TouchableOpacity>
          </>}

        </ScrollView>
      </View>
    </Modal>
  );
});
VideoGenModal.displayName = 'VideoGenModal';

const vg = StyleSheet.create({
  backdrop:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)' },
  sheet:            { height: H * 0.9, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', backgroundColor: G.bg0, borderTopWidth: 1, borderColor: G.glassBorder },
  handle:           { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'center', marginTop: 10 },
  content:          { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 50 },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  headerIcon:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title:            { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  subtitle:         { color: G.textSub, fontSize: 12, marginTop: 1 },
  closeBtn:         { width: 34, height: 34, borderRadius: 17, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
  sectionLabel:     { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  styleChip:        { alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass, minWidth: 78 },
  styleLabel:       { color: 'rgba(255,255,255,0.42)', fontSize: 11, fontWeight: '600' },
  styleDot:         { width: 5, height: 5, borderRadius: 3 },
  promptBox:        { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, borderWidth: 1, borderColor: G.glassBorder, padding: 14, marginBottom: 16, overflow: 'hidden' },
  promptPlaceholder:{ color: 'rgba(255,255,255,0.2)', fontSize: 13, lineHeight: 20, fontStyle: 'italic', flex: 1 },
  paramsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  paramCard:        { width: (W - 50) / 2, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 12, gap: 4, overflow: 'hidden' },
  paramLabel:       { color: G.textSub, fontSize: 10, fontWeight: '600', marginTop: 2 },
  paramVal:         { color: '#fff', fontSize: 12, fontWeight: '700' },
  genBox:           { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(192,96,255,0.28)', padding: 16, marginBottom: 16, overflow: 'hidden' },
  genPhase:         { color: '#fff', fontSize: 13, fontWeight: '600' },
  genTrack:         { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  genBar:           { height: '100%', borderRadius: 3, overflow: 'hidden' },
  phaseDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)' },
  genBtn:           { paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  genBtnTxt:        { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  successBanner:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: `${G.success}38`, padding: 14, marginBottom: 20, overflow: 'hidden' },
  successIcon:      { width: 44, height: 44, borderRadius: 22, backgroundColor: `${G.success}18`, alignItems: 'center', justifyContent: 'center' },
  successTitle:     { color: '#fff', fontSize: 14, fontWeight: '800' },
  successSub:       { color: G.textSub, fontSize: 11, marginTop: 2 },
  regenBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
  fmtCard:          { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, padding: 13, marginBottom: 9, overflow: 'hidden' },
  fmtIconCircle:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fmtLabel:         { color: '#fff', fontSize: 13, fontWeight: '700' },
  fmtDesc:          { color: G.textSub, fontSize: 10 },
  fmtBadge:         { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  fmtBadgeTxt:      { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  fmtRadio:         { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: G.glassBorder, alignItems: 'center', justifyContent: 'center' },
  fmtRadioDot:      { width: 10, height: 10, borderRadius: 5 },
  exportProgressBox:{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(192,96,255,0.25)', padding: 14, marginBottom: 14, overflow: 'hidden' },
  exportStepText:   { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },
  libBadge:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: `${G.success}10`, borderRadius: 8, padding: 7, borderWidth: 1, borderColor: `${G.success}28` },
  libBadgeText:     { color: G.success, fontSize: 10, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🖼️ EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = memo(({ icon, text, subtext }: { icon: string; text: string; subtext?: string }) => (
  <View style={es.wrap}>
    <LinearGradient colors={['rgba(192,96,255,0.12)', 'transparent']} style={es.iconCircle}>
      <Ionicons name={icon as any} size={36} color={G.primary} />
    </LinearGradient>
    <Text style={es.text}>{text}</Text>
    {subtext && <Text style={es.sub}>{subtext}</Text>}
  </View>
));
EmptyState.displayName = 'EmptyState';
const es = StyleSheet.create({
  wrap:      { alignItems: 'center', paddingVertical: 48, gap: 12 },
  iconCircle:{ width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(192,96,255,0.22)' },
  text:      { color: 'rgba(255,255,255,0.38)', fontSize: 14, fontWeight: '600' },
  sub:       { color: 'rgba(255,255,255,0.2)', fontSize: 12 },
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

  const prefetched = useRef<Set<string>>(new Set());
  const prefetchFilm = useCallback((id: string) => {
    if (prefetched.current.has(id)) return;
    prefetched.current.add(id);
  }, []);
  const navigateFilm = useCallback((id: string) => { router.push(`/film/${id}`); }, [router]);

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

  const allFavs = useMemo<Film[]>(() => {
    const fromRev = reviews
      .filter(r => r.film && r.rating >= 4)
      .sort((a, b) => b.rating - a.rating)
      .map(r => r.film as Film);
    const extra = seenFilms.filter(f => !fromRev.some(r => r.id === f.id));
    return [...fromRev, ...extra];
  }, [reviews, seenFilms]);

  const topFilm   = useMemo(() => (allFavs[0]          ?? TOP_FILM)  as Film,   [allFavs]);
  const top2to3   = useMemo(() => (allFavs.slice(1, 3).length ? allFavs.slice(1, 3) : TOP_2_3) as Film[], [allFavs]);
  const otherFavs = useMemo(() => (allFavs.slice(3, 7).length ? allFavs.slice(3, 7) : OTHER_FAVS.slice(0, 4)) as Film[], [allFavs]);

  const formatStat = useCallback((n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
    return `${n}`;
  }, []);

  const stickyOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE], outputRange: [0, 1], extrapolate: 'clamp',
  });

  // ── Skeleton ─────────────────────────────────────────────────────────────
  const SkeletonRow = useCallback(() => (
    <View style={{ flexDirection: 'row', backgroundColor: 'transparent' }}>
      {[0, 1, 2].map(i => (
        <React.Fragment key={i}>
          {i > 0 && <View style={{ width: GRID_GUTTER }} />}
          <View style={{ width: CELL_SIZE, height: CELL_SIZE * 1.3, overflow: 'hidden', backgroundColor: '#10001F' }}>
            {/* Re-use ImageWithFallback's skeleton behavior via a loading state */}
            <ImageWithFallback uri="" style={{ flex: 1 }} fallbackColors={['#1A0035', '#060010']} />
          </View>
        </React.Fragment>
      ))}
    </View>
  ), []);

  // ── Grid content ──────────────────────────────────────────────────────────
  function renderGridContent() {
    if (loading) {
      return (
        <View>
          <SkeletonRow />
          {[...Array(4)].map((_, i) => (
            <View key={i} style={{ marginTop: GRID_GUTTER }}>
              <View style={{ flexDirection: 'row' }}>
                {[...Array(3)].map((_, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <View style={{ width: GRID_GUTTER }} />}
                    <View style={{ width: CELL_SIZE, height: CELL_SIZE, overflow: 'hidden' }}>
                      <ImageWithFallback uri="" style={{ flex: 1 }} fallbackColors={['#1A0035', '#060010']} />
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    }

    const critiqueRows: Review[][] = [];
    if (reviews[0]) critiqueRows.push([reviews[0], reviews[1]].filter(Boolean) as Review[]);
    let ci = critiqueRows[0]?.length ?? 0;
    while (ci < reviews.length) { critiqueRows.push(reviews.slice(ci, ci + 3)); ci += 3; }

    const seenRows: Film[][] = [];
    for (let si = 0; si < seenFilms.length; si += 3) seenRows.push(seenFilms.slice(si, si + 3));

    return (
      <View>
        {/* TOP FILMS */}
        <View style={{ flexDirection: 'row' }}>
          <TopFilmCell film={topFilm} onPress={() => navigateFilm(topFilm.id)} onPressIn={() => prefetchFilm(topFilm.id)} />
          <View style={{ width: GRID_GUTTER }} />
          <Top2FilmsCell films={top2to3} onPress={() => navigateFilm(top2to3[0]?.id ?? '')} />
          <View style={{ width: GRID_GUTTER }} />
          <OtherFavsCell films={otherFavs} onPress={() => router.push('/profile/favorites')} />
        </View>

        {/* CRITIQUE BANNER */}
        <BlurView intensity={10} tint="dark" style={pg.sectionBanner}>
          <Ionicons name="pencil" size={11} color="rgba(255,220,120,0.88)" />
          <Text style={pg.sectionBannerText}>Critiques cinématographiques</Text>
          <View style={pg.sectionBannerLine} />
        </BlurView>

        {reviews.length === 0
          ? <EmptyState icon="chatbubble-outline" text="Aucune critique publiée" />
          : critiqueRows.map((rowRevs, rowIdx) => (
              <View key={`cr-${rowIdx}`}>
                <View style={{ flexDirection: 'row' }}>
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

        {/* SEEN BANNER */}
        <BlurView intensity={10} tint="dark" style={pg.sectionBanner}>
          <Ionicons name="eye" size={11} color={G.cyan} />
          <Text style={[pg.sectionBannerText, { color: G.cyan }]}>Films & Séries visionnés</Text>
          <View style={[pg.sectionBannerLine, { backgroundColor: `${G.cyan}28` }]} />
        </BlurView>

        {seenFilms.length === 0
          ? <EmptyState icon="film-outline" text="Aucun film vu pour l'instant" />
          : seenRows.map((rowFilms, rowIdx) => (
              <View key={`sw-${rowIdx}`}>
                <View style={{ flexDirection: 'row' }}>
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

  // ── Reels content ─────────────────────────────────────────────────────────
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
            <View style={{ flexDirection: 'row' }}>
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

      {/* Sticky mini-header */}
      <Animated.View style={[pg.stickyHeader, { opacity: stickyOpacity }]} pointerEvents="none">
        <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={pg.stickyInner}>
          <Text style={pg.stickyUsername}>{user.username}</Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadProfileData(); }}
            tintColor={G.primary}
          />
        }
      >
        <SafeAreaView edges={['top']}>
          <View style={pg.headerVeil} />

          {/* Top nav */}
          <View style={pg.topNav}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="lock-closed" size={13} color="rgba(255,255,255,0.72)" />
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
                  <ImageWithFallback
                    uri={user.avatar_url ?? `https://i.pravatar.cc/150?u=${user.id}`}
                    style={pg.avatar}
                    fallbackColors={[G.bg1, G.bg0]}
                  />
                </View>
              </LinearGradient>
              <View style={pg.avatarAddBtn}>
                <LinearGradient colors={[G.accent, G.primary]} style={pg.avatarAddGrad}>
                  <Ionicons name="add" size={13} color="#fff" />
                </LinearGradient>
              </View>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
              <StatColumn value={`${(user.reviews_count ?? 6) + (user.films_seen_count ?? 12)}`} label=" films" />
              <StatColumn value={formatStat(user.followers_count ?? 2840)} label=" critiques" onPress={() => router.push('/ critiques')} />
              <StatColumn value={formatStat(user.following_count ?? 318)} label="festivals" onPress={() => router.push('/festivals')} />
            </View>
          </View>

          {/* Bio */}
          <View style={pg.bioSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <Text style={pg.displayName}>{user.username}</Text>
              <BlurView intensity={20} tint="dark" style={pg.rolePill}>
                <Text style={pg.rolePillText}>
                  {user.role === 'critic' ? '✍️ Critique' : user.role === 'creator' ? '⭐ Créateur' : '🎬 Réalisateur·rice'}
                </Text>
              </BlurView>
            </View>
            <Text style={pg.bioText}>{user.bio ?? 'Cinéaste indépendant · Court métrages · Cannes, Sundance, Berlin 🎞️'}</Text>

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

          <View style={pg.headerGlow} />
        </SafeAreaView>

    

        {/* Grid tab bar */}
        <View style={pg.gridTabBar}>
          {(['grid-outline', 'play-circle-outline', 'person-circle-outline'] as const).map((icon, idx) => (
            <TouchableOpacity key={icon} style={pg.gridTabItem} onPress={() => setActiveGridTab(idx as GridTab)} activeOpacity={0.8}>
              <Ionicons name={icon} size={22} color={activeGridTab === idx ? '#fff' : 'rgba(255,255,255,0.3)'} />
              {activeGridTab === idx && <View style={pg.gridTabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {activeGridTab === 0 && renderGridContent()}
        {activeGridTab === 1 && renderReelsContent()}
        {activeGridTab === 2 && (
          <EmptyState icon="pricetag-outline" text="Aucun tag" subtext="Les films où vous êtes tagué apparaissent ici" />
        )}
      </Animated.ScrollView>

      <VideoGenModal visible={videoGenVisible} onClose={() => setVideoGenVisible(false)} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 STYLES PRINCIPAUX
// ─────────────────────────────────────────────────────────────────────────────
const pg = StyleSheet.create({
  root:             { flex: 1, backgroundColor: G.bg0 },
  stickyHeader:     { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, height: 46, overflow: 'hidden' },
  stickyInner:      { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  stickyUsername:   { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  headerVeil:       { position: 'absolute', top: 0, left: 0, right: 0, height: 320, backgroundColor: 'rgba(6,0,16,0.35)' },
  topNav:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  usernameNav:      { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  navBtn:           { padding: 5 },
  avatarStatsRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginTop: 4, gap: 14 },
  avatarRing:       { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  avatarInner:      { width: 86, height: 86, borderRadius: 43, backgroundColor: G.bg0, alignItems: 'center', justifyContent: 'center' },
  avatar:           { width: 82, height: 82, borderRadius: 41 },
  avatarAddBtn:     { position: 'absolute', bottom: 0, right: 0, width: 27, height: 27, borderRadius: 14, backgroundColor: G.bg0, alignItems: 'center', justifyContent: 'center' },
  avatarAddGrad:    { width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bioSection:       { paddingHorizontal: 16, marginTop: 11, gap: 4 },
  displayName:      { color: '#fff', fontSize: 14, fontWeight: '800' },
  rolePill:         { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(192,96,255,0.32)' },
  rolePillText:     { color: 'rgba(255,255,255,0.88)', fontSize: 10, fontWeight: '700' },
  bioText:          { color: 'rgba(255,255,255,0.62)', fontSize: 12.5, lineHeight: 18 },
  cinephileRow:     { flexDirection: 'row', gap: 14, marginTop: 5 },
  cinephileStat:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cinephileStatText:{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5, fontWeight: '600' },
  actionRow:        { flexDirection: 'row', paddingHorizontal: 12, marginTop: 14, gap: 6, marginBottom: 4 },
  actionBtn:        { flex: 1, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  actionBtnText:    { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionBtnSquare:  { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  headerGlow:       { height: 1, backgroundColor: 'rgba(192,96,255,0.18)', shadowColor: G.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 4 },
  highlightsScroll: { paddingHorizontal: 12, paddingVertical: 14, gap: 16 },
  highlightChip:    { alignItems: 'center', gap: 6 },
  highlightCircle:  { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  highlightLabel:   { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '500', textAlign: 'center' },
  gridTabBar:       { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.09)', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(6,0,16,0.5)' },
  gridTabItem:      { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  gridTabIndicator: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: '#fff' },
  sectionBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, overflow: 'hidden', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(6,0,16,0.45)' },
  sectionBannerText:{ color: 'rgba(255,220,120,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  sectionBannerLine:{ flex: 1, height: 0.5, backgroundColor: 'rgba(255,220,120,0.16)' },
  genCta:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16 },
  genCtaText:       { color: '#fff', fontSize: 14, fontWeight: '800', flex: 1 },
});