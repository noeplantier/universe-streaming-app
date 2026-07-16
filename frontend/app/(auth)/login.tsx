/**
 * app/(auth)/login.tsx — UNIVERSE · Écran de connexion PIN
 *
 * Design premium : GalaxyBackground plein-écran, logo animé aura gold/blue,
 * citation rotative du manifeste cinéma, sélecteur membre, PIN 6 chiffres.
 *
 * Sécurité (OWASP M2, M9) :
 *   - PIN brut jamais transmis (hashé dans pinAuth.ts)
 *   - Rate limiting + lockout géré côté serveur (authenticate_pin RPC)
 *   - Session stockée dans SecureStore (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GalaxyBackground from '@/components/shared/GalaxyBackground';
import MemberSelector from '@/components/auth/MemberSelector';
import PinPad from '@/components/auth/PinPad';
import { usePinAuth } from '@/contexts/PinAuthContext';
import { CINEMA_MANIFESTO } from '@/contexts/GamificationSystem';

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:     '#03090F',
  gold:   '#F5C842',
  blue:   '#5A96E6',
  purple: '#8B5CF6',
  white:  '#FFFFFF',
  mid:    'rgba(255,255,255,0.55)',
  muted:  'rgba(255,255,255,0.35)',
  faint:  'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.10)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ManifestoQuote — citation rotative du manifeste cinéma Universe
// ─────────────────────────────────────────────────────────────────────────────
const ManifestoQuote = React.memo(function ManifestoQuote() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * CINEMA_MANIFESTO.length));
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const rotate = useCallback(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: true }),
      Animated.timing(slide, { toValue: -8, duration: 320, useNativeDriver: true }),
    ]).start(() => {
      setIdx(i => (i + 1) % CINEMA_MANIFESTO.length);
      slide.setValue(8);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, tension: 120, friction: 10, useNativeDriver: true }),
      ]).start();
    });
  }, [fade, slide]);

  useEffect(() => {
    const t = setInterval(rotate, 5000);
    return () => clearInterval(t);
  }, [rotate]);

  return (
    <View style={q.wrap}>
      <View style={q.accentLine} />
      <Animated.Text
        style={[q.quote, { opacity: fade, transform: [{ translateY: slide }] }]}
        numberOfLines={3}
      >
        {CINEMA_MANIFESTO[idx]}
      </Animated.Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LogoRing — anneau animé avec glow gold/blue
// ─────────────────────────────────────────────────────────────────────────────
const LogoRing = React.memo(function LogoRing() {
  const glow  = useRef(new Animated.Value(0.3)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rot   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0.3, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    const scaleLoop = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.06, duration: 2800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const rotLoop = Animated.loop(Animated.timing(rot, {
      toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true,
    }));
    glowLoop.start(); scaleLoop.start(); rotLoop.start();
    return () => { glowLoop.stop(); scaleLoop.stop(); rotLoop.stop(); };
  }, []);

  const borderColor = glow.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(90,150,230,0.25)', 'rgba(245,200,66,0.65)', 'rgba(139,92,246,0.45)'],
  });
  const shadowColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(90,150,230,0)', 'rgba(245,200,66,0.35)'],
  });
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {/* Halo rotatif externe */}
      <Animated.View style={[lr.halo, {
        borderColor,
        transform: [{ rotate: spin }],
        ...(Platform.OS !== 'web' ? {} : { boxShadow: '0 0 24px rgba(245,200,66,0.3)' } as any),
      }]} />
      {/* Core — fond glass */}
      <Animated.View style={[lr.core, {
        borderColor,
        ...(Platform.OS !== 'web'
          ? { shadowColor, shadowRadius: 28, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 }, elevation: 16 }
          : { boxShadow: '0 0 32px rgba(245,200,66,0.25)' } as any),
      }]}>
        <LinearGradient
          colors={['rgba(13,32,64,0.95)', 'rgba(6,16,31,0.98)']}
          style={StyleSheet.absoluteFillObject}
        />
        <Ionicons name="film-outline" size={32} color={C.white} />
      </Animated.View>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LoginScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { login, error, isLoading, clearError } = usePinAuth();

  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [submitting,     setSubmitting]      = useState(false);

  // ── Animations d'entrée en stagger ─────────────────────────────────────────
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const quoteAnim   = useRef(new Animated.Value(0)).current;
  const sectionAnim = useRef(new Animated.Value(0)).current;
  const pinAnim     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(headerAnim,  { toValue: 1, tension: 55, friction: 11, useNativeDriver: true }),
      Animated.spring(quoteAnim,   { toValue: 1, tension: 55, friction: 11, useNativeDriver: true }),
      Animated.spring(sectionAnim, { toValue: 1, tension: 55, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (selectedMember) {
      Animated.spring(pinAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
    } else {
      Animated.timing(pinAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [selectedMember]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelectMember = useCallback((name: string) => {
    setSelectedMember(name);
    clearError();
  }, [clearError]);

  const handlePinComplete = useCallback(async (pin: string) => {
    if (!selectedMember || submitting) return;
    setSubmitting(true);
    try {
      const ok = await login(selectedMember, pin);
      if (ok) router.replace('/(tabs)');
    } finally {
      setSubmitting(false);
    }
  }, [selectedMember, submitting, login, router]);

  const handlePinReset = useCallback(() => clearError(), [clearError]);

  const isPinDisabled = !selectedMember || submitting || isLoading;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <GalaxyBackground variant="nebula" />

      {/* Vignette bas pour lisibilité PIN */}
      <LinearGradient
        colors={['transparent', 'rgba(3,9,15,0.78)', 'rgba(3,9,15,0.97)']}
        locations={[0.25, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >

          {/* ── Header : logo animé + brand ─────────────────────────────── */}
          <Animated.View style={[s.header, {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          }]}>
            <LogoRing />

            <View style={s.brandBlock}>
              <Text style={s.brand}>UNIVERSE</Text>
              <View style={s.taglineRow}>
                <View style={s.taglineLine} />
                <Text style={s.tagline}>CINÉMA INDÉPENDANT</Text>
                <View style={s.taglineLine} />
              </View>
            </View>
          </Animated.View>

          {/* ── Citation manifeste ──────────────────────────────────────── */}
          <Animated.View style={[s.quoteWrap, {
            opacity: quoteAnim,
            transform: [{ translateY: quoteAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }]}>
            <ManifestoQuote />
          </Animated.View>

          {/* ── Séparateur élégant ──────────────────────────────────────── */}
          <View style={s.sep}>
            <View style={s.sepLine} />
            <View style={s.sepDot} />
            <View style={s.sepLine} />
          </View>

          {/* ── Sélection membre ────────────────────────────────────────── */}
          <Animated.View style={[s.section, {
            opacity: sectionAnim,
            transform: [{ translateY: sectionAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }]}>
            <View style={s.labelRow}>
              <Ionicons name="people-outline" size={11} color={C.muted} />
              <Text style={s.label}>QUI ÊTES-VOUS ?</Text>
            </View>
            <MemberSelector
              selected={selectedMember}
              onSelect={handleSelectMember}
              disabled={submitting}
            />
          </Animated.View>

          {/* ── PIN ─────────────────────────────────────────────────────── */}
          <Animated.View style={[s.pinSection, {
            opacity: pinAnim,
            transform: [{ scale: pinAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
          }]}>
            {selectedMember && (
              <>
                <View style={s.pinHeader}>
                  <View style={s.pinAvatar}>
                    <Text style={s.pinAvatarTxt}>
                      {selectedMember.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <View>
                    <Text style={s.pinLabel}>Code de</Text>
                    <Text style={s.pinName}>{selectedMember}</Text>
                  </View>
                </View>

                {submitting || isLoading ? (
                  <ActivityIndicator color={C.blue} size="large" style={{ marginTop: 36 }} />
                ) : (
                  <PinPad
                    onComplete={handlePinComplete}
                    disabled={isPinDisabled}
                    error={error}
                    onReset={handlePinReset}
                  />
                )}
              </>
            )}
          </Animated.View>

          {!selectedMember && (
            <View style={s.hintWrap}>
              <Ionicons name="lock-closed-outline" size={13} color={C.muted} />
              <Text style={s.hint}>Sélectionnez votre profil pour continuer</Text>
            </View>
          )}

          {/* ── Footer sécurité ──────────────────────────────────────────── */}
          <View style={s.footer}>
            <Ionicons name="shield-checkmark-outline" size={10} color="rgba(255,255,255,0.18)" />
            <Text style={s.footerTxt}>Accès équipe · PIN chiffré · Taux limité</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — LogoRing
// ─────────────────────────────────────────────────────────────────────────────
const lr = StyleSheet.create({
  halo: {
    position: 'absolute',
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 1,
    borderStyle: 'dashed',
    top: -4, left: -4,
  },
  core: {
    width: 88, height: 88, borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles — ManifestoQuote
// ─────────────────────────────────────────────────────────────────────────────
const q = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 28,
  },
  accentLine: {
    width: 2, borderRadius: 1,
    backgroundColor: C.blue,
    marginTop: 3,
    minHeight: 36,
  },
  quote: {
    flex: 1,
    color: C.mid,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    letterSpacing: 0.1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles — Screen
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingTop: 20 },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 28,
    gap: 18,
  },
  brandBlock: { alignItems: 'center', gap: 6 },
  brand: {
    color: C.white,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 10,
    textTransform: 'uppercase',
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taglineLine: {
    height: StyleSheet.hairlineWidth,
    width: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tagline: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 8.5,
    letterSpacing: 3.5,
    fontWeight: '700',
  },

  // Quote
  quoteWrap: { marginBottom: 8 },

  // Séparateur triple
  sep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 44,
    marginVertical: 22,
    gap: 8,
  },
  sepLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.09)' },
  sepDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Section membre
  section: { gap: 14, paddingBottom: 6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
  },
  label: {
    color: C.muted,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2.5,
  },

  // PIN
  pinSection: {
    alignItems: 'center',
    minHeight: 220,
    gap: 14,
    paddingTop: 8,
    paddingHorizontal: 24,
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(13,32,64,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(90,150,230,0.25)',
    alignSelf: 'stretch',
  },
  pinAvatar: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(90,150,230,0.18)',
    borderWidth: 1, borderColor: 'rgba(90,150,230,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  pinAvatarTxt: { color: C.blue, fontSize: 13, fontWeight: '900' },
  pinLabel: { color: C.muted, fontSize: 10, fontWeight: '500' },
  pinName:  { color: C.white, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },

  // Hint (aucun membre sélectionné)
  hintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingTop: 20,
    paddingHorizontal: 32,
    opacity: 0.7,
  },
  hint: {
    color: C.muted,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 36,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  footerTxt: {
    color: 'rgba(255,255,255,0.16)',
    fontSize: 9.5,
    letterSpacing: 0.4,
  },
});
