import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 COLORS & CONSTANTS (Pour matcher le thème)
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = {
  accent: '#A855F7',
  textSub: '#BCB8C2',
};

// ─────────────────────────────────────────────────────────────────────────────
// 🛸 COMPOSANT CUSTOM NAVBAR
// ─────────────────────────────────────────────────────────────────────────────
function CustomNavBar() {
  const router = useRouter();

  return (
    <View style={styles.navContainer}>
      <BlurView intensity={30} tint="dark" style={styles.navBlur}>
        
        {/* BOUTON ACCUEIL */}
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/search')}>
          <Ionicons name="home" size={24} color="white" />
          <Text style={styles.navLabel}>Accueil</Text>
        </TouchableOpacity>

        {/* BOUTON REELS (Redirige vers search ou une page dédiée) */}
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/')}>
          <MaterialCommunityIcons name="play-box-multiple" size={24} color="white" />
          <Text style={styles.navLabel}>Reels</Text>
        </TouchableOpacity>
        
        {/* BOUTON CENTRAL (Sparkles) */}
        <TouchableOpacity style={styles.navItem} onPress={()  => router.push('/feed')}>
          <MaterialCommunityIcons name="star-four-points" size={40} color="white" />
        </TouchableOpacity>

        {/* BOUTON AMIES */}
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/social')}>
          <Ionicons name="people" size={24} color="white" />
          <Text style={styles.navLabel}>Amies</Text>
        </TouchableOpacity>

        {/* BOUTON PROFIL */}
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
           {/* On surcharge le style pour annuler le marginTop de 4 et aligner l'image */}
           <Image 
             source={{uri: 'https://i.pravatar.cc/100?u=me'}} 
             style={[styles.navProfile, { marginTop: 0 }]} 
           />
           <Text style={styles.navLabel}>Profil</Text>
        </TouchableOpacity>

      </BlurView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧭 LAYOUT PRINCIPAL (Tabs)
// ─────────────────────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // On cache la barre native par défaut car on utilise notre CustomNavBar en overlay
        tabBarStyle: { display: 'none' }, 
      }}
      // On injecte notre barre personnalisée par dessus le contenu
      tabBar={() => <CustomNavBar />} 
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      {/* Ajoutez ici d'autres écrans si nécessaire (ex: profile.tsx, friends.tsx) */}
    </Tabs>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🖌 STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  navContainer: {
    position: 'absolute',
    bottom: 12, // Flottant au-dessus du bas de l'écran
    left: 10,
    right: 10,
    height: 70,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    // Ombres pour donner du relief
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 13.16,
    elevation: 20,
  },
  navBlur: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingTop: 10,
  },
  navLabel: {
    color: 'white',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  navCenterBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 4, // Fait dépasser le bouton vers le haut
    elevation: 10,
    shadowColor: COLORS.accent,
    shadowRadius: 10,
    shadowOpacity: 0.6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  navCenterGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navProfile: {
    width: 30,
    height: 30,
    marginTop: 10, // Fait dépasser le bouton vers le haut

    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
});