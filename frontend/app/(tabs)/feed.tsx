// ═══════════════════════════════════════════════════════════════════
//  feed.tsx — UNIVERSE / Accueil
//  ─────────────────────────────────────────────────────────────────
//  Pixel-perfect reproduction du mockup.
//  ✦ Galaxy Animation Engine (intégral)
//  ✦ Héros rotatif toutes les 8s
//  ✦ "Lecture" → carrousel interactif auto-scroll 5s
//  ✦ "Ma liste" → /profile
//  ✦ Catalogue cinéma indé style Netflix (6 sections)
//  ✦ GalaxyTabBar identique index.tsx
// ═══════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, Image,
  ScrollView, FlatList, TouchableOpacity, Platform, Easing,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { BlurView }        from 'expo-blur';
import { Ionicons }        from '@expo/vector-icons';
import { StatusBar }       from 'expo-status-bar';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useRouter }       from 'expo-router';

const { width: W, height: H } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════
//  PALETTE GALAXY (identique à tout l'app)
// ═══════════════════════════════════════════════════════════════════
const G = {
  bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
  sW: '#F3EDFF', sB: '#B2CCFF', sG: '#FFE270', sP: '#CF98FF', sCy: '#86EEFF',
  glass:       'rgba(255,255,255,0.07)',
  glassBorder: 'rgba(255,255,255,0.12)',
  primary:     '#9240D6',
  primL:       '#C060FF',
  t1:          '#F0E8FF',
  t2:          'rgba(240,232,255,0.65)',
  t3:          'rgba(240,232,255,0.38)',
  pinkBadge:   '#E91E63',
  purpleBadge: '#6A1B9A',
  goldBadge:   '#F59E0B',
};

// ═══════════════════════════════════════════════════════════════════
//  CATALOGUE CINÉMA INDÉPENDANT
// ═══════════════════════════════════════════════════════════════════
interface Work {
  id: string; title: string; genre: string; type: string; year: number;
  adjective: string; image: string; duration: string; director: string;
  badge?: string; badgeColor?: string; synopsis: string; rating: number;
}

