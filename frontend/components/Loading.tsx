// app/Loading.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Starfield from '../components/StarField';

const { width } = Dimensions.get('window');

export default function Loading() {
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    // 🚀 intro animation
    Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 10000,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // 🌊 breathing loop (Apple feel)
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // ✨ glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.35,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.15,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 📊 progress
    Animated.timing(progress, {
      toValue: width * 0.5,
      duration: 2600,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <LinearGradient
      colors={['#02020A', '#050514', '#0D0825']}
      style={styles.container}
    >
      {/* 🌌 MULTI LAYER STARFIELD */}
      <Starfield density={40} speed={0.02} opacity={0.3} />
      <Starfield density={30} speed={0.04} opacity={0.6} />
      <Starfield density={20} speed={0.08} opacity={1} />


      {/* 🪐 LOGO */}
      <Animated.Image
        source={require('../assets/images/logouniverse2.png')}
        style={[
          styles.logo,
          {
            
            transform: [{ scale: logoScale }],
          },
        ]}
        resizeMode="contain"
      />

      {/* 🚀 PROGRESS (attaché au logo) */}
      <View style={styles.progressWrapper}>
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progress,
              },
            ]}
          />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 200,
    backgroundColor: '#A855F7',
  },

  logo: {
    width: 300,
    height: 300,
    zIndex: 2,
  },

  progressWrapper: {
    marginTop: 30, 
    alignItems: 'center',
  },

  progressContainer: {
    width: width * 0.5,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    overflow: 'hidden',
  },

  progressBar: {
    height: 3,
    backgroundColor: '#A855F7',
    borderRadius: 10,
  },
});