/**
 * GalaxyBackground — fond étoilé partagé (remplace components/social/ et
 * components/studio/, jusqu'ici quasi dupliqués et montés indépendamment sur
 * chaque écran — voir doc/decisions/2026-06-perf-stability-pass.md).
 *
 * Natif (iOS/Android) : un seul <Canvas> Skia — étoiles + nébuleuse + météores
 * dessinés comme primitives GPU dans UNE seule surface, au lieu de 55-60 vues
 * RN animées individuellement par instance. Pilotage via Reanimated worklets
 * (UI thread), pas de re-render React par frame.
 *
 * Web : repli en LinearGradient statique — react-native-skia y dépend de
 * CanvasKit/WASM (poids de bundle non justifié pour un fond d'écran), et
 * Expo Go ne charge pas les modules natifs tiers comme Skia (il faut un
 * dev client / build natif — cf. doc/decisions).
 */
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import {
  Canvas, Rect, Circle, Group, Line, LinearGradient, BlurMask, vec,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  runOnJS,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

export type GalaxyVariant = 'default' | 'nebula';

interface Palette {
  bg: [string, string, string];
  stars: string[];
  nebula?: [string, string];
}

// Palette navy de l'app — fusion des deux anciennes variantes (social/studio),
// aucune dérive violette. "nebula" ajoute juste les halos de profondeur.
const PALETTES: Record<GalaxyVariant, Palette> = {
  default: {
    bg:    ['#03090F', '#071628', '#0D2747'],
    stars: ['#E8F0FF', '#A8C8F0', '#3F7DBF', '#1B4F8A'],
  },
  nebula: {
    bg:     ['#03090F', '#071628', '#0D2747'],
    stars:  ['#E8F0FF', '#A8C8F0', '#3F7DBF', '#1B4F8A', '#5FB8D8'],
    nebula: ['rgba(31,90,170,0.30)', 'rgba(20,64,128,0.24)'],
  },
};

const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface StarSpec {
  x: number; y: number; r: number; color: string;
  phase: number; dur: number; mn: number; mx: number;
}

function makeStars(palette: Palette, count: number): StarSpec[] {
  return Array.from({ length: count }, () => {
    // Étoiles plus petites = plus loin = plus discrètes et plus lentes
    // (illusion de profondeur simple, sans vrai parallax de scroll).
    const r = rnd(1.0, 2.6);
    const far = r < 1.6;
    return {
      x: rnd(0, W), y: rnd(0, H),
      r,
      color: pick(palette.stars),
      phase: rnd(0, 6000),
      dur:   far ? rnd(3200, 6200) : rnd(2000, 4200),
      mn:    far ? 0.12 : 0.18,
      mx:    far ? 0.65 : 0.94,
    };
  });
}

interface MeteorSpec { id: number; sx: number; sy: number; ang: number; len: number; }

const METEOR_DURATION = 800;
const MAX_CONCURRENT_METEORS = 3;
const SPAWN_INTERVAL_MS = 1400;
const SPAWN_CHANCE = 0.42;

export interface GalaxyBackgroundProps {
  /** 'nebula' ajoute des halos de profondeur — sans dépendance violette. */
  variant?: GalaxyVariant;
  /** 0-1 — réduit le nombre d'étoiles/météores (écrans secondaires, perf). */
  intensity?: number;
}

// ── Repli web : pas de Skia/CanvasKit, juste le dégradé + un léger semis fixe ──
const WEB_STATIC_STARS = Array.from({ length: 24 }, (_, i) => ({
  key: i,
  x: ((Math.sin(i * 2.399) + 1) / 2) * W,
  y: ((Math.cos(i * 1.618) + 1) / 2) * H,
  r: i % 5 === 0 ? 1.6 : 0.9,
  op: 0.15 + (i % 6) * 0.08,
}));

function WebFallback({ variant }: { variant: GalaxyVariant }) {
  const palette = PALETTES[variant];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ExpoLinearGradient colors={palette.bg} style={StyleSheet.absoluteFill} />
      {WEB_STATIC_STARS.map(s => (
        <View
          key={s.key}
          style={{
            position: 'absolute', left: s.x, top: s.y,
            width: s.r * 2, height: s.r * 2, borderRadius: s.r,
            backgroundColor: '#E8F0FF', opacity: s.op,
          }}
        />
      ))}
    </View>
  );
}

