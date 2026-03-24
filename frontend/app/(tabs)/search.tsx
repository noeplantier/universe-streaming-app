// ═══════════════════════════════════════════════════════════════════
//  search.tsx — UNIVERSE  /  Écran Rechercher
//  ─────────────────────────────────────────────────────────────────
//  Reproduction pixel-perfect du mockup image.
//  Connecté aux APIs réelles (filmsAPI).
//  Galaxie animée auto-contenue (pas d'import externe).
//
//  Structure :
//  ┌─ GalaxyCanvas           — fond voie lactée animée (7 couches)
//  ├─ Header                 — "Rechercher" + icône loupe
//  ├─ SearchBar              — glassmorphism + debounce 300ms
//  ├─ ContentTabs            — Séries · Films · Catégories
//  ├─ FilterRow              — Genre · Popularité · Durée · Année + sort
//  ├─ FilmGrid               — 3 colonnes, cards avec badges dynamiques
//  │   └─ FilmCard           — ORIGINAL · INÉDIT · NOUVEAU · EXCLUSIF
//  ├─ TrendingSection        — titre + 2 cards landscape
//  ├─ PopulairesRow          — pill glassmorphism + stacked avatars
//  └─ GalaxyTabBar           — Accueil · Reels · ✦ · Amies · Profil
// ═══════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useMemo,
  useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, TextInput, Image, Animated,
  Easing, Dimensions, ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import {
  COLORS, SPACING, RADIUS, GRADIENTS,
  DURATION_LABELS, GENRE_COLORS,
}                            from '../../constants/theme';
import { filmsAPI }          from '../../services/api';

const { width: W, height: H } = Dimensions.get('window');

// ─── Constants ─────────────────────────────────────────────────────
const EDGE       = SPACING.screenEdge ?? 18;
const COL_GAP    = 9;
const CARD_W     = (W - EDGE * 2 - COL_GAP * 2) / 3;
const CARD_H     = CARD_W * 1.56;
const LAND_W     = (W - EDGE * 2 - COL_GAP) / 2;
const LAND_H     = LAND_W * 0.62;

// ─── Palette galaxy (tokens locaux, se superposent au thème) ───────
const G = {
  bg0: '#060010',  bg1: '#0A001E',  bg2: '#070014',
  neb0: 'rgba(108,16,195,0.32)',
  neb1: 'rgba(172,24,160,0.20)',
  neb2: 'rgba(22, 14,185,0.16)',
  neb3: 'rgba(55,  0, 95,0.26)',
  mwCore: 'rgba(128,58,220,0.10)',
  mwEdge: 'rgba(80, 30,130,0.00)',
  sW: '#F3EDFF',  sB: '#B2CCFF',
  sG: '#FFE270',  sP: '#CF98FF',  sCy: '#86EEFF',
};

// ═══════════════════════════════════════════════════════════════════
//  ░░░  GALAXY ANIMATION SYSTEM  ░░░
// ═══════════════════════════════════════════════════════════════════

const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface Pt  { id:number; x:number; y:number; sz:number; col:string; del:number; dur:number; mn:number; mx:number; }
interface Sp  extends Pt { arm:number; }
interface Neb { x:number; y:number; w:number; h:number; col:string; del:number; dur:number; }
interface Met { id:number; sx:number; sy:number; ang:number; len:number; }

// ── Générer une fois (hors composant → stable) ─────────────────────
const DUST: Pt[] = Array.from({ length: 60 }, (_, i) => ({
  id:i, x:rnd(0,W), y:rnd(0,H*1.6), sz:rnd(0.35,1.05),
  col:pick([G.sW,G.sW,G.sB]),
  del:rnd(0,5800), dur:rnd(2600,6200), mn:0.05, mx:0.40,
}));
const STARS: Pt[] = Array.from({ length: 45 }, (_, i) => ({
  id:i, x:rnd(0,W), y:rnd(0,H*1.6), sz:rnd(1.0,2.3),
  col:pick([G.sW,G.sB,G.sP,G.sG,G.sW,G.sW]),
  del:rnd(0,4200), dur:rnd(1500,4000), mn:0.25, mx:0.95,
}));
const BRIGHT: Pt[] = Array.from({ length: 15 }, (_, i) => ({
  id:i, x:rnd(0,W), y:rnd(0,H*1.6), sz:rnd(2.4,4.1),
  col:pick([G.sW,G.sCy,G.sP]),
  del:rnd(0,3000), dur:rnd(900,2800), mn:0.45, mx:1.0,
}));
const SPARKLES: Sp[] = Array.from({ length: 8 }, (_, i) => ({
  id:i, x:rnd(W*0.03,W*0.97), y:rnd(0,H*1.1),
  sz:2, arm:rnd(8,20),
  col:pick([G.sW,'#C49EFF',G.sG]),
  del:rnd(0,4800), dur:rnd(1800,5000), mn:0.20, mx:0.88,
}));
const NEBULAE: Neb[] = [
  { x:-95, y:-80,      w:330, h:265, col:G.neb0, del:0,    dur:5600 },
  { x:W*0.48, y:H*0.06, w:285, h:225, col:G.neb1, del:1600, dur:6300 },
  { x:-50, y:H*0.45,   w:310, h:250, col:G.neb2, del:2900, dur:5900 },
  { x:W*0.54, y:H*0.65, w:255, h:205, col:G.neb3, del:700,  dur:6600 },
];

