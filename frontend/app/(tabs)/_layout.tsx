/**
 * app/_layout.tsx — UNIVERSE · PRODUCTION-READY
 *
 * Fixes :
 *  ✅ Imports corrigés (../ au lieu de ../../)
 *  ✅ Mobile gate : production desktop uniquement, bypass ?preview=1 pour tests
 *  ✅ AuthProvider initialise la session avant le premier render des pages
 *  ✅ Stack monte IMMÉDIATEMENT (0 latence, fetch démarrent pendant le splash)
 *  ✅ Splash joué une seule fois par session JS
 *  ✅ Anti-screenshot via Modal natif (couvre toutes les pages)
 */

import {
  useEffect, useRef, useState, memo, useCallback,
} from 'react';
import {
  Animated, Dimensions, Easing, Modal, Platform,
  StyleSheet, Text, View,
} from 'react-native';
import { Stack }                  from 'expo-router';
import { StatusBar }              from 'expo-status-bar';
import * as SplashScreen          from 'expo-splash-screen';
import { LinearGradient }         from 'expo-linear-gradient';
import { Ionicons }               from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ScreenCapture         from 'expo-screen-capture';

import { AuthProvider } from '../contexts/AuthContext';
import { COLORS }       from '../constants/theme';
import CustomNavbar     from '../components/CustomNavBar';

SplashScreen.preventAutoHideAsync();

const { width: W, height: H } = Dimensions.get('window');

// ─── FLAG SESSION ─────────────────────────────────────────────────────────────
let SESSION_SPLASH_DONE = false;

// ─── DÉTECTION ENVIRONNEMENT ──────────────────────────────────────────────────
function isDeployedOrigin(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  if (h === 'localhost')         return false;
  if (h === '127.0.0.1')        return false;
  if (h.startsWith('192.168.')) return false;
  if (h.startsWith('10.'))      return false;
  if (h.startsWith('172.'))     return false;
  return true;
}

function isMobileDevice(): boolean {
  if (Platform.OS !== 'web') return true;
  if (typeof navigator === 'undefined') return true;
  return /iPhone|iPad|iPod|Android|Mobile|BlackBerry|IEMobile|Opera Mini|webOS/i
    .test(navigator.userAgent);
}

