/**
 * app/(auth)/login.tsx — Écran de connexion PIN Universe
 *
 * Design immersif : GalaxyBackground (nebula) plein-écran, logo Universe,
 * sélecteur de membre (8 chips), clavier PIN 6 chiffres.
 *
 * Flux :
 *   1. L'utilisateur sélectionne son nom dans le MemberSelector
 *   2. Il saisit son PIN à 6 chiffres dans le PinPad
 *   3. PinPad appelle onComplete(pin) → authenticate via PinAuthContext.login()
 *   4. En cas de succès → expo-router redirige automatiquement vers (tabs)
 *   5. En cas d'erreur → PinPad affiche l'animation de secousse + message
 *
 * Sécurité (OWASP M2, M9) :
 *   - PIN brut jamais transmis sur le réseau (hashé dans pinAuth.ts)
 *   - Aucun log de PIN ni de token
 *   - Rate limiting + lockout géré côté serveur (authenticate_pin RPC)
 *   - Session stockée dans SecureStore (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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

// ─────────────────────────────────────────────────────────────────────────────
// LoginScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { login, error, isLoading, clearError } = usePinAuth();

  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [submitting,     setSubmitting]      = useState(false);

  // ── Sélection d'un membre ─────────────────────────────────────────────────
  const handleSelectMember = useCallback((name: string) => {
    setSelectedMember(name);
    clearError();
  }, [clearError]);

  // ── Soumission du PIN ─────────────────────────────────────────────────────
  const handlePinComplete = useCallback(async (pin: string) => {
    if (!selectedMember || submitting) return;

    setSubmitting(true);
    try {
      const ok = await login(selectedMember, pin);
      if (ok) {
        // Redirige vers l'application principale
        router.replace('/(tabs)');
      }
      // En cas d'échec : PinAuthContext.error est mis à jour,
      // PinPad déclenche sa propre animation de secousse via le prop `error`
    } finally {
      setSubmitting(false);
    }
  }, [selectedMember, submitting, login, router]);

  // ── Reset de l'erreur lors d'une frappe ──────────────────────────────────
  const handlePinReset = useCallback(() => {
    clearError();
  }, [clearError]);

  const isPinDisabled = !selectedMember || submitting || isLoading;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Fond galactique plein-écran (nebula = halos de profondeur) */}
      <GalaxyBackground variant="nebula" />

      {/* Vignette basse pour améliorer la lisibilité du clavier */}
      <LinearGradient
        colors={['transparent', 'rgba(3,9,15,0.82)']}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >

          {/* ── Header : logo + titre ──────────────────────────────────── */}
          <View style={s.header}>
            <View style={s.logoRing}>
              <Ionicons name="film-outline" size={30} color="rgba(255,255,255,0.85)" />
            </View>
            <Text style={s.brand}>UNIVERSE</Text>
            <Text style={s.tagline}>Cinéma indépendant</Text>
          </View>

          {/* ── Titre de section ─────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Qui êtes-vous ?</Text>
            <MemberSelector
              selected={selectedMember}
              onSelect={handleSelectMember}
              disabled={submitting}
            />
          </View>

          {/* ── Séparateur ────────────────────────────────────────────── */}
          <View style={s.divider} />

          {/* ── PIN ───────────────────────────────────────────────────── */}
          <View style={s.pinSection}>
            {!selectedMember ? (
              <Text style={s.hint}>
                Sélectionnez votre profil pour saisir votre code
              </Text>
            ) : (
              <>
                <Text style={s.sectionLabel}>
                  Code de{' '}
                  <Text style={s.memberName}>{selectedMember}</Text>
                </Text>

                {submitting || isLoading ? (
                  <ActivityIndicator color="#8B5CF6" size="large" style={s.loader} />
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
          </View>

          {/* ── Footer discret ────────────────────────────────────────── */}
          <View style={s.footer}>
            <Ionicons
              name="shield-checkmark-outline"
              size={11}
              color="rgba(255,255,255,0.22)"
            />
            <Text style={s.footerTxt}>Accès équipe sécurisé · PIN chiffré</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#03090F',
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingTop: 24,
    gap: 0,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 36,
    gap: 8,
  },
  logoRing: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(13,32,64,0.80)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    // Glow bleuté
    shadowColor: '#1B4F8A',
    shadowRadius: 28,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 8,
    textTransform: 'uppercase',
  },
  tagline: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: -4,
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    gap: 16,
    paddingBottom: 8,
  },
  pinSection: {
    alignItems: 'center',
    minHeight: 240,
    gap: 16,
    paddingTop: 8,
    paddingHorizontal: 24,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  memberName: {
    color: '#A78BFA',
    fontWeight: '700',
  },

  // ── Séparateur ────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    marginHorizontal: 48,
    marginVertical: 24,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 1,
  },

  // ── Placeholder (aucun membre sélectionné) ────────────────────────────────
  hint: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 24,
    paddingHorizontal: 32,
  },

  loader: {
    marginTop: 48,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 40,
    paddingHorizontal: 24,
  },
  footerTxt: {
    color: 'rgba(255,255,255,0.18)',
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
