/**
 * app/(tabs)/create.tsx
 * Onglet Créer — Vidéo · Critique
 * Thème : transparences navy sur GalaxyBackground
 */

import React, { useCallback, memo, useState } from 'react';
import { View, StyleSheet, Platform, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { BlurView }      from 'expo-blur';
import { Ionicons }      from '@expo/vector-icons';
import * as Haptics      from 'expo-haptics';
import { StatusBar }     from 'expo-status-bar';

import GalaxyBackground from '@/components/shared/GalaxyBackground';
import VideoTab         from '@/components/create/VideoTab';
import CritiqueTab      from '@/components/create/CritiqueTab';

// ─────────────────────────────────────────────────────────────────────────────
// Tokens — navy transparent + blanc
// ─────────────────────────────────────────────────────────────────────────────
export const C = {
  navyMid:  'rgba(13,34,64,0.55)',
  navyLow:  'rgba(13,34,64,0.30)',
  navyHigh: 'rgba(13,34,64,0.80)',
  border:   'rgba(255,255,255,0.09)',
  borderBr: 'rgba(255,255,255,0.18)',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.85)',
  muted:    'rgba(255,255,255,0.38)',
  faint:    'rgba(255,255,255,0.14)',
  neon:      '#FFFFFF',
  neonL:    'rgba(13,34,64,0.55)',
  gold:     '#F5C842',
  success:  '#22C55E',
  error:    '#EF4444',
} as const;

type Tab = 'video' | 'critique';

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: 'video',    label: 'Vidéo',    icon: 'videocam',      desc: 'Publie un reel' },
  { id: 'critique', label: 'Critique', icon: 'document-text', desc: 'Partage ton avis' },
];

// ─────────────────────────────────────────────────────────────────────────────
// TabBar
// ─────────────────────────────────────────────────────────────────────────────
const TabBar = memo(function TabBar({
  active, onChange,
}: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={tb.wrap}>
      {TABS.map(t => {
        const on = active === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={[tb.tab, on && tb.tabOn]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(t.id);
            }}
            activeOpacity={0.78}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            {on && (
              <BlurView
                intensity={Platform.OS === 'ios' ? 20 : 12}
                tint="dark"
                style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]}
              />
            )}
            {on && <View style={tb.activeBorder} />}

            <Ionicons
              name={(on ? t.icon : `${t.icon}-outline`) as any}
              size={15}
              color={on ? C.white : C.muted}
            />
            <View style={{ gap: 1 }}>
              <Text style={[tb.label, on ? tb.labelOn : tb.labelOff]}>{t.label}</Text>
              {on && <Text style={tb.desc}>{t.desc}</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const tb = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: C.navyMid,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: 4,
    gap: 4,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tabOn: {},
  activeBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderBr,
  },
  label:   { fontSize: 13, fontWeight: '600' },
  labelOn: { color: C.white, fontWeight: '700' },
  labelOff:{ color: C.muted },
  desc:    { color: 'rgba(255,255,255,0.35)', fontSize: 9 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Panels — montés une seule fois
// ─────────────────────────────────────────────────────────────────────────────
const TabPanels = memo(function TabPanels({ active }: { active: Tab }) {
  return (
    <>
      <View
        style={[tp.panel, active !== 'video' && tp.hidden]}
        pointerEvents={active === 'video' ? 'auto' : 'none'}
      >
        <VideoTab />
      </View>
      <View
        style={[tp.panel, active !== 'critique' && tp.hidden]}
        pointerEvents={active === 'critique' ? 'auto' : 'none'}
      >
        <CritiqueTab />
      </View>
    </>
  );
});

const tp = StyleSheet.create({
  panel:  { flex: 1 },
  hidden: { position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const [active, setActive] = useState<Tab>('video');

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Créer</Text>
          <Text style={s.subtitle}>Publie ta création dans l'univers</Text>
        </View>

        <TabBar active={active} onChange={setActive} />

        <View style={{ flex: 1 }}>
          <TabPanels active={active} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#03000A' },
  safe:     { flex: 1 },
  header:   { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 18 },
  title:    { color: C.white, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: C.muted, fontSize: 12, marginTop: 3 },
});