import React, { memo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform,
} from 'react-native';
import { BlurView }  from 'expo-blur';
import { Ionicons }  from '@expo/vector-icons';
import * as Haptics  from 'expo-haptics';

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE — deep space glass
// ─────────────────────────────────────────────────────────────────────────────
const P = {
  glass:        'rgba(255,255,255,0.04)',
  glassMid:     'rgba(255,255,255,0.07)',
  glassHi:      'rgba(255,255,255,0.11)',
  edge:         'rgba(255,255,255,0.08)',
  edgeHi:       'rgba(255,255,255,0.18)',
  txt:          '#EDF6FF',
  txtSec:       'rgba(255,255,255,0.45)',
  txtTert:      'rgba(255,255,255,0.22)',
  white:        '#FFFFFF',
  trackBg:      'rgba(255,255,255,0.06)',
  selFill:      'rgba(255,255,255,0.92)',
  selGlow:      'rgba(255,255,255,0.30)',
  err:          '#FF3B5C',
  errBg:        'rgba(255,59,92,0.10)',
} as const;

const MAX_DURATION = 15;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface TrimBarProps {
  start:         number;
  end:           number;
  duration:      number;
  onStartChange: (val: number) => void;
  onEndChange:   (val: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP BUTTON — animated press feedback
// ─────────────────────────────────────────────────────────────────────────────
interface StepBtnProps {
  icon:    'remove' | 'add';
  onPress: () => void;
  size?:   number;
}

const StepBtn = memo(({ icon, onPress, size = 13 }: StepBtnProps) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.82, duration: 60, useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1,    friction: 8,  useNativeDriver: true }),
    ]).start();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress, scale]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Animated.View style={[btn.wrap, { transform: [{ scale }] }]}>
        <Ionicons name={icon} size={size} color={P.white} />
      </Animated.View>
    </TouchableOpacity>
  );
});
StepBtn.displayName = 'StepBtn';

