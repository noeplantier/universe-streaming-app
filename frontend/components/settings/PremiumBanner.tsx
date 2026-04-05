import React, { memo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';

import { useSettings } from './SettingsContext';
import { G }           from './types';

// ─────────────────────────────────────────────────────────────────────────────

const PERKS = [
  { icon: 'ban-outline',        label: 'Sans publicité'    },
  { icon: 'sparkles-outline',   label: 'Contenu exclusif'  },
  { icon: 'videocam-outline',   label: '4K Ultra HD'       },
  { icon: 'download-outline',   label: 'Téléchargements'   },
];

const PremiumBanner = memo(function PremiumBanner() {
  const router         = useRouter();
  const { user }       = useSettings();

  // Pulsation de la lueur
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const starAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const star = Animated.loop(
      Animated.sequence([
        Animated.timing(starAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(starAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    glow.start();
    star.start();
    return () => { glow.stop(); star.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  const starRot   = starAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '30deg'] });

  if (user.isPremium) {
    // Petite badge si déjà premium
    return (
      <View style={s.alreadyPremium}>
        <LinearGradient colors={['#1A0038', '#240058']} style={StyleSheet.absoluteFill} />
        <Ionicons name="checkmark-circle" size={20} color={G.gold} />
        <Text style={s.alreadyTxt}>UNIVERSE Premium actif ✨</Text>
      </View>
    );
  }

  return (
    <View style={s.outer}>
      {/* Fond gradient profond */}
      <LinearGradient
        colors={['#1A052E', '#240058', '#1A052E']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Lueur pulsante */}
      <Animated.View style={[s.glowBlob, { opacity: glowAnim, transform: [{ scale: glowScale }] }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['rgba(192,96,255,0.45)', 'transparent']}
          style={{ flex: 1, borderRadius: 100 }}
        />
      </Animated.View>

      {/* Étoile rotative déco */}
      <Animated.View style={[s.starDeco, { transform: [{ rotate: starRot }] }]} pointerEvents="none">
        <Text style={s.starEmoji}>✨</Text>
      </Animated.View>

      <View style={s.content}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>UNIVERSE Premium</Text>
            <Text style={s.subtitle}>Le cinéma sans limites</Text>
          </View>
          <View style={s.pricePill}>
            <Text style={s.priceVal}>3,99€</Text>
            <Text style={s.pricePer}>/mois</Text>
          </View>
        </View>

        {/* Avantages */}
        <View style={s.perks}>
          {PERKS.map(p => (
            <View key={p.icon} style={s.perk}>
              <View style={s.perkIcon}>
                <Ionicons name={p.icon as any} size={13} color={G.gold} />
              </View>
              <Text style={s.perkTxt}>{p.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={() => router.push('/premium')}
          activeOpacity={0.88}
          style={s.ctaWrap}
        >
          <LinearGradient
            colors={['#C060FF', '#8C2EBA', '#C060FF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.cta}
          >
            <Text style={s.ctaTxt}>Activer Premium →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default PremiumBanner;

const s = StyleSheet.create({
  outer:         { marginHorizontal: 16, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(192,96,255,0.30)', marginBottom: 6, minHeight: 180 },
  glowBlob:      { position: 'absolute', top: -30, left: -30, width: 180, height: 180, borderRadius: 90 },
  starDeco:      { position: 'absolute', top: 16, right: 56 },
  starEmoji:     { fontSize: 28, opacity: 0.5 },
  content:       { padding: 18, gap: 14 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:         { color: G.sW, fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  subtitle:      { color: 'rgba(237,232,255,0.5)', fontSize: 12, marginTop: 2 },
  pricePill:     { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  priceVal:      { color: G.sW, fontSize: 18, fontWeight: '800' },
  pricePer:      { color: 'rgba(237,232,255,0.45)', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  perks:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  perk:          { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,214,10,0.08)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,214,10,0.18)' },
  perkIcon:      { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  perkTxt:       { color: 'rgba(237,232,255,0.75)', fontSize: 11, fontWeight: '600' },
  ctaWrap:       { borderRadius: 14, overflow: 'hidden' },
  cta:           { paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
  ctaTxt:        { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  alreadyPremium:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,214,10,0.22)', marginBottom: 6 },
  alreadyTxt:    { color: G.gold, fontSize: 14, fontWeight: '700' },
});