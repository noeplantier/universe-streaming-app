/**
 * app/_layout.tsx — UNIVERSE · ROOT LAYOUT · v12 (consolidé)
 *
 * ★ Fusion de deux root layouts qui avaient divergé (voir doc/decisions) :
 *   celui-ci (vrai root, utilisé par expo-router) + app/(tabs)/_layout.tsx
 *   qui avait reçu la protection Android FLAG_SECURE + la dissuasion web
 *   mais jamais ce fichier-ci. (tabs)/_layout.tsx est redevenu un layout de
 *   groupe minimal — toute la logique cross-cutting vit ici, une seule fois.
 * ★ Natif : FLAG_SECURE Android + preventScreenCaptureAsync iOS
 * ★ Web : dissuasion (sélection, clic droit, raccourcis, PrintScreen)
 * ★ NavBar toujours visible, animée uniquement sur /reels
 * ★ Zéro typeof/document/window au module-level → pas de SyntaxError SSR
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  AppState,
  AppStateStatus,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomNavBar from '@/components/CustomNavBar';
import { ReelsUIProvider, useReelsUI } from '@/contexts/ReelsUIContext';
import { PinAuthProvider, usePinAuth } from '@/contexts/PinAuthContext';
import { PreferencesProvider } from './providers/PreferencesProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

const { width: SW, height: SH } = Dimensions.get('window');

// Étoiles pré-calculées — aucun typeof, aucun window ici
const STARS = Array.from({ length: 80 }, (_, i) => ({
  key: i,
  x: ((Math.sin(i * 2.399) + 1) / 2) * SW,
  y: ((Math.cos(i * 1.618) + 1) / 2) * SH,
  r: i % 7 === 0 ? 1.6 : i % 3 === 0 ? 0.9 : 0.5,
  op: 0.12 + (i % 8) * 0.06,
}));

// ─────────────────────────────────────────────────────────────────────────────
// HOOK ANTI-SCREENSHOT — natif (FLAG_SECURE Android + preventScreenCapture iOS)
// + web (dissuasion : sélection, clic droit, raccourcis, PrintScreen)
// ─────────────────────────────────────────────────────────────────────────────
function useAntiScreenshot() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((ms = 0) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
    if (ms > 0) {
      timerRef.current = setTimeout(() => setVisible(false), ms);
    }
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  // Natif : FLAG_SECURE (Android) + preventScreenCaptureAsync (iOS)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let ScreenCapture: any = null;
    try {
      ScreenCapture = require('expo-screen-capture');
    } catch {}

    ScreenCapture?.preventScreenCaptureAsync?.().catch(() => {});

    const screenshotSub =
      ScreenCapture?.addScreenshotListener?.(() => show(3000)) ?? null;

    const appSub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') show(0);
      if (s === 'active') hide();
    });

    const activateAndroidSecureFlag = async () => {
      if (Platform.OS !== 'android') return;
      try {
        const mod = require('react-native-flag-secure-android');
        mod?.default?.activate?.() ?? mod?.activate?.();
      } catch {}
    };

    activateAndroidSecureFlag();

    return () => {
      screenshotSub?.remove?.();
      appSub.remove();
      ScreenCapture?.allowScreenCaptureAsync?.().catch(() => {});
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;

      if (Platform.OS === 'android') {
        try {
          const mod = require('react-native-flag-secure-android');
          mod?.default?.deactivate?.() ?? mod?.deactivate?.();
        } catch {}
      }
    };
  }, [show, hide]);

  // Web : dissuasion (pas de vrai blocage possible côté navigateur)
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

    const onContext = (e: MouseEvent) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && 'IJCK'.includes(k)) ||
        (e.metaKey && e.altKey && 'IJCK'.includes(k))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') show(2500);
    };
    const onVisibility = () => {
      if (doc.hidden) show(0);
      else hide();
    };

    win.addEventListener('blur', () => show(1800));
    win.addEventListener('focus', hide);
    doc.addEventListener('contextmenu', onContext);
    doc.addEventListener('keydown', onKeyDown);
    doc.addEventListener('keyup', onKeyUp);
    doc.addEventListener('visibilitychange', onVisibility);

    return () => {
      doc.removeEventListener('contextmenu', onContext);
      doc.removeEventListener('keydown', onKeyDown);
      doc.removeEventListener('keyup', onKeyUp);
      doc.removeEventListener('visibilitychange', onVisibility);
      try {
        doc.head.removeChild(style);
      } catch {}
    };
  }, [show, hide]);

  // Sur web → toujours false (overlay non rendu, cf. ScreenshotOverlay)
  return Platform.OS !== 'web' && visible;
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY UNIVERSE (natif seulement — non rendu sur web)
// ─────────────────────────────────────────────────────────────────────────────
const ScreenshotOverlay = React.memo(function ScreenshotOverlay({
  visible,
}: {
  visible: boolean;
}) {
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
// PIN auth guard — routes vers /(auth)/login si la session PIN est invalide
// ─────────────────────────────────────────────────────────────────────────────
function usePinAuthGuard(ready: boolean) {
  const router   = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = usePinAuth();

  useEffect(() => {
    if (!ready || isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuth) router.replace('/(auth)/login');
    if (isAuthenticated && inAuth)   router.replace('/(tabs)');
  }, [ready, isLoading, isAuthenticated, segments, router]);
}

// ─────────────────────────────────────────────────────────────────────────────
// NavBarWrapper — toujours monté, animé uniquement sur /reels
// Masqué sur les routes (auth) (login sans barre de navigation)
// ─────────────────────────────────────────────────────────────────────────────
function NavBarWrapper() {
  const { navBarOpacity, uiVisible, restoreNavBar } = useReelsUI();
  const pathname = usePathname();
  const wasOnReels = useRef(false);

  const isReels = useMemo(() => {
    return (
      pathname === '/reels' ||
      pathname === '/(tabs)/reels' ||
      pathname.endsWith('/reels')
    );
  }, [pathname]);

  // Pas de NavBar sur l'écran de login
  const isAuth = useMemo(() =>
    pathname.startsWith('/(auth)') || pathname === '/login',
  [pathname]);

  // Toujours avant tout return conditionnel (Rules of Hooks)
  useEffect(() => {
    if (isAuth) return;
    if (!isReels && wasOnReels.current) restoreNavBar();
    wasOnReels.current = isReels;
  }, [isAuth, isReels, restoreNavBar]);

  if (isAuth) return null;

  if (!isReels) {
    return (
      <View style={lay.nav}>
        <CustomNavBar />
      </View>
    );
  }

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
// AppInner — composant interne qui peut consommer usePinAuth()
// (PinAuthProvider doit être parent — voir RootLayout ci-dessous)
// ─────────────────────────────────────────────────────────────────────────────
function AppInner() {
  const { isLoading } = usePinAuth();
  const [ready, setReady] = useState(false);
  const screenshotVisible = useAntiScreenshot();

  // La session PIN est vérifiée par PinAuthProvider au montage.
  // Dès qu'elle est terminée (isLoading=false) → masquer le splash.
  useEffect(() => {
    if (!isLoading && !ready) {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, ready]);

  usePinAuthGuard(ready);

  if (!ready) return null;

  return (
    <>
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
        <Stack.Screen name="(auth)"    options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)"    options={{ headerShown: false }} />
        <Stack.Screen name="film/[id]" options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
        <Stack.Screen name="reel/[id]" options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
        <Stack.Screen name="edit"      options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
        <Stack.Screen name="review/[id]"               options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }} />
        <Stack.Screen name="notifications"             options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }} />
        <Stack.Screen name="settings"                  options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }} />
        <Stack.Screen name="user/[id]"                 options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }} />
        <Stack.Screen name="backoffice/universe-admin" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="+not-found"                options={{ title: 'Page introuvable' }} />
      </Stack>

      {/* NavBar — toujours visible, animée uniquement sur /reels, masquée sur (auth) */}
      <NavBarWrapper />

      {/* Overlay anti-screenshot — natif uniquement, jamais rendu sur web */}
      <ScreenshotOverlay visible={screenshotVisible} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RootLayout
// ─────────────────────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <PinAuthProvider>
      <ReelsUIProvider>
      <PreferencesProvider>
        <SafeAreaProvider>
          <AppInner />
        </SafeAreaProvider>
       </PreferencesProvider>
      </ReelsUIProvider>
    </PinAuthProvider>
  );
  
}

const lay = StyleSheet.create({
  nav: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
});
