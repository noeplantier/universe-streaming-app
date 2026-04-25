import React, { useCallback, memo, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { BlurView }      from 'expo-blur';
import { Ionicons }      from '@expo/vector-icons';
import * as Haptics      from 'expo-haptics';
import { StatusBar }     from 'expo-status-bar';
import { TouchableOpacity, Text } from 'react-native';

import GalaxyBackground from '@/components/social/GalaxyBackground';
import VideoTab         from '@/components/create/VideoTab';
import CritiqueTab      from '@/components/create/CritiqueTab';

// ─── Palette ─────────────────────────────────────────────────────────────────
const P = {
  bg:      '#03000A',
  edge:    'rgba(255,255,255,0.08)',
  edgeMid: 'rgba(255,255,255,0.14)',
  navyMid: '#0D2240',
  white:   '#FFFFFF',
  txtTert: 'rgba(255,255,255,0.24)',
} as const;

type Tab = 'video' | 'critique';

const TAB_CONFIG = [
  { id: 'video'    as Tab, label: 'Vidéo',    icon: 'videocam-outline'      as const },
  { id: 'critique' as Tab, label: 'Critique', icon: 'document-text-outline' as const },
];

// ─── Tab item ────────────────────────────────────────────────────────────────
const TabItem = memo(({ cfg, active, onPress }: {
  cfg: (typeof TAB_CONFIG)[0]; active: boolean; onPress: (t: Tab) => void;
}) => {
  const press = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(cfg.id);
  }, [cfg.id, onPress]);

  return (
    <TouchableOpacity
      style={[tb.tab, active && tb.tabActive]}
      onPress={press}
      activeOpacity={0.8}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      {active && (
        <BlurView
          intensity={Platform.OS === 'ios' ? 24 : 14}
          tint="light"
          style={[StyleSheet.absoluteFillObject, tb.pill]}
        />
      )}
      <Ionicons name={cfg.icon} size={14} color={active ? P.white : P.txtTert} />
      <Text style={[tb.label, active ? tb.labelOn : tb.labelOff]}>{cfg.label}</Text>
    </TouchableOpacity>
  );
});
TabItem.displayName = 'TabItem';

// ─── Tab panels (mounted once, hidden via position absolute) ──────────────────
const TabPanels = memo(({ active }: { active: Tab }) => (
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
));
TabPanels.displayName = 'TabPanels';

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('video');
  const handleSwitch = useCallback((t: Tab) => setActiveTab(t), []);

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <SafeAreaView style={s.safe}>
        {/* Tab bar */}
        <View style={tb.wrap}>
          {TAB_CONFIG.map(cfg => (
            <TabItem
              key={cfg.id}
              cfg={cfg}
              active={activeTab === cfg.id}
              onPress={handleSwitch}
            />
          ))}
        </View>

        <View style={{ flex: 1 }}>
          <TabPanels active={activeTab} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  safe:      { flex: 1 },
});

const tb = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: P.edge,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: P.edge,
    padding: 4,
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  tab:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14, overflow: 'hidden' },
  tabActive:{},
  pill:     { borderRadius: 14, overflow: 'hidden', backgroundColor: P.navyMid, borderWidth: 0.5, borderColor: P.edgeMid },
  label:    { fontSize: 13, fontWeight: '600' },
  labelOn:  { color: P.white, fontWeight: '700' },
  labelOff: { color: P.txtTert },
});

const tp = StyleSheet.create({
  panel:  { flex: 1 },
  hidden: { position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden' },
});