const CATALOG: Work[] = [
  // ── Héros / Featured ────────────────────────────────────────────
  {
    id: '1', title: 'PUFFERS', genre: 'Horreur', type: 'Série', year: 2024,
    adjective: 'Glaçant', duration: '8 épisodes',
    image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900&q=85',
    director: 'Sophie Martin', badge: 'ORIGINAL', badgeColor: G.purpleBadge,
    synopsis: 'Dans une ville côtière isolée, des adolescents découvrent une créature venue des abysses.',
    rating: 4.5,
  },
  {
    id: '2', title: 'LA MARIÉE CAPTIVE', genre: 'Drame', type: 'Film', year: 2024,
    adjective: 'Captivant', duration: '1h52',
    image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=900&q=85',
    director: 'Isabelle Morin', badge: 'ORIGINAL', badgeColor: G.purpleBadge,
    synopsis: 'Une femme prisonnière d\'un mariage arrangé trouve une voie vers la liberté.',
    rating: 4.2,
  },
  {
    id: '3', title: 'NEON ABYSS', genre: 'Sci-Fi', type: 'Série', year: 2023,
    adjective: 'Visionnaire', duration: '6 épisodes',
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=900&q=85',
    director: 'Karim Belhadj', badge: 'TENDANCE', badgeColor: G.pinkBadge,
    synopsis: 'Dans Neo-Paris 2087, une hackeuse découvre le secret derrière la réalité augmentée.',
    rating: 4.7,
  },
  // ── Tendances ────────────────────────────────────────────────────
  {
    id: '4', title: 'INTERDIT', genre: 'Romance', type: 'Film', year: 2023,
    adjective: 'Provocateur', duration: '1h35',
    image: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=600&q=80',
    director: 'Marc Dubois', badge: 'Interdit', badgeColor: G.pinkBadge,
    synopsis: 'Deux êtres que tout oppose se retrouvent liés par un secret dangereux.',
    rating: 3.9,
  },
  {
    id: '5', title: 'HORIZON BRISÉ', genre: 'Thriller', type: 'Film', year: 2024,
    adjective: 'Haletant', duration: '2h04',
    image: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=600&q=80',
    director: 'Emma Dupont', badge: 'ORIGINAL', badgeColor: G.purpleBadge,
    synopsis: 'Un détective enquête sur des meurtres en série liés à des œuvres d\'art maudites.',
    rating: 4.3,
  },
  {
    id: '6', title: 'VELOURS ROUGE', genre: 'Romance', type: 'Série', year: 2024,
    adjective: 'Sensuel', duration: '5 épisodes',
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80',
    director: 'Léa Fontaine', badge: 'TENDANCE', badgeColor: G.pinkBadge,
    synopsis: 'Une danseuse de l\'opéra et un compositeur maudit vivent une passion interdite.',
    rating: 4.0,
  },
  // ── Nouveautés ────────────────────────────────────────────────────
  {
    id: '7', title: 'WASTELAND', genre: 'Dystopie', type: 'Film', year: 2022,
    adjective: 'Brut', duration: '2h00',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&q=80',
    director: 'Alex Perrin', badge: 'FESTIVAL', badgeColor: G.goldBadge,
    synopsis: 'Dans un monde après l\'effondrement, une mère cherche son enfant disparu.',
    rating: 4.1,
  },
  {
    id: '8', title: 'SABLES MOUVANTS', genre: 'Thriller', type: 'Série', year: 2024,
    adjective: 'Oppressant', duration: '4 épisodes',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80',
    director: 'Nadia Benmoussa', badge: 'ORIGINAL', badgeColor: G.purpleBadge,
    synopsis: 'Des archéologues découvrent une tombe qui ne devait jamais être ouverte.',
    rating: 4.4,
  },
  {
    id: '9', title: 'MIROIRS BRISÉS', genre: 'Drame', type: 'Film', year: 2024,
    adjective: 'Bouleversant', duration: '1h48',
    image: 'https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?w=600&q=80',
    director: 'Thomas Girard', badge: 'CANNES', badgeColor: G.goldBadge,
    synopsis: 'Un pianiste perd la mémoire et doit reconstituer sa propre vie fragment par fragment.',
    rating: 4.6,
  },
  // ── Continuez à regarder ─────────────────────────────────────────
  {
    id: '10', title: 'FRACTURES', genre: 'Drame', type: 'Série', year: 2023,
    adjective: 'Douloureux', duration: '7 épisodes',
    image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=600&q=80',
    director: 'Lucas Moreau', badge: 'ORIGINAL', badgeColor: G.purpleBadge,
    synopsis: 'Une famille recomposée confrontée aux secrets enfouis du passé.',
    rating: 4.2, 
  },
  {
    id: '11', title: 'LUEURS D\'ESPOIR', genre: 'Drame', type: 'Film', year: 2023,
    adjective: 'Lumineux', duration: '1h41',
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&q=80',
    director: 'Claire Bonnard', badge: 'FESTIVAL', badgeColor: G.goldBadge,
    synopsis: 'Dans un quartier défavorisé, une institutrice transforme des vies par l\'art.',
    rating: 4.5,
  },
  {
    id: '12', title: 'ÉCHOS DU PASSÉ', genre: 'Thriller', type: 'Série', year: 2023,
    adjective: 'Envoûtant', duration: '6 épisodes',
    image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80',
    director: 'Antoine Leroi', badge: 'TENDANCE', badgeColor: G.pinkBadge,
    synopsis: 'Une journaliste reçoit des messages d\'une personne décédée il y a dix ans.',
    rating: 4.3,
  },
  // ── Sélection Cannes ─────────────────────────────────────────────
  {
    id: '13', title: 'LES INVISIBLES', genre: 'Drame Social', type: 'Film', year: 2024,
    adjective: 'Humaniste', duration: '1h58',
    image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600&q=80',
    director: 'Fatima Zahra', badge: 'CANNES', badgeColor: G.goldBadge,
    synopsis: 'Portraits croisés de sans-abri dans Paris, filmés avec une tendresse bouleversante.',
    rating: 4.8,
  },
  {
    id: '14', title: 'SOMBRES HORIZONS', genre: 'Sci-Fi', type: 'Film', year: 2024,
    adjective: 'Épique', duration: '2h22',
    image: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=600&q=80',
    director: 'Pierre-Luc Arnaud', badge: 'CANNES', badgeColor: G.goldBadge,
    synopsis: 'En 2150, l\'humanité affronte sa dernière décision : exil ou extinction.',
    rating: 4.7,
  },
  // ── Courts métrages ──────────────────────────────────────────────
  {
    id: '15', title: 'DERNIER SOUFFLE', genre: 'Horreur', type: 'Court', year: 2024,
    adjective: 'Intense', duration: '18 min',
    image: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=600&q=80',
    director: 'Hugo Clément', badge: 'COURT', badgeColor: G.primL,
    synopsis: 'Un plongeur se retrouve seul à 40 mètres de fond avec une réserve d\'air critique.',
    rating: 4.1,
  },
  {
    id: '16', title: 'ENTRE DEUX', genre: 'Romance', type: 'Court', year: 2024,
    adjective: 'Délicat', duration: '22 min',
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80',
    director: 'Marie-Elise Collet', badge: 'COURT', badgeColor: G.primL,
    synopsis: 'Deux inconnus partagent un appartement le temps d\'une nuit de tempête.',
    rating: 4.0,
  },
];

