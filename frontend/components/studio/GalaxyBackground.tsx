
import React, { memo, useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { G } from './constants';

const { width: W, height: H } = Dimensions.get('window');

const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface StarPt  { id: number; x: number; y: number; sz: number; col: string; del: number; dur: number; mn: number; mx: number; }
interface MeteorT { id: number; sx: number; sy: number; ang: number; len: number; }

const STARS: StarPt[] = Array.from({ length: 60 }, (_, i) => ({
  id:  i,
  x:   rnd(0, W), y: rnd(0, H * 1.5),
  sz:  rnd(1.0, 2.5),
  col: pick([G.sW, G.sB, G.sP, G.sG, G.sCy]),
  del: rnd(0, 4200),
  dur: rnd(2000, 5500),
  mn:  0.15, mx: 0.92,
}));

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
    <Animated.View style={{
      position: 'absolute', left: p.x, top: p.y,
      width: p.sz, height: p.sz, borderRadius: p.sz,
      backgroundColor: p.col, opacity: op,
    }} />
  );
});

const ShootingStar = memo(function ShootingStar({
  m, onDone,
}: { m: MeteorT; onDone: () => void }) {
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
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
    ]).start(onDone);
  }, []); 

  const tx = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(m.ang * Math.PI / 180) * 220] });
  const ty = prog.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(m.ang * Math.PI / 180) * 220] });

  return (
    <Animated.View style={{
      position: 'absolute', left: m.sx, top: m.sy, opacity: op,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${m.ang}deg` }],
    }}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(110, 137, 255, 0.9)', '#fff']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ width: m.len, height: 2, borderRadius: 1 }}
      />
    </Animated.View>
  );
});

export const GalaxyBackground = memo(function GalaxyBackground() {
  const [meteors, setMeteors] = useState<MeteorT[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.65) {
        setMeteors(prev => [...prev, {
          id:  Date.now(),
          sx:  rnd(0, W),
          sy:  rnd(0, H * 0.4),
          ang: rnd(20, 50),
          len: rnd(80, 160),
        }]);
      }
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const removeMeteor = (id: number) =>
    setMeteors(prev => prev.filter(x => x.id !== id));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[G.bg0, G.bg1, G.bg2]} style={StyleSheet.absoluteFill} />

      {/* Nebula layers */}
      <LinearGradient
        colors={[G.neb0, 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.6 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
      />
      <LinearGradient
        colors={[G.neb1, 'transparent']}
        start={{ x: 1, y: 0.5 }} end={{ x: 0.2, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
      />

      {STARS.map(s => <StarDot key={s.id} p={s} />)}

      {meteors.map(m => (
        <ShootingStar
          key={m.id}
          m={m}
          onDone={() => removeMeteor(m.id)}
        />
      ))}
    </View>
  );
});