// ── StarDot ─────────────────────────────────────────────────────────
const StarDot = memo(function StarDot({ p, bright }: { p:Pt; bright?:boolean }) {
  const op = useRef(new Animated.Value(p.mn)).current;
  const sc = useRef(new Animated.Value(bright ? 0.7 : 1)).current;
  useEffect(() => {
    const tw = Animated.loop(Animated.sequence([
      Animated.delay(p.del % p.dur),
      Animated.timing(op, { toValue:p.mx, duration:p.dur*0.40, easing:Easing.inOut(Easing.sin), useNativeDriver:true }),
      Animated.timing(op, { toValue:p.mn, duration:p.dur*0.60, easing:Easing.inOut(Easing.sin), useNativeDriver:true }),
    ]));
    tw.start();
    let sp2: Animated.CompositeAnimation|undefined;
    if (bright) {
      sp2 = Animated.loop(Animated.sequence([
        Animated.delay((p.del%p.dur)+180),
        Animated.timing(sc, { toValue:1.28, duration:p.dur*0.38, easing:Easing.inOut(Easing.quad), useNativeDriver:true }),
        Animated.timing(sc, { toValue:0.68, duration:p.dur*0.62, easing:Easing.inOut(Easing.quad), useNativeDriver:true }),
      ]));
      sp2.start();
    }
    return () => { tw.stop(); sp2?.stop(); };
  }, []); // eslint-disable-line
  const gs = p.sz * 3.8;
  return (
    <Animated.View style={{ position:'absolute', left:p.x-p.sz/2, top:p.y-p.sz/2, alignItems:'center', justifyContent:'center', opacity:op, transform:bright?[{scale:sc}]:undefined }}>
      {bright && <View style={{ position:'absolute', width:gs, height:gs, borderRadius:gs/2, backgroundColor:p.col, opacity:0.20 }} />}
      <View style={{ width:p.sz, height:p.sz, borderRadius:p.sz/2, backgroundColor:p.col }} />
    </Animated.View>
  );
});

// ── SparkleCross ✦ ─────────────────────────────────────────────────
const SparkleCross = memo(function SparkleCross({ sp }: { sp:Sp }) {
  const op  = useRef(new Animated.Value(0.04)).current;
  const sc  = useRef(new Animated.Value(0.35)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const aw  = 1.4;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.delay(sp.del%sp.dur),
      Animated.parallel([
        Animated.timing(op,  { toValue:sp.mx,  duration:sp.dur*0.28, easing:Easing.out(Easing.cubic),     useNativeDriver:true }),
        Animated.timing(sc,  { toValue:1,      duration:sp.dur*0.28, easing:Easing.out(Easing.back(1.2)), useNativeDriver:true }),
        Animated.timing(rot, { toValue:0.125,  duration:sp.dur*0.50, easing:Easing.inOut(Easing.quad),   useNativeDriver:true }),
      ]),
      Animated.parallel([
        Animated.timing(op,  { toValue:0.02,   duration:sp.dur*0.72, easing:Easing.in(Easing.cubic),      useNativeDriver:true }),
        Animated.timing(sc,  { toValue:0.35,   duration:sp.dur*0.72, easing:Easing.in(Easing.quad),       useNativeDriver:true }),
        Animated.timing(rot, { toValue:0,      duration:sp.dur*0.50, easing:Easing.in(Easing.quad),       useNativeDriver:true }),
      ]),
    ]));
    a.start(); return () => a.stop();
  }, []); // eslint-disable-line
  const spin = rot.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] });
  const arm  = sp.arm;
  return (
    <Animated.View style={{ position:'absolute', left:sp.x-arm, top:sp.y-arm, width:arm*2, height:arm*2, alignItems:'center', justifyContent:'center', opacity:op, transform:[{scale:sc},{rotate:spin}] }}>
      <View style={{ position:'absolute', width:aw, height:arm*2, borderRadius:aw/2, backgroundColor:sp.col }} />
      <View style={{ position:'absolute', height:aw, width:arm*2, borderRadius:aw/2, backgroundColor:sp.col }} />
      <View style={{ position:'absolute', width:aw*0.65, height:arm*1.12, borderRadius:aw/2, backgroundColor:sp.col, opacity:0.55, transform:[{rotate:'45deg'}]  }} />
      <View style={{ position:'absolute', width:aw*0.65, height:arm*1.12, borderRadius:aw/2, backgroundColor:sp.col, opacity:0.55, transform:[{rotate:'-45deg'}] }} />
      <View style={{ width:aw*2.8, height:aw*2.8, borderRadius:aw*1.4, backgroundColor:sp.col }} />
    </Animated.View>
  );
});

