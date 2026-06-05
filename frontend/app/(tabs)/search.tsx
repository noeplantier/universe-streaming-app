/**
 * app/(tabs)/search.tsx  —  UNIVERSE v8
 * ─────────────────────────────────────────────────────────────────────────────
 *  ★ Palette : blanc / or — fond C.card (#0D2040) partout
 *  ★ Badge interactions glissant avec aura divine (remplace la liste)
 *  ★ Proportions fixes sur tous les badges (pas de layout shift)
 *  ★ 20 phrases FOMO pour forcer le jeu
 *  ★ 6 jeux Galaxy ultra-sophistiqués
 *  ★ XP uniquement à la fin · Badges auto par seuil XP
 *  ★ Classement dynamique Supabase · ZERO supabase.auth.*
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, Easing, FlatList, Image, Modal,
  PanResponder, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import { StatusBar }         from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase }          from '@/lib/supabase';
import { getDeviceId }       from '@/services/api';
import GalaxyBackground      from '@/components/social/GalaxyBackground';
import { resolveImg, type Work } from '@/contexts/GamificationSystem';
import { useLeaderboard }        from '@/components/gamification';

const { width: SW, height: SH } = Dimensions.get('window');
let _H: any = null;
if (Platform.OS !== 'web') { try { _H = require('expo-haptics'); } catch {} }
const hL = () => _H?.impactAsync?.(_H.ImpactFeedbackStyle?.Light  ).catch(() => {});
const hM = () => _H?.impactAsync?.(_H.ImpactFeedbackStyle?.Medium ).catch(() => {});
const hS = () => _H?.notificationAsync?.(_H.NotificationFeedbackType?.Success).catch(() => {});

// ─── PALETTE — blanc / or pour récompenses, C.card pour tous les fonds ──────
const C = {
  bg      : '#04080F',               // void
  card    : '#0D2040',               // ★ fond unique de tous les badges/cartes
  navy    : '#0A1830',
  white   : '#FFFFFF',
  text    : 'rgba(255,255,255,0.88)',
  muted   : 'rgba(255,255,255,0.42)',
  subtle  : 'rgba(255,255,255,0.14)',
  faint   : 'rgba(255,255,255,0.06)',
  border  : 'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.20)',
  // ★ Or — seule couleur pour XP / étoiles / récompenses
  gold    : '#F5C842',
  goldFaint: 'rgba(245,200,66,0.13)',
  goldBd  : 'rgba(245,200,66,0.28)',
  // Accents jeux uniquement
  blue    : '#5A96E6',  blueFaint : 'rgba(90,150,230,0.11)',
  green   : '#2ECC8A',  greenFaint: 'rgba(46,204,138,0.11)',
  purple  : '#9B6BFF',  purpleFaint:'rgba(155,107,255,0.12)',
  cyan    : '#4DD8E8',  cyanFaint : 'rgba(77,216,232,0.11)',
  red     : '#FF5C72',
  orange  : '#FF8C42',
} as const;

const E = 20; // edge padding
const fmtK   = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : `${n}`;
const fmtDur = (m: number | null) => { if (!m) return ''; if (m >= 60) return `${Math.floor(m/60)}h${m%60 ? ` ${m%60}m` : ''}`; return `${m}m`; };
const fmtXP  = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : `${n}`;

// ─── NIVEAUX (couleurs blanches / or uniquement) ───────────────────────────
const LEVELS = [
  { level:1, title:'Étoile Naissante', minXP:0,    icon:'star-outline'      as const, color:'rgba(255,255,255,0.52)' },
  { level:2, title:'Nébuleuse',        minXP:100,  icon:'sparkles-outline'  as const, color:'rgba(255,255,255,0.68)' },
  { level:3, title:'Comète',           minXP:300,  icon:'flash-outline'     as const, color:'rgba(255,255,255,0.84)' },
  { level:4, title:'Astronaute',       minXP:600,  icon:'rocket-outline'    as const, color:C.gold },
  { level:5, title:'Étoile Filante',   minXP:1000, icon:'flash-outline'     as const, color:C.gold },
  { level:6, title:'Supernova',        minXP:1800, icon:'nuclear-outline'   as const, color:C.gold },
  { level:7, title:'Trou Noir',        minXP:3000, icon:'infinite-outline'  as const, color:C.gold },
  { level:8, title:'Cosmos Keeper',    minXP:5000, icon:'planet-outline'    as const, color:C.gold },
] as const;
type Level = typeof LEVELS[number];

// ─── SEUILS XP AUTO-BADGE ──────────────────────────────────────────────────
const BADGE_XP: Record<string, number> = {
  first_watch:20, night_owl:50, original:120, social:80,
  streak_3:75, explorer:200, nugget:150, critique:250, cinephile:500, creator:400,
};

const BADGES = [
  { id:'first_watch', icon:'play-circle-outline'  as const, label:'Premier Film',      desc:'Visionner votre premier reel', xp:50  },
  { id:'streak_3',    icon:'flame-outline'         as const, label:'Flamme ×3',         desc:'3 connexions consécutives',     xp:75  },
  { id:'explorer',    icon:'compass-outline'       as const, label:'Explorateur',        desc:'Explorer 10 genres différents', xp:100 },
  { id:'cinephile',   icon:'film-outline'          as const, label:'Cinéphile',          desc:'Visionner 50 films',            xp:200 },
  { id:'nugget',      icon:'diamond-outline'       as const, label:'Chasseur Pépites',   desc:'Découvrir 5 pépites cachées',   xp:150 },
  { id:'night_owl',   icon:'moon-outline'          as const, label:'Hibou Cosmique',     desc:'Actif après 23h',               xp:60  },
  { id:'original',    icon:'star-outline'          as const, label:'Insider',             desc:'3 Originaux Universe vus',      xp:120 },
  { id:'social',      icon:'planet-outline'        as const, label:'Ambassadeur',         desc:'Partager 3 films',              xp:80  },
  { id:'critique',    icon:'create-outline'        as const, label:'Critique',            desc:'Publier 5 critiques',           xp:100 },
  { id:'creator',     icon:'videocam-outline'      as const, label:'Créateur',            desc:'Uploader une vidéo',            xp:150 },
];

// ─── DÉFIS QUOTIDIENS ────────────────────────────────────────────────────────
const DAILY = [
  { id:'d1', icon:'play-circle-outline' as const, title:'Sniper du Soir',  desc:'Regarder un court métrage jusqu\'à la fin', xp:40, progress:0, total:1 },
  { id:'d2', icon:'compass-outline'    as const, title:'Voyage Cosmique', desc:'Explorer 3 catégories différentes',          xp:60, progress:0, total:3 },
  { id:'d3', icon:'diamond-outline'    as const, title:'Pépite Hunter',   desc:'Découvrir une pépite cachée',                xp:50, progress:0, total:1 },
];

// ─── INTERACTIONS GLISSANTES (badge aura or) ─────────────────────────────────
const INTERACTIONS = [
  { icon:'heart-outline'        as const, label:'Liker une œuvre',              route:'/(tabs)/search', xp:10,     },  
  { icon:'create-outline'       as const, label:'Écrire une critique',      route:'/(tabs)/create'   ,  xp:50,     },
  { icon:'chatbubble-outline'   as const, label:'Ecrire un commentaire',    route:'/(tabs)/create'   ,  xp:30,     },
  { icon:'videocam-outline'     as const, label:'Créer une vidéo',          route:'/(tabs)/create'       ,xp:70,     },
  { icon:'share-outline'        as const, label:'Partager un film',         route:'/search'            , xp:20,       },
  { icon:'briefcase-outline'    as const, label:'Contacter un pro',                    xp:40,    route:'/social' },
  { icon:'person-outline'       as const, label:'Compléter son profil',                        xp:100,     route:'/profile'              },
  { icon:'play-circle-outline'  as const, label:'Visionner un film',                          xp:20,    route:'/'                    },
] as const;

// ─── 6 JEUX ──────────────────────────────────────────────────────────────────
const GAMES_META = [
  { id:'oracle',  icon:'planet-outline'    as const, title:'Oracle Cosmique',   desc:'Quiz app + cinéma + combo',           color:C.purple, dur:'3m', maxXP:400 },
  { id:'warp',    icon:'rocket-outline'    as const, title:'Warp Swipe',         desc:'Films à warp speed · multiplicateur', color:C.cyan,   dur:'4m', maxXP:300 },
  { id:'map',     icon:'star-outline'      as const, title:'Carte Stellaire',    desc:'Memory · constellations · 90s',       color:C.blue,   dur:'3m', maxXP:330 },
  { id:'vision',  icon:'sparkles-outline' as const, title:'Vision Directeur',   desc:'3 films → réalisateur · révélation',  color:C.green,  dur:'2m', maxXP:250 },
  { id:'nova',    icon:'flash-outline'    as const, title:'Nova Hunter',        desc:'Capturez avant l\'explosion · 25s',   color:C.orange, dur:'2m', maxXP:260 },
  { id:'chain',   icon:'infinite-outline' as const, title:'Galaxy Chain',       desc:'×1→×10 · une erreur = game over',    color:C.gold,   dur:'∞',  maxXP:600 },
] as const;
type GameId = typeof GAMES_META[number]['id'];

// ─── 20 PHRASES FOMO — l'user DOIT jouer ─────────────────────────────────────
const FOMO: string[] = [
  "Tu es à quelques XP du prochain niveau — joue.",
  "3 cinéphiles t'ont dépassé cette nuit.",
  "Ton streak risque de s'effacer avant demain.",
  "Le multiplicateur ×10 attend dans Galaxy Chain.",
  "5 pépites non découvertes ce soir — prends-les.",
  "Le classement se remet à zéro à minuit.",
  "47 joueurs actifs en ce moment.",
  "Une critique = 50 XP. C'est maintenant ou jamais.",
  "Ton badge 'Cinéphile' est presque là.",
  "Les meilleurs joueurs jouent le soir.",
  "Chaque film visionné = +20 XP directs.",
  "Sois le premier à noter ce film.",
  "Grimpe au top avant que les autres ne le fassent.",
  "Ton univers ne grandit pas sans toi.",
  "L'Oracle attend tes réponses ce soir.",
  "3 minutes de jeu = rang supérieur garanti.",
  "Qui sera N°1 ce soir ? Toi ou eux ?",
  "XP gratuits — juste là, maintenant.",
  "Chaque défi terminé = badge en approche.",
  "L'univers s'éteint sans toi. Joue.",
];

// Section labels pour badge progression
const SECTIONS = [
  { label:'Galaxie XP',  icon:'planet-outline'         as const, phraseIdx:0  },
  { label:'Cosmos',      icon:'infinite-outline'        as const, phraseIdx:4  },
  { label:'6 Jeux',      icon:'game-controller-outline' as const, phraseIdx:2  },
  { label:'Badges',      icon:'ribbon-outline'          as const, phraseIdx:9  },
  { label:'Classement',  icon:'podium-outline'          as const, phraseIdx:6  },
];

// ─── ACTIONS KEYS ────────────────────────────────────────────────────────────
const ACTIONS_ROUTES: Record<string, string | null> = {
  LIKE_WORK: '/(tabs)/social', WRITE_CRITIQUE: '/(tabs)/social', COMMENT: '/(tabs)/social',
  CREATE_VIDEO: '/(tabs)/create', COMPLETE_PROFILE: '/profile', CONNECT_PRO: '/(tabs)/professionals',
  SHARE_FILM: null, WATCH_FILM: null,
};

// ─── XP STORE ────────────────────────────────────────────────────────────────
function useXPStore() {
  const [xp,      setXp]       = useState(0);
  const [streak,  setStreak]   = useState(0);
  const [todayXP, setToday]    = useState(0);
  const [weekXP,  setWeek]     = useState(0);
  const [unlocked, setUnlocked]= useState<string[]>([]);
  const [freshBadge, setFresh] = useState<string | null>(null);
  const [log, setLog]          = useState<{ label:string; xp:number }[]>([]);

  const lv = useMemo(() => {
    let l: Level = LEVELS[0];
    for (const v of LEVELS) { if (xp >= v.minXP) l = v; else break; }
    return l;
  }, [xp]);
  const nextLv = useMemo(() => {
    const i = LEVELS.findIndex(l => l.level === lv.level);
    return LEVELS[i + 1] ?? null;
  }, [lv]);
  const prog = useMemo(() => {
    if (!nextLv) return 1;
    return Math.min((xp - lv.minXP) / (nextLv.minXP - lv.minXP), 1);
  }, [xp, lv, nextLv]);

  // Auto-unlock badges dès que le seuil XP est atteint
  useEffect(() => {
    const news = Object.entries(BADGE_XP)
      .filter(([id, thr]) => xp >= thr && !unlocked.includes(id))
      .map(([id]) => id);
    if (news.length) {
      setUnlocked(p => [...new Set([...p, ...news])]);
      setFresh(news[news.length - 1]);
    }
  }, [xp]);

  const addXP = useCallback((n: number, label?: string) => {
    setXp(p => p + n); setToday(p => p + n); setWeek(p => p + n);
    if (label) setLog(p => [{ label, xp: n }, ...p].slice(0, 6));
  }, []);

  return { xp, streak, todayXP, weekXP, lv, nextLv, prog,
           unlocked, freshBadge, clearFresh: () => setFresh(null), log, addXP };
}

// ─── SHIMMER ─────────────────────────────────────────────────────────────────
const Shimmer = memo(({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) => {
  const op = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue:0.34, duration:900, useNativeDriver:true }),
      Animated.timing(op, { toValue:0.15, duration:900, useNativeDriver:true }),
    ]));
    a.start(); return () => a.stop();
  }, []);
  return <Animated.View style={{ width:w as any, height:h, borderRadius:r, backgroundColor:C.card, opacity:op }}/>;
});

// ─── XP BURST ────────────────────────────────────────────────────────────────
const XPBurst = memo(({ v, n, done }: { v:boolean; n:number; done:()=>void }) => {
  const sc = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!v) return;
    sc.setValue(0); op.setValue(1); ty.setValue(0);
    Animated.parallel([
      Animated.spring(sc, { toValue:1, tension:200, friction:8, useNativeDriver:true }),
      Animated.timing(ty, { toValue:-70, duration:950, useNativeDriver:true }),
      Animated.sequence([Animated.delay(400), Animated.timing(op, { toValue:0, duration:550, useNativeDriver:true })]),
    ]).start(done);
  }, [v]);
  if (!v) return null;
  return (
    <Animated.View pointerEvents="none"
      style={[StyleSheet.absoluteFill, { alignItems:'center', justifyContent:'center', zIndex:9999 }]}>
      <Animated.View style={{ transform:[{scale:sc},{translateY:ty}], opacity:op,
        backgroundColor:C.goldFaint, borderWidth:1.5, borderColor:C.gold,
        borderRadius:28, paddingHorizontal:22, paddingVertical:11,
        flexDirection:'row', alignItems:'center', gap:8 }}>
        <Ionicons name="flash" size={17} color={C.gold}/>
        <Text style={{ color:C.gold, fontSize:24, fontWeight:'900' }}>+{n} XP</Text>
      </Animated.View>
    </Animated.View>
  );
});

// ─── BADGE TOAST ─────────────────────────────────────────────────────────────
const BadgeToast = memo(({ id, v, done }: { id:string|null; v:boolean; done:()=>void }) => {
  const badge = BADGES.find(b => b.id === id);
  const ty = useRef(new Animated.Value(-100)).current;
  useEffect(() => {
    if (!v || !badge) return;
    Animated.spring(ty, { toValue:0, tension:65, friction:10, useNativeDriver:true }).start();
    const t = setTimeout(() =>
      Animated.timing(ty, { toValue:-110, duration:280, useNativeDriver:true }).start(done), 3400);
    return () => clearTimeout(t);
  }, [v, badge]);
  if (!badge || !v) return null;
  return (
    <Animated.View style={{ position:'absolute', top:0, left:14, right:14, zIndex:9999,
      transform:[{translateY:ty}], borderRadius:16, overflow:'hidden',
      flexDirection:'row', alignItems:'center', gap:12, padding:14,
      backgroundColor:'rgba(245,200,66,0.10)', borderWidth:1, borderColor:C.goldBd }}>
      <BlurView intensity={Platform.OS==='ios'?28:14} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={{ width:44, height:44, borderRadius:13,
        backgroundColor:C.goldFaint, borderWidth:1, borderColor:C.goldBd,
        alignItems:'center', justifyContent:'center' }}>
        <Ionicons name={badge.icon} size={22} color={C.gold}/>
      </View>
      <View style={{ flex:1 }}>
        <Text style={{ color:C.gold, fontSize:9, fontWeight:'900', letterSpacing:1.2 }}>★ BADGE DÉBLOQUÉ</Text>
        <Text style={{ color:C.white, fontSize:15, fontWeight:'900' }}>{badge.label}</Text>
        <Text style={{ color:C.muted, fontSize:11 }}>{badge.desc}</Text>
      </View>
      <View style={{ alignItems:'center', gap:2 }}>
        <Text style={{ color:C.gold, fontSize:12, fontWeight:'900' }}>+{badge.xp}</Text>
        <Text style={{ color:C.gold, fontSize:9 }}>XP</Text>
      </View>
    </Animated.View>
  );
});

// ─── XP BAR ──────────────────────────────────────────────────────────────────
const XPBar = memo(({ lv, nextLv, prog, xp }: { lv:Level; nextLv:Level|null; prog:number; xp:number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue:prog, duration:1200, useNativeDriver:false, easing:Easing.out(Easing.exp) }).start();
  }, [prog]);
  return (
    <View style={{ paddingHorizontal:E, marginBottom:18 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <View style={{ width:46, height:46, borderRadius:23,
            backgroundColor:'rgba(245,200,66,0.12)', borderWidth:1.5, borderColor:C.goldBd,
            alignItems:'center', justifyContent:'center' }}>
            <Ionicons name={lv.icon} size={21} color={C.gold}/>
          </View>
          <View>
            <Text style={{ color:C.white, fontSize:14, fontWeight:'800' }}>{lv.title}</Text>
            <Text style={{ color:C.muted, fontSize:10 }}>Niveau {lv.level}</Text>
          </View>
        </View>
        <View style={{ alignItems:'flex-end' }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="flash" size={13} color={C.gold}/>
            <Text style={{ color:C.gold, fontSize:18, fontWeight:'900' }}>{xp.toLocaleString()}</Text>
          </View>
          {nextLv && <Text style={{ color:C.muted, fontSize:10 }}>→ {nextLv.minXP.toLocaleString()} XP</Text>}
        </View>
      </View>
      <View style={{ height:5, backgroundColor:C.subtle, borderRadius:3, overflow:'hidden' }}>
        <Animated.View style={{ height:'100%', borderRadius:3, backgroundColor:C.gold,
          width:anim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }}/>
      </View>
    </View>
  );
});

// ─── STREAK ──────────────────────────────────────────────────────────────────
const StreakBubble = memo(({ streak }: { streak:number }) => {
  const sc = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(sc, { toValue:1.07, duration:900, useNativeDriver:true, easing:Easing.inOut(Easing.ease) }),
      Animated.timing(sc, { toValue:1,    duration:900, useNativeDriver:true, easing:Easing.inOut(Easing.ease) }),
    ]));
    l.start(); return () => l.stop();
  }, []);
  return (
    <Animated.View style={{ transform:[{scale:sc}] }}>
      <LinearGradient
        colors={streak > 0 ? ['rgba(245,200,66,0.18)','rgba(245,200,66,0.06)'] : ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)']}
        style={{ borderRadius:16, paddingHorizontal:14, paddingVertical:10,
          alignItems:'center', borderWidth:1, borderColor:streak>0 ? C.goldBd : C.border }}>
        <Ionicons name="flame" size={22} color={streak>0 ? C.gold : C.muted}/>
        <Text style={{ color:streak>0 ? C.gold : C.muted, fontSize:18, fontWeight:'900', marginTop:2 }}>{streak}</Text>
        <Text style={{ color:C.muted, fontSize:9, fontWeight:'700' }}>JOURS</Text>
      </LinearGradient>
    </Animated.View>
  );
});

// ─── DAILY ROW ───────────────────────────────────────────────────────────────
const DailyRow = memo(({ ch, claimed, onClaim }: { ch:typeof DAILY[number]; claimed:boolean; onClaim:()=>void }) => {
  const p = ch.progress / ch.total;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue:p, duration:800, useNativeDriver:false, easing:Easing.out(Easing.cubic) }).start();
  }, [p]);
  return (
    <View style={{ height:76, marginBottom:8, borderRadius:14, overflow:'hidden', borderWidth:1,
      borderColor:p>=1 ? C.goldBd : C.border }}>
      <LinearGradient colors={p>=1 ? ['rgba(245,200,66,0.10)','rgba(13,32,64,0.95)'] : ['rgba(13,32,64,0.82)','rgba(4,8,15,0.94)']}
        style={{ flex:1, padding:13, flexDirection:'row', alignItems:'center', gap:12 }}>
        <View style={{ width:38, height:38, borderRadius:11,
          backgroundColor:p>=1 ? C.goldFaint : C.faint,
          borderWidth:1, borderColor:p>=1 ? C.goldBd : C.border,
          alignItems:'center', justifyContent:'center' }}>
          <Ionicons name={ch.icon} size={17} color={p>=1 ? C.gold : C.muted}/>
        </View>
        <View style={{ flex:1, gap:4 }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <Text style={{ color:C.white, fontSize:12, fontWeight:'800' }} numberOfLines={1}>{ch.title}</Text>
            <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
              <Ionicons name="flash" size={9} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:11, fontWeight:'700' }}>+{ch.xp}</Text>
            </View>
          </View>
          <View style={{ height:3, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden' }}>
            <Animated.View style={{ height:'100%', borderRadius:2,
              backgroundColor:p>=1 ? C.gold : C.white,
              width:anim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }}/>
          </View>
          <Text style={{ color:C.muted, fontSize:10 }} numberOfLines={1}>{ch.desc}</Text>
        </View>
        {p>=1 && !claimed &&
          <TouchableOpacity onPress={() => { hS(); onClaim(); }}
            style={{ backgroundColor:C.gold, borderRadius:10, paddingHorizontal:12, paddingVertical:7 }}>
            <Text style={{ color:C.bg, fontSize:11, fontWeight:'900' }}>CLAIM</Text>
          </TouchableOpacity>}
        {claimed &&
          <View style={{ width:28, height:28, borderRadius:14, backgroundColor:C.goldFaint,
            borderWidth:1, borderColor:C.goldBd, alignItems:'center', justifyContent:'center' }}>
            <Ionicons name="checkmark" size={14} color={C.gold}/>
          </View>}
      </LinearGradient>
    </View>
  );
});

// ─── GAME CARD ────────────────────────────────────────────────────────────────
const GameCard = memo(({ gm, onPlay }: { gm:typeof GAMES_META[number]; onPlay:()=>void }) => {
  const sc = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(sc, { toValue:0.94, duration:80, useNativeDriver:true }),
      Animated.spring(sc, { toValue:1, tension:300, friction:8, useNativeDriver:true }),
    ]).start(() => { hM(); onPlay(); });
  };
  return (
    <TouchableOpacity onPress={press} activeOpacity={1} style={{ width:(SW-E*2-12)/2, marginBottom:12 }}>
      <Animated.View style={{ transform:[{scale:sc}], height:130, borderRadius:18, overflow:'hidden',
        borderWidth:1, borderColor:C.border }}>
        <LinearGradient colors={[C.card,'rgba(4,8,15,0.96)']}
          style={{ flex:1, padding:16, alignItems:'center', gap:8 }}>
          <View style={{ width:50, height:50, borderRadius:25,
            backgroundColor:'rgba(245,200,66,0.10)', borderWidth:1.5, borderColor:C.goldBd,
            alignItems:'center', justifyContent:'center' }}>
            <Ionicons name={gm.icon} size={22} color={C.gold}/>
          </View>
          <Text style={{ color:C.white, fontSize:12, fontWeight:'800', textAlign:'center' }} numberOfLines={1}>{gm.title}</Text>
          <View style={{ flexDirection:'row', gap:6 }}>
            <View style={{ backgroundColor:C.faint, borderRadius:7, paddingHorizontal:7, paddingVertical:3 }}>
              <Text style={{ color:C.muted, fontSize:9 }}>{gm.dur}</Text>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center', gap:2,
              backgroundColor:C.goldFaint, borderRadius:7, paddingHorizontal:7, paddingVertical:3 }}>
              <Ionicons name="flash" size={8} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:9, fontWeight:'700' }}>≤{gm.maxXP}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── BADGE CARD (proportions fixes — pas de layout shift) ────────────────────
const BadgeCard = memo(({ badge, unlocked }: { badge:typeof BADGES[number]; unlocked:boolean }) => {
  const thr = BADGE_XP[badge.id] ?? 999;
  return (
    <View style={{ width:(SW-E*2-12)/2, height:82, marginBottom:10,
      borderRadius:14, overflow:'hidden', borderWidth:1,
      borderColor:unlocked ? C.goldBd : C.border }}>
      <LinearGradient
        colors={unlocked ? ['rgba(245,200,66,0.12)','rgba(13,32,64,0.96)'] : [C.card,'rgba(4,8,15,0.95)']}
        style={{ flex:1, padding:13, flexDirection:'row', alignItems:'center', gap:10 }}>
        <View style={{ width:40, height:40, borderRadius:20,
          backgroundColor:unlocked ? C.goldFaint : C.faint,
          borderWidth:1, borderColor:unlocked ? C.goldBd : C.border,
          alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Ionicons name={badge.icon} size={18} color={unlocked ? C.gold : C.muted}/>
        </View>
        <View style={{ flex:1 }}>
          <Text style={{ color:unlocked ? C.white : C.muted, fontSize:12, fontWeight:'800' }} numberOfLines={1}>{badge.label}</Text>
          <Text style={{ color:C.muted, fontSize:10, marginTop:1 }} numberOfLines={1}>{badge.desc}</Text>
          {unlocked
            ? <View style={{ flexDirection:'row', alignItems:'center', gap:3, marginTop:3 }}>
                <Ionicons name="flash" size={9} color={C.gold}/>
                <Text style={{ color:C.gold, fontSize:10, fontWeight:'700' }}>+{badge.xp} XP</Text>
              </View>
            : <Text style={{ color:C.muted, fontSize:9, marginTop:3 }}>Seuil {thr} XP</Text>}
        </View>
        {unlocked
          ? <View style={{ width:16, height:16, borderRadius:8, backgroundColor:C.goldFaint,
              borderWidth:1, borderColor:C.goldBd, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Text style={{ color:C.gold, fontSize:9, fontWeight:'900' }}>✓</Text>
            </View>
          : <Ionicons name="lock-closed-outline" size={12} color={C.muted}/>}
      </LinearGradient>
    </View>
  );
});

// Écran done partagé entre tous les jeux
const GameDone = memo(({ col, icon, title, score, sub, onClose }: {
  col:string; icon:string; title:string; score:number; sub:string; onClose:()=>void;
}) => {
  const sc = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(sc, { toValue:1, tension:80, friction:8, useNativeDriver:true }),
      Animated.timing(op, { toValue:1, duration:500, useNativeDriver:true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:32, gap:14, opacity:op }}>
      <Animated.View style={{ transform:[{scale:sc}], width:90, height:90, borderRadius:45,
        backgroundColor:'rgba(245,200,66,0.12)', borderWidth:2, borderColor:C.goldBd,
        alignItems:'center', justifyContent:'center' }}>
        <Ionicons name={icon as any} size={44} color={C.gold}/>
      </Animated.View>
      <Text style={{ color:C.white, fontSize:28, fontWeight:'900' }}>{title}</Text>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
        <Ionicons name="flash" size={22} color={C.gold}/>
        <Text style={{ color:C.gold, fontSize:52, fontWeight:'900' }}>{score}</Text>
      </View>
      <Text style={{ color:C.muted, fontSize:13, textAlign:'center' }}>{sub}</Text>
      <TouchableOpacity onPress={onClose}
        style={{ marginTop:8, backgroundColor:C.gold, borderRadius:16,
          paddingHorizontal:36, paddingVertical:15, flexDirection:'row', alignItems:'center', gap:8 }}>
        <Text style={{ color:C.bg, fontSize:16, fontWeight:'900' }}>Retour à la galaxie</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// ★ INTERACTION BADGE — glissant, aura dorée, hauteur fixe
//   Remplace la liste "Interagissez avec Universe"
//   Même divine glow que le badge Progression Cosmique
// ══════════════════════════════════════════════════════════════════════════════
const InteractionBadge = memo(({ onNavigate }: { onNavigate:(route:string|null)=>void }) => {
  const [idx, setIdx]   = useState(0);
  const opacity         = useRef(new Animated.Value(1)).current;
  const glowOp          = useRef(new Animated.Value(0.28)).current;

  // Même divine breathing que GamificationBadge
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue:0.92, duration:2600, easing:Easing.inOut(Easing.ease), useNativeDriver:true }),
      Animated.timing(glowOp, { toValue:0.28, duration:2600, easing:Easing.inOut(Easing.ease), useNativeDriver:true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);

  // Glisse automatiquement entre les interactions
  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(opacity, { toValue:0, duration:220, useNativeDriver:true }).start(() => {
        setIdx(i => (i + 1) % INTERACTIONS.length);
        Animated.timing(opacity, { toValue:1, duration:280, useNativeDriver:true }).start();
      });
    }, 4200);
    return () => clearInterval(t);
  }, []);

  const item = INTERACTIONS[idx];

  const glowStyle: any = {
    position:'absolute', top:-3, bottom:-3, left:-3, right:-3, borderRadius:21,
    ...(Platform.OS === 'web'
      ? { boxShadow:`0 0 22px 7px rgba(245,200,66,0.38), 0 0 8px 2px rgba(245,200,66,0.16)` }
      : { shadowColor:C.gold, shadowOffset:{width:0,height:0}, shadowOpacity:0.72, shadowRadius:14, elevation:7 }),
  };

  return (
    <TouchableOpacity onPress={() => { hL(); onNavigate(item.route as string | null); }} activeOpacity={0.9} style={{ marginHorizontal:E }}>
      <Animated.View style={[glowStyle, { opacity:glowOp }]} pointerEvents="none"/>
      <LinearGradient
        colors={['rgba(245,200,66,0.11)','rgba(13,32,64,0.88)','rgba(4,8,15,0.97)']}
        start={{x:0,y:0}} end={{x:1,y:1}}
        style={{ height:88, borderRadius:18, paddingHorizontal:17,
          borderWidth:1, borderColor:C.goldBd,
          flexDirection:'row', alignItems:'center', gap:14 }}>
        <Animated.View style={{ opacity, flexDirection:'row', alignItems:'center', flex:1, gap:14 }}>
          {/* Icone fixe */}
          <View style={{ width:46, height:46, borderRadius:14, flexShrink:0,
            backgroundColor:C.goldFaint, borderWidth:1.5, borderColor:C.goldBd,
            alignItems:'center', justifyContent:'center' }}>
            <Ionicons name={item.icon} size={21} color={C.gold}/>
          </View>
          {/* Texte */}
          <View style={{ flex:1, gap:3 }}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <Text style={{ color:C.white, fontSize:13, fontWeight:'800' }} numberOfLines={1}>{item.label}</Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                <Ionicons name="flash" size={10} color={C.gold}/>
                <Text style={{ color:C.gold, fontSize:10, fontWeight:'700' }}>+{item.xp} XP</Text>
                </View>
            </View>
            <Text style={{ color:C.muted, fontSize:11, fontStyle:'italic' }} numberOfLines={1}>{item.phrase}</Text>
          
          </View>
         
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// ★ 6 JEUX GALAXY — XP uniquement à la fin (onXP callback du done screen)
// ══════════════════════════════════════════════════════════════════════════════

