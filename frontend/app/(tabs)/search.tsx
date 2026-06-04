/**
 * app/(tabs)/search.tsx — UNIVERSE · PAGE ACCUEIL v4
 *
 * ★ Gamification intégrée et enrichie : GalaxyGamificationModal
 *   → XP, niveaux, badges cosmiques, streaks, défis, mini-jeux
 *   → Interactions hyper-modernes pour maximiser la rétention
 * ★ Code initial (Hero, PortraitCard, LandscapeCard, RowSection,
 *   SearchOverlay, fetchAllWorks) conservé et optimisé
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, FlatList, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
  PanResponder, Easing,
  type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import { StatusBar }         from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase }          from '@/lib/supabase';
import GalaxyBackground      from '@/components/social/GalaxyBackground';

import {
  useGamification,
  useWeeklyChallenge,
  WeeklyChallengeModal,
  resolveImg,
  type Work,
} from '@/contexts/GamificationSystem';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:        '#070C17',
  navyMid:   '#0D2040',
  navyLow:   '#0A1830',
  navyDeep:  '#050A14',
  white:     '#FFFFFF',
  offWhite:  'rgba(255,255,255,0.82)',
  mid:       'rgba(255,255,255,0.55)',
  muted:     'rgba(255,255,255,0.36)',
  subtle:    'rgba(255,255,255,0.14)',
  faint:     'rgba(255,255,255,0.07)',
  border:    'rgba(255,255,255,0.09)',
  borderHi:  'rgba(255,255,255,0.22)',
  blue:      '#5A96E6',
  blueFaint: 'rgba(90,150,230,0.10)',
  blueGlow:  'rgba(90,150,230,0.30)',
  gold:      '#F5C842',
  goldFaint: 'rgba(245,200,66,0.12)',
  goldGlow:  'rgba(245,200,66,0.35)',
  green:     '#2ECC8A',
  greenFaint:'rgba(46,204,138,0.12)',
  purple:    '#9B6BFF',
  purpleFaint:'rgba(155,107,255,0.15)',
  cyan:      '#4DD8E8',
  red:       '#FF5C72',
  orange:    '#FF8C42',
} as const;
const EDGE = 20;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtK   = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`;
const fmtDur = (m: number | null) => { if (!m) return ''; if (m >= 60) return `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}min` : ''}`; return `${m}min`; };

// ─── GAMIFICATION DATA ────────────────────────────────────────────────────────
const LEVELS = [
  { level: 1, title: 'Étoile Naissante',  minXP: 0,    icon: '⭐', color: C.muted },
  { level: 2, title: 'Nébuleuse',         minXP: 100,  icon: '🌌', color: C.blue },
  { level: 3, title: 'Comète',            minXP: 300,  icon: '☄️', color: C.cyan },
  { level: 4, title: 'Astronaute',        minXP: 600,  icon: '👨‍🚀', color: C.green },
  { level: 5, title: 'Étoile Filante',    minXP: 1000, icon: '💫', color: C.gold },
  { level: 6, title: 'Supernova',         minXP: 1800, icon: '💥', color: C.orange },
  { level: 7, title: 'Trou Noir',         minXP: 3000, icon: '🕳️', color: C.purple },
  { level: 8, title: 'Gardien du Cosmos', minXP: 5000, icon: '🌠', color: C.gold },
];

const BADGES_DATA = [
  { id: 'first_watch',  icon: '🎬', label: 'Premier Film',    desc: 'Regardez votre premier film', xp: 50,  color: C.blue,   unlocked: false },
  { id: 'streak_3',     icon: '🔥', label: 'Flamme ×3',       desc: '3 jours consécutifs',         xp: 75,  color: C.orange, unlocked: false },
  { id: 'explorer',     icon: '🔭', label: 'Explorateur',     desc: '10 genres différents',        xp: 100, color: C.cyan,   unlocked: false },
  { id: 'cinephile',    icon: '🎭', label: 'Cinéphile',       desc: '50 films vus',                xp: 200, color: C.purple, unlocked: false },
  { id: 'nugget',       icon: '💎', label: 'Chasseur Pépites',desc: '5 pépites cachées vues',      xp: 150, color: C.gold,   unlocked: false },
  { id: 'night_owl',    icon: '🦉', label: 'Hibou Cosmique',  desc: 'Regardez après 23h',          xp: 60,  color: C.navyMid,unlocked: false },
  { id: 'original',     icon: '✨', label: 'Insider',          desc: '3 originaux Universe vus',   xp: 120, color: C.gold,   unlocked: false },
  { id: 'social',       icon: '🌍', label: 'Ambassadeur',     desc: 'Partagez 3 films',            xp: 80,  color: C.green,  unlocked: false },
];

const DAILY_CHALLENGES = [
  { id: 'dc1', emoji: '🎯', title: 'Sniper du Soir',    desc: 'Regardez 1 court métrage ce soir',       xp: 40,  progress: 0, total: 1 },
  { id: 'dc2', emoji: '🌌', title: 'Voyage Cosmique',   desc: 'Explorez 3 catégories différentes',       xp: 60,  progress: 0, total: 3 },
  { id: 'dc3', emoji: '💫', title: 'Pépite Hunter',     desc: 'Découvrez une pépite cachée',             xp: 50,  progress: 0, total: 1 },
];

const MINI_GAMES = [
  { id: 'guess',   emoji: '🎬', title: 'Devine le Film',      desc: 'Reconnais le film en 3 indices', color: C.purple, duration: '2 min' },
  { id: 'trivia',  emoji: '🌟', title: 'Astro Quiz',          desc: '10 questions, chrono 30s',       color: C.cyan,   duration: '3 min' },
  { id: 'streak',  emoji: '⚡', title: 'Cosmic Streak',       desc: 'Enchaîne les bons films',        color: C.gold,   duration: '5 min' },
];

// ─── XP STORE (local) ────────────────────────────────────────────────────────
const useXPStore = (userId: string) => {
  const [xp,      setXP]      = useState(0);
  const [streak,  setStreak]  = useState(0);
  const [todayXP, setTodayXP] = useState(0);
  const [weekXP,  setWeekXP]  = useState(0);
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);

  const currentLevel = useMemo(() => {
    let lvl = LEVELS[0];
    for (const l of LEVELS) { if (xp >= l.minXP) lvl = l; else break; }
    return lvl;
  }, [xp]);

  const nextLevel = useMemo(() => {
    const idx = LEVELS.findIndex(l => l.level === currentLevel.level);
    return LEVELS[idx + 1] ?? null;
  }, [currentLevel]);

  const xpProgress = useMemo(() => {
    if (!nextLevel) return 1;
    const range = nextLevel.minXP - currentLevel.minXP;
    const earned = xp - currentLevel.minXP;
    return Math.min(earned / range, 1);
  }, [xp, currentLevel, nextLevel]);

  const addXP = useCallback((amount: number) => {
    setXP(prev => prev + amount);
    setTodayXP(prev => prev + amount);
    setWeekXP(prev => prev + amount);
  }, []);

  const unlockBadge = useCallback((id: string) => {
    setUnlockedBadges(prev => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  return { xp, streak, todayXP, weekXP, currentLevel, nextLevel, xpProgress, unlockedBadges, addXP, unlockBadge };
};

// ─── SHIMMER ──────────────────────────────────────────────────────────────────
const Shimmer = memo(({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) => {
  const op = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.38, duration: 900, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.18, duration: 900, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [op]);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: C.navyMid, opacity: op }} />;
});

// ─── PULSE ANIMATION ─────────────────────────────────────────────────────────
const usePulse = (duration = 1400) => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1.06, duration: duration / 2, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(anim, { toValue: 1, duration: duration / 2, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return anim;
};

// ─── PARTICLE BURST (XP gain feedback) ───────────────────────────────────────
const XPBurst = memo(({ visible, xp, onDone }: { visible: boolean; xp: number; onDone: () => void }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const op    = useRef(new Animated.Value(0)).current;
  const ty    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0); op.setValue(1); ty.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
      Animated.timing(ty, { toValue: -60, duration: 900, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(op, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start(onDone);
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View style={{ position: 'absolute', alignSelf: 'center', top: '40%', transform: [{ scale }, { translateY: ty }], opacity: op, zIndex: 999, pointerEvents: 'none' }}>
      <View style={{ backgroundColor: C.goldFaint, borderWidth: 1, borderColor: C.gold, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 16 }}>⚡</Text>
        <Text style={{ color: C.gold, fontSize: 20, fontWeight: '900' }}>+{xp} XP</Text>
      </View>
    </Animated.View>
  );
});

// ─── XP BAR COMPONENT ────────────────────────────────────────────────────────
const XPProgressBar = memo(({ progress, currentLevel, nextLevel, xp }: { progress: number; currentLevel: any; nextLevel: any; xp: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 1200, useNativeDriver: false, easing: Easing.out(Easing.exp) }).start();
  }, [progress]);

  const glowOp = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ paddingHorizontal: EDGE, marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 20 }}>{currentLevel.icon}</Text>
          <View>
            <Text style={{ color: C.white, fontSize: 14, fontWeight: '800' }}>{currentLevel.title}</Text>
            <Text style={{ color: C.muted, fontSize: 10 }}>Niv. {currentLevel.level}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: C.gold, fontSize: 16, fontWeight: '900' }}>{xp.toLocaleString()} XP</Text>
          {nextLevel && <Text style={{ color: C.muted, fontSize: 10 }}>→ {nextLevel.minXP.toLocaleString()} XP pour {nextLevel.title}</Text>}
        </View>
      </View>
      <View style={{ height: 6, backgroundColor: C.subtle, borderRadius: 3, overflow: 'hidden' }}>
        <Animated.View style={{
          height: '100%',
          borderRadius: 3,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: currentLevel.color || C.gold,
        }} />
      </View>
    </View>
  );
});

// ─── STREAK DISPLAY ───────────────────────────────────────────────────────────
const StreakBubble = memo(({ streak }: { streak: number }) => {
  const scale = usePulse(1800);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <LinearGradient
        colors={streak > 0 ? ['rgba(255,140,66,0.25)', 'rgba(255,92,114,0.15)'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.03)']}
        style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: streak > 0 ? 'rgba(255,140,66,0.4)' : C.border }}
      >
        <Text style={{ fontSize: 22 }}>{streak > 0 ? '🔥' : '💤'}</Text>
        <Text style={{ color: streak > 0 ? C.orange : C.muted, fontSize: 18, fontWeight: '900', marginTop: 2 }}>{streak}</Text>
        <Text style={{ color: C.muted, fontSize: 9, fontWeight: '700' }}>JOURS</Text>
      </LinearGradient>
    </Animated.View>
  );
});

// ─── BADGE CARD ───────────────────────────────────────────────────────────────
const BadgeCard = memo(({ badge, unlocked, onPress }: { badge: typeof BADGES_DATA[0]; unlocked: boolean; onPress: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(unlocked ? 1 : 0)).current;

  useEffect(() => {
    if (unlocked) Animated.spring(glow, { toValue: 1, useNativeDriver: false }).start();
  }, [unlocked]);

  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 300, friction: 8, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={press} activeOpacity={0.9} style={{ width: (SW - EDGE * 2 - 12) / 2 }}>
      <Animated.View style={{
        transform: [{ scale }],
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: unlocked ? glow.interpolate({ inputRange: [0, 1], outputRange: [C.border, badge.color + '55'] }) : C.border,
        marginBottom: 10,
      }}>
        <LinearGradient
          colors={unlocked
            ? [`${badge.color}18`, `${badge.color}08`, 'rgba(7,12,23,0.95)']
            : ['rgba(13,32,64,0.6)', 'rgba(7,12,23,0.95)']}
          style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: unlocked ? `${badge.color}25` : C.faint,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: unlocked ? `${badge.color}50` : C.border,
          }}>
            <Text style={{ fontSize: 22, opacity: unlocked ? 1 : 0.3 }}>{badge.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: unlocked ? C.white : C.muted, fontSize: 12, fontWeight: '800' }}>{badge.label}</Text>
            <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }} numberOfLines={2}>{badge.desc}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
              <Text style={{ fontSize: 10 }}>⚡</Text>
              <Text style={{ color: unlocked ? C.gold : C.muted, fontSize: 10, fontWeight: '700' }}>+{badge.xp} XP</Text>
            </View>
          </View>
          {unlocked && (
            <View style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={10} color={C.white} />
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── DAILY CHALLENGE ROW ─────────────────────────────────────────────────────
const DailyChallengeRow = memo(({ challenge, onClaim, claimed }: { challenge: typeof DAILY_CHALLENGES[0]; onClaim: () => void; claimed: boolean }) => {
  const prog = challenge.progress / challenge.total;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: prog, duration: 800, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
  }, [prog]);

  return (
    <View style={{ marginBottom: 10, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
      <LinearGradient colors={['rgba(13,32,64,0.8)', 'rgba(7,12,23,0.9)']} style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 24 }}>{challenge.emoji}</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: C.white, fontSize: 13, fontWeight: '800' }}>{challenge.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 9 }}>⚡</Text>
                <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>+{challenge.xp} XP</Text>
              </View>
            </View>
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{challenge.desc}</Text>
            <View style={{ marginTop: 8, height: 4, backgroundColor: C.subtle, borderRadius: 2, overflow: 'hidden' }}>
              <Animated.View style={{
                height: '100%', borderRadius: 2,
                backgroundColor: prog >= 1 ? C.green : C.blue,
                width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }} />
            </View>
            <Text style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>{challenge.progress}/{challenge.total}</Text>
          </View>
          {prog >= 1 && !claimed && (
            <TouchableOpacity onPress={onClaim} style={{ backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: C.navyDeep, fontSize: 11, fontWeight: '900' }}>CLAIM</Text>
            </TouchableOpacity>
          )}
          {claimed && (
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.greenFaint, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.green }}>
              <Ionicons name="checkmark" size={14} color={C.green} />
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
});

// ─── MINI GAME CARD ───────────────────────────────────────────────────────────
const MiniGameCard = memo(({ game, onPlay }: { game: typeof MINI_GAMES[0]; onPlay: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 300, friction: 8, useNativeDriver: true }),
    ]).start(onPlay);
  };
  return (
    <TouchableOpacity onPress={press} activeOpacity={0.9} style={{ flex: 1 }}>
      <Animated.View style={{ transform: [{ scale }], borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: `${game.color}30` }}>
        <LinearGradient colors={[`${game.color}20`, 'rgba(7,12,23,0.95)']} style={{ padding: 16, alignItems: 'center', gap: 8, minHeight: 110 }}>
          <Text style={{ fontSize: 30 }}>{game.emoji}</Text>
          <Text style={{ color: C.white, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>{game.title}</Text>
          <Text style={{ color: C.muted, fontSize: 10, textAlign: 'center' }} numberOfLines={2}>{game.desc}</Text>
          <View style={{ backgroundColor: `${game.color}25`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ color: game.color, fontSize: 9, fontWeight: '700' }}>{game.duration}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── GUESS THE FILM MINI-GAME ─────────────────────────────────────────────────
const GuessTheFilm = memo(({ works, onXP, onClose }: { works: Work[]; onXP: (n: number) => void; onClose: () => void }) => {
  const [round,     setRound]     = useState(0);
  const [score,     setScore]     = useState(0);
  const [phase,     setPhase]     = useState<'clue' | 'result' | 'done'>('clue');
  const [clueIdx,   setClueIdx]   = useState(0);
  const [selected,  setSelected]  = useState<number | null>(null);
  const fadeIn = useRef(new Animated.Value(0)).current;

  const pool = useMemo(() => works.filter(w => w.title && w.genre).slice(0, 40), [works]);

  const current = useMemo(() => {
    if (!pool.length) return null;
    return pool[round % pool.length];
  }, [round, pool]);

  const choices = useMemo(() => {
    if (!current || !pool.length) return [];
    const others = pool.filter(w => w.id !== current.id).sort(() => Math.random() - 0.5).slice(0, 3);
    return [...others, current].sort(() => Math.random() - 0.5);
  }, [current, pool]);

  const clues = useMemo(() => current ? [
    `Genre : ${current.genre ?? '?'}`,
    `Année : ${current.year ?? '?'}`,
    current.director ? `Réalisateur : ${current.director}` : `Durée : ${fmtDur(current.duration)}`,
  ] : [], [current]);

  useEffect(() => {
    fadeIn.setValue(0);
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [round, clueIdx]);

  const handleGuess = (id: number) => {
    if (phase !== 'clue') return;
    setSelected(id);
    setPhase('result');
    if (id === current?.id) {
      const pts = [100, 60, 30][clueIdx] ?? 10;
      setScore(s => s + pts);
      onXP(pts);
    }
  };

  const nextRound = () => {
    if (round >= 4) { setPhase('done'); return; }
    setRound(r => r + 1);
    setClueIdx(0);
    setSelected(null);
    setPhase('clue');
  };

  if (!current) return null;
  if (phase === 'done') return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
      <Text style={{ fontSize: 60 }}>🏆</Text>
      <Text style={{ color: C.white, fontSize: 28, fontWeight: '900', marginTop: 12 }}>Score final</Text>
      <Text style={{ color: C.gold, fontSize: 48, fontWeight: '900', marginTop: 4 }}>{score}</Text>
      <Text style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>points gagnés</Text>
      <TouchableOpacity onPress={onClose} style={{ marginTop: 30, backgroundColor: C.blue, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 }}>
        <Text style={{ color: C.white, fontSize: 15, fontWeight: '800' }}>Retour à la galaxie</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View style={{ flex: 1, opacity: fadeIn, padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: i <= round ? C.gold : C.subtle }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12 }}>⚡</Text>
          <Text style={{ color: C.gold, fontSize: 14, fontWeight: '800' }}>{score}</Text>
        </View>
      </View>

      <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>INDICE {clueIdx + 1}/3</Text>
      <View style={{ backgroundColor: C.purpleFaint, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: `${C.purple}40`, marginBottom: 16 }}>
        <Text style={{ color: C.white, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{clues[clueIdx]}</Text>
      </View>

      {phase === 'clue' && clueIdx < 2 && (
        <TouchableOpacity onPress={() => setClueIdx(c => c + 1)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          <Ionicons name="eye-outline" size={14} color={C.mid} />
          <Text style={{ color: C.mid, fontSize: 12 }}>Voir l'indice suivant (−40 pts)</Text>
        </TouchableOpacity>
      )}

      <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>QUEL EST CE FILM ?</Text>
      <View style={{ gap: 10 }}>
        {choices.map(c => {
          const isCorrect = c.id === current.id;
          const isSelected = c.id === selected;
          let bg = C.faint, border = C.border, textColor = C.white;
          if (phase === 'result' && isCorrect) { bg = C.greenFaint; border = C.green; textColor = C.green; }
          if (phase === 'result' && isSelected && !isCorrect) { bg = 'rgba(255,92,114,0.1)'; border = C.red; textColor = C.red; }

          return (
            <TouchableOpacity key={c.id} onPress={() => handleGuess(c.id)} disabled={phase === 'result'}
              style={{ backgroundColor: bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: border }}>
              <Text style={{ color: textColor, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{c.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {phase === 'result' && (
        <TouchableOpacity onPress={nextRound} style={{ marginTop: 20, backgroundColor: C.blue, borderRadius: 14, padding: 14, alignItems: 'center' }}>
          <Text style={{ color: C.white, fontSize: 14, fontWeight: '800' }}>{round < 4 ? 'Film suivant →' : 'Voir le score'}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

// ─── ASTRO QUIZ MINI-GAME ─────────────────────────────────────────────────────
const QUIZ_QUESTIONS = [
  { q: "Quel genre dure le moins en moyenne ?",         options: ["Court métrage","Documentaire","Animation","Thriller"],    answer: 0 },
  { q: "Que signifie 'PÉPITE' sur Universe ?",          options: ["Film court","Œuvre peu connue","Original Universe","Film récent"], answer: 1 },
  { q: "Comment obtenir le badge 'Cinéphile' ?",        options: ["10 likes","50 films vus","5 partages","3 connexions"],    answer: 1 },
  { q: "L'icône ★ désigne quoi sur une fiche ?",        options: ["Film noté","Contenu Original","Film populaire","Badge user"], answer: 1 },
  { q: "Quelle action donne le plus d'XP par défaut ?", options: ["Liker","Partager","Terminer un défi","Commenter"],         answer: 2 },
];

const AstroQuiz = memo(({ onXP, onClose }: { onXP: (n: number) => void; onClose: () => void }) => {
  const [qIdx,     setQIdx]     = useState(0);
  const [score,    setScore]    = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [phase,    setPhase]    = useState<'q' | 'result' | 'done'>('q');
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef  = useRef<any>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (phase !== 'q') return;
    setTimeLeft(30);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setPhase('result'); setSelected(-1); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [qIdx, phase]);

  const handleAnswer = (idx: number) => {
    clearInterval(timerRef.current);
    setSelected(idx);
    setPhase('result');
    if (idx === QUIZ_QUESTIONS[qIdx].answer) {
      const pts = Math.ceil(timeLeft * 3);
      setScore(s => s + pts);
      onXP(pts);
    }
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 300, useNativeDriver: true }),
    ]).start();
  };

  const next = () => {
    if (qIdx >= QUIZ_QUESTIONS.length - 1) { setPhase('done'); return; }
    setQIdx(q => q + 1);
    setSelected(null);
    setPhase('q');
  };

  if (phase === 'done') return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
      <Text style={{ fontSize: 60 }}>{score > 200 ? '🌟' : score > 100 ? '⭐' : '💫'}</Text>
      <Text style={{ color: C.white, fontSize: 26, fontWeight: '900', marginTop: 16 }}>Quiz terminé !</Text>
      <Text style={{ color: C.cyan, fontSize: 44, fontWeight: '900', marginTop: 4 }}>{score} pts</Text>
      <TouchableOpacity onPress={onClose} style={{ marginTop: 28, backgroundColor: C.cyan, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 }}>
        <Text style={{ color: C.navyDeep, fontSize: 15, fontWeight: '900' }}>Retour à la galaxie</Text>
      </TouchableOpacity>
    </View>
  );

  const q = QUIZ_QUESTIONS[qIdx];
  const timerPct = timeLeft / 30;

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{qIdx + 1}/{QUIZ_QUESTIONS.length}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="timer-outline" size={13} color={timeLeft <= 10 ? C.red : C.cyan} />
          <Text style={{ color: timeLeft <= 10 ? C.red : C.cyan, fontSize: 14, fontWeight: '900' }}>{timeLeft}s</Text>
        </View>
      </View>
      <View style={{ height: 4, backgroundColor: C.subtle, borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
        <View style={{ height: '100%', borderRadius: 2, width: `${timerPct * 100}%`, backgroundColor: timeLeft <= 10 ? C.red : C.cyan }} />
      </View>

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={{ backgroundColor: `${C.cyan}15`, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: `${C.cyan}30`, marginBottom: 24, minHeight: 90, justifyContent: 'center' }}>
          <Text style={{ color: C.white, fontSize: 16, fontWeight: '700', textAlign: 'center', lineHeight: 24 }}>{q.q}</Text>
        </View>
        <View style={{ gap: 10 }}>
          {q.options.map((opt, i) => {
            let bg = C.faint, border = C.border, textColor = C.offWhite;
            if (phase === 'result' && i === q.answer) { bg = C.greenFaint; border = C.green; textColor = C.green; }
            if (phase === 'result' && i === selected && i !== q.answer) { bg = 'rgba(255,92,114,0.1)'; border = C.red; textColor = C.red; }
            return (
              <TouchableOpacity key={i} onPress={() => handleAnswer(i)} disabled={phase === 'result'}
                style={{ backgroundColor: bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: border }}>
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {phase === 'result' && (
          <TouchableOpacity onPress={next} style={{ marginTop: 18, backgroundColor: C.cyan, borderRadius: 14, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: C.navyDeep, fontSize: 14, fontWeight: '900' }}>{qIdx < QUIZ_QUESTIONS.length - 1 ? 'Suivant →' : 'Résultats'}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
});

// ─── COSMIC STREAK MINI-GAME (swipe left/right) ───────────────────────────────
const CosmicStreak = memo(({ works, onXP, onClose }: { works: Work[]; onXP: (n: number) => void; onClose: () => void }) => {
  const [idx,   setIdx]   = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [phase, setPhase] = useState<'swipe' | 'done'>('swipe');
  const tx = useRef(new Animated.Value(0)).current;
  const rot = tx.interpolate({ inputRange: [-150, 0, 150], outputRange: ['-15deg', '0deg', '15deg'] });
  const likeOp = tx.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });
  const passOp = tx.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const pool = useMemo(() => works.slice(0, 20), [works]);
  const current = pool[idx];

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => tx.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 100) {
        const liked = g.dx > 0;
        Animated.timing(tx, { toValue: liked ? 400 : -400, duration: 200, useNativeDriver: true }).start(() => {
          if (liked) {
            const pts = 20 * (combo + 1);
            setScore(s => s + pts);
            setCombo(c => c + 1);
            onXP(pts);
          } else {
            setCombo(0);
          }
          if (idx >= Math.min(pool.length - 1, 14)) { setPhase('done'); }
          else { tx.setValue(0); setIdx(i => i + 1); }
        });
      } else {
        Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  }), [idx, combo, pool.length]);

  if (!current || phase === 'done') return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
      <Text style={{ fontSize: 60 }}>⚡</Text>
      <Text style={{ color: C.white, fontSize: 26, fontWeight: '900', marginTop: 16 }}>Streak terminé !</Text>
      <Text style={{ color: C.gold, fontSize: 44, fontWeight: '900', marginTop: 4 }}>{score} pts</Text>
      <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Combo max : ×{combo}</Text>
      <TouchableOpacity onPress={onClose} style={{ marginTop: 28, backgroundColor: C.gold, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 }}>
        <Text style={{ color: C.navyDeep, fontSize: 15, fontWeight: '900' }}>Retour à la galaxie</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12 }}>🔥</Text>
          <Text style={{ color: C.orange, fontSize: 14, fontWeight: '800' }}>×{combo}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12 }}>⚡</Text>
          <Text style={{ color: C.gold, fontSize: 14, fontWeight: '800' }}>{score}</Text>
        </View>
      </View>
      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 20 }}>👈 PASSE    LIKE 👉</Text>

      <View style={{ width: '100%', alignItems: 'center' }}>
        <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX: tx }, { rotate: rot }], width: '100%' }}>
          <View style={{ borderRadius: 20, overflow: 'hidden', height: 260, position: 'relative' }}>
            <Image source={{ uri: resolveImg(current.id, current.image) }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <LinearGradient colors={['transparent', 'rgba(7,12,23,0.95)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' }} />
            <Animated.View style={{ position: 'absolute', top: 20, left: 20, backgroundColor: C.greenFaint, borderWidth: 2, borderColor: C.green, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, opacity: likeOp }}>
              <Text style={{ color: C.green, fontSize: 18, fontWeight: '900' }}>LIKE ❤️</Text>
            </Animated.View>
            <Animated.View style={{ position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(255,92,114,0.15)', borderWidth: 2, borderColor: C.red, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, opacity: passOp }}>
              <Text style={{ color: C.red, fontSize: 18, fontWeight: '900' }}>PASS 💨</Text>
            </Animated.View>
            <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
              <Text style={{ color: C.white, fontSize: 16, fontWeight: '800' }}>{current.title}</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{current.genre}{current.year ? ` · ${current.year}` : ''}</Text>
            </View>
          </View>
        </Animated.View>
        <Text style={{ color: C.muted, fontSize: 11, marginTop: 12 }}>{idx + 1}/{Math.min(pool.length, 15)} films</Text>
      </View>
    </View>
  );
});

// ─── LEADERBOARD ROW ─────────────────────────────────────────────────────────
const FAKE_LEADERBOARD = [
  { rank: 1, name: 'AstroMax',   xp: 4820, badge: '🌠', color: C.gold },
  { rank: 2, name: 'NébulaFox',  xp: 3240, badge: '💥', color: C.orange },
  { rank: 3, name: 'CosmicJay',  xp: 2910, badge: '💫', color: C.cyan },
  { rank: 4, name: 'StarChild',  xp: 1780, badge: '☄️', color: C.blue },
  { rank: 5, name: 'Toi',        xp: 0,    badge: '⭐', color: C.muted, isMe: true },
];

// ─── MAIN GAMIFICATION MODAL ─────────────────────────────────────────────────
const GalaxyGamificationModal = memo(({
  visible, onClose, works, userId,
  xp, streak, todayXP, weekXP,
  currentLevel, nextLevel, xpProgress, unlockedBadges,
  onAddXP, onUnlockBadge,
}: {
  visible: boolean; onClose: () => void; works: Work[]; userId: string;
  xp: number; streak: number; todayXP: number; weekXP: number;
  currentLevel: any; nextLevel: any; xpProgress: number; unlockedBadges: string[];
  onAddXP: (n: number) => void; onUnlockBadge: (id: string) => void;
}) => {
  const insets  = useSafeAreaInsets();
  const slideY  = useRef(new Animated.Value(SH)).current;
  const [tab,   setTab]   = useState<'home' | 'badges' | 'games' | 'rank'>('home');
  const [game,  setGame]  = useState<string | null>(null);
  const [xpBurst, setXPBurst] = useState<{ visible: boolean; amount: number }>({ visible: false, amount: 0 });
  const [claimedChallenges, setClaimedChallenges] = useState<string[]>([]);
  const tabAnim = useRef(new Animated.Value(0)).current;

  const leaderboard = useMemo(() => FAKE_LEADERBOARD.map(r => r.isMe ? { ...r, xp } : r), [xp]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
    } else {
      Animated.timing(slideY, { toValue: SH, duration: 280, useNativeDriver: true, easing: Easing.in(Easing.cubic) }).start();
      setGame(null);
      setTab('home');
    }
  }, [visible]);

  useEffect(() => {
    Animated.timing(tabAnim, { toValue: ['home','badges','games','rank'].indexOf(tab), duration: 300, useNativeDriver: false }).start();
  }, [tab]);

  const handleXP = useCallback((amount: number) => {
    onAddXP(amount);
    setXPBurst({ visible: true, amount });
    setTimeout(() => setXPBurst({ visible: false, amount: 0 }), 1000);
  }, [onAddXP]);

  const claimChallenge = useCallback((id: string, xpAmount: number) => {
    if (claimedChallenges.includes(id)) return;
    setClaimedChallenges(c => [...c, id]);
    handleXP(xpAmount);
  }, [claimedChallenges, handleXP]);

  const TABS = [
    { id: 'home',   icon: 'planet-outline',    label: 'Cosmos' },
    { id: 'badges', icon: 'ribbon-outline',     label: 'Badges' },
    { id: 'games',  icon: 'game-controller-outline', label: 'Jeux' },
    { id: 'rank',   icon: 'podium-outline',     label: 'Rang' },
  ] as const;

  const renderContent = () => {
    if (game === 'guess')  return <GuessTheFilm works={works} onXP={handleXP} onClose={() => setGame(null)} />;
    if (game === 'trivia') return <AstroQuiz onXP={handleXP} onClose={() => setGame(null)} />;
    if (game === 'streak') return <CosmicStreak works={works} onXP={handleXP} onClose={() => setGame(null)} />;

    switch (tab) {
      case 'home': return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: EDGE, paddingBottom: 40 }}>
          {/* Hero stats */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${currentLevel.color || C.gold}20`, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: `${currentLevel.color || C.gold}50`, marginBottom: 10 }}>
              <Text style={{ fontSize: 36 }}>{currentLevel.icon}</Text>
            </View>
            <Text style={{ color: C.white, fontSize: 20, fontWeight: '900' }}>{currentLevel.title}</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Niveau {currentLevel.level}</Text>
          </View>

          <XPProgressBar progress={xpProgress} currentLevel={currentLevel} nextLevel={nextLevel} xp={xp} />

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
            <StreakBubble streak={streak} />
            <View style={{ flex: 1, gap: 10 }}>
              <LinearGradient colors={[C.blueFaint, 'rgba(7,12,23,0.8)']} style={{ borderRadius: 14, padding: 12, borderWidth: 1, borderColor: `${C.blue}30` }}>
                <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700' }}>AUJOURD'HUI</Text>
                <Text style={{ color: C.blue, fontSize: 20, fontWeight: '900', marginTop: 2 }}>+{todayXP}</Text>
                <Text style={{ color: C.muted, fontSize: 9 }}>XP gagnés</Text>
              </LinearGradient>
              <LinearGradient colors={[C.purpleFaint, 'rgba(7,12,23,0.8)']} style={{ borderRadius: 14, padding: 12, borderWidth: 1, borderColor: `${C.purple}30` }}>
                <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700' }}>CETTE SEMAINE</Text>
                <Text style={{ color: C.purple, fontSize: 20, fontWeight: '900', marginTop: 2 }}>+{weekXP}</Text>
                <Text style={{ color: C.muted, fontSize: 9 }}>XP gagnés</Text>
              </LinearGradient>
            </View>
          </View>

          {/* Daily challenges */}
          <Text style={{ color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 12 }}>⚡ Défis du jour</Text>
          {DAILY_CHALLENGES.map(ch => (
            <DailyChallengeRow
              key={ch.id}
              challenge={ch}
              claimed={claimedChallenges.includes(ch.id)}
              onClaim={() => claimChallenge(ch.id, ch.xp)}
            />
          ))}

          {/* Quick play CTA */}
          <TouchableOpacity onPress={() => setTab('games')} activeOpacity={0.85} style={{ marginTop: 8 }}>
            <LinearGradient colors={['rgba(155,107,255,0.25)', 'rgba(90,150,230,0.15)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: `${C.purple}40` }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${C.purple}30`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>🎮</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.white, fontSize: 14, fontWeight: '800' }}>Mini-jeux cosmiques</Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Gagnez de l'XP en jouant</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.purple} />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      );

      case 'badges': return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: EDGE, paddingBottom: 40 }}>
          <Text style={{ color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>🏅 Collection de badges</Text>
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 20 }}>{unlockedBadges.length}/{BADGES_DATA.length} débloqués</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {BADGES_DATA.map(b => (
              <BadgeCard
                key={b.id}
                badge={b}
                unlocked={unlockedBadges.includes(b.id)}
                onPress={() => {
                  if (!unlockedBadges.includes(b.id)) {
                    onUnlockBadge(b.id);
                    handleXP(b.xp);
                  }
                }}
              />
            ))}
          </View>
        </ScrollView>
      );

      case 'games': return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: EDGE, paddingBottom: 40 }}>
          <Text style={{ color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>🎮 Mini-jeux</Text>
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 20 }}>Gagnez de l'XP en t'amusant</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {MINI_GAMES.map(g => (
              <MiniGameCard key={g.id} game={g} onPlay={() => setGame(g.id)} />
            ))}
          </View>
          <View style={{ marginTop: 24, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: `${C.gold}30` }}>
            <LinearGradient colors={[C.goldFaint, 'rgba(7,12,23,0.9)']} style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 28 }}>🔒</Text>
                <View>
                  <Text style={{ color: C.white, fontSize: 13, fontWeight: '800' }}>Tournoi cosmique</Text>
                  <Text style={{ color: C.muted, fontSize: 11 }}>Débloqué au niveau 4 — Astronaute</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </ScrollView>
      );

      case 'rank': return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: EDGE, paddingBottom: 40 }}>
          <Text style={{ color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>🏆 Classement cosmique</Text>
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 20 }}>Top explorateurs de l'univers</Text>
          {leaderboard.map((r, i) => (
            <View key={r.rank} style={{ marginBottom: 10, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: (r as any).isMe ? `${C.blue}50` : C.border }}>
              <LinearGradient colors={(r as any).isMe ? [`${C.blue}15`, 'rgba(7,12,23,0.9)'] : ['rgba(13,32,64,0.5)', 'rgba(7,12,23,0.8)']}
                style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Text style={{ fontSize: i < 3 ? 22 : 16, minWidth: 28, textAlign: 'center' }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${r.rank}`}
                </Text>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${r.color}20`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${r.color}50` }}>
                  <Text style={{ fontSize: 18 }}>{r.badge}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: (r as any).isMe ? C.blue : C.white, fontSize: 13, fontWeight: '800' }}>{r.name}{(r as any).isMe ? ' (toi)' : ''}</Text>
                </View>
                <Text style={{ color: C.gold, fontSize: 13, fontWeight: '900' }}>{r.xp.toLocaleString()} XP</Text>
              </LinearGradient>
            </View>
          ))}
          <View style={{ marginTop: 16, borderRadius: 14, padding: 16, backgroundColor: C.faint, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
            <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              Gagnez de l'XP en regardant des films, complétant des défis et jouant pour grimper dans le classement 🚀
            </Text>
          </View>
        </ScrollView>
      );
    }
  };

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(7,12,23,0.85)' }}>
        <GalaxyBackground />
        <Animated.View style={{ flex: 1, transform: [{ translateY: slideY }] }}>
          {/* Header */}
          <View style={{ paddingTop: insets.top + 12, paddingHorizontal: EDGE, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                {game ? (game === 'guess' ? '🎬 Devine le Film' : game === 'trivia' ? '🌟 Astro Quiz' : '⚡ Cosmic Streak') : '🌌 Galaxie XP'}
              </Text>
              {!game && <Text style={{ color: C.muted, fontSize: 12, marginTop: 1 }}>{xp.toLocaleString()} XP · Niv. {currentLevel.level}</Text>}
            </View>
            <TouchableOpacity onPress={game ? () => setGame(null) : onClose}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.subtle, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <Ionicons name={game ? 'arrow-back' : 'close'} size={18} color={C.white} />
            </TouchableOpacity>
          </View>

          {/* Tab bar (hidden in game) */}
          {!game && (
            <View style={{ flexDirection: 'row', paddingHorizontal: EDGE, marginBottom: 4 }}>
              {TABS.map(t => {
                const active = tab === t.id;
                return (
                  <TouchableOpacity key={t.id} onPress={() => setTab(t.id as any)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                    <Ionicons name={t.icon as any} size={20} color={active ? C.white : C.muted} />
                    <Text style={{ color: active ? C.white : C.muted, fontSize: 10, fontWeight: active ? '800' : '600', marginTop: 3 }}>{t.label}</Text>
                    {active && <View style={{ position: 'absolute', bottom: 0, width: 20, height: 2, borderRadius: 1, backgroundColor: C.blue }} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Divider */}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginBottom: 4 }} />

          {/* Content */}
          <View style={{ flex: 1 }}>
            {renderContent()}
          </View>

          {/* XP Burst overlay */}
          <XPBurst visible={xpBurst.visible} xp={xpBurst.amount} onDone={() => {}} />
        </Animated.View>
      </View>
    </Modal>
  );
});

// ─── GAMIFICATION BADGE BUTTON (remplace WeeklyChallengeCard) ─────────────────
const GamificationBadge = memo(({
  xp, currentLevel, xpProgress, streak, onPress,
}: {
  xp: number; currentLevel: any; xpProgress: number; streak: number; onPress: () => void;
}) => {
  const scale = usePulse(2000);
  const btnScale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const press = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, tension: 300, friction: 8, useNativeDriver: true }),
    ]).start(onPress);
  };

  return (
    <TouchableOpacity onPress={press} activeOpacity={0.95} style={{ marginHorizontal: EDGE }}>
      <Animated.View style={{ transform: [{ scale: btnScale }] }}>
        <LinearGradient
          colors={['rgba(90,150,230,0.18)', 'rgba(155,107,255,0.14)', 'rgba(7,12,23,0.95)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(90,150,230,0.30)' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {/* Animated level icon */}
            <Animated.View style={{ transform: [{ scale }] }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${currentLevel.color || C.gold}20`, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: `${currentLevel.color || C.gold}50` }}>
                <Text style={{ fontSize: 26 }}>{currentLevel.icon}</Text>
              </View>
            </Animated.View>

            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: C.white, fontSize: 15, fontWeight: '900' }}>Galaxie XP</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  {streak > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,140,66,0.15)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10 }}>🔥</Text>
                      <Text style={{ color: C.orange, fontSize: 11, fontWeight: '800' }}>{streak}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.goldFaint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10 }}>⚡</Text>
                    <Text style={{ color: C.gold, fontSize: 11, fontWeight: '800' }}>{xp.toLocaleString()}</Text>
                  </View>
                </View>
              </View>

              {/* XP bar */}
              <View style={{ height: 5, backgroundColor: C.subtle, borderRadius: 3, overflow: 'hidden' }}>
                <Animated.View style={{
                  height: '100%', borderRadius: 3,
                  width: `${xpProgress * 100}%`,
                  backgroundColor: currentLevel.color || C.gold,
                }} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: C.muted, fontSize: 11 }}>{currentLevel.title} · Niv.{currentLevel.level}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: C.blue, fontSize: 11, fontWeight: '600' }}>Ouvrir</Text>
                  <Ionicons name="chevron-forward" size={11} color={C.blue} />
                </View>
              </View>
            </View>
          </View>

          {/* Sub-row with mini stats */}
          <View style={{ flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, gap: 8 }}>
            {[
              { icon: '🎮', label: 'Mini-jeux', val: '3' },
              { icon: '🏅', label: 'Badges', val: `${BADGES_DATA.length}` },
              { icon: '⚔️', label: 'Défis', val: `${DAILY_CHALLENGES.length}` },
              { icon: '🏆', label: 'Classement', val: '#5' },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 14 }}>{s.icon}</Text>
                <Text style={{ color: C.white, fontSize: 12, fontWeight: '800' }}>{s.val}</Text>
                <Text style={{ color: C.muted, fontSize: 9, fontWeight: '600' }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── FETCH WORKS ──────────────────────────────────────────────────────────────
const COLS = 'id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,created_at';
async function fetchAllWorks(): Promise<Work[]> {
  const { data, error } = await supabase.from('works').select(COLS).order('likes', { ascending: false }).limit(200);
  if (error) { const { data: fb } = await supabase.from('works').select(COLS).order('likes', { ascending: false }).limit(100); return (fb ?? []) as Work[]; }
  return (data ?? []) as Work[];
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
const HERO_H = SH * 0.50, AUTO_MS = 5000;
const HeroSlide = memo(({ item, width, onPress }: { item: Work; width: number; onPress: () => void }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const uri = useMemo(() => resolveImg(item.id, item.image), [item.id, item.image]);
  const isPepite = (item.likes ?? 0) < 100;
  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={{ width, height: HERO_H }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.navyMid }]} />
      <Animated.Image source={{ uri }} style={[StyleSheet.absoluteFill, { opacity: fade }]} resizeMode="cover" onLoad={() => Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start()} />
      <LinearGradient colors={['rgba(7,12,23,0.50)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140 }} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(7,12,23,0.72)', 'rgba(7,12,23,0.97)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%' as any }} pointerEvents="none" />
      <View style={hs.content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {item.is_original && <View style={hs.origBadge}><Ionicons name="star" size={8} color={C.white} /><Text style={hs.origTxt}>ORIGINAL</Text></View>}
          {isPepite && <View style={hs.pepiteBadge}><Ionicons name="sparkles" size={8} color={C.white} /><Text style={hs.pepiteTxt}>PÉPITE</Text></View>}
        </View>
        <Text style={hs.title} numberOfLines={2}>{item.title ?? ''}</Text>
        {!!(item.adjective || item.genre) && <Text style={hs.sub} numberOfLines={1}>{item.adjective || `${item.genre ?? ''}${item.year ? ` · ${item.year}` : ''}`}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="heart" size={11} color={C.mid} /><Text style={hs.statTxt}>{fmtK(item.likes ?? 0)}</Text></View>
          {item.duration != null && <><View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.subtle }} /><Text style={hs.statTxt}>{fmtDur(item.duration)}</Text></>}
        </View>
        <View style={hs.actions}>
          <TouchableOpacity style={hs.playBtn} onPress={onPress} activeOpacity={0.85}><Ionicons name="play" size={14} color={C.navyMid} /><Text style={{ color: C.navyMid, fontSize: 13, fontWeight: '700' }}>Regarder</Text></TouchableOpacity>
          <TouchableOpacity style={hs.infoBtn} onPress={onPress} activeOpacity={0.80}><Ionicons name="information-circle-outline" size={14} color={C.white} /><Text style={{ color: C.white, fontSize: 13, fontWeight: '600' }}>Détails</Text></TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const hs = StyleSheet.create({ content: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingBottom: 52, gap: 8 }, origBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.08)' }, origTxt: { color: C.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 }, pepiteBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderHi }, pepiteTxt: { color: C.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 }, title: { color: C.white, fontSize: 26, fontWeight: '800', letterSpacing: -0.4, lineHeight: 32 }, sub: { color: C.muted, fontSize: 13 }, statTxt: { color: C.muted, fontSize: 11, fontWeight: '600' }, actions: { flexDirection: 'row', gap: 10, marginTop: 2 }, playBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.white, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24 }, infoBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.faint, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border } });

const HeroBanner = memo(({ works, loading }: { works: Work[]; loading: boolean }) => {
  const router = useRouter(); const scrollX = useRef(new Animated.Value(0)).current; const flatRef = useRef<FlatList<Work>>(null); const timer = useRef<ReturnType<typeof setInterval>>(); const paused = useRef(false), idxRef = useRef(0); const [slotW, setSlotW] = useState(SW);
  const scrollTo = useCallback((i: number, animated = true) => { if (!works.length || slotW === 0) return; const next = ((i % works.length) + works.length) % works.length; flatRef.current?.scrollToOffset({ offset: next * slotW, animated }); idxRef.current = next; }, [works.length, slotW]);
  useEffect(() => { if (works.length < 2) return; clearInterval(timer.current); timer.current = setInterval(() => { if (!paused.current) scrollTo(idxRef.current + 1); }, AUTO_MS); return () => clearInterval(timer.current); }, [works.length, scrollTo]);
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false }), [scrollX]);
  const renderItem = useCallback(({ item }: ListRenderItemInfo<Work>) => <HeroSlide item={item} width={slotW} onPress={() => router.push(`/film/${item.id}` as any)} />, [router, slotW]);
  const keyExtract = useCallback((w: Work) => `hero-${w.id}`, []);
  if (loading || !works.length) return <View style={{ height: HERO_H, backgroundColor: C.navyLow }}><View style={{ ...StyleSheet.absoluteFillObject, padding: 22, justifyContent: 'flex-end', gap: 10 }}><Shimmer w="50%" h={12} /><Shimmer w="75%" h={26} /><Shimmer w="40%" h={11} /><Shimmer w="54%" h={40} r={24} /></View></View>;
  const dotCount = Math.min(works.length, 8);
  return (
    <View style={{ height: HERO_H, overflow: 'hidden' }} onLayout={e => setSlotW(e.nativeEvent.layout.width)}>
      <FlatList ref={flatRef} data={works} keyExtractor={keyExtract} renderItem={renderItem} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16} onScrollBeginDrag={() => { paused.current = true; }} onMomentumScrollEnd={e => { idxRef.current = Math.round(e.nativeEvent.contentOffset.x / slotW); paused.current = false; }} windowSize={5} initialNumToRender={3} maxToRenderPerBatch={3} removeClippedSubviews={false} />
      {works.length > 1 && <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }}>{Array.from({ length: dotCount }).map((_, i) => { const inp = [(i - 1) * slotW, i * slotW, (i + 1) * slotW]; return (<TouchableOpacity key={i} onPress={() => scrollTo(i)} hitSlop={10}><Animated.View style={{ height: 3, borderRadius: 2, backgroundColor: C.white, opacity: scrollX.interpolate({ inputRange: inp, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' }), width: scrollX.interpolate({ inputRange: inp, outputRange: [6, 20, 6], extrapolate: 'clamp' }) }} /></TouchableOpacity>); })}</View>}
    </View>
  );
});

// ─── PORTRAIT CARD ────────────────────────────────────────────────────────────
const PORT_W = 128, PORT_H = 190;
const PortraitCard = memo(({ item, rank, isPepite }: { item: Work; rank?: number; isPepite?: boolean }) => {
  const router = useRouter(); const uri = useMemo(() => resolveImg(item.id, item.image), [item.id, item.image]);
  return (
    <TouchableOpacity style={{ marginRight: 10 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={prc.card}>
        <Image source={{ uri }} style={prc.img} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(7,12,23,0.90)']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }} />
        <View style={prc.badge}><Text style={prc.badgeTxt}>{item.is_original ? 'ORIG' : (item.category ?? '').slice(0, 4).toUpperCase()}</Text></View>
        {isPepite && <View style={prc.pepite}><Ionicons name="sparkles" size={7} color={C.white} /><Text style={{ color: C.white, fontSize: 7, fontWeight: '800', letterSpacing: 0.5 }}>PÉPITE</Text></View>}
        {rank != null && <Text style={prc.rankNum}>{rank}</Text>}
        <View style={prc.meta}><Text style={prc.title} numberOfLines={2}>{item.title}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="heart" size={9} color={C.mid} /><Text style={prc.stat}>{fmtK(item.likes ?? 0)}</Text>{item.year && <><View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: C.subtle }} /><Text style={prc.stat}>{item.year}</Text></>}</View></View>
      </View>
    </TouchableOpacity>
  );
});
const prc = StyleSheet.create({ card: { width: PORT_W, height: PORT_H, borderRadius: 12, overflow: 'hidden', backgroundColor: C.navyMid }, img: { width: '100%', height: '100%', resizeMode: 'cover' }, badge: { position: 'absolute', top: 7, left: 7, paddingHorizontal: 5, paddingVertical: 2.5, borderRadius: 5, backgroundColor: 'rgba(7,12,23,0.72)' }, badgeTxt: { color: C.mid, fontSize: 7, fontWeight: '800', letterSpacing: 0.4 }, pepite: { position: 'absolute', top: 7, right: 7, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2.5, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderHi }, rankNum: { position: 'absolute', bottom: 32, right: 6, fontSize: 48, fontWeight: '900', lineHeight: 48, letterSpacing: -3, color: 'rgba(255,255,255,0.12)' }, meta: { position: 'absolute', bottom: 8, left: 9, right: 9, gap: 3 }, title: { color: C.white, fontSize: 11, fontWeight: '700', lineHeight: 14 }, stat: { color: C.muted, fontSize: 9, fontWeight: '600' } });

// ─── LANDSCAPE CARD ───────────────────────────────────────────────────────────
const LAND_W = 226, LAND_H = 128;
const LandscapeCard = memo(({ item }: { item: Work }) => {
  const router = useRouter(); const uri = useMemo(() => resolveImg(item.id, item.image), [item.id, item.image]);
  return (
    <TouchableOpacity style={{ marginRight: 10 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={lc.card}>
        <Image source={{ uri }} style={lc.img} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} />
        {item.duration != null && <View style={lc.dur}><Ionicons name="time-outline" size={8} color={C.muted} /><Text style={{ color: C.muted, fontSize: 8, fontWeight: '600' }}>{fmtDur(item.duration)}</Text></View>}
        <View style={lc.meta}><Text style={lc.title} numberOfLines={1}>{item.title}</Text>{!!item.adjective && <Text style={{ color: C.muted, fontSize: 9 }} numberOfLines={1}>{item.adjective}</Text>}<View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="heart" size={9} color={C.mid} /><Text style={lc.stat}>{fmtK(item.likes ?? 0)}</Text>{item.director && <><View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: C.subtle }} /><Text style={lc.stat} numberOfLines={1}>{item.director}</Text></>}</View></View>
      </View>
    </TouchableOpacity>
  );
});
const lc = StyleSheet.create({ card: { width: LAND_W, height: LAND_H, borderRadius: 12, overflow: 'hidden', backgroundColor: C.navyMid }, img: { width: '100%', height: '100%', resizeMode: 'cover' }, dur: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(7,12,23,0.72)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 }, meta: { position: 'absolute', bottom: 9, left: 10, right: 10, gap: 2 }, title: { color: C.white, fontSize: 12, fontWeight: '700' }, stat: { color: C.muted, fontSize: 9, fontWeight: '600', flexShrink: 1 } });

// ─── ROW SECTION ──────────────────────────────────────────────────────────────
const RowSection = memo(({ title, subtitle, count, items, loading, variant, showRank, showPepite }: { title: string; subtitle?: string; count?: number; items: Work[]; loading: boolean; variant: 'portrait' | 'landscape'; showRank?: boolean; showPepite?: boolean }) => {
  const isPort = variant === 'portrait'; const CW = isPort ? PORT_W : LAND_W; const CH = isPort ? PORT_H : LAND_H; const SNAP = CW + 10;
  const renderItem = useCallback(({ item, index }: { item: Work; index: number }) => isPort ? <PortraitCard item={item} rank={showRank ? index + 1 : undefined} isPepite={showPepite && (item.likes ?? 0) < 100} /> : <LandscapeCard item={item} />, [isPort, showRank, showPepite]);
  const getLayout = useCallback((_: any, i: number) => ({ length: SNAP, offset: SNAP * i, index: i }), [SNAP]);
  const keyExtract = useCallback((w: Work) => `${variant}-${w.id}`, [variant]);
  if (loading) return (<View style={{ marginBottom: 0 }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: EDGE, gap: 10 }}>{[0, 1, 2, 3, 4].map(i => <Shimmer key={i} w={CW} h={CH} r={12} />)}</ScrollView></View>);
  if (!items.length) return null;
  return (
    <View style={{ marginBottom: 0 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: EDGE, marginBottom: 14 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.white, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>{title}</Text>
          {(subtitle || count != null) && <Text style={{ color: C.muted, fontSize: 11 }}>{[subtitle, count != null ? `${count} œuvres` : null].filter(Boolean).join(' · ')}</Text>}
        </View>
      </View>
      <FlatList horizontal data={items} keyExtractor={keyExtract} renderItem={renderItem} getItemLayout={getLayout} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: EDGE }} decelerationRate="fast" snapToInterval={SNAP} snapToAlignment="start" initialNumToRender={6} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews />
    </View>
  );
});

// ─── SEARCH OVERLAY ───────────────────────────────────────────────────────────
const SearchOverlay = memo(({ visible, onClose, works }: { visible: boolean; onClose: () => void; works: Work[] }) => {
  const router = useRouter(); const insets = useSafeAreaInsets(); const [q, setQ] = useState(''); const inputRef = useRef<TextInput>(null); const slideY = useRef(new Animated.Value(SH)).current;
  useEffect(() => { if (visible) { Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }).start(); const t = setTimeout(() => inputRef.current?.focus(), 300); return () => clearTimeout(t); } else { setQ(''); Animated.timing(slideY, { toValue: SH, duration: 220, useNativeDriver: true }).start(); } }, [visible, slideY]);
  const results = useMemo(() => { if (!q.trim()) return works.slice(0, 40); const lower = q.toLowerCase(); return works.filter(w => (w.title ?? '').toLowerCase().includes(lower) || (w.genre ?? '').toLowerCase().includes(lower) || (w.director ?? '').toLowerCase().includes(lower) || (w.adjective ?? '').toLowerCase().includes(lower)).slice(0, 80); }, [q, works]);
  const CW = (SW - 42) / 2;
  const goFilm = useCallback((id: number) => { onClose(); router.push(`/film/${id}` as any); }, [onClose, router]);
  const renderResult = useCallback(({ item }: ListRenderItemInfo<Work>) => (
    <TouchableOpacity style={[so.card, { width: CW }]} onPress={() => goFilm(item.id)} activeOpacity={0.85}>
      <Image source={{ uri: resolveImg(item.id, item.image) }} style={so.cardImg} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject} />
      {(item.likes ?? 0) < 100 && <View style={so.pepiteBadge}><Ionicons name="sparkles" size={7} color={C.white} /><Text style={{ color: C.white, fontSize: 7, fontWeight: '800' }}>PÉPITE</Text></View>}
      <View style={so.cardInfo}><Text style={so.cardTitle} numberOfLines={2}>{item.title}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="heart" size={9} color={C.mid} /><Text style={so.cardMeta}>{fmtK(item.likes ?? 0)}</Text>{item.duration != null && <><View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: C.subtle }} /><Text style={so.cardMeta}>{fmtDur(item.duration)}</Text></>}</View></View>
    </TouchableOpacity>
  ), [goFilm, CW]);
  if (!visible) return null;
  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GalaxyBackground />
      <Animated.View style={{ flex: 1, transform: [{ translateY: slideY }] }}>
        <View style={[so.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={so.inputRow}><Ionicons name="search-outline" size={15} color={C.muted} /><TextInput ref={inputRef} style={so.input} value={q} onChangeText={setQ} placeholder="Titre, genre, réalisateur…" placeholderTextColor={C.muted} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" /></View>
          <TouchableOpacity onPress={onClose} style={{ paddingLeft: 8 }}><Text style={{ color: C.muted, fontSize: 14, fontWeight: '600' }}>Annuler</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, marginBottom: 12 }}><Ionicons name="film-outline" size={11} color={C.muted} /><Text style={{ color: C.muted, fontSize: 11 }}>{results.length} résultat{results.length !== 1 ? 's' : ''}{q.trim() ? ` pour « ${q.trim()} »` : ' · Catalogue'}</Text></View>
        {results.length === 0
          ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}><Ionicons name="search-outline" size={36} color={C.white} /><Text style={{ color: C.mid, fontSize: 15, fontWeight: '600' }}>Aucun résultat</Text></View>
          : <FlatList data={results} keyExtractor={w => `s${w.id}`} renderItem={renderResult} numColumns={2} columnWrapperStyle={{ justifyContent: 'space-between', gap: 10, marginBottom: 10 }} contentContainerStyle={[{ paddingHorizontal: 16 }, { paddingBottom: insets.bottom + 40 }]} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={10} windowSize={5} />}
      </Animated.View>
    </Modal>
  );
});
const so = StyleSheet.create({ topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, gap: 8 }, inputRow: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, height: 40, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }, input: { flex: 1, color: C.white, fontSize: 14 }, card: { height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: C.navyMid }, cardImg: { width: '100%', height: '100%' }, cardInfo: { position: 'absolute', bottom: 8, left: 9, right: 9, gap: 4 }, cardTitle: { color: C.white, fontSize: 12, fontWeight: '700' }, cardMeta: { color: C.muted, fontSize: 10, fontWeight: '600' }, pepiteBadge: { position: 'absolute', top: 7, right: 7, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2.5, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderHi } });

