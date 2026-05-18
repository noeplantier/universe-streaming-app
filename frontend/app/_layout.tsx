import { useEffect, useRef, useState, memo } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { Stack }              from 'expo-router';
import { StatusBar }          from 'expo-status-bar';
import { LinearGradient }     from 'expo-linear-gradient';
import { Ionicons }           from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ScreenCapture     from 'expo-screen-capture';

import { AuthProvider }       from '../contexts/AuthContext';
import { COLORS }             from '../constants/theme';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// GALAXY BACKGROUND (standalone, pas d'import externe pour éviter tout cycle)
// ─────────────────────────────────────────────────────────────────────────────
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const STAR_COLS = ['#F3EDFF', '#B2CCFF', '#FFE270', 'rgba(255,255,255,0.55)'];

interface StarPt { id:number; x:number; y:number; sz:number; col:string; del:number; dur:number }
interface Meteor { id:number; sx:number; sy:number; ang:number; len:number }

const STARS: StarPt[] = Array.from({ length: 60 }, (_, i) => ({
  id:i, x:rnd(0,W), y:rnd(0,H), sz:rnd(1,2.3),
  col:pick(STAR_COLS), del:rnd(0,4000), dur:rnd(2000,5500),
}));

const StarDot = memo(function StarDot({ p }: { p: StarPt }) {
  const op = useRef(new Animated.Value(0.20)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(p.del % p.dur),
      Animated.timing(op, { toValue:0.90, duration:p.dur*0.5, useNativeDriver:true }),
      Animated.timing(op, { toValue:0.20, duration:p.dur*0.5, useNativeDriver:true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      position:'absolute', left:p.x, top:p.y,
      width:p.sz, height:p.sz, borderRadius:p.sz/2,
      backgroundColor:p.col, opacity:op,
    }}/>
  );
});

const ShootingStar = memo(function ShootingStar({ m, onDone }: { m:Meteor; onDone:()=>void }) {
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
  }, []);
  const tx = prog.interpolate({ inputRange:[0,1], outputRange:[0, Math.cos(m.ang*Math.PI/180)*200] });
  const ty = prog.interpolate({ inputRange:[0,1], outputRange:[0, Math.sin(m.ang*Math.PI/180)*200] });
  return (
    <Animated.View style={{
      position:'absolute', left:m.sx, top:m.sy,
      opacity:op, transform:[{translateX:tx},{translateY:ty},{rotate:`${m.ang}deg`}],
    }}>
      <LinearGradient
        colors={['transparent','rgba(255,255,255,0.18)','#fff']}
        start={{x:0,y:0}} end={{x:1,y:0}}
        style={{ width:m.len, height:1.5, borderRadius:1 }}
      />
    </Animated.View>
  );
});

