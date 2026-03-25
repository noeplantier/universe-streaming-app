// app/search.tsx
import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView, 
  TouchableOpacity, TextInput, Dimensions, Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 CONFIGURATION & THEME
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = {
  bg: '#050110',
  cardBg: 'rgba(255, 255, 255, 0.05)',
  accent: '#A855F7', // Galactic Purple
  textMain: '#FFFFFF',
  textSub: '#BCB8C2',
  pinkBadge: '#E91E63',
  purpleBadge: '#6A1B9A',
};

// ─────────────────────────────────────────────────────────────────────────────
// 🍿 MOCK DATA (Indie Works)
// ─────────────────────────────────────────────────────────────────────────────
const WORKS = [
  { id: '1', title: 'Interdit', category: 'Interdit', likes: 345, image: 'https://picsum.photos/seed/p1/400/600', isOriginal: false, adjective: 'Provocateur' },
  { id: '2', title: 'La Mariée Captive', category: 'ORIGINAL', likes: 212, comments: 45, image: 'https://picsum.photos/seed/p2/400/600', isOriginal: true, adjective: 'Captivant' },
  { id: '3', title: 'Neon Abyss', category: 'Série', likes: 371, image: 'https://picsum.photos/seed/p3/400/600', isOriginal: false, adjective: 'Visuel' },
  { id: '4', title: 'Wasteland', category: 'Film', likes: 128, image: 'https://picsum.photos/seed/p4/400/600', isOriginal: true, adjective: 'Brut' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 🎴 COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const FilterChip = ({ label, icon }: { label: string, icon?: string }) => (
  <TouchableOpacity style={styles.filterChip}>
    <Text style={styles.filterChipText}>{label}</Text>
    {icon && <Ionicons name={icon as any} size={14} color={COLORS.textSub} style={{marginLeft: 4}} />}
  </TouchableOpacity>
);

const MovieCard = ({ item }: { item: typeof WORKS[0] }) => (
  <TouchableOpacity style={styles.cardContainer}>
    <Image source={{ uri: item.image }} style={styles.cardImage} />
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardOverlay} />
    
    {/* Badges dynamiques comme sur l'image */}
    <View style={[styles.badge, { backgroundColor: item.isOriginal ? COLORS.purpleBadge : COLORS.pinkBadge }]}>
      <Text style={styles.badgeText}>{item.category.toUpperCase()}</Text>
    </View>

    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <View style={styles.cardStats}>
        <View style={styles.statItem}>
          <Ionicons name="heart" size={14} color={COLORS.accent} />
          <Text style={styles.statText}>{item.likes}</Text>
        </View>
        {item.comments && (
          <View style={styles.statItem}>
            <Ionicons name="chatbubble" size={12} color={COLORS.accent} />
            <Text style={styles.statText}>{item.comments}</Text>
          </View>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────────
// 🔍 MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const [search, setSearch] = useState('');

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background avec dégradé galactique */}
      <LinearGradient colors={['#1A0B2E', '#05010A']} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        
        {/* HEADER SECTION */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rechercher</Text>
          <TouchableOpacity>
            <Ionicons name="search" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* SEARCH BAR GLASSMORPHISM */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textSub} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Rechercher dans Universe..."
            placeholderTextColor={COLORS.textSub}
            style={styles.input}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* MAIN TABS (Séries, Films, Catégories) */}
        <View style={styles.tabRow}>
          {['Séries', 'Films', 'Catégories'].map((tab, i) => (
            <TouchableOpacity key={tab} style={[styles.mainTab, i === 0 && styles.activeTab]}>
              <Text style={styles.mainTabText}>{tab}</Text>
              {tab === 'Catégories' && <Ionicons name="chevron-forward" size={16} color="white" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ADVANCED FILTERS ROW */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <FilterChip label="Genre" icon="chevron-down" />
          <FilterChip label="Popularité" icon="chevron-down" />
          <FilterChip label="Durée" icon="chevron-down" />
          <FilterChip label="Année" icon="chevron-down" />
          <TouchableOpacity style={styles.filterIconBtn}>
             <MaterialCommunityIcons name="filter-variant" size={20} color="white" />
          </TouchableOpacity>
        </ScrollView>

        {/* GRID RESULTS (Les plus tendances / Populaires) */}
        <View style={styles.gridHeader}>
           <Text style={styles.sectionTitle}>Les Plus tendances</Text>
           <Ionicons name="chevron-forward" size={20} color={COLORS.textSub} />
        </View>

        <View style={styles.grid}>
          {WORKS.map((item) => (
            <MovieCard key={item.id} item={item} />
          ))}
        </View>

        {/* POPULAR BANNER (En bas comme sur l'image) */}
        <TouchableOpacity style={styles.popularBanner}>
          <BlurView intensity={20} tint="dark" style={styles.bannerBlur}>
            <View style={styles.bannerLeft}>
              <View style={styles.bannerIconCircle}>
                 <Ionicons name="heart" size={16} color="white" />
              </View>
              <View>
                <Text style={styles.bannerTitle}>Populaires</Text>
                <Text style={styles.bannerSub}>Pinpularires</Text>
              </View>
            </View>
            <View style={styles.avatarStack}>
               <Image source={{uri: 'https://i.pravatar.cc/100?u=1'}} style={styles.avatar} />
               <Image source={{uri: 'https://i.pravatar.cc/100?u=2'}} style={[styles.avatar, {marginLeft: -10}]} />
            </View>
          </BlurView>
        </TouchableOpacity>

      </ScrollView>

      
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 STYLES PIXEL PERFECT
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollPadding: { paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 60,
    marginBottom: 20,
  },
  headerTitle: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
    paddingHorizontal: 15,
    height: 50,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: { flex: 1, color: 'white', fontSize: 16 },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 25,
  },
  mainTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  activeTab: { backgroundColor: '#5A2A94' },
  mainTabText: { color: 'white', fontWeight: '600', fontSize: 15 },
  filterRow: { paddingLeft: 20, marginBottom: 25 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
  filterChipText: { color: COLORS.textSub, fontSize: 14 },
  filterIconBtn: { padding: 8, marginRight: 20 },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
  },
  cardContainer: {
    width: (width - 45) / 2,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 15,
  },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardOverlay: { ...StyleSheet.absoluteFillObject },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  cardContent: { position: 'absolute', bottom: 12, left: 12 },
  cardTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  cardStats: { flexDirection: 'row', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: 'white', fontSize: 12, fontWeight: '500' },
  popularBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bannerBlur: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(168, 85, 247, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  bannerSub: { color: COLORS.textSub, fontSize: 12 },
  avatarStack: { flexDirection: 'row' },
  avatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'white' },
  
  // NAV BAR
  navContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  navBlur: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  navItem: { alignItems: 'center' },
  navLabel: { color: 'white', fontSize: 10, marginTop: 4 },
  navCenterBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: -20,
    elevation: 10,
    shadowColor: COLORS.accent,
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  navCenterGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navProfile: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: COLORS.accent },
});