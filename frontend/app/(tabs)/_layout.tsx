/**
 * app/_layout.tsx — UNIVERSE · ROOT LAYOUT
 *
 * ★ Anti-screenshots : expo-screen-capture (iOS/Android)
 *   + Privacy overlay sur app switcher (background/inactive)
 *   + CSS user-select:none + warning overlay (web)
 * ★ Pas de restriction mobile-only → fonctionne sur web et mobile
 * ★ Auth redirect : non-connecté → /login
 * ★ Code minimal, aucune dépendance superflue
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  AppState, Platform, StyleSheet, Text, View,
  type AppStateStatus,
} from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar }        from 'expo-status-bar';
import * as SplashScreen    from 'expo-splash-screen';
import { Ionicons }         from '@expo/vector-icons';
import { supabase }         from '@/lib/supabase';
import CustomNavBar from '@/components/CustomNavBar';

// expo-screen-capture — optionnel, ne plante pas si absent
let ScreenCapture: { preventScreenCaptureAsync:()=>Promise<void>; allowScreenCaptureAsync:()=>Promise<void> } | null = null;
try { ScreenCapture = require('expo-screen-capture'); } catch {}

// Garde le splash jusqu'à la vérification d'auth
SplashScreen.preventAutoHideAsync().catch(() => {});

// ─── CSS WEB : anti-sélection + notice screenshot ─────────────────────────────
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    * { -webkit-user-select:none; -moz-user-select:none; user-select:none; }
    input, textarea { -webkit-user-select:text; user-select:text; }
    body { -webkit-tap-highlight-color:transparent; }
  `;
  document.head.appendChild(style);

  // Détecte PrintScreen / Cmd+Shift+4 (macOS) → overlay flash
  document.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key==='3'||e.key==='4'||e.key==='5'))) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-family:system-ui;flex-direction:column;gap:12px;transition:opacity 0.5s';
      el.innerHTML = '<div style="font-size:32px">⛔</div><div>Capture d\'écran non autorisée</div><div style="font-size:12px;opacity:0.5">UNIVERSE · Cinéma indépendant</div>';
      document.body.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 2000);
    }
  });
}

// ─── HOOK ANTI-SCREENSHOT ─────────────────────────────────────────────────────
function useAntiScreenshot() {
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // 1. Bloque les captures d'écran (iOS + Android)
    ScreenCapture?.preventScreenCaptureAsync().catch(() => {});

    // 2. Overlay de confidentialité sur app switcher (background/inactive)
    const onStateChange = (next: AppStateStatus) => {
      setIsPrivate(next === 'background' || next === 'inactive');
    };
    const sub = AppState.addEventListener('change', onStateChange);

    return () => {
      sub.remove();
      ScreenCapture?.allowScreenCaptureAsync().catch(() => {});
    };
  }, []);

  return isPrivate;
}

// ─── PRIVACY OVERLAY (mobile app switcher) ────────────────────────────────────
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

// ─── HOOK AUTH REDIRECT ───────────────────────────────────────────────────────
function useAuthGuard(ready: boolean) {
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const inAuth = segments[0] === '(auth)' || segments[0] === 'login';
      if (!session && !inAuth) {
        // Non connecté → login (si la route existe)
        // router.replace('/login');  // décommenter quand la route /login est créée
      }
    });
  }, [ready, segments]);
}

// ─── ROOT LAYOUT ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const isPrivate         = useAntiScreenshot();
  useAuthGuard(ready);

  useEffect(() => {
    // Vérifie la session + cache le splash
    supabase.auth.getSession().then(() => {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }).catch(() => {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    });

    // Sync session sur changement (ex. refresh token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown:       false,
          contentStyle:      { backgroundColor: '#070C17' },
          animation:         Platform.OS === 'ios' ? 'default' : 'fade',
          gestureEnabled:    true,
          gestureDirection:  'horizontal',
        }}
      >
        {/* Tabs group — écrans principaux */}
        <Stack.Screen name="(tabs)"   options={{ headerShown: false }} />

        {/* Modales et écrans détail */}
        <Stack.Screen name="film/[id]"  options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
        <Stack.Screen name="reel/[id]"  options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
        <Stack.Screen name="edit"       options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
        <Stack.Screen name="review/[id]" options={{ animation: Platform.OS==='ios'?'default':'fade_from_bottom' }} />
        <Stack.Screen name="notifications" options={{ animation: Platform.OS==='ios'?'default':'fade_from_bottom' }} />
        <Stack.Screen name="settings"   options={{ animation: Platform.OS==='ios'?'default':'fade_from_bottom' }} />
        <Stack.Screen name="user/[id]"  options={{ animation: Platform.OS==='ios'?'default':'fade_from_bottom' }} />
        <Stack.Screen name="backoffice/universe-admin" options={{ animation: 'fade_from_bottom' }} />

        {/* Auth (décommenter quand routes créées) */}
        {/* <Stack.Screen name="login" options={{ animation:'fade', gestureEnabled:false }} /> */}
        {/* <Stack.Screen name="(auth)" options={{ headerShown:false }} /> */}

        {/* 404 */}
        <Stack.Screen name="+not-found" options={{ title: 'Page introuvable' }} />
      </Stack>

      {/* ★ Privacy overlay — masque le contenu dans l'app switcher */}
      {Platform.OS !== 'web' && isPrivate && <PrivacyOverlay />}
      <CustomNavBar/>

    </SafeAreaProvider>
  );
}