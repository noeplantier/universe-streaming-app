/**
 * app/_layout.tsx — UNIVERSE · ROOT LAYOUT · v10
 *
 * FIXES :
 * ★ NavBarWrapper simplifié — CustomNavBar gère elle-même sa disponibilité
 *   (plus de navReady flag, plus de crash useRouter)
 * ★ Zéro typeof/document/window au module-level
 * ★ expo-screen-capture via require() dynamique dans useEffect
 * ★ Overlay anti-screenshot natif uniquement (iOS détection, Android FLAG_SECURE)
 */
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Animated,
  AppState,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider }  from 'react-native-safe-area-context';
import { StatusBar }         from 'expo-status-bar';
import * as SplashScreen     from 'expo-splash-screen';
import { Ionicons }          from '@expo/vector-icons';
import { LinearGradient }    from 'expo-linear-gradient';
import { supabase }          from '@/lib/supabase';
import CustomNavBar          from '@/components/CustomNavBar';
import { ReelsUIProvider, useReelsUI } from '@/contexts/ReelsUIContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

const { width: SW, height: SH } = Dimensions.get('window');

const STARS = Array.from({ length: 80 }, (_, i) => ({
  key: i,
  x:   ((Math.sin(i * 2.399) + 1) / 2) * SW,
  y:   ((Math.cos(i * 1.618) + 1) / 2) * SH,
  r:   i % 7 === 0 ? 1.6 : i % 3 === 0 ? 0.9 : 0.5,
  op:  0.12 + (i % 8) * 0.06,
}));

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY ANTI-SCREENSHOT (natif uniquement)
// ─────────────────────────────────────────────────────────────────────────────
const ScreenshotOverlay = React.memo(function ScreenshotOverlay({
  visible,
}: { visible: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 280, useNativeDriver: true }).start(
        ({ finished }) => { if (finished) setMounted(false); },
      );
    }
  }, [visible, anim]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { zIndex: 99999, opacity: anim }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['#020810', '#070C17', '#0A1830', '#070C17']}
        locations={[0, 0.35, 0.70, 1]}
        style={StyleSheet.absoluteFill}
      />
      {STARS.map(s => (
        <View key={s.key} style={{
          position: 'absolute',
          left: s.x - s.r, top: s.y - s.r,
          width: s.r * 2, height: s.r * 2,
          borderRadius: s.r, backgroundColor: '#fff', opacity: s.op,
        }} />
      ))}
      <View style={ov.center}>
        <View style={ov.iconBox}>
          <Ionicons name="film-outline" size={36} color="rgba(255,255,255,0.68)" />
        </View>
        <Text style={ov.title}>UNIVERSE</Text>
        <Text style={ov.eyebrow}>Cinéma indépendant</Text>
        <View style={ov.divider} />
        <Text style={ov.msg}>Capture d'écran non autorisée</Text>
        <Text style={ov.sub}>
          Ce contenu est protégé par le droit d'auteur.{'\n'}
          Toute reproduction est strictement interdite.
        </Text>
        <View style={ov.badge}>
          <Ionicons name="shield-checkmark-outline" size={11} color="rgba(255,255,255,0.32)" />
          <Text style={ov.badgeTxt}>CONTENU PROTÉGÉ</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const ov = StyleSheet.create({
  center:  { flex:1, alignItems:'center', justifyContent:'center', gap:14, paddingHorizontal:44 },
  iconBox: { width:84, height:84, borderRadius:22, backgroundColor:'rgba(13,32,64,0.90)', borderWidth:1.5, borderColor:'rgba(255,255,255,0.09)', alignItems:'center', justifyContent:'center', marginBottom:4 },
  title:   { color:'#fff', fontSize:26, fontWeight:'900', letterSpacing:5, textTransform:'uppercase' },
  eyebrow: { color:'rgba(255,255,255,0.27)', fontSize:10, letterSpacing:2.5, textTransform:'uppercase', marginTop:-6 },
  divider: { width:44, height:1, backgroundColor:'rgba(255,255,255,0.08)', borderRadius:1, marginVertical:2 },
  msg:     { color:'rgba(255,255,255,0.72)', fontSize:15, fontWeight:'700', textAlign:'center', letterSpacing:-0.2 },
  sub:     { color:'rgba(255,255,255,0.26)', fontSize:11, textAlign:'center', lineHeight:17, marginTop:-2 },
  badge:   { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:13, paddingVertical:6, borderRadius:20, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.07)', backgroundColor:'rgba(255,255,255,0.03)', marginTop:6 },
  badgeTxt:{ color:'rgba(255,255,255,0.28)', fontSize:8.5, fontWeight:'800', letterSpacing:1.8, textTransform:'uppercase' },
});

