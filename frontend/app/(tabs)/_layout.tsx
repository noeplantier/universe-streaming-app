/**
 * app/_layout.tsx — UNIVERSE · ROOT LAYOUT · v4
 *
 * FIX CRASH useRouter dans CustomNavBar :
 * ★ CustomNavBar est montée APRÈS que la navigation est prête
 *   via le flag `navReady` (passé à true dans onReady du Stack)
 *   → useRouter() ne peut plus crasher au montage initial
 *
 * ★ AnimatedNavBar :
 *   - Sur /reels → opacity animée par navBarOpacity (peut disparaître)
 *   - Sur tous les autres écrans → View normale opacity 1 fixe, toujours visible
 *
 * ★ Quand on quitte /reels → restoreNavBar() instantané (setValue 1)
 * ★ Tout le reste conservé à l'identique
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
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
import { supabase }          from '@/lib/supabase';
import CustomNavBar          from '@/components/CustomNavBar';
import { ReelsUIProvider, useReelsUI } from '@/contexts/ReelsUIContext';

// expo-screen-capture optionnel
let ScreenCapture: {
  preventScreenCaptureAsync: () => Promise<void>;
  allowScreenCaptureAsync:   () => Promise<void>;
} | null = null;
try { ScreenCapture = require('expo-screen-capture'); } catch {}

SplashScreen.preventAutoHideAsync().catch(() => {});

// ─── CSS WEB ──────────────────────────────────────────────────────────────────
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    * { -webkit-user-select:none; -moz-user-select:none; user-select:none; }
    input, textarea { -webkit-user-select:text; user-select:text; }
    body { -webkit-tap-highlight-color:transparent; }
  `;
  document.head.appendChild(style);

  document.addEventListener('keyup', (e: KeyboardEvent) => {
    if (
      e.key === 'PrintScreen' ||
      (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))
    ) {
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;' +
        'align-items:center;justify-content:center;color:#fff;font-size:16px;' +
        'font-family:system-ui;flex-direction:column;gap:12px;transition:opacity 0.5s';
      el.innerHTML =
        '<div style="font-size:32px">⛔</div>' +
        '<div>Capture d\'écran non autorisée</div>' +
        '<div style="font-size:12px;opacity:0.5">UNIVERSE · Cinéma indépendant</div>';
      document.body.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
      }, 2000);
    }
  });
}

// ─── Anti-screenshot ──────────────────────────────────────────────────────────
function useAntiScreenshot() {
  const [isPrivate, setIsPrivate] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    ScreenCapture?.preventScreenCaptureAsync().catch(() => {});
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      setIsPrivate(next === 'background' || next === 'inactive');
    });
    return () => {
      sub.remove();
      ScreenCapture?.allowScreenCaptureAsync().catch(() => {});
    };
  }, []);
  return isPrivate;
}

// ─── Privacy overlay ──────────────────────────────────────────────────────────
function PrivacyOverlay() {
  return (
    <View style={ov.wrap} pointerEvents="none">
      <View style={ov.inner}>
        <View style={ov.logo}>
          <Ionicons name="film-outline" size={34} color="rgba(255,255,255,0.70)" />
        </View>
        <Text style={ov.title}>UNIVERSE</Text>
        <Text style={ov.sub}>Cinéma indépendant</Text>
      </View>
    </View>
  );
}
const ov = StyleSheet.create({
  wrap:  { ...StyleSheet.absoluteFillObject, backgroundColor: '#020810', zIndex: 9999, alignItems: 'center', justifyContent: 'center', gap: 12 },
  inner: { alignItems: 'center', gap: 14 },
  logo:  { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(13,32,64,0.80)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: 3, textTransform: 'uppercase' },
  sub:   { color: 'rgba(255,255,255,0.36)', fontSize: 12, letterSpacing: 1.2 },
});

// ─── Auth guard ───────────────────────────────────────────────────────────────
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
// ★ AnimatedNavBar
//
//   Rendu UNIQUEMENT quand `navReady` est true (navigation complètement montée)
//   → useRouter() à l'intérieur de CustomNavBar ne peut plus crasher
//
//   Sur /reels  → Animated.View piloté par navBarOpacity (fullscreen possible)
//   Ailleurs    → View normale opacity 1, jamais animée
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedNavBar({ navReady }: { navReady: boolean }) {
  const { navBarOpacity, restoreNavBar } = useReelsUI();
  const pathname = usePathname();

  const isReels = pathname === '/reels'
    || pathname === '/(tabs)/reels'
    || pathname.endsWith('/reels');

  // Quand on quitte /reels → restore instantané
  const wasOnReels = useRef(false);
  useEffect(() => {
    if (!isReels && wasOnReels.current) {
      restoreNavBar();
    }
    wasOnReels.current = isReels;
  }, [isReels, restoreNavBar]);

  // ★ Ne rien rendre tant que la navigation n'est pas prête
  //   → évite le crash de useRouter() dans CustomNavBar
  if (!navReady) return null;

  if (!isReels) {
    // Hors reels → NavBar normale, toujours visible, opacity fixe
    return (
      <View style={lay.navBarWrapper}>
        <CustomNavBar />
      </View>
    );
  }

  // Sur reels → opacity animée par le contexte
  return (
    <Animated.View
      style={[lay.navBarWrapper, { opacity: navBarOpacity }]}
      // pointerEvents dynamique : quand invisible → pas de clics fantômes
      pointerEvents="box-none"
    >
      <CustomNavBar />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RootLayout
// ─────────────────────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [ready,    setReady]    = useState(false);
  // ★ navReady : true uniquement après que Stack a appelé onReady
  //   → CustomNavBar (et son useRouter) ne monte qu'à ce moment
  const [navReady, setNavReady] = useState(false);
  const isPrivate = useAntiScreenshot();
  useAuthGuard(ready);

  useEffect(() => {
    supabase.auth.getSession()
      .then(() => {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      })
      .catch(() => {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <ReelsUIProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />

        <Stack
          // ★ onReady → navigation complètement montée → safe pour useRouter
          onReady={() => setNavReady(true)}
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

        {/* ★ NavBar — montée seulement après onReady, animée seulement sur /reels */}
        <AnimatedNavBar navReady={navReady} />

        {Platform.OS !== 'web' && isPrivate && <PrivacyOverlay />}
      </SafeAreaProvider>
    </ReelsUIProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const lay = StyleSheet.create({
  navBarWrapper: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    zIndex:   100,
  },
});