import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, MAX_DURATION } from './tokens';

interface Props {
  duration:  number;
  trimStart: number;
  trimEnd:   number;
  onChange:  (start: number, end: number) => void;
}

const TrimBar = memo(function TrimBar({ duration, trimStart, trimEnd, onChange }: Props) {
  const trimDur  = Math.max(0, trimEnd - trimStart);
  const overMax  = trimDur > MAX_DURATION;
  const leftPct  = duration > 0 ? trimStart / duration : 0;
  const rightPct = duration > 0 ? trimEnd   / duration : 1;
  const fmt = (s: number) => `${Math.floor(s)}s`;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.label}>Passage sélectionné</Text>
        <View style={[s.durBadge, overMax && s.durBadgeErr]}>
          <Ionicons name="time-outline" size={11} color={overMax ? C.red : C.green} />
          <Text style={[s.durTxt, overMax && { color: C.red }]}>
            {fmt(trimDur)} / {MAX_DURATION}s max
          </Text>
        </View>
      </View>

      <View style={s.track}>
        <View style={[s.excluded, { width: `${leftPct * 100}%` as any }]} />
        <LinearGradient
          colors={overMax
            ? ['rgba(255,59,92,0.4)', 'rgba(255,59,92,0.7)']
            : ['rgba(0,201,255,0.3)', 'rgba(0,201,255,0.7)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[s.selected, { width: `${(rightPct - leftPct) * 100}%` as any }]}
        />
        <View style={[s.excluded, { flex: 1 }]} />
      </View>

      <View style={s.controls}>
        {(['Début', 'Fin'] as const).map((side, idx) => {
          const val  = idx === 0 ? trimStart : trimEnd;
          const decr = idx === 0
            ? () => onChange(Math.max(0, trimStart - 1), trimEnd)
            : () => onChange(trimStart, Math.max(trimStart + 1, trimEnd - 1));
          const incr = idx === 0
            ? () => onChange(Math.min(trimEnd - 1, trimStart + 1), trimEnd)
            : () => onChange(trimStart, Math.min(duration, trimEnd + 1));
          return (
            <React.Fragment key={side}>
              {idx === 1 && <View style={s.divider} />}
              <View style={s.ctrl}>
                <Text style={s.ctrlLabel}>{side}</Text>
                <View style={s.ctrlRow}>
                  <TouchableOpacity style={s.ctrlBtn} onPress={decr}>
                    <Ionicons name="remove" size={14} color={C.textSec} />
                  </TouchableOpacity>
                  <Text style={s.ctrlVal}>{fmt(val)}</Text>
                  <TouchableOpacity style={s.ctrlBtn} onPress={incr}>
                    <Ionicons name="add" size={14} color={C.textSec} />
                  </TouchableOpacity>
                </View>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {overMax && (
        <Text style={s.errTxt}>Réduisez à {MAX_DURATION}s maximum pour le format Réel.</Text>
      )}
    </View>
  );
});

export default TrimBar;

const s = StyleSheet.create({
  wrap:        { backgroundColor: C.surf, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  label:       { color: C.textSec, fontSize: 13, fontWeight: '700' },
  durBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: C.greenDim, borderWidth: 1, borderColor: 'rgba(46,204,138,0.25)' },
  durBadgeErr: { backgroundColor: 'rgba(255,59,92,0.12)', borderColor: 'rgba(255,59,92,0.3)' },
  durTxt:      { color: C.green, fontSize: 11, fontWeight: '700' },
  track:       { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.04)', flexDirection: 'row', overflow: 'hidden', marginBottom: 16 },
  excluded:    { height: '100%', backgroundColor: 'rgba(255,255,255,0.03)' },
  selected:    { height: '100%' },
  controls:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctrl:        { flex: 1, alignItems: 'center', gap: 6 },
  ctrlLabel:   { color: C.textTert, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  ctrlRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctrlBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surfHi, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  ctrlVal:     { color: C.text, fontSize: 15, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  divider:     { width: 1, height: 36, backgroundColor: C.border },
  errTxt:      { color: C.red, fontSize: 11, marginTop: 10, textAlign: 'center', fontStyle: 'italic' },
});