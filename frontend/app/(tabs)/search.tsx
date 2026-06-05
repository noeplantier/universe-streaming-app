/**
 * app/(tabs)/search.tsx  —  UNIVERSE v7
 * ═══════════════════════════════════════════════════════════════════════════
 *  ★ 6 JEUX GALAXY ultra-sophistiqués (Oracle / Warp / StarMap / Vision /
 *    NovaHunt / GalaxyChain) — XP uniquement à la fin
 *  ★ Rétention maximum : streak daily, FOMO badge, chain multiplier
 *  ★ Discovery gamification : chaque jeu enseigne l'app Universe
 *  ★ Aura divine smooth — boxShadow/shadow, zéro cercle orbital
 *  ★ Badges auto-débloqués par seuil XP réel
 *  ★ Classement dynamique Supabase v_leaderboard
 *  ★ getDeviceId() — ZERO supabase.auth.*
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
  type ListRenderItemInfo,
} from 'react';
import {
  Animated, Dimensions, Easing, FlatList, Image, Modal,
  PanResponder, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
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
// Haptics — graceful degradation web
let _H: any = null;
if (Platform.OS !== 'web') { try { _H = require('expo-haptics'); } catch {} }
const hL = () => _H?.impactAsync?.(_H.ImpactFeedbackStyle?.Light).catch(()=>{});
const hM = () => _H?.impactAsync?.(_H.ImpactFeedbackStyle?.Medium).catch(()=>{});
const hS = () => _H?.notificationAsync?.(_H.NotificationFeedbackType?.Success).catch(()=>{});

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg      : '#040810',
  navy    : '#0A1428',
  navyMid : '#0D2040',
  navyLow : '#0A1830',
  white   : '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.82)',
  mid     : 'rgba(255,255,255,0.55)',
  muted   : 'rgba(255,255,255,0.36)',
  subtle  : 'rgba(255,255,255,0.14)',
  faint   : 'rgba(255,255,255,0.07)',
  border  : 'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.22)',
  blue    : '#5A96E6',  blueFaint  : 'rgba(90,150,230,0.12)',
  gold    : '#F5C842',  goldFaint  : 'rgba(245,200,66,0.13)',
  green   : '#2ECC8A',  greenFaint : 'rgba(46,204,138,0.12)',
  purple  : '#9B6BFF',  purpleFaint: 'rgba(155,107,255,0.14)',
  cyan    : '#4DD8E8',  cyanFaint  : 'rgba(77,216,232,0.12)',
  red     : '#FF5C72',
  orange  : '#FF8C42',
} as const;

const EDGE = 20;
const E = EDGE;
const fmtK   = (n:number) => n>=1e6 ? `${(n/1e6).toFixed(1)}M` : n>=1e3 ? `${(n/1e3).toFixed(1)}K` : `${n}`;
const fmtDur = (m:number|null) => { if(!m) return ''; if(m>=60) return `${Math.floor(m/60)}h${m%60?` ${m%60}m`:''}`; return `${m}m`; };
const fmtXP  = (n:number) => n>=1000 ? `${(n/1000).toFixed(1)}k` : `${n}`;

// ─── LEVELS ──────────────────────────────────────────────────────────────────
const LEVELS = [
  {level:1, title:'Étoile Naissante', minXP:0,    icon:'star-outline'     as const, color:'#8A9BB8'},
  {level:2, title:'Nébuleuse',        minXP:100,  icon:'planet-outline'   as const, color:C.blue  },
  {level:3, title:'Comète',           minXP:300,  icon:'sparkles-outline' as const, color:C.cyan  },
  {level:4, title:'Astronaute',       minXP:600,  icon:'rocket-outline'   as const, color:C.green },
  {level:5, title:'Étoile Filante',   minXP:1000, icon:'flash-outline'    as const, color:C.gold  },
  {level:6, title:'Supernova',        minXP:1800, icon:'nuclear-outline'  as const, color:C.orange},
  {level:7, title:'Trou Noir',        minXP:3000, icon:'infinite-outline' as const, color:C.purple},
  {level:8, title:'Cosmos Keeper',    minXP:5000, icon:'planet-outline'   as const, color:C.gold  },
] as const;
type Level = typeof LEVELS[number];

// ─── BADGE CONFIG ─────────────────────────────────────────────────────────────
const BADGE_XP: Record<string,number> = {
  first_watch:20, night_owl:50, original:120, social:80,
  streak_3:75,    explorer:200, nugget:150,   critique:250,
  cinephile:500,  creator:400,
};
const BADGES = [
  {id:'first_watch', icon:'play-circle-outline' as const, label:'Premier Film',     desc:'Visionner votre premier reel',    xp:50,  color:C.blue  },
  {id:'streak_3',    icon:'flame-outline'        as const, label:'Flamme ×3',       desc:'3 connexions consécutives',       xp:75,  color:C.orange},
  {id:'explorer',    icon:'compass-outline'      as const, label:'Explorateur',     desc:'Explorer 10 genres',              xp:100, color:C.cyan  },
  {id:'cinephile',   icon:'film-outline'         as const, label:'Cinéphile',       desc:'Visionner 50 films',              xp:200, color:C.purple},
  {id:'nugget',      icon:'diamond-outline'      as const, label:'Chasseur Pépites',desc:'Découvrir 5 pépites',             xp:150, color:C.gold  },
  {id:'night_owl',   icon:'moon-outline'         as const, label:'Hibou Cosmique',  desc:'Actif après 23h',                 xp:60,  color:C.blue  },
  {id:'original',    icon:'star-outline'         as const, label:'Insider',          desc:'3 Originaux Universe vus',        xp:120, color:C.gold  },
  {id:'social',      icon:'planet-outline'       as const, label:'Ambassadeur',     desc:'Partager 3 films',                xp:80,  color:C.green },
  {id:'critique',    icon:'create-outline'       as const, label:'Critique',         desc:'Publier 5 critiques',             xp:100, color:C.purple},
  {id:'creator',     icon:'videocam-outline'     as const, label:'Créateur',         desc:'Uploader une vidéo',              xp:150, color:C.cyan  },
];

// ─── DAILY CHALLENGES ─────────────────────────────────────────────────────────
const DAILY = [
  {id:'d1', icon:'play-circle-outline' as const, title:'Sniper du Soir',  desc:'Regarder un court métrage jusqu\'à la fin', xp:40, progress:0, total:1, color:C.blue  },
  {id:'d2', icon:'compass-outline'     as const, title:'Voyage Cosmique', desc:'Explorer 3 catégories différentes',          xp:60, progress:0, total:3, color:C.purple},
  {id:'d3', icon:'diamond-outline'     as const, title:'Pépite Hunter',   desc:'Découvrir une pépite cachée',                xp:50, progress:0, total:1, color:C.gold  },
];

// 6 jeux Galaxy
const GAMES_META = [
  {id:'oracle', icon:'planet-outline'    as const, title:'Oracle Cosmique',  desc:'Quiz galaxie · App · Cinéma',     color:C.purple, dur:'3 min', xp:300},
  {id:'warp',   icon:'rocket-outline'    as const, title:'Warp Swipe',       desc:'Films à warp speed · Combos',     color:C.cyan,   dur:'4 min', xp:250},
  {id:'map',    icon:'star-outline'      as const, title:'Carte Stellaire',  desc:'Mémorisez les constellations',    color:C.blue,   dur:'3 min', xp:280},
  {id:'vision', icon:'sparkles-outline' as const, title:'Vision Directeur', desc:'3 films → devinez le réalisateur', color:C.green,  dur:'2 min', xp:200},
  {id:'nova',   icon:'flash-outline'    as const, title:'Nova Hunter',      desc:'Capturez les films avant l\'explosion', color:C.orange, dur:'2 min', xp:220},
  {id:'chain',  icon:'infinite-outline' as const, title:'Galaxy Chain',     desc:'Brisez votre record de chaîne',   color:C.gold,   dur:'∞',     xp:500},
] as const;
type GameId = typeof GAMES_META[number]['id'];

// Actions XP (pour les interactions universe)
const ACTIONS = {
  LIKE_WORK:        {xp:10,  label:'Liker une œuvre',         icon:'heart-outline'       as const, color:C.red   },
  WATCH_FILM:       {xp:20,  label:'Film visionné',            icon:'play-circle-outline' as const, color:C.blue  },
  WRITE_CRITIQUE:   {xp:50,  label:'Critique publiée',         icon:'create-outline'      as const, color:C.purple},
  CREATE_VIDEO:     {xp:80,  label:'Vidéo uploadée',           icon:'videocam-outline'    as const, color:C.cyan  },
  COMPLETE_PROFILE: {xp:100, label:'Profil complété',          icon:'person-outline'      as const, color:C.green },
  COMMENT:          {xp:15,  label:'Commenter une critique',   icon:'chatbubble-outline'  as const, color:C.blue  },
  SHARE_FILM:       {xp:25,  label:'Partager un film',         icon:'share-outline'       as const, color:C.gold  },
  CONNECT_PRO:      {xp:40,  label:'Contacter un professionnel',icon:'briefcase-outline'  as const, color:C.orange},
} as const;
type ActionKey = keyof typeof ACTIONS;

const BADGE_SECTIONS = [
  {label:'Galaxie XP',  icon:'planet-outline'         as const, phraseIdx:0},
  {label:'Cosmos',      icon:'infinite-outline'        as const, phraseIdx:1},
  {label:'6 Jeux',      icon:'game-controller-outline' as const, phraseIdx:2},
  {label:'Badges',      icon:'ribbon-outline'          as const, phraseIdx:3},
  {label:'Classement',  icon:'podium-outline'          as const, phraseIdx:4},
];
const PHRASES = [
  "L'XP ne ment pas — joue et monte.",
  "Chaque film élargi ton cosmos.",
  "6 jeux — XP garanti à la fin.",
  "Gagne de l'XP pour débloquer.",
  "Ta place dans le cosmos t'attend.",
];

// ─── XP STORE ────────────────────────────────────────────────────────────────
function useXPStore() {
  const [xp, setXp]         = useState(0);
  const [streak, setStreak]  = useState(0);
  const [todayXP, setToday]  = useState(0);
  const [weekXP, setWeek]    = useState(0);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [freshBadge, setFresh]  = useState<string|null>(null);
  const [log, setLog]           = useState<{label:string;xp:number;icon:string;color:string}[]>([]);

  const lv = useMemo(() => {
    let l: Level = LEVELS[0];
    for (const v of LEVELS) { if (xp >= v.minXP) l = v; else break; }
    return l;
  }, [xp]);
  const nextLv = useMemo(() => {
    const i = LEVELS.findIndex(l => l.level === lv.level);
    return LEVELS[i+1] ?? null;
  }, [lv]);
  const prog = useMemo(() => {
    if (!nextLv) return 1;
    return Math.min((xp - lv.minXP) / (nextLv.minXP - lv.minXP), 1);
  }, [xp, lv, nextLv]);

  // Auto-unlock badges quand seuil XP atteint
  useEffect(() => {
    const news = Object.entries(BADGE_XP)
      .filter(([id, thr]) => xp >= thr && !unlocked.includes(id))
      .map(([id]) => id);
    if (news.length) {
      setUnlocked(p => [...new Set([...p, ...news])]);
      setFresh(news[news.length - 1]);
    }
  }, [xp]);

  const addXP = useCallback((n: number, key?: ActionKey) => {
    setXp(p => p + n);
    setToday(p => p + n);
    setWeek(p => p + n);
    if (key) {
      const a = ACTIONS[key];
      setLog(p => [{ label: a.label, xp: n, icon: a.icon, color: a.color }, ...p].slice(0, 5));
    }
  }, []);

  return { xp, streak, todayXP, weekXP, lv, nextLv, prog, unlocked,
           freshBadge, clearFresh: () => setFresh(null), log, addXP };
}

// ─── ATOMS ───────────────────────────────────────────────────────────────────
const Shimmer = memo(({ w, h, r=8 }: { w: number|string; h: number; r?: number }) => {
  const op = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(op, {toValue:0.38, duration:900, useNativeDriver:true}),
      Animated.timing(op, {toValue:0.18, duration:900, useNativeDriver:true}),
    ]));
    a.start(); return () => a.stop();
  }, []);
  return <Animated.View style={{ width:w as any, height:h, borderRadius:r, backgroundColor:C.navyMid, opacity:op }}/>;
});

const XPBurst = memo(({ v, n, done }: { v: boolean; n: number; done: () => void }) => {
  const sc = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!v) return;
    sc.setValue(0); op.setValue(1); ty.setValue(0);
    Animated.parallel([
      Animated.spring(sc, { toValue:1, tension:200, friction:8, useNativeDriver:true }),
      Animated.timing(ty, { toValue:-72, duration:950, useNativeDriver:true }),
      Animated.sequence([Animated.delay(420), Animated.timing(op, { toValue:0, duration:530, useNativeDriver:true })]),
    ]).start(done);
  }, [v]);
  if (!v) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems:'center', justifyContent:'center', zIndex:9999 }]}>
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

const BadgeToast = memo(({ id, v, done }: { id: string|null; v: boolean; done: () => void }) => {
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
  const col = badge.color;
  return (
    <Animated.View style={{ position:'absolute', top:0, left:14, right:14, zIndex:9999,
      transform:[{translateY:ty}], borderRadius:16, overflow:'hidden',
      flexDirection:'row', alignItems:'center', gap:13, padding:14,
      backgroundColor:`${col}14`, borderWidth:1, borderColor:`${col}50` }}>
      <BlurView intensity={Platform.OS==='ios'?28:14} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={{ width:46, height:46, borderRadius:13,
        backgroundColor:`${col}22`, borderWidth:1, borderColor:`${col}44`,
        alignItems:'center', justifyContent:'center' }}>
        <Ionicons name={badge.icon} size={22} color={col}/>
      </View>
      <View style={{ flex:1 }}>
        <Text style={{ color:col, fontSize:9, fontWeight:'900', letterSpacing:1.2 }}>BADGE DÉBLOQUÉ</Text>
        <Text style={{ color:C.white, fontSize:15, fontWeight:'900' }}>{badge.label}</Text>
        <Text style={{ color:C.muted, fontSize:11 }}>{badge.desc}</Text>
      </View>
      <View style={{ alignItems:'center', gap:2 }}>
        <Ionicons name="flash" size={11} color={C.gold}/>
        <Text style={{ color:C.gold, fontSize:12, fontWeight:'900' }}>+{badge.xp}</Text>
      </View>
    </Animated.View>
  );
});

const XPBar = memo(({ lv, nextLv, prog, xp }: { lv:Level; nextLv:Level|null; prog:number; xp:number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue:prog, duration:1200, useNativeDriver:false, easing:Easing.out(Easing.exp) }).start();
  }, [prog]);
  const col = lv.color;
  return (
    <View style={{ paddingHorizontal:E, marginBottom:18 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <View style={{ width:46, height:46, borderRadius:23,
            backgroundColor:`${col}22`, borderWidth:1.5, borderColor:`${col}55`,
            alignItems:'center', justifyContent:'center' }}>
            <Ionicons name={lv.icon} size={20} color={col}/>
          </View>
          <View>
            <Text style={{ color:C.white, fontSize:14, fontWeight:'800' }}>{lv.title}</Text>
            <Text style={{ color:C.muted, fontSize:10 }}>Niveau {lv.level}</Text>
          </View>
        </View>
        <View style={{ alignItems:'flex-end' }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="flash" size={12} color={C.gold}/>
            <Text style={{ color:C.gold, fontSize:17, fontWeight:'900' }}>{xp.toLocaleString()}</Text>
          </View>
          {nextLv && <Text style={{ color:C.muted, fontSize:10 }}>→ {nextLv.minXP.toLocaleString()} XP</Text>}
        </View>
      </View>
      <View style={{ height:6, backgroundColor:C.subtle, borderRadius:3, overflow:'hidden' }}>
        <Animated.View style={{ height:'100%', borderRadius:3, backgroundColor:col,
          width:anim.interpolate({inputRange:[0,1], outputRange:['0%','100%']}) }}/>
      </View>
    </View>
  );
});

const StreakBubble = memo(({ streak }: { streak: number }) => {
  const sc = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(sc, { toValue:1.07, duration:900, useNativeDriver:true, easing:Easing.inOut(Easing.ease) }),
      Animated.timing(sc, { toValue:1,    duration:900, useNativeDriver:true, easing:Easing.inOut(Easing.ease) }),
    ]));
    l.start(); return () => l.stop();
  }, []);
  const col = streak > 0 ? C.orange : '#555E70';
  return (
    <Animated.View style={{ transform:[{scale:sc}] }}>
      <LinearGradient
        colors={streak>0 ? ['rgba(255,140,66,0.24)','rgba(255,92,114,0.14)'] : ['rgba(255,255,255,0.05)','rgba(255,255,255,0.03)']}
        style={{ borderRadius:16, paddingHorizontal:14, paddingVertical:10,
          alignItems:'center', borderWidth:1,
          borderColor:streak>0 ? `${col}45` : C.border }}>
        <Ionicons name="flame" size={22} color={col}/>
        <Text style={{ color:col, fontSize:18, fontWeight:'900', marginTop:2 }}>{streak}</Text>
        <Text style={{ color:C.muted, fontSize:9, fontWeight:'700' }}>JOURS</Text>
      </LinearGradient>
    </Animated.View>
  );
});

const BadgeCard = memo(({ badge, unlocked }: { badge: typeof BADGES[number]; unlocked: boolean }) => {
  const sc = useRef(new Animated.Value(1)).current;
  const [open, setOpen] = useState(false);
  const thr = BADGE_XP[badge.id] ?? 999;
  const press = () => {
    Animated.sequence([
      Animated.timing(sc, { toValue:0.91, duration:80, useNativeDriver:true }),
      Animated.spring(sc, { toValue:1, tension:300, friction:8, useNativeDriver:true }),
    ]).start();
    setOpen(o => !o);
  };
  const col = badge.color;
  return (
    <TouchableOpacity onPress={press} activeOpacity={0.9} style={{ width:(SW - E*2 - 12)/2 }}>
      <Animated.View style={{ transform:[{scale:sc}], borderRadius:16, overflow:'hidden',
        borderWidth:1, borderColor:unlocked ? `${col}50` : C.border, marginBottom:10 }}>
        <LinearGradient
          colors={unlocked ? [`${col}18`,`${col}08`,'rgba(7,12,23,0.95)'] : ['rgba(13,32,64,0.6)','rgba(7,12,23,0.95)']}
          style={{ padding:16, flexDirection:'row', alignItems:'center', gap:11 }}>
          <View style={{ width:44, height:44, borderRadius:22,
            backgroundColor:unlocked ? `${col}25` : C.faint,
            borderWidth:1, borderColor:unlocked ? `${col}50` : C.border,
            alignItems:'center', justifyContent:'center' }}>
            <Ionicons name={badge.icon} size={20} color={unlocked ? col : C.muted}/>
          </View>
          <View style={{ flex:1 }}>
            <Text style={{ color:unlocked ? C.white : C.muted, fontSize:12, fontWeight:'800' }}>{badge.label}</Text>
            <Text style={{ color:C.muted, fontSize:10, marginTop:2 }} numberOfLines={open ? undefined : 1}>{badge.desc}</Text>
            {unlocked
              ? <View style={{ flexDirection:'row', alignItems:'center', gap:3, marginTop:4 }}>
                  <Ionicons name="checkmark-circle" size={10} color={C.green}/>
                  <Text style={{ color:C.gold, fontSize:10, fontWeight:'700' }}>+{badge.xp} XP</Text>
                </View>
              : <Text style={{ color:C.muted, fontSize:9, marginTop:3 }}>Seuil : {thr} XP</Text>}
          </View>
          {unlocked
            ? <View style={{ width:16, height:16, borderRadius:8, backgroundColor:C.green,
                alignItems:'center', justifyContent:'center' }}>
                <Ionicons name="checkmark" size={10} color={C.white}/>
              </View>
            : <Ionicons name="lock-closed-outline" size={12} color={C.muted}/>}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

const DailyRow = memo(({ ch, claimed, onClaim }: {
  ch: typeof DAILY[number]; claimed: boolean; onClaim: () => void;
}) => {
  const p = ch.progress / ch.total;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue:p, duration:800, useNativeDriver:false, easing:Easing.out(Easing.cubic) }).start();
  }, [p]);
  return (
    <View style={{ marginBottom:10, borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:C.border }}>
      <LinearGradient colors={['rgba(13,32,64,0.82)','rgba(7,12,23,0.94)']}
        style={{ padding:14, flexDirection:'row', alignItems:'center', gap:12 }}>
        <View style={{ width:40, height:40, borderRadius:12,
          backgroundColor:`${ch.color}18`, borderWidth:1, borderColor:`${ch.color}35`,
          alignItems:'center', justifyContent:'center' }}>
          <Ionicons name={ch.icon} size={18} color={ch.color}/>
        </View>
        <View style={{ flex:1 }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <Text style={{ color:C.white, fontSize:13, fontWeight:'800' }}>{ch.title}</Text>
            <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
              <Ionicons name="flash" size={9} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:11, fontWeight:'700' }}>+{ch.xp} XP</Text>
            </View>
          </View>
          <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{ch.desc}</Text>
          <View style={{ marginTop:7, height:4, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden' }}>
            <Animated.View style={{ height:'100%', borderRadius:2,
              backgroundColor:p>=1 ? C.green : ch.color,
              width:anim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }}/>
          </View>
          <Text style={{ color:C.muted, fontSize:10, marginTop:3 }}>{ch.progress}/{ch.total}</Text>
        </View>
        {p >= 1 && !claimed &&
          <TouchableOpacity onPress={() => { hS(); onClaim(); }}
            style={{ backgroundColor:C.gold, borderRadius:10, paddingHorizontal:12, paddingVertical:6 }}>
            <Text style={{ color:'#040810', fontSize:11, fontWeight:'900' }}>CLAIM</Text>
          </TouchableOpacity>}
        {claimed &&
          <View style={{ width:28, height:28, borderRadius:14, backgroundColor:C.greenFaint,
            borderWidth:1, borderColor:C.green, alignItems:'center', justifyContent:'center' }}>
            <Ionicons name="checkmark" size={14} color={C.green}/>
          </View>}
      </LinearGradient>
    </View>
  );
});

const GameCard = memo(({ gm, onPlay }: { gm: typeof GAMES_META[number]; onPlay: () => void }) => {
  const sc = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(sc, { toValue:0.94, duration:80, useNativeDriver:true }),
      Animated.spring(sc, { toValue:1, tension:300, friction:8, useNativeDriver:true }),
    ]).start(() => { hM(); onPlay(); });
  };
  const col = gm.color;
  return (
    <TouchableOpacity onPress={press} activeOpacity={1} style={{ width:(SW-E*2-12)/2, marginBottom:12 }}>
      <Animated.View style={{ transform:[{scale:sc}], borderRadius:18, overflow:'hidden',
        borderWidth:1, borderColor:`${col}35` }}>
        <LinearGradient colors={[`${col}22`,'rgba(7,12,23,0.96)']}
          style={{ padding:18, alignItems:'center', gap:10, minHeight:128 }}>
          <View style={{ width:54, height:54, borderRadius:27,
            backgroundColor:`${col}25`, borderWidth:1.5, borderColor:`${col}55`,
            alignItems:'center', justifyContent:'center' }}>
            <Ionicons name={gm.icon} size={24} color={col}/>
          </View>
          <Text style={{ color:C.white, fontSize:13, fontWeight:'800', textAlign:'center' }}>{gm.title}</Text>
          <Text style={{ color:C.muted, fontSize:10, textAlign:'center' }} numberOfLines={2}>{gm.desc}</Text>
          <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
            <View style={{ backgroundColor:`${col}22`, borderRadius:8, paddingHorizontal:8, paddingVertical:3 }}>
              <Text style={{ color:col, fontSize:9, fontWeight:'700' }}>{gm.dur}</Text>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center', gap:3,
              backgroundColor:C.goldFaint, borderRadius:8, paddingHorizontal:8, paddingVertical:3 }}>
              <Ionicons name="flash" size={9} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:9, fontWeight:'700' }}>≤{gm.xp} XP</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

const ActionRow = memo(({ aKey, onPress }: { aKey: ActionKey; onPress: () => void }) => {
  const a = ACTIONS[aKey];
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82}
      style={{ flexDirection:'row', alignItems:'center', gap:12,
        paddingVertical:11, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border }}>
      <View style={{ width:38, height:38, borderRadius:11,
        backgroundColor:`${a.color}18`, borderWidth:1, borderColor:`${a.color}35`,
        alignItems:'center', justifyContent:'center' }}>
        <Ionicons name={a.icon as any} size={16} color={a.color}/>
      </View>
      <View style={{ flex:1 }}>
        <Text style={{ color:C.white, fontSize:13, fontWeight:'600' }}>{a.label}</Text>
        <Text style={{ color:C.muted, fontSize:10 }}>XP crédité à la complétion</Text>
      </View>
      <View style={{ flexDirection:'row', alignItems:'center', gap:3,
        paddingHorizontal:9, paddingVertical:4, borderRadius:9,
        backgroundColor:C.goldFaint, borderWidth:StyleSheet.hairlineWidth,
        borderColor:'rgba(245,200,66,0.25)' }}>
        <Ionicons name="flash" size={9} color={C.gold}/>
        <Text style={{ color:C.gold, fontSize:11, fontWeight:'800' }}>+{a.xp}</Text>
      </View>
    </TouchableOpacity>
  );
});

// Done screen shared between all games
const GameDone = memo(({ col, icon, title, score, sub, onClose }:{
  col:string; icon:string; title:string; score:number; sub:string; onClose:()=>void;
}) => {
  const sc = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(sc, { toValue:1, tension:80, friction:8, useNativeDriver:true }),
      Animated.timing(op, { toValue:1, duration:600, useNativeDriver:true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:32, gap:14, opacity:op }}>
      <Animated.View style={{ transform:[{scale:sc}], width:90, height:90, borderRadius:45,
        backgroundColor:`${col}18`, borderWidth:2, borderColor:`${col}55`,
        alignItems:'center', justifyContent:'center' }}>
        <Ionicons name={icon as any} size={44} color={col}/>
      </Animated.View>
      <Text style={{ color:C.white, fontSize:28, fontWeight:'900' }}>{title}</Text>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
        <Ionicons name="flash" size={24} color={C.gold}/>
        <Text style={{ color:C.gold, fontSize:52, fontWeight:'900' }}>{score}</Text>
      </View>
      <Text style={{ color:C.muted, fontSize:13, textAlign:'center' }}>{sub}</Text>
      <TouchableOpacity onPress={onClose}
        style={{ marginTop:8, backgroundColor:col, borderRadius:16,
          paddingHorizontal:36, paddingVertical:15, flexDirection:'row', alignItems:'center', gap:8 }}>
        <Ionicons name="planet-outline" size={17} color={col === C.gold ? '#040810' : C.white}/>
        <Text style={{ color:col === C.gold ? '#040810' : C.white, fontSize:16, fontWeight:'900' }}>
          Retour à la galaxie
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// ★ 6 JEUX GALAXY — ULTRA SOPHISTIQUÉS
// XP attribués UNIQUEMENT au done screen via onXP(score)
// ══════════════════════════════════════════════════════════════════════════════

// Questions Oracle — app features + cinéphile culture (maximise discovery)
const Q_ORACLE = [
  {q:"Où trouver les films peu connus sur Universe ?",     opts:["Populaires","Pépites","Originaux","Récents"],         ans:1, xp:25, tag:"App"},
  {q:"Que représente l'icône ✦ sur une fiche film ?",     opts:["Film noté","Original Universe","Pépite","Populaire"], ans:1, xp:25, tag:"App"},
  {q:"Quelle action rapporte le plus d'XP ?",             opts:["Liker","Regarder","Créer une vidéo","Commenter"],     ans:2, xp:30, tag:"XP"},
  {q:"Comment débloquer le badge 'Chasseur Pépites' ?",   opts:["50 likes","Découvrir 5 pépites","5 critiques","3 partages"], ans:1, xp:30, tag:"Badge"},
  {q:"Qu'est-ce qu'un 'court métrage' ?",                 opts:["Film <10min","Film <60min","Film animé","Docu"],       ans:1, xp:20, tag:"Cinéma"},
  {q:"Comment écrire une critique sur Universe ?",         opts:["Accueil","Profil","Onglet Social","Paramètres"],      ans:2, xp:25, tag:"App"},
  {q:"Quel badge nécessite 500 XP ?",                     opts:["Explorateur","Cinéphile","Insider","Critique"],       ans:1, xp:35, tag:"Badge"},
  {q:"Que signifie XP dans la gamification Universe ?",   opts:["Extra Points","Expérience","eXtra Power","eXplorer"], ans:1, xp:20, tag:"XP"},
  {q:"Quelle section regroupe les créations exclusives ?",opts:["Récents","Pépites","Originaux","Populaires"],         ans:2, xp:25, tag:"App"},
  {q:"Combien de jours de streak pour le badge Flamme ?", opts:["1 jour","3 jours","7 jours","10 jours"],              ans:1, xp:30, tag:"Badge"},
  {q:"Quelle durée définit un moyen métrage ?",           opts:["10-30min","30-60min","60-100min","100min+"],           ans:2, xp:25, tag:"Cinéma"},
  {q:"Comment contacter un professionnel du cinéma ?",    opts:["DM","Onglet Pro","Email","Profil"],                   ans:1, xp:30, tag:"App"},
];

// ★★★ GAME 1 — ORACLE COSMIQUE (Quiz avec starfield animé + combo)
const OracleGame = memo(({ onXP, onClose }: { onXP:(n:number)=>void; onClose:()=>void }) => {
  const [qi, setQi]       = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [sel, setSel]     = useState<number|null>(null);
  const [phase, setPhase] = useState<'q'|'r'|'done'>('q');
  const [timer, setTimer] = useState(30);
  const timerRef          = useRef<any>(null);
  const fade              = useRef(new Animated.Value(0)).current;
  const stars             = useRef(Array.from({length:12}, (_,i)=>({
    x: useRef(new Animated.Value(Math.random()*SW)).current,
    y: useRef(new Animated.Value(Math.random()*200)).current,
    op: useRef(new Animated.Value(Math.random())).current,
  }))).current;

  // Twinkling stars background
  useEffect(() => {
    stars.forEach((s,i) => {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(s.op, {toValue:0.7+Math.random()*0.3, duration:600+i*100, useNativeDriver:true}),
        Animated.timing(s.op, {toValue:0.1, duration:600+i*100, useNativeDriver:true}),
      ]));
      loop.start();
    });
  }, []);

  useEffect(() => {
    if (phase !== 'q') return;
    setTimer(30);
    fade.setValue(0);
    Animated.timing(fade, {toValue:1, duration:350, useNativeDriver:true}).start();
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); answer(-1); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [qi, phase]);

  const q = Q_ORACLE[qi % Q_ORACLE.length];

  const answer = (idx: number) => {
    clearInterval(timerRef.current);
    setSel(idx);
    setPhase('r');
    if (idx === q.ans) {
      const pts = q.xp + Math.ceil(timer * 1.5) + combo * 20;
      setScore(s => s + pts);
      setCombo(c => c + 1);
    } else {
      setCombo(0);
    }
  };

  const next = () => {
    if (qi >= 9) { onXP(score); setPhase('done'); return; }
    setQi(i => i+1); setSel(null); setPhase('q');
  };

  const tagColor: Record<string,string> = { App:C.blue, XP:C.gold, Badge:C.purple, Cinéma:C.cyan };

  if (phase === 'done') return <GameDone col={C.purple} icon="planet-outline" title="Oracle terminé !" score={score} sub={`${combo} réponses correctes · XP ajoutés`} onClose={onClose}/>;

  return (
    <Animated.View style={{ flex:1, opacity:fade }}>
      {/* Starfield */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {stars.map((s,i) => (
          <Animated.View key={i} style={{
            position:'absolute', left:s.x, top:s.y,
            width:2, height:2, borderRadius:1, backgroundColor:C.white, opacity:s.op }}/>
        ))}
      </View>
      <View style={{ flex:1, padding:20 }}>
        {/* HUD */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <View style={{ flexDirection:'row', gap:5 }}>
            {Array.from({length:10}).map((_,i) => (
              <View key={i} style={{ width:22, height:4, borderRadius:2,
                backgroundColor:i<qi ? C.purple : i===qi ? C.purple : C.subtle,
                opacity:i<qi ? 1 : i===qi ? 1 : 0.4 }}/>
            ))}
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            {combo > 1 && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:3,
                backgroundColor:`${C.purple}22`, borderRadius:8, paddingHorizontal:8, paddingVertical:3 }}>
                <Text style={{ color:C.purple, fontSize:11, fontWeight:'900' }}>×{combo}</Text>
              </View>
            )}
            <View style={{ width:38, height:38, borderRadius:19, backgroundColor:C.subtle,
              alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:timer<=10?C.red:C.cyan, fontSize:14, fontWeight:'900' }}>{timer}</Text>
            </View>
          </View>
        </View>
        {/* Timer ring */}
        <View style={{ height:3, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden', marginBottom:20 }}>
          <View style={{ height:'100%', borderRadius:2,
            width:`${(timer/30)*100}%` as any,
            backgroundColor:timer<=10 ? C.red : C.cyan }}/>
        </View>
        {/* Tag + Question */}
        <View style={{ backgroundColor:`${tagColor[q.tag]??C.blue}15`,
          borderRadius:16, padding:20, borderWidth:1, borderColor:`${tagColor[q.tag]??C.blue}30`,
          marginBottom:20, minHeight:90, justifyContent:'center', gap:8 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <View style={{ backgroundColor:`${tagColor[q.tag]??C.blue}25`,
              borderRadius:6, paddingHorizontal:8, paddingVertical:3 }}>
              <Text style={{ color:tagColor[q.tag]??C.blue, fontSize:9, fontWeight:'900', letterSpacing:0.8 }}>{q.tag.toUpperCase()}</Text>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
              <Ionicons name="flash" size={9} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:9, fontWeight:'700' }}>+{q.xp}+ XP</Text>
            </View>
          </View>
          <Text style={{ color:C.white, fontSize:16, fontWeight:'700', lineHeight:24 }}>{q.q}</Text>
        </View>
        {/* Options */}
        <View style={{ gap:10 }}>
          {q.opts.map((opt, i) => {
            let bg = C.faint, border = C.border, tc: string = C.white;
            if (phase==='r' && i===q.ans)   { bg=C.greenFaint;                    border=C.green;  tc=C.green; }
            if (phase==='r' && i===sel && i!==q.ans) { bg='rgba(255,92,114,0.10)'; border=C.red; tc=C.red; }
            return (
              <TouchableOpacity key={i} onPress={() => answer(i)} disabled={phase==='r'}
                style={{ backgroundColor:bg, borderRadius:13, padding:15, borderWidth:1, borderColor:border,
                  flexDirection:'row', alignItems:'center', gap:10 }}>
                <View style={{ width:26, height:26, borderRadius:13,
                  backgroundColor:`${border}22`, borderWidth:1, borderColor:border,
                  alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ color:tc, fontSize:11, fontWeight:'900' }}>{['A','B','C','D'][i]}</Text>
                </View>
                <Text style={{ color:tc, fontSize:13, fontWeight:'600', flex:1 }}>{opt}</Text>
                {phase==='r' && i===q.ans && <Ionicons name="checkmark-circle" size={18} color={C.green}/>}
                {phase==='r' && i===sel && i!==q.ans && <Ionicons name="close-circle" size={18} color={C.red}/>}
              </TouchableOpacity>
            );
          })}
        </View>
        {phase==='r' && (
          <TouchableOpacity onPress={next}
            style={{ marginTop:16, backgroundColor:C.purple, borderRadius:14,
              padding:15, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 }}>
            <Text style={{ color:C.white, fontSize:14, fontWeight:'900' }}>{qi<9?'Suivant →':'Résultats'}</Text>
            <Ionicons name="arrow-forward-circle" size={18} color={C.white}/>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
});

// ★★★ GAME 2 — WARP SWIPE (films à warp speed + trail effect + combo)
const WarpSwipe = memo(({ works, onXP, onClose }: { works:Work[]; onXP:(n:number)=>void; onClose:()=>void }) => {
  const pool  = useMemo(() => works.slice(0, 20), [works]);
  const [idx, setIdx]     = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [done, setDone]   = useState(false);
  const tx = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0.8)).current; // zoom-in from distance effect
  const current = pool[idx];

  useEffect(() => {
    // Each new card "warps in" from distance
    sc.setValue(0.72);
    Animated.spring(sc, { toValue:1, tension:120, friction:9, useNativeDriver:true }).start();
  }, [idx]);

  const rot  = tx.interpolate({ inputRange:[-160,0,160], outputRange:['-18deg','0deg','18deg'] });
  const liOp = tx.interpolate({ inputRange:[0,60], outputRange:[0,1], extrapolate:'clamp' });
  const paOp = tx.interpolate({ inputRange:[-60,0], outputRange:[1,0], extrapolate:'clamp' });

  const pr = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => tx.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 110) {
        const liked = g.dx > 0;
        Animated.timing(tx, { toValue:liked?480:-480, duration:200, useNativeDriver:true }).start(() => {
          let s = score;
          if (liked) { const pts = 20*(combo+1); s += pts; setScore(s); setCombo(c => c+1); hL(); }
          else        setCombo(0);
          const last = idx >= Math.min(pool.length-1, 14);
          if (last) { onXP(s); setDone(true); }
          else       { tx.setValue(0); setIdx(i => i+1); }
        });
      } else {
        Animated.spring(tx, { toValue:0, useNativeDriver:true }).start();
      }
    },
  }), [idx, combo, pool.length, score]);

  if (!current || done) return <GameDone col={C.cyan} icon="rocket-outline" title="Warp terminé !" score={score} sub={`${combo} combo max · Films explorés`} onClose={onClose}/>;

  const uri = resolveImg(current.id, current.image);
  return (
    <View style={{ flex:1, padding:20 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:12 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <View style={{ width:28, height:28, borderRadius:14, backgroundColor:`${C.orange}22`,
            alignItems:'center', justifyContent:'center' }}>
            <Ionicons name="flame" size={14} color={C.orange}/>
          </View>
          <Text style={{ color:C.orange, fontSize:15, fontWeight:'900' }}>×{combo}</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <Ionicons name="flash" size={14} color={C.gold}/>
          <Text style={{ color:C.gold, fontSize:16, fontWeight:'900' }}>{score}</Text>
        </View>
        <Text style={{ color:C.muted, fontSize:12, alignSelf:'center' }}>{idx+1}/{Math.min(pool.length,15)}</Text>
      </View>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:14, paddingHorizontal:10 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,92,114,0.14)',
          borderRadius:10, paddingHorizontal:12, paddingVertical:6 }}>
          <Ionicons name="close-circle-outline" size={14} color={C.red}/>
          <Text style={{ color:C.red, fontSize:11, fontWeight:'700' }}>PASSE</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5, backgroundColor:C.greenFaint,
          borderRadius:10, paddingHorizontal:12, paddingVertical:6 }}>
          <Text style={{ color:C.green, fontSize:11, fontWeight:'700' }}>LIKE</Text>
          <Ionicons name="heart-circle-outline" size={14} color={C.green}/>
        </View>
      </View>
      <Animated.View {...pr.panHandlers} style={{ transform:[{translateX:tx},{rotate:rot},{scale:sc}] }}>
        <View style={{ borderRadius:22, overflow:'hidden', height:270 }}>
          <Image source={{uri}} style={StyleSheet.absoluteFillObject as any} resizeMode="cover"/>
          <LinearGradient colors={['rgba(4,8,16,0.18)','transparent','rgba(4,8,16,0.92)']}
            style={StyleSheet.absoluteFillObject}/>
          <Animated.View style={{ position:'absolute', top:18, left:18,
            backgroundColor:C.greenFaint, borderWidth:2, borderColor:C.green,
            borderRadius:12, paddingHorizontal:14, paddingVertical:7, opacity:liOp,
            flexDirection:'row', alignItems:'center', gap:6 }}>
            <Ionicons name="heart" size={16} color={C.green}/>
            <Text style={{ color:C.green, fontSize:17, fontWeight:'900' }}>+{20*(combo+1)}</Text>
          </Animated.View>
          <Animated.View style={{ position:'absolute', top:18, right:18,
            backgroundColor:'rgba(255,92,114,0.16)', borderWidth:2, borderColor:C.red,
            borderRadius:12, paddingHorizontal:14, paddingVertical:7, opacity:paOp,
            flexDirection:'row', alignItems:'center', gap:6 }}>
            <Ionicons name="close" size={16} color={C.red}/>
            <Text style={{ color:C.red, fontSize:17, fontWeight:'900' }}>PASS</Text>
          </Animated.View>
          <View style={{ position:'absolute', bottom:18, left:18, right:18, gap:4 }}>
            <Text style={{ color:C.white, fontSize:18, fontWeight:'800' }}>{current.title}</Text>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              {current.genre && <Text style={{ color:C.mid, fontSize:11 }}>{current.genre}</Text>}
              {current.year  && <Text style={{ color:C.muted, fontSize:11 }}>· {current.year}</Text>}
              {current.duration && <Text style={{ color:C.muted, fontSize:11 }}>· {fmtDur(current.duration)}</Text>}
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

