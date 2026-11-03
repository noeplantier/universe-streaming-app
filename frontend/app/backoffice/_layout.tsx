import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Slot } from 'expo-router';
import { canAccess } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function BackofficeLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#03020A' }}>
        <ActivityIndicator color="#5A96E6" />
      </View>
    );
  }

  if (!canAccess(user, 'backoffice')) return <Redirect href="/(tabs)" />;
  return <Slot />;
}
