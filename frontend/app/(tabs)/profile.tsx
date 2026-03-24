
import React, {
  useState, useEffect, useRef, useMemo,
  useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, Animated,
  Easing, Dimensions, StatusBar, SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width: W, height: H } = Dimensions.get('window');

// ─── Design Tokens (Identiques à search.tsx pour consistance) ──────
const SPACING = 18;
const COL_GAP = 2; // Plus serré pour la grille profile
const ITEM_W  = (W - COL_GAP * 2) / 3; // 3 colonnes pleines

// Palette Galaxie
const G = {
  bg0: '#060010',  bg1: '#0A001E',  bg2: '#070014',
  neb0: 'rgba(108,16,195,0.32)',
  neb1: 'rgba(172,24,160,0.20)',
  neb2: 'rgba(22, 14,185,0.16)',
  neb3: 'rgba(55,  0, 95,0.26)',
  sW: '#F3EDFF',  sB: '#B2CCFF',
  sG: '#FFE270',  sP: '#CF98FF',  sCy: '#86EEFF',
  primary: '#C060FF',
  surface: 'rgba(255,255,255,0.06)',
};

// ═══════════════════════════════════════════════════════════════════
//  ░░░  GALAXY ANIMATION ENGINE (Ported from Search)  ░░░
// ═══════════════════════════════════════════════════════════════════

const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface Pt  { id:number; x:number; y:number; sz:number; col:string; del:number; dur:number; mn:number; mx:number; }
interface Neb { x:number; y:number; w:number; h:number; col:string; del:number; dur:number; }
interface Met { id:number; sx:number; sy:number; ang:number; len:number; }

// Configuration statique des particules
const DUST: Pt[] = Array.from({ length: 50 }, (_, i) => ({
  id:i, x:rnd(0,W), y:rnd(0,H), sz:rnd(0.35,1.05),
  col:pick([G.sW,G.sW,G.sB]),
  del:rnd(0,5800), dur:rnd(2600,6200), mn:0.05, mx:0.40,
}));
const STARS: Pt[] = Array.from({ length: 35 }, (_, i) => ({
  id:i, x:rnd(0,W), y:rnd(0,H), sz:rnd(1.0,2.3),
  col:pick([G.sW,G.sB,G.sP,G.sG,G.sW]),
  del:rnd(0,4200), dur:rnd(1500,4000), mn:0.25, mx:0.95,
}));
const BRIGHT: Pt[] = Array.from({ length: 10 }, (_, i) => ({
  id:i, x:rnd(0,W), y:rnd(0,H), sz:rnd(2.4,4.1),
  col:pick([G.sW,G.sCy,G.sP]),
  del:rnd(0,3000), dur:rnd(900,2800), mn:0.45, mx:1.0,
}));
const NEBULAE: Neb[] = [
  { x:-80, y:-50,      w:300, h:240, col:G.neb0, del:0,    dur:5600 },
  { x:W*0.6, y:H*0.2,  w:280, h:220, col:G.neb1, del:1600, dur:6300 },
  { x:-40, y:H*0.5,    w:310, h:250, col:G.neb2, del:2900, dur:5900 },
];

// Compo: Point lumineux animé
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
    return () => tw.stop();
  }, []);
  const gs = p.sz * 3.8; // Glow size
  return (
    <Animated.View style={{ position:'absolute', left:p.x, top:p.y, opacity:op, transform:bright?[{scale:sc}]:undefined }}>
      {bright && <View style={{ position:'absolute', left:-gs/2, top:-gs/2, width:gs, height:gs, borderRadius:gs/2, backgroundColor:p.col, opacity:0.20 }} />}
      <View style={{ width:p.sz, height:p.sz, borderRadius:p.sz/2, backgroundColor:p.col }} />
    </Animated.View>
  );
});


