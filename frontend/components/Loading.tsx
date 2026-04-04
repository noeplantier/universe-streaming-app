// app/Loading.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Starfield from '../components/StarField';

const { width } = Dimensions.get('window');

export default function Loading() {
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(progress, {
      toValue: width * 0.7,
      duration: 2400,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <LinearGradient
      colors={['#03030A', '#07071A', '#120A2A']}
      style={styles.container}
    >
      {/* 🌌 STARFIELD */}
      <Starfield />

 
      {/* 🪐 Logo */}
      <Animated.Image
        source={require('../assets/images/logouniverse.png')}
        style={[
          styles.logo,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
        resizeMode="contain"
      />

      {/* 🚀 Progress bar */}
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
    width: 300,
    height: 300,
    borderRadius: 200,
    backgroundColor: '#A855F7',
    opacity: 0.2,
  },

  logo: {
    width: 500,
    height: 500,
  },

  progressContainer: {
    position: 'absolute',
    bottom: 120,
    width: width * 0.7,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    overflow: 'hidden',
  },

  progressBar: {
    height: 4,
    backgroundColor: '#A855F7',
    borderRadius: 10,
  },
});