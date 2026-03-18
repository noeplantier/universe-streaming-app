import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

const STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height,
  size: Math.random() * 3 + 1,
  opacity: Math.random() * 0.8 + 0.2,
}));

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Galaxy Background */}
      <LinearGradient
        colors={['#0D0020', '#1A004D', '#000000']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />

      {/* Stars */}
      {STARS.map(star => (
        <View
          key={star.id}
          style={[styles.star, { left: star.x, top: star.y, width: star.size, height: star.size, opacity: star.opacity }]}
        />
      ))}

      {/* Nebula glow */}
      <LinearGradient
        colors={['rgba(140, 46, 186, 0.25)', 'transparent']}
        style={styles.nebulaGlow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Logo */}
        <Animated.View style={[styles.logoSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Text style={styles.logoText}>UNIVERSE</Text>
            <LinearGradient
              colors={['#8C2EBA', '#240056']}
              style={styles.logoUnderline}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
          <Text style={styles.tagline}>Le cinéma indépendant{'\n'}à portée de main</Text>
          <Text style={styles.taglineEn}>Independent Cinema Streaming</Text>
        </Animated.View>

        {/* Film strip decoration */}
        <Animated.View style={[styles.filmStripRow, { opacity: fadeAnim }]}>
          {['Thriller', 'Drame', 'Romance', 'Sci-Fi', 'Fantasy'].map((g, i) => (
            <View key={i} style={styles.genrePill}>
              <Text style={styles.genrePillText}>{g}</Text>
            </View>
          ))}
        </Animated.View>

        {/* CTAs */}
        <Animated.View style={[styles.ctaSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity
            testID="welcome-login-btn"
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={GRADIENTS.primary}
              style={styles.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryBtnText}>Se connecter</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            testID="welcome-register-btn"
            style={styles.secondaryBtn}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Créer un compte</Text>
          </TouchableOpacity>

          <Text style={styles.demoHint}>Compte démo : demo@universe.com / demo123</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: SPACING.screenEdge },
  star: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
  },
  nebulaGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: height * 0.6,
  },
  logoSection: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  logoText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 12,
    textAlign: 'center',
    textShadowColor: '#8C2EBA',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  logoUnderline: {
    height: 3,
    borderRadius: 2,
    marginTop: 8,
    marginHorizontal: 20,
  },
  tagline: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 26,
    fontWeight: '300',
  },
  taglineEn: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  filmStripRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  genrePill: {
    borderWidth: 1,
    borderColor: 'rgba(140,46,186,0.4)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(36,0,86,0.3)',
  },
  genrePillText: { color: COLORS.textSecondary, fontSize: 12 },
  ctaSection: { paddingBottom: SPACING.xl, gap: 14 },
  primaryBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#8C2EBA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  secondaryBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#8C2EBA',
    backgroundColor: 'rgba(140,46,186,0.1)',
  },
  secondaryBtnText: {
    color: '#8C2EBA',
    fontSize: 16,
    fontWeight: '600',
  },
  demoHint: {
    color: COLORS.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
