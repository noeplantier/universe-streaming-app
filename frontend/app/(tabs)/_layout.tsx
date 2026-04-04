import React, { useEffect, useState } from 'react';
import Loading from '../../components/Loading'; 
import CustomNavBar from '../../components/CustomNavBar';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500); // durée UX Apple-like

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={() => <CustomNavBar />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}