// Compo: Étoile Filante
const ShootingStar = memo(function ShootingStar({ m, onDone }: { m:Met; onDone:()=>void }) {
  const prog = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const DUR = 750;
    Animated.parallel([
      Animated.sequence([
        Animated.timing(op, { toValue:1, duration:DUR*0.1, useNativeDriver:true }),
        Animated.timing(op, { toValue:0, duration:DUR*0.9, easing:Easing.in(Easing.quad), useNativeDriver:true }),
      ]),
      Animated.timing(prog, { toValue:1, duration:DUR, easing:Easing.out(Easing.quad), useNativeDriver:true }),
    ]).start(({ finished }) => { if (finished) onDone(); });
  }, []);
  const rad = (m.ang * Math.PI) / 180;
  // Trajectoire en diagonale
  const tx  = prog.interpolate({ inputRange:[0,1], outputRange:[0, Math.cos(rad)*W*0.8] });
  const ty  = prog.interpolate({ inputRange:[0,1], outputRange:[0, Math.sin(rad)*W*0.8] });
  return (
    <Animated.View style={{ position:'absolute', left:m.sx, top:m.sy, opacity:op, transform:[{translateX:tx},{translateY:ty},{rotate:`${m.ang}deg`}] }}>
      <LinearGradient colors={['rgba(255,255,255,0)','rgba(192,96,255,0.8)','#FFF']} start={{x:0,y:0.5}} end={{x:1,y:0.5}} style={{ width:m.len, height:2, borderRadius:1 }} />
      <View style={{ position:'absolute', right:0, top:-1, width:4, height:4, borderRadius:2, backgroundColor:'#fff', shadowColor:'#fff', shadowOpacity:1, shadowRadius:4 }} />
    </Animated.View>
  );
});

// Gestionnaire de météores
const MeteorManager = memo(function MeteorManager() {
  const [meteors, setMeteors] = useState<Met[]>([]);
  const nxt = useRef(0);
  useEffect(() => {
    const loop = () => {
      const timeout = setTimeout(() => {
        setMeteors(p => [...p, { id:++nxt.current, sx:rnd(0,W), sy:rnd(0,H*0.4), ang:rnd(30,60), len:rnd(100,200) }]);
        loop();
      }, rnd(4000, 10000)); // Toutes les 4 à 10s
      return timeout;
    };
    const t = loop();
    return () => clearTimeout(t);
  }, []);
  const remove = useCallback((id:number) => setMeteors(p => p.filter(m=>m.id!==id)), []);
  return <>{meteors.map(m => <ShootingStar key={m.id} m={m} onDone={()=>remove(m.id)} />)}</>;
});
MeteorManager.displayName = 'MeteorManager';

// Canvas Global
const GalaxyCanvas = memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[G.bg0,G.bg1,G.bg2,G.bg0]} locations={[0,0.3,0.7,1]} style={StyleSheet.absoluteFill} />
    { DUST.map(p => <StarDot key={`d${p.id}`} p={p} />) }
    { STARS.map(p => <StarDot key={`s${p.id}`} p={p} />) }
    { BRIGHT.map(p => <StarDot key={`b${p.id}`} p={p} bright />) }
    <MeteorManager />
  </View>
));
GalaxyCanvas.displayName = 'GalaxyCanvas';

// ═══════════════════════════════════════════════════════════════════
//  ░░░  PROFILE COMPONENTS  ░░░
// ═══════════════════════════════════════════════════════════════════

// ── Mock Data ──────────────────────────────────────────────────────
const USER = {
  name: "Noé Plantier",
  handle: "@noe_universe",
  bio: "Explorateur du cosmos numérique 🌌 | Créateur de contenu VR/AR | Ambassadeur Universe",
  stats: { followers: "12.5k", following: "482", likes: "84k" },
  avatar: "https://i.pravatar.cc/150?img=11"
};

const POSTS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  uri: `https://picsum.photos/400/600?random=${i}`,
  views: Math.floor(Math.random() * 50000)
}));

