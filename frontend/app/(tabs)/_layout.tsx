// app/(tabs)/_layout.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';

import Loading from '../../components/Loading';
import CustomNavBar from '../../components/CustomNavBar';

export default function TabLayout() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      {/* 📱 SCREENS */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, 
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
      </Tabs>

      {/* 🚀 FIXED NAVBAR OVERLAY */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <CustomNavBar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});