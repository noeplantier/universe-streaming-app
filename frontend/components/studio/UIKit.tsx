
import React, { memo, useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, ActivityIndicator,
} from 'react-native';
import { BlurView }      from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }      from '@expo/vector-icons';
import { G, WIZARD_STEPS, type AppMode, type WizardStep } from './constants';

// ─── Badge ────────────────────────────────────────────────────────

export const Badge = memo(function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[bds.wrap, { backgroundColor: `${color}1A`, borderColor: `${color}44` }]}>
      <Text style={[bds.txt, { color }]}>{label}</Text>
    </View>
  );
});

const bds = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  txt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
});

// ─── ScanlineOverlay ──────────────────────────────────────────────

export const ScanlineOverlay = memo(function ScanlineOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 28 }, (_, i) => (
        <View key={i} style={[sco.line, { top: i * (800 / 28) }]} />
      ))}
    </View>
  );
});

const sco = StyleSheet.create({
  line: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(192,96,255,0.015)' },
});

// ─── SectionHeader ────────────────────────────────────────────────

export const SectionHeader = memo(function SectionHeader({
  icon, title, sub,
}: { icon: string; title: string; sub?: string }) {
  return (
    <View style={shn.wrap}>
      <LinearGradient
        colors={['rgba(192,96,255,0.18)', 'rgba(108,16,195,0.10)']}
        style={shn.iconCircle}
      >
        <Ionicons name={icon as any} size={18} color={G.primary} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={shn.title}>{title}</Text>
        {sub && <Text style={shn.sub}>{sub}</Text>}
      </View>
    </View>
  );
});

const shn = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(192,96,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  title:      { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  sub:        { color: G.textSub, fontSize: 12, marginTop: 1 },
});

// ─── StepBar ──────────────────────────────────────────────────────