const GalaxyBG = memo(function GalaxyBG() {
  const [meteors, setMeteors] = useState<Meteor[]>([]);
  useEffect(() => {
    const iv = setInterval(() => {
      if (Math.random() > 0.65)
        setMeteors(m => [...m, { id:Date.now(), sx:rnd(0,W), sy:rnd(0,H*0.4), ang:rnd(20,50), len:rnd(80,160) }]);
    }, 2200);
    return () => clearInterval(iv);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#03000A','#060F1E','#0D0A20']} style={StyleSheet.absoluteFill}/>
      {STARS.map(s => <StarDot key={s.id} p={s}/>)}
      {meteors.map(m => <ShootingStar key={m.id} m={m} onDone={() => setMeteors(p => p.filter(x => x.id !== m.id))}/>)}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ SCREENSHOT BLOCKED OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
const OVERLAY_MS = 4500;
const FADE_MS    = 300;

const ScreenshotOverlay = memo(function ScreenshotOverlay({
  visible, onDismiss,
}: { visible:boolean; onDismiss:()=>void }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.84)).current;
  const lock  = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Entrée
      Animated.parallel([
        Animated.timing(fade,  { toValue:1, duration:FADE_MS, useNativeDriver:true }),
        Animated.spring(scale, { toValue:1, tension:80, friction:9, useNativeDriver:true }),
      ]).start();

      // Cadenas + secousse
      setTimeout(() => {
        Animated.spring(lock, { toValue:1, tension:120, friction:7, useNativeDriver:true }).start();
        Animated.sequence([
          Animated.timing(shake, { toValue:9,  duration:50, useNativeDriver:true }),
          Animated.timing(shake, { toValue:-9, duration:50, useNativeDriver:true }),
          Animated.timing(shake, { toValue:5,  duration:40, useNativeDriver:true }),
          Animated.timing(shake, { toValue:-5, duration:40, useNativeDriver:true }),
          Animated.timing(shake, { toValue:0,  duration:30, useNativeDriver:true }),
        ]).start();
      }, 100);

      // Auto-dismiss
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fade,  { toValue:0, duration:FADE_MS, useNativeDriver:true }),
          Animated.timing(scale, { toValue:0.88, duration:FADE_MS, useNativeDriver:true }),
        ]).start(onDismiss);
      }, OVERLAY_MS);

      return () => clearTimeout(t);
    } else {
      fade.setValue(0); scale.setValue(0.84);
      lock.setValue(0); shake.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const lockScale = lock.interpolate({ inputRange:[0,1], outputRange:[0.3,1] });
  const lockRot   = lock.interpolate({ inputRange:[0,1], outputRange:['-18deg','0deg'] });

  return (
    <Animated.View style={[so.root, { opacity:fade }]}>
      <GalaxyBG/>
      {/* Voile sombre par-dessus les étoiles */}
      <View style={so.veil} pointerEvents="none"/>

      <Animated.View style={[so.card, { transform:[{ scale }] }]}>

        {/* Cadenas animé */}
        <Animated.View style={[so.lockWrap, {
          transform:[{ scale:lockScale }, { rotate:lockRot }, { translateX:shake }],
        }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.13)','rgba(255,255,255,0.05)']}
            style={so.lockGrad}
            start={{x:0,y:0}} end={{x:0,y:1}}
          >
            <Ionicons name="lock-closed" size={42} color="#FFFFFF"/>
          </LinearGradient>
          <View style={so.lockRingOuter} pointerEvents="none"/>
        </Animated.View>

        {/* Badge rouge */}
        <View style={so.badge}>
          <View style={so.badgeDot}/>
          <Text style={so.badgeTxt}>CAPTURE BLOQUÉE</Text>
        </View>

        {/* Titre */}
        <Text style={so.title}>Capture d'écran{'\n'}impossible</Text>

        {/* Séparateur */}
        <View style={so.sep}/>

        {/* Corps */}
        <Text style={so.body}>
          Les politiques de confidentialité d'
          <Text style={so.appName}>Universe</Text>
          {' '}ne permettent pas d'effectuer de captures d'écran ou d'enregistrements d'écran sur cette application.
        </Text>
        <Text style={so.sub}>
          Cette mesure protège les œuvres et les données personnelles des créateurs de cinéma indépendant.
        </Text>

        {/* Footer légal */}
        <View style={so.footer}>
          <Ionicons name="shield-checkmark-outline" size={11} color="rgba(255,255,255,0.28)"/>
          <Text style={so.footerTxt}>Politique de confidentialité Universe · Art. 3.2</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
});

const so = StyleSheet.create({
  root:         { ...StyleSheet.absoluteFillObject, zIndex:9999, alignItems:'center', justifyContent:'center' },
  veil:         { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(3,0,10,0.60)' },
  card:         {
    width:W*0.86, maxWidth:360, borderRadius:26, overflow:'hidden',
    padding:30, alignItems:'center',
    backgroundColor:'rgba(255,255,255,0.055)',
    borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.13)',
  },
  lockWrap:     { width:88, height:88, borderRadius:44, overflow:'hidden', marginBottom:20 },
  lockGrad:     { flex:1, alignItems:'center', justifyContent:'center' },
  lockRingOuter:{ position:'absolute', top:-3, left:-3, right:-3, bottom:-3, borderRadius:47, borderWidth:1.5, borderColor:'rgba(255,255,255,0.12)' },
  badge:        {
    flexDirection:'row', alignItems:'center', gap:6,
    paddingHorizontal:12, paddingVertical:5, borderRadius:20,
    backgroundColor:'rgba(239,68,68,0.16)',
    borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(239,68,68,0.38)',
    marginBottom:16,
  },
  badgeDot:     { width:6, height:6, borderRadius:3, backgroundColor:'#EF4444' },
  badgeTxt:     { color:'#EF4444', fontSize:10, fontWeight:'800', letterSpacing:1.2 },
  title:        { color:'#FFFFFF', fontSize:23, fontWeight:'900', textAlign:'center', lineHeight:29, letterSpacing:-0.4, marginBottom:18 },
  sep:          { width:38, height:1, backgroundColor:'rgba(255,255,255,0.11)', marginBottom:18 },
  body:         { color:'rgba(255,255,255,0.62)', fontSize:14, lineHeight:22, textAlign:'center', marginBottom:10 },
  appName:      { color:'#FFFFFF', fontWeight:'700' },
  sub:          { color:'rgba(255,255,255,0.35)', fontSize:12, lineHeight:18, textAlign:'center', marginBottom:22 },
  footer:       { flexDirection:'row', alignItems:'center', gap:5 },
  footerTxt:    { color:'rgba(255,255,255,0.24)', fontSize:10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROOT NAV — structure originale conservée intégralement
// ─────────────────────────────────────────────────────────────────────────────
function RootLayoutNav() {
  return (
    <Stack screenOptions={{
      headerShown:   false,
      contentStyle:  { backgroundColor: COLORS.background },
    }}>
      {/* ── Écrans existants — inchangés ── */}
      <Stack.Screen name="reels" />
      <Stack.Screen name="search" />
      <Stack.Screen name="home"           options={{ animation:'fade' }} />
      <Stack.Screen name="(auth)"         options={{ animation:'fade' }} />
      <Stack.Screen name="(tabs)"         options={{ animation:'fade' }} />
      <Stack.Screen name="film/[id]"      options={{ animation:'slide_from_right' }} />
      <Stack.Screen name="user/[id]"      options={{ animation:'slide_from_right' }} />
      <Stack.Screen name="settings"       options={{ animation:'slide_from_right' }} />
      <Stack.Screen name="watchlist"      options={{ animation:'slide_from_right' }} />
      <Stack.Screen name="notifications"  options={{ animation:'slide_from_right' }} />
      <Stack.Screen name="category/[type]"options={{ animation:'slide_from_right' }} />
      <Stack.Screen name="post/[id]"      options={{ animation:'slide_from_right' }} />

      {/* ── Nouveaux écrans Universe ── */}
      <Stack.Screen name="review/[id]"               options={{ animation:'slide_from_right' }} />
      <Stack.Screen name="reel/[id]"                 options={{ animation:'slide_from_right' }} />
      <Stack.Screen name="profile/edit"              options={{ animation:'slide_from_bottom' }} />
      <Stack.Screen name="backoffice/universe-admin" options={{ animation:'slide_from_bottom', gestureEnabled:false }} />
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [screenshotBlocked, setScreenshotBlocked] = useState(false);

  // ★ Screenshot prevention — monte une seule fois
  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    (async () => {
      // Android : empêche physiquement la capture (écran noir côté OS)
      // iOS     : ne peut pas bloquer → on détecte et on affiche l'overlay
      try {
        await ScreenCapture.preventScreenCaptureAsync('universe-root');
      } catch {}

      // Listener pour iOS (et certains Android qui passent malgré le flag)
      try {
        sub = ScreenCapture.addScreenshotListener(() => {
          setScreenshotBlocked(true);
        });
      } catch {}
    })();

    return () => {
      ScreenCapture.allowScreenCaptureAsync('universe-root').catch(() => {});
      sub?.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex:1 }}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootLayoutNav />

        {/* ★ Overlay anti-screenshot — z-index 9999, au-dessus de tout */}
        <ScreenshotOverlay
          visible={screenshotBlocked}
          onDismiss={() => setScreenshotBlocked(false)}
        />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}