// ─════════════════════════════════════════════════════════════════════════════
// ★★★ SCREEN
// ─════════════════════════════════════════════════════════════════════════════
export default function SearchScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const [works,      setWorks]      = useState<Work[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userId,     setUserId]     = useState('anonymous');
  const [galaxyOpen, setGalaxyOpen] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session?.user?.id) setUserId(session.user.id); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => { if (s?.user?.id) setUserId(s.user.id); });
    return () => subscription.unsubscribe();
  }, []);

  // Works
  useEffect(() => {
    let dead = false; setLoading(true);
    fetchAllWorks().then(data => { if (!dead) { setWorks(data); setLoading(false); } }).catch(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, []);

  // XP Store
  const { xp, streak, todayXP, weekXP, currentLevel, nextLevel, xpProgress, unlockedBadges, addXP, unlockBadge } = useXPStore(userId);

  // Legacy gamification (pour compatibilité GamificationSystem)
  const { profile, badges, earnedBadges, loading: gLoading } = useGamification(userId, works);
  const { challenge, progress, upsertProgress } = useWeeklyChallenge(userId);

  // Sections
  const heroItems = useMemo(() => works.slice(0, 20), [works]);
  const popular   = useMemo(() => works, [works]);
  const recent    = useMemo(() => [...works].sort((a, b) => { const da = a.created_at ? new Date(a.created_at).getTime() : 0, db = b.created_at ? new Date(b.created_at).getTime() : 0; return db - da; }).slice(0, 30), [works]);
  const originals = useMemo(() => works.filter(w => w.is_original), [works]);
  const courts    = useMemo(() => works.filter(w => (w.duration ?? 0) > 0 && (w.duration ?? 0) < 60), [works]);
  const moyens    = useMemo(() => works.filter(w => (w.duration ?? 0) >= 60 && (w.duration ?? 0) <= 100), [works]);
  const longs     = useMemo(() => works.filter(w => (w.duration ?? 0) > 100), [works]);
  const pepites   = useMemo(() => works.filter(w => (w.likes ?? 0) < 100 && (w.likes ?? 0) > 5).sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 20), [works]);

  const headerOp = scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* Floating header */}
      <Animated.View style={{ position: 'absolute', top: 5, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: EDGE, paddingTop: insets.top + 4, paddingBottom: 8, opacity: headerOp }} pointerEvents="box-none">
        <Text style={{ flex: 1, color: C.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>UNIVERSE</Text>
        <TouchableOpacity style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.subtle, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }} onPress={() => setSearchOpen(true)} activeOpacity={0.78}>
          <Ionicons name="search-outline" size={18} color={C.white} />
        </TouchableOpacity>
      </Animated.View>

      <SearchOverlay visible={searchOpen} onClose={() => setSearchOpen(false)} works={works} />

      {/* Galaxy Gamification Modal */}
      <GalaxyGamificationModal
        visible={galaxyOpen}
        onClose={() => setGalaxyOpen(false)}
        works={works}
        userId={userId}
        xp={xp}
        streak={streak}
        todayXP={todayXP}
        weekXP={weekXP}
        currentLevel={currentLevel}
        nextLevel={nextLevel}
        xpProgress={xpProgress}
        unlockedBadges={unlockedBadges}
        onAddXP={addXP}
        onUnlockBadge={unlockBadge}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {/* Hero */}
        <HeroBanner works={heroItems} loading={loading} />
        <View style={{ height: 24 }} />

        {/* ★ GAMIFICATION BADGE — ouvre GalaxyGamificationModal */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: EDGE, marginBottom: 12 }}>
            <Text style={{ fontSize: 13 }}>🌌</Text>
            <Text style={{ color: C.white, fontSize: 17, fontWeight: '800' }}>Progression cosmique</Text>
          </View>
          <GamificationBadge
            xp={xp}
            currentLevel={currentLevel}
            xpProgress={xpProgress}
            streak={streak}
            onPress={() => setGalaxyOpen(true)}
          />
        </View>

        {/* Sections catalogue */}
        <RowSection title="Les plus populaires" count={loading ? undefined : works.length} items={popular} loading={loading} variant="portrait" showRank />
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.faint, marginHorizontal: EDGE, marginVertical: 24 }} />

        {(recent.length > 0 || loading) && <><RowSection title="Récemment ajoutés" subtitle="Nouvelles œuvres" items={recent} loading={loading} variant="landscape" /><View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.faint, marginHorizontal: EDGE, marginVertical: 24 }} /></>}

        {pepites.length > 0 && <>
          <View style={{ marginBottom: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: EDGE, marginBottom: 12 }}>
              <Ionicons name="sparkles-outline" size={13} color={C.mid} />
              <Text style={{ color: C.white, fontSize: 17, fontWeight: '800' }}>Pépites cachées</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderHi, marginLeft: 'auto' as any }}>
                <Text style={{ color: C.white, fontSize: 9, fontWeight: '700' }}>À découvrir</Text>
              </View>
            </View>
            <RowSection title="" items={pepites} loading={loading} variant="portrait" showPepite />
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.faint, marginHorizontal: EDGE, marginVertical: 24 }} />
        </>}

        {(originals.length > 0 || loading) && <><RowSection title="Originaux Universe" subtitle="Créations exclusives" count={loading ? undefined : originals.length} items={originals} loading={loading} variant="portrait" /><View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.faint, marginHorizontal: EDGE, marginVertical: 24 }} /></>}

        {(courts.length > 0 || loading) && <><RowSection title="Courts métrages" subtitle="Moins de 60 min" count={loading ? undefined : courts.length} items={courts} loading={loading} variant="landscape" /><View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.faint, marginHorizontal: EDGE, marginVertical: 24 }} /></>}

        {(moyens.length > 0 || loading) && <><RowSection title="Moyens métrages" subtitle="60 – 100 min" count={loading ? undefined : moyens.length} items={moyens} loading={loading} variant="landscape" /><View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.faint, marginHorizontal: EDGE, marginVertical: 24 }} /></>}

        {(longs.length > 0 || loading) && <RowSection title="Mini-séries" subtitle="Plus de 100 min" count={loading ? undefined : longs.length} items={longs} loading={loading} variant="landscape" />}

        <View style={{ height: 120 }} />
      </Animated.ScrollView>
    </View>
  );
}