// ── NebulaBlob ──────────────────────────────────────────────────────
const NebulaBlob = memo(function NebulaBlob({ n }: { n:Neb }) {
  const op = useRef(new Animated.Value(0.30)).current;
  const sc = useRef(new Animated.Value(0.90)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.delay(n.del),
      Animated.parallel([
        Animated.timing(op, { toValue:0.90, duration:n.dur, easing:Easing.inOut(Easing.sin), useNativeDriver:true }),
        Animated.timing(sc, { toValue:1.12, duration:n.dur, easing:Easing.inOut(Easing.sin), useNativeDriver:true }),
      ]),
      Animated.parallel([
        Animated.timing(op, { toValue:0.26, duration:n.dur, easing:Easing.inOut(Easing.sin), useNativeDriver:true }),
        Animated.timing(sc, { toValue:0.88, duration:n.dur, easing:Easing.inOut(Easing.sin), useNativeDriver:true }),
      ]),
    ]));
    a.start(); return () => a.stop();
  }, []); // eslint-disable-line
  return <Animated.View style={{ position:'absolute', left:n.x, top:n.y, width:n.w, height:n.h, borderRadius:Math.max(n.w,n.h)*0.48, backgroundColor:n.col, opacity:op, transform:[{scale:sc}] }} />;
});

// ── ShootingStar ────────────────────────────────────────────────────
const ShootingStar = memo(function ShootingStar({ m, onDone }: { m:Met; onDone:()=>void }) {
  const prog = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const DUR = 680;
    Animated.parallel([
      Animated.sequence([
        Animated.timing(op, { toValue:1, duration:DUR*0.12, useNativeDriver:true }),
        Animated.timing(op, { toValue:0, duration:DUR*0.88, easing:Easing.in(Easing.quad), useNativeDriver:true }),
      ]),
      Animated.timing(prog, { toValue:1, duration:DUR, easing:Easing.out(Easing.quad), useNativeDriver:true }),
    ]).start(({ finished }) => { if (finished) onDone(); });
    return () => { prog.stopAnimation(); op.stopAnimation(); };
  }, []); // eslint-disable-line
  const rad = (m.ang * Math.PI) / 180;
  const tx  = prog.interpolate({ inputRange:[0,1], outputRange:[0, Math.cos(rad)*W*0.65] });
  const ty  = prog.interpolate({ inputRange:[0,1], outputRange:[0, Math.sin(rad)*W*0.65] });
  return (
    <Animated.View style={{ position:'absolute', left:m.sx, top:m.sy, opacity:op, transform:[{translateX:tx},{translateY:ty},{rotate:`${m.ang}deg`}] }}>
      <LinearGradient colors={['rgba(50,0,110,0)','rgba(175,110,255,0.65)','rgba(255,255,255,0.95)']} start={{x:0,y:0.5}} end={{x:1,y:0.5}} style={{ width:m.len, height:1.8, borderRadius:1 }} />
      <View style={{ position:'absolute', right:-2, top:-3.5, width:7, height:7, borderRadius:3.5, backgroundColor:'#fff' }} />
      <View style={{ position:'absolute', right:-7, top:-8, width:16, height:16, borderRadius:8, backgroundColor:'rgba(185,140,255,0.35)' }} />
    </Animated.View>
  );
});

// ── MeteorManager ───────────────────────────────────────────────────
const MeteorManager = memo(function MeteorManager() {
  const [meteors, setMeteors] = useState<Met[]>([]);
  const nxt = useRef(0);
  const tmr = useRef<ReturnType<typeof setTimeout>>();
  const schedule = useCallback(() => {
    tmr.current = setTimeout(() => {
      setMeteors(p => [...p, { id:++nxt.current, sx:rnd(0,W*0.55), sy:rnd(H*0.02,H*0.42), ang:rnd(22,42), len:rnd(90,175) }]);
      schedule();
    }, rnd(3500,8500));
  }, []);
  useEffect(() => {
    tmr.current = setTimeout(schedule, rnd(1200,3000));
    return () => { if (tmr.current) clearTimeout(tmr.current); };
  }, [schedule]);
  const remove = useCallback((id:number) => setMeteors(p => p.filter(m=>m.id!==id)), []);
  return <>{meteors.map(m => <ShootingStar key={m.id} m={m} onDone={()=>remove(m.id)} />)}</>;
});

// ── GalaxyCanvas — assemblage des 7 couches ─────────────────────────
const GalaxyCanvas = memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {/* L0 — fond espace */}
    <LinearGradient colors={[G.bg0,G.bg1,G.bg2,G.bg0]} locations={[0,0.28,0.65,1]} style={StyleSheet.absoluteFill} />

   
    {/* L3 — poussière */}
    {DUST.map(p=><StarDot key={`d${p.id}`} p={p} />)}
    {/* L4 — étoiles */}
    {STARS.map(p=><StarDot key={`s${p.id}`} p={p} />)}
    {/* L5 — étoiles brillantes */}
    {BRIGHT.map(p=><StarDot key={`b${p.id}`} p={p} bright />)}
    
    {/* L7 — étoiles filantes */}
    <MeteorManager />
  </View>
));
GalaxyCanvas.displayName = 'GalaxyCanvas';

// ═══════════════════════════════════════════════════════════════════
//  ░░░  BADGES SYSTEM  ░░░
//  Vignettes indicatives pour les œuvres
// ═══════════════════════════════════════════════════════════════════

// Attribution déterministe selon l'index du film dans la liste
type BadgeType = 'ORIGINAL' | 'INÉDIT' | 'NOUVEAU' | 'EXCLUSIF' | 'PRIMÉ' | 'none';

function getBadge(idx: number, rating: number, views_count: number): BadgeType {
  if (rating >= 4.5)              return 'PRIMÉ';
  if (idx % 7 === 0)              return 'ORIGINAL';
  if (views_count < 500)          return 'INÉDIT';
  if (idx % 5 === 0)              return 'NOUVEAU';
  if (idx % 9 === 0)              return 'EXCLUSIF';
  return 'none';
}