export const StepBar = memo(function StepBar({ step, mode }: { step: WizardStep; mode: AppMode }) {
  const steps = mode === 'video' ? WIZARD_STEPS : ['Critique', 'Publier'];
  return (
    <View style={stb.wrap}>
      {steps.map((label, i) => {
        const active = i === step;
        const done   = i < step;
        return (
          <React.Fragment key={label}>
            <View style={stb.item}>
              <View style={[stb.dot, done && stb.dotDone, active && stb.dotActive]}>
                {done
                  ? <Ionicons name="checkmark" size={10} color="#fff" />
                  : <Text style={stb.dotNum}>{i + 1}</Text>}
              </View>
              <Text style={[stb.label, (active || done) && stb.labelOn]} numberOfLines={1}>{label}</Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[stb.line, done && stb.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
});

const stb = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginVertical: 16 },
  item:      { alignItems: 'center', gap: 4, minWidth: 52 },
  dot:       { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  dotActive: { borderColor: G.primary, backgroundColor: 'rgba(192,96,255,0.2)' },
  dotDone:   { borderColor: G.success, backgroundColor: G.success },
  dotNum:    { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800' },
  label:     { color: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },
  labelOn:   { color: 'rgba(255,255,255,0.75)' },
  line:      { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  lineDone:  { backgroundColor: G.success },
});

// ─── GlassInput ───────────────────────────────────────────────────

interface GlassInputProps {
  label:         string;
  value:         string;
  onChangeText:  (t: string) => void;
  placeholder?:  string;
  multiline?:    boolean;
  maxLength?:    number;
  keyboardType?: any;
  hint?:         string;
  icon?:         string;
}

export const GlassInput = memo(function GlassInput({
  label, value, onChangeText, placeholder, multiline, maxLength, keyboardType, hint, icon,
}: GlassInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={gi.wrap}>
      <View style={gi.labelRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon && (
            <Ionicons name={icon as any} size={12} color={focused ? G.primary : 'rgba(255,255,255,0.35)'} />
          )}
          <Text style={[gi.label, focused && { color: G.primary }]}>{label}</Text>
        </View>
        {maxLength && <Text style={gi.counter}>{value.length}/{maxLength}</Text>}
      </View>
      <BlurView intensity={18} tint="dark" style={[gi.input, multiline && gi.inputMulti, focused && gi.inputFocused]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.18)"
          style={[gi.txt, multiline && { textAlignVertical: 'top' }]}
          multiline={multiline}
          maxLength={maxLength}
          keyboardType={keyboardType}
          numberOfLines={multiline ? 5 : 1}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </BlurView>
      {hint && <Text style={gi.hint}>{hint}</Text>}
    </View>
  );
});

const gi = StyleSheet.create({
  wrap:         { marginBottom: 14 },
  labelRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  label:        { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  counter:      { color: 'rgba(255,255,255,0.2)', fontSize: 10 },
  input:        { borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, paddingHorizontal: 15, paddingVertical: 13, overflow: 'hidden' },
  inputMulti:   { height: 110, alignItems: 'flex-start' },
  inputFocused: { borderColor: 'rgba(192,96,255,0.4)' },
  txt:          { color: '#fff', fontSize: 14, lineHeight: 20 },
  hint:         { color: 'rgba(255,255,255,0.22)', fontSize: 10, marginTop: 5, fontStyle: 'italic' },
});

// ─── ChipPicker ───────────────────────────────────────────────────

interface ChipPickerProps {
  label:     string;
  options:   readonly string[];
  selected:  string;
  onSelect:  (v: string) => void;
  colorOn?:  string;
}

export const ChipPicker = memo(function ChipPicker({ label, options, selected, onSelect, colorOn }: ChipPickerProps) {
  const c = colorOn ?? G.primary;
  return (
    <View style={cp.wrap}>
      <Text style={cp.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cp.scroll}>
        {options.map(g => {
          const on = selected === g;
          return (
            <TouchableOpacity key={g} activeOpacity={0.75}
              onPress={() => onSelect(selected === g ? '' : g)}
              style={[cp.chip, on && { borderColor: c, backgroundColor: `${c}15` }]}
            >
              <Text style={[cp.txt, on && { color: c, fontWeight: '700' }]}>{g}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

const cp = StyleSheet.create({
  wrap:   { marginBottom: 14 },
  label:  { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 9 },
  scroll: { gap: 8, paddingRight: 20 },
  chip:   { borderRadius: 20, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass, paddingHorizontal: 14, paddingVertical: 8 },
  txt:    { color: G.textSub, fontSize: 13, fontWeight: '500' },
});

// ─── StarRatingInput ──────────────────────────────────────────────

export const StarRatingInput = memo(function StarRatingInput({
  aspect, rating, onRate,
}: { aspect: string; rating: number; onRate: (r: number) => void }) {
  return (
    <View style={sri.row}>
      <Text style={sri.aspect}>{aspect}</Text>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {[1, 2, 3, 4, 5].map(s => (
          <TouchableOpacity key={s} onPress={() => onRate(s === rating ? 0 : s)} activeOpacity={0.7}>
            <Ionicons
              name={s <= rating ? 'star' : 'star-outline'}
              size={22}
              color={s <= rating ? G.gold : 'rgba(255,255,255,0.18)'}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const sri = StyleSheet.create({
  row:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  aspect: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '500' },
});

// ─── CTAButton ────────────────────────────────────────────────────

type CTAVariant = 'primary' | 'ghost' | 'danger' | 'gold' | 'cyan';

interface CTAButtonProps {
  label:    string;
  onPress:  () => void;
  disabled?: boolean;
  loading?:  boolean;
  variant?:  CTAVariant;
  icon?:     string;
  small?:    boolean;
}

const CTA_COLORS: Record<CTAVariant, [string, string]> = {
  primary: ['#7B2FBE', '#C060FF'],
  gold:    ['#8B6500', '#FFD700'],
  danger:  ['#7F0000', '#FF4D6A'],
  cyan:    ['#0D5A70', '#86EEFF'],
  ghost:   ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.07)'],
};

export const CTAButton = memo(function CTAButton({
  label, onPress, disabled, loading, variant = 'primary', icon, small,
}: CTAButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 200 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();
  const textColor = variant === 'gold' ? '#0A0010' : variant === 'cyan' ? '#00151C' : '#fff';

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.4 : 1, marginBottom: 16 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        disabled={disabled || loading}
        activeOpacity={1}
      >
        
      </TouchableOpacity>
    </Animated.View>
  );
});

const ctab = StyleSheet.create({
  base:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, paddingHorizontal: 24, borderRadius: 16 },
  small:       { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  ghostBorder: { borderWidth: 1, borderColor: G.glassBorder },
  label:       { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  labelSmall:  { fontSize: 13 },
});