// Questions Oracle — apprennent l'app + culture cinéphile
const Q_ORACLE = [
  { q:"Où trouver les films peu connus sur Universe ?",      opts:["Populaires","Pépites","Originaux","Récents"],              ans:1, xp:25, tag:"App"    },
  { q:"Que représente l'icône ✦ sur une fiche film ?",       opts:["Noté","Original Universe","Pépite","Populaire"],           ans:1, xp:25, tag:"App"    },
  { q:"Quelle action rapporte le plus d'XP ?",               opts:["Liker","Regarder","Créer une vidéo","Commenter"],          ans:2, xp:30, tag:"XP"     },
  { q:"Comment débloquer le badge 'Chasseur Pépites' ?",     opts:["50 likes","Découvrir 5 pépites","5 critiques","3 partages"],ans:1, xp:30, tag:"Badge"  },
  { q:"Qu'est-ce qu'un 'court métrage' ?",                   opts:["Film <10min","Film <60min","Film animé","Docu"],            ans:1, xp:20, tag:"Cinéma" },
  { q:"Comment écrire une critique sur Universe ?",           opts:["Accueil","Profil","Social","Paramètres"],                  ans:2, xp:25, tag:"App"    },
  { q:"Quel badge nécessite 500 XP ?",                       opts:["Explorateur","Cinéphile","Insider","Critique"],            ans:1, xp:35, tag:"Badge"  },
  { q:"Quelle section regroupe les créations exclusives ?",  opts:["Récents","Pépites","Originaux","Populaires"],              ans:2, xp:25, tag:"App"    },
  { q:"Combien de jours de streak pour le badge Flamme ?",   opts:["1 jour","3 jours","7 jours","10 jours"],                  ans:1, xp:30, tag:"Badge"  },
  { q:"Quelle durée définit un moyen métrage ?",             opts:["10-30min","30-60min","60-100min","100min+"],               ans:2, xp:25, tag:"Cinéma" },
  { q:"Combien de jeux sont disponibles dans Universe ?",    opts:["3","4","5","6"],                                           ans:3, xp:30, tag:"Jeux"   },
  { q:"Quel rang nécessite le badge 'Cosmos Keeper' ?",      opts:["Niv.5","Niv.6","Niv.7","Niv.8"],                          ans:3, xp:35, tag:"Badge"  },
];

