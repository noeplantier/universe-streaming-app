/**
 * app/(tabs)/search.tsx  —  UNIVERSE v11
 * ─────────────────────────────────────────────────────────────────────────────
 *  ★ Découverte de catalogue : hero, sections, recherche
 *  ★ Galaxie XP — Cosmos uniquement : niveau, XP, défis du jour créateur
 *  ★ 3 défis tirés chaque jour d'un pool de 8 (regarder/critiquer/créer/réseauter…)
 *  ★ Palette or/blanc · C.card (#0D2040) · aura divine breathing
 *  ★ ZERO supabase.auth.* · getDeviceId()
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, Easing, FlatList, Image, Modal,
  Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
  type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import { StatusBar }         from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase }          from '@/lib/supabase';
import { getDeviceId }       from '@/services/api';
import GalaxyBackground      from '@/components/shared/GalaxyBackground';
import { GlowAccentCard }    from '@/components/shared/GlowAccentCard';
import { resolveImg, type Work } from '@/contexts/GamificationSystem';

const { width: SW, height: SH } = Dimensions.get('window');
let _H: any = null;
if (Platform.OS !== 'web') { try { _H = require('expo-haptics'); } catch {} }
const hL = () => _H?.impactAsync?.(_H.ImpactFeedbackStyle?.Light  ).catch(() => {});

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg      : '#04080F',
  card    : '#0D2040',   // fond unique badges / cartes
  navy    : '#0A1830',
  white   : '#FFFFFF',
  text    : 'rgba(255,255,255,0.88)',
  muted   : 'rgba(255,255,255,0.42)',
  subtle  : 'rgba(255,255,255,0.14)',
  faint   : 'rgba(255,255,255,0.06)',
  border  : 'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.20)',
  gold    : '#F5C842',
  goldFaint: 'rgba(245,200,66,0.13)',
  goldBd  : 'rgba(245,200,66,0.28)',
  blue    : '#5A96E6',  blueFaint : 'rgba(90,150,230,0.11)',
  green   : '#2ECC8A',  greenFaint: 'rgba(46,204,138,0.11)',
  purple  : '#9B6BFF',  purpleFaint:'rgba(155,107,255,0.12)',
  cyan    : '#4DD8E8',  cyanFaint : 'rgba(77,216,232,0.11)',
  red     : '#FF5C72',
  orange  : '#FF8C42',
} as const;
const E = 20;
const fmtK   = (n:number)=>n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
const fmtDur = (m:number|null)=>{ if(!m)return''; if(m>=60)return`${Math.floor(m/60)}h${m%60?` ${m%60}m`:''}`; return`${m}m`; };

// ─── ATOMS ───────────────────────────────────────────────────────────────────
const Shimmer=memo(({w,h,r=8}:{w:number|string;h:number;r?:number})=>{
  const op=useRef(new Animated.Value(0.15)).current;
  useEffect(()=>{const a=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.34,duration:900,useNativeDriver:true}),Animated.timing(op,{toValue:0.15,duration:900,useNativeDriver:true})]));a.start();return()=>a.stop();},[]);
  return<Animated.View style={{width:w as any,height:h,borderRadius:r,backgroundColor:C.card,opacity:op}}/>;
});

// ─── NIVEAUX ─────────────────────────────────────────────────────────────────
const LEVELS = [
  { level:1, title:'Étoile Naissante', minXP:0,    icon:'star-outline'     as const },
  { level:2, title:'Nébuleuse',        minXP:100,  icon:'sparkles-outline' as const },
  { level:3, title:'Comète',           minXP:300,  icon:'flash-outline'    as const },
  { level:4, title:'Astronaute',       minXP:600,  icon:'rocket-outline'   as const },
  { level:5, title:'Étoile Filante',   minXP:1000, icon:'flash-outline'    as const },
  { level:6, title:'Supernova',        minXP:1800, icon:'nuclear-outline'  as const },
  { level:7, title:'Trou Noir',        minXP:3000, icon:'infinite-outline' as const },
  { level:8, title:'Cosmos Keeper',    minXP:5000, icon:'planet-outline'   as const },
] as const;
type Level = typeof LEVELS[number];

// ─── BADGES (déblocage passif, comptés sur le bouton) ────────────────────────
const BADGE_XP: Record<string,number> = {
  first_watch:20, night_owl:50, original:120, social:80,
  streak_3:75, explorer:200, nugget:150, critique:250, cinephile:500, creator:400,
};
const BADGES = [
  { id:'first_watch', icon:'play-circle-outline' as const, label:'Premier Film',    desc:'Visionner votre premier reel',  xp:50  },
  { id:'streak_3',    icon:'flame-outline'        as const, label:'Flamme ×3',       desc:'3 connexions consécutives',     xp:75  },
  { id:'explorer',    icon:'compass-outline'      as const, label:'Explorateur',     desc:'Explorer 10 genres différents', xp:100 },
  { id:'cinephile',   icon:'film-outline'         as const, label:'Cinéphile',       desc:'Visionner 50 films',            xp:200 },
  { id:'nugget',      icon:'diamond-outline'      as const, label:'Chasseur Pépites',desc:'Découvrir 5 pépites cachées',   xp:150 },
  { id:'night_owl',   icon:'moon-outline'         as const, label:'Hibou Cosmique',  desc:'Actif après 23h',               xp:60  },
  { id:'original',    icon:'star-outline'         as const, label:'Insider',         desc:'3 Originaux Universe vus',      xp:120 },
  { id:'social',      icon:'planet-outline'       as const, label:'Ambassadeur',     desc:'Partager 3 films',              xp:80  },
  { id:'critique',    icon:'create-outline'       as const, label:'Critique',        desc:'Publier 5 critiques',           xp:100 },
  { id:'creator',     icon:'videocam-outline'     as const, label:'Créateur',        desc:'Uploader une vidéo',            xp:150 },
];

// ─── DÉFIS DU JOUR — pool "créateur indépendant", 3 tirés chaque jour ───────
const DAILY_POOL = [
  { id:'watch',    icon:'play-circle-outline' as const, title:'Scout du Jour',   desc:"Visionner un court métrage indépendant sur les Reels",   xp:40, total:1, cta:'Visionner' },
  { id:'critique', icon:'create-outline'      as const, title:'Voix du Cosmos',  desc:"Publier une critique argumentée sur une œuvre",          xp:60, total:1, cta:'Rédiger'    },
  { id:'like',     icon:'heart-outline'       as const, title:'Coup de Cœur',    desc:"Liker la création d'un cinéaste indépendant",            xp:30, total:1, cta:'Découvrir'  },
  { id:'comment',  icon:'chatbubble-outline'  as const, title:'Retour Créateur', desc:"Commenter le travail d'un autre créateur",                xp:35, total:1, cta:'Commenter'  },
  { id:'pro',      icon:'briefcase-outline'   as const, title:'Réseau Pro',      desc:"Contacter un professionnel du cinéma",                    xp:50, total:1, cta:'Réseauter'  },
  { id:'create',   icon:'videocam-outline'    as const, title:'Studio Ouvert',   desc:"Uploader un nouveau projet ou reel",                      xp:80, total:1, cta:'Publier'    },
  { id:'profile',  icon:'person-outline'      as const, title:'Carte de Visite', desc:"Compléter une section de votre profil créateur",          xp:45, total:1, cta:'Profil'     },
  { id:'share',    icon:'share-outline'       as const, title:'Porte-Voix',      desc:"Partager une œuvre avec votre communauté",                xp:30, total:1, cta:'Partager'   },
] as const;
type DailyTpl = typeof DAILY_POOL[number];
type DailyId  = DailyTpl['id'];

// 3 défis distincts par jour calendaire, identiques pour tous, renouvelés à minuit
function todaysChallenges(): DailyTpl[] {
  const dayIndex = Math.floor(Date.now()/86400000);
  const n = DAILY_POOL.length;
  return [0,1,2].map(k => DAILY_POOL[(dayIndex*3 + k) % n]);
}

// ─── FOMO + EN-TÊTE ROTATIF DU BOUTON ────────────────────────────────────────
const FOMO = [
  "Tu es à quelques XP du prochain niveau — continue.",
  "3 cinéphiles t'ont dépassé cette nuit.",
  "Ton streak risque de s'effacer avant demain.",
  "Un créateur indépendant a besoin de toi ce soir.",
  "5 pépites non découvertes ce soir — prends-les.",
  "Ta prochaine critique pourrait lancer une carrière.",
  "47 créateurs actifs en ce moment.",
  "Une critique = 50 XP. C'est maintenant ou jamais.",
  "Ton badge « Cinéphile » est presque là.",
  "Un professionnel attend peut-être ton message.",
  "Chaque film visionné = +20 XP directs.",
  "Sois le premier à noter ce film.",
  "Ton univers ne grandit pas sans toi.",
  "3 minutes d'action = XP garantis.",
  "XP gratuits — juste là, maintenant.",
  "Chaque défi terminé = badge en approche.",
  "Qui soutiendra le cinéma indé aujourd'hui ? Toi.",
];
const SECTIONS = [
  { label:'Galaxie XP', icon:'planet-outline'   as const },
  { label:'Cosmos',     icon:'infinite-outline' as const },
] as const;

// ─── HOOK XP STORE ────────────────────────────────────────────────────────────
function useXPStore() {
  const [xp,        setXp]      = useState(0);
  const [streak]                = useState(0);
  const [unlocked,  setUnlocked]= useState<string[]>([]);
  const [freshBadge,setFresh]   = useState<string|null>(null);
  const [log,       setLog]     = useState<{label:string;xp:number}[]>([]);

  const lv     = useMemo(()=>{ let l:Level=LEVELS[0]; for(const v of LEVELS){if(xp>=v.minXP)l=v;else break;} return l; },[xp]);
  const nextLv = useMemo(()=>{ const i=LEVELS.findIndex(l=>l.level===lv.level); return LEVELS[i+1]??null; },[lv]);
  const prog   = useMemo(()=>{ if(!nextLv)return 1; return Math.min((xp-lv.minXP)/(nextLv.minXP-lv.minXP),1); },[xp,lv,nextLv]);

  useEffect(()=>{
    const news=Object.entries(BADGE_XP).filter(([id,thr])=>xp>=thr&&!unlocked.includes(id)).map(([id])=>id);
    if(news.length){ setUnlocked(p=>[...new Set([...p,...news])]); setFresh(news[news.length-1]); }
  },[xp]);

  const addXP=useCallback((n:number,label?:string)=>{
    setXp(p=>p+n);
    if(label)setLog(p=>[{label,xp:n},...p].slice(0,6));
  },[]);

  return{ xp,streak,lv,nextLv,prog,unlocked,freshBadge,clearFresh:()=>setFresh(null),log,addXP };
}

// ─── HOOK DÉFIS DU JOUR — Supabase daily_checkins ────────────────────────────
function useDailyChallenges(userId:string) {
  const today = useMemo(()=>new Date().toISOString().split('T')[0],[]);
  const challenges = useMemo(()=>todaysChallenges(),[today]);
  const [progress, setProgress] = useState<Record<string,number>>({});
  const [claimed,  setClaimed]  = useState<DailyId[]>([]);

  useEffect(()=>{
    if(!userId)return;
    supabase.from('daily_checkins')
      .select('badge_id,claimed,steps_done')
      .eq('user_id',userId).eq('date',today)
      .then(({data})=>{
        if(!data)return;
        setClaimed(data.filter(r=>r.claimed&&r.badge_id).map(r=>r.badge_id as DailyId));
        const p:Record<string,number>={};
        data.forEach(r=>{ if(r.badge_id&&r.steps_done!=null)p[r.badge_id]=r.steps_done; });
        setProgress(p);
      },()=>{});
  },[userId,today]);

  const bump=useCallback((id:DailyId,total:number)=>{
    setProgress(p=>({...p,[id]:Math.min((p[id]??0)+1,total)}));
    if(!userId)return;
    supabase.from('daily_checkins').upsert({
      user_id:userId,date:today,badge_id:id,steps_done:1,claimed:false,xp_earned:0,streak_day:1,
    }).then(()=>{},()=>{});
  },[userId,today]);

  const claimChallenge=useCallback((id:DailyId,xp:number)=>{
    if(claimed.includes(id))return;
    setClaimed(c=>[...c,id]);
    if(!userId)return;
    supabase.from('daily_checkins').upsert({
      user_id:userId,date:today,badge_id:id,steps_done:1,claimed:true,xp_earned:xp,streak_day:1,
    }).then(()=>{},()=>{});
  },[claimed,userId,today]);

  return{challenges,progress,claimed,bump,claimChallenge};
}

// ─── XP BURST / BADGE TOAST / XP BAR ─────────────────────────────────────────
const XPBurst=memo(({v,n,done}:{v:boolean;n:number;done:()=>void})=>{
  const sc=useRef(new Animated.Value(0)).current,op=useRef(new Animated.Value(0)).current,ty=useRef(new Animated.Value(0)).current;
  useEffect(()=>{if(!v)return;sc.setValue(0);op.setValue(1);ty.setValue(0);Animated.parallel([Animated.spring(sc,{toValue:1,tension:200,friction:8,useNativeDriver:true}),Animated.timing(ty,{toValue:-70,duration:950,useNativeDriver:true}),Animated.sequence([Animated.delay(400),Animated.timing(op,{toValue:0,duration:550,useNativeDriver:true})])]).start(done);},[v]);
  if(!v)return null;
  return(<Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{alignItems:'center',justifyContent:'center',zIndex:9999}]}><Animated.View style={{transform:[{scale:sc},{translateY:ty}],opacity:op,backgroundColor:C.goldFaint,borderWidth:1.5,borderColor:C.gold,borderRadius:28,paddingHorizontal:22,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:8}}><Ionicons name="flash" size={17} color={C.gold}/><Text style={{color:C.gold,fontSize:24,fontWeight:'900'}}>+{n} XP</Text></Animated.View></Animated.View>);
});

const BadgeToast=memo(({id,v,done}:{id:string|null;v:boolean;done:()=>void})=>{
  const badge=BADGES.find(b=>b.id===id);const ty=useRef(new Animated.Value(-100)).current;
  useEffect(()=>{if(!v||!badge)return;Animated.spring(ty,{toValue:0,tension:65,friction:10,useNativeDriver:true}).start();const t=setTimeout(()=>Animated.timing(ty,{toValue:-110,duration:280,useNativeDriver:true}).start(done),3400);return()=>clearTimeout(t);},[v,badge]);
  if(!badge||!v)return null;
  return(
    <Animated.View style={{position:'absolute',top:0,left:14,right:14,zIndex:9999,transform:[{translateY:ty}],borderRadius:16,overflow:'hidden',flexDirection:'row',alignItems:'center',gap:12,padding:14,backgroundColor:'rgba(245,200,66,0.10)',borderWidth:1,borderColor:C.goldBd}}>
      <BlurView intensity={Platform.OS==='ios'?28:14} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={{width:44,height:44,borderRadius:13,backgroundColor:C.goldFaint,borderWidth:1,borderColor:C.goldBd,alignItems:'center',justifyContent:'center'}}><Ionicons name={badge.icon} size={22} color={C.gold}/></View>
      <View style={{flex:1}}><Text style={{color:C.gold,fontSize:9,fontWeight:'900',letterSpacing:1.2}}>★ BADGE DÉBLOQUÉ</Text><Text style={{color:C.white,fontSize:15,fontWeight:'900'}}>{badge.label}</Text><Text style={{color:C.muted,fontSize:11}}>{badge.desc}</Text></View>
      <View style={{alignItems:'center',gap:1}}><Ionicons name="flash" size={11} color={C.gold}/><Text style={{color:C.gold,fontSize:12,fontWeight:'900'}}>{badge.xp}</Text></View>
    </Animated.View>
  );
});

const XPBar=memo(({lv,nextLv,prog,xp}:{lv:Level;nextLv:Level|null;prog:number;xp:number})=>{
  const anim=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(anim,{toValue:prog,duration:1200,useNativeDriver:false}).start();},[prog]);
  return(
    <View style={{paddingHorizontal:E,marginBottom:18}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
          <View style={{width:46,height:46,borderRadius:23,backgroundColor:C.goldFaint,borderWidth:1.5,borderColor:C.goldBd,alignItems:'center',justifyContent:'center'}}><Ionicons name={lv.icon} size={21} color={C.gold}/></View>
          <View><Text style={{color:C.white,fontSize:14,fontWeight:'800'}}>{lv.title}</Text><Text style={{color:C.muted,fontSize:10}}>Niveau {lv.level}</Text></View>
        </View>
        <View style={{alignItems:'flex-end'}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="flash" size={13} color={C.gold}/><Text style={{color:C.gold,fontSize:18,fontWeight:'900'}}>{xp.toLocaleString()}</Text></View>
          {nextLv&&<Text style={{color:C.muted,fontSize:10}}>→ {nextLv.minXP.toLocaleString()} XP</Text>}
        </View>
      </View>
      <View style={{height:5,backgroundColor:C.subtle,borderRadius:3,overflow:'hidden'}}>
        <Animated.View style={{height:'100%',borderRadius:3,backgroundColor:C.gold,width:anim.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/>
      </View>
    </View>
  );
});

// ─── DAILY ROW ────────────────────────────────────────────────────────────────
const DailyRow=memo(({ch,progress:rawProg,claimed,onClaim,onAction}:{
  ch:DailyTpl;progress:number;claimed:boolean;onClaim:()=>void;onAction:()=>void;
})=>{
  const p=rawProg/ch.total;
  const anim=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(anim,{toValue:p,duration:800,useNativeDriver:false}).start();},[p]);
  return(
    <View style={{height:78,marginBottom:8,borderRadius:14,overflow:'hidden',borderWidth:1,borderColor:p>=1?C.goldBd:C.border}}>
      <LinearGradient colors={p>=1?['rgba(245,200,66,0.10)','rgba(13,32,64,0.95)']:[C.card,'rgba(4,8,15,0.94)']} style={{flex:1,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:38,height:38,borderRadius:11,backgroundColor:p>=1?C.goldFaint:C.faint,borderWidth:1,borderColor:p>=1?C.goldBd:C.border,alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Ionicons name={ch.icon} size={17} color={p>=1?C.gold:C.muted}/>
        </View>
        <View style={{flex:1,gap:4}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <Text style={{color:C.white,fontSize:12,fontWeight:'800'}} numberOfLines={1}>{ch.title}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="flash" size={9} color={C.gold}/><Text style={{color:C.gold,fontSize:11,fontWeight:'700'}}>+{ch.xp}</Text></View>
          </View>
          <View style={{height:3,backgroundColor:C.subtle,borderRadius:2,overflow:'hidden'}}>
            <Animated.View style={{height:'100%',borderRadius:2,backgroundColor:p>=1?C.gold:C.white,width:anim.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/>
          </View>
          <Text style={{color:C.muted,fontSize:10}} numberOfLines={1}>{ch.desc}</Text>
        </View>
        {claimed&&<View style={{width:28,height:28,borderRadius:14,backgroundColor:C.goldFaint,borderWidth:1,borderColor:C.goldBd,alignItems:'center',justifyContent:'center',flexShrink:0}}><Text style={{color:C.gold,fontSize:12,fontWeight:'900'}}>✓</Text></View>}
        {!claimed&&p>=1&&<TouchableOpacity onPress={onClaim} style={{backgroundColor:C.gold,borderRadius:10,paddingHorizontal:11,paddingVertical:7,flexShrink:0}}><Text style={{color:C.bg,fontSize:11,fontWeight:'900'}}>CLAIM</Text></TouchableOpacity>}
        {!claimed&&p<1&&<TouchableOpacity onPress={onAction} style={{borderRadius:10,paddingHorizontal:11,paddingVertical:7,borderWidth:1,borderColor:C.goldBd,backgroundColor:C.goldFaint,flexShrink:0}}><Text style={{color:C.gold,fontSize:11,fontWeight:'700'}}>{ch.cta}</Text></TouchableOpacity>}
      </LinearGradient>
    </View>
  );
});

// ─── GALAXY MODAL — Cosmos + Défis du jour (tab unique) ──────────────────────
const GalaxyModal=memo(({
  visible,onClose,xp,lv,nextLv,prog,log,addXP,daily,
}:{
  visible:boolean;onClose:()=>void;
  xp:number;lv:Level;nextLv:Level|null;prog:number;
  log:{label:string;xp:number}[];
  addXP:(n:number,label?:string)=>void;
  daily:ReturnType<typeof useDailyChallenges>;
})=>{
  const router=useRouter(),insets=useSafeAreaInsets();
  const slideY=useRef(new Animated.Value(SH)).current;
  const[burst,setBurst]=useState({v:false,n:0});

  useEffect(()=>{
    if(visible){Animated.spring(slideY,{toValue:0,useNativeDriver:true,tension:62,friction:11}).start();}
    else{Animated.timing(slideY,{toValue:SH,duration:280,useNativeDriver:true}).start();}
  },[visible]);

  const showBurst=useCallback((n:number)=>{setBurst({v:true,n});setTimeout(()=>setBurst({v:false,n:0}),900);},[]);
  const handleClaim=useCallback((id:DailyId,xp:number)=>{daily.claimChallenge(id,xp);addXP(xp,'Défi complété');showBurst(xp);},[daily,addXP,showBurst]);

  const go=useCallback((route:string)=>{onClose();setTimeout(()=>router.push(route as any),320);},[onClose,router]);
  const dailyActions:Record<DailyId,()=>void>={
    watch:   ()=>go('/(tabs)'),
    critique:()=>go('/(tabs)/create?tab=critique'),
    like:    ()=>go('/(tabs)/social?autoScroll=1'),
    comment: ()=>go('/(tabs)/social?focusComment=1'),
    pro:     ()=>go('/(tabs)/professionals?openModal=1'),
    create:  ()=>go('/(tabs)/create'),
    profile: ()=>go('/profile'),
    share:   ()=>go('/(tabs)/social'),
  };

  if(!visible)return null;
  return(
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{flex:1,backgroundColor:'rgba(4,8,15,0.92)'}}>
        <GalaxyBackground/>
        <Animated.View style={{flex:1,transform:[{translateY:slideY}]}}>
          <View style={{paddingTop:insets.top+12,paddingHorizontal:E,paddingBottom:14,flexDirection:'row',alignItems:'center'}}>
            <View style={{flex:1}}>
              <Text style={{color:C.white,fontSize:22,fontWeight:'900',letterSpacing:-0.5}}>Galaxie XP</Text>
              <Text style={{color:C.muted,fontSize:12,marginTop:1}}>{xp.toLocaleString()} XP · {lv.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{width:38,height:38,borderRadius:19,backgroundColor:C.faint,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}>
              <Ionicons name="close" size={18} color={C.white}/>
            </TouchableOpacity>
          </View>
          <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginBottom:4}}/>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:E,paddingBottom:52}}>
            <View style={{alignItems:'center',marginBottom:20}}>
              <View style={{width:80,height:80,borderRadius:40,backgroundColor:C.goldFaint,borderWidth:2,borderColor:C.goldBd,alignItems:'center',justifyContent:'center',marginBottom:8}}><Ionicons name={lv.icon} size={36} color={C.gold}/></View>
              <Text style={{color:C.white,fontSize:21,fontWeight:'900'}}>{lv.title}</Text>
              <Text style={{color:C.muted,fontSize:12,marginTop:2}}>Niveau {lv.level}</Text>
            </View>
            <XPBar lv={lv} nextLv={nextLv} prog={prog} xp={xp}/>
            <Text style={{color:C.white,fontSize:15,fontWeight:'800',marginTop:4,marginBottom:4}}>Défis du jour</Text>
            <Text style={{color:C.muted,fontSize:11,marginBottom:10,fontStyle:'italic'}}>3 actions créateur renouvelées chaque jour — XP au CLAIM</Text>
            {daily.challenges.map(ch=>(
              <DailyRow key={ch.id} ch={ch} progress={daily.progress[ch.id]??0} claimed={daily.claimed.includes(ch.id)}
                onClaim={()=>handleClaim(ch.id,ch.xp)}
                onAction={()=>{daily.bump(ch.id,ch.total);dailyActions[ch.id]?.();}}/>
            ))}
            {log.length>0&&<><Text style={{color:C.white,fontSize:15,fontWeight:'800',marginTop:18,marginBottom:10}}>Récent</Text>{log.map((a,i)=>(<View key={i} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}}><Text style={{color:C.muted,fontSize:12,flex:1}}>{a.label}</Text><Text style={{color:C.gold,fontSize:11,fontWeight:'800'}}>+{a.xp} XP</Text></View>))}</>}
          </ScrollView>
          <XPBurst v={burst.v} n={burst.n} done={()=>{}}/>
        </Animated.View>
      </View>
    </Modal>
  );
});

// ─── GAMIFICATION BADGE — bouton d'entrée (identique à l'original) ──────────
const GamificationBadge=memo(({xp,lv,prog,streak,unlocked,onPress}:{xp:number;lv:Level;prog:number;streak:number;unlocked:number;onPress:()=>void;})=>{
  const[si,setSi]=useState(0);const fade=useRef(new Animated.Value(1)).current;const btnSc=useRef(new Animated.Value(1)).current;const glowOp=useRef(new Animated.Value(0.26)).current;
  useEffect(()=>{const l=Animated.loop(Animated.sequence([Animated.timing(glowOp,{toValue:0.95,duration:2600,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),Animated.timing(glowOp,{toValue:0.26,duration:2600,easing:Easing.inOut(Easing.ease),useNativeDriver:true})]));l.start();return()=>l.stop();},[]);
  useEffect(()=>{const t=setInterval(()=>{Animated.timing(fade,{toValue:0,duration:200,useNativeDriver:true}).start(()=>{setSi(i=>(i+1)%SECTIONS.length);Animated.timing(fade,{toValue:1,duration:260,useNativeDriver:true}).start();});},3600);return()=>clearInterval(t);},[]);
  const press=()=>{hL();Animated.sequence([Animated.timing(btnSc,{toValue:0.94,duration:80,useNativeDriver:true}),Animated.spring(btnSc,{toValue:1,tension:300,friction:8,useNativeDriver:true})]).start(onPress);};
  const sec=SECTIONS[si];const phrase=FOMO[Math.floor((xp+si*37)%FOMO.length)];
  const fmtXP=(n:number)=>n>=1000?`${(n/1000).toFixed(1)}k`:`${n}`;
  const glowStyle:any={position:'absolute',top:-3,bottom:-3,left:-3,right:-3,borderRadius:21,...(Platform.OS==='web'?{boxShadow:`0 0 24px 8px rgba(245,200,66,0.42), 0 0 8px 2px rgba(245,200,66,0.18)`}:{shadowColor:C.gold,shadowOffset:{width:0,height:0},shadowOpacity:0.82,shadowRadius:16,elevation:8})};
  return(
    <TouchableOpacity onPress={press} activeOpacity={1} style={{marginHorizontal:E}}>
      <Animated.View style={{transform:[{scale:btnSc}]}}>
        <Animated.View style={[glowStyle,{opacity:glowOp}]} pointerEvents="none"/>
        <LinearGradient colors={['rgba(245,200,66,0.12)','rgba(13,32,64,0.88)','rgba(4,8,15,0.97)']} start={{x:0,y:0}} end={{x:1,y:1}} style={{height:88,borderRadius:18,paddingHorizontal:17,borderWidth:1,borderColor:C.goldBd,flexDirection:'row',alignItems:'center',gap:14}}>
          <View style={{width:46,height:46,borderRadius:14,flexShrink:0,backgroundColor:C.goldFaint,borderWidth:1.5,borderColor:C.goldBd,alignItems:'center',justifyContent:'center'}}>
            <Ionicons name={lv.icon} size={21} color={C.gold}/>
          </View>
          <View style={{flex:1,gap:4}}>
            <Animated.View style={{opacity:fade,flexDirection:'row',alignItems:'center',gap:6}}>
              <Ionicons name={sec.icon} size={11} color={C.gold}/>
              <Text style={{color:C.gold,fontSize:12,fontWeight:'900',letterSpacing:0.4}}>{sec.label}</Text>
              <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.goldFaint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.goldBd}}>
                <Text style={{color:C.gold,fontSize:9,fontWeight:'800'}}>NIV.{lv.level}</Text>
              </View>
            </Animated.View>
            <Animated.Text style={{color:C.muted,fontSize:11,fontStyle:'italic',opacity:fade}} numberOfLines={1}>{phrase}</Animated.Text>
            <View style={{height:3,backgroundColor:C.subtle,borderRadius:2,overflow:'hidden'}}>
              <View style={{height:'100%',borderRadius:2,backgroundColor:C.gold,width:`${prog*100}%` as any}}/>
            </View>
          </View>
          <View style={{alignItems:'flex-end',gap:5,flexShrink:0}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="flash" size={11} color={C.gold}/><Text style={{color:C.gold,fontSize:13,fontWeight:'900'}}>{fmtXP(xp)}</Text></View>
            {streak>0&&<Text style={{color:C.gold,fontSize:10,fontWeight:'800'}}>★{streak}j</Text>}
            {unlocked>0&&<Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{unlocked} badges</Text>}
            <Ionicons name="chevron-forward" size={13} color={C.muted}/>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
const COLS='id,title,category,genre,year,likes,image,is_original,adjective,duration,director,created_at';
async function fetchWorks():Promise<Work[]>{const{data,error}=await supabase.from('works').select(COLS).order('likes',{ascending:false}).limit(200);if(error){const{data:fb}=await supabase.from('works').select(COLS).limit(100);return(fb??[])as Work[];}return(data??[])as Work[];}

// ─── HERO ─────────────────────────────────────────────────────────────────────
const HERO_H=SH*0.50;
const HeroSlide=memo(({item,W,onPress}:{item:Work;W:number;onPress:()=>void})=>{
  const fade=useRef(new Animated.Value(0)).current;const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return(<TouchableOpacity activeOpacity={0.95} onPress={onPress} style={{width:W,height:HERO_H}}><View style={[StyleSheet.absoluteFill,{backgroundColor:C.card}]}/><Animated.Image source={{uri}} style={[StyleSheet.absoluteFill,{opacity:fade}]} resizeMode="cover" onLoad={()=>Animated.timing(fade,{toValue:1,duration:400,useNativeDriver:true}).start()}/><LinearGradient colors={['rgba(4,8,15,0.48)','transparent']} style={{position:'absolute',top:0,left:0,right:0,height:130}} pointerEvents="none"/><LinearGradient colors={['transparent','rgba(4,8,15,0.72)','rgba(4,8,15,0.97)']} style={{position:'absolute',bottom:0,left:0,right:0,height:'65%' as any}} pointerEvents="none"/><View style={hs.c}><View style={{flexDirection:'row',gap:6}}>{item.is_original&&<View style={hs.orig}><Text style={hs.origT}>★ ORIGINAL</Text></View>}{(item.likes??0)<100&&<View style={hs.pep}><Text style={hs.pepT}>PÉPITE</Text></View>}</View><Text style={hs.title} numberOfLines={2}>{item.title??''}</Text>{!!(item.adjective||item.genre)&&<Text style={hs.sub} numberOfLines={1}>{item.adjective||`${item.genre??''}${item.year?` · ${item.year}`:''}`}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:7}}><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={11} color={C.muted}/><Text style={hs.stat}>{fmtK(item.likes??0)}</Text></View>{item.duration!=null&&<><View style={{width:3,height:3,borderRadius:1.5,backgroundColor:C.faint}}/><Text style={hs.stat}>{fmtDur(item.duration)}</Text></>}</View><View style={hs.actions}><TouchableOpacity style={hs.play} onPress={onPress} activeOpacity={0.85}><Ionicons name="play" size={14} color={C.bg}/><Text style={{color:C.bg,fontSize:13,fontWeight:'700'}}>Regarder</Text></TouchableOpacity><TouchableOpacity style={hs.info} onPress={onPress} activeOpacity={0.80}><Ionicons name="information-circle-outline" size={14} color={C.white}/><Text style={{color:C.white,fontSize:13,fontWeight:'600'}}>Détails</Text></TouchableOpacity></View></View></TouchableOpacity>);
});
const hs=StyleSheet.create({c:{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:22,paddingBottom:50,gap:8},orig:{paddingHorizontal:8,paddingVertical:3,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.goldBd,backgroundColor:C.goldFaint},origT:{color:C.gold,fontSize:9,fontWeight:'800',letterSpacing:0.6},pep:{paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},pepT:{color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.6},title:{color:C.white,fontSize:26,fontWeight:'800',letterSpacing:-0.4,lineHeight:32},sub:{color:C.muted,fontSize:13},stat:{color:C.muted,fontSize:11,fontWeight:'600'},actions:{flexDirection:'row',gap:10,marginTop:2},play:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.white,paddingHorizontal:20,paddingVertical:10,borderRadius:24},info:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.faint,paddingHorizontal:16,paddingVertical:10,borderRadius:24,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}});

const HeroBanner=memo(({works,loading,onFilmPress}:{works:Work[];loading:boolean;onFilmPress:(item:Work)=>void})=>{
  const scrollX=useRef(new Animated.Value(0)).current;const flatRef=useRef<FlatList<Work>>(null);const timerRef=useRef<ReturnType<typeof setInterval>>();const paused=useRef(false),idxRef=useRef(0);const[slotW,setSlotW]=useState(SW);
  const scrollTo=useCallback((i:number)=>{if(!works.length||!slotW)return;const nx=((i%works.length)+works.length)%works.length;flatRef.current?.scrollToOffset({offset:nx*slotW,animated:true});idxRef.current=nx;},[works.length,slotW]);
  useEffect(()=>{if(works.length<2)return;clearInterval(timerRef.current);timerRef.current=setInterval(()=>{if(!paused.current)scrollTo(idxRef.current+1);},5200);return()=>clearInterval(timerRef.current);},[works.length,scrollTo]);
  const onScroll=useMemo(()=>Animated.event([{nativeEvent:{contentOffset:{x:scrollX}}}],{useNativeDriver:false}),[]);
  const renderItem=useCallback(({item}:ListRenderItemInfo<Work>)=><HeroSlide item={item} W={slotW} onPress={()=>onFilmPress(item)}/>,[slotW,onFilmPress]);
  const keyEx=useCallback((w:Work)=>`h${w.id}`,[]);
  if(loading||!works.length)return(<View style={{height:HERO_H,backgroundColor:C.card}}><View style={{...StyleSheet.absoluteFillObject,padding:22,justifyContent:'flex-end',gap:10}}><Shimmer w="50%" h={12}/><Shimmer w="74%" h={26}/><Shimmer w="40%" h={11}/><Shimmer w="52%" h={40} r={24}/></View></View>);
  const dc=Math.min(works.length,8);
  return(<View style={{height:HERO_H,overflow:'hidden'}} onLayout={e=>setSlotW(e.nativeEvent.layout.width)}><FlatList ref={flatRef} data={works} keyExtractor={keyEx} renderItem={renderItem} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16} onScrollBeginDrag={()=>{paused.current=true;}} onMomentumScrollEnd={e=>{idxRef.current=Math.round(e.nativeEvent.contentOffset.x/slotW);paused.current=false;}} windowSize={5} initialNumToRender={3} maxToRenderPerBatch={3} removeClippedSubviews={false}/>{works.length>1&&<View style={{position:'absolute',bottom:14,left:0,right:0,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5}}>{Array.from({length:dc}).map((_,i)=>{const inp=[(i-1)*slotW,i*slotW,(i+1)*slotW];return(<TouchableOpacity key={i} onPress={()=>scrollTo(i)} hitSlop={10}><Animated.View style={{height:3,borderRadius:2,backgroundColor:C.white,opacity:scrollX.interpolate({inputRange:inp,outputRange:[0.25,1,0.25],extrapolate:'clamp'}),width:scrollX.interpolate({inputRange:inp,outputRange:[6,20,6],extrapolate:'clamp'})}}/></TouchableOpacity>);})}</View>}</View>);
});

// ─── CARDS ───────────────────────────────────────────────────────────────────
const PW=128,PH=190,LW=226,LH=128;
const PortraitCard=memo(({item,rank,pep,onPress}:{item:Work;rank?:number;pep?:boolean;onPress?:(item:Work)=>void})=>{
  const router=useRouter();const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  const handlePress=()=>{ onPress?.(item); router.push(`/film/${item.id}` as any); };
  return(<TouchableOpacity style={{marginRight:10}} onPress={handlePress} activeOpacity={0.88}><GlowAccentCard accentColor={C.gold} tier="subtle" borderRadius={12} style={pc.card}><Image source={{uri}} style={pc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(4,8,15,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/><View style={pc.badge}><Text style={pc.badgeT}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>{pep&&<View style={pc.pepite}><Text style={{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.5}}>PÉPITE</Text></View>}{rank!=null&&<Text style={pc.rank}>{rank}</Text>}<View style={pc.meta}><Text style={pc.title} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={9} color={C.muted}/><Text style={pc.stat}>{fmtK(item.likes??0)}</Text>{item.year&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.faint}}/><Text style={pc.stat}>{item.year}</Text></>}</View></View></GlowAccentCard></TouchableOpacity>);
});
const pc=StyleSheet.create({card:{width:PW,height:PH,borderRadius:12,overflow:'hidden',backgroundColor:C.card},img:{width:'100%',height:'100%',resizeMode:'cover'},badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(4,8,15,0.75)'},badgeT:{color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:0.4},pepite:{position:'absolute',top:7,right:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.16)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},rank:{position:'absolute',bottom:32,right:6,fontSize:48,fontWeight:'900',lineHeight:48,letterSpacing:-3,color:'rgba(255,255,255,0.10)'},meta:{position:'absolute',bottom:8,left:9,right:9,gap:3},title:{color:C.white,fontSize:11,fontWeight:'700',lineHeight:14},stat:{color:C.muted,fontSize:9,fontWeight:'600'}});
const LandscapeCard=memo(({item,onPress}:{item:Work;onPress?:(item:Work)=>void})=>{
  const router=useRouter();const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  const handlePress=()=>{ onPress?.(item); router.push(`/film/${item.id}` as any); };
  return(<TouchableOpacity style={{marginRight:10}} onPress={handlePress} activeOpacity={0.88}><GlowAccentCard accentColor={C.gold} tier="subtle" borderRadius={12} style={lc.card}><Image source={{uri}} style={lc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(4,8,15,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0.3,y:0}} end={{x:1,y:1}}/>{item.duration!=null&&<View style={lc.dur}><Ionicons name="time-outline" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:8,fontWeight:'600'}}>{fmtDur(item.duration)}</Text></View>}<View style={lc.meta}><Text style={lc.title} numberOfLines={1}>{item.title}</Text>{!!item.adjective&&<Text style={{color:C.muted,fontSize:9}} numberOfLines={1}>{item.adjective}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.muted}/><Text style={lc.stat}>{fmtK(item.likes??0)}</Text>{item.director&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.faint}}/><Text style={lc.stat} numberOfLines={1}>{item.director}</Text></>}</View></View></GlowAccentCard></TouchableOpacity>);
});
const lc=StyleSheet.create({card:{width:LW,height:LH,borderRadius:12,overflow:'hidden',backgroundColor:C.card},img:{width:'100%',height:'100%',resizeMode:'cover'},dur:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(4,8,15,0.74)',paddingHorizontal:7,paddingVertical:3,borderRadius:7},meta:{position:'absolute',bottom:9,left:10,right:10,gap:2},title:{color:C.white,fontSize:12,fontWeight:'700'},stat:{color:C.muted,fontSize:9,fontWeight:'600',flexShrink:1}});

const RowSection=memo(({title,sub,count,items,loading,portrait,rank,pep,onItemPress}:{title:string;sub?:string;count?:number;items:Work[];loading:boolean;portrait:boolean;rank?:boolean;pep?:boolean;onItemPress?:(item:Work)=>void;})=>{
  const CW=portrait?PW:LW,CH=portrait?PH:LH,SNAP=CW+10;
  const renderItem=useCallback(({item,index}:{item:Work;index:number})=>portrait?<PortraitCard item={item} rank={rank?index+1:undefined} pep={pep&&(item.likes??0)<100} onPress={onItemPress}/>:<LandscapeCard item={item} onPress={onItemPress}/>,[portrait,rank,pep,onItemPress]);
  const getLayout=useCallback((_:any,i:number)=>({length:SNAP,offset:SNAP*i,index:i}),[SNAP]);
  const keyEx=useCallback((w:Work)=>`${portrait?'p':'l'}${w.id}`,[portrait]);
  if(loading)return<View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:E,gap:10}}>{[0,1,2,3,4].map(i=><Shimmer key={i} w={CW} h={CH} r={12}/>)}</ScrollView></View>;
  if(!items.length)return null;
  return(<View>{!!title&&<View style={{paddingHorizontal:E,marginBottom:14,gap:2}}><Text style={{color:C.white,fontSize:17,fontWeight:'800',letterSpacing:-0.3}}>{title}</Text>{(sub||count!=null)&&<Text style={{color:C.muted,fontSize:11}}>{[sub,count!=null?`${count} œuvres`:null].filter(Boolean).join(' · ')}</Text>}</View>}<FlatList horizontal data={items} keyExtractor={keyEx} renderItem={renderItem} getItemLayout={getLayout} showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:E}} decelerationRate="fast" snapToInterval={SNAP} snapToAlignment="start" initialNumToRender={6} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews/></View>);
});

// ─── SEARCH OVERLAY ──────────────────────────────────────────────────────────
const SearchOverlay=memo(({visible,onClose,works}:{visible:boolean;onClose:()=>void;works:Work[]})=>{
  const router=useRouter(),insets=useSafeAreaInsets();const[q,setQ]=useState('');const inputRef=useRef<TextInput>(null);const slideY=useRef(new Animated.Value(SH)).current;
  useEffect(()=>{if(visible){Animated.spring(slideY,{toValue:0,useNativeDriver:true,tension:65,friction:10}).start();const t=setTimeout(()=>inputRef.current?.focus(),300);return()=>clearTimeout(t);}else{setQ('');Animated.timing(slideY,{toValue:SH,duration:220,useNativeDriver:true}).start();}},[visible]);
  const results=useMemo(()=>{if(!q.trim())return works.slice(0,40);const lo=q.toLowerCase();return works.filter(w=>(w.title??'').toLowerCase().includes(lo)||(w.genre??'').toLowerCase().includes(lo)||(w.director??'').toLowerCase().includes(lo)).slice(0,80);},[q,works]);
  const CW=(SW-42)/2;
  const goFilm=useCallback((id:number)=>{onClose();router.push(`/film/${id}` as any);},[onClose,router]);
  const renderR=useCallback(({item}:ListRenderItemInfo<Work>)=>(<TouchableOpacity style={[so.card,{width:CW}]} onPress={()=>goFilm(item.id)} activeOpacity={0.85}><Image source={{uri:resolveImg(item.id,item.image)}} style={so.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(4,8,15,0.94)']} style={StyleSheet.absoluteFillObject}/>{(item.likes??0)<100&&<View style={so.pep}><Text style={{color:C.white,fontSize:7,fontWeight:'800'}}>PÉPITE</Text></View>}<View style={so.info}><Text style={so.iT} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.muted}/><Text style={so.iM}>{fmtK(item.likes??0)}</Text>{item.duration!=null&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.faint}}/><Text style={so.iM}>{fmtDur(item.duration)}</Text></>}</View></View></TouchableOpacity>),[goFilm,CW]);
  if(!visible)return null;
  return(<Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent><GalaxyBackground/><Animated.View style={{flex:1,transform:[{translateY:slideY}]}}><View style={[so.top,{paddingTop:insets.top+10}]}><View style={so.row}><Ionicons name="search-outline" size={15} color={C.muted}/><TextInput ref={inputRef} style={so.input} value={q} onChangeText={setQ} placeholder="Titre, genre, réalisateur…" placeholderTextColor={C.muted} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" selectionColor={C.gold}/></View><TouchableOpacity onPress={onClose} style={{paddingLeft:8}}><Text style={{color:C.muted,fontSize:14,fontWeight:'600'}}>Annuler</Text></TouchableOpacity></View><View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:16,marginBottom:12}}><Ionicons name="film-outline" size={11} color={C.muted}/><Text style={{color:C.muted,fontSize:11}}>{results.length} résultat{results.length!==1?'s':''}{q.trim()?` · «\u00a0${q.trim()}\u00a0»`:''}</Text></View>{results.length===0?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:8}}><Text style={{color:C.gold,fontSize:28}}>★</Text><Text style={{color:C.muted,fontSize:14}}>Aucun résultat</Text></View>:<FlatList data={results} keyExtractor={w=>`s${w.id}`} renderItem={renderR} numColumns={2} columnWrapperStyle={{justifyContent:'space-between',gap:10,marginBottom:10}} contentContainerStyle={{paddingHorizontal:16,paddingBottom:insets.bottom+40}} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={10} windowSize={5}/>}</Animated.View></Modal>);
});
const so=StyleSheet.create({top:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingBottom:10,gap:8},row:{flex:1,flexDirection:'row',alignItems:'center',borderRadius:10,paddingHorizontal:12,height:40,gap:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},input:{flex:1,color:C.white,fontSize:14},card:{height:200,borderRadius:12,overflow:'hidden',backgroundColor:C.card},img:{width:'100%',height:'100%'},pep:{position:'absolute',top:7,right:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},info:{position:'absolute',bottom:8,left:9,right:9,gap:4},iT:{color:C.white,fontSize:12,fontWeight:'700'},iM:{color:C.muted,fontSize:10,fontWeight:'600'}});

// ══════════════════════════════════════════════════════════════════════════════
// ★★★ SEARCH SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export default function SearchScreen(){
  const router=useRouter(),insets=useSafeAreaInsets();
  const[works,setWorks]=useState<Work[]>([]);const[loading,setLoading]=useState(true);
  const[srch,setSrch]=useState(false);
  const[galaxy,setGalaxy]=useState(false);
  const[userId,setUserId]=useState('');
  const scrollY=useRef(new Animated.Value(0)).current;
  const scrollRef=useRef<ScrollView>(null);

  const{xp,streak,lv,nextLv,prog,unlocked,freshBadge,clearFresh,log,addXP}=useXPStore();
  const daily=useDailyChallenges(userId);

  useEffect(()=>{getDeviceId().then(id=>setUserId(id));},[]);
  useEffect(()=>{let dead=false;setLoading(true);fetchWorks().then(d=>{if(!dead){setWorks(d);setLoading(false);}}).catch(()=>{if(!dead)setLoading(false);});return()=>{dead=true;};},[]);

  const hero     =useMemo(()=>works.slice(0,20),[works]);
  const popular  =useMemo(()=>works,[works]);
  const recent   =useMemo(()=>[...works].sort((a,b)=>{const da=a.created_at?new Date(a.created_at).getTime():0,db=b.created_at?new Date(b.created_at).getTime():0;return db-da;}).slice(0,30),[works]);
  const originals=useMemo(()=>works.filter(w=>w.is_original),[works]);
  const courts   =useMemo(()=>works.filter(w=>(w.duration??0)>0&&(w.duration??0)<60),[works]);
  const moyens   =useMemo(()=>works.filter(w=>(w.duration??0)>=60&&(w.duration??0)<=100),[works]);
  const longs    =useMemo(()=>works.filter(w=>(w.duration??0)>100),[works]);
  const pepites  =useMemo(()=>works.filter(w=>(w.likes??0)<100&&(w.likes??0)>5).sort((a,b)=>(b.likes??0)-(a.likes??0)).slice(0,20),[works]);

  const headerOp=scrollY.interpolate({inputRange:[0,80],outputRange:[1,0],extrapolate:'clamp'});
  const DIV=<View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:E,marginVertical:24}}/>;

  return(
    <View style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <BadgeToast id={freshBadge} v={!!freshBadge} done={clearFresh}/>
      <Animated.View pointerEvents="box-none" style={{position:'absolute',top:5,left:0,right:0,zIndex:10,flexDirection:'row',alignItems:'center',paddingHorizontal:E,paddingTop:insets.top+4,paddingBottom:8,opacity:headerOp}}>
        <Text style={{flex:1,color:C.white,fontSize:30,fontWeight:'800',letterSpacing:-0.5}}>UNIVERSE</Text>
        <TouchableOpacity onPress={()=>{hL();setSrch(true);}} style={{width:38,height:38,borderRadius:19,backgroundColor:C.faint,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} activeOpacity={0.78}>
          <Ionicons name="search-outline" size={18} color={C.white}/>
        </TouchableOpacity>
      </Animated.View>
      <SearchOverlay visible={srch} onClose={()=>setSrch(false)} works={works}/>
      <GalaxyModal visible={galaxy} onClose={()=>setGalaxy(false)} xp={xp} lv={lv} nextLv={nextLv} prog={prog} log={log} addXP={addXP} daily={daily}/>
      <Animated.ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:120}} scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:true})}>
        <HeroBanner works={hero} loading={loading} onFilmPress={item=>router.push(`/film/${item.id}` as any)}/>
        <View style={{height:20}}/>
        <GamificationBadge xp={xp} lv={lv} prog={prog} streak={streak} unlocked={unlocked.length} onPress={()=>setGalaxy(true)}/>
        <View style={{height:24}}/>
        <RowSection title="Les plus populaires" count={loading?undefined:works.length} items={popular} loading={loading} portrait rank/>
        {DIV}
        {(recent.length>0||loading)&&<><RowSection title="Récemment ajoutés" sub="Nouvelles œuvres" items={recent} loading={loading} portrait={false}/>{DIV}</>}
        {pepites.length>0&&<><View style={{paddingHorizontal:E,marginBottom:12,flexDirection:'row',alignItems:'center',gap:7}}><Text style={{color:C.gold,fontSize:13}}>★</Text><Text style={{color:C.white,fontSize:17,fontWeight:'800'}}>Pépites cachées</Text><View style={{marginLeft:'auto' as any,paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi}}><Text style={{color:C.white,fontSize:9,fontWeight:'700'}}>À découvrir</Text></View></View><RowSection title="" items={pepites} loading={loading} portrait pep/>{DIV}</>}
        {(originals.length>0||loading)&&<><RowSection title="Originaux Universe" sub="Créations exclusives" count={loading?undefined:originals.length} items={originals} loading={loading} portrait/>{DIV}</>}
        {(courts.length>0||loading)&&<><RowSection title="Courts métrages" sub="Moins de 60 min" count={loading?undefined:courts.length} items={courts} loading={loading} portrait={false}/>{DIV}</>}
        {(moyens.length>0||loading)&&<><RowSection title="Moyens métrages" sub="60 – 100 min" count={loading?undefined:moyens.length} items={moyens} loading={loading} portrait={false}/>{DIV}</>}
        {(longs.length>0||loading)&&<RowSection title="Mini-séries & longs" sub="100 min+" count={loading?undefined:longs.length} items={longs} loading={loading} portrait={false}/>}
        <View style={{height:0}}/>
      </Animated.ScrollView>
    </View>
  );
}

