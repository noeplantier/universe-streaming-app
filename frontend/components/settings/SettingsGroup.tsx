import React, {
    memo, useState, useCallback, type ReactNode,
  } from 'react';
  import {
    View, Text, StyleSheet, TouchableOpacity, Switch,
    Modal, Pressable, ScrollView, Animated, Platform,
  } from 'react-native';
  import { BlurView }       from 'expo-blur';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }       from '@expo/vector-icons';
  import * as Haptics       from 'expo-haptics';
  
  import { G } from './types';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Section header
  // ─────────────────────────────────────────────────────────────────────────────
  
  export const SectionHeader = memo(function SectionHeader({
    title, icon,
  }: { title: string; icon?: string }) {
    return (
      <View style={sh.row}>
        {icon && <Ionicons name={icon as any} size={13} color={G.primary} style={{ marginTop: 1 }} />}
        <Text style={sh.txt}>{title.toUpperCase()}</Text>
      </View>
    );
  });
  
  const sh = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 },
    txt: { fontSize: 11, fontWeight: '800', color: 'rgba(192,96,255,0.65)', letterSpacing: 1.4 },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Conteneur group
  // ─────────────────────────────────────────────────────────────────────────────
  
  export const SettingsGroup = memo(function SettingsGroup({
    children,
  }: { children: ReactNode }) {
    return (
      <View style={sg.wrap}>
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={sg.border} />
        {children}
      </View>
    );
  });
  
  const sg = StyleSheet.create({
    wrap:   { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: G.glassBorder, backgroundColor: 'rgba(13,0,37,0.6)' },
    border: { ...StyleSheet.absoluteFillObject, borderRadius: 18 },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Ligne générique
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface RowProps {
    icon:      string;
    title:     string;
    subtitle?: string;
    onPress?:  () => void;
    danger?:   boolean;
    right?:    ReactNode;
    last?:     boolean;
    badge?:    string;
  }
  
  export const SettingsRow = memo(function SettingsRow({
    icon, title, subtitle, onPress, danger, right, last, badge,
  }: RowProps) {
    const iconBg = danger
      ? 'rgba(255,59,48,0.15)'
      : 'rgba(192,96,255,0.14)';
    const iconColor = danger ? G.red : G.primary;
  
    const handlePress = useCallback(() => {
      if (!onPress) return;
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }, [onPress]);
  
    return (
      <TouchableOpacity
        onPress={handlePress}
        style={[sr.row, !last && sr.divider]}
        activeOpacity={onPress ? 0.7 : 1}
      >
        {/* Icône */}
        <View style={[sr.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={18} color={iconColor} />
        </View>
  
        {/* Texte */}
        <View style={sr.info}>
          <View style={sr.titleRow}>
            <Text style={[sr.title, danger && { color: G.red }]}>{title}</Text>
            {badge ? (
              <View style={sr.badge}>
                <Text style={sr.badgeTxt}>{badge}</Text>
              </View>
            ) : null}
          </View>
          {subtitle ? <Text style={sr.sub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
  
        {/* Droite */}
        {right ?? (
          onPress && !danger
            ? <Ionicons name="chevron-forward" size={15} color="rgba(237,232,255,0.22)" />
            : null
        )}
      </TouchableOpacity>
    );
  });
  
  const sr = StyleSheet.create({
    row:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
    iconWrap:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    info:    { flex: 1 },
    titleRow:{ flexDirection: 'row', alignItems: 'center', gap: 7 },
    title:   { fontSize: 15, color: G.sW, fontWeight: '500' },
    sub:     { fontSize: 12, color: G.textTert, marginTop: 2 },
    badge:   { backgroundColor: G.primaryDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, borderWidth: 1, borderColor: G.borderActive },
    badgeTxt:{ color: G.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Toggle — Switch animé
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface ToggleProps {
    icon:      string;
    title:     string;
    subtitle?: string;
    value:     boolean;
    onChange:  (v: boolean) => void;
    last?:     boolean;
  }
  
  export const SettingsToggle = memo(function SettingsToggle({
    icon, title, subtitle, value, onChange, last,
  }: ToggleProps) {
    return (
      <SettingsRow
        icon={icon}
        title={title}
        subtitle={subtitle}
        last={last}
        right={
          <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: 'rgba(255,255,255,0.12)', true: G.primary }}
            thumbColor="#fff"
            ios_backgroundColor="rgba(255,255,255,0.12)"
          />
        }
      />
    );
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Picker — Bottom-sheet de sélection
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface PickerProps<T extends string> {
    icon:     string;
    title:    string;
    value:    T;
    options:  { value: T; label: string; description?: string }[];
    onChange: (v: T) => void;
    last?:    boolean;
  }
  
  export function SettingsPicker<T extends string>({
    icon, title, value, options, onChange, last,
  }: PickerProps<T>) {
    const [open, setOpen] = useState(false);
  
    const current = options.find(o => o.value === value);
  
    const handleSelect = useCallback((v: T) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChange(v);
      setOpen(false);
    }, [onChange]);
  
    return (
      <>
        <SettingsRow
          icon={icon}
          title={title}
          subtitle={current?.label}
          onPress={() => setOpen(true)}
          last={last}
        />
  
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
          statusBarTranslucent
        >
          <Pressable style={pk.backdrop} onPress={() => setOpen(false)} />
          <View style={pk.sheet}>
            <View style={pk.handle} />
            <Text style={pk.sheetTitle}>{title}</Text>
  
            <LinearGradient
              colors={['transparent', G.primary, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={pk.sep}
            />
  
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {options.map((opt, i) => {
                const selected = opt.value === value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => handleSelect(opt.value)}
                    style={[pk.option, i < options.length - 1 && pk.optDivider]}
                    activeOpacity={0.8}
                  >
                    <View style={pk.optLeft}>
                      <Text style={[pk.optLabel, selected && pk.optLabelOn]}>
                        {opt.label}
                      </Text>
                      {opt.description ? (
                        <Text style={pk.optDesc}>{opt.description}</Text>
                      ) : null}
                    </View>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={G.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      </>
    );
  }
  
  const pk = StyleSheet.create({
    backdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet:     { backgroundColor: '#0E0028', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 40, maxHeight: '75%', borderTopWidth: 1, borderColor: 'rgba(192,96,255,0.2)' },
    handle:    { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 16 },
    sheetTitle:{ color: G.sW, fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 14 },
    sep:       { height: 1, marginBottom: 14 },
    option:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4 },
    optDivider:{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
    optLeft:   { flex: 1 },
    optLabel:  { color: 'rgba(237,232,255,0.75)', fontSize: 15, fontWeight: '500' },
    optLabelOn:{ color: G.sW, fontWeight: '700' },
    optDesc:   { color: G.textTert, fontSize: 11, marginTop: 3 },
  });