/**
 * app/(tabs)/_layout.tsx
 *
 * Layout des onglets principaux Universe
 * La prévention des screenshots est gérée dans app/_layout.tsx (root).
 * Ce fichier orchestre uniquement les tabs + CustomNavBar.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs }             from 'expo-router';

import CustomNavBar         from '../../components/CustomNavBar';

export default function TabLayout() {
  return (
    <View style={s.root}>
      {/* SCREENS */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },  
          animation:   'shift',
        }}
      >
        <Tabs.Screen name="index"  options={{ title: 'Accueil' }}/>
        <Tabs.Screen name="search" options={{ title: 'Recherche' }}/>
        <Tabs.Screen name="social" options={{ title: 'Communauté' }}/>
        <Tabs.Screen name="create" options={{ title: 'Créer' }}/>
        <Tabs.Screen name="profile"options={{ title: 'Profil' }}/>
      </Tabs>

      {/* NAVBAR CUSTOM fixe en superposition */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <CustomNavBar/>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#03000A' },
});