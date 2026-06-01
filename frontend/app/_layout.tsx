/**
 * app/_layout.tsx — UNIVERSE · ROOT LAYOUT · v9
 *
 * ★ Overlay anti-screenshot RETIRÉ du web ici
 *   → géré exclusivement par la couche app.json / service worker
 * ★ Natif uniquement : FLAG_SECURE Android + détection iOS
 * ★ NavBar toujours visible, animée uniquement sur /reels
 * ★ Zéro typeof/document/window au module-level → plus de SyntaxError SSR
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

// Étoiles pré-calculées — aucun typeof, aucun window ici
const STARS = Array.from({ length: 80 }, (_, i) => ({
  key: i,
  x:   ((Math.sin(i * 2.399) + 1) / 2) * SW,
  y:   ((Math.cos(i * 1.618) + 1) / 2) * SH,
  r:   i % 7 === 0 ? 1.6 : i % 3 === 0 ? 0.9 : 0.5,
  op:  0.12 + (i % 8) * 0.06,
}));

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY UNIVERSE (natif seulement — non rendu sur web)
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
      <View style={{
        position: 'absolute', top: SH * 0.1, left: -SW * 0.25,
        width: SW * 1.5, height: SH * 0.45, borderRadius: SW,
        backgroundColor: 'rgba(80,120,220,0.04)',
      }} />
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
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingHorizontal: 44,
  },
  iconBox: {
    width: 84, height: 84, borderRadius: 22,
    backgroundColor: 'rgba(13,32,64,0.90)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title:   { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 5, textTransform: 'uppercase' },
  eyebrow: { color: 'rgba(255,255,255,0.27)', fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', marginTop: -6 },
  divider: { width: 44, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 1, marginVertical: 2 },
  msg:     { color: 'rgba(255,255,255,0.72)', fontSize: 15, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2 },
  sub:     { color: 'rgba(255,255,255,0.26)', fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: -2 },
  badge:   {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)', marginTop: 6,
  },
  badgeTxt: { color: 'rgba(255,255,255,0.28)', fontSize: 8.5, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase' },
});

// ─────────────────────────────────────────────────────────────────────────────
// HOOK ANTI-SCREENSHOT — NATIF UNIQUEMENT
// Web : géré séparément (voir instructions client ci-dessous)
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
    // Web → rien à faire ici (pas d'overlay RN sur web, pas de SyntaxError)
    if (Platform.OS === 'web') return;

    // require() dynamique dans useEffect — jamais évalué par Node.js SSR
    let SC: any = null;
    try { SC = require('expo-screen-capture'); } catch {}

    // Android : FLAG_SECURE → capture = image noire (bloqué au niveau OS)
    // iOS     : écran noir dans AirPlay/QuickTime/preview
    SC?.preventScreenCaptureAsync?.().catch(() => {});

    // iOS : détecte la capture (Power + Volume) → overlay 3 s
    let screenshotSub: { remove: () => void } | null = null;
    if (SC?.addScreenshotListener) {
      try { screenshotSub = SC.addScreenshotListener(() => show(3000)); } catch {}
    }

    // App switcher → overlay jusqu'au retour en foreground
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

  // Sur web → toujours false (overlay non rendu)
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
// NavBarWrapper — toujours monté, animé uniquement sur /reels
// ─────────────────────────────────────────────────────────────────────────────
function NavBarWrapper() {
  const { navBarOpacity, restoreNavBar } = useReelsUI();
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

  if (!isReels) {
    return (
      <View style={lay.nav}>
        <CustomNavBar />
      </View>
    );
  }

  return (
    <Animated.View style={[lay.nav, { opacity: navBarOpacity }]} pointerEvents="box-none">
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

        {/* NavBar — toujours visible, animée uniquement sur /reels */}
        <NavBarWrapper />

        {/* Overlay anti-screenshot — natif uniquement, jamais rendu sur web */}
        <ScreenshotOverlay visible={screenshotVisible} />

      </SafeAreaProvider>
    </ReelsUIProvider>
  );
}

const lay = StyleSheet.create({
  nav: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
});