const BADGE_STYLES: Record<BadgeType, { bg:string; text:string; dot?:string }> = {
  'ORIGINAL': { bg:'transparent',  text:'rgba(255,255,255,0.82)', dot:'#E53E3E' },
  'INÉDIT':   { bg:'rgba(30,140,100,0.85)', text:'#fff' },
  'NOUVEAU':  { bg:'rgba(8,100,210,0.85)',  text:'#fff' },
  'EXCLUSIF': { bg:'rgba(139,47,204,0.92)', text:'#fff' },
  'PRIMÉ':    { bg:'rgba(180,130,0,0.88)',  text:'#FFE270' },
  'none':     { bg:'transparent',  text:'transparent' },
};

interface BadgeProps { type:BadgeType; }
function FilmBadge({ type }: BadgeProps) {
  if (type === 'none') return null;
  const s = BADGE_STYLES[type];
  if (type === 'ORIGINAL') {
    return (
      <View style={bd.originalWrap}>
        <View style={[bd.dot, { backgroundColor: s.dot }]} />
        <Text style={bd.originalTxt}>ORIGINAL</Text>
      </View>
    );
  }
  return (
    <View style={[bd.wrap, { backgroundColor: s.bg }]}>
      <Text style={[bd.txt, { color: s.text }]}>{type}</Text>
    </View>
  );
}
const bd = StyleSheet.create({
  wrap:        { position:'absolute', top:9, left:9, borderRadius:5, paddingHorizontal:7, paddingVertical:3, zIndex:10 },
  txt:         { fontSize:9, fontWeight:'800', letterSpacing:0.3 },
  originalWrap:{ position:'absolute', top:9, left:9, flexDirection:'row', alignItems:'center', gap:4, zIndex:10 },
  dot:         { width:7, height:7, borderRadius:4 },
  originalTxt: { color:'rgba(255,255,255,0.82)', fontSize:8, fontWeight:'800', letterSpacing:1.1 },
});

// ═══════════════════════════════════════════════════════════════════
//  ░░░  FILM CARDS  ░░░
// ═══════════════════════════════════════════════════════════════════

