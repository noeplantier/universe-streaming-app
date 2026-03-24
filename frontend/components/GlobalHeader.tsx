// components/GlobalHeader.tsx

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

const TYPES = [
  'Séries',
  'Films',
  'Longs métrages',
  'Courts métrages',
  'Moyens métrages',
];

const TABS = ['Séries', 'Films', 'Catégories'];

export default function GlobalHeader({ notificationCount = 2 }) {
  const router = useRouter();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Séries');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notificationCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const handleSearch = (text: string) => {
    setQuery(text);
    // logique simple filtrage type
    const filteredType = TYPES.find(t => text.toLowerCase().includes(t.toLowerCase()));
    if (filteredType) setActiveTab(filteredType);
  };

  const handleFocus = () => {
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const glow = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(140,46,186,0.2)', 'rgba(168,85,247,0.8)'],
  });

  return (
    <View style={styles.container}>
      {/* TOP */}
      <View style={styles.topRow}>
        <Text style={styles.logo}>Rechercher</Text>

        <View style={styles.topRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons name="search-outline" size={22} color={COLORS.textSecondary} />
            </Animated.View>
          </TouchableOpacity>

          {user && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* SEARCH BAR */}
      <Animated.View style={[styles.searchWrapper, { borderColor: glow }]}>
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" />
        <TextInput
          placeholder="Rechercher dans Universe..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.input}
          value={query}
          onChangeText={handleSearch}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Animated.View>

      {/* TABS */}
      <View style={styles.tabsRow}>
        {TABS.map(tab => {
          const active = tab === activeTab;

          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.85}
            >
              {active ? (
                <LinearGradient
                  colors={GRADIENTS.primary}
                  style={styles.tabActive}
                >
                  <Text style={styles.tabTextActive}>{tab}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.tabInactive}>
                  <Text style={styles.tabText}>{tab}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(140,46,186,0.2)',
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenEdge,
    paddingVertical: 10,
    alignItems: 'center',
  },

  logo: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: '800',
  },

  topRight: { flexDirection: 'row', gap: 10 },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  searchWrapper: {
    marginHorizontal: SPACING.screenEdge,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
  },

  tabsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingHorizontal: SPACING.screenEdge,
    gap: 10,
  },

  tabActive: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },

  tabInactive: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  tabText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },

  tabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
});