// Sous-catalogues par section
const HERO_FILMS    = CATALOG.slice(0, 3);
const TRENDING      = CATALOG.slice(0, 6);
const NEW_RELEASES  = CATALOG.slice(6, 12);
const CANNES_SEL    = CATALOG.filter(w => w.badge === 'CANNES');
const SHORTS        = CATALOG.filter(w => w.type === 'Court');
const CONTINUE_WATCHING = CATALOG.slice(9, 13);

// ═══════════════════════════════════════════════════════════════════
//  GALAXY ANIMATION ENGINE (Portage Intégral)
// ═══════════════════════════════════════════════════════════════════
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface Pt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
interface Met { id: number; sx: number; sy: number; ang: number; len: number; }

const STARS: Pt[] = Array.from({ length: 60 }, (_, i) => ({
  id: i, x: rnd(0, W), y: rnd(0, H * 2),
  sz:  rnd(0.8, 2.4), col: pick([G.sW, G.sB, G.sP, G.sG, G.sCy]),
  del: rnd(0, 5000),  dur: rnd(1800, 5500), mn: 0.20, mx: 0.90,
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
    const iv = setInterval(() => {
      if (Math.random() > 0.65)
        setMeteors(m => [...m, { id: Date.now(), sx: rnd(0, W), sy: rnd(0, H * 0.5), ang: rnd(20, 50), len: rnd(80, 160) }]);
    }, 2200);
    return () => clearInterval(iv);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[G.bg0, G.bg1, G.bg2, G.bg0]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
      {/* Nébuleuses statiques */}
      <View style={{ position: 'absolute', left: -60, top: -40, width: 280, height: 220, borderRadius: 140, backgroundColor: 'rgba(108,16,195,0.18)' }} />
      <View style={{ position: 'absolute', right: -40, top: H * 0.2, width: 240, height: 190, borderRadius: 120, backgroundColor: 'rgba(172,24,160,0.12)' }} />
      <View style={{ position: 'absolute', left: W * 0.1, top: H * 0.55, width: 300, height: 240, borderRadius: 150, backgroundColor: 'rgba(22,14,185,0.10)' }} />
      {STARS.map(s => <StarDot key={s.id} p={s} />)}
      {meteors.map(m => (
        <ShootingStar key={m.id} m={m} onDone={() => setMeteors(prev => prev.filter(x => x.id !== m.id))} />
      ))}
    </View>
  );
});
GalaxyBackground.displayName = 'GalaxyBackground';

// ═══════════════════════════════════════════════════════════════════
//  COMPOSANTS
// ═══════════════════════════════════════════════════════════════════

// ─── Badge ────────────────────────────────────────────────────────
const Badge = memo(({ label, color }: { label: string; color: string }) => (
  <View style={[bd.pill, { backgroundColor: color }]}>
    <Text style={bd.txt}>{label}</Text>
  </View>
));
Badge.displayName = 'Badge';
const bd = StyleSheet.create({
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  txt:  { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});

// ─── Étoiles de notation ──────────────────────────────────────────
const Stars = memo(({ rating }: { rating: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <Ionicons
        key={i}
        name={i <= Math.round(rating) ? 'star' : 'star-outline'}
        size={10}
        color={G.sG}
      />
    ))}
    <Text style={{ color: G.t3, fontSize: 10, marginLeft: 3 }}>{rating.toFixed(1)}</Text>
  </View>
));
Stars.displayName = 'Stars';

// ─── Section header ───────────────────────────────────────────────
const SectionHeader = memo(({ title, onPress }: { title: string; onPress?: () => void }) => (
  <View style={sh.row}>
    <Text style={sh.title}>{title}</Text>
    <TouchableOpacity onPress={onPress} style={sh.chevronBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="chevron-forward" size={18} color={G.t2} />
    </TouchableOpacity>
  </View>
));
SectionHeader.displayName = 'SectionHeader';
const sh = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14, marginTop: 4 },
  title:      { color: G.t1, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  chevronBtn: { padding: 4 },
});