interface Film {
  id:string; title:string; director:string; duration_minutes:number;
  duration_type:string; genre:string; poster_url:string;
  year:number; rating:number; views_count:number;
}
// ── FilmCard 3-colonnes ─────────────────────────────────────────────
interface FilmCardProps { film:Film; index:number; onPress:()=>void; }
const FilmCard = memo(function FilmCard({ film, index, onPress }: FilmCardProps) {
  const sc  = useRef(new Animated.Value(1)).current;
  const badge = getBadge(index, film.rating, film.views_count);
  const rankColor = GENRE_COLORS[film.genre] ?? COLORS.primary;
  const rank = index + 1;

  function pressIn()  { Animated.spring(sc, { toValue:0.94, useNativeDriver:true, speed:35, bounciness:4 }).start(); }
  function pressOut() { Animated.spring(sc, { toValue:1,    useNativeDriver:true, speed:25 }).start(); }

  const likes = Math.max(12, Math.floor(film.views_count / 80));
  const views = film.views_count > 50 ? Math.floor(film.views_count / 20) : undefined;

  return (
    <Animated.View style={{ transform:[{scale:sc}], width:CARD_W, height:CARD_H }}>
      <TouchableOpacity onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1}
        style={[fc.card, { width:CARD_W, height:CARD_H }]}>

        {/* Poster */}
        <Image source={{ uri:film.poster_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />

        {/* Dark gradient heavy bottom */}
        <LinearGradient
          colors={['rgba(6,0,16,0.0)','rgba(6,0,16,0.30)','rgba(6,0,16,0.96)']}
          locations={[0.25,0.58,1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Badge vignette */}
        <FilmBadge type={badge} />

        {/* Rank watermark */}
        <Text style={[fc.rank, { color: rankColor + 'CC' }]}>
          {rank}
        </Text>

        {/* Title */}
        <Text style={fc.title} numberOfLines={2}>{film.title}</Text>

        {/* Bottom counters row */}
        <View style={fc.counters}>
          <View style={fc.ctrItem}>
            <Text style={fc.heartEmoji}>♥</Text>
            <Text style={fc.ctrTxt}>{likes}</Text>
          </View>
          {views !== undefined && (
            <View style={[fc.ctrItem, { marginLeft:7 }]}>
              <Ionicons name="eye-outline" size={10} color="rgba(237,232,255,0.45)" />
              <Text style={[fc.ctrTxt, { color:'rgba(237,232,255,0.45)' }]}>{views}</Text>
            </View>
          )}
        </View>

        {/* Genre pill bottom-right overlay */}
        <View style={[fc.genrePill, { backgroundColor:(GENRE_COLORS[film.genre]??COLORS.primary)+'28', borderColor:(GENRE_COLORS[film.genre]??COLORS.primary)+'66' }]}>
          <Text style={[fc.genreTxt, { color:GENRE_COLORS[film.genre]??COLORS.primaryLight }]}>
            {film.genre}
          </Text>
        </View>

      </TouchableOpacity>
    </Animated.View>
  );
});

const fc = StyleSheet.create({
  card:      { borderRadius:RADIUS.lg??18, overflow:'hidden', backgroundColor:COLORS.surface, shadowColor:'#000', shadowOpacity:0.55, shadowRadius:14, shadowOffset:{width:0,height:7}, elevation:9 },
  rank:      { position:'absolute', bottom:36, left:5, fontSize:46, fontWeight:'900', lineHeight:54, zIndex:2 },
  title:     { position:'absolute', bottom:20, left:9, right:8, color:'#fff', fontSize:11, fontWeight:'800', lineHeight:15 },
  counters:  { position:'absolute', bottom:6, left:9, right:8, flexDirection:'row', alignItems:'center' },
  ctrItem:   { flexDirection:'row', alignItems:'center', gap:3 },
  heartEmoji:{ fontSize:10, color:'#EF4444' },
  ctrTxt:    { color:'rgba(237,232,255,0.85)', fontSize:10, fontWeight:'600' },
  genrePill: { position:'absolute', top:9, right:9, borderRadius:999, paddingHorizontal:6, paddingVertical:2, borderWidth:1 },
  genreTxt:  { fontSize:8, fontWeight:'700' },
});

// ── TrendingLandscapeCard ───────────────────────────────────────────
const TrendingCard = memo(({ film, onPress, accentLeft }: { film:Film; onPress:()=>void; accentLeft?:boolean }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[tc.card, { width:LAND_W, height:LAND_H }]}>
    <Image source={{ uri:film.poster_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    <LinearGradient colors={['transparent','rgba(6,0,16,0.90)']} style={StyleSheet.absoluteFill} />
    {accentLeft && (
      <LinearGradient colors={['rgba(130,40,210,0.42)','transparent']} start={{x:0,y:0.5}} end={{x:0.4,y:0.5}} style={StyleSheet.absoluteFill} />
    )}
    {/* Stars overlay */}
    <View style={tc.meta}>
      <View style={tc.stars}>
        {[1,2,3,4,5].map(s=>
          <Ionicons key={s} name={s<=Math.round(film.rating)?'star':'star-outline'} size={9} color="#FFD60A" />
        )}
      </View>
      <Text style={tc.title} numberOfLines={2}>{film.title}</Text>
    </View>
    <View style={tc.durBadge}>
      <Text style={tc.durTxt}>{film.duration_minutes}m</Text>
    </View>
  </TouchableOpacity>
));
TrendingCard.displayName = 'TrendingCard';

const tc = StyleSheet.create({
  card:     { borderRadius:RADIUS.lg??18, overflow:'hidden', backgroundColor:COLORS.surface, shadowColor:'#000', shadowOpacity:0.45, shadowRadius:12, shadowOffset:{width:0,height:6}, elevation:8 },
  meta:     { position:'absolute', bottom:0, left:0, right:0, padding:10 },
  stars:    { flexDirection:'row', gap:2, marginBottom:4 },
  title:    { color:'#fff', fontSize:11, fontWeight:'800', lineHeight:15 },
  durBadge: { position:'absolute', top:9, right:9, backgroundColor:'rgba(0,0,0,0.62)', borderRadius:999, paddingHorizontal:7, paddingVertical:3 },
  durTxt:   { color:'rgba(237,232,255,0.8)', fontSize:9, fontWeight:'600' },
});

// ═══════════════════════════════════════════════════════════════════
//  ░░░  UI COMPONENTS  ░░░
// ═══════════════════════════════════════════════════════════════════

// ── SearchBar glassmorphism ──────────────────────────────────────────
function SearchBar({ value, onChange, loading }: { value:string; onChange:(v:string)=>void; loading:boolean }) {
  const focused = useRef(new Animated.Value(0)).current;
  function onFocus() { Animated.timing(focused,{toValue:1,duration:200,useNativeDriver:false}).start(); }
  function onBlur()  { Animated.timing(focused,{toValue:0,duration:200,useNativeDriver:false}).start(); }
  const borderColor = focused.interpolate({ inputRange:[0,1], outputRange:['rgba(139,47,204,0.32)','rgba(192,96,255,0.75)'] });
  return (
    <Animated.View style={[sb.wrap, { borderColor }]}>
      <Ionicons name="search-outline" size={17} color="rgba(237,232,255,0.40)" style={sb.icon} />
      <TextInput
        style={sb.input}
        placeholder="Rechercher dans Universe..."
        placeholderTextColor="rgba(237,232,255,0.36)"
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType="search"
        selectionColor={COLORS.primaryLight}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={()=>onChange('')} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="close-circle" size={17} color="rgba(237,232,255,0.40)" />
        </TouchableOpacity>
      )}
      {loading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft:8 }} />}
    </Animated.View>
  );
}
const sb = StyleSheet.create({
  wrap:  { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.056)', borderRadius:RADIUS.md??14, borderWidth:1, paddingHorizontal:14, marginHorizontal:EDGE },
  icon:  { marginRight:10 },
  input: { flex:1, color:'#EDE8FF', fontSize:14, paddingVertical:14 },
});