// ★ GAME 1 — Oracle Cosmique
const OracleGame = memo(({ onXP, onClose }: { onXP:(n:number)=>void; onClose:()=>void }) => {
  const [qi, setQi]       = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [sel, setSel]     = useState<number|null>(null);
  const [phase, setPhase] = useState<'q'|'r'|'done'>('q');
  const [timer, setTimer] = useState(30);
  const timerRef          = useRef<any>(null);
  const fade              = useRef(new Animated.Value(0)).current;
  const stars             = useRef(Array.from({length:10}, (_,i) => ({
    x:  new Animated.Value(Math.random()*SW),
    y:  new Animated.Value(Math.random()*180),
    op: new Animated.Value(Math.random()),
  }))).current;

  useEffect(() => {
    stars.forEach((s, i) => {
      Animated.loop(Animated.sequence([
        Animated.timing(s.op, { toValue:0.6+Math.random()*0.4, duration:500+i*80, useNativeDriver:true }),
        Animated.timing(s.op, { toValue:0.1, duration:500+i*80, useNativeDriver:true }),
      ])).start();
    });
  }, []);

  useEffect(() => {
    if (phase !== 'q') return;
    setTimer(30);
    fade.setValue(0);
    Animated.timing(fade, { toValue:1, duration:350, useNativeDriver:true }).start();
    timerRef.current = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); answer(-1); return 0; } return t-1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [qi, phase]);

  const q = Q_ORACLE[qi % Q_ORACLE.length];

  const answer = (idx: number) => {
    clearInterval(timerRef.current); setSel(idx); setPhase('r');
    if (idx === q.ans) { const pts = q.xp + Math.ceil(timer*1.5) + combo*20; setScore(s => s+pts); setCombo(c => c+1); }
    else setCombo(0);
  };
  const next = () => {
    if (qi >= 9) { onXP(score); setPhase('done'); return; }
    setQi(i => i+1); setSel(null); setPhase('q');
  };

  if (phase==='done') return <GameDone col={C.purple} icon="planet-outline" title="Oracle terminé !" score={score} sub={`Combo ×${combo} · XP ajoutés`} onClose={onClose}/>;

  const tagC: Record<string,string> = { App:C.blue, XP:C.gold, Badge:C.gold, Cinéma:C.cyan, Jeux:C.purple };
  const tc = tagC[q.tag] ?? C.blue;

  return (
    <Animated.View style={{ flex:1, opacity:fade }}>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {stars.map((s,i) => (
          <Animated.View key={i} style={{ position:'absolute', left:s.x, top:s.y,
            width:2, height:2, borderRadius:1, backgroundColor:C.gold, opacity:s.op }}/>
        ))}
      </View>
      <View style={{ flex:1, padding:20 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <View style={{ flexDirection:'row', gap:5 }}>
            {Array.from({length:10}).map((_,i) => <View key={i} style={{ width:20, height:3, borderRadius:2, backgroundColor:i<qi?C.gold:i===qi?C.gold:C.subtle, opacity:i<=qi?1:0.3 }}/>)}
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            {combo > 1 && <View style={{ backgroundColor:C.goldFaint, borderRadius:8, paddingHorizontal:8, paddingVertical:3, borderWidth:1, borderColor:C.goldBd }}>
              <Text style={{ color:C.gold, fontSize:11, fontWeight:'900' }}>×{combo}</Text>
            </View>}
            <View style={{ width:36, height:36, borderRadius:18, backgroundColor:C.faint, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:timer<=10?'rgba(255,92,114,0.4)':C.border }}>
              <Text style={{ color:timer<=10?C.red:C.white, fontSize:14, fontWeight:'900' }}>{timer}</Text>
            </View>
          </View>
        </View>
        <View style={{ height:3, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden', marginBottom:18 }}>
          <View style={{ height:'100%', borderRadius:2, width:`${(timer/30)*100}%` as any, backgroundColor:timer<=10?C.red:C.gold }}/>
        </View>
        <View style={{ backgroundColor:`${tc}12`, borderRadius:16, padding:18, borderWidth:1, borderColor:`${tc}28`, marginBottom:18, minHeight:88, justifyContent:'center', gap:8 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <View style={{ backgroundColor:`${tc}20`, borderRadius:7, paddingHorizontal:8, paddingVertical:3 }}>
              <Text style={{ color:tc, fontSize:9, fontWeight:'900', letterSpacing:0.8 }}>{q.tag.toUpperCase()}</Text>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
              <Ionicons name="flash" size={9} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:9, fontWeight:'700' }}>+{q.xp}+ XP</Text>
            </View>
          </View>
          <Text style={{ color:C.white, fontSize:16, fontWeight:'700', lineHeight:24 }}>{q.q}</Text>
        </View>
        <View style={{ gap:9 }}>
          {q.opts.map((opt, i) => {
              let bg=C.faint, border:string=C.border, tc2:string=C.text;
              if (phase==='r' && i===q.ans)            { bg='rgba(46,204,138,0.12)'; border=C.green as string; tc2=C.green; }
              if (phase==='r' && i===sel && i!==q.ans) { bg='rgba(255,92,114,0.10)'; border=C.red as string;  tc2=C.red;   }
              return (
                <TouchableOpacity key={i} onPress={() => answer(i)} disabled={phase==='r'}
                  style={{ backgroundColor:bg, borderRadius:13, padding:14, borderWidth:1, borderColor:border,
                    flexDirection:'row', alignItems:'center', gap:10 }}>
                  <View style={{ width:24, height:24, borderRadius:12, backgroundColor:`${border}22`, borderWidth:1,
                    borderColor:border, alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ color:tc2, fontSize:10, fontWeight:'900' }}>{['A','B','C','D'][i]}</Text>
                  </View>
                  <Text style={{ color:tc2, fontSize:13, fontWeight:'600', flex:1 }}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
        </View>
        {phase==='r' && (
          <TouchableOpacity onPress={next}
            style={{ marginTop:14, backgroundColor:C.gold, borderRadius:14, padding:14, alignItems:'center' }}>
            <Text style={{ color:C.bg, fontSize:14, fontWeight:'900' }}>{qi<9?'Suivant →':'Résultats'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
});

// ★ GAME 2 — Warp Swipe
const WarpSwipe = memo(({ works, onXP, onClose }: { works:Work[]; onXP:(n:number)=>void; onClose:()=>void }) => {
  const pool    = useMemo(() => works.slice(0,20), [works]);
  const [idx, setIdx]     = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [done, setDone]   = useState(false);
  const tx = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0.82)).current;
  const current = pool[idx];

  useEffect(() => { sc.setValue(0.78); Animated.spring(sc, { toValue:1, tension:120, friction:9, useNativeDriver:true }).start(); }, [idx]);
  const rot   = tx.interpolate({ inputRange:[-160,0,160], outputRange:['-18deg','0deg','18deg'] });
  const liOp  = tx.interpolate({ inputRange:[0,60],   outputRange:[0,1], extrapolate:'clamp' });
  const paOp  = tx.interpolate({ inputRange:[-60,0],  outputRange:[1,0], extrapolate:'clamp' });
  const pr = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderMove:(_,g) => tx.setValue(g.dx),
    onPanResponderRelease:(_,g) => {
      if (Math.abs(g.dx) > 110) {
        const liked = g.dx > 0;
        Animated.timing(tx, { toValue:liked?480:-480, duration:200, useNativeDriver:true }).start(() => {
          let s = score;
          if (liked) { const pts=20*(combo+1); s+=pts; setScore(s); setCombo(c=>c+1); hL(); } else setCombo(0);
          if (idx >= Math.min(pool.length-1,14)) { onXP(s); setDone(true); }
          else { tx.setValue(0); setIdx(i=>i+1); }
        });
      } else Animated.spring(tx, { toValue:0, useNativeDriver:true }).start();
    },
  }), [idx,combo,pool.length,score]);

  if (!current||done) return <GameDone col={C.cyan} icon="rocket-outline" title="Warp terminé !" score={score} sub={`Combo ×${combo} max`} onClose={onClose}/>;
  return (
    <View style={{ flex:1, padding:20 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:14 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <Ionicons name="flame" size={14} color={C.gold}/>
          <Text style={{ color:C.gold, fontSize:15, fontWeight:'900' }}>×{combo}</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <Ionicons name="flash" size={14} color={C.gold}/>
          <Text style={{ color:C.gold, fontSize:16, fontWeight:'900' }}>{score}</Text>
        </View>
        <Text style={{ color:C.muted, fontSize:12, alignSelf:'center' }}>{idx+1}/{Math.min(pool.length,15)}</Text>
      </View>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:14, paddingHorizontal:8 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,92,114,0.12)', borderRadius:10, paddingHorizontal:12, paddingVertical:6 }}>
          <Ionicons name="close-circle-outline" size={14} color={C.red}/>
          <Text style={{ color:C.red, fontSize:11, fontWeight:'700' }}>PASSE</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(46,204,138,0.12)', borderRadius:10, paddingHorizontal:12, paddingVertical:6 }}>
          <Text style={{ color:C.green, fontSize:11, fontWeight:'700' }}>LIKE +{20*(combo+1)}</Text>
          <Ionicons name="heart-circle-outline" size={14} color={C.green}/>
        </View>
      </View>
      <Animated.View {...pr.panHandlers} style={{ transform:[{translateX:tx},{rotate:rot},{scale:sc}] }}>
        <View style={{ borderRadius:22, overflow:'hidden', height:264 }}>
          <Image source={{uri:resolveImg(current.id,current.image)}} style={StyleSheet.absoluteFillObject as any} resizeMode="cover"/>
          <LinearGradient colors={['rgba(4,8,15,0.18)','transparent','rgba(4,8,15,0.92)']} style={StyleSheet.absoluteFillObject}/>
          <Animated.View style={{ position:'absolute', top:18, left:18, backgroundColor:'rgba(46,204,138,0.14)', borderWidth:2, borderColor:C.green, borderRadius:12, paddingHorizontal:14, paddingVertical:7, opacity:liOp, flexDirection:'row', alignItems:'center', gap:6 }}>
            <Ionicons name="heart" size={15} color={C.green}/>
            <Text style={{ color:C.green, fontSize:16, fontWeight:'900' }}>LIKE</Text>
          </Animated.View>
          <Animated.View style={{ position:'absolute', top:18, right:18, backgroundColor:'rgba(255,92,114,0.14)', borderWidth:2, borderColor:C.red, borderRadius:12, paddingHorizontal:14, paddingVertical:7, opacity:paOp, flexDirection:'row', alignItems:'center', gap:6 }}>
            <Ionicons name="close" size={15} color={C.red}/>
            <Text style={{ color:C.red, fontSize:16, fontWeight:'900' }}>PASS</Text>
          </Animated.View>
          <View style={{ position:'absolute', bottom:16, left:16, right:16, gap:4 }}>
            <Text style={{ color:C.white, fontSize:17, fontWeight:'800' }}>{current.title}</Text>
            <Text style={{ color:C.muted, fontSize:11 }}>{current.genre}{current.year?` · ${current.year}`:''}{current.duration?` · ${fmtDur(current.duration)}`:''}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

// ★ GAME 3 — Carte Stellaire (memory)
const StarMap = memo(({ works, onXP, onClose }: { works:Work[]; onXP:(n:number)=>void; onClose:()=>void }) => {
  const PAIRS = 6;
  const deck = useMemo(() => {
    const pool = works.filter(w=>w.title).slice(0,PAIRS);
    return [...pool,...pool].map((w,i) => ({ id:i, workId:w.id, title:w.title, flipped:false, matched:false })).sort(()=>Math.random()-0.5);
  }, [works]);
  const [cards, setCards] = useState(deck);
  const [open, setOpen]   = useState<number[]>([]);
  const [pairs, setPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [time, setTime]   = useState(90);
  const [done, setDone]   = useState(false);
  const timerRef = useRef<any>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setTime(t => { if(t<=1){clearInterval(timerRef.current);setDone(true);return 0;}return t-1;}),1000);
    return () => clearInterval(timerRef.current);
  }, []);
  useEffect(() => {
    if (pairs>=PAIRS) { clearInterval(timerRef.current); onXP(pairs*60+time*5); setDone(true); }
  }, [pairs]);
  const flip = (idx: number) => {
    const card = cards[idx];
    if (card.flipped||card.matched||open.length>=2) return;
    hL();
    const nd = cards.map((c,i)=>i===idx?{...c,flipped:true}:c);
    setCards(nd);
    const no = [...open,idx];
    setOpen(no);
    if (no.length===2) {
      setMoves(m=>m+1);
      const[a,b]=no;
      if (nd[a].workId===nd[b].workId) { hS(); setCards(c=>c.map((x,i)=>i===a||i===b?{...x,matched:true}:x)); setPairs(p=>p+1); setOpen([]); }
      else setTimeout(()=>{setCards(c=>c.map((x,i)=>i===a||i===b?{...x,flipped:false}:x));setOpen([]);},900);
    }
  };
  if (done) return <GameDone col={C.blue} icon="star-outline" title={pairs>=PAIRS?'Galaxie !':'Temps écoulé'} score={pairs*60+time*5} sub={`${pairs}/${PAIRS} paires · ${moves} essais`} onClose={onClose}/>;
  const cW=(SW-E*2-48)/4;
  return (
    <View style={{ flex:1, padding:16 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <Ionicons name="time-outline" size={13} color={time<=20?C.red:C.gold}/>
          <Text style={{ color:time<=20?C.red:C.gold, fontSize:14, fontWeight:'900' }}>{time}s</Text>
        </View>
        <Text style={{ color:C.muted, fontSize:12 }}>{pairs}/{PAIRS} paires</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
          <Ionicons name="flash" size={12} color={C.gold}/>
          <Text style={{ color:C.gold, fontSize:13, fontWeight:'800' }}>{pairs*60}</Text>
        </View>
      </View>
      <View style={{ height:3, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden', marginBottom:14 }}>
        <View style={{ height:'100%', borderRadius:2, width:`${(time/90)*100}%` as any, backgroundColor:C.white }}/>
      </View>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
        {cards.map((card,i) => (
          <TouchableOpacity key={card.id} onPress={()=>flip(i)} activeOpacity={0.88} style={{ width:cW, aspectRatio:0.72 }}>
            <LinearGradient
              colors={card.matched?['rgba(245,200,66,0.16)','rgba(13,32,64,0.9)']:card.flipped?['rgba(255,255,255,0.12)','rgba(13,32,64,0.9)']:['rgba(13,32,64,0.85)','rgba(4,8,15,0.95)']}
              style={{ flex:1, borderRadius:10, borderWidth:1,
                borderColor:card.matched?C.goldBd:card.flipped?C.borderHi:C.border,
                alignItems:'center', justifyContent:'center', padding:5 }}>
              {(card.flipped||card.matched)
                ? <Text style={{ color:card.matched?C.gold:C.white, fontSize:9, fontWeight:'700', textAlign:'center', lineHeight:13 }} numberOfLines={3}>{card.title}</Text>
                : <Text style={{ color:C.muted, fontSize:18 }}>★</Text>}
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

// ★ GAME 4 — Vision Directeur
const DirectorVision = memo(({ works, onXP, onClose }: { works:Work[]; onXP:(n:number)=>void; onClose:()=>void }) => {
  const byDir = useMemo(()=>works.filter(w=>w.director).reduce<Record<string,Work[]>>((acc,w)=>{acc[w.director!]??=[];acc[w.director!].push(w);return acc;},{}), [works]);
  const dirs  = useMemo(()=>Object.keys(byDir).filter(d=>byDir[d].length>=2), [byDir]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [sel, setSel]     = useState<string|null>(null);
  const [phase, setPhase] = useState<'q'|'r'|'done'>('q');
  const [reveal, setReveal]= useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const dir  = useMemo(()=>dirs[round%Math.max(1,dirs.length)]??null,[round,dirs]);
  const films= useMemo(()=>dir?(byDir[dir]??[]).slice(0,3):[], [dir,byDir]);
  const choices=useMemo(()=>{if(!dir)return[];return[...dirs.filter(d=>d!==dir).sort(()=>Math.random()-0.5).slice(0,3),dir].sort(()=>Math.random()-0.5);},[dir,dirs]);
  useEffect(()=>{ fade.setValue(0); Animated.timing(fade,{toValue:1,duration:450,useNativeDriver:true}).start(); setReveal(0); },[round]);
  const answer=(d:string)=>{ if(phase!=='q')return; setSel(d); setPhase('r'); if(d===dir)setScore(s=>s+([120,80,40][reveal]??20)); };
  const next=()=>{ if(round>=4){onXP(score);setPhase('done');return;} setRound(r=>r+1);setSel(null);setPhase('q'); };
  if(!dirs.length) return <GameDone col={C.green} icon="sparkles-outline" title="Pas assez de données" score={0} sub="Ajoutez des réalisateurs" onClose={onClose}/>;
  if(phase==='done') return <GameDone col={C.green} icon="sparkles-outline" title="Vision complète !" score={score} sub="Réalisateurs identifiés" onClose={onClose}/>;
  return(
    <Animated.View style={{ flex:1, opacity:fade, padding:20 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:14 }}>
        <View style={{ flexDirection:'row', gap:5 }}>{[0,1,2,3,4].map(i=><View key={i} style={{ width:26,height:3,borderRadius:2,backgroundColor:i<=round?C.gold:C.subtle }}/>)}</View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}><Ionicons name="flash" size={13} color={C.gold}/><Text style={{ color:C.gold,fontSize:14,fontWeight:'900' }}>{score}</Text></View>
      </View>
      <Text style={{ color:C.muted,fontSize:11,fontWeight:'700',letterSpacing:0.8,marginBottom:10 }}>CES FILMS VIENNENT DU MÊME RÉALISATEUR</Text>
      {films.slice(0,reveal+1).map((f,i)=>(
        <View key={f.id} style={{ height:56,marginBottom:7,borderRadius:12,overflow:'hidden',borderWidth:1,borderColor:C.border }}>
          <LinearGradient colors={[C.card,'rgba(4,8,15,0.95)']} style={{ flex:1,padding:12,flexDirection:'row',alignItems:'center',gap:10 }}>
            <View style={{ width:28,height:28,borderRadius:8,backgroundColor:C.goldFaint,alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Text style={{ color:C.gold,fontSize:12,fontWeight:'900' }}>{i+1}</Text>
            </View>
            <View style={{ flex:1 }}><Text style={{ color:C.white,fontSize:13,fontWeight:'700' }} numberOfLines={1}>{f.title}</Text><Text style={{ color:C.muted,fontSize:10 }} numberOfLines={1}>{f.genre}{f.year?` · ${f.year}`:''}</Text></View>
          </LinearGradient>
        </View>
      ))}
      {phase==='q'&&reveal<2&&<TouchableOpacity onPress={()=>setReveal(r=>r+1)} style={{ flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,marginVertical:10,padding:9,borderRadius:10,borderWidth:1,borderColor:C.border }}><Text style={{ color:C.muted,fontSize:12 }}>Film suivant (−{40*(reveal+1)} pts)</Text></TouchableOpacity>}
      <Text style={{ color:C.muted,fontSize:11,fontWeight:'700',letterSpacing:0.8,marginTop:10,marginBottom:10 }}>QUI A RÉALISÉ CES FILMS ?</Text>
      <View style={{ gap:9 }}>
        {choices.map(d=>{
          let bg=C.faint,border=C.border,tc:string=C.text;
          if(phase==='r'&&d===dir)            {bg='rgba(46,204,138,0.12)';border=C.green;tc=C.green;}
          if(phase==='r'&&d===sel&&d!==dir)   {bg='rgba(255,92,114,0.10)';border=C.red;tc=C.red;}
          return(<TouchableOpacity key={d} disabled={phase==='r'} onPress={()=>answer(d)} style={{ backgroundColor:bg,borderRadius:12,padding:13,borderWidth:1,borderColor:border }}><Text style={{ color:tc,fontSize:13,fontWeight:'600',textAlign:'center' }}>{d}</Text></TouchableOpacity>);
        })}
      </View>
      {phase==='r'&&<TouchableOpacity onPress={next} style={{ marginTop:14,backgroundColor:C.gold,borderRadius:14,padding:13,alignItems:'center' }}><Text style={{ color:C.bg,fontSize:14,fontWeight:'900' }}>{round<4?'Suivant →':'Score final'}</Text></TouchableOpacity>}
    </Animated.View>
  );
});

// ★ GAME 5 — Nova Hunter
const NovaHunter = memo(({ works, onXP, onClose }: { works:Work[]; onXP:(n:number)=>void; onClose:()=>void }) => {
  const targets = useMemo(()=>[
    { label:'Courts métrages',   filter:(w:Work)=>(w.duration??0)>0&&(w.duration??0)<60 },
    { label:'Films originaux',   filter:(w:Work)=>!!w.is_original },
    { label:'Films dramatiques', filter:(w:Work)=>(w.genre?.toLowerCase().includes('dram'))??false },
    { label:'Documentaires',     filter:(w:Work)=>(w.genre?.toLowerCase().includes('doc'))??false },
  ],[]);
  const[round,setRound]=useState(0);const[score,setScore]=useState(0);const[sel,setSel]=useState<number[]>([]);
  const[time,setTime]=useState(25);const[phase,setPhase]=useState<'play'|'result'|'done'>('play');
  const novaAnim=useRef(new Animated.Value(0)).current;const timerRef=useRef<any>(null);
  const tgt=targets[round%targets.length];
  const grid=useMemo(()=>works.sort(()=>Math.random()-0.5).slice(0,12),[works,round]);
  const right=useMemo(()=>grid.filter(tgt.filter).map(w=>w.id),[grid,tgt]);
  const evaluate=useCallback(()=>{
    clearInterval(timerRef.current);setPhase('result');
    const hits=sel.filter(id=>right.includes(id)).length,miss=sel.filter(id=>!right.includes(id)).length;
    setScore(s=>s+Math.max(0,hits*35-miss*15));
  },[sel,right]);
  useEffect(()=>{
    if(phase!=='play')return;
    novaAnim.setValue(0);
    Animated.timing(novaAnim,{toValue:1,duration:25000,useNativeDriver:false}).start();
    setTime(25);timerRef.current=setInterval(()=>setTime(t=>{if(t<=1){clearInterval(timerRef.current);evaluate();return 0;}return t-1;}),1000);
    return()=>clearInterval(timerRef.current);
  },[round,phase]);
  const toggle=(id:number)=>{if(phase!=='play')return;hL();setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);};
  const next=()=>{if(round>=3){onXP(score);setPhase('done');return;}setRound(r=>r+1);setSel([]);setPhase('play');};
  if(phase==='done') return <GameDone col={C.orange} icon="flash" title="Nova terminée !" score={score} sub="Films capturés avant l'explosion" onClose={onClose}/>;
  return (
    <View style={{ flex:1, padding:16 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <View style={{ flexDirection:'row', gap:4 }}>
          {[0,1,2,3].map(i => (
            <View key={i} style={{ width:20, height:3, borderRadius:2, backgroundColor:i<=round ? C.gold : C.subtle }}/>
          ))}
        </View>
        <View style={{ width:40, height:40, borderRadius:20, backgroundColor:`${C.red}18`, borderWidth:1.5, borderColor:`${C.red}44`, alignItems:'center', justifyContent:'center' }}>
          <Text style={{ color:time<=8 ? C.red : C.white, fontSize:14, fontWeight:'900' }}>{time}</Text>
        </View>
      </View>
      <View style={{ height:3, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden', marginBottom:12 }}>
        <Animated.View style={{ height:'100%', borderRadius:2, backgroundColor:C.white, width:novaAnim.interpolate({inputRange:[0,1], outputRange:['100%','0%']}) }}/>
      </View>
      <LinearGradient colors={['rgba(255,140,66,0.14)', 'rgba(4,8,15,0.95)']} style={{ borderRadius:14, padding:12, borderWidth:1, borderColor:`${C.orange}30`, marginBottom:12, alignItems:'center' }}>
        <Text style={{ color:C.muted, fontSize:9, fontWeight:'800', letterSpacing:1 }}>CAPTUREZ TOUS LES</Text>
        <Text style={{ color:C.white, fontSize:16, fontWeight:'900', marginTop:2 }}>{tgt.label}</Text>
        <Text style={{ color:C.muted, fontSize:10, marginTop:1 }}>{right.length} films sur 12</Text>
      </LinearGradient>
      {phase === 'play' && (
        <>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:7, justifyContent:'center', marginBottom:10 }}>
            {grid.map(w => {
              const s = sel.includes(w.id);
              return (
                <TouchableOpacity key={w.id} onPress={() => toggle(w.id)} activeOpacity={0.85} style={{ width:(SW-E*2-28)/3 }}>
                  <LinearGradient
                    colors={s ? ['rgba(245,200,66,0.14)', 'rgba(13,32,64,0.9)'] : ['rgba(13,32,64,0.7)', 'rgba(4,8,15,0.9)']}
                    style={{ borderRadius:11, padding:9, borderWidth:1.5, borderColor:s ? C.goldBd : C.border, alignItems:'center', gap:3, minHeight:60 }}>
                    {s && <Text style={{ color:C.gold, fontSize:12 }}>★</Text>}
                    <Text style={{ color:s ? C.white : C.muted, fontSize:9.5, fontWeight:'700', textAlign:'center' }} numberOfLines={2}>{w.title}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={evaluate} style={{ backgroundColor:C.white, borderRadius:14, padding:13, alignItems:'center' }}>
            <Text style={{ color:C.bg, fontSize:13, fontWeight:'900' }}>Lancer la Nova ! ({sel.length} sélectionnés)</Text>
          </TouchableOpacity>
        </>
      )}
      {phase === 'result' && (
        <>
          <ScrollView style={{ maxHeight:260 }}>
            {grid.map(w => {
              const iS = sel.includes(w.id);
              const iR = right.includes(w.id);
              let col = C.border, bg = 'transparent';
              if (iR && iS) { col = C.gold; bg = C.goldFaint; }
              else if (iR && !iS) { col = C.white; bg = 'rgba(255,255,255,0.06)'; }
              else if (!iR && iS) { col = C.red; bg = 'rgba(255,92,114,0.08)'; }
              return (
                <View key={w.id} style={{ flexDirection:'row', alignItems:'center', gap:8, padding:9, borderRadius:10, borderWidth:1, borderColor:col, backgroundColor:bg, marginBottom:5 }}>
                  <Ionicons name={iR && iS ? 'star' : iR ? 'alert-circle' : 'close-circle'} size={13} color={col}/>
                  <Text style={{ color:C.white, fontSize:12, flex:1 }} numberOfLines={1}>{w.title}</Text>
                  {iR && iS && <Text style={{ color:C.gold, fontSize:10, fontWeight:'700' }}>+35</Text>}
                </View>
              );
            })}
          </ScrollView>
          <TouchableOpacity onPress={next} style={{ marginTop:8, backgroundColor:C.blue, borderRadius:14, padding:12, alignItems:'center' }}>
            <Text style={{ color:C.white, fontSize:13, fontWeight:'900' }}>{round < 3 ? 'Round suivant →' : 'Score final'}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
});

// ★ GAME 6 — Galaxy Chain (chaîne infinie · ×1→×2→×5→×10)
const GalaxyChain = memo(({ onXP, onClose }: { onXP:(n:number)=>void; onClose:()=>void }) => {
  const ALL_Q = useMemo(()=>[...Q_ORACLE,
    {q:"Quel multiplicateur max dans Galaxy Chain ?",       opts:["×2","×5","×8","×10"],       ans:3, xp:40, tag:"Jeux"},
    {q:"Quelle icône symbolise les étoiles XP ?",          opts:["⚡","★","◆","◯"],            ans:0, xp:30, tag:"XP"},
    {q:"Comment monter de niveau dans Universe ?",         opts:["Acheter","Gagner XP","Inviter","Partager"],ans:1,xp:35,tag:"XP"},
    {q:"Combien de badges sont disponibles ?",             opts:["5","8","10","12"],            ans:2, xp:35, tag:"Badge"},
  ].sort(()=>Math.random()-0.5),[]);
  const[qi,setQi]=useState(0);const[chain,setChain]=useState(0);const[score,setScore]=useState(0);
  const[mult,setMult]=useState(1);const[phase,setPhase]=useState<'q'|'r'|'over'|'done'>('q');
  const[sel,setSel]=useState<number|null>(null);const[timer,setTimer]=useState(20);
  const timerRef=useRef<any>(null);
  const getMult=(c:number)=>c<3?1:c<6?2:c<10?5:10;
  useEffect(()=>{
    if(phase!=='q')return;setTimer(20);
    timerRef.current=setInterval(()=>setTimer(t=>{if(t<=1){clearInterval(timerRef.current);setPhase('over');return 0;}return t-1;}),1000);
    return()=>clearInterval(timerRef.current);
  },[qi,phase]);
  const q=ALL_Q[qi%ALL_Q.length];
  const answer=(idx:number)=>{
    clearInterval(timerRef.current);setSel(idx);setPhase('r');
    if(idx===q.ans){const nc=chain+1,m=getMult(nc),pts=q.xp*m;setChain(nc);setMult(m);setScore(s=>s+pts);}
    else setPhase('over');
  };
  const cont=()=>{if(qi>=ALL_Q.length-1){onXP(score);setPhase('done');return;}setQi(i=>i+1);setSel(null);setPhase('q');};
  if(phase==='done') return <GameDone col={C.gold} icon="infinite-outline" title="Chaîne !" score={score} sub={`${chain} liens · ×${mult} final`} onClose={onClose}/>;
  if(phase==='over') return(
    <View style={{ flex:1,alignItems:'center',justifyContent:'center',padding:32,gap:14 }}>
      <View style={{ width:90,height:90,borderRadius:45,backgroundColor:'rgba(255,92,114,0.14)',borderWidth:2,borderColor:`${C.red}55`,alignItems:'center',justifyContent:'center' }}>
        <Ionicons name="flash" size={44} color={C.red}/>
      </View>
      <Text style={{ color:C.red,fontSize:28,fontWeight:'900' }}>Chaîne brisée !</Text>
      <Text style={{ color:C.muted,fontSize:15,textAlign:'center' }}>{chain} liens · {score} XP</Text>
      <View style={{ flexDirection:'row',gap:12,marginTop:8 }}>
        <TouchableOpacity onPress={onClose} style={{ borderRadius:14,paddingHorizontal:20,paddingVertical:13,borderWidth:1,borderColor:C.border }}>
          <Text style={{ color:C.muted,fontSize:14,fontWeight:'700' }}>Quitter</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>onXP(score)} style={{ borderRadius:14,paddingHorizontal:20,paddingVertical:13,backgroundColor:C.gold }}>
          <View style={{ flexDirection:'row',alignItems:'center',gap:6 }}><Ionicons name="flash" size={14} color={C.bg}/><Text style={{ color:C.bg,fontSize:14,fontWeight:'900' }}>+{score} XP</Text></View>
        </TouchableOpacity>
      </View>
    </View>
  );
  const mC=mult>=5?C.gold:mult>=2?C.white:C.muted;
  return(
    <View style={{ flex:1,padding:20 }}>
      <View style={{ flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
        <View style={{ flexDirection:'row',alignItems:'center',gap:8 }}>
          <View style={{ backgroundColor:C.goldFaint,borderRadius:10,paddingHorizontal:10,paddingVertical:5,borderWidth:1,borderColor:C.goldBd,flexDirection:'row',alignItems:'center',gap:4 }}>
            <Text style={{ color:C.gold,fontSize:16,fontWeight:'900' }}>{chain}</Text>
            <Text style={{ color:C.muted,fontSize:10 }}>liens</Text>
          </View>
          <View style={{ backgroundColor:`${mC}18`,borderRadius:9,paddingHorizontal:9,paddingVertical:4,borderWidth:1,borderColor:`${mC}30` }}>
            <Text style={{ color:mC,fontSize:13,fontWeight:'900' }}>×{mult}</Text>
          </View>
        </View>
        <View style={{ flexDirection:'row',alignItems:'center',gap:4 }}>
          <Ionicons name="flash" size={14} color={C.gold}/>
          <Text style={{ color:C.gold,fontSize:16,fontWeight:'900' }}>{score}</Text>
        </View>
        <View style={{ width:34,height:34,borderRadius:17,backgroundColor:C.faint,alignItems:'center',justifyContent:'center' }}>
          <Text style={{ color:timer<=7?C.red:C.muted,fontSize:13,fontWeight:'900' }}>{timer}</Text>
        </View>
      </View>
      <View style={{ height:3,backgroundColor:C.subtle,borderRadius:2,overflow:'hidden',marginBottom:14 }}>
        <View style={{ height:'100%',borderRadius:2,backgroundColor:timer<=7?C.red:C.white,width:`${(timer/20)*100}%` as any }}/>
      </View>
      {chain>0&&<View style={{ flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,marginBottom:12,padding:8,borderRadius:10,backgroundColor:`${mC}10`,borderWidth:StyleSheet.hairlineWidth,borderColor:`${mC}28` }}>
        <Text style={{ color:mC,fontSize:11,fontWeight:'700' }}>
          {chain<3?`${3-chain} bonne${3-chain>1?'s':''} réponse${3-chain>1?'s':''} pour ×2`:chain<6?`×2 actif · ${6-chain} pour ×5`:chain<10?`×5 actif · ${10-chain} pour ×10`:'×10 MAX !'}
        </Text>
      </View>}
      <LinearGradient colors={[`${mC}12`,'rgba(4,8,15,0.95)']} style={{ borderRadius:16,padding:18,borderWidth:1,borderColor:`${mC}25`,marginBottom:18,minHeight:82,justifyContent:'center',gap:8 }}>
        <View style={{ flexDirection:'row',alignItems:'center',gap:5 }}>
          <View style={{ backgroundColor:`${mC}20`,borderRadius:7,paddingHorizontal:7,paddingVertical:2 }}>
            <Text style={{ color:mC,fontSize:9,fontWeight:'900',letterSpacing:0.8 }}>{q.tag.toUpperCase()}</Text>
          </View>
          <Text style={{ color:C.muted,fontSize:9 }}>+{q.xp*mult} XP (×{mult})</Text>
        </View>
        <Text style={{ color:C.white,fontSize:16,fontWeight:'700',lineHeight:24 }}>{q.q}</Text>
      </LinearGradient>
      <View style={{ gap:9 }}>
        {q.opts.map((opt,i)=>{
          let bg=C.faint,border=C.border,tc:string=C.text;
          if(phase==='r'&&i===q.ans)           {bg='rgba(46,204,138,0.12)';border=C.green;tc=C.green;}
          if(phase==='r'&&i===sel&&i!==q.ans)  {bg='rgba(255,92,114,0.10)';border=C.red;tc=C.red;}
          return(<TouchableOpacity key={i} disabled={phase==='r'} onPress={()=>answer(i)} style={{ backgroundColor:bg,borderRadius:13,padding:13,borderWidth:1,borderColor:border,flexDirection:'row',alignItems:'center',gap:9 }}>
            <View style={{ width:24,height:24,borderRadius:12,backgroundColor:`${border}22`,borderWidth:1,borderColor:border,alignItems:'center',justifyContent:'center' }}>
              <Text style={{ color:tc,fontSize:10,fontWeight:'900' }}>{['A','B','C','D'][i]}</Text>
            </View>
            <Text style={{ color:tc,fontSize:13,fontWeight:'600',flex:1 }}>{opt}</Text>
          </TouchableOpacity>);
        })}
      </View>
      {phase==='r'&&<TouchableOpacity onPress={cont} style={{ marginTop:14,backgroundColor:C.gold,borderRadius:14,padding:13,alignItems:'center' }}>
        <Text style={{ color:C.bg,fontSize:14,fontWeight:'900' }}>Continuer la chaîne →</Text>
      </TouchableOpacity>}
    </View>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// ★ GALAXY MODAL
// ══════════════════════════════════════════════════════════════════════════════
const GalaxyModal = memo(({
  visible, onClose, works, userId,
  xp, streak, todayXP, weekXP, lv, nextLv, prog, unlocked, log, addXP,
}: {
  visible:boolean; onClose:()=>void; works:Work[]; userId:string;
  xp:number; streak:number; todayXP:number; weekXP:number;
  lv:Level; nextLv:Level|null; prog:number;
  unlocked:string[]; log:{label:string;xp:number}[]; addXP:(n:number,label?:string)=>void;
}) => {
  const router  = useRouter(), insets = useSafeAreaInsets();
  const slideY  = useRef(new Animated.Value(SH)).current;
  const [tab,   setTab]     = useState<'home'|'badges'|'games'|'rank'>('home');
  const [game,  setGame]    = useState<GameId|null>(null);
  const [burst, setBurst]   = useState({ v:false, n:0 });
  const [claimed, setClaimed] = useState<string[]>([]);
  const { leaders, myRank, loading: rankLoading } = useLeaderboard(userId);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue:0, useNativeDriver:true, tension:62, friction:11 }).start();
    } else {
      Animated.timing(slideY, { toValue:SH, duration:280, useNativeDriver:true, easing:Easing.in(Easing.cubic) }).start();
      setGame(null); setTab('home');
    }
  }, [visible]);

  const showBurst = useCallback((n: number) => {
    setBurst({ v:true, n }); setTimeout(() => setBurst({ v:false, n:0 }), 900);
  }, []);

  // XP uniquement à la fin du jeu (done screen)
  const handleXP = useCallback((n: number) => {
    if (n <= 0) return;
    addXP(n, 'Jeu terminé');
    showBurst(n);
  }, [addXP, showBurst]);

  // XP uniquement au CLAIM du défi (bouton visible seulement si prog>=1)
  const claim = useCallback((id: string, amt: number) => {
    if (claimed.includes(id)) return;
    setClaimed(c => [...c, id]);
    addXP(amt, 'Défi complété');
    showBurst(amt); hS();
  }, [claimed, addXP, showBurst]);

  const go = (route: string) => { onClose(); setTimeout(() => router.push(route as any), 320); };
  const navigate = (route: string | null) => { if (route) go(route); };

  const TABS = [
    { id:'home',   icon:'planet-outline'         as const, label:'Cosmos' },
    { id:'badges', icon:'ribbon-outline'          as const, label:'Badges' },
    { id:'games',  icon:'game-controller-outline' as const, label:'Jeux'   },
    { id:'rank',   icon:'podium-outline'          as const, label:'Rang'   },
  ] as const;

  const screen = () => {
    if (game === 'oracle')  return <OracleGame       onXP={handleXP} onClose={()=>setGame(null)}/>;
    if (game === 'warp')    return <WarpSwipe  works={works} onXP={handleXP} onClose={()=>setGame(null)}/>;
    if (game === 'map')     return <StarMap    works={works} onXP={handleXP} onClose={()=>setGame(null)}/>;
    if (game === 'vision')  return <DirectorVision works={works} onXP={handleXP} onClose={()=>setGame(null)}/>;
    if (game === 'nova')    return <NovaHunter works={works} onXP={handleXP} onClose={()=>setGame(null)}/>;
    if (game === 'chain')   return <GalaxyChain      onXP={handleXP} onClose={()=>setGame(null)}/>;

    // ── COSMOS (home) ──────────────────────────────────────────────────────
    if (tab === 'home') return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:E, paddingBottom:52 }}>
        {/* Niveau + XP */}
        <View style={{ alignItems:'center', marginBottom:20 }}>
          <View style={{ width:80, height:80, borderRadius:40,
            backgroundColor:C.goldFaint, borderWidth:2, borderColor:C.goldBd,
            alignItems:'center', justifyContent:'center', marginBottom:8 }}>
            <Ionicons name={lv.icon} size={36} color={C.gold}/>
          </View>
          <Text style={{ color:C.white, fontSize:21, fontWeight:'900' }}>{lv.title}</Text>
          <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>Niveau {lv.level}</Text>
        </View>
        <XPBar lv={lv} nextLv={nextLv} prog={prog} xp={xp}/>


        {/* ★ BADGE INTERACTION GLISSANT — remplace la liste */}
        <View style={{ marginBottom:8 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:10 }}>
          
          </View>
          <InteractionBadge onNavigate={navigate}/>
        </View>

        {/* Défis du jour */}
        <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginTop:20, marginBottom:10 }}>Défis du jour</Text>
        {DAILY.map(ch => <DailyRow key={ch.id} ch={ch} claimed={claimed.includes(ch.id)} onClaim={() => claim(ch.id, ch.xp)}/>)}

        {/* Activité récente */}
        {log.length > 0 && (
          <>
            <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginTop:18, marginBottom:10 }}>Récent</Text>
            {log.map((a, i) => (
              <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:10,
                paddingVertical:8, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border }}>
                <Ionicons name="flash" size={13} color={C.gold}/>
                <Text style={{ color:C.muted, fontSize:12, flex:1 }}>{a.label}</Text>
                <Text style={{ color:C.gold, fontSize:11, fontWeight:'800' }}>+{a.xp} XP</Text>
              </View>
            ))}
          </>
        )}

        {/* CTA Jeux */}
        <TouchableOpacity onPress={() => setTab('games')} activeOpacity={0.88} style={{ marginTop:18 }}>
          <LinearGradient colors={['rgba(245,200,66,0.12)','rgba(13,32,64,0.90)']} start={{x:0,y:0}} end={{x:1,y:1}}
            style={{ borderRadius:18, padding:18, flexDirection:'row', alignItems:'center', gap:14,
              borderWidth:1, borderColor:C.goldBd }}>
            <View style={{ width:50, height:50, borderRadius:25,
              backgroundColor:C.goldFaint, borderWidth:1.5, borderColor:C.goldBd,
              alignItems:'center', justifyContent:'center' }}>
              <Ionicons name="game-controller-outline" size={24} color={C.gold}/>
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ color:C.white, fontSize:14, fontWeight:'800' }}>6 jeux Galaxy — joue maintenant</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>XP crédité uniquement à la fin du jeu</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.gold}/>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    );

    // ── BADGES ────────────────────────────────────────────────────────────
    if (tab === 'badges') return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:E, paddingBottom:52 }}>
        <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginBottom:4 }}>Collection</Text>
        <Text style={{ color:C.muted, fontSize:12, marginBottom:20 }}>{unlocked.length}/{BADGES.length} débloqués</Text>
       
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:12 }}>
          {BADGES.map(b => <BadgeCard key={b.id} badge={b} unlocked={unlocked.includes(b.id)}/>)}
        </View>
      </ScrollView>
    );

    // ── JEUX ──────────────────────────────────────────────────────────────
    if (tab === 'games') return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:E, paddingBottom:52 }}>
        <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginBottom:4 }}>6 Jeux Galaxy</Text>
        <Text style={{ color:C.muted, fontSize:12, marginBottom:18 }}>XP uniquement à la fin — pas en cours de jeu</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:12 }}>
          {GAMES_META.map(g => <GameCard key={g.id} gm={g} onPlay={() => setGame(g.id)}/>)}
        </View>
        <View style={{ marginTop:18, height:72, borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:C.border }}>
          <LinearGradient colors={[C.card,'rgba(4,8,15,0.96)']} style={{ flex:1, padding:16, flexDirection:'row', alignItems:'center', gap:12 }}>
            <View style={{ width:40, height:40, borderRadius:20, backgroundColor:C.faint, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Ionicons name="lock-closed-outline" size={18} color={C.muted}/>
            </View>
            <View><Text style={{ color:C.white, fontSize:13, fontWeight:'800' }}>Tournoi cosmique</Text><Text style={{ color:C.muted, fontSize:11 }}>Débloqué au niveau 4</Text></View>
          </LinearGradient>
        </View>
      </ScrollView>
    );

    // ── CLASSEMENT DYNAMIQUE (Supabase v_leaderboard) ─────────────────────
    if (tab === 'rank') {
      const RI = ['trophy','medal','ribbon'] as const;
      const rankGold = ['rgba(245,200,66,0.22)','rgba(200,200,200,0.15)','rgba(205,127,50,0.15)'];
      const rankBd   = [C.gold,'#C0C0C0','#CD7F32'];
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:E, paddingBottom:52 }}>
          <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginBottom:4 }}>Classement Universe</Text>
          <Text style={{ color:C.muted, fontSize:12, marginBottom:18 }}>Temps réel · Supabase live</Text>
          {rankLoading && [0,1,2,3,4].map(i => <Shimmer key={i} w="100%" h={62} r={14} />)}
          {!rankLoading && leaders.length === 0 && (
            <View style={{ padding:36, alignItems:'center', gap:10 }}>
              <Text style={{ color:C.gold, fontSize:24 }}>★</Text>
              <Text style={{ color:C.muted, fontSize:13, textAlign:'center' }}>Sois le premier dans le classement</Text>
            </View>
          )}
          {!rankLoading && leaders.slice(0,10).map((r, i) => {
            const isMe = r.user_id === userId;
            const col  = i < 3 ? rankBd[i] : C.muted;
            return (
              <View key={r.user_id} style={{ height:62, marginBottom:8, borderRadius:14, overflow:'hidden',
                borderWidth:1, borderColor:isMe ? C.goldBd : i<3 ? `${col}50` : C.border }}>
                <LinearGradient
                  colors={isMe ? [C.goldFaint,'rgba(13,32,64,0.95)'] : i<3 ? [rankGold[i],'rgba(4,8,15,0.88)'] : [C.card,'rgba(4,8,15,0.85)']}
                  style={{ flex:1, paddingHorizontal:14, flexDirection:'row', alignItems:'center', gap:12 }}>
                  <View style={{ width:28, height:28, borderRadius:14,
                    backgroundColor:i<3?`${col}20`:C.faint, borderWidth:1, borderColor:i<3?col:C.border,
                    alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {i<3 ? <Ionicons name={RI[i]} size={13} color={col}/>
                          : <Text style={{ color:C.muted, fontSize:10, fontWeight:'900' }}>#{r.rank}</Text>}
                  </View>
                  <View style={{ width:34, height:34, borderRadius:17, backgroundColor:C.faint,
                    alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.border, flexShrink:0 }}>
                    <Ionicons name="person-outline" size={15} color={C.muted}/>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:isMe?C.gold:C.white, fontSize:13, fontWeight:'800' }} numberOfLines={1}>
                      {isMe ? 'Vous' : r.display_name}
                    </Text>
                    <Text style={{ color:C.muted, fontSize:10 }} numberOfLines={1}>{r.title}</Text>
                  </View>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                    <Ionicons name="flash" size={10} color={C.gold}/>
                    <Text style={{ color:C.gold, fontSize:12, fontWeight:'900' }}>{r.xp.toLocaleString()}</Text>
                  </View>
                </LinearGradient>
              </View>
            );
          })}
          {myRank && myRank > 10 && (
            <View style={{ padding:13, borderRadius:12, borderWidth:1,
              borderColor:C.goldBd, backgroundColor:C.goldFaint, alignItems:'center' }}>
              <Text style={{ color:C.gold, fontSize:12 }}>Votre rang : <Text style={{ fontWeight:'900' }}>#{myRank}</Text></Text>
            </View>
          )}
        </ScrollView>
      );
    }
    return null;
  };

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex:1, backgroundColor:'rgba(4,8,15,0.92)' }}>
        <GalaxyBackground/>
        <Animated.View style={{ flex:1, transform:[{translateY:slideY}] }}>
          <View style={{ paddingTop:insets.top+12, paddingHorizontal:E, paddingBottom:14,
            flexDirection:'row', alignItems:'center' }}>
            <View style={{ flex:1 }}>
              <Text style={{ color:C.white, fontSize:22, fontWeight:'900', letterSpacing:-0.5 }}>
                {game ? GAMES_META.find(g=>g.id===game)?.title ?? 'Jeu' : 'Galaxie XP'}
              </Text>
              {!game && <Text style={{ color:C.muted, fontSize:12, marginTop:1 }}>
                {xp.toLocaleString()} XP · {lv.title}
              </Text>}
            </View>
            <TouchableOpacity onPress={game ? () => setGame(null) : onClose}
              style={{ width:38, height:38, borderRadius:19, backgroundColor:C.faint,
                alignItems:'center', justifyContent:'center',
                borderWidth:StyleSheet.hairlineWidth, borderColor:C.border }}>
              <Ionicons name={game ? 'arrow-back' : 'close'} size={18} color={C.white}/>
            </TouchableOpacity>
          </View>
          {!game && (
            <View style={{ flexDirection:'row', paddingHorizontal:E, marginBottom:4 }}>
              {TABS.map(t => {
                const active = tab === t.id;
                return (
                  <TouchableOpacity key={t.id} onPress={() => { hL(); setTab(t.id as any); }}
                    style={{ flex:1, alignItems:'center', paddingVertical:10 }}>
                    <Ionicons name={t.icon} size={19} color={active ? C.gold : C.muted}/>
                    <Text style={{ color:active?C.gold:C.muted, fontSize:10,
                      fontWeight:active?'800':'600', marginTop:3 }}>{t.label}</Text>
                    {active && <View style={{ position:'absolute', bottom:0, width:20, height:2,
                      borderRadius:1, backgroundColor:C.gold }}/>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={{ height:StyleSheet.hairlineWidth, backgroundColor:C.border, marginBottom:4 }}/>
          <View style={{ flex:1 }}>{screen()}</View>
          <XPBurst v={burst.v} n={burst.n} done={() => {}}/>
        </Animated.View>
      </View>
    </Modal>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// ★ GAMIFICATION BADGE — aura divine breathing, FOMO phrases, hauteur fixe
// ══════════════════════════════════════════════════════════════════════════════
const GamificationBadge = memo(({ xp, lv, prog, streak, unlocked, onPress }: {
  xp:number; lv:Level; prog:number; streak:number; unlocked:number; onPress:()=>void;
}) => {
  const [si, setSi]  = useState(0);
  const fade         = useRef(new Animated.Value(1)).current;
  const btnSc        = useRef(new Animated.Value(1)).current;
  const glowOp       = useRef(new Animated.Value(0.26)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue:0.95, duration:2600, easing:Easing.inOut(Easing.ease), useNativeDriver:true }),
      Animated.timing(glowOp, { toValue:0.26, duration:2600, easing:Easing.inOut(Easing.ease), useNativeDriver:true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(fade, { toValue:0, duration:200, useNativeDriver:true }).start(() => {
        setSi(i => (i+1) % SECTIONS.length);
        Animated.timing(fade, { toValue:1, duration:260, useNativeDriver:true }).start();
      });
    }, 3600);
    return () => clearInterval(t);
  }, []);

  const press = () => {
    hM();
    Animated.sequence([
      Animated.timing(btnSc, { toValue:0.94, duration:80, useNativeDriver:true }),
      Animated.spring(btnSc, { toValue:1, tension:300, friction:8, useNativeDriver:true }),
    ]).start(onPress);
  };

  const sec = SECTIONS[si];
  // FOMO phrase basée sur le ratio XP/niveau
  const fomoIdx = Math.floor((xp + si * 37) % FOMO.length);
  const phrase  = FOMO[fomoIdx];

  const glowStyle: any = {
    position:'absolute', top:-3, bottom:-3, left:-3, right:-3, borderRadius:21,
    ...(Platform.OS === 'web'
      ? { boxShadow:`0 0 24px 8px rgba(245,200,66,0.40), 0 0 8px 2px rgba(245,200,66,0.18)` }
      : { shadowColor:C.gold, shadowOffset:{width:0,height:0}, shadowOpacity:0.82, shadowRadius:16, elevation:8 }),
  };

  return (
    <TouchableOpacity onPress={press} activeOpacity={1} style={{ marginHorizontal:E }}>
      <Animated.View style={{ transform:[{scale:btnSc}] }}>
        <Animated.View style={[glowStyle, { opacity:glowOp }]} pointerEvents="none"/>
        <LinearGradient
          colors={['rgba(245,200,66,0.12)','rgba(13,32,64,0.88)','rgba(4,8,15,0.97)']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ height:88, borderRadius:18, paddingHorizontal:17,
            borderWidth:1, borderColor:C.goldBd,
            flexDirection:'row', alignItems:'center', gap:14 }}>
          {/* Icone niveau */}
          <View style={{ width:46, height:46, borderRadius:14, flexShrink:0,
            backgroundColor:C.goldFaint, borderWidth:1.5, borderColor:C.goldBd,
            alignItems:'center', justifyContent:'center' }}>
            <Ionicons name={lv.icon} size={21} color={C.gold}/>
          </View>
          {/* Contenu */}
          <View style={{ flex:1, gap:4 }}>
            <Animated.View style={{ opacity:fade, flexDirection:'row', alignItems:'center', gap:6 }}>
              <Ionicons name={sec.icon} size={11} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:12, fontWeight:'900', letterSpacing:0.4 }}>{sec.label}</Text>
              <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:7,
                backgroundColor:C.goldFaint, borderWidth:StyleSheet.hairlineWidth, borderColor:C.goldBd }}>
                <Text style={{ color:C.gold, fontSize:9, fontWeight:'800' }}>NIV.{lv.level}</Text>
              </View>
            </Animated.View>
            <Animated.Text style={{ color:C.muted, fontSize:11, fontStyle:'italic', opacity:fade }} numberOfLines={1}>
              {phrase}
            </Animated.Text>
            <View style={{ height:3, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden' }}>
              <View style={{ height:'100%', borderRadius:2, backgroundColor:C.gold, width:`${prog*100}%` as any }}/>
            </View>
          </View>
          {/* Stats droite */}
          <View style={{ alignItems:'flex-end', gap:5, flexShrink:0 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
              <Ionicons name="flash" size={11} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:13, fontWeight:'900' }}>{fmtXP(xp)}</Text>
            </View>
            {streak > 0 && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:2 }}>
                <Text style={{ color:C.gold, fontSize:10, fontWeight:'800' }}>★{streak}j</Text>
              </View>
            )}
            {unlocked > 0 && (
              <Text style={{ color:C.muted, fontSize:9, fontWeight:'700' }}>{unlocked} badges</Text>
            )}
            <Ionicons name="chevron-forward" size={13} color={C.muted}/>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
const COLS = 'id,title,category,genre,year,likes,image,is_original,adjective,duration,director,created_at';
async function fetchWorks(): Promise<Work[]> {
  const { data, error } = await supabase.from('works').select(COLS).order('likes',{ascending:false}).limit(200);
  if (error) { const { data:fb } = await supabase.from('works').select(COLS).limit(100); return (fb??[]) as Work[]; }
  return (data??[]) as Work[];
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
const HERO_H = SH * 0.50;
const HeroSlide = memo(({ item, W, onPress }: { item:Work; W:number; onPress:()=>void }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const uri  = useMemo(() => resolveImg(item.id, item.image), [item.id, item.image]);
  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={{ width:W, height:HERO_H }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor:C.card }]}/>
      <Animated.Image source={{uri}} style={[StyleSheet.absoluteFill,{opacity:fade}]} resizeMode="cover"
        onLoad={() => Animated.timing(fade,{toValue:1,duration:400,useNativeDriver:true}).start()}/>
      <LinearGradient colors={['rgba(4,8,15,0.48)','transparent']} style={{position:'absolute',top:0,left:0,right:0,height:130}} pointerEvents="none"/>
      <LinearGradient colors={['transparent','rgba(4,8,15,0.72)','rgba(4,8,15,0.97)']} style={{position:'absolute',bottom:0,left:0,right:0,height:'65%' as any}} pointerEvents="none"/>
      <View style={hs.c}>
        <View style={{ flexDirection:'row', gap:6 }}>
          {item.is_original && <View style={hs.orig}><Text style={hs.origT}>★ ORIGINAL</Text></View>}
          {(item.likes??0)<100 && <View style={hs.pep}><Text style={hs.pepT}>PÉPITE</Text></View>}
        </View>
        <Text style={hs.title} numberOfLines={2}>{item.title??''}</Text>
        {!!(item.adjective||item.genre) && <Text style={hs.sub} numberOfLines={1}>{item.adjective||`${item.genre??''}${item.year?` · ${item.year}`:''}`}</Text>}
        <View style={{ flexDirection:'row', alignItems:'center', gap:7 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="heart" size={11} color={C.muted}/>
            <Text style={hs.stat}>{fmtK(item.likes??0)}</Text>
          </View>
          {item.duration!=null&&<><View style={{width:3,height:3,borderRadius:1.5,backgroundColor:C.faint}}/><Text style={hs.stat}>{fmtDur(item.duration)}</Text></>}
        </View>
        <View style={hs.actions}>
          <TouchableOpacity style={hs.play} onPress={onPress} activeOpacity={0.85}>
            <Ionicons name="play" size={14} color={C.bg}/>
            <Text style={{ color:C.bg,fontSize:13,fontWeight:'700' }}>Regarder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={hs.info} onPress={onPress} activeOpacity={0.80}>
            <Ionicons name="information-circle-outline" size={14} color={C.white}/>
            <Text style={{ color:C.white,fontSize:13,fontWeight:'600' }}>Détails</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const hs = StyleSheet.create({
  c:     { position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:22,paddingBottom:50,gap:8 },
  orig:  { paddingHorizontal:8,paddingVertical:3,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.goldBd,backgroundColor:C.goldFaint },
  origT: { color:C.gold,fontSize:9,fontWeight:'800',letterSpacing:0.6 },
  pep:   { paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi },
  pepT:  { color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.6 },
  title: { color:C.white,fontSize:26,fontWeight:'800',letterSpacing:-0.4,lineHeight:32 },
  sub:   { color:C.muted,fontSize:13 },
  stat:  { color:C.muted,fontSize:11,fontWeight:'600' },
  actions:{ flexDirection:'row',gap:10,marginTop:2 },
  play:  { flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.white,paddingHorizontal:20,paddingVertical:10,borderRadius:24 },
  info:  { flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.faint,paddingHorizontal:16,paddingVertical:10,borderRadius:24,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border },
});

const HeroBanner = memo(({ works, loading }: { works:Work[]; loading:boolean }) => {
  const router = useRouter(), scrollX = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<FlatList<Work>>(null), timerRef = useRef<ReturnType<typeof setInterval>>();
  const paused = useRef(false), idxRef = useRef(0);
  const [slotW, setSlotW] = useState(SW);
  const scrollTo = useCallback((i:number) => {
    if (!works.length||!slotW) return;
    const nx=((i%works.length)+works.length)%works.length;
    flatRef.current?.scrollToOffset({offset:nx*slotW,animated:true}); idxRef.current=nx;
  }, [works.length,slotW]);
  useEffect(() => {
    if (works.length<2) return;
    clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{if(!paused.current)scrollTo(idxRef.current+1);},5200);
    return ()=>clearInterval(timerRef.current);
  }, [works.length,scrollTo]);
  const onScroll=useMemo(()=>Animated.event([{nativeEvent:{contentOffset:{x:scrollX}}}],{useNativeDriver:false}),[]);
  const renderItem=useCallback(({item}:ListRenderItemInfo<Work>)=><HeroSlide item={item} W={slotW} onPress={()=>router.push(`/film/${item.id}` as any)}/>,[router,slotW]);
  const keyEx=useCallback((w:Work)=>`h${w.id}`,[]);
  if (loading||!works.length) return (
    <View style={{ height:HERO_H, backgroundColor:C.card }}>
      <View style={{ ...StyleSheet.absoluteFillObject,padding:22,justifyContent:'flex-end',gap:10 }}>
        <Shimmer w="50%" h={12}/><Shimmer w="74%" h={26}/><Shimmer w="40%" h={11}/><Shimmer w="52%" h={40} r={24}/>
      </View>
    </View>
  );
  const dc=Math.min(works.length,8);
  return (
    <View style={{ height:HERO_H,overflow:'hidden' }} onLayout={e=>setSlotW(e.nativeEvent.layout.width)}>
      <FlatList ref={flatRef} data={works} keyExtractor={keyEx} renderItem={renderItem}
        horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false}
        decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16}
        onScrollBeginDrag={()=>{paused.current=true;}}
        onMomentumScrollEnd={e=>{idxRef.current=Math.round(e.nativeEvent.contentOffset.x/slotW);paused.current=false;}}
        windowSize={5} initialNumToRender={3} maxToRenderPerBatch={3} removeClippedSubviews={false}/>
      {works.length>1&&<View style={{ position:'absolute',bottom:14,left:0,right:0,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5 }}>
        {Array.from({length:dc}).map((_,i)=>{const inp=[(i-1)*slotW,i*slotW,(i+1)*slotW];return(
          <TouchableOpacity key={i} onPress={()=>scrollTo(i)} hitSlop={10}>
            <Animated.View style={{ height:3,borderRadius:2,backgroundColor:C.white,
              opacity:scrollX.interpolate({inputRange:inp,outputRange:[0.25,1,0.25],extrapolate:'clamp'}),
              width:scrollX.interpolate({inputRange:inp,outputRange:[6,20,6],extrapolate:'clamp'})}}/>
          </TouchableOpacity>
        );})}
      </View>}
    </View>
  );
});

// ─── CARDS ───────────────────────────────────────────────────────────────────
const PW=128,PH=190,LW=226,LH=128;
const PortraitCard = memo(({ item, rank, pep }: { item:Work; rank?:number; pep?:boolean }) => {
  const router=useRouter(), uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return (
    <TouchableOpacity style={{ marginRight:10 }} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={pc.card}>
        <Image source={{uri}} style={pc.img} resizeMode="cover"/>
        <LinearGradient colors={['transparent','rgba(4,8,15,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/>
        <View style={pc.badge}><Text style={pc.badgeT}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>
        {pep&&<View style={pc.pepite}><Text style={{ color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.5 }}>PÉPITE</Text></View>}
        {rank!=null&&<Text style={pc.rank}>{rank}</Text>}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection:'row',alignItems:'center',gap:4 }}>
            <Ionicons name="heart" size={9} color={C.muted}/>
            <Text style={pc.stat}>{fmtK(item.likes??0)}</Text>
            {item.year&&<><View style={{ width:2,height:2,borderRadius:1,backgroundColor:C.faint }}/><Text style={pc.stat}>{item.year}</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const pc=StyleSheet.create({
  card:  {width:PW,height:PH,borderRadius:12,overflow:'hidden',backgroundColor:C.card},
  img:   {width:'100%',height:'100%',resizeMode:'cover'},
  badge: {position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(4,8,15,0.75)'},
  badgeT:{color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:0.4},
  pepite:{position:'absolute',top:7,right:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.16)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},
  rank:  {position:'absolute',bottom:32,right:6,fontSize:48,fontWeight:'900',lineHeight:48,letterSpacing:-3,color:'rgba(255,255,255,0.10)'},
  meta:  {position:'absolute',bottom:8,left:9,right:9,gap:3},
  title: {color:C.white,fontSize:11,fontWeight:'700',lineHeight:14},
  stat:  {color:C.muted,fontSize:9,fontWeight:'600'},
});
const LandscapeCard=memo(({item}:{item:Work})=>{
  const router=useRouter(),uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return(
    <TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={lc.card}>
        <Image source={{uri}} style={lc.img} resizeMode="cover"/>
        <LinearGradient colors={['transparent','rgba(4,8,15,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0.3,y:0}} end={{x:1,y:1}}/>
        {item.duration!=null&&<View style={lc.dur}><Ionicons name="time-outline" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:8,fontWeight:'600'}}>{fmtDur(item.duration)}</Text></View>}
        <View style={lc.meta}>
          <Text style={lc.title} numberOfLines={1}>{item.title}</Text>
          {!!item.adjective&&<Text style={{color:C.muted,fontSize:9}} numberOfLines={1}>{item.adjective}</Text>}
          <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
            <Ionicons name="heart" size={9} color={C.muted}/>
            <Text style={lc.stat}>{fmtK(item.likes??0)}</Text>
            {item.director!=null&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.faint}}/><Text style={lc.stat} numberOfLines={1}>{item.director}</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const lc=StyleSheet.create({
  card: {width:LW,height:LH,borderRadius:12,overflow:'hidden',backgroundColor:C.card},
  img:  {width:'100%',height:'100%',resizeMode:'cover'},
  dur:  {position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(4,8,15,0.74)',paddingHorizontal:7,paddingVertical:3,borderRadius:7},
  meta: {position:'absolute',bottom:9,left:10,right:10,gap:2},
  title:{color:C.white,fontSize:12,fontWeight:'700'},
  stat: {color:C.muted,fontSize:9,fontWeight:'600'},
});

const RowSection = memo(({ title, sub, count, items, loading, portrait, rank, pep }:{
  title:string;sub?:string;count?:number;items:Work[];loading:boolean;portrait:boolean;rank?:boolean;pep?:boolean;
}) => {
  const CW=portrait?PW:LW,CH=portrait?PH:LH,SNAP=CW+10;
  const renderItem=useCallback(({item,index}:{item:Work;index:number})=>portrait?<PortraitCard item={item} rank={rank?index+1:undefined} pep={pep&&(item.likes??0)<100}/>:<LandscapeCard item={item}/>,[portrait,rank,pep]);
  const getLayout=useCallback((_:any,i:number)=>({length:SNAP,offset:SNAP*i,index:i}),[SNAP]);
  const keyEx=useCallback((w:Work)=>`${portrait?'p':'l'}${w.id}`,[portrait]);
  if (loading) return <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:E,gap:10}}>{[0,1,2,3,4].map(i=><Shimmer key={i} w={CW} h={CH} r={12}/>)}</ScrollView></View>;
  if (!items.length) return null;
  return (
    <View>
      {!!title&&<View style={{paddingHorizontal:E,marginBottom:14,gap:2}}>
        <Text style={{color:C.white,fontSize:17,fontWeight:'800',letterSpacing:-0.3}}>{title}</Text>
        {(sub||count!=null)&&<Text style={{color:C.muted,fontSize:11}}>{[sub,count!=null?`${count} œuvres`:null].filter(Boolean).join(' · ')}</Text>}
      </View>}
      <FlatList horizontal data={items} keyExtractor={keyEx} renderItem={renderItem} getItemLayout={getLayout}
        showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:E}}
        decelerationRate="fast" snapToInterval={SNAP} snapToAlignment="start"
        initialNumToRender={6} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews/>
    </View>
  );
});

// ─── SEARCH OVERLAY ──────────────────────────────────────────────────────────
const SearchOverlay = memo(({ visible, onClose, works }:{ visible:boolean; onClose:()=>void; works:Work[] }) => {
  const router=useRouter(),insets=useSafeAreaInsets();
  const[q,setQ]=useState('');const inputRef=useRef<TextInput>(null);const slideY=useRef(new Animated.Value(SH)).current;
  useEffect(()=>{
    if(visible){Animated.spring(slideY,{toValue:0,useNativeDriver:true,tension:65,friction:10}).start();const t=setTimeout(()=>inputRef.current?.focus(),300);return()=>clearTimeout(t);}
    else{setQ('');Animated.timing(slideY,{toValue:SH,duration:220,useNativeDriver:true}).start();}
  },[visible]);
  const results=useMemo(()=>{if(!q.trim())return works.slice(0,40);const lo=q.toLowerCase();return works.filter(w=>(w.title??'').toLowerCase().includes(lo)||(w.genre??'').toLowerCase().includes(lo)||(w.director??'').toLowerCase().includes(lo)).slice(0,80);},[q,works]);
  const CW=(SW-42)/2;
  const goFilm=useCallback((id:number)=>{onClose();router.push(`/film/${id}` as any);},[onClose,router]);
  const renderR=useCallback(({item}:ListRenderItemInfo<Work>)=>(
    <TouchableOpacity style={[so.card,{width:CW}]} onPress={()=>goFilm(item.id)} activeOpacity={0.85}>
      <Image source={{uri:resolveImg(item.id,item.image)}} style={so.img} resizeMode="cover"/>
      <LinearGradient colors={['transparent','rgba(4,8,15,0.94)']} style={StyleSheet.absoluteFillObject}/>
      {(item.likes??0)<100&&<View style={so.pep}><Text style={{color:C.white,fontSize:7,fontWeight:'800'}}>PÉPITE</Text></View>}
      <View style={so.info}><Text style={so.iT} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.muted}/><Text style={so.iM}>{fmtK(item.likes??0)}</Text>{item.duration!=null&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.faint}}/><Text style={so.iM}>{fmtDur(item.duration)}</Text></>}</View></View>
    </TouchableOpacity>
  ),[goFilm,CW]);
  if(!visible) return null;
  return(
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GalaxyBackground/>
      <Animated.View style={{flex:1,transform:[{translateY:slideY}]}}>
        <View style={[so.top,{paddingTop:insets.top+10}]}>
          <View style={so.row}><Ionicons name="search-outline" size={15} color={C.muted}/><TextInput ref={inputRef} style={so.input} value={q} onChangeText={setQ} placeholder="Titre, genre, réalisateur…" placeholderTextColor={C.muted} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" selectionColor={C.gold}/></View>
          <TouchableOpacity onPress={onClose} style={{paddingLeft:8}}><Text style={{color:C.muted,fontSize:14,fontWeight:'600'}}>Annuler</Text></TouchableOpacity>
        </View>
        <View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:16,marginBottom:12}}>
          <Ionicons name="film-outline" size={11} color={C.muted}/>
          <Text style={{color:C.muted,fontSize:11}}>{results.length} résultat{results.length!==1?'s':''}{q.trim()?` · «\u00a0${q.trim()}\u00a0»`:''}</Text>
        </View>
        {results.length===0?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:8}}><Text style={{color:C.gold,fontSize:28}}>★</Text><Text style={{color:C.muted,fontSize:14}}>Aucun résultat</Text></View>:<FlatList data={results} keyExtractor={w=>`s${w.id}`} renderItem={renderR} numColumns={2} columnWrapperStyle={{justifyContent:'space-between',gap:10,marginBottom:10}} contentContainerStyle={{paddingHorizontal:16,paddingBottom:insets.bottom+40}} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={10} windowSize={5}/>}
      </Animated.View>
    </Modal>
  );
});
const so=StyleSheet.create({
  top:  {flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingBottom:10,gap:8},
  row:  {flex:1,flexDirection:'row',alignItems:'center',borderRadius:10,paddingHorizontal:12,height:40,gap:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  input:{flex:1,color:C.white,fontSize:14},
  card: {height:200,borderRadius:12,overflow:'hidden',backgroundColor:C.card},
  img:  {width:'100%',height:'100%'},
  pep:  {position:'absolute',top:7,right:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},
  info: {position:'absolute',bottom:8,left:9,right:9,gap:4},
  iT:   {color:C.white,fontSize:12,fontWeight:'700'},
  iM:   {color:C.muted,fontSize:10,fontWeight:'600'},
});

// ══════════════════════════════════════════════════════════════════════════════
// ★★★ SEARCH SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [works,   setWorks]   = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [srch,    setSrch]    = useState(false);
  const [galaxy,  setGalaxy]  = useState(false);
  const [userId,  setUserId]  = useState('');
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => { getDeviceId().then(id => setUserId(id)); }, []);
  useEffect(() => {
    let dead = false;
    setLoading(true);
    fetchWorks().then(d => { if (!dead) { setWorks(d); setLoading(false); } }).catch(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, []);

  const { xp, streak, todayXP, weekXP, lv, nextLv, prog,
          unlocked, freshBadge, clearFresh, log, addXP } = useXPStore();

  const hero      = useMemo(() => works.slice(0,20),  [works]);
  const popular   = useMemo(() => works,               [works]);
  const recent    = useMemo(() => [...works].sort((a,b)=>{ const da=a.created_at?new Date(a.created_at).getTime():0,db=b.created_at?new Date(b.created_at).getTime():0;return db-da;}).slice(0,30), [works]);
  const originals = useMemo(() => works.filter(w=>w.is_original), [works]);
  const courts    = useMemo(() => works.filter(w=>(w.duration??0)>0&&(w.duration??0)<60), [works]);
  const moyens    = useMemo(() => works.filter(w=>(w.duration??0)>=60&&(w.duration??0)<=100), [works]);
  const longs     = useMemo(() => works.filter(w=>(w.duration??0)>100), [works]);
  const pepites   = useMemo(() => works.filter(w=>(w.likes??0)<100&&(w.likes??0)>5).sort((a,b)=>(b.likes??0)-(a.likes??0)).slice(0,20), [works]);

  const headerOp = scrollY.interpolate({ inputRange:[0,80], outputRange:[1,0], extrapolate:'clamp' });
  const DIV = <View style={{ height:StyleSheet.hairlineWidth, backgroundColor:C.faint, marginHorizontal:E, marginVertical:24 }}/>;

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <BadgeToast id={freshBadge} v={!!freshBadge} done={clearFresh}/>
      <Animated.View pointerEvents="box-none"
        style={{ position:'absolute',top:5,left:0,right:0,zIndex:10,
          flexDirection:'row',alignItems:'center',
          paddingHorizontal:E,paddingTop:insets.top+4,paddingBottom:8,opacity:headerOp }}>
        <Text style={{ flex:1,color:C.white,fontSize:30,fontWeight:'800',letterSpacing:-0.5 }}>UNIVERSE</Text>
        <TouchableOpacity onPress={()=>{hL();setSrch(true);}}
          style={{ width:38,height:38,borderRadius:19,backgroundColor:C.faint,
            alignItems:'center',justifyContent:'center',
            borderWidth:StyleSheet.hairlineWidth,borderColor:C.border }}
          activeOpacity={0.78}>
          <Ionicons name="search-outline" size={18} color={C.white}/>
        </TouchableOpacity>
      </Animated.View>
      <SearchOverlay visible={srch} onClose={()=>setSrch(false)} works={works}/>
      <GalaxyModal visible={galaxy} onClose={()=>setGalaxy(false)}
        works={works} userId={userId}
        xp={xp} streak={streak} todayXP={todayXP} weekXP={weekXP}
        lv={lv} nextLv={nextLv} prog={prog}
        unlocked={unlocked} log={log} addXP={addXP}/>
      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:120}}
        scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:true})}>
        <HeroBanner works={hero} loading={loading}/>
        <View style={{ height:20 }}/>
        {/* ★ DEUX BADGES PRIORITAIRES avec aura dorée */}
        <View style={{ marginBottom:24, gap:12 }}>
          <View style={{ flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:E,marginBottom:6 }}>
            <Text style={{ color:C.gold,fontSize:13 }}>★</Text>
            <Text style={{ color:C.white,fontSize:17,fontWeight:'800' }}>Découvres ton cosmos...</Text>
            {unlocked.length>0&&<View style={{ marginLeft:'auto' as any,
              paddingHorizontal:9,paddingVertical:3,borderRadius:9,
              backgroundColor:C.goldFaint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.goldBd }}>
              <Text style={{ color:C.gold,fontSize:9,fontWeight:'800' }}>{unlocked.length} badges</Text>
            </View>}
          </View>
          <GamificationBadge xp={xp} lv={lv} prog={prog} streak={streak} unlocked={unlocked.length} onPress={()=>setGalaxy(true)}/>
        </View>
        <RowSection title="Les plus populaires" count={loading?undefined:works.length} items={popular} loading={loading} portrait rank/>
        {DIV}
        {(recent.length>0||loading)&&<><RowSection title="Récemment ajoutés" sub="Nouvelles œuvres" items={recent} loading={loading} portrait={false}/>{DIV}</>}
        {pepites.length>0&&<>
          <View style={{ paddingHorizontal:E,marginBottom:12,flexDirection:'row',alignItems:'center',gap:7 }}>
            <Text style={{ color:C.gold,fontSize:13 }}>★</Text>
            <Text style={{ color:C.white,fontSize:17,fontWeight:'800' }}>Pépites cachées</Text>
            <View style={{ marginLeft:'auto' as any,paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi }}><Text style={{ color:C.white,fontSize:9,fontWeight:'700' }}>À découvrir</Text></View>
          </View>
          <RowSection title="" items={pepites} loading={loading} portrait pep/>
          {DIV}
        </>}
        {(originals.length>0||loading)&&<><RowSection title="Originaux Universe" sub="Créations exclusives" count={loading?undefined:originals.length} items={originals} loading={loading} portrait/>{DIV}</>}
        {(courts.length>0||loading)&&<><RowSection title="Courts métrages" sub="Moins de 60 min" count={loading?undefined:courts.length} items={courts} loading={loading} portrait={false}/>{DIV}</>}
        {(moyens.length>0||loading)&&<><RowSection title="Moyens métrages" sub="60 – 100 min" count={loading?undefined:moyens.length} items={moyens} loading={loading} portrait={false}/>{DIV}</>}
        {(longs.length>0||loading)&&<RowSection title="Mini-séries & longs" sub="100 min+" count={loading?undefined:longs.length} items={longs} loading={loading} portrait={false}/>}
        <View style={{ height:120 }}/>
      </Animated.ScrollView>
    </View>
  );
}