// ─── Carte Tendance (portrait + numéro) ──────────────────────────
const TrendingCard = memo(({ item, rank }: { item: Work; rank: number }) => {
  const router = useRouter();
  return (
    <TouchableOpacity style={tc.card} activeOpacity={0.85} onPress={() => router.push(`/film/${item.id}`)}>
      <Image source={{ uri: item.image }} style={tc.img} />
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.85)']} style={tc.overlay} />
      {item.badge && <Badge label={item.badge} color={item.badgeColor ?? G.purpleBadge} />}
      <View style={tc.bottom}>
        <Text style={tc.name} numberOfLines={2}>{item.title}</Text>
        <Text style={tc.adj}>{item.adjective}</Text>
      </View>
      <Text style={tc.rank}>{rank}</Text>
    </TouchableOpacity>
  );
});
TrendingCard.displayName = 'TrendingCard';
const tc = StyleSheet.create({
  card:    { width: 145, height: 215, marginRight: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  img:     { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject },
  bottom:  { position: 'absolute', bottom: 28, left: 10, right: 6 },
  name:    { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 17 },
  adj:     { color: G.t3, fontSize: 10, marginTop: 2, fontStyle: 'italic' },
  rank:    { position: 'absolute', bottom: -6, left: -4, color: 'rgba(255,255,255,0.55)', fontSize: 72, fontWeight: '900', lineHeight: 80, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 12 },
});

// ─── Carte Large (nouveautés, 2 colonnes) ─────────────────────────
const WideCard = memo(({ item }: { item: Work }) => {
  const router = useRouter();
  return (
    <TouchableOpacity style={wc.card} activeOpacity={0.85} onPress={() => router.push(`/film/${item.id}`)}>
      <Image source={{ uri: item.image }} style={wc.img} />
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.80)']} style={wc.overlay} />
      {item.badge && (
        <View style={wc.badgeWrap}>
          <Badge label={item.badge} color={item.badgeColor ?? G.purpleBadge} />
        </View>
      )}
      <View style={wc.info}>
        <Text style={wc.title} numberOfLines={1}>{item.title}</Text>
        <Text style={wc.meta}>{item.genre} · {item.year}</Text>
      </View>
    </TouchableOpacity>
  );
});
WideCard.displayName = 'WideCard';
const WIDE_W = (W - 20 - 20 - 10) / 2; // 2 colonnes dans un scroll horizontal
const wc = StyleSheet.create({
  card:     { width: WIDE_W, height: 150, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginRight: 10 },
  img:      { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  overlay:  { ...StyleSheet.absoluteFillObject },
  badgeWrap:{ position: 'absolute', top: 8, left: 8 },
  info:     { position: 'absolute', bottom: 10, left: 10, right: 6 },
  title:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  meta:     { color: G.t3, fontSize: 10, marginTop: 3 },
});

// ─── Carte Cannes / Sélection (paysage) ───────────────────────────
const FestivalCard = memo(({ item }: { item: Work }) => {
  const router = useRouter();
  return (
    <TouchableOpacity style={fc.card} activeOpacity={0.85} onPress={() => router.push(`/film/${item.id}`)}>
      <Image source={{ uri: item.image }} style={fc.img} />
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.90)']} style={fc.overlay} />
      <View style={fc.goldLine} />
      <View style={fc.info}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {item.badge && <Badge label={item.badge} color={item.badgeColor ?? G.goldBadge} />}
          <Text style={fc.dir}>{item.director}</Text>
        </View>
        <Text style={fc.title}>{item.title}</Text>
        <Stars rating={item.rating} />
      </View>
    </TouchableOpacity>
  );
});
FestivalCard.displayName = 'FestivalCard';
const fc = StyleSheet.create({
  card:    { width: 260, height: 155, marginRight: 14, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,214,10,0.2)' },
  img:     { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject },
  goldLine:{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#FFD60A', opacity: 0.7 },
  info:    { position: 'absolute', bottom: 12, left: 12, right: 8 },
  dir:     { color: G.t3, fontSize: 11 },
  title:   { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 5 },
});

// ─── Carte Court Métrage ──────────────────────────────────────────
const ShortCard = memo(({ item }: { item: Work }) => {
  const router = useRouter();
  return (
    <TouchableOpacity style={sc2.card} activeOpacity={0.85} onPress={() => router.push(`/film/${item.id}`)}>
      <Image source={{ uri: item.image }} style={sc2.img} />
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.85)']} style={sc2.overlay} />
      <View style={sc2.durPill}>
        <Ionicons name="time-outline" size={10} color={G.t2} />
        <Text style={sc2.dur}>{item.duration}</Text>
      </View>
      <View style={sc2.info}>
        <Text style={sc2.title} numberOfLines={1}>{item.title}</Text>
        <Text style={sc2.genre}>{item.genre}</Text>
      </View>
    </TouchableOpacity>
  );
});
ShortCard.displayName = 'ShortCard';
const sc2 = StyleSheet.create({
  card:    { width: 190, height: 130, marginRight: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: `rgba(192,96,255,0.2)` },
  img:     { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject },
  durPill: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  dur:     { color: G.t2, fontSize: 10, fontWeight: '600' },
  info:    { position: 'absolute', bottom: 10, left: 10, right: 6 },
  title:   { color: '#fff', fontSize: 13, fontWeight: '700' },
  genre:   { color: G.t3, fontSize: 10, marginTop: 2 },
});

