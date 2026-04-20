import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from './tokens';
import type { Step } from './types';
import { LinearGradient } from 'expo-linear-gradient';

const LABELS = ['Import', 'Infos', 'Publication'] as const;

const StepIndicator = memo(function StepIndicator({ step }: { step: Step }) {
  return (
    <View style={s.wrap}>
      {LABELS.map((label, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <React.Fragment key={label}>
            <View style={s.item}>
                <View style={[s.dot, done && s.dotDone, active && s.dotActive]}>
                {done
                  ? <Ionicons name="checkmark" size={11} color="white" />
                  : <LinearGradient
                    colors={active ? [C.teal, C.navyMid] : ['transparent', 'transparent']}
                    style={s.dot}
                  >
                    <Text style={[s.dotTxt, active && { color: 'white' }]}>{i + 1}</Text>
                  </LinearGradient>
                }
                </View>
              <Text style={[s.label, active && s.labelActive, done && s.labelDone]}>
                {label}
              </Text>
            </View>
            {i < LABELS.length - 1 && (
              <View style={[s.line, done && s.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
});

export default StepIndicator;

const s = StyleSheet.create({
  wrap:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, marginBottom: 24 },
  item:        { alignItems: 'center', gap: 5 },
  dot:         { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dotDone:     { backgroundColor: C.green, borderColor: C.green },
  dotTxt:      { color: C.textTert, fontSize: 12, fontWeight: '700' },
  label:       { color: C.textTert, fontSize: 10, fontWeight: '600' },
  labelActive: { color: C.text },
  labelDone:   { color: C.green },
  line:        { flex: 1, height: 1, backgroundColor: C.border, marginBottom: 14, marginHorizontal: 6 },
  lineDone:    { backgroundColor: C.green },
});