// ═══════════════════════════════════════════════════════════════════
//  social.tsx — UNIVERSE  /  Communauté & Débats
//  ─────────────────────────────────────────────────────────────────
//  Réseau social dédié au cinéma indépendant.
//  Base graphique : Galaxy System (identique Search).
//  Performance : Animated FlatList + Memoization.
// ═══════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useMemo,
  useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TextInput, Animated, Easing, Dimensions, ActivityIndicator,
  StatusBar, FlatList, RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import { SPACING, RADIUS, COLORS } from '../../constants/theme';
import { postsAPI } from '../../services/api'; // Assurez-vous d'avoir ce service ou simulez-le

const { width: W, height: H } = Dimensions.get('window');

// ─── Constants ─────────────────────────────────────────────────────
const EDGE      = SPACING.screenEdge ?? 18;
const AVATAR_SZ = 44;

// ─── Palette Galaxy (Identique Search) ─────────────────────────────
const G = {
  bg0: '#060010',  bg1: '#0A001E',  bg2: '#070014',
  neb0: 'rgba(108,16,195,0.32)', neb1: 'rgba(172,24,160,0.20)',
  neb2: 'rgba(22, 14,185,0.16)', neb3: 'rgba(55,  0, 95,0.26)',
  sW: '#F3EDFF',  sB: '#B2CCFF',
  sG: '#FFE270',  sP: '#CF98FF',  sCy: '#86EEFF',
  glass: 'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
  primary: '#C060FF',
};

// ─── Badges Rôles ──────────────────────────────────────────────────
const ROLES: Record<string, { label:string; color:string; bg:string }> = {
  director: { label:'PROD',      color:'#FFD60A', bg:'rgba(255,214,10,0.15)' },
  critic:   { label:'CRITIQUE',  color:'#86EEFF', bg:'rgba(134,238,255,0.15)' },
  dop:      { label:'IMAGE',     color:'#CF98FF', bg:'rgba(207,152,255,0.15)' },
  viewer:   { label:'',          color:'transparent', bg:'transparent' },
};

// ═══════════════════════════════════════════════════════════════════
//  ░░░  GALAXY ANIMATION ENGINE (Portage Intégral)  ░░░
// ═══════════════════════════════════════════════════════════════════

const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface Pt  { id:number; x:number; y:number; sz:number; col:string; del:number; dur:number; mn:number; mx:number; }
interface Met { id:number; sx:number; sy:number; ang:number; len:number; }

// Génération statique
const STARS: Pt[] = Array.from({ length: 50 }, (_, i) => ({
  id:i, x:rnd(0,W), y:rnd(0,H*1.5), sz:rnd(1.0,2.3),
  col:pick([G.sW,G.sB,G.sP,G.sG]), del:rnd(0,4200), dur:rnd(2000,5000), mn:0.25, mx:0.95,
}));

// Composant Étoile
const StarDot = memo(({ p }: { p:Pt }) => {
  const op = useRef(new Animated.Value(p.mn)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(p.del % p.dur),
      Animated.timing(op, { toValue:p.mx, duration:p.dur*0.5, useNativeDriver:true }),
      Animated.timing(op, { toValue:p.mn, duration:p.dur*0.5, useNativeDriver:true }),
    ])).start();
  }, []); // eslint-disable-line
  return <Animated.View style={{ position:'absolute', left:p.x, top:p.y, width:p.sz, height:p.sz, borderRadius:p.sz, backgroundColor:p.col, opacity:op }} />;
});
StarDot.displayName = 'StarDot';

// Composant Météore
const ShootingStar = memo(({ m, onDone }: { m:Met; onDone:()=>void }) => {
  const prog = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(op, { toValue:1, duration:100, useNativeDriver:true }),
        Animated.timing(op, { toValue:0, duration:500, delay:200, useNativeDriver:true }),
      ]),
      Animated.timing(prog, { toValue:1, duration:800, easing:Easing.out(Easing.quad), useNativeDriver:true }),
    ]).start(onDone);
  }, []); // eslint-disable-line
  const tx = prog.interpolate({ inputRange:[0,1], outputRange:[0, Math.cos(m.ang*Math.PI/180)*200] });
  const ty = prog.interpolate({ inputRange:[0,1], outputRange:[0, Math.sin(m.ang*Math.PI/180)*200] });
  return (
    <Animated.View style={{ position:'absolute', left:m.sx, top:m.sy, opacity:op, transform:[{translateX:tx},{translateY:ty},{rotate:`${m.ang}deg`}] }}>
      <LinearGradient colors={['rgba(255,255,255,0)','rgba(175,110,255,0.8)','#fff']} start={{x:0,y:0}} end={{x:1,y:0}} style={{width:m.len,height:2,borderRadius:1}} />
    </Animated.View>
  );
});
ShootingStar.displayName = 'ShootingStar';

