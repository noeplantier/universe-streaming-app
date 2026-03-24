// app/(tabs)/feed.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router'; // 👈 Utilisation du routeur d'Expo

const { width, height } = Dimensions.get('window');
const STAR_COUNT = 80;

// --- MOCK DATA CINÉMA INDÉPENDANT ---
const INDIE_WORKS = [
  { id: '1', title: 'Neon Dreams', genre: 'Cyberpunk', adjective: 'Hypnotique', image: 'https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?q=80&w=600' },
  { id: '2', title: 'Silent Echoes', genre: 'Drame', adjective: 'Poétique', image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=600' },
  { id: '3', title: 'Wasteland', genre: 'Dystopie', adjective: 'Brut', image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600' },
  { id: '4', title: 'The Void', genre: 'Expérimental', adjective: 'Surréaliste', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600' },
];

export default function FeedScreen() {
  const router = useRouter(); // 👈 Initialisation du routeur
  const [showShorts, setShowShorts] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  // Animation Galactique
  const stars = useRef(
    Array.from({ length: STAR_COUNT }).map(() => ({
      x: Math.random() * width,
      y: new Animated.Value(Math.random() * height),
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 8000 + 4000,
    }))
  ).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
    stars.forEach((s) => {
      Animated.loop(
        Animated.timing(s.y, { toValue: height, duration: s.speed, useNativeDriver: true })
      ).start();
    });
  }, []);

  // Fonction pour naviguer vers la page détail
  const navigateToDetail = (movie: any) => {
    router.push({
      pathname: '/MovieDetail', // Assure-toi d'avoir un fichier app/MovieDetail.tsx
      params: { 
        id: movie.id, 
        title: movie.title, 
        genre: movie.genre, 
        image: movie.image, 
        adjective: movie.adjective 
      },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* BACKGROUND MILKY WAY */}
      <LinearGradient colors={['#05010A', '#1A0B2E', '#05010A']} style={StyleSheet.absoluteFill} />
      {stars.map((s, i) => (
        <Animated.View key={i} style={[styles.star, { width: s.size, height: s.size, left: s.x, transform: [{ translateY: s.y }] }]} />
      ))}

      <Animated.View style={{ flex: 1, opacity: fade }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            
            {/* HEADER */}
            <View style={styles.header}>
              <Text style={styles.logo}>UNIVERSE</Text>
              <View style={styles.headerIcons}>
                <Ionicons name="search-outline" size={24} color="#fff" />
                <Ionicons name="gift-outline" size={24} color="#fff" />
              </View>
            </View>

            {/* HERO CARD */}
            <View style={styles.hero}>
              <Image source={{ uri: INDIE_WORKS[0].image }} style={styles.heroImg} />
              <LinearGradient colors={['transparent', 'rgba(5, 1, 10, 0.9)']} style={styles.heroOverlay} />
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>{INDIE_WORKS[0].title}</Text>
                <View style={styles.tags}>
                  <Text style={styles.tag}>{INDIE_WORKS[0].genre}</Text>
                  <Text style={styles.tag}>Série Originale</Text>
                </View>

                {showShorts ? (
                  <View style={styles.shortsCarousel}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
                      <Text style={{ color: '#A855F7', fontWeight: 'bold' }}>EXTRAITS EXCLUSIFS</Text>
                      <TouchableOpacity onPress={() => setShowShorts(false)}><Ionicons name="close" size={20} color="#FFF" /></TouchableOpacity>
                    </View>
                    <FlatList
                      horizontal
                      data={INDIE_WORKS}
                      keyExtractor={(item) => 'short-' + item.id}
                      renderItem={({ item }) => (
                        <View style={styles.shortItem}>
                          <Image source={{ uri: item.image }} style={styles.shortThumb} />
                          <Ionicons name="play" size={18} color="#FFF" style={styles.shortPlay} />
                        </View>
                      )}
                    />
                  </View>
                ) : (
                  <View style={styles.ctaRow}>
                    <TouchableOpacity style={styles.playBtn} onPress={() => setShowShorts(true)}>
                      <Text style={styles.playText}>▶ Lecture</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.listBtn}>
                      <Text style={styles.listText}>★ Ma liste</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* TRENDING SECTION */}
            <Text style={styles.sectionTitle}>Les plus tendances</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
              {INDIE_WORKS.map((movie, index) => (
                <TouchableOpacity 
                  key={movie.id} 
                  style={styles.card} 
                  onPress={() => navigateToDetail(movie)}
                >
                  <Image source={{ uri: movie.image }} style={styles.cardImg} />
                  <View style={styles.badge}><Text style={styles.badgeText}>{movie.adjective}</Text></View>
                  <Text style={styles.rank}>{index + 1}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* NEW RELEASES */}
            <Text style={styles.sectionTitle}>Nouveautés de l'univers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
              {INDIE_WORKS.slice().reverse().map((movie) => (
                <TouchableOpacity 
                  key={'new-' + movie.id} 
                  style={styles.wideCard}
                  onPress={() => navigateToDetail(movie)}
                >
                  <Image source={{ uri: movie.image }} style={styles.wideImg} />
                  <Text style={styles.wideTitle}>{movie.title} • {movie.genre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  star: { position: 'absolute', backgroundColor: '#FFF', borderRadius: 2, opacity: 0.6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  logo: { color: '#FFF', fontSize: 24, letterSpacing: 6, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', gap: 20 },
  hero: { height: 400, borderRadius: 25, overflow: 'hidden', marginHorizontal: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroImg: { width: '100%', height: '100%', position: 'absolute' },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { position: 'absolute', bottom: 20, left: 20, right: 20, alignItems: 'center' },
  heroTitle: { color: '#FFF', fontSize: 34, fontWeight: 'bold', textAlign: 'center' },
  tags: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 15 },
  tag: { color: '#DDD', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  ctaRow: { flexDirection: 'row', gap: 10 },
  playBtn: { backgroundColor: '#6C3BFF', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  playText: { color: '#FFF', fontWeight: 'bold' },
  listBtn: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  listText: { color: '#000', fontWeight: 'bold' },
  shortsCarousel: { width: '100%', backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 15 },
  shortItem: { width: 80, height: 120, marginRight: 10, borderRadius: 10, overflow: 'hidden' },
  shortThumb: { width: '100%', height: '100%' },
  shortPlay: { position: 'absolute', bottom: 5, right: 5 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', margin: 20 },
  hScroll: { paddingLeft: 20 },
  card: { width: 140, height: 200, marginRight: 20, justifyContent: 'flex-end' },
  cardImg: { ...StyleSheet.absoluteFillObject, borderRadius: 15 },
  badge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#8A2BE2', padding: 5, borderRadius: 5 },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  rank: { color: '#FFF', fontSize: 60, fontWeight: '900', marginBottom: -15, marginLeft: -5, textShadowColor: '#000', textShadowRadius: 10 },
  wideCard: { width: 260, height: 150, marginRight: 20 },
  wideImg: { width: '100%', height: '100%', borderRadius: 20 },
  wideTitle: { color: '#FFF', marginTop: 8, fontSize: 14, fontWeight: '600' },
});