import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

const FEATURES = [
  { id: 'home',     icon: 'planet-outline',          label: 'Accueil',    route: '/(tabs)' },
  { id: 'feed',     icon: 'play-circle-outline',      label: 'Feed',       route: '/(tabs)/feed' },
  { id: 'social',   icon: 'people-outline',           label: 'Social',     route: '/(tabs)/social' },
  { id: 'search',   icon: 'compass-outline',          label: 'Découvrir',  route: '/(tabs)/search' },
  { id: 'watchlist',icon: 'bookmark-outline',         label: 'Watchlist',  route: '/watchlist' },
  { id: 'profile',  icon: 'person-circle-outline',    label: 'Profil',     route: '/(tabs)/profile' },
  { id: 'settings', icon: 'settings-outline',         label: 'Réglages',   route: '/settings' },
] as const;

interface Props {
  notificationCount?: number;
}

export default function GlobalHeader({ notificationCount = 2 }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (notificationCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [notificationCount]);

  function isActive(route: string) {
    if (route === '/(tabs)') return pathname === '/' || pathname === '/index';
    return pathname.includes(route.replace('/(tabs)', '').replace('/', ''));
  }

  return (
    <View style={styles.container}>
      {/* Top Row */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.8}>
          <Text style={styles.logo}>UNIVERSE</Text>
        </TouchableOpacity>

        <View style={styles.topRight}>
          {/* Notification Bell */}
          <TouchableOpacity
            testID="header-notifications-btn"
            onPress={() => router.push('/notifications')}
            style={styles.iconBtn}
          >
            <Animated.View style={{ transform: [{ scale: notificationCount > 0 ? pulseAnim : new Animated.Value(1) }] }}>
              <Ionicons name="notifications-outline" size={22} color={COLORS.textSecondary} />
            </Animated.View>
            {notificationCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notificationCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Avatar */}
          {user ? (
            <TouchableOpacity
              testID="header-profile-btn"
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.avatarBtn}
            >
              <LinearGradient colors={GRADIENTS.primary} style={styles.avatarRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.iconBtn}>
              <Ionicons name="person-circle-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick Nav Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickNav}
      >
        {FEATURES.map(f => {
          const active = isActive(f.route);
          return (
            <TouchableOpacity
              key={f.id}
              testID={`header-nav-${f.id}`}
              onPress={() => router.push(f.route as any)}
              style={styles.navItem}
              activeOpacity={0.75}
            >
              {active ? (
                <LinearGradient
                  colors={GRADIENTS.primary}
                  style={styles.navItemActive}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name={f.icon as any} size={14} color="#fff" />
                  <Text style={[styles.navLabel, { color: '#fff', fontWeight: '700' }]}>{f.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.navItemInactive}>
                  <Ionicons name={f.icon as any} size={14} color={COLORS.textTertiary} />
                  <Text style={styles.navLabel}>{f.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(140,46,186,0.15)',
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenEdge,
    paddingTop: 8,
    paddingBottom: 10,
  },
  logo: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 5,
    textShadowColor: '#8C2EBA',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 19,
    position: 'relative',
  },
  badge: {
    position: 'absolute', top: 2, right: 2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.background,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  avatarBtn: {},
  avatarRing: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.background },
  quickNav: {
    paddingHorizontal: SPACING.screenEdge,
    gap: 6,
    alignItems: 'center',
  },
  navItem: { borderRadius: RADIUS.full, overflow: 'hidden' },
  navItemActive: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  navItemInactive: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'rgba(140,46,186,0.15)',
  },
  navLabel: { color: COLORS.textTertiary, fontSize: 12, fontWeight: '500' },
});