// Gestionnaire Météores
const GalaxyBackground = memo(() => {
  const [meteors, setMeteors] = useState<Met[]>([]);
  useEffect(() => {
    const i = setInterval(() => {
      if(Math.random()>0.7) setMeteors(m => [...m, { id:Date.now(), sx:rnd(0,W), sy:rnd(0,H*0.4), ang:rnd(20,50), len:rnd(80,150) }]);
    }, 2000);
    return () => clearInterval(i);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[G.bg0,G.bg1,G.bg2]} style={StyleSheet.absoluteFill} />
      {STARS.map(s => <StarDot key={s.id} p={s} />)}
      {meteors.map(m => <ShootingStar key={m.id} m={m} onDone={()=>setMeteors(prev=>prev.filter(x=>x.id!==m.id))} />)}
    </View>
  );
});
GalaxyBackground.displayName = 'GalaxyBackground';

// ═══════════════════════════════════════════════════════════════════
//  ░░░  COMPOSANTS UI  ░░░
// ═══════════════════════════════════════════════════════════════════

// ─── Header Principal ──────────────────────────────────────────────
const SocialHeader = memo(() => (
  <View style={h.row}>
    <View>
      <Text style={h.title}>Communauté</Text>
      <Text style={h.sub}>Le QG du cinéma indé</Text>
    </View>
   
  </View>
));
SocialHeader.displayName = 'SocialHeader';

const h = StyleSheet.create({
  row: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:EDGE, paddingTop:10, paddingBottom:16 },
  title: { fontSize:28, fontWeight:'800', color:G.sW, letterSpacing:-0.5 },
  sub: { fontSize:12, color:G.sB, opacity:0.6, marginTop:2 },
  actions: { flexDirection:'row', gap:10 },
  btn: { width:40, height:40, borderRadius:20, bg:G.glass, borderWidth:1, borderColor:G.glassBorder, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(255,255,255,0.06)' },
  dot: { position:'absolute', top:10, right:10, width:8, height:8, borderRadius:4, backgroundColor:'#FF3B30', borderWidth:1.5, borderColor:G.bg1 },
});



const cp = StyleSheet.create({
  wrap: { flexDirection:'row', paddingHorizontal:EDGE, gap:12, marginBottom:20, alignItems:'center' },
  avi: { width:42, height:42, borderRadius:21, borderWidth:1, borderColor:'rgba(255,255,255,0.2)' },
  box: { flex:1, height:44, borderRadius:22, backgroundColor:G.glass, borderWidth:1, borderColor:G.glassBorder, flexDirection:'row', alignItems:'center', paddingHorizontal:16, justifyContent:'space-between' },
  ph: { color:'rgba(237,232,255,0.4)', fontSize:14 },
});

