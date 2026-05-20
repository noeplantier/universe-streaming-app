import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';

import CustomNavBar from '../../components/CustomNavBar';

export default function TabLayout() {
  return (
    <View style={s.root}>
      {/* SCREENS */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          lazy: true,           // Charge l'onglet uniquement au moment où l'utilisateur clique dessus
          freezeOnBlur: true,   // Gèle l'état des onglets inactifs pour libérer le CPU/RAM
          sceneStyle: { backgroundColor: 'transparent' } // Évite la superposition inutile de couches de fond
        }}
      >
        <Tabs.Screen name="index"   options={{ title: 'Accueil' }} />
        <Tabs.Screen name="search"  options={{ title: 'Recherche' }} />
        <Tabs.Screen name="social"  options={{ title: 'Communauté' }} />
        <Tabs.Screen name="create"  options={{ title: 'Créer' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      </Tabs>

      {/* NAVBAR CUSTOM fixe en superposition */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <CustomNavBar />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#03000A' 
  },
});