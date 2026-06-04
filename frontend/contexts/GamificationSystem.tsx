/**
 * contexts/GamificationSystem.tsx — UNIVERSE · Gamification v3 · GAME EDITION
 *
 * ★ Manifeste cinéma : 12 phrases choc qui retiennent le spectateur
 * ★ Level-up celebration : modal plein écran + rayons + animation titre
 * ★ Badge unlock toast : slide-in avec glow rareté + phrase d'impact
 * ★ XP float animation : +XP flotte et disparaît sur chaque action
 * ★ GameHUD : barre flottante niveau·streak·score style jeu vidéo
 * ★ Particle burst : étoiles qui explosent au déblocage de badge
 * ★ Tout le copy revu : ton radical, cinéphile, émotionnel
 * ★ ZERO supabase.auth.* — isValidUUID() partout
 */
import React, {
    memo, useCallback, useEffect, useMemo, useRef, useState,
  } from 'react';
  import {
    Animated, Dimensions, Easing, FlatList, Image, Modal,
    Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
  } from 'react-native';
  import { BlurView }          from 'expo-blur';
  import { Ionicons }          from '@expo/vector-icons';
  import { LinearGradient }    from 'expo-linear-gradient';
  import { useRouter }         from 'expo-router';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import { supabase }          from '@/lib/supabase';
  import GalaxyBackground      from '@/components/social/GalaxyBackground';
  
  const { width: SW, height: SH } = Dimensions.get('window');
  
  // ─── PALETTE ──────────────────────────────────────────────────────────────────
  const C = {
    bg:'#070C17',navyMid:'#0D2040',navyLow:'#0A1830',navyDark:'#06101F',
    white:'#FFFFFF',offWhite:'rgba(255,255,255,0.88)',
    mid:'rgba(255,255,255,0.55)',muted:'rgba(255,255,255,0.35)',
    faint:'rgba(255,255,255,0.07)',subtle:'rgba(255,255,255,0.13)',
    border:'rgba(255,255,255,0.09)',borderHi:'rgba(255,255,255,0.22)',
    blue:'#5A96E6',blueDim:'rgba(90,150,230,0.18)',
    gold:'#F5C842',goldDim:'rgba(245,200,66,0.14)',
    green:'#2ECC8A',greenDim:'rgba(46,204,138,0.12)',
    red:'#FF3B5C',orange:'#F97316',purple:'#8B5CF6',purpleDim:'rgba(139,92,246,0.14)',
  } as const;
  
  // ─── CONSTANTES XP ───────────────────────────────────────────────────────────
  export const XP_TABLE = [0,100,300,700,1500,3000,6000,12000,25000,50000] as const;
  export const TITLES = [
    'Spectateur curieux',
    'Cinéphile en éveil',
    'Explorateur indé',
    'Critique en herbe',
    'Curateur underground',
    'Chasseur de pépites',
    'Voix du 7ème art',
    'Maître critique',
    'Légende vivante',
    'Immortel du cinéma',
  ] as const;
  
  // ─── ★ MANIFESTE CINÉMA — 12 phrases choc ────────────────────────────────────
  export const CINEMA_MANIFESTO = [
    "Les films que personne ne finance ont les histoires que tout le monde doit voir.",
    "Vous n'êtes pas spectateur. Vous êtes leur premier public.",
    "Chaque critique que vous écrivez peut changer le destin d'un cinéaste.",
    "Le 7ème art ne survit que si des gens comme vous continuent de regarder.",
    "Ce que vous découvrez ici, le grand public le découvrira dans dix ans.",
    "Un film indépendant sans spectateur, c'est un cri dans le vide. Vous brisez ce silence.",
    "Il n'y a pas de petits films. Il n'y a que des regards trop petits.",
    "Derrière chaque plan, un cinéaste a mis tout ce qu'il avait. Vous lui devez votre attention.",
    "Votre regard aiguisé vaut plus que n'importe quel algorithme.",
    "Universe : l'endroit où le cinéma vivant cherche ses témoins.",
    "Vous ne regardez pas des films. Vous choisissez quel cinéma mérite d'exister.",
    "Certains collectionne les films. Les vrais les font exister.",
  ] as const;
  
  // ─── ★ COPY PAR NIVEAU — phrase d'ascension ───────────────────────────────────
  export const LEVEL_UP_COPY: Record<number, { headline:string; body:string }> = {
    2:  { headline:"L'éveil commence.",          body:"Votre curiosité cinéphile vient de s'allumer. Rien ne sera plus comme avant." },
    3:  { headline:"Vous sortez des sentiers.",  body:"Vous explorez là où les autres n'osent pas aller. Bienvenue dans l'indépendant." },
    4:  { headline:"Votre plume prend vie.",      body:"5 critiques. Vous avez donné de la voix à des films qui en avaient désespérément besoin." },
    5:  { headline:"Le radar s'active.",         body:"Vous faites partie des 5% qui découvrent avant tout le monde. Votre goût est une arme." },
    6:  { headline:"Instinct de prédateur.",     body:"Vous repérez les pépites que les algorithmes manquent. Les réalisateurs ont besoin de vous." },
    7:  { headline:"Une voix dans le chaos.",    body:"Universe porte votre parole. D'autres cinéphiles la lisent, la suivent, la respectent." },
    8:  { headline:"La maîtrise totale.",        body:"Votre contribution au cinéma indépendant est réelle. Mesurable. Irréversible." },
    9:  { headline:"Le mythe prend forme.",      body:"Peu de gens atteignent ce niveau. Vous faites désormais partie de l'histoire d'Universe." },
    10: { headline:"L'immortalité.",             body:"Vous êtes ce que le cinéma indépendant appelle quand il a besoin d'être sauvé." },
  };
  
  // ─── ★ BADGE COPY — descriptions d'impact ─────────────────────────────────────
  const BADGE_IMPACT: Record<string, string> = {
    explorateur_indie:    "Vous avez traversé 10 univers que le grand public n'atteindra jamais.",
    cinephile_nocturne:   "Les films les plus honnêtes se regardent quand tout le monde dort.",
    decouvreur_pepites:   "Votre instinct cinéphile a devancé tous les algorithmes. C'est rare.",
    critique_herbe:       "Votre plume donne une voix à des films qui en avaient besoin. Merci.",
    festival_lover:       "Une programmation entière. Vous avez fait le travail d'un jury.",
    curateur_underground: "10 personnes vous font confiance pour guider leur regard. C'est une responsabilité.",
    ambassadeur_indie:    "10 films envoyés dans le monde. Vous propagez ce que les autres ignorent.",
    famille_cinemato:     "Vous avez suivi un artiste dans sa vision. C'est ce que font les vrais cinéphiles.",
    esprit_ouvert:        "L'expérimental, c'est le cinéma du futur. Vous y étiez.",
    rituel_cinephile:     "5 jours. Un rituel. Une identité. Vous ne regardez plus, vous pratiquez.",
    prescripteur:         "Votre recommandation a changé la soirée de quelqu'un. Peut-être sa vie.",
    legende_7art:         "Les légendes du cinéma ne naissent pas en salle. Elles naissent ici.",
  };
  
  // ─── ★ QUEST TIPS — phrases d'incitation ─────────────────────────────────────
  const QUEST_HOOKS: Record<string, string> = {
    watch_3_same_director: "Ce réalisateur a mis des années à créer son langage. 3 films, et vous le parlez.",
    watch_5_under_5min:    "5 minutes. C'est tout ce qu'il faut pour changer votre vision du cinéma.",
    write_5_critiques:     "Votre critique de 80 mots peut être la bouée de sauvetage d'un cinéaste.",
    connect_1_pro:         "Derrière chaque connexion, une collaboration qui pourrait tout changer.",
    explore_experimental:  "Là où les règles s'effondrent, le cinéma renaît. Explorez.",
    watch_5_consecutive:   "Un film par jour. Le minimum vital du cinéphile en formation.",
  };
  
  const RARITY_COL: Record<string,string> = {
    commun:'rgba(255,255,255,0.60)',rare:C.blue,épique:C.purple,légendaire:C.gold,
  };
  const RARITY_LBL: Record<string,string> = {
    commun:'COMMUN',rare:'RARE',épique:'ÉPIQUE',légendaire:'LÉGENDAIRE',
  };
  const RARITY_GLOW: Record<string,string> = {
    commun:'rgba(255,255,255,0.04)',rare:C.blueDim,épique:C.purpleDim,légendaire:C.goldDim,
  };
  const DIFF_COL: Record<string,string> = {
    facile:C.green,normal:C.blue,difficile:C.orange,légendaire:C.gold,
  };
  
  // ─── TYPES ────────────────────────────────────────────────────────────────────
  export interface Work { id:number;title:string;category:string;genre:string;year:number;likes:number;image:string|null;is_original:boolean;duration:number|null }
  export interface GamiBadge { id:string;label:string;description:string;icon:keyof typeof Ionicons.glyphMap;rarity:'commun'|'rare'|'épique'|'légendaire';xp_reward:number;earned:boolean;earned_at?:string;is_hidden:boolean }
  export interface QuestDef { id:string;title:string;desc:string;target:number;reward_badge:string|null;xp:number;action:string;icon:keyof typeof Ionicons.glyphMap;tip:string }
  export interface QuestProgress { quest_id:string;progress:number;completed:boolean;completed_at?:string }
  export interface ContributionScore { total_score:number;useful_reviews:number;saved_recommendations:number;quality_comments:number;valid_reports:number;followed_playlists:number;shared_films:number;pepites_detected:number }
  export interface ChallengeStep { index:number;title:string;desc:string;action:string;actionLabel:string;icon:keyof typeof Ionicons.glyphMap;xp:number;tip:string }
  export interface WeeklyChallenge { id:number;week_number:number;title:string;subtitle:string|null;description:string;narrative:string|null;icon:keyof typeof Ionicons.glyphMap;color_accent:string;steps:ChallengeStep[];filter_config:{type:string;value?:any;max?:number}|null;reward_label:string|null;reward_points:number;reward_xp:number;difficulty:'facile'|'normal'|'difficile'|'légendaire' }
  export interface ChallengeProgress { step_index:number;steps_done:number[];completed:boolean;points_earned:number;xp_earned:number;time_spent_s:number }
  export interface GamiProfile { xp:number;level:number;title:string;streak_days:number;xpToNext:number;xpInLevel:number;pct:number;contribution_score:number }
  export interface GamiState { profile:GamiProfile;badges:GamiBadge[];earnedBadges:GamiBadge[];pendingBadges:GamiBadge[];loading:boolean;awardXP:(amount:number,reason:string)=>void;awardBadge:(badgeId:string)=>void }
  
  // ─── ★ CATALOGUE BADGES avec descriptions d'impact ───────────────────────────
  export const CINEPHILE_BADGES_CATALOG: Omit<GamiBadge,'earned'|'earned_at'>[] = [
    {id:'explorateur_indie',    label:'Explorateur indé',          description:BADGE_IMPACT.explorateur_indie,    icon:'compass-outline',   rarity:'commun',     xp_reward:15,  is_hidden:false},
    {id:'cinephile_nocturne',   label:'Cinéphile nocturne',         description:BADGE_IMPACT.cinephile_nocturne,  icon:'moon-outline',      rarity:'commun',     xp_reward:5,   is_hidden:false},
    {id:'decouvreur_pepites',   label:'Découvreur de pépites',      description:BADGE_IMPACT.decouvreur_pepites,  icon:'star-outline',      rarity:'rare',       xp_reward:25,  is_hidden:false},
    {id:'critique_herbe',       label:'Critique en herbe',          description:BADGE_IMPACT.critique_herbe,      icon:'create-outline',    rarity:'rare',       xp_reward:40,  is_hidden:false},
    {id:'festival_lover',       label:'Festival Lover',              description:BADGE_IMPACT.festival_lover,      icon:'trophy-outline',    rarity:'rare',       xp_reward:20,  is_hidden:false},
    {id:'curateur_underground', label:'Curateur underground',       description:BADGE_IMPACT.curateur_underground, icon:'bookmark-outline',  rarity:'épique',     xp_reward:50,  is_hidden:false},
    {id:'ambassadeur_indie',    label:'Ambassadeur indé',           description:BADGE_IMPACT.ambassadeur_indie,   icon:'share-outline',     rarity:'épique',     xp_reward:60,  is_hidden:false},
    {id:'famille_cinemato',     label:'Famille cinématographique',  description:BADGE_IMPACT.famille_cinemato,    icon:'people-outline',    rarity:'commun',     xp_reward:10,  is_hidden:false},
    {id:'esprit_ouvert',        label:'Esprit ouvert',               description:BADGE_IMPACT.esprit_ouvert,       icon:'flask-outline',     rarity:'rare',       xp_reward:20,  is_hidden:false},
    {id:'rituel_cinephile',     label:'Rituel cinéphile',           description:BADGE_IMPACT.rituel_cinephile,    icon:'flame-outline',     rarity:'rare',       xp_reward:25,  is_hidden:false},
    {id:'prescripteur',         label:'Prescripteur',                description:BADGE_IMPACT.prescripteur,        icon:'thumbs-up-outline', rarity:'épique',     xp_reward:30,  is_hidden:false},
    {id:'legende_7art',         label:'Légende du 7ème art',        description:BADGE_IMPACT.legende_7art,        icon:'film-outline',      rarity:'légendaire', xp_reward:200, is_hidden:false},
  ];
  
  export const QUEST_DEFINITIONS: QuestDef[] = [
    {id:'watch_3_same_director', title:'Famille cinématographique', desc:'Regarder 3 films du même réalisateur',      target:3, reward_badge:'famille_cinemato',    xp:20, action:'go_catalog', icon:'people-outline',     tip:QUEST_HOOKS.watch_3_same_director},
    {id:'watch_5_under_5min',    title:'Amateur de formats courts', desc:'Découvrir 5 films de moins de 5 minutes',   target:5, reward_badge:'explorateur_indie',   xp:25, action:'go_catalog', icon:'timer-outline',       tip:QUEST_HOOKS.watch_5_under_5min},
    {id:'write_5_critiques',     title:'Voix critique',             desc:'Publier 5 critiques argumentées',           target:5, reward_badge:'critique_herbe',      xp:40, action:'go_social',  icon:'create-outline',      tip:QUEST_HOOKS.write_5_critiques},
    {id:'connect_1_pro',         title:'Réseau professionnel',      desc:"Contacter un professionnel du cinéma",      target:1, reward_badge:null,                  xp:15, action:'go_social',  icon:'briefcase-outline',   tip:QUEST_HOOKS.connect_1_pro},
    {id:'explore_experimental',  title:'Esprit ouvert',             desc:'Explorer le cinéma expérimental (3 films)', target:3, reward_badge:'esprit_ouvert',       xp:20, action:'go_catalog', icon:'flask-outline',       tip:QUEST_HOOKS.explore_experimental},
    {id:'watch_5_consecutive',   title:'Rituel cinéphile',          desc:'1 film par jour pendant 5 jours',           target:5, reward_badge:'rituel_cinephile',    xp:30, action:'go_catalog', icon:'flame-outline',       tip:QUEST_HOOKS.watch_5_consecutive},
  ];
  
  // ─── HELPERS ──────────────────────────────────────────────────────────────────
  export const isValidUUID=(v?:string|null)=>!!v&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  export function xpToLevel(xp:number){
    let level=1;
    for(let i=1;i<XP_TABLE.length;i++){if(xp>=XP_TABLE[i])level=i+1;else break;}
    level=Math.min(level,10);
    const base=XP_TABLE[level-1],next=level<10?XP_TABLE[level]:XP_TABLE[9]*2;
    const inLevel=xp-base,range=next-base;
    return{level,pct:range>0?Math.min(1,inLevel/range):1,xpInLevel:inLevel,xpToNext:Math.max(0,range-inLevel)};
  }
  export const resolveImg=(id:number,img:string|null)=>{
    if(!img)return`https://picsum.photos/seed/work_${id}/400/600`;
    if(img.startsWith('http'))return img;
    try{return supabase.storage.from('community-images').getPublicUrl(img).data.publicUrl;}
    catch{return`https://picsum.photos/seed/work_${id}/400/600`;}
  };
  function currentWeekNumber(){const d=new Date();const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()+4-day);const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));return Math.ceil(((date.getTime()-yearStart.getTime())/86400000+1)/7);}
  
  export const FALLBACK_CHALLENGE:WeeklyChallenge={
    id:0,week_number:currentWeekNumber(),
    title:"L'Éveil du Cinéphile",subtitle:'Chapitre I — Vos premiers pas',
    description:"Ce soir, votre regard sur le cinéma change pour toujours.",
    narrative:"Dans les rues de Paris, une affiche décrochée révèle un cinéma clandestin. Ce premier soir change tout — et vous aussi.",
    icon:'film-outline',color_accent:C.blue,
    steps:[
      {index:0,title:'Créez votre profil',     desc:'Qui êtes-vous comme cinéphile ?',        action:'go_profile', actionLabel:'Mon profil',    icon:'person-outline',      xp:15, tip:"Votre profil est votre carte de visite dans le monde du cinéma indépendant."},
      {index:1,title:'Premier visionnage',     desc:'Regardez un film du début à la fin.',       action:'go_catalog', actionLabel:'Explorer',      icon:'play-circle-outline', xp:20, tip:"Ce réalisateur a tout mis en jeu. Vous lui devez votre attention totale."},
      {index:2,title:"Première critique",      desc:'Écrivez ce que ce film vous a fait.',    action:'go_social',  actionLabel:'Écrire',        icon:'create-outline',      xp:30, tip:"80 mots peuvent changer la trajectoire d'une carrière entière."},
      {index:3,title:"Rejoignez l'industrie",  desc:'Connectez-vous à un professionnel.',     action:'go_social',  actionLabel:'Voir les pros', icon:'briefcase-outline',   xp:25, tip:"Universe est le seul endroit où les artistes et l'industrie se parlent vraiment."},
    ],
    filter_config:null,reward_label:'Badge Éveil + accès anticipé',reward_points:40,reward_xp:90,difficulty:'facile',
  };
  
  // ═════════════════════════════════════════════════════════════════════════════
  // HOOKS
  // ═════════════════════════════════════════════════════════════════════════════
  export function useGamification(userId:string, works:Work[]=[]): GamiState {
    const[profile,setProfile]=useState<GamiProfile>({xp:0,level:1,title:TITLES[0],streak_days:0,xpToNext:100,xpInLevel:0,pct:0,contribution_score:0});
    const[badges,setBadges]=useState<GamiBadge[]>([]);
    const[loading,setLoading]=useState(true);
  
    useEffect(()=>{
      if(!isValidUUID(userId)){setLoading(false);return;}
      let dead=false;
      Promise.all([
        supabase.from('cinephile_profiles').select('xp,level,title,streak_days,contribution_score').eq('user_id',userId).maybeSingle(),
        supabase.from('badges').select('id,label,description,icon,rarity,xp_reward,is_hidden').eq('is_hidden',false),
        supabase.from('user_badges').select('badge_id,earned_at').eq('user_id',userId),
      ]).then(([profR,badgesR,earnedR])=>{
        if(dead)return;
        if(profR.data){
          const{xp=0,level,title,streak_days=0,contribution_score=0}=profR.data as any;
          const lvl=xpToLevel(xp);
          setProfile({xp,level:level??lvl.level,title:title??TITLES[lvl.level-1],streak_days,contribution_score:contribution_score??0,...lvl});
        } else {
          supabase.from('cinephile_profiles').upsert({user_id:userId,xp:0},{onConflict:'user_id'}).catch(()=>{});
        }
        const earnedMap=new Map<string,string>((earnedR.data??[]).map((r:any)=>[r.badge_id,r.earned_at]));
        const dbBadges=(badgesR.data??[]).map((b:any)=>({...b,earned:earnedMap.has(b.id),earned_at:earnedMap.get(b.id)??undefined})) as GamiBadge[];
        const merged=dbBadges.length>0?dbBadges:CINEPHILE_BADGES_CATALOG.map(b=>({...b,earned:earnedMap.has(b.id),earned_at:earnedMap.get(b.id)})) as GamiBadge[];
        setBadges(merged);
        setLoading(false);
      }).catch(()=>{if(!dead)setLoading(false);});
      return()=>{dead=true;};
    },[userId]);
  
    const earnedBadges  = useMemo(()=>badges.filter(b=>b.earned),[badges]);
    const pendingBadges = useMemo(()=>badges.filter(b=>!b.earned),[badges]);
  
    const awardXP=useCallback(async(amount:number,reason:string)=>{
      if(!isValidUUID(userId))return;
      await supabase.rpc('add_xp',{p_user_id:userId,p_xp:amount,p_reason:reason}).catch(()=>{});
      setProfile(prev=>{const newXp=prev.xp+amount;const lvl=xpToLevel(newXp);return{...prev,xp:newXp,...lvl,title:TITLES[lvl.level-1]};});
    },[userId]);
  
    const awardBadge=useCallback(async(badgeId:string)=>{
      if(!isValidUUID(userId))return;
      if(badges.find(b=>b.id===badgeId&&b.earned))return;
      const{error}=await supabase.from('user_badges').upsert({user_id:userId,badge_id:badgeId},{onConflict:'user_id,badge_id'});
      if(!error){
        const badge=badges.find(b=>b.id===badgeId);
        setBadges(prev=>prev.map(b=>b.id===badgeId?{...b,earned:true,earned_at:new Date().toISOString()}:b));
        if(badge?.xp_reward)awardXP(badge.xp_reward,`badge_${badgeId}`);
      }
    },[userId,badges,awardXP]);
  
    return{profile,badges,earnedBadges,pendingBadges,loading,awardXP,awardBadge};
  }
  
  export function useWeeklyChallenge(userId:string){
    const[challenge,setChallenge]=useState<WeeklyChallenge>(FALLBACK_CHALLENGE);
    const[progress,setProgress]=useState<ChallengeProgress|null>(null);
    const[loading,setLoading]=useState(true);
    const weekNum=useMemo(()=>currentWeekNumber(),[]);
    useEffect(()=>{
      let dead=false;
      supabase.from('weekly_challenges').select('id,week_number,title,subtitle,description,narrative,icon,color_accent,steps,filter_config,reward_label,reward_points,reward_xp,difficulty').eq('week_number',weekNum).maybeSingle()
        .then(({data})=>{if(dead||!data)return;setChallenge({...data,steps:Array.isArray(data.steps)?data.steps:[],filter_config:data.filter_config??null,narrative:data.narrative??null,subtitle:data.subtitle??null,reward_label:data.reward_label??null} as WeeklyChallenge);}).catch(()=>{}).finally(()=>{if(!dead)setLoading(false);});
      return()=>{dead=true;};
    },[weekNum]);
    useEffect(()=>{
      if(!isValidUUID(userId))return;
      let dead=false;
      supabase.from('challenge_progress').select('step_index,steps_done,completed,points_earned,xp_earned,time_spent_s').eq('user_id',userId).eq('week_number',weekNum).maybeSingle()
        .then(({data})=>{if(dead||!data)return;setProgress({step_index:data.step_index??0,steps_done:Array.isArray(data.steps_done)?data.steps_done:[],completed:data.completed??false,points_earned:data.points_earned??0,xp_earned:data.xp_earned??0,time_spent_s:data.time_spent_s??0});}).catch(()=>{});
      return()=>{dead=true;};
    },[userId,weekNum]);
    const upsertProgress=useCallback(async(stepIndex:number,completed:boolean)=>{
      if(!isValidUUID(userId))return;
      const total=challenge.steps.length;
      const points=completed?challenge.reward_points:Math.floor((challenge.reward_points??50)*stepIndex/Math.max(1,total));
      const xp=completed?challenge.reward_xp:Math.floor((challenge.reward_xp??0)*stepIndex/Math.max(1,total));
      const prevDone=progress?.steps_done??[];
      const steps_done=[...new Set([...prevDone,stepIndex])];
      const next:ChallengeProgress={step_index:stepIndex,steps_done,completed,points_earned:points,xp_earned:xp,time_spent_s:progress?.time_spent_s??0};
      setProgress(next);
      await supabase.from('challenge_progress').upsert({user_id:userId,week_number:weekNum,step_index:stepIndex,steps_done,completed,points_earned:points,xp_earned:xp,completed_at:completed?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:'user_id,week_number'}).catch(()=>{});
    },[userId,weekNum,challenge,progress]);
    return{challenge,progress,loading,upsertProgress};
  }
  
  export function useQuests(userId:string){
    const[questProgress,setQuestProgress]=useState<Map<string,QuestProgress>>(new Map());
    const[loading,setLoading]=useState(true);
    useEffect(()=>{
      if(!isValidUUID(userId)){setLoading(false);return;}
      let dead=false;
      supabase.from('user_quests').select('quest_id,progress,completed,completed_at').eq('user_id',userId)
        .then(({data})=>{if(dead)return;const m=new Map<string,QuestProgress>();(data??[]).forEach((r:any)=>m.set(r.quest_id,{quest_id:r.quest_id,progress:r.progress??0,completed:r.completed??false,completed_at:r.completed_at??undefined}));setQuestProgress(m);setLoading(false);}).catch(()=>{if(!dead)setLoading(false);});
      return()=>{dead=true;};
    },[userId]);
    const incrementQuest=useCallback(async(questId:string,by=1)=>{
      if(!isValidUUID(userId))return;
      const def=QUEST_DEFINITIONS.find(q=>q.id===questId);if(!def)return;
      const prev=questProgress.get(questId);if(prev?.completed)return;
      const newProg=Math.min((prev?.progress??0)+by,def.target);
      const completed=newProg>=def.target;
      const next:QuestProgress={quest_id:questId,progress:newProg,completed,completed_at:completed?new Date().toISOString():undefined};
      setQuestProgress(m=>{const nm=new Map(m);nm.set(questId,next);return nm;});
      await supabase.from('user_quests').upsert({user_id:userId,quest_id:questId,progress:newProg,completed,completed_at:completed?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:'user_id,quest_id'}).catch(()=>{});
    },[userId,questProgress]);
    const questsWithProgress=useMemo(()=>QUEST_DEFINITIONS.map(def=>({...def,progress:questProgress.get(def.id)?.progress??0,completed:questProgress.get(def.id)?.completed??false,pct:Math.min(1,(questProgress.get(def.id)?.progress??0)/def.target)})),[questProgress]);
    const completedCount=useMemo(()=>questsWithProgress.filter(q=>q.completed).length,[questsWithProgress]);
    return{questsWithProgress,completedCount,loading,incrementQuest};
  }
  
  export function useContributionScore(userId:string){
    const[score,setScore]=useState<ContributionScore>({total_score:0,useful_reviews:0,saved_recommendations:0,quality_comments:0,valid_reports:0,followed_playlists:0,shared_films:0,pepites_detected:0});
    const[loading,setLoading]=useState(true);
    useEffect(()=>{
      if(!isValidUUID(userId)){setLoading(false);return;}
      let dead=false;
      supabase.from('contribution_scores').select('*').eq('user_id',userId).maybeSingle()
        .then(({data})=>{if(dead)return;if(data)setScore({total_score:data.total_score??0,useful_reviews:data.useful_reviews??0,saved_recommendations:data.saved_recommendations??0,quality_comments:data.quality_comments??0,valid_reports:data.valid_reports??0,followed_playlists:data.followed_playlists??0,shared_films:data.shared_films??0,pepites_detected:data.pepites_detected??0});setLoading(false);}).catch(()=>{if(!dead)setLoading(false);});
      return()=>{dead=true;};
    },[userId]);
    const detectPepite=useCallback(async(workId:number,viewsAtLike:number)=>{
      if(!isValidUUID(userId)||viewsAtLike>=100)return false;
      const{error}=await supabase.from('pepite_detections').upsert({user_id:userId,work_id:workId,views_at_like:viewsAtLike},{onConflict:'user_id,work_id'});
      if(!error){await supabase.from('contribution_scores').upsert({user_id:userId,pepites_detected:score.pepites_detected+1,total_score:score.total_score+12,updated_at:new Date().toISOString()},{onConflict:'user_id'}).catch(()=>{});setScore(prev=>({...prev,pepites_detected:prev.pepites_detected+1,total_score:prev.total_score+12}));return true;}
      return false;
    },[userId,score]);
    return{score,loading,detectPepite};
  }
  
  // ═════════════════════════════════════════════════════════════════════════════
  // ★ COMPOSANTS GAME FEEL
  // ═════════════════════════════════════════════════════════════════════════════
  
  // ─── ★ XP FLOAT — animation +XP qui monte et disparaît ────────────────────────
  export const XPFloat = memo(function XPFloat({amount,visible,onDone}:{amount:number;visible:boolean;onDone:()=>void}){
    const y   = useRef(new Animated.Value(0)).current;
    const op  = useRef(new Animated.Value(0)).current;
    const str = `+${amount} XP`;
    useEffect(()=>{
      if(!visible)return;
      y.setValue(0); op.setValue(1);
      Animated.parallel([
        Animated.timing(y, {toValue:-60,duration:1200,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
        Animated.sequence([Animated.delay(700),Animated.timing(op,{toValue:0,duration:500,useNativeDriver:true})]),
      ]).start(onDone);
    },[visible]);
    if(!visible)return null;
    return(
      <Animated.View style={{position:'absolute',alignSelf:'center',transform:[{translateY:y}],opacity:op,zIndex:999,pointerEvents:'none'} as any}>
        <View style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,paddingVertical:5,borderRadius:20,backgroundColor:'rgba(245,200,66,0.20)',borderWidth:1,borderColor:'rgba(245,200,66,0.40)'}}>
          <Ionicons name="flash" size={11} color={C.gold}/>
          <Text style={{color:C.gold,fontSize:13,fontWeight:'900',letterSpacing:0.5}}>{str}</Text>
        </View>
      </Animated.View>
    );
  });
  
  // ─── ★ PARTICLE BURST — étoiles qui explosent ────────────────────────────────
  const PARTICLE_ANGLES = [0,45,90,135,180,225,270,315];
  export const ParticleBurst = memo(function ParticleBurst({trigger,color=C.gold}:{trigger:number;color?:string}){
    const anims = useRef(PARTICLE_ANGLES.map(()=>new Animated.Value(0))).current;
    const opacs = useRef(PARTICLE_ANGLES.map(()=>new Animated.Value(0))).current;
    useEffect(()=>{
      if(trigger===0)return;
      anims.forEach(a=>a.setValue(0));
      opacs.forEach(o=>o.setValue(1));
      Animated.stagger(15,[
        ...PARTICLE_ANGLES.map((_,i)=>Animated.parallel([
          Animated.timing(anims[i],{toValue:1,duration:600,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
          Animated.sequence([Animated.delay(300),Animated.timing(opacs[i],{toValue:0,duration:300,useNativeDriver:true})]),
        ])),
      ]).start();
    },[trigger]);
    return(
      <View style={{position:'absolute',width:0,height:0,alignSelf:'center',top:'50%'}} pointerEvents="none">
        {PARTICLE_ANGLES.map((angle,i)=>{
          const rad=(angle*Math.PI)/180;
          const tx=anims[i].interpolate({inputRange:[0,1],outputRange:[0,Math.cos(rad)*36]});
          const ty=anims[i].interpolate({inputRange:[0,1],outputRange:[0,Math.sin(rad)*36]});
          return(
            <Animated.View key={i} style={{position:'absolute',width:5,height:5,borderRadius:2.5,backgroundColor:color,transform:[{translateX:tx},{translateY:ty}],opacity:opacs[i]}}/>
          );
        })}
      </View>
    );
  });
  
  // ─── ★ BADGE UNLOCK TOAST ─────────────────────────────────────────────────────
  export const BadgeUnlockedToast = memo(function BadgeUnlockedToast({
    badge, visible, onDone,
  }:{badge:GamiBadge|null;visible:boolean;onDone:()=>void}){
    const slideY = useRef(new Animated.Value(-120)).current;
    const [burst,setBurst] = useState(0);
  
    useEffect(()=>{
      if(visible&&badge){
        setBurst(0);
        Animated.spring(slideY,{toValue:0,tension:65,friction:10,useNativeDriver:true}).start(()=>setBurst(v=>v+1));
        const t=setTimeout(()=>{
          Animated.timing(slideY,{toValue:-140,duration:300,useNativeDriver:true}).start(onDone);
        },3200);
        return()=>clearTimeout(t);
      }
    },[visible,badge]);
  
    if(!badge||!visible)return null;
    const col = RARITY_COL[badge.rarity] ?? C.muted;
    const glow= RARITY_GLOW[badge.rarity] ?? C.faint;
    const xpStr = `+${badge.xp_reward} XP`;
    return(
      <Animated.View style={[but.wrap,{backgroundColor:glow,borderColor:`${col}45`,transform:[{translateY:slideY}]}]}>
        <BlurView intensity={Platform.OS==='ios'?28:16} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={{position:'relative',alignItems:'center',justifyContent:'center'}}>
          <ParticleBurst trigger={burst} color={col}/>
          <View style={[but.iconWrap,{backgroundColor:`${col}18`,borderColor:`${col}35`}]}>
            <Ionicons name={badge.icon} size={22} color={col}/>
          </View>
        </View>
        <View style={{flex:1,gap:3}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
            <Text style={[but.rarity,{color:col}]}>BADGE DÉBLOQUÉ · {RARITY_LBL[badge.rarity]}</Text>
            <View style={[but.xpPill,{backgroundColor:`${C.gold}15`,borderColor:`${C.gold}30`}]}>
              <Ionicons name="flash" size={8} color={C.gold}/>
              <Text style={but.xpTxt}>{xpStr}</Text>
            </View>
          </View>
          <Text style={but.title}>{badge.label}</Text>
          <Text style={but.desc} numberOfLines={2}>{BADGE_IMPACT[badge.id]??badge.description}</Text>
        </View>
      </Animated.View>
    );
  });
  const but = StyleSheet.create({
    wrap:    {position:'absolute',top:0,left:16,right:16,zIndex:9999,flexDirection:'row',alignItems:'center',gap:13,padding:14,borderRadius:18,overflow:'hidden',borderWidth:1},
    iconWrap:{width:46,height:46,borderRadius:13,borderWidth:1,alignItems:'center',justifyContent:'center'},
    rarity:  {fontSize:7.5,fontWeight:'900',letterSpacing:1.2},
    xpPill:  {flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2,borderRadius:7,borderWidth:StyleSheet.hairlineWidth},
    xpTxt:   {color:C.gold,fontSize:8,fontWeight:'800'},
    title:   {color:C.white,fontSize:14,fontWeight:'900',letterSpacing:-0.2},
    desc:    {color:'rgba(255,255,255,0.60)',fontSize:11,lineHeight:15},
  });
  
  // ─── ★ LEVEL-UP CELEBRATION MODAL ────────────────────────────────────────────
  export const LevelUpCelebration = memo(function LevelUpCelebration({
    level, title, visible, onClose,
  }:{level:number;title:string;visible:boolean;onClose:()=>void}){
    const numScale  = useRef(new Animated.Value(0)).current;
    const numOp     = useRef(new Animated.Value(0)).current;
    const textOp    = useRef(new Animated.Value(0)).current;
    const rayRot    = useRef(new Animated.Value(0)).current;
    const [burst,setBurst] = useState(0);
    const copy = LEVEL_UP_COPY[level] ?? {headline:'Nouveau niveau.', body:"Votre voyage dans le cinéma indépendant continue."};
    const levelStr = String(level);
    const accentColor = level >= 9 ? C.gold : level >= 7 ? C.purple : level >= 5 ? C.orange : C.blue;
  
    useEffect(()=>{
      if(visible){
        numScale.setValue(0.4); numOp.setValue(0); textOp.setValue(0); setBurst(0);
        Animated.sequence([
          Animated.parallel([
            Animated.spring(numScale,{toValue:1.1,tension:120,friction:6,useNativeDriver:true}),
            Animated.timing(numOp,{toValue:1,duration:300,useNativeDriver:true}),
          ]),
          Animated.spring(numScale,{toValue:1,tension:200,friction:8,useNativeDriver:true}),
          Animated.timing(textOp,{toValue:1,duration:400,useNativeDriver:true}),
        ]).start(()=>setBurst(v=>v+1));
        Animated.loop(Animated.timing(rayRot,{toValue:1,duration:8000,easing:Easing.linear,useNativeDriver:true})).start();
      }
    },[visible]);
  
    if(!visible)return null;
    return(
      <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent>
        <View style={{flex:1,backgroundColor:'rgba(7,12,23,0.92)',alignItems:'center',justifyContent:'center'}}>
          <GalaxyBackground/>
          <View style={{alignItems:'center',gap:20,paddingHorizontal:32}}>
            {/* Rays tournants */}
            <Animated.View style={{position:'absolute',transform:[{rotate:rayRot.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}} pointerEvents="none">
              {[0,30,60,90,120,150,180,210,240,270,300,330].map(angle=>(
                <View key={angle} style={{position:'absolute',width:2,height:80,borderRadius:1,backgroundColor:`${accentColor}25`,transform:[{rotate:`${angle}deg`},{translateY:-40}],top:0,left:-1}}/>
              ))}
            </Animated.View>
  
            {/* Particules */}
            <View style={{width:0,height:0,alignItems:'center',justifyContent:'center'}}>
              <ParticleBurst trigger={burst} color={accentColor}/>
            </View>
  
            {/* Texte ASCENSION */}
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <View style={{height:1,width:30,backgroundColor:`${accentColor}60`}}/>
              <Text style={{color:accentColor,fontSize:9,fontWeight:'900',letterSpacing:3.5}}>ASCENSION</Text>
              <View style={{height:1,width:30,backgroundColor:`${accentColor}60`}}/>
            </View>
  
            {/* Numéro niveau */}
            <Animated.View style={{alignItems:'center',gap:6,transform:[{scale:numScale}],opacity:numOp}}>
              <View style={{width:110,height:110,borderRadius:55,borderWidth:2.5,borderColor:accentColor,backgroundColor:`${accentColor}14`,alignItems:'center',justifyContent:'center'}}>
                <Text style={{fontSize:10,fontWeight:'800',color:accentColor,letterSpacing:2,marginBottom:-4}}>NIVEAU</Text>
                <Text style={{fontSize:52,fontWeight:'900',color:C.white,letterSpacing:-3,lineHeight:60}}>{levelStr}</Text>
              </View>
            </Animated.View>
  
            {/* Nouveau titre */}
            <Animated.View style={{alignItems:'center',gap:10,opacity:textOp}}>
              <Text style={{color:C.gold,fontSize:9,fontWeight:'900',letterSpacing:2.5}}>NOUVELLE IDENTITÉ</Text>
              <Text style={{color:C.white,fontSize:22,fontWeight:'900',textAlign:'center',letterSpacing:-0.5,lineHeight:28}}>{title}</Text>
              <View style={{height:1,width:50,backgroundColor:`${accentColor}50`}}/>
              <Text style={{color:accentColor,fontSize:16,fontWeight:'800',textAlign:'center',letterSpacing:-0.2}}>{copy.headline}</Text>
              <Text style={{color:'rgba(255,255,255,0.58)',fontSize:13,textAlign:'center',lineHeight:20,maxWidth:280}}>{copy.body}</Text>
            </Animated.View>
  
            {/* CTA */}
            <Animated.View style={{opacity:textOp,width:'100%'}}>
              <TouchableOpacity onPress={onClose} style={{paddingVertical:16,borderRadius:16,backgroundColor:accentColor,alignItems:'center',marginTop:8}} activeOpacity={0.85}>
                <Text style={{color:C.navyDark,fontSize:15,fontWeight:'900'}}>Continuer votre voyage →</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </Modal>
    );
  });
  
  // ─── ★ CINEMA MANIFESTO CARD — phrase rotative ───────────────────────────────
  export const CinemaManifestoCard = memo(function CinemaManifestoCard({
    autoRotate=true, intervalMs=5000,
  }:{autoRotate?:boolean;intervalMs?:number}){
    const[idx,setIdx]    = useState(()=>Math.floor(Math.random()*CINEMA_MANIFESTO.length));
    const fadeAnim       = useRef(new Animated.Value(1)).current;
    const slideAnim      = useRef(new Animated.Value(0)).current;
  
    const rotate = useCallback(()=>{
      Animated.parallel([
        Animated.timing(fadeAnim,{toValue:0,duration:350,useNativeDriver:true}),
        Animated.timing(slideAnim,{toValue:-12,duration:350,useNativeDriver:true}),
      ]).start(()=>{
        setIdx(i=>(i+1)%CINEMA_MANIFESTO.length);
        slideAnim.setValue(12);
        Animated.parallel([
          Animated.timing(fadeAnim,{toValue:1,duration:400,useNativeDriver:true}),
          Animated.spring(slideAnim,{toValue:0,tension:120,friction:10,useNativeDriver:true}),
        ]).start();
      });
    },[]);
  
    useEffect(()=>{
      if(!autoRotate)return;
      const t=setInterval(rotate,intervalMs);
      return()=>clearInterval(t);
    },[autoRotate,intervalMs,rotate]);
  
    return(
      <TouchableOpacity onPress={rotate} activeOpacity={0.88} style={{marginHorizontal:20,marginBottom:6}}>
        <View style={cm.wrap}>
          <LinearGradient colors={['rgba(90,150,230,0.08)','rgba(7,12,23,0.95)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:1,y:1}}/>
          <View style={cm.inner}>
            <View style={cm.topRow}>
              <Ionicons name="film" size={12} color={C.blue}/>
              <Text style={cm.label}>UNIVERSE · MANIFESTE</Text>
              <Ionicons name="chevron-forward" size={10} color={C.muted}/>
            </View>
            <Animated.Text style={[cm.quote,{opacity:fadeAnim,transform:[{translateY:slideAnim}]}]}>
              "{CINEMA_MANIFESTO[idx]}"
            </Animated.Text>
          </View>
          <View style={cm.dotsRow}>
            {CINEMA_MANIFESTO.map((_,i)=>(
              <View key={i} style={[cm.dot,i===idx&&{backgroundColor:C.blue,width:12}]}/>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  });
  const cm = StyleSheet.create({
    wrap:    {borderRadius:16,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueDim+'60'},
    inner:   {padding:16,gap:10},
    topRow:  {flexDirection:'row',alignItems:'center',gap:6},
    label:   {color:C.blue,fontSize:8,fontWeight:'800',letterSpacing:1.8,flex:1},
    quote:   {color:C.white,fontSize:14,fontWeight:'700',lineHeight:21,letterSpacing:-0.2,fontStyle:'italic'},
    dotsRow: {flexDirection:'row',justifyContent:'center',gap:4,paddingBottom:12},
    dot:     {width:4,height:4,borderRadius:2,backgroundColor:'rgba(255,255,255,0.18)'},
  });
  
  // ─── ★ GAME HUD — stats compactes style jeu vidéo ────────────────────────────
  export const GameHUD = memo(function GameHUD({
    profile, earnedBadges,
  }:{profile:GamiProfile;earnedBadges:GamiBadge[]}){
    const prog       = useRef(new Animated.Value(0)).current;
    const glowAnim   = useRef(new Animated.Value(0.4)).current;
    const [trigger,setTrigger] = useState(0);
  
    useEffect(()=>{
      Animated.timing(prog,{toValue:profile.pct,duration:900,useNativeDriver:false}).start();
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim,{toValue:1,duration:1800,useNativeDriver:true}),
        Animated.timing(glowAnim,{toValue:0.4,duration:1800,useNativeDriver:true}),
      ])).start();
    },[profile.pct]);
  
    const barW       = prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']});
    const levelStr   = `LV.${profile.level}`;
    const xpStr      = `${profile.xp} XP`;
    const streakStr  = `${profile.streak_days}J`;
    const badgeStr   = `${earnedBadges.length}`;
    const conStr     = String(profile.contribution_score);
  
    return(
      <View style={hud.wrap}>
        <BlurView intensity={Platform.OS==='ios'?24:14} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={hud.inner}>
          {/* Niveau */}
          <Animated.View style={[hud.lvlWrap,{opacity:glowAnim}]}>
            <View style={hud.lvlBadge}>
              <Text style={hud.lvlNum}>{levelStr}</Text>
            </View>
          </Animated.View>
          {/* Barre XP + titre */}
          <View style={{flex:1,gap:3}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <Text style={hud.title} numberOfLines={1}>{profile.title}</Text>
              <Text style={hud.xpLabel}>{xpStr}</Text>
            </View>
            <View style={hud.xpTrack}>
              <Animated.View style={[hud.xpFill,{width:barW}]}/>
            </View>
          </View>
          {/* Stats rapides */}
          <View style={hud.statsRow}>
            {profile.streak_days>=2&&(
              <View style={hud.stat}>
                <Ionicons name="flame" size={10} color={C.orange}/>
                <Text style={[hud.statVal,{color:C.orange}]}>{streakStr}</Text>
              </View>
            )}
            {earnedBadges.length>0&&(
              <View style={hud.stat}>
                <Ionicons name="ribbon-outline" size={10} color={C.gold}/>
                <Text style={[hud.statVal,{color:C.gold}]}>{badgeStr}</Text>
              </View>
            )}
            {profile.contribution_score>0&&(
              <View style={hud.stat}>
                <Ionicons name="star-outline" size={10} color={C.purple}/>
                <Text style={[hud.statVal,{color:C.purple}]}>{conStr}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  });
  const hud = StyleSheet.create({
    wrap:    {borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,position:'relative'},
    inner:   {flexDirection:'row',alignItems:'center',gap:11,padding:12},
    lvlWrap: {position:'relative'},
    lvlBadge:{width:46,height:46,borderRadius:13,borderWidth:2,borderColor:C.borderHi,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'},
    lvlNum:  {color:C.white,fontSize:11,fontWeight:'900',letterSpacing:0.5},
    title:   {color:C.white,fontSize:12,fontWeight:'700',flex:1},
    xpLabel: {color:C.muted,fontSize:10,fontWeight:'700'},
    xpTrack: {height:4,borderRadius:2,backgroundColor:'rgba(255,255,255,0.08)',overflow:'hidden'},
    xpFill:  {height:'100%',borderRadius:2,backgroundColor:`${C.blue}CC`},
    statsRow:{flexDirection:'column',gap:4},
    stat:    {flexDirection:'row',alignItems:'center',gap:3},
    statVal: {fontSize:10,fontWeight:'800'},
  });
  
  // ─── XP BAR (plein — avec glow et contribution) ───────────────────────────────
  export const XPBar = memo(function XPBar({profile,compact=false}:{profile:GamiProfile;compact?:boolean}){
    const prog=useRef(new Animated.Value(0)).current;
    const glow=useRef(new Animated.Value(0.4)).current;
    useEffect(()=>{
      Animated.timing(prog,{toValue:profile.pct,duration:1100,useNativeDriver:false}).start();
      Animated.loop(Animated.sequence([Animated.timing(glow,{toValue:1,duration:2200,useNativeDriver:true}),Animated.timing(glow,{toValue:0.4,duration:2200,useNativeDriver:true})])).start();
    },[profile.pct]);
    const barW=prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']});
    const levelStr=`Niveau ${profile.level}`,xpInStr=`${profile.xpInLevel} XP`,xpNextStr=`${profile.xpToNext} → niv. ${profile.level+1}`;
  
    if(compact)return(
      <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
        <View style={xb.compactBadge}><Text style={xb.compactNum}>{profile.level}</Text></View>
        <View style={{flex:1,gap:4}}>
          <Text style={xb.compactTitle} numberOfLines={1}>{profile.title}</Text>
          <View style={xb.track}><Animated.View style={[xb.fill,{width:barW}]}/></View>
        </View>
        <Text style={xb.xpLabel}>{profile.xp} XP</Text>
      </View>
    );
  
    return(
      <View style={xb.wrap}>
        <BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={{flexDirection:'row',alignItems:'center',gap:14}}>
          <Animated.View style={[xb.glowRing,{opacity:glow}]}/>
          <View style={xb.circle}><Text style={xb.lvlBig}>{profile.level}</Text><Text style={xb.lvlLbl}>NIV</Text></View>
          <View style={{flex:1,gap:7}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={xb.title} numberOfLines={1}>{profile.title}</Text>
              {profile.streak_days>=3&&<View style={xb.streakBadge}><Ionicons name="flame" size={9} color={C.orange}/><Text style={[xb.streakTxt,{color:C.orange}]}>{profile.streak_days}j</Text></View>}
              {profile.contribution_score>0&&<View style={xb.contribPill}><Ionicons name="star-outline" size={8} color={C.gold}/><Text style={xb.contribTxt}>{profile.contribution_score}</Text></View>}
            </View>
            <View style={xb.track}><Animated.View style={[xb.fill,{width:barW}]}/></View>
            <View style={{flexDirection:'row',justifyContent:'space-between'}}>
              <Text style={xb.xpSub}>{xpInStr}</Text>
              {profile.level<10?<Text style={xb.xpSub}>{xpNextStr}</Text>:<Text style={[xb.xpSub,{color:C.gold}]}>NIVEAU MAX ✦</Text>}
            </View>
          </View>
        </View>
      </View>
    );
  });
  XPBar.displayName='XPBar';
  const xb=StyleSheet.create({
    wrap:        {borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14,position:'relative'},
    glowRing:    {position:'absolute',width:82,height:82,borderRadius:41,borderWidth:1.5,borderColor:'rgba(255,255,255,0.15)',top:6,left:6},
    circle:      {width:72,height:72,borderRadius:36,borderWidth:2,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'},
    lvlBig:      {color:C.white,fontSize:22,fontWeight:'900',letterSpacing:-0.8},
    lvlLbl:      {color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:2,marginTop:-3},
    title:       {color:C.white,fontSize:13,fontWeight:'700',flex:1},
    track:       {height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'},
    fill:        {height:'100%',borderRadius:2,backgroundColor:'rgba(255,255,255,0.45)'},
    xpLabel:     {color:C.muted,fontSize:10,fontWeight:'700'},
    xpSub:       {color:C.muted,fontSize:9.5},
    compactBadge:{width:28,height:28,borderRadius:14,borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'},
    compactNum:  {color:C.white,fontSize:11,fontWeight:'900'},
    compactTitle:{color:C.white,fontSize:11,fontWeight:'700'},
    streakBadge: {flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:'rgba(249,115,22,0.14)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(249,115,22,0.28)'},
    streakTxt:   {fontSize:9.5,fontWeight:'800'},
    contribPill: {flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2,borderRadius:7,backgroundColor:C.goldDim,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.25)'},
    contribTxt:  {color:C.gold,fontSize:8,fontWeight:'700'},
  });
  
  // ─── ★ BADGE CHIP interactif ──────────────────────────────────────────────────
  export const BadgeChip = memo(function BadgeChip({b,size='normal'}:{b:GamiBadge;size?:'normal'|'small'}){
    const[open,setOpen]=useState(false);
    const sc  = useRef(new Animated.Value(1)).current;
    const glow= useRef(new Animated.Value(0)).current;
    const col = RARITY_COL[b.rarity]??C.muted;
    const bg  = RARITY_GLOW[b.rarity]??C.faint;
    const isSmall=size==='small';
    const ptsStr=`+${b.xp_reward} XP`;
    const impactText = BADGE_IMPACT[b.id] ?? b.description;
  
    const press=()=>{
      Animated.sequence([
        Animated.spring(sc,{toValue:0.88,tension:350,friction:7,useNativeDriver:true}),
        Animated.spring(sc,{toValue:1,tension:200,friction:8,useNativeDriver:true}),
      ]).start();
      if(b.earned){
        glow.setValue(1);
        Animated.timing(glow,{toValue:0,duration:1200,useNativeDriver:false}).start();
      }
      setOpen(v=>!v);
    };
  
    const borderColor = glow.interpolate({inputRange:[0,1],outputRange:[`${col}35`,col]});
  
    return(
      <Animated.View style={{transform:[{scale:sc}]}}>
        <TouchableOpacity onPress={press} activeOpacity={0.85}>
          <Animated.View style={[bc.wrap,b.earned&&{opacity:1,backgroundColor:bg},isSmall&&bc.wrapSmall,{borderColor:b.earned?borderColor:C.border}] as any}>
            <View style={[bc.icon,b.earned&&{borderColor:`${col}35`,backgroundColor:`${col}14`},isSmall&&bc.iconSmall]}>
              <Ionicons name={b.icon} size={isSmall?12:17} color={b.earned?col:C.muted}/>
            </View>
            {b.earned&&<View style={[bc.rarity,{backgroundColor:`${col}14`,borderColor:`${col}30`}]}><Text style={[bc.rarityTxt,{color:col}]}>{RARITY_LBL[b.rarity]}</Text></View>}
            <Text style={[bc.label,b.earned&&{color:C.offWhite}]} numberOfLines={open?undefined:2}>{b.label}</Text>
            {b.earned&&<Text style={bc.xp}>{ptsStr}</Text>}
            {!b.earned&&<View style={{position:'absolute',top:7,right:7}}><Ionicons name="lock-closed" size={8} color={C.muted}/></View>}
            {open&&<Text style={bc.desc}>{impactText}</Text>}
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  });
  BadgeChip.displayName='BadgeChip';
  const bc=StyleSheet.create({
    wrap:     {alignItems:'center',gap:5,padding:11,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,width:88,opacity:0.52,minHeight:100},
    wrapSmall:{width:68,padding:8,minHeight:76},
    icon:     {width:40,height:40,borderRadius:20,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},
    iconSmall:{width:28,height:28,borderRadius:14},
    label:    {color:C.muted,fontSize:8.5,fontWeight:'600',textAlign:'center',lineHeight:12},
    rarity:   {paddingHorizontal:5,paddingVertical:1.5,borderRadius:5,borderWidth:StyleSheet.hairlineWidth},
    rarityTxt:{fontSize:6.5,fontWeight:'900',letterSpacing:0.5},
    xp:       {color:C.gold,fontSize:8,fontWeight:'800'},
    desc:     {color:'rgba(255,255,255,0.62)',fontSize:8.5,textAlign:'center',lineHeight:12,marginTop:2,fontStyle:'italic'},
  });
  
  export const BadgesRow=memo(function BadgesRow({badges}:{badges:GamiBadge[]}){
    const sorted=useMemo(()=>[...badges.filter(b=>b.earned),...badges.filter(b=>!b.earned)],[badges]);
    return(<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9,paddingHorizontal:20}}>{sorted.map(b=><BadgeChip key={b.id} b={b}/>)}</ScrollView>);
  });
  
  // ─── ★ QUESTS PANEL ───────────────────────────────────────────────────────────
  export const QuestsPanel=memo(function QuestsPanel({questsWithProgress,completedCount,onAction}:{questsWithProgress:ReturnType<typeof useQuests>['questsWithProgress'];completedCount:number;onAction:(action:string)=>void}){
    const doneStr=String(completedCount);const totalStr=String(QUEST_DEFINITIONS.length);
    return(
      <View style={qp.wrap}>
        <View style={qp.header}>
          <Ionicons name="flag-outline" size={13} color={C.mid}/>
          <Text style={qp.title}>Quêtes cinéphiles</Text>
          <View style={qp.badge}><Text style={qp.badgeTxt}>{doneStr}/{totalStr}</Text></View>
        </View>
        {questsWithProgress.map(q=>{
          const pctStr=`${Math.round(q.pct*100)}%`;const progStr=`${q.progress}/${q.target}`;
          return(
            <View key={q.id} style={[qp.row,q.completed&&qp.rowDone]}>
              <View style={[qp.iconWrap,q.completed&&qp.iconDone]}>
                <Ionicons name={q.completed?'checkmark-circle':q.icon} size={16} color={q.completed?C.green:C.mid}/>
              </View>
              <View style={{flex:1,gap:4}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                  <Text style={[qp.rowTitle,q.completed&&{color:C.white}]} numberOfLines={1}>{q.title}</Text>
                  {q.reward_badge&&<View style={qp.rewardPill}><Ionicons name="ribbon-outline" size={8} color={C.gold}/></View>}
                </View>
                <Text style={qp.hook} numberOfLines={1}>{QUEST_HOOKS[q.id]??q.desc}</Text>
                <View style={qp.barRow}>
                  <View style={qp.barTrack}><View style={[qp.barFill,{width:pctStr,backgroundColor:q.completed?C.green:C.blue}] as any}/></View>
                  <Text style={qp.progTxt}>{progStr}</Text>
                </View>
              </View>
              {!q.completed&&<TouchableOpacity onPress={()=>onAction(q.action)} style={qp.actionBtn} activeOpacity={0.80}><Text style={qp.actionTxt}>→</Text></TouchableOpacity>}
            </View>
          );
        })}
      </View>
    );
  });
  const qp=StyleSheet.create({
    wrap:       {gap:8},
    header:     {flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:20,marginBottom:4},
    title:      {color:C.white,fontSize:15,fontWeight:'800',flex:1},
    badge:      {paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
    badgeTxt:   {color:C.muted,fontSize:9,fontWeight:'700'},
    row:        {flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:20,paddingVertical:11,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,marginHorizontal:20},
    rowDone:    {borderColor:'rgba(46,204,138,0.20)',backgroundColor:'rgba(46,204,138,0.04)'},
    iconWrap:   {width:34,height:34,borderRadius:10,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},
    iconDone:   {backgroundColor:'rgba(46,204,138,0.14)',borderColor:'rgba(46,204,138,0.30)'},
    rowTitle:   {color:C.mid,fontSize:12,fontWeight:'700',flex:1},
    hook:       {color:C.muted,fontSize:9.5,fontStyle:'italic',lineHeight:13},
    barRow:     {flexDirection:'row',alignItems:'center',gap:8},
    barTrack:   {flex:1,height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.07)',overflow:'hidden'},
    barFill:    {height:'100%',borderRadius:2},
    progTxt:    {color:C.muted,fontSize:9,fontWeight:'700',minWidth:28,textAlign:'right'},
    rewardPill: {width:16,height:16,borderRadius:8,backgroundColor:C.goldDim,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.28)',alignItems:'center',justifyContent:'center'},
    actionBtn:  {width:28,height:28,borderRadius:14,backgroundColor:C.blueDim,alignItems:'center',justifyContent:'center'},
    actionTxt:  {color:C.blue,fontSize:14,fontWeight:'700'},
  });
  
  // ─── CONTRIBUTION CARD ────────────────────────────────────────────────────────
  export const ContributionCard=memo(function ContributionCard({score}:{score:ContributionScore}){
    const rows=[
      {label:'Avis utiles',        value:score.useful_reviews,       pts:10, icon:'thumbs-up-outline' as const},
      {label:'Recommandations',    value:score.saved_recommendations, pts:15, icon:'bookmark-outline'   as const},
      {label:'Commentaires quali.', value:score.quality_comments,     pts:5,  icon:'chatbubble-outline' as const},
      {label:'Pépites détectées',  value:score.pepites_detected,     pts:12, icon:'star-outline'       as const},
      {label:'Playlists suivies',  value:score.followed_playlists,   pts:20, icon:'list-outline'       as const},
      {label:'Films partagés',     value:score.shared_films,         pts:12, icon:'share-outline'      as const},
    ].filter(r=>r.value>0);
    const totalStr=String(score.total_score);
    return(
      <View style={cc.wrap}>
        <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={cc.header}>
          <Ionicons name="analytics-outline" size={13} color={C.mid}/>
          <Text style={cc.title}>Score de contribution</Text>
          <View style={cc.scorePill}><Text style={cc.scoreNum}>{totalStr}</Text><Text style={cc.scoreLbl}>pts</Text></View>
        </View>
        {rows.length===0
          ?<Text style={{color:C.muted,fontSize:11,textAlign:'center',paddingVertical:10,fontStyle:'italic'}}>Publiez votre première critique pour commencer à contribuer.</Text>
          :rows.map(r=>(<View key={r.label} style={cc.row}><Ionicons name={r.icon} size={12} color={C.mid}/><Text style={cc.rowLabel}>{r.label}</Text><Text style={cc.rowVal}>{r.value}×</Text><Text style={cc.rowPts}>+{r.pts} pts</Text></View>))
        }
      </View>
    );
  });
  const cc=StyleSheet.create({
    wrap:     {borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14,gap:8},
    header:   {flexDirection:'row',alignItems:'center',gap:7,marginBottom:2},
    title:    {color:C.white,fontSize:13,fontWeight:'800',flex:1},
    scorePill:{flexDirection:'row',alignItems:'baseline',gap:3,paddingHorizontal:9,paddingVertical:3,borderRadius:9,backgroundColor:C.goldDim,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.28)'},
    scoreNum: {color:C.gold,fontSize:14,fontWeight:'900'},
    scoreLbl: {color:C.gold,fontSize:9,fontWeight:'700'},
    row:      {flexDirection:'row',alignItems:'center',gap:8},
    rowLabel: {color:C.mid,fontSize:11,flex:1},
    rowVal:   {color:C.white,fontSize:11,fontWeight:'700'},
    rowPts:   {color:C.muted,fontSize:10,width:44,textAlign:'right'},
  });
  
  // ─── WEEKLY CHALLENGE CARD ────────────────────────────────────────────────────
  export const WeeklyChallengeCard=memo(function WeeklyChallengeCard({challenge,progress,onOpen}:{challenge:WeeklyChallenge;progress:ChallengeProgress|null;onOpen:()=>void}){
    const accent=challenge.color_accent;
    const total=challenge.steps.length;
    const doneDone=progress?.steps_done?.length??0;
    const pct=total>0?doneDone/total:0;
    const isDone=progress?.completed??false;
    const diffCol=DIFF_COL[challenge.difficulty]??C.blue;
    const pulseAnim=useRef(new Animated.Value(1)).current;
    const barAnim=useRef(new Animated.Value(0)).current;
    useEffect(()=>{
      if(isDone){pulseAnim.setValue(1);return;}
      const loop=Animated.loop(Animated.sequence([Animated.timing(pulseAnim,{toValue:1.012,duration:2200,useNativeDriver:true}),Animated.timing(pulseAnim,{toValue:1,duration:2200,useNativeDriver:true})]));
      loop.start();return()=>loop.stop();
    },[isDone]);
    useEffect(()=>{Animated.timing(barAnim,{toValue:pct,duration:900,useNativeDriver:false}).start();},[pct]);
    const pctStr=`${Math.round(pct*100)}%`;const weekStr=`SEM. ${challenge.week_number}`;const diffStr=challenge.difficulty.toUpperCase();const pointsStr=`${challenge.reward_points} pts`;const xpStr=`+${challenge.reward_xp} XP`;
    return(
      <Animated.View style={{transform:[{scale:pulseAnim}],marginHorizontal:20,marginBottom:6}}>
        <TouchableOpacity onPress={onOpen} activeOpacity={0.88} style={wcc.wrap}>
          <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>
          <View style={[wcc.strip,{backgroundColor:accent}]}/>
          <View style={wcc.inner}>
            <View style={wcc.header}>
              <View style={[wcc.iconWrap,{backgroundColor:`${accent}18`,borderColor:`${accent}38`}]}><Ionicons name={challenge.icon} size={22} color={accent}/></View>
              <View style={{flex:1,gap:4}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <View style={[wcc.pill,{borderColor:`${accent}35`,backgroundColor:`${accent}12`}]}><Ionicons name="flame-outline" size={8} color={accent}/><Text style={[wcc.pillTxt,{color:accent}]}>{weekStr}</Text></View>
                  <View style={[wcc.pill,{borderColor:`${diffCol}35`,backgroundColor:`${diffCol}10`}]}><Text style={[wcc.pillTxt,{color:diffCol}]}>{diffStr}</Text></View>
                  {isDone&&<View style={[wcc.pill,{borderColor:'rgba(46,204,138,0.30)',backgroundColor:'rgba(46,204,138,0.08)'}]}><Ionicons name="checkmark-circle" size={8} color={C.green}/><Text style={[wcc.pillTxt,{color:C.green}]}>TERMINÉ</Text></View>}
                </View>
                <Text style={wcc.title}>{challenge.title}</Text>
                {challenge.subtitle&&<Text style={wcc.subtitle}>{challenge.subtitle}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={14} color={C.muted}/>
            </View>
            <View style={{flexDirection:'row',gap:5}}>{challenge.steps.map((_,i)=>{const done=(progress?.steps_done??[]).includes(i)||isDone;return(<View key={i} style={[wcc.dot,done&&{backgroundColor:accent,borderColor:accent}]}>{done&&<Ionicons name="checkmark" size={7} color={C.white}/>}</View>);})}</View>
            <View style={{gap:5}}>
              <View style={wcc.track}><Animated.View style={[wcc.fill,{width:barAnim.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),backgroundColor:accent}]}/></View>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={wcc.progTxt}>{isDone?`+${pointsStr} gagnés`:`${pctStr} · ${pointsStr}`}</Text>
                <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="flash" size={9} color={C.gold}/><Text style={[wcc.progTxt,{color:C.gold}]}>{xpStr}</Text></View>
              </View>
            </View>
            {challenge.reward_label&&<View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="gift-outline" size={10} color={C.muted}/><Text style={wcc.rewardTxt}>{challenge.reward_label}</Text></View>}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  });
  WeeklyChallengeCard.displayName='WeeklyChallengeCard';
  const wcc=StyleSheet.create({
    wrap:     {borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},
    strip:    {position:'absolute',left:0,top:0,bottom:0,width:3},
    inner:    {padding:16,paddingLeft:20,gap:10},
    header:   {flexDirection:'row',alignItems:'flex-start',gap:12},
    iconWrap: {width:46,height:46,borderRadius:13,borderWidth:1,alignItems:'center',justifyContent:'center'},
    pill:     {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:7,borderWidth:StyleSheet.hairlineWidth},
    pillTxt:  {fontSize:7.5,fontWeight:'800',letterSpacing:0.6},
    title:    {color:C.white,fontSize:16,fontWeight:'800',letterSpacing:-0.3},
    subtitle: {color:C.muted,fontSize:11},
    dot:      {width:16,height:16,borderRadius:8,borderWidth:1.5,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center'},
    track:    {height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'},
    fill:     {height:'100%',borderRadius:2},
    progTxt:  {color:C.muted,fontSize:10,fontWeight:'600'},
    rewardTxt:{color:C.muted,fontSize:10},
  });
  
  // ─── WEEKLY CHALLENGE MODAL (compact, réutilise les styles précédents) ────────
  const ChallengeWorkCard=memo(function ChallengeWorkCard({item}:{item:Work}){
    const router=useRouter();const uri=resolveImg(item.id,item.image);
    return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}><View style={{width:100,height:148,borderRadius:11,overflow:'hidden',backgroundColor:C.navyMid}}><Image source={{uri}} style={{width:'100%',height:'100%'}} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject}/><View style={{position:'absolute',bottom:7,left:7,right:7}}><Text style={{color:C.white,fontSize:9.5,fontWeight:'700',lineHeight:13}} numberOfLines={2}>{item.title}</Text></View></View></TouchableOpacity>);
  });
  
  export const WeeklyChallengeModal=memo(function WeeklyChallengeModal({visible,onClose,challenge,progress,onStepComplete,works,userId}:{visible:boolean;onClose:()=>void;challenge:WeeklyChallenge;progress:ChallengeProgress|null;onStepComplete:(step:number,done:boolean)=>void;works:Work[];userId:string}){
    const router=useRouter();const insets=useSafeAreaInsets();const accent=challenge.color_accent;
    const slideY=useRef(new Animated.Value(SH)).current;
    const[activeStep,setActiveStep]=useState(0);const[showNarrative,setShowNarrative]=useState(true);
    useEffect(()=>{if(progress)setActiveStep(Math.min(progress.step_index,Math.max(0,challenge.steps.length-1)));},[progress,challenge.steps.length]);
    useEffect(()=>{if(visible){setShowNarrative(!!challenge.narrative);Animated.spring(slideY,{toValue:0,tension:65,friction:12,useNativeDriver:true}).start();}else{Animated.timing(slideY,{toValue:SH,duration:220,useNativeDriver:true}).start();}},[visible,challenge.narrative]);
    const steps=challenge.steps;const total=steps.length;const current=steps[activeStep]??steps[0];const isDone=progress?.completed??false;
    const doneSet=useMemo(()=>new Set(progress?.steps_done??[]),[progress]);
    const globalPct=total>0?doneSet.size/total:0;const diffCol=DIFF_COL[challenge.difficulty]??C.blue;
    const filteredWorks=useMemo(()=>{const cfg=challenge.filter_config;if(!cfg)return works.slice(0,10);switch(cfg.type){case 'duration':return works.filter(w=>(w.duration??0)>0&&(w.duration??0)<=(cfg.max??Infinity)).slice(0,10);case 'likes_max':return works.filter(w=>(w.likes??0)<(cfg.value??100)).slice(0,10);case 'original':return works.filter(w=>w.is_original).slice(0,10);default:return works.slice(0,10);}},[challenge.filter_config,works]);
    const handleAction=useCallback((action:string)=>{const routes:Record<string,string>={go_profile:'/profile',go_create:'/(tabs)/create',go_social:'/(tabs)/social',go_catalog:'/search'};onClose();const route=routes[action];if(route)setTimeout(()=>router.push(route as any),250);},[onClose,router]);
    const handleNext=useCallback(()=>{const next=activeStep+1;if(next<total){setActiveStep(next);onStepComplete(next,false);}else{onStepComplete(activeStep,true);}},[activeStep,total,onStepComplete]);
    const handlePrev=useCallback(()=>{if(activeStep>0)setActiveStep(s=>s-1);},[activeStep]);
    const gBar=useRef(new Animated.Value(0)).current;
    useEffect(()=>{Animated.timing(gBar,{toValue:globalPct,duration:800,useNativeDriver:false}).start();},[globalPct]);
    const stepCountStr=isDone?'✓ Défi accompli !':doneSet.size===0?`${total} étapes`:`${doneSet.size}/${total} étapes`;
    if(!visible)return null;
    return(
      <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
        <GalaxyBackground/>
        <Animated.View style={{flex:1,backgroundColor:'rgba(7,12,23,0.15)',transform:[{translateY:slideY}]}}>
          <View style={[{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:12,gap:10},{paddingTop:insets.top+10}]}>
            <View style={{width:32,height:32,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:`${accent}18`,borderColor:`${accent}35`}}><Ionicons name={challenge.icon} size={14} color={accent}/></View>
            <View style={{flex:1,gap:2}}>
              <Text style={{color:accent,fontSize:7.5,fontWeight:'800',letterSpacing:1}}>DÉFI · SEM. {challenge.week_number} · {challenge.difficulty.toUpperCase()}</Text>
              <Text style={{color:C.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2}} numberOfLines={1}>{challenge.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{width:32,height:32,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center'}}><Ionicons name="close" size={15} color={C.muted}/></TouchableOpacity>
          </View>
          <View style={{paddingHorizontal:20,marginBottom:14}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
              <Text style={{color:C.muted,fontSize:10,fontWeight:'600'}}>{stepCountStr}</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="star-outline" size={9} color={C.muted}/><Text style={{color:C.muted,fontSize:10,fontWeight:'600'}}>{challenge.reward_points} pts</Text></View>
                <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="flash" size={9} color={C.gold}/><Text style={{color:C.gold,fontSize:10,fontWeight:'600'}}>+{challenge.reward_xp} XP</Text></View>
              </View>
            </View>
            <View style={{height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}><Animated.View style={{height:'100%',borderRadius:2,backgroundColor:accent,width:gBar.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/></View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:insets.bottom+40}}>
            {showNarrative&&!!challenge.narrative&&(
              <TouchableOpacity style={{marginHorizontal:20,marginBottom:12,borderRadius:16,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:`${accent}28`,backgroundColor:`${accent}07`,padding:16,gap:10}} onPress={()=>setShowNarrative(false)} activeOpacity={0.80}>
                <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
                <View style={{flexDirection:'row',alignItems:'flex-start',gap:10}}>
                  <View style={{width:36,height:36,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center',borderColor:`${accent}35`,backgroundColor:`${accent}15`}}><Ionicons name="book-outline" size={15} color={accent}/></View>
                  <View style={{flex:1,gap:6}}>
                    <Text style={{color:accent,fontSize:8,fontWeight:'900',letterSpacing:1.5}}>HISTOIRE DU DÉFI</Text>
                    <Text style={{color:'rgba(255,255,255,0.68)',fontSize:13,lineHeight:20,fontStyle:'italic'}}>{challenge.narrative}</Text>
                  </View>
                </View>
                <Text style={{color:`${accent}80`,fontSize:9.5,fontWeight:'600',textAlign:'right',marginTop:4}}>Appuyer pour continuer →</Text>
              </TouchableOpacity>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:20,gap:7,marginBottom:14}}>
              {steps.map((s,i)=>{const done=doneSet.has(i)||isDone;const cur=i===activeStep&&!isDone;return(<TouchableOpacity key={s.index} onPress={()=>setActiveStep(i)} style={{width:28,height:28,borderRadius:14,borderWidth:cur?2:1.5,borderColor:done?'rgba(46,204,138,0.45)':cur?accent:C.border,backgroundColor:done?'rgba(46,204,138,0.18)':C.faint,alignItems:'center',justifyContent:'center'}} activeOpacity={0.75}>{done?<Ionicons name="checkmark" size={10} color={C.white}/>:<Text style={{color:cur?accent:C.muted,fontSize:11,fontWeight:'700'}}>{i+1}</Text>}</TouchableOpacity>);})}
            </ScrollView>
            {!isDone&&current&&(
              <View style={{marginHorizontal:20,borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,padding:20,gap:12,marginBottom:10}}>
                <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>
                <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                  <View style={{width:58,height:58,borderRadius:15,borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:`${accent}15`,borderColor:`${accent}28`}}><Ionicons name={current.icon} size={28} color={accent}/></View>
                  <View style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:9,borderWidth:StyleSheet.hairlineWidth,backgroundColor:`${C.gold}15`,borderColor:`${C.gold}35`}}><Ionicons name="flash" size={9} color={C.gold}/><Text style={{color:C.gold,fontSize:10,fontWeight:'800'}}>+{current.xp} XP</Text></View>
                </View>
                <Text style={{color:C.white,fontSize:20,fontWeight:'900',letterSpacing:-0.4,lineHeight:26}}>{current.title}</Text>
                <Text style={{color:'rgba(255,255,255,0.62)',fontSize:14,lineHeight:22}}>{current.desc}</Text>
                {current.tip&&<View style={{flexDirection:'row',alignItems:'flex-start',gap:8,padding:11,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.22)',backgroundColor:'rgba(245,200,66,0.07)'}}><Ionicons name="bulb-outline" size={12} color={C.gold}/><Text style={{color:'rgba(255,255,255,0.58)',fontSize:12,lineHeight:18,flex:1,fontStyle:'italic'}}>{current.tip}</Text></View>}
                <TouchableOpacity style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:13,borderRadius:14,borderWidth:1,borderColor:`${accent}38`,backgroundColor:`${accent}10`}} onPress={()=>handleAction(current.action)} activeOpacity={0.80}><Text style={{color:accent,fontSize:14,fontWeight:'700'}}>{current.actionLabel}</Text><Ionicons name="arrow-forward" size={13} color={accent}/></TouchableOpacity>
                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9}}>
                  <TouchableOpacity onPress={handlePrev} disabled={activeStep===0} style={{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:10,paddingHorizontal:13,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,opacity:activeStep===0?0.3:1}}><Ionicons name="chevron-back" size={13} color={C.muted}/><Text style={{color:C.muted,fontSize:12,fontWeight:'600'}}>Précédent</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleNext} style={{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:13,borderRadius:14,backgroundColor:accent}} activeOpacity={0.85}><Text style={{color:C.navyDark,fontSize:13,fontWeight:'900'}}>{activeStep===total-1?'Terminer':'Suivant'}</Text><Ionicons name={activeStep===total-1?'checkmark-circle':'chevron-forward'} size={13} color={C.navyDark}/></TouchableOpacity>
                </View>
              </View>
            )}
            {isDone&&(
              <View style={{marginHorizontal:20,borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.32)',padding:24,alignItems:'center',gap:8,marginBottom:10}}>
                <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>
                <View style={{width:68,height:68,borderRadius:34,backgroundColor:'rgba(245,200,66,0.14)',borderWidth:1.5,borderColor:'rgba(245,200,66,0.32)',alignItems:'center',justifyContent:'center'}}><Ionicons name="trophy" size={38} color={C.gold}/></View>
                <Text style={{color:C.white,fontSize:22,fontWeight:'900'}}>Défi accompli !</Text>
                <Text style={{color:C.muted,fontSize:12,textAlign:'center'}}>+{challenge.reward_points} pts · +{challenge.reward_xp} XP</Text>
                <View style={{flexDirection:'row',gap:8,marginTop:6}}>
                  {challenge.reward_label&&<View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:5,borderRadius:18,borderWidth:1,borderColor:'rgba(245,200,66,0.30)',backgroundColor:'rgba(245,200,66,0.10)'}}><Ionicons name="ribbon-outline" size={11} color={C.gold}/><Text style={{color:C.gold,fontSize:11,fontWeight:'700'}}>{challenge.reward_label}</Text></View>}
                  <View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:5,borderRadius:18,borderWidth:1,borderColor:'rgba(46,204,138,0.30)',backgroundColor:'rgba(46,204,138,0.10)'}}><Ionicons name="flash" size={11} color={C.green}/><Text style={{color:C.green,fontSize:11,fontWeight:'700'}}>+{challenge.reward_xp} XP</Text></View>
                </View>
              </View>
            )}
            {filteredWorks.length>0&&(
              <View style={{marginTop:14}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:20,marginBottom:11}}><Ionicons name="film-outline" size={12} color={C.muted}/><Text style={{color:C.white,fontSize:13,fontWeight:'800'}}>Œuvres pour ce défi</Text></View>
                <FlatList horizontal data={filteredWorks} keyExtractor={w=>`cw_${w.id}`} renderItem={({item})=><ChallengeWorkCard item={item}/>} showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:20}} initialNumToRender={6}/>
              </View>
            )}
            <View style={{paddingHorizontal:20,marginTop:18}}>
              <Text style={{color:C.muted,fontSize:9.5,fontWeight:'700',letterSpacing:0.8,marginBottom:10}}>TOUTES LES ÉTAPES</Text>
              {steps.map((s,i)=>{const done=doneSet.has(i)||isDone;const isCur=i===activeStep&&!isDone;return(<TouchableOpacity key={s.index} onPress={()=>setActiveStep(i)} style={{flexDirection:'row',alignItems:'center',gap:11,padding:11,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:done?'rgba(46,204,138,0.18)':isCur?`${accent}38`:C.border,backgroundColor:done?'rgba(46,204,138,0.04)':C.faint,marginBottom:7}} activeOpacity={0.78}><View style={{width:28,height:28,borderRadius:14,borderWidth:1,borderColor:done?'rgba(46,204,138,0.38)':isCur?`${accent}30`:C.border,backgroundColor:done?'rgba(46,204,138,0.18)':isCur?`${accent}14`:C.navyMid,alignItems:'center',justifyContent:'center',flexShrink:0}}>{done?<Ionicons name="checkmark" size={9} color={C.green}/>:<Text style={{color:isCur?accent:C.muted,fontSize:11,fontWeight:'700'}}>{i+1}</Text>}</View><View style={{flex:1,gap:1}}><Text style={{color:(done||isCur)?C.white:C.muted,fontSize:12,fontWeight:'700'}}>{s.title}</Text><Text style={{color:C.muted,fontSize:9}} numberOfLines={1}>{s.desc}</Text></View><View style={{flexDirection:'row',alignItems:'center',gap:2}}><Ionicons name="flash" size={8} color={done?C.green:C.muted}/><Text style={{color:done?C.green:C.muted,fontSize:9,fontWeight:'700'}}>{s.xp}</Text></View><Ionicons name={done?'checkmark-circle':'chevron-forward'} size={13} color={done?C.green:C.border}/></TouchableOpacity>);})}
            </View>
            <View style={{marginHorizontal:20,borderRadius:13,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:13,marginTop:10,marginBottom:6}}>
              <BlurView intensity={Platform.OS==='ios'?10:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <View style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:8}}><Ionicons name="information-circle-outline" size={13} color={C.muted}/><Text style={{color:C.muted,fontSize:9.5,fontWeight:'700',letterSpacing:0.5}}>À PROPOS DU DÉFI</Text></View>
              <Text style={{color:'rgba(255,255,255,0.48)',fontSize:12,lineHeight:19}}>{challenge.description}</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </Modal>
    );
  });
  WeeklyChallengeModal.displayName='WeeklyChallengeModal';
  
  // ─── EXPORTS ──────────────────────────────────────────────────────────────────
  export default {
    useGamification, useWeeklyChallenge, useQuests, useContributionScore,
    XPBar, XPFloat, ParticleBurst, BadgeChip, BadgesRow, GameHUD,
    CinemaManifestoCard, LevelUpCelebration, BadgeUnlockedToast,
    WeeklyChallengeCard, WeeklyChallengeModal, QuestsPanel, ContributionCard,
    FALLBACK_CHALLENGE, CINEPHILE_BADGES_CATALOG, QUEST_DEFINITIONS, CINEMA_MANIFESTO,
    xpToLevel, resolveImg, isValidUUID, LEVEL_UP_COPY, BADGE_IMPACT,
  };