// ── Stat Item ──────────────────────────────────────────────────────
function StatBox({ label, val }: { label:string; val:string }) {
  return (
    <View style={st.box}>
      <Text style={st.val}>{val}</Text>
      <Text style={st.label}>{label}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  box:   { alignItems:'center' },
  val:   { color:'#FFF', fontSize:18, fontWeight:'700', letterSpacing:0.5 },
  label: { color:'rgba(237,232,255,0.5)', fontSize:12, marginTop:2 },
});

// ── Tabs ───────────────────────────────────────────────────────────
const TABS = ['Vidéos', 'Shorts', 'Favoris'];
function ProfileTabs({ active, onChange }: { active:string, onChange:(s:string)=>void }) {
  return (
    <View style={tb.row}>
      {TABS.map(t => {
        const isActive = active === t;
        return (
          <TouchableOpacity key={t} onPress={() => onChange(t)} style={tb.item}>
            <Text style={[tb.txt, isActive && tb.txtActive]}>{t}</Text>
            {isActive && <View style={tb.indicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const tb = StyleSheet.create({
  row: { flexDirection:'row', borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.1)', marginTop:20 },
  item: { flex:1, alignItems:'center', paddingVertical:14 },
  txt: { color:'rgba(255,255,255,0.4)', fontSize:14, fontWeight:'600', textTransform:'uppercase', letterSpacing:1 },
  txtActive: { color:'#FFF' },
  indicator: { position:'absolute', bottom:0, width:40, height:3, backgroundColor:G.primary, borderRadius:2 }
});

// ── Content Grid Item ──────────────────────────────────────────────
const GridItem = memo(({ item, style }: { item:any, style?:any }) => (
  <TouchableOpacity activeOpacity={0.8} style={[gd.item, style]}>
    <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
    <View style={gd.meta}>
      <Ionicons name="play-outline" size={12} color="#FFF" />
      <Text style={gd.views}>{(item.views/1000).toFixed(1)}k</Text>
    </View>
  </TouchableOpacity>
));

GridItem.displayName = 'GridItem';

const gd = StyleSheet.create({
  item: { width:ITEM_W, height:ITEM_W*1.3, backgroundColor:'#1A0032', marginBottom:COL_GAP, marginRight:COL_GAP },
  meta: { position:'absolute', bottom:6, left:6, flexDirection:'row', alignItems:'center', gap:4 },
  views:{ color:'#E0E0E0', fontSize:10, fontWeight:'600' }
});

// ═══════════════════════════════════════════════════════════════════
//  ░░░  MAIN SCREEN  ░░░
// ═══════════════════════════════════════════════════════════════════

export default function ProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Vidéos');
  const scrollY = useRef(new Animated.Value(0)).current;

  // Header Animation
  const headerHeight = 60;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      
      {/* 1. LAYER ONE: GALAXY BACKGROUND */}
      <GalaxyCanvas />

      {/* 2. LAYER TWO: CONTENT SCROLL */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Espacement pour le fixed header transparent */}
        <View style={{ height: 60 }} />

        {/* PROFILE HEADER INFO */}
        <View style={styles.profileSection}>
          
          {/* Avatar Ring */}
          <View style={styles.avatarContainer}>
             <LinearGradient
               colors={[G.primary, '#5A0090', G.sCy]}
               start={{x:0, y:0}} end={{x:1, y:1}}
               style={styles.avatarRing}
             >
               <View style={styles.avatarBg}>
                 <Image source={{ uri: USER.avatar }} style={styles.avatarImg} />
               </View>
             </LinearGradient>
             {/* Badge Pro */}
             <View style={styles.badge}>
               <Ionicons name="checkmark-circle" size={16} color={G.sCy} />
             </View>
          </View>

          {/* Texts */}
          <Text style={styles.name}>{USER.name}</Text>
          <Text style={styles.handle}>{USER.handle}</Text>
          
          <Text style={styles.bio}>{USER.bio}</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatBox val={USER.stats.followers} label="Abonnés" />
            <View style={styles.divider} />
            <StatBox val={USER.stats.following} label="Suivi(e)s" />
            <View style={styles.divider} />
            <StatBox val={USER.stats.likes} label="J'aime" />
          </View>

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnTxtPrimary}>Modifier le profil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]}>
              <Text style={styles.btnTxtSecondary}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnIcon]}>
              <Ionicons name="logo-instagram" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* TABS */}
        <ProfileTabs active={activeTab} onChange={setActiveTab} />

        {/* GRID */}
        <View style={styles.gridContainer}>
          {POSTS.map((p, i) => (
             <GridItem key={p.id} item={p} 
               style={{ marginRight: (i+1)%3 === 0 ? 0 : COL_GAP }} 
             />
          ))}
        </View>

      </Animated.ScrollView>

      {/* 3. LAYER THREE: FIXED HEADER */}
      <SafeAreaView style={styles.fixedHeaderSafeArea} pointerEvents="box-none">
        <View style={styles.fixedHeader}>
          {/* Glass background that fades in */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.headerGlass, { opacity: headerOpacity }]} />
          
          <View style={styles.headerRow}>
         
             <Animated.Text style={[styles.headerTitle, { opacity: headerOpacity }]}>
               {USER.handle}
             </Animated.Text>

           
          </View>
        </View>
      </SafeAreaView>

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex:1, backgroundColor:G.bg0 },
  
  // Fixed Header
  fixedHeaderSafeArea: { position:'absolute', top:0, left:0, right:0, zIndex:10 },
  fixedHeader: { height:50, justifyContent:'center' },
  headerGlass: { backgroundColor:'rgba(6,0,16,0.85)', borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.1)' },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:15, height:'100%' },
  headerTitle: { color:'#FFF', fontSize:16, fontWeight:'700' },
  iconBtn: { width:36, height:36, alignItems:'center', justifyContent:'center', borderRadius:18, backgroundColor:'rgba(255,255,255,0.1)' },

  // Profile Section
  profileSection: { alignItems:'center', paddingHorizontal:20, paddingTop:10 },
  avatarContainer: { marginBottom:15 },
  avatarRing: { width:96, height:96, borderRadius:48, alignItems:'center', justifyContent:'center' },
  avatarBg: { width:90, height:90, borderRadius:45, backgroundColor:G.bg0, alignItems:'center', justifyContent:'center' },
  avatarImg: { width:86, height:86, borderRadius:43 },
  badge: { position:'absolute', bottom:2, right:4, backgroundColor:'#FFF', borderRadius:10, padding:1 },

  name: { color:'#FFF', fontSize:22, fontWeight:'800', marginBottom:2 },
  handle: { color:G.primary, fontSize:14, fontWeight:'600', marginBottom:12 },
  bio: { color:'rgba(237,232,255,0.8)', textAlign:'center', fontSize:13, lineHeight:18, marginBottom:20, maxWidth:'90%' },

  // Stats
  statsRow: { flexDirection:'row', alignItems:'center', marginBottom:24, backgroundColor:'rgba(255,255,255,0.05)', paddingVertical:12, paddingHorizontal:30, borderRadius:16, borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
  divider: { width:1, height:24, backgroundColor:'rgba(255,255,255,0.15)', marginHorizontal:20 },

  // Buttons
  btnRow: { flexDirection:'row', alignItems:'center', gap:10, width:'100%' },
  btn: { flex:1, height:44, borderRadius:12, alignItems:'center', justifyContent:'center' },
  btnPrimary: { backgroundColor:G.primary },
  btnTxtPrimary: { color:'#FFF', fontWeight:'700', fontSize:14 },
  btnSecondary: { backgroundColor:'rgba(255,255,255,0.1)', borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  btnTxtSecondary: { color:'#FFF', fontWeight:'600', fontSize:14 },
  btnIcon: { width:44, height:44, borderRadius:12, backgroundColor:'rgba(255,255,255,0.1)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },

  // Grid
  gridContainer: { flexDirection:'row', flexWrap:'wrap', width:'100%' },
});