// ─── Carte Continue à regarder (avec progress) ────────────────────
const ContinueCard = memo(({ item, progress }: { item: Work; progress: number }) => {
  const router = useRouter();
  return (
    <TouchableOpacity style={cc.card} activeOpacity={0.85} onPress={() => router.push(`/film/${item.id}`)}>
      <Image source={{ uri: item.image }} style={cc.img} />
      <LinearGradient colors={['transparent', 'rgba(6,0,16,0.92)']} style={cc.overlay} />
      <View style={cc.playCircle}>
        <Ionicons name="play" size={16} color="#fff" />
      </View>
      <View style={cc.info}>
        <Text style={cc.title} numberOfLines={1}>{item.title}</Text>
        <Text style={cc.type}>{item.type} · {item.year}</Text>
        <View style={cc.bar}>
          <View style={[cc.fill, { width: `${progress}%` as any }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
});
ContinueCard.displayName = 'ContinueCard';
const cc = StyleSheet.create({
  card:       { width: 175, height: 120, marginRight: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  img:        { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  overlay:    { ...StyleSheet.absoluteFillObject },
  playCircle: { position: 'absolute', top: '50%', left: '50%', marginTop: -20, marginLeft: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(146,64,214,0.75)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(192,96,255,0.5)' },
  info:       { position: 'absolute', bottom: 8, left: 8, right: 6 },
  title:      { color: '#fff', fontSize: 12, fontWeight: '700' },
  type:       { color: G.t3, fontSize: 10, marginTop: 1, marginBottom: 5 },
  bar:        { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  fill:       { height: '100%', backgroundColor: G.primL, borderRadius: 2 },
});

// ─── Carrousel Lecture (auto-scroll 5s) ───────────────────────────
const LectureCarousel = memo(() => {
  const router   = useRouter();
  const flatRef  = useRef<FlatList<Work>>(null);
  const [active, setActive] = useState(0);
  const CAROUSSEL_DATA = CATALOG.slice(0, 8);

  useEffect(() => {
    const iv = setInterval(() => {
      const next = (active + 1) % CAROUSSEL_DATA.length;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setActive(next);
    }, 5000);
    return () => clearInterval(iv);
  }, [active]);

  return (
    <View style={lc.wrap}>
      {/* Titre section */}
      <View style={lc.header}>
        <Ionicons name="play-circle" size={18} color={G.primL} />
        <Text style={lc.title}>En ce moment</Text>
      </View>

      {/* FlatList horizontale */}
      <FlatList
        ref={flatRef}
        data={CAROUSSEL_DATA}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={W - 40}
        decelerationRate="fast"
        keyExtractor={item => 'lc-' + item.id}
        onScrollToIndexFailed={() => {}}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (W - 40));
          setActive(idx);
        }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={lc.item}
            activeOpacity={0.9}
            onPress={() => router.push(`/film/${item.id}`)}
          >
            <Image source={{ uri: item.image }} style={lc.img} />
            <LinearGradient
              colors={['rgba(6,0,16,0.05)', 'rgba(6,0,16,0.8)']}
              style={lc.gradient}
            />
            <View style={lc.overlay}>
              {item.badge && <Badge label={item.badge} color={item.badgeColor ?? G.purpleBadge} />}
              <View style={{ flex: 1 }} />
              <Text style={lc.itemTitle}>{item.title}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Text style={lc.meta}>{item.genre}</Text>
                <Text style={lc.meta}>·</Text>
                <Text style={lc.meta}>{item.type}</Text>
                <Text style={lc.meta}>·</Text>
                <Text style={lc.meta}>{item.year}</Text>
              </View>
              <Stars rating={item.rating} />
              <View style={lc.actions}>
                <TouchableOpacity style={lc.playBtnSm} onPress={() => router.push(`/film/${item.id}`)}>
                  <Ionicons name="play" size={14} color="#fff" />
                  <Text style={lc.playTxt}>Voir maintenant</Text>
                </TouchableOpacity>
                <TouchableOpacity style={lc.infoBtn}>
                  <Ionicons name="information-circle-outline" size={20} color={G.t2} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Dots de pagination */}
      <View style={lc.dots}>
        {CAROUSSEL_DATA.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              flatRef.current?.scrollToIndex({ index: i, animated: true });
              setActive(i);
            }}
          >
            <Animated.View style={[lc.dot, i === active && lc.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});
LectureCarousel.displayName = 'LectureCarousel';
const lc = StyleSheet.create({
  wrap:      { marginBottom: 10 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  title:     { color: G.t1, fontSize: 16, fontWeight: '700' },
  item:      { width: W - 40, height: 230, marginHorizontal: 0, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  img:       { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  gradient:  { ...StyleSheet.absoluteFillObject },
  overlay:   { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  itemTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  meta:      { color: G.t3, fontSize: 12 },
  actions:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  playBtnSm: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: G.primL, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  playTxt:   { color: '#fff', fontSize: 13, fontWeight: '700' },
  infoBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: G.glass, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 20, backgroundColor: G.primL },
});

// ─── Héros principal ──────────────────────────────────────────────
interface HeroProps {
  film: Work;
  showLecture: boolean;
  onLecture: () => void;
}
const HeroCard = memo(({ film, showLecture, onLecture }: HeroProps) => {
  const router  = useRouter();
  const fadeIn  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [film.id]);

  return (
    <Animated.View style={[hero.card, { opacity: fadeIn }]}>
      <Image source={{ uri: film.image }} style={hero.img} />

      {/* Gradients overlay */}
      <LinearGradient
        colors={['rgba(6,0,16,0.20)', 'transparent', 'rgba(6,0,16,0.55)', 'rgba(6,0,16,0.96)']}
        locations={[0, 0.25, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Lueur violet gauche */}
      <LinearGradient
        colors={['rgba(100,20,200,0.40)', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 0.4, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Contenu */}
      <View style={hero.content}>
        <Text style={hero.title}>{film.title}</Text>

        {/* Tags */}
        <View style={hero.tags}>
          {[film.genre, film.type, String(film.year)].map(tag => (
            <View key={tag} style={hero.tag}>
              <Text style={hero.tagTxt}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Boutons */}
        {showLecture ? null : (
          <View style={hero.ctaRow}>
            {/* ▶ Lecture */}
            <TouchableOpacity style={hero.lectureBtn} activeOpacity={0.85} onPress={onLecture}>
              <LinearGradient colors={['#7B3FE4', '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={hero.lectureBtnInner}>
                <Ionicons name="play" size={16} color="#fff" />
                <Text style={hero.lectureTxt}>Lecture</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* ★ Ma liste */}
            <TouchableOpacity
              style={hero.listBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/profile')}
            >
              <BlurView intensity={30} tint="light" style={hero.listBtnInner}>
                <Ionicons name="star" size={14} color="rgba(80,0,160,0.85)" />
                <Text style={hero.listTxt}>Ma liste</Text>
              </BlurView>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
});
HeroCard.displayName = 'HeroCard';

const hero = StyleSheet.create({
  card:         { height: 390, borderRadius: 22, overflow: 'hidden', marginHorizontal: 18, borderWidth: 1, borderColor: 'rgba(146,64,214,0.30)' },
  img:          { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  content:      { position: 'absolute', bottom: 22, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  title:        { color: '#fff', fontSize: 42, fontWeight: '900', textAlign: 'center', letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 },
  tags:         { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 18 },
  tag:          { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tagTxt:       { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  ctaRow:       { flexDirection: 'row', gap: 12, alignItems: 'center' },
  lectureBtn:   { borderRadius: 26, overflow: 'hidden', shadowColor: G.primL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  lectureBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingVertical: 14 },
  lectureTxt:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  listBtn:      { borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  listBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.80)' },
  listTxt:      { color: 'rgba(60,0,120,0.9)', fontSize: 16, fontWeight: '800' },
});

// ─── GalaxyTabBar (identique index.tsx) ──────────────────────────
function GalaxyTabBar({ active, set }: { active: string; set: (v: string) => void }) {
  const glow  = useRef(new Animated.Value(0.5)).current;
  const spinV = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1,   duration: 1650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.5, duration: 1650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(spinV, { toValue: 1, duration: 9500, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);

  const spin = spinV.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const router = useRouter();
  const TABS = [
    { key: 'accueil', label: 'Accueil',  icon: 'home'          as const, route: '/'        },
    { key: 'reels',   label: 'Reels',    icon: 'play-outline'  as const, route: '/index'   },
    { key: 'spark',   label: '',         icon: 'sparkles'      as const, route: null        },
    { key: 'amies',   label: 'Friends',  icon: 'people-outline'as const, route: '/social'  },
    { key: 'profil',  label: 'Profil',   icon: 'person-circle' as const, route: '/profile' },
  ] as const;

  return (
    <View style={tb.wrap}>
      <View style={tb.glass} />
      <View style={tb.borderTop} />
      <View style={tb.row}>
        {TABS.map(item => {
          const on = active === item.key;
          const c  = on ? G.primL : 'rgba(240,232,255,0.38)';

          if (item.key === 'spark') return (
            <TouchableOpacity key="spark" onPress={() => set('spark')} style={tb.sparkWrap} activeOpacity={0.9}>
              <Animated.View style={[tb.sparkGlow, { opacity: glow }]} />
              <Animated.View style={[tb.sparkRing, { transform: [{ rotate: spin }] }]}>
                <LinearGradient colors={['#E080FF', '#5A0090', '#E080FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <LinearGradient colors={['#8B2FCC', '#B855FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tb.sparkInner}>
                <View style={tb.spkV} /><View style={tb.spkH} />
                <View style={[tb.spkD, { transform: [{ rotate: '45deg'  }] }]} />
                <View style={[tb.spkD, { transform: [{ rotate: '-45deg' }] }]} />
                <View style={tb.spkCtr} />
              </LinearGradient>
            </TouchableOpacity>
          );

          if (item.key === 'profil') return (
            <TouchableOpacity key="profil" onPress={() => { set('profil'); router.push('/profile'); }} style={tb.tab} activeOpacity={0.8}>
              <View style={[tb.avBox, on && tb.avBoxOn]}>
                <Image source={{ uri: 'https://i.pravatar.cc/50?img=11' }} style={{ width: '100%', height: '100%', borderRadius: 13 }} />
              </View>
              <Text style={[tb.label, on && tb.labelOn]}>Profil</Text>
            </TouchableOpacity>
          );

          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => { set(item.key); if (item.route) router.push(item.route as any); }}
              style={tb.tab} activeOpacity={0.8}
            >
              <View style={[tb.iconBox, on && tb.iconOn]}>
                <Ionicons name={item.icon} size={23} color={c} />
              </View>
              <Text style={[tb.label, on && tb.labelOn]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  wrap:       { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  glass:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,0,15,0.93)' },
  borderTop:  { height: 1, backgroundColor: 'rgba(146,64,214,0.45)' },
  row:        { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingHorizontal: 4 },
  tab:        { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  iconBox:    { width: 40, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  iconOn:     { backgroundColor: 'rgba(146,64,214,0.18)' },
  label:      { fontSize: 10, fontWeight: '500', color: 'rgba(240,232,255,0.38)' },
  labelOn:    { color: G.primL, fontWeight: '800' },
  avBox:      { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: G.bg1 },
  avBoxOn:    { borderWidth: 2, borderColor: G.primL },
  sparkWrap:  { width: 64, alignItems: 'center', justifyContent: 'center', marginTop: -22 },
  sparkGlow:  { ...StyleSheet.absoluteFillObject, borderRadius: 32, backgroundColor: G.primary, transform: [{ scale: 1.55 }] },
  sparkRing:  { position: 'absolute', width: 58, height: 58, borderRadius: 29, overflow: 'hidden' },
  sparkInner: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  spkV:       { position: 'absolute', width: 1.8, height: 28, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.94)' },
  spkH:       { position: 'absolute', height: 1.8, width: 28, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.94)' },
  spkD:       { position: 'absolute', width: 1.3, height: 19, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.58)' },
  spkCtr:     { width: 5.5, height: 5.5, borderRadius: 2.75, backgroundColor: '#fff' },
});

// ═══════════════════════════════════════════════════════════════════
//  ÉCRAN PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function FeedScreen() {
  const router     = useRouter();
  const [heroIndex,    setHeroIndex]    = useState(0);
  const [showLecture,  setShowLecture]  = useState(false);
  const [activeTab,    setActiveTab]    = useState('accueil');
  const fadeGlobal = useRef(new Animated.Value(0)).current;

  // ── Fade-in au montage ────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeGlobal, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, []);

  // ── Rotation automatique du héros toutes les 8s ───────────────
  useEffect(() => {
    if (showLecture) return;
    const iv = setInterval(() => {
      setHeroIndex(i => (i + 1) % HERO_FILMS.length);
    }, 8000);
    return () => clearInterval(iv);
  }, [showLecture]);

  const currentHero = HERO_FILMS[heroIndex];

  // ── Progress fictif pour "Continuer" ─────────────────────────
  const FAKE_PROGRESS = [35, 72, 18, 55];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <Animated.View style={{ flex: 1, opacity: fadeGlobal }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ══ HEADER ══ */}
            <View style={styles.header}>
              <Text style={styles.logo}>UNIVERSE</Text>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/search')}>
                  <Ionicons name="search-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/rewards')}>
                  <Ionicons name="gift-outline" size={22} color="#fff" />
                  {/* Notification dot */}
                  <View style={styles.notifDot} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ══ HÉROS ══ */}
            <HeroCard
              film={currentHero}
              showLecture={showLecture}
              onLecture={() => setShowLecture(true)}
            />

            {/* Indicateurs héros */}
            <View style={styles.heroDots}>
              {HERO_FILMS.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setHeroIndex(i)}>
                  <View style={[styles.heroDot, i === heroIndex && styles.heroDotOn]} />
                </TouchableOpacity>
              ))}
            </View>

            {/* ══ CARROUSEL LECTURE (affiché si bouton "Lecture" pressé) ══ */}
            {showLecture && (
              <View style={styles.lectureSection}>
                {/* Bouton fermer */}
                <TouchableOpacity
                  style={styles.closeLecture}
                  onPress={() => setShowLecture(false)}
                >
                  <Ionicons name="close-circle" size={22} color={G.t2} />
                  <Text style={styles.closeTxt}>Fermer</Text>
                </TouchableOpacity>
                {/* Wrapping pour décaler le carrousel */}
                <View style={{ paddingHorizontal: 20 }}>
                  <LectureCarousel />
                </View>
              </View>
            )}

            {/* ══ LES PLUS TENDANCES ══ */}
            <SectionHeader title="Les plus tendances" onPress={() => router.push('/search')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={{ paddingRight: 20 }}>
              {TRENDING.map((item, i) => (
                <TrendingCard key={item.id} item={item} rank={i + 1} />
              ))}
            </ScrollView>

            {/* ══ CONTINUER À REGARDER ══ */}
            <SectionHeader title="Continuer à regarder" onPress={() => router.push('/profile')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={{ paddingRight: 20 }}>
              {CONTINUE_WATCHING.map((item, i) => (
                <ContinueCard key={item.id} item={item} progress={FAKE_PROGRESS[i]} />
              ))}
            </ScrollView>

            {/* ══ NOUVEAUTÉS DANS L'UNIVERS ══ */}
            <SectionHeader title="Nouveautés dans l'univers" onPress={() => router.push('/search')} />
            {/* Grille 2 colonnes en scroll horizontal */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={{ paddingRight: 20 }}>
              {/* Paires de cartes empilées */}
              {Array.from({ length: Math.ceil(NEW_RELEASES.length / 2) }, (_, col) => (
                <View key={col} style={{ gap: 10, marginRight: 10 }}>
                  {NEW_RELEASES.slice(col * 2, col * 2 + 2).map(item => (
                    <WideCard key={item.id} item={item} />
                  ))}
                </View>
              ))}
            </ScrollView>

            {/* ══ SÉLECTION CANNES ══ */}
            <SectionHeader title="🏆 Sélection Cannes" onPress={() => router.push('/search')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={{ paddingRight: 20 }}>
              {CANNES_SEL.map(item => (
                <FestivalCard key={item.id} item={item} />
              ))}
            </ScrollView>

            {/* ══ COURTS MÉTRAGES ══ */}
            <SectionHeader title="Courts métrages" onPress={() => router.push('/search')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={{ paddingRight: 20 }}>
              {SHORTS.map(item => (
                <ShortCard key={item.id} item={item} />
              ))}
            </ScrollView>

            {/* ══ TOUTES LES ŒUVRES (grid discover) ══ */}
            <SectionHeader title="Découvrir" onPress={() => router.push('/search')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={{ paddingRight: 20 }}>
              {CATALOG.slice(0, 8).map((item, i) => (
                <TrendingCard key={'disc-' + item.id} item={item} rank={i + 1} />
              ))}
            </ScrollView>

          </ScrollView>
        </SafeAreaView>
      </Animated.View>

      {/* ══ TAB BAR ══ */}
      <GalaxyTabBar active={activeTab} set={setActiveTab} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  STYLES GLOBAUX
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: G.bg0 },
  scrollContent: { paddingBottom: 110 },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18 },
  logo:        { color: '#fff', fontSize: 22, letterSpacing: 7, fontWeight: '900', textShadowColor: G.primL, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  headerRight: { flexDirection: 'row', gap: 12 },
  iconBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: G.glass, borderWidth: 1, borderColor: G.glassBorder, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifDot:    { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: G.pinkBadge, borderWidth: 1.5, borderColor: G.bg0 },

  // Héros dots
  heroDots:    { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 6 },
  heroDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroDotOn:   { width: 20, backgroundColor: G.primL },

  // Lecture section
  lectureSection: { marginTop: 6, marginBottom: 4 },
  closeLecture:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 10 },
  closeTxt:       { color: G.t2, fontSize: 13, fontWeight: '600' },

  // Général
  hScroll:     { paddingLeft: 20, marginBottom: 24 },
});