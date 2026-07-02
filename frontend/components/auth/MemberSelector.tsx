/**
 * components/auth/MemberSelector.tsx — Sélecteur de membre équipe Universe
 *
 * Affiche les 8 membres sous forme de chips horizontaux scrollables.
 * Chaque chip montre les initiales du membre dans un cercle coloré.
 * La sélection déclenche onSelect(displayName).
 */

import React, { memo } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─────────────────────────────────────────────────────────────────────────────
// Membres de l'équipe Universe
// ─────────────────────────────────────────────────────────────────────────────
export const TEAM_MEMBERS = [
  { name: 'Aresse',    initials: 'AR', color: ['#7C3AED','#5B21B6'] as [string,string] },
  { name: 'Chassaing', initials: 'CH', color: ['#0EA5E9','#0369A1'] as [string,string] },
  { name: 'BSE',       initials: 'BS', color: ['#10B981','#047857'] as [string,string] },
  { name: 'Sharl',     initials: 'SH', color: ['#F59E0B','#B45309'] as [string,string] },
  { name: 'Clem',      initials: 'CL', color: ['#EC4899','#9D174D'] as [string,string] },
  { name: 'Enzo',      initials: 'EN', color: ['#EF4444','#991B1B'] as [string,string] },
  { name: 'NOX',       initials: 'NX', color: ['#8B5CF6','#6D28D9'] as [string,string] },
  { name: 'Maxime',    initials: 'MX', color: ['#14B8A6','#0F766E'] as [string,string] },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  selected?:  string | null;
  onSelect:   (name: string) => void;
  disabled?:  boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// MemberSelector
// ─────────────────────────────────────────────────────────────────────────────
export default memo(function MemberSelector({ selected, onSelect, disabled }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      bounces
    >
      {TEAM_MEMBERS.map(m => {
        const isSelected = selected === m.name;
        return (
          <Pressable
            key={m.name}
            onPress={() => !disabled && onSelect(m.name)}
            disabled={disabled}
            style={({ pressed }) => [
              s.chip,
              isSelected && s.chipSelected,
              pressed && !disabled && !isSelected && s.chipPressed,
            ]}
            accessibilityLabel={`Se connecter en tant que ${m.name}`}
            accessibilityRole="button"
          >
            {/* Avatar avec gradient couleur du membre */}
            <LinearGradient
              colors={m.color}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.avatar, isSelected && s.avatarSelected]}
            >
              <Text style={s.initials}>{m.initials}</Text>
            </LinearGradient>

            {/* Nom */}
            <Text style={[s.name, isSelected && s.nameSelected]} numberOfLines={1}>
              {m.name}
            </Text>

            {/* Indicateur de sélection */}
            {isSelected && <View style={[s.indicator, { backgroundColor: m.color[0] }]} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  row: {
    paddingHorizontal: 24,
    gap: 10,
    paddingVertical: 4,
  },

  chip: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    minWidth: 72,
  },
  chipSelected: {
    borderColor: 'rgba(139,92,246,0.5)',
    backgroundColor: 'rgba(139,92,246,0.12)',
  },
  chipPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: {
    shadowColor: '#8B5CF6',
    shadowRadius: 12,
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },

  initials: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  name: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  nameSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
