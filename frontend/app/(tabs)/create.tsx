import React, { useState, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';

import GalaxyBackground from '@/components/social/GalaxyBackground';
import VideoTab         from '@/components/create/VideoTab';
import CritiqueTab      from '@/components/create/CritiqueTab';
import { C }            from '@/components/create/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// Tab bar — matches the screenshot (purple active pill on dark background)
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'video' | 'critique';

const TAB_CONFIG: { id: Tab; label: string; icon: any }[] = [
  { id: 'video',    label: 'Vidéo',    icon: 'videocam-outline' },
  { id: 'critique', label: 'Critique', icon: 'document-text-outline' },
];

const TabBar = memo(function TabBar({
  active, onSwitch,
}: { active: Tab; onSwitch: (t: Tab) => void }) {
  return (
    <View style={tb.wrap}>
      {TAB_CONFIG.map(({ id, label, icon }) => {
        const on = active === id;
        return (
          <TouchableOpacity
            key={id}
            style={[tb.tab, on && tb.tabActive]}
            onPress={() => onSwitch(id)}
            activeOpacity={0.8}
          >
            {on ? (
              <LinearGradient
                colors={['#7C3AED', '#6D28D9']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Ionicons
              name={icon}
              size={16}
              color={on ? 'white' : C.textSec}
            />
            <Text style={[tb.label, on && tb.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const tb = StyleSheet.create({
  wrap:        {
    flexDirection:   'row',
    marginHorizontal: 16,
    marginBottom:     16,
    backgroundColor:  'rgba(255,255,255,0.06)',
    borderRadius:     18,
    borderWidth:      1,
    borderColor:      C.border,
    padding:          4,
    overflow:         'hidden',
  },
  tab:         {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             7,
    paddingVertical: 12,
    borderRadius:    14,
    overflow:        'hidden',
    position:        'relative',
  },
  tabActive:   {},
  label:       { color: C.textSec, fontSize: 14, fontWeight: '600' },
  labelActive: { color: 'white',   fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('video');

  const handleSwitch = useCallback((t: Tab) => setActiveTab(t), []);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Créer</Text>
        </View>

        {/* Tab switcher */}
        <TabBar active={activeTab} onSwitch={handleSwitch} />

        {/* Content */}
        <View style={{ flex: 1 }}>
          {activeTab === 'video'    && <VideoTab />}
          {activeTab === 'critique' && <CritiqueTab />}
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg0 },
  header:      { alignItems: 'center', paddingTop: 8, paddingBottom: 14 },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
});