/** Bypass desktop gate : ajouter ?preview=1 dans l'URL pour tester en desktop */
function hasPreviewParam(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

const SHOULD_BLOCK_DESKTOP: boolean =
  !isMobileDevice() && isDeployedOrigin() && !hasPreviewParam();

// ─── GALAXY BG ────────────────────────────────────────────────────────────────
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const STAR_COLS = ['#F3EDFF', '#B2CCFF', '#FFE270', 'rgba(255,255,255,0.55)'];

interface StarPt { id:number; x:number; y:number; sz:number; col:string; del:number; dur:number }
interface Meteor  { id:number; sx:number; sy:number; ang:number; len:number }

const STARS: StarPt[] = Array.from({ length: 60 }, (_, i) => ({
  id: i, x: rnd(0, W), y: rnd(0, H), sz: rnd(1, 2.3),
  col: pick(STAR_COLS), del: rnd(0, 4000), dur: rnd(2000, 5500),
}));

const StarDot = memo(function StarDot({ p }: { p: StarPt }) {
  const op = useRef(new Animated.Value(0.20)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(p.del % p.dur),
      Animated.timing(op, { toValue: 0.90, duration: p.dur * 0.5, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.20, duration: p.dur * 0.5, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: p.x, top: p.y,
      width: p.sz, height: p.sz, borderRadius: p.sz / 2,
      backgroundColor: p.col, opacity: op,
    }}/>
  );
});

const ShootingStar = memo(function ShootingStar({ m, onDone }: { m: Meteor; onDone: () => void }) {
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
  const tx = prog.interpolate({ inputRange: [0,1], outputRange: [0, Math.cos(m.ang*Math.PI/180)*200] });
  const ty = prog.interpolate({ inputRange: [0,1], outputRange: [0, Math.sin(m.ang*Math.PI/180)*200] });
  return (
    <Animated.View style={{
      position: 'absolute', left: m.sx, top: m.sy, opacity: op,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${m.ang}deg` }],
    }}>
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.18)', '#fff']}
        start={{ x:0, y:0 }} end={{ x:1, y:0 }}
        style={{ width: m.len, height: 1.5, borderRadius: 1 }}
      />
    </Animated.View>
  );
});

const GalaxyBG = memo(function GalaxyBG() {
  const [meteors, setMeteors] = useState<Meteor[]>([]);
  useEffect(() => {
    const iv = setInterval(() => {
      if (Math.random() > 0.65)
        setMeteors(p => [...p, { id: Date.now(), sx: rnd(0,W), sy: rnd(0,H*0.4), ang: rnd(20,50), len: rnd(80,160) }]);
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

// ─── SESSION SPLASH ───────────────────────────────────────────────────────────
const SessionSplash = memo(function SessionSplash({ onDone }: { onDone: () => void }) {
  const fade   = useRef(new Animated.Value(0)).current;
  const logoY  = useRef(new Animated.Value(24)).current;
  const logoOp = useRef(new Animated.Value(0)).current;
  const tagOp  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade,   { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(logoY,  { toValue: 0, duration: 600, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
        Animated.timing(logoOp, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(tagOp, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(fade,  { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(logoY, { toValue: -12, duration: 500, useNativeDriver: true }),
      ]),
    ]).start(() => { SESSION_SPLASH_DONE = true; onDone(); });
  }, []);

  return (
    <Animated.View style={[sp.root, { opacity: fade }]}>
      <GalaxyBG/>
      <View style={sp.veil} pointerEvents="none"/>
      <View style={sp.center}>
        <Animated.Text style={[sp.logo, { opacity: logoOp, transform: [{ translateY: logoY }] }]}>
          UNIVERSE
        </Animated.Text>
        <Animated.Text style={[sp.tag, { opacity: tagOp }]}>
          Cinéma Indépendant
        </Animated.Text>
      </View>
    </Animated.View>
  );
});
const sp = StyleSheet.create({
  root:   { ...StyleSheet.absoluteFillObject, zIndex: 8888, alignItems: 'center', justifyContent: 'center' },
  veil:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,0,10,0.30)' },
  center: { alignItems: 'center', gap: 10 },
  logo:   { color: '#FFFFFF', fontSize: 42, fontWeight: '900', letterSpacing: 6, textTransform: 'uppercase' },
  tag:    { color: 'rgba(255,255,255,0.42)', fontSize: 13, fontWeight: '500', letterSpacing: 3 },
});

// ─── SCREENSHOT OVERLAY ───────────────────────────────────────────────────────
const ScreenshotOverlay = memo(function ScreenshotOverlay({
  visible, onDismiss,
}: { visible: boolean; onDismiss: () => void }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.84)).current;
  const lock  = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!visible) { fade.setValue(0); scale.setValue(0.84); lock.setValue(0); shake.setValue(0); return; }
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
    ]).start();
    const lt = setTimeout(() => {
      Animated.spring(lock, { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.timing(shake, { toValue: 9,  duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -9, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 5,  duration: 40, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -5, duration: 40, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0,  duration: 30, useNativeDriver: true }),
      ]).start();
    }, 80);
    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fade,  { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.88, duration: 280, useNativeDriver: true }),
      ]).start(onDismiss);
    }, 4500);
    return () => { clearTimeout(lt); clearTimeout(timer.current); };
  }, [visible]);

  const lockScale = lock.interpolate({ inputRange: [0,1], outputRange: [0.3,1] });
  const lockRot   = lock.interpolate({ inputRange: [0,1], outputRange: ['-18deg','0deg'] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <Animated.View style={[so.root, { opacity: fade }]}>
        <GalaxyBG/>
        <View style={so.veil} pointerEvents="none"/>
        <Animated.View style={[so.card, { transform: [{ scale }] }]}>
          <Animated.View style={[so.lockWrap, { transform: [{ scale: lockScale }, { rotate: lockRot }, { translateX: shake }] }]}>
            <LinearGradient colors={['rgba(255,255,255,0.13)','rgba(255,255,255,0.05)']} style={so.lockGrad} start={{ x:0,y:0 }} end={{ x:0,y:1 }}>
              <Ionicons name="lock-closed" size={42} color="#FFFFFF"/>
            </LinearGradient>
            <View style={so.lockRingOuter} pointerEvents="none"/>
          </Animated.View>
          <View style={so.badge}><View style={so.badgeDot}/><Text style={so.badgeTxt}>CAPTURE BLOQUÉE</Text></View>
          <Text style={so.title}>Capture d'écran{'\n'}impossible</Text>
          <View style={so.sep}/>
          <Text style={so.body}>Les politiques de confidentialité d'<Text style={so.appName}>Universe</Text>{' '}ne permettent pas d'effectuer de captures d'écran sur cette application.</Text>
          <Text style={so.sub}>Cette mesure protège les œuvres et les données personnelles des créateurs de cinéma indépendant.</Text>
          <View style={so.footer}><Ionicons name="shield-checkmark-outline" size={11} color="rgba(255,255,255,0.28)"/><Text style={so.footerTxt}>Politique de confidentialité Universe · Art. 3.2</Text></View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});
const so = StyleSheet.create({
  root:         { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(3,0,10,0.92)' },
  veil:         { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(3,0,10,0.60)' },
  card:         { width:W*0.86, maxWidth:360, borderRadius:26, overflow:'hidden', padding:30, alignItems:'center', backgroundColor:'rgba(255,255,255,0.055)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.13)' },
  lockWrap:     { width:88, height:88, borderRadius:44, overflow:'hidden', marginBottom:20 },
  lockGrad:     { flex:1, alignItems:'center', justifyContent:'center' },
  lockRingOuter:{ position:'absolute', top:-3, left:-3, right:-3, bottom:-3, borderRadius:47, borderWidth:1.5, borderColor:'rgba(255,255,255,0.12)' },
  badge:        { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:5, borderRadius:20, backgroundColor:'rgba(239,68,68,0.16)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(239,68,68,0.38)', marginBottom:16 },
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

// ─── MOBILE GATE ──────────────────────────────────────────────────────────────
const MobileOnlyGate = memo(function MobileOnlyGate() {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue:1, duration:600, useNativeDriver:true }).start(); }, []);
  return (
    <Animated.View style={[mg.root, { opacity: fade }]}>
      <GalaxyBG/>
      <View style={mg.veil} pointerEvents="none"/>
      <View style={mg.card}>
        <View style={mg.logoWrap}><Ionicons name="phone-portrait-outline" size={52} color="rgba(255,255,255,0.90)"/></View>
        <Text style={mg.brand}>UNIVERSE</Text>
        <Text style={mg.headline}>Application mobile</Text>
        <View style={mg.sep}/>
        <Text style={mg.body}>Universe est conçu pour une expérience mobile native.{'\n'}Téléchargez l'application depuis votre smartphone ou tablette.</Text>
        <View style={mg.storeRow}>
          <View style={mg.storeBadge}><Ionicons name="logo-apple" size={16} color="#fff"/><Text style={mg.storeTxt}>App Store</Text></View>
          <View style={mg.storeBadge}><Ionicons name="logo-google-playstore" size={16} color="#fff"/><Text style={mg.storeTxt}>Google Play</Text></View>
        </View>
        <View style={mg.footer}><Ionicons name="film-outline" size={11} color="rgba(255,255,255,0.22)"/><Text style={mg.footerTxt}>Universe · Cinéma Indépendant</Text></View>
      </View>
    </Animated.View>
  );
});
const mg = StyleSheet.create({
  root:      { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center', backgroundColor:'#03000A' },
  veil:      { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(3,0,10,0.40)' },
  card:      { width:Math.min(W*0.88,420), borderRadius:28, padding:38, alignItems:'center', backgroundColor:'rgba(255,255,255,0.05)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.10)' },
  logoWrap:  { width:90, height:90, borderRadius:28, backgroundColor:'rgba(255,255,255,0.07)', alignItems:'center', justifyContent:'center', marginBottom:20, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.12)' },
  brand:     { color:'#FFFFFF', fontSize:28, fontWeight:'900', letterSpacing:5, marginBottom:8 },
  headline:  { color:'rgba(255,255,255,0.55)', fontSize:14, fontWeight:'500', letterSpacing:1, textAlign:'center', marginBottom:24 },
  sep:       { width:40, height:1, backgroundColor:'rgba(255,255,255,0.10)', marginBottom:24 },
  body:      { color:'rgba(255,255,255,0.50)', fontSize:14, lineHeight:22, textAlign:'center', marginBottom:28 },
  storeRow:  { flexDirection:'row', gap:12, marginBottom:28 },
  storeBadge:{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:18, paddingVertical:11, borderRadius:14, backgroundColor:'rgba(255,255,255,0.09)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.18)' },
  storeTxt:  { color:'#FFFFFF', fontSize:13, fontWeight:'700' },
  footer:    { flexDirection:'row', alignItems:'center', gap:5 },
  footerTxt: { color:'rgba(255,255,255,0.22)', fontSize:11 },
});

// ─── STACK ────────────────────────────────────────────────────────────────────
const RootLayoutNav = memo(function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: COLORS.background } }}>
      <Stack.Screen name="reels" />
      <Stack.Screen name="search" />
      <Stack.Screen name="home"            options={{ animation:'fade' }} />
      <Stack.Screen name="(auth)"          options={{ animation:'fade' }} />
      <Stack.Screen name="(tabs)"          options={{ animation:'fade' }} />
      <Stack.Screen name="film/[id]"       options={{ animation:'fade' }} />
      <Stack.Screen name="user/[id]"       options={{ animation:'fade' }} />
      <Stack.Screen name="settings"        options={{ animation:'fade' }} />
      <Stack.Screen name="watchlist"       options={{ animation:'fade' }} />
      <Stack.Screen name="notifications"   options={{ animation:'fade' }} />
      <Stack.Screen name="category/[type]" options={{ animation:'fade' }} />
      <Stack.Screen name="post/[id]"       options={{ animation:'fade' }} />
      <Stack.Screen name="review/[id]"     options={{ animation:'fade' }} />
      <Stack.Screen name="reel/[id]"       options={{ animation:'fade' }} />
      <Stack.Screen name="profile/edit"    options={{ animation:'fade' }} />
      <Stack.Screen name="edit"            options={{ animation:'fade' }} />
      <Stack.Screen name="backoffice/universe-admin" options={{ animation:'fade', gestureEnabled:false }} />
    </Stack>
  );
});

// ─── ROOT LAYOUT ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [splashVisible,     setSplashVisible]     = useState(!SESSION_SPLASH_DONE);
  const [screenshotBlocked, setScreenshotBlocked] = useState(false);

  // Masque le splash natif Expo
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);

  // Screenshot prevention
  useEffect(() => {
    if (SHOULD_BLOCK_DESKTOP) return;
    let sub: { remove: () => void } | null = null;
    (async () => {
      try { await ScreenCapture.preventScreenCaptureAsync('universe-root'); } catch {}
      try { sub = ScreenCapture.addScreenshotListener(() => setScreenshotBlocked(true)); } catch {}
    })();
    if (Platform.OS === 'web') {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && ['3','4','5'].includes(e.key)))
          setScreenshotBlocked(true);
      };
      window.addEventListener('keydown', handleKey);
      return () => {
        window.removeEventListener('keydown', handleKey);
        ScreenCapture.allowScreenCaptureAsync('universe-root').catch(() => {});
        sub?.remove();
      };
    }
    return () => { ScreenCapture.allowScreenCaptureAsync('universe-root').catch(() => {}); sub?.remove(); };
  }, []);

  const onSplashDone       = useCallback(() => setSplashVisible(false), []);
  const onDismissScreenshot= useCallback(() => setScreenshotBlocked(false), []);

  // Desktop production → gate
  if (SHOULD_BLOCK_DESKTOP) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light"/>
        <MobileOnlyGate/>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="light"/>
        {/*
         * ★ Stack + CustomNavbar montent IMMÉDIATEMENT
         *   Les pages lancent leurs fetches Supabase pendant le splash
         *   → 0 latence perçue quand le splash disparaît
         */}
        <View style={rl.container}>
          <View style={rl.stack}><RootLayoutNav/></View>
          <View style={rl.navbar}><CustomNavbar/></View>
        </View>

        {/* Splash par-dessus, zIndex 8888 */}
        {splashVisible && <SessionSplash onDone={onSplashDone}/>}

        {/* Anti-screenshot via Modal natif */}
        <ScreenshotOverlay visible={screenshotBlocked} onDismiss={onDismissScreenshot}/>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const rl = StyleSheet.create({
  container: { flex:1, backgroundColor: COLORS.background },
  stack:     { flex:1 },
  navbar:    { marginTop:8 },
});