const btn = StyleSheet.create({
  wrap: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: P.glass,
    borderWidth:     0.5,
    borderColor:     P.edge,
    alignItems:      'center',
    justifyContent:  'center',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SCRUB TRACK — visual bar showing trim window
// ─────────────────────────────────────────────────────────────────────────────
interface TrackProps {
  leftPct:  number;
  rightPct: number;
  isError:  boolean;
}

const ScrubTrack = memo(({ leftPct, rightPct, isError }: TrackProps) => {
  const selWidth = Math.max(0, rightPct - leftPct);

  return (
    <View style={tr.outer}>
      {/* excluded left */}
      <View style={[tr.excl, { width: `${leftPct * 100}%` as any }]} />

      {/* selected window */}
      <View
        style={[
          tr.sel,
          { width: `${selWidth * 100}%` as any },
          isError && tr.selErr,
        ]}
      >
        {/* glow line */}
        <View style={[tr.glow, isError && tr.glowErr]} />
      </View>

      {/* excluded right */}
      <View style={[tr.excl, { flex: 1 }]} />

      {/* edge handles */}
      <View style={[tr.handle, { left: `${leftPct * 100}%` as any }]} />
      <View style={[tr.handle, { left: `${rightPct * 100}%` as any, marginLeft: -2 }]} />
    </View>
  );
});
ScrubTrack.displayName = 'ScrubTrack';

const tr = StyleSheet.create({
  outer:   {
    height:         6,
    borderRadius:   3,
    backgroundColor: P.trackBg,
    flexDirection:  'row',
    overflow:       'visible',
    marginBottom:   22,
    position:       'relative',
  },
  excl:    { height: '100%', backgroundColor: 'rgba(255,255,255,0.04)' },
  sel:     {
    height:          '100%',
    backgroundColor:  P.selFill,
    borderRadius:     2,
    overflow:        'hidden',
    position:        'relative',
  },
  selErr:  { backgroundColor: P.err, opacity: 0.7 },
  glow:    {
    position:        'absolute',
    top:             -3,
    left:            0,
    right:           0,
    height:          '200%',
    backgroundColor:  P.selGlow,
    borderRadius:    4,
  },
  glowErr: { backgroundColor: P.errBg },
  handle:  {
    position:        'absolute',
    top:             -5,
    width:            2,
    height:           16,
    borderRadius:     1,
    backgroundColor:  'rgba(255,255,255,0.9)',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// DURATION BADGE
// ─────────────────────────────────────────────────────────────────────────────
const DurBadge = memo(({ seconds, isError }: { seconds: number; isError: boolean }) => (
  <View style={[db.wrap, isError && db.wrapErr]}>
    <Ionicons
      name="time-outline"
      size={10}
      color={isError ? P.err : P.txtSec}
    />
    <Text style={[db.txt, isError && db.txtErr]}>
      {seconds}s
      {!isError && (
        <Text style={db.cap}> / {MAX_DURATION}s</Text>
      )}
    </Text>
  </View>
));
DurBadge.displayName = 'DurBadge';

const db = StyleSheet.create({
  wrap:    {
    flexDirection:   'row',
    alignItems:      'center',
    gap:              4,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:     10,
    backgroundColor:  P.glass,
    borderWidth:      0.5,
    borderColor:      P.edge,
  },
  wrapErr: { backgroundColor: P.errBg, borderColor: 'rgba(255,59,92,0.25)' },
  txt:     { color: P.txtSec, fontSize: 11, fontWeight: '600' },
  txtErr:  { color: P.err },
  cap:     { color: P.txtTert, fontWeight: '400' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTROL ROW (one side)
// ─────────────────────────────────────────────────────────────────────────────
interface CtrlRowProps {
  label:  string;
  value:  number;
  onDec:  () => void;
  onInc:  () => void;
}

const CtrlRow = memo(({ label, value, onDec, onInc }: CtrlRowProps) => (
  <View style={cr.wrap}>
    <Text style={cr.label}>{label}</Text>
    <View style={cr.row}>
      <StepBtn icon="remove" onPress={onDec} />
      <Text style={cr.val}>{value}s</Text>
      <StepBtn icon="add"    onPress={onInc} />
    </View>
  </View>
));
CtrlRow.displayName = 'CtrlRow';

const cr = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', gap: 7 },
  label: {
    color:         P.txtTert,
    fontSize:       9,
    fontWeight:    '700',
    textTransform: 'uppercase',
    letterSpacing:  0.8,
  },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  val:   {
    color:      P.white,
    fontSize:    15,
    fontWeight: '700',
    minWidth:    34,
    textAlign:  'center',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const TrimBar = memo(({
  start, end, duration, onStartChange, onEndChange,
}: TrimBarProps) => {
  const trimDur  = Math.max(0, end - start);
  const isError  = trimDur <= 0 || trimDur > MAX_DURATION;
  const leftPct  = duration > 0 ? start / duration : 0;
  const rightPct = duration > 0 ? end   / duration : 1;

  const handleStartDec = useCallback(() => onStartChange(Math.max(0, start - 1)),             [start, onStartChange]);
  const handleStartInc = useCallback(() => onStartChange(Math.min(end - 1, start + 1)),       [start, end, onStartChange]);
  const handleEndDec   = useCallback(() => onEndChange(Math.max(start + 1, end - 1)),         [start, end, onEndChange]);
  const handleEndInc   = useCallback(() => onEndChange(Math.min(duration, end + 1)),          [duration, end, onEndChange]);

  return (
    <View style={s.root}>
      {/* Glass blur layer */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 20 : 12}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerLabel}>Sélection</Text>
        <DurBadge seconds={trimDur} isError={isError} />
      </View>

      {/* Scrub track */}
      <ScrubTrack leftPct={leftPct} rightPct={rightPct} isError={isError} />

      {/* Controls */}
      <View style={s.controls}>
        <CtrlRow label="Début" value={start} onDec={handleStartDec} onInc={handleStartInc} />

        {/* Divider */}
        <View style={s.divider} />

        <CtrlRow label="Fin"   value={end}   onDec={handleEndDec}   onInc={handleEndInc}   />
      </View>

      {/* Error hint */}
      {isError && trimDur > MAX_DURATION && (
        <View style={s.errRow}>
          <Ionicons name="warning-outline" size={11} color={P.err} />
          <Text style={s.errTxt}>Max {MAX_DURATION}s pour le format Réel</Text>
        </View>
      )}
    </View>
  );
});

TrimBar.displayName = 'TrimBar';

export default TrimBar;

const s = StyleSheet.create({
  root: {
    borderRadius:    20,
    borderWidth:      0.5,
    borderColor:      P.edge,
    padding:          16,
    marginBottom:     16,
    overflow:        'hidden',
    backgroundColor:  P.glass,
  },
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:     18,
  },
  headerLabel: {
    color:      P.txtSec,
    fontSize:    12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  controls: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            8,
  },
  divider: {
    width:           0.5,
    height:           36,
    backgroundColor:  P.edge,
  },
  errRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:              5,
    marginTop:        12,
    justifyContent:  'center',
  },
  errTxt: {
    color:      P.err,
    fontSize:    11,
    fontWeight: '500',
  },
});