// ─── Tabs Filtres ──────────────────────────────────────────────────
const TABS = ['Pour vous', 'Abonnements', 'Tendances'];
function FilterTabs({ active, set }: { active:string; set:(a:string)=>void }) {
  return (
    <View style={ft.row}>
      {TABS.map(t => {
        const on = active===t;
        return (
          <TouchableOpacity key={t} onPress={()=>set(t)} style={[ft.pill, on && ft.pillOn]}>
            <Text style={[ft.txt, on && ft.txtOn]}>{t}</Text>
            {on && <View style={ft.line} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:G.bg0 },
});
const ft = StyleSheet.create({
  row: { flexDirection:'row', paddingHorizontal:EDGE, gap:20, marginBottom:8, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.1)', paddingBottom:0 },
  pill: { paddingBottom:14, alignItems:'center' },
  pillOn: {},
  txt: { color:'rgba(237,232,255,0.5)', fontSize:15, fontWeight:'600' },
  txtOn: { color:G.sW, fontWeight:'700' },
  line: { position:'absolute', bottom:0, width:'100%', height:2, backgroundColor:G.primary, borderRadius:2 },
});

// ─── Carte de Post (The Core) ──────────────────────────────────────
interface PostData {
  id:string; user:{name:string; handle:string; avi:string; role:string};
  content:string; time:string; likes:number; comments:number; film?:{title:string; poster:string; year:string};
}

const PostCard = memo(({ post }: { post:PostData }) => {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const toggleLike = () => {
    setLiked(!liked);
    Animated.sequence([
      Animated.spring(scale, { toValue:1.2, useNativeDriver:true, speed:50 }),
      Animated.spring(scale, { toValue:1, useNativeDriver:true, speed:50 }),
    ]).start();
  };

  const role = ROLES[post.user.role] || ROLES.viewer;

  return (
    <View style={pc.root}>
      {/* Header User */}
      <View style={pc.head}>
        <Image source={{ uri:post.user.avi }} style={pc.avi} />
        <View style={{flex:1}}>
          <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
            <Text style={pc.name}>{post.user.name}</Text>
            {role.label !== '' && (
              <View style={[pc.badge, { backgroundColor:role.bg }]}>
                <Text style={[pc.badgeTxt, { color:role.color }]}>{role.label}</Text>
              </View>
            )}
            <Text style={pc.handle}>@{post.user.handle} • {post.time}</Text>
          </View>
        </View>
        <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.4)" />
      </View>

      {/* Content */}
      <Text style={pc.content}>{post.content}</Text>

      {/* Embedded Film (Optional) */}
      {post.film && (
        <TouchableOpacity style={pc.filmEmbed} activeOpacity={0.9} onPress={()=>router.push(`/film/1`)}>
          <Image source={{ uri:post.film.poster }} style={pc.filmPoster} />
          <View style={pc.filmInfo}>
            <Text style={pc.filmTitle}>{post.film.title}</Text>
            <Text style={pc.filmMeta}>Film • {post.film.year}</Text>
            <View style={pc.watchBtn}>
              <Ionicons name="play" size={10} color="#000" />
              <Text style={pc.watchTxt}>Voir</Text>
            </View>
          </View>
          <View style={pc.blurBg} />
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={pc.actions}>
        <TouchableOpacity style={pc.actBtn} onPress={toggleLike}>
          <Animated.View style={{ transform:[{scale}] }}>
            <Ionicons name={liked?"heart":"heart-outline"} size={20} color={liked?"#FF453A":"rgba(237,232,255,0.5)"} />
          </Animated.View>
          <Text style={[pc.actTxt, liked&&{color:'#FF453A'}]}>{post.likes + (liked?1:0)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pc.actBtn}>
          <Ionicons name="chatbubble-outline" size={19} color="rgba(237,232,255,0.5)" />
        </TouchableOpacity>
        <TouchableOpacity style={pc.actBtn}>
          <Ionicons name="share-social-outline" size={19} color="rgba(237,232,255,0.5)" />
        </TouchableOpacity>
      </View>
    </View>
  );
});
PostCard.displayName = 'PostCard';


const pc = StyleSheet.create({
  root: { padding:EDGE, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' },
  head: { flexDirection:'row', gap:10, marginBottom:8 },
  avi:  { width:AVATAR_SZ, height:AVATAR_SZ, borderRadius:AVATAR_SZ/2, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  name: { color:G.sW, fontWeight:'700', fontSize:15 },
  handle:{ color:'rgba(237,232,255,0.4)', fontSize:12 },
  badge: { paddingHorizontal:5, paddingVertical:2, borderRadius:4 },
  badgeTxt:{ fontSize:9, fontWeight:'800' },
  content:{ color:'rgba(237,232,255,0.9)', fontSize:15, lineHeight:22, marginBottom:12 },
  
  // Film Embed
  filmEmbed: { flexDirection:'row', height:80, borderRadius:12, overflow:'hidden', backgroundColor:'rgba(255,255,255,0.03)', borderWidth:1, borderColor:'rgba(255,255,255,0.08)', marginBottom:12 },
  filmPoster:{ width:56, height:'100%', resizeMode:'cover' },
  filmInfo:  { flex:1, padding:10, justifyContent:'center' },
  filmTitle: { color:'#fff', fontWeight:'700', fontSize:14 },
  filmMeta:  { color:'rgba(255,255,255,0.5)', fontSize:11, marginTop:2, marginBottom:6 },
  watchBtn:  { flexDirection:'row', alignItems:'center', backgroundColor:G.sG, paddingHorizontal:8, paddingVertical:3, borderRadius:99, alignSelf:'flex-start', gap:3 },
  watchTxt:  { fontSize:10, fontWeight:'700', color:'#000' },
  blurBg:    { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.3)', zIndex:-1 },

  // Actions
  actions: { flexDirection:'row', justifyContent:'space-between', paddingRight:40, marginTop:4 },
  actBtn:  { flexDirection:'row', alignItems:'center', gap:6 },
  actTxt:  { color:'rgba(237,232,255,0.5)', fontSize:13 },
});

// ═══════════════════════════════════════════════════════════════════
//  ░░░  ECRAN PRINCIPAL  ░░░
// ═══════════════════════════════════════════════════════════════════

export default function SocialScreen() {
  const [tab, setTab] = useState('Pour vous');
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<PostData[]>([]);

  // Simulation Data Load
  const loadPosts = useCallback(() => {
    // Fake API delays
    setTimeout(() => {
      setPosts([
        {
          id:'1', user:{name:'Nolan R.', handle:'cinenolan', avi:'https://i.pravatar.cc/150?u=a042581f4e29026024d', role:'director'},
          content:'La photographie dans "The Lighthouse" est une masterclass de contraste. Le ration 1.19:1 enferme littéralement les personnages. Des avis ? 🎥',
          time:'2h', likes:1240, comments:85,
          film:{title:'The Lighthouse', poster:'https://image.tmdb.org/t/p/w200/3nk9UoepYmv1G9oP18q6JJCeYMB.jpg', year:'2019'}
        },
        {
          id:'2', user:{name:'Sarah K.', handle:'sarah_cuts', avi:'https://i.pravatar.cc/150?u=a042581f4e29026704d', role:'critic'},
          content:'Je reviens de Cannes. Le cinéma coréen est encore en train de redéfinir les codes du thriller. Incroyable énergie.',
          time:'4h', likes:856, comments:42
        },
        {
          id:'3', user:{name:'Marc D.', handle:'marcdop', avi:'https://i.pravatar.cc/150?u=a04258114e29026302d', role:'dop'},
          content:'Petit thread sur l’utilisation des lentilles anamorphiques chez Wes Anderson 👇',
          time:'5h', likes:2100, comments:120,
          film:{title:'Asteroid City', poster:'https://image.tmdb.org/t/p/w200/qfgysK1I5s2m86e1hQY6k3qK5q8.jpg', year:'2023'}
        },
        {

          id:'4', user:{name:'Julie M.', handle:'julie_viewer', avi:'https://i.pravatar.cc/150?u=a042581f4e29026502d', role:'viewer'},
          content:'Quelqu’un a vu le dernier film de Céline Sciamma ? J’ai adoré la narration visuelle, c’est du grand art.',
          time:'6h', likes:430, comments:18,
          film:{title:'Petite Maman', poster:'https://image.tmdb.org/t/p/w200/8jHqvXnXlG9Z2nQeBzZtXjYp5s.jpg', year:'2021'}
        },
        {
          id:'5', user:{name:'Alex P.', handle:'alexcinephile', avi:'https://i.pravatar.cc/150?u=a042581f4e29026102d', role:'viewer'},
          content:'Thread : les meilleurs films de science-fiction des 20 dernières années. Prêts ? 🚀',
          time:'8h', likes:980, comments:60,
          film:{title:'Ex Machina', poster:'https://image.tmdb.org/t/p/w200/4yFoXqD3qL2aYpUjYlFvQ9r5sA.jpg', year:'2014'}
        },
        {
          id:'6', user:{name:'Emma L.', handle:'emma_cinephile', avi:'https://i.pravatar.cc/150?u=a042581f4e29026602d', role:'viewer'},
          content:'Je viens de découvrir "The Farewell" de Lulu Wang. Un mélange parfait d’humour et d’émotion. À voir absolument !',
          time:'10h', likes:670, comments:30,
          film:{title:'The Farewell', poster:'https://image.tmdb.org/t/p/w200/1E5aYlXq8bLzjH2rjZt9l7sK3.jpg', year:'2019'}
        }
      ]);
      setRefreshing(false);
    }, 1000);
  }, []);

  useEffect(() => { loadPosts(); }, []);

  const onRefresh = () => { setRefreshing(true); loadPosts(); };

  // Scroll Sync
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <GalaxyBackground />

      <SafeAreaView style={{flex:1}} edges={['top']}>
        {/* En-tête Fixe */}
        <SocialHeader />

        {/* Liste Feed */}
        <Animated.FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={{ paddingBottom:100 }}
          onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:false})}
          
          ListHeaderComponent={
            <View>
              <FilterTabs active={tab} set={setTab} />
            </View>
          }

         
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={G.primary} titleColor={G.primary} />
          }
        />
      </SafeAreaView>
    </View>
  );
}


