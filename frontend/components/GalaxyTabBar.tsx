// ─────────────────────────────────────────────
//  GalaxyTabBar — Bottom navigation
//  Glassmorphism + sparkle center button
// ─────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, GRADIENTS, RADIUS } from '../constants/theme';

export interface TabItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItem[] = [
  { key: 'accueil',  label: 'Accueil', icon: 'home-outline',   iconActive: 'home'            },
  { key: 'reels',   label: 'Reels',   icon: 'play-outline',    iconActive: 'play'            },
  { key: 'discover',label: '',        icon: 'sparkles',        iconActive: 'sparkles'        },
  { key: 'amies',   label: 'Amies',   icon: 'people-outline',  iconActive: 'people'          },
  { key: 'profil',  label: 'Profil',  icon: 'person-outline',  iconActive: 'person'          },
];

interface Props {
  activeTab: string;
  onTabPress: (key: string) => void;
  avatarUrl?: string;
}

function SparkleCenter({ onPress }: { onPress: () => void }) {
  const scale  = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const glow   = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1,   duration: 1500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  function handlePress() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1,    useNativeDriver: true }),
    ]).start();
    onPress();
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9} style={styles.sparkleWrap}>
      {/* Outer glow ring */}
      <Animated.View style={[styles.sparkleGlow, { opacity: glow }]} />
      {/* Spinning gradient ring */}
      <Animated.View style={[styles.sparkleRing, { transform: [{ rotate: spin }] }]}>
        <LinearGradient
          colors={['#E080FF', '#6B1FB0', '#E080FF']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      {/* Center button */}
      <Animated.View style={[styles.sparkleInner, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={GRADIENTS.primaryGlow}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.sparkleGradient}
        >
          <Ionicons name="sparkles" size={26} color="#fff" />
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function GalaxyTabBar({ activeTab, onTabPress, avatarUrl }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 12 }]}>
      {/* Glass background */}
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={styles.borderTop} />

      <View style={styles.row}>
        {TABS.map((tab, i) => {
          if (tab.key === 'discover') {
            return <SparkleCenter key={tab.key} onPress={() => onTabPress(tab.key)} />;
          }

          const isActive = activeTab === tab.key;
          const isLast   = tab.key === 'profil';

          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onTabPress(tab.key)}
              style={styles.tab}
              activeOpacity={0.7}
            >
              {isLast && avatarUrl ? (
                <View style={[styles.avatarThumb, isActive && styles.avatarThumbActive]}>
                  {/* If you have Image from RN */}
                </View>
              ) : (
                <View style={styles.iconWrap}>
                  {isActive && <View style={styles.iconGlow} />}
                  <Ionicons
                    name={isActive ? tab.iconActive : tab.icon}
                    size={24}
                    color={isActive ? COLORS.primaryLight : COLORS.textTertiary}
                  />
                </View>
              )}
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(8,0,16,0.85)',
  },
  borderTop: {
    height: 1,
    backgroundColor: 'rgba(155,63,222,0.3)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 42, height: 36,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  iconGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    opacity: 0.15,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textTertiary,
  },
  tabLabelActive: {
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
  avatarThumb: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  avatarThumbActive: {
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
  },
  // Sparkle center
  sparkleWrap: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  sparkleGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    transform: [{ scale: 1.4 }],
  },
  sparkleRing: {
    position: 'absolute',
    width: 58, height: 58,
    borderRadius: 29,
    overflow: 'hidden',
  },
  sparkleInner: {
    width: 52, height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  sparkleGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
