
import React, {
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { BlurView }      from 'expo-blur';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';

import GalaxyBackground from '@/components/social/GalaxyBackground';
import VideoTab         from '@/components/create/VideoTab';
import CritiqueTab      from '@/components/create/CritiqueTab';
import { C }            from '@/components/create/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'video' | 'critique';

// ─────────────────────────────────────────────────────────────────────────────
// 🗂️ STATIC CONFIG — instancié une seule fois, jamais recréé
// ─────────────────────────────────────────────────────────────────────────────
interface TabConfig {
  id:    Tab;
  label: string;
  icon:  'videocam-outline' | 'document-text-outline';
}

const TABS: readonly TabConfig[] = [
  { id: 'video',    label: 'Vidéo',    icon: 'videocam-outline'       },
  { id: 'critique', label: 'Critique', icon: 'document-text-outline'  },
] as const;

// Palette neutre — aucun violet, aucun bleu
// Active : blanc pur + frost blur
// Inactive : blanc très atténué
const PALETTE = {
  activeTxt:   '#FFFFFF',
  inactiveTxt: 'rgba(255,255,255,0.32)',
  activeIcon:  '#FFFFFF',
  inactiveIcon:'rgba(255,255,255,0.32)',
  pillBg:      'rgba(255,255,255,0.10)',   // frost inactif
  wrapBg:      'rgba(10,10,14,0.55)',      // verre sombre
  wrapBorder:  'rgba(255,255,255,0.07)',
  activeBorder:'rgba(255,255,255,0.18)',   // liseré actif
  glow:        'rgba(255,255,255,0.06)',   // halo très subtil
} as const;

const HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// 🎛️ TAB ITEM — memo strict, ref de callback stable (via index handler)
// ─────────────────────────────────────────────────────────────────────────────
interface TabItemProps {
  config:   TabConfig;
  active:   boolean;
  onPress:  (id: Tab) => void;
}

const TabItem = memo(({ config, active, onPress }: TabItemProps) => {
  // Callback stable par item (id capturé une fois à la création)
  const handlePress = useCallback(() => onPress(config.id), [config.id, onPress]);

  return (
    <TouchableOpacity
      style={[tb.tab, active && tb.tabActive]}
      onPress={handlePress}
      activeOpacity={0.75}
      hitSlop={HIT_SLOP}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={config.label}
    >
      {/* Frost pill actif */}
      {active && (
        <BlurView
          intensity={Platform.OS === 'ios' ? 28 : 18}
          tint="light"
          style={[StyleSheet.absoluteFillObject, tb.pillBlur]}
        />
      )}

      {/* Liseré lumineux en haut du pill actif */}
      {active && <View style={tb.activeLine} pointerEvents="none" />}

      <Ionicons
        name={config.icon}
        size={15}
        color={active ? PALETTE.activeIcon : PALETTE.inactiveIcon}
      />
      <Text style={[tb.label, active ? tb.labelActive : tb.labelInactive]}>
        {config.label}
      </Text>
    </TouchableOpacity>
  );
});
TabItem.displayName = 'TabItem';

// ─────────────────────────────────────────────────────────────────────────────
// 🔲 TAB BAR — memo, handlers stables transmis depuis le parent
// ─────────────────────────────────────────────────────────────────────────────
interface TabBarProps {
  active:   Tab;
  onSwitch: (t: Tab) => void;
}

const TabBar = memo(({ active, onSwitch }: TabBarProps) => (
  <View style={tb.wrap}>
    {TABS.map((cfg) => (
      <TabItem
        key={cfg.id}
        config={cfg}
        active={active === cfg.id}
        onPress={onSwitch}
      />
    ))}
  </View>
));
TabBar.displayName = 'TabBar';

const tb = StyleSheet.create({
  wrap: {
    flexDirection:    'row',
    marginHorizontal: 16,
    marginBottom:     16,
    backgroundColor:  PALETTE.wrapBg,
    borderRadius:     18,
    borderWidth:      0.5,
    borderColor:      PALETTE.wrapBorder,
    padding:          4,
    overflow:         'hidden',
    // Ombre douce iOS — Android : elevation légère
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius:  12,
      },
      android: { elevation: 6 },
    }),
  },

  tab: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: 11,
    borderRadius:    14,
    overflow:        'hidden',
    position:        'relative',
    // fond pill inactif très discret
    backgroundColor: 'transparent',
  },

  tabActive: {
    // légère élévation du pill sur Android
    ...Platform.select({ android: { elevation: 2 } }),
  },

  pillBlur: {
    borderRadius:  14,
    overflow:      'hidden',
    // surcouche sombre supplémentaire pour iOS (BlurView donne du blanc)
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth:    0.5,
    borderColor:    PALETTE.activeBorder,
  },

  // Trait lumineux 1 px en haut du pill actif
  activeLine: {
    position:        'absolute',
    top:             0,
    left:            '15%' as any,
    right:           '15%' as any,
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius:    1,
  },

  label: {
    fontSize:   14,
    fontWeight: '600',
  },
  labelActive: {
    color:      PALETTE.activeTxt,
    fontWeight: '700',
  },
  labelInactive: {
    color: PALETTE.inactiveTxt,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 📋 HEADER — mémoïsé, jamais re-rendu
// ─────────────────────────────────────────────────────────────────────────────
const ScreenHeader = memo(() => (
  <View style={s.header}>
    <Text style={s.headerTitle}>Créer</Text>
    <View style={s.headerRule} />
  </View>
));
ScreenHeader.displayName = 'ScreenHeader';

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 TAB PANELS — montés une seule fois, masqués via display:'none'
//    → VideoTab et CritiqueTab conservent leur état interne indéfiniment
//    → 0 remontage, 0 reset de formulaire, 0 jank au switch
// ─────────────────────────────────────────────────────────────────────────────
const VideoPanel    = memo(() => <VideoTab />);
const CritiquePanel = memo(() => <CritiqueTab />);
VideoPanel.displayName    = 'VideoPanel';
CritiquePanel.displayName = 'CritiquePanel';

interface TabPanelsProps { active: Tab }

const TabPanels = memo(({ active }: TabPanelsProps) => {
  const videoStyle    = useMemo(() => [s.panel, active !== 'video'    && s.hidden], [active]);
  const critiqueStyle = useMemo(() => [s.panel, active !== 'critique' && s.hidden], [active]);

  return (
    <>
      <View style={videoStyle}    pointerEvents={active === 'video'    ? 'auto' : 'none'}>
        <VideoPanel />
      </View>
      <View style={critiqueStyle} pointerEvents={active === 'critique' ? 'auto' : 'none'}>
        <CritiquePanel />
      </View>
    </>
  );
});
TabPanels.displayName = 'TabPanels';

// ─────────────────────────────────────────────────────────────────────────────
// 🏠 CREATE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('video');

  // Callback stable — useCallback avec [] : ref identique entre tous les renders
  const handleSwitch = useCallback((t: Tab) => setActiveTab(t), []);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <SafeAreaView style={s.safe}>
        <ScreenHeader />
        <TabBar active={activeTab} onSwitch={handleSwitch} />
        <View style={s.panelWrap}>
          <TabPanels active={activeTab} />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 💅 STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: C.bg0,
  },

  safe: { flex: 1 },

  header: {
    alignItems:    'center',
    paddingTop:     8,
    paddingBottom:  14,
  },
  headerTitle: {
    color:         '#FFFFFF',
    fontSize:       20,
    fontWeight:    '800',
    letterSpacing: -0.3,
  },
  // Séparateur lumineux très subtil sous le titre
  headerRule: {
    marginTop:       8,
    width:           32,
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius:    1,
  },

  panelWrap: { flex: 1 },

  panel:  { flex: 1 },

  // display:'none' équivalent en RN — retire du layout ET de l'arbre de rendu
  // mais le composant reste MONTÉ (état conservé)
  hidden: {
    position:  'absolute',
    opacity:    0,
    pointerEvents: 'none' as any,
    // Hauteur/largeur à 0 masque visuellement sans démonter
    width:     0,
    height:    0,
    overflow:  'hidden',
  },
});