// ★★★ GAME 3 — CARTE STELLAIRE (memory avec constellation theme)
const StarMap = memo(({ works, onXP, onClose }: { works:Work[]; onXP:(n:number)=>void; onClose:()=>void }) => {
  const PAIRS = 6;
  const GENRE_COLORS: Record<string,string> = {
    Drama:C.blue, Drame:C.blue, Action:C.red, Comédie:C.gold,
    Thriller:C.purple, Documentaire:C.cyan, Animation:C.green, Expérimental:C.orange,
  };
  const deck = useMemo(() => {
    const pool = works.filter(w => w.title).slice(0, PAIRS);
    const genreColor = (w: Work) => {
      const g = w.genre ?? '';
      const key = Object.keys(GENRE_COLORS).find(k => g.includes(k));
      return key ? GENRE_COLORS[key] : C.blue;
    };
    return [...pool, ...pool]
      .map((w,i) => ({ id:i, workId:w.id, title:w.title, col:genreColor(w), flipped:false, matched:false }))
      .sort(() => Math.random()-0.5);
  }, [works]);

  const [cards, setCards] = useState(deck);
  const [open, setOpen]   = useState<number[]>([]);
  const [pairs, setPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [time, setTime]   = useState(90);
  const [done, setDone]   = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setTime(t => {
      if (t <= 1) { clearInterval(timerRef.current); setDone(true); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (pairs >= PAIRS) { clearInterval(timerRef.current); const bonus=time*5; onXP(pairs*60+bonus); setDone(true); }
  }, [pairs]);

  const flip = (idx: number) => {
    const card = cards[idx];
    if (card.flipped || card.matched || open.length >= 2) return;
    hL();
    const nd = cards.map((c,i) => i===idx ? {...c,flipped:true} : c);
    setCards(nd);
    const no = [...open, idx];
    setOpen(no);
    if (no.length === 2) {
      setMoves(m => m+1);
      const [a,b] = no;
      if (nd[a].workId === nd[b].workId) {
        hS();
        setCards(c => c.map((x,i) => i===a||i===b ? {...x,matched:true} : x));
        setPairs(p => p+1);
        setOpen([]);
      } else {
        setTimeout(() => {
          setCards(c => c.map((x,i) => i===a||i===b ? {...x,flipped:false} : x));
          setOpen([]);
        }, 900);
      }
    }
  };

  if (done) {
    const bonus = time*5;
    return <GameDone col={C.blue} icon="star-outline" title={pairs>=PAIRS?'Galaxie complète !':'Temps écoulé'} score={pairs*60+bonus} sub={`${pairs}/${PAIRS} paires · ${moves} essais`} onClose={onClose}/>;
  }
  const cW = (SW - E*2 - 48) / 4;
  return (
    <View style={{ flex:1, padding:16 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
          <Ionicons name="time-outline" size={13} color={time<=20?C.red:C.cyan}/>
          <Text style={{ color:time<=20?C.red:C.cyan, fontSize:15, fontWeight:'900' }}>{time}s</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
          <Ionicons name="star-outline" size={13} color={C.mid}/>
          <Text style={{ color:C.mid, fontSize:12 }}>{pairs}/{PAIRS}</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <Ionicons name="flash" size={13} color={C.gold}/>
          <Text style={{ color:C.gold, fontSize:13, fontWeight:'800' }}>{pairs*60}</Text>
        </View>
      </View>
      <View style={{ height:3, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden', marginBottom:16 }}>
        <View style={{ height:'100%', borderRadius:2, backgroundColor:time<=20?C.red:C.blue,
          width:`${(time/90)*100}%` as any }}/>
      </View>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
        {cards.map((card,i) => (
          <TouchableOpacity key={card.id} onPress={() => flip(i)} activeOpacity={0.88}
            style={{ width:cW, aspectRatio:0.72 }}>
            <LinearGradient
              colors={card.matched ? [`${card.col}30`,'rgba(7,12,23,0.88)'] : card.flipped ? [`${card.col}22`,'rgba(7,12,23,0.9)'] : ['rgba(13,32,64,0.85)','rgba(4,8,16,0.95)']}
              style={{ flex:1, borderRadius:10, borderWidth:1,
                borderColor:card.matched ? `${card.col}55` : card.flipped ? `${card.col}40` : C.border,
                alignItems:'center', justifyContent:'center', padding:6 }}>
              {(card.flipped || card.matched)
                ? <>
                    <View style={{ width:14, height:14, borderRadius:7, backgroundColor:card.col, marginBottom:4 }}/>
                    <Text style={{ color:card.matched?card.col:C.white, fontSize:9, fontWeight:'700',
                      textAlign:'center', lineHeight:13 }} numberOfLines={3}>{card.title}</Text>
                  </>
                : <Ionicons name="planet-outline" size={20} color={C.muted}/>}
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

// ★★★ GAME 4 — VISION DIRECTEUR (guess director, cinematic reveal)
const DirectorVision = memo(({ works, onXP, onClose }: { works:Work[]; onXP:(n:number)=>void; onClose:()=>void }) => {
  const byDir = useMemo(() =>
    works.filter(w => w.director)
      .reduce<Record<string,Work[]>>((acc,w) => { acc[w.director!] ??= []; acc[w.director!].push(w); return acc; }, {}),
    [works]);
  const dirs = useMemo(() => Object.keys(byDir).filter(d => byDir[d].length >= 2), [byDir]);

  const [round, setRound]   = useState(0);
  const [score, setScore]   = useState(0);
  const [sel, setSel]       = useState<string|null>(null);
  const [phase, setPhase]   = useState<'q'|'r'|'done'>('q');
  const [reveal, setReveal] = useState(0); // 0=1 film, 1=2 films, 2=3 films
  const revAnim = useRef(new Animated.Value(0)).current;

  const dir = useMemo(() => dirs[round % Math.max(1,dirs.length)] ?? null, [round,dirs]);
  const films = useMemo(() => dir ? (byDir[dir]??[]).slice(0,3) : [], [dir,byDir]);
  const choices = useMemo(() => {
    if (!dir) return [];
    return [...dirs.filter(d => d!==dir).sort(()=>Math.random()-0.5).slice(0,3), dir].sort(()=>Math.random()-0.5);
  }, [dir,dirs]);

  useEffect(() => {
    revAnim.setValue(0);
    Animated.timing(revAnim, { toValue:1, duration:500, useNativeDriver:true }).start();
    setReveal(0);
  }, [round]);

  const addClue = () => {
    if (reveal < 2) {
      revAnim.setValue(0);
      Animated.timing(revAnim, {toValue:1, duration:400, useNativeDriver:true}).start();
      setReveal(r => r+1);
    }
  };

  const answer = (d: string) => {
    if (phase!=='q') return;
    setSel(d); setPhase('r');
    const pts = d===dir ? [120,80,40][reveal]??20 : 0;
    setScore(s => s+pts);
  };

  const next = () => {
    if (round >= 4) { onXP(score); setPhase('done'); return; }
    setRound(r=>r+1); setSel(null); setPhase('q');
  };

  if (!dirs.length) return <GameDone col={C.green} icon="person-circle-outline" title="Pas assez de données" score={0} sub="Ajouter des réalisateurs aux films" onClose={onClose}/>;
  if (phase==='done') return <GameDone col={C.green} icon="sparkles-outline" title="Vision complète !" score={score} sub="Réalisateurs identifiés" onClose={onClose}/>;

  return (
    <Animated.View style={{ flex:1, opacity:revAnim }}>
      <View style={{ flex:1, padding:20 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:14 }}>
          <View style={{ flexDirection:'row', gap:5 }}>
            {[0,1,2,3,4].map(i => (
              <View key={i} style={{ width:26, height:4, borderRadius:2,
                backgroundColor:i<round?C.green:i===round?C.green:C.subtle,
                opacity:i<round?1:i===round?1:0.35 }}/>
            ))}
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="flash" size={13} color={C.gold}/>
            <Text style={{ color:C.gold, fontSize:15, fontWeight:'900' }}>{score}</Text>
          </View>
        </View>
        <View style={{ backgroundColor:`${C.green}12`, borderRadius:12, padding:10, marginBottom:14,
          borderWidth:1, borderColor:`${C.green}25`, flexDirection:'row', alignItems:'center', gap:8 }}>
          <Ionicons name="sparkles-outline" size={14} color={C.green}/>
          <Text style={{ color:C.green, fontSize:11, fontWeight:'700' }}>
            {['1er film révélé','2ème film révélé','3ème film révélé'][reveal]} · Moins d'indices = plus de points
          </Text>
        </View>
        {films.slice(0, reveal+1).map((f,i) => (
          <View key={f.id} style={{ marginBottom:8, borderRadius:12, overflow:'hidden', borderWidth:1, borderColor:C.border }}>
            <LinearGradient colors={['rgba(13,32,64,0.8)','rgba(4,8,16,0.95)']}
              style={{ padding:13, flexDirection:'row', alignItems:'center', gap:10 }}>
              <View style={{ width:28, height:28, borderRadius:8, backgroundColor:`${C.green}18`,
                alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color:C.green, fontSize:13, fontWeight:'900' }}>{i+1}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ color:C.white, fontSize:13, fontWeight:'700' }}>{f.title}</Text>
                <Text style={{ color:C.muted, fontSize:10 }}>{f.genre}{f.year?` · ${f.year}`:''}</Text>
              </View>
            </LinearGradient>
          </View>
        ))}
        {phase==='q' && reveal < 2 && (
          <TouchableOpacity onPress={addClue}
            style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6,
              marginBottom:12, paddingVertical:8, borderRadius:10, borderWidth:1, borderColor:`${C.green}30`,
              backgroundColor:`${C.green}08` }}>
            <Ionicons name="eye-outline" size={13} color={C.mid}/>
            <Text style={{ color:C.mid, fontSize:12 }}>Film suivant (−40 pts)</Text>
          </TouchableOpacity>
        )}
        <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:1, marginTop:4, marginBottom:10 }}>
          QUI A RÉALISÉ CES FILMS ?
        </Text>
        <View style={{ gap:9 }}>
          {choices.map(d => {
            let bg=C.faint, border=C.border, tc:string=C.white;
            if (phase==='r' && d===dir)            { bg=C.greenFaint; border=C.green; tc=C.green; }
            if (phase==='r' && d===sel && d!==dir) { bg='rgba(255,92,114,0.10)'; border=C.red; tc=C.red; }
            return (
              <TouchableOpacity key={d} disabled={phase==='r'} onPress={() => answer(d)}
                style={{ backgroundColor:bg, borderRadius:12, padding:13, borderWidth:1, borderColor:border }}>
                <Text style={{ color:tc, fontSize:13, fontWeight:'600', textAlign:'center' }}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {phase==='r' && (
          <TouchableOpacity onPress={next}
            style={{ marginTop:16, backgroundColor:C.green, borderRadius:14, padding:14,
              alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 }}>
            <Text style={{ color:'#040810', fontSize:14, fontWeight:'900' }}>{round<4?'Film suivant →':'Résultats'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
});

// ★★★ GAME 5 — NOVA HUNTER (taper les films avant l'explosion)
const NovaHunter = memo(({ works, onXP, onClose }: { works:Work[]; onXP:(n:number)=>void; onClose:()=>void }) => {
  const targets = useMemo(() => [
    { label:'Courts métrages',  filter:(w:Work)=>(w.duration??0)>0&&(w.duration??0)<60 },
    { label:'Films originaux',  filter:(w:Work)=>!!w.is_original },
    { label:'Films dramaturges',filter:(w:Work)=>(w.genre?.toLowerCase().includes('dram'))??false },
    { label:'Documentaires',    filter:(w:Work)=>(w.genre?.toLowerCase().includes('doc'))??false },
    { label:'Films expérimentaux',filter:(w:Work)=>(w.genre?.toLowerCase().includes('exp'))??false },
  ], []);

  const [round, setRound]   = useState(0);
  const [score, setScore]   = useState(0);
  const [sel, setSel]       = useState<number[]>([]);
  const [time, setTime]     = useState(25);
  const [phase, setPhase]   = useState<'play'|'result'|'done'>('play');
  const novaAnim            = useRef(new Animated.Value(0)).current;
  const timerRef            = useRef<any>(null);

  const tgt   = targets[round % targets.length];
  const grid  = useMemo(() => works.sort(()=>Math.random()-0.5).slice(0,12), [works,round]);
  const right = useMemo(() => grid.filter(tgt.filter).map(w=>w.id), [grid,tgt]);

  // Supernova countdown animation
  useEffect(() => {
    if (phase !== 'play') return;
    novaAnim.setValue(0);
    Animated.timing(novaAnim, { toValue:1, duration:25000, useNativeDriver:false }).start();
    setTime(25);
    timerRef.current = setInterval(() => setTime(t => {
      if (t <= 1) { clearInterval(timerRef.current); evaluate(); return 0; }
      return t-1;
    }), 1000);
    return () => clearInterval(timerRef.current);
  }, [round, phase]);

  const evaluate = useCallback(() => {
    clearInterval(timerRef.current);
    setPhase('result');
    const hits = sel.filter(id => right.includes(id)).length;
    const miss = sel.filter(id => !right.includes(id)).length;
    setScore(s => s + Math.max(0, hits*35 - miss*15));
  }, [sel, right]);

  const toggle = (id: number) => {
    if (phase !== 'play') return;
    hL();
    setSel(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);
  };

  const next = () => {
    if (round >= 3) { onXP(score); setPhase('done'); return; }
    setRound(r=>r+1); setSel([]); setPhase('play');
  };

  if (phase==='done') return <GameDone col={C.orange} icon="flash" title="Nova terminée !" score={score} sub="Films capturés avant l'explosion" onClose={onClose}/>;

  const ringColor = novaAnim.interpolate({ inputRange:[0,1], outputRange:[C.orange, C.red] });

  return (
    <View style={{ flex:1, padding:16 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <View style={{ flexDirection:'row', gap:4 }}>
          {[0,1,2,3].map(i => <View key={i} style={{ width:20, height:4, borderRadius:2,
            backgroundColor:i<=round?C.orange:C.subtle }}/>)}
        </View>
        <View style={{ width:42, height:42, borderRadius:21, backgroundColor:`${C.red}22`,
          borderWidth:2, borderColor:`${C.red}55`, alignItems:'center', justifyContent:'center' }}>
          <Text style={{ color:time<=8?C.red:C.orange, fontSize:15, fontWeight:'900' }}>{time}</Text>
        </View>
      </View>
      <View style={{ height:4, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden', marginBottom:12 }}>
        <Animated.View style={{ height:'100%', borderRadius:2,
          width:novaAnim.interpolate({inputRange:[0,1], outputRange:['100%','0%']}),
          backgroundColor:ringColor as any }}/>
      </View>
      <LinearGradient colors={[`${C.orange}18`,'rgba(4,8,16,0.92)']}
        style={{ borderRadius:14, padding:14, borderWidth:1, borderColor:`${C.orange}35`,
          marginBottom:12, alignItems:'center' }}>
        <Text style={{ color:C.muted, fontSize:9, fontWeight:'800', letterSpacing:1.2 }}>CAPTUREZ TOUS LES</Text>
        <Text style={{ color:C.white, fontSize:17, fontWeight:'900', marginTop:3 }}>{tgt.label}</Text>
        <Text style={{ color:C.muted, fontSize:10, marginTop:2 }}>{right.length} film{right.length>1?'s':''} sur 12</Text>
      </LinearGradient>
      {phase==='play' && (
        <>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:7, justifyContent:'center', marginBottom:12 }}>
            {grid.map(w => {
              const isSel = sel.includes(w.id);
              return (
                <TouchableOpacity key={w.id} onPress={() => toggle(w.id)} activeOpacity={0.85}
                  style={{ width:(SW-E*2-28)/3 }}>
                  <LinearGradient
                    colors={isSel ? [`${C.orange}28`,'rgba(4,8,16,0.9)'] : ['rgba(13,32,64,0.7)','rgba(4,8,16,0.9)']}
                    style={{ borderRadius:11, padding:10, borderWidth:1.5,
                      borderColor:isSel?C.orange:C.border, alignItems:'center', gap:4, minHeight:66 }}>
                    {isSel && <Ionicons name="checkmark-circle" size={14} color={C.orange}/>}
                    <Text style={{ color:isSel?C.white:C.mid, fontSize:10, fontWeight:'700', textAlign:'center' }} numberOfLines={2}>{w.title}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={evaluate}
            style={{ backgroundColor:C.orange, borderRadius:14, padding:14, alignItems:'center' }}>
            <Text style={{ color:'#040810', fontSize:13, fontWeight:'900' }}>Lancer la Nova ! ({sel.length} sélectionnés)</Text>
          </TouchableOpacity>
        </>
      )}
      {phase==='result' && (
        <ScrollView>
          <View style={{ gap:6, marginBottom:12 }}>
            {grid.map(w => {
              const isSel=sel.includes(w.id), isR=right.includes(w.id);
              let col=C.border, bg='transparent';
              if(isR&&isSel)   { col=C.green; bg=C.greenFaint; }
              else if(isR&&!isSel) { col=C.gold; bg=C.goldFaint; }
              else if(!isR&&isSel) { col=C.red; bg='rgba(255,92,114,0.08)'; }
              return (
                <View key={w.id} style={{ flexDirection:'row', alignItems:'center', gap:8,
                  padding:9, borderRadius:10, borderWidth:1, borderColor:col, backgroundColor:bg }}>
                  <Ionicons name={isR&&isSel?'checkmark-circle':isR?'alert-circle':!isR&&isSel?'close-circle':'ellipse-outline'} size={14} color={col}/>
                  <Text style={{ color:C.white, fontSize:12, flex:1 }} numberOfLines={1}>{w.title}</Text>
                  {isR&&isSel && <Text style={{ color:C.gold, fontSize:10, fontWeight:'700' }}>+35</Text>}
                </View>
              );
            })}
          </View>
          <TouchableOpacity onPress={next}
            style={{ backgroundColor:C.blue, borderRadius:14, padding:13, alignItems:'center' }}>
            <Text style={{ color:C.white, fontSize:13, fontWeight:'900' }}>{round<3?'Round suivant →':'Voir le score'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
});

// ★★★ GAME 6 — GALAXY CHAIN (chaîne infinie avec multiplicateur)
const GalaxyChain = memo(({ onXP, onClose }: { onXP:(n:number)=>void; onClose:()=>void }) => {
  const ALL_Q = useMemo(() => [
    ...Q_ORACLE,
    {q:"Quelle icône symbolise les Originaux Universe ?", opts:["★","◆","▶","∞"],              ans:0, xp:40, tag:"App"},
    {q:"Quel score minimum pour monter de niveau ?",      opts:["50","100","500","1000"],        ans:1, xp:40, tag:"XP"},
    {q:"À quel niveau débloquez-vous le tournoi ?",       opts:["Niv.2","Niv.3","Niv.4","Niv.5"],ans:2,xp:50, tag:"Jeux"},
    {q:"Combien de jeux sont disponibles dans Universe ?",opts:["3","4","5","6"],                 ans:3, xp:40, tag:"Jeux"},
  ].sort(()=>Math.random()-0.5), []);

  const [qi, setQi]         = useState(0);
  const [chain, setChain]   = useState(0);
  const [score, setScore]   = useState(0);
  const [mult, setMult]     = useState(1);
  const [phase, setPhase]   = useState<'q'|'r'|'over'|'done'>('q');
  const [sel, setSel]       = useState<number|null>(null);
  const [timer, setTimer]   = useState(20);
  const timerRef            = useRef<any>(null);
  const chainAnim           = useRef(new Animated.Value(0)).current;

  // Multiplier escalation
  const getMult = (c: number) => c < 3 ? 1 : c < 6 ? 2 : c < 10 ? 5 : 10;

  useEffect(() => {
    if (phase !== 'q') return;
    setTimer(20);
    timerRef.current = setInterval(() => setTimer(t => {
      if (t<=1) { clearInterval(timerRef.current); chainBreak(); return 0; }
      return t-1;
    }), 1000);
    return () => clearInterval(timerRef.current);
  }, [qi, phase]);

  const chainBreak = () => { setPhase('over'); };

  const answer = (idx: number) => {
    clearInterval(timerRef.current);
    const q = ALL_Q[qi % ALL_Q.length];
    setSel(idx);
    setPhase('r');
    if (idx === q.ans) {
      const newChain = chain + 1;
      const m = getMult(newChain);
      const pts = q.xp * m;
      setChain(newChain);
      setMult(m);
      setScore(s => s + pts);
      // Animate chain grow
      Animated.timing(chainAnim, { toValue:newChain, duration:400, useNativeDriver:false }).start();
    } else {
      chainBreak();
    }
  };

  const cont = () => {
    if (qi >= ALL_Q.length - 1) { onXP(score); setPhase('done'); return; }
    setQi(i => i+1); setSel(null); setPhase('q');
  };

  const q = ALL_Q[qi % ALL_Q.length];

  if (phase==='done') return <GameDone col={C.gold} icon="infinite-outline" title="Chaîne complète !" score={score} sub={`${chain} questions · ×${mult} multiplicateur final`} onClose={onClose}/>;

  if (phase==='over') return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:32, gap:16 }}>
      <View style={{ width:90, height:90, borderRadius:45, backgroundColor:'rgba(255,92,114,0.18)',
        borderWidth:2, borderColor:`${C.red}55`, alignItems:'center', justifyContent:'center' }}>
        <Ionicons name="flash" size={44} color={C.red}/>
      </View>
      <Text style={{ color:C.red, fontSize:28, fontWeight:'900' }}>Chaîne brisée !</Text>
      <Text style={{ color:C.muted, fontSize:15, textAlign:'center' }}>{chain} liens · {score} XP</Text>
      <View style={{ flexDirection:'row', gap:12, marginTop:8 }}>
        <TouchableOpacity onPress={onClose}
          style={{ borderRadius:14, paddingHorizontal:22, paddingVertical:13, borderWidth:1, borderColor:C.border }}>
          <Text style={{ color:C.muted, fontSize:14, fontWeight:'700' }}>Quitter</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { onXP(score); }}
          style={{ borderRadius:14, paddingHorizontal:22, paddingVertical:13, backgroundColor:C.gold }}>
          <Text style={{ color:'#040810', fontSize:14, fontWeight:'900' }}>Encaisser {score} XP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const multColors = ['','',C.blue,C.cyan,C.green,C.purple,C.gold];
  const mColor = mult >= 5 ? C.gold : mult >= 2 ? C.cyan : C.muted;

  return (
    <View style={{ flex:1, padding:20 }}>
      {/* Chain HUD */}
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4,
            backgroundColor:`${mColor}18`, borderRadius:10, paddingHorizontal:10, paddingVertical:5 }}>
            <Ionicons name="infinite-outline" size={13} color={mColor}/>
            <Text style={{ color:mColor, fontSize:14, fontWeight:'900' }}>{chain}</Text>
          </View>
          <View style={{ backgroundColor:`${mColor}22`, borderRadius:9, paddingHorizontal:9, paddingVertical:4 }}>
            <Text style={{ color:mColor, fontSize:13, fontWeight:'900' }}>×{mult}</Text>
          </View>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <Ionicons name="flash" size={14} color={C.gold}/>
          <Text style={{ color:C.gold, fontSize:16, fontWeight:'900' }}>{score}</Text>
        </View>
        <View style={{ width:36, height:36, borderRadius:18, backgroundColor:C.subtle,
          alignItems:'center', justifyContent:'center' }}>
          <Text style={{ color:timer<=7?C.red:C.mid, fontSize:14, fontWeight:'900' }}>{timer}</Text>
        </View>
      </View>
      <View style={{ height:3, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden', marginBottom:16 }}>
        <View style={{ height:'100%', borderRadius:2, backgroundColor:timer<=7?C.red:mColor,
          width:`${(timer/20)*100}%` as any }}/>
      </View>
      {/* Chain multiplier hint */}
      {chain > 0 && (
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6,
          marginBottom:14, padding:8, borderRadius:10, backgroundColor:`${mColor}10`,
          borderWidth:StyleSheet.hairlineWidth, borderColor:`${mColor}30` }}>
          <Text style={{ color:mColor, fontSize:11, fontWeight:'700' }}>
            {chain<3 ? `${3-chain} bonnes réponses pour ×2` : chain<6 ? `×2 actif · ${6-chain} pour ×5` : chain<10 ? `×5 actif · ${10-chain} pour ×10` : '×10 MAXIMUM ATTEINT !'}
          </Text>
        </View>
      )}
      <LinearGradient colors={[`${mColor}15`,'rgba(4,8,16,0.95)']}
        style={{ borderRadius:16, padding:20, borderWidth:1, borderColor:`${mColor}30`,
          marginBottom:20, minHeight:86, justifyContent:'center', gap:8 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <View style={{ backgroundColor:`${mColor}25`, borderRadius:7,
            paddingHorizontal:8, paddingVertical:3 }}>
            <Text style={{ color:mColor, fontSize:9, fontWeight:'900', letterSpacing:0.8 }}>{q.tag.toUpperCase()}</Text>
          </View>
          <Text style={{ color:C.muted, fontSize:10 }}>+{q.xp*mult} XP (×{mult})</Text>
        </View>
        <Text style={{ color:C.white, fontSize:16, fontWeight:'700', lineHeight:24 }}>{q.q}</Text>
      </LinearGradient>
      <View style={{ gap:9 }}>
        {q.opts.map((opt,i) => {
          let bg=C.faint, border=C.border, tc:string=C.white;
          if (phase==='r' && i===q.ans)            { bg=C.greenFaint; border=C.green; tc=C.green; }
          if (phase==='r' && i===sel && i!==q.ans) { bg='rgba(255,92,114,0.10)'; border=C.red; tc=C.red; }
          return (
            <TouchableOpacity key={i} disabled={phase==='r'} onPress={() => answer(i)}
              style={{ backgroundColor:bg, borderRadius:13, padding:14, borderWidth:1, borderColor:border,
                flexDirection:'row', alignItems:'center', gap:10 }}>
              <View style={{ width:26, height:26, borderRadius:13, backgroundColor:`${border}22`,
                borderWidth:1, borderColor:border, alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color:tc, fontSize:11, fontWeight:'900' }}>{['A','B','C','D'][i]}</Text>
              </View>
              <Text style={{ color:tc, fontSize:13, fontWeight:'600', flex:1 }}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {phase==='r' && (
        <TouchableOpacity onPress={cont}
          style={{ marginTop:16, backgroundColor:mColor, borderRadius:14, padding:14,
            alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 }}>
          <Text style={{ color:mColor===C.gold?'#040810':C.white, fontSize:14, fontWeight:'900' }}>
            Continuer la chaîne →
          </Text>
        </TouchableOpacity>
      )}
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
  unlocked:string[]; log:any[]; addXP:(n:number,k?:ActionKey)=>void;
}) => {
  const router = useRouter(), insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SH)).current;
  const [tab,  setTab]    = useState<'home'|'badges'|'games'|'rank'>('home');
  const [game, setGame]   = useState<GameId|null>(null);
  const [burst,setBurst]  = useState({ v:false, n:0 });
  const [claimed,setClaimed] = useState<string[]>([]);
  const { leaders, myRank } = useLeaderboard(userId);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue:0, useNativeDriver:true, tension:62, friction:11 }).start();
    } else {
      Animated.timing(slideY, { toValue:SH, duration:280, useNativeDriver:true, easing:Easing.in(Easing.cubic) }).start();
      setGame(null); setTab('home');
    }
  }, [visible]);

  // XP ONLY when game finishes (called from done screen)
  const handleXP = useCallback((n: number) => {
    if (n <= 0) return;
    addXP(n, 'WATCH_FILM');
    setBurst({ v:true, n });
    setTimeout(() => setBurst({ v:false, n:0 }), 900);
  }, [addXP]);

  // Claim XP only when challenge progress=100%
  const claim = useCallback((id:string, amt:number) => {
    if (claimed.includes(id)) return;
    setClaimed(c => [...c,id]);
    addXP(amt);
    setBurst({ v:true, n:amt });
    setTimeout(() => setBurst({ v:false, n:0 }), 900);
    hS();
  }, [claimed, addXP]);

  const go = (route: string) => { onClose(); setTimeout(() => router.push(route as any), 320); };

  const TABS = [
    { id:'home',   icon:'planet-outline'         as const, label:'Cosmos' },
    { id:'badges', icon:'ribbon-outline'          as const, label:'Badges' },
    { id:'games',  icon:'game-controller-outline' as const, label:'Jeux'   },
    { id:'rank',   icon:'podium-outline'          as const, label:'Rang'   },
  ] as const;

  const screen = () => {
    if (game==='oracle')  return <OracleGame       onXP={handleXP} onClose={()=>setGame(null)}/>;
    if (game==='warp')    return <WarpSwipe  works={works} onXP={handleXP} onClose={()=>setGame(null)}/>;
    if (game==='map')     return <StarMap    works={works} onXP={handleXP} onClose={()=>setGame(null)}/>;
    if (game==='vision')  return <DirectorVision works={works} onXP={handleXP} onClose={()=>setGame(null)}/>;
    if (game==='nova')    return <NovaHunter works={works} onXP={handleXP} onClose={()=>setGame(null)}/>;
    if (game==='chain')   return <GalaxyChain      onXP={handleXP} onClose={()=>setGame(null)}/>;

    if (tab==='home') return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:E, paddingBottom:48 }}>
        <View style={{ alignItems:'center', marginBottom:22 }}>
          <View style={{ width:84, height:84, borderRadius:42,
            backgroundColor:`${lv.color}22`, borderWidth:2, borderColor:`${lv.color}55`,
            alignItems:'center', justifyContent:'center', marginBottom:10 }}>
            <Ionicons name={lv.icon} size={38} color={lv.color}/>
          </View>
          <Text style={{ color:C.white, fontSize:22, fontWeight:'900' }}>{lv.title}</Text>
          <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>Niveau {lv.level}</Text>
        </View>
        <XPBar lv={lv} nextLv={nextLv} prog={prog} xp={xp}/>
        <View style={{ flexDirection:'row', gap:10, marginBottom:22 }}>
          <StreakBubble streak={streak}/>
          <View style={{ flex:1, gap:10 }}>
            <LinearGradient colors={[C.blueFaint,'rgba(4,8,16,0.8)']}
              style={{ borderRadius:14, padding:13, borderWidth:1, borderColor:`${C.blue}30` }}>
              <Text style={{ color:C.muted, fontSize:10, fontWeight:'700' }}>AUJOURD'HUI</Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:2 }}>
                <Ionicons name="flash" size={14} color={C.blue}/>
                <Text style={{ color:C.blue, fontSize:22, fontWeight:'900' }}>+{todayXP}</Text>
              </View>
              <Text style={{ color:C.muted, fontSize:9 }}>XP gagnés</Text>
            </LinearGradient>
            <LinearGradient colors={[C.purpleFaint,'rgba(4,8,16,0.8)']}
              style={{ borderRadius:14, padding:13, borderWidth:1, borderColor:`${C.purple}30` }}>
              <Text style={{ color:C.muted, fontSize:10, fontWeight:'700' }}>CETTE SEMAINE</Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:2 }}>
                <Ionicons name="flash" size={14} color={C.purple}/>
                <Text style={{ color:C.purple, fontSize:22, fontWeight:'900' }}>+{weekXP}</Text>
              </View>
              <Text style={{ color:C.muted, fontSize:9 }}>XP gagnés</Text>
            </LinearGradient>
          </View>
        </View>
        <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginBottom:12 }}>Défis du jour</Text>
        {DAILY.map(ch => <DailyRow key={ch.id} ch={ch} claimed={claimed.includes(ch.id)} onClaim={() => claim(ch.id,ch.xp)}/>)}
        <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginTop:20, marginBottom:4 }}>
          Interagissez avec Universe
        </Text>
        <Text style={{ color:C.muted, fontSize:11, marginBottom:14, fontStyle:'italic' }}>
          XP crédité uniquement à la complétion de l'action
        </Text>
        {(Object.keys(ACTIONS) as ActionKey[]).map(k => (
          <ActionRow key={k} aKey={k} onPress={() => {
            hL();
            if (k==='WRITE_CRITIQUE'||k==='LIKE_WORK'||k==='COMMENT') go('/(tabs)/social');
            else if (k==='CREATE_VIDEO')         go('/(tabs)/create');
            else if (k==='COMPLETE_PROFILE')     go('/profile');
            else if (k==='CONNECT_PRO')          go('/(tabs)/professionals');
            else { addXP(ACTIONS[k].xp, k); setBurst({v:true,n:ACTIONS[k].xp}); setTimeout(()=>setBurst({v:false,n:0}),900); }
          }}/>
        ))}
        {log.length > 0 && (
          <>
            <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginTop:20, marginBottom:12 }}>Activité récente</Text>
            {log.map((a,i) => (
              <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:10,
                paddingVertical:8, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border }}>
                <View style={{ width:30, height:30, borderRadius:8,
                  backgroundColor:`${a.color}18`, alignItems:'center', justifyContent:'center' }}>
                  <Ionicons name={a.icon as any} size={14} color={a.color}/>
                </View>
                <Text style={{ color:C.mid, fontSize:12, flex:1 }}>{a.label}</Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                  <Ionicons name="flash" size={9} color={C.gold}/>
                  <Text style={{ color:C.gold, fontSize:11, fontWeight:'800' }}>+{a.xp}</Text>
                </View>
              </View>
            ))}
          </>
        )}
        <TouchableOpacity onPress={() => setTab('games')} activeOpacity={0.88} style={{ marginTop:18 }}>
          <LinearGradient colors={['rgba(155,107,255,0.24)','rgba(90,150,230,0.14)']}
            start={{x:0,y:0}} end={{x:1,y:1}}
            style={{ borderRadius:18, padding:18, flexDirection:'row', alignItems:'center', gap:14,
              borderWidth:1, borderColor:`${C.purple}40` }}>
            <View style={{ width:50, height:50, borderRadius:25, backgroundColor:`${C.purple}28`,
              borderWidth:1.5, borderColor:`${C.purple}55`, alignItems:'center', justifyContent:'center' }}>
              <Ionicons name="game-controller-outline" size={24} color={C.purple}/>
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ color:C.white, fontSize:14, fontWeight:'800' }}>6 jeux Galaxy disponibles</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>XP crédité uniquement à la fin du jeu</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.purple}/>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    );

    if (tab==='badges') return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:E, paddingBottom:48 }}>
        <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginBottom:4 }}>Collection de badges</Text>
        <Text style={{ color:C.muted, fontSize:12, marginBottom:4 }}>{unlocked.length}/{BADGES.length} débloqués</Text>
        <LinearGradient colors={[`${C.gold}12`,'rgba(4,8,16,0.9)']}
          style={{ borderRadius:14, padding:14, borderWidth:1, borderColor:`${C.gold}28`, marginBottom:20,
            flexDirection:'row', alignItems:'center', gap:10 }}>
          <Ionicons name="flash" size={16} color={C.gold}/>
          <Text style={{ color:`${C.gold}CC`, fontSize:11, flex:1 }}>
            Badges débloqués automatiquement quand vous atteignez le seuil XP
          </Text>
        </LinearGradient>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:12 }}>
          {BADGES.map(b => <BadgeCard key={b.id} badge={b} unlocked={unlocked.includes(b.id)}/>)}
        </View>
      </ScrollView>
    );

    if (tab==='games') return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:E, paddingBottom:48 }}>
        <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginBottom:4 }}>6 Jeux Galaxy</Text>
        <Text style={{ color:C.muted, fontSize:12, marginBottom:20 }}>XP attribué uniquement à la fin du jeu</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:12 }}>
          {GAMES_META.map(g => <GameCard key={g.id} gm={g} onPlay={() => setGame(g.id)}/>)}
        </View>
        <LinearGradient colors={[C.goldFaint,'rgba(4,8,16,0.9)']}
          style={{ marginTop:20, borderRadius:16, padding:18, flexDirection:'row', alignItems:'center',
            gap:12, borderWidth:1, borderColor:`${C.gold}30` }}>
          <View style={{ width:44, height:44, borderRadius:22, backgroundColor:C.faint,
            alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.border }}>
            <Ionicons name="lock-closed-outline" size={20} color={C.muted}/>
          </View>
          <View>
            <Text style={{ color:C.white, fontSize:13, fontWeight:'800' }}>Tournoi cosmique</Text>
            <Text style={{ color:C.muted, fontSize:11 }}>Débloqué au niveau 4 · Astronaute</Text>
          </View>
        </LinearGradient>
      </ScrollView>
    );

    if (tab==='rank') {
      const RB = [C.gold,'#C0C0C0','#CD7F32'];
      const RI = ['trophy','medal','ribbon'] as const;
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:E, paddingBottom:48 }}>
          <Text style={{ color:C.white, fontSize:15, fontWeight:'800', marginBottom:4 }}>Classement Universe</Text>
          <Text style={{ color:C.muted, fontSize:12, marginBottom:20 }}>Top cinéphiles · Temps réel</Text>
          {leaders.length===0 && (
            <View style={{ padding:36, alignItems:'center', gap:12 }}>
              <Ionicons name="planet-outline" size={36} color={C.muted}/>
              <Text style={{ color:C.muted, fontSize:13, textAlign:'center' }}>Chargement du classement…</Text>
            </View>
          )}
          {leaders.slice(0,10).map((r,i) => {
            const isMe = r.user_id === userId;
            const col  = i<3 ? RB[i] : C.muted;
            return (
              <View key={r.user_id} style={{ marginBottom:10, borderRadius:14, overflow:'hidden',
                borderWidth:1, borderColor:isMe?`${C.blue}50`:i<3?`${col}50`:C.border }}>
                <LinearGradient
                  colors={isMe?[`${C.blue}15`,'rgba(4,8,16,0.9)']:i<3?[`${col}22`,'rgba(4,8,16,0.88)']:['rgba(13,32,64,0.5)','rgba(4,8,16,0.8)']}
                  style={{ padding:14, flexDirection:'row', alignItems:'center', gap:14 }}>
                  <View style={{ width:30, height:30, borderRadius:15,
                    backgroundColor:i<3?`${col}22`:C.faint, borderWidth:1, borderColor:i<3?col:C.border,
                    alignItems:'center', justifyContent:'center' }}>
                    {i<3 ? <Ionicons name={RI[i]} size={13} color={col}/>
                          : <Text style={{ color:C.muted, fontSize:11, fontWeight:'900' }}>#{r.rank}</Text>}
                  </View>
                  <View style={{ width:38, height:38, borderRadius:19, backgroundColor:C.faint,
                    alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.border }}>
                    <Ionicons name="person-outline" size={17} color={C.mid}/>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:isMe?C.blue:C.white, fontSize:13, fontWeight:'800' }}>
                      {isMe ? 'Vous' : r.display_name}
                    </Text>
                    <Text style={{ color:C.muted, fontSize:10 }}>{r.title}</Text>
                  </View>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                    <Ionicons name="flash" size={10} color={C.gold}/>
                    <Text style={{ color:C.gold, fontSize:13, fontWeight:'900' }}>{r.xp.toLocaleString()}</Text>
                  </View>
                </LinearGradient>
              </View>
            );
          })}
          {myRank && myRank > 10 && (
            <View style={{ padding:13, borderRadius:12, borderWidth:1,
              borderColor:`${C.blue}30`, backgroundColor:`${C.blue}08`, alignItems:'center' }}>
              <Text style={{ color:C.blue, fontSize:12 }}>
                Votre rang : <Text style={{ fontWeight:'900' }}>#{myRank}</Text>
              </Text>
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
      <View style={{ flex:1, backgroundColor:'rgba(4,8,16,0.90)' }}>
        <GalaxyBackground/>
        <Animated.View style={{ flex:1, transform:[{translateY:slideY}] }}>
          <View style={{ paddingTop:insets.top+12, paddingHorizontal:E, paddingBottom:16,
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
              style={{ width:38, height:38, borderRadius:19, backgroundColor:C.subtle,
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
                    <Ionicons name={t.icon} size={20} color={active?C.white:C.muted}/>
                    <Text style={{ color:active?C.white:C.muted, fontSize:10,
                      fontWeight:active?'800':'600', marginTop:3 }}>{t.label}</Text>
                    {active && <View style={{ position:'absolute', bottom:0, width:22, height:2,
                      borderRadius:1, backgroundColor:C.blue }}/>}
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
// ★ GAMIFICATION BADGE — aura divine smooth (lumière collée, zéro orbital ring)
// ══════════════════════════════════════════════════════════════════════════════
const GamificationBadge = memo(({ xp, lv, prog, streak, unlocked, onPress }: {
  xp:number; lv:Level; prog:number; streak:number; unlocked:number; onPress:()=>void;
}) => {
  const [si, setSi]     = useState(0);
  const fade            = useRef(new Animated.Value(1)).current;
  const btnSc           = useRef(new Animated.Value(1)).current;
  const glowOp          = useRef(new Animated.Value(0.28)).current;
  const col             = lv.color;

  // Slow divine breathing — intimate, not orbital
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue:0.95, duration:2600, easing:Easing.inOut(Easing.ease), useNativeDriver:true }),
      Animated.timing(glowOp, { toValue:0.28, duration:2600, easing:Easing.inOut(Easing.ease), useNativeDriver:true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [col]);

  // Section rotation label
  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(fade, { toValue:0, duration:200, useNativeDriver:true }).start(() => {
        setSi(i => (i+1) % BADGE_SECTIONS.length);
        Animated.timing(fade, { toValue:1, duration:260, useNativeDriver:true }).start();
      });
    }, 3400);
    return () => clearInterval(t);
  }, []);

  const press = () => {
    hM();
    Animated.sequence([
      Animated.timing(btnSc, { toValue:0.94, duration:80, useNativeDriver:true }),
      Animated.spring(btnSc, { toValue:1, tension:300, friction:8, useNativeDriver:true }),
    ]).start(onPress);
  };

  const sec    = BADGE_SECTIONS[si];
  const phrase = PHRASES[sec.phraseIdx];

  // Divine glow — colle au badge, aucun ring externe
  const glowStyle: any = {
    position:'absolute', top:-3, bottom:-3, left:-3, right:-3, borderRadius:21,
    ...(Platform.OS === 'web'
      ? { boxShadow:`0 0 22px 7px ${col}46, 0 0 8px 2px ${col}20` }
      : { shadowColor:col, shadowOffset:{width:0,height:0}, shadowOpacity:0.80, shadowRadius:15, elevation:7 }),
  };

  return (
    <TouchableOpacity onPress={press} activeOpacity={1} style={{ marginHorizontal:E }}>
      <Animated.View style={{ transform:[{scale:btnSc}] }}>
        <Animated.View style={[glowStyle, { opacity:glowOp }]} pointerEvents="none"/>
        <LinearGradient
          colors={['rgba(90,150,230,0.14)','rgba(155,107,255,0.08)','rgba(4,8,16,0.97)']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ borderRadius:18, paddingHorizontal:17, paddingVertical:14,
            borderWidth:1, borderColor:`${col}40`,
            flexDirection:'row', alignItems:'center', gap:14 }}>
          <View style={{ width:46, height:46, borderRadius:14,
            backgroundColor:`${col}22`, borderWidth:1.5, borderColor:`${col}55`,
            alignItems:'center', justifyContent:'center' }}>
            <Ionicons name={lv.icon} size={21} color={col}/>
          </View>
          <View style={{ flex:1, gap:4 }}>
            <Animated.View style={{ opacity:fade, flexDirection:'row', alignItems:'center', gap:7 }}>
              <Ionicons name={sec.icon} size={11} color={col}/>
              <Text style={{ color:col, fontSize:12, fontWeight:'900', letterSpacing:0.4 }}>{sec.label}</Text>
              <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:7,
                backgroundColor:`${col}18`, borderWidth:StyleSheet.hairlineWidth, borderColor:`${col}40` }}>
                <Text style={{ color:col, fontSize:9, fontWeight:'800' }}>NIV.{lv.level}</Text>
              </View>
            </Animated.View>
            <Animated.Text style={{ color:C.muted, fontSize:11, fontStyle:'italic', opacity:fade }} numberOfLines={1}>
              {phrase}
            </Animated.Text>
            <View style={{ height:3, backgroundColor:C.subtle, borderRadius:2, overflow:'hidden', marginTop:1 }}>
              <View style={{ height:'100%', borderRadius:2, backgroundColor:col, width:`${prog*100}%` as any }}/>
            </View>
          </View>
          <View style={{ alignItems:'flex-end', gap:5 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
              <Ionicons name="flash" size={11} color={C.gold}/>
              <Text style={{ color:C.gold, fontSize:13, fontWeight:'900' }}>{fmtXP(xp)}</Text>
            </View>
            {streak > 0 && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                <Ionicons name="flame" size={11} color={C.orange}/>
                <Text style={{ color:C.orange, fontSize:10, fontWeight:'800' }}>{streak}j</Text>
              </View>
            )}
            {unlocked > 0 && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                <Ionicons name="ribbon-outline" size={11} color={C.cyan}/>
                <Text style={{ color:C.cyan, fontSize:9, fontWeight:'700' }}>{unlocked}✦</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={13} color={C.mid}/>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── FETCH WORKS ─────────────────────────────────────────────────────────────
const COLS = 'id,title,category,genre,year,likes,image,is_original,adjective,duration,director,created_at';
async function fetchWorks(): Promise<Work[]> {
  const { data, error } = await supabase.from('works').select(COLS).order('likes',{ascending:false}).limit(200);
  if (error) { const { data:fb } = await supabase.from('works').select(COLS).limit(100); return (fb??[]) as Work[]; }
  return (data??[]) as Work[];
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
const HERO_H = SH * 0.50, AUTO_MS = 5200;
const HeroSlide = memo(({ item, W, onPress }: { item:Work; W:number; onPress:()=>void }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const uri  = useMemo(() => resolveImg(item.id, item.image), [item.id,item.image]);
  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={{ width:W, height:HERO_H }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor:C.navyMid }]}/>
      <Animated.Image source={{uri}} style={[StyleSheet.absoluteFill,{opacity:fade}]} resizeMode="cover"
        onLoad={() => Animated.timing(fade,{toValue:1,duration:400,useNativeDriver:true}).start()}/>
      <LinearGradient colors={['rgba(4,8,16,0.5)','transparent']} style={{position:'absolute',top:0,left:0,right:0,height:130}} pointerEvents="none"/>
      <LinearGradient colors={['transparent','rgba(4,8,16,0.75)','rgba(4,8,16,0.97)']} style={{position:'absolute',bottom:0,left:0,right:0,height:'65%' as any}} pointerEvents="none"/>
      <View style={hs.c}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          {item.is_original && <View style={hs.orig}><Text style={hs.origT}>ORIGINAL</Text></View>}
          {(item.likes??0)<100 && <View style={hs.pep}><Text style={hs.pepT}>PÉPITE</Text></View>}
        </View>
        <Text style={hs.title} numberOfLines={2}>{item.title??''}</Text>
        {!!(item.adjective||item.genre) && <Text style={hs.sub} numberOfLines={1}>{item.adjective||`${item.genre??''}${item.year?` · ${item.year}`:''}`}</Text>}
        <View style={{ flexDirection:'row', alignItems:'center', gap:7 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="heart" size={11} color={C.mid}/>
            <Text style={hs.stat}>{fmtK(item.likes??0)}</Text>
          </View>
          {item.duration!=null && <><View style={{ width:3, height:3, borderRadius:1.5, backgroundColor:C.subtle }}/><Text style={hs.stat}>{fmtDur(item.duration)}</Text></>}
        </View>
        <View style={hs.actions}>
          <TouchableOpacity style={hs.play} onPress={onPress} activeOpacity={0.85}>
            <Ionicons name="play" size={14} color={C.bg}/>
            <Text style={{ color:C.bg, fontSize:13, fontWeight:'700' }}>Regarder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={hs.info} onPress={onPress} activeOpacity={0.80}>
            <Ionicons name="information-circle-outline" size={14} color={C.white}/>
            <Text style={{ color:C.white, fontSize:13, fontWeight:'600' }}>Détails</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const hs = StyleSheet.create({
  c:      { position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:22,paddingBottom:50,gap:8 },
  orig:   { paddingHorizontal:8,paddingVertical:3,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:'rgba(255,255,255,0.08)' },
  origT:  { color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.7 },
  pep:    { paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:'rgba(255,255,255,0.14)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi },
  pepT:   { color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.7 },
  title:  { color:C.white,fontSize:26,fontWeight:'800',letterSpacing:-0.4,lineHeight:32 },
  sub:    { color:C.muted,fontSize:13 },
  stat:   { color:C.muted,fontSize:11,fontWeight:'600' },
  actions:{ flexDirection:'row',gap:10,marginTop:2 },
  play:   { flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.white,paddingHorizontal:20,paddingVertical:10,borderRadius:24 },
  info:   { flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.faint,paddingHorizontal:16,paddingVertical:10,borderRadius:24,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border },
});

const HeroBanner = memo(({ works, loading }: { works:Work[]; loading:boolean }) => {
  const router   = useRouter();
  const scrollX  = useRef(new Animated.Value(0)).current;
  const flatRef  = useRef<FlatList<Work>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const paused   = useRef(false), idxRef = useRef(0);
  const [slotW, setSlotW] = useState(SW);
  const scrollTo = useCallback((i:number) => {
    if (!works.length || !slotW) return;
    const nx = ((i % works.length) + works.length) % works.length;
    flatRef.current?.scrollToOffset({ offset:nx*slotW, animated:true });
    idxRef.current = nx;
  }, [works.length, slotW]);
  useEffect(() => {
    if (works.length < 2) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => { if (!paused.current) scrollTo(idxRef.current+1); }, AUTO_MS);
    return () => clearInterval(timerRef.current);
  }, [works.length, scrollTo]);
  const onScroll = useMemo(() => Animated.event([{nativeEvent:{contentOffset:{x:scrollX}}}], {useNativeDriver:false}), []);
  const renderItem = useCallback(({item}:ListRenderItemInfo<Work>) =>
    <HeroSlide item={item} W={slotW} onPress={() => router.push(`/film/${item.id}` as any)}/>, [router,slotW]);
  const keyExtract = useCallback((w:Work) => `h${w.id}`, []);
  if (loading || !works.length) return (
    <View style={{ height:HERO_H, backgroundColor:C.navyLow }}>
      <View style={{ ...StyleSheet.absoluteFillObject, padding:22, justifyContent:'flex-end', gap:10 }}>
        <Shimmer w="50%" h={12}/><Shimmer w="75%" h={26}/><Shimmer w="40%" h={11}/><Shimmer w="52%" h={40} r={24}/>
      </View>
    </View>
  );
  const dc = Math.min(works.length, 8);
  return (
    <View style={{ height:HERO_H, overflow:'hidden' }} onLayout={e => setSlotW(e.nativeEvent.layout.width)}>
      <FlatList ref={flatRef} data={works} keyExtractor={keyExtract} renderItem={renderItem}
        horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false}
        decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16}
        onScrollBeginDrag={() => { paused.current=true; }}
        onMomentumScrollEnd={e => { idxRef.current=Math.round(e.nativeEvent.contentOffset.x/slotW); paused.current=false; }}
        windowSize={5} initialNumToRender={3} maxToRenderPerBatch={3} removeClippedSubviews={false}/>
      {works.length>1 && (
        <View style={{ position:'absolute',bottom:14,left:0,right:0,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5 }}>
          {Array.from({length:dc}).map((_,i) => {
            const inp = [(i-1)*slotW, i*slotW, (i+1)*slotW];
            return (
              <TouchableOpacity key={i} onPress={() => scrollTo(i)} hitSlop={10}>
                <Animated.View style={{ height:3, borderRadius:2, backgroundColor:C.white,
                  opacity:scrollX.interpolate({inputRange:inp,outputRange:[0.25,1,0.25],extrapolate:'clamp'}),
                  width:scrollX.interpolate({inputRange:inp,outputRange:[6,20,6],extrapolate:'clamp'}) }}/>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
});

// ─── PORTRAIT CARD ────────────────────────────────────────────────────────────
const PW = 128, PH = 190, LW = 226, LH = 128;
const PortraitCard = memo(({ item, rank, pep }: { item:Work; rank?:number; pep?:boolean }) => {
  const router = useRouter();
  const uri    = useMemo(() => resolveImg(item.id, item.image), [item.id,item.image]);
  return (
    <TouchableOpacity style={{ marginRight:10 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={pc.card}>
        <Image source={{uri}} style={pc.img} resizeMode="cover"/>
        <LinearGradient colors={['transparent','rgba(4,8,16,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/>
        <View style={pc.badge}><Text style={pc.badgeT}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>
        {pep && <View style={pc.pepite}><Text style={{ color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.5 }}>PÉPITE</Text></View>}
        {rank!=null && <Text style={pc.rank}>{rank}</Text>}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="heart" size={9} color={C.mid}/>
            <Text style={pc.stat}>{fmtK(item.likes??0)}</Text>
            {item.year && <><View style={{ width:2,height:2,borderRadius:1,backgroundColor:C.subtle }}/><Text style={pc.stat}>{item.year}</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const pc = StyleSheet.create({
  card:  { width:PW, height:PH, borderRadius:12, overflow:'hidden', backgroundColor:C.navyMid },
  img:   { width:'100%', height:'100%', resizeMode:'cover' },
  badge: { position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(4,8,16,0.74)' },
  badgeT:{ color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4 },
  pepite:{ position:'absolute',top:7,right:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi },
  rank:  { position:'absolute',bottom:32,right:6,fontSize:48,fontWeight:'900',lineHeight:48,letterSpacing:-3,color:'rgba(255,255,255,0.11)' },
  meta:  { position:'absolute',bottom:8,left:9,right:9,gap:3 },
  title: { color:C.white,fontSize:11,fontWeight:'700',lineHeight:14 },
  stat:  { color:C.muted,fontSize:9,fontWeight:'600' },
});

const LandscapeCard = memo(({ item }: { item:Work }) => {
  const router = useRouter();
  const uri    = useMemo(() => resolveImg(item.id, item.image), [item.id,item.image]);
  return (
    <TouchableOpacity style={{ marginRight:10 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={lc.card}>
        <Image source={{uri}} style={lc.img} resizeMode="cover"/>
        <LinearGradient colors={['transparent','rgba(4,8,16,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0.3,y:0}} end={{x:1,y:1}}/>
        {item.duration!=null && (
          <View style={lc.dur}>
            <Ionicons name="time-outline" size={8} color={C.muted}/>
            <Text style={{ color:C.muted,fontSize:8,fontWeight:'600' }}>{fmtDur(item.duration)}</Text>
          </View>
        )}
        <View style={lc.meta}>
          <Text style={lc.title} numberOfLines={1}>{item.title}</Text>
          {!!item.adjective && <Text style={{ color:C.muted,fontSize:9 }} numberOfLines={1}>{item.adjective}</Text>}
          <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
            <Ionicons name="heart" size={9} color={C.mid}/>
            <Text style={lc.stat}>{fmtK(item.likes??0)}</Text>
            {item.director && <><View style={{ width:2,height:2,borderRadius:1,backgroundColor:C.subtle }}/><Text style={lc.stat} numberOfLines={1}>{item.director}</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const lc = StyleSheet.create({
  card:  { width:LW, height:LH, borderRadius:12, overflow:'hidden', backgroundColor:C.navyMid },
  img:   { width:'100%', height:'100%', resizeMode:'cover' },
  dur:   { position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(4,8,16,0.74)',paddingHorizontal:7,paddingVertical:3,borderRadius:7 },
  meta:  { position:'absolute',bottom:9,left:10,right:10,gap:2 },
  title: { color:C.white,fontSize:12,fontWeight:'700' },
  stat:  { color:C.muted,fontSize:9,fontWeight:'600',flexShrink:1 },
});

const RowSection = memo(({ title, sub, count, items, loading, portrait, rank, pep }: {
  title:string; sub?:string; count?:number; items:Work[];
  loading:boolean; portrait:boolean; rank?:boolean; pep?:boolean;
}) => {
  const CW=portrait?PW:LW, CH=portrait?PH:LH, SNAP=CW+10;
  const renderItem = useCallback(({item,index}:{item:Work;index:number}) =>
    portrait ? <PortraitCard item={item} rank={rank?index+1:undefined} pep={pep&&(item.likes??0)<100}/> : <LandscapeCard item={item}/>, [portrait,rank,pep]);
  const getLayout  = useCallback((_:any,i:number) => ({length:SNAP,offset:SNAP*i,index:i}), [SNAP]);
  const keyEx      = useCallback((w:Work) => `${portrait?'p':'l'}${w.id}`, [portrait]);
  if (loading) return <View style={{ marginBottom:0 }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:E,gap:10 }}>{[0,1,2,3,4].map(i=><Shimmer key={i} w={CW} h={CH} r={12}/>)}</ScrollView></View>;
  if (!items.length) return null;
  return (
    <View>
      {!!title && (
        <View style={{ paddingHorizontal:E, marginBottom:14, gap:2 }}>
          <Text style={{ color:C.white,fontSize:17,fontWeight:'800',letterSpacing:-0.3 }}>{title}</Text>
          {(sub||count!=null) && <Text style={{ color:C.muted,fontSize:11 }}>{[sub,count!=null?`${count} œuvres`:null].filter(Boolean).join(' · ')}</Text>}
        </View>
      )}
      <FlatList horizontal data={items} keyExtractor={keyEx} renderItem={renderItem} getItemLayout={getLayout}
        showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:E }}
        decelerationRate="fast" snapToInterval={SNAP} snapToAlignment="start"
        initialNumToRender={6} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews/>
    </View>
  );
});

// ─── SEARCH OVERLAY ──────────────────────────────────────────────────────────
const SearchOverlay = memo(({ visible, onClose, works }: { visible:boolean; onClose:()=>void; works:Work[] }) => {
  const router = useRouter(), insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const inputRef = useRef<TextInput>(null);
  const slideY   = useRef(new Animated.Value(SH)).current;
  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, {toValue:0,useNativeDriver:true,tension:65,friction:10}).start();
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    } else {
      setQ('');
      Animated.timing(slideY, {toValue:SH,duration:220,useNativeDriver:true}).start();
    }
  }, [visible]);
  const results = useMemo(() => {
    if (!q.trim()) return works.slice(0,40);
    const lo = q.toLowerCase();
    return works.filter(w => (w.title??'').toLowerCase().includes(lo) || (w.genre??'').toLowerCase().includes(lo) || (w.director??'').toLowerCase().includes(lo)).slice(0,80);
  }, [q, works]);
  const CW = (SW-42)/2;
  const goFilm = useCallback((id:number) => { onClose(); router.push(`/film/${id}` as any); }, [onClose,router]);
  const renderResult = useCallback(({item}:ListRenderItemInfo<Work>) => (
    <TouchableOpacity style={[so.card,{width:CW}]} onPress={() => goFilm(item.id)} activeOpacity={0.85}>
      <Image source={{uri:resolveImg(item.id,item.image)}} style={so.img} resizeMode="cover"/>
      <LinearGradient colors={['transparent','rgba(4,8,16,0.94)']} style={StyleSheet.absoluteFillObject}/>
      {(item.likes??0)<100 && <View style={so.pep}><Text style={{color:C.white,fontSize:7,fontWeight:'800'}}>PÉPITE</Text></View>}
      <View style={so.info}>
        <Text style={so.iTitle} numberOfLines={2}>{item.title}</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
          <Ionicons name="heart" size={9} color={C.mid}/>
          <Text style={so.iMeta}>{fmtK(item.likes??0)}</Text>
          {item.duration!=null && <><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={so.iMeta}>{fmtDur(item.duration)}</Text></>}
        </View>
      </View>
    </TouchableOpacity>
  ), [goFilm,CW]);
  if (!visible) return null;
  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GalaxyBackground/>
      <Animated.View style={{flex:1,transform:[{translateY:slideY}]}}>
        <View style={[so.top,{paddingTop:insets.top+10}]}>
          <View style={so.row}>
            <Ionicons name="search-outline" size={15} color={C.muted}/>
            <TextInput ref={inputRef} style={so.input} value={q} onChangeText={setQ}
              placeholder="Titre, genre, réalisateur…" placeholderTextColor={C.muted}
              returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" selectionColor={C.blue}/>
          </View>
          <TouchableOpacity onPress={onClose} style={{paddingLeft:8}}>
            <Text style={{color:C.muted,fontSize:14,fontWeight:'600'}}>Annuler</Text>
          </TouchableOpacity>
        </View>
        <View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:16,marginBottom:12}}>
          <Ionicons name="film-outline" size={11} color={C.muted}/>
          <Text style={{color:C.muted,fontSize:11}}>{results.length} résultat{results.length!==1?'s':''}{q.trim()?` pour «\u00a0${q.trim()}\u00a0»`:'\u00a0· Catalogue'}</Text>
        </View>
        {results.length===0
          ? <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10}}><Ionicons name="planet-outline" size={38} color={C.muted}/><Text style={{color:C.mid,fontSize:15,fontWeight:'600'}}>Aucun résultat</Text></View>
          : <FlatList data={results} keyExtractor={w=>`s${w.id}`} renderItem={renderResult}
              numColumns={2} columnWrapperStyle={{justifyContent:'space-between',gap:10,marginBottom:10}}
              contentContainerStyle={{paddingHorizontal:16,paddingBottom:insets.bottom+40}}
              keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={10} windowSize={5}/>}
      </Animated.View>
    </Modal>
  );
});
const so = StyleSheet.create({
  top:   {flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingBottom:10,gap:8},
  row:   {flex:1,flexDirection:'row',alignItems:'center',borderRadius:10,paddingHorizontal:12,height:40,gap:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  input: {flex:1,color:C.white,fontSize:14},
  card:  {height:200,borderRadius:12,overflow:'hidden',backgroundColor:C.navyMid},
  img:   {width:'100%',height:'100%'},
  pep:   {position:'absolute',top:7,right:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},
  info:  {position:'absolute',bottom:8,left:9,right:9,gap:4},
  iTitle:{color:C.white,fontSize:12,fontWeight:'700'},
  iMeta: {color:C.muted,fontSize:10,fontWeight:'600'},
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

  const store = useXPStore();
  const { xp, streak, todayXP, weekXP, lv, nextLv, prog, unlocked, freshBadge, clearFresh, log, addXP } = store;

  const hero      = useMemo(() => works.slice(0,20), [works]);
  const popular   = useMemo(() => works, [works]);
  const recent    = useMemo(() => [...works].sort((a,b)=>{const da=a.created_at?new Date(a.created_at).getTime():0,db=b.created_at?new Date(b.created_at).getTime():0;return db-da;}).slice(0,30), [works]);
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
        <Text style={{ flex:1, color:C.white, fontSize:30, fontWeight:'800', letterSpacing:-0.5 }}>UNIVERSE</Text>
        <TouchableOpacity onPress={() => { hL(); setSrch(true); }}
          style={{ width:38,height:38,borderRadius:19,backgroundColor:C.subtle,
            alignItems:'center',justifyContent:'center',
            borderWidth:StyleSheet.hairlineWidth,borderColor:C.border }}
          activeOpacity={0.78}>
          <Ionicons name="search-outline" size={18} color={C.white}/>
        </TouchableOpacity>
      </Animated.View>
      <SearchOverlay visible={srch} onClose={() => setSrch(false)} works={works}/>
      <GalaxyModal visible={galaxy} onClose={() => setGalaxy(false)}
        works={works} userId={userId}
        xp={xp} streak={streak} todayXP={todayXP} weekXP={weekXP}
        lv={lv} nextLv={nextLv} prog={prog}
        unlocked={unlocked} log={log} addXP={addXP}/>
      <Animated.ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom:120 }} scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}], {useNativeDriver:true})}>
        <HeroBanner works={hero} loading={loading}/>
        <View style={{ height:20 }}/>
        {/* Gamification badge */}
        <View style={{ marginBottom:24 }}>
          <View style={{ flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:E,marginBottom:10 }}>
            <Ionicons name="planet-outline" size={13} color={C.mid}/>
            <Text style={{ color:C.white, fontSize:17, fontWeight:'800' }}>Progression cosmique</Text>
            {unlocked.length > 0 && (
              <View style={{ marginLeft:'auto' as any, paddingHorizontal:9, paddingVertical:3,
                borderRadius:9, backgroundColor:C.goldFaint,
                borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(245,200,66,0.28)' }}>
                <Text style={{ color:C.gold, fontSize:9, fontWeight:'800' }}>{unlocked.length} badge{unlocked.length>1?'s':''}</Text>
              </View>
            )}
          </View>
          <GamificationBadge xp={xp} lv={lv} prog={prog} streak={streak} unlocked={unlocked.length} onPress={() => setGalaxy(true)}/>
        </View>
        <RowSection title="Les plus populaires" count={loading?undefined:works.length} items={popular} loading={loading} portrait rank/>
        {DIV}
        {(recent.length>0||loading) && <><RowSection title="Récemment ajoutés" sub="Nouvelles œuvres" items={recent} loading={loading} portrait={false}/>{DIV}</>}
        {pepites.length>0 && (
          <>
            <View style={{ paddingHorizontal:E, marginBottom:12, flexDirection:'row', alignItems:'center', gap:7 }}>
              <Ionicons name="sparkles-outline" size={13} color={C.mid}/>
              <Text style={{ color:C.white, fontSize:17, fontWeight:'800' }}>Pépites cachées</Text>
              <View style={{ marginLeft:'auto' as any, paddingHorizontal:8, paddingVertical:2, borderRadius:8,
                backgroundColor:'rgba(255,255,255,0.08)', borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderHi }}>
                <Text style={{ color:C.white, fontSize:9, fontWeight:'700' }}>À découvrir</Text>
              </View>
            </View>
            <RowSection title="" items={pepites} loading={loading} portrait pep/>
            {DIV}
          </>
        )}
        {(originals.length>0||loading) && <><RowSection title="Originaux Universe" sub="Créations exclusives" count={loading?undefined:originals.length} items={originals} loading={loading} portrait/>{DIV}</>}
        {(courts.length>0||loading)    && <><RowSection title="Courts métrages" sub="Moins de 60 min" count={loading?undefined:courts.length} items={courts} loading={loading} portrait={false}/>{DIV}</>}
        {(moyens.length>0||loading)    && <><RowSection title="Moyens métrages" sub="60 – 100 min" count={loading?undefined:moyens.length} items={moyens} loading={loading} portrait={false}/>{DIV}</>}
        {(longs.length>0||loading)     && <RowSection title="Mini-séries & longs" sub="100 min+" count={loading?undefined:longs.length} items={longs} loading={loading} portrait={false}/>}
        <View style={{ height:120 }}/>
      </Animated.ScrollView>
    </View>
  );
}