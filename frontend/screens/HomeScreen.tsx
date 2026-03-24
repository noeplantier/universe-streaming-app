// app/(tabs)/index.tsx

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ScrollView, Dimensions, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SPACING, GRADIENTS } from '../constants/theme';
import { filmsAPI } from '../services/api';

const { width } = Dimensions.get('window');

interface Film {
  id: string;
  title: string;
  poster_url: string;
  rating: number;
  views_count: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    filmsAPI.getAll()
      .then(setFilms)
      .finally(() => setLoading(false));
  }, []);

  function goFilm(id: string) {
    router.push(`/film/${id}`);
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const trending = films.slice(0, 5);
  const latest = films.slice(5, 12);

  return (
    <View style={styles.container}>

      {/* 🌌 Fake Galaxy Background */}
      <LinearGradient
        colors={['#05010A', '#140020', '#0A0015']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* subtle nebula glow */}
      <LinearGradient
        colors={['rgba(155,63,222,0.25)', 'transparent']}
        style={styles.glow}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.title}>Rechercherrr</Text>

            <View style={styles.headerIcons}>
              <Ionicons name="search" size={22} color="#fff" />
              <Ionicons name="gift-outline" size={22} color="#fff" />
            </View>
          </View>

          {/* SEARCH BAR */}
          <BlurView intensity={30} tint="dark" style={styles.searchBar}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.searchText}>Rechercher dans Universe...</Text>
          </BlurView>

          {/* CHIPS */}
          <View style={styles.chips}>
            {['Séries', 'Films', 'Catégories'].map((c, i) => (
              <TouchableOpacity key={i}>
                <LinearGradient
                  colors={i === 0 ? GRADIENTS.primary : ['rgba(255,255,255,0.08)','rgba(255,255,255,0.02)']}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{c}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* TRENDING */}
          <Section title="Les Plus tendances" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {trending.map((film, i) => (
              <TrendingCard
                key={film.id}
                film={film}
                rank={i + 1}
                onPress={() => goFilm(film.id)}
              />
            ))}
          </ScrollView>

          {/* NEW */}
          <Section title="Nouveautés dans l'univers" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {latest.map(film => (
              <WideCard key={film.id} film={film} onPress={() => goFilm(film.id)} />
            ))}
          </ScrollView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ───────── COMPONENTS ───────── */

function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
    </View>
  );
}

function TrendingCard({ film, rank, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.trendingCard}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} />
      
      <LinearGradient
        colors={['transparent','rgba(0,0,0,0.95)']}
        style={StyleSheet.absoluteFillObject}
      />

      <Text style={styles.rank}>{rank}</Text>
      <Text style={styles.cardTitle}>{film.title}</Text>

      <View style={styles.stats}>
        <Ionicons name="heart" size={12} color="#fff" />
        <Text style={styles.statsText}>{film.views_count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function WideCard({ film, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.wideCard}>
      <Image source={{ uri: film.poster_url }} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['transparent','rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFillObject} />
      <Text style={styles.cardTitle}>{film.title}</Text>
    </TouchableOpacity>
  );
}

/* ───────── STYLES ───────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },

  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 200,
    top: 100,
    left: -50
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenEdge,
    marginTop: 10,
    marginBottom: 10
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff'
  },

  headerIcons: {
    flexDirection: 'row',
    gap: 12
  },

  searchBar: {
    marginHorizontal: SPACING.screenEdge,
    borderRadius: RADIUS.full,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },

  searchText: {
    color: 'rgba(255,255,255,0.6)'
  },

  chips: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.screenEdge,
    marginBottom: 16
  },

  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full
  },

  chipText: {
    color: '#fff',
    fontWeight: '600'
  },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenEdge,
    marginBottom: 10,
    marginTop: 10
  },

  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800'
  },

  trendingCard: {
    width: width * 0.4,
    height: 220,
    marginLeft: SPACING.screenEdge,
    borderRadius: RADIUS.lg,
    overflow: 'hidden'
  },

  wideCard: {
    width: width * 0.7,
    height: 140,
    marginLeft: SPACING.screenEdge,
    borderRadius: RADIUS.lg,
    overflow: 'hidden'
  },

  rank: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    fontSize: 28,
    fontWeight: '900',
    color: '#fff'
  },

  cardTitle: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    color: '#fff',
    fontWeight: '800'
  },

  stats: {
    position: 'absolute',
    bottom: 35,
    left: 10,
    flexDirection: 'row',
    gap: 4
  },

  statsText: {
    color: '#fff',
    fontSize: 10
  }
});