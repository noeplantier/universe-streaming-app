import React, { memo, useRef, useEffect, useState } from 'react';
import {
  View, StyleSheet, Animated, Easing, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { G } from './types';

const { width: W, height: H } = Dimensions.get('window');

const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

interface StarPt { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number }
interface Meteor { id: number; sx: number; sy: number; ang: number; len: number }

const STARS: StarPt[] = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  x:   rnd(0, W),
  y:   rnd(0, H * 1.5),
  sz:  rnd(1.0, 2.5),
  col: pick([G.sW, G.sB, G.sP, G.sG]),
  del: rnd(0, 4200),
  dur: rnd(2000, 5000),
  mn:  0.2,
  mx:  0.9,
}));

// ── Étoile scintillante ───────────────────────────────────────────

const StarDot = memo(function StarDot({ p }: { p: StarPt }) {
  const op = useRef(new Animated.Value(p.mn)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(p.del % p.dur),
        Animated.timing(op, { toValue: p.mx, duration: p.dur * 0.5, useNativeDriver: true }),
        Animated.timing(op, { toValue: p.mn, duration: p.dur * 0.5, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={{
        position: 'absolute', left: p.x, top: p.y,
        width: p.sz, height: p.sz, borderRadius: p.sz,
        backgroundColor: p.col, opacity: op,
      }}
    />
  );
});

// ── Étoile filante ────────────────────────────────────────────────

const ShootingStar = memo(function ShootingStar({
  m, onDone,
}: { m: Meteor; onDone: () => void }) {
  const prog = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
      ]),
      Animated.timing(prog, {
        toValue: 1, duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(onDone);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tx = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(m.ang * Math.PI / 180) * 220] });
  const ty = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(m.ang * Math.PI / 180) * 220] });

  return (
    <Animated.View
      style={{
        position: 'absolute', left: m.sx, top: m.sy,
        opacity: op,
        transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${m.ang}deg` }],
      }}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(175,110,255,0.85)', '#fff']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ width: m.len, height: 2, borderRadius: 1 }}
      />
    </Animated.View>
  );
});

// ── Fond galaxy ───────────────────────────────────────────────────

const GalaxyBackground = memo(function GalaxyBackground() {
  const [meteors, setMeteors] = useState<Meteor[]>([]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (Math.random() > 0.68) {
        setMeteors(m => [
          ...m,
          { id: Date.now(), sx: rnd(0, W), sy: rnd(0, H * 0.35), ang: rnd(18, 52), len: rnd(80, 160) },
        ]);
      }
    }, 2200);
    return () => clearInterval(iv);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[G.bg0, G.bg1, G.bg2]}
        style={StyleSheet.absoluteFill}
      />
      {STARS.map(s => <StarDot key={s.id} p={s} />)}
      {meteors.map(m => (
        <ShootingStar
          key={m.id}
          m={m}
          onDone={() => setMeteors(prev => prev.filter(x => x.id !== m.id))}
        />
      ))}
    </View>
  );
});

export default GalaxyBackground;