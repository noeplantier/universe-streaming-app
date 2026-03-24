import React, { useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SIZE, RADIUS } from '../../constants/theme'; 

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  
  // -- Animations --
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Démarrage des animations d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Animation de pulsation pour le logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // 🚀 FONCTION DE FAUSSE CONNEXION / ACCÈS DIRECT
  const handleDirectAccess = () => {
    // Redirection immédiate vers l'application principale (Tabs)
    // Contourne l'authentification réelle pour le moment
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Fond Dégradé Global */}
      <LinearGradient
        colors={[COLORS.backgroundDeep || '#000', '#1A0B2E', '#000']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Cercles lumineux décoratifs */}
      <View style={styles.glowTop} />

      <View style={styles.content}>
        
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {/* Logo Section */}
          <Animated.View 
            style={[
              styles.logoSection, 
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }], alignItems: 'center' }}>
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

          {/* Film Strip Decoration (Les genres) */}
          <Animated.View style={[styles.filmStripRow, { opacity: fadeAnim }]}>
            {['Thriller', 'Drame', 'Romance', 'Sci-Fi', 'Horreur'].map((g, i) => (
              <View key={i} style={styles.genrePill}>
                <Text style={styles.genrePillText}>{g}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* CTAs - Bas de page */}
        <Animated.View style={[styles.bottomSection, { opacity: fadeAnim }]}>
          
          {/* BOUTON D'ACCÈS RAPIDE (FAUSSE CONNEXION) */}
          <TouchableOpacity 
            activeOpacity={0.85}
            onPress={handleDirectAccess}
            style={styles.mainBtnWrapper}
          >
            <LinearGradient
              colors={['#9B3FDE', '#5B247A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.mainBtn}
            >
              <Text style={styles.mainBtnText}>Entrer dans l'Univers</Text>
              <Text style={styles.mainBtnSubText}>Accès Immédiat</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Liens classiques (Optionnels) */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.secondaryText}>Connexion</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.secondaryText}>Créer un compte</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#000',
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: -50,
    width: width,
    height: width,
    borderRadius: width / 2,
    backgroundColor: 'rgba(140, 46, 186, 0.15)',
    blurRadius: 50, // Note: blurRadius marche différemment sur Android vs iOS parfois
  },
  content: {
    flex: 1,
    paddingHorizontal: SIZE.padding || 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
    includeFontPadding: false,
  },
  logoUnderline: {
    width: 60,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  tagline: {
    marginTop: 24,
    fontSize: 20,
    color: '#E0E0E0',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '600',
  },
  taglineEn: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  filmStripRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    maxWidth: '90%',
  },
  genrePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  genrePillText: {
    color: '#D4A0FF',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  mainBtnWrapper: {
    width: '100%',
    borderRadius: RADIUS.l || 24,
    overflow: 'hidden',
    shadowColor: '#9B3FDE',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  mainBtn: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mainBtnSubText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  secondaryText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});