// ── StarDot / MeteorStreak : un composant par instance (comme l'ancien code),
// mais chaque instance ne dessine qu'une primitive Skia légère — pas de vue
// RN montée, pas de boucle Animated propre à chaque étoile. ──────────────────

function StarDot({ star, clock }: { star: StarSpec; clock: SharedValue<number> }) {
  const opacity = useDerivedValue(() => {
    const t = (clock.value + star.phase) % star.dur;
    const half = star.dur / 2;
    const k = t < half ? t / half : (star.dur - t) / half; // triangle 0→1→0
    return star.mn + (star.mx - star.mn) * k;
  }, [clock]);

  return <Circle cx={star.x} cy={star.y} r={star.r} color={star.color} opacity={opacity} />;
}

function MeteorStreak({ meteor, onDone }: { meteor: MeteorSpec; onDone: () => void }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: METEOR_DURATION, easing: Easing.out(Easing.quad) },
      finished => { if (finished) runOnJS(onDone)(); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const angRad = (meteor.ang * Math.PI) / 180;
  const dx = Math.cos(angRad);
  const dy = Math.sin(angRad);
  const tailX = meteor.sx - dx * meteor.len;
  const tailY = meteor.sy - dy * meteor.len;

  const opacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.15) return p / 0.15;
    return Math.max(0, 1 - (p - 0.15) / 0.85);
  }, [progress]);

  const transform = useDerivedValue(() => [
    { translateX: dx * 220 * progress.value },
    { translateY: dy * 220 * progress.value },
  ], [progress]);

  return (
    <Group transform={transform} opacity={opacity}>
      <Line p1={vec(tailX, tailY)} p2={vec(meteor.sx, meteor.sy)} strokeWidth={2}>
        <LinearGradient
          start={vec(tailX, tailY)}
          end={vec(meteor.sx, meteor.sy)}
          colors={['rgba(11,38,82,0)', 'rgba(27,79,138,0.85)', '#E8F0FF']}
        />
      </Line>
    </Group>
  );
}

// ── Native : rendu Skia ─────────────────────────────────────────────────────
function NativeGalaxyBackground({ variant = 'default', intensity = 1 }: GalaxyBackgroundProps) {
  const palette = PALETTES[variant];
  const clampedIntensity = Math.min(1, Math.max(0, intensity));
  const starCount = Math.max(8, Math.round(58 * clampedIntensity));
  const stars = useMemo(() => makeStars(palette, starCount), [variant, starCount]);

  const clock = useSharedValue(0);
  useEffect(() => {
    // Horloge unique partagée par toutes les étoiles — un seul withRepeat
    // au lieu d'une boucle Animated par étoile.
    clock.value = withRepeat(
      withTiming(1_000_000, { duration: 1_000_000_000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [clock]);

  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);
  useEffect(() => {
    const iv = setInterval(() => {
      setMeteors(prev => {
        if (prev.length >= MAX_CONCURRENT_METEORS) return prev;
        if (Math.random() > SPAWN_CHANCE * clampedIntensity) return prev;
        return [...prev, {
          id:  Date.now() + Math.random(),
          sx:  rnd(0, W), sy: rnd(0, H * 0.35),
          ang: rnd(18, 52), len: rnd(80, 160),
        }];
      });
    }, SPAWN_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [clampedIntensity]);

  const removeMeteor = (id: number) =>
    setMeteors(prev => prev.filter(m => m.id !== id));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={W} height={H}>
          <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={palette.bg} />
        </Rect>

        {variant === 'nebula' && palette.nebula && (
          <Group>
            <Circle cx={W * 0.18} cy={H * 0.20} r={W * 0.5} color={palette.nebula[0]}>
              <BlurMask blur={70} style="normal" />
            </Circle>
            <Circle cx={W * 0.82} cy={H * 0.48} r={W * 0.42} color={palette.nebula[1]}>
              <BlurMask blur={60} style="normal" />
            </Circle>
          </Group>
        )}

        {stars.map((s, i) => (
          <StarDot key={i} star={s} clock={clock} />
        ))}

        {meteors.map(m => (
          <MeteorStreak key={m.id} meteor={m} onDone={() => removeMeteor(m.id)} />
        ))}
      </Canvas>
    </View>
  );
}

const GalaxyBackground = memo(function GalaxyBackground(props: GalaxyBackgroundProps) {
  if (Platform.OS === 'web') return <WebFallback variant={props.variant ?? 'default'} />;
  return <NativeGalaxyBackground {...props} />;
});

export default GalaxyBackground;
export { GalaxyBackground };