// ── ContentTabs ─────────────────────────────────────────────────────
const CTABS = ['Séries','Films','Catégories'] as const;
function ContentTabs({ active, set }: { active:string; set:(v:string)=>void }) {
  return (
    <View style={ct.row}>
      {CTABS.map(tab => {
        const on = active===tab;
        if (on) return (
          <TouchableOpacity key={tab} onPress={()=>set(tab)} activeOpacity={0.85}
            style={{ borderRadius:RADIUS.md??14, shadowColor:COLORS.primary, shadowOpacity:0.65, shadowRadius:10, elevation:7 }}>
     
          </TouchableOpacity>
        );
        return (
          <TouchableOpacity key={tab} onPress={()=>set(tab)} activeOpacity={0.8} style={ct.inactive}>
            <Text style={ct.inactiveTxt}>{tab}</Text>
            {tab==='Catégories' && <Text style={[ct.inactiveTxt,{marginLeft:2,opacity:0.55}]}>›</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const ct = StyleSheet.create({
  row:       { flexDirection:'row', gap:8, paddingHorizontal:EDGE, alignItems:'center' },
  active:    { paddingHorizontal:22, paddingVertical:9, borderRadius:RADIUS.md??14 },
  activeTxt: { color:'#fff', fontSize:14, fontWeight:'800' },
  inactive:  { flexDirection:'row', alignItems:'center', paddingHorizontal:18, paddingVertical:9, borderRadius:RADIUS.md??14, backgroundColor:'rgba(255,255,255,0.055)', borderWidth:1, borderColor:'rgba(255,255,255,0.09)' },
  inactiveTxt:{ color:'rgba(237,232,255,0.62)', fontSize:14, fontWeight:'500' },
});

// ── FilterRow ───────────────────────────────────────────────────────
const FILTERS = ['Genre','Popularité','Durée','Année'] as const;
function FilterRow({ active, set }: { active:string|null; set:(v:string|null)=>void }) {
  return (
    <View style={fr.row}>
      {FILTERS.map(f => {
        const on = active===f;
        return (
          <TouchableOpacity key={f} onPress={()=>set(on?null:f)} activeOpacity={0.8}
            style={[fr.chip, on&&fr.chipOn]}>
            <Text style={[fr.txt, on&&fr.txtOn]}>{f}</Text>
            {!on && <Ionicons name="chevron-down" size={10} color="rgba(237,232,255,0.40)" style={{marginLeft:2}} />}
          </TouchableOpacity>
        );
      })}
      
    </View>
  );
}
const fr = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center', gap:7, paddingHorizontal:EDGE },
  chip:   { flexDirection:'row', alignItems:'center', borderRadius:999, paddingHorizontal:13, paddingVertical:7, backgroundColor:'rgba(255,255,255,0.056)', borderWidth:1, borderColor:'rgba(255,255,255,0.09)' },
  chipOn: { backgroundColor:'rgba(139,47,204,0.22)', borderColor:'rgba(192,96,255,0.7)' },
  txt:    { color:'rgba(237,232,255,0.60)', fontSize:12, fontWeight:'500' },
  txtOn:  { color:'#C060FF', fontWeight:'700' },
  sortBtn:{ width:33, height:33, alignItems:'center', justifyContent:'center', borderRadius:16, backgroundColor:'rgba(255,255,255,0.056)', borderWidth:1, borderColor:'rgba(255,255,255,0.09)' },
  sortLines:{ gap:3.5, alignItems:'flex-end' },
  line:   { height:1.8, backgroundColor:'rgba(237,232,255,0.50)', borderRadius:1 },
});

// ── SectionHeader ───────────────────────────────────────────────────
function SectionHeader({ title, onPress }: { title:string; onPress?:()=>void }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {onPress && (
        <TouchableOpacity onPress={onPress} style={sh.btn} activeOpacity={0.8}>
          <Text style={sh.chevron}>›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:EDGE, marginBottom:14 },
  title:   { fontSize:20, fontWeight:'800', color:'#EDE8FF', letterSpacing:-0.2 },
  btn:     { width:32, height:32, borderRadius:16, backgroundColor:'rgba(255,255,255,0.07)', borderWidth:1, borderColor:'rgba(255,255,255,0.09)', alignItems:'center', justifyContent:'center' },
  chevron: { color:'rgba(237,232,255,0.55)', fontSize:18, lineHeight:20 },
});

// ── PopulairesRow ───────────────────────────────────────────────────
function PopulairesRow({ films }: { films:Film[] }) {
  const avatars = films.slice(0,3).map(f=>f.poster_url);
  return (
    <TouchableOpacity activeOpacity={0.85} style={po.row}>

      <View style={{flex:1}}>
        <Text style={po.label}>Populaires</Text>
        <Text style={po.sub}>Films les plus regardés</Text>
      </View>
      <View style={po.avatars}>
        {avatars.map((url,i)=>(
          <Image key={i} source={{uri:url}} style={[po.av, {marginLeft:i>0?-10:0, zIndex:10-i}]} />
        ))}
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(237,232,255,0.35)" style={{marginLeft:6}} />
    </TouchableOpacity>
  );
}
const po = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', gap:13, backgroundColor:'rgba(255,255,255,0.057)', borderRadius:RADIUS.xl??28, padding:14, marginHorizontal:EDGE, borderWidth:1, borderColor:'rgba(139,47,204,0.28)' },
  iconWrap: { width:42, height:42, borderRadius:21, overflow:'hidden', shadowColor:'#8B2FCC', shadowOpacity:0.6, shadowRadius:8, elevation:6 },
  iconGrad: { flex:1, alignItems:'center', justifyContent:'center' },
  label:    { color:'#EDE8FF', fontSize:14, fontWeight:'700' },
  sub:      { color:'rgba(237,232,255,0.38)', fontSize:11, marginTop:2 },
  avatars:  { flexDirection:'row', alignItems:'center' },
  av:       { width:30, height:30, borderRadius:15, borderWidth:2, borderColor:'#0A001E', backgroundColor:'#1A0032' },
});

// ═══════════════════════════════════════════════════════════════════
//  ░░░  GALAXY TABBAR  ░░░
// ═══════════════════════════════════════════════════════════════════
const TAB_ITEMS = [
  { key:'accueil', label:'Accueil', icon:'home-outline'    as const },
  { key:'reels',   label:'Reels',   icon:'play-outline'    as const },
  { key:'spark',   label:'',        icon:'sparkles'        as const },
  { key:'amies',   label:'Amies',   icon:'people-outline'  as const },
  { key:'profil',  label:'',        icon:'person-circle'   as const },
] as const;

function GalaxyTabBar({ active, set }: { active:string; set:(v:string)=>void }) {
  const glow = useRef(new Animated.Value(0.5)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glow,{toValue:1,  duration:1700,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
      Animated.timing(glow,{toValue:0.5,duration:1700,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
    ])).start();
    Animated.loop(Animated.timing(spin,{toValue:1,duration:9500,easing:Easing.linear,useNativeDriver:true})).start();
  }, []);
  const rotate = spin.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']});

  return (
    <View style={tb.wrap}>
      <View style={tb.glass} />
      <View style={tb.borderTop} />
      <View style={tb.row}>
        {TAB_ITEMS.map(item => {
          const isActive = active===item.key;
          const isSpark  = item.key==='spark';
          const c        = isActive ? '#C060FF' : 'rgba(237,232,255,0.38)';

          if (isSpark) return (
            <TouchableOpacity key={item.key} onPress={()=>set(item.key)} style={tb.sparkWrap} activeOpacity={0.9}>
              <Animated.View style={[tb.sparkGlow, {opacity:glow}]} />
              <Animated.View style={[tb.sparkRing, {transform:[{rotate}]}]}>
                <LinearGradient colors={['#E080FF','#5A0090','#E080FF']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
              </Animated.View>
             
            </TouchableOpacity>
          );

          if (item.key==='profil') return (
            <TouchableOpacity key={item.key} onPress={()=>set(item.key)} style={tb.tab} activeOpacity={0.8}>
              <View style={[tb.avBox, isActive&&tb.avBoxActive]}>
                <Image source={{uri:'https://i.pravatar.cc/50?img=11'}} style={{width:'100%',height:'100%',borderRadius:13}} />
              </View>
            </TouchableOpacity>
          );

          return (
            <TouchableOpacity key={item.key} onPress={()=>set(item.key)} style={tb.tab} activeOpacity={0.8}>
              <View style={[tb.iconWrap, isActive&&tb.iconActive]}>
                <Ionicons name={item.icon} size={23} color={c} />
              </View>
              <Text style={[tb.label, isActive&&tb.labelOn]}>{item.label}</Text>
              {item.key==='reels' && isActive && <View style={tb.underline} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  wrap:      { position:'absolute', bottom:0, left:0, right:0, paddingBottom:20 },
  glass:     { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(6,0,16,0.90)' },
  borderTop: { height:1, backgroundColor:'rgba(139,47,204,0.40)' },
  row:       { flexDirection:'row', alignItems:'center', paddingTop:8, paddingHorizontal:4 },
  tab:       { flex:1, alignItems:'center', gap:3, paddingVertical:4 },
  iconWrap:  { width:40, height:32, alignItems:'center', justifyContent:'center', borderRadius:10 },
  iconActive:{ backgroundColor:'rgba(139,47,204,0.18)' },
  label:     { fontSize:10, fontWeight:'500', color:'rgba(237,232,255,0.38)' },
  labelOn:   { color:'#C060FF', fontWeight:'700' },
  underline: { width:18, height:2.5, borderRadius:2, backgroundColor:'#C060FF', marginTop:-2 },
  avBox:     { width:28, height:28, borderRadius:14, overflow:'hidden', backgroundColor:'#1A0032' },
  avBoxActive:{ borderWidth:2, borderColor:'#C060FF' },
  // Sparkle
  sparkWrap: { width:64, alignItems:'center', justifyContent:'center', marginTop:-22 },
  sparkGlow: { ...StyleSheet.absoluteFillObject, borderRadius:32, backgroundColor:'#8B2FCC', transform:[{scale:1.55}] },
  sparkRing: { position:'absolute', width:58, height:58, borderRadius:29, overflow:'hidden' },
  sparkInner:{ width:52, height:52, borderRadius:26, alignItems:'center', justifyContent:'center' },
  spkV:      { position:'absolute', width:1.8, height:28, borderRadius:1, backgroundColor:'rgba(255,255,255,0.94)' },
  spkH:      { position:'absolute', height:1.8, width:28, borderRadius:1, backgroundColor:'rgba(255,255,255,0.94)' },
  spkD:      { position:'absolute', width:1.3, height:19, borderRadius:1, backgroundColor:'rgba(255,255,255,0.58)' },
  spkCenter: { width:5.5, height:5.5, borderRadius:2.75, backgroundColor:'#fff' },
});

// ═══════════════════════════════════════════════════════════════════
//  ░░░  SEARCH SCREEN — main export  ░░░
// ═══════════════════════════════════════════════════════════════════
export default function SearchScreen() {
  const router = useRouter();

  // ── State ─────────────────────────────────────────────────────────
  const [query,     setQuery]     = useState('');
  const [ctab,      setCtab]      = useState('Séries');
  const [fchip,     setFchip]     = useState<string|null>(null);
  const [actTab,    setActTab]    = useState('amies');
  const [films,     setFilms]     = useState<Film[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [searching, setSearching] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────
  const fetchFilms = useCallback(async (q?: string) => {
    setSearching(true);
    try {
      const params: Record<string,string> = {};
      if (q) params.q = q;
      // Map content tab to duration/type filter
      if (ctab === 'Films') params.duration_type = 'long';
      const data = await filmsAPI.getAll(params);
      setFilms(data ?? []);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [ctab]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(()=>fetchFilms(query||undefined), 300);
    return () => clearTimeout(t);
  }, [query, ctab, fetchFilms]);

  // ── Sections from data ────────────────────────────────────────────
  const gridFilms    = films.slice(0, Math.min(films.length, 9));
  const trendFilms   = films.slice(0, 2);
  const popularFilms = films.slice(0, 5);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <View style={sc.root}>
      <StatusBar barStyle="light-content" />

      {/* ✦ Galaxy animée — 7 couches ✦ */}
      <GalaxyCanvas />

      {/* Content area */}
      <SafeAreaView style={{flex:1}} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sc.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Header ──────────────────────────────────────────── */}
          <View style={sc.header}>
            <Text style={sc.headerTitle}>Rechercher</Text>
            <TouchableOpacity style={sc.headerIconBtn} activeOpacity={0.8}>
              <Ionicons name="search" size={20} color="#EDE8FF" />
            </TouchableOpacity>
          </View>

          {/* ── SearchBar ───────────────────────────────────────── */}
          <View style={{marginBottom:16}}>
            <SearchBar value={query} onChange={setQuery} loading={searching} />
          </View>

          {/* ── Content Tabs ────────────────────────────────────── */}
          <View style={{marginBottom:14}}>
            <ContentTabs active={ctab} set={setCtab} />
          </View>

          {/* ── Filter chips ────────────────────────────────────── */}
          <View style={{marginBottom:20}}>
            <FilterRow active={fchip} set={setFchip} />
          </View>

          {/* ── Film Grid 3 colonnes ─────────────────────────────── */}
          {loading ? (
            <View style={sc.loader}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : gridFilms.length > 0 ? (
            <View style={sc.grid}>
              {gridFilms.map((film, i) => (
                <FilmCard
                  key={film.id}
                  film={film}
                  index={i}
                  onPress={() => router.push(`/film/${film.id}`)}
                />
              ))}
            </View>
          ) : (
            <View style={sc.empty}>
              <Ionicons name="film-outline" size={48} color="rgba(237,232,255,0.28)" />
              <Text style={sc.emptyTxt}>Aucune œuvre trouvée</Text>
              <Text style={sc.emptySub}>Essayez d'autres filtres</Text>
            </View>
          )}

          {/* ── Section : Les Plus Tendances ─────────────────────── */}
          {trendFilms.length >= 2 && (
            <View style={{marginBottom:20}}>
              <SectionHeader
                title="Les Plus tendances"
                onPress={() => router.push({ pathname:'/category/[type]', params:{type:'trending'} })}
              />
              <View style={sc.trendRow}>
                {trendFilms.map((film, i) => (
                  <TrendingCard
                    key={film.id}
                    film={film}
                    accentLeft={i === 0}
                    onPress={() => router.push(`/film/${film.id}`)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* ── Populaires row ───────────────────────────────────── */}
          {popularFilms.length > 0 && (
            <View style={{marginBottom:16}}>
              <PopulairesRow films={popularFilms} />
            </View>
          )}

        </ScrollView>
      </SafeAreaView>

    
    </View>
  );
}

// ─── Root styles ──────────────────────────────────────────────────
const sc = StyleSheet.create({
  root:   { flex:1, backgroundColor:G.bg0 },
  scroll: { paddingBottom:110 },

  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:EDGE, paddingTop:14, paddingBottom:10 },
  headerTitle: { fontSize:28, fontWeight:'800', color:'#EDE8FF', letterSpacing:-0.3 },
  headerIconBtn: { width:42, height:42, borderRadius:21, backgroundColor:'rgba(255,255,255,0.07)', borderWidth:1, borderColor:'rgba(255,255,255,0.09)', alignItems:'center', justifyContent:'center' },

  // Film grid — 3 colonnes, espacées
  grid:     { flexDirection:'row', flexWrap:'wrap', gap:COL_GAP, paddingHorizontal:EDGE, marginBottom:26 },

  // Trending row
  trendRow: { flexDirection:'row', gap:COL_GAP, paddingHorizontal:EDGE },

  loader:   { height:200, alignItems:'center', justifyContent:'center' },
  empty:    { paddingTop:60, alignItems:'center', gap:12 },
  emptyTxt: { color:'rgba(237,232,255,0.55)', fontSize:17, fontWeight:'700' },
  emptySub: { color:'rgba(237,232,255,0.32)', fontSize:13 },
});