// ─────────────────────────────────────────────────────────────────────────────
// HOOK ANTI-SCREENSHOT — natif uniquement, tout dans useEffect
// ─────────────────────────────────────────────────────────────────────────────
function useAntiScreenshot() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((ms = 0) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
    if (ms > 0) timerRef.current = setTimeout(() => setVisible(false), ms);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let SC: any = null;
    try { SC = require('expo-screen-capture'); } catch {}

    SC?.preventScreenCaptureAsync?.().catch(() => {});

    let screenshotSub: { remove: () => void } | null = null;
    if (SC?.addScreenshotListener) {
      try { screenshotSub = SC.addScreenshotListener(() => show(3000)); } catch {}
    }

    const appSub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') show(0);
      else if (s === 'active') hide();
    });

    return () => {
      screenshotSub?.remove();
      appSub.remove();
      SC?.allowScreenCaptureAsync?.().catch(() => {});
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show, hide]);

  // Web : l'overlay RN n'est pas rendu — géré par CSS/DOM dans useEffect séparé
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const doc = document;
    const win = window;

    const style = doc.createElement('style');
    style.setAttribute('data-universe', 'shield');
    style.textContent = [
      '* { -webkit-user-select:none!important; user-select:none!important; }',
      'input,textarea,[contenteditable]{ -webkit-user-select:text!important; user-select:text!important; }',
      'img,video,canvas{ -webkit-user-drag:none!important; pointer-events:none; }',
      'input,textarea,button,a,select{ pointer-events:auto!important; }',
    ].join('');
    doc.head.appendChild(style);

    const onContext  = (e: MouseEvent)   => e.preventDefault();
    const onKeyDown  = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && 'IJCK'.includes(e.key.toUpperCase())) || (e.metaKey && e.altKey && 'IJCK'.includes(e.key.toUpperCase()))) {
        e.preventDefault(); e.stopPropagation();
      }
    };
    const onKeyUp       = (e: KeyboardEvent) => { if (e.key === 'PrintScreen') show(2500); };
    const onVisibility  = () => { if (doc.hidden) show(0); else hide(); };
    const onBlur        = () => show(1800);
    const onFocus       = () => hide();

    doc.addEventListener('contextmenu',      onContext);
    doc.addEventListener('keydown',          onKeyDown);
    doc.addEventListener('keyup',            onKeyUp);
    doc.addEventListener('visibilitychange', onVisibility);
    win.addEventListener('blur',  onBlur);
    win.addEventListener('focus', onFocus);

    return () => {
      doc.removeEventListener('contextmenu',      onContext);
      doc.removeEventListener('keydown',          onKeyDown);
      doc.removeEventListener('keyup',            onKeyUp);
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('blur',  onBlur);
      win.removeEventListener('focus', onFocus);
      try { doc.head.removeChild(style); } catch {}
    };
  }, [show, hide]);

  return Platform.OS !== 'web' && visible;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth guard
// ─────────────────────────────────────────────────────────────────────────────
function useAuthGuard(ready: boolean) {
  const router   = useRouter();
  const segments = useSegments();
  useEffect(() => {
    if (!ready) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const inAuth = segments[0] === '(auth)' || segments[0] === 'login';
      if (!session && !inAuth) {
        // router.replace('/login');
      }
    });
  }, [ready, segments]);
}

// ─────────────────────────────────────────────────────────────────────────────
// NavBarWrapper
// ─────────────────────────────────────────────────────────────────────────────
function NavBarWrapper() {
  const { navBarOpacity, uiVisible, restoreNavBar } = useReelsUI();
  const pathname   = usePathname();
  const wasOnReels = useRef(false);

  const isReels =
    pathname === '/reels' ||
    pathname === '/(tabs)/reels' ||
    pathname.endsWith('/reels');

  useEffect(() => {
    if (!isReels && wasOnReels.current) restoreNavBar();
    wasOnReels.current = isReels;
  }, [isReels, restoreNavBar]);

  // Hors /reels → View normale, opacity 1, toujours visible + cliquable
  if (!isReels) {
    return (
      <View style={lay.nav}>
        <CustomNavBar />
      </View>
    );
  }

  // Sur /reels → opacity + pointerEvents animés par le contexte
  return (
    <Animated.View
      style={[lay.nav, { opacity: navBarOpacity }]}
      pointerEvents={uiVisible ? 'box-none' : 'none'}
    >
      <CustomNavBar />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RootLayout
// ─────────────────────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const screenshotVisible = useAntiScreenshot();
  useAuthGuard(ready);

  useEffect(() => {
    supabase.auth.getSession()
      .then(() => { setReady(true); SplashScreen.hideAsync().catch(() => {}); })
      .catch(() => { setReady(true); SplashScreen.hideAsync().catch(() => {}); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <ReelsUIProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />

        <Stack
          screenOptions={{
            headerShown:      false,
            contentStyle:     { backgroundColor: '#070C17' },
            animation:        Platform.OS === 'ios' ? 'default' : 'fade',
            gestureEnabled:   true,
            gestureDirection: 'horizontal',
          }}
        >
          <Stack.Screen name="(tabs)"    options={{ headerShown: false }} />
          <Stack.Screen name="film/[id]" options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
          <Stack.Screen name="reel/[id]" options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
          <Stack.Screen name="edit"      options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
          <Stack.Screen name="review/[id]"            options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }} />
          <Stack.Screen name="notifications"          options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }} />
          <Stack.Screen name="settings"               options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }} />
          <Stack.Screen name="user/[id]"              options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }} />
          <Stack.Screen name="backoffice/universe-admin" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="+not-found" options={{ title: 'Page introuvable' }} />
        </Stack>

        {/* NavBar — toujours visible hors /reels, disparaît après 4s sur /reels */}
        <NavBarWrapper />

        {/* Overlay anti-screenshot — natif uniquement */}
        <ScreenshotOverlay visible={screenshotVisible} />

      </SafeAreaProvider>
    </ReelsUIProvider>
  );
}

const lay = StyleSheet.create({
  nav: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
});