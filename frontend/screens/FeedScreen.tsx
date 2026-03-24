// screens/FeedScreen.tsx

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

const STAR_COUNT = 60;

export default function FeedScreen() {
  const fade = useRef(new Animated.Value(0)).current;

  const stars = useRef(
    Array.from({ length: STAR_COUNT }).map(() => ({
      x: Math.random() * width,
      y: new Animated.Value(Math.random() * height),
      size: Math.random() * 2 + 1,
      speed: Math.random() * 6000 + 4000,
    }))
  ).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    stars.forEach((s) => {
      Animated.loop(
        Animated.timing(s.y, {
          toValue: height,
          duration: s.speed,
          useNativeDriver: true,
        })
      ).start();
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* GALAXY BACKGROUND */}
      <LinearGradient
        colors={['#05010A', '#1A0B2E', '#05010A']}
        style={StyleSheet.absoluteFill}
      />

      {stars.map((s, i) => (
        <Animated.View
          key={i}
          style={[
            styles.star,
            {
              width: s.size,
              height: s.size,
              left: s.x,
              transform: [{ translateY: s.y }],
            },
          ]}
        />
      ))}

      <Animated.View style={{ flex: 1, opacity: fade }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.logo}>UNIVERSE</Text>
            <View style={styles.headerIcons}>
              <Ionicons name="search-outline" size={20} color="#fff" />
              <Ionicons name="gift-outline" size={20} color="#fff" />
            </View>
          </View>

          {/* HERO */}
          <View style={styles.hero}>
            <Image
              source={{ uri: 'https://picsum.photos/600/400' }}
              style={styles.heroImg}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.9)']}
              style={styles.heroOverlay}
            />

            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>PUFFERS</Text>

              <View style={styles.tags}>
                {['Horreur', 'Série', '2024'].map((t) => (
                  <Text key={t} style={styles.tag}>
                    {t}
                  </Text>
                ))}
              </View>

              <View style={styles.ctaRow}>
                <TouchableOpacity style={styles.playBtn}>
                  <Text style={styles.playText}>▶ Lecture</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.listBtn}>
                  <Text style={styles.listText}>★ Ma liste</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* TRENDING */}
          <Text style={styles.section}>Les plus tendances</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.card}>
                <Image
                  source={{ uri: `https://picsum.photos/200/30${i}` }}
                  style={styles.cardImg}
                />
                <Text style={styles.rank}>{i}</Text>
              </View>
            ))}
          </ScrollView>

          {/* NEW */}
          <Text style={styles.section}>Nouveautés dans l'univers</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.wideCard}>
                <Image
                  source={{ uri: `https://picsum.photos/400/20${i}` }}
                  style={styles.wideImg}
                />
              </View>
            ))}
          </ScrollView>
        </ScrollView>
      </Animated.View>

      {/* BOTTOM NAV */}
      <View style={styles.nav}>
        <Ionicons name="home" size={22} color="#fff" />
        <Ionicons name="play" size={22} color="#fff" />
        <View style={styles.centerGlow} />
        <Ionicons name="people" size={22} color="#fff" />
        <Ionicons name="person" size={22} color="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },

  logo: {
    color: '#FFF',
    fontSize: 26,
    letterSpacing: 6,
    fontWeight: 'bold',
  },

  headerIcons: { flexDirection: 'row', gap: 15 },

  hero: {
    height: 230,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 20,
  },

  heroImg: { width: '100%', height: '100%', position: 'absolute' },
  heroOverlay: { ...StyleSheet.absoluteFillObject },

  heroContent: { position: 'absolute', bottom: 20, left: 20 },

  heroTitle: { color: '#FFF', fontSize: 30, fontWeight: 'bold' },

  tags: { flexDirection: 'row', gap: 10, marginTop: 5 },

  tag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    color: '#FFF',
  },

  ctaRow: { flexDirection: 'row', marginTop: 10, gap: 10 },

  playBtn: {
    backgroundColor: '#6C3BFF',
    padding: 10,
    borderRadius: 20,
  },

  listBtn: {
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 20,
  },

  playText: { color: '#FFF' },
  listText: { color: '#000' },

  section: {
    color: '#FFF',
    fontSize: 18,
    margin: 20,
    fontWeight: '600',
  },

  card: {
    width: 120,
    height: 180,
    marginLeft: 20,
  },

  cardImg: { width: '100%', height: '100%', borderRadius: 12 },

  rank: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
  },

  wideCard: {
    width: 250,
    height: 140,
    marginLeft: 20,
  },

  wideImg: { width: '100%', height: '100%', borderRadius: 14 },

  nav: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 65,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  centerGlow: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOpacity: 0.9,
    shadowRadius: 20,
  },

  star: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 2,
    opacity: 0.8,
  },
});